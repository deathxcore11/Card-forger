import {esc,safeHref,cardImage} from './ui.js';
import {rarityTier,TIERS} from './tier.js';
import {ygoRarity} from './ygo-identity.js';
import {brandStaticMark} from './brand.js';
import {setArtworkSources,setImageUrl} from './set-experience.js';
import {finishAttrs,finishChoices} from './finish-preview.js';
// A discovery sampler. No collation, print-run odds, purchases or ownership are implied.
export function sampleSetCards(cards,count=10,random=Math.random){
 const pool=[...new Map(cards.filter(c=>c?.id&&c.name).map(c=>[String(c.id),c])).values()];
 for(let i=pool.length-1;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random sample');const j=Math.floor(r*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,Math.max(0,Math.min(20,Math.floor(count)||0)));
}
// Typical booster structure and pull rates, approximate and per era (not official odds): each slot
// draws from cards of the named rarities, weighted, and falls back to any unused card in the set
// when the set has none (all-foil sets, promos). rarity keys are normalised rarity names.
const R=s=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
const PACK_SLOTS={
 mtg:[...Array(6).fill({common:1}),...Array(3).fill({uncommon:1}),{rare:7,mythic:1}],
 ptcg:[...Array(4).fill({common:1}),...Array(3).fill({uncommon:1}),{common:5,uncommon:3,rare:1},
  {common:62,uncommon:30,rare:8,illustrationrare:8.3,specialillustrationrare:1.1},
  {rare:74,rareholo:37,holorare:37,doublerare:17,ultrarare:6.6,hyperrare:.55,raresecret:.55,secretrare:.55,rarerainbow:.8,rareholoex:8,rareholov:8,rareholovmax:4,rareholovstar:4,rareultra:6.6,radiantrare:4,amazingrare:3,acespecrare:4}],
 ygo:[...Array(7).fill({common:1}),{rare:1},{superrare:76,ultrarare:16,secretrare:8,quartercenturysecretrare:1}]
};
// A Yu-Gi-Oh! card printed in several rarities in one set (Rarity Collection, reprint sets) is pulled
// in one of them, weighted by how rare it is. Display only: nothing is saved or priced from it.
const YGO_RARITY_WEIGHT={common:50,shortprint:20,rare:20,superrare:12,ultrarare:6,secretrare:3,collectorsrare:1,prismaticsecretrare:1,platinumsecretrare:.5,quartercenturysecretrare:.4,ultimaterare:1,ghostrare:.3,starlightrare:.05,goldrare:3};
export function rollYgoPrinting(card,random=Math.random){
 const prints=(card.setContext?.printings||[]).filter(p=>p?.rarity);if(prints.length<2||card.setContext?.printing)return card;
 const weight=p=>YGO_RARITY_WEIGHT[R(p.rarity)]??2,total=prints.reduce((n,p)=>n+weight(p),0);let r=random()*total,chosen=prints.at(-1);
 for(const p of prints){r-=weight(p);if(r<=0){chosen=p;break;}}
 return {...card,rarity:chosen.rarity,sets:[chosen],setContext:{...card.setContext,printings:[chosen],printing:chosen,printingAmbiguous:false,pulled:true}};
}
export function samplePack(game,cards,count=10,random=Math.random){
 const slots=PACK_SLOTS[game]||[];if(!slots.length)return sampleSetCards(cards,count,random);
 const pool=[...new Map(cards.filter(c=>c?.id&&c.name).map(c=>[String(c.id),game==='ygo'?rollYgoPrinting(c,random):c])).values()],used=new Set(),picks=[];
 const rarityOf=c=>R(packRarity(game,c).label);
 // A shorter pack (today's pack keeps its last slot for the Card of the Day) drops the hit slot.
 for(const slot of slots.slice(0,count)){
  const options=pool.filter(c=>!used.has(String(c.id))&&slot[rarityOf(c)]);
  let pick=null;
  if(options.length){const total=options.reduce((n,c)=>n+slot[rarityOf(c)],0);let r=random()*total;for(const c of options){r-=slot[rarityOf(c)];if(r<=0){pick=c;break;}}pick??=options.at(-1);}
  if(!pick){const rest=pool.filter(c=>!used.has(String(c.id)));if(!rest.length)break;pick=rest[Math.floor(random()*rest.length)];}
  used.add(String(pick.id));picks.push(pick);
 }
 return picks;
}
export function packRarity(game,card){
 const p=card.setContext?.printing,prints=card.setContext?.printings||[],rarities=[...new Set(prints.map(x=>x.rarity).filter(Boolean))];
 const label=game==='ygo'?p?.rarity||(rarities.length===1?rarities[0]:''):card.rarity;
 return {label:label?(game==='ygo'?ygoRarity(label):label):'Rarity unconfirmed',rank:label?rarityTier(game,label):0};
}
export function packList(cards){const names=new Map();for(const c of cards)names.set(c.name,(names.get(c.name)||0)+1);return [...names].map(([name,n])=>`${n} ${name}`);}
// The real booster pack for this set (TCGplayer product art, served same-origin by the worker).
export function packArtUrl(game,set={}){
 const q=new URLSearchParams(),code=String(set.code||set.id||'').toLowerCase();
 if(/^[a-z0-9]{1,8}$/.test(code))q.set('code',code);if(set.name)q.set('name',String(set.name).slice(0,120));
 return q.toString()?`/img/pack/${game}.jpg?${q}`:'';
}
// Which cards come out shiny, the way real boosters work: rares and holo rares in their foil, plus
// one foil slot (Magic) or reverse-holo slot (Pokémon) on another card. Yu-Gi-Oh! rarity is the printing.
export function packFinishes(game,picks,random=Math.random){
 const has=(c,k)=>finishChoices(game,c,{}).some(v=>v.key===k&&v.status!=='unknown');
 const ctx=picks.map(c=>{
  // A Pokémon card printed only as a holo (holo rares, full arts) always comes out shiny.
  if(game==='ptcg'&&has(c,'holofoil')&&!has(c,'normal'))return {priceFinish:'holofoil'};
  return {};
 });
 const slot=(want,ctxFor)=>{const open=picks.map((c,i)=>i).filter(i=>!Object.keys(ctx[i]).length&&want(picks[i]));if(open.length)ctx[open[Math.floor(random()*open.length)]]=ctxFor;};
 if(game==='mtg')slot(c=>c.finishes?.includes('foil'),{finish:'foil'});
 if(game==='ptcg')slot(c=>has(c,'reverse-holofoil'),{priceFinish:'reverse-holofoil'});
 return ctx;
}
// featured: a card to pull as this pack's last card (today's pack always holds the Card of the Day).
export function openPackPreview({game,set,cards,complete=false,featured=null,onDetails,onWishlist,onCopy,onBuy,isCurrent=()=>true}){
 const size=game==='ygo'?9:10;
 let picks=samplePack(game,cards,size);
 if(featured){picks=[...samplePack(game,cards.filter(c=>String(c.id)!==String(featured.id)),size-1).slice(0,size-1),featured];}if(!picks.length)throw Error('Load this set’s cards first.');
 const dialog=document.createElement('dialog');dialog.className='pack-dialog';dialog.dataset.game=game;dialog.setAttribute('aria-label',`${set.name} pack`);
 const reduce=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const cardArt=c=>game==='mtg'?cardImage(c,'normal'):c.imageLarge||c.image||'';
 const fallback=setArtworkSources(game,set,picks[0]),packArt=packArtUrl(game,set),sources=[packArt,...fallback].filter(Boolean);
 let revealed=new Set(),focus=0,ctxs=packFinishes(game,picks),disposed=false,busy=false;
 // The featured hit comes out in its foil when it has one.
 if(featured){const last=picks.length-1,f=finishChoices(game,featured,{}).find(v=>v.status!=='unknown'&&v.effect!=='plain');if(f)ctxs[last]=game==='mtg'?{finish:f.key}:game==='ptcg'?{priceFinish:f.key}:{};}
 // Face-down cards wear the game's own card back (same-origin from the worker); the emblem stays beneath if it can't load.
 const back=`<span class="pack-card-back" data-back="${esc(game)}">${brandStaticMark()}<img class="pack-back-img" src="/img/back/${esc(game)}.jpg" alt="" decoding="async" onerror="this.remove()"></span>`;
 const hand=()=>picks.map((c,i)=>{const rarity=packRarity(game,c);return `<button class="pack-card" data-pack="reveal" data-index="${i}" data-hold-card style="--i:${i};--pack-glow:${TIERS[Math.min(rarity.rank,5)].color}" aria-label="Card ${i+1}, face down" aria-pressed="false">${back}<span class="pack-card-front"><img data-pack-src="${esc(setImageUrl(cardArt(c)))}" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true"></span></button>`;}).join('');
 dialog.innerHTML=`<header class="pack-header"><div><h2>${esc(set.name)}</h2><p class="pack-explanation">Free preview · approximate pull rates, not a real booster · nothing is added to your collection</p></div><button class="icon" data-pack="close" aria-label="Close pack">✕</button></header>
<div class="pack-sealed"><button class="pack-wrapper" data-pack="open" aria-label="Open the ${esc(set.name)} pack"><span class="pack-body"><span class="pack-wrap-art">${sources.length?`<img src="${esc(safeHref(setImageUrl(sources[0])))}" data-sources="${esc(JSON.stringify(sources))}" alt="" referrerpolicy="no-referrer" onerror="const s=JSON.parse(this.dataset.sources),i=(+this.dataset.i||0)+1;if(s[i]){this.dataset.i=i;this.src=s[i];this.closest('.pack-wrapper').classList.add('pack-generic');}else this.hidden=true">`:''}<span class="pack-wrap-brand">${brandStaticMark()}<b>${esc(set.name)}</b></span></span><span class="pack-crimp top"></span><span class="pack-crimp bottom"></span><span class="pack-sheen"></span></span></button></div>
<div class="pack-content" hidden><div class="pack-focus"><button class="pack-focus-card" data-pack="focus" data-hold-card aria-label="Card 1"><span class="pack-face" data-finish-surface="pack"><img alt="" referrerpolicy="no-referrer"></span>${back}</button><p class="pack-focus-meta" aria-live="polite"><b></b><span></span></p></div><div class="pack-hand" role="group" aria-label="Cards in this pack" style="--pack-n:${picks.length}">${hand()}</div>
<div class="pack-actions"><button class="btn ghost" data-pack="reveal-all">Reveal all</button><button class="btn ghost" data-pack="copy" disabled>Copy list</button><button class="btn ghost" data-pack="wish" disabled>Wishlist all</button><button class="btn ghost" data-pack="buy" disabled>Shop list</button><button class="btn" data-pack="again">New pack</button></div></div><p class="pack-status" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);dialog.tabIndex=-1;dialog.showModal();dialog.focus({preventScroll:true});
 const status=dialog.querySelector('.pack-status'),focusCard=dialog.querySelector('.pack-focus-card'),face=focusCard.querySelector('.pack-face'),faceImg=face.querySelector('img'),meta=dialog.querySelector('.pack-focus-meta');
 const ref=i=>({game,card:picks[i],dataset:{}});
 // Long-press / right-click on any card opens the same card actions as everywhere else.
 const wireHold=()=>{dialog.querySelectorAll('.pack-card').forEach((b,i)=>{b.quickRef=ref(i);});};wireHold();
 const show=i=>{
  focus=Math.max(0,Math.min(picks.length-1,i));const c=picks[focus],open=revealed.has(focus),rarity=packRarity(game,c);
  dialog.querySelectorAll('.pack-card').forEach((b,j)=>{b.classList.toggle('focused',j===focus);b.style.setProperty('--d',j-focus);});
  focusCard.quickRef=ref(focus);focusCard.classList.toggle('revealed',open);focusCard.style.setProperty('--pack-glow',TIERS[Math.min(rarity.rank,5)].color);focusCard.classList.toggle('pack-hit',open&&rarity.rank>=3);
  focusCard.setAttribute('aria-label',open?`${c.name}. Open card`:`Card ${focus+1}, face down. Reveal`);
  if(open){const src=setImageUrl(cardArt(c));if(faceImg.getAttribute('src')!==src)faceImg.src=src;const attrs=finishAttrs(game,c,ctxs[focus],'pack');const tmp=document.createElement('span');tmp.innerHTML=`<i ${attrs}></i>`;const i2=tmp.firstChild;for(const a of ['data-finish-game','data-finish-effect','data-finish-model'])face.setAttribute(a,i2.getAttribute(a));face.dataset.finishSurface='pack';}
  else{face.removeAttribute('data-finish-model');faceImg.removeAttribute('src');}
  meta.querySelector('b').textContent=open?c.name:'';meta.querySelector('span').textContent=open?rarity.label:'';
 };
 const reveal=i=>{if(!Number.isInteger(i)||!picks[i])return;if(!revealed.has(i)){revealed.add(i);const b=dialog.querySelector(`.pack-card[data-index="${i}"]`),img=b.querySelector('img[data-pack-src]');img.src=img.dataset.packSrc;b.classList.add('revealed');b.setAttribute('aria-pressed','true');b.setAttribute('aria-label',picks[i].name+' · revealed');
   if(packRarity(game,picks[i]).rank>=3)b.classList.add('pack-hit');status.textContent=`${revealed.size} of ${picks.length} revealed`;
   if(revealed.size===picks.length){dialog.classList.add('pack-done');for(const x of dialog.querySelectorAll('.pack-actions [disabled]'))x.disabled=false;}}
  show(i);};
 const open=()=>{const w=dialog.querySelector('.pack-wrapper');const done=()=>{dialog.querySelector('.pack-sealed').hidden=true;dialog.querySelector('.pack-content').hidden=false;dialog.classList.add('pack-dealt');show(0);focusCard.focus({preventScroll:true});};
  if(reduce()){done();return;}w.classList.add('tearing');setTimeout(done,620);};
 const close=()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);dialog.close();dialog.remove();};
 // Light follows the pointer (or tilt) over the focused card; at rest it drifts slowly.
 let raf=0,t0=performance.now(),pointer=null;
 const light=now=>{raf=0;if(disposed||!dialog.isConnected)return;const [x,y]=pointer||[50+30*Math.sin((now-t0)/1900),40+20*Math.sin((now-t0)/2700)];focusCard.style.setProperty('--mx',x+'%');focusCard.style.setProperty('--my',y+'%');
  // Only a pointer tilts the card; at rest just the light drifts, so the card itself stays still.
  if(!reduce()){focusCard.style.transform=pointer?`rotateY(${(x-50)/6}deg) rotateX(${(50-y)/8}deg)`:'';if(!pointer)raf=requestAnimationFrame(light);}};
 focusCard.addEventListener('pointermove',e=>{const r=focusCard.getBoundingClientRect();pointer=[(e.clientX-r.left)/r.width*100,(e.clientY-r.top)/r.height*100];if(!raf)raf=requestAnimationFrame(light);});
 focusCard.addEventListener('pointerleave',()=>{pointer=null;if(!raf)raf=requestAnimationFrame(light);});
 raf=requestAnimationFrame(light);
 // Swipe the big card to move through the pack; drag along the hand to scrub.
 let swipe=null;focusCard.addEventListener('pointerdown',e=>{swipe={x:e.clientX,y:e.clientY,moved:false};});
 focusCard.addEventListener('pointerup',e=>{if(!swipe)return;const dx=e.clientX-swipe.x;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(e.clientY-swipe.y)){swipe.moved=true;show(focus+(dx<0?1:-1));}});
 const handEl=dialog.querySelector('.pack-hand');handEl.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons){const b=e.target.closest('.pack-card');if(b)show(+b.dataset.index);return;}if(!e.buttons)return;const r=handEl.getBoundingClientRect();show(Math.round((e.clientX-r.left)/r.width*(picks.length-1)));});
 dialog.addEventListener('keydown',e=>{if(dialog.querySelector('.pack-content').hidden)return;if(e.key==='ArrowRight'){e.preventDefault();show(focus+1);}else if(e.key==='ArrowLeft'){e.preventDefault();show(focus-1);}});
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-pack]');if(!b||busy)return;const action=b.dataset.pack,i=Number(b.dataset.index);
  if(action==='close')return close();
  if(!isCurrent()){status.textContent='Your account or game changed. Close this pack and open it again.';return;}
  if(action==='open')return open();
  if(action==='reveal')return reveal(i);
  if(action==='focus'){if(swipe?.moved){swipe=null;return;}swipe=null;if(!revealed.has(focus))return reveal(focus);close();return onDetails(picks[focus]);}
  if(action==='reveal-all'){picks.forEach((_,j)=>{if(!revealed.has(j))reveal(j);});show(Math.floor(picks.length/2));return;}
  if(action==='again'){picks=samplePack(game,cards,size);ctxs=packFinishes(game,picks);revealed=new Set();dialog.classList.remove('pack-done','pack-dealt');handEl.innerHTML=hand();wireHold();for(const x of dialog.querySelectorAll('[data-pack="copy"],[data-pack="wish"],[data-pack="buy"]'))x.disabled=true;status.textContent='';
   requestAnimationFrame(()=>dialog.classList.add('pack-dealt'));show(0);return;}
  if(['copy','wish','buy'].includes(action)&&revealed.size===picks.length){
   busy=true;b.disabled=true;try{if(action==='wish'){await onWishlist(picks);status.textContent='Saved to your wishlist.';b.textContent='On wishlist';}
    else if(action==='copy'){const ok=await onCopy(packList(picks).join('\n'));status.textContent=ok?'Card list copied.':'Could not copy. Select the list below.';if(!ok){const area=document.createElement('textarea');area.readOnly=true;area.value=packList(picks).join('\n');area.setAttribute('aria-label','Pack card list');status.after(area);area.select();}}
    else await onBuy(picks);
   }catch(error){status.textContent=error?.message||'Could not complete this action. Please try again.';}finally{busy=false;b.disabled=false;}
  }
 });
 return close;
}
