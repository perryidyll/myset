import { COUNTDOWN_MS, getShow, mutateShow, readFans, consumePlayedVotes, dropSongVotes, wipeBoard, voteCounts, readMeta, mutateMeta,
         firstVotedAt, rankSongs, json, bad, requireArtist, slug, songId, songSig, sha,
         MIN_CODE, weakCode, cleanArtistId,
         normPacks, normAsk, STARTER_SONGS,
         GENRES, GENRE_IDS, cleanKey, cleanTagLabel, tagId, normOwnTags,
         MAX_OWN_TAGS, MAX_SONG_TAGS, votable, playable, gigMonthOf, DEFAULT_ARTIST,
         DEFAULT_FREE_CREDITS } from './_lib.mjs';
import { readLists, mutateLists, readLearn, mutateLearn, applyList, refreshActive,
         shapeLists, MAX_LISTS, MAX_NAME, MAX_LEARN } from './_lists.mjs';
import { readChart, saveChart, chartFlags, MAX_CHART } from './_chart.mjs';
import { genresFor, MAP_SIZE } from './_genremap.mjs';
import { readRequests, shapeRequests, resolveRequest, attachSong } from './_requests.mjs';
import { readArtists, mutateArtists } from './_auth.mjs';
import { sendPitch, shapeForArtist, readPitches } from './_pitch.mjs';
import { addVouch, readVouches, artistPlaysAt, MIN_VOUCHES } from './_verify.mjs';
import { readSubs, saveSub, dropSub, notify } from './_push.mjs';
import { mutateProfile, getProfile, shapeMedia, parseMedia, MAX_PHOTOS, MAX_MERCH, MERCH_ID, normMerch } from './_profile.mjs';
import { readPosts, shapeForOwner, moderate } from './_community.mjs';
import { lookup } from './_embeds.mjs';
import { readLyrics, saveLyrics, getLyrics } from './_lyrics.mjs';
import { readEvents, mutateEvents, normEvent, reindexCities, occurrencesFor, endTimeOf,
         MAX_EVENTS } from './_events.mjs';
import { reindexSched } from './_auto.mjs';
import { startShow, endShow } from './_lifecycle.mjs';
import { stagePayload } from './stage.mjs';
import { decodeDataUrl, putImage, dropImage, SLOTS } from './_img.mjs';
import { PLANS, PLAN_KEYS, planForArtist, isPlatformOwner, merchAllowed, redeemPromo,
         readPromos, mutatePromos, cleanCode, MAX_LIBRARY, NOT_BUILT } from './_plan.mjs';

/* Rebuilds the projection of the active setlist after the library changed.

   It matters that this is the ADDITIVE half: `normShow()` can only ever subtract
   from `show.listSongs` on read, so if this never runs, a song that belongs in
   tonight's set stays missing from it until the next library change. That is worth
   telling the artist about, which is why the failure comes back as a note rather
   than being swallowed. */
async function syncActive(aid) {
  try { await refreshActive(aid); return null; }
  catch { return 'Saved — but tonight’s setlist didn’t refresh. Reopen the Setlist tab.'; }
}
const join = (note, warn) => (warn ? (note ? `${note} ${warn}` : warn) : note);

/* Plans, entitlements, billing, the account, and the codes Perry hands out. */
async function handlePlan(aid, action, body, req, me) {
  const B = await import('./_billing.mjs');
  // a subscribed artist is re-synced from Stripe every six hours — the belt for a
  // webhook that may not be configured
  if (action === 'planGet') await B.maybeSync(aid);
  const { plan, limits, artist } = await planForArtist(aid);
  const origin = req ? new URL(req.url).origin : '';

  if (action === 'planGet') {
    const mine = (me && me.role || 'owner') === 'owner';
    const b = await B.billingStatus(aid);
    return json({ ok: true, plan, limits: shapeLimits(limits),
                  shareStats: !artist || artist.shareStats !== false,
                  /* A member gets the LIMITS, because every lock in the Studio is
                     drawn from them and hiding them makes locks fail open. They do
                     not get the renewal date, the portal or the card's state. */
                  until: mine ? ((artist && artist.planUntil) || null) : null,
                  comped: !!(artist && artist.compedBy),
                  discountPct: mine ? ((artist && artist.discountPct) || 0) : 0,
                  plans: Object.fromEntries(PLAN_KEYS.map((k) => [k, shapeLimits(PLANS[k])])),
                  billing: mine ? b : { subscribed: b.subscribed, plan: b.plan, portal: false, pastDue: false },
                  role: (me && me.role) || 'owner',
                  // the Studio's leaving banner, and the reason everything else is read-only
                  del: (artist && artist.del) || null,
                  email: (me && me.email) || null,
                  owner: isPlatformOwner(aid) });
  }
  /* Straight back from the Stripe portal. maybeSync waits up to six hours, and
     somebody who has just put a new card on must not still be told it failed. */
  if (action === 'planSync') {
    await B.syncSubscription(aid).catch(() => null);
    const fresh = await planForArtist(aid);
    return json({ ok: true, plan: fresh.plan, billing: await B.billingStatus(aid) });
  }

  /* ---- billing: Stripe subscriptions (see _billing.mjs) ---- */
  if (action === 'planCheckout') {
    const want = ['plus', 'pro'].includes(body.plan) ? body.plan : null;
    if (!want) return bad('unknown plan');
    const r = await B.startCheckout({ owner: aid, plan: want, email: (me && me.email) || '', origin, back: '/studio' });
    if (!r.ok) return bad(r.error === 'already-subscribed' ? 'You already have a subscription — change it below instead.' : (r.error || 'Couldn’t open checkout'), r.error === 'payments-not-configured' ? 503 : 400);
    return json({ ok: true, url: r.url });
  }
  if (action === 'planFinish') {
    const r = await B.finishCheckout(aid, body.cs);
    if (!r.ok) return bad(r.error || 'Couldn’t confirm that', 400);
    return json({ ok: true, plan: r.plan, renewsAt: r.periodEnd });
  }
  if (action === 'planChange') {
    const want = ['free', 'plus', 'pro'].includes(body.plan) ? body.plan : null;
    if (!want) return bad('unknown plan');
    const r = await B.changePlan(aid, want);
    if (!r.ok) return bad(r.error === 'no-subscription' ? 'There’s no subscription to change — upgrade first.' : (r.error || 'Couldn’t change that'), 400);
    return json({ ok: true, plan: r.plan, cancelAtPeriodEnd: r.cancelAtPeriodEnd, renewsAt: r.periodEnd });
  }
  if (action === 'planRetainOffered') { await B.noteRetentionOffered(aid); return json({ ok: true }); }
  if (action === 'planRetain') {
    const r = await B.applyRetention(aid);
    if (!r.ok) return bad(r.error || 'Couldn’t apply that', 400);
    return json({ ok: true, plan: r.plan, renewsAt: r.periodEnd });
  }
  if (action === 'planInvoices') {
    const r = await B.invoices(aid);
    if (!r.ok) return bad(r.error || 'Couldn’t read your invoices', 400);
    return json({ ok: true, list: r.list });
  }
  if (action === 'planPortal') {
    const r = await B.portalLink(aid, origin, '/studio');
    if (!r.ok) return bad(r.error === 'no-billing' ? 'Nothing to manage yet.' : (r.error || 'Couldn’t open billing'), 400);
    return json({ ok: true, url: r.url });
  }

  /* ---- the account: take it with you, or leave (see _account.mjs) ---- */
  if (action === 'accountExport') {
    const { exportArtist } = await import('./_account.mjs');
    return json({ ok: true, data: await exportArtist(aid) });
  }
  /* LEAVING TAKES TWO SCREENS AND THEN THIRTY DAYS. `accountDelete` used to erase
     everything inside one request, from one sheet, with no undo. Now it marks the
     account, takes the page offline and stops the billing on the spot; the cron
     erases it a month later, and until then one tap brings it all back. */
  if (action === 'accountDelete') {
    if (String(body.confirm || '') !== 'DELETE') return bad('Type DELETE to confirm', 400);
    if ((me && me.role) !== 'owner') return bad('Only the account owner can delete it', 403);
    const { startDeletion } = await import('./_account.mjs');
    const r = await startDeletion(aid, (me && me.email) || 'studio code');
    if (!r.ok) return bad(r.error || 'Couldn’t delete', 400);
    const { note } = await import('./_session.mjs');
    note(aid, 'delete.start', (me && me.email) || 'code');
    const { sendNotice, readArtists: RA } = await import('./_auth.mjs');
    const reg = await RA();
    const nm = (reg.byId[aid] || {}).name || '';
    const when = new Date(r.purgeAt).toISOString().slice(0, 10);
    for (const [e, v] of Object.entries(reg.byEmail)) if (v.artistId === aid)
      sendNotice(e, 'Your MySet page is being deleted',
        [`${nm || 'Your page'} is offline from today.`,
         `Everything is kept until ${when}. Until then you can bring it back from Settings in your Studio, and nothing is lost.`,
         'Your plan has been cancelled, so you won’t be charged again.'], nm).catch(() => {});
    return json({ ok: true, purgeAt: r.purgeAt });
  }
  if (action === 'accountUndelete') {
    if ((me && me.role) !== 'owner') return bad('Only the account owner can do that', 403);
    const { cancelDeletion } = await import('./_account.mjs');
    const r = await cancelDeletion(aid);
    if (!r.ok) return bad(r.error || 'Nothing to undo', 400);
    const { note } = await import('./_session.mjs');
    note(aid, 'delete.cancel', (me && me.email) || 'code');
    return json({ ok: true, slugLost: !!r.slugLost });
  }
  if (action === 'accountFreeSlug') {
    if ((me && me.role) !== 'owner') return bad('Only the account owner can do that', 403);
    const { freeSlug } = await import('./_account.mjs');
    return json({ ok: true, ...(await freeSlug(aid)) });
  }

  if (action === 'promoRedeem') return json(await redeemPromo(aid, body.code));

  /* A venue seeing how many people turned up to a show IN THEIR OWN ROOM is the
     single biggest reason a venue signs up — and it is still the artist's data.
     Default on, because the ecosystem needs it; their switch, because it's
     theirs. Money is never in that payload at all. */
  if (action === 'shareStats') {
    await mutateArtists((r) => {
      const a = r.byId[aid];
      if (!a) return false;
      a.shareStats = body.on !== false;
      return true;
    });
    const r = await readArtists();
    return json({ ok: true, shareStats: (r.byId[aid] || {}).shareStats !== false });
  }

  /* ---- owner only, from here ---- */
  if (!isPlatformOwner(aid)) return bad('unauthorized', 401);

  /* Feature flags. Owner only, because a flag changes what every artist's room
     does. Never written during a show — see _flags.mjs. */
  if (action === 'flagList') {
    const { FLAGS, readFlags, flagsFor } = await import('./_flags.mjs');
    const f = await readFlags();
    return json({ ok: true,
      flags: Object.entries(FLAGS).map(([name, spec]) => ({
        name, what: spec.what, remove: spec.remove, default: spec.default,
        global: (f.global || {})[name], inForce: flagsFor(f, aid)[name] })),
      byArtist: f.byArtist || {} });
  }

  if (action === 'flagSet') {
    const { isFlag, mutateFlags, readFlags, flagsFor } = await import('./_flags.mjs');
    const name = String(body.flag || '');
    // own-property check: `FLAGS['toString']` is truthy and is not a flag
    if (!isFlag(name)) return bad('unknown flag');
    const who = body.artistId ? cleanArtistId(body.artistId) : '';
    const on = body.on === null || body.on === undefined ? null : !!body.on;
    await mutateFlags((f) => {
      if (who) {
        f.byArtist[who] ||= {};
        if (on === null) delete f.byArtist[who][name];    // back to the global answer
        else f.byArtist[who][name] = on;
      } else if (on === null) delete f.global[name];
      else f.global[name] = on;
      return true;
    });
    const f = await readFlags();
    return json({ ok: true, flag: name, scope: who || 'global',
                  inForce: flagsFor(f, who || aid)[name] });
  }

  /* THE GOOGLE SHEET. Owner only, and owner only for a reason that is not about
     trust: the sheet holds EVERY artist's rows, so it is platform data, not an
     artist's own. An artist wanting their own numbers gets them in the Studio.

     `sheetSync` can take a few seconds — it walks the store and makes a dozen
     Google calls — so it is a button somebody taps, never something on a path a
     room is waiting for. It cannot fail anything else: a broken sheet returns a
     sentence, not a 500. */
  if (action === 'sheetStatus') {
    const { sheetStatus } = await import('./_warehouse.mjs');
    return json(await sheetStatus());
  }
  if (action === 'sheetSync') {
    const { syncSheet } = await import('./_warehouse.mjs');
    try {
      const r = await syncSheet({ dry: body.dry === true });
      return json(r.ok ? r : { ...r, ok: false });
    } catch (e) {
      return json({ ok: false, error: String(e.message || e).slice(0, 500) });
    }
  }

  /* The ID review queue. Perry is the only person who ever sees one of these, and
     the photo is deleted the moment he decides either way. */
  if (action === 'idQueue') {
    const { readIdQueue } = await import('./_verify.mjs');
    const q = await readIdQueue();
    const reg = await readArtists();
    return json({ ok: true, queue: Object.entries(q.by)
      .filter(([, r]) => r.state === 'pending')
      .map(([id, r]) => ({ artistId: id,
                           /* what the ID says, per the artist, and what MySet knows
                              them as — a stage name difference is normal and is not
                              a red flag on its own */
                           legalName: r.legalName || '',
                           slug: (reg.byId[id] || {}).slug || '',
                           account: (reg.byId[id] || {}).name || '',
                           nameMatch: r.match || null,
                           dobMatch: r.dobMatch === undefined ? null : r.dobMatch,
                           at: r.at })) });
  }

  if (action === 'idApprove' || action === 'idReject') {
    const { mutateIdQueue, ID_SLOT, artistVerifyChecks } = await import('./_verify.mjs');
    const { getImage } = await import('./_img.mjs');
    const who = cleanArtistId(body.artistId || '');
    if (!who) return bad('which artist?');
    /* A target that does not exist is a 404, not a cheerful ok. This reported
       success for any string, which made a typo look like a decision. */
    const reg0 = await readArtists();
    if (!reg0.byId[who]) return bad('unknown artist', 404);
    const approve = action === 'idApprove';

    if (approve) {
      /* RE-CHECK, rather than trust the queue row. This used to verify any artist
         id outright — no ID on file, no plan, no Connect — so a mistap approved
         somebody who had done none of it. */
      const now = await artistVerifyChecks(who);
      if (!now.reviewed && !now.readyForReview) {
        return bad(!now.paidPlan ? 'They are not on a paid plan'
          : !now.payments ? 'Their card payments are not set up'
          : 'There is no ID on file for them', 409);
      }
      await mutateArtists((r) => {
        if (!r.byId[who]) return false;
        r.byId[who].verified = true;
        r.byId[who].verifiedAt = Date.now();
        return true;
      });
    } else {
      /* A rejection has to be able to UNDO an approval, or a mistake is permanent
         and a page keeps a tick it should not have. */
      await mutateArtists((r) => {
        if (!r.byId[who] || !r.byId[who].verified) return false;
        r.byId[who].verified = false;
        r.byId[who].verifiedAt = null;
        return true;
      });
    }

    await mutateIdQueue((q) => {
      q.by[who] = { state: approve ? 'approved' : 'rejected', at: Date.now(),
                    why: approve ? '' : String(body.why || '').slice(0, 140) };
      return true;
    });
    /* The photo goes now, either way. Keeping a stranger's government ID after the
       decision it was collected for is a liability nobody asked for — so the delete
       is VERIFIED and reported rather than swallowed. INVARIANT 0bk. */
    let idGone = true;
    try {
      await dropImage(who, ID_SLOT);
      idGone = !(await getImage(who, ID_SLOT));
    } catch { idGone = false; }
    return json({ ok: true, artistId: who, approved: approve, idDeleted: idGone,
      ...(idGone ? {} : { note: 'Their ID photo could not be deleted — try again.' }) });
  }

  /* A venue's plan. There is no venue self-serve billing yet, so the owner sets it
     — which is also how the tick gets unlocked for a venue. */
  if (action === 'venuePlan') {
    const { mutateVenues, VENUE_PLANS } = await import('./_venues.mjs');
    const vid = String(body.venueId || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40);
    const plan = String(body.plan || 'free');
    if (!VENUE_PLANS[plan]) return bad('unknown plan');
    let found = false;
    await mutateVenues((r) => {
      if (!r.byId[vid]) return false;
      r.byId[vid].plan = plan;
      /* The tick is part of Pro, so it goes with Pro. Leaving it set meant a venue
         kept a green tick on a free page for ever, which is a purchased trust
         signal that stopped being purchased. */
      if (plan === 'free' && r.byId[vid].verified) {
        r.byId[vid].verified = false;
        r.byId[vid].verifiedVia = null;
        r.byId[vid].verifiedAt = null;
      }
      found = true; return true;
    });
    if (!found) return bad('unknown venue', 404);
    return json({ ok: true, venueId: vid, plan });
  }

  if (action === 'promoList') {
    const d = await readPromos();
    return json({ ok: true, codes: Object.entries(d.codes).map(([code, c]) => ({
      code, plan: c.plan, pct: c.pct, months: c.months,
      maxUses: c.maxUses || 0, used: (c.usedBy || []).length, revoked: !!c.revoked })) });
  }

  if (action === 'promoCreate') {
    const code = cleanCode(body.code);
    if (code.length < 4) return bad('A code needs at least 4 characters');
    const pct = Math.max(1, Math.min(100, parseInt(body.pct, 10) || 100));
    const planKey = PLAN_KEYS.includes(body.plan) ? body.plan : 'pro';
    const months = Math.max(1, Math.min(60, parseInt(body.months, 10) || 12));
    const maxUses = Math.max(0, Math.min(9999, parseInt(body.maxUses, 10) || 0));
    let taken = false;
    await mutatePromos((d) => {
      if (d.codes[code]) { taken = true; return false; }
      d.codes[code] = { plan: planKey, pct, months, maxUses, usedBy: [], createdAt: Date.now() };
      return true;
    });
    if (taken) return bad('That code already exists');
    const d = await readPromos();
    return json({ ok: true, codes: Object.entries(d.codes).map(([c, v]) => ({
      code: c, plan: v.plan, pct: v.pct, months: v.months,
      maxUses: v.maxUses || 0, used: (v.usedBy || []).length, revoked: !!v.revoked })) });
  }

  /* Verifying a venue is a judgement call, so it is Perry's alone. Any venue can
     get itself verified instantly by proving it owns its website's domain; this
     is for everyone else — see VERIFYING-A-VENUE.md. */
  if (action === 'venueList' || action === 'venueVerify') {
    const { readVenues, mutateVenues } = await import('./_venues.mjs');
    if (action === 'venueVerify') {
      const vid = String(body.venue || '').slice(0, 40);
      await mutateVenues((r) => {
        const v = r.byId[vid];
        if (!v) return false;
        v.verified = !v.verified;
        v.verifiedVia = v.verified ? 'owner' : null;
        v.verifiedAt = v.verified ? Date.now() : null;
        return true;
      });
    }
    const r = await readVenues();
    return json({ ok: true, venues: Object.entries(r.byId).map(([vid, v]) => ({
      venueId: vid, slug: v.slug, name: v.name, city: v.city, country: v.country,
      verified: !!v.verified, via: v.verifiedVia || null, createdAt: v.createdAt || 0,
    })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)) });
  }

  if (action === 'promoRevoke') {
    const code = cleanCode(body.code);
    await mutatePromos((d) => { if (d.codes[code]) d.codes[code].revoked = !d.codes[code].revoked; return true; });
    const d = await readPromos();
    return json({ ok: true, codes: Object.entries(d.codes).map(([c, v]) => ({
      code: c, plan: v.plan, pct: v.pct, months: v.months,
      maxUses: v.maxUses || 0, used: (v.usedBy || []).length, revoked: !!v.revoked })) });
  }
  return bad('unknown action', 400);
}
const shapeLimits = (l) => ({
  label: l.label, price: l.price,
  featured: l.featured === Infinity ? null : l.featured,
  gigs: l.gigs === Infinity ? null : (l.gigs || null),
  pricing: !!l.pricing,
  setlists: !!l.setlists,      // so the Studio can say so BEFORE the server refuses
  merch: !!l.merch,
  moderate: !!l.moderate,      // permanently deleting a fan's post; hiding stays free
  library: MAX_LIBRARY,
  cut: l.cut, seats: l.seats,
  promote: l.promote, analytics: l.analytics, presskit: l.presskit, branding: l.branding,
  /* Shipped on every plan row so the Studio can grey a designed-but-unbuilt
     feature as "coming" rather than as "yours" — see NOT_BUILT in _plan.mjs. */
  soon: NOT_BUILT,
});
/* An action NOT in this table needs no capability beyond being signed in — every
   money, plan and access action is already refused by name inside handlePlan or by
   `isPlatformOwner`. What is listed here is the everyday work of running a page,
   and the only thing it takes away is from `crew`: the sound engineer running the
   screen tonight can work the show and the requests, and cannot rewrite the
   library, the profile, the calendar or the shop. */
