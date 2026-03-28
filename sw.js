/* ── Los Pelones Fauna — Service Worker v1 ── */
const CACHE = 'pelones-fauna-v1';
const OFFLINE_PAGE = 'pelones_fauna_v1.html';

// Recursos a cachear al instalar
const PRECACHE = [
  'pelones_fauna_v1.html',
  'pelones_v4.html',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&family=Barlow+Condensed:wght@400;600;700;900&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cacheamos los locales siempre; los externos con try/catch
      const locals = PRECACHE.filter(u => !u.startsWith('http'));
      const externals = PRECACHE.filter(u => u.startsWith('http'));
      return cache.addAll(locals).then(() =>
        Promise.allSettled(externals.map(u => cache.add(u)))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Solo GET
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Fuentes de Google: cache-first, sin fallar si no hay red
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => new Response('', { status: 200, headers: { 'Content-Type': 'text/css' } }));
      })
    );
    return;
  }

  // CDN (xlsx, etc.): cache-first
  if (url.hostname.includes('cloudflare') || url.hostname.includes('cdn')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }

  // Archivos propios: network-first, fallback a cache
  e.respondWith(
    fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }).catch(() => caches.match(e.request).then(cached => {
      if (cached) return cached;
      // Último recurso: página principal
      return caches.match(OFFLINE_PAGE);
    }))
  );
});
