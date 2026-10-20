// Pure fixtures + mocked DOM contracts only. This is not visual/browser/device QA.
import assert from 'node:assert/strict';
import {priceAmount,presentationQuote,selectedFinish,selectedPrinting,sellerModels,sellerRows,compactPriceSummary,detailTabs,detailPanel,detailIdentity,captureDetailState,restoreDetailState,detailTabKey,scrollDetailTarget,createDetailJump,quoteTiming,quoteIsStale,matchingLot} from './pricing-presentation.js';
import {setTcgPrices,useMyPrices,myPriceKey} from './mtg-tcgprice.js';
import {conditionValue} from './condition-value.js';
import {normalizePtcg} from './ptcg.js';

const mtg={id:'magic-a',name:'Fixture',set:'tst',set_name:'A very long printing name',collector_number:'123',lang:'ja',finishes:['nonfoil','foil','etched'],tcgplayer_id:42,tcgplayer_etched_id:99,prices:{usd:null,usd_foil:'3.50',usd_etched:'8',eur:'7',eur_foil:'10',tix:'0'},purchase_uris:{tcgplayer:'https://www.tcgplayer.com/product/42',cardmarket:'https://www.cardmarket.com/en/Magic/Products/Singles/Fixture',cardhoarder:'https://www.cardhoarder.com/cards/123'}};
setTcgPrices('tst',{42:{Normal:{market:12.5},Foil:{market:3}},99:{Foil:{market:8}}});
assert.equal(presentationQuote('mtg',mtg,'nonfoil').value,12.5,'Magic graph/top/vendor share exact cached fallback');
assert.equal(presentationQuote('mtg',mtg,'nonfoil').source,'TCGplayer via TCGCSV');
let rows=sellerModels('mtg',mtg,{priceFinish:'etched'},Object.entries(mtg.purchase_uris));
assert.equal(rows.find(r=>r.key==='tcgplayer').url,'https://www.tcgplayer.com/product/99?Language=Japanese&Printing=Etched+Foil');
assert.equal(rows.find(r=>r.key==='tcgplayer').value,8);
assert.equal(rows.find(r=>r.key==='cardmarket').value,null,'no invented etched EUR quote');
assert.equal(rows.find(r=>r.key==='cardhoarder').value,null,'no paper-etched quote mapped to tickets');
rows=sellerModels('mtg',mtg,{priceFinish:'nonfoil'},Object.entries(mtg.purchase_uris));
assert.equal(rows.find(r=>r.key==='tcgplayer').value,12.5);assert.equal(rows.find(r=>r.key==='cardmarket').value,7);assert.equal(rows.find(r=>r.key==='cardmarket').currency,'EUR');assert.equal(rows.find(r=>r.key==='cardhoarder').value,0);
assert.equal(sellerModels('mtg',{...mtg,tcgplayer_etched_id:null},{priceFinish:'etched'},Object.entries(mtg.purchase_uris))[0].direct,false,'generic Magic product never stands in for etched');
const unsafe=[['Cardmarket','https://not-cardmarket.example/Products/Singles/Fake'],['TCGplayer','http://www.tcgplayer.com/product/42'],['Cardhoarder','https://user:secret@www.cardhoarder.com/cards/123'],['Cardmarket','https://www.cardmarket.com.evil.example/Products/Singles/Fake']];
rows=sellerModels('mtg',mtg,{},unsafe);
assert.ok(rows.every(r=>r.url.startsWith('https://')&&!new URL(r.url).username&&!new URL(r.url).password));
assert.ok(rows.filter(r=>new URL(r.url).hostname.includes('example')).every(r=>r.value===null&&!r.direct&&!['Cardmarket','TCGplayer','Cardhoarder'].includes(r.name)),'trusted label cannot authenticate an unrelated host');
assert.equal(rows.find(r=>r.key==='tcgplayer').url,'https://www.tcgplayer.com/product/42?Language=Japanese&Printing=Normal','unsafe supplied link is replaced only by canonical exact product mapping');
assert.equal(sellerModels('mtg',{...mtg,purchase_uris:{cardmarket:'https://www.cardmarket.com/en/Magic/Products/Search?searchString=Fixture'}},{},[['Cardmarket','https://www.cardmarket.com/en/Magic/Products/Search?searchString=Fixture']]).find(r=>r.key==='cardmarket').value,null,'a store search is not an exact listing');

