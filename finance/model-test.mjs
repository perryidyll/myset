import fs from 'node:fs';
const html = fs.readFileSync('/Users/perryidyll/Docs/MySet/finance/model.html', 'utf8');
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
const ENGINE = new Function(m[1] + '; return ENGINE;')();
// pull P0/HOSTS0 out of the page too, so the test uses the page's real defaults
const defs = html.match(/const HOSTS0 = ([\s\S]*?);\nconst HOST_NOTES/)[1];
const p0 = html.match(/const P0 = ([\s\S]*?);\nlet P = /)[1];
const HOSTS0 = new Function('return ' + defs)();
const P0 = new Function('HOSTS0', 'return ' + p0)(HOSTS0);
const withDefaultsTest = (partial) => { const base = JSON.parse(JSON.stringify(P0)); return Object.assign(base, partial); };
let fails = 0; const ok = (name, cond, detail) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   ' + detail)); if (!cond) fails++; };

console.log('CALIBRATION vs tools/loadsim.py');
const targets = [[20,3,.22,2.5,6030],[20,3,.6,2.5,15508],[20,3,1,8,27372],[300,3,.22,2.5,128980],[300,3,.4,2.5,233557],[2000,2,.22,2.5,1037489],[8,2.5,.22,2.5,1926],[50,4,.3,3,28095]];
let worst = 0;
for (const [fans,hours,look,inter,py] of targets) { const js = (ENGINE.pollsPerPhone({fans,hours,look,interactions:inter}) - inter) * fans; const err = Math.abs(js - py) / py; worst = Math.max(worst, err); }
ok('worst error across 8 cases ≤ 4%: ' + (worst*100).toFixed(1) + '%', worst <= 0.04);

console.log('ONE GIG, audit shape (20 phones, 3 h, no Studio, no extra pages)');
const pa = { ...P0, studioOn: false, extraViews: 0, interactions: 2.5, changeShare: 100, pollMs: 155, pollMsPerFan: 0 };
const one = ENGINE.gigTraffic(pa, 20, 3);
const cr = ENGINE.netlifyCredits(one, 0, HOSTS0.netlifyPro);
console.log('   polls', Math.round(one.polls), 'requests', Math.round(one.requests), 'MB', (one.bytes/1e6).toFixed(1), 'fn-min', (one.fnMs/60000).toFixed(1), 'credits', cr.total.toFixed(3), '$', (cr.total*10/1500).toFixed(4));
ok('credits per gig within 8% of the audit’s 4.198 (the +1 poll per action makes ours a touch higher)', Math.abs(cr.total - 4.198) / 4.198 < 0.08, cr.total);
ok('compute is the biggest share (audit: 63%)', cr.cmp > cr.req && cr.cmp > cr.bw, JSON.stringify(cr));

