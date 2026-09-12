const $=s=>document.querySelector(s), API='/api';
let CODE=localStorage.getItem('myset.admin')||'', TOKEN=localStorage.getItem('myset.token')||'';
/* The page name that goes with a studio code. The code alone is only half the
   credential now — see requireArtist. Blank means the founding artist, so every
   link that worked before still works. */
let ASLUG=localStorage.getItem('myset.aslug')||'';
let EVENTS=null, PLAN=null, PROMOS=null, VENUES=null, PITCHES=null, CHARTS=null;
let D=null, REV=null, HIST=null, DETAIL=null, PROF=null, TEAM=null, timer=null;
let TAB=localStorage.getItem('myset.tab')||'setlist';
if(TAB==='merch')TAB='profile';               // the Merch tab folded into Profile on 2026-09-12
let MERCH=null, ORDERS=null, COMM=null;   // the shop, its orders, and the community page's posts
let SESS=null, REC=null;                  // where you're signed in, and your recovery codes
/* The same search and the same three orders the audience has on the voting page,
   so the two screens never disagree about where a song is. 'votes' keeps the
   server's ranking (votes desc -> voted-first -> title). */
let SETQ='', SETFOCUS=false;
let HISTQ='', HISTFOCUS=false, HSHOWN=[], HROWS=[], HISTALL=false; // past-shows search/collapse
let LEDGER=null, BOOKS=null, BOOKMONTH='';  // the statement and (for the founder) the P&L
let LASTSHOW='', LASTSTATUS='';            // when the night changes, the Money cache dies
let SETSORT=(()=>{try{return localStorage.getItem('myset.setsort')||'votes'}catch(e){return 'votes'}})();
const SETSORTS=[['votes','Top voted'],['title','Song A\u2013Z'],['artist','Artist A\u2013Z']];
const collate=(a,b)=>String(a||'').localeCompare(String(b||''),undefined,{sensitivity:'base'});
function setSort(v){ SETSORT=v; try{localStorage.setItem('myset.setsort',v)}catch(e){} render(); }
let GENRE='';
let GIGSALL=false;      // the gig list shows five, like the public page does
function setGenre(id){ GENRE=(GENRE===id?'':id); render(); }
/* What a gig's setlist choice is called. 'all' and a deleted id are both shown
   plainly — a gig quietly pointing at a set that no longer exists is exactly the
   kind of thing you want to see in the list, not discover at 10pm. */
const setName=(id)=>id==='all'?'all songs'
  :((((D&&D.lists)||[]).find(l=>l.id===id)||{}).name||'a deleted set');
const tagLabel=(id)=>{
  const v=(D&&D.tags)||{builtin:[],own:[]};
  const hit=[...v.builtin,...v.own].find(t=>t.id===id);
  return hit?hit.label:id;
};
/* ── setlists ────────────────────────────────────────────
   One library of songs; a setlist is a named subset of it, like a playlist. */
function setPick(){
  return `<div class="wrap" style="padding-top:10px;padding-bottom:0">
    <button class="big alt orange-outline" style="justify-content:center;margin:0" onclick="openLists()">Organize your songs into setlists</button>
    </div>
    ${D.listFellBack?`<div class="warnstrip"><b>Nothing votable in that set.</b>
      The room is seeing your whole library instead, so the night still works —
      but put some songs in it, or switch back to All songs.</div>`:''}`;
}
function openLists(){
  const lists=(D&&D.lists)||[], s=D.show;
  openSheet(`<h3>Your setlists</h3>
    <p class="lede">A setlist is just a named handful of your songs — a beach set, a
      late set, the one for the Irish pub. Pick one and the room only sees those.</p>
    <div class="lrow">
      <div class="m"><b>All songs</b><span>everything you haven’t hidden</span></div>
      ${/* "In play" only once it was CHOSEN. An empty listId is also what a show has
            before anyone picks, and a row that says In play with no button gave an
            artist who wanted All songs on purpose nothing to tap — so the Live
            checklist could never tick the step (the founder, 2026-09-12). The Use
            here is the same luse the named rows carry; useList('') sets ALLSONGS. */''}
      ${!s.listId&&ALLSONGS?'<span class="now">In play</span>'
        :`<button class="act" data-act="luse" data-id="">Use</button>`}
    </div>
    ${lists.map(l=>`<div class="lrow">
      <div class="m" onclick="openList('${esc(l.id)}')"><b>${esc(l.name)}</b>
        <span>${l.count} song${l.count===1?'':'s'} · tap to edit</span></div>
      ${l.active?'<span class="now">In play</span>'
        :`<button class="act" data-act="luse" data-id="${esc(l.id)}">Use</button>`}
    </div>`).join('')}
    ${/* Say it before the tap, not after. The server refuses this on free, and a
          button that looks available and then apologises is the shrug INVARIANT 0ad
          exists to prevent. Sets they already have keep working. */''}
    <div style="margin-top:18px">${lock('setlists',
      `<button class="big" onclick="newList()">+ New setlist</button>`,
      'Sets you already have keep working.')}</div>
    <p class="muted" style="font-size:12px;margin:12px 0 0">You can also pick a set per gig
      on the <b>Gigs</b> tab — then tapping “Start the show” uses it automatically.</p>`);
}
async function newList(){
  const name=(prompt('Name this setlist — “Beach set”, “Late set”, “Irish pub”')||'').trim();
  if(!name)return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'listNew',name})});
  if(!d.ok){toast(d.error||'Could not create that');return;}
  if(D) D.lists=d.lists;
  openList(d.id);
  toast('Now put some songs in it');
}
async function useList(id){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'listUse',id:id||''})});
  if(!d.ok){toast(d.error||'Failed');return;}
  ALLSONGS=!id;                          // the checklist's "chose All songs" — see todayCard
  try{ if(id) localStorage.removeItem('myset.allsongs'); else localStorage.setItem('myset.allsongs','1'); }catch(e){}
  closeSheet(); await load();
  toast(d.listName?`The room now sees “${d.listName}”`:'The room sees all your songs');
}
function openList(id){
  const l=((D&&D.lists)||[]).find(x=>x.id===id);
  if(!l){openLists();return;}
  const mine=new Set(l.songs);
  const songs=[...(D.songs||[])].filter(x=>mine.has(x.id))
    .sort((a,b)=>a.title.localeCompare(b.title));
  openSheet(`<h3>${esc(l.name)}</h3>
    <p class="lede">${l.count} song${l.count===1?'':'s'}${l.active?' · in play right now':''}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="act pri" data-act="lpick" data-id="${esc(id)}">+ Add songs</button>
      <button class="act" data-act="lrename" data-id="${esc(id)}">Rename</button>
      ${l.active?'':`<button class="act" data-act="luse" data-id="${esc(id)}">Use tonight</button>`}
    </div>
    ${songs.length?`<div class="picklist" style="margin-top:16px">${songs.map(x=>`
      <div class="pickrow on">
        <div class="m"><div class="t">${esc(x.title)}</div>
          <div class="by">${esc(x.artist||'')}${x.key?' · '+esc(x.key):''}</div></div>
        <button class="act warn" data-act="ltoggle" data-id="${esc(id)}|${esc(x.id)}">✕</button>
      </div>`).join('')}</div>`
      :`<p class="muted" style="font-size:15px;margin-top:18px">Nothing in it yet — tap
        <b>+ Add songs</b>.</p>`}
    <button class="big alt" style="margin-top:18px" data-act="ldel" data-id="${esc(id)}">Delete this setlist</button>`);
}
let PICK=null;
function openListPicker(id){
  const l=((D&&D.lists)||[]).find(x=>x.id===id);
  if(!l)return;
  PICK={id, chosen:new Set(l.songs), q:''};
  drawPicker();
}
function drawPicker(){
  const l=((D&&D.lists)||[]).find(x=>x.id===PICK.id)||{name:''};
  const q=PICK.q.trim().toLowerCase();
  const songs=[...(D.songs||[])]
    .filter(x=>x.active!==false)
    .filter(x=>!q||x.title.toLowerCase().includes(q)||(x.artist||'').toLowerCase().includes(q))
    .sort((a,b)=>a.title.localeCompare(b.title));
  openSheet(`<h3>Add to “${esc(l.name)}”</h3>
    <p class="lede">${PICK.chosen.size} chosen. Tap to add or remove.</p>
    <input class="inp" id="pkq" placeholder="Search your songs" value="${esc(PICK.q)}" autocomplete="off">
    <div class="picklist" style="margin-top:12px">${songs.length?songs.map(x=>`
      <div class="pickrow ${PICK.chosen.has(x.id)?'on':''}" data-act="pktog" data-id="${esc(x.id)}">
        <div class="m"><div class="t">${esc(x.title)}</div>
          <div class="by">${esc(x.artist||'')}${(x.tags||[]).length?' · '+esc((x.tags||[]).map(tagLabel).join(', ')):''}</div></div>
        <span class="box">✓</span>
      </div>`).join(''):`<p class="muted" style="font-size:15px">Nothing matches that.</p>`}</div>
    <button class="big" style="margin-top:16px" data-act="pksave" data-id="${esc(PICK.id)}">
      Save ${PICK.chosen.size} song${PICK.chosen.size===1?'':'s'}</button>`);
  const el=$('#pkq');
  if(el){ el.addEventListener('input',e=>{ PICK.q=e.target.value; drawPicker();
    const n=$('#pkq'); if(n){n.focus(); n.setSelectionRange(n.value.length,n.value.length);} }); }
}
function pickToggle(songId){
  if(!PICK)return;
  if(PICK.chosen.has(songId)) PICK.chosen.delete(songId); else PICK.chosen.add(songId);
  drawPicker();
}
async function savePicker(id){
  if(!PICK)return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'listSongs',id,songs:[...PICK.chosen]})});
  if(!d.ok){toast(d.error||'Could not save');return;}
  if(D) D.lists=d.lists;
  await load(); openList(id); toast('Saved');
}
async function renameList(id){
  const l=((D&&D.lists)||[]).find(x=>x.id===id);
  const name=(prompt('Rename this setlist', l?l.name:'')||'').trim();
  if(!name)return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'listRename',id,name})});
  if(!d.ok){toast(d.error||'Failed');return;}
  if(D) D.lists=d.lists;
  await load(); openList(id);
}
async function deleteList(id){
  const l=((D&&D.lists)||[]).find(x=>x.id===id);
  if(!confirm(`Delete “${l?l.name:'this setlist'}”? Your songs are not touched.`))return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'listDelete',id})});
  if(!d.ok){toast(d.error||'Failed');return;}
  closeSheet(); await load(); toast('Setlist deleted');
}
async function toggleInList(pair){
  const [id,song]=pair.split('|');
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'listToggle',id,song})});
  if(!d.ok){toast(d.error||'Failed');return;}
  if(D) D.lists=d.lists;
  await load(); openList(id);
}

/* ── songs to learn ──────────────────────────────────────
   Deliberately NOT in the song library: the room must never be able to vote for
   something that isn't playable yet. "Learned it" moves the row across. */
function learnSection(){
  const rows=(D&&D.learn)||[];
  return `<div class="sec"><span class="kick">Want to learn</span><span class="kick">${rows.length||''}</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Songs you don’t play yet.
      Nobody can vote for these — they’re a list for you. Tap <b>Learned it</b> and it joins
      your songs, ready to add to whichever set you want.</p>
    <div class="list">${rows.length?rows.map(x=>`<div class="row">
      <div class="m"><div class="t">${esc(x.title)}</div>
        <div class="by">${esc(x.artist||'— no artist —')}</div>
        ${x.note?`<div class="s">${esc(x.note)}</div>`:''}</div>
      <button class="act pri" data-act="wdone" data-id="${esc(x.id)}">Learned it</button>
      <button class="act warn" data-act="wdel" data-id="${esc(x.id)}">✕</button>
    </div>`).join(''):'<div class="row muted">Nothing on the list.</div>'}</div>
    <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="openLearn()">+ Add a song to learn</button></div>`;
}
function openLearn(){
  openSheet(`<h3>A song to learn</h3>
    <p class="lede">Somebody asked for it, or you heard it and liked it. It stays out of
      your setlist until you say you’ve learned it.</p>
    <input class="inp" id="wTitle" maxlength="80" placeholder="Song title" autocomplete="off">
    <input class="inp" id="wArtist" maxlength="60" placeholder="Who’s it by? (optional)"
      style="margin-top:9px" autocomplete="off">
    <input class="inp" id="wNote" maxlength="140" placeholder="A note to yourself (optional)"
      style="margin-top:9px" autocomplete="off">
    <button class="big" style="margin-top:16px" onclick="addLearn()">Add it</button>`);
  setTimeout(()=>{const e=$('#wTitle'); if(e)e.focus();},260);
}
async function addLearn(){
  const v=x=>(($('#'+x)||{}).value||'').trim();
  if(!v('wTitle')){toast('What song?');return;}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'learnAdd',
    title:v('wTitle'),artist:v('wArtist'),note:v('wNote')})});
  if(!d.ok){toast(d.error||'Could not add that');return;}
  if(D) D.learn=d.learn;
  closeSheet(); render(); toast('On the list');
}
async function learnDone(id){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'learnDone',id})});
  if(!d.ok){toast(d.error||'Failed');return;}
  if(d.stage&&d.stage.ok) D=d.stage; else await load();
  if(D) D.learn=d.learn;
  render();
  /* "In your setlist" was not quite true: learning a song puts it in the LIBRARY,
     and with a named set active it isn't in play until it's added to that set. */
  const sg=(D&&D.songs||[]).find(x=>x.id===d.songId);
  toast(d.note||(sg&&sg.inSet===false
    ? 'In your songs — add it to tonight’s set to play it'
    : 'Nice — it’s in your songs now'));
}
async function learnRemove(id){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'learnRemove',id})});
  if(!d.ok){toast(d.error||'Failed');return;}
  if(D) D.learn=d.learn;
  render();
}

/* ── auto-tag ────────────────────────────────────────────
   Asks first, because it touches every song. It only ever fills in songs that have
   NO genres, so it can never undo a choice they made by hand. */
function confirmAutoTag(){
  const songs=(D&&D.songs)||[];
  const blank=songs.filter(x=>!(x.tags||[]).length).length;
  if(!blank){
    openSheet(`<h3>Already done</h3>
      <p class="lede">Every one of your ${songs.length} songs already has genres on it.
        Auto-tag only ever fills in blanks — it will never change something you chose
        yourself.</p>
      <button class="big" onclick="closeSheet()">Got it</button>`);
    return;
  }
  openSheet(`<h3>Auto-tag your songs?</h3>
    <p class="lede">This fills in genres for the <b>${blank}</b> song${blank===1?'':'s'} that
      don’t have any, using how Spotify, Apple Music and Wikipedia actually classify them.</p>
    <div class="list" style="margin:0">
      <div class="row"><div class="m"><div class="t">It won’t touch your own choices</div>
        <div class="s">Only songs with no genres get filled in. Run it as often as you like.</div></div></div>
      <div class="row"><div class="m"><div class="t">Your own songs get “Originals”</div>
        <div class="s">Anything credited to you is tagged that way automatically.</div></div></div>
      <div class="row"><div class="m"><div class="t">Every tag stays editable</div>
        <div class="s">Tap <b>Edit</b> on any song to change them.</div></div></div>
    </div>
    <p class="muted" style="font-size:12.5px;margin:14px 0 0">It usually takes a few seconds,
      but with a big setlist give it up to a minute — don’t close the app while it runs.</p>
    <button class="big" style="margin-top:14px" onclick="runAutoTag()">Tag ${blank} song${blank===1?'':'s'}</button>
    <button class="big alt" style="margin-top:9px" onclick="closeSheet()">Not now</button>`);
}
async function runAutoTag(){
  if(WRITING)return; WRITING=true;
  openSheet(`<h3>Tagging…</h3><p class="lede"><span class="spin"></span>
    Going through your setlist. This can take a moment.</p>`);
  try{
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'tagAuto'})});
    if(!d.ok){toast(d.error||'That didn’t work');closeSheet();return;}
    if(d.stage&&d.stage.ok) D=d.stage; else await load();
    render();
    openSheet(`<h3>Done — ${d.filled} tagged</h3>
      <p class="lede">${d.kept?`${d.kept} already had genres and were left alone. `:''}${
        d.unknownCount?`${d.unknownCount} weren’t in the reference list, so they’re still blank.`
                      :'Everything got at least one genre.'}</p>
      ${d.unknownCount?`<div class="list" style="margin:0">${d.unknown.map(t=>
        `<div class="row"><div class="m"><div class="t">${esc(t)}</div></div></div>`).join('')}</div>
        <p class="muted" style="font-size:12.5px;margin:12px 0 0">Tap <b>Edit</b> on those and
          pick their genres yourself.</p>`:''}
      <button class="big" style="margin-top:16px" onclick="closeSheet()">Nice</button>`);
  } finally { WRITING=false; }
}

/* Only genres that are actually ON a song. A row of fifteen chips where twelve
   match nothing is worse than no row at all. */
function genreBar(songs){
  const used=new Map();
  for(const x of songs) for(const t of (x.tags||[])) used.set(t,(used.get(t)||0)+1);
  if(!used.size) return '';
  const items=[...used.entries()].map(([id,n])=>({id,n,label:tagLabel(id)}))
    .sort((a,b)=>a.label.localeCompare(b.label));
  /* '__hidden' is a pseudo-filter, not a tag: switched-off songs. Studio-only —
     the audience never sees hidden songs, so the chip would be meaningless there. */
  const hid=songs.filter(x=>x.active===false).length;
  return `<div class="gbar">
    <button class="${GENRE?'':'on'}" data-act="gfilter" data-id="">All</button>
    ${hid?`<button class="${GENRE==='__hidden'?'on':''}" data-act="gfilter" data-id="__hidden">Hidden <b>${hid}</b></button>`:''}
    ${items.map(t=>`<button class="${GENRE===t.id?'on':''}" data-act="gfilter" data-id="${esc(t.id)}">${esc(t.label)} <b>${t.n}</b></button>`).join('')}
  </div>`;
}
function setQuery(v){ SETQ=v; SETFOCUS=false; render(); }
function applySetSort(list){
  if(SETSORT==='title')  return [...list].sort((a,b)=>collate(a.title,b.title));
  if(SETSORT==='artist') return [...list].sort((a,b)=>collate(a.artist,b.artist)||collate(a.title,b.title));
  return list;
}

let BUSY=0, BUSY_T=null, LAST_PRESS=null, BUSY_PENDING=null;
document.addEventListener('pointerdown',e=>{LAST_PRESS=e.target.closest&&e.target.closest('button,a')},{passive:true});
function busy(on){
  BUSY=Math.max(0,BUSY+(on?1:-1));
  clearTimeout(BUSY_T);
  const el=document.getElementById('busy');
  if(!el)return;
  if(BUSY){
    BUSY_PENDING=LAST_PRESS;if(BUSY_PENDING)BUSY_PENDING.classList.add('pending');
    BUSY_T=setTimeout(()=>{if(BUSY_PENDING)BUSY_PENDING.classList.remove('pending');if(BUSY)el.classList.add('on')},55);
  }else{
    if(BUSY_PENDING)BUSY_PENDING.classList.remove('pending');BUSY_PENDING=null;el.classList.remove('on');
  }
}
/* The same headers `api` builds, for the two calls that come back as a FILE rather
   than as JSON. api() ends in `r.json()`, so a CSV download cannot go through it. */
function hdrs(){
  const h={'content-type':'application/json'};
  if(CODE){ h['x-admin-code']=CODE; if(ASLUG) h['x-admin-artist']=ASLUG; }
  if(TOKEN) h['authorization']='Bearer '+TOKEN;
  return h;
}
async function api(p,o={}){
  /* The <head> started the first stage read and planGet before this script had
     parsed; use each of those answers once, then fetch like always. */
  const E=window.__early; let early=null;
  if(E){ const k=(p==='/stage'&&!o.method)?'stage':(p==='/admin'&&o.body==='{"action":"planGet"}')?'plan':null;
    if(k&&E[k]){ early=E[k]; E[k]=null; } }
  const h={'content-type':'application/json',...(o.headers||{})};
  if(CODE){ h['x-admin-code']=CODE; if(ASLUG) h['x-admin-artist']=ASLUG; }
  if(TOKEN) h['authorization']='Bearer '+TOKEN;
  // `quiet` for background refreshes — the live tab re-reads every few seconds,
  // and flashing the overlay at it looked like something was wrong
  if(!o.quiet) busy(true);
  try{
    const r=await (early||fetch(API+p,{...o,headers:h}));
    return await r.json();
  // `offline` distinguishes "the network failed" from "the server said no".
  // load() used to treat both as an auth failure and throw the artist out to the
  // sign-in screen mid-gig, killing the refresh timer with it. INVARIANT 16.
  }catch(e){ return {ok:false,offline:true,error:'Connection hiccup — try again'}; }
  finally{ if(!o.quiet) busy(false); }
}
async function load(opts){
  /* The very first load has nothing on screen to cover, so the overlay is pure
     flash — and every background loader used to raise it again on top. One boot,
     one paint. */
  /* On the first load the plan is fetched AT THE SAME TIME as the stage, not after
     it. planGet needs the session, not the stage payload, so serialising the two was
     a whole round-trip of nothing. `loadPlan` renders when it lands; render() is a
     no-op until D exists, so whichever arrives first is fine. */
  const planJob=(!D&&!PLAN)?loadPlan():null;
  const d=await api('/stage',{quiet:!D, ...(opts||{})});
  // A transport failure is not a sign-out. Keep the last good screen and let the
  // interval retry — on bar wifi this fires constantly, and gating here used to
  // end the gig. `&&D` because on the very first load there is nothing to keep.
  if(!d.ok&&d.offline&&D) return;
  if(!d.ok){ if(d.error==='unauthorized'){
      CODE='';TOKEN='';localStorage.removeItem('myset.admin');localStorage.removeItem('myset.token'); }
    gate(d.error); return; }
  const first=!D;
  /* THE MONEY TAB CACHED A HISTORY THAT COULD NEVER GO STALE. `loadHist()` returns
     early when HIST is set and nothing ever cleared it, so ending a show and coming
     back to Money showed the old list without the night that had just finished —
     indistinguishable from the server having lost it, which is what this whole
     round of work was about. The show's own id and status are already on every
     poll, so the cache dies exactly when the night changes and no more often. */
  const idNow=(d.show&&d.show.showId)||'', stNow=(d.show&&d.show.status)||'';
  if(D&&(idNow!==LASTSHOW||stNow!==LASTSTATUS)){ HIST=null; REV=null; HISTALL=false; }
  LASTSHOW=idNow; LASTSTATUS=stNow;
  D=d; render();
  /* The tab's OWN data arrives after the shell. These were fire-and-forget, so the
     boot screen came down while the page was still filling in — which looked like
     the load finishing early and then carrying on. On the FIRST load only, wait for
     them, so the screen we hand over is the finished one. Later polls never wait. */
  const jobs=[];
  /* THE PLAN IS FETCHED ON EVERY FIRST LOAD, not just on the Settings tab.
     `has()` treats an unknown plan as allowed — so there is no grey flash — which
     meant the FIRST render of Settings or Setlist showed every locked control
     fully live and tappable to a free artist, and the server answered 402. That is
     INVARIANT 0ad narrowed to a window rather than closed. It is one small read on
     a path that is already awaiting several. */
  /* Not awaited since 0054: has() reads an unfetched plan as locked, so the screen
     can come down on the stage alone and the plan repaints when it lands — which
     in every measured open was BEFORE the stage anyway. */
  if(!planJob&&!PLAN) loadPlan();
  if(TAB==='money'){ if(!REV)jobs.push(loadRev()); if(!HIST)jobs.push(loadHist()); if(!LEDGER)jobs.push(loadLedger()); }
  if(TAB==='gigs'&&!FEAT)jobs.push(loadFeature());
  if(TAB==='profile'&&!PROF) jobs.push(loadProf());
  /* drawPush is NOT awaited: it races serviceWorker.ready for up to four seconds,
     and a boot screen held for a worker that may never come is a boot screen
     held for nothing. It paints into #pushBox whenever it lands (PUSHVIEW). */
  if(TAB==='settings'){ if(!TEAM)jobs.push(loadTeam());
    jobs.push(loadTick()); drawPush(); }
  if(TAB==='gigs'){ if(!EVENTS)jobs.push(loadGigs()); if(!PITCHES)jobs.push(loadPitches()); }
  /* Today's checklist (Live, before a show) reads the calendar and the card state;
     neither is awaited — the card paints its checks as they land. A library with
     no songs asks history whether this is a brand-new account (drawFirstRun). */
  if(TAB==='live'&&first){ if(!EVENTS)loadGigs(); if(!PAY)loadPay(); }
  if(first&&d.songs&&!d.songs.length&&!HIST) loadHist();
  if(!first) return;
  try{ await Promise.all(jobs.map(j=>Promise.resolve(j).catch(()=>null))); }catch(e){}
  bootDone();
  if(TAB==='settings') maybeVerifyIntro();
}
let WRITING=false;
async function act(action,extra={}){
  if(WRITING)return;                       // a second tap is never a second action
  WRITING=true;
  try{
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action,...extra})});
    if(!d.ok){toast(d.error||'Failed');return;}
    // the write already sent the fresh state back — no second round trip
    if(d.stage&&d.stage.ok){ D=d.stage; render(); }
    else await load();
    if(d.note) toast(d.note);
  } finally { WRITING=false; }
}
let GATE_EMAIL='';
function gate(err,mode){
  bootDone();
  clearInterval(timer);
  /* The first-run steps sit over #app at z-58 and their "Continue setup" pill hangs
     off <body>: neither may be left over a sign-in screen, whichever road led here. */
  FR={step:0,hidden:false,drawn:''};
  const fr=$('#firstrun'); if(fr)fr.classList.remove('on');
  const fb=$('#frback'); if(fb)fb.remove();
  const m=mode||'start';
  const head=`<h2>Artist Studio</h2>`;
  let inner;
  if(m==='code'){
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">We sent a 6-digit code to <b>${esc(GATE_EMAIL)}</b>. It works for ten minutes.</p>
      <input class="inp" id="otp" type="text" inputmode="numeric" autocomplete="one-time-code"
        maxlength="6" placeholder="000000" style="letter-spacing:.3em;text-align:center;font-size:26px">
      <button class="big" style="margin-top:12px" onclick="submitCode()">Sign in</button>
      <button class="act" style="margin-top:14px;width:100%" onclick="gate(null,'start')">← Use a different email</button>`;
  }else if(m==='name'){
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">You're in. What should we call you? This is the name fans see.</p>
      <input class="inp" id="newName" maxlength="60" placeholder="Your artist or band name" autocomplete="off">
      <button class="big" style="margin-top:12px" onclick="claimAccount()">Create my page</button>`;
  }else{
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">${
      err==='unauthorized'?'That didn’t work — try again.':'Sign in to run your show.'}</p>
      ${PKSUPPORTED&&(localStorage.getItem('myset.slug')||ASLUG)?`<button class="big" onclick="passkeySignIn()">Sign in with Face ID</button>
      <input type="hidden" id="pkslug" value="${esc(localStorage.getItem('myset.slug')||ASLUG)}">
      <div style="display:flex;align-items:center;gap:12px;margin:18px 0 14px">
        <span style="flex:1;height:.5px;background:var(--hair)"></span>
        <span class="kick" style="font-size:12px">or</span>
        <span style="flex:1;height:.5px;background:var(--hair)"></span>
      </div>`:''}
      <input class="inp" id="email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com">
      <button class="big${PKSUPPORTED&&(localStorage.getItem('myset.slug')||ASLUG)?' alt':''}" style="margin-top:12px" onclick="sendCode()">Email me a code</button>
      <p class="muted" style="font-size:12.5px;margin:14px 0 0;text-align:center">
        New here? Same button — we'll set you up right after the code.<br>
        No password to forget — we email you a code each time.</p>
      ${/* ALREADY HOLDING A CODE — the email landed on another phone, or this is a
           second browser. The code is tied to the address, not the device, so it
           works here as long as the same email is in the box above. This replaced
           the page-name + Studio-code door on 2026-09-12 (the user's call: one
           way in, not two on one screen). The server still answers that door; the
           founder's stored code keeps working. */''}
      <div class="sec" style="padding-left:0;padding-right:0;margin-top:22px"><span class="kick">Got a code already?</span></div>
      <input class="inp" id="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"
        placeholder="My code" style="letter-spacing:.2em">
      <button class="big alt" style="margin-top:12px" onclick="submitCode()">Sign in with my code</button>
      <p class="muted" style="font-size:12px;margin:10px 0 0">The 6 digits from the email — type them here with the same address above, on any phone or browser.</p>
      <p class="muted" style="font-size:12.5px;margin:16px 0 0;text-align:center">
        <a href="#" onclick="event.preventDefault();gate(null,'recover')" style="color:var(--accent);font-weight:600">Lost your email? Use a recovery code</a>
        &nbsp;·&nbsp; <a href="#" onclick="event.preventDefault();gate(null,'studiocode')" style="color:var(--muted);font-weight:600">Studio code</a></p>`;
  }
  /* The per-page Studio code (set in Settings). Off the front screen since
     2026-09-12, behind a link, so the Settings card still has a door. */
  if(m==='studiocode'){
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">The code you set in Settings for this page.</p>
      <input class="inp" id="aslug" placeholder="Your page name (myset.vip/…)" autocomplete="username" value="${esc(ASLUG)}">
      <input class="inp" id="code" type="password" placeholder="Studio code" autocomplete="current-password" style="margin-top:8px">
      <button class="big" style="margin-top:12px" onclick="unlock()">Unlock with code</button>
      <p class="muted" style="font-size:12px;margin:10px 0 0">Your page name is the bit after myset.vip/ — leave it blank if you set your code before pages existed.</p>
      <button class="act" style="margin-top:14px;width:100%" onclick="gate()">← Back</button>`;
  }
  if(m==='recover'){
    inner=`<p class="muted" style="font-size:14px;margin:0 0 16px">One of the eight codes you saved. Each works once, and every other device gets signed out.</p>
      <input class="inp" id="rslug" placeholder="Your page name (myset.vip/…)" autocomplete="username" value="${esc(ASLUG)}">
      <input class="inp mono" id="rcode" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="off" style="margin-top:8px;letter-spacing:.12em;text-align:center">
      <button class="big" style="margin-top:12px" onclick="recoverIn()">Sign me in</button>
      <button class="act" style="margin-top:14px;width:100%" onclick="gate()">← Back</button>`;
  }
  document.getElementById('app').innerHTML=`<div class="gate">${head}${inner}</div>`;
  const first=m==='code'?$('#otp'):($('#newName')||$('#email'));
  if(first){ first.addEventListener('keydown',e=>{if(e.key==='Enter'){
      m==='code'?submitCode():m==='name'?claimAccount():sendCode();}});
    setTimeout(()=>first.focus(),100); }
  if(m==='start'){ const o=$('#otp'); if(o) o.addEventListener('keydown',e=>{if(e.key==='Enter')submitCode()}); }
  const c=$('#code'); if(c) c.addEventListener('keydown',e=>{if(e.key==='Enter')unlock()});
}
/* Stripe sends them back to /studio?connect=done. Ask Stripe for the real answer
   rather than assuming the round trip means success — they can abandon it halfway. */
(function(){
  try{
    const q=new URLSearchParams(location.search);
    if(q.get('tab')==='setlist'){
      TAB='setlist'; localStorage.setItem('myset.tab','setlist');
      history.replaceState({},'',location.pathname);
    }
    if(q.get('connect')){ TAB='money'; localStorage.setItem('myset.tab','money');
      history.replaceState({},'',location.pathname);
      setTimeout(()=>loadPay(true),400); }
    /* Back from a promoted-gig checkout. Settled here as the fast path; the Stripe
       webhook is the backstop, so closing the tab still gets the spot. */
    if(q.get('promoted')){ TAB='gigs'; localStorage.setItem('myset.tab','gigs');
      setTimeout(()=>finishPromote(q.get('promoted')),500); }
    if(q.get('promocancel')){ TAB='gigs'; localStorage.setItem('myset.tab','gigs');
      history.replaceState({},'',location.pathname);
      setTimeout(()=>toast('Nothing charged — the spot is free again'),600); }
  }catch(e){}
})();
/* The way back in when the inbox is gone. The page name is public, so it grants
   nothing on its own — it only says which lock to try, the same reasoning the
   studio-code door uses. A wrong code, an unknown page and a locked-out page all
   answer identically, so this cannot be used to find out who has an account. */
async function recoverIn(){
  const slug=(($('#rslug')||{}).value||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'');
  const code=(($('#rcode')||{}).value||'').trim();
  if(!slug||!code){toast('Both boxes, please');return;}
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'recoverySignIn',slug,code})});
  if(!d.ok){toast(d.error||'That code didn’t work');return;}
  TOKEN=d.token; localStorage.setItem('myset.token',d.token);
  ASLUG=d.slug||''; localStorage.setItem('myset.aslug',ASLUG);
  toast(d.left?`You’re in. ${d.left} recovery codes left.`:'You’re in. That was your last recovery code — make new ones in Settings.');
  start();
}
/* The Studio-code door — behind a link on the sign-in screen since 2026-09-12. */
function unlock(){
  CODE=(($('#code')||{}).value||'').trim();
  ASLUG=(($('#aslug')||{}).value||'').trim().toLowerCase().replace(/[^a-z0-9-]/g,'');
  localStorage.setItem('myset.admin',CODE); localStorage.setItem('myset.aslug',ASLUG);
  start();
}
async function sendCode(){
  const em=(($('#email')||{}).value||'').trim();
  if(!em){toast('Enter your email');return;}
  GATE_EMAIL=em;
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'start',email:em})});
  if(!d.ok){toast(d.error||'Could not send that');return;}
  gate(null,'code');
}
let TICKET='';
/* FIRST TOUCH, remembered.
   Signing up means leaving for an email inbox and coming back, and whatever
   brought them here — ?ref= from another artist, ?src= off a poster QR — is gone
   from the URL by then. So it is stashed on the FIRST visit and read at the end.
   `ref` still prefers the live URL, so nothing about referrals changes; this only
   rescues the case where it used to be silently lost. */
