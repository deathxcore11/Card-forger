// Public individual card text; deliberately independent synthetic arrangements,
// never the user's saved list and never an empirical/target-score fixture.
import assert from 'node:assert/strict';import fs from 'node:fs';
import {centralAuraCoverage} from './mtg-route-coverage.js';
import {commanderStrategicEstimate,combatContribution} from './commander-strategy.js';
import {engineProfile,engineRoles} from './insights.js';import {cardKey} from './core.js';
import {S,blank} from './store.js';import {mtgPower,powerPanel,shownPower} from './power.js';import {cleanStrategic}from'./coach-evidence.js';
const cards=JSON.parse(fs.readFileSync(new URL('./test-fixtures/aura-mechanic-cards.json',import.meta.url))).cards,catalog=Object.fromEntries(cards.map(c=>[cardKey(c.name),c]));
const plains={name:'Plains',type_line:'Basic Land — Plains',oracle_text:'{T}: Add {W}.',mana_cost:'',cmc:0,color_identity:['W'],produced_mana:['W'],legalities:{standard:'legal'}};catalog.plains=plains;
const deck={id:'synthetic-aura-package',format:'Standard',cards:[{name:'Plains',qty:36},...cards.map(c=>({name:c.name,qty:4}))],side:[]};
const evaluate=(d=deck,c=catalog)=>commanderStrategicEstimate(d,c,engineProfile(d,c).criteria,{roles:engineRoles});
const p=evaluate();assert.equal(p.status,'primary-route-unmapped');assert.equal(p.score,null);assert.ok(p.routes.length,'independent printed-body diagnostics are retained');assert.ok(Number.isFinite(p.partialScore));assert.match(p.primaryRouteCoverage.label,/Aura/);assert.equal(p.primaryRouteCoverage.auraCopies,12);assert.equal(p.primaryRouteCoverage.carrierCopies,12);
const rows=deck.cards.map(r=>({...r,c:catalog[cardKey(r.name)]})),armor=catalog[cardKey('Ethereal Armor')],spider=catalog[cardKey('Skyward Spider')];
const disabled={...catalog,[cardKey(armor.name)]:{...armor,oracle_text:'Enchant creature\nEnchanted creature gets +1/+1.'},[cardKey('Optimistic Scavenger')]:{...catalog[cardKey('Optimistic Scavenger')],oracle_text:''}};assert.equal(evaluate(deck,disabled).primaryRouteCoverage,undefined,'ordinary Auras without explicit unmodeled scalable/entry output do not trigger this bounded guard');
const noAura=rows.filter(r=>! /Aura/.test(r.c.type_line));assert.equal(centralAuraCoverage(noAura),null,'unsupported payoff alone is not proof of a central Aura package');
const oneAura=rows.filter(r=>! /Aura/.test(r.c.type_line)||r.c.name===armor.name);assert.equal(centralAuraCoverage(oneAura),null,'one optional Aura name is insufficient');
const irrelevant=rows.map(r=>/Aura/.test(r.c.type_line)?{...r,c:{...r.c,oracle_text:'Enchant creature an opponent controls\nEnchanted creature gets -2/-2.'}}:r);assert.equal(centralAuraCoverage(irrelevant),null,'opponent removal Auras are not own-carrier output');
const protectedRows=rows.map(r=>/Creature/.test(r.c.type_line)?{...r,c:{...r.c,oracle_text:r.c.oracle_text+'\nProtection from white'}}:r);assert.equal(centralAuraCoverage(protectedRows),null,'all protected carriers cannot host these white Auras');
const noOwnPayoff=rows.map(r=>r.c.name===armor.name?{...r,c:{...r.c,oracle_text:'Enchant creature\nEnchanted creature gets +1/+1.'}}:r.c.name==='Optimistic Scavenger'?{...r,c:{...r.c,oracle_text:'Whenever an enchantment you control enters, you gain 1 life.'}}:r);assert.equal(centralAuraCoverage(noOwnPayoff),null,'lifegain is not a scalable own combat output');
const role=cards.find(c=>c.name==='Spellbook Vendor'),strong={...spider,name:'Synthetic standalone threat',oracle_text:'Flying',power:'6',toughness:'6',cmc:3,mana_cost:'{2}{W}'};
const incidental=[{qty:1,c:armor},{qty:1,c:cards.find(c=>c.name==='Feather of Flight')},{qty:20,c:role},{qty:4,c:cards.find(c=>c.name==='Optimistic Scavenger')},{qty:16,c:strong}];assert.equal(centralAuraCoverage(incidental),null,'Role-heavy self-contained creature shell plus two incidental Auras does not manufacture a central Aura plan');
const raw=combatContribution(spider),plain=combatContribution({...spider,oracle_text:'Ward {2}',keywords:['Ward']}),flying=combatContribution({...spider,oracle_text:'Ward {2}\nFlying',keywords:['Ward','Flying']});assert.equal(raw.pressure,plain.pressure,'modified-only flying is not intrinsic evasion');assert.ok(flying.pressure>raw.pressure);assert.ok(raw.requirements.some(x=>/Conditional combat keyword/.test(x)));
S.state=blank();S.catalog=catalog;const publicPower=mtgPower(deck);assert.equal(publicPower.readiness.eligible,true);assert.equal(shownPower(publicPower),null);assert.match(powerPanel(publicPower),/Important Aura/);assert.doesNotMatch(powerPanel(publicPower),/Finish the deck before/);assert.equal(cleanStrategic(publicPower.strategic).primaryRouteCoverage.auraCopies,12);
console.log('PASS: central Aura scaling/entry/attachment coverage is unavailable, not weak; independent diagnostics retained; optional/negative/opponent/protected/provider-only controls; conditional flying and complete/legal UI/coach. No numeric target.');

for(const restriction of ['Flying\nShroud','Protection from enchantments','Protection from red and from white']){
 const incompatible=rows.map(r=>/Creature/.test(r.c.type_line)?{...r,c:{...r.c,oracle_text:r.c.oracle_text+'\n'+restriction}}:r);
 assert.equal(centralAuraCoverage(incompatible),null,'independently verified host restriction: '+restriction);
}
