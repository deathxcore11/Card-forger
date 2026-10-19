import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SheetHistory,BROWSE_TYPES} from './sheet-history.js';
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function matchupContextDeck('),end=source.indexOf('A.amColor=',start);
let deck={id:'deck',format:'Standard',cards:[{name:'Player',qty:4}],side:[]},game='mtg',epoch=0,refreshes=0,renders=0,cancelled=0,opened=[],cardOpens=[];
const S={ui:{sheetCtx:null}},A={card:t=>cardOpens.push(t)},state={opponent:{cards:[{name:'Opponent',qty:4}]}};
let resolveSelection;const controller={cancel(){cancelled++;},select:()=>new Promise(r=>resolveSelection=r),analyze:()=>Promise.resolve()};
const context=vm.createContext({S,A,T:{game:()=>game},currentDeck:()=>deck,mutationScope:()=>({epoch}),mutationCurrent:s=>s?.epoch===epoch,matchupFingerprint:d=>JSON.stringify(d),render:()=>renders++,refreshSheet:()=>refreshes++,renderMagicMatchupSheet:()=>'<sheet>',V:{deckList:()=>''},openSheet:(html,ctx)=>{opened.push(ctx);S.ui.sheetCtx=ctx;},createMagicMatchups:()=>controller,matchupState:()=>state,meta:()=>{},loadMetaData:()=>{},metaState:()=>{},mtgMetaKey:()=>{},resolveNames:()=>{},navigationStamp:()=>0,navigationCurrent:()=>true});
vm.runInContext(source.slice(start,end),context);
A.amOpen({dataset:{tab:'setup'}});assert.equal(S.ui.sheetCtx.type,'matchup');
A.amTab({dataset:{tab:'analysis'}});assert.equal(S.ui.sheetCtx.tab,'analysis');
A.amView({dataset:{mode:'gallery'}});assert.equal(S.ui.sheetCtx.view,'gallery');
A.amScenario({dataset:{id:'2'}});assert.equal(S.ui.sheetCtx.scenario,2);
A.amCard({dataset:{name:'Opponent'}});assert.equal(cardOpens.length,1);assert.equal(cardOpens[0].dataset.readOnly,'1');
A.amCard({dataset:{name:'Unrelated'}});assert.equal(cardOpens.length,1);
const pending=A.amSelect();S.ui.sheetCtx={type:'card'};resolveSelection();await pending;assert.equal(S.ui.sheetCtx.type,'card','late selection cannot replace a nested card or closed sheet');
A.amOpen({dataset:{tab:'decks'}});const old=S.ui.sheetCtx;epoch++;A.amTab({dataset:{tab:'analysis'}});assert.equal(old.tab,'decks');A.amCard({dataset:{name:'Player'}});assert.equal(cardOpens.length,1,'stale account/workspace cannot open opponent cards');
A.amOpen({dataset:{tab:'setup'}});deck={...deck,cards:[{name:'Changed',qty:1}]};A.amView({dataset:{mode:'symbols'}});assert.equal(S.ui.sheetCtx.view,'compact','edited deck invalidates old matchup sheet');
assert(BROWSE_TYPES.has('matchup'));const history=new SheetHistory();const ctx={type:'matchup',deckId:'deck',tab:'analysis',scenario:2};history.push({ctx,scrollTop:320},{type:'card',name:'Opponent'});assert.deepEqual(history.pop(),{ctx,scrollTop:320});
assert(source.includes('t.dataset.readOnly ? null : t.dataset.deck'),'normal card detail must not inherit current-deck edit context');
assert(source.includes("sheetTrail.items?.some(item=>item.ctx?.type==='matchup')) aiMatchups.cancel()"),'closing nested matchup detail also cancels pending analysis');
console.log('PASS: scoped shared Matchup tabs/views/cards, nested Back state, stale selection/account/deck guards and close cancellation.');
let resolveClipboard;const sheet={open:true};Object.assign(context,{navigator:{clipboard:{readText:()=>new Promise(r=>resolveClipboard=r)}},$:()=>sheet,esc:x=>x});
vm.runInContext(source.slice(source.indexOf('let matchupImport=null;'),source.indexOf('const matchupImportCurrent=')),context);
A.amOpen({dataset:{tab:'setup'}});const countBefore=opened.length;const paste=A.amPaste();S.ui.sheetCtx=null;sheet.open=false;resolveClipboard('4 Player');await paste;assert.equal(opened.length,countBefore,'closing during clipboard permission/read cannot reopen the import sheet');
console.log('PASS: deferred clipboard completion cannot reopen a closed matchup.');
const trail=new SheetHistory(),saved={ctx:{type:'matchup',deckId:'deck',tab:'setup',side:'player'},scrollTop:200};trail.items.push(saved);let restored;
Object.assign(context,{sheetTrail:trail,restoreSheet:s=>{restored=s;S.ui.sheetCtx=s.ctx;},buildMatchupRequest:()=>({}),matchupImportCurrent:()=>true});
vm.runInContext('matchupImport={opponent:{name:"Pasted",cards:[{name:"Opponent",qty:4}]}};',context);
const useStart=source.indexOf('A.amImportUse=');vm.runInContext(source.slice(useStart,source.indexOf('\n',useStart)),context);
A.amImportUse();assert.equal(restored,saved);assert.equal(restored.ctx.tab,'decks');assert.equal(restored.ctx.side,'opponent');assert.equal(trail.length,0,'using an import returns to its original matchup rather than leaving a dead import in Back history');
console.log('PASS: pasted opponent returns to the existing shared matchup with no dead import history.');
// Execute the real navigation handler through its sheet-lifecycle phase.
const navStart=source.indexOf('function installNavigation('),navEnd=source.indexOf('\nconst navigation =',navStart);
const stop=Symbol('navigation phase complete');let closed=[];
const navContext=vm.createContext({S:{ui:{sheetCtx:null}},sheetTrail:{items:[]},activeEntry:{game:'mtg',route:'#deck/deck/matchups'},entryOrigins:new Map(),aiMatchups:{cancel(){}},clearGameContext(){},closeSheet:remember=>closed.push(remember),dismissRulesGuide(){throw stop;}});
vm.runInContext(source.slice(navStart,navEnd),navContext);
for(const [type,nested,route,want] of [['matchup',false,'#collection',true],['matchup-import',false,'#collection',true],['card',true,'#collection',true],['card',false,'#collection',false],['matchup',false,'#deck/deck/matchups',false],['printing-picker',false,'#collection',true]]){
 navContext.S.ui.sheetCtx={type};navContext.sheetTrail.items=nested?[{ctx:{type:'matchup'}}]:[];closed=[];
 try{navContext.installNavigation({game:'mtg',hash:route,mode:'pop'});}catch(error){if(error!==stop)throw error;}
 assert.deepEqual(closed,want?[false]:[],`${type}, nested=${nested}: close only departed matchup-origin sheets, without retaining stale return history`);
}
console.log('PASS: real navigation closes departed matchup/import/nested sheets while preserving unrelated and same-route sheets.');
