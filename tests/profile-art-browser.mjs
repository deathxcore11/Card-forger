import assert from 'node:assert/strict';
import {startServer,openSearchApp,noOverflow,capture,inventorySnapshot} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
try{
 const app=await openSearchApp(browser,server.base,{game:'mtg',width:390,height:900}),{page}=app;
 try{
  const before=await inventorySnapshot(page);
  await page.locator('.brand-home').click();
  for(const width of [320,390,600,768,1024,1200,1440,2560]){
   await page.setViewportSize({width,height:900});await noOverflow(page,'.topbar','Profile header '+width);
   const geometry=await page.locator('.topbar').evaluate(root=>['.brand-home','#gameTabs','[data-act="menu"]'].map(s=>{const r=root.querySelector(s).getBoundingClientRect();return {y:r.y+r.height/2,height:r.height};}));
   assert(Math.max(...geometry.map(r=>r.y))-Math.min(...geometry.map(r=>r.y))<3,'Home, games and profile occupy one row at '+width);
   if(width>=1200){const rail=page.locator('#desktopSearch'),setsButton=rail.getByRole('button',{name:'Browse sets',exact:true}),wikiButton=rail.getByRole('button',{name:'Open Wiki',exact:true});assert.equal(await setsButton.count(),1);assert.equal(await wikiButton.count(),1);const search=await rail.locator('.home-search-pill').boundingBox(),sets=await setsButton.boundingBox(),wiki=await wikiButton.boundingBox();assert(sets.x>=search.x+search.width&&Math.abs(sets.y+sets.height/2-search.y-search.height/2)<3,'Sets is beside the desktop search');assert(wiki.x>=sets.x+sets.width&&Math.abs(wiki.y+wiki.height/2-sets.y-sets.height/2)<3,'Wiki is beside Sets in the same desktop search rail');assert(Math.abs(wiki.height-sets.height)<3,'Wiki reuses the existing shortcut pill size');}
  }
  await page.setViewportSize({width:390,height:900});
  await page.locator('.topbar [data-act="menu"]').click();await page.locator('#settingsTab-account').click();
  await page.locator('.profile-photo-control[data-act="profilePhoto"]').click();await page.locator('.profile-art-dialog').waitFor();
  for(const game of ['mtg','ptcg','ygo']){
   const select=page.locator('[data-avatar-game]');await select.click();await page.locator('.glass-select-menu[open]').getByRole('option',{name:{mtg:'Magic: The Gathering',ptcg:'Pokémon',ygo:'Yu-Gi-Oh!'}[game],exact:true}).click();
   await page.locator('[data-avatar-query]').fill('Alpha');await page.locator('[data-avatar-pick]').first().waitFor();
   await page.locator('[data-avatar-pick]').first().click();await page.waitForFunction(()=>document.querySelector('[data-avatar-save]')?.disabled===false);
   assert.equal(await page.evaluate(()=>document.body.dataset.game),'mtg','Art choice never switches the workspace game');
   await page.locator('[data-avatar-zoom]').fill('2');
   const circle=page.locator('[data-avatar-crop]'),beforeStyle=await circle.locator('img').getAttribute('style');
   await circle.focus();await page.keyboard.press('ArrowRight');assert.notEqual(await circle.locator('img').getAttribute('style'),beforeStyle,'Keyboard pans the crop');
   const r=await circle.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+28,r.y+r.height/2+18,{steps:4});await page.mouse.up();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'.profile-art-dialog','Profile crop '+width);}
   await capture(page,'synthetic-search-profile-crop-'+game);
   if(game!=='ygo')await page.locator('[data-avatar-back]').click();
  }
  await page.locator('[data-avatar-save]').click();await page.waitForFunction(()=>!document.querySelector('.profile-art-dialog'));
  const saved=await page.evaluate(()=>window.__uiTestState.state.settings.cardAvatar);assert.equal(saved.game,'ygo');assert.equal(saved.zoom,2);assert(saved.image);
  assert.equal(await page.locator('.topbar .profile-avatar img').getAttribute('src'),saved.image);
  assert.equal(await inventorySnapshot(page),before,'Changing profile art never edits cards or decks');
  await page.locator('.profile-photo-control[data-act="profilePhoto"]').click();await page.waitForFunction(()=>document.querySelector('[data-avatar-save]')?.disabled===false);await page.locator('[data-avatar-zoom]').fill('3');await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(()=>window.__uiTestState.state.settings.cardAvatar),saved,'Cancel discards crop changes');
  await page.reload();await page.locator('#app.ready').waitFor();assert.equal(await page.locator('.topbar .profile-avatar img').getAttribute('src'),saved.image,'Avatar survives reload');
  app.health();console.log('PASS: compact header, desktop Sets shortcut, all-game card lookup, mouse/keyboard crop, save/cancel/reload and unchanged inventory.');
 }catch(error){console.error(error.stack);await capture(page,'synthetic-search-profile-failure').catch(e=>console.error(e.message));throw error;}finally{await app.context.close();}
 // Open from the actual card and art viewer in each game; no search in the picker.
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390,height:844}),{page}=app;
  try{
   const before=await inventorySnapshot(page),query=page.locator(game==='mtg'?'#dbTerm':'[data-input="tQ"]');
   await query.fill('Alpha');await query.press('Enter');
   const tile=page.locator('#content .card-grid > .grid-card').first();await tile.waitFor();await tile.click();
   const direct=page.locator('#sheet [data-act="cardProfilePhoto"]');await direct.waitFor();
   const cardName=await page.locator('#sheet h2').first().innerText();
   await direct.click();await page.waitForFunction(()=>document.querySelector('[data-avatar-save]')?.disabled===false);
   assert.equal(await page.locator('[data-avatar-query]').count(),0,'Direct artwork skips card search');
   assert.equal(await page.locator('.profile-art-name').innerText(),cardName);
   await page.locator('[data-avatar-zoom]').fill('1.5');await page.locator('[data-avatar-save]').click();
   await page.waitForFunction(()=>!document.querySelector('.profile-art-dialog'));
   const saved=await page.evaluate(()=>window.__uiTestState.state.settings.cardAvatar);assert.equal(saved.game,game);assert.equal(saved.zoom,1.5);
   await page.locator('#sheet [data-act="zoomCard"]').click();
   await page.waitForFunction(()=>{const i=document.querySelector('dialog.zoom img');return i?.complete&&i.naturalWidth;});
   if(game!=='ptcg')await page.locator('[data-z="view"][data-i="1"]').click();
   await page.waitForFunction(()=>{const i=document.querySelector('dialog.zoom img');return i?.complete&&i.naturalWidth;});
   assert.equal(await page.locator('[data-z="profile"]').count(),0,'Full-screen viewer has no duplicate profile action');
   await page.locator('[data-z="close"]').click();
   await direct.click();await page.waitForFunction(()=>document.querySelector('[data-avatar-save]')?.disabled===false);
   await page.locator('[data-avatar-zoom]').fill('1.5');
   // Two real browser pointer streams drive pinch zoom through the crop handlers.
   const crop=page.locator('[data-avatar-crop]'),r=await crop.boundingBox(),cx=r.x+r.width/2,cy=r.y+r.height/2;
   const cdp=await app.context.newCDPSession(page);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:0,x:cx-30,y:cy},{id:1,x:cx+30,y:cy}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:0,x:cx-60,y:cy},{id:1,x:cx+60,y:cy}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   assert(Number(await page.locator('[data-avatar-zoom]').inputValue())>1.5,'Pinch zoom enlarges the image');
   for(const size of [{width:320,height:568},{width:768,height:900}]){await page.setViewportSize(size);await noOverflow(page,'.profile-art-dialog','Direct profile crop '+game);await page.locator('[data-avatar-save]').scrollIntoViewIfNeeded();const b=await page.locator('[data-avatar-save]').boundingBox();assert(b.y>=0&&b.y+b.height<=size.height,'Save is reachable on short phones and tablets');}
   await capture(page,'synthetic-search-direct-profile-'+game);
   await page.keyboard.press('Escape');assert.deepEqual(await page.evaluate(()=>window.__uiTestState.state.settings.cardAvatar),saved,'Cancel preserves the saved profile');
   assert.equal(await inventorySnapshot(page),before,'Direct profile flow does not modify inventory or decks');app.health();
  }catch(error){await capture(page,'synthetic-search-direct-profile-failed-'+game).catch(()=>{});throw error;}finally{await app.context.close();}
 }
 console.log('PASS: all-game card detail profile shortcut and distraction-free Art viewer, pinch zoom, small-screen Save, cancel and unchanged inventory.');
}finally{await browser.close();await server.close();}
