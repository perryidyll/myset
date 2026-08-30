/* Turning a pasted URL into an embed, safely.

   The rule: the artist's string is a PARSE INPUT, never a record and never an
   iframe src. We extract an id, re-validate it against a strict pattern, and
   rebuild the URL from a literal template. Host checks are exact Set lookups —
   `includes('youtube.com')` would match `evil.com/?x=youtube.com`, and both
   `youtube.com@evil.tld` and `open.spotify.com.evil.tld` defeat naive matching.

   All templates below were live-tested on 2026-08-31. */

/* ── YouTube (and YouTube Music, which carries ordinary video ids) ───────── */
const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtu.be', 'www.youtu.be', 'youtube-nocookie.com', 'www.youtube-nocookie.com',
]);
const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST = /^(PL|UU|OL|RD|FL|LL|SP|OLAK5uy_)[A-Za-z0-9_-]{10,}$/;

export function parseYouTube(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!YT_HOSTS.has(host)) return null;

  const seg = u.pathname.split('/').filter(Boolean);
  let id = null;
  if (host === 'youtu.be' || host === 'www.youtu.be') id = seg[0] || null;
  else if (seg[0] === 'watch') id = u.searchParams.get('v');
  else if (['embed', 'shorts', 'live', 'v'].includes(seg[0]))
    id = seg[1] === 'videoseries' ? null : (seg[1] || null);

  const listRaw = u.searchParams.get('list');
  const list = listRaw && YT_LIST.test(listRaw) ? listRaw : null;
  if (id && !YT_ID.test(id)) id = null;
  if (!id && !list) return null;

  const t = u.searchParams.get('start') || u.searchParams.get('t');
  let start = null;
  if (t) {
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
    if (m) {
      const sec = (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
      if (sec > 0 && sec < 86400) start = sec;
    }
  }
  return { provider: 'youtube', id, list, start, vertical: seg[0] === 'shorts' };
}

/* ── Spotify ─────────────────────────────────────────────────────────────── */
const SP_TYPES = new Set(['track', 'album', 'artist', 'playlist', 'show', 'episode']);
const SP_ID = /^[A-Za-z0-9]{22}$/;

export function parseSpotify(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host !== 'open.spotify.com' && host !== 'play.spotify.com') return null;

  let seg = u.pathname.split('/').filter(Boolean);
  if (/^intl-[a-z]{2}$/i.test(seg[0] || '')) seg = seg.slice(1);   // localised share links
  if (seg[0] === 'embed' || seg[0] === 'embed-podcast') seg = seg.slice(1);

  const [type, id] = seg;
  if (!SP_TYPES.has(type) || !SP_ID.test(id || '')) return null;
  return { provider: 'spotify', type, id };
}

/* ── Apple Music ─────────────────────────────────────────────────────────── */
const AM_TYPES = new Set(['album', 'song', 'artist', 'playlist', 'music-video']);

export function parseAppleMusic(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!['music.apple.com', 'embed.music.apple.com', 'geo.music.apple.com'].includes(host)) return null;

  let seg = u.pathname.split('/').filter(Boolean);
  let cc = 'us';
  if (/^[a-z]{2}$/i.test(seg[0] || '')) { cc = seg[0].toLowerCase(); seg = seg.slice(1); }

  const type = seg[0];
  const id = seg[2] || seg[1];                       // /{type}/{slug}/{id} or /{type}/{id}
  if (!AM_TYPES.has(type) || !id) return null;
  const ok = type === 'playlist' ? /^pl\.[A-Za-z0-9-]+$/.test(id) : /^\d{3,15}$/.test(id);
  if (!ok) return null;

  const iRaw = u.searchParams.get('i');
  return { provider: 'applemusic', cc, type, id, i: iRaw && /^\d{3,15}$/.test(iRaw) ? iRaw : null };
}

export const parseMedia = (raw) =>
  parseYouTube(raw) || parseSpotify(raw) || parseAppleMusic(raw) || null;

/* ── rebuild from literal templates ──────────────────────────────────────── */
export function embedSrc(m) {
  if (!m) return null;
  if (m.provider === 'youtube') {
    const p = new URLSearchParams();
    if (m.start) p.set('start', String(m.start));
    let path;
    if (m.id) { path = encodeURIComponent(m.id); if (m.list) p.set('list', m.list); }
    else { path = 'videoseries'; p.set('list', m.list); }
    const q = p.toString();
    return `https://www.youtube-nocookie.com/embed/${path}${q ? '?' + q : ''}`;
  }
  if (m.provider === 'spotify')
    return `https://open.spotify.com/embed/${m.type}/${encodeURIComponent(m.id)}`;
  if (m.provider === 'applemusic') {
    // the slug is cosmetic — a literal "_" renders correctly and means artist
    // text never reaches the URL
    const base = `https://embed.music.apple.com/${m.cc}/${m.type}/_/${encodeURIComponent(m.id)}`;
    return m.i ? `${base}?i=${encodeURIComponent(m.i)}` : base;
  }
  return null;
}

export function linkOut(m) {
  if (!m) return null;
  if (m.provider === 'youtube')
    return m.id ? `https://www.youtube.com/watch?v=${m.id}`
                : `https://www.youtube.com/playlist?list=${m.list}`;
  if (m.provider === 'spotify') return `https://open.spotify.com/${m.type}/${m.id}`;
  if (m.provider === 'applemusic')
    return `https://music.apple.com/${m.cc}/${m.type}/_/${m.id}` + (m.i ? `?i=${m.i}` : '');
  return null;
}

/* Widget heights are discrete states, not a scale — an arbitrary height just
   letterboxes. YouTube alone gets an aspect-ratio box. */
export function embedShape(m) {
  if (m.provider === 'youtube') return { ratio: m.vertical ? '9x16' : '16x9' };
  if (m.provider === 'spotify')
    return { height: (m.type === 'track' || m.type === 'episode') ? 152 : 352 };
  if (m.provider === 'applemusic')
    return { height: (m.type === 'song' || m.i) ? 175 : 450 };
  return { ratio: '16x9' };
}

/* Keyless validation at paste time. YouTube and Spotify both expose public
   oEmbed; Apple does not (its endpoint 404s), so an Apple id is accepted
   unvalidated and the artist eyeballs the live preview instead. */
export async function lookup(m) {
  const url = linkOut(m);
  try {
    if (m.provider === 'youtube') {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`);
      if (!r.ok) return { ok: false, why: 'That video is private, deleted, or has embedding turned off.' };
      const d = await r.json();
      return { ok: true, title: d.title || '', thumb: d.thumbnail_url || '' };
    }
    if (m.provider === 'spotify') {
      const r = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`);
      if (!r.ok) return { ok: false, why: 'Spotify doesn’t recognise that link.' };
      const d = await r.json();
      return { ok: true, title: d.title || '', thumb: d.thumbnail_url || '' };
    }
  } catch { /* network wobble shouldn't block a paste */ }
  return { ok: true, title: '', thumb: '' };
}
