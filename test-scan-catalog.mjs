import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
const manifest=JSON.parse(readFileSync('scanidx/catalog-manifest.json'));
for(const [g,entry] of Object.entries(manifest.games)){
 const zipped=readFileSync(entry.file),raw=gunzipSync(zipped);
 assert.equal(zipped.length,entry.bytes);assert.equal(raw.length,entry.unpackedBytes);assert.equal(createHash('sha256').update(raw).digest('hex'),entry.sha256);
 const t=performance.now(),pack=compileCatalog(JSON.parse(raw));assert.equal(pack.rows.length,entry.count);
 const read=g==='mtg'?{name:'Lightning Bolt',code:'U 0806\nMSC EN'}:g==='ptcg'?{name:'Kyogre',code:'003/025'}:{name:'Dark Magician',code:'LOB-EN005'};
 const hit=lookupCatalog(pack,read);assert(hit.cands.length);assert(hit.cands[0].exact);assert.equal(hit.cands[0].name,read.name);assert(hit.cands[0].localReference);
 if(g==='ptcg')assert.equal(hit.cands[0].id,'cel25-3');
 const nameOnly=lookupCatalog(pack,{name:read.name});assert(nameOnly.cands.length);assert(nameOnly.cands.every(c=>!c.exact));
 assert.equal(lookupCatalog(pack,{name:'Not A Real Card Name zzzz'}).cands.length,0);
 const start=performance.now();for(let i=0;i<1000;i++)lookupCatalog(pack,read);
 console.log(`${g}: ${entry.count} records, integrity/identity/provisional name match passed; compile ${(start-t).toFixed(0)}ms; cached lookup ${((performance.now()-start)/1000).toFixed(3)}ms average (Node, excludes OCR).`);
}
const ambiguous=compileCatalog({schema:1,game:'ptcg',rows:[['a','Kyogre','a','3',25,'A',''],['b','Kyogre','b','3',25,'B',''],['c','Kyogre ex','c','3',25,'C','']]});
assert(lookupCatalog(ambiguous,{name:'Kyogre',code:'003/025'}).cands.every(c=>!c.exact));
assert.equal(lookupCatalog(ambiguous,{name:'Kyogre ex',code:'003/025'}).cands[0].id,'c');
assert.equal(lookupCatalog(ambiguous,{name:'Pikachu',code:'003/025'}).cands.length,0);
console.log('PASS: repeated Pokémon numbers stay ambiguous; ex suffix stays separate; code/name conflict cannot invent a match.');
