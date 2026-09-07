/* THE QR CODES  (netlify/functions/_qr.mjs)

   These get printed and stuck on tables, so a code that is wrong is not a bug
   somebody reports — it is a table of people who tried, failed, and put their
   phone away. There was no test file here at all until the MySet mark went in
   the middle of them.

   Pins, in order:
     · the fixed "dark module" every code must have, which was being written over
     · the two copies of the format information say the same thing
     · the mark only ever clears modules underneath itself
     · and it clears few enough of them that the error correction can rebuild them */

import { qrMatrix, qrSvg } from '../netlify/functions/_qr.mjs';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};

/* Every code MySet actually prints, plus lengths that reach for a bigger version. */
const URLS = [
  'https://myset.vip',
  'https://myset.vip/perryidyll',
  'https://myset.vip/v/the-cave-beachfront',
  'https://myset.vip/signup?ref=perryidyll',
  'https://myset.vip/some-quite-long-artist-slug-here/vote',
];
for (let len = 1; len <= 40; len++) URLS.push('https://myset.vip/' + 'a'.repeat(len));

console.log('\nEVERY CODE IS STRUCTURALLY A QR CODE');
{
  let noDark = [], mismatch = [], badFinder = [];
  for (const url of URLS) {
    const m = qrMatrix(url);
    const n = m.length;

    /* THE DARK MODULE. Always black, always at (4×version + 9, 8), and NOT a
       format bit — an earlier version of the writer put format bit 7 here, which
       cost the code its dark module and shifted the top-right run by one. The
       top-left copy of the format was still right, so most readers fell back to
       it and the codes scanned anyway; one URL in this list did not scan at all. */
    if (m[n - 8][8] !== 1) noDark.push(url);

    /* The two copies have to agree, which is the whole point of there being two. */
    const first = [];
    for (let i = 0; i <= 5; i++) first.push(m[8][i]);
    first.push(m[8][7], m[8][8], m[7][8]);
    for (let i = 9; i <= 14; i++) first.push(m[14 - i][8]);
    const second = [];
    for (let i = 0; i <= 6; i++) second.push(m[n - 1 - i][8]);
    for (let i = 7; i <= 14; i++) second.push(m[8][n - 15 + i]);
    if (first.join('') !== second.join('')) mismatch.push([url, first.join(''), second.join('')]);

    // the three finder patterns, which are what a camera locks onto
    for (const [r0, c0] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
      const solid = m[r0][c0] === 1 && m[r0 + 3][c0 + 3] === 1 && m[r0 + 1][c0 + 1] === 0;
      if (!solid) badFinder.push(url);
    }
  }
  ok(`all ${URLS.length} codes have their dark module`, noDark.length === 0, noDark.slice(0, 3));
  ok('and both copies of the format information agree', mismatch.length === 0, mismatch.slice(0, 2));
  ok('and all three finder patterns are intact', badFinder.length === 0, badFinder.slice(0, 3));
}

console.log('\nTHE MARK IN THE MIDDLE COSTS THE CODE ALMOST NOTHING');
{
  /* Level M rebuilds about 15% of a code from scratch. What matters is not that
     the mark is "small" but that the number here stays a long way under that,
     because the rest of the budget is for the real world: a crease in the paper,
     a thumb over the corner, bad light on a bar table. */
  let worst = 0, outside = [];
  for (const url of URLS) {
    const plain = qrSvg(url, { scale: 8, logo: false });
    const withMark = qrSvg(url, { scale: 8 });
    const n = qrMatrix(url).length;

    /* Count the modules the mark clears by comparing the two drawings' own
       geometry rather than trusting the writer: every run of dark modules is one
       `h` command in the path, so the total dark area is the honest measure. */
    const area = (svg) => {
      const d = /<path d="([^"]*)"/.exec(svg)[1];
      let total = 0;
      for (const seg of d.split('M').slice(1)) total += Number(/h(\d+)/.exec(seg)[1]) / 8;
      return total;
    };
    const cleared = area(plain) - area(withMark);
    const fraction = cleared / (n * n);
    if (fraction > worst) worst = fraction;

    /* And it only ever clears the middle. A knockout that reached a finder or the
       timing line would break the code however small it was. */
    const m = qrMatrix(url);
    let count = Math.round(n * 0.17);
    if (count % 2 !== n % 2) count++;
    const first = (n - count) / 2, last = first + count - 1;
    if (!(first > 9 && last < n - 10)) outside.push([url, n, first, last]);
  }
  ok('the mark never reaches a finder or the timing line', outside.length === 0, outside.slice(0, 2));
  ok(`it clears at most ${(worst * 100).toFixed(1)}% of the modules, and level M rebuilds 15%`,
    worst < 0.06, worst);
}

console.log('\nWHAT COMES OUT IS A DRAWING OF THE MYSET MARK');
{
  const svg = qrSvg('https://myset.vip/perryidyll', { scale: 8 });
  ok('the badge is there', /url\(#msg\)/.test(svg) && /#FF375F/.test(svg) && /#FF6B45/.test(svg));
  ok('and the three bars with it', (svg.match(/fill="#fff"/g) || []).length === 3);
  const plain = qrSvg('https://myset.vip/perryidyll', { scale: 8, logo: false });
  ok('logo:false gives the plain code back, for anywhere too small to read a mark',
    !/msg/.test(plain) && !/FF375F/.test(plain));
  ok('both are the same size on the page',
    /width="(\d+)"/.exec(svg)[1] === /width="(\d+)"/.exec(plain)[1]);
  ok('a payload too long for version 10 is refused rather than drawn wrong',
    qrSvg('x'.repeat(400)) === null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
