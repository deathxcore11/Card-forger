import assert from 'node:assert/strict';
import fs from 'node:fs';
import {abilityEndpointRequirements,inspectAbilityEndpoints,endpointCandidateMatches,auraAttachmentEligibility} from './mtg-ability-endpoints.js';
const frozen=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/ability-endpoint-cards.json',import.meta.url))).cards;
const stone=frozen.find(c=>c.name==='Stoneforge Mystic'),light=frozen.find(c=>c.name.startsWith('Light-Paws')),jeong=frozen.find(c=>c.name.startsWith('Jeong Jeong'));
const c=(name,type_line,oracle_text='',cmc=1)=>({name,type_line,oracle_text,cmc,mana_cost:'{W}'}),row=(card,qty=1,zone='main')=>({name:card.name,card,qty,zone});
const equipment=c('Synthetic equipment','Artifact — Equipment','Equip {1}'),artifact=c('Synthetic generic artifact','Artifact'),maker=c('Synthetic token maker','Creature — Human','Create an Equipment token.');
let r=inspectAbilityEndpoints([row(stone),row(artifact),row(maker)]);
assert.equal(r.groups.length,2);assert.equal(r.groups[1].kind,'equipment-hand-put');assert.equal(r.groups[1].zone,'hand');assert.equal(r.groups[1].status,'unsupported');assert.equal(r.groups[0].status,'unsupported');assert.equal(r.groups[0].branchCredit,'absent');assert.deepEqual(r.issues,[],'optional dead search is not whole-card illegality');
r=inspectAbilityEndpoints([row(stone),row(equipment)]);assert.equal(r.groups[0].eligibleCopies,1);assert.equal(r.groups[0].status,'conditional');assert.equal(r.groups[0].branchCredit,'conditional');
assert.equal(inspectAbilityEndpoints([row(stone),row(equipment,1,'side')]).groups[0].status,'unsupported');
assert.equal(inspectAbilityEndpoints([row(stone),row(equipment)],{commander:equipment.name}).groups[0].status,'unsupported','command-zone copy is not library tutor target');
assert.equal(inspectAbilityEndpoints([row(stone),row({name:'Unknown'})]).groups[0].status,'unverified');
const qualified=c('Synthetic qualified tutor','Creature','Search your library for an Equipment card with mana value 1, reveal it, put it into your hand, then shuffle.');
assert.equal(inspectAbilityEndpoints([row(qualified),row(equipment)]).groups[0].status,'unverified','unparsed tutor restrictions never positive');
assert.equal(abilityEndpointRequirements(c('Negative control','Creature',"You can't search your library for an Equipment card, reveal it, put it into your hand." )).length,0);
const aura=(name,cmc=1,restriction='creature')=>c(name,'Enchantment — Aura','Enchant '+restriction+'\nEnchanted creature gets +1/+1.',cmc);
const cheap=aura('Synthetic cheap Aura'),costly=aura('Synthetic costly Aura',3),land=aura('Synthetic land Aura',1,'land'),enemy=aura('Synthetic opposing Aura',1,'creature an opponent controls'),unknown=aura('Synthetic qualified Aura',1,'creature with mana value 2 or less');
assert.equal(inspectAbilityEndpoints([row(light),row(cheap,4)]).groups[0].status,'unsupported','same-name copies cannot form a different-name tutor pair');
r=inspectAbilityEndpoints([row(light),row(cheap),row(costly)]);assert.equal(r.groups[0].status,'conditional');assert.deepEqual(r.groups[0].pairs,[{trigger:costly.name,endpoint:cheap.name,triggerManaValue:3,endpointManaValue:1}]);
assert.equal(inspectAbilityEndpoints([row(light),row(costly),row(land)]).groups[0].status,'unsupported','low-MV land enchantment cannot attach to Light-Paws; high-MV creature Aura exceeds trigger');
assert.equal(inspectAbilityEndpoints([row(light),row(costly),row(enemy)]).groups[0].status,'unsupported','opponent-only low-MV Aura cannot attach to own source');
assert.equal(inspectAbilityEndpoints([row(light),row(costly),row(unknown)]).groups[0].status,'unverified','unrecognized attach restrictions stay unknown');
assert.equal(inspectAbilityEndpoints([row(light),row(costly),row({...cheap,cmc:undefined})]).groups[0].status,'unverified');
assert.equal(inspectAbilityEndpoints([row(light),row(costly),row(cheap)],{controlledAuraNames:[cheap.name]}).groups[0].status,'unsupported','already-controlled endpoint name excluded when supplied');
assert.equal(inspectAbilityEndpoints([row(light),row(c('Synthetic Role provider','Creature','Create a Sorcerer Role token.')),row(cheap)]).groups[0].status,'unsupported','Role provider is not a cast Aura');
assert.equal(inspectAbilityEndpoints([row(light),row({...costly,layout:'token'}),row(cheap)]).groups[0].status,'unsupported','token object is not a cast-card trigger');
assert.equal(auraAttachmentEligibility(cheap,{...light,oracle_text:'Shroud\nHexproof\nWard {2}'}).status,'eligible','non-targeting attachment ignores shroud/own ward');
assert.equal(auraAttachmentEligibility(cheap,{...light,oracle_text:'Protection from white'}).status,'unknown');
assert.equal(auraAttachmentEligibility(cheap,{...light,oracle_text:"This creature can't be enchanted."}).status,'ineligible');
assert.equal(auraAttachmentEligibility(aura('Legendary',1,'legendary creature'),light).status,'eligible');
assert.equal(auraAttachmentEligibility(aura('Nonlegendary',1,'nonlegendary creature'),light).status,'ineligible');
const lesson=c('Synthetic lesson','Sorcery — Lesson');
r=inspectAbilityEndpoints([row(jeong)]);assert.equal(r.groups[0].status,'unsupported');assert.equal(r.groups[0].activationCost,'{3}','actual Jeong activation is three generic, not a copied invented cost');assert.deepEqual(r.issues,[]);
r=inspectAbilityEndpoints([row(jeong),row(lesson)]);assert.equal(r.groups[0].status,'conditional');assert.equal(r.groups[0].eligibleCopies,1);assert(r.groups[0].notes.some(n=>n.includes('same turn')));
assert.equal(inspectAbilityEndpoints([row(jeong),row(c('Mention only','Instant','Draw a Lesson card.'))]).groups[0].status,'unsupported');
const req=abilityEndpointRequirements(stone)[0];assert.equal(endpointCandidateMatches(req,equipment).status,'eligible');assert.equal(endpointCandidateMatches(req,artifact).status,'ineligible');
for(const source of frozen)for(const req of abilityEndpointRequirements(source)){assert(req.source.evidence);assert.equal(req.controller,'self');assert(req.zone);assert(req.timing);assert.equal(req.parserConfidence,'bounded-pattern');}
// The patterns follow text, not special card names, and never mutate sources.
const renamed={...stone,name:'Synthetic renamed search body'};assert.equal(abilityEndpointRequirements(renamed)[0].kind,'equipment-library-search');assert.equal(stone.name,'Stoneforge Mystic');
console.log('PASS: exact Stoneforge, Light-Paws, and Jeong branches require eligible printed endpoints; names/MV/attachment, token-vs-cast, command-zone, unknown data and optional utility stay distinct.');

