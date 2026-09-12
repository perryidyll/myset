#!/usr/bin/env node
// stamp.mjs — write studio.js's own hash into studio.html's <script src="/studio.js?v=…">.
//
//   node tools/stamp.mjs
//
// /studio.js is served "immutable, one year" (netlify.toml), so the URL MUST change
// whenever the file does — the stamp is the first 8 hex of the file's sha1, and
// test/structure.mjs fails when it is out of date. Run this after every edit to
// public/studio.js; it is idempotent and prints what it did.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const stampOf = (js) => createHash('sha1').update(js).digest('hex').slice(0, 8);
const want = stampOf(readFileSync(new URL('public/studio.js', root), 'utf8'));
const html = new URL('public/studio.html', root);
const before = readFileSync(html, 'utf8');
const after = before.replace(/(src="\/studio\.js\?v=)[0-9a-f]+"/, `$1${want}"`);
if (after === before) console.log(`stamp: studio.js is ${want}, studio.html already says so`);
else { writeFileSync(html, after); console.log(`stamp: studio.js is ${want}, studio.html updated`); }
