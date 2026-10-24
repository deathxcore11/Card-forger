import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {mtgCollector,mtgCollectors} from './scan.js';
import {compileCatalog,lookupCatalog} from './scan-catalog.js';
import {rankScanCandidates,signalEvidence} from './scan-signals.js';
import {textVerifiedMatch} from './scancam.js';
import {resolvedEntry} from './scan-batch.js';

// Relevant text-only excerpts from the hosted Magic live-capture failure (2026-10-17).
// The first footer reads 8086; the wider footer and independent full read say 806.
const liveRead = {
  "name": "TT Ta\nl\\ Lightning Bolt &)",
  "code": "U 08086\nMSC « EN\n\nU 0806 C MARVEL\nMSC + EN",
  "full": "Lightning Bolt\n\nU 0806\n\nMSC + EN"
};
const correctId = '7673784e-db4b-43a1-8d55-1bb9fc1e284f';
const pack = compileCatalog(JSON.parse(gunzipSync(readFileSync('scanidx/mtg-catalog-v1.json.gz'))));
const pair = (set,number) => ({set,number});
const ids = result => result.cands.map(c => c.id).sort();
const observations = read => mtgCollectors(read.code,read.full);
const correct = lookupCatalog(pack,{name:'Lightning Bolt',code:'U 0806\nMSC EN'}).cands[0];
assert.equal(correct.id,correctId);
assert.equal(correct.exact,true);
function assertReview(read,expectedIds) {
  const result = lookupCatalog(pack,read);
  assert.deepEqual(ids(result),[...expectedIds].sort());
  for (const candidate of result.cands) {
    assert.equal(candidate.exact,false,'conflicting identifiers never produce an exact candidate');
    assert.equal(textVerifiedMatch('mtg',candidate,read),false);
    assert.equal(textVerifiedMatch('mtg',{...candidate,exact:true},read),false,'the verification gate independently rejects conflict');
  }
  const batch = resolvedEntry({id:'fixture'},'mtg',result.cands,read,c => textVerifiedMatch('mtg',c,read),{finishConfirmed:true,finish:'nonfoil'});
  assert.equal(batch.status,'review','a saved finish preference must not make the conflicting printing ready');
  assert.equal(batch.printingVerified,false);
  assert.equal(batch.finish,'');
  return result;
}

assert.deepEqual(observations(liveRead),[pair('msc','8086'),pair('msc','806')]);
assert.equal(mtgCollector(liveRead.code,liveRead.full),null);
assertReview(liveRead,[correctId]);
assert.match(assertReview(liveRead,[correctId]).cands[0].why,/Conflicting printed identifiers/);
const [firstFooter,laterFooter] = liveRead.code.split('\n\n');
assertReview({...liveRead,code:laterFooter+'\n\n'+firstFooter},[correctId]);
assertReview({...liveRead,code:liveRead.full,full:liveRead.code},[correctId]);
assertReview({name:'Lightning Bolt',code:'U 0806\nMSC EN\nU 08086\nMSC EN',full:'U 0806\nMSC EN\nU 0806\nMSC EN'},[correctId]);
assert.equal(mtgCollector('U 0806\nMSC EN\nU 0806\nMSC EN\nU 08086\nMSC EN'),null,'a majority is not verification');
// The actual intended printing is beyond the old three-item name-only cap.
assert(pack.names.get('lightningbolt').indexOf(pack.ids.get(correctId)[0])>3);
assert.deepEqual(ids(lookupCatalog(pack,liveRead)),[correctId],'observed identifiers are retrieved before the candidate cap');