function firstTouch(){
  try{
    const q=new URLSearchParams(location.search);
    const ref=q.get('ref')||'';
    const src=q.get('src')||q.get('utm_source')||q.get('utm_medium')||'';
    if(ref&&!localStorage.getItem('myset.ref')) localStorage.setItem('myset.ref',ref);
    if(!localStorage.getItem('myset.src')){
      let from=src;
      if(!from&&document.referrer){
        try{ const h=new URL(document.referrer).host; if(h&&h!==location.host) from=h; }catch(e){}
      }
      if(from) localStorage.setItem('myset.src',from);
    }
  }catch(e){}
}
firstTouch();
async function claimAccount(){
  const nm=(($('#newName')||{}).value||'').trim();
  if(!nm){toast('What should we call you?');return;}
  let ref='',src='';
  try{
    ref=new URLSearchParams(location.search).get('ref')||localStorage.getItem('myset.ref')||'';
    src=localStorage.getItem('myset.src')||'';
  }catch(e){}
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'claim',ticket:TICKET,name:nm,ref,src})});
  if(!d.ok){toast(d.error||'Could not create that');return;}
  TOKEN=d.token; localStorage.setItem('myset.token',TOKEN);
  CODE=''; localStorage.removeItem('myset.admin');
  try{localStorage.setItem('myset.firstrun',(d.artistId||'')+':1')}catch(e){}   // a brand-new account: the first-run steps, keyed to it
  toast('Welcome \u2014 your page is myset.vip/'+d.slug); start();
}
async function submitCode(){
  const code=(($('#otp')||{}).value||'').trim();
  /* From the start screen the address is whatever is in the email box; from the
     code screen it is the one the code was sent to. */
  const typed=(($('#email')||{}).value||'').trim();
  if(typed) GATE_EMAIL=typed;
  if(!GATE_EMAIL){toast('Enter your email first');return;}
  if(code.replace(/\D/g,'').length!==6){toast('The code is 6 digits');return;}
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'verify',email:GATE_EMAIL,code})});
  if(!d.ok){toast(d.error||'Check the code and try again');return;}
  if(d.needName){ TICKET=d.ticket; gate(null,'name'); return; }
  TOKEN=d.token; localStorage.setItem('myset.token',TOKEN);
  CODE=''; localStorage.removeItem('myset.admin');
  if(d.isNew){ try{localStorage.setItem('myset.firstrun',(d.artistId||'')+':1')}catch(e){} }
  toast(d.isNew?`Welcome — your page is myset.vip/${d.slug}`:`Signed in as ${d.email}`);
  start();
}
/* THE ESCAPE HATCH. sw.js has listened for 'myset-unregister' since it shipped —
   it drops every cache and reloads every open copy — and there has never been a
   way to send it. In an installed app with no address bar, that is the difference
   between "reload it" and "delete the app and start again".

   Sign-in is deliberately left alone: the token is in localStorage, not in a
   cache, so this fixes a stale app without locking somebody out of their own
   Studio mid-gig. If the worker is not there at all, a plain reload is still the
   right thing to do rather than nothing. */
async function hardReset(){
  if(!confirm('Throw away the offline copy and start the app fresh? You stay signed in.')) return;
  try{
    if('caches' in window) for(const k of await caches.keys()) await caches.delete(k);
    const reg='serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if(reg&&reg.active){ reg.active.postMessage('myset-unregister'); await new Promise(r=>setTimeout(r,400)); }
  }catch(e){}
  location.reload();
}
/* SIGNING OUT NOW SIGNS YOU OUT. This cleared localStorage and told the server
   nothing, so a copy of the token — off a borrowed phone, a browser profile, a
   backup — kept working for the rest of its thirty days. The local clear happens
   whatever the network does: somebody on bar wifi who presses Sign out has to be
   signed out on this phone regardless of what Netlify says back. */
async function signOut(){
  try{ await api('/auth',{method:'POST',body:JSON.stringify({action:'signOut'}),quiet:true}); }catch(e){}
  CODE='';TOKEN='';
  localStorage.removeItem('myset.admin');localStorage.removeItem('myset.token');
  try{localStorage.removeItem('myset.firstrun')}catch(e){}
  /* Nothing of this account may greet the next one on the same phone: not the
     stage (a late loader would repaint it over the sign-in screen), not the plan,
     the team, the card state or the history the first-run steps read. Null is the
     state every one of these is in at first paint, so the next load is a first load. */
  D=null;PLAN=null;PROF=null;TEAM=null;PAY=null;HIST=null;REV=null;LEDGER=null;EVENTS=null;PITCHES=null;
  FEAT=null;MERCH=null;ORDERS=null;COMM=null;SESS=null;REC=null;TICK=null;PKEYS=null;
  gate();
}
function signOutEverywhere(){
  if(!confirm('Sign every device out, including this one? You\u2019ll need a code to get back in.'))return;
  revokeAll();
}
/* ---------- the verification tick, from the artist's side ----------
   Built because the review found the whole feature was WRITE-ONLY: the endpoints
   and their tests existed and nothing in the app called them, so an artist could
   not ask for the tick and Perry could not review one.

   The ID photo goes straight to the server and is deleted the moment a decision is
   made (INVARIANT 0bk) — it is never rendered here, and never cached. */
let TICK=null, TICKQ=false, IDQ=null, TICKWHY=null;
async function loadTick(){
  if(TICKQ) return; TICKQ=true;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'verifyStatus'}),quiet:true});
  TICKQ=false;
  /* `autoWhy` is the server's own sentence about what the automatic check is still
     waiting for. Showing it means an artist whose Stripe check is mid-flight sees
     "waiting on Stripe" rather than a silent queue they assume nobody is reading. */
  if(d&&d.ok){ TICK=d.checks; TICKWHY=d.autoWhy||null; if(TAB==='settings'&&D) render(); }
}
function tickCard(){
  if(!TICK){ loadTick(); return ''; }
  const t=TICK;
  const step=(on,label,hint)=>`<div class="row"><div class="m">
    <div class="t">${on?'<span class="okmark">\u2713</span> ':''}${label}</div>${hint?`<div class="s muted">${hint}</div>`:''}</div></div>`;
  if(t.state==='verified') return `<div class="sec"><span class="kick">Verified</span></div>
    <div class="list"><div class="row"><div class="m">
      <div class="t"><span class="okmark">\u2713</span> Your page is verified</div>
      <div class="s muted">People can see the details came from you. Your profile can appear in Find artists search results, the day-by-day show list and the map.</div>
    </div></div></div>`;
  const body=t.state==='pending'
    ? `<div class="row"><div class="m"><div class="t">${TICKWHY?'Waiting on one more thing':'With MySet for review'}</div>
        <div class="s muted">${TICKWHY
          ? esc(TICKWHY)+'. We check again on its own — nothing more for you to do.'
          : 'We\u2019ll look at it and let you know. Your ID is deleted either way, as soon as we decide.'}</div></div></div>`
    : `${step(t.paidPlan,'On Bar Star or Rock Star',t.paidPlan?'':'The tick is part of a paid plan')}
       ${step(t.payments,'Card payments set up',t.payments?'':'Set this up in the Money tab \u2014 the tick confirms who gets paid')}
       ${step(false,'Your ID, legal name and date of birth',t.readyForReview?'Ready when you are':'Checked against your payout account')}
       ${t.rejectedWhy?`<div class="row"><div class="m"><div class="t">Not approved last time</div>
         <div class="s muted">${esc(t.rejectedWhy)} \u2014 you can try again.</div></div></div>`:''}`;
  return `<div class="sec"><span class="kick">Get verified</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px"><b>Only verified profiles appear in Find artists search results, including the day-by-day show list and map.</b> A green tick also tells people the details came from you and not from somebody claiming to be you. Most of the time it happens by itself: give the name and date of birth on your ID, and if they match what Stripe has already verified on your payout account, you're verified on the spot \u2014 no waiting on us.</p>
    <div class="list">${body}</div>
    ${t.state==='pending'?'':`<div class="wrap" style="margin-top:12px">
      ${t.readyForReview===false&&(!t.paidPlan||!t.payments)
        ? `<button class="big alt" disabled>Finish the steps above first</button>`
        : `<div class="field" style="margin-bottom:10px">
             <label>Your full legal name</label>
             <input class="inp" id="idName" placeholder="Exactly as it appears on the ID" autocomplete="name">
             <p class="s muted" style="margin:6px 0 0">Not your stage name \u2014 the one on the document. They're often different, and that's fine.</p>
           </div>
           <div class="field" style="margin-bottom:10px">
             <label>Date of birth</label>
             <input class="inp" id="idDob" type="date">
             <p class="s muted" style="margin:6px 0 0">Checked against your payout account once, then thrown away \u2014 we don't keep it.</p>
           </div>
           <label class="bigfile"><input type="file" id="idFile" accept="image/*" style="display:none" onchange="idPick(this)">\u21ea Send a photo of your ID</label>`}
      <p class="muted" style="font-size:12px;margin:10px 0 0">We look at it once and delete it. It is never shown on your page and never kept.</p>
    </div>`}`;
}
async function idPick(el){
  const f=el&&el.files&&el.files[0]; el.value='';
  if(!f) return;
  if(!/^image\//.test(f.type)){ toast('That needs to be a photo'); return; }
  try{
    /* Shrunk on the phone before it is sent, like every other upload here: a modern
       camera photo is several megabytes and the server cap is under one. */
    const data=await shrinkToDataUrl(f,1400,0.8);
    const nm=(($('#idName')||{}).value||'').trim();
    const dob=(($('#idDob')||{}).value||'').trim();
    if(nm.split(/\s+/).filter(Boolean).length<2){ toast('Give your full legal name'); return; }
    if(!dob){ toast('Add your date of birth'); return; }
    const r=await api('/admin',{method:'POST',body:JSON.stringify({action:'idUpload',data,legalName:nm,dob})});
    if(!r.ok){ toast(r.error||'Could not send that'); return; }
    TICK=r.checks; TICKWHY=r.autoWhy||null; render();
    toast(r.autoVerified?'Verified \u2014 you\u2019re all set \u2713':'Sent \u2014 we\u2019ll take a look');
  }catch(e){ toast('Could not send that'); }
}
function shrinkToDataUrl(file,maxW,q){
  return new Promise((res,rej)=>{
    const url=URL.createObjectURL(file), img=new Image();
    img.onload=()=>{
      const scale=Math.min(1,maxW/img.naturalWidth);
      const c=document.createElement('canvas');
      c.width=Math.round(img.naturalWidth*scale); c.height=Math.round(img.naturalHeight*scale);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      let out=null;
      for(const qq of [q,0.7,0.55,0.4]){ const d=c.toDataURL('image/jpeg',qq);
        if(d.length*0.75<850*1024){ out=d; break; } }
      out?res(out):rej(new Error('too big'));
    };
    img.onerror=()=>{ URL.revokeObjectURL(url); rej(new Error('bad image')); };
    img.src=url;
  });
}

/* ---------- the flag switches ----------
   Owner only. A flag with no switch can only be flipped with hand-made HTTP, which
   makes "run a gig each way and pick one" a thing only its author can do. */
let FLAGS_D=null;
async function loadFlags(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'flagList'}),quiet:true});
  FLAGS_D=(d&&d.ok)?(d.flags||[]):[];
  if(D) render();
}
function flagCard(){
  if(!PLAN||!PLAN.owner) return '';
  if(FLAGS_D===null){ loadFlags(); return ''; }
  if(!FLAGS_D.length) return '';
  return `<div class="sec"><span class="kick">Trying things out</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Both answers work. Run a gig each way, keep the better one, then delete the loser.</p>
    <div class="list">${FLAGS_D.map(f=>`<div class="row"><div class="m">
      <div class="t">${esc(f.name)}</div>
      <div class="s muted">${esc(f.what)}</div>
    </div>
    <button class="act" onclick="flagFlip('${esc(f.name)}',${f.inForce?'false':'true'})">${f.inForce?'On':'Off'}</button>
    </div>`).join('')}</div>`;
}
async function flagFlip(name,on){
  const r=await api('/admin',{method:'POST',body:JSON.stringify({action:'flagSet',flag:name,on})});
  if(!r||!r.ok){ toast((r&&r.error)||'Could not change that'); return; }
  FLAGS_D=null; toast(`${name} is ${on?'on':'off'}`);
}

/* ---------- LOCKED FEATURES ----------
   Perry's call: show what the paid plans do, greyed out, instead of hiding it —
   and never show a control that looks live and then gets refused by the server.

   ONE function decides availability and ONE draws the veil, so a feature cannot
   be greyed in one place and live in another. Both read the plan payload; the
   `soon` list in it names the flags that are DESIGNED AND NOT BUILT, which are
   greyed for everybody including Perry, who is comped to Pro and would otherwise
   be shown four dead ends as if they were his. */
const LOCKICON='<svg viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="2.4"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/></svg>';
const isSoon=(flag)=>!!(PLAN&&PLAN.limits&&(PLAN.limits.soon||[]).includes(flag));
function has(flag){
  /* NOT YET FETCHED is locked; FETCHED AND FAILED is allowed. The first keeps
     INVARIANT 0ad closed now that the boot screen no longer waits for the plan
     (0054): if stage ever lands first, paid controls show locked for the beat
     until planGet repaints, never live-and-402. The second is bar wifi: a plan
     read that failed must not lock a paying artist out until a reload. */
  if(PLAN===null) return false;
  if(!PLAN.ok||!PLAN.limits) return true;
  if(isSoon(flag)) return false;
  if(PLAN.owner) return true;
  const mine=PLAN.limits[flag];
  /* A NUMERIC LIMIT IS NOT A YES/NO, and treating it as one was a real bug: a
     venue's `photos` is 3 or 12 and an artist's `featured` is 50 or unlimited, so
     `limits[flag]===true` was false for both and Pro showed a dash next to a
     feature it fully had. "Has it" means "has as much as the top plan gives".
     Unlimited arrives as null, because shapeLimits maps Infinity to null so it can
     survive JSON. */
  if(mine===null) return true;
  if(typeof mine==='number'){
    const top=(PLAN.plans&&PLAN.plans.pro)?PLAN.plans.pro[flag]:mine;
    return top===mine;
  }
  return mine===true;
}
/** " (soon)" when a plan row names something that is designed and not built. */
const soonTag=(L,flag)=>((L&&L.soon||[]).includes(flag)?' <i style="opacity:.7">(soon)</i>':'');
/** The cheapest plan that actually turns this on — so the label never over-sells. */
function needsPlan(flag){
  const P=(PLAN&&PLAN.plans)||null;
  if(P) for(const k of ['plus','pro']) if(P[k]&&P[k][flag]===true) return P[k].label;
  return 'Rock Star';
}
/** Wraps `html` in a veil when the plan does not include `flag`. */
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
/** Takes them to the plan cards, from wherever they tapped. */
function showPlans(){
  if(TAB!=='settings') setTab('settings');
  setTimeout(()=>{const el=document.getElementById('planbox');
    if(el) el.scrollIntoView({behavior:'smooth',block:'center'});},60);
}

/* Previews of the four Pro features that are DESIGNED AND NOT BUILT. Showing
   them was Perry's call; showing them as "coming soon" rather than "yours" is
   what stops a Pro artist — Perry included — walking into a dead end. The list
   they read from is NOT_BUILT in _plan.mjs, so the day one of these is built it
   stops being greyed by deleting one word in one place. */
function soonCard(flag,kick,lede,rows){
  return `<div class="sec"><span class="kick">${kick}</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">${lede}</p>
    ${lock(flag,`<div class="list">${rows.map(([t,d])=>
      `<div class="row"><div class="m"><div class="t">${t}</div><div class="s">${d}</div></div></div>`
    ).join('')}</div>`)}`;
}
const analyticsCard=()=>soonCard('analytics','Your numbers',
  'Which room pays, which night fills, which song earns. Built from nights you have already played.',
  [['Earnings by venue','The Ugly Duckling · $184 over 6 nights'],
   ['Best night of the week','Thursdays average 31 people'],
   ['Your money songs','Wonderwall pulled 12% of all votes']]);
/* ---------- PROMOTE A GIG --------------------------------------------------
   Three paid spots at the top of a city's night, $10 each, first come first
   served. The whole design — and why it is a hold rather than charge-then-claim —
   is in netlify/functions/_featured.mjs. This is the button and the sheet.

   Behind a flag (`featuredShows`). With it off, `FEAT.enabled` is false and this
   whole card is not drawn — but anything already bought is still listed, because a
   switch moving must never look like a refund somebody did not get. */
let FEAT=null;
async function loadFeature(force){
  if(FEAT&&!force)return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'featureList'}),quiet:true});
  if(d&&d.ok){ FEAT=d; if(TAB==='gigs'&&D)render(); }
}
const money$=(c)=>'$'+((Number(c)||0)/100).toFixed(2).replace(/\.00$/,'');

function featureCard(){
  const F=FEAT;
  if(!F) return '';
  const mine=F.mine||[];
  if(!F.enabled) return mine.length?`<div class="sec"><span class="kick">Featured</span></div>
    <div class="list">${mine.map(m=>`<div class="row"><div class="m"><div class="t">${esc(m.venue||'Your gig')}</div>
      <div class="s">${esc(m.city||'')} · ${daystamp(new Date(m.date+'T12:00:00').getTime())}</div></div></div>`).join('')}</div>`:'';
  return `
  <div class="sec"><span class="kick">Featured shows</span></div>
  <div class="wrap" style="padding-top:16px">
    <button class="big bigplay" onclick="openPromote()"><span>★</span><span style="flex:1">Feature a show</span></button>
    <p class="muted" style="font-size:12px;margin:9px 0 0">${money$(F.price)} puts one of your gigs at the top of that city's list for that night. ${F.slots} spots a night, first come first served.</p>
  </div>
  ${mine.length?`<div class="sec"><span class="kick">Featured</span><span class="kick">${mine.length}</span></div>
    <div class="list">${mine.map(m=>m.owed
      ? `<div class="row"><div class="m">
          <div class="t">${esc(m.venue||'Your gig')} — refund owed</div>
          <div class="s">That night was already taken, and giving the ${money$(m.cents)} back didn’t go through. Perry can see this too — tell him if it hasn’t arrived in a few days.</div></div>
          <span class="cnt" style="color:var(--accent);font-size:15px">!</span></div>`
      : `<div class="row"><div class="m">
          <div class="t">${esc(m.venue||'Your gig')}</div>
          <div class="s">Top of ${esc(m.city||'the list')} on ${daystamp(new Date(m.date+'T12:00:00').getTime())} · ${money$(m.cents)}</div></div>
          <span class="cnt" style="color:var(--accent-2);font-size:15px">★</span></div>`).join('')}</div>`:''}`;
}

async function openPromote(eventId,date){
  if(!FEAT) await loadFeature(true);
  const F=FEAT;
  if(!F||!F.enabled){ toast('Not switched on right now'); return; }
  const all=(F.gigs||[]);
  const gigs=eventId?all.filter(g=>g.eventId===eventId&&g.date===date):all;
  if(!gigs.length){
    openSheet(`<h3>Promote a gig</h3>
      <p class="lede">${eventId?'This show cannot be featured yet.':'Nothing to promote yet.'} A gig needs a date in the future and a city — a featured spot lives in a city's list.</p>
      <button class="big alt" style="margin-top:14px" onclick="closeSheet()">Close</button>`);
    return;
  }
  const row=(g)=>{
    const full=g.left<=0, had=g.already;
    const label=`${esc(g.venue||'Gig')} · ${esc(g.city)}`;
    const when=daystamp(new Date(g.date+'T12:00:00').getTime());
    return `<button class="row" style="width:100%;text-align:left;border:0;background:none;padding:12px 14px;${full||had?'opacity:.5':''}"
        ${full||had?'disabled':`onclick="payPromote('${esc(g.eventId)}','${esc(g.date)}')"`}>
      <div class="m"><div class="t">${label}</div>
        <div class="s">${when}${g.time?' · '+esc(g.time):''} · ${
          had?'already featured' : full?'no spots left that night' : `${g.left} of ${F.slots} spots left`}</div></div>
      ${full||had?'':'<span class="cnt" style="color:var(--accent-2)">★</span>'}</button>`;
  };
  openSheet(`<h3>Promote a gig</h3>
    <ul class="promotelede">
      <li>${money$(F.price)} puts the show at the top of its city's list for that night.</li>
      <li>It appears in the Featured shows box with an orange border.</li>
      <li>Only ${F.slots} spots are available per city and night — first come, first served.</li>
    </ul>
    <div class="list" style="margin-top:12px">${gigs.map(row).join('')}</div>
    <p class="fine">Paid once, for that night only. If you cancel the gig afterwards the spot is used up, so promote a night you are sure of.</p>
    <button class="big alt" style="margin-top:12px" onclick="closeSheet()">Never mind</button>`);
}

async function payPromote(eventId,date){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'featureStart',eventId,date})});
  if(!d||!d.ok||!d.url){ toast((d&&d.error)||'Couldn’t open checkout'); return; }
  location.href=d.url;
}

/* Back from Stripe. Settling here is the fast path; the webhook is the backstop,
   so a person who closes the tab still gets the spot they paid for. */
async function finishPromote(session){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'featureFinish',session})});
  FEAT=null; await loadFeature(true);
  if(d&&d.ok){
    toast('You’re featured');
    history.replaceState({},'',location.pathname);
    return;
  }
  /* THE URL IS THE RETRY. `?promoted=<session>` is the only thing that can settle
     this payment from the phone — the webhook is the other path, and if both are
     having a bad minute, wiping it leaves somebody who has paid with nothing to
     tap. So it stays until it works, and the message says to pull down. */
  toast((d&&d.error)||'Couldn’t confirm that yet — pull down to try again');
}

const promoteCard=()=>soonCard('promote','Get booked somewhere new',
  'Put yourself in the city feed for towns you do not play yet, so venues there can find you.',
  [['Cities you can appear in','Anywhere, not just where you have gigs'],
   ['Who saw you','Which venues opened your page'],
   ['One tap to pitch','Sends them your numbers and your set']]);
const presskitCard=()=>soonCard('presskit','Your press kit',
  'One link a venue can open: who you are, what you play, and what happened last time you played a room like theirs.',
  [['A page you can send','myset.vip/you/press'],
   ['Real numbers on it','Average room, votes, nights played'],
   ['A PDF too','For the bookers who still ask for one']]);
const brandingCard=()=>soonCard('branding','Your colours on their phones',
  'The voting page in your own colours and logo instead of MySet\u2019s.',
  [['Your accent colour','Every button and highlight'],
   ['Your logo at the top','Instead of the MySet mark'],
   ['Your name in the tab','So it reads as yours']]);

/* ---------- the Google Sheet ----------
   Owner only. Two things a person needs: is it connected, and sync it now. The
   status call is cheap; the sync is not, so it never runs on its own from here. */
let SHEET=null, SHEETBUSY=false;
async function loadSheet(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'sheetStatus'}),quiet:true});
  SHEET=(d&&d.ok)?d:{on:false,reason:'Could not ask the server.'};
  if(D) render();
}
function sheetCard(){
  if(!PLAN||!PLAN.owner) return '';
  if(SHEET===null){ loadSheet(); return ''; }
  const S=SHEET;
  const when=S.lastRunAt?dstamp(S.lastRunAt):'never';
  return `<div class="sec"><span class="kick">Your Google Sheet</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">A copy of everything — who signed up, every night played, every song and what the room asked for. Nothing in MySet reads it, so you can slice it up however you like.</p>
    ${S.on
      ? `<div class="list">
          <div class="row"><div class="m"><div class="t">${S.reachable?'Connected':'Set up, but Google said no'}</div>
            <div class="s muted">${S.reachable?esc(S.title||'your sheet')+' · '+((S.present||[]).length)+' of '+((S.tabs||[]).length)+' tabs':esc(S.error||'')}</div></div>
            <span class="now">${S.reachable?'✓':'!'}</span></div>
          <div class="row"><div class="m"><div class="t">Last updated</div>
            <div class="s muted">${esc(when)}${S.runs?' · '+S.runs+' time'+(S.runs===1?'':'s'):''} · updates itself nightly</div></div></div>
         </div>
         <div class="wrap" style="margin-top:12px"><button class="big${SHEETBUSY?' alt':''}" onclick="sheetSync()">${SHEETBUSY?'Working…':'Update the sheet now'}</button></div>`
      : `<div class="list"><div class="row"><div class="m"><div class="t">Not connected yet</div>
           <div class="s muted">${esc(S.reason||'')}</div></div></div></div>
         <p class="muted" style="font-size:12px;padding:0 14px;margin:10px 0 0">Three settings in Netlify, then share the sheet with the address they give you. The full walk-through is in <b>GOOGLE-SHEET-SETUP.md</b>.</p>`}`;
}
async function sheetSync(){
  if(SHEETBUSY) return;
  SHEETBUSY=true; render();
  const r=await api('/admin',{method:'POST',body:JSON.stringify({action:'sheetSync'})});
  SHEETBUSY=false;
  if(!r||!r.ok){ toast((r&&r.error)||'Could not update the sheet'); SHEET=null; render(); return; }
  const n=Object.values(r.counts||{}).reduce((a,b)=>a+(Number(b)||0),0);
  toast(`Sheet updated — ${n} row${n===1?'':'s'}`);
  SHEET=null; render();
}

/* ---------- Perry's review queue ----------
   Owner only, and the endpoint enforces that too. Deliberately plain: a name, the
   page it belongs to, and two buttons. */
async function loadIdQueue(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'idQueue'}),quiet:true});
  IDQ=(d&&d.ok)?(d.queue||[]):[];
  if(D) render();
}
function idQueueCard(){
  if(!PLAN||!PLAN.owner) return '';
  if(IDQ===null){ loadIdQueue(); return ''; }
  if(!IDQ.length) return '';
  return `<div class="sec"><span class="kick">Waiting for you \u00b7 ${IDQ.length}</span></div>
    <div class="list">${IDQ.map(r=>`<div class="row"><div class="m">
      <div class="t">${esc(r.legalName||r.account||r.artistId)}</div>
      <div class="s muted">myset.vip/${esc(r.slug||'')}${r.account&&r.legalName&&r.account!==r.legalName?` \u00b7 goes by ${esc(r.account)}`:''} \u00b7 asked ${dstamp(r.at)}</div>
      <div class="s muted">name ${r.nameMatch?esc(r.nameMatch):'not compared'} \u00b7 date of birth ${r.dobMatch===true?'matches':r.dobMatch===false?'does NOT match':'not compared'}</div>
    </div>
    <button class="act" onclick="idDecide('${esc(r.artistId)}',true)">Approve</button>
    <button class="act" onclick="idDecide('${esc(r.artistId)}',false)">No</button></div>`).join('')}</div>
    <p class="muted" style="font-size:12px;padding:10px 14px 0">Open their page in another tab to see the ID \u2014 it is not shown here, and it is deleted the moment you decide.</p>`;
}
async function idDecide(who,yes){
  let why='';
  if(!yes){ why=prompt('Why not? They will see this.')||''; if(!why.trim()) return; }
  const r=await api('/admin',{method:'POST',body:JSON.stringify({
    action:yes?'idApprove':'idReject',artistId:who,why})});
  if(!r||!r.ok){ toast((r&&r.error)||'Could not do that'); return; }
  IDQ=null; toast(yes?'Verified':'Turned down');
}

/* What the audience said when MySet asked them. Read-only. It lived next to the
   money until 2026-09-12, when the founder moved it to the Profile tab, under the
   merch: the rating is about the page and the person, not the takings. */
function fbCard(){
  const f=(D&&D.feedback)||null;
  if(!f||!f.count) return '';
  const stars=n=>'\u2605'.repeat(n)+'\u2606'.repeat(5-n);
  return `<div class="sec"><span class="kick">What the room said</span></div>
    <div class="list">
      <div class="row"><div class="m">
        <div class="t">${f.average} out of 5 <span class="muted" style="font-weight:400">\u00b7 ${f.count} ${f.count===1?'person':'people'}</span></div>
        <div class="s muted">${esc(stars(Math.round(f.average)))}</div>
      </div></div>
      ${(f.recent||[]).slice(0,6).map(r=>`<div class="row"><div class="m">
        <div class="s" style="color:var(--accent-ink)">${esc(stars(r.stars))}</div>
        <div class="t" style="font-size:14px;font-weight:400">${esc(r.note)}</div>
      </div></div>`).join('')}
    </div>`;
}

/* What fans reported through "Something wrong?", each with the server's own errors
   from the three hours before it. Fetched on tap, never on the poll. */
function bugCard(){
  return `<div class="sec"><span class="kick">If something broke</span></div>
    <div class="list"><div class="row" onclick="loadBugs()" style="cursor:pointer"><div class="m">
      <div class="t">Bug reports from the room</div>
      <div class="s muted">What a fan said, and what the app saw at the time</div>
    </div></div></div>`;
}
async function loadBugs(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'bugList'})});
  const when=t=>new Date(t).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  const list=(d&&d.list)||[];
  openSheet(`<div class="kick">Bug reports</div>
    <h3 style="margin:2px 0 8px">${list.length?`${list.length} report${list.length===1?'':'s'}`:'Nothing reported'}</h3>
    ${list.length?'':'<p class="lede">When a fan taps “Something wrong?” on the voting page, it lands here with what the app saw.</p>'}
    ${list.map(r=>`<div class="row" style="display:block;padding:12px 0;border-top:1px solid var(--line)">
      <div class="s muted">${esc(when(r.at))} · ${esc(r.fan)}</div>
      <div class="t" style="font-weight:600">${esc(r.note)}</div>
      ${(r.client||[]).length?`<div class="s muted" style="margin-top:6px">The phone saw:</div>${r.client.map(c=>`<div class="s mono">${esc(when(c.at))} ${esc(c.what)}</div>`).join('')}`:''}
      ${(r.server||[]).length?`<div class="s muted" style="margin-top:6px">The server saw (3h before):</div>${r.server.map(c=>`<div class="s mono">${esc(when(c.at))} [${esc(c.where)}] ${esc(c.msg)}</div>`).join('')}`:'<div class="s muted" style="margin-top:6px">The server logged no errors in the three hours before this.</div>'}
    </div>`).join('')}`);
}

/* ---------- getting paid ----------
   Stripe hosts the whole onboarding, so MySet never sees a bank detail. The card
   states who pays Stripe's own fee, because an artist who reads "2%" and then sees
   a $5 pack arrive as ~$4.45 will reasonably think they were misled — and they
   should hear it here rather than from a payout. */
let PAY=null, PAYQ=false;
async function loadPay(refresh){
  if(PAYQ) return; PAYQ=true;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'payStatus',refresh:!!refresh}),quiet:true});
  PAYQ=false;
  if(d&&d.ok){ PAY=d.pay;
    if((TAB==='money'||(TAB==='live'&&!typing()))&&D) render();
    /* Step 4 of the first run asks for this and keys its paint on it; a new
       account lands on Setlist, so the tab test above would leave it stale. */
    else if(D&&isNew()) drawFirstRun(); }
}
function payCard(){
  if(!PAY){ loadPay(); return ''; }
  const p=PAY;
  if(p.platformOwner) return '';          // the founding account predates Connect
  if(p.ready) return `<div class="sec"><span class="kick">Getting paid</span></div>
    <div class="list"><div class="row"><div class="m">
      <div class="t">Card payments are on <span class="okmark">✓</span></div>
      <div class="s muted">MySet takes ${p.cutPct}% of what comes through the app on your ${esc(p.plan)} plan. ${esc(p.stripeFeeNote)}</div>
    </div><button class="act" onclick="payDash()">Stripe ↗</button></div></div>`;
  const started=p.started;
  return `<div class="sec"><span class="kick">Getting paid</span></div>
    <div class="list"><div class="row muted" style="display:block">
      <div class="t" style="color:var(--ink)">${started?'Stripe still needs a few details':'Set up card payments'}</div>
      <p class="s" style="margin:6px 0 0">${started
        ? 'You started this but Stripe has not finished checking yet. Tipping and extra votes stay switched off in your room until it has — so nothing can land in the wrong account.'
        : 'Your fans can\u2019t tip or buy votes until this is done. Stripe handles it and MySet never sees your bank details.'}</p>
      <p class="s" style="margin:6px 0 0">On your <b>${esc(p.plan)}</b> plan MySet takes <b>${p.cutPct}%</b> of money through the app. ${esc(p.stripeFeeNote)}</p>
      ${started?'':`<div class="field" style="margin-top:14px">
        <label>Where is your bank account?</label>
        <select class="inp" id="payCountry">${payCountries()}</select>
        <p class="s muted" style="margin:6px 0 0">Stripe can\u2019t change this later, so it has to be right.</p>
      </div>`}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="big" style="flex:1;min-width:180px" onclick="payStart()">${started?'Finish with Stripe':'Start with Stripe'}</button>
        ${started?`<button class="act" onclick="loadPay(true)">Check again</button>`:''}
      </div>
    </div></div>`;
}
/* Stripe's own supported list is longer than this; these are the countries MySet
   has artists or gigs in, plus the obvious neighbours, with the gig calendar's
   country as the default because that is where they actually play. */
const PAY_COUNTRIES=[['TH','Thailand'],['US','United States'],['GB','United Kingdom'],
  ['AU','Australia'],['CA','Canada'],['NZ','New Zealand'],['IE','Ireland'],
  ['DE','Germany'],['FR','France'],['ES','Spain'],['IT','Italy'],['NL','Netherlands'],
  ['PT','Portugal'],['SE','Sweden'],['DK','Denmark'],['NO','Norway'],['FI','Finland'],
  ['SG','Singapore'],['MY','Malaysia'],['JP','Japan'],['MX','Mexico'],['BR','Brazil']];
function payGuessCountry(){
  // whatever country their next gig is in — the best guess we actually have
  const ev=(D&&D.events)||[];
  for(const e of ev){ const c=(e.country||'').trim(); if(c){
    const hit=PAY_COUNTRIES.find(([,name])=>name.toLowerCase()===c.toLowerCase());
    if(hit) return hit[0]; } }
  return '';
}
function payCountries(){
  const guess=payGuessCountry();
  return `<option value="">Choose\u2026</option>`+PAY_COUNTRIES
    .map(([c,n])=>`<option value="${c}"${c===guess?' selected':''}>${esc(n)}</option>`).join('');
}
async function payStart(){
  /* Step 4 of the first run draws its own country select over the Money tab's;
     while that overlay is up it is the only one the artist can be tapping, so
     it wins — reading the tab's would refuse a country they had just picked. */
  const sel=$('#firstrun.on #frCountry')||$('#payCountry');
  const country=sel?(sel.value||''):'';
  if(sel&&!country){ toast('Pick where your bank account is first'); return; }
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'payStart',country})});
  if(d&&d.ok&&d.url){ PAY=d.pay; location.href=d.url; }
  else if(d&&d.error==='need-country') toast('Pick where your bank account is first');
  else toast((d&&d.error)||'Could not start that');
}
async function payDash(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'payDashboard'})});
  if(d&&d.ok&&d.url) window.open(d.url,'_blank');
  else toast((d&&d.error)||'Not available yet');
}

function setTab(t){if(t==='merch')t='profile';TAB=t;localStorage.setItem('myset.tab',t);if(t==='money')loadPay();if(t==='gigs')loadFeature();if(t==='settings'){loadRecovery();loadPasskeys();}if(t==='live'){if(!EVENTS)loadGigs();if(!PAY)loadPay();}if(D)render();
  if(t==='money'){DETAIL=null;loadRev();loadHist();loadOrders();}
  if(t==='profile'){ loadProf(); loadComm(); loadPlan(); loadMerch(); loadOrders(); }
  if(t==='setlist') loadPlan();
  /* drawPush paints into a div that render() has just created, and switching INTO
     the tab never called it — only a reload that landed here did. So the panel sat
     on its "Checking…" placeholder for anyone who tapped their way to Settings,
     which is everyone. */
  if(t==='settings'){loadTeam();loadPlan();loadTick();drawPush();maybeVerifyIntro();}
  if(t==='gigs'){ loadGigs(); loadPitches(); }}
async function loadPitches(force){
  if(PITCHES&&!force)return;
  PITCHES=await api('/admin',{method:'POST',body:JSON.stringify({action:'pitchList'}),quiet:true});
  if(TAB==='gigs'&&D)render();
}
/* Stripe is the source of truth for money, so this reads it directly rather than
   trusting the app's own ledger. Fetched on demand — never on the 4s live poll. */
async function loadRev(force){
  if(REV&&!force)return;
  REV=await api('/revenue',{quiet:true});
  if(TAB==='money'&&D)render();
}
/* ---- gig calendar ---- */
const pad=n=>String(n).padStart(2,'0');
/* The same bucket the server counts in (gigMonthOf in _lib.mjs) — UTC year-month.
   If these two ever disagree the artist is told a different number from the one
   that is enforced, so they are computed the same way in both places. */
