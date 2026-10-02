/* THE ROOM STOPS FIRST; THE NIGHT IS PRICED AFTER, ON A CLOCK  (decision 0153, INVARIANT 0ii)

   The scale audit of 2 October 2026: ending a show released the request holds and
   priced the whole night from Stripe — up to ten pages of a hundred — before the
   show was flipped to "ended". A slow Stripe kept the room voting after the artist
   had tapped End, and past a thousand payments in the night's window (the platform
   account's window holds every artist's) the rest were dropped and the night was
   filed as Stripe's whole answer. This pins:

     · the show reads "ended" before Stripe is asked for a single page
     · a count cut short — by the clock, by the page limit, by Stripe stopping part-way —
       is filed as 'stripe-partial', never as 'stripe'
     · it is finished later from where it stopped, to the cent, by the register's bell
       or Re-check; two at once never add the same pages twice
     · a Stripe that cannot be reached at all still ends the night
     · the Money tab's tile says when its figure is part of the night, and a partial
       count never overwrites a whole one on the filed row */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const history = (await import('../netlify/functions/history.mjs')).default;
const { startShow, endShow } = await import('../netlify/functions/_lifecycle.mjs');
const { readHistIndex, readHistShow, priceNight, reconcileShow, MONEY_PAGES } = await import('../netlify/functions/_history.mjs');
const { recheckSome } = await import('../netlify/functions/_register.mjs');
const { mutateShow, readDoc } = await import('../netlify/functions/_lib.mjs');
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { __stripe } = await import('./stripe-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const sec = (ms) => Math.floor(ms / 1000);
const row = async (aid, id) => (await readHistIndex(aid)).shows.find((x) => x.showId === id) || {};

/* An artist with a night on: a song played (so the archive files it) and `n` payments
   of a dollar tagged to the night — tips and vote packs, alternately. The fake's
   platform account holds only this night's payments, so every figure below is exact
   (on the real platform account the window holds every artist's — which is why a
   thousand is reached sooner than one artist's night suggests). */
let seq = 0;
async function nightWith(slug, n) {
  __stripe.sessions.clear();
  const a = await createArtist({ email: `${slug}@example.com`, name: slug, slug });
  await mutateShow(a.artistId, (s) => { s.songs = [{ id: 'valerie', title: 'Valerie', active: true }]; return true; });
  const r = await startShow(a.artistId, { fresh: true, by: 'artist' });
  if (!r.ok) throw new Error('start refused: ' + JSON.stringify(r.err));
  const sh = (await mutateShow(a.artistId, (s) => { s.log = [{ songId: 'valerie', title: 'Valerie', at: Date.now(), votes: 3, roundVotes: 3 }]; return true; })).data;
  for (let i = 0; i < n; i++) {
    const id = `cs_${slug}_${String(++seq).padStart(6, '0')}`;
    __stripe.sessions.set(id, { onAccount: '', session: { id, mode: 'payment', payment_status: 'paid', created: sec(sh.startedAt) + 1, amount_total: 100,
      metadata: { kind: i % 2 ? 'tip' : 'votes', artist: a.artistId, show: sh.showId, ...(i % 2 ? {} : { votes: '5' }) } } });
  }
  return { aid: a.artistId, showId: sh.showId, email: `${slug}@example.com` };
}
const setStripe = (o) => Object.assign(__stripe, { listDelayMs: 0, listFailAfter: null, onList: null }, o);

console.log('\nTHE ROOM STOPS BEFORE STRIPE IS ASKED  (the tap, through admin.mjs)');
const ana = await nightWith('ana-end', 250);
{
  const n = ana;
  const T = await signToken(n.email, revOf(await readArtists(), n.aid));
  const seen = [];
  setStripe({ onList: async () => { seen.push(((await readDoc(`show_${n.aid}`, null)).data || {}).status); } });
  const r = await admin(new Request('https://x/api/admin', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + T },
    body: JSON.stringify({ action: 'status', status: 'ended' }) }));
  setStripe({});
  ok('End answers', r.status === 200, r.status);
  ok('Stripe was asked for the night, a page at a time', seen.length === 3, seen);
  ok('THE RULE: every time Stripe was asked, the room had already stopped', seen.length > 0 && seen.every((s) => s === 'ended'), seen);
  const w = await row(n.aid, n.showId);
  eq('and the night was filed whole, from Stripe', [w.source, w.gross], ['stripe', 250]);
  ok('with no place-marker left on it', !(await readHistShow(n.aid, n.showId)).money.partial);
}

