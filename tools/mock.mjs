#!/usr/bin/env node
/* A FAKE API TO LOOK AT THE PAGES AGAINST — on this machine, touching nothing live.

   `netlify dev` cannot run the write paths (its storage sandbox returns no version
   tag), a deploy preview reads and writes PRODUCTION data, and the suite proves
   nothing about how a page looks. This is the third tool: plain node http, no
   dependencies, serving the public/ beside this file with netlify.toml's rewrites
   and answering every /api/* route the pages call from fixtures in this process's
   memory. Nothing here reaches myset.vip, Stripe, Blobs or a sign-in: Buy comes
   straight back as ?paid=…, the Studios boot signed in as a pretend account, and
   an edit in the Studio changes only this process until Ctrl-C or Reset.

     node tools/mock.mjs              # http://127.0.0.1:8787 — the index lists every state
     PORT=9000 node tools/mock.mjs

   The index at / (or /__mock) is a checklist: one link per state a page can be in,
   grouped fan / shop / return trips / Studio / other. The states are switched SERVER-SIDE from the
   address, so no page carries mock code:

     ?live=1      the room is live (fab, "Tonight", pickup-tonight copy)
     ?canbuy=0    card payments off
     ?allout=1    every item sold out
     ?plan=free   the Studio on the free plan (the merch editor behind its lock)
     ?tour=1      the artist has a tour poster (the artist page's View tour dates, the Studio's card)
     /one/…       a page with one item     /none/…   a page with none
     /v/demo/…    the venue twin of every fan page
     /studio?tab=money&plan=pro   the Money tab with a book: thirty filed nights, a weekly
                                  run, four logged, a twelve-month ledger, 48 payments —
                                  enough rows for every list to fold (bizGet / bizSave /
                                  bizPrefs / history hide answered from memory)

   Each flag is remembered in a cookie set on the page request and read on the API
   calls that page makes, so a state survives the round trip through checkout —
   /demo/shop?paid=… after a live checkout still says live. A plain address (no flag,
   not a return trip) clears them: the address is the state. /__mock/reset puts the
   fixtures back and clears the cookies.

   THE ONE LIBERTY WITH A PAGE'S BYTES: the two Studios are handed one extra <script>
   ahead of their first that puts a pretend token in localStorage (`myset.token` /
   `myset.vtoken`) — and, when the address says ?tab=, the tab to open — so the
   <head>'s early reads and the script's boot both find a session. Only the two
   Studios, only here; every fan page is served byte for byte as on disk, and nothing
   under public/ is written.

   This is for LOOKING. It is never a substitute for the suite (sh test/run.sh),
   which is what proves the server; and it never says anything about production —
   python3 tools/prod.py does that. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// the public/ beside THIS file — a worktree looks at its own pages, not the main checkout's
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const PORT = Number(process.env.PORT) || 8787;
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
            '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg',
            '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8' };

/* ---------- the rewrites: netlify.toml's [[redirects]], every rule, in its order ----------
   /api/* is answered below before any of these; a real file always wins (Netlify's rule). */
