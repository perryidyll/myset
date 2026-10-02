/* THE RATE LIMIT ON CASTING, AND WHAT BROKE KEPT PAST THE NIGHT.

   A token bucket on the fan record: twenty casts in a row, then thirty a minute,
   checked inside the write that already happens (decision 0030). And an error log
   in the blob store, one document per hour, that a fan's bug report gathers up —
   because Netlify's own logs are gone in 24 hours (decision 0029). The log keeps a
   route's path and never its query string, and a lyrics lookup has a deadline, so a
   hung upstream is a "not found", never a hung fan (decision 0110). */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const bugFn  = (await import('../netlify/functions/bug.mjs')).default;
const L      = await import('../netlify/functions/_lib.mjs');
const E      = await import('../netlify/functions/_errlog.mjs');
const { readFileSync } = await import('node:fs');
const { src } = await import('./_src.mjs');
const { __dump, __opsStart, __opsStop, __failWrites } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, ip) => {
  const headers = { 'content-type': 'application/json' };
  if (ip) headers['x-nf-client-connection-ip'] = ip;   // what Netlify sets; a bare Request has none
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers, body: JSON.stringify(body) }));
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
  eq('an hour is ERR_SHARDS keys, the first the old single one', E.shardKeys(t), ['err_2026-09-11T14', 'err_2026-09-11T14_1', 'err_2026-09-11T14_2', 'err_2026-09-11T14_3']);
  const quiet = console.error; console.error = () => {};
  for (let i = 0; i < E.KEEP_PER_HOUR * E.ERR_SHARDS + 10; i++) await E.logErr('flood', 'e' + i);
  console.error = quiet;
  const hr = await E.readErrs(1);
  ok('an hour never holds more than the cap on every shard', hr.rows.length <= E.KEEP_PER_HOUR * E.ERR_SHARDS, hr.rows.length);
  ok('the rows are spread over the shards', E.shardKeys().filter((k) => __dump().has(k)).length === E.ERR_SHARDS);
  eq('THE COUNT: every row is counted, the ones past the cap too (decision 0187)', hr.perHour[0].n, 1 + E.KEEP_PER_HOUR * E.ERR_SHARDS + 10);
  ok('while the kept rows are the newest', hr.rows.some((x) => x.msg === 'e' + (E.KEEP_PER_HOUR * E.ERR_SHARDS + 9)));
  /* THE INCIDENT (decision 0187): when errors pile up, every failing request fights
     over the hour's document and most writes lose. One document, three tries on it,
     and those rows were gone. Here every write to the hour's first key loses. */
  for (const k of E.shardKeys()) if (__dump().has(k)) await L.casDoc(k, () => ({}), (d) => { d.list = []; d.n = 0; return true; });
  console.error = () => {}; __failWrites(new RegExp('^' + E.hourKey() + '$'));
  for (let i = 0; i < 20; i++) await E.logErr('burst', 'b' + i);
  console.error = quiet; __failWrites(null);
  const burst = (await E.recentErrs(1)).filter((x) => x.where === 'burst').length;
  eq('one shard that always loses: every row still lands in another', burst, 20);
  const guarded = E.guard('t', async () => { throw new Error('unexpected'); });
  const r = await guarded(new Request('https://x/api/t'));
  eq('an uncaught throw becomes a 500, not a crash', r.status, 500);
  ok('and is on the record', (await E.recentErrs(1)).some((x) => x.msg === 'unexpected'));
  /* INVARIANT 0fb: a Studio code and a Stripe session id ride in the query string
     of the very requests most likely to throw. The row keeps the path alone. */
  const leaky = E.guard('t2', async () => { throw new Error('leaky'); });
  await leaky(new Request('https://x/api/t?code=SECRET123&session_id=cs_test_abc'));
  const row = (await E.recentErrs(1)).find((x) => x.msg === 'leaky');
  eq('the row keeps the route’s path, never its query string', row && row.url, 'https://x/api/t');
  const hour = E.shardKeys().map((k) => String((__dump().get(k) || {}).body || '')).join('');
  ok('and nothing in the hour’s document carries the code or the session id',
     hour.length > 0 && !hour.includes('SECRET123') && !hour.includes('cs_test_abc'));
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

