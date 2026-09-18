/* THE ARTIST DIARY  (_diary.mjs, diary.mjs, the diary* actions on /api/admin —
   decision 0085)

   Pins, in order:
     · the plan table says 3 / 10 / 40 and diaryCap reads it; the Studio's plan
       payload carries the number
     · a page needs a title and a story; the song must be one of the artist's, by
       id; the newest page goes on top
     · the fourth page on Hobbyist is refused with a 402 that names the plan and
       the number; editing a page on a full diary still works; removing is never
       gated; a downgrade keeps every page and refuses only the next (0s)
     · Bar Star holds ten, Rock Star forty; the owner is not special
     · the public read shows only shown pages, resolves the song from the library,
       drops a song that left the library, and is edge-shared; a hidden page never
       leaves the server; an unknown slug is a 404
     · the profile carries the count of shown pages, so the artist page can wear
       the door only when there is something behind it
     · the artist page, the diary page and the Studio say what the server enforces
     · `diary` and `diaries` are reserved slugs; the route is above the catch-all
     · move up / down; a band mate may write; the sound engineer may not
     · the export carries the pages; keysFor names the document and its versions;
       a deleted artist leaves nothing behind */
process.env.ADMIN_CODE = 'devlocal';

const admin = (await import('../netlify/functions/admin.mjs')).default;
const authFn = (await import('../netlify/functions/auth.mjs')).default;
const fanFn = (await import('../netlify/functions/fan.mjs')).default;
const { PLANS, diaryCap, MAX_DIARY } = await import('../netlify/functions/_plan.mjs');
const { MAX_TITLE, MAX_BODY, MAX_WHEN, DIARY_ID, readDiary } = await import('../netlify/functions/_diary.mjs');
const { createArtist, signToken, readArtists, revOf, mutateArtists, cleanSlug } = await import('../netlify/functions/_auth.mjs');
const { newSid } = await import('../netlify/functions/_session.mjs');
const { keysFor, exportArtist, deleteArtist } = await import('../netlify/functions/_account.mjs');
const { KEY, DEFAULT_ARTIST } = await import('../netlify/functions/_lib.mjs');
const { __dump } = await import('./blobs-fake.mjs');
const { readFileSync } = await import('node:fs');
const { src } = await import('./_src.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const hit = async (h, url, body, token) => {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  const r = await h(new Request(url, body === undefined
    ? { headers } : { method: 'POST', headers, body: JSON.stringify(body) }));
  const t = await r.text();
  try { return { status: r.status, headers: r.headers, ...JSON.parse(t) }; } catch { return { status: r.status, raw: t }; }
};

console.log('\nTHE TABLE — 3 / 10 / 40, one reader');
eq('Hobbyist holds 3 pages', diaryCap(PLANS.free), 3);
eq('Bar Star holds 10', diaryCap(PLANS.plus), 10);
eq('Rock Star holds 40, the most any diary holds', diaryCap(PLANS.pro), MAX_DIARY);
eq('and the fallback for no plan at all is Hobbyist\'s', diaryCap(null), PLANS.free.diary);
const adminSrc = readFileSync(new URL('../netlify/functions/admin.mjs', import.meta.url), 'utf8');
ok('the Studio is told the size in the plan payload', /diary: diaryCap\(l\)/.test(adminSrc));

console.log('\nSETUP — an artist with a library');
const A0 = await createArtist({ email: 'diary-owner@example.com', name: 'Diary Artist', slug: 'diary-artist' });
const aid = A0.artistId, slug = A0.slug;
let reg = await readArtists();
const TO = await signToken('diary-owner@example.com', revOf(reg, aid), newSid());
const S = (body, tok = TO) => hit(admin, 'https://x/api/admin', body, tok);
const AU = (body, tok) => hit(authFn, 'https://x/api/auth', body, tok);
const GET = (q) => hit(fanFn, 'https://x/api/fan?what=diary' + q);
ok('two songs in the library', (await S({ action: 'addSong', title: 'Valerie', artist: 'Amy Winehouse' })).ok
   && (await S({ action: 'addSong', title: 'Wonderwall', artist: 'Oasis' })).ok);

