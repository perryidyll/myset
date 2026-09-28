import { lookup as dnsLookup } from 'node:dns/promises';

/* THE SAMPLE FACTORY'S SOURCES (decision 0101) — where a sample page's facts, links
   and photos come from, read off the public web on the founder's behalf.

   POLITE FIRST, USEFUL SECOND. Everything here:
     · says who it is on every request: MySetBot/1.0 and the site's address, or, for
       the open databases that ask for one, a contact address
     · obeys robots.txt (RFC 9309) before it reads any page — MySetBot's own group if
       the site names us, else the `*` group, longest rule wins — and treats a
       robots.txt it cannot reach as "keep out", which is what the RFC says
     · NEVER reads a page on youtube.com: YouTube's terms forbid automated access, and
       it offers two doors instead — the Data API (with a key) and a channel's RSS feed
       (without one). search.list is never called: at 100 quota units a go it would
       spend the day's quota on a hundred seeds
     · never fetches Instagram, Facebook, TikTok, Linktree or Bandcamp at all. Their
       addresses may come back as LINKS; nothing here ever reads them as pages
     · gives MusicBrainz and Nominatim at most one request a second, as both ask, and
       puts OpenStreetMap's attribution in the sources a page is built from
     · checks every address before it fetches it, hop by hop (three redirects at most),
       so a seed cannot point this server at itself or the network behind it

   Every fetcher takes an options object whose `fetch`, `lookup`, `sleep` and `now`
   can be swapped, so test/factory.mjs runs the real parsers against canned replies
   with no network at all. Nothing here touches Blobs. */

export const BOT_UA = 'MySetBot/1.0 (+https://myset.vip)';
export const API_UA = 'MySet/1.0 ( hello@myset.vip )';
export const IMG_MAX = 900 * 1024;           // _img.mjs MAX_BYTES: what the photo store accepts
const PAGE_MS = 8000;
const PAGE_MAX = 1.5 * 1024 * 1024;
const MAX_HOPS = 3;
const TEXT_MAX = 12000;
export const LINK_KINDS = ['instagram', 'youtube', 'website', 'spotify', 'applemusic', 'soundcloud', 'bandcamp', 'facebook', 'tiktok', 'google'];
export const emptyLinks = () => Object.fromEntries(LINK_KINDS.map((k) => [k, '']));

export const clean = (v, n = 200) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
/** A name as a comparison key: accents, case, punctuation and "&" against "and" do not count. */
export const norm = (v) => String(v || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
const REGION = (() => { try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch { return null; } })();
/** 'TH' → 'Thailand'; anything that is not a region code comes back as it was. */
export const regionName = (cc) => { const c = String(cc || '').toUpperCase(); if (!/^[A-Z]{2}$/.test(c)) return clean(cc, 60); try { return REGION ? REGION.of(c) : c; } catch { return c; } };

export function ctxOf(o = {}) {
  return { ...o,
    fetch: o.fetch || ((...a) => globalThis.fetch(...a)),
    lookup: o.lookup || dnsLookup,
    sleep: o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: typeof o.now === 'function' ? o.now : () => Date.now(),
    robots: o.robots || new Map() };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’',
  ldquo: '“', rdquo: '”', hellip: '…', middot: '·', bull: '•', copy: '©', reg: '®', trade: '™', eacute: 'é', egrave: 'è',
  aacute: 'á', agrave: 'à', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü', ouml: 'ö', auml: 'ä', ccedil: 'ç', szlig: 'ß' };
export const decodeEntities = (s) => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
  if (e[0] === '#') { const n = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  const v = ENT[e.toLowerCase()]; return v === undefined ? m : v;
});

/* ---------- where this server may go ----------
   The same rules as `safeHost` in _verify.mjs, the venue check's fetcher (not exported
   there, and that file is not this batch's to change — one day both should share
   one). A literal private, loopback, link-local or CGNAT address is refused before
   anything is sent; a name is resolved and refused if ANY address it answers with is
   one of those; an IPv6 literal is never a website. A name that resolves public here
   and private a moment later (DNS rebinding) is the gap this cannot close without
   pinning the socket — the reads are capped and nothing read is ever executed. */
const PRIV4 = [[[0], 8], [[10], 8], [[127], 8], [[169, 254], 16], [[172, 16], 12], [[192, 0, 0], 24], [[192, 168], 16],
  [[100, 64], 10], [[198, 18], 15], [[224], 4], [[240], 4]];
function privateV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const v = ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
  return PRIV4.some(([pre, bits]) => { const q = [...pre, 0, 0, 0, 0]; const base = ((q[0] << 24) | (q[1] << 16) | (q[2] << 8) | q[3]) >>> 0; const mask = (0xffffffff << (32 - bits)) >>> 0; return (v & mask) === (base & mask); });
}
function privateV6(ip) {
  const a = String(ip).toLowerCase();
  if (a === '::' || a === '::1' || /^fe[89ab]/.test(a) || /^f[cd]/.test(a)) return true;
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);
  return m ? privateV4(m[1]) : false;
}
export function privateHost(host) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  if (!h || h === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(h)) return true;
  if (h.includes(':') || h.startsWith('[')) return true;                  // any IPv6 literal
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return privateV4(h);
  return !h.includes('.');                                                // 'intranet' only resolves inside somebody's network
}
export async function safeHost(host, lookup = dnsLookup) {
  const h = String(host || '').toLowerCase().replace(/\.$/, '');
  if (privateHost(h)) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return true;
  let addrs; try { addrs = await lookup(h, { all: true, verbatim: true }); } catch { return false; }
  if (!Array.isArray(addrs) || !addrs.length) return false;
  return addrs.every((a) => (a.family === 6 ? !privateV6(a.address) : !privateV4(a.address)));
}

