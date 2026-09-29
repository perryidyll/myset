/* A VENUE YOU ASKED IS A CONVERSATION  (decision 0123: _pitch.mjs + _messages.mjs,
   pitchSend on /api/admin, pitchThread / pitchReply / pitchSet on /api/venueadmin)

   Pins, in order:
     · "Want to perform here?" opens a conversation in the artist's Messages, in
       the Venues folder, with the artist's words as its first line; the pitch row
       and the artist's Gigs list both carry its id
     · asking again with the same words adds nothing; new words are a new line
     · the venue reads it through its own pitch and replies; the artist sees it
       unread, from the venue by name
     · the artist's reply marks the pitch as answered on the venue's list, and the
       venue opening it clears that
     · Keen drops one line into the conversation and sets its status; Undo sends nothing
     · Block is refused on a venue's conversation
     · a pitch from before 0123 (no conversation id) gets one when the venue answers
     · the conversation is the artist's: keysFor names it, and once the artist is
       deleted the venue still reads the pitch's own words */
process.env.ADMIN_CODE = 'devlocal';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const vadmin  = (await import('../netlify/functions/venueadmin.mjs')).default;
const V       = await import('../netlify/functions/_venues.mjs');
const P       = await import('../netlify/functions/_pitch.mjs');
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { newSid } = await import('../netlify/functions/_session.mjs');
const { keysFor, deleteArtist } = await import('../netlify/functions/_account.mjs');
const { casDoc } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};

console.log('\nSETUP — a venue and two artists');
const ven = await V.createVenue({ email: 'owner@thelantern.example', name: 'The Lantern', slug: 'the-lantern', city: 'Haad Rin', country: 'Thailand' });
ok('venue created', ven.ok, ven);
const vid = ven.venueId;
const TV = await V.signVenueToken('owner@thelantern.example', V.vRevOf(await V.readVenues(), vid), newSid());
const VA = (body) => hit(vadmin, 'https://x/api/venueadmin', body, TV);
const A1 = await createArtist({ email: 'pitcher@example.com', name: 'Juno Reed' });
const A2 = await createArtist({ email: 'oldpitch@example.com', name: 'Old Hand' });
let reg = await readArtists();
const T1 = await signToken('pitcher@example.com', revOf(reg, A1.artistId), newSid());
const S = (body, tok = T1) => hit(admin, 'https://x/api/admin', body, tok);

console.log('\nTHE ASK OPENS A CONVERSATION');
let r = await S({ action: 'pitchSend', venue: 'the-lantern', message: 'Acoustic covers, free most Thursdays.' });
ok('the ask goes through', r.ok && !r.already, r);
let list = await S({ action: 'msgList' });
ok('Messages has one conversation, in Venues', list.ok && list.counts.venues === 1 && list.threads.length === 1, list.counts);
const row = list.threads[0];
ok('from the venue, by name, marked as a venue and read', row.name === 'The Lantern' && row.kind === 'pitch' && row.folder === 'venues' && row.unread === false, row);
ok('the Gigs list carries the conversation id', r.pitches && r.pitches[0] && r.pitches[0].tid === row.id, r.pitches);
let th = (await S({ action: 'msgThread', t: row.id })).thread;
ok('the first line is the artist’s own words', th && th.msgs.length === 1 && th.msgs[0].by === 'me' && th.msgs[0].text === 'Acoustic covers, free most Thursdays.', th);
ok('and it links back to the venue', th.venueSlug === 'the-lantern' && th.status === 'new', th);

r = await S({ action: 'pitchSend', venue: 'the-lantern', message: 'Acoustic covers, free most Thursdays.' });
th = (await S({ action: 'msgThread', t: row.id })).thread;
ok('the same words again add nothing', r.ok && r.already && th.msgs.length === 1, th.msgs);
r = await S({ action: 'pitchSend', venue: 'the-lantern', message: 'Also free on Sundays now.' });
th = (await S({ action: 'msgThread', t: row.id })).thread;
ok('new words are a new line', r.ok && th.msgs.length === 2 && th.msgs[1].text === 'Also free on Sundays now.', th.msgs);
ok('still one conversation', (await S({ action: 'msgList' })).threads.length === 1);

