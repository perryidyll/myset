/* A READ THAT FAILED IS NOT AN EMPTY DOCUMENT  (decision 0142, INVARIANT 0hq)

   `readDoc` used to catch every error and hand back the fallback, so "the store did
   not answer" looked exactly like "there is nothing there". With one fan file
   unreadable the board lost a twelfth of the room's votes and was cached for
   everyone, a fan was shown fresh credits, and a sign-in check found no session and
   signed the artist out mid-gig. This suite fails the store's reads on purpose and
   pins what every door does about it: answer 503 "busy", write nothing, sign nobody
   out — and carry on as before the moment the store is back. */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.MYSET_READ_TIMEOUT_MS = '120';

const admin   = (await import('../netlify/functions/admin.mjs')).default;
const boardFn = (await import('../netlify/functions/board.mjs')).default;
const meFn    = (await import('../netlify/functions/me.mjs')).default;
const voteFn  = (await import('../netlify/functions/vote.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const fanFn   = (await import('../netlify/functions/fan.mjs')).default;
const { readDoc, casDoc, shardOf, readFans, getShow, isStoreError, StoreError, READ_TIMEOUT_MS } = await import('../netlify/functions/_lib.mjs');
const { createArtist, signToken, readArtists, revOf } = await import('../netlify/functions/_auth.mjs');
const { __failReads, __dump } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  let j = {}; try { j = JSON.parse(t); } catch { j = { raw: t }; }
  return { status: r.status, cdn: r.headers.get('netlify-cdn-cache-control') || '', ...j };
};
const A = (action, x = {}) => hit(admin, 'https://x/api/admin?code=devlocal', { action, ...x });
const AID = 'perry-idyll';
const stored = (key) => { const e = __dump().get(key); return e ? String(e.body) : null; };
// two phones in different fan files, so one file can fail while the other answers
const inShard = (n) => { for (let i = 0; ; i++) if (shardOf('fan' + i) === n) return 'fan' + i; };
const ann = inShard(3), bob = inShard(7);
const cast = (fan, song, id) => hit(voteFn, 'https://x/api/vote', { fan, song, n: 1, op: 'cast', cast: id });

console.log('\nSETUP  a live show with a vote from each of two phones');
await A('addSong', { title: 'Alpha', artist: 'T' });
await A('addSong', { title: 'Bravo', artist: 'T' });
await A('freeCredits', { n: 3 });   // ann votes twice; a fresh phone holds 1 since decision 0172
await A('status', { status: 'live' });
const alpha = (await getShow(AID)).songs[0].id;
ok('ann votes', (await cast(ann, alpha, 'storefail0000001')).ok);
ok('bob votes', (await cast(bob, alpha, 'storefail0000002')).ok);
const healthy = await hit(boardFn, 'https://x/api/board');
const votesOn = (b) => ((b.songs || []).find((s) => s.id === alpha) || {}).votes;
eq('the board counts both', votesOn(healthy), 2);
const mia = await createArtist({ email: 'mia@example.com', name: 'Mia', slug: 'mia' });
const TM = await signToken('mia@example.com', revOf(await readArtists(), mia.artistId));
eq('the Studio opens with her sign-in', (await hit(stageFn, 'https://x/api/stage', undefined, TM)).status, 200);

console.log('\nreadDoc  missing is still empty; failing is an error');
eq('a document that is not there is the fallback', (await readDoc('nothing_here', 'fb')).data, 'fb');
__failReads(/^meta_/);
let threw = null;
try { await readDoc('meta_' + AID, { empty: true }); } catch (e) { threw = e; }
ok('THE FIX: a read that throws is an error, not the fallback', threw instanceof StoreError && isStoreError(threw), String(threw));
eq('it names the store, not a bug', threw && threw.message, 'store-unavailable');
eq('with a code a caller can test', threw && threw.code, 'store-read');
eq('and the key', threw && threw.key, 'meta_' + AID);
__failReads(/^meta_/, { hang: true });
const t0 = Date.now(); threw = null;
try { await readDoc('meta_' + AID, null); } catch (e) { threw = e; }
ok(`a read that never answers gives up on a clock — ${Date.now() - t0} ms (limit ${READ_TIMEOUT_MS})`,
   isStoreError(threw) && Date.now() - t0 < READ_TIMEOUT_MS + 400, String(threw));
__failReads(null);

console.log('\ncasDoc  a blip is retried; a store that is down is not written over');
const before = stored('meta_' + AID);
let n = 0;
__failReads({ test: (k) => k === 'meta_' + AID && ++n === 1 });          // the first read only
const blip = await casDoc('meta_' + AID, () => ({}), (m) => { m.blip = 1; return true; });
ok('one failed read is retried and the write lands', blip.ok && JSON.parse(stored('meta_' + AID)).blip === 1, blip);
__failReads(/^meta_/);
threw = null;
const mid = stored('meta_' + AID);
try { await casDoc('meta_' + AID, () => ({}), (m) => { m.lost = 1; return true; }); } catch (e) { threw = e; }
ok('two in a row is the store being down: it throws the store error, not "busy" after forty tries', isStoreError(threw), String(threw));
eq('THE FIX: and nothing was written over the document it could not read', stored('meta_' + AID), mid);
ok('(the document was real, not empty)', !!mid && mid.length > 2 && before !== mid);
__failReads(null);

console.log('\nTHE BOARD  never a partial count');
__failReads(new RegExp('^f3_' + AID + '$'));
let b = await hit(boardFn, 'https://x/api/board');
eq('THE FIX: with one fan file unreadable the board is refused, not short', b.status, 503);
eq('it says busy', b.error, 'busy');
ok('and is never kept at the edge', /no-store/.test(b.cdn), b.cdn);
b = await hit(fanFn, 'https://x/api/fan?what=board');
eq('the same through the fan door', b.status, 503);
eq('ann, whose file it is, is told busy — not shown fresh credits', (await hit(meFn, `https://x/api/me?fan=${ann}`)).status, 503);
eq('bob, in another file, is answered as usual', (await hit(meFn, `https://x/api/me?fan=${bob}`)).status, 200);

console.log('\nA VOTE  refused whole, and safe to send again');
const bravo = (await getShow(AID)).songs[1].id;
const v = await cast(ann, bravo, 'storefail0000003');
eq('ann’s vote is refused', v.status, 503);
eq('as busy, which the page retries', v.error, 'busy');
__failReads(null);
eq('nothing of it was written', ((await readFans(AID))[ann].votes || {})[bravo], undefined);
ok('the same vote, sent again, lands', (await cast(ann, bravo, 'storefail0000003')).ok);
ok('and a third send of it does not count twice', (await cast(ann, bravo, 'storefail0000003')).ok);
b = await hit(boardFn, 'https://x/api/board');
eq('the board is whole again: alpha still has both', votesOn(b), 2);
eq('and bravo has exactly one', ((b.songs || []).find((s) => s.id === bravo) || {}).votes, 1);

console.log('\nTHE STUDIO  a store that does not answer signs nobody out');
for (const [what, re] of [['the artist list', /^artists$/], ['her show', new RegExp('^show_' + mia.artistId + '$')]]) {
  __failReads(re);
  const s = await hit(stageFn, 'https://x/api/stage', undefined, TM);
  ok(`with ${what} unreadable the Studio is told busy (503), never unauthorized — ${s.status} ${s.error}`, s.status === 503 && s.error === 'busy', s);
}
__failReads(/^artists$/);
/* Since decision 0176 her room finds her through its own small copies of the list,
   so the list alone being unreadable no longer touches it: the room still votes. With
   the copies unreadable too, it is busy — never "unknown artist". */
(await import('../netlify/functions/_auth.mjs')).__flushArtists();
const pub = await hit(meFn, 'https://x/api/me?a=mia&fan=' + ann);
ok(`and her room still answers, from the list's small copies — ${pub.status}`, pub.status === 200 && pub.ok, pub);
__failReads(/^(artists|aslug_.+|arow_.+)$/);
(await import('../netlify/functions/_auth.mjs')).__flushArtists();
const pub2 = await hit(meFn, 'https://x/api/me?a=mia&fan=' + ann);
ok(`with the copies unreadable too it is busy, not "unknown artist" — ${pub2.status}`, pub2.status === 503, pub2);
__failReads(/^artists$/);
const act = await hit(admin, 'https://x/api/admin', { action: 'addSong', title: 'Never', artist: 'T' }, TM);
eq('an action is refused the same way', act.status, 503);
__failReads(null);
eq('the same sign-in works the moment the store is back', (await hit(stageFn, 'https://x/api/stage', undefined, TM)).status, 200);
ok('and the refused action wrote nothing', !(await getShow(mia.artistId)).songs.some((s) => s.title === 'Never'));

console.log('\nTHE PUBLIC PAGES  busy, not empty');
__failReads(new RegExp('^profile_' + mia.artistId + '$'));
const prof = await hit(fanFn, 'https://x/api/fan?what=profile&a=mia');
ok(`a profile that cannot be read is a 503, not a blank page kept at the edge — ${prof.status}`, prof.status === 503 && /no-store/.test(prof.cdn), prof);
__failReads(null);
eq('and is itself again afterwards', (await hit(fanFn, 'https://x/api/fan?what=profile&a=mia')).status, 200);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
