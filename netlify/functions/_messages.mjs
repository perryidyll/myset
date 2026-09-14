import { randomBytes, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc, sha, json, bad, store, DEFAULT_ARTIST } from './_lib.mjs';
import { appendLog, readLog, logKeys } from './_append.mjs';
import { notify } from './_push.mjs';
import { readArtists, artistById, sendMail, emailReady, normEmail, validEmail } from './_auth.mjs';
import { logErr } from './_errlog.mjs';

/* MESSAGES — the Book button on the artist page (the founder, 2026-09-14).

   A booker — a venue, a promoter, somebody planning a party — writes to the artist
   from the public page. The words land in the Studio under Messages, in a Requests
   folder; the artist answers there; the answer reaches the booker at the link they
   were given when they sent it (and by email, when mail is configured). Replying
   moves the conversation to General; Business, Casual and Spam are the artist's
   own filing; Report flags it to MySet; Block stops that sender arriving again.

   THE BOOKER IS NOT THE AUDIENCE. The room never signs in and is never named
   (9g, 0bu); a request from the shop is a sentence with no way back (0fp). A
   booker is different on purpose: they give a name and an email so they can be
   answered, the way a contact form works everywhere. That is decision 0074. The
   device id is stored only hashed, only for limits and blocking (0ae); the email
   never leaves the owner's own reads and the booker's token-gated one.

   NOTHING HERE MAY DEPEND ON A NOTIFICATION. Push needs VAPID keys and a phone that
   said yes; mail needs a verified sender. Both are wired and best-effort; the
   Studio's badge and the booker's link are the paths that always work.

   Keys: `inbox_<aid>` (the index the Studio lists: one small document, capped and
   spilled into `inboxarch_<aid>` — 0fr), `msg_<aid>_<tid>` (one conversation).
   Nothing global (0a); every key is computable from the index (1, 0cy). */

export const INBOX = (aid) => `inbox_${aid}`;
export const ARCH = (aid) => `inboxarch_${aid}`;
export const THREAD = (aid, tid) => `msg_${aid}_${tid}`;

export const MAX_THREADS = 300;            // rows the index keeps; older ones spill to the archive
export const MAX_MSGS = 200;               // messages in one conversation; the next is refused, never dropped
export const MAX_TEXT = 1000;
export const MIN_TEXT = 10;
export const MAX_NAME = 60;
export const MAX_EMAIL = 120;
export const MAX_PHONE = 30;
export const MAX_VENUE = 80;
export const MAX_WHEN = 40;
export const MAX_PREVIEW = 90;
export const MSG_DAY = 24 * 3600e3;
export const THREADS_PER_DEVICE_PER_DAY = 3;
export const THREADS_PER_EMAIL_PER_DAY = 3;      // the device id is the phone's own word; the address is a second axis
export const THREADS_PER_NETWORK_PER_DAY = 60;
export const THREADS_PER_ARTIST_PER_DAY = 200;   // past this a new one lands in Spam, not in Requests
export const REPLIES_PER_THREAD_PER_DAY = 30;
export const SPAM_LINKS = 3;                     // three links in one message is a pitch, not a booking
export const MAX_BLOCKED = 500;
export const MAILS_PER_ARTIST_PER_DAY = 20;      // "you have a message" letters a day; push has no such cap (it coalesces by tag)
export const FOLDERS = ['requests', 'general', 'business', 'casual', 'spam'];
export const KINDS = ['booking', 'collab', 'press', 'other'];
export const NOTIFY_MS = 1500;                   // the reply never waits longer than this on mail or push

const h10 = (v) => sha(String(v || '')).slice(0, 10);
/* The inbox's own salt on the device hash, so the first NAMED record in the store
   can never be joined to a phone's anonymous posts, requests or RSVPs by a shared
   hash (0bu: counted, never named). */
const devHash = (aid, fan) => h10('msg|' + aid + '|' + fan);
const oneLine = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
/* A message keeps its line breaks and loses everything else that is not text. */
const cleanText = (v) => String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, ' ')
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TEXT);
const preview = (t) => oneLine(t, MAX_PREVIEW);
const dayOf = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const linkCount = (t) => (String(t).match(/https?:\/\/|www\./gi) || []).length;

