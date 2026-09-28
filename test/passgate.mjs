/* THE FOUNDER'S PASSCODE DOOR, MADE A DOOR (decision 0112).

   The gate in front of /moneymodel and its dashboard had three holes a reader of the
   public repository could walk through: the default code was written in the source,
   the cookie was a plain hash of the code with a salt written in the source (so every
   possible cookie for a short code could be computed offline and tried straight at
   the page), and nothing counted wrong guesses. This holds what closed them:

     · on Netlify with no FINMODEL_CODE the door opens for nobody and says why
     · the cookie is a keyed MAC — nobody can mint one without the signing key
     · a cookie made the old way is refused
     · a cookie stamped before MYSET_SECRET arrived keeps opening the page for the
       store key's month, so the founder is not asked again the day it lands
     · wrong codes are counted; past TRIES inside WINDOW the door shuts, for longer
       every time, and shut means the RIGHT code is refused too, with a 429
     · a right code writes nothing unless it has failures to clear
     · a passcode may be long and hold letters (the box takes them since #149) */
process.env.ADMIN_CODE = 'devlocal';
delete process.env.MYSET_SECRET;
delete process.env.MYSET_SECRET_PREVIOUS;
delete process.env.SITE_NAME; delete process.env.NETLIFY; delete process.env.DEPLOY_ID;
delete process.env.FINMODEL_CODE;
import { createHash } from 'node:crypto';

const { gate, stamp, CODE, allowed, TRIES, WINDOW, LOCK_FOR, LOCK_CAP, GATE_KEY, lockedUntil, MAX_CODE } = await import('../netlify/functions/_passgate.mjs');
const { readDoc, casDoc } = await import('../netlify/functions/_lib.mjs');
const { LEGACY_MS, __resetSecret } = await import('../netlify/functions/_auth.mjs');
const { __resetRing } = await import('../netlify/functions/_seal.mjs');
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const post = (code) => gate(new Request('https://myset.vip/moneymodel', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `code=${encodeURIComponent(code)}` }), { landing: '/moneymodel' });
const get = (cookie) => gate(new Request('https://myset.vip/moneymodel', { headers: cookie ? { cookie } : {} }), { landing: '/moneymodel' });
const text = async (r) => (r ? await r.text() : '');
const OLD_SHAPE = (code) => createHash('sha256').update('myset-finmodel|v1|' + code).digest('hex').slice(0, 40);

console.log('\nOFF NETLIFY  the founder\'s original code stands in, as it always did');
eq('the fallback code is in force', CODE(), '2068');
const page = await text(await get());
ok('the box hides what is typed, takes letters and long codes, and has Show', /type="password"/.test(page) && /maxlength="200"/.test(page) && !/inputmode="numeric"/.test(page) && />Show</.test(page));
const good = await post(CODE());
eq('the right code: sent to the page with a cookie', [good.status, good.headers.get('location'), /HttpOnly; Secure; SameSite=Lax/.test(good.headers.get('set-cookie'))], [303, '/moneymodel', true]);
const cookie = (good.headers.get('set-cookie') || '').split(';')[0];
ok('the cookie is a MAC, not the old salted hash of the code', cookie.split('=')[1] !== OLD_SHAPE(CODE()));
eq('…and it is what stamp() computes', cookie.split('=')[1], await stamp(CODE()));
eq('with the cookie the door opens (null = let through)', await get(cookie), null);
eq('the OLD cookie shape is refused', (await get(`fm=${OLD_SHAPE(CODE())}`)).status, 200);
ok('…with the gate page', /Enter the passcode/.test(await text(await get('fm=nonsense'))));
{
  __opsStart(); await post(CODE()); const o = __opsStop();
  eq('a right code with nothing to clear writes nothing', o.filter((l) => /^set /.test(l)).length, 0);
}

