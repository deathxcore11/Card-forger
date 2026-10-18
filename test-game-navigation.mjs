import {recoveryKey,recoverySummary,appendRecoverySnapshot,createRecoverySnapshot} from './recovery-store.js';
// Deterministic semantic mapping, real app controller and history tests. No browser/network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mergeValueHistory} from './value-history.js';
import {recordHomeDeckWork} from './home-deck-activity.js';
import {makeAskTools} from './ai-tools.js';
import {GAME_ROUTES,routeSegments,normalizeRoute,gameSwitchRoute,historyEntry,createNavigationQueue} from './game-navigation.js';
const rows=[['#home','#home'],['#search','#search'],['#collection','#collection/cards'],['#collection/cards','#collection/cards'],['#collection/binders','#collection/binders'],['#collection/value','#collection/value'],['#decks','#decks/mine'],['#decks/mine','#decks/mine'],['#decks/ideas','#decks/ideas'],['#decks/inspiration','#decks/inspiration'],['#deck/source-only/cards','#decks/mine'],['#tdeck/source-only/versions','#decks/mine'],['#sets','#sets'],['#set/source-only-release','#sets'],['#scan','#scan'],['#rules','#rules'],['#settings','#settings'],['#shared/private-token','#decks/inspiration']];
for(const game of GAME_ROUTES)for(const target of GAME_ROUTES.filter(g=>g!==game))for(const [hash,expected] of rows){
 const mapped=gameSwitchRoute({game,hash},target);assert.equal(mapped.game,target);assert.equal(mapped.hash,expected);assert(!mapped.hash.includes('source-only'));assert(!mapped.hash.includes('private-token'));
}
for(const tab of ['cards','engine','insights','matchups','upgrade','versions','playtest','shop','rules'])for(const view of ['deck','tdeck'])assert.equal(gameSwitchRoute({hash:`#${view}/same-id/${tab}`},'ygo').hash,'#decks/mine');
for(const target of GAME_ROUTES){
 assert.equal(gameSwitchRoute({hash:'#collection/wishlist'},target).hash,target==='mtg'?'#collection/wishlist':'#collection/cards');
 assert.equal(gameSwitchRoute({hash:'#collection/cards',collectionShow:'wanted'},target).wanted,true);
 assert.equal(gameSwitchRoute({hash:'#search',origin:{section:'collection',tab:'binders'}},target).hash,'#collection/binders');
}
const aliases={catalog:'#search',builder:'#decks/mine',discover:'#decks/ideas',library:'#decks/inspiration',wishlist:'#collection/cards',compare:'#search',playtest:'#decks/mine',guides:'#decks/mine',sources:'#settings'};
for(const [alias,expected] of Object.entries(aliases))assert.equal(gameSwitchRoute({hash:'#'+alias},'ygo').hash,expected);
for(const raw of ['#set/%E0%A4%A','#set/','#set/%00','#set/'+'a'.repeat(4097)])assert.equal(normalizeRoute(raw),'#sets');
assert.equal(normalizeRoute('#shared/'+'a'.repeat(6000)),'#shared/'+'a'.repeat(6000),'existing long shared deck URLs remain compatible');
assert.equal(normalizeRoute('#unknown'),'#home');assert.equal(normalizeRoute('#search/%00'),'#home');assert.equal(normalizeRoute('#set/Release%20A%2FB'),'#set/Release%20A%2FB');
assert.equal(historyEntry({cardstashy:{version:1,game:'ygo',route:'#set/a',entryId:'one',index:1}},'#set/a').game,'ygo');
for(const bad of [{game:'wrong'}, {version:2}, {route:'#home'}, {index:-1}, {entryId:42}])assert.equal(historyEntry({cardstashy:{version:1,game:'ygo',route:'#set/a',entryId:'one',index:1,...bad}},'#set/a'),null);

