import {esc} from './ui.js';
import {pokemonArtCrop} from './artwork.js';

// Presentation only. Themes never alter a game's counters or deck identity.
export const TABLE_THEMES={
 mtg:[['W','Plains','#e8ce87'],['U','Island','#69b9ed'],['B','Swamp','#b797d8'],['R','Mountain','#f18567'],['G','Forest','#79c99e'],['C','Wastes','#b7c5d3']],
 ptcg:[['Fire','Fire','#f18b6e'],['Water','Water','#77baf1'],['Grass','Grass','#8ad5a1'],['Lightning','Lightning','#f0d06e'],['Psychic','Psychic','#bf9bed'],['Fighting','Fighting','#dca27f'],['Darkness','Darkness','#8db5c5'],['Metal','Metal','#bac9d5'],['Dragon','Dragon','#d8bd72'],['Colorless','Colorless','#d5dce7'],['Fairy','Fairy','#e5aed4']],
 ygo:[['DARK','Dark','#b79ae9'],['LIGHT','Light','#edcf83'],['FIRE','Fire','#f18a70'],['WATER','Water','#79b9ef'],['EARTH','Earth','#b9bd87'],['WIND','Wind','#80d2b6'],['DIVINE','Divine','#e9be7e']],
};
export function tableTheme(game,id,seat=0){const rows=TABLE_THEMES[game]||TABLE_THEMES.mtg,r=rows.find(r=>r[0]===id)||rows[seat%rows.length];return {id:r[0],label:r[1],color:r[2]};}
export function themeOptions(game,id){return TABLE_THEMES[game].map(([value,label])=>`<option value="${value}" ${value===id?'selected':''}>${label}</option>`).join('');}
export function themeMatches(game,id,card){return game==='mtg'?card?.name===tableTheme(game,id).label:game==='ygo'?card?.attribute===id:card?.types?.includes(id)&&card.category==='Pokemon';}
export function tableThemeArtwork(game,card){
 if(!card)return '';
 if(game==='ptcg')return pokemonArtCrop(card,'table-art-image');
 const url=game==='mtg'?`https://api.scryfall.com/cards/named?exact=${encodeURIComponent(card.name)}&format=image&version=art_crop`:card.artDirect||card.art;
 if(!url||!/^https:\/\//.test(url))return '';
 return `<img class="table-art-image" src="${esc(url)}" alt="" decoding="async" referrerpolicy="no-referrer">`;
}
// Resolve actual provider cards for each type, rather than guessing an image ID.
// Share in-flight work between players and never fetch a full catalogue.
export function createTableArtResolver(sources){
 const cache=new Map();
 return (game,id)=>{
  const theme=tableTheme(game,id),key=game+':'+theme.id;
  if(game==='mtg')return Promise.resolve({name:theme.label});
  if(cache.has(key))return cache.get(key);
  const promise=(async()=>{
   const source=sources[game],result=await source.search({...(game==='ygo'?{attribute:theme.id}:{type:theme.id,category:'Pokemon'}),size:4,page:0});
   for(const brief of (result.cards||[]).slice(0,4)){
    const card=brief.brief?await source.get(brief.id,{printings:false,prices:false}):brief;
    if(themeMatches(game,theme.id,card)&&tableThemeArtwork(game,card))return card;
   }
   return null;
  })().catch(()=>null);
  cache.set(key,promise);promise.then(card=>{if(!card)cache.delete(key);});return promise;
 };
}
