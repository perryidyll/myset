import { casDoc, readDoc, bad } from './_lib.mjs';

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
     · nothing personal is kept — a fan id and a route, never a body, never an email */

export const HOUR = 3600e3;
export const KEEP_PER_HOUR = 100;
export const BUG_HOURS = 3;
export const KEEP_BUGS = 30;
export const BUG_EVERY = 10 * 60e3;          // one report per device per ten minutes

export const hourKey = (t = Date.now()) => 'err_' + new Date(t).toISOString().slice(0, 13);
const bugsKey = (aid) => `bugs_${aid}`;

const cut = (s, n) => String(s == null ? '' : s).slice(0, n);

export async function logErr(where, e, ctx = {}) {
  const now = Date.now();
  const row = {
    at: now, where: cut(where, 60),
    msg: cut((e && e.message) || e, 300),
    stack: cut(String((e && e.stack) || '').split('\n').slice(0, 6).join('\n'), 1200),
    aid: cut(ctx.aid, 60), fan: cut(ctx.fan, 40), url: cut(ctx.url, 200),
  };
  console.error(`[${row.where}]`, row.msg);
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

/** A fan's report plus everything the server saw go wrong in the hours before it. */
export async function saveBug(aid, fanId, body = {}) {
  const note = cut(body.note, 600).trim();
  if (!note) return { ok: false, error: 'note' };
  const now = Date.now();
  const server = (await recentErrs(BUG_HOURS, now)).slice(-40);
  const client = (Array.isArray(body.recent) ? body.recent : []).slice(-20)
    .map((r) => ({ at: Number(r && r.at) || 0, what: cut(r && r.what, 200) }));
  const row = { at: now, fan: fanId, note, page: cut(body.page, 120), ua: cut(body.ua, 200),
                show: cut(body.show, 40), client, server };
  let already = false;
  await casDoc(bugsKey(aid), emptyBugs, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    const mine = d.list.filter((r) => r && r.fan === fanId).pop();
    if (mine && now - (mine.at || 0) < BUG_EVERY) { already = true; return false; }
    d.list.push(row);
    if (d.list.length > KEEP_BUGS) d.list = d.list.slice(-KEEP_BUGS);
    return true;
  });
  return { ok: true, already, errors: server.length };
}
