import assert from 'node:assert/strict';
import {buildDeck} from './builder.js';
import {cardKey} from './core.js';
const card=(name,type_line,extra={})=>({name,type_line,mana_cost:'{U}',cmc:1,color_identity:['U','B'],oracle_text:'',prices:{usd:'.01'},legalities:{standard:'legal',modern:'legal',commander:'legal'},...extra});
const seed=card('Synthetic leader','Legendary Creature — Wizard');
const basics=[card('Island','Basic Land — Island',{produced_mana:['U']}),card('Swamp','Basic Land — Swamp',{produced_mana:['B']})];
const spells=Array.from({length:100},(_,i)=>card('Synthetic spell '+i,'Creature — Wizard'));
function generate(format,reverse=false){
 const duals=Array.from({length:20},(_,i)=>card('Synthetic dual '+String(i).padStart(2,'0'),'Land',{oracle_text:'{T}: Add {U} or {B}.',produced_mana:['U','B'],edhrec_rank:reverse?20-i:i+1}));
 const catalog=Object.fromEntries([seed,...basics,...spells,...duals].map(c=>[cardKey(c.name),c]));
 return buildDeck({format,seeds:[seed],commander:format==='Commander'?seed:null,catalog,budget:20,price:()=>.01,available:()=>0,colors:['U','B']}).cards.filter(r=>r.name.startsWith('Synthetic dual')).map(r=>[r.name,r.qty]).sort();
}
for(const format of ['Standard','Modern'])assert.deepEqual(generate(format),generate(format,true),format+' lands do not use Commander popularity');
assert.notDeepEqual(generate('Commander'),generate('Commander',true),'Commander retains its disclosed popularity tie-break');
console.log('PASS: Standard/Modern identical duals are EDHREC-rank invariant; Commander popularity tie-break remains format-scoped.');
