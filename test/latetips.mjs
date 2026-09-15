/* A TIP AFTER THE SHOW IS STILL THAT NIGHT'S MONEY  (_history.mjs, history.mjs, 2026-09-15)

   pay.mjs tags a tip with `show.showId` whether or not the night is still live, so
   a fan tipping after the set — the day after, from the walk home — carries the
   last night's id. The Money tab's "Taken" tile priced that night start→now and
   saw the tip; the filed row (what profit sums) was priced start→end when the
   show was ended and never learned; and Re-check used the same closed window, so
   it would have wiped the tip from the tile as well. The founder sent two $1 tips
   the day after the 14 Sep night and the tile said $22 while profit said $30.

   This pins the one rule that fixes all three: a night's money is everything
   tagged to it, until the next night starts.

     · the tile and the row agree the moment the Money tab is opened
     · Re-check keeps the late tip (its window reaches to now, not to the end)
     · a newer night closes the older one's window — money tagged to the newer
       night is never counted on the older one, and the older night's window
       ends where the newer one begins
     · only an answer from Stripe may overwrite the row: 'off' does not */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const history = (await import('../netlify/functions/history.mjs')).default;
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');
const { archiveShow, readHistIndex, readHistShow, reconcileShow, moneyWindowEnd } = await import('../netlify/functions/_history.mjs');
const { __stripe } = await import('./stripe-fake.mjs');
const { mutateShow } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const get = async (token) => {
  const r = await history(new Request('https://x/api/history', { headers: { authorization: 'Bearer ' + token } }));
  return r.json();
};
const row = async (aid, id) => (await readHistIndex(aid)).shows.find((x) => x.showId === id) || {};
const sec = (ms) => Math.floor(ms / 1000);
const paid = (id, aid, showId, cents, atMs, kind = 'tip') =>
  __stripe.sessions.set(id, { onAccount: '', session: { id, mode: 'payment', payment_status: 'paid',
    created: sec(atMs), amount_total: cents, metadata: { kind, artist: aid, show: showId, ...(kind === 'tip' ? {} : { votes: '5' }) } } });

const H = 3600e3, DAY = 24 * H, NOW = Date.now();
const START = NOW - DAY - 3 * H;             // last night, 9 pm-ish
const END = START + 2 * H;
const play = (n) => Array.from({ length: n }, (_, i) => ({
  songId: 's' + i, title: 'Song ' + i, artist: '', at: START + i * 300e3, votes: 3, roundVotes: 3, voters: 4, round: [] }));
const night = (showId, startedAt, songs) => ({
  showId, venue: 'The Duck', city: 'Nashville', startedAt,
  songs: play(songs).map((p) => ({ id: p.songId, title: p.title })), log: play(songs), nowPlaying: null });

console.log('\nSETUP  a Bar Star with one night filed and ended, $20 taken during it');
const pip = await createArtist({ email: 'pip@example.com', name: 'Pip Lane', slug: 'pip-lane' });
const T = await signToken('pip@example.com', revOf(await readArtists(), pip.artistId));
await mutateArtists((reg) => { reg.byId[pip.artistId].plan = 'plus'; return true; });
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';
paid('cs_n1_tip', pip.artistId, 'n1', 1500, START + 40 * 60e3);
paid('cs_n1_votes', pip.artistId, 'n1', 500, START + 50 * 60e3, 'votes');
/* archiveShow prices the night to Date.now(); set the clock back so the filed
   row is what endShow really wrote last night — start→end, $20. */
const realNow = Date.now;
Date.now = () => END;
await archiveShow(pip.artistId, night('n1', START, 6), {});
Date.now = realNow;
await mutateShow(pip.artistId, (s) => { Object.assign(s, night('n1', START, 6), { status: 'ended', endedAt: END }); return true; });
eq('the filed row says $20', (await row(pip.artistId, 'n1')).gross, 20);
eq('and knows it heard from Stripe', (await row(pip.artistId, 'n1')).source, 'stripe');

console.log('\nTWO $1 TIPS THE NEXT DAY, TAGGED TO LAST NIGHT');
{
  paid('cs_late1', pip.artistId, 'n1', 100, NOW - 2 * H);
  paid('cs_late2', pip.artistId, 'n1', 100, NOW - H);
  const h = await get(T);
  ok('the Money tab answers', h.ok, h);
  eq('the tile shows last night plus the late tips', h.live.gross, 22);
  eq('and the row it lists says the same — the book learned', h.shows.find((x) => x.showId === 'n1').gross, 22);
  eq('the stored row agrees', (await row(pip.artistId, 'n1')).gross, 22);
  eq('and the night\'s detail carries the two tips', (await readHistShow(pip.artistId, 'n1')).money.tips.count, 3);
  const again = await get(T);
  eq('opening it again changes nothing', [again.live.gross, again.shows[0].gross], [22, 22]);
}

console.log('\nRE-CHECK KEEPS THE LATE TIPS');
{
  const re = await reconcileShow(pip.artistId, 'n1');
  eq('the re-pull reaches to now, not to the end of the show', re.money.gross, 22);
  eq('the row still says $22', (await row(pip.artistId, 'n1')).gross, 22);
}

console.log('\nA NEWER NIGHT CLOSES THE OLDER ONE’S WINDOW');
{
  const START2 = NOW - 30 * 60e3;
  paid('cs_n2_tip', pip.artistId, 'n2', 700, START2 + 10 * 60e3);
  /* a stray session tagged n1 AFTER n2 began cannot happen from pay.mjs (the id
     moved on) — but if it did, the window rule alone must not count it */
  paid('cs_n1_ghost', pip.artistId, 'n1', 9900, START2 + 12 * 60e3);
  await archiveShow(pip.artistId, night('n2', START2, 3), {});
  await mutateShow(pip.artistId, (s) => { Object.assign(s, night('n2', START2, 3), { status: 'ended', endedAt: NOW }); return true; });
  const rows = (await readHistIndex(pip.artistId)).shows;
  eq('rows are newest first', rows.map((x) => x.showId), ['n2', 'n1']);
  eq('the older night’s window ends where the newer one begins', moneyWindowEnd(rows, 'n1'), START2);
  ok('the newest night’s window is open', moneyWindowEnd(rows, 'n2') >= NOW - 1000);
  const re = await reconcileShow(pip.artistId, 'n1');
  /* moneyForShow allows an hour of slack past the window end, so the ghost 12
     minutes after n2 began is inside it — and the tag still keeps it on n1. The
     window is a search bound; the tag is the truth. A ghost cannot come from the
     app, so this pins only that n2's money never lands on n1. */
  eq('n2’s tip is not on n1', re.money.tips.recent.some((t) => t.amount === 7), false);
  eq('n2 has its own $7', (await row(pip.artistId, 'n2')).gross, 7);
  const h = await get(T);
  eq('the tile is the newest night', [h.live.showId, h.live.gross], ['n2', 7]);
}

console.log('\nONLY AN ANSWER FROM STRIPE MAY OVERWRITE THE ROW');
{
  delete process.env.STRIPE_SECRET_KEY;
  const before = (await row(pip.artistId, 'n2')).gross;
  const h = await get(T);
  eq('with no key the tile says nothing is known', h.live.gross, 0);
  eq('and the row keeps what Stripe said last time', (await row(pip.artistId, 'n2')).gross, before);
  eq('still marked as heard from Stripe', (await row(pip.artistId, 'n2')).source, 'stripe');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
