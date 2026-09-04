import { store, readDoc, casDoc, KEY, SHARDS, DEFAULT_ARTIST } from './_lib.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';
import { getProfile } from './_profile.mjs';
import { readEvents, mutateEvents, reindexCities } from './_events.mjs';
import { readLists, readLearn } from './_lists.mjs';
import { readHistIndex } from './_history.mjs';
import { readPosts, shapeForOwner } from './_community.mjs';
import { readFeedback, shapeFeedback } from './_feedback.mjs';
import { readMeta } from './_lib.mjs';

/* THE ACCOUNT — what an artist can take with them, and how they leave.

   Two things every account system owes its users and this one did not have:
     · EXPORT: everything MySet holds about you, as one JSON file, on demand.
       Never a fan's device id (0bu) — phones are counted, never named.
     · DELETE: gone means gone. Every document under the artist's id, every image,
       the registry rows, the slug, the sign-in addresses, the schedule and city
       indexes, the ID-review row, the Stripe subscription. Never `list()` (1) —
       the keys are enumerated from what the app knows it writes, which is also
       why the list below is the one place a new per-artist key must be added.
       Deleting the founder is refused. */

const IMG = (aid, slot) => `img_${aid}_${slot}`;

export async function exportArtist(aid) {
  const reg = await readArtists();
  const me = reg.byId[aid] || {};
  const [profile, show, events, lists, learn, hist, posts, fb, meta] = await Promise.all([
    getProfile(aid), readDoc(KEY.show(aid), null), readEvents(aid), readLists(aid), readLearn(aid),
    readHistIndex(aid), readPosts(aid), readFeedback(aid), readMeta(aid)]);
  const sh = show.data || {};
  return {
    exportedAt: new Date().toISOString(),
    account: { artistId: aid, slug: me.slug, name: me.name, createdAt: me.createdAt, plan: me.plan, planUntil: me.planUntil || null,
               verified: !!me.verified, emails: Object.entries(reg.byEmail).filter(([, v]) => v.artistId === aid).map(([e, v]) => ({ email: e, role: v.role })) },
    profile: { name: profile.name, tagline: profile.tagline, bio: profile.bio, links: profile.links, media: profile.media, merch: profile.merch,
               photo: profile.photo, avatar: profile.avatar, photos: profile.photos },
    show: { venue: sh.venue, city: sh.city, songs: sh.songs || [], freeCredits: sh.freeCredits, replayCost: sh.replayCost, packs: sh.packs,
            requests: sh.requests, birthdays: sh.birthdays, tags: sh.tags || [] },
    gigs: events.list,
    setlists: lists.lists, songsToLearn: learn.list,
    shows: hist.shows,
    money: { tips: (meta.tips || []).map(({ fan, ...t }) => t), orders: (meta.orders || []).map(({ fan, ...o }) => o) },
    community: shapeForOwner(posts),
    feedback: shapeFeedback(fb),
  };
}

/** Every key this app writes for one artist. Kept here on purpose (see header). */
export async function keysFor(aid) {
  const keys = [KEY.show(aid), KEY.meta(aid), KEY.profile(aid), KEY.histIdx(aid), `req_${aid}`,
    `ev_${aid}`, `lists_${aid}`, `learn_${aid}`, `push_${aid}`, `connect_${aid}`, `fb_${aid}`,
    `lock_${aid}`, `apitch_${aid}`, `songstats_${aid}`, `posts_${aid}`, `likes_${aid}`, `billing_${aid}`,
    `histids_${aid}`, `histpend_${aid}`, `sess_${aid}`, `log_${aid}`, `rec_${aid}`, `pkeys_${aid}`];
  for (let n = 0; n < SHARDS; n++) keys.push(KEY.fan(aid, n));
  const [hist, show, profile, posts, ids] = await Promise.all([
    readHistIndex(aid), readDoc(KEY.show(aid), null), getProfile(aid), readPosts(aid),
    readDoc(`histids_${aid}`, null)]);
  /* THE INDEX IS CAPPED; THIS LIST IS NOT. Past 400 nights the index drops its
     oldest rows while the detail documents stay on disk, so building the key list
     from the index alone left a deleted artist's oldest gigs behind for ever and
     left them out of the export. `histids_` is every showId ever archived. */
  for (const s of hist.shows || []) if (s.showId) keys.push(KEY.hist(aid, s.showId));
  for (const id of (((ids && ids.data) || {}).ids || [])) keys.push(KEY.hist(aid, id));
  for (const sg of ((show.data || {}).songs || [])) if (sg && sg.id) { keys.push(`lyr_${aid}_${sg.id}`); keys.push(`chart_${aid}_${sg.id}`); }
  for (const slot of ['cover', 'avatar', 'p0', 'p1', 'p2', 'idcheck']) keys.push(IMG(aid, slot));
  for (const m of profile.merch || []) keys.push(IMG(aid, m.id));
  for (const p of posts.list || []) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(aid, `${p.id}_${i}`));
  return [...new Set(keys)];
}

