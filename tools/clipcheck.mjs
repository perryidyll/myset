/* CLIPCHECK — the clip path driven by a real browser, because nothing else can.
   Everything in test/ runs in node, and node has no File, no <video> and no
   MediaRecorder, so the browser half of this feature was invisible to the suite.

   WHAT THIS CHECKS NOW IS MUCH SMALLER THAN IT WAS, and that is the point. The
   phone used to re-film every clip onto a canvas to shrink it, which is why clips
   kept arriving silent — a canvas has no sound, so the audio had to be found and
   mixed back separately. All of that is deleted. The file goes up as it is, in
   pieces, and the decisive assertion here is that the bytes the page sends are
   BYTE-FOR-BYTE the file that was picked, and that decoding them still finds the
   tone that was recorded into it.

   Run it by hand after touching the CLIPS section of public/community.html:

     node tools/clipcheck.mjs

   Needs Chrome and puppeteer-core, which live outside this repo, so it is not part
   of `sh test/run.sh`. See INVARIANTS 0es. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from '/Users/perryidyll/Docs/MySet-Content/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const ROOT = '/Users/perryidyll/Docs/MySet/public';
const TYPES = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req,res)=>{
  const u = new URL(req.url,'http://x'); const p = path.join(ROOT, u.pathname);
  if(!fs.existsSync(p) || fs.statSync(p).isDirectory()){ res.writeHead(404); return res.end('no'); }
  res.writeHead(200,{'content-type':TYPES[path.extname(p)]||'application/octet-stream'});
  fs.createReadStream(p).pipe(res);
});
/* PORT 0, NOT A FIXED ONE. A previous run that did not shut down cleanly leaves the
   port held, and the next run dies with EADDRINUSE before a single check executes —
   which reads exactly like a broken feature. Let the OS pick. */
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const PORT = srv.address().port;

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--use-fake-ui-for-media-stream',
        '--use-gl=swiftshader','--enable-unsafe-swiftshader','--mute-audio']
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', String(e).slice(0,200)));
await page.goto(`http://127.0.0.1:${PORT}/community.html?a=demo`, {waitUntil:'domcontentloaded'});
await new Promise(r=>setTimeout(r,900));

