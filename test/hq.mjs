/* MYSET CRM — the founder's outreach desk and its CRM (decisions 0108, 0109), run end to
   end on the in-memory store with no network: the factory's worker is played by a
   fake build, Google by a fake fetch.

   Pins, in order: a link typed as a handle becomes the address the factory and the
   page want, and a wrong one is named; the seed never carries an email, a phone or a
   note; only the founding page's owner seat opens the door; Generate makes a contact,
   queues one build carrying it and follows the same build on a second tap; a finished
   build links its contact and teaches it the handles the factory found; a contact's
   stage is read off the page every time (lead, building, review, shared, claimed,
   archived); a logged message marks the page Sent once, sets the follow-up, and a reply
   clears it; tags are tidy; pages the old console built are adopted, and a contact
   deleted on purpose is not adopted back; Cancel page leaves a lead; Delete forever —
   from CRM or from the old console — erases the page AND the contact and suppresses
   them, page or no page; Edit profile writes canonical links, names the refused ones
   and edits videos; a rebuild keeps the seed's fields. And the passcode (INVARIANT
   0hk): nothing opens without it, even for the owner seat; only the owner seat can
   try it; five wrong tries shut the door; the proof is a signed cookie that a new
   passcode, another account or an old expiry cannot use; no hash is written anywhere
   in the repository. And the page's two themes: every colour that is text keeps 4.5:1
   in both, every wash is mixed from --hi, and the kept theme is set before the first
   paint. And the message library (decision 0117): eight openers until the first save,
   saved whole and tidied, and a message sent from one remembers which, and which ending.

   Run: node --import ./test/register.mjs test/hq.mjs */
process.env.ADMIN_CODE = 'devlocal';
process.env.URL = 'https://hq.test';
process.env.MYSET_DOUBLE_TAP_MS = '0';
process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
delete process.env.GMAIL_CLIENT_ID; delete process.env.GMAIL_CLIENT_SECRET;
const L = await import('../netlify/functions/_hqlock.mjs');
const PASS = 'correct horse ' + Math.random().toString(36).slice(2);   // made fresh each run, never written down
process.env.HQ_PASSCODE = await L.hashPasscode(PASS);

