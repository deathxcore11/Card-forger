// Synthetic arrangements exercising printed mana clauses, not observed builds.
// They do not claim that conditional sources are unusable in a real game.
import assert from 'node:assert/strict';
import {mtgManaSourceProfile as source} from './mtg-mana-sources.js';
import {spendMana, mtgGoldfish} from './goldfish.js';
import {engineProfile} from './insights.js';
import {inspectDeckPlan} from './deck-construction.js';
import {mtgConstructedPower} from './deckpower.js';
import {cardKey} from './core.js';

const land = (name, oracle_text, extra={}) => ({name,type_line:'Land',oracle_text,mana_cost:'',cmc:0,produced_mana:[...'WUBRGC'],...extra});
const bluffs = land('Painted Bluffs','{T}: Add {C}.\n{1}, {T}: Add one mana of any color.',{type_line:'Land — Desert'});
const pylons = land('Conduit Pylons','When this land enters, surveil 1.\n{T}: Add {C}.\n{1}, {T}: Add one mana of any color.',{type_line:'Land — Desert'});
const encampment = land("Survivors' Encampment",'{T}: Add {C}.\n{T}, Tap an untapped creature you control: Add one mana of any color.',{type_line:'Land — Desert'});
const courtyard = land('Secluded Courtyard','As this land enters, choose a creature type.\n{T}: Add {C}.\n{T}: Add one mana of any color. Spend this mana only to cast a creature spell of the chosen type or activate an ability of a creature source of the chosen type.');
const basic = (name,color) => land(name,`{T}: Add {${color}}.`,{type_line:`Basic Land — ${name}`,produced_mana:[color],color_identity:[color]});
const forest=basic('Forest','G'), mountain=basic('Mountain','R'), plains=basic('Plains','W');
const dual=land('Dual fixture','This land enters tapped.\n{T}: Add {R} or {W}.',{produced_mana:['R','W']});
for(const card of [bluffs,pylons,encampment,courtyard]){
  assert.deepEqual(source(card).colors,['C'],`${card.name} is not unconditional colored fixing`);
  assert.equal(source(card).conditional.length,1);
  assert.ok(source(card).conditional[0].evidence.includes('Add one mana of any color'));
}
assert.match(source(bluffs).conditional[0].reason,/input mana/);
assert.match(source(encampment).conditional[0].reason,/additional cost/);
assert.match(source(courtyard).conditional[0].reason,/restricted/);
assert.deepEqual(source(dual).colors,['R','W'],'entry-tapped timing does not erase color availability');
assert.deepEqual(source(land('Painland fixture','{T}: Add {C}.\n{T}: Add {G} or {W}. This land deals 1 damage to you.')).colors,['C','G','W'],'a life drawback does not erase an available mana mode');
assert.deepEqual(source(land('Checkland fixture','This land enters tapped unless you control a Plains or an Island.\n{T}: Add {W} or {U}.')).colors,['W','U']);
assert.deepEqual(source(land('Typed dual fixture','',{type_line:'Land — Plains Island',produced_mana:[]})).colors,['W','U']);
assert.deepEqual(source({...plains,oracle_text:undefined,produced_mana:[]}).colors,['W'],'intrinsic basic types survive partial cached data');
assert.deepEqual(source({...forest,name:'Snow-Covered Forest',type_line:'Basic Snow Land — Forest',oracle_text:undefined}).colors,['G']);
assert.deepEqual(source(land('Unknown nonbasic fixture','',{produced_mana:['W']})).colors,[],'possible production metadata alone does not prove an unconditional ability');
assert.equal(source(land('Unknown nonbasic fixture','')).unknown,true);
assert.ok(source(bluffs).conditional[0].colors.includes('W'),'the useful conditional route is retained, not classified unusable');
assert.deepEqual(source(land('No mana fixture','When this land enters, draw a card.')).colors,[]);
assert.deepEqual(source(land('Opponent-dependent fixture','{T}: Add one mana of any color that a land an opponent controls could produce.')).colors,[]);

const cataracts=land('Cascading Cataracts','{T}: Add {C}.\n{5}, {T}: Add five mana in any combination of colors.');
assert.deepEqual(source(cataracts).colors,['C']);
assert.deepEqual(source(cataracts).conditional[0].colors,[...'WUBRG']);
const tower=land('Command Tower',"{T}: Add one mana of any color in your commander's color identity.");
assert.deepEqual(source(tower).colors,[],'unknown commander identity is not five-color fixing');
assert.deepEqual(source(tower,{commanderIdentity:['R','G','W']}).colors,['W','R','G']);
assert.deepEqual(source(tower,{commanderIdentity:[]}).colors,[],'a colorless commander gives no colored output');

