// Printing-aware presentation only. Never infer availability from a quote, value or frame.
import {quoteForContext,validSetContext} from './pricing-presentation.js';
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
 'pk-swsh-art':'inset(9.8% 8% 52.5% 8%)',
 'pk-swsh-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,7% 9.1%,7% 50.7%,93% 50.7%,93% 9.1%,7% 9.1%)',
 'pk-standard-art':'inset(12.3% 8.2% 47.5% 8.2%)',
 'pk-standard-surround':'polygon(evenodd, 4% 3%,96% 3%,96% 97%,4% 97%,4% 3%,8.2% 12.3%,8.2% 52.5%,91.8% 52.5%,91.8% 12.3%,8.2% 12.3%)',
 'pk-trainer-art':'inset(18% 8.2% 40% 8.2%)',
 'pk-sv-art':'inset(9.8% 7.8% 52.5% 7.8%)',
 'pk-sv-surround':'polygon(evenodd, 5.5% 3%,94.5% 3%,94.5% 97%,5.5% 97%,5.5% 3%,7% 9.2%,7% 50.5%,93% 50.5%,93% 9.2%,7% 9.2%)',
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
  // Deliberately bounded to the base Scarlet & Violet expansion, whose publisher guide is cited.
  if(['sv01','sv1'].includes(set)&&category==='pokemon'&&physicalFinish==='reverse-holofoil'&&['common','uncommon','rare'].includes(rarity))return preset(key,label,'ptcg-reverse',[layer('pk-sv-surround','tiles')],FINISH_SOURCES.pokemon);
  // Finish availability is still source-supplied. Layout identifies where that
  // known finish catches the light; it never adds a variant or a price.
  const fullArt=/fullart|illustration|rainbow|shinyvmax|shinyv|secret|hyperrare|ultrarare/.test(rarity)||/^(vmax|vstar)$/i.test(c.stage||'')||/\s(?:V|GX|EX|ex|VMAX|VSTAR|V-UNION)$/.test(c.name||'');
  if(physicalFinish==='holofoil'&&fullArt){
   const textured=/specialillustration|shiny.*vmax|rainbow|fullart|ultrarare|rareultra|hyperrare/.test(rarity)||/^vmax$/i.test(c.stage||'');
   const gold=/^(sv|me)/i.test(set)&&rarity==='hyperrare';
   return {...preset(key,label,'ptcg-full-art',[layer('card',gold?'gold':'rainbow'),...(textured?[layer('card','micro')]:[])],FINISH_SOURCES.pokemon),coverage:'full',texture:textured?'micro-ridges':'smooth'};
  }
  const modern=/^(?:swsh|sm|xy|bw|dp|pl|hgss|sv)/i.test(set)||set==='cel25';
  if(modern&&category==='pokemon'){
   if(physicalFinish==='holofoil')return preset(key,label,'ptcg-holo',[layer(set==='cel25'?'pk-cel-art':/^swsh/i.test(set)?'pk-swsh-art':/^sv/i.test(set)?'pk-sv-art':'pk-standard-art','holo')],FINISH_SOURCES.pokemon);
   if(physicalFinish==='reverse-holofoil')return preset(key,label,'ptcg-reverse',[layer(/^swsh/i.test(set)?'pk-swsh-surround':/^sv/i.test(set)?'pk-sv-surround':'pk-standard-surround',/^sv/i.test(set)?'tiles':'rainbow')],FINISH_SOURCES.pokemon);
  }
  // Trainer and unusual layouts remain unmasked until their geometry is known.
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
 if(game==='ptcg')return [...new Map((c.variants||[]).filter(v=>v.key).map(v=>[v.key,v])).values()].map(v=>{
  const finish=variantFinish(v);
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
 const signature=p=>JSON.stringify([p.effect,p.layers,p.coverage||'',p.texture||'']);
 if(choices.some(p=>signature(p)!==signature(choices[0])))return null;
 // Share only presentation. A blank key must not mark a commercial edition
 // selected, substitute its image, or leak into owned lots and price quotes.
 const first=choices[0],status=choices.every(p=>p.status==='verified')?'verified':'approximate';
 const label={nonfoil:'Nonfoil',holofoil:'Holofoil','reverse-holofoil':'Reverse holo'}[physical[0]]||physical[0];
 return {...first,key:'',label,status,sharedFinish:true,physicalFinish:physical[0],
  reason:physical[0]==='nonfoil'?'Nonfoil · no simulated shine':`${label} · shared finish preview; edition not selected${status==='approximate'?' · approximate coverage':''}`};
}
export function resolveFinish(game,c,ctx={}){
 const choices=finishChoices(game,c,ctx),wanted=game==='ptcg'?requestedVariant(c,ctx):(ctx.priceFinish||ctx.finish||c?.setContext?.variantKey);
 // Invalid/unsupported explicit selections must never borrow another variant.
 let selected=choices.find(x=>x.key===wanted);
 if(game==='ygo')selected=choices[0];
 else if(!wanted){
  if(game==='ptcg')selected=commonPokemonPresentation(c,choices);
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
