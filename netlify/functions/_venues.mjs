import { createHmac, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc } from './_lib.mjs';
import { authSecret, cleanSlug, normEmail } from './_auth.mjs';
import { normPlace, mapLinks, safeMapUrl, clean } from './_maps.mjs';

/* VENUES.

   A second kind of account, deliberately kept in its own registry rather than
   bolted onto the artist one. A bar is not an artist: it has opening hours and a
   menu, it never runs a show, and it must never be able to reach an artist's
   money, setlist or history. Separate registries make that structural instead of
   a permission check somebody forgets to write.

   Venue pages live at myset.vip/v/<slug> so the artist namespace stays clean and
   nothing has to be migrated. */

const REG = 'venues';
export const VMAX_OFFERS = 6;
export const VMAX_MENU = 24;

/* ---------- the registry ----------
     byId    venueId -> { slug, name, createdAt, city, country, verified, ... }
     bySlug  slug    -> venueId
     byEmail email   -> { venueId, role }
*/
const emptyReg = () => ({ v: 1, rev: 1, byId: {}, bySlug: {}, byEmail: {} });

export async function readVenues() {
  const { data } = await readDoc(REG, null);
  const r = { ...emptyReg(), ...(data || {}) };
  r.byId ||= {}; r.bySlug ||= {}; r.byEmail ||= {}; r.rev ||= 1;
  return r;
}
export const mutateVenues = (fn) =>
  casDoc(REG, emptyReg, (r) => {
    r.v ||= 1; r.rev ||= 1; r.byId ||= {}; r.bySlug ||= {}; r.byEmail ||= {};
    return fn(r);
  });

const VRESERVED = new Set(['api', 'new', 'index', 'home', 'admin', 'studio', 'venue', 'venues',
  'about', 'help', 'support', 'login', 'signup', 'terms', 'privacy', 'settings', 'null', 'undefined']);

export async function venueBySlug(slug) {
  const r = await readVenues();
  return r.bySlug[cleanSlug(slug)] || null;
}
export async function venueById(vid) {
  const r = await readVenues();
  return r.byId[vid] || null;
}

export function pickVenueSlug(name, reg, wanted) {
  let base = cleanSlug(wanted || name) || 'venue';
  if (base.length < 3) base = base + 'bar';
  const free = (v) => !VRESERVED.has(v) && !reg.bySlug[v] && !reg.byId[v];
  if (free(base)) return base;
  for (let i = 2; i < 500; i++) {
    const t = `${base}${i}`;
    if (free(t)) return t;
  }
  return null;
}

export async function createVenue({ email, name, slug, city, country }) {
  const nm = clean(name, 70) || 'New venue';
  let made = null, err = null;
  await mutateVenues((reg) => {
    if (reg.byEmail[email]) { err = 'already'; return false; }
    const s = pickVenueSlug(nm, reg, slug);
    if (!s) { err = 'no-slug'; return false; }
    const vid = s;                     // slug and id start identical, like artists
    if (reg.byId[vid]) { err = 'no-slug'; return false; }
    reg.byId[vid] = {
      slug: s, name: nm, createdAt: Date.now(),
      city: clean(city, 60), country: clean(country, 60),
      verified: false, verifiedVia: null, verifiedAt: null,
    };
    reg.bySlug[s] = vid;
    reg.byEmail[email] = { venueId: vid, role: 'owner' };
    made = { venueId: vid, slug: s, name: nm };
    return true;
  });
  return made ? { ok: true, ...made } : { ok: false, error: err || 'failed' };
}

/* ---------- sessions ----------
   Tagged 'v', so an artist token can never be presented here and a venue token
   can never be presented to the artist endpoints. The artist token body is
   `email|exp|rev`; this one is `v|email|exp|rev`. The HMAC covers the whole
   string, and each side rejects anything that isn't its own shape. */
const eq = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};
const TOKEN_TTL = 30 * 24 * 3600e3;

