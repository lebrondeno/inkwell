-- ═══════════════════════════════════════════════════════════
-- FIX: Community Privacy & RLS Policies
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. Drop the broken "public posts" policy ─────────────
DROP POLICY IF EXISTS "Approved posts are public" ON public.community_posts;

-- ── 2. Create proper member-only read policy ─────────────
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
    -- Admins can see everything in their community
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- Migration complete. Community posts are now private.
-- Only members can see approved posts.
-- ═══════════════════════════════════════════════════════════
