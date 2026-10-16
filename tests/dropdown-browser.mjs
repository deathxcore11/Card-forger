// Browser regression coverage. Runs on a review branch before production release.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
import {chromium,devices} from 'playwright';
const root=process.cwd(),errors=[];
const fixture=baseline=>`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><style>body{padding:16px}.fixture{max-width:380px;margin:auto;display:grid;gap:20px}.fixture select{width:100%}.spacer{height:1200px}.parent{width:320px;padding:20px;background:#171a20;color:white}.parent select{width:100%}</style><main class="fixture"><h1>Dropdown regression</h1><p id="events">No changes</p><label>Magic<select id="mtg"><option>Normal</option><option>Foil</option><option>Etched</option></select></label><label>Pokémon<select id="ptcg"><option>Normal</option><option>Holo</option><option>Reverse</option></select></label><label>Yu-Gi-Oh<select id="ygo"><option>Unlimited</option><option>1st Edition</option></select></label><label>Long list<select id="long">${Array.from({length:80},(_,i)=>`<option>Set ${String(i).padStart(3,'0')}</option>`).join('')}</select></label><button id="nested">Open parent</button><button id="replace">Replace source select</button><div class="spacer"></div><label>Lower-page<select id="lower"><option>Name</option><option>Price</option></select></label></main><dialog class="parent" id="parent"><h2>Parent popup</h2><label>Condition<select id="condition"><option>NM</option><option>LP</option><option>MP</option></select></label><button id="parent-close">Close parent</button></dialog><script type="module">import {attachGlassSelects} from '/${baseline?'__baseline-glass-select.js':'glass-select.js'}';attachGlassSelects();let count=0;document.addEventListener('change',e=>{if(e.target.tagName==='SELECT')document.querySelector('#events').textContent=e.target.id+':'+e.target.value+':'+(++count);});document.querySelector('#nested').onclick=()=>document.querySelector('#parent').showModal();document.querySelector('#parent-close').onclick=()=>document.querySelector('#parent').close();document.querySelector('#replace').onclick=()=>{const s=document.querySelector('#mtg');s.replaceWith(s.cloneNode(true));};</script>`;
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/__fixture'){res.setHeader('Content-Type','text/html');return res.end(fixture(u.searchParams.has('baseline')));}
  if(u.pathname==='/__baseline-glass-select.js'){res.setHeader('Content-Type','text/javascript');return res.end(execFileSync('git',['show','HEAD^:glass-select.js']));}
  const file=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));
 }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
