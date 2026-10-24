// Actual request contracts, shared Magic construction and final recheck. The
// named package abilities are real rules-text fragments; prices, discovery
// responses and explicitly named filler cards are synthetic, with no I/O.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import * as T from './tcg.js';
import {cardKey,cardPrice} from './core.js';
import {createDeckPipeline} from './deck-pipeline.js';
import {readBuildContract,applyUserBuildIntent,validateBuildProposal,lockBuildContract} from './ai-build-contract.js';
import {inspectManaLoop} from './mtg-combo-packages.js';
const card=(name,type_line='Artifact',color_identity=[],usd='.25',oracle_text='Draw a card.',extra={})=>({name,type_line,color_identity,colors:color_identity,prices:{usd},oracle_text,mana_cost:color_identity.length?'{1}{'+color_identity[0]+'}':'{2}',cmc:2,legalities:{commander:'legal',modern:'legal'},...extra});
const cards={
 anchor:card('Arcane Signet','Artifact',[],'.25',"{T}: Add one mana of any color in your commander's color identity."),
 leader:card('Sai, Master Thopterist','Legendary Creature — Human Artificer',['U'],'1','Whenever you cast an artifact spell, create a 1/1 colorless Thopter artifact creature token with flying.'),
 basalt:card('Basalt Monolith','Artifact',[],'1',"Basalt Monolith doesn't untap during your untap step.\n{T}: Add {C}{C}{C}.\n{3}: Untap Basalt Monolith.",{mana_cost:'{3}',cmc:3}),
 monument:card('Forsaken Monument','Legendary Artifact',[],'2','Whenever you tap a permanent for {C}, add an additional {C}.',{mana_cost:'{5}',cmc:5}),
 rings:card('Rings of Brighthearth','Artifact',[],'1',"Whenever you activate an ability, if it isn't a mana ability, you may pay {2}. If you do, copy that ability.",{mana_cost:'{3}',cmc:3}),
 druid:card('Devoted Druid','Creature — Elf Druid',['G'],'1','{T}: Add {G}.\nPut a -1/-1 counter on this creature: Untap this creature.'),
 vizier:card('Vizier of Remedies','Creature — Human Cleric',['W'],'1','If one or more -1/-1 counters would be put on a creature you control, that many minus one -1/-1 counters are put on it instead.'),
 island:card('Island','Basic Land — Island',['U'],'.10','{T}: Add {U}.',{mana_cost:'',cmc:0,produced_mana:['U']}),
 plains:card('Plains','Basic Land — Plains',['W'],'.10','{T}: Add {W}.',{mana_cost:'',cmc:0,produced_mana:['W']}),
 forest:card('Forest','Basic Land — Forest',['G'],'.10','{T}: Add {G}.',{mana_cost:'',cmc:0,produced_mana:['G']}),
};
const filler=Array.from({length:85},(_,i)=>card('Synthetic loop integration artifact '+i,'Artifact',[],'.25',i%3===0?'Draw a card.':i%3===1?'Add {C}.':'Destroy target artifact.'));
function context({missing=[],prices={},leader=cards.leader}={}){
 S.state=blank();S.catalog={};S.ui={};
 const all=[cards.anchor,leader,cards.basalt,cards.monument,cards.rings,cards.druid,cards.vizier,cards.island,cards.plains,cards.forest,...filler].filter(c=>!missing.includes(c.name)).map(c=>({...structuredClone(c),prices:{usd:Object.hasOwn(prices,c.name)?prices[c.name]:c.prices.usd}}));
 for(const c of all)S.catalog[cardKey(c.name)]=c;
 let searches=0,resolutions=0;
 const x={S,T,tcgCtx:{prepareDeck:()=>assert.fail('A Magic mana package must not enter another game builder')},meta:name=>S.catalog[cardKey(name)],resolve:async name=>{resolutions++;return S.catalog[cardKey(name)]||null;},cacheCard:c=>(S.catalog[cardKey(c.name)]=c),inv:()=>({owned:0,available:0}),priceOf:name=>cardPrice(S.catalog[cardKey(name)]),api:async path=>{searches++;const q=new URL(path,'https://fixture.invalid').searchParams.get('q')||'';return {data:q.includes('is:commander')?[leader]:all};}};
 return {pipeline:createDeckPipeline(x),x,get searches(){return searches;},get resolutions(){return resolutions;}};
}
const u=content=>({type:'message',role:'user',content});
const prompt='Build a bad mono-blue Commander artifacts deck with infinite mana under $100.';
const contract=readBuildContract([u(prompt)],null,{game:'mtg'});
assert.equal(contract.requireLoop,'infinite-mana');assert.equal(contract.goal,'weak');assert.equal(contract.budget,100);assert.deepEqual(contract.colors,['U']);
const input={game:'mtg',format:'Commander',style:'artifacts',goal:'weak',seed:cards.anchor.name,commander:cards.leader.name,budget:100,budget_basis:'total',colors:['U'],required_cards:[],excluded_cards:[],candidate_cards:[],avoid_infinite:false};
const applied=applyUserBuildIntent({...input,requireLoop:null},contract);
assert.equal(applied.requireLoop,'infinite-mana','The model cannot drop the requested loop');
assert.equal(applied.goal,'weak','An intentional weak goal survives a requested combo');
const check=validateBuildProposal(applied,contract);assert.equal(check.ok,true,JSON.stringify(check));
const locked=lockBuildContract(check.args,contract);assert.equal(locked.requireLoop,'infinite-mana');
const removedOutcome=validateBuildProposal({...check.args,requireLoop:null},contract);
assert.equal(removedOutcome.ok,false,'An explicit model attempt to remove the mandatory outcome is rejected');
const follow=readBuildContract([u('Make it cheaper')],locked,{game:'mtg'});
assert.equal(follow.requireLoop,'infinite-mana');assert.equal(follow.goal,'weak');assert.equal(follow.budget,100);
const colored=readBuildContract([u('Make infinite black mana instead')],locked,{game:'mtg'});
assert.equal(colored.requireLoop,'infinite-mana');assert.equal(colored.loopOutput,'B');
const coloredFollow=readBuildContract([u('Keep that but make it easier')],colored,{game:'mtg'});
assert.equal(coloredFollow.loopOutput,'B','A neutral revision cannot downgrade black mana to colorless');
const fresh=readBuildContract([u('Build a new mono-red Goblin Commander deck')],locked,{game:'mtg'});
assert.equal(fresh.requireLoop,null,'A fresh deck does not inherit an earlier mandatory combo');
const dropped=readBuildContract([u('Drop the infinite mana requirement')],locked,{game:'mtg'});
assert.equal(dropped.requireLoop,null);assert.equal(dropped.loopOutput,null);
const noCombos=readBuildContract([u('No infinite combos')],locked,{game:'mtg'});
assert.equal(noCombos.requireLoop,null);assert.equal(noCombos.avoid_infinite,true);
const conflict=readBuildContract([u('Build an infinite mana deck with no infinite combos')],null,{game:'mtg'});
assert.equal(conflict.loopConflict,true);
assert.equal(validateBuildProposal(applyUserBuildIntent(input,conflict),conflict).ok,false,'Conflicting requirements cannot be relaxed by the model');
const unsupported=readBuildContract([u('Build a bad deck that loops my opponents')],null,{game:'mtg'});
assert.ok(unsupported.unsupportedLoop);assert.equal(validateBuildProposal(applyUserBuildIntent(input,unsupported),unsupported).ok,false,'An unspecified loop outcome needs a focused choice');
const negativeMana=readBuildContract([u("I don't want a deck with infinite mana")],locked,{game:'mtg'});
assert.equal(negativeMana.requireLoop,null);assert.ok(negativeMana.unsupportedLoop,'An absence claim cannot silently become a ready unconstrained deck');
const scopedNegative=readBuildContract([u('Build infinite green mana but no infinite damage')],null,{game:'mtg'});
assert.equal(scopedNegative.requireLoop,'infinite-mana');assert.equal(scopedNegative.loopOutput,'G');assert.equal(scopedNegative.loopConflict,false);assert.equal(scopedNegative.avoid_infinite,false);assert.ok(scopedNegative.unsupportedLoop,'Mana generation does not prove absence of a damage loop');
const mixed=readBuildContract([u('Build infinite mana and infinite Goblin tokens')],null,{game:'mtg'});
assert.equal(mixed.requireLoop,'infinite-mana');assert.ok(mixed.unsupportedLoop,'A supported mana outcome does not erase another requested outcome');
assert.equal(validateBuildProposal(applyUserBuildIntent(input,mixed),mixed).ok,false);
const capped=readBuildContract([u('Build a weak mono-blue Commander artifacts deck under $50 with infinite mana')]);
for(const phrase of ['Allow infinite loops','Please permit any infinite loops','Infinite loops are fine','Remove the no-infinite-combo restriction','Remove the no infinite ban']){
 const allowed=readBuildContract([u(phrase)],capped);assert.equal(allowed.requireLoop,'infinite-mana',phrase);assert.equal(allowed.unsupportedLoop,null,phrase);assert.equal(allowed.avoid_infinite,false,phrase);assert.equal(allowed.budget,50,phrase);
}
for(const phrase of ["Don't allow infinite loops","I don't want infinite loops allowed"]){
 const denied=readBuildContract([u(phrase)],capped);assert.equal(denied.requireLoop,null,phrase);assert.equal(denied.avoid_infinite,true,phrase);
}
for(const phrase of ['Give it unlimited mana','Unlimited tokens'])assert.equal(readBuildContract([u(phrase)],capped).budget,50,'Unlimited resources do not authorize unlimited spending');
assert.equal(readBuildContract([u('Build a mono-blue Commander deck with unlimited mana under $50')]).budget,50);
assert.equal(readBuildContract([u('Unlimited budget')],capped).budget,0);
console.log('PASS: positive-loop contract retention, weak goal independence, output revisions, explicit relaxation and no-infinite conflict survive the actual proposal handshake.');

