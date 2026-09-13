/* THE FOUR THINGS PERRY ASKED FOR ON 2026-09-07, DRIVEN BY A REAL BROWSER.

   Every one of them is a thing on a page — a box that must not push the layout
   around, a button that must still be there after the show ends, a ring on one
   button and not the other, an order of links. test/darkroom.mjs guards the SERVER
   half and the source of each page; this is the half that only a layout engine can
   answer, and it is where the "it exists in the HTML" checks stop being enough.

     node tools/uicheck.mjs

   Needs Chrome and puppeteer-core, which live outside this repo — same arrangement
   as tools/clipcheck.mjs and tools/sheetcheck.mjs. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import puppeteer from '/Users/perryidyll/Docs/MySet-Content/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const ROOT=process.env.MYSET_PUBLIC||'/Users/perryidyll/Docs/MySet/public';
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
/* THE MONEY TAB'S FIXTURE (decision 0065): a signed-in Bar Star owner with one
   weekly residency and three past nights of it — one logged by hand with a band, a
   cost and hours (its filed night came back without Stripe answering), one filed
   with Stripe's figure and nothing logged yet (that is "tonight", just ended), and
   one the calendar expects but nothing was filed for (listed, never counted) — and
   one record logged under a gig that has since left the calendar (listed as
   "Logged show", counted, removable). Every date is relative to today so the
   "30 days" period always holds all of them.
   The mock is two artists apart by the bearer token: `tok-b` is a second paid owner
   with an empty book, for the sign-out probe. Gigs saved through eventSave are
   kept and expanded into bizGet's occurrences, the way the server does. */
const ago=(d,h)=>{const t=new Date();t.setDate(t.getDate()-d);t.setHours(h||20,0,0,0);return t;};
const isoOf=(t)=>`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
const N1=ago(1),N2=ago(8),N3=ago(15),N4=ago(20), D1=isoOf(N1),D2=isoOf(N2),D3=isoOf(N3),D4=isoOf(N4);
const occ=(t,d)=>({eventId:'g1',date:d,startsAt:t.getTime(),endsAt:t.getTime()+3*3600000,title:'',venue:'The Room',city:'Bangkok',tz:'Asia/Bangkok',repeating:true});
const ADDED=[];   // events saved during the run, in the shape eventList and bizGet answer with
const addedOcc=(e)=>{ const [y,m,d]=e.date.split('-').map(Number), [h,mi]=(e.time||'20:00').split(':').map(Number); const t=new Date(y,m-1,d,h,mi).getTime();
  return {eventId:e.id,date:e.date,time:e.time||'20:00',startsAt:t,endsAt:t+3*3600000,title:'',venue:e.venue,city:e.city||'',country:e.country||'',tz:e.tz||'',repeating:false}; };
const night=(id,t,gross,source)=>({showId:id,title:'',venue:'The Room',city:'Bangkok',startedAt:t.getTime()+600000,endedAt:t.getTime()+3*3600000,songsPlayed:12,totalVotes:40,peakVoters:9,room:14,nets:9,gross,unattributed:0,top:null,topPlayed:null,topPaid:null,key:'g1@'+isoOf(t),source});
const LIM={free:{label:'Hobbyist',reports:false,band:0,costs:0,cutPct:25},plus:{label:'Bar Star',reports:true,band:5,costs:5,cutPct:10},pro:{label:'Rock Star',reports:true,band:10,costs:10,cutPct:2}};
const MOCK={
  stage:{ok:true,paymentsEnabled:true,voters:0,room:0,nets:0,asks:[],feedback:{},tips:{total:0,count:0,recent:[]},lists:[],tags:{builtin:[],own:[]},
    songs:[{id:'alpha',title:'Alpha',artist:'T',votes:0,paidVotes:0,active:true,votable:true,inSet:true,played:false,now:false}],
    show:{artistId:'demo',slug:'demo',artist:'Demo Artist',status:'pre',showId:'',windowOpen:true,played:[],nowPlaying:null,freeCredits:3,unlimited:false,replayCost:5,
      packs:{small:{votes:3,cents:500},big:{votes:15,cents:2000}},requests:{on:false,cost:3},birthdays:{on:false,cost:3},unlimitedFans:[],autoStart:true}},
  history:{ok:true,live:{showId:'n1',venue:'The Room',city:'Bangkok',startedAt:N1.getTime()+600000,endedAt:N1.getTime()+3*3600000,live:false,status:'ended',songsPlayed:12,totalVotes:40,peakVoters:9,gross:42.5,unattributed:0},
    shows:[night('n1',N1,42.5,'stripe'),night('n2',N2,0,'stripe-unreachable')]},
  historyB:{ok:true,live:null,shows:[]},
  revenue:{ok:true,enabled:false,payments:[],unredeemed:0,totals:{all:0,tips:0,votes:0,merch:0,count:0}},
  auth:(b)=>{
    if(b.action==='recoverySignIn') return {ok:true,token:'tok-b',slug:'other',left:7};
    return {ok:true};
  },
  admin:(b,whoami)=>{
    if(b.action==='planGet') return {ok:true,plan:'plus',role:'owner',owner:false,email:'artist@test.invalid',shareStats:true,until:null,comped:false,discountPct:0,del:null,
      billing:{subscribed:true,plan:'plus',portal:true,pastDue:false},limits:{...LIM.plus,soon:['promote','analytics','presskit','branding'],seats:1},plans:LIM};
    if(b.action==='bizGet'&&whoami==='b') return {ok:true,from:b.from,to:b.to,dropped:0,oldestKept:null,limits:{band:5,costs:5},cutPct:10,name:'Other Artist',occ:[],
      biz:{v:1,at:Date.now(),prefs:{hours:{perform:true,break:true,travel:true,setup:true}},rules:{},gigs:{}}};
    if(b.action==='bizGet') return {ok:true,from:b.from,to:b.to,dropped:0,oldestKept:null,limits:{band:5,costs:5},cutPct:10,name:'Demo Artist',
      occ:[occ(N3,D3),occ(N2,D2),occ(N1,D1),...ADDED.map(addedOcc)],
      biz:{v:1,at:Date.now(),prefs:{hours:{perform:true,break:true,travel:true,setup:true}},
        rules:{g1:{pay:30000,band:[],tips:null,merch:[],costs:[],min:{perform:null,break:null,travel:null,setup:null},gear:[],note:'',at:1}},
        gigs:{['g1@'+D2]:{pay:30000,band:[{name:'Sam',cents:10000}],tips:4500,merch:[{name:'T-shirt',qty:2,cents:4000}],costs:[{name:'Parking',cents:1200}],min:{perform:120,break:30,travel:60,setup:45},gear:['Taylor 314'],note:'',at:1},
          ['ggone@'+D4]:{pay:15000,band:[],tips:null,merch:[],costs:[],min:{perform:null,break:null,travel:null,setup:null},gear:[],note:'',at:1}}}};
    if(b.action==='bizSave') return {ok:true,gig:b.gig||null};
    if(b.action==='eventPlace') return {ok:true,address:'',mapUrl:'',lat:13.75,lng:100.5};   // answered, so the save never waits on a maps script
    if(b.action==='eventList') return {ok:true,events:ADDED,occurrences:ADDED.map(addedOcc)};
    if(b.action==='eventSave'){ const e={...b.event,id:(b.event&&b.event.id)||'gNew'+ADDED.length}; const at=ADDED.findIndex(x=>x.id===e.id); if(at<0)ADDED.push(e); else ADDED[at]=e; return {ok:true,id:e.id,events:ADDED}; }
    if(b.action==='bizPrefs') return {ok:true,prefs:{hours:b.hours}};
    if(b.action==='orderList') return {ok:true,orders:[]};
    if(b.action==='merchList') return {ok:true,merch:[{id:'m1',title:'T-shirt',cents:2000,ship:'pickup',on:true,img:''}]};
    if(b.action==='payStatus') return {ok:true,pay:{kind:'artist',splitFee:false,acct:'',started:false,detailsSubmitted:false,chargesEnabled:false,payoutsEnabled:false,ready:false,country:'',plan:'plus',cutPct:10,stripeFeeNote:'',platformOwner:false}};
    if(b.action==='ledger') return {ok:true,enabled:false,months:[],total:null};
    if(b.action==='bugList') return {ok:true,bugs:[]};
    return {ok:true};
  }};
const srv=http.createServer((rq,rs)=>{const u=new URL(rq.url,'http://x');
 const J=(o)=>{rs.writeHead(200,{'content-type':'application/json'});rs.end(JSON.stringify(o));};
 const whoami=rq.headers.authorization==='Bearer tok-b'?'b':'a';
 if(u.pathname==='/api/stage')return J(whoami==='b'?{...MOCK.stage,show:{...MOCK.stage.show,artistId:'other',slug:'other',artist:'Other Artist'}}:MOCK.stage);
 if(u.pathname==='/api/history')return J(whoami==='b'?MOCK.historyB:MOCK.history);
 if(u.pathname==='/api/revenue')return J(MOCK.revenue);
 if(u.pathname==='/api/auth'){let body='';rq.on('data',c=>body+=c);rq.on('end',()=>{let b={};try{b=JSON.parse(body||'{}');}catch(e){}J(MOCK.auth(b));});return;}
 if(u.pathname==='/api/admin'){let body='';rq.on('data',c=>body+=c);rq.on('end',()=>{let b={};try{b=JSON.parse(body||'{}');}catch(e){}J(MOCK.admin(b,whoami));});return;}
 if(u.pathname==='/api/artists'){rs.writeHead(200,{'content-type':'application/json'});return rs.end(JSON.stringify({ok:true,artists:[
   {slug:'demo',name:'Demo Artist',tagline:'Songs for the room',avatar:'',management:'Good Records',style:'Soul',signed:true,musicReleased:true,showsNext30Days:1,totalShows:12,rating:4.5,ratingCount:2,locations:[{country:'Thailand',city:'Bangkok'}],eventsNext30Days:[{eventId:'g1',date:'2099-01-01',time:'20:00',startsAt:4070932800000,venue:'The Room',city:'Bangkok',country:'Thailand',address:'1 Music Lane',maps:{lat:13.75,lng:100.5,source:'https://maps.google.com/?q=13.75,100.5',google:'https://maps.google.com/?q=13.75,100.5'}}],nextShow:{date:'2099-01-01',city:'Bangkok',country:'Thailand'}},
   {slug:'quiet',name:'Quiet Band',tagline:'Acoustic songs',avatar:'',management:'',style:'Folk',signed:false,musicReleased:false,showsNext30Days:0,totalShows:0,rating:null,ratingCount:0,locations:[],eventsNext30Days:[],nextShow:null}
 ]}))}
 if(u.pathname==='/api/mapconfig'){rs.writeHead(200,{'content-type':'application/json'});return rs.end(JSON.stringify({ok:true,enabled:true,key:'test-browser-key'}))}
 const p=path.join(ROOT,u.pathname);
 if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){rs.writeHead(404);return rs.end('no');}
 rs.writeHead(200,{'content-type':T[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(rs);});
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const PORT=srv.address().port;
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']});
const pg=await b.newPage();
await pg.emulate({viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2},
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'});
let PAGEERRORS=0;
pg.on('pageerror',e=>{PAGEERRORS++;console.log('PAGEERROR:',String(e).slice(0,200));});

// ---------- 1 + 3: the vote page, countdown + dock ----------
await pg.goto(`http://127.0.0.1:${PORT}/vote.html?a=demo`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,700));
const R=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  lastCall(10000);
  // wait out the slide-in before measuring, or the rect is read mid-transition and
  // reports the box as half off the top of the screen
  await new Promise(r=>setTimeout(r,450));
  const box=document.querySelector('#lastcall');
  ok('the last-call box comes down', box.classList.contains('on'));
  ok('and shows ten', document.querySelector('#lcN').textContent==='10', document.querySelector('#lcN').textContent);
  const r=box.getBoundingClientRect();
  ok('pinned to the very top of the screen', r.top<=0 && r.bottom>40, `top ${r.top} bottom ${Math.round(r.bottom)}`);
  ok('and full width', r.width>=380, String(r.width));
  // it must not push the page around
  const app=document.querySelector('#app').getBoundingClientRect().top;
  lastCall(0);
  ok('the page under it did not move', Math.abs(document.querySelector('#app').getBoundingClientRect().top-app)<1);
  // a later, shorter poll must not shorten a running countdown
  /* A poll landing late must not CUT a countdown this phone is already showing.
     Read the rendered number, not an internal — `LC_UNTIL` is script-scoped and
     `window.LC_UNTIL` is undefined, which made the first version of this assertion
     compare 0 with 0 and pass no matter what the code did. */
  lastCall(9000); await new Promise(r=>setTimeout(r,60));
  const before=Number(document.querySelector('#lcN').textContent);
  lastCall(3000); await new Promise(r=>setTimeout(r,60));
  const after=Number(document.querySelector('#lcN').textContent);
  ok('a later poll cannot shorten one already running', after>=before-1, `${before} -> ${after}`);
  lastCall(0);
  return out.join('\n');
});
console.log('LAST CALL\n'+R);
await pg.evaluate(()=>{ const b=document.querySelector('#lastcall'); b.classList.add('on'); });


