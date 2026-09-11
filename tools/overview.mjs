#!/usr/bin/env node
/* overview.mjs — keeps MYSET-MASTER-OVERVIEW.md true to the code, by itself.
 *
 *   node tools/overview.mjs            regenerate the GENERATED block + the decision index
 *   node tools/overview.mjs --check    exit 1 if either is stale (what the git hook uses)
 *   node tools/overview.mjs --json     print every fact as JSON (for export elsewhere)
 *   node tools/overview.mjs --tests    run the whole suite, record the count, then regenerate
 *
 * WHY THIS EXISTS. The master overview kept going stale in one specific way: not in
 * its prose, which somebody rewrites when the product changes, but in its NUMBERS —
 * plan prices, caps, cuts, how many endpoints there are, how many assertions passed.
 * A document with a wrong number in it is worse than no document, because a reader
 * who checks one number and finds it right trusts the next fifty.
 *
 * So every fact that can be READ OUT OF THE CODE is read out of the code, and the
 * prose above it never repeats a number it does not own. The plan table in the
 * overview is not a copy of PLANS — it is PLANS, rendered.
 *
 * The one number that cannot be derived by reading is how many assertions pass,
 * because that needs the suite to actually run. `--tests` does that and stamps
 * test/.last-run.json; everything else reads the stamp.
 *
 * NOTHING HERE WRITES TO THE PRODUCT. It reads source and writes two documents.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OVERVIEW = join(ROOT, 'MYSET-MASTER-OVERVIEW.md');
const DECISIONS = join(ROOT, 'docs', 'decisions');
const STAMP = join(ROOT, 'test', '.last-run.json');
const BEGIN = '<!-- GENERATED:BEGIN — do not edit by hand; `node tools/overview.mjs` rewrites this -->';
const END = '<!-- GENERATED:END -->';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const ls = (p) => { try { return readdirSync(join(ROOT, p)); } catch { return []; } };
const sh = (cmd, args) => { try { return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
const money = (c) => (c === 0 ? '$0' : `$${(c / 100).toFixed(0)}`);
const pct = (n) => Number((Number(n || 0) * 100).toFixed(2)).toString() + '%';
const cap = (v) => (v === Infinity || v === null ? 'unlimited' : String(v));
const yes = (v) => (v === true ? 'yes' : v === false ? '—' : String(v));

/* ---------- gather ---------- */

