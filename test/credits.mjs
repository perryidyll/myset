/* THE PAID-VOTE LEDGER.

   `extra` — the votes a fan bought — was read as part of `total` in four places and
   decremented in exactly ONE place in the whole codebase (gift.mjs). So a purchased
   pack never ran out. Measured before the fix: an 18-vote pack yielded 252 credits
   across 13 rounds, and survived `newShow` untouched, making one $11 purchase a
   permanent voting advantage at every future gig that artist ever played.

   The rule now: FREE CREDITS ARE SPENT FIRST, and a vote is charged AT THE CAST.

   Rewritten 2026-09-07, when Perry settled the other half of it: votes do not come
   back. They stay on the song they were cast for until it is played or the night
   ends, and nothing returns them — not the song losing, not the artist dropping it,
   not deleting it outright. There are no rounds any more, so `extra` is the pack a
   fan bought and `used`/`freeUsed` are what they have spent out of it; the two only
   meet at the end of the night, in carryFans. Most of what these cases used to
   assert was the opposite, which is exactly why they are worth reading. */
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
const vote = (fan, song, n) => hit(voteFn, 'https://x/api/vote', { fan, song, ...(n ? { n } : {}) });
const ask  = (fan, title) => hit(reqFn, `https://x/api/request?fan=${fan}`, { kind: 'song', title });
const extraOf = async (fan) => ((await readFans('perry-idyll'))[fan] || {}).extra;
/* What is LEFT of the pack, mid-show. `extra` is the pack as bought and does not
   move until the night ends (carryFans), so during a show this is the number that
   answers "how many of the ones I paid for have I still got?" — and it is exactly
   what the fan is shown. */
const packLeft = async (fan) => (await pub(fan)).credits.paidLeft;

/* A REALISTIC CREATION TIME. These were a fixed 2025 timestamp, which only worked
   because the Stripe test double ignored the `created` window. It no longer does —
   and neither does Stripe — so a session dated last year now falls outside
   revenue.mjs's 180-day window exactly as a real one would. */
const RECENT = Math.floor(Date.now() / 1000) - 3600;

