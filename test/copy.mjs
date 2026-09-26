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
   /ENTER NOW TO VOTE/.test(artist) && !/TAP TO VOTE THE SETLIST/.test(artist) && !/Live now — vote the setlist/.test(artist) && !/>Join live</.test(artist));

const studio = read('public/studio.html');
/* 2026-09-12: a sed edit dropped a `// comment` in front of `.then(r=>r.json())`, so
   the Studio's profile read returned a Response object for two hours and the
   Profile tab drew blanks. The parse must be on the same statement as the fetch. */
ok('the Studio parses its profile read as JSON', /PROF=await fetch\('\/api\/profile\?t='\+Date\.now\(\)[^,]*,\{cache:'no-store'\}\)\.then\(r=>r\.json\(\)\)/.test(studio));   // [^,]*: the page's own ?a= rides after the timestamp (0075)
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
/* report.html is NOT on the theme lists below on purpose: it is a paper-white
   printable document (decision 0065, D13) with no theme.js and no dark palette. */
ok('the home-page light mode switch persists across every public page',
   /id="themeBtn"[^>]*data-theme-toggle/.test(home)&&
   /localStorage\.setItem\('myset\.theme', next\)/.test(themeScript)&&
   /:root\[data-theme=light\]/.test(theme)&&
   ['index.html','artist.html','artists.html','community.html','shop.html','diary.html','vote.html','venue.html','about.html','studio.html','venue-studio.html']
     .every(x=>read(`public/${x}`).includes('/theme.js')));
ok('light is the first-visit default on every page while a saved dark choice survives',
   /const fallback = \(\) => 'light'/.test(themeScript)&&
   ['index.html','artist.html','artists.html','community.html','shop.html','diary.html','vote.html','venue.html','about.html','studio.html','venue-studio.html','stage.html']
     .every(x=>read(`public/${x}`).includes("let t='light'")));
ok('public and Studio loading screens use the active light or dark palette',
   ['artist.html','venue.html','community.html','shop.html','diary.html'].every(x=>{
     const s=read(`public/${x}`);return /#intro\{[^}]*background:#F5F5F7/.test(s)&&/data-theme=dark\][^\n]*#intro|data-theme=dark\] #intro/.test(s);
   })&&
   ['studio.html','venue-studio.html'].every(x=>{
     const s=read(`public/${x}`);return /#boot\{[^}]*background:var\(--bg\)/.test(s)&&/html\{background:#F5F5F7\}html\[data-theme=dark\]\{background:#000\}/.test(s);
   }));
/* INVARIANT 0gf (decision 0090): a splash that moves by height freezes as three
   still dots the moment a phone starts changing page. Every page-change, boot and
   busy splash is a window (i) with a sliding pill (b) and a stretching gradient
   (b::before), moved by transform, with negative delays. */
