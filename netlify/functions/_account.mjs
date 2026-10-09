import { store, readDoc, casDoc, KEY, SHARDS, DEFAULT_ARTIST, inTurn } from './_lib.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';
import { getProfile, merchSlots } from './_profile.mjs';
import { readEvents, mutateEvents, reindexCities } from './_events.mjs';
import { readLists, readLearn } from './_lists.mjs';
import { readHistIndex } from './_history.mjs';
import { readPosts, shapeForOwner } from './_community.mjs';
import { readPending, dropClipKey, vidKey } from './_video.mjs';
import { readFeedback, shapeFeedback } from './_feedback.mjs';
import { readBiz } from './_biz.mjs';
import { readMeta } from './_lib.mjs';
import { readArchivedPosts, archiveKeys as postArchiveKeys } from './_community.mjs';
import { readArchivedFeedback, archiveKeys as fbArchiveKeys } from './_feedback.mjs';
import { readEventLog, evtKeys } from './_evlog.mjs';
import { logKeys } from './_append.mjs';
import { LOG } from './_session.mjs';
import { listVersions, versionKeys, verKey } from './_versions.mjs';
import { credKey } from './_cred.mjs';
import { messageKeys, exportMessages } from './_messages.mjs';
import { readDiary } from './_diary.mjs';
import { lookupKeys } from './_lookup.mjs';

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
  const [profile, show, events, lists, learn, hist, posts, fb, meta, biz, ids, oldPosts, oldFb, diary] = await Promise.all([
    getProfile(aid), readDoc(KEY.show(aid), null), readEvents(aid), readLists(aid), readLearn(aid),
    readHistIndex(aid), readPosts(aid), readFeedback(aid), readMeta(aid), readBiz(aid),
    readDoc(`histids_${aid}`, null), readArchivedPosts(aid), readArchivedFeedback(aid), readDiary(aid)]);
  const sh = show.data || {};
  /* EVERY NIGHT'S EVENT LOG (0066). `d` on a vote is a per-night pseudonym —
     sha256(showId | device), cut short — not the device id, unlinkable to any other
     night or to the phone: phones are counted, never named (0bu). And every version
     kept of the hand-edited documents (0067): the bytes for the small ones, the
     timestamps for the library, which is kilobytes a version. */
  const nightIds = [...new Set([...(hist.shows || []).map((s) => s.showId), ...((((ids && ids.data) || {}).ids) || [])])].filter(Boolean);
  const nights = {};
  for (const id of nightIds) {
    const log = await readEventLog(aid, id).catch(() => null);
    if (log && log.n) nights[id] = log;
  }
  const versions = {};
  for (const [name, key, full] of [['profile', KEY.profile(aid), true], ['setlists', `lists_${aid}`, true], ['gigs', `ev_${aid}`, true], ['library', KEY.show(aid), false], ['diary', KEY.diary(aid), true]]) {
    const vs = await listVersions(key).catch(() => []);
    if (!vs.length) continue;
    versions[name] = [];
    for (const v of vs) {
      const doc = full ? (await readDoc(verKey(key, v.ts), null)).data : null;
      versions[name].push(full ? { at: v.ts, doc } : { at: v.ts });
    }
  }
  return {
    exportedAt: new Date().toISOString(),
    account: { artistId: aid, slug: me.slug, name: me.name, createdAt: me.createdAt, plan: me.plan, planUntil: me.planUntil || null,
               verified: !!me.verified, emails: Object.entries(reg.byEmail).filter(([, v]) => v.artistId === aid).map(([e, v]) => ({ email: e, role: v.role })) },
    profile: { name: profile.name, tagline: profile.tagline, bio: profile.bio, links: profile.links, media: profile.media, merch: profile.merch,
               photo: profile.photo, avatar: profile.avatar, photos: profile.photos, tour: profile.tour },
    show: { venue: sh.venue, city: sh.city, songs: sh.songs || [], freeCredits: sh.freeCredits, replayCost: sh.replayCost, songCost: sh.songCost, packs: sh.packs,
            requests: sh.requests, birthdays: sh.birthdays, tags: sh.tags || [] },
    gigs: events.list,
    setlists: lists.lists, songsToLearn: learn.list,
    shows: hist.shows,
    nights, versions,
    money: { tips: (meta.tips || []).map(({ fan, ...t }) => t), orders: (meta.orders || []).map(({ fan, ...o }) => o) },
    // what the artist typed about their own nights — theirs entirely, no fan in it
    business: { prefs: biz.prefs, rules: biz.rules, gigs: biz.gigs },
    community: shapeForOwner(posts, aid),
    communityArchive: shapeForOwner({ list: oldPosts }, aid),
    feedback: shapeFeedback(fb),
    feedbackArchive: oldFb.map(({ fan, ...r }) => r),            // every note that left the list; never the device
    // every conversation from the Book button (0074): the booker's words and the artist's, no device hash
    messages: await exportMessages(aid).catch(() => []),
    // the artist diary (0085): their stories, shown and hidden alike, with the song each names
    diary: diary.pages,
  };
}

