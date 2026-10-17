import assert from 'node:assert/strict';
import fs from 'node:fs';
import {printingNameKey,samePrintingFamily,printingRows,printingFacets,filterPrintingRows,printingSelection,printingPickerHTML,createPrintingPicker} from './printing-picker.js';
import {normalizeYgoSets} from './ygo.js';
import {setContextCard} from './tcg.js';

const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
let writes=0,networkCalls=0;
globalThis.fetch=()=>{networkCalls++;throw Error('Live network is prohibited by this test.');};
globalThis.localStorage={getItem:()=>null,setItem:()=>writes++,removeItem:()=>writes++,clear:()=>writes++};
try {
 const mtg={id:'m1',oracle_id:'oracle-exact',name:'Lightning Bolt',games:['paper'],set:'a',set_name:'Alpha',collector_number:'161',released_at:'1993-08-05',rarity:'common',finishes:['nonfoil','foil','etched'],tcgplayer_id:100,tcgplayer_etched_id:101,prices:{usd:'10',usd_foil:null,usd_etched:'25'}};
 const otherMtg={...mtg,id:'m2',set:'b',set_name:'Beta',collector_number:'007',released_at:'1993-10-04',finishes:['nonfoil'],prices:{usd:'12'}};
 const mRows=printingRows('mtg',[mtg,otherMtg,{...mtg,id:'bad-oracle',oracle_id:'wrong'},{...mtg,id:'digital',games:['arena']}],{source:mtg});
 assert.equal(mRows.length,4);assert.equal(mRows.find(r=>r.finish==='etched').productId,101);
 assert.equal(mRows.find(r=>r.finish==='foil').price,null,'unknown foil never borrows regular price');
 assert.equal(printingRows('mtg',[{...mtg,finishes:['etched'],tcgplayer_etched_id:null}],{source:mtg})[0].productId,null,'unknown etched product never uses ordinary product ID');
 assert.equal(printingRows('mtg',[{...mtg,finishes:undefined}],{source:mtg})[0].finish,'','unconfirmed finish is not manufactured');
 assert.equal(printingRows('mtg',[{...mtg,finishes:undefined}],{source:mtg})[0].price,null);
 assert.equal(printingRows('mtg',[{...mtg,finishes:undefined}],{source:mtg})[0].selectable,false,'unknown finish cannot become a regular finish on detail refresh');
 assert.equal(samePrintingFamily('mtg',{...mtg,oracle_id:''},mtg),false);
 assert.equal(filterPrintingRows(mRows,{sort:'price-high'}).at(-1).price,null);
 assert.equal(filterPrintingRows(mRows,{sort:'price-low'}).at(-1).price,null);
 assert.equal(filterPrintingRows(mRows,{sort:'new'})[0].releaseId,'b');
 assert.equal(filterPrintingRows(mRows,{sort:'old'})[0].releaseId,'a');
 assert.equal(filterPrintingRows(mRows,{set:'a',finish:'foil'}).length,1);
 assert.equal(filterPrintingRows(mRows,{number:'07'})[0].cardId,'m2');
 assert.equal(filterPrintingRows(mRows,{price:'unknown'}).length,1);
 assert.equal(filterPrintingRows(mRows,{rarity:'mythic'}).length,0);
 assert.equal(printingSelection({...mRows[0],selectable:false}),null);
 const mtgBefore=structuredClone(mtg);printingRows('mtg',[mtg],{source:mtg});assert.deepEqual(mtg,mtgBefore);

 const pokemon={game:'ptcg',id:'alpha-025',name:'Pikachu',set:{id:'alpha',name:'Alpha',number:'025'},released:'2020-01-01',prices:{usd:999},rarity:'Rare',variants:[{key:'normal',label:'Normal',usd:5,productId:123},{key:'detail:shadowless-7',label:'Shadowless',usd:null,productId:456}],image:'https://example.test/card.png'};
 const pCatalogue=[{id:'alpha',name:'Alpha',date:'2020-01-01'}];
 const pConfig={source:pokemon,catalogue:pCatalogue,projectCard:(card,release,opts)=>setContextCard('ptcg',card,release,pCatalogue,opts)};
 const pRows=printingRows('ptcg',[pokemon,...['Pikachu ex','Pikachu-EX','Pikachu GX','Pikachu V','Pikachu VMAX','Flying Pikachu'].map((name,i)=>({...pokemon,id:'decoy-'+i,name})),{...pokemon,id:'pocket-025',pocket:true}],pConfig);
 assert.equal(pRows.length,2,'suffixes and Pocket remain separate');
 assert.equal(pRows[1].variantKey,'detail:shadowless-7');assert.equal(pRows[1].productId,456);assert.equal(pRows[1].price,null);
 assert.equal(printingSelection(pRows[1]).productId,456);assert.equal(printingSelection(pRows[1]).card,pokemon);
 assert.match(pRows[1].artLabel,/Reference art/);
 assert.equal(printingNameKey('  Flabébé  '),printingNameKey('Flabe\u0301be\u0301'));
 assert.notEqual(printingNameKey('Farfetch’d'),printingNameKey('Farfetchd'));
 const withoutVariants=printingRows('ptcg',[{...pokemon,variants:[]}],pConfig)[0];
 assert.equal(withoutVariants.variantKey,'');assert.equal(withoutVariants.finish,'reference');assert.equal(withoutVariants.price,null);
 const duplicateVariants=printingRows('ptcg',[{...pokemon,variants:[{key:'detail:dupe',productId:1},{key:'detail:dupe',productId:2}]}],pConfig);
 assert.equal(duplicateVariants.length,2);assert.ok(duplicateVariants.every(r=>!r.selectable));
 const ownArtwork=printingRows('ptcg',[{...pokemon,variants:[{key:'normal',image:'https://example.test/version.png'}]}],pConfig)[0];
 assert.equal(ownArtwork.artLabel,'Variant image');
 const pokemonBefore=structuredClone(pokemon);printingRows('ptcg',[pokemon],pConfig);assert.deepEqual(pokemon,pokemonBefore);

 const catalogue=normalizeYgoSets([
  {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08'},
  {set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-21'},
  {set_code:'FXX',set_name:'Exact Edition Fixture',tcg_date:'2024-01-01'},
  {set_code:'REP',set_name:'Reused Date Release',tcg_date:'2001-01-01'},
  {set_code:'REP',set_name:'Reused Date Release',tcg_date:'2020-01-01'},
 ]);
 const first=catalogue.find(s=>s.date==='2002-03-08'),anniversary=catalogue.find(s=>s.date==='2023-04-21'),exact=catalogue.find(s=>s.code==='FXX');
 const ygo={game:'ygo',id:'89631139',name:'Blue-Eyes White Dragon',released:'1999-01-01',prices:{usd:999},sets:[
  {code:'LOB-001',name:first.name,rarity:'Ultra Rare',price:500,productId:444,priceSource:'TCGplayer via TCGCSV',quotes:[{edition:'1st Edition',market:500}]},
  {code:'LOB-001',name:anniversary.name,rarity:'Ultra Rare',price:500,productId:444,priceSource:'TCGplayer via TCGCSV',quotes:[{edition:'1st Edition',market:500}]},
  {code:'FXX-001',name:exact.name,rarity:'Rare',price:25,productId:555,quotes:[{edition:'1st Edition',market:25},{edition:'Unlimited',market:10}]},
  {code:'REP-001',name:'Reused Date Release',rarity:'Common',price:80,productId:666,quotes:[{edition:'Unlimited',market:80}]},
  {code:'MISSING-001',name:'Missing release A',rarity:'Common',price:4},
  {code:'MISSING-001',name:'Missing release B',rarity:'Common',price:5},
 ]};
 const yConfig={source:ygo,catalogue,projectCard:(card,release,opts)=>setContextCard('ygo',card,release,catalogue,opts)};
 const yBefore=structuredClone(ygo),yRows=printingRows('ygo',[ygo,{...ygo,id:'different-id'}],yConfig);
 assert.equal(yRows.length,8);assert.deepEqual(ygo,yBefore,'release projection does not mutate cached data');
 const lob=yRows.filter(r=>r.number==='LOB-001');assert.equal(lob.length,2);assert.notEqual(lob[0].key,lob[1].key);
 assert.ok(lob.every(r=>r.price===null&&r.productId===null&&r.edition===''&&r.selectable),'shared code/rarity cannot inherit contaminated price or edition');
 assert.equal(printingSelection(lob.find(r=>r.releaseId===first.id)).releaseId,first.id);
 const firstEdition=yRows.find(r=>r.releaseId===exact.id&&r.edition==='1st-edition');
 assert.equal(firstEdition.price,25);assert.equal(firstEdition.productId,555);assert.equal(firstEdition.printingKey,'FXX-001::Rare');
 assert.equal(yRows.find(r=>r.edition==='unlimited').price,10);assert.match(firstEdition.artLabel,/Reference art/);
 assert.equal(filterPrintingRows(yRows,{edition:'1st-edition'}).length,1);
 assert.ok(yRows.filter(r=>r.number==='REP-001').every(r=>!r.selectable&&r.price===null));
 assert.equal(yRows.filter(r=>r.number==='MISSING-001').length,2,'unknown releases sharing codes remain separate');
 assert.ok(yRows.filter(r=>r.number==='MISSING-001').every(r=>!r.selectable&&r.date===''),'unknown release never borrows the card’s first-print date');
 assert.ok(printingFacets(yRows).sets.filter(([,label])=>label.startsWith('Reused Date Release')).every(([,label])=>/\d{4}/.test(label)));
 const unknownEdition={...ygo,sets:[{code:'FXX-001',name:exact.name,rarity:'Rare',quotes:[{edition:'Unverified collector label',market:99}]}]};
 assert.equal(printingRows('ygo',[unknownEdition],yConfig)[0].price,null,'unsupported edition cannot become an unspecified quote');
 assert.equal(printingRows('ygo',[ygo],{source:ygo,catalogue}).filter(r=>r.selectable).length,0,'without exact Sets projection picker fails closed');

 // Exercise the controller with real deferred loaders and no browser/network.
 let context={type:'card',name:mtg.name,tab:'versions',scroll:789},html='',selected=null,backCalls=0,cancelCalls=0,callbackCtx=null;
 const parent=context,search={q:'unchanged',f:{owned:'only',max:7},page:4,sort:'name'},searchBefore=structuredClone(search);
 const A={},C={},I={},body={scrollTop:0,contains:()=>false,querySelector:()=>null,querySelectorAll:()=>[]};
 const controller=createPrintingPicker({A,C,I,getContext:()=>context,getBody:()=>body,openSheet:(next,ctx,scroll)=>{html=next;context=ctx;body.scrollTop=scroll;},back:()=>{backCalls++;context=parent;}});
 const base={game:'mtg',card:mtg,parentContext:parent,onSelect:(selection,ctx)=>{assert.equal(context,parent,'restore parent before applying exact selection');selected=selection;callbackCtx=ctx;},onCancel:()=>cancelCalls++};
 let resolveFirst,resolveSecond;
 const pending=controller.open({...base,loadPage:({cursor})=>new Promise(resolve=>{if(cursor===null)resolveFirst=resolve;else resolveSecond=resolve;})});
 assert.equal(context.type,'printing-picker');assert.equal(controller.state.busy,true);assert.match(html,/aria-busy="true"/);
 C.printingPickerFilter({dataset:{field:'finish'},value:'foil'});
 resolveFirst({cards:[mtg],nextCursor:'page-2',complete:false});await pending;
 assert.equal(controller.state.rows.length,3);assert.equal(controller.state.filters.finish,'foil');
 assert.match(html,/Load more matching printings/);assert.match(html,/1 versions shown/);
 C.printingPickerFilter({dataset:{field:'rarity'},value:'mythic'});assert.match(html,/0 versions shown/);assert.match(html,/Load more matching printings/);
 A.printingPickerClear();assert.equal(controller.state.filters.finish,'');
 const more=A.printingPickerMore();C.printingPickerFilter({dataset:{field:'sort'},value:'price-low'});
 resolveSecond({cards:[mtg,otherMtg],nextCursor:null,complete:true});await more;
 assert.equal(controller.state.rows.length,4,'overlapping pages deduplicate exact rows');assert.equal(controller.state.complete,true);assert.equal(controller.state.filters.sort,'price-low');
 assert.ok(A.printingPickerChoose({dataset:{key:controller.state.rows.find(r=>r.finish==='foil').key}}));
 assert.equal(selected.finish,'foil');assert.equal(selected.cardId,'m1');assert.equal(callbackCtx,parent);assert.equal(backCalls,1);
 assert.equal(controller.state,null);assert.deepEqual(search,searchBefore);assert.equal(parent.tab,'versions');assert.equal(parent.scroll,789);

 // Cancel/abandon while request pending: late success OR failure cannot replace detail.
 let pendingResolve,pendingReject;
 const cancelPending=controller.open({...base,loadPage:()=>new Promise(resolve=>pendingResolve=resolve)});
 assert.equal(controller.cancel(),true);const htmlAfterCancel=html;pendingResolve({cards:[mtg],complete:true});await cancelPending;
 assert.equal(context,parent);assert.equal(html,htmlAfterCancel);assert.equal(cancelCalls,1);assert.equal(backCalls,2);
 const stale=controller.open({...base,loadPage:()=>new Promise((resolve,reject)=>pendingReject=reject)});
 const replacement=controller.open({...base,card:otherMtg,loadPage:async()=>({cards:[otherMtg],complete:true})});await replacement;
 const replacedHtml=html;pendingReject(Error('late source failure'));await stale;
 assert.equal(html,replacedHtml);assert.equal(controller.state.error,'');assert.equal(controller.state.card.id,'m2');
 assert.equal(controller.abandon(),true);assert.equal(controller.state,null);assert.equal(backCalls,2,'abandon never restores old game context');

 // Honest continuation beyond old three-page cap; repeated cursors stop without loops.
 let pages=0;
 await controller.open({...base,loadPage:async({cursor})=>{pages++;return {cards:[{...mtg,id:'page-'+pages,finishes:['nonfoil']}],nextCursor:pages<5?pages:null,complete:pages===5};}});
 while(controller.state.nextCursor!==null)await controller.load();
 assert.equal(pages,5);assert.equal(controller.state.rows.length,5);assert.equal(controller.state.complete,true);
 controller.cancel();
 let repeats=0;
 await controller.open({...base,loadPage:async()=>({cards:[mtg],nextCursor:'again',complete:false})});
 await controller.load();assert.equal(controller.state.nextCursor,null);assert.equal(controller.state.complete,false);assert.match(controller.state.error,/repeated/);
 assert.match(html,/Retry/);await A.printingPickerRetry();assert.equal(controller.state.loaded,true);assert.equal(controller.state.error,'');
 controller.cancel();

 // Retry preserves a failed page cursor, including a page with zero exact matches.
 let attempts=0;
 await controller.open({...base,loadPage:async({cursor})=>{attempts++;if(cursor===null)return {cards:[{...mtg,id:'wrong',oracle_id:'wrong'}],nextCursor:17,complete:false};if(attempts===2)throw Error('temporary fixture failure');assert.equal(cursor,17);return {cards:[mtg],complete:true};}});
 assert.equal(controller.state.rows.length,0);assert.match(html,/Load more matching printings/);
 await controller.load();assert.match(controller.state.error,/temporary/);assert.equal(controller.state.nextCursor,17);
 await A.printingPickerRetry();assert.equal(controller.state.rows.length,3);assert.equal(controller.state.error,'');controller.cancel();

 // A later full page cannot conceal missing details from an earlier page.
 let detailPage=0;
 await controller.open({...base,game:'ptcg',card:pokemon,catalogue:pCatalogue,projectCard:pConfig.projectCard,loadPage:async()=>++detailPage===1?{cards:[{...pokemon,id:'alpha-026',brief:true,variants:[]}],nextCursor:1,complete:false}:{cards:[pokemon],complete:true}});
 await controller.load();assert.equal(controller.state.complete,false);assert.match(controller.state.note,/could not be loaded/);assert.match(html,/Reload matching printings/);controller.cancel();
 // Brief duplicates do not erase already verified finish/product records.
 let duplicatePage=0;
 await controller.open({...base,game:'ptcg',card:pokemon,catalogue:pCatalogue,projectCard:pConfig.projectCard,loadPage:async()=>++duplicatePage===1?{cards:[pokemon],nextCursor:1,complete:false}:{cards:[{...pokemon,brief:true,variants:[]}],complete:true}});
 await controller.load();assert.equal(controller.state.rows.length,2);assert.equal(controller.state.rows[1].productId,456);assert.equal(controller.state.complete,true);controller.cancel();

 // No fake completeness for an ended, partial provider response.
 await controller.open({...base,loadPage:async()=>({cards:[mtg],complete:false,note:'Two cards could not be enriched.'})});
 assert.equal(controller.state.complete,false);assert.match(html,/incomplete or unverified/);assert.match(html,/Reload matching printings/);controller.cancel();
 const sample={game:'ygo',card:ygo,rows:yRows,filters:{set:'',number:'',rarity:'',finish:'',edition:'',price:'',sort:'new'},busy:false,error:'',nextCursor:null,complete:true,loaded:true,note:'',view:'grid',filtersOpen:true};
 const markup=printingPickerHTML(sample);assert.match(markup,/id="printingPickerEdition"/);assert.doesNotMatch(markup,/id="printingPickerFinish"/);assert.match(markup,/Reference art/);assert.match(markup,/disabled aria-label=/);assert.match(markup,/data-history-back="1"/);
 assert.match(printingPickerHTML({...sample,card:{...ygo,name:'<script>unsafe</script>'}}),/&lt;script&gt;unsafe/);
 assert.doesNotMatch(printingPickerHTML({...sample,card:{...ygo,name:'<script>unsafe</script>'}}),/<script>unsafe/);
 const css=fs.readFileSync('printing-picker.css','utf8');assert.match(css,/minmax\(0,1fr\)/);assert.match(css,/max-width:420px/);assert.match(css,/prefers-reduced-motion/);
 assert.equal(writes,0,'picker never changes collection, preferences, storage or price settings');assert.equal(networkCalls,0);
 console.log('Printing picker: exact identities, game-specific filters, unpriced variants, canonical releases, stale paging, callback restoration and zero-write regression checks passed.');
} finally {globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;}