// the dock, live and ended
const D=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  ok('double-tap zoom is disabled without blocking pinch zoom', getComputedStyle(document.documentElement).touchAction==='manipulation', getComputedStyle(document.documentElement).touchAction);
  const draw=(ended,unl)=>{
    ST={artist:'Test Artist',paymentsEnabled:true,packs:{small:{cents:500,votes:3}},
        status:ended?'ended':'live',credits:{remaining:3,total:3,freeRemaining:3,freeTotal:3,used:0,paidLeft:0,unlimited:!!unl},
        songs:[],played:[],flags:{},windowOpen:!ended,tags:[],asks:{},myAsks:[]};
    render();
  };
  draw(false,false);
  const dock=document.querySelector('#dock');
  ok('live: both buttons', dock.querySelectorAll('button').length===2, dock.innerText.replace(/\n/g,' | '));
  const buy=dock.querySelector('.btn-buy');
  const cs=getComputedStyle(buy);
  ok('and "More votes" has an orange ring', /rgb\(255,\s*55,\s*95\)|inset/.test(cs.boxShadow), cs.boxShadow);
  const creditText=document.querySelector('#cr').textContent.replace(/\s+/g,' ').trim();
  ok('the header labels the free-vote allowance', creditText==='3/3 votes', creditText);
  const creditStyle=getComputedStyle(document.querySelector('#cr'));
  ok('and gives that allowance the Studio plan-tag treatment',
    /rgba\(48,\s*209,\s*88/.test(creditStyle.backgroundColor)&&/rgb\((24, 122, 50|76, 217, 100)\)/.test(creditStyle.color),
    `${creditStyle.backgroundColor} / ${creditStyle.color}`);
  ST.credits={remaining:0,total:3,freeRemaining:0,freeTotal:3,used:3,paidLeft:0,unlimited:false};
  ST.songs=[{id:'alpha',title:'Alpha',artist:'T',votes:0,cost:1,tags:[]}];
  render(); openVote('alpha');
  ok('an empty wallet can open the voting sheet', document.querySelector('#sheet').classList.contains('on'));
  ok('and the sheet offers “Buy more votes”', /Buy more votes/.test(document.querySelector('#sheet').innerText),
     document.querySelector('#sheet').innerText.replace(/\n/g,' | '));
  closeSheet();
  draw(true,false);
  ok('ended: the dock is STILL there', !dock.hidden);
  ok('and it is support, on its own', dock.querySelectorAll('button').length===1 &&
     /Support Test/.test(dock.innerText)&&/Show your appreciation/.test(dock.innerText), dock.innerText.replace(/\n/g,' | '));
  ok('across the full width', dock.querySelector('button').getBoundingClientRect().width>330,
     String(Math.round(dock.querySelector('button').getBoundingClientRect().width)));
  return out.join('\n');
});
console.log('\nTHE DOCK\n'+D);