const RULES = [
  [/^\/moneymodel$/, { text: 'the money model is a passcode-gated function — not mocked' }],
  [/^\/financialmodel$/, { moved: '/moneymodel' }],
  [/^\/studio$/, 'studio.html'],
  [/^\/signup$/, 'studio.html'],
  [/^\/about$/, 'about.html'],
  [/^\/artists$/, 'artists.html'],
  [/^\/venues$/, 'venue-studio.html'],
  [/^\/v\/[^/]+\/community$/, 'community.html'],
  [/^\/v\/[^/]+\/shop$/, 'shop.html'],
  [/^\/v\/[^/]+$/, 'venue.html'],
  [/^\/[^/]+\/community$/, 'community.html'],
  [/^\/[^/]+\/shop$/, 'shop.html'],
  [/^\/[^/]+\/vote$/, 'vote.html'],
  [/^\/[^/]+$/, 'artist.html'],
];
function rewrite(p) {
  const real = path.join(ROOT, p);
  if (real.startsWith(ROOT) && fs.existsSync(real) && fs.statSync(real).isFile()) return p.replace(/^\//, '');
  for (const [re, to] of RULES) if (re.test(p)) return to;
  return p.replace(/^\//, '');
}

/* ---------- the fixtures ----------
   Shapes follow the server: the community read (_community.mjs), stagePayload
   (stage.mjs), planGet + shapeLimits (admin.mjs), merchList / orderList + ownerOrder
   (admin.mjs / _pay.mjs), the auth list (auth.mjs), shapeVenue (_venues.mjs). The caps
   are _profile.mjs's numbers. Everything lives on `S` so /__mock/reset can rebuild it. */
const NOW = Date.now();
const MERCH_CAPS = { max: 12, maxVariants: 8, variantLen: 24, maxPost: 10000, minCents: 100, maxCents: 50000, maxImgs: 5, maxStock: 9999 };
const slotOf = (u) => { const m = /[?&]s=([a-z0-9_]+)/.exec(String(u || '')); return m ? m[1] : ''; };
const slotsOf = (id) => [id, `${id}_1`, `${id}_2`, `${id}_3`, `${id}_4`];
const img = (owner, id) => `/api/img?a=${owner}&s=${id}`;
/* Nine items: one per state the shop draws, and two the Studio holds "Off" (the fan read
   filters `on`, like the server):
     1 priced pickup, sized, M out     → Buy, chips, M struck      6 priced posted, postage in → "posted"
     2 priced posted, $6 postage       → Buy · + $6 post           7 priced pickup, plain      → Buy (lazy picture)
     3 link only, no price             → Get it ↗                  8 OFF, priced pickup
     4 sold out, price kept            → dimmed, no Buy            9 OFF, link only
     5 no price, no link, no picture   → Ask at the show, letter tile */
const ITEMS = () => [
  { id: 'm000001', title: 'Tour tee', blurb: 'Heavy cotton, printed in the van. Runs a little big.', cents: 2500, link: '', ship: 'pickup', on: true, at: NOW - 1 * 864e5, out: false, post: 0,
    variants: [{ label: 'S', out: false, stock: null }, { label: 'M', out: true, stock: null }, { label: 'L', out: false, stock: 2 }, { label: 'XL', out: false, stock: 0 }] },
  { id: 'm000002', title: 'Live at the Room — vinyl', blurb: 'Twelve songs from the night the ceiling leaked. 180 g, gatefold.', cents: 3000, link: '', ship: 'ship', on: true, at: NOW - 2 * 864e5, out: false, post: 600, variants: [] },
  { id: 'm000003', title: 'Digital album', blurb: 'Every song, every format, from Bandcamp.', cents: 0, link: 'https://demo.bandcamp.com/album/live-at-the-room', ship: 'pickup', on: true, at: NOW - 3 * 864e5, out: false, post: 0, variants: [] },
  { id: 'm000004', title: 'Screen-printed poster', blurb: 'A2, numbered, fifty made.', cents: 1200, link: '', ship: 'pickup', on: true, at: NOW - 4 * 864e5, out: true, post: 0, variants: [] },
  { id: 'm000005', title: 'Sticker sheet', blurb: 'Six stickers. Ask at the table.', cents: 0, link: '', ship: 'pickup', on: true, at: NOW - 5 * 864e5, out: false, post: 0, variants: [], noimg: true },
  { id: 'm000006', title: 'Hoodie', blurb: 'Postage included.', cents: 4500, link: '', ship: 'ship', on: true, at: NOW - 6 * 864e5, out: false, post: 0, variants: [{ label: 'M', out: false }, { label: 'L', out: false }] },
  { id: 'm000007', title: 'Tote bag', blurb: 'Carries a record and a beer.', cents: 1500, link: '', ship: 'pickup', on: true, at: NOW - 7 * 864e5, out: false, post: 0, variants: [] },
  { id: 'm000008', title: 'Last tour’s tee', blurb: 'The 2025 print. A few left in the box.', cents: 1500, link: '', ship: 'pickup', on: false, at: NOW - 40 * 864e5, out: false, post: 0, variants: [{ label: 'S', out: false }, { label: 'M', out: false }] },
  { id: 'm000009', title: 'Cassette (pre-order)', blurb: 'Coming when the duplicator does.', cents: 0, link: 'https://demo.bandcamp.com/album/cassette', ship: 'pickup', on: false, at: NOW - 41 * 864e5, out: false, post: 0, variants: [], noimg: true },
].map(({ noimg, ...m }) => { const n = m.id === 'm000001' ? 3 : m.id === 'm000002' ? 2 : noimg ? 0 : 1;
  const imgs = slotsOf(m.id).slice(0, n).map((k) => img('a1', k));
  return { ...m, imgs, img: imgs[0] || '', stock: m.id === 'm000001' ? 14 : m.id === 'm000007' ? 3 : null }; });
const clone = (x) => JSON.parse(JSON.stringify(x));
/* Three orders, newest first like orderList: a pickup with the code the fan shows at the
   table, a posted one that carries an address (orderDetail), one already handed over. */
const ORDER_ROWS = () => [
  { sid: 'cs_test_k7pq', item: 'm000001', title: 'Tour tee', qty: 2, variant: 'M', ship: 'pickup', amount: 50, cents: 5000, post: 0, code: 'K7PQ', status: 'new', at: NOW - 25 * 60e3, show: 'Fri, Sep 11 · The Room' },
  { sid: 'cs_test_vinyl', item: 'm000002', title: 'Live at the Room — vinyl', qty: 1, variant: '', ship: 'ship', amount: 36, cents: 3000, post: 600, code: 'B3ND', status: 'new', at: NOW - 3 * 3600e3, show: '',
    shipping: { name: 'Sam Fan', line1: '12 Gertrude St', line2: '', city: 'Fitzroy', state: 'VIC', postal: '3065', country: 'AU' }, buyer: { name: 'Sam Fan', email: 'sam@example.com' } },
  { sid: 'cs_test_tote', item: 'm000007', title: 'Tote bag', qty: 1, variant: '', ship: 'pickup', amount: 15, cents: 1500, post: 0, code: 'H2WT', status: 'done', doneAt: NOW - 2 * 864e5, at: NOW - 3 * 864e5, show: 'Fri, Sep 4 · The Room' },
];
const venueId = (id) => id.replace(/^m/, 'v');   // the venue's twin of each item, so the two Studios never share a row
/* what fans asked the shop for (_wishes.mjs shapeWishes): two open, one done, so the Studio section shows both states */
const WISH_ROWS = () => [
  { id: 'w0000001', name: 'Jess', text: 'A hoodie in XL — the tee runs small on me', item: 'm000001', at: NOW - 40 * 60e3, done: false, doneAt: 0 },
  { id: 'w0000002', name: '', text: 'The poster from the Corner Hotel show', item: '', at: NOW - 26 * 3600e3, done: false, doneAt: 0 },
  { id: 'w0000003', name: 'Mo', text: 'Cassette of the new EP', item: '', at: NOW - 9 * 864e5, done: true, doneAt: NOW - 8 * 864e5 },
];
/* THE INBOX (_messages.mjs, decision 0074): six conversations across the five folders —
   two unread requests (a booking, a collab), one answered and filed under General, a press
   ask under Business, a thank-you under Casual, one reported to Spam. Each carries the
   booker's token `k` (the artist page reads a thread with it) and the whole exchange. */
const MSG_LIMITS = { text: 1000, msgs: 200 };
const MSG_FOLDERS = ['requests', 'general', 'business', 'casual', 'spam'];
const MSG_KINDS = ['booking', 'collab', 'press', 'other'];
const MSG_ROWS = () => [
  { id: 't0000000001', k: 'k1'.padEnd(32, '1'), folder: 'requests', unread: true, kind: 'booking', name: 'Priya Nair', email: 'priya@cornerhotel.example', phone: '+61 412 000 111', venue: 'The Corner Hotel', when: 'Sat 18 Oct', at: NOW - 2 * 3600e3, reported: false, blocked: false,
    msgs: [{ by: 'them', text: 'Hi! We run a monthly live night at the Corner Hotel and would love to have you for the October date. It’s a 45-minute set from 9pm — we pay $400 plus a bar tab. Are you free?', at: NOW - 2 * 3600e3 }] },
  { id: 't0000000002', k: 'k2'.padEnd(32, '2'), folder: 'requests', unread: true, kind: 'collab', name: 'Tomás Reyes', email: 'tomas@example.com', phone: '', venue: '', when: '', at: NOW - 26 * 3600e3, reported: false, blocked: false,
    msgs: [{ by: 'them', text: 'Loved your set at The Room on Friday. I play trumpet — up for me guesting on a couple of songs at your next show? Happy to rehearse first.', at: NOW - 26 * 3600e3 }] },
  { id: 't0000000003', k: 'k3'.padEnd(32, '3'), folder: 'general', unread: false, kind: 'booking', name: 'Mel Okafor', email: 'mel.okafor@example.com', phone: '0400 222 333', venue: 'Abbotsford Convent', when: '14 Feb', at: NOW - 3 * 864e5, reported: false, blocked: false,
    msgs: [{ by: 'them', text: 'Our wedding is on 14 Feb at Abbotsford Convent — could you play the ceremony and an hour after? About 80 guests, outdoors if the weather holds.', at: NOW - 3 * 864e5 },
           { by: 'me', text: 'Congratulations! Yes — I’m free that day. Send me the running order when you have it and I’ll hold the date.', at: NOW - 2 * 864e5 }] },
  { id: 't0000000004', k: 'k4'.padEnd(32, '4'), folder: 'business', unread: false, kind: 'press', name: 'Jordan Lee', email: 'jordan@beatmag.example', phone: '', venue: '', when: '', at: NOW - 5 * 864e5, reported: false, blocked: false,
    msgs: [{ by: 'them', text: 'I write for Beat. We’re doing a piece on Melbourne’s residency nights — could I grab fifteen minutes on the phone this week?', at: NOW - 5 * 864e5 }] },
  { id: 't0000000005', k: 'k5'.padEnd(32, '5'), folder: 'casual', unread: false, kind: 'other', name: 'Sam', email: 'sam@example.com', phone: '', venue: '', when: '', at: NOW - 9 * 864e5, reported: false, blocked: false,
    msgs: [{ by: 'them', text: 'Just wanted to say the cover of Best Part on Friday made my week. No reply needed!', at: NOW - 9 * 864e5 }] },
  { id: 't0000000006', k: 'k6'.padEnd(32, '6'), folder: 'spam', unread: false, kind: 'other', name: 'Growth Team', email: 'promo@fanboost.example', phone: '', venue: '', when: '', at: NOW - 12 * 864e5, reported: true, blocked: false,
    msgs: [{ by: 'them', text: 'Grow your fanbase 10x with our promotion service. http://fanboost.example/go http://fanboost.example/plans http://fanboost.example/now', at: NOW - 12 * 864e5 }] },
];
function fresh() {
  const MERCH = ITEMS();
  return {
    MERCH,
    VMERCH: MERCH.map((m) => { const imgs = (m.imgs || []).map((u) => img('v_v1', venueId(slotOf(u)))); return { ...clone(m), id: venueId(m.id), imgs, img: imgs[0] || '' }; }),
    ORDERS: ORDER_ROWS(),
    VORDERS: ORDER_ROWS().map((o) => ({ ...o, item: venueId(o.item) })),
    WISHES: WISH_ROWS(),
    VWISHES: WISH_ROWS().map((w) => ({ ...w, item: w.item && venueId(w.item) })),
    MSGS: MSG_ROWS(),
    TOUR: undefined,          // the tour poster once the Studio has set or cleared it; undefined means "as the ?tour= state says"
    TOURDATA: null,           // the data URL the Studio uploaded, served back at /api/img?s=tour
    lastPay: null,            // the last /api/pay body, so /api/confirm answers with what was bought
  };
}
/* shapeIndex / shapeThread / shapeForBooker, as _messages.mjs draws them: newest first, never a hash, never a token */
const msgLast = (t) => t.msgs[t.msgs.length - 1] || { text: '', at: t.at, by: 'them' };
function msgIndex() {
  const threads = S.MSGS.slice().sort((a, b) => msgLast(b).at - msgLast(a).at).map((t) => ({ id: t.id, folder: t.folder, unread: !!t.unread, kind: t.kind, name: t.name,
    preview: msgLast(t).text.replace(/\s+/g, ' ').slice(0, 90), lastAt: msgLast(t).at, lastBy: msgLast(t).by, count: t.msgs.length, reported: !!t.reported, blocked: !!t.blocked }));
  const counts = { requests: 0, general: 0, business: 0, casual: 0, spam: 0, unread: 0 };
  for (const r of threads) { counts[r.folder] += 1; if (r.unread && r.folder !== 'spam') counts.unread += 1; }
  return { threads, counts };
}
const msgShape = (t) => ({ id: t.id, kind: t.kind, name: t.name, email: t.email, phone: t.phone, venue: t.venue, when: t.when, folder: t.folder, unread: !!t.unread, reported: !!t.reported, blocked: !!t.blocked, at: t.at,
  msgs: t.msgs.map((m) => ({ by: m.by === 'me' ? 'me' : 'them', text: m.text, at: m.at })) });
const msgForBooker = (t) => ({ id: t.id, kind: t.kind, name: t.name, at: t.at, artist: { name: NAME.artist }, msgs: t.msgs.map((m) => ({ by: m.by === 'me' ? 'artist' : 'you', text: m.text, at: m.at })) });
/* the Studio's eight actions (handleMessages): every one changes this process's copy so the tab can be clicked through */
function msgAction(body) {
  const a = body.action, t = S.MSGS.find((x) => x.id === String(body.t || body.id || ''));
  const gone = { ok: false, error: 'That conversation is gone.', status: 404 };
  switch (a) {
    case 'msgCount': { const { counts } = msgIndex(); return { ok: true, unread: counts.unread, requests: counts.requests }; }
    case 'msgList': return { ok: true, ...msgIndex(), limits: MSG_LIMITS, folders: MSG_FOLDERS, kinds: MSG_KINDS, mail: false };   // mail:false — what production says until Resend is set, so the honest copy is the one on screen
    case 'msgThread': if (!t) return gone; t.unread = false; return { ok: true, thread: msgShape(t), mail: false };
    case 'msgReply': { if (!t) return gone; const text = String(body.text || '').trim();
      if (text.length < 1) return { ok: false, error: 'Write something first.', status: 400 };
      if (text.length > MSG_LIMITS.text) return { ok: false, error: `That’s over ${MSG_LIMITS.text} characters.`, status: 400 };
      if (t.msgs.length >= MSG_LIMITS.msgs) return { ok: false, error: 'This conversation is full — start a fresh one.', status: 400 };
      t.msgs.push({ by: 'me', text, at: Date.now() }); t.unread = false; if (t.folder === 'requests') t.folder = 'general'; return { ok: true }; }
    case 'msgMove': if (!t) return gone; if (!MSG_FOLDERS.includes(body.folder)) return { ok: false, error: 'No such folder.', status: 400 }; t.folder = body.folder; return { ok: true };
    case 'msgUnread': if (!t) return gone; t.unread = body.on !== false; return { ok: true };
    case 'msgReport': if (!t) return gone; t.reported = true; t.folder = 'spam'; return { ok: true };
    case 'msgBlock': if (!t) return gone; t.blocked = body.on !== false; return { ok: true };
    default: return null;
  }
}
/* the public door (messages.mjs): POST only — send → {ok, id, k, mail}; get by token → the booker's
   shape (a token never rides in a URL, so there is no GET); reply → {ok}. mail:false is production
   until Resend is set, so the page's honest copy is what a screenshot shows */
function publicMsg(method, q, body) {
  if (method !== 'POST') return { ok: false, error: 'POST only', status: 405 };
  if (body.action === 'get') {
    const t = S.MSGS.find((x) => x.id === String(body.t || '') && x.k === String(body.k || ''));
    return t ? { ok: true, thread: msgForBooker(t), mail: false } : { ok: false, error: 'That conversation isn’t here.', status: 404 };
  }
  if (body.action === 'send') {
    const text = String(body.text || '').trim(), name = String(body.name || '').trim(), email = String(body.email || '').trim();
    if (!body.fan) return { ok: false, error: 'missing fan', status: 400 };
    if (name.length < 1) return { ok: false, error: 'Your name, so they know who’s asking.', status: 400 };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'An email address they can answer to.', status: 400 };
    if (text.length < 10) return { ok: false, error: 'A sentence or two about your event.', status: 400 };
    if (text.length > MSG_LIMITS.text) return { ok: false, error: `That’s over ${MSG_LIMITS.text} characters.`, status: 400 };
    if (body.hp) return { ok: true, id: 't' + Date.now().toString(36).padStart(10, '0'), k: 'ff'.repeat(16), mail: false };   // a honeypot hit is told yes and stored nowhere
    const today = S.MSGS.filter((x) => x.fan === body.fan && Date.now() - x.at < 864e5).length;
    if (today >= 3) return { ok: false, error: 'That’s three messages today from this phone — come back tomorrow.', status: 429 };
    const id = 't' + Math.random().toString(36).slice(2, 12).padEnd(10, '0'), k = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const links = (text.match(/https?:\/\//g) || []).length;
    S.MSGS.push({ id, k, fan: body.fan, folder: links >= 3 ? 'spam' : 'requests', unread: true, kind: MSG_KINDS.includes(body.kind) ? body.kind : 'booking', name: name.slice(0, 60), email: email.slice(0, 120),
      phone: String(body.phone || '').trim().slice(0, 30), venue: String(body.venue || '').trim().slice(0, 80), when: String(body.when || '').trim().slice(0, 40), at: Date.now(), reported: false, blocked: false,
      msgs: [{ by: 'them', text, at: Date.now() }] });
    return { ok: true, id, k, mail: false };
  }
  if (body.action === 'reply') {
    const t = S.MSGS.find((x) => x.id === String(body.t || '') && x.k === String(body.k || ''));
    if (!t) return { ok: false, error: 'That conversation isn’t here.', status: 404 };
    const text = String(body.text || '').trim();
    if (text.length < 1) return { ok: false, error: 'Write something first.', status: 400 };
    if (text.length > MSG_LIMITS.text) return { ok: false, error: `That’s over ${MSG_LIMITS.text} characters.`, status: 400 };
    if (t.blocked) return { ok: true };   // a blocked sender is told yes and heard by nobody
    if (t.msgs.length >= MSG_LIMITS.msgs) return { ok: false, error: 'This conversation is full.', status: 400 };
    t.msgs.push({ by: 'them', text, at: Date.now() }); t.unread = true; return { ok: true };
  }
  return { ok: false, error: 'unknown action', status: 400 };
}
/* the Studio's shape: newest first, open before done, the item named from the list */
const shapeWishes = (rows, list) => rows.slice().reverse().sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
  .map((w) => ({ ...w, itemTitle: w.item ? ((list.find((m) => m.id === w.item) || {}).title || '') : '' }));
/* the shop page's Make a request: the fan's sentence lands on the owner's list, the server's limits near enough */
function wishStub(body, venue) {
  const rows = venue ? S.VWISHES : S.WISHES, text = String(body.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!body.fan) return { ok: false, error: 'missing fan', status: 400 };
  if (text.length < 2) return { ok: false, error: 'Say what you’d like — a word or two is enough.', status: 400 };
  const today = rows.filter((w) => w.fan === body.fan && Date.now() - w.at < 864e5).length;
  if (today >= 3) return { ok: false, error: 'That’s three requests today from this phone — come back tomorrow.', status: 429 };
  const id = 'w' + Math.random().toString(36).slice(2, 9).padEnd(7, '0');
  rows.push({ id, fan: body.fan, name: String(body.name || '').trim().slice(0, 30), text, item: /^[mv][a-z0-9]{6}$/.test(String(body.item || '')) ? body.item : '', at: Date.now(), done: false, doneAt: 0 });
  return { ok: true, id };
}
let S = fresh();

const POSTS = [
  ['Ana', 5, 'Best night out in months — the encore had the whole bar singing.', true],
  ['Bo', 5, 'Came for one song, stayed for the lot.', false],
  ['Cy', 4, 'Sound was a bit loud up front but the set was unreal.', false],
  ['Dee', 5, 'Bought the tee at the table, wearing it now.', false],
  ['Eli', 4, 'The cover of Best Part. That is all.', false],
].map(([name, stars, text, pinned], i) => ({
  id: 'p' + (i + 1), name, text, stars, show: 's1', showLabel: 'Fri, Sep 11 · The Room', photos: [], video: null, clip: null,
  at: NOW - (i + 1) * 3600e3, likes: 3 - (i % 3), reply: null, pinned, edited: false, mine: false, editable: false, liked: false,
}));
const SHOW_LABEL = 'Fri, Sep 11 · The Room';

/* ---------- which state the caller is in ----------
   The address on a PAGE request sets the cookies; the API calls that page makes carry the
   cookies back. The query on the API call itself and the referer are read too, so a call
   made by hand (curl) can name a state without a cookie. */
const FLAGS = ['live', 'canbuy', 'allout', 'plan', 'tour', 'first'];
const cookies = (rq) => Object.fromEntries((rq.headers.cookie || '').split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; }));
function stateOf(rq, q) {
  const ck = cookies(rq);
  let ref = null; try { ref = new URL(rq.headers.referer || '', 'http://x').searchParams; } catch { ref = null; }
  const pick = (k) => q.get(k) ?? ck['mock_' + k] ?? (ref && ref.get(k)) ?? null;
  return { live: pick('live') === '1', canBuy: pick('canbuy') !== '0', allOut: pick('allout') === '1', plan: pick('plan') || 'plus', tour: pick('tour') === '1', first: pick('first') === '1' };
}
/* what the page request does to the cookies: a flag in the address sets it; a return trip
   from checkout (?paid= / ?cancelled=) keeps them; a plain address clears them all */
function cookieHeaders(q) {
  const out = [];
  const set = (k, v) => out.push(`mock_${k}=${encodeURIComponent(v)}; Path=/; SameSite=Lax`);
  const clear = (k) => out.push(`mock_${k}=; Path=/; Max-Age=0; SameSite=Lax`);
  if (FLAGS.some((k) => q.has(k))) { for (const k of FLAGS) if (q.has(k)) set(k, q.get(k)); return out; }
  if (q.has('paid') || q.has('cancelled') || q.has('connect')) return out;
  for (const k of FLAGS) clear(k);
  return out;
}

/* ---------- the fan pages ---------- */
const NAME = { artist: 'Demo Artist', venue: 'The Room' };
/* the slug picks the merch: demo has the nine, `one` has the tee alone, `none` has nothing */
function merchFor(slug, venue, st) {
  const all = venue ? S.VMERCH : S.MERCH;
  let list = all.filter((m) => m.on !== false);
  if (slug === 'one') list = list.slice(0, 1);
  if (slug === 'none') list = [];
  if (st.allOut) list = list.map((m) => ({ ...m, out: true, variants: (m.variants || []).map((v) => ({ ...v, out: true })) }));
  return list;
}
function communityFixture(slug, venue, st) {
  return {
    ok: true, kind: venue ? 'venue' : 'artist', id: venue ? 'v1' : 'a1', owner: venue ? 'v_v1' : 'a1',
    slug, name: venue ? NAME.venue : NAME.artist, first: venue ? '' : 'Demo',
    avatar: img(venue ? 'v_v1' : 'a1', 'avatar'), verified: true,
    merch: merchFor(slug, venue, st), canBuy: st.canBuy, live: venue ? false : st.live, showId: st.live && !venue ? 'show1' : '',
    canPost: true, posts: POSTS, shows: [{ showId: 's1', label: SHOW_LABEL }],
    limits: { text: 500, photos: 3, perDay: 3, clipSeconds: 20, clipBytes: 75 * 1048576, editHours: 24, wish: 200 },
  };
}
const SONGS = [
  ['s1', 'Best Part', 'Daniel Caesar', ['soul']], ['s2', 'Valerie', 'Amy Winehouse', ['soul', 'pop']],
  ['s3', 'Riptide', 'Vance Joy', ['indie', 'folk']], ['s4', 'Dreams', 'Fleetwood Mac', ['rock']],
  ['s5', 'Redbone', 'Childish Gambino', ['funk']], ['s6', 'Ho Hey', 'The Lumineers', ['folk']],
].map(([id, title, artist, tags], i) => ({ id, title, artist, tags, active: true, key: '', note: '', chart: '', lyrics: false,
  votes: 0, paidVotes: 0, played: false, now: false, inSet: true, votable: true, at: NOW - (i + 1) * 864e5 }));
const GENRES = [['soul', 'Soul'], ['pop', 'Pop'], ['indie', 'Indie'], ['folk', 'Folk'], ['rock', 'Rock'], ['funk', 'Funk']].map(([id, label]) => ({ id, label }));
const PACKS = { small: { votes: 3, cents: 300 }, big: { votes: 6, cents: 500 } };
/* the artist's profile (profile.mjs): what /api/fan?what=profile and /api/profile answer */
function profileFixture(st) {
  return { ok: true, artistId: 'a1', stats: { shows: 12, votes: 900, people: 340, songs: SONGS.length, joined: NOW - 30 * 864e5 },
    verified: true, live: st.live, venue: st.live ? NAME.venue : '', city: st.live ? 'Melbourne' : '', showId: st.live ? 'show1' : '', merch: S.MERCH.filter((m) => m.on !== false).length, requests: true,
    rating: { avg: 4.6, count: 5, nights: 1 }, posts: POSTS.length, topSongs: [], topVoted: null, topPlayed: null, topPaid: null, comments: [],
    setlist: SONGS.map((s) => s.title), songs: SONGS.length,
    name: NAME.artist, first: 'Demo', last: 'Artist', tagline: 'Make my set your set', style: 'Acoustic soul', bio: 'A demo page. Nothing here is real.', photo: '', avatar: img('a1', 'avatar'), photos: [],
    management: '', managementUrl: '', links: { spotify: '', applemusic: '', ytmusic: '', instagram: '', bandcamp: '', gofundme: '', website: '' }, media: [], updatedAt: NOW,
    tour: tourOf(st) };
}
/* the tour poster (decision 0075): what the Studio set in this process, else the ?tour=1 state's picture, else none */
const TOUR_CAPS = { pdf: 3145728, image: 921600 };
const tourOf = (st) => S.TOUR !== undefined ? S.TOUR : st.tour ? { url: '/img/band.jpg', type: 'jpeg', link: 'https://tickets.example/tour' } : null;
/* the artist's gig list (events.mjs ?a=): one gig tonight at The Room, one next week */
const day = (n) => new Date(NOW + n * 864e5).toISOString().slice(0, 10);
const gig = (n, eventId) => ({ eventId, date: day(n), time: '20:00', endTime: '23:00', tz: 'Australia/Melbourne', startsAt: NOW + n * 864e5 - (n ? 0 : 3600e3), endsAt: NOW + n * 864e5 + 2 * 3600e3,
  venue: NAME.venue, city: 'Melbourne', country: 'Australia', address: '1 Demo St', maps: null, note: '', ticketUrl: '', repeating: false, live: n === 0, rsvp: n ? 4 : 12 });
const gigsFixture = () => ({ ok: true, artistId: 'a1', gigs: [gig(0, 'g1'), gig(7, 'g2')] });
/* the shared board and the personal read (_board.mjs buildBoard / buildMe) */
function boardFixture(st) {
  const live = st.live;
  const votes = { s1: 7, s2: 4, s3: 2 };
  const shape = (s) => ({ id: s.id, title: s.title, artist: s.artist, votes: live ? votes[s.id] || 0 : 0, cost: 1, firstAt: live && votes[s.id] ? NOW - 20 * 60e3 : null, tags: s.tags });
  return { ok: true, src: 'mock', at: NOW, artistId: 'a1', artist: NAME.artist, artistFirst: 'Demo', venue: live ? NAME.venue : '', city: live ? 'Melbourne' : '', showTime: '',
    status: live ? 'live' : 'ended', windowOpen: live, endedAt: live ? null : NOW - 4 * 3600e3, countdownIn: 0, showId: live ? 'show1' : '',
    nowPlaying: live ? { id: 's4', title: 'Dreams', artist: 'Fleetwood Mac' } : null,
    songs: SONGS.filter((s) => !live || s.id !== 's4').map(shape).sort((a, b) => b.votes - a.votes), played: [], tail: null,
    replayCost: 2, packs: PACKS, freeCredits: 3, setlist: null, tags: GENRES,
    asks: { song: { cost: 1 }, birthday: { cost: 1 }, vibe: { cost: 0, options: ['Energetic', 'Chill', 'Romantic', 'Upbeat', 'Funky', 'Acoustic'] } },
    room: { cap: null, in: live ? 12 : 0, over: false }, nextPollMs: 3000, board: null, totalVotes: live ? 13 : 0,
    paymentsEnabled: st.canBuy, flags: { featuredShows: true }, updatedAt: NOW };
}
const meFixture = (st) => ({ ok: true, src: 'mock', at: NOW, showId: st.live ? 'show1' : '', lastAt: 0, votes: {}, held: [], myAsks: [],
  credits: { unlimited: false, remaining: 3, total: 3, used: 0, extra: 0, freeRemaining: 3, freeTotal: 3, paidLeft: 0, decided: false } });
/* the venue's page (venue.mjs): shapeVenue plus who is playing there */
const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];
const VENUE_NOT_BUILT = ['tips', 'speakerVotes'];
const VPLANS = {
  free: { label: 'Free', price: 0, photos: 3, reviews: true, tick: false, merch: false, tips: false, speakerVotes: false, cut: 0.10, splitFee: true, soon: VENUE_NOT_BUILT },
  pro: { label: 'Pro', price: 2000, photos: 12, reviews: true, tick: true, merch: true, tips: true, speakerVotes: true, cut: 0.02, splitFee: true, soon: VENUE_NOT_BUILT },
};
function venueFixture(st) {
  return {
    venueId: 'v1', slug: 'demo', name: NAME.venue, tagline: 'Live music, six nights', about: 'A demo venue. Nothing here is real.', city: 'Melbourne', country: 'Australia', address: '1 Demo St',
    maps: { open: 'https://maps.google.com/?q=The+Room', google: 'https://maps.google.com/?q=The+Room', apple: '', source: '', embed: null, lat: null, lng: null },
    phone: '', whatsapp: '', photo: img('v_v1', 'cover'), photos: [],
    amenities: [{ key: 'stage', label: 'Stage' }, { key: 'food', label: 'Food' }], hours: DAYS.map(([d, label]) => ({ day: d, label, closed: d === 'mon', open: '17:00', close: '01:00' })),
    menu: { url: '', note: '', items: [] }, offers: [], links: { website: '', instagram: '', facebook: '', google: '' },
    merch: S.VMERCH, merchStored: S.VMERCH.length, merchMax: MERCH_CAPS.max, paymentsEnabled: st.canBuy, verified: true, verifiedVia: 'vouches',
    plan: 'pro', limits: VPLANS.pro, plans: VPLANS, since: NOW - 60 * 864e5, del: null, updatedAt: NOW,
  };
}
const venuePage = (st) => ({ ok: true, src: 'mock', venue: venueFixture(st),
  gigs: [{ kind: 'gig', ...gig(0, 'g1'), artist: NAME.artist, slug: 'demo', listedAs: NAME.venue }, { kind: 'gig', ...gig(7, 'g2'), artist: NAME.artist, slug: 'demo', listedAs: NAME.venue }],
  artists: [{ name: NAME.artist, slug: 'demo' }], vouches: { count: 3, need: 3, names: ['Ana', 'Bo', 'Cy'] }, truncated: false });
