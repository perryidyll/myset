/* THE SAMPLE FACTORY — one seed line in, one sample page's content out (decision 0101),
   run end to end with NO network. YouTube's Data API, a band's website (robots.txt,
   JSON-LD, og tags, an about page), MusicBrainz, iTunes, Nominatim and Claude are all
   canned replies below; the real parsers, gates, queue and bell run against them.

   Pins, in order: a seed line is read the way the founder writes it; robots.txt and
   private addresses are refused before a byte is asked for; a picture is judged by its
   bytes and its size; Claude's malformed answer gets exactly one repair; an unsourced
   sentence never reaches a page; the gate asks for review when it should; somebody who
   pressed Remove is never built again; the worker only answers to the key and moves a
   job through its states; the bell never starts more than the day allows.

   Run: node --import ./test/register.mjs test/factory.mjs */
import { deflateSync } from 'node:zlib';

process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';        // test values: every call is answered in this process
process.env.YOUTUBE_API_KEY = 'test-youtube-key';
process.env.URL = 'https://factory.test';
delete process.env.FACTORY_MODEL_FAST; delete process.env.FACTORY_MODEL_SMART;

const S = await import('../netlify/functions/_fsrc.mjs');
const A = await import('../netlify/functions/_fai.mjs');
const F = await import('../netlify/functions/_factory.mjs');
const BG = await import('../netlify/functions/factory-background.mjs');
const CRON = await import('../netlify/functions/factorycron.mjs');
const { readDoc, casDoc } = await import('../netlify/functions/_lib.mjs');
const { __reset, __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

/* ---------- pictures, built here ---------- */
const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'latin1'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
/** A real PNG: IHDR, a tEXt tag the fake judge reads back, one flat grey IDAT. */
function png(w, h, tag = '') {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.alloc(1 + w * 3, 0x80); row[0] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr),
    ...(tag ? [chunk('tEXt', Buffer.from(`Comment\0TAG:${tag}`, 'latin1'))] : []),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk('IEND', Buffer.alloc(0))]);
}
/** A JPEG's structure — SOI, JFIF, a comment carrying a tag, the frame header, EOI — sized as asked. */
function jpeg(w, h, tag = '', pad = 0) {
  const seg = (m, body) => { const l = Buffer.alloc(2); l.writeUInt16BE(body.length + 2); return Buffer.concat([Buffer.from([0xff, m]), l, body]); };
  const sof = Buffer.from([8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
    ...(tag ? [seg(0xfe, Buffer.from(`TAG:${tag}`, 'latin1'))] : []), seg(0xc0, sof), Buffer.alloc(pad), Buffer.from([0xff, 0xd9])]);
}
function webp(kind, w, h) {
  let d;
  if (kind === 'VP8X') { d = Buffer.alloc(10); d.writeUIntLE(w - 1, 4, 3); d.writeUIntLE(h - 1, 7, 3); }
  else if (kind === 'VP8L') { d = Buffer.alloc(5); d[0] = 0x2f; d.writeUInt32LE(((w - 1) | ((h - 1) << 14)) >>> 0, 1); }
  else { d = Buffer.alloc(10); d[3] = 0x9d; d[4] = 0x01; d[5] = 0x2a; d.writeUInt16LE(w, 6); d.writeUInt16LE(h, 8); }
  const len = Buffer.alloc(4); len.writeUInt32LE(d.length);
  const body = Buffer.concat([Buffer.from('WEBP'), Buffer.from(kind.padEnd(4)), len, d]), size = Buffer.alloc(4); size.writeUInt32LE(body.length);
  return Buffer.concat([Buffer.from('RIFF'), size, body]);
}
/* A real 16×9 JPEG (made by macOS `sips`), EXIF and Photoshop segments before its frame header. */
const REAL_JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAACQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgACQAQAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMABAQEBAQEBgQEBgkGBgYJDAkJCQkMDwwMDAwMDxIPDw8PDw8SEhISEhISEhUVFRUVFRkZGRkZHBwcHBwcHBwcHP/bAEMBBAUFBwcHDAcHDB0UEBQdHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHR0dHf/dAAQAAf/aAAwDAQACEQMRAD8A4miiivhT+jj/2Q==', 'base64');

/* ---------- the canned world ---------- */
const NOW = Date.parse('2026-09-28T12:00:00Z'), DAY = 86400e3;
const CH = 'UCtidelines0123456789abc';
const SPOTIFY = 'https://open.spotify.com/artist/4tIdEl1nEs0123456789ab';
const SEED = 'The Tide Lines | @thetidelines | https://youtube.com/@thetidelines | https://thetidelines.com | Koh Phangan, Thailand';
const VIDS = {
  wonderwall1: { title: 'Wonderwall (Oasis cover) live at Sunset Bar', views: 12000, days: 200, dur: 'PT4M1S' },
  tidesong001: { title: 'Tide Song (official video)', views: 50000, days: 800, dur: 'PT3M20S' },
  vlogday0003: { title: 'Tour vlog day 3', views: 90000, days: 30, dur: 'PT10M' },
  shortjam001: { title: 'sunset jam #shorts', views: 300000, days: 10, dur: 'PT30S' },
  riptide0001: { title: 'Acoustic session: Riptide', views: 800, days: 20, dur: 'PT3M' },
  hollowlive1: { title: 'Pinch - Live @ The Hollow 2016', views: 300, days: 3000, dur: 'PT4M' },
};
const CHANNEL = { id: CH, snippet: { title: 'The Tide Lines', description: 'Acoustic duo. Covers and originals from Koh Phangan.', customUrl: '@thetidelines', country: 'TH',
  thumbnails: { default: { url: 'https://yt3.ggpht.com/avatar-tide=s88' }, high: { url: 'https://yt3.ggpht.com/avatar-tide=s800' } } },
  brandingSettings: { image: { bannerExternalUrl: 'https://yt3.googleusercontent.com/banner-tide' } },
  contentDetails: { relatedPlaylists: { uploads: 'UUtidelines0123456789abc' } }, statistics: { subscriberCount: '1200', hiddenSubscriberCount: false } };
const HOME = `<!doctype html><html><head><meta charset="utf-8"><title>The Tide Lines — acoustic duo</title>
<meta name="description" content="The Tide Lines: an acoustic duo on Koh Phangan.">
<meta property="og:image" content="/wp-content/uploads/hero-2400x1600.jpg">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"MusicGroup","name":"The Tide Lines","genre":["Indie folk"],
"member":[{"@type":"Person","name":"Mia Hart"},{"@type":"Person","name":"Joe Lin"}],"image":"https://thetidelines.com/img/duo.png",
"sameAs":["https://www.instagram.com/thetidelines/","${SPOTIFY}"]}</script>
<script>var tracking = "never read";</script><style>body { color: red }</style></head><body>
<nav><a href="/about">About</a> <a href="/contact">Contact</a> <a href="/private/notes">Notes</a></nav>
<h1>The Tide Lines</h1><p>Acoustic duo &amp; beach-bar favourites.</p>
<p>Catch us every Friday at <a href="https://www.facebook.com/sunsetbarkpg">Sunset Bar</a>.</p>
<a href="https://www.facebook.com/thetidelinesband"><img src="/img/fb-icon.png" alt="facebook icon"></a>
<img src="/img/site-logo.png" alt="logo">
<img srcset="/img/gallery-1.jpg 1600w, /img/gallery-1-800.jpg 800w" src="/img/gallery-1-800.jpg" alt="live at sunset">
<footer>Site by <a href="https://www.instagram.com/webdesignerperson/">@webdesignerperson</a></footer></body></html>`;
const ABOUT = `<html><head><title>About — The Tide Lines</title></head><body><nav>Home</nav>
<p>The Tide Lines are Mia Hart (vocals) and Joe Lin (guitar).</p><p>They formed in 2019 on Koh Phangan and play every Friday at Sunset Bar.</p>
<script>alert('x')</script></body></html>`;
const IMG = new Map(Object.entries({
  'https://i.ytimg.com/vi/wonderwall1/maxresdefault.jpg': jpeg(1280, 720, 'wonderwall1/maxresdefault'),
  'https://i.ytimg.com/vi/wonderwall1/maxres1.jpg': jpeg(1280, 720, 'wonderwall1/maxres1'),
  'https://i.ytimg.com/vi/tidesong001/hqdefault.jpg': jpeg(480, 360, 'tidesong001/hqdefault'),
  'https://i.ytimg.com/vi/tidesong001/maxres1.jpg': jpeg(1280, 720, 'tidesong001/maxres1'),
  'https://i.ytimg.com/vi/riptide0001/maxresdefault.jpg': jpeg(1280, 720, 'riptide0001/maxresdefault'),
  'https://yt3.ggpht.com/avatar-tide=s800': jpeg(800, 800, 'avatar'),
  'https://yt3.googleusercontent.com/banner-tide=w1920': jpeg(1920, 1080, 'banner'),
  'https://thetidelines.com/wp-content/uploads/hero-2400x1600.jpg': jpeg(2400, 1600, 'hero-big', 1000 * 1024),
  'https://thetidelines.com/wp-content/uploads/hero-1600x1067.jpg': jpeg(1600, 1067, 'hero-1600'),
  'https://thetidelines.com/img/duo.png': png(1200, 800, 'duo'),
  'https://thetidelines.com/img/gallery-1.jpg': jpeg(1600, 1000, 'gallery-1'),
  'https://img.test/sunset-inside.jpg': jpeg(1600, 1000, 'sunset-inside'),
  'https://images.squarespace-cdn.com/content/v1/ab/photo.jpg': jpeg(3000, 2000, 'sq-big', 1200 * 1024),
  'https://images.squarespace-cdn.com/content/v1/ab/photo.jpg?format=1500w': jpeg(1500, 1000, 'sq-1500'),
  'https://img.test/big.jpg': jpeg(3000, 2000, 'big', 1100 * 1024),
  'https://img.test/big-800.jpg': jpeg(800, 533, 'big-800'),
  'https://img.test/anim.gif': Buffer.from('GIF89a\x01\0\x01\0\0\0\0;', 'latin1'),
  'https://img.test/page.jpg': Buffer.from('<!doctype html><title>not a picture</title>'),
  'https://img.test/webp.webp': webp('VP8X', 1600, 900),
}));
const MB_SEARCH = { artists: [{ id: 'mb-tide-0001', name: 'The Tide Lines', country: 'TH', area: { name: 'Thailand' }, type: 'Group', 'life-span': { begin: '2019' } },
                              { id: 'mb-other-002', name: 'Tide Lines', country: 'GB' }] };
