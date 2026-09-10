import Stripe from 'stripe';
import { casDoc, readDoc, KEY, creditsUsed, isUnlimited, mutateFan, mutateMeta,
         grantPaidSongVotes, cleanFanId, getShow } from './_lib.mjs';
import { notify } from './_push.mjs';

/* "Play something that isn't on the list."

   Three shapes, one mechanism:
     song      — a title the artist doesn't have. Accepting it adds it to the
                 setlist, so the whole room can then vote for it.
     birthday  — a name. Nothing is added to the setlist; the artist just needs
                 to know, and to know who it's for.
     vibe      — a free mood vote. The artist chooses whichever song fits it.

   Both cost VOTES and both are off until the artist switches them on. A song
   request may ALSO carry a Stripe authorization: it is captured only after the
   artist accepts, plays and finishes that song; decline cancels it. The ordinary
   vote-cost path remains available without a card — INVARIANT 0w. */

export const MAX_KEPT = 80;          // total rows retained, oldest resolved first
export const MAX_PENDING = 30;       // how many can be waiting at once
export const VIBE_OPTIONS = ['Energetic','Chill','Romantic','Upbeat','Melancholy','Funky','Acoustic','Rowdy','Nostalgic','Dark','Groovy','Mellow','Anthemic','Intimate','Hypnotic','Uplifting','Soulful','Wild','Dreamy','Heavy'];
const KINDS = new Set(['song', 'birthday', 'vibe']);
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
      pledgeCents: r.pledgeCents || 0, pledgeVotes: r.pledgeVotes || 0,
      pledgeState: r.pledgeState || '',
    }));
}

/** Just this fan's own rows — so their page can say "asked for, waiting". */
export function myRequests(d, fanId, show) {
  const sid = show && show.showId;
  return (d.list || [])
    .filter((r) => r.fan === fanId && (!sid || r.showId === sid))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .map((r) => ({ id: r.id, kind: r.kind, status: r.status,
                   title: r.title || '', name: r.name || '', cost: r.cost || 0, at: r.at || 0,
                   pledgeCents: r.pledgeCents || 0, pledgeVotes: r.pledgeVotes || 0,
                   pledgeState: r.pledgeState || '' }));
}

/* ---------- creating one ----------
   The votes are taken FIRST. If the row can't then be written the charge is put
   back — the other order would let a failed write hand out free requests. */
