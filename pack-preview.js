import {esc,safeHref,cardImage} from './ui.js';
import {rarityTier,TIERS,priceTier} from './tier.js';
import {ygoRarity} from './ygo-identity.js';
import {brandStaticMark} from './brand.js';
import {setArtworkSources,setImageUrl,YGO_TOURNAMENT_PACK} from './set-experience.js';
import {finishAttrs,finishChoices} from './finish-preview.js';
import {attachZoomMotion} from './mobile-tilt.js';
import {rarityEmblem} from './rarity-emblem.js';
import {ygoSetReference} from './ygo-set-prices.js';
import {pkCatalogueSymbolSources} from './emblems.js';
import {drawMtgBooster} from './mtg-boosters.js';
import {haptic,cancelHaptics} from './feel.js';
import {appSound} from './audio.js';
// Each haptic of a pack's moments has a soft sound beside it; rarer pulls sound warmer, never louder.
const PACK_SOUND={'pack-reveal':'PACK-006','pack-value-2':'PACK-007','pack-value-3':'PACK-008','pack-value-4':'PACK-009'};
import {catchLight} from './foil-fx.js';
// A discovery sampler. No collation, print-run odds, purchases or ownership are implied.
export function sampleSetCards(cards,count=10,random=packRandom){
 const pool=[...new Map(cards.filter(c=>c?.id&&c.name).map(c=>[String(c.id),c])).values()];
 for(let i=pool.length-1;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random sample');const j=Math.floor(r*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,Math.max(0,Math.min(20,Math.floor(count)||0)));
}
// Typical booster structure and pull rates, approximate and per era (not official odds): each slot
// draws from cards of the named rarities, weighted, and falls back to any unused card in the set
// when the set has none (all-foil sets, promos). rarity keys are normalised rarity names.
const R=s=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
const slot=(w,role='',odds)=>({w,role,odds});
const PTCG_RARE={rare:70,rareholo:35,holorare:35,doublerare:20,ultrarare:6.5,hyperrare:.7,raresecret:.7,secretrare:.7,rarerainbow:.8,rareholoex:8,rareholov:8,rareholovmax:4,rareholovstar:4,rareultra:6.5,radiantrare:4,amazingrare:3,megahyperrare:.4,shinyrare:3,shinyultrarare:1};
// Slots run in pack order and end with the hit, so today's pack (one card shorter) swaps the hit for the
// Card of the Day. Each game's packs follow the era the set was printed in.
const C=n=>Array(n).fill(slot({common:1})),U=n=>Array(n).fill(slot({uncommon:1}));
const PACKS={
 mtg:{
  // Play Boosters (2024 on): 6 commons, 3 uncommons, a wildcard, a traditional foil and a rare or mythic.
  play:[...C(6),...U(3),slot({common:50,uncommon:30,rare:14,mythic:2.4},'wildcard'),slot({common:60,uncommon:28,rare:10,mythic:1.6},'foil'),slot({rare:6.4,mythic:1},'hit')],
  // Draft boosters (2008-2023): 10 commons (about 1 pack in 3 swaps one for a foil of any rarity), 3 uncommons, a rare or mythic.
  draft:[...C(9),slot({common:1},'maybefoil'),...U(3),slot({rare:7,mythic:1},'hit')],
  // Before mythics (Urza's Legacy to 2008): 11 commons (about 1 pack in 4 swaps one for a foil), 3 uncommons, 1 rare.
  classic:[...C(10),slot({common:1},'maybefoil',1/4),...U(3),slot({rare:1},'hit')],
  // Before foils (to early 1999): 11 commons, 3 uncommons, 1 rare.
  nofoil:[...C(11),...U(3),slot({rare:1},'hit')]},
 ptcg:{
  // Scarlet & Violet and Mega Evolution: 4 commons, 3 uncommons, two reverse holos (the second can be an
  // ACE SPEC, illustration rare or special illustration rare) and a rare or better.
  sv:[...C(4),...U(3),slot({common:60,uncommon:30,rare:10},'reverse'),slot({common:55,uncommon:28,rare:9,acespecrare:5,illustrationrare:7.7,specialillustrationrare:1.2},'reverse'),slot(PTCG_RARE,'hit')],
  // e-Card to Sword & Shield: 6 commons, 3 uncommons, a reverse holo and a rare (about 1 in 3 holo, plus that era's ultra rares).
  modern:[...C(6),...U(3),slot({common:60,uncommon:30,rare:10,rareholo:4},'reverse'),slot({rare:60,rareholo:30,holorare:30,rareholoex:5,rareholov:9,holorarev:9,rareholovmax:4,holorarevmax:4,rareholovstar:4,holorarevstar:4,rarehologx:6,rarehololvx:3,rareprime:4,legend:2,rarebreak:3,rareprismstar:3,rareultra:5,raresecret:1,secretrare:1,rarerainbow:1.2,radiantrare:4,amazingrare:3,rareshining:2,shinyrare:3,shinyultrarare:1},'hit')],
  // Wizards of the Coast (1999-2002): 7 commons, 3 uncommons and a rare, holo about 1 in 3.
  wotc:[...C(7),...U(3),slot({rare:2,rareholo:1,holorare:1},'hit')]},
 ygo:{
  // Core boosters (2014 on): 7 commons, a rare and a foil (mostly Super, sometimes Ultra, Secret or Quarter Century).
  core:[...C(7),slot({rare:1}),slot({superrare:72,ultrarare:17,secretrare:8.5,quartercenturysecretrare:2.5},'hit')],
  // Classic boosters: 8 commons and a rare that is sometimes upgraded (Super ~1 in 5, Ultra ~1 in 12, Secret ~1 in 23).
  classic:[...C(8),slot({rare:63,superrare:20,ultrarare:8.5,secretrare:4.5,ultimaterare:2,ghostrare:.6},'hit')],
  // Rarity Collection: 5 cards, all foil: four Super or Ultra Rares and one rarer foil (Secret, Ultimate,
  // Collector's, Platinum Secret or Quarter Century Secret). A card printed in several rarities rolls one.
  rarity:[...Array(4).fill(slot({superrare:3,ultrarare:2})),slot({secretrare:30,ultimaterare:20,collectorsrare:24,platinumsecretrare:10,quartercenturysecretrare:12},'hit')],
  // Tournament and prize packs: 3 cards, the last a rare that is sometimes upgraded.
  tournament:[...C(2),slot({rare:60,superrare:25,ultrarare:10,secretrare:5,ultimaterare:1},'hit')]}
};
// Per-set pull rates for Scarlet & Violet and Mega Evolution boosters: chance per pack, from TCGplayer
// Authentication Center pack samples (1,200 to 8,500 packs per set, via pullrates.com, October 2026).
// Illustration rares, special illustration rares, ACE SPECs, shiny rares and Black White rares take the
// second reverse holo's place; double, ultra and hyper rares take the rare's.
const PTCG_SET_RATES={
 'sv01':{doublerare:1/7,ultrarare:1/15,hyperrare:1/54,illustrationrare:1/13,specialillustrationrare:1/32},
 'sv02':{doublerare:1/7,ultrarare:1/15,hyperrare:1/57,illustrationrare:1/13,specialillustrationrare:1/32},
 'sv03':{doublerare:1/7,ultrarare:1/15,hyperrare:1/52,illustrationrare:1/13,specialillustrationrare:1/32},
 'sv03.5':{doublerare:1/8,ultrarare:1/16,hyperrare:1/51,illustrationrare:1/12,specialillustrationrare:1/32},
 'sv04':{doublerare:1/6,ultrarare:1/15,hyperrare:1/82,illustrationrare:1/13,specialillustrationrare:1/47},
 'sv04.5':{doublerare:1/6,ultrarare:1/15,hyperrare:1/62,shinyrare:1/4,shinyultrarare:1/13,illustrationrare:1/14,specialillustrationrare:1/58},
 'sv05':{doublerare:1/6,ultrarare:1/15,hyperrare:1/188,illustrationrare:1/13,specialillustrationrare:1/86,acespecrare:1/20},
 'sv06':{doublerare:1/6,ultrarare:1/15,hyperrare:1/146,illustrationrare:1/13,specialillustrationrare:1/86,acespecrare:1/20},
 'sv06.5':{doublerare:1/6,ultrarare:1/15,hyperrare:1/144,illustrationrare:1/12,specialillustrationrare:1/67,acespecrare:1/20},
 'sv07':{doublerare:1/6,ultrarare:1/15,hyperrare:1/137,illustrationrare:1/13,specialillustrationrare:1/90,acespecrare:1/20},
 'sv08':{doublerare:1/6,ultrarare:1/15,hyperrare:1/188,illustrationrare:1/13,specialillustrationrare:1/87,acespecrare:1/20},
 'sv08.5':{doublerare:1/6,ultrarare:1/13,hyperrare:1/180,specialillustrationrare:1/45,acespecrare:1/21},
 'sv09':{doublerare:1/6,ultrarare:1/15,hyperrare:1/150,illustrationrare:1/13,specialillustrationrare:1/90},
 'sv10':{doublerare:1/6,ultrarare:1/15,hyperrare:1/188,illustrationrare:1/13,specialillustrationrare:1/86},
 'sv10.5w':{doublerare:1/5,ultrarare:1/17,illustrationrare:1/6,specialillustrationrare:1/80,blackwhiterare:1/496},
 'sv10.5b':{doublerare:1/5,ultrarare:1/17,illustrationrare:1/6,specialillustrationrare:1/80,blackwhiterare:1/496},
 'me01':{doublerare:1/5,ultrarare:1/12,megahyperrare:1/1260,illustrationrare:1/9,specialillustrationrare:1/101},
 'me02':{doublerare:1/5,ultrarare:1/12,megahyperrare:1/1260,illustrationrare:1/9,specialillustrationrare:1/80},
 'me02.5':{doublerare:1/5,ultrarare:1/21,megahyperrare:1/540,illustrationrare:1/9,specialillustrationrare:1/70},
 'me03':{doublerare:1/5,ultrarare:1/12,megahyperrare:1/1786,illustrationrare:1/9,specialillustrationrare:1/81},
 'me04':{doublerare:1/5,ultrarare:1/12,megahyperrare:1/956,illustrationrare:1/9,specialillustrationrare:1/83},
 'me05':{doublerare:1/5,ultrarare:1/12,megahyperrare:1/1081,illustrationrare:1/9,specialillustrationrare:1/80}
};
const PTCG_REVERSE_HITS=new Set(['illustrationrare','specialillustrationrare','acespecrare','shinyrare','shinyultrarare','blackwhiterare']);
// The set's own two last slots, from its rates; the leftover chance keeps the slot's normal fill.
function ptcgSetSlots(rates){
 const pick=keys=>Object.fromEntries(Object.entries(rates).filter(([k])=>keys(k))),special=pick(k=>PTCG_REVERSE_HITS.has(k)),hits=pick(k=>!PTCG_REVERSE_HITS.has(k));
 const rest=o=>Math.max(0,1-Object.values(o).reduce((a,b)=>a+b,0));
 const r2=rest(special),h=rest(hits);
 return [...C(4),...U(3),slot({common:.6,uncommon:.3,rare:.1},'reverse'),slot({common:.6*r2,uncommon:.3*r2,rare:.1*r2,...special},'reverse'),slot({rare:h,...hits},'hit')];
}
const releaseYear=set=>{const y=Number(String(set?.released_at||set?.releaseDate||set?.date||set?.tcg_date||'').slice(0,4));return Number.isFinite(y)&&y>1990?y:0;};
// Which era's pack this set was printed in.
export function packEra(game,set={}){
 const id=String(set.id||set.code||'').toLowerCase(),y=releaseYear(set),date=String(set.released_at||'');
 if(game==='mtg')return date&&date<'1999-02-15'?'nofoil':date&&date<'2008-10-03'?'classic':date&&date<'2024-02-09'?'draft':'play';
 if(game==='ptcg')return /^(?:sv|me)/.test(id)||y>=2023?'sv':/^(?:base|gym|neo|lc|si)\d*/.test(id)||y&&y<2002?'wotc':'modern';
 if(game==='ygo')return /rarity collection/i.test(set.name||'')?'rarity':YGO_TOURNAMENT_PACK.test(set.name||'')?'tournament':y&&y<2014?'classic':'core';
 return '';
}
const slotsFor=(game,set)=>game==='ptcg'&&PTCG_SET_RATES[String(set?.id||'').toLowerCase()]?ptcgSetSlots(PTCG_SET_RATES[String(set.id).toLowerCase()]):PACKS[game]?.[packEra(game,set)]||[];
export const ptcgSetRates=id=>PTCG_SET_RATES[String(id||'').toLowerCase()]||null;
// Each pack is drawn from the device's secure random source, fresh every opening (never a fixed or saved seed);
// Math.random is only the fallback where crypto is missing.
export function packRandom(){
 try{const a=new Uint32Array(2);globalThis.crypto.getRandomValues(a);return (a[0]*2**21+(a[1]>>>11))/2**53;}catch{return Math.random();}
}
// God packs, rare on purpose. Pokémon: every hit slot is an illustration or special illustration rare (as in
// Scarlet & Violet god packs). Magic and Yu-Gi-Oh! have no official god pack, so theirs is a CardStashy bonus:
// every card a rare or mythic, or every card a foil.
const GOD_SLOT=slot({illustrationrare:2,specialillustrationrare:1},'hit'),GOD_PACK_ODDS=1/1000;
const GOD={
 ptcg:{odds:GOD_PACK_ODDS,slot:GOD_SLOT,all:false,text:'God pack! Every hit is an illustration rare.'},
 mtg:{odds:1/2000,slot:slot({rare:6.4,mythic:1},'hit'),all:true,text:'God pack! Every card is a rare or mythic.'},
 ygo:{odds:1/1500,slot:slot({superrare:6,ultrarare:3,secretrare:1.5,ultimaterare:.6,quartercenturysecretrare:.5,collectorsrare:.5,platinumsecretrare:.3},'hit'),all:true,text:'God pack! Every card is a foil.'}};
export const godPackText=game=>GOD[game]?.text||'God pack!';
// A Magic pack from real booster sheets becomes a god pack by swapping every card for a different rare or mythic
// of the set; foils stay foil. Null when the set has too few rares and mythics to fill it.
export function mtgGodPack(picks,cards,random=packRandom){
 const pool=[...new Map([...cards].filter(c=>c?.id&&/^(rare|mythic)$/.test(c.rarity)&&!/basic land/i.test(c.type_line||'')).map(c=>[String(c.id),c])).values()];
 if(pool.length<picks.length)return null;
 const out=picks.map(p=>{const w=x=>x.rarity==='mythic'?1:6.4,total=pool.reduce((n,c)=>n+w(c),0);let r=random()*total,k=pool.length-1;for(let i=0;i<pool.length;i++){r-=w(pool[i]);if(r<=0){k=i;break;}}
  const [c]=pool.splice(k,1);return {...c,packSlot:p.packSlot==='foil'||p.packFoil?'foil':'hit',...(p.packFoil?{packFoil:true}:{})};});
 out.godPack=true;return out;
}
// Draft boosters: about 1 pack in 3 swaps a common for a foil of any rarity.
const DRAFT_FOIL=slot({common:200,uncommon:30,rare:7,mythic:1},'foil'),DRAFT_FOIL_ODDS=1/3;
export const packSize=(game,set)=>slotsFor(game,set).length||10;
// Pokémon set pages list cards before their details (and rarities) load. Pull rates need every card's
// rarity, so the set's cards are fetched by rarity from TCGdex, most common first, until the counts
// cover the whole set. Cached for the session; a failure just leaves rarities unknown.
const PTCG_RARITY_ORDER=['Common','Uncommon','Rare','Rare Holo','Double rare','Holo Rare','Special illustration rare','Illustration rare','Ultra Rare','ACE SPEC Rare','Hyper rare','Rare Holo EX','Rare Holo V','Holo Rare V','Rare Holo VMAX','Holo Rare VMAX','Rare Holo VSTAR','Holo Rare VSTAR','Rare Ultra','Rare Secret','Secret Rare','Rare Rainbow','Radiant Rare','Amazing Rare','Shiny rare','Shiny Ultra Rare','Mega Hyper Rare','Rare Holo GX','Rare Holo LV.X','Rare Prime','LEGEND','Rare BREAK','Rare Prism Star','Rare Shining','Classic Collection','Full Art Trainer','Black White Rare','Crown','None'];
const rarityMaps=new Map();
export function ptcgSetRarities(setId,total,fetcher=fetch){
 if(!/^[a-z0-9.-]{1,40}$/i.test(setId||''))return Promise.resolve(new Map());
 if(rarityMaps.has(setId))return rarityMaps.get(setId);
 const job=(async()=>{const map=new Map();
  for(let i=0;i<PTCG_RARITY_ORDER.length&&!(total&&map.size>=total);i+=8){
   const batch=PTCG_RARITY_ORDER.slice(i,i+8),lists=await Promise.all(batch.map(r=>fetcher(`https://api.tcgdex.net/v2/en/cards?set.id=eq:${encodeURIComponent(setId)}&rarity=eq:${encodeURIComponent(r)}`,{signal:AbortSignal.timeout(8000)}).then(x=>x.ok?x.json():[]).catch(()=>[])));
   batch.forEach((r,k)=>{for(const c of Array.isArray(lists[k])?lists[k]:[])if(c?.id)map.set(String(c.id),r);});
   if(!total)break;
  }
  return map;})();
 job.catch(()=>rarityMaps.delete(setId));rarityMaps.set(setId,job);return job;
}
// A Yu-Gi-Oh! card printed in several rarities in one set (Rarity Collection, reprint sets) is pulled
// in one of them, weighted by how rare it is. Display only: nothing is saved or priced from it.
const YGO_RARITY_WEIGHT={common:50,shortprint:20,rare:20,superrare:12,ultrarare:6,secretrare:3,collectorsrare:1,prismaticsecretrare:1,platinumsecretrare:.5,quartercenturysecretrare:.4,ultimaterare:1,ghostrare:.3,starlightrare:.05,goldrare:3};
// prefer: a rarity to pull when this set printed the card in it (today's pack pulls the Card of the Day
// in the rarity shown on Home).
export function rollYgoPrinting(card,random=packRandom,prefer=''){
 // A card printed once in the set is pulled in that printing too: without a chosen printing its foil
 // (and price) cannot be resolved and the card shows plain.
 const prints=(card.setContext?.printings||[]).filter(p=>p?.rarity);if(!prints.length||card.setContext?.printing)return card;
 const weight=p=>YGO_RARITY_WEIGHT[R(p.rarity)]??2,total=prints.reduce((n,p)=>n+weight(p),0);let r=random()*total,chosen=prints.at(-1);
 const wanted=prefer&&prints.find(p=>R(p.rarity)===R(prefer));
 if(wanted)chosen=wanted;else for(const p of prints){r-=weight(p);if(r<=0){chosen=p;break;}}
 return {...card,rarity:chosen.rarity,sets:[chosen],setContext:{...card.setContext,printings:[chosen],printing:chosen,printingAmbiguous:false,pulled:true}};
}
export function samplePack(game,cards,count,random=packRandom,set={}){
 let slots=slotsFor(game,set);count??=slots.length||10;if(!slots.length)return sampleSetCards(cards,count,random);
 const pool=[...new Map(cards.filter(c=>c?.id&&c.name).map(c=>[String(c.id),game==='ygo'?rollYgoPrinting(c,random):c])).values()],used=new Set(),picks=[],rarityOf=c=>R(packRarity(game,c).label);
 const g=GOD[game],godSlots=g?slots.slice(0,count).filter(s=>g.all||s.role).length:0;
 const god=!!g&&random()<g.odds&&pool.filter(c=>g.slot.w[rarityOf(c)]).length>=godSlots;
 // A Magic god pack keeps its foil slot foil.
 if(god)slots=slots.map(s=>g.all||s.role?(s.role==='foil'?{...g.slot,role:'foil'}:g.slot):s);
 for(let {w,role,odds} of slots.slice(0,count)){
  if(role==='maybefoil')({w,role}=random()<(odds??DRAFT_FOIL_ODDS)?DRAFT_FOIL:slot({common:1}));
  // Odds are per rarity, not per card: roll the rarity among those this set has, then one of its cards.
  const groups=new Map();for(const c of pool)if(!used.has(String(c.id))&&w[rarityOf(c)]){const k=rarityOf(c);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(c);}
  let pick=null;
  if(groups.size){const keys=[...groups.keys()],total=keys.reduce((n,k)=>n+w[k],0);let r=random()*total,key=keys.at(-1);for(const k of keys){r-=w[k];if(r<=0){key=k;break;}}const list=groups.get(key);pick=list[Math.floor(random()*list.length)];}
  // A slot whose rarities this set lacks takes the plainest rarity the set has (hit and foil slots: any
  // card), so a set without uncommons never fills them, or its reverse holos, with ex cards.
  if(!pick){let rest=pool.filter(c=>!used.has(String(c.id)));if(!rest.length)break;
   if(role!=='hit'&&role!=='foil'){const rank=c=>packRarity(game,c).rank||0,low=Math.min(...rest.map(rank));rest=rest.filter(c=>rank(c)===low);}
   pick=rest[Math.floor(random()*rest.length)];}
  used.add(String(pick.id));picks.push(role?{...pick,packSlot:role}:pick);
 }
 if(god)picks.godPack=true;
 return picks;
}
export function packRarity(game,card){
 const p=card.setContext?.printing,prints=card.setContext?.printings||[],rarities=[...new Set(prints.map(x=>x.rarity).filter(Boolean))];
 const label=game==='ygo'?p?.rarity||(rarities.length===1?rarities[0]:''):card.rarity;
 return {label:label?(game==='ygo'?ygoRarity(label):label):'Rarity unconfirmed',rank:label?rarityTier(game,label):0};
}
export function packList(cards){const names=new Map();for(const c of cards)names.set(c.name,(names.get(c.name)||0)+1);return [...names].map(([name,n])=>`${n} ${name}`);}
// Product photos come with studio background and padding around the pack. Trim them to the pack itself
// so it fills its outline: the corners give the background colour, and the crop keeps everything that
// differs from it. Cross-origin or blank images are left exactly as they are.
const trimmed=new WeakSet();
export function trimPackArt(img){
 if(!img?.naturalWidth||trimmed.has(img))return;trimmed.add(img);
 try{
  const W=img.naturalWidth,H=img.naturalHeight,k=Math.min(1,320/Math.max(W,H)),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(img,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
  const at=(i,j)=>(j*w+i)*4,bg=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]].map(([i,j])=>[d[at(i,j)],d[at(i,j)+1],d[at(i,j)+2]]);
  const ref=[0,1,2].map(n=>bg.reduce((s,b)=>s+b[n],0)/4);if(bg.some(b=>Math.abs(b[0]-ref[0])+Math.abs(b[1]-ref[1])+Math.abs(b[2]-ref[2])>36))return;
  const fg=(i,j)=>{const o=at(i,j);return d[o+3]>24&&Math.abs(d[o]-ref[0])+Math.abs(d[o+1]-ref[1])+Math.abs(d[o+2]-ref[2])>48;};
  const busy=(n,col)=>{let hits=0,len=col?h:w;for(let m=0;m<len;m++)if(col?fg(n,m):fg(m,n))hits++;return hits>len*.02;};
  let l=0,r=w-1,t=0,b=h-1;while(l<r&&!busy(l,true))l++;while(r>l&&!busy(r,true))r--;while(t<b&&!busy(t,false))t++;while(b>t&&!busy(b,false))b--;
  const cw=r-l+1,ch=b-t+1;if(cw<w*.3||ch<h*.3||cw*ch>w*h*.94)return;
  const o=document.createElement('canvas'),sx=W/w,sy=H/h;o.width=Math.round(cw*sx);o.height=Math.round(ch*sy);
  o.getContext('2d').drawImage(img,l*sx,t*sy,cw*sx,ch*sy,0,0,o.width,o.height);
  o.toBlob(blob=>{if(!blob||!img.isConnected)return;const url=URL.createObjectURL(blob);
   // Once decoded the picture no longer needs its object URL; release it so long sessions don't accumulate them.
   const done=()=>URL.revokeObjectURL(url);img.addEventListener('load',done,{once:true});img.addEventListener('error',done,{once:true});img.src=url;img.dataset.trimmed='1';},'image/png');
 }catch{}
}
// The real booster pack for this set (TCGplayer product art, served same-origin by the worker).
export function packArtUrl(game,set={}){
 const q=new URLSearchParams(),code=String(set.code||set.id||'').toLowerCase();
 if(/^[a-z0-9]{1,8}$/.test(code))q.set('code',code);if(set.name)q.set('name',String(set.name).slice(0,120));
 // Android's image cache accepts percent-encoded queries, but rejects form-style
 // '+' spaces and literal '*'. Keep the same set name on both runtimes.
 const query=q.toString().replace(/\+/g,'%20').replace(/\*/g,'%2A');
 return query?`/img/pack/${game}.jpg?${query}`:'';
}
// Which cards come out shiny, the way real boosters work: holo-only Pokémon (holo rares, full arts) in
// their foil, Pokémon reverse slots as reverse holos, and Magic's foil slot in traditional foil.
// The finish a pulled card came out in, named next to its rarity: reverse holos and holos for
// Pokémon (unless the rarity already says Holo), foils and etched foils for Magic. Yu-Gi-Oh! rarities
// already name their finish.
export function packFinishLabel(game,pulled={},rarity=''){
 if(game==='ptcg'){if(pulled.priceFinish==='reverse-holofoil')return 'Reverse Holo';if(pulled.priceFinish==='holofoil'&&!/holo/i.test(rarity))return 'Holo';}
 if(game==='mtg'){if(pulled.finish==='foil')return 'Foil';if(pulled.finish==='etched')return 'Etched foil';}
 return '';
}
export function packFinishes(game,picks){
 const has=(c,k)=>finishChoices(game,c,{}).some(v=>v.key===k&&v.status!=='unknown');
 return picks.map(c=>{
  // A reverse slot is a reverse holo even when the card is a rare that also comes in holo.
  if(game==='ptcg'&&c.packSlot==='reverse'&&has(c,'reverse-holofoil'))return {priceFinish:'reverse-holofoil'};
  if(game==='ptcg'&&has(c,'holofoil')&&!has(c,'normal'))return {priceFinish:'holofoil'};
  // A foil sheet's card comes out foil (or etched, when that is its only foil finish).
  if(game==='mtg'&&(c.packSlot==='foil'||c.packFoil))return c.finishes?.includes('foil')?{finish:'foil'}:c.finishes?.includes('etched')?{finish:'etched'}:{};
  return {};
 });
}
// A pulled card's full record is loaded when it can shine (a shiny slot, rarity, or the featured hit) and its
// list entry carries no variants to pick a holo or reverse holo from.
export function packNeedsHydration(game,c,hit=false){return !c.variants?.length&&(hit||!!c.packSlot||packRarity(game,c).rank>=2);}
// The featured hit's finish: its first real foil, or null when it has none (yet).
export function packHitFinish(game,c){const f=finishChoices(game,c,{}).find(v=>v.status!=='unknown'&&v.effect!=='plain');return f?game==='mtg'?{finish:f.key}:game==='ptcg'?{priceFinish:f.key}:{}:null;}
// The price a pull's haptic may trust: only the exact pulled finish or printing, never packPrice's display
// fallbacks (a card's generic price, another printing). Unknown means the ordinary flip.
export function trustedPackPrice(game,c,pulled={}){
 const n=v=>{const x=Number(v);return Number.isFinite(x)&&x>0?x:null;};
 if(game==='mtg')return n(pulled.finish==='foil'?c?.prices?.usd_foil:pulled.finish==='etched'?c?.prices?.usd_etched:c?.prices?.usd);
 if(game==='ptcg'){const key=pulled.priceFinish||(c?.variants?.some(v=>v.key==='normal')?'normal':'');const v=key&&(c?.variants||[]).find(x=>x.key===key);return v?n(v.usd??v.market):null;}
 return n(ygoSetReference(c)?.low);
}
// One reveal, one feel: ordinary pulls get the plain flip; a trusted $10+ pull gets a distinct accent, a little
// richer at $50 and $200, never longer or harsher with value.
export function packRevealHaptic(price){const t=priceTier(price);return t>=4?'pack-value-4':t===3?'pack-value-3':t===2?'pack-value-2':'pack-reveal';}
// featured: a card to pull as this pack's last card (today's pack always holds the Card of the Day).
// The pulled card's market price for what came out of the pack (its finish or printing), or null.
export function packPrice(game,c,pulled={}){
 const n=v=>{const x=Number(v);return x>0?x:null;};
 if(game==='mtg')return n(pulled.finish==='foil'?c.prices?.usd_foil:pulled.finish==='etched'?c.prices?.usd_etched:c.prices?.usd)??n(c.prices?.usd);
 if(game==='ptcg'){const v=(c.variants||[]).find(x=>x.key===pulled.priceFinish);return n(v?.usd??v?.market)??n(c.prices?.usd);}
 // Yu-Gi-Oh!: the pulled printing's own reference (its lowest edition), never another printing's.
 return n(ygoSetReference(c)?.low)??n(c.setContext?.printing?.price)??null;
}
// Set symbol sources, best first: Magic's Scryfall symbol, or Pokémon's symbol from the site, pokesymbols.com, then TCGdex.
const setEmblems=(game,set)=>game==='mtg'&&/^[a-z0-9]{2,8}$/i.test(set.code||'')?[`https://svgs.scryfall.io/sets/${encodeURIComponent(String(set.code).toLowerCase())}.svg`]:game==='ptcg'?pkCatalogueSymbolSources(set):[];
// hydrate: loads a pulled card's full record (Pokémon set lists carry no variants), so its holo or
// reverse holo can be drawn. booster: a Magic set's real booster sheets ({data, cards} from mtg-boosters.js).
export function openPackPreview({game,set,cards,complete=false,featured=null,hydrate=null,booster=null,onDetails,onWishlist,onCopy,onBuy,isCurrent=()=>true}){
 // A set page tags its cards with the release they were listed under; only a Yu-Gi-Oh! printing needs
 // it. Elsewhere that unverified tag would hide the pulled card's foil, so the pack goes without it.
 if(game!=='ygo'){cards=cards.map(({setContext,...c})=>c);if(featured){const {setContext,...f}=featured;featured=f;}}
 // A Yu-Gi-Oh! card in this pack was printed in this release by definition, so its release is the
 // verified one (display only), and its pulled printing's foil can show.
 // The pack's own release date stands in when a card's context lacks one: star and Attribute foil depend on the print era.
 const inRelease=c=>c?.setContext?.releaseId?{...c,setContext:{...c.setContext,game:'ygo',cardId:c.id,status:'resolved',date:c.setContext.date||set?.date||''}}:c;
 if(game==='ygo'){cards=cards.map(inRelease);featured=featured&&rollYgoPrinting(inRelease(featured),packRandom,featured.featuredRarity);}
 const size=packSize(game,set),draw=()=>{if(!booster)return samplePack(game,cards,size,packRandom,set);const p=drawMtgBooster(booster.data,booster.cards,packRandom);return packRandom()<GOD.mtg.odds&&mtgGodPack(p,[...cards,...booster.cards.values()])||p;};
 let picks=draw();
 // Today's pack: the Card of the Day takes the hit's place.
 if(featured){picks=booster?[...picks.slice(0,-1).filter(c=>String(c.id)!==String(featured.id)),featured]:[...samplePack(game,cards.filter(c=>String(c.id)!==String(featured.id)),size-1,packRandom,set).slice(0,size-1),featured];}if(!picks.length)throw Error('Load this set’s cards first.');
 const dialog=document.createElement('dialog');dialog.className='pack-dialog';dialog.dataset.game=game;dialog.setAttribute('aria-label',`${set.name} pack`);
 const reduce=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const cardArt=c=>game==='mtg'?cardImage(c,'normal'):c.imageLarge||c.image||'';
 const fallback=setArtworkSources(game,set,picks[0]),packArt=packArtUrl(game,set),sources=[packArt,...fallback].filter(Boolean);
 let revealed=new Set(),focus=0,ctxs=packFinishes(game,picks),disposed=false,busy=false;
 // The featured hit comes out in its foil when it has one (a Pokémon set list carries no variants, so its
 // foil is picked again once the full card loads).
 const featuredFinish=c=>packHitFinish(game,c);
 if(featured){const f=featuredFinish(featured);if(f)ctxs[picks.length-1]=f;}
 // Face-down cards wear the game's own card back (same-origin from the worker); the emblem stays beneath if it can't load.
 const back=`<span class="pack-card-back" data-back="${esc(game)}">${brandStaticMark()}<img class="pack-back-img" src="/img/back/${esc(game)}.jpg" alt="" decoding="async" onerror="this.remove()"></span>`;
 const hand=()=>picks.map((c,i)=>{return `<button class="pack-card" data-pack="reveal" data-index="${i}" data-hold-card style="--i:${i}" aria-label="Card ${i+1}, face down" aria-pressed="false">${back}<span class="pack-card-front"><img data-pack-src="${esc(setImageUrl(cardArt(c)))}" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true"></span></button>`;}).join('');
 dialog.innerHTML=`<header class="pack-header"><div class="pack-title">${(([first,...rest])=>first?`<img class="pack-emblem" data-game="${esc(game)}" src="${esc(first)}" data-alt="${esc(rest.join(' '))}" alt="" referrerpolicy="no-referrer" onerror="const n=this.dataset.alt.split(' ').filter(Boolean);if(n.length){this.src=n.shift();this.dataset.alt=n.join(' ')}else this.remove()">`:'')(setEmblems(game,set))}<h2>${esc(set.name)}</h2><p class="pack-explanation">${booster?'Free preview drawn from this set’s real booster sheets and pull rates (MTGJSON). Nothing is added to your collection.':'Free preview with approximate pull rates, not a real booster. Nothing is added to your collection.'}</p></div><div class="pack-header-tools"><button type="button" class="pack-tilt" title="Tilt your device to move the foil light" hidden>Enable tilt</button><button class="icon" data-pack="close" aria-label="Close pack">✕</button></div></header>
<div class="pack-sealed"><button class="pack-wrapper" data-pack="open" aria-label="Open the ${esc(set.name)} pack"><span class="pack-body"><span class="pack-wrap-art">${sources.length?`<img data-pack-art src="${esc(safeHref(setImageUrl(sources[0])))}" data-sources="${esc(JSON.stringify(sources))}" alt="" referrerpolicy="no-referrer" onerror="const s=JSON.parse(this.dataset.sources),i=(+this.dataset.i||0)+1;if(s[i]){this.dataset.i=i;this.src=s[i];this.closest('.pack-wrapper').classList.add('pack-generic');}else this.hidden=true">`:''}<span class="pack-wrap-brand">${brandStaticMark()}<b>${esc(set.name)}</b></span></span><span class="pack-crimp top"></span><span class="pack-crimp bottom"></span><span class="pack-sheen"></span><span class="pack-slice"></span><span class="pack-flash"></span></span></button></div>
<div class="pack-content" hidden><div class="pack-focus"><button class="pack-focus-card" data-pack="focus" data-hold-card aria-label="Card 1"><i class="pack-backlight" aria-hidden="true"></i><i class="pack-frame" aria-hidden="true"></i><span class="pack-face" data-finish-surface="pack"><img alt="" referrerpolicy="no-referrer"><i class="fx-catch" aria-hidden="true"></i></span>${back}<i class="pack-rays" aria-hidden="true"></i></button><p class="pack-focus-meta" aria-live="polite"><b></b><span class="pack-rarity"></span></p></div><div class="pack-hand" role="group" aria-label="Cards in this pack" style="--pack-n:${picks.length}">${hand()}</div>
<div class="pack-actions"><button class="btn ghost pack-reveal-all" data-pack="reveal-all">Reveal all</button><div class="pack-tools" role="group" aria-label="This pack"><button class="pack-tool" data-pack="copy" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6.5A2.5 2.5 0 0 0 13.5 4h-7A2.5 2.5 0 0 0 4 6.5v7A2.5 2.5 0 0 0 6.5 16H8"/></svg><span>Copy list</span></button><button class="pack-tool" data-pack="wish" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg><span>Wishlist all</span></button><button class="pack-tool" data-pack="buy" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l-1.4 9.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg><span>Shop list</span></button></div><button class="btn pack-again" data-pack="again">Open a new pack</button></div></div><p class="pack-status" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);dialog.tabIndex=-1;dialog.showModal();dialog.focus({preventScroll:true});
 const status=dialog.querySelector('.pack-status'),focusCard=dialog.querySelector('.pack-focus-card'),face=focusCard.querySelector('.pack-face'),faceImg=face.querySelector('img'),meta=dialog.querySelector('.pack-focus-meta');
 const ref=i=>({game,card:picks[i],dataset:{}});
 // Foil pass: a light catch crosses the big card when it is revealed (no sparkle stars over the real foil).
 // Each card box takes its picture's own proportions (scans are not all exactly 63:88), so the price
 // frame hugs the printed card instead of leaving a gap above and below it.
 const fit=(box,img)=>{if(img.naturalWidth&&img.naturalHeight)box.style.aspectRatio=`${img.naturalWidth}/${img.naturalHeight}`;};
 faceImg.addEventListener('load',()=>fit(focusCard,faceImg));
 dialog.querySelectorAll('.pack-card img[data-pack-src]').forEach(img=>img.addEventListener('load',()=>fit(img.closest('.pack-card'),img)));
 // Long-press / right-click on any card opens the same card actions as everywhere else.
 const wireHold=()=>{dialog.querySelectorAll('.pack-card').forEach((b,i)=>{b.quickRef=ref(i);});};wireHold();
 // Price tier of a pulled card: the same colours as the collection's borders; unpriced cards stay neutral.
 const tierOf=i=>{const p=packPrice(game,picks[i],ctxs[i]||{});return p?TIERS[priceTier(p)].key:'tn';};
 const setTier=(el,t)=>{if(t){el.dataset.tier=t;el.style.setProperty('--tier',t==='tn'?'#8b939c':TIERS[+t.slice(1)].color);}else{delete el.dataset.tier;el.style.removeProperty('--tier');}};
 const show=i=>{
  focus=Math.max(0,Math.min(picks.length-1,i));const c=picks[focus],open=revealed.has(focus),rarity=packRarity(game,c);
  dialog.querySelectorAll('.pack-card').forEach((b,j)=>{const d=j-focus,edge=(d<0&&j===0)||(d>0&&j===picks.length-1);b.classList.toggle('focused',j===focus);b.style.setProperty('--d',d);
   // Like a hand in Arena: the cards beside the raised one part to make room for it, less the further out they are.
   b.style.setProperty('--push',d&&!edge?Math.sign(d)*Math.max(0,1-(Math.abs(d)-1)*.45):0);});
  focusCard.quickRef=ref(focus);focusCard.classList.toggle('revealed',open);// Once flipped, the card wears the collection's price frame with its glow behind it.
  setTier(focusCard,open?tierOf(focus):'');
  focusCard.setAttribute('aria-label',open?`${c.name}. Open card`:`Card ${focus+1}, face down. Reveal`);
  if(open){const src=setImageUrl(cardArt(c));if(faceImg.getAttribute('src')!==src)faceImg.src=src;const attrs=finishAttrs(game,c,ctxs[focus],'pack');const tmp=document.createElement('span');tmp.innerHTML=`<i ${attrs}></i>`;const i2=tmp.firstChild;for(const a of ['data-finish-game','data-finish-effect','data-finish-model'])face.setAttribute(a,i2.getAttribute(a));face.dataset.finishSurface='pack';}
  else{face.removeAttribute('data-finish-model');faceImg.removeAttribute('src');focusCard.style.removeProperty('aspect-ratio');}
  // A face-down hit glows before it is flipped, so the next tap feels worth it.
  const tease=!open&&rarity.rank>=2;if(tease&&!focusCard.classList.contains('pack-tease')&&dialog.classList.contains('pack-dealt')){haptic('pack-land');appSound('PACK-003',{volume:.5,gap:600});}focusCard.classList.toggle('pack-tease',tease);
  focusCard.classList.toggle('pack-foil',open&&!!face.dataset.finishEffect&&face.dataset.finishEffect!=='plain');
  meta.querySelector('b').textContent=open?c.name:'';meta.querySelector('.pack-rarity').innerHTML=open?rarityEmblem(game,rarity.label,{finish:packFinishLabel(game,ctxs[focus]||{},rarity.label)}):'';
 };
 // Pulled shiny slots load their full card in the background and pick up their holo before they are seen.
 let deal=0;const fill=()=>{if(!hydrate)return;const n=++deal,now=picks;now.forEach((c,i)=>{const hit=!!featured&&c===featured;if(!packNeedsHydration(game,c,hit))return;
  Promise.resolve().then(()=>hydrate(c)).then(full=>{if(disposed||n!==deal||!full||String(full.id)!==String(c.id))return;
   const {setContext,...rest}=full;now[i]={...c,...rest,name:c.name,rarity:c.rarity||full.rarity,packSlot:c.packSlot};ctxs[i]=(hit&&featuredFinish(now[i]))||packFinishes(game,[now[i]])[0];if(revealed.has(i))setTier(dialog.querySelector(`.pack-card[data-index="${i}"]`),tierOf(i));if(focus===i&&revealed.has(i))show(i);}).catch(()=>{});});};
 // A pull feels as good as its price or its rarity, whichever is bigger, so an unpriced mythic still hits hard.
 const RARITY_FEEL=['pack-reveal','pack-reveal','pack-value-2','pack-value-3','pack-value-4'],FEELS=['pack-reveal','pack-value-2','pack-value-3','pack-value-4'];
 const feelOf=i=>{const byPrice=packRevealHaptic(trustedPackPrice(game,picks[i],ctxs[i]||{})),byRarity=RARITY_FEEL[Math.min(4,packRarity(game,picks[i]).rank)];return FEELS.indexOf(byRarity)>FEELS.indexOf(byPrice)?byRarity:byPrice;};
 const reveal=(i,{silent=false}={})=>{if(!Number.isInteger(i)||!picks[i])return;if(!revealed.has(i)){revealed.add(i);if(!silent){const f=feelOf(i);haptic(f);appSound(PACK_SOUND[f]||'PACK-006');}const b=dialog.querySelector(`.pack-card[data-index="${i}"]`),img=b.querySelector('img[data-pack-src]');img.src=img.dataset.packSrc;b.classList.add('revealed');flipLift(b,22);if(!silent)flipLift(focusCard,3);b.setAttribute('aria-pressed','true');b.setAttribute('aria-label',picks[i].name+' · revealed');
   setTier(b,tierOf(i));status.textContent=`${revealed.size} of ${picks.length} revealed`;
   if(!silent)later(()=>revealMoment(i),330);
   if(revealed.size===picks.length){dialog.classList.add('pack-done');if(picks.godPack)status.textContent=godPackText(game);for(const x of dialog.querySelectorAll('.pack-actions [disabled]'))x.disabled=false;}}
  show(i);};
 // The flip lands: a light catch and a small pop; a big pull (rare+ or a high price tier) adds rays.
 const revealMoment=i=>{if(reduce()||focus!==i||!revealed.has(i))return;const t=+String(tierOf(i)).slice(1)||0,big=packRarity(game,picks[i]).rank>=3||t>=3;
  if(big){showcase=performance.now();if(!raf)raf=requestAnimationFrame(light);
   // On a phone that can tilt but hasn't turned it on, the tilt button glows to invite playing with the foil.
   const tb=dialog.querySelector('.pack-tilt');if(tb&&!tb.hidden&&tb.getAttribute('aria-pressed')!=='true')tb.classList.add('pack-tilt-hint');}
  catchLight(focusCard);focusCard.classList.remove('pack-pop','pack-hit-big');void focusCard.offsetWidth;focusCard.classList.add('pack-pop');if(big)focusCard.classList.add('pack-hit-big');
  later(()=>focusCard.classList.remove('pack-pop'),450);later(()=>focusCard.classList.remove('pack-hit-big'),1700);};
 fill();
 // Feel: the tear as the seam opens, a few dry contacts as the cards settle (not one per card, which would blur into
 // a buzz), one contact per first reveal. Anything pending stops when the pack closes or a card page opens over it.
 const timers=new Set();let opening=false,skipDeal=null;
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);if(!disposed)fn();},ms);timers.add(t);};
 const quiet=()=>{for(const t of timers)clearTimeout(t);timers.clear();cancelHaptics();};
 const open=()=>{if(opening||disposed||!dialog.querySelector('.pack-content').hidden)return;opening=true;const w=dialog.querySelector('.pack-wrapper');
  const done=()=>{opening=false;const from=w.getBoundingClientRect(),motion=!reduce();
   // The torn pack stays where it was while the cards fly out of its open top, then sinks away.
   let ghost=null;if(motion){ghost=w.cloneNode(true);ghost.className='pack-wrapper pack-ghost';ghost.removeAttribute('data-pack');ghost.setAttribute('aria-hidden','true');ghost.tabIndex=-1;
    Object.assign(ghost.style,{position:'fixed',left:from.left+'px',top:from.top+'px',width:from.width+'px',height:from.height+'px',margin:'0'});dialog.append(ghost);}
   w.classList.remove('tearing');dialog.querySelector('.pack-sealed').hidden=true;dialog.querySelector('.pack-content').hidden=false;dialog.classList.add('pack-dealt','pack-dealing');show(0);focusCard.focus({preventScroll:true});
   if(!motion){dialog.classList.remove('pack-dealing');return;}
   dialog.classList.add('pack-flying');
   const cards=[...dialog.querySelectorAll('.pack-card')],n=cards.length,mid=(n-1)/2,gap=Math.min(85,1100/Math.max(1,n)),fly=640,last=(n-1)*gap+fly;
   cards.forEach((b,i)=>{const c=b.getBoundingClientRect(),cx=c.left+c.width/2,cy=c.top+c.height/2,ox=from.left+from.width/2-cx,k=Math.min(1.6,from.width*.78/Math.max(1,c.width));
    // Out of the top: the card slides up from inside the pack, clears the opening, then arcs down into its place.
    const inside=from.top+from.height*.42-cy,above=from.top-c.height*k*.32-cy,spread=(i-mid)*Math.min(14,from.width*.05);
    b.animate([{transform:`translate(${ox}px,${inside}px) scale(${k})`,zIndex:0,opacity:1,offset:0},{transform:`translate(${ox+spread*.4}px,${above}px) rotate(${(i-mid)*1.5}deg) scale(${k*.92})`,zIndex:0,opacity:1,offset:.34},{transform:`translate(${ox+spread}px,${above}px) rotate(${(i-mid)*3}deg) scale(${k*.9})`,zIndex:200,offset:.4},{zIndex:200,offset:.97}],
     {duration:fly,delay:i*gap,easing:'cubic-bezier(.3,.7,.25,1)',fill:'backwards'});
    later(()=>{if(suspended)return;appSound('PACK-005',{volume:.5,rate:1+i*.02,gap:0});if(i===0||i===n-1||i%3===0)haptic('pack-land');},i*gap+fly-40);});
   // Rotating or unfolding mid-deal moves the layout away from the pack's old place: the torn pack just goes.
   const dropGhost=()=>ghost.remove();addEventListener('resize',dropGhost,{once:true});
   ghost.animate([{transform:'none',opacity:1},{transform:'none',opacity:1,offset:Math.min(.8,(n*gap)/(last+260))},{transform:'translateY(36%) scale(.9)',opacity:0}],{duration:last+260,easing:'cubic-bezier(.45,0,.55,1)',fill:'forwards'}).finished.catch(()=>{}).then(()=>{removeEventListener('resize',dropGhost);ghost.remove();});
   // The big card comes up once the hand has landed, face down and ready to turn over.
   focusCard.classList.add('pack-await');
   const landed=()=>{if(!dialog.classList.contains('pack-flying'))return;dialog.classList.remove('pack-flying','pack-dealing');focusCard.classList.remove('pack-await');focusCard.classList.add('pack-rising');later(()=>focusCard.classList.remove('pack-rising'),480);};
   // A tap during the deal skips it, as in Arena: every card lands at once and the big card comes up.
   skipDeal=()=>{skipDeal=null;for(const b of cards)for(const a of b.getAnimations())if(!(a instanceof CSSAnimation))a.finish();for(const a of ghost.getAnimations())a.finish();landed();};
   later(()=>{skipDeal=null;landed();},last);};
  haptic('pack-tear');appSound('PACK-004');
  if(reduce()){done();return;}w.classList.add('tearing');later(done,440);};
 // Turning a card over: it lifts off the table as it flips and settles back down.
 const flipLift=(el,lift)=>{if(reduce()||!el?.animate)return;el.animate([{translate:'0 0',rotate:'0deg'},{translate:`0 ${-lift}%`,rotate:'-1.5deg',offset:.42},{translate:'0 0',rotate:'0deg'}],{duration:560,easing:'cubic-bezier(.3,.7,.3,1)',composite:'add'});};
 const close=()=>{if(disposed)return;quiet();disposed=true;cancelAnimationFrame(raf);stopTilt();dialog.close();dialog.remove();};
 // Inspecting a pulled card opens its page above the pack. The pack stays exactly as it is underneath (same pulls,
 // reveals, focused card, nothing re-dealt or replayed), paused while covered, and is back when that page closes.
 let suspended=false;
 const resume=()=>{if(disposed||!suspended)return;suspended=false;dialog.classList.remove('pack-under');if(!raf)raf=requestAnimationFrame(light);focusCard.focus({preventScroll:true});};
 const inspect=i=>{
  if(suspended)return;suspended=true;quiet();dialog.classList.add('pack-under');cancelAnimationFrame(raf);raf=0;
  const sheet=document.querySelector('#sheet');
  Promise.resolve().then(()=>onDetails(picks[i],ctxs[i]||{})).catch(()=>{}).then(()=>{
   if(disposed)return;
   // The page may not open (offline, changed account): the pack comes straight back.
   if(sheet?.open)sheet.addEventListener('close',resume,{once:true});else resume();
  });
 };
 // Light follows the pointer (or tilt) over the focused card; at rest it drifts slowly.
 let raf=0,t0=performance.now(),pointer=null,showcase=0;
 const light=now=>{raf=0;if(disposed||suspended||!dialog.isConnected)return;
  // While the phone's tilt drives the card, the resting drift steps aside.
  if(!pointer&&/perspective/.test(focusCard.style.transform)){raf=requestAnimationFrame(light);return;}// A big pull shows itself off: the card sways once and the light rolls across its foil.
  const sp=showcase&&!pointer?(now-showcase)/1100:1;if(sp>=1)showcase=0;const sway=sp<1?Math.sin(sp*Math.PI*2.5)*(1-sp):0;
  const [x,y]=pointer||(sp<1?[50+sway*46,40-sway*12]:[50+44*Math.sin((now-t0)/1500),42+30*Math.sin((now-t0)/2100)]);focusCard.style.setProperty('--mx',x+'%');focusCard.style.setProperty('--my',y+'%');
  // Only a pointer tilts the card; at rest just the light drifts, so the card itself stays still.
  if(!reduce()){focusCard.style.transform=pointer?`rotateY(${(x-50)/6}deg) rotateX(${(50-y)/8}deg)`:sway?`rotateY(${sway*14}deg) rotateX(${sway*-4}deg)`:'';if(!pointer)raf=requestAnimationFrame(light);}};
 focusCard.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=focusCard.getBoundingClientRect();pointer=[(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100];if(!raf)raf=requestAnimationFrame(light);});
 focusCard.addEventListener('pointerleave',()=>{pointer=null;if(!raf)raf=requestAnimationFrame(light);});
 raf=requestAnimationFrame(light);
 // Swipe the big card to move through the pack; drag along the hand to scrub.
 // The big card follows the finger sideways while it is dragged, then slides on or springs back.
 let swipe=null;focusCard.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY,moved:false,touch:e.pointerType!=='mouse'};});
 focusCard.addEventListener('pointermove',e=>{if(!swipe?.touch||reduce())return;const dx=e.clientX-swipe.x;if(Math.abs(dx)<6||Math.abs(dx)<Math.abs(e.clientY-swipe.y))return;
  focusCard.style.transition='none';focusCard.style.translate=`${dx*.6}px 0`;});
 const settle=()=>{if(!focusCard.style.translate)return;focusCard.style.transition='';focusCard.style.translate='';};
 focusCard.addEventListener('pointerup',e=>{settle();if(!swipe)return;const dx=e.clientX-swipe.x;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(e.clientY-swipe.y)){swipe.moved=true;slide(dx<0?1:-1);}});
 focusCard.addEventListener('pointercancel',()=>{settle();swipe=null;});
 // A swipe slides the big card out and the next one in from that side.
 // The card leaving flicks off the stack with a tilt while the next one comes up from underneath.
 const fling=step=>{if(reduce()||!revealed.has(focus)||!faceImg.currentSrc)return;const r=focusCard.getBoundingClientRect(),f=document.createElement('div');f.className='pack-fling';f.setAttribute('aria-hidden','true');
  Object.assign(f.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});const img=document.createElement('img');img.src=faceImg.currentSrc;img.alt='';f.append(img);dialog.append(f);
  f.animate([{transform:'none',opacity:1},{transform:`translateX(${-step*115}%) translateY(-6%) rotate(${-step*16}deg)`,opacity:0}],{duration:360,easing:'cubic-bezier(.3,.6,.4,1)'}).finished.catch(()=>{}).then(()=>f.remove());};
 const slide=step=>{const next=focus+step;if(next<0||next>=picks.length)return;fling(step);show(next);if(reduce())return;focusCard.classList.remove('pack-slide-next','pack-slide-prev');void focusCard.offsetWidth;focusCard.classList.add(step>0?'pack-slide-next':'pack-slide-prev');};
 focusCard.addEventListener('animationend',e=>{if(/^pack-slide/.test(e.animationName))focusCard.classList.remove('pack-slide-next','pack-slide-prev');});
 // Phones, tablets and foldables can tilt the revealed card to play with its foil.
 const stopTilt=attachZoomMotion({dialog,surface:focusCard,button:dialog.querySelector('.pack-tilt'),active:()=>!disposed&&!suspended&&revealed.has(focus)&&!dialog.querySelector('.pack-content').hidden});
 // The hand follows the mouse (hover raises a card) and the finger: press anywhere on it and slide, and the card
 // under the finger rises and shows above; lifting after a slide keeps that card instead of flipping it.
 const handEl=dialog.querySelector('.pack-hand');let scrub=null,scrubbed=false,scrubFrame=0;
 const under=x=>{const r=handEl.getBoundingClientRect(),w=handEl.querySelector('.pack-card')?.offsetWidth||0,span=Math.max(1,r.width-w);return Math.round((x-r.left-w/2)/span*(picks.length-1));};
 const scrubTo=x=>{if(scrubFrame)return;scrubFrame=requestAnimationFrame(()=>{scrubFrame=0;const i=Math.max(0,Math.min(picks.length-1,under(x)));if(i!==focus){show(i);if(scrub?.touch)haptic('pack-land');}});};
 handEl.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;scrub={x:e.clientX,id:e.pointerId,touch:e.pointerType!=='mouse',moved:false};scrubbed=false;});
 handEl.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons){const b=e.target.closest('.pack-card');if(b&&+b.dataset.index!==focus)show(+b.dataset.index);return;}
  if(!scrub||scrub.id!==e.pointerId)return;if(!scrub.moved&&Math.abs(e.clientX-scrub.x)<8)return;
  if(!scrub.moved){scrub.moved=true;try{handEl.setPointerCapture(e.pointerId);}catch{}}scrubTo(e.clientX);});
 const endScrub=e=>{if(!scrub||scrub.id!==e.pointerId)return;scrubbed=scrub.moved;scrub=null;try{handEl.releasePointerCapture(e.pointerId);}catch{}};
 handEl.addEventListener('pointerup',endScrub);handEl.addEventListener('pointercancel',endScrub);
 // The click that ends a slide is not a tap on the card under the finger.
 handEl.addEventListener('click',e=>{if(scrubbed){scrubbed=false;e.stopPropagation();e.preventDefault();}},true);
 dialog.addEventListener('keydown',e=>{if(dialog.querySelector('.pack-content').hidden)return;if(e.key==='ArrowRight'){e.preventDefault();slide(1);}else if(e.key==='ArrowLeft'){e.preventDefault();slide(-1);}});
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 // A tap during the deal skips it first: every card lands at once, so the tap acts on cards in their real places.
 dialog.addEventListener('pointerdown',()=>skipDeal?.(),true);
 dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-pack]');if(!b||busy)return;const action=b.dataset.pack,i=Number(b.dataset.index);
  if(action==='close')return close();
  if(!isCurrent()){status.textContent='Your account or game changed. Close this pack and open it again.';return;}
  if(action==='open')return open();
  if(action==='reveal')return reveal(i);
  if(action==='focus'){if(swipe?.moved){swipe=null;return;}swipe=null;if(!revealed.has(focus))return reveal(focus);return inspect(focus);}
  // Reveal All is one moment: a single feel for the best newly revealed pull, not every card's at once.
  if(action==='reveal-all'){const order=['pack-reveal','pack-value-2','pack-value-3','pack-value-4'];let best=-1;picks.forEach((_,j)=>{if(!revealed.has(j)){best=Math.max(best,order.indexOf(feelOf(j)));reveal(j,{silent:true});}});if(best>=0){haptic(order[best]);appSound(PACK_SOUND[order[best]]);}show(Math.floor(picks.length/2));return;}
  // A new pack is a new sealed pack: it waits to be torn open, rather than dealing straight away.
  if(action==='again'){quiet();opening=false;picks=draw();ctxs=packFinishes(game,picks);fill();revealed=new Set();dialog.classList.remove('pack-done','pack-dealt');handEl.innerHTML=hand();wireHold();for(const x of dialog.querySelectorAll('[data-pack="copy"],[data-pack="wish"],[data-pack="buy"]'))x.disabled=true;status.textContent='';
   dialog.querySelector('.pack-content').hidden=true;const sealed=dialog.querySelector('.pack-sealed');sealed.hidden=false;sealed.querySelector('.pack-wrapper')?.classList.remove('tearing');sealed.querySelector('.pack-wrapper')?.focus({preventScroll:true});return;}
  if(['copy','wish','buy'].includes(action)&&revealed.size===picks.length){
   busy=true;b.disabled=true;try{if(action==='wish'){await onWishlist(picks);status.textContent='Saved to your wishlist.';b.textContent='On wishlist';}
    else if(action==='copy'){const ok=await onCopy(packList(picks).join('\n'));status.textContent=ok?'Card list copied.':'Could not copy. Select the list below.';if(!ok){const area=document.createElement('textarea');area.readOnly=true;area.value=packList(picks).join('\n');area.setAttribute('aria-label','Pack card list');status.after(area);area.select();}}
    else await onBuy(picks);
   }catch(error){status.textContent=error?.message||'Could not complete this action. Please try again.';}finally{busy=false;b.disabled=false;}
  }
 });
 return close;
}
