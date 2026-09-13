/* One theme choice for every MySet page. Markup only needs a
   `data-theme-toggle` button; this file also handles controls added by a render. */
(() => {
  const root = document.documentElement;
  const fallback = () => 'light';
  if (!root.dataset.theme) root.dataset.theme = fallback();
  const active = () => root.dataset.theme || fallback();
  const colour = (theme) => theme === 'light' ? '#F5F5F7' : '#000000';
  const sync = () => {
    const theme = active(), dark = theme === 'dark';
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const icon = dark ? '☀︎' : '☾';
      if (button.textContent !== icon) button.textContent = icon;
      const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
      button.setAttribute('aria-label', label);
      button.title = label;
    });
    /* THE BAND BEHIND THE STATUS BAR. On a phone that opened MySet from its home
       screen, iOS paints the strip under the clock from the page's theme-color —
       and reads it when the page LOADS. Changing the meta's `content` in place is
       noticed by Safari's own tab bar but not, reliably, by the standalone status
       bar, which kept the old colour until the next page (the founder's screenshot,
       2026-09-13: a light band over a dark Studio). So the meta is REPLACED — a new
       element is a new declaration, which is what a load would have handed iOS —
       in the colour the root actually has, so the strip is right whichever of the
       two iOS is reading. Rewritten only when the colour actually changes: sync()
       runs on every DOM mutation. The colour is the page's OWN root background
       where it has one (the artist page's dark is a warm near-black, not #000), so
       the band matches the page rather than a table here. */
    let want = '';
    try { want = getComputedStyle(root).backgroundColor || ''; } catch (_) {}
    if (!want || want === 'transparent' || want === 'rgba(0, 0, 0, 0)') want = colour(theme);
    let meta = document.querySelector('meta#manualTheme') || document.querySelector('meta[name="theme-color"]');
    if (!meta || meta.content !== want) {
      const fresh = document.createElement('meta');
      fresh.name = 'theme-color'; fresh.id = 'manualTheme'; fresh.content = want;
      if (meta) meta.replaceWith(fresh); else document.head.appendChild(fresh);
    }
  };
  const toggle = () => {
    const next = active() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('myset.theme', next); } catch (_) {}
    sync();
    /* A one-pixel nudge of the scroll position, put straight back: iOS re-samples
       the colour behind the status bar on scroll, and this is the cheapest scroll
       there is. Nothing visible moves. */
    requestAnimationFrame(() => { const y = scrollY; scrollTo(0, y + 1); scrollTo(0, y); });
    /* AND, FROM THE HOME SCREEN, A RELOAD. The founder's phone (2026-09-13, twice):
       a MySet opened from its icon keeps the band under the clock in the OLD colour
       after the toggle — the replaced meta above made a refresh fix it where before
       only a new page did, but the toggle itself still does not. iOS reads the
       colour for a standalone app when the page loads and at no other time we can
       find, so the toggle finishes with the one thing that is known to work. Only
       standalone (`navigator.standalone` is iOS's own flag; Safari's tab bar
       follows the meta live and needs no reload); the choice is already in
       localStorage and the <head> script applies it as the page parses, so the
       reload lands in the new theme with no flash. Deferred a beat so the tap's
       own paint lands first. */
    if (navigator.standalone === true) setTimeout(() => location.reload(), 60);
  };
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-theme-toggle]')) toggle();
  });
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', sync, { once: true });
  /* THE CHOICE IS GLOBAL, AND THE BACK BUTTON MUST NOT UNDO IT. The inline <head>
     script reads localStorage once, while the page is parsed. A page restored
     from the back-forward cache is not parsed again — it comes back exactly as it
     was left, in whatever theme it had, while the page in front of it may have
     been switched since. So the stored choice is re-applied whenever this page is
     shown again (pageshow fires for a bfcache restore with `persisted` true), when
     another tab changes it (storage), and when the app comes back to the
     foreground. Nothing here writes; it only follows what was chosen. */
  const follow = () => {
    let stored = '';
    try { stored = localStorage.getItem('myset.theme') || ''; } catch (_) {}
    const want = stored === 'dark' || stored === 'light' ? stored : fallback();
    if (root.dataset.theme !== want) root.dataset.theme = want;
    sync();
  };
  addEventListener('pageshow', follow);
  addEventListener('storage', (event) => { if (!event.key || event.key === 'myset.theme') follow(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) follow(); });
  window.MySetTheme = { active, sync, toggle };
})();
