/* CROSS-TENANT ISOLATION.

   MySet is one store shared by every artist, kept apart by nothing but key
   namespacing and `requireArtist()`. INVARIANT 0a says nothing is global except
   the registry; 0b says the artist id comes from the SESSION, never from the
   request; 0x says a venue is a different account, not a role.

   Those three are the whole multi-tenancy model, and until this file existed
   not one of the 131 tests asserted any of them. That is the test you want
   before a second artist signs up, not after — the failure mode is silent, and
   the thing it leaks is somebody else's setlist, votes and money.

   Everything below runs the REAL handlers against the in-memory blob store. */
process.env.ADMIN_CODE = 'devlocal';
// songs are started milliseconds apart here; the real 8s double-tap guard is
// exercised deliberately in its own case below
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin    = (await import('../netlify/functions/admin.mjs')).default;
const stageFn  = (await import('../netlify/functions/stage.mjs')).default;
const showFn   = (await import('../netlify/functions/show.mjs')).default;
const voteFn   = (await import('../netlify/functions/vote.mjs')).default;
const vadminFn = (await import('../netlify/functions/venueadmin.mjs')).default;

const { createArtist, signToken, readArtists, mutateArtists } =
  await import('../netlify/functions/_auth.mjs');
const { createVenue, signVenueToken } = await import('../netlify/functions/_venues.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want),
  { got, want });

const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};

/* ── two artists and a venue ─────────────────────────────────────── */
console.log('\nSETUP  two artists and a venue, each with a real session');

const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const bo  = await createArtist({ email: 'bo@example.com',  name: 'Bo Tran',   slug: 'bo-tran' });
ok('artist Ana created', ana.ok, ana);
ok('artist Bo created', bo.ok, bo);
ok('they got different ids', ana.artistId !== bo.artistId, [ana.artistId, bo.artistId]);

let reg = await readArtists();
const TA = await signToken('ana@example.com', reg.rev);
const TB = await signToken('bo@example.com', reg.rev);

const ven = await createVenue({ email: 'bar@example.com', name: 'The Ugly Duckling',
                                slug: 'ugly-duckling', city: 'Koh Phangan', country: 'TH' });
ok('venue created', ven.ok, ven);
const TV = await signVenueToken('bar@example.com', (await (await import('../netlify/functions/_venues.mjs')).readVenues()).rev);

const A = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);

await A(TA, 'addSong', { title: 'Ana Only One', artist: 'Ana' });
await A(TA, 'addSong', { title: 'Ana Only Two', artist: 'Ana' });
await A(TA, 'venue', { venue: "Ana's bar" });
await A(TB, 'addSong', { title: 'Bo Only One', artist: 'Bo' });
await A(TB, 'venue', { venue: "Bo's bar" });

const stA = async (t) => hit(stageFn, 'https://x/api/stage', undefined, t);

let SA = await stA(TA), SB = await stA(TB);
eq("Ana sees her own two songs", SA.songs.map((s) => s.title).sort(), ['Ana Only One', 'Ana Only Two']);
eq("Bo sees only his one song", SB.songs.map((s) => s.title), ['Bo Only One']);
eq("and their venues are their own", [SA.show.venue, SB.show.venue], ["Ana's bar", "Bo's bar"]);

/* ── INVARIANT 0b: the id comes from the session, never the body ── */
console.log('\nINVARIANT 0b  no handler may take an artist id from the request');

for (const key of ['artistId', 'aid', 'artist', 'a', 'id', 'owner']) {
  const r = await A(TB, 'venue', { venue: 'HACKED', [key]: ana.artistId });
  const after = await stA(TA);
  ok(`body.${key} cannot redirect Bo's write at Ana`,
     after.show.venue === "Ana's bar", { key, anaVenue: after.show.venue });
}

const qs = await hit(admin, `https://x/api/admin?a=${ana.artistId}`, { action: 'venue', venue: 'HACKED-QS' }, TB);
SA = await stA(TA);
ok("?a= on an admin call cannot redirect it either", SA.show.venue === "Ana's bar", SA.show.venue);
SB = await stA(TB);
ok('and Bo\'s own write still landed on Bo', SB.show.venue === 'HACKED-QS', SB.show.venue);
await A(TB, 'venue', { venue: "Bo's bar" });

/* destructive actions */
const anaSongId = SA.songs[0].id;
await A(TB, 'removeSong', { song: anaSongId });
SA = await stA(TA);
eq("Bo deleting Ana's song id leaves her library intact", SA.songs.length, 2);