/* the front door (index.html): one country, one city, one gig tonight */
const placesFixture = () => ({ ok: true, src: 'mock', countries: [{ country: 'Australia', gigs: 2, cities: [{ city: 'Melbourne', gigs: 2, artists: 1, venues: 1 }] }] });
const cityFeed = (q) => ({ ok: true, country: q.get('country') || 'Australia', city: q.get('city') || 'Melbourne', today: day(0), horizon: day(7), window: 7, total: 2, artists: 1, venues: 1,
  days: [{ date: day(0), label: 'Tonight', count: 1, gigs: [{ ...gig(0, 'g1'), kind: 'gig', artist: NAME.artist, slug: 'demo', href: '/demo' }] },
         { date: day(7), label: 'Next week', count: 1, gigs: [{ ...gig(7, 'g2'), kind: 'gig', artist: NAME.artist, slug: 'demo', href: '/demo' }] }] });
const artistsFixture = () => ({ ok: true, artists: [{ slug: 'demo', name: NAME.artist, tagline: 'Make my set your set', avatar: img('a1', 'avatar'), management: '', style: 'Acoustic soul', signed: false, musicReleased: true,
  showsNext30Days: 2, totalShows: 12, rating: 4.6, ratingCount: 5, locations: [{ country: 'Australia', city: 'Melbourne' }], eventsNext30Days: [gig(0, 'g1'), gig(7, 'g2')], nextShow: { date: day(0), city: 'Melbourne', country: 'Australia' } }] });

