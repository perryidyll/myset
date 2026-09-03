/* PULL TO REFRESH — one implementation, every page.
   © 2026 Perry Idyll.

   THE PROBLEM, in Perry's words: "drag down to refresh doesn't work on a web app."
   He is right, and it is worse than it sounds. Installed to an iPhone's home
   screen, MySet has no address bar, no reload button and no swipe-down gesture —
   so a page showing something stale has no way out except force-quitting the app.
   In a browser tab the gesture exists; in the thing we ask artists to install, it
   does not.

   `vote.html` grew its own version of this when the audience poll settled to 25
   seconds. This file is that code, lifted out and used by all seven pages, so
   there is ONE pull-to-refresh in MySet rather than seven that drift. vote.html's
   copy is deleted, not left beside it — a migration that leaves the old call site
   in place is the half-finished refactor this project keeps getting bitten by.

   WHAT IT CANNOT DO, said plainly because it matters: this is JavaScript, so it
   cannot rescue a page whose JavaScript is broken — the exact case where somebody
   most wants a reload. That is what the "Reload MySet" button in the Studio's
   settings is for, and why the service worker serves navigations network-first
   (see sw.js rule 2): any navigation gets the newest page.

   The browser's own gesture is deliberately NOT suppressed. Setting
   `overscroll-behavior-y: contain` would stop Chrome's native pull-to-refresh
   double-firing with this one — and would also mean that if this script fails to
   load, the page has no refresh gesture at all. On Android the two can both fire
   and the page simply reloads, which is what the person asked for anyway. Losing
   the browser's own is not worth a tidier animation. */
(function () {
  var CSS = '#msPull{position:fixed;top:0;left:50%;margin-left:-19px;width:38px;height:38px;' +
    'z-index:60;display:grid;place-items:center;border-radius:50%;transform:translateY(-60px);' +
    'background:var(--surface,#fff);box-shadow:0 4px 16px rgba(0,0,0,.28);pointer-events:none}' +
    '#msPull i{width:15px;height:15px;border-radius:50%;border:2px solid var(--muted,#888);' +
    'border-top-color:var(--accent,#FF375F);display:block;opacity:.65;transition:opacity .15s}' +
    '#msPull.ready i{opacity:1;transform:rotate(180deg)}' +
    '#msPull.spinning{transition:transform .2s ease}' +
    '#msPull.spinning i{opacity:1;animation:msPullSpin .7s linear infinite}' +
    '@keyframes msPullSpin{to{transform:rotate(360deg)}}' +
    '@media (prefers-reduced-motion:reduce){#msPull.spinning i{animation:none}}';

  var el = null, wired = false;
  /* What a pull actually does. Default is a real reload, which is right for every
     page that is just content; the app pages replace it with their own loader so a
     pull refreshes the data without the white flash of a navigation. */
  var job = function () { location.reload(); return new Promise(function () {}); };

  function node() {
    if (el) return el;
    var st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    el = document.createElement('div');
    el.id = 'msPull';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i></i>';
    document.body.appendChild(el);
    return el;
  }

  function wire() {
    if (wired) return;
    wired = true;
    var e0 = node();
    var y0 = null, armed = false, going = false;
    var set = function (px, cls) { e0.style.transform = 'translateY(' + px + 'px)'; e0.className = cls || ''; };

    /* Only ever arms within 2px of the top of the page, so it can never fight a
       normal scroll, and every listener is passive so it cannot make scrolling
       janky on a cheap phone in a dark bar. */
    addEventListener('touchstart', function (e) {
      if (going || window.scrollY > 2 || e.touches.length !== 1) { y0 = null; return; }
      y0 = e.touches[0].clientY; armed = false;
    }, { passive: true });

    addEventListener('touchmove', function (e) {
      if (y0 === null) return;
      var dy = e.touches[0].clientY - y0;
      if (dy <= 0) { set(-60); return; }
      var pull = Math.min(dy * 0.5, 86);       // half-speed: a pull, not a drag
      armed = pull >= 56;
      set(pull - 60, armed ? 'ready' : '');
    }, { passive: true });

    addEventListener('touchend', function () {
      if (y0 === null) return;
      y0 = null;
      if (!armed) { set(-60); return; }
      going = true; set(26, 'spinning');
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (x) {} }
      Promise.resolve().then(job).catch(function () {}).then(function () {
        setTimeout(function () { set(-60); going = false; }, 240);
      });
    }, { passive: true });
  }

  /* MySetPull(fn) — say what a pull should do, and switch it on.
     MySetPull()   — switch it on with the default, a plain reload. */
  window.MySetPull = function (fn) {
    if (typeof fn === 'function') job = fn;
    if (document.body) wire();
    else addEventListener('DOMContentLoaded', wire);
  };
})();
