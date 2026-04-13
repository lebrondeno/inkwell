import { createClient } from '@supabase/supabase-js'

const supabaseUrl    = import.meta.env.VITE_SUPABASE_URL || ''
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

export interface Comment {
  id: string
  article_id: string
  user_id: string
  body: string
  created_at: string
  profile?: { full_name: string }
}

// ── Writer profiles ──────────────────────────────
export async function getWriterProfile(userId: string): Promise<WriterProfile | null> {
  const { data } = await supabase
    .from('writer_profiles')
    .select('id, full_name, bio, created_at')
    .eq('id', userId)
    .single()
  return data
}

export async function upsertProfile(userId: string, full_name: string, bio: string) {
  return supabase
    .from('writer_profiles')
    .upsert({ id: userId, full_name, bio, updated_at: new Date().toISOString() })
}

// ── Views ────────────────────────────────────────
export async function incrementView(slug: string) {
  await supabase.rpc('increment_view', { article_slug: slug })
}

// ── Reactions ────────────────────────────────────
export async function getReactionCount(articleId: string): Promise<number> {
  const { count } = await supabase
    .from('article_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('article_id', articleId)
  return count || 0
}

export async function getUserReaction(articleId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('article_reactions')
    .select('id')
    .eq('article_id', articleId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function toggleReaction(articleId: string, userId: string): Promise<boolean> {
  const existing = await getUserReaction(articleId, userId)
  if (existing) {
    await supabase.from('article_reactions').delete()
      .eq('article_id', articleId).eq('user_id', userId)
    return false
  } else {
    await supabase.from('article_reactions').insert({ article_id: articleId, user_id: userId })
    return true
  }
}

// ── Comments ─────────────────────────────────────
export async function getComments(articleId: string): Promise<Comment[]> {
  const { data } = await supabase
    .from('article_comments')
    .select('*, profile:writer_profiles(full_name)')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })
  return (data || []) as Comment[]
}

export async function addComment(articleId: string, userId: string, body: string) {
  return supabase.from('article_comments').insert({
    article_id: articleId, user_id: userId, body: body.trim()
  })
}

export async function deleteComment(commentId: string) {
  return supabase.from('article_comments').delete().eq('id', commentId)
}

// ── Bookmarks ────────────────────────────────────
export async function isBookmarked(articleId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('article_id', articleId)
    .eq('user_id', userId)
    .single()
  return !!data
}

export async function toggleBookmark(articleId: string, userId: string): Promise<boolean> {
  const bookmarked = await isBookmarked(articleId, userId)
  if (bookmarked) {
    await supabase.from('bookmarks').delete()
      .eq('article_id', articleId).eq('user_id', userId)
    return false
  } else {
    await supabase.from('bookmarks').insert({ article_id: articleId, user_id: userId })
    return true
  }
}

export async function getUserBookmarks(userId: string): Promise<Article[]> {
  const { data } = await supabase
    .from('bookmarks')
    .select('article:articles(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return ((data || []).map((b: any) => b.article).filter(Boolean)) as Article[]
}
