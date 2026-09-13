/* WHAT THE PUBLIC READS  (no hook, no store — this only reads files)

   The fixed labels that other tests, docs and the venue page lean on must survive
   every rewrite. That is all this file does now.

   RETIRED 2026-09-06, at Perry's instruction: this used to fail the build if the
   word "audience" appeared anywhere a stranger could read, on the grounds that his
   word was "fans". It policed vocabulary rather than truth, it fired on his own
   copy, and he wants it gone. Do not reinstate it. If a word genuinely matters,
   pin the ONE label that something else depends on — the way the checks below do —
   rather than banning a synonym across every page. */
import { readFileSync } from 'node:fs';
import { src } from './_src.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const read = (rel) => src(new URL('../' + rel, import.meta.url));

console.log('\nFIXED LABELS  the strings other things lean on');
const venue = read('public/venue.html'), artist = read('public/artist.html'), vote = read('public/vote.html');
const home = read('public/index.html'), theme = read('public/app.css'), themeScript = read('public/theme.js');
const directory = read('public/artists.html');
ok('the venue tick reads "✓ Verified"', /✓ Verified/.test(venue));
ok('and its absence "Unverified listing"', /Unverified listing/.test(venue));
ok('the artist tick reads "✓ Verified" too', /✓ Verified/.test(artist));
ok('and is gated on the payload', /P\.verified\?/.test(artist));
ok('directory style is not rendered on the public artist profile', !/P\.style/.test(artist));
ok('an unverified artist page shows NO chip (not a warning about a person)', !/Unverified/.test(artist));
ok('lyrics stay "Unofficial lyrics"', /Unofficial lyrics/.test(vote));
ok('and the Community button sits in the stats grid', /class="ps cta"/.test(artist));
ok('the voting box says Voting, big and orange', /class="votebox"[\s\S]{0,120}class="vt">Voting</.test(read('public/studio.html')));
ok('the audience vote counter labels its x/x value as votes',
   /\$\{freeRemaining\}<small>\/\$\{freeTotal\} votes<\/small>/.test(vote));
ok('an out-of-votes voting sheet offers “Buy more votes”',
   /<button class="go" onclick="openBuy\(\)">Buy more votes<\/button>/.test(vote));
ok('the voting sheet omits the manual-refresh instruction',
   !/please pull down on your screen/.test(vote) && !/see the current list now/.test(vote));
ok('the live profile has one vote CTA with the requested label',
   /TAP TO VOTE THE SETLIST/.test(artist) && !/Live now — vote the setlist/.test(artist) && !/>Join live</.test(artist));

const studio = read('public/studio.html');
/* 2026-09-12: a sed edit dropped a `// comment` in front of `.then(r=>r.json())`, so
   the Studio's profile read returned a Response object for two hours and the
   Profile tab drew blanks. The parse must be on the same statement as the fetch. */
ok('the Studio parses its profile read as JSON', /PROF=await fetch\('\/api\/profile\?t='\+Date\.now\(\),\{cache:'no-store'\}\)\.then\(r=>r\.json\(\)\)/.test(studio));
ok('the Artist Studio defaults to Setlist', /getItem\('myset\.tab'\)\|\|'setlist'/.test(studio));
ok('the live song offers the delegated Lyrics action', /data-act="lyrics"[\s\S]{0,240}>Lyrics</.test(studio));
ok('Lyrics, Auto chords and My chart remain separate ordered actions',
   /data-act="lyrics"[\s\S]{0,500}data-act="autochords"[\s\S]{0,220}data-act="chart"/.test(studio));
ok('the request promise covers votes and cards', /your votes come straight back and your card is never charged/.test(read('public/vote.html')));
ok('the install bar subtext is orange and the bar pulses',
   /\.a2hs \.m span\{[^}]*color:var\(--accent-ink\)/.test(home)&&/\.a2hs\{[^}]*animation:a2hsGlow/.test(home));
ok('Auto chords resolves a direct Ultimate Guitar chart without copying it into MySet',
   /action:'chordsLink'/.test(studio)&&/tab\.location\.replace\(url\)/.test(studio)&&/MySet never copies or republishes the chart/.test(studio));
