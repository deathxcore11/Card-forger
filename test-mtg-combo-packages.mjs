// Conditional rules packages, not a game simulation. Card text fragments retain
// only the abilities used by each proof; source notes are recorded in the module.
import assert from 'node:assert/strict';
import {MANA_LOOP_CATALOGUE,readLoopIntent,manaLoopCandidates,traceManaLoop,inspectManaLoop} from './mtg-combo-packages.js';
const card=(name,type_line,oracle_text,color_identity=[])=>({name,type_line,oracle_text,color_identity,legalities:{commander:'legal'}});
const basalt=card('Basalt Monolith','Artifact',"Basalt Monolith doesn't untap during your untap step.\n{T}: Add {C}{C}{C}.\n{3}: Untap Basalt Monolith.");
const monument=card('Forsaken Monument','Legendary Artifact','Whenever you tap a permanent for {C}, add an additional {C}.');
const rings=card('Rings of Brighthearth','Artifact',"Whenever you activate an ability, if it isn't a mana ability, you may pay {2}. If you do, copy that ability.");
const druid=card('Devoted Druid','Creature — Elf Druid','{T}: Add {G}.\nPut a -1/-1 counter on this creature: Untap this creature.',['G']);
const vizier=card('Vizier of Remedies','Creature — Human Cleric','If one or more -1/-1 counters would be put on a creature you control, that many minus one -1/-1 counters are put on it instead.',['W']);
const row=(card,zone='main',qty=1)=>({card,name:card.name,qty,zone});
const request={requireLoop:'infinite-mana'};
for(const prompt of ['Make a deck with infinite mana','Make an infinite loop of mana deck','Build a bad deck that generates infinite mana','Infinite mana Commander deck'])assert.equal(readLoopIntent(prompt).requireLoop,'infinite-mana',prompt);
assert.equal(readLoopIntent('infinite black mana').loopOutput,'B');
assert.equal(readLoopIntent('an infinite loop of red mana').loopOutput,'R');
assert.equal(readLoopIntent('infinite colorless mana').loopOutput,'C');
assert.equal(readLoopIntent('infinite mana of any color').loopOutput,'any-color');
assert.equal(readLoopIntent('infinite coloured mana').loopOutput,'any-color');
for(const prompt of ['No infinite mana','a deck without infinite combos','avoid infinite loops','not infinite black mana'])assert.equal(readLoopIntent(prompt).requireLoop,null,prompt);
assert.equal(readLoopIntent('No infinite combos, but make infinite mana').loopConflict,true);
for(const prompt of ['No infinite combos','Remove the infinite mana requirement','Drop the loop requirement',"I don't need infinite mana"]){
 const intent=readLoopIntent(prompt);assert.equal(intent.requireLoop,null,prompt);assert.equal(intent.clearLoop,true,prompt);
}
assert.equal(readLoopIntent('Make it cheaper').clearLoop,false,'No loop mention retains the earlier request');
assert.equal(readLoopIntent('Remove Basalt Monolith').clearLoop,false,'Removing one package piece does not waive the requested outcome');
for(const prompt of ["I don't want a deck with infinite mana","Please don't make an infinite mana deck",'Avoid a deck with infinite mana']){
 const intent=readLoopIntent(prompt);assert.equal(intent.requireLoop,null,prompt);assert.equal(intent.clearLoop,true,prompt);
}
assert.equal(readLoopIntent('I want infinite green mana but no infinite damage').loopConflict,false,'A prohibition on damage loops is not a prohibition on mana');
assert.equal(readLoopIntent('Infinite colorless mana, no infinite green mana').loopConflict,false);
assert.equal(readLoopIntent('Infinite green mana, no infinite green mana').loopConflict,true);
assert.ok(readLoopIntent("I don't want to loop my opponents").unsupportedLoop,'A specific negative loop restriction is not silently discarded');
assert.equal(readLoopIntent('No infinite combos').avoidInfinite,true);
assert.equal(readLoopIntent('No infinite damage').avoidInfinite,false,'Specific output prohibition is not an all-loop ban');
assert.equal(readLoopIntent('No infinite damage').hasLoopNegation,true);
assert.ok(readLoopIntent('No infinite mana').unsupportedLoop,'Clearing a positive requirement must not discard the replacement negative restriction');
assert.ok(readLoopIntent('Build infinite mana and infinite Goblin tokens').unsupportedLoop,'A mana proof does not satisfy the separately requested token loop');
assert.ok(readLoopIntent('Build infinite red and blue mana').unsupportedLoop,'Multiple required outputs need an explicit supported package');
for(const prompt of ['a bad deck that loops my ops','infinite Goblin tokens','infinite damage','infinite card draw','infinite extra turns']){
 const intent=readLoopIntent(prompt);assert.equal(intent.requireLoop,null,prompt);assert.match(intent.unsupportedLoop,/Specify the repeatable result/,prompt);
}
assert.equal(readLoopIntent('Just a normal Goblin deck').unsupportedLoop,null);
assert.equal(readLoopIntent('Include "Infinite Reflection"').requireLoop,null);
assert.equal(readLoopIntent('Build around Endless One').unsupportedLoop,null,'An unquoted card-name adjective does not request a loop');

