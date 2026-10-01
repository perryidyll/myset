/* Set MYSET_SECRET, the server's own secret (decision 0112, HARDENING.md §0).

   Makes a fresh random value on this Mac, keeps a copy in the login Keychain, and sets
   it in Netlify for Production, Deploy Previews and Branch deploys, marked secret. Never
   Local development: Netlify shows a value there to anyone who can open the project,
   secret or not. The value is never printed, and it leaves this Mac only for Netlify.

   Why a copy in the Keychain: Netlify never shows a secret value again, and the day it
   has to change (HARDENING.md §0, a rotation) the old value is needed to re-wrap the
   keyring. Without a copy, changing it would lose every sealed record.

   It refuses if MYSET_SECRET is already in Netlify, in any context: changing it is a
   rotation, never a second run of this. If a Keychain copy already exists (a run that
   stopped half way, or a variable deleted by mistake) it puts THAT value back rather
   than making a new one.

     node tools/serversecret.mjs              sets it
     node tools/serversecret.mjs --dry-run    looks at Netlify and the Keychain, sets nothing

   It needs nothing from this repository, so it also runs on its own:
     curl -fsSL https://raw.githubusercontent.com/perryidyll/myset/<commit>/tools/serversecret.mjs | node --input-type=module

   Netlify reads a new variable at the next deploy; the merge of the pull request that
   carries decision 0112 is that deploy. */
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const SITE = '8f5c9f01-e1f1-47e3-add1-8dde39efd1d3';   // myset.vip
const KEY = 'MYSET_SECRET';
const CONTEXTS = ['production', 'deploy-preview', 'branch-deploy'];
const NAMES = { production: 'Production', 'deploy-preview': 'Deploy Previews', 'branch-deploy': 'Branch deploys', dev: 'Local development' };
const KC = ['-a', 'myset.vip', '-s', KEY];
const dry = process.argv.includes('--dry-run');

let value = '', saved = false, changed = false;
const after = () => (changed ? 'It may be partly set: tell Claude before running this again. Your Keychain copy is kept.'
  : saved ? 'Nothing was set in Netlify. The value is kept in your Keychain, and the next run uses it.' : 'Nothing changed.');
const scrub = (t) => (value ? String(t || '').split(value).join('[hidden]') : String(t || '')).trim();
const say = (t) => console.log(scrub(t));
const stop = (t) => { console.error(scrub(t)); process.exit(1); };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', timeout: 60e3 });
  return { ok: r.status === 0, missing: !!(r.error && r.error.code === 'ENOENT'), status: r.status, out: r.stdout || '', err: r.stderr || (r.error ? r.error.message : '') };
};
const listed = (ctx) => {
  const r = run('netlify', ['env:list', '--context', ctx, '--json', '--site', SITE]);
  if (r.missing) stop(`The Netlify command-line tool is not installed on this Mac. ${after()}`);
  if (!r.ok) stop(`Netlify did not answer (${scrub(r.err || r.out).split('\n')[0]}).\nIf it says you are not logged in, run: netlify login — then run this again. ${after()}`);
  const o = r.out, a = o.indexOf('{'), b = o.lastIndexOf('}');
  try { return a < 0 ? {} : JSON.parse(o.slice(a, b + 1)); } catch { stop(`Netlify answered in a shape this tool does not know. ${after()}`); }
};
const keychain = () => {
  const r = run('security', ['find-generic-password', ...KC, '-w']);
  if (r.missing) stop('This needs a Mac: it keeps a copy in the Keychain. Nothing changed.');
  return r.ok ? r.out.trim() : '';
};

/* 1 · Netlify must not have it anywhere yet. */
const there = [...CONTEXTS, 'dev'].filter((c) => KEY in listed(c));
if (there.length) stop(`${KEY} is already in Netlify (${there.map((c) => NAMES[c]).join(', ')}). Nothing changed.\nChanging it is a rotation (HARDENING.md §0), not a second run of this.`);

/* 2 · The value: the Keychain's copy if there is one, else a fresh one. */
const kept = keychain();
if (kept && !/^[0-9a-f]{64}$/.test(kept)) stop(`There is a ${KEY} in your Keychain that this tool did not make. Nothing changed.`);
if (dry) {
  say(`Netlify has no ${KEY} yet. ${kept ? 'Your Keychain holds a copy, which a real run would put back.' : 'A real run would make a new one and keep a copy in your Keychain.'}\n--dry-run: nothing changed.`);
  process.exit(0);
}
value = kept || randomBytes(32).toString('hex');
if (!kept) {
  const add = run('security', ['add-generic-password', ...KC, '-l', 'MySet server secret (MYSET_SECRET)',
    '-j', 'Netlify variable for myset.vip. Never delete: changing it later needs this value.', '-w', value]);
  if (!add.ok || keychain() !== value) stop(`Could not keep a copy in your Keychain (${scrub(add.err).split('\n')[0] || 'it did not read back'}). Nothing was set in Netlify.`);
  saved = true;
}

/* 3 · Set it, one context at a time, marked secret. */
for (const c of CONTEXTS) {
  const r = run('netlify', ['env:set', KEY, value, '--context', c, '--secret', '--force', '--site', SITE]);
  if (!r.ok) stop(`Netlify refused ${NAMES[c]} (${scrub(r.err || r.out).split('\n')[0]}).\n${after()}`);
  changed = true;
}

/* 4 · Read it back: there in every context, never in the clear, and not in Local development. */
for (const c of CONTEXTS) {
  const got = listed(c);
  if (!(KEY in got)) stop(`Netlify does not show ${KEY} for ${NAMES[c]} after setting it. ${after()}`);
  if (String(got[KEY]).includes(value)) stop(`${KEY} is set for ${NAMES[c]} but NOT hidden. In Netlify: Environment variables → ${KEY} → Options → Edit → tick "Contains secret values". Then tell Claude.`);
}
if (KEY in listed('dev')) stop(`${KEY} also shows up in Local development, where Netlify never hides it. Tell Claude.`);

say(`Done. ${KEY} is set in Netlify for Production, Deploy Previews and Branch deploys, marked secret.
${kept ? 'It is the value your Keychain already held.' : 'A copy is in your Keychain (open Keychain Access and search MYSET_SECRET).'} Netlify will never show it again; keep that copy.
Nothing uses it until the security pull request merges.`);
