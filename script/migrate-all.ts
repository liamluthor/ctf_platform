import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";
import * as schema from "../shared/schema";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { config } from "dotenv";

// Load .env file automatically
config();

const { Pool } = pg;

async function migrateAll() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  console.log("🔄 Checking for pending migrations...");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool, { schema });

  try {
    // Create migration tracking table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Get list of migration files
    const migrationsDir = join(process.cwd(), "migrations");
    const files = await readdir(migrationsDir);
    const sqlFiles = files
      .filter(f => f.endsWith('.sql') && !f.includes('meta'))
      .sort(); // Sort to apply in order

    if (sqlFiles.length === 0) {
      console.log("✅ No migration files found");
      return;
    }

    // Get already applied migrations
    const appliedResult = await db.execute(sql`
      SELECT name FROM migrations ORDER BY executed_at;
    `);
    const appliedMigrations = new Set(appliedResult.rows.map((r: any) => r.name));

    // Find pending migrations
    const pendingMigrations = sqlFiles.filter(f => {
      const migrationName = f.replace('.sql', '');
      return !appliedMigrations.has(migrationName);
    });

    if (pendingMigrations.length === 0) {
      console.log("✅ No pending migrations - database is up to date");
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s):`);
    pendingMigrations.forEach(m => console.log(`   - ${m}`));

    // Apply each pending migration
    for (const migrationFile of pendingMigrations) {
      const migrationName = migrationFile.replace('.sql', '');
      console.log(`\n🔧 Applying: ${migrationName}`);

      const migrationPath = join(migrationsDir, migrationFile);
      const migrationSQL = await readFile(migrationPath, "utf-8");

      // Split by statement-breakpoint and execute each statement
      const statements = migrationSQL
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await db.execute(sql.raw(statement));
          } catch (error: any) {
            // Ignore "already exists" errors for idempotency
            if (error.code === '42P07' || error.code === '42710') {
              console.log(`   ⚠️  Skipping: ${error.message.split('\n')[0]}`);
              continue;
            }
            throw error;
          }
        }
      }

      // Record migration
      await db.execute(sql`
        INSERT INTO migrations (name) VALUES (${migrationName})
        ON CONFLICT (name) DO NOTHING;
      `);

      console.log(`   ✅ Applied: ${migrationName}`);
    }

    console.log(`\n✅ Successfully applied ${pendingMigrations.length} migration(s)`);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateAll();
