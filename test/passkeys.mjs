/* PASSKEYS  (_passkey.mjs, the passkey actions in auth.mjs)

   THIS TEST IS AN AUTHENTICATOR. It generates a real P-256 key pair, builds real
   authenticator data, CBOR-encodes a real attestation object and signs with the
   real algorithm — so every byte the server parses here is a byte a phone would
   actually send. That is the whole point: WebAuthn cannot otherwise be verified
   without a physical device in somebody's hand, and "we shipped it untested
   because you need a phone" is not a thing to say about a sign-in path.

   Pins, in order:
     · a good registration and a good sign-in work end to end, ES256 and RS256
     · the five checks, each defeated on purpose: wrong ceremony type, replayed
       challenge, stale challenge, wrong origin, wrong domain, bad signature
     · a challenge is spent even when the answer was wrong
     · the cloned-key counter rule, INCLUDING that a synced passkey reporting 0
       for ever is not treated as cloned
     · a passkey is added to an account that is already signed in — it can never
       create one
     · one owner's key cannot sign anybody else in */
process.env.ADMIN_CODE = 'devlocal';

const { createHash, generateKeyPairSync, createSign, randomBytes } = await import('node:crypto');
const { register, assert, newChallenge, listKeys, forget, readKeys, CHAL_TTL, MAX_KEYS,
        readAuthData, coseToKey } = await import('../netlify/functions/_passkey.mjs');
const { casDoc } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const b64u = (b) => Buffer.from(b).toString('base64url');
const sha256 = (b) => createHash('sha256').update(b).digest();

const ORIGIN = 'https://myset.vip', RPID = 'myset.vip';

/* ---- a minimal CBOR encoder, enough to be an authenticator ---- */
const cHead = (major, n) => {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  if (n < 65536) { const b = Buffer.alloc(3); b[0] = (major << 5) | 25; b.writeUInt16BE(n, 1); return b; }
  const b = Buffer.alloc(5); b[0] = (major << 5) | 26; b.writeUInt32BE(n, 1); return b;
};
const cInt = (n) => (n >= 0 ? cHead(0, n) : cHead(1, -1 - n));
const cBytes = (b) => Buffer.concat([cHead(2, b.length), b]);
const cText = (s) => Buffer.concat([cHead(3, Buffer.byteLength(s)), Buffer.from(s)]);
const cMap = (pairs) => Buffer.concat([cHead(5, pairs.length),
  ...pairs.map(([k, v]) => Buffer.concat([typeof k === 'number' ? cInt(k) : cText(k), v]))]);

/* ---- the authenticator ---- */
function makeAuthenticator({ alg = -7 } = {}) {
  const credId = randomBytes(16);
  let keys, cose, sign;
  if (alg === -7) {
    keys = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const raw = keys.publicKey.export({ format: 'der', type: 'spki' }).subarray(-65);
    cose = cMap([[1, cInt(2)], [3, cInt(-7)], [-1, cInt(1)],
                 [-2, cBytes(raw.subarray(1, 33))], [-3, cBytes(raw.subarray(33, 65))]]);
    sign = (data) => { const s = createSign('SHA256'); s.update(data); s.end(); return s.sign(keys.privateKey); };
  } else {
    keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = keys.publicKey.export({ format: 'jwk' });
    cose = cMap([[1, cInt(3)], [3, cInt(-257)],
                 [-1, cBytes(Buffer.from(jwk.n, 'base64url'))],
                 [-2, cBytes(Buffer.from(jwk.e, 'base64url'))]]);
    sign = (data) => { const s = createSign('SHA256'); s.update(data); s.end(); return s.sign(keys.privateKey); };
  }
  const authData = ({ rpId = RPID, up = true, at = false, count = 0 }) => {
    const head = Buffer.concat([sha256(Buffer.from(rpId)),
      Buffer.from([(up ? 0x01 : 0) | 0x04 | (at ? 0x40 : 0)]), Buffer.alloc(4)]);
    head.writeUInt32BE(count, 33);
    if (!at) return head;
    const len = Buffer.alloc(2); len.writeUInt16BE(credId.length, 0);
    return Buffer.concat([head, Buffer.alloc(16), len, credId, cose]);
  };
  const clientData = (type, challenge, origin = ORIGIN) =>
    Buffer.from(JSON.stringify({ type, challenge, origin, crossOrigin: false }));

  return {
    credId,
    create(challenge, o = {}) {
      const ad = authData({ at: true, ...o });
      const cd = clientData('webauthn.create', challenge, o.origin);
      return { id: b64u(credId), clientDataJSON: b64u(cd),
               attestationObject: b64u(cMap([['fmt', cText('none')], ['attStmt', cMap([])], ['authData', cBytes(ad)]])) };
    },
    get(challenge, o = {}) {
      const ad = authData({ up: true, count: 0, ...o });
      const cd = clientData(o.type || 'webauthn.get', challenge, o.origin);
      return { id: b64u(o.credId || credId), clientDataJSON: b64u(cd),
               authenticatorData: b64u(ad),
               signature: b64u(o.badSig ? randomBytes(64) : sign(Buffer.concat([ad, sha256(cd)]))) };
    },
  };
}
const WHERE = { origin: ORIGIN, rpId: RPID };

