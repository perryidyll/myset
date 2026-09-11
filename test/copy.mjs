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

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const read = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

console.log('\nFIXED LABELS  the strings other things lean on');
const venue = read('public/venue.html'), artist = read('public/artist.html'), vote = read('public/vote.html');
const home = read('public/index.html'), theme = read('public/app.css');
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
   /localStorage\.setItem\('myset\.theme', next\)/.test(read('public/theme.js'))&&
   /:root\[data-theme=light\]/.test(theme)&&
   ['index.html','artist.html','artists.html','community.html','vote.html','venue.html','about.html','studio.html','venue-studio.html']
     .every(x=>read(`public/${x}`).includes('/theme.js')));
ok('the Studio scrolling windows use a clipping shell around the native scrollbar',
   /class="scroll-shell queue-shell"><div class="list scroll-window queue-window"/.test(studio)&&
   /class="scroll-shell setlist-shell"><div class="list scroll-window setlist-window"/.test(studio));
ok('the Studio Live tab label is red',
   /button\[data-tab-live\]\{color:#FF375F\}/.test(studio)&&/button data-tab-live/.test(studio));
ok('the home page links to the artist directory and its requested filters',
   /href="\/artists">Search for artists/.test(home)&&
   /MySet shows in next 30 days/.test(directory)&&/Music released/.test(directory)&&/Signed/.test(directory)&&
   /All countries/.test(directory)&&/All cities/.test(directory)&&/All styles/.test(directory)&&/Any rating/.test(directory));
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