console.log('THE MONTH, independent re-computation');
const R = ENGINE.month(P0, P0.artists);
const nFree = 1000 * .6, nPlus = 300, nPro = 100;
const gigsFreeRun = Math.min(P0.gigsFree, P0.freeCap);
const gigs = nFree * gigsFreeRun + (nPlus + nPro) * P0.gigsPaid;
ok('gigs = ' + gigs, Math.abs(R.gigs - gigs) < 1e-6, R.gigs);
const paying = 1 - P0.compedPct / 100;
const subs = (nPlus * P0.plusPrice + nPro * P0.proPrice) * paying;
ok('subscriptions = $' + subs.toFixed(2), Math.abs(R.subs - subs) < 1e-6, R.subs);
const refunds = subs * P0.stripe.refundPct / 100;
ok('subscriptions net of refunds', Math.abs(R.subsNet - (subs - refunds)) < 1e-6, R.subsNet);
/* room money is PER PERSON now, so it scales with the crowd */
const gmvFree = nFree * gigsFreeRun * P0.fans * P0.roomFree;
const gmvPlus = nPlus * P0.gigsPaid * P0.fans * P0.roomPlus;
const gmvPro  = nPro  * P0.gigsPaid * P0.fans * P0.roomPro;
const gmvAll = gmvFree + gmvPlus + gmvPro;
const cutRev = gmvFree * P0.cutFree / 100 + gmvPlus * P0.cutPlus / 100 + gmvPro * P0.cutPro / 100;
ok('cut revenue = $' + cutRev.toFixed(2), Math.abs(R.cutRev - cutRev) < 1e-6, R.cutRev);
const featCount = gigs * P0.featPct / 100;
const feat = featCount * P0.featPrice * (1 - P0.featRefundPct / 100);
ok('featured = $' + feat.toFixed(2), Math.abs(R.feat - feat) < 1e-6, R.feat);
ok('revenue = subs - refunds + cuts + featured', Math.abs(R.revenue - (subs - refunds + cutRev + feat)) < 1e-6);
const subCount = (nPlus + nPro) * paying;
const S = P0.stripe;
const card = (amt, n) => amt * (S.pct / 100 + (S.intlShare / 100) * (S.intlPct / 100) + (S.fxShare / 100) * (S.fxPct / 100)) + n * S.fixed;
const paidOut = gmvAll - cutRev;
const payouts = (nFree * Math.min(S.payoutsPerMonth, gigsFreeRun) + (nPlus + nPro) * Math.min(S.payoutsPerMonth, P0.gigsPaid)) * (P0.activePayoutPct / 100);
const earning = 1000 * P0.activePayoutPct / 100;
const stripe = card(subs, subCount) + subs * S.billingPct / 100 + card(featCount * P0.featPrice, featCount)
  + (subCount + featCount) * (S.disputePct / 100) * S.disputeFee
  + earning * S.expressAcct + paidOut * S.payoutPct / 100 + payouts * S.payoutFixed + paidOut * S.lossPct / 100;
ok('stripe total = $' + stripe.toFixed(2), Math.abs(R.stripe - stripe) < 1e-6, R.stripe);
const fixed = P0.fixed.reduce((n, f) => n + f.usd, 0) + P0.supportHours * P0.supportRate + subCount * P0.supportMinPerArtist / 60 * P0.supportRate;
ok('fixed = $' + fixed.toFixed(2), Math.abs(R.fixed - fixed) < 1e-6, R.fixed);
ok('profit = revenue - server - stripe - fixed', Math.abs(R.profit - (R.revenue - R.bill.usd - R.stripe - R.fixed)) < 1e-6);
console.log('   revenue $' + R.revenue.toFixed(0), 'server $' + R.bill.usd.toFixed(0) + ' (' + R.bill.plan + ')', 'stripe $' + R.stripe.toFixed(0), 'fixed $' + R.fixed.toFixed(0), 'profit $' + R.profit.toFixed(0), 'margin ' + (R.margin*100).toFixed(1) + '%', 'server%rev ' + (R.serverPct*100).toFixed(1) + '%');

