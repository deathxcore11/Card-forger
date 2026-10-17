// Deterministic presentation/renderer contracts only. No browser, server or provider requests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {compactPriceSummary,sellerModels,presentationQuote} from './pricing-presentation.js';
import {CARDS,makeFixtures} from './tests/detail-rules-fixtures.mjs';
import {normalizeYgoSets} from './ygo.js';
import {setContextCard,tcgCardSheet,ui} from './tcg.js';
import {cardSheet,buySheet} from './views.js';
import {S} from './store.js';

const fixtureRequests=[];globalThis.fetch=undefined;
const buy=html=>{const match=html.match(/<a class="btn small card-buy-link"[^>]*>[\s\S]*?<\/a>/);assert(match,'Top Buy is a native link');return match[0];};
const href=html=>buy(html).match(/href="([^"]+)"/)[1].replaceAll('&amp;','&');
function link(game,card,ctx={}){
 const html=compactPriceSummary(game,card,ctx),anchor=buy(html),url=new URL(href(html));
 assert.equal(url.origin,'https://www.tcgplayer.com');assert.equal(url.username,'');assert.equal(url.password,'');
 assert.match(html,/<button class="btn ghost small" data-act="cardPriceJump" data-target="history" aria-label="View price history">Prices<\/button>/);
 assert.doesNotMatch(anchor,/data-act|data-hold|onclick|role="button"|tabindex="-1"|↓/);
 assert.match(anchor,/target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer"/);
 assert.match(anchor,/opens in a new tab/);assert.match(anchor,/aria-hidden="true">↗/);
 assert.equal(href(html),sellerModels(game,card,ctx).find(r=>r.key==='tcgplayer').url,'Top Buy and lower TCGplayer seller share one resolver');
 return {html,anchor,url};
}
function exact(game,card,ctx,id){const result=link(game,card,ctx);assert.equal(result.url.href,'https://www.tcgplayer.com/product/'+id);assert.match(result.anchor,/<span>Buy<\/span>/);assert.doesNotMatch(result.anchor,/\$|€|in stock|exact edition|Near Mint/);return result;}
function search(game,card,ctx={}){const result=link(game,card,ctx);assert.equal(result.url.pathname,`/search/${{mtg:'magic',ptcg:'pokemon',ygo:'yugioh'}[game]}/product`);assert.deepEqual([...result.url.searchParams.keys()],['q']);assert.match(result.anchor,/<span>Search TCGplayer<\/span>/);assert.match(result.anchor,/exact product not verified/);return result;}
const mtg=CARDS.mtg[0],pk=CARDS.ptcg[0],ygo=CARDS.ygo[0];
exact('mtg',mtg,{priceFinish:'nonfoil'},42);exact('mtg',mtg,{priceFinish:'foil'},42);exact('mtg',mtg,{priceFinish:'etched'},43);
exact('mtg',{...mtg,id:'different-printing',tcgplayer_id:84,tcgplayer_etched_id:85},{priceFinish:'etched'},85);
search('mtg',{...mtg,tcgplayer_etched_id:null},{priceFinish:'etched'});
search('mtg',mtg,{priceFinish:'not-a-finish'});search('mtg',mtg,{setId:'different-set'});
exact('mtg',{...mtg,tcgplayer_id:null,purchase_uris:{tcgplayer:'https://www.tcgplayer.com/product/123/verified-printing?tracking=discarded#fragment'}},{},123);
for(const unsafe of ['https://evil.example/product/123','https://tcgplayer.com.evil.example/product/123','http://www.tcgplayer.com/product/123','https://user:password@www.tcgplayer.com/product/123','javascript:alert(1)','//www.tcgplayer.com/product/123','https://www.tcgplayer.com/search/magic/product?q=/product/123','https://www.tcgplayer.com/redirect?url=https://www.tcgplayer.com/product/123','https://www.tcgplayer.com/product/123evil','https://www.tcgplayer.com/product/%31%32%33'])search('mtg',{...mtg,tcgplayer_id:null,purchase_uris:{tcgplayer:unsafe}});
for(const invalid of ['42/../../cart','42?email=private@example.test','42" onclick="bad','0x2a','1e3',-1,0,Infinity,Number.MAX_SAFE_INTEGER+1])search('mtg',{...mtg,tcgplayer_id:invalid,purchase_uris:{}});
exact('mtg',{...mtg,purchase_uris:{tcgplayer:'https://evil.example/product/999'}},{},42);
exact('ptcg',pk,{priceFinish:'normal'},111);exact('ptcg',pk,{priceFinish:'holofoil'},222);exact('ptcg',pk,{priceFinish:'reverse-holofoil'},333);
assert.equal(presentationQuote('ptcg',pk,'reverse-holofoil').value,null,'Missing price does not become a guessed quote');
search('ptcg',{...pk,variants:[{key:'holofoil',usd:5}]},{priceFinish:'holofoil'});
search('ptcg',{...pk,variants:[...pk.variants,{key:'holofoil',usd:5,productId:999}]},{priceFinish:'holofoil'});
search('ptcg',{...pk,variants:[...pk.variants,{key:'normal',usd:2,productId:999}]});
search('ptcg',pk,{priceFinish:'missing-variant'});search('ptcg',pk,{setId:'other-release'});
const samePrice={...pk,prices:{...pk.prices,usd:5},variants:[{key:'holofoil',label:'Holofoil',usd:5,productId:222},{key:'reverse-holofoil',label:'Reverse holo',usd:5,productId:333}]};
search('ptcg',samePrice);exact('ptcg',samePrice,{priceFinish:'holofoil'},222);exact('ptcg',samePrice,{priceFinish:'reverse-holofoil'},333);
const samePriceWithNormal={...samePrice,variants:[{key:'normal',usd:5,productId:111},...samePrice.variants]};
search('ptcg',samePriceWithNormal);exact('ptcg',samePriceWithNormal,{priceFinish:'normal'},111);exact('ptcg',samePriceWithNormal,{priceFinish:'holofoil'},222);
const pokemonRelease={id:pk.set.id,name:pk.set.name},invalidProjected=setContextCard('ptcg',pk,pokemonRelease,[pokemonRelease],{variantKey:'missing-variant'});
assert.equal(invalidProjected.setContext.printingAmbiguous,true);assert.equal(invalidProjected.setContext.variantKey,'missing-variant');
search('ptcg',invalidProjected);search('ptcg',invalidProjected,{priceFinish:'reference'});search('ptcg',invalidProjected,{priceFinish:'normal'});
const duplicateProjected=setContextCard('ptcg',{...pk,variants:[...pk.variants,{...pk.variants[1],productId:999}]},pokemonRelease,[pokemonRelease],{variantKey:'holofoil'});
assert.equal(duplicateProjected.setContext.printingAmbiguous,true);search('ptcg',duplicateProjected);
const validProjected=setContextCard('ptcg',pk,pokemonRelease,[pokemonRelease],{variantKey:'holofoil'});
exact('ptcg',validProjected,{},222);search('ptcg',validProjected,{priceFinish:'normal'});

search('ygo',ygo);search('ygo',ygo,{priceEdition:'SET-001'});search('ygo',ygo,{priceEdition:'missing::Rare'});
exact('ygo',ygo,{priceEdition:'SET-001::Rare',priceYgoEdition:'unlimited'},555);
exact('ygo',ygo,{priceEdition:'SET-002::Common'},556);
for(const edition of ['','1st-edition','unlimited'])exact('ygo',ygo,{priceEdition:'SET-001::Super Rare',priceYgoEdition:edition},557);
assert.equal(presentationQuote('ygo',ygo,'reference','SET-001::Super Rare').value,null,'Ambiguous edition never becomes an exact price');
assert.equal(presentationQuote('ygo',ygo,'reference','SET-001::Rare','1st-edition').value,null,'Unavailable edition never borrows the Unlimited quote');
const releases=normalizeYgoSets([{set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon',tcg_date:'2002-03-08'},{set_code:'LOB',set_name:'Legend of Blue Eyes White Dragon (25th Anniversary Edition)',tcg_date:'2023-04-20'}]);
const reused={...ygo,sets:releases.map(r=>({code:'LOB-EN118',name:r.name,rarity:'Common',price:88,priceSource:'TCGplayer via TCGCSV',productId:999,url:'https://www.tcgplayer.com/product/999',quotes:[{edition:'Unlimited',market:88}]}))};
for(const release of releases){const projected=setContextCard('ygo',reused,release,releases);assert.equal(projected.sets[0].productId,null);search('ygo',projected,{setId:release.id,priceEdition:'LOB-EN118::Common',priceYgoEdition:'unlimited'});}
search('ygo',setContextCard('ygo',reused,'LOB',releases),{priceEdition:'LOB-EN118::Common'});
const separate={...ygo,sets:releases.map((r,i)=>({code:`LOB-${i?'EN':''}118`,name:r.name,rarity:'Common',productId:800+i,price:10+i}))};
for(const [i,release] of releases.entries())exact('ygo',setContextCard('ygo',separate,release,releases),{setId:release.id},800+i);
search('ygo',setContextCard('ygo',separate,releases[0],releases),{setId:releases[1].id});
// The destination only contains public card search terms, never saved lot/deck/account fields.
const privateContext={entryId:'PRIVATE-LOT',entry:'PRIVATE-ENTRY',deckId:'PRIVATE-DECK',accountId:'PRIVATE-ACCOUNT',notes:'PRIVATE-NOTE',manualValue:987.65,condition:'Damaged',email:'private@example.test'};
for(const [game,card] of [['mtg',{...mtg,tcgplayer_id:null,tcgplayer_etched_id:null,purchase_uris:{}}],['ptcg',{...pk,variants:[]}],['ygo',ygo]]){
 const result=search(game,{...card,...privateContext},privateContext);assert.doesNotMatch(result.url.href,/PRIVATE|987|Damaged|example|account|deck|entry|lot/i);
}
const injected=search('mtg',{...mtg,name:'Fixture " <script>&next=https://evil.example/',collector_number:'1&email=private',tcgplayer_id:null,purchase_uris:{}});
assert.equal(injected.url.searchParams.size,1);assert.doesNotMatch(injected.anchor,/<script>|onclick=/);
// Real renderers and saved-lot/current-sheet selections, not generic card-only mocks.
const f=makeFixtures();S.state=f.state;S.catalog=f.catalog;const before=JSON.stringify(S.state);
ui('ptcg').sets.list=[pokemonRelease];
globalThis.fetch=async url=>{fixtureRequests.push(String(url));return {ok:false,json:async()=>({})};};
for(const [card,ctx] of [[pk,{type:'tcard',game:'ptcg',id:pk.id,setId:pk.set.id,setVariant:'missing-variant'}],[{...pk,variants:[...pk.variants,{...pk.variants[1],productId:999}]},{type:'tcard',game:'ptcg',id:pk.id,setId:pk.set.id,setVariant:'holofoil'}],[samePrice,{type:'tcard',game:'ptcg',id:pk.id}],[samePriceWithNormal,{type:'tcard',game:'ptcg',id:pk.id}]]){
 const html=tcgCardSheet(card,ctx);assert.match(buy(html),/<span>Search TCGplayer<\/span>/);assert.match(href(html),/\/search\/pokemon\/product\?/,'Actual renderer must not replace invalid/ambiguous projected variants with the Normal or first-priced product');
}

globalThis.fetch=undefined;
const selected={...mtg,id:'shown-printing',tcgplayer_id:84,tcgplayer_etched_id:85};
const mtgCtx={type:'card',name:mtg.name,entryId:'lot-mtg-0',print:selected,priceFinish:'etched',tab:'overview'};
let html=cardSheet(mtg,mtgCtx);assert.equal(href(html),'https://www.tcgplayer.com/product/85','Current shown printing wins over name-wide default and old saved lot');
mtgCtx.print=mtg;mtgCtx.priceFinish='nonfoil';html=cardSheet(mtg,mtgCtx);assert.equal(href(html),'https://www.tcgplayer.com/product/42');assert.match(html,/data-detail-key="owned-lot"/);
for(const [game,card] of [['ptcg',pk],['ygo',ygo]]){
 const lot=S.state.tcg[game].collection[0],ctx={type:'tcard',game,id:card.id,entryId:lot.id,priceFinish:lot.variant||'',priceEdition:game==='ygo'?lot.printing+'::'+lot.rarity:'',priceYgoEdition:lot.edition||'',tab:'overview'};
 html=tcgCardSheet(card,ctx);assert.equal(href(html),`https://www.tcgplayer.com/product/${game==='ptcg'?111:555}`);assert.match(html,/data-detail-key="owned-lot"/);
 if(game==='ptcg')ctx.priceFinish='holofoil';else ctx.priceEdition='SET-001::Super Rare';
 html=tcgCardSheet(card,ctx);assert.equal(href(html),`https://www.tcgplayer.com/product/${game==='ptcg'?222:557}`);assert.doesNotMatch(html,/data-detail-key="owned-lot"/,'A new selection must not claim the old saved lot');
 assert.match(html,/id="card-sellers"/);assert.match(html,/Cardmarket/);
}
assert.match(buySheet({type:'buy',name:mtg.name,print:mtg,finish:'etched'}),/href="https:\/\/www.tcgplayer.com\/product\/43"/);
assert.equal(JSON.stringify(S.state),before,'Rendering outbound links cannot change private saved data');
const css=fs.readFileSync('style.css','utf8');assert(Number(css.match(/\.card-price-actions \.btn \{min-height:(\d+)px/)?.[1])>=44,'Price actions meet the minimum touch size');assert.match(css,/\.card-price-actions :is\(button,a\)[^}]*:focus-visible/);
assert(fixtureRequests.every(url=>url.startsWith('api/prices/recent?game=ptcg&')),'Unexpected mocked renderer request: '+JSON.stringify(fixtureRequests));
console.log('PASS: direct all-game top Buy, Prices separation, changing exact printing/finish/lot contexts, honest search fallbacks, cross-release YGO contamination rejection, URL injection/privacy and native-link/focus/touch contracts. No browser or network used.');
