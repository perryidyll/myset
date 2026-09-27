import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanSlug, artistBySlug } from './_auth.mjs';
import { getProfile } from './_profile.mjs';

/* THE ARTIST PAGE, WITH THE ARTIST ON ITS SHARE CARD (the founder, 2026-09-27).
   A link to myset.vip/<slug> pasted into iMessage, WhatsApp or Instagram showed the
   MySet icon, because /:slug was one static file for every artist and a link
   preview never runs the page's script. This serves the same artist.html, byte for
   byte, with four things written into its head for that artist:
     · og:image / twitter:image — the portrait, else the cover, else the MySet icon
     · og:title — the artist's name
     · og:url — the page's own address
     · twitter:card — the large picture
   Nothing else in the page changes, and everything the page does is unchanged: it
   still reads the artist from the address and fetches its own data.

   IT CAN ONLY EVER DEGRADE TO WHAT WAS THERE BEFORE. Any failure — an unknown slug,
   a slow or missing profile read — serves the untouched file, which is exactly what
   /:slug served until now. The profile read is capped at PROFILE_MS for the same
   reason: a fan opening the page never waits on a share card.

   CACHED ON NETLIFY'S DURABLE CACHE (9d6), so this runs about once per artist per
   CDN_FRESH seconds, not once per visit; a deploy clears it, so a change to
   artist.html reaches every artist at once. A new photo reaches the card within
   CDN_FRESH. The phone's own cache rule is the one /:slug had (max-age=60).

   Headers from netlify.toml do not reach a function's response (measured on
   /moneymodel, 2026-09-27), so the site-wide set is repeated here and
   test/sharecard.mjs holds it equal to netlify.toml's. */
export const PROFILE_MS = 1500;
export const CDN_FRESH = 300;
const ORIGIN = 'https://myset.vip';
export const FALLBACK_IMAGE = `${ORIGIN}/icons/icon-512.png`;

export const SITE_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://maps.googleapis.com https://maps.gstatic.com https://*.googleusercontent.com; media-src 'self' blob:; connect-src 'self' https://maps.googleapis.com https://maps.gstatic.com; font-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'self'; frame-ancestors 'self'; frame-src 'self' https://www.youtube-nocookie.com https://www.youtube.com https://open.spotify.com https://embed.music.apple.com; object-src 'none'; base-uri 'self'",
};

let SHELL = null;
function shell() {
  if (SHELL) return SHELL;
  const rel = 'public/artist.html';
  const here = fileURLToPath(import.meta.url);
  for (const p of [resolve(process.cwd(), rel), resolve(process.env.LAMBDA_TASK_ROOT || '', rel),
                   resolve(here, '../../../' + rel), resolve(here, '../' + rel)]) {
    try { if (existsSync(p)) return (SHELL = readFileSync(p, 'utf8')); } catch {}
  }
  return null;
}

const attr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* The picture a share card shows: the portrait, else the cover — only a path on
   this site or an https address, made absolute, because a crawler resolves nothing. */
export function shareImage(p) {
  for (const raw of [p && p.avatar, p && p.photo]) {
    const u = String(raw || '').trim();
    if (/^\/(?!\/)/.test(u)) return ORIGIN + u;
    if (/^https:\/\//.test(u)) return u;
  }
  return FALLBACK_IMAGE;
}

/* Writes the card into the page's head. Each tag is replaced where it stands, or
   added after og:image when the page has none; a page without og:image is left as
   it is, so a changed artist.html can never be broken by this, only not decorated. */
export function withShare(html, { name, image, url }) {
  if (!/<meta property="og:image"[^>]*>/.test(html)) return html;
  const tag = (k, v, by = 'property') => `<meta ${by}="${k}" content="${attr(v)}" />`;
  let out = html.replace(/<meta property="og:image"[^>]*>/, tag('og:image', image));
  if (name) out = out.replace(/<meta property="og:title"[^>]*>/, tag('og:title', name));
  const extra = [tag('og:url', url), tag('twitter:card', 'summary_large_image', 'name'), tag('twitter:image', image, 'name')]
    .filter((t) => !out.includes(t.slice(0, t.indexOf('content='))));
  return out.replace(/(<meta property="og:image"[^>]*>)/, `$1\n${extra.join('\n')}`);
}

const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

async function card(slug) {
  const aid = await artistBySlug(slug);
  if (!aid) return null;
  const p = await getProfile(aid);
  return { name: String(p.name || '').trim(), image: shareImage(p) };
}

export default async (req) => {
  const url = new URL(req.url);
  let html = shell();
  if (!html) {
    // the file did not ship with the function: the static copy, from this same site
    try { const r = await fetch(new URL('/artist.html', url.origin)); if (r.ok) html = await r.text(); } catch {}
    if (!html) return new Response('Something went wrong — pull down to try again.', { status: 503, headers: SITE_HEADERS });
  }
  try {
    const slug = cleanSlug(url.searchParams.get('a') || url.pathname.split('/').filter(Boolean)[0] || '');
    const c = slug ? await within(card(slug), PROFILE_MS) : null;
    if (c) html = withShare(html, { ...c, url: `${ORIGIN}/${slug}` });
  } catch { /* the page as it always was */ }
  return new Response(html, {
    status: 200,
    headers: {
      ...SITE_HEADERS,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
      'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${CDN_FRESH}, stale-while-revalidate=86400`,
    },
  });
};