/** Every key this app writes for one artist. Kept here on purpose (see header).
 *  ORDER IS A PROMISE (decision 0173, INVARIANT 0im): a document is always named
 *  before any key read off it, so a purge that walks this list from the end deletes
 *  what an index names before the index. `namers`, when given, collects every key
 *  this function READ to name others — the documents a purge must delete last. */
export async function keysFor(aid, namers = null) {
  const named = (...ks) => { if (namers) for (const k of ks) if (k) namers.add(k); };
  const keys = [KEY.show(aid), KEY.meta(aid), KEY.profile(aid), KEY.histIdx(aid), `req_${aid}`,
    `ev_${aid}`, `lists_${aid}`, `learn_${aid}`, `push_${aid}`, `connect_${aid}`, `fb_${aid}`,
    `lock_${aid}`, `apitch_${aid}`, `songstats_${aid}`, `posts_${aid}`, `likes_${aid}`, `billing_${aid}`,
    `histids_${aid}`, `histpend_${aid}`, `sess_${aid}`, `rec_${aid}`, `pkeys_${aid}`,
    `vidpend_${aid}`, `ledger_${aid}`, `ledidx_${aid}`, `feats_${aid}`, `rsvp_${aid}`, KEY.biz(aid), `wishes_${aid}`,
    `paylim_${aid}`,    // the checkout limiter (0111)
    KEY.diary(aid),     // the artist diary (0085)
    `bugs_${aid}`];     // what fans reported from this room (0146: it had no second home, and outlived the account)
  /* `ledger_platform` is the COMPANY's, not this artist's, and is never deleted here. */
  for (let n = 0; n < SHARDS; n++) keys.push(KEY.fan(aid, n));
  const [hist, show, profile, posts, ids, pend, diary] = await Promise.all([
    readHistIndex(aid), readDoc(KEY.show(aid), null), getProfile(aid), readPosts(aid),
    readDoc(`histids_${aid}`, null), readPending(aid), readDiary(aid).catch(() => ({ pages: [] }))]);
  named(KEY.histIdx(aid), KEY.show(aid), KEY.profile(aid), `posts_${aid}`, `histids_${aid}`, `vidpend_${aid}`, KEY.diary(aid));
  for (const p of diary.pages || []) keys.push(IMG(aid, p.id));   // a diary page's cover: the page id is its slot (0085)
  /* THE INDEX IS CAPPED; THIS LIST IS NOT. Past 400 nights the index drops its
     oldest rows while the detail documents stay on disk, so building the key list
     from the index alone left a deleted artist's oldest gigs behind for ever and
     left them out of the export. `histids_` is every showId ever archived. */
  for (const s of hist.shows || []) if (s.showId) keys.push(KEY.hist(aid, s.showId));
  for (const id of (((ids && ids.data) || {}).ids || [])) keys.push(KEY.hist(aid, id));
  /* Every night's event log and its parts (0066); every version and its index
     (0067); the archives the capped feed and feedback list spill into (0068). Each
     is an append-only log whose head names its parts, so the keys are computed
     from one read per log — never list() (1). The reads go side by side (`inTurn`:
     four hundred nights were four hundred reads end to end, before the nightly
     copy or the purge did anything else); the keys land in the same order. */
  const nightIds = [...new Set(keys.filter((k) => k.startsWith(`hist_${aid}_`)).map((k) => k.slice(`hist_${aid}_`.length)))];
  const bases = [KEY.show(aid), KEY.profile(aid), `lists_${aid}`, `ev_${aid}`, KEY.diary(aid)];
  const { sampleImgKeys } = await import('./_img.mjs');
  const [evts, vers, pArch, fArch, reg, oldPosts, msgs, logs] = await Promise.all([
    inTurn(nightIds, (id) => evtKeys(aid, id).catch(() => [])),
    Promise.all(bases.map((base) => versionKeys(base).catch(() => []))),
    postArchiveKeys(aid).catch(() => []), fbArchiveKeys(aid).catch(() => []),
    readArtists().catch(() => ({ byEmail: {} })), readArchivedPosts(aid).catch(() => []),
    messageKeys(aid).catch(() => [`inbox_${aid}`, `inboxarch_${aid}`]),
    logKeys(LOG(aid)).catch(() => [LOG(aid)])]);
  for (const ks of evts) { keys.push(...ks); named(ks[0]); }                    // a night's log head names its parts
  for (const ks of vers) { keys.push(...ks); named(...ks.filter((k) => k.startsWith('vers_'))); }   // the version index, read whole
  keys.push(...pArch); named(...pArch);                                         // the post archive, read whole for its photos
  keys.push(...fArch); named(fArch[0]);                                         // the feedback archive's head names its parts
  keys.push(...logs); named(logs[0]);                                           // the activity log's head names its parts (0200)
  // one password record per sign-in address (decision 0070) — deleted, never exported
  for (const [e, v] of Object.entries(reg.byEmail || {})) if (v && v.artistId === aid) keys.push(credKey(aid, e));
  for (const p of oldPosts) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(aid, `${p.id}_${i}`));
  for (const p of oldPosts) if (p && p.clip) { keys.push(vidKey(aid, p.clip)); keys.push(IMG(aid, p.clip)); }
  for (const sg of ((show.data || {}).songs || [])) if (sg && sg.id) { keys.push(`lyr_${aid}_${sg.id}`); keys.push(`chart_${aid}_${sg.id}`); }
  for (const slot of ['cover', 'avatar', 'p0', 'p1', 'p2', 'idcheck']) keys.push(IMG(aid, slot));
  for (const m of profile.merch || []) for (const slot of merchSlots(m.id)) keys.push(IMG(aid, slot));   // five picture slots per item (2026-09-14)
  for (const p of posts.list || []) for (let i = 0; i < (p.photos || []).length; i++) keys.push(IMG(aid, `${p.id}_${i}`));
  /* Clips, and their poster frames. Both the ones a post claims and the ones
     still pending, because an upload that was never posted is 3MB nothing else
     can ever find (`list()` is banned — INVARIANT 1). */
  for (const p of posts.list || []) if (p && p.clip) { keys.push(vidKey(aid, p.clip)); keys.push(IMG(aid, p.clip)); }
  for (const c of Object.keys(pend.by || {})) { keys.push(vidKey(aid, c)); keys.push(IMG(aid, c)); }
  /* The tour poster (0075), and the inbox with its archive and every conversation the
     two name (0074) — one read of the index, one of the archive head, no list(). */
  keys.push(IMG(aid, 'tour'));
  keys.push(...msgs); named(...msgs.filter((k) => k === `inbox_${aid}` || k.startsWith(`inboxarch_${aid}`)));
  /* A page that began as a sample (decision 0101): its record, and the photos the
     factory stored under the sample's own unguessable name, which IMG(aid, …) above
     cannot name. */
  keys.push(`sample_${aid}`);
  keys.push(...sampleImgKeys([profile.photo, profile.avatar, ...(profile.photos || [])]));
  /* The artist's two kinds of small copy of the list (decision 0176): leaves, named by
     the list itself, so a purge deletes them before the row that names them goes. */
  keys.push(...lookupKeys(reg, aid));
  return [...new Set(keys)];
}

