/* THE PAID-VOTE LEDGER.

   `extra` — the votes a fan bought — was read as part of `total` in four places and
   decremented in exactly ONE place in the whole codebase (gift.mjs). So a purchased
   pack never ran out. Measured before the fix: an 18-vote pack yielded 252 credits
   across 13 rounds, and survived `newShow` untouched, making one $11 purchase a
   permanent voting advantage at every future gig that artist ever played.

   The rule now: FREE CREDITS ARE SPENT FIRST, and the paid remainder of a round is
   settled once, at the round reset, inside clearAllFanVotes. Every case below failed
   or was meaningless before that change. */
process.env.ADMIN_CODE = 'devlocal';
// songs are started milliseconds apart here; the real 8s double-tap guard is
// exercised deliberately in its own case below
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const reqFn  = (await import('../netlify/functions/request.mjs')).default;
const { redeemSession } = await import('../netlify/functions/_pay.mjs');
const { readFans } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (JSON.stringify(got) === JSON.stringify(want)) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); }
};
const ok = (name, c, d) => { if (c) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, d === undefined ? '' : '\n      ' + JSON.stringify(d)); } };

const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A    = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const pub  = (fan) => hit(showFn, `https://x/api/show?fan=${fan}`);
const vote = (fan, song) => hit(voteFn, 'https://x/api/vote', { fan, song });
const ask  = (fan, title) => hit(reqFn, `https://x/api/request?fan=${fan}`, { kind: 'song', title });
const extraOf = async (fan) => ((await readFans('perry-idyll'))[fan] || {}).extra;

/** Grant a pack through the REAL money path, so the test can't diverge from it. */
const buy = (fan, votes, id) => redeemSession('perry-idyll', {
  id, payment_status: 'paid', amount_total: 700, created: Math.floor(1756000000),
  metadata: { fan, kind: 'votes', votes: String(votes) },
});

console.log('\nSETUP');
const TITLES = Array.from({ length: 26 }, (_, i) => 'Song ' + String.fromCharCode(65 + i));
for (const t of TITLES) await A('addSong', { title: t, artist: 'Test' });
await A('freeCredits', { n: 3 });
await A('replayCost', { n: 5 });
await A('status', { status: 'live' });
const ids = (await pub('setup')).songs.map((s) => s.id);
eq('26 songs, 3 free credits', [ids.length, (await pub('setup')).credits.total], [26, 3]);

console.log('\nA PACK IS A STOCK, NOT A PER-ROUND ALLOWANCE');
await buy('alice', 9, 'cs_alice');
eq('9 bought on top of 3 free', (await pub('alice')).credits.total, 12);
for (let i = 0; i < 12; i++) await vote('alice', ids[i]);
eq('she can spend all twelve', (await pub('alice')).credits.remaining, 0);
await A('play', { song: ids[20] });
eq('THE BUG: the pack is gone after the round', await extraOf('alice'), 0);
eq('and she is back to three free', (await pub('alice')).credits.total, 3);

console.log('\nA CONTROL FAN IS UNAFFECTED');
await vote('bob', ids[0]); await vote('bob', ids[1]);
await A('play', { song: ids[21] });
eq('free credits still refresh in full', (await pub('bob')).credits.total, 3);
eq('and bob never had a pack', await extraOf('bob'), 0);   // mutateFan seeds extra:0

console.log('\nFREE CREDITS ARE SPENT FIRST');
await buy('cara', 9, 'cs_cara');
for (let i = 0; i < 3; i++) await vote('cara', ids[i]);
await A('play', { song: ids[22] });
eq('three votes come out of the free three, not the pack', await extraOf('cara'), 9);
for (let i = 0; i < 5; i++) await vote('cara', ids[i]);
await A('play', { song: ids[23] });
eq('five votes debit exactly two from the pack', await extraOf('cara'), 7);

console.log('\nUN-VOTING NEVER BURNS A PAID VOTE (INVARIANT 15)');
await buy('dan', 9, 'cs_dan');
for (let i = 0; i < 5; i++) await vote('dan', ids[i]);
/* This used to toggle two votes back off and assert the pack was untouched. Votes
   are final since 2026-09-02, so a second tap on a song you hold is no longer an
   un-vote — the two extra casts land, and the pack settles the paid portion. The
   INVARIANT 15 property being protected here has not changed: what is spent is
   exactly what was cast, never more. */
