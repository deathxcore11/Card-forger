import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {S,blank} from './store.js';
import {registerTcg,cache,ui,entryPrice} from './tcg.js';
import {normalizeYgoSets} from './ygo.js';
import {uniquePrintings} from './scan-batch.js';
import {registerScanner} from './scancam.js';

globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.document={querySelector:()=>null,getElementById:()=>null,addEventListener(){}};
const denyFetch=async()=>{throw Error('Release fixture attempted external request');};globalThis.fetch=denyFetch;
S.state=blank();S.state.settings.game='mtg';S.ui.scan={};S.ui.view='scan';
const context={A:{},C:{},I:{},commit:async fn=>fn(S.state),render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
registerTcg(context);
const pokemon={id:'condition-fixture-101',game:'ptcg',variants:[{key:'normal',usd:12},{key:'reverse-holofoil',usd:20}],conditionQuotes:[{cardId:'condition-fixture-101',variant:'normal',condition:'Lightly Played',language:'en',currency:'USD',price:8,priceStatus:'current'}]};
assert.equal(context.scanPrice({card:pokemon},'normal',{condition:'Lightly Played',language:'en'}),8,'Pokémon uses the same exact cached condition resolver');
assert.equal(context.scanPrice({card:pokemon},'reverse-holofoil',{condition:'Lightly Played'}),null,'played condition price cannot cross finishes or borrow NM');
const rows=JSON.parse(gunzipSync(readFileSync('scanidx/ygo-catalog-v1.json.gz'))).rows.filter(r=>r[2]==='DTP1-EN002');
assert.equal(rows.length,2);
// Real names/codes/rarities, synthetic prices. Missing dates remain missing.
const releases=normalizeYgoSets(rows.map(r=>({code:'DTP1',name:r[4]})));
const dtp={id:'46986414',name:'Dark Magician',game:'ygo',artSchema:1,printPriceSchema:1,fetchedAt:new Date().toISOString(),sets:rows.map((r,i)=>({code:r[2],rarity:r[3],name:r[4],quotes:[{edition:'Unlimited',marketPrice:11+i*11}]}))};
ui('ygo').sets.list=releases;cache.ygo[dtp.id]=dtp;
const item=(candidate,id)=>({captureId:id,qty:1,finish:'unlimited',variantKey:'unlimited',print:candidate.print,cand:candidate,...Object.fromEntries(['releaseName','setReleaseId','setReleaseUnverified','printingAmbiguous'].map(k=>[k,candidate[k]]))});
for(const [i,row] of rows.entries()){
  const candidate=await context.scanCandById('ygo',dtp.id,'fixture',false,{print:row[2]+'|'+row[3],releaseName:row[4]});
  assert.equal(candidate.setReleaseUnverified,false);assert.equal(candidate.releaseName,row[4]);assert(candidate.setReleaseId);
  assert.equal(context.scanPrice(candidate,'unlimited'),11+i*11);
  const quote={cardId:dtp.id,printing:row[2],rarity:row[3],edition:'unlimited',condition:'Lightly Played',language:'en',currency:'USD',price:7+i,priceStatus:'current'};
  const priced={...candidate,card:{...candidate.card,conditionQuotes:[quote]}};
  assert.equal(context.scanPrice(priced,'unlimited',{condition:'Lightly Played',language:'en'}),7+i,'cached condition quote retains exact card identity');
  assert.equal(context.scanPrice(priced,'unlimited',{condition:'Moderately Played',language:'en'}),null,'missing played condition never borrows the NM reference');
  assert.equal(context.scanPrice(priced,'unlimited',{condition:'Lightly Played',language:'ja'}),null,'condition quote cannot cross languages');
  assert.equal(context.scanPrice({...priced,card:{...priced.card,conditionQuotes:[{...quote,cardId:'different-card'}]}},'unlimited',{condition:'Lightly Played'}),null,'condition quote cannot cross card identities');
  await context.scanAddMany([item(candidate,'dtp-'+i)],'ygo');
  const lot=S.state.tcg.ygo.collection.at(-1);assert.equal(lot.setReleaseId,candidate.setReleaseId);assert.equal(lot.setReleaseUnverified,false);assert.equal(entryPrice(dtp,lot),11+i*11);
}

const repeated=normalizeYgoSets([{code:'REP',name:'Release A',date:'2001-01-01'},{code:'REP',name:'Release B',date:'2021-01-01'}]);
const card={...dtp,id:'release-fixture',name:'Release Fixture',sets:repeated.map((r,i)=>({code:'REP-EN001',rarity:'Rare',name:r.name,productId:100+i,quotes:[{edition:'Unlimited',marketPrice:100+i}]}))};
ui('ygo').sets.list=repeated;cache.ygo[card.id]=card;
const candidates=[];
for(const release of repeated){
  const candidate=await context.scanCandById('ygo',card.id,'fixture',false,{print:'REP-EN001|Rare',releaseName:release.name});
  candidates.push(candidate);assert.equal(candidate.setReleaseUnverified,false);assert.equal(candidate.setReleaseId,release.id);
  assert.equal(context.scanPrice(candidate,'unlimited'),null,'legacy code/rarity quote cannot prove which release it prices');
  await context.scanAddMany([item(candidate,'rep-'+release.name.replace(/\W/g,''))],'ygo');
  assert.equal(entryPrice(card,S.state.tcg.ygo.collection.at(-1)),null);
}
assert.equal(uniquePrintings(candidates).length,2,'same code and rarity do not collapse distinct release candidates');
const before=S.state.tcg.ygo.collection.length;
await assert.rejects(context.scanAddMany([item(candidates[1],'rep-'+candidates[0].releaseName.replace(/\W/g,''))],'ygo'),/already saved with different details/);
assert.equal(S.state.tcg.ygo.collection.length,before);

// Real production hydration/manual-save path must retain the chosen release.
const scanner={A:{},C:{},render(){},toast(){},game:()=>S.state.settings.game,setOf:()=>'',numberOf:()=>'',priceOf:(g,c,f)=>context.scanPrice(c,f),candById:(...args)=>context.scanCandById(...args),addMany:(g,items)=>context.scanAddMany(items,g)};
registerScanner(scanner);
S.ui.scan={cands:[{...candidates[1],localReference:true}],read:{},confirm:{game:'ygo',i:0,qty:1,condition:'Near Mint',lang:'en',finish:'unlimited'}};
await scanner.A.scanConfirm();assert.equal(S.state.tcg.ygo.collection.at(-1).setReleaseId,candidates[1].setReleaseId);assert.equal(S.state.settings.game,'mtg');

const unknown=await context.scanCandById('ygo',card.id,'fixture',true,{print:'REP-EN001|Rare'});
assert.equal(unknown.setReleaseId,'');assert.equal(unknown.setReleaseUnverified,true);assert.equal(unknown.exact,false);assert.equal(context.scanPrice(unknown,'unlimited'),null);
await context.scanAddMany([item(unknown,'unknown')],'ygo');const unknownLot=S.state.tcg.ygo.collection.at(-1);assert.equal(unknownLot.setReleaseId,'');assert.equal(unknownLot.setReleaseUnverified,true);assert.equal(entryPrice(card,unknownLot),null);
await context.scanAddMany([item({...unknown,releaseName:'Unknown Release A'},'unknown-named')],'ygo');
await assert.rejects(context.scanAddMany([item({...unknown,releaseName:'Unknown Release B'},'unknown-named')],'ygo'),/already saved with different details/,'two known unequal names must not silently collapse when dates are unverified');

const sameNames=normalizeYgoSets([{code:'REP',name:'Release A',date:'2001-01-01'},{code:'REP',name:'Release A',date:'2021-01-01'}]);
ui('ygo').sets.list=sameNames;
const ambiguous=await context.scanCandById('ygo',card.id,'fixture',true,{print:'REP-EN001|Rare',releaseName:'Release A',setReleaseId:sameNames[0].id});
assert.equal(ambiguous.setReleaseUnverified,true);assert.equal(ambiguous.setReleaseId,'');assert.equal(context.scanPrice(ambiguous,'unlimited'),null,'an explicit date cannot resolve a source whose card row never supplied that date');

// 3.77 saved a lot but could fail to remove its queue row. Missing historical
// flags mean unknown, not verified, and retrying must clean up without a duplicate.
const legacy={id:'legacy-lot',scanCaptureId:'legacy-retry',cardId:card.id,name:card.name,qty:1,printing:'REP-EN001',rarity:'Rare',variant:'',edition:'unlimited',condition:'Near Mint',language:'en'};
S.state.tcg.ygo.collection.push(legacy);const prior=JSON.stringify(legacy),size=S.state.tcg.ygo.collection.length;
await context.scanAddMany([{captureId:'legacy-retry',qty:1,finish:'unlimited',print:'REP-EN001|Rare',cand:{card,print:'REP-EN001|Rare'}}],'ygo');
assert.equal(S.state.tcg.ygo.collection.length,size);assert.equal(JSON.stringify(legacy),prior,'retry does not upgrade legacy unknown release');
globalThis.fetch=denyFetch;
console.log('PASS: actual DTP1 release rows, repeated code/rarity candidates, hydration/manual save, unknown/date-ambiguous price quarantine, strict release retry identity, and legacy queue-removal retry compatibility.');
