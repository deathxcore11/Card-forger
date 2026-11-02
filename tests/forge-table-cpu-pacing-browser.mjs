// Live Forge table (fixture board, no transport): a CPU turn that reaches the player in one update
// plays out on the table beat by beat, as on Arena: the land drops, the spell is shown and lands,
// the attack swings and the life total falls, and only then does the player's turn open. A tap
// skips straight to the decision.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),shots=process.env.PACING_SHOTS||'';
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
// The CPU's turn as the bridge reports it: before, and after it has passed back to you.
const turn=skip=>{
 const f=window.fixture,YOU=1,CPU=2,clone=x=>JSON.parse(JSON.stringify(x));
 const before=clone(f.native);before.revision=20;before.events={schema:'cardstashy.forge-events.v1',latest:10,items:[]};
 f.session.acceptState(before);
 const after=clone(before),cpu=after.players.find(p=>p.id===CPU),you=after.players.find(p=>p.id===YOU),bf=cpu.zones.Battlefield.cards;
 const land={...clone(bf.find(c=>c.name==='Island')),id:900,tapped:false},bear={...clone(bf.find(c=>c.name==='Grizzly Bears')),id:901,tapped:false,summoningSick:true};
 const giant=bf.find(c=>c.name==='Hill Giant'),islands=bf.filter(c=>c.name==='Island'&&!c.tapped);islands.forEach(c=>{c.tapped=true;});giant.tapped=true;
 bf.push(land,bear);cpu.zones.Hand.count-=2;you.life-=3;
 const e=(seq,type,o)=>({seq,type,turn:5,phase:'MAIN1',...o}),ref=c=>({kind:'card',id:c.id,name:c.name});
 after.revision=21;after.turn=6;after.activePlayer=YOU;after.priorityPlayer=YOU;after.phase='MAIN1';after.inputType='InputPassPriority';after.busy=false;
 after.buttons={ok:'OK',okEnabled:true,cancel:'End turn',cancelEnabled:true};
 after.events={schema:'cardstashy.forge-events.v1',latest:17,items:[e(11,'land',{player:CPU,card:ref(land)}),e(12,'cast',{player:CPU,stackId:77,source:ref(bear),targets:[]}),e(13,'resolve',{source:ref(bear)}),
  e(14,'attack',{player:CPU,attackers:[{id:giant.id,target:{kind:'player',id:YOU}}]}),e(15,'damage',{target:{kind:'player',id:YOU},source:ref(giant),amount:3,combat:true}),e(16,'turn',{player:YOU,number:6}),e(17,'turn',{player:YOU,number:6})]};
 // What the table shows, sampled every frame until the decision opens.
 const t0=performance.now(),seen={},root=document.getElementById('practicePlayerMat');
 const mark=(k,ok)=>{if(ok&&seen[k]===undefined)seen[k]=Math.round(performance.now()-t0);};
 return new Promise(done=>{const tick=()=>{
  mark('land',!!root.querySelector('.play-match-card[data-instance="900"]'));
  mark('spotlight',document.querySelector('.forge-cast-show[data-open=true],[data-open=true].forge-cast')?.textContent?.includes('Grizzly')||[...document.querySelectorAll('[data-open=true]')].some(n=>/CASTS/.test(n.textContent)));
  mark('creature',!!root.querySelector('.play-match-card[data-instance="901"]'));
  mark('attack',!!root.querySelector('.play-match-card[data-instance="'+giant.id+'"]')?.closest('[data-attacking=true],.is-attacking'));
  mark('life',/37/.test(root.querySelector(`.play-match-seat[data-player-seat]`)?.textContent||'')||[...root.querySelectorAll('.play-match-life strong')].some(n=>n.textContent==='37'));
  mark('decision',root.dataset.forgePlayback==='false'&&f.session.snapshot().status?.revision===21);
  if(seen.decision!==undefined||performance.now()-t0>15000)return done(seen);
  requestAnimationFrame(tick);
 };f.session.acceptState(after);if(skip)setTimeout(()=>root.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0})),300);tick();});
};
try{
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true}),page=await context.newPage();
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const open=async()=>{await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=cpu');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');await sleep(800);};
 await open();
 if(shots){let i=0;const loop=setInterval(()=>page.screenshot({path:`${shots}/beat-${String(i++).padStart(2,'0')}.png`}).catch(()=>{}),450);var stopShots=()=>clearInterval(loop);}
 const seen=await page.evaluate(turn,false);stopShots?.();
 console.log('timeline (ms):',JSON.stringify(seen));
 assert.ok(seen.land>=0,'the land drops');
 assert.ok(seen.creature>seen.land+400,'the creature lands well after the land, on its own beat');
 assert.ok(seen.life>seen.creature+400,'the attack lands after the creature');
 assert.ok(seen.decision>seen.life,'your turn opens last');
 assert.ok(seen.decision>=5000&&seen.decision<=14000,`the CPU turn is shown at a readable pace (${seen.decision} ms)`);
 await open();
 const skipped=await page.evaluate(turn,true);console.log('with a tap at 300 ms:',JSON.stringify(skipped));
 assert.ok(skipped.decision<seen.decision-200,'a tap moves on to the next CPU action (Randall, 2 Nov: never past the whole turn)');assert.ok(skipped.creature!==undefined,'the tapped-through turn still shows its creature');
 assert.deepEqual(errors,[]);
 console.log('ok - CPU turn pacing');
}finally{await browser.close();server.close();}
