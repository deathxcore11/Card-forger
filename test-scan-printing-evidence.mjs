import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {ptcgNumbers,ptcgNumberMatches,ygoSetCodes,scanCandidateMatches} from './scan.js';
import {scanIdentifierEvidence,rankScanCandidates} from './scan-signals.js';
import {textVerifiedMatch,registerScanner} from './scancam.js';
import {resolvedEntry,saveBatch,loadBatch} from './scan-batch.js';
import {S,blank} from './store.js';
import {registerTcg,cache,SOURCES} from './tcg.js';

// No images or external requests: real checked-in catalogue identities with
// adversarial OCR observations, plus production verification and save handlers.
globalThis.localStorage={values:new Map(),getItem(k){return this.values.get(k)??null;},setItem(k,v){this.values.set(k,v);}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,addEventListener(){}};
const denyFetch=async()=>{throw Error('Unexpected external request in scanner evidence fixture');};
globalThis.fetch=denyFetch;
const packs=Object.fromEntries(['mtg','ptcg','ygo'].map(game=>{
  const raw=JSON.parse(gunzipSync(readFileSync(`scanidx/${game}-catalog-v1.json.gz`)));
  raw.signals=JSON.parse(gunzipSync(readFileSync(`scanidx/${game}-signals-v1.json.gz`)));
  return [game,compileCatalog(raw)];
}));
const hydrated=(game,candidates)=>candidates.map(c=>({...c,localReference:false,card:{...c.card,...(game==='ptcg'?{variants:[{key:'normal'},{key:'reverse-holofoil'}]}:{})}}));
const finish=game=>game==='ptcg'?'normal':game==='ygo'?'unlimited':'nonfoil';
const entryFor=(game,cands,read,id='evidence')=>resolvedEntry({id,qty:1,condition:'Near Mint',lang:'en'},game,cands,read,c=>textVerifiedMatch(game,c,read),{finish:finish(game),finishConfirmed:true});
const actual=(game,read)=>hydrated(game,lookupCatalog(packs[game],read).cands);

for(const [game,read,id] of [
  ['ptcg',{name:'Vikavolt HP150',code:'101/264\n102/999'},'swsh8-101'],
  ['ptcg',{name:'Vikavolt HP150',code:'101/264',full:'102/999'},'swsh8-101'],
  ['ptcg',{name:'Vikavolt HP150',code:'101/264\nI02/999'},'swsh8-101'],
  ['ptcg',{name:'Vikavolt HP150',code:'101/264\n101/264a'},'swsh8-101'],
  ['ygo',{name:'Dark Magician',code:'LOB-EN005\nZZZZ-EN999'},'46986414'],
  ['ygo',{name:'Dark Magician',code:'LOB-EN005\n46986414\n89631139'},'46986414'],
  ['ygo',{name:'Dark Magician',code:'LOB-EN005\n46986414',full:'89631139'},'46986414'],
  ['mtg',{name:'Lightning Bolt',code:'U 0806\nMSC EN\nU 08086\nMSC EN'},'7673784e-db4b-43a1-8d55-1bb9fc1e284f']
]) {
  const cands=actual(game,read);
  assert(cands.some(c=>c.id===id),'retain a supported printing suggestion');
  assert.equal(scanIdentifierEvidence(game,read).identifierConflict,true);
  for(const c of cands){assert.equal(c.exact,false);assert.equal(textVerifiedMatch(game,c,read),false);assert.equal(textVerifiedMatch(game,{...c,exact:true},read),false,'independent verifier rejects a caller-forced exact flag');}
  const entry=entryFor(game,cands,read);
  assert.equal(entry.status,'review');assert.equal(entry.printingVerified,false);assert.equal(entry.finish,'');
}

