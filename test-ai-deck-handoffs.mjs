// Execute extracted production callback bodies. No reimplemented handoff logic,
// DOM browser, provider, account, or network is used in this regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {cardKey} from './core.js';
import {prepareMtgDeck} from './ai-deck-builder.js';
import {ASK_BUILD_ARGS,ASK_BUILD_CARDS,SAI,KCI} from './tests/ai-deck-build-fixtures.mjs';
const app=fs.readFileSync('app.js','utf8'),tcg=fs.readFileSync('tcg.js','utf8');
const catalog=Object.fromEntries(ASK_BUILD_CARDS.map(c=>[cardKey(c.name),c]));
const built=await prepareMtgDeck(ASK_BUILD_ARGS,{meta:n=>catalog[cardKey(n)],resolve:async n=>catalog[cardKey(n)],inv:n=>({available:n==='Island'?10:0}),api:async p=>({data:new URL(p,'https://fixture.invalid').searchParams.get('q').includes('is:commander')?[SAI]:ASK_BUILD_CARDS})});
let contextArgs,game='mtg',account=1,workspace=1,opened=0,saved=0,buys=[],tBuildCalls=[];const A={},S={state:{decks:[]},ui:{build:{busy:false},sheetCtx:null}},toasts=[];
const ctx={A,S,T:{game:()=>game},structuredClone,key:cardKey,makeAskTools:x=>(contextArgs=x,{}),openAsk:()=>{},mutationScope:()=>({account,workspace}),mutationCurrent:s=>s.account===account&&s.workspace===workspace,V:{buildSheet:()=>'<p>Real builder</p>'},openSheet:(_,c)=>{opened++;S.ui.sheetCtx=c;},toast:s=>toasts.push(s),formatOf:s=>({name:s}),scopedCommit:()=>{const owner=account,space=workspace;return async fn=>{if(owner!==account||space!==workspace)throw Error('stale');fn(S.state);saved++;};},uid:()=> 'saved-draft',withSnapshot:d=>d,sourceCredit:x=>x,buyMtg:async r=>{buys=r;return true;},tcgCtx:{}};
for(const name of ['go','navigationStamp','navigationCurrent','esc','api','resolve','cacheCard','loadSetIndex','loadMetaData','metaState','priceOf','inv','meta','collectionValue','lotPrice','mtgPower','shownPower','allCachedMeta','safely'])ctx[name]=()=>{};ctx.MTG_META_FORMATS=[];ctx.resolveNames=async()=>{};
vm.runInNewContext(app.slice(app.indexOf('let askTools = null;'),app.indexOf('A.buildFrom =')),ctx);A.askOpen();
const current=contextArgs.captureAskScope(),draft=structuredClone(built.draft);contextArgs.openMtgDraft(draft,current);assert.equal(opened,1);assert.equal(S.ui.build.results.Commander[0].total,100);assert.equal(S.ui.build.seed,KCI.name);assert.equal(S.ui.build.avail('Island'),10);assert.deepEqual(S.ui.build.results.Commander[0].cards,draft.cards);assert.equal(S.state.decks.length,0);
draft.cards[0].qty=80;assert.equal(S.ui.build.results.Commander[0].cards[0].qty,1,'exact draft is detached from caller mutations');
const snapshot=S.ui.build.results;S.ui.build.busy=true;contextArgs.openMtgDraft(built.draft,current);assert.equal(opened,1);assert.equal(S.ui.build.results,snapshot);assert.match(toasts.at(-1),/still running/);S.ui.build.busy=false;
account++;contextArgs.openMtgDraft(built.draft,current);assert.equal(opened,1);assert.match(toasts.at(-1),/account or workspace/);account--;
A.tBuild=async t=>tBuildCalls.push(t);game='ptcg';await contextArgs.openTcgBuild('ptcg','fixture',73,'standard',current);assert.equal(tBuildCalls.length,1);assert.equal(tBuildCalls[0].initialBudget,73);assert.equal(tBuildCalls[0].buildCurrent,current);account++;await contextArgs.openTcgBuild('ptcg','fixture',73,'standard',current);assert.equal(tBuildCalls.length,1);account--;game='mtg';
vm.runInNewContext(app.slice(app.indexOf('function generatedDeck('),app.indexOf('async function buyMtg(')),ctx);await A.tierSave({dataset:{i:'0'}});assert.equal(saved,1);assert.equal(S.state.decks[0].commander,SAI.name);assert.deepEqual(JSON.parse(JSON.stringify(S.state.decks[0].cards)),built.draft.cards.map(({name,qty})=>({name,qty})));
vm.runInNewContext(app.slice(app.indexOf('A.tierBuy ='),app.indexOf('A.tierSaveAll =')),ctx);await A.tierBuy({dataset:{i:'0'}});assert.equal(buys.find(r=>r.name==='Island').qty,26,'prepared Buy includes actually missing basic lands');S.ui.build.results.Commander[0].preparedByAsk=false;await A.tierBuy({dataset:{i:'0'}});assert.equal(buys.find(r=>r.name==='Island').qty,26,'ordinary builder Buy now includes the same actually missing basics');
console.log('PASS: actual app callbacks capture identity, reject busy/stale draft opens, preserve immutable exact cards/ownership, never build again, and save only on the existing explicit action; prepared Buy includes missing basics.');