console.log('\nA SLOW STRIPE: THE END STOPS ON ITS CLOCK AND SAYS THE COUNT IS NOT WHOLE');
const slow = await nightWith('bo-slow', 250);
{
  process.env.MYSET_MONEY_AT_END_MS = '50';
  const before = __stripe.listCalls || 0;
  setStripe({ listDelayMs: 120 });
  const r = await endShow(slow.aid, { by: 'artist' });
  setStripe({});
  delete process.env.MYSET_MONEY_AT_END_MS;
  ok('the end went through', r.ok, r);
  eq('the show is ended', ((await readDoc(`show_${slow.aid}`, null)).data || {}).status, 'ended');
  eq('one page was read before the clock ran out', (__stripe.listCalls || 0) - before, 1);
  const d = await readHistShow(slow.aid, slow.showId);
  eq('THE RULE: a count cut short is filed as part of the night, never as Stripe\'s whole answer', d.money.source, 'stripe-partial');
  eq('the first page is in it', d.money.gross, 100);
  ok('with a place-marker to carry on from', !!(d.money.partial && d.money.partial.after), d.money.partial);
  eq('the row says the same', [(await row(slow.aid, slow.showId)).source, (await row(slow.aid, slow.showId)).gross], ['stripe-partial', 100]);
  eq('so its paid counts are unknown, never a short number', [(await row(slow.aid, slow.showId)).paidVotes, (await row(slow.aid, slow.showId)).tipped], [null, null]);
  const p = await priceNight(slow.aid, slow.showId);
  ok('carrying on finishes it', p && p.done && p.moved, p);
  const d2 = await readHistShow(slow.aid, slow.showId);
  eq('to the cent: every payment once', [d2.money.source, d2.money.gross, d2.money.votes.count, d2.money.tips.count], ['stripe', 250, 125, 125]);
  eq('the bought votes are the night\'s, once each', d2.money.votes.paid, 125 * 5);
  ok('and the place-marker is gone', !d2.money.partial);
  const w = await row(slow.aid, slow.showId);
  eq('the row follows: Stripe\'s answer, whole', [w.source, w.gross, w.paidVotes, w.tipped], ['stripe', 250, 625, 125]);
  const again = await priceNight(slow.aid, slow.showId);
  eq('a whole night has nothing to carry on', [again.done, again.moved, (await readHistShow(slow.aid, slow.showId)).money.gross], [true, false, 250]);
}

console.log(`\nPAST ${MONEY_PAGES * 100} PAYMENTS: FLAGGED, THEN FINISHED`);
const big = await nightWith('cy-big', MONEY_PAGES * 100 + 50);
{
  await endShow(big.aid, { by: 'artist' });
  const d = await readHistShow(big.aid, big.showId);
  eq(`THE RULE: one ask stops at ${MONEY_PAGES} pages and says so`, [d.money.source, d.money.gross, d.money.partial && d.money.partial.pages], ['stripe-partial', MONEY_PAGES * 100, MONEY_PAGES]);
  const re = await reconcileShow(big.aid, big.showId);
  eq('Re-check carries on from the marker instead of starting again, and finishes it', [re.money.source, re.money.gross], ['stripe', MONEY_PAGES * 100 + 50]);
  eq('the row too', [(await row(big.aid, big.showId)).source, (await row(big.aid, big.showId)).gross], ['stripe', MONEY_PAGES * 100 + 50]);
}

console.log('\nTWO AT ONCE: ONE IS WRITTEN, AND A SLOW ONE NEVER PUTS AN OLDER COUNT BACK');
{
  const n = await nightWith('di-race', 250);
  process.env.MYSET_MONEY_AT_END_MS = '1';
  setStripe({ listDelayMs: 20 });
  await endShow(n.aid, { by: 'artist' });
  delete process.env.MYSET_MONEY_AT_END_MS;
  eq('cut short after a page', (await readHistShow(n.aid, n.showId)).money.gross, 100);
  const [a, b] = await Promise.all([priceNight(n.aid, n.showId), priceNight(n.aid, n.showId)]);
  setStripe({});
  eq('both read the same pages from the same place-marker, and only one is written', [a.moved, b.moved].sort(), [false, true]);
  const d = await readHistShow(n.aid, n.showId);
  eq('every payment once — $250, not $400', [d.money.source, d.money.gross, d.money.votes.count + d.money.tips.count], ['stripe', 250, 250]);
  eq('the row agrees', (await row(n.aid, n.showId)).gross, 250);

  /* The bell and a Re-check, one of them slow: the slow one is held inside Stripe on
     its first page while the other finishes the count; then it is let go, stops on its
     clock with a page more than it started with, and tries to write that. */
  const m = await nightWith('el-race', 250);
  process.env.MYSET_MONEY_AT_END_MS = '1';
  setStripe({ listDelayMs: 20 });
  await endShow(m.aid, { by: 'artist' });
  delete process.env.MYSET_MONEY_AT_END_MS;
  let release, first = true;
  const held = new Promise((r) => { release = r; });
  setStripe({ onList: async () => { if (first) { first = false; await held; } } });
  const slowOne = priceNight(m.aid, m.showId, { deadline: Date.now() + 1 });
  await new Promise((r) => setTimeout(r, 30));
  const fast = await priceNight(m.aid, m.showId);
  release();
  const late = await slowOne;
  setStripe({});
  eq('the fast one finishes the count', [fast.done, (await readHistShow(m.aid, m.showId)).money.gross], [true, 250]);
  eq('the slow one finds the place-marker gone and writes nothing', late.moved, false);
  const d2 = await readHistShow(m.aid, m.showId);
  eq('THE RULE: a slower run never puts an older, shorter count back over a newer one', [d2.money.source, d2.money.gross, !!d2.money.partial], ['stripe', 250, false]);
  eq('nor on the row', [(await row(m.aid, m.showId)).source, (await row(m.aid, m.showId)).gross], ['stripe', 250]);
}

