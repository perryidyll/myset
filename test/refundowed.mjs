/* A REFUND OWED IS WRITTEN DOWN BEFORE IT IS PAID  (decision 0155, INVARIANT 0ik)

   The scale audit of 2 October 2026: "Decline + refund" hid the song first and gave
   the votes back after. If giving them back failed, the Studio said "tap Decline +
   refund again" — but the song was hidden, and so was its Decline button. The credits
   were stranded on a song nobody could see, and a new night carried the fans on
   without them.

   Now the hide and a mark saying the refund is owed are one write. This pins:
     · a refund that fails leaves the song hidden, the mark, and a "Finish the refund"
       on the Live tab — and nothing falsely given back
     · finishing it gives every credit back exactly once; a second finish gives nothing
     · an End finishes what is owed, and a fresh start finishes it before it carries
       the fans into the new night — so bought votes on a declined song still carry
     · showing the song again un-declines it; deleting it refunds rather than drops
     · a mark from another night is dropped, never paid against the wrong fans */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { mutateFan, mutateShow, readFans, getShow, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { settleOwedRefund } = await import('../netlify/functions/_requests.mjs');
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
let castN = 0;
const vote = (fan, song, n) => hit(voteFn, 'https://x/api/vote', { fan, song, n, cast: 'owedcast' + String(++castN).padStart(8, '0') });
const credits = async (fan) => (await hit(showFn, `https://x/api/show?fan=${fan}`)).credits;
const owed = async () => (await getShow(DEFAULT_ARTIST)).refundsOwed || {};
const stage = async () => (await A('window', { open: true })).stage;
/* the fan files do not answer — the refund cannot run (test/decline.mjs covers the
   acked-but-lost write, which costs forty tries; this fails in two) */
const fanWritesFail = () => __failReads(/^f\d+_/);
const writesWork = () => __failReads(null);

console.log('\nSETUP  two songs, a fan with bought votes, a show on');
for (const t of ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']) await A('addSong', { title: t, artist: 'Artist' });
await A('freeCredits', { n: 2 });
await A('status', { status: 'live' });
await mutateFan(DEFAULT_ARTIST, 'ann', (me) => { me.extra = 6; return true; });
ok('Ann puts four on Alpha (two free, two bought)', (await vote('ann', 'alpha', 4)).ok);
ok('Bob puts one free vote on Alpha', (await vote('bob', 'alpha', 1)).ok);
const annBefore = await credits('ann');

console.log('\nA REFUND THAT FAILS IS OWED, AND THE ARTIST CAN SEE IT');
{
  fanWritesFail();
  const r = await A('declineSong', { song: 'alpha' });
  writesWork();
  eq('the decline does not report success', r.status, 503);
  ok('and says where to finish it', /Finish the refund/.test(r.error || ''), r.error);
  const st = await stage();
  eq('the song is hidden', st.songs.find((s) => s.id === 'alpha').active, false);
  eq('THE FIX: the Live tab offers to finish it, by name', st.owed, [{ id: 'alpha', title: 'Alpha' }]);
  eq('the mark is on the show, for tonight', (await owed()).alpha.show, (await getShow(DEFAULT_ARTIST)).showId);
  eq('nothing was falsely given back', (await credits('ann')).used, annBefore.used);
}

console.log('\nFINISHING IT GIVES EVERY CREDIT BACK, ONCE');
{
  const r = await A('declineSong', { song: 'alpha' });
  ok('Finish the refund (the same decline, again) succeeds', r.ok, r);
  eq('Ann has all four back', (await credits('ann')).used, annBefore.used - 4);
  eq('Bob has his one back', (await credits('bob')).used, 0);
  eq('the mark is gone', (await owed()).alpha, undefined);
  eq('and so is the button', r.stage.owed, []);
  const again = await A('declineSong', { song: 'alpha' });
  ok('a second finish is harmless', again.ok, again);
  eq('THE RULE: it gives nothing twice', [(await credits('ann')).used, (await credits('bob')).used], [annBefore.used - 4, 0]);
  eq('and leaves no mark behind', (await owed()).alpha, undefined);
}

console.log('\nSHOWING THE SONG AGAIN UN-DECLINES IT');
{
  ok('Bob votes on Bravo', (await vote('bob', 'bravo', 1)).ok);
  fanWritesFail(); await A('declineSong', { song: 'bravo' }); writesWork();
  ok('Bravo is owed', !!(await owed()).bravo);
  ok('the artist shows Bravo again', (await A('toggleSong', { song: 'bravo' })).ok);
  eq('the mark is taken off', (await owed()).bravo, undefined);
  eq('and Bob\'s vote stands on it — nothing lost, nothing given', (await stage()).songs.find((s) => s.id === 'bravo').votes, 1);
}

console.log('\nDELETING A SONG WITH VOTES OWED REFUNDS THEM, NEVER DROPS THEM');
{
  ok('Cy votes on Charlie', (await vote('cy', 'charlie', 2)).ok);
  fanWritesFail(); await A('declineSong', { song: 'charlie' }); writesWork();
  ok('Charlie is owed', !!(await owed()).charlie);
  ok('the artist deletes Charlie', (await A('removeSong', { song: 'charlie' })).ok);
  eq('THE RULE: Cy gets both back', (await credits('cy')).used, 0);
  eq('and the mark is gone', (await owed()).charlie, undefined);
}

console.log('\nAN END FINISHES WHAT IS OWED');
{
  ok('Dee votes on Delta', (await vote('dee', 'delta', 2)).ok);
  fanWritesFail(); await A('declineSong', { song: 'delta' }); writesWork();
  ok('Delta is owed', !!(await owed()).delta);
  ok('the show ends', (await A('status', { status: 'ended' })).ok);
  eq('THE RULE: the End gave Dee both back', (await credits('dee')).used, 0);
  eq('and took the mark off', (await owed()).delta, undefined);
  eq('an ended show offers no refund button', (await stage()).owed, []);
  ok('the show resumes', (await A('status', { status: 'live' })).ok);
}

console.log('\nA NEW NIGHT FINISHES IT BEFORE IT CARRIES THE FANS ON');
{
  await mutateFan(DEFAULT_ARTIST, 'eve', (me) => { me.extra = 3; return true; });
  ok('Eve puts five on Echo (two free, three bought)', (await vote('eve', 'echo', 5)).ok);
  fanWritesFail(); await A('declineSong', { song: 'echo' }); writesWork();
  ok('Echo is owed', !!(await owed()).echo);
  ok('a new show starts (no End in between)', (await A('newShow')).ok);
  eq('THE RULE: Eve\'s three bought votes carried into the new night', ((await readFans(DEFAULT_ARTIST)).eve || {}).extra, 3);
  eq('and last night\'s mark is gone', (await getShow(DEFAULT_ARTIST)).refundsOwed, undefined);
}

console.log('\nA MARK FROM ANOTHER NIGHT IS DROPPED, NEVER PAID AGAINST TONIGHT\'S FANS');
{
  ok('Ann votes on Alpha again, tonight', (await A('toggleSong', { song: 'alpha' })).ok && (await vote('ann', 'alpha', 1)).ok);
  await mutateShow(DEFAULT_ARTIST, (s) => { s.refundsOwed = { alpha: { show: 'an-old-night', title: 'Alpha' } }; return true; });
  eq('it is not offered', (await stage()).owed, []);
  const r = await settleOwedRefund(DEFAULT_ARTIST, 'alpha');
  eq('settling it gives nothing back', [r.ok, r.owed, r.given.length], [true, false, 0]);
  eq('Ann\'s vote tonight stands', (await stage()).songs.find((s) => s.id === 'alpha').votes, 1);
  eq('and the stale mark is gone', (await owed()).alpha, undefined);
}

console.log('\nA REFUND THAT FAILS HAS STOPPED WRITING BY THE TIME IT ANSWERS');
{
  /* One fan file fails, another is slow. With Promise.all the decline answered the
     moment the first failed, and the slow file's refund landed afterwards — after the
     artist could have shown the song again. Seen on GitHub's runner, 2026-10-03. */
  const { shardOf } = await import('../netlify/functions/_lib.mjs');
  const { __slowReads } = await import('./blobs-fake.mjs');
  await A('status', { status: 'live' });
  await A('addSong', { title: 'Foxtrot', artist: 'Artist' });
  const fox = (await stage()).songs.find((s) => s.title === 'Foxtrot').id;
  let f1 = null, f2 = null;
  for (let i = 0; !f2; i++) { const id = 'fx' + i; if (!f1) f1 = id; else if (shardOf(id) !== shardOf(f1)) f2 = id; }
  ok('two fans in two files vote on Foxtrot', (await vote(f1, fox, 1)).ok && (await vote(f2, fox, 1)).ok);
  __failReads(new RegExp(`^f${shardOf(f1)}_`));
  __slowReads(400, new RegExp(`^f${shardOf(f2)}_`));
  const r = await A('declineSong', { song: fox });
  __slowReads(0); writesWork();
  eq('the decline does not report success', r.status, 503);
  const atAnswer = (await credits(f2)).used;
  await new Promise((done) => setTimeout(done, 700));
  eq('THE FIX: nothing more lands after it answered', (await credits(f2)).used, atAnswer);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