const knocks = [];
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url);
  if (u.includes('/.netlify/functions/factory-background')) { knocks.push(JSON.parse(opts.body).id); return new Response('', { status: 202 }); }
  if (u.startsWith('https://api.resend.com/')) return new Response('{}', { status: 202 });
  if (u.startsWith('https://www.youtube.com/oembed')) return new Response(JSON.stringify({ title: 'Live at the Beach Bar', thumbnail_url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' }), { status: 200 });
  if (u.startsWith('https://open.spotify.com/oembed')) return new Response(JSON.stringify({ title: 'Salt and Sand' }), { status: 200 });
  return nativeFetch(url, opts);
};

const C = await import('../netlify/functions/_crm.mjs');
const S = await import('../netlify/functions/_sample.mjs');
const BG = await import('../netlify/functions/factory-background.mjs');
const hqFn = (await import('../netlify/functions/hq.mjs')).default;
const factoryFn = (await import('../netlify/functions/factory.mjs')).default;
const { readDoc, casDoc, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { createArtist, signToken } = await import('../netlify/functions/_auth.mjs');
const { getProfile } = await import('../netlify/functions/_profile.mjs');
const { getVenueProfile } = await import('../netlify/functions/_venues.mjs');
const { getImage, putImage } = await import('../netlify/functions/_img.mjs');
const { mutateVenueProfile } = await import('../netlify/functions/_venues.mjs');
const { suppressIds } = await import('../netlify/functions/_factory.mjs');
const { parseSeed } = await import('../netlify/functions/_fsrc.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const call = async (h, url, { body, headers = {} } = {}) => {
  const hd = { 'content-type': 'application/json', ...headers };
  const r = await h(new Request(url, body === undefined ? { headers: hd } : { method: 'POST', headers: hd, body: JSON.stringify(body) }));
  const t = await r.text();
  const cookie = r.headers.get('set-cookie') || '';
  try { return { status: r.status, cookie, ...JSON.parse(t) }; } catch { return { status: r.status, cookie, raw: t }; }
};
let JAR = '';   // the unlock cookie, as a browser would send it back
const H = (body, jar = JAR) => call(hqFn, 'https://hq.test/api/hq', { headers: { 'x-admin-code': 'devlocal', ...(jar ? { cookie: jar } : {}) }, body });
const F = (body) => call(factoryFn, 'https://hq.test/api/factory', { headers: { 'x-admin-code': 'devlocal' }, body });
const rowOf = async (cid) => ((await H({ action: 'summary' })).contacts || []).find((x) => x.cid === cid);
const DAY = 86400e3;

/* The factory's worker, played: stages move, then a payload the way _factory.mjs makes one. */
function fakeBuild({ found = {}, review = true } = {}) {
  return async (job, opts) => {
    const s = job.seed || {};
    // the real runJob asks the suppression list first, with the seed's identifiers
    if (opts.isSuppressed && await opts.isSuppressed(suppressIds(parseSeed(s.line || '')))) return { ok: false, skipped: 'suppressed', usage: [] };
    await opts.onStage('discover', 20); await opts.onStage('copy', 90);
    return { ok: true, usage: [], payload: {
      kind: job.kind, name: s.name || 'Somebody', slug: '', city: s.city || '', country: s.country || '', tagline: 'Songs for the golden hour', style: 'Indie folk', bio: 'They play the beach bars every weekend.',
      links: { ...(s.links || {}), ...found }, media: [], photos: {}, sources: [{ url: 'https://example.com', kind: 'website', title: 'Site' }],
      facts: null, provenance: null, quality: { score: 0.9, review }, msgs: { hook: '' }, seed: { ...s }, supIds: suppressIds(parseSeed(s.line || '')), by: 'factory' } };
  };
}
BG.deps.run = fakeBuild();

console.log('\nLINKS AS THE FOUNDER TYPES THEM');
eq('an Instagram handle', C.canonLink('instagram', '@TheTideLines'), 'https://www.instagram.com/thetidelines/');
eq('an Instagram address', C.canonLink('instagram', 'instagram.com/thetidelines?igsh=abc'), 'https://www.instagram.com/thetidelines/');
eq('a TikTok handle is not read as Instagram', C.canonLink('tiktok', '@tidelines.music'), 'https://www.tiktok.com/@tidelines.music');
eq('a YouTube handle', C.canonLink('youtube', '@thetidelines'), 'https://www.youtube.com/@thetidelines');
eq('a YouTube video in the YouTube box is kept', C.canonLink('youtube', 'https://youtu.be/dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
eq('a Facebook page name', C.canonLink('facebook', 'tidelinesband'), 'https://www.facebook.com/tidelinesband');
eq('a website without https', C.canonLink('website', 'thetidelines.com'), 'https://thetidelines.com/');
eq('a Spotify artist', C.canonLink('spotify', 'https://open.spotify.com/intl-de/artist/4tIdEl1nEs0123456789ab?si=x'), 'https://open.spotify.com/artist/4tIdEl1nEs0123456789ab');
eq('an Instagram address in the TikTok box is refused', C.canonLink('tiktok', 'https://instagram.com/thetidelines'), '');
eq('a Google Maps link', C.canonLink('google', 'https://maps.app.goo.gl/AbCdEf123').startsWith('https://maps.app.goo.gl/'), true);
eq('an email is tidied', C.cleanEmail('  Rita@Band.COM '), 'rita@band.com');
eq('a broken email is nothing', C.cleanEmail('rita@band'), '');
eq('a phone keeps what a dialler reads', C.cleanPhone('+66 (81) 234-5678 ext'), '+66 (81) 234-5678');
eq('tags: tidy, no twins, at most twelve', C.normTags(['Friend', 'friend', ' Koh  Phangan ', '<b>', 'x'.repeat(40), ...'abcdefghijklmnop'.split('')]).length, 12);
eq('a tag keeps its case and loses its markup characters', C.normTags(['Koh  Phangan', '<b>jazz</b>']), ['Koh Phangan', 'bjazz/b']);
{
  const { out, dropped } = C.normFields('artist', { name: ' Rita  Mae ', city: 'Koh Phangan', links: { instagram: '@ritamae', tiktok: 'instagram.com/nope', website: 'ritamae.com' },
    email: 'rita@x.com', phone: '12', note: 'met at the full moon party', tags: ['friend'] });
  eq('the form: canonical links, and the refused ones named', [out.links.instagram, out.links.tiktok, out.links.website, dropped], ['https://www.instagram.com/ritamae/', '', 'https://ritamae.com/', ['tiktok', 'phone']]);
  const seed = C.seedFrom('artist', out);
  ok('THE SEED NEVER CARRIES AN EMAIL, A PHONE OR A NOTE', !JSON.stringify(seed).includes('rita@x.com') && !JSON.stringify(seed).includes('full moon') && seed.line === 'Rita Mae | Koh Phangan | https://www.instagram.com/ritamae/ | https://ritamae.com/', seed);
  const p = parseSeed(seed.line);
  eq('and the line reads back the same', [p.name, p.city, p.handles.ig], ['Rita Mae', 'Koh Phangan', 'ritamae']);
}

console.log('\nTHE DOOR');
eq('a stranger is refused', (await call(hqFn, 'https://hq.test/api/hq', { body: { action: 'summary' } })).status, 401);
const other = await createArtist({ name: 'Other Act', email: 'other@example.com' });
const ot = await signToken({ artistId: other.artistId, email: 'other@example.com', role: 'owner' });
eq('another artist is refused', (await call(hqFn, 'https://hq.test/api/hq', { headers: { authorization: 'Bearer ' + ot }, body: { action: 'summary' } })).status, 401);
let r = await H({ action: 'summary' });
eq('the founder without the passcode gets the lock, and nothing else', [r.status, r.ok, r.error, r.ready, r.until, r.contacts], [401, false, 'locked', true, 0, undefined]);
eq('a stranger cannot even try the passcode', (await call(hqFn, 'https://hq.test/api/hq', { body: { action: 'unlock', code: PASS } })).status, 401);
eq('nor can another artist', (await call(hqFn, 'https://hq.test/api/hq', { headers: { authorization: 'Bearer ' + ot }, body: { action: 'unlock', code: PASS } })).error, 'unauthorized');
r = await H({ action: 'unlock', code: PASS });
ok('the right passcode opens it for twelve hours', r.status === 200 && r.ok && r.until > Date.now() + (L.UNLOCK_HOURS * 3600e3 - 60e3), r);
ok('with a cookie a page script cannot read, sent to CRM’s API alone', /^hqk=\d+\.[\w-]{40,}; Path=\/api\/hq; Max-Age=43200; HttpOnly; SameSite=Strict; Secure$/.test(r.cookie), r.cookie);
JAR = r.cookie.split(';')[0];
r = await H({ action: 'summary' });
ok('the founder gets the desk: keys, Gmail, today, the month, contacts, tags', r.ok && r.keys && r.gmail && r.today && r.month && Array.isArray(r.contacts) && Array.isArray(r.tags), r);
eq('Gmail is not ready without the Google client', [r.gmail.ready, r.gmail.connected], [false, false]);
eq('a GET to the door is refused', (await call(hqFn, 'https://hq.test/api/hq', { headers: { 'x-admin-code': 'devlocal' } })).status, 405);

console.log('\nTHE PASSCODE (INVARIANT 0hk)');
{
  const pin = (x) => [x.status, x.error];
  eq('another artist’s copy of the cookie opens nothing', (await call(hqFn, 'https://hq.test/api/hq', { headers: { authorization: 'Bearer ' + ot, cookie: JAR }, body: { action: 'summary' } })).status, 401);
  const [exp, sig] = JAR.slice(4).split('.');
  eq('a cookie with a changed expiry opens nothing', pin(await H({ action: 'summary' }, `hqk=${Number(exp) + 1000}.${sig}`)), [401, 'locked']);
  eq('nor one with a changed signature', pin(await H({ action: 'summary' }, `hqk=${exp}.${sig.slice(0, -2)}AA`)), [401, 'locked']);
  const { header: stale } = await L.unlockCookie(DEFAULT_ARTIST, { now: Date.now() - (L.UNLOCK_HOURS * 3600e3 + 1000) });
  eq('nor an unlock twelve hours old', pin(await H({ action: 'summary' }, stale.split(';')[0])), [401, 'locked']);
  const { header: far } = await L.unlockCookie(DEFAULT_ARTIST, { now: Date.now() + 86400e3 });
  eq('nor one that says it lasts longer than twelve hours', pin(await H({ action: 'summary' }, far.split(';')[0])), [401, 'locked']);
  r = await H({ action: 'lock' });
  ok('Lock clears the cookie', r.ok && /^hqk=; Path=\/api\/hq; Max-Age=0; HttpOnly; SameSite=Strict; Secure$/.test(r.cookie), r.cookie);
  const tries = [];
  for (let i = 0; i < L.LOCK_TRIES - 1; i++) { const x = await H({ action: 'unlock', code: 'guess ' + i }, ''); tries.push([x.status, x.error, x.left, !!x.cookie]); }
  eq('a wrong passcode says how many tries are left, and sets no cookie', tries, [[401, 'wrong', 4, false], [401, 'wrong', 3, false], [401, 'wrong', 2, false], [401, 'wrong', 1, false]]);
  const fifth = await H({ action: 'unlock', code: 'guess 4' }, '');
  eq('the fifth shuts the door', [fifth.status, fifth.error, !!fifth.cookie], [429, 'locked-out', false]);
  let x = await H({ action: 'summary' }, '');
  ok('and a locked CRM says until when', x.status === 401 && x.error === 'locked' && x.until > Date.now() + (L.LOCK_MINUTES * 60e3 - 60e3), x);
  x = await H({ action: 'unlock', code: PASS }, '');
  ok('while it is shut, even the right passcode waits', x.status === 429 && x.error === 'locked-out' && !x.cookie, x);
  eq('Lock is per browser: another browser that was already open stays open', (await H({ action: 'summary' })).ok, true);
  await casDoc(L.LOCK_DOC, () => ({}), (d) => { d.until = Date.now() - 1; return true; });
  x = await H({ action: 'unlock', code: PASS }, '');
  ok('after the wait, the right passcode opens it and forgets the wrong ones', x.ok && x.cookie && !(await readDoc(L.LOCK_DOC, null)).data.fails, x);
  JAR = x.cookie.split(';')[0];
  await casDoc(L.LOCK_DOC, () => ({}), (d) => { d.fails = 4; d.last = Date.now() - (L.LOCK_MINUTES * 60e3 + 1000); return true; });
  x = await H({ action: 'unlock', code: 'typo' }, '');
  eq('wrong tries older than the lock window are forgotten', [x.error, x.left], ['wrong', L.LOCK_TRIES - 1]);
  await H({ action: 'unlock', code: PASS }, '');
  eq('a right one clears the count', (await readDoc(L.LOCK_DOC, null)).data.fails, 0);
  eq('on plain http (this machine) the cookie drops Secure, or no browser would keep it',
    (await call(hqFn, 'http://localhost:8950/api/hq', { headers: { 'x-admin-code': 'devlocal' }, body: { action: 'unlock', code: PASS } })).cookie.endsWith('SameSite=Strict'), true);

  const keep = process.env.HQ_PASSCODE;
  process.env.HQ_PASSCODE = await L.hashPasscode('a new one');
  eq('a new passcode locks every open CRM', pin(await H({ action: 'summary' })), [401, 'locked']);
  eq('and the old passcode no longer opens it', (await H({ action: 'unlock', code: PASS }, '')).error, 'wrong');
  delete process.env.HQ_PASSCODE;
  x = await H({ action: 'summary' });
  eq('with no passcode set (a deploy preview) CRM stays shut and says why', [x.status, x.error, x.ready], [401, 'locked', false]);
  x = await H({ action: 'unlock', code: PASS }, '');
  eq('and nothing unlocks it', [x.status, x.ok, x.ready, !!x.cookie], [401, false, false, false]);
  for (const bad of ['', 'a plain passcode', 'scrypt$1024$8$1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g', 'scrypt$1073741824$8$1$c2FsdHNhbHRzYWx0c2FsdA$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g']) {
    process.env.HQ_PASSCODE = bad;
    ok(`a value that is not a sound hash is no passcode (${bad.slice(0, 18) || 'empty'})`, !L.ready() && (await H({ action: 'unlock', code: bad }, '')).ready === false, bad);
  }
  process.env.HQ_PASSCODE = keep;
  x = await H({ action: 'unlock', code: PASS }, '');
  JAR = x.cookie.split(';')[0];
  ok('the passcode is back and CRM opens', (await H({ action: 'summary' })).ok, x);

  const t0 = Date.now(); await L.checkPasscode('timing');
  ok('a try costs a real hash (scrypt), not a string compare', Date.now() - t0 >= 15, Date.now() - t0);
  /* the repository is public: no passcode hash may be written into it, only into Netlify */
  const { execSync } = await import('node:child_process');
  const hits = execSync("git grep --untracked -I -l -E 'scrypt\\$[0-9]+\\$[0-9]+\\$[0-9]+\\$[A-Za-z0-9_-]{16,}\\$[A-Za-z0-9_-]{32,}' -- . ':!test/hq.mjs' || true", { encoding: 'utf8' }).trim();
  eq('no passcode hash is in the repository', hits, '');
}

console.log('\nGENERATE');
r = await H({ action: 'generate', kind: 'artist', fields: { name: 'The Tide Lines', city: 'Koh Phangan', country: 'Thailand',
  links: { instagram: '@thetidelines', youtube: '@thetidelines', tiktok: 'nope.example.com/x' }, email: 'tide@example.com', phone: '+66 81 234 5678', tags: ['Beach', 'priority'], note: 'Saw them at Sunset Bar' } });
ok('a contact and a build', r.ok && C.validCid(r.cid) && r.job && r.job.id, r);
eq('the refused link is named', r.dropped, ['tiktok']);
const tide = r.cid, tideJob = r.job.id;
ok('the worker was knocked for it', knocks.includes(tideJob), knocks);
let q = (await readDoc('factoryq', null)).data;
let j = q.jobs.find((x) => x.id === tideJob);
ok('the job carries the contact and the form’s fields', j.cid === tide && j.seed.name === 'The Tide Lines' && j.seed.city === 'Koh Phangan' && j.seed.links.instagram === 'https://www.instagram.com/thetidelines/', j);
ok('and nothing private', !JSON.stringify(j).includes('tide@example.com') && !JSON.stringify(j).includes('Sunset Bar') && !JSON.stringify(j).includes('234 5678'), j.seed);
eq('twenty suggested songs are asked for unless the box is unticked (0167)', j.seed.songs, true);
r = await H({ action: 'generate', cid: tide, fields: {} });
eq('a second tap follows the same build', r.job && r.job.id, tideJob);
{
  /* PHOTOS UPLOADED IN THE FORM (0166): kept under a name nobody can guess, handed back
     as an address, and carried to the factory with the photo links */
  const jpg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]).toString('base64');
  const up = await H({ action: 'stagePhoto', data: jpg });
  const m = /^https:\/\/hq\.test\/api\/img\?a=(s[a-z0-9]{10})&s=p0&v=\w+$/.exec(up.url || '');
  ok('an uploaded photo comes back as an address under an unguessable name', up.ok && !!m, up);
  const { getImage } = await import('../netlify/functions/_img.mjs');
  ok('and its bytes are kept', m && (await getImage(m[1], 'p0')).bytes.length === 404);
  eq('a file that is not a picture is refused', (await H({ action: 'stagePhoto', data: 'data:image/jpeg;base64,' + Buffer.from('not a picture').toString('base64') })).ok, false);
  const r2 = await H({ action: 'generate', kind: 'artist', songs: false, fields: { name: 'Upload Band', links: { instagram: '@uploadband' }, photos: [up.url, 'https://img.test/a.jpg', up.url.replace('a=s', 'a=t'), 'https://img.test/b.jpg', 'https://img.test/c.jpg', 'https://img.test/d.jpg', 'https://img.test/e.jpg'] } });
  const j2 = (await readDoc('factoryq', null)).data.jobs.find((x) => x.id === r2.job.id);
  ok('uploads ride with the links to the factory, six at most', j2.seed.photos[0] === up.url && j2.seed.photos.length === 6, j2.seed.photos);
  ok('unticked: no songs asked for', !j2.seed.songs, j2.seed);
}
r = await H({ action: 'generate', kind: 'artist', fields: { name: 'Tide Lines Again', links: { instagram: 'instagram.com/thetidelines' } } });
eq('the same Instagram is a duplicate, and says which', [r.ok, r.error, r.cid], [false, 'duplicate', tide]);
r = await H({ action: 'generate', kind: 'artist', fields: { city: 'Nowhere' } });
eq('nothing to build from is refused', r.ok, false);
let row = await rowOf(tide);
eq('it shows as building', [row.stage, row.kind, row.has], ['building', 'artist', { email: true, phone: true, ig: true, tiktok: false, fb: false }]);
r = await H({ action: 'job', id: tideJob });
ok('the job answers while it runs', r.ok && ['queued', 'running'].includes(r.job.st) && !r.preview, r);

BG.deps.run = fakeBuild({ found: { tiktok: 'https://www.tiktok.com/@thetidelines', facebook: 'https://www.facebook.com/thetidelines' } });
eq('the worker builds it', await BG.work(tideJob), 'done');
let doc = await C.readContact(tide);
ok('THE CONTACT NOW POINTS AT THE PAGE', !!doc.owner && (await S.readSampleReg()).byId[doc.owner], doc);
eq('and learned the handles the factory found', [doc.links.tiktok, doc.links.facebook], ['https://www.tiktok.com/@thetidelines', 'https://www.facebook.com/thetidelines']);
const tideOwner = doc.owner;
r = await H({ action: 'job', id: tideJob });
ok('done: a quiet preview to view, and it waits for a look', r.job.st === 'done' && r.preview.endsWith('?pv=1&sample-profile') && r.link.endsWith('?sample-profile') && r.review === true, r);
row = await rowOf(tide);
eq('its stage is read off the page: Needs review', [row.stage, !!row.link, row.exp > Date.now()], ['review', true, true]);

console.log('\nTHE CONTACT, AND WHAT IT SHOWS');
r = await H({ action: 'contact', cid: tide });
ok('the contact, its page and the drafts', r.ok && r.contact.email === 'tide@example.com' && r.page && r.page.state === 'review' && r.page.preview && r.drafts && r.drafts.dm.includes('?sample-profile'), r.page);
eq('the note is private: on the contact', r.contact.notes.map((n) => n.text), ['Saw them at Sunset Bar']);
r = await H({ action: 'update', cid: tide, fields: { tags: ['beach', 'Priority', 'jazz'], star: true, fu: Date.now() + 2 * DAY, email: 'not an email', links: { instagram: '@tidelinesofficial' } } });
ok('an edit: tidy tags, the star, the follow-up', r.ok && r.row.star && r.row.tags.join() === 'beach,Priority,jazz' && r.row.fu > Date.now(), r.row);
eq('a broken email is named, not saved over the good one', [r.dropped, (await C.readContact(tide)).email], [['email'], 'tide@example.com']);
eq('the new handle finds them, the old one no longer does', [(await C.readCrm()).byKey['ig:tidelinesofficial'], (await C.readCrm()).byKey['ig:thetidelines']], [tide, undefined]);
r = await H({ action: 'note', cid: tide, text: 'Their manager is Sam.' });
eq('notes come back newest first', r.notes.map((n) => n.text), ['Their manager is Sam.', 'Saw them at Sunset Bar']);
r = await H({ action: 'summary' });
eq('the tag list counts use', r.tags.map((t) => t.tag), ['beach', 'jazz', 'Priority']);

console.log('\nOUTREACH, LOGGED');
await F({ action: 'approve', owner: tideOwner });
const sentBefore = ((await S.readStats())[new Date().toISOString().slice(0, 7)] || {}).sent || 0;
r = await H({ action: 'log', cid: tide, ch: 'ig', dir: 'out', text: 'Hey Tide Lines! I built you a page.' });
ok('an Instagram DM, logged', r.ok && r.msg.ch === 'ig' && r.msg.dir === 'out' && r.row.ch.includes('ig') && r.row.sent > 0, r);
eq('THE PAGE IS MARKED SENT, the way the console’s button does it', [(await S.readSampleReg()).byId[tideOwner].st, (await S.readSampleReg()).byId[tideOwner].ch], ['sent', 'dm']);
eq('and its stage says Shared', (await rowOf(tide)).stage, 'shared');
await H({ action: 'update', cid: tide, fields: { fu: 0 } });
await H({ action: 'log', cid: tide, ch: 'email', dir: 'out', subject: 'A MySet page for you', text: 'The same, by email.' });
eq('a second channel is added; the month counts ONE send', [(await rowOf(tide)).ch.sort(), ((await S.readStats())[new Date().toISOString().slice(0, 7)] || {}).sent - sentBefore], [['email', 'ig'], 1]);
row = await rowOf(tide);
ok('the follow-up is set when the first message goes out (not after a later one)', row.fu === 0, row.fu);
r = await H({ action: 'generate', kind: 'venue', fields: { name: 'Sunset Bar', city: 'Haad Rin', links: { instagram: '@sunsetbar', google: 'https://maps.app.goo.gl/Sun5et' }, email: 'hello@sunsetbar.example' } });
const bar = r.cid;
ok('a venue is never asked for songs', !(await readDoc('factoryq', null)).data.jobs.find((x) => x.id === r.job.id).seed.songs);
BG.deps.run = fakeBuild({ review: false });
await BG.work(r.job.id);
await H({ action: 'log', cid: bar, ch: 'inperson', dir: 'out', text: 'Showed the manager on my phone.' });
row = await rowOf(bar);
ok('a first message sets the follow-up four days out', Math.abs(row.fu - (row.sent + C.FOLLOW_MS)) < 5, row);
r = await H({ action: 'log', cid: bar, ch: 'whatsapp', dir: 'in', text: 'Looks great, we will claim it tonight' });
row = await rowOf(bar);
eq('their reply: replied, the follow-up cleared, the last message theirs, no unread for a reply the founder typed in', [row.replied > 0, row.fu, row.last.dir, row.unread], [true, 0, 'in', 0]);
eq('a note is not outreach', (await H({ action: 'log', cid: bar, ch: 'note', dir: 'in', text: 'call back Friday' })).msg.dir, 'out');
eq('nothing to log is refused', (await H({ action: 'log', cid: bar, ch: 'ig', dir: 'out', text: '  ' })).ok, false);
eq('a venue’s kind is kept', (await rowOf(bar)).kind, 'venue');

console.log('\nWHERE A PAGE GOES, THE CONTACT FOLLOWS');
const orphan = await S.createSample({ kind: 'artist', name: 'Old Console Act', city: 'Chiang Mai', quality: { score: 0.9, review: false }, by: 'founder',
  seed: { line: 'Old Console Act | @oldconsoleact', links: { instagram: 'https://www.instagram.com/oldconsoleact/' } } }, { fetchMedia: false });
r = await H({ action: 'summary' });
const adopted = r.contacts.find((x) => x.owner === orphan.owner);
ok('a page the old console built is adopted into the table', adopted && adopted.name === 'Old Console Act' && adopted.stage === 'ready', adopted);
ok('with the links its seed had', (await C.readContact(adopted.cid)).links.instagram === 'https://www.instagram.com/oldconsoleact/');
await H({ action: 'remove', cid: adopted.cid, mode: 'contact' });
r = await H({ action: 'summary' });
ok('Delete contact: gone, and NOT adopted back — the page stays', !r.contacts.some((x) => x.owner === orphan.owner) && (await S.readSampleReg()).byId[orphan.owner], r.contacts.map((x) => x.name));

/* THE RACE (Sand & Tan, 2026-09-30): the page is written before its contact is linked,
   and a summary poll in between used to adopt it as an orphan — two rows, one page. */
r = await H({ action: 'save', kind: 'venue', fields: { name: 'Race Bar', city: 'Hua Hin', links: { instagram: '@racebar' } } });
const race = r.cid;
await C.mutateContact(race, (x) => { x.jobId = 'jrace'; return true; });
const midRace = await S.createSample({ kind: 'venue', name: 'Race Bar', city: 'Hua Hin', cid: race, quality: { score: 0.9, review: false }, by: 'founder' }, { fetchMedia: false });
r = await H({ action: 'summary' });
eq('a poll mid-build links the contact that asked, and makes no second one', r.contacts.filter((x) => x.owner === midRace.owner).map((x) => x.cid), [race]);
const twin = await C.createContact('venue', { name: 'Race Bar', city: 'Hua Hin' }, { force: true });
await C.linkOwner(twin.cid, midRace.owner);
r = await H({ action: 'summary' });
eq('a twin made before the fix is dropped; the contact CRM built for stays', r.contacts.filter((x) => x.owner === midRace.owner).map((x) => x.cid), [race]);
const twin2 = await C.createContact('venue', { name: 'Race Bar', city: 'Hua Hin' }, { force: true });
await C.linkOwner(twin2.cid, midRace.owner);
await C.addMessage(twin2.cid, { ch: 'ig', dir: 'out', text: 'hi' });
r = await H({ action: 'summary' });
ok('but a twin somebody wrote from is kept', r.contacts.some((x) => x.cid === twin2.cid), r.contacts.filter((x) => x.owner === midRace.owner));
await C.eraseContact(twin2.cid);

r = await H({ action: 'save', kind: 'artist', fields: { name: 'Cancel Me', links: { instagram: '@cancelme' } } });
const cm = r.cid;
ok('Save as lead: a contact, no build', r.ok && r.row.stage === 'lead' && !(await C.readContact(cm)).jobId, r.row);
r = await H({ action: 'generate', cid: cm, fields: {} });
BG.deps.run = fakeBuild({ review: false });
await BG.work(r.job.id);
const cmOwner = (await C.readContact(cm)).owner;
await F({ action: 'cancel', owner: cmOwner });
doc = await C.readContact(cm);
eq('Cancel page: the contact stays, as a lead again', [doc.owner, (await rowOf(cm)).stage, doc.events.some((e) => e.e === 'unlinked')], ['', 'lead', true]);

const arcOwner = (await C.readContact(bar)).owner;
await S.archiveSample(arcOwner);
eq('taken down after thirty days: Archived', (await rowOf(bar)).stage, 'archived');
const rv = await F({ action: 'revive', owner: arcOwner });
eq('revived: back on the list', [rv.ok, (await rowOf(bar)).stage], [true, 'ready']);
ok('the conversation came back with it', (await C.readContact(bar)).msgs.length === 3);

await S.claimSampleArtist({ owner: tideOwner, email: 'tide@example.com' });
row = await rowOf(tide);
eq('claimed: the public page, no label', [row.stage, row.link.endsWith('/' + row.slug), row.link.includes('#')], ['claimed', true, false]);
r = await H({ action: 'contact', cid: tide });
eq('a claimed page is theirs: no drafts, no edit, the undo while it lasts', [r.page.state, r.page.undo, r.drafts], ['claimed', true, null]);

console.log('\nDELETE FOREVER');
r = await H({ action: 'generate', kind: 'artist', fields: { name: 'Say No Band', links: { instagram: '@saynoband' } } });
const no = r.cid;
BG.deps.run = fakeBuild({ review: false });
await BG.work(r.job.id);
const noOwner = (await C.readContact(no)).owner;
r = await H({ action: 'remove', cid: no, mode: 'forever' });
ok('from CRM: the page, the contact — gone', r.ok && !(await S.readSampleReg()).byId[noOwner] && !(await C.readContact(no)) && !(await C.readCrm()).byId[no]);
ok('and they are suppressed: the factory will not build them again', await S.isSuppressed(['saynoband']));
eq('their keys are gone from the index', Object.values((await C.readCrm()).byKey).includes(no), false);

r = await H({ action: 'generate', kind: 'artist', fields: { name: 'Console Says No', links: { instagram: '@consolesaysno' } } });
const cn = r.cid;
await BG.work(r.job.id);
const cnOwner = (await C.readContact(cn)).owner;
await F({ action: 'optout', owner: cnOwner });
ok('from the OLD console’s Delete forever: the contact goes too', !(await C.readContact(cn)) && !(await C.readCrm()).byId[cn]);

r = await H({ action: 'save', kind: 'artist', fields: { name: 'Never Built', links: { instagram: '@neverbuilt' } } });
await H({ action: 'remove', cid: r.cid, mode: 'forever' });
ok('a lead with no page who says no: suppressed all the same', await S.isSuppressed(['neverbuilt']) && !(await C.readContact(r.cid)));
r = await H({ action: 'generate', kind: 'artist', fields: { name: 'Never Built', links: { instagram: '@neverbuilt' } } });
BG.deps.run = fakeBuild();
eq('asked again later, the build is skipped: they are on the list', await BG.work(r.job.id), 'skipped');
eq('and the table says so', [(await rowOf(r.cid)).stage, /opt-out/.test((await rowOf(r.cid)).err)], ['failed', true]);

console.log('\nEDIT PROFILE');
r = await H({ action: 'generate', kind: 'artist', fields: { name: 'Edit Me', city: 'Pai', links: { instagram: '@editme', spotify: 'https://open.spotify.com/artist/4tIdEl1nEs0123456789ab' } } });
const em = r.cid;
await BG.work(r.job.id);
const emOwner = (await C.readContact(em)).owner;
r = await F({ action: 'edit', owner: emOwner, fields: { bio: 'New words.', links: { instagram: '@editmeofficial', tiktok: 'https://instagram.com/wrong', youtube: '' } } });
ok('links: a handle becomes the address, a wrong host is named', r.ok && r.profile.links.instagram === 'https://www.instagram.com/editmeofficial/' && r.dropped.join() === 'tiktok' && r.profile.bio === 'New words.', r);
r = await F({ action: 'edit', owner: emOwner, fields: { media: { add: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' } } });
ok('a video added by its link', r.ok && r.profile.media.length === 1 && r.profile.media[0].title === 'Live at the Beach Bar', r.profile && r.profile.media);
const mid = r.profile.media[0].mid;
r = await F({ action: 'edit', owner: emOwner, fields: { media: { hero: mid } } });
eq('made the hero', r.profile.media[0].hero, true);
r = await F({ action: 'edit', owner: emOwner, fields: { media: { add: 'https://example.com/not-a-video' } } });
eq('a link that is not a video is refused, plainly', [r.ok, /YouTube, Spotify or Apple Music/.test(r.error)], [false, true]);
r = await F({ action: 'edit', owner: emOwner, fields: { media: { remove: mid } } });
eq('and removed', r.profile.media.length, 0);
r = await F({ action: 'edit', owner: emOwner, fields: { city: 'Chiang Mai' } });
eq('the place, on the list row', (await S.readSampleReg()).byId[emOwner].city, 'Chiang Mai');
const barOwner = (await C.readContact(bar)).owner;
r = await F({ action: 'edit', owner: barOwner, fields: { links: { website: 'sunsetbar.co.th', facebook: '@sunsetbarhaadrin', instagram: 'https://tiktok.com/@nope' } } });
const vp = await getVenueProfile(barOwner.slice(2));
ok('a venue’s links, the same way', r.ok && vp.links.website === 'https://sunsetbar.co.th/' && vp.links.facebook === 'https://www.facebook.com/sunsetbarhaadrin' && r.dropped.join() === 'instagram', [vp.links, r.dropped]);

r = await F({ action: 'edit', owner: barOwner, fields: { hours: 'Daily 8am-10pm', menuUrl: 'https://online.anyflip.com/uqxta/oyru/mobile/index.html', rating: { stars: 4.5, count: 1100 } } });
const vd = await getVenueProfile(barOwner.slice(2));
ok('DETAILS (0132): hours as typed, the menu link, the rating with the day it was read', r.ok && vd.hours.sat.open === '08:00' && vd.hours.sat.close === '22:00' && !vd.hours.mon.closed
  && vd.menu.url === 'https://online.anyflip.com/uqxta/oyru/mobile/index.html' && vd.rating.stars === 4.5 && vd.rating.count === 1100 && Date.now() - vd.rating.at < 60e3, [vd.hours, vd.menu, vd.rating]);
ok('and CRM reads them back', r.profile && r.profile.menuUrl === vd.menu.url && r.profile.rating.count === 1100 && r.profile.hours.sun.open === '08:00', r.profile);
eq('hours it cannot read are refused, the page untouched', [(await F({ action: 'edit', owner: barOwner, fields: { hours: 'whenever' } })).status, (await getVenueProfile(barOwner.slice(2))).hours.sat.open], [400, '08:00']);
eq('a menu link that is not https is refused', (await F({ action: 'edit', owner: barOwner, fields: { menuUrl: 'javascript:alert(1)' } })).status, 400);
eq('a rating out of range is not stored', (await F({ action: 'edit', owner: barOwner, fields: { rating: { stars: 9, count: 3 } } })) && (await getVenueProfile(barOwner.slice(2))).rating, null);
r = await F({ action: 'edit', owner: barOwner, fields: { hours: '' } });
ok('cleared hours hide the block', (await getVenueProfile(barOwner.slice(2))).hours && Object.values((await getVenueProfile(barOwner.slice(2))).hours).every((h) => h.closed));

console.log('\nPHOTOS IN THEIR PLACES, NOTES FOR THE GENERATOR (0136)');
{
  const JPG = (n) => 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, n), Buffer.from([0xff, 0xd9])]).toString('base64');
  const roles = async () => (await F({ action: 'detail', owner: barOwner })).profile.roles;
  // as a build leaves a venue the generator found no wide shot for: five photos, no cover
  const ns = (await S.readSampleReg()).byId[barOwner].ns, five = [];
  for (let i = 0; i < 5; i++) five.push(await putImage(ns, `p${i}`, Buffer.from(JPG(i + 1).split(',')[1], 'base64'), 'image/jpeg'));
  await mutateVenueProfile(barOwner.slice(2), (p) => { p.photo = ''; p.photos = five; return true; });
  const vp0 = await getVenueProfile(barOwner.slice(2)), R0 = await roles();
  ok('five photos and no cover: the console shows what the page shows — the last one up top', !vp0.photo && vp0.photos.length === 5 && R0[0] === vp0.photos[4] && R0[1] === vp0.photos[0] && R0.length === 6 && !R0[5], [vp0, R0]);
  r = await F({ action: 'arrange', owner: barOwner, order: [R0[1], R0[0], ...R0.slice(2)] });
  const vp1 = await getVenueProfile(barOwner.slice(2));
  ok('a swap: the main shot becomes the cover, the cover the main shot, stored plainly', r.ok && vp1.photo === R0[1] && vp1.photos[0] === R0[0] && vp1.photos.length === 4, vp1);
  eq('the list card’s thumbnail follows the cover', (await S.readSampleReg()).byId[barOwner].cv, R0[1]);
  eq('an order with a photo the page does not hold is refused', (await F({ action: 'arrange', owner: barOwner, order: ['/api/img?a=sxxxxxxxxxx&s=p0&v=1', ...R0.slice(1)] })).status, 400);
  eq('so is one that loses a photo', (await F({ action: 'arrange', owner: barOwner, order: ['', ...(await roles()).slice(1)] })).status, 400);
  const R1 = await roles();
  r = await F({ action: 'addPhoto', owner: barOwner, slot: 'p4', data: JPG(9) });
  const name = (u) => (/&s=([a-z0-9]+)/.exec(u) || [])[1], R2 = await roles();
  ok('a new photo is stored under a name no other photo uses, so nothing it shares a name with changes', r.ok && R2[5] === r.src && R1.slice(0, 5).every((u, i) => u === R2[i])
    && !R2.slice(0, 5).map(name).includes(name(r.src)), [R1, R2]);
  r = await F({ action: 'addPhoto', owner: barOwner, slot: 'p1', url: R2[0] });
  const R3 = await roles();
  ok('choosing a photo already on the page trades the two places', r.ok && R3[2] === R2[0] && R3[0] === R2[2], [R2, R3]);
  eq('a venue has no portrait', (await F({ action: 'addPhoto', owner: barOwner, slot: 'avatar', data: JPG(3) })).status, 400);

  const hand = await S.createSample({ kind: 'artist', name: 'Hand Made Act', quality: { score: 0.9, review: false }, by: 'founder' }, { fetchMedia: false });
  eq('a page made by hand has no build for notes to steer', (await F({ action: 'notes', owner: hand.owner, notes: 'Lead with the duo.' })).status, 400);
  r = await F({ action: 'notes', owner: barOwner, notes: '  Mention the Sunday sunset sessions.\r\nLeave out the pool.  ' });
  ok('notes are kept on the seed, trimmed', r.ok && r.notes === 'Mention the Sunday sunset sessions.\nLeave out the pool.' && (await readDoc(S.SAMPLE(barOwner), null)).data.seed.notes === r.notes, r);
  await F({ action: 'edit', owner: barOwner, fields: { hours: 'Daily 8am-10pm', rating: { stars: 4.5, count: 1079 } } });
  r = await F({ action: 'rebuild', owner: barOwner });
  q = (await readDoc('factoryq', null)).data;
  j = q.jobs.find((x) => x.replace === barOwner && x.st !== 'done');
  ok('a rebuild carries the notes to the generator, and keeps by default', r.ok && j.seed.notes === 'Mention the Sunday sunset sessions.\nLeave out the pool.' && j.keep === true, j);
  BG.deps.run = fakeBuild({ review: false });
  await BG.work(j.id);
  const vk = await getVenueProfile(barOwner.slice(2)), RK = await roles();
  ok('REBUILT, KEPT: the photos in their places, the hours, the menu link and the rating', RK.join() === R3.join() && vk.rating && vk.rating.count === 1079 && vk.hours.sat.open === '08:00'
    && vk.menu.url === 'https://online.anyflip.com/uqxta/oyru/mobile/index.html' && vk.tagline === 'Songs for the golden hour', [RK, R3, vk.rating, vk.menu]);
  ok('the kept pictures are still stored', (await Promise.all(RK.filter(Boolean).map((u) => getImage(...u.match(/a=([a-z0-9]+)&s=([a-z0-9]+)/).slice(1))))).every(Boolean));
  eq('and the notes survive the rebuild', (await readDoc(S.SAMPLE(barOwner), null)).data.seed.notes, 'Mention the Sunday sunset sessions.\nLeave out the pool.');
  r = await F({ action: 'rebuild', owner: barOwner, keep: false });
  j = (await readDoc('factoryq', null)).data.jobs.find((x) => x.replace === barOwner && x.st !== 'done');
  await BG.work(j.id);
  const vf = await getVenueProfile(barOwner.slice(2));
  ok('asked for a fresh start: the new build’s photos (none here), and what was set by hand goes', j.keep === false && !vf.photo && !(vf.photos || []).length && !vf.rating, vf);
}

r = await F({ action: 'rebuild', owner: emOwner });
q = (await readDoc('factoryq', null)).data;
j = q.jobs.find((x) => x.replace === emOwner && x.st !== 'done');
ok('A REBUILD KEEPS THE SEED’S FIELDS, not only its line', r.ok && j && j.seed.name === 'Edit Me' && j.seed.city === 'Pai' && j.seed.links.instagram === 'https://www.instagram.com/editme/', j && j.seed);
eq('and the table shows it building', (await rowOf(em)).stage, 'building');
eq('a second rebuild tap does not queue it twice', [(await F({ action: 'rebuild', owner: emOwner })).already, (await readDoc('factoryq', null)).data.jobs.filter((x) => x.replace === emOwner && x.st !== 'done').length], [true, 1]);
BG.deps.run = fakeBuild({ review: false });
await BG.work(j.id);
eq('rebuilt under the same address: the contact still points at it, waiting for a look (auto is off)', [(await C.readContact(em)).owner === emOwner, (await rowOf(em)).stage], [true, 'review']);

console.log('\nTHE OLD CONSOLE STILL WORKS');
r = await F({ action: 'summary' });
ok('its summary', r.ok && Array.isArray(r.live));
r = await F({ action: 'queue', kind: 'artist', lines: ['Line Act | @lineact', 'Line Act | @lineact'] });
eq('its lines: one queued, the twin skipped', [r.ok, r.added, r.skipped.map((s) => s.why)], [true, 1, ['already queued']]);
r = await F({ action: 'detail', owner: emOwner });
ok('its detail: the drafts, the videos with their ids', r.ok && r.msgs && r.msgs.dm && Array.isArray(r.profile.media), r);
r = await F({ action: 'sent', owner: emOwner, ch: 'email' });
ok('its Mark sent', r.ok && r.row.ch === 'email' && r.row.sent > 0, r.row);

console.log('\nGMAIL: CONNECT, SEND, A REPLY READ BACK (decision 0109)');
{
  process.env.GMAIL_CLIENT_ID = 'test-client.apps.googleusercontent.com';   // test values: Google is played below
  process.env.GMAIL_CLIENT_SECRET = 'test-client-secret';
  const G = { sent: [], lists: [], tokenCalls: 0, revoked: 0 };
  const INBOX = {};                         // gmail id → a message in Gmail's shape
  const hdrs = (o) => Object.entries(o).map(([name, value]) => ({ name, value }));
  const b64 = (t) => Buffer.from(t, 'utf8').toString('base64url');
  const before = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const J = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'content-type': 'application/json' } });
    if (u === 'https://oauth2.googleapis.com/token') {
      G.tokenCalls++;
      const f = new URLSearchParams(String(opts.body));
      if (f.get('grant_type') === 'authorization_code') return f.get('code') === 'good-code'
        ? J({ access_token: 'ya29.test-access', refresh_token: '1//test-refresh', expires_in: 3600, scope: 'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly' })
        : J({ error: 'invalid_grant', error_description: 'Bad Request' }, 400);
      return J({ access_token: 'ya29.test-access-2', expires_in: 3600 });
    }
    if (u.startsWith('https://oauth2.googleapis.com/revoke')) { G.revoked++; return J({}); }
    if (u.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/')) {
      const rest = u.slice('https://gmail.googleapis.com/gmail/v1/users/me/'.length);
      if (rest === 'profile') return J({ emailAddress: 'founder@example.com' });
      if (rest === 'messages/send') {
        const b = JSON.parse(opts.body); const n = G.sent.length + 1;
        G.sent.push({ ...b, mime: Buffer.from(b.raw, 'base64url').toString('utf8') });
        INBOX[`g-sent-${n}`] = { id: `g-sent-${n}`, threadId: b.threadId || 't-thread-1', payload: { headers: hdrs({ 'Message-ID': `<sent${n}@mail.gmail.com>` }) } };
        return J({ id: `g-sent-${n}`, threadId: b.threadId || 't-thread-1' });
      }
      const m = /^messages\/([^?]+)\?/.exec(rest);
      if (m) return INBOX[decodeURIComponent(m[1])] ? J(INBOX[decodeURIComponent(m[1])]) : J({ error: { message: 'Not Found' } }, 404);
      if (rest.startsWith('messages?')) {
        const q = new URL(u).searchParams.get('q') || ''; G.lists.push(q);
        return J({ messages: Object.values(INBOX).filter((x) => x.from && q.includes(x.from)).map((x) => ({ id: x.id, threadId: x.threadId })) });
      }
    }
    return before(url, opts);
  };

  r = await H({ action: 'summary' });
  eq('with the client set: ready, not connected', [r.gmail.ready, r.gmail.connected], [true, false]);
  r = await H({ action: 'gmail', op: 'connect' });
  const auth = new URL(r.url);
  ok('Connect hands out Google’s consent link: offline, consent, both Gmail scopes, our return address, a signed state',
    auth.origin === 'https://accounts.google.com' && auth.searchParams.get('access_type') === 'offline' && auth.searchParams.get('prompt') === 'consent'
    && /gmail\.send/.test(auth.searchParams.get('scope')) && /gmail\.readonly/.test(auth.searchParams.get('scope'))
    && auth.searchParams.get('redirect_uri') === 'https://hq.test/api/hq/gmail' && (auth.searchParams.get('state') || '').includes('.'), r.url);
  const back = async (q) => { const res = await hqFn(new Request(`https://hq.test/api/hq/gmail?${q}`)); return [res.status, res.headers.get('location') || '']; };
  const [st1, loc1] = await back(`code=good-code&state=${encodeURIComponent('forged.state')}`);
  ok('a return with a state CRM never handed out is refused', st1 === 302 && loc1.startsWith('/crm?gmail=error') && !(await H({ action: 'summary' })).gmail.connected, loc1);
  const [st2, loc2] = await back(`error=access_denied&state=x`);
  ok('the founder pressing Cancel at Google comes back as an error, nothing kept', st2 === 302 && /gmail=error&why=access_denied/.test(loc2), loc2);
  const [st3, loc3] = await back(`code=good-code&state=${encodeURIComponent(auth.searchParams.get('state'))}`);
  eq('the real return connects', [st3, loc3], [302, '/crm?gmail=connected']);
  r = await H({ action: 'summary' });
  eq('connected, as the founder’s own address', [r.gmail.connected, r.gmail.email], [true, 'founder@example.com']);
  const stored = JSON.stringify((await readDoc('crmgmail', null)).data);
  ok('THE TOKENS ARE SEALED: neither is in the stored document', !stored.includes('1//test-refresh') && !stored.includes('ya29.test-access'), stored.slice(0, 120));

  const barRow = await rowOf(bar);
  r = await H({ action: 'send', cid: bar, subject: 'Your MySet page', text: 'Hi Sunset Bar team,\nhere it is.' });
  ok('an email goes out through Gmail and joins the thread', r.ok && r.msg.via === 'gmail' && r.msg.ch === 'email' && r.msg.thread === 't-thread-1', r);
  const mime1 = G.sent[0].mime;
  ok('to them, from the founder’s Gmail, signed with the drafts’ name, the subject as typed',
    /\r\nTo: hello@sunsetbar\.example\r\n/.test('\r\n' + mime1) && /From: The MySet team <founder@example\.com>/.test(mime1) && /Subject: Your MySet page/.test(mime1), mime1.slice(0, 300));
  eq('and the page it is about is marked Sent by email', (await S.readSampleReg()).byId[(await C.readContact(bar)).owner].ch.split(',').includes('email'), true);
  r = await H({ action: 'send', cid: bar, subject: '', text: 'One more thing.' });
  const mime2 = G.sent[1].mime;
  ok('the next one is a reply in the same thread: Re:, In-Reply-To, the thread id', r.ok && G.sent[1].threadId === 't-thread-1'
    && /Subject: Re: Your MySet page/.test(mime2) && /In-Reply-To: <sent1@mail\.gmail\.com>/.test(mime2), mime2.slice(0, 400));
  eq('an email with nobody to send it to is refused', (await H({ action: 'send', cid: cm, subject: 'x', text: 'y' })).ok, false);

  INBOX['g-in-1'] = { id: 'g-in-1', threadId: 't-thread-1', from: 'hello@sunsetbar.example', internalDate: String(Date.now()), snippet: 'Love it!',
    payload: { mimeType: 'text/plain', headers: hdrs({ From: 'Sunset Bar <hello@sunsetbar.example>', To: 'founder@example.com', Subject: 'Re: Your MySet page', 'Message-ID': '<reply1@sunsetbar.example>' }),
      body: { data: b64('Love it! We will claim it tonight.\n\nOn Mon, 28 Sep 2026 at 10:00, The MySet team <founder@example.com> wrote:\n> Hi Sunset Bar team,\n> here it is.') } } };
  r = await H({ action: 'gmail', op: 'sync' });
  eq('the ring reads their reply in', [r.ok, r.added], [true, 1]);
  ok('asked for by their address, not the whole inbox', G.lists.some((q) => q.includes('from:hello@sunsetbar.example')), G.lists);
  row = await rowOf(bar);
  eq('their reply: unread, the last word theirs, the follow-up cleared', [row.unread, row.last.dir, row.last.ch, row.fu], [1, 'in', 'email', 0]);
  const msgs = (await C.readContact(bar)).msgs;
  eq('the quoted history is cut off', msgs[msgs.length - 1].text, 'Love it! We will claim it tonight.');
  r = await H({ action: 'gmail', op: 'sync' });
  eq('a sync inside the minute is a no-op', [r.ok, r.added], [true, 0]);
  await casDoc('crmgmail', () => ({}), (d) => { d.lastSync = 1; return true; });
  r = await H({ action: 'gmail', op: 'sync' });
  eq('and a later one never adds the same reply twice', [r.ok, r.added, (await C.readContact(bar)).msgs.filter((m) => m.gid === 'g-in-1').length], [true, 0, 1]);
  r = await H({ action: 'thread', cid: bar });
  eq('opening the thread reads it', [r.ok, (await rowOf(bar)).unread], [true, 0]);

  await C.mutateCrm((c) => { c.mail = { day: new Date().toISOString().slice(0, 10), n: 60 }; return true; });
  r = await H({ action: 'send', cid: bar, subject: 'x', text: 'y' });
  eq('the day’s allowance is a hard stop, said plainly', [r.ok, /60 emails today/.test(r.error)], [false, true]);

  r = await H({ action: 'gmail', op: 'disconnect' });
  eq('Disconnect: revoked at Google and forgotten', [r.ok, G.revoked, (await H({ action: 'summary' })).gmail.connected], [true, 1, false]);
  eq('sending now says so', (await H({ action: 'send', cid: bar, subject: 'x', text: 'y' })).error, 'gmail-not-connected');
  globalThis.fetch = before;
}

