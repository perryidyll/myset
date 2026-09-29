/* THE TIP DECKS, THE PRACTICE ROUND AND THE SAMPLE LAYER — what the phone runs
   (decisions 0101, 0102).

   Pins:
     · every Studio tab, artist and venue, has a deck; every deck the code asks for
       exists; every slide draws a picture that exists
     · the words keep their rules: one sentence a slide, short, four slides at most
       for a tab, and a paid feature names its plan
     · the practice round cannot write: act(), askDo() and load() hand over to it
       first, and it never calls the API
     · a sample's Studio sends its key, never the phone's own sign-in, and a save
       opens the claim sheet
     · the banner says exactly what the founder asked for, on one line, with no "!" */
import { readFileSync } from 'node:fs';
const read = (f) => readFileSync(new URL('../public/' + f, import.meta.url), 'utf8');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail === undefined ? '' : '\n      ' + JSON.stringify(detail))); } };

/* tips.js in a pretend window: it only needs somewhere to hang itself */
const tipsSrc = read('tips.js');
const win = {};
new Function('window', 'document', 'localStorage', tipsSrc)(win, {}, { getItem: () => null, setItem() {} });
const T = win.Tips;
ok('tips.js hangs one object on the window', !!(T && T.decks && T.open && T.first));
const D = T.decks;
const glyphs = new Set([...tipsSrc.matchAll(/^\s{4}([a-z]+): '<(?:g|circle|rect|path)/gm)].map((m) => m[1]));

console.log('\nEVERY TAB HAS A DECK');
const studio = read('studio.js');
const artistTabs = ['live', 'setlist', 'gigs', 'money', 'profile', 'merch', 'diary', 'messages', 'settings'];
for (const t of artistTabs) ok(`artist Studio: ${t}`, !!D[t]);
for (const t of ['v-page', 'v-shows', 'v-numbers', 'v-merch', 'v-menu', 'v-settings']) ok(`Venue Studio: ${t}`, !!D[t]);
const deckOf = /const DECKOF=\{([^}]*)\}/.exec(studio);
ok('studio.js maps every tab it has to a deck', deckOf && artistTabs.every((t) => new RegExp(`\\b${t}:'${t}'`).test(deckOf[1])), deckOf && deckOf[1]);
const asked = new Set([...studio.matchAll(/Tips\.(?:first|open)\('([a-z-]+)'/g)].map((m) => m[1]));
for (const id of asked) ok(`the deck studio.js asks for exists: ${id}`, !!D[id]);
const sampleSrc = read('sample.js');
for (const id of [...sampleSrc.matchAll(/'((?:v-)?welcome)'/g)].map((m) => m[1])) ok(`the deck sample.js asks for exists: ${id}`, !!D[id]);

console.log('\nTHE WORDS');
const tabDecks = [...artistTabs, 'v-page', 'v-shows', 'v-numbers', 'v-merch', 'v-menu', 'v-settings'];
for (const [id, deck] of Object.entries(D)) {
  const long = deck.s.filter(([, line]) => line.length > 118);
  const multi = deck.s.filter(([, line]) => (line.replace(/\b(e\.g|a\.m|p\.m)\./g, '').match(/[.!?](\s|$)/g) || []).length > 1);
  const noArt = deck.s.filter(([g]) => !glyphs.has(g));
  ok(`${id}: one short sentence a slide, a picture that exists`, !long.length && !multi.length && !noArt.length, { long, multi, noArt });
}
for (const id of tabDecks) ok(`${id}: four slides at most (five on Money)`, D[id].s.length >= 1 && D[id].s.length <= (id === 'money' ? 5 : 4));
const all = (id) => D[id].s.map(([, l]) => l).join(' ');
ok('merch names its plan (Bar Star)', /Bar Star/.test(all('merch')));
ok('the tick names the paid plans', /paid plans/.test(all('settings')));
ok('five sign-ins name Rock Star', /Rock Star/.test(all('settings')));
ok('a venue’s merch and tick name Pro', /Pro/.test(all('v-merch')) && /Pro/.test(all('v-settings')));
ok('the practice round says nothing is saved, up front', /nothing is saved/i.test(D['pr-start'].s[0][1]));
ok('no slide shouts', !Object.values(D).some((d) => d.s.some(([, l]) => /!!|[A-Z]{6,}/.test(l))));

console.log('\nTHE PRACTICE ROUND CANNOT WRITE');
ok('act() hands over to it before anything else', /async function act\(action,extra=\{\}\)\{\n  if\(PRACTICE\)\{ practiceAct\(action,extra\); return; \}/.test(studio));
ok('askDo() does too', /async function askDo\(action,id\)\{\n  if\(PRACTICE\)\{ practiceAct\(action,\{id\}\); return; \}/.test(studio));
ok('load() refuses to paint over it', /async function load\(opts\)\{\n  if\(PRACTICE\) return;/.test(studio));
const pr = studio.slice(studio.indexOf('const PRSONGS='), studio.indexOf('/* THE SAMPLE ROUTER'));
ok('its code never calls the API', pr.length > 2000 && !/\bapi\(|fetch\(/.test(pr.replace(/function sampleSeen[\s\S]*?\n}\n/, '')), pr.length);
ok('it has thirty songs', (/const PRSONGS=\[([\s\S]*?)\];/.exec(studio)[1].match(/\['/g) || []).length === 30);
ok('it will not start over a real show', /if\(D\.show\.status==='live'\)\{ toast\('Your show is live/.test(studio));
ok('leaving the Live tab ends it', /TAB=t;if\(PRACTICE&&t!=='live'\)practiceEnd\(true\);/.test(studio));
ok('its bursts say they are practice', /PRACTICE\?\(votes\?'Practice · votes bought':'Practice · a tip'\)/.test(studio));

console.log('\nA SAMPLE’S STUDIO');
ok('the key, never the phone’s own sign-in', /if\(SAMPLE\)\{ CODE=''; TOKEN=''; ASLUG=SAMPLE\.slug; \}/.test(studio)
   && /if\(SAMPLE\)\{ h\['x-sample-key'\]=SAMPLE\.key; h\['x-admin-artist'\]=SAMPLE\.slug; \}/.test(studio));
ok('a save opens the claim sheet instead of leaving the phone', /openClaim\(\);\n  return Promise\.resolve\(\{ok:false,claim:true/.test(studio));
const reads = /const SAMPLE_READS=new Set\(\[([^\]]*)\]\)/.exec(studio)[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)).sort();
const server = /const SAMPLE_OK = new Set\(\[([\s\S]*?)\]\);/.exec(readFileSync(new URL('../netlify/functions/admin.mjs', import.meta.url), 'utf8'))[1].match(/'(\w+)'/g).map((x) => x.slice(1, -1)).sort();
ok('the phone’s list of reads is the server’s list', JSON.stringify(reads) === JSON.stringify(server), { reads, server });
ok('Claim profile stands where the plan badge stands', /\$\{SAMPLE\?`<button class="claimbtn" onclick="openClaim\(\)">Claim profile<\/button>`\s*:PLAN&&PLAN\.ok\?/.test(studio));

console.log('\nTHE PAGE');
ok('the banner says exactly that, with no "!"', />Sample profile page – not published<\/div>/.test(sampleSrc) && !/not published!/i.test(sampleSrc));
const ban = sampleSrc.slice(sampleSrc.indexOf('.sbx-ban{'), sampleSrc.indexOf('overflow:hidden}', sampleSrc.indexOf('.sbx-ban{')));
ok('one line: no wrapping, uppercase, pink-orange on black in a pink-orange ring',
   /white-space:nowrap/.test(ban) && /text-transform:uppercase/.test(ban) && ban.includes('background:#000;color:${O}')
   && ban.includes('box-shadow:inset 0 0 0 1.5px ${O}') && /const O = '#FF5650'/.test(sampleSrc), ban);
ok('Claim profile is exactly as wide as the banner (one grid, both full width)', /\.sbx-in\{[^}]*display:grid/.test(sampleSrc) && /\.sbx-claim\{[^}]*width:100%/.test(sampleSrc));
ok('and overlaps nothing: the page is pushed down by the two', /body\.sampled\{padding-top:var\(--sbh/.test(sampleSrc) && /--sbh', `\$\{bar\.offsetHeight/.test(sampleSrc));
ok('Share and the menu give way to View your Studio, the switch left of it', /#shareBtn, details\.menu/.test(sampleSrc) && /acts\.appendChild\(b\)/.test(sampleSrc));
ok('no Remove on the page: a word to the founder deletes it (the founder’s call)', !/Remove this page|action: 'remove'/.test(sampleSrc) && sampleSrc.includes('<b>Don’t want it?</b> Let us know'));
const artist = read('artist.html');
const venuePg = read('venue.html');
ok('the page reads the label, #sample-profile or ?sample-profile, and leaves it on the address', [artist, venuePg].every((h) =>
  h.includes("/[#?&]sample-profile(?![\\w-])/.test(location.hash+'&'+location.search)") && !h.includes("history.replaceState(null,'',location.pathname)}")));
ok('a claimed page is shown at its bare address, so the label cannot ask for the preview again and again', /location\.replace\(location\.pathname\)/.test(sampleSrc) && !/location\.reload\(\)/.test(sampleSrc));
ok('a sample’s page is never drawn from the phone’s last copy', /if\(window\.__sample\)\{[\s\S]{0,1200}return;\n  \}\n  \/\* Two fetches, not three/.test(artist));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
