import assert from 'node:assert/strict';
import fs from 'node:fs';
import {inspectMechanicPlan,requestedMechanics,mechanicDiscoveryQueries} from './deck-mechanic-plan.js';
import {inspectMtgTheme} from './builder.js';
const fixture=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/mechanic-plan-cards.json',import.meta.url))),find=name=>fixture.cards.find(c=>c.name===name),row=(card,qty=1,zone='main')=>({card,name:card.name,qty,zone});
const make=(label,text,type='Creature — Vampire',power='2')=>({name:'Synthetic '+label,type_line:type,oracle_text:text,power});
const basic=make('basic','{T}: Add {B}.','Basic Land — Swamp',''),filler=n=>Array.from({length:n},(_,i)=>row(make('filler '+i,'','Artifact','')));
const bloodlust=cards=>inspectMechanicPlan(cards,{abilities:['Bloodlust']}),bloodthirst=cards=>inspectMechanicPlan(cards,{abilities:['Bloodthirst']});
const drana=find('Drana, Liberator of Malakir'),marauders=find('Falkenrath Marauders'),noble=find('Stromkirk Noble'),slith=find('Slith Firewalker'),outcasts=find('Vampire Outcasts'),bloodrage=find('Bloodrage Vampire'),sign=find('Sign in Blood'),taste=find('Taste of Blood');

// Two different mechanics, plus a real card name, must remain separate intents.
assert.deepEqual(requestedMechanics('Build a black Vampire Bloodlust deck'),['Bloodlust']);
assert.deepEqual(requestedMechanics('Use the slith ability'),['Bloodlust']);assert.deepEqual(requestedMechanics('Slith-style combat counter growth'),['Bloodlust']);
assert.deepEqual(requestedMechanics('Bloodthirst Vampires'),['Bloodthirst']);assert.deepEqual(requestedMechanics('Bloodlust and Bloodthirst'),['Bloodlust','Bloodthirst']);
for(const text of ['Build around "Blood Lust"','Blood Lust is my required card','Only Slith creatures','not Bloodlust',"I don't want Bloodlust"]){assert.deepEqual(requestedMechanics(text),[],text);}
const lq=mechanicDiscoveryQueries(['Bloodlust']);assert.equal(lq.length,3);assert(lq.some(q=>q.includes('combat damage to a player')));assert(!lq.some(q=>q.includes('keyword:bloodlust')));assert(mechanicDiscoveryQueries(['Bloodthirst']).includes('keyword:bloodthirst'));assert.deepEqual(mechanicDiscoveryQueries(['Blood Lust']),[]);
const bothQueries=mechanicDiscoveryQueries(['Bloodlust','Bloodthirst'],{limit:3});assert.equal(bothQueries.length,3);assert(bothQueries.some(q=>q.includes('keyword:bloodthirst')));assert(bothQueries.some(q=>q.includes('combat damage to a player')));assert(bothQueries.some(q=>q.includes('o:damage')));

