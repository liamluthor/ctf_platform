import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";
import { logger } from "../logger";

// Generate CSRF token for session
export function generateCSRFToken(): string {
  return randomBytes(32).toString("hex");
}

// Middleware to ensure CSRF token exists in session
export function ensureCSRFToken(req: Request, res: Response, next: NextFunction) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCSRFToken();
  }
  next();
}

// Middleware to validate CSRF token on state-changing requests
export function validateCSRF(req: Request, res: Response, next: NextFunction) {
  // Skip GET, HEAD, OPTIONS (read-only methods)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const sessionToken = req.session.csrfToken;
  const headerToken = req.get("X-CSRF-Token");

  if (!sessionToken || !headerToken || sessionToken !== headerToken) {
    logger.warn({
      ip: req.ip,
      path: req.path,
      method: req.method,
      hasSessionToken: !!sessionToken,
      hasHeaderToken: !!headerToken,
      userAgent: req.get("User-Agent"),
    }, "CSRF token validation failed");

    return res.status(403).json({ error: "Invalid CSRF token" });
  }

  next();
}

// Validate Origin header on state-changing requests
export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  // Skip read-only methods
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const allowedOrigins = [
    "http://localhost:5001",
    "http://127.0.0.1:5001",
    process.env.ALLOWED_ORIGIN,
  ].filter(Boolean);

  const origin = req.get("Origin");
  const referer = req.get("Referer");

  // If Origin header exists, validate it
  if (origin) {
    if (!allowedOrigins.includes(origin)) {
      logger.warn({
        ip: req.ip,
        path: req.path,
        origin,
        referer,
      }, "Invalid origin");

      return res.status(403).json({ error: "Forbidden" });
    }
  }
  // If no Origin but has Referer, validate it
  else if (referer) {
    try {
      const refererOrigin = new URL(referer).origin;
      if (!allowedOrigins.includes(refererOrigin)) {
        logger.warn({
          ip: req.ip,
          path: req.path,
          referer,
          refererOrigin,
        }, "Invalid referer");

        return res.status(403).json({ error: "Forbidden" });
      }
    } catch (error) {
      logger.warn({
        ip: req.ip,
        path: req.path,
        referer,
        error: "Invalid referer URL",
      }, "Malformed referer");

      return res.status(403).json({ error: "Forbidden" });
    }
  }
  // No Origin or Referer - might be direct navigation or curl
  // In production, you might want to be stricter here
  else if (process.env.NODE_ENV === "production") {
    logger.warn({
      ip: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get("User-Agent"),
    }, "State-changing request with no Origin or Referer");

    // Allow for now but log - you might want to block this in production
    // return res.status(403).json({ error: "Forbidden" });
  }

  next();
}
