# Inkwell — Setup Guide

## 1. Supabase Database Setup (REQUIRED)

Run **`supabase-schema.sql`** in your Supabase SQL Editor.

This script:
- Creates the `articles` table with an **updated RLS policy** that allows anyone to read published articles (fixes "article not found")
- Creates the `writer_profiles` table — a **public** table storing each writer's name and bio, synced automatically when users sign up or update their profile
- Adds a `view_count` column to articles for trending
- Creates an `increment_view` RPC function

> **If you already have an articles table**, the script uses `DROP POLICY IF EXISTS` + `CREATE POLICY` to safely replace the old policy. It won't delete your data.

## 2. Environment Variables

Copy `.env.example` to `.env`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_GROK_API_KEY=your-grok-key
```

## 3. Install & Run

```bash
npm install
npm run dev
```

## 4. Features

| Feature | Route | Auth required |
|---|---|---|
| Discover articles | `/discover` | No |
| Read an article | `/articles/:slug` | No |
| View writer profile | `/writer/:userId` | No |
| Trending tab | `/discover` → Trending | Yes (logged in) |
| Dashboard / Write | `/app` | Yes |

*Made by lebron deno*
