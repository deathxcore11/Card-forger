// Deterministic model + actual set/card markup checks. No network, persisted
// collection writes, deployment, or assertion about current market values.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setCardFields,setCardFacets,setFinishLabel,pokemonSetFinish,setVariantKey,filterSortSetCards} from './set-list-ui.js';
import {normalizePtcg} from './ptcg.js';
import {S,blank} from './store.js';
import {blankGame} from './games.js';
import {setContextCard,tcgSet,tcgCardSheet,entryPrice,ui,cache} from './tcg.js';
import {presentationQuote,quoteIsStale,quoteTiming,compactPriceSummary,sellerModels} from './pricing-presentation.js';

const release={id:'facet-fixture',name:'Mixed provider records',count:25};
const sourceDate='2026-10-14T22:55:06.843Z',checkedDate='2026-10-19T10:00:00.000Z',now=Date.parse(checkedDate);
const makeCard=(i,variants)=>({game:'ptcg',id:`${release.id}-${i}`,name:`Fixture ${i}`,set:{id:release.id,name:release.name,number:String(i)},rarity:'Rare',variants,prices:{usd:1,eur:2,others:[],source:'TCGplayer / fixture source',updated:sourceDate,referenceKind:'market'},fetchedAt:checkedDate});

// The audit's 2 legacy / 23 detailed split must become one 25-card facet,
// independently of any set-specific provider correction.
const cards=Array.from({length:25},(_,i)=>makeCard(i+1,[{key:i<2?'holofoil':`detail:row-${i}`,label:'Holofoil',finish:'holofoil',usd:i+1,productId:1000+i}]));
const snapshot=JSON.stringify(cards),facets=setCardFacets(cards,'ptcg');
assert.deepEqual(facets.finishes,['holofoil']);
assert.deepEqual(facets.finishes.map(setFinishLabel),['Holofoil']);
for(const finish of ['holofoil','label:Holofoil','label: HOLOFOIL ','label:Holo foil']){
 const filtered=filterSortSetCards(cards,'ptcg',{finish});
 assert.equal(filtered.length,25,finish);
 assert.equal(new Set(filtered.map(c=>c.id)).size,25);
 for(const card of filtered)assert.equal(setVariantKey(card,finish),card.variants[0].key,'Facet selection preserves the exact existing per-card key');
}
assert.equal(filterSortSetCards(cards,'ptcg',{finish:'holofoil',q:'25'}).length,1);
assert.equal(filterSortSetCards(cards,'ptcg',{finish:'holofoil',rarity:'Common'}).length,0);
assert.deepEqual(filterSortSetCards(cards,'ptcg',{finish:'holofoil',sort:'number'}).map(c=>c.set.number),Array.from({length:25},(_,i)=>String(i+1)));

const equivalentGroups=[
 ['normal',[{key:'normal'},{key:'detail:n',label:'Normal'},{key:'detail:n2',label:'Nonfoil'}]],
 ['reverse-holofoil',[{key:'reverse'},{key:'reverse-holofoil'},{key:'detail:r',label:'Reverse Holo'},{key:'detail:r2',label:'reverse holofoil'}]],
 ['1st-edition',[{key:'1st-edition',label:'1st Edition'},{key:'detail:first',label:'First Edition · Normal'}]],
 ['1st-edition-holofoil',[{key:'1st-edition-holofoil',label:'1st Ed. holo'},{key:'detail:first-holo',label:'First Edition · Holofoil'}]],
 ['unlimited',[{key:'unlimited',label:'Unlimited'},{key:'detail:unlimited',label:'Unlimited · Normal'}]],
 ['unlimited-holofoil',[{key:'unlimited-holofoil',label:'Unlimited holo'},{key:'detail:unlimited-holo',label:'Unlimited · Holofoil'}]],
];
for(const [key,variants] of equivalentGroups){
 assert.deepEqual(setCardFacets(variants.map((v,i)=>makeCard(i,[v])),'ptcg').finishes,[key]);
 assert(variants.every(v=>pokemonSetFinish(v)===key));
}

