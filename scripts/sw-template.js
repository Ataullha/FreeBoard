/* Generated during build from the complete local runtime asset list. */
const CACHE = __CACHE__,
  ASSETS = __ASSETS__;
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      for (let i = 0; i < ASSETS.length; i += 16)
        await cache.addAll(ASSETS.slice(i, i + 16));
    })(),
  ),
);
// Do not interrupt active editing. Only the owner's Save & restart opts into an update.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const keys = (await caches.keys()).filter(
        (k) => k.startsWith('freeboard-') || k.startsWith('boardpilot-'),
      );
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      if (clients.length <= 1)
        await Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        );
    })(),
  ),
);
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE),
        hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      // An older tab may still import a lazy chunk from its previous build.
      const previous = await caches.match(req, { ignoreSearch: true });
      if (previous) return previous;
      if (req.mode === 'navigate')
        return (
          (await cache.match(
            new URL('./index.html', self.registration.scope),
          )) || fetch(req)
        );
      return fetch(req);
    })(),
  );
});
