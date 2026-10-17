// Actual-function regressions for the independent exact-history review.
// All provider reads are bounded injected fixtures, never live requests.
import assert from 'node:assert/strict';
import {archivePriceRoute} from './historical-archive.js';
import {recentHistoryRoute} from './recent-history.js';
import {ygoSetId,normalizeYgoSets} from './ygo.js';
import {canRequestExactYgoHistory,exactYgoHistoryIdentity} from './ygo-history-identity.js';
import {historyKey,sharedHistory,loadSharedHistory} from './shared-history.js';
import {historyPanel} from './workbench-ui.js';
import {presentationQuote} from './pricing-presentation.js';
import {setContextCard} from './tcg.js';
import {S,blank} from './store.js';
const now=Date.parse('2026-10-17T00:00:00Z'),day=Date.parse('2026-09-13T00:00:00Z')/864e5;
const release={set_code:'VASM',set_name:'Valiant Smashers',tcg_date:'2023-11-17'};
const q={game:'ygo',cardId:'12345',finish:'reference',releaseId:ygoSetId(release),edition:'VASM-EN001',rarity:'Ultra Rare',selectedEdition:'1st-edition',currency:'USD'};
const product=(code=q.edition,rarity=q.rarity)=>({productId:101,groupId:7,extendedData:[{name:'Number',value:code},{name:'Rarity',value:rarity}]});
const card=()=>({id:12345,card_sets:[{set_code:q.edition,set_name:release.set_name,set_rarity:q.rarity}]});
const request=(route,query=q)=>new URL('https://fixture.invalid/api/prices/'+route+'?'+new URLSearchParams({...query,id:query.cardId}));
async function run(route,patch={},query=q){
 const bodies={card:{data:[card()]},catalogue:[release],groups:{results:[{groupId:7,name:release.set_name}]},products:{results:[product()]},recent:{'1st Edition':[{snapshot_date:'2026-09-13',market:3}]},joins:{'2':{'7':'valiant-smashers'}},archiveProducts:{101:['VASM-EN001',0]},archiveData:{updated:'2026-09-15',cards:{'VASM-EN001':{'1st edition':[[day,3]]}}},...patch},calls=[];
 const fetcher=async raw=>{const u=String(raw);calls.push(u);let key;
  if(u.includes('cardinfo.php'))key='card';else if(u.includes('cardsets.php'))key='catalogue';else if(u.endsWith('/2/groups'))key='groups';else if(u.endsWith('/2/7/products'))key='products';else if(u.includes('api.tickermint.cards'))key='recent';else if(u.endsWith('/maps/groups.json'))key='joins';else if(u.includes('/maps/products/'))key='archiveProducts';else if(u.includes('/data/'))key='archiveData';else throw Error('Unexpected fixture URL '+u);
  return Response.json(bodies[key]);
 };
 const result=await (route==='archive'?archivePriceRoute:recentHistoryRoute)(request(route,query),{},fetcher,now);
 return {http:result.status,data:await result.json(),calls};
}
const noObservations=result=>{assert.equal(result.data.series.length,0);assert(result.calls.every(u=>!u.includes('api.tickermint.cards')&&!u.includes('/data/yugioh/')),'A failed identity cannot request historical observations');};
for(const route of ['archive','recent']){
 // All eight independent scalar-ID repros (four fields on both routes), plus
 // malformed scalar/container variants, must stop before observation traversal.
 const identityPatch=(field,value)=>field==='card.id'?{card:{data:[{...card(),id:value}]}}:field==='group.groupId'?{groups:{results:[{groupId:value,name:release.set_name}]}}:{products:{results:[{...product(),[field.split('.')[1]]:value}]}};
 const ids={'card.id':12345,'group.groupId':7,'product.productId':101,'product.groupId':7};
 for(const [field,id] of Object.entries(ids)){
  for(const value of [[id],[[id]],[],{},true,false,null,0,-1,1.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1,'',' ','not an id','1e2','0x10','+7','7.0']){
   const result=await run(route,identityPatch(field,value));assert.equal(result.data.status,'unavailable',route+' '+field+' '+JSON.stringify(value));noObservations(result);
  }
  for(const value of [id,String(id)]){const result=await run(route,identityPatch(field,value));assert.equal(result.data.status,'ready',route+' scalar '+field);assert.equal(result.data.series[0].productId,101);}
  if(field!=='product.groupId'){const result=await run(route,identityPatch(field,undefined));assert.equal(result.data.status,'unavailable',route+' missing '+field);noObservations(result);}
 }
 const absentGroup=product();delete absentGroup.groupId;assert.equal((await run(route,{products:{results:[absentGroup]}})).data.status,'ready','Absent optional product groupId remains supported');
 // Exact request evidence is required before any provider request.
 for(const rarity of ['???','---','','Unknown','Unspecified','unrecognised rarity']){
  const query={...q,rarity},result=await run(route,{},query);assert.equal(canRequestExactYgoHistory(query),false);assert.equal(result.http,400);assert.equal(result.calls.length,0);
 }
 for(const rarity of [undefined,null,'','???','Unknown']){
  const c=card();if(rarity===undefined)delete c.card_sets[0].set_rarity;else c.card_sets[0].set_rarity=rarity;
  const result=await run(route,{card:{data:[c]}});assert.equal(result.data.status,'unsupported');noObservations(result);
  const p=product();if(rarity===undefined)p.extendedData.pop();else p.extendedData[1].value=rarity;
  const missingProduct=await run(route,{products:{results:[p]}});assert.equal(missingProduct.data.status,'unsupported');noObservations(missingProduct);
 }
 const abbreviated=card();abbreviated.card_sets[0].set_rarity='UR';assert.equal((await run(route,{card:{data:[abbreviated]},products:{results:[product(q.edition,'UR')]}})).data.status,'ready');
 for(const extra of [{name:'Rarity',value:'Ultra Rare'},{name:'Rarity',value:'Super Rare'},{name:'Card Number',value:q.edition},{name:'Number',value:'VASM-E001'}]){
  const p=product();p.extendedData.push(extra);const result=await run(route,{products:{results:[p]}});assert.equal(result.data.status,'unsupported');noObservations(result);
 }
 for(const code of ['VASMEN001','VASM_EN001','VASM-EN-001','VASM--EN001','VASM-E001','vasm-en001']){
  const result=await run(route,{products:{results:[product(code)]}});assert.equal(result.data.status,'unsupported');noObservations(result);
 }
 const collision=await run(route,{products:{results:[product(),{...product('VASMEN001'),productId:102}]}});assert.equal(collision.data.status,'unsupported');noObservations(collision);
 // HTTP-200 errors and malformed required containers are outages at each stage.
 const stages=['card','catalogue','groups','products',...(route==='archive'?['joins','archiveProducts','archiveData']:['recent'])];
 for(const stage of stages)for(const value of [{error:'Synthetic outage'},{errors:['Synthetic outage']},{success:false},null,'not an envelope']){
  const result=await run(route,{[stage]:value});assert.equal(result.data.status,'unavailable',route+' '+stage+' '+JSON.stringify(value));assert.deepEqual(result.data.series,[]);
 }
 const bad={card:[{}, {data:{}},{data:[{}]},{data:[{id:12345}]},{data:[{id:12345,card_sets:{}}]}],catalogue:[{},[{}]],groups:[{}, {results:{}},{results:[null]}],products:[{}, {results:{}},{results:[{productId:101,extendedData:{}}]},{results:[{productId:101,extendedData:[{name:['Number'],value:q.edition}]}]}],joins:[{}, {'2':[]},{'2':{'7':3}}],archiveProducts:[[],{'101':'not mapping'},{'101':['VASM-EN001']}],archiveData:[{}, {cards:[]},{cards:{'VASM-EN001':null}},{cards:{'VASM-EN001':{'1st edition':{}}}}],recent:[[],{'1st Edition':{}},{unexpectedMetadata:{}}]};
 for(const stage of stages)for(const value of bad[stage])assert.equal((await run(route,{[stage]:value})).data.status,'unavailable',stage+' malformed '+JSON.stringify(value));
 for(const patch of [{card:{data:[]}},{card:{data:[{id:12345,card_sets:[]}]}},{catalogue:[]},{groups:{results:[]}},{products:{results:[]}},{groups:{results:[{groupId:7,name:release.set_name},{groupId:8,name:release.set_name}]}}])assert.equal((await run(route,patch)).data.status,'unsupported');
 if(route==='archive')for(const patch of [{joins:{'2':{}}},{archiveProducts:{}},{archiveData:{cards:{}}},{archiveData:{cards:{'VASM-EN001':{unlimited:[]}}}}])assert.equal((await run(route,patch)).data.status,'unsupported');
 else assert.equal((await run(route,{recent:{Unlimited:[]}})).data.status,'unsupported');
 const empty=route==='archive'?{archiveData:{cards:{'VASM-EN001':{'1st edition':[]}}}}:{recent:{'1st Edition':[]}};assert.equal((await run(route,empty)).data.status,'empty');
}
for(const market of [true,false,[9],{},null,'',' ','not numeric','0x10','1e2',' 9 ','+9','0',0,-1,Infinity,NaN,10000001]){
 const result=await run('recent',{recent:{'1st Edition':[{snapshot_date:'2026-09-13',market}]}});assert.equal(result.data.status,'empty',JSON.stringify(market));assert.deepEqual(result.data.series,[]);
}
for(const date of [['2026-09-13'],{},null,'2026-02-30','2026-00-10','2026-09-00','2026-09-31','not a date'])assert.equal((await run('recent',{recent:{'1st Edition':[{snapshot_date:date,market:9}]}})).data.status,'empty');
for(const market of [9,9.25,'9','9.25']){const result=await run('recent',{recent:{'1st Edition':[{snapshot_date:'2026-09-13',market}]}});assert.equal(result.data.status,'ready');assert.equal(result.data.series[0].points[0].value,Number(market));}