const specialVariants=[
 {key:'detail:stamp',label:'25th Celebration · Holofoil',stamps:['25th-celebration'],finish:'holofoil'},
 {key:'detail:shadowless',label:'First Edition · Shadowless · Holofoil',subtype:'shadowless',stamps:['1st-edition'],finish:'holofoil'},
 {key:'detail:copyright',label:'1999 2000 Copyright · Holofoil',subtype:'1999-2000-copyright',finish:'holofoil'},
 {key:'detail:jumbo',label:'Jumbo · Holofoil',size:'jumbo',finish:'holofoil'},
 {key:'reverse-holofoil',label:'Reverse Holo · Poké Ball',foil:'pokeball',finish:'reverse-holofoil'},
 {key:'detail:masterball',label:'Reverse Holo · Master Ball',foil:'masterball',finish:'reverse-holofoil'},
 {key:'firstEdition',label:'First Edition · finish unconfirmed'},
 {key:'detail:future',label:'Future treatment · Holofoil',finish:'holofoil'},
];
const specialCards=specialVariants.map((v,i)=>makeCard(i+30,[v]));
const specialFacets=setCardFacets([...cards,...specialCards],'ptcg');
assert.equal(specialFacets.finishes.length,9,'Distinct treatments, editions, size and unconfirmed availability are not plain Holofoil');
assert.equal(filterSortSetCards([...cards,...specialCards],'ptcg',{finish:'holofoil'}).length,25);
for(const card of specialCards){const facet=pokemonSetFinish(card.variants[0]);assert.equal(filterSortSetCards(specialCards,'ptcg',{finish:facet}).length,1);assert.equal(setVariantKey(card,facet),card.variants[0].key);}
assert.equal(pokemonSetFinish({key:'detail:old-stamp',label:'Holofoil',stamps:['set-logo']}),'label:Set-logo stamped · Holofoil','A generic legacy label cannot discard structured stamp evidence');
assert.equal(pokemonSetFinish({key:'detail:old-pattern',label:'Reverse Holo',foil:'pokeball'}),'label:Reverse Holofoil · Poké Ball');
assert.equal(pokemonSetFinish({key:'detail:old-shadowless',label:'Holofoil',stamps:['1st-edition'],subtype:'shadowless'}),pokemonSetFinish(specialVariants[1]),'Structured legacy qualifiers use the same facet as the complete detailed label');
assert.equal(pokemonSetFinish({key:'detail:old-pattern',label:'Reverse Holo',foil:'pokeball'}),pokemonSetFinish(specialVariants[4]));
assert.equal(pokemonSetFinish({key:'detail:opaque'}),'','Do not expose opaque product IDs as facets');
assert.equal(pokemonSetFinish({key:'detail:unknown-edition-finish',label:'First Edition'}),'label:First Edition','Edition alone cannot prove a Normal finish');
assert.equal(pokemonSetFinish({key:'firstEdition'}),'firstEdition','A legacy availability flag remains unconfirmed');
assert.equal(pokemonSetFinish({...specialVariants[0],setFacet:'holofoil'}),'label:25th Celebration · Holofoil','A bare grouping hint without catalogue-source provenance is not enough');

// A shared facet does not prove two product records on one card are aliases.
const ambiguous=makeCard(80,[{key:'detail:a',label:'Holofoil',productId:700,usd:3},{key:'detail:b',label:'Holofoil',productId:701,usd:90}]);
assert.deepEqual(setCardFields(ambiguous,'ptcg').finishes,['holofoil']);
assert.equal(filterSortSetCards([ambiguous],'ptcg',{finish:'holofoil'}).length,1);
assert.equal(setVariantKey(ambiguous,'holofoil'),'','Never choose by first product or lower price');
assert.equal(setContextCard('ptcg',ambiguous,release,[release],{variantKey:setVariantKey(ambiguous,'holofoil')||'unresolved-selection'}).prices.usd,null);
const alias=makeCard(81,[{key:'detail:alias',label:'Holofoil',finish:'holofoil',productId:800,usd:4},{key:'holofoil',label:'Holofoil',finish:'holofoil',productId:800,usd:4,aliasOf:'detail:alias'}]);
assert.equal(setVariantKey(alias,'holofoil'),'detail:alias','Only separately proven aliases allow exact selection');
assert.equal(JSON.stringify(cards),snapshot);