export async function signVenueToken(email, rev) {
  const body = `v|${email}|${Date.now() + TOKEN_TTL}|${rev}`;
  const mac = createHmac('sha256', await authSecret()).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${mac}`;
}
export async function verifyVenueToken(token) {
  if (typeof token !== 'string' || token.length > 500) return null;
  const [b64, mac] = token.split('.');
  if (!b64 || !mac) return null;
  let body;
  try { body = Buffer.from(b64, 'base64url').toString(); } catch { return null; }
  const want = createHmac('sha256', await authSecret()).update(body).digest('base64url');
  if (!eq(mac, want)) return null;
  const [tag, email, exp, rev] = body.split('|');
  if (tag !== 'v' || !email || Number(exp) < Date.now()) return null;
  const reg = await readVenues();
  if (String(reg.rev) !== String(rev)) return null;
  const link = reg.byEmail[email];
  if (!link || !reg.byId[link.venueId]) return null;
  return { email, venueId: link.venueId, role: link.role, venue: reg.byId[link.venueId] };
}

/** Who is making this request, and which venue do they run? */
export async function requireVenue(req) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const me = await verifyVenueToken(auth.slice(7));
  return me ? { vid: me.venueId, email: me.email, role: me.role || 'owner' } : null;
}

/* ---------- matching a typed venue name to a venue page ----------
   Artists type the venue name by hand, and they type it differently every time:
   "The Ugly Duckling", "Ugly Duckling Irish Pub", "ugly duckling 🍻". So compare
   on normalised WORDS, and only accept a containment match when the shorter name
   is at least five characters — otherwise "bar" would match every bar there is. */
export const venueKey = (v) => String(v || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/^the\s+/, '');

export function sameVenue(a, b) {
  const x = venueKey(a), y = venueKey(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [s, l] = x.length <= y.length ? [x, y] : [y, x];
  const distinctive = s.length >= 8 || s.split(' ').length >= 2;
  if (!distinctive) return false;
  return l.startsWith(s + ' ') || l.endsWith(' ' + s) || l.includes(' ' + s + ' ');
}

/* ---------- verification ----------
   Nothing here claims a venue is real. It records HOW it came to be trusted, so
   the public page can be honest about it:
     domain — the person who claimed it has an email at the venue's own website
     owner  — Perry looked at it and said yes
   Everything else shows as an unverified listing. */
export function domainMatches(email, website) {
  const at = String(email || '').split('@')[1];
  if (!at || !website) return false;
  let host;
  try { host = new URL(website).hostname.toLowerCase(); } catch { return false; }
  host = host.replace(/^www\./, '');
  const dom = at.toLowerCase().replace(/^www\./, '');
  const generic = /^(gmail|googlemail|yahoo|hotmail|outlook|live|icloud|me|proton|protonmail|aol|gmx|mail|yandex|qq|163)\./;
  if (generic.test(dom + '.')) return false;
  return dom === host || host.endsWith('.' + dom) || dom.endsWith('.' + host);
}

/* ---------- the profile ---------- */
export const AMENITIES = [
  ['sound', 'House PA / backline'],
  ['livemusic', 'Live music most nights'],
  ['outdoor', 'Outdoor seating'],
  ['seaview', 'Sea view'],
  ['aircon', 'Air conditioning'],
  ['wifi', 'Free wifi'],
  ['parking', 'Parking'],
  ['food', 'Full kitchen'],
  ['veg', 'Vegan / veggie options'],
  ['cocktails', 'Cocktails'],
  ['craftbeer', 'Craft beer'],
  ['sports', 'Sport on screen'],
  ['pooltable', 'Pool table'],
  ['dancefloor', 'Dance floor'],
  ['latenight', 'Open late'],
  ['happyhour', 'Happy hour'],
  ['dogs', 'Dog friendly'],
  ['family', 'Family friendly'],
  ['wheelchair', 'Step-free access'],
  ['cards', 'Cards accepted'],
  ['cash', 'Cash only'],
  ['smoking', 'Smoking area'],
];
const AMENITY_KEYS = new Set(AMENITIES.map(([k]) => k));
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const DAY_LABEL = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
                           fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

const VKEY = (vid) => `vprofile_${vid}`;
/** Photos share the artist image store under an owner key an artist can never
 *  hold: artist ids are stripped to [a-z0-9-], so the underscore is unforgeable. */
export const imgOwner = (vid) => `v_${vid}`;

const hhmm = (v, dflt) => (/^\d{2}:\d{2}$/.test(String(v || '')) ? String(v) : dflt);

export const defaultVenue = () => ({
  v: 1, venueId: null,
  name: '', tagline: '', about: '',
  city: '', country: '', address: '', mapUrl: '', lat: null, lng: null,
  phone: '', whatsapp: '',
  photo: '', photos: [],
  amenities: [],
  hours: Object.fromEntries(DAYS.map((d) => [d, { closed: false, open: '17:00', close: '01:00' }])),
  menu: { url: '', note: '', items: [] },
  offers: [],
  links: { website: '', instagram: '', facebook: '', google: '' },
  updatedAt: Date.now(),
});

const LINK_HOSTS = {
  instagram: ['instagram.com', 'www.instagram.com'],
  facebook: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.com', 'www.fb.com'],
  google: null,          // a Google Business / Maps listing — checked by safeMapUrl
  website: null,
};
function safeVLink(kind, raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (kind === 'google') return safeMapUrl(v);
  let u;
  try { u = new URL(v); } catch { return ''; }
  if (u.protocol !== 'https:') return '';
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const allow = LINK_HOSTS[kind];
  if (allow && !allow.includes(host)) return '';
  u.hash = '';
  for (const junk of ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'igshid'])
    u.searchParams.delete(junk);
  return u.toString().slice(0, 300);
}

/* A phone number is rendered as a tel: link, so it keeps only the characters a
   dialler understands. No letters, no anything else. */
const phoneOf = (v) => String(v || '').replace(/[^0-9+ ()-]/g, '').trim().slice(0, 28);

export function normVenue(p) {
  const d = defaultVenue();
  const o = { ...d, ...(p || {}) };
  o.name = clean(o.name, 70);
  o.tagline = clean(o.tagline, 120);
  o.about = String(o.about || '').replace(/\r/g, '').slice(0, 900);
  o.city = clean(o.city, 60);
  o.country = clean(o.country, 60);
  Object.assign(o, normPlace(o));
  o.phone = phoneOf(o.phone);
  o.whatsapp = phoneOf(o.whatsapp);
  o.photo = String(o.photo || '').slice(0, 300);
  o.photos = (Array.isArray(o.photos) ? o.photos : [])
    .map((x) => String(x || '').slice(0, 300)).filter(Boolean).slice(0, 3);
  o.amenities = [...new Set((Array.isArray(o.amenities) ? o.amenities : [])
    .filter((k) => AMENITY_KEYS.has(k)))].slice(0, AMENITIES.length);

  const H = o.hours && typeof o.hours === 'object' ? o.hours : {};
  o.hours = Object.fromEntries(DAYS.map((day) => {
    const h = H[day] || {};
    return [day, { closed: !!h.closed, open: hhmm(h.open, '17:00'), close: hhmm(h.close, '01:00') }];
  }));

  const M = o.menu && typeof o.menu === 'object' ? o.menu : {};
  o.menu = {
    url: /^https:\/\//.test(String(M.url || '')) ? String(M.url).slice(0, 300) : '',
    note: clean(M.note, 140),
    items: (Array.isArray(M.items) ? M.items : []).map((it) => ({
      section: clean(it && it.section, 30),
      name: clean(it && it.name, 60),
      price: clean(it && it.price, 20),
      note: clean(it && it.note, 60),
    })).filter((it) => it.name).slice(0, VMAX_MENU),
  };

  o.offers = (Array.isArray(o.offers) ? o.offers : []).map((of) => ({
    id: String((of && of.id) || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'o' + Math.random().toString(36).slice(2, 8),
    title: clean(of && of.title, 60),
    detail: clean(of && of.detail, 140),
    when: clean(of && of.when, 60),
  })).filter((of) => of.title).slice(0, VMAX_OFFERS);

  const L = o.links || {};
  o.links = {
    website: safeVLink('website', L.website),
    instagram: safeVLink('instagram', L.instagram),
    facebook: safeVLink('facebook', L.facebook),
    google: safeVLink('google', L.google),
  };
  return o;
}

export async function getVenueProfile(vid) {
  const { data } = await readDoc(VKEY(vid), null);
  const p = normVenue(data);
  p.venueId = vid;
  return p;
}
export const mutateVenueProfile = (vid, fn) =>
  casDoc(VKEY(vid), defaultVenue, (p) => {
    const np = normVenue(p);
    Object.keys(p || {}).forEach((k) => delete p[k]);
    Object.assign(p, np);
    const r = fn(p);
    if (r === false) return false;
    const after = normVenue(p);           // sanitise whatever the handler wrote too
    Object.keys(p).forEach((k) => delete p[k]);
    Object.assign(p, after);
    p.updatedAt = Date.now();
    return r;
  });

/** What the public page renders. */
export function shapeVenue(p, reg) {
  const r = reg || {};
  return {
    venueId: p.venueId, slug: r.slug || '',
    name: p.name || r.name || '', tagline: p.tagline, about: p.about,
    city: p.city || r.city || '', country: p.country || r.country || '',
    address: p.address,
    maps: mapLinks(p, p.name || r.name || ''),
    phone: p.phone, whatsapp: p.whatsapp,
    photo: p.photo, photos: p.photos,
    amenities: p.amenities.map((k) => ({ key: k, label: (AMENITIES.find(([x]) => x === k) || [, k])[1] })),
    hours: DAYS.map((d) => ({ day: d, label: DAY_LABEL[d], ...p.hours[d] })),
    menu: p.menu, offers: p.offers, links: p.links,
    verified: !!r.verified, verifiedVia: r.verifiedVia || null,
    since: r.createdAt || null,
    updatedAt: p.updatedAt,
  };
}
export { normEmail };