/* ---------- robots.txt (RFC 9309) ---------- */
export function parseRobots(txt) {
  const groups = []; let cur = null, agentRun = false;
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'user-agent') {
      if (!cur || !agentRun) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(val.toLowerCase().split('/')[0].trim()); agentRun = true;
    } else if (key === 'allow' || key === 'disallow') {       // Sitemap and Crawl-delay are neither rules nor group breaks
      agentRun = false;
      if (cur && val) cur.rules.push({ allow: key === 'allow', path: val });
    }
  }
  return groups;
}
const ruleHits = (path, pat) => {
  const end = pat.endsWith('$'), body = end ? pat.slice(0, -1) : pat;
  return new RegExp('^' + body.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (end ? '$' : '')).test(path);
};
/** May `agent` read `path` (path + query)? The most specific matching rule wins; on a tie, Allow. */
export function robotsAllows(txt, path, agent = 'mysetbot') {
  const groups = parseRobots(txt);
  let mine = groups.filter((g) => g.agents.includes(agent));
  if (!mine.length) mine = groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const r of mine.flatMap((g) => g.rules)) {
    if (!ruleHits(path || '/', r.path)) continue;
    if (!best || r.path.length > best.len || (r.path.length === best.len && r.allow)) best = { len: r.path.length, allow: r.allow };
  }
  return !best || best.allow;
}
async function robotsOk(u, o) {
  if (!o.robots.has(u.origin)) {
    const r = await guarded(`${u.origin}/robots.txt`, o, { accept: 'text/plain', max: 256 * 1024, robots: false });
    // 4xx: no rules at all. 5xx or no answer: complete disallow, until next time.
    o.robots.set(u.origin, r.ok ? r.body.toString('utf8') : r.error === 'status' && r.status < 500 ? '' : null);
  }
  const txt = o.robots.get(u.origin);
  return txt !== null && robotsAllows(txt, u.pathname + u.search);
}

/* ---------- the one guarded fetch ----------
   Every hop: http(s) only, a public host, robots.txt when it is a page, a timeout, a
   hard cap on the bytes read (never trusting content-length). `strict` refuses a body
   over the cap instead of cutting it — a photo cut short is not a photo. */
async function guarded(url, o, { accept = '*/*', max = PAGE_MAX, strict = false, robots = true, pagesOnly = false } = {}) {
  let cur = String(url || '');
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let u; try { u = new URL(cur); } catch { return { error: 'bad-url' }; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return { error: 'bad-scheme' };
    u.hash = '';
    if (!(await safeHost(u.hostname, o.lookup))) return { error: 'private-host' };
    if (pagesOnly && (classifyUrl(u.href) || {}).kind !== 'website') return { error: 'not-fetched' };
    if (robots && !(await robotsOk(u, o))) return { error: 'robots' };
    let r;
    try { r = await o.fetch(u.href, { redirect: 'manual', headers: { 'user-agent': BOT_UA, accept }, signal: AbortSignal.timeout(PAGE_MS) }); }
    catch { return { error: 'unreachable' }; }
    const drop = async () => { try { await r.body?.cancel(); } catch {} };      // a body never read still holds a socket
    if (r.status >= 300 && r.status < 400) {
      const to = r.headers.get('location');
      await drop();
      if (!to) return { error: 'redirect' };
      try { cur = new URL(to, u).href; } catch { return { error: 'redirect' }; }
      continue;                                             // and the next pass checks it all again
    }
    if (!r.ok) { await drop(); return { error: 'status', status: r.status }; }
    if (strict && Number(r.headers.get('content-length') || 0) > max) { await drop(); return { error: 'too-big' }; }
    const got = await readCapped(r, max, strict);
    if (!got) return { error: 'unreachable' };
    if (got.tooBig) return { error: 'too-big' };
    return { ok: true, url: u.href, status: r.status, type: (r.headers.get('content-type') || '').toLowerCase(), body: got.buf };
  }
  return { error: 'too-many-redirects' };
}
async function readCapped(r, max, strict) {
  try {
    const reader = r.body && r.body.getReader ? r.body.getReader() : null;
    if (!reader) { const b = Buffer.from(await r.arrayBuffer()); return strict && b.length > max ? { tooBig: true } : { buf: b.subarray(0, max) }; }
    const parts = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(Buffer.from(value)); total += value.length;
      if (total > max) { try { await reader.cancel(); } catch {} if (strict) return { tooBig: true }; break; }
    }
    return { buf: Buffer.concat(parts).subarray(0, max) };
  } catch { return null; }
}
async function getJSON(url, ua, o) {
  const r = await o.fetch(url, { headers: { 'user-agent': ua, accept: 'application/json' }, signal: AbortSignal.timeout(PAGE_MS) });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return r.json();
}
/* One request a second per host, in this instance: MusicBrainz and Nominatim both ask
   for it and both block the ones that don't. Measured from start to start. */
const lastHit = new Map(), turns = new Map();
function paced(host, gap, o, fn) {
  const turn = (turns.get(host) || Promise.resolve()).catch(() => {}).then(async () => {
    const wait = (lastHit.get(host) || 0) + gap - o.now();
    if (wait > 0) await o.sleep(wait);
    lastHit.set(host, o.now());
  });
  turns.set(host, turn);
  return turn.then(fn);
}

/* ---------- what an address is ----------
   A pasted or scraped URL is classified by exact host (the _embeds.mjs rule: never
   `includes`), and a profile address is rebuilt from the handle or id alone, so what
   comes out is always the canonical form and never whatever junk rode along. */