/** Grant a pack through the REAL money path, so the test can't diverge from it. */
const buy = (fan, votes, id) => redeemSession('perry-idyll', {
  id, payment_status: 'paid', amount_total: 700, created: RECENT,
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

console.log('\nTWELVE VOTES IS TWELVE VOTES, AND THAT IS THE NIGHT');
await buy('alice', 9, 'cs_alice');
eq('9 bought on top of 3 free', (await pub('alice')).credits.total, 12);
for (let i = 0; i < 12; i++) await vote('alice', ids[i]);
eq('she can spend all twelve', (await pub('alice')).credits.remaining, 0);
await A('play', { song: ids[0] });        // one of the twelve she voted for
/* THE CHANGE OF 2026-09-07, in one assertion. Starting a song used to hand every
   fan their free credits back, so twelve votes was twelve votes PER SONG. It is now
   twelve votes for the night. */
eq('starting a song does NOT give her anything back', (await pub('alice')).credits.remaining, 0);
eq('the pack she bought is spent, and stays spent', await packLeft('alice'), 0);

console.log('\nBUT THE VOTES THEMSELVES STAY WHERE SHE PUT THEM');
/* The song that started collects its votes and nothing else is touched — this is
   the difference between "one round" and "one night". */
const boardA = (await pub('alice')).songs;
eq('the song that started took its own votes off the board',
   (boardA.find((x) => x.id === ids[0]) || {}).votes || 0, 0);
eq('and the other eleven are still standing',
   boardA.reduce((n, x) => n + (x.mine ? x.mineCount || 1 : 0), 0), 11);

console.log('\nFREE CREDITS ARE SPENT FIRST');
await buy('cara', 9, 'cs_cara');
/* ids[12] onwards, deliberately: ids[0] is the song alice's play started, and a vote
   for whatever is playing right now is refused. The first draft of this used ids[0]
   and lost a cast to that 409 — the arithmetic then came out one short and looked
   like a ledger bug. */
for (let i = 12; i < 15; i++) await vote('cara', ids[i]);
eq('three votes come out of the free three, not the pack', await packLeft('cara'), 9);
for (let i = 15; i < 20; i++) await vote('cara', ids[i]);
eq('the next five come off the pack', await packLeft('cara'), 4);
eq('and nothing was charged twice', (await pub('cara')).credits.used, 8);

console.log('\nWHAT IS SPENT IS EXACTLY WHAT WAS CAST, NEVER MORE (INVARIANT 15)');
await buy('dan', 9, 'cs_dan');
for (let i = 12; i < 17; i++) await vote('dan', ids[i]);
/* An OLD CACHED PAGE still sends `op:'clear'` when somebody taps a song they hold,
   because that used to mean "take it back". It is refused with a sentence rather
   than quietly turned into another cast: charging somebody for a tap that meant the
   opposite is the worse of the two mistakes. */
const t1 = await hit(voteFn, 'https://x/api/vote', { fan: 'dan', song: ids[16], op: 'clear' });
eq('a take-it-back from an old page is refused, and says why',
   [t1.status, t1.error], [409, 'Those votes are cast — they stay with the song']);
eq('and it charged her nothing', (await pub('dan')).credits.used, 5);
eq('three free, so two came off the pack', await packLeft('dan'), 7);

console.log('\nA REPLAY VOTE IS PRICED AT replayCost, AT THE MOMENT IT IS CAST');
/* This used to be a trap: the ledger settled at the round reset, and `play` takes
   the winning song back OUT of played[] — so pricing a just-won replay against the
   post-play show charged 1 instead of 5. Charging at the cast makes the trap
   impossible, because the price and the charge are the same instant. */
await A('newShow'); await A('freeCredits', { n: 3 }); await A('replayCost', { n: 5 });
await A('play', { song: ids[0] });                          // ids[0] is now played
await A('play', { song: ids[1] });                          // ids[0] stays in played[]
await buy('eve', 9, 'cs_eve');
const rv = await vote('eve', ids[0]);
eq('the replay cost her five', rv.cost, 5);
eq('three free and two off the pack, charged there and then', await packLeft('eve'), 7);
await A('playTop');                                          // her replay wins
eq('and winning does not re-price it', await packLeft('eve'), 7);

console.log('\nA SONG REQUEST SPENDS FROM THE SAME PURSE');
await A('askSet', { kind: 'song', on: true, cost: 4 });
await buy('finn', 9, 'cs_finn');
const r1 = await ask('finn', 'Something Not On The List');
ok('the request was taken', r1.ok, r1);
eq('four spent, three free, so one off the pack', await packLeft('finn'), 8);

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
/* The old version of this ran five rounds and expected 1 free EACH round plus the
   pack — eight casts. The free credit no longer comes back when a song starts, so
   the same fixture now buys her four: one free, three bought, and then nothing, for
   the rest of the night, however many songs go by. */
await A('newShow');
await A('freeCredits', { n: 1 });
await buy('hana', 3, 'cs_hana');
let accepted = 0;
for (let round = 0; round < 5; round++) {
  for (let i = 0; i < 6; i++) { const v = await vote('hana', ids[i]); if (v.ok && v.voted) accepted++; }
  await A('play', { song: ids[20 + (round % 5)] });
}
eq('1 free + a 3-vote pack = 4 casts for the whole night', accepted, 4);
eq('the pack is spent', await packLeft('hana'), 0);
eq('and five songs going by did not refill anything', (await pub('hana')).credits.remaining, 0);

console.log('\nDELETING A SONG TAKES THE VOTES OFF THE BOARD, NOT THE SPEND BACK');
/* Both of these cases used to assert a refund, and they were right to: with an
   un-vote available the fan could recover the credit themselves, and when finality
   removed the toggle, `releaseUnvotable` did it for them. Perry ended the argument
   on 2026-09-07 — a vote is spent when it is cast. What the fan is owed is being
   TOLD that before they confirm, which the vote sheet now does in his own words. */
await A('newShow');
await A('freeCredits', { n: 3 });
const doomed = (await A('addSong', { title: 'Doomed Song', artist: 'Test' })).songId;
await vote('ivy', doomed);
await vote('ivy', ids[1]);
eq('two credits spent, one left', (await pub('ivy')).credits.remaining, 1);
await A('removeSong', { song: doomed });
eq('deleting the song does NOT give the credit back', (await pub('ivy')).credits.remaining, 1);
const fanIvy = (await readFans('perry-idyll')).ivy;
ok('but the dead id is out of her picks, so nothing counts it', !(fanIvy.v || []).includes(doomed), fanIvy.v);
ok('her other vote is untouched', (fanIvy.v || []).includes(ids[1]), fanIvy.v);

console.log('\nAND NEITHER DOES HIDING ONE');
const hideMe = (await A('addSong', { title: 'Hidden Song', artist: 'Test' })).songId;
await vote('jo', hideMe);
eq('one credit spent', (await pub('jo')).credits.remaining, 2);
await A('toggleSong', { song: hideMe });
eq('hiding it does NOT give the credit back', (await pub('jo')).credits.remaining, 2);
const gone = (await readFans('perry-idyll')).jo;
ok('and her vote stays on it — it is simply not on offer any more',
   (gone.v || []).includes(hideMe), gone.v);

console.log('\nCHANGING THE PRICE MUST NOT RE-PRICE VOTES ALREADY CAST');
/* A fan spends 3 of 3 free credits. The artist then drops free credits to 1. If the
   free portion were worked out at the END, against whatever number happened to be
   set then, she would suddenly be 2 over the ceiling and the ledger would debit her
   PACK for credits she took from the free allowance. It is stamped as it is spent
   (`freeUsed`) instead, so a later price change cannot reach backwards. There is no
   round reset left to hide behind. */
await A('newShow');
await A('freeCredits', { n: 3 });
await buy('kit', 9, 'cs_kit');
for (let i = 0; i < 3; i++) await vote('kit', ids[i]);
eq('three free credits spent, pack untouched so far', (await pub('kit')).credits.used, 3);
await A('freeCredits', { n: 1 });
eq('THE BUG: her pack was not raided by the price change', await packLeft('kit'), 9);
eq('what she spent is still what she spent', (await pub('kit')).credits.used, 3);
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