const VOTING_UI=await pg.evaluate(()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  ST={artist:'Test Artist',paymentsEnabled:true,packs:{small:{cents:500,votes:3},big:{cents:2000,votes:15}},
    status:'live',windowOpen:true,replayCost:5,credits:{remaining:20,total:20,freeRemaining:3,freeTotal:3,used:0,paidLeft:17,unlimited:false},
    songs:[{id:'alpha',title:'Alpha',artist:'T',votes:9,mine:true,mineCount:1,cost:1,tags:[]},
      ...Array.from({length:5},(_,i)=>({id:'queue'+i,title:'Queue '+i,artist:'T',votes:8-i,cost:1,tags:[]})),
      {id:'bravo',title:'Bravo',artist:'T',votes:0,cost:1,tags:[]},
      {id:'charlie',title:'Charlie',artist:'T',votes:0,cost:1,tags:[]},
      {id:'delta',title:'Delta',artist:'T',votes:0,cost:1,tags:[]},
      ...Array.from({length:12},(_,i)=>({id:'standard'+i,title:'Standard '+i,artist:'T',votes:0,cost:1,tags:[]}))],
    played:[{id:'beta',title:'Beta',artist:'T',votes:0,cost:5,tags:[]}],
    flags:{},tags:[],asks:{vibe:{cost:0,options:['Energetic','Chill','Romantic','Upbeat','Melancholy','Funky','Acoustic','Rowdy','Nostalgic','Dark','Groovy','Mellow','Anthemic','Intimate','Hypnotic','Uplifting','Soulful','Wild','Dreamy','Heavy']}},myAsks:[]};
  render();
  const orange=/rgb\(255,\s*86,\s*80\)/;   // --accent-2, the logo's pink-orange (2026-09-13)
  /* THE RING IS THE BRAND GRADIENT (2026-09-13): a box with a real border paints it
     to its border box, a box without one draws it with ::after — both read as a
     linear-gradient running #FF375F → #FF6B45 where a flat colour used to be. */
  const grad=/linear-gradient\(135deg,\s*rgb\(255,\s*55,\s*95\).*rgb\(255,\s*107,\s*69\)/;
  const search=getComputedStyle(document.querySelector('.search input')).backgroundImage;
  const sort=getComputedStyle(document.querySelector('.sortbar'),'::after').backgroundImage;
  const list=getComputedStyle(document.querySelector('.votelist')).backgroundImage;
  ok('search wears the brand-gradient ring', grad.test(search), search);
  ok('sort buttons wear the brand-gradient ring', grad.test(sort), sort);
  ok('the voting list wears the brand-gradient ring', grad.test(list), list);
  const head=document.querySelector('.votehead b');
  ok('the voting-list heading has the requested orange copy', head&&head.textContent==='Vote your favorite songs below'&&orange.test(getComputedStyle(head).color), head&&head.textContent);
  const queueBox=document.querySelector('.queue'), queueScroll=document.querySelector('.queue-scroll');
  ok('Up next is larger, orange, bordered, and internally scrollable to three-and-a-half rows',
    queueBox&&queueScroll&&grad.test(getComputedStyle(queueBox).backgroundImage)
      &&orange.test(getComputedStyle(queueBox.querySelector('.qh b')).color)
      &&parseFloat(getComputedStyle(queueBox.querySelector('.qh b')).fontSize)>=15
      &&queueScroll.scrollHeight>queueScroll.clientHeight&&queueScroll.clientHeight<=267,
    queueScroll&&`${queueScroll.clientHeight}/${queueScroll.scrollHeight}`);
  const qrect=queueBox.getBoundingClientRect(), lrect=document.querySelector('.votelist').getBoundingClientRect();
  ok('both scrolling windows leave a thumb lane on the right while keeping the left edge',
    Math.abs(qrect.left-18)<1&&Math.abs(lrect.left-18)<1&&innerWidth-qrect.right>=54&&innerWidth-lrect.right>=54,
    `${Math.round(qrect.left)}, ${Math.round(innerWidth-qrect.right)} / ${Math.round(lrect.left)}, ${Math.round(innerWidth-lrect.right)}`);
  const votingList=document.querySelector('.votelist');
  ok('the setlist is capped at ten rows and scrolls inside itself',
    votingList.scrollHeight>votingList.clientHeight&&votingList.clientHeight<=661,
    `${votingList.clientHeight}/${votingList.scrollHeight}`);
  const replay=document.querySelector('.prow.played');
  ok('played songs are greyed but still have a vote button', replay&&getComputedStyle(replay.querySelector('.m')).opacity<'1'&&!replay.querySelector('.vb').disabled);
  ok('played songs carry the explicit replay line', replay&&/already played \(pay to request again\)/.test(replay.innerText));
  ok('played songs stay in their normal sorted place rather than the bottom', replay&&replay.nextElementSibling);
  const queued=document.querySelector('.prow.inqueue');
  ok('a queued song remains greyed in the setlist with a working add-votes button',
    queued&&/already voted in queue/.test(queued.innerText)&&!queued.querySelector('.vb').disabled
      &&getComputedStyle(queued.querySelector('.m')).opacity<'1'&&getComputedStyle(queued.querySelector('.vb')).opacity==='1');
  const listIds=[...document.querySelectorAll('.votelist .prow')].map(x=>x.querySelector('.t').textContent);
  ok('queued songs keep the selected setlist order instead of jumping to its top',listIds.indexOf('Bravo')<listIds.indexOf('Queue 0'));
  ok('setlist vote buttons stay plain and counts say vote or votes',
    queued&&queued.querySelector('.vb').textContent.trim()==='Vote'&&/9 votes/.test(queued.querySelector('.cnt').textContent));
  openVote('beta');
  ok('a replay opens with the requested question', /how badly do you want to hear this again\?/.test(document.querySelector('#sheet').innerText));
  const replayButtons=[...document.querySelectorAll('#sheet .vqb')];
  ok('the replay starts at its five-vote minimum', /5\s*votes/.test(document.querySelector('#sheet .vqn').innerText)&&replayButtons[0].disabled&&!replayButtons[1].disabled);
  ok('the replay also offers $5, $10, and a custom amount',
    !!document.querySelector('#sv-5')&&!!document.querySelector('#sv-10')&&!!document.querySelector('#songVoteAmt'));
  const replayCash=document.querySelector('#sheet .secure-votes');
  ok('and explains the paid-vote conversion in orange', replayCash&&/\$1 = 1 vote/.test(replayCash.innerText)&&orange.test(getComputedStyle(replayCash).color));
  replayButtons[1].click();
  ok('and can be increased above that minimum', /10\s*votes/.test(document.querySelector('#sheet .vqn').innerText));
  closeSheet();
  ST.credits.remaining=3; render();
  const shortReplay=document.querySelector('.prow.played .vb');
  shortReplay&&shortReplay.click();
  ok('a played song still opens its replay rules when free votes are below the replay minimum',
    shortReplay&&!shortReplay.disabled&&/how badly do you want to hear this again\?/.test(document.querySelector('#sheet').innerText));
  closeSheet(); ST.credits.remaining=20; render();
  openVibe();
  ok('the free vibe vote offers twenty moods in its own horizontal scroller and charges zero votes',
    document.querySelectorAll('#sheet [data-vibe]').length===20&&!!document.querySelector('#sheet .vibe-scroll')
      &&/Choose a vibe for free/.test(document.querySelector('#sheet').innerText)
      &&[...document.querySelectorAll('#sheet .tile span')].every(x=>x.textContent==='0 votes'));
  const vibeScroll=document.querySelector('#sheet .vibe-scroll'), vibeSheet=document.querySelector('#sheet');
  ok('only the vibe row scrolls sideways',vibeScroll.scrollWidth>vibeScroll.clientWidth&&vibeSheet.scrollWidth<=vibeSheet.clientWidth+1);
  closeSheet();
  ST.asks={song:{cost:3},birthday:{cost:3}};
  openAskSong();
  const requestCopy=document.querySelector('#sheet .secure-votes');
  ok('song requests offer $5, $10, and a custom held payment',
    !!document.querySelector('#ao-5')&&!!document.querySelector('#ao-10')&&!!document.querySelector('#askOfferAmt'));
  ok('the orange request copy names the artist and explains finish, decline, hold, and refund',
    requestCopy&&orange.test(getComputedStyle(requestCopy).color)&&/Make Test more inclined/.test(requestCopy.innerText)
      &&/only charged if they play and finish/.test(requestCopy.innerText)&&/hold is released/.test(requestCopy.innerText)
      &&/3 votes come back/.test(requestCopy.innerText), requestCopy&&requestCopy.innerText);
  closeSheet();
  const queueVote=document.querySelector('.qrow .qvb');
  ok('a song already voted on still offers add-more', queueVote&&!queueVote.disabled&&/Add to your votes/.test(queueVote.getAttribute('aria-label')));
  openBuy();
  const sheet=document.querySelector('#sheet');
  const straight=sheet.querySelector('.buyline'), secure=sheet.querySelector('.secure-votes');
  ok('the pack sheet names only the artist’s first name', straight&&straight.textContent.trim()==='Test will receive through Stripe Connect', straight&&straight.textContent.trim());   // the founder's words, 2026-09-13
  ok('both requested pack-sheet lines are orange', straight&&secure&&orange.test(getComputedStyle(straight).color)&&orange.test(getComputedStyle(secure).color));
  closeSheet(); openTip();
  const tipStraight=sheet.querySelector('.buyline'), tipSecure=sheet.querySelector('.secure-votes');
  ok('the tip sheet repeats both orange checkout lines', tipStraight&&tipSecure&&tipStraight.textContent.trim()==='Sent via Stripe Connect'&&orange.test(getComputedStyle(tipStraight).color)&&orange.test(getComputedStyle(tipSecure).color));
  closeSheet();
  return out.join('\n');
});
console.log('\nVOTING DETAILS\n'+VOTING_UI);


// ---------- 2: community tip ----------
await pg.goto(`http://127.0.0.1:${PORT}/community.html?a=demo`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,600));
const C=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  D={name:'Perry Idyll',avatar:'',verified:true,canBuy:true,merch:[],posts:[],
     showOpts:[],photos:[],clipOn:true,asks:{}};
  window.render&&render();
  const bar=document.querySelector('.tipbar');
  ok('the tip button is on the community page', !!bar, bar?bar.innerText.replace(/\n/g,' | '):'missing');
  if(bar){
    const first=document.querySelector('#app').children[1];
    ok('and it is the FIRST thing under the name', first&&first.classList.contains('tipbar'),
       first?first.className:'—');
    ok('and it carries the gentle orange pulse', getComputedStyle(bar.querySelector('button')).animationName==='emberGlow',
      getComputedStyle(bar.querySelector('button')).animationName);
    openTip(); await new Promise(r=>setTimeout(r,80));
    ok('tapping it opens a tip sheet', /Give Perry some love/.test(document.querySelector('#sheet').innerText));
    ok('with amounts and a note', !!document.querySelector('#tipAmt')&&!!document.querySelector('#tipNote'));
    const orange=/rgb\(255,\s*86,\s*80\)/;   // --accent-2, the logo's pink-orange (2026-09-13)
    ok('with both requested lines in orange', [...document.querySelectorAll('#sheet .checkoutcopy')].length===2&&
      [...document.querySelectorAll('#sheet .checkoutcopy')].every(x=>orange.test(getComputedStyle(x).color)));
  }
  return out.join('\n');
});
console.log('\nCOMMUNITY TIP\n'+C);

