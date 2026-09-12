// The Studio is two files since decision 0053: public/studio.html (the shell) and
// public/studio.js (everything that was between its <script> tags). Every check that
// used to read studio.html as one file reads the pair through here, so "appears
// exactly once" and "never says X" mean what they always meant.
import { readFileSync } from 'node:fs';
export function src(p) {
  let s = readFileSync(p, 'utf8');
  const name = String(p);
  if (/(^|\/)studio\.html$/.test(name)) {
    const js = p instanceof URL ? new URL(name.replace(/studio\.html$/, 'studio.js')) : name.replace(/studio\.html$/, 'studio.js');
    s += '\n' + readFileSync(js, 'utf8');
  }
  return s;
}