console.log('\nWRITING A PAGE');
let r = await S({ action: 'diaryList' });
ok('an empty diary lists nothing, with the cap and the plan\'s name', r.ok && r.pages.length === 0 && r.cap === 3 && r.label === 'Hobbyist', r);
eq('and the field sizes the Studio counts against', [r.maxTitle, r.maxWhen, r.maxBody], [MAX_TITLE, MAX_WHEN, MAX_BODY]);
r = await S({ action: 'diarySave', page: { body: 'Some words' } });
ok('no title, no page', !r.ok && /title/.test(r.error), r);
r = await S({ action: 'diarySave', page: { title: 'Untitled feelings' } });
ok('no story, no page', !r.ok && /story/.test(r.error), r);
r = await S({ action: 'diarySave', page: { title: 'Made up', body: 'x', songId: 'not-a-song' } });
ok('a song that is not in the library is refused by id', !r.ok && /library/.test(r.error), r);
r = await S({ action: 'diarySave', page: { title: 'How Valerie found us', when: 'Winter 2019', songId: 'valerie',
  body: 'We were sound-checking in an empty room.\n\n\nSomebody hummed it.   The rest is the set.' } });
ok('a page with a title, a story, a moment and a song lands', r.ok && DIARY_ID.test(r.id), r);
const P1 = r.id;
eq('one page, the story keeps its paragraphs and loses its clutter', r.pages.map((p) => p.body),
   ['We were sound-checking in an empty room.\n\nSomebody hummed it. The rest is the set.']);
eq('the song is resolved from the library, not typed', r.pages[0].song, { id: 'valerie', title: 'Valerie', artist: 'Amy Winehouse' });
r = await S({ action: 'diarySave', page: { title: 'The night the power went', body: 'Forty people sang it for us.' } });
ok('a page with no song at all lands too', r.ok && r.pages[0].song === null, r.pages && r.pages[0]);
const P2 = r.id;
eq('and the newest is on top', r.pages.map((p) => p.id), [P2, P1]);
r = await S({ action: 'diarySave', page: { id: P2, title: 'The night the power went out', body: 'Forty people sang it for us.', on: false } });
ok('editing keeps the id and takes the new words', r.ok && r.pages[0].id === P2 && r.pages[0].title === 'The night the power went out' && r.pages[0].on === false, r.pages && r.pages[0]);
r = await S({ action: 'diarySave', page: { id: P2, on: true } });
ok('an edit that sends only the switch keeps the title, the story and the song', r.ok && r.pages[0].on === true && r.pages[0].title === 'The night the power went out' && r.pages[0].body === 'Forty people sang it for us.', r.pages && r.pages[0]);
r = await S({ action: 'diarySave', page: { title: 'T'.repeat(200), when: 'W'.repeat(100), body: 'b'.repeat(MAX_BODY + 500) } });
ok('oversize fields are cut to size, never refused', r.ok && r.pages[0].title.length === MAX_TITLE && r.pages[0].when.length === MAX_WHEN && r.pages[0].body.length === MAX_BODY, r.ok && [r.pages[0].title.length, r.pages[0].when.length, r.pages[0].body.length]);
const P3 = r.id;

