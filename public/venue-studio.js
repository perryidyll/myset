const $=s=>document.querySelector(s), API='/api';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let TOKEN=localStorage.getItem('myset.vtoken')||'';
let V=null, ME=null, SHOWS=null, AMEN=[];
let EVENTS=null, PITCHES=null, STATS=null, VERIFY=null, VOUCH=null;
let TAB=localStorage.getItem('myset.vtab')||'page';

let BUSY=0,BUSY_T=null,LAST_PRESS=null,BUSY_PENDING=null;
document.addEventListener('pointerdown',e=>{LAST_PRESS=e.target.closest&&e.target.closest('button,a')},{passive:true});
function busy(on){
  BUSY=Math.max(0,BUSY+(on?1:-1));
  clearTimeout(BUSY_T);
  const el=$('#busy'); if(!el)return;
  if(BUSY){BUSY_PENDING=LAST_PRESS;if(BUSY_PENDING)BUSY_PENDING.classList.add('pending');
    BUSY_T=setTimeout(()=>{if(BUSY_PENDING)BUSY_PENDING.classList.remove('pending');if(BUSY)el.classList.add('on')},55);
  }else{if(BUSY_PENDING)BUSY_PENDING.classList.remove('pending');BUSY_PENDING=null;el.classList.remove('on');}
}
async function api(p,o={}){
  const h={'content-type':'application/json',...(o.headers||{})};
  if(TOKEN) h['authorization']='Bearer '+TOKEN;
  if(!o.quiet) busy(true);
  try{ const r=await fetch(API+p,{...o,headers:h}); return await r.json(); }
  catch(e){ return {ok:false,error:'Connection hiccup — try again'}; }
  finally{ if(!o.quiet) busy(false); }
}
const post=(path,body)=>api(path,{method:'POST',body:JSON.stringify(body)});

/* ── the door ───────────────────────────────────────────── */
let GATE_EMAIL='', TICKET='';
function gate(err,mode){
  /* WHATEVER HAPPENS, THE BOOT SCREEN GOES. Without this a visitor with no token
     never reaches start(), so the three bars would spin over the sign-in screen
     for ever — the exact thing a boot screen is supposed to prevent. */
  bootDone();
  const m=mode||'start';
  let inner;
  if(m==='code'){
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">We sent a 6-digit code to <b>${esc(GATE_EMAIL)}</b>. It works for ten minutes.</p>
      <input class="inp" id="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
        placeholder="000000" style="letter-spacing:.3em;text-align:center;font-size:26px">
      <button class="big" style="margin-top:12px" onclick="submitCode()">Sign in</button>
      <button class="act" style="margin-top:14px;width:100%" onclick="gate(null,'start')">← Use a different email</button>`;
  }else if(m==='name'){
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">You're in. What's the place called? This is the name people will see.</p>
      <input class="inp" id="newName" maxlength="70" placeholder="The Ugly Duckling" autocomplete="off">
      <div style="display:flex;gap:8px;margin-top:8px">
        <input class="inp" id="newCity" maxlength="60" placeholder="City" style="flex:1">
        <input class="inp" id="newCountry" maxlength="60" placeholder="Country" style="flex:1">
      </div>
      <button class="big" style="margin-top:12px" onclick="claim()">Create your page</button>
      <p class="muted" style="font-size:12px;margin:12px 0 0">City and country are how artists' gigs find their way onto your page — put them exactly as they'd write them.</p>`;
  }else{
    inner=`<p class="muted" style="font-size:14px;margin:0 0 6px">${err==='unauthorized'?'That didn’t work — try again.'
      :'A free page for your venue: what’s on, who’s playing, your menu and your offers.'}</p>
      <p class="muted" style="font-size:13px;margin:0 0 16px">Artists keep their own gig calendars. Once your page is up, the shows fill themselves in.</p>
      <input class="inp" id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@yourbar.com">
      <button class="big" style="margin-top:12px" onclick="sendCode()">Email me a code</button>
      <p class="muted" style="font-size:12.5px;margin:14px 0 0;text-align:center">New here? Same button — we'll set you up right after the code.</p>
      <p class="muted" style="font-size:12.5px;margin:22px 0 0;text-align:center">
        Musician, not a venue? <a href="/studio?tab=setlist" style="color:var(--accent);font-weight:600">Artist Studio →</a></p>`;
  }
  $('#app').innerHTML=`<div class="gate"><h2>Venue Studio</h2>${inner}</div>`;
  const first=$('#otp')||$('#newName')||$('#email');
  if(first){ first.addEventListener('keydown',e=>{if(e.key==='Enter'){
      m==='code'?submitCode():m==='name'?claim():sendCode();}});
    setTimeout(()=>first.focus(),100); }
}
async function sendCode(){
  const em=(($('#email')||{}).value||'').trim();
  if(!em){toast('Enter your email');return;}
  GATE_EMAIL=em;
  const d=await post('/venueauth',{action:'start',email:em});
  if(!d.ok){toast(d.error||'Could not send that');return;}
  gate(null,'code');
}
async function submitCode(){
  const code=(($('#otp')||{}).value||'').trim();
  const d=await post('/venueauth',{action:'verify',email:GATE_EMAIL,code});
  if(!d.ok){toast(d.error||'Check the code and try again');return;}
  if(d.needName){ TICKET=d.ticket; gate(null,'name'); return; }
  signedIn(d);
}
async function claim(){
  const v=id=>(($('#'+id)||{}).value||'').trim();
  if(!v('newName')){toast('What’s the place called?');return;}
  const d=await post('/venueauth',{action:'claim',ticket:TICKET,name:v('newName'),
    city:v('newCity'),country:v('newCountry')});
  if(!d.ok){toast(d.error||'Could not create that');return;}
  signedIn(d,`Welcome — your page is myset.vip/v/${d.slug}`);
}
function signedIn(d,msg){
  TOKEN=d.token; localStorage.setItem('myset.vtoken',TOKEN);
  toast(msg||`Signed in as ${d.email}`);
  start();
}
/* The local clear happens whatever the network does — somebody who presses Sign
   out has to be signed out on this device regardless of what comes back. The
   server call is what makes the token itself stop working, which it never did. */
