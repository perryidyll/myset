import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readDoc, casDoc, store } from './_lib.mjs';
import { authSecret } from './_auth.mjs';

/* THE FOUNDER'S OWN GMAIL, FOR HQ (the outreach dashboard at /crm). Outreach email goes
   out from his own address and the replies come back into HQ's message centre, through
   Google's OAuth. Never through MySet's transactional sender (Resend): that one carries
   every sign-in code, and one artist marking a cold email as spam must never cost
   another artist their code at a gig.

   ONE DOCUMENT, `crmgmail`, at a computable key (INVARIANT 1):
     { v:1, email, rt, at, exp, scope, connectedAt, lastSync, err, seen }
   `rt` and `at`, the refresh and access tokens, are sealed with AES-256-GCM under a key
   derived from the site's auth secret. The raw tokens are never stored, logged or
   returned: a copy of this document on its own (in the R2 mirror, which never copies
   `authsecret`, see _mirror.mjs SKIP, or pasted into a chat) is ciphertext without its
   key. The local backup (tools/backup.py) holds both, so it is as private as the site.

   WHAT GOOGLE DOES THAT THIS LEANS ON, as Google documents it. None of it has been
   exercised against a live account from here: not checked.
   - A refresh token comes back only with access_type=offline, and reliably only with
     prompt=consent. connect() refuses to keep a connection without one.
   - Granular consent lets a person untick one of the two Gmail boxes. connect() refuses
     half a grant: an HQ that can read but not send is a button that leads to a shrug.
   - A refresh token dies when it is revoked, when the Google password changes (Gmail
     scopes), after six months unused, and after seven days while the Google Cloud app's
     publishing status is "Testing". Every one of those answers `invalid_grant`, which
     becomes err 'revoked' on the document and "connect Gmail again" in HQ.
   - Gmail puts its own Message-ID on what it sends, so sendMail reads it back: the next
     reply needs it to thread.

   Every call that touches the network takes { fetch, now } so the tests can play Google,
   and every error it throws is an Error with a `.code`:
     not-configured  GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET is missing
     not-connected   no Gmail has been connected
     revoked         Google no longer honours the saved connection: connect again
     google          Google said no, or did not answer (`.status`; 0 when unreachable)
     bad-state       the return from Google's consent screen did not start here, or took
                     longer than ten minutes */

export const GMAIL_DOC = 'crmgmail';
export const SCOPES = Object.freeze(['openid', 'email',
  'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']);
const NEED = SCOPES.slice(2);            // HQ cannot work without these two; `email` comes back renamed userinfo.email
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://gmail.googleapis.com/gmail/v1/users/me/';
const STATE_MS = 10 * 60e3;              // the consent screen is a minute's work; ten is generous
const CALL_MS = 8000;                    // inside a function's ten seconds: a hung Google is an error, not a dead request
const SEEN_MAX = 500;
const TEXT_MAX = 4000;

const tagged = (code, message, extra = {}) => Object.assign(new Error(message), { code }, extra);
const SAY = {
  'not-configured': 'Gmail is not set up on the server: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET go in Netlify.',
  'not-connected': 'No Gmail is connected yet.',
  revoked: 'Google no longer accepts the saved Gmail connection (revoked, expired, or the Google password changed). Connect Gmail again.',
  'bad-state': 'That Google sign-in did not start here, or took longer than ten minutes. Press Connect again.',
};
const fail = (code) => tagged(code, SAY[code]);
const clean = (v, n = 200) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);
const b64u = (b) => Buffer.from(b).toString('base64url');
/* `now` is a function like Date.now; a plain number is taken too, so a caller that hands
   over a timestamp gets the same answer rather than a crash. */
const nowOf = (o) => { const n = o && o.now; return typeof n === 'function' ? Number(n()) : Number.isFinite(n) ? n : Date.now(); };
const fetchOf = (o) => (o && typeof o.fetch === 'function' ? o.fetch : globalThis.fetch);
const client = () => ({ id: String(process.env.GMAIL_CLIENT_ID || '').trim(), secret: String(process.env.GMAIL_CLIENT_SECRET || '').trim() });
const FORM = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
const form = (o) => new URLSearchParams(o).toString();

/** Both client variables are set, so a Gmail can be connected at all. */
export function configured(env = process.env) {
  const e = env || {};
  return !!(String(e.GMAIL_CLIENT_ID || '').trim() && String(e.GMAIL_CLIENT_SECRET || '').trim());
}
/** Where Google sends the browser back. Registered with Google letter for letter: the
 *  consent link and the code exchange must name the same one. */
export function redirectUri(site = process.env.URL || 'https://myset.vip') {
  return `${String(site || process.env.URL || 'https://myset.vip').trim().replace(/\/+$/, '')}/api/hq/gmail`;
}

