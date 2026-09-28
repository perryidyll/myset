/* THE ARTIST ON THEIR OWN SHARE CARD  (artistpage.mjs, the /:slug rule — decision 0097)

   A link to an artist's page, pasted into a chat, showed the MySet icon. Pins:
     · /:slug is served by the function, which carries artist.html with it
     · the card shows the portrait, else the cover, else the MySet icon — absolute
     · og:title is the artist's name, escaped; og:url and twitter tags are added once
     · an unknown slug, and a page with no og:image, come back untouched
     · the page's body is byte for byte artist.html
     · the site-wide headers the function sends equal netlify.toml's, and the CDN
       keeps it on the durable cache */
process.env.ADMIN_CODE = 'devlocal';
const { readFileSync } = await import('node:fs');
const page = (await import('../netlify/functions/artistpage.mjs'));
const handler = page.default;
const { shareImage, withShare, SITE_HEADERS, FALLBACK_IMAGE } = page;
const { createArtist } = await import('../netlify/functions/_auth.mjs');
const { mutateProfile } = await import('../netlify/functions/_profile.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });
const toml = readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../public/artist.html', import.meta.url), 'utf8');
const meta = (html, k) => ((html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1]);

console.log('\nTHE ROUTE');
ok('/:slug goes to the function, with the slug', /from = "\/:slug"\n  to = "\/\.netlify\/functions\/artistpage\?a=:slug"\n  status = 200/.test(toml));
ok('which carries artist.html with it', /\[functions\.artistpage\]\n  included_files = \["public\/artist\.html"\]/.test(toml));

console.log('\nTHE PICTURE');
eq('the portrait first', shareImage({ avatar: '/api/img?a=x&s=avatar&v=1', photo: '/img/band.jpg' }), 'https://myset.vip/api/img?a=x&s=avatar&v=1');
eq('else the cover', shareImage({ avatar: '', photo: '/img/band.jpg' }), 'https://myset.vip/img/band.jpg');
eq('an https picture as it is', shareImage({ avatar: 'https://cdn.example/p.jpg' }), 'https://cdn.example/p.jpg');
eq('never a protocol-relative or http one', shareImage({ avatar: '//evil.example/p.jpg', photo: 'http://x/p.jpg' }), FALLBACK_IMAGE);
eq('nothing at all: the MySet icon', shareImage({}), 'https://myset.vip/icons/icon-512.png');

console.log('\nTHE CARD');
const out = withShare(shell, { name: 'Ana "A" <Reyes>', image: 'https://myset.vip/img/a.jpg', url: 'https://myset.vip/ana' });
eq('og:image', meta(out, 'og:image'), 'https://myset.vip/img/a.jpg');
eq('og:title is the name, escaped', meta(out, 'og:title'), 'Ana &quot;A&quot; &lt;Reyes&gt;');
eq('og:url', meta(out, 'og:url'), 'https://myset.vip/ana');
eq('the large card', meta(out, 'twitter:card'), 'summary_large_image');
eq('twitter:image', meta(out, 'twitter:image'), 'https://myset.vip/img/a.jpg');
eq('each tag once', (out.match(/og:image"/g) || []).length, 1);
ok('everything below the head is the file as it is', out.slice(out.indexOf('</head>')) === shell.slice(shell.indexOf('</head>')));
eq('a page with no og:image is left alone', withShare('<head></head>', { name: 'x', image: 'y', url: 'z' }), '<head></head>');

console.log('\nTHE FUNCTION');
const ana = await createArtist({ email: 'ana@example.com', name: 'Ana Reyes', slug: 'ana-reyes' });
await mutateProfile(ana.artistId, (p) => { p.name = 'Ana Reyes'; p.avatar = '/api/img?a=ana-reyes&s=avatar&v=k1'; return true; });
let r = await handler(new Request('https://myset.vip/.netlify/functions/artistpage?a=ana-reyes'));
let h = await r.text();
eq('200, html', [r.status, r.headers.get('content-type')], [200, 'text/html; charset=utf-8']);
eq('her portrait on the card (& escaped, as HTML wants it)', meta(h, 'og:image'), 'https://myset.vip/api/img?a=ana-reyes&amp;s=avatar&amp;v=k1');
eq('her name as its title', meta(h, 'og:title'), 'Ana Reyes');
eq('her address', meta(h, 'og:url'), 'https://myset.vip/ana-reyes');
r = await handler(new Request('https://myset.vip/ana-reyes'));
eq('the slug from the path when the rewrite drops the query', meta(await r.text(), 'og:title'), 'Ana Reyes');
r = await handler(new Request('https://myset.vip/.netlify/functions/artistpage?a=nobody-here'));
eq('an unknown slug: artist.html untouched', await r.text(), shell);
eq('the phone keeps it a minute, as before', r.headers.get('cache-control'), 'public, max-age=60, stale-while-revalidate=600');
ok('the CDN keeps it on the durable cache', /^public, durable, s-maxage=\d+/.test(r.headers.get('netlify-cdn-cache-control') || ''));

console.log('\nAN ACCOUNT ON ITS WAY OUT HAS NO CARD  (0dh, decision 0098)');
/* Deleting takes the page dark on day one — every public read of it 404s through
   publicArtist — but this door resolved the slug on its own, so a pasted link still
   put the name and the portrait into the chat. */
{
  const { startDeletion, cancelDeletion } = await import('../netlify/functions/_account.mjs');
  const bo = await createArtist({ email: 'bo@example.com', name: 'Bo Lind', slug: 'bo-lind' });
  await mutateProfile(bo.artistId, (p) => { p.name = 'Bo Lind'; p.avatar = '/api/img?a=bo-lind&s=avatar&v=b1'; return true; });
  const page = () => handler(new Request('https://myset.vip/.netlify/functions/artistpage?a=bo-lind')).then((x) => x.text());
  eq('the card, before', meta(await page(), 'og:title'), 'Bo Lind');
  ok('the account is deleted', (await startDeletion(bo.artistId, 'bo@example.com')).ok);
  const left = await page();
  eq('THE BUG: no name on the card of a page that has gone dark', meta(left, 'og:title'), meta(shell, 'og:title'));
  eq('and no portrait', meta(left, 'og:image'), meta(shell, 'og:image'));
  ok('the page left behind is artist.html untouched', left === shell);
  ok('Undo', (await cancelDeletion(bo.artistId)).ok);
  eq('and the card comes back with the page', meta(await page(), 'og:title'), 'Bo Lind');
}

console.log('\nA NAME THAT IS A REPLACEMENT PATTERN IS WRITTEN AS ITSELF (0110)');
{
  const out = withShare(shell, { name: "$' $& $1 Band", image: 'https://myset.vip/i.png', url: 'https://myset.vip/x' });
  eq('the name, once, exactly (& escaped as HTML wants it)', meta(out, 'og:title'), "$' $&amp; $1 Band");
  ok('and the page did not swallow a copy of itself', out.length < shell.length + 600, out.length - shell.length);
}

console.log('\nTHE SITE-WIDE HEADERS, EQUAL TO NETLIFY.TOML’S');
const block = toml.slice(toml.indexOf('for = "/*"'), toml.indexOf('[[headers]]', toml.indexOf('for = "/*"')));
for (const [k, v] of Object.entries(SITE_HEADERS)) {
  const m = block.match(new RegExp(`^\\s*${k} = "(.*)"$`, 'm'));
  eq(k, m && m[1], v);
  eq(k + ' is sent', r.headers.get(k), v);
}
const tomlKeys = [...block.matchAll(/^\s*([A-Za-z-]+) = "/gm)].map((m) => m[1]).filter((k) => k !== 'for');
eq('and no site-wide header is missing', tomlKeys.filter((k) => !(k in SITE_HEADERS)), []);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
