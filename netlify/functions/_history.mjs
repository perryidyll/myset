import Stripe from 'stripe';
import { casDoc, readDoc, voteCounts, roomCounts, KEY, DEFAULT_ARTIST } from './_lib.mjs';

const HIST = KEY.hist;                  // flat key — INVARIANT 2
const INDEX = KEY.histIdx;
const IDS = (a) => `histids_${a}`;      // every showId ever archived, append-only
const round = (n) => Math.round(n * 100) / 100;

/* Stripe stays the source of truth for money (INVARIANT 5d); this is a cache of
   it that the artist can re-pull at any time. Bounded to the show's own window
   and auto-paged, because sessions.list() does NOT paginate on its own and a
   busy month would silently truncate. */
export async function moneyForShow(aid, showId, fromMs, toMs) {
  const key = process.env.STRIPE_SECRET_KEY;
  const out = {
    currency: 'USD', gross: 0,
    votes: { amount: 0, count: 0 },
    tips: { amount: 0, count: 0, recent: [] },
    unattributed: 0, source: key ? 'stripe' : 'off', reconciledAt: Date.now(),
  };
  if (!key) return out;

  const end = toMs || Date.now();
  /* A show with no startedAt has no window, and asking Stripe for "everything since
     the epoch" is not a window — it listed ten pages of the whole account's history
     and reported all of it as this night's untagged money. A day is the widest a
     single night can honestly be. */
  const start = fromMs || (end - 24 * 3600e3);
  const gte = Math.floor(start / 1000) - 300;                  // 5 min of slack
  const lte = Math.floor(end / 1000) + 3600;                   // and an hour after
  let after = null;
  try {
    /* Scoped, for the same reason revenue.mjs is: without it a connected artist's
       night was archived as gross 0 with source:'stripe' — claiming Stripe was asked
       and reported nothing, rather than admitting we looked on the wrong account.
       INSIDE the try, because it was not: `stripeFor` reads a blob and constructs a
       client, and a throw there escaped this function entirely, straight past
       archiveShow's own await and into an empty catch in _lifecycle. A payments
       hiccup deleted a whole gig from history and said nothing. */
    const { stripeFor, scope } = await import('./_connect.mjs');
    const { stripe: scoped, opts: sOpts } = await stripeFor(aid);
    const stripe = scoped || new Stripe(key);
    for (let page = 0; page < 10; page++) {
      const r = await stripe.checkout.sessions.list({
        limit: 100, created: { gte, lte }, ...(after ? { starting_after: after } : {}),
      }, ...scope(sOpts));
      for (const s of r.data || []) {
        if (s.payment_status !== 'paid') continue;
        const md = s.metadata || {};
        if (!['votes', 'song_votes', 'request_hold', 'tip'].includes(md.kind)) continue;   // INVARIANT 5d
        /* And it has to be THIS artist's. This was the one Stripe consumer of four
           that did not check — so with a colliding showId (they used to collide;
           see newShowId) another artist's takings were reported as yours. Untagged
           sessions predate artist tagging and belong to the founding artist, the
           same convention confirm.mjs, webhook.mjs and revenue.mjs use. */
        if ((md.artist || DEFAULT_ARTIST) !== aid) continue;
        const amt = (s.amount_total || 0) / 100;
        if (md.show && md.show !== showId) continue;
        if (!md.show) { out.unattributed = round(out.unattributed + amt); continue; }
        out.gross = round(out.gross + amt);
        if (['votes', 'song_votes', 'request_hold'].includes(md.kind)) {
          out.votes.amount = round(out.votes.amount + amt);
          out.votes.count += 1;
        } else {
          out.tips.amount = round(out.tips.amount + amt);
          out.tips.count += 1;
          out.tips.recent.push({ amount: amt, note: md.note || '', at: (s.created || 0) * 1000 });
        }
      }
      if (!r.has_more || !r.data.length) break;
      after = r.data[r.data.length - 1].id;
    }
  } catch {
    out.source = 'stripe-unreachable';
  }
  out.tips.recent = out.tips.recent.sort((a, b) => b.at - a.at).slice(0, 12);
  return out;
}

