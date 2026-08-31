/* Addresses, and getting someone to the door.

   There is no single link that opens in whichever map app a phone actually uses.
   `geo:` comes closest on paper (RFC 5870) and Android honours it, but iOS
   Safari does nothing with it, so it fails for half the room. What WhatsApp
   really does is hand the OS a place and let the OS choose.

   So: store the ADDRESS as the truth, plus coordinates when we can get them,
   and build BOTH links here. The page picks by platform. Nothing is guessed in
   the browser and no third-party host is contacted to resolve anything. */

const MAP_HOSTS = [
  /^maps\.apple\.com$/,
  /^maps\.app\.goo\.gl$/,
  /^goo\.gl$/,
  /^(www\.)?google\.[a-z.]{2,6}$/,
  /^maps\.google\.[a-z.]{2,6}$/,
  /^(www\.)?openstreetmap\.org$/,
];

export const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

/** An https link on a map host, rebuilt through the parser. '' if it isn't one. */
export function safeMapUrl(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  let u;
  try { u = new URL(v); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!MAP_HOSTS.some((re) => re.test(host))) return '';
  u.hash = u.hash && /^#?(?:map=)/.test(u.hash.slice(1)) ? u.hash : '';
  return u.toString().slice(0, 400);
}

const inRange = (a, b) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180
  && !(a === 0 && b === 0);            // 0,0 is the middle of the Atlantic — a parse miss

/** Pull coordinates out of a pasted link, if they are in there at all.
 *  A short link (maps.app.goo.gl/…) hides them behind a redirect, and following
 *  it would mean this site making a request to Google on the artist's behalf, so
 *  those keep the link and fall back to the address for directions. */
export function coordsFrom(url) {
  const s = String(url || '');
  const pats = [
    /@(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,             // google /@lat,lng,17z
    /!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/,            // google place data
    /[?&](?:ll|sll|center)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,   // apple ll=
    /[?&](?:q|query|daddr|destination)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/,
    /#map=\d+\/(-?\d{1,3}\.\d+)\/(-?\d{1,3}\.\d+)/,      // openstreetmap
  ];
  for (const re of pats) {
    const m = re.exec(s);
    if (!m) continue;
    const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (inRange(lat, lng)) return { lat: round6(lat), lng: round6(lng) };
  }
  return null;
}
const round6 = (n) => Math.round(n * 1e6) / 1e6;

/** Normalises whatever the artist typed or pasted into one stored shape. */
export function normPlace(e) {
  const address = clean(e && e.address, 160);
  const mapUrl = safeMapUrl(e && e.mapUrl);
  let lat = Number(e && e.lat), lng = Number(e && e.lng);
  if (!inRange(lat, lng)) {
    const c = mapUrl ? coordsFrom(mapUrl) : null;
    lat = c ? c.lat : null; lng = c ? c.lng : null;
  } else { lat = round6(lat); lng = round6(lng); }
  return { address, mapUrl, lat, lng };
}

/* Emoji and pipes are decoration in a venue name and noise in a map query —
   "The Ugly Duckling | Irish Pub ☘️🍻" searches better as "The Ugly Duckling
   Irish Pub". */
const searchable = (v) => String(v || '')
  .replace(/[|/\\<>{}\[\]"`~^*_=+]/g, ' ')
  .replace(/[^\p{L}\p{N}\s.,&'’()-]/gu, ' ')
  .replace(/\s+/g, ' ').trim().slice(0, 120);

/** The two links, built from literal templates. Null when there is nothing to
 *  point at — a "Directions" button with nowhere to go is worse than no button.
 *
 *  A bare NAME is not a location: "The Ugly Duckling" on its own could send
 *  somebody to Amsterdam. So a name only counts once there is a city with it,
 *  and the city and country always go into the query. */
export function mapLinks(place, label) {
  const p = place || {};
  const name = searchable(clean(label, 80));
  const has = Number.isFinite(p.lat) && Number.isFinite(p.lng);
  const where = [p.city, p.country].map((x) => clean(x, 60)).filter(Boolean);
  const q = [name, searchable(p.address), ...where].filter(Boolean).join(', ');
  if (!has && !p.address && !(name && where.length)) return null;
  if (!has && !q) return null;

  const pin = has ? `${p.lat},${p.lng}` : '';
  return {
    address: p.address || '',
    lat: has ? p.lat : null, lng: has ? p.lng : null,
    // Apple takes a name AND coordinates, which puts the right label on the pin
    apple: has
      ? `https://maps.apple.com/?ll=${pin}&q=${encodeURIComponent(name || searchable(p.address) || 'Here')}`
      : `https://maps.apple.com/?q=${encodeURIComponent(q)}`,
    google: has
      ? `https://www.google.com/maps/search/?api=1&query=${pin}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    // whatever they originally pasted, so a place page they liked still opens
    source: p.mapUrl || '',
  };
}
