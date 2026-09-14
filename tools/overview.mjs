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
  const biz = await import(join(ROOT, 'netlify/functions/_biz.mjs'));
  const prof = await import(join(ROOT, 'netlify/functions/_profile.mjs'));   // the merch caps (blueprint S7, 2026-09-13)
  const wishes = await import(join(ROOT, 'netlify/functions/_wishes.mjs'));  // Make a request (the founder, 2026-09-13)
  const msgs = await import(join(ROOT, 'netlify/functions/_messages.mjs'));   // the Book button's inbox (the founder, 2026-09-14)
  const imgs = await import(join(ROOT, 'netlify/functions/_img.mjs'));        // the tour poster's byte caps

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

  /* The per-order quantity clamp is an inline literal in pay.mjs (both merch branches), not an
     export, so it is read out of the source by pattern like the action names above. Two clamps
     that disagree, or none, throw — a typed number here would be the bug this table exists to
     prevent. (_pay.mjs redeemSession clamps wider on the way back in; the row names checkout.) */
  const qtyClamp = () => {
    const hits = [...read('netlify/functions/pay.mjs').matchAll(/Math\.min\((\d+), parseInt\(body\.qty/g)].map((m) => Number(m[1]));
    const set = [...new Set(hits)];
    if (set.length !== 1) throw new Error(`pay.mjs qty clamp: expected one value, found ${JSON.stringify(hits)}`);
    return set[0];
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
      studioActions: [...new Set([...actionsIn('admin.mjs'), ...actionsIn('_messages.mjs')])],   // the inbox's eight live in _messages.mjs (0074)
      venueActions: actionsIn('venueadmin.mjs'),
      testSuites: suites,
      assertions: lastRun ? lastRun.assertions : null,
      testsRunAt: lastRun ? lastRun.at : null,
      testsFailed: lastRun ? lastRun.failed : null,
      invariants: { count: invIds.length, last: invIds[invIds.length - 1] || null },
    },
    plans: { artist: plan.PLANS, notBuilt: plan.NOT_BUILT, maxLibrary: plan.MAX_LIBRARY },
    venuePlans: { venue: ven.VENUE_PLANS, notBuilt: ven.VENUE_NOT_BUILT, maxMerch: ven.VMAX_MERCH },
    /* the shop's caps, read from _profile.mjs — the Studios read the item cap from the
       server too, so a typed 12, 8, 24 or $100 anywhere is a bug */
    merch: { maxItems: prof.MAX_MERCH, maxVariants: prof.MAX_VARIANTS, variantLen: prof.VARIANT_LEN, maxPostCents: prof.MAX_POST,
             minCents: prof.MIN_CENTS, maxCents: prof.MAX_CENTS, maxQty: qtyClamp(), maxImgs: prof.MAX_MERCH_IMGS, maxStock: prof.MAX_STOCK,
             wishLen: wishes.MAX_WISH, wishesPerDay: wishes.WISHES_PER_DEVICE_PER_DAY, wishesKept: wishes.MAX_WISHES },
    /* the Book button's inbox (decision 0074) and the tour poster (0075) — every cap the
       Studio and the page lean on is read from the server, never typed */
    messages: { textLen: msgs.MAX_TEXT, textMin: msgs.MIN_TEXT, perPhonePerDay: msgs.THREADS_PER_DEVICE_PER_DAY, perEmailPerDay: msgs.THREADS_PER_EMAIL_PER_DAY, mailsPerDay: msgs.MAILS_PER_ARTIST_PER_DAY,
                perNetworkPerDay: msgs.THREADS_PER_NETWORK_PER_DAY, perArtistPerDay: msgs.THREADS_PER_ARTIST_PER_DAY,
                repliesPerDay: msgs.REPLIES_PER_THREAD_PER_DAY, threadsKept: msgs.MAX_THREADS, msgsPerThread: msgs.MAX_MSGS,
                spamLinks: msgs.SPAM_LINKS, folders: msgs.FOLDERS, kinds: msgs.KINDS,
                posterImageBytes: imgs.MAX_BYTES, posterPdfBytes: imgs.MAX_TOUR_PDF },
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
      // the artist's book (decision 0065): the fixed caps, the rule cap and the document ceiling
      biz: { ...biz.LIMITS, rules: biz.MAX_RULES, maxBytes: biz.BIZ_MAX_BYTES, timeKinds: biz.TIME_KINDS.map(([, label]) => label) },
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
  merch: 'Sell merch on your shop page *(`/<slug>/shop`; the community page wears the shop card — 2026-09-13)*',
  moderate: 'Hide a fan\'s post *(sold as "hide 1–2 star reviews"; deleting for good is gone — 0060)*',
  reports: 'Data reports and the business dashboard — the filed nights, pay, band splits, costs, hours and profit on the Money tab, and the printed report *(every night is still filed on every plan)*',
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

| | ${p.free.label} | ${p.plus.label} | ${p.pro.label} |
|---|---|---|---|
| Price per month | ${money(p.free.price)} | **${money(p.plus.price)}** | **${money(p.pro.price)}** |
| MySet's cut of money taken through the app | **${pct(p.free.cut)}** | **${pct(p.plus.cut)}** | **${pct(p.pro.cut)}** |
| Shows per calendar month (UTC) | ${cap(p.free.gigs)} | ${cap(p.plus.gigs)} | ${cap(p.pro.gigs)} |
| Songs live to the audience at once (the whole library since decision 0061) | ${cap(p.free.featured)} | ${cap(p.plus.featured)} | ${cap(p.pro.featured)} |
| People in one room (soft — nobody is refused) | ${p.free.audience.toLocaleString()} | ${p.plus.audience.toLocaleString()} | ${p.pro.audience.toLocaleString()} |
| Songs the library holds | ${p.free.library.toLocaleString()} | ${p.plus.library.toLocaleString()} | ${p.pro.library.toLocaleString()} |
| Team seats | ${p.free.seats} | ${p.plus.seats} | ${p.pro.seats} |
| Band members paid per show, on the business dashboard | ${p.free.band} | ${p.plus.band} | ${p.pro.band} |
| Costs logged per show, on the business dashboard | ${p.free.costs} | ${p.plus.costs} | ${p.pro.costs} |
${Object.keys(FLAG_LABEL).map(flagRow).join('\n')}

The library holds **${p.free.library.toLocaleString()}** songs on ${p.free.label} and **${f.plans.maxLibrary.toLocaleString()}** on the paid plans (decision 0060) —
a full library refuses the *next* add and never deletes a song; the row above it limits how many are *live to the audience*.

**Designed and not built:** ${f.plans.notBuilt.map((x) => `\`${x}\``).join(', ')}. These are named in
\`NOT_BUILT\` in \`_plan.mjs\` and are greyed as *"Coming soon"* on **every** plan including ${p.pro.label}.
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
| Merch on the shop page (\`/v/<slug>/shop\`) | ${yes(v.free.merch)} | ${yes(v.pro.merch)} |
| Receive tips | ${vcell('tips', 'free')} | ${vcell('tips', 'pro')} |
| Voting on the venue's own speaker music | ${vcell('speakerVotes', 'free')} | ${vcell('speakerVotes', 'pro')} |

Up to **${f.venuePlans.maxMerch}** merch items. Not built: ${f.venuePlans.notBuilt.map((x) => `\`${x}\``).join(', ')}.

