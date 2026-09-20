/* THE BUSINESS DASHBOARD'S MATHS  (public/biz.js, decision 0065)

   The tab, the editor and the printed report all read one profit figure, one
   hourly rate and one join between filed nights and calendar gigs, from this
   file. So the pins are on the rules, not the pixels:
     · profit is (pay − band) + cash tips + merch + app − costs, in cents
     · app money that Stripe could not confirm is UNKNOWN (null), never $0
     · $/hour is over the shows that have hours, not every show
     · a bare number typed into an hours box is hours; "90" is refused
     · a night finds its gig by key first, by the 30-minute window second
     · a past calendar slot with nothing logged is listed but not counted
     · the caps and the grace this file carries equal the server's */

import { readFileSync, existsSync } from 'node:fs';
const { createRequire } = await import('node:module');
const require = createRequire(import.meta.url);
const Biz = require('../public/biz.js');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  ok(name, a === b, { got, want });
};

const H = 3600000;
/* Local-noon instants, so the calendar dates below hold in any timezone the
   suite happens to run in. */
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 9, 13, 12);
const gig = (o = {}) => Object.assign(Biz.empty(), o);

console.log('\ncalc(): one show\'s numbers');
{
  const g = gig({ pay: 30000, band: [{ name: 'Sam', cents: 10000 }, { name: 'Jo', cents: 5000 }], tips: 4500,
    merch: [{ name: 'T-shirt', qty: 3, cents: 6000 }], costs: [{ name: 'Parking', cents: 1200 }],
    min: { perform: 120, break: 30, travel: 60, setup: 30 } });
  const c = Biz.calc(g, 8000);
  eq('take is pay less the band', c.take, 15000);
  eq('revenue = pay + tips + merch + app', c.revenue, 48500);
  eq('profit = (pay − band) + tips + merch + app − costs', c.profit, 32300);
  eq('all four kinds count by default', c.includedMinutes, 240);
  eq('$/hour is profit over the included hours, in cents', c.rate, 8075);
  ok('the show is timed', c.timed === true);
  const off = Biz.calc(g, 8000, { hours: { perform: true, break: false, travel: false, setup: false } });
  eq('toggles narrow the hours', off.includedMinutes, 120);
  eq('and lift the rate', off.rate, 16150);
  const none = Biz.calc(gig({ pay: 20000 }), 0);
  eq('rate is null with no minutes, not Infinity', none.rate, null);
  ok('and the show is not timed', none.timed === false);
  eq('no band: the take is the pay', Biz.calc(gig({ pay: 20000 }), 0).take, 20000);
  const neg = Biz.calc(gig({ pay: 5000, costs: [{ name: 'Fuel', cents: 9000 }] }), 0);
  eq('a losing night is negative, not clamped', neg.profit, -4000);
  const unk = Biz.calc(g, null);
  eq('app money not available → appKnown false', unk.appKnown, false);
  eq('and app is null, not 0', unk.app, null);
  eq('and it is left out of profit rather than counted as nothing', unk.profit, 24300);
  eq('an empty gig is all nulls and empties', Biz.empty(), { pay: null, band: [], cut: null, tips: null, tipsCut: null, merch: [], costs: [],
    min: { perform: null, break: null, travel: null, setup: null }, gear: [], note: '', at: null });
  /* The fee is MySet's cut of the app money at the plan's percentage — the one
     fee this file can name. My cut is what was typed, else what is left. */
  const f = Biz.calc(g, 8000, null, 10);
  eq('the fee is 10% of the app money, rounded to a cent', f.fee, 800);
  eq('no fee percentage: no fee', Biz.calc(g, 8000).fee, 0);
  eq('app money unknown: no fee either', Biz.calc(g, null, null, 10).fee, 0);
  eq('my cut, blank, is what is left after the splits and the costs — the profit', f.cut, 32300);
  eq('my cut, typed, is what was typed', Biz.calc(gig({ pay: 30000, cut: 12000 }), 0).cut, 12000);
  eq('and norm keeps it in cents', Biz.norm({ cut: '12000' }).cut, 12000);
  /* The tips are shared on their own (2026-09-20): cash + in-app, and the artist's
     share of them typed as My cut of tips or, blank, all of them. */
  const t3 = Biz.calc(gig({ pay: 30000, band: [{ name: 'Ball', cents: 10000 }, { name: 'Art', cents: 10000 }], tips: 4500, tipsCut: 2500 }), 3000, null, 0, 3000);
  eq('tipsAll is cash tips plus the in-app tips', t3.tipsAll, 7500);
  eq('tipsMine is what was typed', t3.tipsMine, 2500);
  eq('profit is the act\u2019s whole night, tips included once', t3.profit, 30000 - 20000 + 4500 + 3000);
  eq('my cut, blank, is what is left minus the tips, plus my share of them', t3.cut, 30000 - 20000 + 2500);
  eq('my cut, typed, is that plus my share of the tips', Biz.calc(gig({ pay: 30000, tips: 4500, tipsCut: 1500 }), 0).cut, 31500);
  eq('my cut of tips, blank, is all of them', Biz.calc(gig({ pay: 30000, tips: 4500 }), 0, null, 0, 3000).tipsMine, 7500);
  eq('and then my cut is the profit, as before', Biz.calc(gig({ pay: 30000, tips: 4500 }), 3000, null, 0, 3000).cut, 37500);
  eq('in-app tips unknown count as none', Biz.calc(gig({ tips: 4500 }), null).tipsAll, 4500);
  eq('norm keeps tipsCut in cents', Biz.norm({ tipsCut: '1500' }).tipsCut, 1500);
  eq('rate() is null over no minutes', Biz.rate(1000, 0), null);
  /* The four readings, from the timed totals. */
  const T = { profit: 32300, cut: 12000, fee: 800, included: 240, perform: 120 };
  eq('total, before fees', Biz.rates(T, {}), { evening: 8075, stage: 16150 });
  eq('total, after fees', Biz.rates(T, { net: true }), { evening: 7875, stage: 15750 });
  eq('my cut, before fees', Biz.rates(T, { mine: true }), { evening: 3000, stage: 6000 });
  eq('my cut, after fees', Biz.rates(T, { mine: true, net: true }), { evening: 2800, stage: 5600 });
}

