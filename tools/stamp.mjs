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
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { scriptSrc, hashOf } from '../netlify/functions/_csp.mjs';
const root = new URL('../', import.meta.url);
export const PAIRS = [
  /* sample.js carries tips.js's stamp (it loads the decks on the artist page), so it is
     rewritten before anything takes sample.js's own stamp (decisions 0101, 0102) */
  ['public/sample.js', 'tips.js'],
  ['public/studio.js', 'biz.js'], ['public/studio.js', 'studio-money.js'], ['public/studio.js', 'sample.js'],
  ['public/venue-studio.js', 'sample.js'],
  ['public/studio.html', 'tips.js'], ['public/venue-studio.html', 'tips.js'],
  ['public/artist.html', 'sample.js'], ['public/venue.html', 'sample.js'],
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
/* on.js rides INSIDE every page in public/ (SEC-006, decision 0209): the whole file, byte for
   byte, between <script id="on-js"> and </script>, right after the page's script policy — every
   data-on-* the page or its scripts draw is wired by it, so it must run before anything else. Run
   this after ANY edit to on.js; test/structure.mjs refuses a page whose copy is stale. */
/* The copy carries the code, not the commentary — the file's comments are for whoever edits it,
   and every page would pay for them (about a kilobyte, compressed). on.js keeps its comments in
   block form for that reason; nothing else is touched. */
export const onCode = (js) => js.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).join('\n') + '\n';
export const onBlock = (js) => `<script id="on-js">\n/* public/on.js — edit that file, then run node tools/stamp.mjs (decision 0209) */\n${onCode(js)}</script>`;
export const onRe = /<script id="on-js">\n[\s\S]*?<\/script>\n?/;
/* THE PAGE'S SCRIPT POLICY, written last (decision 0209, netlify/functions/_csp.mjs): the hash of
   every inline block the page carries (on.js's included), the speculation rules leave.js adds on
   the pages that load it (read from leave.js, so a rule changed there is a new hash here), and the
   two map hosts the site header allows. A <meta> governs only what comes after it, so it sits
   right after the charset, ahead of every script. */
export const MAP_HOSTS = ['https://maps.googleapis.com', 'https://maps.gstatic.com'];
export const cspRe = /<meta http-equiv="Content-Security-Policy" content="[^"]*">\n?/;
export const CHARSET = /<meta charset="utf-8"\s*\/?>\n/i;
export function speculationText(leaveJs) {
  const m = /sr\.textContent = '([^'\\]*)';/.exec(leaveJs);
  if (!m) throw new Error('leave.js: the speculation rules are no longer a plain string — the policy cannot name them');
  return m[1];
}
export function pagePolicy(html, leaveJs) {
  const extra = /<script[^>]*\ssrc="\/leave\.js"/.test(html) ? [hashOf(speculationText(leaveJs))] : [];
  return `<meta http-equiv="Content-Security-Policy" content="script-src ${scriptSrc(html, [...extra, ...MAP_HOSTS])}">`;
}
/* The page with on.js and its policy in place — what stamp writes and what the test expects. */
export function withPolicy(html, onJs, leaveJs) {
  let out = html.replace(cspRe, '').replace(onRe, '');
  if (!CHARSET.test(out)) throw new Error('no <meta charset="utf-8"> line to put the script policy after');
  out = out.replace(CHARSET, (m) => m + onBlock(onJs) + '\n');
  return out.replace(CHARSET, (m) => m + pagePolicy(out, leaveJs) + '\n');
}
export const PAGES = readdirSync(new URL('public/', root)).filter((f) => f.endsWith('.html')).sort().map((f) => 'public/' + f);
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
  const onJs = readFileSync(new URL('public/on.js', root), 'utf8');
  if (/<\/script/i.test(onJs)) throw new Error('on.js must never contain </script — it rides inside every page');
  const leaveJs = readFileSync(new URL('public/leave.js', root), 'utf8');
  for (const page of PAGES) {
    const html = new URL(page, root);
    const before = readFileSync(html, 'utf8');
    const after = withPolicy(before, onJs, leaveJs);
    if (after === before) console.log(`policy: ${page} already current`);
    else { writeFileSync(html, after); console.log(`policy: on.js and the script policy written into ${page}`); }
  }
}
