// Booster pack artwork selection: the set's single booster pack, never a box, bundle or sleeved pack,
// and a set whose own name contains an excluded word ("Rarity Collection") still finds its pack.
import assert from 'node:assert/strict';
import {selectPackProduct,selectPackGroup} from './set-art.js';
import {samplePack,rollYgoPrinting,ptcgSetRarities} from './pack-preview.js';
// A fixed-seed generator keeps the statistical checks deterministic.
const seeded=(a=>()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;})(12345);
const img=n=>`https://tcgplayer-cdn.tcgplayer.com/product/${n}_200w.jpg`;
const ra01=[{name:'25th Anniversary Rarity Collection Booster Pack',imageUrl:img(501747)},{name:'25th Anniversary Rarity Collection Booster Box',imageUrl:img(501748)},{name:'25th Anniversary Rarity Collection Sleeved Booster Pack',imageUrl:img(527222)}];
assert.equal(selectPackProduct(ra01,'25th Anniversary Rarity Collection')?.name,'25th Anniversary Rarity Collection Booster Pack');
assert.equal(selectPackProduct([{name:'Paldea Evolved Premium Collection Booster Pack',imageUrl:img(1)}],'Paldea Evolved'),null,'A boxed collection is never a pack');
assert.equal(selectPackProduct([{name:'Bloomburrow Play Booster Pack',imageUrl:img(2)},{name:'Bloomburrow Collector Booster Pack',imageUrl:img(3)}],'Bloomburrow')?.name,'Bloomburrow Play Booster Pack');
assert.equal(selectPackProduct([{name:'Odd (Set) Booster Pack',imageUrl:img(4)}],'Odd (Set)')?.name,'Odd (Set) Booster Pack','Set names are matched literally');
assert.equal(selectPackGroup([{groupId:1,name:'25th Anniversary Rarity Collection II'},{groupId:2,name:'25th Anniversary Rarity Collection'}],{name:'25th Anniversary Rarity Collection'},'ygo')?.groupId,2);
// Pull rates: slots draw their rarities; a set without a slot's rarity falls back to any unused card.
const seq=(...v)=>{let i=0;return ()=>v[i++%v.length];};
const mtgSet=[...Array(12)].map((_,i)=>({id:'c'+i,name:'C'+i,rarity:'common'})).concat([...Array(5)].map((_,i)=>({id:'u'+i,name:'U'+i,rarity:'uncommon'})),[{id:'r0',name:'R0',rarity:'rare'},{id:'m0',name:'M0',rarity:'mythic'}]);
const mtgPack=samplePack('mtg',mtgSet,undefined,seq(.3,.7,.1));
assert.equal(mtgPack.length,12,'a Magic play booster holds 12 cards here');
assert.deepEqual(mtgPack.slice(0,9).map(c=>c.rarity),[...Array(6).fill('common'),...Array(3).fill('uncommon')]);assert.match(mtgPack[11].rarity,/^(rare|mythic)$/,'the last slot is the rare or mythic');
assert.equal(mtgPack[10].packSlot,'foil');assert.equal(mtgPack[11].packSlot,'hit');
assert.equal(new Set(mtgPack.map(c=>c.id)).size,12,'no card twice in one pack');
assert.equal(samplePack('mtg',mtgSet,11,()=>.5).length,11,'a shorter pack (today’s pack) drops only the hit slot');
// Modern Pokémon: 4 commons, 3 uncommons, two reverse slots and one rare-or-better.
const ptcgSet=[...[...Array(10)].map((_,i)=>({id:'pc'+i,name:'PC'+i,rarity:'Common'})),...[...Array(8)].map((_,i)=>({id:'pu'+i,name:'PU'+i,rarity:'Uncommon'})),...[...Array(4)].map((_,i)=>({id:'pr'+i,name:'PR'+i,rarity:'Rare'})),{id:'dr',name:'DR ex',rarity:'Double rare'},{id:'ir',name:'IR',rarity:'Illustration rare'},{id:'ir2',name:'IR2',rarity:'Illustration rare'},{id:'sir',name:'SIR',rarity:'Special illustration rare'}];
const ptcgPack=samplePack('ptcg',ptcgSet,undefined,seq(.9,.2,.6,.4));
assert.equal(ptcgPack.length,10);assert.deepEqual(ptcgPack.slice(0,7).map(c=>c.rarity),[...Array(4).fill('Common'),...Array(3).fill('Uncommon')]);
assert.deepEqual(ptcgPack.slice(7).map(c=>c.packSlot),['reverse','reverse','hit']);assert.match(ptcgPack[9].rarity,/Rare|Double rare/,'the last slot is a rare or better');
assert.equal(ptcgPack.filter(c=>c.rarity==='Double rare').length<=1,true,'never a pile of ex cards');
assert.equal(samplePack('ptcg',ptcgSet.filter(c=>c.id!=='ir2'),undefined,seq(0)).godPack,undefined,'no god pack when the set cannot fill every hit slot');
const godPack=samplePack('ptcg',ptcgSet,undefined,seq(0));assert.equal(godPack.godPack,true);assert(godPack.slice(7).every(c=>/illustration rare/i.test(c.rarity)),'a god pack fills every hit slot with illustration rares');
const spread=new Set();for(let i=0;i<40;i++)spread.add(samplePack('ptcg',ptcgSet,undefined,seeded).map(c=>c.id).join());assert(spread.size>30,'every opening is a fresh random pack');
const allFoil=[...Array(12)].map((_,i)=>({id:'f'+i,name:'F'+i,rarity:'Super Rare'}));
assert.equal(samplePack('ptcg',allFoil,10,()=>.4).length,10,'a set without commons still fills the pack');
// A Yu-Gi-Oh! card printed in several rarities in this set is pulled in exactly one of them.
const multi={id:'y1',name:'Y1',setContext:{printings:[{code:'RA01-EN001',rarity:'Super Rare'},{code:'RA01-EN001',rarity:'Quarter Century Secret Rare'}]}};
const low=rollYgoPrinting(multi,()=>0),high=rollYgoPrinting(multi,()=>.999);
assert.equal(low.setContext.printing.rarity,'Super Rare');assert.equal(high.setContext.printing.rarity,'Quarter Century Secret Rare');
assert.equal(low.setContext.printings.length,1);assert.equal(multi.setContext.printings.length,2,'the shared card is never changed');
const single={id:'y2',name:'Y2',setContext:{printings:[{rarity:'Common'}]}};assert.equal(rollYgoPrinting(single),single,'a single printing is left as it is');
// Pokémon rarities come from TCGdex by exact rarity, most common first, stopping once the whole set is covered.
const asked=[];const fake=async url=>{const r=decodeURIComponent(new URL(url).searchParams.get('rarity')).replace(/^eq:/,'');asked.push(r);return {ok:true,json:async()=>({Common:[{id:'x-1'},{id:'x-2'}],Uncommon:[{id:'x-3'}],'Double rare':[{id:'x-4'}]})[r]||[]};};
const rmap=await ptcgSetRarities('x',4,fake);assert.equal(rmap.get('x-4'),'Double rare');assert.equal(rmap.get('x-1'),'Common');assert.equal(rmap.size,4);
assert.equal(asked.length,8,'one batch covers a small set; no further requests');assert(asked.every(r=>!/^eq:/.test(r)));
assert.equal(await ptcgSetRarities('x',4,()=>{throw Error('cached');}),rmap,'cached per set');
assert.equal((await ptcgSetRarities('bad id!',4,fake)).size,0,'unsafe set ids are never requested');
// Rates are per rarity: a set with 40 commons and 1 rare still gives the rare its own rarity's odds.
const many=[...[...Array(40)].map((_,i)=>({id:'m'+i,name:'M'+i,rarity:'Rare'})),{id:'d1',name:'D1 ex',rarity:'Double rare'}];let doubles=0;
for(let i=0;i<4000;i++)if(samplePack('ptcg',many,undefined,seeded).at(-1).rarity==='Double rare')doubles++;
assert(doubles/4000>.17&&doubles/4000<.27,`double rare about 1 in 5 regardless of how many rares exist (${doubles/4000})`);
console.log('PASS: packs follow typical slot structure and pull rates; Yu-Gi-Oh! multi-rarity cards are pulled in one rarity; booster pack artwork picks the set’s own pack, including sets named “Collection”, and never boxes, sleeved packs or boxed collections.');
