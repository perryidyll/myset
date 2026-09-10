/* THE ACCOUNT SYSTEM — sessions, roles, recovery, changing your address, and
   leaving with thirty days to change your mind.

   Everything here was missing before 2026-09-05, and two of the gaps were holes
   rather than absences:

     · ANY MEMBER COULD TAKE THE ACCOUNT. `add`/`remove`/`revokeAll`/`setSlug` in
       auth.mjs ran on "are you signed in" alone, and `verifyToken` has always
       returned the role. A band mate on a five-seat Pro page could delete the
       owner's sign-in address, or rename the public page that every printed QR
       code points at. The venue side had the identical hole, plus a `staff` role
       that nothing read.
     · SIGNING OUT DID NOT SIGN YOU OUT. It cleared localStorage; the token stayed
       valid for the rest of its thirty days.

   Pins, in order: a token carries a session id and one device can be signed out;
   a member is refused everything that touches access or money; a recovery code
   works once and takes every other device with it; moving your address needs a
   code from BOTH inboxes; delete keeps everything for thirty days and undoes. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
const nativeFetch = globalThis.fetch;
globalThis.fetch = (url, opts) => String(url).startsWith('https://api.resend.com/')
  ? Promise.resolve(new Response('{}', { status: 202 }))
  : nativeFetch(url, opts);

const authFn  = (await import('../netlify/functions/auth.mjs')).default;
const admin   = (await import('../netlify/functions/admin.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const vauthFn = (await import('../netlify/functions/venueauth.mjs')).default;
const vadmin  = (await import('../netlify/functions/venueadmin.mjs')).default;
const { createArtist, readArtists, mutateArtists, signToken, revOf } = await import('../netlify/functions/_auth.mjs');
const { createVenue, signVenueToken, readVenues, vRevOf } = await import('../netlify/functions/_venues.mjs');
const { makeRecovery, can, newSid, addSession } = await import('../netlify/functions/_session.mjs');
const { publicArtist, readDoc } = await import('../netlify/functions/_lib.mjs');
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
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const A = (body, token) => hit(authFn, 'https://x/api/auth', body, token);
const S = (body, token) => hit(admin, 'https://x/api/admin', body, token);

console.log('\nSETUP  an artist with a real session, minted through the front door');
await createArtist({ email: 'rita@example.com', name: 'Rita Vance', slug: 'rita' });
let reg = await readArtists();
const rita = reg.byEmail['rita@example.com'].artistId;
// a session with a sid, exactly as the sign-in doors mint one
const sid1 = newSid();
await addSession(rita, { sid: sid1, email: 'rita@example.com', label: 'iPhone · Safari', at: Date.now() });
let T1 = await signToken('rita@example.com', revOf(reg, rita), sid1);
ok('she is signed in', (await S({ action: 'planGet' }, T1)).ok);

console.log('\nONE DEVICE, SIGNED OUT  (and not the whole band)');
const sid2 = newSid();
await addSession(rita, { sid: sid2, email: 'rita@example.com', label: 'Mac · Chrome', at: Date.now() });
const T2 = await signToken('rita@example.com', revOf(reg, rita), sid2);
ok('both phones work', (await S({ action: 'planGet' }, T1)).ok && (await S({ action: 'planGet' }, T2)).ok);
let r = await A({ action: 'sessions' }, T1);
eq('the list has both, and knows which one is asking', r.list.map((x) => x.current), [false, true]);
r = await A({ action: 'sessionRevoke', sid: sid2 }, T1);
ok('one is signed out', r.ok);
eq('THE BUG: and its token really stops working', (await S({ action: 'planGet' }, T2)).status, 401);
ok('while this phone carries on', (await S({ action: 'planGet' }, T1)).ok);
eq('and the list is down to one', (await A({ action: 'sessions' }, T1)).list.length, 1);

console.log('\nSIGN OUT means the server hears about it');
r = await A({ action: 'signOut' }, T1);
ok('signed out', r.ok);
eq('THE BUG: the token is dead, not just forgotten', (await S({ action: 'planGet' }, T1)).status, 401);

console.log('\nA MEMBER IS NOT AN OWNER');
// five seats are a Pro thing; free and Plus hold one, so put her on Pro first
await mutateArtists((a) => { a.byId[rita].plan = 'pro'; a.byId[rita].planUntil = Date.now() + 30 * 86400e3; return true; });
reg = await readArtists();
T1 = await signToken('rita@example.com', revOf(reg, rita), newSid());
ok('the owner adds a band mate', (await A({ action: 'add', email: 'bass@example.com', role: 'member' }, T1)).ok);
reg = await readArtists();
const TM = await signToken('bass@example.com', revOf(reg, rita), newSid());
ok('who can sign in', (await S({ action: 'planGet' }, TM)).ok);
eq('THE BUG: but cannot delete the owner’s address', (await A({ action: 'remove', email: 'rita@example.com' }, TM)).status, 403);
eq('THE BUG: cannot rename the page every QR code points at', (await A({ action: 'setSlug', slug: 'stolen' }, TM)).status, 403);
eq('cannot sign the owner out', (await A({ action: 'revokeAll' }, TM)).status, 403);
eq('cannot open the owner’s Stripe portal', (await S({ action: 'planPortal' }, TM)).status, 403);
eq('cannot change the plan', (await S({ action: 'planChange', plan: 'free' }, TM)).status, 403);
eq('cannot delete the account', (await S({ action: 'accountDelete', confirm: 'DELETE' }, TM)).status, 403);
eq('and cannot start a payout account in the wrong country', (await S({ action: 'payStart', country: 'US' }, TM)).status, 403);
ok('but can still work the show', (await S({ action: 'addSong', title: 'Wires', artist: 'R' }, TM)).ok);
r = await S({ action: 'planGet' }, TM);
ok('a member gets the plan limits, so nothing renders falsely unlocked', !!r.limits);
ok('and none of the billing detail', !(r.billing || {}).portal && !r.until);

console.log('\nCREW  tonight only');
ok('the owner adds a sound engineer', (await A({ action: 'add', email: 'sound@example.com', role: 'crew' }, T1)).ok);
reg = await readArtists();
const TC = await signToken('sound@example.com', revOf(reg, rita), newSid());
ok('crew can run the show', (await S({ action: 'status', status: 'live' }, TC)).ok);
eq('crew cannot rewrite the library', (await S({ action: 'addSong', title: 'No', artist: 'X' }, TC)).status, 403);
eq('crew cannot touch the profile', (await S({ action: 'profileSave', profile: { bio: 'x' } }, TC)).status, 403);
ok('an unknown role falls back to the least it could be, never the most',
   can('owner', 'library') && !can('crew', 'library') && !can('made-up-role', 'library'));
/* `CAN['toString']` is an inherited Function: truthy, with no `.has`, so the
   first version of this threw a TypeError on a role string that could arrive
   from stored data. It must fall back to crew, not explode and not open up. */
