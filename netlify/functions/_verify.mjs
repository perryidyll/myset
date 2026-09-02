import { lookup } from 'node:dns/promises';
import { casDoc, readDoc } from './_lib.mjs';
import { venueKey, sameVenue, domainMatches, mutateVenues } from './_venues.mjs';

/* Proving a venue page belongs to the venue.

   ALL THREE of these are required for the automatic tick:

     1. the sign-in email is on the website's own domain
     2. the website itself actually names this venue
     3. three different artists who have a gig listed there say they play there

   ...and the venue must be on a paid plan, because the tick is a premium feature.
   The PROOF is never for sale — paying only opens the door to being checked.

   Any one of them alone is a claim. (1) is weak because anyone can buy a domain
   and an email on it. (2) is weak because the website is whatever URL they typed
   into a form. (3) is weak on its own because three friendly accounts is not
   impossible. All three together mean somebody controls the inbox AND the site
   AND is known to three acts who really do play there.

   Perry's manual switch in the Studio remains as an explicit override, for the
   places a machine cannot judge — a bar with no website whose whole town knows it. */

/* Three, not five, and it is not an OR: a page needs the website checks AND the
   artists. Perry asked for both to be mandatory — one signal is a claim, two
   independent ones are proof. Five was too high for a small island where an act
   might only know three others who play the same bar. His own switch in the Studio
   stays, as an explicit override for the cases a machine can't judge. */
export const MIN_VOUCHES = 3;

/* ---------- fetching a stranger's website safely ----------
   This is the one place MySet makes an outbound request to a URL somebody typed
   in, so it is the one place that can be pointed at something it shouldn't be.
   Every hop is checked, the address is resolved and rejected if it is private,
   and the read is capped. */

const PRIV4 = [
  [[0], 8], [[10], 8], [[127], 8], [[169, 254], 16], [[172, 16], 12],
  [[192, 0, 0], 24], [[192, 168], 16], [[100, 64], 10], [[198, 18], 15],
  [[224], 4], [[240], 4],
];
function privateV4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const asInt = ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
  for (const [prefix, bits] of PRIV4) {
    const q = [...prefix, 0, 0, 0, 0].slice(0, 4);
    const base = ((q[0] << 24) | (q[1] << 16) | (q[2] << 8) | q[3]) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    if ((asInt & mask) === (base & mask)) return true;
  }
  return false;
}
function privateV6(ip) {
  const a = ip.toLowerCase();
  if (a === '::' || a === '::1') return true;
  if (a.startsWith('fe8') || a.startsWith('fe9') || a.startsWith('fea') || a.startsWith('feb')) return true;
  if (/^f[cd]/.test(a)) return true;                       // fc00::/7
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(a);       // v4-mapped
  if (m) return privateV4(m[1]);
  return false;
}

async function safeHost(host) {
  const h = String(host || '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local')
      || h.endsWith('.internal') || h.endsWith('.home.arpa')) return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) return !privateV4(h);
  if (h.includes(':')) return !privateV6(h.replace(/^\[|\]$/g, ''));
  let addrs;
  try { addrs = await lookup(h, { all: true, verbatim: true }); } catch { return false; }
  if (!addrs.length) return false;
  // every address it resolves to, not just the first — a host can answer with both
  return addrs.every((a) => (a.family === 6 ? !privateV6(a.address) : !privateV4(a.address)));
}

const MAX_BYTES = 512 * 1024;
const MAX_HOPS = 3;

async function fetchPage(rawUrl) {
  let url = rawUrl;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    let u;
    try { u = new URL(url); } catch { return { error: 'bad-url' }; }
    if (u.protocol !== 'https:') return { error: 'not-https' };
    if (!(await safeHost(u.hostname))) return { error: 'unreachable' };

    let r;
    try {
      r = await fetch(u.toString(), {
        redirect: 'manual',
        headers: { 'user-agent': 'MySet/1.0 (+https://myset.vip) venue-verification',
                   accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(8000),
      });
    } catch { return { error: 'unreachable' }; }

    if (r.status >= 300 && r.status < 400) {
      const to = r.headers.get('location');
      if (!to) return { error: 'unreachable' };
      url = new URL(to, u).toString();          // guarded again on the next pass
      continue;
    }
    if (!r.ok) return { error: `http-${r.status}` };
    const type = (r.headers.get('content-type') || '').toLowerCase();
    if (type && !type.includes('html') && !type.includes('text')) return { error: 'not-a-page' };

    // read with a hard cap rather than trusting content-length
    const reader = r.body && r.body.getReader ? r.body.getReader() : null;
    if (!reader) {
      const t = await r.text();
      return { html: t.slice(0, MAX_BYTES), finalUrl: u.toString() };
    }
    const parts = []; let total = 0;
    while (total < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      parts.push(value);
    }
    try { await reader.cancel(); } catch {}
    return { html: Buffer.concat(parts.map((p) => Buffer.from(p))).toString('utf8').slice(0, MAX_BYTES),
             finalUrl: u.toString() };
  }
  return { error: 'too-many-redirects' };
}

