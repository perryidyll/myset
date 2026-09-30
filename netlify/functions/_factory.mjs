import { createHash, createHmac } from 'node:crypto';
import { authSecret, cleanSlug } from './_auth.mjs';
import { parseMedia } from './_embeds.mjs';
import { safeLink } from './_profile.mjs';
import { parseSeed, classifyUrl, youtube, ytThumbs, readSite, musicBrainz, itunesArtist, nominatim,
         fetchImage, ldSummary, clean, norm, ctxOf, regionName, LINK_KINDS } from './_fsrc.mjs';
import { discover, extractFacts, judgePhotos, pickPhotos, writeCopy, estimateCost, modelFast, modelSmart } from './_fai.mjs';

/* THE SAMPLE FACTORY (decision 0101): one seed line in — "The Tide Lines | @thetidelines
   | thetidelines.com | Koh Phangan" — and out comes one sample page's worth of content,
   the createSample payload (_sample.mjs), or a plain reason why not.

   ONE JOB, EIGHT STAGES, each reported as it starts so the console's bar moves:
     seed 5 · suppress 8 · discover 20 · collect 45 · facts 60 · photos 78 · copy 90 · gate 96
   It runs inside factory-background.mjs (fifteen minutes at most) and never throws:
   every failure comes back as { ok:false, error }, `fatal` when trying again is
   pointless (no key, no name, a seed with nothing in it).

   NOTHING INVENTED, EVERYTHING SOURCED. The page is a stranger's first look at what
   MySet made of them, so it may be thin but it may not be wrong:
     · the seed's own links always win; a link Claude found goes on only at a
       confidence of 0.5 or more, a link on their own website only when it is plainly
       theirs (named in the site's JSON-LD, or a handle that is their name or the seed's)
     · every fact cites the numbered sources it was read from — the pages fetched, the
       YouTube channel, MusicBrainz, OpenStreetMap, and the founder's own note, which is
       labelled as exactly that — and every bio sentence cites its facts (_fai.mjs)
     · view and subscriber counts are never shown to the model, so no line can quote one

   SUPPRESSION. Somebody who pressed Remove is never built again. The seed's identifiers
   are checked before anything is fetched, again once discovery has found more, and a
   last time on the finished payload — whose `supIds` are what Remove will suppress.

   THE GATE. Weighted checks give a score from 0 to 1. Review is asked for below 0.85,
   when the identity is under 0.85, or when no photo passed; the founder's `auto`
   setting decides what happens to the rest (_sample.mjs createSample). */

export const STAGES = { seed: 5, suppress: 8, discover: 20, collect: 45, facts: 60, photos: 78, copy: 90, gate: 96 };
/* The queue (factory.mjs writes it; factory-background.mjs and factorycron.mjs work it). */
export const QKEY = 'factoryq';
export const emptyQ = () => ({ v: 1, jobs: [], day: '', started: 0 });
export const STUCK_MS = 20 * 60e3;          // a worker is stopped at fifteen minutes; twenty means it is gone
export const MAX_TRIES = 2;
/** The worker's door key: only this server can compute it. */
export async function factoryKey() { return createHmac('sha256', await authSecret()).update('factory').digest('base64url'); }

const SOCIAL = ['instagram', 'facebook', 'tiktok', 'youtube'];
const STREAMING = ['spotify', 'applemusic', 'bandcamp', 'soundcloud'];
/* Hosts many people share: never an identifier for suppression (one person's Remove
   must not suppress everybody with a Linktree). */
const SHARED_HOSTS = new Set(['linktr.ee', 'sites.google.com', 'beacons.ai', 'lnk.bio', 'linkin.bio', 'bio.link', 'solo.to', 'tap.bio',
  'campsite.bio', 'taplink.cc', 'allmylinks.com', 'hoo.be', 'lnk.to', 'fanlink.to', 'ffm.to', 'song.link', 'album.link', 'smarturl.it', 'bfan.link', 'feature.fm']);
const squash = (v) => norm(v).replace(/ /g, '');
const nameLike = (h, name) => {
  const a = squash(h), n = squash(name), m = squash(String(name || '').replace(/^the\s+/i, ''));
  return a.length >= 3 && m.length >= 3 && (a.includes(m) || m.includes(a) || a.includes(n));
};

/** The identifiers a seed and what was found about it answer to, lower-cased: page
 *  address, name|city, Instagram handle, YouTube channel id and @handle, website host.
 *  _sample.mjs hashes these for Remove and for isSuppressed, so both sides must agree
 *  on this exact spelling. */