try{
 // Reproduce the actual old dismissal handler before testing the replacement.
 const before=await browser.newContext({...devices['Pixel 7']});const old=await before.newPage();
 await old.goto(base+'/__fixture?baseline');await old.locator('#mtg').tap();
 // Some touch engines dismiss it on the opening gesture itself; otherwise resize reproduces it.
 if(await old.locator('.glass-select-menu[open]').count()) await old.evaluate(()=>window.dispatchEvent(new Event('resize')));
 assert.equal(await old.locator('.glass-select-menu[open]').count(),0,'baseline must reproduce unwanted resize dismissal');
 console.log('REPRODUCED: 3.73.7 closes its dropdown on a phone viewport resize.');await before.close();
 for(const [name,options] of [['desktop',{viewport:{width:1365,height:900}}],['phone',{...devices['Pixel 7']}],['folded',{...devices['Pixel 7'],viewport:{width:344,height:882}}],['unfolded',{...devices['Pixel 7'],viewport:{width:884,height:1104}}]]){
  const context=await browser.newContext(options),page=await context.newPage();page.on('pageerror',e=>errors.push(name+': '+e.message));
  await page.goto(base+'/__fixture');const menu=page.locator('.glass-select-menu[open]');
  const activate=loc=>options.hasTouch?loc.tap():loc.click();
  // Repeat actual press/release gestures; one opening gesture cannot dismiss itself.
  let count=0;
  for(let repeat=0;repeat<5;repeat++)for(const [id,value] of [['mtg','Foil'],['ptcg','Holo'],['ygo','1st Edition']]){
   await activate(page.locator('#'+id));await page.waitForTimeout(80);assert.equal(await menu.count(),1,`${name} ${id} stays open after completed gesture`);
   // Browser bars, keyboard and page scroll may all notify the same opening frame.
   await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));window.visualViewport?.dispatchEvent(new Event('resize'));window.visualViewport?.dispatchEvent(new Event('scroll'));document.dispatchEvent(new Event('scroll'));});
   await page.waitForTimeout(80);assert.equal(await menu.count(),1,`${name} viewport events keep menu open`);
   const next=repeat%2===0?value:(id==='ygo'?'Unlimited':'Normal');
   await activate(menu.getByRole('option',{name:next,exact:true}));assert.equal(await menu.count(),0);assert.equal(await page.locator('#'+id).inputValue(),next);
   assert.equal(await page.locator('#events').textContent(),`${id}:${next}:${++count}`,'one change per selection');
  }
  await activate(page.locator('#long'));await menu.getByRole('searchbox').fill('079');assert.equal(await menu.getByRole('option').count(),1);await activate(menu.getByRole('option',{name:'Set 079'}));assert.equal(await page.locator('#long').inputValue(),'Set 079');
  // Folding/keyboard-sized viewport changes re-anchor instead of closing.
  await activate(page.locator('#mtg'));await page.setViewportSize({width:390,height:500});assert.equal(await menu.count(),1);await menu.getByRole('option',{name:'Foil'}).press('Escape');assert.equal(await menu.count(),0);
  // A parent sheet remains open after its child menu saves.
  await activate(page.locator('#nested'));await activate(page.locator('#condition'));assert.equal(await menu.count(),1);await activate(menu.getByRole('option',{name:'LP',exact:true}));assert.equal(await page.locator('#parent').evaluate(e=>e.open),true);assert.equal(await page.locator('#condition').inputValue(),'LP');await activate(page.locator('#parent-close'));
  // Long pages must not scroll the focused option into the document and dismiss it.
  await activate(page.locator('#lower'));await page.waitForTimeout(80);assert.equal(await menu.count(),1);await activate(menu.getByRole('option',{name:'Price',exact:true}));assert.equal(await page.locator('#lower').inputValue(),'Price');
  // Replaced controls continue working after the application's next render.
  await activate(page.locator('#replace'));await activate(page.locator('#mtg'));assert.equal(await menu.count(),1);await menu.getByRole('option').first().press('Escape');
  // A new outside tap dismisses, while Escape preserves the selected value.
  await activate(page.locator('#mtg'));
  if(options.hasTouch)await page.touchscreen.tap(2,2);else await page.mouse.click(2,2);
  assert.equal(await menu.count(),0,'a complete outside tap dismisses');
  console.log(`PASS: ${name}: 15 repeated open/save gestures, phone viewport/scroll events, long-list filtering, resize, nested sheets, lower-page menus and source replacement.`);
  // Exercise the unchanged production app handlers as well as the isolated module.
  await page.route('**/*',route=>route.request().url().startsWith(base+'/')?route.continue():route.abort());
  await page.goto(base+'/#search');
  await page.getByRole('heading',{name:'Search cards',exact:true}).waitFor();
  const skip=page.getByRole('button',{name:'Skip',exact:true});
  try{await skip.waitFor({state:'visible',timeout:2000});await skip.click();}catch{}
  for(const game of ['Magic','Pokémon','Yu-Gi-Oh!']){
   if(game!=='Magic'){
    await page.getByRole('button',{name:'Switch game',exact:true}).click();
    await page.locator('#sheet[open]').getByRole('button',{name:new RegExp(game)}).click();
    await page.getByRole('button',{name:'Switch game',exact:true}).getByText(game,{exact:true}).waitFor();
   }
   await page.locator('summary').filter({hasText:'Filters'}).click();
   await activate(page.getByRole('combobox',{name:'Sort',exact:true}));
   await page.evaluate(()=>{window.dispatchEvent(new Event('resize'));document.dispatchEvent(new Event('scroll'));});
   await page.waitForTimeout(80);assert.equal(await menu.count(),1,`${name} real ${game} Sort stays open`);
   await activate(menu.getByRole('option',{name:'Name',exact:true}));
   assert.equal(await menu.count(),0);
   assert.equal((await page.getByLabel('Sort',{exact:true}).inputValue()).toLowerCase(),'name',`${game} real sort handler saved Name`);
  }
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByRole('heading',{name:'Settings',exact:true}).waitFor();
  const settingsSelect=page.locator('#sheet[open] select:visible').first();
  if(await settingsSelect.count()){
   await activate(settingsSelect);assert.equal(await menu.count(),1,`${name} Settings dropdown remains open`);
   await menu.getByRole('option').first().press('Escape');assert.equal(await page.locator('#sheet[open]').count(),1,'closing picker keeps Settings open');
  }
  console.log(`PASS: ${name}: production app Sort controls in all three games and Settings navigation.`);
  await context.close();
 }
 assert.deepEqual(errors,[],'no browser errors');
}finally{await browser.close();await new Promise(r=>server.close(r));}