/* Ids are minted OUTSIDE the CAS (0fs): a retry must write the same id. */
export const newThreadId = () => 't' + Array.from(randomBytes(10)).map((b) => (b % 36).toString(36)).join('');
export const newToken = () => randomBytes(16).toString('hex');
const sameToken = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === 32 && y.length === 32 && timingSafeEqual(x, y);
};

const emptyInbox = () => ({ v: 1, n: 0, threads: [], blocked: [], recent: [], day: { d: '', n: 0, mail: 0 } });
const normInbox = (d) => {
  d.v ||= 1; d.n = Math.max(0, parseInt(d.n, 10) || 0);
  d.threads = Array.isArray(d.threads) ? d.threads.filter((t) => t && t.id) : [];
  d.blocked = Array.isArray(d.blocked) ? d.blocked.filter(Boolean) : [];
  d.recent = Array.isArray(d.recent) ? d.recent.filter(Boolean) : [];
  d.day = d.day && typeof d.day === 'object' ? d.day : { d: '', n: 0, mail: 0 };
  return d;
};

export async function readInbox(aid) {
  const { data } = await readDoc(INBOX(aid), null);
  return normInbox({ ...emptyInbox(), ...(data || {}) });
}
export async function readThread(aid, tid) {
  if (!/^t[a-z0-9]{10}$/.test(String(tid || ''))) return null;
  const { data } = await readDoc(THREAD(aid, tid), null);
  if (!data || !data.id) return null;
  data.msgs = Array.isArray(data.msgs) ? data.msgs.filter(Boolean) : [];
  return data;
}
/** The booker's read: the id and the token together, compared in constant time. */
export async function threadByToken(aid, tid, k) {
  const t = await readThread(aid, tid);
  return t && sameToken(t.k, k) ? t : null;
}

const isBlocked = (inbox, e, f) => inbox.blocked.some((b) => b && ((e && b.e === e) || (f && b.f === f)));

/** The Book form. Returns { ok, id, k } — and the same shape, with nothing stored and
 *  nothing said, for a blocked sender, a filled honeypot or a repeat of the same words
 *  from the same phone (9h: the door never says who it refuses). A limit the sender
 *  should hear comes back as { ok:false, error, status:429 }. */
