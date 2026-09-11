#!/usr/bin/env node
/* THE DRIVER. Runs against the probe Worker from this machine using Node's own
   WebSocket client (Node 22+), so it adds nothing to the repo.

     node probe.mjs --url wss://HOST wake            hibernation: warm RTT vs RTT after idle
     node probe.mjs --url wss://HOST bucket          20 casts land, the 21st is refused
     node probe.mjs --url wss://HOST fanout 200      one vote in, 200 boards out: last-arrival latency
     node probe.mjs --url wss://HOST storm 1000      open N sockets as fast as one laptop can

   Every number printed is measured from THIS machine, so it includes the path
   from here to the nearest Cloudflare PoP and back. Say so when quoting it. */

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const URLBASE = opt('--url', 'ws://127.0.0.1:8787');
const HTTPBASE = URLBASE.replace(/^ws/, 'http');
const ROOM = opt('--room', 'probe-' + Date.now().toString(36));
const mode = args.find(a => !a.startsWith('--') && !/^\d+$/.test(a) && a !== URLBASE && a !== ROOM) || 'wake';
const N = Number(args.find(a => /^\d+$/.test(a)) || 100);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const summary = xs => xs.length ? `n=${xs.length} min=${Math.min(...xs)} p50=${pct(xs, .5)} p90=${pct(xs, .9)} p99=${pct(xs, .99)} max=${Math.max(...xs)} ms` : 'n=0';

function open(room = ROOM) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const ws = new WebSocket(`${URLBASE}/ws?room=${room}`);
    const waiters = [];
    ws.hello = null;
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'hello') { ws.hello = m; ws.connectMs = performance.now() - t0; resolve(ws); return; }
      const i = waiters.findIndex(w => w.match(m));
      if (i >= 0) waiters.splice(i, 1)[0].resolve(m);
      else ws.onboard?.(m);
    };
    ws.onerror = e => reject(new Error('ws error: ' + (e.message || e.type)));
    ws.onclose = e => { if (!ws.hello) reject(new Error(`closed before hello: ${e.code} ${e.reason}`)); };
    ws.expect = (match, timeout = 15000) => new Promise((res, rej) => {
      const w = { match, resolve: res };
      waiters.push(w);
      setTimeout(() => { const i = waiters.indexOf(w); if (i >= 0) { waiters.splice(i, 1); rej(new Error('timeout')); } }, timeout);
    });
    ws.ping = async () => {
      const id = Math.random().toString(36).slice(2);
      const t = performance.now();
      ws.send(JSON.stringify({ t: 'ping', id, sentAt: Date.now() }));
      const m = await ws.expect(x => x.t === 'pong' && x.id === id);
      return { rtt: performance.now() - t, ...m };
    };
  });
}

async function stats() { return (await fetch(`${HTTPBASE}/stats?room=${ROOM}`)).json(); }

