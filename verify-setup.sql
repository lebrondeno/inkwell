-- Verification script: Check if profile pictures and comments are properly configured
-- Run this in your Supabase SQL Editor to verify everything is working

-- 1. Check if writer_profiles table has avatar_url column
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'writer_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if comments table exists and has proper structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'article_comments' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check RLS policies for writer_profiles
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'writer_profiles';

-- 4. Check RLS policies for article_comments
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'article_comments';

-- 5. Test if we can read writer profiles (should return rows)
SELECT COUNT(*) as profile_count FROM public.writer_profiles;

-- 6. Test if we can read comments (should return rows)
SELECT COUNT(*) as comment_count FROM public.article_comments;

-- 7. Check if triggers exist for updated_at
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_condition,
    action_statement
FROM information_schema.triggers
WHERE trigger_name LIKE '%updated_at%'
ORDER BY event_object_table, trigger_name;