/* ---------- the Artist Studio ---------- */
function stageFixture(st) {
  const live = st.live;
  return {
    ok: true,
    show: {
      artist: NAME.artist, artistFirst: 'Demo', venue: live ? NAME.venue : '', city: live ? 'Melbourne' : '', showTime: '',
      status: live ? 'live' : 'ended', windowOpen: live, nowPlaying: live ? 's4' : null,
      played: [], freeCredits: 3, replayCost: 2, packs: PACKS, showId: live ? 'show1' : 's0', startedAt: live ? NOW - 3600e3 : 0,
      artistId: 'a1', slug: 'demo', unlimited: false, unlimitedFans: [],
      requests: true, birthdays: true, listId: '', listName: '', gigMonth: '', gigCount: 2,
      startedBy: live ? 'artist' : null, endedBy: null, sched: null, autoStart: true,
    },
    tags: { builtin: GENRES, own: [] }, lists: [], learn: [], listFellBack: false,
    voters: 0, room: live ? 12 : 0, nets: 0, asks: [], songs: SONGS,
    tips: { total: st.first ? 0 : 42, count: st.first ? 0 : 3, recent: [] }, feedback: null,
    paid: { count: st.first || !live ? 0 : 2, total: st.first || !live ? 0 : 8, last: 5 },
    /* ?first=1 is an account with no night on file and no sign printed: the
       first-gig card before a show, the example rows during one */
    nights: st.first ? 0 : 12, signAt: st.first ? 0 : NOW - 30 * 864e5,
    paymentsEnabled: st.canBuy, payoutsNote: null, store: 'mock',
  };
}
const NOT_BUILT = ['promote', 'analytics', 'presskit', 'branding'];
const planRow = (label, price, o) => ({ label, price, featured: null, gigs: o.gigs === undefined ? null : o.gigs, pricing: !!o.pricing, setlists: !!o.setlists,
  merch: !!o.merch, moderate: !!o.moderate, reports: !!o.reports, crowdNumbers: !!o.crowdNumbers, library: o.library, cut: o.cut, cutPct: Math.round(o.cut * 1000) / 10, seats: o.seats,
  promote: !!o.promote, analytics: !!o.analytics, presskit: !!o.presskit, branding: !!o.branding, soon: NOT_BUILT });
const PLANS = {
  free: planRow('Hobbyist', 0, { gigs: 10, library: 100, cut: 0.25, seats: 1 }),
  plus: planRow('Bar Star', 1000, { library: 200, cut: 0.10, seats: 1, pricing: true, setlists: true, merch: true, moderate: true, reports: true, crowdNumbers: true }),
  pro: planRow('Rock Star', 2000, { library: 2000, cut: 0.02, seats: 5, pricing: true, setlists: true, merch: true, moderate: true, reports: true, crowdNumbers: true, promote: true, analytics: true, presskit: true, branding: true }),
};
/* a Bar Star who pays the subscription — the plan the Merch store is sold with; ?plan=free is a Hobbyist */
function planFixture(st) {
  const plan = PLANS[st.plan] ? st.plan : 'plus', paid = plan !== 'free';
  return { ok: true, plan, limits: PLANS[plan], shareStats: true, until: paid ? NOW + 14 * 864e5 : null, comped: false, discountPct: 0, plans: PLANS,
    billing: paid ? { subscribed: true, plan, portal: true, pastDue: false, renewsAt: NOW + 14 * 864e5, cancelAtPeriodEnd: false } : { subscribed: false, plan: 'free', portal: false, pastDue: false },
    role: 'owner', tour: TOUR_CAPS, del: null, email: 'demo@example.com', owner: false };
}
const TEAM = { ok: true, slug: 'demo', emails: ['demo@example.com'], invited: [], invitedNames: {}, codeSet: false, emailReady: true };
/* what connectStatus() in _connect.mjs answers: the Get-paid card prints plan, cutPct and the Stripe-fee note */
const STRIPE_NOTE = { split: 'Stripe’s own card fee (about 2.9% + 30¢) is shared: MySet’s fee is reduced by half of it, estimated at checkout. The payment is yours, so Stripe takes its fee from your side.',
                      whole: 'Stripe’s own card fee (about 2.9% + 30¢) comes out of your side too, because the payment is yours.' };
function payFixture(kind, plan) {
  const row = kind === 'venue' ? VPLANS[plan] : PLANS[plan], split = !!row.splitFee;
  return { kind, splitFee: split, acct: 'acct_1De…', started: true, detailsSubmitted: true, chargesEnabled: true, payoutsEnabled: true, ready: true, country: 'AU',
    plan, cutPct: Math.round(row.cut * 1000) / 10, stripeFeeNote: split ? STRIPE_NOTE.split : STRIPE_NOTE.whole, platformOwner: false };
}
const ownerOrder = ({ shipping, buyer, ...o }) => ({ ...o, variant: o.variant || '', post: o.post || 0 });
const postOf = (m) => (m.ship === 'ship' ? Math.max(0, parseInt(m.post, 10) || 0) : 0);

/* normMerch, near enough: the caps applied and said back, like the server does */
function normItem(prev, inc, id, owner) {
  const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const row = { ...(prev || { img: '', at: NOW }), ...inc, id };
  row.title = str(row.title, 60); if (!row.title) return null;
  row.blurb = str(row.blurb, 160); row.link = str(row.link, 300);
  row.cents = Math.max(0, Math.min(MERCH_CAPS.maxCents, Math.round(Number(row.cents) || 0)));
  row.ship = row.ship === 'ship' ? 'ship' : 'pickup';
  row.post = row.ship === 'ship' ? Math.max(0, Math.min(MERCH_CAPS.maxPost, Math.round(Number(row.post) || 0))) : 0;
  row.on = row.on !== false; row.out = row.out === true;
  const seen = new Set(); row.variants = [];
  for (const v of Array.isArray(inc.variants) ? inc.variants : (prev && prev.variants) || []) {
    const label = str(v && v.label, MERCH_CAPS.variantLen); const k = label.toLowerCase();
    if (!label || seen.has(k)) continue; seen.add(k);
    const st = v && v.stock !== undefined && v.stock !== null && v.stock !== '' ? Math.max(0, Math.min(MERCH_CAPS.maxStock, parseInt(v.stock, 10) || 0)) : null;
    row.variants.push({ label, out: !!(v && v.out), stock: st }); if (row.variants.length >= MERCH_CAPS.maxVariants) break;
  }
  row.imgs = (prev && prev.imgs) || []; row.img = row.imgs[0] || ''; row.at = (prev && prev.at) || NOW;
  row.stock = inc.stock === undefined ? (prev ? prev.stock : null) : (inc.stock === null || inc.stock === '' ? null : Math.max(0, Math.min(MERCH_CAPS.maxStock, parseInt(inc.stock, 10) || 0)));
  return row;
}
/* the shop actions both Studios share, on whichever list is theirs */
function shopAction(body, list, orders, owner, prefix, st) {
  const a = body.action;
  switch (a) {
    case 'merchList': return { ok: true, merch: list, ...MERCH_CAPS, allowed: true };
    case 'merchSave': {
      const inc = body.item || {};
      const id = new RegExp(`^${prefix}[a-z0-9]{6}$`).test(String(inc.id || '')) ? String(inc.id) : prefix + Math.random().toString(36).slice(2, 8).padEnd(6, '0').slice(0, 6);
      const at = list.findIndex((m) => m.id === id);
      const row = normItem(at >= 0 ? list[at] : null, inc, id, owner);
      if (!row) return { ok: false, error: 'Give it a name' };
      if (at >= 0) list[at] = row;
      else if (list.length >= MERCH_CAPS.max) return { ok: false, error: `${MERCH_CAPS.max} items is the most a page holds — edit one of those.` };
      else list.push(row);
      return { ok: true, id, merch: list, item: row };
    }
    case 'merchRemove': { const i = list.findIndex((m) => m.id === body.id); if (i >= 0) list.splice(i, 1); return { ok: true, merch: list }; }
    case 'merchPhoto': { const m = list.find((x) => x.id === body.id); if (!m) return { ok: false, error: 'unknown item', status: 404 };
      m.imgs = m.imgs || []; const used = new Set(m.imgs.map(slotOf)), slot = slotsOf(m.id).find((k) => !used.has(k));
      if (!slot) return { ok: false, error: `${MERCH_CAPS.maxImgs} pictures is the most for one item — remove one first.`, status: 400 };
      m.imgs.push(img(owner, slot) + '&v=' + Date.now().toString(36)); m.img = m.imgs[0]; return { ok: true, url: m.imgs[m.imgs.length - 1], merch: list }; }
    case 'merchPhotoClear': { const m = list.find((x) => x.id === body.id); if (m) { const drop = body.slot ? [String(body.slot)] : slotsOf(m.id); m.imgs = (m.imgs || []).filter((u) => !drop.includes(slotOf(u))); m.img = m.imgs[0] || ''; } return { ok: true, merch: list }; }
    case 'merchMove': { const i = list.findIndex((x) => x.id === body.id), j = body.dir === 'up' ? i - 1 : i + 1;
      if (i >= 0 && j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]]; return { ok: true, merch: list }; }
    case 'orderList': return { ok: true, orders: orders.map(ownerOrder) };
    case 'orderDone': { const o = orders.find((x) => x.sid === body.sid);
      if (o) { o.status = body.done === false ? 'new' : 'done'; if (o.status === 'done') o.doneAt = Date.now(); else delete o.doneAt; }
      return { ok: true, orders: orders.map(ownerOrder) }; }
    case 'wishList': return { ok: true, wishes: shapeWishes(prefix === 'v' ? S.VWISHES : S.WISHES, list) };
    case 'wishDone': { const rows = prefix === 'v' ? S.VWISHES : S.WISHES, w = rows.find((x) => x.id === body.id); if (!w) return { ok: false, error: 'That request is gone.', status: 404 };
      w.done = body.done !== false; w.doneAt = w.done ? Date.now() : 0; return { ok: true, wishes: shapeWishes(rows, list) }; }
    case 'orderDetail': { const o = orders.find((x) => x.sid === body.sid); if (!o) return { ok: false, error: 'unknown order', status: 404 };
      return { ok: true, order: ownerOrder(o), buyer: o.buyer || { name: 'A fan', email: 'fan@example.com' }, shipping: o.shipping || null }; }
    case 'payStatus': return { ok: true, pay: prefix === 'v' ? payFixture('venue', 'pro') : payFixture('artist', PLANS[st.plan] ? st.plan : 'plus') };
    case 'postList': return { ok: true, posts: POSTS.map((p) => ({ ...p, hidden: false, reports: 0 })) };
    default: return null;
  }
}
/* THE BUSINESS DASHBOARD'S BOOK (admin.mjs bizGet / bizSave / bizPrefs) and the
   filed nights it joins (/api/history), so the Money tab can be looked at with
   enough rows to fold: thirty nights over the last five months, a weekly run on
   the calendar, a few logged. Edits change only this process. */