const app=fs.readFileSync('app.js','utf8');
const routing=app.slice(app.indexOf('const VIEWS ='),app.indexOf('\nconst autoLoaded'));
const controller=app.slice(app.indexOf('// Public hashes stay compatible;'),app.indexOf('\n/* =========================================================\n   Event delegation'));
function harness(game='mtg',hash='#search'){
 const UI=Object.fromEntries(GAME_ROUTES.map(g=>[g,{search:{q:g+' own query',f:{set:g+'-set'}},coll:{tab:'cards',q:g+' collection',show:''},set:{id:'',busy:false},sets:{q:g+' catalogue'}}]));
 const saved={settings:{game},collection:[{id:'lot-mtg',qty:2}],decks:[{id:'same-id',cards:[]}],wishlist:[{id:'wish'}],tcg:{ygo:{collection:[{id:'lot-ygo',qty:3}],decks:[{id:'same-id',zones:{main:[],extra:[],side:[]}}]},ptcg:{collection:[{id:'lot-ptcg',qty:4}],decks:[{id:'same-id',zones:{main:[],extra:[],side:[]}}]}}};
 const S={state:saved,ui:{view:'search',collTab:'cards',decksTab:'mine',set:{code:'',busy:false},shared:{},q:{}}};
 const location={hash},handlers={},entries=[{state:null,hash}],paints=[],toasts=[],hooks=[],scrolls=[];let pos=0,block=false,scanSaving=false,reject=false,slow=false;const jobs=[];
 const history={get state(){return entries[pos].state;},replaceState(state,_title,route){entries[pos]={state:structuredClone(state),hash:route};location.hash=route;},pushState(state,_title,route){entries.splice(++pos);entries.push({state:structuredClone(state),hash:route});location.hash=route;},go(delta){pos+=delta;location.hash=entries[pos].hash;handlers.popstate();handlers.hashchange();}};
 const T={game:()=>GAME_ROUTES.includes(S.state.settings?.game)?S.state.settings.game:"mtg",isTcg:()=>S.state.settings.game!=='mtg',ui:(g=S.state.settings.game)=>UI[g],invalidateTcgSearch:g=>hooks.push('search:'+g)};
 const content={setAttribute(){}};
 const context={aiMatchups:{cancel(){}},settingsPopup:{historyChanged:()=>false},S,T,location,history,routeSegments,normalizeRoute,gameSwitchRoute,historyEntry,createNavigationQueue,GAMES:Object.fromEntries(GAME_ROUTES.map(g=>[g,{}])),
 document:{querySelector:()=>null,querySelectorAll:selector=>selector==='dialog[open]'&&block?[{id:'dirty'}]:[],addEventListener(){}},window:{scrollY:175,scrollTo:arg=>scrolls.push(arg),addEventListener:(name,fn)=>handlers[name]=fn},$:()=>content,
 scanCtx:{beforeGameChange:(from,to)=>{hooks.push(['before',from,to]);return !scanSaving;},afterGameChange:g=>hooks.push(['after',g])},
 commit:async fn=>{if(slow)await new Promise((resolve,reject)=>jobs.push({resolve,reject}));if(reject)throw Error('fixture disk full');fn(S.state);},
 render:()=>paints.push({game:T.game(),hash:location.hash,view:S.ui.view,deckId:S.ui.deckId,tdeckId:S.ui.tdeckId,tsetId:S.ui.tsetId}),
 toast:m=>toasts.push(m),closeSheet(){S.ui.sheetCtx=null;},dismissRulesGuide(){},endHold(){},heldTarget:null,browseCleanup:null,dbInvalidate:()=>hooks.push('magic'),tcgCtx:{invalidateNavigation:()=>hooks.push('retire')},sheetReturn:null,sheetTrail:{clear(){}},routeTrail:[],pendingRoute:null,quickCard:null,comparison:{cancel(){}},updateCompareTray(){},navDir:'',scrollRestore:0,scrollMem:new Map(),restoreScroll:top=>scrolls.push(top),deckById:id=>S.state.decks.find(d=>d.id===id),save(){},openShared(){},console,Date,Promise,Set,Map};
 Object.assign(context,{recoveryKey,recoverySummary,appendRecoverySnapshot,createRecoverySnapshot});vm.createContext(context);vm.runInContext(routing+'\n'+controller,context);
 vm.runInContext('navigationReady=true;activeEntry=makeEntry(T.game(),normalizeRoute(location.hash),0);replaceEntry(activeEntry);parseHash();',context);
 return {context,S,UI,entries,paints,toasts,hooks,scrolls,jobs,history,handlers,location,run:script=>vm.runInContext(script,context),block:value=>block=value,scanSaving:value=>scanSaving=value,reject:value=>reject=value,slow:value=>slow=value};
}
for(const source of GAME_ROUTES)for(const target of GAME_ROUTES.filter(g=>g!==source))for(const [hash,expected] of rows){
 const h=harness(source,hash),before=JSON.stringify({...h.S.state,settings:undefined}),filters=JSON.stringify(h.UI,(k,v)=>k==='tab'?undefined:v);
 assert.equal(await h.context.switchGame(target),true,`${source}→${target} ${hash}`);
 assert.equal(h.S.state.settings.game,target);assert.equal(h.location.hash,expected);assert.equal(h.entries.length,2);assert.equal(h.paints.length,1);
 assert.equal(JSON.stringify({...h.S.state,settings:undefined}),before,'game changes do not touch durable resources');
 assert.equal(JSON.stringify(h.UI,(k,v)=>k==='tab'?undefined:v),filters,'target/source query and filter state survives');
 assert.equal(h.S.ui.deckId,null);assert.equal(h.S.ui.tdeckId,null);assert.equal(h.S.ui.tsetId,null);
 assert.equal(await h.context.switchGame(target),false);assert.equal(h.entries.length,2,'same game is a no-op');
 h.history.go(-1);await new Promise(r=>setImmediate(r));assert.equal(h.S.state.settings.game,source);assert.equal(h.location.hash,hash);assert.equal(h.entries.length,2);
 h.history.go(1);await new Promise(r=>setImmediate(r));assert.equal(h.S.state.settings.game,target);assert.equal(h.location.hash,expected);assert.equal(h.entries.length,2);
 assert.equal(h.paints.length,3,'popstate/hashchange traversal paints exactly once');
}
// Identical IDs do not share tab state. URL restores the original game and detail.
{
 const h=harness('ygo','#tdeck/same-id/versions');await h.context.switchGame('ptcg');assert.equal(h.S.ui.tdeckTab['ygo:same-id'],'versions');assert.equal(h.S.ui.tdeckTab['ptcg:same-id'],undefined);h.history.go(-1);await new Promise(r=>setImmediate(r));assert.equal(h.S.ui.tdeckId,'same-id');assert.equal(h.S.ui.tdeckTab['ygo:same-id'],'versions');
}
// Dialogs and saving scans remain intact; failed writes roll back without history entry.
for(const type of ['dialog','save','disk']){
 const h=harness('ygo','#scan');h.S.ui.sheetCtx={type:'unsaved'};h.block(type==='dialog');h.scanSaving(type==='save');h.reject(type==='disk');
 assert.equal(await h.context.switchGame('mtg'),false);assert.equal(h.S.state.settings.game,'ygo');assert.equal(h.location.hash,'#scan');assert.equal(h.entries.length,1);assert.equal(h.S.ui.sheetCtx.type,'unsaved');assert(h.toasts.length);
}
// Queued tabs and normal navigation supersede in-flight writes without intermediate paint.
{
 const h=harness('mtg','#set/source-only');h.slow(true);
 const a=h.context.switchGame('ygo'),b=h.context.switchGame('ptcg');assert.equal(h.jobs.length,1);assert.equal(h.paints.length,0);
 h.jobs[0].resolve();await new Promise(r=>setImmediate(r));assert.equal(h.jobs.length,2);assert.equal(h.paints.length,0);
 h.jobs[1].resolve();assert.equal(await a,false);assert.equal(await b,true);assert.equal(h.entries.length,2);assert.equal(h.paints[0].game,'ptcg');assert.equal(h.location.hash,'#sets');
 h.slow(false);await h.context.go('#search');h.slow(true);
 const c=h.context.switchGame('ygo'),d=h.context.go('#collection/cards');h.jobs[2].resolve();await new Promise(r=>setImmediate(r));h.jobs[3].resolve();await Promise.all([c,d]);assert.equal(h.S.state.settings.game,'ptcg');assert.equal(h.location.hash,'#collection/cards');
}
// Browser Back supersedes pending switching; a write finishing late never pushes history.
{
 const h=harness('mtg','#search');await h.context.go('#sets');h.slow(true);
 const switchJob=h.context.switchGame('ptcg');h.history.go(-1);h.jobs[0].resolve();await new Promise(r=>setImmediate(r));h.jobs[1].resolve();await switchJob;await new Promise(r=>setImmediate(r));
 assert.equal(h.S.state.settings.game,'mtg');assert.equal(h.location.hash,'#search');assert.equal(h.entries.length,2);assert.equal(h.paints.at(-1).game,'mtg');
}
// A→B→A invalidates the first A token even when game/hash are equal again.
{
 const h=harness('mtg','#search'),stamp=h.run('navigationStamp()');await h.context.switchGame('ygo');await h.context.switchGame('mtg');assert.equal(h.run('navigationCurrent')(stamp),false);
}
console.log('PASS: all-pair semantic routes, aliases, malformed IDs, actual app history/scroll/controller, filters and saved-data isolation, same-ID tabs, save/dialog rejection, storage rollback, latest intent, Back supersession and A→B→A guards.');

