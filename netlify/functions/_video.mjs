import { store, readDoc, casDoc, own, roomHash, clientIp } from './_lib.mjs';
import { r2Enabled, r2Put, r2Head, r2Get, r2Delete, r2PresignGet } from './_r2.mjs';

/* SHORT CLIPS ON A COMMUNITY POST — thirty seconds of the room, from a phone.

   Perry: "can we include the option to add videos to posts in the communities?
   even if they have to be compressed and limited to a certain length or size."

   WHY A CLIP IS UPLOADED ON ITS OWN, BEFORE THE POST. A Netlify function's
   request body tops out around 6MB, and base64 adds a third. A post may already
   carry three 900KB photos — 3.6MB once encoded — so a video in the SAME body
   could only ever be about 800KB, which is four seconds of anything watchable.
   So the clip goes up first, by itself, and the post that follows names it.
   That also means the slow part (a 30-second re-encode on the phone, then a
   3MB upload on bar wifi) finishes before the person writes a word, instead of
   holding their words hostage.

   WHAT THAT COSTS, AND THE ONE HONEST WARNING. Video is the only thing in MySet
   that can move the Netlify bill on its own. A 3MB clip watched 100,000 times is
   300GB of egress — about 6,000 credits, ~$40. Three things keep it small:
     · the phone re-encodes to 480p before anything leaves it (community.html)
     · the server refuses anything over MAX_VIDEO_BYTES, by BYTES, not by trust
     · every clip has a poster frame, so the feed renders with preload="none"
       and a clip is only ever fetched when somebody actually taps play
   The report in docs/reports/ has the arithmetic.

   RANGE REQUESTS ARE NOT OPTIONAL. iOS Safari will not play a video from a URL
   that does not answer `Range` with a 206 — it makes a byte-range request and
   gives up on a 200. The whole file is already in memory by then, so this is a
   slice; getting it wrong is a black box on every iPhone in the room, which is
   most of them.

   ORPHANS. A clip whose post is never written would sit in the store for ever, and
   `list()` is banned (INVARIANT 1), so nothing could ever find it. `vidpend_<owner>`
   is an append-only note of clips uploaded but not yet attached; addPost removes
   the entry, and the cron drops anything older than PENDING_TTL. */

/* 50MB, AND WHY IT MOVED FROM 3.

   3MB was the size a whole clip had to fit into because it travelled as base64
   inside a JSON body, and a Netlify function body tops out around 6MB. That
   forced the phone to shrink every clip by re-filming it onto a canvas — which
   is the reason clips arrived silent three releases running: a canvas has no
   sound, so the audio had to be found and mixed back separately, and on Safari
   that kept failing. Perry called it: upload the file as it is.

   Two changes make 25MB fit. The bytes go up RAW instead of base64, which alone
   removes the 33% inflation; and they go up in pieces (CHUNK_BYTES) so no single
   request approaches the body limit. Nothing on the phone touches the video, so
   the sound is simply never at risk.

   WHY 50 AND NOT 25. Measured on the real file Perry could not upload: an iPhone
   shooting 1080p HEVC put 2.3MB into every second, so 25MB bought TEN SECONDS of
   it. A limit that turns a thirty-second clip into ten is a limit that makes the
   feature feel broken, and the trim screen makes the number visible while somebody
   chooses rather than after they have waited — so the honest ceiling can be higher.

   WHAT IT COSTS, because this is the expensive end of MySet. Netlify bills
   20 credits/GB of bandwidth, about $0.134/GB, and a cache HIT is billed like
   any other request — caching saves compute, never bytes. So one clip:

       50MB x   30 views = 1.46 GB = $0.20
       50MB x  100 views = 4.88 GB = $0.65
       50MB x 1000 views = 48.8 GB = $6.54

   For scale, a whole 3-hour gig with 20 phones voting costs 2.7c. One popular
   clip can cost more than two hundred gigs. If clips take off, moving the BYTES
   (not the app) to a store with no egress charge is the single biggest saving
   available anywhere in MySet — see docs/sessions/2026-09-06-clips-as-they-are.md.
   That move is what makes a bigger number here free rather than expensive.

   THE MOVE HAPPENED, 2026-09-11. The bytes go to Cloudflare R2 (`_r2.mjs`), which
   charges nothing to send them out, and `/api/vid` hands the phone a signed link
   rather than the bytes. The table above is what a clip costs while R2 is off —
   the four `R2_*` variables missing, or R2 refusing an upload — and for every
   clip uploaded before the move, which stays in Blobs until it leaves. */