const BIZ_LIMITS = { band: 4, costs: 6 };
const localDay = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function NIGHT_ROWS() {
  const rows = [];
  for (let i = 0; i < 30; i++) {
    const at = NOW - (1 + i * 2) * 864e5 + 20 * 3600e3 - (NOW % 864e5) + 12 * 3600e3;   // every other evening, 8pm-ish local
    const gross = i % 3 === 0 ? 0 : Math.round((8 + (i * 7) % 40) * 100) / 100, tipped = gross ? Math.round(gross * 0.6 * 100) / 100 : 0;
    rows.push({ showId: `mock-night-${i}`, title: '', venue: ['The Ugly Duckling', 'Bar Roma', 'Sunset Jam'][i % 3], city: 'Koh Phangan',
      startedAt: at, endedAt: at + 3 * 3600e3, songsPlayed: 12 + (i % 5), totalVotes: 40 + (i * 13) % 60, peakVoters: 9 + (i % 7), room: 20, nets: 3,
      gross, unattributed: 0, source: 'stripe', paidVotes: gross ? 6 : 0, paidRequests: 0, tipped: i % 4 === 0 ? null : tipped,
      key: i % 3 === 0 ? `mock-run@${localDay(at)}` : null, top: null, topPlayed: null, topPaid: null });
  }
  return rows;
}
function BIZ_BOOK() {
  const gigs = {};
  for (const n of NIGHT_ROWS().slice(0, 4)) gigs[n.key || n.showId] = { pay: 15000, cut: null, tips: 2000, band: [{ name: 'Sam', cents: 5000 }], costs: [{ name: 'Fuel', cents: 800 }], merch: [], min: { perform: 180, break: 20, travel: 40, setup: 30 }, gear: [], note: '', at: NOW };
  return { v: 1, at: NOW, prefs: { hours: { perform: true, break: true, travel: true, setup: true } }, rules: { 'mock-run': { pay: 12000, cut: null, tips: null, band: [], costs: [], merch: [], min: { perform: null, break: null, travel: null, setup: null }, gear: [], note: '', at: NOW } }, gigs };
}
function bizAction(body, st) {
  S.BIZ ||= BIZ_BOOK(); S.NIGHTS ||= NIGHT_ROWS();
  const b = S.BIZ;
  switch (body.action) {
    case 'bizGet': {
      const occ = [];
      for (let i = 0; i < 26; i++) { const start = NOW - (2 + i * 15) * 864e5; occ.push({ eventId: 'mock-run', date: localDay(start), startsAt: start, endsAt: start + 3 * 3600e3, title: '', venue: 'The Ugly Duckling', city: 'Koh Phangan', tz: 'Asia/Bangkok', repeating: true }); }
      return { ok: true, biz: b, occ, limits: BIZ_LIMITS, cutPct: 10, name: NAME.artist, from: body.from, to: body.to, dropped: 0, oldestKept: null,
        ...(body.nights ? { nights: S.NIGHTS } : {}) };
    }
    case 'bizSave': {
      const box = body.rule != null ? b.rules : b.gigs, k = body.rule != null ? String(body.rule) : String(body.key || '');
      if (body.remove) { delete box[k]; return { ok: true }; }
      box[k] = { ...(body.gig || {}), at: NOW }; return { ok: true, gig: box[k] };
    }
    case 'bizPrefs': {
      if (body.hours) for (const k of Object.keys(body.hours)) b.prefs.hours[k] = body.hours[k] !== false;
      if (body.currency != null) { if (String(body.currency).toUpperCase() === 'USD') delete b.prefs.currency; else b.prefs.currency = String(body.currency).toUpperCase().slice(0, 3); }
      return { ok: true, prefs: b.prefs };
    }
    case 'eventHide': { S.HIDDEN_OCC ||= new Set(); S.HIDDEN_OCC.add(`${body.id}|${body.date}`); return { ok: true, events: [] }; }
    default: return null;
  }
}
/* /api/revenue with a page of payments, so the All payments list has something to fold */
function revenueFixture() {
  const payments = [];
  for (let i = 0; i < 48; i++) payments.push({ amount: i % 4 === 0 ? 5 : 3, kind: i % 4 === 0 ? 'tip' : 'votes', votes: i % 4 === 0 ? 0 : 3, email: `fan${i}@example.com`, note: i % 4 === 0 ? 'Great set!' : '', at: NOW - i * 3 * 864e5, redeemed: true });
  const sum = (f) => Math.round(payments.filter(f).reduce((a, p) => a + p.amount, 0) * 100) / 100;
  return { ok: true, enabled: true, payments, unredeemed: 0, totals: { all: sum(() => true), tips: sum((p) => p.kind === 'tip'), votes: sum((p) => p.kind === 'votes'), merch: 0, count: payments.length } };
}
/* one switch, by action — what /api/admin answers when the Studio is signed in */
function adminStub(body, st) {
  const biz = bizAction(body, st); if (biz) return biz;
  const shop = shopAction(body, S.MERCH, S.ORDERS, 'a1', 'm', st); if (shop) return shop;
  const msg = msgAction(body); if (msg) return msg;
  switch (body.action) {
    case 'planGet': return planFixture(st);
    /* the tour poster (admin.mjs tourSet / tourClear): a data URL is "stored" as the poster slot, a link rides alone or with it */
    case 'tourSet': {
      const has = (k) => Object.prototype.hasOwnProperty.call(body, k);
      let cur = tourOf(st) ? { ...tourOf(st) } : null;
      if (has('data') && body.data) {
        const m = /^data:(application\/pdf|image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data));
        if (!m) return { ok: false, error: 'That has to be a PNG, JPEG or PDF.', status: 400 };
        const bytes = Math.floor(m[2].length * 0.75), pdf = m[1] === 'application/pdf';
        if (pdf && bytes > TOUR_CAPS.pdf) return { ok: false, error: 'That PDF is over 3 MB. Export it smaller, or as a PNG or JPEG.', status: 400 };
        if (!pdf && bytes > TOUR_CAPS.image) return { ok: false, error: 'That photo is too big even after shrinking. Try another.', status: 400 };
        S.TOURDATA = body.data;
        cur = { url: `/api/img?a=a1&s=tour&v=${Date.now().toString(36)}`, type: pdf ? 'pdf' : m[1].replace('image/', '').replace('jpg', 'jpeg'), link: cur ? cur.link : '' };
      }
      if (has('link')) { if (!cur) return { ok: false, error: 'Upload the poster first, then add the link.', status: 400 }; cur.link = /^https:\/\//.test(String(body.link || '')) ? String(body.link) : ''; }
      S.TOUR = cur;
      return { ok: true, profile: profileFixture(st), limits: TOUR_CAPS };
    }
    case 'tourClear': S.TOUR = null; S.TOURDATA = null; return { ok: true, profile: profileFixture(st) };
    case 'eventList': return { ok: true, events: [], occurrences: [], place: null };
    case 'featureList': return { ok: true, events: [], sessions: [], featured: [] };
    case 'pitchList': return { ok: true, pitches: [], venues: [] };
    case 'flagList': return { ok: true, flags: {} };
    case 'verifyStatus': {   // the shape of admin.mjs verifyStatus → _verify.mjs artistVerifyChecks; a paid plan is verified, a Hobbyist sees the steps
      const paid = (PLANS[st.plan] ? st.plan : 'plus') !== 'free';
      return { ok: true, autoWhy: null, checks: { paidPlan: paid, payments: true, idOnFile: false, legalNameGiven: false, dobGiven: false, reviewed: paid, state: paid ? 'verified' : 'none', rejectedWhy: null, readyForReview: false } };
    }
    /* the artist's Stripe statement, twelve months with a few payments, so the
       Your-earnings card and its chart paint (MySet's books stay off: not the owner) */
    case 'ledger': {
      const months = []; const d = new Date(NOW);
      for (let i = 0; i < 12; i++) { const y = d.getFullYear(), m = d.getMonth() + 1; const gross = i === 0 ? 3 : i === 1 ? 13 : 0, fee = gross ? Math.round((gross * 0.029 + 0.3 * (gross / 3)) * 100) / 100 : 0;
        months.push({ month: `${y}-${String(m).padStart(2, '0')}`, gross, stripeFee: fee, platformFee: 0, net: Math.round((gross - fee) * 100) / 100, refunds: 0, count: gross ? gross / 3 : 0, payouts: 0, currency: 'USD' }); d.setMonth(d.getMonth() - 1); }
      const total = months.reduce((a, m) => ({ gross: a.gross + m.gross, stripeFee: a.stripeFee + m.stripeFee, platformFee: 0, net: a.net + m.net, refunds: 0, count: a.count + m.count }), { gross: 0, stripeFee: 0, platformFee: 0, net: 0, refunds: 0, count: 0 });
      return { ok: true, enabled: true, months, currency: 'USD', total, at: NOW };
    }
    case 'books': return { ok: true, enabled: false, months: [] };
    case 'profileGet': return { ok: true, profile: { name: NAME.artist, bio: 'A demo page.', photo: '', photos: [], links: {}, media: [] } };
    default: return { ok: true, stub: body.action };
  }
}
function authStub(body) {
  switch (body.action) {
    case 'list': return TEAM;
    case 'sessions': return { ok: true, sessions: [{ sid: 'mock', device: 'This phone', at: NOW, current: true }] };
    default: return { ok: true, stub: body.action };
  }
}
/* ---------- the Venue Studio, the same way ---------- */
function venueAdminStub(body, st) {
  const a = body.action;
  const shop = shopAction(body, S.VMERCH, S.VORDERS, 'v_v1', 'v', st);
  const page = () => ({ ok: true, venue: venueFixture(st), vouches: { count: 3, need: 3, names: ['Ana', 'Bo', 'Cy'] }, amenities: [['stage', 'Stage'], ['food', 'Food'], ['garden', 'Beer garden']].map(([key, label]) => ({ key, label })) });
  /* the venue's writes answer with the whole page again, as venueadmin.mjs does */
  if (/^(get|set|hours|amenity|menuAdd|menuSet|menuRemove|offerSave|offerRemove|photoUpload|photoClear|merchSave|merchRemove|merchPhoto|merchPhotoClear|merchMove)$/.test(a)) {
    if (shop && !shop.ok) return shop;
    return page();
  }
  if (shop) return shop;
  switch (a) {
    case 'planGet': return { ok: true, plan: 'pro', limits: VPLANS.pro, plans: VPLANS, billing: { subscribed: true, plan: 'pro', portal: true, pastDue: false }, del: null };
    case 'eventList': return { ok: true, events: [], occurrences: [] };
    case 'pitchList': return { ok: true, pitches: [] };
    case 'stats': return { ok: true, shows: [], totals: { shows: 0, people: 0, votes: 0 } };
    case 'ledger': return { ok: true, enabled: false, months: [] };
    default: return { ok: true, stub: a };
  }
}
function venueAuthStub(body) {
  switch (body.action) {
    case 'list': return { ok: true, slug: 'demo', emails: ['room@example.com'], email: 'room@example.com' };
    case 'sessions': return { ok: true, sessions: [] };
    default: return { ok: true, stub: body.action };
  }
}

