/* on.js — EVERY ACTION ON EVERY PAGE, WIRED WITHOUT INLINE SCRIPT (SEC-006, decision 0209).
   It rides INSIDE each page, in the script block whose id is on-js, right after the page's
   Content-Security-Policy: tools/stamp.mjs writes it there (as it does app.css), so it costs no
   request, and test/structure.mjs refuses a page whose copy is stale. Nobody edits the copies,
   and this file never contains a closing script tag, which would end the block early.

   Markup never carries code. A control names its action; a page's scripts register what
   may be named, once, at their end:

     <button data-on-click="closeSheet">                        closeSheet()
     <button data-on-click='["setTab","money"]'>                setTab('money')
     <a data-on-click='[["prevent"],["gate",null,"forgot"]]'>   each in turn
     `<button ${ON.click('replyPost', p.id)}>`                  the same, built in a script
     ON.add({ closeSheet, setTab, gate, replyPost });           the last line of that script

   `this` is the element, as it was in an onclick=; the event is ON.event while the action
   runs. What an action returns is ignored, as it was when an onclick= called a function without
   `return`: an old `…;return false` is the step `prevent`, and an action that decides calls
   ON.event.preventDefault() itself. `prevent` and `stop` are built in. A failing action is
   reported like a failing onclick= (the page's error listener hears it) and the steps after
   it do not run.

   The listener sits on the element itself, added the first time an event of its kind passes on
   its way down, so it fires exactly where an onclick= fired: after a capturing listener that
   stops the event (the Studio's swipe tray swallows a tap that way), before the ancestors', and
   on the target alone for focus, blur, load and error. That is what lets each page's policy
   refuse inline script: an injected onclick= runs nothing, and an injected data-on-click can
   only name something a script registered. */
(() => {
  if (window.ON) return;
  /* a current page: the shared scripts' stale-page reload may run again */
  try { sessionStorage.removeItem('myset.onreload'); } catch (e) {}
  const acts = Object.create(null);
  const OWN = ['prevent', 'stop'];
  const escAttr = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tellError = (x) => { try { (window.reportError || ((y) => setTimeout(() => { throw y; })))(x); } catch (y) {} };
  const attr = (type, name, args) => `data-on-${type}="${escAttr(args.length ? JSON.stringify([name, ...args]) : name)}"`;
  const ON = window.ON = {
    event: null,
    add(o) { for (const k of Object.keys(o)) { if (OWN.includes(k)) tellError(new Error(`ON: "${k}" is built in`)); else if (typeof o[k] === 'function') acts[k] = o[k]; } },
    has: (k) => typeof acts[k] === 'function',
    /* The attribute, for markup built in a script: `<button ${ON.click('setTab', 'money')}>`. */
    on: (type, name, ...args) => attr(type, name, args),
    click: (name, ...args) => attr('click', name, args),
  };
  acts.prevent = () => { ON.event.preventDefault(); };
  acts.stop = () => { ON.event.stopPropagation(); };
  function fire(e) {
    const v = this.getAttribute('data-on-' + e.type);
    if (!v) return;
    const was = ON.event;
    ON.event = e;
    try {
      let steps = v.charAt(0) === '[' ? JSON.parse(v) : v;
      if (!Array.isArray(steps)) steps = [[steps]];
      else if (!Array.isArray(steps[0])) steps = [steps];
      for (const [name, ...args] of steps) {
        const f = acts[name];
        if (typeof f !== 'function') throw new Error(`ON: nothing is registered as "${name}"`);
        f.apply(this, args);
      }
    } catch (x) { tellError(x); } finally { ON.event = was; }
  }
  const bind = (e) => {
    const name = 'data-on-' + e.type;
    for (let n = e.target; n && n.nodeType === 1; n = n.parentNode) {
      if (n.hasAttribute(name)) n.addEventListener(e.type, fire);
      if (!e.bubbles) break;
    }
  };
  for (const t of ['click', 'input', 'change', 'submit', 'keydown', 'focus', 'blur', 'error']) document.addEventListener(t, bind, true);
})();