console.log('\nEND TO END, THE WAY A PHONE DOES IT');
const OWNER = 'perry-test';
const A = makeAuthenticator();
{
  const ch = await newChallenge(OWNER, 'create');
  const r = await register(OWNER, { ...A.create(ch), label: 'Perry’s iPhone' }, WHERE);
  ok('a passkey registers', r.ok, r);
  ok('and shows up with the name the person gave it',
    (await listKeys(OWNER))[0].label === 'Perry’s iPhone');

  const ch2 = await newChallenge(OWNER, 'get');
  const s = await assert(OWNER, A.get(ch2), WHERE);
  ok('and signs them in', s.ok, s);
}

console.log('\nRS256 TOO — not every authenticator is an elliptic curve');
{
  const R = makeAuthenticator({ alg: -257 });
  const ch = await newChallenge('rsa-owner', 'create');
  ok('an RSA passkey registers', (await register('rsa-owner', R.create(ch), WHERE)).ok);
  const ch2 = await newChallenge('rsa-owner', 'get');
  ok('and signs in', (await assert('rsa-owner', R.get(ch2), WHERE)).ok);
}

console.log('\nTHE FIVE CHECKS, EACH DEFEATED ON PURPOSE');
{
  const ch = await newChallenge(OWNER, 'get');
  const r = await assert(OWNER, A.get(ch, { origin: 'https://myset.vip.evil.com' }), WHERE);
  ok('1. a phishing site’s origin is refused', !r.ok && /this site/.test(r.error), r);

  const ch2 = await newChallenge(OWNER, 'get');
  const r2 = await assert(OWNER, A.get(ch2, { rpId: 'evil.com' }), WHERE);
  ok('2. a key minted for another domain is refused', !r2.ok, r2);

  const ch3 = await newChallenge(OWNER, 'get');
  const r3 = await assert(OWNER, A.get(ch3, { badSig: true }), WHERE);
  ok('3. a bad signature is refused', !r3.ok && /check out/.test(r3.error), r3);

  const ch4 = await newChallenge(OWNER, 'get');
  const good = A.get(ch4);
  ok('4a. the first use works', (await assert(OWNER, good, WHERE)).ok);
  const replay = await assert(OWNER, good, WHERE);
  ok('4b. THE REPLAY: the very same assertion a second time is refused',
    !replay.ok && /too long/.test(replay.error), replay);

  const ch5 = await newChallenge(OWNER, 'get');
  const r5 = await assert(OWNER, A.get(ch5, { type: 'webauthn.create' }), WHERE);
  ok('5. a registration ceremony replayed as a sign-in is refused', !r5.ok, r5);

  /* And the subtle one: a WRONG answer must still burn the challenge, or an
     attacker gets unlimited attempts against a live nonce. */
  const ch6 = await newChallenge(OWNER, 'get');
  await assert(OWNER, A.get(ch6, { badSig: true }), WHERE);
  const after = await assert(OWNER, A.get(ch6), WHERE);
  ok('a challenge is spent even when the answer was wrong', !after.ok, after);

  const ch7 = await newChallenge(OWNER, 'get');
  const shaped = A.get(ch7);
  await casDoc(`pkeys_${OWNER}`, () => ({ v: 1, keys: [], chal: null }),
    (d) => { d.chal.at = Date.now() - CHAL_TTL - 1000; return true; });
  ok('a challenge older than five minutes is refused', !(await assert(OWNER, shaped, WHERE)).ok);
}

console.log('\nTHE CLONED-KEY COUNTER');
{
  const C = makeAuthenticator();
  const ch = await newChallenge('counter-owner', 'create');
  await register('counter-owner', C.create(ch, { count: 5 }), WHERE);

  let c2 = await newChallenge('counter-owner', 'get');
  ok('a counter that moves forward is fine',
    (await assert('counter-owner', C.get(c2, { count: 9 }), WHERE)).ok);

  c2 = await newChallenge('counter-owner', 'get');
  const back = await assert('counter-owner', C.get(c2, { count: 6 }), WHERE);
  ok('a counter that goes BACKWARDS is refused as a copy', !back.ok && /copied/.test(back.error), back);

  /* The one that matters more, because it is the common case: an iCloud or Google
     passkey reports 0 for ever. Treating "not greater" as cloned would lock out
     exactly the devices this whole feature exists for. */
  const S = makeAuthenticator();
  const c3 = await newChallenge('synced-owner', 'create');
  await register('synced-owner', S.create(c3, { count: 0 }), WHERE);
  let good = true;
  for (let i = 0; i < 3; i++) {
    const c = await newChallenge('synced-owner', 'get');
    if (!(await assert('synced-owner', S.get(c, { count: 0 }), WHERE)).ok) good = false;
  }
  ok('a synced passkey reporting 0 every time is NOT treated as cloned', good);
}

