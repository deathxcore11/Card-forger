// Node-only provider-contract and error-event tests. No browser or local server.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pokemonProductId, pickGroup, pickProduct, pokemonArtRoute} from './pokemon-art.js';
import {artworkSources, handleArtworkError} from './artwork.js';
import {cardImage, img, magicArtworkSources} from './ui.js';
import {normalizeYgo} from './ygo.js';
import {variantArtwork, variantArtSources, variantArtThumb} from './tcg.js';
const sample=JSON.parse(fs.readFileSync(new URL('./test-fixtures/card-artwork-provider-samples.json',import.meta.url)));

// The user's Noivern Trainer Kit cards have no scan and no detailed product,
// yet their own legacy pricing contains four different, exact product IDs.
for(const [i,card] of sample.pokemon.entries()){
  assert.equal(card.image,undefined);
  assert.equal(card.variants_detailed.some(v=>v.thirdParty?.tcgplayer),false);
  let calls=0;
  assert.equal(await pokemonProductId(card.id,async url=>{calls++;assert.equal(url,`https://api.tcgdex.net/v2/en/cards/${card.id}`);return card;}),98000+i);
  assert.equal(calls,1,'known product does not search a generic Energy catalogue');
  assert.equal(pickGroup(sample.groups,card.set.name).groupId,1532);
  assert.equal(pickProduct(sample.products,card)?.productId,98000+i);
  const withoutPricing={...card,pricing:undefined};
  assert.equal(await pokemonProductId(card.id,async()=>withoutPricing),98000+i,'provider card-level ID works without market prices');
  const withoutProduct={...withoutPricing,thirdParty:undefined};
  const lookup=async url=>url.includes('/cards/')?withoutProduct:url.endsWith('/groups')?{results:sample.groups}:{results:sample.products};
  assert.equal(await pokemonProductId(card.id,lookup),98000+i,'verified numbered suffix works when no direct ID exists');
}
const first=sample.pokemon[0],product=sample.products[0];
assert.equal(pickProduct([{...product,name:'Psychic Energy (#6)'}],first),null,'annotation cannot contradict Number');
assert.equal(pickProduct([{...product,name:'Fairy Energy (#5)'}],first),null,'never substitute another Energy type');
assert.equal(pickProduct([{...product,name:'Psychic Energy V (#5)'}],first),null,'identity suffixes are not removed');
assert.equal(pickProduct([product,{...product,productId:123}],first),null,'duplicate candidates remain ambiguous');
assert.equal(pickProduct(sample.products,{...first,localId:'9'}),null,'never reuse the next collector number');
assert.equal(await pokemonProductId(first.id,async()=>({...first,id:'tk-xy-s-5'})),null,'provider must return the requested printing');
const variants=[{type:'holo',thirdParty:{tcgplayer:111}},{type:'holo',thirdParty:{tcgplayer:222}}];
let ambiguityCalls=0;
assert.equal(await pokemonProductId(first.id,async()=>{ambiguityCalls++;return {...first,variants_detailed:variants};}),null,'ambiguous detailed variants never fall through to a price or a name guess');
assert.equal(ambiguityCalls,1);
assert.equal(await pokemonProductId(first.id,async()=>({...first,variants_detailed:[{type:'reverse',stamp:['anniversary'],thirdParty:{tcgplayer:111}},{type:'normal',thirdParty:{tcgplayer:222}}]})),222,'plain exact reference wins, not first stamped entry');

// Versioned client URLs avoid an old one-day cached miss. The fixed proxy still
// fetches only a numeric product on its fixed official image host.
assert.equal(artworkSources({game:'ptcg',id:first.id})[0],`img/ptcg/s/${first.id}.jpg?v=2`);
const originalCaches=globalThis.caches,stored=new Map(),jobs=[],network=[];
const cacheKey=x=>typeof x==='string'?x:x.url;
globalThis.caches={default:{match:async x=>stored.get(cacheKey(x))?.clone(),put:async(x,response)=>{stored.set(cacheKey(x),response.clone());}}};
const fetcher=async(url)=>{network.push(String(url));if(String(url).startsWith('https://api.tcgdex.net/'))return Response.json(first);return new Response(new Uint8Array([255,216,255,217]),{headers:{'Content-Type':'image/jpeg'}});};
try{
  const old=new Request(`https://cardstashy.test/img/ptcg/s/${first.id}.jpg`);
  stored.set(old.url,new Response('No artwork',{status:404}));
  const request=new Request(old.url+'?v=2');
  const response=await pokemonArtRoute(request,new URL(request.url),{waitUntil:job=>jobs.push(job)},fetcher);
  assert.equal(response.status,200);assert.equal(response.headers.get('X-Art-Source'),'TCGplayer');
  assert.deepEqual(network,[`https://api.tcgdex.net/v2/en/cards/${first.id}`,'https://tcgplayer-cdn.tcgplayer.com/product/98000_400w.jpg']);
  await Promise.all(jobs);
  assert.equal((await pokemonArtRoute(request,new URL(request.url),null,fetcher)).status,200);
  assert.equal(network.length,2,'successful image is cached');
  const before=network.length,bad=new Request('https://cardstashy.test/img/ptcg/s/a%2Fb.jpg');
  assert.equal((await pokemonArtRoute(bad,new URL(bad.url),null,fetcher)).status,400);
  assert.equal(network.length,before,'invalid ID cannot influence an upstream path');
}finally{globalThis.caches=originalCaches;}

