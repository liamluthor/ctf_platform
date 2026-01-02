import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "http";
import path from "path";
import { setupAuth } from "./auth";
import { setupAccountRoutes } from "./routes/account";
import { storage } from "./storage";
import { logger } from "./logger";
import { upload, getFilePath, deleteFile } from "./services/file-upload";
import * as containerOrchestrator from "./services/container/container-orchestrator";
import { checkDockerHealth } from "./services/container/docker-client";
import { ensureCSRFToken, validateCSRF, validateOrigin } from "./middleware/csrf";
import { sanitizeText, containsXSS } from "./utils/sanitize";
import { sanitizeRequestBody, sanitizeEnvVars, validateContainerName } from "./middleware/sanitize-inputs";

// Middleware to check if user is authenticated
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Middleware to check if user is admin or owner
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user?.role !== "admin" && req.user?.role !== "owner") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// Middleware to check if user is owner
function requireOwner(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  if (req.user?.role !== "owner") {
    return res.status(403).json({ error: "Owner access required" });
  }
  next();
}

/**
 * Helper function to check if a user has access to a challenge
 * Checks: authentication, CTF exists, CTF is active (or user is admin),
 * user is registered for CTF (or user is admin), and challenge is not hidden (or user is admin)
 */
async function checkChallengeAccess(
  challengeId: number,
  userId: string | undefined,
  isAdmin: boolean
): Promise<{ authorized: boolean; error?: string; statusCode?: number }> {
  if (!userId) {
    return { authorized: false, error: "Authentication required", statusCode: 401 };
  }

  const challenge = await storage.getChallenge(challengeId);
  if (!challenge) {
    return { authorized: false, error: "Challenge not found", statusCode: 404 };
  }

  const ctf = await storage.getCtfEvent(challenge.ctfEventId);
  if (!ctf) {
    return { authorized: false, error: "CTF not found", statusCode: 404 };
  }

  // Check if challenge is hidden (admins can see hidden challenges)
  if (challenge.isHidden && !isAdmin) {
    return { authorized: false, error: "Challenge not found", statusCode: 404 };
  }

  // Admins can always access
  if (isAdmin) {
    return { authorized: true };
  }

  // Check if CTF is active
  const now = new Date();
  const isActive = ctf.startTime <= now && ctf.endTime >= now;
  if (!isActive) {
    return { authorized: false, error: "CTF is not currently active", statusCode: 403 };
  }

  // Check if user is registered for this CTF
  const registration = await storage.getCtfRegistration(userId, ctf.id);
  if (!registration) {
    return { authorized: false, error: "You are not registered for this CTF", statusCode: 403 };
  }

  return { authorized: true };
}

