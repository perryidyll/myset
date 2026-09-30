import { createHash } from 'node:crypto';
import { casDoc, readDoc, store, mutateShow, cleanArtistId, DEFAULT_ARTIST } from './_lib.mjs';
import { readArtists, mutateArtists, cleanSlug, RESERVED } from './_auth.mjs';

/* SAMPLE PROFILES — a page the factory builds for an artist or a venue who has never
   heard of MySet, handed to them as one private link, theirs the moment they claim it
   (decision 0101).

   A SAMPLE IS A REAL ACCOUNT THAT IS NOT ON THE LIST YET. Its page, its Studio and its
   photos live under the same keys any account's do — `profile_<aid>`, `show_<aid>`,
   `vprofile_<vid>` — so the real page draws it and the real Studio opens on it. What
   it does not have is a row in `artists` or `venues`. It is registered here, in
   `samplereg`, and that one fact does most of the work:

     · every public door asks `publicArtist` / `venueBySlug`, which read `artists` /
       `venues` — so a sample 404s on voting, paying, the community page, the QR
       code, the share card and every listing BY CONSTRUCTION, not because each door
       remembered a check
     · no walk over the registry — the metrics, the sheet, the register, the artists
       directory, the daily heal — can ever count one
     · the registry every phone in a room reads on every poll does not grow by a
       byte however many samples exist (INVARIANT 0ci, test/cost.mjs)
     · claiming adds ONE row to `artists` and takes this one away. Nothing is copied
       and nothing moves: the data was always under the account's own keys.

   THE LINK. myset.vip/<slug>#sample-profile (a venue: /v/<slug>#sample-profile). The
   words after the # are a label, the same on every page, and not a secret (the
   founder's call, 2026-09-28: a link ending in twelve random characters looks like
   spam and does not get tapped). So the address alone opens a sample and the
   address alone can claim it. What stands between a stranger and somebody else's
   page is the founder's push on every claim and the fourteen-day undo on the
   console. The bare address, without the label, is the ordinary "no such page",
   so a fan typing a band's name never lands on a page that is not published. A
   name somebody already has gets a word after it (-music, -live), never a number.

   THE CLOCK. Thirty days to claim. Then the page is taken down: a private snapshot
   goes to `samplearc_<owner>` and the live data is erased, and the snapshot is kept
   one hundred and eighty days so a second campaign can bring it back at the same
   address. Nobody taps anything to say no: every message says "let us know", and
   the founder's Delete forever erases everything at once and puts the act on the
   suppression list, which the factory checks before it ever builds them again.

   Everything here keyed by an OWNER string: an artist id, or `v_<venueId>`, the same
   convention the sessions and the images use (INVARIANT 0cw). */

export const SAMPLE_LIFE_MS = 30 * 86400e3;
export const ARCHIVE_MS = 180 * 86400e3;
export const UNDO_MS = 14 * 86400e3;
const REG = 'samplereg', ARC = 'samplearc', SUP = 'samplesup', STAT = 'samplestat';
export const SAMPLE = (owner) => `sample_${owner}`;
export const ARCDOC = (owner) => `samplearc_${owner}`;
export const isVenueOwner = (o) => String(o || '').startsWith('v_');

const emptyReg = () => ({ v: 1, byId: {}, bySlug: {}, vbySlug: {} });
export async function readSampleReg() {
  const { data } = await readDoc(REG, null);
  const r = { ...emptyReg(), ...(data || {}) };
  r.byId ||= {}; r.bySlug ||= {}; r.vbySlug ||= {};
  return r;
}
export const mutateSampleReg = (fn) =>
  casDoc(REG, emptyReg, (r) => { r.v ||= 1; r.byId ||= {}; r.bySlug ||= {}; r.vbySlug ||= {}; return fn(r); });

/* ---------- the key ----------
   The label the link carries (see THE LINK above). The plumbing still calls it the
   key: the page keeps it, the Studio sends it as x-sample-key and the claim carries
   it, so a secret could come back later without new doors. Today the door checks
   only that it is the label, and a wrong label and an unknown page answer the same. */