// All nine real Dark Magician source scans retain their exact image ID, even
// after proxy or size failure. Rarity/edition metadata never selects an image.
const ygo=normalizeYgo(sample.ygo);
assert.equal(ygo.artworks.length,9);
for(const variant of ygo.artworks){
  for(const large of [false,true]){
    const urls=variantArtSources(ygo,variant,large);
    assert.ok(urls.length>=3);
    assert.ok(urls.every(url=>url.endsWith(`/${variant.id}.jpg`)),`only selected artwork ${variant.id}`);
    assert.deepEqual(variantArtSources({...ygo,rarity:'Secret Rare',edition:'1st-edition'},variant,large),urls);
  }
}
const alternate=ygo.artworks[1],thumb=variantArtThumb(ygo,alternate);
assert.doesNotMatch(thumb,/img\/ygo\/s\/46986414[.]jpg/,'alternate thumbnail cannot silently become the default artwork');
assert.deepEqual(variantArtSources({game:'ptcg',id:'base1-4',image:'https://fixture.test/base.jpg'},{image:'https://fixture.test/stamped.jpg',imageLarge:'https://fixture.test/stamped-large.jpg'}),['https://fixture.test/stamped.jpg','https://fixture.test/stamped-large.jpg']);
assert.equal(variantArtwork(ygo,{imageLarge:'https://fixture.test/only-large.jpg'}).exact,true);
assert.deepEqual(variantArtSources(ygo,{image:'https://fixture.test/unmapped-art.jpg'}),['https://fixture.test/unmapped-art.jpg'],'an unmapped artwork does not inherit the base ID');
assert.deepEqual(artworkSources({game:'ygo',id:'not-a-provider-id'}),[],'invalid IDs never produce guessed provider requests');

// MTG source-shaped fixtures are synthetic. Live Scryfall was unavailable in
// this audit, so these prove source/face handling, not live image availability.
const face=(which)=>Object.fromEntries(['normal','large','png','small','art_crop'].map(size=>[size,`https://fixture.test/exact-print/${which}/${size}.jpg`]));
const magic={id:'exact-print',card_faces:[{name:'Front',image_uris:face('front')},{name:'Back',image_uris:face('back')}],prices:{usd:'3'}};
for(const index of [0,1]){
  const urls=magicArtworkSources(magic,'normal',index);
  assert.equal(urls.length,4);assert.ok(urls.every(url=>url.includes(index?'/back/':'/front/')));
  assert.ok(urls.every(url=>!url.includes('art_crop')),'full card fallback never becomes a crop');
  const markup=img(cardImage(magic,'normal',index),magic.card_faces[index].name,'card-img');
  assert.match(markup,/data-art-sources=/);assert.doesNotMatch(markup,/onerror=/);
}
assert.equal(cardImage({image_uris:{large:'https://fixture.test/only-large.jpg'}}),'https://fixture.test/only-large.jpg','missing normal size uses another supplied size');
assert.deepEqual(magicArtworkSources({...magic,card_faces:[{},magic.card_faces[1]]}),[],'missing front never flips to the back');
assert.deepEqual(magicArtworkSources({...magic,image_uris:{normal:'https://fixture.test/top-level.jpg'}}),['https://fixture.test/top-level.jpg'],'split/adventure shared front does not borrow a second face');
assert.deepEqual(artworkSources(magic),magicArtworkSources(magic));

// Exercise the production event handler through every source, then repeated
// late failures. One finite chain and one honest placeholder for every game.
for(const urls of [artworkSources({game:'ptcg',id:first.id,image:'https://fixture.test/broken.webp'}),variantArtSources(ygo,alternate),magicArtworkSources(magic),magicArtworkSources(magic,'normal',1)]){
  let placeholders=0;
  const image={src:urls[0],dataset:{artSources:JSON.stringify(urls),artIndex:'0'},className:'card-img',insertAdjacentHTML(){placeholders++;}};
  for(let i=1;i<urls.length;i++){handleArtworkError({target:image});assert.equal(image.src,urls[i]);assert.equal(placeholders,0);}
  handleArtworkError({target:image});assert.equal(image.hidden,true);assert.equal(placeholders,1);
  handleArtworkError({target:image});assert.equal(placeholders,1,'repeated errors never duplicate the placeholder');
}
console.log('PASS: exact legacy Pokémon products and numbered titles, safe cached proxy, all nine source YGO scans, no variant substitution, same-face MTG size recovery, and finite all-game artwork exhaustion.');

