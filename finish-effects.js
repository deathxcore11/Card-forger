// Printing-aware presentation only. Never infer availability from a quote, value or frame.
import {quoteForContext,validSetContext} from './pricing-presentation.js';
import {pokemonVariantChoices,pokemonVariantProductConflict} from './pokemon-variant-options.js';
import {reviewedCosmosPreview} from './pokemon-promo-evidence.js';
export const FINISH_SOURCES = Object.freeze({
 pokemon:'https://www.pokemon.com/us/pokemon-news/pokemon-tcg-scarlet-and-violet-revamps-pokemon-tcg-card-aesthetic',
 base:'https://images.pokemontcg.io/base1/4_hires.png',
 expedition:'https://api.tcgdex.net/v2/en/cards/ecard1-1',
 gengar30:'https://api.tcgdex.net/v2/en/cards/30th-154',
 scryfall:'https://scryfall.com/docs/api/cards',
 etched:'https://magic.wizards.com/en/news/feature/collecting-commander-legends-battle-for-baldurs-gate',
 ygo:'https://www.yugioh-card.com/en/about/new-to-ygo/',
});
// Normalized source-image coordinates. Geometry is an approximation, not an authentication aid.
export const FINISH_MASKS = Object.freeze({
 card:'inset(0 round 4% / 3%)',
 'pk-expedition-art':'polygon(25% 12.4%,96.5% 12.4%,96.5% 48.2%,25% 48.2%,18% 47.4%,13% 44.8%,10% 40%,10% 22%,12% 17.8%,17% 14.4%)',
 // Conservative known reverse-foil field. E-reader strips/frame are deliberately excluded.
 'pk-expedition-field':'inset(51.5% 4% 14% 12%)',
 'pk-base-art':'polygon(24% 11.8%,89.8% 11.8%,89.8% 51.6%,10.8% 51.6%,10.8% 18%,19% 18%,24% 14%)',
 'pk-base1-4-art':'inset(12% 10.3333% 48.3636% 11%)',
 'pk-base4-20-art':'inset(11.8788% 11.1667% 49.0909% 11.3333%)',
 // Exact Neo Genesis Lugia illustration window, visually checked against source art.
 // Approximation: no character silhouette, edition stamp or authenticity claim.
 'pk-neo1-9-art':'inset(12.1% 11.4% 48.8% 11.1%)',
 'pk-cel-art':'inset(9.5% 6.6% 51.3% 6.6%)',
 // Sword & Shield art window (734 × 1024 reference); reverse excludes its silver frame/caption too.
 'pk-swsh-trainer-field':'inset(53% 8.5% 13% 8.5%)',
 'pk-standard-art':'inset(12.3% 8.2% 47.5% 8.2%)',
 // Unified Minds Celebi 4: source art is 600x825, illustration x48..552,
 // y81..390. The silver frame and Pokédex caption are outside this window.
 'pk-sm11-4-art':'inset(9.818182% 8% 52.727273% 8%)',
 'pk-standard-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.2% 12.3%,8.2% 52.5%,91.8% 52.5%,91.8% 12.3%,8.2% 12.3%)',
 // Ordinary Sun & Moon frames, checked against sm11-6, sm11-7 and sm11-9
 // (600x825). Exclude the silver frame/caption and protruding stage badge.
 'pk-sm-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,6.7% 9.1%,6.7% 50.8%,93.3% 50.8%,93.3% 9.1%,6.7% 9.1%)',
 'pk-sm-evolved-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,3.3% 7.2%,3.3% 16.3%,6.7% 16.3%,6.7% 50.8%,93.3% 50.8%,93.3% 9.1%,16.3% 9.1%,16.3% 7.2%,3.3% 7.2%)',
 'pk-trainer-art':'inset(18% 8.2% 40% 8.2%)',
 // Era frames measured on TCGdex 600x825 fronts: mean edge maps of 30-145
 // regular cards per era and layout, traced to the printed frame line (see
 // tests/fixtures/pokemon-frame-geometry.json). Illustrations rise beside the
 // printed stage banner, so Basic and evolved windows step around it; evolved
 // windows also curve around the pre-evolution badge. Reverse holes match.
 'pk-dppt-art':'polygon(7% 11.9%,21% 11.9%,23.2% 11.3%,26.7% 9.3%,92.8% 9.3%,92.8% 49.7%,7% 49.7%)',
 'pk-dppt-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,7% 11.9%,21% 11.9%,23.2% 11.3%,26.7% 9.3%,92.8% 9.3%,92.8% 49.7%,7% 49.7%,7% 11.9%)',
 'pk-dppt-evolved-art':'polygon(7.2% 16.9%,9.5% 17.3%,13% 17.3%,15.2% 16.9%,18.2% 15.3%,19.3% 13.9%,19.8% 12.1%,20.2% 12%,54.5% 12.1%,58% 11.4%,61% 9.5%,92.7% 9.5%,92.7% 49.7%,7.2% 49.7%)',
 'pk-dppt-evolved-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,7.2% 16.9%,9.5% 17.3%,13% 17.3%,15.2% 16.9%,18.2% 15.3%,19.3% 13.9%,19.8% 12.1%,20.2% 12%,54.5% 12.1%,58% 11.4%,61% 9.5%,92.7% 9.5%,92.7% 49.7%,7.2% 49.7%,7.2% 16.9%)',
 'pk-dppt-trainer-art':'polygon(8.8% 14.7%,90.5% 14.7%,90.5% 49.7%,8.8% 49.7%)',
 'pk-dppt-trainer-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.8% 14.7%,90.5% 14.7%,90.5% 49.7%,8.8% 49.7%,8.8% 14.7%)',
 'pk-hgss-art':'polygon(5.5% 11.2%,20.3% 11.2%,23.2% 10.7%,25.7% 9.2%,94.3% 9.1%,94.3% 52%,5.5% 52%)',
 'pk-hgss-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,5.5% 11.2%,20.3% 11.2%,23.2% 10.7%,25.7% 9.2%,94.3% 9.1%,94.3% 52%,5.5% 52%,5.5% 11.2%)',
 'pk-hgss-evolved-art':'polygon(5.6% 11.2%,22.7% 11.2%,24.5% 11.4%,30.8% 10.6%,59.3% 10.6%,61.8% 10.3%,64.5% 9.2%,94.2% 9.1%,94.2% 52%,5.6% 52%)',
 'pk-hgss-evolved-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,5.6% 11.2%,22.7% 11.2%,24.5% 11.4%,30.8% 10.6%,59.3% 10.6%,61.8% 10.3%,64.5% 9.2%,94.2% 9.1%,94.2% 52%,5.6% 52%,5.6% 11.2%)',
 'pk-hgss-trainer-art':'polygon(7.8% 14.7%,92% 14.7%,92% 53.1%,7.8% 53.1%)',
 'pk-hgss-trainer-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,7.8% 14.7%,92% 14.7%,92% 53.1%,7.8% 53.1%,7.8% 14.7%)',
 'pk-bwxy-art':'polygon(9% 10.7%,90.8% 10.7%,90.8% 49.1%,9% 49.1%)',
 'pk-bwxy-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,9% 10.7%,90.8% 10.7%,90.8% 49.1%,9% 49.1%,9% 10.7%)',
 'pk-bwxy-evolved-art':'polygon(9% 16.1%,12.7% 16.1%,15.7% 15.2%,17.8% 13.7%,19.2% 11.6%,61.3% 11.6%,64% 10.8%,90.8% 10.7%,90.8% 49.1%,9% 49.1%)',
 'pk-bwxy-evolved-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,9% 16.1%,12.7% 16.1%,15.7% 15.2%,17.8% 13.7%,19.2% 11.6%,61.3% 11.6%,64% 10.8%,90.8% 10.7%,90.8% 49.1%,9% 49.1%,9% 16.1%)',
 'pk-bwxy-trainer-art':'polygon(10.6% 16.4%,89.3% 16.4%,89.3% 50.1%,10.6% 50.1%)',
 'pk-bwxy-trainer-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,10.6% 16.4%,89.3% 16.4%,89.3% 50.1%,10.6% 50.1%,10.6% 16.4%)',
 'pk-sm-art':'polygon(6.3% 8.7%,93.5% 8.7%,93.5% 46.7%,6.3% 46.7%)',
 'pk-sm-evolved-art':'polygon(6.3% 15.4%,11.7% 15.2%,14.5% 13.1%,15% 10.4%,55.2% 10.5%,56.7% 10.3%,59.5% 8.7%,93.5% 8.7%,93.5% 46.7%,6.3% 46.7%)',
 'pk-sm-trainer-art':'polygon(6.3% 13.7%,93.3% 13.7%,93.3% 51.6%,6.3% 51.6%)',
 'pk-sm-trainer-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,6.3% 13.7%,93.3% 13.7%,93.3% 51.6%,6.3% 51.6%,6.3% 13.7%)',
 'pk-swsh-art':'polygon(8.5% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%)',
 'pk-swsh-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.5% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%,8.5% 10.2%)',
 'pk-swsh-evolved-art':'polygon(8.5% 16.4%,12.2% 16.2%,14.3% 15.5%,16.2% 13.7%,16.5% 12.2%,54.3% 12.1%,57% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%)',
 'pk-swsh-evolved-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.5% 16.4%,12.2% 16.2%,14.3% 15.5%,16.2% 13.7%,16.5% 12.2%,54.3% 12.1%,57% 10.2%,91.5% 10.2%,91.5% 46.9%,8.5% 46.9%,8.5% 16.4%)',
 'pk-swsh-trainer-art':'polygon(8.3% 14.6%,91.7% 14.6%,91.7% 51.5%,8.3% 51.5%)',
 'pk-swsh-trainer-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.3% 14.6%,91.7% 14.6%,91.7% 51.5%,8.3% 51.5%,8.3% 14.6%)',
 'pk-sv-art':'polygon(8.5% 10.2%,91.6% 10.2%,91.6% 46.9%,8.5% 46.9%)',
 'pk-sv-surround':'polygon(evenodd, 5.5% 3%,94.5% 3%,94.5% 97%,5.5% 97%,5.5% 3%,8.5% 10.2%,91.6% 10.2%,91.6% 46.9%,8.5% 46.9%,8.5% 10.2%)',
 'pk-sv-evolved-art':'polygon(8.4% 19%,12% 18.7%,15.2% 17.5%,16.6% 15.5%,17.5% 13.5%,18.2% 11.6%,65.5% 11.6%,68% 10.2%,91.6% 10.2%,91.6% 46.9%,8.4% 46.9%)',
 'pk-sv-evolved-surround':'polygon(evenodd, 5.5% 3%,94.5% 3%,94.5% 97%,5.5% 97%,5.5% 3%,8.4% 19%,12% 18.7%,15.2% 17.5%,16.6% 15.5%,17.5% 13.5%,18.2% 11.6%,65.5% 11.6%,68% 10.2%,91.6% 10.2%,91.6% 46.9%,8.4% 46.9%,8.4% 19%)',
 'pk-sv-trainer-art':'polygon(8.3% 14.4%,91.8% 14.4%,91.8% 51.4%,8.3% 51.4%)',
 'pk-sv-trainer-surround':'polygon(evenodd, 5.5% 3%,94.5% 3%,94.5% 97%,5.5% 97%,5.5% 3%,8.3% 14.4%,91.8% 14.4%,91.8% 51.4%,8.3% 51.4%,8.3% 14.4%)',
 // NEC #077 inverted display commander only. Traced from Wizards' 265x370 image.
 // Artwork, outer black border, footer and the security oval are deliberately outside.
 'mtg-nec77-metal':'polygon(evenodd, 4.2% 5.5%,6.8% 3.3%,10% 4.5%,19% 4.5%,22% 3.6%,35% 4.5%,48% 2.6%,57% 3.2%,63% 4.8%,80% 4.5%,84% 3.2%,88% 4.7%,93% 4.7%,96% 7%,95% 57%,96% 59%,94% 62%,94% 89%,95% 91%,94% 94.5%,78% 94.5%,77% 92.8%,56% 92.8%,55% 91.5%,52% 90.7%,48% 90.7%,45% 91.5%,44% 92.8%,8% 92.8%,5% 91%,4.5% 62%,4% 59%,5.5% 57%,5.5% 11%,4.2% 5.5%,7.5% 11.1%,7.5% 56.3%,92.5% 56.3%,92.5% 11.1%,7.5% 11.1%)',
 'mtg-frame':'polygon(evenodd, 3% 2%,97% 2%,97% 98%,3% 98%,3% 2%,9% 12%,9% 54%,91% 54%,91% 12%,9% 12%,9% 60%,9% 90%,91% 90%,91% 60%,9% 60%)',
 'ygo-art':'inset(18.3% 11.7% 29.4% 11.7%)',
 'ygo-name':'inset(5.5% 18% 89.7% 7.2%)',
 'ygo-broad':'inset(2.3% 3.2% round 1%)',
});
export const FINISH_MATERIALS = Object.freeze(['holo','rainbow','metal','silver','gold','secret','prismatic','starlight','tiles','micro']);
const layer=(mask,material)=>({mask,material});
const unknown=(key='',label='')=>({key,label,effect:'unknown',status:'unknown',layers:[],source:'',reason:'Finish preview unavailable for this printing.'});
const preset=(key,label,effect,layers,source,status='approximate')=>({key,label,effect,layers,source,status,reason:status==='approximate'?'Simulated finish · approximate coverage':''});
const paper=(key,label)=>preset(key,label,'plain',[],'catalog','verified');
const norm=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const variantFinish=v=>{
 if(v.finish)return {normal:'nonfoil',holo:'holofoil',reverse:'reverse-holofoil'}[v.finish]||v.finish;
 const k=norm(v.key),label=String(v.label||'');
 if(/unconfirmed/i.test(label))return '';
 if(/reverse/i.test(label)||k.includes('reverseholo'))return 'reverse-holofoil';
 if(/holo/i.test(label)||k.endsWith('holofoil'))return 'holofoil';
 if(['normal','nonfoil','unlimited','1stedition'].includes(k)||/\bNormal\b/i.test(label))return 'nonfoil';
 return '';
};
function exactOverride(game,c,key,face){
 // Future catalogue additions must match the full identity and provide evidence. No name matches.
 return (c.finishPresentations||[]).find(p=>p.game===game&&String(p.printingId)===String(c.id)&&p.finish===key&&Number(p.face||0)===face&&['verified','approximate'].includes(p.status)&&/^https:\/\//.test(p.source||'')&&p.layers?.length&&p.layers.every(l=>FINISH_MASKS[l.mask]&&FINISH_MATERIALS.includes(l.material)));
}
// Measured frame family for ordinary Pokémon/Trainer fronts (see FINISH_MASKS),
// or '' when the printed layout has no reviewed geometry. Stage picks the
// Basic or evolved window; it never adds a finish.
const PK_FRAME_ERAS=[[/^(?:dp|pl)/i,'pk-dppt'],[/^(?:hgss|col)/i,'pk-hgss'],[/^(?:bw|xy|g1$|dc1|dv1)/i,'pk-bwxy'],[/^(?:sm|det1)/i,'pk-sm'],[/^(?:swsh|cel25|pgo)/i,'pk-swsh'],[/^(?:sv|me)/i,'pk-sv']];
export function pokemonFrame(c){
 const set=c?.set?.id||'',base=PK_FRAME_ERAS.find(([re])=>re.test(set))?.[1],category=norm(c?.category||'Pokemon'),stage=norm(c?.stage);
 if(!base)return '';
 // Promo Trainers often use special layouts; only expansion Trainer frames were measured.
 if(category==='trainer')return /p$/i.test(set)?'':base+'-trainer';
 if(category!=='pokemon')return '';
 // A missing stage keeps the Basic window: it never invents an evolution cut-out.
 return ['','basic','baby'].includes(stage)?base:['stage1','stage2'].includes(stage)?base+'-evolved':'';
}
function effectFor(game,c,key,label,ctx,physicalFinish){
 if(physicalFinish==='nonfoil')return paper(key,label);
 const face=Number(ctx.face||0),override=exactOverride(game,c,key,face);
 if(override)return preset(key,label,override.effectPreset||'custom',override.layers,override.source,override.status);
 if(game==='mtg'){
  // Face-wide traditional foil is safe on supported portrait layouts; etched needs its own frame.
  const layout=c.layout||'normal';
  if(!['normal','transform','modal_dfc','adventure','leveler','saga','class','token','double_faced_token','planar'].includes(layout)||layout==='planar')return unknown(key,label);
  if(face && !c.card_faces?.[face]?.image_uris)return unknown(key,label);
  if(physicalFinish==='foil')return preset(key,label,'mtg-foil',[layer('card','rainbow')],FINISH_SOURCES.scryfall);
  if(physicalFinish==='etched'&&c.id==='3305c70f-188a-4c01-b605-d583ded84e18'&&c.set==='nec'&&String(c.collector_number)==='77'&&c.layout==='normal'&&face===0&&['legendary','inverted','etched'].every(x=>c.frame_effects?.includes(x))&&!c.full_art&&!c.borderless)return {...preset(key,label,'mtg-nec77-etched',[layer('mtg-nec77-metal','metal')],'https://magic.wizards.com/en/news/feature/kamigawa-neon-dynasty-product-overview-2022-01-27'),reason:'Simulated foil-etched finish · approximate metallic coverage'};
  if(physicalFinish==='etched'&&['cmr','clb'].includes(c.set)&&layout==='normal'&&!c.borderless&&!c.full_art&&!c.frame_effects?.some(x=>['showcase','extendedart'].includes(x)))return preset(key,label,'mtg-etched',[layer('mtg-frame','metal')],FINISH_SOURCES.etched);
  return unknown(key,label);
 }
 if(game==='ptcg'){
  const set=c.set?.id||'',rarity=norm(c.rarity),category=norm(c.category||'Pokemon');
  // Exact full-card illustration shown in the user's Holofoil detail screenshot.
  // The source currently has generated availability; this never creates a foil option.
  if(set==='30th'&&c.id==='30th-154'&&physicalFinish==='holofoil')return preset(key,label,'ptcg-full-art',[layer('card','rainbow')],FINISH_SOURCES.gengar30);
  // Exact Expedition Alakazam layout shown by the user; standard and jumbo retain separate keys.
  if(set==='ecard1'&&['ecard1-1','ecard1-33'].includes(c.id)){
   if(physicalFinish==='holofoil')return preset(key,label,'ptcg-expedition-holo',[layer('pk-expedition-art','holo')],FINISH_SOURCES.expedition);
   if(physicalFinish==='reverse-holofoil')return {...preset(key,label,'ptcg-expedition-reverse',[layer('pk-expedition-field','rainbow')],FINISH_SOURCES.expedition),reason:'Simulated reverse holo · partial coverage'};
  }
  // Base Set standard holo Pokemon have this illustration-only layout. Exclude promos/reprints.
  if(set==='base1'&&/^base1-(?:[1-9]|1[0-6])$/.test(c.id)&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer(c.id==='base1-4'?'pk-base1-4-art':'pk-base-art','holo')],FINISH_SOURCES.base);
  if(set==='base4'&&c.id==='base4-20'&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer('pk-base4-20-art','holo')],'https://api.tcgdex.net/v2/en/cards/base4-20');
  if(set==='neo1'&&c.id==='neo1-9'&&physicalFinish==='holofoil')return {...preset(key,label,'ptcg-holo',[layer('pk-neo1-9-art','holo')],'https://api.tcgdex.net/v2/en/cards/neo1-9'),reason:'Simulated illustration-window holo'};
  // Finish availability is still source-supplied. Layout identifies where that
  // known finish catches the light; it never adds a variant or a price.
  const fullArt=/fullart|illustration|rainbow|shinyvmax|shinyv|secret|hyperrare|ultrarare/.test(rarity)||/^(vmax|vstar)$/i.test(c.stage||'')||(!/^ex\d/.test(set)&&/\s(?:V|GX|EX|ex|VMAX|VSTAR|V-UNION)$/.test(c.name||''));
  if(physicalFinish==='holofoil'&&fullArt){
   const textured=/specialillustration|shiny.*vmax|rainbow|fullart|ultrarare|rareultra|hyperrare/.test(rarity)||/^vmax$/i.test(c.stage||'');
   const gold=/^(sv|me)/i.test(set)&&rarity==='hyperrare';
   return {...preset(key,label,'ptcg-full-art',[layer('card',gold?'gold':'rainbow'),...(textured?[layer('card','micro')]:[])],FINISH_SOURCES.pokemon),coverage:'full',texture:textured?'micro-ridges':'smooth'};
  }
  if(set==='sm11'&&c.id==='sm11-4'&&!fullArt&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer('pk-sm11-4-art','holo')],'https://api.tcgdex.net/v2/en/cards/sm11-4');
  // LV.X fronts carry their foil across the whole silver frame, not one window.
  if(category==='pokemon'&&/^(?:dp|pl|hgss|col)/i.test(set)&&(norm(c.stage)==='levelup'||/lvx/.test(rarity))&&physicalFinish==='holofoil')return {...preset(key,label,'ptcg-holo',[layer('card','holo')],FINISH_SOURCES.pokemon),coverage:'full',reason:'Simulated LV.X holo · whole-card approximate coverage'};
  if(c.id==='swsh3-161'&&set==='swsh3'&&category==='trainer'&&physicalFinish==='reverse-holofoil')return {...preset(key,label,'ptcg-reverse',[layer('pk-swsh-trainer-field','rainbow')],'https://api.tcgdex.net/v2/en/cards/swsh3-161'),reason:'Simulated reverse holo · partial coverage',coverage:'partial'};
  const frame=fullArt?'':pokemonFrame(c);
  if(frame&&physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer(set==='cel25'&&!frame.includes('-evolved')?'pk-cel-art':frame+'-art','holo')],FINISH_SOURCES.pokemon);
  if(frame&&physicalFinish==='reverse-holofoil')return preset(key,label,'ptcg-reverse',[layer(frame+'-surround',/^sv/i.test(set)?'tiles':'rainbow')],/^pk-sm(?:-evolved)?$/.test(frame)?'https://api.tcgdex.net/v2/en/cards/sm11-6':FINISH_SOURCES.pokemon);
  // Energy, BREAK, Restored and pre-Diamond & Pearl layouts stay unmasked until measured.
  return unknown(key,label);
 }
 const rarity=norm(key);
 // Master YGO images are not mapped to individual edition watermarks. Never invent one.
 if(/quartercentury|ghost|ultimate|collector|gold|parallel/.test(rarity))return unknown(key,label);
 if(/pendulum|rush|token|skill/i.test(`${c.typeLine||''} ${c.type||''} ${c.frame||''}`))return unknown(key,label);
 const name=material=>layer('ygo-name',material),art=material=>layer('ygo-art',material);
 const specs={rare:['ygo-rare',[name('silver')]],superrare:['ygo-super',[art('holo')]],ultrarare:['ygo-ultra',[art('holo'),name('gold')]],secretrare:['ygo-secret',[art('secret'),name('rainbow')]],prismaticsecretrare:['ygo-prismatic',[art('prismatic'),name('rainbow')]],starlightrare:['ygo-starlight',[layer('ygo-broad','starlight')]]};
 const spec=specs[rarity];
 return spec?preset(key,label,...spec,FINISH_SOURCES.ygo):unknown(key,label);
}
export function finishChoices(game,c,ctx={}){
 if(!c?.id||!validSetContext(game,c,ctx))return [];
 if(game==='mtg')return ['nonfoil','foil','etched'].filter(key=>c.finishes?.includes(key)).map(key=>effectFor(game,c,key,{nonfoil:'Nonfoil',foil:'Traditional foil',etched:'Etched foil'}[key],ctx,key));
 if(game==='ptcg')return pokemonVariantChoices(c,requestedVariant(c,ctx)).filter(v=>v.key).map(v=>{
  const finish=variantFinish(v);
  // Pattern metadata is real identity, not permission to fake a generic texture.
  // Keep the selectable variant while its distinct physical pattern is unsupported.
  if(reviewedCosmosPreview(c,v))return {...preset(v.key,v.label,'ptcg-holo',[layer('pk-swsh-art','holo')],'https://api.tcgdex.net/v2/en/cards/'+c.id),pattern:'cosmos',materialProfile:'cosmos-holo'};
  // Measured ordinary frames give Cosmos an illustration window. This is an
  // approximate preview, not exact-printing art or authentication of a
  // physical foil. Other patterns/layouts stay explicit.
  const cosmosFrame=c.category==='Pokemon'&&/^(?:Holo Rare|Rare)$/i.test(c.rarity||'')?pokemonFrame(c):'';
  if(v.foil==='cosmos'&&v.finish==='holofoil'&&v.size==='standard'&&!v.stamps?.length&&!v.subtype&&cosmosFrame)
   return {...preset(v.key,v.label,'ptcg-holo',[layer(cosmosFrame+'-art','holo')],'https://api.tcgdex.net/v2/en/cards/'+c.id),pattern:'cosmos',materialProfile:'cosmos-holo',reason:'Simulated Cosmos holo · approximate illustration-window coverage'};
  if(v.foil)return {...unknown(v.key,v.label||v.key),reason:'Patterned finish preview unavailable for this printing.'};
  // Preserve a known variant even when its finish cannot be previewed.
  return finish?effectFor(game,c,v.key,v.label||v.key,ctx,finish):unknown(v.key,v.label||v.key);
 });
 if(game==='ygo'){
  const printing=quoteForContext(game,c,ctx)?.printing;
  if(!printing?.rarity)return [];
  return [effectFor(game,c,printing.rarity,printing.rarity,ctx,norm(printing.rarity)==='common'?'nonfoil':printing.rarity)];
 }
 return [];
}
// A pricing reference is not a physical finish or an edition selection.
const requestedVariant=(c,ctx)=>[ctx.priceFinish,ctx.finish,ctx.setVariant,c?.setContext?.variantKey].find(key=>key&&key!=='reference')||'';
function commonPokemonPresentation(c,choices){
 if(!choices.length||choices.some(p=>p.status==='unknown'))return null;
 const variants=new Map((c.variants||[]).map(v=>[v.key,v]));
 const physical=choices.map(p=>variantFinish(variants.get(p.key)||{}));
 if(!physical[0]||physical.some(f=>f!==physical[0]))return null;
 const signature=p=>JSON.stringify([p.effect,p.layers,p.coverage||'',p.texture||'',p.materialProfile||'',p.pattern||'']);
 if(choices.some(p=>signature(p)!==signature(choices[0])))return null;
 // Share only presentation. A blank key must not mark a commercial edition
 // selected, substitute its image, or leak into owned lots and price quotes.
 const first=choices[0],status=choices.every(p=>p.status==='verified')?'verified':'approximate';
 const label={nonfoil:'Nonfoil',holofoil:'Holofoil','reverse-holofoil':'Reverse holo'}[physical[0]]||physical[0];
 return {...first,key:'',label,status,sharedFinish:true,physicalFinish:physical[0],
  reason:physical[0]==='nonfoil'?'Nonfoil · no simulated shine':`${label} · shared finish preview; edition not selected${status==='approximate'?' · approximate coverage':''}`};
}
export function resolveFinish(game,c,ctx={}){
 if(game==='ptcg'&&ctx.savedProductId&&requestedVariant(c,ctx)===ctx.savedVariant&&pokemonVariantProductConflict(c,{variant:ctx.savedVariant,productId:ctx.savedProductId}))return {...unknown(ctx.savedVariant,'Saved product identity mismatch'),game,printingId:c?.id||'',face:Number(ctx.face||0),reason:'Saved product does not match this finish. Choose a verified version to browse.'};
 const choices=finishChoices(game,c,ctx),wanted=game==='ptcg'?requestedVariant(c,ctx):(ctx.priceFinish||ctx.finish||c?.setContext?.variantKey);
 // Invalid/unsupported explicit selections must never borrow another variant.
 let selected=choices.find(x=>x.key===wanted);
 if(game==='ygo')selected=choices[0];
 else if(!wanted){
  if(game==='ptcg'){
   // Browse-only preference: an ordinary, source-supported Holofoil option.
   // Never auto-select a stamped/patterned/edition-specific version or mutate
   // the price/add context. Explicit owned finishes above always win.
   const regular=c?.variants?.find(v=>v.key==='holofoil'&&variantFinish(v)==='holofoil'&&!v.foil&&!v.subtype&&!v.stamps?.length&&(!v.size||v.size==='standard'));
   const holo=regular&&choices.find(p=>p.key===regular.key&&p.status!=='unknown');
   selected=holo?{...holo,browseDefault:true,reason:'Holofoil preview · confirm your finish when adding'}:commonPokemonPresentation(c,choices);
  }
  else selected=choices.find(x=>x.key==='nonfoil')||(choices.length===1?choices[0]:null);
 }
 return {...(selected||unknown(wanted||ctx.priceFinish||'')),game,printingId:c?.id||'',face:Number(ctx.face||0)};
}
export const finishEffect=(game,c,ctx={})=>resolveFinish(game,c,ctx).effect;
// Mutates view context only, never a card, owned lot or saved state.
export function selectPreviewFinish(game,card,ctx,key){
 if(game==='ygo'||!finishChoices(game,card,ctx).some(x=>x.key===key))return false;
 ctx.priceFinish=key;
 if(game==='ptcg')ctx.setVariant=key;
 return true;
}

export function finishArtworkCard(game,c,ctx={}){
 if(game!=='ptcg'||!c||!validSetContext(game,c,ctx))return c;
 const key=requestedVariant(c,ctx);
 const variant=c.variants?.find(v=>v.key===key);
 return variant?.image||variant?.imageLarge?{...c,image:variant.image||variant.imageLarge,imageLarge:variant.imageLarge||variant.image}:c;
}
