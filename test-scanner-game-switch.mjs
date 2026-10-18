// Pure production-controller fixtures: no browser/server, real camera, provider,
// external network, credentials, photos or screenshots are used.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {registerScanner,releaseOCR} from './scancam.js';
import {loadBatch,saveBatch} from './scan-batch.js';
import {loadSession,saveSession,savePrefs,loadPrefs} from './scansession.js';

const storage=new Map(),elements=new Map(),images=[],blobs=[],revoked=[],created=[];
let fixtureRequests=0,priorCtx=null;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const wait=async predicate=>{for(let i=0;i<300&&!predicate();i++)await tick();assert(predicate(),'fixture operation settled');};
function canvas(label='fixture',width=480,height=672){
  const c={label,width,height};
  c.getContext=()=>({drawImage(source){c.label=source.label;},translate(){},rotate(){},getImageData(x,y,w=16,h=22){return {data:new Uint8ClampedArray(w*h*4).fill(110)};},putImageData(){}});
  c.toDataURL=()=>`data:image/jpeg;base64,${c.label}`;
  c.toBlob=resolve=>blobs.push({resolve,label:c.label});
  return c;
}
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
globalThis.document={getElementById:id=>elements.get(id)||null,querySelector:()=>elements.get('sheet')||null,querySelectorAll:()=>[],createElement:()=>canvas(),addEventListener(){},removeEventListener(){}};
globalThis.location={href:'http://fixture.invalid/'};
globalThis.window={scrollTo(){},matchMedia:()=>({matches:true}),Tesseract:{createWorker:async()=>({recognize:async()=>({data:{text:'?'}}),terminate:async()=>{}})}};
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{},vibrate(){}},configurable:true});
globalThis.fetch=async url=>{assert.match(String(url),/^scanidx\/(?:manifest\.json|(?:mtg|ptcg|ygo)(?:\.bin|-ids\.txt))$/,'only local catalogue fixture routes may be requested');fixtureRequests++;return {ok:false};};
globalThis.Image=class{set src(url){this.url=url;this.label=url;this.naturalWidth=480;this.naturalHeight=672;images.push(this);}};
URL.createObjectURL=blob=>{const url=`blob:fixture-${created.length}-${blob?.label||'photo'}`;created.push(url);return url;};
URL.revokeObjectURL=url=>revoked.push(url);
const games=['mtg','ygo','ptcg'];
const finishes={mtg:'nonfoil',ygo:'unlimited',ptcg:'normal'};
const bolt={id:'bolt',name:'Lightning Bolt',set:'msc',collector_number:'806',finishes:['nonfoil','foil']};
const candidate={id:bolt.id,name:bolt.name,card:bolt,exact:true};
const row=(id='review',game='mtg')=>({id,captureRevision:`revision-${id}`,game,shot:`thumb-${id}`,originalShot:`original-${id}`,status:'review',qty:2,condition:'Lightly Played',lang:'ja',finish:finishes[game],location:'Binder A',cands:[candidate],read:{name:bolt.name,code:'U 0806\nMSC EN'},defaults:{lockSet:'source-only'}});
function setup(game='mtg',overrides={}){
  priorCtx?.stopCamera();storage.clear();elements.clear();images.length=0;blobs.length=0;revoked.length=0;created.length=0;
  S.state=blank();S.state.settings.game=game;S.ui.view='scan';S.ui.sheetCtx=null;S.ui.scan={};saveBatch([]);
  for(const g of games)savePrefs(g,{finish:finishes[g],lockSet:`set-${g}`,sounds:false,haptics:false});
  const counts={renders:0,toasts:[],sheets:0,adds:[]};
  const ctx={A:{},C:{},game:()=>S.state.settings.game,render(){counts.renders++;},toast:m=>counts.toasts.push(m),priceOf:()=>5,setOf:()=>'',numberOf:()=>'',match:async()=>({cands:[candidate],tried:[]}),addMany:async(g,items)=>counts.adds.push({g,items}),openSheet:(html,context)=>{counts.sheets++;S.ui.sheetCtx=context;},...overrides};
  registerScanner(ctx);priorCtx=ctx;return {ctx,counts};
}
function change(ctx,target){const source=S.state.settings.game;assert.equal(ctx.beforeGameChange(source,target),true);S.state.settings.game=target;assert.equal(ctx.afterGameChange(target),true);}
function roundTrip(ctx){const source=S.state.settings.game,target=games.find(g=>g!==source);change(ctx,target);change(ctx,source);}
function replace(ctx,kind='replace',target=S.state.settings.game){const source=S.state.settings.game;assert.equal(ctx.beforeGameChange(source,target,{workspace:true,kind}),true);S.state.settings.game=target;assert.equal(ctx.afterGameChange(target),true);}
async function liveCamera(ctx){
  let stops=0,opens=0,attachments=0;
  const track={readyState:'live',stop(){stops++;this.readyState='ended';},getCapabilities:()=>({torch:true})};
  const stream={getTracks:()=>[track],getVideoTracks:()=>[track]},create=document.createElement;
  navigator.mediaDevices.getUserMedia=async()=>{opens++;return stream;};
  const video={paused:false,setAttribute(){},play:async()=>{video.paused=false;}};
  document.createElement=tag=>tag==='video'?video:create(tag);
  const attach=()=>{Object.assign(S.ui.scan,{catalogInitGame:S.state.settings.game,ocrWarm:true});elements.set('camSlot',{replaceWith:v=>{assert.equal(v,video);attachments++;elements.set('scanVideo',v);}});ctx.afterRender();};
  try{await ctx.A.scanStart();attach();}finally{document.createElement=create;}
  return {track,stream,video,attach,get stops(){return stops;},get opens(){return opens;},get attachments(){return attachments;}};
}
const resolveImage=()=>{const img=images.shift();assert(img);img.onload();return img;};

