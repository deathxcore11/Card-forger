import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Exact finish visual QA runs in hosted GitHub Actions.');
const {chromium}=await import('playwright'),root=resolve('.'),out='test-results/chishiro-etched';await mkdir(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!path.startsWith(root+sep)){res.writeHead(403);return res.end();}res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch();
try{for(const width of [390,1440])for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width===390});
 await context.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/tests/chishiro-etched.html');await page.waitForFunction(()=>document.documentElement.dataset.ready==='true');
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
 for(const surface of ['detail','zoom','gallery']){
  await page.locator('#'+surface).scrollIntoViewIfNeeded();await page.locator('#'+surface+' .finish-metal').waitFor();
  const details=await page.locator('#'+surface).evaluate(n=>{const img=n.querySelector('img').getBoundingClientRect(),overlay=n.querySelector('.finish-overlay'),r=overlay.getBoundingClientRect(),metal=overlay.querySelector('.finish-metal'),style=getComputedStyle(metal);return {aligned:Math.abs(img.x-r.x)<1&&Math.abs(img.y-r.y)<1&&Math.abs(img.width-r.width)<1&&Math.abs(img.height-r.height)<1,profile:overlay.dataset.materialProfile,blend:style.mixBlendMode,clip:style.clipPath,background:style.backgroundImage};});
  assert(details.aligned,surface+' image-space alignment');assert.equal(details.profile,'nec77-etched');assert.equal(details.blend,'soft-light');assert.match(details.clip,/evenodd/);assert.match(details.background,/metal-grain/);
  await page.locator('#'+surface).screenshot({path:`${out}/${width}-${theme}-${surface}.png`});
  await page.locator('#'+surface+' .surface').evaluate(n=>{n.style.setProperty('--mx','80%');n.style.setProperty('--my','25%');});
  await page.locator('#'+surface).screenshot({path:`${out}/${width}-${theme}-${surface}-light-shift.png`});
 }
 assert.equal(await page.locator('#grid .finish-overlay').count(),0,'ordinary grid remains without finish overlay');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow');
 await page.evaluate(()=>window.setEffects(false));await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));
 await page.evaluate(()=>window.setEffects(true));await page.locator('#detail').scrollIntoViewIfNeeded();await page.locator('#detail .finish-metal').waitFor();
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.finish-overlay'));
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#detail .finish-metal').waitFor();
 assert.deepEqual(errors,[]);await context.close();
}console.log('PASS: exact public NEC077 art, phone/desktop light/dark, detail/zoom/gallery masks, unchanged grid, light coordinates, effects-off and reduced-motion.');}
finally{await browser.close();await new Promise(r=>server.close(r));}
