/* THE BUSINESS DASHBOARD — the Money tab for a paid owner, the editor sheet, and the
   Pay / Splits / Costs / Time / Gear rows the gig form borrows  (decision 0065)

   Loaded on demand by studio.js (ensureMoney) after /biz.js, which owns every sum.
   One IIFE: every piece of state is a `let` in here, and everything studio.js
   already has — EVENTS, PLAN, D, HIST, ORDERS, MERCH, render, openSheet, closeSheet,
   toast, api, esc, dstamp, openPlans, loadMerch, loadPlan, reconcile, skipGig, openShow,
   goTo, typing, todayStr, HISTQ, TAB, TOKEN, CODE — is read by its bare name and declared again by nothing
   (test/structure.mjs intersects the two files' top-level names). studio.js only
   ever talks to this file through window.Money, always guarded.

   HOW TO ADD A FIELD to a show's record: give it a default in normGig (_biz.mjs)
   and in Biz.empty() (biz.js), then add one row builder under "THE ROWS" below and
   one line in readRows() that reads it back. The editor and the gig form pick it
   up from the same builder.

   HOW TO ADD A SECTION to the tab: write one function that returns a string, then
   add its call to the list in tab(). Sections are independent, so one can be
   moved, removed or reordered by editing that one line.

   Money is integer cents everywhere except the value attribute of an input, which
   is dollars because that is what a person types. Time is minutes. */
