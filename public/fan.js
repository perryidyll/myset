/* THE FAN PAGES' SHARED SCRIPT — one copy of what every public page used to carry.

   Before this file (decision 0087) each fan page — the front door, an artist's page,
   the vote page, the community page, a venue's page, the shop, the diary, the artist
   directory and the About page — kept its own copy of the same helpers: the bottom
   sheet and its drag, the toast, the share sheet, the date words, the device id, the
   drifting strips, the rsvp memory. Fifty-eight names were declared on two pages or
   more; seventeen were still byte-identical and forty-one had drifted apart — the
   shop's sheet had learned focus and inert, the artist page's had learned the frozen
   page counter, the vote page's had learned neither. This file is the one place they
   live. A page that needs something extra says so in its own script (the community
   page parks its composer on 'sheetopen') or in its markup (the shop's sheet names
   its own drag zones with data-handle / data-scroller).

   HOW IT IS LOADED. <script src="/fan.js?v=<sha1[:8]>"> sits right before the page's
   own <script>, so everything here exists by the time the page's code runs. Top-level
   names in a classic script are globals: a page must NOT declare any of them again —
   a second `const` with the same name is a SyntaxError that takes the whole page
   script down, and test/structure.mjs refuses the pair. The address carries the
   file's own hash (tools/stamp.mjs writes it into every page; run it after ANY edit
   here), so netlify.toml can tell a phone to keep it for a year: a changed file is a
   new address. The Studios do not load this — they load lock.css instead of app.css
   and keep their helpers in studio.js / venue-studio.js.

   WHAT STAYS ON THE PAGES, on purpose: SLUG and FAN (each page reads its own address
   and keeps its own device-id constant), the payment-return path — handleReturn()
   and redeem() — which INVARIANT 5b keeps per page so shop work never touches the
   voting page's, and everything that draws the page. */

/* ── the two everyone reaches for ── (one declaration per line, on purpose: the guard in
   test/structure.mjs reads names at the start of a line, and a name it cannot see is a name
   a page could declare again) */
const $=s=>document.querySelector(s);
const API='/api';
/* Escapes for text AND attribute values (the quote and the apostrophe both), and a
   null or an undefined is an empty string — never the word "null" on the page. */
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* THE DEVICE ID. One per phone, minted once and kept in localStorage; a phone that
   blocks storage would be a new fan on every call, which is why each page reads it
   ONCE into its own FAN constant. The head-start scripts in vote.html and
   community.html mint it the same way, inline, before this file has arrived — keep
   the three the same. */
function fanId(){let v=null;try{v=localStorage.getItem('myset.fan')}catch(e){}
  if(!v){v='f'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);try{localStorage.setItem('myset.fan',v)}catch(e){}}
  return v;}

/* THE TOAST. 3.6 s is the vote page's timing — the room in the dark, reading a
   receipt; the other pages sat at 3.2 and 3.4 and nobody could have told them apart.
   A page with no #toast (the front door) gets a quiet no-op, not an exception. */
let tT;
function toast(m){const t=$('#toast');if(!t)return;t.textContent=m;t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),3600);}

/* THE SHARE SHEET where the phone has one, the clipboard where it doesn't — and the
   toast says "copied" only once the clipboard has actually taken it. Each page's own
   share() decides the address and the title. */
function shareLink(url,title,copied){
  if(navigator.share){ navigator.share({title,url}).catch(()=>{}); return; }
  try{ navigator.clipboard.writeText(url).then(()=>toast(copied||'Link copied'),()=>toast(url)); }catch(e){ toast(url); }
}

/* ── dates and words ── a gig sits on ITS date string, YYYY-MM-DD in the artist's own
   day. Nothing here goes through new Date(date) at local midnight, which shifts a
   night across midnight for a fan in another timezone. */
