import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { bootstrapAdmin } from "./auth";
import { logger, logRequest } from "./logger";
import { initializePlatformSettings } from "./db-init";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// Security Headers - Helmet configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // Required for Tailwind and inline styles
        "https://fonts.googleapis.com" // Google Fonts
      ],
      scriptSrc: [
        "'self'",
        ...(process.env.NODE_ENV === "development" ? ["'unsafe-inline'", "'unsafe-eval'"] : [])
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        ...(process.env.NODE_ENV === "development" ? ["ws:", "wss:"] : []) // Vite HMR
      ],
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com" // Google Fonts
      ],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
}));

// Rate limiting - lenient for general use, rely on fail2ban for abuse
// Only apply to API endpoints to prevent brute force attacks
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // Very generous limit - fail2ban handles actual abuse
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Only rate limit API endpoints
    if (!req.path.startsWith('/api')) return true;
    // Skip in development
    if (process.env.NODE_ENV === 'development') return true;
    return false;
  }
});

app.use(apiLimiter);

app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  const isMultipart = contentType.startsWith('multipart/form-data');

  // Log multipart requests for debugging
  if (isMultipart && req.path.includes('/files')) {
    logger.info({
      path: req.path,
      method: req.method,
      contentType,
      contentLength: req.headers['content-length']
    }, "Multipart request detected - skipping body parsers");
  }

  // Skip body parsing for multipart/form-data (file uploads)
  if (isMultipart) {
    return next();
  }

  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })(req, res, next);
});

app.use((req, res, next) => {
  // Skip URL encoding for multipart/form-data
  if (req.headers['content-type']?.startsWith('multipart/form-data')) {
    return next();
  }
  express.urlencoded({ extended: false })(req, res, next);
});

// Security: Block access to hidden files (.git, .env, .htaccess, etc.)
// In development mode, allow Vite's internal paths (.vite, @vite, @fs, etc.)
app.use((req, res, next) => {
  // In development, skip this check entirely for Vite paths
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && (req.path.startsWith("/@") || req.path.includes("/.vite") || req.path.includes("node_modules"))) {
    return next();
  }

  // Block access to hidden files and directories
  // Match /.git, /.env, /.htaccess, etc. anywhere in the path
  if (req.path.includes("/.") || req.path.startsWith("/.")) {
    logger.warn(
      {
        path: req.path,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      },
      "Blocked hidden file access attempt"
    );
    return res.status(403).json({ error: "Forbidden" });
  }

  // Additional check: Block common sensitive paths
  const blockedPaths = [
    ".git", ".env", ".htaccess", ".htpasswd",
    "package.json", "package-lock.json", "tsconfig.json",
    "node_modules", ".vscode", ".idea"
  ];

  const pathLower = req.path.toLowerCase();
  for (const blocked of blockedPaths) {
    if (pathLower.includes(`/${blocked}/`) || pathLower.includes(`/${blocked}`) || pathLower === `/${blocked}`) {
      logger.warn(
        {
          path: req.path,
          blocked,
          ip: req.ip,
          userAgent: req.get("user-agent"),
        },
        "Blocked sensitive path access attempt"
      );
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  next();
});

// HTTP request logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logRequest(req.method, req.path, res.statusCode, duration);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);
  await bootstrapAdmin();
  await initializePlatformSettings();

  app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error(
      {
        error: message,
        status,
        stack: err.stack,
      },
      "Unhandled error"
    );

    res.status(status).json({ message });
  });

  // Setup Vite in development, static serving in production
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      logger.info({ port, env: process.env.NODE_ENV }, "CTF Platform server started");
    }
  );
})();