const modes = {
  async wake() {
    console.log(`room ${ROOM}`);
    const ws = await open();
    console.log(`connected in ${ws.connectMs.toFixed(0)} ms; hello: wakes=${ws.hello.wakes} bootAt=${ws.hello.bootAt}`);
    const warm = [];
    for (let i = 0; i < 10; i++) { warm.push((await ws.ping()).rtt); await sleep(200); }
    console.log(`warm ping RTT: ${summary(warm.map(Math.round))}`);
    for (const idle of [15, 30, 60, 120]) {
      // keep the LINE warm with runtime-answered heartbeats, but leave the OBJECT alone
      const hb = setInterval(() => ws.send('hb'), 5000);
      const before = (await ws.ping());
      await sleep(idle * 1000);
      clearInterval(hb);
      const after = await ws.ping();
      const woke = after.bootAt !== before.bootAt;
      console.log(`after ${idle}s idle: ping RTT ${after.rtt.toFixed(0)} ms — ${woke ? `OBJECT WOKE (wakes ${before.wakes}→${after.wakes}, awake ${after.awakeMs} ms at reply)` : `still awake (awake ${after.awakeMs} ms)`}`);
    }
    ws.close();
  },

  async bucket() {
    console.log(`room ${ROOM}`);
    const ws = await open();
    let landed = 0, refused = 0;
    const t0 = performance.now();
    const results = [];
    for (let i = 0; i < 25; i++) {
      const id = 'c' + i;
      ws.send(JSON.stringify({ t: 'vote', id }));
      results.push(ws.expect(m => (m.t === 'board' || m.t === 'refused') && m.id === id));
    }
    for (const r of await Promise.all(results)) (r.t === 'board' ? landed++ : refused++);
    console.log(`25 casts in ${(performance.now() - t0).toFixed(0)} ms: ${landed} landed, ${refused} refused (expect 20 / 5)`);
    await sleep(2100);
    ws.send(JSON.stringify({ t: 'vote', id: 'late' }));
    const late = await ws.expect(m => m.id === 'late');
    console.log(`after 2.1s: ${late.t} (expect board — one token refilled)`);
    ws.close();
  },

  async fanout(n = N) {
    console.log(`room ${ROOM}: opening ${n} sockets`);
    const t0 = performance.now();
    const socks = [];
    const errors = [];
    // open in waves of 100 so this is a fan-out test, not a storm test
    for (let i = 0; i < n; i += 100) {
      const wave = await Promise.allSettled(Array.from({ length: Math.min(100, n - i) }, () => open()));
      for (const w of wave) (w.status === 'fulfilled' ? socks.push(w.value) : errors.push(String(w.reason.message)));
    }
    console.log(`${socks.length} open, ${errors.length} failed, in ${(performance.now() - t0).toFixed(0)} ms; connect ${summary(socks.map(s => Math.round(s.connectMs)))}`);
    if (errors.length) console.log('  errors:', [...new Set(errors)].slice(0, 5));
    const s = await stats();
    console.log(`object says sockets=${s.sockets} wakes=${s.wakes}`);
    for (let round = 0; round < 3; round++) {
      const arrivals = socks.map(ws => new Promise(res => { ws.onboard = m => { if (m.t === 'board') res(performance.now()); }; }));
      const t1 = performance.now();
      const r = await (await fetch(`${HTTPBASE}/vote?room=${ROOM}`, { method: 'POST' })).json();
      const tHttp = performance.now() - t1;
      const got = await Promise.race([Promise.all(arrivals), sleep(20000).then(() => null)]);
      if (!got) { console.log(`round ${round}: TIMEOUT waiting for all ${n} boards`); continue; }
      const lat = got.map(t => Math.round(t - t1));
      console.log(`round ${round}: http vote answered in ${tHttp.toFixed(0)} ms (sent to ${r.sent}); board arrival ${summary(lat)}`);
    }
    for (const ws of socks) ws.close();
  },

  async storm(n = N) {
    console.log(`room ${ROOM}: ${n} sockets opened at once, no pacing, from one machine`);
    const t0 = performance.now();
    const settled = await Promise.allSettled(Array.from({ length: n }, () => open()));
    const total = performance.now() - t0;
    const ok = settled.filter(s => s.status === 'fulfilled').map(s => s.value);
    const bad = settled.filter(s => s.status === 'rejected').map(s => String(s.reason.message));
    console.log(`${ok.length} open, ${bad.length} failed, all settled in ${total.toFixed(0)} ms → ${(ok.length / (total / 1000)).toFixed(0)} accepted/s from here`);
    console.log(`connect ${summary(ok.map(s => Math.round(s.connectMs)))}`);
    if (bad.length) { const c = {}; for (const b of bad) c[b] = (c[b] || 0) + 1; console.log('  failures:', c); }
    const s = await stats();
    console.log(`object says sockets=${s.sockets} wakes=${s.wakes}`);
    // one broadcast while they are all open
    const arrivals = ok.map(ws => new Promise(res => { ws.onboard = m => { if (m.t === 'board') res(performance.now()); }; }));
    const t1 = performance.now();
    await fetch(`${HTTPBASE}/vote?room=${ROOM}`, { method: 'POST' });
    const got = await Promise.race([Promise.all(arrivals), sleep(20000).then(() => null)]);
    console.log(got ? `board reached all ${ok.length}: ${summary(got.map(t => Math.round(t - t1)))}` : 'board did NOT reach all within 20s');
    for (const ws of ok) ws.close();
  },
  async wakebig(n = N) {
    console.log(`room ${ROOM}: ${n} sockets, then leave the object alone and see what a wake costs`);
    const socks = [];
    for (let i = 0; i < n; i += 100) {
      const wave = await Promise.allSettled(Array.from({ length: Math.min(100, n - i) }, () => open()));
      for (const w of wave) if (w.status === 'fulfilled') socks.push(w.value);
    }
    const probe = socks[0];
    const warm = await probe.ping();
    console.log(`${socks.length} open; warm ping ${warm.rtt.toFixed(0)} ms, wakes=${warm.wakes}`);
    for (const idle of [20, 45]) {
      const hb = setInterval(() => { for (const ws of socks) ws.send('hb'); }, 5000);
      await sleep(idle * 1000);
      clearInterval(hb);
      const arrivals = socks.map(ws => new Promise(res => { ws.onboard = m => { if (m.t === 'board') res(performance.now()); }; }));
      const t1 = performance.now();
      const r = await (await fetch(`${HTTPBASE}/vote?room=${ROOM}`, { method: 'POST' })).json();
      const tHttp = performance.now() - t1;
      const got = await Promise.race([Promise.all(arrivals), sleep(20000).then(() => null)]);
      const after = await probe.ping();
      const woke = after.wakes !== warm.wakes;
      console.log(`after ${idle}s idle with ${socks.length} sockets: vote answered in ${tHttp.toFixed(0)} ms (sent to ${r.sent}); ${woke ? `OBJECT WOKE (wakes ${warm.wakes}→${after.wakes})` : 'still awake'}; board arrival ${got ? summary(got.map(t => Math.round(t - t1))) : 'TIMEOUT'}`);
      warm.wakes = after.wakes;
    }
    for (const ws of socks) ws.close();
  },
};

if (!modes[mode]) { console.error('modes: ' + Object.keys(modes).join(' ')); process.exit(2); }
modes[mode]().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
