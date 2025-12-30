-- Rollback Migration: Remove owner role
-- Date: 2025-12-28
-- Description: Downgrades owner back to admin role

-- WARNING: This will convert the owner account back to a regular admin

-- Step 1: Downgrade owner to admin
UPDATE users
SET role = 'admin'
WHERE role = 'owner';

-- Step 2: Remove comment from role column
COMMENT ON COLUMN users.role IS NULL;

-- Verification query (uncomment to verify rollback)
-- SELECT username, role, created_at FROM users WHERE role IN ('owner', 'admin') ORDER BY created_at ASC;