(() => {
'use strict';
/* ---------- STYLE, injected once. Only tokens studio.html defines, each with a
   fallback so a missing one degrades to the dark palette rather than to nothing. */
const CSS=`
.bizsk{margin:16px 18px 0;display:grid;gap:11px}.bizsk i{display:block;background:var(--surface,#1C1C1E);border-radius:var(--r-sm,14px);box-shadow:var(--sh-1,none);height:64px;position:relative;overflow:hidden}
.bizsk i::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--hair,rgba(255,255,255,.09)),transparent);animation:bizshim 1.4s linear infinite}
.bizsk i.big{height:120px;border-radius:var(--r-lg,24px)}.bizsk .two{display:grid;grid-template-columns:1fr 1fr;gap:11px}
@keyframes bizshim{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
.chips.scroll{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:2px 18px 6px;margin:16px 0 0}
.chips.scroll::-webkit-scrollbar{display:none}.chips.scroll .chip{flex:0 0 auto;padding:9px 15px;font-size:14px;min-width:0}
.bizbar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 18px 0}
.bizbar .rng{font-size:12.5px;color:var(--muted,#98989D);font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.btn-line{display:inline-flex;align-items:center;justify-content:center;font-family:inherit;font-size:14px;font-weight:600;letter-spacing:-.01em;padding:10px 16px;border:0;border-radius:var(--pill,999px);cursor:pointer;white-space:nowrap;background:none;color:var(--accent-ink,#FF5650);box-shadow:inset 0 0 0 1.5px var(--accent-ink,#FF5650);text-decoration:none;flex:0 0 auto;transition:transform .22s var(--spring,ease)}
.btn-line:active{transform:scale(.965)}.btn-line:disabled{opacity:.45;cursor:not-allowed;transform:none!important}
.bizhd{display:block;font-size:12.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-2,#FF5650);line-height:1.3}
.bizhero{margin:14px 18px 0;padding:20px 20px 18px;border-radius:var(--r-lg,24px);background:var(--surface,#1C1C1E);box-shadow:var(--sh-1,none);position:relative;overflow:hidden}
.bizhero .k{font-size:15px;font-weight:750;letter-spacing:.08em;text-transform:uppercase;color:var(--accent-2,#FF5650)}
/* The figure wears the plan tag's pill (studio.html .plantag): the same green on the
   same soft green, so a profit reads as the thing the top-right corner already says. */
.bizhero .v{display:inline-block;max-width:100%;font-size:38px;font-weight:700;letter-spacing:-.04em;line-height:1.1;margin-top:8px;padding:6px 18px;border-radius:999px;color:var(--ink,#F5F5F7);background:var(--surface-2,#2C2C2E)}
.bizhero .v.pos{color:var(--good,#30D158);background:rgba(48,209,88,.16)}.bizhero .v.neg{color:var(--accent-ink,#FF5650);background:var(--accent-soft,rgba(255,86,80,.18))}
.bizhero .a{font-size:13.5px;color:var(--muted,#98989D);margin-top:8px;line-height:1.45}.bizhero .a small{display:block;font-size:12.5px;margin-top:4px}.bizhero .a small.fee{color:var(--ink-2,#DDDDE0);font-weight:500}
.bizhero.pulse{animation:bizpulse .6s var(--ease,ease) 1}
@keyframes bizpulse{0%{transform:scale(1)}35%{transform:scale(1.022)}100%{transform:scale(1)}}
.biztiles{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin:11px 18px 0}
/* A tile is three rows of the tiles' own grid — heading, figure, detail — so a
   heading that wraps ("Costs incl. splits") pushes every figure in its row down
   together and the numbers still read across a line. */
.biztiles .c{background:var(--surface,#1C1C1E);border-radius:var(--r-sm,14px);box-shadow:var(--sh-1,none);padding:14px 14px 12px;min-width:0;text-align:left;display:grid;grid-row:span 3;grid-template-rows:subgrid;align-content:start;width:100%;color:inherit;position:relative}
.biztiles .c b{display:block;font-size:22px;font-weight:700;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.biztiles .c .bizhd{margin-bottom:5px}.biztiles .c small{display:block;font-size:11.5px;color:var(--muted,#98989D);font-weight:500;margin-top:3px;line-height:1.35}
.biztiles button.c{cursor:pointer;transition:transform .2s var(--spring,ease)}.biztiles button.c:active{transform:scale(.97)}
.biztiles .c .go{position:absolute;right:14px;top:12px;color:var(--faint,#68686D);font-size:14px;font-style:normal}
.bizchart svg rect.bar{transform-box:fill-box;transform-origin:bottom}.bizchart.anim svg rect.bar{animation:bizgrow .55s var(--ease,ease) both}
@keyframes bizgrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.bizchart svg rect.hit{cursor:pointer}
.donut.biz svg circle[data-d]{transition:stroke-dasharray .8s var(--ease,ease)}
.bizeve{margin:12px 18px 0;padding:14px;background:var(--surface,#1C1C1E);border-radius:var(--r-sm,14px);box-shadow:var(--sh-1,none)}
.bizeve .stack{display:flex;height:12px;border-radius:999px;overflow:hidden;background:var(--surface-2,#2C2C2E)}
.bizeve .stack i{display:block;height:100%}
.bizeve .lg{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:9px;font-size:12px;color:var(--muted,#98989D);font-weight:600}
.bizeve .lg i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:0}
.bizeve .rates{display:grid;grid-template-columns:1fr 1fr;gap:11px;margin-top:12px}
.bizeve .rates div{padding:10px 12px;border-radius:var(--r-sm,14px);background:var(--surface-2,#2C2C2E);display:grid;grid-row:span 2;grid-template-rows:subgrid;align-content:start}
.bizeve .rates b{display:block;font-size:20px;font-weight:700;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bizeve .rates .bizhd{margin-bottom:5px}
.bizctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:12px}
.bizseg{display:inline-flex;flex:0 0 auto;background:var(--surface-2,#2C2C2E);border-radius:999px;padding:3px}
.bizseg button{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:700;color:var(--muted,#98989D);transition:background .2s var(--ease,ease),color .2s var(--ease,ease)}
.bizseg button.on{background:var(--surface,#1C1C1E);color:var(--ink,#F5F5F7);box-shadow:var(--sh-1,0 1px 3px rgba(0,0,0,.4))}
.bizfee{flex:1 1 auto;text-align:left;font-size:12.5px;font-weight:600;line-height:1.35;color:var(--accent-ink,#FF5650);padding:7px 12px;border-radius:14px;box-shadow:inset 0 0 0 1px var(--accent-ink,#FF5650);transition:transform .2s var(--spring,ease)}
.bizfee:active{transform:scale(.98)}
.biznote{font-size:12px;padding:10px 18px 0;margin:0;color:var(--accent-ink,#FF5650);line-height:1.45}
.list .bizmore{width:100%;justify-content:center;font-size:14.5px;font-weight:600;color:var(--accent-ink,#FF5650);cursor:pointer;text-align:center}
.bizvotes{font-size:13px;font-weight:600;color:var(--ink-2,#DDDDE0);margin:-8px 0 14px;line-height:1.45}.bizvotes .muted{font-weight:500}
.bizchip{flex:0 0 auto;font-size:13px;font-weight:700;padding:5px 9px;border-radius:999px;background:var(--surface-2,#2C2C2E);color:var(--ink,#F5F5F7)}
.bizchip.pos{color:var(--good,#30D158);background:color-mix(in srgb,var(--good,#30D158) 14%,transparent)}
.bizchip.neg{color:var(--accent-ink,#FF5650);background:var(--accent-soft,rgba(255,86,80,.18))}
.row .bizacts{display:flex;flex-wrap:wrap;gap:2px 4px;margin:4px 0 0 -8px}.row .bizacts .btn-text{padding:6px 8px;font-size:13.5px}
.bizfoot2 .btn-text{color:var(--muted,#98989D);padding:10px 6px}
.row .bizck{width:22px;height:22px;flex:0 0 auto;accent-color:var(--accent,#FF456E);margin:0}
.bizf .field{padding-left:0;padding-right:0}.why .bizf .inp{background:var(--surface,#1C1C1E)}.bizf .bzrow{display:flex;gap:8px;align-items:center;margin-top:8px}
.bizf .bzrow .inp{min-height:44px;padding:10px 12px;font-size:15px}.bizf .bzrow .bzname{flex:1 1 auto;min-width:0}
.bizf .bzrow .bzqty{flex:0 0 56px;text-align:right}.bizf .bzrow .bzmoney{flex:0 0 96px}.bizf .bzrow .bzt{flex:0 0 auto;color:var(--faint,#68686D);font-style:normal;font-size:14px}
.bizf .bzmoney{position:relative;display:block}.bizf .bzmoney>i{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-style:normal;font-size:15px;color:var(--muted,#98989D);pointer-events:none}
.bizf .bzmoney .inp{width:100%;padding-left:24px}.bizf .bzrow .bzmoney .inp{text-align:right}
.bizf .bzrow .bzx{flex:0 0 32px;height:32px;border-radius:50%;background:var(--surface-2,#2C2C2E);color:var(--muted,#98989D);font-size:15px;display:grid;place-items:center}
.bizf .btn-grey{padding:10px 16px;font-size:14px;margin-top:10px;box-shadow:inset 0 0 0 1px var(--hair-2,rgba(255,255,255,.16))}.why .bizf .btn-grey{background:var(--surface,#1C1C1E)}
.bizf .cap{font-size:12.5px;color:var(--muted,#98989D);margin:10px 0 0;line-height:1.45}
.bizf .cap .btn-text{padding:0 4px;font-size:12.5px}
.bizf .trow{display:flex;gap:8px;align-items:center;margin-top:8px}.bizf .trow label{flex:1 1 auto;margin:0;font-size:13.5px;color:var(--ink-2,#DDDDE0);font-weight:500}
.bizf .trow .bzmin{flex:0 0 96px;text-align:right}.bizf .trow .bzmin.wide{flex-basis:150px}.bizf .trow .bzmin.bad{box-shadow:0 0 0 2.5px var(--accent,#FF456E) inset;animation:bizshake .32s var(--ease,ease) 1}
@keyframes bizshake{0%,100%{transform:none}25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.bizf .pill{flex:0 0 auto;font-size:12px;font-weight:700;padding:7px 11px;border-radius:999px;background:var(--surface-2,#2C2C2E);color:var(--muted,#98989D);box-shadow:inset 0 0 0 1px var(--hair-2,rgba(255,255,255,.16))}
.bizf .pill.on{color:var(--accent-ink,#FF5650);background:var(--accent-soft,rgba(255,86,80,.18));box-shadow:inset 0 0 0 1.5px var(--accent,#FF456E)}
.bizf .hint{font-size:12.5px;color:var(--muted,#98989D);margin:6px 0 0}
.bizf .bzcut{margin-top:12px}.bizf .bzcut>label{display:block;font-size:12.5px;font-weight:600;color:var(--muted,#98989D);margin-bottom:7px}
.bizf textarea.bzgear{min-height:88px}
.sheet.biz .sheetx{z-index:3}.bizro{position:sticky;top:-10px;z-index:1;margin:0 -20px;padding:16px 20px 12px;background:var(--surface,#1C1C1E);border-bottom:.5px solid var(--hair,rgba(255,255,255,.09))}
.bizro .k{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#98989D)}
.bizro b{display:block;font-size:26px;font-weight:700;letter-spacing:-.035em;margin-top:2px;color:var(--ink,#F5F5F7)}
.bizro b.pos{color:var(--good,#30D158)}.bizro b.neg{color:var(--accent-ink,#FF5650)}.bizro small{font-size:15px;color:var(--muted,#98989D);font-weight:600;margin-left:6px}
.bizhours{display:flex;flex-wrap:wrap;gap:9px;margin:6px 0 14px}.bizf .bizctl{margin:0 0 14px}
@media (prefers-reduced-motion:reduce){.bizchart.anim svg rect.bar,.bizhero.pulse,.bizf .trow .bzmin.bad,.bizsk i::after{animation:none!important}.donut.biz svg circle[data-d]{transition:none!important}}`;
function css(){ if(document.getElementById('bizcss'))return; const s=document.createElement('style'); s.id='bizcss'; s.textContent=CSS; document.head.appendChild(s); }

/* ---------- STATE ---------- */
let BZ=null;             // the bizGet answer: null while loading, {ok:true,…} or {ok:false,status}
let WIN=null;            // {from,to} the loaded window covers
let LOADING=null;        // the in-flight bizGet, so two renders do not start two
let FLIGHT=null;         // {from,to} that in-flight read asked for, so a wider ask is not folded into it
let REQ=0;               // bumped per read started; an answer whose number moved is thrown away
let GEN=0;               // bumped per paint; a timer that finds it moved stops (D15)
let ANIM=true;           // entrances once per visit — reset() from setTab('money')
let PULSE=false;         // the hero pulses once on the paint after a save
let SHOWN={};            // last value each tile showed, so a count-up starts from it
let PICKS=null;          // a Set of keys while "Pick shows" is on, else null
let BARI=-1;             // the tapped chart bar
let MORE=false;          // the Shows list unfolded past its first three (the founder, 2026-09-13)
const FOLD=3;
let ED=null;             // the open editor: {key, show, base, stored}
let PER=(()=>{ try{ return JSON.parse(localStorage.getItem('myset.biz.period')||'null')||{kind:'month'}; }catch(e){ return {kind:'month'}; } })();
/* How the hourly rate is read: the whole act's profit or the artist's own cut,
   before or after MySet's fee. A phone's convenience, kept on the phone. */
let VIEW=(()=>{ try{ const v=JSON.parse(localStorage.getItem('myset.biz.view')||'null')||{}; return {mine:!!v.mine,net:!!v.net}; }catch(e){ return {mine:false,net:false}; } })();
const DRAFT='myset.biz.draft', DAY=86400000;
const KINDS=[['month','This month'],['lastMonth','Last month'],['30d','30 days'],['year','This year'],['all','All'],['custom','Custom…']];
const MIXC={pay:'var(--accent)',tips:'var(--accent-2)',merch:'var(--good)',app:'var(--muted)'};
const TIMEC={perform:'var(--accent)',break:'var(--faint)',travel:'var(--muted)',setup:'var(--ink-2)'};

/* ---------- SMALL HELPERS ---------- */
const rm=()=>{ try{ return matchMedia('(prefers-reduced-motion:reduce)').matches; }catch(e){ return false; } };
const $m=(q,r)=>(r||document).querySelector(q);
const dollars=(c)=>c==null?'':((Number(c)||0)/100).toFixed(2).replace(/\.00$/,'');
const toCents=(v)=>{ const s=String(v==null?'':v).replace(/[^0-9.\-]/g,''); if(!s||s==='-'||s==='.')return null; const n=Math.round(parseFloat(s)*100); return Number.isFinite(n)?n:null; };
const dlabel=(iso)=>{ const [y,m,d]=String(iso||'').split('-').map(Number); if(!y)return ''; return new Date(y,m-1,d).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'}); };
const dfull=(iso)=>{ const [y,m,d]=String(iso||'').split('-').map(Number); if(!y)return ''; return new Date(y,m-1,d).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); };
const prefsOf=()=>(BZ&&BZ.ok&&BZ.biz&&BZ.biz.prefs)||{hours:{}};
/* The plan first: it is re-read the moment an upgrade returns, while the book's copy
   of the caps is as old as the last bizGet — the editor must offer what the server
   would now accept, and the book's copy is only for a plan that has not landed. */
const limitsOf=()=>{ const P=PLAN&&PLAN.ok&&PLAN.limits, L=(P&&P.band!=null?P:null)||(BZ&&BZ.ok&&BZ.limits)||{}; return {band:Number(L.band)||0,costs:Number(L.costs)||0}; };
const cutPct=()=>(BZ&&BZ.ok&&BZ.cutPct!=null)?BZ.cutPct:(PLAN&&PLAN.limits&&PLAN.limits.cutPct)||0;
/* Whose phone this is, for the draft: an account, never a phone, owns unsaved
   numbers. The artist id is on every stage read; before it lands, a hash of the
   session stands in — a fingerprint, never a piece of the token itself. */
const who=()=>{ if(D&&D.show&&D.show.artistId) return String(D.show.artistId);
  let h=0; for(const ch of String((typeof TOKEN!=='undefined'&&TOKEN)||(typeof CODE!=='undefined'&&CODE)||'')) h=(h*31+ch.charCodeAt(0))|0; return 'h'+(h>>>0).toString(36); };
/* The two gigs the sheet compares — what it opened with and what is typed — differ
   only by `at`, which the server stamps and the form never shows. */
const sameGig=(a,b)=>JSON.stringify(Object.assign({},a,{at:null}))===JSON.stringify(Object.assign({},b,{at:null}));
const plural=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
const go=(url)=>{ if(typeof goTo==='function')goTo(url,'Opening…'); else location.href=url; };
const cu=(k,v,fmt)=>`data-cu="${v==null?'':v}" data-k="${k}" data-fmt="${fmt}"`;   // a count-up target

/* ---------- THE PERIOD ---------- */
function period(){ const p=Biz.period(PER.kind,Date.now(),PER); return {kind:PER.kind,from:p.from,to:p.to}; }
function setPeriod(kind,custom){
  PER=kind==='custom'?{kind,from:custom.from,to:custom.to}:{kind};
  try{ localStorage.setItem('myset.biz.period',JSON.stringify(PER)); }catch(e){}
  BARI=-1; PICKS=null;
  const P=period();
  if(!WIN||P.from<WIN.from||P.to>WIN.to){ BZ=null; fetchBiz(P); }
  render();
}
function customSheet(){
  const P=period();
  openSheet(`<h3>Any dates</h3><p class="lede">The dashboard, the chart and the report follow whatever you pick.</p>
    <div style="display:flex;gap:8px">
      <div class="field" style="padding-left:0;padding-right:0;flex:1"><label>From</label><input class="inp" id="bizFrom" type="date" value="${esc(P.from)}"></div>
      <div class="field" style="padding-left:0;padding-right:0;flex:1"><label>To</label><input class="inp" id="bizTo" type="date" value="${esc(P.to)}"></div>
    </div>
    <button class="btn-pri btn-block" style="margin-top:16px" data-act="bizcustom">Show these dates</button>`);
}

/* ---------- LOADING. One read; the window widens to whatever the period needs and
   never shrinks back, so flicking between periods does not refetch. */
async function fetchBiz(P){
  const p=P||period(), t=new Date(), today=Biz.localDate(t.getTime());
  const yearAgo=Biz.localDate(new Date(t.getFullYear(),t.getMonth()-12,t.getDate()).getTime());   // the server's own default
  const from=[p.from,WIN?WIN.from:null,FLIGHT?FLIGHT.from:null,yearAgo].filter(Boolean).sort()[0];
  const to=[p.to,WIN?WIN.to:null,FLIGHT?FLIGHT.to:null,today].filter(Boolean).sort().pop();
  /* A read already in the air is reused only when it covers what is asked for. A
     wider ask starts its own, and the narrower answer is dropped when it lands —
     otherwise "All" tapped during a month's read would be painted as the month. */
  if(LOADING&&FLIGHT&&FLIGHT.from<=from&&FLIGHT.to>=to)return LOADING;
  const my=++REQ; FLIGHT={from,to};
  LOADING=(async()=>{
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'bizGet',from,to}),quiet:true});
    if(my!==REQ)return;   // a wider read, a calendar write or a sign-out overtook this one
    /* api() hands back the body alone, so the status is read off the words: the
       owner-only refusal and the plan refusal are the two the tab tells apart. */
    const err=String((d&&d.error)||'');
    BZ=(d&&d.ok)?d:{ok:false,status:/account owner/i.test(err)?403:/Bar Star feature/.test(err)?402:0,error:err};
    if(BZ.ok){ WIN={from:BZ.from||from,to:BZ.to||to}; if(!BZ.biz.gigs)BZ.biz.gigs={}; if(!BZ.biz.rules)BZ.biz.rules={}; if(!BZ.biz.prefs)BZ.biz.prefs={hours:{}}; }
    LOADING=null; FLIGHT=null;
    /* The plan refused: it lapsed since the plan was read. Re-read it so the page
       follows the server — the free-plan tab paints and this module stops being asked. */
    if(BZ.status===402&&typeof loadPlan==='function')loadPlan(true);
    if(TAB==='money'&&D&&!typing())render();
  })();
  return LOADING;
}
/* Waits for an answer that stuck: a read overtaken by a wider one, a calendar write
   or a sign-out leaves BZ null when it lands, so the wait goes round again. */
