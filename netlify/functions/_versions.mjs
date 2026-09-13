import { store, casDoc } from './_lib.mjs';
import { appendLog, readLog, logKeys } from './_append.mjs';

/* A VERSION BEFORE EVERY OVERWRITE, FOR THE DOCUMENTS AN ARTIST WRITES BY HAND.

   Every document in this store was overwritten in place: a profile saved wrong, a
   setlist emptied, a song deleted from the library — the old bytes were gone the
   moment the write landed, and the only history was the laptop backup. Decision
   0067: the profile, the setlists, the calendar and the library keep what they
   were. The bytes go to `ver_<key>_<ts>`, written once and never touched; the
   timestamps go to the append-only log `vers_<key>` (computable, never trimmed —
   _append.mjs), which is what lets export and delete find every version.

   Only documents a PERSON edits, never the ones the room writes. The show record is
   versioned only when its library changed (admin.mjs measures that); a play, a
   vote or a poll never makes a version, so nothing here is on a hot path.

   A burst of taps keeps the state BEFORE the burst. Building a setlist is fifty
   writes in a minute, and fifty versions a few bytes apart would be noise nobody
   restores to. VER_GAP_MS apart at most; the version kept is the one from before
   the first tap, which is the one a person wants back. */

/* Overridable so the suite can prove the library door without waiting thirty seconds. */
export const VER_GAP_MS = () => Math.max(0, Number(process.env.MYSET_VER_GAP_MS ?? 30e3));
export const verKey = (key, ts) => `ver_${key}_${ts}`;
export const versKey = (key) => `vers_${key}`;

/** Keep `before` (the JSON text of the document as it was) as a version of `key`.
 *  Returns the version's timestamp, or null when nothing was kept. Never throws. */
export async function keepVersion(key, before, now = Date.now()) {
  try {
    if (!before || typeof before !== 'string') return null;
    const idx = await readLog(versKey(key));
    const last = idx.list.length ? Number(idx.list[idx.list.length - 1]) || 0 : 0;
    if (now - last < VER_GAP_MS()) return null;
    const ts = Math.max(now, last + 1);
    const w = await store().set(verKey(key, ts), before, { onlyIfNew: true });
    if (w && w.modified === false) return null;
    await appendLog(versKey(key), [ts]);
    return ts;
  } catch { return null; }
}

/** casDoc, keeping a version of what the document was whenever `fn` changed it.
 *  `fallback()` is what a missing document reads as — a version of THAT is never
 *  kept, because it was never written. */
export async function casKeep(key, fallback, fn, verify = null) {
  const blank = JSON.stringify(fallback());
  let before = null;
  const r = await casDoc(key, fallback, (d) => { before = JSON.stringify(d); return fn(d); }, verify);
  if (r && r.ok && before && before !== blank && before !== JSON.stringify(r.data)) await keepVersion(key, before);
  return r;
}

/** The versions of one key, newest first: [{ts}] — the bytes are read one at a time. */
export async function listVersions(key) {
  const idx = await readLog(versKey(key));
  return idx.list.map((ts) => ({ ts: Number(ts) })).filter((v) => v.ts).reverse();
}

/** Every key the versions of `key` occupy — for export and delete. */
export async function versionKeys(key) {
  const idx = await readLog(versKey(key));
  return [...(await logKeys(versKey(key))), ...idx.list.map((ts) => verKey(key, ts))];
}
