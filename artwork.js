import {POKEMON_SET_ART,POKEMON_CARD_ART} from './pokemon-set-art.js';
import {esc,tierRing,rememberPrice,magicArtworkSources} from './ui.js';
import {tierOf,tierAttrs} from './tier.js';
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
// These exact provider references were confirmed as card backs in the 3.84.2
// audit (2026-10-18), even with HTTP 200. Quarantine those references only;
// me55c/29 was also confirmed as a card back in the 3.85.6 live review.
// A genuine exact-printing alternative remains eligible. Recheck before removing.
export function knownPokemonPlaceholder(url){
 return /^https:\/\/images\.pokemontcg\.io\/me55c\/(?:[1-9]|1[0-2]|29)(?:_hires)?\.png(?:\?.*)?$/.test(String(url||''));
}
export function artworkSources(c,large=false){
 if(!c)return [];
 const urls=c.game==='ptcg'?[POKEMON_CARD_ART[c.id],large?c.imageLarge:c.image,large?c.image:c.imageLarge,pokemonFallback(c),c.id?`img/ptcg/${large?'l':'s'}/${encodeURIComponent(c.id)}.jpg?v=2`:'']:c.game==='ygo'?[large?c.imageLarge:c.image,large?c.image:c.imageLarge,...(/^\d{1,12}$/.test(String(c.id||''))?[`https://images.ygoprodeck.com/images/cards${large?'':'_small'}/${c.id}.jpg`,`https://images.ygoprodeck.com/images/cards${large?'_small':''}/${c.id}.jpg`]:[])]:magicArtworkSources(c,large?'large':'normal');
 return [...new Set(urls.filter(u=>!knownPokemonPlaceholder(u)&&typeof u==='string'&&(/^(https?:\/\/|img\/)/.test(u))))];
}
export function artworkHTML(c,cls='card-img',large=false){
 const urls=artworkSources(c,large),fallback=`<span class="${cls} img-missing" role="img" aria-label="Artwork unavailable">◇<small>Art unavailable</small></span>`;
 if(!urls.length)return fallback;
 // YGO printings reuse one artwork URL. Its previous viewer's price is not evidence.
 const ygo=c?.game==='ygo',value=c?.setContext?c.setContext.price:c?.prices?.usd;
 if(!ygo)rememberPrice(urls[0],c?.prices?.usd);
 const ring=ygo?(Number(value)>0&&!/\b(?:cs-art|hero-art|hh-art|zoom|cover|nc-)/.test(cls)?' '+tierAttrs(tierOf('ygo','',value)):''):tierRing(urls[0],cls);
 return `<img class="${cls}" src="${esc(urls[0])}"${ring} data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="${esc(c.name)}" loading="lazy" referrerpolicy="no-referrer">`;
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
export function pokemonArtCrop(c, cls = "", src = "", {loading = "lazy"} = {}) {
  const urls = src&&!knownPokemonPlaceholder(src) ? [src, ...artworkSources(c, true).filter((u) => u !== src)] : artworkSources(c, true);
  if (!urls.length) return `<span class="${cls} pk-crop img-missing" role="img" aria-label="Artwork unavailable">◇</span>`;
  return `<span class="${cls} pk-crop" aria-hidden="true"><span class="pk-win"><img src="${esc(urls[0])}" data-art-sources="${esc(JSON.stringify(urls))}" data-art-index="0" alt="" loading="${loading === "eager" ? "eager" : "lazy"}" referrerpolicy="no-referrer"></span></span>`;
}

// Tournament rows carry the exact English set abbreviation and collector number.
// Pick the archetype's featured Pokémon; never substitute an unrelated mascot.
export function pokemonDeckCover(deck){
 const words=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/['’]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
 const title=` ${words(deck?.name)} `,
  icons=(Array.isArray(deck?.icons)?deck.icons:[]).filter(i=>typeof i==='string').map(i=>words(i).split(' ').filter(Boolean)),
  rows=(Array.isArray(deck?.list)?deck.list:[]).filter(r=>r?.kind==='Pokemon'&&typeof r.name==='string'&&/^[A-Z0-9]{2,8}$/i.test(r.set||'')&&/^\d{1,3}$/.test(String(r.number||''))&&Number(r.number)>0&&Number.isInteger(Number(r.qty))&&Number(r.qty)>0);
 // A generic archetype label (for example Basic Box) can identify its lead via
 // its supplied species icons. A plentiful support Pokémon alone is not evidence.
 const scored=rows.map(r=>{
  const name=words(r.name).replace(/\s+(?:ex|vmax|vstar|gx|v)$/,''),parts=name.split(' ');
  // Tokens avoid Mew matching Mewtwo, while form labels may change order:
  // "ogerpon-teal" still identifies "Teal Mask Ogerpon", not another Pokémon.
  const featured=name.length>=3&&title.includes(` ${name} `)?2:icons.some(i=>i.join('').length>=3&&i.every(part=>parts.includes(part)))?1:0;
  return {r,featured};
 }).filter(x=>x.featured).sort((a,b)=>b.featured-a.featured||Number(b.r.qty)-Number(a.r.qty));
 if(!scored.length)return null;
 const r=scored[0].r,set=String(r.set).toUpperCase(),number=String(Number(r.number)).padStart(3,'0');
 return {game:'ptcg',name:r.name,printing:{name:r.name,set,number:String(r.number)},imageLarge:`https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/tpci/${set}/${set}_${number}_R_EN.png`};
}
