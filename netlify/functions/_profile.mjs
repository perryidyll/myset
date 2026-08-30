import { casDoc, readDoc, ARTIST_ID } from './_lib.mjs';
import { parseMedia, embedSrc, linkOut, embedShape } from './_embeds.mjs';

export const defaultProfile = () => ({
  v: 1,
  artistId: ARTIST_ID,
  name: 'Perry Idyll',
  tagline: 'Live, and you pick the songs.',
  bio: '',
  photo: '/img/band.jpg',
  links: { spotify: '', applemusic: '', ytmusic: '', instagram: '', website: '' },
  media: [],
  updatedAt: Date.now(),
});

/* Link-outs are plain anchors, so an exact host allowlist plus an https check is
   enough — but the URL is still rebuilt through the URL parser rather than
   passed through as typed. */
const LINK_HOSTS = {
  spotify: ['open.spotify.com'],
  applemusic: ['music.apple.com', 'geo.music.apple.com'],
  ytmusic: ['music.youtube.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  website: null,                      // any https host
};
export function safeLink(kind, raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const allow = LINK_HOSTS[kind];
  if (allow && !allow.includes(host)) return '';
  u.hash = '';
  for (const junk of ['si', 'utm_source', 'utm_medium', 'utm_campaign', 'app', 'uo'])
    u.searchParams.delete(junk);
  return u.toString().slice(0, 300);
}

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

export function normProfile(p) {
  const d = defaultProfile();
  const out = { ...d, ...(p || {}) };
  out.artistId ||= ARTIST_ID;
  out.name = clean(out.name, 60) || d.name;
  out.tagline = clean(out.tagline, 120);
  out.bio = String(out.bio || '').replace(/\r/g, '').slice(0, 2000);   // newlines kept
  out.photo = String(out.photo || d.photo).slice(0, 300);
  const L = out.links || {};
  out.links = {
    spotify: safeLink('spotify', L.spotify),
    applemusic: safeLink('applemusic', L.applemusic),
    ytmusic: safeLink('ytmusic', L.ytmusic),
    instagram: safeLink('instagram', L.instagram),
    website: safeLink('website', L.website),
  };
  // anything that can no longer produce a valid embed src is dropped, whatever
  // it claims to be — the stored record is not trusted on read either
  out.media = (Array.isArray(out.media) ? out.media : [])
    .filter((m) => m && typeof m === 'object' && embedSrc(m))
    .map((m) => ({ ...m, title: clean(m.title, 120), thumb: String(m.thumb || '').slice(0, 300) }))
    .slice(0, 24);
  return out;
}

export async function getProfile() {
  const { data } = await readDoc('profile', null);
  return normProfile(data);
}
export const mutateProfile = (fn) =>
  casDoc('profile', defaultProfile, (p) => {
    const np = normProfile(p);
    Object.keys(p || {}).forEach((k) => delete p[k]);
    Object.assign(p, np);
    const r = fn(p);
    if (r === false) return false;
    const after = normProfile(p);        // sanitise whatever the handler wrote, too
    Object.keys(p).forEach((k) => delete p[k]);
    Object.assign(p, after);
    p.updatedAt = Date.now();
    return r;
  });

/* What the page actually renders. The stored record keeps only {provider,type,id};
   the iframe src is built here from a literal template every time. */
export function shapeMedia(m) {
  const src = embedSrc(m);
  if (!src) return null;
  return {
    mid: m.mid, provider: m.provider, title: m.title || '', thumb: m.thumb || '',
    src, href: linkOut(m), ...embedShape(m),
  };
}
export { parseMedia };