export async function sendThread(aid, { fan, ip, name, email, phone, venue, when, kind, text, hp }, who = {}) {
  if (!fan) return { ok: false, error: 'no device' };
  const nm = oneLine(name, MAX_NAME);
  const em = normEmail(oneLine(email, MAX_EMAIL));
  const body = cleanText(text);
  if (!nm) return { ok: false, error: 'Tell them your name.' };
  if (!em || !validEmail(em)) return { ok: false, error: 'An email address they can reply to, please.' };
  if (body.length < MIN_TEXT) return { ok: false, error: 'Say a little more — a sentence or two.' };
  const id = newThreadId(), k = newToken(), now = Date.now();
  if (String(hp || '').trim()) return { ok: true, id, k };            // a form field no person can see was filled in
  const f = devHash(aid, fan), net = h10(aid + '|' + (ip || '')), e = h10(em), tsig = h10(body.toLowerCase());
  const kd = KINDS.includes(String(kind)) ? String(kind) : 'booking';
  let refused = null, dropped = null, folder = 'requests', again = null, mailArtist = false, mailBooker = false;
  const row = { id, folder, unread: true, kind: kd, name: nm, preview: preview(body), lastAt: now, lastBy: 'them',
                count: 1, reported: false, blocked: false, e, f };
  /* THE INDEX FIRST: it holds the block list, the day's counts and the recent ring,
     so every refusal is decided here, inside the CAS, before a conversation exists
     under a valid token. The thread is written second; if that fails the row is
     taken back (below). */
  const r = await casDoc(INBOX(aid), emptyInbox, (d) => {
    normInbox(d);
    refused = null; dropped = null; again = null; folder = 'requests'; mailArtist = false; mailBooker = false;   // a CAS retry starts clean
    if (isBlocked(d, e, f)) { dropped = 'blocked'; return false; }
    d.recent = d.recent.filter((x) => x && now - x.at < MSG_DAY);
    /* The same words from the same phone within a day is a second tap, or a retry
       after a reply that never arrived — the answer is the conversation that
       already exists, so the booker's link and the page's memory point at it. */
    const dup = d.recent.find((x) => x.f === f && x.t === tsig);
    if (dup) { again = dup.id || ''; dropped = 'dup'; return false; }
    if (d.recent.filter((x) => x.f === f).length >= THREADS_PER_DEVICE_PER_DAY) { refused = 'That’s three messages today from this phone — come back tomorrow.'; return false; }
    if (d.recent.filter((x) => x.e === e).length >= THREADS_PER_EMAIL_PER_DAY) { refused = 'That’s three messages today from this address — come back tomorrow.'; return false; }
    if (d.recent.filter((x) => x.n === net).length >= THREADS_PER_NETWORK_PER_DAY) { refused = 'This network has sent a lot today. Try again tomorrow.'; return false; }
    if (d.day.d !== dayOf(now)) d.day = { d: dayOf(now), n: 0, mail: 0 };
    d.day.n += 1;
    if (d.day.n > THREADS_PER_ARTIST_PER_DAY || linkCount(body) >= SPAM_LINKS) folder = 'spam';
    row.folder = folder;
    /* Letters are budgeted here too: the artist's, so an anonymous door can never
       run MySet's sender dry (twenty a day, then the badge and push carry it); the
       booker's receipt, once per address per artist per day — a receipt is the
       only mail a stranger-typed address ever gets before the artist has replied. */
    if (folder === 'requests' && (d.day.mail || 0) < MAILS_PER_ARTIST_PER_DAY) { d.day.mail = (d.day.mail || 0) + 1; mailArtist = true; }
    if (folder === 'requests' && !d.recent.some((x) => x.e === e)) mailBooker = true;
    d.recent.push({ f, n: net, e, t: tsig, id, at: now });
    if (d.recent.length > 400) d.recent = d.recent.slice(-400);
    d.threads.push(row);
    d.n += 1;
    return true;
  });
  if (dropped === 'dup') {
    const t = again ? await readThread(aid, again) : null;
    return t && !t.blocked ? { ok: true, id: t.id, k: t.k } : { ok: true, id, k };
  }
  if (dropped) return { ok: true, id, k };
  if (refused) return { ok: false, error: refused, status: 429 };
  /* The conversation itself, written once. A retry after a write that stuck is the
     same bytes under the same id, so onlyIfNew's refusal is fine. */
  try {
    await casDoc(THREAD(aid, id), () => ({}), (t) => {
      if (t.id) return false;
      Object.assign(t, { v: 1, id, aid, kind: kd, name: nm, email: em, phone: oneLine(phone, MAX_PHONE),
        venue: oneLine(venue, MAX_VENUE), when: oneLine(when, MAX_WHEN), k, e, f, folder, unread: true,
        reported: false, blocked: false, at: now, rday: { d: '', n: 0 }, msgs: [{ by: 'them', text: body, at: now }] });
      return true;
    });
  } catch {
    // the row must not outlive a conversation that never landed (0cy: nothing unnamed, nothing named that is not there)
    await casDoc(INBOX(aid), emptyInbox, (d) => { normInbox(d); d.threads = d.threads.filter((t) => t.id !== id); d.recent = d.recent.filter((x) => x.id !== id); return true; }, null, 5).catch(() => {});
    return { ok: false, error: 'Couldn’t get that through — try again.', status: 503 };
  }
  if (r && r.data && r.data.threads.length > MAX_THREADS) await spillInbox(aid).catch(() => {});
  if (folder !== 'spam') await tellArtist(aid, who, { id, name: nm, kd, body, fresh: true, mail: mailArtist }).catch(() => {});
  if (mailBooker) await tellBooker(aid, who, { id, k, email: em, artistReply: null }).catch(() => {});
  return { ok: true, id, k };
}

/* Past the cap the OLDEST rows go to the archive — appended first, trimmed after
   (0fr) — answered ones before unanswered ones, so a Request outlives a filed
   conversation of the same age; but the index is ONE small document, so past the
   cap even an unanswered request goes (it is still on disk under its own key and
   in the export). A row can sit in both for a moment if the trim fails; readers
   dedupe by id. */
