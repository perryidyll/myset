// Each Studio is two files since decision 0053: the page (a shell) and its script
// (everything that was between the big <script> tags — public/studio.js,
// public/venue-studio.js). Every check that used to read a Studio page as one file
// reads the pair through here, so "appears exactly once" and "never says X" mean
// what they always meant. Since decision 0087 every fan page is a pair too: the page
// and public/fan.js, the shared script it loads before its own — a check that reads
// vote.html for a helper the page used to carry finds it in the pair.
import { readFileSync } from 'node:fs';
export function src(p) {
  let s = readFileSync(p, 'utf8');
  const name = String(p);
  if (/(^|\/)(venue-)?studio\.html$/.test(name)) {
    const j = name.replace(/studio\.html$/, 'studio.js');
    s += '\n' + readFileSync(p instanceof URL ? new URL(j) : j, 'utf8');
  }
  if (/<script src="\/fan\.js\?v=/.test(s)) {
    const j = name.replace(/[^/]+\.html$/, 'fan.js');
    s += '\n' + readFileSync(p instanceof URL ? new URL(j) : j, 'utf8');
  }
  return s;
}
