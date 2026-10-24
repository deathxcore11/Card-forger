// Synthetic fixtures exercise actual Power and deterministic1000-trial outputs;
// no reduced trial count, omitted legality check or altered scoring model.
import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {cardKey,inCommandZone} from './core.js';
import {mtgPower} from './power.js';
import {mtgGoldfish} from './goldfish.js';
import {setMtgTags} from './mtg-tags.js';
S.state=blank();S.catalog={};setMtgTags({roles:{}});
const leader={name:'Fixture leader',type_line:'Legendary Creature — Human',oracle_text:'',cmc:3,mana_cost:'{2}{G}',power:'3',toughness:'3',color_identity:['G'],colors:['G'],legalities:{commander:'legal',brawl:'legal'}},forest={name:'Forest',type_line:'Basic Land — Forest',oracle_text:'{T}: Add {G}.',produced_mana:['G'],color_identity:['G'],legalities:{commander:'legal',brawl:'legal'}},body={name:'Fixture attacker',type_line:'Creature — Elf',oracle_text:'A deck can have any number of cards named Fixture attacker.',cmc:2,mana_cost:'{1}{G}',power:'2',toughness:'2',color_identity:['G'],colors:['G'],legalities:{commander:'legal',brawl:'legal'}};
for(const c of [leader,forest,body])S.catalog[cardKey(c.name)]=c;
const originalGoldfish=(deck,size)=>mtgGoldfish(deck.cards.map(r=>({qty:r.qty,c:S.catalog[cardKey(r.name)]})).filter(r=>r.c&&!inCommandZone(deck,r.c.name)),{size,commander:S.catalog[cardKey(deck.commander)]||null});
const base={id:'reuse-test',format:'commander',commander:leader.name,cards:[{name:leader.name,qty:1},{name:forest.name,qty:39},{name:body.name,qty:60}]};
for(const [i,cards]of [base.cards,[base.cards[0],{name:forest.name,qty:20},base.cards[2],{name:'forest',qty:19}]].entries()){
 const deck={...base,id:'reuse-'+i,cards};assert.deepEqual(mtgPower(deck).goldfish,originalGoldfish(deck,100),'Exact legacy results, including interleaved split-row ordering');
}
const missing={...base,id:'reuse-missing',commander:'Missing commander'};assert.deepEqual(mtgPower(missing).goldfish,originalGoldfish(missing,100),'Missing commander retains legacy options rather than inferred plan');
for(const size of [60,100])for(const plan of ['Aggro','Midrange','Control','Ramp']){
 const rows=[{c:forest,qty:Math.floor(size*.4)},{c:body,qty:size-Math.floor(size*.4)-1}];
 assert.deepEqual(mtgGoldfish(rows,{size,plan,commander:leader}),mtgGoldfish(rows,{size,commander:leader}),`Resolved commander makes plan irrelevant, ${size}/${plan}; all1000 seeded trials retained`);
}
console.log('PASS: Commander Power reuses equivalent goldfish results; exact1000-trial outputs and split-row/missing-leader fallbacks preserved.');
