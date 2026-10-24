import {contextAction,contextHeader,deckContextShortcuts} from './card-actions.js';
import {ICON,actionIcon} from './icons.js';
import {recoveryKey,recoverySummary,appendRecoverySnapshot,createRecoverySnapshot} from './recovery-store.js';
import {mergeValueHistory} from './value-history.js';
import {addScannedEntry} from './collection-stack.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {blank, S, slim} from './store.js';
import {validateWorkspace} from './confidence.js';
import {inventory, gaps, validateDeck, effectiveCopyLimit, sumQty} from './core.js';
import {collectionList} from './views.js';
import {safeHref,esc} from './ui.js';
import {SheetHistory} from './sheet-history.js';
import {detailIdentity,captureDetailState,restoreDetailState} from './pricing-presentation.js';
import {isEmptyWorkspace} from './cloud.js';
import {formatOf,hasCommander} from './formats.js';
import {writeRecords, readRecord} from './storage.js';
import {changedConditionLots} from './condition-refresh-scheduler.js';
import {recordHomeDeckWork} from './home-deck-activity.js';
const memory = new Map();
globalThis.localStorage = {getItem:k => memory.get(k) ?? null, setItem:(k,v) => memory.set(k,v), removeItem:k => memory.delete(k)};
const source = fs.readFileSync('app.js','utf8');
const segment = (a,b) => source.slice(source.indexOf(a),source.indexOf(b));
const fresh = () => ({...blank(),collection:[{id:'a',name:'Sol Ring',qty:1,finish:'nonfoil'},{id:'b',name:'Island',qty:1,finish:'nonfoil'}]});
let fail = false;
const ctx = {addScannedEntry,S:{state:fresh()},slim,changedConditionLots,recordHomeDeckWork,refreshChangedConditions(){},structuredClone,normalize:validateWorkspace,stripCache:s=>s,STORAGE:'safety-only',RECOVERY:'safety-recovery',writeRecords:async r=>{if(fail){fail=false;throw Error('disk full');}return writeRecords(r);},afterLocalSave(){},saveCatalogSoon(){},render(){},refreshSheet(){},haptic(){},flyToCollection(){},toast(){},autoEnrich(){},setTimeout(){},lastActTarget:null,A:{},blank,meta:()=>null,go(){},uid:()=>''};
Object.assign(ctx,{cloudInfo:ctx.cloudInfo||(()=>({configured:false})),refreshProfileAvatar(){},createAccountWorkspaces:()=>({guard:null}),readRecord:ctx.readRecord|| (async()=>null)});
Object.assign(ctx,{recoveryKey,recoverySummary,appendRecoverySnapshot,createRecoverySnapshot});vm.createContext(ctx);
vm.runInContext(segment('let lastUndo = null;','\nconst safely =')+'\n'+segment('A.qty = async','\nI.collSearch ='),ctx);
await Promise.all(['a','b'].map(id=>ctx.A.qty({dataset:{id,delta:'1'}})));
assert.deepEqual(ctx.S.state.collection.map(e=>e.qty),[2,2]);
assert.deepEqual((await readRecord('safety-only')).collection.map(e=>e.qty),[2,2]);
ctx.S.state=fresh();await Promise.all([1,2].map(()=>ctx.A.qty({dataset:{id:'a',delta:'1'}})));
assert.equal(ctx.S.state.collection[0].qty,3);
ctx.S.state=fresh();fail=true;
const writes=await Promise.allSettled([ctx.commit(s=>s.collection[0].qty++),ctx.commit(s=>s.collection[1].qty++)]);
assert.equal(writes[0].status,'rejected');assert.equal(writes[1].status,'fulfilled');assert.deepEqual(ctx.S.state.collection.map(e=>e.qty),[1,2]);
ctx.S.state=fresh();await Promise.all([ctx.commit(s=>s.collection[0].qty++),ctx.commit(s=>s.decks.push({id:'deck',name:'Saved',format:'Modern',cards:[]}))]);
assert.equal(ctx.S.state.collection[0].qty,2);assert.equal((await readRecord('safety-only')).decks.length,1);
vm.runInContext(segment('A.loadExample = async','\nA.persist ='),ctx);
for(const type of ['ptcg','ygo','decks','wishlist','notes','references']){
 ctx.S.state=blank();if(['ptcg','ygo'].includes(type))ctx.S.state.tcg={[type]:{collection:[{id:'lot',cardId:'c',qty:1}]}};else ctx.S.state[type]=[{id:'record'}];
 const before=structuredClone(ctx.S.state);let asked=0;ctx.ask=async()=>{asked++;return false;};await ctx.A.loadExample();assert.equal(asked,1,type);assert.deepEqual(ctx.S.state,before,'cancel changes nothing');
}
ctx.S.state=blank();ctx.ask=async()=>{throw Error('empty needs no confirmation');};await ctx.A.loadExample();assert.equal(ctx.S.state.example,true);
const unsafe='x"><img data-injected="yes" src="bad"><span data-x="';
const malicious=fresh();malicious.collection[0].id=unsafe;assert.throws(()=>validateWorkspace(malicious),/IDs/);
// Defense in depth: even unvalidated in-memory values must remain inert attribute text.
S.state=malicious;const html=collectionList();assert(!html.includes('<img data-injected='));assert(html.includes('&quot;&gt;&lt;img'));
for(const field of ['notes','wishlist']){const state=blank();state[field]=[{id:unsafe,name:'Card',qty:1}];assert.throws(()=>validateWorkspace(state),/ID/);}
const catalog={mountain:{name:'Mountain',type_line:'Basic Land',legalities:{vintage:'legal'}},bolt:{name:'Bolt',type_line:'Instant',legalities:{vintage:'legal'}},lotus:{name:'Lotus',type_line:'Artifact',legalities:{vintage:'restricted'}}};
const deck={id:'deck',format:'Vintage',locked:true,cards:[{name:'Mountain',qty:60}],side:[{name:'Bolt',qty:4}]};
const entries=[{name:'Mountain',qty:60},{name:'Bolt',qty:4}];
assert.deepEqual(inventory(entries,'Bolt',[deck]),{owned:4,reserved:4,available:0});
assert.equal(inventory(entries,'Bolt',[deck],deck.id).available,4);assert.equal(inventory(entries,'Bolt',[{...deck,locked:false}]).available,4);
assert.equal(validateDeck(deck,catalog,[entries[0]]).missing,4);assert.equal(validateDeck(deck,catalog,[entries[0]]).ready,false);
const overlap={...deck,cards:[{name:'Mountain',qty:57},{name:'Bolt',qty:3}],side:[{name:'Bolt',qty:1}]};
assert.equal(gaps(overlap,[{name:'Mountain',qty:57},{name:'Bolt',qty:3}],[]).find(x=>x.name==='Bolt').missing,1);
assert.equal(inventory(entries,'Bolt',[deck,{...deck,id:'other',side:[{name:'Bolt',qty:1}]}],deck.id).available,3);
for(const [main,side,illegal] of [[1,1,true],[0,2,true],[0,1,false]]){const d={...deck,cards:[{name:'Mountain',qty:60},...(main?[{name:'Lotus',qty:main}]:[])],side:[{name:'Lotus',qty:side}]};assert.equal(validateDeck(d,catalog,[]).issues.some(x=>x.kind==='copies'),illegal);}
assert.equal(effectiveCopyLimit({oracle_text:'A deck can have up to seven cards named Seven.',legalities:{}},{copies:4}),7);
assert.equal(effectiveCopyLimit({oracle_text:'A deck can have any number of cards named Rats.',legalities:{}},{copies:4}),Infinity);
console.log('PASS: serialized read-modify-write, failed save recovery, overlapping deck edits, all-game example confirmation, inert backup IDs, physical sideboard copies and combined restricted/printed limits.');