console.log('\nONE NETWORK CANNOT FLOOD THE BUG LIST BY ROTATING DEVICE IDS (0111)');
{
  /* "One per device per ten minutes" is one per call for a loop with a fresh id,
     and each report used to cost three reads of the hourly error documents before
     its write. The network is not the caller's to choose, and a refused report is
     judged on one read of the bugs document alone. */
  const NET_A = '203.0.113.10', NET_B = '198.51.100.20';
  const reportFrom = (ip, fan, note) => hit(bugFn, 'https://x/api/bug', { fan, note, recent: [], page: '/vote', ua: 'test' }, ip);
  const kept = (await adm({ action: 'bugList' })).list.length;
  let landed = 0, last = null;
  for (let i = 0; i < E.BUG_PER_NETWORK_PER_HOUR + 4; i++) {
    last = await reportFrom(NET_A, 'rot' + i, 'it broke ' + i);
    if (last.ok && !last.already) landed++;
  }
  eq('the hour’s allowance lands; the rest are thanked, not stored',
     [landed, last.status, last.ok, last.already], [E.BUG_PER_NETWORK_PER_HOUR, 200, true, true]);
  eq('the list grew by exactly the allowance', (await adm({ action: 'bugList' })).list.length - kept, E.BUG_PER_NETWORK_PER_HOUR);
  __opsStart();
  const r = await E.saveBug('perry-idyll', 'rotLate', { note: 'again' }, NET_A);
  const ops = __opsStop();
  eq('a refused report is the same shape as a repeat from one phone', [r.ok, r.already], [true, true]);
  eq('and costs ONE read of the bugs document — the hourly error documents are never gathered, nothing is written',
     [ops.filter((o) => o === 'get bugs_perry-idyll').length, ops.filter((o) => /^get err_/.test(o)).length,
      ops.filter((o) => /^set /.test(o)).length, ops.length], [1, 0, 0, 1]);
  const other = await reportFrom(NET_B, 'rotElsewhere', 'from another bar');
  ok('another network is untouched', other.ok && !other.already, other);
  const raw = String((__dump().get('bugs_perry-idyll') || {}).body || '');
  ok('the document holds no address', raw.length > 0 && !raw.includes(NET_A) && !raw.includes(NET_B));
}

console.log('\nA STALLED LYRICS UPSTREAM CANNOT STALL A FAN’S REQUEST (0110)');
{
  /* LRCLIB answering nothing at all — the shape of a hung upstream to Node's
     fetch: the promise settles only when the signal it was handed says stop. A
     fetch handed NO signal here never settles, which is exactly the bug. */
  const Ly = await import('../netlify/functions/_lyrics.mjs');
  const lyricsFn = (await import('../netlify/functions/lyrics.mjs')).default;
  const realFetch = globalThis.fetch;
  let handedSignal = 0;
  globalThis.fetch = (_url, opts = {}) => new Promise((_, reject) => {
    const s = opts.signal;
    if (!s) return;
    handedSignal++;
    const stop = () => reject(s.reason || new Error('aborted'));
    if (s.aborted) stop(); else s.addEventListener('abort', stop, { once: true });
  });
  const t0 = Date.now();
  let backstop;
  const r = await Promise.race([
    hit(lyricsFn, `https://x/api/lyrics?song=${song}`),
    new Promise((res) => { backstop = setTimeout(res, Ly.LRCLIB_TIMEOUT_MS + 4000, { hung: true }); }),
  ]);
  clearTimeout(backstop);
  globalThis.fetch = realFetch;
  const took = Date.now() - t0;
  ok('the fan is answered on the deadline, not when the upstream feels like it',
     !r.hung && took >= Ly.LRCLIB_TIMEOUT_MS - 100 && took < Ly.LRCLIB_TIMEOUT_MS + 2000, { took, r });
  eq('with the ordinary not-found shape — never an error', [r.status, r.ok, r.found], [200, true, false]);
  ok('because the fetch was handed the deadline', handedSignal >= 1, handedSignal);
}

console.log('\nTHE PAGES');
{
  const vote = readFileSync('public/vote.html', 'utf8');
  ok('the voting page offers "Something wrong?"', vote.includes('Something wrong?') && vote.includes('/bug'));
  ok('and remembers what it saw fail, in memory only', vote.includes('noteFail(') && !vote.includes("localStorage.setItem('myset.recent"));
  const studio = src('public/studio.html');
  ok('the Studio can read the reports', studio.includes("action:'bugList'"));
  for (const f of ['vote', 'show', 'board', 'me', 'pay', 'stage', 'community', 'request', 'gift', 'feedback', 'webhook', 'admin', 'auth', 'clipup', 'confirm']) {
    const src = readFileSync(`netlify/functions/${f}.mjs`, 'utf8');
    ok(`${f} is guarded`, src.includes(`export default guard('${f}', main)`));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
