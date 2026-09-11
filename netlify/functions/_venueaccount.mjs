import { store, readDoc, casDoc } from './_lib.mjs';
import { readVenues, mutateVenues, getVenueProfile } from './_venues.mjs';
import { readEvents } from './_events.mjs';
import { readPosts, shapeForOwner } from './_community.mjs';
import { readPending, dropClipKeys, vidKey } from './_video.mjs';

/* A VENUE'S ACCOUNT — take it with you, or leave.

   ACCOUNTS.md §2 says plainly: "a user who can delete themselves must first be
   able to take everything with them". Venues could do neither. They could sign up,
   put a page up, take money through Stripe Connect, pay for Pro — and had no
   export, no deletion, and no way out except emailing Perry. That is a promise the
   document made and the code did not keep.

   Everything here is the artist twin in _account.mjs, keyed `v_<vid>` (INVARIANT
   0cw), and it obeys the same two rules: never Blobs list() (INVARIANT 1), and the
   key list below is the ONE place a new per-venue key gets added. */

const IMG = (vid, slot) => `img_v_${vid}_${slot}`;
const OWNER = (vid) => `v_${vid}`;

export async function exportVenue(vid) {
  const reg = await readVenues();
  const me = reg.byId[vid] || {};
  const [prof, events, posts, meta] = await Promise.all([
    getVenueProfile(vid), readEvents(OWNER(vid)), readPosts(OWNER(vid)),
    readDoc(`meta_${OWNER(vid)}`, {})]);
  const m = (meta && meta.data) || {};
  return {
    exportedAt: new Date().toISOString(),
    account: { venueId: vid, slug: me.slug, name: me.name, city: me.city, country: me.country,
               createdAt: me.createdAt, plan: me.plan, planUntil: me.planUntil || null,
               verified: !!me.verified,
               emails: Object.entries(reg.byEmail).filter(([, v]) => v.venueId === vid)
                 .map(([e, v]) => ({ email: e, role: v.role || 'owner' })) },
    profile: prof,
    gigs: events.list,
    community: shapeForOwner(posts, OWNER(vid)),
    /* The buyer's device id never leaves, the same rule tips and orders follow on
       the artist side: fans are counted, never named (INVARIANT 0bu). */
    orders: (m.orders || []).map(({ fan, ...o }) => o),
  };
}

/** Every key the app writes for one venue. Kept here on purpose (see header). */
export async function keysForVenue(vid) {
  const o = OWNER(vid);
  const keys = [`vprofile_${vid}`, `vouch_${vid}`, `ev_${o}`, `posts_${o}`, `likes_${o}`,
    `meta_${o}`, `billing_${o}`, `connect_${o}`, `sess_${o}`, `log_${o}`, `rec_${o}`,
    `apitch_${o}`, `lock_${o}`, `vidpend_${o}`, `ledger_${o}`, `ledidx_${o}`];
  const [prof, posts, pend] = await Promise.all([getVenueProfile(vid), readPosts(o), readPending(o)]);
  for (const slot of ['cover', 'avatar', 'idcheck', ...Array.from({ length: 12 }, (_, i) => 'p' + i)])
    keys.push(IMG(vid, slot));
  for (const it of prof.merch || []) keys.push(IMG(vid, it.id));
  for (const p of posts.list || []) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(vid, `${p.id}_${i}`));
  /* Clips: the ones a post claims AND the ones still waiting to be claimed, or a
     venue that left would leave 3MB behind per unattached upload for ever. */
  for (const p of posts.list || []) if (p && p.clip) { keys.push(vidKey(o, p.clip)); keys.push(IMG(vid, p.clip)); }
  for (const c of Object.keys(pend.by || {})) { keys.push(vidKey(o, c)); keys.push(IMG(vid, c)); }
  return [...new Set(keys)];
}

export async function deleteVenue(vid) {
  const o = OWNER(vid);
  const { cancelForDeletion } = await import('./_billing.mjs');
  await cancelForDeletion(o).catch(() => {});
  try { const { reindexCities } = await import('./_events.mjs'); await reindexCities(o, { list: [] }); } catch {}
  try {
    const { readConnect } = await import('./_connect.mjs');
    const c = await readConnect(o);
    if (c.acct) await casDoc('acctindex', () => ({ v: 1, by: {} }), (d) => {
      if (!d.by || !d.by[c.acct]) return false; delete d.by[c.acct]; return true; });
  } catch {}
  const keys = await keysForVenue(vid);
  let gone = 0;
  for (const k of keys) { try { await store().delete(k); gone++; } catch {} }
  /* Clip bytes live on R2 when it is on (see _video.mjs); the same keys, the other store. */
  await dropClipKeys(keys);
  // the registry rows go LAST, so a token presented mid-delete finds nothing to act on
  await mutateVenues((reg) => {
    const me = reg.byId[vid];
    if (me && me.slug && reg.bySlug[me.slug] === vid) delete reg.bySlug[me.slug];
    for (const [e, v] of Object.entries(reg.byEmail)) if (v.venueId === vid) delete reg.byEmail[e];
    delete reg.byId[vid];
    return true;
  });
  return { ok: true, deleted: gone };
}

/* The same thirty days the artist side gets, and the same reasons — see the long
   note above startDeletion in _account.mjs. A venue's page name is on a Google
   listing and a printed menu, so the slug is held for the window too. */
export async function startVenueDeletion(vid, by) {
  const { DELETE_GRACE_MS, DELQ } = await import('./_account.mjs');
  const purgeAt = Date.now() + DELETE_GRACE_MS;
  let already = false;
  await mutateVenues((reg) => {
    const row = reg.byId[vid];
    if (!row) return false;
    if (row.del) { already = true; return false; }
    row.del = { at: Date.now(), by: by || '', purgeAt };
    return true;
  });
  if (already) return { ok: true, already: true, purgeAt: ((await readVenues()).byId[vid].del || {}).purgeAt };
  const { cancelForDeletion } = await import('./_billing.mjs');
  await cancelForDeletion(OWNER(vid)).catch(() => {});
  try { const { reindexCities } = await import('./_events.mjs'); await reindexCities(OWNER(vid), { list: [] }); } catch {}
  await casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => { d.by ||= {}; d.by[OWNER(vid)] = purgeAt; return true; }).catch(() => {});
  return { ok: true, purgeAt };
}

export async function cancelVenueDeletion(vid) {
  const { DELQ } = await import('./_account.mjs');
  let gone = false;
  await mutateVenues((reg) => {
    const row = reg.byId[vid];
    if (!row || !row.del) { gone = true; return false; }
    delete row.del;
    return true;
  });
  if (gone) return { ok: false, error: 'Nothing to undo' };
  try {
    const { reindexCities } = await import('./_events.mjs');
    await reindexCities(OWNER(vid), await readEvents(OWNER(vid)));
  } catch {}
  await casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => { if (!d.by || !d.by[OWNER(vid)]) return false; delete d.by[OWNER(vid)]; return true; }).catch(() => {});
  return { ok: true };
}
