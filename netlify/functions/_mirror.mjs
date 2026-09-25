import { store, readDoc, casDoc } from './_lib.mjs';
import { r2Enabled, r2Put } from './_r2.mjs';

/* THE SECOND HOME — every finished thing, on the other vendor. Decision 0069.

   Netlify Blobs is the one live store. Until 2026-09-12 there was no copy of it
   anywhere; since then there is tools/backup.py, a copy on the founder's laptop
   taken by hand at the start of a session. This is the copy nobody has to take:
   once a day, every document an owner holds is copied to the R2 bucket that
   already keeps the clips, under `backup/<key>` — the same key, the other store —
   so one vendor failing loses nothing that was ever written.

   HOW IT STAYS CHEAP. A pass walks the registries (never `list()` — INVARIANT 1)
   and, per owner, the same key list export and delete use (`keysFor`), which is
   the one place a new key is added. Each key is asked for its etag only
   (`getMetadata`, no body); a key whose etag is in the owner's manifest
   (`mirror_<owner>`) is skipped. So a nightly pass is one metadata read per key
   and a copy only of what changed — write-once documents (a night, a version, a
   log part) cross exactly once.

   WHAT IS NOT COPIED, on purpose: sign-in secrets and codes, sessions and lockouts
   (ephemeral, and a second copy of a secret is a second place to lose it), the
   room's fan shards — device records for tonight, wiped at the end of it, never
   exported (0bu) — and clip bytes (`vid_`), which already live on R2 under the
   same key (0dq): pulling a 70 MB clip through a function to put it where it
   already is was what the first ring in production did, and it hit Netlify's
   ten-second limit twice (2026-09-13 17:40Z, 12.9 s and 11.7 s, no log line). A
   restore from this copy is a restore of the record, not of a show in progress.

   TIME-BOXED, PER KEY. A scheduled function has ten seconds, not minutes. The
   deadline is checked after every key, not only between owners: a ring copies
   what it can, saves the manifest for what it did, and leaves the cursor on the
   unfinished owner AND on the key it reached (`keyCursor`), so the next ring
   carries on from there rather than re-reading the owner's keys from the top.
   Each worker handles at least one key per ring, so a pass always moves. The
   key list is rebuilt each ring; a key that moved in the list is caught by the
   next pass — the manifest does not have it, so it is copied then. The ring
   after a finished pass is one read and a return until the pass is a day old. */

export const STATE = 'mirror';
export const MANIFEST = (owner) => `mirror_${owner}`;
export const PREFIX = 'backup/';
export const PASS_GAP_MS = 20 * 3600e3;
/* A pass that failed to copy anything is not a pass: try again in an hour, not a
   day. The first one in production (2026-09-13 18:00Z) was 0 copied / 69 failed —
   R2 answered 403 to every PUT (the token can read the bucket, not write it; the
   clips had been falling back to Blobs since 2026-09-11 for the same reason,
   `r2.put 403` in the error log). The ring says the first failure's words so
   the next person does not have to guess. That token has written since
   2026-09-15 ~04:30Z (Object Read & Write); the retry gap stays for the next
   refusal, whatever its cause. */
export const RETRY_GAP_MS = 3600e3;
export const BUDGET_MS = () => Math.max(0, Number(process.env.MYSET_MIRROR_BUDGET_MS ?? 5500));
export const GLOBALS = ['artists', 'venues', 'cityindex', 'acctindex', 'flags', 'idqueue', 'promos',
                        'sheetsync', 'gigsched', 'vidqueue', 'delqueue', 'ledger_platform',
                        /* the founder's register (0095): its head, its working state and its
                           bell's state; the month shards are named by the head (globalKeys) */
                        'register', 'register_work', 'registersync'];
/** The global keys, with the register's month shards read off its head — computable, no list(). */
export async function globalKeys() {
  const out = [...GLOBALS];
  try {
    const { readDoc } = await import('./_lib.mjs');
    const { data } = await readDoc('register', null);
    for (const m of (data && data.months) || []) for (let i = 0; i < Math.max(1, m.parts || 1); i++) out.push(i ? `register_${m.ym}_${i}` : `register_${m.ym}`);
  } catch { /* no head yet */ }
  return out;
}
export const SKIP = /^(sess_|lock_|authc_|authsecret$|f\d+_|vid_)/;
export const skipped = (k) => SKIP.test(k);