async function spillInbox(aid) {
  const inbox = await readInbox(aid);
  if (inbox.threads.length <= MAX_THREADS) return;
  const over = inbox.threads.length - MAX_THREADS;
  const oldest = (list) => list.slice().sort((a, b) => a.lastAt - b.lastAt);
  const gone = [...oldest(inbox.threads.filter((t) => t.folder !== 'requests')),
                ...oldest(inbox.threads.filter((t) => t.folder === 'requests'))].slice(0, over);
  if (!gone.length) return;
  await appendLog(ARCH(aid), gone.map(({ e, f, ...t }) => ({ ...t, e, f })));
  const ids = new Set(gone.map((t) => t.id));
  await casDoc(INBOX(aid), emptyInbox, (d) => { normInbox(d); d.threads = d.threads.filter((t) => !ids.has(t.id)); return true; });
}

/* One row in the index, kept in step with the conversation it names. A row that
   spilled to the archive comes back when its conversation moves again (`make`
   builds it from the thread), so a booker's reply is never invisible; the archive
   keeps its copy and readers dedupe by id. */
async function touchRow(aid, tid, fn, make = null) {
  await casDoc(INBOX(aid), emptyInbox, (d) => {
    normInbox(d);
    let r = d.threads.find((t) => t.id === tid);
    if (!r) { if (!make) return false; r = make(); d.threads.push(r); }
    fn(r, d);
    return true;
  });
}
const rowOf = (t) => ({ id: t.id, folder: FOLDERS.includes(t.folder) ? t.folder : 'general', unread: !!t.unread, kind: t.kind || 'booking',
  name: t.name || '', preview: preview((t.msgs || []).slice(-1)[0] ? t.msgs.slice(-1)[0].text : ''), lastAt: Date.now(), lastBy: 'them',
  count: (t.msgs || []).length, reported: !!t.reported, blocked: !!t.blocked, e: t.e || h10(t.email), f: t.f || '' });

/** The artist answers. Requests → General; read; the booker is told. */
export async function ownerReply(aid, tid, text, who = {}) {
  const body = cleanText(text);
  if (body.length < 1) return { ok: false, error: 'Write a reply first.' };
  const now = Date.now();
  let err = null, thread = null;
  await casDoc(THREAD(aid, tid), () => ({}), (t) => {
    if (!t.id) { err = 'That conversation is gone.'; return false; }
    t.msgs = Array.isArray(t.msgs) ? t.msgs : [];
    if (t.msgs.length >= MAX_MSGS) { err = 'This conversation is full — start a new one.'; return false; }
    t.msgs.push({ by: 'me', text: body, at: now });
    t.unread = false;
    if (t.folder === 'requests') t.folder = 'general';
    thread = t;
    return true;
  });
  if (err) return { ok: false, error: err };
  await touchRow(aid, tid, (r) => { r.unread = false; if (r.folder === 'requests') r.folder = 'general'; r.preview = preview(body); r.lastAt = now; r.lastBy = 'me'; r.count = thread.msgs.length; }, () => rowOf(thread));
  await tellBooker(aid, who, { id: tid, k: thread.k, email: thread.email, artistReply: body }).catch(() => {});
  return { ok: true, folder: thread.folder };
}

