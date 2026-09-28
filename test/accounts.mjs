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
/* NOR ONE DEVICE AT A TIME (decision 0104). revokeAll was refused, but sessionRevoke
   signed out any sid on the account and `sessions` handed every one of them out, the
   owner's phone included. A seat that is not the owner now sees, and can sign out,
   only the devices signed in with its own address. */
const sidR = newSid(), sidB = newSid();
await addSession(rita, { sid: sidR, email: 'rita@example.com', label: 'iPhone · Safari', at: Date.now() });
await addSession(rita, { sid: sidB, email: 'bass@example.com', label: 'Android · Chrome', at: Date.now() });
const TO = await signToken('rita@example.com', revOf(reg, rita), sidR);
const TB = await signToken('bass@example.com', revOf(reg, rita), sidB);
eq('a member sees only their own devices, never the owner’s',
   ((await A({ action: 'sessions' }, TB)).list || []).map((x) => x.sid), [sidB]);
eq('THE BUG: and cannot sign the owner’s phone out by its id', (await A({ action: 'sessionRevoke', sid: sidR }, TB)).status, 403);
eq('so the owner is still in', (await S({ action: 'planGet' }, TO)).status, 200);
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
/* THE SAME HOLE, ONE TAP WIDE (decision 0104). signOutOthers had no role check and
   meant every OTHER device on the account, so "Sign out my other devices" on the
   sound engineer's phone bounced the artist's Studio to the sign-in screen mid-gig.
   It now means the crew member's own other devices and nobody else's. */
const sidC = newSid(), sidC2 = newSid();
await addSession(rita, { sid: sidC, email: 'sound@example.com', label: 'iPad · Safari', at: Date.now() });
await addSession(rita, { sid: sidC2, email: 'sound@example.com', label: 'Mac · Chrome', at: Date.now() });
const TC1 = await signToken('sound@example.com', revOf(reg, rita), sidC);
const TC2 = await signToken('sound@example.com', revOf(reg, rita), sidC2);
eq('the owner is signed in before', (await S({ action: 'planGet' }, TO)).status, 200);
eq('crew cannot sign everyone out', (await A({ action: 'revokeAll' }, TC1)).status, 403);
r = await A({ action: 'signOutOthers' }, TC1);
ok('crew can sign out their own other devices', r.ok && r.gone === 1, r);
eq('THE BUG: and the owner is still signed in after', (await S({ action: 'planGet' }, TO)).status, 200);
ok('so is the band mate', (await S({ action: 'planGet' }, TB)).ok);
eq('while the crew member’s other device is out', (await S({ action: 'planGet' }, TC2)).status, 401);
eq('crew cannot name the owner’s phone either', (await A({ action: 'sessionRevoke', sid: sidR }, TC1)).status, 403);
r = await A({ action: 'sessions' }, TO);
ok('the owner still sees every device on the account',
   [sidR, sidB, sidC].every((s) => (r.list || []).some((x) => x.sid === s)), r);
ok('and can still sign any one of them out', (await A({ action: 'sessionRevoke', sid: sidC }, TO)).ok);
eq('which reaches the crew phone', (await S({ action: 'planGet' }, TC1)).status, 401);
eq('crew cannot rewrite the library', (await S({ action: 'addSong', title: 'No', artist: 'X' }, TC)).status, 403);
eq('crew cannot touch the profile', (await S({ action: 'profileSet', profile: { bio: 'x' } }, TC)).status, 403);
/* The shop and media writes are tenancy, not the show: each must be refused BEFORE the
   action is looked up, or a crew sign-in could clear an order or a photo. */
for (const a of ['merchRemove', 'merchPhotoClear', 'photoClear', 'orderDone', 'orderDetail', 'mediaRemove'])
  eq('crew is refused ' + a, (await S({ action: a, id: 'mabcdef', sid: 'cs_x', slot: 'p0' }, TC)).status, 403);
ok('a member may still work the shop', (await S({ action: 'merchList' }, TM)).ok);
ok('an unknown role falls back to the least it could be, never the most',
   can('owner', 'setlist_edit') && !can('crew', 'setlist_edit') && !can('made-up-role', 'setlist_edit'));
/* `CAN['toString']` is an inherited Function: truthy, with no `.has`, so the
   first version of this threw a TypeError on a role string that could arrive
   from stored data. It must fall back to crew, not explode and not open up. */