const monthKey=(now=Date.now())=>new Date(now).toISOString().slice(0,7);
const todayStr=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
let CAL_MONTH=todayStr().slice(0,7);
const MON=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const monthName=m=>{const [Y,M]=m.split('-').map(Number);return `${MON[M-1]} ${Y}`;};
const dayNum=d=>Number(d.slice(8,10));
const monShort=d=>MON[Number(d.slice(5,7))-1].slice(0,3);
const dowName=d=>{const [Y,M,D]=d.split('-').map(Number);return DOW[new Date(Date.UTC(Y,M-1,D)).getUTCDay()];};
const endOf=ev=>{const m=/^(\d{2}):(\d{2})$/.exec(ev.time||'');if(!m)return '23:00';
  const t=((+m[1]*60+ +m[2])+(ev.durationMin||180))%1440;
  return pad(Math.floor(t/60))+':'+pad(t%60);};
function calCells(month){
  const [Y,M]=month.split('-').map(Number);
  const first=new Date(Date.UTC(Y,M-1,1)), lead=first.getUTCDay();
  const out=[];
  for(let i=0;i<42;i++){
    const t=new Date(Date.UTC(Y,M-1,1-lead+i));
    const date=`${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}-${pad(t.getUTCDate())}`;
    out.push({date,day:t.getUTCDate(),out:t.getUTCMonth()!==M-1});
    if(i>=34&&t.getUTCMonth()!==M-1&&t.getUTCDate()>7)break;
  }
  return out;
}
function calWindow(){
  const [Y,M]=CAL_MONTH.split('-').map(Number);
  const from=`${Y}-${pad(M)}-01`;
  const end=new Date(Date.UTC(Y,M+2,0));   // this month plus two, so "coming up" is full
  return {from, to:`${end.getUTCFullYear()}-${pad(end.getUTCMonth()+1)}-${pad(end.getUTCDate())}`};
}
async function loadGigs(force){
  if(EVENTS&&!force)return;
  const w=calWindow();
  EVENTS=await api('/admin',{method:'POST',body:JSON.stringify({action:'eventList',from:w.from,to:w.to}),quiet:true});
  if((TAB==='gigs'||(TAB==='live'&&!typing()))&&D)render();
}
function calMove(n){
  const [Y,M]=CAL_MONTH.split('-').map(Number);
  const t=new Date(Date.UTC(Y,M-1+n,1));
  CAL_MONTH=`${t.getUTCFullYear()}-${pad(t.getUTCMonth()+1)}`;
  loadGigs(true);
}
function openGig(id,onDate){
  const ev=id?((EVENTS&&EVENTS.events)||[]).find(x=>x.id===id):null;
  const tz=(ev&&ev.tz)||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
  const editing=!!ev;
  const R=(ev&&ev.repeat)||null;
  openSheet(`<h3>${ev?'Edit gig':'Add a gig'}</h3>
    ${ev&&ev.repeat?`<p class="lede">This repeats — changes apply to every night in the run.</p>`:''}
    <div class="field" style="padding-left:0;padding-right:0"><label>Venue</label>
      <input class="inp" id="gV" maxlength="80" placeholder="The Ugly Duckling Irish Pub" value="${esc(editing?ev.venue:'')}"></div>
    <div style="display:flex;gap:8px">
      <div class="field" style="padding-left:0;padding-right:0;flex:1"><label>City</label>
        <input class="inp" id="gCity" maxlength="60" placeholder="Koh Phangan" value="${esc(editing?ev.city:'')}"></div>
      <div class="field" style="padding-left:0;padding-right:0;flex:1"><label>Country</label>
        <input class="inp" id="gCountry" maxlength="60" placeholder="Thailand" value="${esc(editing?ev.country:'')}"></div>
    </div>
    <div class="field" style="padding-left:0;padding-right:0"><label>Address <span class="muted" style="font-weight:400">— optional</span></label>
      <input class="inp" id="gAddr" maxlength="160" placeholder="88 Baan Tai Beach Road" value="${esc(editing?(ev.address||''):'')}"></div>
    <div class="field" style="padding-left:0;padding-right:0"><label>Or paste a maps link</label>
      <input class="inp" id="gMap" type="url" inputmode="url" autocomplete="off" spellcheck="false"
        placeholder="Paste from Google or Apple Maps" value="${esc(editing?(ev.mapUrl||''):'')}"></div>
    <input type="hidden" id="gLat" value="${Number.isFinite(ev&&ev.lat)?ev.lat:''}">
    <input type="hidden" id="gLng" value="${Number.isFinite(ev&&ev.lng)?ev.lng:''}">
    <input type="hidden" id="gAddr0" value="${esc(editing?(ev.address||''):'')}">
    <input type="hidden" id="gMap0" value="${esc(editing?(ev.mapUrl||''):'')}">
    <p class="muted" style="font-size:12px;margin:2px 0 0">Either one gives fans a <b>Directions</b> button that opens in whichever map app their phone uses — Google or Apple.</p>
    <div class="field" style="padding-left:0;padding-right:0"><label>Date</label>
      <input class="inp" id="gDate" type="date" value="${esc(ev?ev.date:(onDate||todayStr()))}"></div>
    <div style="display:flex;gap:8px">
      <div class="field" style="padding-left:0;padding-right:0;flex:1"><label>Starts</label>
        <input class="inp" id="gTime" type="time" value="${esc(ev?ev.time:'20:00')}"></div>
      <div class="field" style="padding-left:0;padding-right:0;flex:1"><label>Ends</label>
        <input class="inp" id="gEnd" type="time" value="${esc(ev?endOf(ev):'23:00')}"></div>
    </div>
    <p class="muted" style="font-size:12px;margin:2px 0 0">Finishing after midnight is fine — put the real time.</p>
    <div class="field" style="padding-left:0;padding-right:0"><label>Repeats</label>
      <div class="chips">${[['','Just once'],['weekly','Weekly'],['biweekly','Every 2 weeks'],['monthly','Monthly'],['yearly','Yearly']]
        .map(([k,l])=>`<button class="chip ${(R?R.freq:'')===k?'on':''}" data-act="grep" data-id="${k}">${l}</button>`).join('')}</div>
      <input type="hidden" id="gRepeat" value="${esc(R?R.freq:'')}"></div>
    <div class="field" style="padding-left:0;padding-right:0"><label>Stop repeating on (optional)</label>
      <input class="inp" id="gUntil" type="date" value="${esc(R&&R.until?R.until:'')}"></div>
    <div class="field" style="padding-left:0;padding-right:0"><label>Setlist for this gig</label>
      <select class="inp" id="gList">
        <option value=""${!(ev&&ev.listId)?' selected':''}>Leave whatever I’ve picked</option>
        <option value="all"${ev&&ev.listId==='all'?' selected':''}>All songs</option>
        ${((D&&D.lists)||[]).map(l=>`<option value="${esc(l.id)}"${
          ev&&ev.listId===l.id?' selected':''}>${esc(l.name)} · ${l.count} songs</option>`).join('')}
      </select>
      <p class="muted" style="font-size:12px;margin:7px 0 0">${((D&&D.lists)||[]).length
        ? 'Tapping “Start the show” on the night switches to this automatically. Leave it on the first option and the gig won’t touch your pick.'
        : 'Make a setlist on the Setlist tab and it’ll show up here.'}</p></div>
    <input type="hidden" id="gTz" value="${esc(tz)}">
    <button class="big" style="margin-top:16px" data-act="gigsave" data-id="${esc(ev?ev.id:'')}">${ev?'Save changes':'Add it'}</button>
    ${ev?`<button class="big alt" style="margin-top:10px" data-act="gigdel" data-id="${esc(ev.id)}">Delete this gig${ev.repeat?' and its whole run':''}</button>`:''}`);
}
let GIG_MAPS_PROMISE=null;
async function loadGigMaps(){
  if(window.google&&google.maps)return google.maps;if(GIG_MAPS_PROMISE)return GIG_MAPS_PROMISE;
  GIG_MAPS_PROMISE=(async()=>{const c=await fetch('/api/mapconfig',{cache:'no-store'}).then(r=>r.json());if(!c.ok||!c.enabled||!c.key)throw Error('maps unavailable');return new Promise((resolve,reject)=>{window.__mysetGigMapsReady=()=>resolve(google.maps);const s=document.createElement('script');s.src=`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(c.key)}&v=weekly&loading=async&language=en&callback=__mysetGigMapsReady`;s.async=true;s.onerror=reject;document.head.appendChild(s)})})();
  return GIG_MAPS_PROMISE;
}
async function coordinateGig(ev){
  try{
    const p=await api('/admin',{method:'POST',body:JSON.stringify({action:'eventPlace',place:ev}),quiet:true});
    if(p&&p.ok){ev.address=p.address||ev.address;ev.mapUrl=p.mapUrl||ev.mapUrl;if(Number.isFinite(p.lat)&&Number.isFinite(p.lng)){ev.lat=p.lat;ev.lng=p.lng;return ev}}
    const maps=await loadGigMaps(), q=ev.address||[ev.venue,ev.city,ev.country].filter(Boolean).join(', ');
    if(!q)return ev;const r=await new maps.Geocoder().geocode({address:q}),hit=r.results&&r.results[0];
    if(hit){ev.lat=hit.geometry.location.lat();ev.lng=hit.geometry.location.lng()}
  }catch(e){}
  return ev;
}
async function saveGig2(id){
  if(WRITING)return; WRITING=true;
  try{
  const v=x=>(($('#'+x)||{}).value||'').trim();
  const freq=v('gRepeat');
  const ev={id:id||undefined,venue:v('gV'),city:v('gCity'),country:v('gCountry'),
    address:v('gAddr'),mapUrl:v('gMap'),listId:v('gList'),
    lat:v('gLat')===''?null:Number(v('gLat')),lng:v('gLng')===''?null:Number(v('gLng')),
    tz:v('gTz'),date:v('gDate'),time:v('gTime')||'20:00',endTime:v('gEnd')||'',
    repeat:freq?{freq,until:v('gUntil')||null}:null};
  if(!ev.venue){toast('Where is it?');return;}
  if(!ev.date){toast('Pick a date');return;}
  const placeChanged=ev.address!==v('gAddr0')||ev.mapUrl!==v('gMap0');
  if(placeChanged){ev.lat=null;ev.lng=null;}
  if(!Number.isFinite(ev.lat)||!Number.isFinite(ev.lng))await coordinateGig(ev);
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'eventSave',event:ev})});
  if(!d.ok){toast(d.error||'Could not save');return;}
  const saved=(d.events||[]).find(x=>x.id===d.id);
  EVENTS=null;
  closeSheet(); await loadGigs(true);
  if(ev.mapUrl&&saved&&!saved.mapUrl) toast('Gig saved — but that link wasn’t a Google or Apple Maps one');
  else toast(id?'Gig updated':'Gig added');
  } finally { WRITING=false; }
}
async function delGig(id){
  if(WRITING)return;
  if(!confirm('Delete this gig? If it repeats, the whole run goes.'))return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'eventDelete',id})});
  if(!d.ok){toast(d.error||'Failed');return;}
  closeSheet(); await loadGigs(true); toast('Deleted');
}
async function skipGig(pair){
  if(WRITING)return; WRITING=true;
  try{
  const [id,date]=pair.split('|');
  const occ=((EVENTS&&EVENTS.occurrences)||[]).find(o=>o.eventId===id&&o.date===date);
  const on=!(occ&&occ.cancelled);
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'eventSkip',id,date,on})});
  if(!d.ok){toast(d.error||'Failed');return;}
  await loadGigs(true); toast(on?'That night is cancelled':'Back on');
  } finally { WRITING=false; }
}
/* A cancelled night stays visible so it can be restored. Hiding drops it from
   the list for good — the skip stays on the rule, it just stops being shown. */
async function hideGig(pair){
  if(WRITING)return;
  const [id,date]=pair.split('|');
  if(!confirm('Remove that night from your list? The rest of the run is unaffected.'))return;
  WRITING=true;
  try{
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'eventHide',id,date})});
    if(!d.ok){toast(d.error||'Failed');return;}
    EVENTS=null; await loadGigs(true); toast('Gone from your list');
  } finally { WRITING=false; }
}
async function loadProf(force){
  if(PROF&&!force)return;
  // ?t= skips the 15s edge copy (decision 0042): the artist sees their own save at once
  PROF=await fetch('/api/profile?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()).catch(()=>null);
  if(TAB==='profile'&&D)render();
}
async function saveProfile(){
  const v=id=>(($('#'+id)||{}).value||'').trim();
  const IDS={spotify:'lkSpotify',applemusic:'lkApple',ytmusic:'lkYtm',instagram:'lkIg',website:'lkWeb'};
  const typed={}; for(const k in IDS) typed[k]=v(IDS[k]);   // capture BEFORE the re-render
  const management=v('pfManagement'), managementUrl=v('pfManagementUrl');
  if(!!management!==!!managementUrl){toast('Add both the label or management name and its website, or leave both blank.');return;}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'profileSet',
    name:v('pfName'),tagline:v('pfTag'),style:v('pfStyle'),management,managementUrl,bio:(($('#pfBio')||{}).value||''),
    links:typed})});
  if(!d.ok){toast(d.error||'Could not save');return;}
  PROF=null; await loadProf(true);
  const saved=(PROF&&PROF.links)||{};
  const dropped=Object.keys(IDS).filter(k=>typed[k]&&!saved[k]);
  toast(dropped.length?`Saved — but ${dropped.join(', ')} didn’t look like a real link for that service`
                      :'Profile saved');
}
async function addMedia(){
  const el=$('#mdUrl'); const url=(el.value||'').trim(); if(!url)return;
  const btn=$('#mdAdd'); if(btn){btn.disabled=true;btn.innerHTML='<span class="spin"></span>';}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'mediaAdd',url})});
  if(btn){btn.disabled=false;btn.textContent='Add';}
  if(!d.ok){toast(d.error||'Could not add that');return;}
  el.value=''; PROF=null; await loadProf(true); render(); toast('Added to your page');
}
async function media(action,mid,dir){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action,mid,dir})});
  if(!d.ok){toast(d.error||'Failed');return;}
  PROF=null; await loadProf(true); render();
}
/* Perry could not see every night he had played. Two of them were real: one was
   archived before MySet had more than one artist and still sits under the old flat
   key, and the index row for another never landed. See healHistory in _history.mjs. */
/* Emptying the board does NOT give anybody their votes back — a vote is spent when
   it is cast, and the artist reaching for this button does not change that. Said out
   loud before it happens, because the room cannot be told afterwards. */
function clearBoardAsk(){
  if(!confirm('Clear every vote off the board?\n\nNobody gets their votes back \u2014 they were spent when they were cast. The room starts from nothing.'))return;
  act('resetVotes');
}
/* Ten seconds, counted on the button itself so the artist can see it running and
   cannot fire a second one over the top of the first. The countdown the ROOM sees is
   the server's — this is only the local echo of it. */
function lastCall(){
  const b=$('#lastCall'); if(!b||b.disabled)return;
  act('countdown');
  let left=10;
  b.disabled=true;
  const t=setInterval(()=>{
    left--;
    if(left<=0){ clearInterval(t); b.disabled=false;
      b.innerHTML='<b>Last call</b><small>Ten seconds on every phone in the room</small>'; return; }
    b.innerHTML=`<b>Last call \u00b7 ${left}</b><small>Counting down on every phone in the room</small>`;
  },1000);
  b.innerHTML='<b>Last call \u00b7 10</b><small>Counting down on every phone in the room</small>';
}
async function healHist(){
  const d=await api('/history',{method:'POST',body:JSON.stringify({action:'heal'})});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn\u2019t check just now');return;}
  await loadHist(true); render();
  toast(d.added?`Found ${d.added} more show${d.added===1?'':'s'}`:'Everything is already here');
}
/* Every night before today was filed with whatever single venue was in Settings
   at the time, so an artist with a few residencies has a history that names one of
   them over and over. This asks the server to look each night up on the calendar.
   See placeShows in _history.mjs — it only renames a night a gig was actually
   running for. */
async function placeHist(){
  const d=await api('/history',{method:'POST',body:JSON.stringify({action:'place'})});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn\u2019t check just now');return;}
  await loadHist(true); render();
  toast(d.placed?`Renamed ${d.placed} night${d.placed===1?'':'s'}`
                :'Every night already matches your calendar');
}
async function loadHist(force){
  if(HIST&&!force)return;
  HIST=await api('/history',{quiet:true});
  if((TAB==='money'||(D&&D.songs&&!D.songs.length))&&D&&!typing())render();
}
async function openShow(id){
  DETAIL={loading:true}; render();
  const d=await api('/history?show='+encodeURIComponent(id));
  DETAIL=d.ok?d.show:null;
  if(!d.ok)toast(d.error||'Could not open that show');
  render();
}
function closeShow(){DETAIL=null;render();}
/* THE NIGHT'S NAME IS TAPPABLE. A show started by hand from the Live tab is filed
   under whatever venue was typed, or as "Untitled show" — and the founder asked
   (2026-09-12) to be able to name it afterwards from the Money tab; it works for
   every filed night, not only the hand-started ones. The title sits INSIDE a row
   that is itself data-act="show", and the click dispatcher takes the innermost
   data-act, so a tap on the name renames and never opens. The pencil is inline so
   the row reads as editable without a rule in studio.html. The element shrinks to
   its words (inline-block): the blank line to the right of a short name is still
   the row, and a tap there opens the show like the rest of it. */
const histName=(id,title)=>`<div class="t" data-act="histname" data-id="${esc(id)}" role="button" tabindex="0" title="Rename this night" style="cursor:text;display:inline-block;max-width:100%">${esc(title)}<i style="font-style:normal;font-size:12px;color:var(--muted);margin-left:6px">✎</i></div>`;
async function renameNight(id){
  const r=(DETAIL&&DETAIL.showId===id)?DETAIL:(((HIST&&HIST.shows)||[]).find(x=>x.showId===id)||null);
  const shown=r?(r.title||r.venue||''):'';   // what the prompt was pre-filled with, title or venue
  const title=(prompt('Name this night',shown)||'').replace(/\s+/g,' ').trim().slice(0,100);
  // OK on the untouched prompt is not a rename: a venue-named night must not get
  // its venue frozen as a hand-typed title, which would lock it against placeShows.
  if(!title||title===shown)return;
  const d=await api('/history',{method:'POST',body:JSON.stringify({action:'rename',show:id,title})});
  if(!d||!d.ok){toast((d&&d.error)||'Couldn\u2019t rename that');return;}
  const t=d.title||title;     // the server's cut of it, so the row shows what was kept
  if(HIST&&HIST.shows) HIST.shows.forEach(x=>{ if(x.showId===id) x.title=t; });
  if(DETAIL&&DETAIL.showId===id) DETAIL.title=t;
  render(); toast('Renamed');
}
async function reconcile(id){
  toast('Re-checking Stripe\u2026');
  const d=await api('/history',{method:'POST',body:JSON.stringify({action:'reconcile',show:id})});
  if(!d.ok){toast(d.error||'Could not reach Stripe');return;}
  DETAIL=d.show; await loadHist(true); render(); toast('Updated from Stripe');
}
async function recover(){
  toast('Checking Stripe\u2026');
  const d=await api('/revenue',{method:'POST'});
  if(!d.ok){toast(d.error||'Could not reach Stripe');return;}
  toast(d.recovered?`Delivered ${d.recovered} payment${d.recovered===1?'':'s'}`:'Nothing outstanding');
  await loadRev(true); await load();
}