const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONFULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dayNum=d=>+d.slice(8,10);
const monShort=d=>MON[+d.slice(5,7)-1];
const dayMonth=d=>`${+d.slice(8,10)} ${MONFULL[+d.slice(5,7)-1]}`;
const dowName=d=>{const [Y,M,D]=d.split('-').map(Number);return DOW[new Date(Date.UTC(Y,M-1,D)).getUTCDay()];};
const todayISO=()=>{const d=new Date();const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
function whenWord(date){
  const t=todayISO();
  if(date===t) return 'Tonight';
  const tm=new Date(Date.now()+86400000);const p=n=>String(n).padStart(2,'0');
  if(date===`${tm.getFullYear()}-${p(tm.getMonth()+1)}-${p(tm.getDate())}`) return 'Tomorrow';
  return dowName(date);
}
/* "20:30" → "8:30pm"; anything that is not a time is '', never "NaN:undefinedpm". */
const fmtTime=t=>{const p=String(t||'').split(':');let h=+p[0];
  if(!Number.isFinite(h))return '';const ap=h<12?'am':'pm';h=h%12||12;return `${h}:${p[1]}${ap}`;};
const ago=t=>{const m=Math.floor((Date.now()-t)/60000);return m<1?'just now':m<60?m+'m ago':m<1440?Math.floor(m/60)+'h ago':Math.floor(m/1440)+'d ago';};
/* Cents to dollars — $5, $12.50: a whole number of dollars never carries ".00". */
const money=c=>{const n=(Number(c)||0)/100;return '$'+(n%1?n.toFixed(2):String(n));};
/* The countdown to a gig: "Live in 2d 4h 12m 08s", "Live in 12m 08s", "Starting now".
   The artist page hangs its "(view setlist)" mark on the end through `suffix`. */
function liveIn(ms,suffix){
  const S=suffix?' '+suffix:'';
  if(ms<=0) return 'Starting now'+S;
  const d=Math.floor(ms/86400000); ms-=d*86400000;
  const h=Math.floor(ms/3600000);  ms-=h*3600000;
  const m=Math.floor(ms/60000);    const sec=Math.floor((ms-m*60000)/1000);
  if(d>0) return `Live in ${d}d ${h}h ${m}m ${String(sec).padStart(2,'0')}s${S}`;
  if(h>0) return `Live in ${h}h ${m}m ${String(sec).padStart(2,'0')}s${S}`;
  return `Live in ${m}m ${String(sec).padStart(2,'0')}s${S}`;
}
/* The band name or first name the artist chose (decision 0062), else the first word
   of the name, else "the artist" — the whole phrase. Three pages used to fall back
   to the first word of "the artist", which is "the". A venue reads d.name. */
const firstNameOf=d=>(d&&String(d.first||'').trim())||String(d&&d.name||'').split(' ')[0]||'the artist';

/* No single link opens in whichever map app a phone actually uses, so the server
   builds both and this picks: Apple devices get Apple Maps, everyone else Google. */
const APPLE=/(iPhone|iPad|iPod|Macintosh|Mac OS X)/i.test(navigator.userAgent||'');
const dirHref=m=>(m?((APPLE?m.apple:m.google)||m.google||m.apple):'')||'';

/* WHAT THIS PHONE SAID IT IS COMING TO — keyed owner|eventId|date by each page's own
   rsvpKey (the front door, an artist's page, a venue's page build the key). Kept in
   memory as well as in storage, so a phone that blocks storage still reads a second
   tap as "take me off" rather than another yes. */
const RSVP_KEY='myset.rsvp';
let RSVP_MEM={};
function rsvpMap(){try{const m=JSON.parse(localStorage.getItem(RSVP_KEY)||'{}');return m&&typeof m==='object'?m:{}}catch(e){return RSVP_MEM}}
function rsvpRemember(k,on){const m=rsvpMap(); if(on)m[k]=1; else delete m[k]; RSVP_MEM=m; try{localStorage.setItem(RSVP_KEY,JSON.stringify(m))}catch(e){}}

/* THE LOGO SCREEN (#intro), painted by the HTML, goes when the page has something to
   show. Two ways for two kinds of page: hideIntro() at first render (an artist's
   page, a venue's), or lift(wait) — the shop and the diary paint the last-seen copy
   first and wait, 400 ms at most, for app.css to land so the copy is styled before
   it is revealed. app.css has arrived when its <link> has a sheet, or the preload
   has become the stylesheet; a page with no link at all is "ready", so nothing
   waits on it. */
let CSSOK=false;
const cssLink=()=>document.querySelector('link[href="/app.css"]');
const cssReady=()=>{ if(CSSOK)return true; const l=cssLink(); return CSSOK=!l||!!l.sheet||l.rel==='stylesheet'; };
function hideIntro(){const i=document.getElementById('intro');if(i)i.classList.add('off');}
let LIFT=0;
function lift(wait){
  const i=document.getElementById('intro'); if(!i||i.classList.contains('off')||LIFT) return;
  if(!wait||cssReady()){ i.classList.add('off'); return; }
  LIFT=1; const t0=Date.now();
  const k=()=>{ if(cssReady()||Date.now()-t0>400) i.classList.add('off'); else requestAnimationFrame(k); }; requestAnimationFrame(k);
}

/* ── THE SHEET ── (INVARIANTS 0f0–0f2) a grab ZONE big enough for a thumb, an ✕ in the
   corner, a real drag, and the page behind frozen. What the shop's copy had learned
   is now everyone's: the page behind is inert as well as frozen, focus lands on the
   title and goes back to whatever opened the sheet, and a closed sheet is inert so
   nothing can tab into it off-screen.

   THE PAGE BEHIND A WINDOW OR A SHEET IS FROZEN (0f2): position:fixed at the offset
   it was at, put back on close — iOS scrolls a page under an overlay that only has
   overflow:hidden. One counter, so the artist page's floating window and the sheet
   can be open together without either thawing the page under the other.

   Two events on the #sheet element, both bubbling: 'sheetopen' fires BEFORE the body
   is replaced (the community page moves its composer to safety on it) and
   'sheetclose' once the page is given back (the shop stops the strip in the sheet).
   A page whose sheet is a history entry — the shop pushes {m:id} for a product —
   closes it by going back; popstate then calls closeSheet() again with the entry
   gone. Opening again while open only swaps the body. */
let FROZEN=0;
let SHEETY=0;
let OPENER=null;
function freezePage(){
  if(FROZEN++)return;
  SHEETY=window.scrollY||0; document.body.style.top=`-${SHEETY}px`; document.body.classList.add('sheeting');
}
function thawPage(){
  if(!FROZEN||--FROZEN)return;
  document.body.classList.remove('sheeting'); document.body.style.top=''; window.scrollTo(0,SHEETY);
}
function openSheet(h,label){
  const sh=document.getElementById('sheet'); if(!sh)return;
  sh.dispatchEvent(new CustomEvent('sheetopen',{bubbles:true}));
  if(!sh.classList.contains('on')){
    OPENER=document.activeElement; freezePage();
    const w=document.querySelector('.wrap'); if(w){ w.inert=true; w.setAttribute('aria-hidden','true'); }
  }
  if(label) sh.setAttribute('aria-label',label); else sh.removeAttribute('aria-label');
  sh.innerHTML=`<div class="grabzone"><div class="grab"></div>
    <button class="sheetx" type="button" onclick="closeSheet()" aria-label="Close">✕</button></div>${h}`;
  sh.style.transform=''; sh.scrollTop=0;
  document.getElementById('bg').classList.add('on'); sh.classList.add('on'); sh.inert=false;
  const t=sh.querySelector('h3'); if(t){ t.id='sheetTitle'; t.tabIndex=-1; }
  /* A frame later, so the slide has begun; and only if the page has not already put
     the focus somewhere in the sheet itself (a message box, a name field). */
  setTimeout(()=>{ if(sh.classList.contains('on')&&!sh.contains(document.activeElement)) try{ (t||sh.querySelector('.sheetx')).focus({preventScroll:true}); }catch(e){} },100);
  attachDrag(sh);
}
function closeSheet(){
  const sh=document.getElementById('sheet'); if(!sh)return;
  if(sh.classList.contains('on')&&history.state&&history.state.m){ history.back(); return; }
  sh.style.transition=''; sh.style.transform='';
  document.getElementById('bg').classList.remove('on');
  if(!sh.classList.contains('on'))return;
  sh.classList.remove('on'); sh.inert=true; thawPage();
  const w=document.querySelector('.wrap'); if(w){ w.inert=false; w.removeAttribute('aria-hidden'); }
  /* Back to what opened it — or, when the page was redrawn under the sheet (a ⏸, a
     409 on the shop), to the same card drawn again. */
  let o=OPENER; OPENER=null;
  if(o&&!o.isConnected&&o.dataset&&o.dataset.item!=null) o=document.querySelector(`#app [data-item="${o.dataset.item}"]`);
  if(o&&o.isConnected&&o!==document.body) try{ o.focus({preventScroll:true}); }catch(e){}
  sh.dispatchEvent(new CustomEvent('sheetclose',{bubbles:true}));
}
function attachDrag(sh){
  /* ONE set of listeners for the life of the page, delegated from the sheet. This
     used to bind a fresh pair on every openSheet: the .grabzone was replaced each
     time so its listeners went with it, but the ones on the sheet itself piled up,
     and each stale closure kept its own y0 and raced the live one at the end of a
     drag — which is how a sheet ends up stuck halfway down. The ✕ is a button inside
     the grab zone, so it is skipped: a drag that began on it called preventDefault
     and ate the tap. */
  if(sh.__drag)return;
  sh.__drag=true;
  let y0=null, dy=0, t0=0, fromBody=false;
  const CONTROL='input,textarea,select,button,a,label,[contenteditable]';
  /* THE SHEET IS CENTRED WITH translateX(-50%), so every transform written here
     has to carry it (0f0). Dropping it moved the sheet half its own width to the
     right the instant a finger touched it — which looked like the sheet had come
     loose rather than like a missing term in one string. */
  const SHIFT='translateX(-50%) ';
  /* Where a drag may begin, and what scrolls on its own and is therefore never a
     handle (0f1: the lyrics, the booking thread, a message being typed). A page
     whose sheet holds other scrollers, or whose lede must scroll rather than pull,
     says so on the element: data-handle, data-scroller (the shop). */
  const HANDLE=sh.dataset.handle||'.grabzone,h3,.lede';
  const SCROLLER=sh.dataset.scroller||'.thread,textarea,.lyr';
  const start=(e,body)=>{ y0=(e.touches?e.touches[0]:e).clientY; dy=0; t0=Date.now();
    fromBody=!!body; sh.style.transition='none'; };
  const move=(e)=>{
    if(y0===null)return;
    dy=((e.touches?e.touches[0]:e).clientY)-y0;
    if(dy<0){ dy=0; sh.style.transform=SHIFT+'translateY(0)'; return; }
    // dragging from the body only counts while the sheet is still scrolled to the top
    if(fromBody&&sh.scrollTop>0){ y0=null; sh.style.transition=''; sh.style.transform=''; return; }
    sh.style.transform=SHIFT+`translateY(${dy}px)`;
    if(e.cancelable)e.preventDefault();
  };
  const end=()=>{
    if(y0===null)return;
    const speed=dy/Math.max(1,Date.now()-t0);
    y0=null;
    sh.style.transition='';
    if(dy>70||speed>0.45) closeSheet(); else sh.style.transform=SHIFT+'translateY(0)';
  };
  const begin=(e)=>{
    const t=e.target;
    if(!t||!t.closest)return;
    if(t.closest(CONTROL))return;
    if(t.closest(SCROLLER))return;
    const inZone=!!t.closest(HANDLE);
    if(!inZone&&sh.scrollTop>0)return;
    start(e,!inZone);
  };
  sh.addEventListener('touchstart',begin,{passive:true});
  sh.addEventListener('touchmove',move,{passive:false});
  sh.addEventListener('touchend',end);
  sh.addEventListener('touchcancel',end);
  sh.addEventListener('mousedown',(e)=>{
    if(!e.target.closest(HANDLE)||e.target.closest(CONTROL))return;
    start(e,false);
    const mm=(ev)=>move(ev), mu=()=>{ end();
      window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); };
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu); });
}
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeSheet(); });
/* The "or another amount" box under a row of preset tiles (the tip sheet on the vote
   and community pages, a pack of votes): typing an amount un-picks the tiles and
   puts the sum on the button; clearing it picks the default tile again. */
