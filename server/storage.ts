import pkg from "pg";
const { Pool } = pkg;
import {
  type User,
  type InsertUser,
  type Team,
  type InsertTeam,
  type TeamMember,
  type CtfEvent,
  type InsertCtfEvent,
  type Category,
  type InsertCategory,
  type Challenge,
  type InsertChallenge,
  type ChallengeFile,
  type Submission,
  type Solve,
  type CtfRegistration,
  type PlatformSettingsData,
  type Container,
  type InsertContainer,
  type ContainerDeployment,
  type InsertContainerDeployment,
  type ChallengeContainer,
  type ContainerPortMapping,
  type InsertContainerPortMapping,
  type ContainerEnvVar,
  type InsertContainerEnvVar,
  type EmailVerificationToken,
  type InsertEmailVerificationToken,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  users,
  teams,
  teamMembers,
  ctfEvents,
  categories,
  challenges,
  challengeFiles,
  submissions,
  solves,
  ctfRegistrations,
  containers,
  containerDeployments,
  challengeContainers,
  containerPortMappings,
  containerEnvVars,
  emailVerificationTokens,
  passwordResetTokens,
} from "@shared/schema";
import { platformSettingsService } from "./services/platform-settings";
import { db } from "./db";
import { eq, desc, and, sql, gte, lte, or } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { randomBytes } from "crypto";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const PostgresSessionStore = connectPg(session);

function generateInviteCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;

  // Teams
  getTeam(id: number): Promise<Team | undefined>;
  getTeamByInviteCode(code: string): Promise<Team | undefined>;
  getAllTeams(): Promise<Team[]>;
  createTeam(team: InsertTeam): Promise<Team>;
  updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined>;
  deleteTeam(id: number): Promise<boolean>;
  regenerateInviteCode(id: number): Promise<Team | undefined>;
  getTeamMembers(teamId: number): Promise<(TeamMember & { user: User })[]>;
  addTeamMember(userId: string, teamId: number): Promise<TeamMember>;
  removeTeamMember(userId: string, teamId: number): Promise<boolean>;
  getUserTeam(userId: string): Promise<Team | undefined>;

  // CTF Events
  getCtfEvent(id: number): Promise<CtfEvent | undefined>;
  getAllCtfEvents(): Promise<CtfEvent[]>;
  getActiveCtfEvents(): Promise<CtfEvent[]>;
  getUpcomingCtfEvents(): Promise<CtfEvent[]>;
  getPastCtfEvents(): Promise<CtfEvent[]>;
  createCtfEvent(event: InsertCtfEvent): Promise<CtfEvent>;
  updateCtfEvent(id: number, updates: Partial<InsertCtfEvent>): Promise<CtfEvent | undefined>;
  deleteCtfEvent(id: number): Promise<boolean>;

  // Categories
  getCategory(id: number): Promise<Category | undefined>;
  getAllCategories(): Promise<Category[]>;
  getDefaultCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: number): Promise<boolean>;

  // Challenges
  getChallenge(id: number): Promise<Challenge | undefined>;
  getChallengesByCtfEvent(ctfEventId: number): Promise<Challenge[]>;
  createChallenge(challenge: InsertChallenge): Promise<Challenge>;
  updateChallenge(id: number, updates: Partial<InsertChallenge>): Promise<Challenge | undefined>;
  deleteChallenge(id: number): Promise<boolean>;
  incrementSolveCount(id: number): Promise<void>;

  // Challenge Files
  getChallengeFiles(challengeId: number): Promise<ChallengeFile[]>;
  getChallengeFile(id: number): Promise<ChallengeFile | undefined>;
  addChallengeFile(file: Omit<ChallengeFile, "id" | "createdAt">): Promise<ChallengeFile>;
  deleteChallengeFile(id: number): Promise<boolean>;

  // Submissions
  createSubmission(submission: Omit<Submission, "id" | "submittedAt">): Promise<Submission>;
  getSubmissionsByChallenge(challengeId: number): Promise<Submission[]>;
  getSubmissionsByUser(userId: string): Promise<Submission[]>;

  // Solves
  createSolve(solve: Omit<Solve, "id" | "solvedAt">): Promise<Solve>;
  getSolvesByCtfEvent(ctfEventId: number): Promise<Solve[]>;
  getSolvesByUser(userId: string): Promise<Solve[]>;
  getSolvesByTeam(teamId: number): Promise<Solve[]>;
  getSolvesByChallenge(challengeId: number): Promise<Solve[]>;
  getUserSolveForChallenge(userId: string, challengeId: number): Promise<Solve | undefined>;
  getFirstBlood(challengeId: number): Promise<Solve | undefined>;

  // CTF Registrations
  registerForCtf(userId: string, ctfEventId: number, teamId?: number): Promise<CtfRegistration>;
  getCtfRegistration(userId: string, ctfEventId: number): Promise<CtfRegistration | undefined>;
  getCtfRegistrations(ctfEventId: number): Promise<CtfRegistration[]>;

  // Leaderboard
  getLeaderboard(ctfEventId: number, limit?: number): Promise<{
    rank: number;
    id: string | number;
    name: string;
    score: number;
    solves: number;
    lastSolve: Date | null;
  }[]>;

  // Platform Settings
  getPlatformSettings(): Promise<PlatformSettingsData>;
  updatePlatformSettings(updates: Record<string, string>): Promise<void>;

  // Containers
  getContainer(id: number): Promise<Container | undefined>;
  getContainerByName(name: string): Promise<Container | undefined>;
  getAllContainers(): Promise<Container[]>;
  createContainer(container: InsertContainer): Promise<Container>;
  updateContainer(id: number, updates: Partial<InsertContainer>): Promise<Container | undefined>;
  deleteContainer(id: number): Promise<boolean>;

  // Container Deployments
  getDeployment(id: number): Promise<ContainerDeployment | undefined>;
  getDeploymentByInstanceName(instanceName: string): Promise<ContainerDeployment | undefined>;
  getDeploymentsByContainer(containerId: number): Promise<ContainerDeployment[]>;
  getActiveDeployments(): Promise<ContainerDeployment[]>;
  createDeployment(deployment: InsertContainerDeployment): Promise<ContainerDeployment>;
  updateDeployment(id: number, updates: Partial<InsertContainerDeployment>): Promise<ContainerDeployment | undefined>;
  deleteDeployment(id: number): Promise<boolean>;

  // Challenge Container Links
  linkChallengeContainer(challengeId: number, containerId: number, isPrimary?: boolean): Promise<ChallengeContainer>;
  unlinkChallengeContainer(challengeId: number, containerId: number): Promise<boolean>;
  getContainersByChallenge(challengeId: number): Promise<(ChallengeContainer & { container: Container })[]>;
  getChallengesByContainer(containerId: number): Promise<(ChallengeContainer & { challenge: Challenge })[]>;

  // Container Port Mappings
  getPortMappings(deploymentId: number): Promise<ContainerPortMapping[]>;
  addPortMapping(mapping: InsertContainerPortMapping): Promise<ContainerPortMapping>;
  deletePortMapping(id: number): Promise<boolean>;

  // Container Environment Variables
  getEnvVars(containerId: number): Promise<ContainerEnvVar[]>;
  addEnvVar(envVar: InsertContainerEnvVar): Promise<ContainerEnvVar>;
  updateEnvVar(id: number, updates: Partial<InsertContainerEnvVar>): Promise<ContainerEnvVar | undefined>;
  deleteEnvVar(id: number): Promise<boolean>;

  // Email Verification Tokens
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  deleteEmailVerificationToken(id: number): Promise<boolean>;
  deleteEmailVerificationTokensByUserId(userId: string): Promise<void>;

  // Password Reset Tokens
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  deletePasswordResetToken(id: number): Promise<boolean>;
  deletePasswordResetTokensByUserId(userId: string): Promise<void>;
  markPasswordResetTokenUsed(id: number): Promise<void>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: false,
      tableName: "session",
    });
  }

  // ========== USERS ==========
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  // ========== TEAMS ==========
  async getTeam(id: number): Promise<Team | undefined> {
    const result = await db.select().from(teams).where(eq(teams.id, id)).limit(1);
    return result[0];
  }

  async getTeamByInviteCode(code: string): Promise<Team | undefined> {
    const result = await db.select().from(teams).where(eq(teams.inviteCode, code.toUpperCase())).limit(1);
    return result[0];
  }

  async getAllTeams(): Promise<Team[]> {
    return await db.select().from(teams).orderBy(desc(teams.createdAt));
  }

  async createTeam(team: InsertTeam): Promise<Team> {
    const inviteCode = generateInviteCode();
    const result = await db.insert(teams).values({ ...team, inviteCode }).returning();
    // Also add the captain as a member
    await this.addTeamMember(team.captainId, result[0].id);
    return result[0];
  }

  async updateTeam(id: number, updates: Partial<InsertTeam>): Promise<Team | undefined> {
    const result = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return result[0];
  }

  async deleteTeam(id: number): Promise<boolean> {
    const result = await db.delete(teams).where(eq(teams.id, id)).returning();
    return result.length > 0;
  }

  async regenerateInviteCode(id: number): Promise<Team | undefined> {
    const inviteCode = generateInviteCode();
    const result = await db.update(teams).set({ inviteCode }).where(eq(teams.id, id)).returning();
    return result[0];
  }

  async getTeamMembers(teamId: number): Promise<(TeamMember & { user: User })[]> {
    const result = await db
      .select()
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .where(eq(teamMembers.teamId, teamId));
    return result.map((r) => ({ ...r.team_members, user: r.users }));
  }

  async addTeamMember(userId: string, teamId: number): Promise<TeamMember> {
    const result = await db.insert(teamMembers).values({ userId, teamId }).returning();
    return result[0];
  }

  async removeTeamMember(userId: string, teamId: number): Promise<boolean> {
    const result = await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.userId, userId), eq(teamMembers.teamId, teamId)))
      .returning();
    return result.length > 0;
  }

  async getUserTeam(userId: string): Promise<Team | undefined> {
    const result = await db
      .select()
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))
      .limit(1);
    return result[0]?.teams;
  }

  // ========== CTF EVENTS ==========
  async getCtfEvent(id: number): Promise<CtfEvent | undefined> {
    const result = await db.select().from(ctfEvents).where(eq(ctfEvents.id, id)).limit(1);
    return result[0];
  }

  async getAllCtfEvents(): Promise<CtfEvent[]> {
    return await db.select().from(ctfEvents).orderBy(desc(ctfEvents.startTime));
  }

  async getActiveCtfEvents(): Promise<CtfEvent[]> {
    const now = new Date();
    return await db
      .select()
      .from(ctfEvents)
      .where(
        and(
          eq(ctfEvents.isPublished, true),
          lte(ctfEvents.startTime, now),
          gte(ctfEvents.endTime, now)
        )
      )
      .orderBy(desc(ctfEvents.startTime));
  }

  async getUpcomingCtfEvents(): Promise<CtfEvent[]> {
    const now = new Date();
    return await db
      .select()
      .from(ctfEvents)
      .where(and(eq(ctfEvents.isPublished, true), gte(ctfEvents.startTime, now)))
      .orderBy(ctfEvents.startTime);
  }

  async getPastCtfEvents(): Promise<CtfEvent[]> {
    const now = new Date();
    return await db
      .select()
      .from(ctfEvents)
      .where(and(eq(ctfEvents.isPublished, true), lte(ctfEvents.endTime, now)))
      .orderBy(desc(ctfEvents.endTime));
  }

  async createCtfEvent(event: InsertCtfEvent): Promise<CtfEvent> {
    // Generate invite code if event is private
    const inviteCode = event.isPrivate ? generateInviteCode() : null;
    const result = await db.insert(ctfEvents).values({ ...event, inviteCode }).returning();
    return result[0];
  }

  async updateCtfEvent(id: number, updates: Partial<InsertCtfEvent>): Promise<CtfEvent | undefined> {
    // Generate new invite code if toggling to private and no code exists
    let updateData: any = { ...updates };
    if (updates.isPrivate) {
      const existing = await this.getCtfEvent(id);
      if (!existing?.inviteCode) {
        updateData.inviteCode = generateInviteCode();
      }
    }
    const result = await db.update(ctfEvents).set(updateData).where(eq(ctfEvents.id, id)).returning();
    return result[0];
  }

  async deleteCtfEvent(id: number): Promise<boolean> {
    const result = await db.delete(ctfEvents).where(eq(ctfEvents.id, id)).returning();
    return result.length > 0;
  }

  // ========== CATEGORIES ==========
  async getCategory(id: number): Promise<Category | undefined> {
    const result = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return result[0];
  }

  async getAllCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async getDefaultCategories(): Promise<Category[]> {
    return await db.select().from(categories).where(eq(categories.isDefault, true)).orderBy(categories.name);
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const result = await db.insert(categories).values(category).returning();
    return result[0];
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const result = await db.update(categories).set(updates).where(eq(categories.id, id)).returning();
    return result[0];
  }

  async deleteCategory(id: number): Promise<boolean> {
    const result = await db.delete(categories).where(eq(categories.id, id)).returning();
    return result.length > 0;
  }

  // ========== CHALLENGES ==========
  async getChallenge(id: number): Promise<Challenge | undefined> {
    const result = await db.select().from(challenges).where(eq(challenges.id, id)).limit(1);
    return result[0];
  }

  async getChallengesByCtfEvent(ctfEventId: number): Promise<Challenge[]> {
    return await db
      .select()
      .from(challenges)
      .where(eq(challenges.ctfEventId, ctfEventId))
      .orderBy(challenges.categoryId, challenges.points);
  }

  async createChallenge(challenge: InsertChallenge): Promise<Challenge> {
    const result = await db.insert(challenges).values(challenge).returning();
    return result[0];
  }

  async updateChallenge(id: number, updates: Partial<InsertChallenge>): Promise<Challenge | undefined> {
    const result = await db.update(challenges).set(updates).where(eq(challenges.id, id)).returning();
    return result[0];
  }

  async deleteChallenge(id: number): Promise<boolean> {
    const result = await db.delete(challenges).where(eq(challenges.id, id)).returning();
    return result.length > 0;
  }

  async incrementSolveCount(id: number): Promise<void> {
    await db
      .update(challenges)
      .set({ solveCount: sql`${challenges.solveCount} + 1` })
      .where(eq(challenges.id, id));
  }

  // ========== CHALLENGE FILES ==========
  async getChallengeFiles(challengeId: number): Promise<ChallengeFile[]> {
    return await db.select().from(challengeFiles).where(eq(challengeFiles.challengeId, challengeId));
  }

  async getChallengeFile(id: number): Promise<ChallengeFile | undefined> {
    const result = await db.select().from(challengeFiles).where(eq(challengeFiles.id, id)).limit(1);
    return result[0];
  }

  async addChallengeFile(file: Omit<ChallengeFile, "id" | "createdAt">): Promise<ChallengeFile> {
    const result = await db.insert(challengeFiles).values(file).returning();
    return result[0];
  }

  async deleteChallengeFile(id: number): Promise<boolean> {
    const result = await db.delete(challengeFiles).where(eq(challengeFiles.id, id)).returning();
    return result.length > 0;
  }

  // ========== SUBMISSIONS ==========
  async createSubmission(submission: Omit<Submission, "id" | "submittedAt">): Promise<Submission> {
    const result = await db.insert(submissions).values(submission).returning();
    return result[0];
  }

  async getSubmissionsByChallenge(challengeId: number): Promise<Submission[]> {
    return await db
      .select()
      .from(submissions)
      .where(eq(submissions.challengeId, challengeId))
      .orderBy(desc(submissions.submittedAt));
  }

  async getSubmissionsByUser(userId: string): Promise<Submission[]> {
    return await db
      .select()
      .from(submissions)
      .where(eq(submissions.userId, userId))
      .orderBy(desc(submissions.submittedAt));
  }

  // ========== SOLVES ==========
  async createSolve(solve: Omit<Solve, "id" | "solvedAt">): Promise<Solve> {
    const result = await db.insert(solves).values(solve).returning();
    return result[0];
  }

  async getSolvesByCtfEvent(ctfEventId: number): Promise<Solve[]> {
    return await db
      .select()
      .from(solves)
      .where(eq(solves.ctfEventId, ctfEventId))
      .orderBy(solves.solvedAt);
  }

  async getSolvesByUser(userId: string): Promise<Solve[]> {
    const result = await db
      .select({
        solve: solves,
        challenge: challenges,
        ctfEvent: ctfEvents,
      })
      .from(solves)
      .innerJoin(challenges, eq(solves.challengeId, challenges.id))
      .innerJoin(ctfEvents, eq(solves.ctfEventId, ctfEvents.id))
      .where(eq(solves.userId, userId))
      .orderBy(desc(solves.solvedAt));

    return result.map((r) => ({
      ...r.solve,
      challenge: r.challenge,
      ctfEvent: r.ctfEvent,
    })) as any;
  }

  async getSolvesByTeam(teamId: number): Promise<Solve[]> {
    return await db.select().from(solves).where(eq(solves.teamId, teamId)).orderBy(desc(solves.solvedAt));
  }

  async getSolvesByChallenge(challengeId: number): Promise<Solve[]> {
    return await db
      .select()
      .from(solves)
      .where(eq(solves.challengeId, challengeId))
      .orderBy(solves.solvedAt);
  }

  async getUserSolveForChallenge(userId: string, challengeId: number): Promise<Solve | undefined> {
    const result = await db
      .select()
      .from(solves)
      .where(and(eq(solves.userId, userId), eq(solves.challengeId, challengeId)))
      .limit(1);
    return result[0];
  }

  async getFirstBlood(challengeId: number): Promise<Solve | undefined> {
    const result = await db
      .select()
      .from(solves)
      .where(and(eq(solves.challengeId, challengeId), eq(solves.isFirstBlood, true)))
      .limit(1);
    return result[0];
  }

  // ========== CTF REGISTRATIONS ==========
  async registerForCtf(userId: string, ctfEventId: number, teamId?: number): Promise<CtfRegistration> {
    const result = await db
      .insert(ctfRegistrations)
      .values({ userId, ctfEventId, teamId: teamId ?? null })
      .returning();
    return result[0];
  }

  async getCtfRegistration(userId: string, ctfEventId: number): Promise<CtfRegistration | undefined> {
    const result = await db
      .select()
      .from(ctfRegistrations)
      .where(and(eq(ctfRegistrations.userId, userId), eq(ctfRegistrations.ctfEventId, ctfEventId)))
      .limit(1);
    return result[0];
  }

  async getCtfRegistrations(ctfEventId: number): Promise<CtfRegistration[]> {
    return await db
      .select()
      .from(ctfRegistrations)
      .where(eq(ctfRegistrations.ctfEventId, ctfEventId));
  }

  // ========== LEADERBOARD ==========
  async getLeaderboard(
    ctfEventId: number,
    limit?: number
  ): Promise<
    {
      rank: number;
      id: string | number;
      name: string;
      score: number;
      solves: number;
      lastSolve: Date | null;
    }[]
  > {
    // Get the CTF event to check if it's team-based
    const ctf = await this.getCtfEvent(ctfEventId);
    if (!ctf) return [];

    if (ctf.isTeamBased) {
      // Team-based leaderboard
      const result = await db
        .select({
          teamId: solves.teamId,
          teamName: teams.name,
          score: sql<number>`SUM(${solves.points})`.as("score"),
          solveCount: sql<number>`COUNT(*)`.as("solve_count"),
          lastSolve: sql<Date>`MAX(${solves.solvedAt})`.as("last_solve"),
        })
        .from(solves)
        .innerJoin(teams, eq(solves.teamId, teams.id))
        .where(eq(solves.ctfEventId, ctfEventId))
        .groupBy(solves.teamId, teams.name)
        .orderBy(sql`score DESC, last_solve ASC`)
        .limit(limit ?? 100);

      return result.map((r, i) => ({
        rank: i + 1,
        id: r.teamId!,
        name: r.teamName,
        score: Number(r.score),
        solves: Number(r.solveCount),
        lastSolve: r.lastSolve,
      }));
    } else {
      // Individual leaderboard
      const result = await db
        .select({
          odyserId: solves.userId,
          username: users.username,
          score: sql<number>`SUM(${solves.points})`.as("score"),
          solveCount: sql<number>`COUNT(*)`.as("solve_count"),
          lastSolve: sql<Date>`MAX(${solves.solvedAt})`.as("last_solve"),
        })
        .from(solves)
        .innerJoin(users, eq(solves.userId, users.id))
        .where(eq(solves.ctfEventId, ctfEventId))
        .groupBy(solves.userId, users.username)
        .orderBy(sql`score DESC, last_solve ASC`)
        .limit(limit ?? 100);

      return result.map((r, i) => ({
        rank: i + 1,
        id: r.odyserId,
        name: r.username,
        score: Number(r.score),
        solves: Number(r.solveCount),
        lastSolve: r.lastSolve,
      }));
    }
  }

  // ========== PLATFORM SETTINGS ==========
  async getPlatformSettings(): Promise<PlatformSettingsData> {
    return platformSettingsService.getAll();
  }

  async updatePlatformSettings(updates: Record<string, string>): Promise<void> {
    return platformSettingsService.updateBulk(updates);
  }

  // ========== CONTAINERS ==========
  async getContainer(id: number): Promise<Container | undefined> {
    const result = await db.select().from(containers).where(eq(containers.id, id)).limit(1);
    return result[0];
  }

  async getContainerByName(name: string): Promise<Container | undefined> {
    const result = await db.select().from(containers).where(eq(containers.name, name)).limit(1);
    return result[0];
  }

  async getAllContainers(): Promise<Container[]> {
    return await db.select().from(containers).orderBy(desc(containers.createdAt));
  }

  async createContainer(container: InsertContainer): Promise<Container> {
    const result = await db.insert(containers).values(container).returning();
    return result[0];
  }

  async updateContainer(id: number, updates: Partial<InsertContainer>): Promise<Container | undefined> {
    const result = await db.update(containers).set(updates).where(eq(containers.id, id)).returning();
    return result[0];
  }

  async deleteContainer(id: number): Promise<boolean> {
    const result = await db.delete(containers).where(eq(containers.id, id)).returning();
    return result.length > 0;
  }

  // ========== CONTAINER DEPLOYMENTS ==========
  async getDeployment(id: number): Promise<ContainerDeployment | undefined> {
    const result = await db.select().from(containerDeployments).where(eq(containerDeployments.id, id)).limit(1);
    return result[0];
  }

  async getDeploymentByInstanceName(instanceName: string): Promise<ContainerDeployment | undefined> {
    const result = await db.select().from(containerDeployments).where(eq(containerDeployments.instanceName, instanceName)).limit(1);
    return result[0];
  }

  async getDeploymentsByContainer(containerId: number): Promise<ContainerDeployment[]> {
    return await db
      .select()
      .from(containerDeployments)
      .where(eq(containerDeployments.containerId, containerId))
      .orderBy(desc(containerDeployments.createdAt));
  }

  async getActiveDeployments(): Promise<ContainerDeployment[]> {
    return await db
      .select()
      .from(containerDeployments)
      .where(eq(containerDeployments.status, "running"))
      .orderBy(desc(containerDeployments.startedAt));
  }

  async createDeployment(deployment: InsertContainerDeployment): Promise<ContainerDeployment> {
    const result = await db.insert(containerDeployments).values(deployment).returning();
    return result[0];
  }

  async updateDeployment(id: number, updates: Partial<InsertContainerDeployment>): Promise<ContainerDeployment | undefined> {
    const result = await db.update(containerDeployments).set(updates).where(eq(containerDeployments.id, id)).returning();
    return result[0];
  }

  async deleteDeployment(id: number): Promise<boolean> {
    const result = await db.delete(containerDeployments).where(eq(containerDeployments.id, id)).returning();
    return result.length > 0;
  }

  // ========== CHALLENGE CONTAINER LINKS ==========
  async linkChallengeContainer(challengeId: number, containerId: number, isPrimary: boolean = false): Promise<ChallengeContainer> {
    const result = await db
      .insert(challengeContainers)
      .values({ challengeId, containerId, isPrimary })
      .returning();
    return result[0];
  }

  async unlinkChallengeContainer(challengeId: number, containerId: number): Promise<boolean> {
    const result = await db
      .delete(challengeContainers)
      .where(
        and(
          eq(challengeContainers.challengeId, challengeId),
          eq(challengeContainers.containerId, containerId)
        )
      )
      .returning();
    return result.length > 0;
  }

  async getContainersByChallenge(challengeId: number): Promise<(ChallengeContainer & { container: Container })[]> {
    const result = await db
      .select()
      .from(challengeContainers)
      .innerJoin(containers, eq(challengeContainers.containerId, containers.id))
      .where(eq(challengeContainers.challengeId, challengeId));
    return result.map((r) => ({ ...r.challenge_containers, container: r.containers }));
  }

  async getChallengesByContainer(containerId: number): Promise<(ChallengeContainer & { challenge: Challenge })[]> {
    const result = await db
      .select()
      .from(challengeContainers)
      .innerJoin(challenges, eq(challengeContainers.challengeId, challenges.id))
      .where(eq(challengeContainers.containerId, containerId));
    return result.map((r) => ({ ...r.challenge_containers, challenge: r.challenges }));
  }

  // ========== CONTAINER PORT MAPPINGS ==========
  async getPortMappings(deploymentId: number): Promise<ContainerPortMapping[]> {
    return await db
      .select()
      .from(containerPortMappings)
      .where(eq(containerPortMappings.deploymentId, deploymentId));
  }

  async addPortMapping(mapping: InsertContainerPortMapping): Promise<ContainerPortMapping> {
    const result = await db.insert(containerPortMappings).values(mapping).returning();
    return result[0];
  }

  async deletePortMapping(id: number): Promise<boolean> {
    const result = await db.delete(containerPortMappings).where(eq(containerPortMappings.id, id)).returning();
    return result.length > 0;
  }

  // ========== CONTAINER ENVIRONMENT VARIABLES ==========
  async getEnvVars(containerId: number): Promise<ContainerEnvVar[]> {
    return await db
      .select()
      .from(containerEnvVars)
      .where(eq(containerEnvVars.containerId, containerId));
  }

  async addEnvVar(envVar: InsertContainerEnvVar): Promise<ContainerEnvVar> {
    const result = await db.insert(containerEnvVars).values(envVar).returning();
    return result[0];
  }

  async updateEnvVar(id: number, updates: Partial<InsertContainerEnvVar>): Promise<ContainerEnvVar | undefined> {
    const result = await db.update(containerEnvVars).set(updates).where(eq(containerEnvVars.id, id)).returning();
    return result[0];
  }

  async deleteEnvVar(id: number): Promise<boolean> {
    const result = await db.delete(containerEnvVars).where(eq(containerEnvVars.id, id)).returning();
    return result.length > 0;
  }

  // ========== EMAIL VERIFICATION TOKENS ==========
  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const result = await db.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.token, token)).limit(1);
    return result[0];
  }

  async createEmailVerificationToken(token: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    const result = await db.insert(emailVerificationTokens).values(token).returning();
    return result[0];
  }

  async deleteEmailVerificationToken(id: number): Promise<boolean> {
    const result = await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, id)).returning();
    return result.length > 0;
  }

  async deleteEmailVerificationTokensByUserId(userId: string): Promise<void> {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
  }

  // ========== PASSWORD RESET TOKENS ==========
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const result = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.token, token)).limit(1);
    return result[0];
  }

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const result = await db.insert(passwordResetTokens).values(token).returning();
    return result[0];
  }

  async deletePasswordResetToken(id: number): Promise<boolean> {
    const result = await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, id)).returning();
    return result.length > 0;
  }

  async deletePasswordResetTokensByUserId(userId: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ used: true, usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }
}

export const storage = new DatabaseStorage();