for(const value of [null,undefined,'',NaN,Infinity,-1])assert.equal(priceAmount(value),null);
assert.equal(priceAmount(0),0);assert.equal(priceAmount('0'),0);
assert.equal(selectedFinish('mtg',{finishes:['foil']},'etched'),'foil');
assert.equal(selectedFinish('ptcg',{variants:[{key:'holofoil'}]},'old-printing-finish'),'old-printing-finish');
const eurOnly={...mtg,id:'eur-only',set:'no-cached-prices',tcgplayer_id:50,prices:{eur:'19.50'}};
useMyPrices({[myPriceKey(eurOnly)]:{price:100}});
assert.match(compactPriceSummary('mtg',eurOnly),/€19\.50/);assert.equal(presentationQuote('mtg',eurOnly,'nonfoil').value,null);
assert.equal(sellerModels('mtg',eurOnly,{},Object.entries(eurOnly.purchase_uris))[0].value,null,'EUR/private amount is never a USD seller quote');
const personal={...eurOnly,id:'personal-only',prices:{}};useMyPrices({[myPriceKey(personal)]:{price:51}});
assert.match(compactPriceSummary('mtg',personal),/Your private value · not a seller quote/);
assert.doesNotMatch(sellerRows('mtg',personal,{},Object.entries(personal.purchase_uris)),/\$51/);useMyPrices({});
const pk={id:'pk-123',game:'ptcg',name:'Pikachu',set:{name:'Test set',number:'123'},prices:{usd:2,eur:9},variants:[{key:'normal',label:'Normal',usd:2,market:2,productId:111,cmProduct:444},{key:'holofoil',label:'Holofoil',usd:5,market:5,productId:222},{key:'reverse-holofoil',label:'Reverse holo',usd:null,productId:333}],cardmarket:{trend:9},cmProduct:444};
const pkLinks=[['TCGplayer (this card)','https://www.tcgplayer.com/product/111'],['Cardmarket','https://www.cardmarket.com/en/Pokemon/Products?idProduct=444'],['eBay','https://www.ebay.com/sch/i.html?_nkw=Pikachu']];
rows=sellerModels('ptcg',pk,{priceFinish:'holofoil'},pkLinks);
assert.equal(rows[0].url,'https://www.tcgplayer.com/product/222?Language=English&Printing=Holofoil');assert.equal(rows[0].value,5);assert.equal(rows[1].value,null);assert.equal(rows[2].value,null);assert.equal(rows[2].direct,false);
assert.equal(sellerModels('ptcg',pk,{priceFinish:'reverse-holofoil'},pkLinks)[0].value,null);
assert.equal(sellerModels('ptcg',{...pk,variants:[{key:'holofoil',label:'Holo',usd:5}]},{priceFinish:'holofoil'},pkLinks)[0].direct,false,'unmatched first-product link must become a search');
assert.equal(sellerModels('ptcg',pk,{},pkLinks)[0].url,'https://www.tcgplayer.com/product/111?Language=English&Printing=Normal','reference resolves the actual reference variant');
// Real adapter output: a detailed Normal variant can have a different Cardmarket product.
const cardmarketFixture=(baseId,variantId)=>normalizePtcg({
 id:'sv1-55',name:'Exact EUR fixture',localId:'55',set:{id:'sv1',name:'Scarlet & Violet'},
 pricing:{tcgplayer:{normal:{marketPrice:2,productId:111}},cardmarket:{idProduct:baseId,trend:60,avg:55}},
 variants_detailed:[{type:'normal',thirdParty:{tcgplayer:111,cardmarket:variantId},pricing:{tcgplayer:{normal:{marketPrice:2,productId:111}}}}],
});
const cmRow=c=>sellerModels('ptcg',c,{priceFinish:'normal'},pkLinks).find(r=>r.key==='cardmarket');
for(const baseId of [999,undefined,null,'']){
 const card=cardmarketFixture(baseId,222),row=cmRow(card);
 assert.equal(card.variants[0].key,'normal');assert.equal(row.url,'https://www.cardmarket.com/en/Pokemon/Products?idProduct=222');
 assert.equal(row.value,null,'different or missing base product identity cannot price detailed product 222');
 const markup=sellerRows('ptcg',card,{priceFinish:'normal'},pkLinks);assert.doesNotMatch(markup,/€60\.00/);assert.match(markup,/Check price/);
}
for(const baseId of [222,'222']){const row=cmRow(cardmarketFixture(baseId,222));assert.equal(row.value,60);assert.equal(row.currency,'EUR');}
const baseOnly=cmRow(cardmarketFixture(999,undefined));assert.equal(baseOnly.url,'https://www.cardmarket.com/en/Pokemon/Products?idProduct=999');assert.equal(baseOnly.value,60,'an explicit base-product link retains its own base EUR quote');
const noCmId=cmRow(cardmarketFixture(undefined,undefined));assert.equal(noCmId.direct,false);assert.equal(noCmId.value,null,'missing both product IDs leaves only an unpriced search');