/* ---------- the pictures: one small SVG per kind of thing, in the item's colour ----------
   The shop applies brightness(.82) in dark itself, so one drawing serves both themes. */
const kindOf = (title) => {
  const t = String(title || '').toLowerCase();
  if (/vinyl|\blp\b|record/.test(t)) return 'vinyl';
  if (/poster|print/.test(t)) return 'poster';
  if (/sticker/.test(t)) return 'sticker';
  if (/tote|bag/.test(t)) return 'tote';
  if (/hoodie|hood|sweat/.test(t)) return 'hoodie';
  if (/cassette|tape|\bcd\b|album|single|ep\b/.test(t)) return 'cassette';
  return 'tee';
};
const COLOURS = ['#2F6DB5', '#1D1D1F', '#E0563D', '#F0B429', '#3F8F6B', '#7B4FA6', '#D9536F', '#4A8DBE', '#8A6A4B', '#5C6B73', '#C74B2A', '#2E8B8B'];
const colourOf = (id) => COLOURS[parseInt(String(id).replace(/\D/g, '') || '0', 10) % COLOURS.length];
const svg = (inner, w = 480, h = 480) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#EEEDF1"/>${inner}</svg>`;
const ART = {
  tee: (c) => `<path d="M150 90l50-30q40 30 80 0l50 30 60 80-60 40-10-20v210H160V190l-10 20-60-40z" fill="${c}"/><path d="M200 60q40 30 80 0" fill="none" stroke="#EEEDF1" stroke-width="10"/>`,
  hoodie: (c) => `<path d="M140 110l40-40h120l40 40 60 80-60 40-10-20v210H150V210l-10 20-60-40z" fill="${c}"/><path d="M180 70q60-60 120 0-20 40-60 40t-60-40z" fill="${c}" stroke="#EEEDF1" stroke-width="8"/><rect x="180" y="300" width="120" height="60" rx="10" fill="#EEEDF1" opacity=".35"/><path d="M228 110v80M252 110v80" stroke="#EEEDF1" stroke-width="6"/>`,
  vinyl: (c) => `<circle cx="240" cy="240" r="200" fill="#1A1A1C"/><circle cx="240" cy="240" r="170" fill="none" stroke="#2A2A2E" stroke-width="3"/><circle cx="240" cy="240" r="140" fill="none" stroke="#2A2A2E" stroke-width="3"/><circle cx="240" cy="240" r="110" fill="none" stroke="#2A2A2E" stroke-width="3"/><circle cx="240" cy="240" r="72" fill="${c}"/><circle cx="240" cy="240" r="8" fill="#EEEDF1"/>`,
  poster: (c) => `<rect x="90" y="50" width="300" height="380" fill="#3A3A3C"/><rect x="108" y="68" width="264" height="344" fill="${c}"/><circle cx="240" cy="200" r="70" fill="#EEEDF1" opacity=".85"/><rect x="140" y="310" width="200" height="16" rx="8" fill="#EEEDF1" opacity=".9"/><rect x="170" y="340" width="140" height="12" rx="6" fill="#EEEDF1" opacity=".6"/>`,
  sticker: (c) => `<rect x="70" y="70" width="340" height="340" rx="14" fill="#fff"/>${[[150, 150], [240, 150], [330, 150], [150, 240], [240, 240], [330, 240], [150, 330], [240, 330], [330, 330]].map(([x, y], i) => i % 3 === 1 ? `<path d="M${x} ${y - 34}l10 24 26 2-20 17 6 26-22-14-22 14 6-26-20-17 26-2z" fill="${c}"/>` : `<circle cx="${x}" cy="${y}" r="32" fill="${c}" opacity="${i % 2 ? .75 : 1}"/>`).join('')}`,
  tote: (c) => `<path d="M170 150q70-110 140 0" fill="none" stroke="#5C4A3A" stroke-width="14" stroke-linecap="round"/><rect x="110" y="150" width="260" height="270" rx="12" fill="${c}"/><rect x="150" y="230" width="180" height="70" rx="8" fill="#EEEDF1" opacity=".85"/><rect x="170" y="256" width="140" height="14" rx="7" fill="${c}"/>`,
  cassette: (c) => `<rect x="60" y="120" width="360" height="240" rx="18" fill="#2A2A2E"/><rect x="90" y="150" width="300" height="110" rx="10" fill="${c}"/><circle cx="170" cy="205" r="34" fill="#EEEDF1"/><circle cx="310" cy="205" r="34" fill="#EEEDF1"/><circle cx="170" cy="205" r="12" fill="#2A2A2E"/><circle cx="310" cy="205" r="12" fill="#2A2A2E"/><rect x="140" y="290" width="200" height="40" rx="8" fill="#3A3A3C"/>`,
  avatar: (c) => `<circle cx="240" cy="240" r="240" fill="${c}"/><circle cx="240" cy="190" r="80" fill="#EEEDF1" opacity=".9"/><path d="M90 440q150-170 300 0z" fill="#EEEDF1" opacity=".9"/>`,
};
/* the venue's cover: a wide room — a dark ceiling, a lit stage, a warm floor */
const cover = (c) => svg(`<rect width="960" height="540" fill="#1B1B1F"/><rect y="330" width="960" height="210" fill="${c}"/><rect x="330" y="200" width="300" height="140" rx="8" fill="#3A3A3C"/><path d="M480 20L340 340h280z" fill="#FFF3C4" opacity=".16"/><circle cx="480" cy="30" r="14" fill="#FFF3C4"/>${[380, 480, 580].map((x) => `<rect x="${x - 18}" y="260" width="36" height="80" rx="6" fill="#1B1B1F"/>`).join('')}`, 960, 540);
function picture(q) {
  const s = q.get('s') || q.get('slot') || '';
  if (s === 'cover') return cover(colourOf('8'));
  if (s === 'tour') return svg(ART.poster(colourOf('3')));
  if (s === 'avatar') return svg(ART.avatar(q.get('a') === 'v_v1' ? COLOURS[4] : COLOURS[0]));
  const base = s.replace(/_[1-4]$/, ''), nth = Number((s.match(/_([1-4])$/) || [0, 0])[1]);
  const item = [...S.MERCH, ...S.VMERCH].find((m) => m.id === base);
  const kind = item ? kindOf(item.title) : 'tee';
  return svg(ART[kind](colourOf(base + nth)));   // the same item, a different tint per picture, so a swipe visibly moves
}

/* ---------- the two Studios boot signed in ---------- */
const SIGNIN = { 'studio.html': ['myset.token', 'myset.tab'], 'venue-studio.html': ['myset.vtoken', 'myset.vtab'] };
function signedIn(html, [tokenKey, tabKey], tab) {
  const pre = `<script>/* MOCK ONLY — tools/mock.mjs signs the Studio in; never in a served page */try{localStorage.setItem(${JSON.stringify(tokenKey)},'mock-token');localStorage.removeItem('myset.admin');localStorage.removeItem('myset.aslug');${tab ? `localStorage.setItem(${JSON.stringify(tabKey)},${JSON.stringify(tab)});` : ''}}catch(e){}</script>\n`;
  const i = html.indexOf('<script');
  return i < 0 ? pre + html : html.slice(0, i) + pre + html.slice(i);
}

