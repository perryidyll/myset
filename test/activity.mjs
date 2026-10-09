/* THE ACTIVITY LOG IS COMPLETE (decision 0173).

   `log_<owner>` held a hundred entries, newest first, and the hundred-and-first fell
   off: a record of who got into an account that forgot its own beginning. It is now
   an append-only log in the shape decision 0068 gave every record (_append.mjs): a
   head of at most two hundred, oldest first, spilled into write-once parts that are
   never rewritten and never trimmed. The screen still reads the newest twenty-five,
   newest first, and a log kept the old way is taken over without losing an entry.

   Pinned here:
     · two hundred and fifty notes: one part spilled, fifty in the head, nothing lost,
       every entry readable in order
     · the screen reads the newest twenty-five newest first — also straight after a
       spill, when the head is nearly empty
     · a log written the old way reads as it did, and its first new note carries the
       old entries over in order
     · the export-and-delete key list names the parts, artist and venue
     · the parts are a sealed family (0113)
     · the Studio's own door (`activity`) sees the new shape. */
process.env.ADMIN_CODE = 'devlocal';

const authFn = (await import('../netlify/functions/auth.mjs')).default;
const { createArtist, readArtists, signToken, revOf } = await import('../netlify/functions/_auth.mjs');
const { createVenue } = await import('../netlify/functions/_venues.mjs');
const { note, readLog, LOG, newSid, addSession } = await import('../netlify/functions/_session.mjs');
const { readLogHead, readLog: readAll, logKeys, partKey } = await import('../netlify/functions/_append.mjs');
const { keysFor } = await import('../netlify/functions/_account.mjs');
const { keysForVenue } = await import('../netlify/functions/_venueaccount.mjs');
const { protectedKey } = await import('../netlify/functions/_seal.mjs');
const { casDoc, readDoc } = await import('../netlify/functions/_lib.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const names = (list) => list.map((x) => x.e);
const seq = (a, b) => Array.from({ length: b - a }, (_, i) => `n${a + i}`);

console.log('\nTWO HUNDRED AND FIFTY NOTES  one part, fifty in the head, nothing lost');
await createArtist({ email: 'rita@example.com', name: 'Rita Vance', slug: 'rita' });
const reg = await readArtists();
const rita = reg.byEmail['rita@example.com'].artistId;
for (let i = 0; i < 250; i++) await note(rita, `n${i}`, 'rita@example.com', i % 7 ? '' : 'with a note');
let head = await readLogHead(LOG(rita));
eq('the head: one part spilled, two hundred and fifty counted, fifty kept', [head.parts, head.n, head.list.length], [1, 250, 50]);
eq('…oldest first on disk', names(head.list).slice(0, 2), ['n200', 'n201']);
const all = await readAll(LOG(rita));
eq('EVERY entry is still there, in order', names(all.list), seq(0, 250));
ok('an entry keeps what it was given: the moment, the kind, who, the note', all.list[0].t > 0 && all.list[0].by === 'rita@example.com' && all.list[0].m === 'with a note' && all.list[1].m === undefined, all.list[0]);
const screen = await readLog(rita);
eq('the screen reads the newest twenty-five, newest first', names(screen), seq(225, 250).reverse());
eq('…and asks for fewer when it wants fewer', names(await readLog(rita, 3)), ['n249', 'n248', 'n247']);

console.log('\nJUST AFTER A SPILL  the head is empty and the screen is not');
await createArtist({ email: 'ben@example.com', name: 'Ben Oduya', slug: 'ben' });
const ben = (await readArtists()).byEmail['ben@example.com'].artistId;
for (let i = 0; i < 200; i++) await note(ben, `n${i}`, 'ben@example.com');
head = await readLogHead(LOG(ben));
eq('two hundred notes: the part is written and the head is empty', [head.parts, head.list.length], [1, 0]);
eq('the screen still shows the newest twenty-five, from the part', names(await readLog(ben)), seq(175, 200).reverse());
await note(ben, 'n200', 'ben@example.com');
eq('one more: the head has it and the part fills in behind', names(await readLog(ben, 4)), ['n200', 'n199', 'n198', 'n197']);

console.log('\nA LOG KEPT THE OLD WAY  reads as it did, and is carried over on its first new note');
await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana' });
const ana = (await readArtists()).byEmail['ana@example.com'].artistId;
await casDoc(LOG(ana), () => ({ v: 1, list: [] }), (d) => {
  d.list = [{ t: 3, e: 'third', by: 'ana@example.com' }, { t: 2, e: 'second', by: 'ana@example.com' }, { t: 1, e: 'first', by: 'ana@example.com' }];
  return true;
});
eq('the old shape, newest first, reads newest first', names(await readLog(ana)), ['third', 'second', 'first']);
await note(ana, 'fourth', 'ana@example.com');
eq('after the first new note the screen reads newest first, all four', names(await readLog(ana)), ['fourth', 'third', 'second', 'first']);
head = await readLogHead(LOG(ana));
eq('…and on disk it is the new shape: oldest first, four counted, no part yet', [names(head.list), head.n, head.parts], [['first', 'second', 'third', 'fourth'], 4, 0]);
eq('a log nobody has written reads as empty', await readLog('nobody_here'), []);

console.log('\nEXPORT AND DELETE  the key list names the parts');
const keys = await keysFor(rita);
ok('the artist\'s list has the head and its part', keys.includes(LOG(rita)) && keys.includes(partKey(LOG(rita), 0)), keys.filter((k) => k.startsWith('log_')));
eq('…and not a part that does not exist', keys.includes(partKey(LOG(rita), 1)), false);
eq('logKeys agrees', await logKeys(LOG(rita)), [LOG(rita), partKey(LOG(rita), 0)]);
const bar = await createVenue({ email: 'boss@bar.com', name: 'The Corner Bar', city: 'Koh Phangan', country: 'Thailand' });
await note('v_' + bar.venueId, 'signin.password', 'boss@bar.com');
const vkeys = await keysForVenue(bar.venueId);
ok('the venue\'s list has its log', vkeys.includes(`log_v_${bar.venueId}`), vkeys.filter((k) => k.startsWith('log_')));
ok('an artist with no log yet still lists the key (so a delete finds nothing to miss)', (await keysFor(ben)).includes(LOG(ben)));

console.log('\nSEALED  a part is a record that holds a person (0113)');
ok('the head is a sealed family', protectedKey(LOG(rita)));
ok('…and so is a part', protectedKey(partKey(LOG(rita), 0)) && protectedKey(partKey(`log_v_${bar.venueId}`, 3)));

console.log('\nTHE STUDIO\'S DOOR  `activity` shows the newest twenty-five');
const sid = newSid();
await addSession(rita, { sid, email: 'rita@example.com', label: 'iPhone · Safari', at: Date.now() });
const token = await signToken('rita@example.com', revOf(await readArtists(), rita), sid);
const r = await authFn(new Request('https://x/api/auth', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'activity' }) }));
const j = await r.json();
eq('twenty-five rows, newest first', [j.ok, j.list.length, j.list[0].e], [true, 25, 'n249']);
ok('a stored part is write-once', (await (await import('../netlify/functions/_lib.mjs')).store().set(partKey(LOG(rita), 0), '{}', { onlyIfNew: true })).modified === false);
ok('the raw part on disk is a list of two hundred', (((await readDoc(partKey(LOG(rita), 0), null)).data || {}).list || []).length === 200);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