ok('and a role name that is a JavaScript builtin falls back to crew rather than crashing',
   can('toString', 'show') === true && can('toString', 'library') === false);

console.log('\nRECOVERY CODES  the way back when the inbox is gone');
const codes = await makeRecovery(rita);
eq('eight of them', codes.length, 8);
eq('a wrong one is refused', (await A({ action: 'recoverySignIn', slug: 'rita', code: 'AAAA-BBBB' })).status, 401);
eq('an unknown page looks exactly the same', (await A({ action: 'recoverySignIn', slug: 'nobody', code: codes[0] })).status, 401);
r = await A({ action: 'recoverySignIn', slug: 'rita', code: codes[0] });
ok('a real one signs you in', r.ok && !!r.token, r);
eq('and says how many are left', r.left, 7);
eq('the same code never works twice', (await A({ action: 'recoverySignIn', slug: 'rita', code: codes[0] })).status, 401);
eq('THE POINT: every other device was signed out', (await S({ action: 'planGet' }, TM)).status, 401);
const TR = r.token;
ok('and the one that used it is in', (await S({ action: 'planGet' }, TR)).ok);

console.log('\nMOVING YOUR SIGN-IN ADDRESS  needs BOTH inboxes');
const { __codes } = await import('./hooks.mjs').catch(() => ({}));
r = await A({ action: 'emailChangeStart', email: 'rita@newmail.com' }, TR);
ok('both codes go out', r.ok, r);
const { checkCode } = await import('../netlify/functions/_auth.mjs');
// read the two codes straight out of the store, the way a person reads their inbox
const codeFor = async (email, realm) => {
  const { createHash } = await import('node:crypto');
  const k = `authc_${realm}_${createHash('sha256').update(email).digest('hex').slice(0, 32)}`;
  const d = (await readDoc(k, null)).data;
  return d && d.hash ? d : null;
};
ok('a code is waiting at the new address', !!(await codeFor('rita@newmail.com', `c-${rita}`)));
ok('and one at the old address', !!(await codeFor('rita@example.com', `o-${rita}`)));
eq('the new address alone is not enough',
   (await A({ action: 'emailChangeFinish', email: 'rita@newmail.com', newCode: '000000', proof: '000000' }, TR)).status, 401);
/* Brute-force the six digits the way the test can and an attacker cannot: the
   real door burns the code after five wrong guesses. */
