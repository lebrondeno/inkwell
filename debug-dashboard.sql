-- Debug script: Check why user can't see dashboard
-- Run this to verify authentication and routing

-- 1. Check current authentication status
SELECT '=== Current Authentication Status ===' as info;
SELECT 
    current_user as db_user,
    auth.uid() as authenticated_user_id,
    auth.role() as auth_role,
    auth.email() as user_email,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'USER IS AUTHENTICATED'
        ELSE 'USER IS NOT AUTHENTICATED'
    END as auth_status;

-- 2. Check if user has writer profile
SELECT '=== User Profile Check ===' as info;
SELECT 
    CASE 
        WHEN wp.id IS NOT NULL THEN 'HAS WRITER PROFILE'
        ELSE 'NO WRITER PROFILE'
    END as profile_status,
    wp.full_name,
    wp.avatar_url
FROM auth.users u
LEFT JOIN public.writer_profiles wp ON u.id = wp.id
WHERE u.id = auth.uid();

-- 3. Check if there are any articles for this user
SELECT '=== User Articles Check ===' as info;
SELECT 
    COUNT(*) as article_count,
    MAX(created_at) as last_article_date
FROM public.articles 
WHERE user_id = auth.uid();

-- 4. Test dashboard route access
SELECT '=== Route Access Test ===' as info;
-- This simulates what happens when user tries to access dashboard
-- The dashboard should be accessible if user is authenticated
SELECT 
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'DASHBOARD ACCESS: ALLOWED'
        ELSE 'DASHBOARD ACCESS: DENIED'
    END as dashboard_access;

-- 5. Check session information
SELECT '=== Session Information ===' as info;
SELECT 
    id,
    email,
    created_at,
    last_sign_in_at,
    raw_user_meta_data
FROM auth.sessions
WHERE user_id = auth.uid()
ORDER BY created_at DESC
LIMIT 1;
