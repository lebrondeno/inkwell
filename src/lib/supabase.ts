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
    .select('*, profile:writer_profiles(full_name, avatar_url)')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })
  return (data || []) as Comment[]
}

export async function addComment(articleId: string, userId: string, body: string) {
  try {
    const { data, error } = await supabase.from('article_comments').insert({
      article_id: articleId, 
      user_id: userId, 
      body: body.trim()
    }).select().single()
    
    if (error) {
      console.error('Comment insert error:', error)
      return { error: error.message }
    }
    
    return { data, error: null }
  } catch (err) {
    console.error('Comment insert exception:', err)
    return { error: 'Failed to save comment' }
  }
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
  const { error } = await supabase.from('community_members')
    .update({ role: 'admin' })
    .eq('community_id', communityId)
    .eq('user_id', userId)
  return { error }
}

export async function getCommunityPosts(communityId: string, status = 'approved'): Promise<CommunityPost[]> {
  // Step 1: get raw post rows
  const { data: posts } = await supabase
    .from('community_posts')
    .select('id, community_id, article_id, submitted_by, status, reviewed_at, created_at')
    .eq('community_id', communityId)
    .eq('status', status)
    .order('created_at', { ascending: false })
  if (!posts || posts.length === 0) return []

  // Step 2: enrich articles and submitter profiles in parallel
  const articleIds  = [...new Set(posts.map(p => p.article_id))]
  const submitterIds = [...new Set(posts.map(p => p.submitted_by))]

  const [{ data: articles }, { data: submitters }] = await Promise.all([
    supabase.from('articles').select('*').in('id', articleIds),
    supabase.from('writer_profiles').select('id, full_name, avatar_url').in('id', submitterIds),
  ])

  const articleMap   = Object.fromEntries((articles || []).map(a => [a.id, a]))
  const submitterMap = Object.fromEntries((submitters || []).map(s => [s.id, s]))

  return posts.map(p => ({
    ...p,
    article:   articleMap[p.article_id]   || null,
    submitter: submitterMap[p.submitted_by] || null,
  })) as CommunityPost[]
}

export async function getCommunityMembers(communityId: string) {
  // Step 1: get raw membership rows
  const { data: members } = await supabase
    .from('community_members')
    .select('community_id, user_id, role, joined_at')
    .eq('community_id', communityId)
    .order('role', { ascending: true })
  if (!members || members.length === 0) return []

  // Step 2: fetch profiles separately to avoid ambiguous FK hint
  const userIds = members.map(m => m.user_id)
  const { data: profiles } = await supabase
    .from('writer_profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

  return members.map(m => ({
    ...m,
    profile: profileMap[m.user_id] || null,
  }))
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
// Using free Bible API with CORS support
const BIBLE_API_BASE = 'https://bible-api.com'

export async function fetchBibleVerse(reference: string): Promise<BibleVerse | null> {
  try {
    const encoded = encodeURIComponent(reference)
    const res = await fetch(`${BIBLE_API_BASE}/${encoded}`)
    if (!res.ok) return null
    
    const data = await res.json()
    
    // Convert API response to our BibleVerse format
    if (data.text && data.reference) {
      return {
        reference: data.reference,
        verses: data.verses || [],
        text: data.text,
        translation_id: 'kjv',
        translation_name: 'KJV'
      }
    }
    
    return null
  } catch {
    return null
  }
}

export async function fetchVerseOfDay(): Promise<BibleVerse | null> {
  // Expanded list of daily verses for better variety
  const verses = [
    'John 3:16','Psalm 23:1','Proverbs 3:5-6','Isaiah 40:31','Philippians 4:13',
    'Romans 8:28','Jeremiah 29:11','Psalm 46:1','Matthew 6:33','Joshua 1:9',
    'Psalm 119:105','Romans 12:2','Galatians 5:22-23','2 Timothy 1:7','Hebrews 11:1',
    'James 1:2-3','1 Corinthians 13:4-5','Ephesians 2:8-9','Colossians 3:23','1 Peter 5:7',
    'Matthew 11:28','Psalm 27:1','Isaiah 41:10','Romans 15:13','Philippians 4:6-7',
    'Proverbs 16:3','Lamentations 3:22-23','Micah 6:8','Matthew 5:16','2 Corinthians 5:17',
    'Galatians 2:20','Ephesians 3:20','Philippians 2:3-4','Colossians 1:17','1 Thessalonians 5:16-18'
  ]
  
  // Use day of year for consistent daily verse selection
  const now = new Date()
  const startOfYear = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000)
  
  const selectedVerse = verses[dayOfYear % verses.length]
  return fetchBibleVerse(selectedVerse)
}
