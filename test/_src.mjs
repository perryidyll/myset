// Each Studio is two files since decision 0053: the page (a shell) and its script
// (everything that was between the big <script> tags — public/studio.js,
// public/venue-studio.js). Every check that used to read a Studio page as one file
// reads the pair through here, so "appears exactly once" and "never says X" mean
// what they always meant.
import { readFileSync } from 'node:fs';
export function src(p) {
  let s = readFileSync(p, 'utf8');
  const name = String(p);
  if (/(^|\/)(venue-)?studio\.html$/.test(name)) {
    const j = name.replace(/studio\.html$/, 'studio.js');
    s += '\n' + readFileSync(p instanceof URL ? new URL(j) : j, 'utf8');
  }
  return s;
}
