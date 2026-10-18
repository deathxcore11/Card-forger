// Real index.html/app.js + production native card dialog, with deterministic providers.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {CARDS,RAW,startServer,openApp,RESULTS} from './detail-rules-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Run only in hosted GitHub Actions.');
const ability={type:'Ability',name:'Fixture ability',effect:'You may use this Ability when this Pokémon is Knocked Out.'};
RAW.ptcg[0].abilities=[ability];CARDS.ptcg[0].abilities=[ability];CARDS.ptcg[0].text='Ability: Fixture ability\n'+ability.effect;
const {chromium}=await import('playwright');const server=await startServer();let browser,app;
try{
 browser=await chromium.launch();
 for(const method of ['keyboard','locator']){
 app=await openApp(browser,server.base,{game:'ptcg',width:1440,height:1000});const {page}=app;
 await page.locator('#content .lot-art[data-entry="lot-ptcg-0"]').click();
 await page.waitForFunction(()=>document.querySelector('#sheet')?.open&&document.querySelector('#sheet [data-act="ruleHint"][data-rule="Ability"]'));
 // Observe the real handler chain without replacing any application handler.
 await page.evaluate(()=>{
  window.__escapeTrace=[];
  const log=(at,e)=>window.__escapeTrace.push({at,type:e.type,key:e.key||'',tip:!!document.querySelector('#rule-hover-tip'),open:document.querySelector('#sheet').open,prevented:e.defaultPrevented,active:document.activeElement?.dataset.rule||document.activeElement?.tagName});
  for(const [at,node,capture]of [['window',window,true],['document',document,true],['sheet',document.querySelector('#sheet'),true]])for(const type of ['keydown','keyup','cancel','close','focusin','focusout','blur','scroll'])node.addEventListener(type,e=>{if(type!=='keydown'&&type!=='keyup'||e.key==='Escape')log(at,e);},capture);
 });
 // Trusted Tab traversal through the actual sheet controls, never locator.focus().
 let found=false;for(let i=0;i<150;i++){await page.keyboard.press('Tab');if(await page.evaluate(()=>document.activeElement?.matches('#sheet [data-act="ruleHint"][data-rule="Ability"]'))){found=true;break;}}
 assert(found,'Actual card dialog Ability reached by Tab');await page.locator('#rule-hover-tip').waitFor();
 if(method==='locator')await page.getByRole('button',{name:'Explain Ability',exact:true}).first().press('Escape');else await page.keyboard.press('Escape');
 await page.waitForTimeout(100);
 const first=await page.evaluate(()=>({open:document.querySelector('#sheet').open,tip:!!document.querySelector('#rule-hover-tip'),trace:window.__escapeTrace}));
 await writeFile(RESULTS+'/rule-hover-app-'+method+'-events.json',JSON.stringify(first,null,2));
 assert.equal(first.tip,false,'First Escape dismisses preview');assert.equal(first.open,true,'First Escape must preserve the real card dialog');
 await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#sheet').open);
 app.health();console.log('PASS actual app '+method+': trusted Tab, tooltip-only first Escape, native dialog second Escape');await app.context.close();app=null;
 }
}finally{
 if(app){
  const state=await app.page.evaluate(()=>({open:document.querySelector('#sheet')?.open,tip:!!document.querySelector('#rule-hover-tip'),active:document.activeElement?.outerHTML,trace:window.__escapeTrace||[]})).catch(error=>({error:String(error)}));
  await writeFile(RESULTS+'/rule-hover-app-final-state.json',JSON.stringify(state,null,2));
  await app.page.screenshot({path:RESULTS+'/rule-hover-app-final.png'}).catch(()=>{});
 }
 await app?.context.close();await browser?.close();await server.close();
}