console.log('\nmoney(), hm(), parseHm(), bullets');
{
  eq('two decimals and a thousands separator', Biz.money(123450), '$1,234.50');
  eq('negative', Biz.money(-1200), '-$12.00');
  eq('zero', Biz.money(0), '$0.00');
  eq('a million', Biz.money(100000000), '$1,000,000.00');
  eq('null reads as nothing owed', Biz.money(null), '$0.00');
  // the book's currency (2026-09-17): a symbol in front, never a conversion
  eq('a chosen currency answers its code', Biz.currency('thb'), 'THB');
  eq('and its symbol', Biz.money(123450), '฿1,234.50');
  eq('negative keeps the symbol after the sign', Biz.money(-1200), '-฿12.00');
  eq('an unknown code falls back to dollars', [Biz.currency('XXX'), Biz.money(100)], ['USD', '$1.00']);
  eq('nothing chosen is dollars', [Biz.currency(''), Biz.money(100)], ['USD', '$1.00']);
  eq('hm 135', Biz.hm(135), '2h 15m');
  eq('hm 45', Biz.hm(45), '45m');
  eq('hm 180', Biz.hm(180), '3h');
  eq('hm null', Biz.hm(null), '');
  const table = [['2:15', 135], ['3', 180], ['1.5', 90], ['.75', 45], ['3h', 180], ['3h 20m', 200], ['45m', 45],
    ['2h15m', 135], ['48', 2880], ['', null], ['  ', null]];
  for (const [s, want] of table) eq(`parseHm(${JSON.stringify(s)}) → ${want}`, Biz.parseHm(s), want);
  ok('a bare number over 48 is refused (minutes typed into an hours box)', Number.isNaN(Biz.parseHm('90')));
  ok('nonsense is refused', Number.isNaN(Biz.parseHm('two hours')));
  ok('a minute field over 59 is refused', Number.isNaN(Biz.parseHm('1:75')));
  eq('parseHms: both blank is blank', Biz.parseHms('', ''), null);
  eq('parseHms: 2 h 15 min', Biz.parseHms('2', '15'), 135);
  eq('parseHms: minutes alone', Biz.parseHms('', '45'), 45);
  eq('parseHms: 90 minutes is 90, rolled by the page not the parser', Biz.parseHms('', '90'), 90);
  ok('parseHms: a decimal is refused (the boxes are whole numbers)', Number.isNaN(Biz.parseHms('1.5', '')));
  ok('parseHms: letters are refused', Number.isNaN(Biz.parseHms('two', '')));
  ok('parseHms: past the cap is refused', Number.isNaN(Biz.parseHms('999', '0')));
  ok('anything past the 48-hour cap is refused', Number.isNaN(Biz.parseHm('49h')));
  const gear = ['Taylor 314', 'Bose S1'];
  eq('bullets out', Biz.bullets.toText(gear), '• Taylor 314\n• Bose S1');
  eq('bullets round-trip', Biz.bullets.fromText(Biz.bullets.toText(gear)), gear);
  eq('pasted dashes and blank lines are absorbed', Biz.bullets.fromText('- a\n\n* b\n  • c  '), ['a', 'b', 'c']);
}

