/* SEC-006 (decision 0209): no page runs code it does not carry.

   Every page in public/ carries its own script policy — a <meta> naming each inline block by
   hash — and wires its buttons through public/on.js (data-on-*, registered with ON.add), never
   through an on*= attribute: under the policy an onclick= does nothing, so one that slipped
   back in would be a dead button in a bar. This file holds that line:

     · no on*= handler, setAttribute('on…'), javascript: link or string eval anywhere in public/;
     · every page's policy and its on.js copy are what tools/stamp.mjs would write now;
     · every action a page can fire is registered on that page, and every shorthand
       registration is a function declaration (it exists before ON.add runs);
     · on.js itself: the listener sits on the element, fires once, runs a sequence in order,
       knows prevent and stop, reports an unknown name and a throwing action like an onclick=;
     · the founder's function-served pages send a header that names their own inline blocks. */
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { withPolicy } from '../tools/stamp.mjs';
import { inlineScripts, hashOf } from '../netlify/functions/_csp.mjs';

let fail = 0;
const ok = (label, cond, more = '') => { if (cond) console.log(`  ✓ ${label}`); else { fail++; console.log(`  ✗ ${label}${more ? ' — ' + more : ''}`); } };
const PUB = new URL('../public/', import.meta.url);
const read = (f) => readFileSync(new URL(f, PUB), 'utf8');
const PAGES = readdirSync(PUB).filter((f) => f.endsWith('.html')).sort();
const SCRIPTS = readdirSync(PUB).filter((f) => f.endsWith('.js') && f !== 'sw.js').sort();

console.log('\nNO CODE IN AN ATTRIBUTE, ANYWHERE IN public/');
const EVENTS = 'abort|animationend|animationiteration|animationstart|auxclick|beforeinput|beforeunload|blur|cancel|canplay|canplaythrough|change|click|close|contextmenu|copy|cut|dblclick|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|durationchange|emptied|ended|error|focus|focusin|focusout|hashchange|input|invalid|keydown|keypress|keyup|load|loadeddata|loadedmetadata|loadstart|message|mousedown|mouseenter|mouseleave|mousemove|mouseout|mouseover|mouseup|paste|pause|play|playing|pointercancel|pointerdown|pointerenter|pointerleave|pointermove|pointerout|pointerover|pointerup|popstate|progress|ratechange|reset|resize|scroll|search|seeked|seeking|select|stalled|submit|suspend|timeupdate|toggle|touchcancel|touchend|touchmove|touchstart|transitionend|unload|volumechange|waiting|wheel';
/* an attribute that holds code: on<event>= then a quote (plain, escaped or a template's), a ${…},
   or an unquoted value — not prose like "an onclick= runs nothing" in a comment */
