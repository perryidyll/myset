/* THE BUSINESS DASHBOARD'S MATHS  (decision 0065)

   Everything the Money tab, the editor sheet and the printed report have to agree
   on lives here, once: what a show's profit is, which hours go into $/hour, how a
   filed night finds its calendar gig, what a period means. Pure functions only —
   no DOM, no fetch, no clock (the callers pass `now`) — so the same file runs in
   the Studio, in /report and under node in test/bizmath.mjs.

   Money is integer CENTS everywhere in here (D6). The one thing that arrives in
   dollars is a filed night's `gross`, because the history index predates this
   file; join() converts it at the door and nothing downstream sees a dollar. */
const Biz = (() => {
  /* Fixed caps, mirrored from netlify/functions/_biz.mjs (the test pins them equal).
     Plan-sized caps (band, costs) are NOT here — they come down with the plan. */
  const LIMITS = { merch: 20, gear: 30, gearChars: 80, name: 60, note: 300, cents: 1e7, minutes: 2880, qty: 999 };
  /* The four kinds of time. Everything iterates this list — calc, sum, the editor,
     the gig form, the report — so a fifth kind is one line here and one server-side. */
  const TIME_KINDS = [['perform', 'On stage'], ['break', 'Breaks'], ['travel', 'Travel'], ['setup', 'Set-up / pack-down']];
  /* Half an hour of grace before a gig's start — the same GRACE placeShows uses,
     because a set that begins at 8:30 is a show somebody opened at 8:20. */
  const JOIN = { graceMs: 30 * 60000 };
  /* "All" has to be a date the server can expand a calendar from. Nothing on MySet
     is older than this, and a residency's expansion jumps straight to the window. */
  const ALL_FROM = '2000-01-01';
  const KEY_RE = /^([a-z0-9]{1,16})@(\d{4}-\d{2}-\d{2})$/;

  const pad = (n) => String(n).padStart(2, '0');
  /* A show's date is the date on the phone that logged it, not UTC — a 10pm set
     is the same night in the artist's book whichever side of midnight UTC falls. */
  const localDate = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const iso = (y, m, d) => localDate(new Date(y, m, d).getTime());
  const num = (v) => (v === '' || v == null) ? null : Number(v);
  const clamp = (v, max) => { const n = num(v); return n == null || !Number.isFinite(n) ? null : Math.min(Math.max(Math.round(n), 0), max); };
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const cents = (rows) => (rows || []).reduce((t, r) => t + (Number(r && r.cents) || 0), 0);

  function empty() {
    const min = {};
    TIME_KINDS.forEach(([k]) => { min[k] = null; });
    return { pay: null, band: [], cut: null, tips: null, merch: [], costs: [], min, gear: [], note: '', at: null };
  }

  /* The client-side shape-up, so what the sheet sends is what the server keeps:
     the same trims and ranges as normGig, minus the plan caps (those are the
     server's to refuse and the sheet's to not offer). Out-of-range values clamp
     rather than fail — a sheet must never hand the server a body it will bounce. */
  function norm(raw) {
    const g = Object.assign(empty(), raw || {});
    const line = (r) => ({ name: str(r && r.name, LIMITS.name), cents: clamp(r && r.cents, LIMITS.cents) || 0 });
    const kept = (r) => r.name || r.cents;
    const gear = Array.isArray(g.gear) ? g.gear : bullets.fromText(g.gear);
    return {
      pay: clamp(g.pay, LIMITS.cents),
      band: (Array.isArray(g.band) ? g.band : []).map(line).filter(kept),
      cut: clamp(g.cut, LIMITS.cents),
      tips: clamp(g.tips, LIMITS.cents),
      merch: (Array.isArray(g.merch) ? g.merch : []).slice(0, LIMITS.merch)
        .map((r) => Object.assign(line(r), { qty: clamp(r && r.qty, LIMITS.qty) || 0 })).filter((r) => kept(r) || r.qty),
      costs: (Array.isArray(g.costs) ? g.costs : []).map(line).filter(kept),
      min: TIME_KINDS.reduce((m, [k]) => { m[k] = clamp(g.min && g.min[k], LIMITS.minutes); return m; }, {}),
      gear: gear.map((l) => str(l, LIMITS.gearChars)).filter(Boolean).slice(0, LIMITS.gear),
      note: str(g.note, LIMITS.note),
      at: Number(g.at) || null,
    };
  }

  /* Always two decimals and a thousands separator: a book is read down a column. */
  function money(c) {
    const n = Math.round(Number(c) || 0);
    const [i, f] = (Math.abs(n) / 100).toFixed(2).split('.');
    return (n < 0 ? '-$' : '$') + i.replace(/\B(?=(\d{3})+$)/g, ',') + '.' + f;
  }

  function hm(minutes) {
    if (minutes == null || !Number.isFinite(Number(minutes))) return '';
    const m = Math.round(Number(minutes)), h = Math.floor(m / 60), r = m % 60;
    return h && r ? `${h}h ${r}m` : h ? `${h}h` : `${r}m`;
  }

  /* A bare number is HOURS — "3" is a three-hour evening, not three minutes — and a
     bare number over 48 is refused rather than guessed at: "90" is someone thinking
     in minutes, and 90 hours is not a show. NaN means "ask again"; null means blank. */
  function parseHm(input) {
    const s = String(input == null ? '' : input).trim().toLowerCase();
    if (!s) return null;
    let m, out;
    if ((m = /^(\d+):(\d{1,2})$/.exec(s))) out = +m[2] > 59 ? NaN : +m[1] * 60 + +m[2];
    else if ((m = /^(\d*\.?\d+)\s*h(?:rs?|ours?)?(?:\s*(\d+)\s*m(?:ins?)?)?$/.exec(s))) out = +m[1] * 60 + (+m[2] || 0);
    else if ((m = /^(\d+)\s*m(?:ins?)?$/.exec(s))) out = +m[1];
    else if ((m = /^(\d*\.?\d+)$/.exec(s))) out = +m[1] > 48 ? NaN : +m[1] * 60;
    else return NaN;
    out = Math.round(out);
    return out > LIMITS.minutes ? NaN : out;
  }

  /* The gear list is typed as bullets and stored as lines, so a pasted list and a
     typed one end up the same and no bullet character ever reaches storage. */
  const bullets = {
    toText: (arr) => (arr || []).map((l) => '• ' + l).join('\n'),
    fromText: (s) => String(s == null ? '' : s).split(/\r?\n/)
      .map((l) => l.replace(/^[\s•·\-*]+/, '').trim()).filter(Boolean),
  };

  /* A rate in cents an hour, or null when there is no time to divide by — never
     Infinity, never a rate over an hour nobody logged. */
  const rate = (c, minutes) => (minutes > 0 ? Math.round(c / minutes * 60) : null);

  /* One show's numbers. `appCents` is what fans paid through MySet on the filed
     night, BEFORE MySet's cut and Stripe's fee (never recomputed here — the net is
     Stripe's to state); null means the figure is not available, and an unknown
     is left out of the sum rather than written down as nothing. `feePct` is the
     plan's cut of that app money as a percentage — the only fee this file can
     name; Stripe's is on Stripe's statement — so `fee` is what MySet keeps of
     the night and `profit - fee` is the post-fee figure the toggles show. `cut`
     is the artist's own share: what they typed as My cut, or, left blank, what
     is left once the splits and the costs are paid — a solo act keeps it all.
     Hours count toward $/hour only while their kind is on in prefs; a missing
     pref is ON, because the evening is the job, not just the set. */
  function calc(gig, appCents, prefs, feePct) {
    const g = gig || empty();
    const on = (prefs && prefs.hours) || {};
    const pay = Number(g.pay) || 0, bandTotal = cents(g.band), tips = Number(g.tips) || 0;
    const merch = cents(g.merch), costs = cents(g.costs);
    const appKnown = appCents != null && Number.isFinite(Number(appCents));
    const app = appKnown ? Math.round(Number(appCents)) : null;
    const revenue = pay + tips + merch + (app || 0);
    const profit = revenue - bandTotal - costs;
    const fee = Math.round((app || 0) * (Number(feePct) || 0) / 100);
    const cut = g.cut != null && Number.isFinite(Number(g.cut)) ? Math.round(Number(g.cut)) : profit;
    const minutes = {};
    let includedMinutes = 0, any = 0;
    for (const [k] of TIME_KINDS) {
      const v = g.min && g.min[k];
      const n = v == null ? null : (Number(v) || 0);
      minutes[k] = n; any += n || 0;
      if (n && on[k] !== false) includedMinutes += n;
    }
    return {
      pay, bandTotal, take: pay - bandTotal, tips, merch, app, appKnown, revenue, costs, profit, fee, cut,
      minutes, timed: any > 0, includedMinutes,
      rate: rate(profit, includedMinutes),
    };
  }

  /* The four readings of one hourly rate, from a set of totals over the timed
     shows: the whole act's or the artist's own cut, before or after MySet's
     fee, over the included hours or the on-stage hours alone. `T` is sum()'s
     `timedSum`. */
  function rates(T, view) {
    const v = view || {};
    const base = (v.mine ? T.cut : T.profit) - (v.net ? T.fee : 0);
    return { evening: rate(base, T.included), stage: rate(base, T.perform) };
  }

  const key = (eventId, date) => `${eventId}@${date}`;
  const parseKey = (k) => { const m = KEY_RE.exec(String(k || '')); return m ? { eventId: m[1], date: m[2] } : null; };

  /* Filed nights meet the calendar. A night that knows its gig (`key`, stamped at
     filing or by "Name these from my calendar") goes straight to it; one that does
     not takes the first gig running when it started, with placeShows' grace; the
     rest stand on their own under their showId. A gig can collect several nights
     (a restart mid-set files two), so the app money is summed — unless ANY of them
     was filed without Stripe answering, in which case the total is unknown, not
     smaller. A past calendar slot with nothing logged and no night is LISTED so the
     artist can log it or skip it, but not COUNTED: an unplayed gig is not income
     (INVARIANT 0ef).

     A show's KEY is recomputed from today's calendar on every load, but its RECORD
     was saved under whatever key the show had on the day it was logged — its showId
     before the night learned its gig, an occurrence key the gig has since moved
     away from. So a record is looked up under every key the show has ever had, and
     the key it was found under travels with the show as `bizKey`: the editor saves
     and removes under that, so a record never moves and never gets a twin. Any
     record no show reached at all — its gig deleted, its date edited, its night
     never filed — still stands as a show of its own, dated from its key, so a
     figure the artist wrote down is never quietly left out of a total. */
  function join(nights, occ, biz, nowMs) {
    const gigs = (biz && biz.gigs) || {}, rules = (biz && biz.rules) || {};
    const occs = (occ || []).filter((o) => o && o.startsAt <= nowMs).slice().sort((a, b) => a.startsAt - b.startsAt);
    const shows = occs.map((o) => ({
      key: key(o.eventId, o.date), date: o.date, startsAt: o.startsAt, endsAt: o.endsAt,
      venue: o.venue || '', city: o.city || '', title: o.title || '', repeating: !!o.repeating, occ: o, nights: [],
    }));
    const byKey = new Map(shows.map((s) => [s.key, s]));
    for (const n of nights || []) {
      if (!n || !n.showId) continue;
      const t = n.startedAt || n.endedAt || 0;
      let s = n.key ? byKey.get(n.key) : null;
      if (!s && t) s = shows.find((x) => t >= x.startsAt - JOIN.graceMs && t <= x.endsAt) || null;
      if (!s) {
        if (!t) continue;
        /* An orphan whose stamped key names a record keeps that key, so the numbers
           logged for it are the ones that open — and a restart with the same key
           lands on the same show. */
        const k = n.key && gigs[n.key] ? n.key : n.showId;
        s = { key: k, date: localDate(t), startsAt: n.startedAt || null, endsAt: n.endedAt || null,
          venue: n.venue || '', city: n.city || '', title: n.title || '', repeating: false, occ: null, nights: [] };
        shows.push(s);
        byKey.set(k, s);
      }
      s.nights.push(n);
    }
    const reached = new Set();
    for (const s of shows) {
      const ns = s.nights;
      s.appKnown = ns.length > 0 && ns.every((n) => n.source === 'stripe');
      s.app = s.appKnown ? ns.reduce((t, n) => t + Math.round((Number(n.gross) || 0) * 100), 0) : null;
      s.votes = ns.reduce((t, n) => t + (n.totalVotes || 0), 0);
      /* What the room paid for, off the rows: votes bought and requests accepted.
         Known only when every night of the show says so (a night filed before
         the counts existed, or without Stripe answering, reads null); free votes
         are what is left of the tally once the bought ones are taken out. */
      const paidKnown = ns.length > 0 && ns.every((n) => n.paidVotes != null && n.paidRequests != null);
      s.paidVotes = paidKnown ? ns.reduce((t, n) => t + (Number(n.paidVotes) || 0), 0) : null;
      s.paidRequests = paidKnown ? ns.reduce((t, n) => t + (Number(n.paidRequests) || 0), 0) : null;
      s.freeVotes = paidKnown ? Math.max(0, s.votes - s.paidVotes) : null;
      s.songs = ns.reduce((t, n) => t + (n.songsPlayed || 0), 0);
      s.peak = ns.reduce((t, n) => Math.max(t, n.peakVoters || 0), 0);
      let found = gigs[s.key] ? s.key : null;
      for (const n of ns) {
        if (found) break;
        if (gigs[n.showId]) found = n.showId;
        else if (n.key && gigs[n.key]) found = n.key;
      }
      if (found) reached.add(found);
      s.bizKey = found || s.key;
      s.biz = found ? gigs[found] : null;
      s.rule = (s.occ && rules[s.occ.eventId]) || null;
      s.gig = s.biz || s.rule || null;
      s.source = s.biz ? 'gig' : s.rule ? 'rule' : 'none';
      s.counted = !!(s.biz || ns.length);
    }
    for (const k of Object.keys(gigs)) {
      if (reached.has(k) || !gigs[k]) continue;
      const date = (parseKey(k) || {}).date || (/^\d{4}-\d{2}-\d{2}/.exec(k) || [])[0] || '';
      const [y, m, d] = date.split('-').map(Number);
      shows.push({ key: k, bizKey: k, date, startsAt: y ? new Date(y, m - 1, d, 12).getTime() : null, endsAt: null,
        venue: '', city: '', title: 'Logged show', repeating: false, occ: null, nights: [], appKnown: false, app: null,
        votes: 0, songs: 0, peak: 0, paidVotes: null, paidRequests: null, freeVotes: null,
        biz: gigs[k], rule: null, gig: gigs[k], source: 'gig', counted: true, orphanRecord: true });
    }
    return shows.sort((a, b) => (b.startsAt || 0) - (a.startsAt || 0));
  }

  function period(kind, now, custom) {
    const d = now instanceof Date ? now : new Date(now == null ? Date.now() : now);
    const y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), today = iso(y, m, day);
    const ok = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? v : today;
    switch (kind) {
      case 'lastMonth': return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
      case '30d': return { from: iso(y, m, day - 29), to: today };
      case 'year': return { from: iso(y, 0, 1), to: today };
      case 'all': return { from: ALL_FROM, to: today };
      case 'custom': {
        let from = ok(custom && custom.from), to = ok(custom && custom.to);
        if (from > to) [from, to] = [to, from];
        return { from, to };
      }
      default: return { from: iso(y, m, 1), to: today };
    }
  }

  const inRange = (show, from, to) => !!show.date && show.date >= from && show.date <= to;

  /* The night's votes in words — the total, and what the room paid for when the
     filed night knows: "63 votes · 40 free · 23 paid · 2 paid requests". */
  function votesLine(s) {
    const n = (v, w) => `${v} ${w}${v === 1 ? '' : 's'}`;
    const out = [n(s.votes || 0, 'vote')];
    if (s.paidVotes != null) out.push(`${s.freeVotes} free`, `${s.paidVotes} paid`, n(s.paidRequests || 0, 'paid request'));
    return out.join(' · ');
  }

  /* The period's totals, over COUNTED shows only. Profit, revenue and costs are
     over every counted show; the hourly rate is over the TIMED subset — the shows
     that have any minutes logged — divided by their own included minutes, because
     a show with no hours would otherwise drag the rate up without adding time.
     `rateStage` is the same subset over its on-stage minutes alone: "$/h for the
     set" beside "$/h for the evening". Names are grouped case-blind but shown as
     first spelled. `range.to` places the twelve month buckets; without it they
     end on the newest counted show. */
  function sum(shows, prefs, range, feePct) {
    const out = { shows: 0, logged: 0, timed: 0, revenue: 0, pay: 0, tips: 0, merch: 0, app: 0, appUnknown: 0,
      band: 0, costs: 0, profit: 0, fee: 0, cut: 0, minutes: {}, includedMinutes: 0, rate: null, rateStage: null,
      timedSum: { profit: 0, cut: 0, fee: 0, included: 0, perform: 0 },
      byMonth: [], byShow: [], mix: [], bandBy: [], costsBy: [], merchBy: [] };
    TIME_KINDS.forEach(([k]) => { out.minutes[k] = 0; });
    const months = new Map(), band = new Map(), costs = new Map(), merch = new Map();
    const bump = (map, name, fn) => {
      const id = String(name == null ? '' : name).trim().toLowerCase();
      if (!id) return;
      let row = map.get(id);
      if (!row) map.set(id, row = { name: String(name).trim(), shows: 0, n: 0, qty: 0, cents: 0 });
      fn(row);
    };
    const T = out.timedSum;
    let latest = '';
    for (const s of shows || []) {
      if (!s.counted) continue;
      const c = calc(s.gig, s.app, prefs, feePct);
      out.shows++;
      if (s.biz) out.logged++;
      if (s.nights && s.nights.length && !c.appKnown) out.appUnknown++;
      out.revenue += c.revenue; out.pay += c.pay; out.tips += c.tips; out.merch += c.merch;
      out.app += c.app || 0; out.band += c.bandTotal; out.costs += c.costs; out.profit += c.profit; out.fee += c.fee; out.cut += c.cut;
      TIME_KINDS.forEach(([k]) => { out.minutes[k] += c.minutes[k] || 0; });
      out.includedMinutes += c.includedMinutes;
      if (c.timed) { out.timed++; T.profit += c.profit; T.cut += c.cut; T.fee += c.fee; T.included += c.includedMinutes; T.perform += c.minutes.perform || 0; }
      out.byShow.push({ key: s.key, date: s.date, venue: s.venue, title: s.title, source: s.source, nights: (s.nights || []).length,
        votes: s.votes || 0, freeVotes: s.freeVotes == null ? null : s.freeVotes, paidVotes: s.paidVotes == null ? null : s.paidVotes, paidRequests: s.paidRequests == null ? null : s.paidRequests, pay: c.pay, band: c.bandTotal, tips: c.tips, merch: c.merch, app: c.app, appKnown: c.appKnown,
        costs: c.costs, revenue: c.revenue, profit: c.profit, fee: c.fee, cut: c.cut, minutes: c.minutes, includedMinutes: c.includedMinutes, timed: c.timed, rate: c.rate });
      const mo = String(s.date || '').slice(0, 7);
      if (mo > latest) latest = mo;
      const b = months.get(mo) || { month: mo, profit: 0, revenue: 0, costs: 0, app: 0, shows: 0 };
      b.profit += c.profit; b.revenue += c.revenue; b.costs += c.costs; b.app += c.app || 0; b.shows++;
      months.set(mo, b);
      const g = s.gig || {}, seen = new Set();
      for (const r of g.band || []) bump(band, r.name, (row) => {
        row.cents += Number(r.cents) || 0;
        if (!seen.has(row.name.toLowerCase())) { seen.add(row.name.toLowerCase()); row.shows++; }
      });
      for (const r of g.costs || []) bump(costs, r.name, (row) => { row.cents += Number(r.cents) || 0; row.n++; });
      for (const r of g.merch || []) bump(merch, r.name, (row) => { row.cents += Number(r.cents) || 0; row.qty += Number(r.qty) || 0; });
    }
    out.rate = rate(T.profit, T.included);
    out.rateStage = rate(T.profit, T.perform);
    const end = (range && range.to) ? String(range.to).slice(0, 7) : latest;
    if (end) {
      const [ey, em] = end.split('-').map(Number);
      for (let i = 11; i >= 0; i--) {
        const mo = iso(ey, em - 1 - i, 1).slice(0, 7);
        out.byMonth.push(months.get(mo) || { month: mo, profit: 0, revenue: 0, costs: 0, app: 0, shows: 0 });
      }
    }
    out.mix = [['pay', 'Gig pay', out.pay], ['tips', 'Cash tips', out.tips], ['merch', 'Merch', out.merch], ['app', 'Through the app', out.app]]
      .map(([k, label, c]) => ({ k, label, cents: c }));
    const rows = (map, pick) => [...map.values()].sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name)).map(pick);
    out.bandBy = rows(band, (r) => ({ name: r.name, shows: r.shows, cents: r.cents }));
    out.costsBy = rows(costs, (r) => ({ name: r.name, cents: r.cents, n: r.n }));
    out.merchBy = rows(merch, (r) => ({ name: r.name, qty: r.qty, cents: r.cents }));
    return out;
  }

  return { LIMITS, TIME_KINDS, JOIN, empty, norm, money, hm, parseHm, bullets, calc, rate, rates, join, period, inRange, votesLine, sum, key, parseKey, localDate };
})();
if (typeof module !== 'undefined') module.exports = Biz;