await pg.goto(`http://127.0.0.1:${PORT}/artist.html?a=demo`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,600));
const PR=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  P={ok:true,name:'Test Artist',live:true,tagline:'Live looping & soul',management:'Independent Artists Management',managementUrl:'https://management.test',avatar:'/img/band.jpg',photo:'/img/band.jpg',
     photos:[],verified:true,bio:'Plays every Thursday.',venue:'Seaflower Bungalows',city:'Koh Phangan',
     links:{website:'https://x.test',ytmusic:'https://music.youtube.com/x',applemusic:'https://music.apple.com/x',
            spotify:'https://open.spotify.com/x',instagram:'https://instagram.com/x'},
     media:[{mid:'m1',provider:'youtube',title:'Live at the bar',thumb:'',ratio:'',height:0,href:'https://y.test'}],
     stats:{joined:Date.now()-8.64e7,shows:12,people:340,votes:900,songs:60}};
  G={ok:true,gigs:[]}; S=null;
  try{ render(); }catch(e){ out.push('  ✗ render threw: '+e.message); return out.join('\n'); }
  await new Promise(r=>setTimeout(r,60));
  if(!document.querySelector('.links')){ out.push('  ✗ no .links; app len '+document.querySelector('#app').innerHTML.length); return out.join('\n'); }
  const app=document.querySelector('#app');
  const cta=app.querySelector('#joinBtn');
  ok('the live profile has one voting CTA', !!cta && cta.textContent.trim()==='ENTER NOW TO VOTE',
     cta?cta.textContent.trim():'missing');
  ok('and no duplicate button sits over the cover', !app.querySelector('.livepill'));
  ok('the live CTA carries the gentle orange pulse', getComputedStyle(cta).animationName==='emberGlow', getComputedStyle(cta).animationName);
  ok('label or management is the last Listen, follow, & support button',
    [...app.querySelectorAll('.links a:not([aria-hidden])')].at(-1)?.textContent.includes('Independent Artists Management'));
  const order=[...app.querySelectorAll('.links a')].map(a=>a.textContent.trim());
  ok('Instagram first, then Spotify, Apple Music, YouTube Music',
     JSON.stringify(order.slice(0,4))===JSON.stringify(['Instagram','Spotify','Apple Music','YouTube Music']),
     order.join(' > '));
  const sects=[...app.querySelectorAll('.sect')].map(s=>s.textContent.trim());
  ok('"Listen, follow, & support" comes before "About"',
     sects.indexOf('Listen, follow, & support')<sects.indexOf('About'), sects.join(' | '));
  ok('and the videos stay at the bottom',
     sects.indexOf('Watch & listen')===sects.length-1, sects.join(' | '));
  const links=app.querySelector('.links').getBoundingClientRect();
  ok('the links are above the fold on a phone', links.top<844, `top ${Math.round(links.top)}`);
  P.live=false;const startsAt=Date.now()+65000;
  G={ok:true,gigs:[{date:'2099-01-01',time:'20:00',startsAt,endsAt:startsAt+10800000,venue:'The Room',city:'Bangkok',country:'Thailand'}]};
  render();const before=document.querySelector('#joinBtn').textContent;
  await new Promise(r=>setTimeout(r,1100));const after=document.querySelector('#joinBtn').textContent;
  ok('the profile countdown seconds move in real time',/\d{2}s/.test(before)&&before!==after,`${before} -> ${after}`);
  return out.join('\n');
});
console.log('\nPROFILE PAGE\n'+PR);

// ---------- Settings: retired show controls + autoshow placement ----------
await pg.goto(`http://127.0.0.1:${PORT}/studio.html`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,500));
const SETTINGS=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  ok('the Studio disables double-tap zoom too', getComputedStyle(document.documentElement).touchAction==='manipulation', getComputedStyle(document.documentElement).touchAction);
  TAB='settings';
  D={ok:true,paymentsEnabled:true,songs:[],tags:{builtin:[],own:[]},show:{
    artistId:'verified-demo',status:'pre',windowOpen:true,freeCredits:3,unlimited:false,replayCost:5,
    packs:{small:{votes:3,cents:500},big:{votes:15,cents:2000}},
    requests:{on:false,cost:3},birthdays:{on:false,cost:3},unlimitedFans:[],autoStart:true
  }};
  PLAN={ok:true,owner:false,plan:'plus',email:'artist@test.invalid',shareStats:true,
    billing:{},limits:{pricing:true,seats:1,soon:[]},plans:{pro:{seats:5}}};
  TEAM={ok:true,slug:'demo',emails:['artist@test.invalid'],emailReady:true,codeSet:false};
  TICK={state:'verified'};
  try{ render(); }catch(e){ out.push('  ✗ Settings render threw: '+e.message); return out.join('\n'); }
  const text=document.querySelector('#app').innerText;
  ok('Settings omits Tonight’s gig', !/Tonight['’]s gig/.test(text));
  ok('Settings omits its duplicate Voting section', !/^Voting$/m.test(text));
  ok('Settings omits New show (reset everything)', !/New show \(reset everything\)/.test(text));
  const sections=[...document.querySelectorAll('#app .sec .kick')].map(x=>x.textContent.trim());
  const requests=sections.indexOf('Requests from fans'), autoshow=sections.indexOf('Starting by itself');
  ok('Starting by itself is directly after Requests from fans', autoshow===requests+1,
     sections.slice(Math.max(0,requests),autoshow+2).join(' > '));
  localStorage.removeItem('myset.verify-search-intro.verified-demo');
  VERIFYINTROSHOWN=false;maybeVerifyIntro();await new Promise(r=>setTimeout(r,20));
  const notice=document.querySelector('#sheet'), heading=notice.querySelector('h3');
  ok('the first Settings visit opens the verification notice',notice.classList.contains('on')&&notice.classList.contains('verify-intro'));
  ok('the notice carries the requested heading, search warning and reason',
    /verify your account now/.test(notice.innerText)&&/only verified profiles will show up in search results!/.test(notice.innerText)&&
    /minimize fraudulent use and ensure the best experience for MySet audiences/.test(notice.innerText));
  ok('its heading and reason are white, and its search warning is orange',
    getComputedStyle(heading).color==='rgb(255, 255, 255)'&&getComputedStyle(notice.querySelector('.verify-note')).color==='rgb(255, 255, 255)'&&
    ['rgb(255, 86, 80)','rgb(255, 69, 110)'].includes(getComputedStyle(notice.querySelector('.verify-lede')).color));
  await new Promise(r=>setTimeout(r,500));
  const noticeBox=notice.getBoundingClientRect();
  ok('the verification notice is centered in the viewport',
    Math.abs((noticeBox.top+noticeBox.height/2)-innerHeight/2)<2,
    `${Math.round(noticeBox.top+noticeBox.height/2)}/${Math.round(innerHeight/2)}`);
  closeSheet();VERIFYINTROSHOWN=false;maybeVerifyIntro();await new Promise(r=>setTimeout(r,20));
  ok('the verification notice appears only once for this artist',!notice.classList.contains('on'));
  return out.join('\n');
});
console.log('\nSTUDIO SETTINGS\n'+SETTINGS);

