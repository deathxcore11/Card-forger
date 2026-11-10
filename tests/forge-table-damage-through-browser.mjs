// Blocks: the damage chip shows above your seat while you declare blockers, and goes when blocks are confirmed.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),shots=process.env.CHIP_SHOTS||'';
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 for(const viewport of [{width:844,height:390},{width:1440,height:900}]){
  const page=await (await browser.newContext({viewport,hasTouch:true,isMobile:viewport.width<900,deviceScaleFactor:1.5})).newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=block');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await page.waitForTimeout(900);
  const read=()=>page.evaluate(()=>{const c=document.querySelector('.forge-through');return c?{text:c.textContent,tone:c.dataset.tone,box:c.getBoundingClientRect().toJSON()}:null;});
  const chip=await read();assert.ok(chip,`the chip shows while you declare blockers (${viewport.width})`);
  assert.match(chip.text,/damage gets through/i);assert.match(chip.text,/Your life: 40 → \d+/);assert.equal(chip.tone,'hurt');
  assert.ok(chip.box.left>=0&&chip.box.top>=0&&chip.box.right<=viewport.width,'the chip is on screen');
  if(shots)await page.screenshot({path:`${shots}/through-${viewport.width}.png`});
  // Blocks confirmed (the input moves on): the chip is gone.
  await page.evaluate(()=>{const f=window.fixture,n=f.native;f.session.acceptState({...n,revision:n.revision+1,inputType:'InputPassPriority'});});await page.waitForTimeout(400);
  assert.equal(await read(),null,'the chip goes the moment blocks are confirmed');
  console.log(`PASS ${viewport.width}x${viewport.height}: "${chip.text}" shown while blocking, gone after.`);
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
