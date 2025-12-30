import nodemailer from "nodemailer";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { logger } from "../logger";

// Email configuration from environment variables
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || "smtp"; // "smtp" or "ses"
const SMTP_HOST = process.env.SMTP_HOST || "localhost";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "25");
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@ctf.local";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "CTF Platform";
const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

// AWS SES configuration
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;

// Create reusable transporter (for SMTP) or SES client
let transporter: nodemailer.Transporter | null = null;
let sesClient: SESClient | null = null;

function initializeEmailService() {
  if (EMAIL_PROVIDER === "ses") {
    if (!sesClient) {
      const sesConfig: any = {
        region: AWS_REGION,
      };

      // Only add credentials if explicitly provided (otherwise use IAM role)
      if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
        sesConfig.credentials = {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        };
      }

      sesClient = new SESClient(sesConfig);
      logger.info({ region: AWS_REGION }, "Email service initialized with AWS SES");
    }
    return sesClient;
  } else {
    if (!transporter) {
      // SMTP transporter
      transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: SMTP_USER && SMTP_PASS ? {
          user: SMTP_USER,
          pass: SMTP_PASS,
        } : undefined,
      });

      logger.info({ host: SMTP_HOST, port: SMTP_PORT }, "Email service initialized with SMTP");
    }
    return transporter;
  }
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (EMAIL_PROVIDER === "ses") {
      // Use AWS SES directly
      const client = initializeEmailService() as SESClient;

      const command = new SendEmailCommand({
        Source: EMAIL_FROM,
        Destination: {
          ToAddresses: [options.to],
        },
        Message: {
          Subject: {
            Data: options.subject,
          },
          Body: {
            Text: {
              Data: options.text,
            },
            Html: options.html ? {
              Data: options.html,
            } : undefined,
          },
        },
      });

      await client.send(command);
    } else {
      // Use SMTP via nodemailer
      const transport = initializeEmailService() as nodemailer.Transporter;

      await transport.sendMail({
        from: `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
    }

    logger.info({ to: options.to, subject: options.subject }, "Email sent successfully");
    return true;
  } catch (error) {
    logger.error({
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      to: options.to,
      subject: options.subject
    }, "Failed to send email");
    return false;
  }
}

export async function sendVerificationEmail(email: string, username: string, token: string): Promise<boolean> {
  const verificationUrl = `${BASE_URL}/verify-email?token=${token}`;

  const subject = "Verify your email address";
  const text = `
Hello ${username},

Thank you for registering! Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
${EMAIL_FROM_NAME}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #3B82F6;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Verify Your Email Address</h2>
    <p>Hello ${username},</p>
    <p>Thank you for registering! Please verify your email address by clicking the button below:</p>
    <a href="${verificationUrl}" class="button">Verify Email</a>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${verificationUrl}">${verificationUrl}</a></p>
    <p>This link will expire in 24 hours.</p>
    <p>If you did not create an account, please ignore this email.</p>
    <div class="footer">
      <p>Best regards,<br>${EMAIL_FROM_NAME}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
}

export async function sendPasswordResetEmail(email: string, username: string, token: string): Promise<boolean> {
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`;

  const subject = "Reset your password";
  const text = `
Hello ${username},

We received a request to reset your password. Click the link below to reset it:

${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
${EMAIL_FROM_NAME}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #EF4444;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 20px 0;
    }
    .warning {
      background-color: #FEF3C7;
      border-left: 4px solid #F59E0B;
      padding: 12px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Reset Your Password</h2>
    <p>Hello ${username},</p>
    <p>We received a request to reset your password. Click the button below to reset it:</p>
    <a href="${resetUrl}" class="button">Reset Password</a>
    <p>Or copy and paste this link into your browser:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <div class="warning">
      <strong>⚠ Security Notice:</strong><br>
      This link will expire in 1 hour. If you did not request a password reset, please ignore this email and your password will remain unchanged.
    </div>
    <div class="footer">
      <p>Best regards,<br>${EMAIL_FROM_NAME}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
}

export async function sendPasswordChangedEmail(email: string, username: string): Promise<boolean> {
  const subject = "Your password was changed";
  const text = `
Hello ${username},

This is a confirmation that your password was successfully changed.

If you did not make this change, please contact support immediately.

Best regards,
${EMAIL_FROM_NAME}
  `.trim();

  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .success {
      background-color: #D1FAE5;
      border-left: 4px solid: #10B981;
      padding: 12px;
      margin: 20px 0;
    }
    .footer { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Password Changed Successfully</h2>
    <p>Hello ${username},</p>
    <div class="success">
      <strong>✓ Success:</strong><br>
      Your password was successfully changed.
    </div>
    <p>If you did not make this change, please contact support immediately.</p>
    <div class="footer">
      <p>Best regards,<br>${EMAIL_FROM_NAME}</p>
    </div>
  </div>
</body>
</html>
  `.trim();

  return sendEmail({ to: email, subject, text, html });
}