const PANEL_SCROLL={queue:0,setlist:0};
/* The free-show cap, shown only when it is about to matter. */
function capNote(s){
  const cap=(PLAN&&PLAN.ok&&PLAN.limits&&PLAN.limits.gigs)||0;
  if(!cap||cap===null||!isFinite(cap))return '';
  const used=s.gigMonth===monthKey()?(s.gigCount||0):0;
  const left=Math.max(0,cap-used);
  if(left>2)return '';
  return `<p class="muted" style="font-size:12.5px;padding:8px 20px 0">${left===0
    ? `<b style="color:var(--accent)">That's your ${cap} free shows this month.</b> Your allowance resets on the 1st — or upgrade in Settings to play as often as you like.`
    : `<b>${left} free show${left===1?'':'s'} left this month.</b> Resets on the 1st.`}</p>`;
}
/* The gig tonight, if there is one: the server's `sched` when the calendar gig is
   within twelve hours, else today's occurrence from the calendar (loaded lazily;
   null until it lands). */
function tonightGig(s){
  if(s.sched&&s.sched.startsAt) return {venue:s.sched.venue||'',time:s.sched.time||'',listId:s.listId||''};
  const oc=(EVENTS&&EVENTS.ok&&EVENTS.occurrences)||[];
  const o=oc.find(x=>x.date===todayStr()&&!x.cancelled);
  return o?{venue:o.venue||'',time:o.time||'',listId:o.listId||''}:null;
}
/* TODAY. Four real checks, each against the data it is about, then Start.
   Null-safe on purpose: PAY, EVENTS and TEAM all arrive after the first paint.
   The clay icons are inline so the page stays one file with no requests. */
const CLAYICON={
  mic:'<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><defs><linearGradient id="clay-mic-g" y2="1"><stop stop-color="#FF375F"/><stop offset="1" stop-color="#FF7A45"/></linearGradient><linearGradient id="clay-mic-d" x2="0" y2="1"><stop offset=".5" stop-color="#600" stop-opacity="0"/><stop offset="1" stop-color="#600" stop-opacity=".3"/></linearGradient><radialGradient id="clay-mic-s" cx=".32" cy=".2" r=".55"><stop stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><path id="clay-mic-b" d="M32 5a10 10 0 0 1 10 10v11a10 10 0 0 1-20 0V15A10 10 0 0 1 32 5zM29 40h6v6h-6zM19 46h26a3 3 0 0 1 0 6H19a3 3 0 0 1 0-6z"/></defs><ellipse cx="32" cy="58" rx="17" ry="3.4" fill="#FF375F" opacity=".22"/><use href="#clay-mic-b" fill="url(#clay-mic-g)"/><use href="#clay-mic-b" fill="url(#clay-mic-d)"/><use href="#clay-mic-b" fill="url(#clay-mic-s)"/><path d="M26 15h12M26 20h12M26 25h12" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="2.2" opacity=".85"/><path d="M19 24v2a13 13 0 0 0 26 0v-2" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="3.2"/></svg>',
  tip:'<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><defs><linearGradient id="clay-tip-g" y2="1"><stop stop-color="#FF375F"/><stop offset="1" stop-color="#FF7A45"/></linearGradient><linearGradient id="clay-tip-d" x2="0" y2="1"><stop offset=".5" stop-color="#600" stop-opacity="0"/><stop offset="1" stop-color="#600" stop-opacity=".3"/></linearGradient><radialGradient id="clay-tip-s" cx=".32" cy=".2" r=".55"><stop stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><path id="clay-tip-b" d="M22 12h20a3 3 0 0 1 0 6H22a3 3 0 0 1 0-6zM17 20h30a2 2 0 0 1 2 2v25a9 9 0 0 1-9 9H24a9 9 0 0 1-9-9V22a2 2 0 0 1 2-2z"/></defs><ellipse cx="32" cy="58" rx="17" ry="3.4" fill="#FF375F" opacity=".22"/><circle cx="32" cy="9" r="5.5" fill="#fff"/><circle cx="32" cy="9" r="2.4" fill="#FF5A52"/><use href="#clay-tip-b" fill="url(#clay-tip-g)"/><use href="#clay-tip-b" fill="url(#clay-tip-d)"/><use href="#clay-tip-b" fill="url(#clay-tip-s)"/><path d="M26 16h12" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="2.4"/><path d="M32 48.5c-4-2.5-8-5.3-8-9.2a4 4 0 0 1 8-1.6 4 4 0 0 1 8 1.6c0 3.9-4 6.7-8 9.2z" fill="#fff"/></svg>',
  qr:'<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><defs><linearGradient id="clay-qr-g" y2="1"><stop stop-color="#FF375F"/><stop offset="1" stop-color="#FF7A45"/></linearGradient><linearGradient id="clay-qr-d" x2="0" y2="1"><stop offset=".5" stop-color="#600" stop-opacity="0"/><stop offset="1" stop-color="#600" stop-opacity=".3"/></linearGradient><radialGradient id="clay-qr-s" cx=".32" cy=".2" r=".55"><stop stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><path id="clay-qr-b" d="M20 8h24a12 12 0 0 1 12 12v24a12 12 0 0 1-12 12H20A12 12 0 0 1 8 44V20A12 12 0 0 1 20 8z"/></defs><ellipse cx="32" cy="58" rx="17" ry="3.4" fill="#FF375F" opacity=".22"/><use href="#clay-qr-b" fill="url(#clay-qr-g)"/><use href="#clay-qr-b" fill="url(#clay-qr-d)"/><use href="#clay-qr-b" fill="url(#clay-qr-s)"/><path d="M14 14h13v13H14zM37 14h13v13H37zM14 37h13v13H14zM37 37h4v4h-4zM45 37h5v4h-5zM37 45h4v5h-4zM45 45h5v5h-5z" fill="#fff"/><path d="M18 18h5v5h-5zM41 18h5v5h-5zM18 41h5v5h-5z" fill="#FF5A52"/></svg>',
  ticket:'<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true"><defs><linearGradient id="clay-ticket-g" y2="1"><stop stop-color="#FF375F"/><stop offset="1" stop-color="#FF7A45"/></linearGradient><linearGradient id="clay-ticket-d" x2="0" y2="1"><stop offset=".5" stop-color="#600" stop-opacity="0"/><stop offset="1" stop-color="#600" stop-opacity=".3"/></linearGradient><radialGradient id="clay-ticket-s" cx=".32" cy=".2" r=".55"><stop stop-color="#fff" stop-opacity=".62"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><path id="clay-ticket-b" d="M12 14h40a4 4 0 0 1 4 4v7.5a6.5 6.5 0 0 0 0 13V46a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4v-7.5a6.5 6.5 0 0 0 0-13V18a4 4 0 0 1 4-4z"/></defs><ellipse cx="32" cy="58" rx="17" ry="3.4" fill="#FF375F" opacity=".22"/><use href="#clay-ticket-b" fill="url(#clay-ticket-g)"/><use href="#clay-ticket-b" fill="url(#clay-ticket-d)"/><use href="#clay-ticket-b" fill="url(#clay-ticket-s)"/><path d="M41 19v26" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="2.2" stroke-dasharray="3.2 3.6" opacity=".85"/><path d="M17 27h15M17 34h10M17 41h13" fill="none" stroke="#fff" stroke-linecap="round" stroke-width="3.2"/></svg>'};
let QRSHOWN=(()=>{try{return !!localStorage.getItem('myset.qrshown')}catch(e){return false}})();
/* "All songs" is a choice, not the absence of one — but the server cannot tell the
   two apart: an empty listId is also what a show has before anyone picks. So the
   phone remembers that the artist tapped All songs on purpose (set in useList,
   cleared when a named set is used), and the checklist ticks the step off. The
   setlists sheet reads it too: its All songs row says "In play" only when this is
   set, and offers Use otherwise — the only way an artist can make the choice. */
let ALLSONGS=(()=>{try{return localStorage.getItem('myset.allsongs')==='1'}catch(e){return false}})();
function todayCard(s){
  const gig=tonightGig(s);
  const named=!!(s.listId||(gig&&gig.listId));
  const listOn=named||ALLSONGS;
  const payOn=PAY?!!(PAY.platformOwner||PAY.ready||PAY.chargesEnabled):!!D.paymentsEnabled;
  const votesOn=!!(s.unlimited||s.freeCredits>0);
  const rows=[
    ['mic','Select setlist',named?(s.listName?esc(s.listName):'Set for tonight'):ALLSONGS?'All songs — everything you haven’t hidden':'Tap to pick a set, or all your songs',listOn,'openLists()'],
    ['tip','Card payments ready',payOn?'Tips and extra votes go through Stripe':'Tap to set up Stripe',payOn,"setTab('money')"],
    ['qr','QR code printed or shown',QRSHOWN?'On the tables, they scan and vote':'Tap to bring it up full size',QRSHOWN,'showQr()'],
    ['ticket','Free votes set',s.unlimited?'Unlimited votes for everyone':`${s.freeCredits||0} free vote${s.freeCredits===1?'':'s'} each`,votesOn,'showPricing()'],
  ];
  const next=rows.findIndex(r=>!r[3]);
  return `<div class="today">
    <div class="th"><b>Today</b><span>${gig
      ? `${gig.venue?esc(gig.venue):'Your gig'}${gig.time?' · '+esc(gig.time):''}`
      : (EVENTS?'No gig on the calendar today':'Checking your calendar…')}</span></div>
    ${rows.map((r,i)=>`<button class="todo ${r[3]?'done':''} ${i===next?'next':''}" onclick="${r[4]}">
      <span class="ic">${CLAYICON[r[0]]}</span>
      <span class="m"><span class="t">${r[1]}</span><span class="s">${r[2]}</span></span>
      <span class="tick">${r[3]?'✓':'○'}</span></button>`).join('')}
  </div>`;
}
function showQr(){
  if(TEAM&&TEAM.slug){ qrBig('profile'); return; }
  toast('Fetching your code…');
  loadTeam(true).then(()=>{ if(TEAM&&TEAM.slug) qrBig('profile'); else toast('Could not load your page address'); });
}
/* Straight to the free-votes chips in Settings. */
function showPricing(){
  if(TAB!=='settings') setTab('settings');
  setTimeout(()=>{const el=document.getElementById('pricebox');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});},60);
}
async function saveNight(){
  const v=(($('#nightName')||{}).value||'').trim();
  if(!v){toast('Give the night a name');return;}
  await act('venue',{venue:v});
}
function render(){
  if(!D||!D.show)return;                 // data not in yet — never crash the page
  const pageY=window.scrollY;
  const oldQueue=$('.queue-window'),oldSetlist=$('.setlist-window');
  if(oldQueue)PANEL_SCROLL.queue=oldQueue.scrollTop;
  if(oldSetlist)PANEL_SCROLL.setlist=oldSetlist.scrollTop;
  const s=D.show, songs=D.songs;
  const now=songs.find(x=>x.now);
  /* `votable` comes from the server (stage.mjs, off votable() in _lib.mjs) — the
     same predicate admin.mjs playTop uses. Recomputing it here is how the button on
     stage came to name a song playTop would not start: a setlist narrows what the
     room can vote for, and the client had no idea. `!==false` so an older payload
     without the flag degrades to the old behaviour instead of emptying the queue. */
  const canVote=x=>x.active!==false&&x.votable!==false;
  const pool=songs.filter(x=>!x.now&&canVote(x)&&(!x.played||x.votes>0));
  // same narrowing playTop applies: a played song needs replay votes to re-enter
  const startPool=songs.filter(x=>!x.now&&canVote(x)&&(!x.played||x.votes>0));
  const top=startPool.find(x=>x.votes>0);
  const paidPill=x=>x&&x.paidVotes>0?`<span class="paidtag">(${x.paidVotes}) paid votes</span>`:'';

  let body='';
  if(TAB==='live'){
  if(s.status!=='live'){
    /* BEFORE A SHOW the Live tab is TODAY: the checklist for tonight's gig, then
       Start. AFTER a show has ended (and before it is filed) it is TONIGHT: the
       night's numbers, a name for it if the calendar gave it none, and the choice
       between a new show and resuming — the server cannot tell a deliberate end
       from a fat finger, so the choice must be explicit. */
    const ended=s.status==='ended'&&(s.played||[]).length;
    body=ended?`
    <div class="today"><div class="th"><b>Tonight</b><span>${s.venue?esc(s.venue)+(s.city?', '+esc(s.city):''):'Ended'}${s.endedBy==='schedule'?' · ended by itself, three hours after your gig’s scheduled end':s.endedBy==='inactivity'?' · saved by itself after three hours without activity':''}</span></div></div>
    <div class="stats">
      <div class="c"><b class="mono">${(s.played||[]).length}</b><span>Songs played</span></div>
      <div class="c"><b class="mono">${songs.reduce((a,b)=>a+(b.votes||0),0)}</b><span>Votes</span></div>
      <div class="c"><b class="mono acc">$${(((D.tips||{}).total)||0).toFixed(2)}</b><span>Tips</span></div>
    </div>
    ${s.venue?'':`<div class="field" style="padding-top:12px"><label>Name this night</label><div style="display:flex;gap:8px">
      <input class="inp" id="nightName" maxlength="80" placeholder="Where was it? e.g. The Corner Hotel" style="flex:1" onkeydown="if(event.key==='Enter')saveNight()">
      <button class="act pri" style="min-width:64px" onclick="saveNight()">Save</button></div></div>`}
    <div class="wrap" style="padding-top:18px;padding-bottom:2px">
      <button class="big bigplay" onclick="if(confirm('Start a fresh show? The previous show is saved and tonight starts with a clean vote board.'))act('newShow')">
        <span>●</span><span style="flex:1">Start a new show</span></button>
    </div>
    ${capNote(s)}
    <p class="muted" style="font-size:12px;padding:8px 20px 0">
      ${(s.played||[]).length} song${(s.played||[]).length===1?'':'s'} already played on this one.
      <a href="#" onclick="event.preventDefault();act('status',{status:'live'})"
         style="color:var(--accent);font-weight:700">Resume it instead</a>
      — use that if you ended it by mistake.</p>`
    :`${todayCard(s)}
    <div class="wrap" style="padding-top:18px;padding-bottom:2px">
      <button class="big bigplay" onclick="if(confirm('Start a fresh show? The previous show is saved and tonight starts with a clean vote board.'))act('newShow')">
        <span>●</span><span style="flex:1">Start the show</span></button>
    </div>
    ${capNote(s)}
    <p class="muted" style="font-size:12px;padding:6px 20px 0">Nothing says “live” to fans until you tap this — or until a gig on your calendar reaches its start time.</p>`;
  }

  if(s.status==='live'){
    body=`
    <div class="votebox">
      <div><span class="vt">Voting</span>
        <span class="vs">${s.windowOpen?'Fans can vote right now':'Paused — nobody can vote until you re-open'}</span></div>
      <div class="tog">
        <button class="${s.windowOpen?'on':''}" onclick="act('window',{open:true})">Open</button>
        <button class="${!s.windowOpen?'on':''}" onclick="act('window',{open:false})">Paused</button>
      </div>
    </div>
    ${s.status==='live'?`<div class="wrap" style="padding-top:10px;padding-bottom:0">
      <button class="lastcall" id="lastCall" onclick="lastCall()">
        <b>Last call</b><small>Ten seconds on every phone in the room</small></button>
    </div>`:''}
    <div class="stats">
      <div class="c"><b class="mono">${songs.reduce((a,b)=>a+b.votes,0)}</b><span>Votes now</span></div>
      <div class="c"><b class="mono">${D.voters||0} voting</b><span>${D.room||D.voters||0} in room${D.nets?` · ${D.nets} network${D.nets===1?'':'s'}`:''}</span></div>
      <div class="c"><b class="mono acc">$${D.tips.total.toFixed(2)}</b><span>Tips</span></div>
    </div>
    ${now?`<div class="np rise"><div class="k">Now playing</div><div class="t">${esc(now.title)}</div>
      ${now.artist?`<div class="a">${esc(now.artist)}</div>`:''}
      ${now.key?`<div class="a" style="opacity:.82">Key of ${esc(now.key)}</div>`:''}
      <div class="stage-song-actions"><button class="chartbtn" data-act="lyrics" data-id="${esc(now.id)}"><svg viewBox="0 0 24 24"><path d="M4 6h11M4 11h13M4 16h8"/><circle cx="18.5" cy="15" r="2.6"/><path d="M21.1 15V8.4l-3.6.9"/></svg>Lyrics</button>
      <button class="chartbtn" data-act="autochords" data-id="${esc(now.id)}">♬ Auto chords</button>
      <button class="chartbtn" data-act="chart" data-id="${esc(now.id)}">☰ My chart</button></div></div>`:''}
    ${asksPanel()}
    ${s.startedBy==='schedule'?`<p class="muted" style="font-size:12px;padding:6px 20px 0">Started by itself for the gig on your calendar. It ends by itself three hours after that gig’s end time, unless you end it first.</p>`:''}

    <div class="wrap liveactions" style="padding-top:14px;padding-bottom:10px">
      ${top?`<button class="big bigplay" onclick="act('playTop')">
        <span>▶</span><span style="flex:1;min-width:0">Start top voted — ${esc(top.title)} (${top.votes} votes total) ${paidPill(top)}</span></button>`:''}
      ${now?`<button class="big endnow" onclick="act('endSong')">■ End current song</button>`:''}
    </div>
    <div class="sec upnext"><span class="kick">Up next</span><span class="kick">Tap ▶ to start · ${pool.length}</span></div>
    <div class="scroll-shell queue-shell"><div class="list scroll-window queue-window">${pool.map((x,i)=>`<div class="row">
      <div class="rk ${i===0&&x.votes?'one':''} mono">${i+1}</div>
      <div class="m"><div class="t">${esc(x.title)}</div>${x.artist?`<div class="by">${esc(x.artist)}</div>`:''}
        <div class="songvotes"><span class="mono">${x.votes} votes total</span>${paidPill(x)}</div>
        ${x.votes?`<button class="refundlink" onclick="declineSong('${x.id}')">Decline + refund votes</button>`:''}</div>
      <button class="act" onclick="act('play',{song:'${x.id}'})">▶ Start</button></div>`).join('')||'<div class="row muted">Pool is empty.</div>'}</div></div>
    <div class="wrap" style="padding-top:14px;padding-bottom:2px">
      <button class="big alt orange-outline" onclick="openEndShow()" style="justify-content:center">■ End the show</button>
    </div>

    <div class="sec"><span class="kick">Played (${s.played.length})</span>${s.played.length?`<button class="kick" style="color:var(--accent)" onclick="clearBoardAsk()">Clear the board</button>`:''}</div>
    <div class="list">${songs.filter(x=>x.played).map(x=>`<div class="row done"><div class="rk">♪</div>
      <div class="m"><div class="t">${esc(x.title)}</div></div>
      <button class="act" onclick="act('unplay',{song:'${x.id}'})">Undo</button></div>`).join('')||'<div class="row muted">Nothing yet.</div>'}</div>
    ${D.tips.recent.length?`<div class="sec"><span class="kick">Recent tips</span></div>
      ${D.tips.recent.map(t=>`<div class="tip"><span>$${Number(t.amount).toFixed(2)}${t.note?' · '+esc(t.note):''}</span><span class="muted">${when(t.at)}</span></div>`).join('')}`:''}`;
  }
  }

  if(TAB==='setlist'){
    const active=songs.filter(x=>x.active!==false).length;
    const q=SETQ.trim().toLowerCase();
    const shown=applySetSort(songs
      .filter(x=>GENRE==='__hidden'?x.active===false:(!GENRE||(x.tags||[]).includes(GENRE)))
      .filter(x=>!q||x.title.toLowerCase().includes(q)||(x.artist||'').toLowerCase().includes(q)));
    body=`
    <div class="wrap" style="padding-top:18px">
      <div class="setlist-tools">
      ${/* Both spans are plain flex items, so the label centres as ONE thing beside
            its sibling. The second used to be flex:1, which parked "Add a song" at the
            left of a centred button (the founder, 2026-09-12). Two spans still, because
            test/copy.mjs finds ">Add a song</span>". */''}
      <button class="big" onclick="openSongSheet(null)">
        <span>+</span><span>Add a song</span></button>
      <button class="big alt" onclick="openImport()">⇪ Import songs</button>
      </div>
    </div>
    ${setPick()}

    ${songs.length?'':`<div class="sec"><span class="kick">No songs yet</span></div>
      <div class="list"><div class="row muted">Add a song above, or import a CSV, pasted list, or public Spotify playlist.</div></div>`}
    <div class="sec"><span class="kick">Your setlist — ${active} of ${songs.length} featured</span>${
      SETQ?`<span class="kick">${shown.length} match${shown.length===1?'':'es'}</span>`:''}</div>
    <div class="find">
      <svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 17 17"/></svg>
      <input id="setq" type="search" inputmode="search" placeholder="Search song or artist"
        value="${esc(SETQ)}" autocomplete="off">
      ${SETQ?`<button class="clr" onclick="setQuery('')" aria-label="Clear search">✕</button>`:''}
    </div>
    <div class="sortbar" role="group" aria-label="Sort songs">${SETSORTS.map(([k,l])=>
      `<button data-sort="${k}" class="${SETSORT===k?'on':''}" aria-pressed="${SETSORT===k}">${l}</button>`).join('')}</div>
    <div class="ghead"><span class="kick">Genres</span>
      <button onclick="confirmAutoTag()">✨ Auto-tag songs</button></div>
    ${genreBar(songs)}
    <div class="scroll-shell setlist-shell"><div class="list scroll-window setlist-window">${shown.length?shown.map(x=>`<div class="row songcard ${x.active===false?'off':''}">
      <div class="m"><div class="t">${esc(x.title)}</div>
        <div class="by">${esc(x.artist||'— no artist —')}</div>
        <div class="s">${x.now?'Playing now':x.played?'Played':x.active===false?'Hidden'
          :x.inSet===false?'Not in this set':'In the pool'}</div>
        ${(x.key||(x.tags||[]).length)?`<div class="songmeta">
          ${x.key?`<span class="k">${esc(x.key)}</span>`:''}
          ${(x.tags||[]).map(t=>`<span>${esc(tagLabel(t))}</span>`).join('')}</div>`:''}</div>
      <div class="songactions"><button class="act" data-act="edit" data-id="${x.id}">Edit</button>
      <button class="act" onclick="act('toggleSong',{song:'${x.id}'})">${x.active===false?'Show':'Hide'}</button>
      <button class="act warn" data-act="del" data-id="${x.id}" aria-label="Delete ${esc(x.title)}">✕</button></div>
    </div>`).join(''):`<div class="row muted">Nothing matches “${esc(SETQ)}”</div>`}</div></div>
    ${learnSection()}
    <div class="wrap" style="padding-top:18px;padding-bottom:0">
      <a class="big alt orange-outline" href="${s.slug?'/'+esc(s.slug)+'/vote':'/vote.html'}"
         style="justify-content:center">See what fans see ↗</a>
    </div>
    <div class="wrap" style="padding-top:18px;padding-bottom:8px">
      <button class="big alt" style="justify-content:center;margin:0;color:var(--accent)"
        onclick="if(confirm('Remove every song from your setlist? This cannot be undone.'))act('clearSetlist')">Clear setlist</button>
    </div>
    `;
  }

  if(TAB==='gigs'){
    if(!EVENTS) body=`<div class="sec"><span class="kick">Your gigs</span></div>
      <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`;
    else{
      const occ=EVENTS.occurrences||[];
      const byDate={}; occ.forEach(o=>{(byDate[o.date]||=[]).push(o);});
      const up=occ.filter(o=>o.date>=todayStr()).slice(0,30);
      body=`
      <div class="wrap" style="padding-top:20px;padding-bottom:6px">
        <button class="big bigplay" onclick="openGig()"><span>+</span><span style="flex:1">Add a gig</span></button>
      </div>
      <div class="calhead">
        <b>${monthName(CAL_MONTH)}</b>
        <div class="calnav">
          <button onclick="calMove(-1)" aria-label="Previous month">‹</button>
          <button onclick="calMove(1)" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="cal">
        ${['S','M','T','W','T','F','S'].map(d=>`<div class="dow">${d}</div>`).join('')}
        ${calCells(CAL_MONTH).map(c=>{
          const n=(byDate[c.date]||[]).length;
          return `<button class="cell ${c.out?'out':''} ${c.date===todayStr()?'today':''} ${n?'has':''}"
            data-act="calday" data-id="${c.date}">
            <span>${c.day}</span>
            <span class="dots">${Array.from({length:Math.min(n,3)}).map(()=>'<i></i>').join('')}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="sec"><span class="kick">Coming up</span><span class="kick">${up.length}</span></div>
      ${/* Laid out like the Setlist tab's song cards (the founder, 2026-09-12): the
            date and the words on one line, the three buttons on a full-width row
            beneath. Three buttons beside the words left the venue name a column of
            single words on a phone. */''}
      <div class="list">${(GIGSALL?up:up.slice(0,5)).map(o=>`<div class="row gigrow gigcard ${o.cancelled?'off':''}">
        <div class="gighead"><div class="when"><b>${dayNum(o.date)}</b><span>${monShort(o.date)}</span></div>
        <div class="m"><div class="t">${esc(o.venue)}</div>
          <div class="by">${esc(o.address||[o.city,o.country].filter(Boolean).join(', '))}</div>
          <div class="s">${dowName(o.date)} · ${o.time}${o.endTime?'–'+o.endTime:''}${o.repeating?' · repeats':''}${o.cancelled?' · cancelled':''}${
            o.listId?' · '+esc(setName(o.listId)):''}</div></div></div>
        <div class="songactions">${o.cancelled
          ? `<button class="act" data-act="gigskip" data-id="${o.eventId}|${o.date}">Restore</button>
             <button class="act warn wide" data-act="gighide" data-id="${o.eventId}|${o.date}">Hide</button>`
          : `<button class="act" onclick="openPromote('${esc(o.eventId)}','${esc(o.date)}')">Feature</button>
             <button class="act" data-act="gigedit" data-id="${o.eventId}">Edit</button>
             <button class="act warn" data-act="gigskip" data-id="${o.eventId}|${o.date}">✕</button>`}</div>
      </div>`).join('')||'<div class="row muted">Nothing booked yet. Tap “Add a gig” — a weekly residency only needs entering once.</div>'}
      ${up.length>5?`<button class="seemore" onclick="GIGSALL=!GIGSALL;render()">${
        GIGSALL?'Show fewer ▴':`See ${up.length-5} more ▾`}</button>`:''}</div>
      <p class="muted" style="font-size:12px;padding:14px 18px 0">These show on your page and in the city feed automatically. ✕ cancels one night; Edit changes the whole run.</p>
      ${featureCard()}
      ${pitchPanel()}
      ${promoteCard()}`;
    }
  }

  if(TAB==='money'){
    if(DETAIL&&DETAIL.loading){
      body=`<div class="sec"><span class="kick">Loading…</span></div>
        <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Opening that show</div></div>`;
    }
    else if(DETAIL){
      const H=DETAIL,M=H.money||{},V=M.votes||{},T=M.tips||{},St=H.stats||{};
      body=`
      <div class="wrap" style="padding-top:14px"><button class="act" onclick="closeShow()">← All shows</button></div>
      <div class="np rise" style="background:var(--surface-2);color:var(--ink);box-shadow:var(--sh-1)">
        <div class="k" style="color:var(--muted)">${dstamp(H.endedAt||H.startedAt)}</div>
        ${histName(H.showId,H.title||H.venue||'Untitled show')}
        <div class="a" style="color:var(--muted)">${esc(H.city||'')}${H.startedAt&&H.endedAt?' · '+dur(H.endedAt-H.startedAt):''}</div>
      </div>
      <div class="stats">
        <div class="c"><b class="mono">${St.songsPlayed||0}</b><span>Songs played</span></div>
        <div class="c"><b class="mono">${St.totalVotes||0}</b><span>Votes cast</span></div>
        <div class="c"><b class="mono">${St.peakVoters||0}</b><span>People voting</span></div>
      </div>
      <div class="stats" style="margin-top:11px">
        <div class="c"><b class="mono acc">$${(M.gross||0).toFixed(2)}</b><span>Taken</span></div>
        <div class="c"><b class="mono">$${(V.amount||0).toFixed(2)}</b><span>${V.count||0} vote pack${V.count===1?'':'s'}</span></div>
        <div class="c"><b class="mono">$${(T.amount||0).toFixed(2)}</b><span>${T.count||0} tip${T.count===1?'':'s'}</span></div>
      </div>
      ${M.source==='stripe-unreachable'?`<p class="muted" style="font-size:12px;padding:12px 18px 0">Couldn’t reach Stripe for this one — the money figures may be stale.</p>`:''}
      ${M.unattributed?`<p class="muted" style="font-size:12px;padding:12px 18px 0">$${M.unattributed.toFixed(2)} came in during this window but isn’t tagged to a show — it predates show tracking.</p>`:''}
      ${T.recent&&T.recent.length?`<div class="sec"><span class="kick">Tips</span></div>
        ${T.recent.map(t=>`<div class="tip"><span>$${Number(t.amount).toFixed(2)}${t.note?' · “'+esc(t.note)+'”':''}</span><span class="muted">${dstamp(t.at)}</span></div>`).join('')}`:''}
      <div class="sec"><span class="kick">What you played</span><span class="kick">${(H.played||[]).length}</span></div>
      <div class="list">${(H.played||[]).map((x,i)=>`<div class="row">
        <div class="rk mono">${i+1}</div>
        <div class="m"><div class="t">${esc(x.title)}</div>${x.artist?`<div class="by">${esc(x.artist)}</div>`:''}
          <div class="s">${dstamp(x.at)}${x.replay?' · replay':''}</div></div>
        <div class="cnt mono">${x.votes}</div></div>`).join('')||`<div class="row muted">${
          St.songsPlayed?`${St.songsPlayed} songs played, but the titles weren’t logged — the Studio wasn’t open that night.`
                        :'No songs were started from the Studio during this show.'}</div>`}</div>
      ${(H.requested||[]).length?`<div class="sec"><span class="kick">Wanted but never played</span></div>
      <div class="list">${H.requested.slice(0,15).map(x=>`<div class="row done">
        <div class="m"><div class="t">${esc(x.title)}</div>${x.artist?`<div class="by">${esc(x.artist)}</div>`:''}</div>
        <div class="cnt mono">${x.votes}</div></div>`).join('')}</div>`:''}
      <div class="wrap" style="margin-top:18px"><button class="big alt" data-act="recon" data-id="${esc(H.showId)}">↺ Re-check the money in Stripe</button></div>`;
    }
    else{
      const H=HIST,R=REV;
      let head='';
      if(!H) head=`<div class="sec"><span class="kick">Shows</span></div>
        <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`;
      else if(H.ok){
        const L=H.live||{};
        const done=L.status==='ended';
        head=`<div class="sec"><span class="kick">${done?'Last show — finished':'Tonight so far'}</span></div>
        <div class="stats">
          <div class="c"><b class="mono">${L.songsPlayed||0}</b><span>Songs played</span></div>
          <div class="c"><b class="mono">${L.totalVotes||0}</b><span>Votes</span></div>
          <div class="c"><b class="mono acc">$${(L.gross||0).toFixed(2)}</b><span>Taken</span></div>
        </div>
        ${L.unattributed?`<p class="muted" style="font-size:12px;padding:10px 18px 0">Plus $${L.unattributed.toFixed(2)} taken in this window that isn’t tagged to a show — it was paid before MySet started tagging payments. Everything from here on is tagged automatically.</p>`:''}
        <p class="muted" style="font-size:12px;padding:10px 18px 0">${done?'Filed away. Start the next one from the Live tab when the gig begins.':'Tonight gets filed away when you end the show or start a new one.'}</p>
        ${(()=>{  /* filter by anything a night is remembered by: its name, venue, city, date, weekday */
          const hw=HISTQ.toLowerCase().split(/\s+/).filter(Boolean);
          const hay=x=>{const d=new Date(x.endedAt||x.startedAt||0);
            return [x.title,x.venue,x.city,dstamp(x.endedAt||x.startedAt),
                    ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][d.getDay()]]
              .filter(Boolean).join(' ').toLowerCase();};
          HSHOWN=hw.length?H.shows.filter(x=>{const h=hay(x);return hw.every(w=>h.includes(w));}):H.shows;
          HROWS=(HISTQ||HISTALL)?HSHOWN:HSHOWN.slice(0,3);
          return '';})()}
        <div class="sec"><span class="kick">Past shows</span><span class="kick">${
          HISTQ?`${HSHOWN.length} of ${H.shows.length}`:H.shows.length}</span></div>
        ${H.shows.length>3?`<div class="find" style="margin-bottom:8px">
          <svg class="ic" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20.5 20.5 17 17"/></svg>
          <input id="histq" type="search" placeholder="Find a night — venue, city, “friday”, “12 Aug”…"
            value="${esc(HISTQ)}" autocomplete="off">
          ${HISTQ?`<button class="clr" onclick="HISTQ='';HISTFOCUS=false;render()" aria-label="Clear search">✕</button>`:''}
        </div>`:''}
        <div class="list">${HROWS.map(x=>`<div class="row" data-act="show" data-id="${x.showId}" style="cursor:pointer">
          <div class="m">${histName(x.showId,x.title||x.venue||'Untitled show')}
            <div class="by">${esc(x.city||'')}</div>
            <div class="s">${dstamp(x.endedAt||x.startedAt)} · ${x.songsPlayed} song${x.songsPlayed===1?'':'s'} · ${x.totalVotes} votes · ${x.peakVoters} people${
              x.unattributed?` · $${x.unattributed.toFixed(2)} untagged`:''}</div></div>
          <div class="cnt mono">$${(x.gross||0).toFixed(2)}</div>
          <button class="act" data-act="show" data-id="${x.showId}">Open</button></div>`).join('')
          ||(HISTQ?`<div class="row muted">Nothing matches “${esc(HISTQ)}”. A venue, a city, a weekday or a date all work.</div>`
                  :'<div class="row muted">No finished shows yet. End a show and it gets filed here.</div>')}</div>
        ${!HISTQ&&HSHOWN.length>3?`<button class="seemore" onclick="HISTALL=!HISTALL;render()">${HISTALL?'Show fewer ▴':`See ${HSHOWN.length-3} more ▾`}</button>`:''}
        ${HISTQ?'':`<div class="wrap" style="margin-top:12px">
          <button class="big alt" onclick="healHist()">Look for missing shows</button>
          <p class="muted" style="font-size:12px;margin:8px 0 0">A night is filed when you end the show. If one is missing this goes back through the records and puts it where it belongs.</p>
          <button class="big alt" style="margin-top:10px" onclick="placeHist()">Name these from my calendar</button>
          <p class="muted" style="font-size:12px;margin:8px 0 0">Older nights were all filed under the same venue. This renames each one from the gig that was on your calendar that night — nothing else about them changes.</p></div>`}`;
      }
      let pays='';
      if(!R) pays=`<div class="sec"><span class="kick">All payments</span></div>
        <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Reading Stripe…</div></div>`;
      else if(!R.ok) pays=`<div class="sec"><span class="kick">All payments</span></div>
        <div class="list"><div class="row muted">Couldn’t reach Stripe just now.</div></div>`;
      /* This used to print an environment-variable name at every artist, almost none
         of whom have any way to set one. The founder is the only person for whom that
         sentence is actionable. */
      else if(!R.enabled) pays=`<div class="sec"><span class="kick">All payments</span></div>
        <div class="list"><div class="row muted">${PLAN&&PLAN.owner
          ? 'Card payments are off for the whole platform — the Stripe key is not set in Netlify.'
          : 'Card payments aren’t on for your page yet. Set them up under “Getting paid” above.'}</div></div>`;
      else{
        const t=R.totals;
        pays=`
        ${R.unredeemed?`<div class="warnbox rise">
          <b>${R.unredeemed} payment${R.unredeemed===1?' was':'s were'} never delivered</b>
          <p>Someone paid and the app didn’t hand over what they bought. This gives it to them — safe to tap twice.</p>
          <button class="big" onclick="recover()">Deliver ${R.unredeemed===1?'it':'them'} now</button></div>`:''}
        <div class="sec"><span class="kick">All payments · last 180 days</span><span class="kick">$${t.all.toFixed(2)}</span></div>
        <div class="list">${R.payments.map(p=>`<div class="row">
          <div class="m">
            <div class="t">$${p.amount.toFixed(2)} · ${p.kind==='tip'?'Tip':esc(p.votes+' extra votes')}</div>
            <div class="by">${esc(p.email||'—')}${p.note?' · “'+esc(p.note)+'”':''}</div>
            <div class="s">${dstamp(p.at)}${p.redeemed?'':' · not delivered'}</div>
          </div>
          <span class="cnt" style="font-size:15px;color:${p.redeemed?'var(--good)':'var(--accent)'}">${p.redeemed?'✓':'!'}</span>
        </div>`).join('')||'<div class="row muted">No payments yet.</div>'}</div>
        <p class="muted" style="font-size:12px;padding:14px 18px 0">Read live from Stripe. Refunds are done in your Stripe dashboard.</p>`;
      }
      // Get-paid card, tonight, bug reports, then the Rock Star numbers preview
      body=payCard()+head+bugCard()+pays+ordersSection()+earningsCard()+booksCard()+analyticsCard();
    }
  }

  if(TAB==='profile'){
    const P=PROF;
    if(!P||!P.ok) body=`<div class="sec"><span class="kick">Your page</span></div>
      <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`;
    else{
      const L=P.links||{};
      body=`
      <div class="wrap" style="padding-top:14px"><a class="big alt orange-outline" href="/artist.html" style="justify-content:center">View your page ↗</a></div>

      <div class="sec"><span class="kick">Who you are</span></div>
      <div class="field"><label>Name</label><input class="inp" id="pfName" maxlength="60" value="${esc(P.name||'')}"></div>
      <div class="field"><label>One line under your name <span class="cnt" id="cTag"></span></label>
        <input class="inp" id="pfTag" maxlength="120" value="${esc(P.tagline||'')}" placeholder="Make my set your set"></div>
      <div class="field"><label>Style</label>
        <input class="inp" id="pfStyle" maxlength="60" value="${esc(P.style||'')}" placeholder="Acoustic soul, indie rock, jazz…">
        <p class="muted" style="font-size:12px;margin:7px 0 0">Used on your Find artists card and filters, not on your public profile.</p></div>
      <div class="field"><label>Label / management company</label>
        <input class="inp" id="pfManagement" maxlength="120" value="${esc(P.management||'')}" placeholder="Independent, label or management company"></div>
      <div class="field"><label>Label / management website</label>
        <input class="inp" id="pfManagementUrl" type="url" maxlength="500" value="${esc(P.managementUrl||'')}" placeholder="https://…"></div>
      <div class="field"><label>Bio <span class="cnt" id="cBio"></span></label>
        <textarea class="inp" id="pfBio" rows="6" maxlength="700" placeholder="A few lines about you and your music.">${esc(P.bio||'')}</textarea></div>
      <div class="field"><label>Cover photo</label>
        ${slotBox('cover',P.photo,'wide')}</div>
      <div class="field"><label>Portrait</label>
        ${slotBox('avatar',P.avatar&&P.avatar!==P.photo?P.avatar:'','sq')}
        <p class="muted" style="font-size:12px;margin:7px 0 0">Left blank, your cover is used.</p></div>
      <div class="field"><label>Three small photos around it</label>
        <div class="slots">${[0,1,2].map(i=>slotBox('p'+i,(P.photos||[])[i],'sq')).join('')}</div>
        <p class="muted" style="font-size:12px;margin:7px 0 0">Straight from your camera roll. They’re shrunk on your phone before they upload.</p></div>

      <div class="sec"><span class="kick">Listen &amp; follow</span></div>
      <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 4px">Paste the share link for each. Anything that isn’t a real link from that service is dropped rather than shown broken.</p>
      <!-- same order the public page shows them in, so what an artist fills in top
           to bottom is what a fan reads left to right -->
      <div class="field"><label>Instagram</label><input class="inp" id="lkIg" value="${esc(L.instagram||'')}" placeholder="https://instagram.com/…"></div>
      <div class="field"><label>Spotify</label><input class="inp" id="lkSpotify" value="${esc(L.spotify||'')}" placeholder="https://open.spotify.com/artist/…"></div>
      <div class="field"><label>Apple Music</label><input class="inp" id="lkApple" value="${esc(L.applemusic||'')}" placeholder="https://music.apple.com/…"></div>
      <div class="field"><label>YouTube Music</label><input class="inp" id="lkYtm" value="${esc(L.ytmusic||'')}" placeholder="https://music.youtube.com/…"></div>
      <div class="field"><label>Website</label><input class="inp" id="lkWeb" value="${esc(L.website||'')}" placeholder="https://…"></div>

      <div class="sec"><span class="kick">Videos &amp; music</span><span class="kick">${P.media.length}/24</span></div>
      <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Paste a YouTube, Spotify or Apple Music link. I check it exists before it goes on your page.</p>
      <div class="wrap"><div style="display:flex;gap:8px">
        <input class="inp" id="mdUrl" style="flex:1" placeholder="Paste a link" autocomplete="off">
        <button class="act pri" id="mdAdd" style="min-width:64px" onclick="addMedia()">Add</button>
      </div></div>
      <div class="list" style="margin-top:14px">${P.media.map((m,i)=>`<div class="row">
        <div class="m"><div class="t">${esc(m.title||m.provider)}</div>
          <div class="by">${esc({youtube:'YouTube',spotify:'Spotify',applemusic:'Apple Music'}[m.provider]||m.provider)}</div></div>
        <button class="act" data-act="mup" data-id="${esc(m.mid)}" ${i===0?'disabled style="opacity:.3"':''}>↑</button>
        <button class="act" data-act="mdn" data-id="${esc(m.mid)}" ${i===P.media.length-1?'disabled style="opacity:.3"':''}>↓</button>
        <button class="act warn" data-act="mrm" data-id="${esc(m.mid)}">✕</button>
      </div>`).join('')||'<div class="row muted">Nothing yet. Paste a link above.</div>'}</div>
      ${merchSection()}
      <div class="wrap" style="margin-top:14px"><button class="big" onclick="saveProfile()">Save profile</button></div>
      ${fbCard()}
      ${commSection()}
      ${presskitCard()}
      ${brandingCard()}`;
    }
  }

  if(TAB==='settings'){
    body=`
    ${tickCard()}
    ${idQueueCard()}
    ${flagCard()}
    ${sheetCard()}
    <div class="sec"><span class="kick">Alerts on your phone</span></div>
    <div id="pushBox">${PUSHVIEW||`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Checking…</div></div>`}</div>

    <div class="sec" id="pricebox"><span class="kick">Free votes per person</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">How many free votes each person gets for the night.</p>
    ${/* THE UNLIMITED SWITCH IS NOT GATED, so it must not be greyed.
          `canPrice` in admin.mjs covers freeCredits, packs, replayCost and askSet —
          `unlimited` has no gate at all, deliberately: "everyone votes as much as
          they like" is running your show, not pricing it. Wrapping the whole block
          in one lock quietly took a working control off every free artist. */''}
    ${lock('pricing',`<div class="wrap"><div class="chips">
      ${[1,2,3,5,10].map(n=>`<button class="chip ${!s.unlimited&&s.freeCredits===n?'on':''}" onclick="act('freeCredits',{n:${n}})">${n}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:11px">
      <input class="inp" id="fcCustom" type="number" inputmode="numeric" min="0" max="999" style="flex:1"
        placeholder="Any other number" value="${!s.unlimited&&![1,2,3,5,10].includes(s.freeCredits)?s.freeCredits:''}">
      <button class="act pri" style="min-width:64px" onclick="saveFreeCredits()">Set</button>
    </div></div>`,'Everyone gets '+s.freeCredits+' free votes for the night until then.')}
    <div class="wrap" style="margin-top:12px"><div class="chips">
      <button class="chip ${s.unlimited?'on':''}" onclick="act('unlimited',{on:${!s.unlimited}})">∞ Unlimited votes for everyone</button>
    </div>
    ${s.unlimited?`<p class="muted" style="font-size:12px;margin:9px 0 0">Everyone in the room can vote as much as they like. Nobody can buy votes while this is on.</p>`:`<p class="muted" style="font-size:12px;margin:9px 0 0">Free on every plan — it is your show, not a price.</p>`}
    </div>

    <div class="sec"><span class="kick">Cost to replay a played song</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Songs you've already played stay votable, but cost this many votes to bring back.</p>
    ${lock('pricing',`<div class="wrap"><div class="chips">
      ${[2,3,5,8,10].map(n=>`<button class="chip ${(s.replayCost||5)===n?'on':''}" onclick="act('replayCost',{n:${n}})">${n}</button>`).join('')}
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-top:11px">
      <input class="inp" id="rcCustom" type="number" inputmode="numeric" min="1" max="99" style="flex:1"
        placeholder="Any other number" value="${![2,3,5,8,10].includes(s.replayCost||5)?(s.replayCost||''):''}">
      <button class="act pri" style="min-width:64px" onclick="saveReplayCost()">Set</button>
    </div></div>`,'A replay costs '+(s.replayCost||5)+' votes until then.')}

    <div class="sec"><span class="kick">Price of extra votes</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 4px">What fans pay for more votes. All three show in their app. Changes apply to the next purchase.</p>
    ${lock('pricing',`${[['small','Small','pS'],['big','Big','pB']].map(([k,label,pre])=>
      `<div class="field"><label>${label} pack</label><div style="display:flex;gap:8px;align-items:center">
        <input class="inp" id="${pre}v" type="number" min="1" max="100" value="${s.packs[k].votes}" style="flex:1">
        <span class="muted" style="font-size:13px">votes for $</span>
        <input class="inp" id="${pre}c" type="number" min="1" max="500" step="0.5" value="${(s.packs[k].cents/100)}" style="flex:1"></div></div>`).join('')}
    <div class="wrap" style="margin-top:12px"><button class="big alt" onclick="savePacks()">Save prices</button></div>`,
      'The standard prices stay on, and the money is still yours.')}

    <div class="sec"><span class="kick">Requests from fans</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Let the room ask for something that isn't on your list. They pay in votes, not money, and you decide — turning one down refunds them automatically. Both are off until you switch them on.</p>
    ${[['song','Request a song','A title you haven’t got listed',s.requests],
       ['birthday','Happy birthday shout-out','With the name of whoever it’s for',s.birthdays]].map(([k,t,d,cfg])=>`
      <div class="row"><div class="m"><div class="t">${t}</div><div class="s">${d}</div></div>
        <div class="tog"><button class="${cfg.on?'on':''}" onclick="act('askSet',{kind:'${k}',on:true})">On</button>
        <button class="${!cfg.on?'on':''}" onclick="act('askSet',{kind:'${k}',on:false})">Off</button></div></div>
      ${cfg.on?`<div class="wrap" style="padding-top:10px;padding-bottom:4px">
      ${/* Switching requests ON is free — that is running your show. What one COSTS
            is pricing, so only the cost is greyed. The server draws the line in the
            same place (see askSet in admin.mjs), which is why this can. */''}
      ${lock('pricing',`<div class="chips">
        ${[1,2,3,5,10].map(n=>`<button class="chip ${cfg.cost===n?'on':''}" onclick="act('askSet',{kind:'${k}',cost:${n}})">${n}</button>`).join('')}
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:11px">
        <input class="inp" id="ac${k}" type="number" inputmode="numeric" min="1" max="99" style="flex:1"
          placeholder="Any other number of votes" value="${![1,2,3,5,10].includes(cfg.cost)?cfg.cost:''}">
        <button class="act pri" style="min-width:64px" onclick="saveAskCost('${k}')">Set</button>
      </div>`,'Asking still works — it just costs the standard '+cfg.cost+' votes.')}
      <p class="muted" style="font-size:12px;margin:8px 0 0">Costs <b>${cfg.cost} vote${cfg.cost===1?'':'s'}</b>.</p></div>`:''}`).join('')}

    <div class="sec"><span class="kick">Starting by itself</span></div>
    <div class="row"><div class="m"><div class="t">Start shows from my calendar</div>
      <div class="s">${s.autoStart!==false?'A gig on your calendar starts its show at its start time if you haven’t.':'Off — only you start a show. Ending by itself still applies.'}</div></div>
      <div class="tog"><button class="${s.autoStart!==false?'on':''}" onclick="act('autoStart',{on:true})">On</button>
      <button class="${s.autoStart===false?'on':''}" onclick="act('autoStart',{on:false})">Off</button></div></div>

    <div class="sec"><span class="kick">Payments</span></div>
    <div class="row"><div class="m"><div class="t">Card payments ${D.paymentsEnabled?'ON':'OFF'}</div>
      <div class="s">${D.paymentsEnabled?'Tips + extra votes are live via Stripe':'Set STRIPE_SECRET_KEY in Netlify to switch on'}</div></div>
      <span class="cnt" style="color:${D.paymentsEnabled?'var(--good)':'var(--muted)'}">${D.paymentsEnabled?'✓':'—'}</span></div>

    <div class="sec"><span class="kick">This device</span></div>
    <div class="row"><div class="m"><div class="t">Unlimited votes for me</div>
      <div class="s">${(s.unlimitedFans||[]).includes(myFanId())?'This phone votes without limit':'Just for testing — nobody else gets this'}</div></div>
      <div class="tog"><button class="${(s.unlimitedFans||[]).includes(myFanId())?'on':''}" onclick="act('unlimitedFan',{fan:myFanId(),on:true})">On</button>
      <button class="${!(s.unlimitedFans||[]).includes(myFanId())?'on':''}" onclick="act('unlimitedFan',{fan:myFanId(),on:false})">Off</button></div></div>

    <div class="sec"><span class="kick">Lyrics</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Fetch the words for your whole setlist once, before a gig. They’re stored on your own server after that, so a room full of people tapping “Lyrics” never hits the internet. Takes about half a minute.</p>
    <div class="wrap"><button class="big alt" id="lyrWarm" onclick="warmLyrics()">↓ Fetch lyrics for the whole setlist</button></div>

    <div class="sec"><span class="kick">Your plan</span></div>
    <details class="why"><summary>Why there's a limit at all — a message from the
      founder, Perry Idyll</summary>
      <div class="whybody">
      <p>Hi! I'm a working musician — I play 6–7 nights a week and created MySet as a
      way to interact more with my audiences.</p>
      <p>I would really love to be able to make it free for everyone… But it's just
      not feasible and I want to take a moment to explain why:</p>
      <p>While you're on stage, every single phone in the room connected to the app is
      essentially asking my server “has the song changed yet?” constantly for the
      entire show.</p>
      <p>So a packed 3-hour show produces tens of thousands of those little questions,
      each of which costs credits ($$) on my server… and they add up fast — very
      fast.</p>
      <p>That's why the shows are limited to 4/month on the free plan, which basically
      means a hobbyist gets to play for free — forever — while the musicians earning
      money from it cover the costs, as well as their own.</p>
      <p>Of course, I am also an entrepreneur and want to earn a living like everyone
      else! So creating a basic business model out of it is certainly something I want
      as well. But without some kind of monetization structure the app literally
      couldn't run at all…</p>
      <p>I hope this makes sense and you understand where I'm coming from. I'm
      incredibly grateful that you've joined this community of artists and venues
      helping to reshape the entire live music experience.</p>
      </div></details>
    ${PLAN&&PLAN.ok?`
      ${/* One button, the same soft green as the tag at the top right, and the date
            under it rather than a mini-table above it. The line below the button is
            never empty: a comped or free account has no Stripe customer and so no
            portal, and an account section that silently disappears is exactly the
            thing Perry could not find. */''}
      <div class="planbox" id="planbox">
        <button class="bigup" onclick="openPlans()">${PLAN.plan==='pro'?'Rock Star membership':'Upgrade your plan'} <span>↗</span></button>
        <p class="planwhen">${planWhen()}</p>
      </div>
      <div class="field"><label>Got a code?</label><div style="display:flex;gap:8px">
        <input class="inp" id="promoIn" maxlength="24" placeholder="FRIENDS100" autocapitalize="characters" style="flex:1">
        <button class="act pri" style="min-width:64px" onclick="redeemPromo()">Apply</button></div></div>
      ${PLAN.owner?`
        <div class="sec"><span class="kick">Codes you hand out</span></div>
        <div class="list">${(PROMOS&&PROMOS.codes||[]).map(c=>`<div class="row ${c.revoked?'off':''}">
          <div class="m"><div class="t mono">${esc(c.code)}</div>
            <div class="s">${c.pct}% off ${esc(c.plan)} · ${c.months} months · used ${c.used}${c.maxUses?' of '+c.maxUses:''}</div></div>
          <button class="act ${c.revoked?'':'warn'}" data-act="promotoggle" data-id="${esc(c.code)}">${c.revoked?'On':'Off'}</button>
        </div>`).join('')||'<div class="row muted">None yet.</div>'}</div>
        <div class="field"><label>Make a code</label>
          <input class="inp" id="pcCode" maxlength="24" placeholder="CODE" autocapitalize="characters">
          <div style="display:flex;gap:8px;margin-top:8px">
            <select class="inp" id="pcPct" style="flex:1"><option value="100">100% off</option><option value="50">50% off</option></select>
            <select class="inp" id="pcPlan" style="flex:1"><option value="pro">Rock Star</option><option value="plus">Bar Star</option></select>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <input class="inp" id="pcMonths" type="number" min="1" max="60" value="12" style="flex:1" placeholder="months">
            <input class="inp" id="pcMax" type="number" min="0" max="9999" value="0" style="flex:1" placeholder="max uses (0 = ∞)">
          </div>
          <button class="big alt" style="margin-top:12px" onclick="createPromo()">Create code</button></div>

        <div class="sec"><span class="kick">Venues</span></div>
        <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Anyone can claim a venue page, and it stays an <b>unverified listing</b> until someone says otherwise. A venue with an email at its own website verifies itself instantly; the rest are your call.</p>
        <div class="list">${(VENUES&&VENUES.venues||[]).map(v=>`<div class="row ${v.verified?'':'off'}">
          <div class="m"><div class="t">${esc(v.name)}${v.verified?' ✓':''}</div>
            <div class="s">myset.vip/v/${esc(v.slug)}${v.city?' · '+esc([v.city,v.country].filter(Boolean).join(', ')):''}${v.via?' · verified by '+esc(v.via):''}</div></div>
          <a class="act" href="/v/${esc(v.slug)}">Look</a>
          <button class="act ${v.verified?'warn':'pri'}" data-act="vverify" data-id="${esc(v.venueId)}">${v.verified?'Un-verify':'Verify'}</button>
        </div>`).join('')||'<div class="row muted">No venues have signed up yet.</div>'}</div>`:''}`
      :`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`}

    <div class="sec"><span class="kick">What venues can see</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">A venue you play at can see how many people were in <b>their own room</b> and how many votes got cast — by night and by act. It’s the main reason a bar puts its page on MySet, and it’s how they work out who fills the place. <b>Your money is never included</b>, not even as a total.</p>
    <div class="row"><div class="m"><div class="t">Show venues my numbers</div>
      <div class="s">${PLAN&&PLAN.ok&&PLAN.shareStats===false?'Off — venues see nothing from your shows':'People and votes for shows at their venue'}</div></div>
      <div class="tog">
        <button class="${!PLAN||PLAN.shareStats!==false?'on':''}" onclick="setShare(true)">On</button>
        <button class="${PLAN&&PLAN.shareStats===false?'on':''}" onclick="setShare(false)">Off</button></div></div>

    <div class="sec"><span class="kick">Your public page</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">This is the link you give people. Change it any time — the old one keeps working too, so QR codes already printed still land here.</p>
    <div class="field"><label>myset.vip/</label><div style="display:flex;gap:8px">
      <input class="inp" id="slugIn" maxlength="32" placeholder="yourname" style="flex:1"
        value="${esc((TEAM&&TEAM.slug)||'')}">
      <button class="act pri" style="min-width:64px" onclick="saveSlug()">Save</button></div></div>
    ${TEAM&&TEAM.slug?`<div class="wrap" style="margin-top:10px">
      <a class="big alt" href="/${esc(TEAM.slug)}" style="justify-content:center">Open myset.vip/${esc(TEAM.slug)} ↗</a></div>`:''}

    <div class="sec"><span class="kick">Codes to print</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 10px">Stick these on tables, on the tip jar, or on your case. Tap one to bring it up full size, then screenshot or print it.</p>
    ${(TEAM&&TEAM.slug)?`<div class="qrs">
      ${QRS.map(([k,t,d])=>`
        <button class="qrcard" data-act="qrbig" data-id="${k}">
          <img src="${qrSrc(k,6)}" alt="${esc(t)} QR code" loading="lazy">
          <b>${esc(t)}</b><span>${esc(d)}</span>
        </button>`).join('')}
    </div>`:`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading your codes…</div></div>`}

    <div class="sec"><span class="kick">Invite another musician</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Share this and they land on a signup that knows you sent them.${TEAM&&TEAM.invited?` <b>${TEAM.invited} so far.</b>`:''}</p>
    <div class="field"><div style="display:flex;gap:8px">
      <input class="inp" id="refLink" readonly value="myset.vip/signup?ref=${esc((TEAM&&TEAM.slug)||'')}" style="flex:1">
      <button class="act pri" style="min-width:64px" onclick="copyRef()">Copy</button></div></div>
    ${TEAM&&TEAM.invitedNames&&TEAM.invitedNames.length?`<div class="list">${TEAM.invitedNames.map(n=>`<div class="row"><div class="m"><div class="t">${esc(n)}</div></div></div>`).join('')}</div>`:''}

    <div class="sec"><span class="kick">Who can sign in</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Emails that can sign in with a code instead of the studio code. Add your own so you never have to remember anything.</p>
    ${TEAM&&TEAM.ok?`<div class="list">${TEAM.emails.map(e=>`<div class="row">
        <div class="m"><div class="t">${esc(e.email)}</div>${e.name?`<div class="by">${esc(e.name)}</div>`:''}</div>
        <button class="act warn" data-act="rmmail" data-id="${esc(e.email)}">✕</button></div>`).join('')
      ||'<div class="row muted">Nobody yet — add your email below.</div>'}</div>
      ${TEAM.emailReady?'':`<p class="muted" style="font-size:12px;padding:10px 18px 0">Email sending isn’t ready yet. Verify a sending domain in Resend, then set <b>AUTH_FROM</b> and <b>RESEND_API_KEY</b> in Netlify.</p>`}`
      :`<div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Loading…</div></div>`}
    ${/* SEATS: 1 on free AND Plus, 5 on Pro. The first seat is free on every plan,
          so this greys only once the cap is reached — locking the whole control
          would take away something free artists have. Before this, the button
          looked live and the server answered 402. */''}
    ${(TEAM&&TEAM.ok&&PLAN&&PLAN.ok&&PLAN.limits&&!PLAN.owner
       && (TEAM.emails||[]).length>=(PLAN.limits.seats||1))
      ? lock('seats',`<div class="field"><label>Add an email</label><div style="display:flex;gap:8px">
          <input class="inp" type="email" placeholder="you@email.com" style="flex:1" disabled>
          <button class="act pri" style="min-width:64px">Add</button></div></div>`,
          'Your plan has '+PLAN.limits.seats+' sign-in'+(PLAN.limits.seats===1?'':'s')+'. Rock Star has '+(((PLAN.plans||{}).pro||{}).seats||5)+'.')
      : `<div class="field"><label>Add an email</label><div style="display:flex;gap:8px">
          <input class="inp" id="teamEmail" type="email" inputmode="email" placeholder="you@email.com" style="flex:1">
          <button class="act pri" style="min-width:64px" onclick="addTeam()">Add</button></div></div>`}

    ${/* SIGNING IN. Perry asked: "do we have a forgot password? button and process
          in place? what about for change my password?" MySet has no password, so the
          honest thing is to say that here rather than leave somebody hunting for a
          control that does not exist. Three rows, always visible even when they are
          not set up \u2014 his own show-locked-features rule. */''}
    <div class="sec"><span class="kick">Signing in</span></div>
    <div class="list">
      <div class="row"><div class="m"><div class="t">Password</div>
        <div class="s">You don\u2019t have one. MySet emails you a fresh six-digit code every time \u2014 nothing to remember, nothing to leak.</div></div></div>
      ${PKSUPPORTED?`<div class="row"><div class="m"><div class="t">Face ID or fingerprint${PKEYS?(PKEYS.length?' \u00b7 '+PKEYS.length+' device'+(PKEYS.length===1?'':'s'):' \u00b7 not set up'):''}</div>
        <div class="s">Sign in with a look instead of a code from your email. The key stays on the phone; MySet only keeps the half that can check it. Your code still works if you lose the phone.</div></div>
        <button class="act" onclick="addPasskey()">${PKEYS&&PKEYS.length?'Add another':'Set it up'}</button></div>
      ${(PKEYS||[]).map(k=>`<div class="row"><div class="m"><div class="t">${esc(k.label)}</div>
        <div class="s">Added ${daystamp(k.at)}${k.lastAt?' \u00b7 last used '+daystamp(k.lastAt):' \u00b7 not used yet'}</div></div>
        <button class="act" onclick="dropPasskey('${esc(k.id)}')">Remove</button></div>`).join('')}`:''}
      <div class="row"><div class="m"><div class="t">Studio code${TEAM&&TEAM.ok?(TEAM.codeSet?' \u00b7 on':' \u00b7 not set'):''}</div>
        <div class="s">A code for this page, so you can get in from any phone even when email is slow. At least 8 characters, and not your page name.</div></div>
        <button class="act" onclick="openCodeSheet()">${TEAM&&TEAM.codeSet?'Change':'Set one'}</button></div>
      <div class="row"><div class="m"><div class="t">Recovery codes${REC?(REC.made?' \u00b7 '+REC.left+' of '+REC.of+' unused':' \u00b7 not set up yet'):''}</div>
        <div class="s">Eight one-time codes for the day you can\u2019t get into your email. Keep them somewhere that isn\u2019t your phone.</div></div>
        <button class="act" onclick="makeRecovery()">${REC&&REC.made?'New codes':'Make codes'}</button></div>
    </div>

    ${/* IF SOMETHING LOOKS WRONG.
          Installed to a home screen there is no address bar and no reload button,
          so pulling down is the only refresh — and a pull is JavaScript, which
          cannot rescue a page whose JavaScript is broken. These two can, and the
          second one is the escape hatch sw.js has always had a handler for and
          never had a button for. Nothing here touches a single piece of the
          artist's data: not the setlist, not the votes, not the money. */''}
    <div class="sec"><span class="kick">Your account</span></div>
    <div class="list">
      <div class="row"><div class="m"><div class="t">${esc((PLAN&&PLAN.email)||'Signed in with the Studio code')}</div><div class="s">${PLAN&&PLAN.email?'Sign-in address':'No email on this sign-in'}${TEAM&&TEAM.emails?` · ${TEAM.emails.length} sign-in${TEAM.emails.length===1?'':'s'} on this page`:''}</div></div>
        ${PLAN&&PLAN.email?`<button class="act" onclick="openEmailChange()">Change</button>`:''}</div>
      <div class="row"><div class="m"><div class="t">Where you’re signed in</div>
        <div class="s">${SESS&&SESS.ok?(SESS.list.length+' device'+(SESS.list.length===1?'':'s')):'Every phone and laptop with a live sign-in.'}</div></div>
        <button class="act" onclick="openSessions()">See them</button></div>
      <div class="row"><div class="m"><div class="t">Download my data</div><div class="s">Everything MySet holds about you, as one file. Never a fan’s device.</div></div>
        <button class="act" onclick="exportAccount()">Download</button></div>
      ${PLAN&&PLAN.billing&&PLAN.billing.portal?`<div class="row"><div class="m"><div class="t">Invoices and receipts</div><div class="s">Every payment you’ve made to MySet.</div></div>
        <button class="act" onclick="openInvoices()">Open</button></div>`:''}
    </div>
    ${/* Perry asked for logout at the bottom, just above delete. There used to be two
          sign-out buttons scattered up the page, and neither of them told the
          server — so the token stayed valid for the rest of its month. */''}
    <div class="wrap" style="margin-top:14px">
      <button class="big alt" onclick="signOut()">Sign out of this device</button>
      <p class="muted" style="font-size:12.5px;margin:10px 0 0;text-align:center">
        <a href="#" onclick="event.preventDefault();signOutEverywhere()" style="color:var(--accent);font-weight:600">Sign out everywhere, including this one</a></p>
      <p class="muted" id="bootStat" style="font-size:12px;margin:10px 0 0;text-align:center;opacity:.7">${bootStat()}</p>
    </div>
    <div class="list" style="margin-top:14px">
      <div class="row"><div class="m"><div class="t">Delete my account</div><div class="s">Your page goes offline today. We keep everything for 30 days, then it’s gone.</div></div>
        <button class="act warn" onclick="deleteAccount()">Delete</button></div>
    </div>

    <div class="sec"><span class="kick">If something looks wrong</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Pull down anywhere to refresh. If that isn't enough, these are the bigger hammers — neither one touches your songs, your votes or your money.</p>
    <div class="wrap">
      <button class="big alt" onclick="location.reload()">↻ Reload the Studio</button>
      <div style="margin-top:10px"><button class="big alt" onclick="hardReset()">Clear what's stored on this phone</button></div>
      <p class="muted" style="font-size:12px;margin:10px 0 0">The second one throws away the offline copy and starts the app fresh. You stay signed in.</p>
    </div>`;
  }


  document.getElementById('app').innerHTML=`
  <div class="head">
    <a class="homemark" href="/" aria-label="MySet home">
      <i><svg viewBox="0 0 24 24"><rect x="4" y="9" width="3.4" height="11" rx="1.7"/><rect x="10.3" y="4" width="3.4" height="16" rx="1.7"/><rect x="16.6" y="12" width="3.4" height="8" rx="1.7"/></svg></i>
    </a>
    <div style="flex:1;min-width:0">
      <div class="kick">${s.status==='live'?'● On stage':'Artist Studio'}</div>
      ${s.slug
        ? `<a class="whoami" href="/${esc(s.slug)}"><h1>${esc(s.artist)}</h1><span>↗</span></a>`
        : `<h1>${esc(s.artist)}</h1>`}
    </div>
    <div class="headactions"><button class="themebtn" type="button" data-theme-toggle aria-label="Switch theme">☀︎</button>
    ${PLAN&&PLAN.ok?(PLAN.plan==='free'
      ?`<button class="upg" onclick="openPlans()">Upgrade <span>↗</span></button>`
      :`<button class="plantag" onclick="openPlans()">${esc(PLAN.limits.label)} <span>↗</span></button>`):''}</div>
  </div>
  ${leavingBar()}${cardTrouble(s)}${body}
  ${TAB==='setlist'?'':`<div class="wrap" style="padding-top:26px;padding-bottom:8px">
    ${/* WHAT "what fans see" MEANS DEPENDS ON THE TAB. On Live it is the voting
         screen — the thing the room is holding right now. Everywhere else (and
         Perry asked about Settings) it is the public PAGE: the profile a stranger
         lands on from a QR code or a city listing, which is what you actually want
         to check after editing your bio, your merch or your gigs. Two labels,
         because one button that goes to two different places without saying so is
         worse than two honest ones. */''}
    ${TAB==='live'
      ? `<a class="big alt orange-outline" href="${s.slug?'/'+esc(s.slug)+'/vote':'/vote.html'}"
           style="justify-content:center">See what fans see ↗</a>`
      : `<a class="big alt ${TAB==='profile'?'orange-outline':''}" href="${s.slug?'/'+esc(s.slug):'/artist.html'}"
           style="justify-content:center">See your page ↗</a>`}
  </div>`}
  ${tabBar()}`;

  document.querySelectorAll('[data-sort]').forEach(b=>
    b.addEventListener('click',()=>setSort(b.getAttribute('data-sort'))));
  const sq=$('#setq');
  if(sq){ sq.addEventListener('input',e=>{SETFOCUS=true;SETQ=e.target.value;render();});
    if(SETFOCUS){ sq.focus(); const v=sq.value; sq.setSelectionRange(v.length,v.length); } }
  const hq=$('#histq');
  if(hq){ hq.addEventListener('input',e=>{HISTFOCUS=true;HISTQ=e.target.value;render();});
    if(HISTFOCUS){ hq.focus(); const v=hq.value; hq.setSelectionRange(v.length,v.length); } }
  wireCount('#pfTag','#cTag',120); wireCount('#pfBio','#cBio',700);
  drawFirstRun();
  const restoreScroll=()=>{
    const q=$('.queue-window'),l=$('.setlist-window');
    if(q)q.scrollTop=PANEL_SCROLL.queue;if(l)l.scrollTop=PANEL_SCROLL.setlist;
    if(Math.abs(window.scrollY-pageY)>1)window.scrollTo(0,pageY);
  };
  const qNow=$('.queue-window'),lNow=$('.setlist-window');
  if(qNow)qNow.addEventListener('scroll',()=>{PANEL_SCROLL.queue=qNow.scrollTop},{passive:true});
  if(lNow)lNow.addEventListener('scroll',()=>{PANEL_SCROLL.setlist=lNow.scrollTop},{passive:true});
  restoreScroll();requestAnimationFrame(()=>requestAnimationFrame(restoreScroll));
}
/* THE BOTTOM TAB BAR. Five tabs; Profile and Settings live under Menu, but their
   TAB values are unchanged so ?tab=, the saved tab and the merch→profile alias all
   still work. The Live tab is red (test/copy.mjs pins the selector). */
const TABICON={
  live:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4M3.5 3.5a12 12 0 0 0 0 17M20.5 3.5a12 12 0 0 1 0 17"/></svg>',
  setlist:'<svg viewBox="0 0 24 24"><path d="M4 6h11M4 12h11M4 18h7"/><circle cx="18" cy="16.5" r="2.6"/><path d="M20.6 16.5V8.2l-3.4 1"/></svg>',
  gigs:'<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  money:'<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12.5" rx="3"/><path d="M3 10.5h18M7 15h3"/></svg>',
  menu:'<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'};
function tabBar(){
  const on=t=>t==='menu'?(TAB==='profile'||TAB==='settings'):TAB===t;
  return `<nav class="tabbar" aria-label="Studio"><div class="in">
    <button data-tab-live class="${TAB==='live'?'on':''}" onclick="setTab('live')" aria-current="${TAB==='live'?'page':'false'}">${TABICON.live}Live</button>
    ${[['setlist','Setlist'],['gigs','Gigs'],['money','Money'],['menu','Menu']].map(([t,l])=>
      `<button class="${on(t)?'on':''}" onclick="${t==='menu'?'openMenu()':`setTab('${t}')`}" aria-current="${on(t)?'page':'false'}">${TABICON[t]}${l}</button>`).join('')}
  </div></nav>`;
}
function openMenu(){
  const s=(D&&D.show)||{};
  const planLine=PLAN&&PLAN.ok?(PLAN.plan==='free'?'Hobbyist plan · see the plans':esc((PLAN.limits&&PLAN.limits.label)||PLAN.plan)+' · manage'):'Plans';
  openSheet(`<h3>Menu</h3>
    <button class="menurow" onclick="closeSheet();setTab('profile')">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>
      <div class="m">Profile<span>Manage your profile page + merch</span></div><span class="chev">›</span></button>
    <button class="menurow" onclick="closeSheet();setTab('settings')">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/></svg>
      <div class="m">Settings<span>Prices, votes, codes, who can sign in</span></div><span class="chev">›</span></button>
    <button class="menurow" onclick="closeSheet();openPlans()">
      <svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z"/></svg>
      <div class="m">Your plan<span>${planLine}</span></div><span class="chev">›</span></button>
    <button class="menurow out" onclick="closeSheet();signOut()">
      <svg viewBox="0 0 24 24"><path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/></svg>
      <div class="m">Sign out<span>Of this device</span></div></button>`);
}
/* FIRST RUN. Five steps for a brand-new account — name, songs, prices, Stripe,
   QR — drawn into #firstrun, NOT into #app, so the 4 s repaint and the lazy
   loaders can never wipe what is being typed. The flag in localStorage carries the
   step ('1'..'5') so a trip to Stripe and back lands on the same step; 'done'
   ends it for good. An account with no songs and no shows in history counts as
   new too, so a second device sees the same steps.
   The flag is `<artistId>:<step>` — a phone is not an account. One left half-done
   by a new artist must never wall off the established one who signs in next on
   the same phone, so a flag keyed to anybody else reads as no flag at all. */
const frAid=()=>(D&&D.show&&D.show.artistId)||'';
const frFlag=()=>{try{const f=localStorage.getItem('myset.firstrun')||'', i=f.indexOf(':');
  return i>0&&f.slice(0,i)===frAid()?f.slice(i+1):'';}catch(e){return ''}};
const frSet=v=>{try{localStorage.setItem('myset.firstrun',frAid()+':'+v)}catch(e){}};
function isNew(){
  const f=frFlag();
  if(f==='done')return false;
  if(f)return true;
  return !!(D&&D.songs&&!D.songs.length&&!((D.show||{}).played||[]).length
    &&HIST&&HIST.ok&&Array.isArray(HIST.shows)&&!HIST.shows.length);
}
let FR={step:0,hidden:false,drawn:''};
function drawFirstRun(){
  const el=$('#firstrun'); if(!el)return;
  const back=$('#frback');
  if(!D||!isNew()){ el.classList.remove('on'); FR.drawn=''; if(back)back.remove(); return; }
  if(FR.hidden){ el.classList.remove('on'); FR.drawn='';
    if(!back){ const b=document.createElement('button'); b.id='frback'; b.className='frback';
      b.textContent='Continue setup ›'; b.onclick=()=>{FR.hidden=false;drawFirstRun();}; document.body.appendChild(b); }
    return; }
  if(back)back.remove();
  if(!FR.step){ const f=parseInt(frFlag(),10); FR.step=(f>=1&&f<=5)?f:1; }
  /* The key names every fact the step draws from, so a loader landing repaints
     it and nothing else does: step 3 the plan (prices are a plan feature), step 4
     Stripe, step 5 the slug — or that /auth answered without one. */
  const key=FR.step+(FR.step===3?':'+(has('pricing')?'p':'np'):'')
    +(FR.step===5?':'+(TEAM?(TEAM.slug||'none'):''):'')
    +(FR.step===4?':'+(PAY&&(PAY.ready||PAY.chargesEnabled)?'on':PAY&&PAY.started?'started':'off'):'');
  if(FR.drawn===key){ el.classList.add('on'); return; }     // same step, same facts: leave the fields alone
  FR.drawn=key;
  el.innerHTML=frStep(FR.step); el.classList.add('on'); el.scrollTop=0;
  if(FR.step===5&&!TEAM) loadTeam();        // a failed answer is retried by hand, not on every paint
  if(FR.step===4&&!PAY) loadPay();
  if(FR.step===3&&!PLAN) loadPlan();
}
function frStep(n){
  const s=(D&&D.show)||{};
  const bar=`<div class="bar">${[1,2,3,4,5].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</div><span class="k">Step ${n} of 5</span>`;
  const skip=`<button class="btn-text" onclick="frNext()">Skip for now</button>`;
  let h='';
  if(n===1) h=`<h2>What’s your page called?</h2>
    <p>The name on your page. Change it any time in Profile.</p>
    <input class="inp" id="frName" maxlength="60" placeholder="Your name, or the band’s" value="${esc((PROF&&PROF.name)||s.artist||'')}" onkeydown="if(event.key==='Enter')frName()">
    <button class="btn-pri btn-block" onclick="frName()">Next</button>${skip}`;
  if(n===2) h=`<h2>Paste your songs</h2>
    <p>One per line — <b>Title, Artist</b> or <b>Title — Artist</b>. You can add more, and organise them into setlists, on the Setlist tab.</p>
    <textarea class="inp" id="frSongs" rows="7" placeholder="Wonderwall, Oasis&#10;Wish You Were Here — Pink Floyd" oninput="impParse(this.value)"></textarea>
    <p class="muted" id="impCount" style="font-size:13px;margin:12px 2px 0">Nothing to import yet.</p>
    <button class="btn-pri btn-block" id="impGo" onclick="frImport()" disabled>Import these</button>${skip}`;
  if(n===3){ const P=s.packs||{}, sm=P.small||{}, bg=P.big||{};
    h=`<h2>Prices</h2>
    <p>${has('pricing')
      ?'Every artist starts with these. Keep them for tonight, or change them now — they are all in Settings.'
      :`Every artist starts with these. Changing them is a ${esc(needsPlan('pricing'))} feature — the plans are in Settings whenever you want a look.`}</p>
    <div class="prices">
      <div class="lrow"><div class="m"><b>Free votes</b><span>Each person, each night</span></div><span class="cnt">${s.unlimited?'Unlimited':(s.freeCredits||0)}</span></div>
      <div class="lrow"><div class="m"><b>Replay a played song</b><span>Votes it costs</span></div><span class="cnt">${s.replayCost||0}</span></div>
      ${sm.votes?`<div class="lrow"><div class="m"><b>Extra votes, small</b><span>${sm.votes} votes</span></div><span class="cnt">$${((sm.cents||0)/100).toFixed(2)}</span></div>`:''}
      ${bg.votes?`<div class="lrow"><div class="m"><b>Extra votes, big</b><span>${bg.votes} votes</span></div><span class="cnt">$${((bg.cents||0)/100).toFixed(2)}</span></div>`:''}
    </div>
    <button class="btn-pri btn-block" onclick="frNext()">Keep these</button>
    ${/* Pricing is a plan feature: on a plan without it the button would land on a
          veiled box, so it is the plans that are offered instead (rule 3). */''}
    ${has('pricing')
      ?`<button class="btn-text" onclick="frPricing()">Change prices</button>`
      :`<button class="btn-text" onclick="frPlans()">See the plans</button>`}`; }
  if(n===4){ const on=!!(PAY&&(PAY.ready||PAY.chargesEnabled));
    /* Three honest states, the same three the Money tab's card knows: on; started
       on Stripe but not finished (back from an abandoned onboarding — the account
       exists, so its country is fixed and must not be asked for again); never
       started. The select has its own id so payStart reads THIS one, not the
       Money tab's underneath. */
    h=on
    ? `<h2>Card payments are on ✓</h2><p>Tips and extra votes go through Stripe, straight to you.</p>
       <button class="btn-pri btn-block" onclick="frNext()">Next</button>`
    : PAY&&PAY.started
    ? `<h2>Stripe still needs a few details</h2>
       <p>You started this but Stripe hasn’t finished checking yet. Tips and extra votes stay off in your room until it has — so nothing can land in the wrong account.</p>
       <button class="btn-pri btn-block" onclick="frSet('4');payStart()">Finish with Stripe</button>
       <button class="btn-text" onclick="frNext()">Later</button>`
    : `<h2>Take tips and paid votes</h2>
       <p>Stripe pays you out directly and takes a few minutes to set up. It can wait — the Money tab has the same button.</p>
       <div class="field" style="padding:0 0 4px"><label>Where’s your bank account?</label>
         <select class="inp" id="frCountry">${payCountries()}</select></div>
       <button class="btn-pri btn-block" onclick="frSet('4');payStart()">Start with Stripe</button>
       <button class="btn-text" onclick="frNext()">Later</button>`; }
  if(n===5) h=`<h2>Here’s your QR code</h2>
    <p>On the tables, on the tip jar, on your case. They scan it, they vote, you play.</p>
    ${TEAM&&TEAM.slug?`<div class="qrwrap"><img src="${qrSrc('profile',6)}" alt="Your QR code"></div>
      <p style="text-align:center;margin-top:-6px">myset.vip/${esc(TEAM.slug)}</p>
      <button class="btn-text" onclick="qrBig('profile')">Show it big to print</button>`
      :TEAM
      ?`<p class="muted">Couldn’t load your code — <button class="lnk" onclick="frCodes()">open Settings</button>, it’s under Codes to print.</p>
        <button class="btn-text" onclick="frRetryCode(this)">Try again</button>`
      :`<p class="muted">Loading your code…</p>`}
    <button class="btn-pri btn-block" onclick="frDone()">Done</button>`;
  return `<div class="fr">${bar}${h}</div>`;
}
function frNext(){ FR.step=Math.min(5,FR.step+1); frSet(String(FR.step)); drawFirstRun(); }
async function frName(){
  const nm=(($('#frName')||{}).value||'').trim();
  if(!nm){toast('Give your page a name');return;}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'profileSet',name:nm})});
  if(!d.ok){toast(d.error||'Could not save that');return;}
  PROF=null; loadProf();
  frNext();
}
async function frImport(){
  if(!IMP.length)return;
  const g=$('#impGo'); if(g){g.disabled=true;g.textContent='Importing…';}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'importSongs',songs:IMP})});
  if(!d.ok){toast(d.error||'Import failed');if(g){g.disabled=false;g.textContent='Import these';}return;}
  if(d.stage&&d.stage.ok)D=d.stage;
  toast(d.note||'Imported'); IMP=[];
  frNext(); render();
}
/* Prices live in Settings: hide the steps, go there, and leave a way back. */
function frPricing(){ FR.hidden=true; frNext(); showPricing(); }
/* Same shape for a plan that cannot change prices: the plan cards, not a veil. */
function frPlans(){ FR.hidden=true; frNext(); showPlans(); }
/* Step 5 when /auth would not answer: the last step, so the setup is done and the
   codes are where Settings keeps them; a retry there refreshes the same list. */
function frCodes(){ frDone(); setTab('settings'); loadTeam(true);
  setTimeout(()=>{const el=[...document.querySelectorAll('.sec .kick')].find(k=>k.textContent==='Codes to print');
    if(el) el.scrollIntoView({behavior:'smooth',block:'start'});},120); }
async function frRetryCode(b){ if(b){b.disabled=true;b.textContent='Trying…';}
  await loadTeam(true);
  if(!(TEAM&&TEAM.slug)){ toast('Still couldn’t reach it — try again in a moment'); if(b){b.disabled=false;b.textContent='Try again';} } }
function frDone(){ frSet('done'); FR.hidden=false; FR.drawn=''; drawFirstRun(); if(D)render(); }
/* What the room has asked for. Pending first, because a birthday is the one
   thing on this screen that goes stale. */
/* Venues you've asked for a spot, and what they said. Sits on the Gigs tab
   because that is where you think about where you're playing next. */
function pitchPanel(){
  const rows=(PITCHES&&PITCHES.ok?(PITCHES.pitches||[]):null);
  if(rows===null||!rows.length) return `
    <div class="sec"><span class="kick">Want more gigs?</span></div>
    <div class="list"><div class="row muted">Venues on MySet have a
      <b>“Want to perform here?”</b> button on their page. They see your real numbers —
      nights played, people in the room, votes cast — not just a bio. Find them from the
      <a href="/" style="color:var(--accent)">city feed</a>.</div></div>`;
  const reply={new:'Sent',keen:'They’re keen',nope:'Not this time'};
  return `<div class="sec"><span class="kick">Venues you’ve asked</span><span class="kick">${rows.length}</span></div>
    <div class="list">${rows.map(p=>{
      const keen=p.status==='keen';
      return `<div class="row ${p.status==='nope'?'off':''}">
        <div class="m"><div class="t">${esc(p.name)}</div>
          <div class="s">${keen?'Get in touch':'Asked'} · ${when(p.at)}</div>
          <span class="chip reply ${keen?'on':''}">${reply[p.status]||reply.new}</span></div>
        <a class="act" href="/v/${esc(p.slug)}">Open</a>
      </div>`;}).join('')}</div>`;
}

function asksPanel(){
  const all=(D&&D.asks)||[];
  if(!all.length) return '';
  const waiting=all.filter(a=>a.status==='pending');
  const rest=all.filter(a=>a.status!=='pending').slice(0,6);
  const rows=[...waiting,...rest];
  const cost=a=>a.cost?`${a.cost} vote${a.cost===1?'':'s'}`:'free';
  const row=a=>{
    const bday=a.kind==='birthday';
    const vibe=a.kind==='vibe';
    const open=a.status==='pending';
    const offer=a.pledgeCents?`$${(a.pledgeCents/100).toFixed(a.pledgeCents%100?2:0)} offered`:'';
    const held=a.pledgeVotes>0&&['authorized','capture_pending'].includes(a.pledgeState)
      ?` <span class="paidtag">${a.pledgeVotes} paid votes</span>`:'';
    const label=a.status==='added'?'On the setlist':a.status==='played'?'Done'
      :a.status==='declined'?'Declined — votes refunded':`Asked for · ${cost(a)}`;
    return `<div class="arow ${open?'':'done'}">
      ${bday?'<span class="bcake">🎂</span>':vibe?'<span class="bcake">✨</span>':''}
      <div class="m"><div class="t">${bday?esc(a.name):esc(a.title)}${!bday&&!vibe&&a.artist?` <span class="muted" style="font-weight:400">· ${esc(a.artist)}</span>`:''}${held}</div>
        <div class="s">${bday?'Happy birthday shout-out':vibe?'Mood vote':'Song request'} · ${vibe&&open?'Artist picks the song':label}${offer?` · ${offer}${a.status==='added'?' · charged when you finish the song':''}`:''} · ${when(a.at)}</div></div>
      ${open?(bday||vibe
        ? `<button class="act pri" data-act="askdone" data-id="${a.id}">Did it</button>
           <button class="act warn" data-act="asknope" data-id="${a.id}">✕</button>`
        : `<button class="act pri" data-act="askadd" data-id="${a.id}">+ Add</button>
           <button class="act warn" data-act="asknope" data-id="${a.id}">✕</button>`)
        :(a.status==='added'&&!a.pledgeCents
          ? `<button class="act" data-act="askdone" data-id="${a.id}">Played</button>`:'')}
    </div>`;
  };
  return `<div class="askpanel rise">
    <div class="ah"><b>${waiting.length?`${waiting.length} request${waiting.length===1?'':'s'} waiting`:'Requests tonight'}</b>
      <span>✕ refunds votes${all.some(a=>a.pledgeCents&&a.status==='pending')?' + releases card hold':''}</span></div>
    ${rows.map(row).join('')}</div>`;
}
async function askDo(action,id){
  if(WRITING)return; WRITING=true;
  try{
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action,id})});
    if(!d.ok){toast(d.error||'Failed');return;}
    if(d.stage&&d.stage.ok){ D=d.stage; render(); } else await load();
    // d.note carries the server's own wording when there's more to say — e.g.
    // which setlist the accepted song was added to
    toast(d.note||(action==='askAccept'?'Added — the room can vote for it now'
      :action==='askDecline'?'Declined, votes refunded':'Marked done'));
  } finally { WRITING=false; }
}
/* Song titles/artists are user text — never interpolate them into an onclick.
   Look the song up from state by id instead. */
function songById(id){ return (D&&D.songs||[]).find(x=>x.id===id); }
function openSheet(h,kind=''){
  const sh=$('#sheet');
  sh.className='sheet'+(kind?' '+kind:'');
  sh.innerHTML=`<div class="grabzone"><div class="grab"></div>
    <button class="sheetx" onclick="closeSheet()" aria-label="Close">✕</button></div>${h}`;
  sh.style.transform=''; sh.scrollTop=0;
  $('#bg').classList.add('on'); sh.classList.add('on');
  attachDrag(sh);
}
let VERIFYINTROSHOWN=false;
function maybeVerifyIntro(){
  if(VERIFYINTROSHOWN||!D||TAB!=='settings')return;
  const aid=(D.show&&D.show.artistId)||'artist';
  const key='myset.verify-search-intro.'+aid;
  try{if(localStorage.getItem(key))return;}catch(e){}
  VERIFYINTROSHOWN=true;
  setTimeout(()=>{
    if(TAB!=='settings'){VERIFYINTROSHOWN=false;return;}
    try{localStorage.setItem(key,'1');}catch(e){}
    openSheet(`<h3>verify your account now</h3>
      <p class="verify-lede">only verified profiles will show up in search results!</p>
      <p class="verify-note">(this is to minimize fraudulent use and ensure the best experience for MySet audiences)</p>
      <button class="big" onclick="startVerification()">Get verified</button>`,'verify-intro');
  },0);
}
function startVerification(){closeSheet();scrollTo({top:0,behavior:'smooth'});}
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
/* The night's name is role=button so it is announced as one; the click dispatcher
   is tap-only, so Enter/Space have to be forwarded by hand or the promise is empty. */
document.addEventListener('keydown',e=>{ if(e.key!=='Enter'&&e.key!==' ')return;
  const b=e.target&&e.target.closest&&e.target.closest('[data-act="histname"]'); if(!b)return;
  e.preventDefault(); renameNight(b.getAttribute('data-id')); });
document.addEventListener('keydown',e=>{ if(e.key!=='Escape')return;
  if($('#qrbig').classList.contains('on')) qrHide(); else closeSheet(); });

/* One sheet for adding and for editing — the same fields either way, so there is
   only one thing to learn and one thing to maintain. Everything a song has lives
   here: title, artist, the key you play it in, its genres, your own chart, and
   the words the room sees. */
const ROOTS=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];
let SONG=null;   // { id, tags:Set, vocab, minor:bool }

async function openSongSheet(id){
  const existing=id?songById(id):null;
  if(id&&!existing)return;
  openSheet(`<h3>${id?'Edit song':'Add a song'}</h3><p class="lede"><span class="spin"></span> One moment…</p>`);

  let song={title:'',artist:'',key:'',tags:[]}, chart='', lyr={plain:'',credit:'',state:'unfetched',owned:false};
  let vocab=(D&&D.tags)?{builtin:D.tags.builtin,own:D.tags.own,maxPerSong:6}:{builtin:[],own:[],maxPerSong:6};
  if(id){
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'songGet',song:id})});
    if(!d.ok){toast(d.error||'Could not open that');closeSheet();return;}
    song=d.song; chart=d.chart||''; lyr=d.lyrics||lyr; vocab=d.tags||vocab;
  }else{
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'tagList'})});
    if(d.ok) vocab=d.tags;
  }
  SONG={id, tags:new Set(song.tags||[]), vocab, minor:/m$/.test(song.key||'')};
  drawSongSheet(song, chart, lyr);
}

function drawSongSheet(song, chart, lyr){
  const note={ok:lyr.owned?'Your own words — these override anything found online.'
                :'Found online. Shown to the room as “Unofficial lyrics”.',
              none:'Nothing found online for this one.',
              blocked:'Turned off for this song.',
              unfetched:'Not looked up yet.'}[lyr.state]||'';
  openSheet(`<h3>${SONG.id?'Edit song':'Add a song'}</h3>
    <div class="field" style="padding:0"><label>Title</label>
      <input class="inp" id="sgTitle" maxlength="80" placeholder="Wish You Were Here"
        value="${esc(song.title||'')}" autocomplete="off"></div>
    <div class="field" style="padding:14px 0 0"><label>Artist <span class="muted" style="font-weight:400">— optional</span></label>
      <input class="inp" id="sgArtist" maxlength="60" placeholder="Pink Floyd"
        value="${esc(song.artist||'')}" autocomplete="off"></div>

    <div class="field" style="padding:18px 0 0"><label>The key you play it in</label>
      <div class="keys">${ROOTS.map(r=>`<button class="${keyRoot()===r?'on':''}" data-act="sgroot" data-id="${r}">${r}</button>`).join('')}</div>
      <div class="minor">
        <button class="${SONG.minor?'':'on'}" data-act="sgmin" data-id="maj">Major</button>
        <button class="${SONG.minor?'on':''}" data-act="sgmin" data-id="min">Minor</button>
      </div>
      <input class="inp" id="sgKey" maxlength="14" style="margin-top:9px"
        placeholder="Or write it yourself — Capo 2, Drop D…" value="${esc(song.key||'')}">
    </div>

    <div class="field" style="padding:18px 0 0"><label>Genres
      <span class="cnt" id="cTags">${SONG.tags.size} of ${SONG.vocab.maxPerSong}</span></label>
      <div class="tagwrap" id="tagwrap">${tagChips()}</div>
    </div>

    <div class="field" style="padding:18px 0 0"><label>Your chart
      <span class="muted" style="font-weight:400">— only you ever see this</span></label>
      <textarea class="inp chart" id="sgChart" maxlength="20000"
        placeholder="G          D          Em         C&#10;Paste it however you like it —&#10;chords, capo, the bit you always forget.">${esc(chart)}</textarea>
      <p class="muted" style="font-size:12px;margin:7px 0 0">Fixed-width, so chords stay over the right word.</p>
    </div>

    <div class="field" style="padding:18px 0 0"><label>Words for the room</label>
      <textarea class="inp" id="sgLyrics" rows="7"
        placeholder="What fans see when they tap Lyrics.">${esc(lyr.plain||'')}</textarea>
      <input type="hidden" id="sgCredit" value="${esc(lyr.credit||'')}">
      <input type="hidden" id="sgOwned" value="${lyr.owned?'1':''}">
      <p class="muted" style="font-size:12px;margin:7px 0 0">${esc(note)}</p>
      ${SONG.id?`<div style="display:flex;gap:8px;margin-top:10px">
        <button class="act" data-act="lyrfind" data-id="${esc(SONG.id)}">Find online</button>
        <button class="act warn" data-act="lyrclear" data-id="${esc(SONG.id)}">Remove words</button>
      </div>`:''}
    </div>

    <button class="big" style="margin-top:20px" data-act="sgsave" data-id="${esc(SONG.id||'')}">
      ${SONG.id?'Save song':'Add it to my setlist'}</button>
    ${SONG.id?`<button class="big alt" style="margin-top:10px" data-act="del" data-id="${esc(SONG.id)}">Remove from my setlist</button>`:''}`);
  wireCount('#sgChart','#cChart',20000);
  setTimeout(()=>{const e=$('#sgTitle'); if(e&&!SONG.id)e.focus();},280);
}
function keyRoot(){
  const v=(($('#sgKey')||{}).value)||'';
  const m=/^([A-G][b#]?)m?$/.exec(v.trim());
  return m?m[1]:null;
}
function tagChips(){
  const all=[...SONG.vocab.builtin.map(t=>({...t,own:false})),
             ...SONG.vocab.own.map(t=>({...t,own:true}))];
  return all.map(t=>`<button class="tg ${t.own?'own':''} ${SONG.tags.has(t.id)?'on':''}"
      data-act="sgtag" data-id="${esc(t.id)}">${esc(t.label)}</button>`).join('')
    + (SONG.vocab.own.length<15?`<button class="tg add" data-act="sgtagnew">+ Your own</button>`:'');
}
function toggleSongTag(id){
  if(SONG.tags.has(id)) SONG.tags.delete(id);
  else{
    if(SONG.tags.size>=SONG.vocab.maxPerSong){toast(`${SONG.vocab.maxPerSong} genres is plenty for one song`);return;}
    SONG.tags.add(id);
  }
  // repaint just the chips, so nothing typed above is lost
  const w=$('#tagwrap'); if(w) w.innerHTML=tagChips();
  const c=$('#cTags'); if(c) c.textContent=`${SONG.tags.size} of ${SONG.vocab.maxPerSong}`;
}
async function addOwnTag(){
  const label=(prompt('Name your genre — 20 characters')||'').trim();
  if(!label)return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'tagAdd',label})});
  if(!d.ok){toast(d.error||'Could not add that');return;}
  SONG.vocab=d.tags;
  const fresh=d.tags.own.find(t=>!SONG.tags.has(t.id)&&t.label===label);
  if(fresh&&SONG.tags.size<SONG.vocab.maxPerSong) SONG.tags.add(fresh.id);
  const w=$('#tagwrap'); if(w) w.innerHTML=tagChips();
  const c=$('#cTags'); if(c) c.textContent=`${SONG.tags.size} of ${SONG.vocab.maxPerSong}`;
  if(D) D.tags={builtin:d.tags.builtin,own:d.tags.own};
  toast('Added — tap it on any song');
}
function setKeyRoot(r){
  const el=$('#sgKey'); if(!el)return;
  el.value=r+(SONG.minor?'m':'');
  document.querySelectorAll('[data-act="sgroot"]').forEach(b=>
    b.classList.toggle('on',b.getAttribute('data-id')===r));
}
function setKeyMinor(on){
  SONG.minor=on;
  const el=$('#sgKey'); if(!el)return;
  const r=keyRoot();
  if(r) el.value=r+(on?'m':'');
  document.querySelectorAll('[data-act="sgmin"]').forEach(b=>
    b.classList.toggle('on',(b.getAttribute('data-id')==='min')===on));
}
async function saveSongSheet(id){
  if(WRITING)return; WRITING=true;
  try{
    const v=x=>(($('#'+x)||{}).value||'');
    const title=v('sgTitle').trim();
    if(!title){toast('It needs a title');return;}
    const payload={title, artist:v('sgArtist').trim(), key:v('sgKey').trim(), tags:[...SONG.tags]};
    let songId=id;
    if(id){
      const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'editSong',song:id,...payload})});
      if(!d.ok){toast(d.error||'Could not save');return;}
      if(d.stage&&d.stage.ok){D=d.stage;}
    }else{
      const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'addSong',...payload})});
      if(!d.ok){toast(d.error||'Could not add that');return;}
      songId=d.songId;
      if(d.stage&&d.stage.ok){D=d.stage;}
      if(d.note) toast(d.note);
    }
    if(songId){
      await api('/admin',{method:'POST',body:JSON.stringify({action:'chartSet',song:songId,chart:v('sgChart')})});
      const words=v('sgLyrics').trim();
      const had=(SONG.hadLyrics||'');
      if(words!==had)
        await api('/admin',{method:'POST',body:JSON.stringify({action:'lyricsSet',song:songId,
          plain:words, credit:v('sgCredit'), owned:!v('sgCredit')})});
    }
    CHARTS=null;
    closeSheet(); await load();
    /* "Added to your setlist" was wrong twice: a new song joins the LIBRARY, and
       with a setlist active the room cannot vote for it at all until it joins that
       too. The two siblings of this bug (askAccept, learnDone) were already fixed.
       Read the refreshed row rather than trusting the server note, because toast()
       replaces the single toast element and this line always fires last. */
    const sgNew=(D&&D.songs||[]).find(x=>x.id===songId);
    toast(id?'Saved':(sgNew&&sgNew.inSet===false
      ? 'In your songs — add it to tonight’s set so the room can vote'
      : 'Added to your songs'));
  } finally { WRITING=false; }
}
/* Read-only, big, fixed-width — for looking at mid-song, not editing. */
async function openChart(id){
  const x=songById(id); if(!x)return;
  openSheet(`<h3>${esc(x.title)}</h3><p class="lede"><span class="spin"></span> Opening your chart…</p>`);
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'songGet',song:id})});
  if(!d.ok){toast(d.error||'Could not open that');closeSheet();return;}
  openSheet(`<h3>${esc(x.title)}</h3>
    <p class="lede">${esc([x.artist,d.song.key&&('key of '+d.song.key)].filter(Boolean).join(' · '))}</p>
    ${d.chart?`<div class="chartview">${esc(d.chart)}</div>`
      :`<p class="muted" style="font-size:15px">No chart for this one yet.
         Tap <b>Edit</b> on it in the Setlist and paste one in.</p>`}
    <button class="big alt" style="margin-top:16px" data-act="edit" data-id="${esc(id)}">Edit this song</button>`);
}

async function openStageLyrics(id){
  const x=songById(id); if(!x)return;
  openSheet(`<h3>${esc(x.title)}</h3><p class="lede">${esc(x.artist||'')}</p>
    <div class="chartview stage-lyrics" id="stageLyrics"><span class="spin"></span> Finding the words…</div>`);
  let d=null;
  const aq=ASLUG?'&a='+encodeURIComponent(ASLUG):'';
  try{d=await fetch(`${API}/lyrics?song=${encodeURIComponent(id)}${aq}`).then(r=>r.json());}catch(e){}
  const el=$('#stageLyrics');if(!el)return;
  if(!d||!d.ok||!d.found){el.innerHTML='<p class="muted" style="white-space:normal">No lyrics for this one yet — you’ll have to wing it. 🎤</p>';return;}
  el.textContent=d.plain;
  const foot=document.createElement('p');foot.className='muted';foot.style.cssText='font-size:12px;margin-top:14px';
  foot.textContent='Unofficial lyrics · '+(d.credit||'community-contributed, may not be exact');el.after(foot);
}

async function openAutoChords(id){
  const x=songById(id);if(!x)return;
  const q=encodeURIComponent([x.title,x.artist].filter(Boolean).join(' '));
  const fallback=`https://www.ultimate-guitar.com/search.php?search_type=title&value=${q}`;
  /* Open synchronously inside the tap so iOS cannot classify the later navigation
     as an unwanted popup. The direct tab replaces this tiny holding page. */
  const tab=window.open('','_blank');
  if(tab){tab.opener=null;tab.document.title='Finding chords…';tab.document.body.textContent='Finding the best chord chart…';}
  openSheet(`<h3>${esc(x.title)}</h3><p class="lede"><span class="spin"></span> Finding the best matching chord chart…</p>`);
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'chordsLink',song:id})});
  const url=d&&d.ok&&d.url?d.url:fallback;
  if(d&&d.ok&&d.direct&&tab){tab.location.replace(url);closeSheet();return;}
  if(tab)tab.close();
  openSheet(`<h3>${esc(x.title)}</h3><p class="lede">${d&&d.direct?'Best matching community chord sheet':'I couldn’t safely identify one exact chart. Here are the filtered results instead.'}</p>
    <a class="big" target="_blank" rel="noopener noreferrer" href="${esc(url)}" style="justify-content:center">♬ ${d&&d.direct?'Open the chord chart':'Search Ultimate Guitar'} ↗</a>
    <p class="muted" style="font-size:12px;margin-top:14px">Unofficial — check the key and changes before relying on them live. MySet never copies or republishes the chart.</p>`);
}

