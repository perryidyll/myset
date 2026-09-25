/* MySet service worker.
   © 2026 Perry Idyll.

   Deliberately conservative, because a service worker is the one thing that can
   serve a stale, broken app to somebody standing in a bar and be almost impossible
   for them to clear.

   THE RULES, in order of how much they matter:

   1. NOTHING under /api is ever cached, ever. Votes, payments, the live show state
      and the sign-in flow must always hit the network. A cached vote is a lost vote
      and a cached payment is a support ticket.
   2. Navigations are STALE-WHILE-REVALIDATE for a night (decision 0091): a page this
      phone opened in the last six hours is shown at once from the phone's copy and
      re-fetched behind it, so the next open has the newest. Older than that, or never
      seen, the network goes first and the copy is only the no-signal fallback. So a
      deploy is on a phone by the open after next during a gig, and by the next open
      the next day — never a settings screen. A deliberate reload (a pull, the
      Studio's Reload button: the request says no-cache or reload) asks the network
      first, so a reload is still the newest page. A page that says no-store or
      private (the passcode-gated money model) is never stored. Before 0091 the
      worker asked the network for every navigation; the browser's own cache covered
      a page for a minute (0048), then every open waited 0.4–1.4 s for the edge
      (measured in 0088).
   3. Static assets are stale-while-revalidate: instant from cache, refreshed in the
      background, so a CSS change lands on the next load. A hash-stamped file
      (?v=…, served immutable) is never re-asked, and that is LOAD-BEARING for rule 2:
      a stored page names the stamp it shipped with, and a re-fetch of that old name
      would be answered with the current file (the query is ignored on the server),
      pairing an old page with a new script for the rest of the night.
   4. NOTHING is precached at install. Precaching is what makes a service worker
      ship a stale shell; there is no version to get out of step with if there is no
      install-time cache.
   5. Old caches are deleted on activate, and the worker takes over immediately.

   POST, PUT and cross-origin requests (Stripe, YouTube, Spotify) are passed
   straight through and never touched. */

const CACHE = 'myset-runtime-v4';
const STATIC = /\.(?:css|js|png|jpg|jpeg|webp|svg|woff2?|webmanifest)$/i;
const FRESH = 6 * 60 * 60 * 1000;   // a night: how long a stored page is shown before the network is asked first
const STORED = 'x-myset-stored';    // when the copy arrived, stamped on the way into the cache

/* A page is stored with the time it arrived so rule 2 can tell a night from a week.
   Only a real 200 is kept: a redirect cannot be handed to a later navigation, an error
   page must never become the copy a phone falls back on, and a page that asked not to
   be stored (no-store, private: the passcode-gated money model) is not — a copy would
   be shown for six hours without the gate that produced it. `tee` says whether the
   caller still needs the body; without it the response is consumed here, not cloned.
   Never rejects: a broken cache store must never cost a page. */
async function keepPage(key, res, tee) {
  try {
    if (!res || !res.ok || res.redirected) return;
    if (/no-store|private/i.test(res.headers.get('cache-control') || '')) return;
    const h = new Headers(res.headers);
    h.set(STORED, String(Date.now()));
    const copy = new Response(tee ? res.clone().body : res.body, { status: res.status, statusText: res.statusText, headers: h });
    await (await caches.open(CACHE)).put(key, copy);
  } catch { /* storage refused: the page still went to the phone */ }
}

const offline = () => new Response('<!doctype html><meta name=viewport content="width=device-width">' +
  '<style>body{font:16px/1.5 -apple-system,system-ui,sans-serif;padding:44px 24px;' +
  'text-align:center;color:#1D1D1F}h1{font-size:22px;letter-spacing:-.02em}' +
  'p{color:#6E6E73}</style><h1>No connection</h1>' +
  '<p>MySet needs the internet for the live bits. Try again in a moment.</p>',
  { headers: { 'content-type': 'text/html; charset=utf-8' }, status: 503 });

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

  // rule 2 — a page seen tonight is shown at once and refreshed behind; otherwise the
  // network first. The copy is keyed by path: the query never changes the HTML. A
  // reload (no-cache / reload) is a person asking for the newest, so it goes network-first.
  // Every cache call is guarded: a refused store must never cost the page itself.
  if (req.mode === 'navigate') {
    const key = url.origin + url.pathname;
    e.respondWith((async () => {
      const spin = fetch(req);
      const hit = await caches.match(key).catch(() => undefined);
      const age = hit ? Date.now() - Number(hit.headers.get(STORED) || 0) : Infinity;
      const wantsFresh = req.cache === 'no-cache' || req.cache === 'reload';
      if (hit && age < FRESH && !wantsFresh) {
        e.waitUntil(spin.then((fresh) => keepPage(key, fresh, false)).catch(() => null));
        return hit;
      }
      try {
        const fresh = await spin;
        e.waitUntil(keepPage(key, fresh, true));
        return fresh;
      } catch {
        return hit || (await caches.match(url.origin + '/').catch(() => undefined)) || offline();
      }
    })());
    return;
  }

  // rule 3 — instant, then refreshed behind the scenes; a stamped file is never re-asked
  if (STATIC.test(url.pathname)) {
    e.respondWith((async () => {
      const hit = await caches.match(req).catch(() => undefined);
      if (hit && url.searchParams.has('v')) return hit;
      const spin = fetch(req).then(async (res) => {
        try { if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone()); } catch { /* storage refused */ }
        return res;
      }).catch(() => null);
      if (hit) { e.waitUntil(spin); return hit; }
      return (await spin) || new Response('', { status: 504 });
    })());
  }
});
