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
const ROOT='/Users/perryidyll/Docs/MySet/public';
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((rq,rs)=>{const u=new URL(rq.url,'http://x');
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
pg.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,200)));

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
  ok('and it is the tip, on its own', dock.querySelectorAll('button').length===1 &&
     /Tip Test/.test(dock.innerText), dock.innerText.replace(/\n/g,' | '));
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
  const orange=/rgb\(255,\s*122,\s*69\)/;
  const search=getComputedStyle(document.querySelector('.search input')).boxShadow;
  const sort=getComputedStyle(document.querySelector('.sortbar')).boxShadow;
  const list=getComputedStyle(document.querySelector('.votelist')).borderColor;
  ok('search has a thin orange border', orange.test(search), search);
  ok('sort buttons have a thin orange border', orange.test(sort), sort);
  ok('the voting list has a thin orange border', orange.test(list), list);
  const head=document.querySelector('.votehead b');
  ok('the voting-list heading has the requested orange copy', head&&head.textContent==='Vote your favorite songs below'&&orange.test(getComputedStyle(head).color), head&&head.textContent);
  const queueBox=document.querySelector('.queue'), queueScroll=document.querySelector('.queue-scroll');
  ok('Up next is larger, orange, bordered, and internally scrollable to three-and-a-half rows',
    queueBox&&queueScroll&&orange.test(getComputedStyle(queueBox).borderColor)
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
  ok('the pack sheet names only the artist’s first name', straight&&straight.textContent.trim()==='goes straight to Test', straight&&straight.textContent.trim());
  ok('both requested pack-sheet lines are orange', straight&&secure&&orange.test(getComputedStyle(straight).color)&&orange.test(getComputedStyle(secure).color));
  closeSheet(); openTip();
  const tipStraight=sheet.querySelector('.buyline'), tipSecure=sheet.querySelector('.secure-votes');
  ok('the tip sheet repeats both orange checkout lines', tipStraight&&tipSecure&&tipStraight.textContent.trim()==='goes straight to Test'&&orange.test(getComputedStyle(tipStraight).color)&&orange.test(getComputedStyle(tipSecure).color));
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
    ok('tapping it opens a tip sheet', /Tip Perry/.test(document.querySelector('#sheet').innerText));
    ok('with amounts and a note', !!document.querySelector('#tipAmt')&&!!document.querySelector('#tipNote'));
    const orange=/rgb\(255,\s*122,\s*69\)/;
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
  ok('the live profile has one voting CTA', !!cta && cta.textContent.trim()==='TAP TO VOTE THE SETLIST',
     cta?cta.textContent.trim():'missing');
  ok('and no duplicate button sits over the cover', !app.querySelector('.livepill'));
  ok('the live CTA carries the gentle orange pulse', getComputedStyle(cta).animationName==='emberGlow', getComputedStyle(cta).animationName);
  ok('label or management is the last Listen & follow button',
    [...app.querySelectorAll('.links a')].at(-1)?.textContent.includes('Independent Artists Management'));
  const order=[...app.querySelectorAll('.links a')].map(a=>a.textContent.trim());
  ok('Instagram first, then Spotify, Apple Music, YouTube Music',
     JSON.stringify(order.slice(0,4))===JSON.stringify(['Instagram','Spotify','Apple Music','YouTube Music']),
     order.join(' > '));
  const sects=[...app.querySelectorAll('.sect')].map(s=>s.textContent.trim());
  ok('"Listen & follow" comes before "About"',
     sects.indexOf('Listen & follow')<sects.indexOf('About'), sects.join(' | '));
  ok('and the videos stay at the bottom',
     sects.indexOf('Watch & listen')===sects.length-1, sects.join(' | '));
  const links=app.querySelector('.links').getBoundingClientRect();
  ok('the links are above the fold on a phone', links.top<844, `top ${Math.round(links.top)}`);
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
    ['rgb(255, 122, 69)','rgb(255, 69, 110)'].includes(getComputedStyle(notice.querySelector('.verify-lede')).color));
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
      {id:'alpha',title:'Alpha',artist:'T',votes:4,paidVotes:2,active:true,votable:true,inSet:true,played:false,now:false},
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
      &&/255,\s*122,\s*69/.test(getComputedStyle(studioQueueShell).borderColor)
      &&/up next/i.test(document.querySelector('.sec.upnext').innerText),
    studioQueue&&`${studioQueue.clientHeight}/${studioQueue.scrollHeight}; gap ${Math.round(innerWidth-studioQueueShell.getBoundingClientRect().right)}; ${getComputedStyle(studioQueueShell).boxShadow}; ${document.querySelector('.sec.upnext')&&document.querySelector('.sec.upnext').innerText}`);
  ok('the Studio scrollbar is clipped inside the rounded orange frame',
    studioQueueShell&&getComputedStyle(studioQueueShell).overflow==='hidden'&&
      studioQueue.getBoundingClientRect().top>=studioQueueShell.getBoundingClientRect().top&&
      studioQueue.getBoundingClientRect().bottom<=studioQueueShell.getBoundingClientRect().bottom,
    studioQueueShell&&getComputedStyle(studioQueueShell).overflow);
  ok('a voted unplayed song offers decline + refund', row&&/Decline \+ refund votes/.test(row.innerText));
  ok('end current song sits beside start top voted', !!document.querySelector('.liveactions .bigplay')&&!!document.querySelector('.liveactions .endnow'));
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
  ok('the Setlist tab also shows paid attribution', /4 votes total/.test(document.querySelector('#app').innerText)&&/\(2\) paid votes/.test(document.querySelector('#app').innerText));
  const studioSet=document.querySelector('.setlist-window');
  const studioSetShell=document.querySelector('.setlist-shell');
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
    lead&&lead.querySelectorAll('li').length===3&&parseFloat(style.fontSize)>=16&&/255,\s*122,\s*69/.test(style.color)
      &&/Small Jazz Room/.test(document.querySelector('#sheet').innerText),
    lead&&`${lead.querySelectorAll('li').length} · ${style.fontSize} · ${style.color}`);
  closeSheet();
  return out.join('\n');
});
console.log('\nGIG FEATURE ACTION\n'+GIG_FEATURE);

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
const THEME=await pg.evaluate(()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  const intro=document.querySelector('#intro'), before=getComputedStyle(document.body).backgroundColor, introBefore=getComputedStyle(intro).backgroundColor;
  document.querySelector('#themeBtn').click();
  const after=getComputedStyle(document.body).backgroundColor, introAfter=getComputedStyle(intro).backgroundColor;
  ok('the home page restores the light-mode switch',document.documentElement.dataset.theme==='light'&&localStorage.getItem('myset.theme')==='light');
  ok('the switch changes the rendered palette',before==='rgb(0, 0, 0)'&&after==='rgb(245, 245, 247)',`${before} -> ${after}`);
  ok('the loading screen follows the same switch',introBefore==='rgb(0, 0, 0)'&&introAfter==='rgb(245, 245, 247)',`${introBefore} -> ${introAfter}`);
  const artistActions=[...document.querySelectorAll('.artistactions .artistsearch')];
  ok('View on map sits left of Search for artists',artistActions.length===2&&/View on map/.test(artistActions[0].innerText)&&/Search for artists/.test(artistActions[1].innerText)&&artistActions[0].getBoundingClientRect().top===artistActions[1].getBoundingClientRect().top);
  ok('the three header controls fit a 320px phone',document.documentElement.scrollWidth<=innerWidth,`${document.documentElement.scrollWidth}/${innerWidth}`);
  return out.join('\n');
});
console.log('\nPUBLIC THEME\n'+THEME);

