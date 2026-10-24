const CACHE_NAME = 'inkwell-v7'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/icon-192x192-maskable.png',
  '/icon-512x512-maskable.png',
  '/apple-touch-icon.png'
]

// Install — cache static assets
self.addEventListener('install', event => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
})

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// Fetch — network first, fallback to cache
self.addEventListener('fetch', event => {
  // 1. Only handle GET requests
  if (event.request.method !== 'GET') return

  // 2. Ignore non-HTTP/HTTPS schemes (e.g. chrome-extension://)
  const urlString = event.request.url
  if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) return

  const url = new URL(urlString)

  // 3. Immediately bypass for cross-origin or API requests so sw.js never intercepts Gemini/Supabase
  if (url.origin !== self.location.origin) return
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('vercel')
  ) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match('/index.html')
        )
      )
  )
})
