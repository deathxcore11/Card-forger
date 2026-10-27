// Live Forge table (fixture board, no transport): in Smart, once your own spell is on top of
// the stack and priority is back with you, the table passes it for you so it resolves, the
// way Arena plays. It never passes in Full Control, for the CPU's spell, during a prompt, or
// twice for the same stack.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const context=await browser.newContext({viewport:{width:884,height:830},hasTouch:true,isMobile:true}),page=await context.newPage();
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(600);
 await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;s.nativeButton=(...a)=>{window.calls.push(['button',...a]);return Promise.resolve();};
  // Your Llanowar Elves on the stack after Smart paid for it; priority is yours again.
  const elves={id:991,zone:'Stack',owner:1,controller:1,hidden:false,name:'Llanowar Elves',type:'Creature — Elf Druid',manaCost:'{G}',text:'{T}: Add {G}.',power:1,toughness:1};
  const bolt={...elves,id:992,owner:2,controller:2,name:'Lightning Bolt',type:'Instant',manaCost:'{R}',text:'Lightning Bolt deals 3 damage to any target.',power:null,toughness:null};
  window.state=(revision,patch={})=>({...structuredClone(window.fixture.native),revision,stack:[{id:801,text:'Llanowar Elves',source:elves,activatingPlayer:1}],buttons:{ok:'OK',okEnabled:true,cancel:'',cancelEnabled:false},...patch});
  window.cpuOnTop=revision=>window.state(revision,{stack:[{id:802,text:'Lightning Bolt',source:bolt,activatingPlayer:2},{id:801,text:'Llanowar Elves',source:elves,activatingPlayer:1}],priorityPlayer:1});});
 const accept=async expr=>{await page.evaluate(expr);await sleep(400);return page.evaluate(()=>window.calls.splice(0));};
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(8))),[['button','ok',8]],'Smart passes your own spell so it resolves');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(8))),[],'the same stack is passed once');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.cpuOnTop(9))),[],'the CPU’s spell on top is yours to answer');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(10,{controlMode:'full'}))),[],'Full Control keeps the stop');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(11,{priorityPlayer:2}))),[],'never while the CPU has priority');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(12,{inputType:'InputPayManaOfCostPayment'}))),[],'never during a payment');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(13,{buttons:{ok:'OK',okEnabled:false,cancel:'',cancelEnabled:false}}))),[],'never when Forge has not enabled the pass');
 assert.deepEqual(await accept(()=>window.fixture.session.acceptState(window.state(14))),[['button','ok',14]],'a later priority on your own spell passes again');
 assert.deepEqual(errors,[],'no page errors');
 console.log('PASS: Smart passes your own spell once it is on the stack, like Arena; never in Full Control, for the CPU’s spell, while the CPU has priority, during payment, or twice for one stack.');
 await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
