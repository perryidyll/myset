/* SEALED AT REST (decision 0113).

   The few documents that hold something personal are sealed before they are written
   and opened after they are read, with data keys kept in one keyring (`sealkeys`)
   that is itself wrapped under the key MYSET_SECRET gives. These are the properties
   that make that safe to switch on under a live platform, and to rotate later:

     · no key — plaintext in, plaintext out, exactly as before
     · a key — the bytes on the store are ciphertext, the reader sees the document,
       and the keyring on the store holds no key anybody can use without the secret
     · a plaintext record under a protected key still reads, and seals on its next write
     · the room's documents are never on the list; HQ's contacts are
     · the wrong secret, no secret, a touched byte, bytes moved to another key: read
       as missing and refused a write — the record is kept, and the keyring is never
       made again over the one that exists
     · a rotation re-wraps ONE document; the previous value can then be removed and
       every record ever sealed still opens — a password never re-typed, a Gmail
       token never refreshed, an ID photo never re-sent
     · two cold instances making the ring at once agree on one ring
     · the ID photo, the password record and the spilled parts of a sealed log go
       through the same door although they are written raw
     · it is cheap */
process.env.ADMIN_CODE = 'devlocal';
delete process.env.MYSET_SECRET;
delete process.env.MYSET_SECRET_PREVIOUS;

const { protectedKey, seal, open, isSealed, MAGIC, ring, RING_KEY, __resetRing } = await import('../netlify/functions/_seal.mjs');
const { readDoc, casDoc, KEY, SHARDS } = await import('../netlify/functions/_lib.mjs');
const { putImage, getImage } = await import('../netlify/functions/_img.mjs');
const { setPassword, checkPassword, hasPassword, credKey } = await import('../netlify/functions/_cred.mjs');
const { appendLog, readLog } = await import('../netlify/functions/_append.mjs');
const G = await import('../netlify/functions/_gmail.mjs');
const { __dump, __reset } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const raw = (k) => { const e = __dump().get(k); return e ? (Buffer.isBuffer(e.body) ? e.body : Buffer.from(e.body)) : null; };
const ringDoc = () => JSON.parse(raw(RING_KEY).toString());
const KEY1 = 'a'.repeat(48), KEY2 = 'b'.repeat(48), KEY3 = 'c'.repeat(48);
const secret = (cur, prev) => {
  if (cur) process.env.MYSET_SECRET = cur; else delete process.env.MYSET_SECRET;
  if (prev) process.env.MYSET_SECRET_PREVIOUS = prev; else delete process.env.MYSET_SECRET_PREVIOUS;
};

console.log('\nWHAT IS ON THE LIST, AND WHAT NEVER IS');
ok('the booker threads, the inbox and its archive parts', ['msg_ana_t1', 'inbox_ana', 'inboxarch_ana', 'inboxarch_ana_p3'].every(protectedKey));
ok('credentials, recovery codes, sessions, the activity log, push, bugs, errors, the ID queue', ['cred_ana_abc', 'rec_ana', 'sess_ana', 'log_ana', 'push_ana', 'bugs_ana', 'err_2026-09-28T01', 'idqueue'].every(protectedKey));
ok('HQ: the contact index, every contact, the Gmail record', ['crm', 'crm_c0123456789', 'crmgmail'].every(protectedKey));
ok('the ID photo — an artist\'s or a venue\'s', protectedKey('img_ana-reyes_idcheck') && protectedKey('img_v_bar1_idcheck'));
ok('a version of a sealed document', protectedKey('ver_msg_ana_t1_1700000000000') && !protectedKey('ver_profile_ana_1700000000000'));
const hot = [KEY.show('ana'), ...Array.from({ length: SHARDS }, (_, n) => KEY.fan('ana', n)), KEY.meta('ana'), KEY.profile('ana'), KEY.reqs('ana'), KEY.histIdx('ana'),
  KEY.hist('ana', 's1'), KEY.biz('ana'), KEY.diary('ana'), 'artists', 'venues', 'cityindex', 'flags',
  'posts_ana', 'likes_ana', 'rsvp_ana', 'ev_ana', 'lists_ana', 'connect_ana', 'billing_ana', 'vprofile_bar1', 'img_ana_avatar', 'img_ana_cover',
  'vid_ana_k1234567890', 'authsecret', 'lock_ana', 'authc_x', 'authnet_x', 'paylim_ana', 'fb_ana', RING_KEY];
