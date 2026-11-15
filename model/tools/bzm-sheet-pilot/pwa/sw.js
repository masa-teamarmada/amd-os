// 公開されている画面部品と、形を検査した教材データだけを保存する。
const VERSION = 'bzm-pwa-v5';
const SHELL = ['/', '/index.html', '/app.mjs', '/style.css', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function verified(d) {
  return !!d && typeof d === 'object' && !!d.book && !!d.monthly && Array.isArray(d.monthly.cases)
    && !!d.continuation && Array.isArray(d.continuation.gates)
    && !!d.reference && Array.isArray(d.reference.cases)
    && !!d.valuation && Array.isArray(d.valuation.history);
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname === '/data.json') {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res.ok) {
          const copy = res.clone();
          const ok = verified(await copy.json().catch(() => null));
          if (ok) await cache.put('/data.json', res.clone());
        }
        return res;
      } catch {
        const hit = await cache.match('/data.json');
        if (hit) return hit;
        return new Response(JSON.stringify({ error: 'offline' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
      }
    })());
    return;
  }

  if (SHELL.includes(url.pathname)) {
    e.respondWith((async () => {
      const cache = await caches.open(VERSION);
      try {
        const res = await fetch(req);
        if (res.ok) await cache.put(url.pathname, res.clone());
        return res;
      } catch {
        return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
      }
    })());
  }
});