/* ---------- the network, one way ---------- */
async function call(o, url, init, what) {
  let r;
  try { r = await fetchOf(o)(url, { ...init, signal: AbortSignal.timeout(CALL_MS) }); }
  catch (e) {
    const slow = e && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw tagged('google', slow ? `${what}: Google did not answer in ${CALL_MS / 1000} s` : `${what}: Google could not be reached (${clean(e && e.message, 80)})`, { status: 0 });
  }
  const text = await r.text().catch(() => '');
  let body = null;
  try { body = text ? JSON.parse(text) : {}; } catch {}
  return { ok: r.ok, status: r.status, body, text };
}
/** Google's own words, short: `{error:{message}}` from Gmail, `{error, error_description}` from OAuth. */
function why(res) {
  const b = res.body || {}, e = b.error;
  return clean((e && typeof e === 'object' && e.message) || b.error_description || (typeof e === 'string' && e) || res.text || `HTTP ${res.status}`, 160);
}

/* ---------- the state that rides through Google's consent screen ----------
   Signed, so the return trip can only finish a sign-in this server started, and short-
   lived. The prefix keeps it from ever being mistaken for any other signed thing here. */
const stateMac = async (payload) => createHmac('sha256', await authSecret()).update(`gmail-state|${payload}`).digest('base64url');
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};
export async function signState(o = {}) {
  const payload = b64u(JSON.stringify({ n: randomBytes(16).toString('base64url'), exp: nowOf(o) + STATE_MS }));
  return `${payload}.${await stateMac(payload)}`;
}
export async function checkState(state, o = {}) {
  if (typeof state !== 'string' || state.length > 400) return false;
  const [payload, sig, extra] = state.split('.');
  if (!payload || !sig || extra !== undefined) return false;
  if (!same(sig, await stateMac(payload))) return false;
  let d;
  try { d = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); } catch { return false; }
  return !!d && typeof d.n === 'string' && Number.isFinite(d.exp) && nowOf(o) < d.exp;
}