const request={game:'mtg',format:'Commander',seed:cards.anchor.name,commander:cards.leader.name,budget:100,budgetMode:'cap',budgetBasis:'total',theme:'Artifacts',goal:'weak',preferOwned:false,requireLoop:'infinite-mana',loopOutput:'C'};
let c=context(),result=await c.pipeline.build(request);
assert.equal(result.ok,true,JSON.stringify(result));assert.equal(result.rows.reduce((n,r)=>n+r.qty,0),100);
assert.equal(result.request.goal,'weak');assert.equal(result.plan.combo.status,'verified');assert.equal(result.validation.combo,'verified');
assert.ok(result.plan.combo.packages.some(p=>p.id==='basalt-monument'||p.id==='basalt-rings'));
assert.equal(c.pipeline.recheck(result),true);assert.equal(S.state.decks.length,0);
const cleared=await c.pipeline.build({...request,theme:'Artifacts infinite mana',requireLoop:null,loopOutput:null,unsupportedLoop:null,loopConflict:false,clearLoop:true});
assert.equal(cleared.ok,true,cleared.message);assert.equal(cleared.plan.combo.status,'not-requested','Explicit null intent outranks stale model style throughout the shared pipeline');
assert(c.searches<30,'Package retrieval stays bounded rather than performing one paid/model request per card');
const replacement=filler.find(card=>!result.rows.some(r=>r.name===card.name));
assert.ok(replacement);
const cut=c.pipeline.trialSwap(result,result.rows.find(r=>r.name===cards.basalt.name),replacement);
assert.equal(cut.plan.combo.status,'unverified');assert.equal(c.pipeline.recheck({...result,deck:cut.deck}),false,'A later swap cannot remove a mandatory loop piece');
assert.equal(inspectManaLoop(cut.rows,result.request).status,'unverified');

