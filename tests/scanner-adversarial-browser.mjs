// HOSTED-ONLY: real decoded public catalogue scans in a synthetic MediaStream.
// Only Tesseract timing/text and unavailable external responses are deterministic.
// Production camera sampling, geometry, capture, queue, storage, crop, retry,
// and DOM event handlers are NOT replaced. No private/user photos are read.
// This is lifecycle/pixel-integrity coverage, NOT physical-camera/OCR accuracy.
// Keep tests/scanner-browser.mjs as the independent real OCR + exact-printing gate.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {runInNewContext} from 'node:vm';

const refs=[
 {g:'ptcg',name:'Kyogre',id:'cel25-3',url:'https://api.tcgdex.net/v2/en/cards/cel25-3'},
 {g:'mtg',name:'Lightning Bolt',id:'7673784e-db4b-43a1-8d55-1bb9fc1e284f',url:'https://api.scryfall.com/cards/7673784e-db4b-43a1-8d55-1bb9fc1e284f'}
];
const matrix=[
 'A accepted before delayed OCR; changing the SAME camera canvas to B cannot change A',
 'Distinct A/B full originals, readable title/footer pixels, native upright crop axes',
 'Storage failure and bounded queue reject only the new capture, retaining every accepted ID',
 'Camera playback survives processing; no guide overlay; unsupported/error torch is honest',
 'An explicit art-only photo crop never destroys the full original or its title/footer',
 'OCR deadline retires its worker; late success cannot mutate a finished/retried row',
 'Retry keeps the same capture ID and original bytes; completed originals survive reload',
 'A rejected new card held in view queues exactly once when reading capacity becomes available'
];
// Execute the actual crop/read/freeze handlers without browser, provider reads
// or pixels. Fake canvas proves metadata/control flow ONLY; hosted pixelCheck
// remains responsible for the full original title/footer and image integrity.
async function validatePhotoCropHandlers(){
 const source=await readFile(new URL('../scancam.js',import.meta.url),'utf8');
 const readStart=source.indexOf('  A.scanRead = async () => {'),readEnd=source.indexOf('  // Confirm & add',readStart);
 const freezeStart=source.indexOf('export function freezeCapture('),freezeEnd=source.indexOf('export function rotateCapture(',freezeStart);
 assert(readStart>=0&&readEnd>readStart&&freezeStart>=0&&freezeEnd>freezeStart);
 const st={url:'fixture:public-card',crop:null},rect={left:20,top:30,width:500,height:700},box={hidden:true,style:{}},wrap={getBoundingClientRect:()=>rect,setPointerCapture:()=>{}};
 const packets=[],canvas=()=>({width:0,height:0,getContext:()=>({drawImage(){}})});let decode;
 const scope={A:{},s:()=>st,S:{ui:{view:'scan'}},CAPTURE_MAX_EDGE:1280,document:{getElementById:id=>id==='cropWrap'?wrap:box,createElement:canvas},loadImage:()=>new Promise(resolve=>{decode=resolve;}),autoBox:()=>null,preserveWholeCardPhoto:()=>true,enqueueCapture:packet=>{packets.push(packet);return true;},toast:message=>{throw Error(message);}};
 runInNewContext(source.slice(freezeStart,freezeEnd).replace('export ','')+source.slice(readStart,readEnd)+';this.attachCrop=attachCrop;',scope);
 const image={naturalWidth:1000,naturalHeight:1400};
 assert.equal(wrap.onpointerdown,undefined,'Decode alone does not bind the asynchronously attached crop gesture');
 let read=scope.A.scanRead();decode(image);await read;assert.equal(packets[0].proposal,null,'Read without a crop produces the observed null proposal, not delayed manual metadata');
 scope.attachCrop();
 const pointer=(x,y)=>({clientX:rect.left+rect.width*x,clientY:rect.top+rect.height*y,pointerId:1,preventDefault(){}});
 wrap.onpointerdown(pointer(.13,.20));wrap.onpointermove(pointer(.87,.59));wrap.onpointerup();
 for(const [key,value]of Object.entries({x:.13,y:.20,w:.74,h:.39}))assert(Math.abs(st.crop[key]-value)<1e-10);
 assert.equal(box.hidden,false);read=scope.A.scanRead();st.crop=null;decode(image);await read;
 const packet=packets[1];assert.equal(packet.proposal.boundary.source,'manual','Read snapshots an established crop before asynchronous decode');assert(packet.proposal.outputWidth>packet.proposal.outputHeight,'The actual proposal remains a transverse art-only crop');
 assert.equal(packet.original.width,914);assert.equal(packet.original.height,1280,'freezeCapture retains full-source dimensions');
 for(const [i,[x,y]]of [[.13,.20],[.87,.20],[.87,.59],[.13,.59]].entries()){assert(Math.abs(packet.proposal.quad[i].x-x*packet.original.width)<1e-8);assert(Math.abs(packet.proposal.quad[i].y-y*packet.original.height)<1e-8);}
 assert.equal(st.photoLoading,false);return 'PASS: actual attachCrop → scanRead → freezeCapture handlers preserve established manual crop geometry across async decode; image-pixel assertions remain hosted-only.';
}
if(process.argv.includes('--validate-fixtures')){
 console.log(await validatePhotoCropHandlers());
 assert.equal(refs.length,2);assert(refs.every(r=>new URL(r.url).protocol==='https:'));
 assert.equal(new Set(refs.map(r=>r.id)).size,2);
 console.log(JSON.stringify({kind:'hosted-only-synthetic-public-scan-lifecycle',references:refs,matrix,limitations:['No physical camera or photographed-table accuracy claim.','Deterministic OCR does not establish recognition accuracy; scanner-browser.mjs remains required.','No private user images or derived pixels.']},null,2));
 process.exit(0);
}
// Do not accidentally launch a locally prohibited browser. The integration owner
// runs this file only in the explicitly approved GitHub Actions environment.
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted-only scanner QA: do not launch a local browser. Use --validate-fixtures for a browser-free check.');
const {chromium,devices}=await import('playwright');
const root=process.cwd(),out=resolve(root,'test-results');
await mkdir(out,{recursive:true});
async function bytes(url,max){
 const u=new URL(url);assert.equal(u.protocol,'https:');
 assert(['api.tcgdex.net','assets.tcgdex.net','api.scryfall.com','cards.scryfall.io'].includes(u.hostname),'Only existing public reference providers are allowed');
 const response=await fetch(url,{headers:{'User-Agent':'CardStashy-Scanner-Adversarial/1.0'},signal:AbortSignal.timeout(30000)});
 assert(response.ok,`Public reference unavailable (${response.status}): ${url}`); // No bypass/retry after denial.
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;assert(size<=max,`Reference exceeds ${max} bytes`);chunks.push(chunk);}
 return Buffer.concat(chunks);
}
for(const ref of refs){
 ref.raw=JSON.parse((await bytes(ref.url,2_000_000)).toString());assert.equal(ref.raw.name,ref.name);
 ref.image=ref.g==='ptcg'?ref.raw.image+'/high.webp':ref.raw.image_uris.normal;
 ref.bytes=await bytes(ref.image,5_000_000);ref.mime=ref.g==='ptcg'?'image/webp':'image/jpeg';
 console.log(`Public catalogue scan: ${ref.name}, ${ref.id}, ${ref.bytes.length} bytes (not a physical-table photograph).`);
}
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),ref=refs.find(x=>u.pathname===`/__scanner_reference/${x.g}`);
 if(ref){res.setHeader('Content-Type',ref.mime);return res.end(ref.bytes);}
 const file=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const report={kind:'synthetic-public-scan-lifecycle',references:refs.map(({g,name,id,url,image})=>({g,name,id,url,image})),matrix,ocr:'deterministic lifecycle stub; not an accuracy benchmark',scenarios:[{id:'live-delayed-A-and-B',status:'pending'},{id:'bad-art-photo-timeout-late-completion-retry',status:'pending'},{id:'rejected-next-card-held-until-capacity',status:'pending'}],checkpoints:[],results:[],limitations:['Not physical-camera validation.','OCR is deliberately deterministic here; the separate real OCR/public-printing gate is required.']};

