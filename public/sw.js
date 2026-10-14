const CACHE_NAME = 'party-game-collection-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg'
];

// On install: cache shell + skipWaiting so update activates quickly
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// On activate: remove old caches + enable navigation preload when available
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : undefined));
    await self.clients.claim();
  })());
});

// Allow page to force immediate activation
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Navigation: network-first with preload + cache fallback; also cache fresh HTML
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          const copy = preload.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(c => c.put(event.request, copy)));
          return preload;
        }
        const res = await fetch(event.request);
        const copy = res.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(c => c.put(event.request, copy)));
        return res;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return caches.match('/index.html');
      }
    })());
    return;
  }

  // Assets: cache-first, then network with background update
  // Vite hashed assets ( /assets/*.js / .css ) are immutable -> cache aggressively
  const isHashedAsset = url.pathname.startsWith('/assets/');
  if (isHashedAsset) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res && res.status === 200) {
          const copy = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(c => c.put(event.request, copy)));
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  // Other GET: stale-while-revalidate (fast + keeps cache fresh)
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const networkFetch = fetch(event.request).then(res => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
      }
      return res;
    }).catch(() => undefined);
    if (cached) {
      // Return cached immediately, update in background
      event.waitUntil(networkFetch);
      return cached;
    }
    const net = await networkFetch;
    return net || Response.error();
  })());
});