const guess = async (email, realm) => {
  for (let i = 0; i < 1000000; i++) {
    const c = String(i).padStart(6, '0');
    const d = (await readDoc(`authc_${realm}_${(await import('node:crypto')).createHash('sha256').update(email).digest('hex').slice(0, 32)}`, null)).data;
    if (!d) return null;
    const { createHmac } = await import('node:crypto');
    const { authSecret } = await import('../netlify/functions/_auth.mjs');
    if (createHmac('sha256', await authSecret()).update(c).digest('hex') === d.hash) return c;
  }
  return null;
};
const cNew = await guess('rita@newmail.com', `c-${rita}`);
const cOld = await guess('rita@example.com', `o-${rita}`);
r = await A({ action: 'emailChangeFinish', email: 'rita@newmail.com', newCode: cNew, proof: cOld }, TR);
ok('with both, it moves', r.ok && r.email === 'rita@newmail.com', r);
reg = await readArtists();
ok('the registry moved with it', !!reg.byEmail['rita@newmail.com'] && !reg.byEmail['rita@example.com']);
eq('and the role travelled', reg.byEmail['rita@newmail.com'].role, 'owner');
ok('the old device is out, the new token is in', (await S({ action: 'planGet' }, r.token)).ok);
eq('and one change a day', (await A({ action: 'emailChangeStart', email: 'other@x.com' }, r.token)).status, 400);
const TN = r.token;

console.log('\nA RENAMED PAGE KEEPS ANSWERING AT ITS OLD ADDRESS');
ok('she renames it', (await A({ action: 'setSlug', slug: 'ritavance' }, TN)).ok);
eq('the new one resolves', await publicArtist(new Request('https://x/api/show?a=ritavance')), rita);
eq('THE POINT: and so does every QR code already printed',
   await publicArtist(new Request('https://x/api/show?a=rita')), rita);

console.log('\nLEAVING  two screens, then thirty days');
eq('one confirmation is not enough', (await S({ action: 'accountDelete', confirm: 'yes' }, TN)).status, 400);
r = await S({ action: 'accountDelete', confirm: 'DELETE' }, TN);
ok('the clock starts', r.ok && r.purgeAt > Date.now() + 29 * 86400e3, r);
eq('the page goes dark today', await publicArtist(new Request('https://x/api/show?a=ritavance')), null);
ok('everything is still on disk', !!(await readDoc('show_' + rita, null)).data);
ok('she can still sign in', (await S({ action: 'planGet' }, TN)).ok);
eq('but the page is read-only', (await S({ action: 'addSong', title: 'x', artist: 'y' }, TN)).status, 423);
ok('and she can still take her data', (await S({ action: 'accountExport' }, TN)).ok);
ok('undo brings it back', (await S({ action: 'accountUndelete' }, TN)).ok);
eq('page and all', await publicArtist(new Request('https://x/api/show?a=ritavance')), rita);
ok('and she can work again', (await S({ action: 'addSong', title: 'Back', artist: 'R' }, TN)).ok);

console.log('\nTHE VENUE SIDE HAD THE IDENTICAL HOLE');
const bar = await createVenue({ email: 'boss@bar.com', name: 'The Corner Bar', city: 'Koh Phangan', country: 'Thailand' });
let vreg = await readVenues();
const TVO = await signVenueToken('boss@bar.com', vRevOf(vreg, bar.venueId), newSid());
ok('the owner adds a barman', (await hit(vauthFn, 'https://x/api/venueauth', { action: 'add', email: 'barman@bar.com', role: 'crew' }, TVO)).ok);
vreg = await readVenues();
const TVC = await signVenueToken('barman@bar.com', vRevOf(vreg, bar.venueId), newSid());
ok('the barman can see tonight', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'get' }, TVC)).ok);
eq('THE BUG: but cannot rename the venue page', (await hit(vauthFn, 'https://x/api/venueauth', { action: 'setSlug', slug: 'taken' }, TVC)).status, 403);
eq('THE BUG: cannot link the payout account', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'payStart', country: 'US' }, TVC)).status, 403);
eq('cannot change the plan', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'planChange', plan: 'free' }, TVC)).status, 403);
eq('cannot sign the owner out', (await hit(vauthFn, 'https://x/api/venueauth', { action: 'revokeAll' }, TVC)).status, 403);
eq('and cannot delete the page', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountDelete', confirm: 'DELETE' }, TVC)).status, 403);
ok('a venue can finally take its data with it', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountExport' }, TVO)).ok);
r = await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountDelete', confirm: 'DELETE' }, TVO);
ok('and finally leave', r.ok && r.purgeAt > Date.now() + 29 * 86400e3, r);
const { venueBySlug } = await import('../netlify/functions/_venues.mjs');
eq('its page goes dark the same day', await venueBySlug((await readVenues()).byId[bar.venueId].slug), null);
ok('and undo brings it back', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountUndelete' }, TVO)).ok);

console.log('\nA PIPE IN AN EMAIL CANNOT MOVE THE FIELDS OF A TOKEN');
const { normEmail, verifyToken } = await import('../netlify/functions/_auth.mjs');
eq('the pipe is stripped on the way in', normEmail('a|b@x.com'), 'ab@x.com');
eq('and a venue token is not an artist token', await verifyToken(TVO), null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
