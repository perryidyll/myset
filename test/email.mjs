/* SIGN-IN EMAIL — public signup is only ready with a verified sender, and a
   provider rejection must never be presented as "sent". */
process.env.ADMIN_CODE = 'devlocal';
process.env.MYSET_DOUBLE_TAP_MS = '0';

const { emailReady, sendCode } = await import('../netlify/functions/_auth.mjs');
const auth = (await import('../netlify/functions/auth.mjs')).default;
const venueauth = (await import('../netlify/functions/venueauth.mjs')).default;

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + '\n      ' + JSON.stringify(detail)); }
};
const hit = async (handler, body) => {
  const r = await handler(new Request('https://x/api/auth', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { status: r.status, ...(await r.json()) };
};

delete process.env.RESEND_API_KEY;
delete process.env.AUTH_FROM;
ok('a key alone is not enough to advertise email signup', !emailReady());

process.env.RESEND_API_KEY = 're_test';
process.env.AUTH_FROM = 'MySet <onboarding@resend.dev>';
ok('the Resend sandbox sender is not public-signup ready', !emailReady());
ok('and no send is attempted with it', !(await sendCode('new@example.com', '123456')).ok);

process.env.AUTH_FROM = 'MySet <sign-in@myset.vip>';
let last = null;
globalThis.fetch = async (_url, opts) => {
  last = JSON.parse(opts.body);
  return new Response('{}', { status: 202 });
};
ok('a key plus a custom sender is ready', emailReady());
ok('a code can be delivered through the configured sender', (await sendCode('new@example.com', '123456')).ok);
ok('the configured sender is the one Resend receives', last && last.from === process.env.AUTH_FROM, last);

globalThis.fetch = async () => new Response('{}', { status: 403 });
const rejected = await sendCode('blocked@example.com', '123456');
ok('a provider rejection is surfaced', !rejected.ok && rejected.why === 'sender-not-verified', rejected);

const artist = await hit(auth, { action: 'start', email: 'artist-email-test@example.com' });
ok('artist signup never claims a rejected email was sent', artist.status === 502 && !artist.ok, artist);
const venue = await hit(venueauth, { action: 'start', email: 'venue-email-test@example.com' });
ok('venue signup never claims a rejected email was sent', venue.status === 502 && !venue.ok, venue);

console.log('\nONE NETWORK CANNOT ASK FOR A THOUSAND CODES (0111)');
{
  const { NET_CODES_PER_HOUR } = await import('../netlify/functions/_auth.mjs');
  let mails = 0;
  globalThis.fetch = async () => { mails++; return new Response('{}', { status: 202 }); };
  const from = (handler, ip, email) => handler(new Request('https://x/api/auth', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-nf-client-connection-ip': ip },
    body: JSON.stringify({ action: 'start', email }) })).then(async (r) => ({ status: r.status, ...(await r.json()) }));
  const answers = new Set();
  for (let i = 0; i < NET_CODES_PER_HOUR + 5; i++) {
    const r = await from(auth, '203.0.113.9', `fresh-${i}@example.com`);
    answers.add(JSON.stringify(r));
  }
  ok(`${NET_CODES_PER_HOUR + 5} different addresses from one network: ${NET_CODES_PER_HOUR} mails went, the rest did not`, mails === NET_CODES_PER_HOUR, { mails });
  ok('…and every answer was the same one', answers.size === 1, [...answers]);
  const before = mails;
  await from(venueauth, '203.0.113.9', 'a-bar@example.com');
  ok('the venue door counts the same network', mails === before, { mails, before });
  await from(auth, '198.51.100.7', 'elsewhere@example.com');
  ok('a different network still gets its code', mails === before + 1, { mails, before });
  const noIp = await hit(auth, { action: 'start', email: 'no-network@example.com' });
  ok('a request that names no network is not counted (and still sends)', noIp.ok && mails === before + 2, { noIp, mails });
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