console.log('\nnorm(): the client-side shape-up');
{
  const n = Biz.norm({ pay: '300', band: [{ name: '  Sam ', cents: 100 }, { name: '', cents: 0 }], tips: -5, merch: [{ name: 'Cap', qty: '2', cents: 4000 }],
    min: { perform: 5000, break: '', travel: 'x' }, gear: '• Taylor\n• Bose', note: 'n'.repeat(400) });
  eq('pay is an integer', n.pay, 300);
  eq('an empty band row is dropped and names are trimmed', n.band, [{ name: 'Sam', cents: 100 }]);
  eq('a blank cents field on a kept row is zero, not null', Biz.norm({ band: [{ name: 'Al', cents: '' }] }).band, [{ name: 'Al', cents: 0 }]);
  eq('negative money clamps to zero', n.tips, 0);
  eq('merch qty is a number', n.merch, [{ name: 'Cap', cents: 4000, qty: 2 }]);
  eq('merch qty is capped, like every other number in the record (1e300 is not a quantity)',
    Biz.norm({ merch: [{ name: 'Cap', qty: 1e300, cents: 1 }, { name: 'Pin', qty: 'x', cents: 1 }] }).merch.map((r) => r.qty), [Biz.LIMITS.qty, 0]);
  eq('minutes clamp to the cap; blank and junk are null; a missing kind is null',
    n.min, { perform: 2880, break: null, travel: null, setup: null });
  eq('gear typed as bullets is stored as lines', n.gear, ['Taylor', 'Bose']);
  eq('a note is cut at the cap', n.note.length, Biz.LIMITS.note);
  eq('twenty-one merch lines become twenty', Biz.norm({ merch: Array(21).fill({ name: 'x', cents: 1 }) }).merch.length, 20);
  eq('thirty-one gear lines become thirty', Biz.norm({ gear: Array(31).fill('g') }).gear.length, 30);
  eq('a gear line is cut at its width', Biz.norm({ gear: ['g'.repeat(100)] }).gear[0].length, 80);
}

console.log('\njoin(): filed nights meet the calendar');
const occ = (eventId, y, m, d, h, extra = {}) => ({ eventId, date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
  startsAt: at(y, m, d, h), endsAt: at(y, m, d, h) + 3 * H, title: '', venue: 'The Bar', city: 'Ojai', tz: 'America/Los_Angeles', repeating: true, ...extra });
