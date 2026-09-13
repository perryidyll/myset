#!/usr/bin/env node
// stamp.mjs — write each Studio script's own hash into its page's <script src="…?v=…">.
//
//   node tools/stamp.mjs
//
// /studio.js, /venue-studio.js, /biz.js and /studio-money.js are served "immutable,
// one year" (netlify.toml), so the URL MUST change whenever the file does — the
// stamp is the first 8 hex of the file's sha1, and test/structure.mjs fails when it
// is out of date. Run this after every edit to any of them; it is idempotent and
// prints what it did.
//
// PAIRS is ORDERED: studio.js carries the stamps of the two dashboard scripts it
// loads on demand, so those are rewritten first and studio.js's own stamp is taken
// of the result — the other way round, studio.html would point at a studio.js that
// no longer exists. The regex matches a `src="…"` attribute and a '/…' string alike.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
export const PAIRS = [
  ['public/studio.js', 'biz.js'], ['public/studio.js', 'studio-money.js'],
  ['public/report.html', 'biz.js'],
  ['public/studio.html', 'studio.js'], ['public/venue-studio.html', 'venue-studio.js'],
];
export const stampOf = (js) => createHash('sha1').update(js).digest('hex').slice(0, 8);
export const stampRe = (js) => new RegExp(`(["'/]${js.replace('.', '\\.')}\\?v=)[0-9a-f]{8}`);
if (process.argv[1] && process.argv[1].endsWith('stamp.mjs')) {
  for (const [page, js] of PAIRS) {
    const want = stampOf(readFileSync(new URL('public/' + js, root), 'utf8'));
    const html = new URL(page, root);
    const before = readFileSync(html, 'utf8');
    const after = before.replace(stampRe(js), `$1${want}`);
    if (after === before) console.log(`stamp: ${js} is ${want}, ${page} already says so`);
    else { writeFileSync(html, after); console.log(`stamp: ${js} is ${want}, ${page} updated`); }
  }
}
