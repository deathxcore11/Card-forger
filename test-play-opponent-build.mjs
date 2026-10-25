import {test} from 'node:test';import assert from 'node:assert/strict';
import {createPracticeOpponentBuilder} from './play-opponent-build.js';
import {createPlaySetup} from './play-setup.js';
function fixture(){let scope='account-a:Commander',selected=null,seen;
 const pipeline={async build(request,options){seen={request,options};return {ok:true,request,deck:{format:request.format,name:'CPU fixture',cards:[{name:request.seed,qty:1,finish:'foil'}]}};},recheck:r=>r.ok};
 const b=createPracticeOpponentBuilder({pipeline,pickSeed:async()=>({name:'Seed'}),readScope:()=>scope,onSelect:d=>selected=d,random:()=>123});return {b,pipeline,scope:v=>scope=v,selected:()=>selected,seen:()=>seen};}
test('random CPU build uses shared builder with exact format/bracket/style and no inventory restriction',async()=>{
 const f=fixture();const d=await f.b.build({format:'Commander',targetBracket:3,deckStyle:'infinite-mana'}),r=f.seen().request;assert.equal(r.targetBracket,3);assert.equal(r.format,'Commander');assert.equal(r.deckStyle,'infinite-mana');assert.equal(r.ownedOnly,false);assert.equal(r.preferOwned,false);assert.equal(r.seed,'Seed');assert.equal(d.practiceBuild.source,'shared-random-builder');assert.equal(f.selected().cards[0].finish,'foil');d.cards[0].finish='changed';assert.equal(f.b.snapshot().result.cards[0].finish,'foil');
});
test('cancellation and account change discard late random/build results',async()=>{
 for(const change of ['cancel','account']){const f=fixture();let done;f.pipeline.build=()=>new Promise(r=>done=r);const p=f.b.build({format:'Commander'});await new Promise(r=>setTimeout(r,0));if(change==='cancel')f.b.cancel();else f.scope('account-b');done({ok:true});assert.equal(await p,null);assert.equal(f.selected(),null);assert.equal(f.b.snapshot().busy,false);}
});
test('format/style/bracket changes in builder output reject without selecting a substitute',async()=>{
 const f=fixture();f.pipeline.build=async request=>({ok:true,request:{...request,targetBracket:5},deck:{format:'Commander'}});assert.equal(await f.b.build({format:'Commander',targetBracket:2}),null);assert.equal(f.selected(),null);assert.match(f.b.snapshot().error,/changed/);
});
test('failed construction recheck and invalid options do not select an opponent',async()=>{
 const f=fixture();f.pipeline.recheck=()=>false;assert.equal(await f.b.build({format:'Standard'}),null);assert.equal(f.selected(),null);await assert.rejects(f.b.build({format:'Standard',targetBracket:2}),/COMMANDER_BRACKET_ONLY/);
});
test('a completed opponent preview is redacted after the account scope changes',async()=>{
 const f=fixture();await f.b.build({format:'Commander'});f.scope('account-b');assert.equal(f.b.snapshot().result,null);
});
test('opponent and player snapshots remain independent and both retire on account change',()=>{
 let generation=1;const deck={id:'player',name:'Player',format:'Commander',cards:[{name:'Island',qty:100,finish:'foil'}]};
 const s=createPlaySetup({readAccount:()=>({user:{id:'a'},accountGeneration:generation}),readDecks:()=>[deck],parseImport:()=>({})});s.selectDeck('player');s.chooseOpponent({...deck,name:'CPU'});let v=s.snapshot();assert.equal(v.selected.name,'Player');assert.equal(v.opponent.name,'CPU');assert.equal(v.inspectedSeat,'opponent');v.opponent.cards[0].finish='changed';assert.equal(s.snapshot().opponent.cards[0].finish,'foil');s.inspectSeat('player');assert.equal(s.snapshot().inspectedSeat,'player');generation++;assert.equal(s.snapshot().opponent,null);assert.equal(s.snapshot().selected,null);
});
test('format change clears an incompatible CPU deck without rewriting its source',()=>{
 const s=createPlaySetup({readAccount:()=>({user:{id:'a'}}),readDecks:()=>[],parseImport:()=>({})}),deck={name:'CPU',format:'Commander',cards:[{name:'Island',qty:100}]};s.chooseOpponent(deck);s.configure({format:'Standard'});assert.equal(s.snapshot().opponent,null);assert.equal(deck.cards[0].qty,100);assert.throws(()=>s.chooseOpponent(deck),/current format/);
});