const otherId = 'e768c957-3a1f-42f5-853a-96942f645df5'; // Lightning Bolt, M11 #149.
for (const code of ['U 0806\nMSC EN\n149/249 C\nM11 EN','149/249 C\nM11 EN\nU 0806\nMSC EN','149/249 R 2 M11 EN U 0806 MSC EN']) {
  assertReview({name:'Lightning Bolt',code},[correctId,otherId]);
}
// No cross product of different footers: msc/149 and m11/806 were never read.
assert.deepEqual(mtgCollectors('U 0806\nMSC EN\n149/249 C\nM11 EN'),[pair('msc','806'),pair('m11','149')]);
assert.deepEqual(mtgCollectors('U 9999\nUnrelated rules text\nMSC EN\nU 0806\nMSC EN'),[pair('msc','806')]);
assert.deepEqual(mtgCollectors('U 0806','MSC EN'),[],"separate OCR sources cannot complete one another's orphan identifier");
assert.equal(mtgCollector('U 0806','MSC EN'),null);
const orphans={name:'Lightning Bolt',code:'U 0806',full:'MSC EN'};
assert(lookupCatalog(pack,orphans).cands.every(c=>!c.exact));
assert.equal(textVerifiedMatch('mtg',correct,orphans),false,'verification also preserves source boundaries');
assert.deepEqual(mtgCollectors('U 0806\n© MARVEL\nMSC + EN'),[pair('msc','806')],'copyright between footer lines is supported');
assert.deepEqual(mtgCollectors('MSC EN U 0806'),[pair('msc','806')]);

for (const read of [
  {name:'Lightning Bolt',code:'U 08086\nMSC EN'},
  {name:'Lightning Bolt',code:'U 08086\nMSC EN\nU 08087\nMSC EN'},
  {name:'Lightning Bolt',code:'U 08086\nMSC EN',full:'U 08087\nMSC EN'}
]) {
  // Every reading is wrong, but the set marker is legible: the name's MSC printing
  // is offered for review only, flagged as conflicting, never exact or verified.
  assertReview(read,[correctId]);
  assert(lookupCatalog(pack,read).cands.every(c=>c.identifierConflict===true&&c.card.set==='msc'),'only the set that was read, never unrelated same-name printings');
  assert.deepEqual(signalEvidence('mtg',correct.card,read).conflicts,['set / collector number']);
}
for (const read of [
  {name:'Lightning Bolt',code:'U 0806\nMSC EN'},
  {name:'Lightning Bolt',code:'U 0806\nMSC EN\nU 806\nMSC EN',full:'U 0806\nMSC EN'}
]) {
  assert.deepEqual(observations(read),[pair('msc','806')]);
  assert.deepEqual(mtgCollector(read.code,read.full),pair('msc','806'));
  const result=lookupCatalog(pack,read);
  assert.deepEqual(ids(result),[correctId]);
  assert.equal(result.cands[0].exact,true);
  assert.equal(textVerifiedMatch('mtg',result.cands[0],read),true);
  assert.equal(resolvedEntry({id:'fixture'},'mtg',result.cands,read,c=>textVerifiedMatch('mtg',c,read),{finishConfirmed:true,finish:'nonfoil'}).status,'ready');
}
const nameOnly=lookupCatalog(pack,{name:'Lightning Bolt'});
assert(nameOnly.cands.length>0);
assert(nameOnly.cands.every(c=>!c.exact&&!textVerifiedMatch('mtg',c,{name:'Lightning Bolt'})));

