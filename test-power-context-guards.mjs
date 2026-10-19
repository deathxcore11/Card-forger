import assert from 'node:assert/strict';
import {commanderDrawProfile} from './commander-criteria.js';
import {engineProfile} from './insights.js';
import {spendUp} from './deck-optimizer.js';
import {cardKey} from './core.js';

const card=(name,type_line,oracle_text,cmc=3)=>({name,type_line,oracle_text,cmc});
const arena=card('Phyrexian Arena','Enchantment','At the beginning of your upkeep, you draw a card and you lose 1 life.');
const feast=card('Master of the Feast','Enchantment Creature — Demon','Flying\nAt the beginning of your upkeep, each opponent draws a card.');
const crawler=card('Psychosis Crawler','Artifact Creature — Phyrexian Horror','Whenever you draw a card, each opponent loses 1 life.',5);
const chains=card('Chains of Mephistopheles','Enchantment',"If a player would draw a card except the first one they draw in each of their draw steps, that player discards a card instead. If the player discards a card this way, they draw a card. If the player doesn't discard a card this way, they mill a card.",2);
const insight=card('Teferi’s Ageless Insight','Legendary Enchantment','If you would draw a card except the first one you draw in each of your draw steps, draw two cards instead.',4);
const opt=card('Opt','Instant','Scry 1.\nDraw a card.',1);
const sphinx=card('Consecrated Sphinx','Creature — Sphinx','Flying\nWhenever an opponent draws a card, you may draw two cards.',6);
const rendezvous=card('Secret Rendezvous','Sorcery','You and target opponent each draw three cards.');
const glass=card('Magnifying Glass','Artifact','{T}: Add {C}.\n{4}, {T}: Investigate.');
const cycling=card('Hollow One','Artifact Creature — Golem','This spell costs {2} less to cast for each card you’ve cycled or discarded this turn.\nCycling {2} ({2}, Discard this card: Draw a card.)',5);
const profile=c=>commanderDrawProfile(c,[]);
assert.equal(profile(arena).repeatable,true,'upkeep engine is repeatable');
assert.equal(profile(arena).cantrip,false,'upkeep engine is not a one-shot cantrip');
assert.equal(profile(arena).status,'conditional','waiting for an upkeep is a prerequisite');
assert.ok(profile(arena).effective>profile(opt).effective);
for(const c of [feast,crawler,chains,insight]){
 assert.equal(profile(c).effective,0,`${c.name}: no independent own draw source`);
 assert.equal(profile(c).status,'unsupported');
 assert.ok(profile(c).requirements.length,'excluded evidence explains why');
}
assert.ok(profile(sphinx).effective>0,'opponent trigger must retain its separate own draw effect');
assert.ok(profile(rendezvous).effective>0,'shared draw explicitly includes you');
assert.equal(profile(glass).activationMana,6,'Clue activation follows investigate');
assert.equal(profile(cycling).repeatable,false,'discarding this card is one-shot');
assert.ok(profile(cycling).cantrip);
const independent=card('Independent draw regression','Artifact','If you would draw a card, draw two cards instead.\n{2}, {T}: Draw a card.');
assert.ok(profile(independent).effective>0,'separate independent activation survives replacement exclusion');
const paidChoice=card('Independent paid choices','Artifact','{1}, {T}: Draw a card.');const additionalChoice={...paidChoice,oracle_text:paidChoice.oracle_text+'\n{99}: Draw a card.'};assert.equal(profile(additionalChoice).activationMana,profile(paidChoice).activationMana,'unused expensive draw activation is optional');assert.equal(profile(additionalChoice).effective,profile(paidChoice).effective);assert.equal(profile(cycling).activationMana,2,'cycling printed cost is paid once, not reminder counted twice');

const commander=card('Test commander','Legendary Creature — Human','Creatures you control get +1/+1.');
const catalog=Object.fromEntries([commander,feast,crawler,chains].map(c=>[cardKey(c.name),c]));
const d={format:'Commander',commander:commander.name,cards:[commander,feast,crawler,chains].map(c=>({name:c.name,qty:1}))};
assert.equal(engineProfile(d,catalog).criteria.resources.draw.effective,0,'raw draw tags do not restore excluded effective flow');

// A higher-price/popularity candidate must not bypass plan and goal safeguards.
const seed={cards:[{name:'Plan support',qty:1}]},newCard={name:'Generic staple'};
const before={score:90,readiness:{provisional:false},criteria:{goal:'strongest',plan:{status:'supported',supportedCopies:1,routes:[{kind:'tribal',status:'conditional'}]}}};
const after={...before,score:91,criteria:{...before.criteria,plan:{status:'supported',supportedCopies:0,routes:[]}}};
const opts={pool:[newCard],quality:c=>c.name===newCard.name?10:0,rows:d=>d.cards.map(r=>({...r,key:r.name,card:{name:r.name}})),swap:(d,w,c)=>({...d,cards:[{name:c.name,qty:1}]}),cost:d=>({cost:d.cards[0].name===newCard.name?5:1,unknown:0}),evaluate:d=>d.cards[0].name===newCard.name?after:before,maxCopies:()=>1,maxSwaps:1};
assert.equal((await spendUp(seed,20,opts)).swaps.length,0,'spending rejects a lost route even when structural score rises');
for(const goal of ['fun','chaos','weak'])assert.equal((await spendUp({...seed,goal},20,{...opts,evaluate:()=>({score:90})})).swaps.length,0,`${goal} cannot enter the price/popularity strength search`);
const genuine={...after,criteria:before.criteria};
assert.equal((await spendUp(seed,20,{...opts,evaluate:d=>d.cards[0].name===newCard.name?genuine:before})).swaps.length,1,'supported stronger replacement still works');
console.log('PASS: Commander draw ownership, replacement/trigger exclusion, upkeep recurrence, one-shot cycling, and spend-up plan/subjective-goal guards.');
