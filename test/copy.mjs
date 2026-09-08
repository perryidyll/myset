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
ok('the venue tick reads "✓ Verified"', /✓ Verified/.test(venue));
ok('and its absence "Unverified listing"', /Unverified listing/.test(venue));
ok('the artist tick reads "✓ Verified" too', /✓ Verified/.test(artist));
ok('and is gated on the payload', /P\.verified\?/.test(artist));
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
