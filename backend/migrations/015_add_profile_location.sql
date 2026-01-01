-- Add location fields to profiles table for native agents contextualization
-- This enables weather agents and other location-based services

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS latitude TEXT,
  ADD COLUMN IF NOT EXISTS longitude TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT;

COMMENT ON COLUMN profiles.location IS 'User location (city name or formatted address)';
COMMENT ON COLUMN profiles.latitude IS 'Geographic latitude for weather and location-based services';
COMMENT ON COLUMN profiles.longitude IS 'Geographic longitude for weather and location-based services';
COMMENT ON COLUMN profiles.timezone IS 'IANA timezone identifier (e.g., America/New_York)';





