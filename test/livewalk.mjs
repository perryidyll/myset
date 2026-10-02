/* ONE LIVE MARK PER ARTIST  (decision 0154, INVARIANT 0ij)

   The scale audit of 2 October 2026: every Start and every End wrote one global
   document, `gigsched` — the idle sweep's `live` list and the register's `regdirty`
   mark — in a CAS whose failure was swallowed. A thousand starts around the top of
   the hour all wrote it, alongside the bell's own lock and sweep; a write that ran out
   of tries was lost without a word, and a show the idle sweep never found ran for ever.

   Now the live mark is the artist's own show record, written in the same CAS as the
   flip, and the live walk at the top of the register's bell finds it by a computed
   route (the registry, one show record each) and folds it into the readers' places in
   one write. This pins:

     · a start and an end write no global document — even when it cannot be written
     · the walk puts a live show on the idle sweep's list and marks the register
     · a walk that finds nothing new writes nothing and reads the index once
     · an end comes off the list and is marked; the idle sweep still ends a show left on
     · a lap at a time from a cursor, never past its clock without reading one
     · a show record that cannot be read is left as it was
     · the bell walks first, so the fold in the same ring files the night
     · three hundred starts at once: no global write, and one walk finds them all */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const cron = (await import('../netlify/functions/registercron.mjs')).default;
const { startShow, endShow, walkLive, LIVE_WALK } = await import('../netlify/functions/_lifecycle.mjs');
const { sweepIdle, SHOW_IDLE_MS } = await import('../netlify/functions/_auto.mjs');
const R = await import('../netlify/functions/_register.mjs');
const { mutateShow, readDoc, casDoc } = await import('../netlify/functions/_lib.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { __opsStart, __opsStop, __failWrites, __failReads } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const sched = async () => ({ live: {}, regdirty: {}, liveSeen: {}, ...(((await readDoc('gigsched', null)).data) || {}) });
const show = async (aid) => ((await readDoc(`show_${aid}`, null)).data) || {};
// the documents every artist shares (the cost suite's list)
const GLOBAL = /^set (artists|promos|flags|cityindex|acctindex|idqueue|sheetsync|gigsched|delqueue|vidqueue|payowed|watch|register|register_work|registersync|register_[0-9-]+)$/;
const tapper = async (slug) => {
  const a = await createArtist({ email: `${slug}@example.com`, name: slug, slug });
  const T = await signToken(`${slug}@example.com`, revOf(await readArtists(), a.artistId));
  const tap = async (action, extra = {}) => {
    const r = await admin(new Request('https://x/api/admin', { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + T }, body: JSON.stringify({ action, ...extra }) }));
    return { status: r.status, ...(await r.json()) };
  };
  return { aid: a.artistId, tap };
};

console.log('\nA START AND AN END WRITE NO GLOBAL DOCUMENT — EVEN WHEN IT CANNOT BE WRITTEN');
const ana = await tapper('ana-walk');
{
  __failWrites(/^gigsched$/);                       // the shared index taking no writes at all
  const ops = __opsStart();
  const s = await ana.tap('status', { status: 'live' });
  const o = __opsStop();
  __failWrites(null);
  ok('the start goes through', s.ok, s);
  eq('the show record says live', (await show(ana.aid)).status, 'live');
  eq('THE RULE: the start wrote no document every artist shares', o.filter((l) => GLOBAL.test(l)), []);
  eq('so the index has no mark for it yet', (await sched()).live[ana.aid], undefined);
}

console.log('\nTHE WALK FINDS IT FROM THE SHOW RECORD');
{
  const r = await walkLive();
  const s = await sched(), sh = await show(ana.aid);
  ok('the walk looked at every artist', r.looked === r.of && r.of >= 1, r);
  eq('THE RULE: the show the lost write would have hidden is on the idle sweep\'s list', s.live[ana.aid], Math.max(sh.startedAt, sh.updatedAt));
  ok('and the register has its mark', s.regdirty[ana.aid] > 0, s.regdirty);
  ok('and the walk remembers what it saw', /^L\d+\.0$/.test(s.liveSeen[ana.aid] || ''), s.liveSeen);
  const ops = __opsStart();
  const again = await walkLive();
  const o = __opsStop();
  eq('a walk that finds nothing new writes nothing', o.filter((l) => /^set /.test(l)), []);
  eq('and reads the index once', o.filter((l) => l === 'get gigsched').length, 1);
  eq('and says so', [again.added, again.removed, again.dirty], [0, 0, 0]);
}

console.log('\nTHE IDLE SWEEP STILL ENDS A SHOW LEFT RUNNING');
{
  const at = (await sched()).live[ana.aid];
  const r = await sweepIdle({ now: at + SHOW_IDLE_MS + 1000 });
  eq('three idle hours after the walk saw it, it is ended', [r.ended, (await show(ana.aid)).status, (await show(ana.aid)).endedBy], [1, 'ended', 'inactivity']);
  eq('and off the list', (await sched()).live[ana.aid], undefined);
  const before = (await sched()).regdirty[ana.aid];
  await new Promise((res) => setTimeout(res, 5));
  await walkLive();
  ok('the next walk sees the end and marks the register again', (await sched()).regdirty[ana.aid] > before);
  eq('and does not put it back', (await sched()).live[ana.aid], undefined);
}

