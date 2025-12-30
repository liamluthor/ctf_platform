# Database Migrations Guide

## Overview

raptorsCTF uses [Drizzle ORM](https://orm.drizzle.team/) for database management. Migrations are automatically generated from the schema file and applied to the database.

## Migration System

### Directory Structure

```
migrations/
├── 0000_classy_impossible_man.sql    # Initial migration
├── 0001_friendly_surge.sql            # Subsequent migrations
├── meta/
│   ├── 0000_snapshot.json             # Schema snapshots
│   ├── 0001_snapshot.json
│   └── _journal.json                  # Migration history
└── rollbacks/
    ├── add_owner_role.sql             # Manual rollback scripts
    └── rollback_private_events.sql
```

### Schema File

The single source of truth for the database schema is:
- `shared/schema.ts` - All tables, columns, and relationships

## Development Workflow

### Making Schema Changes

1. **Edit the schema file**
   ```bash
   # Edit shared/schema.ts
   # Add/modify tables, columns, or relationships
   ```

2. **Generate migration**
   ```bash
   npm run db:generate
   ```
   This creates a new migration file in `migrations/` with a timestamped name.

3. **Review the generated SQL**
   ```bash
   # Check the newly created migration file
   cat migrations/XXXX_migration_name.sql
   ```

4. **Apply migration**

   For **development**:
   ```bash
   npm run db:push
   ```
   This directly pushes schema changes to the database without creating migration files.

   For **production**:
   ```bash
   npm run db:migrate
   ```
   This applies pending migration files.

### Common Commands

```bash
# Generate migration from schema changes
npm run db:generate

# Push schema directly to database (development only)
npm run db:push

# Apply all pending migrations (production)
npm run db:migrate

# Open Drizzle Studio (database GUI)
npm run db:studio

# Seed test data
npm run db:seed

# Create admin user
npm run db:create-admin
```

## Production Deployment

### Fresh Installation

1. **Setup environment**
   ```bash
   # Create .env file with DATABASE_URL
   echo "DATABASE_URL=postgresql://user:pass@host:5432/dbname" > .env
   ```

2. **Run migrations**
   ```bash
   npm run db:generate  # Generate from schema
   npm run db:push      # Apply to database
   ```

3. **Create admin user**
   ```bash
   npm run db:create-admin
   ```

### Updating Existing Installation

1. **Pull latest code**
   ```bash
   git pull origin main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Generate and apply migrations**
   ```bash
   npm run db:generate
   npm run db:push
   ```

4. **Rebuild application**
   ```bash
   npm run build
   ```

5. **Restart service**
   ```bash
   sudo systemctl restart ctf-platform
   ```

## Migration Best Practices

### DO ✅

- **Always backup database before migrations**
  ```bash
  pg_dump -U ctf_admin ctf_platform > backup_$(date +%Y%m%d).sql
  ```

- **Test migrations in staging first**
  ```bash
  # Use separate database for testing
  DATABASE_URL=postgresql://localhost/ctf_staging npm run db:push
  ```

- **Review generated SQL before applying**
  ```bash
  cat migrations/latest_migration.sql
  ```

- **Keep migrations atomic** - One logical change per migration

- **Add comments to complex migrations**
  ```sql
  -- Migration: Add private events feature
  -- This allows event creators to hide events until a specific date
  ```

### DON'T ❌

- **Don't edit applied migrations** - Create a new migration instead
- **Don't use `db:push` in production** - Use `db:migrate` for proper versioning
- **Don't delete migration files** - They're needed for version history
- **Don't skip migrations** - Apply them in order

## Manual Migrations

For complex operations that can't be auto-generated:

1. **Create migration file manually**
   ```bash
   # Create in migrations/ directory
   touch migrations/XXXX_custom_migration.sql
   ```

2. **Write SQL**
   ```sql
   -- Migration: Custom operation
   ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_field TEXT;
   ```

3. **Update journal**
   Edit `migrations/meta/_journal.json` to include your migration

4. **Create rollback script**
   ```sql
   -- Rollback: Custom operation
   ALTER TABLE users DROP COLUMN IF EXISTS custom_field;
   ```
   Save in `migrations/rollbacks/`

## Rollback Procedures

### Using Rollback Scripts

```bash
# Identify the rollback script
ls migrations/rollbacks/

# Apply manually
psql -U ctf_admin ctf_platform < migrations/rollbacks/rollback_script.sql
```

### Point-in-Time Recovery

```bash
# Restore from backup
psql -U ctf_admin ctf_platform < backup_20250101.sql

# Or use pg_restore for compressed backups
pg_restore -U ctf_admin -d ctf_platform backup.dump
```

## Troubleshooting

### Migration Failed

1. **Check error message**
   ```bash
   npm run db:push 2>&1 | tee migration_error.log
   ```

2. **Verify database connectivity**
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Check current schema**
   ```bash
   npm run db:studio
   ```

4. **Rollback if needed**
   ```bash
   psql -U ctf_admin ctf_platform < migrations/rollbacks/latest.sql
   ```

### Out of Sync Schema

If your database schema is out of sync:

```bash
# Option 1: Force push (DESTRUCTIVE - use in development only)
npm run db:push -- --force

# Option 2: Drop and recreate (DESTRUCTIVE - will lose data)
npm run db:drop
npm run db:push

# Option 3: Manual reconciliation
# 1. Compare schema.ts with database
# 2. Write manual migration to align them
# 3. Apply migration
```

### Migration History Lost

If `_journal.json` is corrupted:

```bash
# Regenerate migrations from scratch
rm -rf migrations/
npm run db:generate
npm run db:push
```

**WARNING**: This should only be done in development. In production, manually restore the journal from backups.

## Advanced Topics

### Custom Seed Data

Create seed scripts in `scripts/seed-*.ts`:

```typescript
import { db } from "../server/db";
import { users } from "../shared/schema";

async function seed() {
  await db.insert(users).values({
    username: "testuser",
    email: "test@example.com",
    role: "user"
  });
}

seed();
```

Run with:
```bash
npx tsx scripts/seed-custom.ts
```

### Schema Introspection

View current database schema:

```bash
# Via Drizzle Studio (recommended)
npm run db:studio

# Via psql
psql -U ctf_admin ctf_platform -c "\d+"

# Generate schema from existing database
drizzle-kit introspect
```

### Performance Migrations

For large datasets:

```sql
-- Add index for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);

-- Analyze tables after major changes
ANALYZE users;
ANALYZE challenges;
```

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Drizzle Kit CLI](https://orm.drizzle.team/kit-docs/overview)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