const dated={...pk,variants:[{...pk.variants[1],historyQuote:'2026-01-01'}]};
assert.match(compactPriceSummary('ptcg',dated,{priceFinish:'holofoil'}),/Last observed 2026-01-01 · stale/);
assert.match(sellerRows('ptcg',dated,{priceFinish:'holofoil'},pkLinks),/Last observed 2026-01-01/);
assert.match(compactPriceSummary('ptcg',{...pk,prices:{},variants:[]},{},{value:3,date:'2025-01-02',finish:'Normal'}),/Last observed 2025-01-02/);
assert.equal(quoteIsStale(presentationQuote('ptcg',dated,'holofoil')),true);assert.match(quoteTiming({checkedAt:'2026-10-17',sourceUpdatedAt:'2026-01-01'}),/Source updated 2026-01-01 · Checked 2026-10-17 · Stale/);
const ygo={id:'123',game:'ygo',name:'Dragon',prices:{usd:2,eur:3,others:[['eBay',6]]},sets:[{code:'SET-001',rarity:'Rare',name:'Set One',price:20,productId:101},{code:'SET-002',rarity:'Common',name:'Set Two',price:1,productId:102}]};
const ygoLinks=[['TCGplayer','https://www.tcgplayer.com/search/yugioh/product?q=Dragon'],['Cardmarket','https://www.cardmarket.com/en/YuGiOh/Products/Search?searchString=Dragon'],['eBay','https://www.ebay.com/sch/i.html?_nkw=Dragon'],['YGOPRODeck','https://ygoprodeck.com/card/dragon']];
let q=presentationQuote('ygo',ygo);assert.equal(q.edition,'');assert.equal(q.value,2);assert.match(q.label,/printing and edition not specified/);
rows=sellerModels('ygo',ygo,{},ygoLinks);assert.equal(rows.length,3);assert.ok(rows.every(r=>r.value===null&&!r.direct),'aggregate and research links are not exact seller quotes');
q=presentationQuote('ygo',ygo,'reference','SET-001::Rare');assert.equal(q.value,20);assert.equal(q.edition,'SET-001');assert.notEqual(q.key,presentationQuote('ygo',ygo).key);
assert.equal(sellerModels('ygo',ygo,{priceEdition:'SET-002::Common'},ygoLinks)[0].value,1);
const editions={...ygo,sets:[{...ygo.sets[0],quotes:[{edition:'1st Edition',market:40,mid:39},{edition:'Unlimited',market:null,mid:10}]}]};
assert.equal(presentationQuote('ygo',editions,'reference','SET-001::Rare').value,null,'multiple edition quotes need an edition choice');
assert.equal(presentationQuote('ygo',editions,'reference','SET-001::Rare','1st-edition').value,40);
q=presentationQuote('ygo',editions,'reference','SET-001::Rare','unlimited');assert.equal(q.value,10);assert.equal(q.kind,'mid');assert.notEqual(q.key,presentationQuote('ygo',editions,'reference','SET-001::Rare','1st-edition').key);
assert.equal(presentationQuote('ygo',editions,'reference','SET-001::Rare','limited').value,null);
assert.equal(selectedPrinting({...ygo,sets:[ygo.sets[0],{...ygo.sets[0],rarity:'Ultra Rare'}]},'SET-001'),null,'same-code different rarity never guessed');
assert.equal(sellerModels('ygo',editions,{priceEdition:'SET-001::Rare',priceYgoEdition:'unlimited'},ygoLinks)[0].value,10);
const worn={cardId:'123',printing:'SET-001',rarity:'Rare',edition:'1st-edition',condition:'Heavily Played',language:'en'};
assert.equal(conditionValue(40,worn,[]).price,null,'presentation did not change condition policy');
const provider={...worn,currency:'USD',price:4,priceStatus:'current',source:'Existing exact provider'};
assert.equal(conditionValue(40,worn,[provider]).price,4);assert.equal(conditionValue(40,{...worn,edition:'unlimited'},[provider]).price,null);
assert.equal(conditionValue(40,{...worn,manualValue:3,manualValueCondition:'Heavily Played'},[provider]).price,3);
const lotState={collection:[{id:'magic-lot',printingVerified:true,printingId:mtg.id,finish:'foil'}],tcg:{ygo:{collection:[{id:'ygo-lot',...worn}]},ptcg:{collection:[{id:'pk-lot',cardId:pk.id,variant:'holofoil'}]}}};
assert.equal(matchingLot('mtg',mtg,{entryId:'magic-lot',priceFinish:'foil'},lotState)?.id,'magic-lot');
assert.equal(matchingLot('mtg',{...mtg,id:'other'},{entryId:'magic-lot',priceFinish:'foil'},lotState),null);
assert.equal(matchingLot('ptcg',pk,{entryId:'pk-lot',priceFinish:'holofoil'},lotState)?.id,'pk-lot');
assert.equal(matchingLot('ptcg',pk,{entryId:'pk-lot',priceFinish:'normal'},lotState),null);
assert.equal(matchingLot('ptcg',pk,{entryId:'ygo-lot'},lotState),null);
assert.equal(matchingLot('ygo',ygo,{entryId:'ygo-lot',priceEdition:'SET-001::Rare',priceYgoEdition:'1st-edition'},lotState)?.id,'ygo-lot');
assert.equal(matchingLot('ygo',ygo,{entryId:'ygo-lot',priceEdition:'SET-002::Common',priceYgoEdition:'1st-edition'},lotState),null);
assert.equal(matchingLot('ygo',ygo,{entryId:'ygo-lot',priceEdition:'SET-001::Rare',priceYgoEdition:'unlimited'},lotState),null);


