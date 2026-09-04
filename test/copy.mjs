/* WHAT THE PUBLIC READS  (no hook, no store — this only reads files)

   Perry's word for the people in the room is "fans" (2026-09-04). The old word
   must not creep back into anything a stranger can read: the eight public pages,
   the manifests, and the two Guide-tab strings the Google Sheet export writes.
   Code comments are not copy and are left alone; so is the one quoted testimonial
   in the Studio, which is somebody's own words.

   And the fixed labels that other tests, docs and the venue page lean on must
   survive every rewrite. */
import { readFileSync, readdirSync } from 'node:fs';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};
const read = (rel) => readFileSync(new URL('../' + rel, import.meta.url), 'utf8');

/* Strip comments and script bodies' comments so only rendered copy is judged. A
   `/* … *\/` block and a `// …` line are never shown to anyone. */
const copyOnly = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
  .replace(/<!--[\s\S]*?-->/g, '');

console.log('\nTHE WORD IS FANS  nothing a stranger reads says "audience"');
const pages = readdirSync(new URL('../public/', import.meta.url)).filter((f) => /\.(html|webmanifest)$/.test(f));
for (const f of pages) {
  const body = copyOnly(read('public/' + f));
  const hits = [...body.matchAll(/\baudiences?\b/gi)]
    // the founder's own quoted words in the Studio's plan note stay his
    .filter((m) => !/interact more with my audiences/.test(body.slice(m.index - 40, m.index + 40)));
  ok(`${f} — ${hits.length ? hits.length + ' left' : 'clean'}`, hits.length === 0,
     hits.slice(0, 3).map((m) => body.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\s+/g, ' ')));
}
const guide = read('netlify/functions/_warehouse.mjs');
ok('the Sheet’s Guide tab says fans', !/'[^']*\baudience\b[^']*'/i.test(guide.replace(/\/\*[\s\S]*?\*\//g, '')));

console.log('\nFIXED LABELS  the strings other things lean on');
const venue = read('public/venue.html'), artist = read('public/artist.html'), vote = read('public/vote.html');
ok('the venue tick reads "✓ Verified"', /✓ Verified/.test(venue));
ok('and its absence "Unverified listing"', /Unverified listing/.test(venue));
ok('the artist tick reads "✓ Verified" too', /✓ Verified/.test(artist));
ok('and is gated on the payload', /P\.verified\?/.test(artist));
ok('an unverified artist page shows NO chip (not a warning about a person)', !/Unverified/.test(artist));
ok('lyrics stay "Unofficial lyrics"', /Unofficial lyrics/.test(vote));
ok('the stats row says Fans', /'Fans'\]/.test(artist));
ok('and the Community button sits in the stats grid', /class="ps cta"/.test(artist));
ok('the voting box says Voting, big and orange', /class="votebox"[\s\S]{0,120}class="vt">Voting</.test(read('public/studio.html')));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