/* ---------- the index: every state, one link each ---------- */
const GROUPS = [
  ['Fan', [
    ['/demo/community', 'Community — artist, with merch', 'the shop card sits second, the tip bar under it'],
    ['/none/community', 'Community — artist, no merch', 'no shop card; the tipbar is first'],
    ['/v/demo/community', 'Community — venue', '"the bar" for "the merch table"'],
  ]],
  ['Shop', [
    ['/demo/shop', 'Between shows', 'nine items on the Studio, seven on the page; every card state'],
    ['/demo/shop?live=1', 'Live tonight', 'the fab, "Tonight" tags, pickup-tonight copy'],
    ['/demo/shop?canbuy=0', 'Card payments off', 'no Buy anywhere; links still work; "takes cash"'],
    ['/demo/shop?allout=1', 'Everything sold out', 'every card dimmed, prices kept, no Buy'],
    ['/one/shop', 'One item', 'the grid\'s .one column; no "More from" strip in the sheet'],
    ['/none/shop', 'Empty shop', '"Nothing on the table right now"'],
    ['/v/demo/shop', 'Venue shop', '"Ask at the bar", "pick up at the bar"'],
    ['/demo/shop?picks=1', 'Picks strip', 'the founder toggle: five newest after the grid'],
    ['/demo/shop#m000001', 'Deep link to the sized tee', 'the sheet opens on arrival; M struck'],
    ['/demo/shop#ask', 'Make a request', 'the request sheet: what you’d like, your name, Send — the ask lands on the Studio list below'],
  ]],
  ['Return trips', [
    ['/demo/shop?paid=cs_test_demo', 'Paid', 'the receipt: tick, the line, code K7PQ — what the last Buy bought, or 2 × Tour tee (M)'],
    ['/demo/shop?cancelled=1', 'Cancelled', 'the "No charge" toast; the same sheet reopens if a Buy was pending'],
    ['/demo/community?paid=cs_test_demo', 'Paid, on the community page', 'the receipt card above the shop card'],
  ]],
  ['Studio', [
    ['/studio', 'Artist Studio, signed in', () => `a Bar Star; Menu → Merch store: ${S.MERCH.length} items, ${S.ORDERS.length} orders, ${S.WISHES.filter((w) => !w.done).length} requests open`],
    ['/studio?tab=merch', 'Merch store, straight in', 'the deep link; the Menu tab lit; Requests from the shop under the orders'],
    ['/studio?plan=free', 'Studio on the free plan', 'the items behind the Bar Star lock; the orders never are'],
    ['/studio?live=1&tab=live', 'Studio with the room live', 'Live tab, 12 in the room'],
    ['/studio?first=1&tab=live', 'A first gig', 'the pinned card before a show; add ?live=1 for the example rows'],
    ['/studio?tab=messages', 'Messages, straight in', () => { const c = msgIndex().counts; return `the inbox: ${c.unread} unread of ${S.MSGS.length} conversations across five folders; the Menu tab wears the dot`; }],
    ['/studio?tab=gigs', 'Gigs tab, no poster', 'the Tour dates poster card under Add a gig: "No poster yet", Upload a poster'],
    ['/studio?tab=gigs&tour=1', 'Gigs tab with a poster', 'the card with the thumbnail, the tickets link field, Replace and Remove'],
    ['/venues', 'Venue Studio, signed in', () => `a Pro venue; its Merch tab: ${S.VMERCH.length}/12 items, ${S.VORDERS.length} orders`],
    ['/venues?tab=merch', 'Venue Studio, Merch tab', 'straight in'],
  ]],
  ['Other', [
    ['/demo', 'Artist page', 'between shows; ?live=1 for tonight'],
    ['/demo?tour=1', 'Artist page with a tour poster', 'View tour dates under the shows; the poster window with Download and Grab your tickets'],
    ['/demo#book', 'Book the artist', 'the Book sheet on arrival; Send lands the request in the Studio\'s inbox'],
    ['/demo#m=t0000000003.' + 'k3'.padEnd(32, '3'), 'A booker’s thread link', 'the wedding conversation as Mel sees it: her words right, the reply left, a reply box'],
    ['/demo/vote', 'Vote page', 'the setlist, quiet; ?live=1 for the tally'],
    ['/v/demo', 'Venue page', 'hours, who is playing'],
    ['/index.html', 'Home', 'a fresh visitor sees the empty pickers (nothing remembered, no location): pick Australia → Melbourne → Search for the one gig tonight. No map key here, so View on MAP says "Map unavailable"'],
  ]],
];
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
function indexPage() {
  const groups = GROUPS.map(([name, rows]) => `<h2>${esc(name)}</h2><ul>${rows.map(([href, label, note]) =>
    `<li><a href="${esc(href)}"><b>${esc(label)}</b><span>${esc(typeof note === 'function' ? note() : note)}</span><code>${esc(href)}</code></a></li>`).join('')}</ul>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>MySet mock — every state</title>
<script>(()=>{let t='light';try{const s=localStorage.getItem('myset.theme');if(s==='light'||s==='dark')t=s}catch(e){}document.documentElement.dataset.theme=t})();</script>
<style>
:root{--bg:#F5F5F7;--surface:#FFFFFF;--ink:#1D1D1F;--muted:#6E6E73;--accent:#FF375F;--accent-ink:#FF5650;--accent-soft:rgba(255,86,80,.12);--grad:linear-gradient(135deg,#FF375F 0%,#FF6B45 100%);--r:18px;--r-sm:14px;--sh-1:0 1px 2px rgba(0,0,0,.04),0 3px 10px rgba(0,0,0,.05);color-scheme:light}
:root[data-theme=dark]{--bg:#000;--surface:#1C1C1E;--ink:#F5F5F7;--muted:#98989D;--accent:#FF456E;--accent-soft:rgba(255,86,80,.18);--sh-1:0 1px 2px rgba(0,0,0,.5),0 3px 10px rgba(0,0,0,.4);color-scheme:dark}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
main{max-width:560px;margin:0 auto;padding:22px 18px calc(40px + env(safe-area-inset-bottom))}
h1{font-size:24px;letter-spacing:-.02em;margin:0 0 4px}h1 i{font-style:normal;background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.lede{color:var(--muted);font-size:14px;margin:0 0 18px}
h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:22px 0 8px;display:flex;align-items:center;gap:8px}h2::before{content:"";width:16px;height:4px;border-radius:2px;background:var(--grad)}
ul{list-style:none;margin:0;padding:0;background:var(--surface);border-radius:var(--r);box-shadow:var(--sh-1);overflow:hidden}
li+li{border-top:1px solid rgba(128,128,128,.14)}
a{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 16px;color:inherit;text-decoration:none;min-height:56px}
a:active{background:var(--accent-soft)}a b{font-weight:600}a span{grid-column:1;color:var(--muted);font-size:13px}
a code{grid-column:2;grid-row:1/3;align-self:center;font:12px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent-ink);white-space:nowrap;max-width:44vw;overflow:hidden;text-overflow:ellipsis}
@media(max-width:480px){a{grid-template-columns:1fr}a code{grid-column:1;grid-row:auto;max-width:none;margin-top:3px}}   /* a phone: the address under the note, not beside it */
.note{margin:22px 0 0;padding:14px 16px;border-radius:var(--r-sm);background:var(--accent-soft);font-size:13.5px}
.note b{display:block;margin-bottom:4px}.note p{margin:6px 0 0}
.reset{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:12px 18px;border-radius:999px;background:var(--ink);color:var(--bg);font-weight:600;text-decoration:none}
.foot{margin-top:26px;color:var(--muted);font-size:12.5px}
</style></head><body><main>
<h1><i>MySet</i> mock</h1>
<p class="lede">Every state a page can be in, against a fake API on this machine. Nothing here touches myset.vip, Stripe or a real account. Buy comes straight back as paid.</p>
${groups}
<div class="note"><b>The address is the state.</b><code>?live=1</code> is live, the plain address is between shows; only a return trip from checkout (<code>?paid=</code>, <code>?cancelled=</code>) keeps the state it left with.
<p><b>Dark theme:</b> light by default, like every page on the site (the system setting is not read). The pages' own moon button (top right) is remembered, and this index follows it.</p>
<p><b>Reduced motion:</b> macOS System Settings → Accessibility → Display → Reduce motion, then reload the page. The strips stand still and the receipt's tick draws at once.</p></div>
<a class="reset" href="/__mock/reset">↺ Reset fixtures</a>
<p class="foot">Studio edits (items, sizes, photos, orders) live in this process's memory — Reset puts the nine items and three orders back and clears the state cookies. Ctrl-C stops the server. <code>tools/mock.mjs</code>.</p>
</main></body></html>`;
}

/* ---------- the server ---------- */
const json = (rs, o, status = 200, extra = {}) => { rs.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra }); rs.end(JSON.stringify(o)); };
/* A stub's NUMERIC `status` is the HTTP code and is stripped from the body; any other
   `status` (a word, like a payout's or an order's) is payload and rides through untouched.
   writeHead('verified') is a RangeError that kills the whole process — learned the hard way. */
const answer = (rs, r) => { if (typeof r.status === 'number') { const { status, ...rest } = r; return json(rs, rest, status); } return json(rs, r, 200); };
const readBody = (rq) => new Promise((r) => { let s = ''; rq.on('data', (c) => (s += c)); rq.on('end', () => { try { r(JSON.parse(s || '{}')); } catch { r({}); } }); });
const log = (...a) => console.log('  ' + a.join(' '));
/* The buyer's return path, built here the way pay.mjs builds it: `from` chooses between
   paths this server makes from the slug, never a url. The one session id, always. */
function payStub(body, q, st) {
  const venue = q.has('v'), slug = q.get('a') || q.get('v') || 'demo';
  const home = venue ? `/v/${slug}` : `/${slug}`;
  if (venue && body.kind !== 'merch') return { status: 400, ok: false, error: 'unknown kind' };
  if (body.kind === 'merch') {
    const item = merchFor(slug, venue, st).find((m) => m.id === body.item);
    if (!st.canBuy) return { status: 503, ok: false, error: 'payments-not-configured' };
    if (!item) return { status: 404, ok: false, error: 'That item isn’t for sale right now' };
    const qty = Math.max(1, Math.min(5, parseInt(body.qty, 10) || 1));
    if (item.out || item.stock === 0) return { status: 409, ok: false, error: 'That one’s sold out' };
    if (item.stock != null && item.stock < qty) return { status: 409, ok: false, error: `Only ${item.stock} left` };
    if (item.cents < MERCH_CAPS.minCents) return { status: 400, ok: false, error: `That one isn’t sold through MySet — ask at the ${venue ? 'bar' : 'merch table'}` };
    if ((item.variants || []).length) {
      const v = item.variants.find((x) => x.label.toLowerCase() === String(body.variant || '').replace(/\s+/g, ' ').trim().toLowerCase());
      if (!v) return { status: 400, ok: false, error: 'Pick a size' };
      if (v.out || v.stock === 0) return { status: 409, ok: false, error: 'That size is sold out' };
      if (v.stock != null && v.stock < qty) return { status: 409, ok: false, error: `Only ${v.stock} left in ${v.label}` };
    }
  } else if (body.kind === 'tip') {
    const cents = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 50000) return { status: 400, ok: false, error: 'Tip must be between $1 and $500' };
  } else if (!['votes', 'song_votes', 'request_hold'].includes(body.kind)) return { status: 400, ok: false, error: 'unknown kind' };
  const shop = body.from === 'shop' && body.kind === 'merch', comm = body.from === 'community' || body.kind === 'merch';
  const back = venue ? (body.from === 'shop' ? `${home}/shop` : `${home}/community`) : shop ? `${home}/shop` : comm ? `${home}/community` : `${home}/vote`;
  S.lastPay = { ...body, venue, slug, live: st.live, at: Date.now() };
  return { ok: true, url: `${back}?paid=cs_test_demo`, id: 'cs_test_demo' };
}
/* what /api/confirm says: the last thing bought through this process, else the order the fixture ships with */
function confirmStub(st) {
  const p = S.lastPay;
  if (p && p.kind !== 'merch') return { ok: true, kind: p.kind, amount: Number(p.amount) || 0, granted: p.kind === 'votes' ? (PACKS[p.pack] || {}).votes || 0 : 0, song: p.song || '', fan: p.fan || '', at: p.at };
  const item = p && merchFor(p.slug, p.venue, st).find((m) => m.id === p.item);
  const qty = p ? Math.max(1, Math.min(5, parseInt(p.qty, 10) || 1)) : 2;
  if (item && !p.counted) {   // the count comes down once per purchase, the size's first, as takeStock does
    const v = (item.variants || []).find((x) => x.label.toLowerCase() === String(p.variant || '').toLowerCase());
    if (v && v.stock != null) v.stock = Math.max(0, v.stock - qty); else if (item.stock != null) item.stock = Math.max(0, item.stock - qty);
    p.counted = true; }
  const order = item
    ? { item: item.id, title: item.title, qty, variant: (item.variants || []).length ? String(p.variant || '') : '', ship: item.ship, cents: item.cents * qty, post: postOf(item), code: 'K7PQ', show: p.live ? SHOW_LABEL : '', at: p.at }
    : { item: 'm000001', title: 'Tour tee', qty: 2, variant: 'M', ship: 'pickup', cents: 5000, post: 0, code: 'K7PQ', show: st.live ? SHOW_LABEL : '', at: Date.now() };
  return { ok: true, kind: 'merch', amount: (order.cents + order.post) / 100, granted: 0, song: '', fan: (p && p.fan) || '', at: order.at, order };
}