console.log('\nTHE SIGN-IN MAIL SENDER IS NOT CRM’S (INVARIANT 0gs)');
{
  const { readFileSync, existsSync } = await import('node:fs');
  for (const f of ['hq.mjs', '_crm.mjs', 'hqcron.mjs', '_gmail.mjs']) {
    const p = new URL(`../netlify/functions/${f}`, import.meta.url);
    if (!existsSync(p)) continue;
    ok(`${f} never touches Resend, which carries every sign-in code`, !/api\.resend\.com|RESEND_API_KEY|AUTH_FROM/.test(readFileSync(p, 'utf8')), f);
  }
}

console.log('\nTHE PAGE’S TWO THEMES');
{
  /* The founder, 2026-09-28: "please add a dark/light toggle". The light theme lives in
     the tokens: every wash and hairline is mixed from --hi, and every colour that is
     text has a light shade of its own. These catch the two ways it rots — a new white
     wash that vanishes on the light stage, and a shade tuned until small words fail. */
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../public/crm.html', import.meta.url), 'utf8');
  const block = (sel) => { const i = page.indexOf(sel + '{'); return i < 0 ? '' : page.slice(i + sel.length + 1, page.indexOf('}', i)); };
  const tokens = (css) => Object.fromEntries([...css.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const dark = tokens(block(':root')), light = { ...dark, ...tokens(block(':root[data-theme=light]')) };
  const lum = (hex) => { let h = String(hex).replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const TEXT = ['--ink', '--ink-2', '--muted', '--accent', '--venue', '--good', '--warn', '--bad', '--bad-1', '--bad-2', '--bad-3', '--warn-2'];
  for (const [name, T, grounds] of [['dark', dark, ['#000000', '#1C1C20']], ['light', light, ['#FFFFFF', '#F5F5F7']]]) {
    const low = TEXT.flatMap((k) => grounds.map((g) => [k, g, ratio(T[k], g)])).filter(([, , r]) => !(r >= 4.5));
    eq(`the ${name} theme: every colour that is text keeps 4.5:1 on the ${name} stage`, low.map(([k, g, r]) => `${k} on ${g}: ${r.toFixed(2)}`), []);
  }
  const css = page.slice(page.indexOf('<style>'), page.indexOf(':root[data-theme=light]{'));   // the rules both themes share
  const whites = (css.match(/rgba\(255,255,255,/g) || []).length;
  ok('every wash and hairline is mixed from --hi; white stays only as a highlight on a coloured surface (six of them)', whites <= 6, whites);
  const head = page.slice(0, page.indexOf('<style>'));
  ok('the head sets the kept theme before the first paint, so a light CRM never flashes dark',
    head.includes("localStorage.getItem('myset.hq.theme')") && head.includes("dataset.theme='light'"));
  ok('the sun in the top bar has its handler', page.includes('data-act="theme"') && /\btheme:\(\)=>setTheme\(/.test(page));
}

console.log('\nTHE MESSAGE LIBRARY (decision 0117)');
{
  /* The founder's own openers: eight until the first save, edited whole, and every
     message that goes out with one remembers which (and which ending), so the page
     can say which opener gets answered. */
  let lib = (await H({ action: 'summary' })).lib;
  eq('before any save the library is the eight openers, one for venues', [lib.list.length, lib.list.filter((p) => p.kind === 'venue').map((p) => p.k), lib.ending], [8, ['venue'], 'ab']);
  ok('every opener has a body with a [Name] or [Venue] and its own closing question', lib.list.every((p) => /\[(Name|Venue)\]/.test(p.text) && /\?$/.test(p.ask)), lib.list);
  ok('the softer ending is the one the founder was told to test', lib.soft === 'I can send you the link if you want to see what yours looks like?', lib.soft);

  const edited = { ...lib, ending: 'soft', list: [...lib.list.slice(0, 2), { k: 'x', name: '  Folk   duos ', kind: 'artist', text: 'Hi [Name]\n\n\n\nhello', ask: 'Keen?', match: 'Folk, Duo ' },
    { k: 'x', name: 'dupe', text: 'twice' }, { k: 'BAD KEY', name: 'no', text: 'no' }, { k: 'empty', name: 'no body', text: '   ' }] };
  let r = await H({ action: 'savelib', lib: edited });
  eq('a save keeps known fields only: tidy names, match words lower-cased, blank lines squeezed, a repeated or bad key or empty body dropped',
    r.lib.list.slice(2), [{ k: 'x', name: 'Folk duos', kind: 'artist', text: 'Hi [Name]\n\nhello', ask: 'Keen?', match: ['folk', 'duo'] }]);
  eq('…and it is what the next summary reads', [(await H({ action: 'summary' })).lib.list.length, (await H({ action: 'summary' })).lib.ending], [3, 'soft']);
  r = await H({ action: 'savelib', lib: { list: [] } });
  eq('an empty library stays empty: the founder cleared it', r.lib.list.length, 0);
  r = await H({ action: 'savelib', lib: null });
  eq('null puts the originals back', [r.lib.list.length, r.lib.ending], [8, 'ab']);
  eq('a locked CRM does not save a library', (await H({ action: 'savelib', lib: { list: [] } }, '')).error, 'locked');

  const { out: f } = C.normFields('artist', { name: 'Presets Test Act', city: 'Pai', links: { instagram: '@presetstest' }, tags: ['wedding'] });
  const pc = (await C.createContact('artist', f, { force: true })).cid;
  await H({ action: 'log', cid: pc, ch: 'note', dir: 'out', text: 'a private note', pre: 'wedding' });
  r = await H({ action: 'log', cid: pc, ch: 'ig', dir: 'out', text: 'Hey Presets — …', pre: 'wedding', soft: true });
  eq('a message sent from a preset remembers it and its ending (a note never does)', [r.msg.pre, r.msg.soft, ((await C.readContact(pc)).msgs.find((m) => m.ch === 'note') || {}).pre], ['wedding', true, undefined]);
  eq('the row carries the first preset that went out, and when', [r.row.pre && r.row.pre.k, r.row.pre && r.row.pre.s, r.row.pre && r.row.pre.t === r.msg.t], ['wedding', 1, true]);
  await H({ action: 'log', cid: pc, ch: 'ig', dir: 'out', text: 'second', pre: 'bar' });
  await C.addMessage(pc, { ch: 'ig', dir: 'in', text: 'yes please!', pre: 'bar', t: Date.now() + 60e3 });   // a minute later: a reply is never the same millisecond
  const row = await rowOf(pc), got = ((await C.readContact(pc)).msgs.find((m) => m.dir === 'in') || {});
  eq('a later preset does not take the credit, and a reply carries none', [row.pre.k, got.pre, row.replied > row.pre.t], ['wedding', undefined, true]);
  r = await H({ action: 'log', cid: pc, ch: 'ig', dir: 'out', text: 'x', pre: '<script>' });
  eq('a preset key that is not one is not kept', r.msg.pre, undefined);

  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../public/crm.html', import.meta.url), 'utf8');
  ok('the page saves the library, and sends, copies and logs carry the preset', page.includes("api('savelib'") && (page.match(/preBody\(c/g) || []).length === 3 && (page.match(/c\.okPre=preOn\(c\)/g) || []).length === 2,
    [(page.match(/preBody\(c/g) || []).length, (page.match(/c\.okPre=preOn\(c\)/g) || []).length]);
  ok('the page will not send an opener with a [placeholder] still in it', /const canSend=[^\n]*!holes\(c\.text\)\.length/.test(page));
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