const ensureLoaded=async()=>{ while(!BZ){ await fetchBiz(); } return BZ; };
/* THE BOOK IS STALE: the calendar changed under it (a gig added, moved, deleted or
   skipped on the Gigs tab, a rule saved), so the occurrences the server expanded
   at the last read are wrong. The window is kept so the next read covers the same
   span; the next paint of the tab starts it. */
function stale(){ BZ=null; LOADING=null; FLIGHT=null; REQ++; }
/* THE BOOK IS FORGOTTEN: sign-out, or a door back in that may be somebody else.
   Every piece of state in this file goes back to what it was before the first
   read — nothing of one account may greet the next one on the same phone. */
function forget(){ stale(); WIN=null; ED=null; PICKS=null; BARI=-1; MORE=false; SHOWN={}; ANIM=true; PULSE=false; GEN++; }

/* ---------- THE JOIN, once per paint. A gig that is on right now (started, not
   over, nothing filed yet) is tonight's business, not an unconfirmed night. */
function joined(){
  const now=Date.now(), P=period();
  const nights=(HIST&&HIST.ok&&HIST.shows)||[];
  const shows=Biz.join(nights,BZ.occ||[],BZ.biz,now).filter(s=>s.nights.length||!s.endsAt||s.endsAt<=now);
  const inP=shows.filter(s=>Biz.inRange(s,P.from,P.to));
  return {P,shows,inP,S:Biz.sum(inP,prefsOf(),P,cutPct()),prefs:prefsOf()};
}

/* ---------- THE SECTIONS ---------- */
function skeleton(){
  return `<div class="bizsk"><i style="height:38px"></i><i class="big"></i><div class="two"><i></i><i></i></div><div class="two"><i></i><i></i></div><i style="height:150px"></i></div>`;
}
function periodBar(P){
  return `<div class="chips scroll" data-hscroll>${KINDS.map(([k,l])=>`<button class="chip ${P.kind===k?'on':''}" data-act="bizperiod" data-id="${k}">${l}</button>`).join('')}</div>
  <div class="bizbar"><span class="rng">${dfull(P.from)} – ${dfull(P.to)}</span>
    <a class="btn-line" href="/report?from=${P.from}&to=${P.to}&hours=1">Generate report</a></div>`;
}
function hero(S,rise){
  const notes=[];
  /* The fee is MySet's cut of the app money, at the plan's rate (named as the
     plan's, not as a fact about every night — a range that straddles a plan change
     carried two). Stripe's fee is Stripe's to state. The founder's cut is 0 and is
     not a fee at all, so his sentence names only Stripe. */
  if(S.app>0&&cutPct()>0) notes.push(`<small class="fee">${cutPct()}% (${Biz.money(S.fee)}) goes to MySet for transaction fees</small>`);
  else if(S.app>0) notes.push(`<small>Includes ${Biz.money(S.app)} through the app before Stripe's fee.</small>`);
  if(S.appUnknown>0) notes.push(`<small>App money not available for ${plural(S.appUnknown,'show')}.</small>`);
  return `<div class="bizhero ${rise?'rise':''}"><div class="k">Profit</div>
    <b class="v mono ${S.profit<0?'neg':'pos'}" ${cu('profit',S.profit,'money')}>${Biz.money(S.profit)}</b>
    <div class="a">${plural(S.shows,'show')} · ${S.logged} logged${notes.join('')}</div></div>`;
}
/* What the hourly rate is a rate OF, in words, for the tile and the report line. */
function viewWords(S){
  const w=[VIEW.mine?'My cut':'Total'];
  if(S.app>0) w.push(VIEW.net?'after MySet fees':'before MySet fees');
  return w;
}
function tiles(S,rise){
  const on=Biz.TIME_KINDS.filter(([k])=>(prefsOf().hours||{})[k]!==false).map(([,l])=>l.toLowerCase());
  const timed=S.timed<S.shows?` · ${S.timed} of ${S.shows} shows timed`:'';
  const rate=Biz.rates(S.timedSum,VIEW).evening;
  const rateSub=rate==null?'Log hours on a show to see this':viewWords(S).concat(on.length===Biz.TIME_KINDS.length?'whole evening':on.join(', ')).join(' · ')+timed;
  return `<div class="biztiles ${rise?'rise':''}">
    <div class="c"><span class="bizhd">Revenue</span><b class="mono" ${cu('revenue',S.revenue,'money')}>${Biz.money(S.revenue)}</b></div>
    <div class="c"><span class="bizhd">Costs${S.band?' incl. splits':''}</span><b class="mono" ${cu('costs',S.costs+S.band,'money')}>${Biz.money(S.costs+S.band)}</b></div>
    <button class="c" type="button" data-act="bizhours"><i class="go">›</i><span class="bizhd">$/hour</span><b class="mono" ${cu('rate',rate,'rate')}>${rate==null?'—':Biz.money(rate)+'/h'}</b><small>${esc(rateSub)}</small></button>
    <div class="c"><span class="bizhd">Hours</span><b class="mono" ${cu('hours',S.includedMinutes,'hm')}>${S.includedMinutes?Biz.hm(S.includedMinutes):'—'}</b>${S.includedMinutes?'':'<small>None logged yet</small>'}</div>
  </div>`;
}
/* Twelve months, or one bar a show when the period is short enough to read that way.
   The heading is outside the box a bar tap redraws, so a tap never doubles it. */
