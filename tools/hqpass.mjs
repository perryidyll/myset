/* Set MySet CRM's passcode (decision 0108, INVARIANT 0hk).

   Asks for the new passcode twice and does not echo it. It then stores ONLY its salted
   scrypt hash in Netlify's HQ_PASSCODE, for the production context and marked secret.
   Deploy previews never get it, so a preview's CRM stays shut. The passcode itself goes
   nowhere, and the hash is never printed, because this repository is public.
   A new passcode locks every open CRM.

     node tools/hqpass.mjs              asks, then sets it on the live site
     node tools/hqpass.mjs --dry-run    asks and checks, sets nothing

   Netlify reads a changed variable at the next deploy. Merging a PR is one; without a
   merge, `netlify api createSiteBuild --data '{"site_id":"…"}'` starts one. */
import { spawnSync } from 'node:child_process';
import { hashPasscode, checkPasscode } from '../netlify/functions/_hqlock.mjs';

const SITE = '8f5c9f01-e1f1-47e3-add1-8dde39efd1d3';   // myset.vip
const dry = process.argv.includes('--dry-run');

function ask(q) {
  return new Promise((done) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {   // piped in: one line
      let s = ''; stdin.setEncoding('utf8');
      stdin.on('data', (c) => { s += c; }); stdin.on('end', () => done(s.replace(/\r?\n$/, '')));
      return;
    }
    stdout.write(q); stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    let s = '';
    const on = (c) => {
      for (const ch of c) {
        if (ch === '\r' || ch === '\n') { stdin.setRawMode(false); stdin.pause(); stdin.off('data', on); stdout.write('\n'); return done(s); }
        if (ch === '\u0003') { stdout.write('\n'); process.exit(130); }
        if (ch === '\u007f') s = s.slice(0, -1); else s += ch;
      }
    };
    stdin.on('data', on);
  });
}

const code = await ask('New CRM passcode: ');
if (process.stdin.isTTY && code !== await ask('Again: ')) { console.error('They differ. Nothing changed.'); process.exit(1); }
if (code.length < 8) { console.error('Eight characters at least. Nothing changed.'); process.exit(1); }

const hash = await hashPasscode(code);
if (!(await checkPasscode(code, { HQ_PASSCODE: hash })) || await checkPasscode(code + 'x', { HQ_PASSCODE: hash })) {
  console.error('The hash did not check out. Nothing changed.'); process.exit(1);
}
if (dry) { console.log('Checked: the hash opens with that passcode and nothing else. --dry-run: nothing set.'); process.exit(0); }

const r = spawnSync('netlify', ['env:set', 'HQ_PASSCODE', hash, '--context', 'production', '--secret', '--force', '--site', SITE], { encoding: 'utf8' });
if (r.status !== 0) { console.error('Netlify refused: ' + String(r.stderr || r.stdout).replace(hash, '[hash]').trim()); process.exit(1); }
console.log('HQ_PASSCODE is set for production (secret). The next deploy uses it; every open CRM will ask again.');
