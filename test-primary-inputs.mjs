import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cardKey} from './core.js';
import {buildDeck,themeQueries,inspectMtgTheme} from './builder.js';
import {primaryInputRequirements,inspectPrimaryInputs,nonlandEntryProvider} from './mtg-primary-inputs.js';
const real=JSON.parse(fs.readFileSync(new URL('./tests/fixtures/primary-input-cards.json',import.meta.url))).cards;
const get=n=>real.find(c=>c.name===n),tails=get('Miles "Tails" Prower'),chishiro=get('Chishiro, the Shattered Blade'),ash=get('Ash, Party Crasher');
const card=(name,type_line,oracle_text='',extra={})=>({name,type_line,oracle_text,cmc:2,mana_cost:'{2}',color_identity:[],legalities:{commander:'legal',standard:'legal'},prices:{usd:'.1'},...extra});
const row=(c,qty=1)=>({name:c.name,card:c,qty,zone:'main'});
const flying=card('Independent flying Vehicle','Artifact — Vehicle','Flying\nCrew 2'),ground=card('Independent ground Vehicle','Artifact — Vehicle','Crew 1');
assert.equal(inspectPrimaryInputs([row(tails),row(card('Counter distractor','Creature','Put a flying counter on target creature.'),50)],{commander:tails.name}).status,'missing');
assert.equal(inspectPrimaryInputs([row(tails),row(ground)],{commander:tails.name}).status,'unverified','nonflying entry supplies counter branch, not immediate draw');
assert.equal(inspectPrimaryInputs([row(tails),row(flying)],{commander:tails.name}).groups[0].flyingDrawInputs.length,1);
assert(themeQueries(tails).some(q=>q.includes('t:vehicle')));
const role=card('Independent Role maker','Sorcery','Create a Sorcerer Role token attached to target creature you control.');
const ch=primaryInputRequirements(chishiro)[0];assert(ch.match(role));assert(ch.match(card('Aura','Enchantment — Aura','Enchant creature')));assert(ch.match(card('Equipment','Artifact — Equipment','Equip {1}')));assert.equal(ch.match(card('Opponent Role','Instant','Target opponent creates a Sorcerer Role token attached to target creature they control.')),null);
assert.equal(ch.match(card('Only counters','Instant','Put a +1/+1 counter on target creature.')),null);
for(const n of ['Redcap Gutter-Dweller','Love Song of Night and Day','Grand Entryway // Elegant Rotunda'])assert(nonlandEntryProvider(get(n))?.minimumEvents>=2,n+' is a real conditional multiple-entry provider');
assert.equal(nonlandEntryProvider(card('Opposing tokens','Sorcery','Target opponent creates two 1/1 Soldier creature tokens.')),null);
assert.equal(nonlandEntryProvider(card('Land tokens','Sorcery','Create two Forest land tokens.')),null);
assert.equal(nonlandEntryProvider(card('Delayed saga','Enchantment — Saga','II — Create a 1/1 Bird creature token.')),null,'later chapter without Read ahead is not two entries from this cast');
const pair=inspectPrimaryInputs([row(ash),row(card('One','Creature')),row(card('Two','Artifact'))],{commander:ash.name});assert(pair.groups[0].castingPairs.some(p=>p.castingMana===4));assert.equal(pair.status,'conditional');assert(pair.notes.join(' ').includes('Before declaring'));
assert.equal(inspectPrimaryInputs([row(ash),{name:'Unknown',qty:2,card:{name:'Unknown'}}],{commander:ash.name}).status,'unverified');
const basics=['Plains','Island'].map((n,i)=>card(n,'Basic Land — '+n,'',{cmc:0,mana_cost:'',produced_mana:[i?'U':'W']}));
const filler=Array.from({length:100},(_,i)=>card('Independent filler '+i,'Creature','Draw a card.'));
const vehicles=Array.from({length:8},(_,i)=>({...flying,name:'Independent Vehicle '+i}));
const seed={...tails,prices:{usd:'.1'}};
const catalog=Object.fromEntries([seed,...basics,...filler,...vehicles].map(c=>[cardKey(c.name),c]));
const built=buildDeck({format:'Commander',commander:seed,seeds:[seed],catalog,budget:20,price:()=>.1,available:()=>0,completionFirst:true});
assert.equal(built.total,100);assert(built.cards.filter(r=>r.name.startsWith('Independent Vehicle')).length>=6,'primary inputs reserved even in cheap completion path');
const checked=inspectMtgTheme(built.cards.map(r=>({...r,card:catalog[cardKey(r.name)]})),{commander:tails.name});assert.equal(checked.primaryInputs.status,'conditional');assert.notEqual(checked.status,'supported','input presence is not full trigger execution');
console.log('PASS: owned Vehicle and Aura/Equipment entry inputs discovered/reserved; conditional Role and Celebration providers/pairs grounded; missing and unknown inputs never become generic-keyword success.');

assert.equal(inspectMtgTheme([row(ash),row(basics[0],59)],{seed:ash.name}).primaryInputs.status,'missing','Standard seed primary requirement checked on final list');
for(const completionFirst of [false,true]){
 const low=buildDeck({format:'Commander',commander:seed,seeds:[seed],catalog,budget:6.5,price:c=>c.name===seed.name ? .1 :c.name.startsWith('Independent Vehicle')?1:.01,available:()=>0,completionFirst});
 assert.equal(low.total,100,'Heuristic input reservation preserves feasible completion under tight cap');assert(low.priceVerified);assert(low.cost<=6.5);
}

for(const oracle_text of ['{T}: Target creature gains flying until end of turn.\nCrew 2','If you control three artifacts, this card has flying.\nCrew 2'])assert.equal(inspectPrimaryInputs([row(tails),row({...ground,oracle_text})],{commander:tails.name}).groups[0].flyingDrawInputs.length,0);
assert.equal(ch.match(card('Opponent optional Role','Instant','Whenever an opponent draws a card, that opponent may create a Sorcerer Role token attached to target creature they control.')),null);
for(const oracle_text of ['Create X 1/1 white Warrior creature tokens.','Create a Treasure token, then create two 1/1 white Soldier creature tokens.'])assert.equal(inspectPrimaryInputs([row(ash),row(card('Unmodeled token route','Instant',oracle_text))],{commander:ash.name}).status,'unverified');

assert.equal(inspectPrimaryInputs([row(ash),row(card('Unknown casting cost','Creature','',{mana_cost:'unknown',cmc:null}),2)],{commander:ash.name}).status,'unverified');

const castCommander=inspectPrimaryInputs([row(ash),row(card('One entry ally','Creature','',{mana_cost:'{W}'})),row(basics[0],98)],{commander:ash.name});assert.equal(castCommander.status,'conditional');assert.equal(castCommander.groups[0].castingPairs[0].availability,'command-zone plus library');