console.log('\nTHE VENUE ANSWERS');
let vp = await VA({ action: 'pitchList' });
const pid = vp.pitches[0].id;
let vt = await VA({ action: 'pitchThread', id: pid });
ok('the venue reads the artist’s words', vt.ok && vt.thread.msgs.length === 2 && vt.thread.msgs.every((m) => m.by === 'artist'), vt);
ok('under the artist’s name, not its own', vt.thread.name === 'Juno Reed', vt.thread.name);
r = await VA({ action: 'pitchReply', id: pid, text: 'Thursday the 9th works — 8pm?' });
ok('the venue replies', r.ok && r.thread.msgs.slice(-1)[0].by === 'you', r);
list = await S({ action: 'msgList' });
ok('the artist sees it unread', list.counts.unread === 1 && list.threads[0].unread && list.threads[0].lastBy === 'them', list.threads[0]);
r = await VA({ action: 'pitchReply', id: pid, text: '   ' });
ok('an empty reply is refused', !r.ok, r);

console.log('\nTHE ARTIST ANSWERS IN MESSAGES');
r = await S({ action: 'msgReply', t: row.id, text: '8pm is perfect, see you then.' });
ok('the artist replies', r.ok && r.folder === 'venues' && !('vid' in r), r);
vp = await VA({ action: 'pitchList' });
ok('the venue’s list shows a new reply', vp.pitches[0].unread === true, vp.pitches[0]);
vt = await VA({ action: 'pitchThread', id: pid });
ok('the venue reads all four lines in order', vt.thread.msgs.map((m) => m.by).join() === 'artist,artist,you,artist', vt.thread.msgs);
vp = await VA({ action: 'pitchList' });
ok('and reading it clears the mark', vp.pitches[0].unread === false, vp.pitches[0]);

console.log('\nKEEN IS A LINE IN THE CONVERSATION');
r = await VA({ action: 'pitchSet', id: pid, status: 'keen' });
th = (await S({ action: 'msgThread', t: row.id })).thread;
ok('Keen sends its line and sets the status', r.ok && th.msgs.slice(-1)[0].text === P.STATUS_LINE.keen && th.status === 'keen', th);
const n = th.msgs.length;
await VA({ action: 'pitchSet', id: pid, status: 'new' });
th = (await S({ action: 'msgThread', t: row.id })).thread;
ok('Undo sends nothing', th.msgs.length === n, th.msgs.length);
r = await S({ action: 'msgBlock', t: row.id, on: true });
ok('Block is refused on a venue’s conversation', !r.ok, r);

console.log('\nA PITCH FROM BEFORE 0123');
await casDoc(`vpitch_${vid}`, () => ({ v: 1, list: [] }), (d) => {
  d.list.push({ id: 'pold0001', aid: A2.artistId, slug: A2.slug, name: 'Old Hand', message: 'Blues trio, any Friday.', at: Date.now() - 86400e3, status: 'new' });
  return true;
});
vt = await VA({ action: 'pitchThread', id: 'pold0001' });
ok('the venue reads its words before anyone answers', vt.ok && vt.thread.msgs.length === 1 && vt.thread.msgs[0].text === 'Blues trio, any Friday.', vt);
r = await VA({ action: 'pitchReply', id: 'pold0001', text: 'Fridays are full, how about a Wednesday?' });
ok('the venue’s answer opens a conversation', r.ok && r.thread.msgs.length === 2, r);
reg = await readArtists();
const T2 = await signToken('oldpitch@example.com', revOf(reg, A2.artistId), newSid());
const l2 = await S({ action: 'msgList' }, T2);
const th2 = l2.threads[0] && (await S({ action: 'msgThread', t: l2.threads[0].id }, T2)).thread;
ok('which the artist finds in Venues, their own words first', th2 && l2.counts.venues === 1 && th2.msgs[0].text === 'Blues trio, any Friday.' && th2.msgs[1].by === 'them', th2);

console.log('\nTHE CONVERSATION IS THE ARTIST’S');
const keys = await keysFor(A1.artistId);
ok('keysFor names it', keys.includes(`msg_${A1.artistId}_${row.id}`), keys.filter((k) => k.startsWith('msg')));
await deleteArtist(A1.artistId);
vt = await VA({ action: 'pitchThread', id: pid });
ok('after the artist leaves, the venue still reads the pitch’s own words', vt.ok && vt.thread.msgs.length === 1 && vt.thread.msgs[0].by === 'artist', vt);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
