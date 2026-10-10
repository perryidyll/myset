/* NO MARKUP IN A SHORT FIELD  (decision 0203, INVARIANT 0jf)

   The scale audit of 2 October 2026 (critical): any artist could plant script on
   their own public page, because the management name was written into artist.html
   without escaping — on the site that holds Studio sign-ins. #204 escaped it on the
   page. The audit's second half: strip angle brackets when the profile is saved, so
   a page that forgets to escape draws text, not a tag.

   This pins it for every short field an artist, a venue or a fan types that a page
   draws: the artist's names, tagline, style and management; a venue's name, tagline,
   city and menu; a request's title; a review's name; a diary page's title; a shop
   wish. Long text (a bio, an About, a story) keeps its own characters and is escaped
   where it is drawn. */
process.env.ADMIN_CODE = 'devlocal';
const { readFileSync } = await import('node:fs');
const { normProfile } = await import('../netlify/functions/_profile.mjs');
const { normVenue } = await import('../netlify/functions/_venues.mjs');
const { normPage } = await import('../netlify/functions/_diary.mjs');
const admin = (await import('../netlify/functions/admin.mjs')).default;
const reqFn = (await import('../netlify/functions/request.mjs')).default;
const { readRequests } = await import('../netlify/functions/_requests.mjs');
const { DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const BAD = '<img src=x onerror=alert(1)>';
const tagFree = (s) => !/[<>]/.test(String(s));

console.log('\nAN ARTIST\'S SHORT FIELDS');
{
  const p = normProfile({ first: 'Ann' + BAD, last: '<b>Lee</b>', tagline: 'Live ' + BAD + ' tonight', style: '<script>x</script>Folk',
                          management: BAD + 'Big Mgmt', managementUrl: 'https://mgmt.example.com', bio: 'I <3 bars\n<i>really</i>' });
  ok('THE FIX: the management name holds no tag', tagFree(p.management), p.management);
  eq('and keeps its words', p.management, 'img src=x onerror=alert(1)Big Mgmt');
  ok('nor do the names, the tagline or the style', [p.first, p.last, p.name, p.tagline, p.style].every(tagFree), p);
  eq('the bio keeps its own characters (it is escaped where it is drawn)', p.bio, 'I <3 bars\n<i>really</i>');
  eq('an ordinary name is untouched', normProfile({ first: 'Zoë', last: "O'Neil & Co." }).name, "Zoë O'Neil & Co.");
}

console.log('\nA VENUE\'S SHORT FIELDS');
{
  const v = normVenue({ name: 'The ' + BAD + 'Anchor', tagline: '<b>Live</b> music', city: '<i>Leeds</i>', country: 'UK',
                        about: 'Fish & chips <3', menu: { note: BAD, items: [{ section: '<b>Food</b>', name: 'Pie' + BAD, price: '£5', note: '<i>hot</i>' }] } });
  ok('the name, tagline and city hold no tag', [v.name, v.tagline, v.city].every(tagFree), v);
  ok('nor does the menu', tagFree(JSON.stringify(v.menu)), v.menu);
  eq('the About keeps its own characters', v.about, 'Fish & chips <3');
}

console.log('\nA DIARY PAGE\'S TITLE');
{
  const d = normPage({ id: 'dabc123', title: BAD + 'Summer', when: '<b>2019</b>', body: 'It was <great>' });
  ok('title and when hold no tag', tagFree(d.title) && tagFree(d.when), d);
}

console.log('\nA FAN\'S REQUEST TITLE');
{
  await admin(new Request('https://x/api/admin?code=devlocal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'askSet', kind: 'song', on: true, cost: 1 }) }));
  await admin(new Request('https://x/api/admin?code=devlocal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status', status: 'live' }) }));
  const r = await reqFn(new Request('https://x/api/request?fan=fanx', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'song', title: 'Wonder' + BAD + 'wall', artist: '<b>Oasis</b>' }) }));
  ok('the request is taken', r.status === 200, r.status);
  const row = (await readRequests(DEFAULT_ARTIST)).list.find((x) => /Wonder/.test(x.title));
  ok('THE FIX: its title and artist hold no tag', row && tagFree(row.title) && tagFree(row.artist), row);
}

console.log('\nEVERY SHORT-FIELD CLEANER THAT FEEDS A PAGE STRIPS THEM');
for (const f of ['_profile', '_maps', '_requests', '_community', '_diary', '_wishes']) {
  const src = readFileSync(new URL(`../netlify/functions/${f}.mjs`, import.meta.url), 'utf8');
  const line = (src.match(/const clean = \(v, n\) => [^\n]*/) || [''])[0];
  ok(`${f}.mjs`, line.includes(".replace(/[<>]/g, '')"), line);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
