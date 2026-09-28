/* THE SIGNING KEY LEAVES THE STORE (decision 0112).

   Until 2026-09-28 the only key that signed a session lived in Blobs beside the
   sessions it signed. With `MYSET_SECRET` set, the key is cut from that variable
   instead, and the store-kept key becomes a legacy key that verifies for thirty-one
   days and signs nothing. These are the properties that make the move safe to ship
   to a platform with people signed in, and a later rotation safe to run:

     · nothing set — exactly the old behaviour, the store key is made and used
     · the variable set — a token, a ticket, a six-digit code, a venue token and an
       HQ unlock made under the store key still work (nobody is signed out), new
       ones are made with the new key, the switch is dated
     · past the window — the store key verifies nothing; the new key still does
     · recovery codes are a slow salted hash that depends on no key: a set made
       before the switch, after it, or before a rotation still works afterwards,
       and a set made the OLD way (an HMAC under the store key) works for ever
     · a rotation signs every device out once — the previous value never verifies
     · a short value is ignored, never used as a key
     · a fresh store with the variable set never makes a store key */
import { createHmac } from 'node:crypto';
process.env.ADMIN_CODE = 'devlocal';
delete process.env.MYSET_SECRET;
delete process.env.MYSET_SECRET_PREVIOUS;

const { createArtist, signToken, verifyToken, readArtists, revOf, signTicket, readTicket,
        issueCode, checkCode, signingKeys, authSecret, storeKey, LEGACY_MS, __resetSecret } = await import('../netlify/functions/_auth.mjs');
