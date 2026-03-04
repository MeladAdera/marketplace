-- ─────────────────────────────────────────────────────────────
-- Migration: 012_add_user_tracking_and_invitation_constraints
-- Purpose: Add user tracking columns + invitation race condition protection
-- ─────────────────────────────────────────────────────────────

-- 1. Add tracking columns to users table
-- ─────────────────────────────────────────────────────────────

ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS invited_by_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by_id);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

-- Add comment for documentation
COMMENT ON COLUMN users.last_login_at IS 'Last time user successfully logged in';
COMMENT ON COLUMN users.invited_by_id IS 'User who invited this user (for audit trail)';

-- 2. Add unique constraint for pending invitations (Partial Index)
-- ─────────────────────────────────────────────────────────────
-- This prevents race conditions where two invitations are created
-- for the same email + organization simultaneously

-- Note: Partial indexes don't support IF NOT EXISTS in all PG versions
-- So we use a DO block to check first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'unique_pending_invitation'
  ) THEN
    CREATE UNIQUE INDEX unique_pending_invitation
    ON invitations(email, organization_id)
    WHERE status = 'pending';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON INDEX unique_pending_invitation IS 'Prevents duplicate pending invitations for same email+org';

-- 3. Add updated_at column to invitations (if not exists)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE invitations 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add trigger for updated_at (PostgreSQL doesn't support IF NOT EXISTS for triggers)
-- We use a DO block to check if trigger exists first
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_invitations_updated_at'
  ) THEN
    CREATE TRIGGER update_invitations_updated_at 
      BEFORE UPDATE ON invitations 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 4. Add organization_id index to invitations (for multi-tenant queries)
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_invitations_org_email 
ON invitations(organization_id, email);

-- ─────────────────────────────────────────────────────────────
-- Rollback Instructions
-- ─────────────────────────────────────────────────────────────
-- To rollback this migration:
-- 
-- DROP INDEX IF EXISTS unique_pending_invitation;
-- DROP INDEX IF EXISTS idx_invitations_org_email;
-- DROP INDEX IF EXISTS idx_users_invited_by;
-- DROP INDEX IF EXISTS idx_users_last_login;
-- ALTER TABLE users DROP COLUMN IF EXISTS last_login_at;
-- ALTER TABLE users DROP COLUMN IF EXISTS invited_by_id;
-- ALTER TABLE invitations DROP COLUMN IF EXISTS updated_at;
-- DROP TRIGGER IF EXISTS update_invitations_updated_at ON invitations;
-- ─────────────────────────────────────────────────────────────