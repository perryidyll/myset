/* THE FIRST GIG  (admin.mjs signPrinted, stage.mjs, _lifecycle.mjs, _auto.mjs sweepNotes — 2026-09-15)

   The founder's friend put it in one line: get them to their first successful
   gig, fast, and the aha moment is when the money lands. This pins the server
   side of that batch:

     · the stage payload says whether this is a first gig (`nights`, stamped by
       endShow) and whether the sign was printed (`signAt`), so the Studio's
       pinned card reads the ACCOUNT, not the phone
     · signPrinted stamps once and never moves
     · the first night an account files queues ONE morning-after note; the bell
       sends it ten hours later, not before, to the owner's address, with the
       night's figures — and never a second one, however many nights follow
     · a note is never sent for a night that filed nothing */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
const SENT = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) { SENT.push(JSON.parse(opts.body)); return Promise.resolve(new Response('{}', { status: 202 })); }
  return nativeFetch(url, opts);
};

const admin = (await import('../netlify/functions/admin.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { readSched, sweepNotes } = await import('../netlify/functions/_auto.mjs');
const { FIRST_NIGHT_NOTE_MS } = await import('../netlify/functions/_lifecycle.mjs');
const { getShow, readMeta } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const AS = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
const stage = (token) => hit(stageFn, 'https://x/api/stage', undefined, token);

console.log('\nSETUP  a brand-new artist with one song');
const jo = await createArtist({ email: 'jo@example.com', name: 'Jo Reed', slug: 'jo-reed' });
const T = await signToken('jo@example.com', revOf(await readArtists(), jo.artistId));
ok('one song', (await AS(T, 'addSong', { title: 'Valerie', artist: 'Amy Winehouse' })).ok);

console.log('\nTHE STAGE SAYS "FIRST GIG" — AND WHETHER THE SIGN IS PRINTED');
{
  const s = await stage(T);
  ok('the stage answers', s.ok, s);
  eq('an account that has never filed a night has no count yet — the Studio asks history once', s.nights, null);
  eq('the sign is not printed', s.signAt, 0);
  const p = await AS(T, 'signPrinted');
  ok('printing the sign stamps the account', p.ok && p.signAt > 0, p);
  const again = await AS(T, 'signPrinted');
  eq('a second print keeps the first stamp', again.signAt, p.signAt);
  eq('and the stage carries it', (await stage(T)).signAt, p.signAt);
}

console.log('\nA NIGHT THAT FILED NOTHING QUEUES NO NOTE');
{
  ok('she starts a show', (await AS(T, 'status', { status: 'live' })).ok);
  ok('and ends it with nobody in the room', (await AS(T, 'status', { status: 'ended' })).ok);
  eq('nothing was filed, so no note is waiting', Object.keys((await readSched()).notes || {}), []);
  eq('and the count is still unknown', (await stage(T)).nights, null);
}

console.log('\nTHE FIRST NIGHT ON FILE QUEUES THE MORNING-AFTER NOTE');
let due = 0;
{
  ok('she starts a show', (await AS(T, 'newShow')).ok);
  const sh = await getShow(jo.artistId);
  ok('a phone in the room votes', (await hit(voteFn, 'https://x/api/vote?a=jo-reed', { fan: 'phoneA', song: sh.songs[0].id })).ok);
  ok('and she ends the night', (await AS(T, 'status', { status: 'ended' })).ok);
  const n = ((await readSched()).notes || {})[jo.artistId];
  ok('one note is queued for her', !!n, await readSched());
  eq('for the night that was just filed', n && n.showId, sh.showId);
  ok('due ten hours after the end — the morning, never the same evening', n && Math.abs(n.due - n.at - FIRST_NIGHT_NOTE_MS) < 2000, n);
  due = n ? n.due : 0;
  eq('the stage now says one night on file', (await stage(T)).nights, 1);
  eq('so does meta', (await readMeta(jo.artistId)).nights, 1);
}

console.log('\nTHE BELL SENDS IT WHEN IT IS DUE, ONCE');
{
  const early = await sweepNotes({ now: due - 60e3 });
  eq('a minute early: nothing goes', [early.checked, early.sent, SENT.length], [0, 0, 0]);
  const r = await sweepNotes({ now: due + 1000 });
  eq('on time: one letter', [r.checked, r.sent, SENT.length], [1, 1, 1]);
  const m = SENT[0];
  eq('to the owner’s address', m.to, ['jo@example.com']);
  ok('it says what it is', /first night/i.test(m.subject), m.subject);
  ok('it names her', /Jo Reed/.test(m.text), m.text);
  ok('it carries the night’s figures', /1 person voted, 1 vote in all/.test(m.text), m.text);
  ok('and the one next step is the calendar', /next show on the calendar/.test(m.text) && /Add your next show/.test(m.text), m.text);
  const sched = await readSched();
  eq('the note is gone from the queue', Object.keys(sched.notes || {}), []);
  ok('and remembered as sent', !!(sched.noted || {})[jo.artistId]);
  const r2 = await sweepNotes({ now: due + 3600e3 });
  eq('ringing again sends nothing', [r2.sent, SENT.length], [0, 1]);
}

console.log('\nA SECOND NIGHT NEVER QUEUES ANOTHER');
{
  ok('she starts another show', (await AS(T, 'newShow')).ok);
  const sh = await getShow(jo.artistId);
  ok('a phone votes', (await hit(voteFn, 'https://x/api/vote?a=jo-reed', { fan: 'phoneB', song: sh.songs[0].id })).ok);
  ok('and she ends it', (await AS(T, 'status', { status: 'ended' })).ok);
  eq('two nights on file', (await stage(T)).nights, 2);
  eq('no note waiting', Object.keys((await readSched()).notes || {}), []);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
