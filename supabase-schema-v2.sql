-- ═══════════════════════════════════════════════════════════
-- INKWELL v7 — Full Supabase Schema
-- Run this in your Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. Add new columns to existing tables ────────────────

-- Add bible_verse reference to articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS bible_verse text DEFAULT '';

-- Add avatar_url to writer_profiles
ALTER TABLE public.writer_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';

-- ── 2. Communities ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.communities (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text UNIQUE NOT NULL,
  description text DEFAULT '',
  emoji       text DEFAULT '🏛️',
  category    text DEFAULT 'General',
  created_by  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

-- Anyone can read communities (public)
CREATE POLICY "Communities are public"
  ON public.communities FOR SELECT USING (true);

-- Only authenticated users can create communities
CREATE POLICY "Auth users can create communities"
  ON public.communities FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Only the creator (admin) can update
CREATE POLICY "Creator can update community"
  ON public.communities FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete community"
  ON public.communities FOR DELETE
  USING (auth.uid() = created_by);

-- ── 3. Community Members ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_members (
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role         text DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at    timestamptz DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);

ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

-- Anyone can read membership (for counts, member lists)
CREATE POLICY "Members list is public"
  ON public.community_members FOR SELECT USING (true);

-- Users can join communities (insert their own membership)
CREATE POLICY "Users can join communities"
  ON public.community_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can leave (delete their own membership)
CREATE POLICY "Users can leave communities"
  ON public.community_members FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can update roles
CREATE POLICY "Admins can update roles"
  ON public.community_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ── 4. Community Posts ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE NOT NULL,
  article_id   uuid REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status       text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at  timestamptz,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (community_id, article_id)
);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read approved posts (public community feeds)
CREATE POLICY "Approved posts are public"
  ON public.community_posts FOR SELECT
  USING (status = 'approved' OR auth.uid() = submitted_by OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Members can submit posts
CREATE POLICY "Members can submit posts"
  ON public.community_posts FOR INSERT
  WITH CHECK (
    auth.uid() = submitted_by AND
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
    )
  );

-- Admins can approve/reject
CREATE POLICY "Admins can review posts"
  ON public.community_posts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Submitter or admin can delete
CREATE POLICY "Submitter or admin can delete post"
  ON public.community_posts FOR DELETE
  USING (
    auth.uid() = submitted_by OR
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_posts.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- ── 5. Supabase Storage — Avatar Bucket ──────────────────
-- Run this separately in the Supabase Storage UI or SQL:
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT DO NOTHING;

-- Allow authenticated users to upload their own avatar
CREATE POLICY "Users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Avatars are public"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ── 6. Helper function: auto-join creator as admin ───────
CREATE OR REPLACE FUNCTION public.auto_join_community_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.community_members (community_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER community_creator_admin
  AFTER INSERT ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.auto_join_community_as_admin();

-- ═══════════════════════════════════════════════════════════
-- Done. Your database is ready.
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- PATCH: Fix RLS for promoteToAdmin + performance indexes
-- Run this in Supabase SQL Editor after the schema above
-- ═══════════════════════════════════════════════════════════

-- Drop and recreate the UPDATE policy with WITH CHECK clause
DROP POLICY IF EXISTS "Admins can update roles" ON public.community_members;

CREATE POLICY "Admins can update roles"
  ON public.community_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.community_members cm
      WHERE cm.community_id = community_members.community_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
    )
  );

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_community_members_community_id ON public.community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user_id ON public.community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_community_status ON public.community_posts(community_id, status);
CREATE INDEX IF NOT EXISTS idx_community_posts_article_id ON public.community_posts(article_id);

-- ═══════════════════════════════════════════════════════════
-- Patch complete.
-- ═══════════════════════════════════════════════════════════
