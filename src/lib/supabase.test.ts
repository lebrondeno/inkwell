import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeSupabaseUrl, supabaseUrl, getComments, supabase } from './supabase'

type SupabaseFromReturn = ReturnType<typeof supabase.from>

describe('supabaseUrl normalization', () => {
  it('leaves a standard URL without trailing slash unchanged', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co')).toBe('https://example.supabase.co')
  })

  it('strips a single trailing slash', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/')).toBe('https://example.supabase.co')
  })

  it('strips multiple trailing slashes', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co///')).toBe('https://example.supabase.co')
  })

  it('strips /rest/v1 suffix without trailing slash', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/rest/v1')).toBe('https://example.supabase.co')
  })

  it('strips /rest/v1/ suffix with trailing slash', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/rest/v1/')).toBe('https://example.supabase.co')
  })

  it('handles empty string or falsy input gracefully', () => {
    expect(normalizeSupabaseUrl('')).toBe('')
    expect(normalizeSupabaseUrl(undefined as unknown as string)).toBe('')
    expect(normalizeSupabaseUrl(null as unknown as string)).toBe('')
  })

  it('ensures exported supabaseUrl does not end with /rest/v1 or trailing slashes', () => {
    if (supabaseUrl) {
      expect(supabaseUrl.endsWith('/rest/v1')).toBe(false)
      expect(supabaseUrl.endsWith('/')).toBe(false)
    }
  })
})

describe('getComments profile enrichment', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty array if no comments exist and does not query writer_profiles', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [] })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.spyOn(supabase, 'from').mockReturnValue({ select: selectMock } as unknown as SupabaseFromReturn)

    const result = await getComments('article-123')

    expect(result).toEqual([])
    expect(fromMock).toHaveBeenCalledWith('article_comments')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqMock).toHaveBeenCalledWith('article_id', 'article-123')
    expect(orderMock).toHaveBeenCalledWith('created_at', { ascending: true })
    expect(fromMock).not.toHaveBeenCalledWith('writer_profiles')
  })

  it('returns empty array if comments data is null', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: null })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
    const fromMock = vi.spyOn(supabase, 'from').mockReturnValue({ select: selectMock } as unknown as SupabaseFromReturn)

    const result = await getComments('article-empty')

    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalledWith('writer_profiles')
  })

  it('fetches comments and enriches them with matching writer profiles', async () => {
    const mockComments = [
      { id: 'c1', article_id: 'art-1', user_id: 'user-a', body: 'First comment', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', article_id: 'art-1', user_id: 'user-b', body: 'Second comment', created_at: '2026-01-01T01:00:00Z' },
    ]
    const mockProfiles = [
      { id: 'user-a', full_name: 'Alice Smith', avatar_url: 'https://example.com/alice.jpg' },
      { id: 'user-b', full_name: 'Bob Jones', avatar_url: 'https://example.com/bob.jpg' },
    ]

    const inMock = vi.fn().mockResolvedValue({ data: mockProfiles })
    const profileSelectMock = vi.fn().mockReturnValue({ in: inMock })

    const orderMock = vi.fn().mockResolvedValue({ data: mockComments })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const commentSelectMock = vi.fn().mockReturnValue({ eq: eqMock })

    const fromMock = vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'article_comments') {
        return { select: commentSelectMock } as unknown as SupabaseFromReturn
      }
      if (table === 'writer_profiles') {
        return { select: profileSelectMock } as unknown as SupabaseFromReturn
      }
      throw new Error(`Unexpected table: ${table}`)
    }) as unknown as typeof supabase.from)

    const result = await getComments('art-1')

    expect(fromMock).toHaveBeenCalledWith('article_comments')
    expect(fromMock).toHaveBeenCalledWith('writer_profiles')
    expect(profileSelectMock).toHaveBeenCalledWith('id, full_name, avatar_url')
    expect(inMock).toHaveBeenCalledWith('id', ['user-a', 'user-b'])

    expect(result).toEqual([
      {
        id: 'c1',
        article_id: 'art-1',
        user_id: 'user-a',
        body: 'First comment',
        created_at: '2026-01-01T00:00:00Z',
        profile: { full_name: 'Alice Smith', avatar_url: 'https://example.com/alice.jpg' },
      },
      {
        id: 'c2',
        article_id: 'art-1',
        user_id: 'user-b',
        body: 'Second comment',
        created_at: '2026-01-01T01:00:00Z',
        profile: { full_name: 'Bob Jones', avatar_url: 'https://example.com/bob.jpg' },
      },
    ])
  })

  it('deduplicates user IDs when multiple comments share the same author', async () => {
    const mockComments = [
      { id: 'c1', article_id: 'art-1', user_id: 'user-repeat', body: 'Comment 1', created_at: '2026-01-01T00:00:00Z' },
      { id: 'c2', article_id: 'art-1', user_id: 'user-repeat', body: 'Comment 2', created_at: '2026-01-01T02:00:00Z' },
    ]
    const mockProfiles = [
      { id: 'user-repeat', full_name: 'Repeat Author', avatar_url: 'https://example.com/avatar.jpg' },
    ]

    const inMock = vi.fn().mockResolvedValue({ data: mockProfiles })
    const profileSelectMock = vi.fn().mockReturnValue({ in: inMock })

    const orderMock = vi.fn().mockResolvedValue({ data: mockComments })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const commentSelectMock = vi.fn().mockReturnValue({ eq: eqMock })

    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'article_comments') return { select: commentSelectMock } as unknown as SupabaseFromReturn
      if (table === 'writer_profiles') return { select: profileSelectMock } as unknown as SupabaseFromReturn
      throw new Error(`Unexpected table: ${table}`)
    }) as unknown as typeof supabase.from)

    const result = await getComments('art-1')

    expect(inMock).toHaveBeenCalledWith('id', ['user-repeat'])
    expect(result).toHaveLength(2)
    expect(result[0].profile).toEqual({ full_name: 'Repeat Author', avatar_url: 'https://example.com/avatar.jpg' })
    expect(result[1].profile).toEqual({ full_name: 'Repeat Author', avatar_url: 'https://example.com/avatar.jpg' })
  })

  it('handles missing profiles gracefully without throwing', async () => {
    const mockComments = [
      { id: 'c1', article_id: 'art-1', user_id: 'user-unregistered', body: 'Anonymous remark', created_at: '2026-01-01T00:00:00Z' },
    ]
    const inMock = vi.fn().mockResolvedValue({ data: [] })
    const profileSelectMock = vi.fn().mockReturnValue({ in: inMock })

    const orderMock = vi.fn().mockResolvedValue({ data: mockComments })
    const eqMock = vi.fn().mockReturnValue({ order: orderMock })
    const commentSelectMock = vi.fn().mockReturnValue({ eq: eqMock })

    vi.spyOn(supabase, 'from').mockImplementation(((table: string) => {
      if (table === 'article_comments') return { select: commentSelectMock } as unknown as SupabaseFromReturn
      if (table === 'writer_profiles') return { select: profileSelectMock } as unknown as SupabaseFromReturn
      throw new Error(`Unexpected table: ${table}`)
    }) as unknown as typeof supabase.from)

    const result = await getComments('art-1')

    expect(result).toHaveLength(1)
    expect(result[0].profile).toBeUndefined()
  })
})
