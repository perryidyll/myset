/* SHEETCHECK — the lyrics sheet driven by a real touch screen.

   The bug this exists for could not be seen by any test in test/: a fan tapping the
   lyrics to scroll them dragged the PAGE instead, and the sheet jumped half its own
   width to the right the moment a finger landed on it. Both are touch behaviour in a
   real browser, so node could not see either.

   The right-hand jump was one missing term: the sheet is centred with
   translateX(-50%), and the drag wrote a transform without it.

     node tools/sheetcheck.mjs

   Needs Chrome and puppeteer-core, which live outside this repo, so it is not part
   of `sh test/run.sh` — same arrangement as tools/clipcheck.mjs. */
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import puppeteer from './_puppeteer.mjs';   // resolved by content, not by a typed path (2026-09-25)
const ROOT=process.env.MYSET_PUBLIC||path.join(path.dirname(fileURLToPath(import.meta.url)),'..','public');   // the public/ beside THIS file — a worktree checks its own pages; MYSET_PUBLIC overrides (2026-09-13)
const T={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css'};
const srv=http.createServer((rq,rs)=>{const u=new URL(rq.url,'http://x');const p=path.join(ROOT,u.pathname);
 if(!fs.existsSync(p)||fs.statSync(p).isDirectory()){rs.writeHead(404);return rs.end('no');}
 rs.writeHead(200,{'content-type':T[path.extname(p)]||'application/octet-stream'});fs.createReadStream(p).pipe(rs);});
await new Promise(r=>srv.listen(0,'127.0.0.1',r)); const PORT=srv.address().port;
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:'new',args:['--no-sandbox']});
const pg=await b.newPage();
await pg.emulate({viewport:{width:390,height:844,isMobile:true,hasTouch:true,deviceScaleFactor:3},
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
pg.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,160)));
await pg.goto(`http://127.0.0.1:${PORT}/vote.html?a=demo`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,700));
const out=await pg.evaluate(async()=>{
  const R=[];const ok=(n,c,x='')=>R.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  // make the page tall enough to scroll behind the sheet
  document.body.insertAdjacentHTML('afterbegin','<div style="height:3000px"></div>');
  window.scrollTo(0,500); await new Promise(r=>setTimeout(r,60));
  const before=window.scrollY;
  const lines=Array.from({length:60},(_,i)=>'line '+i).join('\n');
  openSheet(`<h3>Best Part</h3><p class="lede">Daniel Caesar</p><div class="lyr" id="L">${lines}</div>`);
  await new Promise(r=>setTimeout(r,80));
  const sh=document.querySelector('#sheet'), L=document.querySelector('#L');
  ok('the page behind is frozen', document.body.classList.contains('sheeting'));
  ok('and it did not jump', Math.abs(-parseInt(document.body.style.top)-before)<2, document.body.style.top);
  ok('the words scroll on their own', L.scrollHeight>L.clientHeight, L.scrollHeight+' > '+L.clientHeight);

  const left=()=>sh.getBoundingClientRect().left;
  const x0=left();
  const touch=(type,y,target)=>{const t=new Touch({identifier:1,target,clientX:200,clientY:y});
    target.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}));};
  // a finger dragging DOWN inside the lyrics
  touch('touchstart',500,L); touch('touchmove',430,L); touch('touchmove',380,L); touch('touchend',380,L);
  await new Promise(r=>setTimeout(r,60));
  ok('dragging inside the words does not drag the sheet',
     !/translateY\(\d+(\.\d+)?px\)/.test(sh.style.transform||'') , 'transform: '+(sh.style.transform||'(none)'));
  ok('and the sheet stays where it is, horizontally', Math.abs(left()-x0)<1, left()+' vs '+x0);
  ok('the sheet is still open', sh.classList.contains('on'));

  // a finger on the grab zone still pulls it down and closes it
  const gz=sh.querySelector('.grabzone');
  ok('the grab area is a real thumb target', gz.getBoundingClientRect().height>=56, gz.getBoundingClientRect().height+'px');
  const h3=sh.querySelector('h3');
  touch('touchstart',300,h3); touch('touchmove',340,h3);
  await new Promise(r=>setTimeout(r,30));
  ok('the title drags the sheet too', /translateY/.test(sh.style.transform||''), sh.style.transform);
  ok('and it keeps its centring while dragged', /translateX\(-50%\)/.test(sh.style.transform||''), sh.style.transform);
  touch('touchmove',420,h3); touch('touchend',420,h3);
  await new Promise(r=>setTimeout(r,80));
  ok('a real pull closes it', !sh.classList.contains('on'));
  ok('the page is given back', !document.body.classList.contains('sheeting'));
  ok('and it is back exactly where it was', Math.abs(window.scrollY-before)<2, window.scrollY+' vs '+before);
  return R.join('\n');
});
console.log(out);

/* ---------- the shop's product sheet (2026-09-13) ----------
   shop.html carries the same sheet with three additions worth a real finger: the page behind
   is INERT as well as frozen, focus lands on the title and returns to the card that opened
   it, and the size row is a scroller — a drag that starts there must not close the sheet
   (INVARIANT 0f1). /api/fan is not stubbed, so D is set and render() called by hand. */
