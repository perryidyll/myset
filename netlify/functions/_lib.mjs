import { getStore } from '@netlify/blobs';

export const store = () => getStore('myset');

/* ---------- Perry's default set ---------- */
export const DEFAULT_SONGS = [
  'The Joker','Jack & Diane','Faith','Crazy Little Thing Called Love','Shape Of You',
  'Amie','Hey Jude','Vienna','Best Part','Peaceful Easy Feeling / Brown Eyed Girl',
  'Chicken Fried','Wagon Wheel','Margaritaville','Bar Song (Tipsy)','What I Got',
  'Santeria','This Love','Sunday Morning','Better Together / Banana Pancakes',
  'Yours / Hey Soul Sister','Drops Of Jupiter','Perfect','All Of Me','I Found You',
  'Circles','Wish You Were Here','Sitting On The Dock Of The Bay','Feel It Still',
  "Ain't No Rest For The Wicked",'Come Together','Sweet Home Alabama',
];

export const slug = (t) =>
  t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function defaultShow() {
  return {
    artist: 'Perry Idyll',
    venue: '',
    status: 'live',              // pre | live | ended
    windowOpen: true,
    nowPlaying: null,
    played: [],
    freeCredits: 3,
    songs: DEFAULT_SONGS.map((t) => ({ id: slug(t), title: t, active: true })),
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
      const me = (bag[fanId] ||= { v: [], extra: 0 });
      me.v ||= []; me.extra ||= 0;
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
        for (const id of Object.keys(bag)) bag[id].v = [];
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
  const expected = process.env.ADMIN_CODE || 'letmein';
  const url = new URL(req.url);
  const given = req.headers.get('x-admin-code') || url.searchParams.get('code') || '';
  return !!given && given === expected;
}
export const cleanFanId = (v) =>
  typeof v === 'string' ? v.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) : '';
