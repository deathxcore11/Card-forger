import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
import { transformNativeScanner } from '../scripts/transform-native-scanner.mjs';
const source=await readFile(`${process.env.CARDSTASHY_SOURCE||new URL('../shared-source', import.meta.url).pathname}/scancam.js`,'utf8');
const transformed=transformNativeScanner(source);
function setup({native=true,initialState,camera=''}={}){
  const listeners=new Map(),requests=[],cancelled=[];
  const st={camOn:true,busy:true,confirm:{id:'review',finish:'foil'},supplement:{original:'original'},url:'blob:photo',shot:'original',buffered:2,status:'Reading'};
  const queue=[{id:'first',original:'original1'},{id:'second',original:'original2'}];
  const oldStream={stops:0,getTracks(){return [{stop:()=>this.stops++}];}};
  const context={CARDSTASHY_NATIVE:native?{}:undefined,document:{documentElement:{dataset:{nativeAppState:initialState}}},
    addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);},
    clearTimeout:id=>cancelled.push(id),navigator:{mediaDevices:{getUserMedia:()=>new Promise((resolve,reject)=>requests.push({resolve,reject}))}},
    st,queue,oldStream,ctx:{},A:{},S:{ui:{view:'scan'}},renders:0,
    render:()=>context.renders++,toast:()=>{},prefs:()=>({camera}),scanCurrent:()=>()=>true,
    game:()=> 'mtg',loadIndex:()=>Promise.resolve(),getWorker:()=>Promise.resolve(),scanLang:()=> 'en',window:{scrollTo(){}},
  };
  const lifecycle=transformed.slice(transformed.indexOf('  // Stop only the physical camera.'),transformed.indexOf('  ctx.accountChanged='));
  const start=transformed.slice(transformed.indexOf('  A.scanStart = async () => {'),transformed.indexOf('  A.scanStop = () => {'));
  vm.runInNewContext(`let camTicket=0,scanTicket=4,lifecycleGeneration=8,loopTimer=9,stream=oldStream,videoEl={srcObject:oldStream},captureLock={},prevGray={},steady=4,greenSince=2,suspended=false;const loop={quad:{},bestCapture:{}};const s=()=>st;\n${lifecycle}\n${start}\nglobalThis.inspect=()=>({camTicket,scanTicket,lifecycleGeneration,loopTimer,stream,videoEl,loop});`,context);
  return {context,st,queue,requests,listeners,cancelled,oldStream,event(state){listeners.get('cardstashy-native-lifecycle')?.({detail:{state}});}};
}
const stream=()=>({stops:0,getTracks(){return [{stop:()=>this.stops++}];},getVideoTracks(){return [];}});
test('strict transform rejects drift, duplicates and double application',()=>{
  for(const bad of ['',source+source,source.replace('ctx.stopCamera = stopCamera','ctx.stopCamera=stopCamera'),transformed])assert.throws(()=>transformNativeScanner(bad),/Unexpected scanner/);
});
test('background releases hardware only, preserving review, pending originals and OCR ownership',()=>{
  const r=setup(),before={...r.st},confirm=r.st.confirm,supplement=r.st.supplement;
  r.event('background');r.event('background');
  assert.equal(r.oldStream.stops,1);assert.equal(r.context.inspect().stream,null);assert.equal(r.context.inspect().videoEl.srcObject,null);
  assert.equal(r.context.inspect().scanTicket,4);assert.equal(r.context.inspect().lifecycleGeneration,8);
  assert.equal(r.st.confirm,confirm);assert.equal(r.st.supplement,supplement);
  for(const key of ['busy','url','shot','buffered','status'])assert.equal(r.st[key],before[key]);
  assert.deepEqual(r.queue,[{id:'first',original:'original1'},{id:'second',original:'original2'}]);
  assert.equal(r.st.camOn,false);assert.equal(r.st.torch,false);assert.equal(r.context.renders,0);
  r.event('foreground');r.event('foreground');assert.equal(r.context.renders,1);assert.equal(r.requests.length,0);assert.equal(r.st.camOn,false);
});
test('pending permission grant after background/foreground is released, then explicit Start works',async()=>{
  const r=setup();const pending=r.context.A.scanStart();assert.equal(r.requests.length,1);
  r.event('background');await r.context.A.scanStart();assert.equal(r.requests.length,1);
  r.event('foreground');const stale=stream();r.requests[0].resolve(stale);await pending;assert.equal(stale.stops,1);assert.equal(r.st.camOn,false);
  const active=r.context.A.scanStart(),fresh=stream();r.requests[1].resolve(fresh);await active;
  assert.equal(r.st.camOn,true);assert.equal(r.context.inspect().stream,fresh);assert.equal(fresh.stops,0);
});
test('background cancels fallback permission request and suppresses stale error UI',async()=>{
  const r=setup({camera:'saved-camera'});const pending=r.context.A.scanStart();r.event('background');
  r.requests[0].reject(Error('device missing'));await pending;assert.equal(r.requests.length,1);assert.equal(r.context.renders,0);assert.equal(r.st.status,'Reading');
});
test('camera acquired by fallback in flight is released after background',async()=>{
  const r=setup({camera:'saved-camera'});const pending=r.context.A.scanStart();r.requests[0].reject(Error('device missing'));await Promise.resolve();await Promise.resolve();
  assert.equal(r.requests.length,2);r.event('background');const stale=stream();r.requests[1].resolve(stale);await pending;assert.equal(stale.stops,1);
});
test('initial background blocks Start; memory pressure never opens or drops scanner state',async()=>{
  const r=setup({initialState:'background'});await r.context.A.scanStart();r.event('memory-pressure');assert.equal(r.requests.length,0);assert.equal(r.st.confirm.id,'review');
  r.event('foreground');const pending=r.context.A.scanStart();r.requests[0].resolve(stream());await pending;assert.equal(r.st.camOn,true);
});
test('explicit factory teardown removes listener and retires late permission results',async()=>{
  const r=setup(),pending=r.context.A.scanStart();r.context.ctx.disposeNativeScannerLifecycle();r.context.ctx.disposeNativeScannerLifecycle();
  assert.equal(r.listeners.size,0);assert.equal(r.oldStream.stops,1);
  const late=stream();r.requests[0].resolve(late);await pending;assert.equal(late.stops,1);
  await r.context.A.scanStart();assert.equal(r.requests.length,1);
  assert.match(transformed,/if\(globalThis.CARDSTASHY_NATIVE\)ctx\.disposeNativeScannerLifecycle\?\.\(\);/);
});
test('non-native path does not subscribe or suppress explicit camera start',async()=>{
  const r=setup({native:false,initialState:'background'});assert.equal(r.listeners.size,0);assert.equal(r.context.ctx.disposeNativeScannerLifecycle,undefined);
  r.event('background');const pending=r.context.A.scanStart();r.requests[0].resolve(stream());await pending;assert.equal(r.st.camOn,true);
});
test('stale cancelled loop callback cannot observe or schedule a newly restarted stream',()=>{
  const tick=transformed.match(/const cameraGeneration=camTicket;const tick=.*?;\n      loopTimer=setTimeout\(tick,160\);/)[0];
  const callbacks=[],c={camTicket:1,loopTimer:0,stream:{},calls:0,clockNow:()=>0,loop:()=>c.calls++,setTimeout:fn=>{callbacks.push(fn);return callbacks.length;}};
  vm.runInNewContext(tick,c);c.camTicket=2;callbacks[0]();assert.equal(c.calls,0);assert.equal(callbacks.length,1);
});
