// Extra Deck staples (Link/Xyz/Synchro/Fusion monsters) are built into the Extra Deck, never the Main Deck.
import assert from 'node:assert/strict';
import {buildYgo} from './tcgbuild.js';
const f={id:'traditional',main:[40,60],extra:15,side:15};
const mon=(id,o={})=>({id,name:id,category:'Monster',level:4,atk:1800,...o});
const seed=mon('Crystal Master',{level:5});
const archetype=Array.from({length:14},(_,i)=>mon('Crystal '+i));
const staples=[mon('S:P Little Knight',{extra:true,frameType:'link'}),mon('Accesscode Talker',{extra:true,frameType:'link'}),
 ...Array.from({length:12},(_,i)=>({id:'Spell '+i,name:'Spell '+i,category:'Spell'}))];
const deck=buildYgo({f,seed,archetype,staples,limit:()=>3,legal:()=>'legal',owned:()=>0,price:()=>1,budget:Infinity});
const main=deck.zones.main.map(r=>r.name),extra=deck.zones.extra.map(r=>r.name);
assert(!main.includes('S:P Little Knight')&&!main.includes('Accesscode Talker'),'no Extra Deck monster in the Main Deck');
assert(extra.includes('S:P Little Knight')&&extra.includes('Accesscode Talker'),'Extra Deck staples go to the Extra Deck');
assert(deck.zones.extra.every(r=>r.qty===1),'one copy each');
console.log('PASS: Extra Deck staples are built into the Extra Deck, never the Main Deck.');