async function facts() {
  const plan = await import(join(ROOT, 'netlify/functions/_plan.mjs'));
  const ven = await import(join(ROOT, 'netlify/functions/_venues.mjs'));
  const lib = await import(join(ROOT, 'netlify/functions/_lib.mjs'));
  const flags = await import(join(ROOT, 'netlify/functions/_flags.mjs'));
  const video = await import(join(ROOT, 'netlify/functions/_video.mjs'));
  const r2 = await import(join(ROOT, 'netlify/functions/_r2.mjs'));

  const fns = ls('netlify/functions').filter((f) => f.endsWith('.mjs'));
  const handlers = fns.filter((f) => !f.startsWith('_')).map((f) => f.replace('.mjs', '')).sort();
  const libs = fns.filter((f) => f.startsWith('_')).map((f) => f.replace('.mjs', '')).sort();
  const crons = handlers.filter((h) => h.endsWith('cron'));

  /* Action names are matched two ways because admin.mjs dispatches both ways —
     an `if (action === 'x')` fast path at the top for the ones that return early,
     and a switch for the rest. Missing half of them would understate the surface. */
  const actionsIn = (file) => {
    const src = read(`netlify/functions/${file}`);
    const hits = src.match(/action === '[a-zA-Z]+'|case '[a-zA-Z]+':/g) || [];
    return [...new Set(hits.map((h) => h.match(/'([a-zA-Z]+)'/)[1]))].sort();
  };

  const inv = read('INVARIANTS.md');
  const invIds = (inv.match(/^[0-9][0-9a-z]*\. \*\*/gm) || []).map((s) => s.replace('. **', ''));

  const runsh = read('test/run.sh');
  const suites = (runsh.match(/^node .*test\/[a-z0-9-]+\.mjs/gm) || []).length;
  const lastRun = existsSync(STAMP) ? JSON.parse(readFileSync(STAMP, 'utf8')) : null;

  const heads = [20, 200, 1000, 3000, 10000];

  return {
    stamp: {
      generatedFrom: sh('git', ['rev-parse', '--short', 'HEAD']) || 'unknown',
      commitDate: sh('git', ['log', '-1', '--format=%ad', '--date=short']) || 'unknown',
      branch: sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown',
      dirty: sh('git', ['status', '--porcelain']) !== '',
      /* Deliberately NOT rendered into the document. A commit hash or a dirty flag
         in the generated block would rewrite this file on every single commit, and
         a diff that is always noise is a diff nobody reads. The block changes when
         a FACT changes. Provenance lives here, in --json. */
    },
    shape: {
      pages: ls('public').filter((f) => f.endsWith('.html')).sort(),
      endpoints: handlers.filter((h) => !crons.includes(h)),
      scheduled: crons,
      libraries: libs,
      studioActions: actionsIn('admin.mjs'),
      venueActions: actionsIn('venueadmin.mjs'),
      testSuites: suites,
      assertions: lastRun ? lastRun.assertions : null,
      testsRunAt: lastRun ? lastRun.at : null,
      testsFailed: lastRun ? lastRun.failed : null,
      invariants: { count: invIds.length, last: invIds[invIds.length - 1] || null },
    },
    plans: { artist: plan.PLANS, notBuilt: plan.NOT_BUILT, maxLibrary: plan.MAX_LIBRARY },
    venuePlans: { venue: ven.VENUE_PLANS, notBuilt: ven.VENUE_NOT_BUILT, maxMerch: ven.VMAX_MERCH },
    flags: Object.fromEntries(Object.entries(flags.FLAGS).map(([k, v]) => [k, { default: v.default, what: v.what }])),
    constants: {
      shards: lib.SHARDS,
      castBurst: lib.CAST_BURST,
      castPerMin: lib.CAST_PER_MIN,
      countdownMs: lib.COUNTDOWN_MS,
      maxVideoBytes: video.MAX_VIDEO_BYTES,
      clipLinkSecs: r2.LINK_SECS,
      clipRedirectCacheSecs: r2.CACHE_SECS,
      defaultFreeCredits: lib.DEFAULT_FREE_CREDITS,
      defaultReplayCost: 5,
      defaultAskCost: lib.DEFAULT_ASK_COST,
      defaultPacks: lib.DEFAULT_PACKS(),
      ladder: heads.map((n) => ({ heads: n, pollMs: lib.pollFloorFor(n), board: lib.boardLimitFor(n) })),
    },
    decisions: decisionIndex(),
  };
}

/* ---------- the decision records ---------- */

function decisionIndex() {
  return ls('docs/decisions')
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort()
    .map((f) => {
      const src = read(`docs/decisions/${f}`);
      const fm = src.match(/^---\n([\s\S]*?)\n---/);
      const meta = {};
      if (fm) {
        for (const line of fm[1].split('\n')) {
          const m = line.match(/^([a-z_]+):\s*(.*)$/);
          if (!m) continue;
          let v = m[2].trim();
          if (v.startsWith('[')) v = v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean);
          else if (v === 'null' || v === '') v = null;
          meta[m[1]] = v;
        }
      }
      return { file: f, ...meta };
    });
}

