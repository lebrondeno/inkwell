-- Final comprehensive profile picture verification
-- Run this to verify profile pictures are fully implemented

-- 1. Check if avatar_url column exists in writer_profiles
SELECT '=== Writer Profiles Schema ===' as info;
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'writer_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check existing profiles with avatar URLs
SELECT '=== Existing Profiles with Avatars ===' as info;
SELECT 
    id,
    full_name,
    CASE 
        WHEN avatar_url IS NOT NULL AND avatar_url != '' THEN 'HAS AVATAR'
        ELSE 'NO AVATAR'
    END as avatar_status,
    CASE 
        WHEN avatar_url IS NOT NULL AND avatar_url != '' THEN LEFT(avatar_url, 50) || '...'
        ELSE NULL
    END as avatar_preview,
    created_at
FROM public.writer_profiles
ORDER BY created_at DESC;

-- 3. Test profile picture queries (simulating what components do)
SELECT '=== Profile Query Test ===' as info;
-- Test getWriterProfile function simulation
SELECT 
    id, full_name, bio, avatar_url, created_at
FROM public.writer_profiles
LIMIT 3;

-- 4. Test comment profile queries (simulating what PublicArticle does)
SELECT '=== Comment Profile Query Test ===' as info;
SELECT 
    ac.id as comment_id,
    ac.body,
    wp.full_name,
    wp.avatar_url,
    CASE 
        WHEN wp.avatar_url IS NOT NULL AND wp.avatar_url != '' THEN 'HAS AVATAR'
        ELSE 'NO AVATAR'
    END as comment_avatar_status
FROM public.article_comments ac
LEFT JOIN public.writer_profiles wp ON ac.user_id = wp.id
LIMIT 5;

-- 5. Check RLS policies for writer_profiles
SELECT '=== Writer Profiles RLS Policies ===' as info;
SELECT 
    policyname,
    permissive,
    roles,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'Restriction: ' || substr(qual::text, 1, 100)
        ELSE 'No restriction'
    END as restriction
FROM pg_policies 
WHERE tablename = 'writer_profiles';

-- 6. Verify trigger functions include avatar_url
SELECT '=== Trigger Functions ===' as info;
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user'
AND routine_schema = 'public';
