import { store, readDoc, KEY, SHARDS, DEFAULT_ARTIST } from './_lib.mjs';
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
    `lock_${aid}`, `apitch_${aid}`, `songstats_${aid}`, `posts_${aid}`, `likes_${aid}`, `billing_${aid}`];
  for (let n = 0; n < SHARDS; n++) keys.push(KEY.fan(aid, n));
  const [hist, show, profile, posts] = await Promise.all([
    readHistIndex(aid), readDoc(KEY.show(aid), null), getProfile(aid), readPosts(aid)]);
  for (const s of hist.shows || []) if (s.showId) keys.push(KEY.hist(aid, s.showId));
  for (const sg of ((show.data || {}).songs || [])) if (sg && sg.id) { keys.push(`lyr_${aid}_${sg.id}`); keys.push(`chart_${aid}_${sg.id}`); }
  for (const slot of ['cover', 'avatar', 'p0', 'p1', 'p2', 'idcheck']) keys.push(IMG(aid, slot));
  for (const m of profile.merch || []) keys.push(IMG(aid, m.id));
  for (const p of posts.list || []) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(aid, `${p.id}_${i}`));
  return [...new Set(keys)];
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