// The viewer gets the recovered on-screen source and a bounded exact chain.
// Fake DOM exposes browser-absolute img.src so relative fallback loops reproduce.
const {openZoom,zoomCardOptions,zoomSources}=await import('./zoom.js');
const base='https://cardstashy.test/';
assert.deepEqual(zoomSources(['img/ygo/s/2.jpg',base+'img/ygo/s/2.jpg','javascript:evil()'],base),[base+'img/ygo/s/2.jpg']);
const recovered={complete:true,naturalWidth:100,currentSrc:'https://fixture.test/back/large.jpg',dataset:{artSources:JSON.stringify(['https://fixture.test/back/normal.jpg','https://fixture.test/back/large.jpg'])}};
const options=zoomCardOptions({dataset:{src:'https://fixture.test/back/normal.jpg',hi:'https://fixture.test/back/png.png',name:'Back'},querySelector:()=>recovered});
assert.equal(options.src,recovered.currentSrc);assert.equal(options.sources.length,2);
const previousDocument=globalThis.document,previousImage=globalThis.Image,prefetches=[];
const node=()=>({dataset:{},style:{},listeners:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(name,fn){this.listeners[name]=fn;},getBoundingClientRect(){return {width:300,height:400,left:0,top:0};}});
let fake;
globalThis.document={baseURI:base,documentElement:node(),body:{append(d){d.isConnected=true;}},createElement(){
 const dialog=node(),stage=node(),image=node(),resolution=node(),loaded=[];
 Object.defineProperty(image,'src',{get:()=>loaded.at(-1)||'',set:url=>loaded.push(new URL(url,base).href)});
 Object.assign(dialog,{isConnected:false,showModal(){},close(){},remove(){this.isConnected=false;},querySelector:selector=>selector==='.zoom-stage'?stage:selector==='.zoom-img'?image:resolution,querySelectorAll:()=>[]});
 fake={dialog,stage,image,resolution,loaded};return dialog;
}};
globalThis.Image=class{constructor(){prefetches.push(this);}};
try{
 const viewer=openZoom({src:'img/ygo/2.jpg',fallback:'img/ygo/s/2.jpg',sources:['img/ygo/2.jpg','img/ygo/s/2.jpg','https://images.ygoprodeck.com/images/cards_small/2.jpg'],art:'https://fixture.test/crop.jpg',hi:'https://images.ygoprodeck.com/images/cards/2.jpg'});
 for(let i=0;i<10;i++)fake.image.onerror();
 assert.deepEqual(fake.loaded,[base+'img/ygo/2.jpg',base+'img/ygo/s/2.jpg','https://images.ygoprodeck.com/images/cards_small/2.jpg','https://images.ygoprodeck.com/images/cards/2.jpg']);
 assert.equal(fake.image.hidden,true);assert.equal(fake.resolution.textContent,'Artwork unavailable');
 const oldPrefetch=prefetches[0];
 fake.dialog.listeners.click({target:{closest:()=>({dataset:{z:'view',i:'1'}})}});
 assert.equal(fake.image.src,'https://fixture.test/crop.jpg');
 oldPrefetch.onload();assert.equal(fake.image.src,'https://fixture.test/crop.jpg','old high-res completion cannot overwrite another view');
 viewer.close();assert.equal(fake.dialog.isConnected,false);
 oldPrefetch.onerror();assert.equal(fake.image.src,'https://fixture.test/crop.jpg','closed view ignores late completion');
 const back=openZoom(options);assert.equal(fake.image.src,recovered.currentSrc,'enlarging starts with the successful same-face image');back.close();
 // The real scanner result action must keep the whole same-art chain, too.
 const {registerScanner}=await import('./scancam.js');
 const {S}=await import('./store.js'); const oldScan=S.ui.scan, actions={};
 registerScanner({A:actions,C:{},game:()=> 'ygo'});
 try {
  S.ui.scan={cands:[{name:'Exact scan',card:{game:'ygo',id:'46986415',image:'img/ygo/s/46986415.jpg',imageLarge:'img/ygo/46986415.jpg'}}]};
  actions.scanZoom({dataset:{i:'0'}});
  for(let i=0;i<6;i++)fake.image.onerror();
  assert.deepEqual(fake.loaded,[base+'img/ygo/46986415.jpg',base+'img/ygo/s/46986415.jpg','https://images.ygoprodeck.com/images/cards/46986415.jpg','https://images.ygoprodeck.com/images/cards_small/46986415.jpg'],'scanner zoom tries every source for the exact selected scan, never base-card art');
  assert.equal(fake.resolution.textContent,'Artwork unavailable');
  fake.dialog.listeners.close();
 } finally { S.ui.scan=oldScan; }

}finally{globalThis.document=previousDocument;globalThis.Image=previousImage;}
console.log('PASS: recovered image zoom, canonical relative URL deduplication, bounded exhaustion and stale high-resolution view/close isolation.');