for (const bad of ['javascript:alert(1)', 'data:text/html,hi', ' java\nscript:alert(1)', '//evil.example']) assert.equal(safeHref(bad),'#');
assert.equal(safeHref('https://example.com/x'),'https://example.com/x');
assert.equal(safeHref('#home'),'#home');

// The last-copy decision must be made after prior queued quantity changes.
ctx.S.state=fresh();ctx.S.state.collection[0].qty=2;let asks=0;
ctx.ask=async()=>{asks++;return false;};
await Promise.all([1,2].map(()=>ctx.A.qty({dataset:{id:'a',delta:'-1'}})));
assert.equal(asks,1);assert.equal(ctx.S.state.collection[0].qty,1,'declining final-copy deletion retains the lot');
ctx.ask=async()=>{asks++;return true;};
await Promise.all([1,2].map(()=>ctx.A.qty({dataset:{id:'a',delta:'-1'}})));
assert.equal(asks,2,'already removed rows do not prompt again');assert(!ctx.S.state.collection.some(e=>e.id==='a'));
// Guard cancellation does not block later writes.
await ctx.A.qty({dataset:{id:'b',delta:'1'}});assert.equal(ctx.S.state.collection[0].qty,2);

for(const side of [[{name:'Bolt',qty:-3}],[{name:'Bolt',qty:0}],[{name:'Bolt',qty:'4'}],[{name:'Bolt',qty:100001}],[{name:'',qty:1}],{},[null]]){
 const state={...blank(),decks:[{id:'d',name:'Deck',format:'Modern',cards:[],side}]};
 assert.throws(()=>validateWorkspace(state),/sideboard/);
 const version={...blank(),decks:[{id:'d',name:'Deck',format:'Modern',cards:[],versions:[{id:'v',side}]}]};
 assert.throws(()=>validateWorkspace(version),/sideboard/);
}
assert.deepEqual(inventory([{name:'Bolt',qty:1}],'Bolt',[{id:'bad',locked:true,cards:[],side:[{name:'Bolt',qty:-3}]}]),{owned:1,reserved:0,available:1});
assert.equal(inventory([{name:'Bolt',qty:1}],'Bolt',[{id:'bad',locked:true,cards:[],side:{}}]).available,1);

