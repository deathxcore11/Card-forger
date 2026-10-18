import assert from 'node:assert/strict';
import {S,blank} from './store.js';
import {registerTcg,cache,tcgAddSheet} from './tcg.js';
import {conditionRequest,applyConditionQuotes} from './condition-feed.js';
import {conditionValue,conditionPriceHtml} from './condition-value.js';
import {createConditionRefreshScheduler} from './condition-refresh-scheduler.js';
import {missingConditionNotice} from './condition-feed-route.js';
const originalDocument=globalThis.document;
try{
 for(const game of ['ptcg','ygo']){
  S.state=blank();S.state.settings.game=game;
  const card={id:game==='ptcg'?'cel25-22':'123',name:'Language save fixture',game,variants:[{key:'holofoil',label:'Holofoil'}],sets:[{code:'SET-EN001',rarity:'Super Rare'}]};cache[game][card.id]=card;
  assert.match(tcgAddSheet(card),/id="tLanguage"/);
  const values={'#tQty':'2','#tPrint':game==='ptcg'?'holofoil':'SET-EN001|Super Rare','#tEdition':'1st-edition','#tCond':'Lightly Played','#tLanguage':'ja','#lotManualValue':'3.25'};
  globalThis.document={querySelector:s=>s in values?{value:values[s]}:null};
  S.ui.sheetCtx={type:'tadd',game,id:card.id,setId:''};
  const ctx={A:{},C:{},I:{},commit:async fn=>fn(S.state),render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
  registerTcg(ctx);await ctx.A.tOwnSave({dataset:{id:card.id}});
  const lot=S.state.tcg[game].collection[0];assert(lot,'Normal save completes without any price request');assert.equal(lot.language,'ja');assert.equal(lot.qty,2);assert.equal(lot.manualValue,3.25);assert.equal(new URL(conditionRequest(card,lot,game),'https://app').searchParams.get('language'),'ja');
  const quote={condition:'Lightly Played',price:.34,currency:'USD',priceStatus:'current',source:'TCGplayer',priceType:'market-reference',checkedAt:new Date().toISOString(),validUntil:new Date(Date.now()+86400000).toISOString()};
  applyConditionQuotes(card,lot,[quote]);assert.equal(conditionValue(null,lot,card.conditionQuotes).price,3.25,'A later observation never replaces a private manual value');
  const restored=JSON.parse(JSON.stringify(lot));assert.equal(conditionValue(null,restored,card.conditionQuotes).price,3.25);
  assert.equal(conditionValue(null,{...lot,manualValue:null},card.conditionQuotes).price,.34);
  assert.equal(conditionValue(null,{...lot,manualValue:null,language:'en'},card.conditionQuotes).price,null);
  assert.match(conditionPriceHtml(.34,{...lot,manualValue:null},card.conditionQuotes,{retryAction:'retryConditionPrice'}),/Market reference.*TCGplayer/);assert.match(conditionPriceHtml(.34,lot,card.conditionQuotes,{retryAction:'retryConditionPrice'}),/Refresh price/);
  assert.equal(conditionRequest(card,{...lot,graded:true},game),null);assert.equal(conditionValue(99,{...lot,manualValue:null,graded:true},card.conditionQuotes).price,null);assert.equal(conditionValue(99,{...lot,graded:true},card.conditionQuotes).price,3.25);
 }
 const scheduler=createConditionRefreshScheduler({intervalMs:0});let calls=0;
 await scheduler.request('exact',()=>{calls++;return {status:'available'};});
 await scheduler.request('exact',()=>{throw Error('Passive refresh must reuse the result');});
 let resolve;const waiting=new Promise(r=>resolve=r);
 const first=scheduler.request('exact',()=>{calls++;return waiting;},{retry:true});
 const duplicate=scheduler.request('exact',()=>{throw Error('Duplicate refresh');},{retry:true});
 resolve({status:'available'});await Promise.all([first,duplicate]);assert.equal(calls,2);
 const data={data:[{tcgplayerId:658304,variants:[{printing:'Unlimited',language:'English',price:.48}]}]};
 assert.match(missingConditionNotice('ygo',['1st Edition'],'English',data,658304),/Editions with prices: Unlimited/);
 assert.doesNotMatch(missingConditionNotice('ygo',['1st Edition'],'Japanese',data,658304),/Unlimited/);
 assert.doesNotMatch(missingConditionNotice('ygo',['1st Edition'],'English',data,123),/Unlimited/);
 console.log('PASS: normal collection save retains language, quantity and manual value; dated quotes cannot cross language or grade; explicit refresh is deduplicated.');
}finally{globalThis.document=originalDocument;}