// Actual normalized shape from the captured regular Celebrations response
// (cel25-2, api.tcgdex.net/v2/en/cards/cel25-2, captured 2026-10-19).
const bucket={productId:250301,marketPrice:.28,lowPrice:.04,midPrice:.33};
const provider={id:'cel25-2',name:'Reshiram',localId:'2',set:{id:'cel25',name:'Celebrations',cardCount:{official:25,total:25}},variants:{holo:true},pricing:{tcgplayer:{unit:'USD',updated:sourceDate,holofoil:bucket}},variants_detailed:[{type:'holo',size:'standard',variantId:'jr7oetx1mqug9',thirdParty:{tcgplayer:250301},pricing:{tcgplayer:{unit:'USD',updated:sourceDate,holofoil:bucket}}}]};
const normalized=normalizePtcg(provider);normalized.fetchedAt=checkedDate;
const timedCards=[normalized,makeCard(90,[{key:'normal',label:'Normal',usd:1}]),makeCard(91,[{key:'detail:unlimited',label:'Unlimited · Holofoil',usd:1}])];
for(const card of timedCards){
 const sourceSnapshot=JSON.stringify(card),r={id:card.set.id,name:card.set.name};
 const reference=setContextCard('ptcg',card,r,[r],{variantKey:'reference'}),selectedKey=card.variants[0].key;
 const selected=setContextCard('ptcg',reference,r,[r],{variantKey:selectedKey});
 const again=setContextCard('ptcg',selected,r,[r]);
 const restored=setContextCard('ptcg',again,r,[r],{variantKey:'reference'});
 for(const [projected,finish] of [[reference,'reference'],[selected,selectedKey],[again,selectedKey],[restored,'reference']]){
  const q=presentationQuote('ptcg',projected,finish);
  assert.equal(q.value,card.prices.usd);
  assert.equal(q.sourceUpdatedAt,sourceDate,'Selecting/reselecting/clearing a version retains the known publication date');
  assert.equal(q.checkedAt,checkedDate,'Fetch time stays distinct from source age');
  assert.equal(quoteIsStale(q,now),true);
  assert.match(quoteTiming(q),/Source updated 2026-10-14 · Checked 2026-10-19/);
  assert.equal(projected.prices.source,card.prices.source,'The real provider provenance is not replaced by a UI selection label');
  assert.equal(projected.prices.referenceKind,card.prices.referenceKind);
 }
 assert.equal(selected.prices.eur,null,'Do not project an unverified currency quote onto the selected finish');
 assert.deepEqual(selected.prices.others,[]);
 assert.equal(JSON.stringify(card),sourceSnapshot,'No shared source/cache mutation');
 const wrong=setContextCard('ptcg',selected,{id:'different-release'},[]);
 assert.equal(wrong.prices.usd,null);assert.equal(wrong.prices.updated,undefined,'Unverified releases do not inherit quote provenance');
}
const unknown=makeCard(92,[{key:'holofoil',label:'Holofoil',usd:1}]);delete unknown.prices.updated;
const unknownSelected=setContextCard('ptcg',unknown,release,[release],{variantKey:'holofoil'});
assert.equal(presentationQuote('ptcg',unknownSelected,'holofoil').sourceUpdatedAt,null);
assert.match(quoteTiming(presentationQuote('ptcg',unknownSelected,'holofoil')),/^Source date unavailable · Checked 2026-10-19/,'No fabricated publication timestamp');
const dated=makeCard(93,[{key:'holofoil',label:'Holofoil',usd:1,historyQuote:'2025-01-01'}]);
assert.equal(presentationQuote('ptcg',setContextCard('ptcg',dated,release,[],{variantKey:'holofoil'}),'holofoil').observedAt,'2025-01-01');

// Full set markup, count/filter/price selection and saved manual lot isolation.
S.state=blank();S.state.settings.game='ptcg';S.state.tcg={ptcg:blankGame(),ygo:blankGame()};
const savedLot={id:'saved-detail-lot',cardId:cards[5].id,variant:cards[5].variants[0].key,productId:cards[5].variants[0].productId,qty:7,condition:'Heavily Played',manualValue:42,manualValueCondition:'Heavily Played'};
S.state.tcg.ptcg.collection=[savedLot];
const savedSnapshot=JSON.stringify(S.state);
for(const card of cards)cache.ptcg[card.id]=card;
ui('ptcg').sets.list=[release];
Object.assign(ui('ptcg').set,{id:release.id,info:release,cards,finish:'holofoil',q:'',rarity:'',sort:'number',filter:'all',limit:120,contents:{completeness:'complete'}});
const html=tcgSet();
assert.equal((html.match(/<option value="holofoil"/g)||[]).length,1);
assert.doesNotMatch(html,/<option value="label:Holofoil"/);
assert.match(html,/25 shown/);assert.equal((html.match(/data-act="tCard"/g)||[]).length,25);
assert.match(html,/data-set-variant="detail:row-5"/);
assert.equal(entryPrice(setContextCard('ptcg',cards[5],release,[],{variantKey:cards[5].variants[0].key}),savedLot),42);
assert.equal(JSON.stringify(S.state),savedSnapshot,'Filtering/projection never rewrites saved variant keys, product IDs or personal values');
assert.equal(JSON.stringify(cards),snapshot);
const selectedNormalized=setContextCard('ptcg',normalized,normalized.set,[],{variantKey:'holofoil'});
assert.match(compactPriceSummary('ptcg',selectedNormalized,{priceFinish:'holofoil'}),/stale/);
assert.match(tcgCardSheet(selectedNormalized,{tab:'prices',setId:'cel25',priceFinish:'holofoil'}),/Source updated 2026-10-14/);
const seller=sellerModels('ptcg',selectedNormalized,{priceFinish:'holofoil'}).find(s=>s.key==='tcgplayer');
assert.equal(seller.sourceUpdatedAt,sourceDate);

