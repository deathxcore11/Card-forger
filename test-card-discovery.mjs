import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {cardDiscoverySpec,discoveryButton,discoverCardMarkup} from './card-discovery.js';
import {keywordHelp,ruleTerms,ruleText,ruleCardContext} from './rule-dex.js';
import {resolveRuleReference} from './rule-reference.js';
import {EXTRA_RULES} from './rule-extra.js';
assert.equal(cardDiscoverySpec('mtg','type','Legendary Creature').q,'t:"legendary" t:"creature"');
assert.equal(cardDiscoverySpec('mtg','type','Time Lord').q,'t:"time lord"');
assert.equal(cardDiscoverySpec('mtg','keyword','Flying').q,'keyword:"flying"');
assert.equal(cardDiscoverySpec('mtg','keyword','sacrifice').q,'o:"sacrifice"');
assert.deepEqual(cardDiscoverySpec('ygo','archetype','Blue-Eyes').filters,{archetype:'Blue-Eyes'});
assert.deepEqual(cardDiscoverySpec('ygo','race','Dragon').filters,{race:'Dragon'});
assert.deepEqual(cardDiscoverySpec('ygo','keyword','Special Summon').filters,{text:'Special Summon'});
assert.deepEqual(cardDiscoverySpec('ptcg','type','Fire').filters,{type:'Fire'});
assert.deepEqual(cardDiscoverySpec('ptcg','stage','Stage2').filters,{stage:'Stage2'});
assert.equal(cardDiscoverySpec('ptcg','ability','Infernal Reign').loadedAbility,'Infernal Reign');
assert.match(cardDiscoverySpec('ptcg','ability','Infernal Reign').label,/Loaded/);
assert.equal(cardDiscoverySpec('mtg','archetype','Dragon'),null);
assert.equal(cardDiscoverySpec('ygo','keyword','<script>'),null);
assert.equal(cardDiscoverySpec('ptcg','ability','a'.repeat(121)),null);
assert.doesNotMatch(discoveryButton('mtg','type','<img onerror=x>'),/<img/);
const magic=discoverCardMarkup('mtg',{card_faces:[{type_line:'Legendary Creature — Time Lord Doctor'},{type_line:'Artifact — Equipment'}],keywords:['Flying']});
assert.match(magic,/data-discovery-value="Legendary Creature"/);assert.match(magic,/data-discovery-value="Time Lord"/);assert.match(magic,/Equipment/);
const pokemon=discoverCardMarkup('ptcg',{category:'Pokemon',types:['Fire'],stage:'Stage2',abilities:[{name:'Infernal Reign'}]});assert.match(pokemon,/Loaded Pokémon with Ability/);
const ygo=discoverCardMarkup('ygo',{cardType:'XYZ Monster',archetype:'Blue-Eyes',race:'Dragon',attribute:'LIGHT'});assert.match(ygo,/XYZ Monster/);assert.match(ygo,/Blue-Eyes/);
for(const game of ['mtg','ygo','ptcg']){
 const pack=JSON.parse(gunzipSync(fs.readFileSync(`rulebooks/${game}-rules-v1.json.gz`)));
 for(const key of Object.keys(EXTRA_RULES[game])){
  const help=keywordHelp(game,key);assert(help?.definition,key);assert(help.reference,key);
  assert(resolveRuleReference(pack,help.reference),game+':'+key+' must open an actual exact source');
 }
}
assert(Object.keys(ruleTerms('mtg')).length>=255);
assert.match(ruleText('mtg','Backup 1, prowess, and cycling {2}.'),/data-rule="backup"/);
assert.match(ruleText('ygo','Perform a Synchro Summon.'),/data-rule="Synchro Summon"/);
assert.match(ruleText('ptcg','Stage 2 Pokémon'),/data-rule="Stage 2"/);
assert.doesNotMatch(ruleText('mtg','"Flying Fox" is a quoted card name.'),/data-act/);
console.log('PASS: typed per-game discovery, combined Legendary Creature, multiword types, exact archetype/race/attribute, honest loaded-only Pokémon abilities and every additional rules source.');
// Exercise the actual app action; no reimplementation of its dispatch logic.
const app=fs.readFileSync('app.js','utf8'),start=app.indexOf('A.ruleCards ='),end=app.indexOf('\n};',start)+3;
function fixture(game){
 const A={},db={term:'old',filters:{color:'r',set:'old'}},U={q:'old',f:{set:'old'},results:[],generation:0},S={ui:{db}},log=[];
 const T={game:()=>game,ui:()=>({search:U}),cache:{ptcg:{a:{name:'One',abilities:[{name:'Infernal Reign',effect:'Attach Energy.'}]},b:{name:'Two',abilities:[{name:'Unrelated',effect:'Draw a card.'}]},brief:{name:'Brief',brief:true,abilities:[{name:'Infernal Reign'}]}}},invalidateTcgSearch:()=>U.generation++};
 A.dbSearch=()=>log.push('magic search');A.tSearch=()=>log.push('TCG search');
 Function('A','T','S','cardDiscoverySpec','dismissRuleHint','closeSheet','toast','dbInvalidate','go','ruleCardContext','sheetSnapshot','routeTrail',app.slice(start,end))(A,T,S,cardDiscoverySpec,()=>log.push('dismiss'),()=>log.push('close'),m=>log.push(m),()=>log.push('invalidate'),async to=>log.push(to),ruleCardContext,()=>null,[]);
 return {A,U,db,log};
}
let f=fixture('mtg');await f.A.ruleCards({dataset:{game:'mtg',discoveryKind:'type',discoveryValue:'Legendary Creature'}});assert.equal(f.db.term,'t:"legendary" t:"creature"');assert.deepEqual(f.db.filters,{});assert(f.log.includes('magic search'));
f=fixture('ygo');await f.A.ruleCards({dataset:{game:'ygo',discoveryKind:'archetype',discoveryValue:'Blue-Eyes'}});assert.deepEqual(f.U.f,{archetype:'Blue-Eyes'});assert(f.log.includes('TCG search'));
f=fixture('ptcg');await f.A.ruleCards({dataset:{game:'ptcg',discoveryKind:'ability',discoveryValue:'Infernal Reign'}});assert.equal(f.U.results.length,1);assert.equal(f.U.results[0].name,'One');assert.equal(f.U.more,false);assert.match(f.U.discoveryNote,/not a complete catalogue/);assert(!f.log.includes('TCG search'),'never send an unsupported Ability-name query as a card-name query');
f=fixture('ptcg');await f.A.ruleCards({dataset:{game:'ygo',discoveryKind:'race',discoveryValue:'Dragon'}});assert.equal(f.U.generation,0);assert(!f.log.includes('close'),'stale cross-game links cannot change the current search');
console.log('PASS: actual card-to-search action resets incompatible filters, removes rule listeners, reuses native search, keeps loaded Pokémon scope explicit and blocks cross-game stale actions.');
