import { createClient } from '@supabase/supabase-js'

export function normalizeSupabaseUrl(url: string): string {
  return (url || '').replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

const rawSupabaseUrl  = import.meta.env.VITE_SUPABASE_URL || ''
export const supabaseUrl     = normalizeSupabaseUrl(rawSupabaseUrl)
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function checkAndPersistRecoveryState(): boolean {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const hash = window.location.hash || ''
      const search = window.location.search || ''
      const pathname = window.location.pathname || ''
      if (hash.includes('type=recovery') || search.includes('type=recovery') || pathname === '/reset-password') {
        if (hash.includes('type=recovery') || search.includes('type=recovery')) {
          window.sessionStorage.setItem('inkwell_password_recovery', '1')
          return true
        }
      }
    } catch {
      return false
    }
  }
  return false
}

// Module load time: detect recovery token before createClient strips window.location.hash
checkAndPersistRecoveryState()

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
  series_id?: string
  series_order?: number
  author?: WriterProfile | null
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
  profile?: { full_name: string; avatar_url?: string }
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
  // Step 1: get raw comment rows
  const { data: comments } = await supabase
    .from('article_comments')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true })
  if (!comments || comments.length === 0) return []

  // Step 2: batch-fetch matching writer_profiles by user_id
  const userIds = [...new Set(comments.map(c => c.user_id))]
  const { data: profiles } = await supabase
    .from('writer_profiles')
    .select('id, full_name, avatar_url')
    .in('id', userIds)

  const profileMap = Object.fromEntries(
    (profiles || []).map(p => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }])
  )

  return comments.map(c => ({
    ...c,
    profile: profileMap[c.user_id],
  })) as Comment[]
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
  return (((data as unknown as { article: Article | null }[]) || []).map(b => b.article).filter(Boolean)) as Article[]
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
  profile?: { id?: string; full_name?: string; avatar_url?: string } | null
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
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function demoteToMember(communityId: string, userId: string) {
  return supabase.from('community_members')
    .update({ role: 'member' })
    .eq('community_id', communityId)
    .eq('user_id', userId)
}

export async function removeCommunityMember(communityId: string, userId: string) {
  return supabase.from('community_members')
    .delete()
    .eq('community_id', communityId)
    .eq('user_id', userId)
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

export async function fetchVerseOfDay(_communityId?: string): Promise<BibleVerse | null> {
  void _communityId
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


// ── Local Storage Helper ──────────────────────────
function safeLocalStorage() {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }
  return null
}

// ── Follows & Following Feed ──────────────────────
export interface FollowerCount {
  followers: number
  following: number
}

export interface WriterFollow {
  follower_id: string
  following_id: string
  email_digest?: boolean
  created_at: string
}

export async function followWriter(followerId: string, followingId: string): Promise<{ success: boolean; error?: string }> {
  if (!followerId || !followingId) return { success: false, error: 'Invalid user IDs' }
  if (followerId === followingId) {
    throw new Error('Cannot follow yourself')
  }

  // 1. Try Supabase
  try {
    await supabase.from('follows').upsert({
      follower_id: followerId,
      following_id: followingId,
      email_digest: true,
      created_at: new Date().toISOString()
    })
  } catch (err) {
    console.warn('Supabase follow error, falling back to local storage', err)
  }

  // 2. Always persist in localStorage
  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      if (!stored.some(f => f.follower_id === followerId && f.following_id === followingId)) {
        stored.push({
          follower_id: followerId,
          following_id: followingId,
          email_digest: true,
          created_at: new Date().toISOString()
        })
        ls.setItem('inkwell_follows', JSON.stringify(stored))
      }
    } catch {
    /* ignore error */
  }
  }

  // 3. Create notification for followed writer & trigger curiosity-driven email
  try {
    const followerProfile = await getWriterProfile(followerId)
    const followerName = followerProfile?.full_name || 'A reader'
    await createNotification({
      user_id: followingId,
      actor_id: followerId,
      type: 'new_follower',
      title: 'New Follower',
      message: `${followerName} started following you — tap to view their profile`,
      link: `/author/${followerId}`
    })
  } catch {
    /* ignore error */
  }

  void triggerNewFollowerEmail(followerId, followingId)

  return { success: true }
}

