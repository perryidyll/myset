import { randomBytes } from 'node:crypto';
import { casDoc, readDoc, store } from './_lib.mjs';
import { classifyUrl, parseSeed } from './_fsrc.mjs';

/* MYSET'S CRM (decision 0108): who the founder is reaching out to, and everything
   said to them, beside the sample pages the factory builds for them.

   A CONTACT IS NOT A SAMPLE. A contact is a person or a place the founder means to
   talk to. It may never get a page (a lead saved for later), it outlives its page
   (a sample comes down after thirty days; the conversation does not), and one page
   can be rebuilt or revived under a new owner id. So the two are separate documents,
   joined by `owner`, and a contact's STAGE is never stored: it is read off the
   sample's own state every time (_sample.mjs is the one writer of that), so the two
   can never disagree about where a page is.

   TWO KINDS OF DOCUMENT, every key computable (INVARIANT 1):
     · `crm` — the index the table reads: one small row per contact (`byId`) and the
       identifiers that find a duplicate or route an email (`byKey`: ig:, tt:, yt:,
       em:, ph:, nm:). A row is ALWAYS rebuilt whole from its contact document
       (rowOf), so any write heals a row a failed write left stale.
     · `crm_<cid>` — the contact: how to reach them, the links the page was built
       from, tags, the follow-up date, private notes and the whole conversation.

   PRIVATE BY CONSTRUCTION. Nothing here is ever read by a public door, and notes
   never reach the factory: a seed carries the name, the place and the links, never
   the founder's notes about a person. "Delete forever" erases the contact with the
   page (forgetOwner, called from _sample.mjs optOut), because the promise every
   message makes — "we'll delete this preview forever" — covers what we wrote down
   about them too. */

export const CRM = 'crm';
export const CDOC = (cid) => `crm_${cid}`;
export const OUT_CH = ['email', 'ig', 'tiktok', 'whatsapp', 'sms', 'fb', 'inperson'];
export const CHANNELS = [...OUT_CH, 'note'];
export const MAX_TAGS = 12, TAG_LEN = 24, MAX_MSGS = 300, MAX_NOTES = 100, MAX_EVENTS = 80, MSG_LEN = 4000;
/** After the first message goes out, the follow-up falls due this long after, unless
 *  the founder set one. A reply clears it: the ball is in the founder's court then,
 *  and "Needs your reply" says so better than a date. */
