import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commanderTheme,objectThemeEvidence,themeSupport,tribalSupport} from './planner.js';
import {themeQueries,scoreCard,inspectMtgTheme,candidateRampWeight} from './builder.js';
import {synergyTest} from './insights.js';
const tide=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/tidebinder-own-object.json',import.meta.url))).card;
const card=(text,type='Creature — Human Wizard')=>({name:'Independent synthetic control',type_line:type,oracle_text:text,cmc:3,color_identity:['U']});
assert.deepEqual(commanderTheme(tide).roles,[]);
assert.deepEqual(themeQueries(tide),[],'target reference cannot become artifact plan or fallback Merfolk/Wizard plan');
assert.deepEqual(commanderTheme(tide).tribes,[]);
assert.deepEqual(themeSupport(tide,{roles:['Artifacts']}),[]);
assert.equal(objectThemeEvidence(tide,'artifact').status,'unknown','unmodeled target reference is not positive own-engine evidence');
assert.equal(scoreCard(tide,['Artifacts'],[]),scoreCard(tide,[],[]),'same real card utility, no false artifact bonus');
assert.equal(synergyTest(tide),null,'no unsupported positive synergy predicate');
assert(themeQueries(tide,'Merfolk').some(q=>q.includes('t:merfolk')),'explicit request preserved');
assert(tribalSupport(tide,'Merfolk'),'actual type remains participation when explicitly requested');
for(const text of ['Destroy target artifact.','Counter target artifact spell.','Target opponent creates a 1/1 artifact creature token.','Whenever an opponent casts an artifact spell, draw a card.','Artifacts are remembered by the archive.','Exile target artifact an opponent controls and target creature you control, then return those cards to the battlefield under their owners’ control.','Whenever an artifact enters the battlefield under an opponent’s control, create a Soldier token under your control.']){
 const c=card(text);assert(!commanderTheme(c).roles.includes('Artifacts'),text);assert.equal(themeSupport(c,{roles:['Artifacts']}).length,0,text);
}
for(const text of ['Whenever you cast an artifact spell, draw a card.','Artifacts you control have hexproof.','Tap two untapped artifacts you control: Draw a card.','Exile two target artifacts, creatures, and/or lands you control, then return those cards to the battlefield under your control.','{1}{U}: Return target artifact you control to its owner’s hand.\n{3}, {T}: Copy target artifact spell you control.','Return target artifact or enchantment card from your graveyard to your hand.','Look at the top X cards of your library, where X is the greatest mana value among artifacts you control. You may put an artifact card from among them onto the battlefield.','Exile target artifact or creature you control, then return that card to the battlefield under your control.','Create a 1/1 colorless artifact creature token.','Search your library for an artifact card, reveal it, put it into your hand, then shuffle.','Return target artifact card from your graveyard to your hand.','Sacrifice an artifact: Destroy target artifact.','As an additional cost to cast this spell, sacrifice an artifact.','Exile target artifact you control. Return it to the battlefield under its owner\'s control.','Whenever an artifact you control enters, destroy target artifact an opponent controls.']){
 const c=card(text);assert(commanderTheme(c).roles.includes('Artifacts'),text);assert(themeSupport(c,{roles:['Artifacts']}).length,text);
}
assert(themeSupport(card('Destroy target artifact.','Artifact Creature — Golem'),{roles:['Artifacts']}).length,'actual artifact can be both interaction and an own artifact input');
assert.equal(objectThemeEvidence(card('Unknown text.'),'nonexistent').status,'unknown');
const enchantress=card('Whenever you cast an enchantment spell, draw a card.');
assert(objectThemeEvidence(enchantress,'enchantment').evidence.length);
assert(objectThemeEvidence(card('Enchant creature\nEnchanted creature gets +1/+1.','Enchantment — Aura'),'enchantment').evidence.length);
assert.equal(objectThemeEvidence(card('Destroy target enchantment.'),'enchantment').evidence.length,0);
assert.deepEqual(inspectMtgTheme([{name:tide.name,card:tide,qty:1},{name:'Own artifact',card:card('','Artifact'),qty:8}],{commander:tide.name}).groups,[],'final checker does not invent artifact commander plan');
console.log('PASS: exact Tidebinder target text grants no artifact/implicit-tribal plan; positive owned artifact/cost/blink and enchantment evidence, explicit tribe, and generic card utility remain.');

