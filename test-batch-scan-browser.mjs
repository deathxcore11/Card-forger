// Real DOM, camera MediaStream and production handlers. OCR/API responses are deterministic
// fixtures: this test checks capture concurrency and safety, not physical-phone recognition.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=process.cwd(),output=process.env.SCAN_TEST_OUTPUT||'test-results';
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body data-view="scan"><header class="topbar"><div class="brand">CardStashy</div><button class="btn ghost">Magic</button></header><main id="content"></main><nav class="bottom-nav"><button>Home</button><button>Search</button><button>Collection</button><button>Decks</button><button>Scan</button></nav><script type="module">
import {S,blank} from '/store.js';import {registerScanner,scanView} from '/scancam.js';import {loadBatch,saveBatch} from '/scan-batch.js';import {savePrefs} from '/scansession.js';
S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={mode:'live',auto:false};
window.ocr=[];window.ocrDelay=150;window.saved=[];window.errors=[];
window.Tesseract={createWorker:async()=>({recognize:async()=>{await new Promise(r=>setTimeout(r,window.ocrDelay));return {data:{text:window.ocr.shift()||'Unreadable'}};},terminate:async()=>{}})};
const cards={ptcg:{id:'swsh8-101',name:'Vikavolt',game:'ptcg',hp:150,set:{id:'swsh8',number:'101',total:264},variants:[{key:'normal',label:'Normal'},{key:'reverse-holofoil',label:'Reverse holo',productId:99}],image:''},mtg:{id:'bolt',name:'Lightning Bolt',set:'msc',collector_number:'806',finishes:['nonfoil'],image_uris:{}}};
const A={},C={},ctx={A,C,game:()=>S.state.settings.game,render:()=>{document.querySelector('#content').innerHTML=scanView(ctx.game(),'Magic');ctx.afterRender?.();},toast:m=>window.errors.push(m),match:async(g,r)=>({cands:cards[g]&&r.name.includes(cards[g].name)?[{id:cards[g].id,name:cards[g].name,exact:true,sub:g==='ptcg'?'Fusion Strike #101/264':'MSC #806',card:cards[g]}]:[],tried:[r.name]}),priceOf:()=>null,setOf:(g,c)=>g==='mtg'?c.card.set:c.card.set.id,numberOf:(g,c)=>g==='mtg'?c.card.collector_number:c.card.set.number,addMany:async(g,items)=>{window.saved.push({g,items});},openSheet(){},details(){}};
registerScanner(ctx);document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(t)A[t.dataset.act]?.(t);});document.addEventListener('change',e=>C[e.target.dataset.change]?.(e.target));
window.makeCard=()=>{const c=document.createElement('canvas');c.width=480;c.height=672;const x=c.getContext('2d');x.fillStyle='#e2b848';x.fillRect(0,0,480,672);x.fillStyle='#222';x.font='bold 32px Arial';x.fillText('Vikavolt HP150',24,45);x.font='20px Arial';x.fillText('101/264',25,638);for(let y=85;y<550;y+=30){x.fillStyle=y%60?'#999':'#436';x.fillRect(20,y,440,20);}return c;};
window.enqueue=()=>ctx.enqueueCapture(window.makeCard());window.snapshot=()=>({rows:loadBatch(),busy:S.ui.scan.busy,buffered:S.ui.scan.buffered,globalGame:S.state.settings.game,confirm:S.ui.scan.confirm,saved:window.saved});window.resetBatch=()=>{saveBatch([]);S.ui.scan.confirm=null;ctx.render();};
navigator.mediaDevices.getUserMedia=async()=>{const c=document.createElement('canvas');c.width=640;c.height=900;const x=c.getContext('2d'),card=window.makeCard();const draw=()=>{x.fillStyle='#25252b';x.fillRect(0,0,640,900);if(!window.hideCard)x.drawImage(card,140,160,340,476);};draw();window.cameraTimer=setInterval(draw,33);window.cameraStream=c.captureStream(30);return window.cameraStream;};
window.ctx=ctx;window.store=S;ctx.render();window.fixtureReady=true;
</script>`;
const server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture);}
 const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();await mkdir(output,{recursive:true});
try{
 const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/fixture');await page.waitForFunction(()=>window.fixtureReady);
 await page.evaluate(()=>{window.ocr=['Vikavolt HP150','101/264','Vikavolt HP150','101/264','Lightning Bolt','U 0806\nMSC EN'];window.enqueue();window.enqueue();});
 const during=await page.evaluate(()=>window.snapshot());assert(during.busy);assert.equal(during.rows.length,2);assert.notEqual(during.rows[0].id,during.rows[1].id);assert.equal(during.buffered,1,'second capture is queued while first OCR is busy');assert.equal(await page.locator('.scan-confirm').count(),0,'capture does not open a blocking picker');
 await page.waitForFunction(()=>window.snapshot().rows.length===2&&!window.snapshot().busy&&window.snapshot().rows.every(x=>!['reading','captured'].includes(x.status)));
 const after=await page.evaluate(()=>window.snapshot());assert.equal(after.globalGame,'mtg');assert.equal(after.rows[0].game,'ptcg','wrong selected game recovered within capture');assert.equal(after.rows[0].status,'review');assert.equal(after.rows[0].finish,'');assert.equal(after.rows[1].status,'ready');assert.equal(after.saved.length,0);
 await page.getByRole('button',{name:'Save 1',exact:true}).click();assert.equal((await page.evaluate(()=>window.snapshot())).saved[0].g,'mtg');
 await page.getByRole('button',{name:'Review 1',exact:true}).click();await page.getByRole('region',{name:'Confirm scanned card'}).waitFor();assert(await page.getByRole('button',{name:'Add to collection',exact:true}).isDisabled());
 await page.getByRole('combobox',{name:'Scanned card finish'}).selectOption('reverse-holofoil');await page.getByRole('button',{name:'Add to collection',exact:true}).click();
 const saved=await page.evaluate(()=>window.snapshot());assert.equal(saved.rows.length,0);assert.equal(saved.saved[1].g,'ptcg');assert.equal(saved.saved[1].items[0].productId,99);assert.equal(saved.globalGame,'mtg');
 console.log('PASS: asynchronous capture buffer → per-card auto game → no modal → exact ready save → finish-only review → exact variant saved without switching collection.');
 // Start a real browser MediaStream with auto disabled; geometry stays internal.
 await page.getByRole('button',{name:'Start camera',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#scanVideo')?.videoWidth>0);await page.waitForFunction(()=>window.store.ui.scan.boundaryReady);
 assert.equal(await page.locator('#camGuide,.cam-guide, .cam-wrap polygon').count(),0,'camera feed has no visible outline or mask');
 await page.evaluate(()=>{window.ocrDelay=500;window.ocr=['Vikavolt HP150','101/264','Vikavolt HP150','101/264'];});
 await page.getByRole('button',{name:'Capture card now'}).click();await page.waitForFunction(()=>window.snapshot().busy);
 const time=await page.locator('#scanVideo').evaluate(v=>v.currentTime);await page.waitForTimeout(350);assert(await page.locator('#scanVideo').evaluate((v,t)=>!v.paused&&v.currentTime>t&&v.srcObject===window.cameraStream,time),'same live video advances while recognition runs');assert.equal(await page.locator('.scan-confirm').count(),0);
 await page.waitForFunction(()=>window.snapshot().rows.length===1&&!window.snapshot().busy);await page.evaluate(()=>window.store.ui.scan.auto=true);await page.waitForTimeout(800);assert.equal((await page.evaluate(()=>window.snapshot())).rows.length,1,'same held card not duplicated');
 await page.screenshot({path:resolve(output,'scanner-batch-phone.png'),fullPage:true});
 const title=await page.locator('.scan-toolbar h1').boundingBox(),top=await page.locator('.topbar').boundingBox(),tray=await page.locator('.scan-batch-tray').boundingBox(),nav=await page.locator('.bottom-nav').boundingBox();assert(title.y>=top.y+top.height-1,'scan heading below header');assert(tray.y+tray.height<=nav.y,'capture tray fits above bottom nav');
 await page.reload();await page.waitForFunction(()=>window.fixtureReady);assert.equal((await page.evaluate(()=>window.snapshot())).rows.length,1,'captured review survives reload');assert.equal(await page.locator('.scan-confirm').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: same live MediaStream during OCR, internal geometry without a visible outline, held-card duplicate guard, mobile layout and persisted review.');await context.close();
 for(const width of [320,360,390,430,700,768,1024,1440,2560]){const c=await browser.newContext({viewport:{width,height:900}}),p=await c.newPage();await p.goto(base+'/fixture');await p.waitForFunction(()=>window.fixtureReady);assert(await p.locator('body').evaluate(x=>x.scrollWidth<=innerWidth+1),`${width}px no horizontal overflow`);await p.evaluate(async()=>{const {captureEntry,saveBatch}=await import('/scan-batch.js');saveBatch([{...captureEntry('ptcg','',{}),status:'unresolved'}]);window.ctx.render();});const nextWidth=width<700?700:390;await p.setViewportSize({width:nextWidth,height:520});assert.equal((await p.evaluate(()=>window.snapshot())).rows.length,1,'fold/unfold or orientation resize preserves pending capture');assert(await p.locator('body').evaluate(x=>x.scrollWidth<=innerWidth+1),`${width}px to ${nextWidth}px resize has no overflow`);await c.close();}
 console.log('PASS: scanner layout has no horizontal overflow across 320–2560px; fold/unfold/orientation resize retains the pending tray.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
