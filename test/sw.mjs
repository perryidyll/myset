/* THE SERVICE WORKER'S RULES — the real public/sw.js, run inside a fake browser.
   Nothing under /api is ever answered by the worker; a page seen tonight is shown
   from the phone's copy and refreshed behind it (decision 0091); an older or unseen
   page waits for the network; nothing is precached; a stamped file is never re-asked. */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, detail ?? ''); } };

const ORIGIN = 'https://myset.vip';
const src = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

/* --- the fake browser --- */
const stores = new Map();                       // cache name → Map(url → Response)
const keyOf = (k) => typeof k === 'string' ? new URL(k, ORIGIN).href : k.url;
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return { async put(k, r) { m.set(keyOf(k), r); }, async match(k) { const r = m.get(keyOf(k)); return r && r.clone(); } };
  },
  async match(k) { for (const m of stores.values()) { const r = m.get(keyOf(k)); if (r) return r.clone(); } },
  async keys() { return [...stores.keys()]; },
  async delete(n) { return stores.delete(n); },
};
const handlers = {};
const self = {
  addEventListener: (t, fn) => { handlers[t] = fn; },
  skipWaiting() {}, location: { origin: ORIGIN },
  clients: { async claim() {}, async matchAll() { return []; } },
  registration: { async unregister() {}, async showNotification() {} },
};
let fetchLog = [];
let network = async () => new Response('page', { status: 200 });
const ctx = vm.createContext({ self, caches, Response, Headers, URL, console, setTimeout, fetch: (r) => { fetchLog.push(r.url); return network(r); } });
vm.runInContext(src, ctx, { filename: 'sw.js' });

const request = (path, o = {}) => ({ method: o.method || 'GET', url: (o.origin || ORIGIN) + path, mode: o.mode || 'no-cors', cache: o.cache || 'default', headers: new Headers() });
async function go(req) {
  const ev = { request: req, out: undefined, waits: [], respondWith(p) { this.out = p; }, waitUntil(p) { this.waits.push(p); } };
  handlers.fetch(ev);
  const res = ev.out === undefined ? undefined : await ev.out;
  await Promise.all(ev.waits);
  return { res, body: res ? await res.clone().text() : undefined, intercepted: ev.out !== undefined, waits: ev.waits.length };
}
const page = (text, extra = {}) => new Response(text, { status: extra.status || 200, headers: { 'content-type': 'text/html' } });
const stored = async (path) => (await caches.open('myset-runtime-v4')).match(ORIGIN + path);

/* --- rule 1: /api and anything that is not a same-origin GET pass straight through --- */
ok('nothing under /api is touched, even as a navigation', !(await go(request('/api/board?a=x', { mode: 'navigate' }))).intercepted);
ok('nothing under /api is touched, even with a static extension', !(await go(request('/api/thing.js'))).intercepted);
ok('a POST is not touched', !(await go(request('/perryidyll/vote', { method: 'POST', mode: 'navigate' }))).intercepted);
ok('a cross-origin request is not touched', !(await go(request('/v3/', { origin: 'https://js.stripe.com' }))).intercepted);

/* --- rule 4: nothing precached --- */
ok('nothing is precached at install', !/addAll|precache/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '')));
await handlers.install({ waitUntil() {} });
ok('install stores nothing', stores.size === 0);

/* --- rule 2: navigations --- */
network = async () => page('vote v1');
let r = await go(request('/perryidyll/vote?paid=1', { mode: 'navigate' }));
ok('an unseen page comes from the network', r.body === 'vote v1' && fetchLog.length === 1, r.body);
let copy = await stored('/perryidyll/vote');
ok('…and is stored by path, without the query, stamped with its arrival', !!copy && /^\d{13}$/.test(copy.headers.get('x-myset-stored') || ''));

network = async () => page('vote v2');
r = await go(request('/perryidyll/vote?x=2', { mode: 'navigate' }));
ok('a page seen tonight is shown from the copy at once', r.body === 'vote v1', r.body);
ok('…and re-fetched behind it, the refresh held open with waitUntil', fetchLog.length === 2 && r.waits === 1 && (await (await stored('/perryidyll/vote')).text()) === 'vote v2', r.waits);
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('the open after next has the newest', r.body === 'vote v2', r.body);

// make the copy a week old
{ const c = await caches.open('myset-runtime-v4'); const old = await c.match(ORIGIN + '/perryidyll/vote');
  const h = new Headers(old.headers); h.set('x-myset-stored', String(Date.now() - 7 * 86400000));
  await c.put(ORIGIN + '/perryidyll/vote', new Response(await old.text(), { status: 200, headers: h })); }
network = async () => page('vote v3');
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('a copy older than a night waits for the network', r.body === 'vote v3', r.body);
{ const c = await caches.open('myset-runtime-v4'); const old = await c.match(ORIGIN + '/perryidyll/vote');
  const h = new Headers(old.headers); h.set('x-myset-stored', String(Date.now() - 6 * 3600000 - 1000));
  await c.put(ORIGIN + '/perryidyll/vote', new Response(await old.text(), { status: 200, headers: h })); }