ok('and a role name that is a JavaScript builtin falls back to crew rather than crashing',
   can('toString', 'audit') === false && can('toString', 'setlist_view') === true && can('toString', 'setlist_edit') === false);

console.log('\nEVERY ROW OF THE ROLE TABLE NAMES A REAL ACTION  (setlists, charts, lyrics, tags)');
/* CAPABILITY gated songSet, bulkSongs, setChart, setLyrics, listSave, listApply and
   eventUnskip — names no handler has. An action missing from that table needs nothing
   beyond being signed in, so the actions that DO exist were open to crew: every
   setlist, chart, lyric and genre, the to-learn list, a pinned post, a gig on the
   calendar, and the whole library in one tap (clearSetlist). The same slip as the
   profileSet row; test/structure.mjs now refuses a key no handler takes. */
{
  const song = (await hit(stageFn, 'https://x/api/stage', undefined, TM)).songs[0];
  ok('a member may make a setlist', (await S({ action: 'listNew', name: 'Friday' }, TM)).ok);
  ok('write a chart', (await S({ action: 'chartSet', song: song.id, chart: 'Am  G  C  F' }, TM)).ok);
  ok('put the words up', (await S({ action: 'lyricsSet', song: song.id, plain: 'Wires in the rain' }, TM)).ok);
  ok('and add a genre of the band’s own', (await S({ action: 'tagAdd', label: 'Sea shanty' }, TM)).ok);
  const before = (await hit(stageFn, 'https://x/api/stage', undefined, TM)).songs.length;
  // clearSetlist last: if the gate is open, it empties the library the check below counts
  for (const a of ['listNew', 'listRename', 'listSongs', 'listToggle', 'listUse', 'chartSet', 'lyricsSet',
                   'lyricsFetch', 'tagAdd', 'tagAuto', 'tagRemove', 'learnDone', 'postPin', 'eventHide', 'clearSetlist'])
    eq('THE BUG: crew is refused ' + a, (await S({ action: a, id: 'lx', song: 'nope', name: 'Crew set',
      label: 'Crew tag', chart: 'x', plain: 'x', date: '2026-10-01', songs: [] }, TC)).status, 403);
  eq('and the library is all still there', (await hit(stageFn, 'https://x/api/stage', undefined, TM)).songs.length, before);
}

console.log('\nTHE FOUNDER’S TOOLS NEED THE FOUNDER’S OWNER SEAT, NOT JUST THE FOUNDING PAGE');
/* The platform block in handlePlan asked WHICH PAGE, never WHO: isPlatformOwner is
   `aid === DEFAULT_ARTIST`, and not one of these actions is in OWNER_ONLY or
   CAPABILITY. So a band mate or the sound engineer signed in to the founding page
   could flip a flag for every artist, approve an ID check, mint a free plan or set a
   venue's plan — one POST each. */
{
  const { DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
  const { readFlags } = await import('../netlify/functions/_flags.mjs');
  const { readPromos } = await import('../netlify/functions/_plan.mjs');
  await mutateArtists((a) => {
    a.byId[DEFAULT_ARTIST] ||= { slug: DEFAULT_ARTIST, name: 'Founder', createdAt: 1 };
    a.byEmail['founder@example.com'] = { artistId: DEFAULT_ARTIST, role: 'owner' };
    a.byEmail['founder-band@example.com'] = { artistId: DEFAULT_ARTIST, role: 'member' };
    a.byEmail['founder-sound@example.com'] = { artistId: DEFAULT_ARTIST, role: 'crew' };
    return true;
  });
  reg = await readArtists();
  const seat = (email) => signToken(email, revOf(reg, DEFAULT_ARTIST), newSid());
  for (const [who, email] of [['member', 'founder-band@example.com'], ['crew', 'founder-sound@example.com']]) {
    const T = await seat(email);
    ok(`a ${who} seat on the founding page signs in`, (await S({ action: 'planGet' }, T)).ok);
    eq(`THE BUG: but a ${who} cannot set a feature flag`,
       (await S({ action: 'flagSet', flag: 'featuredShows', artistId: 'someone-else', on: false }, T)).status, 401);
    eq(`THE BUG: or mint a free plan`,
       (await S({ action: 'promoCreate', code: 'SEAT' + who.toUpperCase(), pct: 100, plan: 'pro', months: 60 }, T)).status, 401);
    for (const a of ['bugList', 'flagList', 'sheetStatus', 'sheetSync', 'idQueue', 'idApprove', 'idReject',
                     'promoList', 'promoRevoke', 'venueList', 'venueVerify'])
      eq(`a ${who} is refused ${a}`, (await S({ action: a }, T)).status, 401);
  }
  eq('no flag moved', ((await readFlags()).byArtist || {})['someone-else'], undefined);
  eq('no code was minted', Object.keys((await readPromos()).codes).filter((c) => c.startsWith('SEAT')), []);
  const TF = await seat('founder@example.com');
  ok('the founder’s own seat still reads the flags and mints a code',
     (await S({ action: 'flagList' }, TF)).ok && (await S({ action: 'promoCreate', code: 'FOUNDER50', pct: 50 }, TF)).ok);
  const viaKey = await admin(new Request('https://x/api/admin', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-code': process.env.ADMIN_CODE },
    body: JSON.stringify({ action: 'flagList' }) }));
  eq('and so does the recovery key', viaKey.status, 200);
}

