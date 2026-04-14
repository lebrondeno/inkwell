-- Quick auth check script
-- Run this to verify authentication status

-- Check current authentication context
SELECT 
    current_user as db_user,
    auth.uid() as authenticated_user_id,
    auth.role() as auth_role,
    auth.email() as user_email,
    CASE 
        WHEN auth.uid() IS NOT NULL THEN 'USER IS AUTHENTICATED'
        ELSE 'USER IS NOT AUTHENTICATED'
    END as auth_status;

-- Check if there are any users in the system
SELECT COUNT(*) as total_users FROM auth.users;

-- Check if there are any writer profiles
SELECT COUNT(*) as total_profiles FROM public.writer_profiles;