export const FOLLOW_MS = 4 * 86400e3;
export const validCid = (c) => /^c[a-f0-9]{10}$/.test(String(c || ''));
export const newCid = () => 'c' + randomBytes(5).toString('hex');
const newMid = () => 'm' + randomBytes(5).toString('hex');
const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const norm = (v) => String(v || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const cut = (s, n) => { const t = String(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };

/* ---------- the fields ---------- */
export const ARTIST_LINKS = ['instagram', 'tiktok', 'youtube', 'spotify', 'applemusic', 'soundcloud', 'bandcamp', 'facebook', 'website'];
export const VENUE_LINKS = ['instagram', 'facebook', 'website', 'google', 'tiktok'];
export const linkKinds = (kind) => (kind === 'venue' ? VENUE_LINKS : ARTIST_LINKS);

/** A link typed into the field for `k`, in its canonical https form, or '' when it is
 *  not that kind of profile. A bare @handle works where handles exist (Instagram,
 *  TikTok, YouTube, Facebook, SoundCloud): the founder types handles, the factory
 *  and the page want addresses. classifyUrl is the one reader of addresses. */
export function canonLink(k, raw) {
  const v = String(raw || '').trim().slice(0, 400);
  if (!v) return '';
  const bare = v.replace(/^@/, '');
  // an @ in front always means a handle (@tidelines.music is a handle, not a domain)
  const looksUrl = !v.startsWith('@') && (/[/:]/.test(v) || /\.(com|net|org|io|co|me|app|music|band|live|bio|link|page|site|xyz|info|th|uk|de|fr|es|au|ca)$/i.test(v));
  if (!looksUrl) {
    if (k === 'instagram' && /^[\w.]{1,30}$/.test(bare)) return `https://www.instagram.com/${bare.toLowerCase()}/`;
    if (k === 'tiktok' && /^[\w.]{2,30}$/.test(bare)) return `https://www.tiktok.com/@${bare.toLowerCase()}`;
    if (k === 'youtube' && /^[\p{L}\p{M}\p{N}_.-]{3,30}$/u.test(bare)) return `https://www.youtube.com/@${bare}`;
    if (k === 'facebook' && /^[\w.-]{2,80}$/.test(bare)) return `https://www.facebook.com/${bare}`;
    if (k === 'soundcloud' && /^[\w-]{2,60}$/.test(bare)) return `https://soundcloud.com/${bare.toLowerCase()}`;
    // anything else (a website typed without https, a .co.th) is for classifyUrl to judge
  }
  const c = classifyUrl(v);
  if (!c) return '';
  if (k === 'website') return c.kind === 'website' || c.kind === 'linktree' ? c.url : '';
  if (k === 'youtube') return c.kind === 'youtube' || c.kind === 'ytvideo' ? c.url : '';
  return c.kind === k ? c.url : '';
}
export const handleOf = (k, url) => { const c = url ? classifyUrl(url) : null; return c && c.kind === k ? String(c.handle || '') : ''; };

export const cleanEmail = (v) => { const s = String(v || '').trim().toLowerCase().slice(0, 120); return /^[^\s@<>()"',;:]+@[^\s@<>()"',;:]+\.[a-z]{2,}$/.test(s) ? s : ''; };
export const cleanPhone = (v) => { const s = String(v || '').replace(/[^0-9+ ()-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 28); return s.replace(/\D/g, '').length >= 7 ? s : ''; };

export function normTags(list) {
  const out = [], seen = new Set();
  for (const t of [].concat(list || [])) {
    const s = String(t == null ? '' : t).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, TAG_LEN);
    const k = s.toLowerCase();
    if (!s || seen.has(k)) continue;
    seen.add(k); out.push(s);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** The founder's form (or an edit) → the contact's fields. `partial`: only the keys
 *  given are returned (an edit). `dropped` names every field that was given a value
 *  and refused, so the page can say which. */
export function normFields(kind, f = {}, { partial = false } = {}) {
  const out = {}, dropped = [];
  const has = (k) => !partial || Object.prototype.hasOwnProperty.call(f, k);
  if (has('name')) out.name = clean(f.name, kind === 'venue' ? 70 : 60);
  if (has('city')) out.city = clean(f.city, 60);
  if (has('country')) out.country = clean(f.country, 60);
  /* A value that was given and refused is named in `dropped`, and in an edit it is left
     out, so a typo never wipes the good one already there; an empty value clears. */
  if (has('links')) {
    const L = (f.links && typeof f.links === 'object') ? f.links : {};
    out.links = {};
    for (const k of linkKinds(kind)) {
      if (partial && !Object.prototype.hasOwnProperty.call(L, k)) continue;
      const v = canonLink(k, L[k]);
      if (!v && String(L[k] || '').trim()) { dropped.push(k); if (partial) continue; }
      out.links[k] = v;
    }
  }
  if (has('email')) { const v = cleanEmail(f.email); if (!v && String(f.email || '').trim()) dropped.push('email'); if (v || !partial || !String(f.email || '').trim()) out.email = v; }
  if (has('phone')) { const v = cleanPhone(f.phone); if (!v && String(f.phone || '').trim()) dropped.push('phone'); if (v || !partial || !String(f.phone || '').trim()) out.phone = v; }
  if (has('photos')) out.photos = [].concat(f.photos || []).map((u) => String(u || '').trim()).filter((u) => /^https:\/\/\S{8,500}$/.test(u)).slice(0, 3);
  if (has('tags')) out.tags = normTags(f.tags);
  if (has('star')) out.star = !!f.star;
  if (has('fu')) { const t = Number(f.fu) || 0; out.fu = t > 0 ? Math.round(t) : 0; }
  if (!partial && f.note != null) out.note = String(f.note).replace(/\r/g, '').trim().slice(0, 2000);
  return { out, dropped };
}

/** What the factory is handed: the name, the place, the links, photo addresses. Never
 *  the email, the phone or a note. `line` is the same seed written the way the
 *  founder types one (_fsrc.mjs parseSeed reads it back), so a rebuild that only has
 *  the line gets the same page. */
export function seedFrom(kind, c) {
  const links = {};
  for (const k of linkKinds(kind)) if (c.links && c.links[k]) links[k] = c.links[k];
  const place = c.city ? [c.city, c.country].filter(Boolean).join(', ') : '';
  const line = [c.name, place, ...Object.values(links)].filter(Boolean).join(' | ').slice(0, 1000);
  return { line, name: c.name || '', city: c.city || '', country: c.country || '', links, photos: (c.photos || []).slice(0, 3) };
}

/** The identifiers that say two entries are the same act or venue, and that route a
 *  Gmail message to its conversation. */
export function keysOf(c) {
  const k = [], L = c.links || {};
  const ig = handleOf('instagram', L.instagram); if (ig) k.push('ig:' + ig);
  const tt = handleOf('tiktok', L.tiktok); if (tt) k.push('tt:' + tt);
  const yc = L.youtube ? classifyUrl(L.youtube) : null;
  if (yc && yc.kind === 'youtube' && (yc.handle || yc.id)) k.push('yt:' + String(yc.handle || yc.id).toLowerCase());
  if (c.email) k.push('em:' + c.email);
  const d = String(c.phone || '').replace(/\D/g, ''); if (d.length >= 7) k.push('ph:' + d.slice(-9));
  if (c.name) k.push(`nm:${c.kind === 'venue' ? 'v' : 'a'}:${norm(c.name)}|${norm(c.city)}`);
  return k;
}

/* ---------- storage ---------- */
const emptyCrm = () => ({ v: 1, byId: {}, byKey: {} });
export async function readCrm() {
  const { data } = await readDoc(CRM, null);
  const c = { ...emptyCrm(), ...(data || {}) };
  c.byId ||= {}; c.byKey ||= {};
  return c;
}
export const mutateCrm = (fn) => casDoc(CRM, emptyCrm, (c) => { c.v ||= 1; c.byId ||= {}; c.byKey ||= {}; return fn(c); });
export async function readContact(cid) {
  if (!validCid(cid)) return null;
  const { data } = await readDoc(CDOC(cid), null);
  return data && data.cid === cid ? data : null;
}
const blank = (cid, kind) => ({ v: 1, cid, kind: kind === 'venue' ? 'venue' : 'artist', name: '', city: '', country: '', links: {}, email: '', phone: '',
  photos: [], tags: [], star: false, fu: 0, notes: [], msgs: [], events: [], owner: '', jobId: '', pageAt: 0, claimedAt: 0, at: 0, upd: 0 });

/** The first preset that went to them, and when: the library's reply rates are read off it (decision 0117). */
const preOf = (out) => { const m = out.filter((x) => x.pre).sort((a, b) => a.t - b.t)[0]; return m ? { k: m.pre, t: m.t, ...(m.soft ? { s: 1 } : {}) } : null; };

/** The table's row for a contact, rebuilt whole every time from the document. */
export function rowOf(d) {
  const L = d.links || {};
  const out = (d.msgs || []).filter((m) => m.dir === 'out' && OUT_CH.includes(m.ch));
  const inn = (d.msgs || []).filter((m) => m.dir === 'in');
  const ch = {};
  for (const m of out) if (!ch[m.ch] || m.t < ch[m.ch]) ch[m.ch] = m.t;
  const talk = (d.msgs || []).filter((m) => m.ch !== 'note');
  const lm = talk.length ? talk.reduce((a, b) => (b.t >= a.t ? b : a)) : null;
  return {
    k: d.kind === 'venue' ? 'v' : 'a', name: d.name || '', city: d.city || '', country: d.country || '',
    owner: d.owner || '', jobId: d.jobId || '', at: d.at || 0, upd: d.upd || d.at || 0,
    tags: d.tags || [], star: !!d.star, fu: d.fu || 0, ch,
    sent: out.length ? Math.min(...out.map((m) => m.t)) : 0,
    replied: inn.length ? Math.max(...inn.map((m) => m.t)) : 0,
    unread: Math.max(0, Number(d.unread) || 0),
    last: lm ? { t: lm.t, dir: lm.dir, ch: lm.ch, text: cut(String(lm.subject ? `${lm.subject} — ${lm.text}` : lm.text).replace(/\s+/g, ' '), 90) } : null,
    has: { email: !!d.email, phone: !!d.phone, ig: !!L.instagram, tiktok: !!L.tiktok, fb: !!L.facebook },
    gt: (d.msgs || []).filter((m) => m.thread).map((m) => m.thread).slice(-3),
    pre: preOf(out),
  };
}
/** Write the contact, then its row and keys. `fn(doc)` mutates; false aborts. */
export async function mutateContact(cid, fn) {
  if (!validCid(cid)) return { ok: false, error: 'no such contact' };
  let doc = null, missing = false;
  const r = await casDoc(CDOC(cid), () => null, (d) => {
    doc = null; missing = false;
    if (!d || d.cid !== cid) { missing = true; return false; }
    d.msgs ||= []; d.notes ||= []; d.events ||= []; d.links ||= {};
    if (fn(d) === false) return false;
    d.msgs = d.msgs.slice(-MAX_MSGS);
    d.notes = d.notes.slice(-MAX_NOTES);
    d.events = d.events.slice(-MAX_EVENTS);
    doc = d;
    return true;
  });
  if (missing) return { ok: false, error: 'no such contact' };
  if (!doc) return { ok: false, error: 'unchanged', doc: r && r.data };
  await syncRow(doc);
  return { ok: true, doc };
}
async function syncRow(doc) {
  const row = rowOf(doc), keys = keysOf(doc);
  await mutateCrm((c) => {
    c.byId[doc.cid] = row;
    for (const [k, v] of Object.entries(c.byKey)) if (v === doc.cid && !keys.includes(k)) delete c.byKey[k];
    for (const k of keys) if (!c.byKey[k] || !c.byId[c.byKey[k]]) c.byKey[k] = doc.cid;
    return true;
  });
  return row;
}

/** The contact that already answers to one of these fields, if any. */
export function findDuplicate(crm, kind, f) {
  for (const k of keysOf({ ...f, kind })) {
    const cid = crm.byKey[k];
    if (cid && crm.byId[cid] && (k.startsWith('nm:') ? (crm.byId[cid].k === (kind === 'venue' ? 'v' : 'a')) : true)) return cid;
  }
  return '';
}

/** A new contact. `{ok:false, error:'duplicate', cid}` when one already answers to the
 *  same handle, email, phone or name-and-place. */
export async function createContact(kind, f, { now = Date.now(), force = false } = {}) {
  const crm = await readCrm();
  const dup = force ? '' : findDuplicate(crm, kind, f);
  if (dup) return { ok: false, error: 'duplicate', cid: dup };
  const cid = newCid();
  const at = now;
  await casDoc(CDOC(cid), () => ({ ...blank(cid, kind), at, upd: at }), (d) => {
    Object.assign(d, { name: f.name || '', city: f.city || '', country: f.country || '', links: f.links || {}, email: f.email || '', phone: f.phone || '',
      photos: f.photos || [], tags: f.tags || [], star: !!f.star, fu: f.fu || 0 });
    d.notes = f.note ? [{ t: at, text: f.note }] : [];
    d.events = [{ t: at, e: 'added' }];
    return true;
  });
  const { data } = await readDoc(CDOC(cid), null);
  await syncRow(data);
  return { ok: true, cid, doc: data };
}

/** Merge edited fields in; the keys and the row follow. */
export function applyFields(d, f) {
  for (const k of ['name', 'city', 'country', 'email', 'phone', 'star', 'fu']) if (f[k] !== undefined) d[k] = f[k];
  if (f.tags !== undefined) d.tags = f.tags;
  if (f.photos !== undefined) d.photos = f.photos;
  if (f.links) d.links = { ...(d.links || {}), ...f.links };
  for (const [k, v] of Object.entries(d.links || {})) if (!v) delete d.links[k];
}

export async function eraseContact(cid) {
  if (!validCid(cid)) return false;
  await store().delete(CDOC(cid)).catch(() => {});
  await mutateCrm((c) => {
    if (!c.byId[cid] && !Object.values(c.byKey).includes(cid)) return false;
    delete c.byId[cid];
    for (const [k, v] of Object.entries(c.byKey)) if (v === cid) delete c.byKey[k];
    return true;
  }).catch(() => {});
  return true;
}

/* ---------- the conversation ---------- */
/** One message onto a contact. Gmail messages carry `gid` and are never added twice.
 *  The row's channels, first-sent time, last message and unread count follow from
 *  the messages themselves (rowOf); this sets what they cannot: the follow-up. */
export async function addMessage(cid, m, { now = Date.now(), unread = false } = {}) {
  const ch = CHANNELS.includes(m.ch) ? m.ch : 'note';
  const dir = ch === 'note' ? 'out' : (m.dir === 'in' ? 'in' : 'out');
  const msg = { id: newMid(), t: Math.round(Number(m.t) || now), ch, dir,
    text: String(m.text || '').replace(/\r/g, '').trim().slice(0, MSG_LEN), subject: clean(m.subject, 200), via: m.via === 'gmail' ? 'gmail' : 'manual',
    ...(m.from ? { from: clean(m.from, 160) } : {}), ...(m.to ? { to: clean(m.to, 300) } : {}),
    ...(m.gid ? { gid: String(m.gid).slice(0, 40) } : {}), ...(m.thread ? { thread: String(m.thread).slice(0, 40) } : {}),
    ...(m.msgId ? { msgId: String(m.msgId).slice(0, 300) } : {}), ...(m.refs ? { refs: String(m.refs).slice(0, 2000) } : {}),
    ...(dir === 'out' && ch !== 'note' && validPre(m.pre) ? { pre: m.pre, ...(m.soft ? { soft: true } : {}) } : {}) };
  if (!msg.text && !msg.subject) return { ok: false, error: 'Nothing to log.' };
  let dup = false;
  const r = await mutateContact(cid, (d) => {
    d.msgs ||= [];
    if (msg.gid && d.msgs.some((x) => x.gid === msg.gid)) { dup = true; return false; }
    d.msgs.push(msg);
    d.msgs.sort((a, b) => a.t - b.t);
    if (ch !== 'note') {
      if (dir === 'out' && !d.fu && !d.msgs.some((x) => x !== msg && x.dir === 'out' && OUT_CH.includes(x.ch))) d.fu = msg.t + FOLLOW_MS;
      if (dir === 'in') { d.fu = 0; if (unread) d.unread = (Number(d.unread) || 0) + 1; }
    }
    d.upd = Math.max(d.upd || 0, msg.t);
    return true;
  });
  if (dup) return { ok: true, dup: true };
  return r.ok ? { ok: true, msg, doc: r.doc } : r;
}

/* ---------- the message library (decision 0117) ----------
   The founder's own openers, one per kind of act, that the composer fills in:
   [Name] and [Venue] become the contact's. One document (`crmlib`); until the first
   save it is the defaults below. Each opener is a body and its closing question, so the
   closing can be traded for the softer one: `ending` 'ab' gives each new send the
   ending that has gone out less (an even test with nothing to remember), 'ask' and
   'soft' always use one. A message remembers the preset and the ending it came from
   (addMessage), and the row carries the first (rowOf), so the page can count sends and
   replies per opener and per ending. */
export const LIB = 'crmlib';
export const MAX_PRESETS = 30, PRESET_LEN = 1500, ASK_LEN = 200;
export const ENDINGS = ['ab', 'ask', 'soft'];
export const validPre = (k) => /^[a-z0-9][a-z0-9-]{0,23}$/.test(String(k || ''));
export const SOFT_ASK = 'I can send you the link if you want to see what yours looks like?';
export const DEFAULT_PRESETS = [
  { k: 'bar', name: 'Bar singers', kind: 'artist', match: ['bar', 'pub'],
    text: 'Hey [Name] — I mocked up a MySet page for you with your photos, music, links, gigs, etc. It also lets people at your shows scan a QR and vote on what you play next, so the room actually gets involved instead of just staring at their phones 😅',
    ask: 'Want me to send you your page?' },
  { k: 'coffee', name: 'Coffee-shop singers', kind: 'artist', match: ['coffee', 'cafe'],
    text: 'Hey [Name] — I made you a sample MySet page with your music, socials, photos and upcoming gigs already filled in. The idea is to turn more of those casual coffee-shop listeners into people who actually interact with your set and follow you afterward.',
    ask: 'Want to see yours?' },
  { k: 'cruise', name: 'Cruise-ship soloists', kind: 'artist', match: ['cruise'],
    text: 'Hey [Name] — I mocked up a MySet page for you that gives passengers one QR to see your music/socials and vote on songs from your setlist live. Could be a really easy way to make cruise sets more interactive and turn passengers into followers before they disappear at the next port 😂',
    ask: 'Want me to send it?' },
  { k: 'wedding', name: 'Wedding singers & bands', kind: 'artist', match: ['wedding'],
    text: 'Hey [Name] — I made a sample MySet page for you that lets wedding guests interact with a curated setlist and vote for songs they want to hear, while also giving you a polished page for your music, photos, links and gigs. Thought it could be a fun way to make the crowd feel involved without handing them control of the whole set 😅',
    ask: 'Want to see it?' },
  { k: 'jazz', name: 'Jazz lounge musicians', kind: 'artist', match: ['jazz', 'lounge'],
    text: 'Hey [Name] — I mocked up a MySet page for you with your music, photos, links and gigs already on it. At shows, you can also let the room interact with a curated list of songs without turning the night into a request-line free-for-all.',
    ask: 'Want me to send you the sample?' },
  { k: 'cover', name: 'Cover bands', kind: 'artist', match: ['cover'],
    text: 'Hey [Name] — I made you a sample MySet page that lets the crowd scan a QR and vote on which songs from your repertoire they want next. For a cover band it basically turns ‘PLAY FREE BIRD!’ into an actual ranked crowd vote 😂 — plus your gigs, music and socials all live on the same page.',
    ask: 'Want to see yours?' },
  { k: 'busk', name: 'Buskers', kind: 'artist', match: ['busk', 'street'],
    text: 'Hey [Name] — I mocked up a MySet page for you so someone walking past can scan one QR, interact with your song list, hear more of your music and find all your socials afterward. Basically a way to turn more 30-second street encounters into actual fans.',
    ask: 'Want me to send you your page?' },
  { k: 'venue', name: 'Venues', kind: 'venue', match: [],
    text: 'Hey [Venue] — I mocked up a MySet page for you with your photos, info, links and live-music listings already filled in. It gives people one clean place to see what’s on and discover the artists playing there, without you having to build anything first.',
    ask: 'Want me to send over the sample?' },
];
const para = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
/** Whatever arrives, a library the page can use: known fields only, keys unique, a
 *  missing list means the defaults (an empty one stays empty: the founder cleared it). */
export function normLib(x) {
  const src = x && Array.isArray(x.list) ? x.list : DEFAULT_PRESETS;
  const seen = new Set(), list = [];
  for (const p of src) {
    if (list.length >= MAX_PRESETS) break;
    const k = p && validPre(p.k) ? p.k : '', text = para(p && p.text, PRESET_LEN);
    if (!k || seen.has(k) || !text) continue;
    seen.add(k);
    const match = (Array.isArray(p.match) ? p.match : String(p.match || '').split(',')).map((m) => norm(m).slice(0, 24)).filter(Boolean).slice(0, 6);
    list.push({ k, name: clean(p.name, 40) || 'Untitled', kind: p.kind === 'venue' ? 'venue' : 'artist', text, ask: clean(p.ask, ASK_LEN), match });
  }
  const soft = x && x.soft != null ? clean(x.soft, ASK_LEN) : SOFT_ASK;
  return { v: 1, list, soft: soft || SOFT_ASK, ending: x && ENDINGS.includes(x.ending) ? x.ending : 'ab', upd: Number(x && x.upd) || 0 };
}
export async function readLib() { const { data } = await readDoc(LIB, null); return normLib(data); }
/** Replace the library whole (the page sends all of it); null puts the defaults back. */
export async function saveLib(x, now = Date.now()) {
  const lib = { ...normLib(x), upd: now };
  await casDoc(LIB, () => ({}), (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, lib); return true; });
  return lib;
}

/* ---------- a contact and its page ----------
   Every way a page changes owner or goes, told here by the code that did it, so a
   contact never points at a page that is gone — or worse, at somebody else's page
   that later took the same address. All best-effort: a CRM hiccup must never be why
   a page build, a claim or a take-down fails. */
export async function linkOwner(cid, owner, { links = {}, now = Date.now() } = {}) {
  if (!owner) return false;
  const r = await mutateContact(cid, (d) => {
    if (d.owner === owner && d.pageAt) return false;
    d.owner = owner; d.pageAt = now; d.jobId = d.jobId || '';
    // what the factory found and the founder did not type: the ways to reach them
    for (const k of ['instagram', 'tiktok', 'facebook', 'youtube', 'website']) if (!(d.links || {})[k] && links[k] && linkKinds(d.kind).includes(k)) (d.links ||= {})[k] = links[k];
    d.events.push({ t: now, e: 'built', m: owner });
    d.upd = now;
    return true;
  });
  return r.ok;
}
const cidsOf = (crm, owner) => Object.entries(crm.byId).filter(([, r]) => r.owner === owner).map(([cid]) => cid);
/** Delete forever: the contact goes with the page. */
export async function forgetOwner(owner) {
  if (!owner) return 0;
  const cids = cidsOf(await readCrm(), owner);
  for (const cid of cids) await eraseContact(cid);
  return cids.length;
}
/** The page went (cancelled, or its kept copy erased after 180 days), the contact stays. */
export async function unlinkOwner(owner, why = 'page gone', now = Date.now()) {
  if (!owner) return 0;
  const cids = cidsOf(await readCrm(), owner);
  for (const cid of cids) await mutateContact(cid, (d) => { if (d.owner !== owner) return false; d.owner = ''; d.pageAt = 0; d.jobId = ''; d.events.push({ t: now, e: 'unlinked', m: why }); return true; });
  return cids.length;
}
/** A rebuild or a revive landed under a new owner id. */
export async function relinkOwner(from, to, now = Date.now()) {
  if (!from || !to || from === to) return 0;
  const cids = cidsOf(await readCrm(), from);
  for (const cid of cids) await mutateContact(cid, (d) => { if (d.owner !== from) return false; d.owner = to; d.events.push({ t: now, e: 'relinked', m: to }); return true; });
  return cids.length;
}

/* ---------- where each contact stands ----------
   Pure: the documents in, the table's rows out (the tests read it directly). */
const SITE = () => process.env.URL || 'https://myset.vip';
export function stageOf(live) {
  if (!live) return '';
  if (live.st === 'review' || live.rv) return 'review';
  return { ready: 'ready', sent: 'shared', opened: 'opened', claiming: 'claiming' }[live.st] || 'ready';
}
export function deriveRows({ crm, reg, arc = {}, jobs = [], artists = { byId: {} }, venues = { byId: {} }, now = Date.now() }) {
  const byJob = new Map(jobs.map((j) => [j.id, j]));
  const rebuilding = new Map(jobs.filter((j) => j.replace && ['queued', 'running'].includes(j.st)).map((j) => [j.replace, j]));
  const rows = [];
  for (const [cid, r] of Object.entries(crm.byId || {})) {
    const kind = r.k === 'v' ? 'venue' : 'artist';
    const o = r.owner || '';
    const live = o ? reg.byId[o] : null;
    const claimed = o ? (reg.claimed || {})[o] : null;
    const gone = o ? arc[o] : null;
    const acct = o ? (kind === 'venue' ? (venues.byId || {})[o.slice(2)] : (artists.byId || {})[o]) : null;
    const job = r.jobId ? byJob.get(r.jobId) : null;
    let stage = 'lead', pct = 0, err = '', slug = '', link = '', exp = 0, opens = 0, cover = '', sampleSent = 0, sampleCh = '';
    const path = (s) => `${SITE()}/${kind === 'venue' ? 'v/' : ''}${s}`;
    if (live) {
      stage = stageOf(live); slug = live.slug; link = `${path(live.slug)}#sample-profile`; exp = live.exp || 0; opens = live.n || 0;
      cover = live.cv || ''; sampleSent = live.sent || 0; sampleCh = live.ch || '';
      const rb = rebuilding.get(o); if (rb) { stage = 'building'; pct = rb.pct || 0; }
    } else if (claimed) { stage = 'claimed'; slug = claimed.slug; link = path(claimed.slug); }
    else if (gone) { stage = 'archived'; slug = gone.slug; }
    else if (acct && !acct.del) { stage = 'claimed'; slug = acct.slug || ''; link = slug ? path(slug) : ''; }
    else if (job && ['queued', 'running'].includes(job.st)) { stage = 'building'; pct = job.pct || 0; }
    else if (job && job.st === 'failed') { stage = 'failed'; err = job.err || 'The build stopped.'; }
    else if (job && job.st === 'skipped') { stage = 'failed'; err = 'Skipped: they are on the opt-out list.'; }
    else if (job && job.st === 'done' && job.owner && !o) { stage = 'building'; pct = 100; }          // done a moment ago; the link lands on the next write
    const ch = Object.keys(r.ch || {});
    // a page marked sent from the old console, before CRM: DM, email or in person, as it was recorded
    for (const c of String(sampleCh).split(',').filter(Boolean)) { const k = c === 'dm' ? 'dm' : c; if (!ch.includes(k) && !(k === 'dm' && ch.some((x) => ['ig', 'tiktok', 'whatsapp', 'sms', 'fb'].includes(x)))) ch.push(k); }
    const sent = [r.sent, sampleSent].filter(Boolean).sort((a, b) => a - b)[0] || 0;
    rows.push({ cid, kind, name: r.name || '', city: r.city || '', country: r.country || '', cover, slug, owner: o, link, stage, pct, err, jobId: r.jobId || '',
      exp, opens, sent, ch, replied: r.replied || 0, unread: r.unread || 0, last: r.last || null, tags: r.tags || [], star: !!r.star, fu: r.fu || 0,
      has: r.has || {}, pre: r.pre || null, at: r.at || 0, upd: Math.max(r.upd || 0, (live && live.op) || 0) });
  }
  return rows;
}

/** The custom tags in use, most used first. */
export function tagCounts(crm) {
  const n = new Map();
  for (const r of Object.values(crm.byId || {})) for (const t of r.tags || []) { const k = t.toLowerCase(); const x = n.get(k) || { tag: t, n: 0 }; x.n++; n.set(k, x); }
  return [...n.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag));
}

/** Samples the old console built, before CRM existed, get a contact of their own, so the
 *  table is the whole picture. A few at a time; the next summary does the rest. */
export async function adoptOrphans(reg, crm, { limit = 10, now = Date.now() } = {}) {
  const have = new Set(Object.values(crm.byId).map((r) => r.owner).filter(Boolean));
  // `skip`: pages whose contact the founder deleted on purpose (Delete contact) stay out
  const skip = crm.skip || {};
  const todo = Object.entries(reg.byId || {}).filter(([o]) => !have.has(o) && !skip[o]).slice(0, limit);
  let made = 0;
  for (const [owner, row] of todo) {
    const kind = row.k === 'v' ? 'venue' : 'artist';
    let links = {};
    try {
      const { data: rec } = await readDoc(`sample_${owner}`, null);
      const L = (rec && rec.seed && rec.seed.links) || {};
      for (const k of linkKinds(kind)) if (L[k]) links[k] = L[k];
    } catch {}
    const r = await createContact(kind, { name: row.name || row.slug, city: row.city || '', links }, { now: row.at || now, force: true });
    if (r.ok) { await linkOwner(r.cid, owner, { now: row.at || now }); made++; }
  }
  return made;
}

/** A seed for suppression when a contact with no page says no. */
export function seedForSuppression(kind, d) { return parseSeed(seedFrom(kind, d).line); }