console.log('\nEACH SEAT, EACH TAB  the owner decides (decision 0105)');
/* The founder, 2026-09-28: a stint of shows with some guys who should see and work
   the setlist on stage without read/write on the whole account. So the owner sets,
   for each seat and each Studio tab, hidden, view or edit — and the SERVER holds the
   line, not just the page. A seat nobody has touched keeps exactly its role's reach,
   which is why every member and crew check above still passes unchanged. */
{
  const revFn = (await import('../netlify/functions/revenue.mjs')).default;
  const histFn = (await import('../netlify/functions/history.mjs')).default;
  const { levelOf, reachOf, AREAS, PRESET } = await import('../netlify/functions/_session.mjs');
  const { mutateMeta } = await import('../netlify/functions/_lib.mjs');
  const R = (token, post) => hit(revFn, 'https://x/api/revenue', post ? {} : undefined, token);
  const H = (token, body) => hit(histFn, 'https://x/api/history', body, token);
  const setTab = (email, area, level, token = TO) => A({ action: 'accessSet', email, area, level }, token);
  const rowOf = async (email) => (await readArtists()).byEmail[email];

  // the presets are today's reach, so a seat nobody has touched is where it always was
  eq('a band mate reads the Money tab', (await R(TM)).status, 200);
  eq('and the book of nights', (await H(TM)).status, 200);
  eq('but moves nothing: the delivery sweep is Money edit', (await R(TM, true)).status, 403);
  eq('nor renames or hides a night', (await H(TM, { action: 'rename', show: 'nope', title: 'x' })).status, 403);
  eq('THE BUG: crew cannot read every payment and its buyer’s email', (await R(TC)).status, 403);
  eq('THE BUG: nor the book of nights', (await H(TC)).status, 403);
  eq('THE BUG: nor hide a night from the owner’s book (“Delete show”)', (await H(TC, { action: 'hide', show: 'nope' })).status, 403);
  eq('THE BUG: nor change what the room pays for a vote', (await S({ action: 'freeCredits', n: 3 }, TC)).status, 403);
  eq('the Studio is told what this seat can use', (await S({ action: 'planGet' }, TC)).access,
     { setlist: 1, gigs: 0, money: 0, merch: 0, diary: 0, messages: 0, profile: 0, settings: 0, plans: 0 });
  eq('and the owner can use everything', Object.values((await S({ action: 'planGet' }, TO)).access), AREAS.map(() => 2));

  // only the owner hands tabs out
  eq('a band mate cannot give a seat a tab', (await setTab('sound@example.com', 'money', 2, TM)).status, 403);
  eq('nor can a seat give itself one', (await setTab('sound@example.com', 'money', 2, TC)).status, 403);

  // a grant reaches the server at once — the token reads the registry row it already holds
  ok('the owner lets the sound engineer see the money', (await setTab('sound@example.com', 'money', 1)).ok);
  eq('THE POINT: and the same phone can read it now', (await R(TC)).status, 200);
  eq('but still not move it', (await R(TC, true)).status, 403);
  ok('then lets them change it too', (await setTab('sound@example.com', 'money', 2)).ok);
  eq('and a rename reaches the book (404: there is no such night, which is past the gate)',
     (await H(TC, { action: 'rename', show: 'nope', title: 'x' })).status, 404);

  // and a tab taken away is gone on the server, not just off the screen
  ok('the owner takes Merch from the band mate', (await setTab('bass@example.com', 'merch', 0)).ok);
  eq('THE POINT: who can no longer read an order', (await S({ action: 'orderList' }, TM)).status, 403);
  eq('or the shop', (await S({ action: 'merchList' }, TM)).status, 403);
  ok('Merch to view', (await setTab('bass@example.com', 'merch', 1)).ok);
  ok('reads the shop again', (await S({ action: 'merchList' }, TM)).ok);
  eq('but cannot change it', (await S({ action: 'merchSave', item: { title: 'Tee', price: 20 } }, TM)).status, 403);
  ok('Messages to view', (await setTab('bass@example.com', 'messages', 1)).ok);
  ok('reads the inbox', (await S({ action: 'msgList' }, TM)).ok);
  eq('but cannot answer it', (await S({ action: 'msgReply', id: 'nope', text: 'hi' }, TM)).status, 403);
  ok('Gigs hidden', (await setTab('bass@example.com', 'gigs', 0)).ok);
  eq('cannot read the calendar', (await S({ action: 'eventList' }, TM)).status, 403);
  ok('Settings to view', (await setTab('bass@example.com', 'settings', 1)).ok);
  eq('cannot change the free votes', (await S({ action: 'freeCredits', n: 3 }, TM)).status, 403);
  ok('while the Setlist, still theirs, still takes a song', (await S({ action: 'addSong', title: 'Tide', artist: 'R' }, TM)).ok);

  // the bounds, refused rather than quietly clamped
  eq('the Setlist cannot be hidden: the stage needs it', (await setTab('sound@example.com', 'setlist', 0)).status, 400);
  eq('Plans is never more than view', (await setTab('bass@example.com', 'plans', 2)).status, 400);
  eq('an unknown tab is refused', (await setTab('bass@example.com', 'wallet', 1)).status, 400);
  eq('and an unknown level', (await setTab('bass@example.com', 'gigs', '2')).status, 400);
  eq('the owner’s own row has no tabs to set', (await setTab('rita@example.com', 'money', 0)).status, 400);
  eq('nor does an address on nobody’s page', (await setTab('nobody@example.com', 'money', 1)).status, 400);

  // owner-only stays owner-only, whatever a seat is given
  for (const a of AREAS) await setTab('bass@example.com', a, reachOf(a).max);
  eq('every tab at its most', (await S({ action: 'planGet' }, TM)).access,
     Object.fromEntries(AREAS.map((a) => [a, reachOf(a).max])));
  for (const a of ['planChange', 'planPortal', 'payStart', 'bizGet', 'ledger', 'books', 'accountDelete',
                   'accountExport', 'promoRedeem', 'setCode', 'featureStart', 'msgBlock', 'msgReport'])
    eq('THE POINT: and still refused ' + a, (await S({ action: a, plan: 'free', country: 'US', confirm: 'DELETE',
      code: 'X', id: 'x' }, TM)).status, 403);
  eq('nor can it add a sign-in', (await A({ action: 'add', email: 'x@example.com' }, TM)).status, 403);

  // the Live poll carries no money to a seat without the Money tab
  await mutateMeta(rita, (m) => { m.tips.push({ amount: 7, at: Date.now(), note: 'for the bass player' }); return true; });
  ok('the sound engineer’s Money goes back to hidden', (await setTab('sound@example.com', 'money', 0)).ok);
  r = await hit(stageFn, 'https://x/api/stage', undefined, TC);
  ok('the crew phone still gets the show', r.ok && Array.isArray(r.songs), r.error);
  eq('THE POINT: but not the tips, their notes, or the account’s total',
     [r.tips.allTime, r.tips.recent.length, r.paid.total, r.money], [0, 0, 0, false]);
  r = await hit(stageFn, 'https://x/api/stage', undefined, TO);
  ok('while the owner’s Live tab has them', r.tips.allTime >= 7 && r.money === undefined, r.tips);

  // the team list: the owner sees the band and what each seat can use; a seat sees itself
  r = await A({ action: 'list' }, TO);
  eq('the owner’s list says what each seat can use', r.emails.find((x) => x.email === 'sound@example.com').access.money, 0);
  eq('and which levels each tab can take, so the grid never offers one accessSet refuses',
     r.tabs.filter((t) => t.min !== 0 || t.max !== 2), [{ area: 'setlist', min: 1, max: 2 }, { area: 'plans', min: 0, max: 1 }]);
  eq('a seat is not handed that grid', (await A({ action: 'list' }, TM)).tabs, undefined);
  eq('a seat is shown its own row, not everybody’s address', (await A({ action: 'list' }, TM)).emails.map((x) => x.email), ['bass@example.com']);

  // a role is a starting point: choosing one puts every tab back, and stores nothing
  ok('the owner sets the band mate back to a band mate', (await A({ action: 'roleSet', email: 'bass@example.com', role: 'member' }, TO)).ok);
  eq('every tab is the preset again', (await S({ action: 'planGet' }, TM)).access, PRESET.member);
  eq('with nothing left on the registry row', (await rowOf('bass@example.com')).access, undefined);
  ok('a tab set to what the preset already says', (await setTab('sound@example.com', 'money', 0)).ok);
  eq('stores nothing either', (await rowOf('sound@example.com')).access, undefined);

  // stored data could be anything: only an own 0, 1 or 2 is a grant
  eq('an inherited key is not a grant', levelOf('crew', Object.create({ money: 2 }), 'money'), 0);
  eq('nor a string', levelOf('crew', { money: '2' }, 'money'), 0);
  eq('and an unknown role starts from crew', levelOf('made-up-role', null, 'gigs'), 0);
  /* A sample's link (0101) looks at every tab — its Live tab shows tonight's money, as
     the demo always did — and changes none, and it never inherits crew's show. */
  const { accessOf } = await import('../netlify/functions/_session.mjs');
  eq('a sample looks at every tab', Object.values(accessOf('sample', null)), AREAS.map(() => 1));
  ok('and changes none of them, nor runs a show',
     can('sample', 'money_view') && !can('sample', 'gigs_edit') && !can('sample', 'setlist_edit') && !can('sample', 'show'));
}

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