export async function triggerNewFollowerEmail(
  followerId: string,
  followingId: string
): Promise<{ ok: boolean; simulated?: boolean; count?: number }> {
  if (!followerId || !followingId || followerId === followingId) {
    return { ok: false }
  }
  try {
    const appUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://inkwell-chi-smoky.vercel.app'

    const { data, error } = await supabase.functions.invoke('send-follower-digest', {
      body: {
        mode: 'new_follower',
        followerId,
        followingId,
        appUrl,
      },
    })

    if (error) {
      return { ok: false }
    }
    return (data as { ok: boolean; simulated?: boolean; count?: number }) || { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function ensureWelcomeMessageSent(user: {
  id: string
  email?: string | null
  email_confirmed_at?: string | null
  created_at?: string | null
  user_metadata?: Record<string, unknown>
} | null | undefined): Promise<{ ok: boolean; skipped?: boolean }> {
  if (!user?.id || !user.email_confirmed_at) {
    return { ok: false, skipped: true }
  }
  if (user.user_metadata?.welcome_email_sent === true) {
    return { ok: false, skipped: true }
  }

  const confirmedTime = new Date(user.email_confirmed_at).getTime()
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
  if (Number.isNaN(confirmedTime) || Date.now() - confirmedTime > sevenDaysMs) {
    return { ok: false, skipped: true }
  }

  const storageKey = `inkwell_welcome_${user.id}`
  const ls = safeLocalStorage()
  if (ls) {
    try {
      if (ls.getItem(storageKey) === 'true') {
        return { ok: false, skipped: true }
      }
      ls.setItem(storageKey, 'true')
    } catch {
      /* ignore localStorage error */
    }
  }

  try {
    const appUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://inkwell-chi-smoky.vercel.app'

    const { data, error } = await supabase.functions.invoke('send-follower-digest', {
      body: {
        mode: 'welcome',
        userId: user.id,
        email: user.email || undefined,
        name:
          typeof user.user_metadata?.full_name === 'string'
            ? user.user_metadata.full_name
            : undefined,
        appUrl,
      },
    })

    if (error) {
      return { ok: false }
    }
    return (data as { ok: boolean }) || { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function unfollowWriter(followerId: string, followingId: string): Promise<boolean> {
  try {
    await supabase.from('follows').delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      const updated = stored.filter(f => !(f.follower_id === followerId && f.following_id === followingId))
      ls.setItem('inkwell_follows', JSON.stringify(updated))
    } catch {
    /* ignore error */
  }
  }
  return true
}

export async function isFollowingWriter(followerId: string, followingId: string): Promise<boolean> {
  if (!followerId || !followingId || followerId === followingId) return false

  try {
    const { data } = await supabase.from('follows')
      .select('following_id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .single()
    if (data) return true
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      return stored.some(f => f.follower_id === followerId && f.following_id === followingId)
    } catch {
    /* ignore error */
  }
  }
  return false
}

export async function getFollowerCounts(userId: string): Promise<FollowerCount> {
  let followers = 0
  let following = 0

  try {
    const [{ count: fCount }, { count: ingCount }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ])
    followers = fCount || 0
    following = ingCount || 0
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      const localFollowers = stored.filter(f => f.following_id === userId).length
      const localFollowing = stored.filter(f => f.follower_id === userId).length
      followers = Math.max(followers, localFollowers)
      following = Math.max(following, localFollowing)
    } catch {
    /* ignore error */
  }
  }

  return { followers, following }
}

export async function toggleFollowDigest(followerId: string, followingId: string, enabled: boolean): Promise<boolean> {
  try {
    await supabase.from('follows')
      .update({ email_digest: enabled })
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      const idx = stored.findIndex(f => f.follower_id === followerId && f.following_id === followingId)
      if (idx !== -1) {
        stored[idx].email_digest = enabled
        ls.setItem('inkwell_follows', JSON.stringify(stored))
      }
    } catch {
    /* ignore error */
  }
  }
  return enabled
}

export async function getFollowingFeed(userId: string): Promise<Article[]> {
  let followedIds: string[] = []
  try {
    const { data } = await supabase.from('follows')
      .select('following_id')
      .eq('follower_id', userId)
    if (data && data.length > 0) {
      followedIds = data.map(d => d.following_id)
    }
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      const localIds = stored.filter(f => f.follower_id === userId).map(f => f.following_id)
      followedIds = [...new Set([...followedIds, ...localIds])]
    } catch {
    /* ignore error */
  }
  }

  if (followedIds.length === 0) return []

  try {
    const { data: articles } = await supabase.from('articles')
      .select('*')
      .in('user_id', followedIds)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(20)

    if (articles && articles.length > 0) {
      const authorIds = [...new Set(articles.map(a => a.user_id))]
      const { data: profiles } = await supabase.from('writer_profiles')
        .select('id, full_name, avatar_url, bio')
        .in('id', authorIds)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      return articles.map(a => ({
        ...a,
        author: profileMap[a.user_id] || null
      }))
    }
  } catch {
    /* ignore error */
  }

  return []
}

// ── In-App Notifications ──────────────────────────
export type NotificationType = 'new_follower' | 'new_article' | 'mention' | 'system'

export interface Notification {
  id: string
  user_id: string
  actor_id?: string
  type: NotificationType
  title: string
  message: string
  link?: string
  is_read: boolean
  created_at: string
  actor?: { full_name?: string; avatar_url?: string }
}

export async function createNotification(notif: Omit<Notification, 'id' | 'created_at' | 'is_read'> & { id?: string; is_read?: boolean }): Promise<Notification> {
  const newNotif: Notification = {
    id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: notif.user_id,
    actor_id: notif.actor_id,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    link: notif.link,
    is_read: notif.is_read ?? false,
    created_at: new Date().toISOString()
  }

  try {
    await supabase.from('notifications').insert(newNotif)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_notifications_${notif.user_id}`
      const existing = JSON.parse(ls.getItem(key) || '[]') as Notification[]
      existing.unshift(newNotif)
      ls.setItem(key, JSON.stringify(existing.slice(0, 50)))
    } catch {
    /* ignore error */
  }
  }

  return newNotif
}

export async function getNotifications(userId: string): Promise<Notification[]> {
  let list: Notification[] = []
  try {
    const { data } = await supabase.from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data && data.length > 0) {
      list = data as Notification[]
    }
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_notifications_${userId}`
      const local = JSON.parse(ls.getItem(key) || '[]') as Notification[]
      const seen = new Set(list.map(n => n.id))
      for (const item of local) {
        if (!seen.has(item.id)) {
          list.push(item)
          seen.add(item.id)
        }
      }
    } catch {
    /* ignore error */
  }
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function markNotificationRead(id: string): Promise<boolean> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)
        if (key && key.startsWith('inkwell_notifications_')) {
          const list = JSON.parse(ls.getItem(key) || '[]') as Notification[]
          let modified = false
          for (const item of list) {
            if (item.id === id) {
              item.is_read = true
              modified = true
            }
          }
          if (modified) ls.setItem(key, JSON.stringify(list))
        }
      }
    } catch {
    /* ignore error */
  }
  }
  return true
}

