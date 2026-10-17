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
 const file=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
await mkdir('test-results',{recursive:true});
try{
 for(const ref of refs){
  const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage();page.setDefaultTimeout(15000);
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
   await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js'),{S}=await import('/store.js');window.__scannerTestRead={loadBatch,state:()=>S.ui.scan};});
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
   const finish=await popup.locator('[data-change="scanConfirmFinish"] option').evaluateAll(opts=>opts.find(x=>x.value)?.value);
   assert(finish,'printing exposes a finish to explicitly confirm');
   await popup.locator('[data-change="scanConfirmFinish"]').selectOption(finish);
   await popup.locator('.scan-review-more summary').click();
   await popup.getByRole('button',{name:'Lightly Played',exact:true}).click();
   await popup.getByRole('combobox',{name:'Scanned card language',exact:true}).tap();
   await page.locator('.glass-select-menu[open]').getByRole('option',{name:'Japanese',exact:true}).tap();
   await popup.getByRole('button',{name:'Add to collection',exact:true}).click();
   await popup.waitFor({state:'detached'});
   const saved=await page.evaluate(async g=>{const {S}=await import('/store.js');return (g==='mtg'?S.state:S.state.tcg[g]).collection;},ref.g);
   assert.equal(saved.length,1);assert.equal(saved[0].name,ref.name);if(ref.id)assert.equal(String(saved[0].cardId),ref.id,'same name is insufficient: save the correct indexed card/printing');assert.equal(saved[0].qty,3);assert.equal(saved[0].condition,'Lightly Played');assert.equal(saved[0].language,'ja');
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
     // Keep the same rotated/off-centre source frame throughout attachment and resize.
     const guide=guideRect(640,900),draw=()=>{x.fillStyle='#567064';x.fillRect(0,0,640,900);x.save();x.translate(guide.x+guide.w*.44,guide.y+guide.h*.48);x.rotate(.13);x.drawImage(image,-guide.w*.36,-guide.h*.36,guide.w*.72,guide.h*.72);x.restore();};draw();setInterval(draw,33);
     window.__cameraCanvas=canvas;window.__cameraPixels=canvas.toDataURL();
     window.__cameraStream=canvas.captureStream(30);return window.__cameraStream;
    };
   },ref.g);
   await page.getByRole('button',{name:'Start camera',exact:true}).click();
   await page.locator('#scanVideo').waitFor();
   await page.evaluate(async()=>{const {S}=await import('/store.js');S.ui.scan.auto=false;});
   await page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth>0);
   await page.evaluate(()=>{const r=document.querySelector('#scanVideo').getBoundingClientRect();window.__cameraInitialBox={width:r.width,height:r.height};});
   await page.waitForFunction(()=>window.__scannerTestRead.state().boundaryReady);
   assert.equal(await page.locator('#camGuide,.cam-guide,.cam-wrap polygon').count(),0,'internal boundary detection never overlays the feed');
   const priorCaptureIds=await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js');return loadBatch().map(x=>x.id);});
   await page.getByRole('button',{name:'Capture card now',exact:true}).click();
   const captureHandle=await page.waitForFunction(prior=>window.__scannerTestRead.loadBatch().find(x=>!prior.includes(x.id))?.id,priorCaptureIds,{timeout:15000});
   const liveCaptureId=await captureHandle.jsonValue();
   await page.waitForFunction(id=>{const q=window.__scannerTestRead,entry=q.loadBatch().find(x=>x.id===id);return entry&&['ready','review','unresolved'].includes(entry.status)&&!q.state().busy;},liveCaptureId,{timeout:120000});
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
   for(const viewport of [{width:320,height:568},{width:700,height:500},{width:844,height:390},{width:1024,height:600}]){
    await page.setViewportSize(viewport);await page.evaluate(()=>window.scrollTo(0,0));
    const layout=await page.evaluate(()=>{
     const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};
     const nav=document.querySelector('.bottom-nav'),tray=box('.scan-batch-tray'),camera=box('.cam-wrap.immersive'),shutter=document.querySelector('#scanCaptureBtn'),s=shutter.getBoundingClientRect();
     const hit=document.elementFromPoint(s.left+s.width/2,s.top+s.height/2);
     return {tray,camera,clearBottom:getComputedStyle(nav).display==='none'?innerHeight:nav.getBoundingClientRect().top,shutterClear:hit===shutter||shutter.contains(hit),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert(layout.tray.top>=0&&layout.tray.bottom<=layout.clearBottom,`real shell tray clears navigation at ${JSON.stringify(viewport)}: ${JSON.stringify(layout)}`);
    assert(layout.camera.height>=100&&layout.shutterClear&&!layout.overflow,`real shell keeps camera and capture usable at ${JSON.stringify(viewport)}: ${JSON.stringify(layout)}`);
    assert(await page.locator('#scanVideo').evaluate(v=>v.srcObject===window.__cameraStream&&v.srcObject.getTracks()[0].readyState==='live'),'fold/landscape resize preserves camera stream');
    assert(await page.evaluate(()=>window.__cameraCanvas.toDataURL()===window.__cameraPixels),'DOM resize cannot reframe the synthetic physical camera pixels');
    assert.deepEqual(await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js');return loadBatch().map(x=>x.id);}),retainedBatch,'fold/landscape resize preserves each captured card');
    if(viewport.width===844)await page.screenshot({path:`test-results/scanner-${ref.g}-landscape.png`,fullPage:false});
   }
   console.log(`PASS: ${ref.game}: off-centre rotated reference MediaStream → automatic boundary + perspective warp → queued recognition → explicit review → playback continues → dismiss retains the same active camera track.`);
  }catch(e){
   console.error(`FAIL ${ref.game}: ${e.stack}`);console.error('Scan save diagnostic:',await page.evaluate(async()=>{const {S}=await import('/store.js');return S.ui.scan.confirm?.errorDetail||'No save exception';}));console.error((await page.locator('main').innerText()).slice(0,6000));
   console.error('Final capture diagnostic:',await page.evaluate(async()=>{const {loadBatch}=await import('/scan-batch.js'),{S}=await import('/store.js');return {busy:S.ui.scan.busy,error:S.ui.scan.recognitionError,tried:S.ui.scan.tried,read:S.ui.scan.read,batch:loadBatch().map(({id,status,read,error,cands})=>({id,status,read,error,candidates:(cands||[]).map(({id,name,exact})=>({id,name,exact}))}))};}));
   await page.screenshot({path:`test-results/scanner-${ref.g}-failure.png`,fullPage:true});throw e;
  }finally{await context.close();}
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
