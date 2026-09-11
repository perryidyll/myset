import { guard } from './_errlog.mjs';
import Stripe from 'stripe';
import { json, bad, cleanFanId, getShow, publicArtist, sha,
         readFans, creditsUsed, isUnlimited } from './_lib.mjs';
import { canTakeMoney } from './_pay.mjs';
import { readConnect, connectUsable, feeCents, scope } from './_connect.mjs';
import { planForArtist, merchAllowed } from './_plan.mjs';
import { getProfile } from './_profile.mjs';
import { PAYOUT_COUNTRIES } from './_connect.mjs';

/* Where a shipped item can go. Stripe needs an explicit list; this is the payout
   list plus the countries a touring musician's fans actually write from. Widen it
   when somebody needs one — a missing country is a refused checkout, never a
   wrong one. */
const SHIP_COUNTRIES = [...new Set([...PAYOUT_COUNTRIES, 'AT','BE','CH','CZ','GR','HU','PL','RO','SK','SI',
  'HR','BG','LT','LV','EE','LU','IS','IL','AE','SA','ZA','KR','TW','HK','PH','ID','VN','IN','AR','CL','CO','PE'])];

/** What this checkout is worth, in cents — the base the platform fee comes off. */
const amountCents = (line) =>
  Number(((line || {}).price_data || {}).unit_amount) * Number((line || {}).quantity || 1) || 0;

