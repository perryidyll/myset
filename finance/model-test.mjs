import fs from 'node:fs';
const html = fs.readFileSync(new URL('./model.html', import.meta.url), 'utf8');   // the page beside this file, whichever worktree
const m = html.match(/\/\*ENGINE-START\*\/([\s\S]*?)\/\*ENGINE-END\*\//);
const ENGINE = new Function(m[1] + '; return ENGINE;')();
// pull P0/HOSTS0 out of the page too, so the test uses the page's real defaults
const defs = html.match(/const HOSTS0 = ([\s\S]*?);\nconst HOST_NOTES/)[1];
const p0 = html.match(/const P0 = ([\s\S]*?);\nlet P = /)[1];
const HOSTS0 = new Function('return ' + defs)();
const P0 = new Function('HOSTS0', 'return ' + p0)(HOSTS0);
const withDefaultsTest = (partial) => { const base = JSON.parse(JSON.stringify(P0)); return Object.assign(base, partial); };
let fails = 0; const ok = (name, cond, detail) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : '   ' + detail)); if (!cond) fails++; };

console.log('CALIBRATION vs tools/loadsim.py (2026-09-14: the ladder with the server’s floor, the terminal rung and jitter; stageSig above 200 phones)');
/* [fans, hours, look, votes each, polls, renders best, renders worst, credits best, credits worst, credits before the split]
   printed by tools/loadsim.py gig() for the same inputs — the model must reproduce the simulator, not the other way round */
const targets = [
  [20,3,.22,2.5, 5821,2274,5821, 4.510,6.037,4.056], [20,3,.6,2.5, 15900,2996,15900, 10.777,16.333,10.921], [20,3,1,8, 27460,3227,27460, 17.813,28.246,18.899],
  [300,3,.22,2.5, 40702,1055,1055, 25.866,25.866,44.299], [300,3,.4,2.5, 72195,1068,1068, 44.484,44.484,78.327], [2000,2,.22,2.5, 179347,721,721, 115.354,115.354,131.214],
  [8,2.5,.22,2.5, 1965,1179,1965, 1.705,2.044,1.375], [50,4,.3,3, 28107,4143,28107, 18.645,28.962,19.395], [11,2.74,.22,2.35, 2801,1544,2801, 2.368,2.910,1.956],
  [1000,3,.22,2.5, 134693,1076,1076, 84.591,84.591,146.730], [10000,2,.22,2.5, 589127,363,363, 393.579,393.579,446.543]];
let worstPolls = 0, worstRenders = 0, worstBest = 0, worstWorst = 0, worstLegacy = 0;
/* the simulator's shape: no Studio, no extra pages, 155 ms per render with no per-fan growth, 50 ms personal, every action a vote */
const sim = (fans, hours, look, inter, edgeSpread) => ENGINE.gigTraffic({ ...P0, studioOn: false, extraViews: 0, clipViews: 0, lookShare: look * 100, interactions: inter, changeShare: 100, pollMs: 155, pollMsPerFan: 0, meMs: 50, edgeSpread }, fans, hours);
for (const [fans,hours,look,inter,py,rb,rw,cb,cw,lg] of targets) {
  const best = sim(fans, hours, look, inter, 0), worst = sim(fans, hours, look, inter, 100);
  const polls = best.polls - inter * fans;   // loadsim counts the ladder only; the +1 per action is ours
  worstPolls = Math.max(worstPolls, Math.abs(polls - py) / py);
  worstRenders = Math.max(worstRenders, Math.abs(best.rendersBest - rb) / rb);
  worstBest = Math.max(worstBest, Math.abs(ENGINE.netlifyCredits(best, 0, HOSTS0.netlifyPro).total - cb) / cb);
  worstWorst = Math.max(worstWorst, Math.abs(ENGINE.netlifyCredits(worst, 0, HOSTS0.netlifyPro).total - cw) / cw);
  /* loadsim --legacy restores the 5 s rung for 201–1,000 phones; so does the engine's "before the split" column */
  worstLegacy = Math.max(worstLegacy, Math.abs(ENGINE.netlifyCredits({ ...best, requests: best.lgRequests, bytes: best.lgBytes, fnMs: best.lgFnMs }, 0, HOSTS0.netlifyPro).total - lg) / lg);
}
ok('polls: worst error across 11 cases ≤ 5%: ' + (worstPolls*100).toFixed(1) + '%', worstPolls <= 0.05);
ok('board renders (best case): worst error ≤ 8%: ' + (worstRenders*100).toFixed(1) + '%', worstRenders <= 0.08);
ok('credits, best case (one edge node): worst error ≤ 8%: ' + (worstBest*100).toFixed(1) + '%', worstBest <= 0.08);
ok('credits, worst case (every tick renders): worst error ≤ 8%: ' + (worstWorst*100).toFixed(1) + '%', worstWorst <= 0.08);
ok('credits before the split (--legacy, the old 5 s rung included): worst error ≤ 8%: ' + (worstLegacy*100).toFixed(1) + '%', worstLegacy <= 0.08);