console.log('\nAN END TAKES IT OFF THE LIST AND MARKS THE REGISTER');
const bo = await tapper('bo-walk');
{
  ok('a show starts', (await bo.tap('status', { status: 'live' })).ok);
  await walkLive();
  ok('the walk puts it on', (await sched()).live[bo.aid] > 0);
  const marked = (await sched()).regdirty[bo.aid];
  const ops = __opsStart();
  ok('it ends', (await bo.tap('status', { status: 'ended' })).ok);
  const o = __opsStop();
  eq('the end wrote no document every artist shares (a night with nothing in it files nothing)', o.filter((l) => GLOBAL.test(l)), []);
  eq('it is still on the list until the walk looks', (await sched()).live[bo.aid] > 0, true);
  await new Promise((res) => setTimeout(res, 5));
  const r = await walkLive();
  eq('THE RULE: the walk takes an ended show off', (await sched()).live[bo.aid], undefined);
  ok('and moves the register\'s mark', (await sched()).regdirty[bo.aid] > marked, [(await sched()).regdirty[bo.aid], marked]);
  ok('and says what it did', r.removed >= 1 && r.dirty >= 1, r);
  ok('what it remembers now says ended', /^E\d+\.\d+$/.test((await sched()).liveSeen[bo.aid] || ''), (await sched()).liveSeen[bo.aid]);
}

console.log('\nA LAP AT A TIME, FROM A CURSOR');
{
  for (const s of ['cy-walk', 'di-walk', 'ed-walk']) await tapper(s);
  const ids = Object.keys((await readArtists()).byId).sort();
  await casDoc('gigsched', () => ({}), (d) => { d.liveCursor = 0; return true; });
  const seenIds = new Set();
  let r, laps = 0;
  do {
    const from = Number((await sched()).liveCursor) || 0;
    r = await walkLive({ limit: 2 });
    for (let i = 0; i < r.looked; i++) seenIds.add(ids[(from + i) % ids.length]);
    laps += 1;
  } while (seenIds.size < ids.length && laps < 10);
  eq('two at a time, every artist is reached', seenIds.size, ids.length);
  eq('in as many walks as it takes and no more', laps, Math.ceil(ids.length / 2));
  const from = Number((await sched()).liveCursor) || 0;
  const late = await walkLive({ deadline: Date.now() - 1 });
  eq('out of time, a walk still reads one, and the cursor moves past it', [late.looked, (await sched()).liveCursor], [1, (from + 1) % ids.length]);
  // an artist who leaves is forgotten after a whole lap
  await mutateArtists((reg) => { delete reg.byId[bo.aid]; return true; });
  await walkLive();
  eq('a departed artist is forgotten on the next whole lap', (await sched()).liveSeen[bo.aid], undefined);
}

console.log('\nA SHOW RECORD THAT CANNOT BE READ IS LEFT AS IT WAS');
const cy = { artistId: Object.entries((await readArtists()).byId).find(([, a]) => a.slug === 'cy-walk')[0] };
{
  await startShow(cy.artistId, { by: 'artist' });
  await walkLive();
  const was = (await sched()).live[cy.artistId];
  ok('a live show on the list', was > 0);
  await endShow(cy.artistId, { by: 'artist' });
  __failReads(new RegExp(`^show_${cy.artistId}$`));
  const r = await walkLive();
  __failReads(null);
  eq('the one that could not be read is not taken off on a guess', (await sched()).live[cy.artistId], was);
  ok('the rest were looked at', r.looked === r.of, r);
  await walkLive();
  eq('and the next walk, reading it, takes it off', (await sched()).live[cy.artistId], undefined);
}

console.log('\nTHE BELL WALKS FIRST, SO THE FOLD IN THE SAME RING FILES THE NIGHT');
{
  const di = await tapper('fi-walk');
  await mutateShow(di.aid, (s) => { s.songs = [{ id: 'valerie', title: 'Valerie', active: true }]; return true; });
  ok('a night starts', (await di.tap('newShow')).ok);
  await mutateShow(di.aid, (s) => { s.log = [{ songId: 'valerie', title: 'Valerie', at: Date.now(), votes: 3, roundVotes: 3 }]; return true; });
  ok('and ends', (await di.tap('status', { status: 'ended' })).ok);
  const showId = (await show(di.aid)).showId;
  // a full walk of the register is not due: only a mark can make this ring fold
  await casDoc('registersync', () => ({}), (d) => { d.lastRunAt = Date.now() - 6 * 60e3; d.lastFullAt = Date.now(); d.runningSince = 0; return true; });
  await casDoc('gigsched', () => ({}), (d) => { d.regdirty = {}; return true; });
  const said = await (await cron(new Request('https://x/', { method: 'POST', body: '{}' }))).text();
  eq('THE RULE: the walk\'s mark makes this very ring fold', said, 'ok');
  const view = await R.readView();
  ok('and the night is in the register', !!(view && view.rows.find((x) => x.showId === showId)), view && view.rows.map((x) => x.showId));
  eq('and its mark is cleared', (await sched()).regdirty[di.aid], undefined);
}

console.log(`\n${LIVE_WALK} STARTS AT ONCE: NO GLOBAL WRITE, AND ONE WALK FINDS THEM ALL`);
{
  const many = [];
  for (let i = 0; i < LIVE_WALK - 10; i++) many.push((await createArtist({ email: `crowd${i}@example.com`, name: `Crowd ${i}`, slug: `crowd-${i}` })).artistId);
  const ops = __opsStart();
  const started = await Promise.all(many.map((aid) => startShow(aid, { by: 'artist' })));
  const o = __opsStop();
  eq('every one started', started.filter((r) => r.ok).length, many.length);
  eq('THE RULE: not one write to a document every artist shares', o.filter((l) => GLOBAL.test(l)).length, 0);
  const r = await walkLive();
  eq('one walk reads the whole registry', r.looked, r.of);
  const s = await sched();
  eq('and every live show is on the idle sweep\'s list', many.filter((aid) => s.live[aid] > 0).length, many.length);
  eq('and marked for the register', many.filter((aid) => s.regdirty[aid] > 0).length, many.length);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
