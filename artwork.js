import {POKEMON_SET_ART,POKEMON_CARD_ART} from './pokemon-set-art.js';
import {esc,tierRing,rememberPrice} from './ui.js';
// English set + collector-number matches only. No name-based art substitutions.
export function pokemonFallback(c){
 const id=String(c?.id||''),set=String(c?.set?.id || id.slice(0,id.lastIndexOf('-'))).toLowerCase(),code={svp:'SVP',swshp:'SWSH',mep:'MEP'}[set];
 if(POKEMON_CARD_ART[id])return POKEMON_CARD_ART[id];
 const collector=String(c?.set?.number || id.slice(id.lastIndexOf('-')+1));
 // Verified historical set IDs use different naming between the two catalogues.
 if(set==='sm3.5' && /^\d{1,3}$/.test(collector) && Number(collector)>0)return `https://images.pokemontcg.io/sm35/${Number(collector)}_hires.png`;
 if(set==='smp' && /^SM\d{1,3}$/i.test(collector))return `https://images.pokemontcg.io/smp/${collector.toUpperCase()}_hires.png`;
 const matched=POKEMON_SET_ART[set];
 if(!code && matched && /^(?:[A-Za-z]{0,5})\d{1,3}$/.test(collector)){
  const number=/^\d+$/.test(collector)?String(Number(collector)):collector.toUpperCase();
  const gallery=/^(GG|TG)\d+$/i.test(collector);
  return `https://images.pokemontcg.io/${matched.id}/${gallery?collector.toUpperCase():number}_hires.png`;
 }
 const raw=collector.replace(/^SWSH/i,'');
 if(!code||!/^\d{1,3}$/.test(raw)||Number(raw)<1)return '';
 return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${code}/${code}_${String(Number(raw)).padStart(3,'0')}_R_EN.png`;
}
export function artworkSources(c,large=false){
 if(!c)return [];
 const urls=c.game==='ptcg'?[POKEMON_CARD_ART[c.id],large?c.imageLarge:c.image,large?c.image:c.imageLarge,pokemonFallback(c),c.id?`img/ptcg/${large?'l':'s'}/${encodeURIComponent(c.id)}.jpg`:'']:c.game==='ygo'?[large?c.imageLarge:c.image,`https://images.ygoprodeck.com/images/cards${large?'':'_small'}/${encodeURIComponent(c.id)}.jpg`]:[c.image_uris?.normal,c.card_faces?.[0]?.image_uris?.normal];
 return [...new Set(urls.filter(u=>typeof u==='string'&&(/^(https?:\/\/|img\/)/.test(u))))];
}
export function artworkHTML(c,cls='card-img',large=false){
 const urls=artworkSources(c,large),fallback=`<span class="${cls} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`;
 if(!urls.length)return fallback;
 rememberPrice(urls[0],c?.prices?.usd);
 return `<img class="${cls}" src="${esc(urls[0])}"${tierRing(urls[0],cls)} data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer">`;
}
export function handleArtworkError(e){
 const image=e.target;if(!image?.dataset?.artSources)return;
 let urls;try{urls=JSON.parse(image.dataset.artSources)}catch{return;}
 const next=Number(image.dataset.artIndex||0)+1;
 if(next<urls.length){image.dataset.artIndex=String(next);image.src=urls[next];return;}
 image.hidden=true;if(image.dataset.artMissing)return;image.dataset.artMissing='1';
 image.insertAdjacentHTML('afterend',`<span class="${esc(image.className)} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`);
}
// Pokémon cards have no separate art image, so crop the card picture to its art window (the
// same framing Magic's art crops and Yu-Gi-Oh!'s artwork give). The window keeps its shape and
// covers whatever box it sits in.
export function pokemonArtCrop(c, cls = "", src = "") {
  const urls = src ? [src, ...artworkSources(c, true).filter((u) => u !== src)] : artworkSources(c, true);
  if (!urls.length) return `<span class="${cls} pk-crop img-missing" role="img" aria-label="Artwork unavailable">◇</span>`;
  return `<span class="${cls} pk-crop" aria-hidden="true"><span class="pk-win"><img src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="" loading="lazy" referrerpolicy="no-referrer"></span></span>`;
}