const HANDLER = new RegExp(`(?<![\\w.$-])on(?:${EVENTS})=(?:\\s*["'\\\\\`$]|[A-Za-z_])`, 'g');
for (const f of [...PAGES, ...SCRIPTS]) {
  const s = read(f);
  const hits = [...s.matchAll(HANDLER)].map((m) => `line ${s.slice(0, m.index).split('\n').length}: ${s.slice(m.index, m.index + 40).replace(/\s+/g, ' ')}`);
  const set = s.match(/setAttribute\(\s*['"`]on/g) || [];
  const jsurl = s.match(/(?:href|src|action)\s*=\s*\\?["'`]?\s*javascript:/gi) || [];
  const evals = s.match(/(?<![\w.$])eval\(|new Function\(|set(?:Timeout|Interval)\(\s*['"`]/g) || [];
  ok(`${f}: no on*= handler, setAttribute('on…'), javascript: link or string eval`, !hits.length && !set.length && !jsurl.length && !evals.length,
    [...hits.slice(0, 3), ...set, ...jsurl, ...evals].join('; '));
}

console.log('\nEVERY PAGE CARRIES ITS OWN POLICY AND THE CURRENT on.js (run node tools/stamp.mjs after any edit)');
const ONJS = read('on.js'), LEAVE = read('leave.js');
ok('on.js never contains a closing script tag', !/<\/script/i.test(ONJS));
for (const page of PAGES) {
  const html = read(page);
  ok(`${page}: policy and on.js are what stamp.mjs writes`, withPolicy(html, ONJS, LEAVE) === html);
  const head = html.slice(0, html.search(/<script/i));
  const meta = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/) || [])[1] || '';
  ok(`${page}: the policy comes before every script and names a hash for each inline block`,
    /Content-Security-Policy/.test(head) && inlineScripts(html).every((t) => meta.includes(hashOf(t))) && !/unsafe-eval/.test(meta));
}

console.log('\nEVERY ACTION A PAGE CAN FIRE IS REGISTERED ON THAT PAGE');
/* The names a text can fire: data-on-*="name", data-on-*='["name",…]' / '[["a"],["b"]]', and
   the first string (or each step's first string, or either side of a ?:) of ON.click( / ON.on('x', */
function fired(text) {
  const out = new Set();
  for (const m of text.matchAll(/data-on-[a-z]+=\\?["']([A-Za-z_$][\w$]*)\\?["']/g)) out.add(m[1]);
  for (const m of text.matchAll(/data-on-[a-z]+='(\[[^']*\])'/g)) { let v; try { v = JSON.parse(m[1]); } catch { continue; } for (const st of Array.isArray(v[0]) ? v : [v]) out.add(st[0]); }
  for (const m of text.matchAll(/ON\.(?:click\(|on\(\s*'[a-z]+'\s*,)\s*/g)) {
    const rest = text.slice(m.index + m[0].length, m.index + m[0].length + 400);
    if (rest[0] === '[') { for (const s of rest.matchAll(/(?:^|\]\s*,\s*)\[\s*'([\w$]+)'/g)) out.add(s[1]); }
    else if (rest[0] === "'") out.add(rest.match(/^'([\w$]+)'/)[1]);
    else { const t = rest.match(/^[^,()]*\?\s*'([\w$]+)'\s*:\s*'([\w$]+)'/); if (t) { out.add(t[1]); out.add(t[2]); } }
  }
  out.delete('prevent'); out.delete('stop');
  return out;
}
/* The names an ON.add({...}) registers, and whether each shorthand one is a function declaration. */
function registered(text) {
  const names = new Map();
  for (const m of text.matchAll(/ON\.add\(\{/g)) {
    let i = m.index + m[0].length, depth = 1, body = '';
    while (i < text.length && depth) { const c = text[i++]; if ('{(['.includes(c)) depth++; else if ('})]'.includes(c)) depth--; if (depth) body += c; }
    let part = '', d = 0;
    const parts = [];
    for (const c of body) { if ('{(['.includes(c)) d++; if ('})]'.includes(c)) d--; if (c === ',' && !d) { parts.push(part); part = ''; } else part += c; }
    parts.push(part);
    for (const p of parts.map((x) => x.trim()).filter(Boolean)) {
      const mm = p.match(/^([\w$]+)\s*(:)?/);
      if (mm) names.set(mm[1], mm[2] ? 'wrapper' : 'shorthand');
    }
  }
  return names;
}
const declared = (text, n) => new RegExp(`(?:^|[^\\w$.])(?:async\\s+)?function\\s+${n.replace(/\$/g, '\\$')}\\s*\\(`).test(text);
const DYNAMIC = { 'studio.html': ['studio-money.js', 'biz.js', 'sample.js'], 'venue-studio.html': ['sample.js'] };
const ONBLOCK = /<script id="on-js">[\s\S]*?<\/script>/;   // the listener's own text names no action
for (const page of PAGES) {
  const html = read(page).replace(ONBLOCK, '');
  const texts = [html];
  for (const m of html.matchAll(/<script[^>]*\ssrc="\/([\w.-]+\.js)(?:\?v=[0-9a-f]+)?"/g)) texts.push(read(m[1]));
  for (const f of DYNAMIC[page] || []) texts.push(read(f));
  const used = new Set(), reg = new Map();
  let notDecl = [];
  for (const t of texts) {
    for (const n of fired(t)) used.add(n);
    for (const [n, how] of registered(t)) { reg.set(n, how); if (how === 'shorthand' && !declared(t, n)) notDecl.push(n); }
  }
  const missing = [...used].filter((n) => !reg.has(n));
  if (used.size || reg.size) {
    ok(`${page}: all ${used.size} action(s) it can fire are registered`, !missing.length, 'not registered: ' + missing.join(', '));
    ok(`${page}: every shorthand registration is a function declaration in its own script`, !notDecl.length, notDecl.join(', '));
  }
}

console.log('\nTHE LISTENER ITSELF (public/on.js, on a hand-made DOM)');
{
  /* Just enough DOM to run on.js: elements with attributes, a parent chain, and listeners
     stored per type. dispatch() walks the way a browser does — capture on document, then
     the target and each ancestor (bubbling), stopping where stopPropagation says. */
  const docL = {};
  const document = { nodeType: 9, addEventListener: (t, f, cap) => { (docL[t] = docL[t] || []).push(f); } };
  const el = (attrs = {}, parent = document) => ({
    nodeType: 1, parentNode: parent, attrs: { ...attrs }, L: {},
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, hasAttribute(k) { return k in this.attrs; },
    addEventListener(t, f) { const a = (this.L[t] = this.L[t] || []); if (!a.includes(f)) a.push(f); },
  });
  const errors = [];
  const win = { document, reportError: (x) => errors.push(String(x && x.message || x)), JSON, Object, Array, String, Error, setTimeout };
  win.window = win;
  vm.runInNewContext(ONJS, win);
  const ON = win.ON;
  const dispatch = (target, type, bubbles = true) => {
    const e = { type, target, bubbles, defaultPrevented: false, cancelBubble: false,
      preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.cancelBubble = true; } };
    for (const f of docL[type] || []) f(e);
    for (let n = target; n && n.nodeType === 1 && !e.cancelBubble; n = bubbles ? n.parentNode : null) for (const f of [...(n.L[type] || [])]) f.call(n, e);
    return e;
  };
  const log = [];
  ON.add({ a(x) { log.push(['a', x, this.attrs.id]); }, b() { log.push(['b']); }, boom() { throw new Error('boom'); }, ev() { log.push(['ev', ON.event && ON.event.type]); } });
  const outer = el({ id: 'outer', 'data-on-click': 'b' });
  const btn = el({ id: 'btn', 'data-on-click': '["a",7]' }, outer);
  dispatch(btn, 'click');
  ok('a click runs the target\'s action with its arguments and `this`, then the ancestor\'s', JSON.stringify(log) === JSON.stringify([['a', 7, 'btn'], ['b']]), JSON.stringify(log));
  log.length = 0; dispatch(btn, 'click');
  ok('a second click runs each action once (the listener is added once)', log.length === 2, JSON.stringify(log));
  const seq = el({ 'data-on-click': '[["prevent"],["a","x"],["stop"]]' }, outer);
  log.length = 0; const e1 = dispatch(seq, 'click');
  ok('a sequence runs in order; prevent and stop are built in', JSON.stringify(log) === JSON.stringify([['a', 'x', undefined]]) && e1.defaultPrevented && e1.cancelBubble, JSON.stringify(log));
  log.length = 0; errors.length = 0;
  const bad = el({ 'data-on-click': '[["boom"],["b"]]' }, outer);
  dispatch(bad, 'click');
  ok('a throwing action is reported, the steps after it do not run, the ancestor still runs', errors.join() === 'boom' && JSON.stringify(log) === JSON.stringify([['b']]), errors.join() + ' ' + JSON.stringify(log));
  errors.length = 0;
  dispatch(el({ 'data-on-click': 'nope' }, document), 'click');
  ok('an unknown action is reported by name', /nothing is registered as "nope"/.test(errors.join()), errors.join());
  log.length = 0;
  const img = el({ 'data-on-error': 'ev' }, outer);
  outer.attrs['data-on-error'] = 'b';
  dispatch(img, 'error', false);
  ok('an event that does not bubble fires on its target only, and ON.event is the event', JSON.stringify(log) === JSON.stringify([['ev', 'error']]) && ON.event === null, JSON.stringify(log));
  errors.length = 0; ON.add({ prevent() {} });
  ok('prevent and stop cannot be replaced', /built in/.test(errors.join()));
  ok('ON.click builds an escaped attribute', ON.click('a', `x"<'&`) === 'data-on-click="[&quot;a&quot;,&quot;x\\&quot;&lt;&#39;&amp;&quot;]"' && ON.click('b') === 'data-on-click="b"' && ON.on('input', 'b') === 'data-on-input="b"', ON.click('a', `x"<'&`));
}

console.log('\nTHE FOUNDER\'S FUNCTION-SERVED PAGES NAME THEIR OWN SCRIPTS');
{
  const { gatePage, cspFor } = await import('../netlify/functions/_passgate.mjs');
  const { lockPage } = await import('../netlify/functions/_showlock.mjs');
  const fin = (f) => readFileSync(new URL(`../finance/${f}`, import.meta.url), 'utf8');
  const pages = { 'the door': gatePage({}), 'the door, shut': gatePage({ locked: Date.now() + 9e5 }), 'the Show log lock': lockPage({ ready: true }), 'the money model': fin('model.html'), 'the Show log': fin('shows.html') };
  for (const [what, html] of Object.entries(pages)) {
    const csp = cspFor(html);
    const scripts = inlineScripts(html);
    ok(`${what}: no on*= handler, and its header names each of its ${scripts.length} inline block(s)`, !HANDLER.test(html) && scripts.length > 0 && scripts.every((t) => csp.includes(hashOf(t))) && /object-src 'none'/.test(csp));
    HANDLER.lastIndex = 0;
  }
}

if (fail) { console.log(`\n${fail} script-policy check(s) FAILED`); process.exit(1); }
console.log('\nscript policy OK');
