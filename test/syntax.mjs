/* Step 2: every page's inline script parses, and every function imports. */
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

for (const f of readdirSync(join(root, 'netlify/functions')).filter((x) => x.endsWith('.mjs'))) {
  try { await import(join(root, 'netlify/functions', f)); console.log(`  ✓ ${f}`); }
  catch (e) { fail++; console.log(`  ✗ ${f}: ${e.message}`); }
}
console.log(fail ? `\n${fail} syntax check(s) FAILED` : '\nsyntax OK');
process.exit(fail ? 1 : 0);