/** The link to Google's consent screen. */
export async function authUrl(o = {}) {
  if (!configured()) throw fail('not-configured');
  const state = await signState(o);
  const p = new URLSearchParams({ client_id: client().id, redirect_uri: redirectUri(o.site), response_type: 'code',
    scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
  return { url: `${AUTH_URL}?${p}`, state };
}

/* ---------- the tokens, sealed ----------
   `v2.` (decision 0113): sealed with the keyring (_seal.mjs) once the server holds its
   own secret — the same keys every sealed record uses, which a new MYSET_SECRET
   re-wraps instead of stranding, so a rotation never disconnects the mailbox. `v1.`
   is how a token was sealed before, under a key cut from the store-kept key; it is
   still how one is sealed when no secret is set, and one sealed that way still opens
   (the store key stays in the store for exactly this — storeKey in _auth.mjs). The
   whole `crmgmail` document is sealed as well. */
const TOKEN_AAD = `${GMAIL_DOC}|token`;
const legacyKey = async (make) => {
  const { storeKey } = await import('./_auth.mjs');
  const k = make ? await authSecret() : await storeKey();
  return k ? createHmac('sha256', k).update('myset-gmail-token-v1').digest() : null;
};
export async function encrypt(text) {
  const { configured } = await import('./_secret.mjs');
  if (configured()) {
    const { seal } = await import('./_seal.mjs');
    return `v2.${(await seal(TOKEN_AAD, Buffer.from(String(text), 'utf8'))).toString('base64url')}`;
  }
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', await legacyKey(true), iv, { authTagLength: 16 });
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return `v1.${b64u(iv)}.${b64u(c.getAuthTag())}.${b64u(ct)}`;
}
/** The text back, or null for anything that was not sealed here or was changed since. */
export async function decrypt(box) {
  try {
    const str = String(box == null ? '' : box);
    if (str.startsWith('v2.')) {
      const { open } = await import('./_seal.mjs');
      const o = await open(TOKEN_AAD, Buffer.from(str.slice(3), 'base64url'));
      return o.fail || o.plain ? null : o.data.toString('utf8');
    }
    const [v, iv, tag, ct, extra] = str.split('.');
    if (v !== 'v1' || !iv || !tag || ct === undefined || extra !== undefined) return null;
    const t = Buffer.from(tag, 'base64url'), i = Buffer.from(iv, 'base64url');
    if (t.length !== 16 || i.length !== 12) return null;
    const key = await legacyKey(false);
    if (!key) return null;
    const d = createDecipheriv('aes-256-gcm', key, i, { authTagLength: 16 });
    d.setAuthTag(t);
    return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
  } catch { return null; }
}

/* ---------- connecting ---------- */
/** The return from Google's consent screen: the code for tokens, the tokens sealed, the
 *  mailbox's own address read from Gmail. */
export async function connect(o = {}) {
  if (!configured()) throw fail('not-configured');
  if (!(await checkState(o.state, o))) throw fail('bad-state');
  const code = String(o.code || '').trim();
  if (!code) throw tagged('google', 'Google sent no sign-in code back (was the consent screen closed?). Press Connect again.', { status: 0 });
  const t = nowOf(o), { id, secret } = client();
  const tok = await call(o, TOKEN_URL, { method: 'POST', headers: FORM,
    body: form({ code, client_id: id, client_secret: secret, redirect_uri: redirectUri(o.site), grant_type: 'authorization_code' }) }, 'Google sign-in');
  const b = tok.body || {};
  if (!tok.ok || !b.access_token) throw tagged('google', `Google would not finish the sign-in (${tok.status}): ${why(tok)}`, { status: tok.status });
  if (!b.refresh_token) throw tagged('google', 'Google did not hand over a lasting key (no refresh token), so the connection could not be kept. Press Connect again; if it happens twice, remove MySet under Google Account, Security, Third-party access, and connect once more.', { status: tok.status });
  const granted = new Set(String(b.scope || '').split(/\s+/).filter(Boolean));
  if (granted.size && NEED.some((s) => !granted.has(s)))
    throw tagged('google', 'Google gave MySet only part of Gmail. Press Connect again and leave both Gmail boxes ticked: send, and read.', { status: tok.status });
  const prof = await call(o, `${API}profile`, { headers: { authorization: `Bearer ${b.access_token}`, accept: 'application/json' } }, 'Gmail');
  const email = clean(prof.body && prof.body.emailAddress, 160).toLowerCase();
  if (!prof.ok || !email) throw tagged('google', `Gmail ${prof.status}: ${why(prof)}`, { status: prof.status });
  const rt = await encrypt(b.refresh_token), at = await encrypt(b.access_token);
  const exp = t + Math.max(0, (Number(b.expires_in) || 3600) - 60) * 1000;
  await casDoc(GMAIL_DOC, () => ({}), (d) => {
    /* The same mailbox again (a lapsed or revoked connection renewed): what was synced
       stays synced, so a reconnect never pulls the same replies in twice. */
    const again = d.email === email;
    const lastSync = again ? Number(d.lastSync) || 0 : 0, seen = again && Array.isArray(d.seen) ? d.seen : [];
    for (const k of Object.keys(d)) delete d[k];
    Object.assign(d, { v: 1, email, rt, at, exp, scope: String(b.scope || ''), connectedAt: t, lastSync, err: '', seen });
    return true;
  });
  return { ok: true, email };
}

/** For HQ's summary: never a token. */
export async function status() {
  const { data } = await readDoc(GMAIL_DOC, null);
  const d = data || {};
  return { ready: configured(), connected: !!d.rt, email: String(d.email || ''), lastSync: Number(d.lastSync) || 0, err: String(d.err || '') };
}
/** The Gmail message ids a sync has already handled, oldest first (the last 500). */
export async function seenIds() {
  const { data } = await readDoc(GMAIL_DOC, null);
  return data && Array.isArray(data.seen) ? data.seen.slice() : [];
}

async function markRevoked(rtBox) {
  await casDoc(GMAIL_DOC, () => ({}), (x) => {
    if (!x.rt || x.rt !== rtBox) return false;          // reconnected meanwhile: that one is fine
    x.err = 'revoked'; x.at = ''; x.exp = 0;
    return true;
  }).catch(() => {});
}
/** A live access token: the saved one while it lasts, else a fresh one from the refresh token. */
export async function accessToken(o = {}) {
  if (!configured()) throw fail('not-configured');
  const { data: d } = await readDoc(GMAIL_DOC, null);
  if (!d || !d.rt) throw fail('not-connected');
  /* A dead refresh token never comes back to life, so a sync ring does not ask Google
     again every few minutes. connect() is the only way out, and it clears this. */
  if (d.err === 'revoked') throw fail('revoked');
  const t = nowOf(o);
  if (!o.force && d.at && t < Number(d.exp || 0)) {
    const cached = await decrypt(d.at);
    if (cached) return cached;
  }
  const rt = await decrypt(d.rt);
  if (!rt) { await markRevoked(d.rt); throw fail('revoked'); }
  const { id, secret } = client();
  const res = await call(o, TOKEN_URL, { method: 'POST', headers: FORM,
    body: form({ client_id: id, client_secret: secret, refresh_token: rt, grant_type: 'refresh_token' }) }, 'Google token');
  const b = res.body || {};
  if (b.error === 'invalid_grant') { await markRevoked(d.rt); throw fail('revoked'); }
  if (!res.ok || !b.access_token) throw tagged('google', `Google token ${res.status}: ${why(res)}`, { status: res.status });
  const at = await encrypt(b.access_token), nrt = b.refresh_token ? await encrypt(b.refresh_token) : '';
  const exp = t + Math.max(0, (Number(b.expires_in) || 3600) - 60) * 1000;
  await casDoc(GMAIL_DOC, () => ({}), (x) => {
    if (x.rt !== d.rt) return false;                    // disconnected or reconnected meanwhile: not ours to write
    x.at = at; x.exp = exp;
    if (nrt) x.rt = nrt;
    return true;
  }).catch(() => {});                                   // the token is good either way; the next call just asks again
  return b.access_token;
}

const qs = (q) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q || {})) {
    if (v === undefined || v === null || v === '') continue;
    for (const x of Array.isArray(v) ? v : [v]) p.append(k, String(x));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
};
/** The one door to https://gmail.googleapis.com/gmail/v1/users/me/… A 401 means the
 *  saved access token died early (Google can end one before its hour), so it is renewed
 *  once and the call made again; a second 401 is an answer. */
