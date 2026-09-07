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

await b.close(); srv.close();
