/* THE BOOK BUTTON AND THE INBOX  (_messages.mjs, messages.mjs, the msg* actions on
   /api/admin — decision 0074) and THE TOUR POSTER (tourSet / tourClear, the `tour`
   slot, the `tour` field — decision 0075)

   Pins, in order:
     · a stranger on the artist page sends a name, an email and some words with
       nothing but the vote page's anonymous id; the reply is a conversation id
       and a token; the conversation lands in Requests, unread
     · the index never carries the device hash, the email hash or the token; the
       booker's read never carries the email or the phone
     · a blocked sender, a filled honeypot and the same words twice from one phone
       all get the same "sent" answer and store nothing (9h)
     · three a day per phone, then a sentence and a 429; a fourth address on the
       same network still gets through (the network ceiling is soft)
     · three links in a message file it under Spam, not Requests
     · the booker reads by id + token and only that pair; a wrong token is a 404
     · the artist's reply moves Requests → General, clears unread, and the booker
       sees it at their link; the booker's reply sets unread again and stays put
     · Move, Mark unread, Report (→ Spam, flagged) and Block (→ Spam; the next
       message from that email OR that phone is swallowed) — and Unblock takes it back
     · crew is refused the inbox; a member may read and reply; only the owner may
       block or report
     · the 201st message in one conversation is refused, never dropped; the 301st
       conversation spills the oldest answered one into the archive and the
       conversation itself stays on disk
     · keysFor names the inbox, the archive and every conversation; the export
       carries them; a deleted artist leaves none behind
     · the tour poster: a PNG and a small PDF go in, an oversize PDF and a fake PDF
       do not; the public profile carries `tour`; the link needs the file first;
       tourClear takes both away; a crew sign-in is refused */
process.env.ADMIN_CODE = 'devlocal';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
const MAIL = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) { try { MAIL.push(JSON.parse(opts.body)); } catch {} return Promise.resolve(new Response('{}', { status: 202 })); }
  return nativeFetch(url, opts);
};

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const authFn = (await import('../netlify/functions/auth.mjs')).default;
const msgFn  = (await import('../netlify/functions/messages.mjs')).default;
const fanFn  = (await import('../netlify/functions/fan.mjs')).default;
const imgFn  = (await import('../netlify/functions/img.mjs')).default;
const M = await import('../netlify/functions/_messages.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { newSid } = await import('../netlify/functions/_session.mjs');
const { keysFor, exportArtist, deleteArtist } = await import('../netlify/functions/_account.mjs');
const { casDoc, readDoc, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { __dump } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token, ip) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  if (ip) headers['x-nf-client-connection-ip'] = ip;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};

console.log('\nSETUP — an artist, a band mate, a sound engineer');
const A0 = await createArtist({ email: 'inbox-owner@example.com', name: 'Inbox Artist' });
const aid = A0.artistId, slug = A0.slug;
await mutateArtists((a) => { a.byId[aid].plan = 'pro'; a.byId[aid].planUntil = Date.now() + 30 * 86400e3; return true; });
let reg = await readArtists();
const TO = await signToken('inbox-owner@example.com', revOf(reg, aid), newSid());
const S = (body, tok) => hit(admin, 'https://x/api/admin', body, tok);
const AU = (body, tok) => hit(authFn, 'https://x/api/auth', body, tok);
ok('the owner adds a band mate', (await AU({ action: 'add', email: 'inbox-mate@example.com', role: 'member' }, TO)).ok);
ok('and a sound engineer', (await AU({ action: 'add', email: 'inbox-crew@example.com', role: 'crew' }, TO)).ok);
reg = await readArtists();
const TM = await signToken('inbox-mate@example.com', revOf(reg, aid), newSid());
const TC = await signToken('inbox-crew@example.com', revOf(reg, aid), newSid());
const PUB = (body, ip) => hit(msgFn, `https://x/api/messages?a=${slug}`, body, null, ip || '10.0.0.1');
const READ = (t, k) => PUB({ action: 'get', t, k });
const FAN = 'fan-booker-0001';
const send = (over = {}, ip) => PUB({ action: 'send', fan: FAN, name: 'Val at The Room', email: 'val@theroom.example',
  phone: '+61 400 000 000', venue: 'The Room', when: 'Fri 3 Oct', kind: 'booking',
  text: 'Would love to have you for a Friday in October — what do you charge for two sets?', ...over }, ip);

