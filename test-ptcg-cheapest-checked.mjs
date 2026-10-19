// Deterministic public-provider responses only; no live network or account data.
import assert from 'node:assert/strict';
import {ptcgSource,normalizePtcg} from './ptcg.js';
const raw=(id,name,usd,more={})=>({id,name,category:'Pokemon',stage:'Basic',hp:70,types:['Fire'],retreat:1,attacks:[{name:'Ember',cost:['Fire'],damage:'20'}],legal:{standard:true,expanded:true},set:{id:id.split('-')[0],name:'Fixture set'},image:'https://fixture.invalid/card',pricing:usd==null?{}:{tcgplayer:{normal:{marketPrice:usd}}},...more});
const cardName='Fixture checked-print Pokémon';
const current=normalizePtcg(raw('origin-1',cardName,9));
const candidates=Array.from({length:18},(_,i)=>raw('new'+i+'-1',cardName,i===0?null:3+i));
const older={...current,id:'old-1',image:'',imageLarge:'',prices:{usd:.05},rarity:'Common'};
const illegal={...older,id:'banned-1',prices:{usd:.01},legal:{standard:false,expanded:true}};
const different={...older,id:'different-1',prices:{usd:.001},hp:80};
const otherEnergy={...older,id:'water-1',name:'Basic Water Energy',category:'Energy',basicEnergy:true,prices:{usd:.001}};
const registry=new Map(candidates.map(c=>[c.id,c]));let details=0,searches=0;
ptcgSource.sets=async()=>[...candidates.map(c=>({id:c.set.id})),{id:'old'}];
globalThis.fetch=async input=>{
 const url=new URL(input);assert.equal(url.hostname,'api.tcgdex.net');
 if(url.pathname==='/v2/en/cards'){searches++;return Response.json([...candidates.map(c=>({id:c.id,name:c.name})),{id:older.id,name:older.name}]);}
 if(url.pathname.startsWith('/v2/en/cards/')){details++;const id=decodeURIComponent(url.pathname.split('/').at(-1));assert(registry.has(id),`unexpected detail fetch ${id}`);return Response.json(registry.get(id));}
 throw Error('Unexpected request '+url);
};
const legal=c=>c.legal?.standard===true;legal.key='standard';
let chosen=await ptcgSource.cheapestPrint(current,{legal,known:[older,illegal,different,otherEnergy]});
assert.equal(chosen.id,older.id,'known cheaper image-less eligible printing beats every expensive pictured printing');assert.equal(chosen.prices.usd,.05);assert.equal(details,12,'ordinary detail budget remains12, not expanded fanout');assert.equal(chosen.printingComparison.partial,true);assert(chosen.printingComparison.unchecked>0);assert.equal(chosen.printingComparison.scope,'lowest-known-eligible-checked');
assert.equal(current.prices.usd,9,'selected source object is not mutated');assert(!chosen.id.includes('banned'));assert.notEqual(chosen.id,different.id);
const counts={details,searches};
chosen=await ptcgSource.cheapestPrint(current,{legal,known:[older],owned:c=>c.id===current.id?1:0});assert.equal(chosen.id,current.id,'a newly owned exact Pokémon printing is honored; chosen result is not memoized across ownership changes');assert.equal(chosen.printingComparison.ownedPreferred,true);
chosen=await ptcgSource.cheapestPrint(current,{legal:c=>legal(c)&&c.id!==older.id,known:[older]});assert.notEqual(chosen.id,older.id,'new legality callback is rechecked even without a key');assert.notEqual(chosen.prices.usd,null,'unknown quote ranks after verified prices, never as zero');assert.deepEqual({details,searches},counts,'catalogue discovery reused without stale choice/ownership caching');
const blankQuote={...older,id:'blank-1',image:'https://fixture.invalid/art',prices:{usd:''}};chosen=await ptcgSource.cheapestPrint(current,{legal,known:[blankQuote,older]});assert.equal(chosen.id,older.id,'empty string quote is unknown, not zero');
const explicit={...current,setContext:{setId:'origin',variant:'holo',price:9}};chosen=await ptcgSource.cheapestPrint(explicit,{legal,known:[older]});assert.equal(chosen,explicit,'explicit set/finish selection is not silently replaced');
const updated={...older,prices:{usd:50}};chosen=await ptcgSource.cheapestPrint(current,{legal,known:[updated]});assert.notEqual(chosen.id,older.id,'changed cached price is not hidden by chosen-print memo');
console.log('PASS: known cheapest legal same-signature printing wins before image/rarity; changed ownership, legality and prices are rechecked; unknown is not free; bounded incomplete coverage remains explicit.');
const energyName='Basic Fire Energy',eCurrent=normalizePtcg(raw('energyOrigin-1',energyName,20,{category:'Energy',energyType:'Normal',stage:undefined}));
const eCards=Array.from({length:22},(_,i)=>raw('energy'+i+'-1',energyName,2+i,{category:'Energy',energyType:'Normal',stage:undefined}));
eCards.forEach(c=>registry.set(c.id,c));
const fireCheap={...eCurrent,id:'oldEnergy-1',image:'',prices:{usd:.02}};
let energyDetails=0;
globalThis.fetch=async input=>{const url=new URL(input);assert.equal(url.hostname,'api.tcgdex.net');if(url.pathname==='/v2/en/cards')return Response.json(eCards.map(c=>({id:c.id,name:c.name})));energyDetails++;return Response.json(registry.get(decodeURIComponent(url.pathname.split('/').at(-1))));};
chosen=await ptcgSource.cheapestPrint(eCurrent,{legal:()=>true,known:[fireCheap,otherEnergy],owned:c=>c.id===eCurrent.id?99:0});
assert.equal(chosen.id,fireCheap.id);assert.equal(chosen.name,energyName);assert.equal(energyDetails,16,'Basic Energy cap is exactly16, not a rounded18-card batch');assert.equal(chosen.printingComparison.partial,true);assert.equal(chosen.printingComparison.ownedPreferred,false,'Basic Energy price choice is independent from actual name-equivalent owned quantity');
console.log('PASS: Energy compares only its own type, includes cheaper known printings outside newest candidates, keeps16-detail budget, and never claims market-wide cheapest coverage.');