### The shop

| | Value | Where it lives |
|---|---|---|
| Merch items a page holds (artist / venue) | ${f.merch.maxItems} / ${f.venuePlans.maxMerch} | \`MAX_MERCH\` in \`_profile.mjs\`, \`VMAX_MERCH\` in \`_venues.mjs\` — the Studios show the cap the server sends |
| Sizes or options per item | ${f.merch.maxVariants}, each up to ${f.merch.variantLen} characters | \`MAX_VARIANTS\`, \`VARIANT_LEN\` in \`_profile.mjs\` |
| Flat shipping per order, at most | ${money(f.merch.maxPostCents)} | \`MAX_POST\` in \`_profile.mjs\` (the field is still \`post\`; a person reads "shipping" since 2026-09-14); a fixed Stripe shipping rate named *Shipping*, never part of MySet's cut |
| Pictures per item | ${f.merch.maxImgs}, swiped through on the item | \`MAX_MERCH_IMGS\` in \`_profile.mjs\`; slots \`<id>\`, \`<id>_1..4\` (\`_img.mjs\` MERCH_SLOT); \`img\` is always the first |
| A counted item's stock, at most | ${f.merch.maxStock.toLocaleString()} (blank = not counting) | \`MAX_STOCK\` in \`_profile.mjs\`; \`takeStock\` in \`redeemSession\` brings it down per paid order; 0 reads as sold out and \`pay.mjs\` refuses (\`merchSoldOut\`) |
| Most of one item per order | ${f.merch.maxQty} | the checkout clamp in \`pay.mjs\` (both merch branches); the shop's + stops at the same count |
| A card sale's price runs | ${money(f.merch.minCents)}–${money(f.merch.maxCents)} | \`MIN_CENTS\`, \`MAX_CENTS\` in \`_profile.mjs\`; under the floor the shop shows the price and says "ask at the table" — both merchLists send the band |
| A fan's request to the shop ("Make a request") | up to ${f.merch.wishLen} characters, ${f.merch.wishesPerDay} a day per phone, the newest ${f.merch.wishesKept} kept | \`MAX_WISH\`, \`WISHES_PER_DEVICE_PER_DAY\`, \`MAX_WISHES\` in \`_wishes.mjs\`; lands under Requests from the shop in both Studios' Merch screens |

### The Book button and the inbox (decision 0074), the tour poster (0075)

| Thing | Value | Where it lives |
| --- | --- | --- |
| A message from the Book button | ${f.messages.textMin}–${f.messages.textLen.toLocaleString()} characters, with a name and an email address | \`MIN_TEXT\`, \`MAX_TEXT\` in \`_messages.mjs\`; the Studio reads the cap from \`msgList\` |
| New conversations a day | ${f.messages.perPhonePerDay} per phone and ${f.messages.perEmailPerDay} per address (then a sentence and a 429), ${f.messages.perNetworkPerDay} per network, ${f.messages.perArtistPerDay} per artist (past that they land in Spam) | \`THREADS_PER_DEVICE_PER_DAY\`, \`THREADS_PER_EMAIL_PER_DAY\`, \`THREADS_PER_NETWORK_PER_DAY\`, \`THREADS_PER_ARTIST_PER_DAY\` — inside the CAS, never only on the page |
| Letters to the artist a day | ${f.messages.mailsPerDay} — then the badge and push carry it; the booker's receipt goes once per address per day and never carries typed words | \`MAILS_PER_ARTIST_PER_DAY\`; \`day.mail\` on the inbox |
| Replies from the booker | ${f.messages.repliesPerDay} a day per conversation | \`REPLIES_PER_THREAD_PER_DAY\` |
| A message with ${f.messages.spamLinks} or more links | goes to Spam, not Requests | \`SPAM_LINKS\` |
| Conversations the inbox lists | ${f.messages.threadsKept}; older ones spill to \`inboxarch_\` and stay on disk | \`MAX_THREADS\`; \`spillInbox\` |
| Messages in one conversation | ${f.messages.msgsPerThread}; the next is refused, never dropped | \`MAX_MSGS\` |
| Folders | ${f.messages.folders.join(' · ')} | \`FOLDERS\`; a new one lands in requests, an answer moves it to general |
| What a message is about | ${f.messages.kinds.join(' · ')} | \`KINDS\`; a tag on the row |
| The tour poster | a picture up to ${Math.round(f.messages.posterImageBytes / 1024)} KB after the phone shrinks it, or a PDF up to ${Math.round(f.messages.posterPdfBytes / 1024 / 1024)} MB | \`MAX_BYTES\`, \`MAX_TOUR_PDF\` in \`_img.mjs\`; \`tourSet\` / \`tourClear\` on \`/api/admin\`; the \`tour\` slot |

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
| The artist's book, per show (decision 0065) | ${f.constants.biz.merch} merch lines · ${f.constants.biz.gear} gear lines of ${f.constants.biz.gearChars} characters · names ${f.constants.biz.name} · note ${f.constants.biz.note} · one amount up to $${(f.constants.biz.cents / 100).toLocaleString('en-US')} · ${f.constants.biz.minutes / 60} hours per kind of time (${f.constants.biz.timeKinds.join(', ')}) · ${f.constants.biz.rules} rule defaults · the document ${(f.constants.biz.maxBytes / 1000).toFixed(0)} KB, then a year shard |
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
