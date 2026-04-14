-- ═══════════════════════════════════════════════════════════
-- INKWELL — Bug-Fix Migration (run after v1 + v2 schemas)
-- Paste into Supabase SQL Editor and click Run
-- ═══════════════════════════════════════════════════════════

-- ── 1. Ensure view_count column exists ───────────────────
-- (may be missing if supabase-schema.sql wasn't run in full)
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;

-- ── 2. Ensure avatar_url exists on writer_profiles ───────
ALTER TABLE public.writer_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

-- ── 3. Ensure bible_verse column exists on articles ──────
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS bible_verse text DEFAULT '';

-- ── 4. Re-create increment_view as SECURITY DEFINER ──────
-- This lets anon users increment views without owning the row.
CREATE OR REPLACE FUNCTION public.increment_view(article_slug text)
RETURNS void AS $$
BEGIN
  UPDATE public.articles
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE slug = article_slug AND status = 'published';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 5. RLS — Public can read published articles ───────────
-- Drop and re-create to ensure it exists correctly.
DROP POLICY IF EXISTS "Public can view published articles" ON public.articles;
CREATE POLICY "Public can view published articles"
  ON public.articles FOR SELECT
  USING (status = 'published' OR auth.uid() = user_id);

-- ── 6. RLS — Public can read all writer profiles ─────────
DROP POLICY IF EXISTS "Public can view writer profiles" ON public.writer_profiles;
CREATE POLICY "Public can view writer profiles"
  ON public.writer_profiles FOR SELECT
  USING (true);

-- ── 7. RLS — Community: approved posts are public ────────
-- Fixes community articles not loading for non-members.
DROP POLICY IF EXISTS "Approved posts are public" ON public.community_posts;
CREATE POLICY "Approved posts are public"
  ON public.community_posts FOR SELECT
  USING (
    status = 'approved'
    OR auth.uid() = submitted_by
    OR EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ── 8. RLS — Avatars storage bucket ──────────────────────
-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- Drop old storage policies (safe re-run)
DROP POLICY IF EXISTS "Users can upload avatars"   ON storage.objects;
DROP POLICY IF EXISTS "Avatars are public"          ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;

CREATE POLICY "Avatars are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 9. RLS — Comments: public can read ───────────────────
DROP POLICY IF EXISTS "Public can view comments" ON public.article_comments;
CREATE POLICY "Public can view comments"
  ON public.article_comments FOR SELECT USING (true);

-- ── 10. RLS — Reactions: public can read ─────────────────
DROP POLICY IF EXISTS "Public can view reactions" ON public.article_reactions;
CREATE POLICY "Public can view reactions"
  ON public.article_reactions FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════
-- Done. All bug-fix migrations applied.
-- ═══════════════════════════════════════════════════════════