// Actual Slith-style payoffs: self growth, two counters, and Drana's attacking
// team recipient retain their distinct text. Their combat connection is conditional.
for(const card of [drana,marauders,noble,slith]){
 const result=bloodlust([row(card),row(basic,59)]),g=result.groups[0];assert.equal(g.mechanismStatus,'supported',card.name);assert.equal(result.status,'partial','one matching library card is not a focused deck');assert.equal(g.payoffs.length,1);assert(g.routes.length);assert(g.routes.every(r=>r.status==='conditional'));assert.equal(result.competitive,'unverified');
}
assert.equal(bloodlust([row(marauders)]).groups[0].payoffs[0].growth[0].amount,2);
assert.equal(bloodlust([row(drana)]).groups[0].payoffs[0].growth[0].recipient,'attacking-team');
assert(bloodlust([row(drana)]).groups[0].payoffs[0].growth[0].requirements.some(t=>t.includes('first-strike damage')));
const rakish=make('Heir','Whenever a Vampire you control deals combat damage to a player, put a +1/+1 counter on it.');assert.equal(bloodlust([row(rakish),row(marauders)]).groups[0].payoffs.find(p=>p.name===rakish.name).growth[0].recipient,'damaging-creature');
const commander=inspectMechanicPlan([row(drana,1,'commander'),row(basic,36),...filler(63)],{abilities:['Bloodlust'],commander:drana.name});assert.equal(commander.groups[0].coverage.library,99);assert.equal(commander.groups[0].coverage.payoffCopies,0);assert.equal(commander.groups[0].coverage.payoffAccess,0);
assert.equal(commander.status,'supported');assert(commander.groups[0].coverage.commandPayoff);assert(commander.groups[0].coverage.commandSupport);
const focused=bloodlust([row(drana,4),row(marauders,4),row(noble,4),row(slith,4),row(basic,24),...filler(20)]);assert.equal(focused.status,'supported');assert(focused.groups[0].coverage.payoffAccess>=.7);
const incidental=[row(slith),row(basic,36),...filler(63)],incidentalPlan=inspectMtgTheme(incidental,{style:'Bloodlust'});assert.equal(incidentalPlan.status,'partial','one incidental Slith in 100 cards cannot promote the complete deck to verified Bloodlust theme');assert.equal(incidentalPlan.mechanics.groups[0].mechanismStatus,'supported');assert.equal(incidentalPlan.mechanics.groups[0].coverage.payoffCopies,1);

// A keyword/type/theme mention, attacking, generic damage, lifelink or life
// loss cannot impersonate the requested player-combat-damage growth event.
for(const text of [
 'Whenever this creature attacks, put a +1/+1 counter on it.',
 'Whenever this creature deals damage to a player, put a +1/+1 counter on it.',
 'Whenever this creature deals combat damage to a creature, put a +1/+1 counter on it.',
 'Whenever an opponent loses life, put a +1/+1 counter on this creature.',
 'Whenever you gain life, put a +1/+1 counter on this creature.',
 'Lifelink',
 'Renown 1 (When this creature deals combat damage to a player, if it is not renowned, put a +1/+1 counter on it and it becomes renowned.)',
 ]){assert.equal(bloodlust([row(make('false growth',text)),row(marauders,1,'side')]).groups[0].payoffs.length,0,text);}
const bareGrowth=make('bare growth','Whenever this creature deals combat damage to a player, put a +1/+1 counter on it.');
const cannotHit={...bareGrowth,oracle_text:"Flying\nThis creature can't deal combat damage.\n"+bareGrowth.oracle_text};assert.equal(bloodlust([row(cannotHit)]).groups[0].mechanismStatus,'partial','a printed prohibition cannot be overcome by an incidental flying keyword');
const unrelatedFlyer=make('unrelated flyer','Flying','Creature — Human');assert.equal(bloodlust([row(bareGrowth),row(unrelatedFlyer)]).status,'partial','a different flying creature does not make the growth creature fly');
for(const text of ["Vampires you control can't gain flying.",'Vampires you control can’t gain flying.',"Vampires you control don't have haste.",'Goblins you control have flying.','Creatures you control with +1/+1 counters on them have flying.'])assert.equal(bloodlust([row(bareGrowth),row(make('invalid grant',text,'Enchantment'))]).status,'partial',text);
for(const text of ['Artifact creatures you control have menace.','Enchantment creatures you control have flying.','Legendary creatures you control have flying.','Creatures you control with flying have haste.']){const mismatched=bloodlust([row(bareGrowth,8),row(make('restricted grant',text,'Enchantment'),8),row(basic,44)]);assert.equal(mismatched.groups[0].mechanismStatus,'partial',text);assert.equal(mismatched.status,'partial',text);}
for(const text of ['This creature has flying as long as you control an artifact.','Artifact creatures you control have haste as long as this creature is untapped.'])assert.equal(bloodlust([row({...bareGrowth,oracle_text:text+'\n'+bareGrowth.oracle_text},8),row(basic,52)]).groups[0].mechanismStatus,'partial','unmapped grant state is not guaranteed: '+text);
assert.equal(bloodlust([row({...bareGrowth,type_line:'Artifact Creature — Vampire'},8),row(make('matching artifact grant','Artifact creatures you control have menace.','Enchantment'),8),row(basic,44)]).status,'supported');
assert.equal(bloodlust([row(bareGrowth),row(make('valid grant','Vampires you control have flying.','Enchantment'))]).groups[0].mechanismStatus,'supported');
const tunneler=make('power-limited','{T}: Target creature with power 2 or less can\'t be blocked this turn.','Creature — Goblin');assert.equal(bloodlust([row({...bareGrowth,power:'3'}),row(tunneler)]).status,'partial');const small=bloodlust([row(bareGrowth),row(tunneler)]);assert.equal(small.groups[0].mechanismStatus,'supported');assert(small.groups[0].routes.some(r=>r.requirements.some(t=>t.includes('after the creature grows'))));
const counterOnly=make('amplifier','Proliferate.','Sorcery');const amplification=bloodlust([row(bareGrowth),row(counterOnly)]);assert.equal(amplification.status,'partial');assert(amplification.groups[0].amplifiers.length);

