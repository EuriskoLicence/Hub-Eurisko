// Service Worker minimale — richiesto da Chrome Android per installazione PWA
const CACHE = 'hub-eurisko-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))

// Network-first: passa sempre le richieste alla rete (no cache aggressiva)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)))
})