/** Everything readable on the page, flattened to normalised words. */
function pageWords(html) {
  return String(html || '')
    .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|quot|#39|apos|lsquo|rsquo|ldquo|rdquo|mdash|ndash);/gi, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
const hasPhrase = (hay, needle) => {
  if (!needle) return false;
  return (' ' + hay + ' ').includes(' ' + needle + ' ');
};

/** Does this website look like it belongs to this venue in this town? */
export async function checkWebsite(venue) {
  const site = venue && venue.links && venue.links.website;
  if (!site) return { ok: false, why: 'no-website' };

  const got = await fetchPage(site);
  if (got.error) return { ok: false, why: got.error };

  const words = pageWords(got.html);
  const nameKey = venueKey(venue.name);
  const parts = nameKey.split(' ').filter(Boolean);

  // the whole name, or a distinctive prefix of it — a site that says
  // "The Ugly Duckling" is the site of "The Ugly Duckling Irish Pub"
  let nameFound = hasPhrase(words, nameKey);
  if (!nameFound && parts.length > 2) nameFound = hasPhrase(words, parts.slice(0, 2).join(' '));
  if (!nameFound && parts.length === 2 && nameKey.length >= 8) nameFound = hasPhrase(words, nameKey);

  const cityKey = venueKey(venue.city);
  const cityFound = cityKey ? hasPhrase(words, cityKey) : false;
  const countryKey = venueKey(venue.country);
  const countryFound = countryKey ? hasPhrase(words, countryKey) : false;

  return {
    ok: true, nameFound, cityFound, countryFound,
    placeFound: cityFound || countryFound,
    finalUrl: got.finalUrl,
    bytes: got.html.length,
  };
}

/* ---------- the verdict ----------
   Domain match AND the site naming the venue. Either alone is not enough. */
export async function tryVerifyByWebsite(vid, email, venue) {
  const site = venue.links && venue.links.website;
  const domain = domainMatches(email, site);
  const web = await checkWebsite(venue);

  const vouches = Object.keys((await readVouches(vid)).by || {}).length;

  /* The tick is a premium feature, so a free page is not checked at all. Note the
     order of the sentence: paying opens the door to being CHECKED, it does not buy
     the tick. A purchasable trust signal is worth nothing, and a wrong tick on a
     real bar sends a real person to the wrong place (INVARIANT 0ak). */
  const { readVenues, venuePaid } = await import('./_venues.mjs');
  const reg = await readVenues();
  const paid = venuePaid(reg.byId[vid]);

  const checks = {
    paidPlan: paid,
    website: !!site,
    emailOnDomain: domain,
    siteNamesVenue: !!(web.ok && web.nameFound),
    siteNamesTown: !!(web.ok && web.placeFound),   // reported, never required
    artists: vouches,
    artistsNeeded: MIN_VOUCHES,
    artistsDone: vouches >= MIN_VOUCHES,
  };
  // every one of them, not any one of them
  const passed = checks.paidPlan && checks.website && checks.emailOnDomain
                 && checks.siteNamesVenue && checks.artistsDone;

  if (passed) {
    await mutateVenues((r) => {
      const v = r.byId[vid];
      if (!v || v.verified) return false;
      v.verified = true; v.verifiedVia = 'website+artists'; v.verifiedAt = Date.now();
      return true;
    }).catch(() => {});
  }
  return { passed, checks, why: web.ok ? null : web.why };
}

/* ---------- artist vouching ---------- */
const VK = (vid) => `vouch_${vid}`;
export const emptyVouch = () => ({ v: 1, by: {} });

export async function readVouches(vid) {
  const { data } = await readDoc(VK(vid), null);
  const d = data || emptyVouch();
  d.by ||= {};
  return d;
}

/** An artist can only vouch for a venue they actually have a gig listed at.
 *  That is the whole anti-fraud story: ten vouches means ten accounts each with
 *  their own gig history, not ten taps from one person. */
export async function artistPlaysAt(aid, venue) {
  const { readEvents } = await import('./_events.mjs');
  const events = await readEvents(aid);
  return (events.list || []).some((e) =>
    sameVenue(e.venue, venue.name) &&
    (!venue.city || !e.city || venueKey(e.city) === venueKey(venue.city)));
}

export async function addVouch(vid, aid, who, venue) {
  if (!(await artistPlaysAt(aid, venue)))
    return { ok: false, error: 'Add a gig at this venue to your calendar first' };

  let already = false, count = 0;
  await casDoc(VK(vid), emptyVouch, (d) => {
    d.by ||= {};
    if (d.by[aid]) { already = true; count = Object.keys(d.by).length; return false; }
    d.by[aid] = { at: Date.now(), slug: who.slug || '', name: who.name || '' };
    count = Object.keys(d.by).length;
    return true;
  });
  if (already) return { ok: true, already: true, count, need: MIN_VOUCHES };

  /* Reaching five does NOT verify on its own any more — the website checks have to
     pass too. So the vouch is recorded and the whole verdict is re-run; if the
     website side was already good, this is the thing that tips it over. */
  let verified = false;
  if (count >= MIN_VOUCHES) {
    try { verified = (await recheck(vid)).passed; }
    catch { /* a failed re-check just means "not yet", never an error to the artist */ }
  }
  return { ok: true, count, need: MIN_VOUCHES, verified };
}

export const vouchCount = async (vid) => Object.keys((await readVouches(vid)).by).length;

/** Whoever claimed the page. Their address is the one that has to be on the
 *  venue's own domain — a barman added later doesn't count for verification. */
export async function ownerEmail(vid) {
  const { readVenues } = await import('./_venues.mjs');
  const reg = await readVenues();
  const mine = Object.entries(reg.byEmail || {}).filter(([, v]) => v.venueId === vid);
  const owner = mine.find(([, v]) => (v.role || 'owner') === 'owner') || mine[0];
  return owner ? owner[0] : null;
}

/** Re-run the whole verdict from scratch: website checks plus the vouch count. */
export async function recheck(vid) {
  const { getVenueProfile, shapeVenue, venueById } = await import('./_venues.mjs');
  const email = await ownerEmail(vid);
  if (!email) return { passed: false, checks: null, why: 'no-owner' };
  const venue = shapeVenue(await getVenueProfile(vid), await venueById(vid));
  return tryVerifyByWebsite(vid, email, venue);
}

/* ---------- proving an ARTIST is who they say they are ----------

   A venue can be checked against a website it owns. An artist has no equivalent,
   so the proof is different and deliberately ends with a human:

     1. on a paid plan  — the tick is a premium feature
     2. card payments actually set up (Stripe Connect reports usable)
     3. a photo of an ID whose name matches the account
     4. Perry looks at it and says yes

   THE ID PHOTO IS NEVER PUBLIC AND NEVER KEPT. It is written to an image slot that
   `img.mjs` refuses to serve — that function checks `SLOTS` before it looks at
   anything, and this slot is deliberately not in it — and it is DELETED the moment
   a decision is made, approved or not. Holding a stranger's government ID
   indefinitely is a liability nobody asked for. Only the decision is kept. */
export const ID_SLOT = 'idcheck';                 // intentionally absent from SLOTS
const IDQ = 'idqueue';                            // one small global review queue

export const readIdQueue = async () => {
  const { data } = await readDoc(IDQ, null);
  const q = { v: 1, by: {}, ...(data || {}) };
  q.by ||= {};
  return q;
};
export const mutateIdQueue = (fn) =>
  casDoc(IDQ, () => ({ v: 1, by: {} }), (q) => { q.by ||= {}; return fn(q); });

/** Everything that has to be true before the tick, and what is still missing. */
export async function artistVerifyChecks(aid) {
  const { planForArtist } = await import('./_plan.mjs');
  const { connectReady } = await import('./_pay.mjs');
  const { readArtists } = await import('./_auth.mjs');
  const [{ plan }, reg, q] = await Promise.all([
    planForArtist(aid), readArtists(), readIdQueue(),
  ]);
  const row = q.by[aid] || null;
  const rec = reg.byId[aid] || {};
  const checks = {
    paidPlan: plan === 'plus' || plan === 'pro',
    payments: await connectReady(aid),
    idOnFile: !!(row && row.state === 'pending'),
    reviewed: !!rec.verified,
    state: rec.verified ? 'verified' : row ? row.state : 'none',
    rejectedWhy: row && row.state === 'rejected' ? (row.why || '') : null,
  };
  checks.readyForReview = checks.paidPlan && checks.payments && checks.idOnFile;
  return checks;
}