function customAmt(inp,ids,pre,dflt,btn){
  const has=inp===document.activeElement||!!inp.value;
  ids.forEach(k=>{const el=$('#'+pre+k);if(el)el.classList.toggle('on',!has&&k===dflt);});
  inp.classList.toggle('on',has);
  const b=$('#'+btn),c=parseFloat(inp.value);
  if(b&&!b.disabled)b.textContent='Continue to payment'+(has&&Number.isFinite(c)&&c>0?' · $'+c:'');
}

/* THE STRIPS TURN THEMSELVES — 28 px/s over a ghost copy of the set, stopped by a
   finger, a wheel or a mouse over it (a native scroller under the finger), picking
   up a second after the strip last moved by hand; never under
   prefers-reduced-motion, and nothing moves while the tab is hidden. One loop per
   strip, keyed by id, so each keeps its own frame handle and resume timer; bound to
   the element render() just drew — a redraw replaces it and the old loop, finding
   its strip gone, quits. dir is +1 for right-to-left (the content moves left) and
   -1 for left-to-right. */
const DRIFT={};
function drift(id,dir){
  const H=DRIFT[id]||(DRIFT[id]={PT:null,PR_:null});
  cancelAnimationFrame(H.PT); clearTimeout(H.PR_);
  const el=document.getElementById(id); if(!el||el.children.length<2)return;
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const copy=el.querySelector('[aria-hidden="true"]'); if(!copy)return;
  /* One set's width, gap included — read every frame, not once: a page drawn from
     the last-seen copy runs this before the preloaded stylesheet has landed, and a
     width measured then is the wrong width for the rest of the visit. */
  const span=()=>copy.offsetLeft-el.children[0].offsetLeft;
  /* Two cards on a tablet-wide screen: one copy of the set is not enough for the
     scroll to reach the seam (the strip would stall at its end, then jump back), so
     more copies go on until it can — checked per frame for the same reason span()
     is, and capped so a strip that never measures right cannot grow forever. */
  const ghosts=[...el.children].filter(c=>c.getAttribute('aria-hidden')==='true'); let extra=0;
  const topUp=()=>{const s=span(); if(s>0&&extra<4&&s+el.clientWidth>el.scrollWidth){ghosts.forEach(c=>el.appendChild(c.cloneNode(true)));extra++;}};
  let hold=false, touching=false, x=el.scrollLeft, last=0;
  const pause=()=>{hold=true;clearTimeout(H.PR_);};
  const resume=()=>{clearTimeout(H.PR_);H.PR_=setTimeout(()=>{hold=false;x=el.scrollLeft;last=0;},1000);};
  el.addEventListener('touchstart',()=>{touching=true;pause();},{passive:true});
  el.addEventListener('touchend',()=>{touching=false;resume();},{passive:true});
  el.addEventListener('touchcancel',()=>{touching=false;resume();},{passive:true});
  el.addEventListener('pointerdown',pause,{passive:true});
  el.addEventListener('wheel',()=>{pause();resume();},{passive:true});
  el.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')pause();});
  el.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')resume();});
  el.addEventListener('scroll',()=>{if(hold){x=el.scrollLeft;if(!touching)resume();}},{passive:true});
  const step=(t)=>{
    if(!el.isConnected)return;
    H.PT=requestAnimationFrame(step);
    if(hold||document.hidden){last=0;return;}
    /* Running backwards, the scroll starts one set in and is pushed forward by a set
       whenever it reaches the front — the same seam, seen from the other side. */
    if(last){ topUp(); const s=span(); x+=dir*28*(t-last)/1000;
      if(s>0){ if(x>=s)x-=s; else if(x<0)x+=s; } el.scrollLeft=x; }
    else if(dir<0&&!el.scrollLeft){ const s=span(); if(s>0){x=s;el.scrollLeft=x;} }
    last=t;
  };
  H.PT=requestAnimationFrame(step);
}
/* A strip on the page lives as long as the page; one inside a sheet does not — when
   the sheet closes or the item switches its loop must stop, or a hidden strip goes
   on laying out every frame. */