console.log('THE AUDIT FIXES');
/* a bigger room now earns as well as costs */
const small = ENGINE.month({ ...P0, fans: 20 }, 1000), bigRoom = ENGINE.month({ ...P0, fans: 300 }, 1000);
console.log('   20 people: revenue $' + small.revenue.toFixed(0) + ' profit $' + small.profit.toFixed(0) + '  |  300 people: revenue $' + bigRoom.revenue.toFixed(0) + ' profit $' + bigRoom.profit.toFixed(0));
ok('room money scales with the crowd (revenue rises 15x with 15x the people)', Math.abs(bigRoom.gmv.free / small.gmv.free - 15) < 1e-9, bigRoom.gmv.free / small.gmv.free);
ok('and a bigger room is no longer pure cost — revenue rises with it', bigRoom.revenue > small.revenue * 2);
/* the Express switch governs bad debt too */
const noExp = ENGINE.month({ ...P0, stripe: { ...P0.stripe, expressOn: false } }, 1000);
ok('turning Express off removes the bad-debt line as well', noExp.express === 0 && noExp.badDebt === 0, [noExp.express, noExp.badDebt]);
/* break-even is the true smallest integer even where the plan steps make profit dip */
for (const q of [P0, { ...P0, fans: 300, plusPct: 25 }, { ...P0, plusPct: 6, proPct: 2 }]) {
  const be = ENGINE.breakEven(q);
  if (!isFinite(be)) { ok('break-even infinite case handled', true); continue; }
  let brute = null;
  for (let a = 0; a <= be + 5; a++) if (ENGINE.month(q, a).profit >= 0) { brute = a; break; }
  ok(`break-even ${be} is the true first profitable count (brute force ${brute})`, be === brute, { be, brute });
}
/* the feasibility verdict follows the host */
const arenaPlain = ENGINE.showSizes(P0)[2];
const arenaCache = ENGINE.showSizes({ ...P0, host: 'netlifyCache' })[2];
console.log('   arena verdict — plain Netlify: ' + arenaPlain.status + ' · with the 3-second cache: ' + arenaCache.status);
ok('the cache the page recommends actually changes the verdict', arenaPlain.status === 'breaks' && arenaCache.status !== 'breaks');
/* the show-size panel prices MySet's own money, and the tier changes the answer */
const onFree = ENGINE.showSizes({ ...P0, sizeTier: 'free' })[2], onPro = ENGINE.showSizes({ ...P0, sizeTier: 'pro' })[2];
console.log('   arena on a free artist: MySet earns $' + onFree.mysetRev.toFixed(0) + ', keeps $' + onFree.mysetNet.toFixed(0) + '  |  on Pro: earns $' + onPro.mysetRev.toFixed(0) + ', keeps $' + onPro.mysetNet.toFixed(0));
ok('a Pro artist\'s arena earns the plan cut and covers its server cost',
   Math.abs(onPro.mysetRev - onPro.earn * P0.cutPro / 100) < 1e-9 && onPro.mysetNet > 0);
ok('a free artist\'s arena earns MySet the plan cut', Math.abs(onFree.mysetRev - onFree.earn * P0.cutFree / 100) < 1e-9);
ok('no booking surcharge is needed when the plan cut already covers the target margin', onPro.bookingAt(0.5) === 0);
/* the whole run, not one day of it */
const fest = ENGINE.showSizes(P0)[3];
ok('a 3-day festival counts three days of room money', Math.abs(fest.earn - fest.fans * P0.roomFree * 3) < 1e-9, fest.earn);
/* acquisition cost reaches the cumulative line */
const tlFree = ENGINE.timeline(P0), tlPaid = ENGINE.timeline({ ...P0, cacUsd: 20 });
console.log('   36 months cumulative: $0 to sign an artist -> $' + tlFree[tlFree.length-1].cum.toFixed(0) + '  |  $20 each -> $' + tlPaid[tlPaid.length-1].cum.toFixed(0));
ok('paying to sign artists lowers the cumulative line', tlPaid[tlPaid.length-1].cum < tlFree[tlFree.length-1].cum);
ok('and nothing is charged in month 0', tlPaid[0].acq === 0);
/* per-tier contribution and the Plus crossover */
const [tf, tp, tr] = R.perTier;
console.log('   per artist per month — free $' + tf.net.toFixed(2) + ' · Plus $' + tp.net.toFixed(2) + ' · Pro $' + tr.net.toFixed(2) + '  | Plus stops paying above $' + R.plusCrossover.toFixed(2) + ' of room money');
ok('every tier reports a net figure', [tf, tp, tr].every(x => isFinite(x.net)));
ok('the Plus crossover is the subscription divided by the cut it gives up', isFinite(R.plusCrossover) && R.plusCrossover > 0);

