import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ArticleStatus = 'draft' | 'published' | 'archived'

export interface Article {
  id: string
  user_id: string
  title: string
  content: string
  summary: string
  status: ArticleStatus
  tags: string[]
  slug: string
  word_count: number
  reading_time: number
  cover_emoji: string
  view_count?: number
  created_at: string
  updated_at: string
}

export interface WriterProfile {
  id: string
  full_name: string
  bio: string
  created_at: string
}

// Fetch a writer's public profile
export async function getWriterProfile(userId: string): Promise<WriterProfile | null> {
  const { data } = await supabase
    .from('writer_profiles')
    .select('id, full_name, bio, created_at')
    .eq('id', userId)
    .single()
  return data
}

// Upsert current user's profile (call after auth updateUser)
export async function upsertProfile(userId: string, full_name: string, bio: string) {
  return supabase
    .from('writer_profiles')
    .upsert({ id: userId, full_name, bio, updated_at: new Date().toISOString() })
}

// Increment view count for an article
export async function incrementView(slug: string) {
  await supabase.rpc('increment_view', { article_slug: slug })
}
