/* WEB PUSH, checked against the spec's own worked example.

   This file is the entire reason it was acceptable to hand-write the crypto
   instead of taking a dependency. RFC 8291 §5 publishes a complete test vector —
   plaintext, both keypairs, the auth secret, the salt, and the exact bytes that
   must come out. If this reproduces them, the key derivation, the info strings,
   the nonce, the record framing and the AEAD are all correct. If someone changes
   _push.mjs and this fails, they broke it. */
import { encryptPayload, vapidHeaders, generateVapidKeys } from '../netlify/functions/_push.mjs';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  if (String(got) === String(want)) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, `\n      got  ${got}\n      want ${want}`); }
};
const ok = (name, c, d) => { if (c) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, d === undefined ? '' : '\n      ' + JSON.stringify(d)); } };
const u = (s) => Buffer.from(s, 'base64url');

console.log('\nRFC 8291 §5 — the published test vector');

/* Verbatim from the RFC. Do not "tidy" these. */
const PLAINTEXT   = u('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24').toString();
const AUTH        = u('BTBZMqHH6r4Tts7J_aSIgg');
const UA_PUBLIC   = u('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4');
const AS_PRIVATE  = u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw');
const AS_PUBLIC   = u('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8');
const SALT        = u('DGv6ra1nlYgDCS1FRnbzlw');
const EXPECTED    = 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN';

eq('the plaintext decodes to the RFC’s sentence', PLAINTEXT,
   'When I grow up, I want to be a watermelon');

const body = encryptPayload(PLAINTEXT, UA_PUBLIC, AUTH,
  { salt: SALT, asPrivate: AS_PRIVATE, asPublic: AS_PUBLIC });

eq('THE VECTOR: byte-for-byte match with RFC 8291 §5', body.toString('base64url'), EXPECTED);

/* The header is framed per RFC 8188: salt(16) || rs(4) || idlen(1) || keyid */
eq('header carries the salt', body.subarray(0, 16).toString('base64url'), SALT.toString('base64url'));
eq('record size is 4096', body.readUInt32BE(16), 4096);
eq('key id length is 65 (uncompressed P-256)', body[20], 65);
eq('key id is the sender public key', body.subarray(21, 86).toString('base64url'),
   AS_PUBLIC.toString('base64url'));

console.log('\nEVERY MESSAGE IS DIFFERENT');
const a = encryptPayload('hello', UA_PUBLIC, AUTH);
const b = encryptPayload('hello', UA_PUBLIC, AUTH);
ok('a fresh salt and key each time, so two identical messages differ',
   a.toString('base64url') !== b.toString('base64url'));
ok('and both are longer than their header', a.length > 86 && b.length > 86, [a.length, b.length]);

console.log('\nVAPID (RFC 8292)');
const keys = generateVapidKeys();
eq('public key is an uncompressed P-256 point (65 bytes)', u(keys.publicKey).length, 65);
eq('and starts with 0x04', u(keys.publicKey)[0], 4);
eq('private key is 32 bytes', u(keys.privateKey).length, 32);

const h = await vapidHeaders('https://fcm.googleapis.com/fcm/send/abc', 'mailto:x@y.z',
  u(keys.publicKey), u(keys.privateKey));
ok('content-encoding is aes128gcm', h['content-encoding'] === 'aes128gcm', h['content-encoding']);
ok('authorization is the vapid scheme', /^vapid t=.+, k=.+$/.test(h.authorization), h.authorization);

const jwt = h.authorization.match(/t=([^,]+)/)[1].split('.');
const hdr = JSON.parse(u(jwt[0])), clm = JSON.parse(u(jwt[1]));
eq('signed with ES256', hdr.alg, 'ES256');
eq('audience is the push service ORIGIN, not the full endpoint', clm.aud, 'https://fcm.googleapis.com');
ok('expiry is in the future and inside 24h', clm.exp > Date.now()/1000 && clm.exp < Date.now()/1000 + 86400, clm.exp);
eq('signature is a raw r||s pair, not DER', u(jwt[2]).length, 64);

console.log('\nTHE ENDPOINTS  subscribe, list, unsubscribe');
process.env.ADMIN_CODE='devlocal';
process.env.VAPID_PUBLIC_KEY=keys.publicKey;
process.env.VAPID_PRIVATE_KEY=keys.privateKey;
const admin=(await import('../netlify/functions/admin.mjs')).default;
const { readSubs }=await import('../netlify/functions/_push.mjs');
const hit=async(b)=>{const r=await admin(new Request('https://x/api/admin?code=devlocal',
  {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)}));
  const t=await r.text(); try{return {status:r.status,...JSON.parse(t)}}catch{return {status:r.status,raw:t}}};

const k=await hit({action:'pushKey'});
eq('pushKey hands the client the PUBLIC key only', k.key, keys.publicKey);
ok('and never the private one', !JSON.stringify(k).includes(keys.privateKey));
eq('no devices yet', k.devices, 0);

/* A host that cannot resolve. This matters: the first draft used a real
   fcm.googleapis.com URL, FCM answered 404 for the made-up id, and notify()
   correctly PRUNED the dead subscription — so the storage assertions failed
   because the code was doing exactly the right thing. Unreachable means fetch
   throws, which notify() swallows, leaving the record alone. */
const fakeSub={endpoint:'https://push.invalid/send/AAA',
  keys:{p256dh:UA_PUBLIC.toString('base64url'), auth:AUTH.toString('base64url')}};
const on=await hit({action:'pushOn',sub:fakeSub});
ok('subscribing works', on.ok, on);
eq('one device stored', on.devices, 1);

const again=await hit({action:'pushOn',sub:fakeSub});
eq('re-subscribing the same device does not duplicate it', again.devices, 1);

const stored=(await readSubs('perry-idyll')).subs[0];
ok('the endpoint is kept', stored.endpoint===fakeSub.endpoint, stored.endpoint);
ok('so are the keys needed to encrypt to it', !!stored.p256dh && !!stored.auth);

/* And the pruning itself, which the first draft found by accident: a push service
   answering 404/410 means that device is gone for good, so drop it. */
const deadSub={endpoint:'https://fcm.googleapis.com/fcm/send/DEFINITELY-NOT-A-REAL-ID',
  keys:fakeSub.keys};
await hit({action:'pushOn',sub:deadSub});
const afterDead=await hit({action:'pushKey'});
eq('a push service saying 404 prunes that device', afterDead.devices, 1);

const bad1=await hit({action:'pushOn',sub:{endpoint:'http://not-https/x',keys:fakeSub.keys}});
eq('a non-https endpoint is refused', bad1.status, 400);
const bad2=await hit({action:'pushOn',sub:{endpoint:'https://x/y'}});
eq('a subscription with no keys is refused', bad2.status, 400);

const off=await hit({action:'pushOff',endpoint:fakeSub.endpoint});
eq('unsubscribing removes it', off.devices, 0);

delete process.env.VAPID_PUBLIC_KEY; delete process.env.VAPID_PRIVATE_KEY;
const noKeys=await hit({action:'pushOn',sub:fakeSub});
eq('with no keys configured, subscribing is refused not crashed', noKeys.status, 503);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