export async function gapi(path, o = {}) {
  const method = String(o.method || 'GET').toUpperCase();
  const url = API + String(path || '').replace(/^\/+/, '') + qs(o.query);
  const json = o.body !== undefined;
  let token = await accessToken(o);
  for (let tries = 0; ; tries++) {
    const res = await call(o, url, { method, body: json ? JSON.stringify(o.body) : undefined,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(json ? { 'content-type': 'application/json' } : {}) } }, 'Gmail');
    if (res.status === 401 && tries === 0) { token = await accessToken({ ...o, force: true }); continue; }
    if (!res.ok) throw tagged('google', `Gmail ${res.status}: ${why(res)}`, { status: res.status });
    if (!res.body) throw tagged('google', 'Gmail answered with something that is not JSON', { status: res.status });
    return res.body;
  }
}

/* ---------- writing a letter ---------- */
/* HEADER INJECTION. Every header value loses its CR, LF and other control characters, so
   nothing typed into a subject or a name can start a header of its own (a Bcc: to
   somebody else). An address keeps only its first line: joined up, a smuggled second
   line could still read as another address. */
const oneLine = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f\u0085\u2028\u2029]+/g, ' ').replace(/ {2,}/g, ' ').trim();
const firstLine = (v) => String(v == null ? '' : v).split(/[\r\n\u0085\u2028\u2029]+/).map((x) => x.trim()).find(Boolean) || '';
const ascii = (s) => /^[\x20-\x7e]*$/.test(s);
/* RFC 2047 encoded-words, whole characters only, folded onto continuation lines. A line
   that holds one may be 76 characters at most, so a word carries 39 bytes of UTF-8 (52
   base64, 64 characters in all): "Subject: " or "From: " and one word still fit. */
