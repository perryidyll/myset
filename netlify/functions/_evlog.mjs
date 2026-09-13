import { sha, harvest, readMeta } from './_lib.mjs';
import { appendLog, readLog, logKeys } from './_append.mjs';

/* THE NIGHT'S EVENT LOG — every vote, every play, every dollar, in the order it
   happened, kept for ever. Decision 0066.

   Until this the archive stored SUMS. A song's votes were counted into a tally
   and the tally into `hist_`; the fact "a phone voted for this song at 21:14:03,
   paid" was never written anywhere, and once the song played its rows were gone
   (dropSongVotes). Every question about how a night unfolded — when the room
   arrived, how a song climbed, what a paid vote did — had no answer. Now it has:
   `evt_<aid>_<showId>` is an append-only log (_append.mjs) of small events:

     { t, k:'vote',   s, d, c, p }        a vote: song, device, credits, paid part
     { t, k:'play',   s, votes, voters, replay }   a song started, with what it won
     { t, k:'refund', s, d, c, p }        the artist declined the song and gave it back
     { t, k:'drop',   s, d, c, p }        the song left the library with the vote on it
     { t, k:'reset',  s, d, c, p }        the artist cleared the board
     { t, k:'tip'|'pack'|'gift'|'order', a (cents) | n (votes), s }   the money

   `d` IS NOT A DEVICE ID. It is sha256(showId | device) cut short: stable for the
   night so "one phone, nine votes" is visible, and unlinkable to any other night
   or to the device itself — phones are counted, never named (INVARIANT 0bu).

   WHERE THE EVENTS COME FROM. A vote's row lives on the fan record until the song
   plays, is declined, is deleted or the board is cleared — and the three functions
   that take rows off the board now hand them back (harvest) so this module can
   file them at that moment. Whatever is STILL on the board when the night is
   filed goes into the head's `x.left`, and the money into `x.money` — REPLACED on
   every archive rather than appended, so an accidental End followed by eight more
   songs and another End files everything exactly once. The vote path itself is
   untouched: no extra read, no extra write on a cast (test/cost.mjs holds it). */

export const EVT = (aid, showId) => `evt_${aid}_${showId}`;
export const devHash = (showId, fanId) => sha(`myset-evt|${showId}|${fanId}`).slice(0, 12);

const fromRows = (showId, kind, h, at = 0) => (h.rows || []).map((r) => ({
  t: Number(r[2]) || at, k: kind, s: h.song, d: devHash(showId, h.fan), c: r[0], p: r[1],
}));

/** A song started: its votes (harvested as they came off the board) and the play. */
export async function logPlay(aid, showId, { songId, at, votes = 0, voters = 0, replay = false, harvested = [] }) {
  if (!aid || !showId || !songId) return;
  const ev = [];
  for (const h of harvested) for (const e of fromRows(showId, 'vote', h, at)) ev.push(e);
  ev.push({ t: at || Date.now(), k: 'play', s: songId, votes, voters, replay: !!replay });
  await appendLog(EVT(aid, showId), ev);
}

/** Votes that left the board some other way: 'refund' (declined), 'drop' (the song
 *  was removed), 'reset' (the artist cleared the board). */
export async function logLeft(aid, showId, kind, harvested, at = Date.now()) {
  if (!aid || !showId || !harvested || !harvested.length) return;
  const ev = [];
  for (const h of harvested) for (const e of fromRows(showId, kind, h, at)) ev.push(e);
  if (ev.length) await appendLog(EVT(aid, showId), ev);
}

/** Every vote still standing on the board, from the fan records as read. */
export function harvestAll(fans) {
  const out = [];
  for (const [id, fan] of Object.entries(fans || {})) {
    const held = {};
    for (const s of (fan && fan.v) || []) held[s] = (held[s] || 0) + 1;
    for (const s of Object.keys(held)) out.push(harvest(id, s, fan, held[s]));
  }
  return out;
}

/** The money in the night's window, from the payments cache (INVARIANT 5d). */
export function moneyEvents(meta, showId, from, to) {
  const m = meta || {};
  const inWin = (at) => Number(at) >= (from || 0) && Number(at) <= (to || Infinity);
  const ev = [];
  for (const t of m.tips || []) if (inWin(t.at)) ev.push({ t: t.at, k: 'tip', a: Math.round(Number(t.amount) * 100) || 0 });
  for (const [sid, p] of Object.entries(m.paid || {})) {
    if (!p || p.kind === 'tip' || p.kind === 'merch') continue;
    if (!(p.show ? p.show === showId : inWin(p.at))) continue;
    const k = (p.kind === 'votes' || p.kind === 'song_votes') ? 'pack' : String(p.kind || 'paid').slice(0, 16);
    ev.push({ t: p.at, k, a: Math.round(Number(p.amount) * 100) || 0, n: p.granted || 0, s: p.song || '', sid: String(sid).slice(0, 24) });
  }
  for (const g of m.gifts || []) if (g.showId ? g.showId === showId : inWin(g.at)) ev.push({ t: g.at, k: 'gift', n: g.votes || 0 });
  for (const o of m.orders || []) if (inWin(o.at)) ev.push({ t: o.at, k: 'order', a: Math.round(Number(o.amount) * 100) || 0 });
  return ev.filter((e) => Number(e.t) > 0);
}

/** File the night: what is still on the board, the money, the end. Idempotent —
 *  the head's `x` is replaced, so filing twice keeps the later, fuller picture. */
export async function closeLog(aid, showId, { fans, startedAt, endedAt, meta = null }) {
  if (!aid || !showId) return;
  const left = [];
  for (const h of harvestAll(fans)) for (const e of fromRows(showId, 'vote', h, endedAt)) left.push(e);
  const m = meta || await readMeta(aid).catch(() => null);
  const money = moneyEvents(m, showId, startedAt, endedAt);
  await appendLog(EVT(aid, showId), [], (x) => {
    x.startedAt = startedAt || x.startedAt || null;
    x.endedAt = endedAt;
    x.left = left;
    x.money = money;
  });
}

/** The whole night in time order. */
export async function readEventLog(aid, showId) {
  const log = await readLog(EVT(aid, showId));
  const x = log.x || {};
  /* A vote filed as standing at the end and then taken off the board afterwards
     (a song removed the next morning, before a new show re-files the night) is
     in `left` AND in the list; the list's copy carries the reason, so it wins. */
  const filed = new Set(log.list.filter((e) => e.d).map((e) => `${e.d}|${e.s}|${e.t}`));
  const left = (x.left || []).filter((e) => !filed.has(`${e.d}|${e.s}|${e.t}`));
  const events = [...log.list, ...left, ...(x.money || [])];
  if (x.endedAt) events.push({ t: x.endedAt, k: 'end' });
  events.sort((a, b) => (a.t || 0) - (b.t || 0));
  return { showId, startedAt: x.startedAt || null, endedAt: x.endedAt || null, n: events.length, events };
}

export const evtKeys = (aid, showId) => logKeys(EVT(aid, showId));
