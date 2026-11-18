// Kaski Krishi PWA service worker.
// Only public app-shell/static assets are cached. API and user data are never cached.
const CACHE_PREFIX = 'kaski-krishi-static-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/favicon.svg', '/icons/kaski-krishi.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

function isCacheableStaticResponse(response) {
  if (!response || response.status !== 200 || response.type !== 'basic') return false;
  const cacheControl = response.headers.get('Cache-Control') || '';
  return !/private|no-store/i.test(cacheControl);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API requests: authenticated, personal and changing data stay network-only.
  if (url.pathname.startsWith('/api/')) return;

  // Serve app navigations from the network first; use the public shell only when offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (isCacheableStaticResponse(response)) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('/index.html', response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match('/index.html');
        if (cached) return cached;
        return new Response('You are offline. Please reconnect and try again.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // Cache only same-origin static resources; do not cache arbitrary documents or API data.
  const isStaticAsset = ['script', 'style', 'image', 'font', 'worker'].includes(request.destination)
    || url.pathname === '/manifest.json';
  if (!isStaticAsset) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);

    const networkUpdate = fetch(request).then(async (response) => {
      if (isCacheableStaticResponse(response)) {
        await cache.put(request, response.clone());
      }
      return response;
    });

    if (cached) {
      event.waitUntil(networkUpdate.catch(() => {}));
      return cached;
    }

    try {
      return await networkUpdate;
    } catch {
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
