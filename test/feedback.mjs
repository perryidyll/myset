/* THE "ENJOYING MYSET?" PROMPT.

   Asked of the AUDIENCE — the people who use the product without ever signing up,
   and who therefore never get asked anything. Two rules keep it from being the
   reason somebody closes the tab, and both are enforced on the SERVER as well as in
   the page, because a localStorage rule is a suggestion:
     · one rating per device per week
     · nothing stored without a star count
   And it must never be write-only: the artist has to be able to read it. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const fbFn    = (await import('../netlify/functions/feedback.mjs')).default;
const F       = await import('../netlify/functions/_feedback.mjs');
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
const rate = (fan, stars, note) => hit(fbFn, 'https://x/api/feedback', { fan, stars, note });
const stage = () => hit(stageFn, 'https://x/api/stage?code=devlocal');

console.log('\nSETUP');
await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'addSong', title: 'Alpha', artist: 'T' });
await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'status', status: 'live' });

console.log('\nA RATING IS A STAR COUNT — A STRAY TAP IS NOT FEEDBACK');
eq('no stars is refused', (await rate('f1', 0, 'hi')).status, 400);
eq('six stars is refused', (await rate('f1', 6, '')).status, 400);
eq('nonsense is refused', (await rate('f1', 'lots', '')).status, 400);
ok('and nothing was stored', (await F.readFeedback('perry-idyll')).count === 0);

console.log('\nA REAL RATING LANDS, WITH OR WITHOUT A NOTE');
ok('five stars and a note', (await rate('f1', 5, 'MySet makes live performances so much more fun!')).ok);
ok('four stars, no note', (await rate('f2', 4, '')).ok);
const d1 = await F.readFeedback('perry-idyll');
eq('two ratings', d1.count, 2);
eq('the running total is kept', d1.sum, 9);
eq('a note is stored', (d1.list.find((r) => r.fan === 'f1') || {}).note,
   'MySet makes live performances so much more fun!');

console.log('\nONE PER DEVICE PER WEEK, ENFORCED SERVER-SIDE');
const twice = await rate('f1', 1, 'changed my mind');
ok('a second rating this week is accepted politely', twice.ok, twice);
eq('...and says it did nothing', twice.already, true);
const d2 = await F.readFeedback('perry-idyll');
eq('still two ratings', d2.count, 2);
eq('and the first note is untouched', (d2.list.find((r) => r.fan === 'f1') || {}).note,
   'MySet makes live performances so much more fun!');

console.log('\nA WEEK LATER THE SAME DEVICE REPLACES ITS OWN ROW, NOT ADDS ONE');
const { casDoc } = await import('../netlify/functions/_lib.mjs');
await casDoc('fb_perry-idyll', () => ({}), (d) => {
  const mine = d.list.find((r) => r.fan === 'f1');
  mine.at = Date.now() - (F.ONE_WEEK + 60e3);
  return true;
});
ok('accepted', (await rate('f1', 2, 'the queue moved too slowly')).ok);
const d3 = await F.readFeedback('perry-idyll');
eq('still one row for that device', d3.list.filter((r) => r.fan === 'f1').length, 1);
eq('the count did not grow', d3.count, 2);
eq('and the average moved to reflect the new answer', d3.sum, 6);

console.log('\nA LONG NOTE IS TRIMMED, NOT REFUSED');
ok('accepted', (await rate('f3', 3, 'x'.repeat(900))).ok);
eq('trimmed to the cap',
   ((await F.readFeedback('perry-idyll')).list.find((r) => r.fan === 'f3') || {}).note.length,
   F.MAX_NOTE);

console.log('\nTHE ARTIST CAN ACTUALLY READ IT  (not write-only)');
const st = await stage();
ok('the stage payload carries it', !!st.feedback, Object.keys(st));
eq('with the count', st.feedback.count, 3);
ok('and an average', typeof st.feedback.average === 'number', st.feedback.average);
ok('and the notes', st.feedback.recent.some((r) => /queue moved too slowly/.test(r.note)),
   st.feedback.recent);
ok('THE PRIVACY LINE: never a device id', !JSON.stringify(st.feedback.recent).includes('f1'),
   st.feedback.recent);
const studio = readFileSync(new URL('../public/studio.html', import.meta.url), 'utf8');
ok('and the Studio renders it', /function fbCard\(/.test(studio) && /fbCard\(\)/.test(studio));

console.log('\nTHE PAGE\'S OWN RULES ARE THE ONES PERRY ASKED FOR');
const page = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
ok('an hour of use before asking', /FB_AFTER\s*=\s*60\s*\*\s*60e3/.test(page));
ok('at most once a week', /FB_EVERY\s*=\s*7\s*\*\s*24\s*\*\s*3600e3/.test(page));
ok('time is only counted while the page is VISIBLE',
   /visibilityState\s*===\s*'visible'/.test(page));
ok('and banked, so it survives a reload', /myset\.fbMs/.test(page));
ok('never over another sheet', /classList\.contains\('on'\)\).*return false/s.test(page));
ok('never mid-vote', /busy\.size\).*return false/s.test(page));
ok('answered once means never again', /myset\.fbDone/.test(page));
ok('the placeholder is the line Perry wrote',
   /placeholder="MySet makes live performances so much more fun!"/.test(page));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
