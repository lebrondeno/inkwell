import { describe, it, expect, vi } from 'vitest'
import {
  buildDigestHtml,
  buildDigestSubject,
  buildDigestText,
  groupArticlesForFollowers,
  type DigestArticle,
  type DigestFollow,
  type DigestLogEntry,
} from './emailDigest'
import { supabase, triggerFollowerEmailDigest } from './supabase'

describe('Email Digest Builder (src/lib/emailDigest.ts)', () => {
  const sampleArticle: DigestArticle = {
    id: 'art-1',
    user_id: 'author-1',
    title: 'The Quiet Craft of Essay Writing',
    slug: 'quiet-craft-essay-writing',
    summary: 'Exploring how deliberate pacing transforms modern long-form prose.',
    reading_time: 6,
    cover_emoji: '✒️',
    author_name: 'Clara Vance',
  }

  const secondArticle: DigestArticle = {
    id: 'art-2',
    user_id: 'author-2',
    title: 'Notes on Morning Light',
    slug: 'notes-on-morning-light',
    summary: 'Reflections on solitude and early notebooks.',
    reading_time: 4,
    cover_emoji: '🌅',
    author_name: 'Julian Mercer',
  }

  describe('buildDigestSubject', () => {
    it('formats single-article subject with author and title', () => {
      const subject = buildDigestSubject([sampleArticle])
      expect(subject).toBe('New story from Clara Vance: "The Quiet Craft of Essay Writing"')
    })

    it('formats multi-article subject with story count', () => {
      const subject = buildDigestSubject([sampleArticle, secondArticle])
      expect(subject).toBe('Your Inkwell Reading Digest (2 new stories)')
    })

    it('returns fallback subject when article list is empty', () => {
      expect(buildDigestSubject([])).toBe('Your Inkwell Reading Digest')
    })
  })

  describe('buildDigestHtml & buildDigestText', () => {
    it('renders Inkwell literary palette, article link, author name, and reading time', () => {
      const html = buildDigestHtml({
        articles: [sampleArticle],
        appUrl: 'https://inkwell.example.com/',
        recipientName: 'Elena',
      })

      expect(html).toContain('#FAF8F5')
      expect(html).toContain('#FFFFFF')
      expect(html).toContain('#18181B')
      expect(html).toContain('#B45309')
      expect(html).toContain('New story from Clara Vance')
      expect(html).toContain('The Quiet Craft of Essay Writing')
      expect(html).toContain('6 min read')
      expect(html).toContain('Exploring how deliberate pacing transforms modern long-form prose.')
      expect(html).toContain('https://inkwell.example.com/p/quiet-craft-essay-writing')
      expect(html).toContain('Read on Inkwell')
      expect(html).toContain('Manage digest preferences')
      expect(html).toContain('Hello Elena,')
    })

    it('escapes unsafe HTML in title, author name, summary, and recipient name', () => {
      const maliciousArticle: DigestArticle = {
        id: 'art-xss',
        user_id: 'author-xss',
        title: '<script>alert("xss")</script>Title',
        slug: 'safe-slug',
        summary: '<img src=x onerror=alert(1)>Summary & "Quotes"',
        reading_time: 3,
        author_name: '<b>Bad Author</b>',
      }

      const html = buildDigestHtml({
        articles: [maliciousArticle],
        appUrl: 'https://inkwell.example.com',
        recipientName: '<svg onload=alert(2)>',
      })

      expect(html).not.toContain('<script>')
      expect(html).not.toContain('<img src=x')
      expect(html).not.toContain('<b>Bad Author</b>')
      expect(html).not.toContain('<svg onload=alert(2)>')
      expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;Title')
      expect(html).toContain('&lt;b&gt;Bad Author&lt;/b&gt;')
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;Summary &amp; &quot;Quotes&quot;')
    })

    it('builds plain-text alternative with article links and reading time', () => {
      const text = buildDigestText({
        articles: [sampleArticle, secondArticle],
        appUrl: 'https://inkwell.example.com',
        recipientName: 'Reader',
      })

      expect(text).toContain('Your Inkwell Reading Digest (2 new stories)')
      expect(text).toContain('By Clara Vance • 6 min read')
      expect(text).toContain('Read on Inkwell → https://inkwell.example.com/p/quiet-craft-essay-writing')
      expect(text).toContain('Read on Inkwell → https://inkwell.example.com/p/notes-on-morning-light')
      expect(text).toContain('Manage digest preferences: https://inkwell.example.com/app/profile')
    })
  })

  describe('groupArticlesForFollowers', () => {
    it('filters out followers with email_digest: false and deduplicates against digest_logs', () => {
      const follows: DigestFollow[] = [
        {
          follower_id: 'follower-1',
          following_id: 'author-1',
          email_digest: true,
          follower_email: 'f1@example.com',
          follower_name: 'Reader One',
        },
        {
          follower_id: 'follower-1',
          following_id: 'author-2',
          email_digest: true,
          follower_email: 'f1@example.com',
        },
        {
          follower_id: 'follower-2',
          following_id: 'author-1',
          email_digest: false, // opted out of email digests
          follower_email: 'f2@example.com',
        },
        {
          follower_id: 'follower-3',
          following_id: 'author-1',
          email_digest: true,
          follower_email: 'f3@example.com',
        },
      ]

      // follower-3 already received art-1; follower-1 already received art-1 but NOT art-2
      const sentLogs: DigestLogEntry[] = [
        { follower_id: 'follower-3', article_id: 'art-1' },
        { follower_id: 'follower-1', article_id: 'art-1' },
      ]

      const payloads = groupArticlesForFollowers({
        follows,
        articles: [sampleArticle, secondArticle],
        sentLogs,
        appUrl: 'https://inkwell.example.com',
      })

      // Only follower-1 should get an email, containing only art-2
      expect(payloads).toHaveLength(1)
      expect(payloads[0].followerId).toBe('follower-1')
      expect(payloads[0].to).toBe('f1@example.com')
      expect(payloads[0].articleIds).toEqual(['art-2'])
      expect(payloads[0].subject).toBe('New story from Julian Mercer: "Notes on Morning Light"')
    })

    it('combines multiple unsent articles for a single follower into one digest payload', () => {
      const follows: DigestFollow[] = [
        {
          follower_id: 'follower-1',
          following_id: 'author-1',
          email_digest: true,
          follower_email: 'f1@example.com',
        },
        {
          follower_id: 'follower-1',
          following_id: 'author-2',
          email_digest: true,
          follower_email: 'f1@example.com',
        },
      ]

      const payloads = groupArticlesForFollowers({
        follows,
        articles: [sampleArticle, secondArticle],
        sentLogs: [],
        appUrl: 'https://inkwell.example.com',
        mode: 'weekly',
      })

      expect(payloads).toHaveLength(1)
      expect(payloads[0].articleIds).toEqual(['art-1', 'art-2'])
      expect(payloads[0].subject).toBe('Your Inkwell Reading Digest (2 new stories)')
      expect(payloads[0].html).toContain('Your Inkwell Reading Digest')
    })
  })

  describe('triggerFollowerEmailDigest client helper', () => {
    it('invokes send-follower-digest Edge Function and fails gracefully on error', async () => {
      const invokeMock = vi
        .fn()
        .mockResolvedValueOnce({ data: { ok: true, simulated: true, count: 2 }, error: null })
        .mockRejectedValueOnce(new Error('Edge Function not found'))

      vi.spyOn(supabase, 'functions', 'get').mockReturnValue({
        invoke: invokeMock,
      } as unknown as typeof supabase.functions)

      const res = await triggerFollowerEmailDigest('art-123')
      expect(invokeMock).toHaveBeenCalledWith('send-follower-digest', {
        body: {
          mode: 'instant',
          articleId: 'art-123',
          appUrl: 'https://inkwell-chi-smoky.vercel.app',
        },
      })
      expect(res).toEqual({ ok: true, simulated: true, count: 2 })

      // Simulate Edge Function not deployed yet / network error
      const fallbackRes = await triggerFollowerEmailDigest('art-123')
      expect(fallbackRes).toEqual({ ok: false })
    })
  })
})