export async function createRequest(aid, show, fanId, body) {
  const kind = KINDS.has(body.kind) ? body.kind : 'song';
  const cfg = kind === 'song' ? show.requests : kind === 'birthday' ? show.birthdays : { on: true, cost: 0 };
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
  if (kind === 'vibe' && !VIBE_OPTIONS.includes(title)) return { ok: false, error: 'Pick one of the vibes shown', status: 400 };

  const existing = await readRequests(aid);
  const requestedId = String(body.requestId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  const paymentSession = String((body.pledge || {}).session || '').slice(0, 120);
  const debitMarker = requestedId ? `ask:${requestedId}` : '';
  const prior = existing.list.find((r) =>
    (requestedId && r.id === requestedId) || (paymentSession && r.paymentSession === paymentSession));
  if (prior) return { ok: true, request: prior, charged: prior.cost || 0, already: true };
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
  let short = false, debitAlready = false, debited = false;
  await mutateFan(aid, fanId, (me) => {
    short = false; debitAlready = false; debited = false;
    me.lastAt = Date.now();
    if (free) return true;                                    // activity, nothing to charge
    me.rq ||= [];
    if (debitMarker && me.rq.includes(debitMarker)) {
      debitAlready = true; return false;
    }
    const total = show.freeCredits + (me.extra || 0);
    if (creditsUsed(me, show) + cost > total) { short = true; return false; }
    me.spent = (me.spent || 0) + cost;
    if (debitMarker) {
      me.rq.push(debitMarker);
      if (me.rq.length > 40) me.rq = me.rq.slice(-40);
    }
    debited = true;
    return true;
  });
  if (short) return { ok: false, error: 'no-credits', status: 402 };

  const pledge = body.pledge && typeof body.pledge === 'object' ? body.pledge : null;
  const pledgeCents = pledge ? Math.max(0, Math.min(50000, parseInt(pledge.cents, 10) || 0)) : 0;
  const row = {
    id: requestedId || ('r' + Math.random().toString(36).slice(2, 10)),
    kind, title, artist, name,
    fan: fanId, cost: free ? 0 : cost,
    showId: show.showId, status: OPEN, at: Date.now(), songId: null,
    ...(pledgeCents ? {
      pledgeCents, pledgeVotes: Math.floor(pledgeCents / 100), pledgeState: 'authorized',
      paymentIntent: String(pledge.intent || '').slice(0, 120),
      paymentSession, paymentAccount: String(pledge.account || '').slice(0, 120),
    } : {}),
  };

  let stored = false, storedRow = null, inserted = false;
  try {
    await mutateRequests(aid, (d) => {
      inserted = false;
      const prior = d.list.find((r) =>
        (requestedId && r.id === requestedId) || (paymentSession && r.paymentSession === paymentSession));
      if (prior) { storedRow = { ...prior }; return false; }
      d.list.push(row);
      trim(d);
      inserted = true;
      return true;
    });
    const back = await readRequests(aid);
    storedRow = back.list.find((r) => r.id === row.id || (paymentSession && r.paymentSession === paymentSession)) || storedRow;
    stored = !!storedRow;
  } catch { stored = false; }

  if (!stored) {
    if (!free && debited && !debitAlready) {
      await mutateFan(aid, fanId, (me) => {
        me.spent = Math.max(0, (me.spent || 0) - cost);
        if (debitMarker) me.rq = (me.rq || []).filter((x) => x !== debitMarker);
        return true;
      }).catch(() => {});
    }
    return { ok: false, error: 'Couldn’t get that through — try again', status: 503 };
  }
  /* Tell the artist, if they have installed the Studio and switched alerts on.
     Deliberately AFTER the request is stored and read back — a notification is
     never allowed to be the reason a paid request fails (INVARIANT 16) — and
     never awaited into the response, so a slow push service cannot make the fan
     wait. notify() swallows its own errors. */
  if (inserted) notify(aid, {
    title: kind === 'song' ? 'Song requested' : kind === 'vibe' ? 'Mood vote' : 'Birthday shout-out',
    body: kind === 'song'
      ? `${title}${artist ? ' — ' + artist : ''}${row.cost ? ` · ${row.cost} votes` : ''}${row.pledgeCents ? ` · $${row.pledgeCents / 100} offered` : ''}`
      : kind === 'vibe' ? title : `For ${name}${row.cost ? ` · ${row.cost} votes` : ''}`,
    url: '/studio', tag: 'ask',
  }).catch(() => {});

  return { ok: true, request: storedRow, charged: free ? 0 : cost,
           already: !inserted || debitAlready };
}

/** A completed manual-capture Checkout authorizes a request; it does not charge it.
 *  The deterministic row id makes the return page and webhook safe to race. */
export async function authorizeRequestSession(aid, session, fallbackFan, stripe, opts = {}) {
  const md = (session && session.metadata) || {};
  if (!session || md.kind !== 'request_hold') return { ok: false, error: 'not a request authorization' };
  const fan = cleanFanId(md.fan) || cleanFanId(fallbackFan);
  const piId = typeof session.payment_intent === 'string'
    ? session.payment_intent : ((session.payment_intent || {}).id || '');
  if (!fan || !piId || !stripe) return { ok: false, error: 'could not verify authorization' };
  let pi;
  try { pi = await stripe.paymentIntents.retrieve(piId, opts); }
  catch { return { ok: false, error: 'could not verify authorization' }; }
  if (!['requires_capture', 'succeeded'].includes(pi.status))
    return { ok: false, error: pi.status === 'canceled' ? 'authorization canceled' : 'not authorized' };

  const show = await getShow(aid);
  /* Checkout belongs to the night and request price the fan actually saw. A late
     return must never jump into tomorrow's show or silently spend a newly raised
     request cost. Cancel the authorization and ask them to submit again. */
  if ((md.show && md.show !== show.showId)
      || (md.requestCost && Number(md.requestCost) !== Number((show.requests || {}).cost))) {
    if (pi.status === 'requires_capture') {
      try { await stripe.paymentIntents.cancel(piId, {}, opts); } catch {}
    }
    return { ok: false, error: 'That request window changed — nothing was charged. Please send it again.', status: 409 };
  }
  const cents = Math.max(0, parseInt(session.amount_total, 10) || parseInt(pi.amount, 10) || 0);
  const r = await createRequest(aid, show, fan, {
    kind: 'song', title: md.title || '', artist: md.songArtist || '',
    requestId: 'r' + session.id.replace(/[^A-Za-z0-9]/g, '').slice(-18),
    pledge: { cents, intent: piId, session: session.id, account: opts.stripeAccount || '' },
  });
  if (!r.ok) {
    if (pi.status === 'requires_capture') {
      try { await stripe.paymentIntents.cancel(piId, {}, opts); } catch {}
    }
    return r;
  }
  return { ok: true, kind: 'request_hold', amount: cents / 100,
           request: r.request, already: !!r.already };
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
  /* Say what actually happened. This reported "votes refunded" to both the artist
     and the fan whether or not a refund was possible — a request from an earlier
     show is deliberately NOT refunded (its credits have already refreshed, so
     refunding would mint votes, INVARIANT 0ac), and the write can fail. Both cases
     used to be announced as a refund. */
  row.refunded = 0;
  if (status === 'declined' && row.cost > 0 && show && row.showId === show.showId) {
    try { await refund(aid, row.fan, row.cost); row.refunded = row.cost; }
    catch { row.refunded = 0; }
  }
  if (status === 'declined' && row.paymentIntent) await cancelPledge(aid, row);
  return row;
}

const stripeForRow = (row) => ({
  stripe: process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null,
  opts: row.paymentAccount ? { stripeAccount: row.paymentAccount } : {},
});

async function cancelPledge(aid, row) {
  const { stripe, opts } = stripeForRow(row);
  let state = 'cancel_pending';
  if (stripe) {
    try {
      const pi = await stripe.paymentIntents.retrieve(row.paymentIntent, opts);
      if (pi.status === 'requires_capture') await stripe.paymentIntents.cancel(row.paymentIntent, {}, opts);
      if (pi.status === 'canceled' || pi.status === 'requires_capture') state = 'cancelled';
      if (pi.status === 'succeeded') state = 'captured';
    } catch {}
  }
  await mutateRequests(aid, (d) => {
    const live = d.list.find((r) => r.id === row.id);
    if (!live) return false;
    live.pledgeState = state; live.pledgeDoneAt = Date.now();
    return true;
  }).catch(() => {});
  return state;
}

/** Starting another song or tapping End completes the previous one. Only here does
 *  an accepted request's authorization become a charge. */
export async function completeSongRequests(aid, songId) {
  const rows = (await readRequests(aid)).list.filter((r) =>
    r.kind === 'song' && r.status === 'added'
    && (r.songId === songId || r.pledgeState === 'capture_pending'));
  let captured = 0, pending = 0;
  for (const row of rows) {
    if (!row.paymentIntent) {
      await mutateRequests(aid, (d) => {
        const live = d.list.find((r) => r.id === row.id && r.status === 'added');
        if (!live) return false;
        live.status = 'played'; live.doneAt = Date.now(); return true;
      });
      continue;
    }
    const { stripe, opts } = stripeForRow(row);
    if (!stripe) {
      pending++;
      await mutateRequests(aid, (d) => {
        const live = d.list.find((r) => r.id === row.id);
        if (!live || live.pledgeState === 'captured') return false;
        live.pledgeState = 'capture_pending'; return true;
      }).catch(() => {});
      continue;
    }
    try {
      let pi = await stripe.paymentIntents.retrieve(row.paymentIntent, opts);
      if (pi.status === 'requires_capture') {
        pi = await stripe.paymentIntents.capture(row.paymentIntent, {}, {
          ...opts, idempotencyKey: `myset-request-${row.id}`.slice(0, 48),
        });
      }
      if (pi.status !== 'succeeded') { pending++; continue; }
      await mutateRequests(aid, (d) => {
        const live = d.list.find((r) => r.id === row.id);
        if (!live || live.pledgeState === 'captured') return false;
        live.status = 'played'; live.pledgeState = 'captured';
        live.capturedAt = Date.now(); live.doneAt = Date.now(); return true;
      });
      await mutateMeta(aid, (m) => {
        const sid = row.paymentSession || row.paymentIntent;
        if (m.paid[sid]) return false;
        m.paid[sid] = { kind: 'request_hold', amount: (row.pledgeCents || 0) / 100,
          granted: row.pledgeVotes || 0, fan: row.fan || '', at: Date.now(), delivered: true };
        return true;
      });
      captured += row.pledgeCents || 0;
    } catch {
      pending++;
      await mutateRequests(aid, (d) => {
        const live = d.list.find((r) => r.id === row.id);
        if (!live || live.pledgeState === 'captured') return false;
        live.pledgeState = 'capture_pending'; return true;
      }).catch(() => {});
    }
  }
  return { captured, pending };
}

/** A setlist-level decline of a song that came from a request must carry the same
 *  promise as declining it in the request panel: return its vote cost and cancel
 *  the held card authorization. */
export async function declineRequestsForSong(aid, songId, show) {
  const rows = (await readRequests(aid)).list.filter((r) =>
    r.kind === 'song' && r.songId === songId && r.status === 'added');
  for (const r of rows) await resolveRequest(aid, r.id, 'declined', show);
  return rows.length;
}

/** An unplayed request is never charged just because the show ended. Release every
 *  outstanding authorization; ordinary request votes retain the night's normal
 *  no-refund-at-end behavior. */
export async function cancelOpenPledges(aid) {
  const rows = (await readRequests(aid)).list.filter((r) =>
    r.paymentIntent && ['authorized', 'cancel_pending'].includes(r.pledgeState));
  for (const row of rows) await cancelPledge(aid, row);
  return rows.length;
}

/** Stamps the song id on an accepted request. An authorized dollar offer becomes
 *  paid ballot entries at this moment, so the ordinary tally and green pill use
 *  the same source as every other vote. The card is still only a hold. */
export async function attachSong(aid, id, songId) {
  let row = null;
  await mutateRequests(aid, (d) => {
    const r = d.list.find((x) => x.id === id);
    if (!r) return false;
    r.songId = songId; r.status = 'added';
    row = { ...r };
    return true;
  });
  if (row && row.pledgeVotes > 0 && row.paymentSession) {
    await grantPaidSongVotes(aid, row.fan, songId, row.pledgeVotes,
      `request:${row.paymentSession}`);
  }
}