/* LEAVES FIRST, THE INDEX LAST — decision 0173, INVARIANT 0im.

   Until 2026-10-03 a purge deleted the key list from the top, and the top is the
   indexes: `show_`, `histidx_`, `histids_`. A run killed after them left every
   night, event log, version, lyric sheet and chart behind with nothing able to
   name them — `list()` is banned (1), so they were there for ever. A purge now
   walks the list from the END: everything an index names is gone before the
   index is. Documents nothing else is read off go side by side, a few at a time;
   an index goes alone, and only once every key named after it is gone. A delete
   that fails stops the walk before the next index, so nothing it names is
   orphaned, and the next ring tries again.

   It is TIME-BOXED and CARRIES ON. `from` is the last key a ring deleted; the
   next ring finds it in the same list (its index is still there to name it) and
   carries on below it, so an account with thousands of versions finishes over a
   few rings instead of starting from the end every hour. */
export const PURGE_BUDGET_MS = () => Math.max(0, Number(process.env.MYSET_PURGE_BUDGET_MS ?? 4000));
const ERASE_WIDTH = 8;

/** Delete `keys` from the last to the first. `namers`: the keys read to name the
 *  rest (keysFor's second argument). Stops at `deadline` (after at least one step)
 *  or at a delete that fails; `cursor` is where the next call carries on. */
