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
const fixture={user:{id:'A',email:'A@example.invalid'},profiles:{A:{display_name:'Account A',username:'account_a'},B:{display_name:'Account B',username:'account_b'}},art:{A:{avatar:art('Gengar-A')},B:{avatar:art('Mew-B')}},rows:{A:{data:a,revision:1},B:{data:cloudB,revision:2}},writes:[],storage:{'cardforge-v2':a,'cardforge-cloud-v1':{userId:'A',revision:1,sig:workspaceSig(a)},'cardstashy-workspace-v1:B':{state:b,recovery:blank(),meta:null}}};
const ready=async(page,id)=>page.waitForFunction(async id=>{const c=(await import('/cloud.js')).cloudInfo();return !c.switching&&(c.user?.id||null)===id;},id);
const avatar=page=>page.locator('.topbar [data-act="menu"] .profile-avatar img');
const later=async page=>{await page.locator('[data-act="syncChoice"][data-choice="later"]').click();};
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
  for(const width of [320,390,768,1024,1440]){await page.setViewportSize({width,height:900});await noOverflow(page,'#settingsDialog',`account settings ${width}`);if([390,768,1440].includes(width))await capture(page,`synthetic-search-account-settings-${width}`);}
  await page.locator('[data-act="closeSettings"]').click();
  await page.evaluate(()=>window.__accountFixture.switch('A'));await ready(page,'A');await page.waitForFunction(()=>document.querySelector('.topbar .profile-avatar img')?.src.includes('Gengar-A'));
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.collection[0].qty),a.collection[0].qty);assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.rows.A.data),a);
  assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.writes),[]);
  const backup=await page.evaluate(async()=>{const r=await import('/storage.js');return r.readRecord('cardstashy-before-account-isolation-v1');});assert.deepEqual(backup.state.collection,a.collection.map(e=>({...e,raw:{}})),'legacy cards are preserved separately');assert.deepEqual(backup.state.settings.cardAvatar,a.settings.cardAvatar,'legacy artwork is preserved');
  await page.locator('[data-nav="community"]:visible').first().click();await page.locator('.community-layout[aria-busy="false"]').waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await noOverflow(page,'.community-page',`signed-in Community ${width}`);if([390,1440].includes(width))await capture(page,`synthetic-search-community-account-${width}`);}
  assert.match(await page.locator('.community-avatar-open img').getAttribute('src'),/Gengar-A/,'Community renders the current account avatar');
  assert.equal(await page.locator('[data-community-add]').count(),1);assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.writes),[]);
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
