/* An in-memory stand-in for the `stripe` package, injected by test/hooks.mjs.

   It records the OPTIONS each call was made with, because that is the thing most
   worth asserting about Connect: a direct charge is only a direct charge if
   `stripeAccount` was in scope, and a session created on a connected account can
   only be retrieved with that same account in scope. A stub that ignored the second
   argument would let both of those bugs through. */
const state = {
  accounts: new Map(),          // acct_x -> account object
  sessions: new Map(),          // cs_x   -> { session, onAccount }
  links: [],
  calls: [],                    // every call, with its options
  nextAcct: 1,
  nextSession: 1,
};
export const __stripe = state;
export const __resetStripe = () => {
  state.accounts.clear(); state.sessions.clear();
  state.links.length = 0; state.calls.length = 0;
  state.nextAcct = 1; state.nextSession = 1;
};
const note = (method, args, opts) => state.calls.push({ method, args, opts: opts || {} });

export default class Stripe {
  constructor(key) { this.key = key; }
  get accounts() {
    return {
      create: async (params, opts) => {
        note('accounts.create', params, opts);
        const id = `acct_test${state.nextAcct++}`;
        const a = { id, charges_enabled: false, payouts_enabled: false,
                    details_submitted: false, country: params.country || 'US',
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
  get checkout() {
    return { sessions: {
      create: async (params, opts) => {
        note('checkout.sessions.create', params, opts);
        const id = `cs_test${state.nextSession++}`;
        const amount = (params.line_items || []).reduce((sum, l) =>
          sum + Number((l.price_data || {}).unit_amount || 0) * Number(l.quantity || 1), 0);
        const session = {
          id, url: `https://checkout.stripe.test/${id}`,
          payment_status: 'paid', amount_total: amount,
          created: 1756000000, metadata: params.metadata || {},
          payment_intent: params.payment_intent_data || null,
        };
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
          .filter((r) => r.onAccount === asked).map((r) => r.session) };
      },
    } };
  }
  get webhooks() {
    return { constructEventAsync: async (raw) => JSON.parse(raw) };
  }
}