export async function eraseKeys(keys, namers, { deadline = Infinity, from = null } = {}) {
  const out = { gone: 0, partial: false, cursor: from, error: null };
  let i = keys.length - 1;
  if (from) { const j = keys.indexOf(from); if (j >= 0) i = j - 1; }
  const drop = async (k) => { await store().delete(k); await dropClipKey(k); out.gone++; };   // a clip's bytes on R2 go with its key
  for (let steps = 0; i >= 0; steps++) {
    if (steps && Date.now() >= deadline) { out.partial = true; return out; }
    const batch = [keys[i--]];
    if (!namers.has(batch[0])) while (i >= 0 && !namers.has(keys[i]) && batch.length < ERASE_WIDTH) batch.push(keys[i--]);
    const res = await Promise.allSettled(batch.map(drop));
    const bad = res.find((r) => r.status === 'rejected');
    if (bad) { out.partial = true; out.error = `${String((bad.reason && bad.reason.message) || bad.reason).slice(0, 80)}`; return out; }
    out.cursor = batch[batch.length - 1];
  }
  out.cursor = null;
  return out;
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

/** Has the purge already begun deleting this owner (decision 0173)? Then Undo would
 *  bring back an account with half its documents gone, so it is refused. */
export async function purgeStarted(owner) {
  const { data } = await readDoc(DELQ, null);
  return !!(data && data.cur && data.cur[owner]);
}

export async function cancelDeletion(aid) {
  if (await purgeStarted(aid)) return { ok: false, error: 'This account is already being deleted.' };
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

/* Purged by the cron, one account per ring, inside PURGE_BUDGET_MS (decision 0173):
   the cron that runs it also starts tonight's shows. The queue entry is removed
   LAST, so a crash halfway simply retries: deleting a blob that is already gone is
   a no-op and mutateArtists on a row that has gone is harmless. Purge must be
   re-runnable. `cur[owner]` is set before the first delete — it is what refuses
   Undo from then on — and carries the key the walk reached from ring to ring. */
export async function purgeDue(now = Date.now(), limit = 1, budgetMs = PURGE_BUDGET_MS()) {
  const deadline = Date.now() + budgetMs;
  const { data } = await readDoc(DELQ, null);
  const due = Object.entries((data && data.by) || {}).filter(([, at]) => Number(at) <= now).slice(0, limit);
  const cur = (data && data.cur) || {};
  const done = [], going = [];
  const mark = (owner, key) => casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => {
    if (!d.by || !d.by[owner]) return false;
    (d.cur ||= {})[owner] = { at: (d.cur[owner] && d.cur[owner].at) || Date.now(), key: key || null };
    return true;
  }).catch(() => {});
  for (const [owner] of due) {
    const from = (cur[owner] && cur[owner].key) || null;
    if (!cur[owner]) await mark(owner, null);
    let r;
    try {
      if (String(owner).startsWith('v_')) {
        const { deleteVenue } = await import('./_venueaccount.mjs');
        r = await deleteVenue(owner.slice(2), { deadline, from });
      } else {
        r = await deleteArtist(owner, { deadline, from });
      }
    } catch (e) { console.error('purge failed for', owner, e && e.message); continue; }
    if (r && r.partial) {
      if (r.error) console.error('purge stopped for', owner, '—', r.error, '— the next ring carries on');
      await mark(owner, r.cursor);
      going.push(owner);
      continue;
    }
    done.push(owner);
    await casDoc(DELQ, () => ({ v: 1, by: {} }), (d) => {
      if (!d.by || !d.by[owner]) return false;
      delete d.by[owner]; if (d.cur) delete d.cur[owner];
      return true;
    }).catch(() => {});
  }
  return { purged: done, going };
}

/* `from` and `deadline` come from purgeDue (above); a direct call deletes the lot. */
export async function deleteArtist(aid, { deadline = Infinity, from = null } = {}) {
  if (aid === DEFAULT_ARTIST) return { ok: false, error: 'The founding account cannot be deleted from here.' };
  /* The first ring takes the account out of everything that is not its own: billing,
     the city and schedule indexes, the payout index, the ID queue, the featured
     spots. A ring that carries on a walk has done all of that already. */
  if (!from) {
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
    /* Featured spots live in per-CITY documents this artist's key list cannot name,
       so they are released from the artist's own receipt list before it is deleted —
       otherwise a gone artist keeps a paid spot at the top of a city's night for ever. */
    try { const { dropAllFor } = await import('./_featured.mjs'); await dropAllFor(aid); } catch {}
  }
  const namers = new Set();
  const keys = await keysFor(aid, namers);
  /* Leaves first, the index last (0im); a clip's bytes leave R2 with its key. */
  const w = await eraseKeys(keys, namers, { deadline, from });
  if (w.partial) return { ok: true, partial: true, cursor: w.cursor, error: w.error, deleted: w.gone };
  const gone = w.gone;
  await mutateArtists((reg) => {
    const me = reg.byId[aid];
    if (me && me.slug && reg.bySlug[me.slug] === aid) delete reg.bySlug[me.slug];
    for (const [e, v] of Object.entries(reg.byEmail)) if (v.artistId === aid) delete reg.byEmail[e];
    delete reg.byId[aid];
    return true;
  });
  return { ok: true, deleted: gone };
}