const {engineMap}=await import('./engine-map.js');
const graphRows=cards=>cards.map(card=>({name:card.name,c:card,qty:1,zone:'main'}));
const deadGraph=engineMap('mtg',graphRows([stone,maker,artifact]));
assert(!deadGraph.links.some(l=>l.payoff===stone.name&&l.tag==='sub:Equipment'),'Equipment token provider is not a library or hand search endpoint');
assert(deadGraph.unsupported.some(g=>g.card===stone.name));
const goodGraph=engineMap('mtg',graphRows([stone,equipment]));
assert(goodGraph.links.some(l=>l.payoff===stone.name&&l.tag==='sub:Equipment'&&l.status==='conditional'));
const {buildDeck,themeQueries}=await import('./builder.js');const {cardKey}=await import('./core.js');
assert(themeQueries(stone).includes('t:equipment'));
const legal=card=>({...card,color_identity:['W'],legalities:{modern:'legal'},prices:{usd:'.1'}}),anchor=legal(stone),equip=legal(equipment),plains=legal(c('Plains','Basic Land — Plains','{T}: Add {W}.',0));plains.mana_cost='';plains.produced_mana=['W'];
const pool=[anchor,equip,plains,...Array.from({length:30},(_,i)=>legal(c('Synthetic generic filler '+i,'Creature — Human','Draw a card.')))];
const catalog=Object.fromEntries(pool.map(card=>[cardKey(card.name),card]));
for(const completionFirst of [false,true]){
 const deck=buildDeck({format:'Modern',seeds:[anchor],base:[{name:anchor.name,qty:1}],catalog,budget:20,price:()=>.1,available:()=>0,completionFirst});
 assert.equal(deck.total,60);assert(deck.cards.some(r=>r.name===equip.name));
 assert.equal(inspectAbilityEndpoints(deck.cards.map(r=>({...r,card:catalog[cardKey(r.name)]}))).status,'conditional');
}
console.log('PASS: mapped branch links reject token-only endpoints, retain conditional real endpoints, and normal/economical builds select an affordable anchor endpoint.');

for(const cmc of ['', ' ', false]){
 const bad=c('Unknown mana Aura','Enchantment — Aura','Enchant creature',cmc),trigger=c('Known three Aura','Enchantment — Aura','Enchant creature',3);
 const report=inspectAbilityEndpoints([row(light),row(bad),row(trigger)]);
 assert.equal(report.status,'unverified','Invalid mana metadata cannot coerce to zero and prove Aura endpoint');
}

for(const completionFirst of [false,true]){
 const deck=buildDeck({format:'Modern',seeds:[anchor],catalog,budget:5.8,price:c=>c.name===anchor.name?5:c.name===equip.name?1:.01,available:()=>0,completionFirst});
 assert.equal(deck.total,60);assert(deck.cards.some(r=>r.name===anchor.name),'Optional endpoint cannot spend the absent required seed budget');assert(deck.cost<=5.8);
}