function chart(S,P,anim){
  const box=chartBox(S,P,anim);
  return box?`<div class="sec"><span class="kick">Profit by ${chartByShow(P)?'show':'month'}</span></div>`+box:'';
}
const chartByShow=(P)=>Math.round((new Date(P.to)-new Date(P.from))/DAY)+1<=45;
function chartBox(S,P,anim){
  const byShow=chartByShow(P);
  const rows=byShow?S.byShow.slice().reverse():S.byMonth;
  if(!rows.length||!S.shows) return '';
  const vals=rows.map(r=>r.profit||0), max=Math.max(1,...vals.map(v=>Math.abs(v)));
  const W=360,H=134,top=26,base=H-10,n=rows.length,slot=W/n,bw=Math.min(18,Math.max(6,slot*.6));
  const nowI=byShow?n-1:rows.findIndex(r=>r.month===P.to.slice(0,7));
  const bars=rows.map((r,i)=>{
    const v=vals[i], x=i*slot+(slot-bw)/2, cur=i===nowI, lit=BARI===i;
    const hit=`<rect class="hit" x="${i*slot}" y="0" width="${slot}" height="${H}" fill="transparent" data-act="bizbar" data-id="${i}"/>`;
    if(v<0) return hit+`<rect x="${x}" y="${base+2}" width="${bw}" height="2" rx="1" fill="var(--accent)"/>`+(lit?label(x+bw/2,base-6,v):'');
    if(!v) return hit+`<rect x="${x}" y="${base-1}" width="${bw}" height="1" fill="var(--hair-2)"/>`+(lit?label(x+bw/2,base-6,0):'');
    const h=Math.max(3,Math.round((base-top)*v/max));
    return hit+`<rect class="bar" x="${x}" y="${base-h}" width="${bw}" height="${h}" rx="4" fill="${cur||lit?'url(#bizg-bar)':'var(--accent)'}" ${cur||lit?'':'opacity=".55"'} style="animation-delay:${i*30}ms"/>`
      +(lit||(cur&&BARI<0)?label(x+bw/2,base-h-7,v):'');
  }).join('');
  const lab=rows.map((r,i)=>`<span class="${i===nowI?'now':''}">${byShow?dlabel(r.date).split(' ').slice(-2).join(' ').slice(0,6):'JFMAMJJASOND'[+r.month.slice(5,7)-1]}</span>`).join('');
  return `<div class="echart bizchart ${anim?'anim':''}" id="bizchart"><svg viewBox="0 0 ${W} ${H}" aria-label="Profit by ${byShow?'show':'month'}">
    <defs><linearGradient id="bizg-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent-2)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
    <line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--hair-2)" stroke-width="1"/>${bars}</svg>
    <div class="ml" style="${byShow&&n>8?'font-size:9px':''}">${lab}</div></div>`;
}
const label=(x,y,v)=>`<text x="${x}" y="${y}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)" class="mono">${Biz.money(v)}</text>`;
function mix(S,anim){
  const parts=S.mix.filter(p=>p.cents>0);
  const total=parts.reduce((a,p)=>a+p.cents,0);
  if(!(total>0)) return '';
  const r=44,c=2*Math.PI*r; let off=0;
  const arcs=parts.map((p,i)=>{ const len=c*p.cents/total;
    const s=`<circle cx="56" cy="56" r="${r}" fill="none" stroke="${MIXC[p.k]}" stroke-width="14" stroke-dasharray="${anim?`0 ${c}`:`${len} ${c-len}`}" data-d="${len} ${c-len}" stroke-dashoffset="${-off}" transform="rotate(-90 56 56)" style="transition-delay:${i*120}ms"/>`;
    off+=len; return s; }).join('');
  return `<div class="sec"><span class="kick">Where it came from</span></div>
  <div class="donut biz" id="bizdonut"><svg viewBox="0 0 112 112" aria-label="Revenue mix">${arcs}
    <text x="56" y="54" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)" class="mono">${Biz.money(total).replace(/\.\d\d$/,'')}</text>
    <text x="56" y="70" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--faint)">revenue</text></svg>
    <div class="lg">${parts.map(p=>`<div><span><i style="background:${MIXC[p.k]}"></i>${p.label}</span><b class="mono">${Biz.money(p.cents)}</b><small>${Math.round(100*p.cents/total)}%</small></div>`).join('')}</div></div>
  <p class="biznote">Through the app = votes and tips fans paid through MySet, before MySet's cut and Stripe's fee. Merch sold through the app is listed under Merch and is not in this figure — log it above if you want it counted.</p>`;
}
/* Every hour of every show in the period, stacked by kind — the total the act
   put in, not one night — and the two rates over them. */
function evening(S){
  const tot=Biz.TIME_KINDS.reduce((a,[k])=>a+(S.minutes[k]||0),0);
  if(!tot) return '';
  const R=Biz.rates(S.timedSum,VIEW);
  return `<div class="sec"><span class="kick">Total time invested</span><span class="kick">${Biz.hm(tot)} · ${plural(S.timed,'show')}</span></div>
  <div class="bizeve"><div class="stack">${Biz.TIME_KINDS.map(([k])=>S.minutes[k]?`<i style="width:${100*S.minutes[k]/tot}%;background:${TIMEC[k]}"></i>`:'').join('')}</div>
    <div class="lg">${Biz.TIME_KINDS.map(([k,l])=>S.minutes[k]?`<span><i style="background:${TIMEC[k]}"></i>${l} ${Biz.hm(S.minutes[k])}</span>`:'').join('')}</div>
    <div class="rates"><div><span class="bizhd">Stage time rate</span><b class="mono" data-rate="stage">${R.stage==null?'—':Biz.money(R.stage)+'/h'}</b></div>
      <div><span class="bizhd">Full evening rate</span><b class="mono" data-rate="evening">${R.evening==null?'—':Biz.money(R.evening)+'/h'}</b></div></div>
    ${viewControls(S)}</div>`;
}
/* The two readings of the rate — the toggle between the whole act and the
   artist's own cut, and the fee button when the period has app money to take
   a fee from. Drawn under the rates and again on the $/hour tile's sheet. */