const CAPABILITY = {
  addSong: 'library', editSong: 'library', removeSong: 'library', importSongs: 'library',
  songSet: 'library', bulkSongs: 'library', setChart: 'library', setLyrics: 'library',
  listSave: 'library', listDelete: 'library', listApply: 'library', learnAdd: 'library', learnRemove: 'library',
  eventSave: 'gigs', eventDelete: 'gigs', eventSkip: 'gigs', eventUnskip: 'gigs',
  featureList: 'gigs',
  profileSave: 'profile', merchSave: 'profile', merchDelete: 'profile', imgSave: 'profile', imgDelete: 'profile',
  postReply: 'community', postHide: 'community', postDelete: 'community',
  accountExport: 'export',
};

const PLAN_ACTIONS = new Set(['planGet', 'promoRedeem', 'planCheckout', 'planFinish', 'planChange', 'planRetainOffered', 'planRetain', 'planPortal', 'planSync', 'planInvoices', 'accountExport', 'accountDelete', 'accountUndelete', 'accountFreeSlug', 'promoList', 'promoCreate', 'promoRevoke',
                              'venueList', 'venueVerify', 'shareStats',
                              // the ID review queue and a venue's plan — owner only,
                              // enforced inside handlePlan, not by this set
                              'idQueue', 'idApprove', 'idReject', 'venuePlan',
                              'flagList', 'flagSet',
                              // the Google Sheet export — owner only, same as above
                              'sheetStatus', 'sheetSync']);

/* The gig calendar. Events are their own document, so these short-circuit too.
   Every write reindexes the artist's cities, which is what keeps the public
   country/city feed correct without a job to run. */
