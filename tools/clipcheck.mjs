/* CLIPCHECK — the clip path driven by a real browser, because nothing else can.
   Everything in test/ runs in node, and node has no MediaRecorder, no canvas
   captureStream and no AudioContext — so the whole reason clips broke twice was
   invisible to the suite. This drives public/community.html in headless Chrome,
   makes a source video with a real tone in it, and checks the clip that comes out
   the other end ACTUALLY HAS SOUND, that nothing hangs when the phone refuses to
   wake its sound up, and that a lying codec is survived with the sound intact.

   Not part of `sh test/run.sh`: it needs Chrome and puppeteer-core, which live
   outside this repo. Run it by hand after touching anything in the CLIPS section:

     node tools/clipcheck.mjs

   Twenty checks, about forty seconds. See INVARIANTS 0eg–0ei. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from '/Users/perryidyll/Docs/MySet-Content/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';

const ROOT = '/Users/perryidyll/Docs/MySet/public';
const TYPES = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv = http.createServer((req,res)=>{
  const u = new URL(req.url,'http://x'); let p = path.join(ROOT, u.pathname);
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

  /* a source video WITH a real 440Hz tone in it, made the same way a phone makes one */
  async function makeSource(secs){
    const c=document.createElement('canvas'); c.width=320; c.height=240;
    const ctx=c.getContext('2d');
    const stream=c.captureStream(24);
    const ac=new AudioContext();
    const osc=ac.createOscillator(); osc.frequency.value=440;
    const g=ac.createGain(); g.gain.value=0.6;
    const dest=ac.createMediaStreamDestination();
    osc.connect(g); g.connect(dest); osc.start();
    dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));
    const mime=['video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    if(!mime) throw new Error('no recorder mime');
    const rec=new MediaRecorder(stream,{mimeType:mime});
    const chunks=[]; rec.ondataavailable=e=>{ if(e.data&&e.data.size) chunks.push(e.data); };
    const done=new Promise(r=>rec.onstop=r);
    rec.start(200);
    const t0=performance.now();
    await new Promise(res=>{ const draw=()=>{
      const e=performance.now()-t0;
      ctx.fillStyle='hsl('+((e/10)%360)+',80%,50%)'; ctx.fillRect(0,0,320,240);
      if(e>secs*1000){ rec.stop(); try{osc.stop();}catch(_){} ac.close(); return res(); }
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
      return {rms:Math.sqrt(s/d.length), dur:a.duration, ch:a.numberOfChannels};
    }catch(e){ return {err:String(e.message||e)}; }
    finally{ try{ await ac.close(); }catch(e){} }
  }

  const file = await makeSource(4);
  R.push(`  source: ${file.size} bytes`);

  // ---------- 1. the sound path ----------
  unlockAudio();
  await new Promise(r=>setTimeout(r,250));
  ok('the tap wakes the sound up', audioReady(), 'state='+(AUDIO_CTX&&AUDIO_CTX.state));

  const v1 = await loadVideo(file);
  ok('a length of Infinity is not treated as too long', !Number.isFinite(v1.duration) || v1.duration>0,
     'duration='+v1.duration);
  const au = await soundFor(file, Number.isFinite(v1.duration)?v1.duration:NaN, 4);
  ok('the soundtrack comes out of the file', !!au && typeof au.take==='function');

  let pct = [];
  const t0 = performance.now();
  const sz1 = clipSize(v1);
  const m1 = await pickMime(true, sz1.w, sz1.h);
  R.push('  chosen format (sound): '+m1);
  const blob = await reencode(v1, 4, p=>pct.push(p), ()=>{}, au.take(), m1);
  const took = Math.round(performance.now()-t0);
  ok('it finishes', !!blob && blob.size>0, blob?blob.size+' bytes in '+took+'ms':'');
  ok('the bar actually moved', pct.length>5 && Math.max(...pct)>0.5, 'max '+Math.round(Math.max(...pct,0)*100)+'%');

  const m = await measure(blob);
  ok('THE CLIP HAS SOUND IN IT', !m.err && m.rms>0.01, m.err ? m.err : 'rms '+m.rms.toFixed(4)+', '+m.dur.toFixed(1)+'s');

  // ---------- 2. the frozen bar: a context that never wakes ----------
  const real = AUDIO_CTX;
  let resumeCalls = 0;
  AUDIO_CTX = { state:'suspended', resume(){ resumeCalls++; return new Promise(()=>{}); } };
  ok('a sleeping context is not "ready"', audioReady()===false);
  const t1 = performance.now();
  const none = await soundFor(file, NaN, 4);
  const waited = performance.now()-t1;
  ok('asking for sound returns at once instead of hanging', none===null && waited<500, Math.round(waited)+'ms');
  ok('nothing ever awaited resume()', resumeCalls===0);

  const v2 = await loadVideo(file);
  const t2 = performance.now();
  const sz2 = clipSize(v2);
  const silent = await reencode(v2, 4, ()=>{}, ()=>{}, null, await pickMime(false, sz2.w, sz2.h));
  ok('a silent clip is still made', !!silent && silent.size>0, Math.round(performance.now()-t2)+'ms');
  AUDIO_CTX = real;

  // ---------- 3. the whole journey, exactly as a person does it ----------
  const labels=[]; const bars=[];
  const realProg = clipProgress;
  window.clipProgress = (p,l)=>{ if(p!==null){ bars.push(p); if(l) labels.push(l); } realProg(p,l); };
  const toasts=[]; window.toast = (t)=>toasts.push(t);
  window.render = ()=>{};
  let sent=null;
  window.uploadClip = (body,onPct)=>{ sent=JSON.parse(body); onPct(0.4); onPct(1); return Promise.resolve({ok:true,clip:'kabcdefghij'}); };
  DRAFT.clip = null;

  const t3 = performance.now();
  await Promise.race([ addClip(file), new Promise((_,rj)=>setTimeout(()=>rj(new Error('HUNG')),60000)) ])
    .catch(e=>R.push('  ✗ addClip: '+e.message));
  const journey = Math.round(performance.now()-t3);

  ok('the whole thing completes', !!DRAFT.clip, DRAFT.clip? 'clip '+DRAFT.clip.id+' in '+journey+'ms' : 'no clip');
  ok('the clip was uploaded', !!sent && sent.action==='clip' && (sent.data||'').startsWith('data:'));
  ok('a still went with it', !!sent && (sent.poster||'').startsWith('data:image'));
  ok('it never said the clip was silent', !toasts.some(t=>/silent/.test(t)), toasts.join(' | ')||'no toasts');
  ok('the bar only ever moves forward', bars.every((b,i)=>i===0||b>=bars[i-1]-0.001), bars.length+' steps');
  ok('the upload showed a percentage', labels.some(l=>/Uploading… \d+%/.test(l)), labels.filter(l=>/Upload/.test(l)).join(' → '));
  R.push('  formats tried: '+JSON.stringify(MIME_OK)+' bad: '+JSON.stringify(MIME_BAD));
  R.push('  labels: '+labels.filter((l,i,a)=>l!==a[i-1]).slice(0,6).join(' → ')+' … '+labels.slice(-4).join(' → '));

  // ---------- 4. a format that lies in the middle of a real clip ----------
  const realReencode = reencode;
  let calls=0, mimes=[];
  window.reencode = (v,secs,onPct,onAudio,au,mime)=>{
    mimes.push(mime); calls++;
    if(calls===1){ try{ if(au) au.stop(); }catch(e){} return Promise.reject(new Error('encoder')); }
    return realReencode(v,secs,onPct,onAudio,au,mime);
  };
  toasts.length=0; sent=null; DRAFT.clip=null;
  await Promise.race([ addClip(file), new Promise((_,rj)=>setTimeout(()=>rj(new Error('HUNG')),60000)) ])
    .catch(e=>R.push('  ✗ recovery addClip: '+e.message));
  ok('a broken format still ends in a clip', !!DRAFT.clip);
  ok('and it tried a DIFFERENT format second', mimes.length>1 && mimes[0]!==mimes[1], mimes.join(' then '));
  ok('and the sound survived the retry', !toasts.some(t=>/silent/.test(t)), toasts.join(' | ')||'no toasts');
  ok('the bad format was struck off', !!MIME_BAD[mimes[0]], JSON.stringify(MIME_BAD));
  const m4 = sent ? await measure(await (await fetch(sent.data)).blob()) : {err:'nothing sent'};
  ok('THE RECOVERED CLIP HAS SOUND IN IT', !m4.err && m4.rms>0.01, m4.err||'rms '+m4.rms.toFixed(4));
  window.reencode = realReencode;

  // ---------- 5. SAFARI'S FAILURE, SIMULATED: the decoder refuses the file ----------
  /* This is Perry's iPhone. decodeAudioData is specified for audio files and Safari
     routinely refuses a whole MP4 with a video track in it, which arrives as "that
     one came out silent" while the picture is perfect. Route two has to save it. */
  const realSoundFor = soundFor;
  window.soundFor = () => Promise.resolve(null);
  toasts.length = 0; sent = null; DRAFT.clip = null;
  await Promise.race([ addClip(file), new Promise((_,rj)=>setTimeout(()=>rj(new Error('HUNG')),60000)) ])
    .catch(e=>R.push('  ✗ safari addClip: '+e.message));
  ok('a refused decoder still ends in a clip', !!DRAFT.clip);
  ok('and it is NOT reported silent', !toasts.some(t=>/silent/.test(t)), toasts.join(' | ')||'no toasts');
  const m5 = sent ? await measure(await (await fetch(sent.data)).blob()) : {err:'nothing sent'};
  ok('THE ELEMENT ROUTE CARRIED THE SOUND', !m5.err && m5.rms>0.01, m5.err||'rms '+m5.rms.toFixed(4));

  // ---------- 6. a video that genuinely has no sound says so ----------
  async function makeSilent(secs){
    const c=document.createElement('canvas'); c.width=320;c.height=240;
    const ctx=c.getContext('2d'); const st=c.captureStream(24);
    const mime=['video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
    const r=new MediaRecorder(st,{mimeType:mime}); const ch=[];
    r.ondataavailable=e=>{ if(e.data&&e.data.size) ch.push(e.data); };
    const done=new Promise(z=>r.onstop=z); r.start(200); const t0=performance.now();
    await new Promise(z=>{ const d=()=>{ const e=performance.now()-t0;
      ctx.fillStyle='hsl('+((e/10)%360)+',80%,50%)'; ctx.fillRect(0,0,320,240);
      if(e>secs*1000){ r.stop(); return z(); } requestAnimationFrame(d); }; d(); });
    await done; return new File([new Blob(ch,{type:'video/webm'})],'quiet.webm',{type:'video/webm'});
  }
  window.soundFor = realSoundFor;
  const quiet = await makeSilent(3);
  toasts.length = 0; sent = null; DRAFT.clip = null;
  await Promise.race([ addClip(quiet), new Promise((_,rj)=>setTimeout(()=>rj(new Error('HUNG')),60000)) ])
    .catch(e=>R.push('  ✗ quiet addClip: '+e.message));
  ok('a silent video still becomes a clip', !!DRAFT.clip);
  ok('and it is told WHY it is silent, not blamed on the phone',
     toasts.some(t=>/no sound in that video|doesn.t have any sound|no sound came through|couldn.t get at the sound/.test(t)),
     toasts.join(' | ')||'no toasts');

  return R.join('\n');
});
console.log(out);
await browser.close(); srv.close();
