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
  recipientEmail?: string
  recipientUserId?: string
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

export interface NewFollowerEmailOptions {
  recipientName?: string
  recipientEmail?: string
  recipientUserId?: string
  totalFollowers?: number
  appUrl?: string
}

export interface FeatureAnnouncementEmailOptions {
  recipientName?: string
  recipientEmail?: string
  recipientUserId?: string
  appUrl?: string
}

export interface WelcomeEmailOptions {
  recipientName?: string
  recipientEmail?: string
  recipientUserId?: string
  appUrl?: string
}

export interface BuiltEmailTemplate {
  subject: string
  html: string
  text: string
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

export function buildAccountAwareUrl(
  baseUrl: string,
  recipientEmail?: string,
  recipientUserId?: string
): string {
  const params: string[] = []
  if (recipientEmail?.trim()) {
    params.push(`for=${encodeURIComponent(recipientEmail.trim())}`)
  }
  if (recipientUserId?.trim()) {
    params.push(`uid=${encodeURIComponent(recipientUserId.trim())}`)
  }
  if (params.length === 0) return baseUrl
  const sep = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${sep}${params.join('&')}`
}

function buildSentToFooterHtml(recipientEmail?: string): string {
  if (!recipientEmail?.trim()) return ''
  return `<p style="margin:6px 0 0;color:#71717A;">This email was sent to <strong>${escapeHtml(recipientEmail.trim())}</strong></p>`
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
    const author =
      first.author_name?.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() ||
      'An Inkwell Writer'
    const title =
      first.title?.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim() ||
      'Untitled'
    return `New story from ${author}: "${title}"`
  }
  return `Your Inkwell Reading Digest (${articles.length} new stories)`
}

export function buildDigestHtml(options: BuildDigestOptions): string {
  const {
    articles,
    recipientName,
    recipientEmail,
    recipientUserId,
    mode = 'instant',
  } = options
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

  const preferencesUrl = buildAccountAwareUrl(
    `${appUrl}/app/profile`,
    recipientEmail,
    recipientUserId
  )
  const sentToHtml = buildSentToFooterHtml(recipientEmail)

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
              ${sentToHtml}
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
  const { articles, recipientName, recipientEmail, recipientUserId } = options
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

  const preferencesUrl = buildAccountAwareUrl(
    `${appUrl}/app/profile`,
    recipientEmail,
    recipientUserId
  )
  lines.push('----------------------------------------')
  lines.push(`Manage digest preferences: ${preferencesUrl}`)
  if (recipientEmail?.trim()) {
    lines.push(`This email was sent to ${recipientEmail.trim()}`)
  }

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
      recipientEmail: entry.email,
      recipientUserId: followerId,
      mode,
    })
    const text = buildDigestText({
      articles: entry.articles,
      appUrl,
      recipientName: entry.name,
      recipientEmail: entry.email,
      recipientUserId: followerId,
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

export function buildNewFollowerEmail(options: NewFollowerEmailOptions = {}): BuiltEmailTemplate {
  const appUrl = normalizeAppUrl(options.appUrl)
  const ctaUrl = buildAccountAwareUrl(
    `${appUrl}/app?notifications=open`,
    options.recipientEmail,
    options.recipientUserId
  )
  const subject = '✦ Someone new just followed you on Inkwell!'
  const safeRecipient = options.recipientName?.trim()
    ? escapeHtml(options.recipientName.trim())
    : ''
  const totalFollowers = Math.max(0, Number(options.totalFollowers) || 0)
  const sentToHtml = buildSentToFooterHtml(options.recipientEmail)

  const greetingHtml = safeRecipient
    ? `<p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:16px;color:#3F3F46;">Hello ${safeRecipient},</p>`
    : ''

  const milestoneHtml =
    totalFollowers > 0
      ? `<div style="margin:20px 0 24px;padding:16px 20px;background-color:#FAF8F5;border:1px solid #E6E1D6;border-radius:10px;">
           <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B45309;margin-bottom:4px;">
             Audience Milestone
           </div>
           <div style="font-family:'Playfair Display','Georgia',serif;font-size:20px;font-weight:700;color:#18181B;">
             ${totalFollowers} ${totalFollowers === 1 ? 'Reader Follows' : 'Readers Follow'} Your Work
           </div>
         </div>`
      : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
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
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B45309;margin-bottom:6px;">
                New Reader Connection
              </div>
              <h1 style="margin:0 0 6px;font-family:'Playfair Display','Georgia',serif;font-size:26px;line-height:1.25;font-weight:700;color:#18181B;">
                Someone new just followed your writing on Inkwell
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${greetingHtml}
              <p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:16px;line-height:1.7;color:#3F3F46;">
                Your words are resonating. A fellow reader on Inkwell just subscribed to follow your stories and essays.
              </p>
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:16px;line-height:1.7;color:#3F3F46;">
                We are keeping their name a surprise inside your notification drawer &mdash; step into your studio to see who just joined your reading circle and explore their profile!
              </p>
              ${milestoneHtml}
              <div style="margin-top:24px;">
                <a href="${ctaUrl}" style="display:inline-block;background-color:#B45309;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;">
                  Open Inkwell to See Who It Is &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#FAF8F5;border-top:1px solid #E6E1D6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#71717A;line-height:1.6;">
              <p style="margin:0 0 6px;">
                You are receiving this notification because you write on <a href="${appUrl}" style="color:#B45309;text-decoration:underline;">Inkwell</a>.
              </p>
              <p style="margin:0;">
                <a href="${ctaUrl}" style="color:#B45309;text-decoration:underline;">View your notifications on Inkwell</a>
              </p>
              ${sentToHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textLines: string[] = [
    'INKWELL — Someone new just followed you on Inkwell!',
    '========================================',
    '',
  ]
  if (options.recipientName?.trim()) {
    textLines.push(`Hello ${options.recipientName.trim()},`, '')
  }
  textLines.push(
    'Your words are resonating. Someone new just followed your writing on Inkwell!',
    'We are keeping their identity a surprise in this email — open Inkwell to see who it is and check out their profile.',
    ''
  )
  if (totalFollowers > 0) {
    textLines.push(
      `Audience Milestone: ${totalFollowers} ${totalFollowers === 1 ? 'reader now follows' : 'readers now follow'} your work.`,
      ''
    )
  }
  textLines.push(`Open Inkwell to See Who It Is → ${ctaUrl}`)
  if (options.recipientEmail?.trim()) {
    textLines.push('', `This email was sent to ${options.recipientEmail.trim()}`)
  }

  return {
    subject,
    html,
    text: textLines.join('\n'),
  }
}

export function buildFeatureAnnouncementEmail(
  options: FeatureAnnouncementEmailOptions = {}
): BuiltEmailTemplate {
  const appUrl = normalizeAppUrl(options.appUrl)
  const ctaUrl = buildAccountAwareUrl(
    `${appUrl}/app`,
    options.recipientEmail,
    options.recipientUserId
  )
  const subject = "✦ What's New on Inkwell: Followers, Daily Streaks, Series & Search"
  const safeRecipient = options.recipientName?.trim()
    ? escapeHtml(options.recipientName.trim())
    : ''
  const sentToHtml = buildSentToFooterHtml(options.recipientEmail)

  const greetingHtml = safeRecipient
    ? `<p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:16px;color:#3F3F46;">Hello ${safeRecipient},</p>`
    : `<p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:16px;color:#3F3F46;">Hello Writer,</p>`

  const features = [
    {
      emoji: '👥',
      title: 'Follow Writers & Email Digests',
      description: 'Follow your favorite voices and get notified when they publish.',
    },
    {
      emoji: '🔥',
      title: 'Daily Reflection Prompts & Writing Streaks',
      description: 'Keep your daily writing flame alive with the Verse of the Day.',
    },
    {
      emoji: '🔍',
      title: 'Global Search & Reading Lists',
      description:
        'Instantly search writers, articles, series, and communities, and bookmark stories for later.',
    },
    {
      emoji: '📚',
      title: 'Multi-Part Series & Version History',
      description:
        'Organize multi-part collections and restore any draft snapshot with 1 click.',
    },
    {
      emoji: '✒️',
      title: 'New Classic App Icon & Mobile Experience',
      description:
        'Faster, cleaner mobile navigation and a new classic squircle app icon.',
    },
  ]

  const featuresHtml = features
    .map(
      f => `
      <div style="padding:14px 16px;margin-bottom:12px;background-color:#FAF8F5;border:1px solid #E6E1D6;border-radius:10px;">
        <div style="font-family:'Playfair Display','Georgia',serif;font-size:17px;font-weight:700;color:#18181B;margin-bottom:4px;">
          <span style="margin-right:8px;">${f.emoji}</span>${escapeHtml(f.title)}
        </div>
        <div style="font-family:'Georgia',serif;font-size:14px;line-height:1.6;color:#52525B;">
          ${escapeHtml(f.description)}
        </div>
      </div>`
    )
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
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
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B45309;margin-bottom:6px;">
                Product Update &bull; Studio Edition
              </div>
              <h1 style="margin:0 0 6px;font-family:'Playfair Display','Georgia',serif;font-size:25px;line-height:1.25;font-weight:700;color:#18181B;">
                What&rsquo;s New on Inkwell: Followers, Daily Streaks, Series &amp; Search
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${greetingHtml}
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:15px;line-height:1.7;color:#3F3F46;">
                We have been crafting a calmer, richer home for your essays, reflections, and literary communities. Here is what is waiting for you inside Inkwell today:
              </p>
              ${featuresHtml}
              <div style="margin-top:24px;">
                <a href="${ctaUrl}" style="display:inline-block;background-color:#B45309;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;">
                  Explore the New Inkwell &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#FAF8F5;border-top:1px solid #E6E1D6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#71717A;line-height:1.6;">
              <p style="margin:0 0 6px;">
                You are receiving this studio update as a member of <a href="${appUrl}" style="color:#B45309;text-decoration:underline;">Inkwell</a>.
              </p>
              <p style="margin:0;">
                <a href="${ctaUrl}" style="color:#B45309;text-decoration:underline;">Open your Inkwell Studio</a>
              </p>
              ${sentToHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textLines: string[] = [
    "INKWELL — What's New on Inkwell: Followers, Daily Streaks, Series & Search",
    '========================================',
    '',
    options.recipientName?.trim()
      ? `Hello ${options.recipientName.trim()},`
      : 'Hello Writer,',
    '',
    'We have been crafting a calmer, richer home for your essays, reflections, and literary communities. Here is what is new inside Inkwell:',
    '',
    ...features.map(f => `${f.emoji} ${f.title} — ${f.description}`),
    '',
    `Explore the New Inkwell → ${ctaUrl}`,
  ]
  if (options.recipientEmail?.trim()) {
    textLines.push('', `This email was sent to ${options.recipientEmail.trim()}`)
  }

  return {
    subject,
    html,
    text: textLines.join('\n'),
  }
}

export function buildWelcomeEmail(
  options: WelcomeEmailOptions = {}
): BuiltEmailTemplate {
  const appUrl = normalizeAppUrl(options.appUrl)
  const ctaUrl = buildAccountAwareUrl(
    `${appUrl}/app`,
    options.recipientEmail,
    options.recipientUserId
  )
  const subject = "✦ Welcome to Inkwell — Your Writer's Sanctuary Awaits"
  const safeRecipient = options.recipientName?.trim()
    ? escapeHtml(options.recipientName.trim())
    : ''
  const sentToHtml = buildSentToFooterHtml(options.recipientEmail)

  const greetingHtml = safeRecipient
    ? `<p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:16px;color:#3F3F46;">Welcome to Inkwell, ${safeRecipient},</p>`
    : `<p style="margin:0 0 16px;font-family:'Georgia',serif;font-size:16px;color:#3F3F46;">Welcome to Inkwell,</p>`

  const steps = [
    {
      emoji: '✍️',
      title: 'Start Your First Draft or Daily Reflection',
      description:
        "Open the studio editor or respond to today's Verse of the Day to start your writing streak.",
    },
    {
      emoji: '🔍',
      title: 'Follow Writers & Build Your Reading List',
      description:
        'Search writers and stories (Ctrl+K) and subscribe to their email digests.',
    },
    {
      emoji: '🏛️',
      title: 'Personalize Your Profile & Join Communities',
      description: 'Add your bio and connect with fellow writers.',
    },
  ]

  const stepsHtml = steps
    .map(
      s => `
      <div style="padding:14px 16px;margin-bottom:12px;background-color:#FAF8F5;border:1px solid #E6E1D6;border-radius:10px;">
        <div style="font-family:'Playfair Display','Georgia',serif;font-size:17px;font-weight:700;color:#18181B;margin-bottom:4px;">
          <span style="margin-right:8px;">${s.emoji}</span>${escapeHtml(s.title)}
        </div>
        <div style="font-family:'Georgia',serif;font-size:14px;line-height:1.6;color:#52525B;">
          ${escapeHtml(s.description)}
        </div>
      </div>`
    )
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
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
              <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#B45309;margin-bottom:6px;">
                Email Confirmed &bull; Welcome Aboard
              </div>
              <h1 style="margin:0 0 6px;font-family:'Playfair Display','Georgia',serif;font-size:26px;line-height:1.25;font-weight:700;color:#18181B;">
                Your Writer&rsquo;s Sanctuary Awaits
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">
              ${greetingHtml}
              <p style="margin:0 0 20px;font-family:'Georgia',serif;font-size:15px;line-height:1.7;color:#3F3F46;">
                Your email is confirmed and your desk is ready. Inkwell was built for unhurried thinking, timeless essays, and meaningful literary connection. Here are three ways to begin today:
              </p>
              ${stepsHtml}
              <div style="margin-top:24px;">
                <a href="${ctaUrl}" style="display:inline-block;background-color:#B45309;color:#FFFFFF;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px;">
                  Open Your Writer&rsquo;s Desk &rarr;
                </a>
              </div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background-color:#FAF8F5;border-top:1px solid #E6E1D6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:12px;color:#71717A;line-height:1.6;">
              <p style="margin:0 0 6px;">
                You are receiving this welcome letter because you confirmed your account on <a href="${appUrl}" style="color:#B45309;text-decoration:underline;">Inkwell</a>.
              </p>
              <p style="margin:0;">
                <a href="${ctaUrl}" style="color:#B45309;text-decoration:underline;">Open your Inkwell Studio</a>
              </p>
              ${sentToHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  const textLines: string[] = [
    "INKWELL — Welcome to Inkwell — Your Writer's Sanctuary Awaits",
    '========================================',
    '',
    options.recipientName?.trim()
      ? `Welcome to Inkwell, ${options.recipientName.trim()},`
      : 'Welcome to Inkwell,',
    '',
    'Your email is confirmed and your desk is ready. Here are three ways to begin today:',
    '',
    ...steps.map(s => `${s.emoji} ${s.title} — ${s.description}`),
    '',
    `Open Your Writer's Desk → ${ctaUrl}`,
  ]
  if (options.recipientEmail?.trim()) {
    textLines.push('', `This email was sent to ${options.recipientEmail.trim()}`)
  }

  return {
    subject,
    html,
    text: textLines.join('\n'),
  }
}