eq('nothing the room, the Studio\'s poll, the money or the limiters read is sealed — nor the keyring itself', hot.filter(protectedKey), []);
{
  const { GLOBALS, skipped } = await import('../netlify/functions/_mirror.mjs');
  ok('the nightly mirror copies the keyring (wrapped, so safe — and the sealed copies are useless without it)', GLOBALS.includes(RING_KEY) && !skipped(RING_KEY));
}

console.log('\nNO KEY  plaintext, exactly as before');
eq('no keyring', await ring(), null);
ok('seal returns the bytes as they were', (await seal('msg_x', '{"a":1}')).toString() === '{"a":1}');
await casDoc('msg_ana_t1', () => ({}), (d) => { d.email = 'booker@example.com'; return true; });
ok('a protected key is written as plain JSON', raw('msg_ana_t1').toString().includes('booker@example.com'));
eq('…and reads back', (await readDoc('msg_ana_t1', null)).data.email, 'booker@example.com');
eq('no keyring was made', raw(RING_KEY), null);

console.log('\nA KEY  the store holds ciphertext, the reader sees the document');
secret(KEY1);
await casDoc('sess_ana', () => ({ list: [] }), (d) => { d.list.push({ sid: 'dev1', email: 'rita@example.com' }); return true; });
const r1 = await ring();
ok('a keyring now, with one data key', r1 && !r1.fail && r1.keys.size === 1, r1 && r1.fail);
const rd = ringDoc();
ok('on the store it holds the key WRAPPED, never the key', Object.keys(rd.keys).length === 1 && !raw(RING_KEY).includes(r1.keys.get(r1.cur).toString('hex')) && !raw(RING_KEY).includes(r1.keys.get(r1.cur).toString('base64url')));
const bytes = raw('sess_ana');
ok('the record starts with the header and the data key\'s name', isSealed(bytes) && bytes.subarray(0, 9).toString('latin1') === `${MAGIC}${r1.cur}:`, bytes.subarray(0, 9).toString('latin1'));
ok('…and holds no address in the clear', !bytes.toString('latin1').includes('rita@example.com') && !bytes.toString('latin1').includes('dev1'));
eq('the reader sees the document', (await readDoc('sess_ana', null)).data.list[0].email, 'rita@example.com');
ok('thirty-seven bytes of overhead — the header, the IV and the tag', bytes.length === Buffer.byteLength(JSON.stringify((await readDoc('sess_ana', null)).data)) + 37, bytes.length);
await casDoc('show_ana', () => ({}), (d) => { d.status = 'live'; return true; });
ok('the show record is still plain JSON', raw('show_ana').toString() === JSON.stringify({ status: 'live' }));
eq('a plaintext record under a protected key still reads', (await readDoc('msg_ana_t1', null)).data.email, 'booker@example.com');
await casDoc('msg_ana_t1', () => ({}), (d) => { d.phone = '+66'; return true; });
ok('…and is sealed by its next write', isSealed(raw('msg_ana_t1')));
eq('…keeping everything it had', (await readDoc('msg_ana_t1', null)).data, { email: 'booker@example.com', phone: '+66' });
await casDoc('crm_c0123456789', () => ({}), (d) => { d.name = 'Nok'; d.email = 'nok@example.com'; d.notes = ['met at the bar']; return true; });
ok('an HQ contact is sealed', isSealed(raw('crm_c0123456789')) && !raw('crm_c0123456789').toString('latin1').includes('nok@example.com'));