console.log('\nAN OLD ADDRESS IS NOBODY ELSE’S  (INVARIANT 0di said so; only bySlug was checked)');
await createArtist({ email: 'mo@example.com', name: 'Mo Lane' });
reg = await readArtists();
const mo = reg.byEmail['mo@example.com'].artistId;
const TMO = await signToken('mo@example.com', revOf(reg, mo), newSid());
eq('THE BUG: another page cannot take the name her printed codes carry', (await A({ action: 'setSlug', slug: 'rita' }, TMO)).ok, false);
eq('so those codes still land on her page', await publicArtist(new Request('https://x/api/show?a=rita')), rita);
ok('she can take her own old name back', (await A({ action: 'setSlug', slug: 'rita' }, TN)).ok);
eq('and the name she left answers for her now', await publicArtist(new Request('https://x/api/show?a=ritavance')), rita);
const { pickSlug } = await import('../netlify/functions/_auth.mjs');
ok('a signup is never handed a name she left', pickSlug('Rita Vance', await readArtists()) !== 'ritavance');
eq('nor is another page', (await A({ action: 'setSlug', slug: 'ritavance' }, TMO)).ok, false);
ok('back to ritavance for the rest of this file', (await A({ action: 'setSlug', slug: 'ritavance' }, TN)).ok);

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