/* Snapshot a finished show. MUST run before wipeFans()/clearAllFanVotes(),
   because those destroy the only copy of the tally. Idempotent: re-archiving an
   already-archived show only refreshes its money block. */
export async function archiveShow(aid, show, fans) {
  const showId = show && show.showId;
  if (!showId) return null;

  const counts = voteCounts(fans || {});
  const byId = Object.fromEntries((show.songs || []).map((s) => [s.id, s]));
  const played = (show.log || []).map((e) => ({ ...e }));
  const playedIds = new Set(played.map((p) => p.songId));

  /* Everything the room asked for and never got — summed across every round,
     not just what was still on screen at the end. Votes are wiped each time a
     song starts, so the per-round snapshots are the only record. */
  const wanted = {};
  const want = (id, title, artist, n) => {
    if (playedIds.has(id) || !n) return;
    (wanted[id] ||= { songId: id, title: title || id, artist: artist || '', votes: 0 }).votes += n;
  };
  for (const e of played) for (const r of e.round || []) want(r.songId, r.title, r.artist, r.votes);
  for (const id of Object.keys(counts)) want(id, (byId[id] || {}).title, (byId[id] || {}).artist, counts[id]);
  const requested = Object.values(wanted)
    .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title));

  const nowVoters = Object.values(fans || {}).filter((f) => (f.v || []).length).length;
  const peakVoters = Math.max(nowVoters, ...played.map((p) => p.voters || 0), 0);
  const leftover = Object.values(counts).reduce((a, b) => a + b, 0);
  /* A NIGHT WHERE NOTHING HAPPENED IS NOT A NIGHT. A show that never went live, or
     went live and had no song started, no vote cast and no phone in the room, would
     otherwise land in the history as a row of zeros — and on the public page as
     "Shows: 1". That was always possible on a first "New show"; now that a gig on
     the calendar can start a show by itself (_auto.mjs), a night the artist never
     turned up to would do it routinely. Nothing to archive means nothing archived. */
  const phones = roomCounts(fans || {}).phones;
  /* `status === 'pre'` was the wrong question. 'pre' is still a settable status
     (admin.mjs), and once set it made every later archive of that night return null
     for ever. "Never started" is the fact the guard actually wants, and only
     startShow sets startedAt. And a refusal now says so out loud: returning a bare
     null made "nothing to file" and "it threw" look identical in the logs. */
  if (!show.startedAt || (!played.length && !leftover && !phones && !show.nowPlaying)) {
    console.log('archive: nothing to file for', aid, showId);
    return null;
  }
  /* `roundVotes` is the votes THAT SONG collected, and `leftover` is everything
     still standing on the board when the night was filed — so every vote is counted
     exactly once. Until 2026-09-07 roundVotes was the whole board's total, which was
     the same thing back when starting a song wiped every vote in the room. Rows
     archived before that carry the old meaning and are left alone: re-deriving them
     would need the votes, and the votes are gone. Older rows still only have the
     winner's own count, which is why the fallback chain is three deep. */
  const totalVotes = played.reduce((a, p) => a + (p.roundVotes ?? p.votes ?? 0), 0) + leftover;
  const top = [...played].sort((a, b) => (b.votes || 0) - (a.votes || 0))[0] || requested[0] || null;
  const endedAt = Date.now();

  const room = roomCounts(fans || {});
  const money = await moneyForShow(aid, showId, show.startedAt, endedAt);

  const doc = {
    v: 1, showId, artistId: aid,
    title: show.archiveTitle || '',
    venue: show.venue || '', city: show.city || '', showTime: show.showTime || '',
    startedAt: show.startedAt || null, endedAt,
    played, requested,
    stats: {
      songsPlayed: played.length,
      totalVotes,
      peakVoters,
      // phones that were in the room, not just phones that tapped
      room: room.phones,
      nets: room.nets,
      topSong: top ? { songId: top.songId, title: top.title, votes: top.votes || 0 } : null,
    },
    money,
    archivedAt: endedAt,
  };

  let stored = false, kept = doc;
  await casDoc(HIST(aid, showId), () => ({}), (d) => {
    if (d && d.showId) {
      /* Already archived. The guard exists because re-archiving AFTER the tally was
         wiped would overwrite a real night with zeroes (INVARIANT 17c) — but it was
         absolute, so an artist who ended the show by accident, carried on for eight
         more songs and ended again kept the FIVE-song snapshot forever, while the
         index row got the thirteen-song stats. The detail and the index disagreed
         and the later half of the night was gone.
         So: replace when the new snapshot is strictly richer, refresh money only
         when it is not. Both protections, no loss. */
      const richer = (doc.played || []).length > (d.played || []).length
        || (doc.stats.totalVotes || 0) > ((d.stats || {}).totalVotes || 0);
      if (!richer) { d.money = money; d.archivedAt = endedAt; kept = d; return true; }
      Object.assign(d, doc); kept = d; return true;
    }
    Object.assign(d, doc); kept = d; return true;
  }).then(() => { stored = true; })
    .catch((e) => { console.error('archive: detail write failed', aid, showId, e && e.message); });

  /* THE INDEX ROW IS BUILT FROM WHAT WAS KEPT, NOT FROM WHAT WAS OFFERED. The
     detail write above already refuses a poorer snapshot; this write did not, and
     rebuilt the row from the new one regardless — so an artist who ended a
     thirteen-song night twice kept the thirteen songs on the detail page and a row
     that said five. The comment on the detail guard describes exactly that
     disagreement; the fix had only covered half of it.
     And no field is ever allowed to go DOWN. carryFans destroys the tally, so a
     second archive legitimately sees zero votes and zero phones for a night that
     had plenty. */
  const st = (kept && kept.stats) || doc.stats;
  let indexed = false;
  await casDoc(INDEX(aid), () => ({ shows: [] }), (idx) => {
    idx.shows ||= [];
    const was = idx.shows.find((x) => x.showId === showId) || {};
    const up = (a, b) => Math.max(Number(a) || 0, Number(b) || 0);
    const row = {
      showId,
      title: (kept && kept.title) || doc.title || was.title || '',
      venue: (kept && kept.venue) || doc.venue || was.venue || '',
      city: (kept && kept.city) || doc.city || was.city || '',
      startedAt: Math.min(...[was.startedAt, doc.startedAt].filter(Boolean).concat(endedAt)),
      endedAt: up(was.endedAt, endedAt),
      songsPlayed: up(was.songsPlayed, st.songsPlayed),
      totalVotes: up(was.totalVotes, st.totalVotes),
      peakVoters: up(was.peakVoters, st.peakVoters),
      room: up(was.room, st.room),
      /* INVARIANT 0ae calls the network count "the only defence against one phone
         rotating its id", and it was missing from this row — which is the row
         _vstats.mjs and _pitch.mjs read. So the number shown to a venue, and the
         number an artist pitches with, had no sanity check available beside it. */
      nets: up(was.nets, st.nets),
      gross: money.gross,
      /* Money taken in the night's window that carried no show tag. It was only ever
         on the detail document, so the list showed $0 for a night that took $3 and
         the artist had to open the night to find out otherwise. It is a WINDOW
         figure, not a per-night one — never sum it. */
      unattributed: money.unattributed || 0,
    };
    const at = idx.shows.findIndex((x) => x.showId === showId);
    if (at >= 0) idx.shows[at] = row; else idx.shows.unshift(row);
    idx.shows.sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
    /* 100 was five months of gigs at Perry's rate, and row 101 lost its row while
       its detail document stayed on disk — invisible in the Studio AND missed by
       the export and the delete, which build their key list from this array. */
    if (idx.shows.length > 400) {
      idx.dropped = (idx.dropped || 0) + (idx.shows.length - 400);
      idx.shows = idx.shows.slice(0, 400);
    }
    idx.oldestKept = (idx.shows[idx.shows.length - 1] || {}).endedAt || null;
    return true;
  }).then(() => { indexed = true; })
    .catch((e) => { console.error('archive: index write failed', aid, showId, e && e.message); });

  /* EVERY showId EVER ARCHIVED, append-only. Blobs list() is banned, so this is the
     only complete answer to "which nights does this artist have on disk" — which is
     what export and delete need, and what the capped index above can no longer be. */
  await casDoc(IDS(aid), () => ({ v: 1, ids: [] }), (d) => {
    d.ids ||= [];
    if (d.ids.includes(showId)) return false;
    d.ids.push(showId);
    return true;
  }).catch(() => {});

  /* An index write that failed leaves a perfectly good night with nothing pointing
     at it. The night is safe; only the row has to be rebuilt, so the id is parked
     here and healHistory picks it up. */
  if (!indexed) await casDoc(`histpend_${aid}`, () => ({ ids: [] }), (d) => {
    d.ids ||= []; if (d.ids.includes(showId)) return false;
    d.ids = [...d.ids, showId].slice(-50); return true;
  }).catch(() => {});

  return { ...doc, stored, indexed };
}

