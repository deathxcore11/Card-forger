// Exact synthetic data through the real app. Browser execution is hosted only.
import assert from 'node:assert/strict';
import {startServer,openSearchApp,noOverflow,capture,inventorySnapshot} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch({headless:true});
const demoImages=['https://api.scryfall.com/cards/named?exact=Sol%20Ring&format=image&version=normal','https://assets.tcgdex.net/en/base/base1/4/high.webp','https://images.ygoprodeck.com/images/cards/89631139.jpg'];
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#214957"/><text x="20" y="80" fill="white" font-size="26">SYNTHETIC DEMO ART</text></svg>';
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390,height:1000}),{page}=app;
  try{
   for(const url of demoImages)await page.route(url,route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
   const original=await inventorySnapshot(page);
   await page.locator('.brand-home').click();await page.waitForFunction(()=>document.body.dataset.view==='home');
   assert.equal(await page.locator('[data-nav="home"]').count(),1);assert.equal(await page.locator('.brand-home').getAttribute('aria-current'),'page');
   assert.deepEqual(await page.locator('.bottom-nav [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.dataset.nav)),['community','collection','search','decks','scan']);
   assert(await page.locator('.bottom-nav [data-nav="community"]').isDisabled());
   for(const width of [320,390,768,1024,1440,2560,390]){
    await page.setViewportSize({width,height:1000});await page.waitForFunction(w=>document.querySelector('#homeQ')?.closest(w>=1200?'#desktopSearch':'#homeSearchDock'),width);
    assert.equal(await page.locator('#homeQ').count(),1);await page.locator('#homeQ').fill('Alpha');
    await page.waitForFunction(()=>document.querySelectorAll('[data-home-pick]').length>0);
    await noOverflow(page,'#homeSearchPopup',`${game} suggestions at ${width}`);
    const first=await page.locator('[data-home-pick]').first().innerText();assert.match(first,/Alpha/);
    await page.locator('#homeQ').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#homeQ').getAttribute('aria-activedescendant'),'home-result-0');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#homeSearchPopup').count(),0);
    await noOverflow(page,'.topbar',`${game} header at ${width}`);
    if([390,1440].includes(width))await capture(page,`guide-home-${game}-${width}`);
   }
   // A live fold keeps the same draft and moves the single input to the header.
   await page.locator('#homeQ').fill('Alpha fixture');await page.setViewportSize({width:1440,height:1000});assert.equal(await page.locator('#homeQ').inputValue(),'Alpha fixture');await page.keyboard.press('Escape');
   await page.locator('.top-nav [data-nav="collection"]').click();assert(await page.locator('#desktopSearch #homeQ').isVisible());
   // Sample guide manual steps actually change controls and show a receipt.
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-info').click();
   await page.locator('#infoQuery').fill('conditions');await page.locator('#info-collection summary').click();await page.locator('#info-collection [data-lesson="save"]').click();
   const tour=page.locator('.action-tour');await tour.waitFor();assert.equal(await tour.getAttribute('data-frame'),'0');
   for(let n=1;n<5;n++){await tour.locator('[data-tour="frame"]').click();assert.equal(await tour.getAttribute('data-frame'),String(n));}
   const iframe=page.frameLocator('.action-tour iframe');assert.match(await iframe.locator('.demo-receipt').innerText(),/Added 2 copies/);assert.match(await iframe.locator('.demo-receipt').innerText(),/Lightly Played/);
   await tour.locator('[data-tour="replay"]').click();assert.equal(await tour.getAttribute('data-frame'),'0');
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'.action-tour .tour-card',`${game} guide ${width}`);}
   await capture(page,`guide-action-${game}`);await page.keyboard.press('Escape');assert(await page.locator('#settingsDialog').isVisible());
   await page.locator('#settingsTab-app').click();await page.locator('[data-act="resetOnboarding"]').click();await page.locator('.cf-dialog button[value="ok"]').click();await page.waitForFunction(()=>!localStorage.getItem('cardstashy-tour-v1'));
   await page.locator('[data-act="closeSettings"]').click();assert.equal(await page.locator('.action-tour').count(),0,'reset defers introduction while away from Home');
   assert.equal(await inventorySnapshot(page),original);await page.evaluate(()=>localStorage.setItem('cardstashy-tour-v1','done'));
   // Open tabletop without leaving the collection. Independent simultaneous seats.
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-info').click();await page.locator('#infoQuery').fill('tabletop');await page.locator('#info-tabletop summary').click();await page.locator('#info-tabletop [data-act="infoGo"]').click();
   await page.locator('[data-table="start"]').click();const field=game==='ptcg'?'pokemon:0:damage':'life';
   await page.locator('.tabletop-dialog').evaluate((root,field)=>{const targets=[0,1].map(id=>root.querySelector(`button[data-seat="${id}"][data-field="${field}"][data-table-delta]`));for(const [i,b]of targets.entries())b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:i+11,pointerType:'touch',clientX:50,clientY:50}));for(const [i,b]of targets.entries())b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,cancelable:true,pointerId:i+11,pointerType:'touch',clientX:50,clientY:50}));},field);
   const outputs=await page.locator(`[data-table-output$=":${field}"]`).allTextContents();if(game!=='ptcg')assert.equal(Number(outputs[0]),game==='mtg'?19:7500);
   // Positive Pokémon damage, because zero damage cannot be decremented.
   if(game==='ptcg')await page.locator('[data-seat="0"][data-field="pokemon:0:damage"][data-table-delta="10"]').click();
   await page.locator('[data-table-undo="0"]').click();assert.equal(await page.locator(`[data-table-output="0:${field}"]`).innerText(),game==='mtg'?'20':game==='ygo'?'8000':'0');
   if(game!=='ptcg')assert.equal(await page.locator(`[data-table-output="1:${field}"]`).innerText(),game==='mtg'?'19':'7500');
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'.tabletop-dialog',`${game} tabletop ${width}`);}
   await capture(page,`tabletop-${game}`);await page.locator('[data-table="new"]').click();await page.locator('.cf-dialog button[value="cancel"]').click();assert(await page.locator('.table-seats').isVisible());
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal(await inventorySnapshot(page),original);app.health();console.log(`PASS: ${game} responsive single Home/search, disabled Community, real demo state changes, safe reset, independent tabletop and no inventory mutation`);
  }finally{await app.context.close();}
 }
}finally{await browser.close();await server.close();}