function renderDecisionIndex(list) {
  const rows = list.map((d) =>
    `| [${d.id || '?'}](${d.file}) | ${d.title || d.file} | ${d.date || ''} | ${d.area || ''} | ${d.status || ''} | ${d.decided_by || ''} |`);
  const byArea = {};
  for (const d of list) (byArea[d.area || 'other'] ||= []).push(d);

  return `# Decision records

Every engineering decision that changed how MySet behaves, with the options that were
weighed, what each one would have cost, and what would reverse it.

**This file is generated.** \`node tools/overview.mjs\` rebuilds it from the front-matter
of each record. Edit the records, never this page.

To start a new one: \`./tools/decide.sh "a short title"\`

| # | Decision | Date | Area | Status | Decided by |
|---|---|---|---|---|---|
${rows.join('\n')}

## By area

${Object.keys(byArea).sort().map((a) =>
    `**${a}** — ${byArea[a].map((d) => `[${d.id}](${d.file})`).join(' · ')}`).join('\n\n')}

## What counts as a decision

A decision record is owed whenever a change **could reasonably have gone another way**
and somebody would later ask why it went this way. Not every commit: a typo fix, a copy
tweak, a test added for existing behaviour are all just work.

Owed:
- anything that changes what a person can do, is charged, or is told
- anything that adds a moving part (a new document, a new vendor, a new background job)
- anything that closes off a future option
- any number somebody could argue with (a price, a cap, a timeout, a cut)
- reversing an earlier decision — which supersedes rather than deletes it

Not owed: refactors that change no behaviour, copy corrections, new tests for old rules.

## Anything not written up

\`PENDING.md\` collects commits that touched the server and shipped without a record.
The git hook writes it. It is a backlog, not an accusation — but a decision that never
gets written down is one nobody can revisit.
`;
}

/* ---------- render the generated block ---------- */

/* The plan flags are code names. These are what a person calls them — and the
   only place in this file where a human decides anything, which is why an unknown
   key falls back to the code name rather than being dropped: a flag added to
   _plan.mjs and not added here still shows up in the table, unlabelled and
   obvious, instead of silently vanishing from the document. */
const FLAG_LABEL = {
  pricing: 'Set your own prices (vote packs, replay, requests)',
  setlists: 'Create named setlists',
  merch: 'Sell merch on your community page',
  moderate: 'Delete a fan\'s post for good *(hiding is free on every plan)*',
  promote: 'Promote gigs in other cities',
  analytics: 'Earnings analytics',
  presskit: 'Press kit',
  branding: 'Your own branding',
};

