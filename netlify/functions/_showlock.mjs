import { createHmac, timingSafeEqual } from 'node:crypto';
import { authSecret, signingKeys } from './_auth.mjs';
import * as L from './_hqlock.mjs';

/* THE SHOW LOG'S LOCK (decision 0130). The founder, 2026-09-30: the money model needs
   no passcode, "but the shows log, that definitely needs one — build it the exact same
   way and style as the crm passcode". So it is the CRM's door, not the old courtesy
   code (_passgate.mjs, whose fallback sits in this public repository):
   · The SAME passcode as the CRM (HQ_PASSCODE, a salted scrypt hash, checked here on
     the server by _hqlock.mjs). While that is unset — a deploy preview — the Show log
     stays shut, exactly like the CRM.
   · Its OWN count of wrong tries (`showlock`, LOCK_TRIES in a row shuts it for
     LOCK_MINUTES), so a guesser here does not lock the founder out of the CRM, and the
     founder's phone hears when it shuts.
   · Answers a right passcode with `slk`, HttpOnly, SameSite=Strict, good for
     UNLOCK_HOURS, signed with the site's auth secret and bound to the passcode, so a
     new CRM passcode locks every open Show log too. Scoped to /moneymodel: a cookie
     path of /moneymodel/shows would not reach /moneymodel/shows.json (RFC 6265 §5.1.4
     path-match wants a `/` after the prefix). The model under it is public now and
     never reads it.
   Unlike the CRM there is no Studio sign-in behind it: the Show log shows the nights
   and the money, and sends nothing and erases nothing. */

export const COOKIE = 'slk';
export const DOC = 'showlock';
const PATH = '/moneymodel';

const macWith = (key, exp, env) => createHmac('sha256', key).update(`show-unlock|${exp}|${L.fingerprint(env)}`).digest('base64url');
const mac = async (exp, env) => macWith(await authSecret(), exp, env);
const attrs = (maxAge, secure) => `Path=${PATH}; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}`;

export async function unlockCookie({ now = Date.now(), secure = true, env = process.env } = {}) {
  const exp = now + L.UNLOCK_HOURS * 3600e3;
  return `${COOKIE}=${exp}.${await mac(exp, env)}; ${attrs(L.UNLOCK_HOURS * 3600, secure)}`;
}
export const clearCookie = (secure = true) => `${COOKIE}=; ${attrs(0, secure)}`;

export async function unlocked(req, { now = Date.now(), env = process.env } = {}) {
  if (!L.ready(env)) return false;
  for (const c of (req.headers.get('cookie') || '').split(/;\s*/)) {
    if (!c.startsWith(COOKIE + '=')) continue;
    const [exp, sig] = c.slice(COOKIE.length + 1).split('.');
    const e = Number(exp);
    if (!sig || !(e > now) || e > now + L.UNLOCK_HOURS * 3600e3) continue;
    /* Every key a cookie may have been signed with (signingKeys, decision 0112): a Show
       log opened the hour before MYSET_SECRET arrived stays open, not locked again. */
    const got = Buffer.from(sig);
    for (const k of (await signingKeys()).verify) {
      const want = Buffer.from(macWith(k, e, env));
      if (want.length === got.length && timingSafeEqual(want, got)) return true;
    }
  }
  return false;
}

export const tryPasscode = (code, o = {}) => L.tryPasscode(code, { ...o, doc: DOC });
export const shutUntil = (now = Date.now()) => L.shutUntil(now, DOC);
export const ready = (env = process.env) => L.ready(env);
export const { LOCK_TRIES, LOCK_MINUTES, UNLOCK_HOURS } = L;

/* THE LOCK SCREEN — the CRM's own (public/crm.html § the lock), lifted whole: the three
   rings turning at their own speeds around a breathing core, the padlock glowing in
   the middle, a shake on a wrong passcode, the shackle lifting and the rings flashing
   when it opens, a countdown while the door is shut. Served by the server in place of
   the page, so nothing of the Show log reaches a browser that has not unlocked it.
   The theme is the Show log's own choice (`myset.model.theme`). */
