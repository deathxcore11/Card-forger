import assert from 'node:assert/strict';
import {normalizePtcg,normalizePtcgBrief,plainText} from './ptcg.js';
import {pokemonCatalogueFallback,pokemonCatalogueOverlay,pokemonCatalogueSet} from './pokemon-catalogue-supplement.js';
import {printingRows} from './printing-picker.js';

// Literal provider markup, not a browser DOM stub: explicit labels survive both
// empty and nested icons. No label or URL guessing is used for unknown symbols.
for (const icon of [
 '<span class="energy-symbol Fire" title="Fire">Fire</span>',
 "<span title='Fire'><i class='glyph'></i></span>",
 '<span><span aria-label="Fire Energy"><svg></svg></span></span>',
 '<img alt="Fire" src="https://fixture.invalid/icon.png">',
 "<span class='energy-symbol Fire'></span>",
]) assert.equal(plainText('Discard a '+icon+' Energy card.'),'Discard a Fire Energy card.');
assert.equal(plainText('<img alt="Water"> and <span title="Lightning"><b>icon</b></span>'),'Water and Lightning');
assert.equal(plainText('Discard an Energy card.'),'Discard an Energy card.');
assert.equal(plainText('<img src="https://fixture.invalid/fire.png">'),'','URLs never supply rules semantics');

const broken='Discard a Energy card, a Energy card, and a Energy card attached to Lugia in order to use this attack.';
const corrected='Discard a Fire Energy card, a Water Energy card, and a Lightning Energy card attached to Lugia in order to use this attack.';
const lugia={id:'neo1-9',name:'Lugia',localId:'9',category:'Pokemon',set:{id:'neo1',name:'Neo Genesis',cardCount:{official:111}},attacks:[{name:'Elemental Blast',cost:['Fire','Water','Lightning'],damage:90,effect:broken}]};
const normalized=normalizePtcg(lugia);
assert.equal(normalized.variantSchema,12);
assert.equal(normalized.attacks[0].effect,corrected);
assert.equal(normalized.attacks[0].sourceEffect,broken);
assert.match(normalized.attacks[0].effectProvenance.url,/neo1\/9_hires\.png$/);
assert.match(normalized.attacks[0].effectProvenance.corroboratedBy,/lugia-neo-genesis-9-111$/);
assert(normalized.text.includes(corrected));
assert.equal(normalized.rulesIncomplete,false);
assert.equal(lugia.attacks[0].effect,broken,'raw input is never mutated');
for (const change of [{id:'neo1-10'},{name:'Other card'},{localId:'10'},{set:{id:'other'}},{attacks:[{...lugia.attacks[0],name:'Other attack'}]}]) {
 const other=normalizePtcg({...lugia,...change});
 assert.equal(other.attacks[0].effect,broken,'an exact correction never spreads to other printings/attacks');
 assert.equal(other.attacks[0].effectProvenance,undefined);
 assert.equal(other.rulesIncomplete,true);
 assert.match(other.text,/Rules text may be incomplete/);
}
const customText='Discard an Energy card attached to Lugia.';
assert.equal(normalizePtcg({...lugia,attacks:[{...lugia.attacks[0],effect:customText}]}).attacks[0].effect,customText,'a changed upstream effect is not overwritten');
assert.equal(normalizePtcg({...lugia,attacks:[{...lugia.attacks[0],effect:corrected}]}).attacks[0].effectProvenance,undefined,'already repaired upstream text remains authoritative');

const directBrief=normalizePtcgBrief({id:'30th-c-029',name:'Lugia',localId:'029'});
assert.equal(directBrief.set.id,'30th-c');assert.equal(directBrief.set.number,'029');
assert.equal(normalizePtcgBrief({id:'bad/../../9',name:'Unknown'}).set,null);
const providerBrief=normalizePtcgBrief({id:'opaque',name:'Lugia',localId:'009',set:{id:'neo1',name:'Neo Genesis',cardCount:{official:111},symbol:'verified-symbol'}});
assert.deepEqual([providerBrief.set.id,providerBrief.set.name,providerBrief.set.number,providerBrief.set.total],['neo1','Neo Genesis','009',111]);
assert.equal(providerBrief.set.symbol,'verified-symbol');

const fallback=pokemonCatalogueFallback('mee-013');
assert.equal(pokemonCatalogueSet({id:'mee',cardCount:{official:8,total:8}}).cardCount.total,16);
assert.equal(pokemonCatalogueSet({id:'mee',cardCount:{official:20,total:20}}).cardCount.total,20);
assert.equal(pokemonCatalogueOverlay([{...fallback,name:'Current authoritative name'}],c=>c.id==='mee-013')[0].name,'Current authoritative name');
assert.equal(pokemonCatalogueOverlay([],c=>c.id==='mee-013').length,1);