console.log('\nA STRANGER WRITES');
let r = await send();
ok('the message is sent: an id and a token come back', r.ok && /^t[a-z0-9]{10}$/.test(r.id) && /^[0-9a-f]{32}$/.test(r.k), r);
const T1 = r.id, K1 = r.k;
let list = await S({ action: 'msgList' }, TO);
ok('the owner sees one conversation in Requests, unread', list.ok && list.counts.requests === 1 && list.counts.unread === 1 && list.threads[0].id === T1 && list.threads[0].folder === 'requests' && list.threads[0].unread === true, list);
ok('the row carries the name, the kind and a preview', list.threads[0].name === 'Val at The Room' && list.threads[0].kind === 'booking' && /Friday in October/.test(list.threads[0].preview), list.threads[0]);
ok('and never the device hash, the email hash or the token', !('e' in list.threads[0]) && !('f' in list.threads[0]) && !('k' in list.threads[0]), Object.keys(list.threads[0]));
ok('the list carries the caps so the Studio never types one', list.limits && list.limits.text === M.MAX_TEXT, list.limits);
const stored = JSON.parse(__dump().get(`msg_${aid}_${T1}`).body);
ok('the conversation on disk holds the email and a HASH of the device, never the id', stored.email === 'val@theroom.example' && stored.f && stored.f.length === 10 && !JSON.stringify(stored).includes(FAN), { f: stored.f });
let cnt = await S({ action: 'msgCount' }, TO);
eq('the badge count is one unread, one request', [cnt.unread, cnt.requests], [1, 1]);
const firstMail = MAIL.slice();
ok('the artist got a letter and the booker a receipt with the link', firstMail.some((m) => m.to[0] === 'inbox-owner@example.com') && firstMail.some((m) => m.to[0] === 'val@theroom.example' && m.text.includes(`#m=${T1}.${K1}`)), firstMail.map((m) => m.to[0]));
ok('the receipt carries the artist’s name and none of the booker’s words', firstMail.filter((m) => m.to[0] === 'val@theroom.example').every((m) => m.text.includes('Inbox Artist') && !m.text.includes('Friday in October') && !m.text.includes('Val at The Room')), firstMail.filter((m) => m.to[0] === 'val@theroom.example').map((m) => m.text));

