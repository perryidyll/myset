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
    /* A venue's phones hear it too since decision 0124: every venue seat sees its
       orders, so `{ tab: 'merch' }` reaches each of them (_push.mjs). */
    const jobs = [notify(owner, { title: 'New merch order', body: `${orderLine(o)} · ${money(total)} · ${o.ship === 'ship' ? 'to ship' : 'pickup ' + o.code}`,
                                  url: venue ? '/venues?tab=merch' : '/studio?tab=merch', tag: 'order-' + (o.code || '') }, { tab: 'merch' })];
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

/* SOLD OUT BEFORE THE MONEY LANDED (decision 0178). The order was refunded in full the
   moment it came in short, and two people need to know: the seats that fulfil orders
   (so nobody goes looking for a shirt that is not there — the same `{ tab: 'merch' }`
   as a new order), and the buyer, whose card was charged and is being paid back. The
   buyer's address is the one on the Stripe session in hand, used for this one letter
   and never stored (0bu); without it, the return page says it and Stripe's own receipt
   does. Same rules as an order: once, time-boxed, never thrown. */
export async function tellShort(owner, o, buyerEmail = '') {
  try {
    if (!owner || !o) return;
    const venue = String(owner).startsWith('v_');
    const total = money(Math.round((Number(o.amount) || 0) * 100));
    const jobs = [notify(owner, { title: 'Sold out before a payment landed', body: `${orderLine(o)} · ${total} refunded to the buyer`,
                                  url: venue ? '/venues?tab=merch' : '/studio?tab=merch', tag: 'short-' + (o.code || '') }, { tab: 'merch' })];
    if (emailReady() && buyerEmail) {
      let who = '';
      if (venue) {
        const { getVenueProfile } = await import('./_venues.mjs');
        who = await getVenueProfile(String(owner).slice(2)).then((p) => (p && p.name) || '').catch(() => '');
      } else who = await artistById(owner).then((a) => (a && a.name) || '').catch(() => '');
      jobs.push(sendMail(buyerEmail, `${orderLine(o)} sold out — your ${total} is on its way back`,
        [`The last one went to someone else while you were paying, so ${who || 'the seller'} couldn’t fill your order.`,
         `Your ${total} has gone back to your card. It can take 5–10 days to show.`, 'There’s nothing you need to do.'], { who }));
    }
    await within(Promise.allSettled(jobs), ORDER_NOTE_MS);
  } catch { /* the refund is made; a letter is a courtesy */ }
}

/* A TIP FOR A VENUE'S STAFF TELLS THE VENUE (decision 0127): a push to every venue
   seat, opening the Merch tab where the tips are listed. Same rules as an order: the
   fresh claim only, time-boxed, never thrown, nothing about the tipper but the note. */
export async function tellVenueTip(owner, amount, note) {
  try {
    if (!String(owner).startsWith('v_')) return;
    await within(notify(owner, { title: `A ${'$' + (Number(amount) || 0).toFixed(2)} tip for the staff`, body: note ? `“${String(note).slice(0, 100)}”` : 'Someone loved their night.',
                                 url: '/venues?tab=merch', tag: 'tip-' + Date.now().toString(36) }, { tab: 'merch' }), ORDER_NOTE_MS);
  } catch { /* the tip is safe; an alert is a courtesy */ }
}
