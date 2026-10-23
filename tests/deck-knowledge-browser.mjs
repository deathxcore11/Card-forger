// Actual application; providers and artworks are synthetic fixtures. No account
// writes, paid AI or external requests. Local execution must be explicit.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {startServer,openSearchApp,noOverflow,RAW} from './search-fixtures.mjs';
const {chromium}=await import(process.env.CARDSTASHY_PLAYWRIGHT_MODULE||'playwright');
const server=await startServer(),browser=await chromium.launch({headless:true,...(process.env.CARDSTASHY_CHROMIUM_PATH?{executablePath:process.env.CARDSTASHY_CHROMIUM_PATH,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{} )}),checks=[];
await mkdir('test-results',{recursive:true});
try{
 for(const game of ['mtg','ygo','ptcg'])for(const width of [390,1440]){
  const app=await openSearchApp(browser,server.base,{game,width,height:1000,hasTouch:width<600,evidenceLabel:'deck-knowledge',providerOverride:url=>{if(url.hostname==='api.scryfall.com'&&url.pathname==='/cards/search'&&(url.searchParams.get('q')||'').includes('t:"legendary"'))return {data:[],has_more:false,total_cards:0};if(url.hostname==='db.ygoprodeck.com'&&url.pathname.endsWith('/cardinfo.php')&&url.searchParams.has('race'))return {data:RAW.ygo.filter(c=>c.race===url.searchParams.get('race')).slice(0,5),meta:{total_rows:5}};},prepareFixtures:f=>{
   if(game==='mtg'){const c=Object.values(f.catalog)[0];c.keywords=['Prowess'];c.oracle_text='Prowess';c.type_line='Legendary Creature — Human Wizard';}
   if(game==='ptcg'){const c=Object.values(f.cache.ptcg)[0];c.abilities=[{name:'Synthetic shared Ability',type:'Ability',effect:'Draw a card.'}];}
  }});
  try{
   const {page}=app;
   await page.evaluate(game=>{const S=window.__uiTestState,T=window.__uiTestTcg,b=document.createElement('button');if(game==='mtg'){b.dataset.act='card';b.dataset.name=Object.keys(S.catalog)[0];}else{b.dataset.act='tCard';b.dataset.id=Object.keys(T.cache[game])[0];}document.body.append(b);b.click();b.remove();},game);
   await page.locator('#sheet[open] .card-discovery').first().waitFor();await page.locator('.card-discovery summary').first().click();
   await noOverflow(page,'#sheetBody',game+' discovery '+width);
   if(game==='mtg'){
    const hint=page.locator('#sheet [data-rule="prowess"]').first();
    if(width>600){await hint.hover();await page.locator('#rule-hover-tip').waitFor();assert.match(await page.locator('#rule-hover-tip').innerText(),/noncreature/i);await page.keyboard.press('Escape');}
    await hint.click();await page.locator('.rule-glass').waitFor();assert.match(await page.locator('.rule-glass').innerText(),/noncreature/i);await page.locator('.rule-glass .rule-dismiss').click();
    await page.locator('.card-discovery [data-discovery-value="Legendary Creature"]').click();await page.waitForFunction(()=>window.__uiTestState.ui.db.term==='t:"legendary" t:"creature"');
    // The fixture provider has no query handler for this invented filter. A
    // source error is valid; the UI must preserve the requested search and Back.
    await page.locator('[data-act="routeHistoryBack"]').waitFor();await page.locator('[data-act="routeHistoryBack"]').click();await page.locator('#sheet[open] .card-discovery').first().waitFor();
   }else if(game==='ptcg'){
    const button=page.locator('.card-discovery [data-discovery-kind="ability"]').first();await button.click();await page.getByText(/Loaded card data only; this is not a complete catalogue search/).waitFor();assert.equal(await page.locator('#sheet[open]').count(),0);
   }else{
    const dragon=page.locator('.card-discovery [data-discovery-kind="race"]').first();await dragon.click();await page.waitForFunction(()=>window.__uiTestTcg.ui('ygo').search.f.race==='Dragon');
   }
   await page.screenshot({path:`test-results/deck-knowledge-${game}-${width}.png`,fullPage:false,animations:'allow',timeout:10000});
   // Source queries in this fixture may be deliberately unmapped; capture them
   // explicitly rather than claiming a live-provider success.
   app.health();checks.push({game,width,actualApp:true,physicalAndroid:false});
  }finally{await app.context.close();}
 }
}finally{await writeFile('test-results/deck-knowledge-browser.json',JSON.stringify({checks,scope:'Actual app with synthetic providers; source availability and physical Android are not established.'},null,2));await browser.close();await server.close();}
console.log('PASS: actual app discovery and expanded rules on phone/desktop; Magic source-card Back and explicit loaded-only Pokémon scope.');