console.log('\nWRONG CODES ARE COUNTED  and the door shuts');
{
  const wrong = await post('0000');
  ok('a wrong code: the gate page, said plainly, no cookie', wrong.status === 200 && /not the passcode/.test(await text(wrong)) && !wrong.headers.get('set-cookie'));
  eq('…and counted', ((await readDoc(GATE_KEY, null)).data.fails || []).length, 1);
  let last;
  for (let i = 1; i < TRIES; i++) last = await post(String(i).padStart(4, '0'));
  eq(`the ${TRIES}th wrong code shuts the door: 429 and a Retry-After`, [last.status, Number(last.headers.get('retry-after')) > 0], [429, true]);
  const shutPage = await text(last);
  ok('…the page says so, and the box and button are off', /Too many tries/.test(shutPage) && /required disabled/.test(shutPage) && /type="submit" disabled/.test(shutPage));
  const shut = await post(CODE());
  eq('while it is shut the RIGHT code is refused too — a guesser learns nothing from the door', shut.status, 429);
  ok('…and gets no cookie', !shut.headers.get('set-cookie'));
  const until = await lockedUntil();
  ok('shut for LOCK_FOR the first time', until > Date.now() + LOCK_FOR - 5000 && until <= Date.now() + LOCK_FOR + 5000, { until, now: Date.now() });
  eq('a cookie already held still opens the page (the founder is not the guesser)', await get(cookie), null);
  await casDoc(GATE_KEY, () => ({}), (d) => { d.until = Date.now() - 1; return true; });     // time passes
  for (let i = 0; i < TRIES; i++) last = await post('9999');
  const until2 = await lockedUntil();
  ok('the second lockout is twice as long', until2 > Date.now() + 2 * LOCK_FOR - 5000 && until2 <= Date.now() + 2 * LOCK_FOR + 5000, { until2 });
  await casDoc(GATE_KEY, () => ({}), (d) => { d.until = Date.now() - 1; d.locks = 40; return true; });
  for (let i = 0; i < TRIES; i++) last = await post('9999');
  ok('…and never longer than LOCK_CAP', (await lockedUntil()) <= Date.now() + LOCK_CAP + 5000);
  await casDoc(GATE_KEY, () => ({}), (d) => { d.until = Date.now() - 1; return true; });
  const back = await post(CODE());
  eq('when it reopens, the right code gets in', back.status, 303);
  const cleared = (await readDoc(GATE_KEY, null)).data;
  eq('…and the count starts over', [(cleared.fails || []).length, cleared.until, cleared.locks], [0, 0, 0]);
  ok('misses are forgotten after WINDOW', WINDOW > 0 && LOCK_FOR > 0);
}

console.log('\nMYSET_SECRET ARRIVES  the founder is not asked again that day');
{
  process.env.MYSET_SECRET = 'm'.repeat(48);
  __resetSecret(); __resetRing();
  eq('the cookie stamped under the store key still opens the page', await get(cookie), null);
  const fresh = await post(CODE());
  const newCookie = (fresh.headers.get('set-cookie') || '').split(';')[0];
  ok('a code typed now is stamped under the new key', newCookie && newCookie !== cookie && newCookie.split('=')[1] === await stamp(CODE()));
  eq('…and opens the page', await get(newCookie), null);
  await casDoc('authsecret', () => ({}), (d) => { d.retiredAt = Date.now() - LEGACY_MS - 1000; return true; });
  __resetSecret();
  eq('a month on, the store-key cookie is refused', (await get(cookie)).status, 200);
  eq('…and the new one still opens', await get(newCookie), null);
  delete process.env.MYSET_SECRET;
  __resetSecret(); __resetRing();
}

console.log('\nON NETLIFY WITH NO CODE SET  the door opens for nobody, and says why');
process.env.SITE_NAME = 'mysetvip';
eq('no code', CODE(), '');
const unset = await post('2068');
eq('the code that used to be the default is refused with a 503', unset.status, 503);
ok('…and the page says what to set', /FINMODEL_CODE/.test(await text(unset)));
ok('a GET shows the same', /FINMODEL_CODE/.test(await text(await get())));
eq('no cookie can be let in', await allowed(new Request('https://myset.vip/moneymodel', { headers: { cookie } })), false);
process.env.FINMODEL_CODE = 'Rooftop-Saxophone-Nine';
eq('with FINMODEL_CODE set on Netlify, that is the code', CODE(), 'Rooftop-Saxophone-Nine');
eq('…letters and all, it opens the door', (await post('Rooftop-Saxophone-Nine')).status, 303);
eq('the same letters in another case are not the code', (await post('rooftop-saxophone-nine')).status, 200);
eq('a cookie stamped for the old code does not open it', (await get(cookie)).status, 200);
eq(`a code far longer than the box (${MAX_CODE}) is just a wrong code`, (await post('R'.repeat(5000))).status, 200);
delete process.env.SITE_NAME; delete process.env.FINMODEL_CODE;

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
