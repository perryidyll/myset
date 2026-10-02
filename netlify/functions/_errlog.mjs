import { casDoc, readDoc, bad, roomHash, isStoreError } from './_lib.mjs';

/* WHAT BROKE, KEPT PAST THE NIGHT.

   Netlify deletes function logs after 24 hours, and its log drains are an
   Enterprise feature. So a fan who says "it broke on Saturday" on Monday was, until
   this file, describing something nobody could look at. Decision 0029.

   Errors are written into the same blob store as everything else, in ONE document
   per hour with a computable key — `err_2026-09-11T14` — so nothing here needs
   `list()` (INVARIANT 1). A bug report gathers the last three hours of those.

   Two rules:
     · logging must never throw and never slow the request that failed — a few
       tries, then give up silently; the console line still reaches Netlify's own log
     · nothing personal is kept — a fan id and a route, never a body, never an email.
       The route is the PATH ALONE: a Studio code (`?code=`) and a Stripe session
       (`?session_id=cs_…`) travel in the query string of exactly the requests most
       likely to throw, and a request URL kept whole would put them in a document
       every bug report reads out (INVARIANT 0fb; decision 0110)

   BUG REPORTS ARE ALSO CAPPED PER NETWORK (decision 0111). "One per device per ten
   minutes" is keyed on an id the phone chooses, and each report costs three reads
   of the hourly error documents before its write — so a loop with a fresh id per
   call was four reads and a write, per call, for ever. Each artist's `bugs_`
   document keeps a small map of network hash → reports this hour, capped at
   BUG_PER_NETWORK_PER_HOUR; twelve is a whole bar on one wifi hitting the same
   fault and a dozen of them saying so, which is already more than the artist needs
   to know something broke. The check runs on ONE plain read of that document
   before the error documents are gathered, so a refused report costs a single read
   and no write, and runs again inside the write (decision 0030's shape), where it
   is authoritative. A refused report is answered like a repeat from the same phone
   — thanked, not stored — so the fan sees no failure and a script sees no
   difference. The map is pruned as it is read, and past BUG_NETS_KEPT entries the
   oldest go. The hash is roomHash, never the address. */

export const HOUR = 3600e3;
export const KEEP_PER_HOUR = 100;
export const BUG_HOURS = 3;
export const KEEP_BUGS = 30;
export const BUG_EVERY = 10 * 60e3;          // one report per device per ten minutes
export const BUG_PER_NETWORK_PER_HOUR = 12;  // and this many per network per hour, rotated ids or not
export const BUG_NETS_KEPT = 300;            // network windows kept per artist; the oldest fall off

export const hourKey = (t = Date.now()) => 'err_' + new Date(t).toISOString().slice(0, 13);
const bugsKey = (aid) => `bugs_${aid}`;

const cut = (s, n) => String(s == null ? '' : s).slice(0, n);

export async function logErr(where, e, ctx = {}) {
  const now = Date.now();
  const row = {
    at: now, where: cut(where, 60),
    msg: cut((e && e.message) || e, 300),
    stack: cut(String((e && e.stack) || '').split('\n').slice(0, 6).join('\n'), 1200),
    aid: cut(ctx.aid, 60), fan: cut(ctx.fan, 40), url: cut(ctx.url, 200).split('?')[0],
  };
  console.error(`[${row.where}]`, row.msg);
  /* A store that did not answer is not written down IN that store (0142): the write
     would wait on the same failure, and the caller is holding a reply for it. */
  if (isStoreError(e)) return;
  try {
    await casDoc(hourKey(now), () => ({ v: 1, list: [] }), (d) => {
      d.list = Array.isArray(d.list) ? d.list : [];
      d.list.push(row);
      if (d.list.length > KEEP_PER_HOUR) d.list = d.list.slice(-KEEP_PER_HOUR);
      return true;
    }, null, 3);
  } catch { /* the console line is the fallback */ }
}

