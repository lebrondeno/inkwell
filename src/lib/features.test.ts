import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveArticleVersion,
  getArticleVersions,
  restoreArticleVersion,
  followWriter,
  unfollowWriter,
  isFollowingWriter,
  toggleFollowDigest,
  getWritingStreak,
  recordWritingActivity,
  supabase,
} from './supabase'

function createMockLocalStorage() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] || null,
    get length() {
      return Object.keys(store).length
    },
  }
}

describe('Article Version History Snapshots', () => {
  const articleId = 'test-art-101'
  const userId = 'user-writer-1'
  let mockStorage: ReturnType<typeof createMockLocalStorage>

  beforeEach(() => {
    mockStorage = createMockLocalStorage()
    const glob = globalThis as unknown as Record<string, unknown>
    glob.window = { localStorage: mockStorage }
    glob.localStorage = mockStorage
    vi.restoreAllMocks()
    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [] }),
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>)
  })

  afterEach(() => {
    const glob = globalThis as unknown as Record<string, unknown>
    delete glob.window
    delete glob.localStorage
  })

  it('saves an article version snapshot with calculated word count and reason', async () => {
    const snapshot = {
      title: 'The Great Essay',
      content: '<p>One two three four five six.</p>',
      summary: 'A short overview of the essay.',
      reason: 'Before AI Apply',
    }

    const version = await saveArticleVersion(articleId, userId, snapshot)

    expect(version).toBeDefined()
    expect(version.article_id).toBe(articleId)
    expect(version.user_id).toBe(userId)
    expect(version.title).toBe('The Great Essay')
    expect(version.content).toBe('<p>One two three four five six.</p>')
    expect(version.reason).toBe('Before AI Apply')
    expect(version.word_count).toBe(6)
    expect(version.id).toMatch(/^ver_/)
  })

  it('persists and retrieves version history across multiple checkpoints', async () => {
    await saveArticleVersion(articleId, userId, {
      title: 'V1',
      content: '<p>First paragraph.</p>',
      reason: 'Initial Draft',
    })

    await saveArticleVersion(articleId, userId, {
      title: 'V2',
      content: '<p>First paragraph.</p><p>Second paragraph added.</p>',
      reason: 'Saved checkpoint',
    })

    const versions = await getArticleVersions(articleId)
    expect(versions).toHaveLength(2)
    expect(versions[0].reason).toBe('Saved checkpoint')
    expect(versions[1].reason).toBe('Initial Draft')
  })

  it('restores a specific version snapshot by id', async () => {
    const v1 = await saveArticleVersion(articleId, userId, {
      title: 'Original Title',
      content: '<p>Original prose</p>',
      reason: 'Before AI Apply',
    })

    await saveArticleVersion(articleId, userId, {
      title: 'Modified Title',
      content: '<p>Altered prose</p>',
      reason: 'After AI Apply',
    })

    const restored = await restoreArticleVersion(v1.id, articleId)
    expect(restored).toBeDefined()
    expect(restored?.title).toBe('Original Title')
    expect(restored?.content).toBe('<p>Original prose</p>')
    expect(restored?.reason).toBe('Before AI Apply')
  })
})

describe('Follow System & Self-Check Validation', () => {
  let mockStorage: ReturnType<typeof createMockLocalStorage>

  beforeEach(() => {
    mockStorage = createMockLocalStorage()
    const glob = globalThis as unknown as Record<string, unknown>
    glob.window = { localStorage: mockStorage }
    glob.localStorage = mockStorage
    vi.restoreAllMocks()
    vi.spyOn(supabase, 'from').mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    } as unknown as ReturnType<typeof supabase.from>)
  })

  afterEach(() => {
    const glob = globalThis as unknown as Record<string, unknown>
    delete glob.window
    delete glob.localStorage
  })

  it('rejects self-follow validation by throwing an Error', async () => {
    const sameUserId = 'writer-abc'
    await expect(followWriter(sameUserId, sameUserId)).rejects.toThrow('Cannot follow yourself')
  })

  it('allows following another writer and confirms follow status', async () => {
    const follower = 'reader-1'
    const targetWriter = 'writer-2'

    expect(await isFollowingWriter(follower, targetWriter)).toBe(false)

    const result = await followWriter(follower, targetWriter)
    expect(result.success).toBe(true)

    expect(await isFollowingWriter(follower, targetWriter)).toBe(true)
  })

  it('unfollows a writer cleanly', async () => {
    const follower = 'reader-1'
    const targetWriter = 'writer-2'

    await followWriter(follower, targetWriter)
    expect(await isFollowingWriter(follower, targetWriter)).toBe(true)

    await unfollowWriter(follower, targetWriter)
    expect(await isFollowingWriter(follower, targetWriter)).toBe(false)
  })

  it('toggles email digest preference when following', async () => {
    const follower = 'reader-1'
    const targetWriter = 'writer-2'

    await followWriter(follower, targetWriter)
    const toggled = await toggleFollowDigest(follower, targetWriter, false)
    expect(toggled).toBe(false)

    const reenabled = await toggleFollowDigest(follower, targetWriter, true)
    expect(reenabled).toBe(true)
  })
})

describe('Writing Streak Calculation', () => {
  const userId = 'streak-tester-1'
  let mockStorage: ReturnType<typeof createMockLocalStorage>

  beforeEach(() => {
    mockStorage = createMockLocalStorage()
    const glob = globalThis as unknown as Record<string, unknown>
    glob.window = { localStorage: mockStorage }
    glob.localStorage = mockStorage
    vi.restoreAllMocks()
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [] }),
      }),
    } as unknown as ReturnType<typeof supabase.from>)
  })

  afterEach(() => {
    const glob = globalThis as unknown as Record<string, unknown>
    delete glob.window
    delete glob.localStorage
  })

  it('returns zero streak for user with no recorded writing activity', async () => {
    const streak = await getWritingStreak(userId)
    expect(streak.currentStreak).toBe(0)
    expect(streak.longestStreak).toBe(0)
    expect(streak.lastActiveDate).toBeNull()
  })

  it('records today activity and returns 1-day streak', async () => {
    recordWritingActivity(userId)
    const streak = await getWritingStreak(userId)

    expect(streak.currentStreak).toBe(1)
    expect(streak.longestStreak).toBe(1)
    expect(streak.lastActiveDate).toBe(new Date().toISOString().split('T')[0])
  })

  it('calculates multi-day consecutive streak correctly across yesterday and today', async () => {
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]

    // Simulate 3 consecutive days of writing
    mockStorage.setItem(
      `inkwell_streak_${userId}`,
      JSON.stringify({ dates: [twoDaysAgo, yesterday, today] })
    )

    const streak = await getWritingStreak(userId)
    expect(streak.currentStreak).toBe(3)
    expect(streak.longestStreak).toBe(3)
    expect(streak.lastActiveDate).toBe(today)
  })

  it('preserves longest streak when there is an activity gap', async () => {
    const today = new Date().toISOString().split('T')[0]
    const pastDays = [
      '2026-08-01',
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      today,
    ]

    mockStorage.setItem(
      `inkwell_streak_${userId}`,
      JSON.stringify({ dates: pastDays })
    )

    const streak = await getWritingStreak(userId)
    expect(streak.currentStreak).toBe(1)
    expect(streak.longestStreak).toBe(5)
  })
})
