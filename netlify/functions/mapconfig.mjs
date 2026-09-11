import { json } from './_lib.mjs';

/* This key is intentionally public: Google browser keys are credentials for quota,
   not secrets. It must be restricted in Google Cloud to Maps Static API requests
   referred by https://myset.vip/* (and the chosen draft-preview pattern while
   testing). Keeping it out of the HTML lets the button disappear honestly until
   the operator has completed those restrictions and enabled billing. */
export default async () => {
  const key = String(process.env.GOOGLE_MAPS_BROWSER_KEY || '').trim();
  return json({ ok: true, enabled: !!key, key });
};
