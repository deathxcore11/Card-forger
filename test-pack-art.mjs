// Booster pack artwork selection: the set's single booster pack, never a box, bundle or sleeved pack,
// and a set whose own name contains an excluded word ("Rarity Collection") still finds its pack.
import assert from 'node:assert/strict';
import {selectPackProduct,selectPackGroup} from './set-art.js';
import {samplePack,rollYgoPrinting} from './pack-preview.js';
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
const mtgPack=samplePack('mtg',mtgSet,10,seq(.3,.7,.1));
assert.deepEqual(mtgPack.map(c=>c.rarity),[...Array(6).fill('common'),...Array(3).fill('uncommon'),mtgPack[9].rarity]);assert.match(mtgPack[9].rarity,/^(rare|mythic)$/);
assert.equal(new Set(mtgPack.map(c=>c.id)).size,10,'no card twice in one pack');
assert.equal(samplePack('mtg',mtgSet,9,()=>.5).length,9,'a shorter pack (today’s pack) drops only the hit slot');
const allFoil=[...Array(12)].map((_,i)=>({id:'f'+i,name:'F'+i,rarity:'Super Rare'}));
assert.equal(samplePack('ptcg',allFoil,10,()=>.4).length,10,'a set without commons still fills the pack');
// A Yu-Gi-Oh! card printed in several rarities in this set is pulled in exactly one of them.
const multi={id:'y1',name:'Y1',setContext:{printings:[{code:'RA01-EN001',rarity:'Super Rare'},{code:'RA01-EN001',rarity:'Quarter Century Secret Rare'}]}};
const low=rollYgoPrinting(multi,()=>0),high=rollYgoPrinting(multi,()=>.999);
assert.equal(low.setContext.printing.rarity,'Super Rare');assert.equal(high.setContext.printing.rarity,'Quarter Century Secret Rare');
assert.equal(low.setContext.printings.length,1);assert.equal(multi.setContext.printings.length,2,'the shared card is never changed');
const single={id:'y2',name:'Y2',setContext:{printings:[{rarity:'Common'}]}};assert.equal(rollYgoPrinting(single),single,'a single printing is left as it is');
console.log('PASS: packs follow typical slot structure and pull rates; Yu-Gi-Oh! multi-rarity cards are pulled in one rarity; booster pack artwork picks the set’s own pack, including sets named “Collection”, and never boxes, sleeved packs or boxed collections.');