/* LEAVING, WITH THIRTY DAYS TO CHANGE YOUR MIND.

   Perry: "make sure there is a 2-step double confirmation they have to click twice
   before their account is deleted (but still keep all the data stored somewhere)."

   THE DATA DOES NOT MOVE. Not one document. Copying forty-odd blobs into an
   archive namespace is forty writes that can half-fail, and a half-archived
   account is exactly the thing a grace period exists to prevent. Instead the
   account is MARKED, `publicArtist` refuses it, and every public endpoint 404s for
   free. Thirty days later the cron runs `deleteArtist`, which is unchanged: it
   stopped being what the button does and became what the calendar does.

   WHAT HAPPENS ON DAY ONE
     · the page, the voting screen and the community page go dark
     · billing is cancelled immediately — never keep charging somebody who has left
     · any running show is filed, and the calendar comes out of the city and
       schedule indexes, so the artist stops appearing in listings and stops being
       auto-started
     · the SLUG IS HELD, not freed. MySet page names are printed on QR codes stuck
       to bar tables. Freeing it would let a stranger take it and every one of those
       codes would land a room full of people on somebody else's setlist — and Undo
       would be a promise the system could not keep. There is a link in the Studio
       to free it deliberately, which is a decision rather than a surprise.
     · sessions are NOT killed and `rev` is NOT bumped. The owner has to be able to
       get back in to undo. Soft delete locks the account DOWN; it must never lock
       the owner OUT. */
export const DELETE_GRACE_MS = 30 * 86400e3;
export const DELQ = 'delqueue';

export async function startDeletion(aid, by) {
  if (aid === DEFAULT_ARTIST) return { ok: false, error: 'The founding account cannot be deleted from here.' };
  const purgeAt = Date.now() + DELETE_GRACE_MS;
  let already = false;
  await mutateArtists((reg) => {
    const row = reg.byId[aid];
    if (!row) return false;
    if (row.del) { already = true; return false; }
    row.del = { at: Date.now(), by: by || '', purgeAt, slugFreed: false };
    return true;
  });
  if (already) return { ok: true, purgeAt: (await readArtists()).byId[aid].del.purgeAt, already: true };
  const { cancelForDeletion } = await import('./_billing.mjs');
  await cancelForDeletion(aid).catch(() => {});
  try { const { endShow } = await import('./_lifecycle.mjs'); await endShow(aid, { by: 'artist' }); } catch {}
  try { await reindexCities(aid, { list: [] }); } catch {}
  try { const { reindexSched } = await import('./_auto.mjs'); await reindexSched(aid, { list: [] }); } catch {}
  await casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => { d.by ||= {}; d.by[aid] = purgeAt; return true; }).catch(() => {});
  return { ok: true, purgeAt };
}