export async function markAllNotificationsRead(userId: string): Promise<boolean> {
  try {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_notifications_${userId}`
      const list = JSON.parse(ls.getItem(key) || '[]') as Notification[]
      list.forEach(n => { n.is_read = true })
      ls.setItem(key, JSON.stringify(list))
    } catch {
    /* ignore error */
  }
  }
  return true
}

export async function triggerFollowerEmailDigest(
  articleId: string
): Promise<{ ok: boolean; simulated?: boolean; count?: number }> {
  if (!articleId) return { ok: false }
  try {
    const appUrl =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://inkwell-chi-smoky.vercel.app'

    const { data, error } = await supabase.functions.invoke('send-follower-digest', {
      body: {
        mode: 'instant',
        articleId,
        appUrl,
      },
    })

    if (error) {
      return { ok: false }
    }
    return (data as { ok: boolean; simulated?: boolean; count?: number }) || { ok: true }
  } catch {
    return { ok: false }
  }
}

export async function notifyFollowersOfNewArticle(authorId: string, article: { id: string; title: string; slug: string }): Promise<void> {
  if (article.id) {
    void triggerFollowerEmailDigest(article.id)
  }
  let followers: string[] = []
  try {
    const { data } = await supabase.from('follows').select('follower_id').eq('following_id', authorId)
    if (data) followers = data.map(d => d.follower_id)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const stored = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      const localFollowers = stored.filter(f => f.following_id === authorId).map(f => f.follower_id)
      followers = [...new Set([...followers, ...localFollowers])]
    } catch {
    /* ignore error */
  }
  }

  const authorProfile = await getWriterProfile(authorId)
  const authorName = authorProfile?.full_name || 'A writer you follow'

  for (const followerId of followers) {
    if (followerId !== authorId) {
      await createNotification({
        user_id: followerId,
        actor_id: authorId,
        type: 'new_article',
        title: 'New Story Published',
        message: `${authorName} published "${article.title || 'Untitled'}"`,
        link: `/articles/${article.slug}`
      })
    }
  }
}

// ── Article Version History ───────────────────────
export interface ArticleVersion {
  id: string
  article_id: string
  user_id: string
  title: string
  content: string
  summary?: string
  reason: string
  word_count: number
  created_at: string
}

export async function saveArticleVersion(
  articleId: string,
  userId: string,
  snapshot: { title: string; content: string; summary?: string; reason: string }
): Promise<ArticleVersion> {
  const plain = (snapshot.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = plain ? plain.split(' ').filter(Boolean).length : 0

  const version: ArticleVersion = {
    id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    article_id: articleId,
    user_id: userId,
    title: snapshot.title || 'Untitled',
    content: snapshot.content || '',
    summary: snapshot.summary || '',
    reason: snapshot.reason || 'Checkpoint',
    word_count: words,
    created_at: new Date().toISOString()
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_versions_${articleId}`
      const existing = JSON.parse(ls.getItem(key) || '[]') as ArticleVersion[]
      existing.unshift(version)
      ls.setItem(key, JSON.stringify(existing.slice(0, 30)))
    } catch (e) {
      console.warn('Failed saving version to localStorage', e)
    }
  }

  try {
    await supabase.from('article_versions').insert(version)
  } catch {
    /* ignore error */
  }

  if (userId) {
    recordWritingActivity(userId)
  }

  return version
}

