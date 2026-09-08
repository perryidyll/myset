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
const srv=http.createServer((rq,rs)=>{const u=new URL(rq.url,'http://x');const p=path.join(ROOT,u.pathname);
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
    openTip(); await new Promise(r=>setTimeout(r,80));
    ok('tapping it opens a tip sheet', /Tip Perry/.test(document.querySelector('#sheet').innerText));
    ok('with amounts and a note', !!document.querySelector('#tipAmt')&&!!document.querySelector('#tipNote'));
  }
  return out.join('\n');
});
console.log('\nCOMMUNITY TIP\n'+C);

await pg.goto(`http://127.0.0.1:${PORT}/artist.html?a=demo`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,600));
const PR=await pg.evaluate(async ()=>{
  const out=[];const ok=(n,c,x='')=>out.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  P={ok:true,name:'Test Artist',live:true,tagline:'Live looping & soul',avatar:'/img/band.jpg',photo:'/img/band.jpg',
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
  TAB='settings';
  D={ok:true,paymentsEnabled:true,songs:[],tags:{builtin:[],own:[]},show:{
    status:'pre',windowOpen:true,freeCredits:3,unlimited:false,replayCost:5,
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
  return out.join('\n');
});
console.log('\nSTUDIO SETTINGS\n'+SETTINGS);

await b.close(); srv.close();