const failures=[];
async function app(){
 const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(15000);
 // Lifecycle tests are offline except for our static app and already-downloaded
 // reference fixtures. This never substitutes a fake capture or queue handler.
 await context.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort('internetdisconnected'));
 await page.addInitScript(()=>{
  const h=window.__scannerHarness={calls:[],events:[],workers:0,terminated:[],held:[],holdFirst:true,text:'',released:false};
  window.Tesseract={createWorker:async()=>{
   const id=++h.workers;
   return {setParameters:async()=>{},terminate:async()=>{h.terminated.push(id);},recognize:async canvas=>{
    // Inspect actual pixels passed by the production OCR ROI code. An empty or
    // object-labelled pretend canvas cannot satisfy this harness.
    const rgba=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let hash=2166136261;for(let i=0;i<rgba.length;i+=Math.max(4,Math.floor(rgba.length/4096/4)*4))hash=Math.imul(hash^rgba[i],16777619)>>>0;
    const call={worker:id,width:canvas.width,height:canvas.height,hash,startedAt:Date.now(),completed:false};h.calls.push(call);
    if(h.holdFirst&&!h.released&&h.calls.length===1)await new Promise(resolve=>h.held.push(resolve));
    call.completed=true;call.completedAt=Date.now();return {data:{text:h.text}};
   }};
  }};
  h.release=(text='')=>{h.events.push({event:'release-ocr',at:Date.now()});h.text=text;h.released=true;for(const resolve of h.held.splice(0))resolve();};
 });
 await page.goto(base+'/#scan');await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
 const skip=page.getByRole('button',{name:'Skip',exact:true});try{await skip.waitFor({state:'visible',timeout:1500});await skip.click();}catch{}
 await page.evaluate(async()=>{
  const {S}=await import('/store.js'),batch=await import('/scan-batch.js'),cam=await import('/scancam.js'),prefs=await import('/scansession.js');
  window.__scannerTest={bootReady:()=>!S.ui.sets.busy,state:()=>S.ui.scan,rows:batch.loadBatch,cam,prefs,bufferLimit:batch.CAPTURE_BUFFER_LIMIT,collectionCount:()=>S.state.collection.length+Object.values(S.state.tcg||{}).reduce((n,g)=>n+(g.collection?.length||0),0)};
  S.ui.scan.auto=false;cam.SCAN_DEADLINES.ocr=60000;
 });
 return {context,page};
}
const rows=page=>page.evaluate(()=>window.__scannerTest.rows());
const settled=page=>page.waitForFunction(()=>{const t=window.__scannerTest;return !t.state().busy&&t.rows().every(r=>!['captured','reading'].includes(r.status));},null,{timeout:20000});
async function screenshot(page,name){await page.screenshot({path:resolve(out,`scanner-adversarial-${name}.png`),fullPage:false});}
async function diagnostic(page,name){const data=await page.evaluate(()=>({state:{busy:window.__scannerTest.state().busy,buffered:window.__scannerTest.state().buffered,status:window.__scannerTest.state().status,guide:window.__scannerTest.state().guide,boundaryReady:window.__scannerTest.state().boundaryReady,crop:window.__scannerTest.state().crop,cropBound:typeof document.querySelector('#cropWrap')?.onpointerdown==='function',cropRect:document.querySelector('#cropWrap')?.getBoundingClientRect().toJSON()},rows:window.__scannerTest.rows().map(({id,status,capturedAt,proposal,error,timings,counts})=>({id,status,capturedAt,proposal,error,timings,counts})),events:window.__scannerHarness.events,ocr:window.__scannerHarness.calls}));await writeFile(resolve(out,`scanner-adversarial-${name}.json`),JSON.stringify(data,null,2));}
async function camera(page){
 await page.evaluate(async()=>{
  const h=window.__scannerHarness;h.images={};h.expected={};
  for(const g of ['ptcg','mtg']){const image=new Image();image.src='/__scanner_reference/'+g;await image.decode();h.images[g]=image;}
  const c=h.camera=document.createElement('canvas');c.width=640;c.height=900;const x=c.getContext('2d');
  h.draw=()=>{
   const s=h.scene,image=h.images[s.g],height=500,width=height*image.naturalWidth/image.naturalHeight;
   x.fillStyle='#567064';x.fillRect(0,0,c.width,c.height);x.save();x.translate(320,450);x.rotate(s.angle);x.drawImage(image,-width/2,-height/2,width,height);x.restore();
   const point=(u,v)=>({x:320+(u-.5)*width*Math.cos(s.angle)-(v-.5)*height*Math.sin(s.angle),y:450+(u-.5)*width*Math.sin(s.angle)+(v-.5)*height*Math.cos(s.angle)});
   h.points=point;h.cardQuad=[[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>point(u,v));
  };
  h.scene={g:'ptcg',angle:0};h.draw();h.drawTimer=setInterval(h.draw,33);
  h.remember=label=>{const canvas=document.createElement('canvas');canvas.width=c.width;canvas.height=c.height;canvas.getContext('2d').drawImage(c,0,0);h.expected[label]={canvas,quad:h.cardQuad.map(p=>({...p})),scene:{...h.scene}};};
  navigator.mediaDevices.getUserMedia=async()=>{
   const stream=h.stream=c.captureStream(30),track=stream.getVideoTracks()[0];
   Object.defineProperty(track,'getCapabilities',{value:()=>h.torchUnsupported?{}:{torch:true}});
   Object.defineProperty(track,'applyConstraints',{value:async constraints=>{h.torchAttempts=(h.torchAttempts||0)+1;throw new DOMException('Synthetic hardware torch unavailable','NotSupportedError');}});
   return stream;
  };
 });
 await page.getByRole('button',{name:'Start camera',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth===640);
 await page.waitForFunction(()=>window.__scannerTest.state().boundaryReady&&window.__scannerTest.state().guide?.state!=='red');
}
async function scene(page,g,label,angle=0){
 await page.evaluate(async({g,label,angle})=>{
  const h=window.__scannerHarness;h.events.push({event:'scene',g,label,angle,at:Date.now()});h.scene={g,angle};h.draw();h.remember(label);
  const v=document.querySelector('#scanVideo');
  // Wait only for physical delivery of the newly drawn frame, not for the next
  // 160ms detector tick. This exposes stale best-frame/sampling reuse.
  await new Promise(resolve=>v.requestVideoFrameCallback(resolve));
 },{g,label,angle});
}
async function capture(page,count){
 await page.getByRole('button',{name:'Capture card now',exact:true}).click();
 await page.waitForFunction(n=>window.__scannerTest.rows().length===n,count,{timeout:10000});
}
async function pixelCheck(page,id,label,{cropMustContainBands=true}={}){
 const result=await page.evaluate(async({id,label,cropMustContainBands})=>{
  const h=window.__scannerHarness,row=window.__scannerTest.rows().find(r=>r.id===id),expected=h.expected[label],image=new Image();image.src=row.originalShot;await image.decode();
  const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);
  const actual=c.getContext('2d').getImageData(0,0,c.width,c.height).data,source=expected.canvas.getContext('2d').getImageData(0,0,c.width,c.height).data;
  const q=expected.quad,point=(u,v)=>({x:q[0].x+(q[1].x-q[0].x)*u+(q[3].x-q[0].x)*v,y:q[0].y+(q[1].y-q[0].y)*u+(q[3].y-q[0].y)*v});
  const crop=row.proposal?.cropSafe?window.__scannerTest.cam.padQuad(row.proposal.quad,c.width,c.height):null;
  const inside=p=>!crop||crop.every((a,i)=>{const b=crop[(i+1)%4];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x)>=-2;});
  const bands={};for(const [name,low,high] of [['title',.025,.14],['footer',.865,.98],['card',.025,.98]]){
   let error=0,count=0,covered=0;for(let yy=0;yy<18;yy++)for(let xx=0;xx<30;xx++){
    const p=point(.03+.94*xx/29,low+(high-low)*yy/17),i=(Math.max(0,Math.min(c.height-1,Math.round(p.y)))*c.width+Math.max(0,Math.min(c.width-1,Math.round(p.x))))*4;
    for(let k=0;k<3;k++)error+=Math.abs(actual[i+k]-source[i+k]);count++;if(inside(p))covered++;
   }bands[name]={mae:error/(count*3),covered:covered/count};
  }
  return {width:c.width,height:c.height,expectedWidth:expected.canvas.width,expectedHeight:expected.canvas.height,bands,proposal:row.proposal&&{cropSafe:row.proposal.cropSafe,outputWidth:row.proposal.outputWidth,outputHeight:row.proposal.outputHeight,orientation:row.proposal.orientation},cropMustContainBands};
 },{id,label,cropMustContainBands});
 assert.equal(result.width,result.expectedWidth,'Original retains the complete source width');assert.equal(result.height,result.expectedHeight,'Original retains the complete source height');
 for(const [name,band] of Object.entries(result.bands)){
  assert(band.mae<15,`${label} ${name} pixels match its own physical frame, not another card or a crop: ${JSON.stringify(result)}`);
  if(cropMustContainBands)assert(band.covered>.97,`${label} chosen OCR crop retains ${name}, rather than only central artwork: ${JSON.stringify(result)}`);
 }
 if(cropMustContainBands){assert(result.proposal?.cropSafe,'Clear live card has a supported crop');assert(result.proposal.outputWidth<result.proposal.outputHeight,'Upright card remains upright, never forced sideways artwork');assert.equal(result.proposal.orientation?.rotation,0);}
 return result;
}

