// Bounded presentation regression: deterministic fixtures only, no provider traffic.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {normalizeYgoSets} from './ygo.js';
import {setContextCard,selectedYgoCard,selectedSetRarity,tcgRarityAttrs,tcgSet,tcgCardSheet,ui,cache} from './tcg.js';
import {presentationQuote,priceSelectionState,scrollDetailTarget} from './pricing-presentation.js';
import {historyPanel,priceOverview,recordQuote,registerWorkbench} from './workbench-ui.js';
import {sharedHistory,historyKey,loadSharedHistory,historyResponseStatus} from './shared-history.js';
import {tierOf,ygoRarityFlair} from './tier.js';
import {artworkHTML} from './artwork.js';
import {rememberPrice} from './ui.js';
const records=new Map();globalThis.localStorage={getItem:k=>records.get(k)||null,setItem:(k,v)=>records.set(k,String(v))};
let calls=0;globalThis.fetch=async()=>{calls++;throw Error('Unexpected provider request');};
S.state=blank();S.state.settings.game='ygo';S.state.tcg={ygo:blankGame(),ptcg:blankGame()};
const releases=normalizeYgoSets([{set_name:'Valiant Smashers',set_code:'VASM',tcg_date:'2023-11-17'},{set_name:'Other Release',set_code:'OTHR',tcg_date:'2024-01-01'}]);
const release=releases.find(s=>s.code==='VASM');ui('ygo').sets.list=releases;
const print=(code,rarity,price=null)=>({code,rarity,price,name:release.name});
const card={game:'ygo',id:'99020001',name:'Fixture Memento',category:'Monster',stats:[],image:'https://example.invalid/shared.jpg',imageLarge:'https://example.invalid/shared.jpg',prices:{usd:999},sets:[print('VASM-EN001','Super Rare'),print('VASM-EN001','Ultra Rare'),print('VASM-E001','Ultra Rare'),print('VASM-EN001',"Collector's Rare"),{code:'OTHR-EN999',rarity:'Secret Rare',name:'Other Release',price:888}],fetchedAt:new Date().toISOString(),artSchema:1,printPriceSchema:1};
const source=structuredClone(card),projected=setContextCard('ygo',card,release,releases);
assert.equal(projected.prices.usd,null);assert.equal(tcgRarityAttrs(projected),'');
const superRare=selectedSetRarity(projected,'Super Rare'),ultraAmbiguous=selectedSetRarity(projected,'Ultra Rare'),collector=selectedSetRarity(projected,"Collector's Rare");
assert.equal(superRare.setContext.printing.code,'VASM-EN001');assert.match(tcgRarityAttrs(superRare),/yr2/);assert.match(tcgRarityAttrs(collector),/yr4/);
assert.equal(superRare.prices.usd,null);assert.equal(collector.prices.usd,null);assert.equal(tcgRarityAttrs(ultraAmbiguous),'');assert.equal(ultraAmbiguous.setContext.printing,null);
assert.equal(tcgRarityAttrs(selectedYgoCard(projected,'VASM-EN001::Missing')),'');
assert.equal(selectedYgoCard(projected,'VASM-EN001::Missing').prices.usd,null);
assert.deepEqual(card,source,'display projections cannot mutate the generic cache');
assert.equal(ygoRarityFlair(''),'');assert.equal(ygoRarityFlair('unknown'),'');assert.equal(ygoRarityFlair('Common'),'yr0');
assert.equal(tierOf('ygo','Super Rare',12.5).key,tierOf('ygo',"Collector's Rare",12.5).key,'rarity cannot change market-price bands');
assert.equal(tierOf('ygo','Super Rare',null).key,'tn');
const reused=normalizeYgoSets([{set_name:'Repeated',set_code:'REP',tcg_date:'2002-01-01'},{set_name:'Repeated',set_code:'REP',tcg_date:'2023-01-01'}]);
assert.equal(tcgRarityAttrs(setContextCard('ygo',{...card,sets:[{name:'Repeated',code:'REP-001',rarity:'Ultra Rare',price:100}]},reused[0],reused)),'','unverified release never gets rarity decoration');