await pg.goto(`http://127.0.0.1:${PORT}/shop.html?a=demo`,{waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,600));
const shop=await pg.evaluate(async()=>{
  const R=[];const ok=(n,c,x='')=>R.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  const sizes=['XS','S','M','L','XL','2XL','3XL'].map(l=>({label:l,out:l==='M'}));
  D={ok:true,name:'Demo Artist',first:'Demo',avatar:'',verified:true,live:false,canBuy:true,posts:[],
     merch:Array.from({length:8},(_,i)=>({id:'m00000'+(i+1),title:'Tour tee '+(i+1),blurb:'Soft cotton.',cents:2500,img:'',link:'',ship:'pickup',on:true,at:i,out:false,post:0,variants:i?[]:sizes}))};
  render(); await new Promise(r=>setTimeout(r,80));
  document.body.insertAdjacentHTML('beforeend','<div style="height:3000px"></div>');
  window.scrollTo(0,500); await new Promise(r=>setTimeout(r,60));
  const before=window.scrollY;
  const card=document.querySelector('.pgrid .pcard'); card.focus({preventScroll:true});   // focusing would otherwise scroll the card into view and move `before`
  openItem('m000001'); await new Promise(r=>setTimeout(r,200));
  const sh=document.querySelector('#sheet'), wrap=document.querySelector('.wrap'), h3=sh.querySelector('h3');
  ok('the page behind is frozen', document.body.classList.contains('sheeting'));
  ok('and it did not jump', Math.abs(-parseInt(document.body.style.top)-before)<2, document.body.style.top);
  ok('and it is inert while the sheet is open', wrap.inert===true&&wrap.getAttribute('aria-hidden')==='true', `inert ${wrap.inert}`);
  ok('the open sheet is not', sh.inert===false);
  ok('focus lands on the title', document.activeElement===h3&&h3.id==='sheetTitle', document.activeElement?document.activeElement.tagName+'#'+document.activeElement.id:'—');
  const row=sh.querySelector('.sizes .row');
  ok('the size row scrolls on its own', !!row&&row.scrollWidth>row.clientWidth, row?row.scrollWidth+' > '+row.clientWidth:'no .sizes');

  const left=()=>sh.getBoundingClientRect().left;
  const x0=left();
  const touch=(type,y,target,x=200)=>{const t=new Touch({identifier:1,target,clientX:x,clientY:y});
    target.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}));};
  // a finger dragging DOWN from inside the size row — a horizontal scroller, not a handle
  const ry=row.getBoundingClientRect().top+10;
  touch('touchstart',ry,row); touch('touchmove',ry+70,row); touch('touchmove',ry+120,row); touch('touchend',ry+120,row);
  await new Promise(r=>setTimeout(r,60));
  ok('dragging from inside the sizes does not drag the sheet', !/translateY\(\d+(\.\d+)?px\)/.test(sh.style.transform||''), 'transform: '+(sh.style.transform||'(none)'));
  ok('and the sheet stays where it is, horizontally', Math.abs(left()-x0)<1, left()+' vs '+x0);
  ok('the sheet is still open', sh.classList.contains('on'));

  // a finger dragging DOWN from the lede while the sheet's own content is scrolled — that is a scroll back up, not a pull
  sh.scrollTop=150; const lede=sh.querySelector('.lede'); const ly=lede.getBoundingClientRect().top+5;
  touch('touchstart',ly,lede); touch('touchmove',ly+60,lede); touch('touchmove',ly+120,lede); touch('touchend',ly+120,lede);
  await new Promise(r=>setTimeout(r,300));
  ok('with the sheet scrolled, a drag from the lede leaves the sheet open', sh.classList.contains('on'));
  sh.scrollTop=0;

  /* the More strip (2026-09-13): the other seven, under the photo, a horizontal scroller inside the vertical one.
     A finger DOWN on the strip itself (not a card) must not start a sheet drag — it is in SCROLLER, like the sizes (0f1). */
  const more=sh.querySelector('.more');
  ok('the sheet carries the More strip of the other seven', !!more&&more.querySelectorAll('[data-more]:not([aria-hidden])').length===7, more?String(more.querySelectorAll('[data-more]').length):'no .more');
  ok('the strip drifts the links-strip way, so it starts one set in', !!more&&more.scrollLeft>0, more?String(more.scrollLeft):'—');
  sh.scrollTop=sh.scrollHeight;   // the strip is the last thing in the sheet: scroll to it
  await new Promise(r=>setTimeout(r,60));
  const my=more.getBoundingClientRect().top+2;   // the strip's own top padding, between the sheet and the cards
  touch('touchstart',my,more); touch('touchmove',my+70,more); touch('touchmove',my+120,more); touch('touchend',my+120,more);
  await new Promise(r=>setTimeout(r,60));
  ok('a drag down from inside the strip does not drag the sheet', !/translateY\(\d+(\.\d+)?px\)/.test(sh.style.transform||''), 'transform: '+(sh.style.transform||'(none)'));
  ok('and the sheet is still open, centred', sh.classList.contains('on')&&Math.abs(left()-x0)<1, left()+' vs '+x0);
  const mr=more.getBoundingClientRect();
  return {R,before,strip:{x:Math.round(mr.left+mr.width/2),y:Math.round(mr.top+mr.height/2)},top:sh.scrollTop,sl:more.scrollLeft};
});
console.log('\nTHE SHOP\'S PRODUCT SHEET\n'+shop.R.join('\n'));

