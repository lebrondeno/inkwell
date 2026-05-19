/**
 * OG Metadata Generator
 * 
 * This module provides utilities for generating Open Graph metadata
 * for article sharing on social media platforms like WhatsApp, Twitter, Facebook, etc.
 * 
 * The metadata is dynamically generated based on article content and can be
 * injected into the HTML head tag or used for API responses.
 */

import type { Article } from './supabase';

export interface OGMetadata {
  title: string;
  description: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  url: string;
  type: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
}

/**
 * Generates OG metadata for an article.
 * 
 * @param article - The article object
 * @param baseUrl - The base URL of the application (e.g., https://inkwell.example.com)
 * @param authorName - The author's full name
 * @returns OG metadata object
 */
export function generateArticleOGMetadata(
  article: Article,
  baseUrl: string,
  authorName: string = 'Anonymous'
): OGMetadata {
  const articleUrl = `${baseUrl}/articles/${article.slug}`;
  const ogImageUrl = `${baseUrl}/api/og?slug=${encodeURIComponent(article.slug)}`;

  return {
    title: article.title,
    description: article.summary || article.content.substring(0, 160),
    image: ogImageUrl,
    imageWidth: 1200,
    imageHeight: 630,
    imageAlt: `${article.title} - Article preview`,
    url: articleUrl,
    type: 'article',
    author: authorName,
    publishedTime: article.created_at,
    modifiedTime: article.updated_at,
    tags: article.tags || [],
  };
}

/**
 * Generates HTML meta tags for OG metadata.
 * These tags should be injected into the <head> section of the HTML document.
 * 
 * @param metadata - OG metadata object
 * @returns HTML string with meta tags
 */
export function generateOGMetaTags(metadata: OGMetadata): string {
  const tags = [
    `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta property="og:image" content="${metadata.image}" />`,
    `<meta property="og:image:width" content="${metadata.imageWidth}" />`,
    `<meta property="og:image:height" content="${metadata.imageHeight}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt)}" />`,
    `<meta property="og:url" content="${metadata.url}" />`,
    `<meta property="og:type" content="${metadata.type}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`,
    `<meta name="twitter:image" content="${metadata.image}" />`,
  ];

  if (metadata.author) {
    tags.push(`<meta property="article:author" content="${escapeHtml(metadata.author)}" />`);
  }

  if (metadata.publishedTime) {
    tags.push(`<meta property="article:published_time" content="${metadata.publishedTime}" />`);
  }

  if (metadata.modifiedTime) {
    tags.push(`<meta property="article:modified_time" content="${metadata.modifiedTime}" />`);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    metadata.tags.forEach(tag => {
      tags.push(`<meta property="article:tag" content="${escapeHtml(tag)}" />`);
    });
  }

  return tags.join('\n  ');
}

/**
 * Updates the document head with OG metadata.
 * This function should be called in useEffect on the article page component.
 * 
 * @param metadata - OG metadata object
 */
export function updateDocumentOGMetadata(metadata: OGMetadata): void {
  // Update or create meta tags
  updateMetaTag('og:title', metadata.title);
  updateMetaTag('og:description', metadata.description);
  updateMetaTag('og:image', metadata.image);
  updateMetaTag('og:image:width', metadata.imageWidth.toString());
  updateMetaTag('og:image:height', metadata.imageHeight.toString());
  updateMetaTag('og:image:alt', metadata.imageAlt);
  updateMetaTag('og:url', metadata.url);
  updateMetaTag('og:type', metadata.type);
  updateMetaTag('twitter:card', 'summary_large_image');
  updateMetaTag('twitter:title', metadata.title);
  updateMetaTag('twitter:description', metadata.description);
  updateMetaTag('twitter:image', metadata.image);

  if (metadata.author) {
    updateMetaTag('article:author', metadata.author);
  }

  if (metadata.publishedTime) {
    updateMetaTag('article:published_time', metadata.publishedTime);
  }

  if (metadata.modifiedTime) {
    updateMetaTag('article:modified_time', metadata.modifiedTime);
  }

  if (metadata.tags && metadata.tags.length > 0) {
    // Remove existing article:tag meta tags
    document.querySelectorAll('meta[property="article:tag"]').forEach(el => el.remove());
    
    // Add new article:tag meta tags
    metadata.tags.forEach(tag => {
      const meta = document.createElement('meta');
      meta.setAttribute('property', 'article:tag');
      meta.setAttribute('content', tag);
      document.head.appendChild(meta);
    });
  }

  // Update page title
  document.title = `${metadata.title} — Inkwell`;
}

/**
 * Helper function to update or create a meta tag.
 */
function updateMetaTag(property: string, content: string): void {
  const isProperty = property.startsWith('og:') || property.startsWith('article:');
  const selector = isProperty
    ? `meta[property="${property}"]`
    : `meta[name="${property}"]`;

  let meta = document.querySelector(selector) as HTMLMetaElement;

  if (!meta) {
    meta = document.createElement('meta');
    if (isProperty) {
      meta.setAttribute('property', property);
    } else {
      meta.setAttribute('name', property);
    }
    document.head.appendChild(meta);
  }

  meta.setAttribute('content', content);
}

/**
 * Escapes HTML special characters.
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
 * Generates a shareable URL with theme parameter.
 * This is useful for maintaining the user's theme preference when sharing.
 * 
 * @param baseUrl - The base URL
 * @param slug - The article slug
 * @param theme - The theme ('dark' or 'light')
 * @returns Full shareable URL
 */
export function generateShareableUrl(
  baseUrl: string,
  slug: string,
  theme: 'dark' | 'light' = 'dark'
): string {
  const url = `${baseUrl}/articles/${slug}`;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}theme=${theme}`;
}