ok('lyrics wrap inside both audience and Studio sheets',
   /\.lyr\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/.test(vote)&&
   /\.chartview\.stage-lyrics\{[^}]*white-space:pre-wrap[^}]*overflow-wrap:anywhere/.test(studio));
ok('the home-page light mode switch persists across every public page',
   /id="themeBtn"[^>]*data-theme-toggle/.test(home)&&
   /localStorage\.setItem\('myset\.theme', next\)/.test(themeScript)&&
   /:root\[data-theme=light\]/.test(theme)&&
   ['index.html','artist.html','artists.html','community.html','vote.html','venue.html','about.html','studio.html','venue-studio.html']
     .every(x=>read(`public/${x}`).includes('/theme.js')));
ok('light is the first-visit default on every page while a saved dark choice survives',
   /const fallback = \(\) => 'light'/.test(themeScript)&&
   ['index.html','artist.html','artists.html','community.html','vote.html','venue.html','about.html','studio.html','venue-studio.html','stage.html']
     .every(x=>read(`public/${x}`).includes("let t='light'")));
ok('public and Studio loading screens use the active light or dark palette',
   ['artist.html','venue.html','community.html'].every(x=>{
     const s=read(`public/${x}`);return /#intro\{[^}]*background:#F5F5F7/.test(s)&&/data-theme=dark\][^\n]*#intro|data-theme=dark\] #intro/.test(s);
   })&&
   ['studio.html','venue-studio.html'].every(x=>{
     const s=read(`public/${x}`);return /#boot\{[^}]*background:var\(--bg\)/.test(s)&&/html\{background:#F5F5F7\}html\[data-theme=dark\]\{background:#000\}/.test(s);
   }));
