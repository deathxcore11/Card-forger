// Exact synthetic data through the real app. Browser execution is hosted only.
import assert from 'node:assert/strict';
import {startServer,openSearchApp,noOverflow,capture,inventorySnapshot} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch({headless:true});
const demoImages=['https://api.scryfall.com/cards/named?exact=Sol%20Ring&format=image&version=normal','https://assets.tcgdex.net/en/base/base1/4/high.webp','https://images.ygoprodeck.com/images/cards/89631139.jpg'];
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="630" height="880"><rect width="630" height="880" fill="#214957"/><text x="20" y="80" fill="white" font-size="26">SYNTHETIC DEMO ART</text></svg>';
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390,height:1000,sandboxPreviews:true}),{page}=app;
  try{
   await page.route('https://api.scryfall.com/cards/named?exact=*&format=image&version=art_crop',route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
   for(const url of demoImages)await page.route(url,route=>route.fulfill({contentType:'image/svg+xml',body:svg}));
   const original=await inventorySnapshot(page);
   await page.locator('.brand-home').click();await page.waitForFunction(()=>document.body.dataset.view==='home');
   assert.equal(await page.locator('[data-nav="home"]').count(),1);assert.equal(await page.locator('.brand-home').getAttribute('aria-current'),'page');
   assert.deepEqual(await page.locator('.bottom-nav [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.dataset.nav)),['play','collection','search','decks','scan']);
   assert.equal(await page.locator('[data-nav="community"]').count(),0,'Profile and friends open from the avatar');
   for(const width of [320,390,768,1024,1440,2560,390]){
    await page.setViewportSize({width,height:1000});await page.waitForFunction(w=>document.querySelector('#homeQ')?.closest(w>=1200?'#desktopSearch':'#homeSearchDock'),width);
    assert.equal(await page.locator('#homeQ').count(),1);await page.locator('#homeQ').fill('Alpha');
    await page.waitForFunction(()=>document.querySelectorAll('[data-home-pick]').length>0);
    await noOverflow(page,'#homeSearchPopup',`${game} suggestions at ${width}`);
    const first=await page.locator('[data-home-pick]').first().innerText();assert.match(first,/Alpha/);
    await page.locator('#homeQ').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.locator('#homeQ').getAttribute('aria-activedescendant'),'home-result-0');
    await page.keyboard.press('Escape');assert.equal(await page.locator('#homeSearchPopup').count(),0);
    await noOverflow(page,'.topbar',`${game} header at ${width}`);
    if([390,1440].includes(width))await capture(page,`synthetic-search-guide-home-${game}-${width}`);
   }
   // A live fold keeps the same draft and moves the single input to the header.
   await page.locator('#homeQ').fill('Alpha fixture');await page.setViewportSize({width:1440,height:1000});assert.equal(await page.locator('#homeQ').inputValue(),'Alpha fixture');await page.keyboard.press('Escape');
   await page.locator('.top-nav [data-nav="collection"]').click();await page.waitForFunction(()=>document.body.dataset.view==='collection'&&!document.querySelector('#content').inert);assert(await page.locator('#desktopSearch #homeQ').isVisible());
   // Sample guide manual steps actually change controls and show a receipt.
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-info').click();
   await page.locator('#infoQuery').fill('conditions');await page.locator('#info-collection summary').click();await page.locator('#info-collection [data-lesson="save"]').click();
   const tour=page.locator('.action-tour');await tour.waitFor();const guideHistory=await page.evaluate(()=>history.length);assert.equal(await tour.getAttribute('data-frame'),'0');
   for(let n=1;n<5;n++){
    await tour.locator('[data-tour="frame"]').click();assert.equal(await tour.getAttribute('data-frame'),String(n));
    // The iframe is replaced on every action. Keep the bounded wait in Node,
    // reacquiring the current frame and reading only synchronous values inside it.
    // An iframe-owned load/fonts/rAF promise can disappear with its old window.
    const deadline=Date.now()+5000;let fit={ready:false},last='',stable=0;
    while(Date.now()<deadline){
     try{
      const measured=await page.frameLocator('.action-tour iframe').locator('.demo-main').evaluate(node=>{
       const doc=node.ownerDocument;
       return {state:doc.readyState,fonts:doc.fonts.status,scrollHeight:node.scrollHeight,clientHeight:node.clientHeight,scrollWidth:node.scrollWidth,clientWidth:node.clientWidth};
      },undefined,{timeout:Math.max(1,Math.min(500,deadline-Date.now()))});
      const key=JSON.stringify(measured);stable=measured.state==='complete'&&measured.fonts==='loaded'?(key===last?stable+1:1):0;last=key;
      fit={...measured,ready:stable>=2};if(fit.ready)break;
     }catch(error){
      if(!/Execution context was destroyed|frame.*detached|Failed to find frame|Cannot find context|Resulting promise was garbage collected|Timeout/i.test(String(error)))throw error;
      fit={ready:false,lastFrameError:String(error)};stable=0;last='';
     }
     await new Promise(resolve=>setTimeout(resolve,Math.min(50,Math.max(0,deadline-Date.now()))));
    }
    assert.equal(await tour.getAttribute('data-frame'),String(n),'the measured scene must remain the requested action');
    assert(fit.ready,game+' sample action '+n+' preview resources must load: '+JSON.stringify(fit));
    assert(fit.scrollHeight<=fit.clientHeight+2&&fit.scrollWidth<=fit.clientWidth+2,game+' sample action '+n+' must fit the preview: '+JSON.stringify(fit));
   }
   assert.equal(await page.evaluate(()=>history.length),guideHistory,'Demo playback must not create browser history entries');
   const iframe=page.frameLocator('.action-tour iframe');assert.match(await iframe.locator('.demo-receipt').innerText(),/Added 2 copies/);assert.match(await iframe.locator('.demo-receipt').innerText(),/Lightly Played/);
   await tour.locator('[data-tour="replay"]').click();assert.equal(await tour.getAttribute('data-frame'),'0');
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'.action-tour .tour-card',`${game} guide ${width}`);}
   await capture(page,`synthetic-search-guide-action-${game}`);await page.keyboard.press('Escape');assert(await page.locator('#settingsDialog').isVisible());
   await page.locator('#settingsTab-app').click();await page.locator('[data-act="resetOnboarding"]').click();await page.locator('.cf-dialog button[value="ok"]').click();await page.waitForFunction(()=>!localStorage.getItem('cardstashy-tour-v1'));
   await page.evaluate(()=>{window.__settingsTrace=[];for(const kind of ['popstate','hashchange','pointerdown','pointerup','click'])window.addEventListener(kind,e=>window.__settingsTrace.push({kind,act:e.target.closest?.('[data-act]')?.dataset.act,tag:e.target.tagName,open:document.querySelector('#settingsDialog')?.open,state:history.state}),true);});
   await page.locator('[data-act="closeSettings"]').click();assert.equal(await page.locator('.action-tour').count(),0,'reset defers introduction while away from Home');
   assert.equal(await inventorySnapshot(page),original);await page.evaluate(()=>localStorage.setItem('cardstashy-tour-v1','done'));
   // Open tabletop without leaving the collection. Independent simultaneous seats.
   await page.locator('[data-act="menu"]').click();await page.locator('#settingsTab-info').click();await page.locator('#infoQuery').fill('tabletop');await page.locator('#info-tabletop summary').click();await page.locator('#info-tabletop [data-act="infoGo"]').click();
   const chosenTheme={mtg:'G',ptcg:'Grass',ygo:'LIGHT'}[game];await page.locator('[data-setup-theme="0"]').selectOption(chosenTheme);
   await capture(page,`synthetic-search-tabletop-setup-${game}`);await page.locator('[data-table="start"]').click();assert.equal(await page.locator('[data-theme-seat="0"]').inputValue(),chosenTheme);const field=game==='ptcg'?'pokemon:0:damage':'life';
   await page.setViewportSize({width:1440,height:1200});
   const touches=await page.locator('.tabletop-dialog').evaluate((root,field)=>[0,1].map(id=>{const b=root.querySelector(`button[data-seat="${id}"][data-field="${field}"][data-table-delta${field.startsWith('pokemon:')?'="10"':''}]`),r=b.getBoundingClientRect();if(r.top<0||r.bottom>innerHeight)throw Error('Both seats must be visible for real simultaneous touch');return {id:id+1,x:r.x+r.width/2,y:r.y+r.height/2};}),field);
   const touchSession=await app.context.newCDPSession(page);await touchSession.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await touchSession.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touchSession.detach();
   const outputs=await page.locator(`[data-table-output$=":${field}"]`).allTextContents();assert.deepEqual(outputs.map(Number),game==='mtg'?[19,19]:game==='ygo'?[7500,7500]:[10,10]);
   await page.locator('[data-table-undo="0"]').click();assert.equal(await page.locator(`[data-table-output="0:${field}"]`).innerText(),game==='mtg'?'20':game==='ygo'?'8000':'0');
   assert.equal(await page.locator(`[data-table-output="1:${field}"]`).innerText(),game==='mtg'?'19':game==='ygo'?'7500':'10');
   const beforeTheme=await page.locator('[data-table-output]').allTextContents(),otherTheme=await page.locator('[data-theme-seat="1"]').inputValue();await page.locator('[data-theme-seat="0"]').selectOption({mtg:'R',ptcg:'Psychic',ygo:'EARTH'}[game]);assert.deepEqual(await page.locator('[data-table-output]').allTextContents(),beforeTheme);assert.equal(await page.locator('[data-theme-seat="1"]').inputValue(),otherTheme);
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'.tabletop-dialog',`${game} tabletop ${width}`);if([390,1440].includes(width))await capture(page,`synthetic-search-tabletop-${game}-${width}`);}
   await capture(page,`synthetic-search-tabletop-${game}`);await page.locator('[data-table="new"]').click();await page.locator('.cf-dialog button[value="cancel"]').click();assert(await page.locator('.table-seats').isVisible());
   await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal(await inventorySnapshot(page),original);app.health();console.log(`PASS: ${game} responsive single Home/search, accepted-friends Community, real demo state changes, safe reset, independent tabletop and no inventory mutation`);
  }catch(error){try{app.health();}catch(health){error.message+='\n'+health.stack;}console.error('Guide failure context',JSON.stringify(await page.evaluate(()=>({view:document.body.dataset.view,sheet:window.__uiTestState.ui.sheetCtx,settings:document.querySelector('#settingsDialog')?.open,toast:document.querySelector('#toast')?.textContent,events:window.__settingsTrace})),null,2));await capture(page,`synthetic-search-guide-failure-${game}`);throw error;}finally{await app.context.close();}
 }
}finally{await browser.close();await server.close();}
