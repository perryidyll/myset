import { getStore } from '@netlify/blobs';

export const store = () => getStore('myset');

/* ---------- Perry's default set ---------- */
export const DEFAULT_SONGS = [
  // [title, artist]  — artists are best guesses; edit any of them in the Studio
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
  ['I Found You','Andy Grammer'],
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
  ['Like The Tides','Perry Idyll'],
  ['All Or Nothing','Perry Idyll'],
  ['Dissolve','Perry Idyll'],
  ['Lost In Love','Perry Idyll'],
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

export const slug = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function defaultShow() {
  return {
    artist: 'Perry Idyll',
    venue: 'The Ugly Duckling Irish Pub',
    city: 'Koh Phangan, Thailand',
    showTime: '8:00 PM',
    status: 'live',              // pre | live | ended
    windowOpen: true,
    nowPlaying: null,
    played: [],
    freeCredits: 3,
    replayCost: 5,
    songs: DEFAULT_SONGS.map(([t, a]) => ({ id: slug(t), title: t, artist: a, active: true })),
    updatedAt: Date.now(),
  };
}

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
export const SHARDS = 12;
const shardKey = (n) => `f${n}`;
export function shardOf(fanId) {
  let h = 5381;
  for (let i = 0; i < fanId.length; i++) h = ((h * 33) ^ fanId.charCodeAt(i)) >>> 0;
  return h % SHARDS;
}

async function readDoc(key, fallback) {
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
async function casDoc(key, fallback, fn, verify = null, tries = 40) {
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
  if (!Array.isArray(show.songs) || !show.songs.length) show.songs = d.songs;
  if (!Array.isArray(show.played)) show.played = [];
  if (typeof show.freeCredits !== 'number') show.freeCredits = 3;
  if (typeof show.replayCost !== 'number') show.replayCost = 5;
  return show;
}
export async function getShow() {
  const { data } = await readDoc('show', null);
  return normShow(data);
}
export const mutateShow = (fn) =>
  casDoc('show', defaultShow, (s) => {
    const show = normShow(s);
    Object.keys(s || {}).forEach((k) => delete s[k]);
    Object.assign(s, show);
    const r = fn(s);
    if (r !== false) s.updatedAt = Date.now();
    return r;
  });

/* ---------- fan shards ---------- */
export const mutateFan = (fanId, fn, verifyFan = null) =>
  casDoc(
    shardKey(shardOf(fanId)),
    () => ({}),
    (bag) => {
      const me = (bag[fanId] ||= { v: [], extra: 0, ts: {} });
      me.v ||= []; me.extra ||= 0; me.ts ||= {};
      return fn(me, bag);
    },
    verifyFan ? (bag) => verifyFan((bag && bag[fanId]) || { v: [], extra: 0 }) : null
  );

/** All fan records, merged from every shard (parallel strong reads). */
export async function readFans() {
  const parts = await Promise.all(
    Array.from({ length: SHARDS }, (_, n) => readDoc(shardKey(n), {}))
  );
  const fans = {};
  for (const p of parts) Object.assign(fans, p.data || {});
  return fans;
}
export async function clearAllFanVotes() {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      casDoc(shardKey(n), () => ({}), (bag) => {
        for (const id of Object.keys(bag)) { bag[id].v = []; bag[id].ts = {}; }  // drop stale stamps too
        return true;
      }, null).catch(() => {})
    )
  );
}
export async function wipeFans() {
  await Promise.all(
    Array.from({ length: SHARDS }, (_, n) =>
      store().set(shardKey(n), '{}').catch(() => {})
    )
  );
}

/* ---------- meta (tips / payment markers) ---------- */
export const emptyMeta = () => ({ tips: [], paid: {} });
export async function readMeta() {
  const { data } = await readDoc('meta', null);
  const m = data || emptyMeta();
  m.tips ||= []; m.paid ||= {};
  return m;
}
export const mutateMeta = (fn) =>
  casDoc('meta', emptyMeta, (m) => { m.tips ||= []; m.paid ||= {}; return fn(m); });

/* ---------- derived ---------- */
/** A vote on an already-played song costs more (a "play it again" request). */
export const costOf = (songId, show) =>
  show.played.includes(songId) ? (show.replayCost || 5) : 1;
/** Credits a fan has spent, counting replay votes at their higher cost. */
export const creditsUsed = (fan, show) =>
  (fan.v || []).reduce((sum, id) => sum + costOf(id, show), 0);

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

export function checkAdmin(req) {
  const expected = process.env.ADMIN_CODE;
  if (!expected) return false;          // fail closed — never fall back to a known default
  const url = new URL(req.url);
  const given = req.headers.get('x-admin-code') || url.searchParams.get('code') || '';
  return !!given && given === expected;
}
export const cleanFanId = (v) =>
  typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