const leads=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/commander-unmapped-conditions.json',import.meta.url))).cards;
for(const lead of leads){
 const filler=card('Put a +1/+1 counter on target creature.');
 const rows=[{name:lead.name,card:lead,qty:1},{name:filler.name,card:filler,qty:35},{name:'Plains',qty:64,card:{name:'Plains',type_line:'Basic Land — Plains',oracle_text:''}}];
 const report=inspectMtgTheme(rows,{commander:lead.name});
 assert.equal(report.status,lead.name.includes('Tails')?'insufficient':'unverified',lead.name+' unsupported strategy is not made positive by density');
 assert.equal(report.issues.length,0,'missing parser coverage is not illegal or impossible');
 if(lead.name.startsWith('Ash'))assert(report.notes.some(n=>n.includes('two or more nonland permanents entered')));
 if(lead.name.includes('Tails'))assert(report.notes.some(n=>n.includes('Vehicle')&&n.includes('flying')));
 assert(!themeQueries(lead).some(q=>/t:(fox|kithkin|scout|warrior|pilot|artificer)/.test(q)),'no own-subtype fallback preference');
}
console.log('PASS: actual Ash Celebration and Tails conditional Vehicle trigger remain unverified; Brigid utility does not invent tribal engine; coverage gaps do not emit hard illegality findings.');

assert(!commanderTheme(card('Haste','Artifact Creature — Monkey')).roles.includes('Artifacts'),'own artifact type is participation, not an inferred artifact engine');
assert(themeQueries(card('Haste','Artifact Creature — Monkey'),'Artifacts').some(q=>q.includes('artifact')),'explicit artifact plan survives');

assert(!commanderTheme(card('When this creature dies, draw a card.')).roles.includes('Graveyard'),'self-death value is not alone a graveyard archetype');
assert(commanderTheme(card('Whenever another creature you control dies, draw a card.')).roles.includes('Graveyard'),'owned death payoff retained');
assert(commanderTheme(card('When this creature dies, return this card from your graveyard to your hand.')).roles.includes('Graveyard'),'explicit self-recursion retained');

const clockwork=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/clockwork-own-object.json',import.meta.url))).card;
assert(!commanderTheme(clockwork).roles.some(r=>['Artifacts','Graveyard'].includes(r)));
assert.deepEqual(themeQueries(clockwork),[],'self-contained artifact/death value is not an implicit Monkey/Toy/artifact/graveyard plan');
assert(themeSupport(clockwork,{roles:['Artifacts']}).length,'real printed artifact remains a valid input for explicitly selected artifact plans');
assert(themeSupport(clockwork,{roles:['Graveyard']}).length,'self-death utility can still participate when requested');
console.log('PASS: real Clockwork keeps artifact/death participation without inventing either as the deck archetype.');

const utility=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/utility-own-object.json',import.meta.url))).cards;
for(const c of utility){
 assert(themeSupport(c,{roles:['Artifacts']}).length,c.name+' is an actual artifact input');
 assert(!commanderTheme(c).roles.includes('Artifacts'),c.name+' has no own-artifact payoff simply from its type');
 if(c.name==='Rock Soldiers')assert.equal(themeSupport({...c,type_line:'Creature — Soldier'},{roles:['Artifacts']}).length,0,'hostile artifact target alone gets no support credit');
 if(c.name==='Campus Guide')assert.equal(candidateRampWeight(c),0,'top-of-library land search is not mana acceleration');
}
