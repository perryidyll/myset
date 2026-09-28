/* HQ'S GMAIL — the founder's own mailbox, through Google's OAuth (_gmail.mjs), run end to
   end with NO network. `google()` below plays the token endpoint, the revoke endpoint and
   the Gmail API; the real fetch is swapped for one that counts, and the last check is
   that it was never called.

   Pins, in order: the switch and the return address; the state that rides through the
   consent screen (signed here, ten minutes, tamper-proof); the sealed tokens; the consent
   link; connect (a forged state, no code, no refresh token, half a grant, then the
   document, with no raw token in it); the access token (cached, refreshed, revoked); the
   one door to Gmail (a 401 refreshes once and retries once); the letter (CRLF, encoded
   words, base64, no header injection); sending and the Message-ID read back; reading
   real MIME trees (UTF-8, ISO-8859-1, HTML only, a nested mixed with attachments); the
   new words of a reply in each mail client's style; addresses; the sync's notes; and
   disconnecting.

   Run: node --import ./test/register.mjs test/gmail.mjs */
import { createHmac } from 'node:crypto';

process.env.GMAIL_CLIENT_ID = 'test-client.apps.googleusercontent.com';   // test values: every call is answered in this process
process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
process.env.URL = 'https://hq.test';
/* This file holds the `v1.` box — how a token is sealed with no MYSET_SECRET. With one
   set, tokens go onto the keyring (`v2.`), and test/seal.mjs holds that. */
delete process.env.MYSET_SECRET;
delete process.env.MYSET_SECRET_PREVIOUS;

const G = await import('../netlify/functions/_gmail.mjs');
const { readDoc } = await import('../netlify/functions/_lib.mjs');
const { authSecret } = await import('../netlify/functions/_auth.mjs');
const { __reset } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const errOf = async (p) => { try { await p; return null; } catch (e) { return e; } };
const codeOf = async (p) => { const e = await errOf(p); return e ? (e.code || `untagged: ${e.message}`) : 'resolved'; };
const docOf = async () => (await readDoc('crmgmail', null)).data;

let realNet = 0;
globalThis.fetch = async (u) => { realNet++; throw new Error(`the real network was asked for ${u}`); };

/* ---------- Google, canned ---------- */
const NOW = Date.parse('2026-09-28T12:00:00Z');
let clock = NOW;
const now = () => clock;
const CLIENT_ID = 'test-client.apps.googleusercontent.com', CLIENT_SECRET = 'test-client-secret';
const RT = '1//0gTEST-refresh-token-RAW-value', AT1 = 'ya29.TEST-access-token-FIRST';
const FULL_SCOPE = 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly openid https://www.googleapis.com/auth/userinfo.email';
const gg = { calls: [], grants: { code: 0, refresh: 0 }, valid: new Set(), noRefresh: false, scope: FULL_SCOPE, revoked: false,
  always401: false, failMeta: false, down: false, email: 'Founder@Gmail.com', sent: [], revokes: [], n: 0 };
