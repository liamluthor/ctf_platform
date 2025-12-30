import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, registerUserSchema } from "@shared/schema";
import { logger } from "./logger";
import rateLimit from "express-rate-limit";
import { sanitizeUsername, containsXSS } from "./utils/sanitize";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function bootstrapAdmin() {
  const existingUsers = await storage.getAllUsers();
  if (existingUsers.length === 0) {
    const ownerUsername = process.env.ADMIN_USERNAME || "admin";
    const ownerPassword = process.env.ADMIN_PASSWORD || "changeme123";
    const ownerEmail = "admin@ctf.local";

    logger.info({ username: ownerUsername }, "Creating bootstrap owner account");
    await storage.createUser({
      username: ownerUsername,
      email: ownerEmail,
      password: await hashPassword(ownerPassword),
      role: "owner",
    });
    logger.info({ username: ownerUsername }, "Bootstrap owner created successfully");
  }

  // Seed default categories if none exist
  const existingCategories = await storage.getAllCategories();
  if (existingCategories.length === 0) {
    const defaultCategories = [
      { name: "Web", color: "#3B82F6", icon: "globe", isDefault: true },
      { name: "Crypto", color: "#8B5CF6", icon: "lock", isDefault: true },
      { name: "Pwn", color: "#EF4444", icon: "terminal", isDefault: true },
      { name: "Reverse", color: "#F97316", icon: "cpu", isDefault: true },
      { name: "Forensics", color: "#22C55E", icon: "search", isDefault: true },
      { name: "Misc", color: "#EAB308", icon: "puzzle", isDefault: true },
      { name: "OSINT", color: "#EC4899", icon: "eye", isDefault: true },
    ];

    logger.info("Seeding default challenge categories");
    for (const cat of defaultCategories) {
      await storage.createCategory(cat);
    }
    logger.info("Default categories created successfully");
  }
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session on activity
    store: storage.sessionStore,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true, // Prevent XSS access to cookie
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      sameSite: "strict", // Strict CSRF protection
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }
        if (user.isBanned) {
          return done(null, false, { message: "Account is banned" });
        }
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false, { message: "Invalid username or password" });
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      // If user is banned, invalidate the session
      if (user?.isBanned) {
        return done(null, false);
      }
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // ========== AUTH ROUTES ==========

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = registerUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }

      const { username, email, password } = parsed.data;

      // SECURITY: Check for XSS attempts
      if (containsXSS(username) || containsXSS(email)) {
        logger.warn({
          ip: req.ip,
          username,
          email,
        }, "XSS attempt in registration");
        return res.status(400).json({ error: "Invalid characters detected" });
      }

      // SECURITY: Sanitize username to prevent stored XSS
      const sanitizedUsername = sanitizeUsername(username);

      // Validate sanitized username still meets requirements
      if (sanitizedUsername.length < 3 || sanitizedUsername.length > 32) {
        return res.status(400).json({ error: "Username must be 3-32 alphanumeric characters, underscores, or hyphens" });
      }

      // Check if username exists (use sanitized version)
      const existingUsername = await storage.getUserByUsername(sanitizedUsername);
      if (existingUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      // Check if email exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "Email already registered" });
      }

      const user = await storage.createUser({
        username: sanitizedUsername,
        email: email.toLowerCase().trim(),
        password: await hashPassword(password),
        role: "user",
      });

      // Log the user in after registration
      req.login(user, (err) => {
        if (err) {
          logger.error({ error: err }, "Failed to login after registration");
          return res.status(500).json({ error: "Registration successful but login failed" });
        }
        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      logger.error({ error }, "Registration failed");
      res.status(500).json({ error: "Registration failed" });
    }
  });

  // Strict rate limiter for login attempts
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    skipSuccessfulRequests: true, // Don't count successful logins
    message: 'Too many login attempts, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Login
  app.post("/api/auth/login", loginLimiter, (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string }) => {
      if (err) {
        return next(err);
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        const { password: _, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.sendStatus(401);
    }
    const { password: _, ...safeUser } = req.user!;
    res.json(safeUser);
  });
}