try{
  // All six directions, durable mixed-game records, and each game's own draft.
  for(const source of games)for(const target of games.filter(g=>g!==source)){
    const {ctx}=setup(source);
    for(const g of games)saveSession(g,[{id:`session-${g}`,qty:3,finish:finishes[g],condition:'Damaged',lang:'de'}]);
    const sessions=games.map(g=>JSON.stringify(loadSession(g))),preferences=games.map(g=>JSON.stringify(loadPrefs(g)));
    const ready=games.map(g=>({...row(`ready-${g}`,g),status:'ready'}));saveBatch([...ready,row('review',source)]);
    Object.assign(S.ui.scan,{mode:'photo',url:`blob:${source}`,rot:2,crop:{x:.1,y:.2,w:.6,h:.7},auto:false});
    ctx.A.scanBatchReview({dataset:{id:'review'}});
    Object.assign(S.ui.scan.confirm,{qty:7,condition:'Heavily Played',lang:'fr',finish:finishes[source],i:0});
    const state=S.ui.scan,before=JSON.stringify(loadBatch());
    assert.equal(ctx.beforeGameChange(source,source),true);assert.equal(S.ui.scan,state);assert.equal(JSON.stringify(loadBatch()),before);
    change(ctx,target);
    assert.equal(S.ui.scan.confirm,null);assert.deepEqual(S.ui.scan.cands,[]);assert.equal(S.ui.scan.camOn,false);assert.equal(S.ui.scan.busy,false);assert.equal(S.ui.scan.url,null);assert.equal(S.ui.scan.mode,'live');
    assert.deepEqual(loadBatch().slice(0,3),ready,'ready rows never change');
    const review=loadBatch().find(x=>x.id==='review');assert.equal(review.game,source);assert.equal(review.qty,7);assert.equal(review.condition,'Heavily Played');assert.equal(review.lang,'fr');assert.equal(review.captureRevision,'revision-review');assert.equal(review.originalShot,'original-review');assert.equal(review.location,'Binder A');
    Object.assign(S.ui.scan,{mode:'photo',url:`blob:${target}`,rot:1,crop:{x:.2,y:.1,w:.7,h:.6}});
    change(ctx,source);
    assert.equal(S.ui.scan.url,`blob:${source}`);assert.equal(S.ui.scan.rot,2);assert.deepEqual(S.ui.scan.crop,{x:.1,y:.2,w:.6,h:.7});assert.equal(S.ui.scan.auto,false);assert.equal(S.ui.scan.confirm,null);
    change(ctx,target);assert.equal(S.ui.scan.url,`blob:${target}`);assert.equal(S.ui.scan.rot,1);
    assert.deepEqual(games.map(g=>JSON.stringify(loadSession(g))),sessions);assert.deepEqual(games.map(g=>JSON.stringify(loadPrefs(g))),preferences);assert.deepEqual(revoked,[],'switches transfer URL ownership without revoking another game’s draft');
    ctx.C.scanFile({files:[{type:'image/png',label:'replacement'}]});assert.deepEqual(revoked,[`blob:${target}`],'only replaced active photo is revoked');
    change(ctx,source);assert.equal(S.ui.scan.url,`blob:${source}`);
  }
  console.log('PASS: all six directed switches preserve per-game photo/crop/rotation/mode and durable sessions/reviews; target starts idle with its own defaults and URL ownership.');

  // Saving gates are side-effect-free; rollback reconstitutes a fresh review.
  {
    const {ctx,counts}=setup();Object.assign(S.ui.scan,{url:'blob:source',mode:'photo',crop:{x:.1,y:.1,w:.8,h:.8}});saveBatch([row()]);ctx.A.scanBatchReview({dataset:{id:'review'}});
    for(const kind of ['batchSaving','confirm','sessionSaving']){
      if(kind==='confirm')S.ui.scan.confirm.saving=true;else S.ui.scan[kind]=true;
      const st=S.ui.scan,snapshot=JSON.stringify(st),batch=JSON.stringify(loadBatch());assert.equal(ctx.beforeGameChange('mtg','ygo'),false);assert.equal(S.ui.scan,st);assert.equal(JSON.stringify(st),snapshot);assert.equal(JSON.stringify(loadBatch()),batch);assert.deepEqual(revoked,[]);
      if(kind==='confirm')st.confirm.saving=false;else st[kind]=false;
    }
    const review=S.ui.scan.confirm;review.qty=9;
    assert.equal(ctx.beforeGameChange('mtg','ygo'),true);assert.equal(ctx.afterGameChange('mtg'),true);
    assert.notEqual(S.ui.scan.confirm,review);assert.equal(S.ui.scan.confirm.qty,9);assert.equal(S.ui.scan.url,'blob:source');assert.equal(S.ui.scan.camOn,false);assert.equal(S.ui.scan.confirm.pickerOpening,false);assert.equal(counts.toasts.length,3);
    assert.equal(ctx.afterGameChange('mtg'),false,'duplicate restore is a no-op');
  }
  console.log('PASS: save gates preserve the entire source state; failed settings commit restores usable photo and review without camera restart.');

  // Both getUserMedia outcomes are obsolete after A → B → A, including fallback.
  for(const outcome of ['resolve','reject']){
    const {ctx,counts}=setup(),gate=deferred();let stops=0,opens=0;
    savePrefs('mtg',{camera:'chosen-camera'});navigator.mediaDevices.getUserMedia=()=>{opens++;return gate.promise;};
    const start=ctx.A.scanStart();roundTrip(ctx);const renders=counts.renders;
    if(outcome==='resolve')gate.resolve({getTracks:()=>[{stop:()=>stops++}],getVideoTracks:()=>[]});else gate.reject(Error('NotAllowed'));
    await start;assert.equal(opens,1,'no fallback permission attempt after retirement');assert.equal(stops,outcome==='resolve'?1:0);assert.equal(S.ui.scan.camOn,false);assert.equal(S.ui.scan.status,'');assert.equal(counts.renders,renders);
  }
  {
    const {ctx}=setup();let stops=0,opens=0;const track={stop:()=>stops++,getCapabilities:()=>({})};
    navigator.mediaDevices.getUserMedia=async()=>{opens++;return {getTracks:()=>[track],getVideoTracks:()=>[track]};};
    await ctx.A.scanStart();assert.equal(S.ui.scan.camOn,true);change(ctx,'ptcg');assert.equal(stops,1);assert.equal(opens,1);assert.equal(S.ui.scan.camOn,false);
  }
  console.log('PASS: live tracks stop, delayed camera streams are released, stale failures cannot paint or reopen permission, and target never auto-starts.');

  // Only explicit same-game Undo may retain an already-live device. Each
  // transition still installs a fresh callback owner and preserves capture IDs.
  for(const source of games)for(const kind of ['undo','replace','import','recovery','reset']){
    const {ctx}=setup(source),cam=await liveCamera(ctx);saveBatch([row('pending',source)]);const before=JSON.stringify(loadBatch()),old=S.ui.scan;
    S.ui.scan.torch=true;replace(ctx,kind);cam.attach();
    assert.notEqual(S.ui.scan,old,'a retained stream does not retain async callback authority');
    assert.equal(JSON.stringify(loadBatch()),before);assert.equal(cam.opens,1,'replacement never requests fresh camera permission');
    assert.equal(S.ui.scan.camOn,kind==='undo');assert.equal(cam.stops,kind==='undo'?0:1);
    assert.equal(cam.video.srcObject,kind==='undo'?cam.stream:null);
    if(kind==='undo'){assert.equal(cam.track.readyState,'live');assert.equal(S.ui.scan.torch,true);assert.equal(cam.attachments,2,'the same video is moved into the fresh render');}
  }
  for(const target of ['ygo','ptcg']){
    const {ctx}=setup(),cam=await liveCamera(ctx);replace(ctx,'undo',target);
    assert.equal(cam.stops,1);assert.equal(S.ui.scan.camOn,false,'cross-game Undo is a full stop');
  }
  {
    const {ctx}=setup(),cam=await liveCamera(ctx);
    assert.equal(ctx.beforeGameChange('mtg','mtg',{workspace:true,kind:'undo'}),true);assert.equal(cam.stops,0);
    S.state.settings.game='ygo';assert.equal(ctx.afterGameChange('ygo'),true);
    assert.equal(cam.stops,1);assert.equal(cam.video.srcObject,null);assert.equal(S.ui.scan.camOn,false,'newer cross-game intent cannot inherit the retained device');
  }
  for(const outcome of ['resolve','reject']){
    const {ctx,counts}=setup(),gate=deferred();let stops=0,opens=0;
    savePrefs('mtg',{camera:'chosen-camera'});navigator.mediaDevices.getUserMedia=()=>{opens++;return gate.promise;};
    const pending=ctx.A.scanStart();replace(ctx,'undo');const renders=counts.renders;
    if(outcome==='resolve')gate.resolve({getTracks:()=>[{stop:()=>stops++}],getVideoTracks:()=>[]});else gate.reject(Error('NotAllowed'));
    await pending;assert.equal(stops,outcome==='resolve'?1:0);assert.equal(opens,1);assert.equal(S.ui.scan.camOn,false);assert.equal(counts.renders,renders);
  }
  console.log('PASS: same-game Undo retains the same live stream/video only; ordinary replacements, cross-game Undo and superseding navigation stop it, and pending camera callbacks remain retired.');

  {
    const {ctx}=setup(),cam=await liveCamera(ctx),now=Date.now;let time=now();
    Object.assign(cam.video,{videoWidth:640,videoHeight:900,clientWidth:378,clientHeight:400,label:'held-same-card'});
    try{
      Date.now=()=>time;ctx.A.scanCapture();assert.equal(loadBatch().length,1);const firstId=loadBatch()[0].id;
      replace(ctx,'undo');cam.attach();ctx.A.scanCapture();
      assert.equal(loadBatch().length,1,'Undo preserves the held-card latch and same-frame debounce');assert.equal(loadBatch()[0].id,firstId);
      time+=601;ctx.A.scanCapture();assert.equal(loadBatch().length,2,'a deliberate later manual copy remains available');assert.equal(cam.stops,0);
    }finally{Date.now=now;cam.video.videoWidth=0;}
    await wait(()=>!S.ui.scan.busy);ctx.stopCamera();
  }
  console.log('PASS: same-game Undo preserves held-card duplicate suppression and the real shutter debounce without blocking a deliberate later copy.');

  // Image decoding and the later rotation blob callback each retire independently.
  for(const action of ['scanRead','scanRotate']){
    const {ctx,counts}=setup();Object.assign(S.ui.scan,{url:'blob:source',mode:'photo',rot:2,crop:{x:.1,y:.1,w:.7,h:.7}});
    const pending=ctx.A[action]();roundTrip(ctx);const renders=counts.renders;resolveImage();await pending;
    assert.equal(S.ui.scan.url,'blob:source');assert.equal(S.ui.scan.rot,2);assert.equal(S.ui.scan.photoLoading,false);assert.equal(loadBatch().length,0);assert.deepEqual(revoked,[]);assert.equal(counts.renders,renders);
  }
  {
    const {ctx,counts}=setup();Object.assign(S.ui.scan,{url:'blob:rotate',mode:'photo',rot:1});const pending=ctx.A.scanRotate();resolveImage();await tick();assert.equal(blobs.length,1);
    roundTrip(ctx);const renders=counts.renders;blobs.shift().resolve({label:'rotated'});await pending;
    assert.equal(S.ui.scan.url,'blob:rotate');assert.equal(S.ui.scan.rot,1);assert.deepEqual(revoked,[]);assert.deepEqual(created,[]);assert.equal(counts.renders,renders);
    const rotated=ctx.A.scanRotate();resolveImage();await tick();blobs.shift().resolve({label:'new-rotation'});await rotated;
    assert.equal(S.ui.scan.rot,2);assert.deepEqual(revoked,['blob:rotate']);const url=S.ui.scan.url;roundTrip(ctx);assert.equal(S.ui.scan.url,url);assert.equal(S.ui.scan.rot,2);
  }
  for(const outcome of ['resolve','reject']){
    const {ctx,counts}=setup();saveBatch([row()]);ctx.A.scanBatchReview({dataset:{id:'review'}});const retry=ctx.A.scanRetry();roundTrip(ctx);const renders=counts.renders,original=JSON.stringify(loadBatch());
    const img=images.shift();if(outcome==='resolve')img.onload();else img.onerror();await retry;
    assert.equal(JSON.stringify(loadBatch()),original);assert.equal(counts.renders,renders);assert.equal(S.ui.scan.confirm,null);
  }
  console.log('PASS: delayed photo read, rotation decode/blob, and stored-capture retry success/failure cannot recapture or overwrite a returned game’s photo.');

  // Lookup progress, success and rejection must all be visit-bound.
  for(const outcome of ['resolve','reject']){
    const gate=deferred();let progress;const {ctx,counts}=setup('mtg',{match:async(g,r,l,m,status)=>{progress=status;return gate.promise;}});elements.set('scanName',{value:'Lightning Bolt'});
    const pending=ctx.A.scanFind();roundTrip(ctx);const renders=counts.renders;progress('Obsolete lookup');
    if(outcome==='resolve')gate.resolve({cands:[candidate],tried:['old']});else gate.reject(Error('old failure'));
    await pending;assert.equal(S.ui.scan.status,'');assert.equal(S.ui.scan.confirm,null);assert.deepEqual(S.ui.scan.cands,[]);assert.equal(counts.renders,renders);
  }
  // Condition price, printing selection/cancel, and delayed review hydration.
  {
    const picker=deferred(),detail=deferred();let quote,selection;
    const {ctx,counts}=setup('mtg',{requestConditionPrice:(g,c,f,s,callback,isCurrent)=>{quote={callback,isCurrent};},openPrintingPicker:options=>{selection=options;return picker.promise;},candById:()=>detail.promise});
    saveBatch([row()]);ctx.A.scanBatchReview({dataset:{id:'review'}});const old=quote;const pending=ctx.A.scanChangePrinting();
    roundTrip(ctx);const renders=counts.renders,batch=JSON.stringify(loadBatch());assert.equal(old.isCurrent(),false);old.callback({status:'ready'});assert.equal(selection.isCurrent(),false);assert.equal(selection.onCancel(),false);assert.equal(selection.onSelect({candidate:{...candidate,game:'mtg'},finish:'foil'}),false);
    picker.reject(Error('old picker error'));await pending;assert.equal(counts.renders,renders);assert.equal(JSON.stringify(loadBatch()),batch);
    ctx.A.scanBatchReview({dataset:{id:'review'}});S.ui.scan.cands[0]={...candidate,detailsOnly:true};S.ui.scan.catalogInitGame='mtg';S.ui.scan.ocrWarm=true;ctx.afterRender();roundTrip(ctx);const after=counts.renders;detail.resolve({...candidate,detailsOnly:false});await tick();assert.equal(counts.renders,after);assert.equal(S.ui.scan.confirm,null);
  }
  {
    const devices=deferred(),{ctx,counts}=setup();navigator.mediaDevices.enumerateDevices=()=>devices.promise;elements.set('sheet',{});
    const pending=ctx.A.scanSettings();roundTrip(ctx);const sheets=counts.sheets;devices.resolve([{kind:'videoinput',deviceId:'old'}]);await pending;assert.equal(counts.sheets,sheets);
  }
  console.log('PASS: lookup progress/results/errors, quote, printing picker callbacks, review hydration and device enumeration remain retired across A → B → A.');

  for(const kind of ['undo','replace']){
    const lookup=deferred(),picker=deferred();let progress,selection,quote;
    const {ctx,counts}=setup('mtg',{match:async(g,r,l,m,status)=>{progress=status;return lookup.promise;},requestConditionPrice:(g,c,f,s,callback,isCurrent)=>{quote={callback,isCurrent};},openPrintingPicker:options=>{selection=options;return picker.promise;}});
    const cam=await liveCamera(ctx);elements.set('scanName',{value:'Lightning Bolt'});const pending=ctx.A.scanFind();replace(ctx,kind);const renders=counts.renders;
    progress('Old result');lookup.resolve({cands:[candidate],tried:['old']});await pending;
    assert.equal(counts.renders,renders);assert.deepEqual(S.ui.scan.cands,[]);assert.equal(S.ui.scan.confirm,null);
    saveBatch([row()]);ctx.A.scanBatchReview({dataset:{id:'review'}});const old=quote,printing=ctx.A.scanChangePrinting();replace(ctx,kind);
    // Same textual capture ID, different capture identity: no old picker/quote
    // may overwrite this newer review after the workspace transaction.
    saveBatch([{...row(),captureRevision:'new-revision',qty:11}]);ctx.A.scanBatchReview({dataset:{id:'review'}});
    const batch=JSON.stringify(loadBatch()),paint=counts.renders;
    assert.equal(old.isCurrent(),false);old.callback({status:'ready'});assert.equal(selection.isCurrent(),false);assert.equal(selection.onSelect({candidate:{...candidate,game:'mtg'},finish:'foil'}),false);assert.equal(selection.onCancel(),false);
    picker.reject(Error('old picker error'));await printing;
    assert.equal(counts.renders,paint);assert.equal(JSON.stringify(loadBatch()),batch);assert.equal(S.ui.scan.confirm.qty,11);assert.equal(cam.stops,kind==='undo'?0:1);
  }
  console.log('PASS: same-game Undo/replacement invalidates late lookup, price and picker callbacks even when capture IDs collide.');

  // Keep late device/canvas callbacks from mutating or opening the new visit.
  {
    const gate=deferred(),{ctx,counts}=setup();let stopped=0;
    const track={stop:()=>stopped++,getCapabilities:()=>({torch:true}),applyConstraints:()=>gate.promise};
    navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[track],getVideoTracks:()=>[track]});
    await ctx.A.scanStart();const pending=ctx.A.scanTorch();roundTrip(ctx);const renders=counts.renders;gate.resolve();await pending;
    assert.equal(stopped,1);assert.equal(S.ui.scan.torch,undefined);assert.equal(counts.renders,renders);
  }
  {
    const {ctx,counts}=setup();let closed=0;window.open=()=>({document:{},close:()=>closed++,location:{}});S.ui.scan.lastCard=canvas('lens-source');
    const pending=ctx.A.scanLens();roundTrip(ctx);const renders=counts.renders;blobs.shift().resolve({label:'lens-source'});await pending;
    assert.equal(closed,1);assert.equal(S.ui.scan.status,'');assert.equal(counts.renders,renders);
  }
  {
    const {ctx}=setup(),box={style:{}},wrap={getBoundingClientRect:()=>({left:0,top:0,width:100,height:100}),setPointerCapture(){}};
    elements.set('cropWrap',wrap);elements.set('cropBox',box);S.ui.scan.catalogInitGame='mtg';S.ui.scan.ocrWarm=true;ctx.afterRender();
    wrap.onpointerdown({clientX:10,clientY:10,pointerId:1,preventDefault(){}});roundTrip(ctx);wrap.onpointermove({clientX:80,clientY:90});wrap.onpointerup();assert.equal(S.ui.scan.crop,null);
  }
  console.log('PASS: retired torch, Lens encoding and detached crop gesture callbacks cannot affect the new visit.');

  // An in-flight source OCR plus queued capture are retained as retryable; an
  // explicit new capture in the returned game drains after the retired read.
  for(const kind of ['game','undo']){
    await releaseOCR();const first=deferred();let started=false;const reads=new Map();
    window.Tesseract={createWorker:async()=>({recognize:async c=>{const n=reads.get(c.label)||0;reads.set(c.label,n+1);if(c.label==='old-first'&&n===0){started=true;await first.promise;}return {data:{text:n%2?'U 0806\nMSC EN':'Lightning Bolt'}};},terminate:async()=>{}})};
    const {ctx}=setup(),cam=kind==='undo'?await liveCamera(ctx):null;ctx.enqueueCapture(canvas('old-first'));await wait(()=>started);ctx.enqueueCapture(canvas('old-second'));const originals=loadBatch();if(kind==='undo')replace(ctx,'undo');else roundTrip(ctx);
    assert.equal(S.ui.scan.busy,false);assert.equal(S.ui.scan.buffered,undefined);const retired=loadBatch();assert.deepEqual(retired.map(x=>x.status),['unresolved','unresolved']);
    for(let i=0;i<originals.length;i++)for(const key of ['id','game','captureRevision','originalShot','shot','qty','condition','lang','location','defaults','defaultsByGame'])assert.deepEqual(retired[i][key],originals[i][key]);
    assert(ctx.enqueueCapture(canvas('new-third')));first.resolve();await wait(()=>loadBatch().length===3&&loadBatch()[2].status==='ready'&&!S.ui.scan.busy);
    assert.deepEqual(loadBatch().slice(0,2),retired);assert(!reads.has('old-second'));assert(reads.has('new-third'));assert.equal(S.ui.scan.confirm,null);
    if(cam){assert.equal(cam.stops,0);assert.equal(cam.video.srcObject,cam.stream);assert.equal(S.ui.scan.camOn,true);}
    await releaseOCR();
  }
  console.log('PASS: active/queued OCR becomes retryable without losing capture identity or metadata; no stale render or old-frame reuse, and new capture drains normally.');

  // Real async save handlers gate switches through success and failure.
  for(const action of ['scanConfirm','scanBatchSave','sessCommit'])for(const failure of [false,true]){
    const gate=deferred();let started=false;const {ctx}=setup('mtg',{addMany:async()=>{started=true;await gate.promise;}});
    saveBatch([{...row(),status:action==='scanBatchSave'?'ready':'review'}]);if(action==='scanConfirm')ctx.A.scanBatchReview({dataset:{id:'review'}});if(action==='sessCommit')saveSession('mtg',[{id:'saved-session',qty:2}]);
    if(action==='scanBatchSave')await ctx.A.scanBatchSave();const saving=ctx.A[action==='scanBatchSave'?'scanConfirm':action]();await wait(()=>started);assert.equal(ctx.beforeGameChange('mtg','ygo'),false);assert.equal(ctx.beforeGameChange('mtg','mtg',{workspace:true,kind:'undo'}),false);assert.equal(ctx.beforeGameChange('mtg','mtg',{workspace:true}),false);assert.equal(S.state.settings.game,'mtg');
    if(failure)gate.reject(Error('fixture save rejected'));else gate.resolve();await saving.catch(e=>{assert.equal(action,'sessCommit');assert.equal(e.message,'fixture save rejected');});
    if(failure){assert.equal(loadBatch().length,1);if(action==='scanConfirm')assert.match(S.ui.scan.confirm.error,/Couldn.t save/);if(action==='scanBatchSave')assert.match(S.ui.scan.confirm.error,/Couldn.t save/);if(action==='sessCommit')assert.equal(loadSession('mtg').length,1);}
    assert.equal(S.state.settings.game,'mtg','failed or completed save never resumes a previously blocked switch');
  }
  console.log('PASS: confirmation, mixed-batch and legacy-session saves block switching without cancellation or duplicate writes; failures retain drafts.');

  // Manual lookup reviews have no capture ID; retain bounded per-game drafts.
  for(const game of games)for(const target of games.filter(g=>g!==game)){
    const card=game==='mtg'?bolt:game==='ptcg'?{id:'manual-pokemon',name:'Fixture Pokemon',game,variants:[{key:'normal'}]}:{id:'manual-ygo',name:'Fixture YGO',game,sets:[{code:'FX-001',rarity:'Common'}]};
    const cand={id:card.id,name:card.name,card,exact:true};
    const {ctx}=setup(game,{match:async()=>({cands:[cand],tried:[]})});elements.set('scanName',{value:card.name});await ctx.A.scanFind();
    Object.assign(S.ui.scan.confirm,{qty:8,condition:'Heavily Played',lang:'fr',finish:finishes[game]});
    const original={confirm:{...S.ui.scan.confirm},cands:S.ui.scan.cands,read:S.ui.scan.read};
    // Failed switch restores the same source review, without a fabricated capture.
    assert.equal(ctx.beforeGameChange(game,target),true);assert.equal(ctx.afterGameChange(game),true);assert.equal(S.ui.scan.confirm.qty,8);
    change(ctx,target);assert.equal(S.ui.scan.confirm,null);change(ctx,game);
    assert.equal(S.ui.scan.confirm.qty,8);assert.equal(S.ui.scan.confirm.condition,'Heavily Played');assert.equal(S.ui.scan.confirm.lang,'fr');assert.equal(S.ui.scan.confirm.finish,finishes[game]);assert.equal(S.ui.scan.confirm.batchId,undefined);
    assert.deepEqual(S.ui.scan.cands,original.cands);assert.deepEqual(S.ui.scan.read,original.read);assert.equal(loadBatch().length,0);assert.equal(loadSession(game).length,0);
    assert.equal(ctx.beforeGameChange(game,game,{workspace:true}),true);assert.equal(ctx.afterGameChange(game),true);assert.equal(S.ui.scan.confirm.qty,8);
    ctx.A.scanDismiss();change(ctx,target);change(ctx,game);assert.equal(S.ui.scan.confirm,null,'explicit dismissal is not resurrected');assert.equal(loadBatch().length,0);
  }
  console.log('PASS: all six manual unbatched review round trips, failed switches, same-game workspace adoption and explicit dismissal retain intent without fabricating captures or saves.');

  // Legacy correction owns its captured destination even if later navigation wins.
  {
    const {ctx}=setup();S.ui.scan.cands=[{id:'poke',name:'Pikachu',card:{id:'poke',game:'ptcg',variants:[{key:'normal'}]}}];S.ui.scan.foundIn='ptcg';
    ctx.A.setGame=async t=>{change(ctx,t.dataset.game);change(ctx,'ygo');return true;};await ctx.A.scanAdd({dataset:{i:'0'}});
    assert.equal(loadSession('ptcg')[0].id,'poke');assert.equal(loadSession('ygo').length,0);assert.equal(loadSession('mtg').length,0);assert.equal(S.ui.scan.status,'');
    S.ui.scan.cands=[candidate];S.ui.scan.foundIn='mtg';ctx.A.setGame=async()=>false;await ctx.A.scanAdd({dataset:{i:'0'}});assert.equal(loadSession('mtg').length,0);assert.equal(S.ui.scan.cands[0],candidate);
  }
  console.log('PASS: legacy correction captures candidate and target session before awaiting game switch; a blocked switch never adds.');
  console.log(`PASS: scanner game-switch lifecycle fixtures complete (${fixtureRequests} intercepted local catalogue reads, zero external requests).`);
}finally{priorCtx?.stopCamera();await releaseOCR();}
