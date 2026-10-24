import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commanderTheme,tribeEvidence,readCreatureTypeRestrictions,fitsTypeRestrictions} from './planner.js';
import {commanderCardConditions} from './mtg-commander-conditions.js';
import {inspectMtgTheme,buildDeck,requestedIntent} from './builder.js';
import {synergyTest,engineRoles} from './insights.js';
import {landSubtypeRoles} from './mtg-land-requirements.js';
import {cardKey} from './core.js';
import {normalizeDeckRequest,inspectDeckPlan} from './deck-construction.js';
import {FORMATS} from './formats.js';
const [mikaeus,piandao]=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/commander-card-conditions.json',import.meta.url))).cards;
// Synthetic counterexamples use exact printed characteristic patterns; the two
// commanders above are unmodified provider records retrieved on 2026-10-24.
const card=(name,type_line,oracle_text='')=>({name,type_line,oracle_text,cmc:2,mana_cost:'{1}{B}',colors:['B'],color_identity:['B'],legalities:{commander:'legal',standard:'legal'},prices:{usd:'0.10'}});
const human=card('Useful Human','Creature — Human Cleric','When this creature enters, draw a card.'),zombie=card('Zombie','Creature — Zombie'),changeling=card('Changeling','Creature — Shapeshifter','Changeling'),tokens=card('Token maker','Sorcery','Create two 1/1 white Ally creature tokens.'),equipment=card('Equipment','Artifact — Equipment'),lesson=card('Lesson','Instant — Lesson'),ally=card('Ally','Creature — Human Ally');
assert.deepEqual(tribeEvidence(mikaeus,'Human'),[]);
assert.deepEqual(requestedIntent('non-Human creatures').tribes,[]);
assert.deepEqual(requestedIntent('non-Human creatures').other,[]);
assert.deepEqual(requestedIntent('Human creatures').tribes,['Human']);
for(const theme of ['only non-Human creatures','only non-Humans','only non‑Human creatures']){
 assert.deepEqual(readCreatureTypeRestrictions(theme).excludedSubtypes,['Human']);
 const request=normalizeDeckRequest({game:'mtg',format:'Commander',theme},{mtg:FORMATS});
 assert.deepEqual(request.excludedSubtypes,['Human']);
 assert.equal(request.constraintSources.excludedSubtypes,'theme');
 assert(inspectDeckPlan(request,[{name:human.name,card:human,qty:1,zone:'main'}]).typeRestrictions.conflicts.includes(human.name));
}
assert(requestedIntent('only non-Humam creatures').other.includes('non'),'unknown misspelling is not silently verified');
assert.deepEqual(readCreatureTypeRestrictions('not only non-Human creatures').excludedSubtypes,[]);
for(const theme of ['only non-Human tokens','only non-Human creature tokens','only non-Human commanders'])assert.deepEqual(readCreatureTypeRestrictions(theme).excludedSubtypes,[],theme+' does not ban Human library creatures');
assert(!fitsTypeRestrictions(human,readCreatureTypeRestrictions('strictly non-Human creatures')));
assert(fitsTypeRestrictions(zombie,readCreatureTypeRestrictions('strictly non-Human creatures')));
assert(!commanderTheme(mikaeus).tribes.includes('Human'));
assert(tribeEvidence(card('Positive','Enchantment','Humans you control get +1/+1.'),'Human').length);
const nonHuman=commanderCardConditions(mikaeus)[0];
assert(nonHuman.matches(zombie));assert(!nonHuman.matches(human));assert(!nonHuman.matches(changeling));assert(!nonHuman.matches(mikaeus));assert(!nonHuman.matches(tokens));
assert(synergyTest(mikaeus).test(zombie));assert(!synergyTest(mikaeus).test(human));
const hits=commanderCardConditions(piandao)[0];assert.equal(hits.seen,4);
for(const c of [equipment,lesson,ally,changeling,card('Kindred changeling','Kindred Instant — Shapeshifter','Changeling')])assert(hits.matches(c),c.name);
assert(!hits.matches(tokens));assert(!hits.matches(human));
assert(synergyTest(piandao).test(equipment));assert(!synergyTest(piandao).test(tokens));
const row=(card,qty=1)=>({name:card.name,card,qty,zone:'main'});
const analyzed=inspectMtgTheme([row(piandao),row(equipment,10),row(lesson,10),row(ally,10),row(tokens,69)],{commander:piandao.name});
assert.equal(analyzed.cardConditions.groups[0].copies,30);assert.equal(analyzed.cardConditions.groups[0].seen,4);assert.equal(analyzed.cardConditions.groups[0].library,99);
assert.equal(inspectMtgTheme([row(mikaeus),row(human,99)],{commander:mikaeus.name}).cardConditions.status,'insufficient');
assert.equal(inspectMtgTheme([row(piandao),row(tokens,99)],{commander:piandao.name}).cardConditions.status,'insufficient');
assert.equal(commanderCardConditions(card('Unknown','Creature','Whenever this attacks, do a mysterious thing.')).length,0);
// The builder prefers eligible recipients but never turns a soft commander
// plan into a ban on independently useful Human support cards.
const swamp={name:'Swamp',type_line:'Basic Land — Swamp',oracle_text:'({T}: Add {B}.)',produced_mana:['B'],color_identity:['B'],legalities:{commander:'legal'},prices:{usd:'0.10'}};
const catalog=Object.fromEntries([mikaeus,swamp,human,...Array.from({length:70},(_,i)=>({...zombie,name:'Zombie '+i}))].map(c=>[cardKey(c.name),c]));
const built=buildDeck({format:'Commander',commander:mikaeus,seeds:[mikaeus],base:[{name:human.name,qty:1}],catalog,price:()=>.1});
assert.equal(built.open,0);assert(built.cards.some(r=>r.name===human.name));
assert(!engineRoles(card('Torch pattern','Artifact — Equipment','Whenever equipped creature becomes blocked, it deals 2 damage to each creature blocking it.')).includes('Wipe'));
assert(engineRoles(card('Board damage','Sorcery','This spell deals 3 damage to each creature.')).includes('Wipe'));
const landFixture=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/commander-land-requirements.json',import.meta.url))).cards;
const scavenger=landFixture.find(c=>c.name==='Scavenger Grounds');assert(scavenger);
assert(landSubtypeRoles(scavenger,'Desert').some(r=>r.kind==='source'));
assert(!landSubtypeRoles(scavenger,'Desert').some(r=>r.kind==='setup'),'sacrifice then exile all graveyards leaves no replayable Desert');
assert(!landSubtypeRoles(card('Clear own graveyard','Artifact','{T}, Sacrifice a land: Exile all cards from your graveyard.'),'Desert').some(r=>r.kind==='setup'));
assert(landSubtypeRoles(card('Targeted graveyard utility','Artifact','{T}, Sacrifice a land: Exile target card from a graveyard.'),'Desert').some(r=>r.kind==='setup'),'targeted exile can leave the sacrificed land');
const trigger=card('Payoff only','Enchantment','Whenever you sacrifice a Desert, return target land card from your graveyard to your hand.');
assert(!landSubtypeRoles(trigger,'Desert').some(r=>r.kind==='setup'));
assert(landSubtypeRoles(card('ETB setup','Creature','When this creature enters, you may sacrifice a land.'),'Desert').some(r=>r.kind==='setup'));
assert(landSubtypeRoles(card('Cost setup','Artifact','{T}, Sacrifice a land: Draw a card.'),'Desert').some(r=>r.kind==='setup'));
console.log('Commander printed-card conditions: negation, OR hits, no token/human false credit, final gate, builder utility preservation, and sacrifice-provider regressions passed.');
