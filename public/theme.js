/* One theme choice for every MySet page. Markup only needs a
   `data-theme-toggle` button; this file also handles controls added by a render. */
(() => {
  const root = document.documentElement;
  const system = () => matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  if (!root.dataset.theme) root.dataset.theme = system();
  const active = () => root.dataset.theme || system();
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
    let meta = document.querySelector('meta#manualTheme') || document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.id = 'manualTheme';
    meta.content = colour(theme);
  };
  const toggle = () => {
    const next = active() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('myset.theme', next); } catch (_) {}
    sync();
  };
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-theme-toggle]')) toggle();
  });
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
  addEventListener('DOMContentLoaded', sync, { once: true });
  try { matchMedia('(prefers-color-scheme:dark)').addEventListener('change', () => {
    let saved = ''; try { saved = localStorage.getItem('myset.theme') || ''; } catch (_) {}
    if (!saved) { root.dataset.theme = system(); sync(); }
  }); } catch (_) {}
  window.MySetTheme = { active, sync, toggle };
})();