export async function getArticleVersions(articleId: string): Promise<ArticleVersion[]> {
  let list: ArticleVersion[] = []

  try {
    const { data } = await supabase.from('article_versions')
      .select('*')
      .eq('article_id', articleId)
      .order('created_at', { ascending: false })
    if (data && data.length > 0) {
      list = data as ArticleVersion[]
    }
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_versions_${articleId}`
      const local = JSON.parse(ls.getItem(key) || '[]') as ArticleVersion[]
      const seen = new Set(list.map(v => v.id))
      for (const item of local) {
        if (!seen.has(item.id)) {
          list.push(item)
          seen.add(item.id)
        }
      }
    } catch {
    /* ignore error */
  }
  }

  return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export async function restoreArticleVersion(versionId: string, articleId?: string): Promise<ArticleVersion | null> {
  try {
    const { data } = await supabase.from('article_versions').select('*').eq('id', versionId).single()
    if (data) return data as ArticleVersion
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      if (articleId) {
        const list = JSON.parse(ls.getItem(`inkwell_versions_${articleId}`) || '[]') as ArticleVersion[]
        const found = list.find(v => v.id === versionId)
        if (found) return found
      } else {
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i)
          if (k && k.startsWith('inkwell_versions_')) {
            const list = JSON.parse(ls.getItem(k) || '[]') as ArticleVersion[]
            const found = list.find(v => v.id === versionId)
            if (found) return found
          }
        }
      }
    } catch {
    /* ignore error */
  }
  }
  return null
}

// ── Series / Collections ──────────────────────────
export interface Series {
  id: string
  user_id: string
  title: string
  description?: string
  cover_emoji?: string
  created_at: string
  article_count?: number
}

export async function getUserSeries(userId: string): Promise<Series[]> {
  let list: Series[] = []
  try {
    const { data } = await supabase.from('series').select('*').eq('user_id', userId).order('created_at', { ascending: false })
    if (data && data.length > 0) list = data as Series[]
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const local = JSON.parse(ls.getItem(`inkwell_series_${userId}`) || '[]') as Series[]
      const seen = new Set(list.map(s => s.id))
      for (const item of local) {
        if (!seen.has(item.id)) {
          list.push(item)
          seen.add(item.id)
        }
      }
    } catch {
    /* ignore error */
  }
  }
  return list
}

export async function createSeries(userId: string, title: string, description = '', cover_emoji = '📚'): Promise<Series> {
  const newSeries: Series = {
    id: `series_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    title: title.trim(),
    description: description.trim(),
    cover_emoji,
    created_at: new Date().toISOString()
  }

  try {
    await supabase.from('series').insert(newSeries)
  } catch {
    /* ignore error */
  }

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_series_${userId}`
      const existing = JSON.parse(ls.getItem(key) || '[]') as Series[]
      existing.unshift(newSeries)
      ls.setItem(key, JSON.stringify(existing))
    } catch {
    /* ignore error */
  }
  }
  return newSeries
}

export async function getSeriesArticles(seriesId: string): Promise<Article[]> {
  try {
    const { data } = await supabase.from('articles')
      .select('*')
      .eq('series_id', seriesId)
      .order('series_order', { ascending: true })
    if (data && data.length > 0) return data as Article[]
  } catch {
    /* ignore error */
  }
  return []
}

export async function addArticleToSeries(articleId: string, seriesId: string, seriesOrder?: number): Promise<boolean> {
  try {
    await supabase.from('articles')
      .update({ series_id: seriesId, series_order: seriesOrder ?? 1 })
      .eq('id', articleId)
    return true
  } catch {
    return false
  }
}

export async function removeArticleFromSeries(articleId: string): Promise<boolean> {
  try {
    await supabase.from('articles')
      .update({ series_id: null, series_order: null })
      .eq('id', articleId)
    return true
  } catch {
    return false
  }
}

// ── Writing Streak & Daily Activity ───────────────
export interface WritingStreak {
  currentStreak: number
  longestStreak: number
  lastActiveDate: string | null
}

export function recordWritingActivity(userId: string): void {
  if (!userId) return
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    const key = `inkwell_streak_${userId}`
    const today = new Date().toISOString().split('T')[0]
    const data = JSON.parse(ls.getItem(key) || '{"dates":[]}')
    if (!data.dates) data.dates = []
    if (!data.dates.includes(today)) {
      data.dates.push(today)
      data.dates.sort()
      ls.setItem(key, JSON.stringify(data))
    }
  } catch {
    /* ignore error */
  }
}

export async function getWritingStreak(userId: string): Promise<WritingStreak> {
  if (!userId) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null }
  }

  const activeDates = new Set<string>()

  const ls = safeLocalStorage()
  if (ls) {
    try {
      const key = `inkwell_streak_${userId}`
      const data = JSON.parse(ls.getItem(key) || '{"dates":[]}')
      for (const d of data.dates || []) {
        if (typeof d === 'string') activeDates.add(d)
      }
    } catch {
    /* ignore error */
  }
  }

  try {
    const { data } = await supabase.from('articles').select('created_at, updated_at').eq('user_id', userId)
    if (data) {
      for (const row of data) {
        if (row.created_at) activeDates.add(row.created_at.split('T')[0])
        if (row.updated_at) activeDates.add(row.updated_at.split('T')[0])
      }
    }
  } catch {
    /* ignore error */
  }

  if (ls) {
    try {
      for (let i = 0; i < ls.length; i++) {
        const k = ls.key(i)
        if (k && k.startsWith('inkwell_versions_')) {
          const versions = JSON.parse(ls.getItem(k) || '[]') as ArticleVersion[]
          for (const v of versions) {
            if (v.user_id === userId && v.created_at) {
              activeDates.add(v.created_at.split('T')[0])
            }
          }
        }
      }
    } catch {
    /* ignore error */
  }
  }

  if (activeDates.size === 0) {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: null }
  }

  const sortedDates = Array.from(activeDates).sort()
  const todayStr = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  let longestStreak = 0
  let currentRun = 0
  let prevDate: Date | null = null

  for (const dateStr of sortedDates) {
    const d = new Date(dateStr)
    if (!prevDate) {
      currentRun = 1
    } else {
      const diffDays = Math.round((d.getTime() - prevDate.getTime()) / 86400000)
      if (diffDays === 1) {
        currentRun++
      } else if (diffDays > 1) {
        currentRun = 1
      }
    }
    if (currentRun > longestStreak) longestStreak = currentRun
    prevDate = d
  }

  const lastActiveDate = sortedDates[sortedDates.length - 1]
  let currentStreak = 0

  if (lastActiveDate === todayStr || lastActiveDate === yesterday) {
    let checkDate = new Date(lastActiveDate)
    currentStreak = 1
    while (true) {
      checkDate = new Date(checkDate.getTime() - 86400000)
      const prevStr = checkDate.toISOString().split('T')[0]
      if (activeDates.has(prevStr)) {
        currentStreak++
      } else {
        break
      }
    }
  }

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    lastActiveDate
  }
}


// ── Global Unified Search (Writers, Articles, Series, Communities) ──
export interface SearchWriterResult {
  id: string
  full_name: string
  name: string
  bio: string
  avatar_url: string
  follower_count: number
  is_following: boolean
  created_at?: string
}

export interface GlobalSearchResult {
  writers: SearchWriterResult[]
  articles: Article[]
  series: Series[]
  communities: Community[]
}

export async function globalSearch(
  query: string,
  currentUserId?: string
): Promise<GlobalSearchResult> {
  const q = (query || '').trim().toLowerCase()
  const ls = safeLocalStorage()

  // 1. Collect follows (Supabase + localStorage) to compute follower_count & is_following
  let allFollows: WriterFollow[] = []
  try {
    const { data: followRows } = await supabase
      .from('follows')
      .select('follower_id, following_id, created_at')
    if (Array.isArray(followRows)) {
      allFollows = [...followRows] as WriterFollow[]
    }
  } catch {
    /* ignore error */
  }
  if (ls) {
    try {
      const localFollows = JSON.parse(ls.getItem('inkwell_follows') || '[]') as WriterFollow[]
      for (const lf of localFollows) {
        if (!allFollows.some(f => f.follower_id === lf.follower_id && f.following_id === lf.following_id)) {
          allFollows.push(lf)
        }
      }
    } catch {
      /* ignore error */
    }
  }

  // 2. Collect Writers (writer_profiles + localStorage inkwell_profiles)
  const writerMap = new Map<string, WriterProfile & { name?: string; handle?: string }>()
  try {
    const { data: profileRows } = await supabase
      .from('writer_profiles')
      .select('id, full_name, bio, avatar_url, created_at')
      .limit(50)
    if (Array.isArray(profileRows)) {
      for (const p of profileRows) {
        if (p && p.id) writerMap.set(p.id, p as WriterProfile)
      }
    }
  } catch {
    /* ignore error */
  }
  if (ls) {
    try {
      const localProfiles = JSON.parse(ls.getItem('inkwell_profiles') || '[]') as (WriterProfile & { name?: string; handle?: string })[]
      for (const p of localProfiles) {
        if (p && p.id && !writerMap.has(p.id)) {
          writerMap.set(p.id, {
            id: p.id,
            full_name: p.full_name || p.name || 'Inkwell Writer',
            bio: p.bio || '',
            avatar_url: p.avatar_url || '',
            created_at: p.created_at || new Date().toISOString(),
            name: p.name || p.full_name,
            handle: p.handle,
          })
        }
      }
    } catch {
      /* ignore error */
    }
  }

  // 3. Collect Articles (Supabase + localStorage inkwell_articles)
  const articleMap = new Map<string, Article>()
  try {
    const { data: articleRows } = await supabase
      .from('articles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (Array.isArray(articleRows)) {
      for (const a of articleRows as Article[]) {
        if (a && a.id && (a.status === 'published' || (currentUserId && a.user_id === currentUserId))) {
          articleMap.set(a.id, a)
        }
      }
    }
  } catch {
    /* ignore error */
  }
  if (ls) {
    try {
      const localArticles = JSON.parse(ls.getItem('inkwell_articles') || '[]') as Article[]
      for (const a of localArticles) {
        if (a && a.id && !articleMap.has(a.id)) {
          if (a.status === 'published' || (currentUserId && a.user_id === currentUserId)) {
            articleMap.set(a.id, a)
          }
        }
      }
    } catch {
      /* ignore error */
    }
  }

  // Also infer writers from articles if not in writerMap
  for (const art of articleMap.values()) {
    if (art.author && art.author.id && !writerMap.has(art.author.id)) {
      writerMap.set(art.author.id, art.author)
    }
  }

  // Enrich articles with author profile
  const enrichedArticles: Article[] = Array.from(articleMap.values()).map(art => ({
    ...art,
    author: art.author || writerMap.get(art.user_id) || null,
  }))

  // 4. Collect Series (Supabase + localStorage inkwell_series & inkwell_series_*)
  const seriesMap = new Map<string, Series>()
  try {
    const { data: seriesRows } = await supabase
      .from('series')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    if (Array.isArray(seriesRows)) {
      for (const s of seriesRows as Series[]) {
        if (s && s.id) seriesMap.set(s.id, s)
      }
    }
  } catch {
    /* ignore error */
  }
  if (ls) {
    try {
      const directSeries = JSON.parse(ls.getItem('inkwell_series') || '[]') as Series[]
      for (const s of directSeries) {
        if (s && s.id && !seriesMap.has(s.id)) seriesMap.set(s.id, s)
      }
      for (let i = 0; i < ls.length; i++) {
        const key = ls.key(i)
        if (key && key.startsWith('inkwell_series_')) {
          const userSeries = JSON.parse(ls.getItem(key) || '[]') as Series[]
          for (const s of userSeries) {
            if (s && s.id && !seriesMap.has(s.id)) seriesMap.set(s.id, s)
          }
        }
      }
    } catch {
      /* ignore error */
    }
  }

  // 5. Collect Communities (Supabase + localStorage inkwell_communities)
  const communityMap = new Map<string, Community>()
  try {
    const { data: commRows } = await supabase
      .from('communities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40)
    if (Array.isArray(commRows)) {
      for (const c of commRows as Community[]) {
        if (c && c.id) communityMap.set(c.id, c)
      }
    }
  } catch {
    /* ignore error */
  }
  if (ls) {
    try {
      const localComms = JSON.parse(ls.getItem('inkwell_communities') || '[]') as Community[]
      for (const c of localComms) {
        if (c && c.id && !communityMap.has(c.id)) communityMap.set(c.id, c)
      }
    } catch {
      /* ignore error */
    }
  }

  // Build enriched writers array
  const allWriters: SearchWriterResult[] = Array.from(writerMap.values()).map(w => {
    const fullName = w.full_name || w.name || 'Inkwell Writer'
    const followerCount = allFollows.filter(f => f.following_id === w.id).length
    const isFollowing = currentUserId
      ? allFollows.some(f => f.follower_id === currentUserId && f.following_id === w.id)
      : false
    return {
      id: w.id,
      full_name: fullName,
      name: fullName,
      bio: w.bio || '',
      avatar_url: w.avatar_url || '',
      follower_count: followerCount,
      is_following: isFollowing,
      created_at: w.created_at,
    }
  })

  const allSeries = Array.from(seriesMap.values())
  const allCommunities = Array.from(communityMap.values())

  // If query is empty, return curated initial discovery set
  if (!q) {
    return {
      writers: allWriters.slice(0, 8),
      articles: enrichedArticles.slice(0, 8),
      series: allSeries.slice(0, 8),
      communities: allCommunities.slice(0, 8),
    }
  }

  // Filter across all 4 categories
  const matchedWriters = allWriters.filter(w => {
    const nameMatch = (w.full_name || '').toLowerCase().includes(q)
    const bioMatch = (w.bio || '').toLowerCase().includes(q)
    const idMatch = (w.id || '').toLowerCase().includes(q)
    return nameMatch || bioMatch || idMatch
  })

  const matchedArticles = enrichedArticles.filter(a => {
    const titleMatch = (a.title || '').toLowerCase().includes(q)
    const summaryMatch = (a.summary || '').toLowerCase().includes(q)
    const tagMatch = Array.isArray(a.tags) && a.tags.some(t => (t || '').toLowerCase().includes(q))
    const plainContent = (a.content || '').replace(/<[^>]*>/g, ' ').toLowerCase()
    const contentMatch = plainContent.includes(q)
    const authorMatch = (a.author?.full_name || '').toLowerCase().includes(q)
    return titleMatch || summaryMatch || tagMatch || contentMatch || authorMatch
  })

  const matchedSeries = allSeries.filter(s => {
    const titleMatch = (s.title || '').toLowerCase().includes(q)
    const descMatch = (s.description || '').toLowerCase().includes(q)
    return titleMatch || descMatch
  })

  const matchedCommunities = allCommunities.filter(c => {
    const nameMatch = (c.name || '').toLowerCase().includes(q)
    const descMatch = (c.description || '').toLowerCase().includes(q)
    const catMatch = (c.category || '').toLowerCase().includes(q)
    const slugMatch = (c.slug || '').toLowerCase().includes(q)
    return nameMatch || descMatch || catMatch || slugMatch
  })

  return {
    writers: matchedWriters,
    articles: matchedArticles,
    series: matchedSeries,
    communities: matchedCommunities,
  }
}


export function openGlobalSearch(initialQuery = ''): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('inkwell:open-search', { detail: { query: initialQuery } }))
  }
}