const emptyState = () => ({ v: 1, order: [], cursor: 0, keyCursor: 0, passStartedAt: 0, passDoneAt: 0, copied: 0, skipped: 0, failed: 0, err: null });
const emptyManifest = () => ({ v: 1, at: 0, by: {} });

async function etagOf(key) {
  try { const m = await store().getMetadata(key); return m ? (m.etag || null) : null; } catch { return null; }
}

/** Copy one owner's keys that changed since the manifest, from index `start`,
 *  until `deadline`. Returns the counts, `partial` when the deadline stopped it
 *  short, and `next` — the index the next ring should start from. */
export async function mirrorOwner(owner, keys, now = Date.now(), deadline = Infinity, start = 0) {
  const out = { copied: 0, skipped: 0, failed: 0, missing: 0, partial: false, next: 0, err: null };
  const { data: man } = await readDoc(MANIFEST(owner), null);
  const by = { ...((man && man.by) || {}) };
  const todo = [...new Set(keys)].filter((k) => k && !skipped(k));
  const POOL = 6;
  let i = Math.min(Math.max(0, start | 0), todo.length);
  const worker = async () => {
    do {
      if (i >= todo.length) return;
      const k = todo[i++];
      const etag = await etagOf(k);
      if (!etag) { out.missing++; continue; }
      if (by[k] === etag) { out.skipped++; continue; }
      try {
        const r = await store().getWithMetadata(k, { type: 'arrayBuffer', consistency: 'strong' });
        if (!r || !r.data) { out.missing++; continue; }
        const type = (r.metadata && r.metadata.type) || 'application/json';
        await r2Put(PREFIX + k, Buffer.from(r.data), type);
        by[k] = r.etag || etag;
        out.copied++;
      } catch (e) { out.failed++; out.err ||= `${k}: ${String((e && e.message) || e).slice(0, 80)}`; }
    } while (Date.now() < deadline);          // at least one key per worker, then the clock decides
  };
  await Promise.all(Array.from({ length: Math.min(POOL, Math.max(0, todo.length - i)) }, worker));
  out.partial = i < todo.length;
  out.next = out.partial ? i : 0;
  await casDoc(MANIFEST(owner), emptyManifest, (m) => { m.at = now; m.by = by; return true; }).catch(() => {});
  return out;
}

/** One ring: continue or start a pass, inside the budget. `keysOf(owner)` names
 *  an owner's keys — injected so this module never imports the account modules
 *  (they import half the app). */
export async function runMirror({ now = Date.now(), budgetMs = BUDGET_MS(), owners, keysOf }) {
  if (!r2Enabled()) return { off: true };
  const t0 = Date.now();
  let st = (await readDoc(STATE, null)).data || emptyState();
  st = { ...emptyState(), ...st };
  const inPass = st.order.length && st.cursor < st.order.length;
  if (!inPass) {
    const gap = st.failed ? RETRY_GAP_MS : PASS_GAP_MS;
    if (st.passDoneAt && now - st.passDoneAt < gap) return { done: true, passDoneAt: st.passDoneAt, failed: st.failed, err: st.err || null };
    st.order = ['global', ...(await owners())];
    st.cursor = 0; st.keyCursor = 0; st.passStartedAt = now; st.copied = 0; st.skipped = 0; st.failed = 0; st.err = null;
  }
  const did = [];
  const deadline = t0 + budgetMs;
  // every ring copies something (each worker at least one key); more while the clock allows
  while (st.cursor < st.order.length) {
    const owner = st.order[st.cursor];
    const keys = owner === 'global' ? await globalKeys() : await keysOf(owner).catch(() => []);
    const r = await mirrorOwner(owner, keys, now, deadline, st.keyCursor);
    st.copied += r.copied; st.skipped += r.skipped; st.failed += r.failed;
    st.err ||= r.err;
    did.push(owner);
    st.keyCursor = r.next;
    if (r.partial) break;                     // the cursor stays: the next ring finishes this owner
    st.cursor++;
    if (Date.now() >= deadline) break;
  }
  const finished = st.cursor >= st.order.length;
  if (finished) st.passDoneAt = now;
  await casDoc(STATE, emptyState, (d) => { Object.assign(d, st); return true; }).catch(() => {});
  return { done: finished, owners: did, cursor: st.cursor, of: st.order.length, copied: st.copied, skipped: st.skipped, failed: st.failed, err: st.err || null };
}