console.log('\nWHOSE KEY IS WHOSE');
{
  const B = makeAuthenticator();
  const ch = await newChallenge('other-owner', 'create');
  await register('other-owner', B.create(ch), WHERE);
  const c2 = await newChallenge(OWNER, 'get');
  const r = await assert(OWNER, B.get(c2), WHERE);
  ok('another account’s passkey cannot sign this one in',
    !r.ok && /isn.t registered/.test(r.error), r);
}

console.log('\nHOUSEKEEPING');
{
  ok('the same key registered twice is not stored twice', await (async () => {
    const ch = await newChallenge(OWNER, 'create');
    await register(OWNER, A.create(ch), WHERE);
    return (await readKeys(OWNER)).keys.filter((k) => k.id === Buffer.from(A.credId).toString('base64url')).length === 1;
  })());

  let added = 0;
  for (let i = 0; i < MAX_KEYS + 2; i++) {
    const K = makeAuthenticator();
    const ch = await newChallenge('full-owner', 'create');
    if ((await register('full-owner', K.create(ch), WHERE)).ok) added++;
  }
  ok(`no more than ${MAX_KEYS} devices`, added === MAX_KEYS, added);

  const id = (await listKeys(OWNER))[0].id;
  ok('a key can be forgotten', (await forget(OWNER, id)).ok);
  ok('and forgetting it twice says so rather than pretending', !(await forget(OWNER, id)).ok);
  ok('the list never leaks the public key itself',
    !Object.keys((await listKeys('rsa-owner'))[0]).includes('pub'));
}

console.log('\nTHROUGH THE REAL DOOR (auth.mjs)');
{
  const authFn = (await import('../netlify/functions/auth.mjs')).default;
  const { createArtist, signToken, readArtists, revOf, mutateArtists } =
    await import('../netlify/functions/_auth.mjs');
  const P = await createArtist({ email: 'pk@example.com', name: 'Passkey Perry' });
  const aid = P.artistId, slug = P.slug;
  const tok = await signToken('pk@example.com', revOf(await readArtists(), aid));
  const call = (body, t) => authFn(new Request('https://myset.vip/api/auth', { method: 'POST',
    headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify(body) }));
  const j = async (r) => { try { return await r.json(); } catch { return {}; } };

  const start = await j(await call({ action: 'passkeyStart' }, tok));
  ok('the Studio gets options to hand the phone', start.ok && !!start.challenge && start.rpId === 'myset.vip', start);
  ok('the user handle is the artist id, never an email',
    Buffer.from(start.userId, 'base64url').toString() === aid);

  const D = makeAuthenticator();
  const fin = await j(await call({ action: 'passkeyFinish', ...D.create(start.challenge), label: 'iPhone 17' }, tok));
  ok('and the key registers through the endpoint', fin.ok && (fin.keys || []).length === 1, fin);

  const s1 = await j(await call({ action: 'passkeySignInStart', slug }));
  ok('the public door hands out a challenge and the key ids', s1.ok && s1.keys.length === 1, s1);
  const s2r = await call({ action: 'passkeySignInFinish', slug, ...D.get(s1.challenge) });
  const s2 = await j(s2r);
  ok('and a signature signs you in with a real token', s2r.status === 200 && !!s2.token, s2);

  const unknown = await j(await call({ action: 'passkeySignInStart', slug: 'nobody-at-all' }));
  ok('an unknown page answers exactly like a page with no passkey',
    unknown.ok && Array.isArray(unknown.keys) && unknown.keys.length === 0 && !!unknown.challenge, unknown);

  await mutateArtists((reg) => { reg.byEmail['mate@example.com'] = { artistId: aid, role: 'member' }; return true; });
  const mtok = await signToken('mate@example.com', revOf(await readArtists(), aid));
  ok('a band mate cannot add a passkey to the owner’s account',
    (await call({ action: 'passkeyStart' }, mtok)).status === 403);

  const bad2 = await call({ action: 'passkeySignInFinish', slug, ...D.get('not-a-real-challenge') });
  ok('a made-up challenge is refused', bad2.status === 401);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