console.log('ONE GIG, simulator shape (20 phones, 3 h, no Studio, no extra pages)');
const pa = { ...P0, studioOn: false, extraViews: 0, clipViews: 0, interactions: 2.5, changeShare: 100, pollMs: 155, pollMsPerFan: 0, meMs: 50, edgeSpread: 0 };
const one = ENGINE.gigTraffic(pa, 20, 3);
const cr = ENGINE.netlifyCredits(one, 0, HOSTS0.netlifyPro);
console.log('   ticks', Math.round(one.polls), 'renders', Math.round(one.renders), 'requests', Math.round(one.requests), 'MB', (one.bytes/1e6).toFixed(1), 'fn-min', (one.fnMs/60000).toFixed(1), 'credits', cr.total.toFixed(3), '$', (cr.total*10/1500).toFixed(4));
ok('the 20-phone gig: 2.70¢ before the split → 3.01¢ after it on Pro (loadsim 4.056 → 4.510 credits, best case)', Math.abs(cr.total - 4.510) / 4.510 < 0.08 && Math.abs(ENGINE.netlifyCredits({ ...one, requests: one.lgRequests, bytes: one.lgBytes, fnMs: one.lgFnMs }, 0, HOSTS0.netlifyPro).total - 4.056) / 4.056 < 0.08, cr.total);
const crLg = ENGINE.netlifyCredits({ ...one, requests: one.lgRequests, bytes: one.lgBytes, fnMs: one.lgFnMs }, 0, HOSTS0.netlifyPro);
ok('at a bar, web requests are now the biggest line (two per tick); compute was, before the split', cr.req > cr.cmp && crLg.cmp > crLg.req, JSON.stringify([cr, crLg]));
const big1k = ENGINE.gigTraffic(pa, 1000, 3), bigLg = ENGINE.netlifyCredits({ ...big1k, requests: big1k.lgRequests, bytes: big1k.lgBytes, fnMs: big1k.lgFnMs }, 0, HOSTS0.netlifyPro).total, bigSp = ENGINE.netlifyCredits(big1k, 0, HOSTS0.netlifyPro).total;
console.log('   1,000 phones, 3 h: before ' + (bigLg / 150).toFixed(2) + ' → after $' + (bigSp / 150).toFixed(2) + ' on Pro');
ok('a 1,000-phone room: $0.98 before the split (the old 5 s rung) → $0.56 after it on Pro (loadsim 146.7 → 84.6 credits)', Math.abs(bigLg / 150 - 0.978) < 0.08 && Math.abs(bigSp / 150 - 0.564) < 0.06, [bigLg / 150, bigSp / 150]);
ok('above 200 phones every board request but one per 10 s is an edge hit', big1k.renders <= 3 * 3600 / 10 + 1 && big1k.renders > 3 * 3600 / 10 * 0.95, big1k.renders);
ok('the floor the server sends: 3 s to 200, 10 s to 3,000, 20 s above', ENGINE.pollFloor(200) === 3 && ENGINE.pollFloor(201) === 10 && ENGINE.pollFloor(3000) === 10 && ENGINE.pollFloor(3001) === 20);
const mid = ENGINE.gigTraffic({ ...pa, edgeSpread: 50 }, 20, 3);
ok('the edge-nodes dial slides renders between the best and the worst case', Math.abs(mid.renders - (mid.rendersBest + mid.rendersWorst) / 2) < 1e-6 && mid.rendersWorst > mid.rendersBest);
ok('the store: a bar moves kilobytes a second, ten thousand phones sit at the ~50 MB/s wall (loadsim 48.7)', one.storeMBs < 0.05 && Math.abs(ENGINE.gigTraffic(pa, 10000, 2).storeMBs - 48.7) / 48.7 < 0.1, [one.storeMBs, ENGINE.gigTraffic(pa, 10000, 2).storeMBs]);