/** The booker writes again, by the token. A blocked conversation swallows it (9h). */
export async function bookerReply(aid, tid, k, text, who = {}) {
  const body = cleanText(text);
  if (body.length < 1) return { ok: false, error: 'Write a reply first.' };
  const now = Date.now();
  const inbox = await readInbox(aid);
  let err = null, thread = null, dropped = false, wasUnread = false;
  await casDoc(THREAD(aid, tid), () => ({}), (t) => {
    if (!t.id || !sameToken(t.k, k)) { err = 'That conversation isn’t here.'; return false; }
    if (t.blocked || isBlocked(inbox, t.e || h10(t.email), t.f)) { dropped = true; return false; }
    t.msgs = Array.isArray(t.msgs) ? t.msgs : [];
    if (t.msgs.length >= MAX_MSGS) { err = 'This conversation is full — start a new one.'; return false; }
    t.rday = t.rday && t.rday.d === dayOf(now) ? t.rday : { d: dayOf(now), n: 0 };
    if (t.rday.n >= REPLIES_PER_THREAD_PER_DAY) { err = 'That’s a lot for one day — try again tomorrow.'; return false; }
    t.rday.n += 1;
    t.msgs.push({ by: 'them', text: body, at: now });
    wasUnread = !!t.unread;
    t.unread = true;
    thread = t;
    return true;
  });
  if (dropped) return { ok: true };
  if (err) return { ok: false, error: err, status: err.startsWith('That’s a lot') ? 429 : 404 };
  await touchRow(aid, tid, (r) => { r.unread = true; r.preview = preview(body); r.lastAt = now; r.lastBy = 'them'; r.count = thread.msgs.length; }, () => rowOf(thread));
  /* A letter only when the conversation turns from read to unread — the artist
     has not seen the last one yet, so a second is noise — and within the day's
     budget; push every time, coalesced by tag. */
  let mail = false;
  if (!wasUnread && thread.folder !== 'spam')
    await casDoc(INBOX(aid), emptyInbox, (d) => { normInbox(d); if (d.day.d !== dayOf(now)) d.day = { d: dayOf(now), n: 0, mail: 0 }; if ((d.day.mail || 0) >= MAILS_PER_ARTIST_PER_DAY) return false; d.day.mail = (d.day.mail || 0) + 1; mail = true; return true; }).catch(() => {});
  if (thread.folder !== 'spam') await tellArtist(aid, who, { id: tid, name: thread.name, kd: thread.kind, body, fresh: false, mail }).catch(() => {});
  return { ok: true };
}

export async function moveThread(aid, tid, folder) {
  if (!FOLDERS.includes(folder)) return { ok: false, error: 'No such folder.' };
  let err = null;
  await casDoc(THREAD(aid, tid), () => ({}), (t) => { if (!t.id) { err = 'That conversation is gone.'; return false; } t.folder = folder; return true; });
  if (err) return { ok: false, error: err };
  await touchRow(aid, tid, (r) => { r.folder = folder; });
  return { ok: true };
}
export async function setUnread(aid, tid, on) {
  let err = null;
  await casDoc(THREAD(aid, tid), () => ({}), (t) => { if (!t.id) { err = 'That conversation is gone.'; return false; } t.unread = on !== false; return true; });
  if (err) return { ok: false, error: err };
  await touchRow(aid, tid, (r) => { r.unread = on !== false; });
  return { ok: true };
}
/** Report: flagged, filed under Spam, and a line in MySet's own log (0fb: the id,
 *  never the words or the address). There is no moderation queue yet; this is where
 *  one would start. */
export async function reportThread(aid, tid) {
  let err = null;
  await casDoc(THREAD(aid, tid), () => ({}), (t) => { if (!t.id) { err = 'That conversation is gone.'; return false; } t.reported = true; t.folder = 'spam'; return true; });
  if (err) return { ok: false, error: err };
  await touchRow(aid, tid, (r) => { r.reported = true; r.folder = 'spam'; });
  await logErr('msgreport', new Error('reported ' + tid), { aid }).catch(() => {});
  await tellPlatform(aid, tid).catch(() => {});
  return { ok: true };
}
/* The founder hears about a report the way an artist hears about a message: a
   push to the founding account and a letter to its owner addresses, carrying the
   artist's id and the conversation's id — never the words, never the address. */
async function tellPlatform(aid, tid) {
  const jobs = [notify(DEFAULT_ARTIST, { title: 'A conversation was reported', body: `${aid} · ${tid}`, url: '/studio', tag: 'msgreport' })];
  const reg = await readArtists().catch(() => null);
  const emails = reg ? Object.entries(reg.byEmail || {}).filter(([, v]) => v && v.artistId === DEFAULT_ARTIST && (v.role || 'owner') === 'owner').map(([e]) => e) : [];
  for (const e of emails.slice(0, 3))
    jobs.push(sendMail(e, 'A conversation was reported on MySet', [`An artist reported a conversation from their Book button.`, `Artist: ${aid}`, `Conversation: ${tid}`, 'It is filed under their Spam; the words stay with them.']));
  await within(Promise.allSettled(jobs), NOTIFY_MS);
}
/** Block: this sender's email hash and device hash on the artist's own list — never
 *  the network (a whole bar shares one, 0ck). They are not told. Off takes it back. */