export function suppressIds(seed = {}, result = {}) {
  const out = [];
  const add = (v) => { const s = String(v || '').replace(/\s+/g, ' ').trim().toLowerCase(); if (s && !out.includes(s)) out.push(s); };
  const name = clean(result.name || seed.name, 60), city = clean(result.city || seed.city, 60);
  if (name) { add(cleanSlug(name)); add(`${name}|${city}`); }
  add(result.slug);
  for (const src of [seed, result]) {
    const L = src.links || {}, Hd = src.handles || {}, yt = classifyUrl(L.youtube) || {};
    add(Hd.ig || (classifyUrl(L.instagram) || {}).handle);
    add(src.ytId || src.channelId || yt.id);
    const yh = Hd.yt || yt.handle || yt.custom;
    if (yh) add(`@${String(yh).replace(/^@/, '')}`);
    const w = classifyUrl(L.website);
    if (w && w.kind === 'website' && !SHARED_HOSTS.has(w.host)) add(w.host);
  }
  return out;
}

/** A link of kind `k` in its canonical https form, through the profile's own allowlist
 *  where it has one — or '' when it is not that kind of profile at all. */
export function linkFor(k, url) {
  const c = classifyUrl(url);
  if (!c) return '';
  if (k === 'website' && c.kind === 'linktree') return c.url;             // all some acts have
  if (c.kind !== k || !/^https:\/\//.test(c.url)) return '';
  return ['spotify', 'applemusic', 'instagram', 'bandcamp', 'website'].includes(k) ? safeLink(k, c.url) : c.url;
}
function addFound(st, k, url, from, conf = 1) {
  if (!LINK_KINDS.includes(k) || !url || st.links[k]) return;              // the seed's link, or an earlier find, stands
  const v = linkFor(k, url);
  if (!v) { st.dropped.push({ k, url: clean(url, 200), from }); return; }
  if (conf < 0.5) { st.held.push({ k, url: v, from, why: `identity ${conf}` }); return; }
  st.links[k] = v; st.from[k] = from;
}
/* The act's own website's links to its own profiles. A band's site also links the bar
   it plays, the photographer and whoever built the site, so a social link counts only
   when the site says it is the same act (JSON-LD sameAs, rel="me") or its handle is the
   act's name or the seed's handle; a streaming artist link on their own site is their
   music. Everything else waits in `held` for discovery to confirm. */
function siteLinks(st, site, from) {
  const mineH = [st.seed.handles.ig, st.seed.handles.yt].filter(Boolean);
  for (const l of (site && site.ok && site.links) || []) {
    const k = l.kind === 'linktree' ? 'website' : l.kind;
    if (!LINK_KINDS.includes(k) || k === 'google') continue;
    if (l.me || (l.handle && (mineH.includes(l.handle) || nameLike(l.handle, st.name))) || (STREAMING.includes(k) && st.kind === 'artist')) addFound(st, k, l.url, from);
    else if (!st.links[k]) st.held.push({ k, url: l.url, from, why: 'on their site, not plainly theirs' });
  }
}

function seedOf(job) {
  const s = job && job.seed;
  const line = typeof s === 'string' ? s : (s && (s.line || s.raw)) || '';
  const seed = parseSeed(line);
  if (s && typeof s === 'object') {                          // a seed with fields: they win over the line's reading
    if (s.name) seed.name = clean(s.name, 80);
    if (s.city) seed.city = clean(s.city, 60);
    if (s.country) seed.country = clean(s.country, 60);
    const x = parseSeed(Object.values(s.links || {}).join(' | '));
    for (const [k, v] of Object.entries(x.links)) if (v && !seed.links[k]) seed.links[k] = v;
    for (const k of ['ig', 'yt']) seed.handles[k] ||= x.handles[k];
    for (const k of ['ytId', 'ytUser', 'ytVideo']) seed[k] ||= x[k];
    seed.media.push(...x.media);
  }
  seed.photos = [].concat((s && s.photos) || []).map(String).filter((u) => /^https:\/\/\S+$/.test(u)).slice(0, 6);
  seed.line = line;
  return seed;
}
const resultOf = (st) => ({ name: st.name, city: st.city, links: st.links, handles: { ig: (classifyUrl(st.links.instagram) || {}).handle || '' },
  channelId: st.yt && st.yt.ok ? st.yt.channel.id : '' });

/* Identity: the model's confidence, and at least one of its anchors must be something
   the FOUNDER gave — a handle, a link, the channel, the city. The name alone never is. */
function seedAnchors(seed) {
  const a = [];
  for (const h of [seed.handles.ig, seed.handles.yt, seed.ytId]) if (h) a.push({ t: 'handle', v: h });
  for (const u of Object.values(seed.links)) { const c = u && classifyUrl(u); if (c) a.push({ t: 'link', v: c.url, host: c.host || '', handle: c.handle || c.id || '' }); }
  if (seed.city) a.push({ t: 'city', v: seed.city });
  return a;
}
function anchorHit(a, s) {
  const v = squash(a.value);
  if (!v || a.type === 'name') return false;
  if (s.t === 'city') return !!norm(s.v) && norm(a.value).includes(norm(s.v));
  if (s.t === 'handle') return squash(s.v).length >= 3 && v.includes(squash(s.v));
  const c = classifyUrl(a.value);
  return (!!c && c.url === s.v) || (!!s.host && v.includes(squash(s.host))) || (squash(s.handle).length >= 3 && v.includes(squash(s.handle)));
}
function identityOf(st) {
  const id = st.d.identity, seedA = seedAnchors(st.seed);
  const matched = id.anchors.filter((a) => seedA.some((s) => anchorHit(a, s))).map((a) => `${a.type}:${a.value}`);
  return { confidence: id.confidence, anchors: id.anchors, matched, notes: id.notes, ok: id.confidence >= 0.8 && matched.length >= 1 };
}

/** The gate, as a pure function of what was built (exported for the tests). */
export function qualityOf(q) {
  const venue = q.kind === 'venue';
  const W = venue ? { name: 1, identity: 2, cover: 2, photos: 1, about: 2, tagline: 1, links: 1, place: 1 }
                  : { name: 1, identity: 2, cover: 2, avatar: 1, bio: 2, tagline: 1, links: 1, media: 1 };
  const L = q.links || {}, nLinks = Object.values(L).filter(Boolean).length;
  const checks = { name: !!q.name, identity: !!(q.identity && q.identity.ok), cover: !!q.cover, tagline: !!q.tagline,
    links: nLinks >= 2 && SOCIAL.some((k) => L[k]),
    ...(venue ? { photos: (q.extras || 0) >= 1, about: (q.sentences || 0) >= 2, place: !!q.place }
              : { avatar: !!q.avatar, bio: (q.sentences || 0) >= 2, media: (q.media || 0) >= 1 }) };
  const total = Object.values(W).reduce((a, b) => a + b, 0);
  const score = Math.round((Object.entries(W).reduce((a, [k, w]) => a + (checks[k] ? w : 0), 0) / total) * 100) / 100;
  const anyPhoto = !!(q.cover || q.avatar || q.extras);
  return { score, checks, review: score < 0.85 || !q.identity || q.identity.confidence < 0.85 || !anyPhoto, failed: Object.keys(W).filter((k) => !checks[k]) };
}

/** First name for a person, the whole name for a band — every "Support <First>" on the
 *  site reads it. Split only a solo act's plain two- or three-word personal name. */
export function splitName(name, actType) {
  const n = clean(name, 60), w = n.split(' ');
  const personal = actType === 'solo' && w.length >= 2 && w.length <= 3 && w.every((x) => /^\p{Lu}[\p{Ll}'’.-]+$/u.test(x))
    && !/\b(the|dj|mc|band|trio|duo|quartet|collective|project|orchestra|ensemble|brothers|sisters|and)\b|&/i.test(n);
  return personal ? { first: w[0], last: w.slice(1).join(' ') } : { first: n, last: '' };
}
const actTypeOf = (facts, d) => {
  const t = (facts.find((f) => f.k === 'act_type') || {}).v || '';
  return /\bsolo\b|singer[- ]songwriter/i.test(t) ? 'solo' : /\bduo\b/i.test(t) ? 'duo' : /\b(band|trio|quartet|group)\b/i.test(t) ? 'band' : (d && d.actType) || '';
};

/* Venue amenities: OpenStreetMap's own tags, and sourced facts that say it in so many
   words. Every key is one of AMENITIES in _venues.mjs. */
const OSM_AM = [['outdoor', (t) => t.outdoor_seating === 'yes'], ['wifi', (t) => /^(wlan|yes|wifi)$/.test(t.internet_access || '')],
  ['wheelchair', (t) => t.wheelchair === 'yes'], ['cards', (t) => ['payment:cards', 'payment:credit_cards', 'payment:debit_cards'].some((k) => t[k] === 'yes')],
  ['livemusic', (t) => t.live_music === 'yes'], ['smoking', (t) => /^(outside|separated|isolated|yes)$/.test(t.smoking || '')],
  ['dogs', (t) => /^(yes|leashed)$/.test(t.dog || '')], ['veg', (t) => /^(yes|only)$/.test(t['diet:vegan'] || t['diet:vegetarian'] || '')],
  ['aircon', (t) => t.air_conditioning === 'yes'], ['happyhour', (t) => !!t.happy_hours], ['craftbeer', (t) => t.microbrewery === 'yes']];
const FACT_AM = [['seaview', /\b(sea|ocean) ?views?\b|\bbeach ?front\b/i], ['pooltable', /\bpool table|\bbilliards?\b/i], ['happyhour', /\bhappy hour/i],
  ['cocktails', /\bcocktails?\b/i], ['craftbeer', /\bcraft beers?\b/i], ['livemusic', /\blive music\b/i], ['wifi', /\bwi-?fi\b/i], ['veg', /\bvegan\b|\bvegetarian\b/i],
  ['dogs', /\bdog[- ]friendly\b/i], ['food', /\bkitchen\b|\bfull menu\b/i], ['aircon', /\bair[- ]?con/i], ['parking', /\bparking\b/i], ['dancefloor', /\bdance ?floor\b/i],
  ['sports', /\b(sports?|football) on (the )?(big )?screens?\b|\bsports bar\b/i], ['latenight', /\bopen late\b|\blate[- ]night\b/i], ['family', /\bfamily[- ]friendly\b/i],
  ['smoking', /\bsmoking area\b/i], ['sound', /\bpa system\b|\bbackline\b|\bhouse pa\b/i], ['outdoor', /\boutdoor (seating|terrace|garden)\b|\bbeer garden\b/i]];
function amenitiesOf(tags, facts) {
  const out = new Set(OSM_AM.filter(([, f]) => f(tags || {})).map(([k]) => k));
  for (const f of facts) if (['amenity', 'food', 'drinks', 'music_nights', 'venue_type', 'other'].includes(f.k)) for (const [k, re] of FACT_AM) if (re.test(f.v)) out.add(k);
  return [...out];
}

/** A Google Maps search link: a plain link, never the Places API. */
export const mapsLink = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean(q, 200))}`;

/* OSM (and schema.org) opening hours → the venue page's seven days. Only the simple
   form — "Mo-Fr 17:00-01:00; Sa,Su 12:00-02:00; Tu off" — is read; anything richer
   (holidays, months, split shifts, "+") is left out rather than guessed. Days a rule
   does not name are closed, as OSM means them. */
const OSM_DAY = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'], OUR_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export function parseHours(raw) {
  const s = clean(raw, 300);
  if (!s) return null;
  const out = Object.fromEntries(OUR_DAY.map((d) => [d, { closed: true, open: '17:00', close: '01:00' }]));
  let open = false;
  for (const rule of s.split(/\s*;\s*/).filter(Boolean)) {
    const m = /^([A-Za-z,\s-]+?)\s+(off|closed|(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2}))$/i.exec(rule);
    if (!m) return null;
    const days = [];
    for (const part of m[1].toLowerCase().split(',').map((x) => x.trim())) {
      const r = /^([a-z]{2})(?:\s*-\s*([a-z]{2}))?$/.exec(part);
      const a = r ? OSM_DAY.indexOf(r[1]) : -1, z = r ? OSM_DAY.indexOf(r[2] || r[1]) : -1;
      if (a < 0 || z < 0) return null;
      for (let i = a; ; i = (i + 1) % 7) { days.push(i); if (i === z) break; }     // Sa-Mo wraps the week
    }
    if (/^(off|closed)$/i.test(m[2])) { for (const d of days) out[OUR_DAY[d]].closed = true; continue; }
    if (+m[3] > 24 || +m[5] > 29 || +m[4] > 59 || +m[6] > 59) return null;       // OSM writes 2 am the next day as 26:00
    const hh = (h, mm) => `${String(h % 24).padStart(2, '0')}:${mm}`;
    for (const d of days) out[OUR_DAY[d]] = { closed: false, open: hh(+m[3], m[4]), close: hh(+m[5], m[6]) };
    open = true;
  }
  return open ? out : null;
}

async function mapLimit(items, n, fn) {
  const out = new Array(items.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) { const i = next++; try { out[i] = await fn(items[i]); } catch { out[i] = null; } }
  }));
  return out.filter(Boolean);
}

/* ---------- the stages ---------- */
function gathered(st) {
  const g = {};
  if (st.yt && st.yt.ok) g.youtube = { channel: st.yt.channel.title, handle: st.yt.channel.handle, country: st.yt.channel.country,
    about: clean(st.yt.channel.description, 400), videos: st.yt.videos.slice(0, 5).map((v) => v.title) };
  if (st.site && st.site.ok) g.website = { url: st.site.url, title: st.site.pages[0].title, description: clean(st.site.pages[0].description, 300),
    profileLinks: st.site.links.map((l) => l.url).slice(0, 12) };
  return g;
}
async function collect(st, ctx) {
  const conf = st.d.identity.confidence, sure = (k) => st.from[k] !== 'discover' || conf >= 0.8;
  if (!(st.yt && st.yt.ok) && st.links.youtube && sure('youtube')) {
    const c = classifyUrl(st.links.youtube) || {};
    st.yt = await youtube({ ytId: c.id || '', handles: { yt: c.handle || c.custom || '' }, ytUser: c.user || '' }, ctx);
  }
  if (!(st.site && st.site.ok) && (classifyUrl(st.links.website) || {}).kind === 'website' && sure('website')) {
    st.site = await readSite(st.links.website, ctx, st.kind).catch(() => ({ ok: false, error: 'failed' }));
    if (st.site.ok) siteLinks(st, st.site, 'site');
  }
  if (st.kind === 'artist' && st.name) {
    st.mb = await musicBrainz(st.name, { country: st.country, city: st.city, links: st.links }, ctx);
    if (st.mb) for (const [k, u] of Object.entries(st.mb.links)) addFound(st, k, u, 'musicbrainz');
    // Apple Music by name alone only for a name few acts share, and only the one exact match
    if (!st.links.applemusic && (norm(st.name).split(' ').length >= 2 || squash(st.name).length >= 8)) {
      st.it = await itunesArtist(st.name, ctx);
      if (st.it) addFound(st, 'applemusic', st.it.url, 'itunes');
    }
  }
  if (st.kind === 'venue' && st.name) {
    const n = norm(st.name);
    const list = await nominatim([st.name, st.city, st.country].filter(Boolean).join(', '), ctx);
    st.osm = list.find((p) => p.name && (norm(p.name) === n || (n.length >= 5 && norm(p.name).includes(n)))) || null;
    if (st.osm) {
      const handleUrl = (v, base) => (!v ? '' : /^https?:\/\//.test(v) ? v : `${base}${String(v).replace(/^@/, '')}`);
      addFound(st, 'website', st.osm.website, 'osm', 0.8);
      addFound(st, 'instagram', handleUrl(st.osm.instagram, 'https://www.instagram.com/'), 'osm', 0.8);
      addFound(st, 'facebook', handleUrl(st.osm.facebook, 'https://www.facebook.com/'), 'osm', 0.8);
      st.city ||= st.osm.city; st.country ||= st.osm.country;
    }
  }
}
/* The numbered sources the facts are read from. View counts and subscriber numbers are
   left out on purpose: they change daily and no page should quote them. */
function sourceTexts(st) {
  const out = [];
  const add = (kind, url, title, text) => { if (clean(text, 60).length >= 20) out.push({ kind, url: url || '', title: clean(title, 140), text: String(text).slice(0, 14000) }); };
  add('seed', '', 'The founder’s note', [st.seed.name && `Name given by the founder: ${st.seed.name}`,
    st.seed.city && `Where the founder came across them: ${[st.seed.city, st.seed.country].filter(Boolean).join(', ')}`].filter(Boolean).join('\n'));
  for (const p of (st.site && st.site.ok && st.site.pages) || []) add('website', p.url, p.title, [p.description, ldSummary(p.ld), p.text].filter(Boolean).join('\n'));
  if (st.yt && st.yt.ok) {
    const c = st.yt.channel;
    add('youtube', c.url, `YouTube · ${c.title}`, [`YouTube channel: ${c.title}${c.handle ? ` (@${c.handle})` : ''}`, c.country && `Channel country: ${regionName(c.country)}`,
      c.description && `About: ${c.description}`, 'Videos:',
      ...st.yt.videos.map((v) => `- "${v.title}"${v.published ? ` (${new Date(v.published).toISOString().slice(0, 10)})` : ''}${v.description ? ` — ${clean(v.description, 240)}` : ''}`)].filter(Boolean).join('\n'));
  }
  if (st.mb) add('musicbrainz', st.mb.url, `MusicBrainz · ${st.mb.name}`, [`MusicBrainz artist: ${st.mb.name}${st.mb.disambiguation ? ` (${st.mb.disambiguation})` : ''}`,
    st.mb.type && `Type: ${st.mb.type}`, st.mb.country && `Country: ${regionName(st.mb.country)}`, st.mb.area && `Area: ${st.mb.area}`,
    st.mb.begin && `Began: ${st.mb.begin}${st.mb.beginArea ? ` in ${st.mb.beginArea}` : ''}`].filter(Boolean).join('\n'));
  if (st.osm) {
    const p = st.osm;
    add('osm', p.osmUrl, '© OpenStreetMap contributors (ODbL)', [`${p.name}: ${p.amenity || p.cat}${p.address ? ` at ${p.address}` : ''}`, p.phone && `Phone: ${p.phone}`,
      p.hours && `Opening hours: ${p.hours}`, ...Object.entries(p.tags || {}).filter(([k]) => /^(outdoor_seating|live_music|cuisine|diet:|internet_access|wheelchair|smoking|dog|air_conditioning|happy_hours|microbrewery|capacity|start_date)/.test(k))
        .map(([k, v]) => `${k}: ${clean(v, 80)}`)].filter(Boolean).join('\n'));
  }
  return out;
}

/* ---------- photos: YouTube first, then the website, then what the founder added ---------- */
const img = (r) => ({ bytes: r.bytes, type: r.type, width: r.width, height: r.height });
async function ytCandidates(st, ctx) {
  if (!(st.yt && st.yt.ok)) return [];
  const jobs = [];
  for (const v of st.yt.videos.slice(0, 3)) for (const t of ytThumbs(v.id).slice(0, 3)) jobs.push({ ...t, vid: v.id, note: `from the video "${clean(v.title, 60)}"` });
  if (st.yt.channel.avatar) jobs.push({ url: st.yt.channel.avatar, variant: 'avatar', note: 'the channel picture' });
  return mapLimit(jobs, 4, async (t) => {
    let r = await fetchImage(t.url, ctx), variant = t.variant;
    if (!r.ok && t.fallback) { r = await fetchImage(t.fallback, ctx); variant = 'hqdefault'; }
    if (!r.ok || Math.max(r.width, r.height) < 300) return null;
    // a thumbnail is kept as a reference, never as bytes, once the page is archived (YouTube's 30-day rule)
    return { from: 'youtube', group: t.vid ? `yt:${t.vid}` : 'yt:avatar', ...img(r), note: t.note,
             src: { yt: t.vid ? { id: t.vid, variant } : { channel: st.yt.channel.id, variant } } };
  });
}
async function webCandidates(st, ctx) {
  // a venue's page wants five photos besides its cover (0129), so it looks at more of its site
  const jobs = ((st.site && st.site.ok && st.site.images) || []).slice(0, st.kind === 'venue' ? 16 : 9);
  if (st.yt && st.yt.ok && st.yt.channel.banner) jobs.push({ url: st.yt.channel.banner, banner: true });
  return mapLimit(jobs, 4, async (t) => {
    const r = await fetchImage(t.url, { ...ctx, alts: t.alts || [] });
    if (!r.ok || Math.max(r.width, r.height) < 300) return null;
    return t.banner ? { from: 'youtube', group: 'yt:banner', ...img(r), note: 'the channel banner', src: { yt: { channel: st.yt.channel.id, variant: 'banner' } } }
                    : { from: 'website', group: `web:${r.url}`, ...img(r), note: '', src: { url: r.url, page: t.page || '' } };
  });
}
async function founderCandidates(st, ctx) {
  return mapLimit(st.seed.photos || [], 3, async (u) => {
    const r = await fetchImage(u, ctx);
    if (!r.ok || Math.max(r.width, r.height) < 300) return null;
    const from = /cdninstagram\.com|fbcdn\.net/i.test(u) ? 'instagram' : 'founder';
    return { from, group: `${from}:${r.url}`, ...img(r), note: 'a photo the founder picked', src: { url: r.url } };
  });
}
async function choosePhotos(st, ctx, { late }) {
  const judged = [], seen = new Set();
  let picks = { cover: null, avatar: null, extras: [] };
  const enough = () => picks.cover && (st.kind === 'venue' || picks.avatar) && picks.extras.length >= (st.kind === 'venue' ? 5 : 2);
  for (const [p, round] of [['y', ytCandidates], ['w', webCandidates], ['f', founderCandidates]]) {
    if (enough() || (judged.length && late())) break;
    // the same picture twice (og:image and an <img>) is judged once; over 8000 px the vision API refuses it
    const cands = (await round(st, ctx)).filter((c) => Math.max(c.width, c.height) <= 8000)
      .filter((c) => { const h = createHash('sha1').update(c.bytes).digest('hex'); return !seen.has(h) && seen.add(h); })
      .map((c, i) => ({ ...c, id: `${p}${i + 1}` }));
    if (!cands.length) continue;
    try { judged.push(...(await judgePhotos(cands, ctx, { kind: st.kind, name: st.name })).judged); }
    catch (e) { if (e.code === 'no-key' || e.code === 'auth') throw e; st.errors.photos = clean(e.message, 160); continue; }
    picks = pickPhotos(judged, { kind: st.kind });
  }
  return { judged, picks };
}

/* ---------- the payload ---------- */
function buildPayload(st, { facts, sources, copy, shots, usage, ctx }) {
  const venue = st.kind === 'venue', L = st.links, { picks, judged } = shots;
  const shot = (j) => ({ bytes: j.bytes, type: j.type, focus: j.focus, from: j.from, src: j.src, score: Math.round(j.quality * 100) / 100, why: j.why, width: j.width, height: j.height });
  const photos = {};
  if (picks.cover) photos.cover = shot(picks.cover);
  if (!venue && picks.avatar) photos.avatar = shot(picks.avatar);
  picks.extras.slice(0, venue ? 5 : 3).forEach((j, i) => { photos[`p${i}`] = shot(j); });
  const media = [];
  if (!venue) {
    const add = (url, title = '') => { if (url && parseMedia(url) && !media.some((m) => m.url === url)) media.push({ url, hero: false, title: clean(title, 120) }); };
    for (const u of st.seed.media) add(u);                                   // what the founder pasted leads
    for (const v of (st.yt && st.yt.ok ? st.yt.videos : [])) if (media.length < 6) add(`https://www.youtube.com/watch?v=${v.id}`, v.title);
    const h = media.findIndex((m) => parseMedia(m.url).provider === 'youtube');
    if (h >= 0) { media[h].hero = true; media.unshift(media.splice(h, 1)[0]); }
    const sp = parseMedia(L.spotify), am = parseMedia(L.applemusic);
    if (sp && sp.type === 'artist') add(L.spotify);
    else if (am && am.type === 'artist' && st.from.applemusic !== 'itunes') add(L.applemusic);   // a name match alone is not enough to feature
  }
  const identity = identityOf(st);
  const ld = ((st.site && st.site.ok && st.site.ld) || []).find((n) => /LocalBusiness|BarOrPub|NightClub|Restaurant|Food|Cafe|MusicVenue|Entertainment|Hotel/.test(n.type)) || {};
  const o = st.osm || {};
  const address = clean(o.address || ld.address, 160);
  const mapUrl = L.google || mapsLink([st.name, address || st.city, st.country].filter(Boolean).join(', '));
  const links = venue ? { website: L.website, instagram: L.instagram, facebook: L.facebook, google: mapUrl }
    : { instagram: L.instagram, spotify: L.spotify, applemusic: L.applemusic, ytmusic: '', bandcamp: L.bandcamp, gofundme: '', website: L.website,
        tiktok: L.tiktok, youtube: L.youtube, soundcloud: L.soundcloud, facebook: L.facebook };
  const quality = qualityOf({ kind: st.kind, name: st.name, identity, cover: !!photos.cover, avatar: !!photos.avatar, extras: picks.extras.length,
    sentences: copy.sentences.length, tagline: copy.tagline.text, links, media: media.length, place: !!(address || o.lat != null || ld.lat) });
  const ref = (x) => (x ? { f: x.f, src: x.src } : null);
  const photoRef = (p) => `${p.from}${p.src && p.src.yt ? `:${p.src.yt.id || p.src.yt.channel}/${p.src.yt.variant}` : ''}`;
  const slug = cleanSlug(st.name);
  const payload = {
    kind: st.kind, name: clean(st.name, venue ? 70 : 60), slug,
    tagline: copy.tagline.text, city: clean(st.city, 60), country: clean(st.country, 60),
    links, media, photos, sources,
    facts: { items: facts, copy: { tagline: ref(copy.tagline), style: ref(copy.style), text: copy.sentences, hook: ref(copy.hook) } },
    provenance: { links: st.from, held: st.held.slice(0, 20), dropped: st.dropped.slice(0, 20), identity,
      photos: Object.fromEntries(Object.entries(photos).map(([slot, p]) => [slot, photoRef(p)])),
      judged: judged.map((j) => ({ id: j.id, from: j.from, kind: j.kind, isAct: j.isAct, quality: j.quality, textOverlay: j.textOverlay,
        coverOk: j.coverOk, avatarOk: j.avatarOk, dup: j.dup, why: j.why, w: j.width, h: j.height })),
      youtube: st.yt ? (st.yt.ok ? { channel: st.yt.channel.id, from: st.yt.from, units: st.yt.units, videos: st.yt.total } : { error: st.yt.error }) : null,
      website: st.site ? (st.site.ok ? { url: st.site.url, pages: st.site.pages.length } : { error: st.site.error }) : null,
      musicbrainz: st.mb ? { mbid: st.mb.mbid, why: st.mb.why } : null, itunes: st.it ? { id: st.it.id } : null,
      osm: st.osm ? { url: st.osm.osmUrl, attribution: '© OpenStreetMap contributors, ODbL' } : null,
      models: { fast: modelFast(ctx), smart: modelSmart(ctx) }, errors: st.errors, builtAt: ctx.now() },
    quality, msgs: { hook: copy.hook.text }, seed: { ...st.seed, line: st.seed.line },
    supIds: suppressIds(st.seed, { ...resultOf(st), slug }),
    usage: { ...estimateCost(usage), list: usage.map(({ call, model, in: i, out, searches }) => ({ call, model, in: i, out, searches })) },
    by: 'factory',
  };
  if (venue) {
    // hours only when all seven days are known: a guessed "open till one" sends somebody to a shut door
    const hours = parseHours(o.hours) || parseHours(ld.hours);
    return Object.assign(payload, { about: copy.text, address, mapUrl, phone: clean(o.phone || ld.telephone, 28), lat: o.lat ?? ld.lat ?? null,
      lng: o.lng ?? ld.lng ?? null, amenities: amenitiesOf(o.tags, facts), ...(hours ? { hours } : {}),
      ...(st.site && st.site.ok && st.site.menu ? { menuUrl: st.site.menu } : {}) });
  }
  const { first, last } = splitName(st.name, actTypeOf(facts, st.d));
  return Object.assign(payload, { first, last, style: copy.style.text, bio: copy.text });
}