const H = (...a) => new Set(a);
const IG = H('instagram.com', 'www.instagram.com', 'm.instagram.com');
const YT = H('youtube.com', 'www.youtube.com', 'm.youtube.com');
const FB = H('facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'fb.com', 'www.fb.com');
const TT = H('tiktok.com', 'www.tiktok.com', 'm.tiktok.com');
const SC = H('soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com');
const TW = H('twitter.com', 'www.twitter.com', 'mobile.twitter.com', 'x.com', 'www.x.com');
const IG_NOT = H('p', 'reel', 'reels', 'tv', 'explore', 'accounts', 'stories', 'direct', 'about', 'developer', 'legal', 'web', 'privacy', 'terms', 'challenge', 'share');
const FB_NOT = H('sharer', 'sharer.php', 'share', 'share.php', 'dialog', 'plugins', 'tr', 'login', 'login.php', 'photo.php', 'photo', 'watch', 'events', 'groups', 'hashtag', 'help', 'policies', 'privacy', 'l.php', 'story.php', 'permalink.php', 'people');
const SC_NOT = H('discover', 'search', 'upload', 'you', 'pages', 'stream', 'charts', 'mobile', 'signin', 'settings', 'terms-of-use');
const GTLD = H('com', 'net', 'org', 'info', 'biz', 'io', 'co', 'app', 'band', 'music', 'live', 'rocks', 'studio', 'online', 'site', 'xyz', 'club',
  'world', 'store', 'shop', 'art', 'page', 'bio', 'link', 'events', 'bar', 'pub', 'cafe', 'restaurant', 'media', 'website', 'space', 'pro', 'records', 'audio', 'rock', 'jazz');
const ytVid = (id) => (/^[\w-]{11}$/.test(id || '') ? { kind: 'ytvideo', url: `https://www.youtube.com/watch?v=${id}`, id } : null);
const looksLikeDomain = (s) => { const m = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24})(?::\d+)?(?:[/?#]\S*)?$/i.exec(s); return !!m && (m[1].length === 2 || GTLD.has(m[1].toLowerCase())); };

export function classifyUrl(raw) {
  let s = String(raw || '').trim();
  if (!s || s.length > 800) return null;
  if (!/^https?:\/\//i.test(s)) { if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s) || !looksLikeDomain(s)) return null; s = 'https://' + s; }
  let u; try { u = new URL(s); } catch { return null; }
  if ((u.protocol !== 'https:' && u.protocol !== 'http:') || u.username || u.password) return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const seg = u.pathname.split('/').filter(Boolean).map((x) => { try { return decodeURIComponent(x); } catch { return x; } });
  const s0 = (seg[0] || '').toLowerCase();
  if (IG.has(host)) {
    if (!seg[0] || IG_NOT.has(s0) || !/^[\w.]{1,30}$/.test(seg[0])) return null;
    return { kind: 'instagram', url: `https://www.instagram.com/${s0}/`, handle: s0 };
  }
  if (host === 'youtu.be' || host === 'www.youtu.be') return ytVid(seg[0]);
  if (host === 'music.youtube.com') return s0 === 'channel' && /^UC[\w-]{22}$/.test(seg[1] || '') ? { kind: 'ytmusic', url: `https://music.youtube.com/channel/${seg[1]}`, id: seg[1] } : null;
  if (YT.has(host)) {
    if (s0 === 'watch') return ytVid(u.searchParams.get('v'));
    if (['shorts', 'live', 'embed', 'v'].includes(s0)) return ytVid(seg[1]);
    if (/^@[\p{L}\p{M}\p{N}_.-]{3,30}$/u.test(seg[0] || '')) return { kind: 'youtube', url: `https://www.youtube.com/${seg[0]}`, handle: seg[0].slice(1) };
    if (s0 === 'channel' && /^UC[\w-]{22}$/.test(seg[1] || '')) return { kind: 'youtube', url: `https://www.youtube.com/channel/${seg[1]}`, id: seg[1] };
    if ((s0 === 'c' || s0 === 'user') && /^[\w.-]{1,60}$/.test(seg[1] || '')) return { kind: 'youtube', url: `https://www.youtube.com/${s0}/${seg[1]}`, [s0 === 'c' ? 'custom' : 'user']: seg[1] };
    return null;
  }
  if (host === 'open.spotify.com' || host === 'play.spotify.com') {
    let p = seg; if (/^intl-[a-z]{2}$/i.test(p[0] || '')) p = p.slice(1); if (p[0] === 'embed') p = p.slice(1);
    if (!/^[A-Za-z0-9]{22}$/.test(p[1] || '')) return null;
    if (p[0] === 'artist') return { kind: 'spotify', url: `https://open.spotify.com/artist/${p[1]}`, id: p[1] };
    return ['track', 'album', 'playlist'].includes(p[0]) ? { kind: 'spotifymedia', url: `https://open.spotify.com/${p[0]}/${p[1]}` } : null;
  }
  if (host === 'music.apple.com' || host === 'geo.music.apple.com' || host === 'itunes.apple.com') {
    let p = seg, cc = 'us'; if (/^[a-z]{2}$/i.test(p[0] || '')) { cc = p[0].toLowerCase(); p = p.slice(1); }
    const id = p[2] || p[1], name = p[2] ? `${encodeURIComponent(p[1])}/` : '';
    if (!/^\d{3,15}$/.test(id || '')) return null;
    if (p[0] === 'artist') return { kind: 'applemusic', url: `https://music.apple.com/${cc}/artist/${name}${id}`, id };
    return ['album', 'song', 'music-video'].includes(p[0]) ? { kind: 'applemedia', url: `https://music.apple.com/${cc}/${p[0]}/${name}${id}` } : null;
  }
  if (SC.has(host)) return seg[0] && !SC_NOT.has(s0) && /^[\w-]{2,60}$/.test(seg[0]) ? { kind: 'soundcloud', url: `https://soundcloud.com/${s0}`, handle: s0 } : null;
  if (host.endsWith('.bandcamp.com')) {
    const sub = host.slice(0, -13);
    return sub && !sub.includes('.') && !['www', 'daily', 'blog', 'bandcamp'].includes(sub) ? { kind: 'bandcamp', url: `https://${sub}.bandcamp.com/`, handle: sub } : null;
  }
  if (FB.has(host)) {
    if (s0 === 'profile.php') { const id = u.searchParams.get('id'); return /^\d{5,20}$/.test(id || '') ? { kind: 'facebook', url: `https://www.facebook.com/profile.php?id=${id}` } : null; }
    if (s0 === 'pages' && seg[1]) return { kind: 'facebook', url: `https://www.facebook.com/pages/${seg.slice(1, 3).map(encodeURIComponent).join('/')}` };
    return seg[0] && !FB_NOT.has(s0) && /^[\w.-]{2,80}$/.test(seg[0]) ? { kind: 'facebook', url: `https://www.facebook.com/${seg[0]}`, handle: s0 } : null;
  }
  if (TT.has(host)) return /^@[\w.]{2,30}$/.test(seg[0] || '') ? { kind: 'tiktok', url: `https://www.tiktok.com/${s0}`, handle: s0.slice(1) } : null;
  if (host === 'linktr.ee' || host === 'www.linktr.ee') return /^[\w.-]{2,60}$/.test(seg[0] || '') ? { kind: 'linktree', url: `https://linktr.ee/${seg[0]}`, handle: s0 } : null;
  if (TW.has(host)) return /^\w{1,15}$/.test(seg[0] || '') ? { kind: 'twitter', url: `https://x.com/${seg[0]}`, handle: s0 } : null;
  if (host === 'maps.app.goo.gl' || (host === 'goo.gl' && s0 === 'maps') || /^maps\.google\.[a-z.]{2,6}$/.test(host)
      || (/^(www\.)?google\.[a-z.]{2,6}$/.test(host) && s0 === 'maps')) return { kind: 'google', url: u.href.slice(0, 400) };
  if (privateHost(host)) return null;
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|igshid$|mc_[ce]id$)/i.test(k)) u.searchParams.delete(k);
  return { kind: 'website', url: u.href.slice(0, 400), host: host.replace(/^www\./, '') };
}

/* ---------- the seed ----------
   One line from the founder: "The Tide Lines | @thetidelines | youtube.com/@thetidelines
   | thetidelines.com | Koh Phangan" — or any one of those on its own. Addresses and
   @handles are recognised wherever they sit; of the plain words left, the first run
   is the name and the second the place ("City, Country"). A bare @handle is
   Instagram's: that is the handle musicians hand out. */
export function mapsPlaceName(url) {
  const m = /\/maps\/place\/([^/@?]+)/.exec(String(url || ''));
  try { return m ? clean(decodeURIComponent(m[1].replace(/\+/g, ' ')), 80) : ''; } catch { return ''; }
}
function addLink(seed, c) {
  const L = seed.links;
  if (c.kind === 'instagram') { if (!L.instagram) { L.instagram = c.url; seed.handles.ig ||= c.handle; } }
  else if (c.kind === 'youtube') {
    if (L.youtube) return;
    L.youtube = c.url;
    if (c.handle || c.custom) seed.handles.yt = c.handle || c.custom;
    if (c.id) seed.ytId = c.id;
    if (c.user) seed.ytUser = c.user;
  } else if (c.kind === 'ytvideo') { seed.media.push(c.url); seed.ytVideo ||= c.id; }
  else if (c.kind === 'spotifymedia' || c.kind === 'applemedia') seed.media.push(c.url);
  else if (L[c.kind] === '') L[c.kind] = c.url;
  else seed.extra.push(c.url);                             // linktree, x.com, ytmusic, a second website
}
export function parseSeed(line) {
  const raw = String(line == null ? '' : line).slice(0, 1000);
  const seed = { name: '', city: '', country: '', links: emptyLinks(), handles: { ig: '', yt: '' }, ytId: '', ytUser: '', ytVideo: '',
                 media: [], extra: [], raw: clean(raw, 1000) };
  const texts = [];
  for (const part of raw.split(/\t|\|/)) {
    const rest = [];
    for (const w of part.trim().split(/\s+/).filter(Boolean)) {
      const t = w.replace(/[),;]+$/, '').replace(/\.$/, '');
      if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(t)) continue;                  // an email address is not a seed
      if (/^@[\w.]{1,30}$/.test(t)) {
        const h = t.slice(1).toLowerCase();
        if (!seed.handles.ig) { seed.handles.ig = h; seed.links.instagram ||= `https://www.instagram.com/${h}/`; }
        continue;
      }
      const c = /[./]/.test(t) ? classifyUrl(t) : null;
      if (c) addLink(seed, c); else rest.push(w);
    }
    const text = rest.join(' ').replace(/^[\s,;·–—-]+|[\s,;·–—-]+$/g, '');
    if (text) texts.push(text);
  }
  seed.name = clean(texts[0], 80);
  if (texts[1]) { const [c, ...more] = texts[1].split(','); seed.city = clean(c, 60); seed.country = clean(more.join(',') || texts[2] || '', 60); }
  if (!seed.name && seed.links.google) seed.name = mapsPlaceName(seed.links.google);
  return seed;
}

