// Hosted actual-app Recovery QA. The account SDK and every external response are
// synthetic; restores mutate only this disposable browser's local fixture model.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startServer,openSearchApp,makeSearchFixtures,noOverflow,RESULTS} from './search-fixtures.mjs';
import {workspaceSig} from '../cloud.js';
import {blank} from '../store.js';
import {validateWorkspace} from '../confidence.js';
import {normalizeHomeDeckActivity} from '../home-deck-activity.js';
import {ACCOUNT_OWNER,accountRecord} from '../account-workspaces.js';
import {recoveryKey,syncBaselineKey,createRecoverySnapshot,appendRecoverySnapshot,readRecoverySnapshots,createSyncBaseline} from '../recovery-store.js';

const EVIDENCE='Synthetic accounts A and B, local fixture SDK, synthetic holdings and intercepted SVG artwork only. Reload durability is tested with the IndexedDB backend, not localStorage fallback. No real account, personal data, cloud mutation, live price or physical-device evidence.';
const normalize=state=>normalizeHomeDeckActivity({...blank(),...validateWorkspace(structuredClone(state))});
const a=normalize(makeSearchFixtures('mtg').state),b=structuredClone(a),recovered=structuredClone(a);
a.decks=[{id:'recovery-deck',name:'Current device deck',format:'Standard',cards:[{name:a.collection[0].name,qty:1}],side:[]}];
b.collection[0].qty=9;
recovered.collection[0].qty=2;recovered.tcg.ptcg.collection[0].qty=3;recovered.tcg.ygo.collection[0].qty=4;
recovered.decks=[{...structuredClone(a.decks[0]),name:'Recovered fixture deck'}];
const snapshotA=createRecoverySnapshot(recovered,{owner:'A',id:'recovery-a',label:'A private recovery copy',reason:'cloud-first-conflict',revision:1,now:new Date('2026-10-16T12:00:00Z')});
const snapshotB=createRecoverySnapshot(b,{owner:'B',id:'recovery-b',label:'B private recovery copy',now:new Date('2026-10-16T13:00:00Z')});
const meta=state=>({userId:state===a?'A':'B',revision:1,sig:workspaceSig(state)});
const fixture={user:{id:'A',email:'A@example.invalid'},profiles:{A:{display_name:'Account A',username:'account_a'},B:{display_name:'Account B',username:'account_b'}},art:{A:{},B:{}},people:{},items:{},rows:{A:{data:a,revision:1},B:{data:b,revision:1}},writes:[],storage:{
 'cardforge-v2':a,'cardforge-cloud-v1':meta(a),[ACCOUNT_OWNER]:{owner:'A',revision:1},
 [accountRecord('B')]:{state:b,recovery:blank(),meta:meta(b)},
 [recoveryKey('A')]:appendRecoverySnapshot(null,snapshotA),[recoveryKey('B')]:appendRecoverySnapshot(null,snapshotB),
 [syncBaselineKey('A')]:createSyncBaseline('A',1,a),[syncBaselineKey('B')]:createSyncBaseline('B',1,b),
}};
for(const state of [a,b,recovered]){
 const valid=normalize(state);assert.deepEqual(valid.collection,state.collection);assert.deepEqual(valid.decks,state.decks);
 for(const game of ['ptcg','ygo'])assert.deepEqual(valid.tcg[game].collection,state.tcg[game].collection);
}
assert.equal(readRecoverySnapshots(fixture.storage[recoveryKey('A')],'A').length,1);
assert.deepEqual(readRecoverySnapshots(fixture.storage[recoveryKey('A')],'B'),[]);
assert.equal(snapshotA.summary.copies,9);assert.equal(snapshotA.summary.decks,1);
if(process.argv.includes('--validate-fixtures')){console.log('PASS: Recovery fixture states, three-game quantities, account baselines and owner-scoped journals. No browser/server/network started.');process.exit(0);}
assert.equal(process.env.GITHUB_ACTIONS,'true','Recovery browser QA is hosted-only; use --validate-fixtures locally.');

