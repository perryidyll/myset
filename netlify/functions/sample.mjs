import { guard } from './_errlog.mjs';
import { json, bad } from './_lib.mjs';
import { verifySample, sampleSeen, isVenueOwner, SAMPLE } from './_sample.mjs';

/* THE SAMPLE DOOR (decision 0101). The one public way into a page the factory built
   for somebody who has not claimed it yet: its address, asked for with the label
   the link carries (#sample-profile). The label is not a secret, so this door READS
   and counts, and never erases anything.

   POST only, and every answer `no-store` (json()), so nothing here is ever cached at
   the edge: the URL of a POST is not a cache key anybody shares, and the body — slug
   and key — never appears in a log line or an address bar.

   A WRONG LABEL AND AN UNKNOWN PAGE ANSWER THE SAME ('unknown', 404).

     page    the page's data, in the SAME shape /api/fan?what=profile (artists) or
             /api/fan?what=venue (venues) returns, plus `sample`: who it was made for,
             when it comes down, where it came from — what the banner and the source
             notice on the page say. Counts the open.
     seen    the Studio was opened, the practice round started, the claim sheet
             opened: the funnel the founder reads. Best-effort.
   There is no `remove`: somebody who does not want the page says so, and the
   founder's Delete forever (factory.mjs optout) erases it (the founder's call,
   2026-09-28). */
const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const kind = body.kind === 'venue' ? 'venue' : 'artist';
  const hit = await verifySample(String(body.slug || ''), String(body.key || ''), kind);
  if (!hit) return bad('unknown', 404);
  const { owner, row } = hit;

  if (body.action === 'page') {
    const { readDoc } = await import('./_lib.mjs');
    const { data: rec } = await readDoc(SAMPLE(owner), null);
    let page;
    if (isVenueOwner(owner)) {
      const { venuePayload } = await import('./venue.mjs');
      page = await venuePayload(owner.slice(2), { reg: { slug: row.slug, name: row.name, createdAt: null, plan: 'free', city: row.city || '' } });
    } else {
      const { profilePayload } = await import('./profile.mjs');
      page = await profilePayload(owner, { who: { slug: row.slug, name: row.name, createdAt: null, plan: 'free' } });
    }
    // awaited: a function may be frozen the moment it answers. The Studio's own read of
    // the page (its Profile tab) is not a visit, so it says `quiet`.
    if (!body.quiet) await sampleSeen(owner, 'open').catch(() => {});
    /* WHERE IT CAME FROM, said on the page (Thailand's PDPA and the GDPR both ask
       for the source at first contact): the kinds of place, with the addresses, and
       never the notes the factory kept about how it read them. */
    const KINDS = { youtube: 'YouTube', website: 'website', instagram: 'Instagram', musicbrainz: 'MusicBrainz',
      apple: 'Apple Music', spotify: 'Spotify', search: 'a web search', founder: 'the MySet team', osm: 'OpenStreetMap',
      facebook: 'Facebook', tiktok: 'TikTok', soundcloud: 'SoundCloud', google: 'Google Maps' };
    const seen = new Set();
    const sources = ((rec && rec.sources) || []).filter((s) => s && KINDS[s.kind] && !seen.has(s.kind) && seen.add(s.kind))
      .map((s) => ({ kind: s.kind, label: KINDS[s.kind] }));
    return json({ ...page, ok: true, sample: {
      kind, slug: row.slug, name: row.name, first: (rec && rec.first) || row.name,
      exp: row.exp, days: Math.max(0, Math.ceil((row.exp - Date.now()) / 86400e3)), sources, cp: row.cp || 1,
    } });
  }

  if (body.action === 'seen') {
    const what = ['studio', 'practice', 'claimStart', 'clash'].includes(body.what) ? body.what : null;
    if (what) await sampleSeen(owner, what).catch(() => {});
    return json({ ok: true });
  }

  return bad('unknown action');
};
export default guard('sample', main);