function undrift(id){ const H=DRIFT[id]; if(!H) return; cancelAnimationFrame(H.PT); clearTimeout(H.PR_); delete DRIFT[id]; }
/* A second copy of a card for a drifting strip: out of the tab order and hidden from
   a screen reader, which reads one set. */
const ghost=c=>c.replace(/^<a /,'<a tabindex="-1" aria-hidden="true" ').replace(/^<div /,'<div aria-hidden="true" ');

/* THE MENU'S TWO DOORS. Whether somebody has a Studio is a local fact — the token in
   this browser — never a question asked of the server from a public page (INVARIANT
   9h). A venue is a different account with its own token (0x). `tab` is where the
   artist's door lands; the diary page sends its reader to the Diary tab. */
function menuDoors(tab){
  let a=null,v=null; try{ a=localStorage.getItem('myset.token')||localStorage.getItem('myset.admin'); v=localStorage.getItem('myset.vtoken'); }catch(e){}
  const A=document.getElementById('mArtist'), V=document.getElementById('mVenue');
  if(A){ A.href=a?'/studio?tab='+(tab||'setlist'):'/signup'; document.getElementById('mArtistS').textContent=a?'Open your Studio':'Set one up — it’s free'; }
  if(V){ V.href='/venues'; document.getElementById('mVenueS').textContent=v?'Open your Studio':'Set one up — it’s free'; }
  document.addEventListener('click',(e)=>{ const m=document.getElementById('menu'); if(m&&m.open&&!m.contains(e.target)) m.open=false; });
}