// Complete tab semantics and focus/scroll restoration use stable identities, not positions.
assert.match(detailTabs('prices',[['overview','Overview'],['prices','Prices']]),/id="card-tab-prices" role="tab" aria-controls="card-panel-prices" aria-selected="true" tabindex="0"/);
assert.match(detailPanel('prices','prices','x'),/role="tabpanel" aria-labelledby="card-tab-prices"/);
assert.deepEqual(['ArrowLeft','ArrowRight','Home','End','Escape'].map(k=>detailTabKey(k,0,7)),[6,1,0,6,null]);
assert.notEqual(detailIdentity({type:'tcard',game:'ptcg',id:'1'}),detailIdentity({type:'tcard',game:'ygo',id:'1'}));
assert.notEqual(detailIdentity({type:'card',name:'Same',print:{id:'1'}}),detailIdentity({type:'card',name:'Same',print:{id:'2'}}));
assert.equal(detailIdentity({type:'review'}),'');
const original={id:'card-tab-prices',tagName:'BUTTON'},focused=[];
const details=[{dataset:{detailKey:'history-values'},open:true},{dataset:{detailKey:'history-about'},open:false}],tabs={scrollLeft:44};
const body={scrollTop:250,contains:el=>el===original,querySelectorAll:s=>s==='details'?details:[original],querySelector:s=>s==='.cs-tabs'?tabs:null};
const saved=captureDetailState(body,original);details[0].open=false;details[1].open=true;
const replacement={...original,focus:opts=>focused.push(opts),closest:()=>null};body.querySelectorAll=s=>s==='details'?details:[replacement];body.scrollTop=0;tabs.scrollLeft=0;
restoreDetailState(body,saved);assert.deepEqual(details.map(d=>d.open),[true,false]);assert.equal(body.scrollTop,250);assert.equal(tabs.scrollLeft,44);assert.deepEqual(focused,[{preventScroll:true}]);
const scrolls=[],focuses=[],dest={getBoundingClientRect:()=>({top:500}),focus:()=>focuses.push('target')};
const jumpBody={scrollTop:100,getBoundingClientRect:()=>({top:50}),querySelector:s=>s==='#card-history'||s==='#card-sellers'?dest:{getBoundingClientRect:()=>({height:44})},scrollTo:o=>scrolls.push(o)};
assert.equal(scrollDetailTarget(jumpBody,dest,true),true);assert.deepEqual(scrolls.pop(),{top:450,behavior:'auto'});
// Reduced-motion scrolling changes the sticky header synchronously. Re-measure the
// final sticky boundary before returning, without a timer that can steal a later card.
let stickyHeight=44,stickyRefreshes=0,stickyFocus=0;
const stickyScrolls=[],stickyTarget={getBoundingClientRect:()=>({top:700-stickyBody.scrollTop}),focus:()=>stickyFocus++};
const stickyBody={scrollTop:0,getBoundingClientRect:()=>({top:50}),querySelector:s=>s==='.sheet-head'?{getBoundingClientRect:()=>({height:stickyHeight,bottom:50+stickyHeight})}:{getBoundingClientRect:()=>({height:44,bottom:50+stickyHeight+44})},scrollTo:o=>{stickyScrolls.push(o);stickyBody.scrollTop=o.top;}};
assert.equal(scrollDetailTarget(stickyBody,stickyTarget,true,()=>{stickyRefreshes++;stickyHeight=stickyBody.scrollTop>110?104:44;}),true);
assert.ok(stickyTarget.getBoundingClientRect().top>=50+104+44+12,'target clears the actual expanded sticky header and tabs');
assert.equal(stickyFocus,1,'geometry adjustment does not move focus again');assert.ok(stickyRefreshes>=1);
assert.ok(stickyScrolls.every(s=>s.behavior==='auto'),'reduced motion never animates a corrective scroll');
let current={type:'tcard',game:'ptcg',id:'one',tab:'overview'},open=true,pending=[];
const jump=createDetailJump({getContext:()=>current,isOpen:()=>open,getBody:()=>jumpBody,showPrices:()=>{current.tab='prices';return new Promise(resolve=>pending.push(resolve));},reducedMotion:()=>true});
let p1=jump('history'),p2=jump('sellers');pending.shift()();assert.equal(await p1,false);pending.shift()();assert.equal(await p2,true,'latest repeated jump wins');
p1=jump('history');current={type:'tcard',game:'ptcg',id:'new',tab:'prices'};pending.shift()();assert.equal(await p1,false,'late completion cannot move focus in another card');
p1=jump('history');open=false;pending.shift()();assert.equal(await p1,false,'closed sheet never receives a late jump');open=true;
p1=jump('history');current.id='changed-in-place';pending.shift()();assert.equal(await p1,false,'same context object with changed identity is still a different card');
p1=jump('history');current.tab='overview';pending.shift()();assert.equal(await p1,false,'user navigation wins over pending price jump');
// Deterministic native-scroll model: smooth scroll does not move immediately;
// assigning scrollTop while rebuilding the sheet cancels the animation. This is
// the history-refresh race seen with a focused seller still below the viewport.
function detailScrollFixture(){
 let top=0,scheduled=null,active=null,headerHeight=50,current={type:'tcard',game:'ptcg',id:'dated',tab:'overview'},open=true;
 const listeners=new Map(),scrolls=[],nodes=new Map();
 const body={dataset:{detailIdentity:detailIdentity(current)},scrollHeight:2400,clientHeight:920,
  get scrollTop(){return top;},set scrollTop(value){top=Math.max(0,Math.min(value,this.scrollHeight-this.clientHeight));scheduled=null;},
  getBoundingClientRect:()=>({top:79,bottom:999,height:920}),contains:n=>[...nodes.values()].includes(n),
  querySelector:s=>s==='.sheet-head'?head:s==='.cs-tabs'?tabs:nodes.get(s),
  querySelectorAll:s=>s==='details'?[]:[...nodes.values()],
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  scrollTo(options){scrolls.push(options);if(options.behavior==='smooth')scheduled=options.top;else this.scrollTop=options.top;}
 };
 const emit=(type,target=active)=>{for(const fn of [...(listeners.get(type)||[])])fn({type,target});};
 const head={getBoundingClientRect:()=>({height:headerHeight,bottom:79+headerHeight})};
 const tabs={scrollLeft:44,getBoundingClientRect:()=>({height:64,bottom:79+headerHeight+64})};
 const install=(shift=0)=>{headerHeight=50;for(const n of nodes.values())n.isConnected=false;nodes.clear();for(const [id,offset] of [['history',1200],['sellers',1720]]){
  const n={id:'card-'+id,isConnected:true,dataset:{},closest:()=>null,getBoundingClientRect:()=>({top:offset+shift-body.scrollTop}),focus:()=>{active=n;emit('focusin',n);}};nodes.set('#'+n.id,n);
 }};
 const refreshOffsets=()=>{headerHeight=body.scrollTop>110?104:50;};
 install();
 const jump=createDetailJump({getContext:()=>current,isOpen:()=>open,getBody:()=>body,showPrices:async()=>{current.tab='prices';},refreshOffsets});
 return {body,head,tabs,scrolls,jump,emit,get active(){return active;},get current(){return current;},get scheduled(){return scheduled;},
  node:id=>nodes.get('#card-'+id),listenerCount:()=>[...listeners.values()].reduce((sum,fns)=>sum+fns.size,0),
  finish(){if(scheduled!==null){const next=scheduled;body.scrollTop=next;refreshOffsets();emit('scroll');emit('scrollend');}},
  move(value){body.scrollTop=value;refreshOffsets();},close(){open=false;},reopen(){open=true;},changeCard(){current={...current,id:'new'};body.dataset.detailIdentity=detailIdentity(current);},
  snapshot:()=>captureDetailState(body,active),
  rerender(state=captureDetailState(body,active),shift=0){install(shift);active=null;body.scrollTop=0;restoreDetailState(body,state);refreshOffsets();}
 };
}
{
 const fixture=detailScrollFixture();await fixture.jump('history');fixture.finish();
 assert.ok(fixture.node('history').getBoundingClientRect().top>=fixture.tabs.getBoundingClientRect().bottom+11,'completed smooth scroll clears the expanded sticky heading without waiting for a history refresh');
 assert.equal(fixture.listenerCount(),0,'settled smooth scroll removes its listeners');
}
for(const progress of [0,80,400]){
 const fixture=detailScrollFixture();await fixture.jump('sellers');
 assert.equal(fixture.scheduled,1515,'ordinary Buy still requests a smooth scroll');
 if(progress)fixture.move(progress);
 fixture.rerender();fixture.finish();
 const rect=fixture.node('sellers').getBoundingClientRect(),boundary=fixture.tabs.getBoundingClientRect().bottom;
 assert.equal(fixture.active,fixture.node('sellers'),'history refresh focuses the current connected section');
 assert.ok(rect.top>=boundary&&rect.top<999,'history refresh preserves the destination, not the not-yet-scrolled position');
 assert.equal(fixture.listenerCount(),0,'restored intent is consumed without timers or permanent listeners');
 fixture.move(200);fixture.rerender();assert.equal(fixture.body.scrollTop,200,'a completed jump does not pin later refreshes to sellers');
}

