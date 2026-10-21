import {esc,safeHref,cardImage} from './ui.js';
import {rarityTier,TIERS} from './tier.js';
import {ygoRarity} from './ygo-identity.js';
import {brandStaticMark} from './brand.js';
import {setArtworkSources,setImageUrl} from './set-experience.js';
// A discovery sampler. No collation, print-run odds, purchases or ownership are implied.
export function sampleSetCards(cards,count=10,random=Math.random){
 const pool=[...new Map(cards.filter(c=>c?.id&&c.name).map(c=>[String(c.id),c])).values()];
 for(let i=pool.length-1;i>0;i--){const r=random();if(!Number.isFinite(r)||r<0||r>=1)throw Error('Invalid random sample');const j=Math.floor(r*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
 return pool.slice(0,Math.max(0,Math.min(20,Math.floor(count)||0)));
}
export function packRarity(game,card){
 const p=card.setContext?.printing,prints=card.setContext?.printings||[],rarities=[...new Set(prints.map(x=>x.rarity).filter(Boolean))];
 const label=game==='ygo'?p?.rarity||(rarities.length===1?rarities[0]:''):card.rarity;
 return {label:label?(game==='ygo'?ygoRarity(label):label):'Rarity unconfirmed',rank:label?rarityTier(game,label):0};
}
export function packList(cards){const names=new Map();for(const c of cards)names.set(c.name,(names.get(c.name)||0)+1);return [...names].map(([name,n])=>`${n} ${name}`);}
export function openPackPreview({game,set,cards,complete=false,onDetails,onWishlist,onCopy,onBuy,isCurrent=()=>true}){
 const picks=sampleSetCards(cards,10);if(!picks.length)throw Error('Load this set’s cards first.');
 const dialog=document.createElement('dialog');dialog.className='pack-dialog';dialog.setAttribute('aria-label',`${set.name} pack simulator`);
 const revealed=new Set(),art=setArtworkSources(game,set,picks[0])[0],cardArt=c=>game==='mtg'?cardImage(c,'normal'):c.imageLarge||c.image||'';
 dialog.innerHTML=`<header class="pack-header"><span class="pack-brand">${brandStaticMark()}</span><div><p class="eyebrow">PACK SIMULATOR</p><h2>${esc(set.name)}</h2></div><button class="icon" data-pack="close" aria-label="Close pack simulator">✕</button></header><p class="pack-explanation">Explore ${picks.length} random cards from ${complete?'this set':'the loaded part of this set'}. This is a free preview, not a real booster or official pull odds. Nothing is added to your collection.</p><div class="pack-sealed">${art?`<img src="${esc(safeHref(art))}" alt="${esc(set.name)} reference artwork" referrerpolicy="no-referrer" onerror="this.hidden=true">`:''}<span class="pack-seal-brand">${brandStaticMark()}</span><button class="btn" data-pack="open">Open Pack</button></div><div class="pack-content" hidden><p class="pack-hint">Tap a card to reveal it. Hover or focus to catch its rarity glow.</p><div class="pack-grid">${picks.map((c,i)=>{const rarity=packRarity(game,c);return `<article class="pack-slot" style="--pack-glow:${TIERS[Math.min(rarity.rank,5)].color};--deal-order:${i}"><button class="pack-card" data-pack="reveal" data-index="${i}" aria-label="Reveal card ${i+1}" aria-pressed="false"><span class="pack-card-back">${brandStaticMark()}<span>CARDSTASHY</span></span><span class="pack-card-front"><img data-pack-src="${esc(setImageUrl(cardArt(c)))}" alt="" referrerpolicy="no-referrer" onerror="this.hidden=true"></span></button><div class="pack-card-info" hidden><b>${esc(c.name)}</b><span>${esc(rarity.label)}</span><button class="link" data-pack="details" data-index="${i}">View card &amp; actions</button><button class="link" data-pack="wish-one" data-index="${i}">Wishlist</button></div></article>`;}).join('')}</div><div class="pack-actions"><button class="btn ghost" data-pack="reveal-all">Reveal all</button><button class="btn ghost" data-pack="copy" disabled>Copy list</button><button class="btn ghost" data-pack="wish" disabled>Wishlist all</button><button class="btn" data-pack="buy" disabled>Shop list</button></div><p class="foot">Shop list uses TCGplayer Mass Entry. Check set, printing, finish and condition there before buying. To record a physical card you own, open its card actions.</p></div><p class="pack-status" role="status" aria-live="polite"></p>`;
 document.body.append(dialog);dialog.showModal();let disposed=false,busy=false;
 const status=dialog.querySelector('.pack-status'),close=()=>{if(disposed)return;disposed=true;dialog.close();dialog.remove();};
 const reveal=i=>{if(!Number.isInteger(i)||!picks[i]||revealed.has(i))return;revealed.add(i);const b=dialog.querySelector(`[data-pack="reveal"][data-index="${i}"]`),slot=b.closest('.pack-slot'),image=b.querySelector('img');image.src=image.dataset.packSrc;b.classList.add('revealed');b.setAttribute('aria-pressed','true');b.setAttribute('aria-label',picks[i].name+' · revealed');slot.querySelector('.pack-card-info').hidden=false;if(packRarity(game,picks[i]).rank>=3)slot.classList.add('pack-hit');status.textContent=`${revealed.size} of ${picks.length} revealed`;if(revealed.size===picks.length)for(const b of dialog.querySelectorAll('.pack-actions [disabled]'))b.disabled=false;};
 dialog.addEventListener('close',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',async e=>{const b=e.target.closest('[data-pack]');if(!b||busy)return;const action=b.dataset.pack,i=Number(b.dataset.index);
  if(action==='close')return close();
  if(!isCurrent()){status.textContent='Your account or game changed. Close this preview and open it again.';return;}
  if(action==='open'){dialog.querySelector('.pack-sealed').hidden=true;dialog.querySelector('.pack-content').hidden=false;dialog.querySelector('.pack-card').focus();return;}
  if(action==='reveal')return reveal(i);
  if(action==='reveal-all'){picks.forEach((_,j)=>reveal(j));return;}
  if(action==='details'&&revealed.has(i)){close();return onDetails(picks[i]);}
  if(action==='wish-one'&&revealed.has(i)||['copy','wish','buy'].includes(action)&&revealed.size===picks.length){
   busy=true;b.disabled=true;try{if(action==='wish-one'||action==='wish'){await onWishlist(action==='wish-one'?[picks[i]]:picks);status.textContent='Saved to your wishlist.';b.textContent='On wishlist';}
    else if(action==='copy'){const ok=await onCopy(packList(picks).join('\n'));status.textContent=ok?'Card list copied.':'Could not copy. Select the list below.';if(!ok){const area=document.createElement('textarea');area.readOnly=true;area.value=packList(picks).join('\n');area.setAttribute('aria-label','Pack card list');status.after(area);area.select();}}
    else await onBuy(picks);
   }catch(error){status.textContent=error?.message||'Could not complete this action. Please try again.';}finally{busy=false;b.disabled=false;}
  }
 });
 return close;
}