console.log('\nTHE OTHER DOORS  written raw, sealed all the same');
await putImage('ana', 'idcheck', Buffer.from('a passport, in bytes'), 'image/jpeg');
ok('the ID photo is sealed on the store', isSealed(raw('img_ana_idcheck')) && !raw('img_ana_idcheck').toString('latin1').includes('passport'));
eq('…and comes back whole for the reviewer', (await getImage('ana', 'idcheck')).bytes.toString(), 'a passport, in bytes');
await putImage('ana', 'avatar', Buffer.from('\xff\xd8 a public portrait', 'latin1'), 'image/jpeg');
ok('a public picture is stored as it is', !isSealed(raw('img_ana_avatar')));
await setPassword('ana', 'rita@example.com', 'correct horse battery');
ok('the password record is sealed', isSealed(raw(credKey('ana', 'rita@example.com'))));
ok('…and the password still checks', (await hasPassword('ana', 'rita@example.com')) && (await checkPassword('ana', 'rita@example.com', 'correct horse battery')) && !(await checkPassword('ana', 'rita@example.com', 'wrong')));
process.env.MYSET_LOG_CHUNK = '20';                    // the smallest chunk _append.mjs allows
for (let i = 0; i < 25; i++) await appendLog('inboxarch_ana', [{ i, email: `b${i}@example.com` }]);
const parts = [...__dump().keys()].filter((k) => k.startsWith('inboxarch_ana_p'));
ok('the spilled parts of a sealed log are sealed', parts.length >= 1 && parts.every((k) => isSealed(raw(k)) && !raw(k).toString('latin1').includes('@example.com')), parts);
eq('…and the log reads back in order', (await readLog('inboxarch_ana')).list.map((x) => x.i), Array.from({ length: 25 }, (_, i) => i));
delete process.env.MYSET_LOG_CHUNK;
const gmailBox = await G.encrypt('1//a-refresh-token');
ok('HQ\'s Gmail token is sealed with the keyring (v2)', gmailBox.startsWith('v2.') && !gmailBox.includes('refresh'));
eq('…and opens', await G.decrypt(gmailBox), '1//a-refresh-token');
{
  const b = Buffer.from(gmailBox.slice(3), 'base64url');
  const touchedBox = (i) => { const c = Buffer.from(b); c[i] ^= 1; return `v2.${c.toString('base64url')}`; };
  eq('a changed IV, tag or ciphertext byte opens to nothing', [await G.decrypt(touchedBox(12)), await G.decrypt(touchedBox(30)), await G.decrypt(touchedBox(b.length - 1))], [null, null, null]);
  eq('…and neither does a box that was never sealed, or junk', [await G.decrypt(`v2.${Buffer.from('1//a-refresh-token').toString('base64url')}`), await G.decrypt('v2.'), await G.decrypt('v9.x')], [null, null, null]);
}

console.log('\nTHE WRONG SECRET, NO SECRET, A TOUCHED BYTE, MOVED BYTES  read as missing, never written over');
const before = Buffer.from(raw('sess_ana'));
const ringBefore = Buffer.from(raw(RING_KEY));
secret(KEY2);
eq('under a different secret the keyring cannot be opened', (await ring()).fail, 'unknown-secret');
eq('the record reads as missing', (await readDoc('sess_ana', null)).data, null);
eq('…and says why', (await readDoc('sess_ana', null)).sealed, 'unknown-secret');
let threw = null;
await casDoc('sess_ana', () => ({ list: [] }), (d) => { d.list.push({ sid: 'evil' }); return true; }).catch((e) => { threw = e.message; });
eq('a write over it is refused', threw, 'sealed');
threw = null;
await casDoc('push_ana', () => ({}), (d) => { d.x = 1; return true; }).catch((e) => { threw = e.message; });
eq('a NEW protected record is refused too — never written in the clear while a secret is set', [threw, raw('push_ana')], ['sealed', null]);
ok('the record\'s bytes are untouched', raw('sess_ana').equals(before));
ok('…and the keyring was NOT made again over the one that exists', raw(RING_KEY).equals(ringBefore));
eq('the password door simply says no', await checkPassword('ana', 'rita@example.com', 'correct horse battery'), false);
eq('the ID photo is not shown', await getImage('ana', 'idcheck'), null);
eq('the Gmail token does not open', await G.decrypt(gmailBox), null);
secret(null);
eq('with no secret at all, the same', [(await readDoc('sess_ana', null)).data, (await readDoc('sess_ana', null)).sealed], [null, 'no-key']);
secret(KEY1);
eq('the secret back: the record is there, whole', (await readDoc('sess_ana', null)).data.list[0].sid, 'dev1');
const touched = Buffer.from(before); touched[touched.length - 1] ^= 1;
eq('a touched byte fails to open', (await open('sess_ana', touched)).fail, 'tamper');
eq('the bytes under another key fail to open', (await open('sess_bo', before)).fail, 'tamper');
const plainOpen = await open('sess_x', Buffer.from('{"a":1}'));
eq('a plaintext record opens as plain', [plainOpen.plain, plainOpen.data.toString()], [true, '{"a":1}']);