cache.ygo[card.id]=card;Object.assign(ui('ygo').set,{id:release.id,info:release,cards:[card],contents:{completeness:'complete',expectedUniqueCards:1},busy:false,error:'',candidates:[],q:'',filter:'all',sort:'number',finish:'',rarity:'',limit:80});
let html=tcgSet();assert.doesNotMatch(html,/data-printing=|data-rarity-flair=|\$999|\$888/);
ui('ygo').set.rarity='Super Rare';html=tcgSet();assert.match(html,/data-printing="VASM-EN001::Super Rare"/);assert.match(html,/data-rarity-flair="yr2"/);assert.match(html,/data-tier="tn"/);
ui('ygo').set.rarity='Ultra Rare';html=tcgSet();assert.doesNotMatch(html,/data-printing=|data-rarity-flair=/);
ui('ygo').set.rarity='';
for(const [rarity,flair] of [['Super Rare','yr2'],["Collector's Rare",'yr4']]){
 html=tcgCardSheet(card,{type:'tcard',game:'ygo',id:card.id,setId:release.id,priceEdition:'VASM-EN001::'+rarity,tab:'prices'});
 assert.match(html,new RegExp('class="cd-img" data-rarity-flair="'+flair+'"'));
 assert.match(html,/Printed rarity · /);assert.doesNotMatch(html,/\$999|\$888|\$0\.00/);
}
assert.equal(tcgRarityAttrs(projected,{setReleaseUnverified:true,printing:'VASM-EN001',rarity:'Ultra Rare'}),'');

// Shared image URLs cannot carry another YGO printing's tier forward or backward.
rememberPrice(card.image,999);
assert.doesNotMatch(artworkHTML(projected),/data-tier=/);
const priced=selectedYgoCard(setContextCard('ygo',{...card,sets:[print('VASM-EN002','Ultra Rare',12.5)]},release,releases));
assert.match(artworkHTML(priced),/data-tier="t2"/);
assert.doesNotMatch(artworkHTML(superRare),/data-tier=/);
assert.match(artworkHTML({...priced,prices:{usd:999},setContext:{...priced.setContext,price:3}}),/data-tier="t1"/,'exact context wins over generic prices');
assert.match(artworkHTML({game:'ptcg',id:'fixture-1',name:'Pokemon',image:'https://example.invalid/pk.jpg',prices:{usd:3}}),/data-tier="t1"/);

const unresolved=presentationQuote('ygo',projected),selected=presentationQuote('ygo',superRare);
html=historyPanel(unresolved);assert.match(html,/data-history-state="printing-required"/);assert.match(html,/data-act="historyChoosePrinting"/);assert.match(html,/>Select printing</);assert.doesNotMatch(html,/No recorded quotes|\$0\.00|temporarily unavailable/);
html=historyPanel(selected);assert.match(html,/data-history-state="exact-unavailable"/);assert.equal((html.match(/History unavailable for this exact printing\./g)||[]).length,1);assert.doesNotMatch(html,/historyChoosePrinting|No recorded quotes|\$0\.00/);
html=priceOverview('ygo',priced,{type:'tcard',setId:release.id});assert.match(html,/\$12\.50/);assert.match(html,/History unavailable for this exact printing/);assert.doesNotMatch(html,/Current quote unavailable/);
html=priceOverview('ygo',superRare,{type:'tcard',setId:release.id});assert.match(html,/Current quote unavailable for this selection/);
const quoted=setContextCard('ygo',{...card,sets:[{...print('VASM-EN003','Ultra Rare',77),quotes:[{edition:'1st Edition',market:40}]}]},release,releases);
const noEdition=presentationQuote('ygo',quoted);assert.equal(noEdition.value,null);assert.equal(noEdition.selectedEdition,'');assert.match(noEdition.label,/Edition not specified/);assert.equal(priceSelectionState(noEdition),'edition-required');assert.match(historyPanel(noEdition),/>Select edition</);
const first=presentationQuote('ygo',quoted,'reference','VASM-EN003::Ultra Rare','1st-edition');assert.equal(first.value,40);assert.notEqual(first.key,noEdition.key);
const otherRelease={...selected,releaseId:'other-release',key:selected.key.replace(release.id,'other-release')};
recordQuote(S.state,{...otherRelease,value:888},'2026-10-16T00:00:00Z');assert.doesNotMatch(historyPanel(selected,'all'),/\$888/);
recordQuote(S.state,{...selected,value:12.5},'2026-10-16T00:00:00Z');html=historyPanel(selected,'all');assert.match(html,/data-history-state="ready"/);assert.match(html,/1 verified observation/);assert.match(html,/\$12\.50/);
assert.equal(calls,0,'contextual rendering and selection do not contact generic history providers');