console.log('\nTHE CAP — three on Hobbyist, a refusal that names the plan, and nothing deleted');
r = await S({ action: 'diarySave', page: { title: 'Four', body: 'One too many.' } });
eq('the fourth page is refused with a 402', r.status, 402);
ok('that says the number and the plan', /3 pages/.test(r.error) && /Hobbyist/.test(r.error), r.error);
r = await S({ action: 'diarySave', page: { id: P1, title: 'How Valerie found us (still)', body: 'We were sound-checking.' } });
ok('editing a page on a full diary still works', r.ok && r.pages.find((p) => p.id === P1).title === 'How Valerie found us (still)', r);
eq('and there are still three', (await readDiary(aid)).pages.length, 3);
await mutateArtists((a) => { a.byId[aid].plan = 'plus'; a.byId[aid].planUntil = Date.now() + 30 * 86400e3; return true; });
r = await S({ action: 'diarySave', page: { title: 'Four', body: 'Room now.' } });
ok('on Bar Star the fourth goes in', r.ok && r.cap === 10 && r.label === 'Bar Star', r);
for (let i = 5; i <= 10; i++) ok(`page ${i} lands`, (await S({ action: 'diarySave', page: { title: 'Page ' + i, body: 'Words.' } })).ok);
r = await S({ action: 'diarySave', page: { title: 'Eleven', body: 'No.' } });
ok('the eleventh is refused on Bar Star', r.status === 402 && /10 pages/.test(r.error) && /Bar Star/.test(r.error), r.error);
await mutateArtists((a) => { a.byId[aid].plan = 'pro'; return true; });
ok('on Rock Star it goes in', (await S({ action: 'diarySave', page: { title: 'Eleven', body: 'Yes.' } })).ok);
eq('eleven pages', (await readDiary(aid)).pages.length, 11);
// the seats come with Rock Star: a band mate and a sound engineer, for the WHO MAY WRITE section
ok('the owner adds a band mate', (await AU({ action: 'add', email: 'diary-mate@example.com', role: 'member' }, TO)).ok);
ok('and a sound engineer', (await AU({ action: 'add', email: 'diary-crew@example.com', role: 'crew' }, TO)).ok);
reg = await readArtists();
const TM = await signToken('diary-mate@example.com', revOf(reg, aid), newSid());
const TC = await signToken('diary-crew@example.com', revOf(reg, aid), newSid());
await mutateArtists((a) => { a.byId[aid].plan = 'free'; return true; });
r = await S({ action: 'diaryList' });
ok('a downgrade to Hobbyist keeps all eleven (0s)', r.ok && r.pages.length === 11 && r.cap === 3, r.ok && [r.pages.length, r.cap]);
eq('and refuses only the next', (await S({ action: 'diarySave', page: { title: 'Twelve', body: 'No.' } })).status, 402);
r = await S({ action: 'diaryRemove', id: P3 });
ok('removing is never gated', r.ok && r.pages.length === 10 && !r.pages.some((p) => p.id === P3), r.ok && r.pages.length);
{
  /* THE OWNER IS NOT SPECIAL. Every other numeric cap in _plan.mjs reads the
     founder as Rock Star; this one reads the plan like anybody's, so the first
     diary anyone sees is written under the same ceiling the pitch sells. */
  const F = (body) => hit(admin, 'https://x/api/admin?code=devlocal', body);   // the recovery key is the founder
  const before = (await readDiary(DEFAULT_ARTIST)).pages.length;
  let n = 0, last = null;
  for (let i = before; i < 4; i++) { last = await F({ action: 'diarySave', page: { title: 'Founder ' + i, body: 'Words.' } }); if (last.ok) n++; }
  eq('the founder, on the free plan, is stopped at three like anyone', (await readDiary(DEFAULT_ARTIST)).pages.length, 3);
  eq('with the same 402', last && last.status, 402);
}