network = async () => page('vote v3b');
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('a copy six hours old is not "tonight" any more', r.body === 'vote v3b', r.body);
{ const c = await caches.open('myset-runtime-v4'); const old = await c.match(ORIGIN + '/perryidyll/vote');
  const h = new Headers(old.headers); h.set('x-myset-stored', String(Date.now() - 5 * 3600000));
  await c.put(ORIGIN + '/perryidyll/vote', new Response(await old.text(), { status: 200, headers: h })); }
network = async () => page('vote v4');
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('a copy five hours old is still tonight', r.body === 'vote v3b', r.body);

network = async () => page('vote v5');
r = await go(request('/perryidyll/vote', { mode: 'navigate', cache: 'no-cache' }));
ok('a reload (no-cache) asks the network first even with a copy from tonight', r.body === 'vote v5', r.body);
network = async () => page('vote v6');
r = await go(request('/perryidyll/vote', { mode: 'navigate', cache: 'reload' }));
ok('a hard reload (reload) too', r.body === 'vote v6', r.body);
network = async () => page('vote v7');
r = await go(request('/perryidyll/vote', { mode: 'navigate', cache: 'force-cache' }));
ok('back/forward (force-cache) takes the copy', r.body === 'vote v6', r.body);
network = async () => { throw new TypeError('offline'); };
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('no signal, a copy: the copy', r.body === 'vote v7', r.body);
{ const c = await caches.open('myset-runtime-v4'); const old = await c.match(ORIGIN + '/perryidyll/vote');
  const h = new Headers(old.headers); h.set('x-myset-stored', String(Date.now() - 7 * 86400000));
  await c.put(ORIGIN + '/perryidyll/vote', new Response(await old.text(), { status: 200, headers: h })); }
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('no signal, a week-old copy: still the copy', r.body === 'vote v7', r.body);
r = await go(request('/never-seen', { mode: 'navigate' }));
ok('no signal, no copy, no front door: the No connection page', r.res.status === 503 && /No connection/.test(r.body));
network = async () => page('front door');
await go(request('/', { mode: 'navigate' }));
network = async () => { throw new TypeError('offline'); };
r = await go(request('/never-seen-either', { mode: 'navigate' }));
ok('no signal, no copy: the front door stands in', r.body === 'front door', r.body);

network = async () => Object.defineProperty(page('moved'), 'redirected', { value: true });
r = await go(request('/financialmodel', { mode: 'navigate' }));
ok('a redirect is answered but never stored', r.body === 'moved' && !(await stored('/financialmodel')));
network = async () => page('boom', { status: 500 });
r = await go(request('/broken', { mode: 'navigate' }));
ok('an error page is answered but never stored', r.res.status === 500 && !(await stored('/broken')));
network = async () => new Response('<form>passcode</form>', { status: 200, headers: { 'content-type': 'text/html', 'cache-control': 'private, no-store' } });
r = await go(request('/moneymodel', { mode: 'navigate' }));
ok('a page that says no-store (the passcode-gated money model) is answered but never stored', /passcode/.test(r.body) && !(await stored('/moneymodel')));
network = async () => new Response('mine', { status: 200, headers: { 'cache-control': 'private' } });
r = await go(request('/mine', { mode: 'navigate' }));
ok('a page that says private is never stored either', r.body === 'mine' && !(await stored('/mine')));

/* --- a broken cache store never costs the page --- */
const realMatch = caches.match, realOpen = caches.open;
caches.match = async () => { throw new DOMException('cache storage unavailable', 'InvalidStateError'); };
network = async () => page('vote v8');
r = await go(request('/perryidyll/vote', { mode: 'navigate' }));
ok('caches.match throwing: the page still comes from the network', r.body === 'vote v8', r.body);
caches.match = realMatch;
caches.open = async () => { throw new DOMException('quota', 'QuotaExceededError'); };
network = async () => page('vote v9');
r = await go(request('/never-stored', { mode: 'navigate' }));
ok('caches.open throwing on the way in: the page still comes from the network', r.body === 'vote v9', r.body);
network = async () => new Response('css', { status: 200 });
r = await go(request('/fresh.css'));
ok('…and a static file too', r.body === 'css', r.body);
caches.open = realOpen;

/* --- rule 3: static files --- */
fetchLog = [];
network = async () => new Response('css v1', { status: 200 });
r = await go(request('/app.css'));
ok('an unseen static file comes from the network and is stored', r.body === 'css v1' && !!(await stored('/app.css')));
network = async () => new Response('css v2', { status: 200 });
r = await go(request('/app.css'));
ok('a seen static file is instant and refreshed behind', r.body === 'css v1' && fetchLog.length === 2 && (await (await stored('/app.css')).text()) === 'css v2');
fetchLog = [];
network = async () => new Response('fan v1', { status: 200 });
await go(request('/fan.js?v=580721d7'));
r = await go(request('/fan.js?v=580721d7'));
ok('a stamped file is never re-asked once held', r.body === 'fan v1' && fetchLog.length === 1, fetchLog);
r = await go(request('/fan.js?v=00000000'));
ok('a new stamp is a new file', fetchLog.length === 2);

/* --- rule 5: old caches go on activate --- */
stores.set('myset-runtime-v3', new Map());
await handlers.activate({ waitUntil: (p) => p });
await new Promise((res) => setTimeout(res, 10));
ok('activate deletes every other cache', !stores.has('myset-runtime-v3') && stores.has('myset-runtime-v4'));

console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