// A provider/source failure must not delete another independently saved source.
const identity=exactYgoHistoryIdentity(q),series=(source,value)=>({...identity,source,label:q.edition+' · 1st Edition',subtype:'1st Edition',productId:101,points:[{date:'2026-09-13',value}]}),oldSeries=[series('archive',2),series('recent',20)],storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v))};
S.state=blank();S.ui.historySource={};
const releases=normalizeYgoSets([release]),uiCard=setContextCard('ygo',{game:'ygo',id:q.cardId,name:'Fixture',sets:[{name:release.set_name,code:q.edition,rarity:q.rarity}],prices:{usd:999}},releases[0],releases),uiQuote=presentationQuote('ygo',uiCard,'reference','','1st-edition');
async function load(archive,recent,cached=oldSeries){
 sharedHistory.clear();storage.clear();sharedHistory.set(historyKey(q),{...identity,status:'ready',series:structuredClone(cached),checked:Date.now()-4000000});
 globalThis.fetch=async raw=>{const provider=String(raw).includes('/archive?')?'archive':'recent',mode=provider==='archive'?archive:recent;
  if(mode==='fail')return new Response('',{status:503});
  return Response.json({...identity,...(mode==='mismatch'?{releaseId:'wrong'}:{}),status:['empty','unsupported','unavailable'].includes(mode)?mode:'ready',series:['ready','mismatch'].includes(mode)?[series(provider,provider==='archive'?3:30)]:[]});};
 return loadSharedHistory(q);
}
for(const [archive,recent,values] of [['ready','fail',[3,20]],['fail','ready',[2,30]],['fail','fail',[2,20]],['ready','mismatch',[3,20]],['ready','unavailable',[3,20]]]){
 const result=await load(archive,recent);assert.equal(result.status,'unavailable');assert.match(result.notice,/unavailable|could not refresh/);assert.deepEqual(result.series.map(s=>s.points[0].value),values);assert.deepEqual(result.series.map(s=>s.points[0].date),['2026-09-13','2026-09-13']);assert.equal(result.partialFailure,!(archive==='fail'&&recent==='fail'));
 S.ui.historySource[uiQuote.key]='recent';const html=historyPanel(uiQuote,'all');assert.match(html,/data-history-state="ready"/);assert.match(html,/data-history-source-state="unavailable"/);assert.match(html,/could not refresh|temporarily unavailable/);assert.match(html,new RegExp('\\$'+values[1]+'\\.00'));assert.equal(S.ui.historySource[uiQuote.key],'recent');
}
for(const mode of ['empty','unsupported']){
 const result=await load(mode,'ready');assert.equal(result.status,'ready');assert.deepEqual(result.series.map(s=>s.source),['recent']);assert.equal(result.series[0].points[0].value,30);assert.equal(result.providerStates.archive,mode);
}
const poisoned=oldSeries.map(s=>s.source==='recent'?{...s,releaseId:'wrong'}:s),clean=await load('ready','fail',poisoned);assert.deepEqual(clean.series.map(s=>s.source),['archive'],'Mismatched saved identity cannot survive a partial outage');
const schemaFailure=await run('recent',{products:{error:'outage'}});sharedHistory.set(historyKey(q),schemaFailure.data);assert.match(historyPanel(uiQuote),/data-history-state="unavailable"/);assert.doesNotMatch(historyPanel(uiQuote),/No recorded quotes|data-history-state="unsupported"/);
console.log('PASS: independent exact-history review regressions: scalar provider identities, supported rarity evidence, strict printing codes/collision veto, typed prices and valid dates, provider envelope/schema outage classification, per-provider partial retention/status, selected saved source and poisoned-cache refusal.');
