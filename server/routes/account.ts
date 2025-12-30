import { Express } from "express";
import { randomBytes } from "crypto";
import { storage } from "../storage";
import { hashPassword } from "../auth";
import { logger } from "../logger";
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail } from "../services/email";
import { sanitizeText, containsXSS } from "../utils/sanitize";
import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import rateLimit from "express-rate-limit";

const scryptAsync = promisify(scrypt);

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

// Rate limiter for sensitive operations
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

export function setupAccountRoutes(app: Express) {
  // ========== EMAIL VERIFICATION ==========

  // Send/resend email verification
  app.post("/api/account/send-verification", accountLimiter, async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const user = req.user!;

      // Check if already verified
      if (user.emailVerified) {
        return res.status(400).json({ error: "Email already verified" });
      }

      // Delete any existing tokens for this user
      await storage.deleteEmailVerificationTokensByUserId(user.id);

      // Generate new token (expires in 24 hours)
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await storage.createEmailVerificationToken({
        userId: user.id,
        token,
        expiresAt,
      });

      // Send verification email
      const emailSent = await sendVerificationEmail(user.email, user.username, token);

      if (!emailSent) {
        logger.warn({ userId: user.id }, "Failed to send verification email");
        return res.status(500).json({ error: "Failed to send verification email. Please try again later." });
      }

      logger.info({ userId: user.id }, "Verification email sent");
      res.json({ message: "Verification email sent" });
    } catch (error) {
      logger.error({ error }, "Error sending verification email");
      res.status(500).json({ error: "Failed to send verification email" });
    }
  });

  // Verify email with token
  app.post("/api/account/verify-email", async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: "Token is required" });
      }

      // Find token
      const tokenRecord = await storage.getEmailVerificationToken(token);

      if (!tokenRecord) {
        return res.status(400).json({ error: "Invalid or expired verification token" });
      }

      // Check if expired
      if (new Date() > tokenRecord.expiresAt) {
        await storage.deleteEmailVerificationToken(tokenRecord.id);
        return res.status(400).json({ error: "Verification token has expired. Please request a new one." });
      }

      // Mark user as verified
      await storage.updateUser(tokenRecord.userId, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });

      // Delete the token
      await storage.deleteEmailVerificationToken(tokenRecord.id);

      logger.info({ userId: tokenRecord.userId }, "Email verified successfully");
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      logger.error({ error }, "Error verifying email");
      res.status(500).json({ error: "Failed to verify email" });
    }
  });

  // ========== PASSWORD MANAGEMENT ==========

  // Change password (authenticated user)
  app.post("/api/account/change-password", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { currentPassword, newPassword } = req.body;

      // Validation
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Current password and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const user = req.user!;

      // Verify current password
      const isValid = await comparePasswords(currentPassword, user.password);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      // Hash and update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, { password: hashedPassword });

      // Send confirmation email
      await sendPasswordChangedEmail(user.email, user.username);

      logger.info({ userId: user.id }, "Password changed successfully");
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      logger.error({ error }, "Error changing password");
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Request password reset (forgot password)
  app.post("/api/account/forgot-password", accountLimiter, async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // SECURITY: Check for XSS
      if (containsXSS(email)) {
        return res.status(400).json({ error: "Invalid email" });
      }

      const sanitizedEmail = sanitizeText(email).trim().toLowerCase();

      // Find user by email
      const user = await storage.getUserByEmail(sanitizedEmail);

      // SECURITY: Always return success to prevent user enumeration
      if (!user) {
        logger.info({ email: sanitizedEmail }, "Password reset requested for non-existent email");
        return res.json({ message: "If an account exists with this email, a password reset link has been sent" });
      }

      // Delete any existing tokens for this user
      await storage.deletePasswordResetTokensByUserId(user.id);

      // Generate reset token (expires in 1 hour)
      const token = generateToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await storage.createPasswordResetToken({
        userId: user.id,
        token,
        expiresAt,
        used: false,
      });

      // Send reset email
      const emailSent = await sendPasswordResetEmail(user.email, user.username, token);

      if (!emailSent) {
        logger.warn({ userId: user.id }, "Failed to send password reset email");
      }

      logger.info({ userId: user.id }, "Password reset email sent");
      res.json({ message: "If an account exists with this email, a password reset link has been sent" });
    } catch (error) {
      logger.error({ error }, "Error sending password reset email");
      res.status(500).json({ error: "Failed to process password reset request" });
    }
  });

  // Reset password with token
  app.post("/api/account/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ error: "Token and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      // Find token
      const tokenRecord = await storage.getPasswordResetToken(token);

      if (!tokenRecord) {
        return res.status(400).json({ error: "Invalid or expired reset token" });
      }

      // Check if already used
      if (tokenRecord.used) {
        return res.status(400).json({ error: "Reset token has already been used" });
      }

      // Check if expired
      if (new Date() > tokenRecord.expiresAt) {
        await storage.deletePasswordResetToken(tokenRecord.id);
        return res.status(400).json({ error: "Reset token has expired. Please request a new one." });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await storage.updateUser(tokenRecord.userId, { password: hashedPassword });

      // Mark token as used
      await storage.markPasswordResetTokenUsed(tokenRecord.id);

      // Get user for email
      const user = await storage.getUser(tokenRecord.userId);
      if (user) {
        await sendPasswordChangedEmail(user.email, user.username);
      }

      logger.info({ userId: tokenRecord.userId }, "Password reset successfully");
      res.json({ message: "Password reset successfully" });
    } catch (error) {
      logger.error({ error }, "Error resetting password");
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // ========== PROFILE UPDATE ==========

  // Update profile (bio, avatar)
  app.patch("/api/account/profile", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { bio, avatarUrl } = req.body;
      const user = req.user!;

      // Validation
      if (bio && bio.length > 500) {
        return res.status(400).json({ error: "Bio must be less than 500 characters" });
      }

      if (avatarUrl && avatarUrl.length > 500) {
        return res.status(400).json({ error: "Avatar URL is too long" });
      }

      // SECURITY: Check for XSS
      if ((bio && containsXSS(bio)) || (avatarUrl && containsXSS(avatarUrl))) {
        logger.warn({ userId: user.id }, "XSS attempt in profile update");
        return res.status(400).json({ error: "Invalid characters detected" });
      }

      // Sanitize inputs
      const updates: any = {};
      if (bio !== undefined) {
        updates.bio = bio ? sanitizeText(bio).slice(0, 500) : null;
      }
      if (avatarUrl !== undefined) {
        updates.avatarUrl = avatarUrl ? sanitizeText(avatarUrl).slice(0, 500) : null;
      }

      await storage.updateUser(user.id, updates);

      // Get updated user
      const updatedUser = await storage.getUser(user.id);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      const { password: _, ...safeUser } = updatedUser;

      logger.info({ userId: user.id }, "Profile updated");
      res.json(safeUser);
    } catch (error) {
      logger.error({ error }, "Error updating profile");
      res.status(500).json({ error: "Failed to update profile" });
    }
  });
}
