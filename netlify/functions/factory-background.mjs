import { randomBytes, timingSafeEqual } from 'node:crypto';
import { casDoc, readDoc } from './_lib.mjs';
import { runJob, factoryKey, QKEY, emptyQ, STUCK_MS, MAX_TRIES } from './_factory.mjs';
import { estimateCost } from './_fai.mjs';

/* THE FACTORY'S WORKER (decision 0101) — builds ONE queued sample, start to finish.

   A Netlify BACKGROUND function: the `-background` in the name is what buys it fifteen
   minutes instead of ten seconds, and the platform answers the caller 202 at once, so
   nothing that calls it ever waits on a build. Nothing a visitor does reaches it: it is
   woken by factorycron.mjs and the console's Build button (startJobs in factory.mjs),
   both carrying x-factory-key — an HMAC of the auth secret only this server can make.

   A JOB IS CLAIMED WITH A RUN TOKEN. The ring marks a job `running` before it knocks;
   the worker that answers writes its own `run` token, and every later write — a stage,
   done, failed — lands only while the token is still its own. So a duplicate knock
   finds the job taken and goes away, and a job the ring put back in line (its worker
   silent for twenty minutes) cannot be finished twice by a ghost.

   OUTCOMES. done — createSample made the page; `owner` and the quality are on the job.
   skipped — the act asked to be left alone (Remove); never retried. A failure goes back
   in line for the next ring, or to `failed` after MAX_TRIES or when trying again is
   pointless (no API key). Progress is one write per stage, never more.

   Never throws: a thrown background function is retried by the platform, which here
   would mean a second build and a second bill. */

export const deps = {
  sample: () => import('./_sample.mjs'),   // createSample, isSuppressed — swapped by the tests
  run: runJob,
  runOpts: {},                             // fetch / lookup / sleep for the tests; production passes nothing
  now: () => Date.now(),
};

const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) return false;
  try { return timingSafeEqual(Buffer.from(a), Buffer.from(b)); } catch { return false; }
};
const msg = (e) => String((e && e.message) || e || 'failed').replace(/\s+/g, ' ').slice(0, 200);
const find = (q, id) => (q.jobs || []).find((j) => j && j.id === id);

/** Write `fields` onto the job while `run` is still its token. True when it landed. */
async function settle(id, run, fields) {
  let landed = false;
  await casDoc(QKEY, emptyQ, (q) => {
    const j = find(q, id);
    landed = false;
    if (!j || j.run !== run) return false;
    Object.assign(j, fields, { upd: deps.now() });
    landed = true;
    return true;
  }).catch((e) => console.error('factory-background: write failed', msg(e)));
  return landed;
}
async function fail(id, run, err, { fatal = false, cost = 0 } = {}) {
  let st = 'lost';
  await casDoc(QKEY, emptyQ, (q) => {
    const j = find(q, id);
    if (!j || j.run !== run) { st = 'lost'; return false; }
    j.tries = (Number(j.tries) || 0) + 1;
    j.st = fatal || j.tries >= MAX_TRIES ? 'failed' : 'queued';
    j.stage = j.st === 'failed' ? 'failed' : 'retry';
    j.err = String(err || 'failed').slice(0, 200);
    j.cost = Math.round(((Number(j.cost) || 0) + cost) * 10000) / 10000;
    j.run = ''; j.upd = deps.now();
    st = j.st;
    return true;
  }).catch((e) => console.error('factory-background: write failed', msg(e)));
  return st === 'queued' ? 'requeued' : st;
}
function stageWriter(id, run) {
  let last = '';
  return async (stage, pct) => {
    if (!stage || stage === last) return;               // one write per stage, never more
    last = stage;
    await settle(id, run, { stage, pct });
  };
}

/** Claim job `id`, build it, record the outcome. Returns a one-word result for the log. */
export async function work(id) {
  const run = randomBytes(6).toString('hex');
  let job = null;
  await casDoc(QKEY, emptyQ, (q) => {
    const j = find(q, id), t = deps.now();
    job = null;
    if (!j || !['queued', 'running'].includes(j.st)) return false;          // gone, or already finished
    if (j.st === 'running' && j.run && t - (Number(j.upd) || 0) < STUCK_MS) return false;   // another worker has it
    Object.assign(j, { st: 'running', run, stage: 'starting', pct: Math.max(2, Number(j.pct) || 0), upd: t, err: '' });
    job = { ...j };
    return true;
  }).catch((e) => console.error('factory-background: claim failed', msg(e)));
  if (!job) return 'not-ours';

  let mod;
  try { mod = await deps.sample(); } catch (e) { return fail(id, run, `sample module: ${msg(e)}`); }
  let r;
  try { r = await deps.run(job, { ...deps.runOpts, onStage: stageWriter(id, run), isSuppressed: mod.isSuppressed }); }
  catch (e) { r = { ok: false, error: msg(e) }; }                        // runJob never throws; belt and braces
  const cost = estimateCost((r && r.usage) || []).usd;
  if (r && r.skipped) return (await settle(id, run, { st: 'skipped', err: String(r.skipped), stage: 'skipped', pct: 100, run: '', cost })) ? 'skipped' : 'lost';
  if (!r || !r.ok) return fail(id, run, (r && r.error) || 'failed', { fatal: !!(r && r.fatal), cost });

  /* Still ours? A cancel, or a ring that gave up on us, means nobody wants this page. */
  const { data } = await readDoc(QKEY, null);
  const now = data && find(data, id);
  if (!now || now.run !== run || now.st !== 'running') return 'cancelled';

  /* A rebuild takes the old page's place — and its ADDRESS: the link already sent must
     keep opening it, so the slug is left for createSample to carry over. */
  const payload = job.replace ? { ...r.payload, slug: '', replace: job.replace } : r.payload;
  let made;
  try { made = await mod.createSample(payload); } catch (e) { made = { ok: false, error: msg(e) }; }
  if (!made || !made.ok) return fail(id, run, `create: ${(made && made.error) || 'failed'}`, { cost });
  await settle(id, run, { st: 'done', owner: made.owner, slug: made.slug || '', stage: 'done', pct: 100, err: '', run: '',
    q: r.payload.quality.score, rv: !!r.payload.quality.review, cost: Math.round(((Number(job.cost) || 0) + cost) * 10000) / 10000 });
  return 'done';
}

export default async (req) => {
  try {
    if (req.method !== 'POST') return new Response('POST only', { status: 405 });
    if (!same(req.headers.get('x-factory-key') || '', await factoryKey())) {
      console.log('factory-background: refused a knock without the key');
      return new Response('no', { status: 401 });
    }
    let body = {};
    try { body = await req.json(); } catch {}
    const id = String((body && body.id) || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    if (!id) return new Response('which job?', { status: 400 });
    const out = await work(id);
    console.log(`factory-background: ${id} → ${out}`);
    return new Response(out, { status: 200 });            // the platform already answered 202; this is for the log and the tests
  } catch (e) {
    console.error('factory-background failed:', msg(e));
    return new Response('failed', { status: 200 });
  }
};