function viewControls(S){
  const seg=`<span class="bizseg" role="group" aria-label="Whose rate"><button type="button" class="${VIEW.mine?'':'on'}" data-act="bizview" data-id="total">Total</button><button type="button" class="${VIEW.mine?'on':''}" data-act="bizview" data-id="mine">My cut</button></span>`;
  const fee=S.app>0?`<button type="button" class="bizfee" data-act="bizfee">${feeWords()}</button>`:'';
  return `<div class="bizctl">${seg}${fee}</div>`;
}
const feeWords=()=>VIEW.net?'Rates are after MySet\u2019s transaction fees \u2014 tap for pre-fee rates':'Rates are before MySet\u2019s transaction fees \u2014 tap for post-fee rates';
function showRow(s,S){
  const c=s.counted?Biz.calc(s.gig,s.app,prefsOf()):null;
  /* A record whose gig has left the calendar (moved, deleted, skipped) is still a
     show the artist logged: listed by its date, counted, and open to remove. */
  const name=esc(s.title||s.venue||(s.orphanRecord?'Logged show':'Untitled show'));
  const pay=s.gig&&s.gig.pay!=null?Biz.money(s.gig.pay):'';
  const by=s.source==='rule'?`${pay?pay+' ':''}from the ${s.repeating?'run':'gig'}`:pay?`${pay} paid`:s.source==='none'?'Nothing logged':'';
  const sub=s.nights.length?`${s.appKnown?Biz.money(s.app)+' through the app':'app money not available'} · ${plural(s.votes,'vote')}`:s.source==='rule'&&!s.counted?'Not confirmed — was it played?':s.orphanRecord?'Its gig is no longer on your calendar — the numbers are kept':'';
  const picking=PICKS!==null;
  const acts=picking?'':(s.counted?'':`<button class="btn-text" data-act="bizopen" data-id="${esc(s.key)}">Log it</button>${s.occ&&s.source==='rule'?`<button class="btn-text" data-act="bizskip" data-id="${esc(s.occ.eventId)}|${esc(s.date)}">Didn't happen</button>`:''}`)
    +(s.nights.length&&!s.appKnown?`<button class="btn-text" data-act="bizrecon" data-id="${esc(s.nights[0].showId)}">Re-check</button>`:'');
  const chip=c?`<span class="bizchip ${c.profit<0?'neg':'pos'} mono">${Biz.money(c.profit)}</span>`:'';
  return `<div class="row" data-act="${picking?'bizpick':'bizopen'}" data-id="${esc(s.key)}" style="cursor:pointer">
    ${picking?`<input type="checkbox" class="bizck" ${PICKS.has(s.key)?'checked':''} tabindex="-1" aria-label="Pick ${name}">`:''}
    <div class="m"><div class="t">${dlabel(s.date)} · ${name}</div>${by?`<div class="by">${by}</div>`:''}${sub?`<div class="s">${sub}</div>`:''}${acts?`<div class="bizacts">${acts}</div>`:''}</div>
    ${chip}</div>`;
}
function showsList(inP,S,P){
  const q=String(HISTQ||'').toLowerCase().split(/\s+/).filter(Boolean);
  const hay=s=>[s.title,s.venue,s.city,s.date,dlabel(s.date),dfull(s.date)].filter(Boolean).join(' ').toLowerCase();
  const all=q.length?inP.filter(s=>{const h=hay(s);return q.every(w=>h.includes(w));}):inP;
  /* Three at first, the rest behind Show more — a search or Pick shows lists every row. */
  const folded=!MORE&&!q.length&&!PICKS&&all.length>FOLD, rows=folded?all.slice(0,FOLD):all;
  const n=PICKS?PICKS.size:0;
  const right=PICKS?`<button class="btn-line" id="bizpickbtn" style="padding:8px 14px;font-size:13px" data-act="bizreport" ${n?'':'disabled'}>Report ${n} show${n===1?'':'s'}</button>`
                   :`<button class="btn-text" style="padding:0" data-act="bizpickmode">Pick shows</button>`;
  const weeks=Math.max(1,Math.round((new Date(P.to)-new Date(P.from))/DAY+1)/7);
  const sparse=inP.length<4*weeks;
  return `<div class="sec"><span class="kick">Shows${q.length?` · ${rows.length} of ${inP.length}`:''}</span>${PICKS?`<span style="display:flex;gap:6px;align-items:center">${right}<button class="btn-text" style="padding:0 4px" data-act="bizpickmode">Cancel</button></span>`:right}</div>
  ${inP.length>12?`<div class="find" style="margin-bottom:8px"><svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 17 17"/></svg>
    <input id="histq" type="search" placeholder="Find a show — venue, city, date…" value="${esc(HISTQ||'')}" autocomplete="off"></div>`:''}
  <div class="list">${rows.map(s=>showRow(s,S)).join('')||`<div class="row muted">Nothing matches “${esc(HISTQ||'')}”.</div>`}
    ${folded?`<button class="row bizmore" type="button" data-act="bizmore">Show ${all.length-FOLD} more</button>`:MORE&&!q.length&&!PICKS&&all.length>FOLD?`<button class="row bizmore" type="button" data-act="bizmore">Show fewer</button>`:''}
    ${sparse?`<div class="row muted">Played a night MySet wasn't at? Add it on the Gigs tab — past dates are fine — and it shows up here.</div>`:''}</div>
  ${BZ.dropped>0?`<p class="muted" style="font-size:12px;padding:10px 18px 0;margin:0">MySet keeps your last ${((HIST&&HIST.shows)||[]).length} nights; ${BZ.dropped} older ones are not shown.</p>`:''}
  <div class="wrap bizfoot2" style="margin-top:6px;display:flex;flex-wrap:wrap;gap:0 4px"><button class="btn-text" onclick="healHist()">Look for missing shows</button><button class="btn-text" onclick="placeHist()">Name these from my calendar</button></div>`;
}
function merch(S,P){
  const app=(ORDERS||[]).filter(o=>{ const d=Biz.localDate(o.at||0); return d>=P.from&&d<=P.to; });
  if(!S.merchBy.length&&!app.length) return '';
  return `<div class="sec"><span class="kick">Merch</span><span class="kick">${Biz.money(S.merch)}</span></div>
  <div class="list">${S.merchBy.map(m=>`<div class="row"><div class="m"><div class="t">${esc(m.name)}</div><div class="s">${m.qty} sold · logged by hand</div></div><div class="cnt mono">${Biz.money(m.cents)}</div></div>`).join('')||'<div class="row muted">Nothing logged by hand this period — add merch sold on a show.</div>'}</div>
  ${app.length?`<div class="sec"><span class="kick">Merch through the app</span><span class="kick">${app.length}</span></div>
  <div class="list">${app.slice(0,40).map(o=>`<div class="row"><div class="m"><div class="t">${esc(o.title)}${o.qty>1?' × '+o.qty:''}</div><div class="s">${dstamp(o.at)}</div></div><div class="cnt mono">$${Number(o.amount||0).toFixed(2)}</div></div>`).join('')}</div>`:''}`;
}
function band(S){
  if(!S.bandBy.length) return '';
  return `<div class="sec"><span class="kick">Splits</span><span class="kick">${Biz.money(S.band)}</span></div>
  <div class="list">${S.bandBy.map(b=>`<div class="row"><div class="m"><div class="t">${esc(b.name)}</div><div class="s">${plural(b.shows,'show')} · for tax time</div></div><div class="cnt mono">${Biz.money(b.cents)}</div></div>`).join('')}</div>`;
}
function costs(S){
  if(!S.costsBy.length) return '';
  return `<div class="sec"><span class="kick">Costs</span><span class="kick">${Biz.money(S.costs)}</span></div>
  <div class="list">${S.costsBy.map(c=>`<div class="row"><div class="m"><div class="t">${esc(c.name)}</div><div class="s">${plural(c.n,'time')}</div></div><div class="cnt mono">${Biz.money(c.cents)}</div></div>`).join('')}</div>`;
}
function emptyState(shows,P){
  const t=Biz.period('30d'), from90=Biz.localDate(Date.now()-89*DAY);
  const recent=shows.filter(s=>s.date>=from90&&s.date<=t.to), in30=recent.some(s=>s.date>=t.from);
  return `<div class="list" style="margin-top:14px"><div class="row muted"><b style="display:block;font-size:16px;margin-bottom:4px">Nothing logged for this period yet</b>
    ${recent.length?`<span class="muted" style="font-size:13px">You have ${plural(recent.length,'show')} in the last 90 days.</span>
      <div style="margin-top:12px"><button class="btn-ink" data-act="bizperiod" data-id="${in30?'30d':'90d'}">Log a show</button></div>`
    :`<span class="muted" style="font-size:13px;line-height:1.5;display:block">Every show you play gets a row here: what you were paid, who in the band got what, tips, merch, costs and hours.<br>The tab adds them up into profit, a revenue mix and a real $/hour, and prints a report for your accountant.<br>Played a night MySet wasn't at? Add it on the Gigs tab — past dates are fine — and it shows up here.</span>`}</div></div>`;
}

/* ---------- THE TAB ---------- */
function tab(){
  css();
  const gen=++GEN;
  if(BZ===null){ fetchBiz(); return skeleton(); }
  if(!BZ.ok){
    /* The plan lapsed since it was read (the free plan's own row is gated on a
       history that is cached): paint that row here so the tab is never empty. */
    if(BZ.status===402){ const n=((HIST&&HIST.ok&&HIST.shows)||[]).length;
      return `<div class="sec"><span class="kick">Business dashboard</span><span class="kick">${n}</span></div>
      <div class="list"><div class="row" style="flex-wrap:wrap">
        <div class="m" style="flex:1 1 100%"><div class="t">${n?`${plural(n,'night')} filed and waiting`:'Every night gets filed here'}</div>
          <div class="s">The business dashboard — fans, votes and tips plus your pay, splits, costs, hours and profit for every show — is a Bar Star feature. Upgrade and ${n?'all of them open':'they open as you play'}.</div></div>
        <button class="act" onclick="openPlans()">See plans</button></div></div>`; }
    if(BZ.status===403) return `<div class="list" style="margin-top:14px"><div class="row muted">The business dashboard is the account owner's.</div></div>`;
    return `<div class="list" style="margin-top:14px"><div class="row muted" data-act="bizretry" style="cursor:pointer">Couldn't load the dashboard — tap to try again.</div></div>`;
  }
  const {P,shows,inP,S}=joined();
  const anim=ANIM&&!rm(); ANIM=false;
  requestAnimationFrame(()=>after(gen));
  if(!inP.length) return periodBar(P)+emptyState(shows,P);
  return [
    periodBar(P),
    hero(S,anim),
    tiles(S,anim),
    chart(S,P,anim),
    mix(S,anim),
    evening(S),
    showsList(inP,S,P),
    merch(S,P),
    band(S),
    costs(S),
  ].join('');
}
/* After the paint: the donut sweeps, the tiles count up from what they last said
   (≤ 700 ms, none under reduced motion), the hero pulses once after a save. Every
   timer checks the generation so a repaint mid-flight stops the old one. */