const MB_RELS = { relations: [{ type: 'social network', url: { resource: 'https://www.instagram.com/thetidelines/' } },
  { type: 'bandcamp', url: { resource: 'https://thetidelines.bandcamp.com/' } }, { type: 'official homepage', url: { resource: 'https://thetidelines.com/' } }] };
const ITUNES = { results: [{ artistName: 'The Tide Lines', artistLinkUrl: 'https://music.apple.com/th/artist/the-tide-lines/1500000001?uo=4', artistId: 1500000001, primaryGenreName: 'Singer/Songwriter' }] };
const OSM = [{ osm_type: 'node', osm_id: 424242, lat: '9.7312', lon: '100.0136', category: 'amenity', type: 'bar', name: 'Sunset Bar',
  address: { road: 'Haad Rin Road', suburb: 'Haad Rin', village: 'Ban Tai', postcode: '84280', country: 'Thailand', country_code: 'th' },
  extratags: { opening_hours: 'Mo-Su 17:00-01:00; Tu off', outdoor_seating: 'yes', live_music: 'yes', 'contact:instagram': 'sunsetbarkpg', phone: '+66 81 234 5678' } }];

/* Claude, canned. The fake reads the prompt the way the model would have to: source
   numbers out of the numbered sources, fact numbers out of the facts, and each picture's
   tag out of the picture's own bytes. */
