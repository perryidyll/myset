/* THE SAMPLE LAYER (decision 0101) — what turns an artist's or a venue's real page into
   the private preview the factory sends, and the sheet that makes it theirs.

   Loaded ONLY when this phone was handed a sample's link (the page's <head> finds
   #sample-profile on it and notes the page), so a fan never downloads a byte of it. It changes
   four things on the page and nothing else:
     1. a banner pinned to the very top — SAMPLE PROFILE PAGE – NOT PUBLISHED, one
        line, pink-orange on black in a pink-orange ring
     2. Claim profile, floating just under it, exactly as wide, over nothing: the
        page is pushed down by the height of the two
     3. Share and the Studio menu give way to one button, View your Studio, with the
        light/dark switch to its left
     4. at the foot: where it came from, that it is not published, when it comes
        down, and "don't want it? let us know" — there is no Remove button (the
        founder's call, 2026-09-28): a word to the founder deletes it forever
   Every fan door that would lead nowhere on a page nobody has claimed yet (Book,
   Community, the voting pill) is hidden rather than left to shrug (rule 3).

   The claim sheet is the same three steps every account takes — email, six-digit
   code, password — ending in `claimSample`, and it is shared with both Studios'
   look-only mode, which load this file for it.

   Self-contained like tips.js: its own styles from the page's own tokens, its own
   small modal, nothing that can throw into the page it decorates. */
