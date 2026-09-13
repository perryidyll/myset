import { store, readDoc, casDoc } from './_lib.mjs';

/* AN APPEND-ONLY LOG THAT IS NEVER TRIMMED, IN COMPUTABLE KEYS.

   Every capped list in this store (`histidx_` at 400 rows, `posts_` at 200, the
   feedback notes at 200) exists so a SCREEN reads one small document. That is the
   right shape for a screen and the wrong shape for a record: past the cap the
   oldest entries fell off and were gone. Decision 0068 makes the pairing a rule —
   a capped list must have a complete sibling — and this is the sibling.

   One head document holds the newest entries plus a count of the full parts
   spilled before it. When the head reaches CHUNK entries, its first CHUNK are
   written ONCE to `<key>_p<n>` (onlyIfNew, never rewritten) and the head moves
   on. Reading is the parts in order, then the head. No `list()` (INVARIANT 1):
   the head says how many parts there are, so every key is computable, which is
   also what lets export and delete find all of it.

   The spill is safe under a race. Appends only ever push to the END, so the first
   CHUNK entries of the head are the same for every process that sees `parts === n`;
   two processes spilling at once write identical bytes to the same write-once key,
   and the second head advance aborts on the `parts` check. A part written whose
   head advance then failed is re-tried on the next append — the bytes it would
   write are the ones already there. */

export const CHUNK = () => Math.max(20, parseInt(process.env.MYSET_LOG_CHUNK, 10) || 2000);
export const partKey = (key, i) => `${key}_p${i}`;
const empty = () => ({ v: 1, parts: 0, n: 0, list: [], x: {} });
const norm = (d) => {
  d.v ||= 1; d.parts = Math.max(0, parseInt(d.parts, 10) || 0); d.n = Math.max(0, parseInt(d.n, 10) || 0);
  d.list = Array.isArray(d.list) ? d.list : []; d.x = d.x && typeof d.x === 'object' ? d.x : {};
  return d;
};

/** Append `items` (and optionally mutate the head's `x` — small state that is
 *  REPLACED, not appended: a show's leftover votes, its end time). One CAS write;
 *  a spill afterwards only when the head has filled. */
export async function appendLog(key, items = [], extra = null) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length && !extra) return null;
  const r = await casDoc(key, empty, (d) => {
    norm(d);
    for (const it of list) d.list.push(it);
    d.n += list.length;
    if (extra) extra(d.x, d);
    return true;
  });
  if (r && r.data && r.data.list.length >= CHUNK()) await spill(key, r.data).catch(() => {});
  return r && r.data;
}

async function spill(key, head) {
  const i = head.parts, size = CHUNK();
  const body = JSON.stringify({ v: 1, part: i, list: head.list.slice(0, size) });
  try { await store().set(partKey(key, i), body, { onlyIfNew: true }); } catch { /* re-tried next append */ }
  await casDoc(key, empty, (h) => {
    norm(h);
    if (h.parts !== i || h.list.length < size) return false;
    h.list = h.list.slice(size);
    h.parts = i + 1;
    return true;
  });
}

export async function readLogHead(key) {
  const { data } = await readDoc(key, null);
  return norm(data || empty());
}

/** Everything ever appended, in order. `parts` reads run in parallel. */
export async function readLog(key) {
  const head = await readLogHead(key);
  const parts = await Promise.all(Array.from({ length: head.parts }, (_, i) => readDoc(partKey(key, i), null)));
  const list = [];
  for (const p of parts) for (const it of (((p && p.data) || {}).list || [])) list.push(it);
  for (const it of head.list) list.push(it);
  return { list, n: head.n, parts: head.parts, x: head.x };
}

/** Every key the log occupies — for export and delete. One read (the head). */
export async function logKeys(key) {
  const head = await readLogHead(key);
  return [key, ...Array.from({ length: head.parts }, (_, i) => partKey(key, i))];
}