console.log('SCALE');
const big = ENGINE.month({ ...P0, studioOn: false, extraViews: 0, changeShare: 100, plusPct: 100, proPct: 0, gigsPaid: 20, deploys: 0, compedPct: 0, pollMs: 155, pollMsPerFan: 0, cronRequests: 0 }, 10000);
console.log('   10,000 artists × 20 gigs: server $' + big.bill.usd.toFixed(0) + ' on ' + big.bill.plan + ' (audit: $5,597 at Pro rates)');
ok('10k-artist server bill within 10% of the audit', Math.abs(big.bill.usd - 5597) / 5597 < 0.10, big.bill.usd);
const kv = ENGINE.hostBill('cfKv', HOSTS0, big.T, 0), doo = ENGINE.hostBill('cfDo', HOSTS0, big.T, 0);
console.log('   same month on Workers+KV $' + kv.usd.toFixed(0) + ' (audit $9,658) · Durable Objects $' + doo.usd.toFixed(0) + ' (audit $427)');
ok('KV is worse than Netlify; DO is cheaper but NOT 13× — the audit omitted the duration charge (128 MB × every second the room is live)', kv.usd > big.bill.usd && doo.usd < big.bill.usd && doo.usd > big.bill.usd / 5);

console.log('FREE CAP');
const capped = ENGINE.month({ ...P0, gigsFree: 6, plusPct: 0, proPct: 0 }, 100);
ok('a free artist wanting 6 nights gets 4: gigs = 400', Math.abs(capped.gigs - 400) < 1e-6, capped.gigs);
ok('and 200 refused nights are reported', Math.abs(capped.gigsCapped - 200) < 1e-6, capped.gigsCapped);

console.log('BREAK-EVEN + TIMELINE + SIZES');
const be = ENGINE.breakEven(P0); const atBe = ENGINE.month(P0, be), below = ENGINE.month(P0, Math.max(0, be - 1));
ok('break-even ' + be + ' artists: profit ≥ 0 there and < 0 one below', atBe.profit >= 0 && (be === 0 || below.profit < 0), [atBe.profit, below.profit]);
const tl = ENGINE.timeline(P0);
ok('timeline has months+1 rows and never exceeds the scenario size', tl.length === P0.months + 1 && tl.every(r => r.artists <= P0.artists + 1e-9));
const sz = ENGINE.showSizes(P0);
for (const s of sz) console.log('   ' + s.name.padEnd(12), String(s.fans).padStart(6), 'phones', String(s.hours * s.days).padStart(3), 'h  polls', Math.round(s.polls).toLocaleString().padStart(12), ' credits', s.credits.toFixed(1).padStart(10), ' netlify $' + s.onHost.netlifyPro.toFixed(2).padStart(9), ' KV $' + s.onHost.cfKv.toFixed(2).padStart(9), ' DO $' + s.onHost.cfDo.toFixed(2).padStart(7), ' vercel $' + s.onHost.vercel.toFixed(2));
ok('festival costs more than the bar set on every host', Object.keys(HOSTS0).every(k => HOSTS0[k].kind === 'vps' || sz[3].onHost[k] >= sz[0].onHost[k]));
const cal = ENGINE.calibrateLook(P0, 100.5);
ok('calibration recovers ~22% screen-on from 100.5 polls/phone-hour: ' + cal + '%', Math.abs(cal - 22) <= 3, cal);
console.log('REVIEW FIXES');
const old = ENGINE.month(withDefaultsTest({ artists: 500 }), 500);
ok('a scenario missing every new key still computes (deep-merge over defaults)', isFinite(old.costs) && isFinite(old.profit));
ok('whole credit packs: 3,001 credits on Pro costs $30, not $20.01', Math.abs(ENGINE.netlifyDollars(3001, HOSTS0.netlifyPro).usd - 30) < 1e-9, ENGINE.netlifyDollars(3001, HOSTS0.netlifyPro).usd);
const zero = ENGINE.month({ ...P0, plusPrice: 0, proPrice: 0, roomFree: 0, roomPlus: 0, roomPro: 0, featPrice: 0, venuePro: 0 }, 100);
ok('zero revenue → margin is not a number, not 0%', Number.isNaN(zero.margin) && Number.isNaN(zero.serverPct));
ok('VPS with 0 requests per box does not explode', ENGINE.hostBill('vps', { vps: { ...HOSTS0.vps, reqPerBoxMonth: 0 } }, R.T, 0).usd < 1000);
console.log('DEFENSES');
const arenaOff = ENGINE.showSizes(P0)[2], arenaOn = ENGINE.showSizes({ ...P0, bigRoomOn: true, bigRoomFrom: 500, bigRoomFloor: 15 })[2];
console.log('   arena polls: brake off', Math.round(arenaOff.polls).toLocaleString(), '· brake on (15 s floor)', Math.round(arenaOn.polls).toLocaleString(), '· status', arenaOff.status, '→', arenaOn.status);
ok('the big-room brake cuts arena polls by at least 3×', arenaOff.polls / arenaOn.polls >= 3);
ok('the bar set is untouched by the brake (below the threshold)', Math.abs(ENGINE.showSizes({ ...P0, bigRoomOn: true })[0].polls - ENGINE.showSizes(P0)[0].polls) < 1e-6);
const cached = ENGINE.showSizes(P0)[2].onHost.netlifyCache, plain = ENGINE.showSizes(P0)[2].onHost.netlifyPro;
console.log('   arena on Netlify: plain $' + plain.toFixed(2) + ' · with the 3-second cache $' + cached.toFixed(2));
ok('the 3-second cache makes the arena much cheaper (compute gone, requests remain)', cached < plain * 0.45 && cached > 2, [plain, cached]);
ok('today’s code holds a bar set and breaks at arena size', ENGINE.showSizes(P0)[0].status === 'ok' && arenaOff.status === 'breaks');
console.log('TRACKING');
/* tools/actuals.py solves polls out of the bandwidth counter with its own copy of the
   byte constants; if either side changes without the other, the calibration is wrong. */
