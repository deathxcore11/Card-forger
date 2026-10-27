import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Rendered milestone verification runs in hosted GitHub Actions.');
const {chromium}=await import('playwright'),root=resolve('.'),out='test-results/finish-milestone';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)){res.writeHead(403);return res.end();}const bytes=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch(),result={cases:[],phoneHardwareTest:'not-performed',baseline:'0896479cbb5b0d103a46907e057354fe9bebf57a'};
try{
 const context=await browser.newContext({viewport:{width:1440,height:1200},deviceScaleFactor:1});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const data=JSON.parse(await readFile('review/cases.json','utf8'));assert.equal(data.cases.length,14);
 for(const c of data.cases){
  await page.goto(base+'/review/index.html#case='+c.key);await page.waitForFunction(key=>document.documentElement.dataset.case===key,c.key);
  await page.waitForFunction(()=>[...document.querySelectorAll('.review-card>img')].every(i=>i.complete&&i.naturalWidth>0));
  assert.equal(await page.locator('.review-card').count(),2);
  if(c.profile==='plain')assert.equal(await page.locator('.candidate .finish-layer').count(),0);
  if(c.titleMask)assert.match(await page.locator('.candidate .title-glyphs').getAttribute('style'),new RegExp(c.titleMask.split('/').at(-1)));
  for(const width of [390,768,1440]){
   await page.setViewportSize({width,height:width===390?1000:1200});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No page overflow: '+c.key+' '+width);
   const boxes=await page.locator('.review-card').evaluateAll(nodes=>nodes.map(n=>{const a=n.querySelector('img').getBoundingClientRect(),o=n.querySelector('.finish-overlay')?.getBoundingClientRect();return {a:{w:a.width,h:a.height},aligned:!o||Math.abs(a.x-o.x)<1&&Math.abs(a.y-o.y)<1&&Math.abs(a.width-o.width)<1&&Math.abs(a.height-o.height)<1};}));
   assert(boxes.every(b=>b.aligned),'Effect and source image share bounds');
   await page.locator('#comparison').screenshot({path:`${out}/${c.key}-${width}.png`});
  }
  for(const [id,value] of [['lightX','82'],['lightY','65']])await page.locator('#'+id).evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},value);
  await page.waitForFunction(()=>parseFloat(document.querySelector('.candidate .review-card').style.getPropertyValue('--mx'))>80);
  await page.locator('#comparison').screenshot({path:`${out}/${c.key}-tilted.png`});
  result.cases.push({key:c.key,widths:[390,768,1440],aligned:true,imagesLoaded:true});
 }
 await page.goto(base+'/review/index.html#case=ygo-abyss-ultra');await page.waitForFunction(()=>document.documentElement.dataset.case==='ygo-abyss-ultra');
 await page.locator('#motion').click();assert.equal(await page.locator('#motion').getAttribute('aria-pressed'),'true');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('#motion').getAttribute('aria-pressed')==='false');
 assert.equal(await page.locator('.candidate .review-card').evaluate(n=>getComputedStyle(n).transform),'none');
 await page.locator('#openDeck').click();assert.equal(await page.locator('#sampleCards').isVisible(),true,'Deck cards open without playing the animation');
 assert.equal(await page.locator('#sampleBox').evaluate(n=>n.classList.contains('open')),false);
 await page.locator('#playBox').click();assert.equal(await page.locator('#sampleBox').evaluate(n=>n.classList.contains('open')),true);
 assert.deepEqual(errors,[]);result.browserErrors=errors;result.reducedMotion=true;result.deckNavigationImmediate=true;
 await page.setViewportSize({width:1440,height:1200});await page.screenshot({path:out+'/studio-overview.png',fullPage:true});
 // Use the actual application resolver, mount lifecycle and stylesheet with
 // retained artwork. The studio alone is insufficient rollout evidence.
 await page.emulateMedia({reducedMotion:'no-preference'});
 result.applicationCases=[];
 for(const c of data.cases){
  await page.goto(base+'/tests/finish-materials.html#'+c.key);await page.waitForFunction(key=>document.documentElement.dataset.case===key,c.key);
  await page.waitForFunction(()=>document.querySelector('.card img')?.naturalWidth>0);
  if(c.profile!=='plain')await page.locator('.finish-overlay[data-material-profile]').waitFor();
  if(c.titleMask)await page.locator('.finish-title-glyphs').waitFor();
  if(c.profile==='plain')assert.equal(await page.locator('.finish-layer').count(),0);
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:1100});
   await page.locator('.card').screenshot({path:`${out}/app-${c.key}-${width}.png`});
   const aligned=await page.locator('.card').evaluate(n=>{const a=n.querySelector('img').getBoundingClientRect(),o=n.querySelector('.finish-overlay')?.getBoundingClientRect();return !o||Math.abs(a.x-o.x)<1&&Math.abs(a.y-o.y)<1&&Math.abs(a.width-o.width)<1&&Math.abs(a.height-o.height)<1;});assert(aligned);
  }
  result.applicationCases.push(c.key);
 }
 const buy=new URL(await page.locator('#conditionPricePreview a').getAttribute('href'));assert.equal(buy.pathname,'/product/89828');assert.equal(buy.searchParams.get('Condition'),'Moderately Played');assert.equal(buy.searchParams.get('Printing'),'Holofoil');assert.equal(buy.searchParams.get('Language'),'English');
 assert.match(await page.locator('#conditionPricePreview').innerText(),/\$93.45 · Last known condition price/);
 await page.locator('#conditionPricePreview').screenshot({path:out+'/last-known-condition.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));
 assert.deepEqual(errors,[]);
 await writeFile(out+'/results.json',JSON.stringify(result,null,2));
 console.log('PASS: 14 cases, 3 viewport widths, aligned overlays, plain controls, title masks, motion controls and immediate deck navigation. Physical-phone approval remains pending.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
