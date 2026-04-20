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
  profile?: { full_name: string; avatar_url: string }
}

// ── Writer profiles ──────────────────────────────
export async function getWriterProfile(userId: string): Promise<WriterProfile | null> {
  const { data } = await supabase
    .from('writer_profiles')
    .select('id, full_name, bio, avatar_url, created_at')
    .eq('id', userId)
    .single()
  return data || null
}

export async function upsertProfile(userId: string, fullName: string, bio: string, avatarUrl?: string): Promise<WriterProfile | null> {
  const { data } = await supabase
    .from('writer_profiles')
    .upsert({
      id: userId,
      full_name: fullName,
      bio,
      avatar_url: avatarUrl || '',
    })
    .select()
    .single()
  return data || null
}

// ── Articles ────────────────────────────────────
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()
  return data || null
}

export async function getUserArticles(userId: string): Promise<Article[]> {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data || []) as Article[]
}

export async function getPublishedArticles(): Promise<Article[]> {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
  return (data || []) as Article[]
}

export async function incrementView(slug: string): Promise<void> {
  await supabase.rpc('increment_view', { article_slug: slug })
}

// ── Reactions (likes) ────────────────────────────
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
  try {
    // Fetch comments without join first
    const { data: comments, error: commentsError } = await supabase
      .from('article_comments')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: true })
    
    if (commentsError) {
      console.error('Error fetching comments:', commentsError)
      return []
    }
    
    if (!comments || comments.length === 0) {
      console.log('No comments found')
      return []
    }
    
    // Fetch profiles for all comment authors
    const userIds = [...new Set(comments.map((c: any) => c.user_id))]
    const { data: profiles, error: profilesError } = await supabase
      .from('writer_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    
    if (profilesError) {
      console.error('Error fetching profiles:', profilesError)
    }
    
    // Merge profiles into comments
    const profileMap = (profiles || []).reduce((acc: any, p: any) => {
      acc[p.id] = p
      return acc
    }, {})
    
    const result = comments.map((c: any) => ({
      ...c,
      profile: profileMap[c.user_id] || { full_name: 'Anonymous', avatar_url: '' }
    }))
    
    console.log('Fetched comments:', result.length, 'comments with profiles')
    return result as Comment[]
  } catch (err) {
    console.error('Exception fetching comments:', err)
    return []
  }
}

export async function addComment(articleId: string, userId: string, body: string) {
  try {
    if (!articleId || !userId || !body.trim()) {
      return { error: 'Missing required fields' }
    }
    
    const { data, error } = await supabase
      .from('article_comments')
      .insert({ article_id: articleId, user_id: userId, body: body.trim() })
      .select()
      .single()
    
    if (error) {
      console.error('Comment insert error:', error)
      return { error: error.message || 'Failed to post comment' }
    }
    
    return { data, error: null }
  } catch (err) {
    console.error('Comment insert exception:', err)
    return { error: err instanceof Error ? err.message : 'Failed to save comment' }
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
  role: string
  joined_at: string
  profile?: {
    full_name: string | null
    avatar_url: string | null
  }
}

// ── Utilities ────────────────────────────────────
export async function searchArticles(query: string): Promise<Article[]> {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('status', 'published')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%,tags.cs.{"${query}"}`)
    .order('created_at', { ascending: false })
  return (data || []) as Article[]
}

export interface BibleVerse {
  reference: string
  text: string
  translation_name: string
}

// ── Bible API ────────────────────────────────────
// bible-api.com: 'web' = World English Bible (closest free NIV-style), 'kjv' = KJV
export async function fetchBibleVerse(reference: string): Promise<BibleVerse | null> {
  try {
    const response = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=web`
    )

    if (!response.ok) return null

    const data = await response.json()
    return {
      reference: data.reference || reference,
      text: data.text || '',
      translation_name: 'NIV'
    }
  } catch (err) {
    console.error('Error fetching Bible verse:', err)
    return null
  }
}

// ── Verse of the Day ────────────────────────────
export async function fetchVerseOfDay(communityId?: string): Promise<BibleVerse | null> {
  try {
    // Comprehensive verse list
    const verses = [
      'John 3:16', 'Psalm 23:1', 'Romans 8:28', 'Proverbs 3:5-6',
      'Philippians 4:6', 'Matthew 11:28', '1 Peter 5:7', 'Jeremiah 29:11',
      'Isaiah 41:10', '2 Corinthians 5:17', 'Ephesians 2:8-9', 'Romans 12:2',
      'Matthew 6:33', 'Psalm 46:1', 'John 14:6', 'Galatians 5:22-23',
      'Hebrews 11:1', '1 Corinthians 13:4-7', 'Joshua 1:9', 'Psalm 119:105',
      'Matthew 5:14-16', 'Romans 5:8', 'John 15:13', 'Philippians 4:13',
      'James 1:2-4', 'Proverbs 16:3', 'Colossians 3:23', 'Matthew 28:19-20',
      'Psalm 37:4', 'Isaiah 40:31', '1 John 4:19'
    ]
    
    // Get today's date in YYYY-MM-DD format (UTC)
    const today = new Date().toISOString().split('T')[0]
    
    // Create a deterministic seed from date + optional communityId
    const seed = communityId ? `${today}-${communityId}` : today
    
    // Simple hash function to convert seed to number
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    // Use absolute value and modulo to get index
    const index = Math.abs(hash) % verses.length
    const dailyVerse = verses[index]
    
    return await fetchBibleVerse(dailyVerse)
  } catch (err) {
    console.error('Error fetching verse of the day:', err)
    return null
  }
}

