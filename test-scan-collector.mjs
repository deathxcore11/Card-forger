// Collector descriptors and partial footers, against the real recognition catalogues.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {collectorQuery,catalogueReleases,narrowPrintings,footerHints,printingFacts} from './scan-collector.js';
import {createScannerLookup} from './scanner-lookup.js';
globalThis.fetch=async()=>{throw Error('No external calls in collector fixtures');};
const manifest=JSON.parse(fs.readFileSync('scanidx/catalog-manifest.json','utf8'));
const load=g=>compileCatalog(JSON.parse(gunzipSync(fs.readFileSync(manifest.games[g].file))));
const mtg=load('mtg'),ptcg=load('ptcg'),ygo=load('ygo');
const parse=(g,pack,t)=>collectorQuery(g,t,{releases:catalogueReleases(pack)});

// Either orientation, any punctuation, glued or spaced, with or without rarity/language.
const want={numbers:[{number:'275',total:''}],sets:['neo']};
for(const t of ['275 NEO','NEO 275','neo275','275neo','#275 · NEO','NEO-275','275 R NEO EN','NEO • EN 275'])
 assert.deepEqual((({numbers,sets})=>({numbers,sets}))(parse('mtg',mtg,t)),want,t);
assert.deepEqual(parse('mtg',mtg,'2x2 12').sets,['2x2'],'set codes with digits');
assert.deepEqual(parse('mtg',mtg,'NEO').numbers,[]);
assert.equal(parse('mtg',mtg,'56 OR anything'),null,'unknown words are reported, not ignored');
assert.equal(collectorQuery('mtg','56 OR anything'),null,'also without a catalogue');

// Mountain: 796 printings. A number, a set or both narrow it; a misread part cannot empty it.
const mountains=mtg.names.get('mountain'),facts=i=>printingFacts('mtg',mtg.rows[i]);
assert(mountains.length>700);
const byNumber=narrowPrintings('mtg',mountains,parse('mtg',mtg,'275'),facts);
assert(byNumber.to>1&&byNumber.to<30&&byNumber.items.every(i=>mtg.rows[i][3].replace(/^0+/,'')==='275'));
const bySet=narrowPrintings('mtg',mountains,parse('mtg',mtg,'NEO'),facts);
assert(bySet.to>1&&bySet.items.every(i=>mtg.rows[i][2]==='neo'));
const one=mountains.find(i=>mtg.rows[i][2]==='blb'),[,, set, number]=mtg.rows[one];
for(const t of [`${number} ${set}`,`${set} ${number}`,`${set}${number}`]){
 const r=narrowPrintings('mtg',mountains,parse('mtg',mtg,t),facts);assert.deepEqual(r.items,[one],t);
}
const misread=narrowPrintings('mtg',mountains,parse('mtg',mtg,'275 blb'),facts);
assert(misread.to>=1&&misread.by,'a set/number pair that matches nothing falls back to one part, and says so');

// Pokémon: fraction, bare number, set id, set name words, and "151" as a set fallback.
const pikachu=ptcg.names.get('pikachu'),pf=i=>printingFacts('ptcg',ptcg.rows[i]);
assert.equal(narrowPrintings('ptcg',pikachu,parse('ptcg',ptcg,'58/102'),pf).to,1);
assert.equal(narrowPrintings('ptcg',pikachu,parse('ptcg',ptcg,'58 base1'),pf).to,1);
assert.equal(narrowPrintings('ptcg',pikachu,parse('ptcg',ptcg,'base1 58'),pf).to,1);
const in151=narrowPrintings('ptcg',pikachu,parse('ptcg',ptcg,'151'),pf);
assert(in151.to>=1&&in151.items.every(i=>ptcg.rows[i][2]==='sv03.5'),'151 the set when no Pikachu is numbered 151');

// Yu-Gi-Oh!: full codes stay exact; prefix and number in either order narrow a named card.
const dm=ygo.names.get('darkmagician'),yf=i=>printingFacts('ygo',ygo.rows[i]);
assert.equal(parse('ygo',ygo,'LOB-EN005').code,'LOB-EN005');
for(const t of ['LOB 005','005 LOB'])assert.deepEqual(narrowPrintings('ygo',dm,parse('ygo',ygo,t),yf).items.map(i=>ygo.rows[i][2].split('-')[0]).filter((v,i,a)=>a.indexOf(v)===i),['LOB'],t);

// Footer hints: a number with no set marker, a set with no number; copyright years ignored.
const rel=catalogueReleases(mtg);
assert.deepEqual(footerHints('mtg','0275 L\n© 2022 Wizards of the Coast',{releases:rel}).numbers.map(n=>n.number),['0275']);
assert.deepEqual(footerHints('mtg','NEO • EN',{releases:rel}).sets,['neo']);
assert.deepEqual(footerHints('ygo','38',{releases:catalogueReleases(ygo)}).numbers,[],'two digits alone are not a Yu-Gi-Oh! code');

// Automatic scan: name read, footer only partly readable → narrowed, never exact.
const scanned=lookupCatalog(mtg,{name:'Mountain',code:`${number} L`});
assert(scanned.narrowed&&scanned.narrowed.to<scanned.narrowed.from,'number-only footer narrows the name');
assert(scanned.cands.length&&scanned.cands.every(c=>!c.exact&&c.card.collector_number===number));
assert.match(scanned.cands[0].why,/of \d+ printings · check printing/);
const setOnly=lookupCatalog(mtg,{name:'Mountain',code:'BLB • EN'});
assert(setOnly.cands.every(c=>c.card.set==='blb'&&!c.exact));
const unreadable=lookupCatalog(mtg,{name:'Mountain',code:'~~ ..'});
assert.equal(unreadable.narrowed,undefined);

// Manual lookup: name + any descriptor, exact titles before "Mountain Goat".
const lookup=createScannerLookup({local:async()=>mtg,candById:async()=>null,sources:{},match:async()=>({cands:[]}),requestMagic:async()=>{throw Error('local only');}});
for(const t of [`${number} ${set.toUpperCase()}`,`${set.toUpperCase()} ${number}`]){
 const found=await lookup('mtg',{name:'Mountain',number:t});
 assert.deepEqual(found.map(c=>c.id),[mtg.rows[one][0]],t);
}
const numberOnly=await lookup('mtg',{name:'Mountain',number:'275'});
assert(numberOnly.length>1&&numberOnly.every(c=>c.card.name==='Mountain'&&c.card.collector_number==='275'));
assert.match(numberOnly[0].why,/275 matches · \d+ of \d+ printings/);
const setLookup=await lookup('mtg',{name:'Mountain',number:'neo'});
assert(setLookup.length&&setLookup.every(c=>c.card.set==='neo'));
await assert.rejects(lookup('mtg',{name:'Mountain',number:'zz9 qq'}),/any order/);
await assert.rejects(lookup('mtg',{number:'neo'}),/card name/);
console.log(`PASS: number/set descriptors in any order; Mountain ${mountains.length} → #275 ${byNumber.to} / NEO ${bySet.to} / set+number 1; Pokémon fraction/number/set/151; Yu-Gi-Oh! prefix+number; partial footers narrow but never verify.`);
