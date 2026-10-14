const CACHE_NAME = 'party-game-collection-v4';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-512-maskable.png',
  '/apple-touch-icon.png'
];
const IMAGE_CACHE = 'party-images-v1';
const MAX_IMAGE_ENTRIES = 250;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    if ('navigationPreload' in self.registration) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(keys.map(k => {
      if (k !== CACHE_NAME && k !== IMAGE_CACHE) {
        if (k.startsWith('party-game-collection-') || k.startsWith('party-images-')) return caches.delete(k);
        // keep unrelated caches untouched, but delete older versions
        if (k === 'party-game-collection-v3') return caches.delete(k);
      }
      return undefined;
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function isImageRequest(req) {
  if (req.destination === 'image') return true;
  try { return /\.(png|jpe?g|svg|webp|gif|avif)$/i.test(new URL(req.url).pathname); } catch { return false; }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    const toDelete = keys.slice(0, keys.length - maxEntries);
    await Promise.all(toDelete.map(k => cache.delete(k)));
  }
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

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

  if (isImageRequest(event.request)) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) {
        event.waitUntil((async () => {
          try {
            const res = await fetch(event.request);
            if (res && res.ok) {
              await caches.open(IMAGE_CACHE).then(c => c.put(event.request, res.clone()));
              await trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
            }
          } catch {}
        })());
        return cached;
      }
      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
          const copy = res.clone();
          event.waitUntil((async () => {
            await caches.open(IMAGE_CACHE).then(c => c.put(event.request, copy));
            await trimCache(IMAGE_CACHE, MAX_IMAGE_ENTRIES);
          })());
        }
        return res;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  const isHashedAsset = url.pathname.startsWith('/assets/');
  if (isHashedAsset) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        const res = await fetch(event.request);
        if (res && res.ok) {
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

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    const networkFetch = fetch(event.request).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
      }
      return res;
    }).catch(() => undefined);
    if (cached) {
      event.waitUntil(networkFetch);
      return cached;
    }
    const net = await networkFetch;
    return net || Response.error();
  })());
});
