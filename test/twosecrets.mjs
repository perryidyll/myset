/* The webhook and its two signing secrets — against the REAL stripe library.

   Run WITHOUT test/register.mjs: the fake's constructEventAsync ignores the secret,
   which is exactly the thing this file is about. Stripe signs every endpoint with
   its own secret, and MySet has two endpoints (your account + connected accounts)
   pointing at the one URL. Nothing here touches the network — signature checks are
   an HMAC over the bytes. */
import Stripe from 'stripe';
import { constructSigned, webhookSecrets } from '../netlify/functions/webhook.mjs';

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, '\n      got ', a, '\n      want', b); }
};

const stripe = new Stripe('sk_test_not_a_real_key_signature_checks_are_local');
const A = 'whsec_platform_endpoint_secret';
const B = 'whsec_connected_accounts_endpoint_secret';
const payload = JSON.stringify({ id: 'evt_1', type: 'account.updated', account: 'acct_1', data: { object: { id: 'acct_1' } } });
const signedWith = (secret) => stripe.webhooks.generateTestHeaderString({ payload, secret });

console.log('\nwebhookSecrets(): which secrets are configured');
{
  const saved = { a: process.env.STRIPE_WEBHOOK_SECRET, b: process.env.STRIPE_CONNECT_WEBHOOK_SECRET };
  delete process.env.STRIPE_WEBHOOK_SECRET; delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  eq('none set → empty (the function answers 503)', webhookSecrets(), []);
  process.env.STRIPE_WEBHOOK_SECRET = A;
  eq('only the platform secret → one, as before 2026-09-12', webhookSecrets(), [A]);
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = ` ${B} `;
  eq('both set → both, trimmed, platform first', webhookSecrets(), [A, B]);
  process.env.STRIPE_WEBHOOK_SECRET = saved.a ?? ''; process.env.STRIPE_CONNECT_WEBHOOK_SECRET = saved.b ?? '';
  if (saved.a == null) delete process.env.STRIPE_WEBHOOK_SECRET;
  if (saved.b == null) delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
}

console.log('\nconstructSigned(): the event is accepted by whichever endpoint signed it');
{
  const ev = await constructSigned(stripe, payload, signedWith(A), [A, B]);
  eq('signed by the platform endpoint', ev && ev.type, 'account.updated');
  const ev2 = await constructSigned(stripe, payload, signedWith(B), [A, B]);
  eq('signed by the connected-accounts endpoint', ev2 && ev2.account, 'acct_1');
  eq('signed by B when only A is known → null (today\'s failure, now explicit)',
     await constructSigned(stripe, payload, signedWith(B), [A]), null);
  eq('a forged signature matches neither', await constructSigned(stripe, payload, 't=1,v1=deadbeef', [A, B]), null);
  eq('a tampered body fails both', await constructSigned(stripe, payload + ' ', signedWith(A), [A, B]), null);
  eq('no secrets at all → null, never an unverified event', await constructSigned(stripe, payload, signedWith(A), []), null);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
