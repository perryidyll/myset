/* THE ONE WARM DOOR  (decision 0049)
   /api/fan?what=… serves the six public reads from one function so one ping keeps
   them all awake. What this file holds to: the door answers exactly what the old
   address answers; a personal read through it is still never cached; a shared
   read through it still carries its edge lifetime; the ping reads nothing and is
   never cached; an unknown `what` is a 404, not a crash; and the four fan pages
   ask the door, not the old addresses. */
import { readFileSync } from 'node:fs';
const fan     = (await import('../netlify/functions/fan.mjs')).default;
const profile = (await import('../netlify/functions/profile.mjs')).default;
const me      = (await import('../netlify/functions/me.mjs')).default;
const { __opsStart, __opsStop } = await import('./blobs-fake.mjs');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, detail === undefined ? '' : '\n      ' + JSON.stringify(detail).slice(0, 600)); }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const eq = (name, got, want) => ok(name, same(got, want), { got, want });
const call = async (h, u) => {
  const r = await h(new Request(u, { headers: { 'x-forwarded-for': '203.0.113.9' } }));
  const text = await r.text();
  let body = {}; try { body = JSON.parse(text); } catch {}
  return { status: r.status, headers: Object.fromEntries(r.headers), text, body };
};

console.log('THE PING');
{
  __opsStart();
  const r = await call(fan, 'https://x/api/fan?what=warm');
  const ops = __opsStop();
  eq('answers 200', r.status, 200);
  eq('reads nothing', ops.length, 0);
  eq('is never kept by the browser', r.headers['cache-control'], 'no-store');
  eq('nor by the edge', r.headers['netlify-cdn-cache-control'], 'no-store');
}

console.log('AN UNKNOWN READ');
{
  const r = await call(fan, 'https://x/api/fan?what=nope');
  eq('is a 404', r.status, 404);
  const r2 = await call(fan, 'https://x/api/fan');
  eq('and so is no what= at all', r2.status, 404);
}

console.log('THE SAME ANSWER AS THE OLD ADDRESS');
{
  const a = await call(fan, 'https://x/api/fan?what=profile');
  const b = await call(profile, 'https://x/api/profile');
  eq('profile: same status', a.status, b.status);
  // the first read of a fresh store stamps a show and a profile; only those clocks may differ
  const still = (x) => { const y = { ...x }; delete y.showId; delete y.updatedAt; return y; };
  eq('profile: same body', still(a.body), still(b.body));
  ok('profile: still shared at the edge through the door', /durable/.test(a.headers['netlify-cdn-cache-control'] || ''), a.headers);
  const m = await call(fan, 'https://x/api/fan?what=me&fan=fdoortest1');
  const n = await call(me, 'https://x/api/me?fan=fdoortest1');
  eq('me: same status', m.status, n.status);
  eq('me: same shape', Object.keys(m.body).sort(), Object.keys(n.body).sort());
  eq('me: never cached through the door', m.headers['netlify-cdn-cache-control'], 'no-store');
  eq('me: not by the browser either', m.headers['cache-control'], 'no-store');
}

console.log('THE PAGES ASK THE DOOR');
{
  for (const [page, wants] of [
    ['artist',    ['what=profile', 'what=events']],
    ['vote',      ['what=board', 'what=me', 'what=events']],
    ['community', ['what=community']],
    ['venue',     ['what=venue']],
  ]) {
    const src = readFileSync(`public/${page}.html`, 'utf8');
    for (const w of wants) ok(`${page}.html asks /api/fan?${w}`, src.includes('/api/fan?' + w) || src.includes('/fan?' + w));
  }
  const cron = readFileSync('netlify/functions/autocron.mjs', 'utf8');
  ok('autocron rings the ping', cron.includes('/api/fan?what=warm'));
  ok('every fourth minute, not every ring', cron.includes('% 4 === 0'));
  ok('and wakes the Studio\'s two functions with it', cron.includes("'/api/stage'") && cron.includes("'/api/admin'"));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