export const SAMPLE_MARK = 'sample-profile';
export async function sampleKey() { return SAMPLE_MARK; }
const normKey = (k) => String(k || '').trim().toLowerCase().replace(/^#/, '');
export const ownerOfSlug = (reg, slug, kind = 'artist') => {
  const s = cleanSlug(slug);
  if (!s) return null;
  if (kind === 'venue') return reg.vbySlug[s] ? `v_${reg.vbySlug[s]}` : null;
  return reg.bySlug[s] || null;
};
/** The page's link for a row: its address, then the label after the #. */
export async function linkFor(owner, row) {
  const site = process.env.URL || 'https://myset.vip';
  return { key: SAMPLE_MARK, link: `${site}/${isVenueOwner(owner) ? 'v/' : ''}${row.slug}#${SAMPLE_MARK}` };
}

/** Is there a sample at this address, asked for with the label? A wrong label and an
 *  unknown address answer the same (null). */
export async function verifySample(slug, key, kind = 'artist') {
  if (normKey(key) !== SAMPLE_MARK) return null;
  const reg = await readSampleReg();
  const owner = ownerOfSlug(reg, slug, kind);
  const row = owner ? reg.byId[owner] : null;
  if (!row) return null;
  return { owner, row };
}

/* ---------- names ----------
   A sample holds its page address the way an account does, so a signup can never be
   handed a name a sample is using (and a claim never has to rename anybody). The
   artist and venue name-pickers read `sampleSlugs()` once, outside their CAS, and
   pass it in. */
export async function sampleSlugs(kind = 'artist') {
  const r = await readSampleReg();
  if (kind === 'venue') return new Set([...Object.keys(r.vbySlug),
    ...Object.keys(r.byId).filter(isVenueOwner).map((o) => o.slice(2))]);
  return new Set([...Object.keys(r.bySlug), ...Object.keys(r.byId).filter((o) => !isVenueOwner(o))]);
}
async function pickSampleSlug(kind, wanted, name) {
  const [arts, sreg] = await Promise.all([readArtists(), readSampleReg()]);
  let vreg = { bySlug: {}, byId: {} }, VRES = new Set();
  if (kind === 'venue') {
    const V = await import('./_venues.mjs');
    vreg = await V.readVenues();
    VRES = V.VRESERVED || new Set();
  }
  const free = (v) => {
    if (kind === 'venue') return !VRES.has(v) && !vreg.bySlug[v] && !vreg.byId[v] && !((vreg.oldSlug || {})[v]) && !sreg.vbySlug[v] && !sreg.byId[`v_${v}`];
    return !RESERVED.has(v) && !arts.bySlug[v] && !arts.byId[v] && !((arts.oldSlug || {})[v]) && !sreg.bySlug[v] && !sreg.byId[v];
  };
  /* A revive or a rebuild asks for its old address and keeps it while it is free; if
     it went, it starts again from the bare name rather than stacking a second word
     on the first (thetidelines-music-live). */
  const want = cleanSlug(wanted);
  if (want.length >= 3 && free(want)) return want;
  let base = (want ? want.replace(new RegExp(`-(${SLUG_WORDS[kind].join('|')})\\d*$`), '') : cleanSlug(name)) || (kind === 'venue' ? 'venue' : 'artist');
  if (base.length < 3) base += kind === 'venue' ? 'bar' : 'live';
  base = base.slice(0, 28);
  if (free(base)) return base;
  /* A name somebody already has gets a word, never a number (the founder's call,
     2026-09-28): thetidelines-music reads like a band, thetidelines2 like a typo.
     The cut keeps every address inside the 32 characters cleanSlug allows. */
  const cut = (w) => `${base.slice(0, 31 - w.length).replace(/-+$/, '')}-${w}`;
  for (const w of SLUG_WORDS[kind]) if (free(cut(w))) return cut(w);
  for (let i = 2; i < 500; i++) if (free(cut(`${SLUG_WORDS[kind][0]}${i}`))) return cut(`${SLUG_WORDS[kind][0]}${i}`);
  return null;
}
const SLUG_WORDS = { artist: ['music', 'live', 'band', 'official'], venue: ['live', 'music', 'venue', 'official'] };

/* ---------- suppression ----------
   "Remove" means for good: the act's identifiers are kept as hashes, and the factory
   refuses any seed that hits one. Hashes, not the strings, because a list of people
   who said no is exactly the list that should say nothing if it ever leaked. */
const hid = (v) => createHash('sha256').update(`myset-sup|${String(v || '').trim().toLowerCase()}`).digest('hex').slice(0, 32);
export async function suppress(ids) {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return;
  await casDoc(SUP, () => ({ v: 1, by: {} }), (d) => { d.by ||= {}; for (const v of list) d.by[hid(v)] = Date.now(); return true; }).catch(() => {});
}
export async function isSuppressed(ids) {
  const { data } = await readDoc(SUP, null);
  const by = (data && data.by) || {};
  return (ids || []).filter(Boolean).some((v) => !!by[hid(v)]);
}

/* ---------- the funnel ----------
   Counters per calendar month, one small document, written best-effort: a counter
   that misses a beat must never be why a claim fails. */
export async function bump(event, n = 1) {
  const m = new Date().toISOString().slice(0, 7);
  await casDoc(STAT, () => ({ v: 1, m: {} }), (d) => {
    d.m ||= {}; d.m[m] ||= {};
    d.m[m][event] = (d.m[m][event] || 0) + n;
    return true;
  }).catch(() => {});
}
export async function readStats() { const { data } = await readDoc(STAT, null); return (data && data.m) || {}; }

/** One line on a sample's own timeline, best-effort. */
export function noteSample(owner, e, m = '') {
  return casDoc(SAMPLE(owner), () => ({ v: 1, owner, events: [] }), (d) => {
    d.events ||= [];
    d.events.push({ t: Date.now(), e: String(e).slice(0, 24), ...(m ? { m: String(m).slice(0, 120) } : {}) });
    if (d.events.length > 60) d.events = d.events.slice(-60);
    return true;
  }).catch(() => {});
}
/* The founder hears about the moments that matter, on the phone that already gets
   MySet's pushes. Never awaited by anything a visitor is waiting on. */
export async function tellFounder(title, body) {
  try { const { notify } = await import('./_push.mjs'); await notify(DEFAULT_ARTIST, { title, body, url: '/factory', tag: 'samples' }, { owner: true }); } catch {}
}
/* CRM's contacts follow their page (decision 0108): every place a page goes, or moves to
   a new owner id, tells the CRM here. Best-effort and last: a CRM hiccup is never why a
   take-down, a delete or a rebuild fails. */
async function tellCrm(what, ...args) {
  try { const C = await import('./_crm.mjs'); await C[what](...args); } catch (e) { console.error('crm:', what, 'failed', e && e.message); }
}

/* ---------- the factory's settings ----------
   `auto`: a page that passes the quality check goes straight to Ready; off, every
   page waits for the founder's look (the founder's call, 2026-09-28: review in the
   beginning, never a hard rule). `perDay`: how many builds may start in a UTC day —
   the ceiling on what Claude costs. `signoff` and `address` go on the drafts (a
   commercial email must carry a postal address). */
const CFG = 'factorycfg';
export const defaultFactoryCfg = () => ({ auto: false, perDay: 40, signoff: 'The MySet team', address: '' });
export async function readFactoryCfg() { const { data } = await readDoc(CFG, null); return { ...defaultFactoryCfg(), ...(data || {}) }; }
export const mutateFactoryCfg = (fn) => casDoc(CFG, defaultFactoryCfg, fn);

/* ---------- building one ----------
   `payload` is the factory's output (or the founder's hand-made one): see
   SAMPLES-DESIGN in the decision record. Photos arrive as bytes; media as links that
   are parsed and checked exactly as the Studio's "Add" does (parseMedia + lookup),
   so a sample can hold nothing an artist could not have pasted themselves. */
const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const PHOTO_SLOTS = ['cover', 'avatar', 'p0', 'p1', 'p2'];

export async function createSample(payload = {}, { fetchMedia = true } = {}) {
  const kind = payload.kind === 'venue' ? 'venue' : 'artist';
  const name = clean(payload.name || [payload.first, payload.last].filter(Boolean).join(' '), kind === 'venue' ? 70 : 60);
  if (!name) return { ok: false, error: 'A sample needs a name.' };
  /* A REBUILD (`replace`: the owner it replaces) takes the old page's place: the old
     one is erased first so its address is free and the new one takes it, so a link
     already sent opens the new page. Only a page nobody has claimed. */
  if (payload.replace) {
    const old = (await readSampleReg()).byId[payload.replace];
    if (old && old.st !== 'claiming') {
      payload = { ...payload, slug: payload.slug || old.slug, cp: old.cp };
      await eraseData(payload.replace);
      await mutateSampleReg((r) => dropRow(r, payload.replace));
    }
  }
  const { newSampleNs, putImage, decodeDataUrl } = await import('./_img.mjs');
  const ns = newSampleNs();                          // outside every CAS: a retry keeps it
  /* Ready, or waiting for a look: a hand-made page is the founder's look already;
     a factory page waits unless auto is on AND the quality check passed. */
  const cfg = await readFactoryCfg();
  const review = payload.by === 'founder' ? false : (!cfg.auto || !!(payload.quality && payload.quality.review));

  /* The address. Picked against every registry that holds names, then written into
     samplereg inside a CAS that refuses it if it was taken in the meantime. */
  let slug = null, owner = null, taken = false;
  for (let attempt = 0; attempt < 4 && !owner; attempt++) {
    const s = await pickSampleSlug(kind, payload.slug, name);
    if (!s) return { ok: false, error: 'Couldn’t find a free page address.' };
    const id = kind === 'venue' ? s : (cleanArtistId(s) || s);
    const o = kind === 'venue' ? `v_${id}` : id;
    const now = Date.now();
    taken = false;
    await mutateSampleReg((r) => {
      if (r.byId[o] || (kind === 'venue' ? r.vbySlug[s] : r.bySlug[s])) { taken = true; return false; }
      r.byId[o] = { k: kind === 'venue' ? 'v' : 'a', slug: s, name, at: now, exp: now + SAMPLE_LIFE_MS,
                    st: review ? 'review' : 'ready', cp: Number(payload.cp) || 1,
                    q: Math.round((Number(payload.quality && payload.quality.score) || 0) * 100) / 100,
                    rv: review, ns, city: clean(payload.city, 60),
                    // the CRM contact that asked for it, so its summary links it and never adopts it twice
                    ...(/^c[a-f0-9]{10}$/.test(String(payload.cid || '')) ? { cid: payload.cid } : {}) };
      if (kind === 'venue') r.vbySlug[s] = id; else r.bySlug[s] = id;
      return true;
    });
    if (!taken) { slug = s; owner = o; }
  }
  if (!owner) return { ok: false, error: 'Couldn’t hold a page address — try again.' };
  if (payload.replace && owner !== payload.replace) await tellCrm('relinkOwner', payload.replace, owner);

  /* The photos, under the sample's own unguessable name (see SAMPLE_NS in _img.mjs). */
  const shots = {};
  const photoMeta = [];
  for (const slot of PHOTO_SLOTS) {
    const ph = payload.photos && payload.photos[slot];
    if (!ph) continue;
    let bytes = ph.bytes, type = ph.type;
    if (!bytes && ph.dataUrl) { const d = decodeDataUrl(ph.dataUrl); if (d.error) continue; bytes = d.bytes; type = d.type; }
    if (!bytes || !/^image\/(jpeg|png|webp)$/.test(String(type || ''))) continue;
    if (bytes.length > 900 * 1024) continue;
    const url = await putImage(ns, slot, Buffer.from(bytes), type);
    shots[slot] = { url, focus: ph.focus || '' };
    photoMeta.push({ slot, from: clean(ph.from, 20), src: ph.src || null, score: Number(ph.score) || null,
                     why: clean(ph.why, 80), focus: ph.focus || '', url });
  }

  if (kind === 'artist') {
    const { mutateProfile, parseMedia } = await import('./_profile.mjs');
    const { lookup } = await import('./_embeds.mjs');
    const media = [];
    for (const it of (payload.media || []).slice(0, 24)) {
      const m = parseMedia(it && it.url);
      if (!m) continue;
      const info = fetchMedia ? await lookup(m) : { ok: true, title: it.title || '', thumb: '' };
      if (!info.ok) continue;
      if (media.some((x) => x.provider === m.provider && x.id === m.id && (x.list || null) === (m.list || null))) continue;
      media.push({ mid: 'm' + Math.random().toString(36).slice(2, 9), ...m,
                   title: clean(it.title || info.title, 120), thumb: String(info.thumb || '').slice(0, 300), hero: !!it.hero });
    }
    await mutateProfile(owner, (p) => {
      p.first = clean(payload.first || name, 60);
      p.last = clean(payload.last, 60);
      p.name = name;
      p.tagline = clean(payload.tagline, 120);
      p.style = clean(payload.style, 60);
      p.bio = String(payload.bio || '').replace(/\r/g, '').slice(0, 700);
      p.links = { ...p.links, ...(payload.links || {}) };
      p.media = media;
      if (shots.cover) p.photo = shots.cover.url;
      if (shots.avatar) p.avatar = shots.avatar.url;
      p.photos = ['p0', 'p1', 'p2'].map((k) => (shots[k] ? shots[k].url : '')).filter(Boolean);
      p.focus = { cover: (shots.cover && shots.cover.focus) || '', avatar: (shots.avatar && shots.avatar.focus) || '' };
      return true;
    });
    /* The Studio's header reads the name off the show record when the registry has
       none — and a sample is not in the registry. */
    await mutateShow(owner, (s) => { s.artist = name; s.artistFirst = clean(payload.first || name, 60); return true; }).catch(() => {});
  } else {
    const vid = owner.slice(2);
    const { mutateVenueProfile } = await import('./_venues.mjs');
    await mutateVenueProfile(vid, (p) => {
      p.name = name;
      p.tagline = clean(payload.tagline, 120);
      p.about = String(payload.about || payload.bio || '').replace(/\r/g, '').slice(0, 900);
      p.city = clean(payload.city, 60);
      p.country = clean(payload.country, 60);
      if (payload.address) p.address = clean(payload.address, 160);
      if (payload.mapUrl) p.mapUrl = String(payload.mapUrl).slice(0, 300);
      if (payload.lat != null) p.lat = Number(payload.lat);
      if (payload.lng != null) p.lng = Number(payload.lng);
      if (payload.phone) p.phone = payload.phone;
      if (Array.isArray(payload.amenities)) p.amenities = payload.amenities;
      if (payload.hours && typeof payload.hours === 'object') p.hours = { ...p.hours, ...payload.hours };
      p.links = { ...p.links, ...(payload.links || {}) };
      if (shots.cover) p.photo = shots.cover.url;
      p.photos = ['p0', 'p1', 'p2'].map((k) => (shots[k] ? shots[k].url : '')).filter(Boolean);
      return true;
    });
  }

  await casDoc(SAMPLE(owner), () => ({ v: 1 }), (d) => {
    Object.assign(d, {
      v: 1, owner, kind, slug, name, first: clean(payload.first || name, 60), ns,
      seed: payload.seed || null, sources: (payload.sources || []).slice(0, 60),
      facts: payload.facts || null, provenance: payload.provenance || null,
      photos: photoMeta, quality: payload.quality || null, msgs: payload.msgs || {},
      supIds: (payload.supIds || []).slice(0, 12), by: payload.by === 'founder' ? 'founder' : 'factory',
      usage: payload.usage || null, events: [{ t: Date.now(), e: 'built', m: payload.by || 'factory' }],
    });
    return true;
  });
  /* The console's card shows a thumbnail; keeping its address on the row saves a
     profile read per card. */
  const cv = (shots.cover || shots.avatar || {}).url || '';
  if (cv) await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].cv = cv; return true; }).catch(() => {});
  await bump('built');
  const row = (await readSampleReg()).byId[owner];
  const { key, link } = await linkFor(owner, row);
  return { ok: true, owner, slug, key, link, exp: row.exp };
}