await A(TB, 'clearSetlist');
SA = await stA(TA);
eq("Bo clearing his library does not clear Ana's", SA.songs.length, 2);
SB = await stA(TB);
eq('Bo really did clear his own', SB.songs.length, 0);
await A(TB, 'addSong', { title: 'Bo Only One', artist: 'Bo' });

/* ── the public payload ──────────────────────────────────────────── */
console.log('\nPUBLIC  /api/show is per-artist, and leaks nothing private');

const pub = (slug, fan) => hit(showFn, `https://x/api/show?a=${slug}${fan ? '&fan=' + fan : ''}`);
const pA = await pub('ana-reyes'), pB = await pub('bo-tran');
eq("Ana's page lists Ana's songs", pA.songs.map((s) => s.title).sort(), ['Ana Only One', 'Ana Only Two']);
eq("Bo's page lists Bo's", pB.songs.map((s) => s.title), ['Bo Only One']);
ok('the two song sets are disjoint',
   !pA.songs.some((s) => pB.songs.some((t) => t.id === s.id)));

const bad404 = await pub('no-such-artist');
eq('an unknown slug is 404, not somebody else', [bad404.status, bad404.ok], [404, false]);

const blobA = JSON.stringify(pA);
ok('no email anywhere in a public payload', !/@example\.com/.test(blobA));
ok('no song KEY in a public payload (0at)', !pA.songs.some((s) => 'key' in s));
ok('no CHART in a public payload (0at)', !/chart/i.test(blobA));
ok("no other artist's name in it", !/Bo Tran/.test(blobA));

/* ── fans and credits are per-artist ─────────────────────────────── */
console.log('\nFANS  one phone, two artists, two separate wallets');

await A(TA, 'status', { status: 'live' });
await A(TB, 'status', { status: 'live' });
const vote = (slug, fan, song) => hit(voteFn, `https://x/api/vote?a=${slug}`, { fan, song });

const anaSong = (await pub('ana-reyes')).songs[0].id;
const boSong  = (await pub('bo-tran')).songs[0].id;

const v1 = await vote('ana-reyes', 'phone1', anaSong);
ok('the phone votes at Ana\'s gig', v1.ok && v1.voted === true, v1);
eq('and spent one of its three default votes there', v1.remaining, 2);

const pB2 = await pub('bo-tran', 'phone1');
eq("the same phone still has all three votes at Bo's", pB2.credits.remaining, 3);
eq('the audience payload separates the free allowance from bought votes',
   [pB2.credits.freeRemaining, pB2.credits.freeTotal], [3, 3]);
eq('the default packs are 3 for $5 and 15 for $20',
   pB2.packs, { small: { votes: 3, cents: 500 }, big: { votes: 15, cents: 2000 } });

const pA2 = await pub('ana-reyes', 'phone1');
eq("Ana's song shows the vote", pA2.songs.find((s) => s.id === anaSong).votes, 1);
eq('and the free-vote counter has moved from 3/3 to 2/3',
   [pA2.credits.freeRemaining, pA2.credits.freeTotal], [2, 3]);
const pB3 = await pub('bo-tran', 'phone1');
eq("no vote leaked into Bo's tally", pB3.songs.reduce((n, s) => n + s.votes, 0), 0);

const vX = await vote('bo-tran', 'phone1', anaSong);
eq("voting at Bo's gig for Ana's song id is refused", vX.status, 404);

/* ── auth ────────────────────────────────────────────────────────── */
console.log('\nAUTH  what a missing, forged or revoked token gets');

const noTok = await hit(admin, 'https://x/api/admin', { action: 'venue', venue: 'x' });
eq('no token on /api/admin -> 401', noTok.status, 401);
const noTok2 = await hit(stageFn, 'https://x/api/stage', undefined);
eq('no token on /api/stage -> 401', noTok2.status, 401);

for (const [label, tok] of [
  ['garbage', 'not-a-token'],
  ['no signature', TA.split('.')[0]],
  ['tampered payload', 'x' + TA],
  ['swapped signature', TA.split('.')[0] + '.' + TB.split('.')[1]],
]) {
  const r = await hit(stageFn, 'https://x/api/stage', undefined, tok);
  eq(`${label} token -> 401`, r.status, 401);
}

/* the studio code is the FOUNDING artist's recovery key, and must not be a way
   into anybody else's studio */
