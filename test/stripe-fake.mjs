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
  customers: new Map(),
  products: new Map(),
  prices: new Map(),            // price_x -> price
  coupons: new Map(),
  subs: new Map(),              // sub_x -> subscription
  links: [],
  calls: [],                    // every call, with its options
  nextAcct: 1, nextSession: 1, nextCus: 1, nextPrice: 1, nextSub: 1, nextProd: 1,
};
export const __stripe = state;
export const __resetStripe = () => {
  for (const m of [state.accounts, state.sessions, state.customers, state.products, state.prices, state.coupons, state.subs]) m.clear();
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
          session = {
            id, url: `https://checkout.stripe.test/${id}`, mode: 'payment',
            payment_status: 'paid', amount_total: amount,
            created: 1756000000, metadata: params.metadata || {},
            payment_intent: params.payment_intent_data || null,
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
        return { data: [...state.sessions.values()]
          .filter((r) => r.onAccount === asked && r.session.mode !== 'subscription').map((r) => r.session) };
      },
    } };
  }
  get webhooks() {
    return { constructEventAsync: async (raw) => JSON.parse(raw) };
  }
}
