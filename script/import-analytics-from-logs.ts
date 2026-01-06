#!/usr/bin/env tsx
/**
 * Import analytics data from nginx access logs
 *
 * Usage:
 *   tsx script/import-analytics-from-logs.ts [--dry-run] [--skip-duplicate-check] <log-file>
 *   tsx script/import-analytics-from-logs.ts --stdin [--dry-run] [--skip-duplicate-check]
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { pageViews, errorLogs } from "../shared/schema";
import { and, eq, sql } from "drizzle-orm";
import * as schema from "../shared/schema";
import pg from "pg";
import * as fs from "fs";
import * as readline from "readline";
import { createGunzip } from "zlib";

const { Pool } = pg;

// Database connection
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// Nginx log line regex (combined format)
// Example: 103.203.57.3 - - [06/Jan/2026:00:00:59 +0000] "GET / HTTP/1.1" 301 178 "-" "Mozilla/5.0 zgrab/0.x"
const LOG_REGEX = /^(\S+) - - \[([^\]]+)\] "(\S+) ([^"]*) HTTP\/[^"]*" (\d+) (\d+) "([^"]*)" "([^"]*)"/;

interface ParsedLogEntry {
  ipAddress: string;
  timestamp: Date;
  method: string;
  path: string;
  statusCode: number;
  bytes: number;
  referer: string | null;
  userAgent: string | null;
  ctfEventId: number | null;
  challengeId: number | null;
}

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
  if (!parts) {
    throw new Error(`Invalid nginx timestamp: ${timestamp}`);
  }

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
         /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|map|txt|xml|webp)$/i.test(path) ||
         path.startsWith("/@") ||
         path.includes("/.vite") ||
         path.includes("/node_modules");
}

function parseLogLine(line: string): ParsedLogEntry | null {
  const match = line.match(LOG_REGEX);
  if (!match) {
    return null;
  }

  const [, ipAddress, timestamp, method, path, statusCode, bytes, referer, userAgent] = match;
  const { ctfEventId, challengeId } = extractIds(path);

  return {
    ipAddress,
    timestamp: parseNginxTimestamp(timestamp),
    method,
    path: path || '/',
    statusCode: parseInt(statusCode, 10),
    bytes: parseInt(bytes, 10),
    referer: referer === '-' ? null : referer,
    userAgent: userAgent === '-' ? null : userAgent,
    ctfEventId,
    challengeId,
  };
}

async function checkDuplicatePageView(ipAddress: string, path: string, timestamp: Date): Promise<boolean> {
  // Check if this exact entry already exists (within 1 second)
  const result = await db
    .select({ id: pageViews.id })
    .from(pageViews)
    .where(
      and(
        eq(pageViews.ipAddress, ipAddress),
        eq(pageViews.path, path),
        sql`${pageViews.timestamp} BETWEEN ${timestamp}::timestamp - interval '1 second' AND ${timestamp}::timestamp + interval '1 second'`
      )
    )
    .limit(1);

  return result.length > 0;
}

async function checkDuplicateErrorLog(ipAddress: string, path: string, timestamp: Date): Promise<boolean> {
  // Check if this exact entry already exists (within 1 second)
  const result = await db
    .select({ id: errorLogs.id })
    .from(errorLogs)
    .where(
      and(
        eq(errorLogs.ipAddress, ipAddress),
        eq(errorLogs.path, path),
        sql`${errorLogs.timestamp} BETWEEN ${timestamp}::timestamp - interval '1 second' AND ${timestamp}::timestamp + interval '1 second'`
      )
    )
    .limit(1);

  return result.length > 0;
}

async function processEntries(
  entries: ParsedLogEntry[],
  dryRun: boolean,
  checkDuplicates: boolean
): Promise<{ pageViews: number; errors: number; duplicates: number }> {
  let totalPageViews = 0;
  let totalErrors = 0;
  let totalDuplicates = 0;

  if (!dryRun) {
    // Process entries and check for duplicates
    for (const entry of entries) {
      let isDuplicate = false;

      if (checkDuplicates) {
        if (entry.statusCode >= 400) {
          isDuplicate = await checkDuplicateErrorLog(entry.ipAddress, entry.path, entry.timestamp);
        } else {
          isDuplicate = await checkDuplicatePageView(entry.ipAddress, entry.path, entry.timestamp);
        }
      }

      if (isDuplicate) {
        totalDuplicates++;
        continue;
      }

      // Insert non-duplicate entries
      if (entry.statusCode >= 400) {
        totalErrors++;
        await db.insert(errorLogs).values({
          userId: null,
          ctfEventId: entry.ctfEventId,
          challengeId: entry.challengeId,
          ipAddress: entry.ipAddress,
          path: entry.path,
          method: entry.method,
          statusCode: entry.statusCode,
          errorMessage: null,
          userAgent: entry.userAgent,
          referer: entry.referer,
          timestamp: entry.timestamp,
        });
      } else {
        totalPageViews++;
        await db.insert(pageViews).values({
          userId: null,
          ctfEventId: entry.ctfEventId,
          challengeId: entry.challengeId,
          ipAddress: entry.ipAddress,
          path: entry.path,
          method: entry.method,
          statusCode: entry.statusCode,
          userAgent: entry.userAgent,
          referer: entry.referer,
          responseTime: null,
          timestamp: entry.timestamp,
        });
      }
    }
  } else {
    // Dry run - just count what we would insert
    for (const entry of entries) {
      if (entry.statusCode >= 400) {
        totalErrors++;
      } else {
        totalPageViews++;
      }
    }
  }

  return { pageViews: totalPageViews, errors: totalErrors, duplicates: totalDuplicates };
}

async function processFile(
  filePath: string,
  dryRun: boolean,
  checkDuplicates: boolean
): Promise<{ pageViews: number; errors: number; skipped: number; duplicates: number }> {
  return new Promise((resolve, reject) => {
    let readStream = fs.createReadStream(filePath);

    // Handle gzipped files
    if (filePath.endsWith('.gz')) {
      readStream = readStream.pipe(createGunzip());
    }

    const rl = readline.createInterface({
      input: readStream,
      crlfDelay: Infinity,
    });

    const entries: ParsedLogEntry[] = [];
    let totalSkipped = 0;
    let processedCount = 0;

    rl.on('line', (line) => {
      const entry = parseLogLine(line);
      if (!entry) {
        return;
      }

      // Skip static files
      if (isStaticFile(entry.path)) {
        totalSkipped++;
        return;
      }

      entries.push(entry);
      processedCount++;

      if (processedCount % 1000 === 0) {
        process.stdout.write(`\r  Parsed ${processedCount} entries...`);
      }
    });

    rl.on('close', async () => {
      try {
        if (processedCount > 0) {
          process.stdout.write('\n');
        }

        const stats = await processEntries(entries, dryRun, checkDuplicates);

        resolve({
          pageViews: stats.pageViews,
          errors: stats.errors,
          skipped: totalSkipped,
          duplicates: stats.duplicates,
        });
      } catch (error) {
        reject(error);
      }
    });

    rl.on('error', reject);
  });
}

async function processStdin(
  dryRun: boolean,
  checkDuplicates: boolean
): Promise<{ pageViews: number; errors: number; skipped: number; duplicates: number }> {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  const entries: ParsedLogEntry[] = [];
  let totalSkipped = 0;
  let processedCount = 0;

  for await (const line of rl) {
    const entry = parseLogLine(line);
    if (!entry) {
      continue;
    }

    // Skip static files
    if (isStaticFile(entry.path)) {
      totalSkipped++;
      continue;
    }

    entries.push(entry);
    processedCount++;

    if (processedCount % 1000 === 0) {
      process.stdout.write(`\r  Parsed ${processedCount} entries...`);
    }
  }

  if (processedCount > 0) {
    process.stdout.write('\n');
  }

  const stats = await processEntries(entries, dryRun, checkDuplicates);

  return {
    pageViews: stats.pageViews,
    errors: stats.errors,
    skipped: totalSkipped,
    duplicates: stats.duplicates,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipDuplicateCheck = args.includes('--skip-duplicate-check');
  const useStdin = args.includes('--stdin');
  const logFiles = args.filter(arg => !arg.startsWith('--'));

  if (!useStdin && logFiles.length === 0) {
    console.log(`
Usage:
  tsx script/import-analytics-from-logs.ts [--dry-run] [--skip-duplicate-check] <log-file-1> [log-file-2] ...
  tsx script/import-analytics-from-logs.ts --stdin [--dry-run] [--skip-duplicate-check]

Examples:
  # Import from local file
  tsx script/import-analytics-from-logs.ts /var/log/nginx/access.log

  # Import from remote server via SSH
  ssh root@ctf.strayerraptors.com "cat /var/log/nginx/access.log" | tsx script/import-analytics-from-logs.ts --stdin

  # Import multiple log files (including rotated logs)
  ssh root@ctf.strayerraptors.com "zcat /var/log/nginx/access.log*.gz | cat - /var/log/nginx/access.log" | tsx script/import-analytics-from-logs.ts --stdin

  # Dry run to preview what would be imported
  tsx script/import-analytics-from-logs.ts --dry-run --stdin < /var/log/nginx/access.log

Options:
  --dry-run                Preview what would be inserted without actually inserting
  --skip-duplicate-check   Skip duplicate checking (faster, but may create duplicates)
  --stdin                  Read from standard input instead of file
`);
    process.exit(0);
  }

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be inserted\n');
  }

  if (skipDuplicateCheck && !dryRun) {
    console.log('⚠️  WARNING: Duplicate checking disabled - may create duplicate entries\n');
  }

  console.log('Starting analytics import from nginx logs...\n');

  let totalPageViews = 0;
  let totalErrors = 0;
  let totalSkipped = 0;
  let totalDuplicates = 0;

  if (useStdin) {
    console.log('📄 Processing stdin...');
    const stats = await processStdin(dryRun, !skipDuplicateCheck);
    totalPageViews += stats.pageViews;
    totalErrors += stats.errors;
    totalSkipped += stats.skipped;
    totalDuplicates += stats.duplicates;

    console.log(`  ✅ Page views: ${stats.pageViews}`);
    console.log(`  ❌ Errors: ${stats.errors}`);
    if (stats.duplicates > 0) {
      console.log(`  🔄 Duplicates: ${stats.duplicates}`);
    }
    console.log(`  ⏭️  Skipped (static): ${stats.skipped}`);
  } else {
    for (const logFile of logFiles) {
      console.log(`\n📄 Processing: ${logFile}`);
      if (!fs.existsSync(logFile)) {
        console.error(`  ❌ Error: File not found: ${logFile}`);
        continue;
      }

      try {
        const stats = await processFile(logFile, dryRun, !skipDuplicateCheck);
        totalPageViews += stats.pageViews;
        totalErrors += stats.errors;
        totalSkipped += stats.skipped;
        totalDuplicates += stats.duplicates;

        console.log(`  ✅ Page views: ${stats.pageViews}`);
        console.log(`  ❌ Errors: ${stats.errors}`);
        if (stats.duplicates > 0) {
          console.log(`  🔄 Duplicates: ${stats.duplicates}`);
        }
        console.log(`  ⏭️  Skipped (static): ${stats.skipped}`);
      } catch (error) {
        console.error(`  ❌ Error processing ${logFile}:`, error);
      }
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Total page views: ${totalPageViews}`);
  console.log(`  Total errors: ${totalErrors}`);
  if (totalDuplicates > 0) {
    console.log(`  Total duplicates: ${totalDuplicates}`);
  }
  console.log(`  Total skipped: ${totalSkipped}`);
  console.log(`  Grand total processed: ${totalPageViews + totalErrors + totalDuplicates + totalSkipped}`);

  if (dryRun) {
    console.log('\n💡 Run without --dry-run to insert data into the database');
  } else {
    console.log('\n✅ Import complete!');
  }

  await pool.end();
}

main().catch(async (error) => {
  console.error('Fatal error:', error);
  await pool.end();
  process.exit(1);
});
