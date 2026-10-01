/* tools/serversecret.mjs, run against a fake `netlify` and a fake `security` (the
   Keychain) put first on PATH (decision 0112, HARDENING.md §0). Nothing real is touched.

   What it must never do: print the value, set it where Netlify would show it
   (Local development, or without the secret flag), make a second value over one that
   is already in Netlify, or leave the only copy of a value nowhere but Netlify. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, chmodSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + ' \n      ' + JSON.stringify(detail)); }
};
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

const SITE = '8f5c9f01-e1f1-47e3-add1-8dde39efd1d3';
const dir = mkdtempSync(join(tmpdir(), 'serversecret-'));
const NET = join(dir, 'netlify.json'), KC = join(dir, 'keychain.json');

/* The fake Netlify keeps variables as { KEY: { secret, values: { context: value } } } and
   answers env:list the way the real one does: a context's value, or 'all', masked when
   secret. Its errors repeat the value back, so a tool that forwarded them raw would leak. */
writeFileSync(join(dir, 'netlify'), `#!/usr/bin/env node
const fs = require('fs'), F = ${JSON.stringify(NET)};
const st = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : { vars: {} };
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i < 0 ? null : a[i + 1]; };
(st.calls ||= []).push(a.join(' '));
const save = () => fs.writeFileSync(F, JSON.stringify(st));
if (st.loggedOut) { save(); console.error('Not logged in. Please log in to run this command.'); process.exit(1); }
if (opt('--site') !== ${JSON.stringify(SITE)}) { save(); console.error('Project not found'); process.exit(1); }
if (a[0] === 'env:list') {
  const c = opt('--context'), out = {};
  for (const [k, v] of Object.entries(st.vars)) {
    const val = v.values[c] ?? v.values.all;
    if (val !== undefined) out[k] = v.secret && c !== 'dev' ? '*'.repeat(16) : val;
  }
  save(); console.log((st.banner || '') + JSON.stringify(out, null, 2)); process.exit(0);
}
if (a[0] === 'env:set') {
  const [, k, val] = a, c = opt('--context');
  if (st.failSetOn === c) { save(); console.error('Error: could not set ' + k + '=' + val + ' in ' + c); process.exit(1); }
  st.vars[k] ||= { secret: false, values: {} };
  if (a.includes('--secret') && !st.ignoreSecret) st.vars[k].secret = true;
  st.vars[k].values[c] = val;
  save(); console.log('Set environment variable ' + k + '=' + val + ' in the ' + c + ' context'); process.exit(0);
}
save(); console.error('unknown command ' + a[0]); process.exit(2);
`);
writeFileSync(join(dir, 'security'), `#!/usr/bin/env node
const fs = require('fs'), F = ${JSON.stringify(KC)};
const st = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : { items: {} };
const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i < 0 ? null : a[i + 1]; };
const id = opt('-a') + '|' + opt('-s');
if (a[0] === 'find-generic-password') {
  if (id in st.items) { console.log(st.items[id]); process.exit(0); }
  console.error('security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.'); process.exit(44);
}
if (a[0] === 'add-generic-password') {
  if (st.failAdd) { console.error('security: SecKeychainItemCreateFromContent: User interaction is not allowed.'); process.exit(36); }
  if (id in st.items) { console.error('The specified item already exists in the keychain.'); process.exit(45); }
  st.items[id] = opt('-w'); fs.writeFileSync(F, JSON.stringify(st)); process.exit(0);
}
process.exit(2);
`);
chmodSync(join(dir, 'netlify'), 0o755); chmodSync(join(dir, 'security'), 0o755);

const TOOL = resolve('tools/serversecret.mjs');
const run = (...args) => {
  const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
  return { code: r.status, text: (r.stdout || '') + (r.stderr || '') };
};
const net = () => (existsSync(NET) ? JSON.parse(readFileSync(NET, 'utf8')) : { vars: {} });
const kc = () => (existsSync(KC) ? JSON.parse(readFileSync(KC, 'utf8')) : { items: {} });
const setNet = (o) => writeFileSync(NET, JSON.stringify({ vars: {}, ...o }));
const setKc = (o) => writeFileSync(KC, JSON.stringify({ items: {}, ...o }));
const KCID = 'myset.vip|MYSET_SECRET';
const fresh = () => { setNet({}); setKc({}); };

console.log('\nA FIRST RUN  made here, kept in the Keychain, set where Netlify hides it');
fresh();
{
  const r = run();
  const v = net().vars.MYSET_SECRET, copy = kc().items[KCID];
  eq('it finishes and says so', [r.code, /^Done\./m.test(r.text)], [0, true]);
  ok('the value is 64 hex characters, 32 random bytes', /^[0-9a-f]{64}$/.test(copy || ''), copy && copy.length);
  eq('set for exactly Production, Deploy Previews and Branch deploys — never Local development, never "all"', Object.keys(v.values).sort(), ['branch-deploy', 'deploy-preview', 'production']);
  ok('…the same value in each, the one in the Keychain', Object.values(v.values).every((x) => x === copy));
  eq('…and marked secret', v.secret, true);
  ok('the value is never printed', !r.text.includes(copy), r.text);
  ok('it tells the person where the copy is and that Netlify will not show it again', /Keychain Access/.test(r.text) && /never show it again/.test(r.text));
  ok('every call named the site by its id', net().calls.every((c) => c.includes(`--site ${SITE}`)));
}

