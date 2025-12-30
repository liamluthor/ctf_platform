// Simple server-side sanitization without browser/jsdom dependencies
// For production use, this strips dangerous HTML while allowing safe subset

/**
 * Sanitize HTML to prevent XSS attacks
 * Strips all HTML tags and returns plain text
 */
export function sanitizeText(input: string): string {
  if (!input) return "";

  // Strip all HTML tags and decode entities
  return input
    .replace(/<[^>]*>/g, '') // Remove all HTML tags
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&'); // Decode HTML entities
}

/**
 * Sanitize username - alphanumeric, underscores, hyphens only
 */
export function sanitizeUsername(username: string): string {
  if (!username) return "";

  // Remove any HTML first
  const cleaned = sanitizeText(username);

  // Only allow alphanumeric, underscores, hyphens
  return cleaned.replace(/[^a-zA-Z0-9_-]/g, "");
}

/**
 * Validate that input doesn't contain XSS attempts
 * Returns true if input is safe, false if potentially malicious
 */
export function containsXSS(input: string): boolean {
  if (!input) return false;

  // Check for common XSS patterns
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i, // onerror=, onclick=, etc.
    /<iframe/i,
    /<embed/i,
    /<object/i,
    /data:text\/html/i,
    /<svg/i,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Sanitize HTML content - allows safe HTML subset (bold, italic, links, code)
 * For challenge descriptions, CTF descriptions, etc.
 */
export function sanitizeHTML(input: string): string {
  if (!input) return "";

  // Remove dangerous tags while keeping safe formatting
  const safeHTML = input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
    .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '') // Remove iframes
    .replace(/<object[^>]*>[\s\S]*?<\/object>/gi, '') // Remove objects
    .replace(/<embed[^>]*>/gi, '') // Remove embeds
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers
    .replace(/on\w+\s*=\s*[^\s>]*/gi, '') // Remove unquoted event handlers
    .replace(/javascript:/gi, '') // Remove javascript: URLs
    .replace(/data:text\/html/gi, ''); // Remove data URIs

  return safeHTML;
}

/**
 * Validate environment variable key
 * Only alphanumeric and underscores allowed (Docker/shell convention)
 */
export function validateEnvVarKey(key: string): boolean {
  if (!key) return false;
  return /^[A-Z_][A-Z0-9_]*$/i.test(key);
}

/**
 * Sanitize environment variable value
 * Remove shell metacharacters to prevent injection
 */
export function sanitizeEnvVarValue(value: string): string {
  if (!value) return "";

  // Remove dangerous shell characters
  // Keep: alphanumeric, spaces, basic punctuation
  return value.replace(/[`$();&|<>]/g, "");
}

/**
 * Validate hex color code
 */
export function validateHexColor(color: string): boolean {
  if (!color) return false;
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

/**
 * Validate Docker container/image name
 * Must follow Docker naming rules
 */
export function validateDockerName(name: string): boolean {
  if (!name) return false;
  // Docker names: lowercase alphanumeric, hyphens, underscores, max 255 chars
  return /^[a-z0-9]([a-z0-9_-]{0,253}[a-z0-9])?$/.test(name);
}

/**
 * Sanitize team/challenge/CTF names
 * Allows alphanumeric, spaces, and common punctuation
 */
export function sanitizeName(name: string): string {
  if (!name) return "";

  // Strip HTML first
  const cleaned = sanitizeText(name);

  // Only allow safe characters for display names
  // Allow: letters, numbers, spaces, and basic punctuation
  return cleaned.replace(/[<>{}[\]\\\/|`~]/g, "").trim();
}