const STUDIO_VOTES=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  TAB='live';
  D={ok:true,paymentsEnabled:true,voters:2,room:2,nets:1,asks:[
      {id:'req1',kind:'song',status:'pending',title:'Cash Request',artist:'Band',cost:3,at:Date.now(),pledgeCents:500,pledgeVotes:5,pledgeState:'authorized'}],feedback:{},
    tips:{total:0,count:0,recent:[]},songs:[
      {id:'alpha',title:'Alpha',artist:'T',key:'Am',tags:['rock'],votes:4,paidVotes:2,active:true,votable:true,inSet:true,played:false,now:false},
      {id:'bravo',title:'Bravo',artist:'T',votes:1,paidVotes:0,active:true,votable:true,inSet:true,played:false,now:false},
      ...Array.from({length:13},(_,i)=>({id:'extra'+i,title:'Extra '+i,artist:'T',votes:0,paidVotes:0,active:true,votable:true,inSet:true,played:false,now:false})),
      {id:'current',title:'Current',artist:'T',votes:0,paidVotes:0,active:true,votable:false,inSet:true,played:false,now:true}],
    show:{status:'live',windowOpen:true,played:[],nowPlaying:null,slug:'demo',freeCredits:3,
      unlimited:false,replayCost:5,packs:{small:{votes:3,cents:500},big:{votes:15,cents:2000}},
      requests:{on:false,cost:3},birthdays:{on:false,cost:3},unlimitedFans:[],autoStart:true}};
  PLAN={ok:true,owner:false,plan:'pro',limits:{}};
  try{render();}catch(e){out.push('  ✗ Live render threw — '+e.message);return out.join('\n');}
  const top=document.querySelector('.bigplay');
  ok('top-voted action shows the total in words', top&&/\(4 votes total\)/.test(top.innerText), top&&top.innerText.replace(/\n/g,' | '));
  ok('top-voted action carries the green paid-vote pill', top&&/\(2\) paid votes/.test(top.innerText)&&
    ['rgb(24, 122, 50)','rgb(48, 209, 88)'].includes(getComputedStyle(top.querySelector('.paidtag')).color));
  const row=document.querySelector('.list .row');
  ok('the queue repeats total and paid counts', row&&/4 votes total/.test(row.innerText)&&/\(2\) paid votes/.test(row.innerText));
  const studioQueue=document.querySelector('.queue-window');
  const studioQueueShell=document.querySelector('.queue-shell');
  ok('the artist Up next window is orange, indented, and internally scrollable',
    studioQueue&&studioQueueShell&&studioQueue.scrollHeight>studioQueue.clientHeight&&innerWidth-studioQueueShell.getBoundingClientRect().right>=54
      &&/linear-gradient\(135deg,\s*rgb\(255,\s*55,\s*95\)/.test(getComputedStyle(studioQueueShell).backgroundImage)
      &&/up next/i.test(document.querySelector('.sec.upnext').innerText),
    studioQueue&&`${studioQueue.clientHeight}/${studioQueue.scrollHeight}; gap ${Math.round(innerWidth-studioQueueShell.getBoundingClientRect().right)}; ${getComputedStyle(studioQueueShell).boxShadow}; ${document.querySelector('.sec.upnext')&&document.querySelector('.sec.upnext').innerText}`);
  ok('the Studio scrollbar is clipped inside the rounded orange frame',
    studioQueueShell&&getComputedStyle(studioQueueShell).overflow==='hidden'&&
      studioQueue.getBoundingClientRect().top>=studioQueueShell.getBoundingClientRect().top&&
      studioQueue.getBoundingClientRect().bottom<=studioQueueShell.getBoundingClientRect().bottom,
    studioQueueShell&&getComputedStyle(studioQueueShell).overflow);
  ok('a voted unplayed song offers decline + refund', row&&/Decline \+ refund votes/.test(row.innerText));
  ok('end current song sits beside start top voted', !!document.querySelector('.liveactions .bigplay')&&!!document.querySelector('.liveactions .endnow'));
  ok('end current song is filled light red with red text', /rgba\(255, 59, 48, 0\.14\)/.test(getComputedStyle(document.querySelector('.liveactions .endnow')).backgroundColor)&&getComputedStyle(document.querySelector('.liveactions .endnow')).color==='rgb(255, 59, 48)', getComputedStyle(document.querySelector('.liveactions .endnow')).backgroundColor);
  { const b=document.querySelector('.queue-window .act'); if(b) b.click();
    const ask=document.getElementById('ask');
    ok('tapping ▶ while a song plays opens End current song? instead of starting it', ask&&ask.classList.contains('on')&&/End current song\?/.test(ask.innerText)&&/Yes, end it/.test(ask.innerText)&&/Keep playing/.test(ask.innerText), ask&&ask.innerText);
    ok('Yes, end it is true red, Keep playing is pink-orange bordered', ask&&getComputedStyle(ask.querySelector('.yes')).backgroundColor==='rgb(255, 59, 48)'&&getComputedStyle(ask.querySelector('.keep')).color==='rgb(255, 86, 80)');
    const kp=ask&&ask.querySelector('.keep'); if(kp) kp.click();
    ok('Keep playing closes the window and nothing started', ask&&!ask.classList.contains('on')&&!!document.querySelector('.liveactions .endnow')); }
  ok('the audience stats no longer look like a vote allowance', /2 voting/.test(document.querySelector('.stats').innerText)&&/2 in room · 1 network/.test(document.querySelector('.stats').innerText));
  const requestRow=document.querySelector('.askpanel .arow');
  ok('the artist sees the held dollar offer and its paid-vote value',
    requestRow&&/\$5 offered/.test(requestRow.innerText)&&/5 paid votes/.test(requestRow.innerText), requestRow&&requestRow.innerText);
  ok('the phone layout has no horizontal overflow', document.documentElement.scrollWidth<=innerWidth, `${document.documentElement.scrollWidth}/${innerWidth}`);
  const liveButtons=[...document.querySelectorAll('.stage-song-actions button')].map(b=>b.innerText.trim());
  ok('the playing song orders Lyrics, Auto chords, then My chart',
    liveButtons.join('|')==='Lyrics|♬ Auto chords|☰ My chart',liveButtons.join(' | '));
  const lyricsButton=document.querySelector('[data-act="lyrics"]'),hit=lyricsButton.getBoundingClientRect();
  ok('the decorative Now Playing shine cannot swallow real taps',
    document.elementFromPoint(hit.left+hit.width/2,hit.top+hit.height/2)?.closest('[data-act="lyrics"]')===lyricsButton);
  const nativeFetch=window.fetch;
  const longLyric='ThisIsOneVeryLongLyricTokenThatMustStillWrapInsideThePopupInsteadOfMakingTheArtistScrollSideways'.repeat(5);
  window.fetch=async u=>String(u).includes('/api/lyrics?')
    ? {json:async()=>({ok:true,found:true,plain:longLyric,credit:'Test source'})}
    : nativeFetch(u);
  document.querySelector('[data-act="lyrics"]').click();
  await new Promise(r=>setTimeout(r,20));
  ok('the Studio Lyrics button uses the audience lyrics reader',
    document.querySelector('#stageLyrics')?.textContent===longLyric);
  const stageLyrics=document.querySelector('#stageLyrics');
  ok('long lyrics wrap inside the Studio sheet instead of scrolling sideways',
    stageLyrics&&stageLyrics.scrollWidth<=stageLyrics.clientWidth&&getComputedStyle(stageLyrics).overflowX==='hidden',
    stageLyrics&&`${stageLyrics.clientWidth}/${stageLyrics.scrollWidth}`);
  closeSheet();window.fetch=nativeFetch;
  D.songs=D.songs.map(x=>({...x,votes:0,paidVotes:0})); render();
  ok('zero votes means no start-top-voted button', !document.querySelector('.liveactions .bigplay'));
  D.show.status='ended'; render();
  ok('between shows the Live tab hides stale stats and now-playing', !document.querySelector('.stats')&&!document.querySelector('.np')&&!document.querySelector('.votebox'));
  D.show.status='live'; D.songs[0].votes=4; D.songs[0].paidVotes=2;
  TAB='setlist'; render();
  ok('the Setlist tab never shows live vote or refund controls',
    !/4 votes total/.test(document.querySelector('#app').innerText)&&
    !/\(2\) paid votes/.test(document.querySelector('#app').innerText)&&
    !/Decline \+ refund votes/.test(document.querySelector('#app').innerText));
  const studioSet=document.querySelector('.setlist-window');
  const studioSetShell=document.querySelector('.setlist-shell');
  const setTools=[...document.querySelectorAll('.setlist-tools .big')];
  const organize=[...document.querySelectorAll('.orange-outline')].find(x=>/Organize your songs/.test(x.innerText));
  ok('setlist creation buttons match the standard height and leave a gap below',
    setTools.length===2&&Math.abs(setTools[0].getBoundingClientRect().height-setTools[1].getBoundingClientRect().height)<1&&
      setTools[0].getBoundingClientRect().height<=58&&organize&&organize.getBoundingClientRect().top-setTools[0].getBoundingClientRect().bottom>=9,
    setTools.map(x=>Math.round(x.getBoundingClientRect().height)).join('/')+(organize?`; gap ${Math.round(organize.getBoundingClientRect().top-setTools[0].getBoundingClientRect().bottom)}`:''));
  const songCard=document.querySelector('.songcard'), songActions=songCard&&songCard.querySelector('.songactions');
  ok('setlist song copy spans the card and tags/actions each get their own wrapping row',
    songCard&&songActions&&getComputedStyle(songCard).display==='block'&&songActions.getBoundingClientRect().top>songCard.querySelector('.songmeta').getBoundingClientRect().bottom&&
      Math.abs(songCard.querySelector('.m').getBoundingClientRect().right-songCard.getBoundingClientRect().right+16)<2&&getComputedStyle(songCard.querySelector('.songmeta')).flexWrap==='wrap');
  ok('the artist setlist is capped at ten rows with the same thumb lane and glow',
    studioSet&&studioSetShell&&studioSet.scrollHeight>studioSet.clientHeight&&studioSet.clientHeight<=721
      &&innerWidth-studioSetShell.getBoundingClientRect().right>=54&&getComputedStyle(studioSetShell).animationName==='edgeGlow',
    studioSet&&`${studioSet.clientHeight}/${studioSet.scrollHeight}`);
  const themeButton=document.querySelector('[data-theme-toggle]'),beforeTheme=getComputedStyle(document.body).backgroundColor;
  themeButton&&themeButton.click();
  const afterTheme=getComputedStyle(document.body).backgroundColor;
  ok('the Studio theme control changes the whole Studio palette',themeButton&&beforeTheme!==afterTheme,
    `${beforeTheme} -> ${afterTheme}`);
  return out.join('\n');
});
console.log('\nSTUDIO PAID VOTES\n'+STUDIO_VOTES);

