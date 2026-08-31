import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';

export const store = () => getStore('myset');

/* ---------- starter setlist offered to a new artist ---------- */
export const STARTER_SONGS = [
  // A starter pack of well-known covers, offered to a brand-new artist so their
  // first gig isn't a blank page. Nobody's own songs belong in here.
  ['The Joker','Steve Miller Band'],
  ['Jack & Diane','John Mellencamp'],
  ['Faith','George Michael'],
  ['Crazy Little Thing Called Love','Queen'],
  ['Shape Of You','Ed Sheeran'],
  ['Amie','Pure Prairie League'],
  ['Hey Jude','The Beatles'],
  ['Vienna','Billy Joel'],
  ['Best Part','Daniel Caesar'],
  ['Peaceful Easy Feeling','Eagles'],
  ['Brown Eyed Girl','Van Morrison'],
  ['Chicken Fried','Zac Brown Band'],
  ['Wagon Wheel','Darius Rucker'],
  ['Margaritaville','Jimmy Buffett'],
  ['Bar Song (Tipsy)','Shaboozey'],
  ['What I Got','Sublime'],
  ['Santeria','Sublime'],
  ['This Love','Maroon 5'],
  ['Sunday Morning','Maroon 5'],
  ['Better Together','Jack Johnson'],
  ['Banana Pancakes','Jack Johnson'],
  ["I'm Yours",'Jason Mraz'],
  ['Hey Soul Sister','Train'],
  ['Drops Of Jupiter','Train'],
  ['Perfect','Ed Sheeran'],
  ['All Of Me','John Legend'],
  ['Circles','Post Malone'],
  ['Wish You Were Here','Pink Floyd'],
  ['Sitting On The Dock Of The Bay','Otis Redding'],
  ['Feel It Still','Portugal. The Man'],
  ["Ain't No Rest For The Wicked",'Cage The Elephant'],
  ['Come Together','The Beatles'],
  ['Sweet Home Alabama','Lynyrd Skynyrd'],
  ['Tennessee Whiskey','Chris Stapleton'],
  ["Summer Of '69",'Bryan Adams'],
  ['2009','Mac Miller'],
  ['Something Like Olivia','John Mayer'],
  ["Ain't No Sunshine",'Bill Withers'],
  ['Stick Season','Noah Kahan'],
  ['Do You Remember','Jack Johnson'],
  ['Taylor','Jack Johnson'],
  ['Fast Car','Tracy Chapman'],
  ['3 AM','Matchbox Twenty'],
  ['Landslide','Fleetwood Mac'],
  ['Hey There Delilah',"Plain White T's"],
  ['Fire And Rain','James Taylor'],
  ['Hallelujah','Jeff Buckley'],
  ['Have You Ever Seen The Rain','Creedence Clearwater Revival'],
  ['Gravity','John Mayer'],
  ['Why Georgia','John Mayer'],
  ['Slow Dancing In A Burning Room','John Mayer'],
  ['Who Says','John Mayer'],
  ['Stop This Train','John Mayer'],
  ['Edge Of Desire','John Mayer'],
  ["Free Fallin'",'Tom Petty (John Mayer version)'],
  ['I Will Follow You Into The Dark','Death Cab For Cutie'],
  ['Catch & Release','Matt Simons'],
  ['Simple Man','Lynyrd Skynyrd'],
  ['Imagine','John Lennon'],
  ['Until I Found You','Stephen Sanchez'],
  ['Blackbird','The Beatles'],
  ['Follow The Sun','Xavier Rudd'],
];

/* Stamped on every new record. Nothing is multi-artist yet, but a field costs
   nothing now and is the difference between a rename and a rewrite later. */
export const ARTIST_ID = 'perry-idyll';
/** The founding artist. Used when no slug is given and by the legacy studio code. */
export const DEFAULT_ARTIST = 'perry-idyll';

/* Must be generated OUTSIDE a CAS callback — a retry would otherwise produce a
   different id on each attempt. */