const main = async (req) => {
  if (req.method !== 'POST') return bad('POST only', 405);
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad('payments-not-configured', 503);

  let body = {};
  try { body = await req.json(); } catch { return bad('bad json'); }
  const origin = new URL(req.url).origin;
  const stripe = new Stripe(key);

  const fan = cleanFanId(body.fan);
  if (!fan) return bad('missing fan');

  /* A VENUE'S MERCH. The owner is `v_<vid>`; the charge is a direct charge on the
     venue's connected account with the venue plan's fee (and Stripe's fee shared —
     see feeCents). Only merch: a venue has no votes or tips to sell. */
  const vq = new URL(req.url).searchParams.get('v');
  if (vq) {
    if (body.kind !== 'merch') return bad('unknown kind');
    const { venueBySlug, getVenueProfile, venueById, venuePlanOf } = await import('./_venues.mjs');
    const { cleanSlug } = await import('./_auth.mjs');
    const vid = await venueBySlug(cleanSlug(vq));
    if (!vid) return bad('unknown venue', 404);
    const owner = `v_${vid}`;
    const [prof, reg] = await Promise.all([getVenueProfile(vid), venueById(vid)]);
    const { VENUE_PLANS } = await import('./_venues.mjs');
    if (!VENUE_PLANS[venuePlanOf(reg)].merch) return bad('Merch isn’t on this page right now', 404);
    const item = (prof.merch || []).find((m) => m.id === String(body.item || '') && m.on);
    if (!item) return bad('That item isn’t for sale right now', 404);
    if (item.cents < 100) return bad('That one isn’t sold through MySet — ask at the bar', 400);
    const conn = await readConnect(owner);
    if (!connectUsable(conn) || !(prof.pay && prof.pay.ready)) return bad('payments-not-configured', 503);
    const qty = Math.max(1, Math.min(5, parseInt(body.qty, 10) || 1));
    const vname = prof.name || (reg && reg.name) || 'the venue';
    const vline = { quantity: qty, price_data: { currency: 'usd', unit_amount: item.cents,
      product_data: { name: `${item.title} — ${vname}`, description: item.blurb || (item.ship === 'ship' ? 'Shipped to you' : 'Pick it up at the bar') } } };
    const attempt = String(body.attempt || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const fee = feeCents(amountCents(vline), venuePlanOf(reg), 'venue');
    const back = `/v/${reg.slug}/community`;
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', line_items: [vline],
        metadata: { fan, kind: 'merch', item: item.id, title: item.title.slice(0, 60), qty: String(qty), ship: item.ship, artist: owner },
        payment_intent_data: {
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
          metadata: { kind: 'merch', artist: owner },
        },
        ...(item.ship === 'ship' ? { shipping_address_collection: { allowed_countries: SHIP_COUNTRIES } } : {}),
        success_url: `${origin}${back}?paid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}${back}?cancelled=1`,
      }, { ...(attempt ? { idempotencyKey: sha(`myset-pay|${owner}|${fan}|merch|${attempt}`).slice(0, 48) } : {}), stripeAccount: conn.acct });
      return json({ ok: true, url: session.url, id: session.id });
    } catch (e) { return bad(e.message || 'stripe error', 502); }
  }

  const aid = await publicArtist(req);
  if (!aid) return bad('unknown artist', 404);
  /* Not this artist's money to take yet — see canTakeMoney in _pay.mjs. The page
     should never have offered the button, so this is the backstop, not the UI. */
  const show = await getShow(aid);
  if (!canTakeMoney(aid, show)) return bad('payments-not-configured', 503);
  const artist = show.artist || 'the artist';

  let line, metadata, shipping = false;
  if (body.kind === 'votes') {
    // price is whatever the artist set — never what the client claims
    const pack = show.packs && show.packs[body.pack];
    if (!pack) return bad('unknown pack');
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: pack.cents,
        product_data: {
          name: `${pack.votes} extra votes — ${artist}`,
          description: 'Extra votes for tonight’s setlist',
        },
      },
    };
    metadata = { fan, kind: 'votes', votes: String(pack.votes), pack: String(body.pack),
                 show: show.showId || '', artist: aid };
  } else if (body.kind === 'song_votes') {
    const dollars = Number(body.amount);
    const cents = Math.round(dollars * 100);
    const songId = String(body.song || '').slice(0, 60);
    const song = show.songs.find((s) => s.id === songId);
    if (!Number.isInteger(dollars) || cents < 100 || cents > 50000)
      return bad('Paid song votes must be whole dollars between $1 and $500');
    if (show.status !== 'live' || !show.windowOpen) return bad('Voting is closed right now', 409);
    if (!song || !show.played.includes(songId) || show.nowPlaying === songId)
      return bad('That replay is not available right now', 409);
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd', unit_amount: cents,
        product_data: { name: `${dollars} paid votes for ${song.title}`,
                        description: `$1 = 1 vote · ${artist}` },
      },
    };
    metadata = { fan, kind: 'song_votes', song: songId, votes: String(dollars),
                 show: show.showId || '', artist: aid };
  } else if (body.kind === 'request_hold') {
    const dollars = Number(body.amount);
    const cents = Math.round(dollars * 100);
    const title = String(body.title || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const songArtist = String(body.artist || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!Number.isInteger(dollars) || cents < 100 || cents > 50000)
      return bad('The request offer must be whole dollars between $1 and $500');
    if (!title) return bad('What song?', 400);
    if (show.status !== 'live' || !show.windowOpen || !show.requests || !show.requests.on)
      return bad('Requests are off right now', 409);
    const [fans, requestDoc] = await Promise.all([
      readFans(aid), (await import('./_requests.mjs')).readRequests(aid),
    ]);
    const me = fans[fan] || { v: [], extra: 0 };
    if (!isUnlimited(fan, show)
        && creditsUsed(me, show) + show.requests.cost > show.freeCredits + (me.extra || 0))
      return bad('no-credits', 402);
    if ((requestDoc.list || []).some((r) =>
      r.fan === fan && r.kind === 'song' && r.status === 'pending' && r.showId === show.showId))
      return bad('You’ve already got a request in — wait for that one first', 409);
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd', unit_amount: cents,
        product_data: { name: `$${dollars} offer for “${title}”`,
                        description: `Authorized now · charged only if ${artist} plays and finishes it` },
      },
    };
    metadata = { fan, kind: 'request_hold', title, songArtist,
                 requestCost: String(show.requests.cost), show: show.showId || '', artist: aid };
  } else if (body.kind === 'tip') {
    const cents = Math.round(Number(body.amount) * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 50000)
      return bad('Tip must be between $1 and $500');
    line = {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents,
        product_data: { name: `Tip for ${artist}`, description: 'Thanks for the music' },
      },
    };
    metadata = { fan, kind: 'tip', note: String(body.note || '').slice(0, 120),
                 show: show.showId || '', artist: aid };
  } else if (body.kind === 'merch') {
    /* THE ITEM IS THE ARTIST'S RECORD, never the request: price, name, and whether
       it ships all come from the profile. A Plus feature, so a lapsed plan means
       the item is not on the page and cannot be bought (same AND-on-read as the
       page itself). */
    const { limits } = await planForArtist(aid);
    if (!merchAllowed(aid, limits)) return bad('Merch isn’t on this page right now', 404);
    const prof = await getProfile(aid);
    const item = (prof.merch || []).find((m) => m.id === String(body.item || '') && m.on);
    if (!item) return bad('That item isn’t for sale right now', 404);
    if (item.cents < 100) return bad('That one isn’t sold through MySet — ask at the merch table', 400);
    const qty = Math.max(1, Math.min(5, parseInt(body.qty, 10) || 1));
    line = {
      quantity: qty,
      price_data: {
        currency: 'usd',
        unit_amount: item.cents,
        product_data: { name: `${item.title} — ${artist}`,
                        description: item.blurb || (item.ship === 'ship' ? 'Shipped to you' : 'Pick it up at the show') },
      },
    };
    metadata = { fan, kind: 'merch', item: item.id, title: item.title.slice(0, 60), qty: String(qty),
                 ship: item.ship, show: show.showId || '', artist: aid };
    shipping = item.ship === 'ship';
  } else {
    return bad('unknown kind');
  }

  /* One tap, one Checkout Session, however many times the request is retried.
     The client mints `attempt` per TAP, so a retry of the same tap reuses the
     session while a deliberate second purchase gets a new one.

     Worth being honest about what this does and does not buy us. It is NOT what
     stops a double charge — an abandoned session is never charged, and the money
     path is already replay-safe through redeemSession (INVARIANT 7). It stops
     duplicate session objects, and it is the habit that matters the moment we
     ever create a charge or a refund server-side, where a retry DOES cost money.
     No attempt id (an older cached page) means no key, rather than a made-up one
     that could collide with somebody else's purchase. */
  const attempt = String(body.attempt || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  /* DIRECT CHARGE, when this artist has their own connected account: the session is
     created ON that account, so the money is theirs and MySet's share is an explicit
     application fee. Without one, this is the founder's own platform account and
     behaves exactly as before. `stripeAccount` must also be in scope to RETRIEVE the
     session later — see stripeFor() in _connect.mjs. */
  const conn = await readConnect(aid);
  const direct = connectUsable(conn);
  /* FAIL CLOSED. canTakeMoney reads the MIRROR on the show record; this reads the
     connect document. When they disagree — a lost mirror write, a capability just
     revoked — the old code quietly omitted stripeAccount and charged the PLATFORM
     account with no fee, while metadata.artist still named the other artist. Money
     in the wrong balance is worse than a button that says not yet. */
  const { isPlatformOwner } = await import('./_plan.mjs');
  if (!direct && !isPlatformOwner(aid)) return bad('payments-not-configured', 503);
  const opts = {
    ...(attempt
      ? { idempotencyKey: sha(`myset-pay|${aid}|${fan}|${body.kind}|${attempt}`).slice(0, 48) }
      : {}),
    ...(direct ? { stripeAccount: conn.acct } : {}),
  };

  /* The platform's share, from the plan table so there is one definition of the cut
     (25% free / 10% Plus / 2% Pro). Zero is omitted rather than sent as 0 — an
     application fee of nothing is not a fee. Never applied to the founder's own
     platform charges, where there is nobody to take a fee from. */
  const { plan } = await planForArtist(aid);
  const fee = direct && !isPlatformOwner(aid) ? feeCents(amountCents(line), plan) : 0;

  /* Back to the page they came from, not to the founding artist's. success_url
     hard-coded /vote.html, which drops the slug — so every registered artist's
     paying fan landed on Perry's voting page, was written into HIS fan store, and
     could vote in his live tally from a room they were not in. INVARIANT 5b still
     holds: /:slug/vote serves vote.html, which is what calls /api/confirm. */
  const { artistById } = await import('./_auth.mjs');
  const who = await artistById(aid);
  /* Merch returns to the community page, which redeems the session exactly as
     vote.html does — the two pages that call /api/confirm (INVARIANT 5b). */
  /* A TIP CAN NOW START FROM THE COMMUNITY PAGE TOO (Perry, 2026-09-07: the tip
     button must always be there, including at the top of that page), and somebody
     who taps it there has to come back there. `from` chooses between two paths this
     server builds — it is never used AS a url, because a caller-supplied redirect is
     an open redirect however innocent the caller looks. */
  const home = body.from === 'community' || body.kind === 'merch';
  const back = home
    ? (who && who.slug ? `/${who.slug}/community` : '/community.html')
    : (who && who.slug ? `/${who.slug}/vote` : '/vote.html');

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [line],
      metadata,
      /* THE CHARGE CARRIES ITS OWN LABEL, not just the session.
         Session metadata does NOT propagate to the charge, so anything reading the
         balance later — the earnings statement, an accountant, Stripe's own export —
         sees an untagged payment and has to join back through the sessions list to
         find out what it was. Two fields here make every future charge explain
         itself. Kept to `kind` and `artist` on purpose: a charge's metadata is
         visible on a receipt, so nothing about the buyer goes in it (0bu). */
      payment_intent_data: {
        ...(fee > 0 ? { application_fee_amount: fee } : {}),
        ...(metadata.kind === 'request_hold' ? { capture_method: 'manual' } : {}),
        metadata: { kind: metadata.kind || '', artist: aid },
      },
      ...(metadata.kind === 'request_hold' ? { payment_method_types: ['card'] } : {}),
      // only a SHIPPED item asks for an address — a T-shirt handed over at the bar needs none
      ...(shipping ? { shipping_address_collection: { allowed_countries: SHIP_COUNTRIES } } : {}),
      // MUST be a page that calls /api/confirm — vote.html and community.html redeem the session
      success_url: `${origin}${back}?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${back}?cancelled=1`,
    }, ...scope(opts));   // an older cached page sends no attempt: `{}` would be refused by the library, not by Stripe
    // the id goes back so the buyer's phone can re-try redemption if the
    // return trip fails (INVARIANT 5c)
    return json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    return bad(e.message || 'stripe error', 502);
  }
};
export default guard('pay', main);
