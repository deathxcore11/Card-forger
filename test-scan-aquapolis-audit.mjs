// Full checked-in pilot identity audit. Inputs are printed-text fixtures, not
// photographed pixels: no camera/OCR accuracy, provider availability or prices
// are implied. Every candidate is resolved through the production matcher.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {pokemonPrintedIdentifier,pokemonPrintedName,pokemonIdentityNames} from './pokemon-identity.js';
import {textVerifiedMatch} from './scancam.js';
import {resolvedEntry} from './scan-batch.js';

const readPack=path=>JSON.parse(gunzipSync(readFileSync(new URL(path,import.meta.url))));
const raw=readPack('./scanidx/ptcg-catalog-v1.json.gz');
raw.signals=readPack('./scanidx/ptcg-signals-v1.json.gz');
const pack=compileCatalog(raw),aquapolis=raw.rows.filter(r=>r[2]==='ecard2'),base=raw.rows.filter(r=>r[2]==='base1');
assert.equal(aquapolis.length,186,'all Aquapolis catalogue identities, including subsets');
assert.equal(base.length,102,'all Base Set catalogue identities');
const ambiguous=new Map([
 ['ecard2-H02',['ecard2-H02','ecard3-H02']],
 ['ecard2-H11',['ecard2-H11','ecard3-H11']],
 ['base1-19',['base1-19','hgss4-19']],
]);
const readFor=r=>{const p=pokemonPrintedIdentifier(r[2],r[3],r[4]);return {name:pokemonPrintedName(r[1]),code:p.number+'/'+p.total};};
const lookup=read=>lookupCatalog(pack,read).cands;
const verified=(c,read)=>textVerifiedMatch('ptcg',c,read);
for(const r of [...aquapolis,...base]){
 const read=readFor(r),cands=lookup(read),hit=cands.find(c=>c.id===r[0]);
 assert(hit,`${r[0]} remains a candidate for its complete title and printed number`);
 assert.equal(hit.card.id,r[0]);assert.equal(hit.card.set.id,r[2]);
 if(ambiguous.has(r[0])){
  assert.deepEqual(cands.map(c=>c.id).sort(),ambiguous.get(r[0]).toSorted(),`${r[0]} preserves colliding releases`);
  assert(cands.every(c=>!verified(c,read)),`${r[0]} requires set evidence`);
 }else{
  assert.deepEqual(cands.map(c=>c.id),[r[0]],`${r[0]} resolves without a competing identity`);
  assert(verified(hit,read),`${r[0]} complete literal identifiers verify the printing`);
 }
 // A known set selected by the user may disambiguate; the scanner does not
 // infer a set logo merely because one same-name catalogue row comes first.
 const setRead={...read,setId:r[2]},setCands=lookup(setRead);
 assert.deepEqual(setCands.map(c=>c.id),[r[0]],`${r[0]} exact set, title and number`);
 assert(verified(setCands[0],setRead));
}
assert.equal(aquapolis.filter(r=>/^H/i.test(r[3])).length,32);
assert.equal(aquapolis.filter(r=>/^\d+[ab]$/i.test(r[3])).length,8);
for(const r of aquapolis.filter(r=>/^H/i.test(r[3]))){
 const read={name:r[1],code:r[3]+'/H32',setId:'ecard2'},cands=lookup(read);
 assert.deepEqual(cands.map(c=>c.id),[r[0]]);assert(verified(cands[0],read),`${r[0]} namespace/zero padding survives`);
 const wrong={...read,code:r[3]+'/147'};
 assert(lookup(wrong).every(c=>!verified(c,wrong)),`${r[0]} catalogue set count is not its printed H denominator`);
}
for(const n of ['50','74','95','103']){
 const rows=aquapolis.filter(r=>r[3]===n+'a'||r[3]===n+'b');assert.equal(rows.length,2);
 const partial={name:rows[0][1],code:n+'/147',setId:'ecard2'};
 assert(lookup(partial).every(c=>!verified(c,partial)),`${n} without a/b cannot verify a suffix printing`);
}
for(const id of ['base1-78','base1-4','base1-8','base1-101']){
 const r=base.find(r=>r[0]===id),read=readFor(r),cands=lookup(read);
 const staged=resolvedEntry({id:'pilot-'+id,qty:2,condition:'Lightly Played',lang:'en'},'ptcg',cands,read,c=>verified(c,read));
 assert.equal(staged.printingVerified,true);assert.equal(staged.status,'review');assert.equal(staged.finish,'','title/number do not establish edition or foil');
 assert.equal(staged.qty,2);assert.equal(staged.condition,'Lightly Played');
 assert.equal(cands[0].card.edition,undefined);assert.equal(cands[0].card.prices,undefined,'recognition cannot manufacture a price');
}
assert.equal(lookup({name:'Scoop Up',code:'78/102'})[0].name,'Scoop Up','short Up suffix survives');
for(const id of ['base4-102','ex6-32']){
 const r=raw.rows.find(r=>r[0]===id);assert(r);
 for(const name of pokemonIdentityNames({id,name:r[1]})){
  const read={...readFor(r),name,setId:r[2]},cands=lookup(read);
  assert.deepEqual(cands.map(c=>c.id),[id]);assert(verified(cands[0],read),`${id} printed/canonical spelling ${name}`);
 }
}
console.log('PASS: all186 Aquapolis and102 Base Set identities;32 H cards,8 a/b cards, three honest cross-set collisions, printed aliases, Scoop Up, and unconfirmed edition/finish/price controls. Text/catalogue fixtures only.');