/* ---------- a website ---------- */
export async function fetchPage(url, opts = {}) {
  const o = ctxOf(opts);
  const c = classifyUrl(url);
  let host = ''; try { host = new URL(c ? c.url : String(url)).hostname; } catch {}
  if (host && privateHost(host)) return { ok: false, error: 'private-host', url };
  if (!c || c.kind !== 'website') return { ok: false, error: 'not-fetched', url };
  const r = await guarded(c.url, o, { accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.5', max: PAGE_MAX, pagesOnly: true });
  if (!r.ok) return { ok: false, error: r.error === 'status' ? `http-${r.status}` : r.error, url };
  if (r.type && !/html|xml|text\/plain/.test(r.type)) return { ok: false, error: 'not-a-page', url };
  let cs = (/charset=["']?([\w-]+)/i.exec(r.type) || [])[1]
    || (/<meta[^>]+charset=["']?([\w-]+)/i.exec(r.body.subarray(0, 2048).toString('latin1')) || [])[1];
  let html; try { html = new TextDecoder(cs || 'utf-8').decode(r.body); } catch { html = r.body.toString('utf8'); }
  return { ok: true, url, finalUrl: r.url, html };
}

const attrs = (tag) => {
  const o = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) o[m[1].toLowerCase()] ??= decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  return o;
};
const stripTags = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' '));
const LD_TYPES = /^(MusicGroup|PerformingGroup|Person|LocalBusiness|BarOrPub|NightClub|Restaurant|FoodEstablishment|CafeOrCoffeeShop|MusicVenue|EntertainmentBusiness|Hotel|Organization)$/;
const str = (x) => (typeof x === 'string' || typeof x === 'number' ? String(x) : '');
const LD_DAY = { monday: 'Mo', tuesday: 'Tu', wednesday: 'We', thursday: 'Th', friday: 'Fr', saturday: 'Sa', sunday: 'Su' };
function flattenLd(j, depth = 0) {
  if (depth > 4 || !j || typeof j !== 'object') return [];
  if (Array.isArray(j)) return j.flatMap((x) => flattenLd(x, depth + 1));
  return [j, ...(Array.isArray(j['@graph']) ? flattenLd(j['@graph'], depth + 1) : [])];
}
function ldNode(n, abs) {
  const types = [].concat(n['@type'] || []).map(String);
  if (!types.some((t) => LD_TYPES.test(t))) return null;
  const a = n.address, geo = n.geo || {};
  const addr = typeof a === 'string' ? clean(a, 160) : a && typeof a === 'object'
    ? clean([a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode, typeof a.addressCountry === 'object' ? a.addressCountry.name : a.addressCountry].filter(Boolean).join(', '), 160) : '';
  let hours = [].concat(n.openingHours || []).map((x) => clean(str(x), 80)).filter(Boolean).join('; ');
  if (!hours && Array.isArray(n.openingHoursSpecification))
    hours = n.openingHoursSpecification.flatMap((s) => [].concat(s.dayOfWeek || []).map((d) => {
      const day = LD_DAY[String(d).split('/').pop().toLowerCase()];
      return day && s.opens && s.closes ? `${day} ${String(s.opens).slice(0, 5)}-${String(s.closes).slice(0, 5)}` : '';
    })).filter(Boolean).join('; ');
  const img = (x) => (typeof x === 'string' ? abs(x) : x && typeof x === 'object' ? abs(x.url || x.contentUrl || '') : '');
  return { type: types.join(','), name: clean(str(n.name), 120), description: clean(stripTags(str(n.description)), 1500), url: abs(str(n.url)),
    sameAs: [].concat(n.sameAs || []).map((x) => abs(String(x))).filter(Boolean).slice(0, 20),
    image: [].concat(n.image || []).map(img).filter(Boolean).slice(0, 6), telephone: clean(str(n.telephone), 40), address: addr,
    city: a && typeof a === 'object' ? clean(a.addressLocality, 60) : '', lat: Number(geo.latitude) || null, lng: Number(geo.longitude) || null,
    hours, genre: [].concat(n.genre || []).map((g) => clean(str(g), 40)).filter(Boolean).slice(0, 6),
    members: [].concat(n.member || []).map((m) => clean(m && (m.name || (m.member && m.member.name)), 60)).filter(Boolean).slice(0, 12),
    founded: clean(str(n.foundingDate), 20) };
}
/** What a page's JSON-LD says, as plain lines a fact can cite. */
export function ldSummary(ld) {
  return (ld || []).map((n) => [`${n.type}: ${n.name}`, n.description, n.genre.length ? `Genre: ${n.genre.join(', ')}` : '',
    n.members.length ? `Members: ${n.members.join(', ')}` : '', n.founded ? `Founded: ${n.founded}` : '', n.address ? `Address: ${n.address}` : '',
    n.telephone ? `Telephone: ${n.telephone}` : '', n.hours ? `Opening hours: ${n.hours}` : ''].filter(Boolean).join('\n')).join('\n\n');
}
function parseSrcset(v, abs) {
  return String(v || '').split(/,\s+/).map((c) => { const [u, d] = c.trim().split(/\s+/); const url = abs(u || ''); const w = /^(\d+)w$/.exec(d || ''); return url ? { url, w: w ? +w[1] : 0 } : null; }).filter(Boolean);
}
const SUB = { artist: /(^|[/_-])(about|bio|biography|story|press|epk|media|info|contact)([/_.-]|$)/i,
              venue: /(^|[/_-])(about|story|info|contact|menu|events|music|live|find-us|location)([/_.-]|$)/i };
const SUB_RANK = { about: 5, bio: 5, biography: 5, story: 4, press: 3, epk: 3, menu: 3, music: 3, live: 3, events: 2, info: 2, 'find-us': 2, location: 2, media: 1, contact: 1 };
/* A site's chrome, not its photos — as whole words only, so "lexicon-band.jpg" or a gig in Barrow survives. */
const JUNK_IMG = /(^|[^a-z])(logo|icon|sprite|favicon|placeholder|spinner|loader|loading|badge|button|arrow|pixel|tracking|payment|emoji|spacer|blank)s?([^a-z]|$)/i;

/** One page of HTML → its title, description, og tags, JSON-LD, readable text, the
 *  profile links it carries, the same-site pages worth reading next, and its photos. */
export function parsePage(html, base, kind = 'artist') {
  const src = String(html || '').slice(0, 600 * 1024);        // bounds every regex below on a runaway page
  let b = null; try { b = new URL(base); } catch {}
  // '' stays '' — resolved against the page it would BE the page, and a missing og:image became a photo of the home page
  const abs = (h) => { const v = decodeEntities(String(h || '')).trim(); if (!v || v.startsWith('#')) return '';
    try { const u = new URL(v, b || undefined); if (!/^https?:$/.test(u.protocol)) return ''; u.hash = ''; return u.href; } catch { return ''; } };
  const out = { title: clean(stripTags((/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(src) || [])[1]), 200), description: '', og: {}, ld: [], text: '', links: [], sub: [], images: [] };
  for (const m of src.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]); const k = String(a.property || a.name || a.itemprop || '').toLowerCase(); const v = clean(a.content, 600);
    if (!k || !v) continue;
    if (k === 'description') out.description ||= v; else if (/^(og|twitter):/.test(k)) out.og[k] ??= v;
  }
  out.description ||= out.og['og:description'] || '';
  for (const m of src.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    for (const n of flattenLd(j)) { const x = ldNode(n, abs); if (x) out.ld.push(x); }
  }
  out.text = decodeEntities(src.replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|form|select)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<\/?(br|p|div|li|h[1-6]|section|article|tr|blockquote|header|main)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter((l, i, all) => l && l !== all[i - 1]).join('\n').slice(0, TEXT_MAX);
  // links: anchors, rel="me", and the JSON-LD sameAs (the site's own word that these are the same act)
  const me = new Set(out.ld.flatMap((n) => n.sameAs));
  for (const m of src.matchAll(/<link\b[^>]*>/gi)) { const a = attrs(m[0]); if (/\bme\b/i.test(a.rel || '') && a.href) me.add(abs(a.href)); }
  const hrefs = [...me, ...[...src.matchAll(/<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)].map((m) => abs(m[1] ?? m[2] ?? m[3] ?? ''))];
  const sub = new Map(), seen = new Set(), host = b ? b.hostname.replace(/^www\./, '') : '';
  for (const h of hrefs) {
    const c = h && classifyUrl(h);
    if (!c) continue;
    if (c.kind === 'website') {
      const u = new URL(c.url);
      if (u.hostname.replace(/^www\./, '') !== host || /\.(pdf|jpe?g|png|gif|webp|zip|mp3|mp4)$/i.test(u.pathname)) continue;
      const w = (SUB[kind] || SUB.artist).exec(u.pathname);
      if (w && u.pathname !== (b && b.pathname)) sub.set(u.origin + u.pathname, Math.max(sub.get(u.origin + u.pathname) || 0, SUB_RANK[w[2].toLowerCase()] || 1));
    } else if (!seen.has(c.url)) { seen.add(c.url); out.links.push({ ...c, me: me.has(h) }); }
  }
  out.sub = [...sub].sort((x, y) => y[1] - x[1]).map(([u]) => u).slice(0, 3);
  const imgs = [];
  const push = (url, w, h, from, alts = []) => { if (url && !JUNK_IMG.test(url) && !/\.(svg|gif|ico)(\?|$)/i.test(url)) imgs.push({ url, w: w || 0, h: h || 0, from, alts }); };
  push(abs(out.og['og:image'] || ''), +out.og['og:image:width'] || 0, +out.og['og:image:height'] || 0, 'og');
  push(abs(out.og['twitter:image'] || ''), 0, 0, 'og');
  for (const n of out.ld) for (const i of n.image) push(i, 0, 0, 'ld');
  for (const m of src.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    if (JUNK_IMG.test(a.alt || '') || JUNK_IMG.test(a.class || '')) continue;
    const set = parseSrcset(a.srcset || a['data-srcset'], abs);
    const fits = set.filter((s) => !s.w || s.w <= 2400);
    const best = (fits.length ? fits : set).sort((x, y) => y.w - x.w)[0];
    const url = best ? best.url : abs(a['data-src'] || a['data-lazy-src'] || a['data-original'] || a.src || '');
    const w = (best && best.w) || +a.width || 0;
    if (!url || (w && w < 400)) continue;
    push(url, w, +a.height || 0, 'img', set.filter((s) => s.url !== url));
  }
  const byUrl = new Map();
  for (const i of imgs) if (!byUrl.has(i.url)) byUrl.set(i.url, i);
  const rank = { og: 0, ld: 1, img: 2 };
  out.images = [...byUrl.values()].sort((x, y) => rank[x.from] - rank[y.from] || y.w - x.w).slice(0, 24);
  return out;
}

/** The home page and up to three of its own about / bio / press pages. */
export async function readSite(url, opts = {}, kind = 'artist') {
  const o = ctxOf(opts);
  const home = await fetchPage(url, o);
  if (!home.ok) return { ok: false, error: home.error, url };
  const pages = [], links = [], images = [];
  const take = (r) => {
    const p = parsePage(r.html, r.finalUrl, kind);
    pages.push({ url: r.finalUrl, title: p.title, description: p.description, text: p.text, ld: p.ld });
    for (const l of p.links) if (!links.some((x) => x.url === l.url)) links.push(l);
    for (const i of p.images) if (!images.some((x) => x.url === i.url)) images.push({ ...i, page: r.finalUrl });
    return p;
  };
  const p0 = take(home);
  for (const s of p0.sub) { const r = await fetchPage(s, o); if (r.ok) take(r); }
  return { ok: true, url: home.finalUrl, pages, links, images: images.slice(0, 30), ld: pages.flatMap((p) => p.ld) };
}

/* ---------- YouTube ----------
   With YOUTUBE_API_KEY: channels.list (1 unit) → the uploads playlist, 50 a page, six
   pages at most (6) → videos.list in fifties (≤6): thirteen units for a channel, of
   the ten thousand a day. Without a key: the channel's RSS feed when its UC… id is
   known, else oEmbed for a video the founder pasted — both doors YouTube publishes. */
const YTAPI = 'https://www.googleapis.com/youtube/v3/';
const isoSec = (d) => { const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(d || '')); return m ? (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0) : null; };
const MUSIC = /\b(live|cover|official|session|acoustic|unplugged|performance|music video|original|busking|gig)\b/i;
const NOT_MUSIC = /\b(vlog|interview|podcast|reaction|tutorial|lesson|how to|unboxing|review|trailer|teaser|q ?& ?a)\b/i;
/** Views and recency, a music title up, a vlog down; Shorts under a minute only if nothing else. */
export function rankVideos(list, now = Date.now()) {
  const scored = (list || []).filter((v) => v && /^[\w-]{11}$/.test(v.id || '') && v.embeddable !== false && !v.live).map((v) => {
    const rec = 1 / (1 + Math.max(0, (now - (v.published || now)) / 86400e3) / 365);
    const short = v.short === true || (v.duration > 0 && v.duration < 60);
    return { ...v, short, score: Math.log10((v.views || 0) + 10) * (0.55 + 0.45 * rec) + (MUSIC.test(v.title || '') ? 1.2 : 0) - (NOT_MUSIC.test(v.title || '') ? 0.8 : 0) };
  });
  const long = scored.filter((v) => !v.short);
  return (long.length ? long : scored).sort((a, b) => b.score - a.score || (b.published || 0) - (a.published || 0));
}
/** A video's picture candidates: the uploaded thumbnail, then YouTube's own frame grabs. */
export const ytThumbs = (id) => [
  { url: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, variant: 'maxresdefault', fallback: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` },
  { url: `https://i.ytimg.com/vi/${id}/maxres1.jpg`, variant: 'maxres1' },
  { url: `https://i.ytimg.com/vi/${id}/maxres2.jpg`, variant: 'maxres2' },
  { url: `https://i.ytimg.com/vi/${id}/maxres3.jpg`, variant: 'maxres3' },
];
function ytChannelOf(it) {
  const sn = it.snippet || {}, th = sn.thumbnails || {}, br = (it.brandingSettings || {}).image || {}, st = it.statistics || {};
  const handle = String(sn.customUrl || '').replace(/^@/, '');
  return { id: it.id, title: clean(sn.title, 100), description: clean(sn.description, 1500), country: String(sn.country || '').toUpperCase(), handle,
    avatar: (th.high || th.medium || th.default || {}).url || '', banner: br.bannerExternalUrl ? `${br.bannerExternalUrl}=w1920` : '',
    subs: st.hiddenSubscriberCount ? null : Number(st.subscriberCount) || 0,
    url: handle ? `https://www.youtube.com/@${handle}` : `https://www.youtube.com/channel/${it.id}` };
}
const ytVideoOf = (v) => ({ id: v.id, title: clean((v.snippet || {}).title, 140), description: clean((v.snippet || {}).description, 600),
  views: Number((v.statistics || {}).viewCount) || 0, published: Date.parse((v.snippet || {}).publishedAt || '') || 0,
  duration: isoSec((v.contentDetails || {}).duration), embeddable: (v.status || {}).embeddable !== false,
  live: ['live', 'upcoming'].includes((v.snippet || {}).liveBroadcastContent) });
async function ytApi(want, key, o) {
  let units = 0;
  const get = (path, params) => { units++; return getJSON(`${YTAPI}${path}?${new URLSearchParams({ ...params, key })}`, API_UA, o); };
  const PARTS = 'snippet,brandingSettings,contentDetails,statistics';
  let ch = null;
  if (want.id) ch = ((await get('channels', { part: PARTS, id: want.id })).items || [])[0];
  if (!ch && want.handle) ch = ((await get('channels', { part: PARTS, forHandle: '@' + want.handle })).items || [])[0];
  if (!ch && want.user) ch = ((await get('channels', { part: PARTS, forUsername: want.user })).items || [])[0];
  if (!ch && want.video) {
    const cid = ((((await get('videos', { part: 'snippet', id: want.video })).items || [])[0] || {}).snippet || {}).channelId;
    if (cid) ch = ((await get('channels', { part: PARTS, id: cid })).items || [])[0];
  }
  if (!ch) return { ok: false, error: 'no-channel', units };
  const uploads = ((ch.contentDetails || {}).relatedPlaylists || {}).uploads;
  const ids = new Set();
  for (let page = 0, token = ''; uploads && page < 6; page++) {
    const r = await get('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(token ? { pageToken: token } : {}) });
    for (const it of r.items || []) if (it.contentDetails && it.contentDetails.videoId) ids.add(it.contentDetails.videoId);
    token = r.nextPageToken || ''; if (!token) break;
  }
  const list = [...ids], vids = [];
  for (let i = 0; i < list.length; i += 50)
    for (const v of (await get('videos', { part: 'snippet,contentDetails,statistics,status', id: list.slice(i, i + 50).join(',') })).items || []) vids.push(ytVideoOf(v));
  return { ok: true, from: 'api', channel: ytChannelOf(ch), videos: rankVideos(vids, o.now()).slice(0, 12), total: vids.length, units };
}
const xtag = (s, t) => decodeEntities(((new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`).exec(s) || [])[1] || '').trim());
export function parseYtRss(xml) {
  const s = String(xml || ''), head = s.split('<entry>')[0];
  const id = xtag(head, 'yt:channelId'), title = clean(xtag(head, 'title'), 100);
  const videos = [...s.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({ id: xtag(e, 'yt:videoId'), title: clean(xtag(e, 'title'), 140),
    description: clean(xtag(e, 'media:description'), 600), published: Date.parse(xtag(e, 'published')) || 0,
    views: +((/<media:statistics[^>]*views="(\d+)"/.exec(e) || [])[1] || 0), duration: null,
    short: /\/shorts\//.test((/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/.exec(e) || [])[1] || '') })).filter((v) => /^[\w-]{11}$/.test(v.id));
  return { channel: { id, title, description: '', country: '', handle: '', avatar: '', banner: '', subs: null, url: `https://www.youtube.com/channel/${id}` }, videos };
}
export async function youtube(seed, opts = {}) {
  const o = ctxOf(opts);
  const want = { id: seed.ytId || '', handle: String((seed.handles || {}).yt || '').replace(/^@/, ''), user: seed.ytUser || '', video: seed.ytVideo || '' };
  if (!want.id && !want.handle && !want.user && !want.video) return { ok: false, error: 'no-channel' };
  try {
    if (o.ytKey) return await ytApi(want, o.ytKey, o);
    if (want.id) {
      const r = await o.fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${want.id}`, { headers: { 'user-agent': BOT_UA }, signal: AbortSignal.timeout(PAGE_MS) });
      if (!r.ok) return { ok: false, error: `rss-${r.status}` };
      const x = parseYtRss(await r.text());
      return { ok: true, from: 'rss', channel: x.channel, videos: rankVideos(x.videos, o.now()).slice(0, 12), total: x.videos.length, units: 0 };
    }
    if (want.video) {
      const d = await getJSON(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${want.video}`)}`, BOT_UA, o);
      const h = /\/@([\w.-]+)/.exec(d.author_url || '');
      return { ok: true, from: 'oembed', channel: { id: '', title: clean(d.author_name, 100), description: '', country: '', handle: h ? h[1] : '', avatar: '', banner: '', subs: null, url: String(d.author_url || '') },
               videos: [{ id: want.video, title: clean(d.title, 140), description: '', views: 0, published: 0, duration: null }], total: 1, units: 0 };
    }
    return { ok: false, error: 'no-key' };
  } catch (e) { return { ok: false, error: clean(e && e.message, 120) }; }
}

/* ---------- MusicBrainz (CC0) ----------
   Only a confident match: the exact name, AND either one of its official links is one
   we already hold, or it is the only exact match and its country or area is the seed's. */
const MB = 'https://musicbrainz.org/ws/2/';
export async function musicBrainz(name, known = {}, opts = {}) {
  const o = ctxOf(opts), want = norm(name);
  if (!want) return null;
  let found;
  try { found = await paced('musicbrainz.org', 1100, o, () => getJSON(`${MB}artist/?query=${encodeURIComponent(`artist:"${String(name).replace(/["\\]/g, ' ').trim()}"`)}&fmt=json&limit=5`, API_UA, o)); }
  catch { return null; }
  const exact = (found.artists || []).filter((a) => a && a.id && (norm(a.name) === want || (a.aliases || []).some((x) => norm(x.name) === want)));
  const ours = new Set(Object.values(known.links || {}).map((u) => (classifyUrl(u) || {}).url).filter(Boolean));
  const place = [known.country, known.city].map(norm).filter(Boolean);
  for (const a of exact.slice(0, 2)) {
    let rel; try { rel = await paced('musicbrainz.org', 1100, o, () => getJSON(`${MB}artist/${encodeURIComponent(a.id)}?inc=url-rels&fmt=json`, API_UA, o)); } catch { continue; }
    const links = {};
    for (const r of rel.relations || []) {
      const c = r && r.url && !r.ended ? classifyUrl(r.url.resource) : null;
      const k = c && (c.kind === 'website' ? (r.type === 'official homepage' ? 'website' : '') : c.kind);
      if (k && LINK_KINDS.includes(k) && !links[k]) links[k] = c.url;
    }
    const byLink = Object.values(links).some((u) => ours.has(u));
    const theirs = [a.country, regionName(a.country), (a.area || {}).name, (a['begin-area'] || {}).name].map(norm).filter(Boolean);
    const byPlace = exact.length === 1 && theirs.some((t) => place.includes(t));
    if (!byLink && !byPlace) continue;
    return { mbid: a.id, name: a.name, type: a.type || '', country: a.country || '', area: (a.area || {}).name || '', beginArea: (a['begin-area'] || {}).name || '',
             begin: (a['life-span'] || {}).begin || '', disambiguation: clean(a.disambiguation, 120), links, why: byLink ? 'links' : 'place', url: `https://musicbrainz.org/artist/${a.id}` };
  }
  return null;
}

/** Apple Music's artist page, on an exact name match that is the ONLY exact match. */
export async function itunesArtist(name, opts = {}) {
  const o = ctxOf(opts);
  let d; try { d = await getJSON(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5`, API_UA, o); } catch { return null; }
  const exact = (d.results || []).filter((r) => r && norm(r.artistName) === norm(name) && r.artistLinkUrl);
  const c = exact.length === 1 ? classifyUrl(exact[0].artistLinkUrl) : null;
  return c && c.kind === 'applemusic' ? { url: c.url, id: exact[0].artistId, genre: clean(exact[0].primaryGenreName, 40) } : null;
}

/* ---------- OpenStreetMap Nominatim (ODbL: attribution goes in the sources) ---------- */
export function osmPlace(r) {
  if (!r || r.lat == null || r.lon == null) return null;
  const a = r.address || {}, t = r.extratags || {};
  const city = a.city || a.town || a.village || a.municipality || a.suburb || '';
  return { name: clean(r.name, 100), amenity: clean(r.type, 40), cat: clean(r.category || r.class, 40), lat: +r.lat, lng: +r.lon,
    address: clean([[a.house_number, a.road].filter(Boolean).join(' '), a.suburb !== city ? a.suburb : '', city, a.postcode].filter(Boolean).join(', '), 160),
    city: clean(city, 60), country: clean(a.country, 60), cc: String(a.country_code || '').toUpperCase(),
    website: t.website || t['contact:website'] || '', phone: t.phone || t['contact:phone'] || '', hours: t.opening_hours || '',
    instagram: t['contact:instagram'] || '', facebook: t['contact:facebook'] || '', tags: t,
    osmUrl: r.osm_type && r.osm_id ? `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}` : 'https://www.openstreetmap.org/' };
}
export async function nominatim(q, opts = {}) {
  const o = ctxOf(opts);
  try {
    const list = await paced('nominatim.openstreetmap.org', 1100, o, () => getJSON(`https://nominatim.openstreetmap.org/search?format=jsonv2&extratags=1&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`, API_UA, o));
    return (Array.isArray(list) ? list : []).map(osmPlace).filter(Boolean);
  } catch { return []; }
}
/* ---------- photos ----------
   The bytes decide, never the label: JPEG, PNG or WebP by their first bytes, sized from
   their own headers (no image library — there are two dependencies and it stays so). */
export function sniffImage(b) {
  if (!b || b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export function imageSize(b) {
  const type = sniffImage(b);
  if (!type) return null;
  const none = { type, width: 0, height: 0 };
  try {
    if (type === 'image/png') return b.toString('latin1', 12, 16) === 'IHDR' ? { type, width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : none;
    if (type === 'image/webp') {
      const c = b.toString('latin1', 12, 16);
      if (c === 'VP8X') return { type, width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
      if (c === 'VP8L') { const v = b.readUInt32LE(21); return { type, width: (v & 0x3fff) + 1, height: ((v >>> 14) & 0x3fff) + 1 }; }
      if (c === 'VP8 ') return { type, width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      return none;
    }
    for (let i = 2; i + 9 < b.length;) {                        // JPEG: walk the segments to the frame header
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m === 0xd9 || m === 0xda) break;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { type, width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return none;
  } catch { return none; }
}
/** Smaller copies of a picture that was over the cap: what the page's own srcset
 *  offered, then the resizing every common site host does by address. */
export function smallerVariants(url, alts = []) {
  const out = [...alts].sort((x, y) => (y.w || 0) - (x.w || 0)).map((a) => a.url);
  let u; try { u = new URL(url); } catch { return out.slice(0, 5); }
  const host = u.hostname.toLowerCase(), at = (fn) => { const v = new URL(u.href); fn(v); out.push(v.href); };
  const wp = /-(\d{3,5})x(\d{3,5})(\.(?:jpe?g|png|webp))$/i.exec(u.pathname);          // WordPress: name-2048x1365.jpg
  if (wp) for (const w of [1600, 1280, 1024]) if (w < +wp[1]) at((v) => { v.pathname = u.pathname.slice(0, -wp[0].length) + `-${w}x${Math.round(+wp[2] * w / +wp[1])}${wp[3]}`; });
  if (/(^|\.)squarespace(-cdn)?\.com$/.test(host)) for (const f of ['1500w', '1000w']) at((v) => v.searchParams.set('format', f));
  if (host === 'static.wixstatic.com') {
    const fill = /\/v1\/(fill|fit)\/w_(\d+),h_(\d+)/.exec(u.pathname);
    if (fill) at((v) => { v.pathname = u.pathname.replace(fill[0], `/v1/${fill[1]}/w_1600,h_${Math.round(+fill[3] * 1600 / +fill[2])}`); });
    else if (/^\/media\/[^/]+$/.test(u.pathname)) at((v) => { v.pathname = `${u.pathname}/v1/fit/w_1600,h_1600,q_85/${u.pathname.split('/').pop()}`; });
  }
  if (host === 'cdn.shopify.com' || u.pathname.includes('/cdn/shop/')) for (const w of ['1600', '1200']) at((v) => v.searchParams.set('width', w));
  return [...new Set(out)].filter((x) => x && x !== url).slice(0, 5);
}
/** A picture's bytes: { ok, bytes, type, width, height, url } or { ok:false, error }.
 *  Over `maxBytes`, the smaller variants are tried; nothing is ever cut short. No
 *  robots.txt here: robots governs crawling pages, and a picture is only ever asked
 *  for because a page we were allowed to read, the YouTube API, or the founder named it. */
export async function fetchImage(url, opts = {}) {
  const { maxBytes = IMG_MAX, alts = [], ...rest } = opts;
  const o = ctxOf(rest);
  const queue = [String(url || '')];
  let last = 'no-image';
  for (let n = 0; n < queue.length && n < 6; n++) {
    const r = await guarded(queue[n], o, { accept: 'image/jpeg,image/png,image/webp;q=0.9,image/*;q=0.5', max: maxBytes, strict: true, robots: false });
    if (r.ok) {
      const dim = imageSize(r.body);
      if (dim) return { ok: true, bytes: r.body, type: dim.type, width: dim.width, height: dim.height, url: r.url };
      last = 'not-an-image';
      continue;
    }
    last = r.error === 'status' ? `http-${r.status}` : r.error;
    if (r.error === 'too-big' && n === 0) queue.push(...smallerVariants(queue[0], alts));
  }
  return { ok: false, error: last };
}