const mono=traceManaLoop('basalt-monument',{iterations:20});
assert.equal(mono.startMana,0);assert.equal(mono.endMana,20);assert.equal(mono.netMana,20);assert.equal(mono.sourceUntapped,true);
const copied=traceManaLoop('basalt-rings',{iterations:20});
assert.equal(copied.startMana,2);assert.equal(copied.endMana,22);assert.equal(copied.netMana,20);assert.equal(copied.sourceUntapped,true);
// The copy must untap before the source taps a second time, then the original
// untap restores readiness; merely copying the initial mana ability is invalid.
assert.deepEqual(copied.trace.slice(0,6).map(s=>[s.mana,s.tapped]),[[5,true],[2,true],[0,true],[0,false],[3,true],[3,false]]);
assert.throws(()=>traceManaLoop('basalt-rings',{startupMana:1}),/startup mana/);
assert.throws(()=>traceManaLoop('basalt-monument',{ready:false}),/untapped/);
const devotion=traceManaLoop('devoted-vizier',{iterations:20});
assert.equal(devotion.resource,'G');assert.equal(devotion.netMana,20);assert.equal(devotion.counters,0);assert.equal(devotion.sourceUntapped,true);
assert.throws(()=>traceManaLoop('devoted-vizier',{counterPlacementAllowed:false}),/Counter prohibition/);
assert.throws(()=>traceManaLoop('devoted-vizier',{iterations:Infinity}),/finite repetitions/);

for(const pieces of [[basalt,monument],[basalt,rings],[druid,vizier]]){
 const check=inspectManaLoop(pieces.map(c=>row(c)),request);
 assert.equal(check.status,'verified');assert.equal(check.packages.length,1);
 assert.equal(check.packages[0].netResources[check.packages[0].resource],1);
 assert.ok(check.packages[0].prerequisites.length);assert.ok(check.packages[0].steps.length);
 assert.ok(check.packages[0].sources.every(s=>new URL(s.url).hostname==='magic.wizards.com'));
 assert.match(check.packages[0].limitations.join(' '),/outlet.*separate/);
}
assert.equal(inspectManaLoop([row(basalt),row(monument,'side')],request).status,'unverified','Sideboard is not deployed/main-list availability');
assert.equal(inspectManaLoop([row(basalt),row(monument,'main',0)],request).status,'unverified');
assert.equal(inspectManaLoop([row(basalt)],request).status,'unverified','The lone Monolith has no net mana gain');
assert.equal(inspectManaLoop([row({...basalt,oracle_text:basalt.oracle_text.replace('{3}:','{4}:')}),row(monument)],request).status,'unverified','A changed untap cost cannot use the old proof');
assert.equal(inspectManaLoop([row({...basalt,oracle_text:basalt.oracle_text+'\nActivate only once each turn.'}),row(monument)],request).status,'unverified','Finite restriction must not pass an infinite proof');
assert.equal(inspectManaLoop([row({...rings,oracle_text:rings.oracle_text+' Activate only once each turn.'}),row(basalt)],request).status,'unverified');
assert.equal(inspectManaLoop([row({...basalt,name:'A-Basalt Monolith'}),row(monument)],request).status,'unverified');
assert.equal(inspectManaLoop([row({...monument,oracle_text:''}),row(basalt)],request).status,'unverified','Names without resolved effect data are insufficient');
assert.equal(inspectManaLoop([row(basalt),row(monument)],{...request,loopOutput:'B'}).status,'unverified','Colorless mana is not black mana');
assert.equal(inspectManaLoop([row(basalt),row(monument)],{...request,loopOutput:'any-color'}).status,'unverified');
assert.equal(inspectManaLoop([row(druid),row(vizier)],{...request,loopOutput:'G'}).status,'verified');
assert.equal(inspectManaLoop([row(basalt),row(monument)],{...request,avoid_infinite:true}).status,'conflict');
assert.equal(inspectManaLoop([row(basalt),row(monument)],{}).status,'not-requested');
assert.equal(manaLoopCandidates({...request,loopOutput:'C'}).length,2);
assert.equal(manaLoopCandidates({...request,loopOutput:'B'}).length,0);
assert.equal(manaLoopCandidates(request,{excluded_cards:['Basalt Monolith']}).map(p=>p.id).join(','),'devoted-vizier');
assert.equal(manaLoopCandidates({...request,avoid_infinite:true}).length,0);

for(const blocker of [
 card('Null Rod','Artifact',"Activated abilities of artifacts can't be activated."),
 card('Suppression Field','Enchantment',"Activated abilities cost {2} more to activate unless they're mana abilities."),
 card('Damping Matrix','Artifact',"Activated abilities of artifacts and creatures can't be activated unless they're mana abilities.")
]){
 const check=inspectManaLoop([row(basalt),row(monument),row(blocker)],request);
 assert.equal(check.status,'unverified',blocker.name);assert.ok(check.missing.some(p=>p.blockedBy.length));
}
for(const blocker of [card('Cursed Totem','Artifact',"Activated abilities of creatures can't be activated."),card('Solemnity','Enchantment',"Players can't get counters.\nCounters can't be put on artifacts, creatures, enchantments, or lands.")])assert.equal(inspectManaLoop([row(druid),row(vizier),row(blocker)],request).status,'unverified',blocker.name);
assert.equal(inspectManaLoop([row(basalt),row(monument),row(card('Cursed Totem','Artifact',"Activated abilities of creatures can't be activated."))],request).status,'verified','Creature-only blocker does not stop the noncreature artifact package');
assert.equal(MANA_LOOP_CATALOGUE.length,3);
console.log('PASS: three exact-card mana packages, productive reset ledgers, startup/haste prerequisites, requested output colors, missing/changed/sideboard pieces, self-blockers and explicit unsupported outcomes; no full-game or winning-outlet claim.');
