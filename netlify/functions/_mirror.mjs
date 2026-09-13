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
   (ephemeral, and a second copy of a secret is a second place to lose it), and the
   room's fan shards — device records for tonight, wiped at the end of it, never
   exported (0bu). A restore from this copy is a restore of the record, not of a
   show in progress.

   TIME-BOXED. A scheduled function has seconds, not minutes, so a pass is a cursor
   over the owner list that advances as far as the budget allows and continues on
   the next ring; the ring after a finished pass is one read and a return until
   the pass is a day old. At today's size a pass is one ring. */

export const STATE = 'mirror';
export const MANIFEST = (owner) => `mirror_${owner}`;
export const PREFIX = 'backup/';
export const PASS_GAP_MS = 20 * 3600e3;
export const BUDGET_MS = () => Math.max(500, parseInt(process.env.MYSET_MIRROR_BUDGET_MS, 10) || 7000);
export const GLOBALS = ['artists', 'venues', 'cityindex', 'acctindex', 'flags', 'idqueue', 'promos',
                        'sheetsync', 'gigsched', 'vidqueue', 'delqueue', 'ledger_platform'];
export const SKIP = /^(sess_|lock_|authc_|authsecret$|f\d+_)/;
export const skipped = (k) => SKIP.test(k);

const emptyState = () => ({ v: 1, order: [], cursor: 0, passStartedAt: 0, passDoneAt: 0, copied: 0, skipped: 0, failed: 0 });
const emptyManifest = () => ({ v: 1, at: 0, by: {} });

async function etagOf(key) {
  try { const m = await store().getMetadata(key); return m ? (m.etag || null) : null; } catch { return null; }
}

/** Copy one owner's keys that changed since the manifest. Returns the counts. */
export async function mirrorOwner(owner, keys, now = Date.now()) {
  const out = { copied: 0, skipped: 0, failed: 0, missing: 0 };
  const { data: man } = await readDoc(MANIFEST(owner), null);
  const by = { ...((man && man.by) || {}) };
  const todo = [...new Set(keys)].filter((k) => k && !skipped(k));
  const POOL = 6;
  let i = 0;
  const worker = async () => {
    while (i < todo.length) {
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
      } catch { out.failed++; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(POOL, todo.length) }, worker));
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
    if (st.passDoneAt && now - st.passDoneAt < PASS_GAP_MS) return { done: true, passDoneAt: st.passDoneAt };
    st.order = ['global', ...(await owners())];
    st.cursor = 0; st.passStartedAt = now; st.copied = 0; st.skipped = 0; st.failed = 0;
  }
  const did = [];
  // at least one owner per ring, so a pass always moves; more while the budget lasts
  while (st.cursor < st.order.length) {
    const owner = st.order[st.cursor];
    const keys = owner === 'global' ? GLOBALS : await keysOf(owner).catch(() => []);
    const r = await mirrorOwner(owner, keys, now);
    st.copied += r.copied; st.skipped += r.skipped; st.failed += r.failed;
    did.push(owner);
    st.cursor++;
    if (Date.now() - t0 >= budgetMs) break;
  }
  const finished = st.cursor >= st.order.length;
  if (finished) st.passDoneAt = now;
  await casDoc(STATE, emptyState, (d) => { Object.assign(d, st); return true; }).catch(() => {});
  return { done: finished, owners: did, cursor: st.cursor, of: st.order.length, copied: st.copied, skipped: st.skipped, failed: st.failed };
}
