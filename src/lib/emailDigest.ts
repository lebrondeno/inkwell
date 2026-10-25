export interface DigestArticle {
  id: string
  user_id: string
  title: string
  slug: string
  summary?: string
  content?: string
  reading_time?: number
  cover_emoji?: string
  author_name?: string
  published_at?: string
}

export interface DigestFollow {
  follower_id: string
  following_id: string
  email_digest?: boolean
  follower_email?: string
  follower_name?: string
}

export interface DigestLogEntry {
  follower_id: string
  article_id: string
}

export interface BuildDigestOptions {
  articles: DigestArticle[]
  appUrl?: string
  recipientName?: string
  mode?: 'instant' | 'weekly'
}

export interface GroupArticlesParams {
  follows: DigestFollow[]
  articles: DigestArticle[]
  sentLogs?: DigestLogEntry[]
  followerEmails?: Record<string, string>
  appUrl?: string
  mode?: 'instant' | 'weekly'
}

export interface DigestEmailPayload {
  followerId: string
  to?: string
  subject: string
  html: string
  text: string
  articleIds: string[]
  articles: DigestArticle[]
}

const DEFAULT_APP_URL = 'https://inkwell-chi-smoky.vercel.app'

export function escapeHtml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function normalizeAppUrl(appUrl?: string): string {
  const cleaned = (appUrl || DEFAULT_APP_URL).trim().replace(/\/+$/, '')
  return cleaned || DEFAULT_APP_URL
}

function getArticleSummary(article: DigestArticle): string {
  if (article.summary && article.summary.trim()) {
    return article.summary.trim()
  }
  if (article.content) {
    const plain = article.content
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (plain.length <= 200) return plain
    return `${plain.slice(0, 197).trim()}...`
  }
  return 'Read the full piece on Inkwell.'
}

export function buildDigestSubject(articles: DigestArticle[]): string {
  if (!articles || articles.length === 0) {
    return 'Your Inkwell Reading Digest'
  }
  if (articles.length === 1) {
    const first = articles[0]
    const author = first.author_name?.trim() || 'An Inkwell Writer'
    const title = first.title?.trim() || 'Untitled'
    return `New story from ${author}: "${title}"`
  }
  return `Your Inkwell Reading Digest (${articles.length} new stories)`
}

export function buildDigestHtml(options: BuildDigestOptions): string {
  const { articles, recipientName, mode = 'instant' } = options
  const appUrl = normalizeAppUrl(options.appUrl)
  const isSingle = articles.length === 1
  const firstAuthor = escapeHtml(articles[0]?.author_name?.trim() || 'An Inkwell Writer')

  const headerHeadline = isSingle
    ? `New story from ${firstAuthor}`
    : 'Your Inkwell Reading Digest'

  const headerSub = isSingle
    ? 'Freshly published on Inkwell for followers'
    : mode === 'weekly'
      ? `Your curated weekly roundup of ${articles.length} stories from writers you follow`
      : `${articles.length} new stories from writers you follow`

  const greetingHtml = recipientName?.trim()
    ? `<p style="margin:0 0 18px;font-family:'Georgia',serif;font-size:15px;color:#52525B;">Hello ${escapeHtml(recipientName.trim())},</p>`
    : ''

  const articlesHtml = articles
    .map((article, index) => {
      const title = escapeHtml(article.title?.trim() || 'Untitled')
      const author = escapeHtml(article.author_name?.trim() || 'An Inkwell Writer')
      const summary = escapeHtml(getArticleSummary(article))
      const emoji = escapeHtml(article.cover_emoji?.trim() || '✦')
      const readingTime = Math.max(1, Number(article.reading_time) || 1)
      const safeSlug = encodeURIComponent((article.slug || '').trim())
      const articleUrl = `${appUrl}/p/${safeSlug}`
      const divider =
        index < articles.length - 1
          ? 'border-bottom:1px solid #E6E1D6;padding-bottom:28px;margin-bottom:28px;'
          : ''

      return `
        <div style="${divider}">
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#B45309;margin-bottom:8px;">
            <span>${emoji}</span>
            <span style="margin-left:6px;">${author}</span>
            <span style="color:#A1A1AA;margin:0 6px;">&bull;</span>
            <span style="color:#71717A;font-weight:500;text-transform:none;letter-spacing:0;">${readingTime} min read</span>
          </div>
          <h2 style="margin:0 0 10px;font-family:'Playfair Display','Georgia',serif;font-size:22px;line-height:1.3;font-weight:700;color:#18181B;">
            <a href="${articleUrl}" style="color:#18181B;text-decoration:none;">${title}</a>
          </h2>
          <p style="margin:0 0 18px;font-family:'Georgia',serif;font-size:15px;line-height:1.65;color:#3F3F46;">
            ${summary}
          </p>
          <div>
            <a href="${articleUrl}" style="display:inline-block;background-color:#B45309;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:6px;">
              Read on Inkwell &rarr;
            </a>
          </div>
        </div>
      `.trim()
    })
    .join('\n')

  const preferencesUrl = `${appUrl}/app/profile`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(headerHeadline)}</title>
