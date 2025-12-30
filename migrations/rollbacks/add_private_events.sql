-- Migration: Add private event support to ctf_events table
-- Date: 2025-12-28
-- Description: Adds isPrivate boolean and inviteCode columns for private CTF events

-- Add is_private column (defaults to false for existing events)
ALTER TABLE ctf_events
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false NOT NULL;

-- Add invite_code column (nullable, unique)
ALTER TABLE ctf_events
ADD COLUMN IF NOT EXISTS invite_code varchar(8) UNIQUE;

-- Add comment for documentation
COMMENT ON COLUMN ctf_events.is_private IS 'Whether this CTF event is private and requires an invite code';
COMMENT ON COLUMN ctf_events.invite_code IS 'Unique 8-character invite code for private events';