ok('the $20 plan displays the same 2% transaction fee the server charges',
   /pro:\{name:'Rock Star',price:'\$20 \/ month'[\s\S]{0,1400}Transaction fee<\/span>',' – 2%/.test(studio)&&   // "Transaction fee – 2% on money…" since 2026-09-13
   !/Transaction fee<\/span>',' – 0%/.test(studio)&&
   !['studio.html','venue-studio.html','index.html','about.html','artists.html','artist.html','community.html','vote.html']
     .some(x=>/Transaction fee: 2\.5%/.test(read(`public/${x}`))));
ok('Find artists is server-gated to effectively verified artists before cards or map data are built',
   /artist\.verified\s*&&\s*planOf\(artist\)\s*!==\s*'free'/.test(read('netlify/functions/artists.mjs')));
ok('Settings clearly says verified profiles alone appear in search, the show list and map',
   /Only verified profiles appear in Find artists search results, including the day-by-day show list and map\./.test(studio));
ok('the first Settings visit shows the requested verification notice once per artist',
   /myset\.verify-search-intro\.'\+aid/.test(studio)&&
   /<h3>verify your account now<\/h3>/.test(studio)&&
   /only verified profiles will show up in search results!/.test(studio)&&
   /this is to minimize fraudulent use and ensure the best experience for MySet audiences/.test(studio)&&
   /\.sheet\.verify-intro\{[^}]*top:50%;bottom:auto[^}]*border-radius:var\(--r-lg\)/.test(studio)&&
   /#sheet\.verify-intro\.on\{transform:translateX\(-50%\) translateY\(-50%\)/.test(studio)&&
   /\.verify-intro \.verify-lede\{color:var\(--accent-2\)/.test(studio));
const renderAt = studio.indexOf('function render()');
const setlistAt = studio.indexOf("if(TAB==='setlist'){", renderAt);
const setlistBlock = studio.slice(setlistAt, studio.indexOf("if(TAB==='gigs')", setlistAt));
const addAt = setlistBlock.indexOf('>Add a song</span>');
const importAt = setlistBlock.indexOf('>⇪ Import songs</button>');
const organizeAt = setlistBlock.indexOf('${setPick()}');
const learnAt = setlistBlock.indexOf('${learnSection()}');
const fansAt = setlistBlock.indexOf('>See what fans see ↗</a>');
const clearAt = setlistBlock.indexOf('>Clear setlist</button>');
ok('Setlist actions follow the requested order',
   /class="big alt orange-outline"[^>]*onclick="openLists\(\)"[^>]*>Organize your songs into setlists</.test(studio)&&
   addAt >= 0 && importAt > addAt && organizeAt > importAt && learnAt > organizeAt && fansAt > learnAt && clearAt > fansAt);
ok('Decline + refund appears on Live only, never Setlist',
   /Decline \+ refund votes/.test(studio.slice(studio.indexOf("if(TAB==='live')"), studio.indexOf("if(TAB==='setlist')"))) &&
   !/Decline \+ refund votes/.test(setlistBlock));
ok('the starter-pack UI and server feature are removed',
   !/starter pack|starterSetlist/i.test(studio)&&
   !/STARTER_SONGS|starterSetlist/.test(read('netlify/functions/_lib.mjs'))&&
   !/STARTER_SONGS|starterSetlist/.test(read('netlify/functions/admin.mjs')));
ok('the plans popup contains no placeholder testimonials',
   !/TESTIMONIALS|What MySet members have to say|Sample artist|Sample duo|Sample band/.test(studio));
ok('the Studio scrolling windows use a clipping shell around the native scrollbar',
   /class="scroll-shell queue-shell"><div class="list scroll-window queue-window"/.test(studio)&&
   /class="scroll-shell setlist-shell"><div class="list scroll-window setlist-window"/.test(studio));
ok('the Studio Live tab label is red',
   /button\[data-tab-live\]\{color:#FF375F\}/.test(studio)&&/button data-tab-live/.test(studio));
ok('the home page links to the artist directory and its requested filters',
   /class="artistactions"[\s\S]{0,240}id="homeMapBtn"[^>]*><svg[^>]*>[\s\S]{0,160}<\/svg>View on MAP<\/button>[\s\S]{0,120}href="\/artists">Search for artists/.test(home)&&
   /id="homeMapModal"[^>]*hidden[^>]*aria-modal="true"/.test(home)&&
   /MySet shows in next 30 days/.test(directory)&&/Music released/.test(directory)&&/Signed/.test(directory)&&
   /All countries/.test(directory)&&/All cities/.test(directory)&&/All styles/.test(directory)&&/Any rating/.test(directory));
ok('the artist directory map is readiness-gated and the CSP permits its Google services',
   /id="mapBtn"[^>]*hidden/.test(directory)&&/api\/mapconfig/.test(directory)&&/maps\/api\/js/.test(directory)&&/navigator\.geolocation/.test(directory)&&
   /URLSearchParams\(location\.search\)\.get\('map'\)==='1'/.test(directory)&&
   /https:\/\/maps\.googleapis\.com/.test(read('netlify.toml')));
ok('both public maps place pins from saved coordinates rather than address guesses',
   /const homeCoords=e=>e\.maps&&Number\.isFinite\(e\.maps\.lat\)/.test(home)&&
   /const canPin=e=>hasCoords\(e\)/.test(directory)&&!/new maps\.Geocoder/.test(directory));
ok('Featured shows remain a $10 first-come city promotion',
   /Featured shows/.test(home)&&/featureStart/.test(studio)&&/\$10/.test(studio)&&/first come, first served/i.test(studio));
ok('each upcoming gig offers Feature before Edit and cancel',
   /openPromote\('\$\{esc\(o\.eventId\)\}','\$\{esc\(o\.date\)\}'\)">Feature<\/button>[\s\S]{0,180}>Edit<\/button>[\s\S]{0,180}>✕<\/button>/.test(studio));
ok('the promotion sheet leads with larger orange bullet points',
   /\.promotelede\{[^}]*color:var\(--accent-2\)[^}]*font-size:16px/.test(studio)&&
   /<ul class="promotelede">[\s\S]{0,500}<li>Only \$\{F\.slots\} spots/.test(studio));
const requestsAt = studio.indexOf('<span class="kick">Requests from fans</span>');
const autoAt = studio.indexOf('<span class="kick">Starting by itself</span>');
const paymentsAt = studio.indexOf('<span class="kick">Payments</span>');
ok('Starting by itself follows Requests from fans in Settings',
   requestsAt >= 0 && autoAt > requestsAt && paymentsAt > autoAt);
ok('Settings omits the retired gig, voting and new-show controls',
   !/Tonight's gig/.test(studio) && !/New show \(reset everything\)/.test(studio) &&
   !/id="f(?:Venue|City|Time)"/.test(studio) && !/function saveGig\(\)/.test(studio));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