// Preserve whole alphanumeric identifiers, including suffixes and list codes.
const variants=compileCatalog({schema:1,game:'mtg',rows:[
  ['numeric','Example Card','abc','123','Example',['nonfoil']],
  ['suffix','Example Card','abc','123a','Example',['nonfoil']],
  ['listed','Example Card','plst','M11-149','The List',['nonfoil']],
  ['star','Example Card','sld','123★','Secret Lair',['nonfoil']],
  ['different-name','Different Card','xyz','123','Other',['nonfoil']]
]});
for (const [code,id,tuple] of [
  ['R 00123a\nABC EN','suffix',pair('abc','123a')],
  ['00123a/0281 R\nABC EN','suffix',pair('abc','123a')],
  ['R M11-149\nPLST EN','listed',pair('plst','m11-149')],
  ['R 0123★\nSLD EN','star',pair('sld','123★')]
]) {
  assert.deepEqual(mtgCollector(code),tuple);
  const read={name:'Example Card',code},result=lookupCatalog(variants,read);
  assert.deepEqual(ids(result),[id]);
  assert.equal(result.cands[0].exact,true);
  assert.equal(textVerifiedMatch('mtg',result.cands[0],read),true);
}
{
  // The code belongs to a different card. The name's own #123 may be offered for
  // review (number read, set contradicted), never the other card and never exact.
  const read={name:'Example Card',code:'R 123\nXYZ EN'},result=lookupCatalog(variants,read);
  assert(!ids(result).includes('different-name'),'a known name cannot be replaced by an unrelated code match');
  assert(result.cands.every(c=>!c.exact&&c.identifierConflict===true&&!textVerifiedMatch('mtg',{...c,exact:true},read)));
}
const alphaConflict={name:'Example Card',code:'R 00123a\nABC EN\nR 123\nABC EN'};
assert.deepEqual(ids(lookupCatalog(variants,alphaConflict)),['numeric','suffix']);
assert(lookupCatalog(variants,alphaConflict).cands.every(c=>!c.exact&&!textVerifiedMatch('mtg',{...c,exact:true},alphaConflict)));

// Independent signals are still hard exclusions, even when one footer matches.
const creature={...correct,card:{...correct.card,power:'3',toughness:'3',mana_cost:'{R}'}};
assert.equal(rankScanCandidates('mtg',[creature],{...liveRead,stats:'2/2'}).length,0);
assert.equal(rankScanCandidates('mtg',[creature],{...liveRead,mana:'{G}'}).length,0);
assert.equal(rankScanCandidates('mtg',[{...correct,exact:true}],liveRead)[0].exact,false);

// Unrelated Pokémon and Yu-Gi-Oh! identification and rejection gates stay intact.
const pokemon={name:'Sandygast',exact:true,card:{id:'swsh8-125',name:'Sandygast',hp:80,stage:'basic',set:{number:'125',total:264}}};
const pokemonRead={name:'BASIC Sandygast HP80',code:'125/264'};
assert.equal(textVerifiedMatch('ptcg',pokemon,pokemonRead),true);
assert.equal(rankScanCandidates('ptcg',[pokemon],{...pokemonRead,name:'BASIC Sandygast HP110'}).length,0);
assert.equal(rankScanCandidates('ptcg',[pokemon],{...pokemonRead,code:'125/203'}).length,0);
assert.equal(textVerifiedMatch('ptcg',{...pokemon,name:'Sandygast ex',card:{...pokemon.card,name:'Sandygast ex'}},pokemonRead),false);
assert.equal(textVerifiedMatch('ptcg',pokemon,{name:'Sandygast HP80'}),false);
const ygo={name:'Blue-Eyes White Dragon',exact:true,print:'LOB-EN001|Ultra Rare',card:{id:'89631139',name:'Blue-Eyes White Dragon',atk:3000,def:2500,level:8}};
const ygoRead={name:'Blue-Eyes White Dragon',code:'LOB-EN001\n89631139',stats:'ATK/3000 DEF/2500'};
assert.equal(textVerifiedMatch('ygo',ygo,ygoRead),true);
assert.equal(rankScanCandidates('ygo',[ygo],{...ygoRead,stats:'ATK/2500 DEF/2100'}).length,0);
assert.equal(rankScanCandidates('ygo',[ygo],{...ygoRead,code:'LOB-EN005\n89631139'}).length,0);
assert.equal(rankScanCandidates('ygo',[ygo],{...ygoRead,code:'LOB-EN001\n46986414'}).length,0);
assert.equal(textVerifiedMatch('ygo',ygo,{name:ygo.name}),false);
console.log('PASS: real Magic OCR conflict retains the actual msc/806 printing for review only; order, ambiguity, source boundaries, exact duplicates, alphanumeric IDs, and independent all-game safety gates.');