async function handleEvents(aid, action, body) {
  if (action === 'eventList') {
    const events = await readEvents(aid);
    // Expanded here, never in the browser. One implementation of "when does this
    // repeat" — the same reason rankSongs exists (INVARIANT 12b).
    const from = /^\d{4}-\d{2}-\d{2}$/.test(body.from || '') ? body.from : null;
    const to = /^\d{4}-\d{2}-\d{2}$/.test(body.to || '') ? body.to : null;
    const occ = from && to ? occurrencesFor(events, from, to) : [];
    // cancelled nights are hidden from the public feed but the artist must see
    // them, so they are expanded separately and flagged
    const cancelled = [];
    for (const ev of events.list) {
      const hid = new Set(ev.hid || []);
      for (const d of ev.skip || []) {
        if (hid.has(d)) continue;                        // dismissed for good
        if (from && to && d >= from && d <= to)
          cancelled.push({ eventId: ev.id, date: d, time: ev.time, endTime: endTimeOf(ev),
                           venue: ev.venue, city: ev.city, country: ev.country,
                           address: ev.address || '',
                           repeating: !!ev.repeat, cancelled: true });
      }
    }
    return json({ ok: true, events: events.list,
                  occurrences: [...occ, ...cancelled].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)) });
  }

  if (action === 'eventSave') {
    const incoming = body.event || {};
    const id = String(incoming.id || '').slice(0, 24) ||
               'g' + Math.random().toString(36).slice(2, 10);   // outside the CAS
    let full = false;
    const ev = normEvent({ ...incoming, id });
    if (!ev.date) return bad('Pick a date');
    if (!ev.venue) return bad('Where is it?');
    /* A setlist that no longer exists must not stick to a gig — but 'all' is not a
       setlist id, it is the sentinel for "play the whole library tonight", so it has
       to survive this. Blanking it turned the artist's explicit "All songs" back
       into "no opinion", which is a different instruction. */
    if (ev.listId && ev.listId !== 'all') {
      const known = new Set((await readLists(aid)).lists.map((l) => l.id));
      if (!known.has(ev.listId)) ev.listId = '';
    }
    await mutateEvents(aid, (d) => {
      const at = d.list.findIndex((x) => x.id === id);
      if (at >= 0) d.list[at] = { ...ev, skip: d.list[at].skip || [], hid: d.list[at].hid || [],
                                  createdAt: d.list[at].createdAt };
      else if (d.list.length >= MAX_EVENTS) { full = true; return false; }
      else d.list.push(ev);
      return true;
    });
    if (full) return bad('That is as many gigs as one calendar can hold');
    const events = await readEvents(aid);
    await Promise.all([reindexCities(aid, events), reindexSched(aid, events)]);
    return json({ ok: true, id, events: events.list });
  }

  if (action === 'eventDelete') {
    await mutateEvents(aid, (d) => { d.list = d.list.filter((x) => x.id !== body.id); return true; });
    const events = await readEvents(aid);
    await Promise.all([reindexCities(aid, events), reindexSched(aid, events)]);
    return json({ ok: true, events: events.list });
  }

  // dismiss a cancelled night from the list for good. The skip stays on the rule
  // (otherwise the night reappears); this only stops showing it.
  if (action === 'eventHide') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : null;
    if (!date) return bad('bad date');
    let gone = false;
    await mutateEvents(aid, (d) => {
      const ev = d.list.find((x) => x.id === body.id);
      if (!ev) return false;
      if (!ev.repeat) { d.list = d.list.filter((x) => x.id !== body.id); gone = true; return true; }
      ev.skip = Array.isArray(ev.skip) ? ev.skip : [];
      ev.hid = Array.isArray(ev.hid) ? ev.hid : [];
      if (!ev.skip.includes(date)) ev.skip.push(date);
      if (!ev.hid.includes(date)) ev.hid.push(date);
      return true;
    });
    const events = await readEvents(aid);
    if (gone) await reindexCities(aid, events);
    await reindexSched(aid, events);          // a hidden night is a skipped night
    return json({ ok: true, events: events.list });
  }

  // cancel or un-cancel a single night of a residency without touching the rule
  if (action === 'eventSkip') {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date || '') ? body.date : null;
    if (!date) return bad('bad date');
    await mutateEvents(aid, (d) => {
      const ev = d.list.find((x) => x.id === body.id);
      if (!ev) return false;
      ev.skip = Array.isArray(ev.skip) ? ev.skip : [];
      ev.hid = Array.isArray(ev.hid) ? ev.hid : [];
      const at = ev.skip.indexOf(date);
      if (body.on === false) {
        if (at >= 0) ev.skip.splice(at, 1);
        ev.hid = ev.hid.filter((d) => d !== date);      // restoring un-hides too
      } else if (at < 0) ev.skip.push(date);
      return true;
    });
    const events = await readEvents(aid);
    await reindexSched(aid, events);          // a cancelled night must not start itself
    return json({ ok: true, events: events.list });
  }
  return bad('unknown action', 400);
}
const EVENT_ACTIONS = new Set(['eventList', 'eventSave', 'eventDelete', 'eventSkip', 'eventHide']);

/* An artist asking a venue for a spot, and an artist confirming they play at one.
   Both need an artist session — that IS the feature. A venue gets a link to a
   real page with real numbers on it instead of a bio and a promise, and a vouch
   means somebody with their own account and their own gig history. */
async function handleVenueSide(aid, action, body) {
  const { venueBySlug, venueById, getVenueProfile, shapeVenue } = await import('./_venues.mjs');
  const reg = await readArtists();
  const me = reg.byId[aid] || {};

  if (action === 'pitchList')
    return json({ ok: true, pitches: await shapeForArtist(aid) });

  const slug = String(body.venue || '').slice(0, 40);
  if (!slug) return bad('which venue?', 400);
  const vid = await venueBySlug(slug);
  if (!vid) return bad('unknown venue', 404);
  const venue = shapeVenue(await getVenueProfile(vid), await venueById(vid));

  if (action === 'pitchStatus') {
    const [d, vouches, canVouch] = await Promise.all([
      readPitches(vid), readVouches(vid), artistPlaysAt(aid, venue)]);
    const mine = (d.list || []).find((x) => x.aid === aid);
    return json({ ok: true,
      sent: !!mine, status: mine ? mine.status : null, message: mine ? mine.message : '',
      canVouch, vouched: !!(vouches.by || {})[aid],
      vouches: Object.keys(vouches.by || {}).length, need: MIN_VOUCHES,
      venue: { name: venue.name, slug: venue.slug, verified: venue.verified } });
  }

  if (action === 'pitchSend') {
    const r = await sendPitch({ vid, venueName: venue.name, venueSlug: venue.slug, aid,
                                artist: { slug: me.slug || '', name: me.name || '' },
                                message: body.message });
    if (!r.ok) return bad(r.error);
    return json({ ok: true, already: r.already, updated: r.updated,
                  pitches: await shapeForArtist(aid) });
  }

  if (action === 'vouch') {
    const r = await addVouch(vid, aid, { slug: me.slug || '', name: me.name || '' }, venue);
    if (!r.ok) return bad(r.error);
    return json({ ok: true, ...r });
  }
  return bad('unknown action', 400);
}
const VENUE_SIDE = new Set(['pitchList', 'pitchStatus', 'pitchSend', 'vouch']);

/* Everything the song sheet needs, in one round trip: the song, its chart, its
   audience lyrics, and the whole tag vocabulary. Charts live in their own
   documents so this never touches the show record. */
async function handleSong(aid, action, body, show) {
  const vocab = () => ({
    builtin: GENRES.map(([id, label]) => ({ id, label })),
    own: show.tags, maxOwn: MAX_OWN_TAGS, maxPerSong: MAX_SONG_TAGS,
  });

  if (action === 'songGet') {
    const song = show.songs.find((x) => x.id === body.song);
    if (!song) return bad('unknown song', 404);
    const [chart, lyr] = await Promise.all([
      readChart(aid, song.id), readLyrics(aid, song.id),
    ]);
    return json({ ok: true, song: {
      id: song.id, title: song.title, artist: song.artist || '',
      key: song.key || '', tags: song.tags || [], active: song.active !== false,
    }, chart, lyrics: {
      plain: (lyr && lyr.plain) || '', credit: (lyr && lyr.credit) || '',
      state: (lyr && lyr.state) || 'unfetched', owned: !!(lyr && lyr.owned),
    }, tags: vocab() });
  }

  if (action === 'chartSet') {
    const song = show.songs.find((x) => x.id === body.song);
    if (!song) return bad('unknown song', 404);
    await saveChart(aid, song.id, body.chart);
    return json({ ok: true, chart: await readChart(aid, song.id) });
  }

  if (action === 'chartFlags')
    return json({ ok: true, flags: await chartFlags(aid, show.songs.map((x) => x.id)) });

  if (action === 'tagList')
    return json({ ok: true, tags: vocab(), untagged: show.songs.filter((x) => !(x.tags || []).length).length });

  /* Fill in the genres, from a curated map of how streaming services actually
     classify these songs. Only ever fills a song that has NONE — an artist's own
     choice is never overwritten, so running it twice is safe and running it after
     hand-tagging leaves the hand-tagging alone. */
  if (action === 'tagAuto') {
    const { artistById } = await import('./_auth.mjs');
    const me = await artistById(aid);
    const owner = (me && me.name) || '';
    let filled = 0, kept = 0, unknown = [];
    await mutateShow(aid, (sh) => {
      // reset: casDoc re-runs this callback on a write conflict, and counters that
      // survive the retry report double what actually happened
      filled = 0; kept = 0; unknown = [];
      const known = new Set([...GENRE_IDS, ...sh.tags.map((t) => t.id)]);
      for (const sg of sh.songs) {
        if ((sg.tags || []).length) { kept++; continue; }
        const g = genresFor(sg.title, sg.artist, owner).filter((x) => known.has(x));
        if (!g.length) { unknown.push(sg.title); continue; }
        sg.tags = g.slice(0, MAX_SONG_TAGS);
        filled++;
      }
      return filled > 0;
    });
    // tags don't change setlist membership, but they do change what normShow keeps
    const warn = await syncActive(aid);
    return json({ ok: true, filled, kept, unknown: unknown.slice(0, 40),
                  unknownCount: unknown.length, mapSize: MAP_SIZE, note: warn,
                  stage: await stagePayload(aid) });
  }

  if (action === 'tagAdd') {
    const label = cleanTagLabel(body.label);
    if (!label) return bad('Give it a name');
    let why = null;
    await mutateShow(aid, (sh) => {
      const next = normOwnTags([...(sh.tags || []), { label }]);
      if (next.length === (sh.tags || []).length) {
        why = (sh.tags || []).length >= MAX_OWN_TAGS
          ? `That's ${MAX_OWN_TAGS} of your own genres — plenty. Rename one instead.`
          : 'You’ve already got that one (or it’s one of the built-in genres).';
        return false;
      }
      sh.tags = next;
      return true;
    });
    if (why) return bad(why);
    const fresh = await getShow(aid);
    return json({ ok: true, tags: { builtin: GENRES.map(([id, label]) => ({ id, label })),
      own: fresh.tags, maxOwn: MAX_OWN_TAGS, maxPerSong: MAX_SONG_TAGS } });
  }

  if (action === 'tagRemove') {
    const id = String(body.id || '');
    if (!id.startsWith('c-')) return bad('The built-in genres stay put');
    await mutateShow(aid, (sh) => {
      sh.tags = (sh.tags || []).filter((t) => t.id !== id);
      // and off every song, so nothing points at a tag that no longer exists
      sh.songs = sh.songs.map((x) => ({ ...x, tags: (x.tags || []).filter((t) => t !== id) }));
      return true;
    });
    const fresh = await getShow(aid);
    return json({ ok: true, tags: { builtin: GENRES.map(([id2, label]) => ({ id: id2, label })),
      own: fresh.tags, maxOwn: MAX_OWN_TAGS, maxPerSong: MAX_SONG_TAGS } });
  }
  return bad('unknown action', 400);
}
const SONG_ACTIONS = new Set(['songGet', 'chartSet', 'chartFlags', 'tagList', 'tagAdd',
                              'tagRemove', 'tagAuto']);

/* SETLISTS and the to-learn list. Both live in their own documents, so none of
   this touches the record the room polls — except `listUse`, which has to write
   the projection (see the note in _lists.mjs). */
/* Narrowing tonight's list used to hand every credit held on the dropped songs back
   to the room, from here and from the mutateShow switch, so that neither path could
   be the one that forgot. Both are gone: a vote is spent when it is cast (see the
   ledger header in _lib.mjs), so there is nothing to give back and nothing to
   announce. What the artist IS still told is which songs came off the list, which
   `send()` already had in hand. */

