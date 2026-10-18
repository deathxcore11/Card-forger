import assert from 'node:assert/strict';
import {startServer,openSearchApp,makeSearchFixtures,capture} from './search-fixtures.mjs';
if(process.env.GITHUB_ACTIONS!=='true')throw Error('Hosted browser QA only.');
const {chromium}=await import('playwright'),server=await startServer(),browser=await chromium.launch();
try{
 // Two actual browser tabs, shared IndexedDB, independently loaded owner/revision guards.
 const context=await browser.newContext(),a=await context.newPage(),b=await context.newPage();
 try{
  await context.route(server.base+'/qa-tabs',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Isolated tab storage test</title>'}));
  for(const page of [a,b]){await page.goto(server.base+'/qa-tabs');await page.evaluate(async()=>{
   const {readRecord,writeRecords,writeRecord}=await import('/storage.js'),{createAccountWorkspaces}=await import('/account-workspaces.js');
   let state={collection:[],decks:[],settings:{}};const vault=createAccountWorkspaces({read:readRecord,write:writeRecords,getState:()=>state,blank:()=>({collection:[],decks:[],settings:{}}),normalize:x=>x,storage:'qa-workspace',recovery:'qa-recovery'});
   state=(await vault.switchTo('qa-same-owner',null)).state;window.qa={vault,readRecord,writeRecord};
  });}
  await a.evaluate(async()=>qa.writeRecord('qa-workspace',{collection:[{id:'A-card',qty:2}],decks:[{id:'A-deck'}],settings:{}},{guardRecord:qa.vault.guard}));
  const blocked=await b.evaluate(async()=>{try{await qa.writeRecord('qa-workspace',{collection:[{id:'B-card'}]},{guardRecord:qa.vault.guard});return false;}catch(e){return e.code==='WORKSPACE_CONFLICT';}});
  assert.equal(blocked,true);assert.equal(await b.evaluate(async()=> (await qa.readRecord('qa-workspace')).collection[0].id),'A-card');
  await b.reload();await b.evaluate(async()=>{const {readRecord}=await import('/storage.js');window.reloaded=await readRecord('qa-workspace');});assert.equal(await b.evaluate(()=>reloaded.decks[0].id),'A-deck');
  console.log('PASS: real same-origin IndexedDB tabs reject stale same-account writes and reload the newest cards/decks.');
 }finally{await context.close();}
 const original=makeSearchFixtures().state;
 const fixture={sdkFailure:true,user:{id:'A',email:'A@example.invalid'},art:{A:{}},people:{A:[]},rows:{A:{data:original,revision:1}},profiles:{A:{display_name:'Private A',username:'private_a'}},items:{},requests:[],writes:[],storage:{'cardforge-v2':original,'cardstashy-workspace-owner-v1':{owner:'A',revision:1}}};
 const app=await openSearchApp(browser,server.base,{accountFixture:fixture}),{page}=app;
 try{
  await page.waitForFunction(async()=>{const c=(await import('/cloud.js')).cloudInfo();return !c.switching&&!!c.authNotice;});
  assert.equal(await page.locator('.account-opening').count(),0);
  assert.equal(await page.evaluate(()=>window.__uiTestState.state.collection.length),0,'SDK failure opens the separate guest workspace, never the prior owner');
  assert.equal(await page.evaluate(async()=> (await (await import('/storage.js')).readRecord('cardstashy-workspace-v1:A'))?.state?.collection?.length),original.collection.length,'SDK failure preserves the owner archive before retry');
  await capture(page,'synthetic-search-sdk-failure-guest');
  fixture.sdkFailure=false;await page.reload();await page.locator('#app.ready').waitFor();
  await page.waitForFunction(async()=>{const c=(await import('/cloud.js')).cloudInfo();return !c.switching&&c.user?.id==='A';});
  assert.equal(await page.evaluate(async()=> (await import('/store.js')).S.state.collection.length),original.collection.length,'retry restores the preserved owner workspace');
  console.log('PASS: blocked SDK recovers to a usable private guest workspace and reload retry restores the account.');
 }finally{await app.context.close();}
}finally{await browser.close();await server.close();}
