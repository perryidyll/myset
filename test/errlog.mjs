/* THE RATE LIMIT ON CASTING, AND WHAT BROKE KEPT PAST THE NIGHT.

   A token bucket on the fan record: twenty casts in a row, then thirty a minute,
   checked inside the write that already happens (decision 0030). And an error log
   in the blob store, one document per hour, that a fan's bug report gathers up —
   because Netlify's own logs are gone in 24 hours (decision 0029). */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const bugFn  = (await import('../netlify/functions/bug.mjs')).default;
const L      = await import('../netlify/functions/_lib.mjs');
const E      = await import('../netlify/functions/_errlog.mjs');
const { readFileSync } = await import('node:fs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const adm = (body) => hit(admin, 'https://x/api/admin?code=devlocal', body);

console.log('\nTHE BUCKET, ON ITS OWN');
{
  const me = {};
  let n = 0; while (L.takeCastToken(me, 1000)) n++;
  eq('a fresh device gets exactly the burst', n, L.CAST_BURST);
  ok('and then nothing, in the same instant', !L.takeCastToken(me, 1000));
  ok('two seconds later, one more', L.takeCastToken(me, 3000));
  ok('but not two', !L.takeCastToken(me, 3000));
  const later = { rl: { t: 0, at: 0 } };
  let m = 0; while (L.takeCastToken(later, 10 * 60e3)) m++;
  eq('ten minutes idle refills to the burst, never past it', m, L.CAST_BURST);
  const odd = { rl: 'garbage' };
  ok('a mangled record is treated as fresh, not as banned', L.takeCastToken(odd, 5));
}

console.log('\nTHE BUCKET, THROUGH /api/vote');
await adm({ action: 'addSong', title: 'Alpha', artist: 'T' });
await adm({ action: 'status', status: 'live' });
await adm({ action: 'freeCredits', n: 200 });
const show = await L.getShow('perry-idyll');
const song = show.songs[0].id;
const cast = (fan, i) => hit(voteFn, 'https://x/api/vote', { fan, song, n: 1, op: 'cast', cast: 'cast' + i + '-' + fan + '-x' });
{
  let last = null, landed = 0;
  for (let i = 0; i < L.CAST_BURST + 5; i++) { last = await cast('spammer', i); if (last.ok) landed++; }
  eq('the burst lands', landed, L.CAST_BURST);
  eq('the next one is told to slow down', last.status, 429);
  ok('in words a person can act on', /taps/.test(last.error), last.error);
  const fans = await L.readFans('perry-idyll');
  eq('and nothing past the burst was written', (fans.spammer.v || []).length, L.CAST_BURST);
  const other = await cast('calm', 0);
  ok('another device is untouched', other.ok, other);
  const again = await cast('spammer', L.CAST_BURST - 1);   // still within the kept casts
  ok('a replay of an earlier cast is answered from memory, not refused', again.ok && again.replay, again);
}

console.log('\nERRORS LAND IN THE BLOB STORE, ONE DOCUMENT PER HOUR');
{
  const t = Date.parse('2026-09-11T14:20:00Z');
  eq('the key is the hour, computable, no list()', E.hourKey(t), 'err_2026-09-11T14');
  await E.logErr('test', new Error('boom'), { aid: 'perry-idyll', fan: 'f1', url: 'https://x/api/vote' });
  const rows = await E.recentErrs(3);
  ok('it can be read back', rows.length === 1 && rows[0].msg === 'boom' && rows[0].where === 'test', rows);
  ok('with a stack, cut short', rows[0].stack.length > 0 && rows[0].stack.length <= 1200);
  for (let i = 0; i < E.KEEP_PER_HOUR + 10; i++) await E.logErr('flood', 'e' + i);
  ok('an hour never holds more than the cap', (await E.recentErrs(1)).length <= E.KEEP_PER_HOUR);
  const guarded = E.guard('t', async () => { throw new Error('unexpected'); });
  const r = await guarded(new Request('https://x/api/t'));
  eq('an uncaught throw becomes a 500, not a crash', r.status, 500);
  ok('and is on the record', (await E.recentErrs(1)).some((x) => x.msg === 'unexpected'));
}

console.log('\nA FAN CAN REPORT A BUG, AND THE SERVER ATTACHES WHAT IT SAW');
{
  const report = (fan, note, recent) => hit(bugFn, 'https://x/api/bug', { fan, note, recent, page: '/vote', ua: 'test' });
  eq('an empty report is refused', (await report('f1', '', [])).status, 400);
  const r = await report('f1', 'tapped vote, nothing happened', [{ at: 1, what: 'vote: busy' }]);
  ok('a real one lands', r.ok && !r.already, r);
  const b = await adm({ action: 'bugList' });
  ok('the artist can read it', b.ok && b.list.length === 1 && b.list[0].note === 'tapped vote, nothing happened', b);
  ok('with what the phone saw', b.list[0].client[0].what === 'vote: busy');
  ok('and what the server saw in the hours before', b.list[0].server.some((x) => x.msg === 'unexpected'));
  ok('the server side is capped, so the document stays small', b.list[0].server.length <= 40);
  const r2 = await report('f1', 'again', []);
  ok('the same device ten seconds later is thanked but not stored twice', r2.ok && r2.already, r2);
  eq('', (await adm({ action: 'bugList' })).list.length, 1);
}

console.log('\nTHE PAGES');
{
  const vote = readFileSync('public/vote.html', 'utf8');
  ok('the voting page offers "Something wrong?"', vote.includes('Something wrong?') && vote.includes('/bug'));
  ok('and remembers what it saw fail, in memory only', vote.includes('noteFail(') && !vote.includes("localStorage.setItem('myset.recent"));
  const studio = readFileSync('public/studio.html', 'utf8');
  ok('the Studio can read the reports', studio.includes("action:'bugList'"));
  for (const f of ['vote', 'show', 'board', 'me', 'pay', 'stage', 'community', 'request', 'gift', 'feedback', 'webhook', 'admin', 'auth', 'clipup', 'confirm']) {
    const src = readFileSync(`netlify/functions/${f}.mjs`, 'utf8');
    ok(`${f} is guarded`, src.includes(`export default guard('${f}', main)`));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