// Explicit parent links retain their prior scroll, but cross-game parent mapping starts at top.
{
 const h=harness('ygo','#sets');await h.context.go('#set/source-only');await h.context.go('#sets');assert.equal(h.scrolls.at(-1),175);await h.context.go('#set/source-only');await h.context.switchGame('ptcg');assert.equal(JSON.stringify(h.scrolls.at(-1)),JSON.stringify({top:0}));
}
// Answer links honor blocked switches and retire late resource lookups.
{
 let game='mtg',opens=0,revision=0,finish;
 const T={game:()=>game,cardOf:()=>null,SOURCES:{ygo:{byName:()=>new Promise(r=>finish=r)}}};
 const tools=makeAskTools({S:{},T,A:{setGame:async()=>false,tCard:()=>opens++},go:()=>opens++,navigationStamp:()=>revision+1,navigationCurrent:s=>s===revision+1});
 await tools.open({kind:'deck',game:'ygo',ref:'source-only'});assert.equal(opens,0,'blocked game change cannot open a resource in the wrong game');
 game='ygo';const pending=tools.open({kind:'card',game:'ygo',ref:'unknown'});revision+=2;finish({id:'late-card'});await pending;assert.equal(opens,0,'late lookup cannot reopen a card on another visit');
}
console.log('PASS: parent-list scroll and guarded AI answer navigation.');

// Actual shared decoder and queued set opener cannot publish from an abandoned visit.
{
 const h=harness('mtg','#shared/fixture'),pending=[];
 h.context.decodeShare=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
 h.context.resolveNames=async()=>({total:0});h.context.T.ensureMany=async()=>{};
 vm.runInContext(app.slice(app.indexOf('async function openShared('),app.indexOf('// Link back to a shared deck')),h.context);
 const old=h.context.openShared('fixture');await h.context.switchGame('ygo');await h.context.switchGame('mtg');
 pending[0].resolve({cards:[{name:'old resource'}]});await old;assert.equal(h.S.ui.shared.deck,null);assert.equal(h.location.hash,'#decks/inspiration');
 const queuedLine=app.split('\n').find(line=>line.includes('tcgCtx.openSet?.(id, false, g)'));
 const queued=[],calls=[],screen=h.run('navigationStamp()');
 Function('ui','T','g','setTimeout','navigationCurrent','screen','tcgCtx',queuedLine)({view:'set',tsetId:'source-only'}, {ui:()=>({set:{id:''}})}, 'ygo', fn=>queued.push(fn), h.run('navigationCurrent'),screen,{openSet:(...args)=>calls.push(args)});
 await h.context.switchGame('ptcg');queued[0]();assert.equal(calls.length,0,'scheduled source set ID is never opened under a different game');
}
console.log('PASS: actual shared-decode and scheduled exact-set callbacks are retired before target installation.');

// Startup traversal never writes the initially blank workspace before storage is loaded.
{
 const h=harness('mtg','#search');h.run('navigationReady=false');await h.context.switchGame('ygo');h.handlers.popstate();assert.equal(h.S.state.settings.game,'mtg');assert.equal(h.entries.length,1);assert.equal(h.paints.length,0);
}
console.log('PASS: startup navigation is gated until the saved workspace is loaded.');

