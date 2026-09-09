/* An in-memory stand-in for the `stripe` package, injected by test/hooks.mjs.

   It records the OPTIONS each call was made with, because that is the thing most
   worth asserting about Connect: a direct charge is only a direct charge if
   `stripeAccount` was in scope, and a session created on a connected account can
   only be retrieved with that same account in scope. A stub that ignored the second
   argument would let both of those bugs through.

   Billing (2026-09-04): customers, products, prices by lookup key, coupons,
   subscriptions (retrieve / update / cancel), subscription-mode checkout sessions
   and the portal — enough to drive _billing.mjs end to end. */
const state = {
  accounts: new Map(),          // acct_x -> account object
  sessions: new Map(),          // cs_x   -> { session, onAccount }
  paymentIntents: new Map(),    // pi_x   -> { intent, onAccount }
  customers: new Map(),
  products: new Map(),
  prices: new Map(),            // price_x -> price
  coupons: new Map(),
  subs: new Map(),              // sub_x -> subscription
  bts: new Map(),               // txn_x -> balance transaction, tagged with its account
  fees: new Map(),              // fee_x -> application fee (platform side)
  feeRefunds: new Map(),        // idempotency key -> fee refund
  refunds: new Map(),           // idempotency key -> refund
  links: [],
  calls: [],                    // every call, with its options
  nextAcct: 1, nextSession: 1, nextCus: 1, nextPrice: 1, nextSub: 1, nextProd: 1,
};
export const __stripe = state;
export const __resetStripe = () => {
  for (const m of [state.accounts, state.sessions, state.paymentIntents, state.customers, state.products, state.prices, state.coupons, state.subs, state.bts, state.fees, state.feeRefunds, state.refunds]) m.clear();
  state.links.length = 0; state.calls.length = 0;
  state.nextAcct = 1; state.nextSession = 1; state.nextCus = 1; state.nextPrice = 1; state.nextSub = 1; state.nextProd = 1;
};
const note = (method, args, opts) => state.calls.push({ method, args, opts: opts || {} });
const NOW = () => Math.floor(Date.now() / 1000);

