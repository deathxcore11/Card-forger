import assert from 'node:assert/strict';
import {startServer,openSearchApp,CARDS,PRINT_IDS,noOverflow,capture,inventorySnapshot} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
try{
 for(const game of ['mtg','ptcg','ygo']){
  const app=await openSearchApp(browser,server.base,{game,width:390}),{page}=app;
  try{
   const before=await inventorySnapshot(page),card=CARDS[game].find(c=>c.id===PRINT_IDS[game]);
   await page.evaluate(({game,card})=>{const b=document.createElement('button');b.id='qa-open-card';b.textContent='Open fixture card';Object.assign(b.dataset,{act:game==='mtg'?'card':'tCard',name:card.name,id:card.id});document.body.append(b);},{game,card});
   await page.locator('#qa-open-card').click();
   for(const width of [320,390,768,1440]){
    await page.setViewportSize({width,height:1000});await page.locator('.cs-card').waitFor();
    const layout=await page.locator('.cs-card').evaluate(root=>{const art=root.querySelector('.cd-art-stack').getBoundingClientRect(),side=root.querySelector('.cs-card-side').getBoundingClientRect(),panel=root.closest('.cs-panel');return {width:panel.clientWidth,columns:getComputedStyle(root).gridTemplateColumns.split(' ').length,art:art.toJSON(),side:side.toJSON(),actions:!!root.querySelector('.cs-card-side .card-actions')};});
    assert(layout.actions,'Ownership and actions stay beside the full card');assert.equal(layout.columns,layout.width<=600?1:2);assert(layout.width<=600?layout.side.top>=layout.art.bottom:layout.side.left>=layout.art.right);await noOverflow(page,'#sheetBody',`${game} Overview ${width}`);
    await page.locator('.cs-card').scrollIntoViewIfNeeded();await capture(page,`synthetic-overview-${game}-${width}`);
   }
   assert.equal(await page.locator('.cs-tabs [role="tab"]').count(),6);assert.equal(await page.locator('#card-tab-legal').count(),0);await page.locator('#card-tab-rulings').click();await page.locator('#card-panel-rulings h3').filter({hasText:'Format legality'}).waitFor();assert(await page.locator('#card-panel-rulings h3').filter({hasText:'Official rulings'}).isVisible());
   await page.locator('#card-tab-versions').click();
   await page.locator(`#card-panel-versions [data-act="${game==='mtg'?'magicPrintings':'tOtherPrintings'}"]`).first().click();
   await page.locator('.printing-carousel[aria-busy="false"]').waitFor();
   await page.waitForFunction(()=>!document.querySelector('[data-act="printingPickerMore"]'));
   assert((await page.locator('.printing-slide').count())>1);
   const center=()=>page.locator('.printing-carousel').evaluate(rail=>{const a=rail.getBoundingClientRect(),b=rail.querySelector('.is-current').getBoundingClientRect();return Math.abs((a.left+a.right)/2-(b.left+b.right)/2);});
   for(const width of [320,390,768,1024,1440,390]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    await noOverflow(page,'.printing-picker-controls',`${game} carousel controls ${width}`);assert(await center()<3,'selected card stays centered through fold/resize');
    if([390,768,1440].includes(width))await capture(page,`synthetic-carousel-${game}-${width}`);
   }
   await page.locator('[data-act="printingPickerStep"][data-d="1"]').click();await page.waitForFunction(()=>document.querySelector('[data-printing-position]').textContent.startsWith('2 /'));
   await page.locator('.printing-carousel').focus();await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('[data-printing-position]').textContent.startsWith('1 /'));
   await page.locator('#printingPickerNumber').fill('no-such-number');await page.getByText('No matching printings',{exact:true}).waitFor();await page.locator('[data-act="printingPickerClear"]').first().click();
   await page.locator('[data-act="printingPickerCancel"]').click();await page.locator('#card-tab-overview').click();await page.locator('[data-act="cardProfilePhoto"]').click();await page.locator('.profile-crop').waitFor();
   await page.locator('[data-avatar-zoom]').fill('2');await page.locator('[data-avatar-save]:enabled').waitFor();
   await page.locator('[data-avatar-close]').click();await page.keyboard.press('Escape');
   await page.locator('[data-nav="community"]:visible').first().click();
   for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'.community-page',`${game} Community ${width}`);}
   assert.equal(await page.getByRole('button',{name:/Showcase.*Coming soon/}).isEnabled(),false);assert.equal(await page.getByRole('button',{name:/Deck discussions.*Coming soon/}).isEnabled(),false);
   assert.equal(await inventorySnapshot(page),before,'browsing, filtering, crop cancel and Community never change ownership');app.health();
   console.log(`PASS: ${game} default carousel, full pages, keyboard/snap/resize, direct avatar crop and responsive Community`);
  }finally{await app.context.close();}
 }
}finally{await browser.close();await server.close();}