/** The last `hours` hourly buckets, oldest first. `hours` reads, all computable. */
export async function recentErrs(hours = BUG_HOURS, now = Date.now()) {
  const keys = [];
  for (let i = 0; i < hours; i++) keys.push(hourKey(now - i * HOUR));
  const docs = await Promise.all(keys.map((k) => readDoc(k, null).then((r) => r.data).catch(() => null)));
  return docs.flatMap((d) => (d && Array.isArray(d.list) ? d.list : [])).sort((a, b) => a.at - b.at);
}

/** Wrap a handler so an uncaught exception is recorded, then answered honestly. */
export const guard = (where, h) => async (req, ctx) => {
  try { return await h(req, ctx); }
  catch (e) {
    /* THE STORE DID NOT ANSWER (decision 0142). Not a bug to file — and filing it
       is a write to the same store, which would hang this reply behind the thing
       that is already failing. One console line, then the answer every page
       already knows how to wait on: 503 "busy", never cached, never a sign-out. */
    if (isStoreError(e)) {
      console.error(`[${where}] the store did not answer for ${e.key}:`, String((e.cause && e.cause.message) || e.cause || ''));
      const r = bad('busy', 503);
      r.headers.set('retry-after', '5');
      return r;
    }
    await logErr(where, e, { url: req && req.url });
    return bad('Something went wrong on our side — it has been noted', 500);
  }
};

const emptyBugs = () => ({ v: 1, list: [] });

export async function readBugs(aid) {
  const { data } = await readDoc(bugsKey(aid), null);
  const d = { ...emptyBugs(), ...(data || {}) };
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}

/* Whether a report from this phone, on this network, may land — judged on the bugs
   document alone (the header says why). Normalises `list` and `nets` and prunes the
   hour's closed windows as it goes, so the caller can count on both; false means
   "thank them, store nothing". Called on a plain read first, then inside the write. */
const bugSpace = (d, fanId, net, now) => {
  d.list = Array.isArray(d.list) ? d.list : [];
  const mine = d.list.filter((r) => r && r.fan === fanId).pop();
  if (mine && now - (mine.at || 0) < BUG_EVERY) return false;
  d.nets = d.nets && typeof d.nets === 'object' ? d.nets : {};
  for (const k of Object.keys(d.nets)) if (!d.nets[k] || now - (Number(d.nets[k].at) || 0) >= HOUR) delete d.nets[k];
  return !net || (Number((d.nets[net] || {}).c) || 0) < BUG_PER_NETWORK_PER_HOUR;
};

/** A fan's report plus everything the server saw go wrong in the hours before it.
 *  `ip` is the caller's network (clientIp); without one no per-network cap applies. */
export async function saveBug(aid, fanId, body = {}, ip = '') {
  const note = cut(body.note, 600).trim();
  if (!note) return { ok: false, error: 'note' };
  const now = Date.now();
  const net = roomHash(aid, ip);
  /* One read, then out — BEFORE the three hourly documents are gathered. Not the
     final word (the write below checks again), just the cheap one. */
  if (!bugSpace(await readBugs(aid), fanId, net, now)) return { ok: true, already: true, errors: 0 };
  const server = (await recentErrs(BUG_HOURS, now)).slice(-40);
  const client = (Array.isArray(body.recent) ? body.recent : []).slice(-20)
    .map((r) => ({ at: Number(r && r.at) || 0, what: cut(r && r.what, 200) }));
  const row = { at: now, fan: fanId, note, page: cut(body.page, 120), ua: cut(body.ua, 200),
                show: cut(body.show, 40), client, server };
  let already = false;
  await casDoc(bugsKey(aid), emptyBugs, (d) => {
    if (!bugSpace(d, fanId, net, now)) { already = true; return false; }
    if (net) { const w = d.nets[net] || (d.nets[net] = { at: now, c: 0 }); w.c = (Number(w.c) || 0) + 1; }
    const nets = Object.keys(d.nets);
    if (nets.length > BUG_NETS_KEPT)
      for (const k of nets.sort((a, b) => d.nets[a].at - d.nets[b].at).slice(0, nets.length - BUG_NETS_KEPT)) delete d.nets[k];
    d.list.push(row);
    if (d.list.length > KEEP_BUGS) d.list = d.list.slice(-KEEP_BUGS);
    return true;
  });
  return { ok: true, already, errors: server.length };
}
