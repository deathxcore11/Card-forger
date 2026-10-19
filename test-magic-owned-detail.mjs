// Actual registered handlers, no browser/network or private account data.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {magicOwnedDetail,magicOwnedCard,magicOwnedCurrent,magicOwnedContext,magicOwnedNotice} from './magic-owned-detail.js';
import {selectedFinish,matchingLot} from './pricing-presentation.js';
import {SheetHistory,sheetKey} from './sheet-history.js';
import {binderPage,binderArtCard} from './binders.js';
import {valueTopLots,valueHistoryModel,valuePageOverview} from './value-page.js';
import {recordValueObservation} from './value-history.js';
import {lotPrice,collectionValue} from './insights.js';
import {conditionBadge} from './condition-value.js';
import {useMyPrices,myPrintingPrice} from './mtg-tcgprice.js';
const source=fs.readFileSync('app.js','utf8'),section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const make=(id,name,number,finishes,set='nec')=>({id,name,oracle_id:'oracle-'+name,set,set_name:'Fixture set',collector_number:number,finishes,full:true,prices:{usd:'.92',usd_foil:'3',usd_etched:'.44'},image_uris:{normal:'https://fixture.invalid/'+id+'.jpg'}});
const chishiro=make('3305c70f-188a-4c01-b605-d583ded84e18','Chishiro, the Shattered Blade','77',['etched']);
const base=make('bffa36ac-137d-481c-b1b7-76a88ef15d54',chishiro.name,'1',['nonfoil','foil']);
const extended=make('eaacd338-1040-4d61-977e-7c97d0f26724',chishiro.name,'73',['nonfoil']);
const second=make('fixture-second-foil','Different card family','456',['foil'],'abc');
const secondBase=make('fixture-second-default',second.name,'1',['nonfoil'],'def');
const lot=(id,c,finish,more={})=>({id,name:c.name,printingVerified:true,printingId:c.id,set:c.set,collectorNumber:c.collector_number,finish,qty:2,condition:'Near Mint',language:'en',manualValue:4,manualValueCondition:'Near Mint',...more});
const lots=[lot('etched',chishiro,'etched'),lot('worn',chishiro,'etched',{condition:'Damaged',manualValue:1,manualValueCondition:'Damaged'}),lot('foil',base,'foil'),lot('regular',base,'nonfoil'),lot('extended',extended,'nonfoil'),lot('other',second,'foil')];
const makeState=()=>({collection:structuredClone(lots),printings:Object.fromEntries([chishiro,base,extended,second].map(c=>[c.id,structuredClone(c)])),decks:[],priceChoices:{unrelated:{price:99}},myPrices:{preserve:{price:7}}});
const pending=[];let revision=0,game='mtg',cacheWrites=0,extras=0;const renders=[],notices=[],body={innerHTML:'',scrollTop:0,scrollTo(){}};
const S={state:makeState(),ui:{view:'collection',sheetCtx:null,set:{cards:[]}}};
const h={S,A:{},T:{game:()=>game},navigationStamp:()=>revision,navigationCurrent:r=>r===revision,$:q=>q==='#sheet'?{open:true}:body,location:{hash:'#collection'},currentDeck:()=>null,key:s=>String(s||'').toLowerCase(),selectedFinish,magicOwnedDetail,magicOwnedCard,magicOwnedCurrent,magicOwnedContext,magicOwnedNotice,slim:c=>c,meta:n=>n===chishiro.name?base:secondBase,resolve:()=>{throw Error('Owned entry must not resolve by name');},api:path=>new Promise((resolve,reject)=>pending.push({path,resolve,reject})),openSheet:(html,ctx)=>{S.ui.sheetCtx=ctx;body.innerHTML=html;},V:{cardSheet:(c,ctx)=>{renders.push({c,ctx});return c.id;},buySheet:ctx=>ctx.print.id},loadCardExtras:()=>extras++,refreshSheet:()=>{body.innerHTML=S.ui.sheetCtx.print?S.ui.sheetCtx.print.id:magicOwnedNotice(S.ui.sheetCtx);},toast:s=>notices.push(s),esc:String,cacheCard:()=>{cacheWrites++;throw Error('Owned details must not write name cache');},saveCatalogSoon:()=>{throw Error('No catalog writes');},ensureTcgPrices(){},scopedCommit:()=>async fn=>fn(S.state),recordQuote(){},quoteModel:()=>({}),URLSearchParams,URL};
vm.createContext(h);vm.runInContext(section('A.card = async','// Full card (flavor text'),h);
const before=JSON.stringify(S.state);
for(const entry of lots){await h.A.card({dataset:{entry:entry.id,name:entry.name}});const opened=renders.at(-1);assert.equal(opened.c.id,entry.printingId);assert.equal(opened.ctx.priceFinish,entry.finish);assert.equal(opened.ctx.entryId,entry.id);assert.equal(opened.ctx.condition,entry.condition);assert.equal(matchingLot('mtg',opened.c,opened.ctx,S.state)?.id,entry.id);assert.equal(opened.c.image_uris.normal,'https://fixture.invalid/'+entry.printingId+'.jpg');}
assert.equal(JSON.stringify(S.state),before,'opening every owned printing preserves all saved state');
// A same-name search/deck card still uses its name-wide default, not an arbitrary owned lot.
await h.A.card({dataset:{name:chishiro.name,deck:'deck-id'}});assert.equal(renders.at(-1).c.id,base.id);assert.equal(renders.at(-1).ctx.entryId,'');
// Every existing owned route preserves the lot ID into this same action.
assert.match(binderPage([{game:'mtg',entry:lots[0],card:chishiro}],'Owned binder'),/data-entry="etched" data-act="card"/);
assert.match(valueTopLots({game:'mtg',rows:[{entry:lots[0],card:chishiro,unit:.44}]}),/data-entry="etched"/);
assert.match(fs.readFileSync('views.js','utf8'),/class="lot-art"[^\n]*data-entry="\$\{esc\(e.id\)\}"/);
// Exact identity/finish contradictions are blocked rather than silently repaired.
for(const changes of [{printingVerified:false},{printingId:''},{set:'wrong'},{collectorNumber:'1'},{finish:'foil'}]){const state=makeState();Object.assign(state.collection[0],changes);assert.equal(magicOwnedDetail(state,'etched',chishiro.name).status,'blocked');}
assert.equal(magicOwnedDetail(S.state,'etched','Different name').status,'blocked');
assert.equal(magicOwnedDetail({...S.state,collection:[lots[0],lots[0]]},'etched').status,'blocked');
assert.equal(magicOwnedDetail(S.state,'etched','',base).status,'blocked');
for(const invalid of [{...chishiro,id:'wrong'},{...chishiro,name:'Other'},{...chishiro,set:'abc'},{...chishiro,collector_number:'73'},{...chishiro,finishes:['nonfoil']}])assert.equal(magicOwnedDetail(S.state,'etched','',invalid).status,'blocked');
const leading=makeState();leading.collection[0].collectorNumber='077';assert.equal(magicOwnedDetail(leading,'etched').status,'ready');
// Display and valuation use the same exact physical identity boundary.
const catalog={[chishiro.name.toLowerCase()]:base},noManual={...lots[0],manualValue:null},sourceBefore=JSON.stringify({catalog,noManual});
for(const candidate of [undefined,base,{...chishiro,name:'Wrong name'},{...chishiro,set:'wrong'},{...chishiro,collector_number:'1'},{...chishiro,finishes:['nonfoil']}]){
 const printings=candidate?{[chishiro.id]:candidate}:{};
 assert.equal(magicOwnedCard(noManual,candidate),null);
 assert.equal(lotPrice(noManual,catalog,printings),null,'saved #77 never borrows #1 .92');
 const value=collectionValue([noManual],catalog,printings);assert.equal(value.total,0);assert.equal(value.unpriced,noManual.qty,'unknown copies are coverage gaps, not priced zero');
 const row={owned:true,game:'mtg',entry:noManual,card:candidate,image:base.image_uris.normal};
 assert(!binderArtCard(row).image_uris.normal,'owned binder may not use cached fallback image');
 assert.doesNotMatch(binderPage([row],'Saved copies'),/fixture\.invalid/);
 const manual={...noManual,manualValue:0,manualValueCondition:'Near Mint'};assert.equal(lotPrice(manual,catalog,printings),0,'valid explicit zero stays zero');
 const quote={printingId:noManual.printingId,finish:'etched',language:'en',condition:'Near Mint',currency:'USD',price:.3};
 assert.equal(lotPrice({...noManual,conditionQuotes:[quote]},catalog,printings),.3,'exact saved condition quote survives absent cache');
 assert.equal(lotPrice({...noManual,conditionQuotes:[{...quote,printingId:base.id}]},catalog,printings),null);
 assert.doesNotMatch(valueTopLots({game:'mtg',rows:[{entry:manual,card:candidate,unit:0}]}),/fixture\.invalid/);
}
const unpricedEtched={...chishiro,prices:{usd:'99',usd_foil:'88',usd_etched:null}};
assert.equal(lotPrice(noManual,catalog,{[chishiro.id]:unpricedEtched}),null,'no etched quote cannot become nonfoil/foil');
assert.equal(lotPrice(noManual,catalog,{[chishiro.id]:chishiro}),.44);
// Existing private printing/finish overrides survive an absent cache, never conflicts or name matches.
useMyPrices({[chishiro.id+':etched']:{price:6},[chishiro.id+':foil']:{price:9},[base.id+':etched']:{price:10},[chishiro.name+':etched']:{price:99}});
assert.equal(lotPrice(noManual,catalog,{}),6);assert.equal(myPrintingPrice(chishiro.id,'etched'),6);
assert.equal(lotPrice({...noManual,printingVerified:false},catalog,{}),null);
assert.equal(lotPrice(noManual,catalog,{[chishiro.id]:base}),null,'known conflicting cache cannot be overridden');
assert.equal(lotPrice(noManual,catalog,{[chishiro.id]:{...chishiro,finishes:['nonfoil']}}),null);
useMyPrices({[chishiro.id+':foil']:{price:9},[base.id+':etched']:{price:10},[chishiro.name+':etched']:{price:99}});
assert.equal(lotPrice(noManual,catalog,{}),null,'no different printing, finish, or name-key override');
useMyPrices({[chishiro.id+':etched']:{price:0}});assert.equal(lotPrice(noManual,catalog,{}),0);useMyPrices({});
assert.match(conditionBadge(noManual,[],'Your private printing value'),/Near Mint · Your private printing value/);
assert.doesNotMatch(conditionBadge(noManual,[],'Your private printing value'),/Reference price/);
assert.match(conditionBadge(noManual,[],'Private <value> "quoted"'),/Private &lt;value&gt; &quot;quoted&quot;/);
assert.match(conditionBadge(noManual),/Reference price/,'other callers retain existing labels');
// Unverified legacy market references are unknown, not lost copies or priced zero.
const legacy={id:'legacy',name:chishiro.name,qty:1,condition:'Near Mint'};
assert.equal(lotPrice(legacy,catalog,{}),null);assert.equal(magicOwnedCard(legacy,base),null);
assert.equal(lotPrice({...legacy,manualValue:7,manualValueCondition:'Near Mint'},catalog,{}),7);
assert.equal(lotPrice({...legacy,conditionQuotes:[{condition:'Near Mint',currency:'USD',price:5}]},catalog,{}),null,'unbound legacy quote is not exact market evidence');
assert.equal(lotPrice({...legacy,printingId:chishiro.id,finish:'etched',conditionQuotes:[{printingId:chishiro.id,finish:'etched',condition:'Near Mint',currency:'USD',price:5}]},catalog,{}),null,'ID without verified provenance is still unknown');
const oldHistory=[{date:'2026-10-16',total:20,copies:3,unpriced:0,currency:'USD',basis:'exact-owned-v1'}],oldHistoryBytes=JSON.stringify(oldHistory),mixed=[legacy,{...legacy,id:'private',qty:2,manualValue:1,manualValueCondition:'Near Mint'}],known=collectionValue(mixed,catalog,{});
assert.equal(known.copies,3);assert.equal(known.total,2);assert.equal(known.unpriced,1);
const observed=recordValueObservation(oldHistory,known.total,known.copies,{unpriced:known.unpriced,currency:'USD',basis:'exact-owned-v1'},new Date('2026-10-17T12:00:00Z'));
assert.equal(JSON.stringify(oldHistory),oldHistoryBytes);assert.deepEqual(observed[0],oldHistory[0]);assert.equal(valueHistoryModel(observed,Date.parse('2026-10-17T13:00:00Z')).change,null,'reduced known coverage is not a market crash');
assert.match(valuePageOverview({game:'mtg',value:known,rows:[],history:observed,now:Date.parse('2026-10-17T13:00:00Z')}),/Known subtotal/);
assert.equal(JSON.stringify({catalog,noManual}),sourceBefore);
// Missing exact cache fetches only the saved ID, with no name-default flash.
delete S.state.printings[chishiro.id];const count=renders.length;let task=h.A.card({dataset:{entry:'etched',name:chishiro.name}});assert.equal(renders.length,count);assert.match(body.innerHTML,/No other printing/);assert.equal(pending.at(-1).path,'/cards/'+chishiro.id);pending.at(-1).resolve(chishiro);await task;assert.equal(renders.at(-1).c.id,chishiro.id);assert.equal(S.state.printings[chishiro.id],undefined,'hydration stays in view context, not saved collection');
// Returned wrong printing, deleted/mutated lot, navigation/account/game switch, or a newer sheet cannot consume a late fetch.
for(const mode of ['wrong-response','changed-lot','deleted-lot','navigation','game','new-sheet']){
 S.state=makeState();delete S.state.printings[chishiro.id];game='mtg';const n=renders.length;
 task=h.A.card({dataset:{entry:'etched',name:chishiro.name}});
 if(mode==='changed-lot')S.state.collection[0].finish='foil';if(mode==='deleted-lot')S.state.collection.shift();if(mode==='navigation')revision++;if(mode==='game')game='ygo';if(mode==='new-sheet')S.ui.sheetCtx={type:'card',name:'New'};
 pending.at(-1).resolve(mode==='wrong-response'?base:chishiro);await task;assert.equal(renders.length,n,mode+' cannot render any replacement');
}
S.state=makeState();game='mtg';
// Exact long-press and quantity scope retain the clicked lot, including duplicate-condition copies.
vm.runInContext(section('async function resolveActionCard(','function startCardCompare('),h);
for(const entry of lots){S.ui.sheetCtx=null;const ref=await h.resolveActionCard({dataset:{entry:entry.id,name:entry.name}});assert.equal(ref.card.id,entry.printingId);assert.equal(ref.setVariant,entry.finish);assert.equal(ref.dataset.entry,entry.id);assert.deepEqual(Array.from(h.quickCardLots(ref,S.state.collection),e=>e.id),lots.filter(e=>e.printingId===entry.printingId&&e.finish===entry.finish).map(e=>e.id),'explicit sibling-condition chooser stays inside this printing and finish');}
// Buy/price return retains exact print, finish and condition, even when the global default differs.
vm.runInContext(section('let buyRequestToken = 0;','// Card sheet purchase actions'),h);
vm.runInContext(section('function backToCard(','A.buyBack ='),h);
for(const entry of lots){S.ui.sheetCtx=null;await h.A.buyCard({dataset:{lot:entry.id,name:entry.name,finish:'nonfoil'}});const ctx=S.ui.sheetCtx;assert.equal(ctx.print.id,entry.printingId);assert.equal(ctx.finish,entry.finish);assert.equal(ctx.back.priceFinish,entry.finish);assert.equal(ctx.condition,entry.condition);h.backToCard();assert.equal(renders.at(-1).c.id,entry.printingId);assert.equal(S.ui.sheetCtx.entryId,entry.id);}
// Exact lookup errors are a visible, handled outcome, never a name fallback.
for(const mode of ['quick','buy']){
 S.state=makeState();delete S.state.printings[chishiro.id];S.ui.sheetCtx=null;
 const n=notices.length;task=mode==='quick'?h.resolveActionCard({dataset:{entry:'etched',name:chishiro.name}}):h.A.buyCard({dataset:{lot:'etched',name:chishiro.name}});
 pending.at(-1).reject(Error('Exact printing is offline'));await task;assert.equal(notices.length,n+1);assert.equal(notices.at(-1),'Exact printing is offline');assert.equal(S.ui.sheetCtx,null);
}
// A queued quote save may not reopen a changed/deleted lot, rejected save, or old workspace.
const normalCommit=h.scopedCommit;
for(const mode of ['changed-lot','deleted-lot','workspace','rejected-save']){
 S.state=makeState();S.ui.sheetCtx=null;let release,options;
 h.scopedCommit=()=>async(fn,opts)=>{options=opts;return new Promise(r=>release=r);};
 task=h.A.buyCard({dataset:{lot:'etched',name:chishiro.name}});
 assert.equal(options.observeValue,false);assert.equal(options.recordDeckWork,false);assert.equal(options.guard(),true);
 if(mode==='changed-lot')S.state.collection[0].finish='foil';if(mode==='deleted-lot')S.state.collection.shift();if(mode==='workspace')revision++;
 if(mode!=='rejected-save')assert.equal(options.guard(),false,mode+' invalidates queued quote write');
 release(mode==='rejected-save'?false:undefined);await task;assert.equal(S.ui.sheetCtx,null,mode+' does not reopen stale Buy');
}
h.scopedCommit=normalCommit;S.state=makeState();
// Background enrichment also checks the exact printing and lot after every await.
vm.runInContext(section('async function loadCardExtras(','// Versions load one honest page'),h);h.loadMagicVersions=async()=>{};
for(const mode of ['ready','wrong-response','changed-lot','workspace','new-sheet','changed-print']){
 S.state=makeState();S.ui.sheetCtx=magicOwnedContext(magicOwnedDetail(S.state,'etched'));const ctx=S.ui.sheetCtx;
 ctx.print={...ctx.print,full:false};task=h.loadCardExtras(ctx);
 assert.equal(pending.at(-1).path,'/cards/'+chishiro.id);
 if(mode==='changed-lot')S.state.collection[0].finish='foil';if(mode==='workspace')revision++;if(mode==='new-sheet')S.ui.sheetCtx={type:'card',name:base.name,print:base};if(mode==='changed-print')ctx.print=base;
 pending.at(-1).resolve(mode==='wrong-response'?base:chishiro);await task;
 assert.equal(ctx.print.id,mode==='changed-print'?base.id:chishiro.id);
 if(mode==='ready')assert.equal(ctx.print.full,true);else if(mode!=='changed-print')assert.equal(ctx.print.full,false,'stale/wrong hydration cannot replace exact partial card');
}
S.state=makeState();
// Same card/printing is not the same physical lot. History may not collapse them.
const history=new SheetHistory();const contexts=lots.slice(0,4).map(e=>magicOwnedContext(magicOwnedDetail(S.state,e.id)));
for(let i=1;i<contexts.length;i++){assert.notEqual(sheetKey(contexts[i-1]),sheetKey(contexts[i]));assert(history.push({ctx:contexts[i-1]},contexts[i]));}
for(let i=contexts.length-2;i>=0;i--)assert.equal(history.pop().ctx.entryId,contexts[i].entryId);
assert.equal(cacheWrites,0);assert.equal(JSON.stringify(S.state),before);
console.log('PASS: actual owned Magic click, exact fetch, conflicts/stale guards, two card families, duplicate lots, binder/Value provenance, long-press quantity scope, buy-return, history and zero saved-data mutation.');
