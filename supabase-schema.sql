-- ================================================
-- INKWELL — Supabase Schema  (full reset-safe)
-- Run this in your Supabase SQL Editor
-- ================================================

-- ── Articles table ────────────────────────────────
create table if not exists public.articles (
  id           uuid        default gen_random_uuid() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  title        text        default '',
  content      text        default '',
  summary      text        default '',
  status       text        default 'draft' check (status in ('draft', 'published', 'archived')),
  tags         text[]      default '{}',
  slug         text        unique,
  word_count   integer     default 0,
  reading_time integer     default 0,
  cover_emoji  text        default '✦',
  view_count   integer     default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

alter table public.articles enable row level security;

-- Drop old policies if they exist (safe re-run)
drop policy if exists "Users can view own articles"      on public.articles;
drop policy if exists "Public can view published articles" on public.articles;
drop policy if exists "Users can insert own articles"   on public.articles;
drop policy if exists "Users can update own articles"   on public.articles;
drop policy if exists "Users can delete own articles"   on public.articles;

-- ✅ Anyone can read published articles (fixes "article not found")
create policy "Public can view published articles"
  on public.articles for select
  using (status = 'published' OR auth.uid() = user_id);

-- Authenticated users manage their own
create policy "Users can insert own articles"
  on public.articles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own articles"
  on public.articles for update
  using (auth.uid() = user_id);

create policy "Users can delete own articles"
  on public.articles for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists articles_updated_at on public.articles;
create trigger articles_updated_at
  before update on public.articles
  for each row execute function update_updated_at();

-- ── Writer Profiles table ─────────────────────────
-- Stores public writer info — synced from auth.user_metadata on sign-up/update
create table if not exists public.writer_profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  full_name  text        default '',
  bio        text        default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.writer_profiles enable row level security;

drop policy if exists "Public can view writer profiles" on public.writer_profiles;
drop policy if exists "Users can upsert own profile"   on public.writer_profiles;

-- Anyone can read profiles (for author info on article pages)
create policy "Public can view writer profiles"
  on public.writer_profiles for select
  using (true);

-- Users can create/update their own profile
create policy "Users can upsert own profile"
  on public.writer_profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-sync profile when a user signs up (via auth trigger)
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.writer_profiles (id, full_name, bio)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'bio', '')
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        bio       = excluded.bio,
        updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function handle_new_user();

-- ── Article views increment (optional) ────────────
create or replace function increment_view(article_slug text)
returns void as $$
begin
  update public.articles
  set view_count = view_count + 1
  where slug = article_slug and status = 'published';
end;
$$ language plpgsql security definer;

-- ================================================
-- Done. Your database is ready.
-- ================================================