const baseEnergies=['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal'].map((type,i)=>({id:'mee-'+String(i+1).padStart(3,'0'),localId:String(i+1).padStart(3,'0'),name:'Basic '+type+' Energy',category:'Energy',energyType:'Normal',image:'https://fixture.invalid/'+type+'.png'}));
const lugiaBriefs=[{id:'neo1-9',localId:'9',name:'Lugia'},{id:'cel25-022',localId:'022',name:'Lugia'},{id:'30th-c-029',localId:'029',name:'Lugia'}];
const setList=[{id:'mee',name:'Mega Evolution Energy',cardCount:{official:8,total:8},releaseDate:'2025-09-25'},
 {id:'neo1',name:'Neo Genesis',cardCount:{official:111},releaseDate:'2000-12-16'},
 {id:'cel25',name:'Celebrations',cardCount:{official:25},releaseDate:'2021-10-08'},
 {id:'30th-c',name:'30th Celebration Classic',cardCount:{official:30},releaseDate:'2026-09-16'}];
const originalFetch=globalThis.fetch;
let upstreamSupplement=false,cardRequests=0,priceRequests=0;
const latest=()=>({...pokemonCatalogueFallback('mee-013'),image:'https://fixture.invalid/upstream-psychic.png',illustrator:'Upstream illustrator',catalogueProvenance:undefined,pricing:{tcgplayer:{normal:{marketPrice:4.25}}}});
const nameKey=s=>String(s).toLowerCase().replace(/^basic (?=(?:grass|fire|water|lightning|psychic|fighting|darkness|metal|fairy) energy$)/,'');
globalThis.fetch=async input=>{
 const u=new URL(input,'https://fixture.invalid'),path=u.pathname.replace('/v2/en','');
 if(path.includes('/prices/')){priceRequests++;throw Error('No price requests permitted in this fixture');}
 if(path==='/sets')return Response.json(setList);
 if(path==='/series')return Response.json([]);
 if(path==='/sets/mee')return Response.json({...setList[0],cards:[...baseEnergies,...(upstreamSupplement?[latest()]:[])]});
 if(path.startsWith('/cards/')){
  cardRequests++;
  const id=decodeURIComponent(path.slice(7));
  if(id==='mee-013'&&upstreamSupplement)return Response.json(latest());
  if(id.startsWith('mee-')&&Number(id.slice(4))>=9)return new Response('',{status:404});
  const energy=baseEnergies.find(c=>c.id===id);
  if(energy)return Response.json({...energy,set:setList[0],pricing:{tcgplayer:{normal:{marketPrice:0.1}}}});
  return new Response('',{status:404});
 }
 if(path==='/cards'){
  let rows=[...baseEnergies,...lugiaBriefs,...(upstreamSupplement?[latest()]:[])];
  const p=u.searchParams,query=p.get('name');
  if(query){const exact=query.startsWith('eq:'),value=nameKey(exact?query.slice(3):query);rows=rows.filter(c=>exact?nameKey(c.name)===value:nameKey(c.name).includes(value));}
  if(p.has('localId'))rows=rows.filter(c=>Number(c.localId)===Number(p.get('localId')));
  if(p.has('set.id'))rows=rows.filter(c=>c.id.slice(0,c.id.lastIndexOf('-'))===p.get('set.id'));
  if(p.has('category'))rows=rows.filter(c=>(c.category||'Pokemon')===p.get('category'));
  if(p.has('rarity'))rows=[];
  if(p.has('stage')||p.has('types')||p.has('hp'))rows=[];
  return Response.json(rows);
 }
 throw Error('Unexpected catalogue request: '+u);
};
try {
 const {ptcgSource:source}=await import('./ptcg.js?catalogue-regression=missing');
 const detail=await source.get('mee-013');
 assert.equal(detail.id,'mee-013');assert.equal(detail.set.total,16);assert.equal(detail.prices.usd,null);
 assert.equal(detail.variants[0].productId,713252);assert.deepEqual(detail.variants[0].stamps,['30th-anniversary']);
 assert(detail.catalogueProvenance);assert.equal(detail.basicEnergy,true);
 assert.equal((await source.byName('Basic Psychic Energy')).id,'mee-005','upstream matching printing keeps name-only priority');
 // The missing record can still be the only exact name match returned upstream.
 const baseFetch=globalThis.fetch;
 globalThis.fetch=async input=>new URL(input,'https://fixture.invalid').pathname.endsWith('/cards')?Response.json([]):baseFetch(input);
 assert.equal((await source.byName('Basic Psychic Energy')).id,'mee-013');
 assert.equal((await source.byName('Psychic Energy')).id,'mee-013');
 assert.equal(await source.byName('Telepathic Psychic Energy'),null);
 globalThis.fetch=baseFetch;
 for (const num of ['13','013']) assert((await source.byNameNumber('Psychic Energy',num)).some(c=>c.id==='mee-013'));
 assert(!(await source.byNameNumber('Psychic Energy','14')).some(c=>c.id==='mee-013'));
 const search=await source.search({q:'Psychic Energy'}),warm=await source.search({q:'Psychic Energy'});
 assert.deepEqual(warm,search,'cold/warm overlay results agree');
 assert.deepEqual(search.cards.map(c=>c.id),['mee-005','mee-013']);assert.equal(search.total,2);
 const supplemental=search.cards.find(c=>c.id==='mee-013');
 assert.equal(supplemental.set.name,'Mega Evolution Energy');assert.equal(supplemental.set.number,'013');assert.equal(supplemental.set.total,16);
 assert(supplemental.catalogueProvenance);assert.equal(supplemental.variants[0].productId,713252);assert.equal(supplemental.prices.usd,undefined);
 for(const spec of [{q:'Lugia'},{q:'Telepathic Psychic Energy'},{q:'Psychic Energy',set:'neo1'},{q:'Psychic Energy',category:'Trainer'},{q:'Psychic Energy',rarity:'Rare'},{q:'Psychic Energy',type:'Psychic'},{q:'Psychic Energy',stage:'Basic'},{q:'Psychic Energy',hp:'1'},{q:'Psychic Energy',number:'14'},{q:'Psychic Energy',format:'unknown-format'}]) {
  const result=await source.search(spec);assert(!result.cards.some(c=>c.id==='mee-013'),'supplement respects '+JSON.stringify(spec));
 }
 for(const format of ['standard','expanded','glc','unlimited']) assert((await source.search({q:'Psychic Energy',category:'Energy',format})).cards.some(c=>c.id==='mee-013'),'Basic Energy remains legal in '+format);
 const exact=await source.search({q:'Psychic Energy',exactName:true});assert(exact.cards.some(c=>c.id==='mee-013'));
 for(const q of ['Basic','Basic Psychic','psychic energy']) assert((await source.search({q})).cards.some(c=>c.id==='mee-013'),'partial query semantics preserved for '+q);
 const printings=printingRows('ptcg',exact.cards,{source:detail,catalogue:await source.sets()});
 assert(printings.some(r=>r.cardId==='mee-013'&&r.number==='013'&&r.selectable),'actual picker can resolve the supplemental printing');
 const sets=await source.sets(),mee=sets.find(s=>s.id==='mee');assert.equal(mee.count,16);
 const cards=await source.setCards(mee);assert.equal(cards.length,16);assert.equal(new Set(cards.map(c=>c.id)).size,16);
 assert.deepEqual(cards.map(c=>c.set.number),Array.from({length:16},(_,i)=>String(i+1).padStart(3,'0')));
 assert(cards.every(c=>c.set.total===16));
 const page1=await source.search({set:'mee',size:10}),page2=await source.search({set:'mee',size:10,page:1});
 assert.equal(page1.total,16);assert.equal(page1.cards.length,10);assert.equal(page1.more,true);assert.equal(page2.cards.length,6);assert.equal(page2.more,false);
 const lugiaSearch=await source.search({q:'Lugia'});
 const lugiaRows=printingRows('ptcg',lugiaSearch.cards,{source:normalized,catalogue:sets});
 for(const [id,name,number] of [['neo1-9','Neo Genesis','9'],['cel25-022','Celebrations','022'],['30th-c-029','30th Celebration Classic','029']]) {
  const row=lugiaRows.find(r=>r.cardId===id);assert(row);assert.equal(row.setName,name);assert.equal(row.number,number);assert.equal(row.selectable,true);
 }
 const cheapest=await source.cheapestPrint(detail);
 assert.equal(cheapest.id,'mee-005');assert.equal(cheapest.prices.usd,0.1,'unknown supplemental price does not become a free quote');
 assert.equal(priceRequests,0);

 // A fresh provider snapshot, then a warm cache: authoritative metadata wins
 // on every applicable discovery path, with a single record per canonical ID.
 upstreamSupplement=true;
 const {ptcgSource:updated}=await import('./ptcg.js?catalogue-regression=upstream');
 for(const result of [(await updated.search({q:'Psychic Energy'})).cards,await updated.byNameNumber('Psychic Energy','13'),await updated.setCards({id:'mee'}),(await updated.search({q:'Psychic Energy'})).cards]) {
  const hit=result.filter(c=>c.id==='mee-013');assert.equal(hit.length,1);assert.equal(hit[0].image,'https://fixture.invalid/upstream-psychic.png');assert.equal(hit[0].catalogueProvenance,undefined);
 }
 const current=await updated.get('mee-013');assert.equal(current.illustrator,'Upstream illustrator');assert.equal(current.prices.usd,4.25);assert.equal(current.catalogueProvenance,undefined);
 assert.equal(priceRequests,0);assert(cardRequests>0);
} finally {globalThis.fetch=originalFetch;}
console.log('PASS: exact sourced Lugia correction, raw rules/provenance, nested energy labels, set/collector briefs, filtered MEE discovery/detail/picker/set pagination, authoritative deduplication, warm-cache consistency and unknown-price safety.');