const night = (showId, startedAt, extra = {}) => ({ showId, title: '', venue: 'Somewhere', city: '', startedAt, endedAt: startedAt + 2 * H,
  songsPlayed: 10, totalVotes: 40, peakVoters: 12, gross: 12.5, key: null, source: 'stripe', ...extra });
{
  const o1 = occ('ev1', 2026, 9, 5, 20), o2 = occ('ev1', 2026, 9, 12, 20), fut = occ('ev1', 2026, 9, 19, 20);
  const nights = [
    night('n-key', at(2026, 9, 5, 15), { key: 'ev1@2026-09-05' }),          // by key, though its clock is off
    night('n-win', at(2026, 9, 12, 20) - 20 * 60000),                       // 20 min before the start: inside the grace
    night('n-win2', at(2026, 9, 12, 22), { gross: 2.25, totalVotes: 5, peakVoters: 30 }),  // a restart, same gig
    night('n-orphan', at(2026, 8, 30, 21), { venue: 'A wedding' }),           // no gig anywhere near
  ];
  const biz = { gigs: { 'ev1@2026-09-05': gig({ pay: 30000 }) }, rules: { ev1: gig({ pay: 25000 }) } };
  const shows = Biz.join(nights, [o1, o2, fut], biz, NOW);
  eq('newest first, the future slot dropped', shows.map((s) => s.key), ['ev1@2026-09-12', 'ev1@2026-09-05', 'n-orphan']);
  const [s12, s5, orphan] = shows;
  eq('a night with a key lands on its gig whatever its clock says', s5.nights.map((n) => n.showId), ['n-key']);
  eq('a keyless night lands on the gig running when it started (30-min grace)', s12.nights.map((n) => n.showId), ['n-win', 'n-win2']);
  eq('two nights on one gig: app money summed, dollars to cents', s12.app, 1475);
  eq('votes summed', s12.votes, 45);
  eq('peak is the max', s12.peak, 30);
  eq('a record wins over the rule', [s5.source, s5.gig.pay], ['gig', 30000]);
  eq('no record: the run\'s rule stands in', [s12.source, s12.gig.pay, s12.rule.pay], ['rule', 25000, 25000]);
  eq('the orphan is keyed by its showId, dated on the phone', [orphan.key, orphan.date, orphan.venue, orphan.source], ['n-orphan', '2026-08-30', 'A wedding', 'none']);
  eq('the orphan carries its own money', [orphan.app, orphan.appKnown], [1250, true]);
  ok('every show with a night or a record is counted', shows.every((s) => s.counted));

  const late = night('n-late', at(2026, 9, 12, 20) - 31 * 60000);
  const j2 = Biz.join([late], [o2], null, NOW);
  eq('31 minutes early is outside the grace: an orphan', j2.map((s) => s.key), ['ev1@2026-09-12', 'n-late']);
  const [rule12, orphan2] = j2;
  eq('a rule-only past slot is listed…', [rule12.source, rule12.nights.length], ['none', 0]);
  eq('…and NOT counted: an unplayed gig is not income', rule12.counted, false);
  eq('an orphan with no record and no rule is still counted — MySet was there', orphan2.counted, true);
  eq('no biz document at all is fine', Biz.join([], [o1], undefined, NOW).length, 1);

  const oA = occ('evA', 2026, 9, 12, 20), oB = occ('evB', 2026, 9, 12, 21, { venue: 'Other' });
  const first = Biz.join([night('n', at(2026, 9, 12, 21, 30))], [oB, oA], null, NOW).find((s) => s.nights.length);
  eq('two gigs running: the FIRST in startsAt order takes the night, like placeShows', first.key, 'evA@2026-09-12');

  const bad = night('n-bad', at(2026, 9, 12, 20), { source: 'stripe-unreachable', gross: 0 });
  const good = night('n-good', at(2026, 9, 12, 22), { gross: 9 });
  const s = Biz.join([good, bad], [o2], null, NOW)[0];
  eq('a stripe-unreachable night makes the gig\'s app money unknown, not smaller', [s.app, s.appKnown], [null, false]);
  eq('the night is still attached and counted', [s.nights.length, s.counted], [2, true]);
  eq('an "off" night likewise', Biz.join([night('n', at(2026, 9, 12, 20), { source: 'off' })], [o2], null, NOW)[0].app, null);
  eq('a night with no time at all is not a night', Biz.join([night('n', 0, { endedAt: 0 })], [], null, NOW).length, 0);
}