// Existing real patterned/edition fixtures keep their distinct physical facets.
for(const path of ['tests/fixtures/golurk-sv10.5b-043.json','test-fixtures/finish-effects/base1-4.json']){
 const card=normalizePtcg(JSON.parse(readFileSync(path,'utf8'))),before=JSON.stringify(card),f=setCardFacets([card],'ptcg');
 assert(f.finishes.length>=4,path);assert(!f.finishes.some(x=>x.startsWith('detail:')));
 assert.equal(JSON.stringify(card),before);
}

// All 25 captured Classic Collection provider rows exercise the independent
// catalogue proof that this release has one Holofoil treatment, even where the
// provider omits its set-wide stamp. Keep the raw metadata and exact saved keys.
const classic=Array.from({length:25},(_,i)=>normalizePtcg(JSON.parse(readFileSync(`review/classic-collection-20261019/sources/cel25cc-CC${String(i+1).padStart(3,'0')}.json`,'utf8'))));
const classicSnapshot=JSON.stringify(classic),classicRelease={id:'cel25cc',name:'Celebrations Classic Collection',count:25};
assert.deepEqual(setCardFacets(classic,'ptcg').finishes,['holofoil']);
assert.equal(filterSortSetCards(classic,'ptcg',{finish:'holofoil'}).length,25);
assert.equal(filterSortSetCards(classic,'ptcg',{finish:'label:Holofoil'}).length,25);
for(const card of classic){
 const key=setVariantKey(card,'holofoil');assert(key,`${card.id}: source-proven alias grouping still resolves exactly one existing variant`);
 assert(card.variants.some(v=>v.key===key));
 const selected=setContextCard('ptcg',card,classicRelease,[classicRelease],{variantKey:key});
 assert.equal(selected.setContext.variantKey,key);assert.equal(selected.prices.updated,card.prices.updated);
}
assert.equal(JSON.stringify(classic),classicSnapshot);
for(const card of classic)cache.ptcg[card.id]=card;
ui('ptcg').sets.list=[classicRelease];
Object.assign(ui('ptcg').set,{id:classicRelease.id,info:classicRelease,cards:classic,finish:'holofoil',q:'',rarity:'',sort:'number',filter:'all',limit:120,contents:{completeness:'complete'}});
const classicHtml=tcgSet();
assert.equal((classicHtml.match(/<option value="holofoil"/g)||[]).length,1);
assert.match(classicHtml,/25 shown/);assert.equal((classicHtml.match(/data-act="tCard"/g)||[]).length,25);
assert.doesNotMatch(classicHtml,/<option value="label:.*Holofoil/);
assert.equal(JSON.stringify(classic),classicSnapshot);
ui('ptcg').set.finish='label:Holofoil';
const heldFilterHtml=tcgSet();
assert.match(heldFilterHtml,/<option value="holofoil" selected>/,'A held legacy facet displays the same canonical selection it filters by');
assert.match(heldFilterHtml,/25 shown/);
assert.equal(ui('ptcg').set.finish,'label:Holofoil','Rendering canonical selection does not rewrite held user state');

// Shared helpers must not apply Pokémon alias rules to Magic or Yu-Gi-Oh!.
const magic=[{id:'mtg-a',name:'Magic',set:'m',set_name:'Magic set',collector_number:'1',rarity:'rare',finishes:['nonfoil','foil','etched'],prices:{usd:'2'}}];
assert.deepEqual(setCardFacets(magic,'mtg').finishes,['etched','foil','nonfoil']);
assert.equal(filterSortSetCards(magic,'mtg',{finish:'normal'}).length,0);
assert.equal(filterSortSetCards(magic,'mtg',{finish:'nonfoil'}).length,1);
assert.equal(setFinishLabel('nonfoil'),'nonfoil');
const ygo={game:'ygo',id:'ygo-a',name:'YGO',sets:[{name:'YGO release',code:'YGO-EN001',rarity:'Rare',price:3,checkedAt:sourceDate,finish:'holofoil'}],prices:{usd:999}};
const projected=setContextCard('ygo',ygo,{id:'ygo-release',name:'YGO release',code:'YGO'},[]),ygoSnapshot=JSON.stringify(ygo);
assert.deepEqual(setCardFacets([projected],'ygo').finishes,['holofoil']);
assert.equal(filterSortSetCards([projected],'ygo',{finish:'label:Holofoil'}).length,0);
assert.equal(presentationQuote('ygo',projected).checkedAt,sourceDate);
assert.equal(presentationQuote('ygo',projected).value,3);
assert.equal(JSON.stringify(ygo),ygoSnapshot);
console.log('PASS: mixed 2/23 Pokémon facets merge without product/edition/treatment or saved-value collapse; filters/counts/exact selection agree; source age/provenance survives set selection/reselection/reference round trips; unknown dates stay unknown; Magic/YGO remain isolated.');
