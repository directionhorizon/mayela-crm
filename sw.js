/* MAYELA CRM - service worker : app shell en cache, réseau direct pour tout le reste */
const CACHE = 'mayela-crm-v3';
const PRECACHE = [
  './',
  './mayela-crm.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase (REST/auth/functions/realtime) et CDN : toujours le réseau, jamais de cache
  if (url.origin !== self.location.origin && url.hostname.includes('supabase')) return;
  if (url.hostname === 'cdn.jsdelivr.net') return;

  // Navigations (rechargement / ouverture de l'app) : cache d'abord, sinon page en cache, sinon réseau
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put('./mayela-crm.html', copy));
          return res;
        })
        .catch(() => caches.match('./mayela-crm.html'))
    );
    return;
  }

  // Mêmes origine : stale-while-revalidate. Cross-origin (fonts Google) : réseau simple.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached);
        return cached || refresh;
      })
    );
  }
});
