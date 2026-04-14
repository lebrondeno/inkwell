-- Test script: Debug comments with real data
-- Run this in your Supabase SQL Editor to test comment functionality

-- 1. Get real article and user IDs from your database
SELECT '=== Available Articles ===' as info;
SELECT 
    id as article_id,
    title,
    user_id,
    status,
    created_at
FROM public.articles 
WHERE status = 'published'
ORDER BY created_at DESC
LIMIT 5;

SELECT '=== Available Users ===' as info;
SELECT 
    id as user_id,
    full_name,
    created_at
FROM public.writer_profiles
ORDER BY created_at DESC
LIMIT 5;

-- 2. Check existing comments
SELECT '=== Existing Comments ===' as info;
SELECT 
    ac.id,
    ac.article_id,
    ac.user_id,
    ac.body,
    ac.created_at,
    wp.full_name as author_name,
    a.title as article_title
FROM public.article_comments ac
LEFT JOIN public.writer_profiles wp ON ac.user_id = wp.id
LEFT JOIN public.articles a ON ac.article_id = a.id
ORDER BY ac.created_at DESC
LIMIT 10;

-- 3. Test comment insertion with real data
-- Replace the IDs below with actual IDs from the queries above
DO $$
DECLARE
    -- Replace these with real IDs from your database
    test_article_id UUID := (SELECT id FROM public.articles WHERE status = 'published' LIMIT 1);
    test_user_id UUID := (SELECT id FROM public.writer_profiles LIMIT 1);
    result RECORD;
    article_exists BOOLEAN;
    user_exists BOOLEAN;
BEGIN
    -- Check if article and user exist
    SELECT EXISTS(SELECT 1 FROM public.articles WHERE id = test_article_id) INTO article_exists;
    SELECT EXISTS(SELECT 1 FROM public.writer_profiles WHERE id = test_user_id) INTO user_exists;
    
    RAISE NOTICE 'Article exists: %, User exists: %', article_exists, user_exists;
    RAISE NOTICE 'Using article_id: %, user_id: %', test_article_id, test_user_id;
    
    IF article_exists AND user_exists THEN
        -- Try to insert a test comment
        INSERT INTO public.article_comments (article_id, user_id, body)
        VALUES (test_article_id, test_user_id, 'Test comment for debugging - ' || now())
        ON CONFLICT DO NOTHING
        RETURNING id, created_at INTO result;
        
        IF result.id IS NOT NULL THEN
            RAISE NOTICE 'SUCCESS: Test comment inserted! ID=%, Created=%', result.id, result.created_at;
            
            -- Clean up test comment immediately
            DELETE FROM public.article_comments WHERE id = result.id;
            RAISE NOTICE 'Test comment cleaned up successfully';
        ELSE
            RAISE NOTICE 'Comment insertion failed (possible duplicate or constraint violation)';
        END IF;
    ELSE
        RAISE NOTICE 'Cannot test: No published articles or users found';
    END IF;
END $$;

-- 4. Check RLS policies
SELECT '=== RLS Policies ===' as info;
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
WHERE tablename = 'article_comments';

-- 5. Test authentication context
SELECT '=== Authentication Context ===' as info;
SELECT 
    current_user as authenticated_user, 
    auth.uid() as auth_uid,
    auth.role() as auth_role,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'User is authenticated'
        ELSE 'User is NOT authenticated'
    END as auth_status;