const srv = http.createServer(async (rq, rs) => {
  const u = new URL(rq.url, 'http://x');
  const q = u.searchParams;
  const st = stateOf(rq, q);

  /* ---------- this tool's own pages ---------- */
  if (u.pathname === '/__mock' || u.pathname === '/__mock/') { rs.writeHead(200, { 'content-type': T['.html'], 'cache-control': 'no-store' }); return rs.end(indexPage()); }
  if (u.pathname === '/__mock/reset') {
    S = fresh(); log('reset — fixtures restored, cookies cleared');
    const clear = FLAGS.map((k) => `mock_${k}=; Path=/; Max-Age=0; SameSite=Lax`);
    if (rq.method === 'POST') return json(rs, { ok: true, reset: true }, 200, { 'set-cookie': clear });
    rs.writeHead(303, { location: '/__mock', 'set-cookie': clear, 'cache-control': 'no-store' }); return rs.end();
  }

  /* ---------- the API, first, as netlify.toml's first rule ---------- */
  if (u.pathname === '/api/img') {
    /* the poster the Studio uploaded in this process is served back as it came, PDF or picture (img.mjs serves the stored type) */
    if (q.get('s') === 'tour' && S.TOURDATA) { const m = /^data:([^;]+);base64,(.+)$/.exec(S.TOURDATA); rs.writeHead(200, { 'content-type': m[1], 'cache-control': 'no-store', ...(m[1] === 'application/pdf' ? { 'content-disposition': 'inline' } : {}) }); return rs.end(Buffer.from(m[2], 'base64')); }
    rs.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' }); return rs.end(picture(q)); }
  /* Netlify's image CDN (artist.html's cdn()): the picture behind ?url=, as it is — no resizing here */
  if (u.pathname === '/.netlify/images') {
    const src = new URL(q.get('url') || '/', 'http://x');
    if (src.pathname === '/api/img') { rs.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' }); return rs.end(picture(src.searchParams)); }
    const f = path.join(ROOT, src.pathname);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404, { 'content-type': 'text/plain' }); return rs.end('not here: ' + src.pathname); }
    rs.writeHead(200, { 'content-type': T[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); return fs.createReadStream(f).pipe(rs);
  }
  if (u.pathname === '/api/fan') {
    const what = q.get('what'), venue = q.has('v'), slug = q.get('a') || q.get('v') || 'demo';
    if (what === 'community') return json(rs, communityFixture(slug, venue, st));
    if (what === 'profile') return json(rs, profileFixture(st));
    if (what === 'events') return json(rs, q.has('places') ? placesFixture() : q.has('a') ? gigsFixture() : cityFeed(q));   // the front door reads through the door too (0088)
    if (what === 'artists') return json(rs, artistsFixture());
    if (what === 'mapconfig') return json(rs, { ok: true, enabled: false, key: '' });
    if (what === 'board') return json(rs, boardFixture(st));
    if (what === 'me') return json(rs, meFixture(st));
    if (what === 'venue') return json(rs, venuePage(st));
    if (what === 'warm') { rs.writeHead(200, { 'content-type': 'text/plain' }); return rs.end('warm'); }
    return json(rs, { ok: false, error: 'unknown read' }, 404);
  }
  if (u.pathname === '/api/community' && rq.method === 'GET') return json(rs, communityFixture(q.get('a') || q.get('v') || 'demo', q.has('v'), st));
  if (u.pathname === '/api/community' && rq.method === 'POST') {
    const body = await readBody(rq);
    if (body.action === 'wish') { const r = wishStub(body, q.has('v')); log('POST /api/community wish', JSON.stringify({ text: body.text, name: body.name }), '→', r.ok ? r.id : `${r.status} ${r.error}`); return answer(rs, r); }
    return json(rs, { ok: true, stub: body.action });
  }
  if (u.pathname === '/api/profile') return json(rs, profileFixture(st));
  if (u.pathname === '/api/events') return json(rs, q.has('places') ? placesFixture() : q.has('a') ? gigsFixture() : cityFeed(q));
  if (u.pathname === '/api/board') return json(rs, boardFixture(st));
  if (u.pathname === '/api/me') return json(rs, meFixture(st));
  if (u.pathname === '/api/venue') return json(rs, venuePage(st));
  if (u.pathname === '/api/artists') return json(rs, artistsFixture());
  if (u.pathname === '/api/mapconfig') return json(rs, { ok: true, enabled: false, key: '' });
  /* the real shape (rsvp.mjs): the fan's own state back, and the night's count — artist.html paints both */
  if (u.pathname === '/api/rsvp') { const body = rq.method === 'POST' ? await readBody(rq) : {}; const on = !!body.on; return json(rs, { ok: true, on, n: on ? 13 : 12 }); }
  /* the Book button's door (messages.mjs): a public POST to send, read at the booker's link, or reply — never a GET */
  if (u.pathname === '/api/messages') {
    if (q.has('v')) return json(rs, { ok: false, error: 'Venue pages don’t take messages.' }, 400);
    const body = rq.method === 'POST' ? await readBody(rq) : {};
    const r = publicMsg(rq.method, q, body);
    log(`${rq.method.padEnd(4)} /api/messages`, JSON.stringify({ action: body.action, name: body.name, text: String(body.text || '').slice(0, 40) }), '→', r.ok ? (r.id ? `${r.id} k=${r.k.slice(0, 6)}…` : 'ok') : `${r.status} ${r.error}`);
    return answer(rs, r);
  }
  if (u.pathname === '/api/pay') {
    const body = rq.method === 'POST' ? await readBody(rq) : {};
    const r = payStub(body, q, st); log('POST /api/pay', JSON.stringify(body), '→', r.url || `${r.status || 200} ${r.error || ''}`);
    return answer(rs, r);
  }
  if (u.pathname === '/api/confirm') { const r = confirmStub(st); log('GET  /api/confirm', u.search, '→', r.kind, r.order ? `${r.order.qty} × ${r.order.title}${r.order.variant ? ` (${r.order.variant})` : ''} ${r.order.code}` : ''); return json(rs, r); }
  /* the real code, no store behind it: the sign page (sign.html) draws it inline */
  if (u.pathname === '/api/qr') {
    const { qrSvg } = await import('../netlify/functions/_qr.mjs');
    rs.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' });
    return rs.end(qrSvg('https://myset.vip/demo', { scale: Math.max(2, Math.min(24, parseInt(u.searchParams.get('s'), 10) || 8)) }));
  }
  /* the Studios, signed in */
  if (u.pathname === '/api/stage') return json(rs, stageFixture(st));
  if (u.pathname === '/api/admin') {
    const body = rq.method === 'POST' ? await readBody(rq) : {};
    if (!/^(planGet|merchList|orderList|wishList|payStatus|postList|verifyStatus|flagList|eventList|featureList|pitchList|msgCount|msgList)$/.test(body.action || '')) log('POST /api/admin', JSON.stringify(body).slice(0, 160));
    return answer(rs, adminStub(body, st));
  }
  if (u.pathname === '/api/auth') return json(rs, authStub(rq.method === 'POST' ? await readBody(rq) : {}));
  if (u.pathname === '/api/revenue') return json(rs, revenueFixture());
  if (u.pathname === '/api/history') {
    S.NIGHTS ||= NIGHT_ROWS();
    if (rq.method === 'POST') { const body = await readBody(rq); log('POST /api/history', JSON.stringify(body).slice(0, 160));
      if (body.action === 'hide') { const r = S.NIGHTS.find((n) => n.showId === body.show); if (!r) return json(rs, { ok: false, error: 'unknown show' }, 404); r.hidden = true; return json(rs, { ok: true, showId: r.showId, hidden: true }); }
      return json(rs, { ok: true, stub: body.action }); }
    if (u.searchParams.get('show')) { const r = S.NIGHTS.find((n) => n.showId === u.searchParams.get('show')); return r ? json(rs, { ok: true, show: { ...r, played: [], requested: [] } }) : json(rs, { ok: false, error: 'unknown show' }, 404); }
    const shows = S.NIGHTS.filter((n) => !n.hidden);
    return json(rs, { ok: true, live: false, shows, locked: false, nights: shows.length });
  }
  if (u.pathname === '/api/venueadmin') {
    const body = rq.method === 'POST' ? await readBody(rq) : {};
    if (!/^(get|planGet|merchList|orderList|wishList|payStatus|postList|eventList|pitchList|stats)$/.test(body.action || '')) log('POST /api/venueadmin', JSON.stringify(body).slice(0, 160));
    return answer(rs, venueAdminStub(body, st));
  }
  if (u.pathname === '/api/venueauth') return json(rs, venueAuthStub(rq.method === 'POST' ? await readBody(rq) : {}));
  if (u.pathname.startsWith('/api/')) return json(rs, { ok: true, stub: u.pathname });

  /* ---------- the pages, through the rewrites ---------- */
  if (u.pathname === '/') { rs.writeHead(200, { 'content-type': T['.html'], 'cache-control': 'no-store' }); return rs.end(indexPage()); }   // the site's front door is /index.html here
  const to = rewrite(u.pathname);
  if (to && to.moved) { rs.writeHead(301, { location: to.moved }); return rs.end(); }
  if (to && to.text) { rs.writeHead(200, { 'content-type': T['.txt'] }); return rs.end(to.text); }
  const p = path.join(ROOT, to);
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rs.writeHead(404, { 'content-type': 'text/plain' }); return rs.end('not here: ' + u.pathname); }
  const ext = path.extname(p), head = { 'content-type': T[ext] || 'application/octet-stream', 'cache-control': 'no-store' };
  if (ext === '.html') head['set-cookie'] = cookieHeaders(q);       // the address sets the state the page's API calls will read
  rs.writeHead(200, head);
  if (SIGNIN[to]) return rs.end(signedIn(fs.readFileSync(p, 'utf8'), SIGNIN[to], (q.get('tab') || '').replace(/[^a-z]/g, '') || null));
  fs.createReadStream(p).pipe(rs);
});

srv.listen(PORT, '127.0.0.1', () => {
  const b = `http://127.0.0.1:${PORT}`;
  console.log(`mock MySet — serving ${ROOT}\n`);
  console.log(`  ${b}/            the index: every state, one link each`);
  console.log(`  ${b}/demo/shop   the shop · ?live=1 · ?canbuy=0 · ?allout=1 · /one/shop · /none/shop · /v/demo/shop`);
  console.log(`  ${b}/studio      the Artist Studio, signed in · ?tab=merch · ?plan=free`);
  console.log(`  ${b}/venues      the Venue Studio, signed in\n`);
  console.log(`  Nothing here touches myset.vip. Buy comes back as ?paid=cs_test_demo; Studio edits live in memory until Reset or Ctrl-C.`);
});