const pool = cards => cards.map(c=>source(c).colors).filter(c=>c.length);
assert.equal(spendMana(pool([forest,mountain,bluffs]),['R','G','W'],3),null,'three lands cannot pay RGW by double-using the filter input');
assert.deepEqual(spendMana(pool([forest,mountain,plains]),['R','G','W'],3),[]);
assert.deepEqual(spendMana(pool([forest,mountain,dual]),['R','G','W'],3),[]);
assert.deepEqual(spendMana(pool([bluffs]),[],1),[],'the free colorless mode still pays generic mana');

const cards=[forest,mountain,bluffs,pylons,encampment,courtyard], catalog=Object.fromEntries(cards.map(c=>[cardKey(c.name),c]));
const profile=engineProfile({format:'Standard',cards:cards.map(c=>({name:c.name,qty:1}))},catalog);
assert.deepEqual(profile.sources,{W:0,U:0,B:0,R:1,G:1});
assert.match(profile.mana.notes.join(' '),/Painted Bluffs:.*input mana/);
assert.match(profile.mana.notes.join(' '),/Secluded Courtyard:.*restricted/);

const commander={name:'Hazezon casting fixture',type_line:'Legendary Creature — Human Warrior',oracle_text:'',mana_cost:'{R}{G}{W}',cmc:3,power:'3',toughness:'3'};
const castCheck={...commander,colors:['R','G','W'],color_identity:['R','G','W']};
const inspect=lands=>inspectDeckPlan({game:'mtg'},[castCheck,...lands].map(card=>({name:card.name,card,qty:1,zone:'main'})),{commander:castCheck.name});
assert.equal(inspect([forest,mountain,bluffs]).manaCoverage.status,'unverified');
assert.equal(inspect([forest,mountain,plains]).manaCoverage.status,'supported');
assert.equal(inspect([forest,mountain,cataracts]).manaCoverage.status,'unverified');
assert(!inspect([forest,mountain,cataracts]).issues.some(i=>/No confirmed land source/.test(i)),'a valid conditional filter is not declared impossible');
const filler={name:'Uncastable fixture',type_line:'Sorcery',oracle_text:'',mana_cost:'{20}',cmc:20};
const goldfish = last => mtgGoldfish([{qty:1,c:forest},{qty:1,c:mountain},{qty:1,c:last},{qty:20,c:filler}],{size:100,commander,runs:200,seed:19});
const failed=goldfish(bluffs), passed=goldfish(plains);
assert.equal(failed.metrics.find(m=>m.label==='Commander cast by turn 4').value,0);
assert.ok(passed.metrics.find(m=>m.label==='Commander cast by turn 4').value>0);
assert.ok(failed.manaSources.excluded.some(c=>c.name===bluffs.name));
assert.equal(failed.manaSources.status,'partial');
assert.match(failed.headline,/full commander timing is not evaluated/);
assert.match(failed.limitations.join(' '),/conditional outputs may be underestimated/);
console.log('PASS: restricted mana is not free fixing; basic/dual controls, payment and goldfish regressions pass (conditional routes remain unmodeled).');

const ritual={name:'Ritual fixture',type_line:'Instant',oracle_text:'Add {R}{R}{R}{R}{R}.',mana_cost:'{2}{R}',cmc:3,produced_mana:['R']};
const dork={name:'Dork fixture',type_line:'Creature — Elf Druid',oracle_text:'{T}: Add {G}.',mana_cost:'{G}',cmc:1,power:'1',toughness:'1',produced_mana:['G']};
const score=(land,spell)=>mtgConstructedPower({format:'Standard',cards:[{name:land.name,qty:24},{name:spell.name,qty:4}]},Object.fromEntries([land,spell].map(c=>[cardKey(c.name),c])),cardKey);
assert.equal(score(mountain,ritual).manaSources.colors.R,24,'ritual requiring red does not raise 24 red sources to 26');
assert.equal(score(forest,dork).manaSources.colors.G,26,'developed free-tap dorks retain existing half-weight');
assert.equal(score(bluffs,ritual).manaSources.colors.R,undefined,'paid filters do not masquerade as independent colored lands');
assert.equal(score(bluffs,ritual).manaSources.status,'partial');
console.log('PASS: constructed source metric excludes rituals and paid filters, preserves developed tap-source credit and conditional uncertainty.');
