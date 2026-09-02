/* THE STUDIO-CODE DOOR.

   `setCode` wrote a hash into the calling artist's own show record, and
   `requireArtist` only ever read the FOUNDING artist's. So every artist except
   Perry got "that's your code from now on" for a code that could never let them
   in — INVARIANT 15d (get into your own Studio without a terminal) reintroduced
   for everyone but the founder, which is the 2026-08-30 stage lockout again.

   A code is now half a credential and the page name is the other half. These cases
   are the ones that make that safe rather than merely working: a code must open
   exactly one artist's door, an unknown page name must be indistinguishable from a
   wrong code, and the door must lock. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const { createArtist, signToken, readArtists, revOf } =
  await import('../netlify/functions/_auth.mjs');
const { MIN_CODE, weakCode } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
/** Sign in at the code door: a code, and optionally the page name it belongs to. */
const stageByCode = (code, slug) =>
  hit(stageFn, `https://x/api/stage?code=${encodeURIComponent(code)}` +
      (slug ? `&a=${encodeURIComponent(slug)}` : ''));

console.log('\nSETUP  three artists, each with their own page');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
const bo  = await createArtist({ email: 'bo@example.com',  name: 'Bo Tran',   slug: 'bo-tran' });
const cy  = await createArtist({ email: 'cy@example.com',  name: 'Cy Lo',     slug: 'cy-lo' });
ok('all three created', ana.ok && bo.ok && cy.ok);
const reg = await readArtists();
const TA = await signToken('ana@example.com', revOf(reg, ana.artistId));
const TB = await signToken('bo@example.com',  revOf(reg, bo.artistId));
const TC = await signToken('cy@example.com',  revOf(reg, cy.artistId));
const A = (token, action, extra = {}) => hit(admin, 'https://x/api/admin', { action, ...extra }, token);
await A(TA, 'addSong', { title: 'Ana Only', artist: 'Ana' });
await A(TB, 'addSong', { title: 'Bo Only', artist: 'Bo' });

console.log('\nA CODE MUST BE STRONG ENOUGH TO BE A DOOR');
eq(`the minimum is ${MIN_CODE}`, MIN_CODE, 8);
ok('four characters is refused', weakCode('abcd'));
ok('a repeated character is refused', weakCode('aaaaaaaa'));
ok('"password" is refused', weakCode('password'));
ok('the artist\'s own page name is refused', weakCode('ana-reyes', 'ana-reyes'));
ok('a real code is accepted', !weakCode('brightmoon7'));
const weak = await A(TA, 'setCode', { code: 'abcd' });
eq('and the endpoint refuses it too', [weak.status, /at least 8/.test(weak.error || '')], [400, true]);

console.log('\nAN ARTIST\'S OWN CODE OPENS THEIR OWN STUDIO, AND ONLY THAT ONE');
ok('Ana sets a code', (await A(TA, 'setCode', { code: 'anacode123' })).ok);
ok('Bo sets a different one', (await A(TB, 'setCode', { code: 'bocode456' })).ok);

const asAna = await stageByCode('anacode123', 'ana-reyes');
ok('THE BUG: Ana gets into her OWN Studio with her own code', asAna.ok, asAna);
eq('and it really is hers', asAna.songs.map((s) => s.title), ['Ana Only']);

const anaAtBo = await stageByCode('anacode123', 'bo-tran');
eq("Ana's code does not open Bo's page", anaAtBo.status, 401);
const boAtAna = await stageByCode('bocode456', 'ana-reyes');
eq("and Bo's does not open Ana's", boAtAna.status, 401);

const anaNoSlug = await stageByCode('anacode123');
eq('with no page name it is tried against the founder, and fails', anaNoSlug.status, 401);

console.log('\nTHE FOUNDER\'S DOORS ARE UNCHANGED  (existing links and the recovery key)');
const master = await stageByCode('devlocal');
ok('ADMIN_CODE still reaches the founding artist', master.ok, master.status);
ok('and it is the founder\'s Studio, not anyone else\'s',
   !master.songs.some((s) => s.title === 'Ana Only'));
const masterAtAna = await stageByCode('devlocal', 'ana-reyes');
ok('the recovery key is the founder\'s, so it does not become a master key for Ana',
   masterAtAna.status === 401 || masterAtAna.artistId === undefined, masterAtAna.status);

console.log('\nAN UNKNOWN PAGE NAME LOOKS EXACTLY LIKE A WRONG CODE  (no enumeration)');
const ghost = await stageByCode('anacode123', 'no-such-artist');
const wrong = await stageByCode('definitelywrong', 'ana-reyes');
eq('same status', ghost.status, wrong.status);
eq('and the same body, byte for byte', ghost.error, wrong.error);

console.log('\nTHE DOOR LOCKS');
ok('Cy sets a code', (await A(TC, 'setCode', { code: 'cycode789' })).ok);
ok('and can get in', (await stageByCode('cycode789', 'cy-lo')).ok);
for (let i = 0; i < 10; i++) await stageByCode('guess' + i + 'aaaa', 'cy-lo');
const locked = await stageByCode('cycode789', 'cy-lo');
eq('THE BUG: after ten wrong guesses even the RIGHT code is refused', locked.status, 401);
eq('and the refusal is identical to a wrong code, so the lock is not an oracle',
   locked.error, (await stageByCode('stillwrong1', 'cy-lo')).error);
ok('the lockout is per artist — Ana is unaffected',
   (await stageByCode('anacode123', 'ana-reyes')).ok);
ok('and the founder can always get in, lockouts or not',
   (await stageByCode('devlocal')).ok);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
