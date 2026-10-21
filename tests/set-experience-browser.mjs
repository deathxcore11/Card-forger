import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp} from './search-fixtures.mjs';
if(process.argv.includes('--validate-fixtures')){console.log('PASS: set atmosphere, real pack controller, mobile zoom modes and motion lifecycle cases ready for hosted CI.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Browser execution is hosted CI only.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch(),checks=[];
await mkdir('test-results',{recursive:true});
try{
 for(const game of ['mtg','ptcg','ygo'])for(const width of [320,390,768,1440]){
  const app=await openSearchApp(browser,server.base,{game,width,height:1000,hasTouch:width<1000,providerOverride:url=>/^\/img\/(?:mtg-set|back)\//.test(url.pathname)?{body:'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#49395f"/></svg>',contentType:'image/svg+xml'}:undefined}),{page}=app;
  try{
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(async({game})=>{
    const {S}=await import('/store.js'),T=await import('/tcg.js'),{setRowContent}=await import('/set-list-ui.js'),{packButton,setAtmosphere}=await import('/set-experience.js');
    const set=game==='mtg'?{code:'fxa',name:'Synthetic Magic expansion',digital:false,set_type:'expansion',card_count:12}:game==='ptcg'?{id:'base1',name:'Base Set',code:'BASE1',count:12}:{id:'fixture-ygo-pack',name:'Duelist Revolution',code:'DREV'};
    const cards=Array.from({length:12},(_,i)=>({id:'pack-'+i,name:'Synthetic card '+i,game,rarity:i%2?'common':'mythic',set:game==='mtg'?'fxa':{id:set.id,name:set.name},image:'https://search-fixtures.invalid/pack.svg',imageLarge:'https://search-fixtures.invalid/pack.svg',image_uris:{normal:'https://search-fixtures.invalid/pack.svg'},setContext:game==='ygo'?{printing:{rarity:'Ultra Rare'}}:undefined}));
    S.ui.view='set';const screen=game==='mtg'?S.ui.set:T.ui(game).set;Object.assign(screen,{code:'fxa',id:set.id,info:set,cards,loaded:true,busy:false,error:'',contents:{completeness:'complete'},q:'',filter:'all',sort:'name',limit:120});
    window.__packBefore=JSON.stringify([S.state.collection,S.state.decks,S.state.tcg]);
    document.querySelector('#content').innerHTML=`<h1>Set discovery fixture</h1><div class="set-list set-year-grid"><button class="set-row set-browser-tile">${setRowContent({name:set.name,ambient:true,code:set.code,image:'https://search-fixtures.invalid/pack.svg',magicSet:game==='mtg'?set:null,pokemonSet:game==='ptcg'?{...set,image:'https://search-fixtures.invalid/pack.svg'}:null,ygoSet:game==='ygo'?{...set,image:'https://search-fixtures.invalid/pack.svg'}:null,count:12,progress:{key:game+":"+set.code,owned:0,total:12,loaded:12,complete:true}})}</button></div>${packButton(game,set,{ready:true})}`;
   },{game});
   assert.equal(await page.locator('.set-atmosphere img').count(),1);
   await page.locator('[data-act="openSetPack"]').click();await page.locator('.pack-dialog[open]').waitFor();
   assert.match(await page.locator('.pack-explanation').textContent(),/not a real booster/);
   // Each game's real booster size: Yu-Gi-Oh! core packs hold 9 cards, Magic and Pokémon 10.
   const packSize=game==='ygo'?9:10;
   await page.locator('[data-pack="open"]').click();assert.equal(await page.locator('.pack-card').count(),packSize);
   await page.locator('.pack-card').first().click();assert.equal(await page.locator('.pack-card.revealed').count(),1);
   assert.equal(await page.locator('[data-pack="copy"]').isDisabled(),true);
   await page.locator('[data-pack="reveal-all"]').click();assert.equal(await page.locator('.pack-card.revealed').count(),packSize);
   const overflow=await page.locator('.pack-dialog').evaluate(n=>({scroll:n.scrollWidth,client:n.clientWidth,outside:[...n.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect(),p=n.getBoundingClientRect();return r.width>0&&r.height>0&&(r.left<p.left-2||r.right>p.right+2);}).map(b=>b.textContent)}));assert(overflow.scroll<=overflow.client+2,JSON.stringify(overflow));assert.deepEqual(overflow.outside,[]);
   assert.equal(await page.evaluate(async()=>{const {S}=await import('/store.js');return JSON.stringify([S.state.collection,S.state.decks,S.state.tcg])===window.__packBefore;}),true,'preview cannot change inventory');
   await page.screenshot({path:`test-results/set-experience-pack-${game}-${width}.png`,fullPage:true,animations:"disabled"});
   await page.locator('[data-pack="close"]').click();
   await page.evaluate(async()=>{const {openZoom}=await import('/zoom.js');window.__viewer=openZoom({src:'https://search-fixtures.invalid/zoom.svg',art:'https://search-fixtures.invalid/crop.svg',alt:'Synthetic card',finishModel:{layers:[],game:'ygo'}});});
   await page.locator('.zoom-img').waitFor();await page.waitForFunction(()=>document.querySelector('.zoom-img')?.naturalWidth>0);
   assert.equal(await page.locator('.zoom-seg [role="tab"]').count(),3);
   if(width<1000){await page.evaluate(()=>{window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:30,gamma:0}));});await page.waitForTimeout(60);await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:40,gamma:12})));await page.waitForFunction(()=>{const t=document.querySelector('.zoom-card-light').style.transform;return t.includes('rotateY')&&!t.includes('rotateY(0deg)');});
    await page.locator('[data-z="tilt"]').click();assert.equal(await page.locator('[data-z="tilt"]').getAttribute('aria-pressed'),'false');await page.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{beta:60,gamma:30})));await page.waitForTimeout(60);assert.equal(await page.locator('.zoom-card-light').evaluate(n=>n.style.transform),'','off prevents sensor motion');
    await page.locator('[data-z="tilt"]').click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('[data-z="tilt"]')?.disabled);assert.equal(await page.locator('[data-z="tilt"]').isDisabled(),true);assert.equal(await page.locator('.zoom-card-light').evaluate(n=>n.style.transform),'');await page.emulateMedia({reducedMotion:'no-preference'});}
   else assert.equal(await page.locator('[data-z="tilt"]').isVisible(),false,'desktop has no sensor control');
   await page.locator('[data-i="1"]').click();await page.waitForTimeout(60);assert.equal(await page.locator('.zoom [data-finish-surface]').count(),0);assert.equal(await page.locator('.zoom .finish-overlay').count(),0);assert.equal(await page.locator('.zoom-card-light').evaluate(n=>n.style.transform),'');
   await page.locator('[data-i="2"]').click();await page.locator('[data-i="0"]').click();await page.waitForTimeout(60);
   const zoomOverflow=await page.locator('.zoom-bar').evaluate(n=>{const r=n.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,scroll:n.scrollWidth,client:n.clientWidth};});assert(zoomOverflow.left>=-1&&zoomOverflow.right<=width+1&&zoomOverflow.scroll<=zoomOverflow.client+2,JSON.stringify(zoomOverflow));
   await page.screenshot({path:`test-results/set-experience-viewer-${game}-${width}.png`,fullPage:true,animations:"disabled"});
   await page.locator('[data-z="close"]').click();assert.equal(await page.locator('.zoom').count(),0);
   app.health();checks.push({game,width,result:'pass'});
  }catch(error){await page.screenshot({path:`test-results/set-experience-failure-${game}-${width}.png`,fullPage:true}).catch(()=>{});throw error;}finally{await app.context.close();}
 }
 await writeFile('test-results/set-experience.json',JSON.stringify(checks,null,2));console.log('PASS: 12 game/viewport combinations; actual pack-controller UI, reveal gates, untouched inventory, 3 zoom modes, mobile sensor input, plain-view overlay removal and responsive controls.');
}finally{await browser.close();await server.close();}
