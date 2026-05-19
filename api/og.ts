import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Article {
  id: string;
  user_id: string;
  title: string;
  content: string;
  summary: string;
  status: string;
  tags: string[];
  slug: string;
  word_count: number;
  reading_time: number;
  cover_emoji: string;
  bible_verse?: string;
  view_count?: number;
  created_at: string;
  updated_at: string;
}

interface WriterProfile {
  id: string;
  full_name: string;
  bio: string;
  avatar_url: string;
  created_at: string;
}

/**
 * Generates a dynamic OG image for article sharing on social media.
 * This endpoint creates a beautiful preview image with article metadata.
 * 
 * Query parameters:
 * - slug: Article slug (required)
 * - width: Image width (default: 1200)
 * - height: Image height (default: 630)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { slug, width = '1200', height = '630' } = req.query;

  // Validate slug parameter
  if (!slug || typeof slug !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid slug parameter' });
  }

  try {
    // Fetch article from Supabase
    const { data: article, error: articleError } = await supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (articleError || !article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Fetch author profile
    const { data: author } = await supabase
      .from('writer_profiles')
      .select('*')
      .eq('id', article.user_id)
      .single();

    // Generate HTML for the preview image
    const html = generateOGImageHTML(article as Article, author as WriterProfile | null, parseInt(width as string), parseInt(height as string));

    // Return HTML as response (Vercel will handle rendering via Playwright/Puppeteer)
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(html);
  } catch (error) {
    console.error('Error generating OG image:', error);
    return res.status(500).json({ error: 'Failed to generate preview image' });
  }
}

/**
 * Generates HTML for the OG preview image.
 * This creates a visually appealing card with article metadata.
 */
function generateOGImageHTML(
  article: Article,
  author: WriterProfile | null,
  width: number,
  height: number
): string {
  const authorName = author?.full_name || 'Anonymous';
  const publishedDate = new Date(article.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Truncate title to fit better
  const maxTitleLength = 60;
  const displayTitle = article.title.length > maxTitleLength
    ? article.title.substring(0, maxTitleLength) + '...'
    : article.title;

  // Truncate summary
  const maxSummaryLength = 120;
  const displaySummary = article.summary && article.summary.length > maxSummaryLength
    ? article.summary.substring(0, maxSummaryLength) + '...'
    : article.summary;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Inkwell - ${article.title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
          background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: ${width}px;
          height: ${height}px;
          overflow: hidden;
        }

        .container {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 60px;
          background: linear-gradient(135deg, rgba(10, 10, 15, 0.95) 0%, rgba(26, 26, 46, 0.95) 100%);
          position: relative;
          overflow: hidden;
        }

        /* Decorative background elements */
        .container::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -10%;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(134, 59, 255, 0.15) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .container::after {
          content: '';
          position: absolute;
          bottom: -20%;
          left: -5%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(134, 59, 255, 0.1) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 100%;
        }

        .header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 40px;
        }

        .logo {
          font-size: 32px;
          font-weight: bold;
          color: #863bff;
          letter-spacing: 2px;
        }

        .logo-text {
          font-size: 18px;
          color: #999;
          font-weight: 300;
          letter-spacing: 1px;
        }

        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .emoji {
          font-size: 72px;
          margin-bottom: 24px;
          display: inline-block;
        }

        .title {
          font-size: 48px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.2;
          margin-bottom: 20px;
          letter-spacing: -0.5px;
        }

        .summary {
          font-size: 20px;
          color: #b0b0c0;
          line-height: 1.5;
          margin-bottom: 30px;
          font-weight: 400;
        }

        .tags {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 30px;
        }

        .tag {
          background: rgba(134, 59, 255, 0.2);
          color: #b8a3ff;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 500;
          border: 1px solid rgba(134, 59, 255, 0.3);
        }

        .footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 30px;
          border-top: 1px solid rgba(134, 59, 255, 0.2);
        }

        .author-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .author-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #863bff, #6b2cff);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 18px;
        }

        .author-details {
          display: flex;
          flex-direction: column;
        }

        .author-name {
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        }

        .author-date {
          color: #888;
          font-size: 14px;
          font-weight: 400;
        }

        .meta {
          display: flex;
          gap: 20px;
          color: #888;
          font-size: 14px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .branding {
          color: #863bff;
          font-weight: 600;
          letter-spacing: 1px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="content">
          <div class="header">
            <div>
              <div class="logo">✦</div>
              <div class="logo-text">INKWELL</div>
            </div>
          </div>

          <div class="main">
            <div class="emoji">${article.cover_emoji || '✦'}</div>
            <h1 class="title">${escapeHtml(displayTitle)}</h1>
            ${displaySummary ? `<p class="summary">${escapeHtml(displaySummary)}</p>` : ''}
            ${article.tags && article.tags.length > 0 ? `
              <div class="tags">
                ${article.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <div class="footer">
            <div class="author-info">
              <div class="author-avatar">${getInitials(authorName)}</div>
              <div class="author-details">
                <div class="author-name">${escapeHtml(authorName)}</div>
                <div class="author-date">${publishedDate}</div>
              </div>
            </div>
            <div class="meta">
              ${article.reading_time ? `<div class="meta-item">📖 ${article.reading_time} min read</div>` : ''}
              ${article.view_count ? `<div class="meta-item">👁️ ${formatNumber(article.view_count)} views</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Escapes HTML special characters to prevent injection.
 */
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

/**
 * Gets initials from a name for the avatar.
 */
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '✦';
}

/**
 * Formats large numbers for display.
 */
function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}
