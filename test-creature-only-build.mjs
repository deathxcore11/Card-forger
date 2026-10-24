// Real Scryfall rules snapshots with deliberately synthetic prices and filler
// cards. This checks fidelity and selection boundaries, not live AI quality,
// current market pricing, or whether a generated list is competitively strong.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal} from './ai-build-contract.js';
import {readCreatureTypeRestrictions,fitsTypeRestrictions,creatureTypes} from './planner.js';
import {buildDeck} from './builder.js';
import {prepareMtgDeck} from './ai-deck-builder.js';
import {normalizeDeckRequest,inspectDeckPlan,chooseDeck,priceDeck} from './deck-construction.js';
import {cardKey,validateDeck} from './core.js';
import {FORMATS} from './formats.js';
import {S,blank} from './store.js';
import * as T from './tcg.js';
import {createDeckPipeline} from './deck-pipeline.js';
import {makeAskTools} from './ai-tools.js';
const u=content=>({type:'message',role:'user',content});
const load=name=>JSON.parse(fs.readFileSync(new URL('./tests/fixtures/goblin-request/'+name+'.json',import.meta.url)));
const [krenko,zada,arsonist,firebrand,warmind,ultimus,automaton,mountain]=['krenko-mob-boss','zada-hedron-grinder','goblin-arsonist','fanatical-firebrand','warmind-infantry','mistform-ultimus','universal-automaton','mountain'].map(load);
for(const [prompt,types,color] of [
 ['Build a mono-red Commander deck with only Goblins',['Goblin'],'R'],
 ['Build an only Goblin deck for red',['Goblin'],'R'],
 ['Build a mono-red Goblin-only Commander deck',['Goblin'],'R'],
 ['Build a mono-black Vampire-only Commander deck',['Vampire'],'B'],
 ['Build a mono-green Elves-only Commander deck',['Elf'],'G'],
 ['Build a mono-red deck with only Goblins and Dragons',['Dragon','Goblin'],'R'],
 ['Build a mono-blue Time Lords-only Commander deck',['Time Lord'],'U'],
 ['Build a mono-red Commander deck with no non-Goblin creatures',['Goblin'],'R'],
]){
 const contract=readBuildContract([u(prompt)]);
 assert.deepEqual([...contract.creatureTypesOnly].sort(),[...types].sort(),prompt);
 assert.deepEqual(contract.colors,[color],prompt);
 const proposal=applyUserBuildIntent({game:'mtg',format:'Commander',style:'aggressive',budget:0,colors:[],required_cards:[],excluded_cards:[]},contract);
 assert(validateBuildProposal(proposal,contract).ok,prompt);
 assert.deepEqual(proposal.creatureTypesOnly,contract.creatureTypesOnly);
}
for(const prompt of ['Build a deck with not only Goblins but also Elves',"I don't want only Goblins",'I don’t want only Goblins','Build a Goblin deck using only red cards','Build a mono-red deck with only Goblin token makers','Build a deck with only Goblin commanders'])assert.deepEqual(readCreatureTypeRestrictions(prompt).creatureTypesOnly,[],prompt);
assert.deepEqual(readBuildContract([u('Build a Goblin deck using only red cards')]).colors,['R']);
const original='Build a weak mono-red Goblin-only Commander deck under $50';
const retained=readBuildContract([u(original)]),follow=readBuildContract([u(original),u('Make it more interactive')]);
assert.equal(follow.goal,'weak');assert.equal(follow.budget,50);assert.equal(follow.format,'Commander');assert.deepEqual(follow.colors,['R']);assert.deepEqual(follow.creatureTypesOnly,['Goblin']);
for(const text of ['Any creatures now','Remove the Goblin-only restriction','Drop the creature-type restriction']){
 const next=readBuildContract([u(text)],retained);assert.deepEqual(next.creatureTypesOnly,[],text);assert.equal(next.budget,50);assert.deepEqual(next.colors,['R']);assert.equal(next.goal,'weak');
}
assert.deepEqual(readBuildContract([u(original),u('Build a mono-green Elf-only Commander deck')]).creatureTypesOnly,['Elf']);
console.log('PASS: natural creature-only wording, plural/multiword types, color-only wording, negation, explicit relaxation and fresh/follow-up request boundaries.');

const restriction={creatureTypesOnly:['Goblin']};
for(const c of [krenko,zada,arsonist,firebrand,ultimus,automaton,mountain])assert(fitsTypeRestrictions(c,restriction),c.name);
assert(!fitsTypeRestrictions(warmind,restriction));
assert(!fitsTypeRestrictions({name:'Unverified type fixture',oracle_text:'Draw a card.'},restriction));
assert(!fitsTypeRestrictions({name:'Incomplete face fixture',card_faces:[{type_line:'Creature — Goblin'},{}]},restriction));
assert(!fitsTypeRestrictions({name:'Goblin name decoy fixture',type_line:'Creature — Human',oracle_text:'Destroy target Goblin.'},restriction));
assert(!fitsTypeRestrictions({name:'Granted type fixture',type_line:'Creature — Human',oracle_text:'Target creature gains changeling until end of turn.'},restriction));
assert(!fitsTypeRestrictions(ultimus,{excludedSubtypes:['Goblin']}));
assert(fitsTypeRestrictions({name:'Support artifact fixture',type_line:'Artifact'},restriction));
console.log('PASS: genuine Goblins and unconditional every-type/changeling bodies pass; unknown rules types and off-type/mention/granted-only decoys fail; lands and noncreature support remain allowed.');

