-- ═══════════════════════════════════════════════════════════
-- CRITICAL FIX: Make community posts private (members-only)
-- Run this in your Supabase SQL Editor IMMEDIATELY
-- ═══════════════════════════════════════════════════════════

-- Drop the broken public policy that allows anyone to read approved posts
DROP POLICY IF EXISTS "Approved posts are public" ON public.community_posts;

-- Create new policy: only community members can see approved posts
CREATE POLICY "Community members can read posts"
  ON public.community_posts FOR SELECT
  USING (
    -- Members of the community can see approved posts
    (status = 'approved' AND EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
    ))
    -- Submitters can see their own pending/rejected posts
    OR auth.uid() = submitted_by
    -- Admins can see everything in their communities
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- DONE. Community posts are now private to members only.
-- Non-members cannot see any community articles.
-- ═══════════════════════════════════════════════════════════
