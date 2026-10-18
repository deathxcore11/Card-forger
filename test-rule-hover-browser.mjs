// Hosted-browser check with real shared rule text, definitions, tooltip and click dialog.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run this browser fixture only in hosted GitHub Actions.');
const root=process.cwd();await mkdir('test-results',{recursive:true});
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><body style="padding:30px;min-height:1800px"><main id="fixture"></main><dialog id="modal" style="overflow:hidden;width:400px;height:150px"></dialog><script type="module">
import {attachRuleHover,showRuleHint,ruleText} from '/rule-dex.js';
const host=document.querySelector('#fixture');
host.innerHTML=[['ptcg','Knocked Out'],['ptcg','Ability'],['mtg','flying'],['ygo','Quick Effect']].map(([g,t])=>'<section style="margin:25px">'+ruleText(g,t)+'</section>').join('')+'<button id="learn" class="chip" data-act="ruleHint" data-game="ptcg" data-rule="Ability">Learn Ability</button>';
attachRuleHover();document.addEventListener('click',e=>{const b=e.target.closest('[data-act="ruleHint"]');if(b)showRuleHint(b);});window.ready=true;
</script>`;
const server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;if(path==='/fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture);}const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 const page=await browser.newPage({viewport:{width:900,height:700}});await page.goto(base+'/fixture');await page.waitForFunction(()=>window.ready);
 const tip=page.locator('#rule-hover-tip');
 for(const [game,key] of [['ptcg','Knocked Out'],['ptcg','Ability'],['mtg','flying'],['ygo','Quick Effect']]){
  const trigger=page.locator(`.rule-word[data-game="${game}"][data-rule="${key}"]`);await trigger.hover();await tip.waitFor();const b=await trigger.boundingBox(),t=await tip.boundingBox();assert(t.y>=b.y+b.height);assert.equal(await tip.getAttribute('role'),'tooltip');assert(await trigger.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));}),'trigger remains hit-testable');if(game==='ptcg'&&key==='Knocked Out')await page.screenshot({path:'test-results/rule-hover-desktop.png'});await page.mouse.move(t.x+8,t.y+8);await page.waitForTimeout(180);assert.equal(await tip.count(),1,'hoverable tooltip');await page.mouse.move(890,690);await page.waitForTimeout(200);assert.equal(await tip.count(),0);
 }
 await page.locator('#learn').hover();await tip.waitFor();await page.keyboard.press('Escape');assert.equal(await tip.count(),0);
 await page.reload();await page.waitForFunction(()=>window.ready);await page.mouse.move(890,690);await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.rule),'Knocked Out');await tip.waitFor();assert.equal(await tip.locator('strong').textContent(),'Knocked Out');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.dataset.rule),'Ability');assert.equal(await tip.locator('strong').textContent(),'Ability');await page.keyboard.press('Escape');assert.equal(await tip.count(),0);
 const first=page.locator('[data-rule="Knocked Out"]');await first.hover();await tip.waitFor();await page.evaluate(()=>window.scrollBy(0,10));await page.waitForTimeout(100);assert.equal(await tip.count(),0);await page.evaluate(()=>window.scrollTo(0,0));
 await first.click();assert.equal(await tip.count(),0);assert.equal(await page.locator('.rule-glass').count(),1);await page.locator('.rule-dismiss').click();
 await page.evaluate(()=>{const modal=document.querySelector('#modal');modal.innerHTML='<button class="chip" data-act="ruleHint" data-game="ptcg" data-rule="Ability">Ability</button>';modal.showModal();});await page.locator('#modal button').hover();await tip.waitFor();assert(await tip.evaluate(e=>e.matches(':popover-open')),'top layer avoids clipping');await page.keyboard.press('Escape');assert.equal(await tip.count(),0);assert(await page.locator('#modal').evaluate(e=>e.open),'first Escape dismisses preview, not its parent dialog');await page.keyboard.press('Escape');assert.equal(await page.locator('#modal').evaluate(e=>e.open),false);
 await page.evaluate(()=>{const b=document.querySelector('#learn');b.style='position:fixed;right:8px;bottom:8px;';});await page.locator('#learn').hover();await tip.waitFor();const edge=await tip.boundingBox();assert(edge.x>=8&&edge.x+edge.width<=892&&edge.y>=8&&edge.y+edge.height<=692);await page.screenshot({path:'test-results/rule-hover-edge.png'});await page.mouse.move(10,10);await page.waitForTimeout(200);
 const mobile=await browser.newContext({...devices['Pixel 7']});const phone=await mobile.newPage();await phone.goto(base+'/fixture');await phone.waitForFunction(()=>window.ready);await phone.locator('[data-rule="Knocked Out"]').tap();assert.equal(await phone.locator('#rule-hover-tip').count(),0);assert.equal(await phone.locator('.rule-glass').count(),1,'touch still opens full existing rule dialog');// Capture the settled production dialog, not an entrance-animation frame.
 await phone.locator('.rule-glass').evaluate(async element=>{
  const finite=element.getAnimations({subtree:true}).filter(animation=>Number.isFinite(animation.effect?.getComputedTiming().endTime));
  let timer;try{await Promise.race([Promise.all(finite.map(animation=>animation.finished)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Rule dialog entrance animation did not settle')),2000);})]);}finally{clearTimeout(timer);}
 });
 await phone.waitForFunction(()=>{const dialog=document.querySelector('.rule-glass');return dialog&&getComputedStyle(dialog).opacity==='1'&&dialog.getBoundingClientRect().height>0;},{},{timeout:2000});
 assert(await phone.locator('.rule-glass').isVisible(),'settled touch dialog is visible');
 assert.equal(await phone.locator('.rule-glass').evaluate(element=>getComputedStyle(element).opacity),'1','touch dialog entrance is fully opaque');
 await phone.screenshot({path:'test-results/rule-hover-touch.png'});await mobile.close();
 console.log('PASS browser: all games, learning chips, pointer, hoverable, keyboard, Escape, scroll, click, modal top-layer/clamp and touch tap');
}finally{await browser.close();await new Promise(r=>server.close(r));}
