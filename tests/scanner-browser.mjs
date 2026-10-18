// Real OCR + real public lookup APIs + production popup/save handlers, before release.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=process.cwd(),refs=[
 {game:'Magic',g:'mtg',name:'Lightning Bolt',id:'7673784e-db4b-43a1-8d55-1bb9fc1e284f',url:'https://api.scryfall.com/cards/7673784e-db4b-43a1-8d55-1bb9fc1e284f'},
 {game:'Pokémon',g:'ptcg',name:'Kyogre',id:'cel25-3',url:'https://api.tcgdex.net/v2/en/cards/cel25-3'},
 {game:'Yu-Gi-Oh!',g:'ygo',name:'Dark Magician',id:'46986414',url:'https://db.ygoprodeck.com/api/v7/cardinfo.php?name=Dark%20Magician'}
];
async function download(url){
 let last;for(let attempt=0;attempt<3;attempt++){
  try{const r=await fetch(url,{headers:{'User-Agent':'CardStashy-Scanner-Regression/1.0','Accept':'*/*'},signal:AbortSignal.timeout(30000)});if(r.ok)return r;last=Error(`Reference unavailable: ${url} (${r.status})`);if(r.status<500&&r.status!==429)throw last;}catch(e){last=e;}
  if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)));
 }throw last;
}
for(const ref of refs){
 const raw=await (await download(ref.url)).json(),card=raw.data?.[0]||raw;
 assert.equal(card.name,ref.name);
 const image=ref.g==='mtg'?card.image_uris.normal:ref.g==='ptcg'?card.image+'/high.webp':card.card_images[0].image_url;
 ref.bytes=Buffer.from(await (await download(image)).arrayBuffer());ref.mime=ref.g==='ptcg'?'image/webp':'image/jpeg';
 console.log(`Reference loaded: ${ref.game} ${ref.name}, ${ref.bytes.length} image bytes.`);
}
const server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost'),ref=refs.find(r=>url.pathname==='/__reference/'+r.g);
 if(ref){res.setHeader('Content-Type',ref.mime);return res.end(ref.bytes);}
 if(url.pathname==='/__synthetic-scanner.html'){
  res.setHeader('Content-Type','text/html');
  return res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>#scanVideo{display:block;width:378px;height:416px;object-fit:cover}</style><div id="camSlot"></div><div id="camStatus"></div><div id="scanStatus"></div>');
 }
 const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(file)]||'application/octet-stream');let body=await readFile(file);if(file.endsWith("/config.js"))body=Buffer.from(body.toString().replace(/key:\s*"[^"]*"/,'key: ""'));res.end(body);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
await mkdir('test-results',{recursive:true});
// Hosted CI only: real browser canvas/MediaStream/detector/automatic admission,
// but deterministic local OCR/provider outputs. This is not a physical-phone or
// OCR-accuracy test. It neither asks for camera permission nor writes a collection.
async function syntheticRefinementCase(){
 const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage(),outsideRequests=[];
 page.setDefaultTimeout(15000);
 await context.route('**/*',route=>{
  if(new URL(route.request().url()).origin===base)return route.continue();
  outsideRequests.push(route.request().url());return route.abort('blockedbyclient');
 });
 try{
  await page.goto(base+'/__synthetic-scanner.html');
  await page.evaluate(async()=>{
   const {S,blank}=await import('/store.js'),{registerScanner,releaseOCR,T,SCAN_LIMITS}=await import('/scancam.js'),{loadBatch,saveBatch}=await import('/scan-batch.js'),{savePrefs}=await import('/scansession.js');
   localStorage.clear();S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';
   const idle=()=>({mode:'live',auto:true,camOn:false,busy:false,cands:[],confirm:null,read:null,status:'',catalogInitGame:'mtg'});
   S.ui.scan=idle();saveBatch([]);savePrefs('mtg',{sounds:false,haptics:false});
   const fixture={phase:'initial',ink:135,ocrCalls:0,adapterCalls:0,writes:0,frames:0};
   const canvas=document.createElement('canvas');canvas.width=640;canvas.height=900;
   const x=canvas.getContext('2d'),frames=new Map();
   const pixels=ink=>{
    if(frames.has(ink))return frames.get(ink);
    const image=x.createImageData(canvas.width,canvas.height),data=image.data;
    for(let y=0;y<canvas.height;y++)for(let xx=0;xx<canvas.width;xx++){
     const u=(xx-120)/400,v=(y-170)/560;let rgb=[35,47,50];
     if(u>=0&&u<1&&v>=0&&v<1){
      rgb=[220,195,60];
      if(u>.045&&u<.955&&v>.025&&v<.975)rgb=[205,205,205];
      if(u>.07&&u<.93&&v>.18&&v<.60)rgb=[65+Math.floor(u*12)%3*20,75+Math.floor(v*10)%3*20,90];
      if(u>.08&&u<.92&&((v>.05&&v<.105)||(v>.90&&v<.94)))rgb=Math.floor(u*40)%3<2?[ink,ink,ink]:[205,205,205];
     }
     data.set([...rgb,255],(y*canvas.width+xx)*4);
    }
    frames.set(ink,image);return image;
   };
   fixture.draw=()=>{x.putImageData(pixels(fixture.ink),0,0);fixture.frames++;};fixture.draw();
   fixture.drawTimer=setInterval(fixture.draw,33);
   navigator.mediaDevices.getUserMedia=async()=>{fixture.stream=canvas.captureStream(30);return fixture.stream;};
   window.Tesseract={createWorker:async()=>({recognize:async()=>{fixture.ocrCalls++;return {data:{text:fixture.phase==='initial'?'':'Lightning Bolt\nU 0806\nMSC EN'}};},terminate:async()=>{}})};
   const bolt={id:'synthetic-lightning-bolt',name:'Lightning Bolt',set:'msc',collector_number:'806',finishes:['nonfoil']};
   const ctx={A:{},C:{},game:()=>S.state.settings.game,render:()=>ctx.afterRender?.(),toast(){},priceOf:()=>null,setOf:()=>bolt.set,numberOf:()=>bolt.collector_number,
    match:async()=>{fixture.adapterCalls++;return {cands:fixture.phase==='initial'?[]:[{id:bolt.id,name:bolt.name,card:bolt,exact:true}],tried:[]};},
    addMany:async()=>{fixture.writes++;throw Error('Synthetic camera must never save a collection');}};
   registerScanner(ctx);window.__scanDebug=[];
   Object.assign(fixture,{ctx,state:()=>S.ui.scan,rows:loadBatch,limits:SCAN_LIMITS,thresholds:T,
    improve(){fixture.phase='improved';fixture.ink=35;fixture.draw();window.__scanDebug=[];},
    async reset(){ctx.stopCamera();saveBatch([]);fixture.phase='initial';fixture.ink=135;fixture.draw();S.ui.scan=idle();window.__scanDebug=[];await ctx.A.scanStart();},
    async stop(){ctx.stopCamera();clearInterval(fixture.drawTimer);await releaseOCR();}});
   window.__refinement=fixture;await ctx.A.scanStart();
  });
  const settledFirst=()=>page.waitForFunction(()=>{const f=window.__refinement,r=f.rows();return r.length===1&&r[0].status==='unresolved'&&!f.state().busy;},null,{timeout:20000});
  const liveTicks=async(n=12)=>{await page.evaluate(()=>{window.__scanDebug=[];});await page.waitForFunction(n=>window.__scanDebug.length>=n,n,{timeout:10000});};
  await settledFirst();
  const initial=await page.evaluate(()=>{const f=window.__refinement,r=f.rows()[0];f.first=r;return {id:r.id,revision:r.captureRevision,intent:r.captureIntent,original:!!r.originalShot,refinements:r.refinementCount,quality:window.__scanDebug.at(-1),writes:f.writes};});
  assert.equal(initial.intent,'automatic');assert(initial.original);assert.equal(initial.refinements,0);assert.equal(initial.writes,0);
  await liveTicks();
  assert(await page.evaluate(()=>{const f=window.__refinement,r=f.rows();return r.length===1&&r[0].id===f.first.id&&r[0].captureRevision===f.first.captureRevision&&!r[0].refinementShot;}),'unchanged live frames cannot refine or make another row');
  await page.evaluate(()=>window.__refinement.improve());
  await page.waitForFunction(()=>{const f=window.__refinement,r=f.rows();return r.length===1&&r[0].id===f.first.id&&r[0].captureRevision!==f.first.captureRevision&&r[0].status==='review'&&!f.state().busy;},null,{timeout:15000});
  const refined=await page.evaluate(()=>{
   const f=window.__refinement,r=f.rows()[0];f.refined=r;
   return {id:r.id,revision:r.captureRevision,status:r.status,refinements:r.refinementCount,originalRetained:r.originalShot===f.first.originalShot,
    differentSupplement:!!r.refinementShot&&r.refinementShot!==r.originalShot,initialEvidenceRetained:JSON.stringify(r.initialEvidence?.read)===JSON.stringify(f.first.read)&&JSON.stringify(r.initialEvidence?.cands)===JSON.stringify(f.first.cands),
    printingVerified:r.printingVerified,finish:r.finish,candidates:r.cands.length,budget:r.budget,writes:f.writes,quality:window.__scanDebug.at(-1)};
  });
  assert.equal(refined.id,initial.id);assert.notEqual(refined.revision,initial.revision);assert.equal(refined.refinements,1);
  assert(refined.originalRetained&&refined.differentSupplement&&refined.initialEvidenceRetained,'first original and first evidence survive as a distinct clearer frame is appended');
  assert(refined.candidates>0);assert.equal(refined.status,'review');assert.equal(refined.printingVerified,false);assert.equal(refined.finish,'');assert.equal(refined.writes,0);
  assert(refined.budget.ocrCalls<=18&&refined.budget.adapterRounds<=3,'initial and supplemental recognition share one finite capture budget');
  await liveTicks();
  assert(await page.evaluate(()=>{const f=window.__refinement,r=f.rows();return r.length===1&&r[0].captureRevision===f.refined.captureRevision&&r[0].refinementCount===1;}),'the held clearer frame cannot trigger another supplement or another row');
  await page.waitForFunction(()=>Date.now()-window.__refinement.state().lastCaptureAt>=600);
  await page.evaluate(()=>window.__refinement.ctx.A.scanCapture());
  await page.waitForFunction(()=>{const f=window.__refinement;return f.rows().length===2&&!f.state().busy&&f.rows().every(r=>!['captured','reading'].includes(r.status));});
  const manual=await page.evaluate(()=>{const f=window.__refinement,r=f.rows();return {ids:r.map(x=>x.id),intents:r.map(x=>x.captureIntent),firstRevision:r[0].captureRevision,writes:f.writes};});
  assert.notEqual(manual.ids[0],manual.ids[1]);assert.deepEqual(manual.intents,['automatic','manual']);assert.equal(manual.firstRevision,refined.revision);assert.equal(manual.writes,0);

  // A separate fresh automatic capture tests review protection before it has
  // consumed the one-refinement allowance; otherwise that test would be vacuous.
  await page.evaluate(()=>window.__refinement.reset());await settledFirst();
  await page.evaluate(()=>{
   const f=window.__refinement;f.touched=f.rows()[0];f.beforeReviewQuality=window.__scanDebug.at(-1);
   f.ctx.A.scanBatchReview({dataset:{id:f.touched.id}});f.ctx.A.scanDismiss();f.ocrAtReview=f.ocrCalls;f.improve();
  });
  await liveTicks(16);
  const touched=await page.evaluate(()=>{
   const f=window.__refinement,r=f.rows();return {rows:r.length,id:r[0]?.id,sameRevision:r[0]?.captureRevision===f.touched.captureRevision,reviewTouched:r[0]?.reviewTouched,
    refinements:r[0]?.refinementCount,supplement:!!r[0]?.refinementShot,extraOCR:f.ocrCalls-f.ocrAtReview,quality:window.__scanDebug.at(-1),beforeQuality:f.beforeReviewQuality,writes:f.writes};
  });
  assert.equal(touched.rows,1);assert(touched.sameRevision&&touched.reviewTouched);assert.equal(touched.refinements,0);assert.equal(touched.supplement,false);assert.equal(touched.extraOCR,0);assert.equal(touched.writes,0);
  assert(touched.quality.sharp>=Math.max(150,touched.beforeQuality.sharp*1.35,touched.beforeQuality.sharp+75),'review test really presents materially clearer pixels, rather than relying on unchanged-frame rejection');
  assert.deepEqual(outsideRequests,[],'synthetic refinement uses no external OCR/provider/image request');
  console.log(`PASS: synthetic live automatic capture → unresolved → one same-ID clearer-frame revision → review only; unchanged frames and reviewed rows cannot refine; deliberate manual second copy remains distinct. ${JSON.stringify({initial,refined,manual,touched})}`);
 }finally{
  await page.evaluate(()=>window.__refinement?.stop()).catch(()=>{});await context.close();
 }
}
const failures=[];
try{
 for(const ref of refs){
  const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage();page.setDefaultTimeout(15000);
  const lookupNetwork=[];const track=(kind,url,extra='')=>{if(url.startsWith('https://api.scryfall.com/')){lookupNetwork.push({kind,url,extra,at:Date.now()});if(lookupNetwork.length>40)lookupNetwork.shift();}};page.on('request',r=>track('request',r.url()));page.on('response',r=>track('response',r.url(),r.status()));page.on('requestfailed',r=>track('failed',r.url(),r.failure()?.errorText));
  const browserErrors=[];page.on('console',m=>{if(m.type()==='error')browserErrors.push(m.text().slice(0,700));});
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');const lookupIds=new Set();
  cdp.on('Network.requestWillBeSent',e=>{if(e.request.url.startsWith('https://api.scryfall.com/'))lookupIds.add(e.requestId);});
  cdp.on('Network.loadingFailed',e=>{if(lookupIds.has(e.requestId))lookupNetwork.push({kind:'browser-network-error',error:e.errorText,blockedReason:e.blockedReason,cors:e.corsErrorStatus});});
  try{
   await page.goto(base+'/#scan');await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
   const skip=page.getByRole('button',{name:'Skip',exact:true});try{await skip.waitFor({state:'visible',timeout:2000});await skip.click();}catch{}
   if(ref.g!=='mtg'){
    await page.locator(`#gameTabs [data-game="${ref.g}"]`).click();
    await page.locator(`#gameTabs [data-game="${ref.g}"][aria-selected="true"]`).waitFor();
   }
   // Exercise the user's explicit opt-in download, integrity check and durable cache.
   await page.getByRole('button',{name:'Scanner settings',exact:true}).first().click();
   await page.locator('[data-act="scanCatalogDownload"]').click();
   await page.getByText(/local card records ready/).waitFor({timeout:45000});
   const local=await page.evaluate(async g=>{
    const c=await import('/scan-catalog.js');const start=performance.now();
    const read=g==='mtg'?{name:'Lightning Bolt',code:'U 0806\nMSC EN'}:g==='ptcg'?{name:'Kyogre',code:'003/025'}:{name:'Dark Magician',code:'LOB-EN005'};
    // Network is disabled only for this lookup: catalogue recognition must use no HTTP.
    const prior=window.fetch;window.fetch=()=>{throw Error('Recognition attempted an HTTP request');};
    try{const r=await c.localScanMatch(g,read);return {names:r.cands.map(x=>x.name),ids:r.cands.map(x=>x.id),exact:r.cands[0]?.exact,ms:performance.now()-start};}finally{window.fetch=prior;}
   },ref.g);
   assert(local.names.includes(ref.name));assert(local.exact);if(ref.id)assert(local.ids.includes(ref.id));console.log(`${ref.game} cached identifier lookup, HTTP blocked: ${JSON.stringify(local)}`);
   await page.reload();await page.getByRole('button',{name:'Scanner settings',exact:true}).first().click();await page.getByText(/local card records ready/).waitFor({timeout:15000});
   await page.locator('#sheet[open] [data-act="closeSheet"]').first().click();
   // Playwright 1.62 polls predicate return values synchronously. Import once;
   // never return a truthy Promise from the polling predicate itself.
   await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js'),{S}=await import('/store.js');window.__scannerTestRead={loadBatch,state:()=>S.ui.scan,collection:g=>(g==='mtg'?S.state:S.state.tcg[g]).collection};});
   await page.getByRole('button',{name:'Photo',exact:true}).click();
   const upload=page.locator('input[data-change="scanFile"]').last();
   await upload.setInputFiles({name:ref.g+(ref.g==='ptcg'?'.webp':'.jpg'),mimeType:ref.mime,buffer:ref.bytes});
   await page.getByRole('button',{name:'Read card',exact:true}).click();
   await page.waitForFunction(()=>{const q=window.__scannerTestRead;return q.loadBatch().some(x=>['ready','review','unresolved'].includes(x.status))&&!q.state().busy;},{},{timeout:120000});
   const framing=await page.evaluate(async g=>{
    const {S}=await import('/store.js'),image=new Image();image.src='/__reference/'+g;await image.decode();
    const card=S.ui.scan.lastCard;
    return {source:image.naturalWidth/image.naturalHeight,capture:card.width/card.height};
   },ref.g);
   assert(Math.abs(framing.source-framing.capture)<.002,`${ref.game} full-card upload preserves title/footer and original portrait framing, never the sideways artwork window`);
   assert.equal(await page.locator('.scan-confirm').count(),0,'OCR does not interrupt capture with a picker');
   await page.locator('[data-act="scanBatchReview"]').first().click();
   await page.locator('.scan-confirm').waitFor({state:'visible',timeout:15000});
   const read=await page.evaluate(async()=>{const {S}=await import('/store.js');return {read:S.ui.scan.read,status:S.ui.scan.status,tried:S.ui.scan.tried,recognitionMs:S.ui.scan.recognitionMs};});
   console.log(`${ref.game} real OCR: ${JSON.stringify(read)}`);
   const popup=page.getByRole('region',{name:'Confirm scanned card',exact:true});
   assert.equal(await popup.count(),1,`${ref.game} reference photo must produce a candidate, not a blank result`);
   assert.equal(await popup.getByText(ref.name,{exact:true}).count(),1,`${ref.game} correct card title`);
   assert.equal(await popup.getByRole('img',{name:ref.name,exact:true}).count(),1,'card copy is shown');
   let reviewedPrinting=null;
   if(ref.g==='mtg'){
    const pending=await page.evaluate(async expectedId=>{
     const {S}=await import('/store.js'),{mtgCollectors}=await import('/scan.js'),{textVerifiedMatch}=await import('/scancam.js'),s=S.ui.scan,i=s.cands.findIndex(c=>String(c.id)===expectedId),c=s.cands[i];
     return {selected:s.confirm.i,i,id:c?.id,set:c?.card?.set,number:c?.card?.collector_number,exact:c?.exact,verified:!!c&&textVerifiedMatch('mtg',c,s.read),observations:mtgCollectors(s.read.code,s.read.full),saved:S.state.collection.length};
    },ref.id);
    assert.equal(pending.id,ref.id,'photo review retains the exact reference printing, not just its name');assert.equal(pending.set,'msc');assert.equal(String(pending.number).replace(/^0+/,''),'806');assert.equal(pending.saved,0);
    if(pending.observations.length>1){assert.equal(pending.selected,-1,'conflicting photo readings cannot silently select a printing');assert.equal(pending.exact,false);assert.equal(pending.verified,false);}
    if(pending.selected<0){
     assert.equal(pending.verified,false,'an unverified printing needs an explicit choice');
     assert(await popup.locator('[data-change="scanConfirmFinish"]').isDisabled(),'finish waits for printing review');
     assert(await popup.getByRole('button',{name:'Add to collection',exact:true}).isDisabled(),'unreviewed printing cannot be saved');
     await popup.locator(`[data-act="scanChoose"][data-i="${pending.i}"]`).click();
     const selected=await page.evaluate(async()=>{const {S}=await import('/store.js'),{textVerifiedMatch}=await import('/scancam.js'),s=S.ui.scan,c=s.cands[s.confirm.i];return {id:c.id,exact:c.exact,verified:textVerifiedMatch('mtg',c,s.read)};});
     assert.equal(selected.id,ref.id);assert.equal(selected.exact,pending.exact,'manual review does not fabricate OCR proof');assert.equal(selected.verified,false);
    }else assert.equal(pending.selected,pending.i,'only the actual reference printing may already be selected');
    assert(await popup.locator('[data-change="scanConfirmFinish"]').isEnabled(),'explicit printing review enables finish choice');
   }
   if(ref.g==='ptcg'){
    const pending=await page.evaluate(async expectedId=>{
     const {S}=await import('/store.js'),{textVerifiedMatch}=await import('/scancam.js'),s=S.ui.scan,i=s.cands.findIndex(c=>String(c.id)===expectedId),c=s.cands[i];
     return {selected:s.confirm.i,i,id:c?.id,exact:c?.exact,verified:!!c&&textVerifiedMatch('ptcg',c,s.read),saved:S.state.tcg.ptcg.collection.length};
    },ref.id);
    assert.equal(pending.id,ref.id,'Pokémon photo offers the exact reference printing');assert.equal(pending.saved,0);
    if(pending.selected<0){
     assert(await popup.locator('[data-change="scanConfirmFinish"]').isDisabled());assert(await popup.getByRole('button',{name:'Add to collection',exact:true}).isDisabled());
     await popup.locator(`[data-act="scanChoose"][data-i="${pending.i}"]`).click();
     const selected=await page.evaluate(async()=>{const {S}=await import('/store.js'),{textVerifiedMatch}=await import('/scancam.js'),s=S.ui.scan,c=s.cands[s.confirm.i];return {id:c.id,exact:c.exact,verified:textVerifiedMatch('ptcg',c,s.read)};});
     assert.equal(selected.id,ref.id);assert.equal(selected.exact,pending.exact);assert.equal(selected.verified,pending.verified,'manual review preserves, not invents, OCR evidence');
    }else assert.equal(pending.selected,pending.i,'only the reference Pokémon printing may already be selected');
    assert(await popup.locator('[data-change="scanConfirmFinish"]').isEnabled());
   }
   if(ref.g==='ygo'){
    // This public image is marked Replica and has no actual set code. Its
    // artwork/name identifies Dark Magician, not CT13 or a 25th printing.
    assert.match(read.read.code,/Replica/i,'fixture has no proof of a retail printing');
    assert(await popup.locator('[data-change="scanConfirmFinish"]').isDisabled(),'edition waits for explicit printing review');
    assert(await popup.getByRole('button',{name:'Add to collection',exact:true}).isDisabled(),'ambiguous printing cannot be added');
    const pending=await page.evaluate(async()=>{const {S}=await import('/store.js');return {selected:S.ui.scan.confirm.i,options:S.ui.scan.cands.map((c,i)=>({i,id:String(c.card?.id||c.id),name:c.name,print:c.print,exact:c.exact})),saved:S.state.tcg.ygo.collection.length};});
    assert.equal(pending.selected,-1,'no first-result printing is silently chosen');assert.equal(pending.saved,0);
    assert(pending.options.length>=2&&pending.options.length<=3,'ambiguous printing offers a compact review');
    assert(pending.options.every(c=>c.name===ref.name&&c.id===ref.id&&!c.exact),'same-name suggestions are not OCR-proven printings');
    reviewedPrinting=pending.options[1];assert(reviewedPrinting.print,'offered printing has explicit set/rarity identity');
    await popup.locator(`[data-act="scanChoose"][data-i="${reviewedPrinting.i}"]`).click();
    const selected=await page.evaluate(async()=>{const {S}=await import('/store.js');const q=S.ui.scan.confirm,c=S.ui.scan.cands[q.i];return {i:q.i,print:c.print,exact:c.exact};});
    assert.equal(selected.i,reviewedPrinting.i);assert.equal(selected.print,reviewedPrinting.print);assert.equal(selected.exact,false,'manual review does not fabricate OCR proof');
    assert(await popup.locator('[data-change="scanConfirmFinish"]').isEnabled(),'reviewing printing enables edition choice');
   }
   await popup.getByRole('button',{name:'More copies',exact:true}).click();await popup.getByRole('button',{name:'More copies',exact:true}).click();
   // Detail hydration can replace this row after recognition. Wait for an actual
   // offered finish instead of reading the temporary empty option collection.
   await popup.locator('[data-change="scanConfirmFinish"] option:not([value=""])').first().waitFor({state:'attached'});
   const finish=await popup.locator('[data-change="scanConfirmFinish"] option').evaluateAll(opts=>opts.find(x=>x.value)?.value);
   assert(finish,'printing exposes a finish to explicitly confirm');
   await popup.locator('[data-change="scanConfirmFinish"]').selectOption(finish);
   await popup.locator('.scan-review-more summary').click();
   await popup.getByRole('button',{name:'Lightly Played',exact:true}).click();
   await popup.getByRole('combobox',{name:'Scanned card language',exact:true}).tap();
   await page.locator('.glass-select-menu[open]').getByRole('option',{name:'Japanese',exact:true}).tap();
   await popup.getByRole('button',{name:'Add to collection',exact:true}).click();
   await popup.waitFor({state:'detached'});
   assert(await page.locator('.scan-saved-receipt').isVisible(),'Successful save shows its receipt');
   assert.match(await page.locator('.scan-saved-receipt').innerText(),/Lightly Played/);
   const saved=await page.evaluate(async g=>{const {S}=await import('/store.js');return (g==='mtg'?S.state:S.state.tcg[g]).collection;},ref.g);
   assert.equal(saved.length,1);assert.equal(saved[0].name,ref.name);if(ref.id)assert.equal(String(ref.g==='mtg'?saved[0].printingId:saved[0].cardId),ref.id,'same name is insufficient: save the correct indexed card/printing');assert.equal(saved[0].qty,3);assert.equal(saved[0].condition,'Lightly Played');assert.equal(saved[0].language,'ja');
   if(ref.g==='mtg'){assert.equal(saved[0].set,'MSC');assert.equal(String(saved[0].collectorNumber),'806');assert.equal(saved[0].finish,finish);assert.equal(saved[0].printingVerified,true,'explicit review confirms the saved printing, not the OCR evidence');}
   if(ref.g==='ptcg')assert.equal(saved[0].variant,finish,'save retains the explicitly selected Pokémon variant');
   if(reviewedPrinting){
    const [printing,rarity]=reviewedPrinting.print.split('|');
    assert.equal(saved[0].printing,printing,'save retains the explicitly reviewed set code');assert.equal(saved[0].rarity,rarity,'save retains the explicitly reviewed rarity');assert.equal(saved[0].edition,finish,'save retains the explicitly confirmed edition');
    console.log(`PASS: Yu-Gi-Oh! replica remains unverified; explicit user review selects ${reviewedPrinting.print}, not an inferred photo printing.`);
   }
   await page.getByRole('navigation',{name:'Main',exact:true}).getByRole('button',{name:'Collection',exact:true}).click();
   await page.getByRole('heading',{name:'Collection',exact:true}).waitFor();await page.locator('main').getByRole('img',{name:ref.name,exact:true}).first().waitFor({state:'visible'});
   console.log(`PASS: ${ref.game}: reference photo → OCR batch → explicit review → finish/dropdown edit → 3 LP/Japanese copies saved once → collection screen.`);
   // Feed actual reference artwork through a browser MediaStream. This exercises
   // capture and retained playback, without claiming a physical camera test.
   await page.getByRole('navigation',{name:'Main',exact:true}).getByRole('button',{name:'Scan',exact:true}).click();
   await page.getByRole('heading',{name:'Scan',exact:true}).waitFor();
   // Route rendering is asynchronous. Wait for the retained photo-mode toggle
   // rather than using count() against the previous Collection DOM.
   await page.locator('[data-act="scanMode"][data-id="live"]').click();
   await page.getByRole('button',{name:'Start camera',exact:true}).waitFor();
   await page.evaluate(async g=>{
    const {guideRect}=await import('/scancam.js'),image=new Image();image.src='/__reference/'+g;await image.decode();
    navigator.mediaDevices.getUserMedia=async()=>{
     const canvas=document.createElement('canvas');canvas.width=640;canvas.height=900;const x=canvas.getContext('2d');
     // A real camera's physical pixels do not rescale when a DOM tray appears.
     // Fill most of the sensor with a large rotated/off-centre card; no tiny guide.
     // Keep these source pixels unchanged throughout attachment and resize.
     const guide=guideRect(640,900),draw=()=>{x.fillStyle='#567064';x.fillRect(0,0,640,900);x.save();x.translate(guide.x+guide.w*.51,guide.y+guide.h*.48);x.rotate(.13);x.drawImage(image,-guide.w*.46,-guide.h*.46,guide.w*.92,guide.h*.92);x.restore();};draw();setInterval(draw,33);
     window.__cameraCanvas=canvas;window.__cameraPixels=canvas.toDataURL();
     window.__cameraStream=canvas.captureStream(30);return window.__cameraStream;
    };
   },ref.g);
   // Opt out before attach starts its loop; a slow runner must not auto-capture
   // this stationary fixture before the exact manual capture under test.
   await page.evaluate(async()=>{const {S}=await import('/store.js');S.ui.scan.auto=false;});
   await page.getByRole('button',{name:'Start camera',exact:true}).click();
   await page.locator('#scanVideo').waitFor();
   await page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth>0);
   await page.evaluate(()=>{const r=document.querySelector('#scanVideo').getBoundingClientRect();window.__cameraInitialBox={width:r.width,height:r.height};});
   // A close card near the sensor edge may correctly fail the conservative auto
   // contour gate. The shutter must still preserve the full sensor and read it.
   await page.getByRole('button',{name:'Capture card now',exact:true}).waitFor();
   assert.equal(await page.locator('.scan-frame-hint,#camGuide,.cam-wrap polygon').count(),0,'camera has no fixed alignment target or detector overlay');
   const priorCaptureIds=await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js');return loadBatch().map(x=>x.id);});
   await page.getByRole('button',{name:'Capture card now',exact:true}).click();
   const captureHandle=await page.waitForFunction(prior=>window.__scannerTestRead.loadBatch().find(x=>!prior.includes(x.id))?.id,priorCaptureIds,{timeout:15000});
   const liveCaptureId=await captureHandle.jsonValue();
   await page.waitForFunction(id=>{const q=window.__scannerTestRead,entry=q.loadBatch().find(x=>x.id===id),v=document.querySelector('#scanVideo');return entry&&['ready','review','unresolved'].includes(entry.status)&&!q.state().busy&&v?.isConnected&&v.srcObject===window.__cameraStream&&!v.paused&&v.videoWidth>0&&v.srcObject.getTracks()[0]?.readyState==='live';},liveCaptureId,{timeout:120000});
   console.log(`${ref.game} live capture diagnostic: ${JSON.stringify(await page.evaluate(async()=>{
    const {loadBatch}=await import('/scan-batch.js'),{S}=await import('/store.js'),v=document.querySelector('#scanVideo'),r=v.getBoundingClientRect();
    return {initialBox:window.__cameraInitialBox,video:{width:v.videoWidth,height:v.videoHeight,boxWidth:r.width,boxHeight:r.height},capture:{width:S.ui.scan.lastCard?.width,height:S.ui.scan.lastCard?.height},batch:loadBatch().map(({id,status,read,error,cands})=>({id,status,read,error,candidates:(cands||[]).map(({id,name,exact})=>({id,name,exact}))}))};
   }))}`);
   const liveMatch=await page.evaluate(async({captureId,expectedId})=>{
    const {loadBatch}=await import('/scan-batch.js'),{mtgCollectors}=await import('/scan.js'),{textVerifiedMatch}=await import('/scancam.js'),entry=loadBatch().find(x=>x.id===captureId),candidate=entry?.cands?.find(x=>String(x.id)===expectedId);
    return {status:entry?.status,id:candidate?.id,set:candidate?.card?.set,number:candidate?.card?.collector_number,exact:candidate?.exact,verified:!!candidate&&textVerifiedMatch(entry.game,candidate,entry.read),observations:entry?.game==='mtg'?mtgCollectors(entry.read?.code,entry.read?.full):[]};
   },{captureId:liveCaptureId,expectedId:ref.id});
   assert.equal(String(liveMatch.id),ref.id,`${ref.game} live recognition must retain the actual reference printing, never only a matching name`);
   if(ref.g==='mtg'){
    assert.equal(liveMatch.set,'msc');assert.equal(String(liveMatch.number).replace(/^0+/,''),'806');
    if(liveMatch.observations.length>1){assert.equal(liveMatch.status,'review','conflicting OCR requires explicit review, never automatic ready');assert.equal(liveMatch.exact,false);assert.equal(liveMatch.verified,false);}
   }
   await page.locator(`[data-act="scanBatchReview"][data-id="${liveCaptureId}"]`).click();
   await page.getByRole('region',{name:'Confirm scanned card',exact:true}).waitFor({timeout:15000});
   await page.getByRole('region',{name:'Confirm scanned card',exact:true}).getByText(ref.name,{exact:true}).waitFor();
   const beforeTime=await page.locator('#scanVideo').evaluate(v=>v.currentTime);await page.waitForTimeout(250);
   assert(await page.locator('#scanVideo').evaluate((v,t)=>!v.paused&&v.currentTime>t&&v.srcObject===window.__cameraStream&&v.srcObject.getTracks()[0].readyState==='live',beforeTime),'video keeps playing behind confirmation');
   await page.getByRole('button',{name:'Keep for later and continue scanning',exact:true}).click();
   assert(await page.locator('#scanVideo').evaluate(v=>v.srcObject===window.__cameraStream&&v.srcObject.getTracks()[0].readyState==='live'),'dismiss keeps the same live camera stream');
   await page.evaluate(()=>window.scrollTo(0,0));
   const shellTray=await page.locator('.scan-batch-tray').boundingBox(),shellNav=await page.getByRole('navigation',{name:'Main',exact:true}).boundingBox();
   assert(shellTray.y+shellTray.height<=shellNav.y,'production app shell keeps the complete live tray above navigation');
   await page.screenshot({path:`test-results/scanner-${ref.g}-live.png`,fullPage:false});
   const retainedBatch=await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js');return loadBatch().map(x=>x.id);});
   // Neutralize only the original expiry timer, then expose the real saved toast
   // as an active fixture for every measurement. Passing with an expired/hidden
   // toast is forbidden; no markup, event handler, Undo state or OCR is replaced.
   await page.waitForFunction(()=>{const t=document.querySelector('#toast');return t&&!t.classList.contains('show')&&!t.classList.contains('has-action');},null,{timeout:10000});
   assert.equal(await page.locator('#toast .toast-undo[data-act="undo"]').count(),1,'the actual scan-save toast retains its real Undo action');
   const originalToast=await page.evaluate(()=>{const t=document.querySelector('#toast'),before={classes:t.className,html:t.innerHTML};t.classList.add('show','has-action');return before;});
   try{
    for(const viewport of [{width:320,height:568},{width:320,height:844},{width:390,height:844},{width:768,height:1024},{width:1024,height:768},{width:1440,height:900},{width:2560,height:1440},{width:700,height:500},{width:844,height:390},{width:1024,height:600}]){
     await page.setViewportSize(viewport);await page.evaluate(()=>window.scrollTo(0,0));
     await page.evaluate(async()=>{await Promise.all(document.querySelector('#toast').getAnimations().map(a=>a.finished.catch(()=>{})));});
     const layout=await page.evaluate(()=>{
      const box=n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
      const describe=n=>n?{tag:n.tagName,id:n.id,classes:n.className}:null;
      const hit=n=>{const r=box(n),target=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {clear:target===n||n.contains(target),target:describe(target)};};
      const nav=document.querySelector('.bottom-nav'),tray=box(document.querySelector('.scan-batch-tray')),camera=box(document.querySelector('.cam-wrap.immersive'));
      const statusNode=document.querySelector('#camStatus'),priorStatus=statusNode.innerHTML;if(innerWidth===320&&innerHeight>700)statusNode.replaceChildren(statusNode.querySelector('.cam-dot').cloneNode(true),document.createTextNode('Saved for review. Use Scan again to retry, or move to the next card'));
      statusNode.innerHTML=priorStatus;
      const shutter=document.querySelector('#scanCaptureBtn'),toast=document.querySelector('#toast'),undo=toast.querySelector('.toast-undo[data-act="undo"]');
      const clearBottom=getComputedStyle(nav).display==='none'?innerHeight:nav.getBoundingClientRect().top,t=box(toast),s=box(shutter),u=undo&&box(undo),css=getComputedStyle(toast);
      const disjoint=(a,b)=>a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom;
      const inView=r=>!!r&&r.width>0&&r.height>0&&r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=clearBottom;
      const shutterHit=hit(shutter),undoHit=undo?hit(undo):{clear:false,target:null};
      return {tray,camera,shutter:s,toast:t,undo:u,clearBottom,shutterHit,undoHit,shutterClear:shutterHit.clear,overflow:document.documentElement.scrollWidth>innerWidth,
       toastActive:toast.classList.contains('show')&&toast.classList.contains('has-action')&&css.display!=='none'&&css.visibility==='visible'&&Number(css.opacity)>0,
       toastOutside:[camera,tray,s].every(r=>disjoint(t,r)),controlsInView:inView(t)&&inView(s)&&inView(u),undoEnabled:!!undo&&!undo.disabled};
     });
     assert.equal(await page.locator('.scan-frame-hint,#camGuide,.cam-wrap polygon').count(),0,'no alignment target at any size');
     assert(layout.tray.top>=0&&layout.tray.bottom<=layout.clearBottom,`real shell tray clears navigation at ${JSON.stringify(viewport)}: ${JSON.stringify(layout)}`);
     assert(layout.camera.height>=100&&layout.shutterClear&&!layout.overflow,`real shell keeps camera and capture usable at ${JSON.stringify(viewport)}: ${JSON.stringify(layout)}`);
     assert(layout.toastActive&&layout.toastOutside&&layout.controlsInView&&layout.undoEnabled&&layout.undoHit.clear,`active Undo toast clears camera/tray/shutter and both controls remain reachable at ${JSON.stringify(viewport)}: ${JSON.stringify(layout)}`);
     assert(await page.locator('#scanVideo').evaluate(v=>v.srcObject===window.__cameraStream&&v.srcObject.getTracks()[0].readyState==='live'),'fold/landscape resize preserves camera stream');
     assert(await page.evaluate(()=>window.__cameraCanvas.toDataURL()===window.__cameraPixels),'DOM resize cannot reframe the synthetic physical camera pixels');
     assert.deepEqual(await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js');return loadBatch().map(x=>x.id);}),retainedBatch,'fold/landscape resize preserves each captured card');
     if(viewport.width===844)await page.screenshot({path:`test-results/scanner-${ref.g}-landscape.png`,fullPage:false});
    }
    assert.equal(await page.evaluate(g=>window.__scannerTestRead.collection(g).length,ref.g),1,'layout checks do not change the saved collection');
    await page.locator('#toast.show.has-action').getByRole('button',{name:'Undo',exact:true}).click();
    await page.waitForFunction(g=>window.__scannerTestRead.collection(g).length===0,ref.g);
    await page.waitForFunction(()=>{const v=document.querySelector('#scanVideo');return v?.isConnected&&v.srcObject===window.__cameraStream&&!v.paused&&v.videoWidth>0&&v.srcObject.getTracks()[0]?.readyState==='live';});
    assert.deepEqual(await page.evaluate(()=>window.__scannerTestRead.loadBatch().map(x=>x.id)),retainedBatch,'real Undo removes the saved lot, never the pending live captures');
    assert.match(await page.locator('#toast').innerText(),/^Undone:/,'the real Undo handler confirms its collection change');
   }finally{
    // Do not overwrite the production handler's newer "Undone" notification.
    await page.evaluate(before=>{const t=document.querySelector('#toast');if(t?.innerHTML===before.html)t.className=before.classes;},originalToast);
   }
   console.log(`PASS: ${ref.game}: off-centre rotated reference MediaStream → automatic boundary + perspective warp → queued recognition → explicit review → playback continues → active Undo toast clears all resized controls → real Undo retains pending captures and the same camera track.`);
  }catch(e){
   console.error(`FAIL ${ref.game}: ${e.stack}`);console.error('Public lookup network:',JSON.stringify(lookupNetwork));console.error('Browser errors:',JSON.stringify(browserErrors.slice(-12)));console.error('Scan save diagnostic:',await page.evaluate(async()=>{const {S}=await import('/store.js');return S.ui.scan.confirm?.errorDetail||'No save exception';}));console.error((await page.locator('main').innerText()).slice(0,6000));
   console.error('Final capture diagnostic:',await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js'),{S}=await import('/store.js');return {busy:S.ui.scan.busy,error:S.ui.scan.recognitionError,tried:S.ui.scan.tried,read:S.ui.scan.read,batch:loadBatch().map(({id,status,read,error,cands})=>({id,status,read,error,candidates:(cands||[]).map(({id,name,exact})=>({id,name,exact}))}))};}));
   await page.screenshot({path:`test-results/scanner-${ref.g}-failure.png`,fullPage:true});failures.push(e);
  }finally{await context.close();}
 }
 try{await syntheticRefinementCase();}catch(e){failures.push(e);}
 if(failures.length)throw new AggregateError(failures,'Live scanner regression failures; all games attempted.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