// Failing-before real-card example: two Bloodthirst Vampires plus pure life loss
// never establish the earlier opponent-DAMAGE prerequisite.
const bad=[row(outcasts),row(bloodrage),row(sign),row(basic,36),...filler(61)],badPlan=bloodthirst(bad);assert.equal(bad.reduce((n,r)=>n+r.qty,0),100);assert.equal(badPlan.status,'partial');assert.equal(badPlan.groups[0].routes.length,0);assert.equal(badPlan.groups[0].lateCombatOptions.length,2,'earlier resolved payoff bodies remain conditional later-turn combat options');
assert.equal(inspectMtgTheme(bad,{style:'Bloodthirst'}).status,'partial','the original two-keyword-card pass cannot certify a mechanic without its prerequisite');
const good=bloodthirst([row(outcasts,4),row(bloodrage,4),row(taste,4),row(basic,24),...filler(24)]);assert.equal(good.status,'supported');assert(good.groups[0].routes.every(r=>r.requirements.some(t=>t.includes('earlier in the same turn'))));assert(good.groups[0].payoffs.some(p=>p.counters[0].kind==='fixed'&&p.counters[0].amount===2));
const x=bloodthirst([row(make('X payoff','Bloodthirst X')),row(taste)]);assert.equal(x.groups[0].payoffs[0].counters[0].kind,'x');assert.equal(x.groups[0].payoffs[0].counters[0].basis,'total-opponent-damage-this-turn');
const selfEntry=make('self entry','Bloodthirst 2\nWhen this creature enters, this creature deals 1 damage to target opponent.');assert.equal(bloodthirst([row(selfEntry)]).status,'partial');
const etb=make('earlier entry','When this creature enters, this creature deals 1 damage to target opponent.');assert.equal(bloodthirst([row(outcasts),row(etb)]).groups[0].mechanismStatus,'supported');
const wrongEntry=make('wrong entry','Whenever a Goblin enters, this enchantment deals 1 damage to target opponent.','Enchantment');assert.equal(bloodthirst([row(outcasts),row(wrongEntry),row({...unrelatedFlyer,power:'0'})]).status,'partial','typed trigger is not satisfied by any arbitrary creature');
const tapper=make('tap damage','{T}: This creature deals 1 damage to target opponent.');const tapped=bloodthirst([row(outcasts),row(tapper)]);assert(tapped.groups[0].routes.some(r=>r.requirements.some(s=>s.includes('haste or control since'))));
const combat=bloodthirst([row(outcasts),row(unrelatedFlyer)]);assert.equal(combat.groups[0].mechanismStatus,'supported');assert(combat.groups[0].routes.some(r=>r.requirements.some(s=>s.includes('blockers'))));
assert.equal(inspectMechanicPlan([row(marauders)],{abilities:['Prowess']}).status,'unverified');assert.equal(inspectMechanicPlan([row(marauders)]).status,'not-requested');
console.log('PASS: informal Bloodlust/Slith combat-growth is distinct from Bloodthirst and Blood Lust; real payoff/recipient semantics, matching combat support, counter bootstrap negatives, earlier opponent-damage timing and honest conditional coverage.');
