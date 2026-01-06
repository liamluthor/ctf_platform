#!/usr/bin/env tsx
/**
 * Import analytics data from nginx access logs
 *
 * Usage:
 *   tsx script/import-analytics-from-logs.ts /path/to/access.log
 *   ssh root@ctf.strayerraptors.com "cat /var/log/nginx/access.log" | tsx script/import-analytics-from-logs.ts --stdin
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { pageViews, errorLogs } from "../shared/schema";
import pg from "pg";
import * as fs from "fs";
import * as readline from "readline";

const { Pool } = pg;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Nginx log line regex (combined format)
// Example: 103.203.57.3 - - [06/Jan/2026:00:00:59 +0000] "GET / HTTP/1.1" 301 178 "-" "Mozilla/5.0 zgrab/0.x"
const LOG_REGEX = /^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) ([^"]*) \S+" (\d+) (\d+) "([^"]*)" "([^"]*)"/;

// Extract CTF/Challenge IDs from path
function extractIds(path: string): { ctfEventId: number | null; challengeId: number | null } {
  let ctfEventId: number | null = null;
  let challengeId: number | null = null;

  // Match patterns: /ctf/123, /api/ctf-events/123, etc.
  const ctfMatch = path.match(/\/(?:ctf|ctf-events?)\/(\d+)/i);
  if (ctfMatch) {
    ctfEventId = parseInt(ctfMatch[1], 10);
  }

  // Match patterns: /challenge/456, /api/challenges/456, etc.
  const challengeMatch = path.match(/\/challenges?\/(\d+)/i);
  if (challengeMatch) {
    challengeId = parseInt(challengeMatch[1], 10);
  }

  return { ctfEventId, challengeId };
}

// Parse nginx timestamp: 06/Jan/2026:00:00:59 +0000
function parseNginxTimestamp(timestamp: string): Date {
  // Convert to ISO format: 2026-01-06T00:00:59+00:00
  const parts = timestamp.match(/(\d+)\/(\w+)\/(\d+):(\d+):(\d+):(\d+) ([+-]\d{4})/);
  if (!parts) return new Date();

  const [, day, month, year, hour, minute, second, tz] = parts;
  const months: Record<string, string> = {
    Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
    Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
  };

  const isoDate = `${year}-${months[month]}-${day}T${hour}:${minute}:${second}${tz.slice(0, 3)}:${tz.slice(3)}`;
  return new Date(isoDate);
}

// Check if path is a static file
function isStaticFile(path: string): boolean {
  return path.startsWith("/assets/") ||
         /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf)$/.test(path) ||
         path.startsWith("/@") ||
         path.includes("/.vite") ||
         path.includes("/node_modules");
}

async function processLogLine(line: string): Promise<void> {
  const match = line.match(LOG_REGEX);
  if (!match) return;

  const [, ipAddress, timestamp, method, path, statusCode, bytes, referer, userAgent] = match;
  const status = parseInt(statusCode, 10);

  // Skip static files
  if (isStaticFile(path)) return;

  // Parse timestamp
  const parsedTimestamp = parseNginxTimestamp(timestamp);

  // Extract CTF/Challenge IDs
  const { ctfEventId, challengeId } = extractIds(path);

  // Prepare common data
  const commonData = {
    userId: null, // We don't have user info from nginx logs
    ctfEventId,
    challengeId,
    ipAddress,
    path,
    method,
    statusCode: status,
    userAgent: userAgent !== '-' ? userAgent : null,
    referer: referer !== '-' ? referer : null,
    timestamp: parsedTimestamp,
  };

  try {
    if (status >= 400) {
      // Log error
      await db.insert(errorLogs).values({
        ...commonData,
        errorMessage: null, // nginx logs don't have error messages
      });
    } else {
      // Log page view
      await db.insert(pageViews).values({
        ...commonData,
        responseTime: null, // nginx logs don't have response time by default
      });
    }
  } catch (error) {
    console.error(`Error inserting log entry for ${path}:`, error);
  }
}

async function processFile(filePath: string): Promise<void> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let processedCount = 0;

  for await (const line of rl) {
    lineCount++;
    await processLogLine(line);
    processedCount++;

    if (processedCount % 1000 === 0) {
      console.log(`Processed ${processedCount} lines...`);
    }
  }

  console.log(`\nTotal lines: ${lineCount}`);
  console.log(`Processed: ${processedCount}`);
}

async function processStdin(): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let processedCount = 0;

  for await (const line of rl) {
    lineCount++;
    await processLogLine(line);
    processedCount++;

    if (processedCount % 1000 === 0) {
      console.log(`Processed ${processedCount} lines...`);
    }
  }

  console.log(`\nTotal lines: ${lineCount}`);
  console.log(`Processed: ${processedCount}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help') {
    console.log(`
Usage:
  tsx script/import-analytics-from-logs.ts <log-file>
  tsx script/import-analytics-from-logs.ts --stdin

Examples:
  # Import from local file
  tsx script/import-analytics-from-logs.ts /var/log/nginx/access.log

  # Import from remote server via SSH
  ssh root@ctf.strayerraptors.com "cat /var/log/nginx/access.log" | tsx script/import-analytics-from-logs.ts --stdin

  # Import multiple log files (including rotated logs)
  ssh root@ctf.strayerraptors.com "zcat /var/log/nginx/access.log*.gz | cat - /var/log/nginx/access.log" | tsx script/import-analytics-from-logs.ts --stdin
`);
    process.exit(0);
  }

  console.log('Starting analytics import from nginx logs...\n');

  if (args[0] === '--stdin') {
    await processStdin();
  } else {
    const filePath = args[0];
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
    await processFile(filePath);
  }

  await pool.end();
  console.log('\nImport complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
