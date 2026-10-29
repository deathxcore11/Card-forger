import {YGO_OFFICIAL_CATEGORIES} from './set-release-metadata.js';
import {esc,safeHref,cardImage} from './ui.js';
export const setImageUrl=value=>safeHref(/^img\/[a-z0-9_./-]+$/i.test(String(value||''))?'/'+value:value);
// Product art, then provider set art, then an actual card from this release.
// A fallback image is decoration, never evidence of a sealed product's contents.
export function setArtworkSources(game,set={},card=null){
 set||={};
 const urls=[set.productImage,set.packImage,game==='mtg'&&/^[a-z0-9]{2,8}$/i.test(set.code||'')?`img/mtg-set/${set.code.toLowerCase()}.jpg`:'',set.image,card?(game==='mtg'?cardImage(card,'normal'):card.imageLarge||card.image):''];
 return [...new Set(urls.filter(x=>typeof x==='string'&&x).map(setImageUrl).filter(x=>x!=='#'))];
}
export function setAtmosphere(game,set,card=null){
 const urls=setArtworkSources(game,set,card);if(!urls.length)return '';
 return `<span class="set-atmosphere" aria-hidden="true" data-audit-scroll><img src="${esc(urls[0])}" data-set-art-sources="${esc(JSON.stringify(urls))}" data-set-art-index="0" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="const a=JSON.parse(this.dataset.setArtSources),i=Number(this.dataset.setArtIndex)+1;this.dataset.setArtIndex=i;if(a[i])this.src=a[i];else{this.onerror=null;this.hidden=true}"></span>`;
}
// Yu-Gi-Oh! prize and tournament boosters (OTS, Astral, Champion, Turbo, Speed Duel Tournament Packs) are
// real packs; tins, decks and boxes are not.
export const YGO_TOURNAMENT_PACK=/(?:^|\b)(?:(?:OTS |OTS ULTIMATE |SPEED DUEL )?TOURNAMENT PACK|ASTRAL PACK|CHAMPION PACK|TURBO PACK|WINNER'S PACK)\b/i;
export function packEligible(game,set){
 if(!set)return false;
 if(game==='ygo'&&YGO_TOURNAMENT_PACK.test(set.name||'')&&!/\btin\b/i.test(set.name||''))return true;
 if(/promo|token|memorabilia|starter|structure deck|theme deck|trainer kit|battle deck|secret lair|championship|tournament|prize|sample|demo|deck exclusiv/i.test(`${set.name||''} ${set.set_type||''} ${set.series||''}`))return false;
 // Scryfall sets have set_type/digital; booster is a CARD field, not a set field.
 if(game==='mtg')return !set.digital&&['core','expansion','masters','draft_innovation','funny'].includes(set.set_type);
 if(game==='ygo'){const norm=s=>String(s||'').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g,'');return ['Booster Packs','Duelist Packs'].some(k=>(YGO_OFFICIAL_CATEGORIES[k]||[]).some(n=>norm(n)===norm(set.name)));}
 return game==='ptcg'&&/^(?:base[1-5]|gym[12]|neo[1-4]|ecard[1-3]|ex(?:[1-9]|1[0-6])|dp[1-7]|pl[1-4]|hgss[1-4]|bw\d+|xy\d+|sm\d+(?:\.5)?|swsh\d+(?:\.5)?|sv\d+(?:\.5[wb]?)?|me\d+(?:\.5)?|cel25|col1|g1|det1|dv1|dc1|lc|30th)$/.test(set.id||'');
}
export function packButton(game,set,{ready=false}={}){return packEligible(game,set)?`<button class="btn ghost set-open-pack" data-act="openSetPack" ${ready?'':'disabled'}>Open Pack <span>Simulator</span></button>`:'';}
