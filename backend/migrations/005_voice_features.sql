-- Migration: Add voice features support
-- Description: Adds fields and storage buckets for voice recording features
-- Date: 2025-12-22

-- Add voice-related fields to Avee table
ALTER TABLE avees ADD COLUMN IF NOT EXISTS voice_sample_url TEXT;
ALTER TABLE avees ADD COLUMN IF NOT EXISTS preferred_tts_voice VARCHAR(20) DEFAULT 'alloy';
ALTER TABLE avees ADD COLUMN IF NOT EXISTS voice_generated_at TIMESTAMPTZ;

-- Add voice-related fields to profiles table (for user's own voice preferences)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_tts_voice VARCHAR(20) DEFAULT 'alloy';

-- Create storage bucket for voice recordings (run this in Supabase Dashboard SQL Editor)
-- Note: This is a Supabase-specific command, may need to be run separately
/*
INSERT INTO storage.buckets (id, name, public)
VALUES ('voice-recordings', 'voice-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for voice-recordings bucket
CREATE POLICY "Users can upload their own voice recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'voice-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own voice recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'voice-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own voice recordings"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'voice-recordings' AND (storage.foldername(name))[1] = auth.uid()::text);
*/

-- Create table for tracking voice transcriptions (optional, for analytics)
CREATE TABLE IF NOT EXISTS voice_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    avee_id UUID REFERENCES avees(id) ON DELETE SET NULL,
    audio_duration INTEGER, -- in seconds
    transcription_text TEXT NOT NULL,
    detected_language VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_user_id ON voice_transcriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_transcriptions_avee_id ON voice_transcriptions(avee_id);

-- Add comments for documentation
COMMENT ON COLUMN avees.voice_sample_url IS 'URL to the original voice recording used to generate this Avee profile';
COMMENT ON COLUMN avees.preferred_tts_voice IS 'Preferred TTS voice for this Avee (alloy, echo, fable, onyx, nova, shimmer)';
COMMENT ON COLUMN avees.voice_generated_at IS 'Timestamp when the profile was generated from voice';
COMMENT ON TABLE voice_transcriptions IS 'Tracks all voice transcriptions for analytics and debugging';