// Capture form data at click time, not after an earlier queued save rerenders.
ctx.S.state={...blank(),decks:[{id:'d',name:'Deck',format:'Modern',cards:[]}]};
let release,writeCount=0;const gate=new Promise(r=>{release=r;});
ctx.writeRecords=async()=>{if(++writeCount===1)await gate;};
const fields={'#logResult':{value:'Loss'},'#logTurn':{value:'7'},'#logNote':{value:'Important typed game notes'},'#dmFormat':{value:'Modern'},'#dmName':{value:'Edited deck'},'#dmBudget':{value:'42'},'#dmStrategy':{value:'Tokens'}};
ctx.deckBoxFields=()=>'';ctx.readDeckBox=()=>({color:'#337799',image:''});ctx.$=q=>fields[q];ctx.currentDeck=()=>ctx.S.state.decks[0];ctx.cardSig=()=>'';ctx.uid=()=> 'note';ctx.closeSheet=()=>{};ctx.formatOf=formatOf;ctx.hasCommander=hasCommander;
ctx.render=()=>{for(const field of Object.values(fields))field.value='';fields['#logResult'].value='Win';};
vm.runInContext(segment('A.logGame = async','\n\n/* ---------- life tracker')+'\n'+segment('const editDeck =','\n// Play guide (Magic)'),ctx);
const prior=ctx.commit(()=>{});await Promise.resolve();const logSave=ctx.A.logGame(),infoSave=ctx.A.deckSaveInfo();release();await Promise.all([prior,logSave,infoSave]);
assert.equal(ctx.S.state.notes[0].result,'Loss');assert.equal(ctx.S.state.notes[0].turn,7);assert.equal(ctx.S.state.notes[0].note,'Important typed game notes');
assert.equal(ctx.S.state.decks[0].name,'Edited deck');assert.equal(ctx.S.state.decks[0].budget,42);assert.equal(ctx.S.state.decks[0].strategy,'Tokens');