/* ---------- a visit ----------
   Called by the public door on every open. The first open is the moment worth a
   push: the founder hears it while the artist is still on the page. */
export async function sampleSeen(owner, what = 'open') {
  const flag = { open: 'o', studio: 's', practice: 'p', claimStart: 'c', clash: 'x' }[what] || null;
  if (!flag) return;
  let first = false, name = '';
  await mutateSampleReg((r) => {
    const row = r.byId[owner];
    if (!row) return false;
    row.f ||= {};
    name = row.name || '';
    if (what === 'open') {
      row.n = (row.n || 0) + 1;
      if (!row.op) { row.op = Date.now(); first = true; if (row.st === 'sent' || row.st === 'ready' || row.st === 'review') row.st = 'opened'; }
      return true;
    }
    if (row.f[flag]) return false;
    row.f[flag] = Date.now(); first = true;
    return true;
  }).catch(() => {});
  if (!first) return;
  const ev = { open: 'opened', studio: 'studio', practice: 'practice', claimStart: 'claimStart', clash: 'clash' }[what];
  await Promise.all([bump(ev), noteSample(owner, ev)]);
  if (what === 'open') await tellFounder('A sample was opened', `${name || 'Someone'} just opened their MySet page.`);
  if (what === 'claimStart') await tellFounder('Somebody is claiming', `${name || 'A sample'} — the claim sheet is open.`);
  /* The inbox they proved already runs a MySet page: two pages for one act, which the
     founder merges by hand. */
  if (what === 'clash') await tellFounder('A claim needs a merge', `${name || 'A sample'} was claimed with an email that already has a MySet page.`);
}

