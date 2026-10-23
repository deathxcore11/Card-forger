import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CARDS,NOW,startServer,openSearchApp,inventorySnapshot,noOverflow} from './search-fixtures.mjs';
if(process.argv.includes('--validate-fixtures')){console.log('PASS: format-isolated Pokémon lists, actual Meta actions, honest Unlimited coverage and service-only requests fixture.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Hosted CI only');
const {chromium}=await import('playwright'),browser=await chromium.launch(),server=await startServer();fs.mkdirSync('test-results',{recursive:true});const report={status:'FAIL',cases:[]};let app;
try{
 for(const width of [390,768,1440]){
  const hits=[];let fail=false;
  app=await openSearchApp(browser,server.base,{game:'ptcg',width,height:1000,evidenceLabel:'pokemon-meta',prepareFixtures:f=>{delete f.storage['cardforge-meta-v1'];},providerOverride:url=>{
   if(!url.pathname.startsWith('/api/meta/ptcg/'))return;
   hits.push(url.href);
   if(fail)return{status:502,body:{message:'Synthetic tournament outage'}};
   const format=url.searchParams.get('format');
   if(url.pathname.endsWith('/tournaments'))return [{id:format+'-fixture',game:'PTCG',format:format==='glc'?'GLC':format.toUpperCase(),players:32,date:new Date(NOW-864e5).toISOString(),name:'Synthetic '+format+' tournament'}];
   if(url.pathname.endsWith('/pairings'))return [];
   const id=url.searchParams.get('id');return[{placing:1,player:'fixture',deck:{id,name:'Synthetic '+id,icons:[]},decklist:{pokemon:[{name:CARDS.ptcg[0].name,count:4,set:'FXA',number:'1'}]}}];
  }});
  const {page}=app,before=await inventorySnapshot(page);
  await page.evaluate(()=>{location.hash='#decks';});await page.getByRole('tab',{name:'Meta decks',exact:true}).click();
  for(const [format,label]of [['standard','Standard'],['expanded','Expanded'],['glc','Gym Leader Challenge']]){
   await page.locator(`[data-act="tMetaFormat"][data-id="${format}"]`).click();
   await page.locator(`[data-act="tMetaDeck"][data-key="ptcg:${format}-fixture:1"]`).first().waitFor();
   assert.match(await page.locator('.tournament-panel').innerText(),new RegExp('Synthetic '+format+'-fixture'));
   const expectedKey=format==='standard'?'ptcg':'ptcg:'+format;
   assert.equal(await page.locator(`[data-act="tMetaDeck"][data-key="ptcg:${format}-fixture:1"]`).first().getAttribute('data-meta-key'),expectedKey);
   await noOverflow(page,'#content',`Pokémon ${format} ${width}`);
   await page.screenshot({path:`test-results/pokemon-meta-${format}-${width}.png`,fullPage:true,animations:'disabled'});
   report.cases.push({width,format,label});
  }
  const count=hits.length;await page.locator('[data-act="tMetaFormat"][data-id="unlimited"]').click();await page.locator('.meta-format-empty').waitFor();assert.equal(await page.locator('[data-act="tMetaDeck"]').count(),0);assert.equal(hits.length,count);
  await page.locator('[data-act="tMetaFormat"][data-id="expanded"]').click();fail=true;await page.locator('[data-act="tMetaRefresh"]').click();
  await page.waitForFunction(async()=>{const {metaState}=await import('/meta.js');return !metaState('ptcg:expanded').busy&&!!metaState('ptcg:expanded').error;});
  assert.equal(await page.locator('[data-key="ptcg:expanded-fixture:1"]').count()>0,true,'failed refresh retains that format’s verified lists');
  assert(!hits.some(url=>new URL(url).hostname==='play.limitlesstcg.com'));
  assert.deepEqual(await inventorySnapshot(page),before);
  assert.deepEqual(app.diagnostics().errors,[]);await app.context.close();app=null;
 }
 report.status='PASS';console.log('PASS: actual Pokémon Meta tabs fetch Standard/Expanded/GLC separately, keep stale lists per format and never disguise Standard as Unlimited.');
}finally{fs.writeFileSync('test-results/pokemon-meta-report.json',JSON.stringify(report,null,2));await app?.context.close();await browser.close();await server.close();}
