// Booster pack artwork selection: the set's single booster pack, never a box, bundle or sleeved pack,
// and a set whose own name contains an excluded word ("Rarity Collection") still finds its pack.
import assert from 'node:assert/strict';
import {selectPackProduct,selectPackGroup} from './set-art.js';
import {packEligible} from './set-experience.js';
import {dailyDetails} from './home-today.js';
import {normalizePtcg} from './ptcg.js';
import {samplePack,rollYgoPrinting,ptcgSetRarities,packEra,packSize,packFinishes,packArtUrl} from './pack-preview.js';
import {todayPackMarkup} from './home-today.js';
// The shipped Android 0.4.0 ImageCache accepts this encoded query alphabet.
// URLSearchParams' '+' spaces caused valid multi-word sets to fail before a fetch.
const nativeImageQuery=/^[A-Za-z0-9=&._%-]{0,200}$/;
assert(!nativeImageQuery.test('code=sv04&name=Paradox+Rift'),'reproduce the old Android cache rejection');
for(const [game,set] of [['ptcg',{id:'sv04',name:'Paradox Rift'}],['ygo',{code:'LOB',name:'Legend of Blue Eyes White Dragon'}],['ygo',{name:'25th Anniversary Rarity Collection'}],['mtg',{code:'dsk',name:'Duskmourn: House of Horror'}],['ptcg',{id:'neo4',name:'Neo Destiny'}],['ptcg',{id:'ex14',name:'EX Crystal Guardians *'}]]){
 const url=new URL(packArtUrl(game,set),'https://cardstashy.com');
 assert(nativeImageQuery.test(url.search.slice(1)),url.href);
 assert.equal(url.searchParams.get('name'),set.name,'encoding preserves the exact set identity');
 assert.equal(url.pathname,`/img/pack/${game}.jpg`);
}
for(const [game,set] of [['ptcg',{id:'sv04',name:'Paradox Rift'}],['ygo',{code:'LOB',name:'Legend of Blue Eyes White Dragon'}]]){
 const html=todayPackMarkup(game,set);assert.match(html,/data-pack-art/);assert.match(html,/name=[^\"]*%20/);assert.doesNotMatch(html,/name=[^\"]*\+/);
}
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
const SV={id:'sv08.5',name:'Prismatic Evolutions'};
// Scarlet & Violet Pokémon: 4 commons, 3 uncommons, two reverse slots and one rare-or-better.
const ptcgSet=[...[...Array(10)].map((_,i)=>({id:'pc'+i,name:'PC'+i,rarity:'Common'})),...[...Array(8)].map((_,i)=>({id:'pu'+i,name:'PU'+i,rarity:'Uncommon'})),...[...Array(4)].map((_,i)=>({id:'pr'+i,name:'PR'+i,rarity:'Rare'})),{id:'dr',name:'DR ex',rarity:'Double rare'},{id:'ir',name:'IR',rarity:'Illustration rare'},{id:'ir2',name:'IR2',rarity:'Illustration rare'},{id:'sir',name:'SIR',rarity:'Special illustration rare'}];
const ptcgPack=samplePack('ptcg',ptcgSet,undefined,seq(.9,.2,.6,.4),SV);
assert.equal(ptcgPack.length,10);assert.deepEqual(ptcgPack.slice(0,7).map(c=>c.rarity),[...Array(4).fill('Common'),...Array(3).fill('Uncommon')]);
assert.deepEqual(ptcgPack.slice(7).map(c=>c.packSlot),['reverse','reverse','hit']);assert.match(ptcgPack[9].rarity,/Rare|Double rare/,'the last slot is a rare or better');
assert.equal(ptcgPack.filter(c=>c.rarity==='Double rare').length<=1,true,'never a pile of ex cards');
assert.equal(samplePack('ptcg',ptcgSet.filter(c=>c.id!=='ir2'),undefined,seq(0),SV).godPack,undefined,'no god pack when the set cannot fill every hit slot');
const godPack=samplePack('ptcg',ptcgSet,undefined,seq(0),SV);assert.equal(godPack.godPack,true);assert(godPack.slice(7).every(c=>/illustration rare/i.test(c.rarity)),'a god pack fills every hit slot with illustration rares');
const spread=new Set();for(let i=0;i<40;i++)spread.add(samplePack('ptcg',ptcgSet,undefined,seeded,SV).map(c=>c.id).join());assert(spread.size>30,'every opening is a fresh random pack');
const allFoil=[...Array(12)].map((_,i)=>({id:'f'+i,name:'F'+i,rarity:'Super Rare'}));
assert.equal(samplePack('ptcg',allFoil,10,()=>.4,SV).length,10,'a set without commons still fills the pack');
// A Yu-Gi-Oh! card printed in several rarities in this set is pulled in exactly one of them.
const multi={id:'y1',name:'Y1',setContext:{printings:[{code:'RA01-EN001',rarity:'Super Rare'},{code:'RA01-EN001',rarity:'Quarter Century Secret Rare'}]}};
const low=rollYgoPrinting(multi,()=>0),high=rollYgoPrinting(multi,()=>.999);
assert.equal(low.setContext.printing.rarity,'Super Rare');assert.equal(high.setContext.printing.rarity,'Quarter Century Secret Rare');
assert.equal(low.setContext.printings.length,1);assert.equal(multi.setContext.printings.length,2,'the shared card is never changed');
// A card printed once in the set is pulled in that printing, so its foil and price resolve (a Secret
// Rare printed only once used to come out plain).
const once={code:'BLC1-EN060',rarity:'Secret Rare'},single={id:'y2',name:'Y2',setContext:{printings:[once]}},pulledOnce=rollYgoPrinting(single);
assert.equal(pulledOnce.setContext.printing,once);assert.equal(pulledOnce.setContext.printingAmbiguous,false);assert.equal(pulledOnce.rarity,'Secret Rare');
const chosen={...single,setContext:{printings:[once],printing:once}};assert.equal(rollYgoPrinting(chosen),chosen,'an already chosen printing is kept');
const none={id:'y3',name:'Y3',setContext:{printings:[]}};assert.equal(rollYgoPrinting(none),none);
// Pokémon rarities come from TCGdex by exact rarity, most common first, stopping once the whole set is covered.
const asked=[];const fake=async url=>{const r=decodeURIComponent(new URL(url).searchParams.get('rarity')).replace(/^eq:/,'');asked.push(r);return {ok:true,json:async()=>({Common:[{id:'x-1'},{id:'x-2'}],Uncommon:[{id:'x-3'}],'Double rare':[{id:'x-4'}]})[r]||[]};};
const rmap=await ptcgSetRarities('x',4,fake);assert.equal(rmap.get('x-4'),'Double rare');assert.equal(rmap.get('x-1'),'Common');assert.equal(rmap.size,4);
assert.equal(asked.length,8,'one batch covers a small set; no further requests');assert(asked.every(r=>!/^eq:/.test(r)));
assert.equal(await ptcgSetRarities('x',4,()=>{throw Error('cached');}),rmap,'cached per set');
assert.equal((await ptcgSetRarities('bad id!',4,fake)).size,0,'unsafe set ids are never requested');
// Rates are per rarity: a set with 40 commons and 1 rare still gives the rare its own rarity's odds.
const many=[...[...Array(40)].map((_,i)=>({id:'m'+i,name:'M'+i,rarity:'Rare'})),{id:'d1',name:'D1 ex',rarity:'Double rare'}];let doubles=0;
for(let i=0;i<4000;i++)if(samplePack('ptcg',many,undefined,seeded,SV).at(-1).rarity==='Double rare')doubles++;
assert(doubles/4000>.17&&doubles/4000<.27,`double rare about 1 in 5 regardless of how many rares exist (${doubles/4000})`);
// A set with no uncommons fills those slots with its plainest cards, never its ex cards.
const noUnc=[...[...Array(12)].map((_,i)=>({id:'nc'+i,name:'NC'+i,rarity:'Common'})),...[...Array(6)].map((_,i)=>({id:'nx'+i,name:'NX'+i+' ex',rarity:'Double rare'})),{id:'nr',name:'NR',rarity:'Rare'}];
for(let i=0;i<50;i++)assert(samplePack('ptcg',noUnc,undefined,seeded,SV).slice(0,7).every(c=>c.rarity==='Common'),'common and uncommon slots never take ex cards');
// Each game's packs follow the era the set was printed in.
assert.deepEqual([packEra('ptcg',{id:'base1'}),packEra('ptcg',{id:'swsh7',releaseDate:'2021-08-27'}),packEra('ptcg',{id:'sv08.5'}),packEra('ptcg',{id:'me01',releaseDate:'2025-09-26'})],['wotc','modern','sv','sv']);
assert.equal(packEra('mtg',{released_at:'1995-06-01'}),'nofoil');assert.equal(packSize('mtg',{released_at:'1995-06-01'}),15);
assert.deepEqual([packEra('mtg',{released_at:'2003-10-02'}),packEra('mtg',{released_at:'2018-04-27'}),packEra('mtg',{released_at:'2024-08-02'})],['classic','draft','play']);
assert.deepEqual([packEra('ygo',{date:'2004-03-01'}),packEra('ygo',{tcg_date:'2023-02-09'})],['classic','core']);
assert.deepEqual([packSize('ptcg',{id:'base1'}),packSize('ptcg',{id:'swsh7',releaseDate:'2021-08-27'}),packSize('ptcg',SV),packSize('mtg',{released_at:'2003-10-02'}),packSize('mtg',{released_at:'2018-04-27'}),packSize('ygo',{date:'2004-03-01'}),packSize('ygo',{date:'2023-02-09'})],[11,11,10,15,14,9,9]);
const oldPtcg=[...[...Array(12)].map((_,i)=>({id:'oc'+i,name:'OC'+i,rarity:'Common'})),...[...Array(6)].map((_,i)=>({id:'ou'+i,name:'OU'+i,rarity:'Uncommon'})),...[...Array(4)].map((_,i)=>({id:'or'+i,name:'OR'+i,rarity:'Rare'})),{id:'gx',name:'GX',rarity:'Rare Holo GX'},{id:'lvx',name:'LVX',rarity:'Rare Holo LV.X'}];
const swsh=samplePack('ptcg',oldPtcg,undefined,seeded,{id:'sm1',releaseDate:'2017-02-03'});assert.deepEqual(swsh.slice(9).map(c=>c.packSlot),['reverse','hit'],'e-Card to Sword & Shield: one reverse holo, then the rare');
let gx=0;for(let i=0;i<2000;i++)if(/GX|LV/.test(samplePack('ptcg',oldPtcg,undefined,seeded,{id:'sm1',releaseDate:'2017-02-03'}).at(-1).rarity))gx++;assert(gx>0&&gx<2000*.3,`GX and LV.X rares come out at their own odds (${gx})`);
const wotc=samplePack('ptcg',oldPtcg,undefined,seeded,{id:'base1'});assert.equal(wotc.length,11);assert.equal(wotc.filter(c=>c.packSlot==='reverse').length,0,'WotC packs had no reverse holos');
const yc=(id,rarity)=>({id,name:id.toUpperCase(),rarity,setContext:{printings:[{rarity}]}});
const ygoSet=[...[...Array(12)].map((_,i)=>yc('yc'+i,'Common')),...[...Array(3)].map((_,i)=>yc('yr'+i,'Rare')),...[...Array(3)].map((_,i)=>yc('ys'+i,'Super Rare')),yc('yu','Ultra Rare')];
const core=samplePack('ygo',ygoSet,undefined,seeded,{date:'2023-02-09'});assert.deepEqual(core.map(c=>c.rarity).slice(0,8),[...Array(7).fill('Common'),'Rare']);assert.match(core[8].rarity,/Super|Ultra/,'core boosters end in a foil');
const classicYgo=samplePack('ygo',ygoSet,undefined,seeded,{date:'2004-03-01'});assert.equal(classicYgo.slice(0,8).every(c=>c.rarity==='Common'),true);assert.match(classicYgo[8].rarity,/Rare/);
let foils=0;for(let i=0;i<3000;i++)if(samplePack('mtg',mtgSet,undefined,seeded,{released_at:'2018-04-27'}).some(c=>c.packSlot==='foil'))foils++;assert(foils/3000>.28&&foils/3000<.39,`about 1 draft booster in 3 holds a foil (${foils/3000})`);
const draft=samplePack('mtg',mtgSet,undefined,()=>.9,{released_at:'2018-04-27'});assert.equal(draft.length,14);assert.equal(draft.filter(c=>c.packSlot==='foil').length,0);assert.equal(draft.slice(0,10).every(c=>c.rarity==='common'),true,'a draft pack without a foil has 10 commons');
// Shiny slots: a Magic foil slot pulls in traditional foil; a Pokémon reverse slot as a reverse holo once its variants load.
assert.deepEqual(packFinishes('mtg',[{id:'a',packSlot:'foil',finishes:['nonfoil','foil']},{id:'b',finishes:['nonfoil','foil']}]),[{finish:'foil'},{}]);
// Yu-Gi-Oh! tournament and prize packs are packs; tins and mega packs from tins are not.
assert.deepEqual(['OTS TOURNAMENT PACK 12','ASTRAL PACK ONE','SPEED DUEL TOURNAMENT PACK 01','2015 MEGA-TINS MEGA PACK','BOOSTER PACK TIN 2002'].map(name=>packEligible('ygo',{name})),[true,true,true,false,false]);
assert.equal(packSize('ygo',{name:'OTS TOURNAMENT PACK 12'}),3);assert.equal(packSize('ygo',{name:'25th Anniversary Rarity Collection'}),5,'Rarity Collection packs hold 5 cards');
// A Magic bonus-sheet card (Mystical Archive) opens its main set's booster.
const sets={soa:{code:'soa',name:'Mystical Archive',set_type:'masterpiece',parent_set_code:'sos'},sos:{code:'sos',name:'Secrets of Strixhaven',set_type:'expansion',released_at:'2026-04-24'}};
const daze={id:'d1',set:'soa',set_name:'Mystical Archive',set_type:'masterpiece',rarity:'rare',image_uris:{normal:'x'}};
const dd=await dailyDetails('mtg',{id:'d1',date:'2026-10-21',printing:daze},async url=>sets[url.split('/').pop()]);
assert.equal(dd.set.pack.code,'sos');assert.equal(dd.card,daze);
const resh=normalizePtcg({id:'sv10-017',localId:'017',name:'Reshiram',category:'Pokemon',rarity:'Rare',set:{id:'sv10',name:'X'},variants:{normal:false,reverse:true,holo:true,firstEdition:false}});
assert.deepEqual(packFinishes('ptcg',[{...resh,packSlot:'reverse'},{...resh,packSlot:'hit'},resh]),[{priceFinish:'reverse-holofoil'},{priceFinish:'holofoil'},{priceFinish:'holofoil'}],'a holo rare shines in its pack; in a reverse slot it is a reverse holo');
// The reveal names the finish beside the rarity, in the same pill.
{const {packFinishLabel}=await import('./pack-preview.js'),{rarityEmblem}=await import('./rarity-emblem.js');
 assert.equal(packFinishLabel('ptcg',{priceFinish:'reverse-holofoil'},'Uncommon'),'Reverse Holo');assert.equal(packFinishLabel('ptcg',{priceFinish:'holofoil'},'Rare'),'Holo');
 assert.equal(packFinishLabel('ptcg',{priceFinish:'holofoil'},'Rare Holo'),'','the rarity already says Holo');assert.equal(packFinishLabel('ptcg',{},'Common'),'');
 assert.equal(packFinishLabel('mtg',{finish:'foil'},'common'),'Foil');assert.equal(packFinishLabel('mtg',{finish:'etched'},'rare'),'Etched foil');assert.equal(packFinishLabel('mtg',{},'common'),'');assert.equal(packFinishLabel('ygo',{},'Secret Rare'),'');
 const pill=rarityEmblem('mtg','common',{finish:'Foil'});assert.match(pill,/<span class="rx-finish">Foil<\/span> · Common/);assert.match(pill,/title="Foil · common"/);assert.doesNotMatch(rarityEmblem('mtg','common'),/rx-finish/);
 assert.match((await import('node:fs')).readFileSync('pack-preview.js','utf8'),/rarityEmblem\(game,rarity\.label,\{finish:packFinishLabel\(game,ctxs\[focus\]\|\|\{\},rarity\.label\)\}\)/,'the reveal passes the pulled finish');}
console.log('PASS: packs follow typical slot structure and pull rates; Yu-Gi-Oh! multi-rarity cards are pulled in one rarity; booster pack artwork picks the set’s own pack, including sets named “Collection”, and never boxes, sleeved packs or boxed collections.');