console.log('\njoin(): a record is found under every key its show has ever had');
{
  /* (a) A night MySet ran with no gig on the calendar is logged under its showId.
     The artist then adds the gig for that past date, or "Name these from my
     calendar" stamps the night with the occurrence key. The $300 must not vanish. */
  const o = occ('ev1', 2026, 9, 10, 20);
  const rec = gig({ pay: 30000 });
  const stamped = night('2026-09-10-2000-aaaa', at(2026, 9, 10, 20), { key: 'ev1@2026-09-10' });
  const before = Biz.join([night('2026-09-10-2000-aaaa', at(2026, 9, 10, 20))], [], { gigs: { '2026-09-10-2000-aaaa': rec } }, NOW);
  eq('logged under the showId, before any gig existed', [before.length, before[0].key, before[0].bizKey, before[0].source, (before[0].gig || {}).pay],
    [1, '2026-09-10-2000-aaaa', '2026-09-10-2000-aaaa', 'gig', 30000]);
  const after = Biz.join([stamped], [o], { gigs: { '2026-09-10-2000-aaaa': rec } }, NOW);
  eq('the record survives the night being stamped with a key', [after.length, after[0].source, (after[0].gig || {}).pay], [1, 'gig', 30000]);
  /* (c) The show is keyed by the occurrence; the record stays where it was saved. */
  eq('the show keeps the occurrence key while bizKey names where the record lives', [after[0].key, after[0].bizKey],
    ['ev1@2026-09-10', '2026-09-10-2000-aaaa']);
  eq('a show whose record is under its own key has bizKey = key', Biz.join([], [o], { gigs: { 'ev1@2026-09-10': rec } }, NOW)[0].bizKey, 'ev1@2026-09-10');
  eq('a show with no record at all has bizKey = key, so the editor saves under it', Biz.join([], [o], null, NOW)[0].bizKey, 'ev1@2026-09-10');
  /* (d) The same record reachable two ways — under the showId and by the stamped key — is one show, summed once. */
  const twoWays = Biz.join([stamped], [o], { gigs: { '2026-09-10-2000-aaaa': rec } }, NOW);
  eq('reachable two ways: one show, the sum unchanged', [twoWays.length, Biz.sum(twoWays, null).profit, Biz.sum(twoWays, null).shows], [1, 31250, 1]);
  const viaNightKey = Biz.join([stamped], [], { gigs: { 'ev1@2026-09-10': rec } }, NOW);
  eq('an orphan night whose stamped key names a record is keyed by that key', [viaNightKey[0].key, viaNightKey[0].bizKey, (viaNightKey[0].gig || {}).pay],
    ['ev1@2026-09-10', 'ev1@2026-09-10', 30000]);
  const restart = night('2026-09-10-2200-bbbb', at(2026, 9, 10, 22), { key: 'ev1@2026-09-10', gross: 2 });
  eq('a restart with the same stamped key lands on the same show', Biz.join([stamped, restart], [], { gigs: { 'ev1@2026-09-10': rec } }, NOW).map((s) => s.nights.length), [2]);

  /* (b) The gig was deleted, or its date edited, or the night was never filed: the
     record has nothing to join. It is listed as its own show, dated from its key,
     and COUNTED — a figure the artist wrote down is never dropped from a total. */
  const gone = Biz.join([], [], { gigs: { 'evgone@2026-09-03': gig({ pay: 5000, costs: [{ name: 'Fuel', cents: 1000 }] }) } }, NOW);
  eq('a record under a deleted gig\'s key is listed', gone.map((s) => [s.key, s.bizKey, s.date, s.title, s.venue, s.source, s.orphanRecord]),
    [['evgone@2026-09-03', 'evgone@2026-09-03', '2026-09-03', 'Logged show', '', 'gig', true]]);
  eq('…dated at local noon so it sorts among that day\'s shows', (gone[0] || {}).startsAt, at(2026, 9, 3, 12));
  eq('…with no night behind it: app unknown, nothing through the app', gone[0] && [gone[0].app, gone[0].appKnown, gone[0].nights, gone[0].occ], [null, false, [], null]);
  eq('…and counted', [(gone[0] || {}).counted, Biz.sum(gone, null).profit, Biz.sum(gone, null).logged], [true, 4000, 1]);
  const moved = Biz.join([], [occ('ev1', 2026, 9, 4, 20)], { gigs: { 'ev1@2026-09-03': gig({ pay: 30000 }) } }, NOW);
  eq('a gig moved a day: the record still counts and the moved slot is listed, not counted',
    moved.map((s) => [s.key, s.counted, s.title]), [['ev1@2026-09-04', false, ''], ['ev1@2026-09-03', true, 'Logged show']]);
  eq('the moved case sums to the $300', Biz.sum(moved, null).profit, 30000);
  const byShowId = Biz.join([], [], { gigs: { '2026-08-30-2100-zzzz': gig({ pay: 100 }) } }, NOW)[0] || {};
  eq('a showId-keyed record with its night gone is dated from the showId', [byShowId.date, byShowId.startsAt], ['2026-08-30', at(2026, 8, 30, 12)]);
  ok('an orphan record is in range for its day', Biz.inRange(byShowId, '2026-08-30', '2026-08-30'));
}

