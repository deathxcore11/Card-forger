// A commander arriving from the Command zone never freezes anything on the table: no centre ghost, no dim layer, its tile stays
// visible, and a card that takes the short rare drop is back to rest within a second (web 4.3.161 hot fix).
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const page=await (await browser.newContext({viewport:{width:1375,height:1110}})).newPage();
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(800);
 await page.evaluate(()=>{const f=window.fixture,n=structuredClone(f.native),me=n.players.find(x=>x.id===n.viewer),cmd=me.zones.Command.cards[0];
  me.zones.Command.cards=[];me.zones.Command.count=0;cmd.commander=true;cmd.zone='Battlefield';me.zones.Battlefield.cards.push(cmd);me.zones.Battlefield.count++;
  window.cmdId=cmd.id;f.session.acceptState({...n,revision:n.revision+1});});
 let worst=0;
 for(let i=0;i<14;i++){await sleep(150);worst=Math.max(worst,await page.evaluate(()=>document.querySelectorAll('.forge-enter-ghost,.forge-enter-dim,.forge-enter-name').length));}
 assert.equal(worst,0,'no centre ghost, dim layer or name line is ever drawn');
 const state=await page.evaluate(()=>{const w=document.querySelector(`.play-match-card[data-instance="${window.cmdId}"]`)?.closest('.play-match-card-wrap');return {there:!!w,hidden:w?.style.visibility==='hidden',anims:w?.getAnimations().length||0};});
 assert.ok(state.there&&!state.hidden,'the commander tile is on the table and visible');assert.equal(state.anims,0,'its drop has finished');
 assert.deepEqual(errors,[]);
 console.log('PASS: a commander arriving from the Command zone takes the short drop, nothing is frozen or hidden afterwards.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
