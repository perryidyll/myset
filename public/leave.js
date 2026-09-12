/* NEVER A WHITE PAGE BETWEEN TWO MYSET PAGES — one implementation, every page.
   © 2026 Perry Idyll.

   THE PROBLEM: a tap on a link tears this page down, and the next one has not
   painted yet. On a phone that gap is a white (or black) flash of nothing, and on
   a slow venue connection it is a second or more of nothing — long enough for a
   person to tap again, or think the app is broken. The Studio solved this for
   itself (goTo in studio.html); this file is the same idea for every other page,
   so the artist page, the vote page and the community page all behave the same.

   WHAT IT DOES: the moment a link to another MySet page is tapped, it paints the
   three-bar MySet logo over the whole screen in the active theme — synchronously,
   inside the click handler, before anything else happens — and only then, once
   the browser has actually put that frame on the glass (two animation frames),
   does it navigate. The next page paints its own splash first thing, so from the
   person's point of view the logo is simply there until the new page is ready.

   WHAT IT LEAVES ALONE: links to other sites (Stripe, Spotify, YouTube), links
   that open a new tab, downloads, files under /api/ (the QR png), and anchors on
   the same page. A link can opt out with data-nosplash, or set its own message
   with data-leaving="Opening the board…".

   window.goTo(url, label) does the same thing for script-driven navigation —
   the page uses it before handing off to Stripe checkout, so that hand-off is not
   a white flash either. Coming back with the back button (bfcache) restores the
   page with the splash still on it, so `pageshow` takes it off again. */
(function () {
  if (window.goTo) return;                  // the Studios have their own
  var CSS = '#msLeave{position:fixed;inset:0;z-index:95;display:none;place-items:center;' +
    'background:var(--bg,#F5F5F7)}' +
    'html[data-theme=dark] #msLeave{background:var(--bg,#0D0B0C)}' +
    '#msLeave.on{display:grid}' +
    '#msLeave .bars{display:flex;align-items:flex-end;gap:9px;height:76px}' +
    '#msLeave .bars i{width:15px;border-radius:8px;display:block;height:18px;transform-origin:bottom;' +
    'background:linear-gradient(135deg,#FF375F,#FF7A45);animation:msLeaveBar 1.05s ease-in-out infinite alternate}' +
    '#msLeave .bars i:nth-child(1){animation-delay:.02s;--h:38px}' +
    '#msLeave .bars i:nth-child(2){animation-delay:.12s;--h:64px}' +
    '#msLeave .bars i:nth-child(3){animation-delay:.22s;--h:28px}' +
    '#msLeave .word{margin-top:20px;font-size:23px;font-weight:700;letter-spacing:-.035em;text-align:center;color:var(--ink,#1D1D1F)}' +
    '#msLeave p{position:absolute;top:calc(50% + 74px);left:0;right:0;text-align:center;' +
    'font-size:13.5px;color:var(--muted,#888);margin:0}' +
    '@keyframes msLeaveBar{from{height:18px}to{height:var(--h,40px)}}' +
    '@media (prefers-reduced-motion:reduce){#msLeave .bars i{animation:none;height:var(--h,40px)}}';

  var el = null, offT = 0;
  function make() {
    if (el) return el;
    var s = document.createElement('style'); s.textContent = CSS;
    document.head.appendChild(s);
    el = document.createElement('div'); el.id = 'msLeave'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div><div class="bars"><i></i><i></i><i></i></div><div class="word">MySet</div></div><p></p>';
    document.body.appendChild(el);
    return el;
  }
  function off() { if (el) el.classList.remove('on'); clearTimeout(offT); }

  window.goTo = function (url, label) {
    var e = make();
    e.querySelector('p').textContent = label || 'Opening…';
    e.classList.add('on');
    /* Two frames: the first commits the style change, the second is the one the
       eye actually sees. Navigating on the first can still leave the old frame up. */
    requestAnimationFrame(function () { requestAnimationFrame(function () { location.href = url; }); });
    clearTimeout(offT);
    offT = setTimeout(off, 8000);            // a navigation that never happened
    return false;
  };

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.hasAttribute('download') || a.dataset.nosplash !== undefined) return;
    if (a.target && a.target !== '_self') return;               // a new tab is its own page
    var u; try { u = new URL(a.getAttribute('href'), location.href); } catch (x) { return; }
    if (u.origin !== location.origin) return;                  // Stripe, Spotify, anywhere else
    if (u.pathname.indexOf('/api/') === 0) return;             // a file, not a page
    if (u.pathname === location.pathname && u.hash) return;    // an anchor on this page
    e.preventDefault();
    window.goTo(u.pathname + u.search + u.hash, a.dataset.leaving || 'Opening…');
  });
  addEventListener('pageshow', off);

  /* ON CHROME, THE NEXT PAGE STARTS DOWNLOADING WHEN THE FINGER LANDS. Speculation
     rules with `moderate` eagerness prefetch a link's page on pointerdown, so by the
     time the tap becomes a click the HTML is usually already here. Other browsers
     ignore the block; nothing under /api/ is ever touched. */
  try {
    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      var sr = document.createElement('script'); sr.type = 'speculationrules';
      sr.textContent = JSON.stringify({ prefetch: [{ where: { and: [{ href_matches: '/*' }, { not: { href_matches: '/api/*' } }] }, eagerness: 'moderate' }] });
      document.head.appendChild(sr);
    }
  } catch (e) {}
})();

/* THE LAST THING YOU SAW, PAINTED FIRST. Each page keeps its most recent good
   answer on the phone and draws it the instant the page opens, then fetches the
   fresh one and redraws only if something changed. Second visits feel like zero
   seconds; the network never gates the first paint. A copy older than a week is
   ignored. Nothing private goes in here that the same phone did not already see. */
window.lastSeen={
  get(k){try{const s=localStorage.getItem('myset.last.'+k);if(!s)return null;const o=JSON.parse(s);return (o&&o.v&&Date.now()-o.t<7*864e5)?o.v:null}catch(e){return null}},
  set(k,v){try{localStorage.setItem('myset.last.'+k,JSON.stringify({t:Date.now(),v}))}catch(e){}}
};