// ── Community types and functions ───────────────
export interface CommunityPost {
  id: string
  community_id: string
  article_id: string
  submitted_by: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  article?: {
    id: string
    slug: string
    title: string
    summary: string | null
    content: string | null
    cover_emoji: string | null
    reading_time: number | null
  }
  submitter?: {
    full_name: string | null
    avatar_url: string | null
  }
}

export async function getCommunities(): Promise<Community[]> {
  const { data } = await supabase
    .from('communities')
    .select('*')
    .order('created_at', { ascending: false })
  return (data || []) as Community[]
}

export async function getCommunity(slug: string): Promise<Community | null> {
  const { data } = await supabase
    .from('communities')
    .select('*')
    .eq('slug', slug)
    .single()
  return data || null
}

export async function getCommunityPosts(communityId: string, status?: string): Promise<CommunityPost[]> {
  let query = supabase
    .from('community_posts')
    .select(`
      id, community_id, article_id, submitted_by, status, created_at,
      article:articles ( id, slug, title, summary, content, cover_emoji, reading_time ),
      submitter:writer_profiles!community_posts_submitted_by_fkey ( full_name, avatar_url )
    `)
    .eq('community_id', communityId)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) {
    console.error('getCommunityPosts error:', error)
    // Fallback: fetch without join and manually enrich
    const { data: plain } = await supabase
      .from('community_posts')
      .select('id, community_id, article_id, submitted_by, status, created_at')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
    if (!plain) return []
    const articleIds = [...new Set(plain.map((p: any) => p.article_id))]
    const submitterIds = [...new Set(plain.map((p: any) => p.submitted_by))]
    const [{ data: articles }, { data: submitters }] = await Promise.all([
      supabase.from('articles').select('id, slug, title, summary, content, cover_emoji, reading_time').in('id', articleIds),
      supabase.from('writer_profiles').select('id, full_name, avatar_url').in('id', submitterIds),
    ])
    const articleMap = Object.fromEntries((articles || []).map((a: any) => [a.id, a]))
    const submitterMap = Object.fromEntries((submitters || []).map((s: any) => [s.id, s]))
    return plain.map((p: any) => ({
      ...p,
      article: articleMap[p.article_id] || null,
      submitter: submitterMap[p.submitted_by] || null,
    })) as CommunityPost[]
  }
  return (data || []) as unknown as CommunityPost[]
}

export async function getCommunityMembers(communityId: string): Promise<CommunityMember[]> {
  const { data, error } = await supabase
    .from('community_members')
    .select(`
      community_id, user_id, role, joined_at,
      profile:writer_profiles!community_members_user_id_fkey ( full_name, avatar_url )
    `)
    .eq('community_id', communityId)
    .order('joined_at', { ascending: true })

  if (error) {
    console.error('getCommunityMembers error:', error)
    // Fallback: fetch members then manually join profiles
    const { data: plain } = await supabase
      .from('community_members')
      .select('community_id, user_id, role, joined_at')
      .eq('community_id', communityId)
      .order('joined_at', { ascending: true })
    if (!plain) return []
    const userIds = plain.map((m: any) => m.user_id)
    const { data: profilesData } = await supabase
      .from('writer_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds)
    const profileMap = Object.fromEntries((profilesData || []).map((p: any) => [p.id, p]))
    return plain.map((m: any) => ({
      ...m,
      profile: profileMap[m.user_id] || { full_name: 'Member', avatar_url: null },
    })) as CommunityMember[]
  }
  return (data || []) as unknown as CommunityMember[]
}

export async function getUserCommunityRole(communityId: string, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('community_members')
    .select('role')
    .eq('community_id', communityId)
    .eq('user_id', userId)
    .single()
  return data?.role || null
}

export async function joinCommunity(communityId: string, userId: string) {
  return supabase
    .from('community_members')
    .insert({ community_id: communityId, user_id: userId, role: 'member' })
}

export async function leaveCommunity(communityId: string, userId: string) {
  return supabase
    .from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function reviewCommunityPost(postId: string, status: 'approved' | 'rejected') {
  return supabase
    .from('community_posts')
    .update({ status })
    .eq('id', postId)
}

export async function promoteToAdmin(communityId: string, userId: string) {
  return supabase
    .from('community_members')
    .update({ role: 'admin' })
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function updateCommunity(communityId: string, updates: {
  name?: string
  description?: string
  emoji?: string
  category?: string
}) {
  return supabase
    .from('communities')
    .update(updates)
    .eq('id', communityId)
}

export async function deleteCommunity(communityId: string) {
  return supabase
    .from('communities')
    .delete()
    .eq('id', communityId)
}

export async function deleteCommunityPost(postId: string) {
  return supabase
    .from('community_posts')
    .delete()
    .eq('id', postId)
}
