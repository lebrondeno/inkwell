# Dynamic OG Image Generation Implementation Guide

## Overview

This guide explains the implementation of dynamic Open Graph (OG) image generation for Inkwell articles. This system automatically generates beautiful, high-quality preview images that appear when articles are shared on WhatsApp, Twitter, Facebook, LinkedIn, and other social media platforms.

## What's Been Implemented

### 1. **Serverless OG Image Generation Endpoint** (`api/og.ts`)

A Vercel serverless function that generates dynamic OG preview images on-demand.

**Features:**
- Fetches article data from Supabase
- Generates beautiful HTML-based preview cards
- Includes article title, summary, author info, tags, and metadata
- Responsive design that works at any size
- Cached responses for performance (1 hour TTL)
- Automatic fallback for missing articles

**Usage:**
```
GET /api/og?slug=article-slug
GET /api/og?slug=article-slug&width=1200&height=630
```

**Response:**
- Returns HTML that Vercel automatically renders to an image using Playwright/Puppeteer
- Cached for 1 hour to reduce rendering overhead

### 2. **OG Metadata Utilities** (`src/lib/ogMetadata.ts`)

A TypeScript utility module providing:

- `generateArticleOGMetadata()` - Creates OG metadata object from article data
- `generateOGMetaTags()` - Generates HTML meta tags for server-side rendering
- `updateDocumentOGMetadata()` - Updates document head with OG tags dynamically
- `generateShareableUrl()` - Creates theme-aware shareable URLs

### 3. **Integration with PublicArticle Component**

The `PublicArticle.tsx` component now:
- Imports OG metadata utilities
- Updates document head when article loads
- Dynamically generates OG image URL based on article slug
- Maintains theme preferences in shared links

## How It Works

### Step 1: Article is Loaded
When a user visits an article page (`/articles/article-slug`):

```typescript
// PublicArticle.tsx
useEffect(() => {
  if (article && authorName) {
    const baseUrl = window.location.origin
    const metadata = generateArticleOGMetadata(article, baseUrl, authorName)
    updateDocumentOGMetadata(metadata)
  }
}, [article, authorName])
```

### Step 2: OG Metadata is Generated
The metadata includes:
- Article title
- Article summary
- Dynamic OG image URL pointing to `/api/og?slug=article-slug`
- Article URL with theme parameter
- Author information
- Publication date
- Tags

### Step 3: Social Media Crawler Fetches Preview
When a user shares the link on WhatsApp, Twitter, etc.:

1. The social platform's crawler visits the article URL
2. It reads the OG meta tags from the HTML head
3. It finds the `og:image` meta tag pointing to `/api/og?slug=...`
4. It requests the OG image endpoint

### Step 4: OG Image is Generated and Cached
The `/api/og` endpoint:

1. Receives the article slug
2. Queries Supabase for article data
3. Generates beautiful HTML with article metadata
4. Vercel renders the HTML to a PNG image
5. Returns the image with 1-hour cache headers
6. Subsequent requests within 1 hour are served from cache

### Step 5: Preview Appears in Social Media
The generated image displays in the social media preview with:
- Article title
- Article summary
- Cover emoji
- Author name and avatar initials
- Publication date
- Reading time and view count
- Tags
- Beautiful gradient background with Inkwell branding

## Configuration

### Environment Variables

Ensure these variables are set in your `.env.local` and Vercel deployment:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Vercel Configuration

The `vercel.json` file already includes the necessary configuration:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "vite",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

The serverless function at `api/og.ts` will be automatically detected and deployed by Vercel.

## OG Image Customization

To customize the OG image appearance, edit `api/og.ts` and modify the `generateOGImageHTML()` function:

### Colors
```typescript
// Change the gradient background
background: linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%);

// Change the accent color
color: #863bff;
```

### Typography
```typescript
// Adjust font sizes
.title { font-size: 48px; }
.summary { font-size: 20px; }
```

### Layout
```typescript
// Adjust padding and spacing
padding: 60px;
margin-bottom: 40px;
```

### Add More Elements
You can add:
- Article word count
- Community name (if applicable)
- Custom badges or icons
- Animated elements (note: static images only)

## Testing the OG Images

### Method 1: Use OG Debuggers

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/sharing/
2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/

Steps:
1. Paste your article URL
2. Click "Fetch" or "Inspect"
3. The tool will fetch and display the OG preview
4. You'll see the generated image and metadata

### Method 2: Manual Testing

1. Copy an article URL: `https://yoursite.com/articles/my-article`
2. Add `?theme=dark` or `?theme=light` to test theme variants
3. Paste in WhatsApp, Twitter, or Facebook
4. Wait for the preview to load (may take a few seconds on first request)

### Method 3: Direct API Testing

