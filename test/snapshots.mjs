/* DATED COPIES ON R2  (decision 0175, INVARIANT 0io)

   `backup/<key>` is overwritten by every pass, so a bad deploy that damages a
   document has the damage copied over the good copy within a day. Now a pass that
   copies a CHANGED document also keeps that version under the day, at
   `snap/<YYYY-MM-DD>/<key>`, for SNAP_DAYS — and deletes the days past that
   window itself, from its own lists, without ever listing the bucket. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const { runMirror, STATE, PREFIX, SNAP_DAYS, SNAP_PREFIX, SNAPLIST, snapKey, familyOf } = await import('../netlify/functions/_mirror.mjs');
const { store, readDoc, casDoc } = await import('../netlify/functions/_lib.mjs');
const { __dump } = await import('./blobs-fake.mjs');
const { __r2 } = await import('./r2-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail).slice(0, 600)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const put = (k, v) => store().set(k, JSON.stringify(v));
const DAY = 86400e3;
const T0 = Date.UTC(2026, 9, 3, 4, 0, 0);                    // 2026-10-03, 04:00 UTC
const day = (ms) => new Date(ms).toISOString().slice(0, 10);
const r2keys = (pre) => [...__r2.objects.keys()].filter((k) => k.startsWith(pre)).sort();
const bytesOf = (k) => JSON.parse(Buffer.from(__r2.objects.get(k).bytes).toString());
const lists = () => __r2.calls.filter((c) => c.method === 'GET' && c.key === '').length;
/* A pass a day later: the state says the last one is a day old. */
const nextDay = (now) => casDoc(STATE, () => ({}), (d) => { d.passDoneAt = now - 25 * 3600e3; return true; });

__r2.install(); __r2.reset();
const OWNER = 'snapper';
const KEYS = ['profile_snapper', 'show_snapper', 'ev_snapper'];
for (const k of KEYS) await put(k, { v: 1, k });
const ring = (now) => runMirror({ now, budgetMs: 60000, owners: async () => [OWNER], keysOf: async () => KEYS });

console.log('\nEACH CHANGED VERSION IS KEPT UNDER THE DAY IT WAS COPIED');
{
  const r1 = await ring(T0);
  ok('the first pass copies everything', r1.done && r1.copied >= KEYS.length, r1);
  eq('and keeps each one under today too', r2keys(SNAP_PREFIX + day(T0) + '/').filter((k) => KEYS.some((x) => k.endsWith('/' + x))), KEYS.map((k) => snapKey(day(T0), k)).sort());
  const listed = ((await readDoc(SNAPLIST(day(T0)), null)).data || {}).keys || [];
  ok('the day\'s list names them, so they can leave without a listing', KEYS.every((k) => listed.includes(k)), listed);
  ok('the state remembers the day', ((await readDoc(STATE, null)).data.snapDays || []).includes(day(T0)));
  ok('the list is the mirror\'s own bookkeeping, never copied', (familyOf(SNAPLIST(day(T0))) || {}).how === 'skip' && !r2keys(PREFIX).some((k) => k.includes('mirrorsnap_')));

  await put('profile_snapper', { v: 1, k: 'profile_snapper', tagline: 'damaged by a bad deploy' });
  await nextDay(T0 + DAY);
  const r2 = await ring(T0 + DAY);
  ok('a day later only the changed document crosses', r2.copied === 1, r2);
  eq('and only it is kept under the new day', r2keys(SNAP_PREFIX + day(T0 + DAY) + '/'), [snapKey(day(T0 + DAY), 'profile_snapper')]);
  ok('backup/ now holds the damage', bytesOf(PREFIX + 'profile_snapper').tagline === 'damaged by a bad deploy');
  ok('and the day before still holds the good copy', !bytesOf(snapKey(day(T0), 'profile_snapper')).tagline);
}

console.log('\nTHE DAYS PAST THE WINDOW LEAVE, AND THE BUCKET IS NEVER LISTED');
{
  const before = lists();
  const late = T0 + (SNAP_DAYS + 1) * DAY + 3600e3;           // the first day is past the window; the second is not
  await casDoc(STATE, () => ({}), (d) => { d.passDoneAt = late - 3600e3; return true; });
  const r = await ring(late);
  eq('a ring with nothing to copy clears the day past the window', r.expired, [day(T0)]);
  eq('every dated copy of that day is gone', r2keys(SNAP_PREFIX + day(T0) + '/'), []);
  ok('the next day\'s is kept', r2keys(SNAP_PREFIX + day(T0 + DAY) + '/').length === 1);
  ok('the day\'s list is gone, and the state forgets the day', !__dump().has(SNAPLIST(day(T0))) && !((await readDoc(STATE, null)).data.snapDays || []).includes(day(T0)));
  ok('backup/ is untouched', KEYS.every((k) => __r2.objects.has(PREFIX + k)));
  eq('and not one listing of the bucket was asked for', lists() - before, 0);
  const again = await ring(late + 600e3);
  ok('the ring after that is back to one read and a return', again.done && !again.expired, again);
}

console.log('\nA DAY CAN BE BROUGHT HOME  (tools/r2pull.mjs --date)');
{
  const { pull } = await import('../tools/r2pull.mjs');
  const { mkdtempSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(tmpdir() + '/myset-snappull-');
  const man = await pull(dir, { day: day(T0 + DAY) });
  eq('the pull of one day reads that day\'s dated copies', man.rows.map((x) => x.key), ['profile_snapper']);
  ok('as the folder backup.py --restore reads, the version of that day', JSON.parse(readFileSync(`${dir}/keys/profile_snapper`)).tagline === 'damaged by a bad deploy' && man.store === 'r2:snap/' + day(T0 + DAY) + '/');
  rmSync(dir, { recursive: true, force: true });
  const whole = mkdtempSync(tmpdir() + '/myset-snappull-');
  const all = await pull(whole);
  ok('and the plain pull still reads backup/ alone', all.rows.every((x) => !x.key.startsWith('snap/')) && all.rows.some((x) => x.key === 'profile_snapper'), all.rows.map((x) => x.key));
  rmSync(whole, { recursive: true, force: true });
}
__r2.uninstall();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