/* ---------- erasing ----------
   The account's own keys (keysFor / keysForVenue, the same lists that erase a
   deleted account), the photos under the sample's own name, and the sample's record.
   Re-runnable: deleting what is already gone is a no-op. */
async function eraseData(owner) {
  const { sampleImgKeys } = await import('./_img.mjs');
  let keys = [];
  let urls = [];
  if (isVenueOwner(owner)) {
    const vid = owner.slice(2);
    const { keysForVenue } = await import('./_venueaccount.mjs');
    const { getVenueProfile } = await import('./_venues.mjs');
    const p = await getVenueProfile(vid).catch(() => ({}));
    urls = [p.photo, ...(p.photos || [])];
    keys = await keysForVenue(vid).catch(() => []);
  } else {
    const { keysFor } = await import('./_account.mjs');
    const { getProfile } = await import('./_profile.mjs');
    const p = await getProfile(owner).catch(() => ({}));
    urls = [p.photo, p.avatar, ...(p.photos || [])];
    keys = await keysFor(owner).catch(() => []);
  }
  keys.push(...sampleImgKeys(urls), SAMPLE(owner));
  let gone = 0;
  for (const k of new Set(keys)) { try { await store().delete(k); gone++; } catch {} }
  return gone;
}
function dropRow(r, owner) {
  const row = r.byId[owner];
  if (!row) return false;
  if (isVenueOwner(owner)) { if (r.vbySlug[row.slug] === owner.slice(2)) delete r.vbySlug[row.slug]; }
  else if (r.bySlug[row.slug] === owner) delete r.bySlug[row.slug];
  delete r.byId[owner];
  return true;
}

