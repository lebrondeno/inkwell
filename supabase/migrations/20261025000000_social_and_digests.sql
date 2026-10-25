-- ═══════════════════════════════════════════════════════════════════════════
-- INKWELL — Social Graph, Version History, Series, Notifications & Digests
-- Migration: 20261025000000_social_and_digests.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Follows (follows & writer_follows) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_digest boolean DEFAULT true NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_no_self_follow CHECK (follower_id <> following_id)
);

CREATE TABLE IF NOT EXISTS public.writer_follows (
  follower_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  following_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email_digest boolean DEFAULT true NOT NULL,
  created_at   timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT writer_follows_no_self_follow CHECK (follower_id <> following_id)
);

-- Keep follows and writer_follows synchronized automatically
CREATE OR REPLACE FUNCTION public.sync_writer_follows_to_follows()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    INSERT INTO public.follows (follower_id, following_id, email_digest, created_at)
    VALUES (NEW.follower_id, NEW.following_id, NEW.email_digest, NEW.created_at)
    ON CONFLICT (follower_id, following_id)
    DO UPDATE SET email_digest = EXCLUDED.email_digest;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM public.follows
    WHERE follower_id = OLD.follower_id AND following_id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_writer_follows ON public.writer_follows;
CREATE TRIGGER trg_sync_writer_follows
  AFTER INSERT OR UPDATE OR DELETE ON public.writer_follows
  FOR EACH ROW EXECUTE FUNCTION public.sync_writer_follows_to_follows();

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.writer_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Follows are viewable by everyone" ON public.follows;
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can follow writers" ON public.follows;
CREATE POLICY "Users can follow writers"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

DROP POLICY IF EXISTS "Users can update own follow preferences" ON public.follows;
CREATE POLICY "Users can update own follow preferences"
  ON public.follows FOR UPDATE
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can unfollow writers" ON public.follows;
CREATE POLICY "Users can unfollow writers"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Writer follows are viewable by everyone" ON public.writer_follows;
CREATE POLICY "Writer follows are viewable by everyone"
  ON public.writer_follows FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert writer_follows" ON public.writer_follows;
CREATE POLICY "Users can insert writer_follows"
  ON public.writer_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id AND follower_id <> following_id);

DROP POLICY IF EXISTS "Users can update writer_follows" ON public.writer_follows;
CREATE POLICY "Users can update writer_follows"
  ON public.writer_follows FOR UPDATE
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "Users can delete writer_follows" ON public.writer_follows;
CREATE POLICY "Users can delete writer_follows"
  ON public.writer_follows FOR DELETE
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_writer_follows_follower_id ON public.writer_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_writer_follows_following_id ON public.writer_follows(following_id);

-- ── 2. Series / Multi-Part Collections ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.series (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  description text DEFAULT '',
  cover_emoji text DEFAULT '📚',
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Series are viewable by everyone" ON public.series;
CREATE POLICY "Series are viewable by everyone"
  ON public.series FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authors can create series" ON public.series;
CREATE POLICY "Authors can create series"
  ON public.series FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can update own series" ON public.series;
CREATE POLICY "Authors can update own series"
  ON public.series FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete own series" ON public.series;
CREATE POLICY "Authors can delete own series"
  ON public.series FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_series_user_id ON public.series(user_id);

-- Add series columns to articles
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS series_id text REFERENCES public.series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_order integer;

CREATE INDEX IF NOT EXISTS idx_articles_series_id ON public.articles(series_id, series_order);

-- ── 3. Article Versions (Safety Net Checkpoints) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.article_versions (
  id          text PRIMARY KEY,
  article_id  uuid REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  content     text DEFAULT '',
  summary     text DEFAULT '',
  reason      text DEFAULT 'Checkpoint',
  word_count  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.article_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authors can view own article versions" ON public.article_versions;
CREATE POLICY "Authors can view own article versions"
  ON public.article_versions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can insert own article versions" ON public.article_versions;
CREATE POLICY "Authors can insert own article versions"
  ON public.article_versions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authors can delete own article versions" ON public.article_versions;
CREATE POLICY "Authors can delete own article versions"
  ON public.article_versions FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_article_versions_article_id ON public.article_versions(article_id, created_at DESC);

-- ── 4. In-App Notifications ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id          text PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  type        text NOT NULL CHECK (type IN ('new_follower', 'new_article', 'mention', 'system')),
  title       text NOT NULL,
  message     text NOT NULL,
  link        text,
  is_read     boolean DEFAULT false NOT NULL,
  created_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Authenticated users can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- ── 5. Email Digest Logs (Deduplication) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.digest_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  article_id  uuid REFERENCES public.articles(id) ON DELETE CASCADE NOT NULL,
  mode        text DEFAULT 'instant' CHECK (mode IN ('instant', 'weekly')),
  sent_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE (follower_id, article_id)
);

ALTER TABLE public.digest_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own digest logs" ON public.digest_logs;
CREATE POLICY "Users can view own digest logs"
  ON public.digest_logs FOR SELECT
  USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_digest_logs_follower_article ON public.digest_logs(follower_id, article_id);
CREATE INDEX IF NOT EXISTS idx_digest_logs_article_id ON public.digest_logs(article_id);