console.log('\nTHE SAME "SENT" FOR EVERYONE THE DOOR REFUSES (9h)');
r = await send({ hp: 'http://spam.example' });
ok('a filled honeypot is "sent" and stores nothing', r.ok && r.id && (await S({ action: 'msgList' }, TO)).counts.requests === 1, r);
r = await send();
ok('the same words again from the same phone are "sent" and store nothing', r.ok && (await S({ action: 'msgList' }, TO)).counts.requests === 1, r);
eq('— and the answer is the conversation that already exists, so a second tap keeps one link', [r.id, r.k], [T1, K1]);
ok('the send reply says whether letters go out at all', typeof r.mail === 'boolean', r);
MAIL.length = 0;
r = await send({ text: 'A second, different message from the same phone about the same night.' });
ok('different words go through', r.ok && (await S({ action: 'msgList' }, TO)).counts.requests === 2, r);
const T2 = r.id, K2 = r.k;
ok('the same address gets no second receipt today; the artist still gets a letter', !MAIL.some((m) => m.to[0] === 'val@theroom.example') && MAIL.some((m) => m.to[0] === 'inbox-owner@example.com'), MAIL.map((m) => m.to[0]));
r = await send({ text: 'A third one, different again, still the same evening please.' });
ok('and a third', r.ok);
r = await send({ text: 'A fourth is one too many for one phone in one day, surely.' });
ok('the fourth in a day is a 429 with a sentence', r.status === 429 && /three messages today/.test(r.error), r);
r = await send({ fan: 'fan-other-phone-2', email: 'someone.else@example.com', text: 'Another phone on the same wifi still gets through today.' });
ok('another phone on the same network still gets through', r.ok, r);
r = await send({ fan: 'fan-other-phone-3', text: 'A new phone, but the same address for the fourth time today.' });
ok('a fourth from the same ADDRESS on a new phone is a 429 too', r.status === 429 && /this address/.test(r.error), r);
r = await send({ fan: 'fan-spammer-0003', email: 'links@example.com', text: 'Buy https://a.example and https://b.example and http://c.example now.' });
list = await S({ action: 'msgList' }, TO);
ok('three links in one message go to Spam, not Requests', r.ok && list.threads.find((t) => t.id === r.id).folder === 'spam' && list.counts.spam === 1, list.counts);
ok('and Spam never counts as unread on the badge', (await S({ action: 'msgCount' }, TO)).unread === list.counts.unread && list.counts.unread === 4, list.counts);
r = await send({ fan: 'fan-nameless-04', name: '', email: 'x@y.example' });
ok('no name is refused with a sentence', !r.ok && /name/.test(r.error), r);
r = await send({ fan: 'fan-nomail-0005', email: 'not-an-address' });
ok('a bad address is refused with a sentence', !r.ok && /email/.test(r.error), r);
r = await send({ fan: 'fan-short-00006', email: 'q@q.example', text: 'hi' });
ok('two letters are refused with a sentence', !r.ok && /little more/.test(r.error), r);
eq('a venue page has no Book button, so ?v= is a 404', (await hit(msgFn, 'https://x/api/messages?v=some-bar', { action: 'send' })).status, 404);

console.log('\nTHE BOOKER READS AT THE LINK');
r = await READ(T1, K1);
ok('id + token opens the conversation', r.ok && r.thread.id === T1 && r.thread.msgs.length === 1 && r.thread.msgs[0].by === 'you', r);
ok('the booker’s view carries the artist’s name and never the email or phone', r.thread.artist.name === 'Inbox Artist' && !('email' in r.thread) && !('phone' in r.thread), r.thread);
eq('a wrong token is a 404', (await READ(T1, 'f'.repeat(32))).status, 404);
eq('a wrong id is a 404', (await READ('tzzzzzzzzzz', K1)).status, 404);
eq('a token of the wrong length is a 404, not a throw', (await READ(T1, 'short')).status, 404);
eq('a GET is refused — the token never rides in a URL (0fb)', (await hit(msgFn, `https://x/api/messages?a=${slug}&t=${T1}&k=${K1}`)).status, 405);

console.log('\nTHE ARTIST ANSWERS');
r = await S({ action: 'msgThread', t: T1 }, TO);
ok('opening a conversation shows every message and marks it read', r.ok && r.thread.msgs.length === 1 && r.thread.unread === false && r.thread.email === 'val@theroom.example', r);
ok('and the index agrees', (await S({ action: 'msgList' }, TO)).threads.find((t) => t.id === T1).unread === false);
MAIL.length = 0;
r = await S({ action: 'msgReply', t: T1, text: 'Two sets on a Friday is $600 — 3 October is free. Shall I pencil it in?' }, TO);
ok('the reply is stored and the conversation moves to General', r.ok && r.folder === 'general', r);
list = await S({ action: 'msgList' }, TO);
ok('Requests → General on the index too, still read', list.threads.find((t) => t.id === T1).folder === 'general' && list.counts.general === 1 && list.counts.requests === 3, list.counts);
ok('the booker is emailed the reply with their link', MAIL.length === 1 && MAIL[0].to[0] === 'val@theroom.example' && MAIL[0].html.includes(`#m=${T1}.${K1}`), MAIL.map((m) => m.subject));
r = await READ(T1, K1);
ok('the booker sees the answer at the link', r.ok && r.thread.msgs.length === 2 && r.thread.msgs[1].by === 'artist', r);
MAIL.length = 0;
r = await PUB({ action: 'reply', t: T1, k: K1, text: 'Pencil it in, please — I will confirm by Monday.' });
ok('the booker writes back', r.ok, r);
list = await S({ action: 'msgList' }, TO);
ok('which sets unread again and stays in General', list.threads.find((t) => t.id === T1).unread === true && list.threads.find((t) => t.id === T1).folder === 'general', list.threads[0]);
ok('the artist is told (mail to the owner’s address)', MAIL.some((m) => m.to[0] === 'inbox-owner@example.com'), MAIL.map((m) => m.to));
eq('a reply with a wrong token is a 404', (await PUB({ action: 'reply', t: T1, k: 'e'.repeat(32), text: 'hello?' })).status, 404);

