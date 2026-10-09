import { readDoc, casDoc } from './_lib.mjs';
import { readArchivedPosts, archiveKeys as postArchiveKeys } from './_community.mjs';
import { credKey } from './_cred.mjs';
import { readVenues, mutateVenues, getVenueProfile } from './_venues.mjs';
import { readEvents } from './_events.mjs';
import { merchSlots } from './_profile.mjs';
import { readPosts, shapeForOwner } from './_community.mjs';
import { readPending, vidKey } from './_video.mjs';
import { logKeys } from './_append.mjs';
import { PAIDARC, paidArcYears } from './_pay.mjs';

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

/** Every key the app writes for one venue. Kept here on purpose (see header).
 *  The same promise as keysFor (0im): a document is named before any key read off
 *  it, and `namers` collects the documents read to name others. */
export async function keysForVenue(vid, namers = null) {
  const o = OWNER(vid);
  const named = (...ks) => { if (namers) for (const k of ks) if (k) namers.add(k); };
  const keys = [`vprofile_${vid}`, `vouch_${vid}`, `ev_${o}`, `posts_${o}`, `likes_${o}`,
    `meta_${o}`, `billing_${o}`, `connect_${o}`, `sess_${o}`, `rec_${o}`,
    `apitch_${o}`, `lock_${o}`, `vidpend_${o}`, `ledger_${o}`, `ledidx_${o}`, `rsvp_${o}`, `wishes_${o}`, `paylim_${o}`,   // paylim_: the checkout limiter (0111)
    /* Three a venue grew after this list was written, so none had a second home and
       each outlived the venue (0146): the pitches it was sent (0123), its alert
       devices (0124), and its answers to shows listed at its place (0128). */
    `vpitch_${vid}`, `push_${o}`, `gigok_${vid}`];
  // the payment markers that left meta for their year (0193) — every year since MySet's first, computed
  for (const y of paidArcYears()) keys.push(PAIDARC(o, y));
  const [prof, posts, pend] = await Promise.all([getVenueProfile(vid), readPosts(o), readPending(o)]);
  named(`vprofile_${vid}`, `posts_${o}`, `vidpend_${o}`);
  for (const slot of ['cover', 'avatar', 'idcheck', ...Array.from({ length: 12 }, (_, i) => 'p' + i)])
    keys.push(IMG(vid, slot));
  for (const it of prof.merch || []) for (const slot of merchSlots(it.id)) keys.push(IMG(vid, slot));   // five picture slots per item (2026-09-14)
  for (const p of posts.list || []) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(vid, `${p.id}_${i}`));
  /* Clips: the ones a post claims AND the ones still waiting to be claimed, or a
     venue that left would leave 3MB behind per unattached upload for ever. */
  for (const p of posts.list || []) if (p && p.clip) { keys.push(vidKey(o, p.clip)); keys.push(IMG(vid, p.clip)); }
  for (const c of Object.keys(pend.by || {})) { keys.push(vidKey(o, c)); keys.push(IMG(vid, c)); }
  // one password record per sign-in address (decision 0070)
  const reg = await readVenues().catch(() => ({ byEmail: {} }));
  for (const [e, v] of Object.entries(reg.byEmail || {})) if (v && v.venueId === vid) keys.push(credKey(o, e));
  // posts that left the feed still own their photos and clips (decision 0068)
  for (const k of await postArchiveKeys(o).catch(() => [])) { keys.push(k); named(k); }   // read whole for its photos
  // the activity log and its parts (0200): the head names them, one read; the head is a namer
  const logs = await logKeys(`log_${o}`).catch(() => [`log_${o}`]);
  keys.push(...logs); named(logs[0]);
  const oldPosts = await readArchivedPosts(o).catch(() => []);
  for (const p of oldPosts) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(vid, `${p.id}_${i}`));
  for (const p of oldPosts) if (p && p.clip) { keys.push(vidKey(o, p.clip)); keys.push(IMG(vid, p.clip)); }
  /* A page that began as a sample (decision 0101): its record, and the photos stored
     under the sample's own unguessable name. */
  keys.push(`sample_${o}`);
  { const { sampleImgKeys } = await import('./_img.mjs');
    keys.push(...sampleImgKeys([prof.photo, ...(prof.photos || [])])); }
  return [...new Set(keys)];
}

/* `from` and `deadline` come from purgeDue in _account.mjs, the same walk as an
   artist's (leaves first, the index last — 0im); a direct call deletes the lot. */
export async function deleteVenue(vid, { deadline = Infinity, from = null } = {}) {
  const o = OWNER(vid);
  if (!from) {
    const { cancelForDeletion } = await import('./_billing.mjs');
    await cancelForDeletion(o).catch(() => {});
    try { const { reindexCities } = await import('./_events.mjs'); await reindexCities(o, { list: [] }); } catch {}
    try {
      const { readConnect } = await import('./_connect.mjs');
      const c = await readConnect(o);
      if (c.acct) await casDoc('acctindex', () => ({ v: 1, by: {} }), (d) => {
        if (!d.by || !d.by[c.acct]) return false; delete d.by[c.acct]; return true; });
    } catch {}
  }
  const namers = new Set();
  const keys = await keysForVenue(vid, namers);
  /* Clip bytes leave R2 with their keys, inside the walk (see _video.mjs). */
  const { eraseKeys } = await import('./_account.mjs');
  const w = await eraseKeys(keys, namers, { deadline, from });
  if (w.partial) return { ok: true, partial: true, cursor: w.cursor, error: w.error, deleted: w.gone };
  const gone = w.gone;
  // the registry rows go LAST, so a token presented mid-delete finds nothing to act on
  await mutateVenues((reg) => {
    const me = reg.byId[vid];
    if (me && me.slug && reg.bySlug[me.slug] === vid) delete reg.bySlug[me.slug];
    if (reg.oldSlug) for (const [k, v] of Object.entries(reg.oldSlug)) if (v.vid === vid) delete reg.oldSlug[k];
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
  const { DELQ, purgeStarted } = await import('./_account.mjs');
  if (await purgeStarted(OWNER(vid))) return { ok: false, error: 'This venue is already being deleted.' };
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
