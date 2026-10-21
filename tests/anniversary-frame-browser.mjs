// Hosted pixel regression for measured Pokémon frame windows on retained public art.
// Reverse availability is the retained source record; holo is an explicitly
// synthetic selection (none of these printings has a holo) used only to paint
// the illustration window, as the Sewaddle witness does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePtcg} from '../ptcg.js';
import {resolveFinish} from '../finish-effects.js';
import {startServer,openSearchApp,inventorySnapshot} from './search-fixtures.mjs';
// The finish as drawn: the WebGL foil canvas when it mounted (its CSS layers are then hidden), else the CSS layers.
const drawn=(page,root)=>page.waitForFunction(root=>{const o=document.querySelector(root+' .finish-overlay');if(!o)return false;if(o.classList.contains('rarity-gl')){const c=o.querySelector('.finish-rarity-gl');return !!c&&!c.hidden&&c.width>0;}const l=o.querySelector('.finish-layer');return !!l&&l.getBoundingClientRect().width>0;},root);
// Regions as [x0,y0,x1,y1] fractions of the image, kept ≥0.5% inside measured edges (anti-aliasing).
const CASES={
 'cel25-23':{foil:{art:[.3,.2,.7,.4],sleeve:[.34,.57,.40,.60]},plain:{title:[.2,.075,.7,.09],paper:[.4,.7,.7,.8]}},
 'cel25-7':{foil:{art:[.3,.3,.7,.5]},plain:{}},
 'base1-10':{foil:{topLeft:[.13,.13,.22,.17],art:[.3,.22,.7,.42]},plain:{rules:[.2,.6,.8,.8],frame:[.092,.2,.099,.4]}},
 'base1-2':{foil:{art:[.3,.22,.7,.42]},plain:{badge:[.12,.12,.17,.15],rules:[.2,.6,.8,.8]}},
 'cel25cc-CC003':{foil:{lowerArt:[.3,.49,.6,.505],art:[.3,.22,.6,.4]},plain:{badge:[.12,.12,.17,.15],stamp:[.81,.475,.9,.51],rules:[.2,.6,.8,.8]}},
 'cel25cc-CC012':{foil:{art:[.2,.23,.6,.43]},plain:{stamp:[.81,.49,.9,.52],rules:[.2,.6,.8,.8]}},
 '30th-c-001':{foil:{art:[.3,.22,.6,.4]},plain:{badge:[.12,.12,.17,.15],rules:[.2,.6,.8,.8]}},
 '30th-002':{foil:{art:[.3,.22,.6,.4]},plain:{badge:[.05,.09,.13,.15],stamp:[.82,.43,.9,.47],rules:[.2,.6,.8,.8]}},
 '30th-023':{foil:{art:[.2,.2,.7,.4]},plain:{stamp:[.35,.65,.6,.7],rules:[.2,.82,.7,.88]}},
};
const read=id=>JSON.parse(fs.readFileSync(`tests/fixtures/${id.startsWith('base1')?'base-set':'anniversary'}-frames/${id}.json`));
const retained=Object.keys(CASES).map(read),sources=retained.map(s=>({...s,variants:{holo:true},variants_detailed:[{type:'holo',size:'standard',variantId:'coverage-witness'}],pricing:undefined}));
const measurements=JSON.parse(fs.readFileSync('tests/fixtures/anniversary-frames/geometry.json')).cards;
const stampMeasurements=JSON.parse(fs.readFileSync('tests/fixtures/anniversary-frames/stamp-geometry.json')).profiles;
const sourceImages=new Map(sources.map(s=>{const m=measurements.find(e=>e.id===s.id)||stampMeasurements.find(e=>e.id===s.id),file=m?`tests/fixtures/anniversary-frames/${m.file}`:`tests/fixtures/base-set-frames/${s.id}-high.webp`;return [s.id,{file,source:m?.source||s.image+'/high.webp'}];}));
for(const source of sources){const c=normalizePtcg(source);CASES[source.id].mask=resolveFinish('ptcg',c,{priceFinish:c.variants[0].key}).layers[0].mask;}
if(process.argv.includes('--validate-fixtures')){console.log('PASS: Base Set and anniversary coverage witnesses use retained source art and explicitly synthetic finish selections.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser execution is hosted-only.');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
const report={candidateSha:process.env.GITHUB_SHA,status:'FAIL',cases:[],limits:'Hosted Chromium, retained source art. Every holo choice here is synthetic for coverage testing, especially the incomplete 30th catalogue. Not proof of finish availability, physical foil or phone hardware.'};let app;
try{
 app=await openSearchApp(browser,server.base,{game:'ptcg',width:768,height:1100,evidenceLabel:'anniversary-frame',prepareFixtures:f=>{for(const s of sources)f.cache.ptcg[s.id]=normalizePtcg(s);},providerOverride:(u,r)=>{
  if(r.resourceType()==='image')for(const s of sources){const c=normalizePtcg(s),art=sourceImages.get(s.id);if(s.id.startsWith('30th-c-')&&u.hostname==='images.pokemontcg.io')return {body:'Missing reference',status:404,contentType:'text/plain'};if([c.image,c.imageLarge,art.source].includes(u.href)||u.pathname.includes('/'+s.id+'.'))return {body:fs.readFileSync(art.file),contentType:art.file.endsWith('.png')?'image/png':art.file.endsWith('.jpg')?'image/jpeg':'image/webp'};};
  if(u.hostname==='api.tcgdex.net'&&u.pathname==='/v2/en/cards')return sources.filter(s=>u.searchParams.get('name')?.includes(s.name));
  if(u.hostname==='api.tcgdex.net'&&u.pathname.startsWith('/v2/en/cards/'))return sources.find(s=>u.pathname.endsWith('/'+s.id));
 }});const {page}=app;await page.emulateMedia({reducedMotion:'no-preference'});const before=await inventorySnapshot(page);
 fs.mkdirSync('test-results',{recursive:true});
 const settle=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const root=document.querySelector('#sheetBody');let quiet;const timeout=setTimeout(()=>{observer.disconnect();reject(Error('Detail did not settle'));},3000);const ready=()=>{clearTimeout(quiet);quiet=setTimeout(()=>{observer.disconnect();clearTimeout(timeout);resolve();},200);};const observer=new MutationObserver(ready);observer.observe(root,{childList:true,subtree:true});ready();}));
 const photo=hidden=>page.evaluate(hidden=>{const surface=document.querySelector('#sheetBody [data-finish-surface="detail"]'),layers=[...surface.querySelectorAll('.finish-layer')],img=surface.querySelector('img');if(!layers.length||!img.complete||!img.naturalWidth)throw Error('Finish surface not ready');for(const l of [...layers,...surface.querySelectorAll('.finish-rarity-gl')])l.style.visibility=hidden?'hidden':'';const r=img.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},hidden);
 const compare=(a,b,regions)=>page.evaluate(async({a,b,regions})=>{
  async function read(s){const i=new Image();i.src='data:image/png;base64,'+s;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return {w:c.width,h:c.height,data:x.getImageData(0,0,c.width,c.height).data};}
  const x=await read(a),y=await read(b),out={};
  for(const [name,r] of Object.entries(regions)){let sum=0,count=0,changed=0;for(let j=Math.ceil(x.h*r[1]);j<Math.floor(x.h*r[3]);j++)for(let i=Math.ceil(x.w*r[0]);i<Math.floor(x.w*r[2]);i++){const k=(j*x.w+i)*4,d=Math.abs(x.data[k]-y.data[k])+Math.abs(x.data[k+1]-y.data[k+1])+Math.abs(x.data[k+2]-y.data[k+2]);sum+=d;count++;if(d>3)changed++;}out[name]={mean:sum/(count*3),changedFraction:changed/count,count};}
  return out;
 },{a:a.toString('base64'),b:b.toString('base64'),regions});
 for(const source of sources){
  const spec=CASES[source.id];
  await page.goto(server.base+'/#search');const q=page.locator('[data-input="tQ"]');await q.fill(source.name);await q.press('Enter');
  await page.locator(`#content [data-act="tCard"][data-id="${source.id}"]`).first().click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx?.previewBusy===false);
  for(const finish of [normalizePtcg(source).variants[0].key]){
   await page.locator(`#sheetBody [data-act="cardFinishPreview"][data-finish="${finish}"]`).click();
   await page.waitForFunction(f=>document.querySelector(`#sheetBody [data-finish="${f}"]`)?.getAttribute('aria-pressed')==='true',finish);
   await page.evaluate(()=>document.querySelector('#sheetBody [data-finish-surface="detail"]').scrollIntoView({block:'center',behavior:'instant'}));
   const surface=page.locator('#sheetBody [data-finish-surface="detail"]');await drawn(page,'#sheetBody');
   assert.equal(JSON.parse(await surface.getAttribute('data-finish-model')).layers[0].mask,spec.mask);
   await page.mouse.move(0,0);await settle();
   const box=await photo(true),plain=await page.screenshot({clip:box,animations:'disabled'}),foilBox=await photo(false);assert.deepEqual(foilBox,box,'Material toggling cannot move the card');
   const foil=await page.screenshot({clip:foilBox,animations:'disabled',path:`test-results/anniversary-frame-${source.id}-${finish}.png`});
   // Holo paints the window and nothing printed around it; reverse is the exact complement.
   const painted=spec.foil,clear=spec.plain;
   const pixels=await compare(plain,foil,{...painted,...clear});
   for(const name of Object.keys(painted))assert(pixels[name].mean>1&&pixels[name].changedFraction>.1,`${source.id} ${finish}: ${name} visibly foiled ${JSON.stringify(pixels[name])}`);
   // Painted foil measures mean 20-30 with every pixel changed; hosted compositing noise has been
   // a few pixels per thin region (e.g. 4/380, mean .055). Bound clear regions far below paint.
   for(const name of Object.keys(clear))assert(pixels[name].mean<.5&&pixels[name].changedFraction<.05,`${source.id} ${finish}: ${name} stays unfoiled ${JSON.stringify(pixels[name])}`);
   // Compare the entire overlay, including its spotlight and texture children.
   // Hiding only material layers can falsely pass while the lamp still covers the mark.
   const stamp=stampMeasurements.find(e=>e.id===source.id&&e.source===sourceImages.get(source.id).source);
   let stampPixels;
   if(stamp){
    const overlay=surface.locator('.finish-overlay');
    await overlay.evaluate(el=>el.style.visibility='hidden');
    const clean=await page.screenshot({clip:box,animations:'disabled'});
    await overlay.evaluate(el=>el.style.visibility='');
    const painted=await page.screenshot({clip:box,animations:'disabled'});
    stampPixels=await compare(clean,painted,{printedMark:stamp.witness});
    assert(stampPixels.printedMark.count>0);
    assert(stampPixels.printedMark.mean<.5&&stampPixels.printedMark.changedFraction<.05,source.id+' entire overlay excludes printed mark '+JSON.stringify(stampPixels));
    assert(await overlay.evaluate(el=>getComputedStyle(el).clipPath!=='none'),'All effects share the root stamp exclusion');
   }
   report.cases.push({id:source.id,finish,pixels,stampPixels});
  }
  await page.locator('#sheetBody [data-act="closeSheet"]').first().click();
 }
 assert.equal(await inventorySnapshot(page),before);app.health();report.status='PASS';
 console.log('PASS: measured Pokémon frame windows paint the illustration beside the stage banner and spare the banner, badge and Pokédex strip; reverse is the exact complement.');
}catch(e){report.error=e.stack;if(app)await app.page.screenshot({path:'test-results/anniversary-frame-failure.png'}).catch(()=>{});throw e;}
finally{fs.writeFileSync('test-results/anniversary-frame-browser.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
