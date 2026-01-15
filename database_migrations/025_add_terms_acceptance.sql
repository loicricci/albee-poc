-- Migration: Add Terms & Conditions acceptance tracking to profiles
-- Required for EU GDPR compliance and audit trail

-- Add T&C acceptance columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version VARCHAR(50),
ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS privacy_version VARCHAR(50);

-- Add comment for documentation
COMMENT ON COLUMN profiles.terms_accepted_at IS 'Timestamp when user accepted Terms and Conditions (GDPR compliance)';
COMMENT ON COLUMN profiles.terms_version IS 'Version identifier of T&C accepted (e.g., 2026-01-15)';
COMMENT ON COLUMN profiles.privacy_accepted_at IS 'Timestamp when user accepted Privacy Policy (GDPR compliance)';
COMMENT ON COLUMN profiles.privacy_version IS 'Version identifier of Privacy Policy accepted';

-- Create index for compliance auditing (find users who need to re-accept updated terms)
CREATE INDEX IF NOT EXISTS idx_profiles_terms_version ON profiles(terms_version);
CREATE INDEX IF NOT EXISTS idx_profiles_privacy_version ON profiles(privacy_version);

-- Backfill existing profiles with acceptance timestamp = created_at
-- This assumes existing users implicitly accepted terms when they signed up
-- For strict compliance, you may want to leave these NULL and require re-acceptance
UPDATE profiles 
SET 
    terms_accepted_at = created_at,
    terms_version = '2026-01-15',
    privacy_accepted_at = created_at,
    privacy_version = '2026-01-15'
WHERE terms_accepted_at IS NULL;