console.log('\nWHAT THE PUBLIC READS');
r = await S({ action: 'diarySave', page: { id: P2, on: false } });
ok('one page hidden', r.ok && r.pages.find((p) => p.id === P2).on === false);
r = await GET('&a=' + slug);
ok('the diary page reads by slug', r.ok && r.name === 'Diary Artist' && Array.isArray(r.pages), r);
ok('and is edge-shared, fifteen seconds', /s-maxage=15/.test(r.headers.get('netlify-cdn-cache-control') || ''), r.headers.get('netlify-cdn-cache-control'));
eq('nine shown pages travel — the hidden one does not', r.pages.length, 9);
ok('and the hidden page\'s words never leave the server', !JSON.stringify(r.pages).includes('Forty people sang'), r.pages.map((p) => p.title));
ok('nothing about the plan travels either', !('cap' in r) && !('plan' in r) && !('label' in r), Object.keys(r));
const pub1 = r.pages.find((p) => p.id === P1);
eq('the song is resolved from the library', pub1 && pub1.song, { id: 'valerie', title: 'Valerie', artist: 'Amy Winehouse' });
ok('a page that names no song says so', r.pages.some((p) => p.song === null));
ok('the song id is what the page will hand to /api/lyrics', pub1 && pub1.songId === 'valerie');
r = await S({ action: 'removeSong', song: 'valerie' });
ok('the song leaves the library', r.ok, r);
r = await GET('&a=' + slug);
const pub1b = r.pages.find((p) => p.id === P1);
ok('and the page stands on its own — no song, not an error', pub1b && pub1b.song === null && pub1b.title.startsWith('How Valerie'), pub1b);
eq('an unknown slug is a 404', (await GET('&a=nobody-here')).status, 404);
r = await hit(fanFn, 'https://x/api/fan?what=profile&a=' + slug);
eq('the profile carries the count of shown pages, for the door', r.diary, 9);
r = await S({ action: 'diarySave', page: { id: P2, on: true } });
eq('showing the page again counts it', (await hit(fanFn, 'https://x/api/fan?what=profile&a=' + slug)).diary, 10);
r = await hit(fanFn, 'https://x/api/fan?what=community&a=' + slug);
eq('the community read carries the count too, for its diary card', r.diary, 10);
ok('and the first three pages\' titles and covers for the fan of tiles — never the stories', Array.isArray(r.diaryPeek) && r.diaryPeek.length === 3 && 'img' in r.diaryPeek[0] && !JSON.stringify(r).includes('"body"'), r.diaryPeek);

console.log('\nTHE COVER  (one picture per page, the page id as its slot)');
const JPEG = 'data:image/jpeg;base64,' + Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
r = await S({ action: 'diaryPhoto', id: P1, data: JPEG });
ok('a cover goes on a page', r.ok && /^\/api\/img\?a=.*&s=d[a-z0-9]{6}&v=/.test(r.url), r);
const COVER = r.url;
eq('and the page carries it', r.pages.find((p) => p.id === P1).img, COVER);
eq('a cover for a page that is not there is a 404', (await S({ action: 'diaryPhoto', id: 'dzzzzzz', data: JPEG })).status, 404);
eq('a cover that is not a picture is refused', (await S({ action: 'diaryPhoto', id: P1, data: 'data:image/jpeg;base64,aGk=' })).status, 400);
r = await S({ action: 'diarySave', page: { id: P1, title: 'Still covered', body: 'Edited.', img: '/api/img?a=x&s=avatar' } });
eq('a save never sets the cover — the request cannot point a page at another picture', r.pages.find((p) => p.id === P1).img, COVER);
ok('the reader sees the cover', (await GET('&a=' + slug)).pages.find((p) => p.id === P1).img === COVER);
const TOP = r.pages.filter((p) => p.on)[0].id;
r = await S({ action: 'diaryPhoto', id: TOP, data: JPEG });
ok('and the community card does too, for the page on top', (await hit(fanFn, 'https://x/api/fan?what=community&a=' + slug)).diaryPeek[0].img === r.url, r.url);
ok('keysFor names the cover, so leaving takes it', (await keysFor(aid)).includes(`img_${aid}_${P1}`));
r = await S({ action: 'diaryPhotoClear', id: P1 });
eq('clearing it leaves the page, uncovered', r.pages.find((p) => p.id === P1).img, '');
ok('and the bytes are gone', !__dump().has(`img_${aid}_${P1}`));