(function () {
  'use strict';
  if (window.Sample) return;
  const TIPS_V = '/tips.js?v=6dd18982';
  const O = '#FF5650';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const $ = (s, r) => (r || document).querySelector(s);
  const store = {
    get() { try { return JSON.parse(localStorage.getItem('myset.sample') || 'null'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('myset.sample', JSON.stringify(v)); } catch (e) {} },
    clear() { try { localStorage.removeItem('myset.sample'); } catch (e) {} },
  };
  const api = async (path, body) => {
    try {
      const r = await fetch('/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      return await r.json();
    } catch (e) { return { ok: false, offline: true, error: 'Connection hiccup — try again' }; }
  };
  let tipsP = null;
  const tips = () => (window.Tips ? Promise.resolve(window.Tips) : (tipsP ||= new Promise((res) => {
    const s = document.createElement('script'); s.src = TIPS_V; s.onload = () => res(window.Tips || null); s.onerror = () => res(null);
    document.head.appendChild(s);
  })));
  /* the founder's own look (the console opens ?pv=1) counts nothing and pushes nothing */
  const funnel = (what) => { const k = store.get(); if (k && !k.pv) api('sample', { action: 'seen', what, slug: k.slug, key: k.key, kind: k.kind }).catch(() => {}); };

  /* ---------- styles ---------- */
  const CSS = `
.sbx{position:fixed;left:0;right:0;top:0;z-index:48;padding:calc(10px + env(safe-area-inset-top)) 16px 10px;
  background:color-mix(in srgb,var(--bg,#F5F5F7) 88%,transparent);-webkit-backdrop-filter:saturate(180%) blur(18px);backdrop-filter:saturate(180%) blur(18px)}
.sbx-in{max-width:var(--maxw,560px);margin:0 auto;display:grid;gap:8px}
.sbx-ban{display:flex;align-items:center;justify-content:center;height:36px;padding:0 10px;border-radius:12px;background:#000;color:${O};
  box-shadow:inset 0 0 0 1.5px ${O};font:800 clamp(10.5px,3.3vw,13.5px)/1 var(--f,-apple-system,system-ui,sans-serif);letter-spacing:.07em;
  text-transform:uppercase;white-space:nowrap;overflow:hidden}
.sbx-claim{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:48px;border:0;border-radius:14px;cursor:pointer;
  background:${O};color:#fff;font:700 16.5px/1 var(--f,-apple-system,system-ui,sans-serif);letter-spacing:-.01em;
  box-shadow:0 8px 22px rgba(255,86,80,.34);transition:transform .2s cubic-bezier(.34,1.4,.64,1)}
.sbx-claim:active{transform:scale(.97)}
.sbx-claim .d{font-size:12.5px;font-weight:600;opacity:.85}
body.sampled{padding-top:var(--sbh,112px)}
.sbx-studio{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:999px;border:0;cursor:pointer;
  background:var(--surface,#fff);color:${O};font:700 13.5px/1 var(--f,-apple-system,system-ui,sans-serif);box-shadow:inset 0 0 0 1.5px ${O}}
.sbx-note{margin:26px 18px 6px;padding:16px 18px;border-radius:18px;background:var(--surface,#fff);box-shadow:var(--sh-1,0 1px 2px rgba(0,0,0,.05));
  font-size:13.5px;line-height:1.5;color:var(--muted,#6E6E73)}
.sbx-note b{color:var(--ink,#1D1D1F)}
.sbx-gone{padding:56px 26px;text-align:center}
.sbx-gone b{display:block;font-size:20px;color:var(--ink,#1D1D1F);margin-bottom:8px}
.sbx-gone p{color:var(--muted,#6E6E73);margin:0 0 20px}
.sbx-gone a{display:inline-block;padding:13px 22px;border-radius:999px;background:${O};color:#fff;font-weight:700}
/* the claim sheet */
.scl{position:fixed;inset:0;z-index:86;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.5);
  -webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);opacity:0;transition:opacity .25s ease}
.scl.on{opacity:1}
.scl-box{position:relative;width:100%;max-width:440px;max-height:92vh;overflow:auto;border-radius:28px 28px 0 0;
  padding:22px 22px calc(24px + env(safe-area-inset-bottom));background:var(--surface,#fff);color:var(--ink,#1D1D1F);
  box-shadow:0 -10px 50px rgba(0,0,0,.4);transform:translateY(40px);transition:transform .42s cubic-bezier(.34,1.3,.64,1);
  font-family:var(--f,-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif)}
.scl.on .scl-box{transform:none}
@media(min-width:720px){.scl{align-items:center}.scl-box{border-radius:28px}}
.scl-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:0;background:var(--surface-2,#EBEBEF);color:var(--muted,#6E6E73);font-size:14px;cursor:pointer}
.scl-k{font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:${O}}
.scl h3{font-size:27px;font-weight:800;letter-spacing:-.03em;margin:6px 44px 6px 0;line-height:1.1}
.scl p{font-size:15px;line-height:1.45;color:var(--muted,#6E6E73);margin:0 0 16px}
.scl-steps{display:flex;gap:5px;margin:4px 48px 16px 0}.scl-steps i{flex:1;height:4px;border-radius:9px;background:var(--surface-2,#EBEBEF)}
.scl-steps i.on{background:linear-gradient(135deg,#FF375F,#FF6B45)}
.scl input{width:100%;min-height:52px;padding:14px 16px;font-size:17px;border:0;border-radius:14px;box-sizing:border-box;
  background:var(--surface-2,#EBEBEF);color:var(--ink,#1D1D1F);box-shadow:inset 0 0 0 1.5px var(--hair-2,rgba(0,0,0,.12));margin:0 0 10px;font-family:inherit}
.scl input:focus{outline:none;box-shadow:inset 0 0 0 2.5px ${O}}
.scl input.code{letter-spacing:.32em;text-align:center;font-size:26px;font-weight:700}
.scl-go{width:100%;height:54px;border:0;border-radius:999px;cursor:pointer;background:${O};color:#fff;font-weight:700;font-size:17px;line-height:1;font-family:inherit;
  box-shadow:0 8px 22px rgba(255,86,80,.32);margin-top:4px}
.scl-go[disabled]{opacity:.55}
.scl-alt{width:100%;height:46px;border:0;border-radius:999px;background:none;color:var(--muted,#6E6E73);font-weight:600;font-size:14.5px;line-height:1;font-family:inherit;cursor:pointer;margin-top:6px}
.scl-err{color:#E0322C;font-size:14px;font-weight:600;min-height:20px;margin:2px 0 8px}
.scl-fine{font-size:12.5px;color:var(--muted,#6E6E73);text-align:center;margin:12px 0 0}
.scl-yay{font-size:56px;text-align:center;margin:8px 0 2px;animation:scl-pop .6s cubic-bezier(.3,1.5,.6,1)}
@keyframes scl-pop{from{transform:scale(0)}to{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.scl,.scl-box{transition:none}.scl-yay{animation:none}}
`;
  let styled = false;
  const style = () => { if (styled) return; styled = true; const s = document.createElement('style'); s.id = 'sbx-css'; s.textContent = CSS; document.head.appendChild(s); };

  /* ---------- the claim sheet ---------- */
  let SHEET = null;
  function claim(opts = {}) {
    style();
    const k = store.get();
    if (!k || !k.key) return;
    funnel('claimStart');
    const venue = k.kind === 'venue';
    const door = venue ? 'venueauth' : 'auth';
    const name = opts.name || k.name || '';
    if (SHEET) SHEET.remove();
    const el = document.createElement('div'); el.className = 'scl'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Claim this page'); el.setAttribute('data-nopull', '');
    el.innerHTML = '<div class="scl-box"><button class="scl-x" type="button" aria-label="Close">✕</button><div class="scl-body"></div></div>';
    document.body.appendChild(el); SHEET = el;
    const body = el.querySelector('.scl-body');
    const close = () => { el.classList.remove('on'); setTimeout(() => { el.remove(); if (SHEET === el) SHEET = null; }, 260); };
    el.querySelector('.scl-x').addEventListener('click', close);
    el.addEventListener('click', (e) => { if (e.target === el) close(); });
    let email = '', ticket = '';
    const steps = (n) => `<div class="scl-steps">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</div>`;
    const busy = (b, on, label) => { if (b) { b.disabled = on; if (label) b.textContent = label; } };
    const enter = (inp, fn) => inp && inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') fn(); });

    function stepEmail(err) {
      body.innerHTML = `${steps(1)}<div class="scl-k">Claim profile</div><h3>Make it yours</h3>
        <p>${name ? `<b style="color:var(--ink,#1D1D1F)">${esc(name)}</b> becomes your page. ` : ''}It’s free, on the Hobbyist plan, and everything here stays. Change anything, any time.</p>
        <input id="sclEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" value="${esc(email)}">
        <div class="scl-err">${esc(err || '')}</div>
        <button class="scl-go" type="button">Email me a code</button>
        <p class="scl-fine">A 6-digit code proves the address is yours.</p>`;
      const inp = $('#sclEmail', body), go = $('.scl-go', body);
      const send = async () => {
        email = (inp.value || '').trim();
        if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) { $('.scl-err', body).textContent = 'That doesn’t look like an email address'; return; }
        busy(go, true, 'Sending…');
        const d = await api(door, { action: 'start', email });
        if (!d.ok) { busy(go, false, 'Email me a code'); $('.scl-err', body).textContent = d.error || 'Couldn’t send that'; return; }
        stepCode();
      };
      go.addEventListener('click', send); enter(inp, send);
      setTimeout(() => inp.focus(), 250);
    }
    function stepCode(err) {
      body.innerHTML = `${steps(2)}<div class="scl-k">Claim profile</div><h3>Check your email</h3>
        <p>We sent a 6-digit code to <b style="color:var(--ink,#1D1D1F)">${esc(email)}</b>. It works for ten minutes.</p>
        <input id="sclCode" class="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="000000">
        <div class="scl-err">${esc(err || '')}</div>
        <button class="scl-go" type="button">Continue</button>
        <button class="scl-alt" type="button">← Use a different email</button>`;
      const inp = $('#sclCode', body), go = $('.scl-go', body);
      const check = async () => {
        const code = (inp.value || '').replace(/\D/g, '');
        if (code.length !== 6) { $('.scl-err', body).textContent = 'The code is 6 digits'; return; }
        busy(go, true, 'Checking…');
        const d = await api(door, { action: 'verify', email, code });
        if (!d.ok) { busy(go, false, 'Continue'); $('.scl-err', body).textContent = d.error || 'Check the code and try again'; return; }
        if (d.ticket) { ticket = d.ticket; return stepPassword(); }
        /* That inbox already runs a MySet page: it has just been proved, so it is safe
           to say so. The sample stays unclaimed; the founder is told (via `seen`). */
        stepTaken(d);
      };
      go.addEventListener('click', check); enter(inp, check);
      inp.addEventListener('input', () => { if (inp.value.replace(/\D/g, '').length === 6) check(); });
      $('.scl-alt', body).addEventListener('click', () => stepEmail());
      setTimeout(() => inp.focus(), 200);
    }
    function stepPassword(err) {
      body.innerHTML = `${steps(3)}<div class="scl-k">Claim profile</div><h3>Pick a password</h3>
        <p>Next time it’s just your email and this. At least 8 characters.</p>
        <input id="sclPw" type="password" autocomplete="new-password" placeholder="Password">
        <input id="sclPw2" type="password" autocomplete="new-password" placeholder="Again">
        <div class="scl-err">${esc(err || '')}</div>
        <button class="scl-go" type="button">Claim my page</button>
        <p style="font-size:12px;margin:10px 0 0;opacity:.72">By claiming it you agree to MySet’s <a href="/terms" target="_blank" rel="noopener" style="color:inherit">terms</a> and <a href="/privacy" target="_blank" rel="noopener" style="color:inherit">privacy notice</a>.</p>`;
      const a = $('#sclPw', body), b = $('#sclPw2', body), go = $('.scl-go', body);
      const done = async () => {
        if ((a.value || '').length < 8) { $('.scl-err', body).textContent = 'At least 8 characters'; return; }
        if (a.value !== b.value) { $('.scl-err', body).textContent = 'Those don’t match'; return; }
        busy(go, true, 'Claiming…');
        const d = await api(door, { action: 'claimSample', ticket, slug: k.slug, key: k.key, password: a.value, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '') });
        if (!d.ok) { busy(go, false, 'Claim my page'); $('.scl-err', body).textContent = d.error || 'Couldn’t claim that'; return; }
        try {
          if (venue) { localStorage.setItem('myset.vtoken', d.token); localStorage.setItem('myset.vtipsauto', '1'); }
          else {
            localStorage.setItem('myset.token', d.token); localStorage.removeItem('myset.admin');
            localStorage.setItem('myset.slug', d.slug);
            /* the first-run picks up at the songs: the name is already done */
            localStorage.setItem('myset.firstrun', (d.artistId || '') + ':2');
            localStorage.setItem('myset.tipsauto', '1');
          }
        } catch (e) {}
        store.clear();
        stepYay(d);
      };
      go.addEventListener('click', done); enter(b, done);
      setTimeout(() => a.focus(), 200);
    }
    function stepYay(d) {
      body.innerHTML = `<div class="scl-yay">🎉</div><h3 style="text-align:center;margin-right:0">It’s yours</h3>
        <p style="text-align:center">myset.vip/${venue ? 'v/' : ''}${esc(d.slug)} is live. Let’s set up your first night.</p>
        <button class="scl-go" type="button">Open my Studio</button>`;
      $('.scl-go', body).addEventListener('click', () => { location.href = venue ? '/venues' : '/studio'; });
      if (typeof opts.onClaimed === 'function') { try { opts.onClaimed(d); } catch (e) {} }
    }
    function stepTaken() {
      funnel('clash');
      body.innerHTML = `<div class="scl-k">Claim profile</div><h3>You already have a page</h3>
        <p>${esc(email)} already runs a MySet ${venue ? 'venue page' : 'page'}. Use a different email to claim this one, or open the page you have. We’ve let the MySet team know, so they can merge the two.</p>
        <button class="scl-go" type="button">Use a different email</button>
        <button class="scl-alt" type="button">Open my Studio</button>`;
      $('.scl-go', body).addEventListener('click', () => { email = ''; stepEmail(); });
      $('.scl-alt', body).addEventListener('click', () => { location.href = venue ? '/venues' : '/studio'; });
    }
    stepEmail();
    requestAnimationFrame(() => el.classList.add('on'));
  }

  /* ---------- the page ---------- */
  function days(n) { return n === 1 ? '1 day' : `${n} days`; }
  function words(list) { return list.length <= 1 ? (list[0] || 'public pages') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`; }

  function page(P) {
    try {
      style();
      const S = (P && P.sample) || null;
      const k = store.get();
      if (!S || !k) return gone();
      const venue = S.kind === 'venue';
      document.body.classList.add('sampled');
      const bar = document.createElement('div');
      bar.className = 'sbx';
      bar.innerHTML = `<div class="sbx-in"><div class="sbx-ban" role="note">Sample profile page – not published</div>
        <button class="sbx-claim" type="button">Claim profile <span class="d">· ${esc(days(S.days))} left</span></button></div>`;
      document.body.appendChild(bar);
      const fit = () => document.body.style.setProperty('--sbh', `${bar.offsetHeight + 6}px`);
      fit(); addEventListener('resize', fit);
      bar.querySelector('.sbx-claim').addEventListener('click', () => claim({ name: S.name }));

      /* the header: the switch, then one button */
      const acts = $('.baractions');
      if (acts) {
        acts.querySelectorAll('#shareBtn, details.menu, .sharebtn').forEach((x) => { x.style.display = 'none'; });
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'sbx-studio'; b.innerHTML = 'View your Studio <span aria-hidden="true">→</span>';
        b.addEventListener('click', () => { location.href = venue ? `/venues?sample=${encodeURIComponent(S.slug)}` : `/studio?sample=${encodeURIComponent(S.slug)}`; });
        acts.appendChild(b);
      }
      decorate(P);
      new MutationObserver(() => decorate(P)).observe($('#app') || document.body, { childList: true });

      /* the welcome, every time the link itself is opened (the founder's call); a
         visit without the label (the stored key, a tap on the logo) does not repeat it */
      const viaLink = /[#?&]sample-profile(?![\w-])/.test(location.hash + '&' + location.search);
      tips().then((T) => { if (T) T[viaLink ? 'open' : 'first'](venue ? 'v-welcome' : 'welcome', { scope: 'sample-' + S.slug,
        /* "Hey Tide Lines", not "Hey The Tide Lines": a band is greeted the way people say its name */
        vars: { first: String(S.first || S.name).replace(/^the\s+/i, ''), days: days(S.days), sources: words((S.sources || []).map((x) => x.label)) },   // tips.js escapes the whole line
        cta: { label: 'Show me' } }); });
    } catch (e) {}
  }
  /* The page redraws itself (a pull, a late answer), so the hiding and the note are
     re-applied after every redraw of #app. Idempotent. */
  function decorate(P) {
    const S = P.sample;
    const app = $('#app'); if (!app) return;
    app.querySelectorAll('.pacts, .fab, #joinBtn, .rsvpcol, .tourbtn, .calbtn, .vshare, .playcard, .vunv, .vbadge.no').forEach((x) => { x.style.display = 'none'; });
    if (app.querySelector('.sbx-note')) return;
    const until = new Date(Number(S.exp) || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
    const note = document.createElement('div');
    note.className = 'sbx-note';
    note.innerHTML = `<b>A preview, made for you by MySet</b> from your public ${esc(words((S.sources || []).map((x) => x.label)))}. It isn’t published: only your link opens it, and search engines can’t see it. It comes down on <b>${esc(until)}</b> unless you claim it; we keep a private copy for up to six months in case you want it back. <b>Don’t want it?</b> Let us know, with a reply to the message that brought you here, and we’ll delete this preview forever – no harm, no foul!`;
    app.appendChild(note);
  }
  /* The link no longer opens a preview: claimed (perhaps on another device), deleted,
     or its thirty days ran out. Forget it, and if the page is public now — it was
     claimed — go to it, at the bare address: the label would ask for the preview
     again, and again. */
  async function gone() {
    style();
    const k = store.get();
    store.clear();
    if (k && k.slug) {
      try {
        const r = await fetch(k.kind === 'venue' ? `/api/fan?what=venue&v=${encodeURIComponent(k.slug)}` : `/api/fan?what=profile&a=${encodeURIComponent(k.slug)}`, { cache: 'no-store' });
        if (r.ok) { location.replace(location.pathname); return; }
      } catch (e) {}
    }
    const app = $('#app');
    if (app) app.innerHTML = `<div class="sbx-gone"><b>This preview isn’t available any more</b><p>It was deleted, or its 30 days ran out.</p><a href="/">Find live music on MySet</a></div>`;
  }

  window.Sample = { store, claim, page, gone, funnel, tips };
})();
