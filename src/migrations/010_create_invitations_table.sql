-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email CITEXT NOT NULL, -- CITEXT handles case-insensitivity
    role VARCHAR(50) NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE, -- 🔒 Changed from token to token_hash
    expires_at TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    invited_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMP,
    revoked_at TIMESTAMP,
    
    CONSTRAINT check_invitation_status CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    CONSTRAINT check_invitation_role CHECK (role IN ('vendor_admin', 'vendor_staff'))
);

-- 🔒 Partial Unique Index: Prevent duplicate PENDING invitations for same email+org
CREATE UNIQUE INDEX idx_invitations_org_email_pending 
ON invitations(organization_id, LOWER(email)) 
WHERE status = 'pending';

-- Create indexes for performance
CREATE INDEX idx_invitations_token_hash ON invitations(token_hash);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_organization_id ON invitations(organization_id);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);