for(const code of ['SV101/264','101a/264','101/264a','GG101/264']) {
  const read={name:'Vikavolt HP150',code};
  const cands=actual('ptcg',read);
  assert(!cands.some(c=>c.id==='swsh8-101'&&textVerifiedMatch('ptcg',c,read)),'a prefix/suffix is never truncated to the wrong numeric printing');
  assert.notEqual(entryFor('ptcg',cands,read).status,'ready');
  assert.equal(scanCandidateMatches({name:'Vikavolt',set:{number:'101',total:264}},'Vikavolt',ptcgNumbers(code)),false);
}
for(const [name,code,id] of [
  ['Hisuian Voltorb','GG01/GG70','swsh12.5gg-GG01'],
  ['Rotom','SV038/SV122','swsh4.5sv-SV038'],
  ['Charizard','TG03/TG30','swsh11tg-TG03'],
  ['Golduck','50a/147','ecard2-50a']
]) {
  const read={name,code},cands=actual('ptcg',read);
  assert.deepEqual(cands.map(c=>c.id),[id]);assert(textVerifiedMatch('ptcg',cands[0],read));
  assert.equal(entryFor('ptcg',cands,read).status,'ready');
}
assert.equal(ptcgNumberMatches({set:{number:'TG03',total:30}},{num:'TG03',total:'GG30'}),false,'a different gallery denominator is not equivalent');
assert.equal(scanIdentifierEvidence('ptcg',{code:'TG03/TG30\nTG003/030'}).identifierConflict,false,'equivalent zero padding is not a conflict');
assert.equal(scanIdentifierEvidence('ptcg',{code:'101/264\n101/264\n101/264\n102/999'}).identifierConflict,true,'repeated readings never outvote a conflict');
assert.equal(scanIdentifierEvidence('ygo',{code:'LOB-EN005\nLOB-EN005\nLOB-EN005\nLOB-001'}).identifierConflict,true);
assert.deepEqual(ygoSetCodes('LOB-001 LOB-E001 LOB-EN001 DUNE-JP001'),['LOB-001','LOB-E001','LOB-EN001','DUNE-JP001']);
assert.deepEqual(scanIdentifierEvidence('ygo',{code:'LOB-',full:'EN005'}).observations,[],'separate OCR sources cannot manufacture a set code');
for(const code of ['LOB-001','LOB-E001','LOB-EN001']) {
  const read={name:'Blue-Eyes White Dragon',code},cands=actual('ygo',read);
  assert.deepEqual(cands.map(c=>c.print),[code+'|Ultra Rare']);
  assert.equal(entryFor('ygo',cands,read).status,'ready');
}
assert(actual('ygo',{name:'Dark Magician',code:'DTP1-EN002'}).every(c=>!c.exact),'local repeated code with two rarity/release rows is review-only');
const repeated=compileCatalog({schema:1,game:'ygo',rows:[['46986414','Dark Magician','LOB-EN005','Ultra Rare','Release A'],['46986414','Dark Magician','LOB-EN005','Ultra Rare','Release B']]});
assert(lookupCatalog(repeated,{name:'Dark Magician',code:'LOB-EN005'}).cands.every(c=>!c.exact),'same code and rarity across distinct releases is not exact');

S.state=blank();S.state.settings.game='mtg';S.ui.view='scan';S.ui.scan={};
const tcg={A:{},C:{},I:{},commit:async fn=>fn(S.state),render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
registerTcg(tcg);
const A={};registerScanner({A,C:{},render(){},toast(){},game:()=>S.state.settings.game,setOf:(g,c)=>g==='ygo'?c.print:c.card.set?.id||'',numberOf:(g,c)=>c.card.set?.number||'',priceOf:()=>null,addMany:(g,rows)=>tcg.scanAddMany(rows,g)});
const conflictRead={name:'Vikavolt HP150',code:'101/264\n102/999'};
saveBatch([entryFor('ptcg',actual('ptcg',conflictRead),conflictRead,'conflict')]);
await A.scanBatchSave();assert.equal(S.state.tcg?.ptcg?.collection?.length||0,0);assert.equal(loadBatch().length,1,'review entry is not removed by save-ready');
const legacyRead={name:'Blue-Eyes White Dragon',code:'LOB-001'};
saveBatch([entryFor('ygo',actual('ygo',legacyRead),legacyRead,'legacy')]);
await A.scanBatchSave();assert.equal(S.state.tcg.ygo.collection.at(-1).printing,'LOB-001','production save retains the observed regional identity');assert.equal(S.state.settings.game,'mtg');

// The endpoint fixture intentionally returns just the first row, mirroring its
// single-result contract. The production adapter must inspect the card's full rows.
const sets=packs.ygo.codes.get('DTP1-EN002').map(i=>packs.ygo.rows[i]).map(r=>({code:r[2],rarity:r[3],name:r[4]}));
cache.ygo['46986414']={id:'46986414',name:'Dark Magician',game:'ygo',sets,artSchema:1,printPriceSchema:1,fetchedAt:new Date().toISOString()};
const requests=[];
globalThis.fetch=async url=>{requests.push(String(url));assert(String(url).includes('cardsetsinfo.php'));return {ok:true,json:async()=>({id:46986414,set_code:sets[0].code,set_rarity:sets[0].rarity})};};
const read={name:'Dark Magician',code:'DTP1-EN002'},remote=await tcg.scanMatch(read,'eng',false,()=>{},'ygo');
assert.equal(remote.cands.length,2);assert(remote.cands.every(c=>!c.exact&&c.printingAmbiguous));
assert.equal(entryFor('ygo',remote.cands,read).status,'review');
assert.deepEqual(new Set(remote.cands.map(c=>c.print)),new Set(sets.map(p=>p.code+'|'+p.rarity)));
const before=JSON.stringify(S.state);
saveBatch([entryFor('ygo',remote.cands,read,'rarity-tie')]);await A.scanBatchSave();assert.equal(JSON.stringify(S.state),before);

// A requested foreign region never creates an EN request, even when the source
// has no exact regional printing. Missing source coverage remains a suggestion.
const previousByName=SOURCES.ygo.byName;SOURCES.ygo.byName=async()=>cache.ygo['46986414'];
requests.length=0;await tcg.scanMatch({name:'Dark Magician',code:'DTP1-JP002'},'eng',false,()=>{},'ygo');
assert.equal(requests.length,1);assert(requests[0].endsWith('DTP1-JP002'));
SOURCES.ygo.byName=previousByName;globalThis.fetch=denyFetch;
console.log('PASS: all-game conflicting observations remain review-only through production save-ready; real Pokémon prefix/suffix printings, exact YGO regions/passcodes, repeated rarity/release codes, and foreign-region safety.');