function renderBlock(f) {
  const p = f.plans.artist, v = f.venuePlans.venue;
  /* A flag named in NOT_BUILT reads "coming soon" in EVERY column, including the
     plan that nominally has it. That is exactly what the Studio renders, and the
     table has to agree with the product or it is selling a dead end. */
  const flagRow = (k) => {
    const soon = f.plans.notBuilt.includes(k);
    const cell = (tier) => (soon ? '*coming soon*' : yes(p[tier][k]));
    return `| ${FLAG_LABEL[k] || `\`${k}\``} | ${cell('free')} | ${cell('plus')} | ${cell('pro')} |`;
  };
  const vcell = (k, tier) => (f.venuePlans.notBuilt.includes(k) ? '*coming soon*' : yes(v[tier][k]));

  return `${BEGIN}

*Generated by \`tools/overview.mjs\` straight out of \`netlify/functions/\`. **Every number below
is read from the source**, so this block changes only when a fact changes — which makes its diff
worth reading. If a number here is wrong, the source is wrong.*

### The artist ladder, exactly as the server enforces it

| | Free | Plus | Pro |
|---|---|---|---|
| Price per month | ${money(p.free.price)} | **${money(p.plus.price)}** | **${money(p.pro.price)}** |
| MySet's cut of money taken through the app | **${pct(p.free.cut)}** | **${pct(p.plus.cut)}** | **${pct(p.pro.cut)}** |
| Shows per calendar month (UTC) | ${cap(p.free.gigs)} | ${cap(p.plus.gigs)} | ${cap(p.pro.gigs)} |
| Songs live to the audience at once | ${cap(p.free.featured)} | ${cap(p.plus.featured)} | ${cap(p.pro.featured)} |
| People in one room (soft — nobody is refused) | ${p.free.audience.toLocaleString()} | ${p.plus.audience.toLocaleString()} | ${p.pro.audience.toLocaleString()} |
| Team seats | ${p.free.seats} | ${p.plus.seats} | ${p.pro.seats} |
${Object.keys(FLAG_LABEL).map(flagRow).join('\n')}

Everyone keeps up to **${f.plans.maxLibrary.toLocaleString()}** songs in their library on any plan — the cap
above limits how many are *live to the audience*, and it never deletes anything.

**Designed and not built:** ${f.plans.notBuilt.map((x) => `\`${x}\``).join(', ')}. These are named in
\`NOT_BUILT\` in \`_plan.mjs\` and are greyed as *"Coming soon"* on **every** plan including Pro.
Deleting a name from that list is the last step of building the feature, and
\`test/limits.mjs\` asserts that anything **not** in the list is genuinely enforced somewhere.

### The venue ladder

| | Free | Pro |
|---|---|---|
| Price per month | ${money(v.free.price)} | **${money(v.pro.price)}** |
| MySet's cut | ${pct(v.free.cut)} | ${pct(v.pro.cut)} |
| Stripe's card fee shared evenly with MySet | ${yes(v.free.splitFee)} | ${yes(v.pro.splitFee)} |
| Photos | ${v.free.photos} | ${v.pro.photos} |
| Verification tick | ${yes(v.free.tick)} | ${yes(v.pro.tick)} |
| Community page | ${yes(v.free.reviews)} | ${yes(v.pro.reviews)} |
| Merch on the community page | ${yes(v.free.merch)} | ${yes(v.pro.merch)} |
| Receive tips | ${vcell('tips', 'free')} | ${vcell('tips', 'pro')} |
| Voting on the venue's own speaker music | ${vcell('speakerVotes', 'free')} | ${vcell('speakerVotes', 'pro')} |

Up to **${f.venuePlans.maxMerch}** merch items. Not built: ${f.venuePlans.notBuilt.map((x) => `\`${x}\``).join(', ')}.

### Voting numbers

| | Value | Where it lives |
|---|---|---|
| Free votes per person, per NIGHT (default) | ${f.constants.defaultFreeCredits} | \`show.freeCredits\`, artist-settable in the Studio |
| Cost of a vote on a song not yet played | 1 | \`costOf()\` in \`_lib.mjs\` |
| Cost of a vote on an already-played song (default) | ${f.constants.defaultReplayCost} | \`show.replayCost\`, artist-settable |
| Vote packs (default) | ${Object.entries(f.constants.defaultPacks).map(([k, x]) => `${x.votes} for ${money(x.cents)}`).join(' · ')} | \`DEFAULT_PACKS()\`, artist-settable, clamped $1–$500 and 1–100 votes |
| Song request / birthday shout-out | ${f.constants.defaultAskCost} votes by default; song requests may add an optional $1-per-paid-vote offer | \`show.requests\`, \`show.birthdays\`, \`request_hold\`; off by default |
| Most votes one press of Confirm may cast | 50 | \`vote.mjs\` |
| Last call countdown | ${f.constants.countdownMs / 1000} seconds | \`COUNTDOWN_MS\` in \`_lib.mjs\` |

### How a room slows down as it fills

Nobody is ever refused entry. The room polls slower and shows a shorter board instead.

| people in the room | fastest poll | songs on the board |
|---|---|---|
${f.constants.ladder.map((r) => `| ${r.heads.toLocaleString()} | ${r.pollMs / 1000}s | ${r.board === null ? 'all of them' : `top ${r.board}`} |`).join('\n')}

### Shape

| | |
|---|---|
| Public pages | ${f.shape.pages.length} — ${f.shape.pages.join(', ')} |
| HTTP functions | ${f.shape.endpoints.length} — ${f.shape.endpoints.map((e) => `\`${e}\``).join(', ')} (each served at \`/api/<name>\`, except \`moneymodel\`, which serves \`/moneymodel\`) |
| Scheduled jobs | ${f.shape.scheduled.length} — ${f.shape.scheduled.join(', ')} |
| Shared libraries | ${f.shape.libraries.length} |
| Artist Studio actions | ${f.shape.studioActions.length} |
| Venue Studio actions | ${f.shape.venueActions.length} |
| Fan-record shards | ${f.constants.shards} |
| Casts a device may make in a row / per minute after that | ${f.constants.castBurst} / ${f.constants.castPerMin} |
| Largest clip accepted | ${(f.constants.maxVideoBytes / 1048576).toFixed(0)} MB |
| A clip link on R2 lives / its redirect is cached | ${f.constants.clipLinkSecs / 3600} h / ${f.constants.clipRedirectCacheSecs / 3600} h |
| Invariants | ${f.shape.invariants.count} (last: ${f.shape.invariants.last}) |
| Test suites | ${f.shape.testSuites} |
| Assertions | ${f.shape.assertions === null ? '*not stamped — run `node tools/overview.mjs --tests`*' : `**${f.shape.assertions.toLocaleString()}**, ${f.shape.testsFailed} failing, last run ${f.shape.testsRunAt}`} |
| Decision records | ${f.decisions.length} |

### Feature flags in force

${Object.entries(f.flags).map(([k, x]) => `- **\`${k}\`** — default **${x.default ? 'ON' : 'OFF'}**. ${x.what}`).join('\n')}