function after(gen){
  if(gen!==GEN)return;
  document.querySelectorAll('#bizdonut circle[data-d]').forEach(c=>{ c.style.strokeDasharray=c.getAttribute('data-d'); });
  const quiet=rm();
  document.querySelectorAll('[data-cu]').forEach(el=>{
    const k=el.getAttribute('data-k'), v=el.getAttribute('data-cu')===''?null:Number(el.getAttribute('data-cu')), fmt=el.getAttribute('data-fmt');
    const was=SHOWN[k]; SHOWN[k]=v;
    if(quiet||was==null||v==null||was===v)return;
    const f=fmt==='hm'?Biz.hm:fmt==='rate'?(x=>Biz.money(x)+'/h'):Biz.money, t0=performance.now(), dur=Math.min(700,300+Math.abs(v-was)/50);
    const step=(t)=>{ if(gen!==GEN||!el.isConnected)return; const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
      el.textContent=f(Math.round(was+(v-was)*e)); if(p<1)requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  if(PULSE){ PULSE=false; const h=$m('.bizhero'); if(h&&!quiet){ h.classList.add('pulse'); setTimeout(()=>h.classList.remove('pulse'),700); } }
}
function reset(){ ANIM=true; BARI=-1; PICKS=null; MORE=false; }

/* "Log tonight" under the Tonight / last show tiles, once the night is filed and
   the dashboard knows which gig it was. */
function tonight(L){
  if(!L||L.status!=='ended'||!BZ||!BZ.ok)return '';
  const s=joined().shows.find(x=>x.nights.some(n=>n.showId===L.showId));
  if(!s)return '';
  return `<div class="wrap" style="margin-top:12px">${s.source==='gig'
    ?`<button class="btn-ink btn-block" data-act="bizopen" data-id="${esc(s.key)}">Edit tonight's numbers</button>`
    :`<button class="btn-pri btn-block" data-act="bizopen" data-id="${esc(s.key)}">Log tonight</button>`}</div>`;
}

/* ---------- THE ROWS. Each builder returns a string the editor and the gig form
   both use; readRows() reads the same markup back. `stored` is what the server
   already holds, because a cap is enforced against growth, not size (D10). */
const capLine=(kind,n,lim,stored)=>{
  const P=(PLAN&&PLAN.plans)||{}, top=Number((P.pro||{})[kind])||lim, plusN=Number((P.plus||{})[kind])||lim;
  const word=kind==='band'?'band members':'costs', pro=PLAN&&PLAN.plan==='pro';
  const see=`<button class="btn-text" type="button" onclick="openPlans()">See plans</button>`;
  if(stored>lim) return `<p class="cap">${n} of ${lim} — from your Rock Star months ${see}</p>`;
  if(pro||lim>=top) return `<p class="cap">That's the ${top} Rock Star allows</p>`;
  return `<p class="cap">Bar Star allows ${plusN} ${word} a show — Rock Star allows ${top} ${see}</p>`;
};
/* A dollar sign that stays: a placeholder vanishes once a number is typed, and a
   reopened merch row read "3  60" with nothing saying which was the money. */
const moneyBox=(input)=>`<span class="bzmoney"><i aria-hidden="true">$</i>${input}</span>`;
const lineRow=(kind,r,i)=>`<div class="bzrow" data-kind="${kind}">
  <input class="inp bzname" maxlength="${Biz.LIMITS.name}" placeholder="${kind==='band'?'Name':kind==='merch'?'Item':'What for'}" value="${esc((r&&r.name)||'')}" ${kind==='merch'?'list="bizmerchdl"':''}>
  ${kind==='merch'?`<input class="inp bzqty mono" inputmode="numeric" placeholder="Qty" aria-label="Quantity" value="${r&&r.qty?r.qty:''}"><i class="bzt" aria-hidden="true">×</i>`:''}
  ${moneyBox(`<input class="inp bzcents mono" inputmode="decimal" placeholder="${kind==='merch'?'total':''}" aria-label="${kind==='merch'?'Line total in dollars':'Dollars'}" value="${esc(dollars(r&&r.cents!=null?r.cents:null))}">`)}
  <button class="bzx" type="button" data-act="bizrm" aria-label="Remove">✕</button></div>`;
const foot=(kind,n,lim,have,cap)=>{
  const add=kind==='band'?'+ Add band member':kind==='merch'?'+ Add merch':'+ Add a cost';
  if(n<cap) return `<button class="btn-grey" type="button" data-act="bizadd" data-id="${kind}">${add}${lim!=null?` <span class="muted" style="font-weight:500">${n} of ${lim}</span>`:''}</button>`;
  return lim!=null?capLine(kind,n,lim,have):`<p class="cap">That's the ${cap} lines a show holds</p>`;
};
const rows={
  pay:(g)=>`<div class="field"><label>Total pay from venue</label>${moneyBox(`<input class="inp bz mono" data-f="pay" inputmode="decimal" value="${esc(dollars(g.pay))}">`)}</div>`,
  lines:(kind,g,stored,lim)=>{
    const L=g[kind]||[], have=(stored&&stored[kind]||[]).length, cap=lim==null?Biz.LIMITS.merch:Math.max(lim,have);
    const title=kind==='band'?'Splits':kind==='merch'?'Merch sold':'Costs';
    return `<div class="field" data-rows="${kind}" data-have="${have}" data-lim="${lim==null?'':lim}"><label>${title}</label><div class="bzrows">${L.map((r,i)=>lineRow(kind,r,i)).join('')}</div>
      ${kind==='band'?rows.cut(g):''}<div class="bzfoot">${foot(kind,L.length,lim,have,cap)}</div></div>`;
  },
  band:(g,stored)=>rows.lines('band',g,stored,limitsOf().band),
  costs:(g,stored)=>rows.lines('costs',g,stored,limitsOf().costs),
  merch:(g)=>rows.lines('merch',g,null,null),
  /* The artist's own share, blank unless it differs from what is left after the
     splits and the costs — the editor's readout writes that figure in as the
     placeholder, so the field always says what blank means. */
  cut:(g)=>`<div class="bzcut"><label>My cut</label>${moneyBox(`<input class="inp bz mono" data-f="cut" inputmode="decimal" placeholder="What's left" value="${esc(dollars(g.cut))}">`)}<p class="hint">Leave blank if what's left after the splits and costs is yours.</p></div>`,
  tips:(g)=>`<div class="field"><label>Cash tips</label>${moneyBox(`<input class="inp bz mono" data-f="tips" inputmode="decimal" value="${esc(dollars(g.tips))}">`)}</div>`,
  /* Which kinds count toward $/hour is the dashboard's choice (the $/hour tile),
     never a question asked while logging a night. */
  time:(g,opts)=>`<div class="field"><label>Time</label>${Biz.TIME_KINDS.map(([k,l])=>`<div class="trow"><label>${l} · hours</label>
      <input class="inp bzmin mono${opts&&opts.slot?' wide':''}" data-k="${k}" inputmode="decimal" placeholder="${k==='perform'&&opts&&opts.slot?esc(Biz.hm(opts.slot)+' from the gig'):'h:mm'}" value="${esc(Biz.hm(g.min&&g.min[k]))}"></div>`).join('')}
    <p class="hint">“2:15”, “2h 15m” or just “2” — a bare number is hours.</p></div>`,
  gear:(g)=>`<div class="field"><label>Gear</label><textarea class="inp bzgear" rows="3" placeholder="• Taylor 314">${esc(g.gear&&g.gear.length?Biz.bullets.toText(g.gear):'• ')}</textarea></div>`,
  note:(g)=>`<div class="field"><label>Note</label><input class="inp bznote" maxlength="${Biz.LIMITS.note}" placeholder="Anything worth remembering" value="${esc(g.note||'')}"></div>`,
};
const datalist=()=>`<datalist id="bizmerchdl">${(MERCH||[]).map(m=>`<option value="${esc(m.title)}" data-cents="${Number(m.cents)||0}">`).join('')}</datalist>`;
/* The gig form's block: Pay / Splits / Costs / Time / Gear (no tips, merch or note —
   those are a night's, not a run's). */
function form(g,stored,opts){
  g=Object.assign(Biz.empty(),g||{});
  return `<div class="bizf">${rows.pay(g)}${rows.band(g,stored)}${rows.costs(g,stored)}${rows.time(g,opts||{})}${rows.gear(g)}</div>`;
}
function readRows(root){
  const g=Biz.empty();
  const v=(q)=>{ const el=$m(q,root); return el?el.value:''; };
  const pay=$m('.bz[data-f="pay"]',root), tips=$m('.bz[data-f="tips"]',root), cut=$m('.bz[data-f="cut"]',root);
  if(pay)g.pay=toCents(pay.value); if(tips)g.tips=toCents(tips.value); if(cut)g.cut=toCents(cut.value);
  for(const kind of ['band','costs','merch']){
    const box=$m(`[data-rows="${kind}"]`,root); if(!box)continue;
    g[kind]=[...box.querySelectorAll('.bzrow')].map(r=>{
      const o={name:$m('.bzname',r).value.trim(),cents:toCents($m('.bzcents',r).value)||0};
      if(kind==='merch')o.qty=Math.max(0,Math.round(Number($m('.bzqty',r).value))||0);
      return o; });
  }
  root.querySelectorAll('.bzmin').forEach(i=>{ const m=Biz.parseHm(i.value); g.min[i.getAttribute('data-k')]=Number.isNaN(m)?null:m; });
  const gear=$m('.bzgear',root); if(gear)g.gear=Biz.bullets.fromText(gear.value);
  const note=$m('.bznote',root); if(note)g.note=note.value;
  return Biz.norm(g);
}
const any=(g)=>!!(g&&(g.pay!=null||g.cut!=null||g.tips!=null||g.band.length||g.costs.length||g.merch.length||g.gear.length||g.note||Biz.TIME_KINDS.some(([k])=>g.min[k]!=null)));

/* ---------- THE EDITOR SHEET ---------- */
/* The draft is the account's, not the phone's: a draft written by one owner must
   not come back over another owner's night of the same key on a shared phone. */
function draftRead(key){ try{ const d=JSON.parse(localStorage.getItem(DRAFT)||'null'); return d&&d.key===key&&d.who===who()&&Date.now()-(d.at||0)<DAY?d.gig:null; }catch(e){ return null; } }
function draftWrite(key,gig){ try{ localStorage.setItem(DRAFT,JSON.stringify({key,who:who(),gig,at:Date.now()})); }catch(e){} }
function draftClear(){ try{ localStorage.removeItem(DRAFT); }catch(e){} }
async function openBiz(key){
  css();
  if(MERCH===null&&typeof loadMerch==='function')loadMerch();
  await ensureLoaded();
  if(!BZ||!BZ.ok){ toast(BZ&&BZ.status===403?"The business dashboard is the account owner's":'Couldn’t load the dashboard just now'); return; }
  const s=joined().shows.find(x=>x.key===key)||{key,date:(Biz.parseKey(key)||{}).date||'',venue:'',title:'',nights:[],occ:null,biz:BZ.biz.gigs[key]||null,rule:null,source:BZ.biz.gigs[key]?'gig':'none'};
  /* `rec` is the night's own record; `stored` is what the server already holds for
     it — the record, or the run's rule the first time — because a cap is enforced
     against growth (D10): a night pre-filled from a Rock Star rule stays saveable
     after a downgrade. The record lives under the key it was first saved with
     (bizKey), which can differ from the show's once a night learns its gig. */
  const rec=s.biz||null, stored=rec||s.rule||null, draft=draftRead(key), saveKey=s.bizKey||key;
  const base=Biz.norm(stored||{});
  if(!rec&&s.occ&&base.min.perform==null&&s.occ.endsAt>s.occ.startsAt) base.min.perform=Math.round((s.occ.endsAt-s.occ.startsAt)/60000);
  const g=draft?Biz.norm(draft):base;
  ED={key,saveKey,show:s,stored,base};
  const name=esc(s.title||s.venue||'This show');
  openSheet(`<div class="bizro"><div class="k">Profit for this show</div><b class="mono" id="bizro"></b></div>
    <h3>${rec?'Edit this show':'Log a show'}</h3>
    <p class="lede"><b>${dlabel(s.date)} · ${name}.</b> ${s.nights.length?(s.appKnown?`${Biz.money(s.app)} came through the app that night, before fees.`:'The app money for this night is not available — Re-check it from the list.'):s.source==='rule'&&!rec?'Started from the run’s usual numbers — change anything that was different.':'Only what you type here is counted.'}</p>
    ${s.nights.length?`<p class="bizvotes">${esc(Biz.votesLine(s))}${s.paidVotes==null?' <span class="muted">· paid votes and requests not counted for this night — Re-check it from the list</span>':''}</p>`:''}
    ${draft?`<p class="muted" style="font-size:12.5px;margin:-8px 0 12px">Your unsaved numbers from earlier are back.</p>`:''}
    <div class="bizf" id="bizf">${datalist()}${rows.pay(g)}${rows.band(g,stored)}${rows.tips(g)}${rows.merch(g)}${rows.costs(g,stored)}${rows.time(g)}${rows.gear(g)}${rows.note(g)}</div>
    <button class="btn-pri btn-block" style="margin-top:18px" data-act="bizsave">Save</button>
    <div style="display:flex;justify-content:space-between;flex-wrap:wrap;margin-top:6px">
      ${s.nights.length?`<button class="btn-text" data-act="biznight" data-id="${esc(s.nights[0].showId)}">What you played</button>`:'<span></span>'}
      <a class="btn-text" href="/report?shows=${encodeURIComponent(key)}&hours=1">Report this show</a></div>
    ${rec?`<button class="btn-text btn-block" style="color:var(--muted)" data-act="bizremove">Remove this show's numbers</button>`:''}`,'biz');
  readout();
}
/* The readout and the "your take" line, recomputed on every keystroke; never render(). */
function readout(write){
  const root=$m('#bizf'); if(!root||!ED)return;
  const g=readRows(root), c=Biz.calc(g,ED.show.app,prefsOf());
  const ro=$m('#bizro'); if(ro){ ro.className='mono '+(c.profit<0?'neg':c.profit>0?'pos':''); ro.innerHTML=`${Biz.money(c.profit)}${c.rate!=null?`<small>${Biz.money(c.rate)}/h</small>`:''}`; }
  const cut=$m('.bz[data-f="cut"]',root); if(cut) cut.placeholder=`${dollars(c.profit)||'0'} — what's left`;
  /* A draft equal to what the sheet opened with is no draft: an empty row added and
     closed again must not announce "unsaved numbers" next time. */
  if(write){ if(sameGig(g,ED.base))draftClear(); else draftWrite(ED.key,g); }
}
async function saveShow(btn){
  const root=$m('#bizf'); if(!root||!ED)return;
  if(root.querySelector('.bzmin.bad')){ toast('One of the times needs fixing first'); return; }
  const gig=readRows(root), key=ED.saveKey;
  btn.disabled=true; btn.textContent='Saving…';
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'bizSave',key,gig}),quiet:true});
  if(!d||!d.ok){ btn.disabled=false; btn.textContent='Save'; toast((d&&d.error)||"Couldn't save — your numbers are still here"); return; }
  if(BZ&&BZ.ok)BZ.biz.gigs[key]=d.gig;
  draftClear(); ED=null; closeSheet(); PULSE=true; render(); toast('Logged');
}
async function removeShow(){
  if(!ED||!await ask({title:'Remove the numbers?',lede:'This show\u2019s log is cleared. The filed night itself stays.',yes:'Yes, remove them',no:'Keep them'}))return;
  const key=ED.saveKey;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'bizSave',key,remove:true}),quiet:true});
  if(!d||!d.ok){ toast((d&&d.error)||"Couldn't remove that just now"); return; }
  if(BZ&&BZ.ok)delete BZ.biz.gigs[key];
  draftClear(); ED=null; closeSheet(); render(); toast('Removed');
}
/* The run's defaults, written after the gig itself saved (§8) — its own toast, never
   in the way of the gig save. An emptied form removes a rule that existed. */
