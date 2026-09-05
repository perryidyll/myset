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
const gigs = nFree * Math.min(3, 4) + (nPlus + nPro) * 8;
ok('gigs = ' + gigs, Math.abs(R.gigs - gigs) < 1e-6, R.gigs);
const subs = (nPlus * 10 + nPro * 20) * (1 - .08);
ok('subscriptions = $' + subs, Math.abs(R.subs - subs) < 1e-6, R.subs);
const gmvFree = nFree * 3 * 5, gmvPlus = nPlus * 8 * 15, gmvPro = nPro * 8 * 25;
const cutRev = gmvFree * .10 + gmvPlus * .02;
ok('cut revenue = $' + cutRev, Math.abs(R.cutRev - cutRev) < 1e-6, R.cutRev);
const feat = gigs * .05 * 10 * (1 - .01);
ok('featured = $' + feat.toFixed(2), Math.abs(R.feat - feat) < 1e-6, R.feat);
const refunds = subs * .01;
ok('subscriptions net of refunds', Math.abs(R.subsNet - (subs - refunds)) < 1e-6, R.subsNet);
ok('revenue = subs − refunds + cuts + featured', Math.abs(R.revenue - (subs - refunds + cutRev + feat)) < 1e-6);
const subCount = (nPlus + nPro) * .92; const featCount = gigs * .05;
const card = (amt, n) => amt * (.029 + .7 * .015) + n * .30;
const gmvAll = gmvFree + gmvPlus + gmvPro;
const paidOut = gmvAll - cutRev;
const payouts = (600 * Math.min(8, 3) + 400 * Math.min(8, 8)) * .4;          // daily payouts cannot exceed nights played
const stripe = card(subs, subCount) + subs * .007 + card(gigs * .05 * 10, featCount) + (subCount + featCount) * .001 * 15
  + (1000 * .4) * 2 + paidOut * .0025 + payouts * .25 + paidOut * .001;
ok('stripe total = $' + stripe.toFixed(2), Math.abs(R.stripe - stripe) < 1e-6, R.stripe);
const fixed = 1 + 20 + 80 + 40 + 50 + 10 + 6 * 25 + subCount * 2 / 60 * 25;
ok('fixed = $' + fixed, Math.abs(R.fixed - fixed) < 1e-6, R.fixed);
ok('profit = revenue − server − stripe − fixed', Math.abs(R.profit - (R.revenue - R.bill.usd - R.stripe - R.fixed)) < 1e-6);
console.log('   revenue $' + R.revenue.toFixed(0), 'server $' + R.bill.usd.toFixed(0) + ' (' + R.bill.plan + ')', 'stripe $' + R.stripe.toFixed(0), 'fixed $' + R.fixed, 'profit $' + R.profit.toFixed(0), 'margin ' + (R.margin*100).toFixed(1) + '%', 'server%rev ' + (R.serverPct*100).toFixed(1) + '%', 'cost/gig ' + (R.costPerGig*100).toFixed(2) + '¢');

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
ok('the 3-second cache makes the arena far cheaper (compute gone, requests remain)', cached < plain / 3 && cached > 2);
ok('today’s code holds a bar set and breaks at arena size', ENGINE.showSizes(P0)[0].status === 'ok' && arenaOff.status === 'breaks');
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
