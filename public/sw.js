const CACHE_NAME = 'inkwell-v3'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/manifest.json',
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
  if (event.request.method !== 'GET') return
  // Skip supabase API and vercel analytics requests
  const url = new URL(event.request.url)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('vercel')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
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