async function saveRule(id,gig){
  const had=!!(BZ&&BZ.ok&&BZ.biz.rules[id]);
  if(!any(gig)&&!had)return;
  const body=any(gig)?{action:'bizSave',rule:id,gig}:{action:'bizSave',rule:id,remove:true};
  const d=await api('/admin',{method:'POST',body:JSON.stringify(body),quiet:true});
  if(!d||!d.ok){ toast((d&&d.error)||"Couldn't save the business side — open the gig and try again"); return; }
  if(BZ&&BZ.ok){ if(any(gig))BZ.biz.rules[id]=d.gig; else delete BZ.biz.rules[id]; }
  /* A new rule changes what every unlogged slot of the run says; the book is
     re-read rather than patched, and straight away if the tab is on screen. */
  stale(); if(TAB==='money'&&D)fetchBiz();
}
/* The gig form asks for its block once the module and the book are here. */
async function fillGigForm(id){
  await ensureLoaded();
  const box=$m('#gBizBody'); if(!box)return;
  const rule=(BZ&&BZ.ok&&BZ.biz.rules[id])||null;
  const g=Object.assign(Biz.empty(),rule||{});
  /* The slot's length is shown as the placeholder, never written as the value: a
     value would count as "something typed" and every plain gig save would write a
     rule (an extra write, every slot "from the gig", nights timed at the slot with
     $0 pay). The editor still pre-fills a new night's On stage from its occurrence. */
  const t=$m('#gTime'), e=$m('#gEnd'); let slot=null;
  if(g.min.perform==null&&t&&e&&t.value&&e.value){ const [h1,m1]=t.value.split(':').map(Number),[h2,m2]=e.value.split(':').map(Number);
    let m=(h2*60+m2)-(h1*60+m1); if(m<=0)m+=1440; slot=m; }
  box.innerHTML=BZ&&BZ.ok?form(g,rule,{slot}):`<p class="muted" style="font-size:12.5px;margin:0">Couldn't load the business side just now — the gig still saves.</p>`;
  const det=$m('#gBiz'); if(det&&rule)det.open=true;
}
function hoursSheet(){
  const on=prefsOf().hours||{}, S=joined().S;
  openSheet(`<h3>What counts as work</h3><p class="lede">Your $/hour is profit over the hours you switch on here. The set is the job, but so is the drive.</p>
    <div class="bizf"><div class="bizhours">${Biz.TIME_KINDS.map(([k,l])=>`<button class="pill ${on[k]!==false?'on':''}" style="font-size:14px;padding:10px 15px" type="button" data-act="bizhk" data-id="${k}">${l}</button>`).join('')}</div>
    <p class="hint" style="margin:0 0 8px">Whose rate, and before or after MySet's fee — the whole act's profit, or your own cut of it.</p>${viewControls(S)}</div>
    <p class="muted" style="font-size:12.5px">Saved as you tap. The report follows the hours you count.</p>`);
}
/* The view toggles: the tab repaints under the sheet, and every copy of the
   toggle on screen — the sheet's, the evening box's — follows. */
