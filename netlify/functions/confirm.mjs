import Stripe from 'stripe';
import { mutateFan, mutateMeta, readMeta, json, bad, cleanFanId } from './_lib.mjs';

/* Verifies a Stripe Checkout session server-side and grants what was bought.
   No webhook needed; replay-safe (each session redeems once). */
export default async (req) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return bad('payments-not-configured', 503);

  const url = new URL(req.url);
  const sessionId = (url.searchParams.get('session_id') || '').slice(0, 120);
  const fallbackFan = cleanFanId(url.searchParams.get('fan'));
  if (!sessionId) return bad('missing session_id');

  const pre = await readMeta();
  if (pre.paid[sessionId]) return json({ ok: true, already: true, ...pre.paid[sessionId] });

  let session;
  try { session = await new Stripe(key).checkout.sessions.retrieve(sessionId); }
  catch { return bad('could not verify payment', 502); }
  if (session.payment_status !== 'paid') return bad('not paid', 402);

  const md = session.metadata || {};
  const who = cleanFanId(md.fan) || fallbackFan;
  const amount = (session.amount_total || 0) / 100;
  let granted = 0, already = false;

  // claim the session first so a double-tap can't grant twice
  await mutateMeta((m) => {
    if (m.paid[sessionId]) { already = true; return false; }
    if (md.kind === 'votes') granted = parseInt(md.votes, 10) || 0;
    if (md.kind === 'tip') m.tips.push({ fan: who, amount, note: md.note || '', at: Date.now() });
    m.paid[sessionId] = { kind: md.kind || 'unknown', amount, granted };
    return true;
  });

  if (already) {
    const m = await readMeta();
    return json({ ok: true, already: true, ...(m.paid[sessionId] || {}) });
  }
  if (md.kind === 'votes' && who && granted) {
    // INVARIANT 4: verify the grant actually stuck. The session is already claimed,
    // so a silent write failure would lose paid-for votes permanently.
    let target = null;
    await mutateFan(
      who,
      (me) => { target = (me.extra || 0) + granted; me.extra = target; return true; },
      (me) => target !== null && (me.extra || 0) >= target
    );
  }
  return json({ ok: true, kind: md.kind || 'unknown', amount, granted });
};