/* Now a REAL finger — CDP touch events through the browser's own input pipeline, so Chrome decides what scrolls.
   Landing on a card in the strip (where a finger lands), a sideways drag must scroll the STRIP and a downward
   drag must scroll the SHEET back up; neither may close it. The drift pauses under the finger, so what moves is the finger's. */
const finger=async(x0,y0,x1,y1)=>{ await pg.touchscreen.touchStart(x0,y0);
  for(let i=1;i<=6;i++){ await pg.touchscreen.touchMove(x0+(x1-x0)*i/6,y0+(y1-y0)*i/6); await new Promise(r=>setTimeout(r,16)); }
  await pg.touchscreen.touchEnd(); await new Promise(r=>setTimeout(r,120)); };
await finger(shop.strip.x,shop.strip.y,shop.strip.x-150,shop.strip.y);
const afterX=await pg.evaluate(()=>{ const sh=document.querySelector('#sheet'), m=sh.querySelector('.more');
  return {on:sh.classList.contains('on'),tf:sh.style.transform||'(none)',sl:m?m.scrollLeft:-1,top:sh.scrollTop}; });
await finger(shop.strip.x,shop.strip.y,shop.strip.x,shop.strip.y+150);
const afterY=await pg.evaluate(()=>{ const sh=document.querySelector('#sheet');
  return {on:sh.classList.contains('on'),tf:sh.style.transform||'(none)',top:sh.scrollTop,hash:location.hash}; });
const shop2=await pg.evaluate(async(before,X,Y,S)=>{
  const R=[];const ok=(n,c,x='')=>R.push(`${c?'  ✓':'  ✗'} ${n}${x?' — '+x:''}`);
  ok('a real sideways drag on a card scrolls the strip', X.sl-S.sl>60, `${S.sl} -> ${X.sl}`);
  ok('and leaves the sheet open, undragged', X.on&&!/translateY\(\d+(\.\d+)?px\)/.test(X.tf)&&X.top===S.top, `transform: ${X.tf}, scrollTop ${S.top} -> ${X.top}`);
  ok('a real drag DOWN from inside the strip scrolls the sheet back up', Y.top<X.top-40, `scrollTop ${X.top} -> ${Y.top}`);
  ok('rather than closing it', Y.on&&!/translateY\(\d+(\.\d+)?px\)/.test(Y.tf)&&Y.hash==='#m000001', `open ${Y.on}, transform: ${Y.tf}, ${Y.hash}`);
  const sh=document.querySelector('#sheet'), wrap=document.querySelector('.wrap'), h3=sh.querySelector('h3'), card=document.querySelector('.pgrid .pcard');
  const left=()=>sh.getBoundingClientRect().left;
  const x0=left();
  const touch=(type,y,target,x=200)=>{const t=new Touch({identifier:1,target,clientX:x,clientY:y});
    target.dispatchEvent(new TouchEvent(type,{touches:type==='touchend'?[]:[t],changedTouches:[t],bubbles:true,cancelable:true}));};
  sh.scrollTop=0; await new Promise(r=>setTimeout(r,60));

  // the title still pulls it down, centred all the way
  touch('touchstart',300,h3); touch('touchmove',340,h3);
  await new Promise(r=>setTimeout(r,30));
  ok('the title drags the sheet', /translateY/.test(sh.style.transform||''), sh.style.transform);
  ok('and it keeps its centring while dragged', /translateX\(-50%\)/.test(sh.style.transform||''), sh.style.transform);
  touch('touchmove',420,h3); touch('touchend',420,h3);
  await new Promise(r=>setTimeout(r,250));   // the close is a history step: popstate finishes it
  ok('a real pull closes it', !sh.classList.contains('on'));
  ok('the closed sheet is inert again', sh.inert===true);
  ok('the page is given back', !document.body.classList.contains('sheeting')&&wrap.inert===false&&!wrap.hasAttribute('aria-hidden'));
  ok('and it is back exactly where it was', Math.abs(window.scrollY-before)<2, window.scrollY+' vs '+before);
  ok('focus is back on the card that opened it', document.activeElement===card, document.activeElement?document.activeElement.className:'—');
  ok('and the address is the plain shop again', !location.hash, location.hash);
  ok('and the strip\'s loop stopped with the sheet', typeof DRIFT!=='undefined'&&!DRIFT.more);
  return R.join('\n');
}, shop.before, afterX, afterY, {sl:shop.sl,top:shop.top});
console.log(shop2);

await b.close(); srv.close();