export async function blockSender(aid, tid, on) {
  const t = await readThread(aid, tid);
  if (!t) return { ok: false, error: 'That conversation is gone.' };
  const e = h10(t.email), f = t.f || '';
  await casDoc(INBOX(aid), emptyInbox, (d) => {
    normInbox(d);
    d.blocked = d.blocked.filter((b) => b && b.e !== e && !(f && b.f === f));
    if (on !== false) { d.blocked.push({ e, f, at: Date.now(), t: tid }); if (d.blocked.length > MAX_BLOCKED) d.blocked = d.blocked.slice(-MAX_BLOCKED); }
    for (const r of d.threads) if (r.e === e || (f && r.f === f)) { r.blocked = on !== false; if (on !== false) r.folder = 'spam'; }
    return true;
  });
  await casDoc(THREAD(aid, tid), () => ({}), (x) => { if (!x.id) return false; x.blocked = on !== false; if (on !== false) x.folder = 'spam'; return true; });
  return { ok: true };
}

/* ---------- shapes ---------- */
/** What the Studio lists: newest first, never a hash, never a token. */
export function shapeIndex(inbox) {
  const seen = new Set();
  const rows = inbox.threads.slice().sort((a, b) => b.lastAt - a.lastAt).filter((t) => (seen.has(t.id) ? false : seen.add(t.id)))
    .map((t) => ({ id: t.id, folder: FOLDERS.includes(t.folder) ? t.folder : 'general', unread: !!t.unread, kind: t.kind || 'booking',
      name: t.name || '', preview: t.preview || '', lastAt: t.lastAt || 0, lastBy: t.lastBy || 'them', count: t.count || 1,
      reported: !!t.reported, blocked: !!t.blocked }));
  const counts = { requests: 0, general: 0, business: 0, casual: 0, spam: 0, unread: 0 };
  for (const r of rows) { counts[r.folder] += 1; if (r.unread && r.folder !== 'spam') counts.unread += 1; }
  return { threads: rows, counts };
}
export function shapeThread(t) {
  return { id: t.id, kind: t.kind || 'booking', name: t.name || '', email: t.email || '', phone: t.phone || '', venue: t.venue || '',
    when: t.when || '', folder: t.folder || 'general', unread: !!t.unread, reported: !!t.reported, blocked: !!t.blocked, at: t.at || 0,
    msgs: (t.msgs || []).map((m) => ({ by: m.by === 'me' ? 'me' : 'them', text: m.text || '', at: m.at || 0 })) };
}
/** What the booker sees at their link: their own words and the artist's, no more. */
export function shapeForBooker(t, artistName) {
  return { id: t.id, kind: t.kind || 'booking', name: t.name || '', at: t.at || 0, artist: { name: artistName || '' },
    msgs: (t.msgs || []).map((m) => ({ by: m.by === 'me' ? 'artist' : 'you', text: m.text || '', at: m.at || 0 })) };
}

/* ---------- telling people (best-effort, time-boxed, never thrown) ---------- */
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const threadLink = (slug, id, k) => `https://myset.vip/${encodeURIComponent(slug || '')}#m=${id}.${k}`;

async function tellArtist(aid, who, { id, name, kd, body, fresh, mail }) {
  const title = fresh ? `New ${kd === 'booking' ? 'booking request' : 'message'} from ${name}` : `${name} replied`;
  const jobs = [notify(aid, { title, body: preview(body), url: '/studio?tab=messages', tag: 'msg-' + id })];
  if (mail && emailReady()) {
    const reg = await readArtists().catch(() => null);
    const emails = reg ? Object.entries(reg.byEmail || {}).filter(([, v]) => v && v.artistId === aid && (v.role || 'owner') === 'owner').map(([e]) => e) : [];
    for (const e of emails.slice(0, 5))
      jobs.push(sendMail(e, title, [`${name} wrote on your MySet page:`, `“${preview(body)}${body.length > MAX_PREVIEW ? '…' : ''}”`, 'Open Messages in your Studio to read and reply.'],
        { who: who.artistName || '', cta: { label: 'Open Messages', url: 'https://myset.vip/studio?tab=messages' } }));
  }
  await within(Promise.allSettled(jobs), NOTIFY_MS);
}
/* The booker's letters carry the artist's name and the link — never a word the
   booker (or anyone at the door) typed, so the door can never be used to post
   somebody else's text through MySet's sender. */
