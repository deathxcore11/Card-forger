// Production pricing renderer/actions with deterministic outage/retry provider fixtures.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=process.cwd();
const fixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body data-game="mtg"><dialog id="sheet" open><div id="sheetBody"></div></dialog><script type="module">
import {S,blank} from '/store.js';import {registerTcg,proven,provenSheetHtml} from '/tcg.js';
S.state=blank();S.state.settings.game='mtg';let attempt=0;const A={},C={},I={};let rows=[{key:'known',name:'Known-price card',qty:2,price:5,owned:0,kind:'creature'},{key:'missing',name:'Unavailable-price card',qty:3,price:null,owned:0,kind:'creature'}],side=[{key:'side',name:'Sideboard price pending',qty:1,price:null,owned:0,kind:'spell'}];
const ctx={A,C,I,commit:async f=>f(S.state),render(){},openSheet:(html,context)=>{document.querySelector('#sheetBody').innerHTML=html;S.ui.sheetCtx=context;},closeSheet(){},toast(){},go(){},copyText(){},download(){},busy:()=>()=>{}};registerTcg(ctx);
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(t)A[t.dataset.act]?.(t);});
await ctx.openProven({g:'mtg',key:'browser-price',title:'Tournament list · price check',sub:'Regression fixture',evidence:'Known quotes and unavailable quotes stay separate.',rowsFn:()=>rows,sideRowsFn:()=>side,lists:[],load:async()=>{if(++attempt===1)return {failed:['Unavailable-price card','Sideboard price pending']};rows=rows.map(r=>({...r,price:r.price??2}));side=side.map(r=>({...r,price:4}));return {failed:[]};}});window.ready=true;
</script>`;
const energyFixture=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body data-game="ptcg"><dialog id="sheet" open><div id="sheetBody"></div></dialog><script type="module">
import {S,blank} from '/store.js';import {registerTcg,proven} from '/tcg.js';import {metaState} from '/meta.js';import {writeRecord,readRecord} from '/storage.js';
S.state=blank();S.state.settings.game='ptcg';const A={},C={},I={};let saved=0;
const ctx={A,C,I,commit:async f=>{saved++;await new Promise(r=>setTimeout(r,80));f(S.state);await writeRecord('cardforge-v2',S.state);},render(){},openSheet:(html,context)=>{document.querySelector('#sheetBody').innerHTML=html;S.ui.sheetCtx=context;},closeSheet(){S.ui.sheetCtx=null;document.querySelector('#sheet').close();},toast(){},go(){},writeRecord:async()=>{},busy:()=>()=>{}};registerTcg(ctx);
document.addEventListener('click',e=>{const t=e.target.closest('[data-act]');if(t)A[t.dataset.act]?.(t);});
const deck={key:'dhelmise-regression',name:'Dhelmise · Energy regression',place:1,event:'Synthetic test',list:[{name:'Psychic Energy',set:'MEE',number:'13',qty:2,kind:'Energy'}]};metaState('ptcg').data={decks:[deck],top:[]};
A.tMetaDeck({dataset:{key:deck.key}});window.energyState=()=>({busy:proven.busy,saved,decks:S.state.tcg?.ptcg?.decks||[],collection:S.state.tcg?.ptcg?.collection||[]});window.energyStoredState=()=>readRecord('cardforge-v2');
</script>`;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/fixture'||path==='/energy'){res.setHeader('Content-Type','text/html');return res.end(path==='/energy'?energyFixture:fixture);}const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();await mkdir('test-results',{recursive:true});
try{const context=await browser.newContext({...devices['Pixel 7']}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/fixture`);await page.waitForFunction(()=>window.ready);
assert.match(await page.locator('.ds-cost').innerText(),/\$10\+\s+to finish · 3 cards without a price/);assert.match(await page.locator('.side-group summary').innerText(),/\+ to finish · 1 card without a price/i);assert.equal(await page.getByRole('button',{name:'Retry prices',exact:true}).count(),1);
await page.screenshot({path:'test-results/pricing-unavailable-phone.png',fullPage:true});await page.locator('[data-act="provenMode"][data-id="budget"]').last().click();assert(await page.getByRole('button',{name:'Save adaptation',exact:true}).isDisabled());assert.equal(await page.getByText('Price check incomplete',{exact:true}).count(),1);
await page.getByRole('button',{name:'Retry prices',exact:true}).click();await page.waitForFunction(()=>!/incomplete total/i.test(document.body.innerText));assert.equal(await page.getByRole('button',{name:'Save adaptation',exact:true}).isDisabled(),false);assert.match(await page.locator('.ds-cost').innerText(),/\$16 to finish/);assert.match(await page.locator('.side-group summary').innerText(),/\$4 to finish/i);assert.equal(await page.getByRole('button',{name:'Retry prices',exact:true}).count(),0);
await page.screenshot({path:'test-results/pricing-retried-phone.png',fullPage:true});assert.deepEqual(errors,[]);console.log('PASS: actual mobile pricing UI shows honest partial totals, blocks unpriced budget saves, then retries main and side prices without losing selected mode.');await context.close();
const energyContext=await browser.newContext({...devices['Pixel 7']}),energyPage=await energyContext.newPage();
await energyPage.route('https://api.tcgdex.net/**',route=>{const u=new URL(route.request().url());return route.fulfill(u.pathname.endsWith('/cards')?{contentType:'application/json',body:'[]'}:{status:404,body:''});});
await energyPage.goto(`http://127.0.0.1:${server.address().port}/energy`);await energyPage.waitForFunction(()=>window.energyState&&!window.energyState().busy);
const energyText=await energyPage.locator('#sheetBody').innerText();assert.match(energyText,/You own 0 of 2/);assert.match(energyText,/2 unpriced · Incomplete total/);assert.match(energyText,/Price unavailable/);assert.doesNotMatch(energyText,/Basic Energy · assumed|Printing not matched|✓ owned/);
await energyPage.screenshot({path:'test-results/synthetic-dhelmise-energy-phone.png',fullPage:true});await energyPage.getByRole('button',{name:'Save deck',exact:true}).click();await energyPage.waitForFunction(()=>window.energyState().decks.length===1);
const energySaved=await energyPage.evaluate(()=>window.energyState());assert.equal(energySaved.saved,1);assert.deepEqual(energySaved.decks[0].zones.main.map(r=>[r.cardId,r.qty]),[['mee-013',2]]);assert.deepEqual(energySaved.collection,[]);
assert.equal(energySaved.decks[0].buildDiagnostics.ownedCopies,0);assert.equal(energySaved.decks[0].buildDiagnostics.unpricedPurchaseCopies,2);assert.equal(energySaved.decks[0].buildDiagnostics.purchaseEstimate,null);
await energyPage.waitForFunction(async()=>{const state=await window.energyStoredState();return state?.tcg?.ptcg?.decks?.length===1;});
const storedEnergy=await energyPage.evaluate(()=>window.energyStoredState());assert.deepEqual(storedEnergy.tcg.ptcg.decks,energySaved.decks);assert.deepEqual(storedEnergy.tcg.ptcg.collection,[],'Saving exact Energy identity never creates owned copies in durable storage');
console.log('PASS: production tournament matcher saves exact mee-013, retains unknown purchase cost and zero owned copies through synthetic durable storage, and leaves collection untouched.');await energyContext.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