async function findLyrics(id){
  toast('Searching…');
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'lyricsFetch',song:id})});
  if(!d.ok){toast('Search failed');return;}
  if(!d.found){toast('Nothing found — paste them yourself');return;}
  const el=$('#sgLyrics'); if(el)el.value=d.plain;
  const c=$('#sgCredit'); if(c)c.value=d.credit||'';
  const o=$('#sgOwned'); if(o)o.value='';        // found online, not the artist's own
  toast('Found — tap Save song to keep them');
}
async function clearLyrics(id){
  const el=$('#sgLyrics'); if(el)el.value='';
  await api('/admin',{method:'POST',body:JSON.stringify({action:'lyricsSet',song:id,plain:''})});
  toast('Lyrics removed for this song');
}
function declineSong(id){
  const x=songById(id); if(!x||!x.votes)return;
  if(confirm('Decline “'+x.title+'” for tonight and return all '+x.votes+' vote'+(x.votes===1?'':'s')+' to the people who cast them?\n\nThe song will be hidden until you choose Show again.'))
    act('declineSong',{song:id});
}
function removeSong(id){
  const x=songById(id); if(!x)return;
  if(confirm('Remove “'+x.title+'” from your setlist?')) act('removeSong',{song:id});
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b)return;
  const id=b.getAttribute('data-id');
  if(b.dataset.act==='bookmonth') costSheet(id);
  if(b.dataset.act==='edit') openSongSheet(id);
  if(b.dataset.act==='sgsave') saveSongSheet(id||null);
  if(b.dataset.act==='sgroot') setKeyRoot(id);
  if(b.dataset.act==='sgmin') setKeyMinor(id==='min');
  if(b.dataset.act==='sgtag') toggleSongTag(id);
  if(b.dataset.act==='sgtagnew') addOwnTag();
  if(b.dataset.act==='chart') openChart(id);
  if(b.dataset.act==='lyrics') openStageLyrics(id);
  if(b.dataset.act==='autochords') openAutoChords(id);
  if(b.dataset.act==='gfilter') setGenre(id);
  if(b.dataset.act==='luse') useList(id);
  if(b.dataset.act==='lpick') openListPicker(id);
  if(b.dataset.act==='lrename') renameList(id);
  if(b.dataset.act==='ldel') deleteList(id);
  if(b.dataset.act==='ltoggle') toggleInList(id);
  if(b.dataset.act==='pktog') pickToggle(id);
  if(b.dataset.act==='pksave') savePicker(id);
  if(b.dataset.act==='wdone') learnDone(id);
  if(b.dataset.act==='wdel') learnRemove(id);
  if(b.dataset.act==='lyrfind') findLyrics(id);
  if(b.dataset.act==='lyrclear') clearLyrics(id);
  if(b.dataset.act==='del') removeSong(id);
  if(b.dataset.act==='show') openShow(id);
  if(b.dataset.act==='histname') renameNight(id);
  if(b.dataset.act==='recon') reconcile(id);
  if(b.dataset.act==='mup') media('mediaMove',id,'up');
  if(b.dataset.act==='mdn') media('mediaMove',id,'down');
  if(b.dataset.act==='mrm') media('mediaRemove',id);
  if(b.dataset.act==='rmmail') removeTeam(id);
  if(b.dataset.act==='photoclear'){ e.preventDefault(); clearPhoto(id); }
  if(b.dataset.act==='promotoggle') togglePromo(id);
  if(b.dataset.act==='qrbig'){ e.preventDefault(); qrBig(id); }
  if(b.dataset.act==='askadd') askDo('askAccept',id);
  if(b.dataset.act==='askdone') askDo('askDone',id);
  if(b.dataset.act==='asknope') askDo('askDecline',id);
  if(b.dataset.act==='vverify') verifyVenue(id);
  if(b.dataset.act==='calday') openGig(null,id);
  if(b.dataset.act==='gigedit') openGig(id);
  if(b.dataset.act==='gigsave') saveGig2(id);
  if(b.dataset.act==='gigdel') delGig(id);
  if(b.dataset.act==='gigskip') skipGig(id);
  if(b.dataset.act==='gighide') hideGig(id);
  if(b.dataset.act==='grep'){ const h=$('#gRepeat'); if(h){h.value=id;
    document.querySelectorAll('[data-act="grep"]').forEach(x=>x.classList.toggle('on',x.getAttribute('data-id')===id));} }
});
/* The printable codes. Caption is what goes UNDER the code on the card, so it
   has to make sense to somebody who has never heard of MySet. */
