#!/usr/bin/env node
// stamp.mjs — write each Studio script's own hash into its page's <script src="…?v=…">.
//
//   node tools/stamp.mjs
//
// /studio.js and /venue-studio.js are served "immutable, one year" (netlify.toml),
// so the URL MUST change whenever the file does — the stamp is the first 8 hex of
// the file's sha1, and test/structure.mjs fails when it is out of date. Run this
// after every edit to either script; it is idempotent and prints what it did.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
export const PAIRS = [['public/studio.html', 'studio.js'], ['public/venue-studio.html', 'venue-studio.js']];
export const stampOf = (js) => createHash('sha1').update(js).digest('hex').slice(0, 8);
for (const [page, js] of PAIRS) {
  const want = stampOf(readFileSync(new URL('public/' + js, root), 'utf8'));
  const html = new URL(page, root);
  const before = readFileSync(html, 'utf8');
  const after = before.replace(new RegExp(`(src="/${js.replace('.', '\\.')}\\?v=)[0-9a-f]+"`), `$1${want}"`);
  if (after === before) console.log(`stamp: ${js} is ${want}, ${page} already says so`);
  else { writeFileSync(html, after); console.log(`stamp: ${js} is ${want}, ${page} updated`); }
}