/* A BARE BODY on a song they already hold is REFUSED under finality, rather than
   quietly becoming two more votes. That is deliberate: an old cached page means
   "un-vote", and charging somebody who meant to take a vote back is the worse of
   the two mistakes. Adding more requires an explicit op:'cast' from the new sheet. */
const t1 = await vote('dan', ids[4]), t2 = await vote('dan', ids[3]);
eq('both bare taps refused', [t1.status, t2.status], [409, 409]);
eq('so five are cast, as before', (await pub('dan')).credits.used, 5);
await A('play', { song: ids[24] });
eq('three free, so two came off the pack', await extraOf('dan'), 7);

console.log('\nA REPLAY VOTE IS PRICED AT replayCost, BEFORE played[] MOVES');
/* `play` takes the winning song back OUT of played[], so settling the ledger against
   the POST-play show prices a just-won replay at 1 instead of 5 and under-debits the
   pack. admin.mjs snapshots the show before the mutation for exactly this. */
await A('play', { song: ids[0] });                          // ids[0] is now played
await A('play', { song: ids[1] });                          // ids[0] stays in played[]
await buy('eve', 9, 'cs_eve');
const rv = await vote('eve', ids[0]);
eq('the replay cost her five', rv.cost, 5);
await A('playTop');                                          // her replay wins, ids[0] leaves played[]
eq('and the pack was debited two, not zero', await extraOf('eve'), 7);

console.log('\nA SONG REQUEST SPENDS FROM THE SAME PURSE');
await A('askSet', { kind: 'song', on: true, cost: 4 });
await buy('finn', 9, 'cs_finn');
const r1 = await ask('finn', 'Something Not On The List');
ok('the request was taken', r1.ok, r1);
await A('play', { song: ids[25] });
eq('four spent, three free, so one off the pack', await extraOf('finn'), 8);

console.log('\nWHAT CARRIES INTO THE NEXT SHOW');
/* Fresh show first. Earlier sections left songs in played[], and a vote on a played
   song costs replayCost — the first draft of this test asserted 5 credits used and
   measured 12, which was the fixture lying, not the code. */
await A('newShow');
await A('freeCredits', { n: 3 });
eq('nothing has been played yet', (await A('window', { open: true })).stage.show.played.length, 0);
await buy('gus', 9, 'cs_gus');
for (let i = 0; i < 5; i++) await vote('gus', ids[i]);
eq('mid-round, five used at one credit each', (await pub('gus')).credits.used, 5);
await A('newShow');
eq('holding votes at the end costs nothing paid', await extraOf('gus'), 7);
eq('and the balance is what the next show starts with', (await pub('gus')).credits.total, 10);

console.log('\nA PACK RUNS OUT AND STAYS OUT');
await A('newShow');
await A('freeCredits', { n: 1 });
await buy('hana', 3, 'cs_hana');
let accepted = 0;
for (let round = 0; round < 5; round++) {
  for (let i = 0; i < 6; i++) { const v = await vote('hana', ids[i]); if (v.ok && v.voted) accepted++; }
  await A('play', { song: ids[20 + (round % 5)] });
}
eq('1 free x5 rounds + a 3-vote pack = 8 casts, not 20', accepted, 8);
eq('the pack is spent', await extraOf('hana'), 0);

console.log('\nDELETING A SONG REFUNDS THE CREDIT HELD ON IT');
/* creditsUsed counts every id in fan.v whether the song still exists or not, and
   vote.mjs answers 404 before the un-vote path — so a hard delete used to strand
   the credit with no row in the UI to tap. Hiding and narrowing are now handled the
   same way, by releaseUnvotable, since finality removed the toggle that covered
   them. */
await A('newShow');
await A('freeCredits', { n: 3 });
const doomed = (await A('addSong', { title: 'Doomed Song', artist: 'Test' })).songId;
await vote('ivy', doomed);
await vote('ivy', ids[1]);
eq('two credits spent, one left', (await pub('ivy')).credits.remaining, 1);
await A('removeSong', { song: doomed });
eq('THE BUG: the credit came back when the song went', (await pub('ivy')).credits.remaining, 2);
const fanIvy = (await readFans('perry-idyll')).ivy;
ok('and the dead id is out of her picks', !(fanIvy.v || []).includes(doomed), fanIvy.v);
ok('her other vote is untouched', (fanIvy.v || []).includes(ids[1]), fanIvy.v);

