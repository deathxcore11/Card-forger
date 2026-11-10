// Live Forge table (fixture board): a redraw while cards are animating must not fold a lane into "+N" for a
// frame and unfold it the next (the flicker in Randall's 10 Nov video: creatures vanished for 2-3 frames
// whenever a card moved). Every animation frame after each change is checked: no battlefield card is hidden.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1366,height:800}});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await page.waitForTimeout(2500);
 const frames=await page.evaluate(async()=>{
  const hidden=()=>[...document.querySelectorAll('.play-match-card[data-presentation=battlefield]')].filter(e=>!e.closest('.forge-lane-tray')&&e.getBoundingClientRect().width<2).map(e=>e.getAttribute('aria-label'));
  const out=[];let run=true;const tick=()=>{out.push(hidden());if(run)requestAnimationFrame(tick);};requestAnimationFrame(tick);
  const n=window.fixture.native;
  for(let i=1;i<=6;i++){const s=structuredClone(n);s.revision=n.revision+i;const you=s.players.find(p=>p.id===s.viewer);you.life=40-i;const h=you.zones.Hand.cards;
   if(i%2&&h.length){const c=h.pop();c.zone='Battlefield';(you.zones.Battlefield.cards||(you.zones.Battlefield.cards=[])).push(c);}
   window.fixture.session.acceptState(s);await new Promise(r=>setTimeout(r,450));}
  run=false;return out;});
 const settled=frames.at(-1);
 const bad=frames.filter(f=>f.length>settled.length);
 assert.equal(bad.length,0,`no lane folds for a frame while cards move (${bad.length} of ${frames.length} frames hid: ${bad[0]?.join(', ')})`);
 console.log(`forge table no fold flicker: ok (${frames.length} frames)`);
}finally{await browser.close();server.close();}
