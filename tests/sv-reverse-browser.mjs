// Hosted application regression for the two cards reported by the user.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePtcg} from '../ptcg.js';
import {finishChoices,resolveFinish} from '../finish-effects.js';
import {startServer,openSearchApp,inventorySnapshot} from './search-fixtures.mjs';
const sources=['sv03-001','sv09-003'].map(id=>JSON.parse(fs.readFileSync(`tests/fixtures/${id}-finish.json`)));
for(const source of sources){const c=normalizePtcg(source);assert.equal(finishChoices('ptcg',c).filter(p=>p.label==='Reverse Holo').length,1);assert.equal(resolveFinish('ptcg',c,{priceFinish:'reverse-holofoil'}).effect,'ptcg-reverse');}
if(process.argv.includes('--validate-fixtures')){console.log('PASS: retained Oddish/Butterfree source choices and exact reverse models; no browser started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser execution is hosted-only.');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
const report={candidateSha:process.env.GITHUB_SHA,status:'FAIL',cases:[],limits:'Hosted Chromium touch emulation, retained artwork; approximate simulation, not physical foil or phone-hardware proof.'};let app;
try{
 app=await openSearchApp(browser,server.base,{game:'ptcg',width:390,height:1000,evidenceLabel:'sv-reverse',prepareFixtures:f=>{for(const s of sources)f.cache.ptcg[s.id]=normalizePtcg(s);},providerOverride:(u,r)=>{
  if(r.resourceType()==='image')for(const s of sources)if(u.href.startsWith(s.image)||u.pathname.includes('/'+s.id+'.'))return {body:fs.readFileSync(`tests/frame-art/${s.id}.webp`),contentType:'image/webp'};
  if(u.hostname==='api.tcgdex.net'&&u.pathname==='/v2/en/cards')return sources.filter(s=>u.searchParams.get('name')?.includes(s.name));
  if(u.hostname==='api.tcgdex.net'&&u.pathname.startsWith('/v2/en/cards/'))return sources.find(s=>u.pathname.endsWith('/'+s.id));
 }});const {page}=app;await page.emulateMedia({reducedMotion:'no-preference'});const before=await inventorySnapshot(page);
 fs.mkdirSync('test-results',{recursive:true});
 for(const source of sources){
  await page.goto(server.base+'/#search');await page.locator('[data-act="menu"]').tap();await page.locator('#settingsTab-app').tap();await page.locator('[data-change="setGlass"]').check();await page.locator('[data-act="closeSettings"]').click();const q=page.locator('[data-input="tQ"]');await q.fill(source.name);await q.press('Enter');await page.locator(`#content [data-act="tCard"][data-id="${source.id}"]`).click();
  await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.previewBusy===false);assert(await page.evaluate(()=>document.body.classList.contains('glass')),'Real persisted glass mode is active');const reverse=page.locator('#sheetBody [data-act="cardFinishPreview"][data-finish="reverse-holofoil"]');await reverse.click();
  await page.waitForFunction(()=>document.querySelector('#sheetBody [data-finish="reverse-holofoil"]')?.getAttribute('aria-pressed')==='true');
  const selected=page.locator('#sheetBody [data-finish="reverse-holofoil"]');assert(await selected.evaluate(n=>n.classList.contains('on')),'Selected finish survives glass styling');
  const colors=await page.locator('#sheetBody .finish-choice-rail button').evaluateAll(ns=>ns.map(n=>({selected:n.getAttribute('aria-pressed')==='true',border:getComputedStyle(n).borderTopColor})));assert.notEqual(colors.find(c=>c.selected).border,colors.find(c=>!c.selected).border,'Selected finish visibly distinguished in glass mode');const oldGlass=await selected.evaluate(n=>{n.classList.remove('on');const s=getComputedStyle(n),result={connected:n.isConnected,top:s.borderTopColor,right:s.borderRightColor,bottom:s.borderBottomColor,left:s.borderLeftColor};n.classList.add('on');return result;});assert(oldGlass.connected,'Negative control samples a mounted button');console.log(source.id,'Glass negative control',JSON.stringify({selected:colors.find(c=>c.selected),unselected:colors.find(c=>!c.selected),withoutFix:oldGlass}));assert.equal(oldGlass.top,colors.find(c=>!c.selected).border,'Negative control reproduces the old glass override');
  assert.match(await page.locator('#sheetBody .finish-preview [role="status"]').innerText(),/^Reverse Holo ·/);
  const surface=page.locator('#sheetBody [data-finish-surface="detail"]');await surface.scrollIntoViewIfNeeded();await surface.locator('.finish-layer').waitFor();const layer=surface.locator('.finish-layer');
  assert.equal(await surface.getAttribute('data-finish-effect'),'ptcg-reverse');assert.equal(await layer.evaluate(n=>CSS.supports('clip-path',n.style.clipPath)),true);
  const image=surface.locator('img').first();await page.mouse.move(0,0);await layer.evaluate(n=>n.style.visibility='hidden');const plain=await image.screenshot({animations:'disabled'});await layer.evaluate(n=>n.style.visibility='');const foil=await image.screenshot({path:`test-results/${source.id}-reverse-card.png`,animations:'disabled'});
  const pixels=await page.evaluate(async({a,b})=>{
   async function read(s){const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return {w:c.width,h:c.height,data:x.getImageData(0,0,c.width,c.height).data};}
   const x=await read(a),y=await read(b);function region(r){let sum=0,count=0,changed=0;for(let j=Math.floor(x.h*r[1]);j<x.h*r[3];j++)for(let i=Math.floor(x.w*r[0]);i<x.w*r[2];i++){const k=(j*x.w+i)*4,d=Math.abs(x.data[k]-y.data[k])+Math.abs(x.data[k+1]-y.data[k+1])+Math.abs(x.data[k+2]-y.data[k+2]);sum+=d;count++;if(d>3)changed++;}return {mean:sum/(count*3),changedFraction:changed/count};}return {body:region([.2,.6,.8,.82]),art:region([.22,.18,.78,.44])};
  },{a:plain.toString('base64'),b:foil.toString('base64')});assert(pixels.body.mean>1&&pixels.body.changedFraction>.1,'Reverse material visibly changes the rules field');assert.equal(pixels.art.mean,0,'Reverse material excludes the illustration');
  await page.screenshot({path:`test-results/${source.id}-reverse-selected.png`});
  const oldPosition=await layer.evaluate(n=>getComputedStyle(n).backgroundPosition);await surface.evaluate(n=>{n.style.setProperty('--mx','85%');n.style.setProperty('--my','70%');});assert.notEqual(await layer.evaluate(n=>getComputedStyle(n).backgroundPosition),oldPosition,'Foil responds to the shared tilt light coordinates');
  const other=page.locator('#sheetBody .finish-choice-rail button[aria-pressed="false"]').first();await other.click();assert.equal(await selected.getAttribute('aria-pressed'),'false','Switching away clears reverse selection');
  await selected.click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('#sheetBody .finish-overlay'));await page.emulateMedia({reducedMotion:'no-preference'});await surface.locator('.finish-layer').waitFor();
  report.cases.push({id:source.id,pixels,glassSelection:true,lightResponse:true,reducedMotion:true});await page.locator('#sheetBody [data-act="closeSheet"]').first().click();
 }
 assert.equal(await inventorySnapshot(page),before);app.health();report.status='PASS';
}catch(e){report.error=e.stack;if(app)await app.page.screenshot({path:'test-results/sv-reverse-failure.png'}).catch(()=>{});throw e;}
finally{fs.writeFileSync('test-results/sv-reverse-browser.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