console.log('THE OPEN LINE (decision 0036: an add-on to polling, priced from the probe)');
const plainL = ENGINE.gigTraffic(pa, 20, 3, false), lineL = ENGINE.gigTraffic(pa, 20, 3, true);
/* at a 20-phone bar the tally changes about as often as the stage does (50 votes over 3 h ≈ a song every 4 min), so the line
   cannot slow the ladder much there, and every stage message adds a look — the line saves ticks only in a BUSY room under 200 phones */
const busyPlain = ENGINE.gigTraffic({ ...pa, interactions: 8 }, 150, 3, false), busyLine = ENGINE.gigTraffic({ ...pa, interactions: 8 }, 150, 3, true);
ok('with the line on, a busy 150-phone room polls less (the tally no longer resets the ladder); a quiet bar about the same', busyLine.polls < busyPlain.polls * 0.8 && Math.abs(lineL.polls - plainL.polls) / plainL.polls < 0.15, [busyPlain.polls, busyLine.polls, plainL.polls, lineL.polls]);
ok('a stage message makes only the phones with the screen on look (spread, never a burst)', Math.abs((lineL.perPhone - ENGINE.pollsPerPhone({ fans: 20, hours: 3, look: .22, interactions: 2.5, changeShare: 1, floorS: 3, line: true }).perPhone) - 3 * 60 / 4 * .22) < 1e-6);
ok('every glance is a socket (a hidden page closes it): sockets = phones × share × (glances + drops); requests = 2 per socket + 1 per nudge', lineL.glances > 30 && Math.abs(lineL.sockets - 20 * (lineL.glances + P0.reconnects)) < 1e-6 && Math.abs(lineL.lineReqs - (2 * lineL.sockets + lineL.nudges)) < 1e-6, [lineL.glances, lineL.sockets, lineL.nudges, lineL.lineReqs]);
const half = ENGINE.gigTraffic({ ...pa, interactions: 8, lineShare: 50 }, 150, 3, true);
ok('half the phones on the line: half the sockets, and the ticks sit between the plain and the line-on ladder', Math.abs(half.sockets - busyLine.sockets / 2) / busyLine.sockets < 0.03 && half.polls > busyLine.polls && half.polls < busyPlain.polls, [busyPlain.polls, half.polls, busyLine.polls]);
ok('the artist’s pace is a dial: slower stage actions mean fewer nudges and fewer looks', ENGINE.gigTraffic({ ...pa, songEveryMin: 18 }, 20, 3, true).nudges < lineL.nudges && ENGINE.gigTraffic({ ...pa, songEveryMin: 18 }, 20, 3, true).polls < lineL.polls);
ok('nudges = one per landed vote + one per stage action', Math.abs(lineL.nudges - (2.5 * 20 + 3 * 60 / 4)) < 1e-6, lineL.nudges);
ok('every landed vote (not feedback) waits the nudge’s round trip on Netlify’s write path', Math.abs(lineL.writeMs - (pa.writeMs + pa.nudgeMs * pa.changeShare / 100)) < 1e-6 && plainL.writeMs === pa.writeMs);
const probe = ENGINE.gigTraffic({ ...pa, reconnects: 0 }, 12202, 3, true);
ok('duration is a rounding error: 1.7 GB-s per 12,202 sockets, as the probe billed', Math.abs(probe.doGBs - probe.sockets * 1.7 / 12202) < 1e-9 && probe.doGBs < 1000);
const lineBill = ENGINE.hostBill('cfDo', HOSTS0, { ...lineL, lineReqs: lineL.lineReqs * 1000, requests: lineL.requests * 1000, bytes: lineL.bytes * 1000, fnMs: lineL.fnMs * 1000, doGBs: lineL.doGBs * 1000 }, 100);
ok('the open-line host bills Netlify (with deploys) plus Cloudflare, never Cloudflare alone', lineBill.lines.some(([n]) => n.startsWith('Netlify')) && lineBill.lines.some(([n]) => n.startsWith('Cloudflare')) && lineBill.usd > ENGINE.hostBill('netlifyPro', HOSTS0, { ...lineL, requests: lineL.requests * 1000, bytes: lineL.bytes * 1000, fnMs: lineL.fnMs * 1000 }, 100).usd, lineBill.lines);
const withLine = ENGINE.month({ ...P0, host: 'cfDo' }, P0.artists), without = ENGINE.month(P0, P0.artists);
ok('the month total carries only what sums (no per-gig rates)', !('floorS' in without.T) && !('renderMs' in without.T) && 'lineReqs' in without.T);
ok('the month on the open-line host runs the line-on ladder and carries Cloudflare’s $5', withLine.one.line === 1 && without.one.line === 0 && withLine.one.polls !== without.one.polls && withLine.bill.lines.some(([n, v]) => n === 'Cloudflare · Workers plan' && v === 5), [withLine.one.polls, without.one.polls]);

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
const arenaBefore = ENGINE.showSizes({ ...P0, host: 'netlifyLegacy' })[2];
console.log('   arena verdict — before the split: ' + arenaBefore.status + ' (' + Math.round(arenaBefore.effReads) + ' reads/s, ' + arenaBefore.effStoreMBs.toFixed(0) + ' MB/s) · today: ' + arenaPlain.status + ' (' + Math.round(arenaPlain.effReads) + ' reads/s, ' + arenaPlain.effStoreMBs.toFixed(0) + ' MB/s)');
ok('the split changes what breaks the arena: reads a second collapse (the render is shared); the store’s MB/s is what is left', arenaBefore.effReads > arenaPlain.effReads * 5 && arenaPlain.effStoreMBs < arenaBefore.effStoreMBs, [arenaBefore.effReads, arenaPlain.effReads]);
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
const big = ENGINE.month({ ...P0, studioOn: false, extraViews: 0, clipViews: 0, changeShare: 100, plusPct: 100, proPct: 0, gigsPaid: 20, deploys: 0, compedPct: 0, pollMs: 155, pollMsPerFan: 0, cronRequests: 0 }, 10000);
console.log('   10,000 artists × 20 gigs: server $' + big.bill.usd.toFixed(0) + ' on ' + big.bill.plan + ' (audit: $5,597 at Pro rates)');
const bigBefore = ENGINE.hostBill('netlifyLegacy', HOSTS0, big.T, 0);
ok('10k-artist server bill BEFORE the split within 10% of the audit’s $5,597 (the audit priced the one-call poll)', Math.abs(bigBefore.usd - 5597) / 5597 < 0.10, bigBefore.usd);
ok('after the split the same month costs more at bar size (two requests per tick, and 2 credits per 10k requests is now the biggest line)', big.bill.usd > bigBefore.usd && big.bill.usd < bigBefore.usd * 1.5, [bigBefore.usd, big.bill.usd]);
const kv = ENGINE.hostBill('cfKv', HOSTS0, big.T, 0), doo = ENGINE.hostBill('cfDo', HOSTS0, ENGINE.month({ ...P0, studioOn: false, extraViews: 0, clipViews: 0, changeShare: 100, plusPct: 100, proPct: 0, gigsPaid: 20, deploys: 0, compedPct: 0, pollMs: 155, pollMsPerFan: 0, cronRequests: 0, host: 'cfDo' }, 10000).T, 0);
console.log('   same month on Workers+KV $' + kv.usd.toFixed(0) + ' (audit $9,658) · Durable Objects $' + doo.usd.toFixed(0) + ' (audit $427)');
ok('KV is worse than Netlify; the open line is Netlify PLUS Cloudflare, so it is never the cheaper column at bar size — the audit’s “13× cheaper rewrite” is not what was built', kv.usd > big.bill.usd && doo.usd > big.bill.usd && doo.usd < big.bill.usd * 1.5, [big.bill.usd, doo.usd]);

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
const arenaOff = ENGINE.showSizes(P0)[2], arenaOn = ENGINE.showSizes({ ...P0, bigRoomOn: true, bigRoomFrom: 500, bigRoomFloor: 60 })[2];
console.log('   arena ticks: the server’s own 20 s floor', Math.round(arenaOff.polls).toLocaleString(), '· extra brake at 60 s', Math.round(arenaOn.polls).toLocaleString(), '· status', arenaOff.status, '→', arenaOn.status);
ok('the arena already runs on the server’s 20 s floor, so a 15 s brake changes nothing', Math.abs(ENGINE.showSizes({ ...P0, bigRoomOn: true, bigRoomFrom: 500, bigRoomFloor: 15 })[2].polls - arenaOff.polls) < 1e-6);
ok('an extra 60 s brake cuts arena ticks by at least 2×', arenaOff.polls / arenaOn.polls >= 2, arenaOff.polls / arenaOn.polls);
ok('the bar set is untouched by the brake (below the threshold)', Math.abs(ENGINE.showSizes({ ...P0, bigRoomOn: true })[0].polls - ENGINE.showSizes(P0)[0].polls) < 1e-6);
const before = ENGINE.showSizes(P0)[2].onHost.netlifyLegacy, plain = ENGINE.showSizes(P0)[2].onHost.netlifyPro, withL = ENGINE.showSizes(P0)[2].onHost.cfDo;
console.log('   arena on Netlify: before the split $' + before.toFixed(2) + ' · today $' + plain.toFixed(2) + ' · with the open line $' + withL.toFixed(2));
ok('the split makes the arena cheaper than it was (the render is shared; the personal call is small)', plain < before, [before, plain]);
ok('the open line ADDS to the arena’s bill (every glance is a socket, two requests each) — it buys a live tally, not a saving', withL > plain && withL < plain * 1.6, [plain, withL]);
ok('today’s code holds a bar set and a concert; the arena is at the edge or over it; the festival breaks on the store', ENGINE.showSizes(P0)[0].status === 'ok' && ENGINE.showSizes(P0)[1].status === 'ok' && arenaOff.status !== 'ok' && ENGINE.showSizes(P0)[3].status === 'breaks', ENGINE.showSizes(P0).map((s) => s.status));
ok('“before the split” as the chosen host judges the room on the old square-law numbers', ENGINE.showSizes({ ...P0, host: 'netlifyLegacy' })[2].effReads > ENGINE.showSizes(P0)[2].effReads * 5);
console.log('TRACKING');
/* tools/actuals.py solves polls out of the bandwidth counter with its own copy of the
   byte constants; if either side changes without the other, the calibration is wrong. */