const ai = { calls: [], conf: 0.92 };
const textOf = (c) => (typeof c === 'string' ? c : (c || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n'));
const v = (isAct, people, kind, quality, textOverlay, coverOk, avatarOk, focus = '50% 35%') => ({ isAct, people, kind, quality, textOverlay, focus, coverOk, avatarOk, dup: '', why: 'canned' });
const VERDICT = {
  'wonderwall1/maxresdefault': v(true, 2, 'performing', 0.86, 0.05, true, false), 'wonderwall1/maxres1': v(true, 2, 'performing', 0.8, 0, true, true, '45% 30%'),
  'tidesong001/hqdefault': v(true, 2, 'performing', 0.55, 0.6, false, false), 'tidesong001/maxres1': v(true, 1, 'portrait', 0.82, 0, false, true, '52% 28%'),
  'riptide0001/maxresdefault': v(true, 2, 'performing', 0.74, 0.1, true, false), avatar: v(false, 0, 'logo', 0.9, 0.4, false, false),
  banner: v(true, 0, 'text-heavy', 0.7, 0.7, false, false), 'hero-1600': v(true, 2, 'performing', 0.92, 0, true, false),
  duo: v(true, 2, 'group', 0.78, 0, false, true), 'gallery-1': v(true, 2, 'performing', 0.7, 0.1, true, false),
  'sunset-inside': v(true, 0, 'venue-inside', 0.8, 0, true, false), _: v(false, 0, 'other', 0.3, 0, false, false),
};
const found = () => ({ name: 'The Tide Lines', links: { instagram: 'https://www.instagram.com/thetidelines/', youtube: 'https://www.youtube.com/@thetidelines',
  website: 'https://thetidelines.com/', spotify: SPOTIFY, tiktok: 'https://www.tiktok.com/@thetidelines', facebook: 'https://www.facebook.com/thetidelinesband',
  soundcloud: 'https://soundcloud.com/search?q=tide' },
  identity: { confidence: ai.conf, anchors: [{ type: 'handle', value: '@thetidelines' }, { type: 'city', value: 'Koh Phangan' }, { type: 'name', value: 'The Tide Lines' }], notes: 'canned' },
  city: 'Koh Phangan', country: 'Thailand', actType: 'duo' });
const VENUE_FOUND = { name: 'Sunset Bar', links: { instagram: 'https://www.instagram.com/sunsetbarkpg/', google: 'https://www.google.com/maps/place/Sunset+Bar' },
  identity: { confidence: 0.88, anchors: [{ type: 'city', value: 'Koh Phangan' }], notes: 'canned' }, city: 'Koh Phangan', country: 'Thailand', actType: 'venue' };
const res = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const json = (o, status = 200) => res(JSON.stringify(o), status, { 'content-type': 'application/json' });
const reply = (text, { pre = [], usage = { input_tokens: 1200, output_tokens: 300 } } = {}) =>
  json({ id: 'msg_test', type: 'message', role: 'assistant', content: [...pre, { type: 'text', text }], stop_reason: 'end_turn', usage });
function claude(body, headers) {
  ai.calls.push({ body, headers });
  const sys = String(body.system || ''), user = textOf(body.messages[0].content);
  const at = (re) => { const m = new RegExp(`^\\[(\\d+)\\] ${re}`, 'm').exec(user); return m ? +m[1] : 99; };
  if (sys.includes('· DISCOVER')) {
    const search = [{ type: 'text', text: 'Let me look {not json}.' }, { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: { query: 'the tide lines' } },
      { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://example.org/x', title: 'x', encrypted_content: 'e' }] }];
    return reply(JSON.stringify(user.includes('"kind":"venue"') ? VENUE_FOUND : found()), { pre: search, usage: { input_tokens: 5200, output_tokens: 420, server_tool_use: { web_search_requests: 2 } } });
  }
  if (sys.includes('· FACTS')) {
    if (user.startsWith('VENUE')) return reply(JSON.stringify({ facts: [{ k: 'venue_type', v: 'Bar', src: [at('osm')] },
      { k: 'music_nights', v: 'Live music', src: [at('osm')] }, { k: 'amenity', v: 'Outdoor seating', src: [at('osm')] }] }));
    if (body.messages.length === 1) return reply('Here are the facts:\n{"facts": [{"k": "genre", "v": "Indie folk", "src": [1]');   // cut off: forces the one repair
    const home = at('website · https://thetidelines\\.com/ '), about = at('website · https://thetidelines\\.com/about'), yt = at('youtube');
    return reply(JSON.stringify({ facts: [{ k: 'act_type', v: 'Acoustic duo', src: [home] }, { k: 'member', v: 'Mia Hart (vocals)', src: [about] },
      { k: 'member', v: 'Joe Lin (guitar)', src: [about] }, { k: 'formed', v: 'Formed in 2019 on Koh Phangan', src: [about] },
      { k: 'residency', v: 'Plays every Friday at Sunset Bar', src: [about] }, { k: 'cover_song', v: 'Wonderwall (Oasis), filmed live at Sunset Bar', src: [yt] },
      { k: 'genre', v: 'Indie folk', src: [home] }, { k: 'award', v: 'Best band on the island 2021', src: [] },
      { k: 'other', v: 'Signed to a major label', src: [99] }, { k: 'genre', v: 'Indie folk', src: [home] }] }));
  }
  if (sys.includes('· PHOTOS')) {
    const items = []; let id = null;
    for (const b of body.messages[0].content) {
      if (b.type === 'text') { const m = /Image id=(\w+)/.exec(b.text); if (m) id = m[1]; }
      else if (b.type === 'image' && id) { items.push({ id, tag: (/TAG:([\w./-]+)/.exec(Buffer.from(b.source.data, 'base64').toString('latin1')) || [])[1] || '' }); id = null; }
    }
    return reply(JSON.stringify({ photos: items.map(({ id: i, tag }) => ({ id: i, ...(VERDICT[tag] || VERDICT._) })) }));
  }
  if (sys.includes('· COVER')) {
    const ids = [...user.matchAll(/Image id=(\w+)/g)].map((m) => m[1]);
    ai.covers = (ai.covers || []).concat([ids]);
    return reply(JSON.stringify({ best: ai.coverPick === 'none' ? 'none' : ids[ai.coverPick || 0], why: 'canned' }));
  }
  if (sys.includes('· COPY')) {
    ai.copySys = (ai.copySys || []).concat([sys]);
    const f = (re) => at(re);
    if (user.startsWith('VENUE')) return reply(JSON.stringify({ tagline: { text: 'A bar with live music and outdoor seating', src: [f('venue_type'), f('music_nights'), f('amenity')] },
      about: [{ s: 'Sunset Bar is a bar with outdoor seating.', src: [f('venue_type'), f('amenity')] }, { s: 'It puts on live music.', src: [f('music_nights')] }],
      hook: { text: 'I would love to play one of your live music nights.', src: [f('music_nights')] } }));
    const act = f('act_type'), mia = f('member: Mia'), joe = f('member: Joe'), formed = f('formed'), resid = f('residency'), cover = f('cover_song'), genre = f('genre');
    return reply('```json\n' + JSON.stringify({
      tagline: { text: 'Acoustic duo playing indie folk and covers on Koh Phangan', src: [act, genre, cover, formed] },
      style: { text: 'Acoustic duo · indie folk · covers', src: [act, genre, cover] },
      bio: [{ s: 'The Tide Lines are Mia Hart on vocals and Joe Lin on guitar, an acoustic duo', src: [act, mia, joe] },
        { s: 'They formed on Koh Phangan in 2019 and play every Friday at Sunset Bar.', src: [formed, resid] },
        { s: 'Their live Wonderwall has been watched more than 12,000 times.', src: [cover] },
        { s: 'They are the best band on the island.', src: [] },
        { s: 'Their sets lean on indie folk with room for a singalong.', src: [genre] }],
      hook: { text: 'Loved your live Wonderwall from Sunset Bar.', src: [cover] } }) + '\n```');
  }
  if (sys.includes('· SONGS')) {
    ai.songsAsked = (ai.songsAsked || []).concat([user]);
    if (ai.songsFail) return json({ type: 'error', error: { type: 'invalid_request_error', message: 'canned failure' } }, 400);
    const grp = (g, n, pre) => Array.from({ length: n }, (_, i) => ({ title: `${pre} Song ${i + 1}`, artist: `${pre} Artist ${i + 1}`, group: g }));
    const songs = [...grp('near2', 5, 'Folk Rock'), ...grp('main', 10, 'Indie Folk'), ...grp('near1', 5, 'Americana')];
    if (body.messages.length === 1 && ai.songsShort) songs.pop();            // nineteen: forces the one repair
    return reply(JSON.stringify({ genre: 'Indie folk', near: ['Americana', 'Folk rock'], songs }));
  }
  return json({ type: 'error', error: { type: 'invalid_request_error', message: 'unexpected call' } }, 400);
}
function youtubeApi(u) {
  const p = u.searchParams, what = u.pathname.split('/').pop();
  if (p.get('key') !== 'test-youtube-key') return json({ error: { message: 'bad key' } }, 400);
  const video = (id) => ({ id, snippet: { title: VIDS[id].title, description: '', publishedAt: new Date(NOW - VIDS[id].days * DAY).toISOString(), liveBroadcastContent: 'none' },
    contentDetails: { duration: VIDS[id].dur }, statistics: { viewCount: String(VIDS[id].views) }, status: { embeddable: true } });
  const pi = (id) => ({ contentDetails: { videoId: id } });
  if (what === 'channels') return json({ items: p.get('forHandle') === '@thetidelines' || p.get('id') === CH ? [CHANNEL] : [] });
  if (what === 'playlistItems') return json(p.get('pageToken') === 'P2' ? { items: ['shortjam001', 'riptide0001', 'hollowlive1'].map(pi) } : { items: ['wonderwall1', 'tidesong001', 'vlogday0003'].map(pi), nextPageToken: 'P2' });
  if (what === 'videos') return json({ items: p.get('id').split(',').filter((id) => VIDS[id]).map(video) });
  return json({ items: [] });                                  // search.list and anything else: asserted never called
}
const html = (s) => res(s, 200, { 'content-type': 'text/html; charset=utf-8' });
const hits = [];
async function fakeFetch(url, init = {}) {
  const u = new URL(String(url)), h = init.headers || {};
  hits.push({ url: u.href, ua: h['user-agent'] || '' });
  if (u.href === 'https://api.anthropic.com/v1/messages') return claude(JSON.parse(init.body), h);
  if (u.hostname === 'www.googleapis.com') return youtubeApi(u);
  if (IMG.has(u.href)) { const b = IMG.get(u.href); return res(b, 200, { 'content-type': 'image/jpeg', 'content-length': String(b.length) }); }
  if (u.href === 'https://img.test/liar.jpg') return res(jpeg(2000, 1000, 'liar', 1000 * 1024), 200, { 'content-type': 'image/jpeg', 'content-length': '1000' });
  if (u.hostname === 'thetidelines.com') {
    if (u.pathname === '/robots.txt') return res('User-agent: *\nDisallow: /private\n', 200, { 'content-type': 'text/plain' });
    if (u.pathname === '/') return html(HOME);
    if (u.pathname === '/about') return html(ABOUT);
    if (u.pathname === '/contact') return html('<html><head><title>Contact</title></head><body><p>Booking: see the form.</p></body></html>');
    return u.pathname.startsWith('/private') ? html('<p>never to be read</p>') : res('gone', 404);
  }
  if (u.hostname === 'musicbrainz.org') return json(u.pathname.endsWith('/artist/') ? MB_SEARCH : MB_RELS);
  if (u.hostname === 'itunes.apple.com') return json(ITUNES);
  if (u.hostname === 'nominatim.openstreetmap.org') return json(OSM);
  if (u.hostname === 'blocked.test') return u.pathname === '/robots.txt' ? res('User-agent: *\nAllow: /\n\nUser-agent: MySetBot\nDisallow: /\n') : html('<p>secret</p>');
  if (u.hostname === 'down.test') return u.pathname === '/robots.txt' ? res('oops', 503) : html('<p>up</p>');
  if (u.hostname === 'hop.test') return u.pathname === '/robots.txt' ? res('', 404) : res('', 301, { location: 'http://127.0.0.1/admin' });
  return res('not here', 404);
}
const PRIVATE_DNS = { 'evil.test': '10.0.0.5', 'sneaky.test': '169.254.169.254' };
const fakeLookup = async (host) => [{ address: PRIVATE_DNS[host] || '93.184.216.34', family: 4 }];
const sleeps = [];
const net = { fetch: fakeFetch, lookup: fakeLookup, sleep: async (ms) => { sleeps.push(ms); }, now: () => NOW };
const hit = (s) => hits.some((x) => x.url.includes(s));

console.log('\nTHE SEED  one line, written the way the founder writes it');
let s = S.parseSeed(SEED);
eq('name, city and country come out of the plain words', [s.name, s.city, s.country], ['The Tide Lines', 'Koh Phangan', 'Thailand']);
eq('a bare @handle is Instagram', [s.handles.ig, s.links.instagram], ['thetidelines', 'https://www.instagram.com/thetidelines/']);
eq('the YouTube handle and the website are read too', [s.handles.yt, s.links.youtube, s.links.website], ['thetidelines', 'https://www.youtube.com/@thetidelines', 'https://thetidelines.com/']);
eq('a single @handle is a whole seed', [S.parseSeed('@the.tide.lines').handles.ig, S.parseSeed('@the.tide.lines').name], ['the.tide.lines', '']);
eq('an Instagram address with junk after it', S.parseSeed('https://www.instagram.com/TheTideLines/?hl=en').handles.ig, 'thetidelines');
eq('a channel address gives the UC id', S.parseSeed('https://www.youtube.com/channel/UCtidelines0123456789abc/videos').ytId, CH);
s = S.parseSeed('https://youtu.be/wonderwall1?t=30');
eq('a video address is media, and a way to the channel', [s.media, s.ytVideo], [['https://www.youtube.com/watch?v=wonderwall1'], 'wonderwall1']);
eq('a bare domain is the website', S.parseSeed('thetidelines.com').links.website, 'https://thetidelines.com/');
eq('Spotify, localised, with ?si=', S.parseSeed('https://open.spotify.com/intl-de/artist/4tIdEl1nEs0123456789ab?si=abc').links.spotify, SPOTIFY);
eq('Facebook and TikTok', [S.parseSeed('https://m.facebook.com/thetidelinesband').links.facebook, S.parseSeed('https://www.tiktok.com/@TheTideLines').links.tiktok],
   ['https://www.facebook.com/thetidelinesband', 'https://www.tiktok.com/@thetidelines']);
s = S.parseSeed('https://www.google.com/maps/place/Sunset+Bar/@9.7312,100.0136,17z');
eq('a Google Maps place names the venue', [s.name, !!s.links.google], ['Sunset Bar', true]);
eq('"Mr." is a word, not a website', S.parseSeed('Mr. Blue Sky Band | Koh Phangan').name, 'Mr. Blue Sky Band');
eq('an email address is never mistaken for a website', [S.parseSeed('Tide | booking@thetidelines.com').name, S.parseSeed('Tide | booking@thetidelines.com').links.website], ['Tide', '']);
eq('a sharer link or a post is not a profile', [S.classifyUrl('https://www.facebook.com/sharer.php?u=x'), S.classifyUrl('https://www.instagram.com/p/Cxyz/')], [null, null]);

console.log('\nROBOTS.TXT  read first, and obeyed');
const R = 'User-agent: *\nDisallow: /private\nAllow: /private/ok\n';
ok('a disallowed path is refused', !S.robotsAllows(R, '/private/x'));
ok('the longer Allow wins over the shorter Disallow', S.robotsAllows(R, '/private/ok/y'));
ok('a site that names MySetBot is obeyed over its * group', !S.robotsAllows('User-agent: *\nAllow: /\n\nUser-agent: MySetBot\nDisallow: /\n', '/'));
ok('$ anchors and * wildcards', !S.robotsAllows('User-agent: *\nDisallow: /*.pdf$\n', '/a.pdf') && S.robotsAllows('User-agent: *\nDisallow: /*.pdf$\n', '/a.pdf?x'));
ok('an empty Disallow allows everything', S.robotsAllows('User-agent: *\nDisallow:\n', '/anything'));
let p = await S.fetchPage('https://blocked.test/page', net);
ok('THE POINT: a page robots.txt keeps us out of is never asked for', p.error === 'robots' && !hit('blocked.test/page'), p);
p = await S.fetchPage('https://thetidelines.com/private/notes', net);
ok('and the same on a site that allows the rest', p.error === 'robots' && !hit('/private/notes'), p);
p = await S.fetchPage('https://down.test/', net);
ok('a robots.txt that answers 503 means keep out (RFC 9309)', p.error === 'robots' && !hits.some((x) => x.url === 'https://down.test/'), p);
p = await S.fetchPage('https://www.instagram.com/thetidelines/', net);
ok('Instagram is never read as a page', p.error === 'not-fetched' && !hit('instagram.com'), p);

console.log('\nPRIVATE ADDRESSES  refused before anything is sent');
for (const u of ['http://127.0.0.1/', 'http://10.0.0.8/x', 'http://169.254.169.254/latest/meta-data/', 'http://192.168.1.1/', 'http://172.16.5.4/',
                 'http://100.64.0.1/', 'http://[::1]/', 'http://localhost:3000/', 'https://printer.local/', 'https://db.internal/', 'http://0.0.0.0/']) {
  const r = await S.fetchPage(u, net);
  ok(`${u} is refused`, r.error === 'private-host' && !hits.some((x) => x.url.startsWith(u.replace(/\/$/, ''))), r);
}
p = await S.fetchPage('https://evil.test/', net);
ok('a name that RESOLVES to a private address is refused too', p.error === 'private-host' && !hit('evil.test'), p);
p = await S.fetchPage('https://hop.test/start', net);
ok('a redirect to a private address is refused at the hop', p.error === 'private-host' && !hit('127.0.0.1'), p);
let im = await S.fetchImage('http://169.254.169.254/latest', net);
ok('pictures go through the same door', im.error === 'private-host', im);
im = await S.fetchImage('https://sneaky.test/a.jpg', net);
ok('including a picture host that resolves inside', im.error === 'private-host' && !hit('sneaky.test'), im);

console.log('\nPICTURES  the bytes decide, and the size');
eq('a real JPEG, EXIF and all, is 16 by 9', S.imageSize(REAL_JPEG), { type: 'image/jpeg', width: 16, height: 9 });
eq('a real PNG', S.imageSize(png(1200, 800)), { type: 'image/png', width: 1200, height: 800 });
eq('WebP, all three kinds', [S.imageSize(webp('VP8X', 1600, 900)), S.imageSize(webp('VP8L', 20, 10)), S.imageSize(webp('VP8 ', 640, 480))].map((x) => `${x.width}x${x.height}`),
   ['1600x900', '20x10', '640x480']);
im = await S.fetchImage('https://img.test/anim.gif', net);
ok('a GIF is refused', !im.ok && im.error === 'not-an-image', im);
im = await S.fetchImage('https://img.test/page.jpg', net);
ok('so is a web page wearing a .jpg name', !im.ok && im.error === 'not-an-image', im);
im = await S.fetchImage('https://img.test/liar.jpg', net);
ok('a body bigger than its content-length said is still refused', !im.ok && im.error === 'too-big', im);
im = await S.fetchImage('https://images.squarespace-cdn.com/content/v1/ab/photo.jpg', net);
ok('too big on Squarespace → the 1500w copy', im.ok && im.url.endsWith('?format=1500w') && im.width === 1500, { ok: im.ok, url: im.url, error: im.error });
im = await S.fetchImage('https://img.test/big.jpg', { ...net, alts: [{ url: 'https://img.test/big-800.jpg', w: 800 }] });
ok('too big with a srcset → the smaller one the page offered', im.ok && im.url.endsWith('big-800.jpg'), { url: im.url, error: im.error });
const atCap = jpeg(100, 100, 'cap', 0), capPad = 900 * 1024 - atCap.length;
IMG.set('https://img.test/cap.jpg', jpeg(100, 100, 'cap', capPad)); IMG.set('https://img.test/over.jpg', jpeg(100, 100, 'cap', capPad + 1));
ok('exactly 900 KB is allowed', (await S.fetchImage('https://img.test/cap.jpg', net)).ok);
ok('one byte more is not', (await S.fetchImage('https://img.test/over.jpg', net)).error === 'too-big');
ok('WebP is accepted', (await S.fetchImage('https://img.test/webp.webp', net)).type === 'image/webp');

const pg = S.parsePage('<meta property="og:title" content="x"><img src="/uploads/lexicon-band.jpg" width="1200"><img src="/img/site-logo.png" width="1200">'
  + '<img src="/icons/fb.png"><img data-src="/gigs/barrow-night.jpg"><img src="/a.jpg" alt="facebook icon"><img src="/thumb.jpg" width="120"><a href="#top">top</a>', 'https://x.test/');
eq('a page’s pictures: plain <img>, lazy data-src; no logos, icons, thumbnails — and never the page itself',
   pg.images.map((i) => i.url), ['https://x.test/uploads/lexicon-band.jpg', 'https://x.test/gigs/barrow-night.jpg']);
const mhtml = '<a href="/about">About</a><a href="https://x.test/files/food-menu.pdf">Download</a><a href="/eat">Our Menu</a><a href="http://x.test/menu">m</a><a href="https://other.test/menu">Menu</a>';
eq('a venue’s own menu link: its words say menu, on its own site, https (the Menu door, 2026-10-01)', S.parsePage(mhtml, 'https://x.test/', 'venue').menu, 'https://x.test/eat');
eq('a menu PDF by its path when no link says menu', S.parsePage('<a href="/files/food-menu.pdf">Download</a><a href="https://other.test/menu">Menu</a>', 'https://x.test/', 'venue').menu, 'https://x.test/files/food-menu.pdf');
eq('an artist’s page looks for none', S.parsePage(mhtml, 'https://x.test/', 'artist').menu, undefined);

console.log('\nYOUTUBE  the Data API, never search.list, never a youtube.com page');
const yt = await S.youtube(S.parseSeed('https://youtube.com/@thetidelines'), { ...net, ytKey: 'test-youtube-key' });
eq('ranked: views and recency, music up, the vlog down, the Short out', yt.videos.map((x) => x.id), ['wonderwall1', 'tidesong001', 'riptide0001', 'vlogday0003', 'hollowlive1']);
eq('one channel, two pages of uploads, one videos.list for all five: four quota units', yt.units, 4);
eq('the channel: avatar at its largest, the banner at 1920', [yt.channel.avatar, yt.channel.banner], ['https://yt3.ggpht.com/avatar-tide=s800', 'https://yt3.googleusercontent.com/banner-tide=w1920']);
ok('search.list was never called', !hit('/youtube/v3/search'));
eq('with only Shorts, a Short is better than nothing', S.rankVideos([{ id: 'shortjam001', duration: 30, views: 5 }], NOW).map((x) => x.id), ['shortjam001']);

console.log('\nCLAUDE  one JSON answer, one repair, and nothing unsourced');
const calls2 = [];
const mini = (replies) => ({ env: process.env, usage: [], sleep: async () => {}, now: () => NOW,
  fetch: async (url, init) => { const b = JSON.parse(init.body); calls2.push(b); const r = replies.shift();
    return typeof r === 'function' ? r(b) : json({ content: [{ type: 'text', text: r }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }); } });
const FACTS2 = [{ k: 'genre', v: 'Indie folk', src: [0] }, { k: 'formed', v: 'Formed in 2019', src: [0] }];
let ctx2 = mini([JSON.stringify({ tagline: { text: 'An electrifying indie folk duo', src: [0] }, style: { text: 'Indie folk', src: [0] }, bio: [{ s: 'They play indie folk.', src: [0] }], hook: { text: '', src: [] } }),
  JSON.stringify({ tagline: { text: 'Indie folk duo', src: [0] }, style: { text: 'Indie folk', src: [0] }, hook: { text: '', src: [] },
    bio: [{ s: 'They play indie folk.', src: [0] }, { s: 'They formed in 2019.', src: [1] }, { s: 'They formed in 2018.', src: [1] },
      { s: 'w'.repeat(450) + '.', src: [0] }, { s: 'y'.repeat(350) + '.', src: [0] }, { s: 'z'.repeat(340) + '.', src: [0] }] })]);
let copy = await A.writeCopy(FACTS2, [{ url: 'https://a.test/', kind: 'website', title: 'a' }], 'artist', ctx2, { name: 'Duo' });
ok('a hype word sends ONE repair, with the complaint in it', calls2.length === 2 && /no hype words: remove "electrifying"/.test(calls2[1].messages[2].content), calls2.map((c) => c.messages.length));
eq('a sentence whose number is not in its facts is dropped, one too long is dropped whole, the bio stops at two (0158)',
   copy.sentences.map((x) => x.s.slice(0, 24)), ['They play indie folk.', 'They formed in 2019.']);
eq('every kept line says where it came from', copy.sentences.map((x) => x.src), [[0], [0]]);
const two = A.tidyCopy({ tagline: {}, hook: {}, style: {}, bio: [{ s: 'x'.repeat(360) + '.', src: [0] }, { s: 'A second line that would run long past the cap here.', src: [0] }, { s: 'Then a short one.', src: [0] }] }, FACTS2, false);
eq('a second sentence that would pass 400 characters is passed over for one that fits', two.sentences.map((x) => x.s.slice(0, 10)), ['x'.repeat(10), 'Then a sho']);
ok('and the About stays under 400', two.text.length <= 400, two.text.length);
calls2.length = 0;
ctx2 = mini(['not json at all', 'still not json']);
let err = await A.extractFacts([{ kind: 'website', url: 'https://a.test/', title: 'a', text: 'Some words about a band.' }], ctx2).catch((e) => e);
ok('two bad answers are a clear error, not a guess', err.code === 'bad-json' && calls2.length === 2, String(err && err.message));
calls2.length = 0;
ctx2 = mini([(b) => json({ type: 'error', error: { type: 'invalid_request_error', message: 'tools.0: unknown tool type web_search_20250305' } }, 400),
  (b) => json({ content: [{ type: 'server_tool_use', id: 's1', name: 'web_search', input: { query: 'q' } }], stop_reason: 'pause_turn', usage: { input_tokens: 5, output_tokens: 5 } }),
  (b) => json({ content: [{ type: 'web_search_tool_result', tool_use_id: 's1', content: [] }, { type: 'text', text: JSON.stringify(found()) }], stop_reason: 'end_turn',
    usage: { input_tokens: 5, output_tokens: 5, server_tool_use: { web_search_requests: 1 } } })]);
const d2 = await A.discover(S.parseSeed(SEED), {}, ctx2);
ok('a refused search tool is retried once with the newer one', calls2[0].tools[0].type === 'web_search_20250305' && calls2[1].tools[0].type === 'web_search_20260209');
ok('a paused search is resumed by sending the turn back', calls2.length === 3 && calls2[2].messages[1].role === 'assistant' && d2.identity.confidence === 0.92);
ok('the searches are counted for the cost', ctx2.usage.reduce((a, u) => a + u.searches, 0) === 1 && A.estimateCost(ctx2.usage).usd > 0);
calls2.length = 0;
ctx2 = mini([() => { throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }); }]);
err = await A.extractFacts([{ kind: 'website', url: 'https://a.test/', title: 'a', text: 'Some words about a band.' }], ctx2).catch((e) => e);
ok('a call that timed out is not tried again: fifteen minutes is the whole budget', err.code === 'timeout' && calls2.length === 1, String(err && err.message));
const pk = A.pickPhotos([{ id: 'a', from: 'website', group: 'w', isAct: true, coverOk: true, quality: 0.95, textOverlay: 0, width: 1600, height: 900, kind: 'performing' },
  { id: 'b', from: 'youtube', group: 'y', isAct: true, coverOk: true, quality: 0.72, textOverlay: 0.1, width: 1280, height: 720, kind: 'performing' }]);
eq('the founder’s rule: a good-enough YouTube picture beats a better website one', pk.cover.id, 'b');
eq('but a thumbnail with its title across it does not', A.pickPhotos([{ id: 'a', from: 'website', group: 'w', isAct: true, coverOk: true, quality: 0.95, textOverlay: 0, width: 1600, height: 900, kind: 'performing' },
  { id: 'b', from: 'youtube', group: 'y', isAct: true, coverOk: true, quality: 0.9, textOverlay: 0.5, width: 1280, height: 720, kind: 'performing' }]).cover.id, 'a');
/* 0137: Andrew's first page opened on two actors from his music video. */
const shot = (id, from, group, kind, q = 0.8, w = 1280, h = 720, more = {}) => ({ id, from, group, isAct: true, coverOk: true, avatarOk: false, quality: q, textOverlay: 0, width: w, height: h, kind, people: 2, ...more });
eq('an artist\'s cover is never a music video\'s story frame', A.pickPhotos([shot('s', 'youtube', 'yt:a', 'video-scene', 0.95), shot('w', 'website', 'web:1', 'performing', 0.75)]).cover.id, 'w');
eq('the act playing beats a portrait, even from a later source', A.pickPhotos([shot('p', 'youtube', 'yt:a', 'portrait', 0.9), shot('g', 'website', 'web:1', 'group', 0.75)]).cover.id, 'g');
eq('a portrait still covers when nothing shows them playing', A.pickPhotos([shot('p', 'youtube', 'yt:a', 'portrait', 0.9), shot('x', 'website', 'web:1', 'other', 0.95)]).cover.id, 'p');
eq('and a story frame is not one of the small photos either', A.pickPhotos([shot('c', 'website', 'web:0', 'performing', 0.9, 1600, 900), shot('s', 'youtube', 'yt:a', 'video-scene', 0.95)]).extras.length, 0);
const three = A.pickPhotos([shot('c', 'website', 'web:0', 'performing', 0.9, 1600, 900), shot('y1', 'youtube', 'yt:a', 'performing'), shot('y2', 'youtube', 'yt:a', 'performing', 0.7), shot('y3', 'youtube', 'yt:a', 'portrait', 0.65), shot('w1', 'website', 'web:1', 'portrait')]);
eq('three small photos when three are there: a second frame of a video fills the strip', three.extras.map((j) => j.id).join(), 'c,w1,y2');
eq('but never a shot the judge called a duplicate', A.pickPhotos([shot('c', 'website', 'web:0', 'performing', 0.9, 1600, 900), shot('y1', 'youtube', 'yt:a', 'performing'), shot('y2', 'youtube', 'yt:a', 'performing', 0.7, 1280, 720, { dup: 'y1' })]).extras.map((j) => j.id).join(), 'c');
/* 0159: the cover review — the best few covers looked at again, side by side. */
const covs = [shot('a', 'youtube', 'yt:a', 'performing', 0.9), shot('b', 'youtube', 'yt:b', 'performing', 0.85), shot('c', 'website', 'web:1', 'group', 0.8), shot('d', 'website', 'web:2', 'portrait', 0.9), shot('e', 'website', 'web:3', 'performing', 0.75)].map((j) => ({ ...j, bytes: Buffer.from('jpeg'), type: 'image/jpeg' }));
eq('the cover choices are the picker\'s order: playing first, then source, then quality', A.coverChoices(covs).map((j) => j.id).join(), 'a,b,c,e,d');
const seen0 = [];
const pickB = mini([(b) => { seen0.push(b); return json({ content: [{ type: 'text', text: '{"best":"b","why":"canned"}' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 10 } }); }]);
const rb = await A.reviewCover(A.coverChoices(covs), pickB, { name: 'X' });
eq('the review sees four at most, and its choice is the cover', [seen0[0].messages[0].content.filter((x) => x.type === 'image').length, rb.id], [4, 'b']);
const around = A.pickPhotos(covs, { cover: rb });
ok('and the portrait and small photos are picked around it', around.cover.id === 'b' && !around.extras.includes(rb) && around.avatar !== rb, around.extras.map((j) => j.id));
eq('"none" leaves the page without a cover, for the founder to look at', await A.reviewCover(covs, mini([JSON.stringify({ best: 'none', why: 'all dark' })])), null);
eq('one choice needs no review: no call is made', (await A.reviewCover([covs[0]], mini([])).then((j) => j.id)), 'a');
eq('an id it was not shown is refused, and a second bad answer is an error the factory catches', await A.reviewCover(covs, mini(['{"best":"zz"}', '{"best":"zz"}'])).catch((e) => e.code), 'bad-json');
/* A venue whose site has no 1000-px hero still gets a cover (2026-10-01, Sand & Tan opened on a gradient). */
const vsite = [{ id: 'v1', from: 'website', group: 'w1', isAct: true, coverOk: false, quality: 0.8, textOverlay: 0, width: 900, height: 600, kind: 'room' },
  { id: 'v2', from: 'website', group: 'w2', isAct: true, coverOk: false, quality: 0.9, textOverlay: 0, width: 700, height: 900, kind: 'food' }];
eq('a venue with no 1000-px cover takes its best wide photo instead', A.pickPhotos(vsite, { kind: 'venue' }).cover.id, 'v1');
eq('an artist does not: its cover must be the act, big and wide', A.pickPhotos(vsite).cover, null);
eq('and a venue never makes a tall photo its cover', A.pickPhotos([vsite[1]], { kind: 'venue' }).cover, null);

console.log('\nTHE GATE  when the founder should look first');
const full = { kind: 'artist', name: 'X', identity: { ok: true, confidence: 0.9 }, cover: true, avatar: true, extras: 2, sentences: 3, tagline: 't', links: { instagram: 'i', website: 'w' }, media: 2 };
let g = F.qualityOf(full);
ok('everything there: 1.0 and straight through', g.score === 1 && !g.review, g);
g = F.qualityOf({ ...full, cover: false });
ok('no cover: under 0.85, review', g.score < 0.85 && g.review && g.failed.includes('cover'), g);
g = F.qualityOf({ ...full, identity: { ok: true, confidence: 0.82 } });
ok('a full page whose identity is 0.82: review anyway', g.score === 1 && g.review, g);
g = F.qualityOf({ ...full, cover: false, avatar: false, extras: 0 });
ok('no photo passed at all: review', g.review, g);
g = F.qualityOf({ ...full, identity: { ok: false, confidence: 0.95 } });
ok('an identity no seed anchor backs fails its check', g.review && g.failed.includes('identity'), g);
eq('a band keeps its whole name; a person is split', [F.splitName('The Tide Lines', 'duo'), F.splitName('Maya Lin', 'solo'), F.splitName('DJ Shadow', 'solo')],
   [{ first: 'The Tide Lines', last: '' }, { first: 'Maya', last: 'Lin' }, { first: 'DJ Shadow', last: '' }]);

console.log('\nSUPPRESSION  somebody who pressed Remove is never built again');
const ids = F.suppressIds(S.parseSeed(SEED));
ok('the seed answers to its address, name|city, handle and host', ['thetidelines', 'the tide lines|koh phangan', '@thetidelines', 'thetidelines.com'].every((x) => ids.includes(x)), ids);
ok('a Linktree is never an identifier', !F.suppressIds(S.parseSeed('Tide | https://linktr.ee/tide')).includes('linktr.ee'));
hits.length = 0; ai.calls.length = 0;
let r = await F.runJob({ kind: 'artist', seed: { line: SEED } }, { ...net, isSuppressed: async (x) => x.includes('thetidelines') });
ok('THE POINT: a suppressed seed is skipped before one request is made', r.skipped === 'suppressed' && !r.ok && hits.length === 0 && ai.calls.length === 0, { r, hits: hits.length });
r = await F.runJob({ kind: 'artist', seed: { line: SEED } }, { ...net, isSuppressed: async (x) => x.includes(CH.toLowerCase()) });
ok('and one discovery reveals is caught on the second check', r.skipped === 'suppressed' && ai.calls.length === 1, ai.calls.length);
r = await F.runJob({ kind: 'artist', seed: { line: SEED } }, { ...net, env: {}, isSuppressed: async () => false });
ok('no ANTHROPIC_API_KEY: no-key, and not worth retrying', r.error === 'no-key' && r.fatal, r);
const SM = await import('../netlify/functions/_sample.mjs');
await SM.suppress(['thetidelines.com']);                          // as Remove does, on an earlier page
r = await F.runJob({ kind: 'artist', seed: { line: SEED } }, { ...net });
ok('no check passed in: _sample.mjs’s own is used, and it agrees on the spelling', r.skipped === 'suppressed', r.error || r.skipped);
__reset();

console.log('\nTHE WHOLE JOB  one line in, one createSample payload out');
hits.length = 0; ai.calls.length = 0; sleeps.length = 0;
const stages = [];
r = await F.runJob({ kind: 'artist', seed: { line: SEED } }, { ...net, isSuppressed: async () => false, onStage: (st, pct) => { stages.push([st, pct]); } });
ok('it builds', r.ok, r.error);
const P = r.payload || {};
eq('eight stages, in order, with their percentages', stages, Object.entries(F.STAGES));
eq('the name, the address it wants, and a band’s whole name as first', [P.kind, P.name, P.slug, P.first, P.last], ['artist', 'The Tide Lines', 'thetidelines', 'The Tide Lines', '']);
eq('where they are', [P.city, P.country], ['Koh Phangan', 'Thailand']);
eq('one link of each kind, canonical https', P.links, { instagram: 'https://www.instagram.com/thetidelines/', spotify: SPOTIFY,
  applemusic: 'https://music.apple.com/th/artist/the-tide-lines/1500000001', ytmusic: '', bandcamp: 'https://thetidelines.bandcamp.com/', gofundme: '',
  website: 'https://thetidelines.com/', tiktok: 'https://www.tiktok.com/@thetidelines', youtube: 'https://www.youtube.com/@thetidelines', soundcloud: '',
  facebook: 'https://www.facebook.com/thetidelinesband' });
eq('and where each came from', [P.provenance.links.spotify, P.provenance.links.facebook, P.provenance.links.tiktok, P.provenance.links.bandcamp, P.provenance.links.applemusic],
   ['site', 'site', 'discover', 'musicbrainz', 'itunes']);
ok('the bar they play is NOT taken for their Facebook', P.provenance.held.some((x) => /sunsetbarkpg/.test(x.url)) && !/sunsetbarkpg/.test(P.links.facebook));
ok('a search page is not a profile: dropped', P.provenance.dropped.some((x) => x.k === 'soundcloud'));
ok('the best video leads as the hero, the Short is nowhere', P.media[0].hero && /wonderwall1/.test(P.media[0].url) && P.media.filter((m) => m.hero).length === 1
   && !P.media.some((m) => /shortjam/.test(m.url)), P.media);
ok('the Spotify artist player is in; an Apple match by name alone is not featured', P.media.some((m) => m.url === SPOTIFY) && !P.media.some((m) => /apple/.test(m.url)));
const ph = P.photos || {};
eq('YouTube first: the cover is a thumbnail, the portrait another video’s frame', [ph.cover && ph.cover.src.yt, ph.avatar && ph.avatar.src.yt],
   [{ id: 'wonderwall1', variant: 'maxresdefault' }, { id: 'tidesong001', variant: 'maxres1' }]);
eq('three extras: another video, then the website’s — one frame per video', [ph.p0 && ph.p0.src.yt && ph.p0.src.yt.id, ph.p1 && ph.p1.from, ph.p2 && ph.p2.src.url],
   ['riptide0001', 'website', 'https://thetidelines.com/wp-content/uploads/hero-1600x1067.jpg']);
ok('the too-big website picture came in as its smaller WordPress copy', ph.p2 && ph.p2.width === 1600);
ok('a live video ranked past the top three is looked at for frames; the fourth, not live, is not (0159)', hit('/vi/hollowlive1/maxresdefault') && !hit('/vi/vlogday0003/maxres'));
ok('the bio is asked for in a magazine voice with a wink of humour, still only from the facts (0161)', (ai.copySys || []).some((x) => !/VENUE|venue’s/.test(x) && /bio: exactly two sentences/.test(x) && /magazine/.test(x) && /wink of humour/.test(x) && /never an invented fact/.test(x) && /Only what the facts say/.test(x) && /exactly two sentences/.test(x)));
ok('the cover review ran once, on two to four covers', (ai.covers || []).length >= 1 && ai.covers.every((ids) => ids.length >= 2 && ids.length <= 4), ai.covers);
ok('every photo is real bytes under 900 KB, with a focus point', Object.values(ph).every((x) => Buffer.isBuffer(x.bytes) && x.bytes.length <= 900 * 1024 && /^\d+% \d+%$/.test(x.focus)));
ok('the logo and the title-covered pictures were judged and left out', P.provenance.judged.some((j) => j.kind === 'logo') && !Object.values(P.provenance.photos).some((x) => /avatar|banner/.test(x)));
eq('the founder’s note is source 0, labelled as what it is', P.sources[0], { url: '', kind: 'seed', title: 'The founder’s note' });
ok('the website pages, the channel and MusicBrainz are sources', ['website', 'youtube', 'musicbrainz'].every((k) => P.sources.some((x) => x.kind === k)));
ok('THE POINT: a fact with no source, or a source it was never given, is not a fact', !P.facts.items.some((f) => /Best band|major label/.test(f.v))
   && P.facts.items.every((f) => f.src.length && f.src.every((i) => i >= 0 && i < P.sources.length)), P.facts.items);
ok('the repair was asked for once, with the checker’s complaint', ai.calls.filter((c) => /· FACTS/.test(c.body.system)).length === 2
   && /That did not pass the check/.test(ai.calls.filter((c) => /· FACTS/.test(c.body.system))[1].body.messages[2].content));
eq('THE POINT: the unsourced sentence and the invented number never reach the bio', P.facts.copy.text.map((x) => x.s), [
  'The Tide Lines are Mia Hart on vocals and Joe Lin on guitar, an acoustic duo.',
  'They formed on Koh Phangan in 2019 and play every Friday at Sunset Bar.']);
ok('the bio is those two sentences, under 400 (0158)', P.bio === P.facts.copy.text.map((x) => x.s).join(' ') && P.bio.length <= 400);
eq('tagline, style and the hook', [P.tagline, P.style, P.msgs.hook], ['Acoustic duo playing indie folk and covers on Koh Phangan', 'Acoustic duo · indie folk · covers', 'Loved your live Wonderwall from Sunset Bar.']);
ok('the gate: everything passed, no review needed', P.quality.score === 1 && P.quality.review === false, P.quality);
ok('Remove will suppress all of it', [F.suppressIds(S.parseSeed(SEED))[0], 'the tide lines|koh phangan', CH.toLowerCase(), '@thetidelines', 'thetidelines.com'].every((x) => P.supIds.includes(x)), P.supIds);
eq('the seed line rides along for a rebuild', P.seed.line, SEED);
ok('the cost is estimated from every call, searches included', P.usage.estimate && P.usage.searches === 2 && P.usage.usd > 0 && P.usage.list.map((u) => u.call).includes('facts:repair'), P.usage);
ok('the provenance carries no picture bytes', !JSON.stringify(P.provenance).includes('"bytes"') && !JSON.stringify(P.provenance).includes('"type":"Buffer"'));
ok('MySetBot reads pages; the databases get the contact agent', hits.filter((x) => /thetidelines\.com/.test(x.url)).every((x) => x.ua === S.BOT_UA)
   && hits.filter((x) => /musicbrainz|itunes/.test(x.url)).every((x) => x.ua === S.API_UA));
ok('MusicBrainz is paced at one a second', sleeps.some((ms) => ms >= 1000));
ok('nothing was fetched from Instagram, Facebook or TikTok, and robots was obeyed', !hits.some((x) => /instagram\.com|facebook\.com|tiktok\.com|\/private\//.test(x.url)));
const key = ai.calls[0].headers;
ok('the Claude calls carry the key and the API version', key['x-api-key'] === process.env.ANTHROPIC_API_KEY && key['anthropic-version'] === '2023-06-01');
ok('the fast model extracts, the smart one judges and writes', ai.calls.filter((c) => /· FACTS/.test(c.body.system)).every((c) => c.body.model === 'claude-haiku-4-5-20251001')
   && ai.calls.filter((c) => /· (PHOTOS|COPY|DISCOVER)/.test(c.body.system)).every((c) => c.body.model === 'claude-sonnet-5'));
ai.conf = 0.6;
r = await F.runJob({ kind: 'artist', seed: { line: SEED } }, { ...net, isSuppressed: async () => false });
ok('an identity of 0.6: built, but it waits for the founder', r.ok && r.payload.quality.review && !r.payload.quality.checks.identity && r.payload.quality.score < 0.85, r.payload && r.payload.quality);
ai.conf = 0.92;
ok('no songs asked for, no songs call and none on the page', !ai.calls.some((c) => /· SONGS/.test(c.body.system)) && !('songs' in P));

console.log('\nTWENTY SUGGESTED SONGS  asked for on the form (decision 0167)');
ai.calls.length = 0; ai.songsAsked = []; ai.songsShort = true;
r = await F.runJob({ kind: 'artist', seed: { line: SEED, songs: true, photos: ['https://img.test/sunset-inside.jpg'] } }, { ...net, isSuppressed: async () => false });
ai.songsShort = false;
const SG = (r.payload || {}).songs;
ok('it builds, with twenty songs', r.ok && SG && SG.songs.length === 20, r.error || SG);
eq('ten of the main genre first, then five and five of its neighbours', SG.songs.map((x) => x.group).join(','), [...Array(10).fill('main'), ...Array(5).fill('near1'), ...Array(5).fill('near2')].join(','));
eq('the genre and its two neighbours ride along', [SG.genre, SG.near], ['Indie folk', ['Americana', 'Folk rock']]);
ok('nineteen is refused and repaired once', ai.calls.filter((c) => /· SONGS/.test(c.body.system)).length === 2 && P.usage && r.payload.usage.list.some((u) => u.call === 'songs:repair'));
ok('asked from the facts and the place, with the smart model', /genre: Indie folk/.test(ai.songsAsked[0]) && /Koh Phangan, Thailand/.test(ai.songsAsked[0])
   && ai.calls.filter((c) => /· SONGS/.test(c.body.system)).every((c) => c.body.model === 'claude-sonnet-5'));
ok('THE POINT of 0166: the founder’s photo is judged before any video frame or website image', (r.payload.provenance.judged[0] || {}).id === 'f1', r.payload.provenance.judged.map((j) => j.id));
eq('the songs ask rides on the seed, so a rebuild asks again', r.payload.seed.songs, true);
ai.songsFail = true;
r = await F.runJob({ kind: 'artist', seed: { line: SEED, songs: true } }, { ...net, isSuppressed: async () => false });
ai.songsFail = false;
ok('a failed songs call costs the song list, never the page', r.ok && !r.payload.songs && !!r.payload.provenance.errors.songs, r.error || r.payload.provenance.errors);
ai.calls.length = 0;
r = await F.runJob({ kind: 'venue', seed: { line: 'Sunset Bar | Koh Phangan, Thailand', songs: true } }, { ...net, isSuppressed: async () => false });
ok('a venue has no song list: never asked', !ai.calls.some((c) => /· SONGS/.test(c.body.system)) && !(r.payload || {}).songs);

console.log('\nA VENUE  OpenStreetMap, opening hours, amenities, a founder’s photo');
r = await F.runJob({ kind: 'venue', seed: { line: 'Sunset Bar | https://www.google.com/maps/place/Sunset+Bar/@9.7312,100.0136,17z | Koh Phangan, Thailand',
  photos: ['https://img.test/sunset-inside.jpg'] } }, { ...net, isSuppressed: async () => false });
const V = r.payload || {};
eq('the hours reader: a week that wraps, 26:00 as two in the morning', F.parseHours('Sa-Mo 20:00-26:00'),
   { mon: { closed: false, open: '20:00', close: '02:00' }, tue: { closed: true, open: '17:00', close: '01:00' }, wed: { closed: true, open: '17:00', close: '01:00' },
     thu: { closed: true, open: '17:00', close: '01:00' }, fri: { closed: true, open: '17:00', close: '01:00' }, sat: { closed: false, open: '20:00', close: '02:00' },
     sun: { closed: false, open: '20:00', close: '02:00' } });
eq('anything richer is left out, never guessed', [F.parseHours('Mo-Su 10:00-22:00; PH off'), F.parseHours('24/7'), F.parseHours('Mo-Fr 09:00-12:00,14:00-18:00')], [null, null, null]);
const hk = (o) => o && Object.entries(o).map(([d, x]) => d + (x.closed ? ':shut' : `:${x.open}-${x.close}`)).join(' ');
eq('HOURS AS A PERSON TYPES THEM (0132): daily, am/pm, an en dash', hk(F.humanHours('Daily 8 AM–10 PM')), 'mon:08:00-22:00 tue:08:00-22:00 wed:08:00-22:00 thu:08:00-22:00 fri:08:00-22:00 sat:08:00-22:00 sun:08:00-22:00');
eq('ranges, a list of days, "to", a day shut after the fact', hk(F.humanHours('Mon-Fri 5pm-1am; Sat, Sun 12pm to 2am; Tue closed')),
   'mon:17:00-01:00 tue:shut wed:17:00-01:00 thu:17:00-01:00 fri:17:00-01:00 sat:12:00-02:00 sun:12:00-02:00');
eq('full day names, "till", midnight', hk(F.humanHours('Thursday to Sunday 6pm till midnight')), 'mon:shut tue:shut wed:shut thu:18:00-00:00 fri:18:00-00:00 sat:18:00-00:00 sun:18:00-00:00');
eq('what it cannot read is refused, never guessed', [F.humanHours('blah'), F.humanHours('Mon-Fri'), F.humanHours('Daily 13pm-2am'), F.humanHours('')], [null, null, null, null]);
ok('it builds', r.ok, r.error);
eq('the seven days, from the OSM hours: Tuesday shut', V.hours && [V.hours.mon, V.hours.tue], [{ closed: false, open: '17:00', close: '01:00' }, { closed: true, open: '17:00', close: '01:00' }]);
ok('amenities from OSM tags and sourced facts, every one a real key', V.amenities && V.amenities.includes('outdoor') && V.amenities.includes('livemusic'), V.amenities);
eq('address, phone, coordinates and the map link', [V.address, V.phone, V.lat, V.mapUrl], ['Haad Rin Road, Haad Rin, Ban Tai, 84280', '+66 81 234 5678', 9.7312,
   'https://www.google.com/maps/place/Sunset+Bar/@9.7312,100.0136,17z']);
ok('OpenStreetMap is credited in the sources', V.sources.some((x) => x.kind === 'osm' && /OpenStreetMap contributors/.test(x.title)));
ok('the founder’s photo is the cover; a venue has no portrait', V.photos.cover && V.photos.cover.from === 'founder' && !V.photos.avatar);
ok('a venue’s about is asked for in the same magazine voice (0161)', (ai.copySys || []).some((x) => /about: exactly two sentences/.test(x) && /magazine/.test(x) && /wink of humour/.test(x) && /never an invented fact/.test(x) && /Only what the facts say/.test(x) && /exactly two sentences/.test(x)));
ok('the tagline is asked for in the magazine voice too, for acts and venues, still from a fact (0163)', ['bio', 'about'].every((k) => (ai.copySys || []).some((x) => new RegExp(k + ': exactly two sentences').test(x) && /tagline: at most 120 characters, in the same magazine voice/.test(x) && /never an invented one/.test(x) && /the style plain|the tagline and the about/.test(x))));
ok('about, not bio; and it passes', V.about === 'Sunset Bar is a bar with outdoor seating. It puts on live music.' && !V.quality.review, V.quality);

console.log('\nTHE WORKER  only with the key, and a job moves through its states');
__reset();
const KEY = await F.factoryKey();
const W = (body, k = KEY, method = 'POST') => BG.default(new Request('https://factory.test/.netlify/functions/factory-background',
  method === 'POST' ? { method, headers: { 'content-type': 'application/json', ...(k ? { 'x-factory-key': k } : {}) }, body: JSON.stringify(body) } : { method }));
const job = (id, extra = {}) => ({ id, kind: 'artist', seed: { line: SEED }, label: id, st: 'queued', stage: '', pct: 0, at: NOW, upd: NOW, tries: 0, ...extra });
const putJobs = (list) => casDoc('factoryq', F.emptyQ, (q) => { q.jobs = list; return true; });
const jobOf = async (id) => ((await readDoc('factoryq', null)).data.jobs || []).find((j) => j.id === id);
const made = [];
BG.deps.now = () => NOW;
BG.deps.sample = async () => ({ isSuppressed: async () => false, createSample: async (payload) => { made.push(payload); return { ok: true, owner: 'thetidelines', slug: 'thetidelines' }; } });
BG.deps.runOpts = { fetch: fakeFetch, lookup: fakeLookup, sleep: async () => {}, now: () => NOW };
await putJobs([job('jreal01')]);
eq('GET is refused', (await W(null, KEY, 'GET')).status, 405);
eq('no key: refused', (await W({ id: 'jreal01' }, '')).status, 401);
eq('a wrong key: refused', (await W({ id: 'jreal01' }, KEY.slice(0, -2) + 'xx')).status, 401);
eq('and the job was not touched', (await jobOf('jreal01')).st, 'queued');
__opsStart();
let out = await (await W({ id: 'jreal01' })).text();
const writes = __opsStop().filter((x) => x === 'set factoryq').length;
let J = await jobOf('jreal01');
ok('with the key: built, handed to createSample, done', out === 'done' && J.st === 'done' && J.owner === 'thetidelines' && J.pct === 100 && J.run === '', J);
ok('the job carries the quality and the cost', J.q === 1 && J.rv === false && J.cost > 0, J);
ok('one progress write per stage at most (claim + 8 + done)', writes <= 10, writes);
ok('createSample got the whole payload, the seed line with it, and no replace', made.length === 1 && made[0].seed.line === SEED && !('replace' in made[0]) && made[0].photos.cover);
eq('a finished job is never built again', await (await W({ id: 'jreal01' })).text(), 'not-ours');
BG.deps.run = async () => ({ ok: true, payload: { slug: 'thetidelines', quality: { score: 0.9, review: false }, seed: { line: 'x' } }, usage: [] });
await putJobs([job('jrebuild', { replace: 'oldowner' })]);
await W({ id: 'jrebuild' });
eq('a rebuild passes `replace` through and leaves the address to the old page', [made.at(-1).replace, made.at(-1).slug], ['oldowner', '']);
BG.deps.run = async () => ({ ok: false, skipped: 'suppressed', usage: [] });
await putJobs([job('jskip')]);
await W({ id: 'jskip' });
J = await jobOf('jskip');
eq('suppressed: skipped, never retried', [J.st, J.err], ['skipped', 'suppressed']);
BG.deps.run = async () => ({ ok: false, error: 'busy: Claude 529', usage: [{ call: 'facts', model: 'claude-haiku-4-5', in: 1000, out: 100, searches: 0 }] });
await putJobs([job('jflaky')]);
await W({ id: 'jflaky' });
J = await jobOf('jflaky');
ok('a failure goes back in line, counted, with its cost', J.st === 'queued' && J.tries === 1 && J.stage === 'retry' && /529/.test(J.err) && J.cost > 0, J);
await W({ id: 'jflaky' });
J = await jobOf('jflaky');
eq('the second failure is final', [J.st, J.tries], ['failed', 2]);
BG.deps.run = async () => ({ ok: false, error: 'no-key', fatal: true, usage: [] });
await putJobs([job('jnokey')]);
await W({ id: 'jnokey' });
eq('no key: failed at once, not retried', [(await jobOf('jnokey')).st, (await jobOf('jnokey')).tries], ['failed', 1]);
await putJobs([job('jbusy', { st: 'running', run: 'someoneelse', upd: NOW - 60e3 })]);
eq('a job another worker holds is left alone', await (await W({ id: 'jbusy' })).text(), 'not-ours');
BG.deps.run = async (j) => { await casDoc('factoryq', F.emptyQ, (q) => { q.jobs = q.jobs.filter((x) => x.id !== j.id); return true; }); return { ok: true, payload: { quality: { score: 1, review: false } }, usage: [] }; };
await putJobs([job('jcancel')]);
const before = made.length;
eq('cancelled while it was building: nothing is created', [await (await W({ id: 'jcancel' })).text(), made.length], ['cancelled', before]);
BG.deps.run = async () => ({ ok: true, payload: { quality: { score: 1, review: false } }, usage: [] });
BG.deps.sample = async () => ({ isSuppressed: async () => false, createSample: async () => ({ ok: false, error: 'Couldn’t hold a page address — try again.' }) });
await putJobs([job('jcreate')]);
await W({ id: 'jcreate' });
ok('createSample refusing puts the job back in line', (await jobOf('jcreate')).st === 'queued' && /create:/.test((await jobOf('jcreate')).err));

console.log('\nTHE BELL  three a ring, never more than the day allows');
__reset();
const T0 = Date.now();
let offset = 0;
CRON.deps.now = () => T0 + offset;
const sweeps = [];
CRON.deps.sample = async () => ({ sweepSamples: async (n, limit) => { sweeps.push([n, limit]); return { archived: [], erased: [] }; } });
const knocks = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => { knocks.push({ url: String(url), key: (init.headers || {})['x-factory-key'], id: JSON.parse(init.body || '{}').id }); return new Response('', { status: 202 }); };
await casDoc('factorycfg', () => ({}), (c) => { c.perDay = 4; return true; });
await putJobs(['j1', 'j2', 'j3', 'j4', 'j5', 'j6'].map((id, i) => job(id, { at: T0 + i, upd: T0 + i })));
const ring = async () => (await CRON.default(new Request('https://factory.test/.netlify/functions/factorycron', { method: 'POST', body: JSON.stringify({ next_run: 'x' }) }))).text();
const running = async () => ((await readDoc('factoryq', null)).data.jobs || []).filter((j) => j.st === 'running').map((j) => j.id);
eq('first ring: three started', [await ring(), await running()], ['ok', ['j1', 'j2', 'j3']]);
ok('each knock went to the worker, with the key, one job each', knocks.length === 3 && knocks.every((k) => k.url === 'https://factory.test/.netlify/functions/factory-background' && k.key === KEY)
   && knocks.map((k) => k.id).join() === 'j1,j2,j3', knocks);
offset = 60e3;
eq('a ring a minute later does nothing', [await ring(), knocks.length], ['too soon', 3]);
offset = 5 * 60e3;
eq('five minutes on: only one more — the day allows four', [await ring(), (await running()).length, knocks.length], ['ok', 4, 4]);
offset = 10 * 60e3;
eq('and then none', [await ring(), knocks.length], ['ok', 4]);
await casDoc('factoryq', F.emptyQ, (q) => { for (const j of q.jobs) { if (j.id === 'j1') j.upd = T0 - 25 * 60e3; if (j.id === 'j2') { j.upd = T0 - 25 * 60e3; j.tries = 1; } } return true; });
offset = 15 * 60e3;
await ring();
eq('a worker silent for twenty minutes: its job back in line; a second time, failed', [(await jobOf('j1')).st, (await jobOf('j1')).tries, (await jobOf('j2')).st], ['queued', 1, 'failed']);
await casDoc('factoryq', F.emptyQ, (q) => { q.day = '2000-01-01'; return true; });
offset = 20 * 60e3;
await ring();
eq('a new UTC day: the count starts again', knocks.slice(4).map((k) => k.id), ['j1', 'j5', 'j6']);
ok('the samples clock ran on every ring that ran, five at most', sweeps.length === 5 && sweeps.every(([, limit]) => limit === 5), sweeps);
await casDoc('factoryq', F.emptyQ, (q) => { q.runningSince = T0 + 25 * 60e3; return true; });
offset = 25 * 60e3 + 1000;
eq('one ring at a time', await ring(), 'busy');
globalThis.fetch = realFetch;

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