async function handleLists(aid, action, body) {
  const show = await getShow(aid);
  /* Snapshot what the room can vote for, so `send()` can tell whether the change
     actually took anything away. Two reads already in hand, versus twelve. */
  const send = async (extra = {}) => {
    const [d, sh] = [await readLists(aid), await getShow(aid)];
    return json({ ok: true, lists: shapeLists(d, sh),
                  listId: sh.listId, listName: sh.listName, ...extra });
  };

  if (action === 'listAll') return send();

  if (action === 'listNew') {
    /* Making a NEW setlist is a Plus feature. Everything else about setlists keeps
       working on free — an artist who downgrades can still use, rename and edit the
       sets they already have, because a cap never deletes anything (INVARIANT 0s).
       Only creating another one is gated. */
    if (!isPlatformOwner(aid) && (await planForArtist(aid)).limits.setlists !== true)
      return bad('Separate setlists are a Plus feature — everything you already have keeps working.', 402);
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name) return bad('Give the set a name');
    const id = 'l' + Math.random().toString(36).slice(2, 9);      // outside the CAS
    let full = false;
    await mutateLists(aid, (d) => {
      if (d.lists.length >= MAX_LISTS) { full = true; return false; }
      d.lists.push({ id, name, songs: Array.isArray(body.songs) ? body.songs : [], at: Date.now() });
      return true;
    });
    if (full) return bad(`${MAX_LISTS} setlists is plenty — rename one instead.`);
    return send({ id });
  }

  if (action === 'listRename') {
    const name = String(body.name || '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name) return bad('It needs a name');
    await mutateLists(aid, (d) => {
      const l = d.lists.find((x) => x.id === body.id);
      if (!l) return false;
      l.name = name;
      return true;
    });
    await refreshActive(aid);                 // the name is projected too
    return send();
  }

  if (action === 'listDelete') {
    await mutateLists(aid, (d) => { d.lists = d.lists.filter((x) => x.id !== body.id); return true; });
    // if the one in play just went, fall back to the whole library
    if (show.listId === body.id) await applyList(aid, '');
    return send();
  }

  if (action === 'listSongs') {          // set the whole membership at once
    const want = [...new Set((Array.isArray(body.songs) ? body.songs : [])
      .filter((x) => typeof x === 'string'))];
    const have = new Set(show.songs.map((x) => x.id));
    const songs = want.filter((x) => have.has(x));
    await mutateLists(aid, (d) => {
      const l = d.lists.find((x) => x.id === body.id);
      if (!l) return false;
      l.songs = songs;
      return true;
    });
    if (show.listId === body.id) await applyList(aid, body.id);
    return send();
  }

  if (action === 'listToggle') {         // one song in or out
    let now = null;
    await mutateLists(aid, (d) => {
      const l = d.lists.find((x) => x.id === body.id);
      if (!l) return false;
      const at = l.songs.indexOf(body.song);
      if (at >= 0) { l.songs.splice(at, 1); now = false; } else { l.songs.push(body.song); now = true; }
      return true;
    });
    if (now === null) return bad('unknown setlist', 404);
    if (show.listId === body.id) await applyList(aid, body.id);
    return send({ inList: now });
  }

  if (action === 'listUse') {
    const r = await applyList(aid, body.id || '');
    return send({ used: r });
  }

  /* ---------- songs to learn ---------- */
  if (action === 'learnList') return json({ ok: true, learn: (await readLearn(aid)).list });

  if (action === 'learnAdd') {
    const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    if (!title) return bad('What song?');
    const id = 'w' + Math.random().toString(36).slice(2, 9);
    let full = false;
    await mutateLearn(aid, (d) => {
      if (d.list.length >= MAX_LEARN) { full = true; return false; }
      d.list.push({ id, title, artist: String(body.artist || '').trim().slice(0, 60),
                    note: String(body.note || '').trim().slice(0, 140), at: Date.now() });
      return true;
    });
    if (full) return bad('That is a long list already — learn a few first.');
    return json({ ok: true, learn: (await readLearn(aid)).list });
  }

  if (action === 'learnRemove') {
    await mutateLearn(aid, (d) => { d.list = d.list.filter((x) => x.id !== body.id); return true; });
    return json({ ok: true, learn: (await readLearn(aid)).list });
  }

  /* Learned it. Moves the row into the real library and drops it from the list —
     one action, because doing it in two leaves a duplicate if the second fails. */
  if (action === 'learnDone') {
    const d0 = await readLearn(aid);
    const row = d0.list.find((x) => x.id === body.id);
    if (!row) return bad('unknown song', 404);
    const cap = (await planForArtist(aid)).limits.featured;
    const featureCap = cap === Infinity ? null : cap;
    const { artistById } = await import('./_auth.mjs');
    const ownerName = ((await artistById(aid)) || {}).name || '';
    let sid = null, note = null;
    await mutateShow(aid, (sh) => {
      if (sh.songs.length >= MAX_LIBRARY) return false;
      let id = songId(row.title, row.artist);
      if (sh.songs.some((x) => x.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
      const live = sh.songs.filter((x) => x.active !== false).length;
      const on = featureCap === null || live < featureCap;
      if (!on) note = `Added, but switched off — your plan features ${featureCap} at a time.`;
      // it arrives with genres already on, same as auto-tag would give it
      const known = new Set([...GENRE_IDS, ...sh.tags.map((t) => t.id)]);
      const tags = genresFor(row.title, row.artist, ownerName)
        .filter((x) => known.has(x)).slice(0, MAX_SONG_TAGS);
      sh.songs.push({ id, title: row.title, artist: row.artist || '', active: on, key: '', tags });
      sid = id;
      return true;
    });
    if (!sid) return bad(`That's ${MAX_LIBRARY} songs — more than any setlist needs.`, 402);
    await mutateLearn(aid, (d) => { d.list = d.list.filter((x) => x.id !== body.id); return true; });
    /* This is one of the ways a song id can APPEAR in the library — including an id
       an old setlist still holds — so the projection has to be rebuilt. */
    note = join(note, await syncActive(aid));
    return json({ ok: true, songId: sid, note,
                  learn: (await readLearn(aid)).list, stage: await stagePayload(aid) });
  }
  return bad('unknown action', 400);
}
const LIST_ACTIONS = new Set(['listAll', 'listNew', 'listRename', 'listDelete', 'listSongs',
  'listToggle', 'listUse', 'learnList', 'learnAdd', 'learnRemove', 'learnDone']);

/* Requests live in their own document, so accepting or declining one never
   rewrites the show — except for `askAccept`, which has to add a song. */
async function handleAsks(aid, action, body) {
  const show = await getShow(aid);

  if (action === 'askList')
    return json({ ok: true, asks: shapeRequests(await readRequests(aid), show) });

  const id = String(body.id || '').slice(0, 24);
  if (!id) return bad('which request?', 400);

  if (action === 'askDone' || action === 'askDecline') {
    const row = await resolveRequest(aid, id, action === 'askDone' ? 'played' : 'declined', show);
    if (!row) return bad('That one has already been dealt with', 409);
    /* `row.refunded` is what was really given back, not what it cost. A decline of
       a request from an earlier show refunds nothing on purpose — those credits have
       already refreshed, so refunding would mint votes (INVARIANT 0ac). */
    const note = action === 'askDecline' && row.cost > 0 && !row.refunded
      ? 'Declined. No votes to give back — that request was from an earlier show.' : null;
    return json({ ok: true, refunded: row.refunded || 0, note,
                  asks: shapeRequests(await readRequests(aid), show), stage: await stagePayload(aid) });
  }

  if (action === 'askAccept') {
    const d = await readRequests(aid);
    const row = (d.list || []).find((x) => x.id === id);
    if (!row) return bad('unknown request', 404);
    if (row.kind !== 'song') return bad('Nothing to add for that one', 400);

    const cap = (await planForArtist(aid)).limits.featured;
    const featureCap = cap === Infinity ? null : cap;
    const room = (sh) => featureCap === null
      || sh.songs.filter((x) => x.active !== false).length < featureCap;
    let songId = null, full = false, capped = false;
    await mutateShow(aid, (sh) => {
      full = false; capped = false;
      if (sh.songs.length >= MAX_LIBRARY) { full = true; return false; }
      let sid = slug(row.title);
      if (sh.songs.some((x) => x.id === sid)) {
        const had = sh.songs.find((x) => x.id === sid);
        if (had.active === false) {                          // it was hidden
          if (!room(sh)) { capped = true; return false; }
          had.active = true;                                 // bring it back
        }
        songId = had.id;
        return true;
      }
      /* The plan's featured cap would add it switched OFF, which is the same
         invisibility the setlist bug caused: the fan paid, was told "on the list",
         and nobody can vote for it. Refuse instead — the request stays pending, so
         their credits are still attached to something the artist can honour or
         decline for a refund. */
      if (!room(sh)) { capped = true; return false; }
      sh.songs.push({ id: sid, title: row.title, artist: row.artist || '', active: true,
                      requested: true });
      songId = sid;
      return true;
    });
    if (full) return bad(`That's ${MAX_LIBRARY} songs — more than any setlist needs.`, 402);
    if (capped) return bad(`Your plan features ${featureCap} songs at a time. Switch one off first, then accept this — their votes stay put until you do.`, 402);

    /* Adding it to the LIBRARY is not enough when a setlist is active: playable()
       would exclude it, /api/show would never list it, and vote.mjs would answer
       "that one isn't on tonight's list" — while the fan who paid three credits was
       told "On the list — go vote for it". Accepting a request is an explicit
       "yes, I'll play this tonight", so the song joins tonight's set. */
    let note = null;
    if (songId && show.listId) {
      await mutateLists(aid, (d) => {
        const l = d.lists.find((x) => x.id === show.listId);
        if (!l || l.songs.includes(songId)) return false;
        l.songs.push(songId);
        return true;
      });
      try {
        const r = await applyList(aid, show.listId);
        note = `Added to “${r.listName}” too, so the room can vote for it.`;
      } catch { note = 'Added — but check it landed in tonight’s set.'; }
    }
    await attachSong(aid, id, songId);
    return json({ ok: true, songId, note, asks: shapeRequests(await readRequests(aid), show),
                  stage: await stagePayload(aid) });
  }
  return bad('unknown action', 400);
}
const ASK_ACTIONS = new Set(['askList', 'askAccept', 'askDone', 'askDecline']);

/* Lyrics live in their own flat docs, not on the show, so these short-circuit too. */
async function handleLyrics(aid, action, body, show) {
  const song = show.songs.find((x) => x.id === body.song);
  if (!song && action !== 'lyricsWarm') return bad('unknown song', 404);

  if (action === 'lyricsGet') {
    const d = await readLyrics(aid, body.song);
    return json({ ok: true, song: body.song, title: song.title, artist: song.artist || '',
                  plain: (d && d.plain) || '', credit: (d && d.credit) || '',
                  state: (d && d.state) || 'unfetched', owned: !!(d && d.owned) });
  }

  if (action === 'lyricsSet') {
    const plain = String(body.plain || '').replace(/\r/g, '').slice(0, 20000).trim();
    if (!plain) {                               // empty = take them down
      await saveLyrics(aid, body.song, { v: 1, songId: body.song, title: song.title,
        artist: song.artist || '', plain: '', synced: '', credit: '',
        state: 'blocked', fetchedAt: Date.now() });
      return json({ ok: true, cleared: true });
    }
    await saveLyrics(aid, body.song, {
      v: 1, songId: body.song, title: song.title, artist: song.artist || '',
      plain, synced: '', credit: String(body.credit || '').slice(0, 200),
      state: 'ok', owned: !!body.owned,
      source: body.owned ? 'artist' : 'lrclib', fetchedAt: Date.now(),
    });
    return json({ ok: true });
  }

  if (action === 'lyricsFetch') {              // pull this one from LRCLIB now
    await saveLyrics(aid, body.song, { v: 1, songId: body.song, state: 'unfetched', fetchedAt: 0 });
    const d = await getLyrics(aid, song);
    return json({ ok: true, found: !!(d && d.state === 'ok' && d.plain),
                  plain: (d && d.plain) || '', credit: (d && d.credit) || '' });
  }

  if (action === 'lyricsWarm') {               // whole setlist, once, before a gig
    const todo = show.songs.filter((x) => x.active !== false);
    let got = 0; const missing = [];
    for (const sg of todo) {
      const d = await getLyrics(aid, sg);
      if (d && d.state === 'ok' && d.plain) got++; else missing.push(sg.title);
      await new Promise((r) => setTimeout(r, 350));   // LRCLIB asks for spacing
    }
    return json({ ok: true, fetched: got, total: todo.length, missing: missing.slice(0, 40) });
  }
  return bad('unknown action', 400);
}
const LYRICS_ACTIONS = new Set(['lyricsGet', 'lyricsSet', 'lyricsFetch', 'lyricsWarm']);

/* Profile edits don't touch the show record at all, so they short-circuit before
   the show mutation below. */
async function handleProfile(aid, action, body, req, me) {
  if (action === 'profileSet') {
    await mutateProfile(aid, (p) => {
      for (const k of ['name', 'tagline', 'bio', 'photo', 'avatar'])
        if (typeof body[k] === 'string') p[k] = body[k];
      if (Array.isArray(body.photos)) p.photos = body.photos;
      if (body.links && typeof body.links === 'object')
        p.links = { ...p.links, ...body.links };
      return true;
    });
    return json({ ok: true, profile: await getProfile(aid) });
  }

  if (action === 'mediaAdd') {
    const m = parseMedia(body.url);
    if (!m) return bad('That isn’t a YouTube, Spotify or Apple Music link I can embed.', 400);
    const info = await lookup(m);
    if (!info.ok) return bad(info.why, 400);
    const mid = 'm' + Math.random().toString(36).slice(2, 9);   // outside the CAS
    let added = null;
    await mutateProfile(aid, (p) => {
      const dupe = p.media.some((x) =>
        x.provider === m.provider && x.id === m.id &&
        (x.i || null) === (m.i || null) && (x.list || null) === (m.list || null));
      if (dupe) return false;
      added = { mid, ...m, title: String(body.title || info.title || '').slice(0, 120),
                thumb: String(info.thumb || '').slice(0, 300) };
      p.media.push(added);
      return true;
    });
    if (!added) return bad('That one’s already on your page.', 409);
    return json({ ok: true, item: shapeMedia(added) });
  }

  /* A photo straight off the phone. The browser has already shrunk it; this
     checks the bytes really are an image and stores them against the artist. */
  if (action === 'photoUpload') {
    const slot = String(body.slot || '');
    if (!SLOTS.has(slot)) return bad('unknown photo slot');
    /* SLOTS is a list of valid NAMES, not a limit. It listed p0..p2 until venue
       Pro needed twelve, and until then this line was accidentally the artist's
       cap as well — so widening the set uncapped an endpoint that has always
       been meant to hold three. normProfile trims the array on read either way,
       which means the extra bytes would sit in Blobs forever, referenced by
       nothing. */
    const pi = /^p(\d+)$/.test(slot) ? Number(slot.slice(1)) : -1;
    if (pi >= MAX_PHOTOS) return bad('unknown photo slot');
    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    const url = await putImage(aid, slot, dec.bytes, dec.type);
    await mutateProfile(aid, (p) => {
      if (slot === 'cover') p.photo = url;
      else if (slot === 'avatar') p.avatar = url;
      else {
        const i = Number(slot.slice(1));
        p.photos = Array.isArray(p.photos) ? p.photos : [];
        while (p.photos.length <= i) p.photos.push('');
        p.photos[i] = url;
      }
      return true;
    });
    return json({ ok: true, url, profile: await getProfile(aid) });
  }

  if (action === 'photoClear') {
    const slot = String(body.slot || '');
    if (!SLOTS.has(slot)) return bad('unknown photo slot');
    await dropImage(aid, slot);
    await mutateProfile(aid, (p) => {
      if (slot === 'cover') p.photo = '';
      else if (slot === 'avatar') p.avatar = '';
      else {
        const i = Number(slot.slice(1));
        if (Array.isArray(p.photos) && p.photos[i]) p.photos[i] = '';
      }
      return true;
    });
    return json({ ok: true, profile: await getProfile(aid) });
  }

  /* ---------- the verification tick, for an ARTIST ----------
     Premium plan + card payments actually set up + a photo ID that matches the
     account + Perry's eyes. See _verify.mjs for why the ID is never public and
     never kept. */
  /* ---------- getting paid ----------
     Onboarding is Stripe-hosted (Express), so MySet never sees a bank detail. The
     artist's own money cannot flow until Stripe says charges_enabled — see
     _connect.mjs and INVARIANT 0bl. */
  if (action === 'payStatus') {
    const { connectStatus, syncFromStripe } = await import('./_connect.mjs');
    // a cheap refresh when they have started but Stripe has not called back yet
    if (body.refresh) {
      await syncFromStripe(aid).catch(() => {});
      // Stripe may have finished its identity check since they last looked
      const { tryAutoVerify } = await import('./_verify.mjs');
      await tryAutoVerify(aid).catch(() => {});
    }
    return json({ ok: true, pay: await connectStatus(aid) });
  }

  if (action === 'payStart') {
    const { ensureAccount, onboardingLink, connectStatus } = await import('./_connect.mjs');
    const origin = new URL(req.url).origin;
    const { cleanCountry, readConnect } = await import('./_connect.mjs');
    /* REFUSE rather than let Stripe pick. An Express account's country cannot be
       changed afterwards, and with no value Stripe assigns the PLATFORM's — so an
       artist on Koh Phangan would get a US account and could never be paid out
       properly. Validated against a real list, because slicing a country NAME to two
       letters turns Germany into GE. Only asked once: only the first call creates
       the account. */
    const country = cleanCountry(body.country);
    const existing = await readConnect(aid);
    if (!existing.acct && !country) return bad('need-country', 428);
    const made = await ensureAccount(aid, me.email || '', country);
    if (!made.ok) return bad(made.error || 'could not start', 502);
    const link = await onboardingLink(aid, origin);
    if (!link.ok) return bad(link.error || 'could not start', 502);
    return json({ ok: true, url: link.url, pay: await connectStatus(aid) });
  }

  if (action === 'payDashboard') {
    const { dashboardLink } = await import('./_connect.mjs');
    const l = await dashboardLink(aid);
    if (!l.ok) return bad(l.error || 'not available', 502);
    return json({ ok: true, url: l.url });
  }

  if (action === 'verifyStatus') {
    const { artistVerifyChecks, tryAutoVerify } = await import('./_verify.mjs');
    /* Ask on every look. It is a handful of reads and it means an artist whose
       Stripe check completed overnight finds the tick waiting rather than a queue
       they have to be told about. */
    const auto = await tryAutoVerify(aid).catch(() => null);
    return json({ ok: true, checks: await artistVerifyChecks(aid),
                  autoWhy: auto && !auto.verified ? auto.why : null });
  }

  if (action === 'idUpload') {
    const { artistVerifyChecks, ID_SLOT, mutateIdQueue } = await import('./_verify.mjs');
    const pre = await artistVerifyChecks(aid);
    /* Refuse BEFORE taking the photo. Asking a stranger for their ID and then
       telling them it did not count would be the rude way round, and it would
       leave an ID on disk for a check that was never going to pass. */
    if (!pre.paidPlan) return bad('The tick is on the Plus and Pro plans', 402);
    if (!pre.payments) return bad('Set up card payments first — the tick confirms who gets paid', 409);
    if (pre.reviewed) return json({ ok: true, already: true, checks: pre });
    /* THE LEGAL NAME AND THE DATE OF BIRTH, not the MySet name. Most artists trade
       under a stage name, so their page name is usually not the name on the bank
       account — see the reasoning in _verify.mjs. Both are required, because one
       typed claim is a guess and two against a KYC'd record is a check. */
    const { parseDob, tidyName } = await import('./_names.mjs');
    const legalName = tidyName(body.legalName || body.name);
    if (!legalName || legalName.split(/\s+/).length < 2)
      return bad('Give the full name exactly as it appears on the ID', 400);
    const dob = parseDob(body.dob);
    if (!dob) return bad('That date of birth does not look right — use the date picker', 400);

    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    await putImage(aid, ID_SLOT, dec.bytes, dec.type);

    /* Compare the date NOW and keep only the verdict. A date of birth is sensitive,
       it answers exactly one question, and once answered there is no reason for
       MySet to be holding it. `null` means Stripe had nothing to compare against
       yet — a different thing from a mismatch, and it is asked again later. */
    let dobMatch = null;
    try {
      const { accountIdentity } = await import('./_connect.mjs');
      const { dobMatch: same } = await import('./_names.mjs');
      const who = await accountIdentity(aid);
      if (who.ok && who.dob) dobMatch = same(dob, who.dob);
    } catch { dobMatch = null; }

    await mutateIdQueue((q) => {
      q.by[aid] = { state: 'pending', at: Date.now(), legalName, why: '',
                    dobGiven: true, dobMatch };
      return true;
    });
    /* The three moments this can succeed are: the ID arriving, Stripe finishing its
       checks, and the artist asking. All three call the same function, so none of
       them can drift into a different rule. */
    const { tryAutoVerify } = await import('./_verify.mjs');
    const auto = await tryAutoVerify(aid).catch(() => null);
    return json({ ok: true, checks: await artistVerifyChecks(aid),
                  autoVerified: !!(auto && auto.verified),
                  autoWhy: auto && !auto.verified ? auto.why : null });
  }

  if (action === 'mediaRemove') {
    await mutateProfile(aid, (p) => { p.media = p.media.filter((x) => x.mid !== body.mid); return true; });
    return json({ ok: true });
  }

  if (action === 'mediaMove') {
    await mutateProfile(aid, (p) => {
      const i = p.media.findIndex((x) => x.mid === body.mid);
      const j = i + (body.dir === 'up' ? -1 : 1);
      if (i < 0 || j < 0 || j >= p.media.length) return false;
      [p.media[i], p.media[j]] = [p.media[j], p.media[i]];
      return true;
    });
    return json({ ok: true });
  }
  return bad('unknown action', 400);
}

/* THE SHOP AND THE COMMUNITY PAGE — the artist's side.

   Merch is a Plus feature (Perry, 2026-09-04): creating or editing an item, and
   putting a picture on it, is refused with a 402 on free in the same words the
   Studio shows before the tap (0ad). REMOVING is never gated — a cap never
   deletes anything and a lapsed artist must still be able to take an item down
   (0s). The community page itself is free on every plan (0w): moderating it is
   running your page, not pricing it.

   Orders are the ONE place a buyer's details appear, and they are fetched from
   Stripe when the artist opens an order — never stored (0bu's posture). */
async function handleShop(aid, action, body) {
  const merchLocked = ['Merch on your page is a Plus feature — anything you already added stays.', 402];
  const canMerch = async () => merchAllowed(aid, (await planForArtist(aid)).limits);

  if (action === 'merchList') {
    const p = await getProfile(aid);
    return json({ ok: true, merch: p.merch, max: MAX_MERCH, allowed: await canMerch() });
  }
  if (action === 'merchSave') {
    if (!(await canMerch())) return bad(merchLocked[0], merchLocked[1]);
    const incoming = body.item || {};
    const id = MERCH_ID.test(String(incoming.id || '')) ? String(incoming.id)
             : 'm' + Math.random().toString(36).slice(2, 8).padEnd(6, '0').slice(0, 6);   // outside the CAS
    let full = false, bad_ = null;
    await mutateProfile(aid, (p) => {
      p.merch = Array.isArray(p.merch) ? p.merch : [];
      const at = p.merch.findIndex((m) => m.id === id);
      const prev = at >= 0 ? p.merch[at] : null;
      const row = normMerch([{ ...(prev || {}), ...incoming, id, img: (prev && prev.img) || '', at: (prev && prev.at) || Date.now() }])[0];
      if (!row) { bad_ = 'Give it a name'; return false; }
      if (at >= 0) p.merch[at] = row;
      else if (p.merch.length >= MAX_MERCH) { full = true; return false; }
      else p.merch.push(row);
      return true;
    });
    if (bad_) return bad(bad_);
    if (full) return bad(`${MAX_MERCH} items is the most a page holds — edit one of those.`);
    return json({ ok: true, id, merch: (await getProfile(aid)).merch });
  }
  if (action === 'merchRemove') {
    const id = String(body.id || '');
    await mutateProfile(aid, (p) => { p.merch = (p.merch || []).filter((m) => m.id !== id); return true; });
    if (MERCH_ID.test(id)) await dropImage(aid, id);
    return json({ ok: true, merch: (await getProfile(aid)).merch });
  }
  if (action === 'merchPhoto') {
    if (!(await canMerch())) return bad(merchLocked[0], merchLocked[1]);
    const id = String(body.id || '');
    if (!MERCH_ID.test(id)) return bad('unknown item');
    const p0 = await getProfile(aid);
    if (!p0.merch.some((m) => m.id === id)) return bad('unknown item', 404);
    const dec = decodeDataUrl(body.data);
    if (dec.error) return bad(dec.error);
    const url = await putImage(aid, id, dec.bytes, dec.type);      // the slot IS the item id
    await mutateProfile(aid, (p) => { const m = (p.merch || []).find((x) => x.id === id); if (!m) return false; m.img = url; return true; });
    return json({ ok: true, url, merch: (await getProfile(aid)).merch });
  }
  if (action === 'merchPhotoClear') {
    const id = String(body.id || '');
    if (!MERCH_ID.test(id)) return bad('unknown item');
    await dropImage(aid, id);
    await mutateProfile(aid, (p) => { const m = (p.merch || []).find((x) => x.id === id); if (!m) return false; m.img = ''; return true; });
    return json({ ok: true, merch: (await getProfile(aid)).merch });
  }

  // the community page — moderation, free on every plan
  if (action === 'postList') {
    return json({ ok: true, posts: shapeForOwner(await readPosts(aid), aid) });
  }
  if (['postHide', 'postPin', 'postReply', 'postDelete'].includes(action)) {
    /* DELETING FOR GOOD IS A PAID FEATURE; HIDING IS NOT, and never will be. An
       artist on any plan must be able to take something offensive off their page
       the second they see it — hiding does that instantly and can be undone. What
       Plus and Pro buy is erasing it. Refused here as well as greyed in the Studio,
       because a limit only the page enforces is not a limit (15k). */
    if (action === 'postDelete') {
      const { planForArtist, moderateAllowed } = await import('./_plan.mjs');
      const { limits } = await planForArtist(aid);
      if (!moderateAllowed(aid, limits))
        return bad('Deleting a post for good is a Plus feature — you can hide it on any plan, and hiding is instant and undoable.', 402);
    }
    const r = await moderate(aid, { action, id: String(body.id || '').slice(0, 12), text: body.text, on: body.on });
    if (!r.ok) return bad(r.error, 404);
    return json({ ok: true, posts: shapeForOwner(await readPosts(aid), aid) });
  }

  // orders
  if (action === 'orderList') {
    const m = await readMeta(aid);
    return json({ ok: true, orders: (m.orders || []).slice().reverse() });
  }
  if (action === 'orderDone') {
    const sid = String(body.sid || '').slice(0, 120);
    await mutateMeta(aid, (m) => { const o = (m.orders || []).find((x) => x.sid === sid); if (!o) return false; o.status = body.done === false ? 'new' : 'done'; return true; });
    return json({ ok: true, orders: (await readMeta(aid)).orders.slice().reverse() });
  }
  if (action === 'orderDetail') {
    /* Fetched, shown, forgotten. Both shipping shapes are read because which one
       Stripe returns depends on the account's API version. */
    const sid = String(body.sid || '').slice(0, 120);
    const mine = (await readMeta(aid)).orders.find((x) => x.sid === sid);
    if (!mine) return bad('unknown order', 404);
    const { stripeFor } = await import('./_connect.mjs');
    const { stripe, opts } = await stripeFor(aid);
    if (!stripe) return bad('Card payments aren’t switched on', 503);
    let s;
    try { s = await stripe.checkout.sessions.retrieve(sid, opts); } catch { return bad('Couldn’t reach Stripe just now', 502); }
    const cd = s.customer_details || {};
    const sh = (s.collected_information && s.collected_information.shipping_details) || s.shipping_details || null;
    const addr = sh && sh.address ? sh.address : null;
    return json({ ok: true, order: mine, buyer: { name: cd.name || (sh && sh.name) || '', email: cd.email || '' },
                  shipping: addr ? { name: (sh && sh.name) || '', line1: addr.line1 || '', line2: addr.line2 || '',
                                     city: addr.city || '', state: addr.state || '', postal: addr.postal_code || '', country: addr.country || '' } : null });
  }
  return bad('unknown action', 400);
}

/* ---------- the books ------------------------------------------------------ */
/* Read-only, every figure straight out of Stripe's balance transactions. See the
   header of _ledger.mjs for why this is a reporting layer and not a second ledger. */
async function handleBooks(req, aid, body, action, isFounder) {
  const { statement, books, toCsv, setCost, COST_KINDS } = await import('./_ledger.mjs');
  const { stripeFor } = await import('./_connect.mjs');

  if (action === 'ledger' || action === 'ledgerCsv') {
    const { stripe, opts, acct } = await stripeFor(aid);
    if (!stripe) return json({ ok: true, enabled: false, months: [], total: null });
    /* NEVER FURTHER BACK THAN THE DAY THEY JOINED. Twelve rows of zero before an
       account existed is not a statement, it is a page that looks like a bad year. */
    const since = Number(((await readArtists()).byId[aid] || {}).createdAt) || 0;
    const want = { months: Math.min(60, Math.max(1, Number(body.months) || 12)),
                   force: !!body.force, since };
    /* THE FOUNDER'S OWN GIG MONEY SHARES A STRIPE ACCOUNT WITH MYSET'S.
       Perry's vote packs and tips were taken on the PLATFORM account, before Connect
       existed, so the same balance holds his takings AND every artist's subscription.
       It IS separable — a payment MySet sold on his behalf carries `kind` and
       `artist`, the same test revenue.mjs uses — so platformSplit does the split and
       this returns his half. See _ledger.mjs. */
    const { platformSplit } = await import('./_ledger.mjs');
    const st = (isFounder && !acct)
      ? (await platformSplit(aid, stripe, want)).mine
      : await statement(aid, stripe, opts, want);
    if (action === 'ledgerCsv') {
      const { getProfile } = await import('./_profile.mjs');
      const who = (await getProfile(aid)).name || aid;
      return new Response(toCsv(st, { who }), { status: 200, headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="myset-earnings-${aid}.csv"`,
        'cache-control': 'no-store' } });
    }
    return json({ ok: true, enabled: true, ...st });
  }

  if (!isFounder) return bad('That’s not something this account can do', 403);

  if (action === 'books') {
    /* MySet's OWN money, so never `stripeFor(aid)` — that would scope the call to
       the founder's connected account if he ever had one and quietly report an
       artist's takings as the company's revenue. The platform account is the one
       with no `stripeAccount` in scope, always. */
    const { stripeClient } = await import('./_connect.mjs');
    const stripe = stripeClient();
    if (!stripe) return json({ ok: true, enabled: false, months: [], total: null });
    /* NOT clamped by the founder's registry row. The company's revenue is older
       than any artist record — clamping the P&L to when `perry-idyll` happened to be
       written into the registry would quietly cut months off MySet's own books. */
    const b = await books(stripe, {},
      { months: Math.min(60, Math.max(1, Number(body.months) || 12)), force: !!body.force });
    if (body.csv) {
      return new Response(toCsv(b, { who: 'MySet', kind: 'books' }), { status: 200, headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="myset-books.csv"',
        'cache-control': 'no-store' } });
    }
    return json({ ok: true, enabled: true, kinds: COST_KINDS, ...b });
  }

  if (action === 'bookCost') {
    const r = await setCost(body.month, body.kind, body.cents, body.note);
    return r.ok ? json({ ok: true }) : bad(r.error, 400);
  }
  return bad('unknown action', 400);
}
const BOOK_ACTIONS = new Set(['ledger', 'ledgerCsv', 'books', 'bookCost']);

/* ---------- PROMOTING A GIG ------------------------------------------------
   Three paid spots at the top of a city's night, $10, first come first served.
   The whole design and the reason it is a hold rather than a charge-then-claim is
   in the header of _featured.mjs. This file is the door: it decides which gigs are
   offerable, takes the hold, opens the checkout, and settles the return trip. */
const FEATURE_ACTIONS = new Set(['featureList', 'featureStart', 'featureFinish']);

async function handleFeature(req, aid, body, action) {
  const { flagValue, readFlags } = await import('./_flags.mjs');
  /* THE SAME VALUE THE CITY FEED READS — globally, with no per-artist override.
     A spot is only worth $10 because a city renders it, and events.mjs reads the
     global flag; if this read a personal override the two could disagree and an
     artist could be sold a spot nobody would ever see. */
  const on = flagValue(await readFlags(), 'featuredShows', '');
  const F = await import('./_featured.mjs');
  const { readEvents, occurrencesFor } = await import('./_events.mjs');
  const { localDate, addDays, utcToDate } = await import('./_time.mjs');

  /* OFF MEANS OFF, INCLUDING THE MONEY. With the flag down nothing may be bought —
     but what has already been bought is still listed, because switching a flag must
     never look like a refund somebody did not get. */
  const events = await readEvents(aid);
  const tz = ((events.list || []).find((e) => e.tz) || {}).tz || 'UTC';
  const today = localDate(Date.now(), tz);
  const mine = await F.upcomingMine(aid, today);

  if (action === 'featureList') {
    if (!on) return json({ ok: true, enabled: false, price: F.FEAT_PRICE, slots: F.SLOTS, gigs: [], mine });
    /* Only nights that have not happened, that have a city, and that this artist
       has not already promoted. A gig with no city cannot be featured anywhere. */
    const occ = occurrencesFor(events, utcToDate(Date.now()), addDays(today, 60))
      .filter((o) => o.endsAt > Date.now() && o.city && o.country)
      .slice(0, 40);
    const bought = new Set(mine.map((m) => `${m.eventId}@${m.date}`));
    const byKey = new Map();
    for (const o of occ) {
      const key = F.cityKey(o.country, o.city);
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(o);
    }
    const left = {};
    for (const [key, list] of byKey) {
      const free = await F.freeSlots(key, [...new Set(list.map((o) => o.date))], today, Date.now(), aid);
      for (const [d, n] of Object.entries(free)) left[`${key}|${d}`] = n;
    }
    return json({ ok: true, enabled: true, price: F.FEAT_PRICE, slots: F.SLOTS, mine,
      gigs: occ.map((o) => {
        const key = F.cityKey(o.country, o.city);
        return { eventId: o.eventId, date: o.date, time: o.time, venue: o.venue,
                 city: o.city, country: o.country,
                 left: left[`${key}|${o.date}`] ?? F.SLOTS,
                 already: bought.has(`${o.eventId}@${o.date}`) };
      }) });
  }

  if (action === 'featureStart') {
    if (!on) return bad('Promoting a gig isn’t switched on right now', 503);
    const key0 = process.env.STRIPE_SECRET_KEY;
    if (!key0) return bad('Card payments aren’t switched on', 503);
    const eventId = String(body.eventId || '').slice(0, 40);
    const date = String(body.date || '').slice(0, 10);
    if (!eventId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad('Pick a gig');
    if (date < today) return bad('That night has already been');

    const occ = occurrencesFor(events, utcToDate(Date.now()), addDays(today, 60))
      .find((o) => o.eventId === eventId && o.date === date && o.endsAt > Date.now());
    if (!occ) return bad('That gig isn’t on your calendar any more', 404);
    if (!occ.city || !occ.country) return bad('Add a city to that gig first — a featured spot lives in a city’s list');

    const key = F.cityKey(occ.country, occ.city);
    /* The session id is not known until Stripe answers, so the hold is keyed by an
       id WE mint and hand to Stripe as the idempotency key — a double tap finds its
       own hold and its own session instead of taking a second spot. */
    const sid = `pf_${sha(`${aid}|${eventId}|${date}|${Math.floor(Date.now() / 60000)}`).slice(0, 24)}`;
    const claim = await F.claimSlot(key, date, { aid, eventId, sid, today });
    if (!claim.ok) {
      if (claim.mine) return bad('You’ve already got a spot that night');
      return bad(`All ${F.SLOTS} featured spots for that night are taken — first come, first served.`, 409);
    }

    const origin = new URL(req.url).origin;
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(key0);
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: F.FEAT_PRICE,
          product_data: { name: `Featured show — ${occ.venue || 'your gig'}, ${occ.city}`,
                          description: `Top of the ${occ.city} listing on ${date}. One of ${F.SLOTS} spots.` } } }],
        /* `hold` is the id the slot was claimed under, carried through Stripe and
           back. Settling by it means the hold never has to be re-keyed once the
           session exists — see the note in settleFeature. */
        metadata: { kind: 'feature', artist: aid, eventId, date, key, hold: sid,
                    city: String(occ.city).slice(0, 60), country: String(occ.country).slice(0, 60),
                    venue: String(occ.venue || '').slice(0, 80) },
        payment_intent_data: { metadata: { kind: 'feature', artist: aid } },
        success_url: `${origin}/studio?promoted={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/studio?promocancel=1`,
      }, { idempotencyKey: `myset-feature-${sid}` });
      return json({ ok: true, url: session.url, id: session.id, hold: sid });
    } catch (e) {
      await F.releaseSlot(key, date, sid);
      return bad(e.message || 'Couldn’t open checkout', 502);
    }
  }

  if (action === 'featureFinish') {
    const key0 = process.env.STRIPE_SECRET_KEY;
    if (!key0) return bad('Card payments aren’t switched on', 503);
    const sessionId = String(body.session || '').slice(0, 120);
    if (!sessionId) return bad('which payment?');
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(key0);
    let session;
    try { session = await stripe.checkout.sessions.retrieve(sessionId); }
    catch { return bad('Couldn’t reach Stripe just now', 502); }
    /* WHOSE PAYMENT THIS IS was decided when the session was made. Without this a
       signed-in artist could settle somebody else's session into their own name. */
    if ((session.metadata || {}).artist !== aid) return bad('That payment isn’t yours', 403);
    const r = await F.settleFeature(stripe, session, { today });
    if (!r.ok && r.duplicate)
      return bad(r.refunded
        ? 'You had already promoted that night, so this second payment has been refunded in full.'
        : 'You had already promoted that night. This second payment is being returned — tell Perry if it does not arrive.', 409);
    if (!r.ok && r.full)
      return bad(r.refunded
        ? 'That night filled up before the payment landed, so it has been refunded in full.'
        : 'That night filled up before the payment landed. Your money is being returned — tell Perry if it does not arrive.', 409);
    if (!r.ok) return bad(r.error || 'Couldn’t finish that', 400);
    return json({ ok: true, mine: await F.upcomingMine(aid, today) });
  }
  return bad('unknown action', 400);
}

const SHOP_ACTIONS = new Set(['merchList', 'merchSave', 'merchRemove', 'merchPhoto', 'merchPhotoClear',
                              'postList', 'postHide', 'postPin', 'postReply', 'postDelete',
                              'orderList', 'orderDone', 'orderDetail']);

const PROFILE_ACTIONS = new Set(['profileSet', 'mediaAdd', 'mediaRemove', 'mediaMove',
                                 'photoUpload', 'photoClear',
                                 // the artist's own verification tick
                                 'verifyStatus', 'idUpload',
                                 // Stripe Connect onboarding and status
                                 'payStatus', 'payStart', 'payDashboard']);

export default async (req) => {
  const me = await requireArtist(req);
  if (!me) return bad('unauthorized', 401);
  const aid = me.aid;
  if (req.method !== 'POST') return bad('POST only', 405);
  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const action = body.action;

  /* AN ACCOUNT ON ITS WAY OUT IS READ-ONLY, NOT LOCKED OUT. The owner has to be
     able to get in — to change their mind, and to take their data with them — but
     nothing else should still be running. Everything not on this list answers with
     the same sentence, which also tells them the way back. */
  /* `ledger` and `ledgerCsv` are here on purpose: somebody on their way out has
     thirty days to take their records with them, and a tax statement is exactly
     the kind of thing they come back for. Reading cannot hurt anything. */
  const LEAVING_OK = new Set(['planGet', 'accountUndelete', 'accountExport', 'accountFreeSlug',
                              'planPortal', 'ledger', 'ledgerCsv']);
  if (!LEAVING_OK.has(action)) {
    const { deletionOf } = await import('./_lib.mjs');
    const del = await deletionOf(aid);
    if (del) return bad('Your account is being deleted. Undo that in Settings and everything comes straight back.', 423);
  }

  /* MONEY AND THE ACCOUNT ARE THE OWNER'S. A Pro page carries five sign-in seats,
     so "signed in" is a long way from "allowed to see the card". ACCOUNTS.md §4 has
     claimed this since the day it was written and only accountDelete ever did it —
     which meant a band mate could open the owner's Stripe portal (card, invoices,
     Cancel), burn the once-ever retention offer, downgrade the plan, or create the
     payout account with the WRONG COUNTRY, which Stripe will not let anyone change
     afterwards (INVARIANT 7c). Listed in one place, because the single action that
     did check was checked inside its own handler, where the next one added would
     never have seen it.
     `planGet` is deliberately NOT here: a member needs the plan's limits or every
     locked control renders live on first paint (INVARIANT 0bx2). The sensitive half
     of that payload is stripped inside handlePlan instead. */
  const OWNER_ONLY = new Set(['planCheckout', 'planFinish', 'planChange', 'planRetain',
    'planRetainOffered', 'planPortal', 'planSync', 'planInvoices', 'promoRedeem',
    'accountExport', 'accountDelete', 'accountUndelete', 'accountFreeSlug',
    'payStart', 'payDashboard', 'idUpload', 'shareStats', 'setCode',
    /* THE BOOKS ARE THE OWNER'S. A statement is every figure about somebody's
       livelihood in one payload; a band mate on one of five Pro seats has no
       business with it, and `books`/`bookCost` are MySet's own P&L. */
    'ledger', 'ledgerCsv', 'books', 'bookCost',
    /* Promoting a gig spends $10 of the owner's money, so it is the owner's to
       spend. `featureList` is NOT here — a band mate may look at what is booked. */
    'featureStart', 'featureFinish']);
  if (OWNER_ONLY.has(action) && (me.role || 'owner') !== 'owner')
    return bad('Only the account owner can do that', 403);

  /* WHO MAY DO WHAT ELSE. `byEmail[email].role` has always been stored and, outside a
     handful of hand-written checks, never read — so a member could do anything an
     owner could. One table now, in _session.mjs, and one gate here. */
  {
    const { can } = await import('./_session.mjs');
    const need = CAPABILITY[action];
    if (need && !can(me.role || 'owner', need))
      return bad('That’s not something this sign-in can do', 403);
  }

  /* Read a PUBLIC Spotify playlist's tracks, returning them for the artist to
     confirm — it writes nothing, so it must never sit inside a CAS callback.
     Needs SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (client-credentials flow,
     no user login); without them it says so instead of pretending. */
  if (action === 'spotifyPeek') {
    const cid = process.env.SPOTIFY_CLIENT_ID, sec = process.env.SPOTIFY_CLIENT_SECRET;
    if (!cid || !sec) return bad('Spotify import isn’t switched on yet — paste your songs as text instead', 503);
    const m = String(body.url || '').match(/playlist[/:]([A-Za-z0-9]{10,34})/);
    if (!m) return bad('That doesn’t look like a Spotify playlist link', 400);
    try {
      const tok = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded',
                   authorization: 'Basic ' + Buffer.from(`${cid}:${sec}`).toString('base64') },
        body: 'grant_type=client_credentials',
      }).then((r) => r.json());
      if (!tok.access_token) return bad('Spotify wouldn’t let us in — check the keys', 502);
      const tracks = [];
      let url = `https://api.spotify.com/v1/playlists/${m[1]}/tracks?limit=100&fields=items(track(name,artists(name))),next`;
      for (let page = 0; page < 3 && url; page++) {          // 300 tracks is plenty
        const r = await fetch(url, { headers: { authorization: `Bearer ${tok.access_token}` } });
        if (r.status === 404) return bad('Spotify can’t see that playlist — is it public?', 404);
        const d = await r.json();
        for (const it of d.items || []) {
          const t = it && it.track;
          if (t && t.name) tracks.push({ title: t.name, artist: ((t.artists || [])[0] || {}).name || '' });
        }
        url = d.next;
      }
      return json({ ok: true, tracks });
    } catch { return bad('Couldn’t reach Spotify — try again in a minute', 502); }
  }

  /* Push subscriptions. Read/write one small document, never the show, so they
     short-circuit before the show mutation like the other side-documents do. */
  if (action === 'pushKey') {
    return json({ ok: true, key: process.env.VAPID_PUBLIC_KEY || null,
                  devices: (await readSubs(aid)).subs.length });
  }
  if (action === 'pushOn') {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
      return bad('Alerts aren’t switched on for MySet yet', 503);
    const saved = await saveSub(aid, body.sub);
    if (!saved) return bad('That subscription looks wrong', 400);
    await notify(aid, { title: 'Alerts are on', body: 'You’ll hear from MySet when it matters.', tag: 'setup' });
    return json({ ok: true, devices: (await readSubs(aid)).subs.length });
  }
  if (action === 'pushOff') {
    await dropSub(aid, String((body.sub && body.sub.endpoint) || body.endpoint || ''));
    return json({ ok: true, devices: (await readSubs(aid)).subs.length });
  }

  if (PROFILE_ACTIONS.has(action)) return handleProfile(aid, action, body, req, me);
  if (BOOK_ACTIONS.has(action)) return handleBooks(req, aid, body, action, aid === DEFAULT_ARTIST);
  if (FEATURE_ACTIONS.has(action)) return handleFeature(req, aid, body, action);
  if (SHOP_ACTIONS.has(action)) return handleShop(aid, action, body);
  if (LYRICS_ACTIONS.has(action)) return handleLyrics(aid, action, body, await getShow(aid));
  if (LIST_ACTIONS.has(action)) return handleLists(aid, action, body);
  if (SONG_ACTIONS.has(action)) return handleSong(aid, action, body, await getShow(aid));
  if (VENUE_SIDE.has(action)) return handleVenueSide(aid, action, body);
  if (ASK_ACTIONS.has(action)) return handleAsks(aid, action, body);
  if (EVENT_ACTIONS.has(action)) return handleEvents(aid, action, body);
  if (PLAN_ACTIONS.has(action)) return handlePlan(aid, action, body, req, me);

  /* STARTING AND ENDING A NIGHT live in _lifecycle.mjs, because the calendar can
     now do both without a request behind it (_auto.mjs). One implementation: a tap
     and the schedule take the identical path — cap, archive, setlist, paid-vote
     carry. Only `status: 'pre'` still falls through to the switch below. */
  if (action === 'newShow' || (action === 'status' && (body.status === 'live' || body.status === 'ended'))) {
    const r = (action === 'status' && body.status === 'ended')
      ? await endShow(aid, { by: 'artist' })
      : await startShow(aid, { fresh: action === 'newShow', by: 'artist' });
    if (r.err) return bad(r.err[0], r.err[1]);
    let stage = null;
    try { stage = await stagePayload(aid); } catch { /* the write still succeeded */ }
    return json({ ok: true, stage, note: r.note || null, songId: null });
  }

  let err = null, playedNow = null, clearBoard = false, note = null;

  // Anything that starts a song needs the tally BEFORE it is wiped.
  let counts = null, firstAt = null, votersNow = 0;
  if (action === 'play' || action === 'playTop') {
    const f = await readFans(aid);
    counts = voteCounts(f); firstAt = firstVotedAt(f);
    votersNow = Object.values(f).filter((x) => (x.v || []).length).length;
  }

  /* Two different ceilings, and the distinction matters: you can KEEP up to
     MAX_LIBRARY songs on any plan; the plan only limits how many are live to the
     audience at once. Going over just means the extras arrive switched off. */
  let featureCap = null;
  if (['addSong', 'starterSetlist', 'toggleSong', 'importSongs'].includes(action)) {
    const f = (await planForArtist(aid)).limits.featured;
    featureCap = f === Infinity ? null : f;
  }

  /* Setting your own prices is a paid feature: the free-vote count, the pack
     prices, and what a replay / song request / birthday costs. The DEFAULTS are
     free — a free artist runs on them, and everything the ROOM experiences works
     identically (INVARIANT 0w is untouched; this gates the artist's back office).
     The founding artist predates the registry, so planForArtist returns free for
     him — the owner bypass is load-bearing, not a courtesy. */
  let canPrice = true;
  if (['freeCredits', 'packs', 'replayCost', 'askSet'].includes(action)) {
    canPrice = isPlatformOwner(aid) || (await planForArtist(aid)).limits.pricing === true;
  }
  const PRICE_LOCKED = ['Setting your own prices is a Plus feature — the defaults stay on for now.', 402];

  let newSongId = null;                       // so the sheet can keep editing it
  /* Read before the mutation, for every action that will settle the paid-vote
     ledger afterwards. `play` moves played[] before clearAllFanVotes runs, so the
     post-mutation show prices a just-won replay at 1 instead of replayCost. */
  /* Long enough to cover a slow round trip and a human re-tap, far shorter than any
     real gap between two songs.

     Read per request, and overridable, for one reason: the test suite starts songs
     milliseconds apart, so a hard-coded window makes the whole play/playTop surface
     untestable. Production never sets this — it is a tunable safety window, not a way
     round the check, and there IS a test that sets it back up to prove the guard
     fires. */
  const DOUBLE_TAP_MS = Number(process.env.MYSET_DOUBLE_TAP_MS ?? 8000);
  let droppedSong = null;
  /* `prevShow` used to exist so the round reset could price the round it was
     wiping. There is no round reset any more (a night is one round) and a vote is
     charged at the moment it is cast, so nothing needs the old prices — but `play`
     still wants the pre-mutation show for `logPlay`, and the release note below
     compares the playable set before and after. */
  const NEEDS_BEFORE = new Set(['play', 'playTop', 'freeCredits', 'replayCost']);
  const prevShow = NEEDS_BEFORE.has(action) ? await getShow(aid) : null;

  let libChanged = false;
  await mutateShow(aid, (show) => {
    // which songs exist, before anything in the switch runs — see the compare at
    // the bottom of this callback
    const idsBefore = (show.songs || []).map((x) => x.id).join('\u0000');
    /* Records what a song won with, at the moment it is started. Without this the
       number is gone a millisecond later and no history is recoverable. */
    const logPlay = (id) => {
      const sg = show.songs.find((x) => x.id === id) || {};
      const c = counts || {};
      const byId = Object.fromEntries(show.songs.map((x) => [x.id, x]));
      // The WHOLE round, not just the winner — votes for the songs that lost are
      // wiped a millisecond later too, and they are the honest answer to
      // "what did the room actually want tonight".
      const round = Object.keys(c)
        .filter((k) => c[k] > 0)
        .map((k) => ({ songId: k, title: (byId[k] || {}).title || k,
                       artist: (byId[k] || {}).artist || '', votes: c[k] }))
        .sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title))
        .slice(0, 8);
      show.log.push({
        songId: id, title: sg.title || id, artist: sg.artist || '',
        votes: c[id] || 0, voters: votersNow,
        /* THE VOTES THIS SONG COLLECTED, not the whole board's.

           It was the whole board's, and that was right while starting a song wiped
           every vote in the room: each round's votes were a separate set, so summing
           them counted every vote exactly once — which is what `_history.mjs` does to
           get a night's total. Votes stopped being wiped on 2026-09-07. A vote cast
           for a song that has not come up yet is still standing when the NEXT song
           starts, so the old sum counted it again at every play, and a quiet night
           would have reported thousands of votes.

           One vote, counted once: here when its song plays, or in `leftover` at the
           end if it never does. */
        roundVotes: c[id] || 0,
        round,
        replay: show.played.includes(id), at: Date.now(),
      });
      if (show.log.length > 200) show.log = show.log.slice(-200);
    };

    switch (action) {
      /* A DOUBLE START IS ALWAYS A MISTAKE. No musician starts two songs eight
         seconds apart, but a lost response on bar wifi made it easy: the write
         landed, the Studio showed "try again", the artist tapped again, and a second
         song burned along with the round's votes. So the guard is on the physical
         reality rather than on request ids, which cannot survive a human retry.
         `play` names a song, so re-sending the SAME one is simply already done. */
      case 'play': {
        const id = body.song;
        if (!id) { err = ['no song', 400]; return false; }
        if (show.nowPlaying === id && Date.now() - (show.nowPlayingAt || 0) < DOUBLE_TAP_MS)
          return false;                                  // already playing it — no-op
        logPlay(id);                                          // before played[] moves
        if (show.nowPlaying && show.nowPlaying !== id && !show.played.includes(show.nowPlaying))
          show.played.push(show.nowPlaying);
        show.played = show.played.filter((p) => p !== id);   // replaying? take it back out
        show.nowPlaying = id || null;
        show.nowPlayingAt = Date.now();
        show.windowOpen = true; playedNow = id;
        break;
      }
      case 'playTop': {
        /* playTop names no song, so a retry would pick the NEXT one down and start
           that instead — the worst possible outcome. Refuse outright and say so. */
        if (Date.now() - (show.nowPlayingAt || 0) < DOUBLE_TAP_MS) {
          err = ['That one just started — give it a moment', 409]; return false;
        }
        /* Exactly what the room can vote for (votable(), the one definition), then
           playTop's own narrowing: an already-played song only re-enters the pool
           if it is holding replay votes. Using playable() alone was wrong — it drops
           every played song, so the room's top-voted "play it again" could not win. */
        const canVote = votable(show);
        const pool = rankSongs(
          show.songs
            .filter(canVote)
            .filter((s) => s.id !== show.nowPlaying)
            .filter((s) => !show.played.includes(s.id) || (counts[s.id] || 0) > 0),
          counts, firstAt);
        if (!pool.length) { err = ['nothing left in the pool', 409]; return false; }
        logPlay(pool[0].id);                                  // before played[] moves
        if (show.nowPlaying && !show.played.includes(show.nowPlaying)) show.played.push(show.nowPlaying);
        show.played = show.played.filter((p) => p !== pool[0].id);
        show.nowPlaying = pool[0].id;
        show.nowPlayingAt = Date.now();
        show.windowOpen = true; playedNow = pool[0].id;
        break;
      }
      case 'window': show.windowOpen = !!body.open; break;
      /* LAST CALL. The artist taps it when they are about to start the next song,
         and every phone in the room gets a ten-second box at the top of the page.

         It is a NUDGE, not a lock: voting stays open, because there is already a
         switch for closing it and a countdown that silently did two things would be
         the harder one to explain on stage. What it changes is the room's attention.

         Stored as an END TIME so it survives a poll landing anywhere inside the ten
         seconds; the payload sends the milliseconds LEFT rather than the timestamp,
         because a phone's clock is not the server's and a fan four minutes fast would
         otherwise see nothing at all. */
      case 'countdown': {
        if (show.status !== 'live') { err = ['Start the show first', 409]; return false; }
        show.countdownAt = Date.now() + COUNTDOWN_MS;
        break;
      }
      // Settings → "Start shows from my calendar". Off means the schedule never
      // starts one; ending by itself still applies to a show that is live.
      case 'autoStart': show.autoStart = body.on !== false; break;
      /* 'live' and 'ended' never reach here — see the delegation to _lifecycle.mjs
         above, and its header for why a resume deliberately does not reset. */
      case 'status': {
        if (body.status === 'pre') show.status = 'pre';
        break;
      }
      case 'venue': show.venue = String(body.venue || '').slice(0, 80); break;
      case 'city': show.city = String(body.city || '').slice(0, 80); break;
      case 'showTime': show.showTime = String(body.showTime || '').slice(0, 40); break;
      /* Changing the price starts a fresh contest. Votes already cast were priced
         against the OLD numbers, and leaving them in place re-prices them
         retroactively: a fan who spent 3 of 3 free credits would suddenly be 2 over
         a new ceiling of 1, and the paid-vote ledger (13b) would then debit their
         pack for credits they never took from it. The reset settles the old round at
         the old prices first — prevShow is the pre-mutation snapshot. */
      case 'freeCredits': {
        if (!canPrice) { err = PRICE_LOCKED; return false; }
        const n = parseInt(body.n, 10);
        const want = Math.max(0, Math.min(999, Number.isFinite(n) ? n : DEFAULT_FREE_CREDITS));
        show.freeCredits = want;
        show.unlimited = false;               // picking a number turns unlimited off
        break;
      }
      case 'unlimited': show.unlimited = !!body.on; break;
      case 'unlimitedFan': {
        const id = String(body.fan || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
        if (!id) { err = ['no device id', 400]; return false; }
        const at = show.unlimitedFans.indexOf(id);
        if (body.on && at < 0) show.unlimitedFans.push(id);
        if (!body.on && at >= 0) show.unlimitedFans.splice(at, 1);
        break;
      }
      case 'toggleSong': {
        const sg = show.songs.find((x) => x.id === body.song);
        if (!sg) break;
        const turningOn = sg.active === false;
        if (turningOn && featureCap !== null) {
          const liveNow = show.songs.filter((x) => x.active !== false).length;
          if (liveNow >= featureCap) {
            err = [`Your plan features ${featureCap} songs at a time. Switch one off first, or upgrade.`, 402];
            return false;
          }
        }
        sg.active = turningOn;
        break;
      }
      case 'addSong': {
        const title = String(body.title || '').trim().slice(0, 80);
        if (!title) { err = ['no title', 400]; return false; }
        // over the featured limit? it still gets added, just switched off
        const liveNow = show.songs.filter((x) => x.active !== false).length;
        const startsOff = featureCap !== null && liveNow >= featureCap;
        if (show.songs.length >= MAX_LIBRARY) {
          err = [`That's ${MAX_LIBRARY} songs — more than any setlist needs.`, 402]; return false;
        }
        const artist = String(body.artist || '').trim().slice(0, 60);
        let id = songId(title, artist);
        if (show.songs.some((s) => s.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
        const known = new Set([...GENRE_IDS, ...show.tags.map((t) => t.id)]);
        show.songs.push({ id, title, artist, active: !startsOff,
          key: cleanKey(body.key),
          tags: [...new Set((Array.isArray(body.tags) ? body.tags : []).filter((t) => known.has(t)))]
            .slice(0, MAX_SONG_TAGS) });
        newSongId = id;
        if (startsOff) note = `Added, but switched off — your plan features ${featureCap} at a time.`;
        break;
      }
      /* Bulk add — CSV upload, pasted text, or a Spotify playlist the client
         already peeked. Same rules as addSong, applied per row: duplicates by
         normalised title+artist are skipped rather than suffixed (a re-import
         must be a no-op), the library cap refuses the remainder loudly, and rows
         over the featured cap arrive switched off exactly like a single add. */
      case 'importSongs': {
        const rows = (Array.isArray(body.songs) ? body.songs : []).slice(0, 300)
          .map((r) => ({ title: String((r && r.title) || '').trim().slice(0, 80),
                         artist: String((r && r.artist) || '').trim().slice(0, 60) }))
          .filter((r) => r.title);
        if (!rows.length) { err = ['Nothing to import', 400]; return false; }
        const have = new Set(show.songs.map((s) => songSig(s.title, s.artist)));
        let added = 0, dupes = 0, refused = 0, off = 0;
        for (const r of rows) {
          const sig = songSig(r.title, r.artist);
          if (have.has(sig)) { dupes++; continue; }
          if (show.songs.length >= MAX_LIBRARY) { refused++; continue; }
          const liveNow = show.songs.filter((x) => x.active !== false).length;
          const startsOff = featureCap !== null && liveNow >= featureCap;
          let id = songId(r.title, r.artist);
          if (show.songs.some((s) => s.id === id)) id += '-' + Math.random().toString(36).slice(2, 5);
          show.songs.push({ id, title: r.title, artist: r.artist, active: !startsOff, key: '', tags: [] });
          have.add(sig); added++; if (startsOff) off++;
        }
        if (!added && dupes) { err = ['All of those are already in your songs', 409]; return false; }
        note = `Added ${added} song${added === 1 ? '' : 's'}`
          + (dupes ? ` · skipped ${dupes} you already had` : '')
          + (off ? ` · ${off} arrived switched off (your plan features ${featureCap} at a time)` : '')
          + (refused ? ` · ${refused} refused — that’s the ${MAX_LIBRARY}-song ceiling` : '');
        break;
      }
      case 'editSong': {
        const sg = show.songs.find((x) => x.id === body.song);
        if (!sg) { err = ['unknown song', 404]; return false; }
        if (typeof body.title === 'string' && body.title.trim()) sg.title = body.title.trim().slice(0, 80);
        if (typeof body.artist === 'string') sg.artist = body.artist.trim().slice(0, 60);
        if (typeof body.key === 'string') sg.key = cleanKey(body.key);
        if (Array.isArray(body.tags)) {
          const known = new Set([...GENRE_IDS, ...show.tags.map((t) => t.id)]);
          sg.tags = [...new Set(body.tags.filter((t) => known.has(t)))].slice(0, MAX_SONG_TAGS);
        }
        break;
      }
      case 'packs': {
        if (!canPrice) { err = PRICE_LOCKED; return false; }
        show.packs = normPacks({ small: body.small, big: body.big });
        break;
      }
      case 'askSet': {
        const which = body.kind === 'birthday' ? 'birthdays' : 'requests';
        const cur = show[which];
        /* Switching requests ON or OFF is free — that is running your show. What a
           request COSTS is pricing, so changing it needs the plan. */
        const wantCost = body.cost === undefined ? cur.cost : body.cost;
        if (!canPrice && normAsk({ on: cur.on, cost: wantCost }).cost !== cur.cost) {
          err = PRICE_LOCKED; return false;
        }
        show[which] = normAsk({
          on: body.on === undefined ? cur.on : !!body.on,
          cost: wantCost,
        });
        break;
      }
      case 'replayCost': {
        if (!canPrice) { err = PRICE_LOCKED; return false; }
        const want = Math.max(1, Math.min(20, parseInt(body.n, 10) || 5));
        show.replayCost = want;
        break;
      }
      case 'removeSong':
        show.songs = show.songs.filter((s) => s.id !== body.song);
        droppedSong = String(body.song || '');   // refund the votes held on it, below
        break;
      case 'unplay': show.played = show.played.filter((id) => id !== body.song); break;
      case 'setCode': {
        const code = String(body.code || '');
        /* Eight, not four. This code is now a real door for every artist (see
           requireArtist), so it gets a real minimum and a deny-list — and the
           artist's own page name is refused, because that is the half of the
           credential anyone can already read. */
        if (weakCode(code, show.slug)) {
          err = [`Pick at least ${MIN_CODE} characters, and not your page name`, 400];
          return false;
        }
        show.codeHash = sha(code);          // stored hashed, never in plaintext
        break;
      }
      /* "Clear the votes" in the Studio. It wipes the BOARD — every fan's votes on
         every song — and it is now the only thing that does. It does NOT give the
         credits back: a vote is spent when it is cast, whatever happens to it
         afterwards, and the artist reaching for this button does not change that.
         The Studio says so on the button. */
      case 'resetVotes': clearBoard = true; break;
      case 'starterSetlist': {          // append the generic covers, never replace
        const have = new Set(show.songs.map((x) => x.id));
        let live = show.songs.filter((x) => x.active !== false).length;
        for (const [t, a] of STARTER_SONGS) {
          if (show.songs.length >= MAX_LIBRARY) break;
          const id = songId(t, a);
          if (have.has(id)) continue;
          const on = featureCap === null || live < featureCap;
          show.songs.push({ id, title: t, artist: a, active: on });
          if (on) live++;
        }
        break;
      }
      case 'clearSetlist': show.songs = []; break;
      default: err = ['unknown action', 400]; return false;
    }
    /* MEASURED, not listed. The previous version kept an allow-list of actions that
       touch the library, with a comment asking the next person to remember to add
       to it — and two new handlers were added in the very same change that didn't.
       Comparing the ids is a fact; an allow-list is a promise. Recomputed on every
       CAS retry, so a conflict can't leave it stale. */
    libChanged = (show.songs || []).map((x) => x.id).join('\u0000') !== idsBefore;
    return true;
  });

  if (err) return bad(err[0], err[1]);
  // the library changed => what's in the active setlist may have changed with it
  if (libChanged) note = join(note, await syncActive(aid));

  /* The song that just started has collected its votes, so they come off the board.
     Nothing is refunded — see the ledger header in _lib.mjs. */
  if (playedNow) await consumePlayedVotes(aid, playedNow);
  else if (clearBoard) await wipeBoard(aid);
  // a deleted song's votes must not go on being counted for a song nobody can see
  else if (droppedSong) await dropSongVotes(aid, droppedSong);

  // Hand the fresh state back with the write. Without this the Studio does a
  // second round trip for every tap, which is most of why buttons felt slow.
  let stage = null;
  try { stage = await stagePayload(aid); } catch { /* the write still succeeded */ }
  return json({ ok: true, stage, note, songId: newSongId });
};