async function signOut(){
  try{ await post('/venueauth',{action:'signOut'}); }catch(e){}
  TOKEN=''; localStorage.removeItem('myset.vtoken'); V=null; ME=null; gate();
}
function signOutEverywhere(){
  if(!confirm('Sign every device out, including this one? You’ll need a code to get back in.'))return;
  revokeAll();
}
let VSESS=null;
async function openSessions(){
  openSheet(`<h3>Where you’re signed in</h3><p class="lede"><span class="spin"></span> Looking…</p>`);
  VSESS=await post('/venueauth',{action:'sessions'});
  drawSessions();
}
function drawSessions(){
  if(!VSESS||!VSESS.ok){ openSheet(`<h3>Where you’re signed in</h3><p class="lede">Couldn’t read that just now.</p>`); return; }
  const when=t=>{ if(!t)return ''; const d=Math.floor((Date.now()-t)/86400000);
    return d<=0?'today':d===1?'yesterday':d<30?d+' days ago':vdate(t); };
  openSheet(`<h3>Where you’re signed in</h3>
    <p class="lede">Every phone and tablet with a live sign-in. Signing one out is instant.</p>
    <div class="list">${VSESS.list.map(x=>`<div class="row">
      <div class="m"><div class="t">${x.current?'This device':esc(x.label)}</div>
        <div class="s">${x.current?esc(x.label)+' · ':''}signed in ${when(x.at)}${x.email?' · '+esc(x.email):''}</div></div>
      ${x.current?`<button class="act" onclick="closeSheet();signOut()">Sign out</button>`
                :`<button class="act warn" onclick="revokeSession('${esc(x.sid)}')">Sign out</button>`}</div>`).join('')
      ||'<div class="row muted">Nothing to show yet.</div>'}
      ${VSESS.legacy?`<div class="row muted"><div class="m"><div class="t">An older sign-in</div>
        <div class="s">This one started before MySet kept a list, so we can’t tell which device it is. Signing out everywhere clears it.</div></div></div>`:''}</div>
    <button class="big alt" style="margin-top:14px" onclick="signOutOthers()">Sign out our other devices</button>`);
}
async function revokeSession(sid){
  const d=await post('/venueauth',{action:'sessionRevoke',sid});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn’t do that');return;}
  VSESS=d; drawSessions(); toast('Signed out');
}
async function signOutOthers(){
  const d=await post('/venueauth',{action:'signOutOthers'});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn’t do that');return;}
  VSESS=d; drawSessions(); toast(d.gone?`${d.gone} device${d.gone===1?'':'s'} signed out`:'Nothing else was signed in');
}
async function exportAccount(){
  const d=await post('/venueadmin',{action:'accountExport'});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn’t export');return;}
  const blob=new Blob([JSON.stringify(d.data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`myset-venue-${(V&&V.slug)||'page'}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
async function openInvoices(){
  openSheet(`<h3>Invoices and receipts</h3><p class="lede"><span class="spin"></span> Reading Stripe…</p>`);
  const d=await post('/venueadmin',{action:'planInvoices'});
  if(!d||!d.ok){ openSheet(`<h3>Invoices and receipts</h3><p class="lede">${esc((d&&d.error)||'Couldn’t reach Stripe just now.')}</p>`); return; }
  const money=(c,cur)=>(cur==='USD'?'$':'')+(c/100).toFixed(2);
  openSheet(`<h3>Invoices and receipts</h3>
    <p class="lede">Every payment made to MySet. Stripe keeps them; we just show them.</p>
    <div class="list">${d.list.map(i=>`<div class="row">
      <div class="m"><div class="t">${money(i.total,i.currency)} · ${esc(i.status)}</div>
        <div class="s">${vdate(i.at)}${i.number?' · '+esc(i.number):''}</div></div>
      ${i.url?`<a class="act" href="${esc(i.url)}" target="_blank" rel="noopener">Open ↗</a>`:''}</div>`).join('')
      ||'<div class="row muted">Nothing yet — this fills up after your first payment.</div>'}</div>`);
}
/* Two screens, then thirty days. Nothing is erased on the first tap. */
function deleteAccount(){
  openSheet(`<h3>Delete this venue page?</h3>
    <p class="lede">It goes offline straight away. We keep everything for 30 days in case you change your mind, then it’s gone for good.</p>
    <button class="big alt" style="margin-top:16px" onclick="closeSheet()">Keep our page</button>
    <button class="big" style="margin-top:10px;background:var(--accent-2);color:#fff" onclick="deleteAccountConfirm()">Yes, delete it</button>`);
}
function deleteAccountConfirm(){
  openSheet(`<h3>Last check.</h3>
    <p class="lede">Your page, photos, what’s on, your numbers and your community posts. Any plan is cancelled today, so you won’t be charged again.</p>
    <div class="field"><label>Type DELETE to confirm</label><input class="inp" id="delWord" autocapitalize="characters" autocomplete="off" placeholder="DELETE"></div>
    <button class="big" style="margin-top:14px;background:var(--accent)" onclick="deleteAccountNow()">Delete for good</button>
    <button class="big alt" style="margin-top:10px" onclick="closeSheet()">Keep our page</button>`);
}
async function deleteAccountNow(){
  const w=(document.getElementById('delWord')||{}).value||'';
  const d=await post('/venueadmin',{action:'accountDelete',confirm:w});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn’t delete');return;}
  closeSheet(); await loadVenue(true); render();
  toast('Your page is offline. You have until '+vdate(d.purgeAt)+' to change your mind.');
}
async function undelete(){
  const d=await post('/venueadmin',{action:'accountUndelete'});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn’t undo that');return;}
  await loadVenue(true); render(); toast('Your page is back.');
}
function leavingBar(){
  const del=V&&V.del;
  if(!del)return '';
  return `<div class="paybar">
    <b>This page is being deleted on ${vdate(del.purgeAt)}</b>
    <p>Everything is still here — your photos, what’s on, your numbers and your posts. Nothing has been erased.</p>
    <button class="big" style="margin-top:12px" onclick="undelete()">Undo, keep our page</button></div>`;
}
function cardTrouble(){
  const B=(VPLAN&&VPLAN.billing)||{};
  if(!B.pastDue)return '';
  const ends=Number(B.graceUntil||0);
  const fix=B.subscribed?`onclick="openPortal()"`:`onclick="startCheckout()"`;
  return `<div class="paybar">
    <b>Your card didn’t go through</b>
    <p>We couldn’t take this month’s payment for Pro. It’s almost always an expired card or a bank asking a question — nothing on your page has changed.</p>
    <button class="big" style="margin-top:12px" ${fix}>Update our card</button>
    ${ends?`<p style="margin-top:8px">Everything keeps working until ${vdate(ends)}.</p>`:''}</div>`;
}

/* ── loading ────────────────────────────────────────────── */
/* ---------- never a white page ----------
   goTo() paints the splash, waits for it to actually be on screen (two frames),
   and only then navigates. The delegated handler applies it to every internal
   link on the page, so nothing has to remember to call it.
   /api/ is left alone: those are files (the QR png), not pages, and a new tab is
   the right place for a file. */
function goTo(url,label){
  const el=document.getElementById('leave');
  if(!el){ location.href=url; return false; }
  const p=document.getElementById('leaveline');
  if(p) p.textContent=label||'Opening…';
  const pressed=LAST_PRESS;if(pressed)pressed.classList.add('pending');
  setTimeout(()=>{if(pressed)pressed.classList.remove('pending');el.classList.add('on');
    requestAnimationFrame(()=>{ location.href=url; });},40);
  // coming back from the back button restores this page, splash and all
  addEventListener('pageshow',()=>el.classList.remove('on'));
  setTimeout(()=>el.classList.remove('on'),8000);   // a navigation that never happened
  return false;
}
document.addEventListener('click',(e)=>{
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest&&e.target.closest('a[href]');
  if(!a||a.hasAttribute('download')||a.dataset.nosplash!==undefined)return;
  let u; try{ u=new URL(a.getAttribute('href'),location.href); }catch(x){ return; }
  if(u.origin!==location.origin)return;                    // Stripe, Connect, anywhere else
  if(u.pathname.startsWith('/api/'))return;                // a file, not a page
  if(u.pathname===location.pathname&&u.hash)return;        // an anchor on this page
  e.preventDefault();
  goTo(u.pathname+u.search+u.hash,a.dataset.leaving||'Opening…');
});
/* Whatever happens, the boot screen goes: a hung request must never leave
   somebody staring at three bars for ever. */
function bootDone(){
  const el=document.getElementById('boot'); if(!el)return;
  el.classList.add('gone');
  setTimeout(()=>el.remove(),320);        // gone for good: it can never flash again
}
async function start(){
  setTimeout(bootDone,7000);
  try{ await Promise.all([loadVenue(),loadMe()]); }finally{ bootDone(); }
  loadPlan(); handleReturns();
}
/* A pull re-reads the page, and whichever tab's extra data the tab needs. See
   /pull.js for why this exists at all in an installed app. */
MySetPull(async()=>{
  try{
    await loadVenue();
    if(TAB==='numbers'){ STATS=null; await loadStats(); }
  }catch(e){}
});
async function loadVenue(){
  const d=await post('/venueadmin',{action:'get'});
  if(!d.ok){
    if(d.error==='unauthorized'){ TOKEN=''; localStorage.removeItem('myset.vtoken'); }
    gate(d.error); return;
  }
  V=d.venue; AMEN=d.amenities||[]; VOUCH=d.vouches||VOUCH; render();
  if(TAB==='shows'){ loadShows(); loadEvents(); loadPitches(); }
  if(TAB==='numbers') loadStats();
}
async function loadMe(){ ME=await post('/venueauth',{action:'list'}); if(V)render(); }
async function loadShows(force){
  if(SHOWS&&!force)return;
  if(!V||!V.slug)return;
  try{ SHOWS=await fetch(`${API}/venue?v=${encodeURIComponent(V.slug)}`,{cache:'no-store'}).then(r=>r.json()); }
  catch(e){ SHOWS={ok:false}; }
  if(TAB==='shows'&&V)render();
}
function setTab(t){ TAB=t; localStorage.setItem('myset.vtab',t); render();
  if(t==='shows'){ loadShows(); loadEvents(); loadPitches(); }
  if(t==='numbers') loadStats();
  if(t==='merch') loadVComm();
  if(t==='page') loadVerify(); }

async function loadEvents(force){
  if(EVENTS&&!force)return;
  EVENTS=await post('/venueadmin',{action:'eventList'});
  if(TAB==='shows'&&V)render();
}
async function loadPitches(force){
  if(PITCHES&&!force)return;
  PITCHES=await post('/venueadmin',{action:'pitchList'});
  if(TAB==='shows'&&V)render();
}
async function loadStats(force){
  if(STATS&&!force)return;
  STATS=await post('/venueadmin',{action:'stats'});
  if(TAB==='numbers'&&V)render();
}
/* Deliberately NOT run on load: it fetches the venue's website, and doing that
   on every page open would hammer a stranger's server. It runs when they ask. */
async function loadVerify(){ if(VERIFY===null) VERIFY=undefined; }

let WRITING=false;
async function save(body,msg){
  if(WRITING)return; WRITING=true;
  try{
    const d=await post('/venueadmin',body);
    if(!d.ok){toast(d.error||'Failed');return d;}
    V=d.venue; AMEN=d.amenities||AMEN; if(d.vouches) VOUCH=d.vouches; render();
    if(msg)toast(msg);
    return d;
  } finally{ WRITING=false; }
}
const val=id=>(($('#'+id)||{}).value||'').trim();

async function savePage(){
  const typedMap=val('fMap');
  const d=await save({action:'set',
    name:val('fName'),tagline:val('fTag'),about:val('fAbout'),
    city:val('fCity'),country:val('fCountry'),address:val('fAddr'),mapUrl:val('fMap'),
    phone:val('fPhone'),whatsapp:val('fWa'),
    links:{website:val('lkWeb'),instagram:val('lkIg'),facebook:val('lkFb'),google:val('lkG')}},
    'Page saved');
  if(!d||!d.ok)return;
  // a link that isn't a map link is dropped on the way in — say so rather than
  // letting it look saved
  if(typedMap&&!(V.maps&&V.maps.source)) toast('Saved — but that wasn’t a Google or Apple Maps link');
  SHOWS=null; EVENTS=null; STATS=null;   // the place changed, so everything derived does
  loadShows(true); loadEvents(true);
  if(val('lkWeb')) autoVerify();
}
/* Saving a website is the moment to check it, so verification can happen without
   the venue ever having to look for a button. Quiet: it only speaks up on a win. */
async function autoVerify(){
  const d=await post('/venueadmin',{action:'verifyCheck'});
  if(!d.ok)return;
  VERIFY=d;
  if(d.verified){ await loadVenue(); toast('Verified — your website checks out 🎉'); }
  else render();
}

/* ── LOCKED FEATURES ────────────────────────────────────────
   The styling is shared — /lock.css, linked by both Studios and by nothing else.
   These three functions are the pair to the ones in public/studio.html: same
   names, same rules, reading this page's payload instead of the artist's. Kept
   as a pair rather than shared because each Studio is a self-contained page and
   neither loads the other's script.

   `V.limits.soon` names the venue flags that are DESIGNED AND NOT BUILT — those
   are greyed on Pro too, so nobody pays for a dead end. */
const LOCKICON='<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></svg>';
const isSoon=(flag)=>!!(V&&V.limits&&(V.limits.soon||[]).includes(flag));
function has(flag){
  if(!V||!V.limits) return true;              // don't grey before we know
  if(isSoon(flag)) return false;
  const mine=V.limits[flag];
  /* A NUMERIC LIMIT IS NOT A YES/NO, and treating it as one was a real bug: a
     venue's `photos` is 3 or 12 and an artist's `featured` is 50 or unlimited, so
     `limits[flag]===true` was false for both and Pro showed a dash next to a
     feature it fully had. "Has it" means "has as much as the top plan gives".
     Unlimited arrives as null, because shapeLimits maps Infinity to null so it can
     survive JSON. */
  if(mine===null) return true;
  if(typeof mine==='number'){
    const top=(V.plans&&V.plans.pro)?V.plans.pro[flag]:mine;
    return top===mine;
  }
  return mine===true;
}
function needsPlan(flag){
  const P=(V&&V.plans)||null;
  if(P&&P.pro&&P.pro[flag]===true) return P.pro.label;
  return 'Pro';
}
function lock(flag,html,why){
  if(has(flag)) return html;
  const soon=isSoon(flag);
  const cap=soon?'Coming soon':needsPlan(flag)+' feature';
  const pill=`<b>${LOCKICON}${cap}</b>`;
  /* The reason line sits UNDER the lock rather than inside the veil: a locked row
     of chips is 43px tall and a caption inside it either overflows or gets
     clipped mid-word. */
  return `<div class="lock${soon?' soon':''}"><div class="lockin">${html}</div>`+
    (soon?`<div class="lockveil">${pill}</div>`
         :`<button type="button" class="lockveil" aria-label="${esc(cap)} \u2014 see the plans" onclick="showPlans()">${pill}</button>`)+
    `</div>`+(why?`<p class="lockwhy">${esc(why)}</p>`:'');
}
function showPlans(){
  if(TAB!=='settings') setTab('settings');
  setTimeout(()=>{const el=$('#planbox'); if(el) el.scrollIntoView({behavior:'smooth',block:'center'});},60);
}
/* A preview of something that does not exist yet — the same shape the artist's
   Studio uses, so the two read as one product. */
function soonCard(flag,kick,lede,rows){
  return `<div class="sec"><span class="kick">${kick}</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 8px">${lede}</p>
    ${lock(flag,`<div class="list">${rows.map(([t,d])=>
      `<div class="row"><div class="m"><div class="t">${t}</div><div class="s">${d}</div></div></div>`
    ).join('')}</div>`)}`;
}
/* The venue plan card. Venue Pro is NOT self-serve — there is no billing behind
   it and the verify checklist already says so in those words — so this states the
   difference and tells them to ask, rather than showing a Buy button that leads
   nowhere. */
function planBox(){
  if(!V||!V.plans) return '';
  const now=V.plan||'free', B=VPLAN&&VPLAN.billing;
  return `<div class="sec"><span class="kick">Your plan</span></div>
    <div class="list" id="planbox" style="padding:14px 16px">
      <button class="bigup" onclick="openPlans()">${now==='pro'?'Pro membership':'Upgrade your plan'} <span>↗</span></button>
      <p class="planwhen">${vPlanWhen()}</p>
    </div>`;
}
/* The line under the button. Never blank: a free or comped venue has no Stripe
   customer, so the receipts link cannot be shown, and a section that silently
   disappears is exactly what sent Perry looking for one that was not there. */
function vPlanWhen(){
  const B=(VPLAN&&VPLAN.billing)||{}, now=(V&&V.plan)||'free';
  const label=esc((V&&V.limits&&V.limits.label)||'Free');
  const link=B.portal?` · <a href="#" onclick="event.preventDefault();openPortal()">Card, invoices and receipts ↗</a>`:'';
  if(now==='free') return 'Everything your page does for the public is free, and stays free.';
  const when=B.renewsAt||(VPLAN&&VPLAN.until);
  if(when) return `${B.cancelAtPeriodEnd?'Ends':'Renews'} ${vdate(when)}${link}`;
  return `${label} · Active${link}`;
}
function vdate(iso){ try{ return new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return ''; } }

/* ---------- plans and billing (see _billing.mjs) ----------
   Both tiers listed in full, every time. The transaction fee in orange, called that.
   Pro opens Stripe Checkout; leaving it asks twice and offers a month at half price, once. */
let VPLAN=null;
async function loadPlan(force){ if(VPLAN&&!force) return VPLAN; const d=await post('/venueadmin',{action:'planGet'}); if(d&&d.ok){ VPLAN=d; if(V){ V.plan=d.plan; V.limits=d.limits; V.plans=d.plans; render(); } } return VPLAN; }
const vTierList=(k)=>VTIER_COPY[k].items.map(x=>Array.isArray(x)
  ?`<li><b>${x[0]}</b>${x[1]||''}</li>`:`<li>${x}</li>`).join('');
/* [the thing, what it means] — the first half bold, the second not. */
const VTIER_COPY={
  free:{name:'Free',price:'$0',items:[
    ['Your page on myset.vip',' — address, hours, what’s on, how to get there'],
    ['Three photos',' on your page'],
    ['Every artist who plays here',' linked to your page, and you to theirs'],
    ['Your nights listed in your city',', and artists pitching to play'],
    ['A community page',' — fans rate the night and post photos, you reply'],
    ['Hide any post',' — instantly, and undo it'],
    ['Codes to print',' for tables, the bar and the door'],
    ['Your numbers',': who voted, what got played, night by night'],
    ['Verification',', once your website and your artists check out'],
    ['<span class="fee">Transaction fee: 10%</span>',' on merch sold through the app, with Stripe’s card fee shared']]},
  pro:{name:'Pro',price:'$20 / month',items:[
    ['Your page on myset.vip',' — address, hours, what’s on, how to get there'],
    ['Twelve photos',' on your page'],
    ['Every artist who plays here',' linked to your page, and you to theirs'],
    ['Your nights listed in your city',', and artists pitching to play'],
    ['A community page',' — fans rate the night and post photos, you reply'],
    ['Merch on your community page',', paid straight to your Stripe account'],
    ['Delete a post for good',' \u2014 hiding is free on every plan'],
    ['The green verified tick',' beside your name'],
    ['Codes to print',' for tables, the bar and the door'],
    ['Your numbers',': who voted, what got played, night by night'],
    ['Coming soon, included',': tips for your staff, and votes for what plays between the sets'],
    ['<span class="fee">Transaction fee: 2%</span>',' on merch sold through the app, with Stripe’s card fee shared']]},
};
/* PLACEHOLDERS — the layout is approved first, then these come down until real
   ones are submitted by venues. Nothing here is a real quote. */
const VTESTIMONIALS=[
  {name:'Sample bar',where:'Koh Phangan',text:'Thursday used to empty out at eleven. Now people stay to see if their song wins. (placeholder)'},
  {name:'Sample pub',where:'Chiang Mai',text:'We can finally see which acts actually pull a crowd, in numbers, the next morning. (placeholder)'},
  {name:'Sample café',where:'Bali',text:'The community page did our marketing for us — photos from the night, posted by the people in them. (placeholder)'},
];
function openPlans(){
  if(!V) return;
  if(!VPLAN){ loadPlan().then(openPlans); return; }
  const cur=V.plan||'free', sub=VPLAN.billing&&VPLAN.billing.subscribed, comped=cur!=='free'&&!sub;
  const cta=(k)=>{
    if(k===cur) return `<button class="big now" disabled>Your plan</button>`;
    if(k==='pro') return `<button class="big" onclick="startCheckout()">Upgrade to Pro</button>`;
    if(comped) return `<button class="big now" disabled>Comped${VPLAN.until?' until '+vdate(VPLAN.until):''}</button>`;
    return `<button class="big alt" onclick="confirmDowngrade()">Switch to Free</button>`;
  };
  openSheet(`<div class="plansheet"><h3>Plans</h3><p class="lede">Everything in each plan, listed in full. Change any time.</p>
    ${['free','pro'].map(k=>`<div class="tier">
      <div class="hd"><span>${VTIER_COPY[k].name}</span><small>${VTIER_COPY[k].price}</small></div>
      <ol>${vTierList(k)}</ol>
      <div class="cta">${cta(k)}</div></div>`).join('')}
    ${VTESTIMONIALS.length?`<div class="sec" style="padding-left:0;margin-top:18px"><span class="kick">What MySet members have to say</span></div>
    <div class="testi">${VTESTIMONIALS.map(t=>`<div class="tcard"><div class="who"><i>${esc(t.name.slice(0,1))}</i><div><b>${esc(t.name)}</b><span>${esc(t.where)}</span></div></div><p>${esc(t.text.slice(0,180))}</p></div>`).join('')}</div>`:''}
    <p class="fine">Stripe handles the card. Cancel any time; a paid month is always yours to the end.</p></div>`);
}
async function startCheckout(){
  const d=await post('/venueadmin',{action:'planCheckout'});
  if(!d.ok||!d.url){toast(d.error||'Couldn’t open checkout');return;}
  location.href=d.url;
}
async function changePlan(plan){
  const d=await post('/venueadmin',{action:'planChange',plan});
  if(!d.ok){toast(d.error||'Couldn’t change that');return;}
  closeSheet(); await loadPlan(true); await loadVenue(); toast(plan==='free'?'Done — Pro runs to the end of the month you paid for':'Done');
}
function confirmDowngrade(){
  openSheet(`<div class="dg"><h3>Are you sure you want to lose your Pro membership benefits?</h3>
    <p class="muted" style="font-size:14px">Merch, the tick and twelve photos go with it. Your items stay saved.</p>
    <button class="big no" style="margin-top:16px" onclick="closeSheet()">No, keep Pro</button>
    <button class="big yes" style="margin-top:10px" onclick="retentionOffer()">Yes, switch to Free</button></div>`);
}
function retentionOffer(){
  if(VPLAN.billing&&VPLAN.billing.retentionUsed){ changePlan('free'); return; }
  post('/venueadmin',{action:'planRetainOffered'});
  openSheet(`<div class="dg"><h3>We’re sad to see you go…</h3>
    <p class="muted" style="font-size:14px">Would you like to keep your plan for <b>50% off</b> for 1 more month?</p>
    <button class="big no" style="margin-top:16px" onclick="keepPlan()">Yes — keep it, half price this month</button>
    <button class="big yes" style="margin-top:10px" onclick="changePlan('free')">No thanks, switch to Free</button></div>`);
}
async function keepPlan(){
  const d=await post('/venueadmin',{action:'planRetain'});
  if(!d.ok){toast(d.error||'Couldn’t apply that');return;}
  closeSheet(); await loadPlan(true); toast('Kept — this month is half price');
}
async function openPortal(){
  const d=await post('/venueadmin',{action:'planPortal'});
  if(!d.ok||!d.url){toast(d.error||'Couldn’t open billing');return;}
  location.href=d.url;
}
/* back from Stripe: confirm on the server, never trust the URL */
async function handleReturns(){
  const q=new URLSearchParams(location.search);
  if(q.get('connect')){ TAB='merch'; history.replaceState(null,'',location.pathname); setTimeout(()=>loadPay(true),400); return; }
  if(q.get('sub')==='cancelled'){ toast('No change made'); history.replaceState(null,'',location.pathname); return; }
  if(q.get('sub')==='done'&&q.get('cs')){
    const d=await post('/venueadmin',{action:'planFinish',cs:q.get('cs')});
    history.replaceState(null,'',location.pathname);
    if(d.ok){ await loadPlan(true); await loadVenue(); toast('Welcome to Pro'); }
    else toast(d.error||'Couldn’t confirm the payment — it may still land in a minute');
  }
}

/* ---------- getting paid: Stripe Connect, the same as an artist ----------
   Direct charges land in the venue's own Stripe account; MySet's transaction fee
   comes off the top, reduced by half of Stripe's card fee (see _connect.mjs). */
let PAY=null, VORDERS=null;
async function loadPay(force){ const d=await post('/venueadmin',{action:'payStatus',refresh:!!force}); if(d&&d.ok){ PAY=d.pay; if(TAB==='merch') render(); if(PAY.ready&&VORDERS===null){ loadOrders(); loadVLedger(); } } }

/* A VENUE'S OWN EARNINGS. The same reporting layer the artist Studio uses, scoped
   to this venue's Stripe account (_ledger.mjs). A bar that takes tips and sells
   merch through MySet needs a year-end statement exactly as much as a musician
   does, and until now had nothing but a list of orders. */
let VLEDGER=null;
async function loadVLedger(force){
  const d=await post('/venueadmin',{action:'ledger',months:12,force:!!force});
  if(d){ VLEDGER=d; if(TAB==='merch'&&V) render(); }
}
const vm$=(c)=>{const n=(Number(c)||0)/100;const s=n<0?'-':'';
  return s+'$'+Math.abs(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});};
const vmlabel=(k)=>new Date(Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,1))
  .toLocaleDateString(undefined,{month:'short',year:'numeric',timeZone:'UTC'});
function vEarnings(){
  const L=VLEDGER;
  if(!L) return `<div class="sec"><span class="kick">Your earnings</span></div>
    <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Adding it up…</div></div>`;
  if(!L.ok||!L.enabled) return '';
  const rows=(L.months||[]).filter(m=>m.count||m.gross||m.payouts), t=L.total||{};
  return `<div class="sec"><span class="kick">Your earnings · last 12 months</span><span class="kick">${vm$(t.net)}</span></div>
  <div class="stats">
    <div class="c"><b class="mono">${vm$(t.gross)}</b><span>Paid to you</span></div>
    <div class="c"><b class="mono">${vm$(-(t.stripeFee||0)-(t.platformFee||0))}</b><span>Fees</span></div>
    <div class="c"><b class="mono acc">${vm$(t.net)}</b><span>Yours</span></div>
  </div>
  ${rows.length?`<div class="list">${rows.map(m=>`<div class="row">
    <div class="m"><div class="t">${vmlabel(m.month)}</div>
      <div class="s">${m.count} payment${m.count===1?'':'s'} · ${vm$(m.gross)} taken · ${vm$(m.stripeFee)} Stripe${m.platformFee?` · ${vm$(m.platformFee)} MySet`:''}</div></div>
    <div class="cnt mono">${vm$(m.net)}</div></div>`).join('')}</div>`
   :`<div class="list"><div class="row muted">No payments in the last twelve months.</div></div>`}
  <div class="wrap" style="margin-top:12px">
    <button class="big alt" onclick="vLedgerCsv()">Download it as a spreadsheet</button>
    <p class="muted" style="font-size:12px;margin:8px 0 0">Straight from Stripe — the same numbers your bank sees. Hand the file to whoever does your books.</p>
  </div>`;
}
async function vLedgerCsv(){
  try{
    const h={'content-type':'application/json'}; if(TOKEN) h["authorization"]="Bearer "+TOKEN;
    const r=await fetch(`${API}/venueadmin`,{method:'POST',headers:h,
      body:JSON.stringify({action:'ledgerCsv',months:12})});
    if(!r.ok){ toast('Couldn’t build that just now'); return; }
    const b=await r.blob(), u=URL.createObjectURL(b), a=document.createElement('a');
    a.href=u; a.download='myset-venue-earnings.csv'; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000);
  }catch(e){ toast('Couldn’t build that just now'); }
}
async function loadOrders(){ const d=await post('/venueadmin',{action:'orderList'}); if(d&&d.ok){ VORDERS=d.orders; if(TAB==='merch') render(); } }
const PAY_COUNTRIES=[['TH','Thailand'],['US','United States'],['GB','United Kingdom'],
  ['AU','Australia'],['CA','Canada'],['NZ','New Zealand'],['IE','Ireland'],
  ['DE','Germany'],['FR','France'],['ES','Spain'],['IT','Italy'],['NL','Netherlands'],
  ['PT','Portugal'],['SE','Sweden'],['DK','Denmark'],['NO','Norway'],['FI','Finland'],
  ['SG','Singapore'],['MY','Malaysia'],['JP','Japan'],['MX','Mexico'],['BR','Brazil']];
function payCountries(){
  const c=((V&&V.country)||'').toLowerCase();
  const guess=(PAY_COUNTRIES.find(([,n])=>n.toLowerCase()===c)||[''])[0];
  return `<option value="">Choose…</option>`+PAY_COUNTRIES.map(([k,n])=>`<option value="${k}"${k===guess?' selected':''}>${esc(n)}</option>`).join('');
}
function payCard(){
  if(!PAY){ loadPay(); return ''; }
  const p=PAY;
  if(p.ready) return `<div class="sec"><span class="kick">Getting paid</span></div>
    <div class="list"><div class="row"><div class="m">
      <div class="t">Card payments are on <span style="color:var(--good)">✓</span></div>
      <div class="s muted">MySet’s transaction fee is ${p.cutPct}% on your ${esc(p.plan)} plan. ${esc(p.stripeFeeNote)}</div>
    </div><button class="act" onclick="payDash()">Stripe ↗</button></div></div>`;
  const started=p.started;
  return `<div class="sec"><span class="kick">Getting paid</span></div>
    <div class="list"><div class="row muted" style="display:block">
      <div class="t" style="color:var(--ink)">${started?'Stripe still needs a few details':'Set up card payments'}</div>
      <p class="s" style="margin:6px 0 0">${started
        ?'You started this but Stripe has not finished checking yet. Until it has, your merch sells through its own links — so nothing can land in the wrong account.'
        :'Merch can be bought right on your community page, and the money goes straight to you. Stripe handles it and MySet never sees your bank details.'}</p>
      <p class="s" style="margin:6px 0 0">On your <b>${esc(p.plan)}</b> plan MySet’s transaction fee is <b>${p.cutPct}%</b>. ${esc(p.stripeFeeNote)}</p>
      ${started?'':`<div class="field" style="margin-top:14px;padding:0">
        <label>Where is your bank account?</label>
        <select class="inp" id="payCountry">${payCountries()}</select>
        <p class="s muted" style="margin:6px 0 0">Stripe can’t change this later, so it has to be right.</p>
      </div>`}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="big" style="flex:1;min-width:180px;margin:0" onclick="payStart()">${started?'Finish with Stripe':'Start with Stripe'}</button>
        ${started?`<button class="act" onclick="loadPay(true)">Check again</button>`:''}
      </div>
    </div></div>`;
}
async function payStart(){
  const sel=$('#payCountry'); const country=sel?(sel.value||''):'';
  if(sel&&!country){ toast('Pick where your bank account is first'); return; }
  const d=await post('/venueadmin',{action:'payStart',country});
  if(d&&d.ok&&d.url){ PAY=d.pay; location.href=d.url; }
  else if(d&&d.error==='need-country') toast('Pick where your bank account is first');
  else toast((d&&d.error)||'Could not start that');
}
async function payDash(){
  const d=await post('/venueadmin',{action:'payDashboard'});
  if(d&&d.ok&&d.url) window.open(d.url,'_blank'); else toast((d&&d.error)||'Not available yet');
}
function ordersSection(){
  const o=VORDERS||[]; const open=o.filter(x=>x.status!=='done');
  return `<div class="sec"><span class="kick">Orders</span><span class="kick">${open.length?open.length+' to do':o.length}</span></div>
    <div class="list">${o.slice(0,40).map(x=>`<div class="row ${x.status==='done'?'muted':''}">
      <div class="m"><div class="t">${esc(x.title)}${x.qty>1?' × '+x.qty:''} · $${Number(x.amount||0).toFixed(2)}</div>
        <div class="s">${x.ship==='ship'?'Posted':'Pickup'} · ${vdate(x.at)}${x.status==='done'?' · done':''}</div></div>
      <button class="act" onclick="orderDetail('${esc(x.sid)}')">Details</button>
      <button class="act" onclick="orderDone('${esc(x.sid)}',${x.status==='done'?'false':'true'})">${x.status==='done'?'Undo':'Done'}</button></div>`).join('')
      ||'<div class="row muted">No orders yet. They land here the moment somebody pays.</div>'}</div>`;
}
async function orderDone(sid,done){ const d=await post('/venueadmin',{action:'orderDone',sid,done}); if(d&&d.ok){ VORDERS=null; loadOrders(); } else toast((d&&d.error)||'Couldn’t update that'); }
async function orderDetail(sid){
  const d=await post('/venueadmin',{action:'orderDetail',sid});
  if(!d||!d.ok){ toast((d&&d.error)||'Not found'); return; }
  const o=d.order||{}; const sh=o.shipping||null;
  const addr=sh?[sh.name,sh.line1,sh.line2,sh.city,sh.state,sh.postal,sh.country].filter(Boolean).join(', '):'';
  openSheet(`<h3>${esc(o.title||'Order')}</h3>
    <div class="list" style="margin:0"><div class="row"><div class="m"><div class="t">$${Number(o.amount||0).toFixed(2)}${o.qty>1?' · × '+o.qty:''}</div><div class="s">${vdate(o.at)} · ${o.ship==='ship'?'To be posted':'Pickup at the show'}</div></div></div>
      ${o.email?`<div class="row"><div class="m"><div class="t">${esc(o.email)}</div><div class="s">Buyer’s email, from Stripe</div></div></div>`:''}
      ${addr?`<div class="row"><div class="m"><div class="t">${esc(addr)}</div><div class="s">Post it here</div></div></div>`:''}</div>
    <button class="big alt" style="margin-top:14px" onclick="closeSheet()">Close</button>`);
}

const tipsCard=()=>soonCard('tips','Tips for your staff',
  'A tip jar on your page that goes to your team, not to the act.',
  [['Straight to your account','MySet never holds it'],
   ['Split how you like','Whole team, or the bar'],
   ['A thank-you on screen','So the tipper knows it landed']]);
const speakerCard=()=>soonCard('speakerVotes','What plays between the sets',
  'When there is no band on, the room votes for what comes out of your speakers.',
  [['Your playlist, their choice','You put the songs in, they pick the order'],
   ['Quiet nights get busy','The reason people stay for another'],
   ['Off in one tap','Whenever the band is back on']]);


/* ---------- merch (Pro) and the community page ----------
   A venue has no payout account, so an item sells through its own LINK — the
   server refuses one without (0r, 0x). Moderating the community page is free. */
let VCOMM=null, vmcOn=true;
async function loadVComm(force){ if(VCOMM&&!force)return; const d=await post('/venueadmin',{action:'postList'}); if(d&&d.ok){VCOMM=d.posts; if(TAB==='merch'&&V)render();} }
const vmoney=c=>'$'+(c/100).toFixed(c%100?2:0);
function vMerchTab(){
  const items=V.merch||[], stored=V.merchStored||0;
  const list=`<div class="sec"><span class="kick">Your merch</span><span class="kick">${items.length}/12</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 8px">Shows on your community page. ${PAY&&PAY.ready?'Fans buy right there and the money lands in your Stripe account.':'Until card payments are on (below), each item links to where it sells.'}</p>
    <div class="list">${items.map(m=>`<div class="row">
        <div class="m"><div class="t">${esc(m.title)}${m.on===false?' <span class="s">· off</span>':''}</div>
          <div class="s">${m.cents?vmoney(m.cents):'No price'} · ${esc((m.link||'').replace(/^https?:\/\//,'').slice(0,40))}</div></div>
        <button class="act" onclick="openVMerch('${esc(m.id)}')">Edit</button>
        <button class="act warn" onclick="rmVMerch('${esc(m.id)}')">✕</button></div>`).join('')||`<div class="row muted">${stored?'Your items are saved and come back with Pro.':'Nothing yet.'}</div>`}</div>
    <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="openVMerch('')">+ Add an item</button></div>`;
  const posts=VCOMM||[];
  return `<div class="wrap" style="padding-top:14px"></div>
    ${lock('merch', list, 'Merch on your page comes with Pro. Anything you add stays saved.')}
    ${payCard()}
    ${PAY&&PAY.ready?ordersSection():''}
    ${PAY&&PAY.ready?vEarnings():''}
    <div class="sec"><span class="kick">Your community page</span><span class="kick">${posts.length}</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 8px">Fans rate a night and post photos. Reply once per post, pin one, hide anything, or delete it. <a href="/v/${esc(V.slug)}/community" style="color:var(--accent);font-weight:600">See the page ↗</a></p>
    <div class="list">${posts.slice(0,30).map(p=>`<div class="row ${p.hidden?'muted':''}" style="flex-wrap:wrap">
      <div class="m" style="flex:1 1 100%"><div class="t">${esc(p.name||'Someone')}${p.stars?' <span style="color:var(--accent-2)">'+'★'.repeat(p.stars)+'</span>':''}${p.pinned?' · pinned':''}${p.hidden?' · hidden':''}${p.reports?` · ${p.reports} report${p.reports===1?'':'s'}`:''}</div>
        <div class="s">${esc((p.text||'').slice(0,140))}${p.photos.length?' · '+p.photos.length+' photo'+(p.photos.length===1?'':'s'):''}${p.video?' · video':''}</div>
        ${p.reply?`<div class="s" style="color:var(--accent-2)">You: ${esc(p.reply.text)}</div>`:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">
        <button class="act" onclick="vReply('${esc(p.id)}')">${p.reply?'Edit reply':'Reply'}</button>
        <button class="act" onclick="vComm('postPin','${esc(p.id)}',${p.pinned?'false':'true'})">${p.pinned?'Unpin':'Pin'}</button>
        <button class="act" onclick="${p.hidden?`vComm('postHide','${esc(p.id)}',false)`
  :`if(confirm(${JSON.stringify((p.photos&&p.photos.length)||p.clip?'Hide this post? It comes off your page straight away, and its photos and clip are deleted. You can un-hide the words later.':'Hide this post? It comes off your page straight away, and you can un-hide it later.')}))vComm('postHide','${esc(p.id)}',true)`}">${p.hidden?'Show':'Hide'}</button>
        <button class="act warn" onclick="if(confirm('Delete this post for good?'))vComm('postDelete','${esc(p.id)}')">✕</button></div>
    </div>`).join('')||'<div class="row muted">Nothing posted yet.</div>'}</div>`;
}
function openVMerch(id){
  const m=(V.merch||[]).find(x=>x.id===id)||{title:'',blurb:'',cents:0,link:'',on:true,img:''};
  vmcOn=m.on!==false;
  openSheet(`<h3>${id?'Edit item':'Add an item'}</h3>
    ${id?`<div class="slots" style="margin:6px 0 10px">${slotBox(id,m.img,'sq')}</div>`:'<p class="lede">Save it first, then add a picture.</p>'}
    <div class="field"><label>Name</label><input class="inp" id="vmTitle" maxlength="60" value="${esc(m.title)}" placeholder="House cap"></div>
    <div class="field"><label>A line about it</label><input class="inp" id="vmBlurb" maxlength="160" value="${esc(m.blurb)}"></div>
    <div class="field"><label>Price shown (USD, optional)</label><input class="inp" id="vmPrice" inputmode="decimal" value="${m.cents?(m.cents/100):''}" placeholder="12"></div>
    <div class="field"><label>${PAY&&PAY.ready?'Link to where it sells (optional — fans can buy right here)':'Link to where it sells'}</label><input class="inp" id="vmLink" value="${esc(m.link)}" placeholder="https://…"></div>
    <div class="row"><div class="m"><div class="t">On the page</div></div>
      <div class="tog"><button id="vmOn" class="${m.on!==false?'on':''}" onclick="vmcOn=true;this.classList.add('on');document.getElementById('vmOff').classList.remove('on')">On</button>
      <button id="vmOff" class="${m.on===false?'on':''}" onclick="vmcOn=false;this.classList.add('on');document.getElementById('vmOn').classList.remove('on')">Off</button></div></div>
    <button class="big" style="margin-top:14px" onclick="saveVMerch('${esc(id)}')">Save</button>`);
}
async function saveVMerch(id){
  const v=k=>(document.getElementById(k)||{}).value||'';
  const cents=Math.round(parseFloat(v('vmPrice'))*100)||0;
  const d=await save({action:'merchSave',item:{id:id||undefined,title:v('vmTitle'),blurb:v('vmBlurb'),cents,link:v('vmLink'),on:vmcOn}},'Saved');
  if(d&&d.ok){ closeSheet(); if(!id){ const m=(V.merch||[]).slice(-1)[0]; if(m) setTimeout(()=>openVMerch(m.id),350); } }
}
async function rmVMerch(id){ if(!confirm('Remove this item?'))return; await save({action:'merchRemove',id},'Removed'); }
async function vComm(action,id,on){ const d=await post('/venueadmin',{action,id,on}); if(d&&d.ok){VCOMM=d.posts;render();} else toast((d&&d.error)||'Couldn’t do that'); }
function vReply(id){
  const p=(VCOMM||[]).find(x=>x.id===id)||{};
  openSheet(`<h3>Reply</h3><p class="lede">${esc((p.text||'').slice(0,160))}</p>
    <textarea class="inp" id="vrTxt" maxlength="500" style="min-height:110px">${esc(p.reply?p.reply.text:'')}</textarea>
    <button class="big" style="margin-top:14px" onclick="vReplySave('${esc(id)}')">Save</button>`);
}
async function vReplySave(id){ const t=(document.getElementById('vrTxt')||{}).value||''; const d=await post('/venueadmin',{action:'postReply',id,text:t}); if(d&&d.ok){VCOMM=d.posts;closeSheet();render();toast('Replied');} else toast((d&&d.error)||'Couldn’t reply'); }

/* ── render ─────────────────────────────────────────────── */
function render(){
  if(!V)return;
  let body='';

  if(TAB==='page'){
    body=`
    ${V.slug?`<div class="wrap" style="padding-top:14px"><a class="big alt orange-outline" href="/v/${esc(V.slug)}">View your page ↗</a></div>`:''}
    ${verifyBlock()}

    <div class="sec"><span class="kick">Cover photo</span></div>
    <div class="wrap"><div class="slots">${slotBox('cover',V.photo,'wide')}</div>
      <p class="muted" style="font-size:12px;margin:9px 0 0">The wide shot at the top of your page. A busy night beats an empty room.</p></div>

    <div class="sec"><span class="kick">The basics</span></div>
    <div class="field"><label>Name</label>
      <input class="inp" id="fName" maxlength="70" value="${esc(V.name)}" placeholder="The Ugly Duckling"></div>
    <div class="field"><label>One line <span class="cnt" id="cTag"></span></label>
      <input class="inp" id="fTag" maxlength="120" value="${esc(V.tagline)}" placeholder="Beach bar, live music, cold beer"></div>
    <div class="field"><label>About <span class="cnt" id="cAbout"></span></label>
      <textarea class="inp" id="fAbout" maxlength="900" placeholder="What the place is like on a good night.">${esc(V.about)}</textarea></div>

    <div class="sec"><span class="kick">Where you are</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0">City and country have to match how artists write them, or their gigs won’t find your page.</p>
    <div style="display:flex;gap:8px">
      <div class="field" style="flex:1"><label>City / island</label>
        <input class="inp" id="fCity" maxlength="60" value="${esc(V.city)}" placeholder="Koh Phangan"></div>
      <div class="field" style="flex:1;padding-right:18px"><label>Country</label>
        <input class="inp" id="fCountry" maxlength="60" value="${esc(V.country)}" placeholder="Thailand"></div>
    </div>
    <div class="field"><label>Address</label>
      <input class="inp" id="fAddr" maxlength="160" value="${esc(V.address)}" placeholder="88 Baan Tai Beach Road"></div>
    <div class="field"><label>Or paste a maps link</label>
      <input class="inp" id="fMap" type="url" inputmode="url" spellcheck="false" value="${esc((V.maps&&V.maps.source)||'')}"
        placeholder="Paste from Google or Apple Maps"></div>
    <p class="muted" style="font-size:12px;padding:8px 20px 0;margin:0">Either one gives people a <b>Directions</b> button that opens in whichever map app their phone uses.</p>

    <div class="sec"><span class="kick">Getting hold of you</span></div>
    <div style="display:flex;gap:8px">
      <div class="field" style="flex:1"><label>Phone</label>
        <input class="inp" id="fPhone" inputmode="tel" maxlength="28" value="${esc(V.phone)}" placeholder="+66 …"></div>
      <div class="field" style="flex:1;padding-right:18px"><label>WhatsApp</label>
        <input class="inp" id="fWa" inputmode="tel" maxlength="28" value="${esc(V.whatsapp)}" placeholder="+66 …"></div>
    </div>
    ${[['lkWeb','Website','website','https://yourbar.com'],
       ['lkIg','Instagram','instagram','https://instagram.com/yourbar'],
       ['lkFb','Facebook','facebook','https://facebook.com/yourbar'],
       ['lkG','Google Maps listing','google','https://maps.app.goo.gl/…']].map(([id,label,k,ph])=>
      `<div class="field"><label>${label}</label>
        <input class="inp" id="${id}" type="url" inputmode="url" spellcheck="false"
          value="${esc((V.links||{})[k]||'')}" placeholder="${ph}"></div>`).join('')}

    <div class="wrap" style="margin-top:16px"><button class="big" onclick="savePage()">Save everything above</button></div>

    <div class="sec"><span class="kick">Good to know</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">Tap what applies. <b>House PA / backline</b> is the one artists look for first.</p>
    <div class="wrap"><div class="chips">${AMEN.map(a=>{
      const on=(V.amenities||[]).some(x=>x.key===a.key);
      return `<button class="chip ${on?'on':''}" data-act="amen" data-id="${esc(a.key)}">${esc(a.label)}</button>`;
    }).join('')}</div></div>

    <div class="sec"><span class="kick">Opening hours</span></div>
    <div class="list">${(V.hours||[]).map(h=>`
      <div class="hrow ${h.closed?'shut':''}">
        <span class="d">${esc(h.label)}</span>
        <button class="sw" data-act="shut" data-id="${h.day}">${h.closed?'Closed':'Open'}</button>
        <span class="times">
          <input type="time" value="${esc(h.open)}" data-hday="${h.day}" data-hfield="open" aria-label="${esc(h.label)} opens">
          <em>–</em>
          <input type="time" value="${esc(h.close)}" data-hday="${h.day}" data-hfield="close" aria-label="${esc(h.label)} closes">
        </span>
      </div>`).join('')}</div>
    <p class="muted" style="font-size:12px;padding:10px 20px 0">Closing after midnight is fine — put the real time.</p>

    <div class="sec"><span class="kick">Photos</span></div>
    ${/* THREE FREE, TWELVE ON PRO — and the extra nine are SHOWN, greyed, rather
          than not existing. The server enforces the same cap (venueadmin.mjs), so
          this is honest either way round: what looks locked is locked. */''}
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 8px">${
      (V.limits&&V.limits.photos)>3
        ? 'Up to '+(V.limits.photos)+' on your page.'
        : 'Three on the free plan. Pro holds twelve.'}</p>
    <div class="wrap">
      <div class="slots">${[0,1,2].map(i=>slotBox('p'+i,(V.photos||[])[i],'sq')).join('')}</div>
      ${(()=>{const cap=(V.limits&&V.limits.photos)||3;
        const rows=[];
        for(let start=3;start<12;start+=3){
          const box=`<div class="slots" style="margin-top:9px">${
            [0,1,2].map(k=>slotBox('p'+(start+k),(V.photos||[])[start+k],'sq')).join('')}</div>`;
          rows.push(start<cap?box:lock('photos',box,start===3?'Nine more photo slots come with Pro.':''));
        }
        return rows.join('');})()}
    </div>
    <div class="sec"><span class="kick">Your community page</span></div>
    <div class="row muted">Fans rate a night and post photos on <a href="/v/${esc(V.slug)}/community" style="color:var(--accent);font-weight:600">your community page ↗</a>. Read and moderate it on the <b>Merch</b> tab.</div>`;
  }

  if(TAB==='shows'){
    const music=(SHOWS&&SHOWS.ok?(SHOWS.gigs||[]).filter(g=>g.kind!=='event'):null);
    const occ=(EVENTS&&EVENTS.ok?(EVENTS.occurrences||[]):null);
    const rules=(EVENTS&&EVENTS.ok?(EVENTS.events||[]):[]);
    const pitches=(PITCHES&&PITCHES.ok?(PITCHES.pitches||[]):null);
    const waiting=(pitches||[]).filter(p=>p.status==='new');

    body=`
    <div class="note"><b>The music fills itself in</b>
      <p>Artists keep their own gig calendars in MySet. Any gig at a venue name matching <b>${esc(V.name||'yours')}</b> in ${esc([V.city,V.country].filter(Boolean).join(', ')||'your city')} appears here and on your public page automatically. Nothing for you to type. Everything else — quiz night, a DJ, the football — you add below.</p></div>

    <div class="sec"><span class="kick">Live music</span><span class="kick">${music?music.length:''}</span></div>
    ${music===null?`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Looking…</div></div>`
     :!music.length?`<div class="list"><div class="row muted">No gigs point here yet. Two things to check: your <b>name</b>, and your <b>city and country</b> — they have to match what the artists type.</div></div>`
     :`<div class="list">${music.map(g=>`<div class="row">
        <div class="m"><div class="t">${esc(g.artist)}${g.live?' · on now':''}</div>
          <div class="by">${esc(dowName(g.date))} ${dayMonth(g.date)} · ${fmtTime(g.time)}${g.endTime?'–'+fmtTime(g.endTime):''}</div>
          <div class="s">Listed as “${esc(g.listedAs)}”${g.repeating?' · repeats':''}</div></div>
        <a class="act" href="/${esc(g.slug)}">Page</a>
      </div>`).join('')}</div>`}
    <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="shareInvite()">Invite acts to list their gigs here</button></div>

    <div class="sec"><span class="kick">Your own events</span><span class="kick">${occ?occ.length:''}</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">Quiz night, a DJ, the football, a full-moon party. Enter a weekly one <b>once</b> — it repeats itself, shows on your page, and goes into the local “what’s on tonight” feed like a gig does.</p>
    ${occ===null?`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`
     :!occ.length?`<div class="list"><div class="row muted">Nothing yet. Tap below — a weekly quiz only needs entering once.</div></div>`
     :`<div class="list">${occ.slice(0,40).map(o=>`<div class="row">
        <div class="m"><div class="t">${esc(o.title||'Event')}${o.startsAt<=Date.now()&&o.endsAt>Date.now()?' · on now':''}</div>
          <div class="by">${esc(dowName(o.date))} ${dayMonth(o.date)} · ${fmtTime(o.time)}${o.endTime?'–'+fmtTime(o.endTime):''}</div>
          ${o.repeating?'<div class="s">Repeats</div>':''}</div>
        <button class="act" data-act="evedit" data-id="${esc(o.eventId)}">Edit</button>
        <button class="act warn" data-act="evskip" data-id="${esc(o.eventId)}|${o.date}">✕</button>
      </div>`).join('')}</div>`}
    <div class="wrap" style="margin-top:14px"><button class="big" onclick="openEvent()">+ Add an event</button></div>
    ${rules.length?`<p class="muted" style="font-size:12px;padding:12px 20px 0">✕ cancels one night. Edit changes the whole run.</p>`:''}

    <div class="sec"><span class="kick">Who wants to play here</span>${waiting.length?`<span class="kick" style="color:var(--accent)">${waiting.length} new</span>`:''}</div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">Artists can ask for a spot from your public page. You get their MySet page and their real numbers — nights played, people in the room, votes cast — instead of a bio and a promise.</p>
    ${pitches===null?`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`
     :!pitches.length?`<div class="list"><div class="row muted">Nobody yet. The button is on your public page — the more acts see it, the more you’ll get.</div></div>`
     :`<div class="list">${pitches.map(p=>`<div class="row ${p.status==='nope'?'off':''}">
        <div class="m"><div class="t">${esc(p.name)}${p.status==='keen'?' · you said keen':p.status==='nope'?' · passed':''}</div>
          <div class="by">${p.stats.nights} night${p.stats.nights===1?'':'s'} · ${p.stats.people} in the room · ${p.stats.votes} votes · ${p.stats.songs} songs</div>
          ${p.message?`<div class="s">“${esc(p.message)}”</div>`:''}</div>
        <a class="act" href="/${esc(p.slug)}">Page</a>
        ${p.status==='new'?`<button class="act pri" data-act="pkeen" data-id="${esc(p.id)}">Keen</button>
          <button class="act warn" data-act="pnope" data-id="${esc(p.id)}">✕</button>`
         :`<button class="act" data-act="pnew" data-id="${esc(p.id)}">Undo</button>`}
      </div>`).join('')}</div>`}
    <p class="muted" style="font-size:12px;padding:16px 20px 0">Marking someone <b>Keen</b> shows on their own MySet studio, so they know to get in touch. Nobody’s email is shared either way.</p>
    ${speakerCard()}`;
  }

  if(TAB==='numbers'){
    const S=STATS;
    body=!S?`<div class="list" style="margin-top:16px"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Adding it up…</div></div>`
     :!S.totals.nights?`<div class="note"><b>Nothing to count yet</b>
        <p>These numbers come from shows that actually ran at your place with MySet on. After the first one, this fills in — by night and by act.</p></div>
        ${S.hidden?`<p class="muted" style="font-size:12px;padding:14px 20px 0">${S.hidden} act${S.hidden===1?'':'s'} here ${S.hidden===1?'has':'have'} switched sharing off.</p>`:''}`
     :`
      <div class="stats">
        <div class="c"><b class="mono">${S.totals.people}</b><span>People in the room</span></div>
        <div class="c"><b class="mono">${S.totals.votes}</b><span>Votes cast</span></div>
        <div class="c"><b class="mono">${S.totals.nights}</b><span>Nights</span></div>
      </div>
      <p class="muted" style="font-size:12px;padding:12px 20px 0;margin:0">${S.totals.acts} act${S.totals.acts===1?'':'s'}${S.first?` · since ${dayMonth(S.first)}`:''}. Phones that opened the voting page in your room, not just people who tapped.${S.hidden?` ${S.hidden} act${S.hidden===1?'':'s'} switched sharing off.`:''}</p>
      ${S.busiest?`<div class="note ok" style="margin-top:16px"><b>Busiest night: ${esc(S.busiest.artist)}</b>
        <p>${dowName(S.busiest.date)} ${dayMonth(S.busiest.date)} — ${S.busiest.people} people, ${S.busiest.votes} votes.</p></div>`:''}

      <div class="sec"><span class="kick">By act</span></div>
      <div class="list">${S.byAct.map((a,i)=>`<div class="row">
        <div class="m"><div class="t">${i+1}. ${esc(a.name)}</div>
          <div class="by">${a.nights} night${a.nights===1?'':'s'} · ${a.people} people · ${a.votes} votes</div>
          ${a.best?`<div class="s">Best: ${a.best.people} on ${dayMonth(a.best.date)}</div>`:''}</div>
        <div class="avg"><b>${a.nights?Math.round(a.people/a.nights):0}</b><span>avg/night</span></div>
        <a class="act" href="/${esc(a.slug)}">Page</a>
      </div>`).join('')}</div>
      <p class="muted" style="font-size:12px;padding:10px 20px 0">The big number is the <b>average people per night</b> — that’s the one that tells you who fills the room.</p>

      <div class="sec"><span class="kick">By night</span></div>
      <div class="list">${S.byNight.slice(0,40).map(n=>`<div class="row">
        <div class="m"><div class="t">${esc(n.artist)}</div>
          <div class="by">${dowName(n.date)} ${dayMonth(n.date)}</div></div>
        <div style="text-align:right;flex:0 0 auto">
          <div class="t mono">${n.people}</div>
          <div class="s">${n.votes} votes</div></div>
      </div>`).join('')}</div>
      <p class="muted" style="font-size:12px;padding:14px 20px 0">What each artist earned is <b>not</b> here and never will be — that’s their business. Any act can switch these numbers off from their own studio.</p>
      ${tipsCard()}`;
  }

  if(TAB==='menu'){
    const M=V.menu||{items:[]};
    body=`
    <div class="sec"><span class="kick">Menu</span></div>
    <div class="field"><label>Link to the full menu</label>
      <input class="inp" id="mUrl" type="url" inputmode="url" spellcheck="false" value="${esc(M.url)}"
        placeholder="https://… (a PDF, a page, anything)"></div>
    <div class="field"><label>One line about the food</label>
      <input class="inp" id="mNote" maxlength="140" value="${esc(M.note)}" placeholder="Thai and wood-fired pizza until 11pm"></div>
    <div class="wrap" style="margin-top:12px"><button class="big alt" onclick="saveMenu()">Save</button></div>

    <div class="sec"><span class="kick">Highlights</span><span class="kick">${(M.items||[]).length}/24</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 8px">A handful of things worth ordering. This is what shows on your page — the full menu stays behind the link.</p>
    <div class="list">${(M.items||[]).map((it,i)=>`<div class="row">
      <div class="m"><div class="t">${esc(it.name)}${it.price?` · ${esc(it.price)}`:''}</div>
        <div class="by">${esc([it.section,it.note].filter(Boolean).join(' · ')||'—')}</div></div>
      <button class="act warn" data-act="mrm" data-id="${i}">✕</button>
    </div>`).join('')||'<div class="row muted">Nothing yet.</div>'}</div>
    <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="openMenuItem()">+ Add a highlight</button></div>

    <div class="sec"><span class="kick">Offers</span><span class="kick">${(V.offers||[]).length}/6</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 8px">Happy hour, two-for-one, free shot for anyone who votes — whatever brings people in.</p>
    <div class="list">${(V.offers||[]).map(o=>`<div class="row">
      <div class="m"><div class="t">${esc(o.title)}</div>
        <div class="by">${esc(o.detail||'—')}</div>
        ${o.when?`<div class="s">${esc(o.when)}</div>`:''}</div>
      <button class="act" data-act="oedit" data-id="${esc(o.id)}">Edit</button>
      <button class="act warn" data-act="orm" data-id="${esc(o.id)}">✕</button>
    </div>`).join('')||'<div class="row muted">Nothing yet.</div>'}</div>
    <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="openOffer()">+ Add an offer</button></div>`;
  }

  if(TAB==='settings'){
    body=`
    ${planBox()}
    <div class="sec"><span class="kick">Your public page</span></div>
    <div class="field"><label>myset.vip/v/</label><div style="display:flex;gap:8px">
      <input class="inp" id="slugIn" maxlength="32" value="${esc(V.slug||'')}" placeholder="yourbar" style="flex:1">
      <button class="act pri" style="min-width:64px" onclick="saveSlug()">Save</button></div></div>
    ${V.slug?`<div class="wrap" style="margin-top:10px">
      <a class="big alt" href="/v/${esc(V.slug)}">Open myset.vip/v/${esc(V.slug)} ↗</a></div>`:''}

    <div class="sec"><span class="kick">Verification</span></div>
    ${V.verified
      ? `<div class="list"><div class="row"><div class="m"><div class="t">Verified ✓</div>
          <div class="s">${V.verifiedVia==='website+artists'?'Your website checks out and the artists who play here confirmed it'
            :V.verifiedVia==='owner'?'Checked by MySet by hand'
            :'Your website, and the artists who play here'}</div></div>
          <span class="pill ok">✓</span></div></div>`
      : `<p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">Your page says <b>Unverified listing</b> for now. Four things are needed and they’re all needed — the checklist, with what’s missing, is at the top of the <b>Page</b> tab.</p>
         <div class="wrap"><button class="big alt" onclick="setTab('page')">Show me the checklist</button></div>`}

    <div class="sec"><span class="kick">Codes to print</span></div>
    <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">On tables, on the bar, by the door. Tap one to bring it up full size.</p>
    ${V.slug?`<div class="qrs">
      ${QRS.map(([k,t,d])=>`<button class="qrcard" data-act="qrbig" data-id="${k}">
        <img src="${qrSrc(k,6)}" alt="${esc(t)} QR code" loading="lazy">
        <b>${esc(t)}</b><span>${esc(d)}</span></button>`).join('')}
    </div>`:`<div class="list"><div class="row muted">Set your page address above first.</div></div>`}

    <div class="sec"><span class="kick">Who can sign in</span></div>
    ${ME&&ME.ok?`<div class="list">${(ME.emails||[]).map(e=>`<div class="row">
        <div class="m"><div class="t">${esc(e.email)}</div><div class="s">${esc(e.role)}</div></div>
        ${(ME.emails||[]).length>1?`<button class="act warn" data-act="rmmail" data-id="${esc(e.email)}">✕</button>`:''}
      </div>`).join('')}</div>
      ${ME.emailReady?'':`<p class="muted" style="font-size:12px;padding:10px 20px 0">Email sending isn’t ready yet. Verify a sending domain in Resend, then set <b>AUTH_FROM</b> and <b>RESEND_API_KEY</b> in Netlify.</p>`}`
     :`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`}
    <div class="field"><label>Add a manager or barman</label><div style="display:flex;gap:8px">
      <input class="inp" id="addEmail" type="email" inputmode="email" placeholder="them@email.com" style="flex:1">
      <button class="act pri" style="min-width:64px" onclick="addStaff()">Add</button></div></div>

    <p class="muted" style="font-size:12px;padding:8px 20px 0">A venue page can’t reach an artist’s setlist, votes or money — different account, different door.</p>

    ${/* A venue could sign up, put a page up, take money and pay for Pro, and had no
          way to take its data or to leave. ACCOUNTS.md said a user who can delete
          themselves must first be able to take everything with them; venues were
          simply never given either half. */''}
    <div class="sec"><span class="kick">Your account</span></div>
    <div class="list">
      <div class="row"><div class="m"><div class="t">${esc((ME&&ME.email)||'Signed in')}</div>
        <div class="s">Sign-in address${ME&&ME.emails?` · ${ME.emails.length} sign-in${ME.emails.length===1?'':'s'} on this page`:''}</div></div></div>
      <div class="row"><div class="m"><div class="t">Where you’re signed in</div>
        <div class="s">Every phone and tablet with a live sign-in.</div></div>
        <button class="act" onclick="openSessions()">See them</button></div>
      <div class="row"><div class="m"><div class="t">Download our data</div>
        <div class="s">Everything MySet holds about this venue, as one file. Never a customer’s device.</div></div>
        <button class="act" onclick="exportAccount()">Download</button></div>
      ${VPLAN&&VPLAN.billing&&VPLAN.billing.portal?`<div class="row"><div class="m"><div class="t">Invoices and receipts</div>
        <div class="s">Every payment made to MySet.</div></div>
        <button class="act" onclick="openInvoices()">Open</button></div>`:''}
    </div>
    <div class="wrap" style="margin-top:14px">
      <button class="big alt" onclick="signOut()">Sign out of this device</button>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0;text-align:center">
        <a href="#" onclick="event.preventDefault();signOutEverywhere()" style="color:var(--accent);font-weight:600">Sign out everywhere, including this one</a></p>
    </div>
    <div class="list" style="margin-top:14px">
      <div class="row"><div class="m"><div class="t">Delete this venue page</div>
        <div class="s">The page goes offline today. We keep everything for 30 days, then it’s gone.</div></div>
        <button class="act warn" onclick="deleteAccount()">Delete</button></div>
    </div>`;
  }

  if(TAB==='merch'){
    body=vMerchTab();
  }

  $('#app').innerHTML=`
  <div class="head">
    <a class="homemark" href="/" aria-label="MySet home">
      <i><svg viewBox="0 0 24 24"><rect x="4" y="9" width="3.4" height="11" rx="1.7"/><rect x="10.3" y="4" width="3.4" height="16" rx="1.7"/><rect x="16.6" y="12" width="3.4" height="8" rx="1.7"/></svg></i>
    </a>
    <div style="flex:1;min-width:0"><div class="kick">Venue Studio</div>
      ${V.slug
        ? `<a class="whoami" href="/v/${esc(V.slug)}"><h1>${esc(V.name||'Your venue')}</h1><span>↗</span></a>`
        : `<h1>${esc(V.name||'Your venue')}</h1>`}
    </div>
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:7px">
      <div class="headtopactions"><button class="themebtn" type="button" data-theme-toggle aria-label="Switch theme">☀︎</button>
      ${(V.plan||'free')==='free'
        ?`<button class="upg" onclick="openPlans()">Upgrade <span>↗</span></button>`
        :`<button class="plantag" onclick="openPlans()">${esc((V.limits&&V.limits.label)||'Pro')} <span>↗</span></button>`}</div>
      <span class="pill ${V.verified?'ok':'no'}">${V.verified?'✓ Verified':'Unverified'}</span>
    </div>
  </div>${leavingBar()}${cardTrouble()}${body}
  <div class="wrap" style="padding-top:26px;padding-bottom:8px">
    ${V.slug?`<a class="big alt ${TAB==='page'?'orange-outline':''}" href="/v/${esc(V.slug)}">See your public page ↗</a>`:''}
  </div>
  ${tabBar()}`;
  wireCount('#fTag','#cTag',120); wireCount('#fAbout','#cAbout',900);
  document.querySelectorAll('input[data-hday]').forEach(el=>
    el.addEventListener('change',()=>save({action:'hours',day:el.dataset.hday,
      [el.dataset.hfield]:el.value},'Hours saved')));
}
/* THE BOTTOM TAB BAR — the same bar as the Artist Studio (recipe in /lock.css).
   Five tabs: Page, What's on, Numbers, Merch, and Menu, which opens a sheet
   holding the food-and-drink menu, Settings, the plan and Sign out. The TAB
   values are unchanged, so the saved tab still lands where it did; Menu lights
   for either of the two tabs it holds. */
const TABICON={
  page:'<svg viewBox="0 0 24 24"><path d="M4 10.5L12 4l8 6.5V20H4z"/><path d="M9.5 20v-6h5v6"/></svg>',
  shows:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  numbers:'<svg viewBox="0 0 24 24"><path d="M5 20v-7M12 20V5M19 20v-10M3 20h18"/></svg>',
  merch:'<svg viewBox="0 0 24 24"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1 1 0 0 1 0 1.4l-6.7 6.7a1 1 0 0 1-1.4 0z"/><circle cx="8" cy="8" r="1.4"/></svg>',
  menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'};
function tabBar(){
  const on=t=>t==='menu'?(TAB==='menu'||TAB==='settings'):TAB===t;
  return `<nav class="tabbar" aria-label="Venue Studio"><div class="in">
    ${[['page','Page'],['shows','What’s on'],['numbers','Numbers'],['merch','Merch'],['menu','Menu']].map(([t,l])=>
      `<button class="${on(t)?'on':''}" onclick="${t==='menu'?'openMenu()':`setTab('${t}')`}" aria-current="${on(t)?'page':'false'}">${TABICON[t]}${l}</button>`).join('')}
  </div></nav>`;
}
function openMenu(){
  const M=(V&&V.menu)||{}, n=(M.items||[]).length;
  const planLine=(V&&V.plan||'free')==='free'?'Free plan · see the plans':esc((V.limits&&V.limits.label)||V.plan)+' · manage';
  openSheet(`<h3>Menu</h3>
    <button class="menurow" onclick="closeSheet();setTab('menu')">
      <svg viewBox="0 0 24 24"><path d="M6 3v7a3 3 0 0 0 6 0V3M9 3v18M17 3c-1.7 1.4-2.5 3.4-2.5 6.2V13h3.5v8"/></svg>
      <div class="m">Food &amp; drink<span>${n?n+' highlight'+(n===1?'':'s')+' on your page':'The menu link, highlights and offers'}</span></div><span class="chev">›</span></button>
    <button class="menurow" onclick="closeSheet();setTab('settings')">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>
      <div class="m">Settings<span>Address, verification, codes, sign-in</span></div><span class="chev">›</span></button>
    <button class="menurow" onclick="closeSheet();openPlans()">
      <svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/></svg>
      <div class="m">Your plan<span>${planLine}</span></div><span class="chev">›</span></button>
    <button class="menurow out" onclick="closeSheet();signOut()">
      <svg viewBox="0 0 24 24"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></svg>
      <div class="m">Sign out<span>Of this device</span></div></button>`);
}

/* ── verification ───────────────────────────────────────
   Shown as a CHECKLIST, not a yes/no, because "unverified" with no explanation
   is just a shrug. Every line says exactly what is missing and what to do. */
function verifyBlock(){
  if(V.verified) return `<div class="note ok"><b>✓ Verified</b>
    <p>${V.verifiedVia==='website+artists'
        ? 'Your website checks out and the artists who play here confirmed it.'
        : V.verifiedVia==='owner' ? 'Checked by MySet by hand.'
        : 'Checked by MySet.'} The green tick shows on your public page.</p></div>`;

  const C=(VERIFY&&VERIFY.checks)||{};
  const site=(V.links||{}).website||'';
  const dom=site?(()=>{try{return new URL(site).hostname.replace(/^www\./,'')}catch(e){return ''}})():'';
  // straight off the record, so it is right before any check has been run
  const vouches=(VOUCH&&VOUCH.count)||0, need=(VOUCH&&VOUCH.need)||3;
  const names=(VERIFY&&VERIFY.vouchedBy)||(VOUCH&&VOUCH.names)||[];
  const line=(on,label,hint)=>`<div class="ck ${on?'on':''}">
    <span class="bx">${on?'✓':''}</span>
    <span class="m"><b>${label}</b>${hint?`<span>${hint}</span>`:''}</span></div>`;

  /* THE PLAN IS A STEP, AND IT IS SHOWN. It was added to the verdict without being
     added here, so a venue could tick every box it was told about, read "4 of 4
     done", and still be refused — a checklist that lies. Five now, and the plan is
     first because it is the thing that gates the others being checked at all. */
  const pro=!!(C.paidPlan||(V&&V.plan&&V.plan!=='free'));
  const done=[pro,!!site,!!C.emailOnDomain,!!C.siteNamesVenue,vouches>=need].filter(Boolean).length;
  return `<div class="note"><b>Unverified listing · ${done} of 5 done</b>
    <p>Your page works completely either way — this only changes a grey chip to a
       green tick, so people know the details came from you and not from a stranger.
       <b>All five</b> of the below are needed. Any one on its own is just a claim;
       together they mean somebody controls the venue’s domain, its website, and is
       known to the acts who really play here.</p></div>

  <div class="sec"><span class="kick">1 · MySet Pro</span></div>
  <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">The green tick is part of Pro, along with your reviews, extra photos and tips. Paying doesn’t buy the tick — it opens the door to being checked, and the four steps below still have to pass.</p>
  <div class="list">
    ${line(pro,pro?'You’re on MySet Pro':'MySet Pro',
      pro?'Thanks — the checks below are what earn the tick'
         :'Not self-serve yet: message us and we’ll switch it on for your page')}
  </div>

  <div class="sec"><span class="kick">2 · Your website</span></div>
  <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px">We fetch your homepage over https and look for your venue’s name in the words on it.</p>
  <div class="list">
    ${line(!!site,'Your website is on your page', site?esc(site):'Add it on this tab, under “Getting hold of you”')}
    ${line(!!C.emailOnDomain,'The page was claimed with an email at that domain',
      dom?`Claimed by <b>${esc((VERIFY&&VERIFY.email)||'—')}</b> — needs to be <b>anything@${esc(dom)}</b>`
         :'Add your website first')}
    ${line(!!C.siteNamesVenue,'Your website names your venue',
      VERIFY?(C.siteNamesVenue?`We found “${esc(V.name)}” on the page`
        :(VERIFY.why?`Couldn’t read the site (${esc(VERIFY.why)})`:`We read the page and couldn’t find “${esc(V.name)}” in its text`))
        :'Not checked yet — tap below')}
    ${VERIFY&&C.siteNamesTown?line(true,'…and your town','A bonus, not required'):''}
  </div>
  <div class="wrap" style="margin-top:14px">
    <button class="big alt" onclick="runVerify()">${VERIFY?'Run the check again':'Run the check now'}</button>
  </div>
  ${VERIFY&&!C.siteNamesVenue&&VERIFY.why?`<p class="muted" style="font-size:12px;padding:10px 20px 0">
    If your name is only in an image or drawn by a script we can’t see it — put it in the
    page text somewhere.</p>`:''}
  ${VERIFY&&VERIFY.isOwner===false?`<p class="muted" style="font-size:12px;padding:10px 20px 0">
    You’re signed in as <b>${esc(VERIFY.youAre||'')}</b>, but the check uses the address that
    <b>claimed</b> the page. That’s deliberate — otherwise anyone added later could verify a
    venue with an address on some other domain.</p>`:''}

  <div class="sec"><span class="kick">3 · The artists who play here</span></div>
  <p class="muted" style="font-size:12px;padding:0 20px;margin:0 0 10px"><b>${need}</b> different artists who have a gig at your place in their own MySet calendar have to confirm it. They tap it on your public page. Hard to fake — each one needs their own account and their own gig history.</p>
  <div class="list"><div class="row">
    <div class="m"><div class="t">${vouches} of ${need} confirmed</div>
      <div class="s">${vouches?esc(names.join(', ')):'Nobody yet — send them your page'}</div></div>
    <span class="pill ${vouches>=need?'ok':'no'}">${Math.min(100,Math.round(vouches/need*100))}%</span>
  </div></div>
  <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="shareInvite()">Send artists your page</button></div>
  <p class="muted" style="font-size:12px;padding:14px 20px 0">No website at all? Get to ${need} artists and message us — we check those by hand.</p>`;
}
async function runVerify(){
  const d=await post('/venueadmin',{action:'verifyCheck'});
  if(!d.ok){toast(d.error||'Could not run that check');return;}
  VERIFY=d;
  if(d.verified){ await loadVenue(); toast('Verified 🎉'); return; }
  render();
  /* Name the blocker. "See what's missing above" sent a venue that had done
     everything it was shown back to a list of ticks. */
  const c=d.checks||{};
  toast(!c.paidPlan ? 'The tick is part of MySet Pro — message us to switch it on'
    : !c.website ? 'Add your website first, under “Getting hold of you”'
    : d.why ? 'Couldn’t read your website'
    : !c.siteNamesVenue ? 'We couldn’t find your venue’s name in your website’s text'
    : !c.emailOnDomain ? 'Site checks out — now sign in with an email on that domain'
    : !c.artistsDone ? `${d.vouches||0} of ${d.need||need} artists have confirmed you`
    : 'Not yet — see what’s missing above');
}

/* ── bits and pieces ───────────────────────────────────── */
const MONS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOWS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const dowName=d=>{const [Y,M,D]=d.split('-').map(Number);return DOWS[new Date(Date.UTC(Y,M-1,D)).getUTCDay()];};
const MONFULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
const dayMonth=d=>`${+d.slice(8,10)} ${MONFULL[+d.slice(5,7)-1]}`;
const fmtTime=t=>{const p=String(t||'').split(':');let h=+p[0];
  if(!Number.isFinite(h))return '';const ap=h<12?'am':'pm';h=h%12||12;return `${h}:${p[1]}${ap}`;};

const QRS=[
  ['venue','Our page','What’s on, menu, offers','Connect with our performers'],
  ['home','MySet','Find gigs anywhere','Find live music. Choose the songs they play.'],
];
const qrSrc=(k,scale)=>`/api/qr?k=${k}${k==='home'?'':'&a='+encodeURIComponent((V&&V.slug)||'')}&s=${scale}`;
const qrUrl=k=>k==='home'?'myset.vip':`myset.vip/v/${(V&&V.slug)||''}`;
const qrCopy=k=>k==='home'
  ? {head:'FIND LIVE MUSIC NEAR YOU',line:'VOTE on which songs play next',url:'www.MySet.VIP'}
  : {head:'CONNECT WITH OUR PERFORMERS',line:'See what’s on and meet the acts',url:qrUrl(k)};
function qrBig(k){
  const row=QRS.find(x=>x[0]===k); if(!row)return;
  if(k!=='home'&&!(V&&V.slug)){ toast('Set your page address first'); return; }
  const copy=qrCopy(k);
  $('#qrbig').innerHTML=`<div onclick="event.stopPropagation()">
    <div class="qrpaper"><img src="${qrSrc(k,10)}" alt="${esc(row[1])} QR code">
      <div class="cap">${esc(copy.head)}</div><div class="cap2">${esc(copy.line)}</div><div class="sub">${esc(copy.url)}</div></div>
    <div class="qracts"><button onclick="qrDownload('${k}')">Download print-ready</button>
      <button onclick="qrHide()">Done</button></div></div>`;
  $('#qrbig').classList.add('on');
}
function qrHide(e){ if(e&&e.target&&e.target.id!=='qrbig')return; $('#qrbig').classList.remove('on'); }
function qrDownload(k){
  const row=QRS.find(x=>x[0]===k); if(!row)return;
  const img=new Image(); img.onload=()=>{
    const c=document.createElement('canvas'),z=1800,ctx=c.getContext('2d'),copy=qrCopy(k); c.width=z;c.height=z;
    const fit=(txt,max,size,weight='700')=>{do{ctx.font=`${weight} ${size}px Georgia, serif`;size-=2;}while(ctx.measureText(txt).width>max&&size>24)};
    ctx.fillStyle='#fff';ctx.fillRect(0,0,z,z);ctx.drawImage(img,300,90,1200,1200);ctx.textAlign='center';
    ctx.fillStyle='#111';fit(copy.head,1640,82);ctx.fillText(copy.head,z/2,1435);
    ctx.fillStyle='#ff4058';fit(copy.line,1580,60);ctx.fillText(copy.line,z/2,1535);
    fit(copy.url,1100,46,'600');ctx.fillText(copy.url,z/2,1650);
    const a=document.createElement('a');a.download=`myset-${k}-qr.png`;a.href=c.toDataURL('image/png');a.click();
  }; img.onerror=()=>toast('Couldn’t prepare that QR code'); img.src=qrSrc(k,20);
}

function openSheet(h){
  const sh=$('#sheet');
  sh.innerHTML=`<div class="grabzone"><div class="grab"></div>
    <button class="sheetx" onclick="closeSheet()" aria-label="Close">✕</button></div>${h}`;
  sh.style.transform=''; sh.scrollTop=0;
  $('#bg').classList.add('on'); sh.classList.add('on');
  attachDrag(sh);
}
/* Dismissing a sheet used to mean hitting a 20px strip, which on a phone in a bar
   is a coin toss. Now:
     · the grab area is the whole top of the sheet, handle and all
     · you can also drag from anywhere in the body, as long as the sheet is
       scrolled to the top and you did not start on a control
     · it closes on a short flick as well as a long drag (velocity, not just
       distance), so a quick swipe works like everywhere else
     · and there is a visible ✕, because a gesture should never be the only way
       out of anything */
function attachDrag(sh){
  /* ONE set of listeners for the life of the page. This used to bind a fresh pair
     on every openSheet: the .grabzone was replaced each time so its listeners went
     with it, but the ones on the sheet itself piled up, and each stale closure kept
     its own y0 and raced the live one at the end of a drag. That is the "sometimes
     gets stuck halfway down". Everything is delegated from the sheet now, so the
     grabzone needs no listeners of its own. */
  if(sh.__drag)return;
  sh.__drag=true;
  let y0=null, dy=0, t0=0, fromBody=false;
  const CONTROL='input,textarea,select,button,a,[contenteditable]';
  const HSCROLL='.testi,[data-hscroll]';

  const start=(e,body)=>{
    y0=(e.touches?e.touches[0]:e).clientY; dy=0; t0=Date.now(); fromBody=!!body;
    sh.style.transition='none';
  };
  const move=(e)=>{
    if(y0===null)return;
    dy=((e.touches?e.touches[0]:e).clientY)-y0;
    if(dy<0){ dy=0; sh.style.transform='translateX(-50%) translateY(0)'; return; }
    // dragging from the body only counts while the sheet is still at the top
    if(fromBody&&sh.scrollTop>0){ y0=null; sh.style.transition=''; sh.style.transform=''; return; }
    sh.style.transform=`translateX(-50%) translateY(${dy}px)`;
    if(e.cancelable)e.preventDefault();
  };
  const end=()=>{
    if(y0===null)return;
    const speed=dy/Math.max(1,Date.now()-t0);       // px per ms
    y0=null;
    sh.style.transition='';
    if(dy>70||speed>0.45) closeSheet();
    else sh.style.transform='translateX(-50%) translateY(0)';
  };
  /* The ✕ sits inside the grab zone and is a button, so it is skipped here — a
     drag that began on it was calling preventDefault on the way and eating the
     tap, which is why the close button looked broken. */
  const begin=(e)=>{
    const t=e.target;
    if(!t||!t.closest)return;
    if(t.closest(CONTROL))return;                   // never fight a control
    if(t.closest(HSCROLL))return;                   // a sideways carousel is not a dismiss
    const inZone=!!t.closest('.grabzone');
    if(!inZone&&sh.scrollTop>0)return;              // they are reading, not dismissing
    start(e,!inZone);
  };

  sh.addEventListener('touchstart',begin,{passive:true});
  sh.addEventListener('touchmove',move,{passive:false});
  sh.addEventListener('touchend',end);
  sh.addEventListener('touchcancel',end);
  sh.addEventListener('mousedown',(e)=>{
    if(!e.target.closest('.grabzone')||e.target.closest(CONTROL))return;
    start(e,false);
    const mm=(ev)=>move(ev), mu=()=>{ end();
      window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); };
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu); });
}
function closeSheet(){const sh=$('#sheet');sh.style.transition='';sh.style.transform='';$('#bg').classList.remove('on');sh.classList.remove('on');}
document.addEventListener('keydown',e=>{ if(e.key!=='Escape')return;
  if($('#qrbig').classList.contains('on')) qrHide(); else closeSheet(); });

/* A venue's own listing. Same recurrence machinery as an artist's gig, so a
   weekly quiz is one record forever. The place is NOT asked for — the event is at
   this venue by definition, and the server fills it in from the profile. */
function openEvent(id){
  const rules=(EVENTS&&EVENTS.events)||[];
  const ev=id?rules.find(x=>x.id===id):null;
  const editing=!!ev;
  const tz=(ev&&ev.tz)||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const R=(ev&&ev.repeat)||null;
  openSheet(`<h3>${editing?'Edit event':'Add an event'}</h3>
    ${editing&&ev.repeat?`<p class="lede">This repeats — changes apply to every one in the run.</p>`
      :`<p class="lede">Anything that isn’t a MySet artist’s gig. It’ll show on your page and in the local what’s-on feed.</p>`}
    <div class="field" style="padding:0"><label>What is it?</label>
      <input class="inp" id="evTitle" maxlength="70" placeholder="Quiz Night" value="${esc(editing?(ev.title||''):'')}"></div>
    <div class="field" style="padding:14px 0 0"><label>Date</label>
      <input class="inp" id="evDate" type="date" value="${esc(editing?ev.date:todayStr())}"></div>
    <div style="display:flex;gap:8px">
      <div class="field" style="padding:14px 0 0;flex:1"><label>Starts</label>
        <input class="inp" id="evTime" type="time" value="${esc(editing?ev.time:'20:00')}"></div>
      <div class="field" style="padding:14px 0 0;flex:1"><label>Ends</label>
        <input class="inp" id="evEnd" type="time" value="${esc(editing?endOf(ev):'23:00')}"></div>
    </div>
    <p class="muted" style="font-size:12px;margin:2px 0 0">Finishing after midnight is fine — put the real time.</p>
    <div class="field" style="padding:14px 0 0"><label>Repeats</label>
      <div class="chips">${[['','Just once'],['weekly','Weekly'],['biweekly','Every 2 weeks'],['monthly','Monthly'],['yearly','Yearly']]
        .map(([k,l])=>`<button class="chip ${(R?R.freq:'')===k?'on':''}" data-act="evrep" data-id="${k}">${l}</button>`).join('')}</div>
      <input type="hidden" id="evRepeat" value="${esc(R?R.freq:'')}"></div>
    <div class="field" style="padding:14px 0 0"><label>One line about it (optional)</label>
      <input class="inp" id="evNote" maxlength="140" placeholder="Teams of up to 6, free to enter" value="${esc(editing?(ev.note||''):'')}"></div>
    <input type="hidden" id="evTz" value="${esc(tz)}">
    <button class="big" style="margin-top:16px" data-act="evsave" data-id="${esc(id||'')}">${editing?'Save changes':'Add it'}</button>
    ${editing?`<button class="big alt" style="margin-top:10px" data-act="evdel" data-id="${esc(id)}">Delete this event${ev.repeat?' and its whole run':''}</button>`:''}`);
  setTimeout(()=>{const e=$('#evTitle');if(e)e.focus()},260);
}
const todayStr=()=>{const d=new Date();const p=n=>String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`;};
const endOf=ev=>{const m=/^(\d{2}):(\d{2})$/.exec(ev.time||'');if(!m)return '23:00';
  const t=((+m[1]*60+ +m[2])+(ev.durationMin||180))%1440;const p=n=>String(n).padStart(2,'0');
  return p(Math.floor(t/60))+':'+p(t%60);};

async function saveEvent(id){
  if(WRITING)return; WRITING=true;
  try{
    const freq=val('evRepeat');
    const ev={id:id||undefined,title:val('evTitle'),date:val('evDate'),
      time:val('evTime')||'20:00',endTime:val('evEnd')||'',note:val('evNote'),tz:val('evTz'),
      repeat:freq?{freq,until:null}:null};
    if(!ev.title){toast('What is it called?');return;}
    if(!ev.date){toast('Pick a date');return;}
    const d=await post('/venueadmin',{action:'eventSave',event:ev});
    if(!d.ok){toast(d.error||'Could not save');return;}
    closeSheet(); EVENTS=null; await loadEvents(true); render();
    toast(id?'Event updated':'Event added');
  } finally { WRITING=false; }
}
async function delEvent(id){
  if(!confirm('Delete this event? If it repeats, the whole run goes.'))return;
  const d=await post('/venueadmin',{action:'eventDelete',id});
  if(!d.ok){toast(d.error||'Failed');return;}
  closeSheet(); EVENTS=null; await loadEvents(true); render(); toast('Deleted');
}
async function skipEvent(pair){
  const [id,date]=pair.split('|');
  if(!confirm('Cancel just that one?'))return;
  const d=await post('/venueadmin',{action:'eventSkip',id,date,on:true});
  if(!d.ok){toast(d.error||'Failed');return;}
  EVENTS=null; await loadEvents(true); render(); toast('That one is off');
}
async function setPitch(id,status){
  const d=await post('/venueadmin',{action:'pitchSet',id,status});
  if(!d.ok){toast(d.error||'Failed');return;}
  PITCHES=d; render();
  toast(status==='keen'?'Marked keen — they’ll see it':status==='nope'?'Passed':'Back to new');
}

function openMenuItem(){
  openSheet(`<h3>Add a highlight</h3><p class="lede">One thing worth ordering.</p>
    <input class="inp" id="miName" maxlength="60" placeholder="Wood-fired margherita">
    <div style="display:flex;gap:8px;margin-top:8px">
      <input class="inp" id="miPrice" maxlength="20" placeholder="฿220" style="flex:1">
      <input class="inp" id="miSection" maxlength="30" placeholder="Section (Food, Drinks…)" style="flex:1.4">
    </div>
    <input class="inp" id="miNote" maxlength="60" placeholder="Note (optional)" style="margin-top:8px">
    <button class="big" style="margin-top:16px" onclick="addMenuItem()">Add it</button>`);
  setTimeout(()=>{const e=$('#miName');if(e)e.focus()},260);
}
async function addMenuItem(){
  if(!val('miName')){toast('Give it a name');return;}
  const d=await save({action:'menuAdd',name:val('miName'),price:val('miPrice'),
    section:val('miSection'),note:val('miNote')});
  if(d&&d.ok){ closeSheet(); toast('Added'); }
}
function openOffer(id){
  const o=id?((V.offers||[]).find(x=>x.id===id)||{}):{};
  openSheet(`<h3>${id?'Edit offer':'Add an offer'}</h3>
    <p class="lede">Short and clear beats clever.</p>
    <input class="inp" id="ofTitle" maxlength="60" placeholder="Happy hour" value="${esc(o.title||'')}">
    <input class="inp" id="ofDetail" maxlength="140" placeholder="Two-for-one on all cocktails" value="${esc(o.detail||'')}" style="margin-top:8px">
    <input class="inp" id="ofWhen" maxlength="60" placeholder="Every day, 5–7pm" value="${esc(o.when||'')}" style="margin-top:8px">
    <button class="big" style="margin-top:16px" data-act="ofsave" data-id="${esc(id||'')}">${id?'Save':'Add it'}</button>`);
  setTimeout(()=>{const e=$('#ofTitle');if(e)e.focus()},260);
}
async function saveOffer(id){
  if(!val('ofTitle')){toast('An offer needs a title');return;}
  const d=await save({action:'offerSave',id:id||undefined,title:val('ofTitle'),
    detail:val('ofDetail'),when:val('ofWhen')});
  if(d&&d.ok){ closeSheet(); toast('Saved'); }
}
async function saveMenu(){ await save({action:'menuSet',url:val('mUrl'),note:val('mNote')},'Saved'); }
async function saveSlug(){
  const d=await post('/venueauth',{action:'setSlug',slug:val('slugIn')});
  if(!d.ok){toast(d.error||'Could not save that');return;}
  ME=d; await loadVenue(); toast(`Your page is now myset.vip/v/${d.slug}`);
}
async function addStaff(){
  const em=val('addEmail'); if(!em){toast('Enter an email');return;}
  const d=await post('/venueauth',{action:'add',email:em});
  if(!d.ok){toast(d.error||'Could not add that');return;}
  ME=d; render(); toast(`${em} can sign in now`);
}
async function removeStaff(email){
  if(!confirm('Stop '+email+' signing in?'))return;
  const d=await post('/venueauth',{action:'remove',email});
  if(!d.ok){toast(d.error||'Failed');return;}
  ME=d; render(); toast('Removed');
}
async function revokeAll(){
  const d=await post('/venueauth',{action:'revokeAll'});
  if(!d.ok){toast(d.error||'Failed');return;}
  signOut();
}
function shareInvite(){
  const link='myset.vip/studio';
  openSheet(`<h3>Invite the acts</h3>
    <p class="lede">Send them this. They add their own gigs once and every night at your place shows up on your page from then on.</p>
    <input class="inp" id="invLink" readonly value="${esc(link)}">
    <button class="big" style="margin-top:12px" onclick="copyInv()">Copy the link</button>
    <p class="muted" style="font-size:12.5px;margin:14px 0 0">Tell them to put the venue name as <b>${esc(V.name)}</b> and the city as <b>${esc(V.city||'—')}</b>, and it lands here automatically.</p>
    ${V.slug?`<p class="muted" style="font-size:12.5px;margin:12px 0 0">Your own page is <b>myset.vip/v/${esc(V.slug)}</b> — that’s where they tap “I play here” to help verify you, and where they can ask you for a spot.</p>`:''}`);
}
function copyInv(){
  const el=$('#invLink'); if(!el)return;
  el.select();
  try{ navigator.clipboard.writeText(el.value); }catch(e){ document.execCommand('copy'); }
  toast('Copied');
}

/* Photos — the phone shrinks them before they go over the wire. A venue's cover
   is a wide shot and the gallery is square, so each is cropped to its own shape
   from the centre. */
function slotBox(slot,url,shape){
  return `<label class="slot ${shape}" data-slot="${slot}">
    ${url?`<img src="${esc(url)}" alt="">
           <button type="button" class="rm" data-act="photoclear" data-id="${slot}">✕</button>`
        :`<span class="ph"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17"/></svg>Add photo</span>`}
    <input type="file" accept="image/*" data-slot="${slot}">
  </label>`;
}
async function shrink(file,maxW,ratio){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();
      i.onload=()=>res(i);i.onerror=()=>rej(new Error('bad image'));i.src=url;});
    const w=Math.min(maxW,img.naturalWidth||maxW);
    const h=Math.round(w/ratio);
    // cover-fit: fill the frame from the middle rather than squashing the picture
    const scale=Math.max(w/img.naturalWidth,h/img.naturalHeight);
    const sw=w/scale, sh=h/scale;
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    const g=c.getContext('2d');
    g.drawImage(img,(img.naturalWidth-sw)/2,(img.naturalHeight-sh)/2,sw,sh,0,0,w,h);
    return c.toDataURL('image/jpeg',0.82);
  } finally{ URL.revokeObjectURL(url); }
}
document.addEventListener('change',async e=>{
  const inp=e.target.closest('input[type=file][data-slot]'); if(!inp)return;
  const file=inp.files&&inp.files[0]; if(!file)return;
  const slot=inp.dataset.slot;
  const lab=inp.closest('.slot'); if(lab)lab.classList.add('busy');
  try{
    const data=await shrink(file,slot==='cover'?1400:800,slot==='cover'?1.6:1);
    const d=await save(/^m[a-z0-9]{6}$/.test(slot)?{action:'merchPhoto',id:slot,data}:{action:'photoUpload',slot,data},'Photo added');
    if(!d||!d.ok)return;
  }catch(err){ toast('Couldn’t read that photo'); }
  finally{ inp.value=''; if(lab)lab.classList.remove('busy'); }
});
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b)return;
  const id=b.getAttribute('data-id'), a=b.dataset.act;
  if(a==='amen') save({action:'amenity',key:id});
  if(a==='shut'){ const h=(V.hours||[]).find(x=>x.day===id);
    save({action:'hours',day:id,closed:!(h&&h.closed)}); }
  if(a==='mrm') save({action:'menuRemove',i:id},'Removed');
  if(a==='orm') save({action:'offerRemove',id},'Removed');
  if(a==='oedit') openOffer(id);
  if(a==='ofsave') saveOffer(id);
  if(a==='rmmail') removeStaff(id);
  if(a==='qrbig'){ e.preventDefault(); qrBig(id); }
  if(a==='evedit') openEvent(id);
  if(a==='evsave') saveEvent(id);
  if(a==='evdel') delEvent(id);
  if(a==='evskip') skipEvent(id);
  if(a==='evrep'){ const h=$('#evRepeat'); if(h){h.value=id;
    document.querySelectorAll('[data-act="evrep"]').forEach(x=>x.classList.toggle('on',x.getAttribute('data-id')===id));} }
  if(a==='pkeen') setPitch(id,'keen');
  if(a==='pnope') setPitch(id,'nope');
  if(a==='pnew') setPitch(id,'new');
  if(a==='photoclear'){ e.preventDefault(); save({action:'photoClear',slot:id},'Removed'); }
});
function wireCount(inSel,outSel,max){
  const i=$(inSel),o=$(outSel); if(!i||!o)return;
  const draw=()=>{o.textContent=`${i.value.length}/${max}`;
    o.classList.toggle('near',i.value.length>max*0.9);};
  i.addEventListener('input',draw); draw();
}
let tT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');
  clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),3200);}

if(TOKEN) start(); else gate();