console.log('\nFILING: MOVE, MARK UNREAD, REPORT, BLOCK');
ok('Move to Business', (await S({ action: 'msgMove', t: T1, folder: 'business' }, TO)).ok);
eq('the row moved', (await S({ action: 'msgList' }, TO)).threads.find((t) => t.id === T1).folder, 'business');
ok('a folder that does not exist is refused', !(await S({ action: 'msgMove', t: T1, folder: 'attic' }, TO)).ok);
ok('Mark unread', (await S({ action: 'msgUnread', t: T1, on: true }, TO)).ok && (await S({ action: 'msgList' }, TO)).threads.find((t) => t.id === T1).unread === true);
// the founding account gets an owner address, the way the real registry has one
await mutateArtists((a) => { a.byEmail['founder@example.com'] = { artistId: DEFAULT_ARTIST, role: 'owner' }; return true; });
MAIL.length = 0;
ok('Report files it under Spam and flags it', (await S({ action: 'msgReport', t: T2 }, TO)).ok);
let row = (await S({ action: 'msgList' }, TO)).threads.find((t) => t.id === T2);
ok('reported, in Spam', row.reported === true && row.folder === 'spam', row);
const errKeys = [...__dump().keys()].filter((k) => k.startsWith('err_'));
ok('and MySet’s log has a line with the id and no words or address', errKeys.length && errKeys.some((k) => { const b = __dump().get(k).body; return b.includes('reported ' + T2) && !b.includes('val@theroom') && !b.includes('second, different'); }));
ok('the report goes to the founding account’s addresses with the ids and nothing else', MAIL.some((m) => /reported/.test(m.subject) && m.text.includes(T2) && !m.text.includes('val@theroom') && !m.text.includes('second, different')), MAIL.map((m) => m.subject));
ok('Block the sender', (await S({ action: 'msgBlock', t: T1, on: true }, TO)).ok);
row = (await S({ action: 'msgList' }, TO)).threads.find((t) => t.id === T1);
ok('the conversation is marked blocked and filed under Spam', row.blocked === true && row.folder === 'spam', row);
const before = (await S({ action: 'msgList' }, TO)).threads.length;
r = await send({ fan: 'fan-new-phone-007', text: 'Same address, a new phone: this one must be swallowed silently.' });
ok('a new message from that email is "sent" and stored nowhere', r.ok && (await S({ action: 'msgList' }, TO)).threads.length === before, r);
r = await send({ email: 'val.other@example.com', text: 'Same phone, a new address: swallowed too.' });
ok('and from that phone under another address', r.ok && (await S({ action: 'msgList' }, TO)).threads.length === before, r);
r = await PUB({ action: 'reply', t: T1, k: K1, text: 'Are you there?' });
ok('the booker’s reply into a blocked conversation is "sent" and not stored', r.ok && JSON.parse(__dump().get(`msg_${aid}_${T1}`).body).msgs.length === 3, r);
ok('Unblock', (await S({ action: 'msgBlock', t: T1, on: false }, TO)).ok);
// tomorrow: the day's ring is empty again (the phone and the address both spent their three today)
await casDoc(`inbox_${aid}`, () => ({}), (d) => { d.recent = []; return true; });
r = await send({ text: 'After the unblock this one arrives again, thank you.' });
ok('after which their messages arrive again', r.ok && (await S({ action: 'msgList' }, TO)).threads.length === before + 1, r);

