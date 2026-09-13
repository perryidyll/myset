/* Step 2: every page's inline script parses, every script file parses, and every
   function imports. */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), 'myset-syntax-'));
let fail = 0;

for (const page of readdirSync(join(root, 'public')).filter((f) => f.endsWith('.html'))) {
  const src = readFileSync(join(root, 'public', page), 'utf8');
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]);
  if (!blocks.length) { console.log(`  – ${page}: no inline script`); continue; }
  const f = join(tmp, page + '.js');
  writeFileSync(f, blocks.join('\n;\n'));
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
        console.log(`  ✓ ${page}`); }
  catch (e) { fail++; console.log(`  ✗ ${page}\n${e.stderr}`); }
}

/* The scripts a page loads by `src` were skipped by the block above (its regex
   excludes them on purpose — they are files, not fragments), so until 0065 nothing
   in the suite parsed studio.js at all: a syntax error there passed every check and
   was caught in a browser, or in production. Anything under vendor/ is somebody
   else's and is left alone. */
for (const f of readdirSync(join(root, 'public')).filter((x) => x.endsWith('.js')).sort()) {
  try { execFileSync(process.execPath, ['--check', join(root, 'public', f)], { stdio: 'pipe' });
        console.log(`  ✓ ${f}`); }
  catch (e) { fail++; console.log(`  ✗ ${f}\n${e.stderr}`); }
}

for (const f of readdirSync(join(root, 'netlify/functions')).filter((x) => x.endsWith('.mjs'))) {
  try { await import(join(root, 'netlify/functions', f)); console.log(`  ✓ ${f}`); }
  catch (e) { fail++; console.log(`  ✗ ${f}: ${e.message}`); }
}
console.log(fail ? `\n${fail} syntax check(s) FAILED` : '\nsyntax OK');
process.exit(fail ? 1 : 0);
