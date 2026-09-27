import { notify } from './_push.mjs';
import { readArtists, artistById, sendMail, emailReady } from './_auth.mjs';

/* A MERCH ORDER TELLS ITS OWNER (the founder, 2026-09-27). A fan bought a shirt and
   the artist heard about it only when the fan asked, because an order was written
   to the Studio's list and nowhere else. Now the claim that writes the order
   (redeemSession, _pay.mjs) also sends:
     · a push to every device the owner switched alerts on for, opening the Merch tab
     · an email to each owner-role address on the account, with the same door
   Only the FRESH claim reaches here — a replay, a webhook retry or the sweep all
   answer "already" before it — so one order is one alert, whichever path landed it.

   Best-effort and time-boxed like the inbox's letters (NOTIFY_MS): the money is
   already safe when this runs, and a slow mail or push service must never hold the
   buyer's receipt page or the webhook's answer (INVARIANT 16). Nothing about the
   buyer goes out — their name and address stay on Stripe (0bu); the letter names
   the item, the size, the count, the price and how it leaves the table. */
export const ORDER_NOTE_MS = 1500;
const within = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
const money = (cents) => '$' + (Math.max(0, cents || 0) / 100).toFixed(2);

/* What was bought, in one line: "Tour tee (M) × 2". */
export const orderLine = (o) =>
  `${String(o.title || 'An item')}${o.variant ? ` (${o.variant})` : ''}${(o.qty || 1) > 1 ? ` × ${o.qty}` : ''}`;
/* How it leaves: shipped to an address on the order, or picked up by its code. */
export const orderHow = (o) => o.ship === 'ship'
  ? 'To be shipped — the address is on the order.'
  : `Pickup at the merch table — code ${o.code}.`;

/* Owner-role sign-ins only: a band mate or the sound engineer is not who fulfils. */
async function ownerEmails(owner) {
  if (String(owner).startsWith('v_')) {
    const { readVenues } = await import('./_venues.mjs');
    const reg = await readVenues().catch(() => null);
    const vid = String(owner).slice(2);
    return reg ? Object.entries(reg.byEmail || {}).filter(([, v]) => v && v.venueId === vid && (v.role || 'owner') === 'owner').map(([e]) => e) : [];
  }
  const reg = await readArtists().catch(() => null);
  return reg ? Object.entries(reg.byEmail || {}).filter(([, v]) => v && v.artistId === owner && (v.role || 'owner') === 'owner').map(([e]) => e) : [];
}

export async function tellOrder(owner, o) {
  try {
    if (!owner || !o) return;
    const venue = String(owner).startsWith('v_');
    const studio = venue ? 'https://myset.vip/venue-studio' : 'https://myset.vip/studio?tab=merch';
    const total = (o.cents || 0) + (o.post || 0);
    const title = `New merch order: ${orderLine(o)}`;
    /* A venue has no push devices today (push_<owner> is empty), so this is a no-op
       there; it costs one read and keeps the two owners on one path. */
    const jobs = [notify(owner, { title: 'New merch order', body: `${orderLine(o)} · ${money(total)} · ${o.ship === 'ship' ? 'to ship' : 'pickup ' + o.code}`,
                                  url: venue ? '/venue-studio' : '/studio?tab=merch', tag: 'order-' + (o.code || '') })];
    if (emailReady()) {
      const [emails, who] = await Promise.all([
        ownerEmails(owner),
        venue ? Promise.resolve('') : artistById(owner).then((a) => (a && a.name) || '').catch(() => ''),
      ]);
      for (const e of emails.slice(0, 5))
        jobs.push(sendMail(e, title, [`Someone just bought ${orderLine(o)} from your MySet shop — ${money(total)}${o.post > 0 ? ` including ${money(o.post)} shipping` : ''}.`,
          orderHow(o), 'Mark it done in your Studio once it has left your hands.'],
          { who, cta: { label: 'Open your orders', url: studio } }));
    }
    await within(Promise.allSettled(jobs), ORDER_NOTE_MS);
  } catch { /* an alert that fails is never the order's problem */ }
}
