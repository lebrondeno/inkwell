-- Migration: Add avatar_url column to writer_profiles table
-- Run this in your Supabase SQL Editor to add profile picture support

-- Add avatar_url column if it doesn't exist
ALTER TABLE public.writer_profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';

-- Update the trigger function to include avatar_url
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.writer_profiles (id, full_name, bio, avatar_url)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'bio', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', '')
  )
  ON CONFLICT (id) DO UPDATE
    SET full_name = excluded.full_name,
        bio = excluded.bio,
        avatar_url = excluded.avatar_url,
        updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the column was added successfully
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'writer_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;
