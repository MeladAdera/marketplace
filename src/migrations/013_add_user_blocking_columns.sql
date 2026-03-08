-- Add blocking-related columns to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS blocked_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked);
CREATE INDEX IF NOT EXISTS idx_users_blocked_by ON users(blocked_by);