const fixture=(name,type='Creature — Goblin',extra={})=>({name,type_line:type,oracle_text:'',color_identity:['R'],colors:['R'],mana_cost:'{1}{R}',cmc:2,power:'2',toughness:'2',legalities:{commander:'legal'},prices:{usd:'.20'},...extra});
const humans=Array.from({length:75},(_,i)=>fixture('Synthetic cheap Human '+i,'Creature — Human Soldier'));
const goblins=Array.from({length:70},(_,i)=>fixture('Synthetic Goblin '+i));
const humanLeader=fixture('Synthetic off-type Goblin payoff commander','Legendary Creature — Human',{oracle_text:'Goblins you control get +1/+1. Whenever another Goblin you control dies, draw a card.'});
const catalogFor=cards=>Object.fromEntries(cards.map(c=>[cardKey(c.name),structuredClone(c)]));
const thinCards=[krenko,arsonist,firebrand,mountain,...humans],thinCatalog=catalogFor(thinCards);
const thin=buildDeck({format:'Commander',seeds:[krenko],commander:krenko,catalog:thinCatalog,price:()=>.20,requestedStyle:'only Goblins',goal:'weak'});
assert(thin.open>0);assert(thin.cards.every(r=>fitsTypeRestrictions(thinCatalog[cardKey(r.name)],restriction)));
assert(!thin.cards.some(r=>r.name.startsWith('Synthetic cheap Human')),'economical completion cannot sacrifice the creature restriction');
assert.throws(()=>buildDeck({format:'Commander',seeds:[humanLeader],commander:humanLeader,catalog:catalogFor([humanLeader,mountain,...goblins]),price:()=>.20,creatureTypesOnly:['Goblin']}),/creature-type restriction/);
const cards=[krenko,zada,arsonist,firebrand,warmind,mountain,humanLeader,...humans,...goblins],catalog=catalogFor(cards);
const context={S:{catalog},meta:name=>catalog[cardKey(name)],resolve:async name=>catalog[cardKey(name)],cacheCard:c=>(catalog[cardKey(c.name)]=c),inv:()=>({available:0}),priceOf:()=>.20,api:async path=>({data:new URL(path,'https://fixture.invalid').searchParams.get('q').includes('is:commander')?[humanLeader,zada,krenko]:cards})};
for(const randomSeed of [0,1,7,23]){
 const result=await prepareMtgDeck({format:'Commander',style:'only Goblins',flow:true,goal:'strongest',colors:['R'],budget:100,randomSeed},context);
 assert(result.candidates?.length,JSON.stringify(result));
 for(const candidate of result.candidates){
  assert.equal(candidate.draft.commander,krenko.name,'recognized tribal engine outranks incidental body and off-type payoff');
  assert.equal(candidate.draft.total,100);assert.deepEqual(candidate.draft.creatureTypesOnly,['Goblin']);
  assert(candidate.draft.cards.every(r=>fitsTypeRestrictions(catalog[cardKey(r.name)],restriction)));
  assert.match(candidate.draft.commanderReason,/recognized plan support/);
  assert.match(candidate.draft.commanderReason,/not a measured power ranking/);
 }
}
const unavailable=await prepareMtgDeck({format:'Commander',style:'only Goblins',flow:true,goal:'weak',seed:krenko.name,commander:krenko.name,colors:['R'],budget:100},{...context,S:{catalog:thinCatalog},meta:name=>thinCatalog[cardKey(name)],resolve:async name=>thinCatalog[cardKey(name)],api:async()=>({data:thinCards})});
assert(unavailable.candidates.every(c=>!c.result.ready&&c.draft.total<100));
console.log('PASS: actual selector and economical fallback preserve pure creature composition and commander scope, strongest leader selection is deterministic across random seeds, and insufficient pools remain incomplete even for a weak goal.');