console.log('\nHIDING A SONG RELEASES THE VOTES ON IT, WITHOUT THE FAN DOING ANYTHING');
/* The un-vote toggle used to be the escape hatch: hide a song and the holder could
   tap it off. With votes final there is no toggle, so the release has to be
   automatic or the credit is stranded for the rest of the round — which is a
   stronger guarantee than the old one, because the fan need not even notice. */
const hideMe = (await A('addSong', { title: 'Hidden Song', artist: 'Test' })).songId;
await vote('jo', hideMe);
eq('one credit spent', (await pub('jo')).credits.remaining, 2);
const hid = await A('toggleSong', { song: hideMe });
eq('THE CREDIT CAME BACK BY ITSELF', (await pub('jo')).credits.remaining, 3);
ok('and the artist is told it happened', /went back to the room/.test(hid.note || ''), hid.note);
const gone = (await readFans('perry-idyll')).jo;
ok('the hidden id is out of her picks', !(gone.v || []).includes(hideMe), gone.v);

console.log('\nCHANGING THE PRICE MUST NOT RE-PRICE VOTES ALREADY CAST');
/* A fan spends 3 of 3 free credits. The artist then drops free credits to 1. Without
   a reset the fan is suddenly 2 over the ceiling, and the ledger (13b) debits their
   PACK for credits they never took from it. Changing the price resets the round, so
   the old round settles at the old prices. */
await A('newShow');
await A('freeCredits', { n: 3 });
await buy('kit', 9, 'cs_kit');
for (let i = 0; i < 3; i++) await vote('kit', ids[i]);
eq('three free credits spent, pack untouched so far', (await pub('kit')).credits.used, 3);
await A('freeCredits', { n: 1 });
eq('THE BUG: her pack was not raided by the price change', await extraOf('kit'), 9);
eq('and the round was refreshed, not re-priced', (await pub('kit')).credits.used, 0);
eq('at the new ceiling', (await pub('kit')).credits.total, 10);

console.log('\nC048  ENDING BY MISTAKE MUST NOT COST A FAN THEIR PAID VOTES');
/* The "what happens to your votes" sheet appears the instant the artist taps End.
   It used to debit `extra` immediately, so an End tapped by mistake asked the whole
   room to give away votes they had paid for while the night carried on. The choice is
   now a PLEDGE, honoured only at the real boundary (newShow). */
const giftFn = (await import('../netlify/functions/gift.mjs')).default;
const gift = (fan, choice) => hit(giftFn, 'https://x/api/gift', { fan, choice });

await A('newShow');
await A('freeCredits', { n: 3 });
await A('status', { status: 'live' });
await buy('lena', 9, 'cs_lena');
eq('she has nine paid votes', await extraOf('lena'), 9);

const tooEarly = await gift('lena', 'gift');
eq('the endpoint refuses while the show is live', tooEarly.status, 409);

await A('status', { status: 'ended' });
const g1 = await gift('lena', 'gift');
ok('now she can choose', g1.ok, g1);
eq('THE BUG: her votes are NOT gone yet — only pledged', await extraOf('lena'), 9);

await A('status', { status: 'live' });            // ended by mistake; carry on
eq('so a restart leaves her whole', await extraOf('lena'), 9);
const pAgain = await pub('lena');
eq('and she can spend them again', pAgain.credits.total, 12);

await A('status', { status: 'ended' });
await gift('lena', 'gift');
await A('newShow');                              // the real end of the night
eq('at the real boundary the pledge is honoured', await extraOf('lena'), undefined);

console.log('\n  and "keep them" still carries them over');
await A('freeCredits', { n: 3 });
await A('status', { status: 'live' });
await buy('milo', 9, 'cs_milo');
await A('status', { status: 'ended' });
await gift('milo', 'keep');
await A('newShow');
eq('kept votes survive into the next show', await extraOf('milo'), 9);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
