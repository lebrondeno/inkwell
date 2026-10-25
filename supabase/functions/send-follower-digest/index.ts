import { createClient } from '@supabase/supabase-js'
import {
  buildFeatureAnnouncementEmail,
  buildNewFollowerEmail,
  groupArticlesForFollowers,
  type DigestArticle,
  type DigestFollow,
  type DigestLogEntry,
} from '../_shared/emailDigest.ts'

declare const Deno: {
  env: {
    get(key: string): string | undefined
  }
  serve(handler: (req: Request) => Response | Promise<Response>): void
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface DigestRequestBody {
  mode?: 'instant' | 'weekly' | 'new_follower' | 'feature_announcement'
  articleId?: string
  followerId?: string
  followingId?: string
  targetEmail?: string
  appUrl?: string
}

interface ArticleRow {
  id: string
  user_id: string
  title: string
  slug: string
  summary?: string
  content?: string
  reading_time?: number
  cover_emoji?: string
  created_at?: string
}

interface WriterProfileRow {
  id: string
  full_name?: string
}

interface FollowRow {
  follower_id: string
  following_id: string
  email_digest?: boolean
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function sendResendSingleWithRetry(
  resendApiKey: string,
  payload: {
    from: string
    to: string[]
    subject: string
    html: string
    text: string
  },
  idempotencyKey: string
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify(payload),
    })

    const bodyText = await res.text().catch(() => '')

    if (res.ok) {
      return { ok: true, status: res.status, bodyText }
    }

    const isRetryable = res.status === 429 || res.status >= 500
    if (!isRetryable || attempt === maxAttempts) {
      return { ok: false, status: res.status, bodyText }
    }

    const retryAfterHeader = res.headers.get('retry-after')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
    const delayMs =
      !Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : Math.pow(2, attempt - 1) * 1000

    await sleep(delayMs)
  }

  return { ok: false, status: 500, bodyText: 'Max retry attempts reached' }
}

