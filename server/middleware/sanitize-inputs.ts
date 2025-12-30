import { Request, Response, NextFunction } from "express";
import {
  sanitizeText,
  sanitizeHTML,
  sanitizeName,
  validateEnvVarKey,
  sanitizeEnvVarValue,
  validateHexColor,
  validateDockerName,
  containsXSS,
} from "../utils/sanitize";
import { logger } from "../logger";

/**
 * Sanitization rules for different field types
 */
const SANITIZATION_RULES: Record<string, (value: any) => any> = {
  // Names (teams, CTFs, challenges, categories)
  name: (v) => sanitizeName(v),
  platformName: (v) => sanitizeName(v),

  // Descriptions (allow safe HTML)
  description: (v) => sanitizeHTML(v),
  tagline: (v) => sanitizeHTML(v),

  // Plain text fields
  bio: (v) => sanitizeText(v),
  author: (v) => sanitizeText(v),
  hints: (v) => sanitizeText(v),

  // Flags (plain text, but keep exact format)
  flag: (v) => sanitizeText(v),

  // Invite codes (uppercase alphanumeric)
  inviteCode: (v) => {
    if (!v) return v;
    const cleaned = sanitizeText(v).toUpperCase();
    return cleaned.replace(/[^A-Z0-9]/g, '');
  },

  // Colors (hex validation)
  color: (v) => {
    if (!v) return v;
    if (!validateHexColor(v)) {
      throw new Error(`Invalid color format: ${v}`);
    }
    return v;
  },
  primaryColor: (v) => SANITIZATION_RULES.color(v),
  accentColor: (v) => SANITIZATION_RULES.color(v),
};

/**
 * Middleware to automatically sanitize request body fields
 * Apply to specific routes that need input sanitization
 */
export function sanitizeRequestBody(req: Request, res: Response, next: NextFunction) {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  try {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (value === null || value === undefined) {
        sanitized[key] = value;
        continue;
      }

      // Apply sanitization rule if exists for this field
      if (SANITIZATION_RULES[key]) {
        sanitized[key] = SANITIZATION_RULES[key](value);
      } else if (typeof value === 'string') {
        // Default: check for XSS in any string field not explicitly handled
        if (containsXSS(value)) {
          logger.warn({
            ip: req.ip,
            path: req.path,
            field: key,
            value: value.substring(0, 100),
          }, "XSS attempt in unhandled field");
          return res.status(400).json({ error: `Invalid characters in field: ${key}` });
        }
        sanitized[key] = value;
      } else {
        // Non-string values pass through
        sanitized[key] = value;
      }
    }

    req.body = sanitized;
    next();
  } catch (error) {
    logger.error({ error, body: req.body }, "Sanitization error");
    res.status(400).json({ error: error instanceof Error ? error.message : "Invalid input" });
  }
}

/**
 * Specific sanitizer for environment variables
 */
export function sanitizeEnvVars(req: Request, res: Response, next: NextFunction) {
  const { key, value } = req.body;

  if (!key || !validateEnvVarKey(key)) {
    return res.status(400).json({
      error: "Invalid environment variable key. Must be uppercase alphanumeric with underscores."
    });
  }

  if (value && typeof value === 'string') {
    // Sanitize value to prevent command injection
    req.body.value = sanitizeEnvVarValue(value);
  }

  next();
}

/**
 * Validator for container names
 */
export function validateContainerName(req: Request, res: Response, next: NextFunction) {
  const { name } = req.body;

  if (name && !validateDockerName(name)) {
    return res.status(400).json({
      error: "Invalid container name. Must be lowercase alphanumeric with hyphens/underscores."
    });
  }

  next();
}