```bash
# Test the OG endpoint directly
curl "https://yoursite.com/api/og?slug=my-article"

# This returns an HTML page that Vercel renders to an image
```

## Performance Considerations

### Caching Strategy
- **1-hour cache** on generated images reduces server load
- Social media crawlers cache previews for days
- Images are regenerated when cache expires

### Optimization Tips
1. **Keep summaries concise** - Truncated at 120 characters in the image
2. **Use short titles** - Truncated at 60 characters in the image
3. **Limit tags** - Only first 3 tags are displayed
4. **Monitor Supabase queries** - Each image generation queries Supabase once

### Reducing Costs
- Cache headers prevent unnecessary regeneration
- Vercel serverless functions scale automatically
- No database writes, only reads
- Supabase free tier handles typical traffic

## Troubleshooting

### Issue: OG Image Not Showing in Social Media

**Cause:** Cache or crawler not updated

**Solution:**
1. Clear social media cache using their debugger tools
2. Wait 5-10 minutes for crawlers to refresh
3. Check that article is published (status = 'published')
4. Verify Supabase credentials in environment variables

### Issue: OG Image Shows Generic Preview

**Cause:** Endpoint not responding or returning error

**Solution:**
1. Check `/api/og?slug=test-article` directly in browser
2. Verify article slug exists in database
3. Check Vercel function logs
4. Ensure Supabase credentials are correct

### Issue: Article Not Found Error

**Cause:** Article slug doesn't match or article is not published

**Solution:**
1. Verify the exact article slug in database
2. Ensure article status is 'published'
3. Check that slug is URL-encoded if it contains special characters

### Issue: Slow Image Generation

**Cause:** First request triggers rendering (cold start)

**Solution:**
1. Subsequent requests are cached for 1 hour
2. Vercel warms up functions over time
3. Consider pre-warming by visiting articles after publishing

## Advanced Features

### Dynamic Theme-Aware Previews

The system supports theme-aware URLs:

```typescript
// Dark theme preview
https://inkwell.com/articles/my-article?theme=dark

// Light theme preview
https://inkwell.com/articles/my-article?theme=light
```

The OG image URL automatically uses the current theme.

### Custom OG Image Sizes

Request specific sizes:

```
/api/og?slug=article&width=1200&height=630  // Standard (default)
/api/og?slug=article&width=1200&height=1200 // Square
/api/og?slug=article&width=600&height=315   // Small
```

### Scheduled Image Regeneration

To force regeneration of all OG images (e.g., after design changes):

1. Increment the cache version in `api/og.ts`
2. Redeploy to Vercel
3. Social media crawlers will fetch fresh images

## Integration with Publishing Flow

When users publish articles, they can see the OG preview:

1. **In PublishModal**: Show a preview of how the article will appear when shared
2. **In Dashboard**: Display the OG image in article cards
3. **In Analytics**: Track how many times the OG image was fetched

## Future Enhancements

### Potential Improvements
1. **A/B Testing** - Generate multiple OG image styles and track engagement
2. **Dynamic Backgrounds** - Use article colors or community colors
3. **Author Photos** - Display author avatar in OG image
4. **Video Previews** - Generate video previews for articles with embedded media
5. **Analytics Integration** - Track OG image impressions via pixel tracking
6. **Scheduled Updates** - Regenerate images based on view count changes

## API Reference

### GET /api/og

Generates a dynamic OG preview image for an article.

**Query Parameters:**
- `slug` (required): Article slug
- `width` (optional, default: 1200): Image width in pixels
- `height` (optional, default: 630): Image height in pixels

**Response:**
- Content-Type: `text/html` (Vercel renders to image)
- Cache-Control: `public, max-age=3600, s-maxage=3600`
- Status: 200 on success, 404 if article not found, 500 on error

**Example Requests:**
```
GET /api/og?slug=getting-started-with-inkwell
GET /api/og?slug=my-article&width=1200&height=630
GET /api/og?slug=another-article&width=600&height=315
```

## Deployment Checklist

- [ ] Ensure `api/og.ts` is in the project root
- [ ] Verify Supabase credentials in Vercel environment variables
- [ ] Deploy to Vercel (automatic via git push)
- [ ] Test OG endpoint: `https://yoursite.com/api/og?slug=test`
- [ ] Test in social media debuggers
- [ ] Monitor Vercel function logs for errors
- [ ] Set up alerts for function failures (optional)

## Support & Troubleshooting

For issues:
1. Check Vercel function logs: https://vercel.com/dashboard
2. Test the endpoint directly in browser
3. Use social media debuggers to see what they're fetching
4. Check Supabase query logs for database errors
5. Verify environment variables are set correctly

## Resources

- [Open Graph Protocol](https://ogp.me/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/sharing/)
- [Vercel Serverless Functions](https://vercel.com/docs/concepts/functions/serverless-functions)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
