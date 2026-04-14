# ✦ Inkwell v7 — Full Setup Guide

## Stack
- **React + TypeScript + Vite** — Frontend
- **Supabase** — Database, Auth, Storage (all free tier)
- **Gemini 2.0 Flash** — AI features (free, 1,500 req/day)
- **Vercel** — Hosting (free tier)

---

## Step 1 — Clone & Install

```bash
unzip inkwell_v7.zip && cd inkwell_final
npm install
```

---

## Step 2 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Choose a region close to your users (e.g. Europe West for Kenya)
3. Note your **Project URL** and **anon/public key** from:
   `Settings → API`

---

## Step 3 — Run the Database Schema

1. In Supabase dashboard → **SQL Editor** → **New query**
2. Paste the **entire contents** of `supabase-schema-v2.sql`
3. Click **Run**

This creates:
- `articles` table (with `bible_verse` column)
- `writer_profiles` table (with `avatar_url` column)
- `communities`, `community_members`, `community_posts` tables
- All Row Level Security (RLS) policies
- Auto-admin trigger for community creators

> **If you ran the original schema before**, also run this:
> ```sql
> ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS bible_verse text DEFAULT '';
> ALTER TABLE public.writer_profiles ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
> ```

---

## Step 4 — Set Up Avatar Storage (Profile Pictures)

This is a one-time setup in Supabase.

### Option A — SQL Editor (Recommended)
The `supabase-schema-v2.sql` already includes the storage setup.
If it failed (storage policies sometimes need separate running), do Option B.

### Option B — Supabase Dashboard UI
1. Go to **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `avatars`
4. Toggle **Public bucket** → ON
5. Click **Create bucket**

Then add storage policies:
1. Go to **Storage → Policies**
2. Click **New Policy** on the `avatars` bucket
3. Add these 4 policies:

| Policy Name | Operation | Check |
|---|---|---|
| Avatars are public | SELECT | `true` |
| Users can upload avatars | INSERT | `bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]` |
| Users can update own avatar | UPDATE | `bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]` |
| Users can delete own avatar | DELETE | `bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]` |

### How avatar upload works in the app
- User goes to **Profile** page → clicks their avatar photo
- Selects image (JPG, PNG, WebP, max 2MB)
- Image uploads to `avatars/{user_id}/avatar.{ext}`
- Public URL saved to `writer_profiles.avatar_url` and auth metadata
- Shows everywhere: profile page, community members list, public profile

---

## Step 5 — Get Gemini API Key (Free)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **Get API Key** → **Create API key in new project**
3. Copy the key (starts with `AIza...`)

Free limits: **1,500 requests/day** — more than enough for personal/small team use.

---

## Step 6 — Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in:
```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GEMINI_API_KEY=AIzaSy...
```

**Rules:**
- No quotes around values
- No spaces around `=`
- Variable names must start with `VITE_`
- Restart `npm run dev` after any `.env` change

---

## Step 7 — Run Locally

```bash
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## Step 8 — Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts, then go to:
**Vercel Dashboard → Your Project → Settings → Environment Variables**

Add the same 3 variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GEMINI_API_KEY`

Then redeploy:
```bash
vercel --prod
```

---

## Features Reference

| Feature | How to use |
|---|---|
| **Bible verse on article** | In Editor, type a reference like `John 3:16` in the verse field — verse text auto-loads for readers |
| **Verse of the Day** | Appears automatically on Communities page and public feed — rotates daily |
| **Create community** | Communities page → New Community button (must be signed in) |
| **Submit article to community** | Open a community → Submit Article (must be a member, article must be Published) |
| **Admin review queue** | Community page → Review Queue tab (admins only) — Approve or Reject pending articles |
| **Make someone admin** | Community page → Members tab → Make Admin button (admins only) |
| **Upload profile picture** | Profile page → click your avatar → select image |
| **Dark/light mode** | Toggle button in sidebar (desktop) or top bar (mobile) |
| **Install as app (PWA)** | Open on phone → browser menu → Add to Home Screen |
| **AI writing assistant** | Editor → ✦ AI button → choose action |

---

## Bible Translation
Default translation is **NIV** (New International Version).
Powered by [bible-api.com](https://bible-api.com) — free, no API key needed.

---

## Community Access
- **Community list** (`/communities`) — public, no login needed
- **Community feed** (`/c/slug`) — public, anyone with the link can read
- **Submitting articles** — requires account + community membership
- **Admin review** — requires admin role in that community

