/* Redirects `@netlify/blobs` and `stripe` to in-memory stand-ins, for tests only. */
const FAKE = new URL('./blobs-fake.mjs', import.meta.url).href;
const STRIPE = new URL('./stripe-fake.mjs', import.meta.url).href;
export async function resolve(spec, ctx, next) {
  if (spec === '@netlify/blobs') return { url: FAKE, shortCircuit: true };
  if (spec === 'stripe') return { url: STRIPE, shortCircuit: true };
  return next(spec, ctx);
}