const out = await page.evaluate(async () => {
  const R = [];
  const ok = (name, cond, extra='') => R.push(`${cond?'  ✓':'  ✗'} ${name}${extra?' — '+extra:''}`);

  /* A source file with a real 440Hz tone in it, made the way a phone makes one. */
  async function makeSource(secs, withTone = true){
    const c=document.createElement('canvas'); c.width=320; c.height=240;
    const ctx=c.getContext('2d');
    const stream=c.captureStream(24);
    const ac=new AudioContext();
    if(withTone){
      const osc=ac.createOscillator(); osc.frequency.value=440;
      const g=ac.createGain(); g.gain.value=0.6;
      const dest=ac.createMediaStreamDestination();
      osc.connect(g); g.connect(dest); osc.start();
      dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    }
    const mime=['video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    const rec=new MediaRecorder(stream,{mimeType:mime});
    const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
    const done=new Promise(r=>rec.onstop=r);
    rec.start(200);
    const t0=performance.now();
    await new Promise(res=>{ const draw=()=>{
      const e=performance.now()-t0;
      ctx.fillStyle='hsl('+((e/10)%360)+',80%,50%)'; ctx.fillRect(0,0,320,240);
      if(e>secs*1000){ rec.stop(); ac.close(); return res(); }
      requestAnimationFrame(draw); }; draw(); });
    await done;
    return new File([new Blob(chunks,{type:'video/webm'})],'src.webm',{type:'video/webm'});
  }
  async function measure(blob){
    const ac=new AudioContext();
    try{
      const a=await ac.decodeAudioData(await blob.arrayBuffer());
      const d=a.getChannelData(0); let s=0;
      for(let i=0;i<d.length;i++) s+=d[i]*d[i];
      return {rms:Math.sqrt(s/d.length), dur:a.duration};
    }catch(e){ return {err:String(e.message||e)}; }
    finally{ try{ await ac.close(); }catch(e){} }
  }

  // ---------- the network, stubbed so the pieces can be inspected ----------
  const toasts=[]; window.toast=(t)=>toasts.push(t);
  window.render=()=>{};
  const bars=[]; const labels=[];
  const realProg = clipProgress;
  window.clipProgress=(p,l)=>{ if(p!==null){ bars.push(p); if(l) labels.push(l); } realProg(p,l); };

  let begun=null, ended=null, sentPieces=[];
  const realFetch = window.fetch;
  window.fetch = async (url, opts)=>{
    const u=String(url);
    if(/\/clipup.*begin=1/.test(u)){
      begun=JSON.parse(opts.body);
      /* A DELIBERATELY TINY CHUNK. The server says 4MB, but the point of this stub
         is to exercise the page's slicing loop — with a real 4MB chunk an 80KB test
         file is one piece and the loop never runs more than once. */
      const CH=30000, parts=Math.ceil(begun.size/CH);
      return new Response(JSON.stringify({ok:true, clip:'kabcdefghij', parts, chunk:CH}));
    }
    if(/\/clipup.*end=1/.test(u)){
      ended=JSON.parse(opts.body);
      return new Response(JSON.stringify({ok:true, clip:'kabcdefghij', seconds:4, bytes:0}));
    }
    return realFetch(url, opts);
  };
  window.sendPiece = async (path, blob)=>{
    const i = Number(/i=(\d+)/.exec(path)[1]);
    sentPieces[i] = new Uint8Array(await blob.arrayBuffer());
    return {ok:true, i};
  };

  const file = await makeSource(4);
  R.push(`  source: ${file.size} bytes, ${file.type}`);

  // ---------- 1. a file over the limit never leaves the phone ----------
  DRAFT.clip=null; toasts.length=0; begun=null;
  const huge = new File([new Uint8Array(CLIP_MAX + 10)], 'big.mp4', {type:'video/mp4'});
  await addClip(huge);
  ok('a file over the limit is refused', !DRAFT.clip);
  ok('and nothing was sent for it', begun===null);
  ok('the refusal names the size AND what to do',
     toasts.some(t=>/\d+\.\dMB/.test(t) && /Trim it/.test(t)), toasts.join(' | '));

  // ---------- 2. a clip longer than thirty seconds ----------
  const realLoad = loadVideo;
  window.loadVideo = async () => { const v = await realLoad(file); Object.defineProperty(v,'duration',{value:45,configurable:true}); return v; };
  DRAFT.clip=null; toasts.length=0; begun=null;
  await addClip(file);
  ok('a clip over thirty seconds is refused', !DRAFT.clip && begun===null);
  ok('and it is told how long it actually is', toasts.some(t=>/45/.test(t)), toasts.join(' | '));
  window.loadVideo = realLoad;

  // ---------- 3. the ordinary journey ----------
  DRAFT.clip=null; toasts.length=0; begun=null; ended=null; sentPieces=[];
  bars.length=0; labels.length=0;
  const t0=performance.now();
  await Promise.race([ addClip(file), new Promise((_,rj)=>setTimeout(()=>rj(new Error('HUNG')),60000)) ])
    .catch(e=>R.push('  ✗ addClip: '+e.message));
  const took=Math.round(performance.now()-t0);

  ok('the clip is added', !!DRAFT.clip, DRAFT.clip? 'in '+took+'ms' : 'no clip');
  ok('the server was told the real size up front', begun && begun.size===file.size, JSON.stringify(begun));
  ok('a still went with it', !!(ended && (ended.poster||'').startsWith('data:image')));
  ok('nothing was said about sound at all', !toasts.some(t=>/silent|sound/i.test(t)), toasts.join(' | ')||'no toasts');
  ok('the bar only ever moves forward', bars.every((b,i)=>i===0||b>=bars[i-1]-0.001), bars.length+' steps');
  ok('and it counted the upload', labels.some(l=>/Uploading… \d+%/.test(l)));

  // ---------- 4. THE ONE THAT MATTERS ----------
  const joined = new Uint8Array(sentPieces.reduce((n,p)=>n+p.length,0));
  let at=0; for(const p of sentPieces){ joined.set(p,at); at+=p.length; }
  const original = new Uint8Array(await file.arrayBuffer());
  ok('every piece arrived', sentPieces.length>0 && sentPieces.every(Boolean), sentPieces.length+' pieces');
  ok('THE PIECES ARE THE FILE, BYTE FOR BYTE',
     joined.length===original.length && joined.every((b,i)=>b===original[i]),
     joined.length+' vs '+original.length);

  const m = await measure(new Blob([joined],{type:'video/webm'}));
  ok('AND THE SOUND IS STILL IN IT', !m.err && m.rms>0.01, m.err||'rms '+m.rms.toFixed(4)+', '+m.dur.toFixed(1)+'s');

  // ---------- 5. the preview plays the original, not a re-encode ----------
  ok('the preview plays the file off the phone', (DRAFT.clip.src||'').startsWith('blob:'));

  return R.join('\n');
});
console.log(out);
await browser.close(); srv.close();