// ---------- Coming up: one-tap Featured show action ----------
await pg.setViewport({width:320,height:700,isMobile:true,hasTouch:true,deviceScaleFactor:2});
const GIG_FEATURE=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  TAB='gigs';
  EVENTS={occurrences:[{eventId:'gig-one',date:'2099-01-12',venue:'Small Jazz Room',city:'Bangkok',country:'Thailand',time:'20:00',address:'12 Music Road'}]};
  FEAT={ok:true,enabled:true,price:1000,slots:3,mine:[],gigs:[{eventId:'gig-one',date:'2099-01-12',venue:'Small Jazz Room',city:'Bangkok',country:'Thailand',time:'20:00',left:3,already:false}]};
  render();
  const gig=document.querySelector('.gigrow');
  const actions=[...gig.querySelectorAll('button')].map(x=>x.textContent.trim());
  ok('Coming up orders Feature, Edit, then cancel',actions.join('|')==='Feature|Edit|✕',actions.join(' | '));
  ok('all three gig actions fit a 320px phone',document.documentElement.scrollWidth<=innerWidth,`${document.documentElement.scrollWidth}/${innerWidth}`);
  gig.querySelector('button').click();await new Promise(r=>setTimeout(r,20));
  const lead=document.querySelector('.promotelede'),style=lead&&getComputedStyle(lead);
  ok('the promotion sheet opens scoped to that gig with three large orange bullets',
    lead&&lead.querySelectorAll('li').length===3&&parseFloat(style.fontSize)>=16&&/255,\s*86,\s*80/.test(style.color)
      &&/Small Jazz Room/.test(document.querySelector('#sheet').innerText),
    lead&&`${lead.querySelectorAll('li').length} · ${style.fontSize} · ${style.color}`);
  closeSheet();
  return out.join('\n');
});
console.log('\nGIG FEATURE ACTION\n'+GIG_FEATURE);