// A changed history height is resolved against the replacement target, rather
// than applying the old pixel destination. Both price sections obey the rule.
for(const target of ['history','sellers']){
 const fixture=detailScrollFixture();await fixture.jump(target);
 await Promise.resolve().then(()=>fixture.rerender(undefined,75));
 const rect=fixture.node(target).getBoundingClientRect();
 assert.equal(fixture.active,fixture.node(target));assert.ok(rect.top>=fixture.tabs.getBoundingClientRect().bottom&&rect.top<999);
}
// Input can interrupt native scrolling without changing document.activeElement
// (wheel/touch in particular). A later data refresh must preserve that choice.
for(const event of ['wheel','touchstart','pointerdown','keydown','focusin']){
 const fixture=detailScrollFixture();await fixture.jump('sellers');
 if(event==='focusin')fixture.node('history').focus();else fixture.emit(event);fixture.move(80);fixture.rerender();
 assert.equal(fixture.body.scrollTop,80,event+' cancels a pending destination');
 assert.equal(fixture.scrolls.length,1,event+' cannot trigger a corrective jump');
 assert.equal(fixture.listenerCount(),0,event+' removes every temporary listener');
 if(event==='focusin')assert.equal(fixture.active,fixture.node('history'),'new keyboard focus wins over a pending seller jump');
}
for(const change of ['close','card','identity','tab']){
 const fixture=detailScrollFixture();await fixture.jump('sellers');
 if(change==='close')fixture.close();else if(change==='card')fixture.changeCard();else if(change==='identity')fixture.current.id='changed-in-place';else fixture.current.tab='overview';
 fixture.move(80);fixture.rerender();assert.equal(fixture.body.scrollTop,80,change+' invalidates a started jump');assert.equal(fixture.scrolls.length,1);
 assert.equal(fixture.listenerCount(),0,change+' clears obsolete navigation bookkeeping');
}
{
 const fixture=detailScrollFixture();await fixture.jump('sellers');const stale=fixture.snapshot();
 fixture.emit('wheel');fixture.move(80);fixture.rerender(stale);
 assert.equal(fixture.scrolls.length,1,'a snapshot cannot revive an interrupted intent');
}
{
 const fixture=detailScrollFixture();await fixture.jump('history');fixture.finish();
 assert.equal(fixture.listenerCount(),0,'natural smooth-scroll completion removes temporary listeners');
 fixture.move(80);fixture.rerender();assert.equal(fixture.body.scrollTop,80,'finished scrolls cannot replay on data refresh');
}
{
 const fixture=detailScrollFixture();await fixture.jump('sellers');await fixture.jump('history');fixture.rerender();
 assert.equal(fixture.active,fixture.node('history'),'the latest target also wins after a smooth scroll has started');
 assert.ok(fixture.node('history').getBoundingClientRect().top<999);
 assert.equal(fixture.listenerCount(),0,'superseded and restored intents both clean up');
}
{
 const fixture=detailScrollFixture();await fixture.jump('sellers');const stale=fixture.snapshot();
 assert.deepEqual(JSON.parse(JSON.stringify(stale)),stale,'history snapshots contain only serializable state, never a DOM node or navigation callback');
 fixture.close();await Promise.resolve();fixture.reopen();fixture.rerender(stale);
 assert.equal(fixture.scrolls.length,1,'Back to the same context object on a later turn cannot revive a saved jump');
 assert.equal(fixture.listenerCount(),0,'an outgoing snapshot expires unconsumed navigation intent');
}
console.log('PASS: deterministic smooth-scroll/history-render race at 0/80/400px, new layout destinations, input/focus/close/card/tab cancellation, latest target wins, one-shot restoration and listener cleanup.');

