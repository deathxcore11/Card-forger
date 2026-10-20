// Hosted pixel regression for measured Pokémon frame windows on retained public art.
// Reverse availability is the retained source record; holo is an explicitly
// synthetic selection (none of these printings has a holo) used only to paint
// the illustration window, as the Sewaddle witness does.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizePtcg} from '../ptcg.js';
import {resolveFinish} from '../finish-effects.js';
import {startServer,openSearchApp,inventorySnapshot} from './search-fixtures.mjs';
// Regions as [x0,y0,x1,y1] fractions of the image, kept ≥0.5% inside measured edges (anti-aliasing).
const CASES={
 'dp5-33':{frame:'pk-dppt',foil:{artBody:[.3,.2,.7,.45],besideBanner:[.3,.099,.9,.113]},plain:{banner:[.09,.098,.2,.113],dexStrip:[.3,.503,.7,.52]}},
 'dp1-31':{frame:'pk-dppt-evolved',foil:{artBody:[.3,.2,.7,.45],besideBanner:[.66,.099,.9,.113]},plain:{banner:[.25,.099,.5,.114],badge:[.08,.09,.15,.14],dexStrip:[.3,.503,.7,.52]}},
 'hgss3-15':{frame:'pk-hgss-evolved',foil:{artBody:[.3,.2,.7,.45],besideBanner:[.68,.094,.92,.104]},plain:{banner:[.35,.094,.55,.1015],dexStrip:[.3,.525,.7,.54]}},
 'me01-016':{frame:'pk-sv',foil:{artBody:[.3,.2,.7,.42]},plain:{nameBar:[.3,.05,.6,.09],dexStrip:[.3,.475,.7,.49]}},
};
const retained=Object.keys(CASES).map(id=>JSON.parse(fs.readFileSync(`tests/fixtures/${id}-finish.json`)));
const sources=retained.map(s=>({...s,variants:{normal:true,holo:true,reverse:true},variants_detailed:[{type:'normal',size:'standard',variantId:'fixture-normal'},{type:'holo',size:'standard',variantId:'fixture-holo'},{type:'reverse',size:'standard',variantId:'fixture-reverse'}],pricing:undefined}));
for(const s of retained)assert.equal(normalizePtcg(s).variants.some(v=>v.finish==='holofoil'),false,'Retained source has no holo; the holo selection below is synthetic');
for(const s of sources){const c=normalizePtcg(s),{frame}=CASES[s.id];assert.deepEqual(resolveFinish('ptcg',c,{priceFinish:'holofoil'}).layers.map(l=>l.mask),[frame+'-art']);assert.deepEqual(resolveFinish('ptcg',c,{priceFinish:'reverse-holofoil'}).layers.map(l=>l.mask),[frame+'-surround']);}
if(process.argv.includes('--validate-fixtures')){console.log('PASS: Pokémon frame witnesses select their measured Basic/evolved windows; retained availability kept separate from the synthetic holo.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser execution is hosted-only.');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();
const report={candidateSha:process.env.GITHUB_SHA,status:'FAIL',cases:[],limits:'Hosted Chromium, retained TCGdex art; approximate simulation, not physical foil or phone-hardware proof. Holo selections are synthetic.'};let app;
try{
 app=await openSearchApp(browser,server.base,{game:'ptcg',width:768,height:1100,evidenceLabel:'pokemon-frame',prepareFixtures:f=>{for(const s of sources)f.cache.ptcg[s.id]=normalizePtcg(s);},providerOverride:(u,r)=>{
  if(r.resourceType()==='image')for(const s of sources)if(u.href.startsWith(s.image)||u.pathname.includes('/'+s.id+'.'))return {body:fs.readFileSync(`tests/frame-art/${s.id}.webp`),contentType:'image/webp'};
  if(u.hostname==='api.tcgdex.net'&&u.pathname==='/v2/en/cards')return sources.filter(s=>u.searchParams.get('name')?.includes(s.name));
  if(u.hostname==='api.tcgdex.net'&&u.pathname.startsWith('/v2/en/cards/'))return sources.find(s=>u.pathname.endsWith('/'+s.id));
 }});const {page}=app;await page.emulateMedia({reducedMotion:'no-preference'});const before=await inventorySnapshot(page);
 fs.mkdirSync('test-results',{recursive:true});
 const settle=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const root=document.querySelector('#sheetBody');let quiet;const timeout=setTimeout(()=>{observer.disconnect();reject(Error('Detail did not settle'));},3000);const ready=()=>{clearTimeout(quiet);quiet=setTimeout(()=>{observer.disconnect();clearTimeout(timeout);resolve();},200);};const observer=new MutationObserver(ready);observer.observe(root,{childList:true,subtree:true});ready();}));
 const photo=hidden=>page.evaluate(hidden=>{const surface=document.querySelector('#sheetBody [data-finish-surface="detail"]'),layers=[...surface.querySelectorAll('.finish-layer')],img=surface.querySelector('img');if(!layers.length||!img.complete||!img.naturalWidth)throw Error('Finish surface not ready');for(const l of layers)l.style.visibility=hidden?'hidden':'';const r=img.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};},hidden);
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
  for(const finish of ['holofoil','reverse-holofoil']){
   await page.locator(`#sheetBody [data-act="cardFinishPreview"][data-finish="${finish}"]`).click();
   await page.waitForFunction(f=>document.querySelector(`#sheetBody [data-finish="${f}"]`)?.getAttribute('aria-pressed')==='true',finish);
   await page.evaluate(()=>document.querySelector('#sheetBody [data-finish-surface="detail"]').scrollIntoView({block:'center',behavior:'instant'}));
   const surface=page.locator('#sheetBody [data-finish-surface="detail"]');await surface.locator('.finish-layer').first().waitFor();
   assert.equal(JSON.parse(await surface.getAttribute('data-finish-model')).layers[0].mask,spec.frame+(finish==='holofoil'?'-art':'-surround'));
   await page.mouse.move(0,0);await settle();
   const box=await photo(true),plain=await page.screenshot({clip:box,animations:'disabled'}),foilBox=await photo(false);assert.deepEqual(foilBox,box,'Material toggling cannot move the card');
   const foil=await page.screenshot({clip:foilBox,animations:'disabled',path:`test-results/pokemon-frame-${source.id}-${finish}.png`});
   // Holo paints the window and nothing printed around it; reverse is the exact complement.
   const painted=finish==='holofoil'?spec.foil:{...spec.plain,rules:[.2,.6,.8,.82]},clear=finish==='holofoil'?spec.plain:spec.foil;
   const pixels=await compare(plain,foil,{...painted,...clear});
   for(const name of Object.keys(painted))assert(pixels[name].mean>1&&pixels[name].changedFraction>.1,`${source.id} ${finish}: ${name} visibly foiled ${JSON.stringify(pixels[name])}`);
   // Painted foil measures mean 20-30 with every pixel changed; hosted compositing noise has been
   // a few pixels per thin region (e.g. 4/380, mean .055). Bound clear regions far below paint.
   for(const name of Object.keys(clear))assert(pixels[name].mean<.5&&pixels[name].changedFraction<.05,`${source.id} ${finish}: ${name} stays unfoiled ${JSON.stringify(pixels[name])}`);
   report.cases.push({id:source.id,finish,pixels});
  }
  await page.locator('#sheetBody [data-act="closeSheet"]').first().click();
 }
 assert.equal(await inventorySnapshot(page),before);app.health();report.status='PASS';
 console.log('PASS: measured Pokémon frame windows paint the illustration beside the stage banner and spare the banner, badge and Pokédex strip; reverse is the exact complement.');
}catch(e){report.error=e.stack;if(app)await app.page.screenshot({path:'test-results/pokemon-frame-failure.png'}).catch(()=>{});throw e;}
finally{fs.writeFileSync('test-results/pokemon-frame-browser.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