// ---------- the Money tab as a Bar Star owner boots into it (decision 0065) ----------
await pg.setViewport({width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:2});
await pg.evaluate(()=>{localStorage.setItem('myset.token','test-token');localStorage.setItem('myset.tab','money');localStorage.setItem('myset.biz.period','{"kind":"30d"}');localStorage.removeItem('myset.biz.draft');localStorage.setItem('myset.firstrun','demo:done');});
const errsBefore=PAGEERRORS, bootAt=Date.now();
await pg.goto(`http://127.0.0.1:${PORT}/studio.html`,{waitUntil:'domcontentloaded'});
// the skeleton must be gone within two seconds of the boot: poll rather than sleep
let heroAt=null; for(let i=0;i<40&&heroAt===null;i++){ if(await pg.evaluate(()=>!!document.querySelector('#app .bizhero'))) heroAt=Date.now()-bootAt; else await new Promise(r=>setTimeout(r,50)); }
await new Promise(r=>setTimeout(r,800));   // the count-ups and the donut sweep settle
const MONEY=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  const app=document.querySelector('#app'), text=app.innerText;
  ok('the Money tab is the one on screen', TAB==='money'&&/Business dashboard|Through the app/.test(text));
  ok('the dashboard module loaded on demand', !!window.Money&&typeof Biz!=='undefined'&&!!document.getElementById('bizcss'));
  const hero=app.querySelector('.bizhero'), v=hero&&hero.querySelector('.v');
  ok('the profit hero is in #app', !!v&&/^-?\$[\d,]+\.\d\d$/.test(v.textContent.trim()), v&&v.textContent);
  ok('the skeleton is gone', !app.querySelector('.bizsk'));
  ok('three shows count, two are logged — the rule-only slot is listed, never counted', /3 shows · 2 logged/.test(text), (text.match(/\d+ shows? · \d+ logged/)||[])[0]);
  ok('the profit is the logged night, the filed one and the orphaned record, the unreachable night adding nothing', v&&v.textContent.trim()==='$765.50', v&&v.textContent);
  ok('the fee sentence names the cut as the plan’s, with the dollars', /10% \(\$[\d,]+\.\d\d\) goes to MySet for transaction fees/.test(text), (text.match(/[^\n]*goes to MySet[^\n]*/)||[])[0]);
  ok('the profit is green and its heading pink-orange', !!v&&v.classList.contains('pos')&&getComputedStyle(v).color!==getComputedStyle(hero.querySelector('.k')).color);
  ok('the hero says app money is missing for the night Stripe never answered', /App money not available for 1 show/.test(text));
  ok('nothing scrolls sideways at 390px', document.documentElement.scrollWidth<=innerWidth, `${document.documentElement.scrollWidth}/${innerWidth}`);
  const log=[...app.querySelectorAll('button')].find(b=>/^Log tonight$/.test(b.textContent.trim()));
  ok('the just-ended night offers “Log tonight” under the tiles', !!log&&log.classList.contains('btn-pri'));
  ok('and its top edge sits in the upper half of an 844px phone', !!log&&log.getBoundingClientRect().top<844*0.5, log&&String(Math.round(log.getBoundingClientRect().top)));
  const rows=[...app.querySelectorAll('.list .row[data-act="bizopen"]')];
  ok('one row per show in the period, newest first', rows.length===4&&/The Room/.test(rows[0].innerText), String(rows.length));
  const orphan=rows.find(r=>/Logged show/.test(r.innerText));
  ok('a record whose gig left the calendar is listed as “Logged show”, dated, counted, and says why', !!orphan&&!!orphan.querySelector('.bizchip.pos')&&/\$150\.00 paid/.test(orphan.innerText)&&/no longer on your calendar/.test(orphan.innerText), orphan&&orphan.innerText.replace(/\n/g,' | '));
  ok('the profit chart has a heading', /Profit by show/i.test(text));   // the kick is uppercased by CSS
  const unconfirmed=rows.find(r=>/Not confirmed/.test(r.innerText));
  ok('the rule-only night reads “from the run”, “Not confirmed”, with Log it and Didn’t happen and no profit chip', !!unconfirmed&&/\$300\.00 from the run/.test(unconfirmed.innerText)&&/Log it/.test(unconfirmed.innerText)&&/Didn't happen/.test(unconfirmed.innerText)&&!unconfirmed.querySelector('.bizchip'), unconfirmed&&unconfirmed.innerText.replace(/\n/g,' | '));
  const unreachable=rows.find(r=>/app money not available/.test(r.innerText));
  ok('the night Stripe never answered says so and offers Re-check', !!unreachable&&/Re-check/.test(unreachable.innerText)&&!!unreachable.querySelector('.bizchip.pos'), unreachable&&unreachable.innerText.replace(/\n/g,' | '));
  ok('the profit chart, the mix donut and the evening bar drew', !!app.querySelector('#bizchart svg rect.bar')&&!!app.querySelector('#bizdonut circle')&&!!app.querySelector('.bizeve .stack i'));
  const rate=[...app.querySelectorAll('.biztiles .c')].find(c=>/\$\/hour/i.test(c.innerText));   // the heading is uppercased by CSS
  ok('the $/hour tile says whose rate it is and how many shows were timed', !!rate&&/Total · before MySet fees/.test(rate.innerText)&&/1 of 3 shows timed/.test(rate.innerText), rate&&rate.innerText.replace(/\n/g,' | '));
  ok('every tile leads with a pink-orange heading', [...app.querySelectorAll('.biztiles .c')].every(c=>c.querySelector('.bizhd')&&c.querySelector('.bizhd').compareDocumentPosition(c.querySelector('b'))&Node.DOCUMENT_POSITION_FOLLOWING));
  const eve=app.querySelector('.bizeve');
  ok('the time box is the total over the period, with both rates under their own headings', /Total time invested/i.test(text)&&!!eve&&[...eve.querySelectorAll('.rates .bizhd')].map(h=>h.textContent).join('|')==='Stage time rate|Full evening rate', eve&&[...eve.querySelectorAll('.rates .bizhd')].map(h=>h.textContent).join('|'));
  const seg=eve&&eve.querySelector('[data-act="bizview"][data-id="mine"]'), feeBtn=eve&&eve.querySelector('[data-act="bizfee"]');
  ok('with the Total / My cut toggle and the fee button', !!seg&&!!feeBtn&&/before MySet’s transaction fees/.test(feeBtn.textContent), feeBtn&&feeBtn.textContent);
  const evBefore=eve.querySelector('[data-rate="evening"]').textContent;
  feeBtn.click(); await new Promise(r=>setTimeout(r,60));
  const eve2=app.querySelector('.bizeve'), evAfter=eve2.querySelector('[data-rate="evening"]').textContent;
  /* The one timed night here was filed without Stripe answering, so its fee is
     nothing and the post-fee rate is the same figure — the words must still change. */
  ok('tapping it reads the post-fee rate and says so on the box and the tile', parseFloat(evAfter.slice(1))<=parseFloat(evBefore.slice(1))&&/after MySet’s transaction fees/.test(eve2.querySelector('[data-act="bizfee"]').textContent)&&/after MySet fees/.test(app.querySelector('.biztiles button.c').innerText), `${evBefore} → ${evAfter}`);
  eve2.querySelector('[data-act="bizfee"]').click(); await new Promise(r=>setTimeout(r,60));
  ok('and again puts it back', app.querySelector('.bizeve [data-rate="evening"]').textContent===evBefore);
  const rep=app.querySelector('.bizbar a.btn-line');
  ok('Generate report is an outlined pink-orange button that opens the printable report for the same dates', !!rep&&rep.textContent.trim()==='Generate report'&&/^\/report\?from=\d{4}-\d\d-\d\d&to=\d{4}-\d\d-\d\d&hours=1$/.test(rep.getAttribute('href'))&&getComputedStyle(rep).backgroundColor==='rgba(0, 0, 0, 0)'&&/inset/.test(getComputedStyle(rep).boxShadow), rep&&rep.getAttribute('href'));
  const kicks=[...app.querySelectorAll('.sec .kick')].map(k=>k.textContent);   // innerText would carry the CSS uppercase
  ok('the Stripe cards follow under one label', kicks.includes('Through the app')&&kicks.some(k=>/^Getting paid/.test(k))&&kicks.some(k=>/^Your earnings/.test(k)), kicks.join(' | '));
  ok('the old Past shows list is not drawn twice', !/past shows/i.test(text)&&!/Look for missing shows[\s\S]*Look for missing shows/.test(text));
  // the editor: opens from the button, keeps its readout live, never dismisses on a body drag
  // (the fee toggles above repainted the tab, so the button is found again)
  [...app.querySelectorAll('button')].find(b=>/^Log tonight$/.test(b.textContent.trim())).click(); await new Promise(r=>setTimeout(r,120));
  const sheet=document.querySelector('#sheet');
  ok('“Log tonight” opens the editor sheet with the drag exception class', sheet.classList.contains('on')&&sheet.classList.contains('biz'));
  ok('the sheet is titled Log a show, asks for the total pay from the venue and the splits, and carries no $/h pills', sheet.querySelector('h3').textContent==='Log a show'&&/Total pay from venue/.test(sheet.innerText)&&/Splits/.test(sheet.innerText)&&!sheet.querySelector('[data-act="bizhk"]'), sheet.querySelector('h3').textContent);
  const cutIn=sheet.querySelector('.bz[data-f="cut"]');
  ok('My cut sits in the splits box above + Add band member, blank, with what’s left as its placeholder', !!cutIn&&!!cutIn.closest('[data-rows="band"]')&&cutIn.value===''&&/342\.50 — what's left/.test(cutIn.placeholder)&&!!(cutIn.compareDocumentPosition(sheet.querySelector('[data-act="bizadd"][data-id="band"]'))&Node.DOCUMENT_POSITION_FOLLOWING), cutIn&&cutIn.placeholder);
  ok('the editor starts from the run’s pay and the slot’s length', sheet.querySelector('.bz[data-f="pay"]').value==='300'&&sheet.querySelector('.bzmin[data-k="perform"]').value==='3h', `${sheet.querySelector('.bz[data-f="pay"]').value} / ${sheet.querySelector('.bzmin[data-k="perform"]').value}`);
  const ro=sheet.querySelector('#bizro');
  ok('the sticky readout shows profit and $/h before a key is pressed', /\$342\.50/.test(ro.textContent)&&/\$114\.17\/h/.test(ro.textContent), ro.textContent);
  const pay=sheet.querySelector('.bz[data-f="pay"]'); pay.value='400'; pay.dispatchEvent(new Event('input',{bubbles:true}));
  ok('and follows every keystroke without a render', /\$442\.50/.test(ro.textContent)&&sheet.classList.contains('on'), ro.textContent);
  ok('the band cap reads from the plan, not has()', /0 of 5/.test(sheet.querySelector('[data-rows="band"]').innerText));
  ok('money fields wear a dollar sign that stays', !!sheet.querySelector('.bzmoney > i')&&getComputedStyle(sheet.querySelector('.bzmoney > i')).position==='absolute');
  sheet.querySelector('[data-act="bizadd"][data-id="band"]').click();
  ok('adding a band member adds a row and counts it', sheet.querySelectorAll('[data-rows="band"] .bzrow').length===1&&/1 of 5/.test(sheet.querySelector('[data-rows="band"]').innerText));
  const tm=sheet.querySelector('.bzmin[data-k="travel"]'); tm.value='90'; tm.dispatchEvent(new Event('focusout',{bubbles:true}));
  ok('a bare 90 is refused as hours — the field shakes and stays', tm.classList.contains('bad'));
  tm.value='1.5'; tm.dispatchEvent(new Event('input',{bubbles:true})); tm.dispatchEvent(new Event('focusout',{bubbles:true}));
  ok('1.5 is an hour and a half', tm.value==='1h 30m'&&!tm.classList.contains('bad'), tm.value);
  ok('the draft is kept in the phone while typing', /"key":"g1@/.test(localStorage.getItem('myset.biz.draft')||''));
  ok('nothing in the sheet scrolls sideways', sheet.scrollWidth<=sheet.clientWidth+1, `${sheet.scrollWidth}/${sheet.clientWidth}`);
  closeSheet(); localStorage.removeItem('myset.biz.draft');
  return out.join('\n');
});
console.log('\nMONEY TAB\n'+MONEY+`\n  ${heroAt!==null&&heroAt<2000?'✓':'✗'} the dashboard replaced its skeleton ${heroAt===null?'never':'in '+heroAt+' ms'}\n  ${PAGEERRORS===errsBefore?'✓':'✗'} no page errors while booting into the tab (${PAGEERRORS-errsBefore})`);

/* ---------- the Money tab follows the calendar, refuses a bad time, and forgets on
   sign-out — the review of 0065 (C2, C3, C4/C7 and the minors). Every request the
   page makes is counted off window.fetch, so "no bizSave" and "one bizGet" are
   facts about the wire, not about a flag. */
const MONEY2=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  const acts=[]; const nf=window.fetch; window.fetch=(u,o)=>{ try{ if(String(u).includes('/api/admin')) acts.push(JSON.parse(o.body).action); }catch(e){} return nf(u,o); };
  const until=async(f,ms=3000)=>{ const t0=Date.now(); while(Date.now()-t0<ms){ if(f())return true; await new Promise(r=>setTimeout(r,40)); } return !!f(); };
  const iso=(d)=>{const t=new Date();t.setDate(t.getDate()-d);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;};
  const app=document.querySelector('#app'), sheet=document.querySelector('#sheet');
  // the orphaned record opens in the editor with its numbers and a way out
  const orphan=[...app.querySelectorAll('.list .row[data-act="bizopen"]')].find(r=>/Logged show/.test(r.innerText));
  if(orphan){ orphan.click(); await until(()=>sheet.classList.contains('on')&&document.querySelector('#bizf'));
    ok('the “Logged show” row opens the editor on its own numbers, with Remove', sheet.querySelector('.bz[data-f="pay"]').value==='150'&&!!sheet.querySelector('[data-act="bizremove"]'), sheet.querySelector('.bz[data-f="pay"]').value);
    closeSheet(); }
  else ok('the “Logged show” row opens the editor on its own numbers, with Remove', false, 'no such row');
  // the gig form on a past date: open for back-filling, the slot a placeholder, a bad time refused, nothing typed → no rule
  const past=iso(3);
  setTab('gigs'); await loadGigs(true);
  openGig(undefined,past);
  await until(()=>document.querySelector('#gBiz .bizf'));
  const det=document.querySelector('#gBiz'), perf=document.querySelector('#gBiz .bzmin[data-k="perform"]');
  ok('a new gig on a past date opens “The business side” for back-filling', !!det&&det.open);
  ok('the slot length is the On stage placeholder on the gig form, never its value', !!perf&&perf.value===''&&/3h from the gig/.test(perf.placeholder), perf&&`"${perf.value}" / ${perf.placeholder}`);
  const addBtn=document.querySelector('#gBiz .btn-grey');
  ok('the + Add buttons carry an edge of their own inside the grey box', !!addBtn&&getComputedStyle(addBtn).boxShadow!=='none', addBtn&&getComputedStyle(addBtn).boxShadow);
  // nothing touched on the business side: the gig saves, no rule is written
  document.querySelector('#gV').value='Corner Pub';
  const n1=acts.length;
  document.querySelector('[data-act="gigsave"]').click();
  await until(()=>!sheet.classList.contains('on')&&acts.slice(n1).includes('eventSave'));
  await new Promise(r=>setTimeout(r,250));
  ok('“Add it” with nothing typed on the business side sends no bizSave', acts.slice(n1).includes('eventSave')&&!acts.slice(n1).includes('bizSave'), acts.slice(n1).join(','));
  const n2=acts.length;   // from here to the Money paint: exactly one fresh read of the book
  // a time that makes no sense blocks the save the way it blocks the editor's
  openGig(undefined,iso(4));
  await until(()=>document.querySelector('#gBiz .bizf'));
  const perf2=document.querySelector('#gBiz .bzmin[data-k="perform"]');
  document.querySelector('#gV').value='Side Room';
  perf2.value='90'; perf2.dispatchEvent(new Event('focusout',{bubbles:true}));
  const n0=acts.length;
  document.querySelector('[data-act="gigsave"]').click(); await new Promise(r=>setTimeout(r,150));
  ok('a refused time blocks “Add it” with the shake and a toast', sheet.classList.contains('on')&&perf2.classList.contains('bad')&&document.querySelector('#toast').textContent==='Check the time fields'&&!acts.slice(n0).includes('eventSave'), `toast “${document.querySelector('#toast').textContent}”, sent ${acts.slice(n0).join(',')||'nothing'}`);
  closeSheet();
  // back on Money, the gig just added is there after exactly one fresh read
  setTab('money');
  await until(()=>app.querySelector('.bizhero')&&/Corner Pub/.test(app.innerText));
  const gets=acts.slice(n2).filter(a=>a==='bizGet').length;
  ok('a past gig added on the Gigs tab shows up on the Money tab after one fresh bizGet', /Corner Pub/.test(app.innerText)&&gets===1, `bizGet ×${gets}; rows ${[...app.querySelectorAll('.row[data-act="bizopen"] .t')].map(x=>x.textContent).join(' / ')}`);
  // the editor: a bad-time refocus never lands in a dismissed sheet; a no-op leaves no draft
  const log=[...app.querySelectorAll('button')].find(b=>/^Log tonight$/.test(b.textContent.trim()));
  log.click(); await until(()=>document.querySelector('#bizf'));
  const tm=document.querySelector('#bizf .bzmin[data-k="travel"]'); tm.focus(); tm.value='90'; tm.blur(); closeSheet();
  await new Promise(r=>setTimeout(r,40));
  ok('the bad-time refocus does not fire into a dismissed sheet', tm.classList.contains('bad')&&document.activeElement!==tm, document.activeElement&&document.activeElement.tagName);
  localStorage.removeItem('myset.biz.draft');
  log.click(); await until(()=>document.querySelector('#bizf'));
  document.querySelector('#bizf [data-act="bizadd"][data-id="band"]').click(); closeSheet();
  ok('an empty row added and closed again leaves no draft', !localStorage.getItem('myset.biz.draft'), localStorage.getItem('myset.biz.draft')||'');
  // sign out, then in through the recovery door as somebody else: the module forgot
  await signOut();
  ok('sign-out shows the sign-in screen', !!document.querySelector('.gate'));
  gate(null,'recover'); document.querySelector('#rslug').value='other'; document.querySelector('#rcode').value='AAAA-BBBB';
  const n3=acts.length;
  await recoverIn();
  await until(()=>D&&D.show&&D.show.artistId==='other');
  setTab('money');
  await until(()=>acts.slice(n3).includes('bizGet')&&!app.querySelector('.bizsk')&&/Nothing logged|Business dashboard/.test(app.innerText));
  await new Promise(r=>setTimeout(r,200));
  const text=app.innerText, getsB=acts.slice(n3).filter(a=>a==='bizGet').length;
  ok('the next owner on this phone gets a fresh read and none of the first artist’s shows', getsB===1&&!/The Room|Corner Pub|Logged show|\$765/.test(text)&&app.querySelectorAll('.row[data-act="bizopen"]').length===0&&/Nothing logged for this period yet/.test(text),
    `bizGet ×${getsB}; rows ${app.querySelectorAll('.row[data-act="bizopen"]').length}; ${(text.match(/Nothing logged for this period yet|The Room|Corner Pub/g)||[]).join(',')}`);
  window.fetch=nf;
  return out.join('\n');
});
console.log('\nMONEY TAB, THE CALENDAR AND THE DOOR\n'+MONEY2+`\n  ${PAGEERRORS===errsBefore?'✓':'✗'} still no page errors (${PAGEERRORS-errsBefore})`);
await pg.evaluate(()=>{localStorage.removeItem('myset.token');localStorage.removeItem('myset.tab');localStorage.removeItem('myset.biz.period');localStorage.removeItem('myset.aslug');localStorage.removeItem('myset.biz.draft');});