const {chromium}=await import('playwright');
const server=await startServer(),checks=[],screenshots=[];
let browser,app,failure;
const ready=(page,owner)=>page.waitForFunction(async owner=>{const info=(await import('/cloud.js')).cloudInfo();return !info.switching&&info.user?.id===owner&&info.status.state==='synced'&&!info.pending;},owner);
const journal=(page,owner)=>page.evaluate(async owner=>{const {readRecord}=await import('/storage.js'),{recoveryKey,readRecoverySnapshots}=await import('/recovery-store.js');return readRecoverySnapshots(await readRecord(recoveryKey(owner)),owner);},owner);
const snapshot=page=>page.evaluate(()=>structuredClone(window.__uiTestState.state));
async function openRecovery(page){
 if(!await page.locator('#settingsDialog').evaluate(node=>node.open))await page.locator('[data-act="menu"]').click();
 await page.locator('#settingsTab-recovery').click();
 await page.waitForFunction(()=>/saved recovery cop/.test(document.querySelector('#recoveryStatus')?.textContent||''));
}
async function shot(page,name){
 assert.match(page.url(),/^http:\/\/127\.0\.0\.1:\d+\//);
 assert.match(name,/^recovery-[a-z0-9-]+$/);
 await mkdir(RESULTS,{recursive:true});await page.screenshot({path:resolve(RESULTS,name+'.png'),fullPage:true,animations:'disabled',timeout:10000});
 screenshots.push({file:name+'.png',viewport:page.viewportSize(),synthetic:true});
}
try{
 browser=await chromium.launch({headless:true});
 app=await openSearchApp(browser,server.base,{game:'mtg',width:390,evidenceLabel:'recovery',accountFixture:fixture});
 const {page}=app;
 await ready(page,'A');
 assert.equal(await page.evaluate(async()=>(await import('/storage.js')).storageBackend()),'IndexedDB','Reload durability evidence uses the actual IndexedDB backend');
 await openRecovery(page);
 const restoreA=()=>page.locator('[data-act="restoreRecovery"][data-id="recovery-a"]');
 assert.equal(await page.locator('#recoverySnapshots .recovery-snapshot').count(),1);
 assert.match(await page.locator('#recoverySnapshots').innerText(),/A private recovery copy/);
 assert.match(await page.locator('#recoverySnapshots').innerText(),/9 copies · 1 decks across all games/);
 assert.doesNotMatch(await page.locator('#recoverySnapshots').innerText(),/B private recovery copy/);
 for(const width of [390,768]){await page.setViewportSize({width,height:1000});await noOverflow(page,'#settingsDialog','Recovery list '+width);await shot(page,'recovery-list-'+width);}
 await page.setViewportSize({width:390,height:1000});
 const beforeDownload=await snapshot(page),beforeJournal=await journal(page,'A');
 const downloaded=page.waitForEvent('download');await page.locator('[data-act="downloadRecovery"][data-id="recovery-a"]').click();
 const file=await downloaded;assert.match(file.suggestedFilename(),/^CardStashy_Recovery_.*\.json$/);
 const payload=JSON.parse(await readFile(await file.path(),'utf8'));
 assert.equal(payload.backupKind,'cardforge-workspace');assert.equal(payload.schemaVersion,3);
 for(const key of ['collection','decks','myPrices','priceChoices'])assert.deepEqual(payload[key],recovered[key]);
 for(const game of ['ptcg','ygo'])assert.deepEqual(payload.tcg[game].collection,recovered.tcg[game].collection);
 assert.equal(Object.hasOwn(payload,'owner'),false);assert.equal(Object.hasOwn(payload,'snapshots'),false);
 assert.doesNotMatch(JSON.stringify(payload),/B private recovery copy|synthetic-token|example\.invalid/);
 assert.deepEqual(await snapshot(page),beforeDownload,'Download cannot restore or mutate the workspace');
 assert.deepEqual(await journal(page,'A'),beforeJournal);
 checks.push('Owner A sees only A journal; mobile/tablet list fits; downloaded backup contains exact three-game snapshot without account/journal metadata.');

 await restoreA().click();
 const confirm=page.locator('dialog.cf-dialog[open]:not(.closing)');await confirm.waitFor();
 assert.match(await confirm.innerText(),/9 card copies, 1 decks/);assert.match(await confirm.innerText(),/sync to your other devices/);assert.match(await confirm.innerText(),/saved as another recovery copy first/);
 await shot(page,'recovery-confirmation');
 await confirm.locator('[value="cancel"]').click();await page.locator('dialog.cf-dialog').waitFor({state:'detached'});
 assert.deepEqual(await snapshot(page),beforeDownload,'Cancel leaves the complete current workspace unchanged');
 assert.deepEqual(await journal(page,'A'),beforeJournal,'Cancel creates no replacement or extra recovery copy');
 checks.push('Cancel leaves the complete workspace and recovery journal unchanged.');

 const preRestore=await snapshot(page),previousSave=preRestore.lastSavedAt||null;
 const writesBefore=await page.evaluate(()=>window.__accountFixture.model.writes.length);
 await restoreA().click();await confirm.waitFor();await confirm.locator('[value="ok"]').click();
 await page.locator('dialog.cf-dialog').waitFor({state:'detached'});
 await page.waitForFunction(()=>window.__uiTestState.state.collection[0].qty===2&&window.__uiTestState.state.tcg.ptcg.collection[0].qty===3&&window.__uiTestState.state.tcg.ygo.collection[0].qty===4);
 await page.waitForFunction(async()=>{const {readRecord}=await import('/storage.js'),{recoveryKey,readRecoverySnapshots}=await import('/recovery-store.js');return readRecoverySnapshots(await readRecord(recoveryKey('A')),'A').length===2;});
 const savedCopies=await journal(page,'A');
 assert.deepEqual(savedCopies.find(item=>item.id==='recovery-a'),snapshotA,'Restoring does not consume the source recovery copy');
 const prior=savedCopies.find(item=>item.id!=='recovery-a');assert(prior,'Pre-restore snapshot is retained');
 assert.deepEqual(prior.state,preRestore,'The exact current workspace is durable before replacement');assert.equal(prior.reason,'recovery-restore');
 const restored=await snapshot(page);assert(restored.lastSavedAt);assert.notEqual(restored.lastSavedAt,previousSave);
 assert.deepEqual(restored.decks,recovered.decks);
 await page.waitForFunction(before=>window.__accountFixture.model.writes.slice(before).some(write=>write.owner==='A'&&write.data.collection[0].qty===2&&write.data.tcg.ptcg.collection[0].qty===3&&write.data.tcg.ygo.collection[0].qty===4),writesBefore);
 await ready(page,'A');
 assert.deepEqual(await page.evaluate(()=>window.__accountFixture.model.rows.B.data),b,'Restoring A does not update B');
 await page.locator('[data-act="recoveryRefresh"]').click();await page.waitForFunction(()=>document.querySelectorAll('#recoverySnapshots .recovery-snapshot').length===2);
 await noOverflow(page,'#settingsDialog','Recovery restored mobile');await shot(page,'recovery-restored-390');
 checks.push('Confirmed restore updates all three games, stamps a new save, preserves both exact snapshots and automatically writes only the synthetic A account.');

 // The base fixture reseeds fallback localStorage on reload. Assert IndexedDB
 // explicitly above, so this proves IndexedDB durability, not fallback durability.
 await page.reload();await page.locator('#app.ready').waitFor();
 await page.evaluate(async()=>{window.__uiTestState=(await import('/store.js')).S;});
 await ready(page,'A');assert.equal((await snapshot(page)).collection[0].qty,2);assert.equal((await journal(page,'A')).length,2);
 await page.evaluate(()=>window.__accountFixture.switch('B'));await ready(page,'B');await openRecovery(page);
 assert.equal(await page.locator('#recoverySnapshots .recovery-snapshot').count(),1);
 assert.match(await page.locator('#recoverySnapshots').innerText(),/B private recovery copy/);
 assert.doesNotMatch(await page.locator('#recoverySnapshots').innerText(),/A private recovery copy|Before workspace replacement/);
 assert.equal(await restoreA().count(),0);assert.equal((await snapshot(page)).collection[0].qty,9);
 await shot(page,'recovery-owner-b');
 await page.evaluate(()=>window.__accountFixture.switch('A'));await ready(page,'A');await openRecovery(page);
 await page.waitForFunction(()=>document.querySelectorAll('#recoverySnapshots .recovery-snapshot').length===2);
 assert.equal((await snapshot(page)).collection[0].qty,2);assert.equal((await journal(page,'B')).length,1);
 assert.doesNotMatch(await page.locator('#recoverySnapshots').innerText(),/B private recovery copy/);
 checks.push('IndexedDB reload retains restored data and both A snapshots; switching A → B → A exposes only the current owner’s copies and preserves B unchanged.');
 app.health();console.log('PASS: actual Settings Recovery list, backup download, cancel, durable confirmed restore, automatic synthetic sync, reload and owner isolation.');
}catch(error){
 failure=error;
 if(app)try{await shot(app.page,'recovery-failure');}catch(captureError){checks.push('Failure screenshot unavailable: '+captureError.message);}
 throw error;
}finally{
 await mkdir(RESULTS,{recursive:true});
 await writeFile(resolve(RESULTS,'recovery-browser.json'),JSON.stringify({generatedAt:new Date().toISOString(),evidence:EVIDENCE,status:failure?'failed':'passed',checks,screenshots,...(failure?{error:String(failure.stack||failure)}:{}),diagnostics:app?.diagnostics?.()||failure?.fixtureDiagnostics||null},null,2));
 await app?.context.close();await browser?.close();await server.close();
}
