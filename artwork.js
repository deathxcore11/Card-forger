import {esc} from './ui.js';
// English set + collector-number matches only. No name-based art substitutions.
export function pokemonFallback(c){
 const id=String(c?.id||''),set=String(c?.set?.id || id.slice(0,id.lastIndexOf('-'))).toLowerCase(),code={svp:'SVP',swshp:'SWSH'}[set];
 const raw=String(c?.set?.number || id.slice(id.lastIndexOf('-')+1)).replace(/^SWSH/i,'');
 if(!code||!/^\d{1,3}$/.test(raw)||Number(raw)<1)return '';
 return `https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${code}/${code}_${String(Number(raw)).padStart(3,'0')}_R_EN.png`;
}
export function artworkSources(c,large=false){
 if(!c)return [];
 const urls=c.game==='ptcg'?[large?c.imageLarge:c.image,large?c.image:c.imageLarge,pokemonFallback(c)]:c.game==='ygo'?[large?c.imageLarge:c.image,`https://images.ygoprodeck.com/images/cards${large?'':'_small'}/${encodeURIComponent(c.id)}.jpg`]:[c.image_uris?.normal,c.card_faces?.[0]?.image_uris?.normal];
 return [...new Set(urls.filter(u=>typeof u==='string'&&(/^(https?:\/\/|img\/)/.test(u))))];
}
export function artworkHTML(c,cls='card-img',large=false){
 const urls=artworkSources(c,large),fallback=`<span class="${cls} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`;
 if(!urls.length)return fallback;
 return `<img class="${cls}" src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer">`;
}
export function handleArtworkError(e){
 const image=e.target;if(!image?.dataset?.artSources)return;
 let urls;try{urls=JSON.parse(image.dataset.artSources)}catch{return;}
 const next=Number(image.dataset.artIndex||0)+1;
 if(next<urls.length){image.dataset.artIndex=String(next);image.src=urls[next];return;}
 image.hidden=true;if(image.dataset.artMissing)return;image.dataset.artMissing='1';
 image.insertAdjacentHTML('afterend',`<span class="${esc(image.className)} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`);
}
