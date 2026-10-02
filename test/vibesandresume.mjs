/* TWO SMALL ONES FROM THE SCALE AUDIT  (decision 0156, INVARIANT 0il)

   1. Free "vibe" taps shared the thirty waiting places with song requests and
      birthdays, so thirty free mood taps in a night shut the door on a fan with votes
      (or a card authorised) to spend. Vibes now count on their own.
   2. "Resume it instead" was refused on the free plan's last show: a resume counted as
      another show, so an End tapped by mistake on the tenth could not be undone. A
      resume of the same night is now neither counted nor refused — and nothing else
      gets past the cap: a new show, a resume of an older night, or of a night given
      back, meet it exactly as before. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const reqFn = (await import('../netlify/functions/request.mjs')).default;
const { MAX_PENDING, MAX_VIBES, MAX_KEPT, readRequests } = await import('../netlify/functions/_requests.mjs');
const { getShow, mutateShow, mutateFan, DEFAULT_ARTIST, SAME_NIGHT_MS } = await import('../netlify/functions/_lib.mjs');
const { PLANS } = await import('../netlify/functions/_plan.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const ask = (fan, body) => hit(reqFn, `https://x/api/request?fan=${fan}`, body);

console.log('\nFREE VIBES NEVER TAKE A PAID REQUEST\'S PLACE');
{
  await A('addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
  await A('askSet', { kind: 'song', on: true });
  await A('status', { status: 'live' });
  const cost = (await getShow(DEFAULT_ARTIST)).requests.cost;
  eq('vibes have their own count, the same size', MAX_VIBES, MAX_PENDING);
  let vibes = 0;
  for (let i = 0; i < MAX_VIBES; i++) vibes += (await ask(`v${i}`, { kind: 'vibe', title: 'Groovy' })).ok ? 1 : 0;
  eq(`${MAX_VIBES} free vibe taps go in`, vibes, MAX_VIBES);
  await mutateFan(DEFAULT_ARTIST, 'payer', (me) => { me.extra = cost + 5; return true; });
  const paid = await ask('payer', { kind: 'song', title: 'Dreams' });
  ok('THE FIX: a fan spending votes on a song request still gets in', paid.ok, paid);
  const more = await ask('one-more', { kind: 'vibe', title: 'Chill' });
  eq('one vibe more than its own count waits, and says it is the vibes', [more.status, /vibes/i.test(more.error || '')], [429, true]);
  let songs = 1;
  for (let i = 1; i < MAX_PENDING; i++) {
    await mutateFan(DEFAULT_ARTIST, `s${i}`, (me) => { me.extra = cost; return true; });
    songs += (await ask(`s${i}`, { kind: 'song', title: `Song ${i}` })).ok ? 1 : 0;
  }
  eq(`song requests still have all ${MAX_PENDING} places`, songs, MAX_PENDING);
  await mutateFan(DEFAULT_ARTIST, 'late', (me) => { me.extra = cost; return true; });
  const full = await ask('late', { kind: 'song', title: 'One too many' });
  eq('and their own cap still holds', [full.status, /a lot of requests/.test(full.error || '')], [429, true]);
  const list = (await readRequests(DEFAULT_ARTIST)).list;
  ok(`the list stays bounded: ${list.length} rows, within ${MAX_KEPT}`, list.length <= MAX_KEPT && MAX_VIBES + MAX_PENDING <= MAX_KEPT, list.length);
  const mine = await hit(reqFn, 'https://x/api/request?fan=v0');
  eq('a fan still sees their own vibe, waiting, as before', (mine.mine || []).map((r) => [r.kind, r.title, r.status]), [['vibe', 'Groovy', 'pending']]);
}

console.log('\nAN ACCIDENTAL END ON THE LAST FREE SHOW CAN BE UNDONE');
const CAP = PLANS.free.gigs;
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Last', slug: 'ana-last' });
const TA = await signToken('ana@example.com', revOf(await readArtists(), ana.artistId));
const AA = (action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, TA);
const used = async () => (await getShow(ana.artistId)).gigCount;
{
  await AA('addSong', { title: 'Valerie', artist: 'Amy Winehouse' });
  for (let i = 0; i < CAP; i++) {
    ok(`show ${i + 1} of ${CAP}`, (await AA('newShow')).ok);
    if (i < CAP - 1) await AA('status', { status: 'ended', title: `Night ${i + 1}` });
  }
  eq('all of them used', await used(), CAP);
  ok('she taps End on the last one by mistake', (await AA('status', { status: 'ended', title: 'Last' })).ok);
  const st = (await AA('window', { open: true })).stage.show;
  eq('the Studio is told the resume is the same night', st.resumeSameNight, true);
  const r = await AA('status', { status: 'live' });
  ok('THE FIX: "Resume it instead" works at the cap', r.ok, r);
  eq('the show is live again', (await getShow(ana.artistId)).status, 'live');
  eq('and it was not counted again', await used(), CAP);
  ok('she ends it for real', (await AA('status', { status: 'ended', title: 'Last' })).ok);
  ok('and can still undo that, the same night', (await AA('status', { status: 'live' })).ok);
  eq('still one show', await used(), CAP);
  await AA('status', { status: 'ended', title: 'Last' });
}

console.log('\nNOTHING ELSE GETS PAST THE CAP');
{
  const fresh = await AA('newShow');
  eq('a new show at the cap is refused, with the same words', [fresh.status, /your \d+ free shows\./i.test(fresh.error || '')], [402, true]);
  await mutateShow(ana.artistId, (s) => { s.startedAt = Date.now() - SAME_NIGHT_MS - 60e3; return true; });
  const st = (await AA('window', { open: true })).stage.show;
  eq('a night that began over twelve hours ago is not the same night', st.resumeSameNight, false);
  const old = await AA('status', { status: 'live' });
  eq('resuming it at the cap is refused', old.status, 402);
  eq('and changes nothing', [(await getShow(ana.artistId)).status, await used()], ['ended', CAP]);
}

console.log('\nBELOW THE CAP: THE SAME NIGHT IS ONE SHOW; AN OLDER NIGHT OR ONE GIVEN BACK COUNTS AGAIN');
{
  const bo = await createArtist({ email: 'bo@example.com', name: 'Bo Below', slug: 'bo-below' });
  const TB = await signToken('bo@example.com', revOf(await readArtists(), bo.artistId));
  const B = (action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, TB);
  const n = async () => (await getShow(bo.artistId)).gigCount;
  await B('addSong', { title: 'Dreams', artist: 'Fleetwood Mac' });
  ok('a show', (await B('newShow')).ok);
  await B('status', { status: 'ended' });
  ok('resumed the same night', (await B('status', { status: 'live' })).ok);
  eq('one show, not two', await n(), 1);
  await B('status', { status: 'ended' });
  await mutateShow(bo.artistId, (s) => { s.startedAt = Date.now() - SAME_NIGHT_MS - 60e3; return true; });
  ok('resumed after twelve hours', (await B('status', { status: 'live' })).ok);
  eq('counts again — a night cannot be stretched over many', await n(), 2);
  ok('ended and discarded', (await B('status', { status: 'ended', discard: true })).ok);
  eq('the discard gives back everything that night used', await n(), 0);
  ok('resumed after the discard', (await B('status', { status: 'live' })).ok);
  eq('a night given back counts again when it is resumed', await n(), 1);
  ok('a new show, tonight', (await B('newShow')).ok);
  eq('counted', await n(), 2);
  ok('discarded within the hour', (await B('status', { status: 'ended', discard: true })).ok);
  eq('given back', await n(), 1);
  ok('and resumed straight away', (await B('status', { status: 'live' })).ok);
  eq('THE RULE: a night given back is not "the same night" — resuming it counts', await n(), 2);
  // a paid plan is never counted, resumed or not
  await mutateArtists((reg) => { reg.byId[bo.artistId].plan = 'plus'; return true; });
  await B('status', { status: 'ended' });
  ok('on a paid plan, a resume', (await B('status', { status: 'live' })).ok);
  eq('counts nothing', await n(), 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
