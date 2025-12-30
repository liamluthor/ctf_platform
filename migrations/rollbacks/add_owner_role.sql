-- Migration: Add owner role and upgrade first admin
-- Date: 2025-12-28
-- Description: Introduces owner/admin/user role hierarchy and upgrades the first admin to owner

-- Step 1: Update the first admin user to owner role
-- This finds the oldest user with admin role and promotes them to owner
UPDATE users
SET role = 'owner'
WHERE id = (
  SELECT id
  FROM users
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1
);

-- Step 2: Add a comment to the role column for documentation
COMMENT ON COLUMN users.role IS 'User role: owner (platform owner), admin (administrator), or user (regular user)';

-- Verification query (uncomment to verify migration)
-- SELECT username, role, created_at FROM users WHERE role IN ('owner', 'admin') ORDER BY created_at ASC;
