/* THE PROBE. One Durable Object per "room", holding hibernating WebSockets, so the
   open-line report's open questions can be answered by measurement:

     - hibernation: does the object really sleep between votes, and what does
       waking it cost a phone in latency?   (`wakes` climbs, `bootAt` changes)
     - fan-out: one vote in, N boards out — how long until the last phone has it?
     - the 1,000 requests/second soft ceiling under a reconnection storm
     - the same token bucket as decision 0030 (20 burst, 30/min), per connection,
       surviving hibernation because it lives in the socket attachment, not memory

   Nothing here is production code. It has no auth, no board, no Netlify. */

const BURST = 20;         // decision 0030 — CAST_BURST
const PER_MIN = 30;       // decision 0030 — CAST_PER_MIN

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/') return new Response('myset open-line probe\n');
    const room = url.searchParams.get('room') || 'probe';
    const stub = env.ROOM.get(env.ROOM.idFromName(room));
    return stub.fetch(req);
  }
};

export class Room {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.bootAt = Date.now();          // changes on every wake — the hibernation tell
    this.sql = ctx.storage.sql;
    this.msgs = 0;                     // messages handled since this boot
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`);
      this.wakes = this.getNum('wakes') + 1;
      this.setNum('wakes', this.wakes);
      this.version = this.getNum('version');
    });
    // Heartbeats answered by the runtime, so a phone keeping its line warm does
    // not wake the object. This is the line the whole cost model rests on.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('hb', 'hb'));
  }

  getNum(k) {
    const row = this.sql.exec(`SELECT v FROM kv WHERE k = ?`, k).toArray()[0];
    return row ? Number(row.v) : 0;
  }
  setNum(k, v) { this.sql.exec(`INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)`, k, String(v)); }

  stats() {
    const now = Date.now();
    return { sockets: this.ctx.getWebSockets().length, wakes: this.wakes, version: this.version,
             bootAt: this.bootAt, awakeMs: now - this.bootAt, msgsThisBoot: this.msgs, now };
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const now = Date.now();
      server.serializeAttachment({ joinedAt: now, tokens: BURST, refilledAt: now });
      server.send(JSON.stringify({ t: 'hello', ...this.stats() }));
      return new Response(null, { status: 101, webSocket: client });
    }
    if (url.pathname === '/vote' && req.method === 'POST') {
      // the production shape: Netlify lands the write, then tells the room
      const v = this.bump();
      const sent = this.broadcast({ t: 'board', v, at: Date.now(), via: 'http' });
      return json({ v, sent });
    }
    if (url.pathname === '/stats') return json(this.stats());
    if (url.pathname === '/reset' && req.method === 'POST') {
      this.sql.exec(`DELETE FROM kv`);
      this.version = 0; this.wakes = 0;
      for (const ws of this.ctx.getWebSockets()) { try { ws.close(1000, 'reset'); } catch {} }
      return json({ ok: true });
    }
    return new Response('not found', { status: 404 });
  }

  async webSocketMessage(ws, raw) {
    this.msgs += 1;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'ping') {
      ws.send(JSON.stringify({ t: 'pong', id: m.id, sentAt: m.sentAt, ...this.stats() }));
      return;
    }
    if (m.t === 'vote') {
      // decision 0030's bucket, per connection, kept in the attachment so it
      // survives hibernation. A refused cast writes nothing and broadcasts nothing.
      const att = ws.deserializeAttachment() || {};
      const now = Date.now();
      const refill = Math.max(0, now - (att.refilledAt ?? now)) / 60000 * PER_MIN;
      let tokens = Math.min(BURST, (att.tokens ?? BURST) + refill);
      if (tokens < 1) {
        ws.serializeAttachment({ ...att, tokens, refilledAt: now });
        ws.send(JSON.stringify({ t: 'refused', id: m.id, tokens }));
        return;
      }
      tokens -= 1;
      ws.serializeAttachment({ ...att, tokens, refilledAt: now });
      const v = this.bump();
      this.broadcast({ t: 'board', v, id: m.id, at: now, via: 'ws' });
    }
  }
  webSocketClose(ws, code, reason) { try { ws.close(code, reason); } catch {} }
  webSocketError() {}

  bump() { this.version += 1; this.setNum('version', this.version); return this.version; }
  broadcast(payload) {
    const s = JSON.stringify(payload);
    let n = 0;
    for (const ws of this.ctx.getWebSockets()) { try { ws.send(s); n++; } catch {} }
    return n;
  }
}