const generic={game:'ptcg',id:'state-fixture',name:'Fixture',prices:{usd:null}},q=presentationQuote('ptcg',generic);
sharedHistory.set(historyKey(q),{status:'empty',series:[]});html=historyPanel(q);assert.match(html,/data-history-state="empty"/);assert.equal((html.match(/No recorded quotes for this selection\./g)||[]).length,1);assert.doesNotMatch(html,/history-coverage|\$0\.00/);
sharedHistory.set(historyKey(q),{status:'unavailable',series:[]});assert.match(historyPanel(q),/data-history-state="unavailable"/);
sharedHistory.set(historyKey(q),{status:'ready',series:[{source:'Exact fixture',points:[{date:'2025-01-01',value:4}]}]});html=historyPanel(q,'30');assert.match(html,/data-history-state="range-empty"/);assert.equal((html.match(/No recorded quotes in the selected calendar range\./g)||[]).length,1);assert.match(html,/View available history/);
sharedHistory.set(historyKey(q),{series:[],notice:'Historical sources unavailable; your saved checks remain available.'});assert.match(historyPanel(q),/data-history-state="unavailable"/,'old cached entries classify without waiting for a refresh');
sharedHistory.delete(historyKey(q));assert.match(historyPanel(q),/data-history-state="loading"/);

assert.equal(historyResponseStatus({series:[],notice:'Historical archive unavailable. Current and previously saved quotes remain available.'}),'unavailable');
assert.equal(historyResponseStatus({series:[],notice:'History provider example.invalid returned 503'}),'unavailable');
assert.equal(historyResponseStatus({series:[],notice:'No unambiguous product mapping for this rarity.'}),'unsupported');
assert.equal(historyResponseStatus({series:[],notice:'No recorded market history for this exact product.'}),'empty');
assert.equal(historyResponseStatus({series:[],notice:'This variant is supported but has no current USD quote. Saved history is still shown; no new tracking was added.'}),'empty');
// Existing history requests distinguish a completed empty response from a failure;
// request shapes and provider count are unchanged, and all traffic is mocked.
for(const [status,id] of [['empty','empty-state'],['unavailable','failed-state']]){
 const request=presentationQuote('ptcg',{...generic,id});let seen=0;
 globalThis.fetch=async()=>{seen++;return status==='empty'?new Response(JSON.stringify({game:'ptcg',cardId:id,finish:'reference',series:[]}),{status:200}):new Response('',{status:503});};
 const result=await loadSharedHistory(request);assert.equal(result.status,status);assert.equal(seen,3);
}

// CTA targets the existing selector without choosing, persisting or navigating.
const A={},C={},scrolled=[],focus=[];
const selector={value:'',getBoundingClientRect:()=>({top:600}),focus:()=>focus.push('printing')};
const body={scrollTop:100,getBoundingClientRect:()=>({top:0}),querySelector:s=>s==='[data-change="historyEdition"]'?selector:s==='.sheet-head'||s==='.cs-tabs'?{getBoundingClientRect:()=>({height:50,bottom:100})}:null,scrollTo:o=>scrolled.push(o)};
globalThis.document={querySelector:s=>s==='#sheetBody'?body:null};S.ui.sheetCtx={type:'tcard',game:'ygo',id:card.id,setId:release.id};
registerWorkbench({A,C,getGame:()=> 'ygo'});A.historyChoosePrinting({dataset:{selection:'printing'}});assert.deepEqual(focus,['printing']);assert.equal(selector.value,'');assert.equal(S.ui.sheetCtx.priceEdition,undefined);assert.equal(scrolled[0].behavior,'auto');
S.ui.sheetCtx=null;A.historyChoosePrinting({dataset:{selection:'printing'}});assert.equal(focus.length,1,'dismissed sheet cannot be refocused');
delete globalThis.document;
const css=fs.readFileSync('style.css','utf8');assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/rarity-edge-glint/);assert.match(css,/\.cd-img\[data-rarity-flair\] \.card-img/);
console.log('PASS: YGO verified rarity separate from price, exact filter/detail propagation, ambiguous regional/release neutrality, shared-art tier isolation, edition choice, contextual history/empty/provider distinction, no false zero, no new provider calls and CTA cancellation.');
