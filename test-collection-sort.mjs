import assert from 'node:assert/strict';
import {collectionSortControls,collectionSortOptions,compareCollectionRows} from './collection-sort.js';
const rows=[{id:'missing',name:'Unknown'},{id:'ten',name:'Card10',value:10,date:'2024-01-01',set:'Modern',number:'10',rarity:'Rare',recent:4},{id:'two',name:'Card2',value:2,date:'1999-01-01',set:'Base',number:'2',rarity:'Common',recent:2},{id:'zero',name:'Free',value:0,date:'2024-01-01',set:'Modern',number:'9',rarity:'Rare',recent:3}];
const sorted=(mode,dir)=>[...rows].sort((a,b)=>compareCollectionRows(a,b,mode,dir)).map(x=>x.id);
assert.deepEqual(sorted('value','asc'),['zero','two','ten','missing']);
assert.deepEqual(sorted('value','desc'),['ten','two','zero','missing']);
assert.deepEqual(sorted('set-order','desc'),['zero','ten','two','missing']);
assert.deepEqual(sorted('set-order','asc'),['two','zero','ten','missing']);
assert.deepEqual(sorted('name','asc'),['two','ten','zero','missing']);
assert.deepEqual(sorted('recent','desc'),['ten','zero','two','missing']);
assert.equal(compareCollectionRows({id:'b',name:'Same'},{id:'a',name:'Same'},'name')>0,true);
for(const game of ['mtg','ptcg','ygo']){
 const html=collectionSortControls(game,'value');
 for(const option of ['name','set','rarity','set-order','value','impact'])assert(collectionSortOptions(game).some(([key])=>key===option));
 assert(html.includes('aria-label="Sort collection"'));assert(html.includes('aria-label="Collection sort direction"'));assert(html.includes('value="desc" selected'));
}
const {readFileSync}=await import('node:fs');
for(const file of ['views.js','tcg.js']){const s=readFileSync(file,'utf8');assert(s.includes('collection-primary-tools'));assert(s.indexOf('collectionSortControls(')<s.indexOf('data-input="'+(file==='views.js'?'collSearch':'tCollQ')+'"',s.indexOf('collection-primary-tools')));}
console.log('PASS: collection sort parity, known zero/unknown values, natural names, release order, number ties and direction.');
// Preserve existing impact tie-break by collection value; missing metrics stay last.
assert(compareCollectionRows({id:'a',impact:5,value:20},{id:'b',impact:5,value:10},'impact','desc')<0);
assert(compareCollectionRows({id:'a',value:NaN},{id:'b',value:0},'value','asc')>0);
assert(compareCollectionRows({id:'a',date:'unknown'},{id:'b',date:'2020-01-01'},'set-order','asc')>0);
assert(compareCollectionRows({id:'a',recent:Date.parse('2025-01-03')},{id:'b',recent:Date.parse('2025-01-01')},'recent')<0);
