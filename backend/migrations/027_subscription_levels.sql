-- Migration: Add subscription levels system
-- This migration adds subscription level tracking to profiles and creates the upgrade_requests table

-- Add subscription fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_level VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS posts_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS posts_month_reset TIMESTAMP WITH TIME ZONE;

-- Set default values for existing profiles
UPDATE profiles 
SET subscription_level = 'free',
    posts_this_month = 0,
    posts_month_reset = NOW()
WHERE subscription_level IS NULL;

-- Create upgrade_requests table
CREATE TABLE IF NOT EXISTS upgrade_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    current_level VARCHAR(20) NOT NULL,
    requested_level VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    admin_notes TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user_id ON upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status ON upgrade_requests(status);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_created_at ON upgrade_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_level ON profiles(subscription_level);

-- Add constraint to ensure valid subscription levels
ALTER TABLE profiles
ADD CONSTRAINT check_subscription_level 
CHECK (subscription_level IN ('free', 'starter', 'creator', 'pro'));

-- Add constraint to ensure valid upgrade request status
ALTER TABLE upgrade_requests
ADD CONSTRAINT check_upgrade_request_status 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add constraint to ensure valid requested levels
ALTER TABLE upgrade_requests
ADD CONSTRAINT check_upgrade_request_levels 
CHECK (requested_level IN ('free', 'starter', 'creator', 'pro') 
   AND current_level IN ('free', 'starter', 'creator', 'pro'));

-- Enable RLS on upgrade_requests
ALTER TABLE upgrade_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for upgrade_requests
-- Users can view their own requests
CREATE POLICY "Users can view own upgrade requests"
ON upgrade_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own requests
CREATE POLICY "Users can create own upgrade requests"
ON upgrade_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role full access to upgrade_requests"
ON upgrade_requests FOR ALL
USING (auth.role() = 'service_role');
