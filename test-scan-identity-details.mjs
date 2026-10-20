import {POKEMON_VARIANT_SCHEMA} from './pokemon-variant-options.js';
import assert from 'node:assert/strict';
import {ptcgSource} from './ptcg.js';
import {registerTcg,cache,SOURCES,needsCardRefresh} from './tcg.js';
import {S,blank} from './store.js';

S.state=blank();
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.document={querySelector:()=>null};
const denyFetch=async()=>{throw Error('Unexpected external request in scanner identity fixture');},requests=[];
const raw={id:'swsh8-101',name:'Vikavolt',localId:'101',category:'Pokemon',hp:150,stage:'Stage2',image:'https://assets.tcgdex.net/en/swsh/swsh8/101',set:{id:'swsh8',name:'Fusion Strike',cardCount:{official:264}},attacks:[{name:'Electro Blaster'}],variants:{normal:true,reverse:true}};
globalThis.fetch=async url=>{requests.push(String(url));return {ok:true,json:async()=>String(url).includes('/cards/swsh8-101')?raw:{data:[]}};};
const detail=await ptcgSource.get('swsh8-101',{prices:false});
assert.equal(requests.length,1);assert.equal(detail.hp,150);assert.equal(detail.variants.length,2);assert.equal(detail.priceFallbackSchema,0);assert.equal(needsCardRefresh('ptcg',detail,true),true);
requests.length=0;await ptcgSource.get('swsh8-101');assert(requests.some(url=>url.includes('api/prices/pokemon')),'normal requests still run the existing quote path');

const context={A:{},C:{},I:{},render(){},openSheet(){},closeSheet(){},toast(){},writeRecord:async()=>{},go(){},busy:()=>()=>{}};
registerTcg(context);
for(const game of ['ptcg','ygo']){
  const original=SOURCES[game].get,id='identity-only-'+game;
  const metadata={...detail,id,game,name:'Metadata card',fetchedAt:new Date().toISOString(),...(game==='ptcg'?{variantSchema:POKEMON_VARIANT_SCHEMA,priceFallbackSchema:0}:{artSchema:1})};
  const calls=[];SOURCES[game].get=async(key,options)=>{calls.push(options);return {...metadata,...(options.prices===false?{}:game==='ptcg'?{priceFallbackSchema:3}:{printPriceSchema:1})};};
  try{
    delete cache[game][id];
    const candidate=await context.scanCandById(game,id,'fixture',true,{identityOnly:true});
    assert.deepEqual(calls[0],{printings:false,prices:false});assert.equal(candidate.detailsOnly,true);assert.equal(candidate.priceReady,false);assert.equal(cache[game][id],undefined,'identity-only lookup does not poison normal cache');
    const full=await context.scanCandById(game,id,'fixture',true);
    assert.equal(calls.length,2,'review/save performs full lookup rather than reusing incomplete price work');assert.deepEqual(calls[1],{printings:true});assert.equal(full.detailsOnly,false);assert.equal(full.priceReady,true);assert(cache[game][id]);
    const warm=await context.scanCandById(game,id,'fixture',true,{identityOnly:true});assert.equal(calls.length,2,'a fresh complete card may be safely reused');assert.equal(warm.detailsOnly,false);
  }finally{SOURCES[game].get=original;delete cache[game][id];}
}
// Cold automatic remote matching is also metadata-only, not merely the local
// catalogue hydration branch. No provider price endpoint is permitted here.
for(const game of ['ptcg','ygo']){
  const source=SOURCES[game],original={get:source.get,byNameNumber:source.byNameNumber,search:source.search,byName:source.byName};
  const id=game==='ptcg'?'swsh8-101':'46986414',name=game==='ptcg'?'Vikavolt':'Dark Magician',code=game==='ptcg'?'101/264':'LOB-EN005';
  const metadata=game==='ptcg'?{...detail,id,name,game}:{id,name,game,sets:[{code,rarity:'Ultra Rare',name:'Legend of Blue Eyes White Dragon'}],artSchema:1,fetchedAt:new Date().toISOString()};
  const calls=[],urls=[];delete cache[game][id];
  source.get=async(key,options)=>{calls.push(options);return metadata;};
  source.byNameNumber=async()=>[{id}];source.search=async()=>({cards:[]});source.byName=async()=>metadata;
  globalThis.fetch=async url=>{urls.push(String(url));assert(String(url).includes('cardsetsinfo.php'),'automatic matching never requests price enrichment');return {ok:true,json:async()=>({id,set_code:code,set_rarity:'Ultra Rare'})};};
  try{
    const found=await context.scanMatch({name,code},'eng',false,()=>{},game);
    assert(found.cands.length);assert(found.cands.every(c=>c.detailsOnly&&c.priceReady===false));
    assert.equal(calls.length,1);assert.deepEqual(calls[0],{printings:false,prices:false});assert.equal(cache[game][id],undefined);
    assert.equal(urls.length,game==='ygo'?1:0);
  }finally{Object.assign(source,original);delete cache[game][id];}
}
globalThis.fetch=denyFetch;
console.log('PASS: scanner identity-only hydration retains authoritative stats/variants, skips quote enrichment, never marks shared price cache fresh, and full review/save still resolves prices.');