export async function cancelDeletion(aid) {
  let freed = false, slug = '', gone = false;
  await mutateArtists((reg) => {
    const row = reg.byId[aid];
    if (!row || !row.del) { gone = true; return false; }
    freed = !!row.del.slugFreed;
    slug = row.slug || '';
    delete row.del;
    /* If the page address was deliberately freed and nobody took it, it comes
       back. If somebody did take it, say so rather than silently handing them a
       page nobody can reach. */
    if (freed && slug && !reg.bySlug[slug] && !reg.byId[slug]) { reg.bySlug[slug] = aid; freed = false; }
    return true;
  });
  if (gone) return { ok: false, error: 'Nothing to undo' };
  try {
    const events = await readEvents(aid);
    await reindexCities(aid, events);
    const { reindexSched } = await import('./_auto.mjs');
    await reindexSched(aid, events);
  } catch {}
  await casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => { if (!d.by || !d.by[aid]) return false; delete d.by[aid]; return true; }).catch(() => {});
  return { ok: true, slugLost: freed };
}

/** "Free up my page address now" — a knowing decision, not a side effect. */
export async function freeSlug(aid) {
  let slug = '';
  await mutateArtists((reg) => {
    const row = reg.byId[aid];
    if (!row || !row.del || row.del.slugFreed) return false;
    slug = row.slug || '';
    if (slug && reg.bySlug[slug] === aid) delete reg.bySlug[slug];
    if (reg.oldSlug) for (const [k, v] of Object.entries(reg.oldSlug)) if (v.aid === aid) delete reg.oldSlug[k];
    row.del.slugFreed = true;
    return true;
  });
  return { ok: true, slug };
}

/* Purged by the cron, one account per ring. The queue entry is removed LAST, so a
   crash halfway simply retries: deleting a blob that is already gone is a no-op
   and mutateArtists on a row that has gone is harmless. Purge must be re-runnable. */
export async function purgeDue(now = Date.now(), limit = 1) {
  const { data } = await readDoc(DELQ, null);
  const due = Object.entries((data && data.by) || {}).filter(([, at]) => Number(at) <= now).slice(0, limit);
  const done = [];
  for (const [owner] of due) {
    try {
      if (String(owner).startsWith('v_')) {
        const { deleteVenue } = await import('./_venueaccount.mjs');
        await deleteVenue(owner.slice(2));
      } else {
        await deleteArtist(owner);
      }
      done.push(owner);
    } catch (e) { console.error('purge failed for', owner, e && e.message); continue; }
    await casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => { if (!d.by || !d.by[owner]) return false; delete d.by[owner]; return true; }).catch(() => {});
  }
  return { purged: done };
}

export async function deleteArtist(aid) {
  if (aid === DEFAULT_ARTIST) return { ok: false, error: 'The founding account cannot be deleted from here.' };
  const { cancelForDeletion } = await import('./_billing.mjs');
  await cancelForDeletion(aid).catch(() => {});
  // indexes first, while the calendar still exists to be un-indexed
  try { await reindexCities(aid, { list: [] }); } catch {}
  try { const { reindexSched } = await import('./_auto.mjs'); await reindexSched(aid, { list: [] }); } catch {}
  try {
    const { readConnect } = await import('./_connect.mjs');
    const c = await readConnect(aid);
    if (c.acct) { const { casDoc } = await import('./_lib.mjs'); await casDoc('acctindex', () => ({ v: 1, by: {} }), (d) => { if (!d.by || !d.by[c.acct]) return false; delete d.by[c.acct]; return true; }); }
  } catch {}
  try { const { mutateIdQueue } = await import('./_verify.mjs'); await mutateIdQueue((q) => { if (!q.by || !q.by[aid]) return false; delete q.by[aid]; return true; }); } catch {}
  const keys = await keysFor(aid);
  let gone = 0;
  for (const k of keys) { try { await store().delete(k); gone++; } catch {} }
  await mutateArtists((reg) => {
    const me = reg.byId[aid];
    if (me && me.slug && reg.bySlug[me.slug] === aid) delete reg.bySlug[me.slug];
    for (const [e, v] of Object.entries(reg.byEmail)) if (v.artistId === aid) delete reg.byEmail[e];
    delete reg.byId[aid];
    return true;
  });
  return { ok: true, deleted: gone };
}