// Render actual controller Back/refresh logic against a small DOM boundary.
const makeButton=()=>({dataset:{},attrs:{},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},remove(){head.buttons=head.buttons.filter(b=>b!==this);}});
const head={buttons:[],querySelector(q){return q==='[data-history-back]'?this.buttons.find(b=>b.dataset.historyBack):null;},prepend(b){this.buttons.unshift(b);}};
let bodyHtml='';const body={dataset:{},scrollTop:0,querySelectorAll(){return [];},get innerHTML(){return bodyHtml;},set innerHTML(v){bodyHtml=v;head.buttons=[];},querySelector(q){return q==='.sheet-head'?head:null;}};
const navigation={askNavigation:null,detailContextIdentity:detailIdentity,captureDetailState,restoreDetailState,sheetScrolled(){},S:{ui:{sheetCtx:null}},T:{proven:{}},sheetTrail:new SheetHistory(),restoringSheet:false,ICON:{back:'←'},document:{createElement:makeButton},meta:name=>({name}),V:{cardSheet:c=>`<div class="sheet-head">Fresh ${c.name}</div>`},$:(q)=>q==='#sheetBody'?body:q==='#sheet'?{open:true}:null};
vm.createContext(navigation);
vm.runInContext(segment('function restoreSheet(','\nfunction wireRouteBack')+'\n'+segment('function refreshSheet()','\nfunction download('),navigation);
navigation.openSheet=(html,ctx,scroll)=>{navigation.S.ui.sheetCtx=ctx;body.innerHTML=html;body.scrollTop=scroll;navigation.wireSheetBack();};
const snaps=['A','B','C'].map(name=>({ctx:{type:'card',name},html:`Cached ${name}`,scroll:25}));
navigation.sheetTrail.push(snaps[0],snaps[1].ctx);navigation.sheetTrail.push(snaps[1],snaps[2].ctx);
navigation.restoreSheet(navigation.sheetTrail.pop());assert(body.innerHTML.includes('Fresh B'));assert.equal(head.buttons[0]?.dataset.act,'sheetHistoryBack','second-level Back survives the refresh');
navigation.restoreSheet(navigation.sheetTrail.pop());assert(body.innerHTML.includes('Fresh A'));assert.equal(head.buttons.length,0,'root has no stale Back button');assert.equal(navigation.restoringSheet,false);

// A backup source URL remains inert in the deck options, not only Inspiration.
let menuHtml='';const menu={A:{},contextAction,contextHeader,deckContextShortcuts,ICON,actionIcon,formatOf,deckBoxMarkup:()=>'',deckBoxFields:()=>'',meta:()=>null,cardImage:()=>'',currentDeck:()=>({name:'Deck',format:'Modern',source:{url:'javascript:alert(1)'}}),openSheet:html=>{menuHtml=html;},esc,safeHref,formatSelect:()=>'',options:()=>''};
vm.createContext(menu);vm.runInContext(segment('A.deckMenu =','\nconst editDeck ='),menu);menu.A.deckMenu();assert(menuHtml.includes('href="#"'));assert(!menuHtml.includes('href="javascript:'));
console.log('PASS: queued deletion confirmation, safe sideboard backups, queued form snapshots, multi-level Back refresh and safe deck source links.');

