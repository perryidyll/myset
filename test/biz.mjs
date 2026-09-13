/* THE ARTIST'S BOOK  (_biz.mjs, the biz actions in admin.mjs — decision 0065)

   What a show was worth to the person who played it, kept in one document per
   artist and gated exactly the way the filed nights are. Pins:
     · a Hobbyist is refused with a 402 that names the plan; a band mate on a seat
       is refused with a 403 — the book is the owner's
     · a sixth band member on Bar Star is a 402 naming BOTH plans; an eleventh on
       Rock Star is a 400; a band logged on Rock Star stays editable after a
       downgrade and only the next add is refused (INVARIANT 0s, the growth rule)
     · strings are cut, never refused; a negative or nonsense amount and a time
       past 48 hours ARE refused
     · a rule default belongs to a gig that is on the calendar, and rules whose
       gig has gone are pruned on the next rule save and on eventDelete
     · a full book says so and writes nothing
     · bizGet ships only the window's records, a trimmed calendar, the nights only
       when asked, the plan's two sizes, the cut and the name
     · a record can be removed; the hours toggles round-trip
     · the export carries the book, and a purge leaves no trace of it */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { readBiz, mutateBiz, BIZ_MAX_BYTES, BIZ_FULL, LIMITS, TIME_KINDS, keyOk } = await import('../netlify/functions/_biz.mjs');
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { archiveShow } = await import('../netlify/functions/_history.mjs');
const { exportArtist, purgeDue } = await import('../netlify/functions/_account.mjs');
const { casDoc, KEY, readDoc } = await import('../netlify/functions/_lib.mjs');
const { __dump } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A = (token) => (action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
const band = (n) => Array.from({ length: n }, (_, i) => ({ name: 'M' + i, cents: 1000 }));
const costs = (n) => Array.from({ length: n }, (_, i) => ({ name: 'C' + i, cents: 500 }));
const setPlan = (aid, plan) => mutateArtists((r) => { r.byId[aid].plan = plan; return true; });

console.log('\nSETUP  a Hobbyist, a Bar Star with a Thursday residency, and a band mate on her seat');
const fay = await createArtist({ email: 'fay@example.com', name: 'Fay Free', slug: 'fay-free' });
const TF = await signToken('fay@example.com', revOf(await readArtists(), fay.artistId));
const F = A(TF);
const pia = await createArtist({ email: 'pia@example.com', name: 'Pia Lark', slug: 'pia-lark' });
const TP = await signToken('pia@example.com', revOf(await readArtists(), pia.artistId));
const P = A(TP);
await setPlan(pia.artistId, 'plus');
ok('the residency is on her calendar', (await P('eventSave', { event: { id: 'gpia', venue: 'The Corner', city: 'Koh Phangan',
  country: 'Thailand', tz: 'UTC', date: '2026-03-05', time: '20:00', endTime: '23:00', repeat: { freq: 'weekly' } } })).ok);
await mutateArtists((r) => { r.byEmail['mate@example.com'] = { artistId: pia.artistId, role: 'member' };
  r.byEmail['sound@example.com'] = { artistId: pia.artistId, role: 'crew' }; return true; });
const TM = await signToken('mate@example.com', revOf(await readArtists(), pia.artistId));
const TC = await signToken('sound@example.com', revOf(await readArtists(), pia.artistId));
const K = 'gpia@2026-03-12';

console.log('\nWHO MAY OPEN THE BOOK');
{
  for (const action of ['bizGet', 'bizSave', 'bizPrefs']) {
    const r = await F(action, { key: K, gig: { pay: 1 }, hours: {} });
    eq(`a Hobbyist is refused ${action} with a 402`, r.status, 402);
    ok('that names the plan and keeps what was logged', /Bar Star feature/.test(r.error || '') && /kept/.test(r.error || ''), r.error);
  }
  eq('a band mate on her seat cannot read it', (await A(TM)('bizGet')).status, 403);
  eq('nor write it', (await A(TM)('bizSave', { key: K, gig: { pay: 100 } })).status, 403);
  eq('nor a crew seat', (await A(TC)('bizGet')).status, 403);
  eq('the owner can', (await P('bizGet')).status, 200);
}

console.log('\nONE NIGHT, LOGGED');
{
  const r = await P('bizSave', { key: K, gig: { pay: '30000', band: [{ name: ' Sam ', cents: 10000 }, { name: '', cents: '' }],
    cut: '18000', tips: 4500, merch: [{ name: 'Tee', qty: '3', cents: 6000 }], costs: [{ name: 'Parking', cents: 1200 }],
    min: { perform: 120, break: '30' }, gear: '• Taylor 314\n- Bose S1\n\n', note: '  a   fine  night ' } });
  ok('the save lands', r.ok, r);
  eq('cents come back as integers', [r.gig.pay, r.gig.tips], [30000, 4500]);
  eq('my cut is kept, in cents', r.gig.cut, 18000);
  eq('an empty band row is dropped and a name is trimmed', r.gig.band, [{ name: 'Sam', cents: 10000 }]);
  eq('merch keeps its quantity', r.gig.merch, [{ name: 'Tee', cents: 6000, qty: 3 }]);
  eq('every kind of time is present, unlogged ones as null', Object.keys(r.gig.min), TIME_KINDS.map(([k]) => k));
  eq('with the two that were typed', [r.gig.min.perform, r.gig.min.break, r.gig.min.travel], [120, 30, null]);
  eq('gear is lines, with no bullet stored', r.gig.gear, ['Taylor 314', 'Bose S1']);
  eq('the note is folded', r.gig.note, 'a fine night');
  ok('and stamped', r.gig.at > 0);
  eq('the stored record is the reply', (await readBiz(pia.artistId)).gigs[K], r.gig);
  eq('a nonsense cut is refused', (await P('bizSave', { key: K, gig: { cut: 'lots' } })).status, 400);
  eq('and a blank cut is blank, not nothing', (await P('bizSave', { key: K, gig: { pay: 1 } })).gig.cut, null);
  ok('(put back)', (await P('bizSave', { key: K, gig: r.gig })).ok);
  eq('a key that is not a night is refused', (await P('bizSave', { key: 'x y', gig: {} })).status, 400);
  ok('a showId is a key too', keyOk('2026-08-30-1855-ab1z') && keyOk('2026-08-30-1855') && !keyOk('hand-1'));
}

console.log('\nTHE PLAN SIZES THE BAND, AGAINST GROWTH');
{
  eq('Bar Star pays five', PLANS.plus.band, 5);
  const six = await P('bizSave', { key: K, gig: { band: band(6) } });
  eq('a sixth on Bar Star is a 402', six.status, 402);
  eq('naming both plans', six.error, `${PLANS.plus.label} allows ${PLANS.plus.band} band members a show — ${PLANS.pro.label} allows ${PLANS.pro.band}`);
  const sixC = await P('bizSave', { key: K, gig: { costs: costs(6) } });
  eq('and a sixth cost the same', sixC.status, 402);
  ok('in the same words', /allows 5 costs a show — Rock Star allows 10/.test(sixC.error || ''), sixC.error);
  ok('five is fine', (await P('bizSave', { key: K, gig: { band: band(5), costs: costs(5) } })).ok);

  await setPlan(pia.artistId, 'pro');
  const eleven = await P('bizSave', { key: K, gig: { band: band(11) } });
  eq('an eleventh on Rock Star is a 400', eleven.status, 400);
  eq('that says so', eleven.error, `That’s the ${PLANS.pro.band} ${PLANS.pro.label} allows`);
  ok('eight on Rock Star lands', (await P('bizSave', { key: K, gig: { band: band(8), costs: costs(8) } })).ok);

  /* THE GROWTH RULE. She goes back to Bar Star with eight on the record. */
  await setPlan(pia.artistId, 'plus');
  ok('the eight-strong record is still editable after the downgrade', (await P('bizSave', { key: K, gig: { band: band(8), pay: 1 } })).ok);
  eq('a ninth is refused', (await P('bizSave', { key: K, gig: { band: band(9) } })).status, 402);
  ok('and it can shrink', (await P('bizSave', { key: K, gig: { band: band(7) } })).ok);
  eq('after which the ceiling is the plan\'s again', (await P('bizSave', { key: K, gig: { band: band(8) } })).status, 402);
  ok('a fresh night on Bar Star is capped at five', (await P('bizSave', { key: 'gpia@2026-03-19', gig: { band: band(6) } })).status === 402);
}

console.log('\nCUT, NEVER REFUSED — AND WHAT IS REFUSED');
{
  const r = await P('bizSave', { key: K, gig: { band: [{ name: 'n'.repeat(100), cents: 1 }], note: 'x'.repeat(400),
    gear: Array.from({ length: 40 }, () => 'g'.repeat(100)), merch: Array.from({ length: 25 }, () => ({ name: 'm', qty: 1, cents: 1 })) } });
  ok('accepted', r.ok, r);
  eq('a name is cut', r.gig.band[0].name.length, LIMITS.name);
  eq('a note is cut', r.gig.note.length, LIMITS.note);
  eq('gear lines are cut', r.gig.gear[0].length, LIMITS.gearChars);
  eq('and counted', r.gig.gear.length, LIMITS.gear);
  eq('merch lines are counted', r.gig.merch.length, LIMITS.merch);
  for (const [what, gig] of [['a negative pay', { pay: -5 }], ['a pay that is a word', { pay: 'lots' }],
    ['a negative band amount', { band: [{ name: 'X', cents: -1 }] }], ['a cost past the ceiling', { costs: [{ name: 'X', cents: LIMITS.cents + 1 }] }],
    ['a time past 48 hours', { min: { perform: LIMITS.minutes + 1 } }], ['a negative time', { min: { travel: -1 } }],
    ['a merch quantity past the ceiling', { merch: [{ name: 'Tee', qty: LIMITS.qty + 1, cents: 1 }] }],
    ['a merch quantity of 1e300', { merch: [{ name: 'Tee', qty: 1e300, cents: 1 }] }]]) {
    eq(`${what} is a 400`, (await P('bizSave', { key: K, gig })).status, 400);
  }
  ok('the quantity refusal says quantity, not amount', /quantity/.test((await P('bizSave', { key: K, gig: { merch: [{ name: 'Tee', qty: 1e300, cents: 1 }] } })).error || ''));
  ok('and a quantity at the ceiling is fine', (await P('bizSave', { key: K, gig: { merch: [{ name: 'Tee', qty: LIMITS.qty, cents: 1 }], note: 'x'.repeat(400) } })).ok);
  eq('and none of that moved the record', (await readBiz(pia.artistId)).gigs[K].note, 'x'.repeat(LIMITS.note));
}

console.log('\nA RULE IS A GIG\'S, AND GOES WITH IT');
{
  eq('a rule for a gig that is not on the calendar is a 400', (await P('bizSave', { rule: 'nosuch', gig: { pay: 1 } })).status, 400);
  ok('a rule for the residency lands', (await P('bizSave', { rule: 'gpia', gig: { pay: 25000, min: { perform: 180 } } })).ok);
  eq('and is stored under the gig', (await readBiz(pia.artistId)).rules.gpia.pay, 25000);
  // an orphan planted by hand — a gig deleted before this code existed
  await mutateBiz(pia.artistId, (d) => { d.rules.ghost = { pay: 1 }; return true; });
  ok('a rule save prunes it', (await P('bizSave', { rule: 'gpia', gig: { pay: 26000 } })).ok);
  eq('the ghost is gone and the residency stays', Object.keys((await readBiz(pia.artistId)).rules), ['gpia']);
  ok('a second gig', (await P('eventSave', { event: { id: 'gtwo', venue: 'Bar Two', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: '2026-04-04', time: '21:00', endTime: '23:30' } })).ok);
  ok('with its own rule', (await P('bizSave', { rule: 'gtwo', gig: { pay: 15000 } })).ok);
  ok('deleting the gig', (await P('eventDelete', { id: 'gtwo' })).ok);
  eq('takes its rule with it', Object.keys((await readBiz(pia.artistId)).rules), ['gpia']);
  eq('and the night logged under the residency keeps its own numbers', (await readBiz(pia.artistId)).gigs[K].note, 'x'.repeat(LIMITS.note));
  /* An artist who never opened the dashboard has no book; deleting a gig must not
     write one just to prune nothing. */
  const nob = await createArtist({ email: 'nob@example.com', name: 'No Book', slug: 'no-book' });
  const TN = await signToken('nob@example.com', revOf(await readArtists(), nob.artistId));
  await setPlan(nob.artistId, 'plus');
  await A(TN)('eventSave', { event: { id: 'gn', venue: 'V', city: 'C', country: 'T', tz: 'UTC', date: '2026-05-05', time: '20:00', endTime: '22:00' } });
  ok('the gig is deleted', (await A(TN)('eventDelete', { id: 'gn' })).ok);
  eq('and no book was written for it', (await readDoc(KEY.biz(nob.artistId), null)).data, null);
}

console.log('\nA FULL BOOK SAYS SO');
{
  const big = await createArtist({ email: 'big@example.com', name: 'Big Book', slug: 'big-book' });
  const TB = await signToken('big@example.com', revOf(await readArtists(), big.artistId));
  await setPlan(big.artistId, 'plus');
  // written straight to the store, past the door that would have refused it
  await casDoc(KEY.biz(big.artistId), () => ({}), (d) => {
    Object.assign(d, { v: 1, at: 1, prefs: {}, rules: {}, gigs: { pad: { note: 'x'.repeat(BIZ_MAX_BYTES - 200) } } }); return true; });
  const r = await A(TB)('bizSave', { key: '2026-01-05-2100-ab12', gig: { pay: 1, note: 'y'.repeat(300) } });
  eq('the next save is refused', r.status, 400);
  eq('with the sentence that says what happens next', r.error, BIZ_FULL);
  eq('and nothing was written', Object.keys((await readBiz(big.artistId)).gigs), ['pad']);
  const m = await mutateBiz(big.artistId, (d) => { d.gigs.more = { note: 'z'.repeat(300) }; return true; });
  ok('mutateBiz reports it the same way', m.full === true && !m.ok, m);

  /* THE CAP IS ON GROWTH, NOT SIZE. A document somehow past the line must still
     let the artist REMOVE a record — that is the way out — and a write that grows
     it is what is refused. And bizPrefs must not answer ok for a write the book
     refused: the page would show a toggle the book does not hold. */
  await casDoc(KEY.biz(big.artistId), () => ({}), (d) => {
    d.gigs = { pad: { note: 'x'.repeat(BIZ_MAX_BYTES + 100) }, '2026-01-07-2100-gone': { pay: 1 } }; d.prefs = { hours: { perform: true, break: true, travel: true, setup: true } }; return true; });
  const over = Buffer.byteLength(JSON.stringify((await readDoc(KEY.biz(big.artistId), null)).data));
  ok('the book is over the cap', over > BIZ_MAX_BYTES, over);
  const rm = await A(TB)('bizSave', { key: '2026-01-07-2100-gone', remove: true });
  ok('a remove on it still lands — the cap never deletes, and never traps', rm.ok && rm.gig === null, rm);
  ok('and the record is gone', !('2026-01-07-2100-gone' in (await readBiz(big.artistId)).gigs));
  const grow = await A(TB)('bizSave', { key: '2026-01-06-2100-ab13', gig: { pay: 1 } });
  eq('while adding to it is still refused', [grow.status, grow.error], [400, BIZ_FULL]);
  const pr = await A(TB)('bizPrefs', { hours: { travel: false } });     // true → false is one byte more
  eq('a pref the book could not hold is not answered ok', [pr.status, pr.error], [400, BIZ_FULL]);
  eq('and the stored pref is untouched', (await readBiz(big.artistId)).prefs.hours.travel, true);
}

console.log('\nWHAT bizGet SHIPS');
{
  for (const k of ['gpia@2026-02-27', 'gpia@2026-02-28', 'gpia@2026-03-15', 'gpia@2026-04-01', 'gpia@2026-04-02'])
    ok(`a record at ${k}`, (await P('bizSave', { key: k, gig: { pay: 100 } })).ok);
  ok('and one under a showId', (await P('bizSave', { key: '2026-01-05-2100-ab12', gig: { pay: 200 } })).ok);
  const d = await P('bizGet', { from: '2026-03-01', to: '2026-03-31' });
  ok('the window comes back', d.ok && d.from === '2026-03-01' && d.to === '2026-03-31', d);
  eq('records within a day of the window ship, the rest do not, and a showId always does',
    Object.keys(d.biz.gigs).sort(), ['2026-01-05-2100-ab12', 'gpia@2026-02-28', 'gpia@2026-03-12', 'gpia@2026-03-15', 'gpia@2026-04-01']);
  eq('the calendar is expanded on the server (INVARIANT 12b)', d.occ.map((o) => o.date), ['2026-03-05', '2026-03-12', '2026-03-19', '2026-03-26']);
  eq('to the fields the page needs and no more', Object.keys(d.occ[0]).sort(),
    ['city', 'date', 'endsAt', 'eventId', 'repeating', 'startsAt', 'title', 'tz', 'venue']);
  eq('the rules ride along', Object.keys(d.biz.rules), ['gpia']);
  eq('the plan\'s two sizes', d.limits, { band: PLANS.plus.band, costs: PLANS.plus.costs });
  eq('the cut, as a percentage', d.cutPct, PLANS.plus.cut * 100);
  eq('the name off the registry', d.name, 'Pia Lark');
  ok('no nights unless asked', !('nights' in d) && d.dropped === null, { nights: d.nights, dropped: d.dropped });
  const dflt = await P('bizGet');
  eq('the window defaults to today', dflt.to, new Date().toISOString().slice(0, 10));
  ok('and a year back', dflt.from < dflt.to && dflt.from.slice(0, 4) === String(+dflt.to.slice(0, 4) - 1), dflt.from);
  eq('a window inside out is refused', (await P('bizGet', { from: '2026-04-01', to: '2026-03-01' })).status, 400);

  /* The report page asks for the nights too — with the key and the source the
     archive stamps on them (D4). */
  const filed = await archiveShow(pia.artistId, { showId: '2026-03-12-2005-q1w2', venue: 'The Corner', city: '', startedAt: Date.parse('2026-03-12T20:05:00Z'),
    autoKey: K, songs: [{ id: 's1', title: 'One' }], log: [{ songId: 's1', title: 'One', votes: 2, roundVotes: 2, voters: 2, round: [], at: Date.parse('2026-03-12T20:10:00Z') }],
    nowPlaying: null, archiveTitle: 'Thursday' }, {});
  ok('a night is filed', filed && filed.indexed, filed);
  const n = await P('bizGet', { from: '2026-03-01', to: '2026-03-31', nights: true });
  eq('nights come with nights:true', (n.nights || []).map((x) => x.showId), ['2026-03-12-2005-q1w2']);
  eq('each with the gig it was', n.nights[0].key, K);
  eq('and whether its money is known', n.nights[0].source, 'off');
  eq('and the index\'s own overflow count', n.dropped, 0);
}

console.log('\nREMOVING, AND THE HOURS');
{
  const r = await P('bizSave', { key: 'gpia@2026-02-27', remove: true });
  ok('a record can be removed', r.ok && r.gig === null, r);
  ok('and is gone', !('gpia@2026-02-27' in (await readBiz(pia.artistId)).gigs));
  ok('removing a rule too', (await P('bizSave', { rule: 'gpia', remove: true })).ok);
  eq('leaves none', Object.keys((await readBiz(pia.artistId)).rules), []);
  eq('every kind counts by default', (await P('bizGet')).biz.prefs.hours, { perform: true, break: true, travel: true, setup: true });
  const p = await P('bizPrefs', { hours: { travel: false } });
  eq('a kind can be switched out of $/hour, the rest untouched', p.prefs.hours, { perform: true, break: true, travel: false, setup: true });
  eq('and it sticks', (await P('bizGet')).biz.prefs.hours.travel, false);
  eq('and comes back', (await P('bizPrefs', { hours: { travel: true } })).prefs.hours.travel, true);
  eq('a kind that is not a kind is ignored', Object.keys((await P('bizPrefs', { hours: { nap: true } })).prefs.hours), TIME_KINDS.map(([k]) => k));
}

console.log('\nA NIGHT PRE-FILLED FROM A RULE LEANS ON THE RULE  (the growth rule, INVARIANT 0s)');
{
  /* Eight band members written on the gig form on Rock Star; then a downgrade.
     The editor pre-fills the night from the rule, so "Log it" shows eight rows and
     a Save button — the first save of that night must land with eight, and only a
     ninth is refused. Measured against nothing, it was a 402 that made her delete
     three band mates to log a night she had already planned. */
  await setPlan(pia.artistId, 'pro');
  ok('a rule of eight on Rock Star', (await P('bizSave', { rule: 'gpia', gig: { pay: 25000, band: band(8), costs: costs(8) } })).ok);
  await setPlan(pia.artistId, 'plus');
  const first = await P('bizSave', { key: 'gpia@2026-03-26', gig: { pay: 25000, band: band(8), costs: costs(8) } });
  ok('the first save of a night under it lands with eight after the downgrade', first.ok, first);
  eq('a ninth is refused', (await P('bizSave', { key: 'gpia@2026-03-26', gig: { band: band(9) } })).status, 402);
  eq('a night that is not under that rule gets the plan\'s cap', (await P('bizSave', { key: '2026-03-27-2100-zz99', gig: { band: band(8) } })).status, 402);
  eq('and so does a showId-keyed night with no gig to lean on', (await P('bizSave', { key: '2026-03-27-2100-zz98', gig: { costs: costs(6) } })).status, 402);
}

console.log('\nTHE RECORD FOLLOWS A MOVED GIG');
{
  /* A one-off gig on the 6th, the night logged, then the gig is moved to the 7th
     on the Gigs tab. The record is keyed by occurrence, so it stayed under a day
     the calendar no longer had: kept on disk, listed and totalled nowhere. */
  ok('a one-off gig', (await P('eventSave', { event: { id: 'gmove', venue: 'The Dock', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: '2026-05-06', time: '20:00', endTime: '22:00' } })).ok);
  ok('the night is logged', (await P('bizSave', { key: 'gmove@2026-05-06', gig: { pay: 30000 } })).ok);
  ok('the gig moves a day', (await P('eventSave', { event: { id: 'gmove', venue: 'The Dock', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: '2026-05-07', time: '20:00', endTime: '22:00' } })).ok);
  const d = await P('bizGet', { from: '2026-05-01', to: '2026-05-31' });
  eq('and the record is under the new day', (d.biz.gigs['gmove@2026-05-07'] || {}).pay, 30000);
  ok('not the old one', !('gmove@2026-05-06' in d.biz.gigs));
  eq('where the calendar now puts the gig', d.occ.filter((o) => o.eventId === 'gmove').map((o) => o.date), ['2026-05-07']);
  /* A record already under the new day wins — the artist typed that one last. */
  ok('a record on the 8th', (await P('bizSave', { key: 'gmove@2026-05-08', gig: { pay: 100 } })).ok);
  ok('the gig moves onto it', (await P('eventSave', { event: { id: 'gmove', venue: 'The Dock', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: '2026-05-08', time: '20:00', endTime: '22:00' } })).ok);
  const g = (await readBiz(pia.artistId)).gigs;
  eq('the 8th keeps its own numbers', g['gmove@2026-05-08'].pay, 100);
  eq('and the 7th stays where it was rather than overwrite them', (g['gmove@2026-05-07'] || {}).pay, 30000);
  /* A run is not re-keyed: its dates are many and the rule covers them. */
  ok('the residency\'s anchor moves a day', (await P('eventSave', { event: { id: 'gpia', venue: 'The Corner', city: 'Koh Phangan',
    country: 'Thailand', tz: 'UTC', date: '2026-03-06', time: '20:00', endTime: '23:00', repeat: { freq: 'weekly' } } })).ok);
  ok('and the night logged under it is still under its own date', 'gpia@2026-03-12' in (await readBiz(pia.artistId)).gigs);
  /* An artist with no book costs no write when a gig moves. */
  const nb = await createArtist({ email: 'nb2@example.com', name: 'No Book Two', slug: 'no-book-two' });
  const TN2 = await signToken('nb2@example.com', revOf(await readArtists(), nb.artistId));
  await setPlan(nb.artistId, 'plus');
  await A(TN2)('eventSave', { event: { id: 'gn2', venue: 'V', city: 'C', country: 'T', tz: 'UTC', date: '2026-05-05', time: '20:00', endTime: '22:00' } });
  await A(TN2)('eventSave', { event: { id: 'gn2', venue: 'V', city: 'C', country: 'T', tz: 'UTC', date: '2026-05-06', time: '20:00', endTime: '22:00' } });
  eq('no book was written for the move', (await readDoc(KEY.biz(nb.artistId), null)).data, null);
}

console.log('\nTHE FOUNDER\'S CUT, AND THE WAY OUT');
{
  const { DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
  await mutateArtists((r) => {
    r.byEmail['founder-biz@example.com'] = { artistId: DEFAULT_ARTIST, role: 'owner' };
    r.byId[DEFAULT_ARTIST] ||= { slug: DEFAULT_ARTIST, name: 'Perry', createdAt: 1 };
    return true; });
  const TF2 = await signToken('founder-biz@example.com', revOf(await readArtists(), DEFAULT_ARTIST));
  const fd = await A(TF2)('bizGet');
  /* His registry row reads as free, whose cut is 25% — but his fee is 0 (feeCents
     in _connect.mjs), so the hero must not say "before MySet's 25%" over money
     that carried no cut. His caps are the top plan's, as everywhere. */
  eq('the founder\'s cut is 0, not the free row\'s', [fd.ok, fd.cutPct], [true, 0]);
  eq('with the top plan\'s caps', fd.limits, { band: PLANS.pro.band, costs: PLANS.pro.costs });
}

console.log('\nTHE BOOK LEAVES WITH THE ARTIST, AND LEAVES NOTHING BEHIND');
{
  const ex = await exportArtist(pia.artistId);
  eq('the export carries the record', ex.business.gigs[K], (await readBiz(pia.artistId)).gigs[K]);
  eq('and the hours', ex.business.prefs.hours.travel, true);
  ok('she asks to leave', (await P('accountDelete', { confirm: 'DELETE' })).ok);
  /* Thirty days to take her records with her — the printed report is the shape an
     accountant wants, and it reads the book. Read-only: nothing else still runs. */
  ok('in the deletion window she can still read her book', (await P('bizGet')).ok);
  eq('but not write it', (await P('bizSave', { key: K, gig: { pay: 1 } })).status, 423);
  eq('nor the hours', (await P('bizPrefs', { hours: { travel: false } })).status, 423);
  ok('and thirty-one days later is purged', (await purgeDue(Date.now() + 31 * 86400e3)).purged.includes(pia.artistId));
  const left = [...__dump().keys()].filter((k) => k.includes(pia.artistId));
  eq('no key anywhere still carries her id — keysFor() knows the book', left.join(','), '');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