console.log('\nvotesLine(): what the room paid for');
{
  const o = occ('ev9', 2026, 9, 1, 20);
  const known = Biz.join([night('k1', at(2026, 9, 1, 20), { totalVotes: 63, paidVotes: 23, paidRequests: 2 })], [o], {}, NOW)[0];
  eq('free votes are the tally less the bought ones', [known.votes, known.freeVotes, known.paidVotes, known.paidRequests], [63, 40, 23, 2]);
  eq('in words', Biz.votesLine(known), '63 votes · 40 free · 23 paid · 2 paid requests');
  const old = Biz.join([night('k2', at(2026, 9, 1, 20), { totalVotes: 9 })], [o], {}, NOW)[0];
  eq('a night filed before the counts existed reads unknown, never zero', [old.freeVotes, old.paidVotes, old.paidRequests], [null, null, null]);
  eq('and says only the tally', Biz.votesLine(old), '9 votes');
  const two = Biz.join([night('k3', at(2026, 9, 1, 20), { totalVotes: 5, paidVotes: 5, paidRequests: 0 }), night('k4', at(2026, 9, 1, 21), { totalVotes: 4 })], [o], {}, NOW)[0];
  eq('two nights on one gig: unknown if either is', [two.nights.length, two.paidVotes], [2, null]);
  eq('bought more than were cast: free votes floor at zero', Biz.join([night('k5', at(2026, 9, 1, 20), { totalVotes: 3, paidVotes: 8, paidRequests: 1 })], [o], {}, NOW)[0].freeVotes, 0);
  eq('the report row carries the three', (({ freeVotes, paidVotes, paidRequests }) => [freeVotes, paidVotes, paidRequests])(Biz.sum([known], null).byShow[0]), [40, 23, 2]);
}

console.log('\nthe tips alone: "$x from in-app tips" (2026-09-17)');
{
  const o = occ('ev10', 2026, 9, 1, 20);
  const t1 = Biz.join([night('t1', at(2026, 9, 1, 20), { gross: 12.5, tipped: 7.25 })], [o], {}, NOW)[0];
  eq('a night that says its tips carries them in cents', t1.tipsApp, 725);
  const t0 = Biz.join([night('t2', at(2026, 9, 1, 20), { gross: 12.5 })], [o], {}, NOW)[0];
  eq('a night filed before `tipped` existed reads unknown, never zero', t0.tipsApp, null);
  const two = Biz.join([night('t3', at(2026, 9, 1, 20), { gross: 5, tipped: 2 }), night('t4', at(2026, 9, 1, 21), { gross: 5, tipped: 3 })], [o], {}, NOW)[0];
  eq('two nights on one gig add up', two.tipsApp, 500);
  const mixed = Biz.join([night('t5', at(2026, 9, 1, 20), { gross: 5, tipped: 2 }), night('t6', at(2026, 9, 1, 21), { gross: 5 })], [o], {}, NOW)[0];
  eq('unknown if either night is', mixed.tipsApp, null);
  const S = Biz.sum([t1, t0], null);
  eq('the period sums only the nights that know, and counts them', [S.tipsApp, S.tipsAppKnown], [725, 1]);
  eq('an orphan record has no tips to speak of', (Biz.join([], [], { gigs: { '2026-08-30-2100-zzzz': gig({ pay: 100 }) } }, NOW)[0] || {}).tipsApp, null);
}

console.log('\nkey(), parseKey(), inRange()');
{
  eq('key', Biz.key('ev1', '2026-09-12'), 'ev1@2026-09-12');
  eq('parseKey', Biz.parseKey('ev1@2026-09-12'), { eventId: 'ev1', date: '2026-09-12' });
  eq('a showId is not an occurrence key', Biz.parseKey('n-orphan'), null);
  ok('inRange is inclusive on both ends', Biz.inRange({ date: '2026-09-01' }, '2026-09-01', '2026-09-30') && Biz.inRange({ date: '2026-09-30' }, '2026-09-01', '2026-09-30'));
  ok('and excludes outside', !Biz.inRange({ date: '2026-10-01' }, '2026-09-01', '2026-09-30'));
}

