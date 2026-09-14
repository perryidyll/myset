/* EMAIL + PASSWORD — the standard door  (decision 0070, _cred.mjs, auth.mjs)

   The founder asked for "the fully standard shape": the email address as the
   username, a password under it. What this pins:
     · a password is per ADDRESS, set by a signed-in person for their own row
     · a correct one mints the same session every other door mints
     · every failure — no account, no password, wrong, locked — is one message,
       and the lockout is per address (five wrong, then a wait)
     · changing it needs the current one OR a fresh six-digit code (the "forgot"
       path), and signs every other device of that address out
     · weak ones are refused with a reason; a Studio-code session cannot set one
     · the record is hashed with scrypt and a salt, never the password itself
     · delete walks it; export never carries it */
process.env.ADMIN_CODE = 'devlocal';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => String(url).startsWith('https://api.resend.com/')
  ? Promise.resolve(new Response('{}', { status: 202 })) : nativeFetch(url, opts);

const authFn = (await import('../netlify/functions/auth.mjs')).default;
const admin  = (await import('../netlify/functions/admin.mjs')).default;
const { createArtist, readArtists, issueCode, signToken, revOf } = await import('../netlify/functions/_auth.mjs');
const { credKey, weakPassword, LOCK_TRIES } = await import('../netlify/functions/_cred.mjs');
const { keysFor, exportArtist } = await import('../netlify/functions/_account.mjs');
const { readDoc } = await import('../netlify/functions/_lib.mjs');
const { __dump } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A = (body, token) => hit(authFn, 'https://x/api/auth', body, token);
const S = (body, token) => hit(admin, 'https://x/api/admin', body, token);
const NOPE = 'That email and password don’t match';

console.log('\nSETUP  an artist in by the front door (a six-digit code)');
await createArtist({ email: 'kai@example.com', name: 'Kai Moss', slug: 'kai' });
const code1 = await issueCode('kai@example.com');
let r = await A({ action: 'verify', email: 'kai@example.com', code: code1 });
ok('signed in by code, with a session', r.ok && r.token, r);
const T1 = r.token;
const reg = await readArtists();
const kai = reg.byEmail['kai@example.com'].artistId;

console.log('\nNO PASSWORD YET');
eq('the password door says no, in one sentence', [(r = await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'anything-at-all' })).status, r.error], [401, NOPE]);
r = await A({ action: 'list' }, T1);
eq('Settings knows there is none', r.emails.find((e) => e.me).pw, false);

console.log('\nCREATE ONE');
for (const [pw, why] of [['short', 'At least 8 characters'], ['aaaaaaaaa', 'Not the same character over and over'], ['kai@example.com', 'Not your email address'], ['password1', 'That one is too easy to guess']])
  eq(`refused: ${pw} — ${why}`, (await A({ action: 'passwordSet', password: pw }, T1)).error, why);
r = await A({ action: 'passwordSet', password: 'correct horse battery' }, T1);
ok('a good one is saved, no current password needed the first time', r.ok, r);
const doc = (await readDoc(credKey(kai, 'kai@example.com'), null)).data;
ok('stored as scrypt with a salt — never the password', doc && doc.alg === 'scrypt' && doc.salt && doc.hash && !JSON.stringify(doc).includes('horse'), doc);
r = await A({ action: 'list' }, T1);
eq('Settings now says set', r.emails.find((e) => e.me).pw, true);

console.log('\nSIGN IN WITH IT');
r = await A({ action: 'passwordSignIn', email: 'KAI@example.com ', password: 'correct horse battery' });
ok('email + password → a session (the address is normalised)', r.ok && r.token && r.email === 'kai@example.com' && r.slug === 'kai', r);
const T2 = r.token;
ok('and the session works in the Studio', (await S({ action: 'planGet' }, T2)).ok);
eq('a wrong password: the same sentence', (await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'wrong' })).error, NOPE);
eq('an address nobody has: the same sentence, the same status', [(r = await A({ action: 'passwordSignIn', email: 'nobody@example.com', password: 'wrong' })).status, r.error], [401, NOPE]);
ok('the password never rides on a request afterwards — the token is the credential', !T2.includes('horse'));