async function tellBooker(aid, who, { id, k, email, artistReply }) {
  if (!email || !emailReady()) return;
  const link = threadLink(who.slug, id, k);
  const artist = who.artistName || 'the artist';
  const lines = artistReply
    ? [`${artist} replied:`, `“${preview(artistReply)}${artistReply.length > MAX_PREVIEW ? '…' : ''}”`, 'Read it all and answer at your link.']
    : [`Your message to ${artist} was sent.`, 'They reply at this link — keep it:', link];
  await within(sendMail(email, artistReply ? `${artist} replied to you on MySet` : `Your message to ${artist} was sent`, lines,
    { who: artist, cta: { label: artistReply ? 'Read the reply' : 'Open the conversation', url: link } }), NOTIFY_MS);
}

/* ---------- every key, for delete / export / mirror (0cy, 0ft) ---------- */
export async function messageKeys(aid) {
  const keys = [INBOX(aid)];
  for (const k of await logKeys(ARCH(aid)).catch(() => [ARCH(aid)])) keys.push(k);
  const inbox = await readInbox(aid);
  const ids = new Set(inbox.threads.map((t) => t.id));
  const arch = await readLog(ARCH(aid)).catch(() => ({ list: [] }));
  for (const t of arch.list || []) if (t && t.id) ids.add(t.id);
  for (const id of ids) keys.push(THREAD(aid, id));
  return keys;
}
/** Everything, for the account export: every conversation the index or the archive names. */
export async function exportMessages(aid) {
  const inbox = await readInbox(aid);
  const arch = await readLog(ARCH(aid)).catch(() => ({ list: [] }));
  const ids = [...new Set([...inbox.threads.map((t) => t.id), ...(arch.list || []).map((t) => t && t.id).filter(Boolean)])];
  const threads = [];
  for (const id of ids) { const t = await readThread(aid, id); if (t) threads.push(shapeThread(t)); }
  return threads;
}

/* ---------- the Studio's actions (dispatched from admin.mjs; the seat gate is there) ---------- */
export const MSG_ACTIONS = new Set(['msgCount', 'msgList', 'msgThread', 'msgReply', 'msgMove', 'msgUnread', 'msgReport', 'msgBlock']);
export async function handleMessages(aid, action, body) {
  const tid = String(body.t || body.id || '');
  const whoAmI = async () => { const a = await artistById(aid).catch(() => null); return { slug: (a && a.slug) || '', artistName: (a && a.name) || '' }; };
  if (action === 'msgCount') { const { counts } = shapeIndex(await readInbox(aid)); return json({ ok: true, unread: counts.unread, requests: counts.requests }); }
  if (action === 'msgList') { const s = shapeIndex(await readInbox(aid)); return json({ ok: true, ...s, limits: { text: MAX_TEXT, msgs: MAX_MSGS }, folders: FOLDERS, kinds: KINDS, mail: emailReady() }); }
  if (action === 'msgThread') {
    const t = await readThread(aid, tid);
    if (!t) return bad('That conversation is gone.', 404);
    if (t.unread) await setUnread(aid, tid, false).catch(() => {});
    return json({ ok: true, thread: { ...shapeThread(t), unread: false }, mail: emailReady() });
  }
  if (action === 'msgReply') { const r = await ownerReply(aid, tid, body.text, await whoAmI()); return r.ok ? json(r) : bad(r.error); }
  if (action === 'msgMove') { const r = await moveThread(aid, tid, String(body.folder || '')); return r.ok ? json(r) : bad(r.error); }
  if (action === 'msgUnread') { const r = await setUnread(aid, tid, body.on !== false); return r.ok ? json(r) : bad(r.error); }
  if (action === 'msgReport') { const r = await reportThread(aid, tid); return r.ok ? json(r) : bad(r.error); }
  if (action === 'msgBlock') { const r = await blockSender(aid, tid, body.on !== false); return r.ok ? json(r) : bad(r.error); }
  return bad('unknown action');
}
