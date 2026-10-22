// Public source fixtures plus explicitly synthetic quote mutations. No external requests.
// Run: node test-pokemon-promo-coverage.mjs
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.dirname(new URL(import.meta.url).pathname);
const mod=name=>import(pathToFileURL(path.join(root,name)).href);
const {normalizePtcg,pokemonVariants,applyFallbackPrices}=await mod('ptcg.js');
const {finishChoices,resolveFinish}=await mod('finish-effects.js');
const {finishMaterialProfile}=await mod('finish-materials.js');
const {presentationQuote,quoteForContext,quoteIsStale,conditionBuyLink,sellerModels,selectedFinish,matchingLot}=await mod('pricing-presentation.js');
const {pokemonConditionPrintings,conditionFeedRoute}=await mod('condition-feed-route.js');
const {pokemonPriceRoute,applyProductPrices}=await mod('pokemon-prices.js');
const {pokemonVariantChoices,pokemonVariantAliasTarget,pokemonVariantProductConflict,pokemonDetailedRecords}=await mod('pokemon-variant-options.js');
const {entryPrice,referenceEntryPrice,tcgAddSheet,tcgCollection,cache}=await mod('tcg.js');
const {conditionRequest}=await mod('condition-feed.js');
const {S,blank}=await mod('store.js');
const {actualFinishes,resolveScanFinish}=await mod('scan-batch.js');
const {ptcgProduct}=await mod('ptcg-product.js');
const {REVIEWED_COSMOS_PROMOS}=await mod('pokemon-promo-evidence.js');
const fixture=id=>JSON.parse(readFileSync(new URL('./tests/fixtures/pokemon-promos/'+id+'.json',import.meta.url)));
const checks=[];
async function test(name,fn){try{await fn();checks.push({name,status:'PASS'});}catch(e){checks.push({name,status:'FAIL',reason:e.message});}}
const pony=normalizePtcg(fixture('SWSH013')),snorlax=normalizePtcg(fixture('SWSH032'));
await test('Ponyta existing two exact product identities and saved keys are retained',()=>assert.deepEqual(pony.variants.map(v=>[v.key,v.productId]),[['holofoil',206430],['detail:jr7oetx1mqug9',232767]]));
await test('Ponyta General Mills selected quote stays null, never Cosmos quote',()=>assert.equal(presentationQuote('ptcg',pony,'detail:jr7oetx1mqug9').value,null));
await test('Ponyta General Mills seller link remains product 232767',()=>assert(new URL(conditionBuyLink('ptcg',pony,{variant:'detail:jr7oetx1mqug9'}).url).pathname.endsWith('/232767')));
await test('General Mills label is distinguishable from ordinary Holofoil',()=>assert.match(pony.variants.find(v=>v.productId===232767).label,/General Mills/));
await test('Snorlax date is honestly stale, not a finish-price mismatch',()=>assert(quoteIsStale(presentationQuote('ptcg',snorlax,'holofoil'),Date.parse('2026-10-19T00:00:00Z'))));
await test('Snorlax source-confirmed Cosmos has bounded approximate art preview',()=>{const m=resolveFinish('ptcg',snorlax,{priceFinish:'holofoil'});assert.equal(m.status,'approximate');assert.equal(m.layers[0].mask,'pk-swsh-art');assert.equal(finishMaterialProfile('ptcg',snorlax,m),'cosmos-holo');});
await test('Unknown patterns keep the measured window and the era foil, never a borrowed sheet',()=>{const c=structuredClone(snorlax);c.variants[0].foil='future-unreviewed-pattern';const plain=structuredClone(snorlax);plain.variants[0].foil='';const a=resolveFinish('ptcg',c,{priceFinish:'holofoil'}),b=resolveFinish('ptcg',plain,{priceFinish:'holofoil'});assert.equal(a.status,'approximate');assert.deepEqual(a.layers,b.layers);assert.equal(a.treatment,b.treatment);assert.notEqual(a.treatment,'ptcg-cosmos');});
await test('No availability means no fabricated Snorlax holo',()=>assert.deepEqual(finishChoices('ptcg',{...snorlax,variants:[]}),[]));
await test('Later second Holofoil quote cannot overwrite Ponyta Cosmos saved identity',()=>{const raw=fixture('SWSH013');raw.variants_detailed[1].pricing.tcgplayer={holofoil:{productId:232767,marketPrice:12.34}};const v=pokemonVariants(raw);assert.equal(v.length,2);assert.deepEqual(v.map(x=>[x.key,x.productId]),[['holofoil',206430],['detail:jr7oetx1mqug9',232767]]);assert.equal(v.find(x=>x.productId===232767).usd,12.34);});
await test('Wrong-product patterned quote is rejected',()=>{const raw=fixture('SWSH013');raw.variants_detailed[0].pricing.tcgplayer.holofoil.productId=232767;assert.equal(pokemonVariants(raw).find(v=>v.foil==='cosmos').usd,null);});
for(const id of ['SWSH023','SWSH132','SWSH206'])await test(id+' stamped real variants do not gain a selectable generic duplicate',()=>{const c=normalizePtcg(fixture(id)),visible=c.variants.filter(v=>!v.aliasOf);assert.equal(visible.length,2);assert.equal(finishChoices('ptcg',c).length,2);});
await test('Cosmos with an exact Holofoil product bucket is condition-mapped',()=>assert.deepEqual(pokemonConditionPrintings(fixture('SWSH032').variants_detailed[0]),['Holofoil']));
await test('Unknown patterned condition mapping remains unavailable',()=>{const raw=fixture('SWSH032').variants_detailed[0];raw.foil='future-unreviewed-pattern';assert.deepEqual(pokemonConditionPrintings(raw),[]);});
await test('Exact secondary product fill changes neither Cosmos quote nor saved keys',()=>{const c=structuredClone(pony);const before=c.variants.map(v=>[v.key,v.productId]);assert(applyProductPrices(c,{cardId:c.id,quotes:[{productId:232767,subTypeName:'Holofoil',marketPrice:12.34}]}));assert.deepEqual(c.variants.map(v=>[v.key,v.productId]),before);assert.equal(c.variants[0].usd,pony.variants[0].usd);assert.equal(c.variants[1].usd,12.34);});
await test('Partial main-set pricing still probes verified supplemental group',async()=>{const old=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};const urls=[];try{const body=await(await pokemonPriceRoute(new URL('https://fixture.test/api/prices/pokemon?id=swshp-SWSH013'),null,async u=>{urls.push(u);if(u.includes('tcgdex'))return Response.json(fixture('SWSH013'));if(u.endsWith('/groups'))return Response.json({results:[{groupId:2545,name:'SWSH: Sword & Shield Promo Cards'},{groupId:2374,name:'Miscellaneous Cards & Products'}]});if(u.includes('/2545/'))return Response.json({results:[{productId:206430,subTypeName:'Holofoil',marketPrice:1.23}]});if(u.includes('/2374/'))return Response.json({results:[{productId:232767,subTypeName:'Holofoil',marketPrice:12.34},{productId:999999,subTypeName:'Holofoil',marketPrice:999}]});throw Error('Unexpected '+u);})).json();assert.deepEqual(body.quotes.map(v=>v.productId).sort(),[206430,232767]);assert(urls.some(u=>u.includes('/2374/')));assert(!body.quotes.some(v=>v.productId===999999));}finally{globalThis.caches=old;}});
const bell=normalizePtcg(fixture('swsh3-161'));
await test('Familiar Bell exact Normal and Reverse Holo remain separate',()=>assert.deepEqual(bell.variants.map(v=>[v.key,v.productId]),[['normal',219273],['reverse-holofoil',219273]]));
await test('Familiar Bell normal remains paper',()=>assert.equal(resolveFinish('ptcg',bell,{priceFinish:'normal'}).effect,'plain'));
await test('Familiar Bell reverse uses reviewed Trainer field rather than Pokémon mask',()=>{const p=resolveFinish('ptcg',bell,{priceFinish:'reverse-holofoil'});assert.equal(p.status,'approximate');assert(p.layers.every(x=>x.mask!=='pk-swsh-surround'&&x.mask!=='pk-swsh-art'&&x.mask!=='card'));assert(p.layers.some(x=>/trainer/.test(x.mask)));});

