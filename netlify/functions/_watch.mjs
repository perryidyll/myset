import { readDoc, casDoc, DEFAULT_ARTIST } from './_lib.mjs';
import { OWED } from './_pay.mjs';
import { recentErrs } from './_errlog.mjs';
import { ringState } from './_seal.mjs';

/* SOMEBODY IS TOLD WHEN PRODUCTION BREAKS (decision 0157).

   Until this file nothing told anyone. The bell could stop ringing, a fan's payment
   could sit undelivered, the error log could fill — and the first the founder heard
   was an artist's message the next morning. This is the smallest thing that closes
   that: three questions with yes-or-no answers, asked every ten minutes by
   `watchcron`, and a push to the founding page's owner seat when an answer changes.

     bell    did autocron ring in the last BELL_STALE_MS?  (shows start and end from it)
     owed    is any payment still undelivered after OWED_STALE_MS?  (decision 0138)
     errors  did the last hour log ERRS_PER_HOUR or more server errors?
     seal    can the server's secret open the keyring the sealed records hang on?
             (decision 0113; 'other' means MYSET_SECRET is not the value that wrapped
             `sealkeys`, and new sign-ins fail until it is — HARDENING.md §0)

   It tells ONCE when a thing goes wrong, again every AGAIN_MS while it stays wrong,
   and once when it is right again — never every ten minutes. What it has told is
   kept in one small document, `watch`.

   WHAT THIS CANNOT SEE: itself. If Netlify stops running scheduled functions, or the
   site is down, this is down too. That is the outside check's job
   (.github/workflows/watch.yml), which asks /api/health from GitHub's machines and
   reads the same three answers plus how long ago THIS last ran. */
export const WATCH = 'watch';
/* The bell's index, by name (as _lifecycle.mjs does): importing _auto.mjs for one
   string would pull the whole show lifecycle into a function that must stay small. */
const SCHED = 'gigsched';
export const BELL_STALE_MS = 10 * 60e3;
export const OWED_STALE_MS = 15 * 60e3;
export const ERRS_PER_HOUR = 25;
export const AGAIN_MS = 60 * 60e3;
const emptyWatch = () => ({ v: 1, told: {}, lastAt: 0 });

const mins = (ms) => Math.max(1, Math.round(ms / 60e3));

/** The three answers, read fresh. A read that fails is itself an answer. */
export async function look(now = Date.now()) {
  const problems = [];
  let bellAgeMs = null, owed = 0, owedOldestMs = 0, errors = null;
  try {
    const at = Number((((await readDoc(SCHED, null)).data) || {}).lastRunAt) || 0;
    bellAgeMs = at ? now - at : null;
    if (bellAgeMs !== null && bellAgeMs > BELL_STALE_MS)
      problems.push({ kind: 'bell', title: 'MySet’s scheduler has stopped',
        body: `It last ran ${mins(bellAgeMs)} minutes ago. Shows are not starting or ending themselves.` });
  } catch { problems.push({ kind: 'store', title: 'MySet’s storage is not answering', body: 'Reads are failing. Rooms keep their last board; votes are being refused.' }); }
  try {
    const rows = Object.values(((((await readDoc(OWED, null)).data) || {}).rows) || {});
    owed = rows.length;
    owedOldestMs = rows.length ? now - Math.min(...rows.map((r) => Number(r.at) || now)) : 0;
    const late = rows.filter((r) => now - (Number(r.at) || now) > OWED_STALE_MS).length;
    if (late) problems.push({ kind: 'owed', title: `${late} payment${late === 1 ? '' : 's'} not delivered`,
      body: `A fan paid and has not been given what they bought, for ${mins(owedOldestMs)} minutes. The scheduler keeps retrying; Money → sweep recovers it by hand.` });
  } catch { /* the store problem above already says it */ }
  try {
    errors = (await recentErrs(2, now)).filter((e) => now - e.at < 3600e3).length;   // two hourly buckets cover any sixty minutes
    if (errors >= ERRS_PER_HOUR) problems.push({ kind: 'errors', title: `${errors} server errors in the last hour`,
      body: 'Something is failing repeatedly. The error log has the lines.' });
  } catch { /* as above */ }
  let seal = null;
  try {
    seal = await ringState();
    if (seal === 'other' || seal === 'malformed') problems.push({ kind: 'seal', title: 'MySet’s secret cannot open its keyring',
      body: `${seal === 'other' ? 'MYSET_SECRET is not the value that wrapped sealkeys' : 'The sealkeys document is not a keyring'}: sealed records read as missing and nothing sealed can be written, so new sign-ins fail. HARDENING.md §0.` });
  } catch { /* as above */ }
  return { problems, bellAgeMs, owed, owedOldestMs, errors, seal };
}

/**
 * Look, then tell the founder what changed. `tell` is `notify` in production and a
 * recorder in the suite. Never throws.
 */
export async function watch({ now = Date.now(), tell } = {}) {
  const seen = await look(now);
  const bad = Object.fromEntries(seen.problems.map((p) => [p.kind, p]));
  let state = emptyWatch();
  try { state = { ...emptyWatch(), ...(((await readDoc(WATCH, null)).data) || {}) }; } catch { /* tell anyway; the stamp below is retried next ring */ }
  state.told ||= {};
  const say = [];
  for (const p of seen.problems)
    if (now - (Number(state.told[p.kind]) || 0) >= AGAIN_MS) say.push({ ...p, tag: 'watch-' + p.kind });
  const better = Object.keys(state.told).filter((k) => !bad[k]);
  if (better.length) say.push({ kind: 'ok', tag: 'watch-ok', title: 'MySet is back to normal',
    body: `Cleared: ${better.map((k) => ({ bell: 'the scheduler', owed: 'payments owed', errors: 'server errors', store: 'storage', seal: 'the keyring' }[k] || k)).join(', ')}.` });
  for (const m of say) {
    try { await tell(DEFAULT_ARTIST, { title: m.title, body: m.body, url: '/studio', tag: m.tag }, { owner: true }); }
    catch (e) { console.error('watch: could not tell the founder:', String((e && e.message) || e)); }
    console.log(`watch: ${m.title} — ${m.body}`);
  }
  await casDoc(WATCH, emptyWatch, (d) => {
    d.told ||= {};
    for (const m of say) if (m.kind !== 'ok') d.told[m.kind] = now;
    for (const k of better) delete d.told[k];
    d.lastAt = now;
    return true;
  }).catch(() => {});
  return { problems: seen.problems.map((p) => p.kind), told: say.map((m) => m.kind), seen };
}
