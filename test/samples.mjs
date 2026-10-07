/* SAMPLE PROFILES (decision 0101) — a page built for somebody who has not asked for
   one, unpublished until they claim it.

   Pins, in order:
     · a sample is invisible to every public door: the profile, the directory, the
       share card, the QR code, the show, the photos by page name — and it is never
       a row in the registry every phone reads
     · the link is the address + #sample-profile, a label and not a secret; the
       sample door opens a page for the label only, a wrong label and an unknown
       page answer the same; the photos live under a name nobody can guess
     · its Studio opens to LOOK: the stage and a short list of reads work, every
       write answers `claim: true`, and no other endpoint lets the label in at all
     · the name it holds is skipped by a signup and by a rename; a name somebody
       has gets a word (-music, -live), never a number, inside 32 characters
     · claiming: code → ticket → password → a real account on the free plan, the
       preview gone, the page public, the password works; the founder is told
     · no remove on the page: the door erases nothing; Delete forever on the
       console erases on the spot and suppresses for good
     · the clock: taken down at thirty days into a snapshot, erased at one hundred
       and eighty, revived at the same link in between
     · the founder's console door is the founding page's owner seat only
     · venues: the same, at /v/ */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
const sentCodes = {};
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.startsWith('https://api.resend.com/')) {
    try { const b = JSON.parse(opts.body); const m = /(\d{6}) is your MySet sign-in code/.exec(b.subject || ''); if (m) sentCodes[b.to[0]] = m[1]; } catch {}
    return new Response('{}', { status: 202 });
  }
  if (u.startsWith('https://www.youtube.com/oembed')) return new Response(JSON.stringify({ title: 'Live at the Beach Bar', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }), { status: 200 });
  if (u.startsWith('https://open.spotify.com/oembed')) return new Response(JSON.stringify({ title: 'The Tide Lines' }), { status: 200 });
  if (u.startsWith('https://i.ytimg.com/')) return new Response(JPEG, { status: 200 });
  if (u.includes('/.netlify/functions/factory-background')) return new Response('', { status: 202 });
  return nativeFetch(url, opts);
};

/* a real 1×1 JPEG — the bytes decodeDataUrl and putImage accept */
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=', 'base64');

