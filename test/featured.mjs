/* FEATURED SHOWS  (_featured.mjs, the feature actions in admin.mjs, the city feed)

   Pins, in order:
     · THE RACE. Three spots, first come first served, decided inside the write —
       not by whose request reached which instance first
     · one spot per artist per night, so a city's section cannot be one act thrice
     · a HOLD, not a charge: an abandoned checkout frees the spot by itself and
       nobody is ever charged for a spot they did not get
     · a payment that lands after its hold expired is honoured when there is room
       and REFUNDED when there is not — never silently kept
     · settling is idempotent from either direction (the return trip and the webhook)
     · the flag: off means no button, a refused endpoint, and no section — but a
       spot already paid for keeps its record
     · the city feed moves a featured gig out of the ordinary list (never both) and
       skips one whose gig has been cancelled
     · a member cannot spend the owner's money; one artist cannot settle another's
       payment into their own name
     · a deleted account gives its spots back */
process.env.ADMIN_CODE = 'devlocal';
process.env.STRIPE_SECRET_KEY = 'sk_test_notreal_forlocaltestsonly';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const eventsFn = (await import('../netlify/functions/events.mjs')).default;
const F = await import('../netlify/functions/_featured.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists } = await import('../netlify/functions/_auth.mjs');

const { mutateFlags, __flushFlags } = await import('../netlify/functions/_flags.mjs');
const setFlag = async (name, on) => {
  await mutateFlags((d) => { d.global ||= {}; d.global[name] = on; return true; });
  __flushFlags();
};
const { __stripe } = await import('../test/stripe-fake.mjs');
const { deleteArtist } = await import('../netlify/functions/_account.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, got === want, { got, want });
const post = (tok, body) => new Request('https://myset.vip/api/admin', { method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` },
  body: JSON.stringify(body) });
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

const KEY = F.cityKey('Thailand', 'Koh Phangan');
/* The Studio only offers gigs inside a 60-day window — a promoted spot is a thing
   you buy for a night that is nearly here, not for 2099. The pure slot-table tests
   below use far-future dates on purpose (nothing there reads a calendar); anything
   that goes through the Studio uses a real one. */
const SOON = new Date(Date.now() + 20 * 86400e3).toISOString().slice(0, 10);
const DATE = '2099-06-12';
const TODAY = '2099-06-01';

console.log('\nTHE RACE — three spots, decided inside the write');
{
  const took = [];
  for (let i = 0; i < 5; i++) {
    const r = await F.claimSlot(KEY, DATE, { aid: `a${i}`, eventId: `e${i}`, sid: `s${i}`, today: TODAY });
    took.push(r.ok);
  }
  eq('the first three get in', took.slice(0, 3).filter(Boolean).length, 3);
  ok('the fourth and fifth are told the night is full', !took[3] && !took[4]);

  const same = await F.claimSlot(KEY, DATE, { aid: 'a0', eventId: 'e0', sid: 's0', today: TODAY });
  ok('a retry with the same handle finds its own hold rather than taking another',
    same.ok && same.already, same);

  /* Somebody who backs out of checkout and taps again gets a NEW handle. Their own
     unpaid hold must not block them — blocking on it told a person who had just
     backed out that they "already had a spot" they had not paid for, for twenty
     minutes, with no way to retry. */
  const retry = await F.claimSlot(KEY, DATE, { aid: 'a0', eventId: 'e0', sid: 's0b', today: TODAY });
  ok('a fresh attempt replaces their own unpaid hold rather than being refused', retry.ok, retry);
  eq('and there are still three rows, not four',
    ((await F.readFeatured(KEY, TODAY)).byDate[DATE] || []).length, 3);
}

console.log('\nA HOLD, NOT A CHARGE');
{
  const now = Date.now(), later = now + F.HOLD_MS + 1000;
  eq('while the three are held, nothing is free', (await F.freeSlots(KEY, [DATE], TODAY, now))[DATE], 0);

  const paid = await F.markPaid(KEY, DATE, 's1', { today: TODAY });
  ok('paying inside the window keeps the spot', paid.ok && !paid.lost, paid);
  const dbl = await F.markPaid(KEY, DATE, 's1', { today: TODAY });
  ok('and paying twice changes nothing', dbl.ok && dbl.already, dbl);

  /* ONE PAID SPOT PER ARTIST PER NIGHT — otherwise a city's section is one act
     three times, which is not a listing. */
  const twice = await F.claimSlot(KEY, DATE, { aid: 'a1', eventId: 'other', sid: 's1b', today: TODAY });
  ok('once it is bought, that artist cannot take a second spot that night',
    !twice.ok && twice.mine, twice);

  const free = await F.freeSlots(KEY, [DATE], TODAY, later);
  eq('twenty minutes on, the abandoned holds are gone and the paid one is not',
    free[DATE], F.SLOTS - 1);
}

console.log('\nONE ARTIST\u2019S TIMEZONE CANNOT DELETE ANOTHER\u2019S PAID SPOT');
{
  /* A city table is shared. `prune` runs inside the write, so if it deleted on the
     CALLING artist's local date, somebody in Bangkok claiming a spot would delete a
     London artist's paid row for a night London had not reached yet. */
  const K2 = F.cityKey('UK', 'London');
  const yesterdayIsh = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10);
  await F.claimSlot(K2, yesterdayIsh, { aid: 'londoner', eventId: 'e', sid: 'lon1', today: yesterdayIsh });
  await F.markPaid(K2, yesterdayIsh, 'lon1', { today: yesterdayIsh });

  /* Now somebody a day ahead writes to the same table. */
  const tomorrow = new Date(Date.now() + 30 * 3600e3).toISOString().slice(0, 10);
  await F.claimSlot(K2, tomorrow, { aid: 'bangkok', eventId: 'e2', sid: 'bkk1', today: tomorrow });

  const after = await F.readFeatured(K2, '1970-01-01');
  ok('the paid spot is still there after somebody in a later timezone wrote',
    !!(after.byDate[yesterdayIsh] || []).find((r) => r.sid === 'lon1'), after.byDate);

  /* And genuinely old rows ARE collected — the floor is two days, not never. */
  const old = '2020-01-01';
  await F.claimSlot(K2, old, { aid: 'ancient', eventId: 'e3', sid: 'old1', today: old });
  await F.claimSlot(K2, tomorrow, { aid: 'someoneelse', eventId: 'e4', sid: 'bkk2', today: tomorrow });
  const swept = await F.readFeatured(K2, '1970-01-01');
  ok('but a night from 2020 is collected', !swept.byDate[old], Object.keys(swept.byDate));
}

console.log('\nA PAYMENT THAT ARRIVES AFTER ITS HOLD DIED');
{
  const D2 = '2099-07-04';
  const late = Date.now() + F.HOLD_MS + 5000;
  const revived = await F.markPaid(KEY, D2, 'ghost', { today: TODAY, now: late });
  ok('with room to spare it is honoured, not refused', revived.ok && revived.revived, revived);
  await F.attachSlot(KEY, D2, 'ghost', 'a9', 'e9');
  ok('and the artist is attached once we know who it was',
    ((await F.featuredFor(KEY, TODAY))[D2] || []).some((x) => x.aid === 'a9'));

  const D3 = '2099-08-08';
  for (let i = 0; i < F.SLOTS; i++) {
    await F.claimSlot(KEY, D3, { aid: `f${i}`, eventId: `g${i}`, sid: `p${i}`, today: TODAY });
    await F.markPaid(KEY, D3, `p${i}`, { today: TODAY });
  }
  const lost = await F.markPaid(KEY, D3, 'toolate', { today: TODAY });
  ok('but a FULL night is a real loss and says so', !lost.ok && lost.lost, lost);
}

console.log('\nSETTLING, AND THE REFUND THAT MUST HAPPEN');
{
  const stripe = new (await import('stripe')).default('sk');
  const D3 = '2099-08-08';
  const session = { id: 'cs_lost1', payment_status: 'paid', amount_total: 1000, created: 1,
    payment_intent: 'pi_lost1',
    metadata: { kind: 'feature', artist: 'someone', eventId: 'e', date: D3, key: KEY, hold: 'h_lost1', city: 'Koh Phangan', country: 'Thailand' } };
  const r = await F.settleFeature(stripe, session, { today: TODAY });
  ok('a payment for a night that filled up is refused', !r.ok && r.full, r);
  ok('AND refunded, automatically', r.refunded, r);
  const call = [...__stripe.calls].reverse().find((c) => c.method === 'refunds.create');
  ok('with the session id as the idempotency key, so a webhook retry cannot refund twice',
    !!call && /cs_lost1/.test((call.opts || {}).idempotencyKey || ''), call);

  const good = { id: 'cs_ok1', payment_status: 'paid', amount_total: 1000, created: 1,
    metadata: { kind: 'feature', artist: 'a-happy', eventId: 'e1', date: '2099-09-09', key: KEY, hold: 'h_ok1', city: 'Koh Phangan', country: 'Thailand', venue: 'The Bar' } };
  const g1 = await F.settleFeature(stripe, good, { today: TODAY });
  const g2 = await F.settleFeature(stripe, good, { today: TODAY });
  ok('a good one settles', g1.ok, g1);
  ok('and settling it again is a no-op, not a second spot', g2.ok, g2);
  eq('the artist has exactly one receipt', (await F.readMine('a-happy')).list.length, 1);
  ok('a session that is not a feature payment is refused',
    !(await F.settleFeature(stripe, { id: 'x', payment_status: 'paid', metadata: { kind: 'tip' } })).ok);
  ok('and one missing its details is refused rather than guessed at',
    !(await F.settleFeature(stripe, { id: 'y', payment_status: 'paid', metadata: { kind: 'feature' } })).ok);
}

console.log('\nTHROUGH THE STUDIO');
const A = await createArtist({ email: 'promoter@example.com', name: 'Promoter' });
const aid = A.artistId;
const tok = await signToken('promoter@example.com', revOf(await readArtists(), aid));
{
  /* Saved through the real endpoint, so normEvent shapes it exactly as a gig
     entered in the Studio is — a hand-built record can be a shape the recurrence
     engine never produces, and then the test proves nothing. */
  const savedGig = await j(await admin(post(tok, { action: 'eventSave', event: {
    id: 'ev1', venue: 'The Ugly Duckling', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: SOON, time: '20:00', endTime: '23:00' } })));
  ok('a gig exists to promote', savedGig.ok, savedGig);
  const list = await j(await admin(post(tok, { action: 'featureList' })));
  ok('the Studio is offered the gig', list.ok && list.enabled && (list.gigs || []).length === 1, list);
  eq('priced at $10', list.price, 1000);
  ok('and told how many spots are left that night', typeof (list.gigs[0] || {}).left === 'number', list.gigs[0]);

  const start = await j(await admin(post(tok, { action: 'featureStart', eventId: 'ev1', date: SOON })));
  ok('checkout opens', start.ok && !!start.url, start);
  const sess = __stripe.sessions.get(start.id).session;
  ok('the hold id is carried through Stripe, so the slot never has to be re-keyed',
    !!sess.metadata.hold && sess.metadata.hold === start.hold, sess.metadata);
  eq('on the PLATFORM account — this is MySet’s money, not a direct charge',
    (([...__stripe.calls].reverse().find((c) => c.method === 'checkout.sessions.create').opts) || {}).stripeAccount, undefined);
  eq('tagged so the webhook and the books both know what it was', sess.metadata.kind, 'feature');
  eq('and whose it is', sess.metadata.artist, aid);

  const fin = await j(await admin(post(tok, { action: 'featureFinish', session: start.id })));
  ok('the return trip settles it', fin.ok, fin);
  eq('and the Studio lists it', (fin.mine || []).length, 1);

  const gone = await admin(post(tok, { action: 'featureStart', eventId: 'nope', date: SOON }));
  eq('a gig that is not on the calendar is refused', gone.status, 404);
  const past = await admin(post(tok, { action: 'featureStart', eventId: 'ev1', date: '2000-01-01' }));
  ok('and so is a night that has been', past.status >= 400);
}

console.log('\nTHREE TABS, ONE NIGHT — the section is a listing, not one act thrice');
{
  /* FOUND BY AN ADVERSARIAL REVIEW, not by a user. `claimSlot` replaces an artist's
     own UNPAID hold so that backing out of checkout does not lock them out — which
     means one artist can open three checkouts a minute apart, each replacing the
     last hold, and then pay all three. Nothing in the CLAIM path can stop it,
     because at any instant only one hold exists. The only place to catch it is
     where the money lands. */
  const D4 = new Date(Date.now() + 25 * 86400e3).toISOString().slice(0, 10);
  await j(await admin(post(tok, { action: 'eventSave', event: {
    id: 'ev3tabs', venue: 'Three Tabs', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: D4, time: '20:00', endTime: '23:00' } })));

  const realNow = Date.now;
  const taps = [];
  for (let m = 0; m < 3; m++) {
    Date.now = () => realNow() + m * 60000;          // 12:00, 12:01, 12:02
    taps.push(await j(await admin(post(tok, { action: 'featureStart', eventId: 'ev3tabs', date: D4 }))));
  }
  Date.now = realNow;
  eq('three taps open three checkouts (nothing stops that, and nothing should)',
    new Set(taps.filter((t) => t.ok).map((t) => t.id)).size, 3);

  const paid = [];
  for (const t of taps) paid.push(await admin(post(tok, { action: 'featureFinish', session: t.id })));
  eq('the first payment takes the spot', paid[0].status, 200);
  eq('the second is refused', paid[1].status, 409);
  eq('and the third', paid[2].status, 409);
  ok('both are refunded in full, and say so',
    /refunded in full/.test((await paid[1].clone().json()).error || ''), await paid[1].json());

  const rows = (await F.featuredFor(KEY, TODAY))[D4] || [];
  eq('so the night has ONE featured show, not three of the same act', rows.length, 1);
  /* The refused holds leave a tombstone rather than nothing — so the other settle
     path cannot grant a payment that has just been sent back — but a tombstone must
     not occupy one of the three, or refunding somebody would shrink the night. */
  eq('the refused holds no longer occupy a spot',
    (await F.freeSlots(KEY, [D4], TODAY))[D4], F.SLOTS - 1);
  const rival = await F.claimSlot(KEY, D4, { aid: 'rival-act', eventId: 'rv', sid: 'rv1', today: TODAY });
  ok('so somebody else can still take one', rival.ok, rival);
  eq('held by that artist', rows[0].aid, aid);
  /* And the surviving row must still know WHICH gig — the city feed matches by
     eventId, so a row without one renders nothing and the $10 buys an invisible
     spot. This is the branch that revives a payment whose hold was replaced. */
  eq('and it still knows which gig, so the city feed can draw it', rows[0].eventId, 'ev3tabs');

  /* THE TOMBSTONE HAS TO OUTLIVE THE HOLD. Both settle paths run — the browser's
     return trip and the Stripe webhook — and they can be an hour apart if somebody
     leaves the tab open. Without a marker that survives the twenty-minute hold
     clock, the second path grants a spot for a payment the first path refunded. */
  const wayLater = Date.now() + F.HOLD_MS * 4;
  const again = await F.markPaid(KEY, D4, taps[1].hold, { aid, today: TODAY, now: wayLater });
  ok('an hour later, the refunded payment still cannot be granted a spot',
    !again.ok && again.refundedAlready, again);
  eq('and the night still has exactly one', ((await F.featuredFor(KEY, TODAY, wayLater))[D4] || []).length, 1);

  const refunds = __stripe.calls.filter((c) => c.method === 'refunds.create');
  ok('each refund is keyed by its own session, so a webhook retry cannot double it',
    new Set(refunds.map((c) => (c.opts || {}).idempotencyKey)).size === refunds.length, refunds.length);
}

console.log('\nWHO MAY SPEND THE MONEY');
{
  await mutateArtists((reg) => { reg.byEmail['mate2@example.com'] = { artistId: aid, role: 'member' }; return true; });
  const mtok = await signToken('mate2@example.com', revOf(await readArtists(), aid));
  eq('a band mate cannot buy a spot', (await admin(post(mtok, { action: 'featureStart', eventId: 'ev1', date: SOON }))).status, 403);
  eq('nor settle one', (await admin(post(mtok, { action: 'featureFinish', session: 'x' }))).status, 403);
  const look = await admin(post(mtok, { action: 'featureList' }));
  eq('but may see what is booked', look.status, 200);

  const B = await createArtist({ email: 'other-promoter@example.com', name: 'Other' });
  const btok = await signToken('other-promoter@example.com', revOf(await readArtists(), B.artistId));
  const stolen = await admin(post(btok, { action: 'featureFinish', session: [...__stripe.sessions.keys()].pop() }));
  eq('another artist cannot settle somebody else’s payment into their own name', stolen.status, 403);
}

console.log('\nNOBODY CAN STAND IN SOMEBODY ELSE\u2019S PAID SPOT');
{
  /* FOUND BY AN ADVERSARIAL REVIEW. Event ids are chosen by the CLIENT (eventSave
     takes event.id from the body) and every gig's id is public in this very feed —
     so matching a paid spot on the id alone let any artist in the city put a gig
     with a rival's event id on their calendar and be rendered in the spot the rival
     had paid $10 for. */
  /* Its OWN city, so nothing here collides with the city-feed block below. */
  const D5 = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const hh = String(new Date(Date.now() + 3 * 3600e3).getUTCHours()).padStart(2, '0');
  const KEY5 = F.cityKey('Thailand', 'Chaweng');
  await admin(post(tok, { action: 'eventSave', event: {
    id: 'evPaid', venue: 'The Ugly Duckling', city: 'Chaweng', country: 'Thailand',
    tz: 'UTC', date: D5, time: `${hh}:00`, endTime: '23:59' } }));
  await F.settleFeature(new (await import('stripe')).default('sk'),
    { id: 'cs_paid5', payment_status: 'paid', amount_total: 1000, created: 1,
      metadata: { kind: 'feature', artist: aid, eventId: 'evPaid', date: D5, key: KEY5,
                  hold: 'paid5', city: 'Chaweng', country: 'Thailand', venue: 'The Ugly Duckling' } },
    { today: D5 });

  /* The thief gives their own gig the SAME event id. */
  const T = await createArtist({ email: 'thief@example.com', name: 'The Thief' });
  const ttok = await signToken('thief@example.com', revOf(await readArtists(), T.artistId));
  await admin(post(ttok, { action: 'eventSave', event: {
    id: 'evPaid', venue: 'Some Other Bar', city: 'Chaweng', country: 'Thailand',
    tz: 'UTC', date: D5, time: `${hh}:30`, endTime: '23:59' } }));

  const feed = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Chaweng')));
  const day = (feed.days || []).find((x) => x.date === D5) || {};
  const feat = day.featured || [];
  eq('exactly one featured row', feat.length, 1);
  eq('and it is the artist who PAID, not the one who copied the id', feat[0].venue, 'The Ugly Duckling');
  ok('the thief is in the ordinary list, where they belong',
    (day.gigs || []).some((g) => g.venue === 'Some Other Bar'), day.gigs);
  ok('and no internal owner id leaks into the public payload',
    ![...(day.gigs || []), ...feat].some((g) => '_owner' in g));
}

console.log('\nTHE CITY FEED');
{
  /* A gig today, in the window, featured. */
  const soon = new Date(Date.now() + 2 * 3600e3);
  const d = soon.toISOString().slice(0, 10);
  const hh = String(soon.getUTCHours()).padStart(2, '0');
  await admin(post(tok, { action: 'eventSave', event: {
    id: 'evNow', venue: 'The Ugly Duckling', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: d, time: `${hh}:00`, endTime: '23:59' } }));
  /* Through the real settle path, so the artist's own receipt is written — that
     receipt is the ONLY index deleteArtist can use to find which cities to visit. */
  await F.settleFeature(new (await import('stripe')).default('sk'),
    { id: 'cs_live1', payment_status: 'paid', amount_total: 1000, created: 1,
      metadata: { kind: 'feature', artist: aid, eventId: 'evNow', date: d, key: KEY,
                  hold: 'live1', city: 'Koh Phangan', country: 'Thailand', venue: 'The Ugly Duckling' } },
    { today: d });

  const feed = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan')));
  const day = (feed.days || []).find((x) => x.date === d);
  ok('the night has a featured section', !!(day && (day.featured || []).length === 1), day);
  ok('and the same gig is NOT also in the ordinary list',
    !!day && !(day.gigs || []).some((g) => g.eventId === 'evNow'), day && day.gigs);
  eq('the count still counts it', day && day.count, 1);

  /* The gig is cancelled. The spot is spent, and the section must simply not
     render it rather than showing a row pointing at nothing. */
  await admin(post(tok, { action: 'eventDelete', id: 'evNow' }));
  const after = await j(await eventsFn(new Request('https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan')));
  const day2 = (after.days || []).find((x) => x.date === d);
  ok('a cancelled gig leaves no featured row behind', !day2 || !(day2.featured || []).length, day2);
}

console.log('\nTHE WINDOW  (the front door\'s "View next week\'s events")');
{
  /* A gig ten days out is past the seven-day window the feed always carried; days=
     widens it a week at a time, never narrower than seven, never past four weeks.
     The page draws the button only when `window` comes back — an older server
     shows no button rather than one that leads to a shrug. */
  const far = new Date(Date.now() + 10 * 86400e3).toISOString().slice(0, 10);
  await admin(post(tok, { action: 'eventSave', event: {
    id: 'evFar', venue: 'The Ugly Duckling', city: 'Koh Phangan', country: 'Thailand',
    tz: 'UTC', date: far, time: '20:00', endTime: '23:00' } }));
  const base = 'https://myset.vip/api/events?country=Thailand&city=Koh%20Phangan';
  const plain = await j(await eventsFn(new Request(base)));
  eq('the plain feed still says seven days', plain.window, 7);
  ok('and a gig ten days out is not in it', !(plain.days || []).some((x) => x.date === far), plain.days);
  const wide = await j(await eventsFn(new Request(base + '&days=14')));
  eq('days=14 widens the window to fourteen', wide.window, 14);
  ok('and the horizon moves with it', wide.horizon > plain.horizon, { wide: wide.horizon, plain: plain.horizon });
  ok('and the gig ten days out is now listed', (wide.days || []).some((x) => x.date === far), wide.days);
  eq('days=3 is never narrower than the seven the feed promised', (await j(await eventsFn(new Request(base + '&days=3')))).window, 7);
  eq('days=99 stops at four weeks', (await j(await eventsFn(new Request(base + '&days=99')))).window, 28);
  eq('days=junk is the plain feed', (await j(await eventsFn(new Request(base + '&days=abc')))).window, 7);
  await admin(post(tok, { action: 'eventDelete', id: 'evFar' }));
}

console.log('\nTHE FLAG');
{
  await setFlag('featuredShows', false);
  const off = await j(await admin(post(tok, { action: 'featureList' })));
  ok('off: nothing is offered', off.ok && off.enabled === false, off);
  ok('but what was already bought is still listed', (off.mine || []).length >= 1, off.mine);
  eq('off: the endpoint refuses, so nobody can be charged',
    (await admin(post(tok, { action: 'featureStart', eventId: 'ev1', date: SOON }))).status, 503);
  await setFlag('featuredShows', true);
  eq('back on', (await j(await admin(post(tok, { action: 'featureList' })))).enabled, true);
}

console.log('\nLEAVING GIVES THE SPOTS BACK');
{
  const before = (await F.readMine(aid)).list.length;
  ok('the artist holds a spot', before >= 1);
  await deleteArtist(aid);
  const held = await F.readFeatured(KEY, '2099-01-01');
  /* PAID rows are the ones that matter: they are what the city renders and what the
     artist paid for. An unpaid hold left behind expires by itself within twenty
     minutes and blocks nothing anybody would notice. */
  const paidLeft = Object.values(held.byDate || {}).flat().filter((r) => r.aid === aid && r.paid);
  ok('and holds no PAID spot once the account is gone', !paidLeft.length, paidLeft);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