console.log('\nA SECOND RUN  refused: changing it is a rotation');
{
  const before = JSON.stringify([net().vars, kc()]);
  const r = run();
  ok('refused, naming where it already is', r.code === 1 && /already in Netlify \(Production, Deploy Previews, Branch deploys\)/.test(r.text), r.text);
  eq('…and nothing changed, in Netlify or the Keychain', JSON.stringify([net().vars, kc()]), before);
}

console.log('\nA KEYCHAIN COPY AND AN EMPTY NETLIFY  the copy goes back, no new value is made');
{
  const copy = kc().items[KCID];
  setNet({});
  const r = run();
  eq('it finishes', r.code, 0);
  ok('Netlify gets the Keychain\'s value in all three', Object.values(net().vars.MYSET_SECRET.values).every((x) => x === copy) && Object.keys(net().vars.MYSET_SECRET.values).length === 3);
  ok('…and says so', /the value your Keychain already held/.test(r.text), r.text);
  eq('…with the Keychain untouched', kc().items[KCID], copy);
}

console.log('\n--dry-run  looks, changes nothing');
fresh();
{
  const r = run('--dry-run');
  ok('it says what a real run would do', r.code === 0 && /would make a new one/.test(r.text) && /nothing changed/.test(r.text), r.text);
  eq('…and nothing was written', [net().vars, kc().items], [{}, {}]);
}

console.log('\nWHEN THINGS GO WRONG  never the value on screen, always what to do next');
fresh();
setNet({ loggedOut: true });
{
  const r = run();
  ok('not logged in: says to run netlify login, and that nothing changed', r.code === 1 && /netlify login/.test(r.text) && /Nothing changed/.test(r.text), r.text);
  eq('…and made no value', kc().items, {});
}
fresh();
setNet({ failSetOn: 'deploy-preview' });
{
  const r = run();
  const copy = kc().items[KCID];
  ok('Netlify refuses the second context: says it may be partly set and to tell Claude', r.code === 1 && /Deploy Previews/.test(r.text) && /partly set/.test(r.text), r.text);
  ok('…the error Netlify gave is shown with the value hidden', /\[hidden\]/.test(r.text) && !r.text.includes(copy), r.text);
  ok('…and the Keychain copy is kept', /^[0-9a-f]{64}$/.test(copy || ''));
}
fresh();
setNet({ failSetOn: 'production' });
{
  const r = run();
  ok('refused at the first context: nothing set in Netlify, the next run uses the Keychain copy', r.code === 1 && /Nothing was set in Netlify/.test(r.text) && /next run uses it/.test(r.text), r.text);
}
fresh();
setNet({ ignoreSecret: true });
{
  const r = run();
  const copy = kc().items[KCID];
  ok('a value Netlify would show in the clear is caught, with the fix in words', r.code === 1 && /NOT hidden/.test(r.text) && /Contains secret values/.test(r.text), r.text);
  ok('…without printing it', !r.text.includes(copy));
}
fresh();
setNet({ vars: { MYSET_SECRET: { secret: false, values: { all: 'x'.repeat(64) } } } });
{
  const r = run();
  ok('one typed in by hand for every context, Local development included, is refused', r.code === 1 && /Local development/.test(r.text) && /Nothing changed/.test(r.text), r.text);
}
fresh();
setKc({ items: { [KCID]: 'not one of ours' } });
{
  const r = run();
  ok('a Keychain item this tool did not make is left alone', r.code === 1 && /did not make/.test(r.text) && net().vars.MYSET_SECRET === undefined, r.text);
}
fresh();
setKc({ failAdd: true });
{
  const r = run();
  ok('no copy in the Keychain, no value in Netlify', r.code === 1 && /Could not keep a copy/.test(r.text) && net().vars.MYSET_SECRET === undefined, r.text);
}
fresh();
setNet({ banner: '› Warning: a newer netlify-cli is available\n' });
{
  const r = run();
  eq('an update notice in front of the JSON does not confuse it', r.code, 0);
}

console.log('\nTHE ONE LINE  piped into node from outside any checkout, as the curl line runs it');
fresh();
{
  const r = spawnSync(process.execPath, ['--input-type=module'], { input: readFileSync(TOOL, 'utf8'), cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${dir}:${process.env.PATH}` } });
  const copy = kc().items[KCID];
  ok('it runs from a pipe, needing nothing from the repository', r.status === 0 && /^Done\./m.test(r.stdout) && Object.keys(net().vars.MYSET_SECRET.values).length === 3, (r.stdout || '') + (r.stderr || ''));
  ok('…and prints no value there either', !((r.stdout || '') + (r.stderr || '')).includes(copy));
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