/* THE HEAL — why a finished night can go missing, and how it comes back.

   Perry: "i'm not seeing all of my past shows appear in the money tab". Production
   proved him right. Two ways a night disappears, and the heal answers both:

   1. THE OLD KEYS. Before MySet had more than one artist, history lived at flat
      `hist_index` and `hist_<showId>`. Everything moved to `histidx_<aid>` and
      `hist_<aid>_<showId>` and the old documents were left where they were — so
      `2026-08-30-1855` still sits in `hist_index` and has never once been shown in
      the Studio. Nobody migrated them because nobody noticed.
   2. AN INDEX ROW THAT NEVER LANDED. archiveShow writes the detail document and the
      index row as two separate CAS writes, each with `.catch(() => {})` so that a
      failure can never block the artist from starting the next show. That is the
      right trade at 11pm — but it means the detail can exist with no row pointing at
      it, and the Money tab reads only the rows. The night is on disk and invisible.

   Blobs `list()` is banned (INVARIANT 1), so the heal cannot go looking. It works
   from the three places a showId can be NAMED: the artist's own index, the legacy
   flat index, and the show document sitting in front of us. That is the honest
   limit and it is written on the tin — a detail document whose id appears nowhere
   is unreachable, and no amount of code changes that.

   Idempotent, cheap, and self-retiring: once it has run it stamps `healedAt` on the
   index and the second call does nothing but read one document it was reading
   anyway. */