console.log('\nORDER, AND WHO MAY WRITE');
r = await S({ action: 'diaryList' });
const order = r.pages.map((p) => p.id);
r = await S({ action: 'diaryMove', id: order[1], dir: 'up' });
eq('a page moves up', r.pages.map((p) => p.id).slice(0, 2), [order[1], order[0]]);
r = await S({ action: 'diaryMove', id: order[1], dir: 'up' });
ok('and cannot move past the top', r.ok && r.moved === false, r);
eq('a band mate may write in the diary', (await S({ action: 'diarySave', page: { id: P1, title: 'Mate wrote this', body: 'Hi.' } }, TM)).ok, true);
eq('the sound engineer may not', (await S({ action: 'diarySave', page: { title: 'Crew', body: 'No.' } }, TC)).status, 403);
eq('nor remove', (await S({ action: 'diaryRemove', id: P1 }, TC)).status, 403);
eq('nor reorder', (await S({ action: 'diaryMove', id: P1, dir: 'down' }, TC)).status, 403);
eq('a stranger gets nothing', (await S({ action: 'diaryList' }, null)).status, 401);

console.log('\nTHE PAGES SAY WHAT THE SERVER ENFORCES');
const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
ok('the route sits above the catch-all', toml.indexOf('from = "/:slug/diary"') > 0 && toml.indexOf('from = "/:slug/diary"') < toml.indexOf('from = "/:slug"\n'));
ok('and has its cache header like the shop', /for = "\/:slug\/diary"/.test(toml));
{
  const d = await createArtist({ email: 'd@example.com', name: 'D', slug: 'diary' }).catch((e) => ({ err: String(e) }));
  ok('`diary` is a reserved slug — nobody can be called it', d.slug !== 'diary' && !(await readArtists()).bySlug.diary, d);
}
ok('cleanSlug leaves it, so it is the reserved list that refuses it', cleanSlug('diary') === 'diary');
const artist = readFileSync(new URL('../public/artist.html', import.meta.url), 'utf8');
ok('the artist page wears the Diary door only when there is a page (P.diary>0)', /P\.diary>0\?/.test(artist) && /\/diary/.test(artist));
const community = readFileSync(new URL('../public/community.html', import.meta.url), 'utf8');
ok('the community page draws the diary card under the shop card, only when a page is on', /d\.diary>0/.test(community) && community.indexOf('THE DIARY CARD') > community.indexOf('THE SHOP CARD (the founder, 2026-09-13): the merch') && community.includes('Read the diary'));
const page = readFileSync(new URL('../public/diary.html', import.meta.url), 'utf8');
ok('the diary page asks the one warm door', page.includes('/api/fan?what=diary'));
ok('and opens lyrics through the vote page\'s read, nothing new', page.includes('/lyrics?song=') && !page.includes('synced'));
ok('and never says the plan or the cap', !/Hobbyist|Bar Star|Rock Star/.test(page));
const studio = src(new URL('../public/studio.html', import.meta.url));
ok('the Studio counts against the server\'s cap, never a typed one', /diaryList/.test(studio) && /DIARYCAP/.test(studio) && !/\b(3|10|40) pages\b/.test(studio));
ok('and the Studio sends the song by id', /songId/.test(studio));

console.log('\nEXPORT, KEYS, DELETE');
const keys = await keysFor(aid);
ok('keysFor names the diary', keys.includes(KEY.diary(aid)));
ok('and its versions', keys.some((k) => k.startsWith(`vers_${KEY.diary(aid)}`)) || keys.some((k) => k.startsWith(`ver_${KEY.diary(aid)}_`)), keys.filter((k) => k.includes('diary')));
const exp = await exportArtist(aid);
ok('the export carries every page, hidden ones too', Array.isArray(exp.diary) && exp.diary.length === 10 && exp.diary.some((p) => p.title === 'Mate wrote this'), exp.diary && exp.diary.length);
ok('and the versions kept of it', exp.versions && Array.isArray(exp.versions.diary) && exp.versions.diary.length > 0 && exp.versions.diary[0].doc, exp.versions && Object.keys(exp.versions));
await deleteArtist(aid).catch(() => {});
const left = [...__dump().keys()].filter((k) => k.includes(`diary_${aid}`));
eq('a deleted artist leaves no diary and no versions of it behind', left, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
