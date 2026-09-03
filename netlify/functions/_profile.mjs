import { casDoc, readDoc, KEY } from './_lib.mjs';
import { parseMedia, embedSrc, linkOut, embedShape } from './_embeds.mjs';

/* HOW MANY SMALL PHOTOS AN ARTIST GETS, named rather than inlined as a 3.

   It used to be enforced twice by accident: this file trimmed the array on read,
   and the shared SLOTS set in _img.mjs only listed p0..p2 so the endpoint refused
   anything higher. On 2026-09-03 SLOTS was widened to p0..p11 for venue Pro — and
   that silently removed the second guard, so an artist could store nine extra
   images that no page would ever show. The bytes would still be in Blobs.

   So the cap lives here, once, and admin.mjs checks it explicitly. A VENUE's cap
   is a plan limit and lives in VENUE_PLANS instead; the slot set is a list of
   valid names, not a limit on anybody. */
export const MAX_PHOTOS = 3;

export const defaultProfile = () => ({
  v: 1,
  artistId: null,
  name: '',
  tagline: '',
  bio: '',
  photo: '/img/band.jpg',
  avatar: '',            // the big square portrait
  photos: [],            // up to MAX_PHOTOS small ones clustered around it
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
  out.name = clean(out.name, 60);
  out.tagline = clean(out.tagline, 120);
  out.bio = String(out.bio || '').replace(/\r/g, '').slice(0, 700);    // newlines kept
  out.photo = String(out.photo == null ? d.photo : out.photo).slice(0, 300);
  out.avatar = String(out.avatar || '').slice(0, 300);
  /* Positional, for the same reason as the venue's (see normVenue): `.filter`
     compacted the array, so clearing photo 1 slid photo 2 into its slot. Only
     trailing blanks are dropped, so the array stays short when it can. */
  out.photos = (Array.isArray(out.photos) ? out.photos : [])
    .slice(0, MAX_PHOTOS)
    .map((x) => String(x || '').slice(0, 300));
  while (out.photos.length && !out.photos[out.photos.length - 1]) out.photos.pop();
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

export async function getProfile(aid) {
  const { data } = await readDoc(KEY.profile(aid), null);
  const p = normProfile(data);
  p.artistId = aid;
  return p;
}
export const mutateProfile = (aid, fn) =>
  casDoc(KEY.profile(aid), defaultProfile, (p) => {
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
