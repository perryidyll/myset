/* A REQUEST'S VOTES OWED BACK ARE WRITTEN DOWN IN THE DECLINE  (decision 0202, INVARIANT 0je)

   Found by the read-only pass over the scale audit on 2026-10-09: the failure shape
   decision 0155 closed for "Decline + refund" was still open for a declined request.
   `resolveRequest` marked the row declined, then gave the votes back in a second
   write, and swallowed that write's failure: the row said declined, nothing said the
   votes were still owed, a second Decline answered "already dealt with", and the
   Studio told the artist "No votes to give back — that request was from an earlier
   show". The fan's votes were gone.

   This pins:
     · a decline whose refund fails answers as owed (never "earlier show"), and the
       Live tab offers Finish the refund for it
     · finishing it gives the votes back once; a third tap gives nothing
     · an End finishes it; a fresh start finishes it before the fans are carried on
     · a request from an earlier show is still declined with nothing given (0ac)
     · a song declined with an accepted request whose refund fails keeps its own
       mark too (0155), and finishing the song finishes the request */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const reqFn = (await import('../netlify/functions/request.mjs')).default;
const { readRequests, settleOwedRefunds } = await import('../netlify/functions/_requests.mjs');
const { readFans, getShow, mutateFan, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { __failReads } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (handler, url, body) => {
  const r = await handler(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: r.status, ...JSON.parse(await r.text()) };
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const ask = (fan, title) => hit(reqFn, `https://x/api/request?fan=${fan}`, { kind: 'song', title });
const used = async (fan) => (await hit(showFn, `https://x/api/show?fan=${fan}`)).credits.used;
const stage = async () => (await A('window', { open: true })).stage;
const rowOf = async (title) => (await readRequests(DEFAULT_ARTIST)).list.find((r) => r.title === title);
const fanWritesFail = () => __failReads(/^f\d+_/);
const writesWork = () => __failReads(null);

console.log('\nSETUP  requests on at three votes, a show on');
for (const t of ['Alpha', 'Bravo', 'Charlie']) await A('addSong', { title: t, artist: 'Artist' });
await A('askSet', { kind: 'song', on: true, cost: 3 });
await A('freeCredits', { n: 9 });
await A('status', { status: 'live' });

console.log('\nA DECLINE WHOSE REFUND FAILS IS OWED, AND SAYS SO');
{
  ok('Ann asks for a song (three votes)', (await ask('ann', 'Wanted One')).ok);
  const before = await used('ann');
  eq('her three votes are spent', before, 3);
  const id = (await rowOf('Wanted One')).id;
  fanWritesFail();
  const r = await A('askDecline', { id });
  writesWork();
  eq('the decline does not report success', r.status, 503);
  ok('THE FIX: and never says "from an earlier show"', !/earlier show/.test(r.error || r.note || '') && /Finish the refund/.test(r.error || ''), r);
  const row = await rowOf('Wanted One');
  eq('the row is declined, and says the votes are owed', [row.status, row.owed, row.refunded || 0], ['declined', 3, 0]);
  eq('the Live tab offers to finish it, by name', (await stage()).owed, [{ id, ask: true, title: 'Wanted One' }]);
  eq('nothing was falsely given back', await used('ann'), 3);

  const again = await A('askDecline', { id });
  ok('Finish the refund (the same decline, again) succeeds', again.ok, again);
  eq('Ann has her three back', await used('ann'), 0);
  eq('and the answer says so', again.refunded, 3);
  const after = await rowOf('Wanted One');
  eq('the mark is gone, the refund recorded', [after.owed, after.refunded], [undefined, 3]);
  eq('and so is the button', (await stage()).owed, []);
  const third = await A('askDecline', { id });
  eq('a third tap is "already dealt with"', third.status, 409);
  eq('THE RULE: it gives nothing twice', await used('ann'), 0);
}

console.log('\nA REFUND THAT LANDED BUT WHOSE ANSWER WAS LOST IS NOT PAID AGAIN');
{
  ok('Bo asks for a song', (await ask('bo', 'Wanted Two')).ok);
  const id = (await rowOf('Wanted Two')).id;
  // three more spent on something else tonight, so a second refund cannot hide behind the clamp at zero
  await mutateFan(DEFAULT_ARTIST, 'bo', (me) => { me.spent = (me.spent || 0) + 3; return true; });
  // the fan's write lands (credits back, its mark written), then the request list cannot be written
  await mutateFan(DEFAULT_ARTIST, 'bo', (me) => { me.spent = Math.max(0, (me.spent || 0) - 3); (me.rq ||= []).push('back:' + id); return true; });
  const { mutateRequests } = await import('../netlify/functions/_requests.mjs');
  await mutateRequests(DEFAULT_ARTIST, (d) => { const r = d.list.find((x) => x.id === id); r.status = 'declined'; r.owed = 3; return true; });
  eq('Bo already has his three back (three still spent elsewhere)', await used('bo'), 3);
  const r = await A('askDecline', { id });
  ok('finishing it succeeds', r.ok, r);
  eq('THE RULE: the fan\'s own mark stops a second refund', await used('bo'), 3);
  eq('and the row is settled', (await rowOf('Wanted Two')).owed, undefined);
}

console.log('\nAN END FINISHES WHAT IS OWED');
{
  ok('Cy asks for a song', (await ask('cy', 'Wanted Three')).ok);
  const id = (await rowOf('Wanted Three')).id;
  fanWritesFail(); await A('askDecline', { id }); writesWork();
  eq('it is owed', (await rowOf('Wanted Three')).owed, 3);
  ok('the show ends', (await A('status', { status: 'ended' })).ok);
  eq('THE RULE: the End gave Cy his three back', await used('cy'), 0);
  eq('and took the mark off', (await rowOf('Wanted Three')).owed, undefined);
  ok('the show resumes', (await A('status', { status: 'live' })).ok);
}

console.log('\nA NEW NIGHT FINISHES IT BEFORE IT CARRIES THE FANS ON');
{
  await mutateFan(DEFAULT_ARTIST, 'dee', (me) => { me.extra = 4; return true; });
  await A('freeCredits', { n: 0 });
  ok('Dee, with four bought votes and no free ones, asks for a song', (await ask('dee', 'Wanted Four')).ok);
  const id = (await rowOf('Wanted Four')).id;
  fanWritesFail(); await A('askDecline', { id }); writesWork();
  eq('it is owed', (await rowOf('Wanted Four')).owed, 3);
  ok('a new show starts (no End in between)', (await A('newShow')).ok);
  eq('THE RULE: all four bought votes carried into the new night', ((await readFans(DEFAULT_ARTIST)).dee || {}).extra, 4);
  eq('and the mark is gone', (await rowOf('Wanted Four')).owed, undefined);
  await A('freeCredits', { n: 9 });
}

console.log('\nA REQUEST FROM AN EARLIER SHOW IS DECLINED WITH NOTHING GIVEN (0ac)');
{
  ok('Eve asks for a song', (await ask('eve', 'Old One')).ok);
  const id = (await rowOf('Old One')).id;
  ok('a new night begins', (await A('newShow')).ok);
  const r = await A('askDecline', { id });
  eq('declined, nothing given, and it says why', [r.ok, r.refunded, /earlier show/.test(r.note || '')], [true, 0, true]);
  eq('no mark is left', (await rowOf('Old One')).owed, undefined);
}

console.log('\nA MARK FROM ANOTHER NIGHT IS DROPPED, NEVER PAID');
{
  ok('Fay asks for a song', (await ask('fay', 'Owed Then Gone')).ok);
  const id = (await rowOf('Owed Then Gone')).id;
  fanWritesFail(); await A('askDecline', { id }); writesWork();
  // the night changes with the mark still on (the fresh start's own settle failed)
  const { mutateRequests } = await import('../netlify/functions/_requests.mjs');
  await A('newShow');
  await mutateRequests(DEFAULT_ARTIST, (d) => { const r = d.list.find((x) => x.id === id); r.owed = 3; delete r.refunded; return true; });
  const fayBefore = await used('fay');
  const out = await settleOwedRefunds(DEFAULT_ARTIST);
  eq('settling it gives nothing to tonight\'s Fay', await used('fay'), fayBefore);
  eq('and drops the mark', (await rowOf('Owed Then Gone')).owed, undefined);
  ok('nothing is left owed', !out.left.length, out);
}

console.log('\nA DECLINED SONG WITH AN ACCEPTED REQUEST KEEPS ITS MARK UNTIL BOTH ARE BACK (0155)');
{
  ok('Gus asks for Bravo', (await ask('gus', 'Bravo')).ok);
  const row = await rowOf('Bravo');
  const acc = await A('askAccept', { id: row.id });
  ok('the artist adds it', acc.ok, acc);
  const songId = (await rowOf('Bravo')).songId;
  ok('it is on tonight\'s list', !!songId);
  fanWritesFail();
  const d = await A('declineSong', { song: songId });
  writesWork();
  eq('Decline + refund does not report success', d.status, 503);
  ok('THE FIX: the song\'s own mark stays while the request is owed', !!((await getShow(DEFAULT_ARTIST)).refundsOwed || {})[songId]);
  eq('the request is not declined yet: the song\'s votes went first and failed', (await rowOf('Bravo')).status, 'added');
  const fin = await A('declineSong', { song: songId });
  ok('Finish the refund on the song succeeds', fin.ok, fin);
  eq('Gus has his three back', await used('gus'), 0);
  eq('and both marks are gone', [((await getShow(DEFAULT_ARTIST)).refundsOwed || {})[songId], (await rowOf('Bravo')).owed], [undefined, undefined]);
}

console.log('\nA SONG\'S DECLINE OF ITS REQUESTS SAYS WHEN ONE IS STILL OWED');
{
  const { declineRequestsForSong, readRequests: rr } = await import('../netlify/functions/_requests.mjs');
  await A('freeCredits', { n: 9 });
  ok('Hal asks for Charlie', (await ask('hal', 'Charlie')).ok);
  const row = await rowOf('Charlie');
  ok('the artist adds it', (await A('askAccept', { id: row.id })).ok);
  const songId = (await rowOf('Charlie')).songId;
  fanWritesFail();
  const threw = await declineRequestsForSong(DEFAULT_ARTIST, songId, await getShow(DEFAULT_ARTIST)).then(() => false, () => true);
  writesWork();
  ok('THE FIX: it throws, so the song\'s mark is kept (0155 drops it only when this returns)', threw);
  eq('and the request is declined and owed', [(await rowOf('Charlie')).status, (await rowOf('Charlie')).owed], ['declined', 3]);
  await declineRequestsForSong(DEFAULT_ARTIST, songId, await getShow(DEFAULT_ARTIST));
  eq('run again, it finishes: Hal has his three back', await used('hal'), 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
