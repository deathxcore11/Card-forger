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
   if(width>=1200){const search=await page.locator('#desktopSearch .home-search-pill').boundingBox(),sets=await page.locator('.header-sets').boundingBox();assert(sets.x>=search.x+search.width&&Math.abs(sets.y+sets.height/2-search.y-search.height/2)<3,'Sets is beside the desktop search');}
  }
  await page.setViewportSize({width:390,height:900});
  await page.locator('.topbar [data-act="menu"]').click();await page.locator('#settingsTab-account').click();
  await page.locator('[data-act="profilePhoto"]').click();await page.locator('.profile-art-dialog').waitFor();
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
  await page.locator('[data-act="profilePhoto"]').click();await page.waitForFunction(()=>document.querySelector('[data-avatar-save]')?.disabled===false);await page.locator('[data-avatar-zoom]').fill('3');await page.keyboard.press('Escape');
  assert.deepEqual(await page.evaluate(()=>window.__uiTestState.state.settings.cardAvatar),saved,'Cancel discards crop changes');
  await page.reload();await page.locator('#app.ready').waitFor();assert.equal(await page.locator('.topbar .profile-avatar img').getAttribute('src'),saved.image,'Avatar survives reload');
  app.health();console.log('PASS: compact header, desktop Sets shortcut, all-game card lookup, mouse/keyboard crop, save/cancel/reload and unchanged inventory.');
 }catch(error){console.error(error.stack);await capture(page,'synthetic-search-profile-failure').catch(e=>console.error(e.message));throw error;}finally{await app.context.close();}
}finally{await browser.close();await server.close();}