console.log('\nWHO MAY');
eq('crew cannot read the inbox', (await S({ action: 'msgList' }, TC)).status, 403);
eq('crew cannot see the count', (await S({ action: 'msgCount' }, TC)).status, 403);
ok('a band mate may read it', (await S({ action: 'msgList' }, TM)).ok);
ok('and answer', (await S({ action: 'msgReply', t: T2, text: 'Thanks — the band mate here, we will be in touch.' }, TM)).ok);
eq('but only the owner blocks', (await S({ action: 'msgBlock', t: T2, on: true }, TM)).status, 403);
eq('and only the owner reports', (await S({ action: 'msgReport', t: T2 }, TM)).status, 403);

console.log('\nTHE ARTIST’S LETTERS ARE BUDGETED');
MAIL.length = 0;
for (let i = 0; i < 25; i++) await send({ fan: 'fan-many-' + String(i).padStart(6, '0'), email: `many${i}@example.com`, text: `Message number ${i} from a different phone and address each time, hello.` }, '10.0.' + i + '.9');
const artistMails = MAIL.filter((m) => m.to[0] === 'inbox-owner@example.com').length;
ok('twenty-five new conversations in a day mean at most twenty letters to the artist', artistMails <= M.MAILS_PER_ARTIST_PER_DAY && artistMails > 0, artistMails);
ok('every one of them still landed in Requests', (await S({ action: 'msgList' }, TO)).counts.requests >= 25);

console.log('\nCAPS — nothing is dropped');
await casDoc(`msg_${aid}_${T1}`, () => ({}), (t) => { t.msgs = Array.from({ length: M.MAX_MSGS }, (_, i) => ({ by: 'me', text: 'm' + i, at: i })); return true; });
r = await S({ action: 'msgReply', t: T1, text: 'one more' }, TO);
ok('the 201st message is refused with a sentence, the 200 stay', !r.ok && /full/.test(r.error) && JSON.parse(__dump().get(`msg_${aid}_${T1}`).body).msgs.length === M.MAX_MSGS, r);
/* Fill the index to the cap with answered conversations, then send one more. */
let firstOld = '';
await casDoc(`inbox_${aid}`, () => ({}), (d) => {
  const have = d.threads.length;
  firstOld = 't' + String(have).padStart(10, '0');
  for (let i = have; i < M.MAX_THREADS; i++) d.threads.push({ id: 't' + String(i).padStart(10, '0'), folder: 'general', unread: false, kind: 'other', name: 'Old ' + i, preview: 'old', lastAt: 1000 + i, lastBy: 'me', count: 2, reported: false, blocked: false, e: 'e' + i, f: 'f' + i });
  return true;
});
r = await send({ fan: 'fan-late-000008', email: 'late@example.com', text: 'The three hundred and first conversation arrives at the door.' });
ok('the 301st conversation is accepted', r.ok, r);
const idx = await M.readInbox(aid);
eq('the index is back at the cap', idx.threads.length, M.MAX_THREADS);
const arch = JSON.parse((__dump().get(`inboxarch_${aid}`) || { body: '{}' }).body);
ok('the oldest answered one went to the archive first', arch.list && arch.list.length === 1 && arch.list[0].id === firstOld, arch.list && arch.list.map((t) => t.id));
ok('and its own document is still on disk', !!__dump().get(`msg_${aid}_${T1}`));

console.log('\nEVERY KEY IS NAMED (0cy), THE EXPORT CARRIES THEM, DELETE LEAVES NOTHING');
const keys = await keysFor(aid);
ok('keysFor names the inbox, the archive and every conversation', keys.includes(`inbox_${aid}`) && keys.includes(`inboxarch_${aid}`) && keys.includes(`msg_${aid}_${T1}`) && keys.includes(`msg_${aid}_${T2}`), keys.filter((k) => /inbox|msg_/.test(k)).length);
ok('including the archived one', keys.includes(`msg_${aid}_${firstOld}`));
const exp = await exportArtist(aid);
ok('the export carries the conversations with the booker’s words and no device hash', Array.isArray(exp.messages) && exp.messages.some((t) => t.id === T1 && t.email === 'val@theroom.example') && !JSON.stringify(exp.messages).includes('"f":'), exp.messages && exp.messages.length);

