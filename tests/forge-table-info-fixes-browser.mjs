// Live Forge table (fixture board): the Part A info fixes from specs/table-info-web.md (Randall 10 Nov).
// A1 an unaffordable hand card says how short you are; A2 menace refusal wording and 2.5 s life;
// A3 a one-answer question is one tap; A4 engine notes stripped; A6 the menu says "Concede match".
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const {chromium}=await import('playwright');
const root=process.cwd();
const server=createServer(async(req,res)=>{try{const file=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.clock.install({time:Date.now()});
 await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
 await page.goto(base+'/experiments/forge-proof/table-fixture.html?state=main');await page.waitForFunction(()=>document.body.dataset.fixtureReady==='true');
 await page.clock.runFor(1500);
 await page.evaluate(()=>{window.calls=[];const s=window.fixture.session;for(const k of ['nativeSelect','selectPrompt','confirmPrompt','clearPrompt'])s[k]=(...a)=>{window.calls.push([k,...a]);return Promise.resolve();};
  window.push=(revision,patch)=>window.fixture.session.acceptState({...structuredClone(window.fixture.native),revision,...patch});});
 // A6
 assert.equal(await page.evaluate(()=>document.querySelector('[data-focus-key=exit-match]')?.textContent),'Concede match','the menu names what leaving does');
 // A1: mark one hand card unaffordable through Forge's own blocked list.
 const id=await page.evaluate(()=>{const n=window.fixture.native,you=n.players.find(p=>p.id===n.viewer),c=you.zones.Hand.cards.find(c=>c.name==='Skewer the Critics')||you.zones.Hand.cards[0];
  window.push(n.revision+1,{selection:{...n.selection,actionable:(n.selection.actionable||[]).filter(r=>r.id!==c.id),blocked:[{kind:'card',id:c.id,reason:'Need 3 mana'}]}});return c.id;});
 await page.clock.runFor(400);
 const box=await page.evaluate(id=>{const el=document.querySelector(`.play-match-hand .play-match-card[data-instance="${id}"]`);const r=el?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height*0.6,blocked:el.dataset.forgeBlocked}:null;},id);
 assert.ok(box,'the card is in the hand');assert.equal(box.blocked,'Need 3 mana');
 await page.mouse.click(box.x,box.y);await page.clock.runFor(100);
 let st=await page.evaluate(()=>({line:document.querySelector('.forge-short-line')?.textContent||null,lifted:!!document.querySelector('.play-match-hand .forge-refused'),zoom:document.querySelector('.forge-peek')?.dataset.pinned==='true',calls:window.calls.filter(c=>c[0]==='nativeSelect').length}));
 assert.equal(st.line,'3 mana short');assert.equal(st.lifted,true);assert.equal(st.zoom,false,'no pinned zoom');assert.equal(st.calls,0,'nothing is sent to Forge');
 await page.clock.runFor(2700);
 assert.equal(await page.evaluate(()=>!!document.querySelector('.forge-short-line')),false,'the line clears after 2.5 s');
 // A2
 await page.evaluate(()=>window.push(window.fixture.native.revision+5,{notification:{title:'',message:'Questing Beast cannot be blocked with 1 creatures you’ve assigned'}}));await page.clock.runFor(200);
 const notice=await page.evaluate(()=>document.querySelector('#practicePlayerMat>.forge-notice')?.textContent||null);
 assert.ok(/needs (2|more) blockers/.test(notice||''),`refusal names the rule (${notice})`);
 await page.evaluate(()=>window.push(window.fixture.native.revision+6,{notification:{title:'',message:'Questing Beast cannot be blocked with 1 creatures you’ve assigned'}}));await page.clock.runFor(2600);
 await page.evaluate(()=>window.push(window.fixture.native.revision+7,{notification:{title:'',message:'Questing Beast cannot be blocked with 1 creatures you’ve assigned'}}));await page.clock.runFor(200);
 assert.equal(await page.evaluate(()=>document.querySelector('#practicePlayerMat>.forge-notice')),null,'a refusal is gone after 2.5 s');
 // A3 + A4: Full Control "Play land" question with one answer, declining allowed.
 await page.evaluate(()=>window.push(window.fixture.native.revision+8,{notification:{},prompt:{id:'one-land',supported:true,method:'getAbilityToPlay',min:0,max:1,cancelable:true,message:'Choose ability',options:[{index:0,value:'Play land'}]}}));await page.clock.runFor(300);
 st=await page.evaluate(()=>({one:document.querySelector('[data-native-key=single-answer]')?.textContent||null,back:document.querySelector('[data-native-key=single-back]')?.textContent||null,nothing:/Nothing selected|Choose 0/.test(document.querySelector('.play-match-decisions')?.textContent||'')}));
 assert.equal(st.one,'Play land');assert.equal(st.back,'Back');assert.equal(st.nothing,false,'no engine wording');
 await page.evaluate(()=>{window.calls=[];document.querySelector('[data-native-key=single-answer]').click();});
 assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c[0])),['selectPrompt','confirmPrompt'],'one tap answers it');
 await page.evaluate(()=>window.push(window.fixture.native.revision+9,{prompt:{id:'one-trig',supported:true,method:'getAbilityToPlay',min:0,max:1,cancelable:true,message:'Choose',options:[{index:0,value:'When Dismal Backwater enters, you gain 1 life. [Zone Changer: Dismal Backwater (99)]'}]}}));await page.clock.runFor(300);
 assert.equal(await page.evaluate(()=>document.querySelector('[data-native-key=single-answer]')?.textContent),'When Dismal Backwater enters, you gain 1 life.','engine notes are stripped');
 // Must-take single answer goes by itself.
 await page.evaluate(()=>{window.calls=[];window.push(window.fixture.native.revision+10,{prompt:{id:'must',supported:true,method:'getChoices',min:1,max:1,message:'Choose',options:[{index:0,value:'Add {G}'}]}});});await page.clock.runFor(300);
 assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c[0])),['selectPrompt','confirmPrompt'],'a forced single answer is taken without asking');
 // A drop already says "play this": the Full Control one-answer question that follows it answers itself.
 const land=await page.evaluate(()=>{window.push(window.fixture.native.revision+11,{prompt:null,notification:{}});const n=window.fixture.native,you=n.players.find(p=>p.id===n.viewer);const c=you.zones.Hand.cards.find(c=>/^(Forest|Mountain|Island|Swamp|Plains)$/.test(c.name));return c?{id:c.id,name:c.name}:null;});
 await page.clock.runFor(600);
 const at=await page.evaluate(id=>{const r=document.querySelector(`.play-match-hand .play-match-card[data-instance="${id}"]`)?.getBoundingClientRect();return r?{x:r.left+r.width/2,y:r.top+r.height/2}:null;},land.id);
 await page.evaluate(()=>{window.calls=[];});
 await page.mouse.move(at.x,at.y);await page.mouse.down();for(let i=1;i<=12;i++){await page.mouse.move(at.x-160*i/12,at.y-300*i/12);await page.clock.runFor(16);}await page.mouse.up();await page.clock.runFor(100);
 assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c[0])),['nativeSelect'],'the drop plays the card');
 await page.evaluate(id=>{window.calls=[];window.push(window.fixture.native.revision+12,{prompt:{id:'drop-land',supported:true,method:'getAbilityToPlay',min:0,max:1,cancelable:true,message:'Choose ability',options:[{index:0,value:{kind:'ability',description:'Play land',card:{id,name:'Forest',hidden:false}}}]}});},land.id);await page.clock.runFor(300);
 assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c[0])),['selectPrompt','confirmPrompt'],'after a drop the one-answer question is not asked again');
 console.log('forge table info fixes: ok');
}finally{await browser.close();server.close();}