/* Two codes here, one in the Venue Studio, three in the whole app. The artist's
   code goes to their PAGE — from there the room taps through to voting, and they
   also get the music, the links and the next gigs. */
const QRS=[
  ['profile','Your page','On the tables during your show','Choose the next song'],
  ['home','MySet','Find gigs anywhere','Find live music. Choose the songs they play.'],
];
const qrSrc=(k,scale)=>`/api/qr?k=${k}${k==='home'?'':'&a='+encodeURIComponent((TEAM&&TEAM.slug)||'')}&s=${scale}`;
const qrUrl=k=>k==='home'?'myset.vip'
  :k==='vote'?`myset.vip/${(TEAM&&TEAM.slug)||''}/vote`:`myset.vip/${(TEAM&&TEAM.slug)||''}`;
function qrCopy(k){return k==='home'
  ? {head:'FIND LIVE MUSIC NEAR YOU',line:'VOTE on which songs play next',url:'www.MySet.VIP'}
  : {head:String((PROF&&PROF.name)||((D&&D.show)||{}).artist||'Artist').toUpperCase(),line:'VOTE on which songs I play next',url:'www.MySet.VIP'};}
function qrBig(k){
  const row=QRS.find(x=>x[0]===k); if(!row)return;
  if(k!=='home'&&!(TEAM&&TEAM.slug)){ toast('Still loading your page address'); return; }
  const el=$('#qrbig');
  const copy=qrCopy(k);
  el.innerHTML=`<div onclick="event.stopPropagation()">
    <div class="qrpaper">
      <img src="${qrSrc(k,10)}" alt="${esc(row[1])} QR code">
      <div class="cap">${esc(copy.head)}</div><div class="cap2">${esc(copy.line)}</div>
      <div class="sub">${esc(copy.url)}</div>
    </div>
    <div class="qracts">
      <button onclick="qrDownload('${k}')">Download</button>
      <button onclick="qrHide()">Done</button>
    </div>
  </div>`;
  el.classList.add('on');
  if(!QRSHOWN){ QRSHOWN=true; try{localStorage.setItem('myset.qrshown','1')}catch(e){} if(TAB==='live'&&D&&!typing())render(); }
}
function qrHide(e){ if(e&&e.target&&e.target.id!=='qrbig')return; $('#qrbig').classList.remove('on'); }
function qrDownload(k){
  const row=QRS.find(x=>x[0]===k); if(!row)return;
  const img=new Image(); img.onload=()=>{
    const c=document.createElement('canvas'),z=1800,ctx=c.getContext('2d'),copy=qrCopy(k); c.width=z;c.height=z;
    const fit=(txt,max,size,weight='700')=>{do{ctx.font=`${weight} ${size}px Georgia, serif`;size-=2;}while(ctx.measureText(txt).width>max&&size>24)};
    ctx.fillStyle='#fff';ctx.fillRect(0,0,z,z);ctx.drawImage(img,250,45,1300,1300);ctx.textAlign='center';
    ctx.fillStyle='#111';fit(copy.head,1640,82);ctx.fillText(copy.head,z/2,1435);
    ctx.fillStyle='#ff4058';fit(copy.line,1580,60);ctx.fillText(copy.line,z/2,1535);
    fit(copy.url,1100,46,'600');ctx.fillText(copy.url,z/2,1650);
    c.toBlob(blob=>{if(!blob){toast('Couldn’t prepare that QR code');return;}
      const url=URL.createObjectURL(blob),a=document.createElement('a');a.download=`myset-${k}-qr.png`;a.href=url;
      document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    },'image/png');
  }; img.onerror=()=>toast('Couldn’t prepare that QR code'); img.src=qrSrc(k,20);
}

function openEndShow(){
  const today=new Date().toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  openSheet(`<h3>Save this show</h3><p class="lede">Give the night a title for your records, or leave the suggested title as-is.</p>
    <input class="inp" id="endShowTitle" maxlength="100" value="Untitled show – ${esc(today)}" aria-label="Show title">
    <button class="big" style="margin-top:16px" onclick="saveEndedShow()">Save + end show</button>
    <button class="big alt" style="color:var(--accent)" onclick="discardEndedShow()">Discard + end show</button>
    <button class="big alt" onclick="closeSheet()">Keep show running</button>`);
}
async function saveEndedShow(){
  const title=((($('#endShowTitle')||{}).value)||'').trim();
  if(!title){toast('Give this show a title');return;}
  closeSheet();await act('status',{status:'ended',title});
}
async function discardEndedShow(){
  if(!confirm('End this show without saving it to Past shows?'))return;
  closeSheet();await act('status',{status:'ended',discard:true});
}

/* Same key the voting page uses, so flipping this on here affects the phone
   you're actually voting from. */
function myFanId(){
  let v=null; try{v=localStorage.getItem('myset.fan')}catch(e){}
  if(!v){ v='f'+Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
    try{localStorage.setItem('myset.fan',v)}catch(e){} }
  return v;
}
async function saveFreeCredits(){
  const n=parseInt((($('#fcCustom')||{}).value||''),10);
  if(!Number.isFinite(n)||n<0||n>999){toast('Pick a number from 0 to 999');return;}
  act('freeCredits',{n});
}
async function saveAskCost(kind){
  const el=$('#ac'+kind); const n=parseInt((el&&el.value)||'',10);
  if(!Number.isFinite(n)||n<1){toast('Pick a number of votes');return;}
  await act('askSet',{kind,cost:n});
  toast(`Now ${n} vote${n===1?'':'s'}`);
}
async function saveReplayCost(){
  const n=parseInt((($('#rcCustom')||{}).value||''),10);
  if(!Number.isFinite(n)||n<1||n>99){toast('Pick a number from 1 to 99');return;}
  act('replayCost',{n});
}
async function warmLyrics(){
  const b=$('#lyrWarm'); if(b){b.disabled=true;b.innerHTML='<span class="spin"></span> Fetching…';}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'lyricsWarm'})});
  if(b){b.disabled=false;b.textContent='↓ Fetch lyrics for the whole setlist';}
  if(!d.ok){toast(d.error||'Could not fetch');return;}
  toast(`${d.fetched} of ${d.total} songs have lyrics now`);
  if(d.missing&&d.missing.length)
    openSheet(`<h3>${d.fetched} of ${d.total} found</h3>
      <p class="lede">No lyrics online for these. Open each in the Setlist tab and paste them, or leave them — the button just won’t show.</p>
      <div class="list">${d.missing.map(t=>`<div class="row"><div class="m"><div class="t">${esc(t)}</div></div></div>`).join('')}</div>
      <button class="big" style="margin-top:14px" onclick="closeSheet()">Got it</button>`);
}
/* ---------- bulk import: CSV file or pasted text ----------
   Parsing happens HERE so the artist sees exactly what will be added before
   anything is written. The server (importSongs) re-validates everything anyway:
   dupes are skipped, the library cap refuses loudly, over-cap rows arrive off. */
let IMP=[];
function openImport(){
  IMP=[];
  openSheet(`<h3>Import songs</h3>
    <p class="lede">A CSV file or pasted list. One song per line — <b>Title, Artist</b> or <b>Title — Artist</b>. A header row is fine.</p>
    <label class="bigfile"><input type="file" id="impFile" accept=".csv,.txt,text/csv,text/plain" style="display:none" onchange="impFile(this)">⇪ Choose a CSV or text file</label>
    <textarea class="inp" id="impText" rows="5" placeholder="Wonderwall, Oasis&#10;Wish You Were Here — Pink Floyd" oninput="impParse(this.value)"></textarea>
    <p class="muted" id="impCount" style="font-size:13px;margin:12px 2px 0">Nothing to import yet.</p>
    <button class="go" id="impGo" onclick="impSend()" disabled>Import</button>`);
}
function impParse(text){
  const rows=[];
  for(let line of String(text||'').split(/\r?\n/)){
    line=line.trim(); if(!line)continue;
    // split on the FIRST comma, em/en dash, hyphen-with-spaces, or tab
    const m=line.match(/^"?(.*?)"?\s*(?:,|\t| [—–] | - )\s*"?(.*?)"?$/);
    let title=m?m[1]:line, artist=m?m[2]:'';
    title=title.trim(); artist=artist.trim();
    if(!title)continue;
    if(/^(title|song|track|name)$/i.test(title)&&/^artist/i.test(artist))continue;   // header row
    rows.push({title:title.slice(0,80),artist:artist.slice(0,60)});
    if(rows.length>=300)break;
  }
  IMP=rows; impShow();
}
function impShow(){
  const c=$('#impCount'),g=$('#impGo');
  if(c)c.textContent=IMP.length?`${IMP.length} song${IMP.length===1?'':'s'} ready — e.g. “${IMP[0].title}${IMP[0].artist?' — '+IMP[0].artist:''}”`:'Nothing to import yet.';
  if(g)g.disabled=!IMP.length;
}
function impFile(inp){
  const f=inp.files&&inp.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{const t=$('#impText'); if(t)t.value=String(r.result||'').slice(0,120000); impParse(r.result);};
  r.readAsText(f);
}
async function impSend(){
  if(!IMP.length)return;
  const g=$('#impGo'); if(g){g.disabled=true;g.textContent='Importing…';}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'importSongs',songs:IMP})});
  if(!d.ok){toast(d.error||'Import failed');if(g){g.disabled=false;g.textContent='Import';}return;}
  if(d.stage&&d.stage.ok)D=d.stage;
  closeSheet(); render(); toast(d.note||'Imported');
}

async function savePacks(){
  const n=id=>parseFloat(($('#'+id)||{}).value);
  const S={votes:n('pSv'),cents:Math.round(n('pSc')*100)},
        B={votes:n('pBv'),cents:Math.round(n('pBc')*100)};
  const all=[S,B];
  if(!all.every(p=>Number.isFinite(p.votes)&&p.votes>0&&Number.isFinite(p.cents))){toast('Fill in both packs');return;}
  if(all.some(p=>p.cents<100)){toast('Stripe\u2019s minimum charge is $1');return;}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'packs',small:S,big:B})});
  if(!d.ok){toast(d.error||'Could not save that');return;}
  toast('Prices saved'); load();
}
async function setShare(on){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'shareStats',on})});
  if(!d.ok){toast(d.error||'Failed');return;}
  if(PLAN) PLAN.shareStats=d.shareStats;
  render();
  toast(d.shareStats?'Venues can see your numbers':'Venues can’t see your numbers');
}
/* ---------- ALERTS ON YOUR PHONE ----------
   Web Push. Works without an App Store, but iOS only allows it once the Studio has
   been ADDED TO THE HOME SCREEN — so on an iPhone in a browser tab the honest
   answer is instructions, not a button that would fail. The panel renders one of
   four states and never pretends. */
const PUSH_INSTALLED = matchMedia('(display-mode: standalone)').matches
  || navigator.standalone === true
  || new URLSearchParams(location.search).get('src')==='pwa';
const PUSH_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
let PUSHKEY=null;

const b64ToBytes=(s)=>{
  const pad='='.repeat((4-s.length%4)%4);
  const raw=atob((s+pad).replace(/-/g,'+').replace(/_/g,'/'));
  return Uint8Array.from(raw, c=>c.charCodeAt(0));
};

async function pushState(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)) return {can:false,why:'browser'};
  if(PUSH_IOS && !PUSH_INSTALLED) return {can:false,why:'ios-not-installed'};
  /* `serviceWorker.ready` NEVER RESOLVES when there is no active worker for this
     scope — a registration that failed, a first load where it has not activated
     yet, or a browser that blocks it. This panel awaited it with no timeout, so it
     sat on "Checking…" for ever and never got as far as saying why. A promise that
     can hang forever needs a race, not optimism. */
  const reg=await Promise.race([
    navigator.serviceWorker.ready.catch(()=>null),
    new Promise((r)=>setTimeout(()=>r(null),4000)),
  ]);
  if(!reg) return {can:false,why:'no-worker'};
  const sub=await reg.pushManager.getSubscription().catch(()=>null);
  const denied=(typeof Notification!=='undefined')&&Notification.permission==='denied';
  return {can:true, on:!!sub, denied, reg, sub};
}

let PUSHVIEW='';
/* Alerts on the artist's phone: Web Push, so a song request reaches them with the
   screen off and the Studio closed. Needs VAPID keys on the server, and on iPhone
   needs the Studio added to the home screen — both of which this panel says out
   loud when they are missing.

   It writes through PUSHVIEW rather than straight into the box, because `render()`
   recreates that div: loadTeam() and loadPlan() each finish and re-render, which
   wiped the result and put the "Checking…" spinner back. A panel that reports an
   async answer into a node the renderer owns has to survive being re-rendered. */
async function drawPush(){
  const paint=(html)=>{ PUSHVIEW=html; const b=$('#pushBox'); if(b)b.innerHTML=html; };
  const row=(t,s,btn)=>`<div class="list"><div class="row"><div class="m"><div class="t">${t}</div>
    <div class="s">${s}</div></div>${btn||''}</div></div>`;
  if(!PUSHKEY){ const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'pushKey'}),quiet:true});
    PUSHKEY=d&&d.ok?d:{key:null,devices:0}; }
  /* Checked BEFORE anything that can wait. This used to sit below `await
     pushState()`, so the one state we can always answer instantly was reported last
     — behind a promise that could hang. */
  if(!PUSHKEY.key) return paint(row('Not switched on yet',
    'MySet’s notification keys aren’t set on the server, so nothing can be sent yet.'));
  const st=await pushState();
  if(!st.can&&st.why==='browser') return paint(row('This browser can’t do alerts',
    'Chrome on Android, or the Studio added to your home screen on iPhone.'));
  if(!st.can&&st.why==='no-worker') return paint(row('Couldn’t start alerts here',
    'Reload the page and try again. If it keeps happening, this browser is blocking background workers.',
    `<button class="act" onclick="PUSHKEY=null;drawPush()">Retry</button>`));
  if(!st.can&&st.why==='ios-not-installed') return paint(
    row('Add the Studio to your home screen first','On iPhone, alerts only work once it’s installed.',
      `<button class="act" onclick="openStudioInstall()">How</button>`));
  if(st.denied) return paint(row('Alerts are blocked',
    'Your phone is blocking them. Turn them back on in Settings → Notifications → MySet.'));

  paint(row(st.on?'Alerts are on':'Get alerts on your phone',
    st.on?`You'll be told when someone requests a song, even with the screen off.${PUSHKEY.devices>1?` · ${PUSHKEY.devices} devices`:''}`
         :'Know the moment someone requests a song — no need to watch the screen.',
    `<button class="act${st.on?'':' '}" onclick="togglePush(${st.on?'false':'true'})">${st.on?'Turn off':'Turn on'}</button>`));
}

async function togglePush(on){
  const st=await pushState();
  if(!st.can)return;
  try{
    if(on){
      const perm=await Notification.requestPermission();
      if(perm!=='granted'){ drawPush(); return; }
      const sub=await st.reg.pushManager.subscribe({userVisibleOnly:true,
        applicationServerKey:b64ToBytes(PUSHKEY.key)});
      const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'pushOn',sub:sub.toJSON()})});
      if(!d.ok){ toast(d.error||'Could not switch alerts on'); await sub.unsubscribe().catch(()=>{}); }
      else toast('Alerts on — check your notifications');
    }else{
      if(st.sub){ await api('/admin',{method:'POST',body:JSON.stringify({action:'pushOff',endpoint:st.sub.endpoint})});
        await st.sub.unsubscribe().catch(()=>{}); }
      toast('Alerts off');
    }
  }catch(e){ toast('Your phone wouldn’t allow that'); }
  PUSHKEY=null; drawPush();
}

function openStudioInstall(){
  const ios=PUSH_IOS;
  const steps=ios
    ? [['Tap <b>Share</b> in Safari','the square with an arrow pointing up'],
       ['Scroll to <b>Add to Home Screen</b>',''],
       ['Tap <b>Add</b>, top right',''],
       ['Open the Studio from your home screen','then come back here and turn alerts on']]
    : [['Tap the <b>⋮</b> menu, top right of Chrome',''],
       ['Tap <b>Install app</b>','or <b>Add to Home screen</b>'],
       ['Tap <b>Install</b>',''],
       ['Open the Studio from your home screen','then come back here and turn alerts on']];
  openSheet(`<h3>Put the Studio on your home screen</h3>
    <p class="lede">Then it opens like an app — and on iPhone it's the only way alerts can work.</p>
    <div class="list">${steps.map(([t,sub],i)=>`<div class="row"><div class="m">
      <div class="t">${i+1}. ${t}</div>${sub?`<div class="s">${sub}</div>`:''}</div></div>`).join('')}</div>
    <p class="muted" style="font-size:12px;padding:12px 4px 0">${ios
      ? 'It has to be <b>Safari</b> — Chrome on iPhone can’t add to the home screen.'
      : 'The wording moves around between Android versions.'}</p>
    <button class="big" style="margin-top:14px" onclick="closeSheet()">Got it</button>`);
}