export function newShowId(now = Date.now()) {
  const d = new Date(now), p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
         `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

export const slug = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* Deliberately blank. A second artist signing up must never inherit the first
   artist's name, venue or setlist — `getShow` fills the name in from the
   registry, and the Studio offers the starter pack as an explicit choice. */
export function defaultShow() {
  return {
    artist: '',
    venue: '',
    city: '',
    showTime: '',
    // 'pre' until the artist actually taps Start the show. Defaulting to 'live'
    // meant every page claimed a gig was happening the moment an account existed.
    status: 'pre',               // pre | live | ended
    windowOpen: true,
    nowPlaying: null,
    played: [],
    freeCredits: 3,
    unlimited: false,        // everyone votes without limit
    unlimitedFans: [],       // specific devices that do — the artist's own, for testing
    replayCost: 5,
    /* Asking for something that isn't on the list. Off by default — an artist
       who can't play requests should never be asked for them. */
    requests:  { on: false, cost: 3 },
    birthdays: { on: false, cost: 3 },
    packs: DEFAULT_PACKS(),
    songs: [],
    showId: null,
    artistId: ARTIST_ID,
    startedAt: null,
    nowPlayingAt: null,
    log: [],          // one entry per song started — see LOG note below
    updatedAt: Date.now(),
  };
}

/* What the audience can buy. Editable from the Studio; pay.mjs reads these and
   never trusts a price from the client. */
export const PACK_KEYS = ['small', 'big', 'max'];
export const DEFAULT_PACKS = () => ({
  small: { votes: 3,  cents: 300 },
  big:   { votes: 9,  cents: 700 },
  max:   { votes: 18, cents: 1100 },
});
/** The two ask-for-something switches. Cost is in VOTES, not money. */
export function normAsk(a, dflt = 3) {
  const v = a || {};
  return {
    on: !!v.on,
    cost: Math.max(1, Math.min(99, parseInt(v.cost, 10) || dflt)),
  };
}

export function normPacks(p) {
  const d = DEFAULT_PACKS(), out = {};
  for (const k of PACK_KEYS) {
    const v = (p && p[k]) || {};
    out[k] = {
      votes: Math.max(1, Math.min(100, parseInt(v.votes, 10) || d[k].votes)),
      cents: Math.max(100, Math.min(50000, parseInt(v.cents, 10) || d[k].cents)),
    };
  }
  return out;
}

/* LOG note — this is load-bearing.
   `clearAllFanVotes()` runs every time a song is started, which DESTROYS the
   tally that song won with. If it is not captured in the same handler, it is
   gone forever and no show history can ever be reconstructed. */

/* ============================================================
   STORAGE
     show        -> config (artist writes; rare)
     f0..f{N-1}  -> sharded fan records {fanId:{v:[],extra:n}}
     meta        -> tips[] + paid{} (writes only on payment)

   Reads use strong consistency (never list(), which lags minutes).
   Writes use compare-and-swap. Fan records are SHARDED so a burst
   of voters spreads across many documents instead of contending
   on one, which is what makes concurrent voting lossless.
   ============================================================ */
/* Every record that belongs to an artist is namespaced by their id. Nothing
   about a show, a setlist, a fan's votes or a payment is global any more —
   that is what makes a second artist possible without a rewrite. */
export const KEY = {
  show:    (a) => `show_${a}`,
  fan:     (a, n) => `f${n}_${a}`,
  meta:    (a) => `meta_${a}`,
  profile: (a) => `profile_${a}`,
  histIdx: (a) => `histidx_${a}`,
  hist:    (a, showId) => `hist_${a}_${showId}`,
  lyrics:  (a, songId) => `lyr_${a}_${songId}`,
  reqs:    (a) => `req_${a}`,
};
/** Artist ids are used inside blob keys, so they must stay boring. */
export const cleanArtistId = (v) =>
  String(v || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);

export const SHARDS = 12;
const shardKey = (a, n) => KEY.fan(a, n);
export function shardOf(fanId) {
  let h = 5381;
  for (let i = 0; i < fanId.length; i++) h = ((h * 33) ^ fanId.charCodeAt(i)) >>> 0;
  return h % SHARDS;
}

export async function readDoc(key, fallback) {
  try {
    const r = await store().getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (r && r.data) return { data: r.data, etag: r.etag || null };
  } catch {}
  return { data: fallback, etag: null };
}

/** CAS write loop on a single document.
 *  fn(data) mutates; return false to abort.
 *  `verify(data)` (optional) is re-read AFTER the write — if it fails we retry,
 *  which protects against a conditional write that reports success but does not
 *  stick under heavy concurrency. */
export async function casDoc(key, fallback, fn, verify = null, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const { data, etag } = await readDoc(key, fallback());
    const out = fn(data);
    if (out === false) return { aborted: true, data };
    let w;
    try {
      w = await store().set(key, JSON.stringify(data), etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    } catch { w = { modified: false }; }

    if (!w || w.modified !== false) {
      if (!verify) return { ok: true, data, result: out };
      const check = await readDoc(key, fallback());
      if (verify(check.data)) return { ok: true, data: check.data, result: out };
    }
    await new Promise((r) => setTimeout(r, Math.min(200, 15 + i * 10) + Math.random() * 70));
  }
  throw new Error('busy');
}

/* ---------- show config ---------- */
function normShow(s) {
  const d = defaultShow();
  const show = { ...d, ...(s || {}) };
  if (!Array.isArray(show.songs)) show.songs = [];
  if (!Array.isArray(show.played)) show.played = [];
  if (typeof show.freeCredits !== 'number') show.freeCredits = 3;
  if (typeof show.replayCost !== 'number') show.replayCost = 5;
  if (!Array.isArray(show.log)) show.log = [];
  show.unlimited = !!show.unlimited;
  show.unlimitedFans = (Array.isArray(show.unlimitedFans) ? show.unlimitedFans : []).slice(0, 20);
  show.packs = normPacks(show.packs);
  show.requests = normAsk(show.requests);
  show.birthdays = normAsk(show.birthdays);
  show.artistId ||= ARTIST_ID;
  // derived from stored data, so a CAS retry produces the identical value
  if (!show.showId) show.showId = 'show-' + (show.updatedAt || 0);
  if (!show.startedAt) show.startedAt = show.updatedAt || Date.now();
  return show;
}
export async function getShow(aid) {
  const { data } = await readDoc(KEY.show(aid), null);
  const show = normShow(data);
  show.artistId = aid;
  if (!show.artist) {                      // the name lives in the registry
    const { artistById } = await import('./_auth.mjs');
    const a = await artistById(aid);
    show.artist = (a && a.name) || '';
  }
  return show;
}
export const mutateShow = (aid, fn) =>
  casDoc(KEY.show(aid), defaultShow, (s) => {
    const show = normShow(s);
    show.artistId = aid;
    Object.keys(s || {}).forEach((k) => delete s[k]);
    Object.assign(s, show);
    const r = fn(s);
    if (r !== false) s.updatedAt = Date.now();
    return r;
  });

/* ---------- fan shards ---------- */
export const mutateFan = (aid, fanId, fn, verifyFan = null) =>
  casDoc(
    shardKey(aid, shardOf(fanId)),
    () => ({}),
    (bag) => {
      const me = (bag[fanId] ||= { v: [], extra: 0, ts: {} });
      me.v ||= []; me.extra ||= 0; me.ts ||= {}; me.spent ||= 0;
      return fn(me, bag);
    },
    verifyFan ? (bag) => verifyFan((bag && bag[fanId]) || { v: [], extra: 0 }) : null
  );

/** All fan records, merged from every shard (parallel strong reads). */
export async function readFans(aid) {
  const parts = await Promise.all(
    Array.from({ length: SHARDS }, (_, n) => readDoc(shardKey(aid, n), {}))
  );
  const fans = {};
  for (const p of parts) Object.assign(fans, p.data || {});
  return fans;
}
export async function clearAllFanVotes(aid) {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      casDoc(shardKey(aid, n), () => ({}), (bag) => {
        // drop stale stamps and the non-song spend too — free credits refresh
        // here, so anything charged against them has to refresh with them
        for (const id of Object.keys(bag)) { bag[id].v = []; bag[id].ts = {}; bag[id].spent = 0; }
        return true;
      }, null).catch(() => {})
    )
  );
}
/* Votes someone PAID for shouldn't evaporate because the artist tapped
   "New show". Unspent paid votes carry into the next show unless the fan chose
   to gift them. Everything else — free credits, picks, timestamps — resets. */
export function unspentPaid(fan, show) {
  const extra = fan.extra || 0;
  if (extra <= 0) return 0;
  const total = (show.freeCredits || 0) + extra;
  return Math.max(0, Math.min(extra, total - creditsUsed(fan, show)));
}
export async function carryFans(aid, show) {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      casDoc(shardKey(aid, n), () => ({}), (bag) => {
        for (const id of Object.keys(bag)) {
          const carry = unspentPaid(bag[id], show);
          if (carry > 0) bag[id] = { v: [], ts: {}, extra: carry, gifted: bag[id].gifted || 0 };
          else delete bag[id];          // nothing owed — don't keep the record
        }
        return true;
      }, null).catch(() => {})
    )
  );
}

export async function wipeFans(aid) {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      store().set(shardKey(aid, n), '{}').catch(() => {})
    )
  );
}

/* ---------- meta (tips / payment markers) ---------- */
export const emptyMeta = () => ({ tips: [], paid: {}, gifts: [] });
export async function readMeta(aid) {
  const { data } = await readDoc(KEY.meta(aid), null);
  const m = data || emptyMeta();
  m.tips ||= []; m.paid ||= {}; m.gifts ||= [];
  return m;
}
export const mutateMeta = (aid, fn) =>
  casDoc(KEY.meta(aid), emptyMeta, (m) => { m.tips ||= []; m.paid ||= {}; m.gifts ||= []; return fn(m); });

/* ---------- derived ---------- */
/** Does this device vote without limit? Either the whole room is unlimited, or
 *  this specific device was granted it from the Studio (the artist's own phone,
 *  so he can test without eating the audience's credits). */
export const isUnlimited = (fanId, show) =>
  !!show.unlimited || (show.unlimitedFans || []).includes(fanId);

/** A vote on an already-played song costs more (a "play it again" request). */
export const costOf = (songId, show) =>
  show.played.includes(songId) ? (show.replayCost || 5) : 1;
/** Credits a fan has spent, counting replay votes at their higher cost.
 *  `spent` is everything that isn't a vote on a listed song — a song request, a
 *  birthday shout — because those have no song id to count. It resets with the
 *  free credits, i.e. every time a new song starts. */
export const creditsUsed = (fan, show) =>
  (fan.v || []).reduce((sum, id) => sum + costOf(id, show), 0) + (fan.spent || 0);

/* ---------- who was in the room ----------
   The honest count of people at a gig is not "devices that voted" — plenty of
   people join, watch the queue move and never tap. So a device stamps itself
   once per show when it opens the voting page.

   HEADLINE = distinct PHONES, not distinct networks. Counting networks was the
   first attempt and it is wrong in exactly the room this app is for: forty
   people at a beach bar on the venue's wifi come out as 1. A phone is much
   closer to a person than a network is — the worst it does is count someone
   twice if they clear their storage mid-gig.

   The network hash is kept alongside it, because it is the only defence against
   one phone rotating its id to inflate the number, and because "40 phones on 3
   networks" is a useful thing for an artist to be able to see.

   The address itself is never stored. It is hashed with the artist id mixed in,
   so the stored value is useless anywhere else and a table built for one
   artist's gigs tells you nothing about another's. */
export const clientIp = (req) =>
  req.headers.get('x-nf-client-connection-ip') ||
  (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
  req.headers.get('client-ip') || '';

export const roomHash = (aid, ip) =>
  ip ? sha(`myset-room|${aid}|${ip}`).slice(0, 16) : '';

export function roomCounts(fans) {
  const nets = new Set();
  let phones = 0;
  for (const f of Object.values(fans || {})) {
    if (!f) continue;
    // present = it stamped itself on the voting page, or it clearly took part
    // (records from before presence existed still count as the person they were)
    const here = !!f.seenShow || (f.v || []).length > 0 || f.extra > 0 || f.spent > 0;
    if (!here) continue;
    phones++;
    if (f.ipH) nets.add(f.ipH);
  }
  return { phones, nets: nets.size };
}
export const uniqueRoom = (fans) => roomCounts(fans).phones;

/** One write per device per show. Called only from the voting page, only while a
 *  show is live, and skipped entirely once the stamp is already there. */
export async function markPresence(aid, fanId, show, req) {
  if (!fanId || !show || show.status !== 'live') return;
  const ipH = roomHash(aid, clientIp(req));
  try {
    await mutateFan(aid, fanId, (me) => {
      if (me.seenShow === show.showId && me.ipH === ipH) return false;   // already counted
      me.ipH = ipH; me.seenShow = show.showId;
      return true;
    });
  } catch { /* a missed head-count must never break the voting page */ }
}

/** Earliest moment each song received a vote — used to break ties fairly. */
export function firstVotedAt(fans) {
  const first = {};
  for (const id of Object.keys(fans)) {
    const ts = fans[id].ts || {};
    for (const s of fans[id].v || []) {
      const t = Number(ts[s]) || Number.MAX_SAFE_INTEGER;   // unstamped (legacy) sorts last
      if (first[s] === undefined || t < first[s]) first[s] = t;
    }
  }
  return first;
}

/** THE ordering rule for "what plays next". Used by show, stage and playTop so
 *  the audience can never be shown a winner the Studio won't start. */
export function rankSongs(list, counts, first) {
  const F = (id) => first[id] || Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) =>
    (counts[b.id] || 0) - (counts[a.id] || 0) ||
    F(a.id) - F(b.id) ||
    a.title.localeCompare(b.title));
}

export function voteCounts(fans) {
  const counts = {};
  for (const id of Object.keys(fans))
    for (const s of fans[id].v || []) counts[s] = (counts[s] || 0) + 1;
  return counts;
}

/* ---------- http ---------- */
export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
export const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

export const sha = (v) => createHash('sha256').update(String(v)).digest('hex');
const sameHash = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};

/* Two ways in, both fail closed (INVARIANT 15c):
     ADMIN_CODE env  — the recovery key, only Perry and Netlify know it
     show.codeHash   — a code he set himself from the Studio, stored hashed
   The second exists because on 2026-08-30 he could not get into his own Studio
   during a gig: the only code lived in an env var he had no copy of. */
/** Who is making this request, and which artist do they own?
 *  Returns { aid, email, role } or null. Every admin endpoint uses this — an
 *  artist can only ever reach their own records because the id comes from the
 *  session, never from the request body. */
export async function requireArtist(req) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Bearer ')) {
    const { verifyToken } = await import('./_auth.mjs');
    const me = await verifyToken(auth.slice(7));
    if (me) return { aid: me.artistId, email: me.email, role: me.role || 'owner' };
  }

  // The studio code predates accounts and belongs to the founding artist.
  // Everyone else signs in with email.
  const url = new URL(req.url);
  const given = req.headers.get('x-admin-code') || url.searchParams.get('code') || '';
  if (!given) return null;
  const master = process.env.ADMIN_CODE;
  if (master && sameHash(sha(given), sha(master)))
    return { aid: DEFAULT_ARTIST, email: null, role: 'owner' };
  const show = await getShow(DEFAULT_ARTIST);
  if (show.codeHash && sameHash(sha(given), show.codeHash))
    return { aid: DEFAULT_ARTIST, email: null, role: 'owner' };
  return null;
}

/** Which artist is a PUBLIC request about? From ?a=<slug>. */
export async function publicArtist(req) {
  const slug = new URL(req.url).searchParams.get('a') || '';
  if (!slug) return DEFAULT_ARTIST;          // bare myset.vip still means Perry
  const { artistBySlug } = await import('./_auth.mjs');
  return await artistBySlug(slug);
}
export const cleanFanId = (v) =>
  typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