/** Erased now, no snapshot kept. `asked`: they asked for it gone — by reply, by DM or
 *  in person — and the founder pressed Delete forever, so they are suppressed for good
 *  too. `founder`: the founder's own Cancel of a bad build, not suppressed. Nobody
 *  outside the console can call this: the page has no Remove (the founder's call,
 *  2026-09-28), and a door with no secret must not erase anything. */
export async function removeSample(owner, { by = 'asked' } = {}) {
  const { data: rec } = await readDoc(SAMPLE(owner), null);
  const reg = await readSampleReg();
  const row = reg.byId[owner];
  if (!row) return { ok: false, error: 'gone' };
  if (by === 'asked') await suppress([...((rec && rec.supIds) || []), row.slug, `${row.name}|${row.city || ''}`]);
  await eraseData(owner);
  await mutateSampleReg((r) => dropRow(r, owner));
  await bump(by === 'asked' ? 'removed' : 'cancelled');
  await tellCrm(by === 'asked' ? 'forgetOwner' : 'unlinkOwner', owner, ...(by === 'asked' ? [] : ['page cancelled']));
  return { ok: true };
}

/** Delete forever: the act said no, by reply or in person. Whatever is left of them
 *  goes (the live page, or the copy kept after it came down), and they are suppressed
 *  for good: the promise every message makes, "we'll delete this preview forever". */
