// Hosted CI only. Retained public provider data; synthetic art, no live services.
import assert from 'node:assert/strict';
import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {normalizePtcg} from '../ptcg.js';
import {startServer,openSearchApp,capture,inventorySnapshot,RESULTS} from './search-fixtures.mjs';
const cards=JSON.parse(gunzipSync(fs.readFileSync('tests/fixtures/aquapolis-pilot-v1.json.gz'))).cards;
const rabsca=JSON.parse(fs.readFileSync('tests/fixtures/rabsca-sv08-014.json'));
assert.equal(cards.length,186);assert.equal(new Set(cards.map(c=>c.id)).size,186);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: 186 unique retained Aquapolis API records plus Rabsca, no browser started.');process.exit(0);}
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution restricted to hosted CI; use --validate-fixtures locally.');
const {chromium}=await import('playwright');const browser=await chromium.launch(),server=await startServer();
const all=[...cards,rabsca],byId=new Map(all.map(c=>[c.id,c])),set={...cards[0].set,cardCount:{official:147,total:186}};
const SVG='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#315326"/><text x="20" y="420" fill="white" font-size="30">SYNTHETIC ART — UI TEST ONLY</text></svg>';
const report={candidateSha:process.env.GITHUB_SHA||'unknown',environment:'hosted Chromium; retained public provider data; synthetic art; no live provider or phone evidence',cards:[],screenshots:[],status:'FAIL'};
let app;
try{
 app=await openSearchApp(browser,server.base,{game:'ptcg',width:390,height:1000,evidenceLabel:'foundation',prepareFixtures:f=>{
  for(const source of all){const c={...normalizePtcg(source),fetchedAt:'2026-10-17T12:00:00.000Z'};f.cache.ptcg[c.id]=c;}
 },providerOverride:(u,r)=>{
  if(r.resourceType()==='image'&&(u.hostname==='assets.tcgdex.net'||/^\/img\/ptcg\/[sl]\//.test(u.pathname)&&byId.has(u.pathname.split('/').at(-1).replace(/\.jpg$/,''))))return {body:SVG,contentType:'image/svg+xml'};
  if(u.hostname!=='api.tcgdex.net')return;
  if(u.pathname==='/v2/en/sets')return [set];
  if(u.pathname==='/v2/en/sets/ecard2')return {...set,cards};
  if(u.pathname==='/v2/en/cards')return u.searchParams.get('name')?.includes('Rabsca')?[rabsca]:cards;
  if(u.pathname.startsWith('/v2/en/cards/'))return byId.get(decodeURIComponent(u.pathname.split('/').at(-1)));
 }});
 const {page}=app,before=await inventorySnapshot(page);await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto(server.base+'/#sets');await page.locator('[data-act="tSet"][data-id="ecard2"]').click();
 await page.waitForFunction(()=>window.__uiTestTcg.ui('ptcg').set.loaded&&!window.__uiTestTcg.ui('ptcg').set.busy);
 assert.equal(await page.locator('#content .set-grid > .grid-card').count(),120);
 const marker=page.locator('[data-auto-browse="tSetMore"]');await marker.waitFor();const markerBox=await marker.boundingBox();assert(markerBox);await page.mouse.move(2,300);await page.mouse.wheel(0,markerBox.y-500);await page.waitForFunction(()=>document.querySelectorAll('#content .set-grid > .grid-card').length===186);
 assert.deepEqual(new Set(await page.locator('#content .set-grid > .grid-card').evaluateAll(ns=>ns.map(n=>n.dataset.id))),new Set(cards.map(c=>c.id)));
 await capture(page,'synthetic-search-foundation-aquapolis-186');
 for(const source of cards){
  await page.locator(`#content .set-grid [data-act="tCard"][data-id="${source.id}"]`).click();
  await page.locator('#sheetBody .finish-choice-rail').waitFor();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.previewBusy===false);
  const keys=await page.locator('#sheetBody [data-act="cardFinishPreview"]').evaluateAll(ns=>ns.map(n=>n.dataset.finish));assert.equal(keys.length,new Set(keys).size,source.id+' distinct choice keys');
  for(const key of keys){await page.locator('#sheetBody [data-act="cardFinishPreview"][data-finish='+JSON.stringify(key)+']').click();await page.waitForFunction(k=>document.querySelector(`#sheetBody [data-act="cardFinishPreview"][aria-pressed="true"]`)?.dataset.finish===k,key);}
  report.cards.push({id:source.id,choices:keys,detail:true,selection:true,art:'synthetic; reference pixels not checked'});
  if(['ecard2-H01','ecard2-109','ecard2-134'].includes(source.id))await capture(page,'synthetic-search-foundation-'+source.id.toLowerCase());
  await page.locator('#sheetBody [data-act="closeSheet"]').first().click();
 }
 assert.equal(report.cards.length,186);assert.equal(report.cards.reduce((n,c)=>n+c.choices.length,0),348);
 await page.goto(server.base+'/#search');const query=page.locator('[data-input="tQ"]');await query.fill('Rabsca');await query.press('Enter');await page.locator('#content [data-act="tCard"][data-id="sv08-014"]').click();
 const reverse=page.locator('#sheetBody [data-act="cardFinishPreview"]').filter({hasText:/^Reverse Holo$/i});assert.equal(await reverse.count(),1);await reverse.click();
 const surface=page.locator('#sheetBody [data-finish-surface="detail"]');await surface.scrollIntoViewIfNeeded();assert.equal(await surface.getAttribute('data-finish-effect'),'ptcg-reverse');
 await page.waitForFunction(()=>document.querySelector('#sheetBody .finish-overlay .finish-layer')?.getBoundingClientRect().width>0);
 assert.notEqual(await page.locator('#sheetBody .finish-layer').first().evaluate(n=>getComputedStyle(n).backgroundImage),'none');
 await capture(page,'synthetic-search-foundation-rabsca-reverse');
 await page.locator('#sheetBody [data-act="cardFinishPreview"]').filter({hasText:'Holofoil · Cosmos'}).click();assert.equal(await surface.getAttribute('data-finish-effect'),'ptcg-holo');await capture(page,'synthetic-search-foundation-rabsca-cosmos');
 assert.equal(await inventorySnapshot(page),before,'Read-only pilot must not alter collections or private prices');app.health();report.status='PASS';
}catch(error){report.error=error.stack;report.diagnostics=app?.diagnostics();if(app)try{await capture(app.page,'synthetic-search-foundation-failure',{settle:false});}catch(captureError){report.captureError=captureError.message;}throw error;}
finally{fs.mkdirSync(RESULTS,{recursive:true});fs.writeFileSync(RESULTS+'/foundation-pilot-browser.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