try{
 // CASE 1: one real canvas reused by the camera while recognition of A is held.
 const {context,page}=await app();
 report.scenarios[0].status='running';
 try{
  await page.evaluate(()=>window.__scannerTest.prefs.savePrefs('mtg',{condition:'Lightly Played',lang:'ja'}));
  await camera(page);await scene(page,'ptcg','A');
  await capture(page,1);await page.waitForFunction(()=>window.__scannerHarness.calls.length===1);
  const first=(await rows(page))[0];assert.equal(first.status,'reading');assert(first.originalShot?.startsWith('data:image/jpeg;base64,'));
  await page.evaluate(()=>window.__scannerTest.prefs.savePrefs('mtg',{condition:'Moderately Played',lang:'en'}));
  await scene(page,'mtg','B');
  await capture(page,2);const second=(await rows(page))[1];
  assert.notEqual(first.id,second.id);assert.notEqual(first.originalShot,second.originalShot,'A and B are distinct physical frames');
  assert.equal(first.condition,'Lightly Played');assert.equal(first.lang,'ja');assert.equal(second.condition,'Moderately Played');assert.equal(second.lang,'en');
  assert.equal(await page.evaluate(()=>window.__scannerHarness.calls.length),1,'B really queues while A OCR is pending');
  const aPixels=await pixelCheck(page,first.id,'A'),bPixels=await pixelCheck(page,second.id,'B');
  report.checkpoints.push({scenario:'live-delayed-A-and-B',stage:'delayed-A-and-B-pixel-equality',status:'passed',aPixels,bPixels});
  assert.equal(await page.locator('#camGuide,.cam-guide,.cam-wrap polygon').count(),0,'No outline/mask is drawn on the feed');
  await page.getByRole('button',{name:'Flashlight',exact:true}).click();
  await page.waitForFunction(()=>window.__scannerHarness.torchAttempts===1);
  assert.equal(await page.getByRole('button',{name:'Flashlight',exact:true}).getAttribute('aria-pressed'),'false','Rejected hardware torch cannot claim to be on');
  await page.getByText("This camera's flashlight can't be controlled from the browser.",{exact:true}).waitFor();
  const beforeQuota=JSON.stringify(await rows(page));
  await scene(page,'ptcg','rejected-quota');
  await page.evaluate(()=>{const h=window.__scannerHarness;h.quotaFailures=0;h.setItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='cardstashy-scan-batch-v1'){h.quotaFailures++;throw new DOMException('Test quota exhausted','QuotaExceededError');}return h.setItem.call(this,k,v);};});
  try{await page.getByRole('button',{name:'Capture card now',exact:true}).click();assert.equal(JSON.stringify(await rows(page)),beforeQuota,'Quota failure cannot alter/evict an accepted original');assert(await page.evaluate(()=>window.__scannerHarness.quotaFailures>0),'Quota fixture reached durable storage, not shutter debounce');await page.waitForFunction(()=>/not queued/i.test(window.__scannerTest.state().status));}
  finally{await page.evaluate(()=>{Storage.prototype.setItem=window.__scannerHarness.setItem;});}
  await scene(page,'mtg','restored-after-quota');
  // The production storage cooldown protects a rejected frame for 2 seconds.
  await page.waitForTimeout(2100);
  const limit=await page.evaluate(()=>window.__scannerTest.bufferLimit);
  // Fill capacity with actual card transitions, not rapid duplicate shutter
  // taps: the production 600ms same-card debounce deliberately ignores those.
  let finalGame='mtg';const bufferPixels=[];
  for(let count=3;count<=limit+1;count++){
   finalGame=finalGame==='mtg'?'ptcg':'mtg';const label=`buffer-${count}`;
   await scene(page,finalGame,label);await capture(page,count);const accepted=(await rows(page)).at(-1);
   bufferPixels.push(await pixelCheck(page,accepted.id,label,{cropMustContainBands:accepted.proposal?.cropSafe===true}));
  }
  const full=JSON.stringify(await rows(page));
  // Offer a genuinely different sixth card, then immediately restore the last
  // accepted physical card before testing held-card duplicate suppression.
  await scene(page,finalGame==='mtg'?'ptcg':'mtg','rejected-full-buffer');
  await page.getByRole('button',{name:'Capture card now',exact:true}).click();
  await scene(page,finalGame,'restored-after-full-buffer');
  assert.equal(JSON.stringify(await rows(page)),full,'Queue full rejects only the new frame');
  assert.match(await page.evaluate(()=>window.__scannerTest.state().status),/queue full/i);
  report.checkpoints.push({scenario:'live-delayed-A-and-B',stage:'quota-and-capacity-preserve-accepted-captures',status:'passed',accepted:limit+1,bufferPixels});
  assert.equal(await page.locator('.scan-confirm').count(),0,'Queued OCR never interrupts the camera with review');
  await screenshot(page,'held-a-queued-b');
  await page.evaluate(()=>window.__scannerHarness.release());await settled(page);
  await page.evaluate(()=>{window.__scannerTest.state().auto=true;});await page.waitForTimeout(1000);
  assert.equal((await rows(page)).length,limit+1,'The same held card is not captured repeatedly when auto resumes');
  await scene(page,finalGame==='mtg'?'ptcg':'mtg','next-auto',.09);
  await page.waitForFunction(n=>window.__scannerTest.rows().length===n,limit+2,{timeout:15000});await settled(page);
  await page.evaluate(()=>{window.__scannerTest.state().auto=false;});
  const finished=await rows(page);assert.equal(finished.length,limit+2);assert.equal(new Set(finished.map(x=>x.id)).size,limit+2);
  const returnedPixels=await pixelCheck(page,finished.at(-1).id,'next-auto');
  assert.equal(finished[0].originalShot,first.originalShot);assert.equal(finished[1].originalShot,second.originalShot);
  assert(finished.every(r=>r.status==='unresolved'),'Empty deterministic OCR remains unresolved, never an invented identity');
  assert(finished.every(r=>Number.isFinite(r.timings?.totalMs)&&r.timings.totalMs>=0&&Number.isFinite(r.timings?.queueWaitMs)),'Every accepted row has measured timings');
  assert.equal(await page.evaluate(()=>window.__scannerTest.collectionCount()),0,'Capture never writes the collection');
  const playback=await page.locator('#scanVideo').evaluate(v=>({time:v.currentTime,paused:v.paused}));await page.waitForTimeout(200);
  assert.equal(playback.paused,false);assert(await page.locator('#scanVideo').evaluate(t=>t.currentTime>0));
  assert(await page.locator('#scanVideo').evaluate((v,time)=>v.currentTime>time&&!v.paused&&v.srcObject===window.__scannerHarness.stream,playback.time),'Same camera keeps playing after the queue drains');
  const originals=finished.map(({id,originalShot})=>({id,originalShot}));
  // A second start uses a stream with no torch capability. The real camera
  // startup must omit that control rather than exposing a nonworking toggle.
  await page.getByRole('button',{name:'Stop camera',exact:true}).click();
  await page.evaluate(()=>{window.__scannerHarness.torchUnsupported=true;});
  await page.getByRole('button',{name:'Start camera',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth===640);
  assert.equal(await page.getByRole('button',{name:'Flashlight',exact:true}).count(),0,'Unsupported torch is not offered');
  assert.deepEqual((await rows(page)).map(({id,originalShot})=>({id,originalShot})),originals,'Torch capability fallback preserves all captures');
  await diagnostic(page,'queue');
  await page.reload();await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
  const retained=await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js');return loadBatch().map(({id,originalShot})=>({id,originalShot}));});
  assert.deepEqual(retained,originals,'Reload retains every original, not just artwork thumbnails');
  report.scenarios[0].status='passed';report.results.push({case:'live-delayed-A-and-B',accepted:finished.length,aPixels,bPixels,returnedPixels,timings:finished.map(({timings,counts})=>({timings,counts})),passed:true});
  console.log('PASS: delayed A / immediate B pixel identity, title/footer, quota, bounded queue, honest torch error, no overlay, playback and reload.');
 }catch(e){report.scenarios[0]={...report.scenarios[0],status:'failed',error:String(e.message||e)};await diagnostic(page,'queue-failure').catch(()=>{});await screenshot(page,'queue-failure').catch(()=>{});failures.push(e);console.error('FAILED: live-delayed-A-and-B:',e.message);}finally{await context.close();}

 // CASE 2: simulate a bad art-only proposal using the actual photo crop gesture.
 // Recognition times out; neither that crop nor retry may overwrite the source.
 const photo=await app();
 report.scenarios[1].status='running';
 try{
  const {page}=photo,ref=refs[0];
  await page.evaluate(()=>{window.__scannerTest.cam.SCAN_DEADLINES.ocr=180;});
  await page.getByRole('button',{name:'Photo',exact:true}).click();
  await page.locator('input[data-change="scanFile"]').last().setInputFiles({name:'public-kyogre.webp',mimeType:ref.mime,buffer:ref.bytes});
  await page.waitForFunction(()=>window.__scannerTest.bootReady());
  // render schedules attachCrop on a later task. Decoded pixels alone do not
  // establish a bound pointer handler, a current photo, or hittable coordinates.
  await page.locator('#cropWrap').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{const wrap=document.querySelector('#cropWrap'),image=document.querySelector('#cropImg');return wrap?.isConnected&&image?.complete&&image.naturalWidth>0&&image.src===window.__scannerTest.state().url&&['onpointerdown','onpointermove','onpointerup'].every(key=>typeof wrap[key]==='function');});
  await page.evaluate(()=>{
   const image=document.querySelector('#cropImg'),canvas=document.createElement('canvas'),scale=Math.min(1,window.__scannerTest.cam.CAPTURE_MAX_EDGE/Math.max(image.naturalWidth,image.naturalHeight));canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
   window.__scannerHarness.expected={photo:{canvas,quad:[{x:0,y:0},{x:canvas.width,y:0},{x:canvas.width,y:canvas.height},{x:0,y:canvas.height}]}};
  });
  await page.waitForFunction(()=>{const wrap=document.querySelector('#cropWrap'),r=wrap?.getBoundingClientRect();return r?.width>0&&r.height>0&&[[.13,.20],[.87,.59]].every(([x,y])=>{const px=r.x+r.width*x,py=r.y+r.height*y;return px>0&&px<innerWidth&&py>0&&py<innerHeight&&wrap.contains(document.elementFromPoint(px,py));});});
  const crop=await page.locator('#cropWrap').boundingBox();assert(crop?.width>0&&crop.height>0);
  await page.mouse.move(crop.x+crop.width*.13,crop.y+crop.height*.20);await page.mouse.down();await page.mouse.move(crop.x+crop.width*.87,crop.y+crop.height*.59,{steps:5});await page.mouse.up();
  await page.waitForFunction(()=>{const crop=window.__scannerTest.state().crop,box=document.querySelector('#cropBox');return crop&&box&&!box.hidden&&Object.entries({x:.13,y:.20,w:.74,h:.39}).every(([key,value])=>Math.abs(crop[key]-value)<.01);});
  const drawn=await page.evaluate(()=>{const crop={...window.__scannerTest.state().crop},canvas=window.__scannerHarness.expected.photo.canvas;window.__scannerHarness.events.push({event:'manual-crop-established',crop,at:Date.now()});return {crop,width:canvas.width,height:canvas.height};});
  await page.getByRole('button',{name:'Read card',exact:true}).click();await page.waitForFunction(()=>window.__scannerTest.rows().length===1);await settled(page);
  const original=(await rows(page))[0];assert(original,'Photo was accepted');assert.equal(original.status,'unresolved');assert.match(original.error,/timed out/i);
  assert.equal(original.proposal?.boundary?.source,'manual','Bad-art fixture traverses the actual photo crop handler');
  assert(original.proposal.outputWidth>original.proposal.outputHeight,'Fixture is deliberately a transverse art-only crop');
  const {x,y,w,h}=drawn.crop;for(const [i,[u,v]]of [[x,y],[x+w,y],[x+w,y+h],[x,y+h]].entries()){assert(Math.abs(original.proposal.quad[i].x-u*drawn.width)<.01,'Queued quad preserves the actual drag x coordinate');assert(Math.abs(original.proposal.quad[i].y-v*drawn.height)<.01,'Queued quad preserves the actual drag y coordinate');}
  const photoPixels=await pixelCheck(page,original.id,'photo',{cropMustContainBands:false});
  assert(await page.evaluate(()=>window.__scannerHarness.terminated.length>0),'Timed-out OCR worker is retired');
  const timedOut=JSON.stringify(await rows(page));
  // The retired worker deliberately ignores termination and returns plausible
  // text late. Production cancellation, not the test worker, must contain it.
  await page.evaluate(()=>window.__scannerHarness.release('Kyogre HP130\n003/025'));
  await page.waitForFunction(()=>window.__scannerHarness.calls[0].completed);await page.waitForTimeout(100);
  assert.equal(JSON.stringify(await rows(page)),timedOut,'Expired OCR success cannot mutate the finished row');
  await page.evaluate(()=>{window.__scannerHarness.text='';window.__scannerTest.cam.SCAN_DEADLINES.ocr=5000;});
  await page.locator(`[data-act="scanBatchReview"][data-id="${original.id}"]`).click();
  await page.getByRole('region',{name:'Review captured card',exact:true}).waitFor();
  await page.getByRole('button',{name:'Scan again',exact:true}).click();
  await page.waitForFunction(revision=>window.__scannerTest.rows()[0]?.captureRevision!==revision,original.captureRevision);
  await settled(page);
  const retry=(await rows(page))[0];assert.equal((await rows(page)).length,1);assert.equal(retry.id,original.id);assert.equal(retry.originalShot,original.originalShot,'Retry uses the retained source, never the bad artwork crop');assert.equal(retry.proposal,null,'Retry drops the failed art-only proposal');assert.equal(retry.originalOnly,true,'Retry explicitly starts from the full original');
  assert(await page.evaluate(()=>window.__scannerHarness.workers>=2),'Retry uses a fresh OCR worker');
  await pixelCheck(page,retry.id,'photo',{cropMustContainBands:false});assert.equal(retry.status,'unresolved');assert.equal(await page.evaluate(()=>window.__scannerTest.collectionCount()),0);
  await screenshot(page,'original-after-bad-art-retry');await diagnostic(page,'timeout-retry');
  report.scenarios[1].status='passed';report.results.push({case:'bad-art-photo-timeout-late-completion-retry',photoPixels,timeout:{timings:original.timings,counts:original.counts},retry:{timings:retry.timings,counts:retry.counts},passed:true});
  console.log('PASS: actual art-only drag crop retains original title/footer; deadline retires worker; late result is quarantined; retry preserves ID/source.');
 }catch(e){report.scenarios[1]={...report.scenarios[1],status:'failed',error:String(e.message||e)};await diagnostic(photo.page,'photo-failure').catch(()=>{});await screenshot(photo.page,'photo-failure').catch(()=>{});failures.push(e);console.error('FAILED: bad-art-photo-timeout-late-completion-retry:',e.message);}finally{await photo.context.close();}
 // CASE 3: unlike the transient rejected-card-and-restore path above, keep
 // the unaccepted next card in view while the full queue drains. It must not
 // disappear just because the original manual attempt was rejected.
 const held=await app();
 report.scenarios[2].status='running';
 try{
  const {page}=held;await camera(page);await scene(page,'ptcg','held-first');await capture(page,1);
  await page.waitForFunction(()=>window.__scannerHarness.calls.length===1);
  const limit=await page.evaluate(()=>window.__scannerTest.bufferLimit);let finalGame='ptcg';
  for(let count=2;count<=limit+1;count++){
   finalGame=finalGame==='ptcg'?'mtg':'ptcg';await scene(page,finalGame,`held-buffer-${count}`);await capture(page,count);
  }
  const accepted=(await rows(page)).map(({id,originalShot})=>({id,originalShot}));
  const rejectedGame=finalGame==='ptcg'?'mtg':'ptcg';await scene(page,rejectedGame,'held-rejected-next');
  await page.getByRole('button',{name:'Capture card now',exact:true}).click();
  assert.match(await page.evaluate(()=>window.__scannerTest.state().status),/queue full/i);
  assert.deepEqual((await rows(page)).map(({id,originalShot})=>({id,originalShot})),accepted,'A full queue cannot accept or evict a card prematurely');
  await page.evaluate(()=>{window.__scannerTest.state().auto=true;});await page.waitForTimeout(650);
  assert.equal((await rows(page)).length,limit+1,'Held next card still waits while capacity is exhausted');
  await page.evaluate(()=>window.__scannerHarness.release());
  await page.waitForFunction(n=>window.__scannerTest.rows().length===n,limit+2,{timeout:15000});await settled(page);
  await page.waitForTimeout(1000);const finished=await rows(page);
  assert.equal(finished.length,limit+2,'The rejected but held next card automatically queues exactly once');
  assert.deepEqual(finished.slice(0,limit+1).map(({id,originalShot})=>({id,originalShot})),accepted,'Accepting the held next card preserves every earlier original');
  const nextPixels=await pixelCheck(page,finished.at(-1).id,'held-rejected-next');
  assert.equal(await page.evaluate(()=>window.__scannerTest.collectionCount()),0);
  await page.evaluate(()=>{window.__scannerTest.state().auto=false;});
  await screenshot(page,'held-next-after-capacity');await diagnostic(page,'held-next-after-capacity');
  report.scenarios[2].status='passed';report.results.push({case:'rejected-next-card-held-until-capacity',accepted:finished.length,nextPixels,timings:finished.map(({timings,counts})=>({timings,counts})),passed:true});
  console.log('PASS: rejected next card waits at capacity, then automatically queues exactly once without losing earlier originals.');
 }catch(e){report.scenarios[2]={...report.scenarios[2],status:'failed',error:String(e.message||e)};await diagnostic(held.page,'held-next-failure').catch(()=>{});await screenshot(held.page,'held-next-failure').catch(()=>{});failures.push(e);console.error('FAILED: rejected-next-card-held-until-capacity:',e.message);}finally{await held.context.close();}
}finally{
 await writeFile(resolve(out,'scanner-adversarial-report.json'),JSON.stringify(report,null,2));await browser.close();await new Promise(r=>server.close(r));
}
if(failures.length)throw new AggregateError(failures,`${failures.length} hosted scanner lifecycle scenario(s) failed`);
console.log('PASS: hosted synthetic/public-scan lifecycle matrix. Physical-camera and real-OCR claims are intentionally separate.');