export const MAX_VIDEO_BYTES = 75 * 1024 * 1024;
/* Comfortably under Netlify's ~6MB request body, with room for headers. */
export const CHUNK_BYTES = 4 * 1024 * 1024;
export const MAX_SECONDS = 30;
export const PENDING_TTL = 2 * 3600e3;            // an unattached clip lives 2 hours
export const PEND = (owner) => `vidpend_${owner}`;
/* WHICH OWNERS HAVE SOMETHING TO SWEEP. `list()` is banned (INVARIANT 1), so the
   cron cannot go looking; it has to be told. Same shape and same reason as
   `delqueue` in _account.mjs — a small global the cron drains one owner a ring,
   never read by the audience poll. */
export const VIDQ = 'vidqueue';
/* The one spelling of a clip's key, in both stores. `_account.mjs` and
   `_venueaccount.mjs` build their delete lists with it. */
export const vidKey = (owner, clip) => `vid_${owner}_${clip}`;
const KEY = vidKey;
const VID_KEY = /^vid_(.+)_(k[a-z0-9]{10})$/;
/* THE PIECES OF AN UPLOAD IN FLIGHT, keyed by the CLIP id rather than by an
   upload id of their own. That is the whole trick: the clip id is minted and
   noted as pending before the first byte arrives, so an abandoned upload is
   already something the existing sweep knows about and nothing new has to be
   remembered or enumerated. `list()` stays banned. */
const CHUNK = (owner, clip, i) => `vidchunk_${owner}_${clip}_${i}`;
const UPKEY = (owner, clip) => `vidup_${owner}_${clip}`;

/* A clip id, and the poster's image slot are derived from it: `k<10>` is a slot
   name /api/img already serves (isSlot in _img.mjs), so the poster needs no new
   endpoint and gets the same year-long immutable cache every photo gets. */
export const CLIP_ID = /^k[a-z0-9]{10}$/;
export const newClipId = () =>
  'k' + Math.random().toString(36).slice(2, 12).padEnd(10, '0').slice(0, 10);

const TYPES = { 'video/mp4': 'mp4', 'video/quicktime': 'mp4', 'video/webm': 'webm' };

/** Reads the duration out of an MP4's `mvhd` box. Returns seconds, or null.
 *
 *  Best-effort ON PURPOSE. It walks only the top-level boxes to find `moov`,
 *  then `mvhd` inside it — no recursion, no allocation, and it gives up rather
 *  than guessing on anything it does not recognise (a fragmented MP4, a WebM).
 *  The load-bearing limit is MAX_VIDEO_BYTES, which is bytes and cannot be
 *  argued with; this is the second belt, so a 30-second cap is not a claim that
 *  only the phone enforces (INVARIANT 15k). */
export function mp4Seconds(buf) {
  try {
    let p = 0;
    while (p + 8 <= buf.length) {
      const size = buf.readUInt32BE(p);
      const type = buf.toString('latin1', p + 4, p + 8);
      if (size < 8) return null;
      if (type === 'moov') {
        let q = p + 8;
        const end = Math.min(p + size, buf.length);
        while (q + 8 <= end) {
          const s2 = buf.readUInt32BE(q);
          const t2 = buf.toString('latin1', q + 4, q + 8);
          if (s2 < 8) return null;
          if (t2 === 'mvhd') {
            const ver = buf[q + 8];
            if (ver === 0) {
              const scale = buf.readUInt32BE(q + 20), dur = buf.readUInt32BE(q + 24);
              return scale ? dur / scale : null;
            }
            if (ver === 1) {
              const scale = buf.readUInt32BE(q + 28);
              const dur = Number(buf.readBigUInt64BE(q + 32));
              return scale ? dur / scale : null;
            }
            return null;
          }
          q += s2;
        }
        return null;
      }
      p += size;
    }
  } catch { return null; }
  return null;
}