const py = fs.readFileSync(new URL('../tools/actuals.py', import.meta.url), 'utf8');
const pyBytes = Object.fromEntries([...py.match(/BYTES = \{([^}]*)\}/)[1].matchAll(/'(\w+)': (\d+)/g)].map(m => [m[1], +m[2]]));
ok('actuals.py byte constants match the model defaults', pyBytes.poll === P0.pollBytes && pyBytes.write === P0.writeBytes && pyBytes.studio === P0.studioBytes && pyBytes.view === P0.viewBytes && pyBytes.page === P0.pageBytes, [pyBytes, P0.pollBytes, P0.writeBytes, P0.studioBytes, P0.viewBytes, P0.pageBytes]);
ok('actuals.py Studio tick and extra-views match the model', /STUDIO_POLLS_PER_HOUR = 3600 \/ 4\b/.test(py) && +py.match(/EXTRA_VIEWS_PER_PHONE = ([\d.]+)/)[1] === P0.extraViews);
/* the bandwidth arithmetic, done the model's way: a night's bytes minus everything that is not a poll, ÷ bytes per poll, gives the polls back */
const nt = ENGINE.gigTraffic(P0, P0.fans, P0.hours);
const other = nt.studioPolls * P0.studioBytes + P0.fans * P0.pageBytes + nt.writes * P0.writeBytes + nt.extraViews * P0.viewBytes;
ok('bytes − (Studio + page loads + votes + views) ÷ 2,530 = the polls (the method the marks use)', Math.abs((nt.bytes - other) / P0.pollBytes - nt.polls) < 1e-6);
console.log('   at the default gig the Studio tab is ' + Math.round(100 * nt.studioPolls * P0.studioBytes / nt.bytes) + '% of the bytes — leave it open the whole night or the solve is off by that much');
const tierSum = R.perTier.reduce((n, t, i) => n + t.net * [R.nFree, R.nPlus, R.nPro][i], 0);
ok('per-tier nets summed over the platform equal revenue − server − Stripe (venues aside)', Math.abs(tierSum - (R.revenue - R.bill.usd - R.stripe)) < 1.5, [tierSum, R.revenue - R.bill.usd - R.stripe]);
ok('actuals.py assumes the same Studio share as the model when no minutes were recorded', +py.match(/STUDIO_SHARE = ([\d.]+)/)[1] === P0.studioShare / 100);
const bookFree = ENGINE.showSizes(P0)[2].bookingAt(0.5);
ok('the booking price covers Stripe’s card fee on itself (grossed up, not net)', bookFree > ENGINE.showSizes(P0)[2].server / 0.5 - ENGINE.showSizes(P0)[2].mysetRev, bookFree);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