console.log('\nA ROTATION  one document re-wrapped; nothing stranded when the previous value goes');
const oldCur = ringDoc().cur;
secret(KEY3, KEY1);
eq('sealed before the rotation, it still reads', (await readDoc('sess_ana', null)).data.list[0].sid, 'dev1');
const rd2 = ringDoc();
ok('the keyring was re-wrapped under the new secret, with a fresh data key for what comes next',
   rd2.kek !== rd.kek && Object.keys(rd2.keys).length === 2 && rd2.cur !== oldCur && rd2.rotations === 1, { kek: [rd.kek, rd2.kek], keys: Object.keys(rd2.keys), cur: rd2.cur });
ok('…and open() says the old record is on an older data key', (await open('sess_ana', raw('sess_ana'))).stale === true);
await casDoc('sess_ana', () => ({ list: [] }), (d) => { d.list.push({ sid: 'dev2' }); return true; });
ok('its next write seals it under the fresh key', raw('sess_ana').subarray(4, 8).toString('latin1') === rd2.cur);
secret(KEY3);
__resetRing();
eq('the previous value removed: the re-written record reads', (await readDoc('sess_ana', null)).data.list.map((s) => s.sid), ['dev1', 'dev2']);
ok('…and so does the password never re-typed', await checkPassword('ana', 'rita@example.com', 'correct horse battery'));
eq('…and the ID photo never re-sent', (await getImage('ana', 'idcheck')).bytes.toString(), 'a passport, in bytes');
eq('…and the Gmail token never refreshed', await G.decrypt(gmailBox), '1//a-refresh-token');
eq('…and the HQ contact', (await readDoc('crm_c0123456789', null)).data.name, 'Nok');
eq('…and the sealed log\'s old parts', (await readLog('inboxarch_ana')).list.length, 25);
secret(KEY1);
__resetRing();
eq('the OLD secret alone can no longer open the ring (a leaked old value opens nothing new)', (await ring()).fail, 'unknown-secret');
secret(KEY3);
__resetRing();

console.log('\nA KEYRING THAT IS NOT A KEYRING  is never replaced');
{
  const good = Buffer.from(raw(RING_KEY));
  await casDoc(RING_KEY, () => ({}), (d) => { d.keys = 'scribbled over'; return true; });
  __resetRing();
  const broken = Buffer.from(raw(RING_KEY));
  eq('it fails closed', (await ring()).fail, 'malformed');
  ok('…and nothing was written over it', raw(RING_KEY).equals(broken));
  await casDoc(RING_KEY, () => ({}), (d) => { for (const k of Object.keys(d)) delete d[k]; Object.assign(d, JSON.parse(good.toString())); return true; });
  __resetRing();
  eq('put back, it opens, and so does everything under it', (await readDoc('sess_ana', null)).data.list.length, 2);
}

console.log('\nTWO COLD INSTANCES AT ONCE  one ring');
__reset();
__resetRing();
secret(KEY1);
const [ra, rb] = await Promise.all([ring(), (async () => { await null; const { __resetRing: again } = await import('../netlify/functions/_seal.mjs'); again(); return ring(); })()]);
ok('both come back with the same current key', ra && rb && !ra.fail && !rb.fail && ra.cur === rb.cur && ra.keys.get(ra.cur).equals(rb.keys.get(rb.cur)), { a: ra && (ra.cur || ra.fail), b: rb && (rb.cur || rb.fail) });
eq('…and the store holds that one', ringDoc().cur, ra.cur);

console.log('\nCHEAP');
{
  const doc = JSON.stringify({ list: Array.from({ length: 60 }, (_, i) => ({ sid: 'device' + i, email: `person${i}@example.com`, label: 'iPhone · Safari', at: 1700000000000 + i })) });
  ok('a five-kilobyte document', doc.length > 4500 && doc.length < 7000, doc.length);
  await ring();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 200; i++) await open('sess_bench', await seal('sess_bench', doc));
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
  ok(`seal + open: ${ms.toFixed(3)} ms a document (under a millisecond)`, ms < 1, ms);
}

__reset();
__resetRing();
secret(null);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