function words(s) {
  const out = [];
  let cur = '', n = 0;
  for (const ch of s) {
    const k = Buffer.byteLength(ch);
    if (n + k > 39 && cur) { out.push(cur); cur = ''; n = 0; }
    cur += ch; n += k;
  }
  if (cur) out.push(cur);
  return out.map((w) => `=?UTF-8?B?${Buffer.from(w).toString('base64')}?=`).join('\r\n ');
}
const phrase = (s) => (!ascii(s) || s.includes('=?') ? words(s)
  : /[()<>[\]:;@\\,."]/.test(s) ? `"${s.replace(/[\\"]/g, '\\$&')}"` : s);
/* `Name <address>`. When the name is encoded words and the address would push their
   line past 76 characters, the address takes a line of its own ("From: " counted). */
const mailbox = (name, email) => {
  const n = oneLine(name), e = oneLine(email).replace(/[<>\s]/g, '');
  if (!n) return e;
  const p = phrase(n), lines = p.split('\r\n');
  const width = (lines.length > 1 ? 0 : 6) + lines[lines.length - 1].length + e.length + 3;
  return `${p}${p.includes('=?') && width > 76 ? '\r\n ' : ' '}<${e}>`;
};
const idOf = (v) => { const s = oneLine(v).replace(/\s+/g, ''); return s ? `<${s.replace(/^<+|>+$/g, '')}>` : ''; };
/** Message ids from a string or a list, each as <…>. An entry that has <…> in it gives only
 *  those; one without, its bare `left@right` words. A long chain keeps its root and its
 *  last nineteen. */
function idList(v) {
  const ids = (Array.isArray(v) ? v : [v]).flatMap((x) => {
    const s = oneLine(x);
    return s.match(/<[^<>\s]+>/g) || s.split(/\s+/).filter((t) => /^[^\s<>@]+@[^\s<>@]+$/.test(t)).map(idOf);
  });
  return ids.length > 20 ? [ids[0], ...ids.slice(-19)] : ids;
}
const rfcDate = (v) => {
  const d = new Date(v == null || v === '' ? Date.now() : v instanceof Date ? v.getTime() : Number(v));
  return (Number.isNaN(d.getTime()) ? new Date() : d).toUTCString().replace(/GMT$/, '+0000');
};
function recipients(to) {
  const out = [];
  for (const v of Array.isArray(to) ? to : [to]) out.push(...parseAddress(firstLine(v)));
  return out;
}

/** The RFC 5322 message, CRLF throughout: a plain-text body, UTF-8, base64 in 76-character
 *  lines. Text is sent in its canonical form, so its line breaks become CRLF. */
export function buildMime({ fromName = '', from = '', to = '', subject = '', text = '', inReplyTo = '', references = '', date, messageId = '' } = {}) {
  const rcpt = recipients(to);
  const subj = oneLine(subject).slice(0, 900);
  const reply = idList(inReplyTo)[0] || '', refs = references ? idList(references) : [];
  const h = [
    `From: ${mailbox(fromName, from)}`,
    `To: ${rcpt.length ? rcpt.map((a) => mailbox(a.name, a.email)).join(',\r\n ') : oneLine(firstLine(Array.isArray(to) ? to[0] : to))}`,
    `Subject: ${subj && (!ascii(subj) || subj.includes('=?')) ? words(subj) : subj}`,
    `Date: ${rfcDate(date)}`,
  ];
  if (idOf(messageId)) h.push(`Message-ID: ${idOf(messageId)}`);
  if (reply) h.push(`In-Reply-To: ${reply}`);
  if (refs.length) h.push(`References: ${refs.join('\r\n ')}`);
  h.push('MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64');
  const body = Buffer.from(String(text == null ? '' : text).replace(/\r\n|\r|\n/g, '\r\n'), 'utf8')
    .toString('base64').replace(/.{76}(?=.)/g, '$&\r\n');
  return `${h.join('\r\n')}\r\n\r\n${body}\r\n`;
}

/** Sends from the connected address. `threadId` + `inReplyTo` + `references` make it a
 *  reply in the same Gmail thread (Gmail also wants the subject to match). */
export async function sendMail(o = {}) {
  if (!configured()) throw fail('not-configured');
  const { data: d } = await readDoc(GMAIL_DOC, null);
  if (!d || !d.rt) throw fail('not-connected');
  const mime = buildMime({ fromName: o.fromName, from: d.email, to: o.to, subject: o.subject, text: o.text,
    inReplyTo: o.inReplyTo, references: o.references, date: nowOf(o) });
  const raw = Buffer.from(mime, 'utf8').toString('base64url');
  const net = { fetch: o.fetch, now: o.now };
  let sent;
  try { sent = await gapi('messages/send', { ...net, method: 'POST', body: o.threadId ? { raw, threadId: String(o.threadId) } : { raw } }); }
  catch (e) {
    /* A thread deleted in Gmail since the last letter: send this one as a new thread
       rather than never again. Its In-Reply-To and References still thread it on their
       side. A refused send was not sent, so trying once more cannot send it twice. */
    if (!o.threadId || e.code !== 'google' || !(e.status === 404 || (e.status === 400 && /thread/i.test(e.message)))) throw e;
    sent = await gapi('messages/send', { ...net, method: 'POST', body: { raw } });
  }
  let msgId = '';
  if (sent && sent.id) {
    /* Sent is sent. A failed read-back costs the threading of the next reply, never a
       second copy: reporting this send as failed would invite exactly that. */
    try {
      const m = await gapi(`messages/${encodeURIComponent(sent.id)}`, { ...net, query: { format: 'metadata', metadataHeaders: 'Message-ID' } });
      msgId = oneLine(headerOf(m.payload, 'message-id'));
    } catch {}
  }
  return { ok: true, id: String((sent && sent.id) || ''), threadId: String((sent && sent.threadId) || ''), msgId };
}

/* ---------- reading ---------- */
/** Message ids for a Gmail search, newest first: [{ id, threadId }]. */
export async function listIds(q, o = {}) {
  const max = Math.min(500, Math.max(1, parseInt(o.max ?? 25, 10) || 25));
  const r = await gapi('messages', { fetch: o.fetch, now: o.now, query: { q: String(q == null ? '' : q).trim(), maxResults: max } });
  return (Array.isArray(r.messages) ? r.messages : []).filter((m) => m && m.id)
    .map((m) => ({ id: String(m.id), threadId: String(m.threadId || '') }));
}

const headerOf = (part, name) => {
  const hs = part && Array.isArray(part.headers) ? part.headers : [];
  const h = hs.find((x) => x && String(x.name || '').toLowerCase() === name);
  return h ? String(h.value == null ? '' : h.value) : '';
};
const mimeOf = (p) => String((p && p.mimeType) || '').toLowerCase().split(';')[0].trim();
const isAttachment = (p) => !!String((p && p.filename) || '').trim() || /^\s*attachment\b/i.test(headerOf(p, 'content-disposition'));
const cap = (s, n, more = '') => {
  if (s.length <= n) return s;
  let t = s.slice(0, n - more.length);
  if (/[\ud800-\udbff]$/.test(t)) t = t.slice(0, -1);   // never half an emoji
  return t + more;
};
function decodeBytes(bytes, charset) {
  try { return new TextDecoder(charset || 'utf-8').decode(bytes); }
  catch { return new TextDecoder('utf-8').decode(bytes); }   // a label TextDecoder does not know
}
/* Gmail has already undone the transfer encoding; body.data is the part's own bytes in
   base64url, still in the part's own charset. */
function partBytes(p) {
  const data = p && p.body && p.body.data;
  if (!data) return '';
  const m = /charset\s*=\s*"?([^";\s]+)"?/i.exec(headerOf(p, 'content-type'));
  return decodeBytes(Buffer.from(String(data), 'base64url'), m ? m[1] : 'utf-8');
}
/* The readable body: plain text where there is one; in an alternative, the plain branch;
   elsewhere every inline text part in order; never an attachment. */
function partText(p, depth = 0) {
  if (!p || depth > 12) return '';
  const mt = mimeOf(p), kids = Array.isArray(p.parts) ? p.parts : [];
  if (mt.startsWith('multipart/')) {
    if (mt === 'multipart/alternative') {
      const plain = kids.find((k) => mimeOf(k) === 'text/plain' && !isAttachment(k) && k.body && k.body.data);
      if (plain) return partBytes(plain);
      for (const k of [...kids].reverse()) { const t = partText(k, depth + 1); if (t.trim()) return t; }   // the last is the richest
      return '';
    }
    const inline = kids.filter((k) => !isAttachment(k));
    const hasPlain = inline.some((k) => mimeOf(k) === 'text/plain');
    return inline.filter((k) => !(hasPlain && mimeOf(k) === 'text/html'))
      .map((k) => partText(k, depth + 1)).filter((t) => t.trim()).join('\n\n');
  }
  if (isAttachment(p)) return '';
  if (mt === 'text/plain') return partBytes(p);
  if (mt === 'text/html') return htmlToText(partBytes(p));
  return '';
}

/* HTML entities: the Latin-1 names in code-point order from U+00A0, and the handful of
   others mail actually uses. */
const LATIN1 = ('nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute ' +
  'micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil ' +
  'Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute ' +
  'Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute ' +
  'icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml').split(' ');
const ENT = Object.assign(Object.fromEntries(LATIN1.map((n, i) => [n, String.fromCharCode(0xa0 + i)])), {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', sbquo: '‚',
  ldquo: '“', rdquo: '”', bdquo: '„', hellip: '…', bull: '•', euro: '€', trade: '™', dagger: '†', permil: '‰',
  oelig: 'œ', OElig: 'Œ', scaron: 'š', Scaron: 'Š', thinsp: ' ', ensp: ' ', emsp: ' ',
  zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e', rlm: '\u200f' });
const decodeEntities = (s) => String(s == null ? '' : s).replace(/&(#\d{1,7}|#x[0-9a-f]{1,6}|[a-z][a-z0-9]{1,31});?/gi, (m, e) => {
  if (e[0] === '#') {
    const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : m;
  }
  return Object.prototype.hasOwnProperty.call(ENT, e) ? ENT[e] : m;
});
/* Where a mail client marks the quoted history in HTML (Gmail, Apple Mail and Thunderbird,
   Outlook, Yahoo). Cut there when there is something above it. */
const QUOTE_HTML = /<div\b[^>]*\bclass=["']?[^"'>]*\b(?:gmail_quote|yahoo_quoted|moz-cite-prefix)\b|<blockquote\b[^>]*\btype=["']?cite\b|<div\b[^>]*\bid=["']?(?:divRplyFwdMsg|appendonsend)\b/i;
const BLOCK = 'address|article|aside|blockquote|body|center|div|dl|dt|dd|footer|form|h[1-6]|header|hr|html|li|main|nav|ol|p|pre|section|table|tbody|thead|tfoot|tr|ul';
function flat(h) {
  return decodeEntities(h.replace(/\s+/g, ' ')
    .replace(new RegExp(`\\s*(<\\/?(?:${BLOCK}|br)\\b[^>]*>)\\s*`, 'gi'), '$1')     // space beside a block is not text
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\u0001• ')
    .replace(new RegExp(`<\\/?(?:${BLOCK})\\b[^>]*>`, 'gi'), '\u0001')
    .replace(/<\/t[dh]\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ''))
    .replace(/\u0001+/g, '\n')
    .split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function htmlToText(html) {
  const h = String(html || '').replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(head|script|style|title|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  const q = h.search(QUOTE_HTML);
  if (q > 0) { const above = flat(h.slice(0, q)); if (above) return above; }
  return flat(h);
}

/** One message, read: who, to whom, when, and the new words in it. `date` is Gmail's
 *  internalDate (when Google took the message in, which Google calls more reliable than
 *  the sender's own Date header), else that header. */
export async function getMessage(id, o = {}) {
  const mid = String(id == null ? '' : id).trim();
  if (!mid) throw tagged('google', 'Gmail needs a message id', { status: 400 });
  const m = await gapi(`messages/${encodeURIComponent(mid)}`, { fetch: o.fetch, now: o.now, query: { format: 'full' } });
  const p = m.payload || {}, H = (n) => headerOf(p, n);
  const inside = Number(m.internalDate), stamped = Date.parse(H('date'));
  const snippet = decodeEntities(m.snippet || '').replace(/\s+/g, ' ').trim();
  const body = partText(p).replace(/\r\n?/g, '\n');
  return {
    id: String(m.id || mid), threadId: String(m.threadId || ''), labels: Array.isArray(m.labelIds) ? m.labelIds : [],
    from: parseAddress(H('from'))[0] || { name: '', email: '' },
    to: parseAddress(H('to')).map((a) => a.email),
    cc: parseAddress(H('cc')).map((a) => a.email),
    subject: decodeWords(H('subject')).replace(/\s+/g, ' ').trim(),
    date: inside > 0 ? inside : Number.isFinite(stamped) ? stamped : 0,
    msgId: H('message-id').trim(),
    inReplyTo: H('in-reply-to').replace(/\s+/g, ' ').trim(),
    references: H('references').replace(/\s+/g, ' ').trim(),
    text: body.trim() ? cap(stripQuoted(body), TEXT_MAX, '…') : cap(snippet, TEXT_MAX),
    snippet,
  };
}

/* ---------- the new part of a reply ---------- */
/* The attribution line a mail client writes above the quote. Gmail wraps a long one at 78
   characters (German Gmail breaks it inside the address), so each is also tried joined
   with the next line or two. On its own line it needs an address or a number beside it;
   joined, an address: "On Friday I wrote:" is somebody's sentence. */
const ATTRIBUTION = [
  /^On\b.{0,300}\bwrote:$/i,                  // English: Gmail, Apple Mail, Outlook's phone apps, Yahoo
  /^El\b.{0,300}\bescribió:$/i,               // Spanish
  /^Le\b.{0,300}\ba\s+écrit\s*:$/i,           // French, a no-break space before the colon
  /^Am\b.{0,300}\bschrieb\b.{0,300}:$/i,      // German: "Am … schrieb Name <…>:"
  /^Em\b.{0,300}\bescreveu:$/i,               // Portuguese
  /^Il\b.{0,300}\bha scritto:$/i,             // Italian
  /^Op\b.{0,300}\bschreef\b.{0,300}:$/i,      // Dutch
  /เขียน(?:ว่า)?\s*:$/,                         // Thai Gmail: "เมื่อ … <…> เขียนว่า:"
];
const EMAIL_IN = /<[^<>\s@]+@[^<>\s@]+>/;
const ORIGINAL = /^-{2,}\s*(?:original message|mensaje original|message d'origine|ursprüngliche nachricht|mensagem original|messaggio originale|oorspronkelijk bericht|исходное сообщение)\s*-{2,}$/i;
const FROM_L = /^\*?(?:from|de|von|van|da|fra|från|od|от|від)\s*:\*?\s*\S/i;
const DATE_L = /^\*?(?:sent|date|enviado|envoyé|gesendet|verzonden|inviato|data|datum|fecha|enviada|sendt|skickat|отправлено|дата)[^:]{0,20}:/i;
const SUBJ_L = /^\*?(?:subject|asunto|objet|betreff|onderwerp|oggetto|assunto|emne|ämne|temat|тема)\s*:/i;
const MOBILE = /^(?:sent from my .{1,40}|sent from (?:mail|outlook|yahoo mail|gmail|samsung).{0,40}|get outlook for .{1,30}|enviado desde mi .{1,40}|enviado do meu .{1,40}|envoyé de mon .{1,40}|von meinem .{1,40} gesendet|inviato da.{1,40}|verzonden (?:met|vanaf) .{1,40}|ส่งจาก.{1,40})$/i;
const unq = (l) => String(l).replace(/^\s*(?:>\s?)+/, '').trim();
const quoted = (l) => /^\s*>/.test(l);

/** Is line i where the quoted history starts? { attr, span } or null. */
function replyHead(lines, i) {
  const own = unq(lines[i]);
  if (!own) return null;
  const block = [own];
  for (let j = i + 1; j < lines.length && block.length < 3 && unq(lines[j]); j++) block.push(unq(lines[j]));
  for (let n = 1; n <= block.length; n++) {
    const c = block.slice(0, n).join(' ');
    const known = ATTRIBUTION.some((re) => re.test(c)) && (n === 1 ? /@|\d/.test(c) : c.includes('@'));
    /* Any other language: a dated line ending in "Name <address>:" with the quote right
       under it (Russian Gmail writes no word for "wrote" at all). */
    const other = n <= 2 && /\d/.test(own) && /:$/.test(c) && EMAIL_IN.test(c)
      && quoted(lines.slice(i + n).find((l) => l.trim()) || '');
    if (known || other) return { attr: true, span: n };
  }
  if (ORIGINAL.test(own) || /^_{8,}$/.test(own)) return { attr: false, span: 1 };
  if (FROM_L.test(own)) {                      // Outlook: From / Sent / To / Subject
    const next = lines.slice(i + 1, i + 7).map(unq);
    if (next.some((l) => DATE_L.test(l)) && next.some((l) => SUBJ_L.test(l))) return { attr: false, span: 1 };
  }
  return null;
}
/** The new words of a reply, without the quoted history under (or over) them, the quote
 *  markers at the end, or a "Sent from my iPhone". Never empty when there was text: at
 *  worst, the first 400 characters as they came. */
export function stripQuoted(text) {
  const all = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
  if (!all.trim()) return '';
  const lines = all.split('\n');
  let work = lines;
  for (let i = 0; i < lines.length; i++) {
    const head = replyHead(lines, i);
    if (!head) continue;
    const above = lines.slice(0, i);
    if (above.some((l) => l.trim() && !quoted(l))) work = above;     // the usual: new words over the quote
    else if (head.attr) work = lines.slice(i + head.span);            // or written under it
    else work = [];
    break;
  }
  work = work.map((l) => l.replace(/\s+$/, ''));
  const gone = (l) => !l.trim() || quoted(l);
  if (work.some((l) => !gone(l))) while (gone(work[0])) work.shift();   // a quote over the new words
  while (work.length && gone(work[work.length - 1])) work.pop();        // and the one under them
  if (work.length && MOBILE.test(work[work.length - 1].trim())) {
    work.pop();
    while (work.length && !work[work.length - 1].trim()) work.pop();
  }
  const out = work.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return out || cap(all.trim(), 400);
}

/* ---------- addresses ---------- */
/* RFC 2047 encoded-words, `=?charset?B|Q?…?=`. The space between two of them is not text,
   and a run of them in one charset is decoded as one run of bytes, so a character a
   sender split across two words (not allowed, but done) still comes out whole. */
function qBytes(t) {
  const out = [];
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '_') out.push(0x20);
    else if (c === '=' && /^[0-9a-f]{2}$/i.test(t.slice(i + 1, i + 3))) { out.push(parseInt(t.slice(i + 1, i + 3), 16)); i += 2; }
    else out.push(c.charCodeAt(0) & 0xff);
  }
  return Buffer.from(out);
}
const WORD = /=\?([^?\s]+)\?([bq])\?([^?\s]*)\?=/gi;
function decodeWords(s) {
  const str = String(s == null ? '' : s);
  if (!str.includes('=?')) return str;
  return str.replace(/(\?=)\s+(?==\?[^?\s]+\?[bq]\?)/gi, '$1')
    .replace(/(?:=\?[^?\s]+\?[bq]\?[^?\s]*\?=)+/gi, (run) => {
      let out = '', cs = null, bytes = [];
      const flush = () => { if (bytes.length) out += decodeBytes(Buffer.concat(bytes), cs); bytes = []; };
      for (const [, charset, enc, body] of run.matchAll(WORD)) {
        const c = charset.split('*')[0].toLowerCase();      // RFC 2231 allows charset*language
        if (cs !== null && c !== cs) flush();
        cs = c;
        bytes.push(enc.toLowerCase() === 'b' ? Buffer.from(body, 'base64') : qBytes(body));
      }
      flush();
      return out;
    });
}
/* Commas (and semicolons, which people type) separate addresses, except inside a quoted
   name, an <address> or a (comment). */
function splitAddresses(s) {
  const out = [];
  let cur = '', quote = false, angle = 0, paren = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      cur += c;
      if (c === '\\' && i + 1 < s.length) cur += s[++i];
      else if (c === '"') quote = false;
      continue;
    }
    if (c === '"') quote = true;
    else if (c === '<') angle++;
    else if (c === '>') angle = Math.max(0, angle - 1);
    else if (c === '(') paren++;
    else if (c === ')') paren = Math.max(0, paren - 1);
    else if ((c === ',' || c === ';') && !angle && !paren) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
function displayName(raw) {
  let s = String(raw || '').trim();
  const q = /^"((?:[^"\\]|\\.)*)"$/.exec(s);
  if (q) s = q[1].replace(/\\(.)/g, '$1');
  else if (s.length > 1 && s[0] === "'" && s[s.length - 1] === "'") s = s.slice(1, -1);     // Outlook's 'Name'
  return decodeWords(s).replace(/\s+/g, ' ').trim();
}
const ADDR = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+$/;
/** An address header, read: [{ name, email }], the email lower-cased; anything without
 *  an address in it is left out. */
export function parseAddress(header) {
  const out = [];
  for (let item of splitAddresses(String(header == null ? '' : header))) {
    item = item.trim();
    if (!item) continue;
    const group = /^[^"<>@,]*?:\s*(.*)$/.exec(item);        // "Band: a@b.c" — a group's name is not an address
    if (group) item = group[1].trim();
    let name = '', email = '';
    const lt = item.lastIndexOf('<'), gt = lt >= 0 ? item.indexOf('>', lt) : -1;
    if (gt > lt) { email = item.slice(lt + 1, gt); name = item.slice(0, lt); }
    else {
      const bare = /^([^\s<>()",;:]+@[^\s<>()",;:]+)\s*(?:\((.*)\))?$/.exec(item);
      if (bare) { email = bare[1]; name = bare[2] || ''; }
      else email = (/[^\s<>()",;:]+@[^\s<>()",;:]+/.exec(item) || [''])[0];
    }
    email = email.trim().replace(/^mailto:/i, '').toLowerCase();
    if (!ADDR.test(email)) continue;
    out.push({ name: displayName(name), email });
  }
  return out;
}

/* ---------- the sync's own notes ---------- */
/** Records a sync: { lastSync, err, seen }. `seen` ids are added to the ring (the last
 *  500), never replacing it, so a caller may pass only what it just handled. */
export async function markSync(fields = {}) {
  const ids = (Array.isArray(fields.seen) ? fields.seen : []).map(String).filter((x) => /^[\w-]{1,64}$/.test(x));
  const r = await casDoc(GMAIL_DOC, () => ({}), (d) => {
    if (!d.rt) return false;                     // disconnected meanwhile: never bring the document back
    if (Number.isFinite(fields.lastSync)) d.lastSync = fields.lastSync;
    if (typeof fields.err === 'string') d.err = clean(fields.err, 200);
    if (ids.length) d.seen = [...new Set([...(Array.isArray(d.seen) ? d.seen : []), ...ids])].slice(-SEEN_MAX);
    return true;
  });
  return { ok: !!r.ok };
}

/** Tells Google to cancel the grant (best effort: a token that is already dead is fine),
 *  then forgets the connection whatever Google said. */
export async function disconnect(o = {}) {
  const { data: d } = await readDoc(GMAIL_DOC, null);
  const rt = d && d.rt ? await decrypt(d.rt) : null;
  let revoked = false;
  if (rt) {
    try { revoked = (await call(o, `${REVOKE_URL}?token=${encodeURIComponent(rt)}`, { method: 'POST', headers: FORM }, 'Google revoke')).ok; }
    catch {}
  }
  await store().delete(GMAIL_DOC).catch(() => {});
  return { ok: true, revoked };
}