export async function healHistory(aid, { force = false } = {}) {
  const idx = await readDoc(INDEX(aid), { shows: [] });
  const cur = (idx.data && idx.data.shows) || [];
  if (!force && idx.data && idx.data.healedAt) return { ok: true, skipped: true, added: 0, fixed: 0 };

  const known = new Set(cur.map((r) => r.showId).filter(Boolean));
  const candidates = new Set(known);

  /* every id this artist has ever archived, and every id whose index write failed */
  const all = await readDoc(IDS(aid), null);
  for (const id of ((all.data && all.data.ids) || [])) candidates.add(id);
  const pend = await readDoc(`histpend_${aid}`, null);
  for (const id of ((pend.data && pend.data.ids) || [])) candidates.add(id);

  /* the legacy flat index — only the founding artist can own those rows, because
     they were written when there was only one artist to own them */
  const legacy = [];
  if (aid === DEFAULT_ARTIST) {
    const { data } = await readDoc('hist_index', null);
    for (const r of ((data && data.shows) || [])) if (r && r.showId) { legacy.push(r); candidates.add(r.showId); }
  }
  // and tonight, in case it was archived but never indexed
  const live = await readDoc(KEY.show(aid), null);
  if (live.data && live.data.showId) candidates.add(live.data.showId);

  const rows = [];
  let added = 0, fixed = 0, copied = 0, oldestAdded = 0;
  for (const showId of candidates) {
    let doc = (await readDoc(HIST(aid, showId), null)).data;
    /* A legacy detail document is COPIED to the per-artist key rather than read in
       place, so the artist owns it from now on and `keysFor()` can delete it if they
       ever leave. The old flat document is left alone: it is not ours to destroy and
       another artist's id may not be what we think it is. */
    if (!doc && aid === DEFAULT_ARTIST) {
      const old = (await readDoc(`hist_${showId}`, null)).data;
      if (old && old.showId === showId && (!old.artistId || old.artistId === aid)) {
        doc = { ...old, artistId: aid };
        await casDoc(HIST(aid, showId), () => ({}), (d) => { if (d && d.showId) return false; Object.assign(d, doc); return true; }).catch(() => {});
        copied++;
      }
    }
    const was = cur.find((r) => r.showId === showId) || null;
    if (!doc) { if (was) rows.push(was); continue; }   // a row with no detail is still a night
    /* A NIGHT WHERE NOTHING HAPPENED IS STILL NOT A NIGHT. `hist_2026-08-30-1855`
       is a real example: a show that existed for 151 seconds with no song, no vote
       and nobody in the room. Today's archiveShow refuses to file that, so the heal
       must not quietly restore it either — the two rules have to agree or the
       Studio's list depends on when a night happened. Already-indexed rows are left
       alone; this only filters what the heal would ADD. */
    const s0 = doc.stats || {};
    if (!was && !(s0.songsPlayed || s0.totalVotes || s0.peakVoters || s0.room)) continue;
    const st = doc.stats || {}, money = doc.money || {};
    const row = {
      showId, venue: doc.venue || '', city: doc.city || '',
      startedAt: doc.startedAt || null, endedAt: doc.endedAt || null,
      songsPlayed: st.songsPlayed || 0, totalVotes: st.totalVotes || 0,
      peakVoters: st.peakVoters || 0, room: st.room || 0, nets: st.nets || 0,
      gross: money.gross || 0, unattributed: money.unattributed || 0,
    };
    if (!was) { added++; const t = row.endedAt || row.startedAt || 0;
      if (t && (!oldestAdded || t < oldestAdded)) oldestAdded = t; }
    else if (JSON.stringify({ ...was }) !== JSON.stringify({ ...was, ...row })) fixed++;
    rows.push(row);
  }

  rows.sort((a, b) => (b.endedAt || b.startedAt || 0) - (a.endedAt || a.startedAt || 0));
  await casDoc(INDEX(aid), () => ({ shows: [] }), (d) => {
    d.shows = rows.slice(0, 400);
    d.oldestKept = (d.shows[d.shows.length - 1] || {}).endedAt || null;
    d.healedAt = Date.now();
    return true;
  }).catch(() => {});
  // everything that was waiting for a row now has one
  if (candidates.size) await casDoc(`histpend_${aid}`, () => ({ ids: [] }), (d) => {
    if (!(d.ids || []).length) return false; d.ids = []; return true;
  }).catch(() => {});
  // and every id it found is on the permanent list, so export and delete can see it
  await casDoc(IDS(aid), () => ({ v: 1, ids: [] }), (d) => {
    d.ids ||= [];
    const add = [...candidates].filter((id) => !d.ids.includes(id));
    if (!add.length) return false;
    d.ids = d.ids.concat(add); return true;
  }).catch(() => {});

  /* A BACK-FILLED NIGHT IS OLDER THAN THE SHEET'S WATERMARK. _warehouse.mjs only
     exports shows whose endedAt is past `showsUntil`, so a night restored from 30
     August would be right in the Studio and permanently absent from the sheet —
     the same class of bug the watermark comment there was written about. Winding
     the watermark back behind the oldest row we added lets the next run pick it up.
     Only ADDED rows do this; repairing numbers on an already-exported row does not. */
  if (added && oldestAdded) {
    try {
      const { mutateWarehouseState } = await import('./_warehouse.mjs');
      if (mutateWarehouseState) await mutateWarehouseState(aid, (st) => {
        if (!(Number(st.showsUntil) > 0) || st.showsUntil < oldestAdded) return false;
        st.showsUntil = oldestAdded - 1;
        return true;
      });
    } catch { /* the sheet is optional; the Studio is not */ }
  }
  return { ok: true, added, fixed, copied, total: rows.length, legacy: legacy.length };
}