// ---------- 5: the restored fan-side light/dark switch ----------
await pg.evaluate(()=>localStorage.removeItem('myset.theme'));
await pg.goto(`http://127.0.0.1:${PORT}/index.html`,{waitUntil:'domcontentloaded'});
const DEFAULT_THEME=await pg.evaluate(()=>{
  const body=getComputedStyle(document.body).backgroundColor, intro=getComputedStyle(document.querySelector('#intro')).backgroundColor;
  return `  ${document.documentElement.dataset.theme==='light'&&body==='rgb(245, 245, 247)'&&intro==='rgb(245, 245, 247)'?'✓':'✗'} a first visit and its loading screen default to light — ${body} / ${intro}`;
});
console.log('\nDEFAULT THEME\n'+DEFAULT_THEME);
await pg.evaluate(()=>{localStorage.setItem('myset.theme','dark');sessionStorage.removeItem('myset.seen')});
await pg.reload({waitUntil:'domcontentloaded'});
const THEME=await pg.evaluate(async()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  const intro=document.querySelector('#intro'), before=getComputedStyle(document.body).backgroundColor, introBefore=getComputedStyle(intro).backgroundColor;
  document.querySelector('#themeBtn').click();
  const after=getComputedStyle(document.body).backgroundColor, introAfter=getComputedStyle(intro).backgroundColor;
  ok('the home page restores the light-mode switch',document.documentElement.dataset.theme==='light'&&localStorage.getItem('myset.theme')==='light');
  ok('the switch changes the rendered palette',before==='rgb(0, 0, 0)'&&after==='rgb(245, 245, 247)',`${before} -> ${after}`);
  ok('the loading screen follows the same switch',introBefore==='rgb(0, 0, 0)'&&introAfter==='rgb(245, 245, 247)',`${introBefore} -> ${introAfter}`);
  const artistActions=[...document.querySelectorAll('.artistactions .artistsearch')];
  ok('View on map sits left of Search for artists',artistActions.length===2&&/View on MAP/.test(artistActions[0].innerText)&&/Search for artists/.test(artistActions[1].innerText)&&artistActions[0].getBoundingClientRect().top===artistActions[1].getBoundingClientRect().top);
  class TestBounds{extend(){}}
  class TestMap{fitBounds(){}setCenter(){}setZoom(){}getZoom(){return 12}panTo(){}}
  class TestMarker{constructor(o){this.o=o}getPosition(){return{lat:()=>this.o.position.lat,lng:()=>this.o.position.lng}}}
  class TestInfo{setContent(){}open(){}}
  window.google={maps:{LatLngBounds:TestBounds,Map:TestMap,Marker:TestMarker,InfoWindow:TestInfo}};
  const path=location.pathname;artistActions[0].click();const homeMap=document.querySelector('#homeMapModal');
  await new Promise(r=>setTimeout(r,30));
  ok('the home map opens in place without loading the artist-search page',!homeMap.hidden&&homeMap.getAttribute('aria-modal')==='true'&&location.pathname===path&&document.querySelectorAll('.hmapevent').length===1);
  ok('the home map places its labeled pin directly at the saved coordinates',
    document.querySelector('.hpinlabel')?.textContent==='A'&&[...HOME_MARKERS.values()][0]?.getPosition().lat()===13.75);
  closeHomeMap();ok('closing the home map returns to the unchanged home page',homeMap.hidden&&location.pathname===path);
  ok('the three header controls fit a 320px phone',document.documentElement.scrollWidth<=innerWidth,`${document.documentElement.scrollWidth}/${innerWidth}`);
  return out.join('\n');
});
console.log('\nPUBLIC THEME\n'+THEME);

// ---------- 6: the searchable artist directory ----------
await pg.goto(`http://127.0.0.1:${PORT}/artists.html`,{waitUntil:'networkidle0'});
const DIRECTORY=await pg.evaluate(async()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  ok('the artist directory renders every artist',document.querySelectorAll('.artistcard').length===2,String(document.querySelectorAll('.artistcard').length));
  const first=document.querySelector('.artistcard');
  ok('the name and one-liner are separate spaced lines',getComputedStyle(first.querySelector('.name')).display==='block'&&parseFloat(getComputedStyle(first.querySelector('.tag')).marginTop)>=4);
  ok('the directory shows location, style, signed, numeric and icon ratings, and both MySet show counts',/Bangkok, Thailand/.test(first.innerText)&&/Soul/.test(first.innerText)&&/Signed/.test(first.innerText)&&/4.5\/5/.test(first.innerText)&&/★★★★★/.test(first.innerText)&&/next 30 days/.test(first.innerText)&&/12 MySet shows total/.test(first.innerText),first.innerText);
  const mapButton=document.querySelector('#mapBtn');mapButton.click();
  const modal=document.querySelector('#mapModal'),mapViewport=modal.querySelector('#mapViewport');
  ok('View map opens an accessible popup with every filtered event',!modal.hidden&&modal.getAttribute('aria-modal')==='true'&&modal.querySelectorAll('.mapevent').length===1);
  ok('the popup opens an interactive map viewport for the exact event location',!!mapViewport&&/A/.test(modal.querySelector('.pinlabel')?.textContent||''));
  ok('each mapped event keeps its exact directions link',modal.querySelector('.mapgo')?.href==='https://maps.google.com/?q=13.75,100.5');
  ok('the directory map uses saved coordinates directly and never guesses from an address',
    /const canPin=e=>hasCoords\(e\)/.test(document.documentElement.innerHTML)&&!/new maps\.Geocoder/.test(document.documentElement.innerHTML));
  document.querySelector('#mapClose').click();
  document.querySelector('#upcoming').click();
  ok('the upcoming-show filter narrows the directory',document.querySelectorAll('.artistcard').length===1&&/Demo Artist/.test(document.querySelector('#artists').innerText));
  document.querySelector('#upcoming').click();document.querySelector('#music').click();
  ok('the released-music filter uses its public signal',document.querySelectorAll('.artistcard').length===1&&/Music released/.test(document.querySelector('#artists').innerText));
  document.querySelector('#music').click();document.querySelector('#signed').click();
  ok('the signed filter uses the management-backed public signal',document.querySelectorAll('.artistcard').length===1&&/Demo Artist/.test(document.querySelector('#artists').innerText));
  ok('the directory fits a 320px phone',document.documentElement.scrollWidth<=innerWidth,`${document.documentElement.scrollWidth}/${innerWidth}`);
  ok('the directory has the same global theme control',!!document.querySelector('[data-theme-toggle]'));
  return out.join('\n');
});
console.log('\nARTIST DIRECTORY\n'+DIRECTORY);

await b.close(); srv.close();
