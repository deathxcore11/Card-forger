// The web match menu in the Console look, on the table fixture (a fixed board, no server): phone, phone on its side, Fold,
// tablet and desktop. Pictures: test-results/match-menu/. Proves the layout only; a real match is Not assessed.
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('playwright');
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),out=resolve(process.env.SHOTS||resolve(root,'test-results/match-menu'));await mkdir(out,{recursive:true});
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const SIZES=[['phone-390x844',390,844],['phone-side-844x390',844,390],['fold-884x796',884,796],['tablet-1280x800',1280,800],['desktop-1440x900',1440,900]];
try{
 for(const [name,width,height] of SIZES){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<700||height<500});
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
  await page.locator('.play-match-menu>summary').click();await page.waitForTimeout(400);
  const panel=page.locator('.play-match-menu[open]>.forge-menu-panel');assert(await panel.isVisible(),name+': the menu opens');
  if(process.env.CHECK){
   const box=await panel.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${name}: the menu fits the screen (${JSON.stringify(box)})`);
   assert.equal(await panel.locator('p:visible').count(),0,name+': no description lines');
   for(const want of ['Resume','History','Remember this moment','Music volume','Effects volume'])assert(await panel.getByText(want,{exact:false}).first().isVisible(),`${name}: ${want} shows`);
   const music=panel.locator('[data-change="setMusicVolume"]');await music.fill('40');assert.equal((await panel.locator('[data-cline="music"] .c-pct').textContent()).trim(),'40%');
  }
  await page.screenshot({path:resolve(out,`menu-${name}.png`)});
  if(process.env.CHECK){await page.getByText('Resume',{exact:true}).click();assert.equal(await page.locator('.play-match-menu[open]').count(),0,name+': Resume closes the menu');}
  await page.close();
 }
 console.log('PASS: match menu at phone, phone on its side, Fold, tablet and desktop.');
}finally{await browser.close();server.close();}