/** Everything that must be true of a clip's BYTES, returned as { bytes, type,
 *  seconds } or an { error }. The chunked upload is the only path in since the
 *  data-URL `clip` action went (decision 0189). Every message is shown to a person
 *  as-is, so every message says what to do about it. */
export function checkVideo(bytes) {
  if (!bytes || !bytes.length) return { error: 'That clip came through empty.' };
  if (bytes.length > MAX_VIDEO_BYTES)
    return { error: `That clip is ${(bytes.length / 1048576).toFixed(1)}MB and the limit is ${MAX_VIDEO_BYTES / 1048576}MB. Trim it shorter and try again.` };
  /* Trust the bytes, not the label. An MP4 has `ftyp` at offset 4; a WebM
     (Matroska) starts with the EBML magic. */
  const isMp4 = bytes.length > 12 && bytes.toString('latin1', 4, 8) === 'ftyp';
  const isWebm = bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45
    && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!isMp4 && !isWebm) return { error: 'That file isn’t really a video.' };
  const seconds = isMp4 ? mp4Seconds(bytes) : null;
  if (seconds !== null && seconds > MAX_SECONDS + 1.5)
    return { error: `Clips are up to ${MAX_SECONDS} seconds. That one is ${Math.round(seconds)}.` };
  return { bytes, type: isMp4 ? 'video/mp4' : 'video/webm', seconds };
}

/* A NETWORK MAY START SO MANY UPLOADS (decision 0189). `begin` is the only door a clip
   comes in by, and the device id it carries is the client's to choose, so the per-phone
   three-a-day is no ceiling on a script. One token bucket per network, in one small
   document per owner, in the shape `payAllowed` uses (0111): CLIP_NET_BURST in a row,
   then CLIP_NET_PER_HOUR. A real room films a handful of clips a night, and a bar's
   wifi is one address for every phone on it, so the burst covers the whole room
   filming the encore at once. A script on one network can hold at most
   15 + 6 × 2 = 27 of the 40 pending slots in the two hours a clip waits for its
   post, which leaves the rest for everyone else. A refused begin writes nothing; a
   limiter that cannot be written never refuses an upload (five tries, then let go). */
export const CLIP_NET_BURST = 15, CLIP_NET_PER_HOUR = 6;
const CLIPLIM = (owner) => `cliplim_${owner}`;
const MAX_CLIP_BUCKETS = 400;
export async function clipBeginAllowed(owner, req, now = Date.now()) {
  const net = roomHash(owner, clientIp(req));
  if (!net) return true;
  let allowed = true;
  try {
    await casDoc(CLIPLIM(owner), () => ({ v: 1, b: {} }), (d) => {
      d.b = d.b && typeof d.b === 'object' ? d.b : {};
      const id = 'n:' + net;
      const b = own(d.b, id) || { t: CLIP_NET_BURST, at: now };
      const t = Math.min(CLIP_NET_BURST, (Number(b.t) || 0) + Math.max(0, now - (Number(b.at) || now)) / 3600e3 * CLIP_NET_PER_HOUR);
      if (t < 1) { allowed = false; return false; }
      d.b[id] = { t: t - 1, at: now };
      const ids = Object.keys(d.b);
      if (ids.length > MAX_CLIP_BUCKETS) {
        ids.sort((a, c) => (d.b[a].at || 0) - (d.b[c].at || 0));
        for (const x of ids.slice(0, ids.length - MAX_CLIP_BUCKETS)) delete d.b[x];
      }
      return true;
    }, null, 5);
  } catch { /* the limiter is not the upload */ }
  return allowed;
}

/* ---------- a clip that arrives in pieces ----------

   THREE STEPS, AND THE MIDDLE ONE REPEATS. `begin` mints the clip id and writes a
   manifest saying how many pieces to expect; each piece is POSTed raw; `end`
   reads them back in order, joins them, and only then does the file get checked
   and stored. Nothing is validated piece by piece because a video's magic bytes
   and its duration are properties of the whole file, and half an MP4 is not a
   small MP4.

   An abandoned upload costs nothing to find: the manifest says how many pieces
   there are, so dropClip can delete every one of them by computing its key. */
/* Plain text and not setJSON/`type:'json'`: the manifest is a handful of numbers,
   and set/get are the two calls every blob backing — including the test fake —
   is guaranteed to have. */