export async function registerRoutes(server: Server, app: Express) {
  // Setup authentication routes
  setupAuth(app);

  // Setup account management routes
  setupAccountRoutes(app);

  // ========== PUBLIC ROUTES ==========

  // Get all published CTF events
  app.get("/api/ctfs", async (req, res) => {
    try {
      const events = await storage.getAllCtfEvents();

      // Filter to only published events
      // Private events are visible to everyone, but require invite code to register
      const visibleEvents = events.filter((e) => e.isPublished);

      res.json(visibleEvents);
    } catch (error) {
      logger.error({ error }, "Failed to fetch CTF events");
      res.status(500).json({ error: "Failed to fetch CTF events" });
    }
  });

  // Get single CTF event
  app.get("/api/ctfs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getCtfEvent(id);
      if (!event) {
        return res.status(404).json({ error: "CTF event not found" });
      }
      if (!event.isPublished && req.user?.role !== "admin") {
        return res.status(404).json({ error: "CTF event not found" });
      }
      res.json(event);
    } catch (error) {
      logger.error({ error }, "Failed to fetch CTF event");
      res.status(500).json({ error: "Failed to fetch CTF event" });
    }
  });

  // Get challenges for a CTF event (only during active CTF)
  app.get("/api/ctfs/:id/challenges", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getCtfEvent(id);
      if (!event) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      const now = new Date();
      const isAdmin = req.user?.role === "admin";
      const isActive = event.startTime <= now && event.endTime >= now;

      if (!isActive && !isAdmin) {
        return res.status(403).json({ error: "CTF is not currently active" });
      }

      const challenges = await storage.getChallengesByCtfEvent(id);
      const categories = await storage.getAllCategories();

      // Get user's solves for this CTF
      const userSolves = await storage.getSolvesByUser(req.user!.id);
      const solvedChallengeIds = new Set(
        userSolves.filter((s) => s.ctfEventId === id).map((s) => s.challengeId)
      );

      // Filter hidden challenges unless admin, and add solved status
      const visibleChallenges = challenges
        .filter((c) => !c.isHidden || isAdmin)
        .map((c) => {
          const category = categories.find((cat) => cat.id === c.categoryId);
          return {
            id: c.id,
            name: c.name,
            description: c.description,
            points: c.points,
            isDynamic: c.isDynamic,
            solveCount: c.solveCount,
            category: category ? { id: category.id, name: category.name, color: category.color, icon: category.icon } : null,
            solved: solvedChallengeIds.has(c.id),
            isHidden: c.isHidden,
          };
        });

      res.json(visibleChallenges);
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenges");
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Get leaderboard for a CTF event
  app.get("/api/ctfs/:id/leaderboard", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getCtfEvent(id);
      if (!event) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const leaderboard = await storage.getLeaderboard(id, limit);

      // If scoreboard is frozen, we shouldn't show updates after freeze time
      // For simplicity, we'll just return the current state but could filter by freeze time
      res.json({
        isTeamBased: event.isTeamBased,
        scoreboardFrozen: event.scoreboardFrozen,
        entries: leaderboard,
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch leaderboard");
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // Get score progression over time for a CTF event
  app.get("/api/ctfs/:id/score-progression", async (req, res) => {
    try {
      const ctfId = parseInt(req.params.id);
      const event = await storage.getCtfEvent(ctfId);
      if (!event) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      // Get all solves for this CTF, ordered by time
      const solves = await storage.getSolvesByCtfEvent(ctfId);

      // Build score progression for each player/team
      const progressionMap = new Map<string | number, Array<{ time: Date; score: number }>>();

      // Sort solves by time
      const sortedSolves = solves.sort((a, b) =>
        new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime()
      );

      // Track cumulative scores
      const scores = new Map<string | number, number>();

      for (const solve of sortedSolves) {
        const id = event.isTeamBased ? solve.teamId : solve.userId;
        if (!id) continue;

        const currentScore = scores.get(id) || 0;
        const newScore = currentScore + solve.points;
        scores.set(id, newScore);

        if (!progressionMap.has(id)) {
          progressionMap.set(id, [{ time: new Date(solve.solvedAt), score: newScore }]);
        } else {
          progressionMap.get(id)!.push({ time: new Date(solve.solvedAt), score: newScore });
        }
      }

      // Get names for each id
      const entries = await Promise.all(
        Array.from(progressionMap.entries()).map(async ([id, progression]) => {
          let name = "Unknown";
          if (event.isTeamBased) {
            const team = await storage.getTeam(id as number);
            name = team?.name || "Unknown Team";
          } else {
            const user = await storage.getUser(id as string);
            name = user?.username || "Unknown User";
          }
          return { id, name, progression };
        })
      );

      // Sort by final score descending
      entries.sort((a, b) => {
        const aFinal = a.progression[a.progression.length - 1]?.score || 0;
        const bFinal = b.progression[b.progression.length - 1]?.score || 0;
        return bFinal - aFinal;
      });

      res.json({
        isTeamBased: event.isTeamBased,
        entries: entries.slice(0, 10), // Top 10 only
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch score progression");
      res.status(500).json({ error: "Failed to fetch score progression" });
    }
  });

  // Check if user is registered for a CTF event
  app.get("/api/ctfs/:id/registration", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const registration = await storage.getCtfRegistration(req.user!.id, id);
      res.json(!!registration);
    } catch (error) {
      logger.error({ error }, "Failed to check registration status");
      res.status(500).json({ error: "Failed to check registration status" });
    }
  });

  // Register for a CTF event (with optional invite code for private events)
  app.post("/api/ctfs/:id/register", requireAuth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { inviteCode, teamId } = req.body;

      const event = await storage.getCtfEvent(id);
      if (!event) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      // Check if event is private and validate invite code
      if (event.isPrivate) {
        if (!inviteCode || inviteCode !== event.inviteCode) {
          return res.status(403).json({ error: "Invalid or missing invite code" });
        }
      }

      // Check if already registered
      const existing = await storage.getCtfRegistration(req.user!.id, event.id);
      if (existing) {
        return res.status(400).json({ error: "Already registered for this event" });
      }

      // Register the user
      const registration = await storage.registerForCtf(req.user!.id, event.id, teamId);
      res.json(registration);
    } catch (error) {
      logger.error({ error }, "Failed to register for CTF event");
      res.status(500).json({ error: "Failed to register for CTF event" });
    }
  });

  // Get all categories
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getAllCategories();
      res.json(categories);
    } catch (error) {
      logger.error({ error }, "Failed to fetch categories");
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  // ========== USER ROUTES ==========

  // Get user profile
  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // SECURITY: Authorization check - only allow viewing own profile or admin access
      const isOwnProfile = req.user && req.user.id === req.params.id;
      const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "owner");

      if (!isOwnProfile && !isAdmin) {
        // Public view: Only return non-sensitive fields
        logger.warn({
          requestedUserId: req.params.id,
          requestingUserId: req.user?.id,
          ip: req.ip
        }, "Unauthorized user profile access attempt");
        return res.json({
          id: user.id,
          username: user.username,
          // Do not expose: email, role, isBanned, createdAt
        });
      }

      // Full access for own profile or admin
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      logger.error({ error }, "Failed to fetch user");
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Get user's team
  app.get("/api/users/:id/team", async (req, res) => {
    try {
      const team = await storage.getUserTeam(req.params.id);
      if (!team) {
        return res.json(null);
      }
      const members = await storage.getTeamMembers(team.id);
      res.json({
        ...team,
        members: members.map((m) => ({
          username: m.user.username,
          joinedAt: m.joinedAt,
        })),
      });
    } catch (error) {
      logger.error({ error }, "Failed to fetch user team");
      res.status(500).json({ error: "Failed to fetch user team" });
    }
  });

  // Get user's solves
  app.get("/api/users/:id/solves", async (req, res) => {
    try {
      const solves = await storage.getSolvesByUser(req.params.id);
      res.json(solves);
    } catch (error) {
      logger.error({ error }, "Failed to fetch user solves");
      res.status(500).json({ error: "Failed to fetch user solves" });
    }
  });

  // Update own profile
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.params.id !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Cannot update other users' profiles" });
      }

      // SECURITY: Only allow bio and avatarUrl to be updated by users
      // Explicitly whitelist allowed fields to prevent privilege escalation
      const { bio, avatarUrl } = req.body;

      // SECURITY: Check for XSS attempts
      if ((bio && containsXSS(bio)) || (avatarUrl && containsXSS(avatarUrl))) {
        logger.warn({
          userId: req.params.id,
          ip: req.ip,
        }, "XSS attempt in profile update");
        return res.status(400).json({ error: "Invalid characters detected" });
      }

      // Filter out any other fields that might have been sent and sanitize
      const allowedUpdates: { bio?: string; avatarUrl?: string } = {};
      if (bio !== undefined) allowedUpdates.bio = sanitizeText(bio).slice(0, 500); // Limit bio length
      if (avatarUrl !== undefined) {
        // Validate URL format and sanitize
        try {
          const url = new URL(avatarUrl);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return res.status(400).json({ error: "Avatar URL must use HTTP or HTTPS" });
          }
          allowedUpdates.avatarUrl = sanitizeText(avatarUrl).slice(0, 500);
        } catch {
          return res.status(400).json({ error: "Invalid avatar URL" });
        }
      }

      const user = await storage.updateUser(req.params.id, allowedUpdates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      logger.error({ error }, "Failed to update user");
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // ========== TEAM ROUTES ==========

  // Get all teams
  app.get("/api/teams", async (_req, res) => {
    try {
      const teams = await storage.getAllTeams();
      res.json(teams);
    } catch (error) {
      logger.error({ error }, "Failed to fetch teams");
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  });

  // Get single team
  app.get("/api/teams/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const team = await storage.getTeam(id);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      const members = await storage.getTeamMembers(id);

      // SECURITY: Check if user is a member of this team
      const isTeamMember = req.user && members.some(m => m.userId === req.user!.id);
      const isAdmin = req.user && (req.user.role === "admin" || req.user.role === "owner");

      // Build response based on authorization
      const teamData: any = {
        id: team.id,
        name: team.name,
        captainId: team.captainId,
        avatarUrl: team.avatarUrl,
        createdAt: team.createdAt,
        members: members.map((m) => ({
          username: m.user.username,
          joinedAt: m.joinedAt,
        })),
      };

      // SECURITY: Only expose inviteCode to team members and admins
      if (isTeamMember || isAdmin) {
        teamData.inviteCode = team.inviteCode;
      } else {
        logger.warn({
          teamId: id,
          requestingUserId: req.user?.id,
          ip: req.ip
        }, "Unauthorized attempt to view team invite code");
      }

      res.json(teamData);
    } catch (error) {
      logger.error({ error }, "Failed to fetch team");
      res.status(500).json({ error: "Failed to fetch team" });
    }
  });

  // Create team
  app.post("/api/teams", requireAuth, sanitizeRequestBody, sanitizeRequestBody, async (req, res) => {
    try {
      // Check if user is already in a team
      const existingTeam = await storage.getUserTeam(req.user!.id);
      if (existingTeam) {
        return res.status(400).json({ error: "You are already in a team" });
      }

      const { name } = req.body;
      if (!name || name.trim().length < 3) {
        return res.status(400).json({ error: "Team name must be at least 3 characters" });
      }

      const team = await storage.createTeam({
        name: name.trim(),
        captainId: req.user!.id,
      });
      res.status(201).json(team);
    } catch (error) {
      logger.error({ error }, "Failed to create team");
      res.status(500).json({ error: "Failed to create team" });
    }
  });

  // Join team by invite code
  app.post("/api/teams/join", requireAuth, async (req, res) => {
    try {
      const existingTeam = await storage.getUserTeam(req.user!.id);
      if (existingTeam) {
        return res.status(400).json({ error: "You are already in a team" });
      }

      const { inviteCode } = req.body;
      if (!inviteCode) {
        return res.status(400).json({ error: "Invite code required" });
      }

      const team = await storage.getTeamByInviteCode(inviteCode);
      if (!team) {
        return res.status(404).json({ error: "Invalid invite code" });
      }

      await storage.addTeamMember(req.user!.id, team.id);
      res.json(team);
    } catch (error) {
      logger.error({ error }, "Failed to join team");
      res.status(500).json({ error: "Failed to join team" });
    }
  });

  // Leave team
  app.post("/api/teams/leave", requireAuth, async (req, res) => {
    try {
      const team = await storage.getUserTeam(req.user!.id);
      if (!team) {
        return res.status(400).json({ error: "You are not in a team" });
      }

      if (team.captainId === req.user!.id) {
        return res.status(400).json({ error: "Captain cannot leave. Transfer ownership or delete the team." });
      }

      await storage.removeTeamMember(req.user!.id, team.id);
      res.sendStatus(200);
    } catch (error) {
      logger.error({ error }, "Failed to leave team");
      res.status(500).json({ error: "Failed to leave team" });
    }
  });

  // ========== SUBMISSION ROUTES ==========

  // Submit flag
  app.post("/api/submit", requireAuth, async (req, res) => {
    try {
      const { challengeId, flag } = req.body;
      if (!challengeId || !flag) {
        return res.status(400).json({ error: "Challenge ID and flag required" });
      }

      const userId = req.user?.id;
      const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

      // Check if user has access to this challenge
      const accessCheck = await checkChallengeAccess(challengeId, userId, isAdmin);
      if (!accessCheck.authorized) {
        logger.warn({ challengeId, userId, error: accessCheck.error }, "Flag submission denied");
        return res.status(accessCheck.statusCode || 403).json({ error: accessCheck.error });
      }

      const challenge = await storage.getChallenge(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const ctfEvent = await storage.getCtfEvent(challenge.ctfEventId);
      if (!ctfEvent) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      // Double-check CTF is active (checkChallengeAccess already verifies this for non-admins)
      const now = new Date();
      if (ctfEvent.startTime > now || ctfEvent.endTime < now) {
        return res.status(403).json({ error: "CTF is not currently active" });
      }

      // Check if already solved
      const existingSolve = await storage.getUserSolveForChallenge(req.user!.id, challengeId);
      if (existingSolve) {
        return res.status(400).json({ error: "You have already solved this challenge" });
      }

      // Get user's team if CTF is team-based
      let teamId: number | undefined;
      if (ctfEvent.isTeamBased) {
        const team = await storage.getUserTeam(req.user!.id);
        if (!team) {
          return res.status(400).json({ error: "You must be in a team to participate in this CTF" });
        }
        teamId = team.id;
      }

      // Compare flags (case-insensitive, trimmed)
      const isCorrect = flag.trim().toLowerCase() === challenge.flag.trim().toLowerCase();

      // Record submission
      await storage.createSubmission({
        challengeId,
        userId: req.user!.id,
        teamId: teamId ?? null,
        flag: flag.trim(),
        isCorrect,
      });

      if (!isCorrect) {
        return res.json({ correct: false, message: "Incorrect flag" });
      }

      // Check for first blood
      const existingSolves = await storage.getSolvesByChallenge(challengeId);
      const isFirstBlood = existingSolves.length === 0;

      // Calculate points (for dynamic scoring)
      let points = challenge.points;
      if (challenge.isDynamic && challenge.minPoints && challenge.decay) {
        const solveCount = challenge.solveCount;
        points = Math.max(
          challenge.minPoints,
          Math.floor(challenge.points * Math.pow(0.99, solveCount * challenge.decay / 10))
        );
      }

      // Record solve
      await storage.createSolve({
        challengeId,
        userId: req.user!.id,
        teamId: teamId ?? null,
        ctfEventId: ctfEvent.id,
        points,
        isFirstBlood,
      });

      // Increment solve count
      await storage.incrementSolveCount(challengeId);

      logger.info({
        userId: req.user!.id,
        challengeId,
        points,
        isFirstBlood,
      }, "Challenge solved");

      res.json({
        correct: true,
        points,
        isFirstBlood,
        message: isFirstBlood ? "First blood! Congratulations!" : "Correct flag!",
      });
    } catch (error) {
      logger.error({ error }, "Failed to submit flag");
      res.status(500).json({ error: "Failed to submit flag" });
    }
  });

  // ========== ADMIN ROUTES ==========

  // Get all CTF events (including unpublished)
  app.get("/api/admin/ctfs", requireAdmin, async (_req, res) => {
    try {
      const events = await storage.getAllCtfEvents();

      // Sort CTFs: Active first (by start date), then upcoming, then past
      const now = new Date();
      const sorted = events.sort((a, b) => {
        const aStart = new Date(a.startTime);
        const aEnd = new Date(a.endTime);
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);

        const aIsActive = aStart <= now && now <= aEnd;
        const bIsActive = bStart <= now && now <= bEnd;

        // Active CTFs first
        if (aIsActive && !bIsActive) return -1;
        if (!aIsActive && bIsActive) return 1;

        // Both active or both inactive: sort by start time (most recent first for active, soonest first for upcoming)
        if (aIsActive && bIsActive) {
          // Active: most recently started first
          return bStart.getTime() - aStart.getTime();
        } else {
          // Upcoming/past: soonest/most recent first
          return bStart.getTime() - aStart.getTime();
        }
      });

      res.json(sorted);
    } catch (error) {
      logger.error({ error }, "Failed to fetch CTF events");
      res.status(500).json({ error: "Failed to fetch CTF events" });
    }
  });

  // Create CTF event
  app.post("/api/admin/ctfs", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      // Convert date strings to Date objects
      const eventData = {
        ...req.body,
        startTime: new Date(req.body.startTime),
        endTime: new Date(req.body.endTime),
        registrationStart: req.body.registrationStart ? new Date(req.body.registrationStart) : undefined,
        registrationEnd: req.body.registrationEnd ? new Date(req.body.registrationEnd) : undefined,
        scoreboardFreezeTime: req.body.scoreboardFreezeTime ? new Date(req.body.scoreboardFreezeTime) : undefined,
      };
      const event = await storage.createCtfEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, "Failed to create CTF event");
      res.status(500).json({ error: `Failed to create CTF event: ${errorMessage}` });
    }
  });

  // Update CTF event
  app.patch("/api/admin/ctfs/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      // Convert date strings to Date objects if present
      const updateData = { ...req.body };
      if (updateData.startTime) updateData.startTime = new Date(updateData.startTime);
      if (updateData.endTime) updateData.endTime = new Date(updateData.endTime);
      if (updateData.registrationStart) updateData.registrationStart = new Date(updateData.registrationStart);
      if (updateData.registrationEnd) updateData.registrationEnd = new Date(updateData.registrationEnd);
      if (updateData.scoreboardFreezeTime) updateData.scoreboardFreezeTime = new Date(updateData.scoreboardFreezeTime);

      const event = await storage.updateCtfEvent(id, updateData);
      if (!event) {
        return res.status(404).json({ error: "CTF event not found" });
      }
      res.json(event);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage, stack: error instanceof Error ? error.stack : undefined }, "Failed to update CTF event");
      res.status(500).json({ error: `Failed to update CTF event: ${errorMessage}` });
    }
  });

  // Delete CTF event
  app.delete("/api/admin/ctfs/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCtfEvent(id);
      if (!success) {
        return res.status(404).json({ error: "CTF event not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      logger.error({ error }, "Failed to delete CTF event");
      res.status(500).json({ error: "Failed to delete CTF event" });
    }
  });

  // Get all challenges (admin)
  app.get("/api/admin/challenges", requireAdmin, async (_req, res) => {
    try {
      const events = await storage.getAllCtfEvents();
      const categories = await storage.getAllCategories();
      const allChallenges = [];
      for (const event of events) {
        const challenges = await storage.getChallengesByCtfEvent(event.id);
        allChallenges.push(...challenges.map((c) => {
          const category = categories.find((cat) => cat.id === c.categoryId);
          return {
            ...c,
            ctfEventName: event.name,
            categoryName: category?.name || null,
          };
        }));
      }
      res.json(allChallenges);
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenges");
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // Create challenge
  app.post("/api/admin/challenges", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      const challenge = await storage.createChallenge({
        ...req.body,
        authorId: req.user!.id,
      });
      res.status(201).json(challenge);
    } catch (error) {
      logger.error({ error }, "Failed to create challenge");
      res.status(500).json({ error: "Failed to create challenge" });
    }
  });

  // Update challenge
  app.patch("/api/admin/challenges/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const challenge = await storage.updateChallenge(id, req.body);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      res.json(challenge);
    } catch (error) {
      logger.error({ error }, "Failed to update challenge");
      res.status(500).json({ error: "Failed to update challenge" });
    }
  });

  // Delete challenge
  app.delete("/api/admin/challenges/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteChallenge(id);
      if (!success) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      logger.error({ error }, "Failed to delete challenge");
      res.status(500).json({ error: "Failed to delete challenge" });
    }
  });

  // Get all users (admin)
  app.get("/api/admin/users", requireAdmin, async (_req, res) => {
    try {
      const users = await storage.getAllUsers();
      const safeUsers = users.map((u) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        isBanned: u.isBanned,
        createdAt: u.createdAt,
      }));
      res.json(safeUsers);
    } catch (error) {
      logger.error({ error }, "Failed to fetch users");
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user (admin - ban/unban, change role)
  app.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { role, isBanned } = req.body;
      const targetUserId = req.params.id;

      // Get target user to check their current role
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Prevent modifying the owner account
      if (targetUser.role === "owner") {
        return res.status(403).json({ error: "Cannot modify the owner account" });
      }

      // Only owner can promote users to admin
      if (role === "admin" && req.user!.role !== "owner") {
        return res.status(403).json({ error: "Only the owner can promote users to admin" });
      }

      // Prevent demoting yourself
      if (targetUserId === req.user!.id && (role === "user" || role === "admin" && req.user!.role === "owner")) {
        return res.status(403).json({ error: "You cannot demote yourself" });
      }

      // SECURITY: Only allow role and isBanned fields
      const allowedUpdates: { role?: string; isBanned?: boolean } = {};
      if (role !== undefined) allowedUpdates.role = role;
      if (isBanned !== undefined) allowedUpdates.isBanned = isBanned;

      const user = await storage.updateUser(targetUserId, allowedUpdates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      logger.error({ error }, "Failed to update user");
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Create category
  app.post("/api/admin/categories", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      const category = await storage.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      logger.error({ error }, "Failed to create category");
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  // Update category
  app.patch("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const category = await storage.updateCategory(id, req.body);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      logger.error({ error }, "Failed to update category");
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  // Delete category
  app.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteCategory(id);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      logger.error({ error }, "Failed to delete category");
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ========== FILE ROUTES ==========

  // Get challenge files (authenticated users during active CTF)
  app.get("/api/challenges/:id/files", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user?.id;
      const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

      // Check if user has access to this challenge
      const accessCheck = await checkChallengeAccess(challengeId, userId, isAdmin);
      if (!accessCheck.authorized) {
        return res.status(accessCheck.statusCode || 403).json({ error: accessCheck.error });
      }

      const files = await storage.getChallengeFiles(challengeId);
      res.json(files.map((f) => ({
        id: f.id,
        filename: f.filename,
        originalName: f.originalName,
        size: f.size,
        mimeType: f.mimeType,
      })));
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenge files");
      res.status(500).json({ error: "Failed to fetch challenge files" });
    }
  });

  // Get challenge solves (authenticated users)
  app.get("/api/challenges/:id/solves", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user?.id;
      const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

      // Check if user has access to this challenge
      const accessCheck = await checkChallengeAccess(challengeId, userId, isAdmin);
      if (!accessCheck.authorized) {
        logger.warn({ challengeId, userId, error: accessCheck.error }, "Solves access denied");
        return res.status(accessCheck.statusCode || 403).json({ error: accessCheck.error });
      }

      const challenge = await storage.getChallenge(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      const ctfEvent = await storage.getCtfEvent(challenge.ctfEventId);
      if (!ctfEvent) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      const solves = await storage.getSolvesByChallenge(challengeId);

      // Return solves with user/team information
      const solvesWithInfo = await Promise.all(
        solves.map(async (solve) => {
          if (ctfEvent.isTeamBased && solve.teamId) {
            const team = await storage.getTeam(solve.teamId);
            return {
              id: solve.id,
              name: team?.name || "Unknown Team",
              solvedAt: solve.solvedAt,
              isFirstBlood: solve.isFirstBlood,
            };
          } else {
            const user = await storage.getUser(solve.userId);
            return {
              id: solve.id,
              name: user?.username || "Unknown User",
              solvedAt: solve.solvedAt,
              isFirstBlood: solve.isFirstBlood,
            };
          }
        })
      );

      // Sort by solve time
      solvesWithInfo.sort((a, b) =>
        new Date(a.solvedAt).getTime() - new Date(b.solvedAt).getTime()
      );

      res.json(solvesWithInfo);
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenge solves");
      res.status(500).json({ error: "Failed to fetch challenge solves" });
    }
  });

  // Download challenge file
  app.get("/api/challenges/:id/files/:fileId", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);
      const userId = req.user?.id;
      const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

      logger.info({ challengeId, fileId, userId }, "File download requested");

      // Check if user has access to this challenge
      const accessCheck = await checkChallengeAccess(challengeId, userId, isAdmin);
      if (!accessCheck.authorized) {
        logger.warn({
          challengeId,
          fileId,
          userId,
          error: accessCheck.error
        }, "Download blocked: Access denied");
        return res.status(accessCheck.statusCode || 403).json({ error: accessCheck.error });
      }

      const file = await storage.getChallengeFile(fileId);
      if (!file || file.challengeId !== challengeId) {
        logger.warn({ challengeId, fileId, found: !!file }, "Download failed: File not found");
        return res.status(404).json({ error: "File not found" });
      }

      const filePath = getFilePath(file.filename);
      logger.info({
        challengeId,
        fileId,
        userId,
        originalName: file.originalName,
        size: file.size,
        mimeType: file.mimeType
      }, "Sending file download");
      res.download(filePath, file.originalName);
    } catch (error) {
      logger.error({
        challengeId: req.params.id,
        fileId: req.params.fileId,
        userId: req.user?.id,
        error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }, "Error during file download");
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // Upload challenge files (admin)
  app.post(
    "/api/admin/challenges/:id/files",
    requireAdmin,
    (req, res, next) => {
      const challengeId = req.params.id;
      logger.info({
        challengeId,
        contentType: req.headers['content-type'],
        contentLength: req.headers['content-length'],
        userAgent: req.headers['user-agent'],
        hasBody: !!req.body,
        bodyType: typeof req.body,
        readable: req.readable,
        complete: req.complete
      }, "File upload request received - before multer");

      upload.array("files", 5)(req, res, (err) => {
        if (err) {
          logger.error({
            challengeId,
            error: err.message,
            code: (err as any).code,
            field: (err as any).field,
            stack: err.stack
          }, "Multer processing error");
          return res.status(400).json({ error: err.message || "File upload failed" });
        }

        const files = req.files as Express.Multer.File[];
        logger.info({
          challengeId,
          filesCount: files?.length || 0,
          fileDetails: files?.map(f => ({
            originalName: f.originalname,
            size: f.size,
            mimetype: f.mimetype,
            destination: f.destination,
            filename: f.filename
          }))
        }, "Multer processing complete");
        next();
      });
    },
    async (req, res) => {
      try {
        const challengeId = parseInt(req.params.id);
        const challenge = await storage.getChallenge(challengeId);
        if (!challenge) {
          logger.warn({ challengeId }, "File upload: Challenge not found");
          return res.status(404).json({ error: "Challenge not found" });
        }

        const files = req.files as Express.Multer.File[];

        if (!files || files.length === 0) {
          logger.warn({
            challengeId,
            filesReceived: !!files,
            filesType: typeof files,
            contentType: req.get('content-type'),
            contentLength: req.get('content-length')
          }, "File upload: No files in request");
          return res.status(400).json({ error: "No files uploaded" });
        }

        logger.info({
          challengeId,
          fileCount: files.length,
          totalSize: files.reduce((sum, f) => sum + f.size, 0),
          fileNames: files.map(f => f.originalname)
        }, "Processing uploaded files");

        const savedFiles = [];
        for (const file of files) {
          try {
            const savedFile = await storage.addChallengeFile({
              challengeId,
              filename: file.filename,
              originalName: file.originalname,
              path: file.path,
              size: file.size,
              mimeType: file.mimetype,
            });
            savedFiles.push(savedFile);
            logger.info({
              challengeId,
              fileId: savedFile.id,
              originalName: file.originalname,
              size: file.size
            }, "File saved to database");
          } catch (fileError) {
            logger.error({
              challengeId,
              originalName: file.originalname,
              error: fileError
            }, "Failed to save file to database");
            throw fileError;
          }
        }

        logger.info({
          challengeId,
          fileCount: savedFiles.length,
          fileIds: savedFiles.map(f => f.id)
        }, "File upload complete");
        res.status(201).json(savedFiles);
      } catch (error) {
        logger.error({
          challengeId: req.params.id,
          error,
          errorMessage: error instanceof Error ? error.message : String(error)
        }, "File upload handler error");
        res.status(500).json({ error: "Failed to upload files" });
      }
    }
  );

  // Delete challenge file (admin)
  app.delete("/api/admin/challenges/:id/files/:fileId", requireAdmin, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const fileId = parseInt(req.params.fileId);

      logger.info({ challengeId, fileId }, "File deletion requested");

      const file = await storage.getChallengeFile(fileId);
      if (!file || file.challengeId !== challengeId) {
        logger.warn({ challengeId, fileId, found: !!file }, "File not found for deletion");
        return res.status(404).json({ error: "File not found" });
      }

      logger.info({
        challengeId,
        fileId,
        filename: file.filename,
        originalName: file.originalName,
        size: file.size
      }, "Deleting file from disk and database");

      // Delete file from disk
      const diskDeleted = await deleteFile(file.filename);
      if (!diskDeleted) {
        logger.warn({
          challengeId,
          fileId,
          filename: file.filename
        }, "File not found on disk (already deleted or missing)");
      }

      // Delete from database
      const success = await storage.deleteChallengeFile(fileId);
      if (!success) {
        logger.error({ challengeId, fileId }, "Failed to delete file from database");
        return res.status(404).json({ error: "File not found" });
      }

      logger.info({
        challengeId,
        fileId,
        originalName: file.originalName,
        diskDeleted
      }, "File deleted successfully");
      res.sendStatus(204);
    } catch (error) {
      logger.error({
        challengeId: req.params.id,
        fileId: req.params.fileId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error)
      }, "Error during file deletion");
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ========== TEAM INVITE CODE ROUTES ==========

  // Regenerate team invite code (captain only)
  app.post("/api/teams/:id/regenerate-invite", requireAuth, async (req, res) => {
    try {
      const teamId = parseInt(req.params.id);
      const team = await storage.getTeam(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }

      if (team.captainId !== req.user!.id) {
        return res.status(403).json({ error: "Only the captain can regenerate the invite code" });
      }

      const updatedTeam = await storage.regenerateInviteCode(teamId);
      res.json(updatedTeam);
    } catch (error) {
      logger.error({ error }, "Failed to regenerate invite code");
      res.status(500).json({ error: "Failed to regenerate invite code" });
    }
  });

  // ========== PLATFORM SETTINGS ROUTES ==========

  // Get platform settings (public)
  app.get("/api/settings", async (_req, res) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error) {
      logger.error({ error }, "Failed to fetch platform settings");
      res.status(500).json({ error: "Failed to fetch platform settings" });
    }
  });

  // Update platform settings (admin only)
  app.patch("/api/admin/settings", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      const updates = req.body;

      // Validate primary_color format if provided
      if (updates.primary_color) {
        const hslRegex = /^\d+ \d+% \d+%$/;
        if (!hslRegex.test(updates.primary_color)) {
          return res.status(400).json({
            error: "Invalid color format. Expected HSL format: '345 80% 35%'"
          });
        }
      }

      await storage.updatePlatformSettings(updates);
      const updatedSettings = await storage.getPlatformSettings();

      logger.info({ updates }, "Platform settings updated");
      res.json(updatedSettings);
    } catch (error) {
      logger.error({ error }, "Failed to update platform settings");
      res.status(500).json({ error: "Failed to update platform settings" });
    }
  });

  // Upload logo (admin only)
  app.post("/api/admin/settings/logo", requireAdmin, upload.single("logo"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith("image/")) {
        // Clean up uploaded file
        await deleteFile(req.file.filename);
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Update logo_filename setting
      await storage.updatePlatformSettings({
        logo_filename: req.file.filename,
      });

      const settings = await storage.getPlatformSettings();
      logger.info({ filename: req.file.filename }, "Logo uploaded");
      res.json(settings);
    } catch (error) {
      logger.error({ error }, "Failed to upload logo");
      res.status(500).json({ error: "Failed to upload logo" });
    }
  });

  // Upload favicon (admin only)
  app.post("/api/admin/settings/favicon", requireAdmin, upload.single("favicon"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
      }

      // Validate file type
      if (!req.file.mimetype.startsWith("image/")) {
        // Clean up uploaded file
        await deleteFile(req.file.filename);
        return res.status(400).json({ error: "Only image files are allowed" });
      }

      // Update favicon_filename setting
      await storage.updatePlatformSettings({
        favicon_filename: req.file.filename,
      });

      const settings = await storage.getPlatformSettings();
      logger.info({ filename: req.file.filename }, "Favicon uploaded");
      res.json(settings);
    } catch (error) {
      logger.error({ error }, "Failed to upload favicon");
      res.status(500).json({ error: "Failed to upload favicon" });
    }
  });

  // Serve uploaded files (public)
  app.get("/api/uploads/:filename", async (req, res) => {
    try {
      const filename = req.params.filename;
      const filePath = getFilePath(filename);

      res.sendFile(filePath, (err) => {
        if (err) {
          logger.error({ filename, error: err }, "Failed to serve file");
          res.status(404).json({ error: "File not found" });
        }
      });
    } catch (error) {
      logger.error({ error }, "Failed to serve file");
      res.status(500).json({ error: "Failed to serve file" });
    }
  });

  // ========== CONTAINER MANAGEMENT ROUTES ==========

  // Get all containers (admin)
  app.get("/api/admin/containers", requireAdmin, async (_req, res) => {
    try {
      const containers = await storage.getAllContainers();
      res.json(containers);
    } catch (error) {
      logger.error({ error }, "Failed to fetch containers");
      res.status(500).json({ error: "Failed to fetch containers" });
    }
  });

  // Get single container (admin)
  app.get("/api/admin/containers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const container = await storage.getContainer(id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      logger.error({ error }, "Failed to fetch container");
      res.status(500).json({ error: "Failed to fetch container" });
    }
  });

  // Create container (registry-based)
  app.post("/api/admin/containers", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      // Sanitize string fields to remove leading/trailing whitespace
      const sanitizedBody = {
        ...req.body,
        name: req.body.name?.trim(),
        imageName: req.body.imageName?.trim(),
        imageTag: req.body.imageTag?.trim(),
        registryUrl: req.body.registryUrl?.trim(),
        registryUsername: req.body.registryUsername?.trim(),
        createdBy: req.user!.id,
      };

      const container = await storage.createContainer(sanitizedBody);
      res.status(201).json(container);
    } catch (error) {
      logger.error({ error }, "Failed to create container");
      res.status(500).json({ error: "Failed to create container" });
    }
  });

  // Update container
  app.patch("/api/admin/containers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Sanitize string fields to remove leading/trailing whitespace
      const sanitizedBody = {
        ...req.body,
        name: req.body.name?.trim(),
        imageName: req.body.imageName?.trim(),
        imageTag: req.body.imageTag?.trim(),
        registryUrl: req.body.registryUrl?.trim(),
        registryUsername: req.body.registryUsername?.trim(),
      };

      const container = await storage.updateContainer(id, sanitizedBody);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }
      res.json(container);
    } catch (error) {
      logger.error({ error }, "Failed to update container");
      res.status(500).json({ error: "Failed to update container" });
    }
  });

  // Delete container
  app.delete("/api/admin/containers/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);

      // Check if container exists
      const container = await storage.getContainer(id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }

      // Get all deployments for this container
      const deployments = await storage.getDeploymentsByContainer(id);

      // Stop and remove any running deployments
      for (const deployment of deployments) {
        if (deployment.platform === "docker" && deployment.platformId) {
          try {
            // Stop the container if running
            if (deployment.status === "running") {
              await containerOrchestrator.stopDeployment(deployment.id);
            }
            // Remove the container
            await containerLifecycle.removeContainer(deployment.platformId, true);
          } catch (error) {
            logger.warn({ deploymentId: deployment.id, error }, "Failed to cleanup deployment during container deletion");
            // Continue with deletion even if cleanup fails
          }
        }
      }

      // Delete the container (cascades to deployments, env vars, port mappings, challenge links)
      const success = await storage.deleteContainer(id);
      if (!success) {
        return res.status(404).json({ error: "Container not found" });
      }

      res.sendStatus(204);
    } catch (error) {
      logger.error({ error }, "Failed to delete container");
      res.status(500).json({ error: "Failed to delete container" });
    }
  });

  // Deploy container
  app.post("/api/admin/containers/:id/deploy", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const container = await storage.getContainer(id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }

      const { instanceName } = req.body;
      if (!instanceName) {
        return res.status(400).json({ error: "Instance name required" });
      }

      // Validate instanceName for subdomain usage
      const reservedNames = ['www', 'null', 'dev', 'ctf', 'containers', 'api', 'admin', 'localhost', 'mail', 'ftp', 'smtp'];
      const normalizedName = instanceName.toLowerCase().trim();

      if (reservedNames.includes(normalizedName)) {
        return res.status(400).json({ error: `Instance name '${instanceName}' is reserved and cannot be used` });
      }

      // Validate format: alphanumeric and hyphens only, must start/end with alphanumeric
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(instanceName)) {
        return res.status(400).json({ error: "Instance name must contain only letters, numbers, and hyphens, and must start and end with a letter or number" });
      }

      // Length validation (DNS subdomain limit is 63 characters)
      if (instanceName.length > 63) {
        return res.status(400).json({ error: "Instance name must be 63 characters or less" });
      }

      const result = await containerOrchestrator.deployContainer({
        container,
        instanceName,
        deployedBy: req.user!.id,
      });

      res.status(201).json(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to deploy container");
      res.status(500).json({ error: `Failed to deploy container: ${errorMessage}` });
    }
  });

  // Refresh Docker image (stop deployments, remove image, pull fresh)
  app.post("/api/admin/containers/:id/refresh-image", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const container = await storage.getContainer(id);
      if (!container) {
        return res.status(404).json({ error: "Container not found" });
      }

      // Get image name
      const imageName = container.imageName || `${container.name}:latest`;

      // Get all active deployments for this container
      const allDeployments = await storage.getDeploymentsByContainer(id);
      const activeDeployments = allDeployments.filter(d => d.status === "running");

      logger.info({ containerId: id, imageName, activeDeployments: activeDeployments.length }, "Refreshing Docker image");

      // Stop all active deployments
      for (const deployment of activeDeployments) {
        try {
          await containerOrchestrator.stopDeployment(deployment.id);
        } catch (error) {
          logger.error({ deploymentId: deployment.id, error }, "Failed to stop deployment during image refresh");
          // Continue even if stop fails
        }
      }

      // Import container lifecycle functions
      const containerLifecycle = await import("./services/container/container-lifecycle");

      // Remove Docker image
      try {
        await containerLifecycle.removeImage(imageName, false);
      } catch (error) {
        logger.warn({ imageName, error }, "Failed to remove image, continuing with pull");
        // Continue even if remove fails (image might not exist)
      }

      // Pull fresh image
      await containerLifecycle.pullImage(imageName);

      res.json({
        success: true,
        message: `Image ${imageName} refreshed successfully`,
        stoppedDeployments: activeDeployments.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to refresh Docker image");
      res.status(500).json({ error: `Failed to refresh image: ${errorMessage}` });
    }
  });

  // Get all deployments (admin)
  app.get("/api/admin/deployments", requireAdmin, async (_req, res) => {
    try {
      const deployments = await storage.getActiveDeployments();

      // Enhance deployments with linked challenge information
      const enhancedDeployments = await Promise.all(deployments.map(async (deployment) => {
        // Get container info to find linked challenges
        const container = await storage.getContainer(deployment.containerId);
        if (!container) {
          return { ...deployment, linkedChallenges: [] };
        }

        // Get all challenges linked to this container
        const challengeLinks = await storage.getChallengesByContainer(container.id);

        // Get port mappings for URL generation
        const portMappings = await storage.getPortMappings(deployment.id);
        const primarySubdomain = portMappings[0]?.subdomain;

        const linkedChallenges = challengeLinks.map(link => ({
          challengeId: link.challengeId,
          challengeName: link.challenge?.name || `Challenge ${link.challengeId}`,
          accessUrl: `https://${deployment.instanceName}.strayerraptors.com`
        }));

        // Override accessUrl to use instanceName-based URL
        const correctAccessUrl = `https://${deployment.instanceName}.strayerraptors.com`;

        return {
          ...deployment,
          accessUrl: correctAccessUrl,
          linkedChallenges,
          containerName: container.name
        };
      }));

      res.json(enhancedDeployments);
    } catch (error) {
      logger.error({ error }, "Failed to fetch deployments");
      res.status(500).json({ error: "Failed to fetch deployments" });
    }
  });

  // Get deployment status
  app.get("/api/admin/deployments/:id/status", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const status = await containerOrchestrator.getDeploymentStatus(id);
      res.json(status);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to get deployment status");
      res.status(500).json({ error: `Failed to get deployment status: ${errorMessage}` });
    }
  });

  // Get deployment logs
  app.get("/api/admin/deployments/:id/logs", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const tail = parseInt(req.query.tail as string) || 100;
      const logs = await containerOrchestrator.getDeploymentLogs(id, tail);
      res.json({ logs });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to get deployment logs");
      res.status(500).json({ error: `Failed to get deployment logs: ${errorMessage}` });
    }
  });

  // Stop deployment
  app.post("/api/admin/deployments/:id/stop", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await containerOrchestrator.stopDeployment(id);
      res.sendStatus(200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to stop deployment");
      res.status(500).json({ error: `Failed to stop deployment: ${errorMessage}` });
    }
  });

  // Restart deployment
  app.post("/api/admin/deployments/:id/restart", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await containerOrchestrator.restartDeployment(id);
      res.sendStatus(200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to restart deployment");
      res.status(500).json({ error: `Failed to restart deployment: ${errorMessage}` });
    }
  });

  // Remove deployment
  app.delete("/api/admin/deployments/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await containerOrchestrator.removeDeployment(id);
      res.sendStatus(204);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ error: errorMessage }, "Failed to remove deployment");
      res.status(500).json({ error: `Failed to remove deployment: ${errorMessage}` });
    }
  });

  // Get all Docker containers with orphan status
  app.get("/api/admin/docker/containers", requireAdmin, async (_req, res) => {
    try {
      const dockerContainers = await containerOrchestrator.listAllDockerContainers();
      const deployments = await storage.getAllDeployments();

      // Create a map of Docker container IDs that are tracked in the database
      // Docker returns full 64-char IDs, match them with platform_id (which stores full ID)
      const trackedContainerIds = new Set(
        deployments.map(d => d.platformId).filter(Boolean)
      );

      // Mark containers as orphaned if they're not in the database
      const containersWithStatus = dockerContainers.map(container => ({
        ...container,
        isOrphan: !trackedContainerIds.has(container.id),
      }));

      res.json(containersWithStatus);
    } catch (error) {
      logger.error({ error }, "Failed to list Docker containers");
      res.status(500).json({ error: "Failed to list Docker containers" });
    }
  });

  // Remove orphaned Docker containers
  app.post("/api/admin/docker/cleanup-orphans", requireAdmin, async (_req, res) => {
    try {
      const dockerContainers = await containerOrchestrator.listAllDockerContainers();
      const deployments = await storage.getAllDeployments();

      const trackedContainerIds = new Set(
        deployments.map(d => d.dockerContainerId).filter(Boolean)
      );

      const orphanedContainers = dockerContainers.filter(
        container => !trackedContainerIds.has(container.id)
      );

      const removed = [];
      for (const container of orphanedContainers) {
        try {
          await containerOrchestrator.removeDockerContainer(container.id);
          removed.push(container.name || container.id);
        } catch (error) {
          logger.error({ error, containerId: container.id }, "Failed to remove orphaned container");
        }
      }

      res.json({
        message: `Removed ${removed.length} orphaned container(s)`,
        removed
      });
    } catch (error) {
      logger.error({ error }, "Failed to cleanup orphaned containers");
      res.status(500).json({ error: "Failed to cleanup orphaned containers" });
    }
  });

  // Remove specific Docker container by ID
  app.delete("/api/admin/docker/containers/:id", requireAdmin, async (req, res) => {
    try {
      const containerId = req.params.id;
      await containerOrchestrator.removeDockerContainer(containerId);
      res.json({ message: "Container removed successfully" });
    } catch (error) {
      logger.error({ error, containerId: req.params.id }, "Failed to remove Docker container");
      res.status(500).json({ error: "Failed to remove Docker container" });
    }
  });

  // Get linked containers for a challenge (admin endpoint)
  app.get("/api/admin/challenges/:challengeId/containers", requireAdmin, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.challengeId);
      const linkedContainers = await storage.getContainersByChallenge(challengeId);

      // Return just the basic info
      const result = linkedContainers.map(link => ({
        containerId: link.containerId,
        isPrimary: link.isPrimary,
        container: link.container,
      }));

      res.json(result);
    } catch (error) {
      logger.error({ error }, "Failed to get containers for challenge");
      res.status(500).json({ error: "Failed to get containers for challenge" });
    }
  });

  // Link container to challenge
  app.post("/api/admin/challenges/:challengeId/containers/:containerId", requireAdmin, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.challengeId);
      const containerId = parseInt(req.params.containerId);
      const { isPrimary } = req.body;

      const link = await storage.linkChallengeContainer(challengeId, containerId, isPrimary);
      res.status(201).json(link);
    } catch (error) {
      logger.error({ error }, "Failed to link container to challenge");
      res.status(500).json({ error: "Failed to link container to challenge" });
    }
  });

  // Unlink container from challenge
  app.delete("/api/admin/challenges/:challengeId/containers/:containerId", requireAdmin, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.challengeId);
      const containerId = parseInt(req.params.containerId);

      const success = await storage.unlinkChallengeContainer(challengeId, containerId);
      if (!success) {
        return res.status(404).json({ error: "Container link not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      logger.error({ error }, "Failed to unlink container from challenge");
      res.status(500).json({ error: "Failed to unlink container from challenge" });
    }
  });

  // Get containers for a challenge
  app.get("/api/challenges/:id/containers", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const challenge = await storage.getChallenge(challengeId);
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // Check if user can access this challenge (during active CTF)
      const ctfEvent = await storage.getCtfEvent(challenge.ctfEventId);
      if (!ctfEvent) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      const now = new Date();
      const isActive = ctfEvent.startTime <= now && ctfEvent.endTime >= now;
      const isAdmin = req.user?.role === "admin";

      if (!isActive && !isAdmin) {
        return res.status(403).json({ error: "CTF is not currently active" });
      }

      const containerLinks = await storage.getContainersByChallenge(challengeId);

      // Get deployments for each container
      const containersWithDeployments = await Promise.all(
        containerLinks.map(async (link) => {
          const deployments = await storage.getDeploymentsByContainer(link.container.id);
          const activeDeployments = deployments.filter((d) => d.status === "running");
          return {
            ...link.container,
            activeDeployments,
          };
        })
      );

      res.json(containersWithDeployments);
    } catch (error) {
      logger.error({ error }, "Failed to fetch challenge containers");
      res.status(500).json({ error: "Failed to fetch challenge containers" });
    }
  });

  // Add environment variable to container
  app.post("/api/admin/containers/:id/env", requireAdmin, sanitizeEnvVars, async (req, res) => {
    try {
      const containerId = parseInt(req.params.id);
      const { key, value, isSecret } = req.body;

      if (!key || value === undefined) {
        return res.status(400).json({ error: "Key and value required" });
      }

      const envVar = await storage.addEnvVar({
        containerId,
        key,
        value,
        isSecret: isSecret || false,
      });

      res.status(201).json(envVar);
    } catch (error) {
      logger.error({ error }, "Failed to add environment variable");
      res.status(500).json({ error: "Failed to add environment variable" });
    }
  });

  // Get environment variables for container
  app.get("/api/admin/containers/:id/env", requireAdmin, async (req, res) => {
    try {
      const containerId = parseInt(req.params.id);
      const envVars = await storage.getEnvVars(containerId);
      res.json(envVars);
    } catch (error) {
      logger.error({ error }, "Failed to fetch environment variables");
      res.status(500).json({ error: "Failed to fetch environment variables" });
    }
  });

  // Delete environment variable
  app.delete("/api/admin/containers/env/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteEnvVar(id);
      if (!success) {
        return res.status(404).json({ error: "Environment variable not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      logger.error({ error }, "Failed to delete environment variable");
      res.status(500).json({ error: "Failed to delete environment variable" });
    }
  });

  // Check Docker health
  app.get("/api/admin/docker/health", requireAdmin, async (_req, res) => {
    try {
      const isHealthy = await checkDockerHealth();
      res.json({ healthy: isHealthy });
    } catch (error) {
      logger.error({ error }, "Failed to check Docker health");
      res.status(500).json({ error: "Failed to check Docker health" });
    }
  });

  // ========== PUBLIC CONTAINER ACCESS ==========

  // Get container access info for a challenge (public endpoint, requires authentication)
  app.get("/api/challenges/:id/container", requireAuth, async (req, res) => {
    try {
      const challengeId = parseInt(req.params.id);
      const userId = req.user?.id;
      const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

      // Check if user has access to this challenge
      const accessCheck = await checkChallengeAccess(challengeId, userId, isAdmin);
      if (!accessCheck.authorized) {
        logger.warn({ challengeId, userId, error: accessCheck.error }, "Container access denied");
        return res.status(accessCheck.statusCode || 403).json({ error: accessCheck.error });
      }

      // Get linked containers for this challenge
      const linkedContainers = await storage.getContainersByChallenge(challengeId);

      if (linkedContainers.length === 0) {
        return res.json({ hasContainer: false });
      }

      // Get the primary container (or first if none marked primary)
      const primaryLink = linkedContainers.find(link => link.isPrimary) || linkedContainers[0];
      const container = primaryLink.container;

      // Get active deployment for this container
      const deployments = await storage.getDeploymentsByContainer(container.id);
      const activeDeployment = deployments.find(d => d.status === "running");

      if (!activeDeployment) {
        return res.json({
          hasContainer: true,
          containerName: container.name,
          description: container.description,
          status: "stopped",
          message: "Container is not currently running. Please contact an administrator."
        });
      }

      // Get port mappings for the deployment
      const portMappings = await storage.getPortMappings(activeDeployment.id);

      // Get base URL from environment
      const baseUrl = process.env.BASE_URL || "http://localhost";

      // Build access URLs for each exposed port
      const accessUrls = portMappings.map(mapping => ({
        port: mapping.containerPort,
        protocol: mapping.protocol,
        subdomain: mapping.subdomain || `Port ${mapping.containerPort}`,
        // Use wildcard subdomain with subdomain from port mapping
        url: `https://${mapping.subdomain}.strayerraptors.com`,
        // Keep legacy direct port URL for admin panel
        directUrl: `${baseUrl}:${mapping.hostPort}`
      }));

      res.json({
        hasContainer: true,
        containerName: container.name,
        description: container.description,
        status: "running",
        deploymentId: activeDeployment.id,
        instanceName: activeDeployment.instanceName,
        accessUrls,
        // Primary access URL (first port)
        primaryUrl: accessUrls.length > 0 ? accessUrls[0].url : null,
        primaryProxyUrl: accessUrls.length > 0 ? accessUrls[0].proxyUrl : null,
      });
    } catch (error) {
      logger.error({ error, challengeId: req.params.id }, "Failed to get container access info");
      res.status(500).json({ error: "Failed to get container access information" });
    }
  });

  // ========== INTERNAL NGINX ENDPOINTS ==========

  // Internal endpoint for container port lookup (no auth required)
  // Returns the host port for a given subdomain
  // Used by nginx to proxy container requests
  app.get("/api/internal/container-port-lookup", async (req, res) => {
    try {
      const subdomain = req.headers['x-subdomain'] as string;

      if (!subdomain) {
        return res.status(400).json({ error: "Missing subdomain" });
      }

      // Get port mapping by subdomain
      const portMapping = await storage.getPortMappingBySubdomain(subdomain);
      if (!portMapping) {
        return res.status(404).json({ error: "Container not found" });
      }

      // Check if deployment is running
      const deployment = await storage.getDeployment(portMapping.deploymentId);
      if (!deployment || deployment.status !== "running") {
        return res.status(404).json({ error: "Container not running" });
      }

      // Return success with port in header
      res.set("X-Backend-Port", portMapping.hostPort.toString());
      res.status(200).json({
        success: true,
        subdomain,
        deploymentId: deployment.id,
        port: portMapping.hostPort
      });
    } catch (error) {
      logger.error({ error }, "Failed to lookup container port");
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // ========== SERIAL CHALLENGE ROUTES ==========

  // Get serial challenges for a CTF event with user progress
  app.get("/api/ctfs/:id/serial-challenges", requireAuth, async (req, res) => {
    try {
      const ctfId = parseInt(req.params.id);
      const userId = req.user!.id;

      const serialChallenges = await storage.getSerialChallengesByCtfEvent(ctfId);

      // Get user's progress for each serial challenge
      const challengesWithProgress = await Promise.all(
        serialChallenges.map(async (challenge) => {
          const progress = await storage.getSerialProgress(userId, challenge.id);

          // Calculate stages completed by counting actual solves
          let stagesCompleted = 0;
          if (progress) {
            const stages = await storage.getStagesBySerialChallenge(challenge.id);
            const solves = await Promise.all(
              stages.map(stage => storage.getUserStageSolve(userId, stage.id))
            );
            stagesCompleted = solves.filter(solve => solve !== undefined).length;
          }

          return {
            ...challenge,
            currentStage: progress?.currentStage || 1,
            stagesCompleted,
            totalPointsEarned: progress?.totalPointsEarned || 0,
            isComplete: progress?.isComplete || false,
            isUnlocked: progress ? true : false,
          };
        })
      );

      res.json(challengesWithProgress);
    } catch (error) {
      logger.error({ error }, "Failed to get serial challenges");
      res.status(500).json({ error: "Failed to get serial challenges" });
    }
  });

  // Get stages for a serial challenge
  app.get("/api/serial-challenges/:id/stages", requireAuth, async (req, res) => {
    try {
      const serialChallengeId = parseInt(req.params.id);
      const userId = req.user!.id;

      const serialChallenge = await storage.getSerialChallenge(serialChallengeId);
      if (!serialChallenge) {
        return res.status(404).json({ error: "Serial challenge not found" });
      }

      const stages = await storage.getStagesBySerialChallenge(serialChallengeId);
      const progress = await storage.getSerialProgress(userId, serialChallengeId);

      // Determine which stage the user is on (1 if not started, to unlock first stage)
      const currentStage = progress?.currentStage || 1;

      // Map stages with locked/unlocked status
      const stagesWithAccess = await Promise.all(
        stages.map(async (stage) => {
          const isUnlocked = stage.stageOrder <= currentStage;
          const isSolved = await storage.getUserStageSolve(userId, stage.id);

          if (!isUnlocked) {
            // Return minimal info for locked stages
            return {
              id: stage.id,
              stageOrder: stage.stageOrder,
              name: stage.name,
              points: stage.points,
              isLocked: true,
              isSolved: false,
            };
          }

          // Return full details for unlocked stages
          const files = await storage.getSerialStageFiles(stage.id);
          return {
            ...stage,
            isLocked: false,
            isSolved: !!isSolved,
            files,
          };
        })
      );

      res.json(stagesWithAccess);
    } catch (error) {
      logger.error({ error }, "Failed to get serial stages");
      res.status(500).json({ error: "Failed to get serial stages" });
    }
  });

  // Get files for a specific stage
  app.get("/api/serial-stages/:stageId/files", requireAuth, async (req, res) => {
    try {
      const stageId = parseInt(req.params.stageId);
      const userId = req.user!.id;

      const stage = await storage.getSerialStage(stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }

      // Check if user has unlocked this stage
      const serialChallenge = await storage.getSerialChallenge(stage.serialChallengeId);
      if (!serialChallenge) {
        return res.status(404).json({ error: "Serial challenge not found" });
      }

      const progress = await storage.getSerialProgress(userId, stage.serialChallengeId);
      const currentStage = progress?.currentStage || 0;

      if (stage.stageOrder > currentStage) {
        return res.status(403).json({ error: "Stage is locked" });
      }

      const files = await storage.getSerialStageFiles(stageId);
      res.json(files);
    } catch (error) {
      logger.error({ error }, "Failed to get stage files");
      res.status(500).json({ error: "Failed to get stage files" });
    }
  });

  // Submit flag for a serial stage
  app.post("/api/submit-serial-stage", requireAuth, async (req, res) => {
    try {
      const { stageId, flag } = req.body;
      if (!stageId || !flag) {
        return res.status(400).json({ error: "Stage ID and flag required" });
      }

      const userId = req.user!.id;

      const stage = await storage.getSerialStage(stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }

      const serialChallenge = await storage.getSerialChallenge(stage.serialChallengeId);
      if (!serialChallenge) {
        return res.status(404).json({ error: "Serial challenge not found" });
      }

      const ctfEvent = await storage.getCtfEvent(serialChallenge.ctfEventId);
      if (!ctfEvent) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      // Verify CTF is active
      const now = new Date();
      if (ctfEvent.startTime > now || ctfEvent.endTime < now) {
        return res.status(403).json({ error: "CTF is not currently active" });
      }

      // Verify user is registered
      const registration = await storage.getCtfRegistration(userId, ctfEvent.id);
      if (!registration) {
        return res.status(403).json({ error: "You must be registered for this CTF" });
      }

      // Get user's team if CTF is team-based
      let teamId: number | undefined;
      if (ctfEvent.isTeamBased) {
        const team = await storage.getUserTeam(userId);
        if (!team) {
          return res.status(400).json({ error: "You must be in a team to participate in this CTF" });
        }
        teamId = team.id;
      }

      // Get or create progress
      let progress = await storage.getSerialProgress(userId, serialChallenge.id);
      if (!progress) {
        progress = await storage.createSerialProgress({
          serialChallengeId: serialChallenge.id,
          userId,
          teamId: teamId ?? null,
          ctfEventId: ctfEvent.id,
          currentStage: 1,
          totalPointsEarned: 0,
          isComplete: false,
        });
      }

      // Verify stage is unlocked
      if (stage.stageOrder > progress.currentStage) {
        return res.status(403).json({ error: "This stage is locked" });
      }

      // Check if already solved
      const existingSolve = await storage.getUserStageSolve(userId, stageId);
      if (existingSolve) {
        return res.status(400).json({ error: "You have already solved this stage" });
      }

      // Compare flags (case-insensitive, trimmed)
      const isCorrect = flag.trim().toLowerCase() === stage.flag.trim().toLowerCase();

      if (!isCorrect) {
        return res.json({ correct: false, message: "Incorrect flag" });
      }

      // Check for first blood (per stage)
      const existingSolves = await storage.getSerialStageSolves(stageId);
      const isFirstBlood = existingSolves.length === 0;

      // Record solve
      await storage.createSerialStageSolve({
        stageId,
        serialChallengeId: serialChallenge.id,
        userId,
        teamId: teamId ?? null,
        ctfEventId: ctfEvent.id,
        points: stage.points,
        isFirstBlood,
      });

      // Update progress
      const allStages = await storage.getStagesBySerialChallenge(serialChallenge.id);
      const isLastStage = stage.stageOrder === allStages.length;
      const newTotalPoints = progress.totalPointsEarned + stage.points;

      await storage.updateSerialProgress(progress.id, {
        currentStage: isLastStage ? progress.currentStage : progress.currentStage + 1,
        totalPointsEarned: newTotalPoints,
        isComplete: isLastStage,
        completedAt: isLastStage ? new Date() : undefined,
      });

      logger.info({
        userId,
        stageId,
        serialChallengeId: serialChallenge.id,
        points: stage.points,
        isFirstBlood,
        isLastStage,
      }, "Serial stage solved");

      res.json({
        correct: true,
        points: stage.points,
        isFirstBlood,
        isComplete: isLastStage,
        nextStage: isLastStage ? null : stage.stageOrder + 1,
        message: isFirstBlood
          ? "First blood! Congratulations!"
          : isLastStage
            ? "Challenge complete! Congratulations!"
            : "Correct flag! Next stage unlocked!",
      });
    } catch (error) {
      logger.error({ error }, "Failed to submit serial stage flag");
      res.status(500).json({ error: "Failed to submit flag" });
    }
  });

  // Download serial stage file
  app.get("/api/serial-stages/:stageId/files/:fileId", requireAuth, async (req, res) => {
    try {
      const stageId = parseInt(req.params.stageId);
      const fileId = parseInt(req.params.fileId);
      const userId = req.user!.id;
      const isAdmin = req.user?.role === "admin" || req.user?.role === "owner";

      // Get the stage
      const stage = await storage.getSerialStage(stageId);
      if (!stage) {
        return res.status(404).json({ error: "Stage not found" });
      }

      // Get the serial challenge
      const serialChallenge = await storage.getSerialChallenge(stage.serialChallengeId);
      if (!serialChallenge) {
        return res.status(404).json({ error: "Serial challenge not found" });
      }

      // Get the CTF event
      const ctfEvent = await storage.getCtfEvent(serialChallenge.ctfEventId);
      if (!ctfEvent) {
        return res.status(404).json({ error: "CTF event not found" });
      }

      // Check if user has access (must be registered for CTF and stage must be unlocked)
      if (!isAdmin) {
        const registration = await storage.getCtfRegistration(userId, ctfEvent.id);
        if (!registration) {
          return res.status(403).json({ error: "You must be registered for this CTF" });
        }

        // Check if stage is unlocked
        const progress = await storage.getSerialProgress(userId, serialChallenge.id);
        const currentStage = progress?.currentStage || 1;
        if (stage.stageOrder > currentStage) {
          return res.status(403).json({ error: "This stage is locked" });
        }
      }

      // Get the file
      const file = await storage.getSerialStageFile(fileId);
      if (!file || file.stageId !== stageId) {
        return res.status(404).json({ error: "File not found" });
      }

      const filePath = getFilePath(file.filename);
      res.download(filePath, file.originalName);
    } catch (error) {
      logger.error({ error }, "Failed to download serial stage file");
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  // ========== ADMIN SERIAL CHALLENGE ROUTES ==========

  // Get all serial challenges
  app.get("/api/admin/serial-challenges", requireAdmin, async (_req, res) => {
    try {
      const allChallenges = await storage.getAllCtfEvents();
      const serialChallenges = [];

      for (const ctf of allChallenges) {
        const challenges = await storage.getSerialChallengesByCtfEvent(ctf.id);
        serialChallenges.push(...challenges.map(c => ({ ...c, ctfEvent: ctf })));
      }

      res.json(serialChallenges);
    } catch (error) {
      logger.error({ error }, "Failed to get serial challenges");
      res.status(500).json({ error: "Failed to get serial challenges" });
    }
  });

  // Create serial challenge
  app.post("/api/admin/serial-challenges", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      const challenge = await storage.createSerialChallenge(req.body);
      res.json(challenge);
    } catch (error) {
      logger.error({ error }, "Failed to create serial challenge");
      res.status(500).json({ error: "Failed to create serial challenge" });
    }
  });

  // Update serial challenge
  app.patch("/api/admin/serial-challenges/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateSerialChallenge(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Serial challenge not found" });
      }

      res.json(updated);
    } catch (error) {
      logger.error({ error }, "Failed to update serial challenge");
      res.status(500).json({ error: "Failed to update serial challenge" });
    }
  });

  // Delete serial challenge
  app.delete("/api/admin/serial-challenges/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSerialChallenge(id);

      if (!success) {
        return res.status(404).json({ error: "Serial challenge not found" });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, "Failed to delete serial challenge");
      res.status(500).json({ error: "Failed to delete serial challenge" });
    }
  });

  // Get stages for a serial challenge (admin - includes all details and files)
  app.get("/api/admin/serial-challenges/:id/stages", requireAdmin, async (req, res) => {
    try {
      const serialChallengeId = parseInt(req.params.id);
      const stages = await storage.getStagesBySerialChallenge(serialChallengeId);

      // Fetch files for each stage
      const stagesWithFiles = await Promise.all(
        stages.map(async (stage) => {
          const files = await storage.getSerialStageFiles(stage.id);
          return {
            ...stage,
            files,
          };
        })
      );

      res.json(stagesWithFiles);
    } catch (error) {
      logger.error({ error }, "Failed to get stages for admin");
      res.status(500).json({ error: "Failed to get stages" });
    }
  });

  // Add stage to serial challenge
  app.post("/api/admin/serial-challenges/:id/stages", requireAdmin, sanitizeRequestBody, async (req, res) => {
    try {
      const serialChallengeId = parseInt(req.params.id);
      const stage = await storage.createSerialStage({
        ...req.body,
        serialChallengeId,
      });
      res.json(stage);
    } catch (error) {
      logger.error({ error }, "Failed to create serial stage");
      res.status(500).json({ error: "Failed to create serial stage" });
    }
  });

  // Update serial stage
  app.patch("/api/admin/serial-stages/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateSerialStage(id, req.body);

      if (!updated) {
        return res.status(404).json({ error: "Serial stage not found" });
      }

      res.json(updated);
    } catch (error) {
      logger.error({ error }, "Failed to update serial stage");
      res.status(500).json({ error: "Failed to update serial stage" });
    }
  });

  // Delete serial stage
  app.delete("/api/admin/serial-stages/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteSerialStage(id);

      if (!success) {
        return res.status(404).json({ error: "Serial stage not found" });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, "Failed to delete serial stage");
      res.status(500).json({ error: "Failed to delete serial stage" });
    }
  });

  // Upload stage files
  app.post("/api/admin/serial-stages/:id/files", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const stageId = parseInt(req.params.id);

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = await storage.addSerialStageFile({
        stageId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: req.file.path,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });

      res.json(file);
    } catch (error) {
      logger.error({ error }, "Failed to upload stage file");
      res.status(500).json({ error: "Failed to upload stage file" });
    }
  });

  // Delete stage file
  app.delete("/api/admin/serial-stages/:stageId/files/:fileId", requireAdmin, async (req, res) => {
    try {
      const fileId = parseInt(req.params.fileId);

      const file = await storage.getSerialStageFile(fileId);
      if (!file) {
        return res.status(404).json({ error: "File not found" });
      }

      // Delete file from filesystem
      await deleteFile(file.filename);

      const success = await storage.deleteSerialStageFile(fileId);
      if (!success) {
        return res.status(404).json({ error: "File not found" });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error({ error }, "Failed to delete stage file");
      res.status(500).json({ error: "Failed to delete stage file" });
    }
  });

}
