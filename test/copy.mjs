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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