const { makeRecovery, useRecovery, recoveryStatus, REC } = await import('../netlify/functions/_session.mjs');
const { createVenue, signVenueToken, verifyVenueToken, readVenues, vRevOf } = await import('../netlify/functions/_venues.mjs');
const { keysFor, configured, MIN_LENGTH } = await import('../netlify/functions/_secret.mjs');
const { hashPasscode, unlockCookie, unlocked } = await import('../netlify/functions/_hqlock.mjs');
const { readDoc, casDoc } = await import('../netlify/functions/_lib.mjs');
const { __resetRing } = await import('../netlify/functions/_seal.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const NEW = 'a'.repeat(24) + 'b'.repeat(24);          // 48 characters, well past MIN_LENGTH
const NEWER = 'c'.repeat(64);
const flip = () => { __resetSecret(); __resetRing(); };
const macOf = (key, token) => createHmac('sha256', key).update(Buffer.from(token.split('.')[0], 'base64url')).digest('base64url');
const HQ_ENV = { HQ_PASSCODE: await hashPasscode('a hq passcode') };
const hqReq = (header) => new Request('https://myset.vip/api/hq', { headers: { cookie: header.split(';')[0] } });

console.log('\nNOTHING SET  the store key is made and signs, as it always did');
eq('no MYSET_SECRET means not configured', configured(), false);
eq('…and no env keys', keysFor('auth'), null);
const rita = await createArtist({ email: 'rita@example.com', name: 'Rita Vance', slug: 'rita' });
const rev = revOf(await readArtists(), rita.artistId);
const oldToken = await signToken('rita@example.com', rev, 'dev1');
ok('a token signed under the store key verifies', !!(await verifyToken(oldToken)));
const storeDoc = (await readDoc('authsecret', null)).data;
ok('the store key exists and is what signed it', storeDoc && storeDoc.k && oldToken.endsWith('.' + macOf(storeDoc.k, oldToken)));
eq('nothing has been retired', storeDoc.retiredAt, undefined);
const oldTicket = await signTicket('rita@example.com');
const oldCode = await issueCode('rita@example.com', null, 'x');
const venue = await createVenue({ email: 'bar@example.com', name: 'The Anchor', slug: 'anchor' });
const oldVenueToken = await signVenueToken('bar@example.com', vRevOf(await readVenues(), venue.venueId), 'v1');
ok('a venue token signed under the store key verifies', !!(await verifyVenueToken(oldVenueToken)));
const oldHq = await unlockCookie(rita.artistId, { env: HQ_ENV });
ok('an HQ unlock made under the store key opens HQ', await unlocked(hqReq(oldHq.header), rita.artistId, { env: HQ_ENV }));
/* A recovery set made the OLD way — an HMAC of each code under the store key, which
   is what every set on production is today. Written as that code wrote it. */
const LEGACY = ['ABCD-EFGH', 'JKMN-PQRS', 'TVWX-YZ23'];
const norm = (c) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
const VOWNER = `v_${venue.venueId}`;
await casDoc(REC(VOWNER), () => ({}), (d) => {
  d.v = 1; d.madeAt = Date.now(); d.codes = LEGACY.map((c) => ({ h: createHmac('sha256', storeDoc.k).update(norm(c)).digest('hex'), usedAt: 0 }));
  return true;
});
ok('a recovery code made the old way works', await useRecovery(VOWNER, LEGACY[0]));
ok('…once', !(await useRecovery(VOWNER, LEGACY[0])));
const recovery = await makeRecovery(rita.artistId);
const recDoc = (await readDoc(REC(rita.artistId), null)).data;
ok('a set made now is the slow salted form, with no key in it', recDoc.alg === 's1' && /^[\w-]{20,}$/.test(recDoc.salt) && recDoc.codes.every((c) => /^[0-9a-f]{64}$/.test(c.h)), recDoc);
ok('…and is not an HMAC under the store key', recDoc.codes[0].h !== createHmac('sha256', storeDoc.k).update(norm(recovery[0])).digest('hex'));
ok('a new-form code works', await useRecovery(rita.artistId, recovery[0]));
ok('…once', !(await useRecovery(rita.artistId, recovery[0])));
ok('…lower case and without the dash too', await useRecovery(rita.artistId, recovery[1].toLowerCase().replace('-', '')));
ok('a code that was never made does not', !(await useRecovery(rita.artistId, 'ZZZZ-ZZZZ')));
eq('the Studio sees what is left', (await recoveryStatus(rita.artistId)).left, 6);

console.log('\nTHE VARIABLE IS SET  nobody is signed out, and the store key signs nothing new');
process.env.MYSET_SECRET = NEW;
flip();
eq('configured', configured(), true);
ok('the old token still verifies', !!(await verifyToken(oldToken)));
ok('the old ticket still reads', (await readTicket(oldTicket)) === 'rita@example.com');
ok('the old venue token still verifies', !!(await verifyVenueToken(oldVenueToken)));
ok('HQ stays open in the browser that opened it', await unlocked(hqReq(oldHq.header), rita.artistId, { env: HQ_ENV }));
const after = (await readDoc('authsecret', null)).data;
ok('the switch was dated on the store key\'s own document', after && Number(after.retiredAt) > Date.now() - 60e3, after);
const newToken = await signToken('rita@example.com', rev, 'dev2');
ok('a new token verifies', !!(await verifyToken(newToken)));
ok('…and was NOT signed with the store key', !newToken.endsWith('.' + macOf(after.k, newToken)));
ok('…but with the key cut from the variable', newToken.endsWith('.' + macOf(keysFor('auth').sign, newToken)));
ok('authSecret() is the signing key', Buffer.isBuffer(await authSecret()) && (await authSecret()).equals(keysFor('auth').sign));
eq('short-lived things verify against two keys: the new and the legacy', (await signingKeys()).verify.length, 2);
ok('the six-digit code issued under the store key is redeemable', (await checkCode('rita@example.com', oldCode, 'x')).ok);
ok('a recovery code made the old way still works', await useRecovery(VOWNER, LEGACY[1]));
ok('a new-form code made before the switch still works', await useRecovery(rita.artistId, recovery[2]));
const newCode = await issueCode('rita@example.com', null, 'y');
ok('a code issued now is redeemable', (await checkCode('rita@example.com', newCode, 'y')).ok);
const newVenueToken = await signVenueToken('bar@example.com', vRevOf(await readVenues(), venue.venueId), 'v2');
ok('a new venue token verifies', !!(await verifyVenueToken(newVenueToken)));
const newHq = await unlockCookie(rita.artistId, { env: HQ_ENV });
ok('a new HQ unlock opens HQ', await unlocked(hqReq(newHq.header), rita.artistId, { env: HQ_ENV }));
ok('the store key is still there for the codes on paper', (await storeKey()) === after.k);

console.log('\nTHIRTY-ONE DAYS LATER  the store key can mint nothing, even if it leaks');
await casDoc('authsecret', () => ({}), (d) => { d.retiredAt = Date.now() - LEGACY_MS - 1000; return true; });
flip();
ok('the old token is refused', !(await verifyToken(oldToken)));
ok('the old venue token is refused', !(await verifyVenueToken(oldVenueToken)));
ok('the old ticket is refused', !(await readTicket(oldTicket)));
ok('an HQ unlock made under the store key is refused', !(await unlocked(hqReq(oldHq.header), rita.artistId, { env: HQ_ENV })));
ok('the new token still verifies', !!(await verifyToken(newToken)));
ok('the new venue token still verifies', !!(await verifyVenueToken(newVenueToken)));
const forged = (() => {
  const b = `rita@example.com|${Date.now() + 86400e3}|${rev}|evil`;
  return `${Buffer.from(b).toString('base64url')}.${createHmac('sha256', after.k).update(b).digest('base64url')}`;
})();
ok('a token minted with the leaked store key is refused', !(await verifyToken(forged)));
ok('a recovery code made the old way STILL works — a code on paper has no window', await useRecovery(VOWNER, LEGACY[2]));
eq('verify is the new key alone', (await signingKeys()).verify.length, 1);

console.log('\nA ROTATION  every device signs in again once; no code on paper is stranded');
const beforeRotation = await makeRecovery(rita.artistId);
process.env.MYSET_SECRET_PREVIOUS = NEW;
process.env.MYSET_SECRET = NEWER;
flip();
ok('a token signed under the previous value is refused — a rotation after a leak must cut the leaked key off at once', !(await verifyToken(newToken)));
ok('…and a venue token too', !(await verifyVenueToken(newVenueToken)));
const newest = await signToken('rita@example.com', rev, 'dev3');
ok('a token signed now verifies', !!(await verifyToken(newest)));
ok('…with the newest key', newest.endsWith('.' + macOf(keysFor('auth').sign, newest)));
ok('a recovery code made before the rotation works', await useRecovery(rita.artistId, beforeRotation[0]));
delete process.env.MYSET_SECRET_PREVIOUS;
flip();
ok('the previous value removed: that code set still works — it never depended on a key', await useRecovery(rita.artistId, beforeRotation[1]));
ok('…and the newest token still verifies', !!(await verifyToken(newest)));

console.log('\nA SHORT VALUE IS IGNORED');
process.env.MYSET_SECRET = 'too-short';
flip();
eq('not configured', configured(), false);
eq('no env keys', keysFor('auth'), null);
ok('at least ' + MIN_LENGTH + ' characters are required', MIN_LENGTH >= 32);
ok('the store key signs again (the old, once-legacy token verifies under it)', !!(await verifyToken(oldToken)));

console.log('\nA FRESH STORE WITH THE VARIABLE SET  never makes a store key');
const { __reset } = await import('./blobs-fake.mjs');
__reset();
process.env.MYSET_SECRET = NEW;
flip();
await createArtist({ email: 'kai@example.com', name: 'Kai', slug: 'kai' });
const t = await signToken('kai@example.com', revOf(await readArtists(), 'kai'), 'k1');
ok('a token signs and verifies', !!(await verifyToken(t)));
const kaiRec = await makeRecovery('kai');
ok('recovery codes work', await useRecovery('kai', kaiRec[5]));
const G = await import('../netlify/functions/_gmail.mjs');
const box = await G.encrypt('a refresh token');
ok('HQ\'s Gmail token seals under the keyring (v2), not a store key', box.startsWith('v2.') && (await G.decrypt(box)) === 'a refresh token', box.slice(0, 12));
eq('and no authsecret document was written', (await readDoc('authsecret', null)).data, null);
eq('one key to verify against', (await signingKeys()).verify.length, 1);

delete process.env.MYSET_SECRET;
flip();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
