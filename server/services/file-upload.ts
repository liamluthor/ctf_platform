import multer from "multer";
import path from "path";
import fs from "fs";
import { randomBytes } from "crypto";
import { logger } from "../logger";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || "52428800"); // 50MB default

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Sanitize filename to prevent path traversal and other attacks
function sanitizeFilename(filename: string): string {
  // Remove any path components (directory separators)
  let sanitized = path.basename(filename);

  // Remove any null bytes
  sanitized = sanitized.replace(/\0/g, "");

  // Remove leading dots (hidden files)
  sanitized = sanitized.replace(/^\.+/, "");

  // Replace any remaining dangerous characters with underscores
  sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, "_");

  // Ensure we have a valid filename
  if (!sanitized || sanitized.length === 0) {
    sanitized = "file";
  }

  return sanitized;
}

// Generate unique filename
function generateFilename(originalName: string): string {
  // First sanitize the original filename
  const sanitized = sanitizeFilename(originalName);

  // Extract extension from sanitized name
  const ext = path.extname(sanitized).toLowerCase();

  // Validate extension doesn't contain path traversal
  if (ext.includes("..") || ext.includes("/") || ext.includes("\\")) {
    throw new Error("Invalid file extension");
  }

  const uniqueId = randomBytes(16).toString("hex");
  return `${uniqueId}${ext}`;
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    logger.info({ originalname: file.originalname, size: file.size }, "MULTER: Processing file");
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const newName = generateFilename(file.originalname);
    logger.info({ newName }, "MULTER: Saving file as");
    cb(null, newName);
  },
});

// File filter - allow common CTF file types
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  logger.info({ originalname: file.originalname, mimetype: file.mimetype }, "MULTER: File filter checking");

  // Allow most file types for CTF challenges
  // Block only executable files that could be dangerous on the server
  const blockedExtensions = [".exe", ".bat", ".cmd", ".sh", ".ps1"];
  const ext = path.extname(file.originalname).toLowerCase();

  if (blockedExtensions.includes(ext)) {
    logger.warn({ ext }, "MULTER: File type blocked");
    cb(new Error(`File type ${ext} is not allowed`));
  } else {
    logger.info({ ext }, "MULTER: File type allowed");
    cb(null, true);
  }
};

// Create multer instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5, // Max 5 files per upload
  },
});

// Helper to get file path with path traversal protection
export function getFilePath(filename: string): string {
  // Validate filename doesn't contain path traversal characters
  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\") || filename.includes("\0")) {
    logger.error({ filename }, "Invalid filename characters detected");
    throw new Error("Invalid file path");
  }

  // Use path.basename to strip any path components
  const basename = path.basename(filename);

  // Additional check - basename should match original filename
  if (basename !== filename) {
    logger.error({ filename, basename }, "Filename mismatch after basename");
    throw new Error("Invalid file path");
  }

  const filePath = path.join(UPLOAD_DIR, basename);

  // Prevent path traversal attacks
  const normalized = path.resolve(filePath);
  const uploadDirResolved = path.resolve(UPLOAD_DIR);

  if (!normalized.startsWith(uploadDirResolved)) {
    logger.error({ filename, normalized, uploadDirResolved }, "Path traversal attempt detected");
    throw new Error("Invalid file path");
  }

  // Final check - ensure the file path only goes one level deep
  const relativePath = path.relative(uploadDirResolved, normalized);
  if (relativePath.includes(path.sep)) {
    logger.error({ filename, relativePath }, "File path contains subdirectory");
    throw new Error("Invalid file path");
  }

  return normalized;
}

// Helper to delete file
export async function deleteFile(filename: string): Promise<boolean> {
  const filePath = getFilePath(filename);
  try {
    await fs.promises.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

// Get upload directory
export function getUploadDir(): string {
  return UPLOAD_DIR;
}
