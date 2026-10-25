import test from 'node:test';
import assert from 'node:assert/strict';
import {deckContentsKey,selectDeckShelf,metaShelfEntries} from './deck-shelf.mjs';
const options={format:'Standard',scope:'standard',asOf:'2026-10-25',rotationKey:'visit-1'};
const deck=(id,overrides={})=>({id,format:'Standard',scope:'standard',kind:'meta',archetype:id,
 publishedAt:'2026-10-24',addedAt:'2026-10-24',listStatus:'loaded',source:{id:'official',url:'https://example.test/events/'+id,version:'snapshot-1'},
 deck:{main:[{name:'Basic land',qty:24},{name:id,qty:36}],side:[],commanders:[]},...overrides});
test('same snapshot and rotation are deterministic across source completion order',()=>{
 const rows=Array.from({length:12},(_,i)=>deck('list-'+i)),before=structuredClone(rows);
 assert.deepEqual(selectDeckShelf(rows,options),selectDeckShelf([...rows].reverse(),options));assert.deepEqual(rows,before);
 assert.equal(selectDeckShelf(rows,options).selections.length,6);assert.equal(selectDeckShelf(rows,options).matchAdmission,'unverified');
});
test('a later visit favors unseen lists without changing the previous snapshot or chosen deck',()=>{
 const rows=Array.from({length:12},(_,i)=>deck('list-'+i)),first=selectDeckShelf(rows,options),saved=structuredClone(first);
 const next=selectDeckShelf(rows,{...options,rotationKey:'visit-2',previousIds:first.selections.map(x=>x.id)});
 assert.equal(next.selections.filter(x=>first.selections.some(y=>x.id===y.id)).length,0);assert.deepEqual(first,saved);
});
test('equal lists across providers occupy one tile while retaining all source and finish variants',()=>{
 const a=deck('first'),b=deck('second',{deck:structuredClone(a.deck),source:{id:'other',url:'https://example.test/other',version:'v2'}});
 b.deck.main.reverse();b.deck.main[0].finish='foil';const before=structuredClone(b);
 const result=selectDeckShelf([b,a],options);assert.equal(result.distinctLists,1);assert.deepEqual(result.selections[0].equivalentIds,['first','second']);assert.deepEqual(b,before);
});
test('different quantities, command zone or sideboard never deduplicate as the same list',()=>{
 const a=deck('a').deck;for(const change of [d=>d.main[0].qty++,d=>d.commanders.push({name:'Commander',qty:1}),d=>d.side.push({name:'Side card',qty:1})]){
  const b=structuredClone(a);change(b);assert.notEqual(deckContentsKey(a,'Standard'),deckContentsKey(b,'Standard'));
 }
});
test('meta freshness uses source date and rejects future data rather than refreshing an old event age',()=>{
 const result=selectDeckShelf([deck('old',{publishedAt:'2026-08-01',addedAt:'2026-10-25'}),deck('future',{publishedAt:'2026-10-26'}),deck('fresh')],{...options,section:'meta'});
 assert.deepEqual(result.selections.map(x=>x.id),['fresh']);assert.deepEqual(result.omitted.map(x=>x.reason),['stale-meta','future-date']);
});
test('new additions require recorded first-seen dates; fetching is not automatically a new addition',()=>{
 const result=selectDeckShelf([deck('unknown',{addedAt:null}),deck('old',{addedAt:'2026-08-01'}),deck('new')],{...options,section:'new'});
 assert.deepEqual(result.selections.map(x=>x.id),['new']);
});
test('competitive Commander never enters the casual Commander shelf implicitly',()=>{
 const rows=[deck('cEDH',{format:'Commander',scope:'cedh'}),deck('casual',{format:'Commander',scope:'commander'})];
 assert.deepEqual(selectDeckShelf(rows,{...options,format:'Commander',scope:'commander'}).selections.map(x=>x.id),['casual']);
 assert.deepEqual(selectDeckShelf(rows,{...options,format:'Commander',scope:'cedh'}).selections.map(x=>x.id),['cEDH']);
});
test('a shelf prefers distinct archetypes when available, without interpreting provider ranks as win rates',()=>{
 const rows=Array.from({length:12},(_,i)=>deck('list-'+i,{archetype:'archetype-'+(i%6)}));
 const result=selectDeckShelf(rows,options);assert.equal(new Set(result.selections.map(x=>rows.find(r=>r.id===x.id).archetype)).size,6);
});
test('bad rows report failures; ambiguous identities and unbounded options fail explicitly',()=>{
 const bad=deck('bad');bad.deck.main[0].qty=0;
 const result=selectDeckShelf([bad,deck('missing',{listStatus:'missing'}),deck('good')],options);assert.equal(result.rejected.length,2);assert.deepEqual(result.selections.map(x=>x.id),['good']);
 assert.throws(()=>selectDeckShelf([deck('dup'),deck('dup')],options),/duplicate-id/);
 assert.equal(selectDeckShelf([null,{},deck('good')],options).rejected.length,2);
 for(const change of [{limit:0},{limit:25},{maxAgeDays:0},{rotationKey:''},{asOf:'2026-02-30'}])assert.throws(()=>selectDeckShelf([],{...options,...change}));
});
test('existing Meta adapter preserves all rows/zones, source snapshot and explicit cEDH scope',()=>{
 const rows=[{key:'event:1',name:'Two commanders',date:'2026-10-24',eventUrl:'https://example.test/event',main:[{name:'Land',qty:98,finish:'etched'}],commanders:[{name:'A',qty:1},{name:'B',qty:1}],side:[]}];
 const input={game:'mtg',format:'EDH',decks:rows},out=metaShelfEntries(input,{sourceId:'edhtop16',snapshotVersion:'exact-snapshot'});
 assert.equal(out[0].scope,'cedh');assert.equal(out[0].addedAt,null);assert.deepEqual(out[0].deck.commanders,rows[0].commanders);assert.equal(out[0].deck.main[0].finish,'etched');
 out[0].deck.main[0].qty=1;assert.equal(rows[0].main[0].qty,98);
});