console.log('\nLOCKOUT, PER ADDRESS');
for (let i = 1; i < LOCK_TRIES; i++) await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'wrong' + i });
eq(`after ${LOCK_TRIES} wrong, even the right one is refused`, (await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'correct horse battery' })).error, NOPE);
ok('the lock is on the address, not the page — the code door still works', (r = await A({ action: 'verify', email: 'kai@example.com', code: await issueCode('kai@example.com') })).ok, r);
ok('and an address nobody has never gets a lock record', ![...__dump().keys()].some((k) => k.startsWith('lock_pw_') && (__dump().get(k).body + '').includes('nobody')));
// clear the lock the way time would
for (const k of [...__dump().keys()]) if (k.startsWith('lock_pw_')) __dump().delete(k);
const { store } = await import('../netlify/functions/_lib.mjs');
for (const k of [...__dump().keys()]) if (k.startsWith('lock_pw_')) await store().delete(k);

console.log('\nCHANGE IT');
eq('without the current one: refused', (await A({ action: 'passwordSet', password: 'a whole new phrase' }, T2)).status, 401);
eq('with the wrong current one: refused, and says so', (await A({ action: 'passwordSet', password: 'a whole new phrase', current: 'nope nope nope' }, T2)).error, 'That isn’t your current password');
r = await A({ action: 'passwordSet', password: 'a whole new phrase', current: 'correct horse battery' }, T2);
ok('with the right one: changed, and the other device of this address is signed out', r.ok && r.signedOut >= 1, r);
eq('the old device is out', (await S({ action: 'planGet' }, T1)).status, 401);
ok('this device stays in', (await S({ action: 'planGet' }, T2)).ok);
ok('the new password opens the door', (await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'a whole new phrase' })).ok);
eq('the old one does not', (await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'correct horse battery' })).error, NOPE);

console.log('\nFORGOT IT: the six-digit code is the way back');
const T3 = (await A({ action: 'verify', email: 'kai@example.com', code: await issueCode('kai@example.com') })).token;
ok('in by code (no password needed)', !!T3);
const fresh = await issueCode('kai@example.com');
eq('a wrong code does not change it', (await A({ action: 'passwordSet', password: 'third time lucky', code: '000000' }, T3)).status, 401);
r = await A({ action: 'passwordSet', password: 'third time lucky', code: fresh }, T3);
ok('a fresh code stands in for the current password', r.ok, r);
ok('and it works', (await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'third time lucky' })).ok);

console.log('\nWHOSE IT IS');
const codeless = await signToken('kai@example.com', revOf(await readArtists(), kai));
ok('a session with no sid still sets one for its address', (await A({ action: 'passwordSet', password: 'from an old token', current: 'third time lucky' }, codeless)).ok);
console.log('\nFROM THE STUDIO CODE  (the founder, 2026-09-14: "i don\u2019t see a set password option")');
/* A Studio code on kai's own page, so the code session lands on kai's account
   (the master code lands on the default artist, which is a different page). */
ok('kai sets a Studio code', (await S({ action: 'setCode', code: 'kai-studio-code' }, codeless)).ok);
const kaiSlug = (await readArtists()).byId[kai].slug;
const viaCode = (body) => hit(authFn, `https://x/api/auth?code=kai-studio-code&a=${encodeURIComponent(kaiSlug)}`, body);
r = await viaCode({ action: 'passwordSet', password: 'from the studio code' });
eq('a code session must name an address on the account', [r.status, r.error], [400, 'Pick one of the addresses on this account']);
await A({ action: 'add', email: 'stranger@example.com', role: 'member' }, codeless).catch(() => {});
const anyOther = (await readArtists()).byEmail;
r = await viaCode({ action: 'passwordSet', password: 'from the studio code', email: 'nobody@example.com', code: '123456' });
eq('an address that is not on it: refused before any code is checked', r.status, 400);
if (anyOther['stranger@example.com'])
  eq('a member row is not an address a code session may key', (await viaCode({ action: 'passwordSet', password: 'from the studio code', email: 'stranger@example.com', code: '123456' })).status, 400);
r = await viaCode({ action: 'passwordSet', password: 'from the studio code', email: 'kai@example.com', code: '000000' });
eq('the right address with a wrong code: refused', [r.status, r.error], [401, 'Check the code and try again']);
r = await viaCode({ action: 'passwordSet', password: 'from the studio code', email: 'KAI@example.com', code: await issueCode('kai@example.com') });
eq('the right address with its code: set, and says whose', [r.ok, r.email], [true, 'kai@example.com']);
ok('and the email+password door opens with it', (await A({ action: 'passwordSignIn', email: 'kai@example.com', password: 'from the studio code' })).ok);
/* A second owner address on the same page (the shape the founder's account has:
   two addresses, one page). The code session keys THAT one too, on its own code. */
