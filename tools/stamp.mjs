#!/usr/bin/env node
// stamp.mjs — write each Studio script's own hash into its page's <script src="…?v=…">.
//
//   node tools/stamp.mjs
//
// /studio.js, /venue-studio.js, /biz.js, /studio-money.js and /fan.js are served
// "immutable, one year" (netlify.toml), so the URL MUST change whenever the file does
// — the stamp is the first 8 hex of the file's sha1, and test/structure.mjs fails when
// it is out of date. Run this after every edit to any of them; it is idempotent and
// prints what it did. /fan.js is the fan pages' shared script (decision 0087): nine
// pages carry its stamp, one line each.
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
  ...['index', 'artist', 'artists', 'vote', 'community', 'venue', 'about', 'shop', 'diary'].map((p) => [`public/${p}.html`, 'fan.js']),
];
/* The pages that load the fan pages' shared script — every check that reads one of them
   reads fan.js too (test/_src.mjs), and none may declare a name fan.js declares. */
export const FANPAGES = PAIRS.filter(([, js]) => js === 'fan.js').map(([page]) => page);
export const stampOf = (js) => createHash('sha1').update(js).digest('hex').slice(0, 8);
export const stampRe = (js) => new RegExp(`(["'/]${js.replace('.', '\\.')}\\?v=)[0-9a-f]{8}`);
/* app.css rides INSIDE every fan page (decision 0094): the whole file, byte for byte, between
   <style id="app-css"> and </style>, so no first paint waits on a second round trip. Run this
   after ANY edit to app.css; test/structure.mjs refuses a page whose copy is stale. The block is
   rewritten whole — nobody edits it by hand — and app.css may never contain "</style". The id is
   app-css, not app: every fan page's content container is already <div id="app">, and a second
   element with that id would be the one getElementById finds first (it was, for an hour). */
export const appBlock = (css) => `<style id="app-css">\n${css}</style>`;
export const appRe = /<style id="app-css">\n[\s\S]*?<\/style>/;
if (process.argv[1] && process.argv[1].endsWith('stamp.mjs')) {
  const css = readFileSync(new URL('public/app.css', root), 'utf8');
  if (/<\/style/i.test(css)) throw new Error('app.css must never contain </style — it rides inside every fan page');
  for (const page of FANPAGES) {
    const html = new URL(page, root);
    const before = readFileSync(html, 'utf8');
    if (!appRe.test(before)) { console.log(`inline: ${page} has no <style id="app-css"> block — add one where app.css was linked`); continue; }
    const after = before.replace(appRe, () => appBlock(css));
    if (after === before) console.log(`inline: app.css already inside ${page}`);
    else { writeFileSync(html, after); console.log(`inline: app.css written into ${page}`); }
  }
  for (const [page, js] of PAIRS) {
    const want = stampOf(readFileSync(new URL('public/' + js, root), 'utf8'));
    const html = new URL(page, root);
    const before = readFileSync(html, 'utf8');
    const after = before.replace(stampRe(js), `$1${want}`);
    if (after === before) console.log(`stamp: ${js} is ${want}, ${page} already says so`);
    else { writeFileSync(html, after); console.log(`stamp: ${js} is ${want}, ${page} updated`); }
  }
}
