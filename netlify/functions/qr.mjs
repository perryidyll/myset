import { bad } from './_lib.mjs';
import { qrSvg } from './_qr.mjs';
import { artistBySlug, cleanSlug, artistById } from './_auth.mjs';

/* Public QR codes — but only ever for MySet's own URLs.

   Deliberately NOT a general "encode this text" endpoint: that would make the
   site a free generator of QR codes pointing anywhere, which is exactly the
   shape of a phishing tool. The caller picks a kind; the URL is built here. */

const KINDS = {
  home:    () => 'https://myset.vip',
  profile: (slug) => `https://myset.vip/${slug}`,
  vote:    (slug) => `https://myset.vip/${slug}/vote`,
  invite:  (slug) => `https://myset.vip/signup?ref=${slug}`,
};

export default async (req) => {
  const q = new URL(req.url).searchParams;
  const kind = q.get('k') || 'home';
  if (!KINDS[kind]) return bad('unknown code', 404);

  let slug = '';
  if (kind !== 'home') {
    slug = cleanSlug(q.get('a'));
    if (!slug) return bad('which artist?', 400);
    // resolve so a made-up slug cannot be turned into a printable code
    const aid = await artistBySlug(slug);
    if (!aid) return bad('unknown artist', 404);
    slug = (await artistById(aid)).slug;
  }

  const scale = Math.max(2, Math.min(24, parseInt(q.get('s'), 10) || 8));
  const svg = qrSvg(KINDS[kind](slug), { scale });
  if (!svg) return bad('could not build that code', 500);

  return new Response(svg, {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=86400',
      'access-control-allow-origin': '*',
    },
  });
};
