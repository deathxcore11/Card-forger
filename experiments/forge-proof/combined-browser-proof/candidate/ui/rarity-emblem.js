// Rarity emblems: each game's own way of showing rarity, drawn as a small badge instead of a coloured
// card border. Pokémon uses its printed rarity marks (●, ◆, ★, gold stars), Magic a faceted gem in the
// set-symbol colours (black, silver, gold, mythic orange), and Yu-Gi-Oh! the rarity name lettered like
// the card-name foil of that rarity. Top rarities shimmer.
import {esc} from './ui.js';
import {pkRarity,ygoRarityCode,YGO_RARITY_KIND} from './emblems.js';

// Pokémon: which family of mark a rarity belongs to, from plain ink to gold.
export function pkRarityKind(label){
 const r=String(label||'').toLowerCase();
 if(/special illustration|hyper|gold|secret|mega hyper/.test(r))return 'gold';
 if(/illustration/.test(r))return 'gold';
 if(/shiny|radiant|amazing|ace spec|star/.test(r))return 'shine';
 if(/ultra|double|holo rare v|vmax|vstar|ex\b|gx|lv\.x|prime|legend|break/.test(r))return 'silver';
 if(/holo/.test(r))return 'holo';
 if(/rare/.test(r))return 'rare';
 if(/uncommon/.test(r))return 'uncommon';
 if(/promo/.test(r))return 'promo';
 return 'common';
}
// Magic: the set-symbol colour of a rarity.
export function mtgRarityKind(label){
 const r=String(label||'').toLowerCase();
 return /mythic/.test(r)?'mythic':/special|bonus|masterpiece/.test(r)?'special':/rare/.test(r)?'rare':/uncommon/.test(r)?'uncommon':'common';
}
// Yu-Gi-Oh!: the foil the card name is printed in at this rarity.
export const ygoRarityKind=label=>YGO_RARITY_KIND[ygoRarityCode(label)]||'common';
const SHIMMER=new Set(['gold','shine','holo','mythic','special','quarter','starlight','ghost','collector','prismatic','platinum','ultimate','secret','ultra']);
const GEM='<svg class="rx-gem" viewBox="0 0 20 20" aria-hidden="true"><path class="rx-gem-body" d="M10 1.5 18 7.2 15 18H5L2 7.2Z"/><path class="rx-gem-facet" d="M10 1.5 13 7.2 10 18 7 7.2Z M2 7.2H18"/></svg>';
export function rarityKind(game,label){return game==='mtg'?mtgRarityKind(label):game==='ygo'?ygoRarityKind(label):pkRarityKind(label);}
// finish: the physical finish pulled (Foil, Reverse Holo...), shown in the same pill before the rarity.
export function rarityEmblem(game,label,{finish=''}={}){
 if(!label)return '';
 const kind=rarityKind(game,label),shine=SHIMMER.has(kind)?' rx-shine':'',title=finish?`${finish} · ${label}`:label;
 const mark=game==='mtg'?GEM:game==='ptcg'?`<span class="rx-mark" aria-hidden="true">${pkRarity(label)}</span>`:'';
 return `<span class="rx rx-${game} rx-${kind}${shine}" title="${esc(title)}">${mark}<span class="rx-text">${finish?`<span class="rx-finish">${esc(finish)}</span> · `:''}${esc(String(label).replace(/^./,ch=>ch.toUpperCase()))}</span></span>`;
}