await test('Ponyta quote order, source quote disappearance and root outage retain exact keys',()=>{
 for(const reverse of [false,true])for(const root of [true,false])for(const priced of [true,false]){
  const raw=fixture('SWSH013');if(priced)raw.variants_detailed[1].pricing.tcgplayer={holofoil:{productId:232767,marketPrice:12.34}};
  if(!root)raw.pricing.tcgplayer=null;if(reverse)raw.variants_detailed.reverse();
  const v=pokemonVariants(raw);assert.equal(v.find(x=>x.key==='holofoil').productId,206430);assert.equal(v.find(x=>x.key==='detail:jr7oetx1mqug9').productId,232767);
 }
});
await test('A changed primary source bucket cannot move the reviewed saved key',()=>{
 const raw=fixture('SWSH013');raw.pricing.tcgplayer.holofoil={productId:232767,marketPrice:12.34};
 assert.equal(pokemonVariants(raw).find(v=>v.key==='holofoil').productId,206430);
});
await test('All seven reviewed Cosmos IDs use bounded material and exact standard art window',()=>{
 for(const id of REVIEWED_COSMOS_PROMOS){const c=normalizePtcg(fixture(id.split('-')[1])),v=c.variants.find(v=>v.foil==='cosmos'),m=resolveFinish('ptcg',c,{priceFinish:v.key});assert.equal(m.status,'approximate',id);assert.equal(m.layers[0].mask,'pk-swsh-art',id);assert.equal(finishMaterialProfile('ptcg',c,m),'cosmos-holo');}
});
await test('Promo and Trainer layouts show an approximate foil: the era window for promo Pokémon, the whole card for unmeasured Trainers',()=>{
 const pika=resolveFinish('ptcg',normalizePtcg(fixture('SWSH074')),{priceFinish:'holofoil'});assert.equal(pika.status,'approximate');assert.equal(pika.pattern,'cosmos');assert.match(pika.reason,/approximate/);
 const boss=resolveFinish('ptcg',normalizePtcg(fixture('SWSH251')),{priceFinish:'holofoil'});assert.equal(boss.status,'approximate');assert.equal(boss.coverage,'full');assert.deepEqual(boss.layers.map(l=>l.mask),['card']);assert.match(boss.reason,/whole-card approximate/);
 for(const changes of [{id:'swshp-unknown'},{category:'Trainer'},{set:{id:'swsh1'}}]){const p=resolveFinish('ptcg',{...snorlax,...changes},{priceFinish:'holofoil'});assert.equal(p.status,'approximate',JSON.stringify(changes));assert.match(p.reason,/approximate/,JSON.stringify(changes));}
});
await test('Cosmos and ordinary material never claim a shared generic preview',()=>assert.equal(resolveFinish('ptcg',pony).status,'unknown'));
await test('Familiar Bell reverse is explicitly partial and no artwork mask is used',()=>{
 const m=resolveFinish('ptcg',bell,{priceFinish:'reverse-holofoil'});assert.equal(m.coverage,'partial');assert.match(m.reason,/partial coverage/);assert.deepEqual(m.layers.map(l=>l.mask),['pk-swsh-trainer-field']);
});
for(const id of ['SWSH023','SWSH132','SWSH206'])await test(id+' saved generic alias reads exact canonical quote without an extra scanner choice',()=>{
 const c=normalizePtcg(fixture(id)),alias=c.variants.find(v=>v.aliasOf),canonical=pokemonVariantAliasTarget(c,alias);assert(canonical);assert.equal(pokemonVariantChoices(c).length,2);assert.equal(actualFinishes('ptcg',{card:c}).length,2);assert.equal(pokemonVariantChoices(c,alias.key).find(v=>v.productId===alias.productId).key,alias.key);
 assert.equal(resolveScanFinish('ptcg',{card:c},{finish:alias.key,finishConfirmed:true}),alias.key);assert.equal(presentationQuote('ptcg',c,alias.key).value,canonical.usd);assert.equal(referenceEntryPrice(c,{variant:alias.key,productId:alias.productId}),canonical.usd);
 assert.equal((tcgAddSheet(c).match(/<option value=/g)||[]).length>0,true);
 const before=JSON.stringify(c);const owned={id:'synthetic-legacy',cardId:c.id,variant:alias.key,productId:alias.productId,qty:1};const ownedBefore=JSON.stringify(owned);assert.equal(entryPrice(c,owned),canonical.usd);assert.equal(JSON.stringify(owned),ownedBefore);assert.equal(JSON.stringify(c),before);
 for(const v of [alias,canonical]){v.usd=null;v.market=null;}applyProductPrices(c,{cardId:c.id,quotes:[{productId:alias.productId,subTypeName:'Holofoil',marketPrice:12.34}]});assert.equal(alias.usd,12.34);assert.equal(canonical.usd,12.34);
});
await test('Legacy alias fallback synchronizes both names without changing either key',()=>{
 const c=normalizePtcg(fixture('SWSH023')),alias=c.variants.find(v=>v.aliasOf),target=pokemonVariantAliasTarget(c,alias),keys=c.variants.map(v=>v.key);alias.usd=target.usd=null;
 applyFallbackPrices(c,{tcgplayer:{prices:{holofoil:{market:12.34}}}});assert.equal(alias.usd,12.34);assert.equal(target.usd,12.34);assert.deepEqual(c.variants.map(v=>v.key),keys);
});
await test('Same-product different edition never creates an ordinary alias',()=>{
 for(const change of [{stamp:['1st-edition']},{subtype:'unlimited'},{subtype:'shadowless'},{size:'jumbo'},{stamp:['unreviewed']},{foil:'unreviewed'}]){
  const raw={id:'unreviewed',variants_detailed:[{variantId:'edition',type:'holo',...change,thirdParty:{tcgplayer:1},pricing:{tcgplayer:{'1st-edition-holofoil':{productId:1,marketPrice:10}}}}],pricing:{tcgplayer:{holofoil:{productId:1,marketPrice:3}}}};
  const variants=pokemonVariants(raw);assert(!variants.some(v=>v.aliasOf));assert.notEqual(variants.find(v=>v.key==='holofoil').usd,10);if(!change.foil)assert.equal(variants.find(v=>v.key==='holofoil').usd,3);
 }
});
await test('Reviewed alias proof rejects mutated size, stamp, subtype and material',()=>{
 for(const change of [{size:'jumbo'},{stamp:['staff']},{subtype:'shadowless'},{foil:'cosmos'}]){const raw=fixture('SWSH023');Object.assign(raw.variants_detailed[0],change);assert(!pokemonVariants(raw).some(v=>v.aliasOf));}
});
await test('Unknown duplicate detail identity is unconfirmed rather than last quote wins',()=>{
 const raw={variants_detailed:[{variantId:'same',type:'holo',thirdParty:{tcgplayer:1}},{variantId:'same',type:'holo',thirdParty:{tcgplayer:1},stamp:['staff']}]};const v=pokemonVariants(raw);assert(v.every(v=>v.usd===null));assert(v.some(v=>/unconfirmed/.test(v.label)));
});
await test('Old mismatched saved product fails reference, condition, preview and seller closed',()=>{
 const e={id:'synthetic-conflict',cardId:pony.id,variant:'holofoil',productId:232767,qty:1,condition:'Near Mint'},before=JSON.stringify(e),ctx={priceFinish:e.variant,savedVariant:e.variant,savedProductId:e.productId};
 assert(pokemonVariantProductConflict(pony,e));assert.equal(entryPrice(pony,e),null);assert.equal(referenceEntryPrice(pony,e),null);assert.equal(conditionRequest(pony,e,'ptcg'),null);assert.equal(conditionBuyLink('ptcg',pony,e).direct,false);assert.equal(quoteForContext('ptcg',pony,ctx).value,null);assert.equal(quoteForContext('ptcg',pony,ctx).selectionVerified,false);assert.equal(resolveFinish('ptcg',pony,ctx).status,'unknown');assert.equal(sellerModels('ptcg',pony,ctx)[0].direct,false);assert.equal(JSON.stringify(e),before);
 const manual={...e,manualValue:7.89,manualValueCondition:'Near Mint'};assert.equal(entryPrice(pony,manual),7.89);assert.equal(JSON.stringify(e),before);
});
await test('Conflicted owned badge does not show cached sibling condition estimate; manual survives',()=>{
 const old=S.state;try{S.state=blank();S.state.settings.game='ptcg';S.state.tcg||={};S.state.tcg.ptcg={collection:[],wishlist:[],decks:[]};cache.ptcg[pony.id]=pony;
 const e={id:'synthetic-conflict-badge',name:pony.name,cardId:pony.id,variant:'holofoil',productId:232767,qty:1,condition:'Near Mint',language:'en'};e.conditionQuotes=[{cardId:pony.id,variant:e.variant,language:'en',condition:'Near Mint',price:999,currency:'USD',source:'synthetic-sibling',validUntil:new Date(Date.now()+86400000).toISOString()}];S.state.tcg.ptcg.collection=[e];
 const before=JSON.stringify(e),html=tcgCollection();assert(!html.includes('synthetic-sibling'));assert(!html.includes('$999'));assert(html.includes('Saved product identity mismatch'));assert.equal(JSON.stringify(e),before);
 e.manualValue=7.89;e.manualValueCondition='Near Mint';const manualHtml=tcgCollection();assert(manualHtml.includes('Your value for this condition'));assert(manualHtml.includes('$7.89'));
 }finally{S.state=old;delete cache.ptcg[pony.id];}
});
await test('Valid detailed product, absent old product and deliberate browse switch remain distinct',()=>{
 const e={cardId:pony.id,variant:'detail:jr7oetx1mqug9',productId:232767};assert(!pokemonVariantProductConflict(pony,e));assert.match(conditionRequest(pony,e,'ptcg'),/productId=232767/);assert.equal(entryPrice(pony,{variant:'holofoil'}),pony.variants[0].usd);
 const c=quoteForContext('ptcg',pony,{savedVariant:'holofoil',savedProductId:232767,priceFinish:e.variant});assert.equal(c.variant.productId,232767);assert.equal(c.value,null);
});
await test('Explicit and inferred product condition requests share identity without lot writes',()=>{
 const e={cardId:pony.id,variant:'holofoil'},before=JSON.stringify(e);assert.equal(conditionRequest(pony,e,'ptcg'),conditionRequest(pony,{...e,productId:206430},'ptcg'));assert.equal(JSON.stringify(e),before);assert.equal(conditionRequest(pony,{...e,variant:'missing'},'ptcg'),null);assert.equal(conditionRequest({...pony,variants:[pony.variants[0],{...pony.variants[0],productId:232767}]},e,'ptcg'),null);
});
await test('Unknown explicit finish never silently becomes the card reference quote',()=>{
 assert.equal(selectedFinish('ptcg',pony,'unknown-key'),'unknown-key');assert.equal(quoteForContext('ptcg',pony,{priceFinish:'unknown-key'}).value,null);assert.equal(quoteForContext('ptcg',pony,{priceFinish:'unknown-key'}).selectionVerified,false);assert.equal(quoteForContext('ptcg',pony,{priceFinish:'unknown-key'}).cardReferenceValue,null);assert.equal(sellerModels('ptcg',pony,{priceFinish:'unknown-key'})[0].direct,false);
});
await test('History product lookup preserves root identity and first/unlimited edition',()=>{
 assert.equal(ptcgProduct(fixture('SWSH013'),'holofoil').productId,206430);assert.equal(ptcgProduct(fixture('SWSH013'),'detail:jr7oetx1mqug9').productId,232767);assert.equal(ptcgProduct(fixture('SWSH013'),'holofoil',232767),null);
 for(const [key,change,subtype] of [['1st-edition-holofoil',{stamp:['1st-edition']},'1st Edition Holofoil'],['unlimited-holofoil',{subtype:'unlimited'},'Unlimited Holofoil']]){
  const raw={variants_detailed:[{variantId:'edition',type:'holo',...change,thirdParty:{tcgplayer:1},pricing:{tcgplayer:{[key]:{productId:1,marketPrice:10}}}}],pricing:{tcgplayer:{[key]:{productId:1,marketPrice:10}}}};assert.equal(ptcgProduct(raw,key).subtype,subtype);assert.equal(ptcgProduct(raw,key).finishKey,key);
 }
});
await test('Server condition lookup maps exact products only and refuses mismatch before cache/provider',async()=>{
 const old=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};const requests=[];
 const env={JUSTTCG_API_KEY:'synthetic-not-a-key',CONDITION_PRICES:{idFromName:()=>1,get:()=>({fetch:async u=>{requests.push(u);return Response.json({status:'available',data:[]});}})}};
 const get=async u=>{assert(u.includes('api.tcgdex.net'));return Response.json(fixture('SWSH013'));};
 try{for(const [variant,pid,want] of [['holofoil',206430,206430],['detail:jr7oetx1mqug9',232767,232767],['holofoil',232767,null]]){
  requests.length=0;const body=await(await conditionFeedRoute(new URL('https://fixture.test/api/prices/conditions?'+new URLSearchParams({game:'ptcg',id:pony.id,variant,productId:pid})),env,null,get)).json();if(want){assert.equal(body.productId,want);assert(requests.every(u=>u.includes('product='+want+'&')));}else {assert.equal(body.status,'unmapped');assert.equal(requests.length,0);}
 }}finally{globalThis.caches=old;}
});
await test('Edition-bearing or unusual Cosmos condition metadata stays unmapped',()=>{for(const change of [{stamp:['1st-edition']},{stamp:['unknown']},{subtype:'unlimited'},{subtype:'shadowless'},{size:'jumbo'}])assert.deepEqual(pokemonConditionPrintings({...fixture('SWSH032').variants_detailed[0],...change}),[]);});
await test('Rowlet unpriced Cosmos condition mapping requires exact card-product evidence',()=>{
 const raw=fixture('SWSH220'),v=raw.variants_detailed.find(v=>v.foil==='cosmos');assert.deepEqual(pokemonConditionPrintings(v,{cardId:raw.id}),['Holofoil']);assert.deepEqual(pokemonConditionPrintings(v,{cardId:'unknown'}),[]);
});
await test('Supplemental failure preserves exact main quotes and avoids unrelated products',async()=>{
 const old=globalThis.caches;globalThis.caches={default:{match:async()=>null,put:async()=>{}}};try{const body=await(await pokemonPriceRoute(new URL('https://fixture.test/api/prices/pokemon?id=swshp-SWSH013'),null,async u=>{
  if(u.includes('tcgdex'))return Response.json(fixture('SWSH013'));if(u.endsWith('/groups'))return Response.json({results:[{groupId:2545,name:'SWSH: Sword & Shield Promo Cards'},{groupId:2374,name:'Miscellaneous Cards & Products'}]});if(u.includes('/2545/'))return Response.json({results:[{productId:206430,subTypeName:'Holofoil',marketPrice:1.23}]});if(u.includes('/2374/'))return new Response('',{status:503});throw Error('Unexpected fixture URL');
 })).json();assert.deepEqual(body.quotes.map(q=>q.productId),[206430]);}finally{globalThis.caches=old;}
});
const cards=readdirSync(new URL('./tests/fixtures/pokemon-promos/',import.meta.url)).filter(f=>/^(SWSH\d+|swsh3-161)\.json$/.test(f)).map(f=>normalizePtcg(fixture(f.slice(0,-5))));
assert.equal(cards.length,17,'Bounded representative real-card matrix');
const matrix=cards.map(c=>({id:c.id,name:c.name,variants:c.variants.map(v=>({key:v.key,label:v.label,productId:v.productId??null,usd:v.usd,foil:v.foil||'',aliasOf:v.aliasOf||'',preview:resolveFinish('ptcg',c,{priceFinish:v.key}).status,mask:resolveFinish('ptcg',c,{priceFinish:v.key}).layers[0]?.mask||null}))}));
await test('All seventeen public card fixtures preserve source products and exact quote amounts',()=>{
 for(const card of cards){assert.equal(new Set(card.variants.map(v=>v.key)).size,card.variants.length,card.id);const raw=fixture(card.id==='swsh3-161'?'swsh3-161':card.id.split('-')[1]);const quoted=[...Object.values(raw.pricing?.tcgplayer||{}),...(raw.variants_detailed||[]).flatMap(v=>Object.values(v.pricing?.tcgplayer||{}))].filter(q=>q&&typeof q==='object');for(const v of card.variants.filter(v=>v.usd!=null))assert(quoted.some(q=>String(q.productId)===String(v.productId)&&q.marketPrice===v.usd),card.id+' '+v.key);}
});
await test('Public fixture bytes match manifest hashes without external requests',()=>{
 const manifest=JSON.parse(readFileSync(new URL('./tests/fixtures/pokemon-promos/sources.json',import.meta.url)));for(const source of manifest){assert.equal(source.public,true);assert.equal(createHash('sha256').update(readFileSync(new URL('./tests/fixtures/pokemon-promos/'+path.basename(source.file),import.meta.url))).digest('hex'),source.sha256);}
});
for(const r of checks)console.log(r.status+': '+r.name+(r.reason?'\n'+r.reason:''));
console.log(`${checks.filter(x=>x.status==='PASS').length} passed, ${checks.filter(x=>x.status==='FAIL').length} failed`);
process.exitCode=checks.some(x=>x.status==='FAIL')?1:0;