console.log('PASS: detail seller/quote identity, real fallback labels, currencies and private values isolated, explicit YGO printing/edition, dated-vs-current, unchanged condition resolver, tabs and async focus/race guards.');

// Exercise actual renderers with deterministic mocked history and no live network access.
globalThis.fetch=async()=>new Response(JSON.stringify({points:[],series:[]}),{status:200});
const {S,blank}=await import('./store.js');S.state=blank();
const {quoteModel,recordQuote,historyPanel,priceOverview}=await import('./workbench-ui.js');
const {sharedHistory,historyKey}=await import('./shared-history.js');
const fallbackQuote=quoteModel('mtg',mtg,'nonfoil');assert.equal(fallbackQuote.value,12.5);
recordQuote(S.state,quoteModel('ptcg',dated,'holofoil'),'2026-10-17T00:00:00Z');assert.deepEqual(S.state.settings.marketHistory||{},{} ,'old observed value must not become a new current observation');
const histQuote=quoteModel('mtg',mtg,'foil');sharedHistory.set(historyKey(histQuote),{series:[{source:'Fixture separate archive',label:'Exact foil',archived:true,currency:'USD',finish:'foil',points:[{date:'2025-01-01',value:0},{date:'2025-01-04',value:3}]}]});
let html=historyPanel(histQuote,'all');assert.match(html,/Source is stale/);assert.match(html,/Dated values · 2/);assert.match(html,/Range \$0.00 to \$3.00/);assert.doesNotMatch(html,/Infinity|NaN/);assert.match(html,/Archive · last observed/);
html=historyPanel(histQuote,'30');assert.match(html,/No recorded quotes in the selected calendar range/);
const one=quoteModel('ptcg',pk,'holofoil');sharedHistory.set(historyKey(one),{game:one.game,cardId:one.cardId,finish:one.finish,productId:one.productId,series:[{source:'One point',currency:'USD',finish:'holofoil',points:[{date:'2026-10-01',value:5}]}]});assert.match(historyPanel(one,'all'),/1 verified observation/);
S.state.tcg={ygo:{collection:[{id:'owned',...worn,conditionQuotes:[provider]}]}};
html=priceOverview('ygo',editions,{entryId:'owned',priceEdition:'SET-001::Rare',priceYgoEdition:'1st-edition'},ygoLinks);
assert.match(html,/Exact condition estimate: \$4.00/);assert.ok(html.indexOf('id="card-history"')<html.indexOf('id="card-sellers"'));
assert.match(html,/card-level, not exact edition prices/);
S.state=blank();S.catalog.fixture={...mtg,type_line:'Creature',oracle_text:'Flying',full:true,image_uris:{normal:'https://example.com/card.jpg'}};
const {cardSheet,buySheet}=await import('./views.js');const {tcgCardSheet}=await import('./tcg.js');
for(const [game,card] of [['mtg',S.catalog.fixture],['ptcg',{...pk,stats:[]}],['ygo',{...ygo,stats:[]}]]){
 html=game==='mtg'?cardSheet(card,{tab:'prices'}):tcgCardSheet(card,{tab:'prices'});
 assert.match(html,/class="cs-banner/);assert.match(html,/class="cs-card"/);assert.match(html,/data-act="zoomCard"/);
 assert.match(html,/data-act="cardPriceJump" data-target="history"/);assert.match(html,/<a class="btn small card-buy-link"[^>]*href="https:\/\/www\.tcgplayer\.com\//);
 assert.match(html,/class="vendor-row"/);assert.match(html,/role="tabpanel"/);assert.doesNotMatch(html,/Tap a price to buy|Press and hold it|class="price-pill/);
}
html=buySheet({name:mtg.name,print:mtg,finish:'nonfoil',type:'buy'});assert.match(html,/class="vendor-row"/);assert.match(html,/\$12.50/);assert.doesNotMatch(html,/This exact printing<\/h3>|Search by card name<\/h3>/);
console.log('PASS: real all-game detail + buy rendering, graph above one seller list, preserved main artwork/actions, stale/zero/one-point history, saved-condition distinction and no hidden paragraph/pill clutter.');

// Real workbench entry actions normalize Magic defaults and preserve only matching lot context.
const {registerWorkbench}=await import('./workbench-ui.js');
let activeGame='mtg',opened=null;const A={},C={};
S.state=blank();S.state.tcg={ptcg:{collection:[{id:'pk-owned',cardId:pk.id,variant:'holofoil'}]},ygo:{collection:[{id:'ygo-owned',...worn}]}};S.ui.sheetCtx=null;
registerWorkbench({A,C,commit:async fn=>fn(S.state),render(){},openSheet:(markup,ctx)=>{opened={markup,ctx};S.ui.sheetCtx=ctx;},closeSheet(){},refreshSheet(){},toast(){},getGame:()=>activeGame,getCard:g=>g==='mtg'?mtg:g==='ptcg'?pk:ygo,links:g=>g==='mtg'?Object.entries(mtg.purchase_uris):g==='ptcg'?pkLinks:ygoLinks,zoneFor:()=> 'main'});
await A.marketOpen({dataset:{game:'mtg',id:mtg.id,finish:'reference'}});assert.equal(opened.ctx.finish,'nonfoil');assert.match(opened.markup,/\$12.50/);
activeGame='ptcg';S.ui.sheetCtx=null;await A.marketOpen({dataset:{game:'ptcg',id:pk.id,entry:'pk-owned',finish:'reference'}});assert.equal(opened.ctx.finish,'holofoil');assert.equal(opened.ctx.entryId,'pk-owned');assert.match(opened.markup,/product\/222/);
S.ui.sheetCtx=null;await A.marketOpen({dataset:{game:'ptcg',id:pk.id,entry:'ygo-owned'}});assert.equal(opened.ctx.entryId,undefined,'cross-game lot reference ignored');
activeGame='ygo';S.ui.sheetCtx=null;await A.marketOpen({dataset:{game:'ygo',id:ygo.id,entry:'ygo-owned'}});assert.equal(opened.ctx.edition,'SET-001::Rare');assert.equal(opened.ctx.ygoEdition,'1st-edition');
console.log('PASS: collection market actions normalize Magic reference defaults and validate saved game/card/printing/finish/edition context.');
