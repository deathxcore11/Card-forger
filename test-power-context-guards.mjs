import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commanderDrawProfile,commanderCriteria} from './commander-criteria.js';
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

const frozen=JSON.parse(fs.readFileSync(new URL('./test-fixtures/commander-context.json',import.meta.url),'utf8')).catalog;
const puresteel=frozen['puresteel paladin'],innocence=frozen['enduring innocence'],ordinaryArtifact=card('Plain artifact','Artifact','');
const withoutEquipment=commanderDrawProfile(puresteel,[{c:puresteel,qty:1},{c:ordinaryArtifact,qty:20}]);assert.equal(withoutEquipment.repeatable,false);assert.equal(withoutEquipment.effective,0);assert.match(withoutEquipment.requirements.join(' '),/no identified Equipment/);
const equipment=card('Fixture Equipment','Artifact — Equipment','Equip {1}',1);assert.equal(commanderDrawProfile(puresteel,[{c:puresteel,qty:1},{c:equipment,qty:1}]).repeatable,true,'actual Equipment restores recognized trigger support');
assert.equal(commanderDrawProfile({...puresteel,oracle_text:puresteel.oracle_text+'\n{1}: Draw a card.'},[{c:puresteel,qty:1}]).repeatable,true,'missing Equipment never deletes an independent paid draw mode');