console.log('\nperiod(): the presets');
{
  const now = new Date(2026, 8, 13, 12);
  eq('this month', Biz.period('month', now), { from: '2026-09-01', to: '2026-09-13' });
  eq('last month', Biz.period('lastMonth', now), { from: '2026-08-01', to: '2026-08-31' });
  eq('30 days includes today', Biz.period('30d', now), { from: '2026-08-15', to: '2026-09-13' });
  eq('this year', Biz.period('year', now), { from: '2026-01-01', to: '2026-09-13' });
  eq('all', Biz.period('all', now.getTime()).to, '2026-09-13');
  ok('all starts before MySet existed', Biz.period('all', now).from < '2026-01-01');
  eq('last month across a year edge', Biz.period('lastMonth', new Date(2027, 0, 5)), { from: '2026-12-01', to: '2026-12-31' });
  eq('custom, reversed dates swap', Biz.period('custom', now, { from: '2026-09-10', to: '2026-09-01' }), { from: '2026-09-01', to: '2026-09-10' });
  eq('custom with junk falls back to today', Biz.period('custom', now, { from: 'x' }), { from: '2026-09-13', to: '2026-09-13' });
  eq('unknown kind is this month', Biz.period('nope', now), Biz.period('month', now));
}

console.log('\nsum(): the period\'s totals');
{
  const o1 = occ('ev1', 2026, 7, 4, 20), o2 = occ('ev1', 2026, 8, 8, 20), o3 = occ('ev2', 2026, 9, 12, 20, { venue: 'Elsewhere' }), o4 = occ('ev1', 2026, 9, 5, 20);
  const biz = { rules: { ev1: gig({ pay: 20000, band: [{ name: 'Sam', cents: 5000 }] }) }, gigs: {
    'ev1@2026-07-04': gig({ pay: 30000, band: [{ name: 'sam', cents: 10000 }, { name: 'Jo', cents: 5000 }], tips: 2000,
      merch: [{ name: 'T-shirt', qty: 2, cents: 4000 }], costs: [{ name: 'Parking', cents: 1000 }], min: { perform: 120, break: null, travel: 60, setup: null } }),
    'ev2@2026-09-12': gig({ pay: 10000, costs: [{ name: 'parking', cents: 500 }, { name: 'Strings', cents: 1500 }],
      merch: [{ name: 't-shirt', qty: 1, cents: 2000 }, { name: 'Cap', qty: 1, cents: 1500 }] }),
  } };
  const nights = [night('a', at(2026, 7, 4, 20), { gross: 10 }), night('b', at(2026, 8, 8, 20), { gross: 5, source: 'stripe-unreachable' })];
  const shows = Biz.join(nights, [o1, o2, o3, o4], biz, NOW);
  const t = Biz.sum(shows, null, { to: '2026-09-13' });
  eq('three counted of four listed: the rule-only Sep 5 slot is out', [t.shows, shows.length], [3, 4]);
  eq('two logged by hand', t.logged, 2);
  eq('one timed', t.timed, 1);
  eq('pay', t.pay, 60000);
  eq('band', t.band, 20000);
  eq('costs', t.costs, 3000);
  eq('merch', t.merch, 7500);
  eq('tips', t.tips, 2000);
  eq('app: only the confirmed night', t.app, 1000);
  eq('one show whose app money is not available', t.appUnknown, 1);
  eq('revenue', t.revenue, 70500);
  eq('profit', t.profit, 47500);
  /* The Jul 4 show alone has minutes: 180 included, its own profit 30000 − 15000 +
     2000 + 4000 + 1000 − 1000 = 21000. The rate is that show's, not the period's
     profit spread over that show's hours. */
  eq('rate is over the timed subset only', t.rate, 7000);
  eq('rateStage is the same subset over on-stage minutes', t.rateStage, 10500);
  eq('the timed totals the four readings come from', t.timedSum, { profit: 21000, cut: 21000, fee: 0, included: 180, perform: 120 });
  eq('and rates() over them agrees with rate and rateStage', Biz.rates(t.timedSum, {}), { evening: t.rate, stage: t.rateStage });
  const fee = Biz.sum(shows, null, { to: '2026-09-13' }, 10);
  eq('with the plan\'s cut: the fee is 10% of the confirmed app money', [fee.fee, fee.timedSum.fee], [100, 100]);
  eq('my cut, nothing typed, is the profit', fee.cut, fee.profit);
  eq('after the fee the evening rate drops by the fee over the hours', Biz.rates(fee.timedSum, { net: true }).evening, Math.round((21000 - 100) / 180 * 60));
  eq('minutes by kind', t.minutes, { perform: 120, break: 0, travel: 0 + 60, setup: 0 });
  eq('included minutes', t.includedMinutes, 180);
  const travelOff = Biz.sum(shows, { hours: { perform: true, break: true, travel: false, setup: true } }, { to: '2026-09-13' });
  eq('a toggle changes the rate', [travelOff.includedMinutes, travelOff.rate], [120, 10500]);
  eq('twelve month buckets ending on the period', [t.byMonth.length, t.byMonth[0].month, t.byMonth[11].month], [12, '2025-10', '2026-09']);
  const jul = t.byMonth.find((m) => m.month === '2026-07'), sep = t.byMonth.find((m) => m.month === '2026-09');
  eq('July', [jul.profit, jul.revenue, jul.costs, jul.app, jul.shows], [21000, 37000, 1000, 1000, 1]);
  eq('September', [sep.profit, sep.app, sep.shows], [10000 - 2000 + 3500, 0, 1]);
  eq('an empty month is zeros', t.byMonth.find((m) => m.month === '2026-03'), { month: '2026-03', profit: 0, revenue: 0, costs: 0, app: 0, shows: 0 });
  eq('without a range the buckets end on the newest show', Biz.sum(shows, null).byMonth[11].month, '2026-09');
  eq('no shows: no buckets', Biz.sum([], null).byMonth, []);
  eq('mix', t.mix, [{ k: 'pay', label: 'Gig pay', cents: 60000 }, { k: 'tips', label: 'Cash tips', cents: 2000 },
    { k: 'merch', label: 'Merch', cents: 7500 }, { k: 'app', label: 'Through the app', cents: 1000 }]);
  /* Names group case-blind and show the spelling first seen — shows come newest
     first, so that is the most recent show's spelling. */
  eq('band by member, case-blind, newest spelling kept, one show counted per night',
    t.bandBy, [{ name: 'Sam', shows: 2, cents: 15000 }, { name: 'Jo', shows: 1, cents: 5000 }]);
  eq('costs by name', t.costsBy, [{ name: 'parking', cents: 1500, n: 2 }, { name: 'Strings', cents: 1500, n: 1 }]);
  eq('merch by name', t.merchBy, [{ name: 't-shirt', qty: 3, cents: 6000 }, { name: 'Cap', qty: 1, cents: 1500 }]);
  eq('byShow is the counted shows, newest first', t.byShow.map((s) => [s.key, s.profit, s.app, s.nights]),
    [['ev2@2026-09-12', 11500, null, 0], ['ev1@2026-08-08', 15000, null, 1], ['ev1@2026-07-04', 21000, 1000, 1]]);
  eq('sum of nothing', Biz.sum([], null).profit, 0);
}