console.log('\nTHE TOUR POSTER (0075)');
const PNG = 'data:image/png;base64,' + Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]).toString('base64');
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64');
r = await S({ action: 'tourSet', data: PNG }, TO);
ok('a PNG poster goes in', r.ok && r.profile.tour && r.profile.tour.type === 'png' && /^\/api\/img\?a=.*&s=tour&v=/.test(r.profile.tour.url), r.profile && r.profile.tour);
ok('and the caps ride the reply', r.limits && r.limits.pdf === 3 * 1024 * 1024 && r.limits.image === 900 * 1024, r.limits);
ok('the link is saved on its own', (await S({ action: 'tourSet', link: 'https://tickets.example/tour' }, TO)).profile.tour.link === 'https://tickets.example/tour');
r = await S({ action: 'tourSet', link: 'javascript:alert(1)' }, TO);
ok('a link that is not https is dropped, the file kept', r.ok && r.profile.tour.link === '' && r.profile.tour.type === 'png', r.profile && r.profile.tour);
r = await S({ action: 'tourSet', data: PDF, link: 'https://tickets.example/oct' }, TO);
ok('a PDF replaces it, with a link in the same save', r.ok && r.profile.tour.type === 'pdf' && r.profile.tour.link === 'https://tickets.example/oct', r.profile && r.profile.tour);
const img = await imgFn(new Request(`https://x${r.profile.tour.url}`));
ok('/api/img serves it as a PDF, inline, immutable', img.status === 200 && img.headers.get('content-type') === 'application/pdf' && /inline/.test(img.headers.get('content-disposition') || '') && /immutable/.test(img.headers.get('cache-control')), [img.status, img.headers.get('content-type')]);
const pub = await hit(fanFn, `https://x/api/fan?what=profile&a=${slug}`);
ok('the public profile carries the poster and the link', pub.ok && pub.tour && pub.tour.type === 'pdf' && pub.tour.link === 'https://tickets.example/oct', pub.tour);
r = await S({ action: 'tourSet', data: 'data:application/pdf;base64,' + Buffer.alloc(3 * 1024 * 1024 + 10, 0x25).toString('base64') }, TO);
ok('a PDF over 3 MB is refused with a sentence', !r.ok && /3 MB/.test(r.error), r);
r = await S({ action: 'tourSet', data: 'data:application/pdf;base64,' + Buffer.from('<html>not a pdf</html>').toString('base64') }, TO);
ok('a file that is not really a PDF is refused', !r.ok && /really a PDF/.test(r.error), r);
r = await S({ action: 'tourSet', data: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, TO);
ok('an SVG is refused', !r.ok, r);
eq('the photo path never accepts the tour slot', (await S({ action: 'photoUpload', slot: 'tour', data: PNG }, TO)).status, 400);
eq('crew cannot touch the poster', (await S({ action: 'tourSet', link: 'https://x.example' }, TC)).status, 403);
r = await S({ action: 'tourClear' }, TO);
ok('tourClear takes the poster and the link away', r.ok && r.profile.tour === null, r.profile && r.profile.tour);
ok('and the bytes', !__dump().get(`img_${aid}_tour`));
r = await S({ action: 'tourSet', link: 'https://tickets.example/alone' }, TO);
ok('a link with no poster is refused with a sentence', !r.ok && /Upload the poster first/.test(r.error), r);
ok('keysFor names the poster slot', (await keysFor(aid)).includes(`img_${aid}_tour`));

console.log('\nDELETE');
await deleteArtist(aid).catch(() => {});
const left = [...__dump().keys()].filter((k) => k.startsWith(`inbox_${aid}`) || k.startsWith(`inboxarch_${aid}`) || k.startsWith(`msg_${aid}_`) || k === `img_${aid}_tour`);
eq('a deleted artist leaves no conversation, no inbox and no poster behind', left, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
