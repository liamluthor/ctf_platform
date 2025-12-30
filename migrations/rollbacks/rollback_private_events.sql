-- Rollback Migration: Remove private event support
-- Date: 2025-12-28
-- Description: Removes isPrivate and inviteCode columns from ctf_events table

-- WARNING: This will delete all invite codes and reset private status

-- Remove invite_code column
ALTER TABLE ctf_events
DROP COLUMN IF EXISTS invite_code;

-- Remove is_private column
ALTER TABLE ctf_events
DROP COLUMN IF EXISTS is_private;