const TA={},TS={ui:{tbuild:{busy:false},sheetCtx:null}},nodes={'#sheet':{open:false}},finishers=[],starts=[],tcgToasts=[];let active='ptcg',nav=1,scope=true;
const tc={S:TS,A:TA,g:()=>active,navigationStamp:()=>nav,navigationCurrent:s=>s===nav,document:{querySelector:q=>nodes[q]},toast:s=>tcgToasts.push(s),ensureCard:(_,id)=>new Promise(resolve=>finishers.push(()=>resolve({id,name:id}))),cardOf:(_,id)=>({id,name:id,category:'Pokemon'}),buildable:()=>[{id:'standard'}],tcgBuildSheet:()=>'',openSheet:(_,c)=>TS.ui.sheetCtx=c,runTBuild:()=>{starts.push({budget:TS.ui.tbuild.custom,seed:TS.ui.tbuild.seed});TS.ui.tbuild.busy=true;}};
vm.runInNewContext(tcg.slice(tcg.indexOf('  const openBuild ='),tcg.indexOf('  A.tOptimizeDeck =')),tc);
vm.runInNewContext(tcg.slice(tcg.indexOf('  let buildRequest=0;'),tcg.indexOf('  // Build around several cards at once')),tc);
let pending=TA.tBuild({dataset:{id:'seed-a',format:'standard'},initialBudget:73,buildCurrent:()=>scope});finishers.shift()();await pending;assert.deepEqual(starts,[{budget:'73',seed:'seed-a'}]);assert.equal(TS.ui.tbuild.custom,'73');
await TA.tBuild({dataset:{id:'seed-b',format:'standard'},initialBudget:99,buildCurrent:()=>scope});assert.equal(finishers.length,0);assert.equal(TS.ui.tbuild.seed,'seed-a');assert.match(tcgToasts.at(-1),/still running/);TS.ui.tbuild.busy=false;
pending=TA.tBuild({dataset:{id:'stale-scope'},initialBudget:73,buildCurrent:()=>scope});scope=false;finishers.shift()();await pending;assert.equal(starts.length,1);scope=true;
pending=TA.tBuild({dataset:{id:'stale-navigation'},initialBudget:73,buildCurrent:()=>scope});nav++;finishers.shift()();await pending;assert.equal(starts.length,1);
pending=TA.tBuild({dataset:{id:'stale-sheet'},initialBudget:73,buildCurrent:()=>scope});TS.ui.sheetCtx={type:'different'};finishers.shift()();await pending;assert.equal(starts.length,1);
const old=TA.tBuild({dataset:{id:'old'},initialBudget:11,buildCurrent:()=>scope}),fresh=TA.tBuild({dataset:{id:'fresh'},initialBudget:44,buildCurrent:()=>scope});finishers.shift()();await old;assert.equal(starts.length,1);finishers.shift()();await fresh;assert.deepEqual(starts[1],{budget:'44',seed:'fresh'});
console.log('PASS: actual TCG callbacks set budget before the first run, refuse busy replacement, discard stale identity/navigation/sheet results, and keep the newest pending handoff.');

// Explicitly permitted unverified drafts retain their disclosure after saving.
game='mtg';S.ui.build.busy=false;contextArgs.openMtgDraft({...built.draft,unverifiedConstraints:['infinite_combos']},contextArgs.captureAskScope());await A.tierSave({dataset:{i:'0'}});const unverifiedSaved=S.state.decks.at(-1);assert.match(unverifiedSaved.name,/^Draft/);assert.deepEqual(Array.from(unverifiedSaved.unverifiedConstraints),['infinite_combos']);assert.match(unverifiedSaved.source.description,/Unverified draft: infinite combos were not checked/);
console.log('PASS: explicit Save draft persists its unverified restriction and disclosure, without changing its exact cards.');