const { mutateArtists } = await import('../netlify/functions/_auth.mjs');
await mutateArtists((reg) => { reg.byEmail['kai.second@example.com'] = { artistId: kai, role: 'owner' }; return true; });
r = await viaCode({ action: 'passwordSet', password: 'the second address', email: 'kai.second@example.com', code: await issueCode('kai.second@example.com') });
ok('a second owner address on the page gets its own password the same way', r.ok, r);
ok('and opens the door on its own', (await A({ action: 'passwordSignIn', email: 'kai.second@example.com', password: 'the second address' })).ok);
eq('Settings lists both, each with its own state', (await A({ action: 'list' }, codeless)).emails.filter((e) => e.pw).map((e) => e.email).sort(), ['kai.second@example.com', 'kai@example.com']);
/* Back to the password the rest of the file expects on kai's own address. */
ok('changing it with the current one still works for a signed-in address', (await A({ action: 'passwordSet', password: 'from an old token', current: 'from the studio code' }, codeless)).ok);
eq('and that change signed the code session of the same address out', (await S({ action: 'planGet' }, T3)).status, 401);
r = await A({ action: 'passwordClear', current: 'wrong' }, codeless);
eq('removing it needs the current one', r.status, 401);
r = await A({ action: 'passwordClear', current: 'from an old token' }, codeless);
ok('removed on request', r.ok && !(await readDoc(credKey(kai, 'kai@example.com'), null)).data, r);
eq('and Settings says not set again', (await A({ action: 'list' }, codeless)).emails.find((e) => e.me).pw, false);

console.log('\nDELETE WALKS IT, EXPORT NEVER CARRIES IT');
await A({ action: 'passwordSet', password: 'one last password' }, codeless);
ok('the record is in the key list a delete walks', (await keysFor(kai)).includes(credKey(kai, 'kai@example.com')));
ok('the export has no trace of it', !JSON.stringify(await exportArtist(kai)).includes('scrypt'));
eq('weakPassword on a fine one is null', weakPassword('a perfectly fine one', 'kai@example.com'), null);

console.log('\nTHE SCREEN, AS SPECIFIED  (the founder, 2026-09-14)');
const { src } = await import('./_src.mjs');
for (const [page, js] of [['studio.html', 'studio.js'], ['venue-studio.html', 'venue-studio.js']]) {
  const html = src(new URL('../public/' + page, import.meta.url)), code = src(new URL('../public/' + js, import.meta.url));
  ok(`${js}: Welcome back, email over password, a filled Sign in, Forgot your password?`,
    /Welcome back/.test(code) && /placeholder="Email"/.test(code) && /placeholder="Password"/.test(code) && /class="big fill"[^>]*onclick="passwordSignIn\(\)">Sign in</.test(code) && /Forgot your password\?/.test(code));
  ok(`${js}: New here? Join the MySet family, a ringed Create account`, /class="join">New here\? Join the MySet family/.test(code) && /class="big ring"[^>]*>Create account</.test(code));
  ok(`${page}: the box is ringed pink-orange, the heading and Sign in are pink-orange`,
    /\.signbox\{[^}]*inset 0 0 0 1\.5px var\(--accent-2\)/.test(html) && /\.gate h2\{[^}]*color:var\(--accent-2\)/.test(html) && /\.big\.fill\{background:var\(--accent-2\)/.test(html));
  ok(`${js}: create and forgot both go through the six-digit code`, /gate\(null,'join'\)/.test(code) && /gate\(null,'forgot'\)/.test(code) && /action:'start'/.test(code));
  ok(`${js}: a Password row in Settings with Create / Change`, /openPasswordSheet\(\)/.test(code) && /'Change':'Create'/.test(code));
}
{
  const code = src(new URL('../public/studio.js', import.meta.url)), html = src(new URL('../public/studio.html', import.meta.url));
  ok('studio.js: the Studio code is small grey underlined text at the foot that opens a window', /class="foot"><a[^>]*openStudioCode\(\)/.test(code) && /\.gate \.foot a\{color:var\(--muted\);text-decoration:underline/.test(html) && /id="pop"/.test(html));
  ok('studio.js: the front screen no longer carries "Email me a code" as the door', !/class="big[^"]*"[^>]*onclick="sendCode\(\)">Email me a code/.test(code));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