const codeIn = await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'venue', venue: 'CODE' });
ok('the studio code still works for the founding artist', codeIn.ok, codeIn);
SA = await stA(TA); SB = await stA(TB);
ok('but it did not touch Ana or Bo',
   SA.show.venue === "Ana's bar" && SB.show.venue === "Bo's bar", [SA.show.venue, SB.show.venue]);
const wrongCode = await hit(admin, 'https://x/api/admin?code=wrong', { action: 'venue', venue: 'x' });
eq('a wrong studio code -> 401', wrongCode.status, 401);

/* INVARIANT 9i: bumping the registry rev signs every device out */
await mutateArtists((r) => { r.rev = (r.rev || 1) + 1; return true; });
const afterRev = await hit(stageFn, 'https://x/api/stage', undefined, TA);
eq('bumping artists.rev invalidates a live session', afterRev.status, 401);
reg = await readArtists();
const TA2 = await signToken('ana@example.com', reg.rev);
const afterRev2 = await hit(stageFn, 'https://x/api/stage', undefined, TA2);
ok('and a freshly signed token works again', afterRev2.ok, afterRev2.status);

/* ── C009: signing out is per-artist ─────────────────────────────── */
console.log('\nC009  "Sign out every device" must mean MY devices');

const authFn = (await import('../netlify/functions/auth.mjs')).default;
reg = await readArtists();
const TA3 = await signToken('ana@example.com', (await import('../netlify/functions/_auth.mjs')).revOf(reg, ana.artistId));
const TB3 = await signToken('bo@example.com',  (await import('../netlify/functions/_auth.mjs')).revOf(reg, bo.artistId));
ok('both are signed in to start', (await stA(TA3)).ok && (await stA(TB3)).ok);

const rv = await hit(authFn, 'https://x/api/auth', { action: 'revokeAll' }, TA3);
ok('Ana revokes her own devices', rv.ok !== false, rv);
eq('Ana is signed out', (await stA(TA3)).status, 401);
/* THE BUG: one global `reg.rev` meant this bumped everybody. Signup is open, so
   any stranger could sign out every artist and every venue on the platform. */
ok('THE BUG: Bo is still signed in', (await stA(TB3)).ok, (await stA(TB3)).status);
const TVafter = await hit(vadminFn, 'https://x/api/venueadmin', { action: 'profile' }, TV);
ok('and the venue is still signed in', TVafter.status !== 401, TVafter.status);

reg = await readArtists();
const TA4 = await signToken('ana@example.com', (await import('../netlify/functions/_auth.mjs')).revOf(reg, ana.artistId));
ok('Ana can sign back in', (await stA(TA4)).ok);

/* ── C031/C054/C067: nobody's audience pays into someone else's account ── */
console.log('\nC031/C054/C067  the payment gate');
const payFn = (await import('../netlify/functions/pay.mjs')).default;

// with payments configured but no Connect, only the founding artist can receive
process.env.STRIPE_SECRET_KEY = 'sk_test_not_a_real_key';
const pPerry = await hit(showFn, 'https://x/api/show');
const pAna   = await pub('ana-reyes');
eq('the founding artist can take money', pPerry.paymentsEnabled, true);
eq('THE BUG: Ana cannot, so her room is never offered it', pAna.paymentsEnabled, false);

const buyAsAna = await hit(payFn, 'https://x/api/pay?a=ana-reyes',
  { fan: 'phone9', kind: 'votes', pack: 'small' });
eq('and the endpoint refuses too, not just the UI', buyAsAna.status, 503);
const tipAsAna = await hit(payFn, 'https://x/api/pay?a=ana-reyes',
  { fan: 'phone9', kind: 'tip', amount: 10 });
eq('tips as well', tipAsAna.status, 503);

// TA4, not TA2 — the C009 section above revoked Ana's earlier devices
const sAna = await stA(TA4);
ok('and Ana is told why, in her own Money tab',
   /payout account/.test(sAna.payoutsNote || ''), sAna.payoutsNote);
delete process.env.STRIPE_SECRET_KEY;
eq('with no Stripe key at all, nobody is offered it', (await hit(showFn, 'https://x/api/show')).paymentsEnabled, false);

/* ── pricing is a paid feature ───────────────────────────────────── */
console.log('\nPRICING  a free artist runs on the defaults');

