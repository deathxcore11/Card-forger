// Actual registered tournament inspector/adaptation/save/reopen/Buy callbacks.
// No real provider/account/clipboard writes: providers, persistence and UI are local fakes.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {normalizePtcg} from './ptcg.js';
import {metaState} from './meta.js';
import * as T from './tcg.js';
let rendered='',clipboard='',dialogs=0,network=0;const messages=[];
globalThis.localStorage={getItem:()=> 'off',setItem:()=>{}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{clipboard=text;}}}});
globalThis.window={open:()=>{throw Error('No external shopping navigation allowed');}};
globalThis.document={body:{append:()=>{}},querySelector:s=>s==='#sheetBody'?{scrollTop:0}:null,querySelectorAll:()=>[],createElement:tag=>{
 assert.equal(tag,'dialog');dialogs++;const listeners={};
 const node={classList:{add:()=>{}},querySelector:s=>s==='input'?null:{addEventListener:(event,fn)=>{if(s==='[value="cancel"]')listeners.cancel=fn;},focus:()=>{}},addEventListener:()=>{},showModal:()=>queueMicrotask(()=>listeners.cancel()),close:()=>{},remove:()=>{}};return node;
}};
globalThis.fetch=async input=>{network++;assert.equal(input,'api/tcgplayer/sets?game=ptcg','no live AI/account/provider calls');return Response.json({sets:[{name:'Fixture Energy A',code:'FXA'},{name:'Fixture Energy B',code:'FXB'},{name:'Fixture Main',code:'FXM'}]});};
const fresh=(id,name,category='Pokemon',usd=.1,setName='Fixture Main')=>({...normalizePtcg({id,name,localId:id.split('-').at(-1),category,stage:category==='Pokemon'?'Basic':undefined,hp:category==='Pokemon'?70:undefined,types:category==='Pokemon'?['Fire']:undefined,attacks:category==='Pokemon'?[{name:'Ember',cost:['Fire'],damage:'20'}]:[],energyType:category==='Energy'?'Normal':undefined,legal:{standard:true,expanded:true},set:{id:id.split('-')[0],name:setName},image:'https://fixture.invalid/card'}),prices:{usd},fetchedAt:new Date().toISOString()});
let A,c,cards,deck;
async function open({quote=3,ownedEnergy=0,missing=false}={}){
 S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:blankGame()};S.ui.sheetCtx=null;
 const seed=fresh('main-1','Fixture attack seed'),trainers=Array.from({length:11},(_,i)=>fresh('main-'+(i+2),'Fixture Trainer '+i,'Trainer')),
   energyA=fresh('energyA-80','Basic Fire Energy','Energy',quote,'Fixture Energy A'),energyB=fresh('energyB-81','Basic Fire Energy','Energy',quote==null||String(quote).trim()===''?quote:quote+1,'Fixture Energy B');
 cards=[seed,...trainers,energyA,energyB];for(const card of cards)T.cache.ptcg[card.id]=card;
 if(ownedEnergy)S.state.tcg.ptcg.collection.push({cardId:energyA.id,key:'name:Basic Fire Energy',name:energyA.name,qty:ownedEnergy});
 deck={key:'adapt-fixture',name:'Fixture tournament list',place:'1st',event:'Local fixture',players:1,list:cards.map((card,i)=>({name:card.name,set:card.set.id,number:card.set.number,kind:card.category,qty:i>=12?6:4}))};
 metaState('ptcg').data={decks:[deck],top:[],events:[]};
 T.SOURCES.ptcg.get=async id=>{if(missing&&id===energyA.id)throw Error('Fixture printing missing');return cards.find(c=>c.id===id);};
 T.SOURCES.ptcg.tournamentCard=async row=>missing&&row.set===energyA.set.id?null:cards.find(card=>card.name===row.name&&card.set.id===row.set&&card.set.number===row.number)||null;
 T.SOURCES.ptcg.cheapestPrint=async()=>{throw Error('Explicit tournament printing must not be replaced');};
 T.SOURCES.ptcg.byName=async()=>{throw Error('Explicit tournament printing must not resolve by name');};
 if(missing)delete T.cache.ptcg[energyA.id];
 A={};c={A,C:{},I:{},commit:async(fn,options)=>{fn(S.state);if(options?.msg)messages.push(options.msg);},render:()=>{},openSheet:(html,ctx)=>{rendered=html;S.ui.sheetCtx=ctx;},closeSheet:()=>{S.ui.sheetCtx=null;},toast:m=>messages.push(m),writeRecord:async()=>{},go:()=>{},busy:()=>()=>{}};
 T.registerTcg(c);A.tMetaDeck({dataset:{key:deck.key}});while(T.proven.busy)await new Promise(r=>setImmediate(r));return T.proven.current.rows;
}
const collection=()=>JSON.stringify(S.state.tcg.ptcg.collection);
async function save(mode='original'){
 A.provenMode({dataset:{id:mode}});const before=collection();await A.provenSave({dataset:{}});assert.equal(collection(),before,'adaptation never changes collection');
 const saved=S.state.tcg.ptcg.decks.at(-1);if(!saved)return null;S.state=JSON.parse(JSON.stringify(S.state));return {saved:S.state.tcg.ptcg.decks.at(-1),html:T.tcgDeck(saved.id),message:messages.at(-1)};
}
let rows=await open();assert.equal(rows.reduce((n,r)=>n+Math.min(r.qty,r.owned),0),0);assert.equal(rows.filter(r=>r.kind==='Energy').reduce((n,r)=>n+r.qty*r.price,0),42);assert.doesNotMatch(rendered,/Energy · assumed|assumed available|Covered/);assert.match(rendered,/You own 0 of 60<\/b>/);assert.match(rendered,/\$47<\/b> to finish/);
let result=await save();assert.equal(result.saved.buildDiagnostics.knownPurchaseSubtotal,46.8);assert.equal(result.saved.buildDiagnostics.unpricedPurchaseCopies,0);assert.equal(result.saved.buildDiagnostics.ready,true);assert.deepEqual(result.saved.zones.main.slice(-2).map(r=>r.cardId),['energyA-80','energyB-81']);assert.match(result.html,/<b>0%<\/b>owned/);
await A.tDeckCopyMissing({dataset:{id:result.saved.id}});await new Promise(r=>setImmediate(r));assert.match(clipboard,/6 Basic Fire Energy \[FXA\]/);assert.match(clipboard,/6 Basic Fire Energy \[FXB\]/);assert.doesNotMatch(clipboard,/SVE/);assert.equal(dialogs,1);
// The selected printing's real Energy cost makes this $25 adaptation over budget.
await open();A.provenMode({dataset:{id:'budget'}});A.provenBudget({dataset:{b:'25'}});assert.match(rendered,/Budget adaptation — over budget/);assert.equal(T.proven.last.budget,25);assert.equal(T.proven.last.fits,false);assert.equal(T.proven.last.rows.filter(r=>r.kind==='Energy').reduce((n,r)=>n+r.qty,0),12,'budget adaptation keeps the original Energy requirement');result=await save('budget');assert.equal(result.saved.buildDiagnostics.purchaseBudget,25);assert.equal(result.saved.buildDiagnostics.ready,false);assert.match(result.message,/Saved draft/);assert.match(result.html,/Draft: the requested purchase budget is not verified/);
// Unknown and blank Energy quotes block budget adaptations, not original identity saves.
for(const quote of [null,'','   ']){
 rows=await open({quote});assert(rows.filter(r=>r.kind==='Energy').every(r=>r.price===null&&r.owned===0));assert.match(rendered,/12 unpriced · Incomplete total/);A.provenMode({dataset:{id:'budget'}});assert.match(rendered,/Price check incomplete/);assert.match(rendered,/data-act="provenSave" disabled/);await A.provenSave({dataset:{}});assert.equal(S.state.tcg.ptcg.decks.length,0);assert.match(messages.at(-1),/total is incomplete/);
 result=await save();assert.equal(result.saved.buildDiagnostics.purchaseEstimate,null);assert.equal(result.saved.buildDiagnostics.unpricedPurchaseCopies,12);assert.equal(result.saved.buildDiagnostics.ready,true);assert.match(result.message,/12 unpriced purchases, cost unverified/);assert.match(result.html,/unverified, not free/);
}
// Own five across two exact Energy rows: allocation is once, never five per printing.
rows=await open({ownedEnergy:5});assert.deepEqual(rows.filter(r=>r.kind==='Energy').map(r=>r.owned),[5,0]);result=await save();assert.equal(result.saved.buildDiagnostics.ownedCopies,5);assert.equal(result.saved.buildDiagnostics.knownPurchaseSubtotal,31.8);await A.tDeckCopyMissing({dataset:{id:result.saved.id}});await new Promise(r=>setImmediate(r));assert.match(clipboard,/1 Basic Fire Energy \[FXA\]/);assert.match(clipboard,/6 Basic Fire Energy \[FXB\]/);
rows=await open({quote:null,ownedEnergy:12});assert.deepEqual(rows.filter(r=>r.kind==='Energy').map(r=>r.owned),[12,6]);result=await save();assert.equal(result.saved.buildDiagnostics.ownedCopies,12);assert.equal(result.saved.buildDiagnostics.unpricedPurchaseCopies,0);assert.equal(result.saved.buildDiagnostics.knownPurchaseSubtotal,4.8);
await open({quote:null,ownedEnergy:12});result=await save('budget');assert.equal(result.saved.buildDiagnostics.ready,true,'actually owned Energy needs no purchase quote for a finite adaptation');assert.equal(result.saved.buildDiagnostics.unpricedPurchaseCopies,0);
await open({quote:0});result=await save('budget');assert.equal(result.saved.buildDiagnostics.ready,true,'affordable verified Energy supports a complete positive adaptation');assert.equal(result.saved.buildDiagnostics.unpricedPurchaseCopies,0);
await open({quote:null,ownedEnergy:5});result=await save('draft');assert.equal(result.saved.zones.main.reduce((n,r)=>n+r.qty,0),5);assert.equal(result.saved.buildDiagnostics.ownedCopies,5);assert.equal(result.saved.buildDiagnostics.missingEnergy,7);assert.match(result.message,/Saved draft/);assert.match(result.html,/Incomplete draft: 55 slots remain/);
await open({quote:null});assert.equal(await save('draft'),null);assert.match(messages.at(-1),/Nothing to save yet/);
await open({missing:true});await A.provenSave({dataset:{}});assert.equal(S.state.tcg.ptcg.decks.length,0);assert.match(T.provenSheetHtml(),/Nothing saved: 1 unmatched printings/);
assert.equal(network,1,'only the local set-code fixture is requested');
console.log('PASS: real Pokémon tournament inspector/adaptation/save/reopen/Buy uses actual Energy quantities, known or unknown purchase quotes, persisted finite caps, and exact saved printings; no fabricated ownership, no SVE substitution, no live network/account writes.');
