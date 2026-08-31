import { casDoc, readDoc, KEY, creditsUsed, isUnlimited, mutateFan } from './_lib.mjs';

/* "Play something that isn't on the list."

   Two shapes, one mechanism:
     song      — a title the artist doesn't have. Accepting it adds it to the
                 setlist, so the whole room can then vote for it.
     birthday  — a name. Nothing is added to the setlist; the artist just needs
                 to know, and to know who it's for.

   Both cost VOTES, not money, and both are off until the artist switches them
   on. That is deliberate: a request the artist can't play is worse than no
   request at all, and the audience must never be shown a button that leads to
   a shrug. Nothing here is ever charged in money — INVARIANT 0w. */

export const MAX_KEPT = 80;          // total rows retained, oldest resolved first
export const MAX_PENDING = 30;       // how many can be waiting at once
const KINDS = new Set(['song', 'birthday']);
const OPEN = 'pending';

export const emptyRequests = () => ({ v: 1, list: [] });

const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n);

export async function readRequests(aid) {
  const { data } = await readDoc(KEY.reqs(aid), null);
  const d = data || emptyRequests();
  d.list = Array.isArray(d.list) ? d.list : [];
  return d;
}
export const mutateRequests = (aid, fn) =>
  casDoc(KEY.reqs(aid), emptyRequests, (d) => {
    d.list = Array.isArray(d.list) ? d.list : [];
    return fn(d);
  });

/** What the artist sees. Newest first, and only this show's rows by default. */
export function shapeRequests(d, show) {
  const sid = show && show.showId;
  return (d.list || [])
    .filter((r) => !sid || r.showId === sid)
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .map((r) => ({
      id: r.id, kind: r.kind, status: r.status,
      title: r.title || '', artist: r.artist || '', name: r.name || '',
      cost: r.cost || 0, at: r.at || 0, songId: r.songId || null,
    }));
}

/** Just this fan's own rows — so their page can say "asked for, waiting". */
export function myRequests(d, fanId, show) {
  const sid = show && show.showId;
  return (d.list || [])
    .filter((r) => r.fan === fanId && (!sid || r.showId === sid))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .map((r) => ({ id: r.id, kind: r.kind, status: r.status,
                   title: r.title || '', name: r.name || '', cost: r.cost || 0, at: r.at || 0 }));
}

/* ---------- creating one ----------
   The votes are taken FIRST. If the row can't then be written the charge is put
   back — the other order would let a failed write hand out free requests. */
export async function createRequest(aid, show, fanId, body) {
  const kind = KINDS.has(body.kind) ? body.kind : 'song';
  const cfg = kind === 'song' ? show.requests : show.birthdays;
  if (!cfg || !cfg.on)
    return { ok: false, error: kind === 'song'
      ? 'Requests are off tonight' : 'Birthday shout-outs are off tonight', status: 409 };
  if (show.status !== 'live') return { ok: false, error: 'The show isn’t live yet', status: 409 };
  if (!show.windowOpen) return { ok: false, error: 'Voting is closed right now', status: 409 };

  const title = clean(body.title, 80);
  const artist = clean(body.artist, 60);
  const name = clean(body.name, 40);
  if (kind === 'song' && !title) return { ok: false, error: 'What song?', status: 400 };
  if (kind === 'birthday' && !name) return { ok: false, error: 'Whose birthday is it?', status: 400 };

  const existing = await readRequests(aid);
  const mineOpen = existing.list.filter(
    (r) => r.fan === fanId && r.status === OPEN && r.showId === show.showId);
  if (mineOpen.some((r) => r.kind === kind))
    return { ok: false, error: kind === 'song'
      ? 'You’ve already got a request in — wait for that one first'
      : 'That shout-out is already in', status: 409 };
  if (existing.list.filter((r) => r.status === OPEN && r.showId === show.showId).length >= MAX_PENDING)
    return { ok: false, error: 'There are a lot of requests in already — try again in a bit', status: 429 };

  const cost = cfg.cost;
  const free = isUnlimited(fanId, show);
  let short = false;
  await mutateFan(aid, fanId, (me) => {
    if (free) return false;                                   // nothing to charge
    const total = show.freeCredits + (me.extra || 0);
    if (creditsUsed(me, show) + cost > total) { short = true; return false; }
    me.spent = (me.spent || 0) + cost;
    return true;
  });
  if (short) return { ok: false, error: 'no-credits', status: 402 };

  const row = {
    id: 'r' + Math.random().toString(36).slice(2, 10),
    kind, title, artist, name,
    fan: fanId, cost: free ? 0 : cost,
    showId: show.showId, status: OPEN, at: Date.now(), songId: null,
  };

  let stored = false;
  try {
    await mutateRequests(aid, (d) => {
      d.list.push(row);
      trim(d);
      return true;
    });
    const back = await readRequests(aid);
    stored = back.list.some((r) => r.id === row.id);
  } catch { stored = false; }

  if (!stored) {
    if (!free) await refund(aid, fanId, cost).catch(() => {});
    return { ok: false, error: 'Couldn’t get that through — try again', status: 503 };
  }
  return { ok: true, request: row, charged: free ? 0 : cost };
}

const refund = (aid, fanId, cost) =>
  mutateFan(aid, fanId, (me) => {
    // clamped at zero: if the credits already refreshed there is nothing owed,
    // and handing back what was never charged would be free votes
    me.spent = Math.max(0, (me.spent || 0) - cost);
    return true;
  });

function trim(d) {
  if (d.list.length <= MAX_KEPT) return;
  const open = d.list.filter((r) => r.status === OPEN);
  const done = d.list.filter((r) => r.status !== OPEN).sort((a, b) => (a.at || 0) - (b.at || 0));
  d.list = [...done.slice(Math.max(0, done.length - (MAX_KEPT - open.length))), ...open]
    .sort((a, b) => (a.at || 0) - (b.at || 0));
}

/** The artist's verdict. `declined` gives the votes back. */
export async function resolveRequest(aid, id, status, show) {
  let row = null;
  await mutateRequests(aid, (d) => {
    const r = d.list.find((x) => x.id === id);
    if (!r || r.status === status) return false;
    r.status = status;
    r.doneAt = Date.now();
    row = { ...r };
    return true;
  });
  if (!row) return null;
  if (status === 'declined' && row.cost > 0 && show && row.showId === show.showId)
    await refund(aid, row.fan, row.cost).catch(() => {});
  return row;
}

/** Stamps the song id on an accepted request so the artist can see it landed. */
export const attachSong = (aid, id, songId) =>
  mutateRequests(aid, (d) => {
    const r = d.list.find((x) => x.id === id);
    if (!r) return false;
    r.songId = songId; r.status = 'added';
    return true;
  });
