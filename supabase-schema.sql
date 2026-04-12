-- ================================================
-- INKWELL — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ================================================

-- Articles table
create table if not exists public.articles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text default '',
  content text default '',
  summary text default '',
  status text default 'draft' check (status in ('draft', 'published', 'archived')),
  tags text[] default '{}',
  slug text unique,
  word_count integer default 0,
  reading_time integer default 0,
  cover_emoji text default '✦',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.articles enable row level security;

-- Policy: users can only see their own articles
create policy "Users can view own articles"
  on public.articles for select
  using (auth.uid() = user_id);

-- Policy: users can insert their own articles
create policy "Users can insert own articles"
  on public.articles for insert
  with check (auth.uid() = user_id);

-- Policy: users can update their own articles
create policy "Users can update own articles"
  on public.articles for update
  using (auth.uid() = user_id);

-- Policy: users can delete their own articles
create policy "Users can delete own articles"
  on public.articles for delete
  using (auth.uid() = user_id);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger articles_updated_at
  before update on public.articles
  for each row execute function update_updated_at();

-- ================================================
-- Done. Your database is ready.
-- ================================================
