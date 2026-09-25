/* WHERE PUPPETEER LIVES. The browser-driven checkers (uicheck, sheetcheck, clipcheck)
   need puppeteer-core, which is deliberately not a dependency of this repo (there are
   two and it stays that way). It used to be imported from a hand-typed path into the
   content repo — which moved, and every checker died silently on 2026-09-20. This
   resolves it by CONTENT: the MYSET_PUPPETEER variable first, then the places it has
   actually been, and says plainly where it looked when none has it. */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
const CANDIDATES = [
  process.env.MYSET_PUPPETEER,
  `${homedir()}/Docs/MySet Social Media/myset-content-tools-and-rules/node_modules/puppeteer-core`,
  `${homedir()}/Docs/MySet-Content/node_modules/puppeteer-core`,
].filter(Boolean);
const ENTRY = '/lib/esm/puppeteer/puppeteer-core.js';
const hit = CANDIDATES.find((d) => existsSync(d + ENTRY));
if (!hit) { console.error('puppeteer-core not found. Looked in:\n  ' + CANDIDATES.join('\n  ') + '\nSet MYSET_PUPPETEER=/path/to/node_modules/puppeteer-core'); process.exit(2); }
export default (await import(hit + ENTRY)).default;
export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
