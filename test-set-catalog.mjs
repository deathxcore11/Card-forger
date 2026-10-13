import assert from 'node:assert/strict';
import {ptcgSource} from './ptcg.js';
import {pokemonFallback} from './artwork.js';
import {setRowContent} from './set-list-ui.js';
assert.equal(pokemonFallback({id:'swsh12.5gg-GG01'}),'https://images.pokemontcg.io/swsh12pt5gg/GG01_hires.png');
assert.equal(pokemonFallback({id:'swsh12.5gg-GG70'}),'https://images.pokemontcg.io/swsh12pt5gg/GG70_hires.png');
assert.equal(pokemonFallback({id:'bog-1'}),'https://images.pokemontcg.io/bp/1_hires.png');
assert.equal(pokemonFallback({id:'bog-../../bad'}),'');
const original=globalThis.fetch;
globalThis.fetch=async url=>{
 const path=new URL(url).pathname.replace('/v2/en','');
 if(path==='/sets')return Response.json([{id:'bog',name:'Best of Game',cardCount:{total:9}},{id:'orphan',name:'Orphan set',cardCount:{total:2}},{id:'A1',name:'Pocket',cardCount:{total:10}}]);
 if(path==='/series')return Response.json([{id:'old'},{id:'failed'},{id:'tcgp'}]);
 if(path==='/series/old')return Response.json({name:'E-Card',sets:[{id:'bog',name:'Best of Game',cardCount:{total:9}}]});
 if(path==='/series/failed')throw Error('Temporary enrichment outage');
 if(path==='/sets/bog')return Response.json({id:'bog',name:'Best of Game',cards:[{id:'bog-1',localId:'1',name:'Electabuzz'}]});
 throw Error('Unexpected request '+path);
};
try{
 const sets=await ptcgSource.sets();assert.deepEqual(new Set(sets.map(s=>s.id)),new Set(['bog','orphan']));
 const bog=sets.find(s=>s.id==='bog');assert.equal(bog.image,'https://images.pokemontcg.io/bp/logo.png');assert.equal(bog.date,'2002-12-01');
 const cards=await ptcgSource.setCards(bog);assert.equal(cards[0].image,'https://images.pokemontcg.io/bp/1_hires.png');assert.equal(cards[0].set.number,'1');
 globalThis.fetch=async url=>new URL(url).pathname.endsWith('/sets')?Response.json([{id:'orphan',name:'Orphan set',cardCount:{total:2}}]):Promise.reject(Error('All enrichment unavailable'));
 assert.equal((await ptcgSource.sets()).length,1,'complete catalogue survives total series outage');
}finally{globalThis.fetch=original;}
const row=setRowContent({name:'<Bad>',code:'GG',count:70,owned:3});assert.ok(row.includes('&lt;Bad&gt;'));assert.ok(row.includes('set-media no-art'));assert.ok(row.includes('3 owned'));assert.ok(row.includes('cards'));
console.log('PASS: complete set catalogue survives partial and total enrichment outages; exact gallery and Best of Game art; preserved card identity; shared escaped set-row structure.');