export default class Stripe {
  constructor(key) { this.key = key; }
  get accounts() {
    return {
      create: async (params, opts) => {
        note('accounts.create', params, opts);
        const id = `acct_test${state.nextAcct++}`;
        const a = { id, charges_enabled: false, payouts_enabled: false,
                    details_submitted: false, country: params.country || 'US',
                    individual: { first_name: '', last_name: '', verification: { status: 'unverified' } },
                    business_profile: { name: '' },
                    metadata: params.metadata || {} };
        state.accounts.set(id, a);
        return a;
      },
      retrieve: async (id, opts) => {
        note('accounts.retrieve', { id }, opts);
        const a = state.accounts.get(id);
        if (!a) throw new Error('No such account');
        return a;
      },
      createLoginLink: async (id, opts) => {
        note('accounts.createLoginLink', { id }, opts);
        if (!state.accounts.get(id)) throw new Error('No such account');
        return { url: `https://connect.stripe.test/express/${id}` };
      },
    };
  }
  get accountLinks() {
    return { create: async (params, opts) => {
      note('accountLinks.create', params, opts);
      if (!state.accounts.get(params.account)) throw new Error('No such account');
      const url = `https://connect.stripe.test/onboard/${params.account}`;
      state.links.push({ ...params, url });
      return { url };
    } };
  }
  get customers() {
    return {
      create: async (params, opts) => { note('customers.create', params, opts);
        const id = `cus_test${state.nextCus++}`; const c = { id, ...params }; state.customers.set(id, c); return c; },
      retrieve: async (id, opts) => { note('customers.retrieve', { id }, opts);
        const c = state.customers.get(id); if (!c) throw new Error('No such customer'); return c; },
    };
  }
  get products() {
    return { create: async (params, opts) => { note('products.create', params, opts);
      const id = `prod_test${state.nextProd++}`; const p = { id, ...params }; state.products.set(id, p); return p; } };
  }
  get prices() {
    return {
      list: async (params, opts) => { note('prices.list', params, opts);
        const keys = new Set(params.lookup_keys || []);
        return { data: [...state.prices.values()].filter((p) => keys.has(p.lookup_key) && p.active !== false) }; },
      create: async (params, opts) => { note('prices.create', params, opts);
        const id = `price_test${state.nextPrice++}`; const p = { id, active: true, ...params }; state.prices.set(id, p); return p; },
    };
  }
  get coupons() {
    return {
      retrieve: async (id, opts) => { note('coupons.retrieve', { id }, opts);
        const c = state.coupons.get(id); if (!c) throw new Error('No such coupon'); return c; },
      create: async (params, opts) => { note('coupons.create', params, opts);
        const c = { id: params.id || `co_${state.coupons.size + 1}`, ...params }; state.coupons.set(c.id, c); return c; },
    };
  }
  get subscriptions() {
    const shape = (s) => ({ ...s, items: { data: s.items.data.map((it) => ({ ...it, price: state.prices.get(it.price) || { id: it.price } })) } });
    return {
      retrieve: async (id, opts) => { note('subscriptions.retrieve', { id }, opts);
        const s = state.subs.get(id); if (!s) throw new Error('No such subscription'); return shape(s); },
      update: async (id, params, opts) => { note('subscriptions.update', { id, ...params }, opts);
        const s = state.subs.get(id); if (!s) throw new Error('No such subscription');
        if (params.cancel_at_period_end !== undefined) s.cancel_at_period_end = !!params.cancel_at_period_end;
        if (params.items) s.items.data = params.items.map((it, i) => ({ id: it.id || `si_${id}_${i}`, price: it.price }));
        if (params.coupon) s.discount = { coupon: state.coupons.get(params.coupon) || { id: params.coupon } };
        if (params.metadata) s.metadata = { ...(s.metadata || {}), ...params.metadata };
        return shape(s); },
      cancel: async (id, opts) => { note('subscriptions.cancel', { id }, opts);
        const s = state.subs.get(id); if (!s) throw new Error('No such subscription'); s.status = 'canceled'; return shape(s); },
    };
  }
  get balanceTransactions() {
    return {
      /* Scoped like everything else: a connected account's balance is invisible
         from the platform and the platform's is invisible from a connected
         account. An accounting report that ignored this would add an artist's
         gross into MySet's own revenue, which is the whole point of the test. */
      list: async (params, opts) => { note('balanceTransactions.list', params, opts);
        const acct = (opts && opts.stripeAccount) || '';
        const g = (params.created || {}).gte || 0, l = (params.created || {}).lte || 9e12;
        const rows = [...state.bts.values()]
          .filter((b) => (b.__account || '') === acct && b.created >= g && b.created <= l)
          .sort((a, b) => a.created - b.created);
        const start = params.starting_after
          ? rows.findIndex((r) => r.id === params.starting_after) + 1 : 0;
        const page = rows.slice(start, start + (params.limit || 100));
        return { data: page, has_more: start + page.length < rows.length }; },
      retrieve: async (id, opts) => { note('balanceTransactions.retrieve', { id }, opts);
      const bt = state.bts.get(id);
      if (!bt) throw new Error('No such balance transaction');
      /* THE SCOPE MATTERS AS MUCH AS THE NUMBER. A balance transaction on a direct
         charge lives in the CONNECTED account's balance and is invisible from the
         platform, so a stub that ignored the second argument would let the exact
         bug this code was written to avoid straight through. */
      if ((bt.__account || '') !== ((opts && opts.stripeAccount) || '')) throw new Error('No such balance transaction');
      return bt; } };
  }
  get applicationFees() {
    return {
      retrieve: async (id, opts) => { note('applicationFees.retrieve', { id }, opts);
        const f = state.fees.get(id); if (!f) throw new Error('No such application fee');
        // and this one is the PLATFORM's: asking with an account in scope must miss
        if (opts && opts.stripeAccount) throw new Error('No such application fee');
        return f; },
      list: async (params, opts) => { note('applicationFees.list', params, opts);
        if (opts && opts.stripeAccount) return { data: [] };
        return { data: [...state.fees.values()].filter((f) => f.charge === params.charge) }; },
      createRefund: async (id, params, opts) => { note('applicationFees.createRefund', { id, ...params }, opts);
        const f = state.fees.get(id); if (!f) throw new Error('No such application fee');
        const room = f.amount - (f.amount_refunded || 0);
        if (params.amount > room) throw new Error('Can refund only up to the remaining unrefunded amount');
        // idempotency: the same key returns the same refund rather than a second one
        const k = (opts && opts.idempotencyKey) || '';
        if (k && state.feeRefunds.has(k)) return state.feeRefunds.get(k);
        f.amount_refunded = (f.amount_refunded || 0) + params.amount;
        const r = { id: `fr_test${state.feeRefunds.size + 1}`, fee: id, amount: params.amount };
        if (k) state.feeRefunds.set(k, r);
        return r; },
    };
  }
  get refunds() {
    /* Idempotent by key, like the real thing: a webhook retry that refunds the same
       payment twice is the bug this exists to make visible. */
    return { create: async (params, opts) => { note('refunds.create', params, opts);
      const k = (opts && opts.idempotencyKey) || '';
      if (k && state.refunds.has(k)) return state.refunds.get(k);
      const r = { id: `re_test${state.refunds.size + 1}`, ...params, status: 'succeeded' };
      if (k) state.refunds.set(k, r);
      return r; } };
  }
  get paymentIntents() {
    const find = (id, opts) => {
      const rec = state.paymentIntents.get(id);
      if (!rec || rec.onAccount !== ((opts && opts.stripeAccount) || ''))
        throw new Error('No such payment_intent');
      return rec;
    };
    return {
      retrieve: async (id, opts) => {
        note('paymentIntents.retrieve', { id }, opts);
        return { ...find(id, opts).intent };
      },
      capture: async (id, params, opts) => {
        note('paymentIntents.capture', { id, ...(params || {}) }, opts);
        const rec = find(id, opts);
        if (rec.intent.status === 'canceled') throw new Error('PaymentIntent is canceled');
        rec.intent.status = 'succeeded';
        for (const row of state.sessions.values()) {
          if (row.session.payment_intent === id) row.session.payment_status = 'paid';
        }
        return { ...rec.intent };
      },
      cancel: async (id, params, opts) => {
        note('paymentIntents.cancel', { id, ...(params || {}) }, opts);
        const rec = find(id, opts);
        if (rec.intent.status === 'succeeded') throw new Error('PaymentIntent already succeeded');
        rec.intent.status = 'canceled';
        return { ...rec.intent };
      },
    };
  }
  get invoices() {
    return { list: async (params, opts) => { note('invoices.list', params, opts);
      /* One paid invoice per subscription on this customer, which is what a month
         of a live subscription actually leaves behind. Enough to prove the Studio
         lists them, links them and never invents one for a customer with none. */
      const out = [];
      for (const s of state.subs.values()) {
        if (s.customer !== params.customer) continue;
        out.push({ id: `in_${s.id}`, number: `MYSET-${s.id.slice(-4)}`, status: 'paid',
                   total: 1000, amount_paid: 1000, amount_due: 1000, currency: 'usd',
                   created: NOW() - 86400,
                   hosted_invoice_url: `https://invoice.stripe.test/${s.id}`,
                   invoice_pdf: `https://invoice.stripe.test/${s.id}.pdf` });
      }
      return { data: out.slice(0, params.limit || 10) }; } };
  }
  get billingPortal() {
    return { sessions: { create: async (params, opts) => { note('billingPortal.sessions.create', params, opts);
      if (!state.customers.get(params.customer)) throw new Error('No such customer');
      return { url: `https://billing.stripe.test/${params.customer}` }; } } };
  }
  get checkout() {
    return { sessions: {
      create: async (params, opts) => {
        note('checkout.sessions.create', params, opts);
        const id = `cs_test${state.nextSession++}`;
        let session;
        if (params.mode === 'subscription') {
          /* the fake "pays" on creation: a live subscription exists the moment the
             session is made, which is what a completed Checkout produces */
          const subId = `sub_test${state.nextSub++}`;
          const priceId = ((params.line_items || [])[0] || {}).price;
          state.subs.set(subId, { id: subId, status: 'active', customer: params.customer,
            current_period_end: NOW() + 30 * 86400, cancel_at_period_end: false,
            items: { data: [{ id: `si_${subId}_0`, price: priceId }] },
            metadata: (params.subscription_data || {}).metadata || {},
            discount: (params.discounts || [])[0] ? { coupon: state.coupons.get(params.discounts[0].coupon) } : null });
          session = { id, url: `https://checkout.stripe.test/${id}`, mode: 'subscription',
                      subscription: subId, customer: params.customer, payment_status: 'paid',
                      created: NOW(), metadata: params.metadata || {} };
        } else {
          const amount = (params.line_items || []).reduce((sum, l) =>
            sum + Number((l.price_data || {}).unit_amount || 0) * Number(l.quantity || 1), 0);
          /* A REAL payment intent ID, not the params object. Stripe returns an id
             (or an expanded object with one); handing back the request params meant
             every refund path in every test silently did nothing, because there was
             no id to refund against. The params are kept alongside so tests can
             still assert on application_fee_amount and metadata. */
          const pi = `pi_${id.replace(/^cs_/, '')}`;
          const manual = (params.payment_intent_data || {}).capture_method === 'manual';
          state.paymentIntents.set(pi, { onAccount: (opts && opts.stripeAccount) || '',
            intent: { id: pi, amount, status: manual ? 'requires_capture' : 'succeeded',
              capture_method: manual ? 'manual' : 'automatic_async' } });
          session = {
            id, url: `https://checkout.stripe.test/${id}`, mode: 'payment',
            payment_status: manual ? 'unpaid' : 'paid', amount_total: amount,
            created: NOW(), metadata: params.metadata || {},
            payment_intent: pi,
            payment_intent_data: params.payment_intent_data || null,
          };
        }
        state.sessions.set(id, { session, onAccount: (opts && opts.stripeAccount) || '' });
        return session;
      },
      /* THE POINT OF THIS STUB: a session created on a connected account is not
         visible from the platform account, and vice versa. Getting this wrong is how
         a paid customer gets nothing. */
      retrieve: async (id, opts) => {
        note('checkout.sessions.retrieve', { id }, opts);
        const rec = state.sessions.get(id);
        if (!rec) throw new Error('No such checkout.session');
        const asked = (opts && opts.stripeAccount) || '';
        if (rec.onAccount !== asked) throw new Error('No such checkout.session');
        return rec.session;
      },
      list: async (params, opts) => {
        note('checkout.sessions.list', params, opts);
        const asked = (opts && opts.stripeAccount) || '';
        /* THE DATE FILTER IS HONOURED, and it has to be. Ignoring `created` made
           every session visible in every window, so a test could never catch code
           that only looks back one month — which is exactly how a refund of an
           older charge gets booked against the wrong side of the books. */
        const g = ((params || {}).created || {}).gte ?? 0;
        const l = ((params || {}).created || {}).lte ?? 9e12;
        return { data: [...state.sessions.values()]
          .filter((r) => r.onAccount === asked && r.session.mode !== 'subscription'
                      && (r.session.created ?? 0) >= g && (r.session.created ?? 0) <= l)
          .map((r) => r.session) };
      },
    } };
  }
  get webhooks() {
    return { constructEventAsync: async (raw) => JSON.parse(raw) };
  }
}
