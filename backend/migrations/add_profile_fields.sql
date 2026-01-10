-- Migration: Add comprehensive profile fields
-- Created: 2025-12-25
-- Description: Adds personal, contact, professional, and social media fields to profiles table

-- Personal Information
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthdate VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS marital_status VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS nationality VARCHAR;

-- Contact Information
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website VARCHAR;

-- Professional Information
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS industry VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS education VARCHAR;

-- Social Media Links
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS github_username VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR;

-- Additional Information
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS languages VARCHAR;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS interests TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.birthdate IS 'Date of birth in YYYY-MM-DD format';
COMMENT ON COLUMN profiles.gender IS 'Gender (Male, Female, Non-binary, Other, Prefer not to say)';
COMMENT ON COLUMN profiles.marital_status IS 'Marital status (Single, Married, Divorced, Widowed, etc.)';
COMMENT ON COLUMN profiles.nationality IS 'Nationality or citizenship';
COMMENT ON COLUMN profiles.phone IS 'Phone number';
COMMENT ON COLUMN profiles.email IS 'Email address (additional to auth email)';
COMMENT ON COLUMN profiles.website IS 'Personal website URL';
COMMENT ON COLUMN profiles.occupation IS 'Job title or occupation';
COMMENT ON COLUMN profiles.company IS 'Company or organization';
COMMENT ON COLUMN profiles.industry IS 'Industry sector';
COMMENT ON COLUMN profiles.education IS 'Highest education level or institution';
COMMENT ON COLUMN profiles.twitter_handle IS 'Twitter/X username';
COMMENT ON COLUMN profiles.linkedin_url IS 'LinkedIn profile URL';
COMMENT ON COLUMN profiles.github_username IS 'GitHub username';
COMMENT ON COLUMN profiles.instagram_handle IS 'Instagram username';
COMMENT ON COLUMN profiles.languages IS 'Languages spoken (comma-separated or JSON)';
COMMENT ON COLUMN profiles.interests IS 'Personal interests and hobbies';