/* ---------- the shop, its orders, and the community page ----------
   Merch is a Plus feature; the whole tab sits under one lock so a free artist sees
   exactly what paying gets them (0bx). Orders come from Stripe by way of the
   ledger; a buyer's name and address are fetched when an order is opened and
   never kept here. The community page is free on every plan — moderating it is
   running your page. */
async function loadMerch(force){ if(MERCH&&!force)return; const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'merchList'}),quiet:true}); if(d&&d.ok){MERCH=d.merch; if(TAB==='profile'&&D&&!typing())render();} }
async function loadOrders(force){ if(ORDERS&&!force)return; const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'orderList'}),quiet:true}); if(d&&d.ok){ORDERS=d.orders; if((TAB==='profile'||TAB==='money')&&D&&!typing())render();} }
/* A late reply must not repaint over a field somebody is typing into — render()
   replaces #app wholesale. The data is drawn on the next render either way. */
const typing=()=>{const a=document.activeElement;return !!(a&&a.closest&&a.closest('#app')&&a.matches('input,textarea'));};
async function loadComm(force){ if(COMM&&!force)return; const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'postList'}),quiet:true}); if(d&&d.ok){COMM=d.posts; if(TAB==='profile'&&D)render();} }
const money=c=>'$'+(c/100).toFixed(c%100?2:0);
/* Merch lives on the Profile tab, under Videos & music — the user folded the
   seventh tab away on 2026-09-12 because seven did not fit a phone. Same section,
   same lock, same orders list; only the tab is gone. */
function merchSection(){
  const items=MERCH||[];
  const list=`<div class="sec"><span class="kick">Your merch</span><span class="kick">${items.length}/12</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Shows on your community page. Fans pay you directly through Stripe — MySet takes your plan’s cut, Stripe takes its fee from your side. An item with a link sells wherever that link goes instead.</p>
    ${!D.paymentsEnabled?`<div class="row muted">Fans can’t pay by card until Stripe is set up on the <b>Money</b> tab — items with a link still sell, and everything shows.</div>`:''}
    <div class="list">${items.map(m=>`<div class="row">
        <div class="slotmini" style="background-image:url('${esc(m.img||'')}')">${m.img?'':'＋'}</div>
        <div class="m"><div class="t">${esc(m.title)}${m.on===false?' <span class="s">· off</span>':''}</div>
          <div class="s">${m.cents?money(m.cents):'No price'} · ${m.ship==='ship'?'Posted':'Pickup at the show'}${m.link?' · link':''}</div></div>
        <button class="act" onclick="openMerch('${esc(m.id)}')">Edit</button>
        <button class="act warn" onclick="rmMerch('${esc(m.id)}')">✕</button></div>`).join('')||'<div class="row muted">Nothing yet. Add a tee, a print, a sticker.</div>'}</div>
    <div class="wrap" style="margin-top:14px"><button class="big alt" onclick="openMerch('')">+ Add an item</button></div>`;
  return `${lock('merch', list, 'Merch on your page is part of Bar Star — $10 a month. Anything you add stays saved.')}
    ${ordersSection()}`;
}
/* ---------- THE BOOKS -------------------------------------------------------
   Two cards. "Your earnings" is every artist's and every venue's; "MySet's books"
   is the founder's only and is a real P&L — what came in, minus what Perry types
   in for hosting and email, because a profit line with no costs in it is a number
   that makes you feel good rather than a number you can act on.

   Every figure here comes from Stripe's balance transactions and is only added up,
   never worked out (see _ledger.mjs). So the page never has an opinion about what a
   payment was worth; if Stripe says 47¢, this says 47¢. */
async function loadLedger(force){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'ledger',months:12,force:!!force}),quiet:true});
  if(d){ LEDGER=d; if(TAB==='money'&&D)render(); }
  if(PLAN&&PLAN.owner&&!BOOKS) loadBooks(force);
}
async function loadBooks(force){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'books',months:12,force:!!force}),quiet:true});
  if(d&&d.ok){ BOOKS=d; if(TAB==='money'&&D)render(); }
}
const m$=(c)=>{const n=(Number(c)||0)/100;const s=n<0?'-':'';const a=Math.abs(n);
  return s+'$'+a.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});};
const mlabel=(k)=>{const d=new Date(Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,1));
  return d.toLocaleDateString(undefined,{month:'short',year:'numeric',timeZone:'UTC'});};

function earningsCard(){
  const L=LEDGER;
  if(!L) return `<div class="sec"><span class="kick">Your earnings</span></div>
    <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Adding it up…</div></div>`;
  if(!L.ok||!L.enabled) return `<div class="sec"><span class="kick">Your earnings</span></div>
    <div class="list"><div class="row muted">Nothing to add up yet — this fills in once card payments are on and somebody has paid.</div></div>`;
  const rows=(L.months||[]).filter(m=>m.count||m.gross||m.payouts);
  const t=L.total||{};
  return `
  <div class="sec"><span class="kick">Your earnings · last 12 months</span><span class="kick">${m$(t.net)}</span></div>
  <div class="stats money">
    <div class="c"><b class="mono">${m$(t.gross)}</b><span>Fans paid</span></div>
    <div class="c"><b class="mono">${m$(-(t.stripeFee||0)-(t.platformFee||0))}</b><span>Fees</span></div>
    <div class="c"><b class="mono acc">${m$(t.net)}</b><span>Yours</span></div>
  </div>
  ${earnChart(L)}
  ${rows.length?`<div class="list">${rows.map(m=>`<div class="row">
    <div class="m"><div class="t">${mlabel(m.month)}</div>
      <div class="s">${m.count} payment${m.count===1?'':'s'} · ${m$(m.gross)} taken · ${m$(m.stripeFee)} Stripe${m.platformFee?` · ${m$(m.platformFee)} MySet`:''}${m.payouts?` · ${m$(-m.payouts)} paid out`:''}</div></div>
    <div class="cnt mono">${m$(m.net)}</div></div>`).join('')}</div>`
   :`<div class="list"><div class="row muted">No payments in the last twelve months.</div></div>`}
  <div class="wrap" style="margin-top:12px">
    <button class="big alt" onclick="downloadLedger()">Download it as a spreadsheet</button>
    <p class="muted" style="font-size:12px;margin:8px 0 0">Every figure comes straight from Stripe — the same numbers your bank sees. “Yours” is after both fees. Hand the file to whoever does your tax.${PLAN&&PLAN.owner?' <b>Your gigs only</b> — subscriptions other artists pay MySet are kept out of this and live in the books below.':''}</p>
    <button class="act" style="margin-top:10px" onclick="loadLedger(true)">↺ Check again</button>
  </div>
  ${revDonut(REV)}
  <div class="wrap" style="margin-top:12px"><button class="btn-grey btn-block" onclick="openEarnTips()">Quick tips for earning more</button></div>`;
}

/* Twelve bars, oldest on the left. Padded to twelve from the newest key the ledger
   sent, so an artist who joined in March still sees a full year with nine hairlines.
   Cents in, dollars on the label; a month that lost money draws as a hairline. */
function earnChart(L){
  const by={}; (L.months||[]).forEach(m=>{by[m.month]=m;});
  const newest=(L.months||[])[0]; if(!newest) return '';
  let y=+newest.month.slice(0,4), mo=+newest.month.slice(5,7);
  const keys=[]; for(let i=0;i<12;i++){ keys.unshift(`${y}-${String(mo).padStart(2,'0')}`); if(--mo<1){mo=12;y--;} }
  const vals=keys.map(k=>Math.max(0,(by[k]&&by[k].net)||0));
  const max=Math.max(1,...vals);
  const W=360,H=130,top=22,base=H-2,slot=W/12,bw=18;
  const bars=keys.map((k,i)=>{
    const v=vals[i], h=v?Math.max(3,Math.round((base-top)*v/max)):0, x=i*slot+(slot-bw)/2, now=i===11;
    if(!h) return `<rect x="${x}" y="${base-1}" width="${bw}" height="1" fill="var(--hair-2)"/>`;
    return `<rect x="${x}" y="${base-h}" width="${bw}" height="${h}" rx="4" fill="${now?'url(#eg)':'var(--accent)'}" ${now?'':'opacity=".8"'}/>`
      +(now?`<text x="${x+bw/2}" y="${base-h-7}" text-anchor="middle" font-size="12" font-weight="700" fill="var(--ink)" class="mono">${m$(v)}</text>`:'');
  }).join('');
  return `<div class="echart">
    <svg viewBox="0 0 ${W} ${H}" aria-label="Net earnings by month">
      <defs><linearGradient id="eg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent-2)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
      ${bars}</svg>
    <div class="ml">${keys.map((k,i)=>`<span class="${i===11?'now':''}">${'JFMAMJJASOND'[+k.slice(5,7)-1]}</span>`).join('')}</div>
  </div>`;
}

/* Votes against tips — the split the ledger does not carry. REV is the Checkout view
   (dollars, gross, 180 days), so it is labelled as such and fails the same way the
   payments list above it does. */
function revDonut(R){
  const head=`<div class="sec"><span class="kick">Where it came from · 180 days</span></div>`;
  const note=m=>head+`<div class="list"><div class="row muted">${m}</div></div>`;
  if(!R) return note('<span class="spin"></span>&nbsp;&nbsp;Reading Stripe…');
  if(!R.ok) return note('Couldn’t reach Stripe just now.');
  if(!R.enabled) return note(PLAN&&PLAN.owner
    ? 'Card payments are off for the whole platform — the Stripe key is not set in Netlify.'
    : 'Card payments aren’t on for your page yet. Set them up under “Getting paid” above.');
  const t=R.totals||{};
  const parts=[['More votes',+t.votes||0,'var(--accent)'],['Tips',+t.tips||0,'var(--accent-2)']];
  if(+t.merch>0) parts.push(['Merch',+t.merch,'var(--good)']);
  const total=parts.reduce((a,p)=>a+p[1],0);
  if(!(total>0)) return note('No payments in the last 180 days.');
  const r=44,c=2*Math.PI*r; let off=0;
  const arcs=parts.map(p=>{const len=c*p[1]/total;
    const s=`<circle cx="56" cy="56" r="${r}" fill="none" stroke="${p[2]}" stroke-width="14" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-off}" transform="rotate(-90 56 56)"/>`;
    off+=len; return s;}).join('');
  return head+`<div class="donut">
    <svg viewBox="0 0 112 112" aria-label="Votes against tips">${arcs}
      <text x="56" y="54" text-anchor="middle" font-size="15" font-weight="700" fill="var(--ink)" class="mono">$${total.toFixed(2)}</text>
      <text x="56" y="70" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--faint)">total</text></svg>
    <div class="lg">${parts.map(p=>`<div><span><i style="background:${p[2]}"></i>${p[0]}</span><b class="mono">$${p[1].toFixed(2)}</b><small>${Math.round(100*p[1]/total)}%</small></div>`).join('')}</div>
  </div>`;
}

function openEarnTips(){
  const s=D&&D.show;
  const fv=s&&!s.unlimited&&s.freeCredits>0?`${s.freeCredits} free vote${s.freeCredits===1?'':'s'}`:'their free votes';
  const tips=[
    ['Print the QR big at the door and on the tip jar','The two places every person in the room looks at least once. Big enough to scan from a metre away.'],
    ['Put a QR table tent on every table','People vote from their seat, not the bar. A folded card on each table gets the whole room on the board.'],
    ['Open the night in one breath','<em>“Scan the code on your table — you pick what I play next.”</em> Say it, then play. No walkthrough.'],
    ['Frame the evening as theirs','<em>“You’re building tonight’s setlist.”</em> A room that owns the list votes for it, and tips the person playing it.'],
    ['Read the top of the board out loud between songs','Say the leader and the one chasing it. The people who want the runner-up will pay to push it over.'],
    ['Thank the room for a tip from the stage','A tip lands under Recent tips on the Live tab, with any note the person left. Read the note out — a thank-you from the mic is worth more than the tip, and the table next to them hears it too.'],
    ['Tap Last call before the final set','Every phone in the room counts ten seconds down. Say <em>“last votes for this set”</em> as it runs — a deadline you can see moves the people who were only thinking about it.'],
    [`Mention that ${fv} reset every show`,'Nobody saves votes for later. Say it once near the start and again at the break.'],
    ['Show the merch and community link at the break','The pause is when phones come out. Point at the code, name the thing to buy, keep the set moving.']
  ];
  openSheet(`<h3>Earn more tonight</h3>
    <p class="lede">Nine things that cost nothing and move the number on this tab.</p>
    <ul class="earnlist">${tips.map(t=>`<li><b>${t[0]}</b>${t[1]}</li>`).join('')}</ul>
    <button class="big alt" style="margin-top:8px" onclick="closeSheet();setTab('settings')">Codes to print</button>`);
}

async function downloadLedger(){
  try{
    const r=await fetch(`${API}/admin`,{method:'POST',headers:hdrs(),
      body:JSON.stringify({action:'ledgerCsv',months:12})});
    if(!r.ok){ toast('Couldn’t build that just now'); return; }
    const blob=await r.blob(), u=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=u; a.download='myset-earnings.csv'; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000);
  }catch(e){ toast('Couldn’t build that just now'); }
}

/* THE FOUNDER'S P&L. Not shown to anybody else, and the server refuses it as well
   as the page hiding it (admin.mjs OWNER_ONLY + the founder check) — INVARIANT 15k:
   a limit that only the page enforces is not a limit. */
function booksCard(){
  if(!PLAN||!PLAN.owner) return '';
  const B=BOOKS;
  if(!B) return `<div class="sec"><span class="kick">MySet’s books</span></div>
    <div class="list"><div class="row muted"><span class="spin"></span>&nbsp;&nbsp;Reading the balance…</div></div>`;
  if(!B.enabled) return `<div class="sec"><span class="kick">MySet’s books</span></div>
    <div class="list"><div class="row muted">The Stripe key isn’t set in Netlify, so there is nothing to read.</div></div>`;
  const rows=B.months||[], t=B.total||{};
  const KIND={hosting:'Hosting',email:'Email',domain:'Domain',software:'Software',contractor:'People',other:'Other'};
  return `
  <div class="sec"><span class="kick">MySet’s books · last 12 months</span><span class="kick">${m$(t.profit)}</span></div>
  <div class="stats">
    <div class="c"><b class="mono">${m$(t.net)}</b><span>Came in</span></div>
    <div class="c"><b class="mono">${m$(t.spend)}</b><span>Went out</span></div>
    <div class="c"><b class="mono ${(t.profit||0)>=0?'acc':''}">${m$(t.profit)}</b><span>Kept</span></div>
  </div>
  <div class="list">${rows.map(m=>`<div class="row" data-act="bookmonth" data-id="${m.month}" style="cursor:pointer">
    <div class="m"><div class="t">${mlabel(m.month)}</div>
      <div class="s">${m$(m.gross)} in · ${m$(m.stripeFee)} to Stripe · ${m$(m.spend)} costs${
        Object.keys(m.costs||{}).length?' ('+Object.keys(m.costs).map(k=>KIND[k]||k).join(', ')+')':' — none recorded'}</div></div>
    <div class="cnt mono" style="color:${(m.profit||0)>=0?'var(--good)':'var(--accent)'}">${m$(m.profit)}</div>
    <button class="act" data-act="bookmonth" data-id="${m.month}">Costs</button></div>`).join('')}</div>
  <div class="wrap" style="margin-top:12px">
    <p class="muted" style="font-size:12px;margin:0 0 10px">“Came in” is subscriptions plus MySet’s cut of what fans paid artists, after Stripe’s own fee — read from Stripe’s balance, so it is what actually landed. “Went out” is what you type in below, because nothing can read your Netlify bill for you.</p>
    <button class="big alt" onclick="booksCsv()">Download the books</button>
    <button class="act" style="margin-top:10px" onclick="loadBooks(true)">↺ Check again</button>
  </div>`;
}

async function booksCsv(){
  try{
    const r=await fetch(`${API}/admin`,{method:'POST',headers:hdrs(),
      body:JSON.stringify({action:'books',months:12,csv:true})});
    if(!r.ok){ toast('Couldn’t build that just now'); return; }
    const blob=await r.blob(), u=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=u; a.download='myset-books.csv'; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(()=>URL.revokeObjectURL(u),4000);
  }catch(e){ toast('Couldn’t build that just now'); }
}

function costSheet(month){
  const m=((BOOKS&&BOOKS.months)||[]).find(x=>x.month===month)||{costs:{}};
  const KIND={hosting:'Hosting (Netlify)',email:'Email (Resend)',domain:'Domain',
              software:'Software',contractor:'People you paid',other:'Anything else'};
  openSheet(`<h3>What ${mlabel(month)} cost</h3>
    <p class="lede">Whole dollars or cents, whichever you have. Leave one blank to remove it.</p>
    ${Object.keys(KIND).map(k=>`<div class="field"><label>${KIND[k]}</label>
      <input class="inp" id="ck_${k}" inputmode="decimal" placeholder="0.00"
        value="${(m.costs&&m.costs[k])?((m.costs[k].cents/100).toFixed(2)):''}"></div>`).join('')}
    <button class="big" style="margin-top:14px" onclick="saveCosts('${month}')">Save</button>
    <button class="big alt" style="margin-top:10px" onclick="closeSheet()">Cancel</button>`);
}
async function saveCosts(month){
  const kinds=['hosting','email','domain','software','contractor','other'];
  for(const k of kinds){
    const el=document.getElementById('ck_'+k); if(!el) continue;
    const cents=Math.round((parseFloat(el.value)||0)*100);
    await api('/admin',{method:'POST',body:JSON.stringify({action:'bookCost',month,kind:k,cents}),quiet:true});
  }
  closeSheet(); BOOKS=null; await loadBooks(); toast('Saved');
}

function ordersSection(){
  const o=ORDERS||[]; const open=o.filter(x=>x.status!=='done');
  return `<div class="sec"><span class="kick">Orders</span><span class="kick">${open.length?open.length+' to do':o.length}</span></div>
    <div class="list">${o.slice(0,40).map(x=>`<div class="row ${x.status==='done'?'muted':''}">
      <div class="m"><div class="t">${esc(x.title)}${x.qty>1?' × '+x.qty:''} · $${Number(x.amount||0).toFixed(2)}</div>
        <div class="s">${x.ship==='ship'?'Posted':'Pickup'} · ${when(x.at)}${x.status==='done'?' · done':''}</div></div>
      <button class="act" onclick="orderDetail('${esc(x.sid)}')">Details</button>
      <button class="act" onclick="orderDone('${esc(x.sid)}',${x.status==='done'?'false':'true'})">${x.status==='done'?'Undo':'Done'}</button></div>`).join('')
      ||'<div class="row muted">No orders yet. They land here the moment somebody pays.</div>'}</div>`;
}
let mcShip='pickup', mcOn=true;
function openMerch(id){
  const m=(MERCH||[]).find(x=>x.id===id)||{title:'',blurb:'',cents:0,link:'',ship:'pickup',on:true,img:''};
  mcShip=m.ship||'pickup'; mcOn=m.on!==false;
  openSheet(`<h3>${id?'Edit item':'Add an item'}</h3>
    ${id?`<div class="slots" style="margin:6px 0 10px">${slotBox(id,m.img,'sq')}</div>`:'<p class="lede">Save it first, then add a picture.</p>'}
    <div class="field"><label>Name</label><input class="inp" id="mcTitle" maxlength="60" value="${esc(m.title)}" placeholder="Tour tee"></div>
    <div class="field"><label>A line about it</label><input class="inp" id="mcBlurb" maxlength="160" value="${esc(m.blurb)}" placeholder="Black, all sizes"></div>
    <div class="field"><label>Price (USD) — blank for “ask at the show”</label><input class="inp" id="mcPrice" inputmode="decimal" value="${m.cents?(m.cents/100):''}" placeholder="25"></div>
    <div class="field"><label>Or a link to where it sells (optional)</label><input class="inp" id="mcLink" value="${esc(m.link)}" placeholder="https://…"></div>
    <div class="row"><div class="m"><div class="t">How they get it</div><div class="s">Posted asks for an address at checkout</div></div>
      <div class="tog"><button id="mcPick" class="${m.ship!=='ship'?'on':''}" onclick="mcShip='pickup';this.classList.add('on');document.getElementById('mcPost').classList.remove('on')">Pickup</button>
      <button id="mcPost" class="${m.ship==='ship'?'on':''}" onclick="mcShip='ship';this.classList.add('on');document.getElementById('mcPick').classList.remove('on')">Posted</button></div></div>
    <div class="row"><div class="m"><div class="t">On the page</div></div>
      <div class="tog"><button id="mcOn" class="${m.on!==false?'on':''}" onclick="mcOn=true;this.classList.add('on');document.getElementById('mcOff').classList.remove('on')">On</button>
      <button id="mcOff" class="${m.on===false?'on':''}" onclick="mcOn=false;this.classList.add('on');document.getElementById('mcOn').classList.remove('on')">Off</button></div></div>
    <button class="big" style="margin-top:14px" onclick="saveMerch('${esc(id)}')">Save</button>`);
  setTimeout(()=>{const e=document.getElementById('mcTitle'); if(e&&!id)e.focus();},260);
}
async function saveMerch(id){
  const v=k=>(document.getElementById(k)||{}).value||'';
  const cents=Math.round(parseFloat(v('mcPrice'))*100)||0;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'merchSave',item:{id:id||undefined,title:v('mcTitle'),blurb:v('mcBlurb'),cents,link:v('mcLink'),ship:mcShip,on:mcOn}})});
  if(!d.ok){toast(d.error||'Couldn’t save');return;}
  MERCH=d.merch; closeSheet(); render(); toast('Saved');
  if(!id) setTimeout(()=>openMerch(d.id),350);       // straight into the picture slot
}
async function rmMerch(id){
  if(!confirm('Remove this item?'))return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'merchRemove',id})});
  if(d.ok){MERCH=d.merch;render();toast('Removed');}
}
async function orderDone(sid,done){ const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'orderDone',sid,done})}); if(d.ok){ORDERS=d.orders;render();} }
async function orderDetail(sid){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'orderDetail',sid})});
  if(!d.ok){toast(d.error||'Couldn’t fetch that');return;}
  const o=d.order, b=d.buyer||{}, sh=d.shipping;
  const addr=sh?[sh.name,sh.line1,sh.line2,sh.city,sh.state,sh.postal,sh.country].filter(Boolean).join(', '):'';
  openSheet(`<h3>${esc(o.title)}${o.qty>1?' × '+o.qty:''}</h3><p class="lede">$${Number(o.amount||0).toFixed(2)} · ${when(o.at)}</p>
    <div class="list" style="margin-top:12px">
      <div class="row"><div class="m"><div class="t">${esc(b.name||'Name not given')}</div><div class="s">${esc(b.email||'')}</div></div></div>
      ${sh?`<div class="row"><div class="m"><div class="t">Post to</div><div class="s">${esc(addr)}</div></div>
        <button class="act" data-copy="${esc(addr)}" onclick="navigator.clipboard&&navigator.clipboard.writeText(this.getAttribute('data-copy'));toast('Copied')">Copy</button></div>`
        :`<div class="row muted">Pickup — hand it over at a show.</div>`}
    </div>
    <p class="fine">Fetched from Stripe just now. MySet doesn’t keep it.</p>`);
}
function commSection(){
  const s=D.show, posts=COMM||[];
  return `<div class="sec"><span class="kick">Your community page</span><span class="kick">${posts.length}</span></div>
    <p class="muted" style="font-size:12px;padding:0 14px;margin:0 0 8px">Fans rate a night, post photos and videos, and read each other. You can reply once per post, pin one, and hide anything on any plan — hiding takes it off your page at once and deletes its photos and clip, and the words can be un-hidden. Deleting the whole record for good is a Bar Star feature. <a href="${s.slug?'/'+esc(s.slug)+'/community':'/community.html'}" style="color:var(--accent);font-weight:600">See the page ↗</a></p>
    <div class="list">${posts.slice(0,30).map(p=>`<div class="row ${p.hidden?'muted':''}" style="flex-wrap:wrap">
      <div class="m" style="flex:1 1 100%"><div class="t">${esc(p.name||'Someone')}${p.stars?' <span style="color:var(--accent-2)">'+'★'.repeat(p.stars)+'</span>':''}${p.pinned?' · pinned':''}${p.hidden?' · hidden':''}${p.reports?` · <span style="color:var(--accent)">${p.reports} report${p.reports===1?'':'s'}</span>`:''}</div>
        <div class="s">${esc((p.text||'').slice(0,140))}${p.photos.length?' · '+p.photos.length+' photo'+(p.photos.length===1?'':'s'):''}${p.video?' · video':''}${p.showLabel?' · '+esc(p.showLabel):''}</div>
        ${p.reply?`<div class="s" style="color:var(--accent-2)">You: ${esc(p.reply.text)}</div>`:''}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">
        <button class="act" onclick="replyPost('${esc(p.id)}')">${p.reply?'Edit reply':'Reply'}</button>
        <button class="act" onclick="commAct('postPin','${esc(p.id)}',${p.pinned?'false':'true'})">${p.pinned?'Unpin':'Pin'}</button>
        <button class="act" onclick="${p.hidden?`commAct('postHide','${esc(p.id)}',false)`
          :`if(confirm(${JSON.stringify((p.photos.length||p.clip)?'Hide this post? It comes off your page straight away, and its photos and clip are deleted. You can un-hide the words later.':'Hide this post? It comes off your page straight away, and you can un-hide it later.')}))commAct('postHide','${esc(p.id)}',true)`}">${p.hidden?'Show':'Hide'}</button>
        ${/* Greyed rather than hidden — Perry's rule for a locked feature: show it,
             say what it needs, never pretend it isn't there. The server refuses it
             too, so this is the sign and not the lock (15k). */''}
        ${canDelete()
          ? `<button class="act warn" onclick="if(confirm('Delete this post for good? Hiding it is undoable; this is not.'))commAct('postDelete','${esc(p.id)}')">✕</button>`
          : `<button class="act" style="opacity:.5" onclick="toast('Deleting for good is a Bar Star feature — hide it instead, which is instant and undoable');openPlans()">✕ Bar Star</button>`}</div>
    </div>`).join('')||'<div class="row muted">Nothing posted yet.</div>'}</div>`;
}
/* One answer for "may this artist delete a post", read from the plan the server
   also reads. The founder bypass lives on the server (moderateAllowed); PLAN.owner
   mirrors it so the founder never sees his own feature greyed. */
const canDelete=()=>!!(PLAN&&(PLAN.owner||(PLAN.limits&&PLAN.limits.moderate)));
async function commAct(action,id,on,text){ const d=await api('/admin',{method:'POST',body:JSON.stringify({action,id,on,text})}); if(d.ok){COMM=d.posts;closeSheet();render();} else toast(d.error||'Couldn’t do that'); }
function replyPost(id){
  const p=(COMM||[]).find(x=>x.id===id)||{};
  openSheet(`<h3>Reply</h3><p class="lede">${esc((p.text||'').slice(0,160))}</p>
    <textarea class="inp" id="rpTxt" maxlength="500" style="min-height:110px">${esc(p.reply?p.reply.text:'')}</textarea>
    <button class="big" style="margin-top:14px" onclick="commAct('postReply','${esc(id)}',undefined,(document.getElementById('rpTxt')||{}).value||'')">Save</button>`);
}


/* ---------- plans, billing, the account ----------
   The sheet lists every tier in full, every time — never "everything in Plus". The
   transaction fee is in orange, and called that. Upgrading opens Stripe Checkout;
   changing a paid plan happens on the live subscription; leaving a paid plan asks
   twice and offers one month at half price, once. */
/* Every item is [the thing, what it means]. The first half is bold, the second
   is not — the founder's note: "10 shows a month" bold, the rest not.

   THE ROOM SIZE IS SAID PLAINLY ON EVERY CARD. It used to say "unlimited voters at
   each", which stopped being true the day audience caps landed, and a plan card
   that overpromises is the one place a lie costs the most. The wording is careful
   about what the number IS: the night is never cut off when more people turn up —
   it slows down and shortens the board — so the card says the room size and the
   next line says what happens past it, rather than implying a locked door. */