export async function optOut(owner) {
  const live = (await readSampleReg()).byId[owner];
  if (live) return removeSample(owner, { by: 'asked' });
  const { data: snap } = await readDoc(ARCDOC(owner), null);
  if (!snap) return { ok: false, error: 'gone' };
  const row = snap.row || {};
  await suppress([...(((snap.record || {}).supIds) || []), row.slug, `${row.name}|${row.city || ''}`]);
  await store().delete(ARCDOC(owner)).catch(() => {});
  await casDoc(ARC, () => ({ v: 1, byOwner: {} }), (d) => { if (!d.byOwner || !d.byOwner[owner]) return false; delete d.byOwner[owner]; return true; }).catch(() => {});
  await bump('removed');
  await tellCrm('forgetOwner', owner);
  return { ok: true };
}

/* ---------- the take-down, and the copy kept for a second campaign ----------
   The snapshot holds what the page was made of: the profile document, the name on
   the show record, the photos' bytes — except a YouTube thumbnail, which is kept as
   a reference and fetched again on revival, because YouTube's terms allow its data
   to be stored for thirty days and no longer. */
export async function archiveSample(owner, now = Date.now()) {
  const reg = await readSampleReg();
  const row = reg.byId[owner];
  if (!row) return { ok: false, error: 'gone' };
  const { data: rec } = await readDoc(SAMPLE(owner), null);
  const { getImage } = await import('./_img.mjs');
  let profile = null;
  if (isVenueOwner(owner)) { const { getVenueProfile } = await import('./_venues.mjs'); profile = await getVenueProfile(owner.slice(2)); }
  else { const { getProfile } = await import('./_profile.mjs'); profile = await getProfile(owner); }
  const images = [];
  for (const ph of (rec && rec.photos) || []) {
    if (ph.src && ph.src.yt) { images.push({ slot: ph.slot, yt: ph.src.yt, focus: ph.focus || '' }); continue; }
    const img = await getImage(row.ns, ph.slot).catch(() => null);
    if (img && img.bytes && img.bytes.length <= 900 * 1024)
      images.push({ slot: ph.slot, type: img.type, b64: img.bytes.toString('base64'), focus: ph.focus || '' });
  }
  const until = now + ARCHIVE_MS;
  await casDoc(ARCDOC(owner), () => ({ v: 1 }), (d) => {
    Object.assign(d, { v: 1, owner, row, record: rec || null, profile, images, arc: now, until });
    return true;
  });
  await casDoc(ARC, () => ({ v: 1, byOwner: {} }), (d) => {
    d.byOwner ||= {};
    d.byOwner[owner] = { k: row.k, slug: row.slug, name: row.name, arc: now, until, cp: row.cp || 1, why: 'expired', city: row.city || '' };
    return true;
  });
  await eraseData(owner);
  await mutateSampleReg((r) => dropRow(r, owner));
  await bump('expired');
  return { ok: true, until };
}
export async function readArchive() { const { data } = await readDoc(ARC, null); return (data && data.byOwner) || {}; }

/** A second campaign: the snapshot comes back, at its old address while that is free,
 *  with thirty more days. */
export async function reviveSample(owner, { fetch: F = globalThis.fetch } = {}) {
  const { data: snap } = await readDoc(ARCDOC(owner), null);
  if (!snap || !snap.row) return { ok: false, error: 'Nothing archived under that name.' };
  const kind = isVenueOwner(owner) ? 'venue' : 'artist';
  const photos = {};
  for (const im of snap.images || []) {
    if (im.b64) { photos[im.slot] = { bytes: Buffer.from(im.b64, 'base64'), type: im.type, focus: im.focus, from: 'archive' }; continue; }
    if (im.yt && /^[A-Za-z0-9_-]{11}$/.test(im.yt.id || '')) {
      const variant = /^(maxresdefault|hqdefault|sddefault|maxres[1-3]|hq[1-3])$/.test(im.yt.variant || '') ? im.yt.variant : 'hqdefault';
      try {
        const r = await F(`https://i.ytimg.com/vi/${im.yt.id}/${variant}.jpg`);
        if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); if (b.length && b.length <= 900 * 1024) photos[im.slot] = { bytes: b, type: 'image/jpeg', focus: im.focus, from: 'youtube', src: { yt: im.yt } }; }
      } catch {}
    }
  }
  const p = snap.profile || {};
  const rec = snap.record || {};
  const payload = kind === 'venue'
    ? { kind, name: p.name || snap.row.name, slug: snap.row.slug, tagline: p.tagline, about: p.about, city: p.city, country: p.country,
        address: p.address, mapUrl: p.mapUrl, lat: p.lat, lng: p.lng, phone: p.phone, amenities: p.amenities, hours: p.hours, links: p.links }
    : { kind, name: p.name || snap.row.name, first: p.first, last: p.last, slug: snap.row.slug, tagline: p.tagline, style: p.style, bio: p.bio,
        links: p.links, media: (p.media || []).map((m) => ({ url: m.provider === 'youtube' && m.id ? `https://www.youtube.com/watch?v=${m.id}` : (m.href || ''), hero: m.hero, title: m.title })) };
  const made = await createSample({ ...payload, photos, cp: (snap.row.cp || 1) + 1, seed: rec.seed, sources: rec.sources, facts: rec.facts,
    provenance: rec.provenance, quality: rec.quality, msgs: rec.msgs, supIds: rec.supIds, by: 'founder' }, { fetchMedia: true });
  if (!made.ok) return made;
  await store().delete(ARCDOC(owner)).catch(() => {});
  await casDoc(ARC, () => ({ v: 1, byOwner: {} }), (d) => { if (!d.byOwner || !d.byOwner[owner]) return false; delete d.byOwner[owner]; return true; }).catch(() => {});
  await bump('revived');
  await noteSample(made.owner, 'revived', `campaign ${(snap.row.cp || 1) + 1}`);
  if (made.owner !== owner) await tellCrm('relinkOwner', owner, made.owner);
  return made;
}

