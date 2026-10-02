/* NO KIND OF DOCUMENT SHIPS WITHOUT A SECOND HOME, OR A REASON  (decision 0146)

   The off-site copy takes what it is told about. Every batch that added a new kind
   of document — the CRM, the sample pages, the media dashboard — had no reason to
   think of the mirror, and by 2 October 2026 a dozen kinds had no copy anywhere but
   Netlify. Nothing failed; nobody was told.

   So the suite tells. test/run.sh names a file in MYSET_KEYLOG, every test process
   appends each key it wrote (test/blobs-fake.mjs), and this file — the last step of
   the run — asks one question of every key: does _mirror.mjs FAMILIES say who
   copies this kind, or why nobody does? A key that matches no line fails the run
   with its name, and the fix is one line in that table plus, for an owner's
   document, its place in keysFor() or keysForVenue() (INVARIANT 0hs). */
import { readFileSync } from 'node:fs';
const { familyOf } = await import('../netlify/functions/_mirror.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail)); }
};

const file = process.env.MYSET_KEYLOG;
if (!file) {
  console.log('  · no key log: this file reads what the whole suite wrote, so it runs from test/run.sh');
  process.exit(0);
}
let keys = [];
try { keys = [...new Set(readFileSync(file, 'utf8').split('\n').filter(Boolean))]; } catch {}
/* Keys a test writes to prove something about the store itself, not the app's. */
const SCAFFOLD = /^(log_test_|cas_test|probe_)/;
const real = keys.filter((k) => !SCAFFOLD.test(k));
const by = { owner: 0, global: 0, skip: 0 };
const unknown = [];
for (const k of real) { const f = familyOf(k); if (f) by[f.how]++; else unknown.push(k); }

console.log('\nEVERY KEY THE SUITE WROTE');
ok(`the log is the whole suite's, not a stub (${real.length} keys)`, real.length > 500, real.length);
ok('every one is a kind the off-site copy takes, or one it says why not', unknown.length === 0, unknown.slice(0, 40));
ok('and all three answers are in use', by.owner > 100 && by.global > 20 && by.skip > 50, by);
console.log(`    ${by.owner} an owner's, ${by.global} global, ${by.skip} never copied`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
