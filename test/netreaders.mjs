/* THE LAST FACE-VALUE READERS (decision 0179).

   Decision 0177 writes what a refund or a chargeback took back as `lost` (cents) on
   the tip or the paid marker, and 0194 netted the revenue feed, the metrics and the
   venue list. Three readers still summed `amount` as it was: the discard warning's
   "money taken tonight", the Money tab's all-time tips and the sheet's pack and tip
   counts. They read through `netOf` / `tipGone` now. */
process.env.ADMIN_CODE = 'devlocal';
const { nightPaid } = await import('../netlify/functions/_lifecycle.mjs');
const { netOf, tipGone, mutateMeta, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const admin = (await import('../netlify/functions/admin.mjs')).default;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

console.log('\nWHAT A ROW IS WORTH AFTER ITS REFUNDS');
eq('a tip with nothing taken back is its amount', netOf({ amount: 10 }), 10);
eq('a tip half refunded is what stayed', netOf({ amount: 10, lost: 500 }), 5);
eq('a tip refunded in full is worth nothing', netOf({ amount: 10, lost: 1000 }), 0);
ok('and is gone', tipGone({ amount: 10, lost: 1000 }) && !tipGone({ amount: 10, lost: 500 }) && !tipGone({ amount: 10 }));

console.log('\nTHE DISCARD WARNING NAMES THE MONEY THAT STAYED');
{
  const since = 1000;
  const meta = {
    tips: [{ amount: 5, at: 2000 }, { amount: 10, at: 2000, lost: 1000 }, { amount: 4, at: 500 }],
    paid: { cs_a: { amount: 6, at: 3000 }, cs_b: { amount: 6, at: 3000, lost: 300 } },
  };
  eq('a refunded tip is not counted, a part-refunded pack counts what stayed', nightPaid(meta, since), { count: 3, total: 14 });
}

console.log('\nTHE MONEY TAB\'S ALL-TIME TIPS ARE NET');
{
  await admin(new Request('https://x/api/admin?code=devlocal', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'status', status: 'live' }) }));
  await mutateMeta(DEFAULT_ARTIST, (m) => { m.tips = [{ amount: 20, at: 1 }, { amount: 10, at: 2, lost: 1000 }, { amount: 8, at: 3, lost: 300 }]; });
  const r = await admin(new Request('https://x/api/admin?code=devlocal', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'window', open: true }) }));
  const st = (await r.json()).stage;
  eq('$20 + $0 + $5 = $25, not $38', st && st.tips && st.tips.allTime, 25);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
