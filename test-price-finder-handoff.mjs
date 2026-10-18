import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {S,blank} from './store.js';
import {registerTcg,cache,tcgAddSheet} from './tcg.js';
import {conditionRequest,applyConditionQuotes,CONDITION_IDENTITY} from './condition-feed.js';
import {conditionValue,conditionPriceHtml,conditionManualPlaceholder,conditionName} from './condition-value.js';
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

// Execute the real form controller with a delayed source response. These checks
// guard the user-entered value, not just a snapshot of the presentation markup.
const appSource=await readFile(new URL('./app.js',import.meta.url),'utf8');
const controllerSource=appSource.slice(appSource.indexOf('function refreshConditionPrice(retry=false)'),appSource.indexOf('A.retryConditionPrice='));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
for(const game of ['mtg','ptcg','ygo']){
 const condition='Moderately Played',card={id:'hierarchy-'+game,game,sets:[{code:'TEST-001',rarity:'Super Rare',price:60.8}],variants:[{key:'holofoil',label:'Holofoil',usd:60.8}],conditionQuotes:[]};
 const controls={conditionPricePreview:{isConnected:true,innerHTML:''},lotManualValue:{value:''},tCond:{value:condition},tLanguage:{value:'en'},tPrint:{value:game==='ptcg'?'holofoil':'TEST-001|Super Rare'},tEdition:{value:'unlimited'},addCondition:{value:condition},addFinish:{value:'nonfoil'},addLanguage:{value:'en'}};
 const $=selector=>controls[selector.slice(1)]||null,entry={printingId:card.id,printingVerified:true},state={state:{printings:{[card.id]:card}},ui:{sheetCtx:game==='mtg'?{type:'add',entry,lookup:card}:{type:'tadd',game,id:card.id}}};
 let release,requests=0,selected;
 const waiting=new Promise(resolve=>release=resolve);
 const fetchQuote=(_card,selection)=>{selected=selection;if(selection.manualValue!==null)return Promise.resolve({status:'manual'});requests++;return waiting;};
 const T={game:()=>game,entryPrice:(c,e)=>conditionValue(60.8,e,c.conditionQuotes).price,referenceEntryPrice:()=>60.8};
 const refresh=new Function('$','S','T','contextTcgCard','conditionValue','conditionName','conditionPriceHtml','conditionManualPlaceholder','conditionBuyLink','CONDITION_IDENTITY','fetchConditionValue','cardPrice',controllerSource+';return refreshConditionPrice;')($,state,T,()=>card,conditionValue,conditionName,conditionPriceHtml,conditionManualPlaceholder,()=>null,CONDITION_IDENTITY,fetchQuote,()=>60.8);
 refresh();assert.equal(requests,1);assert.equal(controls.lotManualValue.placeholder,'Enter custom value (optional)');
 controls.lotManualValue.value='75.50';refresh();await tick();
 assert.match(controls.conditionPricePreview.innerHTML,/condition-price-amount">\$75\.50/);assert.match(controls.conditionPricePreview.innerHTML,/>Custom</);
 applyConditionQuotes(card,selected,[{condition,price:54.9,currency:'USD',priceStatus:'current',source:'TCGplayer',priceType:'market-reference',calculatedAt:'2026-10-16T12:00:00Z',checkedAt:new Date().toISOString(),validUntil:new Date(Date.now()+86400000).toISOString()}]);
 release({status:'available'});await tick();
 assert.equal(controls.lotManualValue.value,'75.50');assert.match(controls.conditionPricePreview.innerHTML,/condition-price-amount">\$75\.50/);assert.match(controls.conditionPricePreview.innerHTML,/condition-market-secondary[\s\S]*\$54\.90/,'Late quote appears under the live custom value');assert.equal(requests,1);
 controls.lotManualValue.value='';refresh();await tick();assert.match(controls.conditionPricePreview.innerHTML,/condition-price-amount">\$54\.90/);assert.doesNotMatch(controls.conditionPricePreview.innerHTML,/>Custom</);assert.equal(controls.lotManualValue.value,'');
 controls.lotManualValue.value='0';refresh();await tick();assert.match(controls.conditionPricePreview.innerHTML,/condition-price-amount">\$0\.00/,'Zero is a legitimate custom valuation');
 const rendered=conditionPriceHtml(null,{...selected,manualValue:null},card.conditionQuotes,{status:'available'});assert.match(rendered,/MP · Market/);assert.match(rendered,/calculated 2026-10-16/);assert.doesNotMatch(rendered,/Verified|Market Avg|Sold\/Market|Excludes shipping|NM Baseline/);
 assert.equal(conditionManualPlaceholder({...selected,manualValue:null,language:'ja'},card.conditionQuotes,{status:'available'}),'No market quote — enter value');
 const wrong=conditionPriceHtml(null,{...selected,manualValue:75.5,manualValueCondition:condition,language:'ja'},card.conditionQuotes);assert.doesNotMatch(wrong,/condition-market-secondary|\$54\.90/,'A custom value must not show a different language as its market comparison');
 const expired=card.conditionQuotes.map(q=>({...q,validUntil:new Date(Date.now()-1000).toISOString()}));assert.equal(conditionManualPlaceholder(selected,expired,{status:'available'}),'No market quote — enter value');assert.match(conditionPriceHtml(null,{...selected,manualValue:null},expired),/Last known condition price/);assert.doesNotMatch(conditionPriceHtml(null,{...selected,manualValue:null},expired),/condition-price-amount/);
 if(game!=='mtg'){const html=tcgAddSheet(card);const printing=html.match(/<select id="tPrint">([\s\S]*?)<\/select>/)[1];assert.doesNotMatch(printing,/\$|reference/i);assert.match(printing,game==='ptcg'?/Holofoil/:/TEST-001 · Super Rare/);}
}
console.log('PASS: all-game real price form preserves custom/zero values through late quotes, restores source value on clear, isolates language/expiry, and separates printing identity from prices.');