// Public frozen Oracle text plus independently specified synthetic providers.
// Presence establishes a possible trigger, not access, density or a draw rate.
const creature=(name,power,cmc=2,type='Creature — Human')=>({...card(name,type,'',cmc),power:String(power),toughness:'2'}),bigBody=creature('Large provider',4),smallBody=creature('Small provider',2),expensiveSmall=creature('Costly small provider',1,6);
const tokenMaker=(name,oracle_text)=>card(name,'Enchantment',oracle_text),smallToken=tokenMaker('Small token producer','{2}: Create a 1/1 white Cat creature token.'),largeToken=tokenMaker('Large token producer','Create a 4/4 green Beast creature token.'),opponentToken=tokenMaker('Opponent token producer','Target opponent creates a 1/1 white Cat creature token.'),food=tokenMaker('Food producer','Create a Food token.');
const drawWith=(source,providers=[],copies=1)=>commanderDrawProfile(source,[{c:source,qty:copies},...providers.map(c=>({c,qty:1}))]);
for(const provider of [bigBody,largeToken,opponentToken,food]){
 const absent=drawWith(innocence,[provider]);assert.equal(absent.effective,0,provider.name+' does not satisfy power<=2 creature entry');assert.equal(absent.repeatable,false);assert.equal(absent.providerEvidence[0].status,'unsupported');
}
assert.equal(drawWith(innocence).effective,0,'the one source is not another creature');
assert.equal(commanderDrawProfile(innocence,[{c:structuredClone(innocence),qty:1}]).effective,0,'a cloned card object cannot evade physical identity');
for(const provider of [smallBody,expensiveSmall,smallToken]){
 const restored=drawWith(innocence,[provider]);assert.ok(restored.effective>0);assert.equal(restored.repeatable,true);assert.equal(restored.status,'conditional');assert.match(restored.requirements.join(' '),/presence is not access/);
}
const second=drawWith(innocence,[],2);assert.equal(second.repeatable,true);assert.equal(second.providerEvidence[0].providers[0].qty,1,'only the second physical copy supplies other-entry support');
const split=commanderDrawProfile(innocence,[{c:structuredClone(innocence),qty:1},{c:structuredClone(innocence),qty:1}]);assert.deepEqual(split.providerEvidence[0].providers.map(r=>r.qty),[1],'split rows subtract the source once, not once per row');
const alonePlusPaid={...innocence,oracle_text:innocence.oracle_text+'\n{1}: Draw a card.'},paid=drawWith(alonePlusPaid,[bigBody]);assert.ok(paid.effective>0);assert.equal(paid.repeatable,true);assert.equal(paid.activationMana,1);assert.equal(paid.providerEvidence[0].status,'unsupported','unsupported triggered mode stays visible beside independent paid draw');
const alonePlusEtb={...innocence,oracle_text:innocence.oracle_text+'\nWhen this creature enters, draw a card.'},etbOnly=drawWith(alonePlusEtb,[bigBody]);assert.ok(etbOnly.effective>0);assert.equal(etbOnly.repeatable,false,'the retained own ETB is not a recurring external-provider engine');
const nontokenSource=card('Nontoken draw source','Enchantment','Whenever another nontoken creature you control with power 2 or less enters, draw a card.');
assert.equal(drawWith(nontokenSource,[smallToken]).effective,0);assert.equal(drawWith(nontokenSource,[smallBody]).repeatable,true);
const mvSource=card('Mana-value draw source','Enchantment','Whenever one or more creatures with mana value 3 or less enter under your control, draw a card.'),mvHigher=card('Expensive-spell draw source','Enchantment','Whenever you cast a creature spell with mana value 4 or greater, draw a card.');
assert.equal(drawWith(mvSource,[expensiveSmall]).effective,0,'small power is not low mana value');assert.equal(drawWith(mvSource,[bigBody]).repeatable,true,'power does not disqualify a valid mana-value provider');assert.equal(drawWith(mvSource,[smallToken]).repeatable,true,'a fixed noncopy creature token has mana value zero');
assert.equal(drawWith(mvHigher,[expensiveSmall]).repeatable,true);assert.equal(drawWith(mvHigher,[smallBody,smallToken]).effective,0,'token creation is not a creature-spell cast');
const mixedSource=card('Mixed-threshold draw source','Enchantment','Whenever another creature you control with power 2 or less and mana value 3 or less enters, draw a card.');
assert.equal(drawWith(mixedSource,[expensiveSmall,bigBody]).effective,0,'two different providers cannot each satisfy only one conjunct');assert.equal(drawWith(mixedSource,[smallBody]).repeatable,true);
const tribalSource=card('Tribal draw source','Enchantment','Whenever another Elf you control enters, draw a card.'),elf=creature('Elf provider',1,1,'Creature — Elf');assert.equal(drawWith(tribalSource,[smallBody]).effective,0);assert.equal(drawWith(tribalSource,[elf]).repeatable,true);
const castSource=creature('Creature cast source',2);castSource.oracle_text='Whenever you cast a creature spell, draw a card.';assert.equal(drawWith(castSource).effective,0,'a permanent cannot listen to its own casting');assert.equal(drawWith(castSource,[],2).repeatable,true);assert.equal(drawWith(castSource,[smallToken]).effective,0);
const genericEntry=creature('Own-entry source',2);genericEntry.oracle_text='Whenever a creature you control enters, draw a card.';const ownOnly=drawWith(genericEntry);assert.equal(ownOnly.providerEvidence[0].status,'one-shot');assert.ok(ownOnly.effective>0);assert.equal(ownOnly.repeatable,false);assert.equal(drawWith(genericEntry,[smallBody]).repeatable,true);
const equipmentToken=tokenMaker('Equipment token producer','Create a colorless Equipment artifact token named Sword with equip {1}.'),equipmentCast=card('Equipment cast source','Creature — Human','Whenever you cast an Equipment spell, draw a card.');
assert.equal(drawWith(puresteel,[equipmentToken]).repeatable,true);assert.equal(drawWith(equipmentCast,[equipmentToken]).effective,0);assert.equal(drawWith(equipmentCast,[equipment]).repeatable,true);
const variablePower=creature('Variable-power provider','*'),variableToken=tokenMaker('Variable token producer','Create an X/X green Beast creature token.'),copiedToken=tokenMaker('Copied token producer','Create a token that is a copy of target creature.'),variableCount=tokenMaker('Variable token count','Create X 1/1 white Soldier creature tokens.'),lifeToken=tokenMaker('Unverified token trigger','Whenever you gain life, create a 1/1 white Cat creature token.');
for(const provider of [variablePower,variableToken,copiedToken,variableCount,lifeToken]){const unverified=drawWith(innocence,[provider]);assert.equal(unverified.providerEvidence[0].status,'unverified',provider.name);assert.equal(unverified.repeatable,false);assert.ok(unverified.effective<drawWith(innocence,[smallBody]).effective);assert.match(unverified.requirements.join(' '),/unverified/);}
assert.ok(drawWith(innocence,[smallToken]).providerEvidence[0].providers[0].requirements.some(s=>/Activation/.test(s)),'recognized token activation cost remains in evidence');
const bootstrap={...innocence,oracle_text:'Whenever one or more other creatures you control with power 2 or less enter, create a 1/1 white Cat creature token. Draw a card.'};assert.equal(drawWith(bootstrap).repeatable,false,'tokens promised by the same trigger cannot bootstrap its own provider');assert.equal(drawWith(bootstrap).providerEvidence[0].status,'unverified');
const unmapped=card('Unmapped entry condition','Enchantment','Whenever a modified creature you control enters, draw a card.'),unknownContext=profile(innocence);
assert.equal(drawWith(unmapped,[smallBody]).providerEvidence[0].status,'unverified');assert.equal(drawWith(unmapped,[smallBody]).repeatable,false);assert.equal(unknownContext.repeatable,false);assert.equal(unknownContext.providerEvidence[0].status,'unverified','absent deck context is unknown, not proven absence');
assert.equal(commanderDrawProfile(innocence,[{c:innocence,qty:1},{name:'Unloaded provider',qty:1}]).providerEvidence[0].status,'unverified');
const opponentEntry=card('Opponent-entry draw source','Enchantment',"Whenever a creature enters under an opponent's control, draw a card.");assert.equal(drawWith(opponentEntry,[smallBody]).repeatable,false,'own creature presence does not establish an opponent entry');
assert.equal(drawWith({...innocence,oracle_text:innocence.oracle_text+'\nAt the beginning of your upkeep, draw a card.'},[bigBody]).repeatable,true,'an independent upkeep mode survives');
const smallCommander=creature('Small declared commander',1,1,'Legendary Creature — Human'),commanderDeck={format:'Commander',commander:smallCommander.name,cards:[{name:smallCommander.name,qty:1},{name:innocence.name,qty:1}]},commanderCatalog=Object.fromEntries([smallCommander,innocence].map(c=>[cardKey(c.name),c])),drawRole=c=>c.name===innocence.name?['Draw']:[];
const declared=JSON.stringify([commanderDeck,commanderCatalog]),available=commanderCriteria(commanderDeck,commanderCatalog,{roles:drawRole}),unavailable=commanderCriteria(commanderDeck,commanderCatalog,{roles:drawRole,commanderAvailable:false});
assert.ok(available.resources.draw.effective>0,'available commander may supply a conditional entry provider');assert.equal(unavailable.resources.draw.effective,0,'unavailable commander cannot remain the sole draw-trigger provider');assert.equal(unavailable.resources.draw.evidence[0].repeatable,false);assert.equal(JSON.stringify([commanderDeck,commanderCatalog]),declared,'provider counterfactual preserves commander identity, catalog and physical deck');
console.log('PASS: public Puresteel/Enduring provider regressions, typed/power/MV entry/cast constraints, physical-copy identity, compatible owned tokens, separate modes, and explicit unknown-provider limits.');
