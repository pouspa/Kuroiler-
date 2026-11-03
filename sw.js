const V = 'kuroiler-v2';
const FILES = ['./', 'index.html', 'app.js', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache d'abord, mise à jour en arrière-plan quand le réseau est là
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request)
      .then(r => { if (r.ok) c.put(e.request, r.clone()); return r; })
      .catch(() => hit || c.match('index.html'));
    return hit || net;
  }));
});
