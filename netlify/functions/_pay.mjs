import { mutateFan, mutateMeta, readMeta, cleanFanId } from './_lib.mjs';

/* ONE implementation of "grant what this payment bought".
   Used by the return page (/api/confirm), the Stripe webhook and the artist's
   reconcile sweep, so all three grant identically and none can drift.
   Replay-safe: the session is claimed in meta.paid before anything is granted,
   so a refresh, a webhook retry and a sweep can all race without double-paying. */
export async function redeemSession(aid, session, fallbackFan = '') {
  if (!session || !session.id) return { ok: false, error: 'no session' };
  if (session.payment_status !== 'paid') return { ok: false, error: 'not paid' };

  const sid = session.id;
  const pre = await readMeta(aid);
  if (pre.paid[sid]) return { ok: true, already: true, ...pre.paid[sid] };

  const md = session.metadata || {};
  const who = cleanFanId(md.fan) || cleanFanId(fallbackFan);
  const amount = (session.amount_total || 0) / 100;
  const at = (session.created ? session.created * 1000 : Date.now());
  let granted = 0, already = false;

  // claim first so a double-tap / webhook race can't grant twice
  await mutateMeta(aid, (m) => {
    if (m.paid[sid]) { already = true; return false; }
    if (md.kind === 'votes') granted = parseInt(md.votes, 10) || 0;
    if (md.kind === 'tip') m.tips.push({ fan: who, amount, note: md.note || '', at });
    m.paid[sid] = { kind: md.kind || 'unknown', amount, granted, fan: who, at };
    return true;
  });

  if (already) {
    const m = await readMeta(aid);
    return { ok: true, already: true, ...(m.paid[sid] || {}) };
  }

  if (md.kind === 'votes' && who && granted) {
    // INVARIANT 4: the session is already claimed, so a silent write failure here
    // would lose paid-for votes permanently. Verify by read-back and retry.
    let target = null;
    await mutateFan(
      aid, who,
      (me) => { target = (me.extra || 0) + granted; me.extra = target; return true; },
      (me) => target !== null && (me.extra || 0) >= target
    );
  }
  return { ok: true, kind: md.kind || 'unknown', amount, granted, fan: who, at };
}