console.log('\nSTRIPE STOPS ANSWERING PART-WAY');
{
  const n = await nightWith('ed-drop', 250);
  setStripe({ listFailAfter: (__stripe.listCalls || 0) + 1 });
  await endShow(n.aid, { by: 'artist' });
  const d = await readHistShow(n.aid, n.showId);
  eq('the page that came back is kept, and the count is flagged', [d.money.source, d.money.gross], ['stripe-partial', 100]);
  setStripe({ listFailAfter: __stripe.listCalls || 0 });
  const p = await priceNight(n.aid, n.showId);
  eq('carrying on while Stripe is still down changes nothing', [p.moved, (await readHistShow(n.aid, n.showId)).money.gross, (await readHistShow(n.aid, n.showId)).money.partial.after], [false, 100, d.money.partial.after]);
  setStripe({});
  const re = await reconcileShow(n.aid, n.showId);
  eq('and once it is back, Re-check finishes it', [re.money.source, re.money.gross], ['stripe', 250]);
}

console.log('\nSTRIPE UNREACHABLE AT THE END: THE ROOM STILL STOPS');
{
  const n = await nightWith('fi-down', 30);
  setStripe({ listFailAfter: __stripe.listCalls || 0 });
  const r = await endShow(n.aid, { by: 'artist' });
  setStripe({});
  ok('the end went through', r.ok, r);
  eq('the show is ended', ((await readDoc(`show_${n.aid}`, null)).data || {}).status, 'ended');
  eq('and the night is filed, its money not known', (await row(n.aid, n.showId)).source, 'stripe-unreachable');
}

console.log('\nTHE REGISTER\'S BELL FINISHES A CUT-SHORT COUNT, AND KEEPS ASKING UNTIL IT IS WHOLE');
{
  const n = await nightWith('gu-bell', 250);
  process.env.MYSET_MONEY_AT_END_MS = '1';
  setStripe({ listDelayMs: 20 });
  await endShow(n.aid, { by: 'artist' });
  delete process.env.MYSET_MONEY_AT_END_MS;
  setStripe({});
  const reg = (source) => ({ id: `${n.aid}|${n.showId}`, showId: n.showId, status: 'counted', endedAt: Date.now() - 60e3, artist: { id: n.aid }, money: { known: source === 'stripe', source, stripeFees: null } });
  const work = { rechecked: {}, feesAsked: {} };
  const done = await recheckSome([reg('stripe-partial')], work, Date.now());
  eq('the bell carried it on', [(await readHistShow(n.aid, n.showId)).money.source, (await readHistShow(n.aid, n.showId)).money.gross], ['stripe', 250]);
  ok('and asks the register to fold the artist again', done.includes(n.aid), done);
  eq('it is not marked as asked — a count still short comes back next ring', [work.rechecked, work.feesAsked], [{}, {}]);
  const w2 = { rechecked: {}, feesAsked: {} };
  await recheckSome([{ ...reg('stripe-partial'), endedAt: Date.now() - 11 * 3600e3 }], w2, Date.now());
  eq('a short count in its morning-after window is carried on, not spent on the late-tip ask', w2.rechecked, {});
}

console.log('\nTHE TILE SAYS WHEN IT IS PART OF THE NIGHT; A PART NEVER OVERWRITES A WHOLE');
{
  const n = await nightWith('hu-tile', MONEY_PAGES * 100 + 50);
  await endShow(n.aid, { by: 'artist' });
  await reconcileShow(n.aid, n.showId);
  eq('the night is filed whole', [(await row(n.aid, n.showId)).source, (await row(n.aid, n.showId)).gross], ['stripe', MONEY_PAGES * 100 + 50]);
  const T = await signToken(n.email, revOf(await readArtists(), n.aid));
  const h = await (await history(new Request('https://x/api/history', { headers: { authorization: 'Bearer ' + T } }))).json();
  ok('the Money tab answers', h.ok, h);
  eq('the tile carries what one ask could count, and says it is part of it', [h.live.gross, h.live.partial], [MONEY_PAGES * 100, true]);
  eq('THE RULE: the filed row keeps the whole count', [(await row(n.aid, n.showId)).source, (await row(n.aid, n.showId)).gross], ['stripe', MONEY_PAGES * 100 + 50]);
  const m = await nightWith('ia-whole', 30);
  await endShow(m.aid, { by: 'artist' });
  const T2 = await signToken(m.email, revOf(await readArtists(), m.aid));
  const h2 = await (await history(new Request('https://x/api/history', { headers: { authorization: 'Bearer ' + T2 } }))).json();
  eq('a night Stripe answered whole is not flagged', [h2.live.gross, h2.live.partial], [30, false]);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