export async function beginUpload(owner, clip, { size, parts, type }) {
  await store().set(UPKEY(owner, clip), JSON.stringify({ size, parts, type, at: Date.now() }));
}
export async function readUpload(owner, clip) {
  try {
    const raw = await store().get(UPKEY(owner, clip), { type: 'text' });
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export async function putChunk(owner, clip, i, bytes) {
  await store().set(CHUNK(owner, clip, i), bytes);
}
/** All the pieces, in order, as one buffer — or null if any of them never came. */
export async function joinChunks(owner, clip, parts) {
  const got = await Promise.all(Array.from({ length: parts }, (_, i) =>
    store().get(CHUNK(owner, clip, i), { type: 'arrayBuffer' }).catch(() => null)));
  if (got.some((g) => !g)) return null;
  return Buffer.concat(got.map((g) => Buffer.from(g)));
}
export async function dropUpload(owner, clip, parts) {
  for (let i = 0; i < parts; i++) {
    try { await store().delete(CHUNK(owner, clip, i)); } catch { /* already gone */ }
  }
  try { await store().delete(UPKEY(owner, clip)); } catch { /* already gone */ }
}

/* WHERE THE BYTES LIVE (2026-09-11). A clip's bytes go to Cloudflare R2 when the
   four `R2_*` variables are set, and to Blobs when they are not or when R2 refuses.
   Everything ELSE about a clip — its id, the poster, the pending list, the post
   that names it — is unchanged and stays in Blobs. The same key is used in both
   stores, so a clip is found by computing its key and asking, never by listing.

   READ R2 FIRST, THEN BLOBS. Clips uploaded before this change are in Blobs and
   stay there; they keep serving exactly as before. Nothing is copied in bulk
   (`list()` is banned, INVARIANT 1, and a copy that half-fails is worse than none)
   — see docs/sessions/2026-09-11-clips-to-r2.md for the migration note.

   AND EVERY R2 FAILURE DEGRADES. An upload that R2 refuses lands in Blobs, which
   is where it would have gone anyway; a serve that cannot reach R2 tries Blobs;
   nothing on this path can stop the room voting. The failure is logged (0fb) so it
   is not silent, and the log never carries a key or a signed URL. */
/* Once a minute per instance per kind of failure. During an outage every
   uncached /api/vid would otherwise add a CAS write on the hourly error document
   to a path that is already waiting on a timed-out HEAD; the first row says what
   is wrong, the next hundred say it again. */
const quiet = new Map();
const logR2 = async (where, e) => {
  const now = Date.now();
  const next = quiet.get(where) || 0;
  console.error(`[${where}]`, (e && e.message) || e);
  if (now < next) return;
  quiet.set(where, now + 60e3);
  try { const { logErr } = await import('./_errlog.mjs'); await logErr(where, e); } catch { /* console line already went */ }
};

export async function putClip(owner, clip, bytes, type) {
  if (r2Enabled()) {
    try { await r2Put(KEY(owner, clip), bytes, type); return 'r2'; }
    catch (e) { await logR2('r2.put', e); }
  }
  await store().set(KEY(owner, clip), bytes, { metadata: { type, n: bytes.length } });
  return 'blobs';
}

/**
 * `strong` only where it is actually needed.
 *
 * A clip id is minted once and never reused, and the bytes behind it never change —
 * so SERVING one has nothing to be consistent about, and a strong read is a slower
 * trip for no benefit on the one path a person is sitting and waiting on. The
 * existence check that runs seconds after an upload is `hasClip` below, which asks
 * Blobs for strong; `strong` here is kept for a caller that wants the bytes that
 * fresh (none in production today). R2 is strongly consistent on its own. `r2:false`
 * skips R2 altogether — for the caller that has just asked it (`/api/vid`) and must
 * not wait on it twice. In production the R2 half of this function has no caller
 * either: `/api/vid` redirects rather than reading; the suite reads back through it.
 */
export async function getClip(owner, clip, { strong = false, r2 = true } = {}) {
  if (r2 && r2Enabled()) {
    try { const got = await r2Get(KEY(owner, clip)); if (got) return got; }
    catch (e) { await logR2('r2.get', e); }
  }
  try {
    const r = await store().getWithMetadata(KEY(owner, clip),
      { type: 'arrayBuffer', ...(strong ? { consistency: 'strong' } : {}) });
    if (!r || !r.data) return null;
    return { bytes: Buffer.from(r.data), type: (r.metadata && r.metadata.type) || 'video/mp4' };
  } catch { return null; }
}

/** Does the clip exist, wherever it is. What addPost asks before it will let a
    post name a clip (INVARIANT 0dq) — one HEAD rather than 75MB pulled through
    the function to answer yes. */
export async function hasClip(owner, clip) {
  if (r2Enabled()) {
    try { if (await r2Head(KEY(owner, clip))) return true; }
    catch (e) { await logR2('r2.head', e); }
  }
  try {
    const r = await store().getWithMetadata(KEY(owner, clip), { type: 'arrayBuffer', consistency: 'strong' });
    return !!(r && r.data);
  } catch { return false; }
}

/** A signed, short-lived URL for the clip's bytes on R2 — or null, which means
    "serve it from Blobs the old way" (the clip predates R2, or R2 could not be
    asked). `/api/vid` answers this with a 302. Never log the result: it is a key. */
export async function clipUrl(owner, clip, now = Date.now()) {
  if (!r2Enabled()) return null;
  try { return (await r2Head(KEY(owner, clip))) ? r2PresignGet(KEY(owner, clip), now) : null; }
  catch (e) { await logR2('r2.head', e); return null; }
}

/** One `vid_` key's bytes, deleted from R2. Blobs deletion is the caller's (the
    purge's walk, `eraseKeys` in _account.mjs); this is the other half, so leaving
    MySet takes the clip bytes with it wherever they are. THROWS when R2 refuses
    (decision 0173): the walk then stops before it deletes the post or the pending
    list that names the clip, and the next ring tries again — a refusal parked on a
    pending list the same walk was about to delete would be forgotten. Any other
    key, or R2 off, is a no-op that answers false. */
export async function dropClipKey(k) {
  if (!r2Enabled() || !VID_KEY.test(String(k))) return false;
  try { await r2Delete(k); return true; }
  catch (e) { await logR2('r2.delete', e); throw e; }
}

/** Returns false if the R2 half could not be done. A DELETE R2 refuses is not
    forgotten: the clip goes back on the pending list, so the two-hour sweep — which
    reads the feed first and finds no post naming it — tries again. Without that a
    hide during an outage would leave 75MB on R2 that nothing could ever find
    (`list()` is banned, INVARIANT 1). `renote: false` is for the one caller that IS
    the pending list trimming itself: noting the clip again there would trim the next
    one, and so on round the list for as long as R2 refuses. */
export async function dropClip(owner, clip, { renote = true } = {}) {
  let done = true;
  if (r2Enabled()) {
    try { await r2Delete(KEY(owner, clip)); }
    catch (e) { done = false; await logR2('r2.delete', e); if (renote) await notePending(owner, clip); }
  }
  try { await store().delete(KEY(owner, clip)); } catch { /* already gone */ }
  try { const { dropImage } = await import('./_img.mjs'); await dropImage(owner, clip); } catch { /* no poster */ }
  /* AND ANY PIECES THAT NEVER BECAME A CLIP. An upload abandoned halfway leaves
     chunks behind; the manifest says how many, so every key can be computed and
     none of them needs `list()` to be found. Reading it costs one get, and only on
     the two rare paths that delete a clip at all. */
  try {
    const up = await readUpload(owner, clip);
    if (up && up.parts > 0) await dropUpload(owner, clip, up.parts);
  } catch { /* nothing in flight */ }
  return done;
}

/* ---------- the pending list, so nothing can be orphaned ---------- */
const emptyPend = () => ({ v: 1, by: {} });

export async function readPending(owner) {
  const { data } = await readDoc(PEND(owner), null);
  const d = { ...emptyPend(), ...(data || {}) };
  d.by = d.by && typeof d.by === 'object' ? d.by : {};
  return d;
}
export async function notePending(owner, clip) {
  await casDoc(VIDQ, () => ({ v: 1, by: {} }), (d) => {
    d.by ||= {};
    d.by[owner] = Date.now();
    return true;
  }).catch(() => {});
  let trimmed = [];
  const r = await casDoc(PEND(owner), emptyPend, (d) => {
    trimmed = [];
    d.by ||= {};
    d.by[clip] = Date.now();
    /* Bounded, so a burst of uploads cannot grow one document without end. The
       oldest go first, and they are exactly the ones the sweep would drop next. */
    const ids = Object.keys(d.by);
    if (ids.length > 60) {
      ids.sort((a, b) => (a === clip) - (b === clip) || d.by[a] - d.by[b]);
      for (const id of ids.slice(0, ids.length - 60)) { delete d.by[id]; trimmed.push(id); }
    }
    return true;
  }).catch(() => {});
  /* A TRIMMED ENTRY TAKES ITS CLIP WITH IT (decision 0189). Off the list, nothing
     could ever find the clip again (`list()` is banned, INVARIANT 1), so it is
     dropped now — by its computed keys — unless a post names it: clearPending is
     best-effort, so a posted clip can still be sitting here. A feed that cannot be
     read drops nothing; an orphan is better than a video taken off a real post. */
  if (r && r.ok && trimmed.length) {
    let claimed = null;
    try {
      const { readPosts } = await import('./_community.mjs');
      claimed = new Set((await readPosts(owner)).list.map((p) => p && p.clip).filter(Boolean));
    } catch { claimed = null; }
    if (claimed) for (const id of trimmed) if (CLIP_ID.test(id) && !claimed.has(id)) await dropClip(owner, id, { renote: false });
  }
  return r;
}

export const clearPending = (owner, clip) =>
  casDoc(PEND(owner), emptyPend, (d) => {
    if (!d.by || !d.by[clip]) return false;
    delete d.by[clip];
    return true;
  }).catch(() => {});

/** Delete clips uploaded but never posted. Called from the cron, one owner a ring.
 *
 *  THE FEED IS CHECKED BEFORE ANYTHING IS DELETED. `clearPending` is best-effort
 *  by design — it runs after the post is already written, so a lost write leaves a
 *  POSTED clip sitting in the pending list. Deleting on the timestamp alone would
 *  then take a video off a real post two hours after somebody put it there. One
 *  read of the feed, only when something is actually due, and only the clips no
 *  post claims are dropped. */
/** Drain the queue: one owner per ring, oldest first. Called from autocron. */
export async function sweepQueue(now = Date.now(), limit = 1) {
  const { data } = await readDoc(VIDQ, null);
  const rows = Object.entries((data && data.by) || {})
    .sort((a, b) => a[1] - b[1]).slice(0, limit);
  let gone = 0;
  for (const [owner] of rows) {
    try { gone += await sweepPending(owner, now); } catch (e) { console.error('vid sweep', owner, e && e.message); }
    /* Off the queue once nothing is pending; to the BACK of it otherwise. A clip
       that is not yet due, or one whose R2 delete was refused and re-noted, gets
       another visit next time round without waiting for a fresh upload from the
       same owner — and a stuck row still cannot hold the queue, because it moves. */
    let left = 0;
    try { left = Object.keys((await readPending(owner)).by).length; } catch { left = 0; }
    await casDoc(VIDQ, () => ({ v: 1, by: {} }), (d) => {
      d.by ||= {};
      if (!left) { if (!d.by[owner]) return false; delete d.by[owner]; return true; }
      d.by[owner] = now; return true;
    }).catch(() => {});
  }
  return { swept: rows.length, deleted: gone };
}

export async function sweepPending(owner, now = Date.now()) {
  const d = await readPending(owner);
  const due = Object.entries(d.by).filter(([, at]) => now - Number(at) > PENDING_TTL).map(([k]) => k);
  if (!due.length) return 0;
  const { readPosts } = await import('./_community.mjs');
  const claimed = new Set((await readPosts(owner)).list.map((p) => p && p.clip).filter(Boolean));
  let gone = 0;
  for (const clip of due) {
    if (!claimed.has(clip)) {
      /* A drop R2 refused has just re-noted the clip with a fresh timestamp; leave
         that note alone so the next ring tries again. */
      if (!(await dropClip(owner, clip))) continue;
      gone++;
    }
    await clearPending(owner, clip);
  }
  return gone;
}