</head>
<body style="margin:0;padding:0;background-color:#FAF8F5;color:#18181B;font-family:'Georgia',serif;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF8F5;padding:36px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border:1px solid #E6E1D6;border-radius:12px;overflow:hidden;box-shadow:0 4px 18px rgba(24,24,27,0.04);">
          <!-- Top Bronze Accent Bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#B45309 0%,#D97706 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #F1EDE4;">
              <div style="font-family:'Playfair Display','Georgia',serif;font-size:18px;font-weight:700;color:#18181B;letter-spacing:-0.01em;margin-bottom:12px;">
                <span style="color:#B45309;">&#10022;</span> Inkwell
              </div>
              <h1 style="margin:0 0 6px;font-family:'Playfair Display','Georgia',serif;font-size:24px;line-height:1.25;font-weight:700;color:#18181B;">
                ${headerHeadline}
              </h1>
              <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;color:#71717A;">
                ${escapeHtml(headerSub)}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${greetingHtml}
              ${articlesHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#FAF8F5;border-top:1px solid #E6E1D6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#71717A;line-height:1.6;">
              <p style="margin:0 0 6px;">
                You are receiving this email because you follow writers on <a href="${appUrl}" style="color:#B45309;text-decoration:underline;">Inkwell</a> with email digests enabled.
              </p>
              <p style="margin:0;">
                <a href="${preferencesUrl}" style="color:#B45309;text-decoration:underline;">Manage digest preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildDigestText(options: BuildDigestOptions): string {
  const { articles, recipientName } = options
  const appUrl = normalizeAppUrl(options.appUrl)
  const isSingle = articles.length === 1
  const firstAuthor = articles[0]?.author_name?.trim() || 'An Inkwell Writer'

  const header = isSingle
    ? `New story from ${firstAuthor}`
    : `Your Inkwell Reading Digest (${articles.length} new stories)`

  const lines: string[] = [
    `INKWELL — ${header}`,
    '========================================',
    '',
  ]

  if (recipientName?.trim()) {
    lines.push(`Hello ${recipientName.trim()},`, '')
  }

  for (const article of articles) {
    const title = article.title?.trim() || 'Untitled'
    const author = article.author_name?.trim() || 'An Inkwell Writer'
    const readingTime = Math.max(1, Number(article.reading_time) || 1)
    const summary = getArticleSummary(article)
    const url = `${appUrl}/p/${encodeURIComponent((article.slug || '').trim())}`

    lines.push(`${title}`)
    lines.push(`By ${author} • ${readingTime} min read`)
    lines.push(`${summary}`)
    lines.push(`Read on Inkwell → ${url}`)
    lines.push('')
  }

  lines.push('----------------------------------------')
  lines.push(`Manage digest preferences: ${appUrl}/app/profile`)

  return lines.join('\n')
}

export function groupArticlesForFollowers(params: GroupArticlesParams): DigestEmailPayload[] {
  const {
    follows,
    articles,
    sentLogs = [],
    followerEmails = {},
    appUrl,
    mode = 'instant',
  } = params

  const sentSet = new Set<string>(
    sentLogs.map(log => `${log.follower_id}:${log.article_id}`)
  )

  const articlesByAuthor = new Map<string, DigestArticle[]>()
  for (const article of articles) {
    if (!article?.id || !article?.user_id) continue
    const list = articlesByAuthor.get(article.user_id) || []
    list.push(article)
    articlesByAuthor.set(article.user_id, list)
  }

  const followerMap = new Map<
    string,
    {
      email?: string
      name?: string
      articles: DigestArticle[]
      seenArticles: Set<string>
    }
  >()

  for (const follow of follows) {
    if (!follow.follower_id || !follow.following_id) continue
    if (follow.follower_id === follow.following_id) continue
    if (follow.email_digest !== true) continue

    const authorArticles = articlesByAuthor.get(follow.following_id)
    if (!authorArticles || authorArticles.length === 0) continue

    let entry = followerMap.get(follow.follower_id)
    if (!entry) {
      entry = {
        email: follow.follower_email || followerEmails[follow.follower_id],
        name: follow.follower_name,
        articles: [],
        seenArticles: new Set<string>(),
      }
      followerMap.set(follow.follower_id, entry)
    } else {
      if (!entry.email && (follow.follower_email || followerEmails[follow.follower_id])) {
        entry.email = follow.follower_email || followerEmails[follow.follower_id]
      }
      if (!entry.name && follow.follower_name) {
        entry.name = follow.follower_name
      }
    }

    for (const article of authorArticles) {
      const logKey = `${follow.follower_id}:${article.id}`
      if (sentSet.has(logKey) || entry.seenArticles.has(article.id)) {
        continue
      }
      entry.seenArticles.add(article.id)
      entry.articles.push(article)
    }
  }

  const payloads: DigestEmailPayload[] = []

  for (const [followerId, entry] of followerMap.entries()) {
    if (entry.articles.length === 0) continue

    const subject = buildDigestSubject(entry.articles)
    const html = buildDigestHtml({
      articles: entry.articles,
      appUrl,
      recipientName: entry.name,
      mode,
    })
    const text = buildDigestText({
      articles: entry.articles,
      appUrl,
      recipientName: entry.name,
      mode,
    })

    payloads.push({
      followerId,
      to: entry.email,
      subject,
      html,
      text,
      articleIds: entry.articles.map(a => a.id),
      articles: entry.articles,
    })
  }

  return payloads
}