console.log('\nthe constants equal the server\'s');
{
  const hist = readFileSync(new URL('../netlify/functions/_history.mjs', import.meta.url), 'utf8');
  const m = /(const GRACE = )(\d+) \* 60000/.exec(hist);
  ok('placeShows still has its GRACE literal', !!m);
  eq('Biz.JOIN.graceMs is placeShows\' grace', Biz.JOIN.graceMs, m ? +m[2] * 60000 : NaN);
  const bizPath = new URL('../netlify/functions/_biz.mjs', import.meta.url);
  if (!existsSync(bizPath)) console.log('  skipped: _biz.mjs not present yet');
  else {
    const src = readFileSync(bizPath, 'utf8');
    const lit = (re) => { const x = re.exec(src); try { return x ? new Function('return ' + x[1])() : undefined; } catch (e) { return undefined; } };
    const kinds = lit(/\bTIME_KINDS\s*=\s*(\[\s*\[[\s\S]*?\]\s*\])/);
    ok('_biz.mjs has a TIME_KINDS literal', kinds !== undefined);
    eq('Biz.TIME_KINDS equals the server\'s', Biz.TIME_KINDS, kinds);
    const lim = lit(/\b\w*LIMITS\s*=\s*(\{[^}]*\})/);
    ok('_biz.mjs has a LIMITS literal', lim !== undefined);
    /* A cap the client carries and the server does not yet is reported, not failed:
       the two files land from different hands and the gate runs on the pair. */
    if (lim) for (const k of Object.keys(Biz.LIMITS)) {
      if (!(k in lim)) console.log(`  skipped: LIMITS.${k} not in _biz.mjs yet`);
      else eq(`LIMITS.${k} equals the server's`, Biz.LIMITS[k], lim[k]);
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