// The storage boundary serializes captured snapshots; delaying its first write used to
// let a direct reset/restore jump ahead of an older, queued read-modify-write edit.
function replacementHarness() {
  const lot=(id)=>({id,name:id,qty:1,finish:'nonfoil'});
  const initial={...blank(),collection:[lot('Original')]},savedRecovery={...blank(),collection:[lot('Recovery')]};
  const disk=new Map([['queue-state',structuredClone(initial)],['queue-recovery',structuredClone(savedRecovery)]]);
  let release,started,observed,storageQueue=Promise.resolve(),writes=0;
  const gate=new Promise(r=>{release=r;}),firstWrite=new Promise(r=>{started=r;}),replacementQueued=new Promise(r=>{observed=r;});
  const events=[];
  const c={S:{state:initial,catalog:{}},changedConditionLots,recordHomeDeckWork,refreshChangedConditions(){},structuredClone,normalize:validateWorkspace,stripCache:s=>s,STORAGE:'queue-state',RECOVERY:'queue-recovery',blank,A:{},C:{},sumQty,isEmptyWorkspace,
    writeRecords(records){const snapshots=structuredClone(records);const transaction=async()=>{const n=++writes;if(n===1){started();await gate;}if(c.failAt===n)throw Error('disk full');for(const [k,v] of snapshots)disk.set(k,v);};const result=storageQueue.then(transaction,transaction);storageQueue=result.catch(()=>{});return result;},
    readRecord:async k=>structuredClone(disk.get(k)),readBackup:async()=>({next:c.imported,cache:{}}),slim:x=>x,
    afterLocalSave(){events.push('save-notify');},saveCatalogSoon(){},render(){},refreshSheet(){},haptic(){},flyToCollection(){},toast(text){events.push(text);},autoEnrich(){},setTimeout(){},lastActTarget:null,
    ask:async()=>true,askText:async()=> 'DELETE',busy:()=>()=>{},deleteAccount:async()=>{c.owner=null;},
    cloudInfo:()=>({user:c.owner}),signOut:async()=>{events.push('sign-out');if(c.signOutError)throw Error('sign-out failed');c.owner=null;},detachDeviceSync(){events.push('detach');},clearAskConversations(){},clearRulesConversations(){},rulesGuideOrigin:null,go(){},owner:null};
  Object.assign(c,{mergeValueHistory,T:{readLegacyTcgValueHistory:()=>[]},refreshProfileAvatar(){},createAccountWorkspaces:()=>({guard:null})});
  Object.assign(c,{recoveryKey,recoverySummary,appendRecoverySnapshot,createRecoverySnapshot});vm.createContext(c);
  vm.runInContext(segment('let lastUndo = null;','\nconst safely =')+'\n'+segment('A.undo = async','\nA.nextFact =')+'\n'+segment('C.restoreBackup = async','\nA.loadExample =')+'\n'+segment('A.deleteAccount = async','\nA.signOut ='),c);
  vm.runInContext('cloudHooks = ({'+segment('    apply: async (data,{owner,current}={}) => {','    backup: async')+'});',c);
  const replace=c.replaceWorkspace;c.replaceWorkspace=(...args)=>{const result=replace(...args);observed();return result;};
  return {c,disk,events,release,firstWrite,replacementQueued,lot};
}
async function raceReplacement(kind) {
  const h=replacementHarness(),{c,disk,lot}=h;
  c.imported={...blank(),collection:[lot('Imported')]};
  if(kind==='cloud'||kind==='reset')c.owner={id:'account-1'};
  const first=c.commit(s=>s.collection.push(lot('First')),{undo:'First'});
  await h.firstWrite;
  const second=c.commit(s=>s.collection.push(lot('Second')),{undo:'Second'});
  const operation=kind==='reset'?c.A.reset():kind==='restore'?c.C.restoreBackup({files:[{}]}):kind==='recovery'?c.A.undoRestore():kind==='undo'?c.A.undo():kind==='erase'?c.A.deleteAccount({}):c.cloudHooks.apply(c.imported);
  await h.replacementQueued;h.release();await Promise.all([first,second,operation]);
  const names=state=>state.collection.map(x=>x.id);
  const expected=kind==='reset'||kind==='erase'?[]:kind==='undo'?['Original','First']:kind==='recovery'?['Recovery']:['Imported'];
  assert.deepEqual(names(c.S.state),expected,kind+' in-memory replacement ordering');
  assert.deepEqual(names(disk.get('queue-state')),expected,kind+' durable replacement ordering');
  const recovery=kind==='erase'?[]:kind==='undo'?['Recovery']:['Original','First','Second'];
  assert.deepEqual(names(disk.get('queue-recovery')),recovery,kind+' preserves latest pre-replacement recovery');
  assert.equal(vm.runInContext('lastUndo',c),null,kind+' invalidates old-workspace Undo');
  if(kind==='reset'){assert(h.events.indexOf('sign-out')<h.events.indexOf('detach'));assert.equal(c.owner,null);}
  if(kind!=='undo')assert.equal(h.events.filter(e=>e==='save-notify').length,['restore','recovery'].includes(kind)?3:2,'explicit restore schedules a new account update; blank reset and cloud adoption do not');
  await c.A.undo();assert.deepEqual(names(c.S.state),expected,'stale Undo cannot revive the replaced workspace');
}
for(const kind of ['reset','restore','recovery','undo','cloud'])await raceReplacement(kind);

