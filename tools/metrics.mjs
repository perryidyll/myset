#!/usr/bin/env node
/* CURRENT SHOW STATS — the snapshot, read from production, and the page.

   Read-only. Every document is fetched with `netlify blobs:get` signed in as the
   site owner (the same access tools/prod.py and tools/backup.py use); nothing is
   written to the store. No `list()` (INVARIANT 1): the registries name every
   artist and venue, and every other key is computed from an id.

   usage
     node tools/metrics.mjs                       # print the snapshot JSON
     node tools/metrics.mjs --out snap.json       # write it
     node tools/metrics.mjs --html OUT.html       # fill finance/metrics.html with it
     node tools/metrics.mjs --from DIR            # build from a backup folder instead of the CLI
     MYSET_SITE_DIR=~/Docs/MySet node tools/metrics.mjs   # from a worktree (not `netlify link`ed)

   The page is finance/metrics.html with the snapshot in place of the
   __SNAPSHOT__ marker — the same file a function will serve at /metrics when the
   founder says so; until then a session publishes the filled page as the
   "Current Show Stats" artifact once a day. Decision 0071. */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildSnapshot } from '../netlify/functions/_metrics.mjs';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = process.env.MYSET_SITE_DIR || ROOT;
const FROM = opt('--from');
const ENV = { ...process.env, PATH: `${process.env.HOME}/.local/node/bin:${process.env.PATH || ''}` };

function get(key) {
  if (FROM) {
    const f = path.join(FROM, 'keys', key.replace(/\//g, '%2F'));
    return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
  }
  try {
    const out = execFileSync('netlify', ['blobs:get', 'myset', key, '-O', '-'], { cwd: SITE, env: ENV, stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64e6 });
    const s = out.toString('utf8'); return s.trim() ? JSON.parse(s) : null;
  } catch { return null; }
}

const registry = get('artists') || { byId: {} };
const venues = get('venues') || { byId: {} };
const parts = {};
for (const aid of Object.keys(registry.byId || {})) {
  parts[aid] = { idx: get(`histidx_${aid}`), meta: get(`meta_${aid}`), posts: get(`posts_${aid}`), rsvp: get(`rsvp_${aid}`), ev: get(`ev_${aid}`) };
}
const snap = buildSnapshot({ registry, venues, parts });
const json = JSON.stringify(snap);
if (opt('--out')) writeFileSync(opt('--out'), json);
if (opt('--html')) {
  const tpl = readFileSync(path.join(ROOT, 'finance', 'metrics.html'), 'utf8');
  if (!tpl.includes('__SNAPSHOT__')) throw new Error('finance/metrics.html has no __SNAPSHOT__ marker');
  writeFileSync(opt('--html'), tpl.replace('__SNAPSHOT__', () => json.replace(/<\//g, '<\\/')));
}
if (!opt('--out') && !opt('--html')) process.stdout.write(json + '\n');
console.error(`snapshot: ${snap.artists.length} artists, ${snap.venues.length} venues, ${snap.nights.length} nights (${snap.nights.filter((n) => n.real).length} real), ${snap.money.length} payments, ${snap.posts.length} posts, ${snap.rsvps.length} rsvps, ${snap.gigs.length} gig occurrences`);