${END}`;
}

/* ---------- run ---------- */

function splice(doc, block) {
  const i = doc.indexOf(BEGIN), j = doc.indexOf(END);
  if (i === -1 || j === -1) throw new Error(`Markers not found in ${OVERVIEW}`);
  return doc.slice(0, i) + block + doc.slice(j + END.length);
}

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

if (has('--tests')) {
  const out = execFileSync('sh', ['test/run.sh'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  /* Lines containing a tick, not ticks — two suites print two on one line, and
     every count ever quoted in docs/sessions/ is the by-line one. */
  const assertions = (out.match(/^.*✓.*$/gm) || []).length;
  const failed = (out.match(/^\s*✗/gm) || []).length;
  writeFileSync(STAMP, JSON.stringify({ assertions, failed, at: new Date().toISOString().slice(0, 10) }, null, 2) + '\n');
  console.log(`stamped: ${assertions} assertions, ${failed} failing`);
}

const f = await facts();

if (has('--json')) {
  console.log(JSON.stringify(f, null, 2));
  process.exit(0);
}

const wantOverview = splice(read('MYSET-MASTER-OVERVIEW.md'), renderBlock(f));
const wantIndex = renderDecisionIndex(f.decisions);
const haveOverview = read('MYSET-MASTER-OVERVIEW.md');
const haveIndex = existsSync(join(DECISIONS, 'README.md')) ? read('docs/decisions/README.md') : '';

if (has('--check')) {
  const stale = [];
  if (wantOverview !== haveOverview) stale.push('MYSET-MASTER-OVERVIEW.md');
  if (wantIndex !== haveIndex) stale.push('docs/decisions/README.md');
  if (stale.length) {
    console.error(`stale: ${stale.join(', ')}\nrun: node tools/overview.mjs`);
    process.exit(1);
  }
  console.log('overview is current');
  process.exit(0);
}

if (wantOverview !== haveOverview) { writeFileSync(OVERVIEW, wantOverview); console.log('updated MYSET-MASTER-OVERVIEW.md'); }
if (wantIndex !== haveIndex) { writeFileSync(join(DECISIONS, 'README.md'), wantIndex); console.log('updated docs/decisions/README.md'); }
if (wantOverview === haveOverview && wantIndex === haveIndex) console.log('already current');
