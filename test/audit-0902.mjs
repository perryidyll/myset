/* The 2026-09-02 audit's fixes, one case each, against the REAL handlers and the
   in-memory blob store. Every one of these reproduced a live defect before the fix.

   1. "∞ Unlimited" silently ate every pack the room had bought, and disabled every
      Vote button while it did it — so the one feature meant for a paid private party
      broke voting AND destroyed the buyers' credits.
   2. A song title with no Latin letters or digits — Thai, Japanese, Cyrillic, an
      emoji — became a song with the EMPTY id, which no vote can ever name.
*/
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin  = (await import('../netlify/functions/admin.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const voteFn = (await import('../netlify/functions/vote.mjs')).default;
const { redeemSession } = await import('../netlify/functions/_pay.mjs');
const { readFans, songId, songSig, slug } = await import('../netlify/functions/_lib.mjs');
const { readFileSync } = await import('node:fs');

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, '\n      got  ' + a + '\n      want ' + b); }
};
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const hit = async (h, url, body) => {
  const r = await h(new Request(url, body === undefined ? {} : {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A    = (action, extra = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...extra });
const pub  = (fan) => hit(showFn, `https://x/api/show?fan=${fan}`);
const vote = (fan, song) => hit(voteFn, 'https://x/api/vote', { fan, song });
const extraOf = async (fan) => ((await readFans('perry-idyll'))[fan] || {}).extra;

/* A REALISTIC CREATION TIME. These were a fixed 2025 timestamp, which only worked
   because the Stripe test double ignored the `created` window. It no longer does —
   and neither does Stripe — so a session dated last year now falls outside
   revenue.mjs's 180-day window exactly as a real one would. */
const RECENT = Math.floor(Date.now() / 1000) - 3600;
const buy = (fan, votes, id) => redeemSession('perry-idyll', {
  id, payment_status: 'paid', amount_total: 700, created: RECENT,
  metadata: { fan, kind: 'votes', votes: String(votes) },
});

console.log('\nSETUP');
const TITLES = Array.from({ length: 12 }, (_, i) => 'Song ' + String.fromCharCode(65 + i));
for (const t of TITLES) await A('addSong', { title: t, artist: 'Test' });
await A('freeCredits', { n: 3 });
await A('status', { status: 'live' });
const ids = (await pub('setup')).songs.map((s) => s.id);
eq('twelve songs, three free credits', [ids.length, (await pub('setup')).credits.total], [12, 3]);

/* ── 1. UNLIMITED MUST NOT TOUCH A BOUGHT PACK ──────────────────────────────
   The server skips the credit check entirely while unlimited is on, so nothing
   is ever owed for those votes. creditsUsed still counts them, and paidUsed used
   to read that count as paid — debiting `extra` for votes that were free. */
console.log('\nUNLIMITED ROUNDS ARE FREE, SO THEY MUST NOT DEBIT A PACK');
await buy('zoe', 12, 'cs_zoe');
eq('zoe holds a twelve-vote pack', await extraOf('zoe'), 12);
await A('unlimited', { on: true });
for (let i = 0; i < 7; i++) await vote('zoe', ids[i]);
ok('she votes freely while unlimited', (await pub('zoe')).credits.unlimited === true);
await A('play', { song: ids[10] });
eq('THE BUG: her pack survives the round', await extraOf('zoe'), 12);
await A('play', { song: ids[11] });
eq('and a second unlimited round too', await extraOf('zoe'), 12);
await A('unlimited', { on: false });
eq('with unlimited off she still has all twelve', (await pub('zoe')).credits.paidLeft, 12);

console.log('\nAND PAYING FOR THEM STILL SETTLES THE PACK (the 13b ledger is intact)');
/* Her seven unlimited votes are still on the board — nothing takes votes off it any
   more except the song being played — but they cost her nothing and must go on
   costing her nothing. `used` counts from zero because `chargeFan` stamped her
   ledger at zero while she was unlimited, which is the whole point of stamping it.
   The settlement moved from the round reset to the cast on 2026-09-07, so `extra`
   (the pack as bought) no longer moves during the show; `paidLeft` is what she has
   left of it. */
for (let i = 0; i < 6; i++) await vote('zoe', ids[i]);
eq('three free plus three paid spent', (await pub('zoe')).credits.used, 6);
eq('exactly the paid portion came off', (await pub('zoe')).credits.paidLeft, 9);

/* ── 2. A NON-LATIN TITLE MUST STILL GET A USABLE ID ───────────────────────── */
console.log('\nA TITLE IN ANY ALPHABET IS STILL A SONG THE ROOM CAN VOTE FOR');
eq('slug() alone is empty for Thai — the root cause', slug('ทะเลใจ'), '');
ok('songId() is not', songId('ทะเลใจ', 'คาราบาว').length > 1);
ok('and it is stable', songId('ทะเลใจ', 'คาราบาว') === songId('ทะเลใจ', 'คาราบาว'));
ok('two different Thai titles get different ids',
   songId('ทะเลใจ', 'คาราบาว') !== songId('เมดอินไทยแลนด์', 'คาราบาว'));
eq('a Latin title is untouched', songId('Hey Jude', 'The Beatles'), 'hey-jude');

const addThai = await A('addSong', { title: 'ทะเลใจ', artist: 'คาราบาว' });
ok('the Thai song is added', addThai.ok, addThai);
const thai = (await pub('nid')).songs.find((s) => s.title === 'ทะเลใจ');
ok('THE BUG: the room can see it', !!thai, (await pub('nid')).songs.map((s) => s.title).slice(-3));
ok('and its id is not empty', thai && thai.id.length > 1, thai);
const vt = await vote('nid', thai.id);
ok('THE BUG: and a fan can actually vote for it', vt.ok && vt.voted === true, vt);
eq('the vote landed on that song', (await pub('nid')).songs.find((s) => s.id === thai.id).votes, 1);

console.log('\nTWO DIFFERENT NON-LATIN TITLES ARE NOT DUPLICATES OF EACH OTHER');
ok('their import signatures differ',
   songSig('ทะเลใจ', 'คาราบาว') !== songSig('เมดอินไทยแลนด์', 'คาราบาว'));
const imp = await A('importSongs', { songs: [
  { title: 'เมดอินไทยแลนด์', artist: 'คาราบาว' },
  { title: '上を向いて歩こう', artist: '坂本九' },
  { title: 'Подмосковные вечера', artist: 'Соловьёв-Седой' },
] });
// importSongs reports its count in `note`, not a field — assert on what it returns
ok('all three import', imp.ok && /Added 3 songs/.test(imp.note || ''), imp.note);
const after = (await pub('nid')).songs.map((s) => s.id);
eq('each got its own id', new Set(after).size, after.length);
ok('none of them is empty', after.every((x) => x.length > 1));

/* ── 3. THE CLIENT RULE THAT DISABLED THE WHOLE ROOM ────────────────────────
   Structural, because it is one expression in a page: `null < cost` is true, so
   an unlimited room had every Vote button disabled. INVARIANT 17e — a JS parse
   check is not a structure check, so assert the guard is actually present. */
console.log('\nTHE VOTE BUTTON RULE ITSELF GUARDS THE UNLIMITED CASE');
const votePage = readFileSync(new URL('../public/vote.html', import.meta.url), 'utf8');
const disRule = votePage.match(/const dis=[^;]+;/);
ok('the rule is still there to check', !!disRule, disRule);
ok('THE BUG: it short-circuits on unlimited before comparing remaining',
   /!c\.unlimited\s*&&\s*c\.remaining\s*<\s*cost/.test(disRule[0]), disRule && disRule[0]);
/* The rule moved out of show.mjs on 2026-09-11: credits are shaped once, in
   _board.mjs (buildMe), for /api/show and /api/me alike. */
ok('and the server does send null for remaining when unlimited',
   /remaining: unl \? null/.test(readFileSync(new URL('../netlify/functions/_board.mjs', import.meta.url), 'utf8')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