function setView(patch){
  VIEW=Object.assign({},VIEW,patch);
  try{ localStorage.setItem('myset.biz.view',JSON.stringify(VIEW)); }catch(e){}
  document.querySelectorAll('[data-act="bizview"]').forEach(b=>b.classList.toggle('on',(b.dataset.id==='mine')===VIEW.mine));
  document.querySelectorAll('[data-act="bizfee"]').forEach(b=>{ b.textContent=feeWords(); });
  render();
}
async function toggleHour(k,btn){
  if(!BZ||!BZ.ok)return;
  const h=BZ.biz.prefs.hours=Object.assign({},BZ.biz.prefs.hours||{});
  h[k]=h[k]===false;
  document.querySelectorAll(`[data-act="bizhk"][data-id="${k}"]`).forEach(b=>b.classList.toggle('on',h[k]));
  readout(); render();
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'bizPrefs',hours:h}),quiet:true});
  if(!d||!d.ok)toast((d&&d.error)||"Couldn't save that choice");
  else if(d.prefs)BZ.biz.prefs=d.prefs;
}
/* Inputs: the readout follows every keystroke in the editor; a time is parsed on
   the way out and shakes if it makes no sense; a merch name picked from the list
   fills its total; the gear box keeps its bullets. */
document.addEventListener('input',e=>{
  const t=e.target, f=t.closest&&t.closest('.bizf'); if(!f)return;
  if(t.classList.contains('bzmin'))t.classList.remove('bad');
  if(t.classList.contains('bzname')&&t.closest('[data-kind="merch"]')){
    const row=t.closest('.bzrow'), tot=$m('.bzcents',row), qty=$m('.bzqty',row);
    const m=(MERCH||[]).find(x=>String(x.title||'').toLowerCase()===t.value.trim().toLowerCase());
    if(m&&m.cents&&!tot.value){ if(!qty.value)qty.value='1'; tot.value=dollars(m.cents*(Number(qty.value)||1)); }
  }
  if(f.id==='bizf')readout(true);
});
document.addEventListener('focusout',e=>{
  const t=e.target; if(!t.classList||!t.classList.contains('bzmin'))return;
  const m=Biz.parseHm(t.value);
  /* The refocus waits a tick; by then the sheet may have been dismissed (✕, Escape,
     the grab zone also blur the field), and focus must not land in a hidden sheet. */
  if(Number.isNaN(m)){ t.classList.add('bad'); setTimeout(()=>{ const sh=t.closest('#sheet'); if(document.contains(t)&&(!sh||sh.classList.contains('on'))) try{ t.focus(); }catch(x){} },0); return; }
  t.classList.remove('bad'); t.value=Biz.hm(m);
});
document.addEventListener('keydown',e=>{
  const t=e.target; if(!t.classList||!t.classList.contains('bzgear'))return;
  const v=t.value, a=t.selectionStart, b=t.selectionEnd;
  if(e.key==='Enter'){ e.preventDefault(); t.value=v.slice(0,a)+'\n• '+v.slice(b); t.selectionStart=t.selectionEnd=a+3; t.dispatchEvent(new Event('input',{bubbles:true})); }
  else if(e.key==='Backspace'&&a===b&&/(^|\n)• $/.test(v.slice(0,a))){ e.preventDefault(); const cut=v.slice(0,a).replace(/\n?• $/,''); t.value=cut+v.slice(a); t.selectionStart=t.selectionEnd=cut.length; t.dispatchEvent(new Event('input',{bubbles:true})); }
});
document.addEventListener('paste',e=>{
  const t=e.target; if(!t.classList||!t.classList.contains('bzgear'))return;
  const txt=(e.clipboardData||window.clipboardData).getData('text'); if(!txt)return;
  e.preventDefault();
  const lines=Biz.bullets.fromText(txt); if(!lines.length)return;
  const a=t.selectionStart, b=t.selectionEnd, before=t.value.slice(0,a).replace(/• $/,''), ins=Biz.bullets.toText(lines);
  t.value=before+ins+t.value.slice(b); t.selectionStart=t.selectionEnd=(before+ins).length; t.dispatchEvent(new Event('input',{bubbles:true}));
});

/* ---------- TAPS. studio.js's dispatcher hands over every data-act that starts
   with "biz"; `b` is the element, `id` its data-id. */
function tap(e,b,id){
  const a=b.dataset.act;
  if(a==='bizretry'){ BZ=null; render(); }   // the tab's own read failed; a repaint with no book starts it again
  if(a==='bizperiod'){ if(id==='custom')customSheet(); else if(id==='90d')setPeriod('custom',{from:Biz.localDate(Date.now()-89*DAY),to:Biz.period('month').to}); else setPeriod(id); }
  if(a==='bizcustom'){ const f=$m('#bizFrom'),t=$m('#bizTo'); if(f&&t&&f.value&&t.value){ closeSheet(); setPeriod('custom',{from:f.value,to:t.value}); } else toast('Pick both dates'); }
  if(a==='bizopen')openBiz(id);
  if(a==='bizskip'&&typeof skipGig==='function'){ skipGig(id).then(()=>{ stale(); fetchBiz(); }); }
  if(a==='bizrecon'&&typeof reconcile==='function')reconcile(id);
  if(a==='biznight'&&typeof openShow==='function'){ closeSheet(); ED=null; openShow(id); }
  if(a==='bizhours')hoursSheet();
  if(a==='bizhk')toggleHour(id,b);
  if(a==='bizview')setView({mine:id==='mine'});
  if(a==='bizfee')setView({net:!VIEW.net});
  if(a==='bizbar'){ if(!BZ||!BZ.ok)return; BARI=BARI===Number(id)?-1:Number(id); const {S,P}=joined(); const el=$m('#bizchart'); if(el)el.outerHTML=chartBox(S,P,false); }
  if(a==='bizpickmode'){ PICKS=PICKS?null:new Set(); render(); }
  if(a==='bizmore'){ MORE=!MORE; render(); }
  if(a==='bizpick'){ if(!PICKS)return; if(e.target.closest('button'))return; PICKS.has(id)?PICKS.delete(id):PICKS.add(id);
    const ck=b.querySelector('.bizck'); if(ck&&ck!==e.target)ck.checked=PICKS.has(id);
    const btn=$m('#bizpickbtn'); if(btn){ btn.disabled=!PICKS.size; btn.textContent=`Report ${PICKS.size} show${PICKS.size===1?'':'s'}`; } }
  if(a==='bizreport'){ if(!PICKS||!PICKS.size)return; go(`/report?shows=${encodeURIComponent([...PICKS].join(','))}&hours=1`); }
  if(a==='bizadd'||a==='bizrm'){
    const f=b.closest('.bizf'), field=a==='bizadd'?$m(`[data-rows="${id}"]`,f):b.closest('[data-rows]'), kind=field.getAttribute('data-rows');
    const box=$m('.bzrows',field), have=Number(field.getAttribute('data-have'))||0, lim=field.getAttribute('data-lim')===''?null:Number(field.getAttribute('data-lim'));
    const cap=lim==null?Biz.LIMITS.merch:Math.max(lim,have);
    if(a==='bizadd'){ if(box.children.length>=cap)return; box.insertAdjacentHTML('beforeend',lineRow(kind,null,box.children.length)); const i=box.lastElementChild.querySelector('input'); if(i)i.focus(); }
    else b.closest('.bzrow').remove();
    $m('.bzfoot',field).innerHTML=foot(kind,box.children.length,lim,have,cap);
    if(f.id==='bizf')readout(true); }
  if(a==='bizsave')saveShow(b);
  if(a==='bizremove')removeShow();
}

window.Money={tab,openBiz,reset,forget,stale,tonight,rows,form,readRows,any,saveRule,fillGigForm,ensureLoaded,act:tap,load:fetchBiz};
})();