// ---------- 6: the searchable artist directory ----------
await pg.goto(`http://127.0.0.1:${PORT}/artists.html`,{waitUntil:'networkidle0'});
const DIRECTORY=await pg.evaluate(()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  ok('the artist directory renders every artist',document.querySelectorAll('.artistcard').length===2,String(document.querySelectorAll('.artistcard').length));
  const first=document.querySelector('.artistcard');
  ok('the name and one-liner are separate spaced lines',getComputedStyle(first.querySelector('.name')).display==='block'&&parseFloat(getComputedStyle(first.querySelector('.tag')).marginTop)>=4);
  ok('the directory shows location, style, signed, numeric and icon ratings, and both MySet show counts',/Bangkok, Thailand/.test(first.innerText)&&/Soul/.test(first.innerText)&&/Signed/.test(first.innerText)&&/4.5\/5/.test(first.innerText)&&/★★★★★/.test(first.innerText)&&/next 30 days/.test(first.innerText)&&/12 MySet shows total/.test(first.innerText),first.innerText);
  const mapButton=document.querySelector('#mapBtn');mapButton.click();
  const modal=document.querySelector('#mapModal'),mapImage=modal.querySelector('.mapcanvas img');
  ok('View map opens an accessible popup with every filtered event',!modal.hidden&&modal.getAttribute('aria-modal')==='true'&&modal.querySelectorAll('.mapevent').length===1);
  ok('the popup sends the exact coordinate to a labeled static-map pin',mapImage&&/13\.75%2C100\.5/.test(mapImage.src)&&/label%3AA/.test(mapImage.src),mapImage&&mapImage.src);
  ok('each mapped event keeps its exact directions link',modal.querySelector('.mapgo')?.href==='https://maps.google.com/?q=13.75,100.5');
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