// A failed replacement leaves both the workspace and its recovery/Undo usable.
{
 const h=replacementHarness(),{c,disk,lot}=h;c.failAt=3;
 const first=c.commit(s=>s.collection.push(lot('First')),{undo:'First'});await h.firstWrite;
 const second=c.commit(s=>s.collection.push(lot('Second')),{undo:'Second'}),undo=c.A.undo();
 const rejected=assert.rejects(undo,/disk full/);await h.replacementQueued;h.release();await Promise.all([first,second,rejected]);
 assert.equal(c.S.state.collection.length,3);assert.equal(disk.get('queue-state').collection.length,3);assert.equal(vm.runInContext('lastUndo.label',c),'Second');
 await c.A.undo();assert.deepEqual(c.S.state.collection.map(x=>x.id),['Original','First']);
}
// Sign-out failure cannot erase the local copy or detach its sync baseline.
{
 const h=replacementHarness();h.c.owner={id:'account-1'};h.c.signOutError=true;
 await assert.rejects(h.c.A.reset(),/sign-out failed/);assert.equal(h.c.S.state.collection[0].id,'Original');assert.equal(h.disk.get('queue-state').collection[0].id,'Original');assert(!h.events.includes('detach'));
}
// A cloud replacement waiting behind edits belongs only to the account that requested it.
for (const replacementOwner of [null,{id:'account-2'}]) {
 const h=replacementHarness(),{c,lot}=h;c.owner={id:'account-1'};
 const edit=c.commit(s=>s.collection.push(lot('First')));await h.firstWrite;
 const apply=c.cloudHooks.apply({...blank(),collection:[lot('Old account')]});await h.replacementQueued;c.owner=replacementOwner;h.release();await Promise.all([edit,apply]);
 assert.deepEqual(c.S.state.collection.map(x=>x.id),['Original','First']);assert.equal(h.disk.get('queue-recovery').collection[0].id,'Recovery');
}
// Signing in on an empty device must not erase a useful prior recovery copy.
{
 const h=replacementHarness(),{c,lot}=h;c.S.state=blank();c.owner={id:'account-1'};
 const apply=c.cloudHooks.apply({...blank(),collection:[lot('Account')]});await h.replacementQueued;h.release();await apply;
 assert.equal(c.S.state.collection[0].id,'Account');assert.equal(h.disk.get('queue-recovery').collection[0].id,'Recovery');
}

// No session is not a valid account identity, even if both checks see undefined.
{
 const h=replacementHarness();
 await h.c.cloudHooks.apply({...blank(),collection:[h.lot('Unowned account')]});
 assert.equal(h.c.S.state.collection[0].id,'Original');assert.equal(h.disk.get('queue-state').collection[0].id,'Original');assert.equal(h.disk.get('queue-recovery').collection[0].id,'Recovery');
}

// A restore write failure cannot consume the previous recovery copy or clear Undo.
{
 const h=replacementHarness(),{c,disk,lot}=h;c.failAt=3;c.imported={...blank(),collection:[lot('Imported')]};
 const first=c.commit(s=>s.collection.push(lot('First')),{undo:'First'});await h.firstWrite;
 const second=c.commit(s=>s.collection.push(lot('Second')),{undo:'Second'}),restore=c.C.restoreBackup({files:[{}]});
 await h.replacementQueued;h.release();await Promise.all([first,second,restore]);
 assert.deepEqual(c.S.state.collection.map(x=>x.id),['Original','First','Second']);assert.deepEqual(disk.get('queue-state').collection.map(x=>x.id),['Original','First','Second']);
 assert.equal(disk.get('queue-recovery').collection[0].id,'Recovery');assert.equal(vm.runInContext('lastUndo.label',c),'Second');assert(h.events.some(e=>e.startsWith('Restore failed')));
}
console.log('PASS: delayed-write reset/restore/recovery/Undo/account replacement ordering, latest recovery copies, failed Undo retry, sign-out protection and stale-account rejection.');

// Scanner collection commits are idempotent across a queue-removal failure/reload.
ctx.S.state=blank();let scanUid=0;ctx.uid=()=>`scan-lot-${++scanUid}`;
vm.runInContext(segment('async function mtgScanAddMany(', '\nconst mtgScanPrice ='),ctx);
const scanCard={id:'printing-1',name:'Bolt',set:'tst',collector_number:'1',finishes:['nonfoil','foil']};
const scanItem={captureId:'capture-one',qty:1,finish:'nonfoil',lang:'en',condition:'Lightly Played',cand:{exact:true,card:scanCard}};
await Promise.all([ctx.mtgScanAddMany([scanItem]),ctx.mtgScanAddMany([scanItem])]);
assert.equal(ctx.S.state.collection.length,1);assert.equal(ctx.S.state.collection[0].scanCaptureId,'capture-one');
await ctx.mtgScanAddMany([{...scanItem,captureId:'capture-two'}]);assert.equal(ctx.S.state.collection.length,1);assert.equal(ctx.S.state.collection[0].qty,2);
await assert.rejects(ctx.mtgScanAddMany([{...scanItem,finish:'foil'}]),/already saved/);assert.equal(ctx.S.state.collection.length,1);assert.equal(ctx.S.state.collection[0].qty,2);
console.log('PASS: queued Magic capture retries are idempotent while stacking distinct physical captures.');