/** One job → { ok, payload, usage } | { ok:false, skipped } | { ok:false, error, fatal? }.
 *  opts: fetch, lookup, sleep, now (a clock or a time), env, onStage(stage, pct),
 *  isSuppressed(ids) — without which nothing is built. Never throws. */
export async function runJob(job, opts = {}) {
  const env = opts.env || process.env, usage = [];
  const now = typeof opts.now === 'function' ? opts.now : opts.now != null ? () => Number(opts.now) : () => Date.now();
  if (!env.ANTHROPIC_API_KEY) return { ok: false, error: 'no-key', fatal: true, usage };
  const ctx = ctxOf({ fetch: opts.fetch, lookup: opts.lookup, sleep: opts.sleep, now, env, usage, ytKey: env.YOUTUBE_API_KEY || '' });
  const kind = job && job.kind === 'venue' ? 'venue' : 'artist';
  const stage = async (s) => { try { if (opts.onStage) await opts.onStage(s, STAGES[s]); } catch {} };
  const t0 = now(), late = () => now() - t0 > 11 * 60e3;            // past eleven minutes, no optional photo round starts
  try {
    await stage('seed');
    const seed = seedOf(job);
    if (!seed.name && !Object.values(seed.links).some(Boolean) && !seed.media.length) return { ok: false, error: 'empty-seed', fatal: true, usage };

    await stage('suppress');
    let check = opts.isSuppressed;
    if (typeof check !== 'function') { try { check = (await import('./_sample.mjs')).isSuppressed; } catch { check = null; } }
    if (typeof check !== 'function') return { ok: false, error: 'no-suppression-check', fatal: true, usage };
    if (await check(suppressIds(seed))) return { ok: false, skipped: 'suppressed', usage };

    await stage('discover');
    const st = { seed, kind, name: seed.name, city: seed.city, country: seed.country, links: { ...seed.links }, from: {}, held: [], dropped: [], errors: {} };
    for (const [k, v] of Object.entries(st.links)) if (v) st.from[k] = 'seed';
    const lt = !st.links.website && seed.extra.map(classifyUrl).find((c) => c && c.kind === 'linktree');
    if (lt) { st.links.website = lt.url; st.from.website = 'seed'; }
    if (seed.ytId || seed.handles.yt || seed.ytUser || seed.ytVideo) st.yt = await youtube(seed, ctx);
    if ((classifyUrl(st.links.website) || {}).kind === 'website') {
      st.site = await readSite(st.links.website, ctx, kind).catch(() => ({ ok: false, error: 'failed' }));
      if (st.site.ok) { st.links.website = linkFor('website', st.site.url) || linkFor('website', st.links.website); siteLinks(st, st.site, 'site'); }
    }
    try { st.d = await discover({ ...seed, kind }, gathered(st), ctx); }
    catch (e) { if (e.code === 'no-key' || e.code === 'auth') throw e; st.errors.discover = clean(e.message, 160); }
    st.d ||= { name: '', links: {}, identity: { confidence: 0, anchors: [], notes: 'discovery failed' }, city: '', country: '', actType: '' };
    for (const [k, u] of Object.entries(st.d.links)) addFound(st, k, u, 'discover', st.d.identity.confidence);
    st.name ||= st.d.name || (st.yt && st.yt.ok ? st.yt.channel.title : '');
    st.city ||= st.d.city; st.country ||= st.d.country;
    if (await check(suppressIds(seed, resultOf(st)))) return { ok: false, skipped: 'suppressed', usage };

    await stage('collect');
    await collect(st, ctx);
    const texts = sourceTexts(st);
    const sources = texts.map(({ kind: k, url, title }) => ({ url, kind: k, title }));

    await stage('facts');
    const facts = await extractFacts(texts, ctx, { kind, name: st.name });
    st.name ||= (facts.find((f) => f.k === 'name') || {}).v || '';
    if (!st.name) return { ok: false, error: 'no-name: nothing read says what they are called', fatal: true, usage };

    await stage('photos');
    const shots = await choosePhotos(st, ctx, { late });

    await stage('copy');
    // better a clear "try again" now than the platform's kill at fifteen minutes mid-write
    if (now() - t0 > 13 * 60e3) return { ok: false, error: 'timeout: the build ran past thirteen minutes', usage };
    const copy = await writeCopy(facts, sources, kind, ctx, { name: st.name });

    await stage('gate');
    const payload = buildPayload(st, { facts, sources, copy, shots, usage, ctx });
    if (await check(payload.supIds)) return { ok: false, skipped: 'suppressed', usage };
    return { ok: true, payload, usage };
  } catch (e) {
    const code = e && e.code;
    return { ok: false, error: clean(code ? `${code}: ${e.message}` : (e && e.message) || e, 200), fatal: code === 'no-key' || code === 'auth', usage };
  }
}