/* ---------- the clock ----------
   Called by factorycron. Take down what reached thirty days, then erase snapshots
   that reached one hundred and eighty. A few at a time: nothing here is urgent, and a
   ring must never run long. Re-runnable if it dies halfway. */
export async function sweepSamples(now = Date.now(), limit = 5) {
  const reg = await readSampleReg();
  const due = Object.entries(reg.byId).filter(([, r]) => Number(r.exp) <= now && r.st !== 'claiming')
    .sort((a, b) => a[1].exp - b[1].exp).slice(0, limit);
  const archived = [];
  for (const [owner] of due) {
    try { await archiveSample(owner, now); archived.push(owner); } catch (e) { console.error('sample archive failed for', owner, e && e.message); }
  }
  const arc = await readArchive();
  const old = Object.entries(arc).filter(([, a]) => Number(a.until) <= now).slice(0, limit);
  const erased = [];
  for (const [owner] of old) {
    try {
      await store().delete(ARCDOC(owner)).catch(() => {});
      await casDoc(ARC, () => ({ v: 1, byOwner: {} }), (d) => { if (!d.byOwner || !d.byOwner[owner]) return false; delete d.byOwner[owner]; return true; });
      erased.push(owner);
      await tellCrm('unlinkOwner', owner, 'its kept copy was erased after 180 days');
    } catch (e) { console.error('sample erase failed for', owner, e && e.message); }
  }
  /* A claim's undo window closes: the record that made undo possible goes. */
  const closed = Object.entries(reg.claimed || {}).filter(([, c]) => now - Number(c.at) > UNDO_MS).slice(0, limit).map(([o]) => o);
  for (const o of closed) {
    await casDoc(SAMPLE(o), () => ({ v: 1, owner: o }), (d) => { if (!d.claimedRow) return false; delete d.claimedRow; return true; }).catch(() => {});
  }
  if (closed.length) await mutateSampleReg((r) => { let hit = false; for (const o of closed) if (r.claimed && r.claimed[o]) { delete r.claimed[o]; hit = true; } return hit; }).catch(() => {});
  return { archived, erased, closed };
}

/* ---------- claiming ----------
   The ticket (proof of the inbox) and the label (a sample at this address) are
   checked by the caller; this does the move. Order matters, because two documents change:
     1. the sample is marked `claiming` — the clock will not take it down mid-claim
     2. ONE write to `artists`: the row, the address, the owner's email
     3. the sample row goes
   If 2 fails, 1 is undone and nothing else changed. If 3 fails, the account is
   already whole and the stale sample row is harmless — its link opens a page that
   is also a real one — and the next claim attempt or the sweep tidies it. */
export async function claimSampleArtist({ owner, email }) {
  const sreg = await readSampleReg();
  const row = sreg.byId[owner];
  if (!row || isVenueOwner(owner)) return { ok: false, error: 'This sample has gone.' };
  await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].st = 'claiming'; r.byId[owner].claimAt = Date.now(); return true; });
  let err = null, slug = row.slug;
  await mutateArtists((reg) => {
    if (reg.byEmail[email]) { err = 'That address already has a MySet page.'; return false; }
    if (reg.byId[owner]) { err = 'This page has already been claimed.'; return false; }
    /* The address is normally still free — signups skip names a sample holds — but
       a race can take it; then the page gets the next free one rather than failing. */
    if (reg.bySlug[slug] || RESERVED.has(slug)) {
      let i = 2; while (i < 500 && (reg.bySlug[`${row.slug}${i}`] || reg.byId[`${row.slug}${i}`])) i++;
      slug = `${row.slug}${i}`;
    }
    reg.byId[owner] = { slug, name: row.name, createdAt: Date.now(), plan: 'free', referredBy: null,
                        src: 'sample', refSlug: '', sampleAt: row.at, sampleCp: row.cp || 1 };
    reg.bySlug[slug] = owner;
    reg.byEmail[email] = { artistId: owner, role: 'owner' };
    return true;
  });
  if (err) {
    await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].st = r.byId[owner].op ? 'opened' : 'sent'; delete r.byId[owner].claimAt; return true; }).catch(() => {});
    return { ok: false, error: err };
  }
  /* The row goes; one line stays so the founder's console can offer the undo until
     the sweep closes the window. */
  await mutateSampleReg((r) => { dropRow(r, owner); (r.claimed ||= {})[owner] = { slug, name: row.name, at: Date.now() }; return true; }).catch(() => {});
  await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => {
    d.claimedAt = Date.now(); d.claimedBy = email; d.claimedRow = row;
    d.events ||= []; d.events.push({ t: Date.now(), e: 'claimed', m: email.slice(0, 120) });
    return true;
  }).catch(() => {});
  await bump('claimed');
  await tellFounder('A sample was claimed 🎉', `${row.name} claimed myset.vip/${slug} (${email}).`);
  return { ok: true, aid: owner, slug, name: row.name };
}

