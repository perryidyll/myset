/* MySet service worker.
   © 2026 Perry Idyll.

   Deliberately conservative, because a service worker is the one thing that can
   serve a stale, broken app to somebody standing in a bar and be almost impossible
   for them to clear.

   THE RULES, in order of how much they matter:

   1. NOTHING under /api is ever cached, ever. Votes, payments, the live show state
      and the sign-in flow must always hit the network. A cached vote is a lost vote
      and a cached payment is a support ticket.
   2. Navigations are NETWORK-FIRST. The newest version of a page always wins; the
      cache is only a fallback for when there is no network. That means a bad deploy
      is fixed by the next deploy, not by asking people to clear their browser.
   3. Static assets are stale-while-revalidate: instant from cache, refreshed in the
      background, so a CSS change lands on the next load.
   4. NOTHING is precached at install. Precaching is what makes a service worker
      ship a stale shell; there is no version to get out of step with if there is no
      install-time cache.
   5. Old caches are deleted on activate, and the worker takes over immediately.

   POST, PUT and cross-origin requests (Stripe, YouTube, Spotify) are passed
   straight through and never touched. */

const CACHE = 'myset-runtime-v3';
const STATIC = /\.(?:css|js|png|jpg|jpeg|webp|svg|woff2?|webmanifest)$/i;

self.addEventListener('install', () => self.skipWaiting());

/* ---------- push ----------
   The artist's Studio, installed to their home screen, can be told things while
   the screen is off — a song requested, a payment landed. The audience is never
   pushed to: they never sign in (INVARIANT 9g) and would have to install first,
   which is a non-starter in a bar.
   Everything is defensive: a malformed payload must still produce a notification
   rather than throwing inside the worker, where nobody would ever see the error. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = {}; }
  const title = d.title || 'MySet';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    tag: d.tag || 'myset',
    renotify: true,
    icon: '/icons/icon-512.png',
    badge: '/icons/icon-512.png',
    data: { url: d.url || '/studio' },
  }));
});

/* Focus the Studio if it is already open rather than stacking a second copy. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/studio';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).pathname.startsWith('/studio')) { await c.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* A page can tell the worker to stand down — the escape hatch if this ever does
   turn out to be serving something wrong. */
self.addEventListener('message', (e) => {
  if (e.data === 'myset-unregister') {
    self.registration.unregister().then(async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      for (const c of await self.clients.matchAll()) c.navigate(c.url);
    });
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;         // Stripe, embeds, fonts
  if (url.pathname.startsWith('/api/')) return;            // rule 1, the important one

  // rule 2 — a page is only ever served from cache when the network fails
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) (await caches.open(CACHE)).put(req, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(req)) || (await caches.match('/')) ||
          new Response('<!doctype html><meta name=viewport content="width=device-width">' +
            '<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;padding:44px 24px;' +
            'text-align:center;color:#1D1D1F}h1{font-size:22px;letter-spacing:-.02em}' +
            'p{color:#6E6E73}</style><h1>No connection</h1>' +
            '<p>MySet needs the internet for the live bits. Try again in a moment.</p>',
            { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 });
      }
    })());
    return;
  }

  // rule 3 — instant, then refreshed behind the scenes
  if (STATIC.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req);
      const spin = fetch(req).then(async (res) => {
        if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await spin) || new Response('', { status: 504 });
    })());
  }
});