const priced = await A(TA4, 'freeCredits', { n: 20 });
eq('changing the free-vote count -> 402', priced.status, 402);
const packed = await A(TA4, 'packs', { small: { votes: 1, cents: 100 }, big: { votes: 2, cents: 200 } });
eq('changing pack prices -> 402', packed.status, 402);
const rc = await A(TA4, 'replayCost', { n: 9 });
eq('changing the replay cost -> 402', rc.status, 402);
ok('and the refusal says what to do about it', /Plus/.test(priced.error || ''), priced.error);

const tog = await A(TA4, 'askSet', { kind: 'song', on: true });
ok('but switching requests ON is free — that is running your show', tog.ok, tog);
const cheeky = await A(TA4, 'askSet', { kind: 'song', on: true, cost: 9 });
eq('while changing what a request COSTS is not', cheeky.status, 402);
const same = await A(TA4, 'askSet', { kind: 'song', on: false, cost: 3 });
ok('and re-sending the unchanged default cost is not a price change', same.ok, same);

const owner = await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'replayCost', n: 5 });
ok('the founding artist is never locked out of pricing', owner.ok, owner);

await mutateArtists((r) => { r.byId[ana.artistId].plan = 'plus'; return true; });
const paidChoice = await A(TA4, 'freeCredits', { n: 7 });
ok('a paid artist can choose a different free allowance', paidChoice.ok, paidChoice);
eq('and the chosen allowance reaches the room', (await pub('ana-reyes')).credits.freeTotal, 7);
await A(TA4, 'freeCredits', { n: 3 });
await mutateArtists((r) => { r.byId[ana.artistId].plan = 'free'; return true; });

/* ── the free plan's gig cap ─────────────────────────────────────── */
console.log('\nGIG CAP  ten free shows a month, counted where a gig starts');

/* Ana is on the free plan. A gig starts on newShow, and on status->live from
   anything that is not already live. She has already used one earlier in this
   file, so read the counter rather than assuming — the first draft of this test
   asserted a number and measured one fewer for exactly that reason. The cap has
   already changed twice, so it is read from the plan table here rather than written
   down twice. */
const { PLANS: PL } = await import('../netlify/functions/_plan.mjs');
const CAP = PL.free.gigs;
const used0 = (await stA(TA4)).show.gigCount || 0;
ok('she has already used at least one show', used0 >= 1, used0);
let started = 0;
for (let i = 0; i < CAP - used0; i++) if ((await A(TA4, 'newShow')).ok) started++;
eq(`she can start exactly the rest of her ${CAP}`, started, Math.max(0, CAP - used0));

const overCap = await A(TA4, 'newShow');
eq('one past the cap is refused', overCap.status, 402);
ok('and says when it resets', /resets on the 1st/i.test(overCap.error || ''), overCap.error);

/* newShow leaves the show LIVE, and setting live when already live is a no-op —
   correctly uncapped. End it first, then the Start button is the capped path. */
await A(TA4, 'status', { status: 'ended' });
const goLive = await A(TA4, 'status', { status: 'live' });
eq('and Start the show is capped too, not just New show', goLive.status, 402);

/* Nothing may stop a night that is already running — INVARIANT 16. */
const sAna2 = await stA(TA4);
eq('her counter sits exactly on the cap', sAna2.show.gigCount, CAP);
ok('and the songs she has are untouched', Array.isArray(sAna2.songs), typeof sAna2.songs);
const ended = await A(TA4, 'status', { status: 'ended' });
ok('ending is never capped', ended.ok, ended);

/* Perry predates the registry, so planForArtist says 'free' for him. */
const ownerShow = await hit(admin, 'https://x/api/admin?code=devlocal', { action: 'newShow' });
ok('the founding artist is never capped', ownerShow.ok, ownerShow);

/* ── INVARIANT 0x: a venue is not an artist ──────────────────────── */
console.log('\nINVARIANT 0x  the venue boundary is structural, not a permission check');

const vOnAdmin = await hit(admin, 'https://x/api/admin', { action: 'venue', venue: 'x' }, TV);
eq('a venue token on /api/admin -> 401', vOnAdmin.status, 401);
const vOnStage = await hit(stageFn, 'https://x/api/stage', undefined, TV);
eq('a venue token on /api/stage -> 401', vOnStage.status, 401);
const aOnVenue = await hit(vadminFn, 'https://x/api/venueadmin', { action: 'profile' }, TA2);
eq('an artist token on /api/venueadmin -> 401', aOnVenue.status, 401);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
