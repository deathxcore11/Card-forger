// Real Ask controller and transient history module. Synthetic DOM/history only;
// no local server, browser, provider, login, native gesture or network is used.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createAskNavigation,captureSheetForm,restoreSheetForm} from './ask-navigation.js';
import {sheetKey} from './sheet-history.js';
import {esc} from './ui.js';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const classes=()=>({add(){},remove(){}});
class Element{
 constructor(tag){this.tag=tag;this.classList=classes();this.children=[];this.handlers={};this.scrollTop=0;this.scrollHeight=700;this.value='';this.open=false;this.isConnected=false;this.parts={};if(tag==='dialog')for(const name of ['.ask-log','.ask-input','.ask-bar'])this.parts[name]=new Element('div');}
 setAttribute(){} addEventListener(name,fn){this.handlers[name]=fn;} append(node){this.children.push(node);node.isConnected=true;}
 querySelector(selector){return this.parts[selector]||null;}querySelectorAll(){return [];}
 showModal(){this.open=true;}close(){this.open=false;}remove(){this.isConnected=false;}focus(){this.focused=true;}
}
const askSource=readFileSync('ai-ask.js','utf8').replace(/^import .*;\n/gm,'').replace(/^export \{[^\n]+\n/gm,'').replaceAll('export ','');
function harness({underlay=null}={}){
 let sheet=underlay,scope={game:'mtg',account:1,workspace:1},resolveReply,reply=null,receipt=null,cancelled=0,opens=0;
 const location={href:'https://fixture.invalid/#home',hash:'#home'};
 const entries=[{state:{cardstashy:{entryId:'home',game:'mtg',route:'#home'}},url:location.href}];let index=0;
 const traversals=[];
 const history={get state(){return entries[index].state;},pushState(state,_,url){entries.splice(++index);entries.push({state:structuredClone(state),url});location.href=url;},replaceState(state,_,url){entries[index]={state:structuredClone(state),url};location.href=url;},go(delta){traversals.push(delta);const target=index+delta;assert(target>=0&&target<entries.length,'navigation never leaves the known origin');queueMicrotask(()=>{index=target;location.href=entries[index].url;nav.historyChanged();nav.historyChanged();});}};
 const context={brandMark:()=>'',aiOrb:()=>'',esc,fetch,AbortController,setTimeout:()=>{},navigator:{language:'en'},document:{createElement:tag=>new Element(tag),body:new Element('body')},runAskLoop:()=>reply?Promise.resolve(reply):new Promise(resolve=>resolveReply=resolve)};
 runInNewContext(askSource+'\nglobalThis.chat={openAsk,closeAsk,ask,restartAsk,clearAskConversations,get:()=>state};',context);
 const {chat}=context;
 const tools={reset(){},cancel(){cancelled++;},pendingItem:()=>receipt,preview:()=>'<button>Open deck</button>'};
 const formRoot=()=>({querySelectorAll:()=>sheet?.controls||[]});
 const capture=()=>sheet?{...sheet,form:captureSheetForm(formRoot()),trail:[...(sheet.trail||[])]}:null;
 const nav=createAskNavigation({history,location,sheetKey,beforeLeaveSheet:()=>{if(sheet?.building){sheet.building=false;sheet.html='stable deck';}},captureSheet:capture,closeAsk:()=>chat.closeAsk(),closeSheet:()=>{if(nav.closeInternal())return;nav.discard();sheet=null;},restoreSheet:s=>{nav.beforeSheet();sheet={...s,controls:(s.controls||[]).map(n=>({...n,value:n.defaultValue,checked:false})),trail:[...s.trail]};restoreSheetForm(formRoot(),s.form);nav.sheetOpened();}});
 const openSheet=(type='deck-flow',name='deck',scroll=0)=>{nav.beforeSheet();const prev=sheet;sheet={ctx:{type,name},html:name,scroll,trail:prev?[...prev.trail,prev]:[]};nav.sheetOpened();};
 const open=()=>{
  const identity={...scope},route=location.href;
  nav.open({current:()=>JSON.stringify(scope)===JSON.stringify(identity)&&location.href===route,show:()=>{opens++;chat.openAsk({game:scope.game,tools,onClose:()=>nav.rootClosed(),onRestart:()=>nav.restart(),show:s=>nav.handoff(()=>openSheet('deck-flow',s.ref))});}});
 };
 const answer=async(ref='deck-one')=>{receipt={kind:'build',game:'mtg',ref,openOnComplete:true};reply={text:'Ready '+ref,source:'app',show:[],suggestions:[]};await chat.ask('Build '+ref);};
 return {nav,chat,tools,history,entries,traversals,open,answer,openSheet,location,get sheet(){return sheet;},get index(){return index;},get cancelled(){return cancelled;},get opens(){return opens;},setScope:patch=>Object.assign(scope,patch),resolve:()=>resolveReply(reply||{text:'Late',source:'app'}),pending:()=>{reply=null;receipt={kind:'build',game:'mtg',ref:'late',openOnComplete:true};}};
}
{
 const h=harness();h.open();const conversation=h.chat.get();conversation.input.value='Keep this draft';conversation.log.scrollTop=213;conversation.buildContext={goal:'easy',budget:50};
 h.chat.closeAsk({handoff:true});await h.nav.handoff(()=>h.openSheet());
 assert.equal(h.index,2);assert.equal(h.sheet.ctx.type,'deck-flow');assert.equal(h.chat.get(),null);
 h.sheet.controls=[{tagName:'INPUT',type:'number',defaultValue:'50',value:'175',checked:false}];h.sheet.scroll=319;h.openSheet('card','Mountain',87);assert.equal(h.index,3);
 h.nav.back();h.nav.back();await tick();assert.equal(h.index,2,'duplicate Back does not skip a level');assert.equal(h.sheet.ctx.type,'deck-flow');assert.equal(h.sheet.scroll,319);assert.equal(h.sheet.controls[0].value,'175','unsent budget value survives nested-card Back');
 h.nav.back();await tick();assert.equal(h.index,1);assert.equal(h.sheet,null);assert.equal(h.chat.get().node,conversation.node);assert.equal(h.chat.get().input.value,'Keep this draft');assert.equal(h.chat.get().log.scrollTop,213);assert.equal(h.chat.get().buildContext.goal,'easy');
 h.history.go(1);await tick();assert.equal(h.sheet.ctx.type,'deck-flow');assert.equal(h.sheet.controls[0].value,'175','unsent budget value survives Forward');assert.equal(h.chat.get(),null);
 h.history.go(1);await tick();assert.equal(h.sheet.ctx.type,'card');assert.equal(h.sheet.scroll,87);
 h.nav.backToAsk();await tick();assert.equal(h.index,1);assert(h.chat.get());
 h.chat.closeAsk();await tick();assert.equal(h.index,0);assert.equal(h.chat.get(),null);assert.equal(h.sheet,null);
 assert.equal(JSON.stringify(h.entries).includes('Keep this draft'),false,'history never stores conversation content');
 h.history.go(1);await tick();assert(h.chat.get(),'Forward restores only the live in-memory conversation');
 const n=h.entries.length;h.open();assert.equal(h.entries.length,n,'repeated open adds no duplicate entry');
}
console.log('PASS: Ask → deck → card → Back to deck → Back to AI, Close, Forward, rapid Back, exact DOM/draft/scroll/build-context preservation and private history.');
{
 const h=harness();h.open();await h.answer();assert.equal(h.sheet.html,'deck-one');assert.equal(h.cancelled,0);assert.equal(h.chat.get(),null);
 h.nav.back();await tick();assert.equal(h.chat.get().history.at(-1).content,'Ready deck-one');
 h.pending();const old=h.chat.ask('A slow build');h.chat.closeAsk();h.open();await tick();h.resolve();await old;
 assert.equal(h.sheet,null,'a cancelled build cannot reopen after close/reopen');assert(h.chat.get());assert.equal(h.cancelled,1);
 await h.answer('deck-two');assert.equal(h.sheet.html,'deck-two');
 h.nav.backToAsk();await tick();await h.chat.restartAsk();assert.equal(h.chat.get().history.length,0);assert.equal(h.chat.get().input.value,'');
 await h.answer('deck-three');assert.equal(h.sheet.html,'deck-three');assert.equal(h.entries.length,3,'new build truncates obsolete Forward cards/decks');
}
console.log('PASS: actual automatic build receipt, cancelled/late result, immediate reopen, fresh request and New chat use the same controlled origin.');
for(const changed of [{game:'ygo'},{account:2},{workspace:2}]){
 const h=harness({underlay:{ctx:{type:'proven'},html:'private old deck',scroll:1,trail:[]}});h.open();await h.answer();h.setScope(changed);h.history.go(-1);await tick();assert.equal(h.chat.get(),null);assert.equal(h.sheet,null);assert.equal(h.nav.active,false,'changed scope never revives Ask');
}
{
 const h=harness();h.open();await h.answer();const work=h.nav.leave(true);await tick();await work;assert.equal(h.index,0);assert.equal(h.sheet,null);assert.equal(h.chat.get(),null);
 h.location.href='https://fixture.invalid/#collection';h.history.pushState({cardstashy:{entryId:'collection',route:'#collection'}},'',h.location.href);assert.equal(h.entries.length,2,'real navigation discards transient history rather than leaving Back traps');
}
{
 const original={ctx:{type:'proven',name:'Tournament deck'},html:'original deck',scroll:241,trail:[]};
 const h=harness({underlay:original});h.open();await h.answer();assert.equal(h.sheet.trail.length,0,'AI deck has its own origin, not an unrelated underlying card/deck');
 h.nav.backToAsk();await tick();assert(h.chat.get());assert.equal(h.sheet.html,'original deck');assert.equal(h.sheet.scroll,241);
 h.chat.closeAsk();await tick();assert.equal(h.sheet.html,'original deck','closing AI keeps the original non-AI origin');
}
{
 const h=harness();h.openSheet('proven','normal deck',200);h.openSheet('card','normal card');assert.equal(h.entries.length,1);assert.equal(h.nav.back(),false);assert.equal(h.nav.backToAsk(),false,'normal deck origins keep their existing path');
}
{
 const h=harness();h.open();await h.answer();h.openSheet('card','nested');h.nav.back();
 const exiting=h.nav.leave(true);await tick();await exiting;assert.equal(h.index,0,'Back followed immediately by route navigation unwinds every overlay level');assert.equal(h.nav.active,false);
}
{
 const h=harness();h.open();await h.answer();h.sheet.building=true;h.sheet.html='pending progress overlay';h.nav.back();await tick();h.history.go(1);await tick();assert.equal(h.sheet.html,'stable deck','Forward cannot revive a cancelled build progress overlay');
}
for(const changed of [{account:2},{workspace:2},{game:'ygo'}]){
 const h=harness();h.open();h.chat.closeAsk();h.open();h.setScope(changed);h.nav.discard();await tick();assert.equal(h.chat.get(),null,'queued reopen rechecks current identity after traversal/discard');assert.equal(h.nav.active,false);
}
{
 const h=harness();h.open();await h.answer();h.openSheet('card','nested');h.setScope({account:2});h.nav.discard();h.history.go(-1);await tick();assert.equal(h.index,0,'retired account layers skip only their known in-page history back to base');h.history.go(1);await tick();assert.equal(h.index,3,'Forward skips retired private layers without resurrecting content');assert.equal(h.nav.active,false);
}
{
 const h=harness({underlay:{ctx:{type:'proven'},html:'origin',scroll:1,trail:[]}});h.open();await h.answer();await h.nav.leave(true);assert.equal(h.sheet,null,'route departure closes the underlying sheet instead of leaving it above the new route');
}
{
 const h=harness();h.open();await h.answer();h.nav.backToAsk();await tick();await h.chat.restartAsk();assert.equal(h.entries.length,2,'New chat replaces the old AI visit from its real base, truncating old Forward decks');assert.equal(h.index,1);assert.equal(h.chat.get().history.length,0);
}
{
 const h=harness();h.open();await h.answer();h.openSheet('card','nested');h.nav.back();await tick();h.setScope({account:2});h.nav.discard();h.history.pushState({cardstashy:{entryId:'new',route:'#new'}},'','#new');h.history.go(-1);await tick();h.history.go(-1);await tick();assert.equal(h.index,0);h.history.go(1);await tick();assert.equal(h.index,2,'retired Forward never jumps into a truncated/unknown history position');
}
console.log('PASS: route/game/account/workspace invalidation, no duplicate traversal frames, underlying origin preservation, and non-AI deck isolation.');

// Verify shell integration against the actual action functions, not a duplicate
// implementation, and make the new module part of the existing offline shell.
const app=readFileSync('app.js','utf8');
assert.match(app,/function openSheet[^]*?askNavigation\?\.beforeSheet\(\)/);
assert.match(app,/askNavigation\?\.sheetOpened\(\);\s*wireSheetBack\(\)/);
assert.match(app,/if\(askNavigation\?\.historyChanged\(\)\)return;/);
assert.match(app,/else if\(askNavigation\?\.atSheet\)\{e.preventDefault\(\);askNavigation.backToAsk\(\);\}/);
assert.match(app,/aiBack.textContent="← Back to AI"/);
const actions=app.slice(app.indexOf('A.go ='),app.indexOf('A.routeHistoryBack='));
{
 const h=harness(),A={};let normalClosed=0,normalBack=0,picker=0;
 const S={ui:{sheetCtx:null}};runInNewContext(actions,{A,S,askNavigation:h.nav,closeSheet:()=>normalClosed++,restoreSheetHistory:()=>normalBack++,printingPicker:{cancel:()=>picker++},go:async hash=>{await h.nav.leave(true);h.history.pushState({cardstashy:{entryId:'new-route',route:hash}},'',hash);}});
 A.closeSheet();A.sheetHistoryBack();assert.equal(normalClosed,1);assert.equal(normalBack,1);
 h.open();await h.answer();h.openSheet('card','nested');A.sheetHistoryBack();await tick();assert.equal(h.sheet.ctx.type,'deck-flow');A.closeSheet();await tick();assert(h.chat.get());
 await h.answer('route-deck');h.openSheet('card','route-card');A.go({dataset:{to:'#collection'}});await tick();assert.equal(h.index,1);assert.equal(h.entries.length,2,'actual A.go removes overlay history before pushing route');
 S.ui.sheetCtx={type:'printing-picker'};A.sheetHistoryBack();assert.equal(picker,1,'printing-picker cancellation retains priority');
}
console.log('PASS: production shell Close/Back actions, native-bridge hook, Escape/backdrop/drag delegation and contextual desktop Back to AI are wired; physical gestures remain untested.');

{
 const h=harness(),A={};h.open();await h.answer();h.openSheet('card','Mountain');
 runInNewContext(app.slice(app.indexOf('A.wikiOpen='),app.indexOf('A.mtgWikiOpen=')),{A,T:{game:()=> 'mtg'},GAMES:{mtg:{}},accountGeneration:1,accountLocked:false,$:()=>({open:!!h.sheet}),closeSheet:()=>{if(!h.nav.closeInternal())h.nav.discard();},closeAsk:()=>h.chat.closeAsk(),switchGame:()=>{},go:async hash=>{await h.nav.leave(true);h.history.pushState({cardstashy:{entryId:'wiki',route:hash}},'',hash);}});
 await A.wikiOpen({dataset:{wikiTopic:'Mountain'}});await tick();assert.equal(h.index,1);assert.equal(h.entries.length,2,'production Wiki close-before-go unwinds the AI visit rather than stranding its history');assert.equal(h.sheet,null);
}
console.log('PASS: actual Wiki route departure and unsent budget control values survive the bounded navigation contract.');