const FIX = {};
const res = (body, status = 200, headers = {}) => new Response(body, { status, headers });
const json = (o, status = 200) => res(JSON.stringify(o), status, { 'content-type': 'application/json; charset=UTF-8' });
const gErr = (code, message, status) => json({ error: { code, message, errors: [{ message, domain: 'global', reason: 'x' }], status } }, code);
async function google(url, init = {}) {
  if (gg.down) throw new TypeError('fetch failed');
  const u = new URL(String(url)), method = init.method || 'GET';
  const h = Object.fromEntries(Object.entries(init.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  gg.calls.push({ url: u.href, method, auth: h.authorization || '', body: init.body });
  if (u.origin + u.pathname === 'https://oauth2.googleapis.com/token') {
    if (method !== 'POST' || !/x-www-form-urlencoded/.test(h['content-type'] || '')) return json({ error: 'invalid_request' }, 400);
    const f = new URLSearchParams(init.body);
    if (f.get('client_id') !== CLIENT_ID || f.get('client_secret') !== CLIENT_SECRET) return json({ error: 'invalid_client', error_description: 'Unauthorized' }, 401);
    if (f.get('grant_type') === 'authorization_code') {
      gg.grants.code++;
      if (f.get('code') !== 'good-code') return json({ error: 'invalid_grant', error_description: 'Malformed auth code.' }, 400);
      if (f.get('redirect_uri') !== 'https://hq.test/api/hq/gmail') return json({ error: 'redirect_uri_mismatch', error_description: 'Bad Request' }, 400);
      gg.valid.add(AT1);
      return json({ access_token: AT1, expires_in: 3599, ...(gg.noRefresh ? {} : { refresh_token: RT }), scope: gg.scope, token_type: 'Bearer', id_token: 'eyJ.test.jwt' });
    }
    if (f.get('grant_type') === 'refresh_token') {
      gg.grants.refresh++;
      if (gg.revoked || f.get('refresh_token') !== RT) return json({ error: 'invalid_grant', error_description: 'Token has been expired or revoked.' }, 400);
      const t = `ya29.TEST-refreshed-${gg.grants.refresh}`;
      gg.valid.add(t);
      return json({ access_token: t, expires_in: 3599, scope: gg.scope, token_type: 'Bearer' });
    }
    return json({ error: 'unsupported_grant_type' }, 400);
  }
  if (u.origin + u.pathname === 'https://oauth2.googleapis.com/revoke') {
    gg.revokes.push(u.searchParams.get('token')); gg.revoked = true;
    return res('{}', 200, { 'content-type': 'application/json' });
  }
  const base = '/gmail/v1/users/me/';
  if (u.origin === 'https://gmail.googleapis.com' && u.pathname.startsWith(base)) {
    const tok = String(h.authorization || '').replace(/^Bearer /, '');
    if (gg.always401 || !gg.valid.has(tok)) return gErr(401, 'Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential.', 'UNAUTHENTICATED');
    const path = u.pathname.slice(base.length), q = u.searchParams;
    if (path === 'profile') return json({ emailAddress: gg.email, messagesTotal: 1200, threadsTotal: 800, historyId: '98765' });
    if (path === 'messages/send' && method === 'POST') {
      const b = JSON.parse(init.body);
      const mime = Buffer.from(b.raw, 'base64url').toString('utf8');
      if (!/^To: .*@/m.test(mime)) return gErr(400, 'Invalid To header', 'INVALID_ARGUMENT');
      if (b.threadId === 'thr-gone') return gErr(404, 'Requested entity was not found.', 'NOT_FOUND');
      gg.n++; gg.sent.push(b);
      return json({ id: `sent-${gg.n}`, threadId: b.threadId || `thr-new-${gg.n}`, labelIds: ['SENT'] });
    }
    if (path === 'messages' && method === 'GET') {
      const all = (q.get('q') || '').includes('from:') ? Object.keys(FIX).map((id) => ({ id, threadId: FIX[id].threadId })) : [];
      return json(all.length ? { messages: all.slice(0, Number(q.get('maxResults'))), resultSizeEstimate: all.length } : { resultSizeEstimate: 0 });
    }
    if (path.startsWith('messages/') && method === 'GET') {
      const id = decodeURIComponent(path.slice('messages/'.length));
      if (q.get('format') === 'metadata') {
        if (gg.failMeta) return gErr(500, 'Backend Error', 'INTERNAL');
        return json({ id, threadId: 'x', payload: { headers: q.getAll('metadataHeaders').includes('Message-ID') ? [{ name: 'Message-Id', value: `<CA${id}@mail.gmail.com>` }] : [] } });
      }
      if (FIX[id] && q.get('format') === 'full') return json(FIX[id]);
      return gErr(404, 'Requested entity was not found.', 'NOT_FOUND');
    }
    if (path === 'labels/forbidden') return gErr(403, 'Request had insufficient authentication scopes.', 'PERMISSION_DENIED');
  }
  return res('not here', 404);
}
const net = { fetch: google, now };
const profileCalls = () => gg.calls.filter((c) => c.url.endsWith('/users/me/profile')).length;

/* ---------- messages the way Gmail's format=full hands them over ---------- */
const b64u = (s, enc = 'utf8') => Buffer.from(s, enc).toString('base64url');
const leaf = (mimeType, text, { charset = 'UTF-8', enc = 'utf8', filename = '', disposition = '' } = {}) => ({
  partId: '', mimeType, filename,
  headers: [{ name: 'Content-Type', value: `${mimeType}; charset="${charset}"` }, ...(disposition ? [{ name: 'Content-Disposition', value: disposition }] : [])],
  body: { size: Buffer.byteLength(text, enc), data: b64u(text, enc) } });
const multi = (mimeType, parts) => ({ partId: '', mimeType, filename: '', headers: [{ name: 'Content-Type', value: `${mimeType}; boundary="000000000000b"` }], body: { size: 0 }, parts });
const message = (id, payload, headers, extra = {}) => ({ id, threadId: `thr-${id}`, labelIds: ['INBOX', 'UNREAD'], historyId: '4242', sizeEstimate: 4096,
  ...extra, payload: { ...payload, headers: [...headers.map(([name, value]) => ({ name, value })), ...payload.headers] } });

const ALT_TEXT = 'Sí, me encanta 🎸 — ขอบคุณครับ! Café night at 8?\r\n\r\nOn Mon, Sep 28, 2026 at 12:00 PM Perry Idyll <founder@gmail.com>\r\nwrote:\r\n\r\n'
  + '> Hi Mia! I made The Tide Lines a page on MySet:\r\n> https://myset.vip/thetidelines#sample-profile\r\n>\r\n';
const ALT_HTML = '<div dir="ltr">Sí, me encanta 🎸 — ขอบคุณครับ! Café night at 8?</div><br><div class="gmail_quote"><div dir="ltr" class="gmail_attr">On Mon, Sep 28, 2026 at 12:00 PM Perry Idyll &lt;<a href="mailto:founder@gmail.com">founder@gmail.com</a>&gt; wrote:<br></div>'
  + '<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex">Hi Mia! I made The Tide Lines a page on MySet</blockquote></div>\r\n';
FIX.alt1 = message('alt1', multi('multipart/alternative', [leaf('text/plain', ALT_TEXT), leaf('text/html', ALT_HTML)]), [
  ['Delivered-To', 'founder@gmail.com'],
  ['From', '=?UTF-8?B?TcOtYSBIYXJ0?= <Booking@TheTideLines.com>'],
  ['To', 'Perry Idyll <founder@gmail.com>'],
  ['Cc', '"Hart, Mia" <mia@thetidelines.com>, joe@thetidelines.com'],
  ['Subject', '=?UTF-8?Q?Re:_Your_MySet_page_=E2=80=94_caf=C3=A9_night?='],
  ['Date', 'Mon, 28 Sep 2026 19:04:05 +0700'],
  ['Message-ID', '<CAreply0001@mail.gmail.com>'],
  ['In-Reply-To', '<CAorig0001@mail.gmail.com>'],
  ['References', '<CAorig0001@mail.gmail.com>'],
], { internalDate: String(Date.parse('2026-09-28T12:04:07Z')),
     snippet: 'Sí, me encanta 🎸 — ขอบคุณครับ! Café night at 8? On Mon, Sep 28, 2026 at 12:00 PM Perry Idyll &lt;founder@gmail.com&gt; wrote: &gt; Hi Mia! I&#39;m' });

const PT = 'Olá Perry! Já vi a página, está ótima. Até sexta?\r\n\r\nEm seg., 28 de set. de 2026 às 12:00, Perry Idyll <founder@gmail.com> escreveu:\r\n\r\n> Oi! Fiz uma página para vocês.\r\n';
FIX.latin1 = message('latin1', leaf('text/plain', PT, { charset: 'ISO-8859-1', enc: 'latin1' }), [
  ['From', '=?ISO-8859-1?Q?Jo=E3o_Silva?= <joao@banda.com.br>'], ['To', 'founder@gmail.com'], ['Subject', 'Re: MySet'],
  ['Date', 'Mon, 28 Sep 2026 14:30:00 -0300'], ['Message-ID', '<abc123@banda.com.br>'],
], { snippet: 'Olá Perry! Já vi a página, está ótima.' });                  // no internalDate: the Date header has to do

const HTML_ONLY = `<html><head><meta charset="utf-8"><title>Re: MySet</title><style>p { color: red }</style><script>alert("never text")</script></head>
<body><div>Hey Perry,</div><div>Loved it &amp; we&#39;re in &mdash; see you Friday! &eacute;l&egrave;ve &#x1F3B8;</div>
<div><br></div><div>Mia<br>The Tide Lines</div>
<div class="gmail_quote"><div class="gmail_attr">On Mon, Sep 28, 2026 at 12:00 PM Perry Idyll &lt;founder@gmail.com&gt; wrote:<br></div>
<blockquote class="gmail_quote">Hi Mia! I made you a page.</blockquote></div></body></html>`;
FIX.htmlonly = message('htmlonly', leaf('text/html', HTML_ONLY), [['From', 'Mia Hart <mia@thetidelines.com>'], ['To', 'founder@gmail.com'],
  ['Subject', 'Re: MySet'], ['Date', 'Mon, 28 Sep 2026 13:00:00 +0000']], { internalDate: String(Date.parse('2026-09-28T13:00:02Z')), snippet: 'Hey Perry, Loved it &amp; we&#39;re in' });

FIX.mixed = message('mixed', multi('multipart/mixed', [
  multi('multipart/alternative', [leaf('text/plain', 'Here is our rider.\r\n\r\nSent from my iPhone\r\n'),
    leaf('text/html', '<div>Here is our rider.</div><div><br></div><div>Sent from my iPhone</div>')]),
  { partId: '1', mimeType: 'application/pdf', filename: 'rider.pdf', headers: [{ name: 'Content-Type', value: 'application/pdf; name="rider.pdf"' },
    { name: 'Content-Disposition', value: 'attachment; filename="rider.pdf"' }], body: { attachmentId: 'ANGjdJ8-test', size: 48213 } },
  leaf('text/plain', '1. Wonderwall\r\n2. Riptide\r\n', { disposition: 'attachment; filename="setlist.txt"' }),
]), [['From', 'joe@thetidelines.com'], ['To', 'Perry Idyll <founder@gmail.com>'], ['Subject', 'Rider'], ['Date', 'Mon, 28 Sep 2026 15:00:00 +0700']],
{ internalDate: String(Date.parse('2026-09-28T08:00:01Z')), snippet: 'Here is our rider.' });

FIX.calonly = message('calonly', leaf('text/calendar', 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'), [['From', 'mia@thetidelines.com'], ['Subject', 'Invitation']],
  { internalDate: String(NOW), snippet: 'Invitation: Friday gig @ Fri Oct 2, 2026 8pm' });
FIX.long = message('long', leaf('text/plain', '🎸'.repeat(2500)), [['From', 'mia@thetidelines.com'], ['Subject', 'Long']], { internalDate: String(NOW), snippet: '🎸🎸' });

/* ================================================================== */
console.log('\nTHE SWITCH  both client variables, or Gmail is simply off');
eq('one document', G.GMAIL_DOC, 'crmgmail');
eq('configured: both variables, non-empty', [G.configured(), G.configured({}), G.configured({ GMAIL_CLIENT_ID: 'x', GMAIL_CLIENT_SECRET: '  ' }),
  G.configured({ GMAIL_CLIENT_ID: 'x', GMAIL_CLIENT_SECRET: 'y' })], [true, false, false, true]);
eq('the return address, from URL or the site given', [G.redirectUri(), G.redirectUri('https://myset.vip/'), G.redirectUri('')],
   ['https://hq.test/api/hq/gmail', 'https://myset.vip/api/hq/gmail', 'https://hq.test/api/hq/gmail']);
eq('status before anything', await G.status(), { ready: true, connected: false, email: '', lastSync: 0, err: '' });
eq('nothing connected: every door says so', [await codeOf(G.accessToken(net)), await codeOf(G.gapi('profile', net)),
  await codeOf(G.sendMail({ ...net, to: 'a@b.com', subject: 's', text: 't' })), await codeOf(G.listIds('x', net)), await codeOf(G.getMessage('alt1', net))],
   Array(5).fill('not-connected'));
{
  const saved = process.env.GMAIL_CLIENT_SECRET;
  process.env.GMAIL_CLIENT_SECRET = '';
  eq('without the client secret: not-configured everywhere, and status says not ready',
     [await codeOf(G.authUrl({ now })), await codeOf(G.connect({ ...net, code: 'good-code', state: 'x.y' })), await codeOf(G.accessToken(net)),
      await codeOf(G.sendMail({ ...net, to: 'a@b.com' })), (await G.status()).ready],
     ['not-configured', 'not-configured', 'not-configured', 'not-configured', false]);
  const e = await errOf(G.authUrl({ now }));
  ok('an error is an Error with a code and a sentence, never a bare string', e instanceof Error && e.code === 'not-configured' && /GMAIL_CLIENT_ID/.test(e.message), e && e.message);
  process.env.GMAIL_CLIENT_SECRET = saved;
}

/* ================================================================== */
console.log('\nTHE STATE  signed here, good for ten minutes');
const S1 = await G.signState({ now });
const [PL, SIG] = S1.split('.');
const flip = (x) => (x[0] === 'A' ? 'B' : 'A') + x.slice(1);
eq('a fresh state checks out', await G.checkState(S1, { now }), true);
eq('a changed payload is refused', await G.checkState(`${flip(PL)}.${SIG}`, { now }), false);
eq('a changed signature is refused', await G.checkState(`${PL}.${flip(SIG)}`, { now }), false);
eq('a payload of somebody else\'s making, with a real signature beside it, is refused',
   await G.checkState(`${b64u(JSON.stringify({ n: 'x', exp: NOW + 9e9 }))}.${SIG}`, { now }), false);
{
  const secret = await authSecret();
  const bare = createHmac('sha256', secret).update(PL).digest('base64url');
  eq('the same secret signing the same payload, but not as a Gmail state: refused', await G.checkState(`${PL}.${bare}`, { now }), false);
  const junk = b64u('not json');
  eq('a signed payload that is not JSON: refused, no throw', await G.checkState(`${junk}.${createHmac('sha256', secret).update(`gmail-state|${junk}`).digest('base64url')}`, { now }), false);
}
eq('nine minutes on: still good', await G.checkState(S1, { now: () => NOW + 9 * 60e3 }), true);
eq('eleven minutes on: expired', await G.checkState(S1, { now: () => NOW + 11 * 60e3 }), false);
eq('`now` as a plain number is read the same way', [await G.checkState(S1, { now: NOW + 9 * 60e3 }), await G.checkState(S1, { now: NOW + 11 * 60e3 })], [true, false]);
eq('junk is refused without a throw', await Promise.all(['', 'a.b', `${PL}.${SIG}.x`, null, 42, {}, `${'x'.repeat(400)}.${SIG}`].map((v) => G.checkState(v, { now }))),
   Array(7).fill(false));
ok('two states are never the same', (await G.signState({ now })) !== S1);

/* ================================================================== */
console.log('\nTHE SEAL  AES-256-GCM, a fresh IV every time');
const SECRET_TEXT = '1//0g-secret-ขอบคุณ-🎸';
const BOX = await G.encrypt(SECRET_TEXT);
ok('v1.<iv>.<tag>.<ciphertext>, all base64url', /^v1\.[\w-]{16}\.[\w-]{22}\.[\w-]+$/.test(BOX), BOX);
eq('it opens back to the text', await G.decrypt(BOX), SECRET_TEXT);
ok('the text is nowhere in the box', !BOX.includes('secret') && !BOX.includes(Buffer.from(SECRET_TEXT).toString('base64url').slice(0, 8)));
ok('the same text seals differently every time', (await G.encrypt('same')) !== (await G.encrypt('same')));
{
  const p = BOX.split('.');
  const tweak = (i) => p.map((x, j) => (j === i ? flip(x) : x)).join('.');
  eq('a changed IV, tag or ciphertext opens to nothing', [await G.decrypt(tweak(1)), await G.decrypt(tweak(2)), await G.decrypt(tweak(3))], [null, null, null]);
  eq('nor does a short tag, another version, or junk', [await G.decrypt(`v1.${p[1]}.${p[2].slice(0, 6)}.${p[3]}`), await G.decrypt(`v2.${p[1]}.${p[2]}.${p[3]}`),
    await G.decrypt(''), await G.decrypt(null), await G.decrypt('v1.x.y')], [null, null, null, null, null]);
}

/* ================================================================== */
console.log('\nTHE CONSENT LINK');
{
  const a = await G.authUrl({ now });
  const u = new URL(a.url);
  eq('Google\'s consent screen', u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  eq('every parameter, and nothing else', Object.fromEntries(u.searchParams), { client_id: CLIENT_ID, redirect_uri: 'https://hq.test/api/hq/gmail', response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly', access_type: 'offline', prompt: 'consent',
    include_granted_scopes: 'true', state: a.state });
  eq('the state it carries is a good one', await G.checkState(a.state, { now }), true);
  eq('SCOPES: sign-in, the address, send, read — nothing wider', [...G.SCOPES], ['openid', 'email', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly']);
  eq('another site: its own return address', new URL((await G.authUrl({ now, site: 'https://deploy-preview-9--myset.netlify.app/' })).url).searchParams.get('redirect_uri'),
     'https://deploy-preview-9--myset.netlify.app/api/hq/gmail');
}

/* ================================================================== */
console.log('\nCONNECTING  the code for tokens, the tokens sealed, the mailbox named by Gmail');
__reset();
{
  let e = await errOf(G.connect({ ...net, code: 'good-code', state: `${b64u(JSON.stringify({ n: 'x', exp: NOW + 60e3 }))}.${SIG}` }));
  eq('a forged state: refused before Google is asked anything', [e && e.code, gg.grants.code], ['bad-state', 0]);
  e = await errOf(G.connect({ ...net, code: 'good-code', state: await G.signState({ now: () => NOW - 11 * 60e3 }) }));
  eq('a state from eleven minutes ago: refused the same way', [e && e.code, gg.grants.code], ['bad-state', 0]);
  const st = (await G.authUrl({ now })).state;
  e = await errOf(G.connect({ ...net, code: '', state: st }));
  ok('no code (the consent screen was closed): refused in a sentence, Google not asked', e && e.code === 'google' && /Connect again/.test(e.message) && gg.grants.code === 0, e && e.message);
  e = await errOf(G.connect({ ...net, code: 'bad-code', state: st }));
  ok('a code Google does not accept: code google, Google\'s words, status 400', e && e.code === 'google' && e.status === 400 && /Malformed auth code/.test(e.message), e && e.message);
  e = await errOf(G.connect({ ...net, code: 'good-code', state: st, site: 'https://elsewhere.test' }));
  ok('a return address Google was not told about: refused, status 400', e && e.code === 'google' && e.status === 400, e && e.message);
  gg.noRefresh = true;
  e = await errOf(G.connect({ ...net, code: 'good-code', state: st }));
  ok('no refresh token: refused with a plain message, and nothing stored', e && e.code === 'google' && /refresh token/.test(e.message) && !(await docOf()), e && e.message);
  gg.noRefresh = false;
  gg.scope = 'https://www.googleapis.com/auth/gmail.readonly openid https://www.googleapis.com/auth/userinfo.email';
  e = await errOf(G.connect({ ...net, code: 'good-code', state: st }));
  ok('half a grant (send unticked): refused, nothing stored', e && e.code === 'google' && /both Gmail boxes/.test(e.message) && !(await docOf()), e && e.message);
  gg.scope = FULL_SCOPE;
  const from = gg.calls.length;
  eq('connected, the mailbox as Gmail names it, lower-cased', await G.connect({ ...net, code: 'good-code', state: st }), { ok: true, email: 'founder@gmail.com' });
  const mine = gg.calls.slice(from);
  const ex = new URLSearchParams(mine.find((c) => c.url === 'https://oauth2.googleapis.com/token').body);
  eq('the code exchange carried every field', Object.fromEntries(ex), { code: 'good-code', client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
    redirect_uri: 'https://hq.test/api/hq/gmail', grant_type: 'authorization_code' });
  eq('the profile was read with the new access token', mine.filter((c) => c.url.endsWith('/users/me/profile')).map((c) => c.auth), [`Bearer ${AT1}`]);
  const d = await docOf();
  eq('the document', { v: d.v, email: d.email, exp: d.exp, scope: d.scope, connectedAt: d.connectedAt, lastSync: d.lastSync, err: d.err, seen: d.seen },
     { v: 1, email: 'founder@gmail.com', exp: NOW + 3539e3, scope: FULL_SCOPE, connectedAt: NOW, lastSync: 0, err: '', seen: [] });
  const raw = JSON.stringify(d);
  ok('no raw token anywhere in it', !raw.includes(RT) && !raw.includes(AT1) && !raw.includes('1//0g') && !raw.includes('ya29.'), raw);
  ok('both tokens are sealed boxes', /^v1\.[\w-]{16}\.[\w-]{22}\.[\w-]+$/.test(d.rt) && /^v1\.[\w-]{16}\.[\w-]{22}\.[\w-]+$/.test(d.at), [d.rt, d.at]);
  eq('and they open back to the tokens', [await G.decrypt(d.rt), await G.decrypt(d.at)], [RT, AT1]);
  const s = await G.status();
  eq('status: connected, as whom', s, { ready: true, connected: true, email: 'founder@gmail.com', lastSync: 0, err: '' });
  ok('status carries no secret', !JSON.stringify(s).includes('v1.') && !JSON.stringify(s).includes('ya29'));
}

/* ================================================================== */
console.log('\nTHE ACCESS TOKEN  the saved one for its hour, then a fresh one; a dead grant is "revoked"');
{
  let g0 = gg.grants.refresh;
  eq('inside its hour: the saved token, Google not asked', [await G.accessToken(net), gg.grants.refresh - g0], [AT1, 0]);
  clock = NOW + 3600e3;
  eq('past it: a fresh one, asked for once', [await G.accessToken(net), gg.grants.refresh - g0], ['ya29.TEST-refreshed-1', 1]);
  const d = await docOf();
  eq('the fresh token is saved sealed, good for its hour less a minute', [await G.decrypt(d.at), d.exp, JSON.stringify(d).includes('ya29.')],
     ['ya29.TEST-refreshed-1', clock + 3539e3, false]);
  const refresh = new URLSearchParams(gg.calls.filter((c) => c.url === 'https://oauth2.googleapis.com/token').pop().body);
  eq('the refresh carried the client and the refresh token', Object.fromEntries(refresh), { client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: RT, grant_type: 'refresh_token' });
  eq('and it is used until then', [await G.accessToken(net), gg.grants.refresh - g0], ['ya29.TEST-refreshed-1', 1]);
  eq('force: a fresh one whatever the clock says', [await G.accessToken({ ...net, force: true }), gg.grants.refresh - g0], ['ya29.TEST-refreshed-2', 2]);
  gg.revoked = true;
  clock += 3600e3;
  const e = await errOf(G.accessToken(net));
  eq('invalid_grant: code revoked, noted on the document and in status', [e && e.code, (await docOf()).err, (await G.status()).err], ['revoked', 'revoked', 'revoked']);
  ok('... in a sentence that says to connect again', e && /Connect Gmail again/.test(e.message), e && e.message);
  ok('... and the dead access token is dropped', !(await docOf()).at && (await docOf()).exp === 0, await docOf());
  g0 = gg.grants.refresh;
  eq('the next ring does not ask Google again', [await codeOf(G.accessToken(net)), await codeOf(G.gapi('profile', net)), gg.grants.refresh - g0], ['revoked', 'revoked', 0]);
  gg.revoked = false;
  eq('connecting again clears it', [(await G.connect({ ...net, code: 'good-code', state: await G.signState({ now }) })).ok, (await G.status()).err], [true, '']);
}

/* ================================================================== */
console.log('\nTHE ONE DOOR  a 401 refreshes once and retries once');
{
  const live = await G.accessToken(net);
  gg.valid.delete(live);                                  // Google ended it before its hour
  let g0 = gg.grants.refresh, p0 = profileCalls();
  const pr = await G.gapi('profile', net);
  eq('a 401: one refresh, the same call again, and the answer', [pr.emailAddress, gg.grants.refresh - g0, profileCalls() - p0], ['Founder@Gmail.com', 1, 2]);
  ok('the retry used the fresh token', gg.calls.filter((c) => c.url.endsWith('/users/me/profile')).pop().auth === `Bearer ya29.TEST-refreshed-${gg.grants.refresh}`);
  gg.always401 = true; g0 = gg.grants.refresh; p0 = profileCalls();
  let e = await errOf(G.gapi('profile', net));
  eq('401 twice: one refresh only, then the refusal as it came', [e && e.code, e && e.status, gg.grants.refresh - g0, profileCalls() - p0], ['google', 401, 1, 2]);
  gg.always401 = false;
  e = await errOf(G.gapi('labels/forbidden', net));
  ok('any other refusal: code google, its status, Google\'s own words', e && e.code === 'google' && e.status === 403 && /insufficient authentication scopes/.test(e.message), e && e.message);
  gg.down = true;
  e = await errOf(G.gapi('profile', net));
  ok('Google unreachable: code google, status 0', e && e.code === 'google' && e.status === 0 && /could not be reached/.test(e.message), e && e.message);
  gg.down = false;
  await G.gapi('messages', { ...net, query: { q: 'from:a b', maxResults: 3, labelIds: ['INBOX', 'UNREAD'], skip: '' } });
  const u = new URL(gg.calls.pop().url);
  eq('query: encoded, lists repeated, blanks left out', [u.searchParams.get('q'), u.searchParams.get('maxResults'), u.searchParams.getAll('labelIds'), u.searchParams.has('skip')],
     ['from:a b', '3', ['INBOX', 'UNREAD'], false]);
}

/* ================================================================== */
console.log('\nTHE LETTER  RFC 5322, CRLF, UTF-8 headers as encoded words, the body in base64');
const unfold = (h) => h.replace(/\r\n[ \t]/g, ' ');
const headOf = (m) => m.slice(0, m.indexOf('\r\n\r\n'));
const fieldsOf = (m) => Object.fromEntries(unfold(headOf(m)).split('\r\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 2)]));
const namesOf = (m) => headOf(m).split('\r\n').filter((l) => !/^[ \t]/.test(l)).map((l) => l.slice(0, l.indexOf(':')));
const decodeWords = (v) => Buffer.concat(v.trim().split(/\s+/).map((w) => Buffer.from(/^=\?UTF-8\?B\?([A-Za-z0-9+/=]*)\?=$/.exec(w)[1], 'base64'))).toString('utf8');
{
  const L = { fromName: 'Pérry Idyll', from: 'founder@gmail.com', to: 'booking@thetidelines.com', subject: 'Your page on MySet — ขอบคุณครับ 🎸 café night, señor',
    text: 'Hi Mia! 🎸 ขอบคุณครับ — café at 8, señor. Ça va? Grüße aus Koh Phangan. '.repeat(3).trim(), date: Date.parse('2026-09-07T01:02:03Z') };
  const m = G.buildMime(L);
  ok('CRLF everywhere: no bare LF, no bare CR, ends with one', !/[^\r]\n/.test(m) && !/\r(?!\n)/.test(m) && m.endsWith('\r\n'), JSON.stringify(m.slice(0, 200)));
  eq('the headers, in order', namesOf(m), ['From', 'To', 'Subject', 'Date', 'MIME-Version', 'Content-Type', 'Content-Transfer-Encoding']);
  const f = fieldsOf(m);
  eq('the fixed ones', [f['MIME-Version'], f['Content-Type'], f['Content-Transfer-Encoding'], f.Date, f.To],
     ['1.0', 'text/plain; charset=UTF-8', 'base64', 'Mon, 07 Sep 2026 01:02:03 +0000', 'booking@thetidelines.com']);
  ok('a non-ASCII name is an encoded word, and reads back through parseAddress', /^=\?UTF-8\?B\?/.test(f.From)
     && JSON.stringify(G.parseAddress(f.From)) === JSON.stringify([{ name: 'Pérry Idyll', email: 'founder@gmail.com' }]), f.From);
  eq('the subject decodes to exactly what was typed', decodeWords(f.Subject), L.subject);
  const words = headOf(m).match(/=\?[^?]+\?B\?[^?]*\?=/g);
  ok('several words, each at most 75 characters, whole characters in each', words.length >= 2 && words.every((w) => w.length <= 75)
     && words.every((w) => !Buffer.from(w.slice(10, -2), 'base64').toString('utf8').includes('\ufffd')), words);
  const long = G.buildMime({ ...L, fromName: '\u0e1b\u0e23\u0e30\u0e40\u0e2a\u0e23\u0e34\u0e10 \u0e27\u0e07\u0e28\u0e4c\u0e14\u0e19\u0e15\u0e23\u0e35 and The Tide Lines Band', to: ['"Hart, Mia" <mia@thetidelines.com>', '\u0e1b\u0e23\u0e30\u0e40\u0e2a\u0e23\u0e34\u0e10 <thai.booking.agent@thetidelines.com>'] });
  const wordLines = [m, long].flatMap((x) => headOf(x).split('\r\n')).filter((l) => l.includes('=?'));
  ok('every header line holding an encoded word is 76 characters at most (RFC 2047)', wordLines.length > 4 && wordLines.every((l) => l.length <= 76), wordLines.map((l) => l.length));
  eq('... a long encoded name puts its address on a line of its own, and still reads back', [G.parseAddress(fieldsOf(long).From), G.parseAddress(fieldsOf(long).To)],
     [[{ name: '\u0e1b\u0e23\u0e30\u0e40\u0e2a\u0e23\u0e34\u0e10 \u0e27\u0e07\u0e28\u0e4c\u0e14\u0e19\u0e15\u0e23\u0e35 and The Tide Lines Band', email: 'founder@gmail.com' }],
      [{ name: 'Hart, Mia', email: 'mia@thetidelines.com' }, { name: '\u0e1b\u0e23\u0e30\u0e40\u0e2a\u0e23\u0e34\u0e10', email: 'thai.booking.agent@thetidelines.com' }]]);
  const body = m.slice(m.indexOf('\r\n\r\n') + 4);
  eq('the body decodes to the exact text: emoji, Thai, accents', Buffer.from(body.replace(/\r\n/g, ''), 'base64').toString('utf8'), L.text);
  ok('... in lines of 76 characters at most', body.trim().split('\r\n').every((l) => l.length <= 76) && body.trim().split('\r\n').length > 1, body.split('\r\n').map((l) => l.length));
  const multiLine = G.buildMime({ ...L, text: 'one\ntwo\r\nthree\rfour' });
  eq('line breaks in the text are sent as CRLF (text/plain\'s canonical form)',
     Buffer.from(multiLine.slice(multiLine.indexOf('\r\n\r\n') + 4).replace(/\r\n/g, ''), 'base64').toString('utf8'), 'one\r\ntwo\r\nthree\r\nfour');
  eq('a plain name stays plain; one with a comma or a quote is quoted, and reads back', [
    fieldsOf(G.buildMime({ ...L, fromName: 'Perry Idyll' })).From, fieldsOf(G.buildMime({ ...L, fromName: 'Idyll, Perry "PJ"' })).From,
    G.parseAddress(fieldsOf(G.buildMime({ ...L, fromName: 'Idyll, Perry "PJ"' })).From)[0].name, fieldsOf(G.buildMime({ ...L, fromName: '' })).From],
     ['Perry Idyll <founder@gmail.com>', '"Idyll, Perry \\"PJ\\"" <founder@gmail.com>', 'Idyll, Perry "PJ"', 'founder@gmail.com']);
  eq('an ASCII subject is left as typed', fieldsOf(G.buildMime({ ...L, subject: 'Your page on MySet' })).Subject, 'Your page on MySet');
  const r = G.buildMime({ ...L, messageId: 'abc@myset.vip', inReplyTo: '<CAreply@mail.gmail.com>', references: ['<CAorig@mail.gmail.com>', 'CAreply@mail.gmail.com'] });
  eq('Message-ID, In-Reply-To and References when given, each as <…>', [fieldsOf(r)['Message-ID'], fieldsOf(r)['In-Reply-To'], fieldsOf(r).References],
     ['<abc@myset.vip>', '<CAreply@mail.gmail.com>', '<CAorig@mail.gmail.com> <CAreply@mail.gmail.com>']);
  const chain = Array.from({ length: 30 }, (_, i) => `<m${i}@x>`);
  eq('a long References chain keeps its root and its last nineteen', fieldsOf(G.buildMime({ ...L, references: chain.join(' ') })).References.split(' '), [chain[0], ...chain.slice(-19)]);
  const evil = G.buildMime({ fromName: 'Perry\r\nBcc: evil1@x.com', from: 'founder@gmail.com', to: 'booking@thetidelines.com\r\nBcc: evil2@x.com',
    subject: 'Hello\r\nBcc: evil3@x.com\r\n\r\nfake body', text: 'hi', inReplyTo: '<a@b>\r\nBcc: evil4@x.com', references: '<a@b>\nBcc: evil5@x.com' });
  eq('CR/LF in any header value cannot start a header of its own', namesOf(evil),
     ['From', 'To', 'Subject', 'Date', 'In-Reply-To', 'References', 'MIME-Version', 'Content-Type', 'Content-Transfer-Encoding']);
  ok('... nor end the headers early', evil.split('\r\n\r\n').length === 2, evil.split('\r\n\r\n').length);
  ok('... and a smuggled address never becomes a recipient', /^To: booking@thetidelines\.com$/m.test(headOf(evil)) && !/evil2|evil4|evil5/.test(evil), headOf(evil));
  eq('several recipients, names kept', fieldsOf(G.buildMime({ ...L, to: ['"Hart, Mia" <mia@x.com>', 'joe@y.com'] })).To, '"Hart, Mia" <mia@x.com>, joe@y.com');
}

/* ================================================================== */
console.log('\nSENDING  from the connected address, threaded, the Message-ID read back');
{
  const r1 = await G.sendMail({ ...net, to: 'Booking@TheTideLines.com', fromName: 'Perry Idyll', subject: 'Re: Your MySet page — café night',
    text: 'Friday at 8 works 🎸\nSee you there!', threadId: 'thr-alt1', inReplyTo: '<CAreply0001@mail.gmail.com>',
    references: ['<CAorig0001@mail.gmail.com>', '<CAreply0001@mail.gmail.com>'] });
  const post = gg.sent[gg.sent.length - 1];
  const sent = Buffer.from(post.raw, 'base64url').toString('utf8');
  eq('posted: raw and the thread, nothing else', [Object.keys(post).sort(), post.threadId], [['raw', 'threadId'], 'thr-alt1']);
  ok('raw is base64url: no padding, no + or /', /^[A-Za-z0-9_-]+$/.test(post.raw));
  const f = fieldsOf(sent);
  eq('from the connected address, to them, as a reply in the thread', [f.From, f.To, f['In-Reply-To'], f.References, decodeWords(f.Subject), f.Date],
     ['Perry Idyll <founder@gmail.com>', 'booking@thetidelines.com', '<CAreply0001@mail.gmail.com>', '<CAorig0001@mail.gmail.com> <CAreply0001@mail.gmail.com>',
      'Re: Your MySet page — café night', new Date(clock).toUTCString().replace('GMT', '+0000')]);
  eq('the answer: Gmail\'s ids and the Message-ID it put on the letter', r1, { ok: true, id: 'sent-1', threadId: 'thr-alt1', msgId: '<CAsent-1@mail.gmail.com>' });
  const back = new URL(gg.calls.filter((c) => c.url.includes('/messages/sent-1?')).pop().url);
  eq('... read with format=metadata, that one header only', [back.searchParams.get('format'), back.searchParams.getAll('metadataHeaders')], ['metadata', ['Message-ID']]);
  const n0 = gg.sent.length;
  const r2 = await G.sendMail({ ...net, to: 'booking@thetidelines.com', subject: 'Re: Your MySet page', text: 'Hello again', threadId: 'thr-gone' });
  eq('a thread deleted in Gmail since: sent once, as a new thread', [r2.ok, r2.threadId, gg.sent.length - n0, 'threadId' in gg.sent[gg.sent.length - 1]], [true, 'thr-new-2', 1, false]);
  gg.failMeta = true;
  const r3 = await G.sendMail({ ...net, to: 'booking@thetidelines.com', subject: 'x', text: 'y' });
  eq('the read-back failing never makes a sent letter look unsent', [r3.ok, r3.id, r3.msgId], [true, 'sent-3', '']);
  gg.failMeta = false;
  const e = await errOf(G.sendMail({ ...net, to: 'nobody at all', subject: 'x', text: 'y' }));
  eq('an address Gmail refuses: code google, its status, nothing sent', [e && e.code, e && e.status, gg.sent.length - n0], ['google', 400, 2]);
}

/* ================================================================== */
console.log('\nREADING  real MIME trees, each charset its own');
{
  const ids = await G.listIds('from:(booking@thetidelines.com OR joe@thetidelines.com)', net);
  eq('listIds: [{ id, threadId }]', ids.slice(0, 2), [{ id: 'alt1', threadId: 'thr-alt1' }, { id: 'latin1', threadId: 'thr-latin1' }]);
  const lu = new URL(gg.calls.filter((c) => /\/users\/me\/messages\?/.test(c.url)).pop().url);
  eq('... asked with the search, 25 at most', [lu.searchParams.get('q'), lu.searchParams.get('maxResults')], ['from:(booking@thetidelines.com OR joe@thetidelines.com)', '25']);
  eq('max is passed through', (await G.listIds('from:x', { ...net, max: 2 })).length, 2);
  eq('nothing found: an empty list', await G.listIds('nothing here', net), []);

  const m1 = await G.getMessage('alt1', net);
  eq('multipart/alternative: who, to whom, the subject decoded', [m1.from, m1.to, m1.cc, m1.subject],
     [{ name: 'Mía Hart', email: 'booking@thetidelines.com' }, ['founder@gmail.com'], ['mia@thetidelines.com', 'joe@thetidelines.com'], 'Re: Your MySet page — café night']);
  eq('... the plain part, UTF-8, without the quote under it (the attribution wrapped over two lines)', m1.text, 'Sí, me encanta 🎸 — ขอบคุณครับ! Café night at 8?');
  eq('... the ids a reply needs to thread', [m1.id, m1.threadId, m1.msgId, m1.inReplyTo, m1.references],
     ['alt1', 'thr-alt1', '<CAreply0001@mail.gmail.com>', '<CAorig0001@mail.gmail.com>', '<CAorig0001@mail.gmail.com>']);
  eq('... Gmail\'s own time, not the Date header', m1.date, Date.parse('2026-09-28T12:04:07Z'));
  eq('... the labels, and the snippet with its entities undone', [m1.labels, m1.snippet.includes('<founder@gmail.com>'), m1.snippet.endsWith("I'm")], [['INBOX', 'UNREAD'], true, true]);
  eq('... asked for with format=full', new URL(gg.calls.filter((c) => c.url.includes('/messages/alt1?')).pop().url).searchParams.get('format'), 'full');

  const m2 = await G.getMessage('latin1', net);
  ok('(the ISO-8859-1 fixture really is not UTF-8)', Buffer.from(PT, 'latin1').toString('utf8').includes('\ufffd'));
  eq('an ISO-8859-1 part is read in its own charset, the Portuguese quote cut', m2.text, 'Olá Perry! Já vi a página, está ótima. Até sexta?');
  eq('... a Q-encoded Latin-1 name', m2.from, { name: 'João Silva', email: 'joao@banda.com.br' });
  eq('... no internalDate: the Date header', m2.date, Date.parse('2026-09-28T17:30:00Z'));

  const m3 = await G.getMessage('htmlonly', net);
  eq('HTML only: words and line breaks, entities undone, no script or style, the quote cut', m3.text, 'Hey Perry,\nLoved it & we\'re in — see you Friday! élève 🎸\n\nMia\nThe Tide Lines');

  const m4 = await G.getMessage('mixed', net);
  eq('a nested multipart/mixed: the body only, no attachment, no "Sent from my iPhone"', m4.text, 'Here is our rider.');
  eq('... a bare From', m4.from, { name: '', email: 'joe@thetidelines.com' });

  eq('nothing readable in the body: the snippet instead', (await G.getMessage('calonly', net)).text, 'Invitation: Friday gig @ Fri Oct 2, 2026 8pm');
  const long = (await G.getMessage('long', net)).text;
  ok('capped at 4000 characters, marked, never half an emoji', long.length <= 4000 && long.endsWith('…') && !/[\ud800-\udbff](?![\udc00-\udfff])/.test(long), long.length);
  let e = await errOf(G.getMessage('nope', net));
  eq('an unknown message: code google, 404', [e && e.code, e && e.status], ['google', 404]);
  e = await errOf(G.getMessage('', net));
  eq('no id: refused before Gmail is asked', e && e.code, 'google');
  await errOf(G.getMessage('../profile', net));
  ok('an id cannot walk out of messages/', gg.calls[gg.calls.length - 1].url.includes('/messages/..%2Fprofile?'), gg.calls[gg.calls.length - 1].url);
}

/* ================================================================== */
console.log('\nTHE NEW PART OF A REPLY  each mail client\'s way of quoting');
{
  const STYLES = [
    ['Gmail, English', 'Sounds great, count us in!\n\nOn Mon, Sep 28, 2026 at 12:00 PM Perry Idyll <founder@gmail.com> wrote:\n\n> Hi! I made you a page.\n> Have a look.\n', 'Sounds great, count us in!'],
    ['Gmail, the attribution wrapped at 78 characters', 'Sounds great!\n\nOn Mon, Sep 28, 2026 at 12:00 PM Perry Idyll <founder@gmail.com>\nwrote:\n\n> Hi!\n', 'Sounds great!'],
    ['Apple Mail: the attribution inside the quote, "Sent from my iPhone" above it', 'Yes please! Friday works.\n\nSent from my iPhone\n\n> On 28 Sep 2026, at 12:00, Perry Idyll <founder@gmail.com> wrote:\n> \n> Hi! I made you a page.\n', 'Yes please! Friday works.'],
    ['Outlook desktop: underscores, then From / Sent / To / Subject', 'Sounds good, send it over.\n\n________________________________\nFrom: Perry Idyll <founder@gmail.com>\nSent: Monday, September 28, 2026 12:00 PM\nTo: The Tide Lines <booking@thetidelines.com>\nSubject: Your MySet page\n\nHi! I made you a page.\n', 'Sounds good, send it over.'],
    ['Outlook without the underscores', 'Thanks, Perry.\n\nFrom: Perry Idyll <founder@gmail.com>\nSent: Monday, September 28, 2026 12:00 PM\nTo: booking@thetidelines.com\nSubject: Your MySet page\n\nHi!\n', 'Thanks, Perry.'],
    ['-----Original Message-----', 'Ok!\n\n-----Original Message-----\nFrom: Perry Idyll\nHi!\n', 'Ok!'],
    ['Spanish Gmail', '¡Me encanta! Nos vemos el viernes.\n\nEl lun, 28 sept 2026 a las 12:00, Perry Idyll (<founder@gmail.com>) escribió:\n\n> Hola\n', '¡Me encanta! Nos vemos el viernes.'],
    ['French Gmail, a no-break space before the colon', 'Avec plaisir.\n\nLe lun. 28 sept. 2026 à 12:00, Perry Idyll <founder@gmail.com> a écrit\u00a0:\n\n> Salut\n', 'Avec plaisir.'],
    ['German Gmail, broken inside the address', 'Gerne, bis Freitag!\n\nAm Mo., 28. Sept. 2026 um 12:00 Uhr schrieb Perry Idyll <\nfounder@gmail.com>:\n\n> Hallo\n', 'Gerne, bis Freitag!'],
    ['Portuguese Gmail', 'Fechado!\n\nEm seg., 28 de set. de 2026 às 12:00, Perry Idyll <founder@gmail.com> escreveu:\n\n> Oi\n', 'Fechado!'],
    ['Thai Gmail', 'ได้เลยครับ แล้วเจอกันวันศุกร์\n\nเมื่อ จ. 28 ก.ย. 2569 เวลา 12:00 Perry Idyll <founder@gmail.com> เขียนว่า:\n\n> สวัสดีครับ\n', 'ได้เลยครับ แล้วเจอกันวันศุกร์'],
    ['Russian Gmail: no word for "wrote", the quote right under it', 'Да, конечно!\n\nпн, 28 сент. 2026 г. в 12:00, Perry Idyll <founder@gmail.com>:\n\n> Привет\n', 'Да, конечно!'],
    ['">" quoting only', 'Friday works.\n\n> Can you play Friday?\n> Or Saturday?\n', 'Friday works.'],
    ['written under the quote instead', 'On Mon, Sep 28, 2026 at 12:00 PM Perry Idyll <founder@gmail.com> wrote:\n> Hi! I made you a page.\n\nThanks, love it!\n', 'Thanks, love it!'],
    ['CRLF, as it comes out of a mail', 'Great.\r\n\r\nOn Mon, Sep 28, 2026 at 12:00 PM Perry <founder@gmail.com> wrote:\r\n> hi\r\n', 'Great.'],
  ];
  for (const [name, input, want] of STYLES) eq(name, G.stripQuoted(input), want);
  const plain = 'On Friday we play Sunset Bar, come along!\nOn the beach I wrote:\na new song for you.\n\nThanks for the page.';
  eq('no quote at all, lines that start with "On" and end with "wrote:" included: untouched', G.stripQuoted(plain), plain);
  eq('nothing but a quote: never empty, the text as it came', G.stripQuoted('> only a quote\n> here'), '> only a quote\n> here');
  eq('... at most its first 400 characters', G.stripQuoted(`On Mon, Sep 28, 2026 at 12:00 PM Perry <founder@gmail.com> wrote:\n> ${'x'.repeat(1000)}`).length, 400);
  eq('empty in, empty out', [G.stripQuoted(''), G.stripQuoted('  \n '), G.stripQuoted(null)], ['', '', '']);
}

/* ================================================================== */
console.log('\nADDRESSES  what a From, To or Cc header holds');
{
  const thai = 'ประเสริฐ';
  const split = [Buffer.from([0x43, 0x61, 0x66, 0xc3]).toString('base64'), Buffer.from([0xa9]).toString('base64')];   // "Café", é cut in two
  const cases = [
    ['a quoted name with a comma', '"Idyll, Perry" <Perry@Gmail.com>', [{ name: 'Idyll, Perry', email: 'perry@gmail.com' }]],
    ['plain name, bare address, and an escaped quote in a quoted name with a comma', 'Mia Hart <mia@x.com>, joe@y.com, "The \\"Tide\\" Lines, Band" <band@z.com>',
      [{ name: 'Mia Hart', email: 'mia@x.com' }, { name: '', email: 'joe@y.com' }, { name: 'The "Tide" Lines, Band', email: 'band@z.com' }]],
    ['a (comment) as the name', 'joe@y.com (Joe Lin)', [{ name: 'Joe Lin', email: 'joe@y.com' }]],
    ['UTF-8, B-encoded (Thai)', `=?UTF-8?B?${Buffer.from(thai).toString('base64')}?= <thai@x.com>`, [{ name: thai, email: 'thai@x.com' }]],
    ['UTF-8, Q-encoded', '=?UTF-8?Q?Mar=C3=ADa_Jos=C3=A9?= <mj@x.com>', [{ name: 'María José', email: 'mj@x.com' }]],
    ['ISO-8859-1, lower-case markers', '=?iso-8859-1?q?Andr=E9?= <andre@x.fr>', [{ name: 'André', email: 'andre@x.fr' }]],
    ['a character split across two words comes out whole', `=?UTF-8?B?${split[0]}?= =?UTF-8?B?${split[1]}?= <cafe@x.com>`, [{ name: 'Café', email: 'cafe@x.com' }]],
    ['two words and a plain word', '=?UTF-8?Q?Mar=C3=ADa?= =?UTF-8?Q?_Jos=C3=A9?= Band <mjb@x.com>', [{ name: 'María José Band', email: 'mjb@x.com' }]],
    ['an encoded word inside quotes (not allowed, but sent)', '"=?UTF-8?B?TcOtYSBIYXJ0?=" <mia@x.com>', [{ name: 'Mía Hart', email: 'mia@x.com' }]],
    ["Outlook's 'single quotes'", "'Perry Idyll' <p@x.com>", [{ name: 'Perry Idyll', email: 'p@x.com' }]],
    ['a group with members', 'Band: a@b.com, c@d.com;', [{ name: '', email: 'a@b.com' }, { name: '', email: 'c@d.com' }]],
    ['undisclosed-recipients:;', 'undisclosed-recipients:;', []],
    ['semicolons, as people type them', 'a@b.com; C@D.com', [{ name: '', email: 'a@b.com' }, { name: '', email: 'c@d.com' }]],
    ['mailto:', '<mailto:Mia@X.com>', [{ name: '', email: 'mia@x.com' }]],
  ];
  for (const [name, header, want] of cases) eq(name, G.parseAddress(header), want);
  eq('nothing with an address in it: nothing', [G.parseAddress(''), G.parseAddress(undefined), G.parseAddress('not an address'), G.parseAddress('Mia <>')], [[], [], [], []]);
}

/* ================================================================== */
console.log('\nTHE SYNC\'S NOTES  lastSync, err, and a ring of the last 500 ids');
{
  eq('noted', await G.markSync({ lastSync: NOW + 5, err: '', seen: ['alt1', 'latin1'] }), { ok: true });
  await G.markSync({ seen: ['latin1', 'htmlonly', '../bad id', ''] });
  eq('ids are added to the ring, never replacing it, never twice, never junk', await G.seenIds(), ['alt1', 'latin1', 'htmlonly']);
  await G.markSync({ seen: Array.from({ length: 600 }, (_, i) => `m${i}`) });
  const ring = await G.seenIds();
  eq('... the last 500, oldest first', [ring.length, ring[0], ring[499]], [500, 'm100', 'm599']);
  eq('lastSync and err as given', [(await G.status()).lastSync, (await G.status()).err], [NOW + 5, '']);
  await G.markSync({ err: 'Gmail 500: Backend Error' });
  eq('an error is noted, and only that changes', [(await G.status()).err, (await G.status()).lastSync, (await G.seenIds()).length], ['Gmail 500: Backend Error', NOW + 5, 500]);
  await G.connect({ ...net, code: 'good-code', state: await G.signState({ now }) });
  eq('the same mailbox connected again keeps what was synced, and clears the error',
     [(await G.seenIds()).length, (await G.status()).lastSync, (await G.status()).err], [500, NOW + 5, '']);
  gg.email = 'Other@Gmail.com';
  await G.connect({ ...net, code: 'good-code', state: await G.signState({ now }) });
  eq('a different mailbox starts clean', [(await G.status()).email, (await G.seenIds()).length, (await G.status()).lastSync], ['other@gmail.com', 0, 0]);
  gg.email = 'Founder@Gmail.com';
  await G.connect({ ...net, code: 'good-code', state: await G.signState({ now }) });
}

/* ================================================================== */
console.log('\nDISCONNECTING  Google is told, then the connection is forgotten');
{
  const rv = gg.revokes.length;
  eq('Google is told, with the refresh token', [await G.disconnect(net), gg.revokes.slice(rv)], [{ ok: true, revoked: true }, [RT]]);
  eq('... in a POST', gg.calls.filter((c) => c.url.startsWith('https://oauth2.googleapis.com/revoke')).pop().method, 'POST');
  eq('... and the connection is forgotten', [await docOf(), await G.status()], [null, { ready: true, connected: false, email: '', lastSync: 0, err: '' }]);
  eq('a sync finishing after it does not bring the document back', [await G.markSync({ lastSync: 1, seen: ['x'] }), await docOf()], [{ ok: false }, null]);
  gg.revoked = false;
  await G.connect({ ...net, code: 'good-code', state: await G.signState({ now }) });
  gg.down = true;
  eq('Google unreachable: forgotten anyway', [await G.disconnect(net), await docOf()], [{ ok: true, revoked: false }, null]);
  gg.down = false;
  eq('nothing connected: a quiet no-op', await G.disconnect(net), { ok: true, revoked: false });
}

ok('the real network was never used', realNet === 0, realNet);
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