export const lockPage = ({ ready = true, until = 0 } = {}) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#000000">
<title>Show log — MySet</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%23000'/><g fill='%23FF5650'><rect x='24' y='42' width='11' height='34' rx='5'/><rect x='44' y='24' width='11' height='52' rx='5'/><rect x='64' y='54' width='11' height='22' rx='5'/></g></svg>">
<script>try{if(localStorage.getItem('myset.model.theme')==='light'){document.documentElement.dataset.theme='light';document.querySelector('meta[name=theme-color]').content='#F5F5F7';document.querySelector('meta[name=color-scheme]').content='light';}}catch(e){}</script>
<style>
:root{--hi:255,255,255;--bg:#000;--line-2:rgba(var(--hi),.14);--ink:#F5F5F7;--muted:#8E8E93;--hold:#7C7C82;--accent:#FF5650;--bad-3:#FF8378;
  --deep:linear-gradient(135deg,#D6304F,#CC4527);--f:-apple-system,BlinkMacSystemFont,"SF Pro Display","SF Pro Text","Helvetica Neue",system-ui,sans-serif;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;--ease:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.4,.64,1);color-scheme:dark}
:root[data-theme=light]{--hi:0,0,0;--bg:#F5F5F7;--ink:#1D1D1F;--muted:#6E6E73;--hold:#8A8A8F;--accent:#CC332D;--bad-3:#C62620;color-scheme:light}
*,*::before,*::after{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;min-height:100vh;color:var(--ink);background:var(--bg);font-family:var(--f);font-size:15px;line-height:1.45;letter-spacing:-.01em;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
button{font:inherit;letter-spacing:inherit;border:0;color:inherit;cursor:pointer;padding:0}
input{font:inherit;letter-spacing:inherit;color:var(--ink)}
.sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
.lock{position:fixed;left:0;right:0;top:0;height:100vh;height:100dvh;display:grid;place-items:center;overflow:auto;
  padding:max(24px,env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom));
  background:radial-gradient(900px 620px at 50% 26%,rgba(255,86,80,.11),transparent 64%),radial-gradient(700px 500px at 100% 0,rgba(100,210,255,.05),transparent 60%),var(--bg)}
:root[data-theme=light] .lock{background:radial-gradient(900px 620px at 50% 26%,rgba(255,86,80,.13),transparent 64%),radial-gradient(700px 500px at 100% 0,rgba(100,210,255,.1),transparent 60%),#F5F5F7}
.lock::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(var(--hi),.03) 1px,transparent 1px),linear-gradient(90deg,rgba(var(--hi),.03) 1px,transparent 1px);
  background-size:48px 48px;-webkit-mask-image:radial-gradient(circle at 50% 30%,#000,transparent 70%);mask-image:radial-gradient(circle at 50% 30%,#000,transparent 70%)}
.lkc{position:relative;width:100%;max-width:360px;display:grid;justify-items:center;text-align:center}
.lkc>*{animation:rise .7s var(--ease) both}.lkc>:nth-child(2){animation-delay:.08s}.lkc>:nth-child(3){animation-delay:.14s}.lkc>:nth-child(4){animation-delay:.2s}.lkc>:nth-child(5){animation-delay:.26s}
.rx{position:relative;width:132px;height:132px;margin:0 0 24px}
.rx-r,.rx-p{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rx-r circle,.rx-p circle{fill:none}
.rx-r{will-change:transform;filter:drop-shadow(0 0 5px rgba(255,86,80,.55))}
.rx-r.r1{animation:spin 26s linear infinite}.rx-r.r1 circle{stroke:rgba(255,86,80,.62);stroke-width:1.5;stroke-dasharray:30 10 6 10}
.rx-r.r2{animation:spin 16s linear infinite reverse}.rx-r.r2 circle{stroke:rgba(255,86,80,.36);stroke-width:3.5;stroke-dasharray:64 24}
.rx-r.r3{animation:spin 9s linear infinite}.rx-r.r3 circle{stroke:rgba(255,86,80,.55);stroke-width:7;stroke-dasharray:3 9}
.rx-p .trk{stroke:rgba(255,86,80,.2);stroke-width:3}
.rx-core{position:absolute;left:50%;top:50%;width:84px;height:84px;margin:-42px 0 0 -42px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,86,80,.26),rgba(255,86,80,.06) 55%,transparent 70%);animation:core 2.8s ease-in-out infinite}
.lk-ic{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;fill:none;stroke:var(--ink);stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 10px rgba(255,86,80,.85));transition:transform .4s var(--spring)}
.lk-ic .sh{transition:transform .45s var(--spring);transform-origin:16px 10.5px}
.lk-k{margin:0;font:600 11px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase;color:var(--accent)}
.lkc h1{margin:12px 0 0;font-size:30px;font-weight:700;letter-spacing:-.035em;line-height:1.15}
.lk-f{display:grid;gap:10px;width:100%;margin-top:24px}
.inp{width:100%;height:54px;padding:0 14px;border:0;border-radius:16px;background:rgba(var(--hi),.045);box-shadow:inset 0 0 0 1px var(--line-2);
  text-align:center;font-size:20px;letter-spacing:.24em;color:var(--ink);transition:box-shadow .2s,background .2s,opacity .2s;-webkit-appearance:none;appearance:none}
.inp:hover{background:rgba(var(--hi),.06)}
.inp:focus{outline:none;background:rgba(var(--hi),.07);box-shadow:inset 0 0 0 1.5px var(--accent),0 0 0 4px rgba(255,86,80,.13)}
.inp::placeholder{color:var(--hold);opacity:1;font-size:15px;letter-spacing:.02em}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;width:100%;height:54px;border-radius:16px;font-size:16px;font-weight:600;
  background:var(--deep);color:#fff;box-shadow:0 0 0 1px rgba(255,86,80,.55),0 10px 28px -12px rgba(255,86,80,.75);transition:transform .18s var(--spring),filter .2s,opacity .2s}
.btn:hover{filter:brightness(1.1)}.btn:active{transform:scale(.97)}
.btn:focus-visible,.inp:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
.btn:disabled{background:rgba(var(--hi),.06);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line-2);cursor:default;transform:none;filter:none}
.btn.pending{transform:scale(.97);filter:brightness(.82)}
.lk-s{min-height:22px;margin:16px 0 0;font-size:13.5px;line-height:1.5;color:var(--muted)}
.lk-s.bad{color:var(--bad-3)}
.lk-cd{display:inline-block;margin-left:4px;font:700 12.5px/1 var(--mono);letter-spacing:.08em;color:var(--ink)}
.lock[data-state=nocode] .lk-f{display:none}
.lock[data-state=out] .inp{opacity:.5}
.lock.shake .lkc{animation:shake .5s var(--ease)}
.lock.shake .rx-r circle{stroke:rgba(255,69,58,.75);transition:stroke .2s}
.lock.opening .lk-ic .sh{transform:translateY(-3.5px) rotate(-18deg)}
.lock.opening .rx{animation:flashin .7s var(--ease)}
.lock.opening .lkc{transition:opacity .45s .35s var(--ease),transform .5s .35s var(--ease);opacity:0;transform:scale(.97)}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes core{0%,100%{opacity:.75;transform:scale(.94)}50%{opacity:1;transform:scale(1.04)}}
@keyframes shake{0%,100%{transform:none}15%{transform:translateX(-11px)}30%{transform:translateX(9px)}45%{transform:translateX(-7px)}60%{transform:translateX(5px)}75%{transform:translateX(-2px)}}
@keyframes flashin{0%{transform:scale(1);filter:none}40%{transform:scale(1.06);filter:drop-shadow(0 0 22px rgba(255,86,80,.9))}100%{transform:scale(1);filter:none}}
@keyframes rise{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@media (max-width:560px){.lock{place-items:start center;padding-top:calc(44px + env(safe-area-inset-top))}.rx{width:112px;height:112px;margin-bottom:20px}.lkc h1{font-size:26px}.lk-f{margin-top:20px}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
</style></head><body>
<div class="lock" id="lock" role="dialog" aria-modal="true" aria-labelledby="lockT" aria-describedby="lockS" data-state="${ready ? (until > Date.now() ? 'out' : 'ready') : 'nocode'}" data-until="${Number(until) || 0}"><div class="lkc">
  <div class="rx" aria-hidden="true">
    <svg class="rx-r r1" viewBox="0 0 160 160"><circle cx="80" cy="80" r="66"/></svg>
    <svg class="rx-r r2" viewBox="0 0 160 160"><circle cx="80" cy="80" r="56"/></svg>
    <svg class="rx-r r3" viewBox="0 0 160 160"><circle cx="80" cy="80" r="45"/></svg>
    <svg class="rx-p" viewBox="0 0 160 160"><circle class="trk" cx="80" cy="80" r="74"/></svg>
    <i class="rx-core"></i>
    <svg class="lk-ic" viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path class="sh" d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><path d="M12 14.5v2.5"/></svg>
  </div>
  <p class="lk-k">MySet Show log</p>
  <h1 id="lockT">${ready ? 'Enter the passcode' : 'The Show log isn’t set up here'}</h1>
  <form class="lk-f" id="lockF" novalidate>
    <label class="sr" for="lockIn">Passcode</label>
    <input class="inp" id="lockIn" name="password" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Passcode" enterkeyhint="go" autofocus>
    <button type="submit" class="btn" id="lockGo">Unlock</button>
  </form>
  <p class="lk-s" id="lockS" role="status" aria-live="polite">${ready ? 'The same passcode as the CRM.' : 'This copy of the site has no passcode (a deploy preview). Open the Show log on myset.vip.'}</p>
</div></div>
<script>
(()=>{
const $=(s)=>document.querySelector(s), el=$('#lock'), s=$('#lockS'), inp=$('#lockIn'), go=$('#lockGo');
const esc=(t)=>String(t).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const mmss=(ms)=>{const t=Math.ceil(ms/1000);return Math.floor(t/60)+':'+String(t%60).padStart(2,'0');};
let T=0;
function state(st,d){
  d=d||{}; el.dataset.state=st; clearInterval(T); s.className='lk-s'; inp.disabled=false; go.disabled=false;
  if(st==='out'){
    const until=+d.until||0, at=new Date(until).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'});
    inp.disabled=true; go.disabled=true; s.classList.add('bad');
    const tick=()=>{ const ms=until-Date.now();
      if(ms<=0){ state('ready',{msg:'Try again.'}); return; }
      s.innerHTML='Too many tries. The Show log opens again at '+esc(at)+'<span class="lk-cd" aria-hidden="true">'+mmss(ms)+'</span>'; };
    tick(); T=setInterval(tick,1000); return; }
  if(d.msg!=null){ s.textContent=d.msg; if(d.bad)s.classList.add('bad'); }
  setTimeout(()=>{ if(!inp.disabled)inp.focus({preventScroll:true}); },80);
}
function shake(){ el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); setTimeout(()=>el.classList.remove('shake'),600); }
async function unlock(){
  if(inp.disabled)return; if(!inp.value){ inp.focus(); return; }
  go.disabled=true; go.classList.add('pending'); s.className='lk-s'; s.textContent='Checking…';
  const code=inp.value; inp.value='';   // sent and forgotten: the field is empty before the answer comes
  let d=null;
  try{ const r=await fetch('/moneymodel/shows/unlock',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify({code})}); d=await r.json(); }catch(e){ d=null; }
  go.disabled=false; go.classList.remove('pending');
  if(d&&d.ok){ el.classList.add('opening'); s.textContent='Opening…'; setTimeout(()=>location.reload(),matchMedia('(prefers-reduced-motion: reduce)').matches?0:760); return; }
  if(d&&d.error==='wrong'){ shake(); const n=Math.max(0,+d.left||0); state('ready',{msg:'Not that one — '+(n===1?'1 try':n+' tries')+' left',bad:true}); return; }
  if(d&&d.error==='locked-out'){ shake(); state('out',d); return; }
  if(d&&d.error==='not-set-up'){ location.reload(); return; }
  state('ready',{msg:'Connection hiccup — try again',bad:true});
}
$('#lockF').addEventListener('submit',(e)=>{ e.preventDefault(); unlock(); });
if(el.dataset.state==='out')state('out',{until:+el.dataset.until});
if(window.visualViewport&&matchMedia('(max-width:560px)').matches){ const vv=visualViewport, fit=()=>{ el.style.height=vv.height+'px'; el.style.top=vv.offsetTop+'px'; }; vv.addEventListener('resize',fit); vv.addEventListener('scroll',fit); }
})();
</script>
</body></html>`;