async function sendResendBatchWithRetry(
  resendApiKey: string,
  batchPayload: Array<{
    from: string
    to: string[]
    subject: string
    html: string
    text: string
  }>,
  idempotencyKey: string
): Promise<{ ok: boolean; status: number; bodyText: string }> {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify(batchPayload),
    })

    const bodyText = await res.text().catch(() => '')

    if (res.ok) {
      return { ok: true, status: res.status, bodyText }
    }

    const isRetryable = res.status === 429 || res.status >= 500
    if (!isRetryable || attempt === maxAttempts) {
      return { ok: false, status: res.status, bodyText }
    }

    const retryAfterHeader = res.headers.get('retry-after')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
    const delayMs = !Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds * 1000
      : Math.pow(2, attempt - 1) * 1000

    await sleep(delayMs)
  }

  return { ok: false, status: 500, bodyText: 'Max retry attempts reached' }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || ''
    const fromEmail =
      Deno.env.get('DIGEST_FROM_EMAIL') || 'Inkwell <onboarding@resend.dev>'

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        500
      )
    }

    const body = (await req.json().catch(() => ({}))) as DigestRequestBody
    const rawMode = body.mode || 'instant'
    const appUrl =
      body.appUrl ||
      Deno.env.get('PUBLIC_APP_URL') ||
      'https://inkwell-chi-smoky.vercel.app'

    const isConfiguredKey = Boolean(
      resendApiKey &&
        resendApiKey !== 're_your_key_here' &&
        !resendApiKey.includes('your_key')
    )

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ── MODE: new_follower ──────────────────────────────────────────
    if (rawMode === 'new_follower') {
      const followingId = body.followingId
      const followerId = body.followerId || 'reader'

      if (!followingId) {
        return jsonResponse(
          { ok: false, error: 'followingId is required for new_follower mode' },
          400
        )
      }

      const { data: userData, error: userErr } =
        await supabaseAdmin.auth.admin.getUserById(followingId)
      const recipientEmail = userData?.user?.email

      if (userErr || !recipientEmail) {
        return jsonResponse({
          ok: true,
          mode: 'new_follower',
          count: 0,
          message: 'Followed writer email not found',
        })
      }

      let recipientName =
        (userData?.user?.user_metadata?.full_name as string | undefined)?.trim() || ''

      if (!recipientName) {
        const { data: profileRow } = await supabaseAdmin
          .from('writer_profiles')
          .select('full_name')
          .eq('id', followingId)
          .single()
        if (profileRow && (profileRow as WriterProfileRow).full_name) {
          recipientName = (profileRow as WriterProfileRow).full_name || ''
        }
      }

      const { count: followerCount } = await supabaseAdmin
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', followingId)

      const totalFollowers = Math.max(1, followerCount || 1)
      const emailTemplate = buildNewFollowerEmail({
        recipientName,
        totalFollowers,
        appUrl,
      })

      if (!isConfiguredKey) {
        return jsonResponse({
          ok: true,
          mode: 'new_follower',
          simulated: true,
          count: 1,
          to: recipientEmail,
          totalFollowers,
        })
      }

      const minuteWindow = new Date().toISOString().slice(0, 16)
      const idempotencyKey = `new-follower/${followingId}-${followerId}-${minuteWindow}`
      const sendRes = await sendResendSingleWithRetry(
        resendApiKey,
        {
          from: fromEmail,
          to: [recipientEmail],
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          text: emailTemplate.text,
        },
        idempotencyKey
      )

      if (!sendRes.ok) {
        if (sendRes.status === 403) {
          return jsonResponse({
            ok: true,
            mode: 'new_follower',
            simulated: false,
            count: 0,
            skippedSandbox: 1,
            message: 'Recipient skipped due to Resend sandbox restriction',
            details: sendRes.bodyText,
          })
        }
        return jsonResponse(
          {
            ok: false,
            error: `Resend API error (${sendRes.status})`,
            details: sendRes.bodyText,
          },
          502
        )
      }

      let resendData: unknown = null
      try {
        resendData = JSON.parse(sendRes.bodyText)
      } catch {
        resendData = sendRes.bodyText
      }

      return jsonResponse({
        ok: true,
        mode: 'new_follower',
        simulated: false,
        count: 1,
        to: recipientEmail,
        totalFollowers,
        resend: resendData,
      })
    }

    // ── MODE: feature_announcement ──────────────────────────────────
    if (rawMode === 'feature_announcement') {
      const { data: usersListData, error: listErr } =
        await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })

      if (listErr) {
        return jsonResponse({ ok: false, error: listErr.message }, 500)
      }

      const allAuthUsers = usersListData?.users || []
      const targetFilter = body.targetEmail?.trim().toLowerCase()

      const { data: allProfiles } = await supabaseAdmin
        .from('writer_profiles')
        .select('id, full_name')

      const profileNameMap = new Map<string, string>()
      for (const p of (allProfiles || []) as WriterProfileRow[]) {
        if (p.id && p.full_name) {
          profileNameMap.set(p.id, p.full_name)
        }
      }

      const recipients = allAuthUsers
        .filter(u => Boolean(u.email))
        .filter(u =>
          targetFilter ? (u.email || '').toLowerCase() === targetFilter : true
        )

      if (recipients.length === 0) {
        return jsonResponse({
          ok: true,
          mode: 'feature_announcement',
          simulated: !isConfiguredKey,
          totalUsers: 0,
          sent: 0,
          skippedSandbox: 0,
          results: [],
        })
      }

      const dateKey = new Date().toISOString().slice(0, 13)
      const results: Array<{
        userId: string
        email: string
        status: 'sent' | 'simulated' | 'skipped_sandbox' | 'failed'
        details?: unknown
      }> = []

      let sentCount = 0
      let skippedSandbox = 0

      for (const user of recipients) {
        const email = user.email as string
        const metaName =
          (user.user_metadata?.full_name as string | undefined)?.trim() || ''
        const recipientName = profileNameMap.get(user.id) || metaName || ''

        const template = buildFeatureAnnouncementEmail({
          recipientName,
          appUrl,
        })

        if (!isConfiguredKey) {
          sentCount++
          results.push({ userId: user.id, email, status: 'simulated' })
          continue
        }

        const idempotencyKey = `feature-announcement/${user.id}-${dateKey}`
        const sendRes = await sendResendSingleWithRetry(
          resendApiKey,
          {
            from: fromEmail,
            to: [email],
            subject: template.subject,
            html: template.html,
            text: template.text,
          },
          idempotencyKey
        )

        if (sendRes.ok) {
          sentCount++
          let parsed: unknown = sendRes.bodyText
          try {
            parsed = JSON.parse(sendRes.bodyText)
          } catch {
            /* keep text */
          }
          results.push({ userId: user.id, email, status: 'sent', details: parsed })
        } else if (sendRes.status === 403) {
          skippedSandbox++
          results.push({
            userId: user.id,
            email,
            status: 'skipped_sandbox',
            details: sendRes.bodyText,
          })
        } else {
          results.push({
            userId: user.id,
            email,
            status: 'failed',
            details: sendRes.bodyText,
          })
        }
      }

      return jsonResponse({
        ok: true,
        mode: 'feature_announcement',
        simulated: !isConfiguredKey,
        totalUsers: recipients.length,
        sent: sentCount,
        skippedSandbox,
        results,
      })
    }

    // ── MODE: instant / weekly ──────────────────────────────────────
    const mode: 'instant' | 'weekly' = rawMode === 'weekly' ? 'weekly' : 'instant'

    // 1. Load target published articles
    let articleRows: ArticleRow[] = []

    if (mode === 'instant') {
      if (!body.articleId) {
        return jsonResponse({ ok: false, error: 'articleId is required for instant mode' }, 400)
      }
      const { data, error } = await supabaseAdmin
        .from('articles')
        .select('id, user_id, title, slug, summary, content, reading_time, cover_emoji, created_at')
        .eq('id', body.articleId)
        .eq('status', 'published')
        .single()

      if (error || !data) {
        return jsonResponse({ ok: true, count: 0, message: 'Published article not found' })
      }
      articleRows = [data as ArticleRow]
    } else {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data } = await supabaseAdmin
        .from('articles')
        .select('id, user_id, title, slug, summary, content, reading_time, cover_emoji, created_at')
        .eq('status', 'published')
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })

      articleRows = (data || []) as ArticleRow[]
    }

    if (articleRows.length === 0) {
      return jsonResponse({ ok: true, count: 0, message: 'No published articles to send' })
    }

    const authorIds = [...new Set(articleRows.map(a => a.user_id))]
    const articleIds = articleRows.map(a => a.id)

    // 2. Enrich author display names
    const { data: profiles } = await supabaseAdmin
      .from('writer_profiles')
      .select('id, full_name')
      .in('id', authorIds)

    const authorNameMap = new Map<string, string>()
    for (const p of (profiles || []) as WriterProfileRow[]) {
      if (p.id && p.full_name) {
        authorNameMap.set(p.id, p.full_name)
      }
    }

    const digestArticles: DigestArticle[] = articleRows.map(a => ({
      id: a.id,
      user_id: a.user_id,
      title: a.title,
      slug: a.slug,
      summary: a.summary,
      content: a.content,
      reading_time: a.reading_time,
      cover_emoji: a.cover_emoji,
      author_name: authorNameMap.get(a.user_id) || 'An Inkwell Writer',
      published_at: a.created_at,
    }))

    // 3. Query follows (supporting both `follows` and `writer_follows` tables)
    const followsList: FollowRow[] = []
    const seenFollowPair = new Set<string>()

    for (const tableName of ['follows', 'writer_follows']) {
      const { data } = await supabaseAdmin
        .from(tableName)
        .select('follower_id, following_id, email_digest')
        .in('following_id', authorIds)
        .eq('email_digest', true)

      for (const row of (data || []) as FollowRow[]) {
        const key = `${row.follower_id}:${row.following_id}`
        if (!seenFollowPair.has(key)) {
          seenFollowPair.add(key)
          followsList.push(row)
        }
      }
    }

    if (followsList.length === 0) {
      return jsonResponse({ ok: true, count: 0, message: 'No followers subscribed to email digest' })
    }

    // 4. Query digest_logs to skip already-sent (follower_id, article_id) pairs
    const { data: existingLogs } = await supabaseAdmin
      .from('digest_logs')
      .select('follower_id, article_id')
      .in('article_id', articleIds)

    const sentLogs: DigestLogEntry[] = ((existingLogs || []) as DigestLogEntry[]).map(l => ({
      follower_id: l.follower_id,
      article_id: l.article_id,
    }))

    // 5. Resolve follower email addresses via auth.admin.getUserById
    const uniqueFollowerIds = [...new Set(followsList.map(f => f.follower_id))]
    const followerEmails: Record<string, string> = {}
    const followerNames: Record<string, string> = {}

    for (const followerId of uniqueFollowerIds) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(followerId)
      const email = userData?.user?.email
      if (email) {
        followerEmails[followerId] = email
      }
      const metaName = userData?.user?.user_metadata?.full_name
      if (typeof metaName === 'string' && metaName.trim()) {
        followerNames[followerId] = metaName.trim()
      }
    }

    const enrichedFollows: DigestFollow[] = followsList.map(f => ({
      follower_id: f.follower_id,
      following_id: f.following_id,
      email_digest: f.email_digest ?? true,
      follower_email: followerEmails[f.follower_id],
      follower_name: followerNames[f.follower_id],
    }))

    // 6. Build deduplicated email payloads
    const allPayloads = groupArticlesForFollowers({
      follows: enrichedFollows,
      articles: digestArticles,
      sentLogs,
      followerEmails,
      appUrl,
      mode,
    })

    const sendablePayloads = allPayloads.filter(p => Boolean(p.to))

    if (sendablePayloads.length === 0) {
      return jsonResponse({
        ok: true,
        simulated: !isConfiguredKey,
        count: 0,
        logged: 0,
        mode,
      })
    }

    if (isConfiguredKey) {
      // 7. Dispatch via Resend batch API in chunks of up to 100 emails with Idempotency-Key
      const batchSize = 100
      const dateKey = new Date().toISOString().split('T')[0]
      const entityKey = body.articleId || dateKey

      for (let i = 0; i < sendablePayloads.length; i += batchSize) {
        const chunk = sendablePayloads.slice(i, i + batchSize)
        const batchRequest = chunk.map(p => ({
          from: fromEmail,
          to: [p.to as string],
          subject: p.subject,
          html: p.html,
          text: p.text,
        }))

        const chunkIdx = Math.floor(i / batchSize)
        const idempotencyKey = `batch-digest/${mode}-${entityKey}-${chunkIdx}`
        const resendResult = await sendResendBatchWithRetry(
          resendApiKey,
          batchRequest,
          idempotencyKey
        )

        if (!resendResult.ok) {
          return jsonResponse(
            {
              ok: false,
              error: `Resend API error (${resendResult.status})`,
              details: resendResult.bodyText,
            },
            502
          )
        }
      }
    }

    // 8. Record sent (follower_id, article_id) pairs in public.digest_logs
    const logRows = sendablePayloads.flatMap(p =>
      p.articleIds.map(articleId => ({
        follower_id: p.followerId,
        article_id: articleId,
        sent_at: new Date().toISOString(),
      }))
    )

    if (logRows.length > 0) {
      await supabaseAdmin
        .from('digest_logs')
        .upsert(logRows, { onConflict: 'follower_id,article_id' })
    }

    return jsonResponse({
      ok: true,
      simulated: !isConfiguredKey,
      count: sendablePayloads.length,
      logged: logRows.length,
      mode,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal Edge Function error'
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