ok('every page-change, boot and busy splash moves by transform, never height (0gf)',
   ['artist.html','venue.html','community.html','shop.html','diary.html','vote.html'].every(x=>{
     const s=read(`public/${x}`);
     return /<div class="bars"><i><b><\/b><\/i><i><b><\/b><\/i><i><b><\/b><\/i><\/div>/.test(s)&&
       /@keyframes introbar\{from\{transform:translateY\(calc\(100% - 18px\)\)\}/.test(s)&&
       /@keyframes introfill1\{from\{transform:scaleY/.test(s)&&!/@keyframes introbar\{[^}]*height/.test(s)&&
       /--d:-\.55s/.test(s)&&/prefers-reduced-motion:reduce\)\{#intro \.bars b,#intro \.bars b::before\{animation:none\}/.test(s);
   })&&
   (()=>{const s=read('public/leave.js');
     return s.includes('<i><b></b></i><i><b></b></i><i><b></b></i>')&&/@keyframes msLeaveBar\{from\{transform:translateY/.test(s)&&
       /@keyframes msLeaveFill1\{from\{transform:scaleY/.test(s)&&!/@keyframes msLeaveBar\{[^}]*height/.test(s);})()&&
   ['studio.html','venue-studio.html'].every(x=>{
     const s=read(`public/${x}`);
     return (s.match(/<div class="bars"><i><b><\/b><\/i><i><b><\/b><\/i><i><b><\/b><\/i><\/div>/g)||[]).length===3&&
       /@keyframes bb\{0%,100%\{transform:translateY\(32px\)\}/.test(s)&&/@keyframes bbfill\{0%,100%\{transform:scaleY/.test(s)&&
       !/@keyframes (bb|busybar)\{[^}]*height/.test(s)&&!/#(busy|leave|boot) \.bars i\{[^}]*animation/.test(s);
   }));
ok('both lyrics sheets read in the MySet face, one block per verse, alternate verses banded (0090)',
   /\.chartview\.stage-lyrics\{[^}]*font-family:var\(--f\)/.test(studio)&&/\.chartview\{font-family:ui-monospace/.test(studio)&&
   /\.lyr-st:nth-child\(even\)\{background:/.test(studio)&&/\.lyr-st:nth-child\(even\)\{background:/.test(vote)&&
   /b\.className='lyr-st'; b\.textContent=t/.test(studio)&&/b\.className='lyr-st'; b\.textContent=t/.test(vote)&&
   /if\(t\.closest\('\.chartview'\)\)return;/.test(studio));
ok('a tab change in either Studio opens the new tab at its top, never at the old tab\'s offset',   // the Gigs tab, 2026-09-26
   /function setTab\(t\)\{if\(t!==TAB\)window\.scrollTo\(0,0\);TAB=t;/.test(studio)&&
   /function setTab\(t\)\{ if\(t!==TAB\)window\.scrollTo\(0,0\); TAB=t;/.test(read('public/venue-studio.html')));
const report = read('public/report.html');
ok('the business report is a light-only paper document: explicit colours, noindex, and /biz.js is the only script it loads',
   !/theme\.js|data-theme|prefers-color-scheme|var\(--/.test(report)&&
   /<meta name="robots" content="noindex,nofollow" ?\/?>/.test(report)&&
   (report.match(/<script[^>]*\bsrc=/g)||[]).length===1&&/<script src="\/biz\.js\?v=[0-9a-f]{8}">/.test(report)&&
   /App<small>before fees<\/small>/.test(report)&&/goes to MySet for transaction fees/.test(report)&&!/before app fees/.test(report)&&/App money not available for/.test(report)&&
   /Stripe's monthly statement of the net is the artist's, exported from the Studio as CSV\./.test(report)&&
   Buffer.byteLength(report)<=40*1024);
ok('the $20 plan displays the same 2% transaction fee the server charges',
   /pro:\{name:'Rock Star',price:'\$20 \/ month'[\s\S]{0,1400}Transaction fee<\/span>',' – 2%/.test(studio)&&   // "Transaction fee – 2% on money…" since 2026-09-13
   !/Transaction fee<\/span>',' – 0%/.test(studio)&&
   !['studio.html','venue-studio.html','index.html','about.html','artists.html','artist.html','community.html','shop.html','vote.html']
     .some(x=>/Transaction fee: 2\.5%/.test(read(`public/${x}`))));
/* THE SHOP (2026-09-13): merch is sold on /<slug>/shop and the community page only
   opens the door. These pin the contract between the two pages and the server —
   not vocabulary: each is a literal something else depends on. */
const shop = read('public/shop.html'), community = read('public/community.html'), venueStudio = read('public/venue-studio.html');
ok('the shop asks the same fan door the community page does', /\/api\/fan\?what=community/.test(shop));
ok('a merch checkout carries kind merch and says it came from the shop, so Stripe returns there',
   /kind:'merch'/.test(shop) && /from:'shop'/.test(shop));
ok('the shop keeps its own last-seen copy, never the community page\'s', /lastSeen\.get\('shop:'/.test(shop));
ok('the shop offers Buy only where the server would take the money', /canBuy\s*&&\s*m\.cents\s*>=\s*100/.test(shop));
ok('the community page no longer sells — it wears the shop card instead',
   !/data-buy=/.test(community) && /class="shopcard/.test(community));
/* the More strip in the product sheet: a scroller, so never a place a sheet drag starts from (0f1) — since
   decision 0087 the page says so on the element (data-scroller, read by fan.js's attachDrag) — and a card swaps
   the open entry rather than stacking one — Back closes the sheet in one step. tools/sheetcheck.mjs and
   tools/uicheck.mjs prove both in a browser; this is the copy of the rule the suite can read. */
ok('the sheet\'s More strip and gallery are scrollers to the drag code, and a card swaps the history entry',
   /id="sheet"[^>]*data-scroller="\.sizes,\.more,\.gal"/.test(shop) && /mode==='swap'\)\s*history\.replaceState\(\{m:id\}/.test(shop));
/* THE FOUNDER'S SECOND LOOK (2026-09-14): the pictures at the top of the sheet under the title
   and price with the sizes beneath; no pause control; gradient step numerals; "shipping" for
   "postage" everywhere a person reads; the Paid-to line in the brand pink-orange; the Studio's
   editor opens on the photos with a count field and the rows have arrows. */
const venueStudioJs = read('public/venue-studio.html');
ok('the gallery sits under the price and above the fulfilment line', /\$\{galleryBlock\(m,out\)\}\s*<p class="lede"/.test(shop) && !/class="pic spic/.test(shop));
ok('no pause control on the strips', !/class="still"/.test(shop) && !/stillBtn/.test(shop));
ok('the step numerals are the brand gradient', /\.how i\{[^}]*background:var\(--grad\)/.test(shop));
ok('nobody reads "postage" or "posted to you" any more', ![shop, studio, venueStudioJs].some((t) => /\bpostage\b|Posted to you|posted to you|To post\b/i.test(t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, ''))));
ok('Stripe’s rate is called Shipping', /display_name: 'Shipping'/.test(read('netlify/functions/pay.mjs')));
ok('"Paid to <name> through Stripe" is pink-orange, the rest of the line is not', /<span class="paidto">Paid to \$\{esc\(d\.name\)\} through Stripe<\/span> · Apple Pay/.test(shop) && /\.paidto\{color:var\(--accent-ink\)/.test(shop));
ok('the community card rings Browse the shop and puts the first item on top', /\.shopcard \.btn::after\{[^}]*background:var\(--grad\)/.test(community) && /\.shopcard \.fan :nth-child\(1\)\{[^}]*z-index:2/.test(community));
ok('both Studios open the editor on the photos, take a count, and move items with arrows',
   [studio, venueStudioJs].every((t) => /<label>Photos<\/label>/.test(t) && /Quantity in stock \(optional\)/.test(t) && /action:'merchMove'/.test(t) && /aria-label="Move up"/.test(t)));
ok('a sold-out count reads as sold out on the shop, per size too', /m\.stock===0/.test(shop) && /v\.stock===0/.test(shop) && /Only \$\{fewLeft\(m,SIZE\)\} left/.test(shop));
ok('both Studios take a count per size under the chips, and hide the item count while there are sizes',
   [studio, venueStudioJs].every((t) => /How many of each \(optional\) — blank means as many as you like\./.test(t) && /data-vq=/.test(t) && /StockWrap"\$\{(mc|vm)Var\.length\?' hidden':''\}/.test(t)));
/* MAKE A REQUEST (the founder, 2026-09-13): the shop's button under "how it works" asks the fan
   what they'd buy, posts it as action 'wish' to the same community door, and the Studio's Merch
   store lists it. The way back to the community page is the Community crumb at the very top. */
ok('the shop’s how-block button is Make a request, and the request posts to the community door as a wish',
   /data-ask>Make a request<\/button>/.test(shop) && /action:'wish',fan:FAN/.test(shop));
ok('the way back is the Community crumb in the bar, pointed at this page’s community page',
   /class="crumb" id="crumb"/.test(shop) && /c\.href=COMMHREF/.test(shop));
ok('the fan’s earlier orders sit at the foot, without a date', /h\+=pastOrders\(\);\s*\n\s*h\+=`<div class="foot">/.test(shop) && !/o\.qty\}`:''\} · \$\{esc\(day\(o\.at\)\)\}/.test(shop));
ok('the strip is What fans are saying', /What fans are saying/.test(shop) && !/What the room said/.test(shop));
ok('the promise says shipped to your door, options per item', /or shipped to your door — options vary per item\./.test(shop));
ok('both Studios list the requests under the orders, with Done and Undo',
   /Requests from the shop/.test(studio) && /action:'wishDone'/.test(studio) && /Requests from the shop/.test(venueStudio) && /action:'wishDone'/.test(venueStudio));
/* THE MERCH STORE IN THE STUDIO (2026-09-13): merch left the Profile tab for a screen of
   its own, reached from the Menu. The alias that folded `merch` into `profile` is gone,
   the cap and the plan price come from the server, and a merch photo can be cleared. */
ok('the Studio Menu offers Profile and, second, the Merch store',
   /Profile<span>Manage your profile page<\/span>/.test(studio) &&
   /Merch store<span>Items, sizes, prices and orders<\/span>/.test(studio) &&
   studio.indexOf('Merch store<span>') > studio.indexOf('Manage your profile page') &&
   studio.indexOf('Merch store<span>') < studio.indexOf('Settings<span>'));
ok('merch is a real tab, not an alias of profile', !/TAB==='merch'\)TAB='profile'/.test(studio) && /if\(TAB==='merch'\)\{\n/.test(studio));
ok('the item cap and the plan price are the server’s, never typed',
   !/\/12<\/span>/.test(studio) && !/\/12<\/span>/.test(venueStudio) && !/\$10 a month/.test(studio) && /MERCHMAX/.test(studio) && /V\.merchMax/.test(venueStudio));
{
  /* The size, label, postage and price caps live in _profile.mjs and ride on merchList;
     a Studio that typed 8 / 24 / 220 / $100 / $500 would drift the day one moved. */
  const { MAX_VARIANTS, VARIANT_LEN, MAX_POST, MIN_CENTS, MAX_CENTS } = await import('../netlify/functions/_profile.mjs');
  const admin = read('netlify/functions/admin.mjs'), vadmin = read('netlify/functions/venueadmin.mjs');
  ok('the size, label, postage and price caps are exported once and sent by both merchLists',
     [MAX_VARIANTS, VARIANT_LEN, MAX_POST, MIN_CENTS, MAX_CENTS].every((n) => Number.isInteger(n) && n > 0) &&
     [admin, vadmin].every((f) => /maxVariants: MAX_VARIANTS, variantLen: VARIANT_LEN, maxPost: MAX_POST,\s*minCents: MIN_CENTS, maxCents: MAX_CENTS/.test(f)));
  const typed = new RegExp(`slice\\(0,${VARIANT_LEN}\\)|length>=${MAX_VARIANTS}\\)|id="[mv]{1,2}Variants" maxlength="|\\b${MAX_POST}\\b|\\b${MAX_CENTS}\\b`);
  ok('and neither Studio types them — each reads merchList’s figures and applies a cap only when it was sent',
     !typed.test(studio) && !typed.test(venueStudio) &&
     /MERCHLIM=\{maxVariants:Number\(d\.maxVariants\)\|\|0,variantLen:Number\(d\.variantLen\)\|\|0,maxPost:Number\(d\.maxPost\)\|\|0/.test(studio) &&
     /VMLIM=\{loaded:true,maxVariants:Number\(d\.maxVariants\)\|\|0,variantLen:Number\(d\.variantLen\)\|\|0,maxPost:Number\(d\.maxPost\)\|\|0/.test(venueStudio) &&
     /if\(max&&out\.length>=max\)break/.test(studio) && /if\(max&&out\.length>=max\)break/.test(venueStudio));
}
ok('both Studios can clear a merch photo and encode one as WebP first',
   /action:'merchPhotoClear'/.test(studio) && /action:'merchPhotoClear'/.test(venueStudio) &&
   /toDataURL\('image\/webp'/.test(studio) && /toDataURL\('image\/webp'/.test(venueStudio));
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
   /id="mapBtn"[^>]*hidden/.test(directory)&&/what=mapconfig/.test(directory)&&/maps\/api\/js/.test(directory)&&/navigator\.geolocation/.test(directory)&&
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
