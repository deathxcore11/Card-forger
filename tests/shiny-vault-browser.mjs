import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizePtcg} from '../ptcg.js';
import {resolveFinish} from '../finish-effects.js';
import {startServer,openSearchApp,inventorySnapshot,noOverflow} from './search-fixtures.mjs';

const raw=JSON.parse(fs.readFileSync('tests/fixtures/buzzwole-sma-SV68.json'));
const art=fs.readFileSync('tests/frame-art/sma-SV68.webp'),card=normalizePtcg(raw);
assert.deepEqual(card.variants.map(v=>v.key),['holofoil']);
assert.equal(resolveFinish('ptcg',card,{priceFinish:'holofoil'}).coverage,'full');
if(process.argv.includes('--validate-fixtures')){console.log('PASS: captured Buzzwole GX fixture corrects generated Normal and uses full-face foil.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted CI only');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
fs.mkdirSync('test-results',{recursive:true});
const report={status:'FAIL',candidateSha:process.env.GITHUB_SHA,artSource:raw.image+'/high.webp',artSha256:createHash('sha256').update(art).digest('hex'),cases:[],limits:'Hosted touch emulation, simulated foil. Not physical phone or physical foil proof.'};let app;
try{
 app=await openSearchApp(browser,server.base,{game:'ptcg',width:390,height:1000,evidenceLabel:'shiny-vault',prepareFixtures:f=>{f.cache.ptcg[raw.id]=card;},providerOverride:(url,req)=>{
  if(req.resourceType()==='image'&&url.href.startsWith(raw.image+'/'))return {body:art,contentType:'image/webp'};
  if(url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/cards')return [raw];
  if(url.hostname==='api.tcgdex.net'&&url.pathname==='/v2/en/cards/'+raw.id)return raw;
 }});
 const {page}=app;await page.emulateMedia({reducedMotion:'no-preference'});
 const q=page.locator('[data-input="tQ"]');await q.fill(raw.name);await q.press('Enter');
 await page.locator(`#content [data-act="tCard"][data-id="${raw.id}"]`).first().click();
 await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.previewBusy===false);
 const before=await inventorySnapshot(page);
 assert.deepEqual(await page.locator('#sheetBody [data-act="cardFinishPreview"]').evaluateAll(ns=>ns.map(n=>n.dataset.finish)),['holofoil']);
 await page.locator('#sheetBody [data-finish="holofoil"]').click();
 for(const width of [360,768,1440]){
  await page.setViewportSize({width,height:1000});
  const surface=page.locator('#sheetBody [data-finish-surface="detail"]');await surface.scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>{
   const s=document.querySelector('#sheetBody [data-finish-surface="detail"]'),o=s?.querySelector('.finish-overlay'),img=s?.querySelector('img');
   if(!img?.complete||!img.naturalWidth||!o)return false;
   const canvas=o.querySelector('canvas');return canvas?canvas.width>0:!!o.querySelector('.finish-layer');
  });
  const geometry=await surface.evaluate(s=>{const img=s.querySelector('img').getBoundingClientRect(),o=s.querySelector('.finish-overlay').getBoundingClientRect();return {model:JSON.parse(s.dataset.finishModel),offsets:[img.left-o.left,img.top-o.top,img.width-o.width,img.height-o.height]};});
  assert.equal(geometry.model.treatment,'ptcg-shiny');assert(geometry.model.layers.every(l=>l.mask==='card'));
  assert(Math.max(...geometry.offsets.map(Math.abs))<2,'Overlay follows the displayed card after resize');
  await noOverflow(page,'#sheetBody','Shiny Vault '+width);
  await page.screenshot({path:`test-results/shiny-vault-${width}.png`,animations:'disabled'});
  report.cases.push({width,...geometry});
 }
 assert.equal(await inventorySnapshot(page),before,'Preview does not rewrite owned finishes');
 assert.deepEqual(app.diagnostics().errors,[]);report.status='PASS';
 console.log('PASS: Buzzwole GX offers Holofoil only, draws full-face foil at phone/tablet/desktop widths and preserves inventory.');
}finally{
 fs.writeFileSync('test-results/shiny-vault-report.json',JSON.stringify(report,null,2));
 await app?.context.close();await browser.close();await server.close();
}