// Actual workspace writers/actions share the real navigation boundary. Only disk,
// rendering and provider transport are bounded fixtures; normalize is production.
const {blank, S:realStore}=await import('./store.js');
const {validateWorkspace}=await import('./confidence.js');
const RealT=await import('./tcg.js');
const {normalizeYgo}=await import('./ygo.js');
const {normalizePtcg}=await import('./ptcg.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
function workspaceHarness(game='mtg',hash='#collection/cards',{real=false}={}) {
 const h=harness(game,hash),c=h.context,hook=h.run('workspaceTransition'),disk=new Map();
 const clean=blank();clean.settings.game=game;clean.tcg={ygo:{collection:[],wishlist:[],decks:[{id:'same-id',name:'YGO source',format:'tcg',zones:{main:[],extra:[],side:[]}}]},ptcg:{collection:[],wishlist:[],decks:[{id:'same-id',name:'Pokemon source',format:'standard',zones:{main:[],extra:[],side:[]}}]}};
 clean.decks=[{id:'same-id',name:'Magic source',format:'Standard',cards:[]}];h.S.state=validateWorkspace(clean);h.S.catalog={};
 if(real){realStore.state=h.S.state;realStore.ui=h.S.ui;Object.defineProperty(h.S,'state',{get:()=>realStore.state,set:value=>{realStore.state=value;},configurable:true});}
 const io={writes:[],reject:false,gate:null};
 Object.assign(c,{refreshProfileAvatar(){},createAccountWorkspaces:()=>({guard:null}),A:{},C:{},structuredClone,recordHomeDeckWork,mergeValueHistory,normalize:validateWorkspace,blank,stripCache:s=>s,STORAGE:'workspace',RECOVERY:'recovery',
  changedConditionLots:()=>[],refreshChangedConditions(){},afterLocalSave(){},refreshSheet(){},saveCatalogSoon(){},haptic(){},flyToCollection(){},autoEnrich(){},setTimeout(){},lastActTarget:null,
  ask:async()=>true,readBackup:async()=>({next:c.imported,cache:{}}),sumQty:rows=>rows.reduce((n,r)=>n+r.qty,0),slim:x=>x,
  readRecord:async key=>structuredClone(disk.get(key)),
  writeRecords:async records=>{io.writes.push(structuredClone(records));if(io.gate){const gate=io.gate;io.gate=null;await gate.promise;}if(io.reject===true || typeof io.reject==='function'&&io.reject(records))throw Error('fixture disk full');for(const[k,v]of records)disk.set(k,structuredClone(v));},
  clearAskConversations(){},clearRulesConversations(){},rulesGuideOrigin:null,cloudInfo:()=>({user:{id:'fixture-owner'}}),isEmptyWorkspace:()=>false});
 vm.runInContext(app.slice(app.indexOf('let lastUndo = null;'),app.indexOf('\nconst safely ='))+'\n'+app.slice(app.indexOf('A.undo = async'),app.indexOf('\nA.nextFact ='))+'\n'+app.slice(app.indexOf('C.restoreBackup = async'),app.indexOf('\nA.reset =')),c);
 c.T.readLegacyTcgValueHistory=()=>[];
 c.adoptionHook=hook;h.run('workspaceTransition=adoptionHook');
 vm.runInContext('cloudHooks = ({'+app.slice(app.indexOf('    apply: async (data,{owner,current}={}) => {'),app.indexOf('    backup: async'))+'});',c);
 h.location.href='https://fixture.invalid/'+hash;
 return {...h,c,io,disk};
}
const aligned=h=>{const game=h.S.state.settings.game;assert.equal(h.run('activeEntry.game'),game);assert.equal(h.history.state.cardstashy.game,game);assert.equal(h.history.state.cardstashy.route,h.location.hash);};
{
 const h=workspaceHarness(),c=h.c;
 await c.commit(s=>s.settings.authorName='Edited',{undo:'Edited profile',enrich:false});
 await c.switchGame('ygo');await c.A.undo();aligned(h);assert.equal(h.S.state.settings.game,'mtg');assert.equal(h.S.state.settings.authorName||'','');
 assert.equal(await c.switchGame('ygo'),true,'the new selected game is not a false no-op after Undo');await c.go('#sets');aligned(h);assert.equal(h.S.state.settings.game,'ygo');
}
for(const action of ['import','recovery','cloud','direct']) {
 const h=workspaceHarness('ygo','#tdeck/same-id/versions'),c=h.c,next=structuredClone(h.S.state);next.settings.game='mtg';next.settings.authorName='Adopted '+action;
 c.imported=next;h.disk.set('recovery',next);
 if(action==='import')await c.C.restoreBackup({files:[{}]});else if(action==='recovery')await c.A.undoRestore();else if(action==='cloud')await c.cloudHooks.apply(next);else await c.replaceWorkspace(next);
 const targetGame=action==='cloud'?'ygo':'mtg';
 aligned(h);assert.equal(h.location.hash,action==='cloud'?'#tdeck/same-id/versions':'#decks/mine');assert.equal(h.S.ui.tdeckId,action==='cloud'?'same-id':null);assert.equal(h.S.state.settings.authorName,'Adopted '+action);assert.equal(h.disk.get('workspace').settings.game,targetGame);
 assert(h.hooks.some(x=>Array.isArray(x)&&x[0]==='before'&&x[1]==='ygo'&&x[2]===targetGame));
 await c.go('#search');aligned(h);assert.equal(h.S.state.settings.game,targetGame,'automatic cloud adoption preserves device navigation; explicit restore adopts the selected backup');
}
// Failed writes and existing ownership/save gates keep source state, route and Undo.
for(const reason of ['disk','scan','dialog','account']) {
 const h=workspaceHarness('ygo','#scan'),c=h.c,next=structuredClone(h.S.state);next.settings.game='mtg';
 h.run('lastUndo={state:structuredClone(S.state),label:"Keep this Undo"}');const before=JSON.stringify(h.S.state),entry=JSON.stringify(h.history.state);
 if(reason==='disk')h.io.reject=true;else if(reason==='scan')h.scanSaving(true);else if(reason==='dialog')h.block(true);
 if(reason==='account')assert.equal(await c.replaceWorkspace(next,{guard:()=>false}),false);
 else await assert.rejects(c.replaceWorkspace(next),reason==='disk'?/disk full/:reason==='scan'?/saving your scans/:/current edit/);
 assert.equal(JSON.stringify(h.S.state),before);assert.equal(JSON.stringify(h.history.state),entry);assert.equal(h.run('lastUndo.label'),'Keep this Undo');aligned(h);
 if(reason!=='disk')assert.equal(h.io.writes.length,0);
}
// ask() resolves before its settled native dialog finishes its close animation.
{
 const h=workspaceHarness('ygo','#settings'),next=structuredClone(h.S.state);next.settings.game='mtg';
 h.c.document.querySelectorAll=selector=>selector==='dialog[open]'?[{matches:s=>s==='dialog.cf-dialog.closing'}]:[];
 await h.c.replaceWorkspace(next);aligned(h);assert.equal(h.S.state.settings.game,'mtg');
}
// Undo may keep a read-only card open, but never bypass an editor or another modal.
{
 const h=harness(),dialogs=[{id:'sheet',matches:()=>false}];
 h.context.document.querySelectorAll=selector=>selector==='dialog[open]'?dialogs:[];
 for(const type of ['card','tcard']){h.S.ui.sheetCtx={type};assert.equal(h.run('gameChangeBlocked()'),true);assert.equal(h.run('gameChangeBlocked({allowCardSheet:true})'),false);}
 h.S.ui.sheetCtx={type:'own'};assert.equal(h.run('gameChangeBlocked({allowCardSheet:true})'),true);
 h.S.ui.sheetCtx={type:'card'};dialogs.push({id:'settingsDialog',matches:()=>false});assert.equal(h.run('gameChangeBlocked({allowCardSheet:true})'),true);
}
// New user intent during adoption wins; old navigation writes cannot overwrite it.
for(const fail of [false,true]) {
 const h=workspaceHarness('mtg','#set/source-only'),c=h.c,gate=deferred(),next=structuredClone(h.S.state);next.settings.game='ptcg';next.settings.authorName='Replacement';h.io.gate=gate;
 const replace=c.replaceWorkspace(next);await tick();const later=c.switchGame('ygo');assert.equal(h.paints.length,0);
 h.io.reject=fail?(records=>records.some(([key,value])=>key==='workspace'&&value.settings.authorName==='Replacement')):false;gate.resolve();if(fail)await assert.rejects(replace,/disk full/);else await replace;
 h.io.reject=false;await later;aligned(h);assert.equal(h.S.state.settings.game,'ygo');assert.equal(h.location.hash,'#sets');assert.equal(h.S.state.settings.authorName||'',fail?'':'Replacement');
}
for(const fail of [false,true]) {
 const h=workspaceHarness('mtg','#set/source-only'),c=h.c,gate=deferred(),next=structuredClone(h.S.state);next.settings.game='ptcg';next.settings.authorName='Later replacement';h.io.gate=gate;
 const earlier=c.switchGame('ygo');await tick();const replace=c.replaceWorkspace(next);gate.resolve();
 // Fail only the replacement, not the already-requested navigation write.
 if(fail){const write=c.writeRecords;c.writeRecords=async records=>{if(records.some(([key,value])=>key==='workspace'&&value.settings.authorName==='Later replacement'))throw Error('replacement rejected');return write(records);};}
 await earlier;if(fail)await assert.rejects(replace,/replacement rejected/);else await replace;await tick();aligned(h);
 assert.equal(h.S.state.settings.game,fail?'ygo':'ptcg');assert.equal(h.location.hash,'#sets');
}
// Independent failures of old navigation and subsequent adoption cannot let
// the failed visit rewrite a successfully adopted workspace.
for(const failNav of [true,false])for(const failReplacement of [true,false]){
 const h=workspaceHarness('mtg','#set/source-only'),c=h.c,gate=deferred(),next=structuredClone(h.S.state);next.settings.game='ptcg';next.settings.authorName='Replacement fail matrix';h.io.gate=gate;
 const earlier=c.switchGame('ygo');await tick();const replacing=c.replaceWorkspace(next);
 h.io.reject=records=>records.some(([key,value])=>key==='workspace'&&(value.settings.authorName==='Replacement fail matrix'?failReplacement:failNav));
 gate.resolve();await earlier;if(failReplacement)await assert.rejects(replacing,/disk full/);else await replacing;
 await tick();aligned(h);assert.equal(h.S.state.settings.game,failReplacement?(failNav?'mtg':'ygo'):'ptcg');
}
console.log('PASS: actual Undo/import/recovery/cloud writers, production normalization, scanner/save/account gates, failed storage and both queued navigation/replacement orderings stay aligned.');

// The browser dispatches popstate/hashchange before an asynchronous rollback.
{
 const h=harness('mtg','#search');await h.context.switchGame('ygo');await h.context.go('#sets');await h.context.switchGame('ptcg');
 const traverse=h.history.go,rollbacks=[];h.history.go=delta=>rollbacks.push(delta);h.block(true);traverse(-1);await tick();
 assert.deepEqual(rollbacks,[1],'one rejected visit schedules only one rollback despite both browser events');traverse(rollbacks.shift());await tick();assert.equal(h.history.state.cardstashy.game,'ptcg');assert.equal(h.entries.length,4);
}
console.log('PASS: asynchronous blocked Back deduplicates popstate/hashchange rollback without overshooting a forward entry.');

// Real TCG registrations, with transport only mocked. All card actions must retain
// the initiating game and visit across lookup/queued-write boundaries.
globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.document={querySelector:()=>null,querySelectorAll:()=>[]};globalThis.window={scrollTo(){}};
globalThis.fetch=async()=>{throw Error('External network forbidden in navigation unit fixtures');};
Object.defineProperty(globalThis,'navigator',{value:{onLine:false},configurable:true});
function registerReal(h) {
 const c=h.c;let sheets=0;globalThis.location=h.location;
 RealT.registerTcg({A:c.A,C:{},I:{},commit:c.commit,render:c.render,toast:c.toast,go:c.go,closeSheet:c.closeSheet,openSheet(){sheets++;},busy:()=>()=>{},writeRecord:async()=>{},switchGame:c.switchGame,navigationStamp:h.run('navigationStamp'),navigationCurrent:h.run('navigationCurrent')});
 return ()=>sheets;
}
for(const method of ['tDeckAdd','tDeckAddName','tFindName'])for(const returnToSource of [false,true]) {
 const h=workspaceHarness('ygo','#tdeck/same-id/cards',{real:true}),count=registerReal(h),gate=deferred(),id='nav-late-'+method+'-'+returnToSource;
 const card=normalizeYgo({id,name:'Fixture YGO Monster',type:'Normal Monster',frameType:'normal',card_prices:[{tcgplayer_price:'1'}],misc_info:[{formats:['TCG']}]});
 const originalGet=RealT.SOURCES.ygo.get,originalSearch=RealT.SOURCES.ygo.search;
 RealT.SOURCES.ygo.get=async()=>gate.promise;RealT.SOURCES.ygo.search=async()=>({cards:[await gate.promise]});
 try {
  const pending=h.c.A[method]({dataset:{id,name:card.name,deck:'same-id'}});await tick();await h.c.switchGame('ptcg');if(returnToSource)await h.c.switchGame('ygo');gate.resolve(card);await pending;
  for(const game of ['ygo','ptcg'])assert.deepEqual(realStore.state.tcg[game].decks[0].zones.main,[]);
  assert.equal(count(),0);assert(!h.io.writes.some(records=>records.some(([,state])=>JSON.stringify(state).includes(id))),'no foreign or stale card enters any durable write payload');aligned(h);
 } finally {RealT.SOURCES.ygo.get=originalGet;RealT.SOURCES.ygo.search=originalSearch;}
}
{
 const h=workspaceHarness('ptcg','#tdeck/same-id/cards',{real:true});registerReal(h);const gate=deferred();
 const card=normalizePtcg({id:'nav-cheapest-source',name:'Fixture Pokemon',category:'Pokemon',stage:'Basic',set:{id:'fxa'},legal:{standard:true,expanded:true},variants:{normal:true},pricing:{tcgplayer:{normal:{marketPrice:5}}}});
 const originalGet=RealT.SOURCES.ptcg.get,originalCheapest=RealT.SOURCES.ptcg.cheapestPrint;
 RealT.SOURCES.ptcg.get=async()=>card;await RealT.ensureCard('ptcg',card.id);h.S.state.tcg.ptcg.decks[0].zones.main=[{cardId:card.id,name:card.name,qty:1}];
 RealT.SOURCES.ptcg.cheapestPrint=async()=>gate.promise;
 try {const pending=h.c.A.tDeckCheapest({dataset:{id:'same-id'}});await tick();await h.c.switchGame('ygo');gate.resolve({...card,id:'nav-cheapest-late'});await pending;assert.equal(h.S.state.tcg.ptcg.decks[0].zones.main[0].cardId,card.id);assert.deepEqual(h.S.state.tcg.ygo.decks[0].zones.main,[]);aligned(h);}
 finally{RealT.SOURCES.ptcg.get=originalGet;RealT.SOURCES.ptcg.cheapestPrint=originalCheapest;}
}
// A resolved Add can still be queued behind an unrelated write when navigation
// or a workspace replacement supersedes it. Recheck ownership inside commit.
for(const replacement of [false,true])for(const method of ['tDeckAdd','tDeckAddName']) {
 const h=workspaceHarness('ygo','#tdeck/same-id/cards',{real:true});registerReal(h);const gate=deferred(),id='queued-'+method+'-'+replacement;
 const card=normalizeYgo({id,name:'Queued fixture monster',type:'Normal Monster',frameType:'normal',misc_info:[{formats:['TCG']}]});
 const get=RealT.SOURCES.ygo.get,search=RealT.SOURCES.ygo.search;RealT.SOURCES.ygo.get=async()=>card;RealT.SOURCES.ygo.search=async()=>({cards:[card]});
 try {
  h.io.gate=gate;const unrelated=h.c.commit(s=>s.settings.authorName='Earlier edit',{enrich:false});await tick();
  const next=structuredClone(h.S.state);next.settings.game='ptcg';next.tcg.ygo.decks=[];
  const replace=replacement?h.c.replaceWorkspace(next):null;
  const pending=h.c.A[method]({dataset:{id,name:card.name,deck:'same-id'}});await tick();
  const navigation=replacement?null:h.c.switchGame('ptcg');gate.resolve();await Promise.all([unrelated,replace,pending,navigation]);
  aligned(h);assert.equal(h.S.state.settings.game,'ptcg');assert.equal(h.S.state.tcg.ygo.decks.length,replacement?0:1);
  assert(!h.io.writes.some(records=>records.some(([,state])=>JSON.stringify(state).includes(id))),'queued stale Add cannot revive a deleted deck or write a foreign card');
 } finally {RealT.SOURCES.ygo.get=get;RealT.SOURCES.ygo.search=search;}
}
for(const target of ['ygo','ptcg'])for(const source of ['mtg',target==='ygo'?'ptcg':'ygo']) {
 const h=workspaceHarness(source,'#shared/foreign-'+target,{real:true});registerReal(h);
 h.S.ui.shared.deck={game:target,name:'Foreign fixture',format:target==='ygo'?'tcg':'standard',zones:{main:[],extra:[],side:[]},about:'Synthetic only',author:'Fixture'};
 await h.c.A.tSharedBuild();aligned(h);assert.equal(h.S.state.settings.game,target);const deck=h.S.state.tcg[target].decks.at(-1);assert(h.location.hash==='#tdeck/'+deck.id);assert.equal(h.S.ui.tdeckId,deck.id);assert.equal(h.S.state.decks.length,1);
}
console.log('PASS: actual late TCG Add/AddName/find/cheapest cannot contaminate another game or reopen stale UI; foreign shared copies save and open only in their owning game.');

for(const queuedReplacement of [false,true]) {
 const h=workspaceHarness('mtg','#shared/foreign-ygo',{real:true});registerReal(h);const gate=deferred();
 h.S.ui.shared.deck={game:'ygo',name:'Queued shared fixture',format:'tcg',zones:{main:[],extra:[],side:[]},about:'Synthetic',author:'Fixture'};
 h.io.gate=gate;
 if(queuedReplacement){
  const next=structuredClone(h.S.state);next.settings.game='ptcg';next.settings.authorName='New workspace';
  const replacing=h.c.replaceWorkspace(next);await tick();const copying=h.c.A.tSharedBuild();gate.resolve();await Promise.all([replacing,copying]);
  aligned(h);assert.equal(h.S.state.settings.game,'ptcg');assert.equal(h.S.state.tcg.ygo.decks.length,1,'stale shared action cannot add into replacement workspace');
 } else {
  const copying=h.c.A.tSharedBuild();await tick();await h.c.go('#sets');gate.resolve();await copying;
  aligned(h);assert.equal(h.S.state.settings.game,'mtg');assert.equal(h.location.hash,'#sets','a saved copy never overrides newer navigation');assert.equal(h.S.state.tcg.ygo.decks.length,2,'already authorized in-flight copy is saved exactly once in its owning game');
 }
}
console.log('PASS: queued foreign shared copy cannot leak into a replacement workspace or override a newer route.');

// Blank and legacy workspaces do not require settings.game. Use the production
// effective-game reader and real scanner hooks, not the permissive stub above.
const {registerScanner}=await import('./scancam.js');
for(const source of GAME_ROUTES)for(const action of ['reset','example','import','recovery','undo','direct'])for(const legacyGame of (['reset','example'].includes(action)?[undefined]:[undefined,'unsupported-legacy-game'])) {
 const h=workspaceHarness(source,'#settings',{real:true}),c=h.c;let serial=0;
 c.T.game=RealT.game;c.T.isTcg=RealT.isTcg;
 h.S.ui.scan={mode:'photo',url:null,cands:[],confirm:{game:source,i:0,qty:7,condition:'Heavily Played',lang:'fr',finish:'nonfoil',saving:false}};
 registerScanner(Object.assign(c.scanCtx,{A:{},C:{},game:RealT.game,render(){},toast(){}}));
 Object.assign(c,{cloudInfo:()=>({user:null}),detachDeviceSync(){},meta:name=>({name}),uid:()=>`example-${++serial}`});
 vm.runInContext(app.slice(app.indexOf('A.reset = async'),app.indexOf('A.persist = async')),c);
 // Exercise real file parsing as well as the real restore action/validator.
 vm.runInContext(app.slice(app.indexOf('async function readBackup('),app.indexOf('C.checkBackup = async')),c);
 const next=structuredClone(h.S.state);delete next.settings.game;if(legacyGame!==undefined)next.settings.game=legacyGame;
 const before=structuredClone(h.S.state);h.disk.set('recovery',next);
 if(action==='reset')await c.A.reset();
 else if(action==='example')await c.A.loadExample();
 else if(action==='import')await c.C.restoreBackup({files:[{size:512,text:async()=>JSON.stringify(next)}]});
 else if(action==='recovery')await c.A.undoRestore();
 else if(action==='undo'){c.legacyUndo=next;h.run('lastUndo={state:legacyUndo,label:"Legacy edit"}');await c.A.undo();}
 else await c.replaceWorkspace(next,{recovery:true});
 await tick();
 assert.equal(RealT.game(),'mtg',`${source} ${action} adopts the effective legacy MTG game`);
 assert.equal(h.run('activeEntry.game'),'mtg');assert.equal(h.history.state.cardstashy.game,'mtg');assert.equal(h.history.state.cardstashy.route,h.location.hash);
 assert.equal(h.S.state.settings.game,legacyGame,'navigation does not expand or rewrite the replacement schema');
 assert.equal(h.disk.get('workspace').settings.game,legacyGame);assert.equal(h.io.writes.length,1,'actual replacement persists once, without an extra selected-game rewrite');
 assert.equal(h.location.hash,action==='reset'?'#home':action==='example'?'#collection':'#settings');
 if(action==='reset')assert.equal(h.S.state.collection.length,0);
 else if(action==='example'){assert.equal(h.S.state.example,true);assert.equal(h.S.state.collection.length,8);}
 else assert.deepEqual(h.S.state.decks,next.decks);
 if(action!=='undo')assert.deepEqual(h.disk.get('recovery'),before,'existing recovery-copy semantics remain intact');
 if(source==='mtg')assert.equal(h.S.ui.scan.confirm.qty,7,'same-game adoption retains the manual review');
 else {assert.equal(h.S.ui.scan.confirm,null,'foreign source review is not copied into the default MTG scan');await c.switchGame(source);assert.equal(h.S.ui.scan.confirm.qty,7,'real scanner retains the source draft');}
}
console.log('PASS: real Reset/Load Example/file import/recovery/Undo and direct legacy adoption resolve missing/unsupported game as MTG through the real scanner lifecycle, without rewriting replacement settings.');

// Real Undo and real scanner hooks together: retaining a device is not an
// exemption from the workspace revision, write/save gates or later navigation.
const {releaseOCR}=await import('./scancam.js');
const {loadBatch,saveBatch}=await import('./scan-batch.js');
const scanStorage=new Map();
globalThis.localStorage={getItem:k=>scanStorage.get(k)||null,setItem:(k,v)=>scanStorage.set(k,v)};
document.getElementById=()=>null;
window.Tesseract={createWorker:async()=>({recognize:async()=>({data:{text:''}}),terminate:async()=>{}})};
function liveWorkspace(game='mtg'){
 const h=workspaceHarness(game,'#scan',{real:true}),ctx=h.c.scanCtx;let stops=0,opens=0;
 h.c.T.game=RealT.game;h.c.T.isTcg=RealT.isTcg;h.S.ui.scan={};scanStorage.clear();
 const track={readyState:'live',stop(){stops++;this.readyState='ended';},getCapabilities:()=>({})};
 navigator.mediaDevices={getUserMedia:async()=>{opens++;return {getTracks:()=>[track],getVideoTracks:()=>[track]};}};
 registerScanner(Object.assign(ctx,{A:{},C:{},game:RealT.game,render(){},toast(){}}));
 return {...h,ctx,track,get stops(){return stops;},get opens(){return opens;}};
}
for(const game of GAME_ROUTES)for(const failure of [false,true]){
 const h=liveWorkspace(game),c=h.c;
 try{
  await h.ctx.A.scanStart();saveBatch([{id:'pending',game,captureRevision:'pending-v1',status:'review',qty:2}]);
  await c.commit(s=>{(game==='mtg'?s.collection:s.tcg[game].collection).push({id:'saved-lot',cardId:'fixture-card',name:'Fixture card',qty:1,finish:'nonfoil',condition:'Near Mint',lang:'en'});},{undo:'Added fixture card',enrich:false});
  const stamp=h.run('navigationStamp()'),batch=JSON.stringify(loadBatch());h.io.reject=failure;
  if(failure)await assert.rejects(c.A.undo(),/disk full/);else await c.A.undo();
  aligned(h);assert.equal(h.S.ui.scan.camOn,true);assert.equal(h.track.readyState,'live');assert.equal(h.stops,0);assert.equal(h.opens,1);
  assert.equal((game==='mtg'?h.S.state.collection:h.S.state.tcg[game].collection).length,failure?1:0,'Undo rolls back only a successfully persisted lot');
  assert.equal(JSON.stringify(loadBatch()),batch);assert.equal(h.run('navigationCurrent')(stamp),false,'Undo retires old workspace callbacks even on the same game/route');
  if(failure){assert.equal(h.run('lastUndo.label'),'Added fixture card');h.io.reject=false;await c.A.undo();assert.equal(h.stops,0);}
 }finally{h.ctx.stopCamera();}
}
for(const action of ['import','recovery','cloud','direct']){
 const h=liveWorkspace(),c=h.c,next=structuredClone(h.S.state);
 try{
  await h.ctx.A.scanStart();c.imported=next;h.disk.set('recovery',next);
  if(action==='import')await c.C.restoreBackup({files:[{}]});else if(action==='recovery')await c.A.undoRestore();else if(action==='cloud')await c.cloudHooks.apply(next);else await c.replaceWorkspace(next);
  aligned(h);assert.equal(h.stops,1);assert.equal(h.S.ui.scan.camOn,false,action+' does not inherit Undo camera continuity');assert.equal(h.opens,1);
 }finally{h.ctx.stopCamera();}
}
for(const later of ['navigation','replacement']){
 const h=liveWorkspace(),c=h.c,gate=deferred();
 try{
  await h.ctx.A.scanStart();await c.commit(s=>s.settings.authorName='Undo me',{undo:'Edited profile',enrich:false});
  h.io.gate=gate;const undo=c.A.undo();await tick();assert.equal(h.stops,0);
  const next=structuredClone(h.S.state);next.settings.game='ygo';next.settings.authorName='Replacement';
  const newer=later==='navigation'?c.switchGame('ygo'):c.replaceWorkspace(next);
  gate.resolve();await Promise.all([undo,newer]);aligned(h);assert.equal(h.S.state.settings.game,'ygo');assert.equal(h.stops,1);assert.equal(h.S.ui.scan.camOn,false);assert.equal(h.opens,1);
 }finally{h.ctx.stopCamera();}
}
{
 const h=liveWorkspace(),c=h.c,gate=deferred();
 try{
  await h.ctx.A.scanStart();await c.commit(s=>s.settings.authorName='Undo me',{undo:'Edited profile',enrich:false});
  h.io.gate=gate;const undo=c.A.undo();await tick();
  const switching=c.switchGame('ygo'),next=structuredClone(h.S.state);next.settings.authorName='Unrelated replacement';
  const replacing=c.replaceWorkspace(next);gate.resolve();await Promise.all([undo,switching,replacing]);await tick();
  aligned(h);assert.equal(h.S.state.settings.game,'mtg');assert.equal(h.S.state.settings.authorName,'Unrelated replacement');
  assert.equal(h.stops,1,'an unrelated same-game replacement must not inherit suspended Undo camera authority');assert.equal(h.S.ui.scan.camOn,false);
 }finally{h.ctx.stopCamera();}
}
{
 const h=liveWorkspace(),c=h.c;
 try{
  await h.ctx.A.scanStart();await c.commit(s=>s.settings.authorName='Keep this edit',{undo:'Edited profile',enrich:false});
  for(const flag of ['batchSaving','sessionSaving']){
   const writes=h.io.writes.length;h.S.ui.scan[flag]=true;await assert.rejects(c.A.undo(),/saving your scans/);assert.equal(h.io.writes.length,writes);assert.equal(h.stops,0);assert.equal(h.run('lastUndo.label'),'Edited profile');h.S.ui.scan[flag]=false;
  }
 }finally{h.ctx.stopCamera();}
}
await releaseOCR();
console.log('PASS: real Undo rolls back saved lots while retaining live devices and pending captures for all games; failed writes retry, replacements stop, old workspace authority retires, and newer navigation/save gates remain authoritative.');