console.log('\nAN ACCOUNT ON ITS WAY OUT LEAVES THE INVITE LIST  (0dh, decision 0098)');
/* Settings lists who an artist has brought in. A referral who deleted their account
   stayed on it, by name and in the count, for the whole thirty days. */
{
  const { startDeletion, cancelDeletion } = await import('../netlify/functions/_account.mjs');
  const kid = (await createArtist({ email: 'kid@example.com', name: 'Kid Aldo', slug: 'kid-aldo', ref: 'ritavance' })).artistId;
  const team = async () => { const t = await A({ action: 'list' }, TN); return [t.invited, t.invitedNames]; };
  eq('rita brought Kid in', await team(), [1, ['Kid Aldo']]);
  ok('Kid deletes', (await startDeletion(kid, 'kid@example.com')).ok);
  eq('THE GAP: gone from the count and the names', await team(), [0, []]);
  ok('Undo', (await cancelDeletion(kid)).ok);
  eq('and back on the list', await team(), [1, ['Kid Aldo']]);
}

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
/* Nor one device at a time, nor "every other device" (decision 0104): the venue
   side had the same two doors open. */
{
  const V = (body, token) => hit(vauthFn, 'https://x/api/venueauth', body, token);
  const vsidO = newSid(), vsidC = newSid(), vsidC2 = newSid();
  for (const [sid, email] of [[vsidO, 'boss@bar.com'], [vsidC, 'barman@bar.com'], [vsidC2, 'barman@bar.com']])
    await addSession('v_' + bar.venueId, { sid, email, label: 'iPhone · Safari', at: Date.now() });
  const TVO1 = await signVenueToken('boss@bar.com', vRevOf(vreg, bar.venueId), vsidO);
  const TVC1 = await signVenueToken('barman@bar.com', vRevOf(vreg, bar.venueId), vsidC);
  const TVC2 = await signVenueToken('barman@bar.com', vRevOf(vreg, bar.venueId), vsidC2);
  eq('the barman sees only the barman’s own devices',
     ((await V({ action: 'sessions' }, TVC1)).list || []).map((x) => x.email), ['barman@bar.com', 'barman@bar.com']);
  eq('THE BUG: and cannot sign the owner’s phone out by its id', (await V({ action: 'sessionRevoke', sid: vsidO }, TVC1)).status, 403);
  r = await V({ action: 'signOutOthers' }, TVC1);
  ok('“Sign out our other devices” reaches only the barman’s own', r.ok && r.gone === 1, r);
  ok('THE BUG: so the owner is still in', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'get' }, TVO1)).ok);
  eq('while the barman’s other device is out', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'get' }, TVC2)).status, 401);
}
eq('and cannot delete the page', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountDelete', confirm: 'DELETE' }, TVC)).status, 403);
ok('a venue can finally take its data with it', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountExport' }, TVO)).ok);
r = await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountDelete', confirm: 'DELETE' }, TVO);
ok('and finally leave', r.ok && r.purgeAt > Date.now() + 29 * 86400e3, r);
const { venueBySlug } = await import('../netlify/functions/_venues.mjs');
eq('its page goes dark the same day', await venueBySlug((await readVenues()).byId[bar.venueId].slug), null);
ok('and undo brings it back', (await hit(vadmin, 'https://x/api/venueadmin', { action: 'accountUndelete' }, TVO)).ok);

console.log('\nA VENUE’S OLD ADDRESS KEEPS ANSWERING TOO  (it did not, until 2026-09-28)');
const vslug0 = (await readVenues()).byId[bar.venueId].slug;
ok('the owner renames the page', (await hit(vauthFn, 'https://x/api/venueauth', { action: 'setSlug', slug: 'cornerbarkp' }, TVO)).ok);
eq('the new address resolves', await venueBySlug('cornerbarkp'), bar.venueId);
eq('THE POINT: and so does every code already printed', await venueBySlug(vslug0), bar.venueId);
const bar2 = await createVenue({ email: 'rival@bar.com', name: 'Rival Bar', city: 'Koh Phangan', country: 'Thailand' });
vreg = await readVenues();
const TV2 = await signVenueToken('rival@bar.com', vRevOf(vreg, bar2.venueId), newSid());
eq('another venue cannot take the old name', (await hit(vauthFn, 'https://x/api/venueauth', { action: 'setSlug', slug: vslug0 }, TV2)).ok, false);
ok('the owner can take it back', (await hit(vauthFn, 'https://x/api/venueauth', { action: 'setSlug', slug: vslug0 }, TVO)).ok
  && await venueBySlug('cornerbarkp') === bar.venueId && await venueBySlug(vslug0) === bar.venueId);

console.log('\nA PIPE IN AN EMAIL CANNOT MOVE THE FIELDS OF A TOKEN');
const { normEmail, verifyToken } = await import('../netlify/functions/_auth.mjs');
eq('the pipe is stripped on the way in', normEmail('a|b@x.com'), 'ab@x.com');
eq('and a venue token is not an artist token', await verifyToken(TVO), null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