const TIER_COPY={
  free:{name:'Hobbyist',price:'$0',items:[
    ['10 shows a month',' \u2014 up to 200 in the room at each'],
    ['Everything fans touch',': voting, requests, birthday shout-outs, lyrics'],
    ['The song sheet',': chord charts, keys and genres'],
    ['Your page',', gig calendar and city listings'],
    ['A community page',' \u2014 fans rate the night and post photos, you reply'],
    ['Hide any post',' \u2014 instantly, and undo it'],
    ['Show history',' and your real numbers'],
    ['Keep 2,000 songs',' \u2014 50 live to the room at once'],
    ['One sign-in',''],
    ['<span class="fee">Transaction fee: 25%</span>',' on money taken through the app']]},
  plus:{name:'Bar Star',price:'$10 / month',items:[
    ['Unlimited shows',' \u2014 play as often as you like'],
    ['Rooms up to 1,000',' \u2014 a bigger night still runs, just a little calmer'],
    ['Unlimited songs',' live to the room at once'],
    ['Separate setlists',', one active per night, applied from your calendar'],
    ['Set your own vote rules',' \u2014 free votes per person, the cost of a replay'],
    ['Price your own vote packs',', requests and shout-outs'],
    ['Merch on your community page',', paid straight to you'],
    ['Delete a post for good',' \u2014 hiding is free on every plan'],
    ['The verification tick',', once you\u2019re checked'],
    ['Everything fans touch',', the song sheet, your page, calendar, community page and history'],
    ['Shows that start and end themselves',' from your calendar'],
    ['One sign-in',''],
    ['<span class="fee">Transaction fee: 10%</span>',' on money taken through the app']]},
  pro:{name:'Rock Star',price:'$20 / month',items:[
    ['Unlimited shows',' \u2014 play as often as you like'],
    ['Rooms up to 2,000',' \u2014 a bigger night still runs, just a little calmer'],
    ['Unlimited songs',' live to the room at once'],
    ['Separate setlists',', one active per night, applied from your calendar'],
    ['Set your own vote rules',' \u2014 free votes per person, the cost of a replay'],
    ['Price your own vote packs',', requests and shout-outs'],
    ['Merch on your community page',', paid straight to you'],
    ['Delete a post for good',' \u2014 hiding is free on every plan'],
    ['The verification tick',', once you\u2019re checked'],
    ['Everything fans touch',', the song sheet, your page, calendar, community page and history'],
    ['Shows that start and end themselves',' from your calendar'],
    ['Five sign-ins',' for your band'],
    ['Coming soon, included',': earnings by venue and night, a press kit, your branding, promotion in other cities'],
    ['<span class="fee">Transaction fee: 2%</span>',' on money taken through the app']]},
};
const tierList=(k)=>TIER_COPY[k].items.map(x=>`<li><b>${x[0]}</b>${x[1]||''}</li>`).join('');
const RANK={free:0,plus:1,pro:2};
function openPlans(){
  if(!PLAN||!PLAN.ok){toast('One moment…');loadPlan(true);return;}
  const cur=PLAN.plan, sub=PLAN.billing&&PLAN.billing.subscribed, comped=PLAN.comped;
  const cta=(k)=>{
    if(k===cur) return `<button class="big now" disabled>Your plan</button>`;
    if(RANK[k]>RANK[cur]) return sub?`<button class="big" onclick="changePlan('${k}')">Move to ${TIER_COPY[k].name}</button>`
                                     :`<button class="big" onclick="startCheckout('${k}')">Upgrade to ${TIER_COPY[k].name}</button>`;
    if(comped&&!sub) return `<button class="big now" disabled>Comped until ${dstamp(PLAN.until)}</button>`;
    return sub?`<button class="big alt" onclick="confirmDowngrade('${k}')">Switch to ${TIER_COPY[k].name}</button>`
              :`<button class="big now" disabled>${TIER_COPY[k].name}</button>`;
  };
  openSheet(`<div class="plansheet"><h3>Plans</h3><p class="lede">Everything in each plan, listed in full. Change any time.</p>
    ${['free','plus','pro'].map(k=>`<div class="tier">
      <div class="hd"><span>${TIER_COPY[k].name}</span><small>${TIER_COPY[k].price}</small></div>
      <ol>${tierList(k)}</ol>
      <div class="cta">${cta(k)}</div></div>`).join('')}
    <p class="fine">Stripe handles the card. Cancel any time; a paid month is always yours to the end.</p></div>`);
}
async function startCheckout(plan){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planCheckout',plan})});
  if(!d.ok||!d.url){toast(d.error||'Couldn’t open checkout');return;}
  location.href=d.url;
}
async function changePlan(plan){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planChange',plan})});
  if(!d.ok){toast(d.error||'Couldn’t change that');return;}
  closeSheet(); await loadPlan(true); toast(plan==='free'?'Done — your plan runs to the end of the month you paid for':'Done — you’re on '+TIER_COPY[plan].name);
}
function confirmDowngrade(plan){
  const cur=TIER_COPY[PLAN.plan].name;
  openSheet(`<div class="dg"><h3>Are you sure you want to lose your ${cur} membership benefits?</h3>
    <p class="lede">You’d be switching to ${TIER_COPY[plan].name}.</p>
    <button class="big no" style="margin-top:16px" onclick="closeSheet()">No, keep ${cur}</button>
    <button class="big yes" style="margin-top:10px" onclick="retentionOffer('${plan}')">Yes, switch to ${TIER_COPY[plan].name}</button></div>`);
}
async function retentionOffer(plan){
  if(PLAN.billing&&PLAN.billing.retentionUsed){ changePlan(plan); return; }
  api('/admin',{method:'POST',body:JSON.stringify({action:'planRetainOffered'}),quiet:true});
  openSheet(`<div class="dg"><h3>We’re sad to see you go…</h3>
    <p class="lede">Would you like to keep your plan for <b>50% off</b> for 1 more month?</p>
    <button class="big no" style="margin-top:16px" onclick="keepPlan()">Yes — keep it, half price this month</button>
    <button class="big yes" style="margin-top:10px" onclick="changePlan('${plan}')">No thanks, switch to ${TIER_COPY[plan].name}</button></div>`);
}
async function keepPlan(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planRetain'})});
  if(!d.ok){toast(d.error||'Couldn’t apply that');return;}
  closeSheet(); await loadPlan(true); toast('Kept — this month is half price');
}
async function openPortal(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planPortal'})});
  if(!d.ok||!d.url){toast(d.error||'Couldn’t open billing');return;}
  location.href=d.url;
}
/* back from Stripe Checkout: confirm on the server, never trust the URL */
async function handleSubReturn(){
  const q=new URLSearchParams(location.search);
  /* maybeSync waits up to six hours, so an artist who has JUST fixed their card
     would come back and still be told it did not go through. */
  if(q.get('billing')==='back'){
    history.replaceState(null,'',location.pathname);
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planSync'}),quiet:true});
    PLAN=null; await loadPlan(true);
    if(d&&d.ok&&d.billing&&!d.billing.pastDue) toast('Thanks — that’s sorted');
    return;
  }
  if(q.get('sub')==='cancelled'){ toast('No change made'); history.replaceState(null,'',location.pathname); return; }
  if(q.get('sub')==='done'&&q.get('cs')){
    const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planFinish',cs:q.get('cs')}),quiet:true});
    history.replaceState(null,'',location.pathname);
    if(d.ok){ PLAN=null; await loadPlan(true); toast('Welcome to '+(TIER_COPY[d.plan]||{}).name); }
    else toast(d.error||'Couldn’t confirm the payment — it may still land in a minute');
  }
}
async function exportAccount(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'accountExport'})});
  if(!d.ok){toast(d.error||'Couldn’t export');return;}
  const blob=new Blob([JSON.stringify(d.data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`myset-${(D&&D.show&&D.show.slug)||'account'}-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
/* TWO SCREENS, THEN THIRTY DAYS. Perry asked for a double confirmation and for
   the data to be kept, and both are now true: the first tap only starts a clock,
   nothing is erased for a month, and one tap in the banner brings it all back. */
function deleteAccount(){
  openSheet(`<h3>Delete your account?</h3>
    <p class="lede">Your page goes offline straight away. We keep everything for 30 days in case you change your mind, then it’s gone for good.</p>
    <button class="big alt" style="margin-top:16px" onclick="closeSheet()">Keep my account</button>
    <button class="big" style="margin-top:10px;background:var(--accent-2);color:#fff" onclick="deleteAccountConfirm()">Yes, delete my account</button>`);
}
function deleteAccountConfirm(){
  openSheet(`<h3>Last check.</h3>
    <p class="lede">Your page, songs, gig history, photos and community posts. Your plan is cancelled today, so you won’t be charged again.</p>
    <div class="field"><label>Type DELETE to confirm</label><input class="inp" id="delWord" autocapitalize="characters" autocomplete="off" placeholder="DELETE"></div>
    <button class="big" style="margin-top:14px;background:var(--accent)" onclick="deleteAccountNow()">Delete for good</button>
    <button class="big alt" style="margin-top:10px" onclick="closeSheet()">Keep my account</button>`);
}
async function deleteAccountNow(){
  const w=(document.getElementById('delWord')||{}).value||'';
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'accountDelete',confirm:w})});
  if(!d.ok){toast(d.error||'Couldn’t delete');return;}
  closeSheet(); PLAN=null; await loadPlan(true); render();
  toast('Your page is offline. You have until '+daystamp(d.purgeAt)+' to change your mind.');
}
async function undelete(){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'accountUndelete'})});
  if(!d.ok){toast(d.error||'Couldn’t undo that');return;}
  PLAN=null; await loadPlan(true); render();
  toast(d.slugLost?'Your page is back, but its address was taken — pick a new one in Settings.':'Your page is back.');
}
async function freePageAddress(){
  if(!confirm('Your page address becomes free for someone else to take. You can still undo the deletion, but your page would need a new address.'))return;
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'accountFreeSlug'})});
  if(!d.ok){toast(d.error||'Couldn’t do that');return;}
  toast('Freed. Somebody else can take it now.');
}
/* The banner that has to be on every tab, because a tab that forgets it is a tab
   where somebody quietly loses their page. */
function leavingBar(){
  const del=PLAN&&PLAN.del;
  if(!del)return '';
  return `<div class="paybar">
    <b>Your account is being deleted on ${daystamp(del.purgeAt)}</b>
    <p>Everything is still here — your songs, gigs, history and photos. Nothing has been erased.</p>
    <button class="big" style="margin-top:12px" onclick="undelete()">Undo, keep my page</button>
    ${del.slugFreed?'':`<p style="margin-top:10px"><a href="#" onclick="event.preventDefault();freePageAddress()">Free up my page address now</a></p>`}</div>`;
}
/* "Your card didn't go through." Zero extra calls — the state is already in the
   plan payload. Never shown over a live show except in Settings: a bar about a
   card at 11pm on stage is the wrong pixel at the wrong moment, and the three days
   of grace mean it can wait until the set is over (INVARIANT 16). */
function cardTrouble(s){
  const B=(PLAN&&PLAN.billing)||{};
  if(!B.pastDue)return '';
  if(s&&s.status==='live'&&TAB!=='settings')return '';
  const ends=Number(B.graceUntil||PLAN.until||0);
  const days=ends?Math.ceil((ends-Date.now())/86400000):0;
  const fix=B.subscribed?`onclick="openPortal()"`:`onclick="startCheckout('${(B.plan||'pro')}')"`;
  if(days>1) return `<div class="paybar">
    <b>Your card didn’t go through</b>
    <p>We couldn’t take this month’s payment. It’s almost always an expired card or a bank asking a question — nothing on your page has changed.</p>
    <button class="big" style="margin-top:12px" ${fix}>Update my card</button>
    <p style="margin-top:8px">Everything keeps working until ${daystamp(ends)}.</p></div>`;
  if(days>=0) return `<div class="paybar">
    <b>Your card still hasn’t gone through</b>
    <p>If it isn’t sorted by tomorrow your page goes back to Hobbyist. <b>Nothing gets deleted</b> — your songs, gigs, history, photos and community page all stay exactly as they are. What changes is ${PLAN.plans&&PLAN.plans.free&&PLAN.plans.free.gigs?PLAN.plans.free.gigs:10} shows a month, merch comes off your community page, MySet’s cut goes back to ${PLAN.plans&&PLAN.plans.free?PLAN.plans.free.cutPct:25}%, and you couldn’t make new setlists or set your own prices.</p>
    <button class="big" style="margin-top:12px" ${fix}>Update my card</button></div>`;
  return `<div class="paybar">
    <b>You’re on Hobbyist for now</b>
    <p>The payment never went through, so your page went back to Hobbyist. Nothing was deleted — your songs, gigs, history and photos are all still here. Put a card back on and everything switches straight back on.</p>
    <button class="big" style="margin-top:12px" ${fix}>Put a card back on</button></div>`;
}

/* The line under the plan button. It is NEVER blank. A comped or free account has
   no Stripe customer, so `billing.portal` is false and the receipts link is not
   shown — which is why Perry, who is comped, could not find it. Now the line says
   what is true for him instead of vanishing.
   The date comes from Stripe's period end, not from `planUntil`: planUntil carries
   three days of grace for a late card, and telling somebody they renew three days
   after they actually do is a small lie the app should not tell. */
function planWhen(){
  if(!PLAN||!PLAN.ok)return '';
  const b=PLAN.billing||{}, name=esc(PLAN.limits.label);
  const link=b.portal?` · <a href="#" onclick="event.preventDefault();openPortal()">Card, invoices and receipts ↗</a>`:'';
  if(PLAN.comped) return `${name}, on the house${PLAN.until?' until '+daystamp(PLAN.until):''}`;
  if(PLAN.plan==='free') return 'Hobbyist — free, forever'+(PLAN.discountPct?` · ${PLAN.discountPct}% off saved for your first month`:'');
  const when=b.renewsAt||PLAN.until;
  if(when) return `${b.cancelAtPeriodEnd?'Ends':'Renews'} ${daystamp(when)}${link}`;
  return `Active${link}`;
}
async function loadPlan(force){
  if(PLAN&&!force)return;
  PLAN=await api('/admin',{method:'POST',body:JSON.stringify({action:'planGet'}),quiet:true});
  /* Any tab can hold a lock now, not just Settings, so any tab needs the repaint. */
  if(D)render();
  /* The owner's two lists are Settings-only data. They used to be awaited here, in
     series, NOT quiet — four round-trips before Perry's own Live tab was allowed to
     appear, with the busy veil painted over the boot screen for the last two. Now
     they load behind the page and repaint Settings if that is where he is. */
  if(PLAN&&PLAN.owner&&(!PROMOS||!VENUES)) (async()=>{
    const q=(action)=>api('/admin',{method:'POST',body:JSON.stringify({action}),quiet:true});
    const [pr,ve]=await Promise.all([PROMOS?null:q('promoList'),VENUES?null:q('venueList')]);
    if(pr)PROMOS=pr; if(ve)VENUES=ve;
    if(D&&TAB==='settings')render();
  })();
}
async function redeemPromo(){
  const code=(($('#promoIn')||{}).value||'').trim();
  if(!code){toast('Enter a code');return;}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'promoRedeem',code})});
  if(!d.ok){toast(d.error||'Could not apply that');return;}
  PLAN=null; await loadPlan(true); render();
  toast(d.comped?`You're on ${d.plan} for ${d.months} months`:`${d.pct}% off saved for billing`);
}
async function createPromo(){
  const v=x=>(($('#'+x)||{}).value||'').trim();
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'promoCreate',
    code:v('pcCode'),pct:v('pcPct'),plan:v('pcPlan'),months:v('pcMonths'),maxUses:v('pcMax')})});
  if(!d.ok){toast(d.error||'Could not create that');return;}
  PROMOS=d; $('#pcCode').value=''; render(); toast('Code created');
}
async function togglePromo(code){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'promoRevoke',code})});
  if(!d.ok){toast(d.error||'Failed');return;}
  PROMOS=d; render();
}
async function verifyVenue(vid){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'venueVerify',venue:vid})});
  if(!d.ok){toast(d.error||'Failed');return;}
  VENUES=d; render();
  const v=(d.venues||[]).find(x=>x.venueId===vid);
  toast(v&&v.verified?'Verified':'No longer verified');
}
async function loadTeam(force){
  if(TEAM&&!force)return;
  TEAM=await api('/auth',{method:'POST',body:JSON.stringify({action:'list'}),quiet:true});
  if((TAB==='settings'||isNew())&&D&&!typing())render();
}
function copyRef(){
  const el=$('#refLink'); if(!el)return;
  el.select();
  try{ navigator.clipboard.writeText(el.value); toast('Link copied'); }
  catch(e){ document.execCommand('copy'); toast('Link copied'); }
}
async function saveSlug(){
  const v=(($('#slugIn')||{}).value||'').trim();
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'setSlug',slug:v})});
  if(!d.ok){toast(d.error||'Could not save that');return;}
  TEAM=d; render(); toast(`Your page is now myset.vip/${d.slug}`);
}
async function addTeam(){
  const el=$('#teamEmail'), em=(el.value||'').trim();
  if(!em){toast('Enter an email');return;}
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'add',email:em})});
  if(!d.ok){toast(d.error||'Could not add that');return;}
  el.value=''; TEAM=d; render(); toast(`${em} can sign in now`);
}
async function removeTeam(email){
  if(!confirm('Stop '+email+' signing in?'))return;
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'remove',email})});
  if(!d.ok){toast(d.error||'Failed');return;}
  TEAM=d; render(); toast('Removed');
}
async function revokeAll(){
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'revokeAll'})});
  if(!d.ok){toast(d.error||'Failed');return;}
  toast('Every device signed out'); signOut();
}
/* THE CLIENT SAID FOUR AND THE SERVER HAS ALWAYS REFUSED UNDER EIGHT. Somebody
   who did exactly what the box told them got an error. One number now. */
function openCodeSheet(){
  openSheet(`<h3>${TEAM&&TEAM.codeSet?'Change your studio code':'Set a studio code'}</h3>
    <p class="lede">A code for this page, so you can get in from any phone even when email is slow.</p>
    <div class="field"><label>New code</label><input class="inp" id="fCode" type="password" placeholder="At least 8 characters" autocomplete="new-password"></div>
    <p class="muted" style="font-size:12px;margin:8px 0 0">At least 8 characters, not your page name, and not the same character over and over.</p>
    <button class="big" style="margin-top:14px" onclick="saveCode()">Save it</button>
    <p class="muted" style="font-size:12px;margin:12px 0 0">${PLAN&&PLAN.owner
      ? 'The original code from Netlify keeps working as a backup, so you can never lock yourself out.'
      : 'Forget it and you can still sign in with your email, or with a recovery code.'}</p>`);
}
async function saveCode(){
  const el=$('#fCode'), v=(el.value||'').trim();
  if(v.length<8){toast('At least 8 characters');return;}
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'setCode',code:v})});
  if(!d.ok){toast(d.error||'Could not save that');return;}
  CODE=v; localStorage.setItem('myset.admin',v); el.value='';
  closeSheet(); TEAM=null; loadTeam(true);
  toast('Saved \u2014 that\u2019s your code from now on');
}

/* ---------- where you are signed in ----------
   Fetched on the tap, never on boot and never on the four-second Live poll: every
   call costs credits, which is the whole argument in the founder's note above. */
async function openSessions(){
  openSheet(`<h3>Where you\u2019re signed in</h3><p class="lede"><span class="spin"></span> Looking\u2026</p>`);
  SESS=await api('/auth',{method:'POST',body:JSON.stringify({action:'sessions'})});
  drawSessions();
}
function drawSessions(){
  if(!SESS||!SESS.ok){ openSheet(`<h3>Where you\u2019re signed in</h3><p class="lede">Couldn\u2019t read that just now.</p>`); return; }
  const when=t=>{ if(!t)return ''; const d=Math.floor((Date.now()-t)/86400000);
    return d<=0?'today':d===1?'yesterday':d<30?d+' days ago':daystamp(t); };
  const rows=SESS.list.map(x=>`<div class="row">
    <div class="m"><div class="t">${x.current?'This phone':esc(x.label)}</div>
      <div class="s">${x.current?esc(x.label)+' · ':''}signed in ${when(x.at)}${x.email?' · '+esc(x.email):''}</div></div>
    ${x.current?`<button class="act" onclick="closeSheet();signOut()">Sign out</button>`
              :`<button class="act warn" onclick="revokeSession('${esc(x.sid)}')">Sign out</button>`}</div>`).join('');
  openSheet(`<h3>Where you\u2019re signed in</h3>
    <p class="lede">Every phone and laptop with a live sign-in. Signing one out is instant.</p>
    <div class="list">${rows||'<div class="row muted">Nothing to show yet.</div>'}
    ${SESS.legacy?`<div class="row muted"><div class="m"><div class="t">An older sign-in</div>
      <div class="s">This one started before MySet kept a list, so we can\u2019t tell you which device it is. Signing out everywhere clears it.</div></div></div>`:''}</div>
    <button class="big alt" style="margin-top:14px" onclick="signOutOthers()">Sign out my other devices</button>`);
}
async function revokeSession(sid){
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'sessionRevoke',sid})});
  if(!d.ok){toast(d.error||'Couldn\u2019t do that');return;}
  SESS=d; drawSessions(); toast('Signed out');
}
async function signOutOthers(){
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'signOutOthers'})});
  if(!d.ok){toast(d.error||'Couldn\u2019t do that');return;}
  SESS=d; drawSessions(); toast(d.gone?`${d.gone} device${d.gone===1?'':'s'} signed out`:'Nothing else was signed in');
}

/* ---------- recovery codes ---------- */
/* ---------- PASSKEYS -------------------------------------------------------
   Face ID / Touch ID / Windows Hello instead of a code from an email.

   Everything here is a browser API and a base64url conversion; the checking is on
   the server (_passkey.mjs), which is the only place it can honestly be done. The
   page never decides anybody is signed in — it hands a signature over and is told.

   THE CONVERSIONS ARE THE WHOLE FIDDLY PART. WebAuthn speaks ArrayBuffer and the
   wire speaks base64url, and the two are converted in opposite directions on the
   way out and the way back. Getting one of them wrong produces a signature that
   fails to verify with no useful message anywhere, so they live in two named
   functions rather than being inlined six times. */
const PKSUPPORTED = typeof PublicKeyCredential !== 'undefined'
  && !!(navigator.credentials && navigator.credentials.create);
let PKEYS=null;
const ab2u = (b)=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const u2ab = (s)=>{ const t=String(s).replace(/-/g,'+').replace(/_/g,'/'); const b=atob(t+'==='.slice((t.length+3)%4));
  const out=new Uint8Array(b.length); for(let i=0;i<b.length;i++) out[i]=b.charCodeAt(i); return out.buffer; };

async function loadPasskeys(force){
  if(!PKSUPPORTED) return;
  /* Remember the page address, because the Face ID door needs to know WHICH page
     before it can ask the phone — a passkey belongs to a page, and the sign-in
     screen has no idea who you are yet. Written here rather than at sign-in
     because this is the one place that runs only when somebody is really in. */
  try{ if(TEAM&&TEAM.slug) localStorage.setItem('myset.slug',TEAM.slug); }catch(e){}
  if(PKEYS&&!force) return;
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'passkeyList'}),quiet:true});
  if(d&&d.ok){ PKEYS=d.keys||[]; if(TAB==='settings'&&D)render(); }
}

async function addPasskey(){
  if(!PKSUPPORTED){ toast('This browser can’t do that yet'); return; }
  const o=await api('/auth',{method:'POST',body:JSON.stringify({action:'passkeyStart'})});
  if(!o||!o.ok){ toast((o&&o.error)||'Couldn’t start that'); return; }
  let cred;
  try{
    cred=await navigator.credentials.create({publicKey:{
      challenge:u2ab(o.challenge),
      rp:{id:o.rpId,name:'MySet'},
      user:{id:u2ab(o.userId),name:o.userName,displayName:o.displayName},
      pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
      /* `platform` because the point is the phone already in their hand, and
         `required` user verification because a passkey with no face and no thumb
         behind it is just a cookie. */
      authenticatorSelection:{authenticatorAttachment:'platform',userVerification:'required',residentKey:'preferred'},
      timeout:60000, attestation:'none',
      excludeCredentials:(o.have||[]).map(id=>({type:'public-key',id:u2ab(id)})),
    }});
  }catch(e){
    toast(e&&e.name==='InvalidStateError'?'That device is already set up':'Cancelled');
    return;
  }
  if(!cred){ toast('Cancelled'); return; }
  const label=(navigator.userAgent.match(/iPhone|iPad|Android|Macintosh|Windows/)||['This device'])[0]
    .replace('Macintosh','Mac').replace('Windows','PC');
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'passkeyFinish',
    id:cred.id, label,
    clientDataJSON:ab2u(cred.response.clientDataJSON),
    attestationObject:ab2u(cred.response.attestationObject)})});
  if(!d.ok){ toast(d.error||'That didn’t take'); return; }
  PKEYS=d.keys; toast('Set up — try signing out and back in'); render();
}

async function dropPasskey(id){
  if(!confirm('Remove this device? You can always add it again.'))return;
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'passkeyForget',id})});
  if(!d.ok){ toast(d.error||'Couldn’t remove that'); return; }
  PKEYS=d.keys; render();
}

/* The fast door on the sign-in screen. Needs the page address, exactly like the
   recovery door, because a passkey belongs to a page and the gate does not yet
   know which page you are. Remembered after the first time, so it is one tap. */
async function passkeySignIn(){
  const slug=(document.getElementById('pkslug')||{}).value
    ||localStorage.getItem('myset.slug')||'';
  if(!slug){ toast('Type your page address first'); return; }
  const o=await api('/auth',{method:'POST',body:JSON.stringify({action:'passkeySignInStart',slug})});
  if(!o||!o.ok){ toast('Couldn’t start that'); return; }
  if(!(o.keys||[]).length){ toast('No Face ID set up for that page yet — use a code'); return; }
  let cred;
  try{
    cred=await navigator.credentials.get({publicKey:{
      challenge:u2ab(o.challenge), rpId:o.rpId, userVerification:'required', timeout:60000,
      allowCredentials:(o.keys||[]).map(id=>({type:'public-key',id:u2ab(id)})),
    }});
  }catch(e){ toast('Cancelled'); return; }
  if(!cred){ toast('Cancelled'); return; }
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'passkeySignInFinish', slug,
    id:cred.id,
    clientDataJSON:ab2u(cred.response.clientDataJSON),
    authenticatorData:ab2u(cred.response.authenticatorData),
    signature:ab2u(cred.response.signature)})});
  if(!d||!d.ok){ toast((d&&d.error)||'That didn’t work — use a code'); return; }
  TOKEN=d.token; localStorage.setItem('myset.token',TOKEN);
  if(d.slug) localStorage.setItem('myset.slug',d.slug);
  location.reload();
}

async function loadRecovery(force){
  if(REC&&!force)return;
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'recoveryStatus'}),quiet:true});
  if(d&&d.ok){ REC=d; if(TAB==='settings'&&D)render(); }
}
async function makeRecovery(){
  if(REC&&REC.made&&!confirm('Make eight new codes? The old ones stop working straight away.'))return;
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'recoveryMake'})});
  if(!d.ok){toast(d.error||'Couldn\u2019t make those');return;}
  const list=d.codes.join('\n');
  openSheet(`<h3>Your recovery codes</h3>
    <p class="lede">This is the only time we can show you these. Write them down, or copy them somewhere safe.</p>
    <div class="list"><div class="row"><div class="m"><div class="t mono" style="line-height:1.9;white-space:pre">${esc(list)}</div></div></div></div>
    <button class="big" style="margin-top:14px" onclick="copyText(${JSON.stringify(list)})">Copy them</button>
    <p class="fine">Each one works once. Use one to sign in at myset.vip/studio if you ever lose your email.</p>`);
  REC=null; loadRecovery(true);
}
function copyText(t){ try{navigator.clipboard.writeText(t);toast('Copied');}catch(e){toast('Select and copy them by hand');} }

/* ---------- moving your account to a new address ---------- */
function openEmailChange(){
  openSheet(`<h3>Move your account to a new address</h3>
    <p class="lede">We send a code to the new address and one to <b>${esc((PLAN&&PLAN.email)||'')}</b>. Both have to go in, so nobody can walk off with your page.</p>
    <div class="field"><label>New address</label><input class="inp" id="ecNew" type="email" inputmode="email" placeholder="you@email.com"></div>
    <button class="big" style="margin-top:14px" onclick="emailChangeStart()">Send both codes</button>`);
}
async function emailChangeStart(){
  const to=(($('#ecNew')||{}).value||'').trim();
  if(!to){toast('Which address?');return;}
  const r=await api('/auth',{method:'POST',body:JSON.stringify({action:'emailChangeStart',email:to})});
  if(!r.ok){toast(r.error||'Couldn\u2019t start that');return;}
  openSheet(`<h3>Two codes are on their way</h3>
    <p class="lede">One to <b>${esc(to)}</b>, one to <b>${esc((PLAN&&PLAN.email)||'')}</b>. Both boxes, then it moves.</p>
    <div class="field"><label>Code sent to the new address</label><input class="inp mono" id="ecA" inputmode="numeric" maxlength="6" placeholder="000000"></div>
    <div class="field"><label>Code sent to ${esc((PLAN&&PLAN.email)||'your current address')} — or a recovery code</label><input class="inp mono" id="ecB" placeholder="000000"></div>
    <button class="big" style="margin-top:14px" onclick="emailChangeFinish(${JSON.stringify(to)})">Move my account</button>`);
}
async function emailChangeFinish(to){
  const a=(($('#ecA')||{}).value||'').trim(), b=(($('#ecB')||{}).value||'').trim();
  const d=await api('/auth',{method:'POST',body:JSON.stringify({action:'emailChangeFinish',email:to,newCode:a,proof:b})});
  if(!d.ok){toast(d.error||'Couldn\u2019t move it');return;}
  if(d.token){ TOKEN=d.token; localStorage.setItem('myset.token',d.token); }
  closeSheet(); PLAN=null; TEAM=null; SESS=null; await loadPlan(true); loadTeam(true); render();
  toast('Done \u2014 your codes come to '+to+' from now on');
}

/* ---------- invoices ---------- */
async function openInvoices(){
  openSheet(`<h3>Invoices and receipts</h3><p class="lede"><span class="spin"></span> Reading Stripe\u2026</p>`);
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'planInvoices'})});
  if(!d.ok){ openSheet(`<h3>Invoices and receipts</h3><p class="lede">${esc(d.error||'Couldn\u2019t reach Stripe just now.')}</p>`); return; }
  const money=(c,cur)=>(cur==='USD'?'$':'')+(c/100).toFixed(2);
  openSheet(`<h3>Invoices and receipts</h3>
    <p class="lede">Every payment you\u2019ve made to MySet. Stripe keeps them; we just show them.</p>
    <div class="list">${d.list.map(i=>`<div class="row">
      <div class="m"><div class="t">${money(i.total,i.currency)} · ${esc(i.status)}</div>
        <div class="s">${daystamp(i.at)}${i.number?' · '+esc(i.number):''}</div></div>
      ${i.url?`<a class="act" href="${esc(i.url)}" target="_blank" rel="noopener" data-nosplash>Open ↗</a>`:''}</div>`).join('')
      ||'<div class="row muted">Nothing yet — this fills up after your first payment.</div>'}</div>`);
}
/* Photos ---------------------------------------------------------------
   A camera file is 3-5MB and none of that detail survives being drawn 130px
   wide, so the phone shrinks it before it ever goes over the wire. */
function slotBox(slot,url,shape){
  return `<label class="slot ${shape}" data-slot="${slot}">
    ${url?`<img src="${esc(url)}" alt="">
           <button type="button" class="rm" data-act="photoclear" data-id="${slot}">✕</button>`
         :`<span class="ph">
             <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="10.5" r="1.8"/><path d="M4 17l4.5-4.5 3.5 3.5 3-3L20 17"/></svg>
             Add photo</span>`}
    <input type="file" accept="image/*" data-slot="${slot}">
  </label>`;
}
async function shrink(file,max,square){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();
      i.onload=()=>res(i); i.onerror=()=>rej(new Error('bad image')); i.src=url;});
    let sx=0,sy=0,sw=img.width,sh=img.height;
    if(square){ const side=Math.min(sw,sh); sx=(sw-side)/2; sy=(sh-side)/2; sw=sh=side; }
    const scale=Math.min(1,max/Math.max(sw,sh));
    const w=Math.round(sw*scale), h=Math.round(sh*scale);
    const c=document.createElement('canvas'); c.width=w; c.height=h;
    c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,w,h);
    // step the quality down until it comfortably fits the server's limit
    for(const q of [0.82,0.7,0.58,0.45]){
      const d=c.toDataURL('image/jpeg',q);
      if(d.length*0.75 < 850*1024) return d;
    }
    return c.toDataURL('image/jpeg',0.4);
  } finally { URL.revokeObjectURL(url); }
}
/* Crop before upload. A phone photo is almost never framed for a square, and
   letting the app centre-crop it silently cuts people's heads off. */
let CROP=null;
async function openCrop(slot,file){
  const url=URL.createObjectURL(file);
  let img;
  try{
    img=await new Promise((res,rej)=>{const i=new Image();
      i.onload=()=>res(i); i.onerror=()=>rej(new Error('bad')); i.src=url;});
  }catch(e){ URL.revokeObjectURL(url); toast('Could not read that photo'); return; }

  const square=slot!=='cover';
  const W=Math.min(300, Math.round(window.innerWidth-96));
  const H=square?W:Math.round(W*10/16);
  const base=Math.max(W/img.width,H/img.height);
  CROP={slot,img,url,W,H,base,zoom:1,ox:(W-img.width*base)/2,oy:(H-img.height*base)/2};

  openSheet(`<h3>Position your photo</h3>
    <p class="lede">Drag to move, pinch or use the slider to zoom.</p>
    <div class="cropframe" id="cropFrame" style="width:${W}px;height:${H}px">
      <img id="cropImg" src="${url}" alt="" draggable="false">
      ${square?'<div class="cropguide"></div>':''}
    </div>
    <input class="zoom" id="cropZoom" type="range" min="100" max="320" value="100">
    <button class="big" style="margin-top:14px" onclick="confirmCrop()">Use this photo</button>
    <button class="act" style="margin-top:10px;width:100%" onclick="cancelCrop()">Cancel</button>`);
  paintCrop(); wireCrop();
}
function paintCrop(){
  if(!CROP)return;
  const el=document.getElementById('cropImg'); if(!el)return;
  const s=CROP.base*CROP.zoom;
  const dw=CROP.img.width*s, dh=CROP.img.height*s;
  CROP.ox=Math.min(0,Math.max(CROP.W-dw,CROP.ox));
  CROP.oy=Math.min(0,Math.max(CROP.H-dh,CROP.oy));
  el.style.width=dw+'px'; el.style.height=dh+'px';
  el.style.transform=`translate(${CROP.ox}px,${CROP.oy}px)`;
}
function wireCrop(){
  const frame=document.getElementById('cropFrame'), z=document.getElementById('cropZoom');
  if(!frame)return;
  let px=null,py=null,pinch=null;
  const pt=(e)=>e.touches?e.touches[0]:e;
  const dist=(t)=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  frame.addEventListener('touchstart',(e)=>{
    if(e.touches.length===2){ pinch={d:dist(e.touches),z:CROP.zoom}; return; }
    px=pt(e).clientX; py=pt(e).clientY;
  },{passive:true});
  frame.addEventListener('touchmove',(e)=>{
    if(!CROP)return;
    if(e.touches.length===2&&pinch){
      CROP.zoom=Math.min(3.2,Math.max(1,pinch.z*dist(e.touches)/pinch.d));
      if(z)z.value=Math.round(CROP.zoom*100);
      paintCrop(); e.preventDefault(); return;
    }
    if(px===null)return;
    const p=pt(e);
    CROP.ox+=p.clientX-px; CROP.oy+=p.clientY-py;
    px=p.clientX; py=p.clientY; paintCrop(); e.preventDefault();
  },{passive:false});
  frame.addEventListener('touchend',()=>{px=py=null;pinch=null;});
  frame.addEventListener('mousedown',(e)=>{
    px=e.clientX; py=e.clientY;
    const mm=(ev)=>{ if(px===null||!CROP)return;
      CROP.ox+=ev.clientX-px; CROP.oy+=ev.clientY-py; px=ev.clientX; py=ev.clientY; paintCrop(); };
    const mu=()=>{ px=py=null; window.removeEventListener('mousemove',mm); window.removeEventListener('mouseup',mu); };
    window.addEventListener('mousemove',mm); window.addEventListener('mouseup',mu);
  });
  if(z) z.addEventListener('input',()=>{ CROP.zoom=z.value/100; paintCrop(); });
}
function cancelCrop(){ if(CROP&&CROP.url)URL.revokeObjectURL(CROP.url); CROP=null; closeSheet(); }
async function confirmCrop(){
  if(!CROP||WRITING)return;
  WRITING=true;
  const {slot,img,W,H,base,zoom,ox,oy}=CROP;
  try{
    const s=base*zoom;
    // map the visible frame back onto the source pixels
    const sx=-ox/s, sy=-oy/s, sw=W/s, sh=H/s;
    const outW=slot==='cover'?1200:640;   // 1200 is plenty on a phone; half the bytes of 1400
    const outH=Math.round(outW*H/W);
    const c=document.createElement('canvas'); c.width=outW; c.height=outH;
    c.getContext('2d').drawImage(img,sx,sy,sw,sh,0,0,outW,outH);
    let data=null;
    for(const q of [0.84,0.72,0.6,0.46]){
      const d=c.toDataURL('image/jpeg',q);
      if(d.length*0.75<450*1024){ data=d; break; }
    }
    if(!data) data=c.toDataURL('image/jpeg',0.4);
    /* a merch item's picture: the slot IS the item id */
    if(/^m[a-z0-9]{6}$/.test(slot)){
      const r=await api('/admin',{method:'POST',body:JSON.stringify({action:'merchPhoto',id:slot,data})});
      if(!r.ok){toast(r.error||'Could not save that photo');return;}
      cancelCrop(); MERCH=r.merch; render(); toast('Photo added'); return;
    }
    const r=await api('/admin',{method:'POST',body:JSON.stringify({action:'photoUpload',slot,data})});
    if(!r.ok){toast(r.error||'Could not save that photo');return;}
    cancelCrop(); PROF=null; await loadProf(true); render(); toast('Photo added');
  }catch(e){ toast('Could not save that photo'); }
  finally{ WRITING=false; }
}
async function uploadPhoto(slot,file){
  if(!file)return;
  if(!/^image\//.test(file.type)){toast('That needs to be a photo');return;}
  await openCrop(slot,file);
}
async function clearPhoto(slot){
  const d=await api('/admin',{method:'POST',body:JSON.stringify({action:'photoClear',slot})});
  if(!d.ok){toast(d.error||'Failed');return;}
  PROF=null; await loadProf(true); render(); toast('Photo removed');
}
document.addEventListener('change',(e)=>{
  const inp=e.target.closest('input[type=file][data-slot]'); if(!inp)return;
  uploadPhoto(inp.getAttribute('data-slot'), inp.files&&inp.files[0]);
  inp.value='';
});

function wireCount(inSel,outSel,max){
  const i=$(inSel), o=$(outSel); if(!i||!o)return;
  const upd=()=>{ const left=max-i.value.length;
    o.textContent=left+' left'; o.classList.toggle('near',left<30); };
  i.addEventListener('input',upd); upd();
}
const dur=ms=>{const m=Math.round(ms/60000);return m<60?m+' min':Math.floor(m/60)+'h '+(m%60)+'m';};
const dstamp=t=>{try{return new Date(t).toLocaleString(undefined,
  {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return ''}};
/* A renewal, a purge date or an invoice is a DAY, not a moment. "Renews Sep 27,
   12:56 AM" reads like a deadline nobody agreed to. */
const daystamp=t=>{try{return new Date(t).toLocaleDateString(undefined,
  {day:'numeric',month:'short',year:'numeric'})}catch(e){return ''}};
const esc=s=>String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const when=t=>{const m=Math.floor((Date.now()-t)/60000);return m<1?'just now':m<60?m+'m ago':Math.floor(m/60)+'h ago';};
let tT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>t.classList.remove('on'),3000);}
/* A line that changes while it waits. Not decoration: a screen that says nothing
   feels broken after about a second, and this is the difference between "it's
   stuck" and "it's working". Stops the moment the Studio is up. */
const BOOTLINES=['Warming up the room','Tuning the setlist','Counting tonight\u2019s votes',
  'Checking who\u2019s playing','Setting up the stage','Almost there'];
let bootI=0, bootT=null;
function bootCycle(){
  bootT=setInterval(()=>{
    const el=document.getElementById('bootline'); if(!el)return;
    el.classList.add('fade');
    setTimeout(()=>{ bootI=(bootI+1)%BOOTLINES.length; el.textContent=BOOTLINES[bootI];
      el.classList.remove('fade'); },300);
  },1400);
}
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
/* The stopwatch: stamped once, the first time the boot screen comes down, and
   shown under Sign out on the Settings tab. `forced` means the 6 s safety timer
   ended the wait, not the data — a hang, not slowness, and the thing to chase. */
let BOOT=null;
function bootStat(){
  if(!BOOT)return '';
  const s=v=>(v/1000).toFixed(1);
  const parts=['Opened in '+s(BOOT.total)+' s','page '+s(BOOT.page)];
  if(BOOT.stage!=null)parts.push('stage '+s(BOOT.stage));
  if(BOOT.plan!=null)parts.push('plan '+s(BOOT.plan));
  return parts.join(' · ')+(BOOT.forced?' · the 6 s timer ended the wait':'');
}
function bootDone(forced){
  clearInterval(bootT);
  if(!BOOT){ const nav=(performance.getEntriesByType('navigation')||[])[0]||{}, E=window.__boot||{};
    BOOT={total:performance.now(),page:nav.responseEnd||0,stage:E.stage,plan:E.plan,forced:!!forced}; }
  const el=document.getElementById('boot'); if(!el)return;
  el.classList.add('gone');
  setTimeout(()=>el.remove(),320);        // gone for good: it can never flash again
}
function start(){clearInterval(timer);
  handleSubReturn();
  /* Whatever happens, the boot screen goes. A hung request must never leave somebody
     staring at bars — better a half-filled Studio they can use. */
  setTimeout(()=>bootDone(true),6000);
  load();
  timer=setInterval(()=>{if(!document.hidden&&TAB==='live'&&D&&D.show&&D.show.status==='live')load({quiet:true})},4000);}
/* A pull refreshes the Studio's data rather than reloading the page — no white
   flash, and the tab you were on stays the tab you are on. The installed Studio
   has no address bar and no swipe-down of its own, so without this there is no
   way at all to say "show me now". */
MySetPull(async()=>{ try{ await load(); }catch(e){} });
if(CODE||TOKEN){ bootCycle(); start(); } else gate();