/** The venue twin of claimSampleArtist: one row in `venues`, then the sample row goes. */
export async function claimSampleVenue({ owner, email }) {
  const sreg = await readSampleReg();
  const row = sreg.byId[owner];
  if (!row || !isVenueOwner(owner)) return { ok: false, error: 'This sample has gone.' };
  const vid = owner.slice(2);
  await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].st = 'claiming'; r.byId[owner].claimAt = Date.now(); return true; });
  const V = await import('./_venues.mjs');
  let err = null, slug = row.slug;
  await V.mutateVenues((reg) => {
    if (reg.byEmail[email]) { err = 'That address already runs a venue page.'; return false; }
    if (reg.byId[vid]) { err = 'This page has already been claimed.'; return false; }
    if (reg.bySlug[slug]) { let i = 2; while (i < 500 && (reg.bySlug[`${row.slug}${i}`] || reg.byId[`${row.slug}${i}`])) i++; slug = `${row.slug}${i}`; }
    reg.byId[vid] = { slug, name: row.name, createdAt: Date.now(), city: row.city || '', country: '',
                      verified: false, verifiedVia: null, verifiedAt: null, plan: 'free', src: 'sample', sampleAt: row.at };
    reg.bySlug[slug] = vid;
    reg.byEmail[email] = { venueId: vid, role: 'owner' };
    return true;
  });
  if (err) {
    await mutateSampleReg((r) => { if (!r.byId[owner]) return false; r.byId[owner].st = r.byId[owner].op ? 'opened' : 'sent'; delete r.byId[owner].claimAt; return true; }).catch(() => {});
    return { ok: false, error: err };
  }
  /* The row goes; one line stays so the founder's console can offer the undo until
     the sweep closes the window. */
  await mutateSampleReg((r) => { dropRow(r, owner); (r.claimed ||= {})[owner] = { slug, name: row.name, at: Date.now() }; return true; }).catch(() => {});
  await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => {
    d.claimedAt = Date.now(); d.claimedBy = email; d.claimedRow = row;
    d.events ||= []; d.events.push({ t: Date.now(), e: 'claimed', m: email.slice(0, 120) });
    return true;
  }).catch(() => {});
  await bump('claimed');
  await tellFounder('A venue sample was claimed 🎉', `${row.name} claimed myset.vip/v/${slug} (${email}).`);
  return { ok: true, vid, slug, name: row.name };
}

/** The founder's fourteen days to put a claim back — the wrong person, a joke, a
 *  bandmate who should have been a seat. Everyone signed in to it is signed out. */
export async function undoClaim(owner) {
  const { data: rec } = await readDoc(SAMPLE(owner), null);
  if (!rec || !rec.claimedAt || Date.now() - rec.claimedAt > UNDO_MS) return { ok: false, error: 'Only a claim from the last fourteen days can be undone.' };
  const row = rec.claimedRow;
  if (!row) return { ok: false, error: 'Nothing to put back.' };
  let emails = [];
  const venue = isVenueOwner(owner), id = venue ? owner.slice(2) : owner;
  const take = (reg) => {
    const me = reg.byId[id];
    if (!me) return false;
    if (me.slug && reg.bySlug[me.slug] === id) delete reg.bySlug[me.slug];
    for (const [e, v] of Object.entries(reg.byEmail)) if ((venue ? v.venueId : v.artistId) === id) { emails.push(e); delete reg.byEmail[e]; }
    delete reg.byId[id];
    return true;
  };
  if (venue) { const { mutateVenues } = await import('./_venues.mjs'); await mutateVenues(take); }
  else await mutateArtists(take);
  try { const { clearPassword } = await import('./_cred.mjs'); for (const e of emails) await clearPassword(owner, e); } catch {}
  try { const { killEverything } = await import('./_session.mjs'); await killEverything(owner).catch(() => {}); } catch {}
  await mutateSampleReg((r) => {
    r.byId[owner] = { ...row, st: 'ready', exp: Date.now() + SAMPLE_LIFE_MS };
    if (r.claimed) delete r.claimed[owner];
    if (venue) r.vbySlug[row.slug] = id; else r.bySlug[row.slug] = owner;
    return true;
  });
  await casDoc(SAMPLE(owner), () => ({ v: 1, owner }), (d) => { delete d.claimedAt; delete d.claimedBy; delete d.claimedRow;
    d.events ||= []; d.events.push({ t: Date.now(), e: 'unclaimed', m: emails.join(', ').slice(0, 120) }); return true; }).catch(() => {});
  return { ok: true, emails };
}
