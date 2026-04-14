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
  bible_verse?: string
  view_count?: number
  created_at: string
  updated_at: string
}

export interface WriterProfile {
  id: string
  full_name: string
  bio: string
  avatar_url: string
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
    .select('id, full_name, bio, avatar_url, created_at')
    .eq('id', userId)
    .single()
  return data
}

export async function upsertProfile(userId: string, full_name: string, bio: string, avatar_url = "") {
  return supabase
    .from('writer_profiles')
    .upsert({ id: userId, full_name, bio, avatar_url, updated_at: new Date().toISOString() })
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

// ── Community types ───────────────────────────────
export interface Community {
  id: string
  name: string
  slug: string
  description: string
  emoji: string
  category: string
  created_by: string
  created_at: string
  member_count?: number
  post_count?: number
}

export interface CommunityMember {
  community_id: string
  user_id: string
  role: 'admin' | 'member'
  joined_at: string
}

export interface CommunityPost {
  id: string
  community_id: string
  article_id: string
  submitted_by: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_at: string | null
  created_at: string
  article?: Article
  submitter?: { full_name: string; avatar_url: string }
}

// ── Bible verse type ─────────────────────────────
export interface BibleVerse {
  reference: string
  verses: { book_id: string; book_name: string; chapter: number; verse: number; text: string }[]
  text: string
  translation_id: string
  translation_name: string
}

// ── Community helpers ─────────────────────────────
export async function getCommunities(): Promise<Community[]> {
  const { data } = await supabase
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export async function getCommunity(slug: string): Promise<Community | null> {
  const { data } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', slug)
    .single()
  return data
}

export async function getUserCommunityRole(communityId: string, userId: string): Promise<'admin' | 'member' | null> {
  const { data } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .single()
  return data?.role || null
}

export async function joinCommunity(communityId: string, userId: string) {
  return supabase.from('community_members').upsert({
    community_id: communityId, user_id: userId, role: 'member'
  })
}

export async function leaveCommunity(communityId: string, userId: string) {
  return supabase.from('community_members').delete()
    .eq('community_id', communityId).eq('user_id', userId)
}

export async function promoteToAdmin(communityId: string, userId: string) {
  return supabase.from('community_members')
    .update({ role: 'admin' })
    .eq('community_id', communityId).eq('user_id', userId)
}

export async function getCommunityPosts(communityId: string, status = 'approved'): Promise<CommunityPost[]> {
  const { data } = await supabase
    .from('community_posts')
    .select('*, article:articles(*), submitter:writer_profiles!submitted_by(full_name, avatar_url)')
    .eq('community_id', communityId)
    .eq('status', status)
    .order('created_at', { ascending: false })
  return (data || []) as CommunityPost[]
}

export async function getCommunityMembers(communityId: string) {
  const { data } = await supabase
    .from('community_members')
    .select('*, profile:writer_profiles(full_name, avatar_url)')
    .eq('community_id', communityId)
    .order('role', { ascending: true })
  return data || []
}

export async function submitArticleToCommunity(communityId: string, articleId: string, userId: string, isAdmin: boolean) {
  return supabase.from('community_posts').insert({
    community_id: communityId,
    article_id: articleId,
    submitted_by: userId,
    status: isAdmin ? 'approved' : 'pending'
  })
}

export async function reviewCommunityPost(postId: string, status: 'approved' | 'rejected') {
  return supabase.from('community_posts')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', postId)
}

// ── Bible API ─────────────────────────────────────
export async function fetchBibleVerse(reference: string): Promise<BibleVerse | null> {
  try {
    const encoded = encodeURIComponent(reference)
    const res = await fetch(`https://bible-api.com/${encoded}?translation=NIV`)
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

export async function fetchVerseOfDay(): Promise<BibleVerse | null> {
  // Curated daily verses — cycles by day of year
  const verses = [
    'John 3:16','Psalm 23:1','Proverbs 3:5-6','Isaiah 40:31','Philippians 4:13',
    'Romans 8:28','Jeremiah 29:11','Psalm 46:1','Matthew 6:33','Joshua 1:9',
    'Psalm 119:105','Romans 12:2','Galatians 5:22-23','2 Timothy 1:7','Hebrews 11:1',
    'James 1:2-3','1 Corinthians 13:4-5','Ephesians 2:8-9','Colossians 3:23','1 Peter 5:7',
  ]
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000)
  const verse = verses[dayOfYear % verses.length]
  return fetchBibleVerse(verse)
}