const full=buildDeck({format:'Commander',seeds:[krenko],commander:krenko,catalog,price:()=>.20,requestedStyle:'only Goblins'});
const request=normalizeDeckRequest({game:'mtg',format:'Commander',style:'only Goblins',budget:100,goal:'weak',requireLoop:'infinite-mana'}, {mtg:FORMATS});
assert.deepEqual(request.creatureTypesOnly,['Goblin']);assert.equal(request.goal,'weak');assert.equal(request.requireLoop,'infinite-mana','independent positive requirements survive normalization');
const toRows=deck=>deck.cards.map(r=>({...r,card:catalog[cardKey(r.name)],price:.20,owned:0,zone:'main'}));
const pureRows=toRows(full),purePlan=inspectDeckPlan(request,pureRows,full);assert.equal(purePlan.typeRestrictions.status,'pass');
const changed=structuredClone(full),cut=changed.cards.find(r=>r.name!==krenko.name&&/\bCreature\b/.test(catalog[cardKey(r.name)].type_line));cut.name=warmind.name;
assert.equal(validateDeck(changed,catalog,[]).issues.length,0,'the counterexample is still a legal complete mono-red singleton deck');
const rows=toRows(changed),plan=inspectDeckPlan(request,rows,changed);
assert.equal(plan.typeRestrictions.status,'fail');assert(plan.typeRestrictions.conflicts.includes(warmind.name));
const verdict=chooseDeck([{deck:changed,rows,check:{complete:true,legal:true,issues:[]},plan,pricing:priceDeck(rows),power:{score:50}}],request);
assert.equal(verdict.ok,false,'legality and completeness cannot hide a broken creature-only request');
const unknownRows=pureRows.map((r,i)=>i===0?{...r,card:{name:r.name}}:r);
assert.equal(inspectDeckPlan(request,unknownRows,full).typeRestrictions.status,'fail');
assert(creatureTypes(krenko).includes('Goblin'));
console.log('PASS: final request gate independently rejects a legal 100-card off-type substitution or unknown type record; normalized/rebuilt requests retain creature restrictions, weak goal and separate loop intent.');

// Trusted cleared fields must remain cleared throughout the actual Ask path,
// even when a model repeats the old wording in its untrusted style string.
const strict=readBuildContract([u('Build a weak mono-red Goblin-only Commander deck under $50 led by "Krenko, Mob Boss"; no Humans.')]);
const relaxed=readBuildContract([u('Any creatures now')],strict);
assert.deepEqual(relaxed.creatureTypesOnly,[]);assert.deepEqual(relaxed.excludedSubtypes,[]);
const staleStyle='only Goblins. No Humans.',relaxedArgs=applyUserBuildIntent({game:'mtg',format:'Commander',style:staleStyle,seed:krenko.name,commander:krenko.name,budget:50,budget_basis:'total',goal:'weak',colors:['R'],required_cards:[],excluded_cards:[]},relaxed);
const relaxedCheck=validateBuildProposal(relaxedArgs,relaxed);assert(relaxedCheck.ok,JSON.stringify(relaxedCheck));
const normalized=normalizeDeckRequest(relaxedCheck.args,{mtg:FORMATS});assert.deepEqual(normalized.creatureTypesOnly,[]);assert.deepEqual(normalized.excludedSubtypes,[]);
S.state=blank();S.catalog=catalogFor(thinCards);S.ui={};
const actualContext={S,T,tcgCtx:{},meta:name=>S.catalog[cardKey(name)],resolve:async name=>S.catalog[cardKey(name)],cacheCard:c=>(S.catalog[cardKey(c.name)]=c),priceOf:()=>.20,inv:()=>({available:0}),api:async path=>({data:new URL(path,'https://fixture.invalid').searchParams.get('q').includes('is:commander')?[krenko]:thinCards})};
const actualPipeline=createDeckPipeline(actualContext);let relaxedResult=null;
const actualTools=makeAskTools({...actualContext,deckExperience:{build:actualPipeline.build,register:r=>{relaxedResult=r;return 'relaxed-result';},isCurrent:()=>true,openResult:()=>{}}});
const answer=await actualTools.build_deck(relaxedCheck.args);
assert.equal(answer.complete,true,JSON.stringify(answer));assert.equal(relaxedResult.rows.reduce((n,r)=>n+r.qty,0),100);
assert(relaxedResult.rows.some(r=>r.name.startsWith('Synthetic cheap Human')),'cleared restrictions must permit the off-type cards needed to complete this bounded fixture');
assert.deepEqual(relaxedResult.request.creatureTypesOnly,[]);assert.deepEqual(relaxedResult.deck.creatureTypesOnly,[]);assert.deepEqual(relaxedResult.request.excludedSubtypes,[]);
assert.equal(relaxedResult.plan.typeRestrictions.status,'not-requested');assert(actualPipeline.recheck(relaxedResult));assert.equal(S.state.decks.length,0);
const explicitNoLoop=normalizeDeckRequest({game:'mtg',format:'Commander',style:'infinite mana',requireLoop:null,loopOutput:null,unsupportedLoop:null,loopConflict:false,clearLoop:true,budget:50},{mtg:FORMATS});
assert.equal(explicitNoLoop.requireLoop,null,'explicit loop clearing also outranks stale style');
console.log('PASS: actual Ask apply/validate/shared pipeline and final recheck respect trusted empty type arrays and explicit null loop fields; stale model wording cannot resurrect cleared restrictions.');