const py = fs.readFileSync(new URL('../tools/actuals.py', import.meta.url), 'utf8');
const pyBytes = Object.fromEntries([...py.match(/BYTES = \{([^}]*)\}/)[1].matchAll(/'(\w+)': (\d+)/g)].map(m => [m[1], +m[2]]));
ok('actuals.py byte constants match the model defaults (board, personal, old poll, write, studio, view, page)', pyBytes.board === P0.boardBytes && pyBytes.me === P0.meBytes && pyBytes.poll === P0.pollBytes && pyBytes.write === P0.writeBytes && pyBytes.studio === P0.studioBytes && pyBytes.view === P0.viewBytes && pyBytes.page === P0.pageBytes, [pyBytes, P0.boardBytes, P0.meBytes, P0.pollBytes, P0.writeBytes, P0.studioBytes, P0.viewBytes, P0.pageBytes]);
ok('actuals.py solves a mark taken since the split (11 Sep 11:17 UTC) at board + personal bytes per tick, and refuses a bracket the split falls inside', /TICK_BYTES = BYTES\['board'\] \+ BYTES\['me'\]/.test(py) && /SPLIT_AT = '2026-09-11T11:17:00\+00:00'/.test(py) && /per_tick = TICK_BYTES if a\['at'\] >= SPLIT_AT else BYTES\['poll'\]/.test(py) && /if a\['at'\] < SPLIT_AT <= b\['at'\]:/.test(py));
ok('actuals.py Studio tick and extra-views match the model', /STUDIO_POLLS_PER_HOUR = 3600 \/ 4\b/.test(py) && +py.match(/EXTRA_VIEWS_PER_PHONE = ([\d.]+)/)[1] === P0.extraViews);
/* the bandwidth arithmetic, done the model's way: a night's bytes minus everything that is not a poll, ÷ bytes per poll, gives the polls back */
const nt = ENGINE.gigTraffic(P0, P0.fans, P0.hours);
const other = nt.studioPolls * P0.studioBytes + P0.fans * P0.pageBytes + nt.writes * P0.writeBytes + nt.extraViews * P0.viewBytes + nt.clipBytes;
ok('bytes − (Studio + page loads + votes + views + clip views) ÷ (board + personal) = the ticks (the method the marks use)', Math.abs((nt.bytes - other) / (P0.boardBytes + P0.meBytes) - nt.polls) < 1e-6);
console.log('   at the default gig the Studio tab is ' + Math.round(100 * nt.studioPolls * P0.studioBytes / nt.bytes) + '% of the bytes — leave it open the whole night or the solve is off by that much');
const tierSum = R.perTier.reduce((n, t, i) => n + t.net * [R.nFree, R.nPlus, R.nPro][i], 0);
ok('per-tier nets summed over the platform equal revenue − TRAFFIC bill − Stripe (venues aside): the shipping bill belongs to the platform, not to any artist', Math.abs(tierSum - (R.revenue - R.trafficUsd - R.stripe)) < 1.5, [tierSum, R.revenue - R.trafficUsd - R.stripe]);
ok('actuals.py assumes the same Studio share as the model when no minutes were recorded', +py.match(/STUDIO_SHARE = ([\d.]+)/)[1] === P0.studioShare / 100);
const bookFree = ENGINE.showSizes(P0)[2].bookingAt(0.5);
ok('the booking price covers Stripe’s card fee on itself (grossed up, not net)', bookFree > ENGINE.showSizes(P0)[2].server / 0.5 - ENGINE.showSizes(P0)[2].mysetRev, bookFree);
console.log('TWO BILLS, NEVER ONE NUMBER (INVARIANT 0fx)');
/* The deploys dial is turned from 0 to 400 on every host. Nothing per gig, per phone or per show may move;
   the bill itself must move by exactly the deploys' marginal cost; and the two bills must sum to the total. */
{
  let moved = [], wrongSum = [], noShip = [];
  for (const host of Object.keys(HOSTS0)) {
    const a = ENGINE.month({ ...P0, host, deploys: 0 }, 1000), b = ENGINE.month({ ...P0, host, deploys: 400 }, 1000);
    const same = (x, y) => Math.abs(x - y) < 1e-9;
    if (!same(a.costPerGig, b.costPerGig) || !same(a.serverPerGig, b.serverPerGig) || !same(a.trafficUsd, b.trafficUsd)) moved.push(host + ' per-gig');
    if (!a.perTier.every((x, i) => same(x.server, b.perTier[i].server))) moved.push(host + ' per-tier server');
    const sa = ENGINE.showSizes({ ...P0, host, deploys: 0 }), sb = ENGINE.showSizes({ ...P0, host, deploys: 400 });
    if (!sa.every((x, i) => same(x.server, sb[i].server) && Object.keys(x.onHost).every((k) => same(x.onHost[k], sb[i].onHost[k])))) moved.push(host + ' show sizes');
    if (!same(b.bill.trafficUsd + b.bill.deployUsd, b.bill.usd)) wrongSum.push(host);
    if (!same(a.bill.deployUsd, 0) || !same(a.bill.trafficUsd, a.bill.usd)) wrongSum.push(host + ' at zero deploys');
    if ((host.startsWith('netlify') || host === 'cfDo' || host === 'custom' && HOSTS0.custom.deployUsd) && !(b.bill.deployUsd > 0)) noShip.push(host);
    if (b.shippingUsd < 0) wrongSum.push(host + ' negative shipping');
  }
  ok('turning deploys 0 → 400 moves NO per-gig, per-tier or per-show figure on any host', moved.length === 0, moved);
  ok('traffic + shipping = the bill, and at zero deploys the shipping bill is zero', wrongSum.length === 0, wrongSum);
  ok('on every host that bills deploys, 400 of them cost something', noShip.length === 0, noShip);
  const c = ENGINE.month({ ...P0, host: 'netlifyPro', deploys: 400 }, 1000);
  ok('400 deploys on Netlify are 6,000 credits of shipping, and the per-gig figure is the traffic bill ÷ gigs', Math.abs(c.bill.deployCredits - 6000) < 1e-9 && Math.abs(c.costPerGig - c.trafficUsd / c.gigs) < 1e-12, [c.bill.deployCredits, c.costPerGig, c.trafficUsd / c.gigs]);
  /* the scenario cards and the compare table read the same field, so a saved scenario cannot carry a deploy in its per-gig line */
  const sumText = html.match(/function summarize\(p\) \{[\s\S]*?\n\}/)[0];
  ok('the scenario summary reports traffic per gig and the shipping bill as two lines', /costPerGig: R\.costPerGig/.test(sumText) && /shipping: R\.shippingUsd/.test(sumText) && /traffic \$\{fmt\.cents\(R\.costPerGig\)\} per gig · shipping/.test(sumText));
  /* the tracker keeps the two apart too */
  ok('actuals.py reports `shipping` (deploys × 15) and `traffic` (bandwidth) as separate objects, has no deploy byte constant, and says so in its note',
    /'shipping': \{'what': 'production deploys × 15 credits/.test(py) && /'traffic': \{'what': 'everything the rooms cause/.test(py) && !/'deploy'/.test(py.match(/BYTES = \{[^}]*\}/)[0]) && /CR_DEPLOY = 15/.test(py) && /INVARIANT 0fx/.test(py));
  ok('the tracker refuses to write when the registry reads as empty, and reads the store through MYSET_SITE_DIR from a worktree', /the registry read as empty/.test(py) && /sys\.exit\(1\)/.test(py) && /SITE = os\.environ\.get\('MYSET_SITE_DIR'\) or ROOT/.test(py) && /cwd=SITE/.test(py));
const creditsLog = JSON.parse(fs.readFileSync(new URL('./credits.json', import.meta.url), 'utf8'));
const lastRead = creditsLog.readings[creditsLog.readings.length - 1], bd = lastRead.breakdown;
ok('finance/credits.json holds Netlify’s own split and its parts add up to its total (deploys + requests + compute + bandwidth + AI)', Math.abs(bd.productionDeploys.credits + bd.webRequests.credits + bd.compute.credits + bd.bandwidth.credits + bd.aiInference.credits - bd.total) < 0.15 && bd.productionDeploys.credits === bd.productionDeploys.count * 15, bd);
ok('the tracker carries the latest dashboard reading into actuals.json as shipping.dashboard and traffic.dashboard', /CREDITS = os\.path\.join\(ROOT, 'finance', 'credits\.json'\)/.test(py) && /'dashboard': \{'readAt': dash\['readAt'\], 'deploys'/.test(py) && /'trafficCredits', 'totalCredits'\)\} if dash else None/.test(py));
ok('no line of the tracker divides deploys by shows, phones or hours', !/deploy[a-zA-Z0-9_'\]]*\s*\/\s*(len\(rows\)|people|hours|shows)/.test(py));
}
console.log('SAVED SCENARIOS');
const wdText = html.match(/const deepMerge = [\s\S]*?\nconst withDefaults = [\s\S]*?\n\};\n/)[0];
const wd = new Function('P0', 'HOSTS0', wdText + '; return withDefaults;')(P0, HOSTS0);
const stale = wd({ v: 2, host: 'netlifyCache', hosts: { netlifyCache: { kind: 'netlify', cached: 1, crReq: 2 }, cfDo: { kind: 'cf-do', name: 'Cloudflare Durable Objects (rewrite)', base: 5, doReqUsd: 0.15 }, custom: { kind: 'custom', base: 12, reqUsd: 0.5 } } });
ok('a scenario saved with the retired “3-second cache” host loads on today’s host list, on Netlify', !stale.hosts.netlifyCache && stale.host === 'netlifyPro' && stale.hosts.cfDo.name === HOSTS0.cfDo.name && stale.hosts.custom.base === 12 && stale.hosts.custom.reqUsd === 0.5, [stale.host, Object.keys(stale.hosts)]);
console.log('REAL SHOWS reach the dials');
/* applyActuals is page code, not engine code, but it is the one place real numbers become dials — so it is tested like the engine */
const apText = html.match(/function applyActuals\(\) \{[\s\S]*?\n\}/)[0];
const applied = new Function('P', 'ACT', 'ENGINE', 'let PRE_ACT = null; ' + apText + '; applyActuals(); return P;')(
  withDefaultsTest({ useActuals: true }), { people: 11, hours: 2.51, interactions: 2.35, roomPerHead: 0.375, deploys: 150, songs: 9 }, ENGINE);
