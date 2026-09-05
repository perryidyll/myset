import { store, readDoc, casDoc } from './_lib.mjs';

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

   ORPHANS. A clip whose post is never written would sit in Blobs for ever, and
   `list()` is banned (INVARIANT 1), so nothing could ever find it. `vidpend_<owner>`
   is an append-only note of clips uploaded but not yet attached; addPost removes
   the entry, and the cron drops anything older than PENDING_TTL. */

export const MAX_VIDEO_BYTES = 3 * 1024 * 1024;   // 3MB — see the comment above
export const MAX_SECONDS = 30;
export const PENDING_TTL = 2 * 3600e3;            // an unattached clip lives 2 hours
export const PEND = (owner) => `vidpend_${owner}`;
/* WHICH OWNERS HAVE SOMETHING TO SWEEP. `list()` is banned (INVARIANT 1), so the
   cron cannot go looking; it has to be told. Same shape and same reason as
   `delqueue` in _account.mjs — a small global the cron drains one owner a ring,
   never read by the audience poll. */
export const VIDQ = 'vidqueue';
const KEY = (owner, clip) => `vid_${owner}_${clip}`;

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

/** Accepts a data: URL, returns { bytes, type, seconds } or an { error }.
 *  Every message here is one a person can act on, because it is shown as-is. */
export function decodeVideoDataUrl(dataUrl) {
  const m = /^data:(video\/(?:mp4|webm|quicktime));base64,([A-Za-z0-9+/=]+)$/
    .exec(String(dataUrl || '').trim());
  if (!m) return { error: 'That has to be an MP4 or WebM video.' };
  let bytes;
  try { bytes = Buffer.from(m[2], 'base64'); } catch { return { error: 'Could not read that clip.' }; }
  if (!bytes.length) return { error: 'That clip came through empty.' };
  if (bytes.length > MAX_VIDEO_BYTES)
    return { error: `That clip is too big — ${MAX_VIDEO_BYTES / 1024 / 1024}MB is the limit. Try a shorter one.` };

  /* Trust the bytes, not the label — the same rule as decodeDataUrl. An MP4 has
     `ftyp` at offset 4; a WebM (Matroska) starts with the EBML magic. */
  const isMp4 = bytes.length > 12 && bytes.toString('latin1', 4, 8) === 'ftyp';
  const isWebm = bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45
    && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!isMp4 && !isWebm) return { error: 'That file isn’t really a video.' };

  const seconds = isMp4 ? mp4Seconds(bytes) : null;
  if (seconds !== null && seconds > MAX_SECONDS + 1.5)
    return { error: `Clips are up to ${MAX_SECONDS} seconds. That one is ${Math.round(seconds)}.` };

  return { bytes, type: isMp4 ? 'video/mp4' : 'video/webm', seconds };
}

export async function putClip(owner, clip, bytes, type) {
  await store().set(KEY(owner, clip), bytes, { metadata: { type, n: bytes.length } });
}

/**
 * `strong` only where it is actually needed.
 *
 * A clip id is minted once and never reused, and the bytes behind it never change —
 * so SERVING one has nothing to be consistent about, and a strong read is a slower
 * trip for no benefit on the one path a person is sitting and waiting on. The
 * existence check inside addPost is the exception: it runs seconds after the upload
 * and has to see a write that has only just landed, so it asks for strong.
 */
export async function getClip(owner, clip, { strong = false } = {}) {
  try {
    const r = await store().getWithMetadata(KEY(owner, clip),
      { type: 'arrayBuffer', ...(strong ? { consistency: 'strong' } : {}) });
    if (!r || !r.data) return null;
    return { bytes: Buffer.from(r.data), type: (r.metadata && r.metadata.type) || 'video/mp4' };
  } catch { return null; }
}

export async function dropClip(owner, clip) {
  try { await store().delete(KEY(owner, clip)); } catch {}
  try { const { dropImage } = await import('./_img.mjs'); await dropImage(owner, clip); } catch {}
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
  return casDoc(PEND(owner), emptyPend, (d) => {
    d.by ||= {};
    d.by[clip] = Date.now();
    /* Bounded, so a burst of uploads cannot grow one document without end. The
       oldest go first, and they are exactly the ones the sweep would drop next. */
    const ids = Object.keys(d.by);
    if (ids.length > 60) {
      ids.sort((a, b) => d.by[a] - d.by[b]);
      for (const id of ids.slice(0, ids.length - 60)) delete d.by[id];
    }
    return true;
  }).catch(() => {});
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
    /* Off the queue either way. An owner with a clip that is not yet due gets put
       back the next time one is uploaded, and a clip that IS due has just been
       dealt with — so a stuck row can never hold the queue. */
    await casDoc(VIDQ, () => ({ v: 1, by: {} }), (d) => {
      if (!d.by || !d.by[owner]) return false;
      delete d.by[owner]; return true;
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
    if (!claimed.has(clip)) { await dropClip(owner, clip); gone++; }
    await clearPending(owner, clip);
  }
  return gone;
}
