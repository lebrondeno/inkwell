-- ═══════════════════════════════════════════════════════════
-- VERIFICATION SCRIPT - Run this to check your setup
-- ═══════════════════════════════════════════════════════════

-- 1. Check if the broken public policy still exists
SELECT EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE tablename = 'community_posts' 
  AND policyname = 'Approved posts are public'
) AS has_broken_policy;
-- Expected: FALSE (if migration already run)
-- If TRUE: You MUST run fix-community-privacy.sql

-- 2. Check if the new privacy policy exists
SELECT EXISTS (
  SELECT 1 FROM pg_policies 
  WHERE tablename = 'community_posts' 
  AND policyname = 'Community members can read posts'
) AS has_privacy_policy;
-- Expected: TRUE (after migration)
-- If FALSE: Run fix-community-privacy.sql

-- 3. List all current policies on community_posts
SELECT 
  policyname,
  cmd,
  qual::text as using_clause,
  with_check::text as with_check_clause
FROM pg_policies 
WHERE tablename = 'community_posts'
ORDER BY policyname;
-- Review to ensure privacy is enforced

-- 4. Check for orphaned pending posts (if notifications persist)
SELECT 
  cp.id,
  cp.status,
  cp.created_at,
  a.title as article_title,
  c.name as community_name
FROM community_posts cp
JOIN articles a ON a.id = cp.article_id
JOIN communities c ON c.id = cp.community_id
WHERE cp.status = 'pending'
ORDER BY cp.created_at DESC;
-- If you see old pending posts here, admins need to review them

-- 5. Count communities by admin
SELECT 
  c.name,
  c.slug,
  COUNT(DISTINCT cm.user_id) FILTER (WHERE cm.role = 'admin') as admin_count,
  COUNT(DISTINCT cm.user_id) as total_members
FROM communities c
LEFT JOIN community_members cm ON cm.community_id = c.id
GROUP BY c.id, c.name, c.slug
ORDER BY c.created_at DESC;
-- Each community should have at least 1 admin

-- 6. Test if non-members can see posts (SHOULD RETURN 0)
-- Replace YOUR_COMMUNITY_ID with an actual community ID
-- Run this while NOT authenticated
SELECT COUNT(*) as posts_visible_to_public
FROM community_posts
WHERE community_id = 'YOUR_COMMUNITY_ID' 
  AND status = 'approved';
-- Expected: 0 (after migration)
-- If > 0: Privacy policy is not working

-- ═══════════════════════════════════════════════════════════
-- QUICK HEALTH CHECK
-- ═══════════════════════════════════════════════════════════

-- Show summary of all communities
SELECT 
  c.name,
  c.category,
  c.created_at::date as created,
  (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as members,
  (SELECT COUNT(*) FROM community_posts WHERE community_id = c.id AND status = 'approved') as approved_posts,
  (SELECT COUNT(*) FROM community_posts WHERE community_id = c.id AND status = 'pending') as pending_posts
FROM communities c
ORDER BY c.created_at DESC;

-- ═══════════════════════════════════════════════════════════
-- If verification passes, your setup is correct!
-- ═══════════════════════════════════════════════════════════
