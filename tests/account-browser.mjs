import assert from 'node:assert/strict';
import {startServer,openSearchApp,makeSearchFixtures,CARDS,noOverflow,capture} from './search-fixtures.mjs';
import {workspaceSig} from '../cloud.js';
import {blank} from '../store.js';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Browser execution is restricted to hosted GitHub Actions.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
const art=name=>({game:'ptcg',cardId:name,name,image:`https://search-fixtures.invalid/${name}.svg`,zoom:1,x:.5,y:.5,ratio:1});
const original=makeSearchFixtures(),a=structuredClone(original.state),b=structuredClone(original.state);
a.settings.cardAvatar=art('Gengar-A');b.settings.cardAvatar=art('Mew-B');
const card=CARDS.mtg.find(c=>c.name.startsWith('Alpha fixture'));
b.collection=[{...b.collection[0],id:'B-lot',name:card.name,printingId:card.id,qty:4}];b.printings[card.id]=card;
const cloudB=structuredClone(b);cloudB.collection[0].qty=9;
a.decks=[{id:'profile-deck',name:'Profile deck',format:'Standard',cards:[{name:card.name,qty:1}],side:[]}];a.settings.binders=[{id:'profile-binder',title:'Profile binder',game:'mtg',rule:'all',color:'#7468b5'}];
const sharedCard={id:card.id,name:card.name,qty:1,image:card.image_uris.normal};
const fixture={people:{A:[{id:'C',display_name:'Incoming friend',relationship:'pending',incoming:true}]},items:{A:[{key:'deck:mtg:profile-deck',kind:'deck',game:'mtg',title:'Profile deck',cards:[sharedCard]},{key:'binder:profile-binder',kind:'binder',game:'mtg',title:'Profile binder',cards:[sharedCard]}]},user:{id:'A',email:'A@example.invalid'},profiles:{A:{display_name:'Account A',username:'account_a'},B:{display_name:'Account B',username:'account_b'}},art:{A:{avatar:art('Gengar-A')},B:{avatar:art('Mew-B')}},rows:{A:{data:a,revision:1},B:{data:cloudB,revision:2}},writes:[],storage:{'cardforge-v2':a,'cardforge-cloud-v1':{userId:'A',revision:1,sig:workspaceSig(a)},'cardstashy-workspace-v1:B':{state:b,recovery:blank(),meta:null}}};
fixture.profiles.C={display_name:'Friend C',username:'friend_c'};fixture.items.C=[{key:'deck:mtg:friend-deck',kind:'deck',game:'mtg',title:'Friend deck',format:'Modern',deckSchema:1,cards:[{...sharedCard,zone:'main',qty:2},{...sharedCard,zone:'side',qty:1}]},{key:'binder:friend-binder',kind:'binder',game:'mtg',title:'Friend binder',cards:Array.from({length:12},(_,i)=>({...sharedCard,name:i?sharedCard.name+' '+i:sharedCard.name,referenceUSD:i?null:3.5,qty:2}))}];
fixture.items.C.push({key:'deck:ygo:friend-ygo',kind:'deck',game:'ygo',title:'Friend Yu-Gi-Oh deck',format:'tcg',deckSchema:1,cards:[{id:CARDS.ygo[0].id,name:CARDS.ygo[0].name,image:CARDS.ygo[0].image,qty:3,zone:'main'}]});
const ready=async(page,id)=>page.waitForFunction(async id=>{const c=(await import('/cloud.js')).cloudInfo();return !c.switching&&(c.user?.id||null)===id;},id);
const avatar=page=>page.locator('.topbar [data-act="menu"] .profile-avatar img');
const later=async page=>{
 assert.equal(await page.locator('#sheet[open] [data-act="syncChoice"]').count(),0,'Sync conflicts do not interrupt browsing');
 await page.locator('[data-act="menu"]').click();await page.locator('[data-act="syncDecide"]').click();
 await page.locator('[data-act="syncChoice"][data-choice="later"]').click();await page.locator('[data-act="closeSettings"]').click();
 await page.waitForFunction(()=>!history.state?.cardstashySettings);
};
try{
 const app=await openSearchApp(browser,server.base,{width:390,accountFixture:fixture}),{page}=app;
 try{
  await ready(page,'A');await page.waitForFunction(()=>document.querySelector('.topbar .profile-avatar img')?.src.includes('Gengar-A'));
  await page.evaluate(async()=>{await(await import('/cloud.js')).signOut();});await ready(page,null);assert.equal(await avatar(page).count(),0);assert.equal(await page.evaluate(()=>window.__uiTestState.state.collection.length),0);
  const immediate=await page.evaluate(()=>{window.__accountFixture.switch('B');return {avatar:document.querySelector('.topbar .profile-avatar img')?.src||'',content:document.querySelector('#content').textContent};});
  assert.equal(immediate.avatar,'','old avatar disappears synchronously, before any storage or cloud response');assert.match(immediate.content,/Opening your account/);
  await ready(page,'B');await page.waitForFunction(async()=>!!(await import('/cloud.js')).cloudInfo().pending);await later(page);
  assert.match(await avatar(page).getAttribute('src'),/Mew-B/);
  await page.locator('[data-nav="collection"]:visible').first().click();await page.locator('[data-act="qty"][data-id="B-lot"][data-delta="1"]').click();
  await page.waitForFunction(()=>window.__uiTestState.state.collection[0].qty===5);
  await page.evaluate(async()=>{Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>false});await(await import('/cloud.js')).syncNow();Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true});window.dispatchEvent(new Event('online'));});
  assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.writes),[],'Later blocks edits, manual sync and reconnect uploads');
  await page.reload();await page.locator('#app.ready').waitFor();await ready(page,'B');await page.waitForFunction(async()=>!!(await import('/cloud.js')).cloudInfo().pending);await later(page);
  await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;});assert.equal(await page.evaluate(()=>window.__uiTestState.state.collection[0].qty),5);assert.match(await avatar(page).getAttribute('src'),/Mew-B/);
  await page.locator('[data-act="menu"]').click();
  assert.equal(await page.locator('.topbar #saveStatus').count(),0,'Sync status is confined to Account settings');
  assert.equal(await page.locator('#settingsDialog [data-act="syncNow"]').count(),1);
  assert.equal(await page.locator('#pfName').count(),0,'There is one player-name field');
  assert.match(await page.locator('.account-hub-identity').innerText(),/account_b/);
  await page.locator('#pfUser').evaluate(n=>n.closest('details').open=true);
  await page.locator('#pfUser').fill('player_b');await page.locator('[data-act="saveProfile"]').click();
  await page.waitForFunction(()=>document.querySelector('.account-hub-identity b')?.textContent==='player_b');
  assert.equal(await page.evaluate(()=>window.__accountFixture.model.profiles.B.display_name),'player_b');
  const underlying=await page.evaluate(()=>location.hash);
  await page.locator('[data-act="myCommunity"]').click();await page.locator('.community-dialog .community-profile-card').waitFor();
  assert.equal(await page.locator('.community-dialog h1').innerText(),'player_b');
  assert.equal(await page.evaluate(()=>location.hash),underlying,'My profile opens a popup without changing the current page');
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'.community-dialog',`my profile popup ${width}`);if([390,1440].includes(width))await capture(page,`synthetic-search-my-profile-${width}`);}
  await page.locator('[data-community-close]').click();
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'#settingsDialog',`account settings ${width}`);if([390,768,1440].includes(width))await capture(page,`synthetic-search-account-settings-${width}`);}
  await page.locator('[data-act="closeSettings"]').click();
  await page.evaluate(()=>window.__accountFixture.switch('A'));await ready(page,'A');await page.waitForFunction(()=>document.querySelector('.topbar .profile-avatar img')?.src.includes('Gengar-A'));
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.collection[0].qty),a.collection[0].qty);assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.rows.A.data),a);
  assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.writes),[]);
  const backup=await page.evaluate(async()=>{const r=await import('/storage.js');return r.readRecord('cardstashy-before-account-isolation-v1');});assert.deepEqual(backup.state.collection,a.collection,'legacy cards are preserved exactly as stored');assert.deepEqual(backup.state.settings.cardAvatar,a.settings.cardAvatar,'legacy artwork is preserved');
  await page.waitForFunction(async()=>!!(await import('/cloud.js')).cloudInfo().pending);await later(page);
  await page.evaluate(()=>{location.hash='#community';});await page.locator('.community-layout[aria-busy="false"]').waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'.community-page',`signed-in Community ${width}`);if([390,1440].includes(width))await capture(page,`synthetic-search-community-account-${width}`);}
  assert.match(await page.locator('.community-avatar-open img').getAttribute('src'),/Gengar-A/,'Community renders the current account avatar');
  assert.equal(await page.locator('[data-community-panel="friends"]').count(),1);assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.writes),[]);
  assert.equal(await page.locator('[data-community-requests]').count(),1,'Requests live in Community');
  assert.equal(await page.locator('.community-kind-section').count(),2);
  await page.locator('[data-community-share="deck"]').click();await page.locator('.community-dialog[open]').waitFor();
  assert.equal(await page.locator('[data-community-kind="deck"]').getAttribute('aria-selected'),'true');assert.equal(await page.locator('.community-share-choices [data-community-preview]').count(),1);
  await page.locator('[data-community-kind="binder"]').click();assert.equal(await page.locator('.community-share-choices [data-community-preview="binder:profile-binder"]').count(),1);
  await page.locator('[data-community-filter]').fill('no match');assert.equal(await page.locator('.community-share-choices [data-community-preview]').count(),0);await page.locator('[data-community-filter]').fill('');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'.community-dialog',`sharing picker ${width}`);if([390,1440].includes(width))await capture(page,`synthetic-search-community-sharing-${width}`);}
  await page.locator('[data-community-close]').click();assert.equal(await page.locator('.topbar [data-act="menu"] .account-notice-badge').textContent(),'1');assert.match(await page.locator('.topbar [data-act="menu"]').getAttribute('aria-label'),/1 pending friend request/);assert.equal(await page.locator('.topbar .account-count').count(),0);
  await page.locator('[data-community-panel="friends"]').click();await page.locator('[data-community-panel="add"]').click();await page.locator('[data-community-search]').waitFor();
  for(const query of ['C@example.invalid','friend_c']){
   await page.locator('[data-community-search] input').fill(query);await page.locator('[data-community-search] button').click();
   await page.waitForFunction(()=>!document.querySelector('[data-community-search] button').disabled);
   assert.match(await page.locator('[data-community-found]').innerText(),/friend_c/);
  }
  await page.locator('[data-community-close]').click();
  await page.locator('[data-community-requests]').click();await page.locator('[data-community-action="accept"]').click();await page.locator('[data-friends-content]').getByText('No pending requests.',{exact:true}).waitFor();assert.equal(await page.locator('.topbar [data-act="menu"] .account-notice-badge').count(),0);await page.locator('[data-community-close]').click();
  const ownerSnapshot=await page.evaluate(()=>JSON.stringify(window.__accountFixture.model.items.C));const myCards=await page.evaluate(()=>JSON.stringify(window.__uiTestState.state.collection));
  await page.locator('[data-community-person="C"]').click();await page.locator('[data-community-item="binder:friend-binder"]').waitFor();assert.equal(await page.locator('.community-dialog [data-community-source]').count(),0,'friend has no edit controls');
  await page.locator('[data-community-item="binder:friend-binder"]').click();await page.locator('#sheet .stash-open-book').waitFor();
  assert.equal(await page.locator('#sheet [data-act="editBinder"],#sheet .pocket-star').count(),0,'Shared binder is read-only');
  await page.locator('#sheet [aria-label="Next binder page"]').click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx.page===1);assert.equal(await page.locator('#sheet .pocket-open').count(),3);await page.locator('#sheet [aria-label="Previous binder page"]').click();await page.waitForFunction(()=>window.__uiTestState.ui.sheetCtx.page===0);assert.equal(await page.locator('#sheet .pocket-open').count(),9);
  assert.match(await page.locator('#sheet .community-binder-value').innerText(),/\$7.00/);
  await page.locator('#sheet .stash-open-book').evaluate(async n=>{await Promise.all(n.getAnimations({subtree:true}).filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));});
  await page.screenshot({path:'test-results/synthetic-search-shared-binder.png',fullPage:false});
  await page.locator('#sheet .pocket-open').first().click();await page.locator('#sheet .cs-card').waitFor();await page.locator('[data-act="sheetHistoryBack"]').click();await page.locator('#sheet .stash-open-book').waitFor();
  await page.locator('#sheet [data-act="closeSheet"]').first().click();
  await page.locator('[data-community-item="deck:mtg:friend-deck"]').click();
  for(const width of [320,390,673,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#sheetBody','shared deck '+width);await page.locator('#sheet [data-act="provenSave"]').scrollIntoViewIfNeeded();const button=await page.locator('#sheet [data-act="provenSave"]').boundingBox();assert(button.height<100,'Save button never stretches into a column');if([390,1440].includes(width))await capture(page,'synthetic-search-shared-deck-'+width);}
  await page.locator('#sheet [data-act="sharedCard"]').first().click();await page.locator('#sheet .cs-card').waitFor();await page.locator('[data-act="sheetHistoryBack"]').click();await page.locator('#sheet [data-act="provenSave"]').click();
  await page.waitForFunction(()=>window.__uiTestState.state.decks.some(d=>d.name==='Friend deck'));
  const copy=await page.evaluate(()=>window.__uiTestState.state.decks.find(d=>d.name==='Friend deck'));assert(copy&&copy.id!=='friend-deck');assert.equal(copy.cards[0].qty,2);assert.equal(copy.side[0].qty,1);assert.equal(copy.format,'Modern');assert.equal(await page.evaluate(()=>JSON.stringify(window.__accountFixture.model.items.C)),ownerSnapshot);assert.equal(await page.evaluate(()=>JSON.stringify(window.__uiTestState.state.collection)),myCards);assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.writes),[],'saving a shared copy respects paused sync');
  await page.locator('#sheet [data-act="closeSheet"]').first().click();await page.locator('[data-community-item="deck:ygo:friend-ygo"]').click();await page.waitForFunction(()=>document.body.dataset.game==='ygo'&&document.querySelector('#sheet[open] .shared-deck-section'));
  await page.locator('#sheet [data-act="sharedCard"]').first().click();await page.locator('#sheet .cs-card').waitFor();await page.locator('[data-act="sheetHistoryBack"]').click();await page.locator('#sheet [data-act="closeSheet"]').first().click();assert.equal(await page.locator('.community-dialog[open]').count(),1,'Cross-game deck returns to the player popup');await page.locator('[data-community-close]').click();
  await page.locator('[data-act="menu"]').click();await page.locator('[data-act="myCommunity"]').click();await page.locator('.community-dialog[open] [data-community-item="deck:mtg:profile-deck"]').click();await page.waitForFunction(()=>document.body.dataset.game==='mtg'&&document.querySelector('#sheet[open] .shared-deck-section'));assert.equal(await page.locator('#settingsDialog[open]').count(),0,'Cross-game profile navigation closes the Account layer');assert.equal(await page.evaluate(()=>!!history.state?.cardstashySettings),false);await page.locator('#sheet [data-act="closeSheet"]').first().click();assert.equal(await page.locator('.community-dialog[open]').count(),1);
  app.health();console.log('PASS: browser A → sign out → B, immediate avatar clearing, paused edit/reload/offline/reconnect, account restore, preserved backup and 320–1440px settings');
 }catch(error){await capture(page,"synthetic-search-account-failure",{settle:false});throw error;}finally{await app.context.close();}
 // Independent clean browser contexts cannot inherit the first device's art.
 for(const id of ['A','B']){
  const clean={...structuredClone(fixture),user:{id,email:id+'@example.invalid'},storage:{'cardforge-v2':blank()},writes:[]};
  const app=await openSearchApp(browser,server.base,{accountFixture:clean,width:768});
  try{await ready(app.page,id);await app.page.waitForFunction(name=>document.querySelector('.topbar .profile-avatar img')?.src.includes(name),id==='A'?'Gengar-A':'Mew-B');assert.equal(await app.page.evaluate(()=>window.__uiTestState.state.collection[0].qty),id==='A'?5:9);app.health();}finally{await app.context.close();}
 }
 console.log('PASS: two clean browser sessions load their own cloud workspace and avatar');
}finally{await browser.close();await server.close();}