const S = await import('../netlify/functions/_sample.mjs');
const sampleFn = (await import('../netlify/functions/sample.mjs')).default;
const fanFn = (await import('../netlify/functions/fan.mjs')).default;
const directory = (await import('../netlify/functions/artists.mjs')).default;
const pageFn = (await import('../netlify/functions/artistpage.mjs')).default;
const qrFn = (await import('../netlify/functions/qr.mjs')).default;
const imgFn = (await import('../netlify/functions/img.mjs')).default;
const showFn = (await import('../netlify/functions/show.mjs')).default;
const stageFn = (await import('../netlify/functions/stage.mjs')).default;
const admin = (await import('../netlify/functions/admin.mjs')).default;
const authFn = (await import('../netlify/functions/auth.mjs')).default;
const factoryFn = (await import('../netlify/functions/factory.mjs')).default;
const venueFn = (await import('../netlify/functions/venue.mjs')).default;
const vadmin = (await import('../netlify/functions/venueadmin.mjs')).default;
const vauth = (await import('../netlify/functions/venueauth.mjs')).default;
const { readArtists, createArtist, signToken, revOf } = await import('../netlify/functions/_auth.mjs');
const { readVenues } = await import('../netlify/functions/_venues.mjs');
const { publicArtist, readDoc } = await import('../netlify/functions/_lib.mjs');
const { can } = await import('../netlify/functions/_session.mjs');
const { getProfile } = await import('../netlify/functions/_profile.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const call = async (h, url, { body, headers = {} } = {}) => {
  const hd = { 'content-type': 'application/json', ...headers };
  const r = await h(new Request(url, body === undefined ? { headers: hd } : { method: 'POST', headers: hd, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};
const door = (body) => call(sampleFn, 'https://x/api/sample', { body });

console.log('\nBUILDING ONE');
const made = await S.createSample({
  kind: 'artist', name: 'The Tide Lines', first: 'The Tide Lines', slug: 'thetidelines', city: 'Koh Phangan',
  tagline: 'Indie-folk duo from Koh Phangan', style: 'Indie folk · covers', bio: 'The Tide Lines are a duo from Koh Phangan.',
  links: { instagram: 'https://instagram.com/thetidelines', youtube: 'https://www.youtube.com/@thetidelines', tiktok: 'https://www.tiktok.com/@thetidelines',
           website: 'https://thetidelines.example', facebook: 'https://evil.example/x' },
  media: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', hero: true }],
  photos: { cover: { bytes: JPEG, type: 'image/jpeg', focus: '40% 30%', from: 'youtube', src: { yt: { id: 'dQw4w9WgXcQ', variant: 'maxresdefault' } } },
            avatar: { bytes: JPEG, type: 'image/jpeg', focus: '50% 33%', from: 'website' } },
  sources: [{ url: 'https://www.youtube.com/@thetidelines', kind: 'youtube', title: 'YouTube' }, { url: 'https://thetidelines.example', kind: 'website', title: 'Site' }],
  quality: { score: 0.93, review: false }, msgs: { hook: 'Your cover of Fast Car on the beach stopped me.' },
  seed: { line: 'The Tide Lines | @thetidelines' }, supIds: ['thetidelines', '@thetidelines'], by: 'factory' });
ok('it is made, with the address and the label for a link', made.ok && made.key === 'sample-profile' && made.link.endsWith('/thetidelines?sample-profile'), made);
const aid = made.owner, KEY = made.key;
{ // its share card (0165): the sample's own portrait when the link carries the label
  const ap = (await import('../netlify/functions/artistpage.mjs')).default;
  const og = (h, k) => ((h.match(new RegExp(`<meta [a-z]+="${k}" content="([^"]*)"`)) || [])[1]);
  const lab = await (await ap(new Request('https://myset.vip/thetidelines?sample-profile'))).text();
  ok('a labelled link shows the sample’s portrait on its share card (0165)', /^https:\/\/myset\.vip\/api\/img\?/.test(og(lab, 'og:image') || '') && og(lab, 'og:title') === 'The Tide Lines' && og(lab, 'og:url') === 'https://myset.vip/thetidelines?sample-profile', { img: og(lab, 'og:image'), t: og(lab, 'og:title'), u: og(lab, 'og:url') });
  const lab2 = await (await ap(new Request('https://myset.vip/.netlify/functions/artistpage?a=thetidelines&sample-profile'))).text();
  ok('and through the rewrite’s own query', og(lab2, 'og:title') === 'The Tide Lines');
  const bare = await (await ap(new Request('https://myset.vip/thetidelines'))).text();
  ok('the bare address keeps the plain card: no sample is shown without the label (0101)', og(bare, 'og:image') === '/icons/icon-512.png' && !/og:url/.test(bare));
}
const reg0 = await readArtists();
ok('it is NOT a row in the registry every phone reads', !reg0.byId[aid] && !reg0.bySlug.thetidelines);
const prof = await getProfile(aid);
ok('its photos live under an unguessable name, not its page name', /^\/api\/img\?a=s[a-z0-9]{10}&s=cover&v=/.test(prof.photo) && !prof.photo.includes('a=thetidelines'), prof.photo);
eq('the focus point is kept', prof.focus, { cover: '40% 30%', avatar: '50% 33%' });
eq('the new link kinds are kept, a bad host is dropped', [prof.links.youtube, prof.links.tiktok, prof.links.facebook],
   ['https://www.youtube.com/@thetidelines', 'https://www.tiktok.com/@thetidelines', '']);
ok('the video is on it, as the hero', prof.media.length === 1 && prof.media[0].hero);
ok('a factory page waits for a look while auto is off', (await S.readSampleReg()).byId[aid].st === 'review');

console.log('\nINVISIBLE TO EVERY PUBLIC DOOR');
eq('publicArtist', await publicArtist(new Request('https://x/api/profile?a=thetidelines')), null);
eq('the profile 404s', (await call(fanFn, 'https://x/api/fan?what=profile&a=thetidelines')).status, 404);
eq('the show 404s', (await call(showFn, 'https://x/api/show?a=thetidelines')).status, 404);
const dir = await call(directory, 'https://x/api/artists');
ok('the artists directory does not list it', !JSON.stringify(dir).includes('Tide Lines'));
const card = await pageFn(new Request('https://x/.netlify/functions/artistpage?a=thetidelines'));
const html = await card.text();
ok('the share card does not name it', !html.includes('Tide Lines'));
const qr = await qrFn(new Request('https://x/api/qr?k=profile&a=thetidelines'));
ok('no QR code for it', qr.status >= 400, qr.status);
eq('its cover by page name: nothing', (await imgFn(new Request('https://x/api/img?a=thetidelines&s=cover'))).status, 404);
const m = /a=(s[a-z0-9]{10})/.exec(prof.photo);
eq('its cover by its real address: served (the page needs it)', (await imgFn(new Request(`https://x/api/img?a=${m[1]}&s=cover`))).status, 200);

console.log('\nTHE SAMPLE DOOR');
let r = await door({ action: 'page', slug: 'thetidelines', key: KEY });
ok('the label opens the page, in the profile shape', r.ok && r.name === 'The Tide Lines' && r.bio.includes('duo') && Array.isArray(r.media), r);
ok('with what the banner and the notice need', r.sample && r.sample.days === 30 && r.sample.sources.map((x) => x.kind).join() === 'youtube,website', r.sample);
eq('and the focus point', r.focus, { cover: '40% 30%', avatar: '50% 33%' });
const wrong = await door({ action: 'page', slug: 'thetidelines', key: 'ABCDEFGHJKMN' });
const unknown = await door({ action: 'page', slug: 'nobody-here', key: KEY });
eq('a wrong label and an unknown page answer the same', [wrong.status, wrong.error], [unknown.status, unknown.error]);
eq('the label is read with its # and in any case', (await door({ action: 'page', slug: 'thetidelines', key: '#Sample-Profile' })).ok, true);
eq('no label, no page', (await door({ action: 'page', slug: 'thetidelines' })).status, 404);
eq('a GET is refused', (await sampleFn(new Request('https://x/api/sample'))).status, 405);
let row = (await S.readSampleReg()).byId[aid];
ok('both opens are counted, the first one timed', row.n === 2 && row.op > 0 && row.st === 'opened', row);

console.log('\nTHE STUDIO: LOOK, DON’T TOUCH');
const SH = { 'x-sample-key': KEY, 'x-admin-artist': 'thetidelines' };
r = await call(stageFn, 'https://x/api/stage', { headers: SH });
ok('the stage opens, named, with its address', r.ok && r.show.artist === 'The Tide Lines' && r.show.slug === 'thetidelines', r.show);
r = await call(admin, 'https://x/api/admin', { headers: SH, body: { action: 'planGet' } });
ok('planGet: the free plan, role sample, nothing of the owner’s', r.ok && r.plan === 'free' && r.role === 'sample' && r.until === null && !r.owner, r);
for (const a of ['eventList', 'merchList', 'diaryList', 'postList', 'msgCount', 'payStatus', 'featureList', 'pushKey'])
  ok(`read ${a}`, (await call(admin, 'https://x/api/admin', { headers: SH, body: { action: a } })).ok);
for (const a of ['addSong', 'profileSet', 'newShow', 'eventSave', 'freeCredits', 'photoUpload', 'accountDelete', 'payStart', 'planCheckout', 'mediaAdd', 'setCode', 'flagSet']) {
  const w = await call(admin, 'https://x/api/admin', { headers: SH, body: { action: a, name: 'x', title: 'x' } });
  ok(`${a} → claim to save`, w.ok === false && w.claim === true && w.status === 403, w);
}
eq('nothing was written by any of that', (await getProfile(aid)).name, 'The Tide Lines');
eq('the auth door does not take the label', (await call(authFn, 'https://x/api/auth', { headers: SH, body: { action: 'list' } })).status, 401);
eq('a wrong label is not a sample', (await call(stageFn, 'https://x/api/stage', { headers: { ...SH, 'x-sample-key': 'ABCDEFGHJKMN' } })).status, 401);
eq('the role can change nothing on its own', ['audit', 'setlist_edit', 'gigs_edit', 'money_edit'].map((c) => can('sample', c)), [false, false, false, false]);

console.log('\nTHE NAME IS HELD');
const other = await createArtist({ email: 'someone@example.com', name: 'The Tide Lines' });
ok('a signup with the same name gets the next address', other.ok && other.slug === 'thetidelines2', other);
const ot = await signToken('someone@example.com', revOf(await readArtists(), other.artistId), 'x1');
r = await call(authFn, 'https://x/api/auth', { headers: { authorization: 'Bearer ' + ot }, body: { action: 'setSlug', slug: 'thetidelines' } });
ok('and cannot rename itself onto it', !r.ok, r);
const twin = await S.createSample({ kind: 'artist', name: 'The Tide Lines', by: 'founder' });
const twin2 = await S.createSample({ kind: 'artist', name: 'The Tide Lines', by: 'founder' });
eq('a second sample of a taken name gets a word, not a number', [twin.slug, twin2.slug], ['thetidelines-music', 'thetidelines-live']);
ok('and its link reads that way', twin.link.endsWith('/thetidelines-music?sample-profile'), twin.link);
const longName = 'The Extraordinarily Long Named Band';
const ln1 = await S.createSample({ kind: 'artist', name: longName, by: 'founder' });
const ln2 = await S.createSample({ kind: 'artist', name: longName, by: 'founder' });
ok('a long name keeps its word inside 32 characters', ln2.slug.endsWith('-music') && ln2.slug.length <= 32 && ln2.slug.startsWith(ln1.slug.slice(0, 20)), [ln1.slug, ln2.slug]);
for (const x of [twin, twin2, ln1, ln2]) await S.removeSample(x.owner, { by: 'founder' });

console.log('\nTHE FOUNDER’S CONSOLE DOOR');
eq('a stranger is refused', (await call(factoryFn, 'https://x/api/factory', { body: { action: 'summary' } })).status, 401);
eq('another artist is refused', (await call(factoryFn, 'https://x/api/factory', { headers: { authorization: 'Bearer ' + ot }, body: { action: 'summary' } })).status, 401);
const F = (body) => call(factoryFn, 'https://x/api/factory', { headers: { 'x-admin-code': 'devlocal' }, body });
r = await F({ action: 'summary' });
ok('the founder sees the page, the queue, the funnel', r.ok && r.live.some((x) => x.owner === aid && x.st === 'opened') && r.stats.built >= 1, r);
r = await F({ action: 'detail', owner: aid });
ok('detail carries the link and all four drafts', r.ok && r.link.includes(KEY) && r.msgs.dm.includes(r.link) && r.msgs.email.body.includes(r.link) && r.msgs.followup.includes(r.link) && !!r.msgs.inperson, r.msgs);
ok('every draft says thirty days, and a word deletes it forever — no Remove to tap', [r.msgs.dm, r.msgs.email.body].every((t) => /30 days/.test(t) && t.includes("Don't want it? Let us know and we'll delete this preview forever – no harm, no foul!") && !/Remove/.test(t)), r.msgs.dm);
ok('the in-person words and the follow-up say it too', r.msgs.inperson.includes('delete it forever') && r.msgs.followup.includes('delete it forever') && !/Remove/.test(r.msgs.inperson + r.msgs.followup), [r.msgs.inperson, r.msgs.followup]);
ok('and where it came from', r.msgs.dm.includes('YouTube and website'), r.msgs.dm);
ok('the founder’s Open is the quiet preview address', r.preview === r.link.replace('?', '?pv=1&') && r.preview.endsWith('/thetidelines?pv=1&sample-profile'), r.preview);
const before = (await S.readSampleReg()).byId[aid].n;
await door({ action: 'page', quiet: true, slug: 'thetidelines', key: KEY });
eq('a quiet look counts nothing', (await S.readSampleReg()).byId[aid].n, before);
ok('the hook leads the DM, the band greeted the way people say it', r.msgs.dm.startsWith('Hey Tide Lines! Your cover of Fast Car'), r.msgs.dm.slice(0, 80));
r = await F({ action: 'approve', owner: aid });
r = await F({ action: 'sent', owner: aid, ch: 'dm' });
ok('marked sent', r.ok && r.row.sent > 0 && r.row.ch === 'dm', r);
r = await F({ action: 'queue', kind: 'artist', lines: ['Somebody New | @somebodynew', ''] });
ok('queue takes lines and nudges the worker', r.ok && r.added === 1 && r.started === 1, r);

console.log('\nCLAIMING');
await call(authFn, 'https://x/api/auth', { body: { action: 'start', email: 'tide@example.com' } });
const code = sentCodes['tide@example.com'];
r = await call(authFn, 'https://x/api/auth', { body: { action: 'verify', email: 'tide@example.com', code } });
ok('a new address gets a ticket', r.ok && r.needName && r.ticket, r);
const ticket = r.ticket;
eq('a weak password is refused', (await call(authFn, 'https://x/api/auth', { body: { action: 'claimSample', ticket, slug: 'thetidelines', key: KEY, password: 'short' } })).ok, false);
eq('the wrong label is refused', (await call(authFn, 'https://x/api/auth', { body: { action: 'claimSample', ticket, slug: 'thetidelines', key: 'ABCDEFGHJKMN', password: 'tide-lines-2026' } })).status, 410);
r = await call(authFn, 'https://x/api/auth', { body: { action: 'claimSample', ticket, slug: 'thetidelines', key: KEY, password: 'tide-lines-2026' } });
ok('claimed: a token, the same address', r.ok && r.token && r.slug === 'thetidelines' && r.artistId === aid, r);
const reg1 = await readArtists();
ok('one row in the registry: free plan, from a sample, their email the owner', reg1.byId[aid] && reg1.byId[aid].plan === 'free' && reg1.byId[aid].src === 'sample' && reg1.byEmail['tide@example.com'].role === 'owner', reg1.byId[aid]);
ok('the sample row is gone', !(await S.readSampleReg()).byId[aid]);
eq('the link opens no preview now: the page is theirs', (await door({ action: 'page', slug: 'thetidelines', key: KEY })).status, 404);
r = await call(fanFn, 'https://x/api/fan?what=profile&a=thetidelines');
ok('the page is public, with everything the factory made', r.ok && r.name === 'The Tide Lines' && r.media.length === 1 && r.photo.includes('a=s'), r);
r = await call(authFn, 'https://x/api/auth', { body: { action: 'passwordSignIn', email: 'tide@example.com', password: 'tide-lines-2026' } });
ok('the password signs them in', r.ok && r.artistId === aid, r);
r = await call(admin, 'https://x/api/admin', { headers: { authorization: 'Bearer ' + r.token }, body: { action: 'profileSet', tagline: 'Now it is ours' } });
ok('and the Studio saves now', r.ok, r);

console.log('\nNO REMOVE ON THE PAGE, DELETE FOREVER ON THE CONSOLE');
const b = await S.createSample({ kind: 'artist', name: 'Not Me Band', slug: 'notmeband', photos: { cover: { bytes: JPEG, type: 'image/jpeg' } }, supIds: ['@notmeband'], by: 'founder' });
const bprof = await getProfile(b.owner);
r = await door({ action: 'remove', slug: 'notmeband', key: b.key });
ok('the sample door erases nothing: anybody may know the address', r.ok !== true && !!(await S.readSampleReg()).byId[b.owner], r);
r = await F({ action: 'optout', owner: b.owner });
ok('Delete forever answers ok', r.ok, r);
eq('the link opens nothing', (await door({ action: 'page', slug: 'notmeband', key: b.key })).status, 404);
eq('the profile is erased', (await readDoc(`profile_${b.owner}`, null)).data, null);
const bm = /a=(s[a-z0-9]{10})/.exec(bprof.photo);
eq('the photo is erased', (await imgFn(new Request(`https://x/api/img?a=${bm[1]}&s=cover`))).status, 404);
ok('and they are suppressed for good', await S.isSuppressed(['@NotMeBand']));
ok('a stranger is not', !(await S.isSuppressed(['@someoneelse'])));

console.log('\nTHE CLOCK');
const c = await S.createSample({ kind: 'artist', name: 'Quiet Band', slug: 'quietband',
  photos: { cover: { bytes: JPEG, type: 'image/jpeg', src: { yt: { id: 'dQw4w9WgXcQ', variant: 'maxresdefault' } } }, p0: { bytes: JPEG, type: 'image/jpeg' } }, by: 'founder' });
let sw = await S.sweepSamples(Date.now());
eq('nothing is due yet', sw.archived, []);
sw = await S.sweepSamples(Date.now() + 31 * 86400e3);
eq('at thirty days it is taken down', sw.archived, [c.owner]);
eq('the page is gone', (await door({ action: 'page', slug: 'quietband', key: c.key })).status, 404);
const snap = (await readDoc(`samplearc_${c.owner}`, null)).data;
ok('a snapshot is kept: the YouTube frame as a reference, the other photo as bytes',
   snap && snap.images.find((i) => i.slot === 'cover').yt && !snap.images.find((i) => i.slot === 'cover').b64 && !!snap.images.find((i) => i.slot === 'p0').b64, snap && snap.images);
ok('the address is free again', !(await S.readSampleReg()).bySlug.quietband);
r = await F({ action: 'revive', owner: c.owner });
ok('revived at the same link', r.ok && r.link && r.link.endsWith('/quietband?sample-profile'), r);
r = await door({ action: 'page', slug: 'quietband', key: c.key });
ok('the page is back, the YouTube frame fetched again', r.ok && r.photo && (r.photos || []).length === 1 && r.sample.cp === 2, r);
const e = await S.createSample({ kind: 'artist', name: 'Echo Band', by: 'founder' });
await S.sweepSamples(Date.now() + 31 * 86400e3);
const echo = await createArtist({ email: 'echo@example.com', name: 'Echo Band' });
ok('a signup takes the address while the snapshot waits', echo.ok && echo.slug === 'echoband', echo);
r = await F({ action: 'revive', owner: e.owner });
ok('the revive gets a word after the name instead', r.ok && r.link.endsWith('/echoband-music?sample-profile'), r);
const d = await S.createSample({ kind: 'artist', name: 'Old Band', slug: 'oldband', by: 'founder' });
await S.sweepSamples(Date.now() + 31 * 86400e3);
ok('in the archive', !!(await S.readArchive())[d.owner]);
sw = await S.sweepSamples(Date.now() + 31 * 86400e3 + 181 * 86400e3);
ok('at one hundred and eighty days the snapshot is erased too', sw.erased.includes(d.owner) && !(await readDoc(`samplearc_${d.owner}`, null)).data, sw);

console.log('\nSUGGESTED SONGS  into the sample’s song list (decision 0167)');
const SONGS = { country: 'Thailand',
  songs: [...Array.from({ length: 19 }, (_, i) => ({ title: `Tune ${i + 1}`, artist: `Singer ${i + 1}`, group: i < 10 ? 'world' : 'home' })),
    { title: 'Tune 1', artist: 'Singer 1', group: 'home' }] };
const sg = await S.createSample({ kind: 'artist', name: 'Song Band', slug: 'songband', songs: SONGS, by: 'founder' });
let shw = (await readDoc(`show_${sg.owner}`, null)).data;
eq('the songs are in the library, in order, a song twice kept once', shw.songs.map((x) => x.title), Array.from({ length: 19 }, (_, i) => `Tune ${i + 1}`));
ok('each row shaped as addSong makes one: an id, on, no key, no tags', shw.songs.every((x) => x.id && x.active === true && x.key === '' && Array.isArray(x.tags) && x.tags.length === 0)
   && new Set(shw.songs.map((x) => x.id)).size === 19, shw.songs[0]);
r = await door({ action: 'page', slug: 'songband', key: sg.key });
ok('the page shows them: "On the setlist"', r.ok && r.songs === 19 && (r.setlist || []).length === 10, { songs: r.songs, setlist: r.setlist });
ok('the record keeps them, with the country, for a revive', ((await readDoc(`sample_${sg.owner}`, null)).data.songs || {}).country === 'Thailand');
ok('a sample asked for none has an empty song list', ((await readDoc(`show_${c.owner}`, null)).data || { songs: [] }).songs.length === 0);
await S.sweepSamples(Date.now() + 31 * 86400e3);
r = await F({ action: 'revive', owner: sg.owner });
shw = (await readDoc(`show_${r.owner || sg.owner}`, null)).data;
ok('revived: the songs come back with it', r.ok && shw && shw.songs.length === 19, r);

console.log('\nVENUES');
const v = await S.createSample({ kind: 'venue', name: 'Harbour Bar', slug: 'harbourbar', city: 'Koh Phangan', country: 'Thailand',
  tagline: 'Live music by the pier', about: 'A bar by the pier.', links: { instagram: 'https://instagram.com/harbourbar' },
  photos: { cover: { bytes: JPEG, type: 'image/jpeg' } }, menuUrl: 'https://harbourbar.example/menu', by: 'founder' });
ok('a venue sample is made at /v/', v.ok && v.link.endsWith('/v/harbourbar?sample-profile'), v);
const vtwin = await S.createSample({ kind: 'venue', name: 'Harbour Bar', city: 'Koh Samui', by: 'founder' });
eq('a second venue of a taken name gets a word', vtwin.slug, 'harbourbar-live');
await S.removeSample(vtwin.owner, { by: 'founder' });
ok('not in the venue registry', !(await readVenues()).bySlug.harbourbar);
eq('the public venue page 404s', (await call(venueFn, 'https://x/api/venue?v=harbourbar')).status, 404);
r = await door({ action: 'page', kind: 'venue', slug: 'harbourbar', key: v.key });
ok('the label opens it, in the venue shape', r.ok && r.venue && r.venue.name === 'Harbour Bar' && r.venue.slug === 'harbourbar', r);
eq('the menu the generator found is the page’s Menu door', r.venue.menu && r.venue.menu.url, 'https://harbourbar.example/menu');
ok('NO HOURS FOUND, NONE SHOWN (0132): not the template’s 5 pm to 1 am', r.venue.hours.every((h) => h.closed), r.venue.hours);
eq('no rating until one is read', r.venue.rating, null);
eq('an artist-kind request for it finds nothing', (await door({ action: 'page', slug: 'harbourbar', key: v.key })).status, 404);
const VH = { 'x-sample-key': v.key, 'x-sample-venue': 'harbourbar' };
r = await call(vadmin, 'https://x/api/venueadmin', { headers: VH, body: { action: 'get' } });
ok('the Venue Studio opens to look', r.ok && r.venue.name === 'Harbour Bar' && r.venue.slug === 'harbourbar', r);
r = await call(vadmin, 'https://x/api/venueadmin', { headers: VH, body: { action: 'set', name: 'Hacked' } });
ok('and a save is a claim', r.claim === true && r.status === 403, r);
await call(vauth, 'https://x/api/venueauth', { body: { action: 'start', email: 'harbour@example.com' } });
r = await call(vauth, 'https://x/api/venueauth', { body: { action: 'verify', email: 'harbour@example.com', code: sentCodes['harbour@example.com'] } });
r = await call(vauth, 'https://x/api/venueauth', { body: { action: 'claimSample', ticket: r.ticket, slug: 'harbourbar', key: v.key, password: 'harbour-bar-2026' } });
ok('a venue claims it', r.ok && r.token && r.slug === 'harbourbar', r);
ok('now a venue row on the free plan', (await readVenues()).byId[v.owner.slice(2)].plan === 'free');
eq('and public', (await call(venueFn, 'https://x/api/venue?v=harbourbar')).ok, true);

console.log('\nSTOP');
const st = await S.createSample({ kind: 'artist', name: 'Stop Band', slug: 'stopband', supIds: ['@stopband'], by: 'founder' });
r = await F({ action: 'optout', owner: st.owner });
ok('a "stop" from the founder erases the live page and suppresses them', r.ok && !(await S.readSampleReg()).byId[st.owner] && await S.isSuppressed(['@stopband']), r);
const st2 = await S.createSample({ kind: 'artist', name: 'Later Band', slug: 'laterband', supIds: ['@laterband'], by: 'founder' });
await S.sweepSamples(Date.now() + 31 * 86400e3);
r = await F({ action: 'optout', owner: st2.owner });
ok('and after it came down, the copy kept for a second campaign goes too', r.ok && !(await readDoc(`samplearc_${st2.owner}`, null)).data && !(await S.readArchive())[st2.owner] && await S.isSuppressed(['@laterband']), r);

console.log('\nUNDO A CLAIM');
r = await F({ action: 'undoClaim', owner: aid });
ok('a claim whose window the sweep has closed stays claimed', r.ok === false && !!(await readArtists()).byId[aid], r);
const u = await S.createSample({ kind: 'artist', name: 'Undo Band', slug: 'undoband', by: 'founder' });
await call(authFn, 'https://x/api/auth', { body: { action: 'start', email: 'undo@example.com' } });
r = await call(authFn, 'https://x/api/auth', { body: { action: 'verify', email: 'undo@example.com', code: sentCodes['undo@example.com'] } });
r = await call(authFn, 'https://x/api/auth', { body: { action: 'claimSample', ticket: r.ticket, slug: 'undoband', key: u.key, password: 'undo-band-2026' } });
ok('another claim', r.ok && r.artistId === u.owner, r);
r = await F({ action: 'summary' });
ok('a finished claim stays on the console for the undo window', (r.claimed || []).some((c) => c.owner === u.owner && c.slug === 'undoband' && c.until > Date.now()), r.claimed);
r = await F({ action: 'undoClaim', owner: u.owner });
ok('the founder can put a claim back within fourteen days', r.ok && r.emails.includes('undo@example.com'), r);
ok('the account is gone from the registry', !(await readArtists()).byId[u.owner]);
const back = (await S.readSampleReg()).byId[u.owner];
ok('the sample is back, at the same link', back && back.st === 'ready' && back.slug === 'undoband', back);
ok('and it leaves the claimed list', !((await F({ action: 'summary' })).claimed || []).some((c) => c.owner === u.owner));
await call(authFn, 'https://x/api/auth', { body: { action: 'start', email: 'undo2@example.com' } });
r = await call(authFn, 'https://x/api/auth', { body: { action: 'verify', email: 'undo2@example.com', code: sentCodes['undo2@example.com'] } });
r = await call(authFn, 'https://x/api/auth', { body: { action: 'claimSample', ticket: r.ticket, slug: 'undoband', key: u.key, password: 'undo-band-2026' } });
ok('the same link claims it again', r.ok && r.artistId === u.owner, r);
sw = await S.sweepSamples(Date.now() + 15 * 86400e3);
ok('fourteen days on, the sweep closes the undo window', sw.closed.includes(u.owner) && !((await S.readSampleReg()).claimed || {})[u.owner]
  && !(await readDoc(`sample_${u.owner}`, null)).data.claimedRow, sw);
r = await F({ action: 'undoClaim', owner: u.owner });
ok('and a late undo has nothing to put back', r.ok === false && !!(await readArtists()).byId[u.owner], r);
const uv = await S.createSample({ kind: 'venue', name: 'Undo Bar', slug: 'undobar', city: 'Koh Phangan', by: 'founder' });
await call(vauth, 'https://x/api/venueauth', { body: { action: 'start', email: 'undobar@example.com' } });
r = await call(vauth, 'https://x/api/venueauth', { body: { action: 'verify', email: 'undobar@example.com', code: sentCodes['undobar@example.com'] } });
r = await call(vauth, 'https://x/api/venueauth', { body: { action: 'claimSample', ticket: r.ticket, slug: 'undobar', key: uv.key, password: 'undo-bar-2026' } });
ok('a venue claim', r.ok && r.slug === 'undobar', r);
r = await F({ action: 'undoClaim', owner: uv.owner });
ok('is put back the same way', r.ok && r.emails.includes('undobar@example.com') && !(await readVenues()).byId[uv.owner.slice(2)]
  && (await S.readSampleReg()).byId[uv.owner].st === 'ready', r);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