c=context({prices:{[cards.monument.name]:'200'}});result=await c.pipeline.build(request);
assert.equal(result.ok,true,result.message);assert.ok(result.plan.combo.packages.some(p=>p.id==='basalt-rings'),'An affordable reviewed package is tried when the first one is too expensive');
assert(!result.rows.some(r=>r.name===cards.monument.name));assert(result.pricing.estimate<=100);

const failureDiagnostics=[];
for(const [label,options,changes] of [
 ['unknown required package quotes',{prices:{[cards.monument.name]:null,[cards.rings.name]:null}},{}],
 ['unresolved pieces',{missing:[cards.monument.name,cards.rings.name]},{}],
 ['excluded essential piece',{}, {excluded_cards:[cards.basalt.name]}],
 ['colorless is not black mana',{}, {loopOutput:'B'}],
 ['colorless is not red mana',{}, {loopOutput:'R'}],
 ['own no-infinite restriction',{}, {avoid_infinite:true}],
]){
 c=context(options);const failure=await c.pipeline.build({...request,...changes});assert.equal(failure.ok,false,label+': '+JSON.stringify(failure));assert.equal(S.state.decks.length,0);if(!/loop|mana|budget|cap|price|infinite|package|piece|request/i.test(failure.message))failureDiagnostics.push({label,message:failure.message});
}
// A green-white creature loop is not usable in the requested mono-blue list.
c=context({missing:[cards.monument.name,cards.rings.name]});result=await c.pipeline.build(request);assert.equal(result.ok,false);assert.match(result.message,/loop|mana|package|piece|color|request/i);

// Creature purity is independent from the positive loop: the white/green
// creature package has a non-Human Druid, even though its other piece is Human.
const sisay=card('Captain Sisay','Legendary Creature — Human Soldier',['G','W'],'1','{T}: Search your library for a legendary card, reveal that card, put it into your hand, then shuffle.');
c=context({missing:[cards.monument.name,cards.rings.name],leader:sisay});
result=await c.pipeline.build({...request,commander:sisay.name,colors:['G','W'],creatureTypesOnly:['Human'],loopOutput:'G'});
assert.equal(result.ok,false);assert.match(result.message,/loop|mana|package|type|restriction|request/i);
for(const game of ['ptcg','ygo']){
 c=context();const failure=await c.pipeline.build({...request,game,format:game==='ptcg'?'standard':'tcg'});assert.equal(failure.ok,false);assert.match(failure.message,/Magic|supported|loop|mana/i);assert.equal(c.resolutions,0,'Other-game requests fail before Magic lookups');
}
assert.deepEqual(failureDiagnostics,[],'Failed loop requests must explain the unmet package, output or price condition');
console.log('PASS: actual shared pipeline builds complete reviewed mana decks, tries an affordable alternative, preserves exact loop/output/type/identity/cap rules and blocks missing, unknown-priced, excluded or later-cut pieces; nothing autosaves.');
