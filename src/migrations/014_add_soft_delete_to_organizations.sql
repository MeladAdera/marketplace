-- src/migrations/014_add_soft_delete_to_organizations.sql
ALTER TABLE organizations 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_organizations_deleted_at ON organizations(deleted_at);