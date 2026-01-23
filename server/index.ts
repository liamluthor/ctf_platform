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

// Trust proxy - required for secure IP validation behind nginx/reverse proxy
app.set('trust proxy', 1);

/**
 * SECURITY: Get validated client IP address
 * Uses Express's trust proxy mechanism to get the real client IP
 * This prevents IP spoofing via X-Forwarded-For header injection
 */
function getClientIp(req: Request): string {
  // Express with trust proxy enabled will set req.ip to the correct client IP
  // based on the leftmost non-trusted IP in X-Forwarded-For
  const clientIp = req.ip || req.socket.remoteAddress || 'unknown';

  // Normalize IPv6 localhost to IPv4
  if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    return '127.0.0.1';
  }

  return clientIp;
}

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

// SECURITY: Detect and block IP spoofing attempts
app.use((req, res, next) => {
  const xForwardedFor = req.headers['x-forwarded-for'];

  // If X-Forwarded-For contains localhost/private IPs but req.ip doesn't match,
  // this is likely spoofing
  if (xForwardedFor && typeof xForwardedFor === 'string') {
    const ips = xForwardedFor.split(',').map(ip => ip.trim());
    const suspiciousIps = ['127.0.0.1', 'localhost', '::1'];

    if (ips.some(ip => suspiciousIps.includes(ip)) && req.ip !== '127.0.0.1') {
      const realIp = getClientIp(req);
      logger.warn({
        realIp,
        xForwardedFor,
        path: req.path
      }, "[SECURITY] Detected IP spoofing attempt");
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  next();
});

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

// Analytics tracking middleware
app.use((req, res, next) => {
  const start = Date.now();
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", async () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const path = req.path;
    // SECURITY: Use validated IP from Express trust proxy, not raw headers
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;
    const refererHeader = req.headers['referer'] || req.headers['referrer'] || null;
    const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;

    // Track all non-static requests (exclude assets, static files, and Vite dev paths)
    const isStaticFile = path.startsWith("/assets/") ||
                         path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/) ||
                         path.startsWith("/@") ||
                         path.includes("/.vite") ||
                         path.includes("/node_modules");

    if (!isStaticFile) {
      try {
        // Extract CTF/Challenge context from path or session
        let ctfEventId: number | null = null;
        let challengeId: number | null = null;
        let userId: string | null = null;

        // Get user ID from session if available
        if (req.session?.userId) {
          userId = req.session.userId;
        }

        // Extract IDs from URL path patterns
        // Example paths: /ctf/123, /challenge/456, /api/ctf-events/123, etc.
        const ctfMatch = path.match(/\/(?:ctf|ctf-events?)\/(\d+)/i);
        const challengeMatch = path.match(/\/challenges?\/(\d+)/i);

        if (ctfMatch) {
          ctfEventId = parseInt(ctfMatch[1], 10);
        }
        if (challengeMatch) {
          challengeId = parseInt(challengeMatch[1], 10);
        }

        // Log errors (4xx and 5xx status codes)
        if (statusCode >= 400) {
          const { logError } = await import("./storage");
          await logError({
            userId,
            ctfEventId,
            challengeId,
            ipAddress,
            path,
            method: req.method,
            statusCode,
            errorMessage: capturedJsonResponse?.message || capturedJsonResponse?.error || null,
            userAgent,
            referer,
          });
        } else {
          // Log successful page views
          const { logPageView } = await import("./storage");
          await logPageView({
            userId,
            ctfEventId,
            challengeId,
            ipAddress,
            path,
            method: req.method,
            statusCode,
            userAgent,
            referer,
            responseTime: duration,
          });
        }
      } catch (error) {
        // Don't let analytics errors crash the app
        logger.error({ error }, '[analytics] Error logging request');
      }
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

// Export helper functions for use in other modules
export { getClientIp };