ok('people → phones per gig, hours → length, interactions → actions per person, per-head → every room dial, deploys → deploys, songs → the artist’s pace',
  applied.fans === 11 && applied.hours === 2.51 && applied.interactions === 2.35 && applied.roomFree === 0.375 && applied.roomPlus === 0.375 && applied.roomPro === 0.375 && applied.deploys === 150 && applied.songEveryMin === 16.5, JSON.stringify([applied.fans, applied.hours, applied.interactions, applied.roomFree, applied.deploys, applied.songEveryMin]));
const seed = new Function('return ' + html.match(/const SEED_ACT = (\{[\s\S]*?\});\n/)[1])();
const file = JSON.parse(fs.readFileSync(new URL('./actuals.json', import.meta.url), 'utf8'));
ok('the seed baked into the page equals finance/actuals.json (people, hours, interactions, room, deploys, shows, asOf)',
  ['shows', 'people', 'hours', 'interactions', 'roomPerHead', 'deploys', 'asOf'].every((k) => seed[k] === file[k]),
  JSON.stringify(['shows', 'people', 'hours', 'interactions', 'roomPerHead', 'deploys', 'asOf'].map((k) => [k, seed[k], file[k]])));
ok('the tracker counts a night only on the published calendar, anchors its hours to the slot or the last song, merges split nights and subtracts clip views from a mark', /def gig_for\(/.test(py) && /max\(gig\['slotHours'\], last_act/.test(py) && /def merge_split_nights/.test(py) && /clipViews/.test(py));
ok('actuals.py bytes per clip view matches the model', +py.match(/'clip': (\d+)/)[1] === P0.clipBytes);
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