/* NAMING THE NIGHTS THAT ARE ALREADY FILED.

   `show.venue` is a single field in Settings. Every night copies it as it is filed,
   and nothing ever went back and changed it — so an artist who plays three places a
   week gets a history where every show happened at whichever one they typed first.
   Perry's Money tab said "The Ugly Duckling Irish Pub" five times over, for nights
   at three different venues that were sitting on his own calendar the whole time.

   Starting a show now takes the place from the calendar (see _lifecycle.mjs), which
   fixes it from here on. This is the other half: the nights already filed.

   IT ONLY RENAMES WHAT IT CAN PROVE. A night is renamed when a gig on the calendar
   was actually RUNNING when that night started — not the nearest one, not the same
   weekday, running. Anything else is left exactly as the artist typed it, because a
   confidently wrong venue is worse than an out-of-date one. Nothing but the name and
   the city is touched: no money, no counts, no times. */
export async function placeShows(aid) {
  const [{ readEvents, occurrencesFor }, { utcToDate }] =
    await Promise.all([import('./_events.mjs'), import('./_time.mjs')]);
  const idx = await readDoc(INDEX(aid), { shows: [] });
  const rows = (idx.data && idx.data.shows) || [];
  if (!rows.length) return { ok: true, placed: 0, looked: 0 };

  const times = rows.map((r) => r.startedAt || r.endedAt || 0).filter(Boolean);
  if (!times.length) return { ok: true, placed: 0, looked: rows.length };
  const events = await readEvents(aid);
  /* A day of margin at each end so an occurrence that straddles midnight in the
     gig's own timezone is still in the expansion window. */
  const occs = occurrencesFor(events,
    utcToDate(Math.min(...times) - 86400000), utcToDate(Math.max(...times) + 86400000));
  if (!occs.length) return { ok: true, placed: 0, looked: rows.length };

  /* Half an hour of grace before the start, because a set that begins at 8:30 is a
     show somebody opened at 8:20. Nothing after the gig's own end. */
  const GRACE = 30 * 60000;
  const placeOf = (t) => occs.find((o) => o.venue && t >= o.startsAt - GRACE && t <= o.endsAt) || null;

  const changes = [];
  for (const r of rows) {
    const t = r.startedAt || r.endedAt || 0;
    const o = t ? placeOf(t) : null;
    if (!o || o.venue === r.venue) continue;
    changes.push([r.showId, o.venue, [o.city, o.country].filter(Boolean).join(', ')]);
  }
  if (!changes.length) return { ok: true, placed: 0, looked: rows.length };

  /* The detail document first, then the row. If the second write fails the two
     disagree until the next archive, which is the same way every other repair in
     this file leans — the detail is the record, the row is the summary of it. */
  for (const [showId, venue, city] of changes) {
    await casDoc(HIST(aid, showId), () => ({}), (d) => {
      if (!d || !d.showId || d.venue === venue) return false;
      d.venue = venue; if (city) d.city = city;
      return true;
    }).catch(() => {});
  }
  const want = new Map(changes.map(([id, venue, city]) => [id, { venue, city }]));
  await casDoc(INDEX(aid), () => ({ shows: [] }), (d) => {
    let touched = false;
    for (const r of (d.shows || [])) {
      const w = want.get(r.showId);
      if (!w || r.venue === w.venue) continue;
      r.venue = w.venue; if (w.city) r.city = w.city;
      touched = true;
    }
    return touched;
  }).catch(() => {});
  return { ok: true, placed: changes.length, looked: rows.length };
}

export async function readHistIndex(aid) {
  const { data } = await readDoc(INDEX(aid), { shows: [] });
  return { shows: (data && data.shows) || [] };
}
export async function readHistShow(aid, showId) {
  const { data } = await readDoc(HIST(aid, showId), null);
  return data;
}
export async function reconcileShow(aid, showId) {
  const doc = await readHistShow(aid, showId);
  if (!doc) return null;
  const money = await moneyForShow(aid, showId, doc.startedAt, doc.endedAt);
  await casDoc(HIST(aid, showId), () => ({}), (d) => {
    if (!d || !d.showId) return false;
    d.money = money; return true;
  }).catch(() => {});
  await casDoc(INDEX(aid), () => ({ shows: [] }), (idx) => {
    const row = (idx.shows || []).find((x) => x.showId === showId);
    if (row) row.gross = money.gross;
    return true;
  }).catch(() => {});
  return { ...doc, money };
}
