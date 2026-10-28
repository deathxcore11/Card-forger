import {foregroundDialog} from './feedback-layer.js';
import {esc} from './ui.js';
import {finishChoices,resolveFinish,FINISH_MASKS} from './finish-effects.js';
import {finishMaterialProfile,hasFinishPattern,verifiedTitleMask} from './finish-materials.js';
import {ygoNameMask,nameMaskStyle,mountYgoNameFoil} from './ygo-name-foil.js';
import {mountYgoRarityFoil} from './ygo-rarity-foil.js';
import {mountMtgFoil} from './mtg-foil.js';
import {mountPtcgFoil} from './ptcg-foil.js';
import {ygoRarityEffect,ygoRarityRank,ygoRaritySwatch} from './ygo-foil-recipes.js';
import {quoteForContext} from './pricing-presentation.js';
import {mountFinishPop} from './foil-fx.js';
export {finishChoices,finishEffect,resolveFinish,selectPreviewFinish,finishArtworkCard} from './finish-effects.js';
const KEY='cardstashy-finish-effects';
export const finishEffectsOn=()=>{try{return localStorage.getItem(KEY)!=='off';}catch{return true;}};
export function setFinishEffects(enabled){let saved=false;try{localStorage.setItem(KEY,enabled?'on':'off');saved=true;}catch{}globalThis.dispatchEvent?.(new Event('cardstashy-finish-effects-change'));return saved;}
const reduced=()=>!!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// The finish of a saved collection entry: its Magic finish, Pokémon version, or Yu-Gi-Oh! printing and edition.
export function entryFinishContext(game,e={}){return game==='mtg'?{priceFinish:e.finish||'nonfoil'}:{priceFinish:e.variant,savedVariant:e.variant,savedProductId:e.productId,priceEdition:e.printing&&e.rarity?e.printing+'::'+e.rarity:'',priceYgoEdition:e.edition};}
export function finishAttrs(game,c,ctx={},view='large'){
 const p=resolveFinish(game,c,ctx);
 p.materialProfile=finishMaterialProfile(game,c,p);
 return `data-finish-game="${esc(game)}" data-finish-surface="${view}" data-finish-effect="${esc(p.effect)}" data-finish-model="${esc(JSON.stringify(p))}"`;
}
// Yu-Gi-Oh! reprints one card in many rarities. Instead of a printing list first, the Finish row
// offers each rarity this card exists in (plainest first, with a swatch of its foil). A tap picks a
// representative printing of that rarity (the cheapest, or the one already chosen) through the same
// selection as the Printing & rarity menu, so price, edition and collection stay in step.
const rarityKey=v=>String(v||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const shortRarity=r=>r==='Rare'||r==='Short Print'?r:r.replace(/ Rare$/,'');
export function ygoRarityOptions(c,ctx={}){
 const quote=quoteForContext('ygo',c,ctx),rows=quote?.editions||[];if(!rows.length)return {options:[],selected:''};
 const price=key=>{const p=(c.sets||[]).find(s=>s.code+'::'+s.rarity===key)?.price;return Number.isFinite(p)&&p>0?p:Infinity;};
 const groups=new Map();
 for(const e of rows){if(!e.rarity)continue;const g=groups.get(e.rarity)||{rarity:e.rarity,keys:[]};g.keys.push(e.key);groups.set(e.rarity,g);}
 const selected=quote.rarity||'';
 const options=[...groups.values()].map(g=>{const effect=ygoRarityEffect(rarityKey(g.rarity)),key=g.rarity===selected&&g.keys.includes(quote.editionKey)?quote.editionKey:[...g.keys].sort((a,b)=>price(a)-price(b))[0];
  return {rarity:g.rarity,label:shortRarity(g.rarity),count:g.keys.length,key,rank:ygoRarityRank(effect),swatch:ygoRaritySwatch(effect)};})
  .sort((a,b)=>a.rank-b.rank||a.rarity.localeCompare(b.rarity));
 return {options,selected};
}
// Search tiles: the card's most premium rarities as swatches, so shiny printings are visible before opening it.
export function ygoRarityStrip(c,max=4){
 const seen=new Map();for(const s of c?.sets||[]){if(!s.rarity||seen.has(s.rarity))continue;const effect=ygoRarityEffect(rarityKey(s.rarity));seen.set(s.rarity,{rarity:s.rarity,rank:ygoRarityRank(effect),swatch:ygoRaritySwatch(effect)});}
 const list=[...seen.values()].filter(r=>r.rank>0).sort((a,b)=>b.rank-a.rank);if(!list.length)return '';
 const extra=list.length-max;
 return `<span class="rarity-strip" role="img" aria-label="${esc(`${seen.size} ${seen.size===1?'rarity':'rarities'}, up to ${list[0].rarity}`)}">${list.slice(0,max).map(r=>`<span class="rarity-swatch rarity-swatch-${r.swatch}" title="${esc(r.rarity)}"></span>`).join('')}${extra>0?`<small>+${extra}</small>`:''}</span>`;
}
function ygoRarityRail(c,ctx,p){
 const {options,selected}=ygoRarityOptions(c,ctx);if(!options.length)return '';
 const chosen=options.find(o=>o.rarity===selected),quote=chosen&&quoteForContext('ygo',c,ctx);
 const foot=chosen?`${chosen.rarity} · ${quote?.printing?.code||''} ${quote?.printing?.name||''}${chosen.count>1?` · ${chosen.count} ${chosen.label} printings, pick the exact one in Printing & rarity`:''}`:`${options.length} ${options.length===1?'rarity':'rarities'} · tap one to see its shine`;
 return `<div class="finish-preview ygo-rarity-preview" role="group" aria-label="Rarity"><span class="small muted">Rarity</span><span class="finish-choice-hint small muted" hidden aria-hidden="true">Scroll ↔</span><div class="finish-choice-rail ygo-rarity-chips" tabindex="0" aria-label="Rarities this card was printed in">${options.map(o=>`<button type="button" class="chip ygo-rarity-chip${o.rarity===selected?' on':''}" data-act="ygoPickRarity" data-card-id="${esc(c.id)}" data-edition="${esc(o.key)}" aria-pressed="${o.rarity===selected}" aria-label="${esc(o.rarity)}, ${o.count} ${o.count===1?'printing':'printings'}"><span class="rarity-swatch rarity-swatch-${o.swatch}" aria-hidden="true"></span>${esc(o.label)}${o.count>1?`<small aria-hidden="true">${o.count}</small>`:''}</button>`).join('')}</div><p class="foot" role="status">${esc(foot.trim())}${chosen&&p.effect!=='plain'&&p.status!=='unknown'?' · '+esc(p.reason||'Simulated finish'):''}</p></div>`;
}
// Swatches explain the material without turning price or rarity into availability.
export function finishSwatch(game,choice){
 if(choice.status==='unknown'||choice.effect==='unknown')return 'unknown';
 if(choice.effect==='plain')return 'plain';
 if(choice.key==='etched')return 'silver';
 if(choice.key==='reverse-holofoil')return 'reverse';
 return game==='ptcg'?'glitter':'rainbow';
}
export function finishPreview(game,c,ctx={}){
 const choices=finishChoices(game,c,ctx),p=resolveFinish(game,c,ctx);
 if(game==='ygo'){const rail=ygoRarityRail(c,ctx,p);if(rail)return rail;}
 return `<div class="finish-preview" role="group" aria-label="Card finish"><span class="small muted">Finish</span><span class="finish-choice-hint small muted" hidden aria-hidden="true">Scroll ↔</span><div class="finish-choice-rail" tabindex="0" aria-label="Card finishes, scroll horizontally">${game==='ygo'&&!choices.length?'<button type="button" class="chip" data-act="cardTab" data-tab="prices">Choose printing</button>':''}${choices.map(v=>`<button type="button" class="chip finish-choice-chip${v.key===p.key?' on':''}" ${game==='ygo'?'':`data-act="cardFinishPreview" data-game="${esc(game)}" data-card-id="${esc(c.id)}" data-finish="${esc(v.key)}"`} aria-pressed="${v.key===p.key}"><span class="rarity-swatch rarity-swatch-${finishSwatch(game,v)}" aria-hidden="true"></span>${esc(v.label)}</button>`).join('')}</div><p class="foot" role="status">${esc(p.effect==='plain'?'Nonfoil · no simulated shine':p.status==='unknown'?(game==='ygo'&&!choices.length?'Choose the set code and rarity to preview its finish.':'Finish preview unavailable for this printing.'):(p.key&&p.label?p.label+' · ':'')+(p.reason||'Simulated finish'))}</p></div>`;
}
// Reveal a newly selected finish within its own rail, never by scrollIntoView
// (which can move the card sheet or page). Repeated renders must respect swipes.
const finishChoiceStates=new WeakMap();
export function syncFinishChoiceRail(rail,{force=false}={}){
 if(!rail||rail.isConnected===false)return;
 const width=Number(rail.clientWidth)||0;
 if(width<=0)return; // A hidden panel has no useful geometry yet.
 const max=Math.max(0,(Number(rail.scrollWidth)||0)-width),overflow=max>1,
   hint=rail.parentElement?.querySelector?.('.finish-choice-hint');
 if(hint&&hint.hidden===overflow)hint.hidden=!overflow;
 const selected=rail.querySelector?.('[aria-pressed="true"]'),previous=finishChoiceStates.get(rail);
 finishChoiceStates.set(rail,{selected,width,max});
 if(!selected||!overflow||(!force&&previous?.selected===selected&&previous.width===width&&previous.max===max))return;
 const viewport=rail.getBoundingClientRect(),button=selected.getBoundingClientRect(),
   left=viewport.left+(rail.clientLeft||0),right=left+width,
   delta=button.width>width||button.left<left?button.left-left:button.right>right?button.right-right:0;
 if(delta)rail.scrollLeft=Math.max(0,Math.min(max,(Number(rail.scrollLeft)||0)+delta));
}
// Object-fit: contain geometry in untransformed CSS pixels; the same parent transforms both layers.
export function containedImageBox(width,height,naturalWidth,naturalHeight){
 if(![width,height,naturalWidth,naturalHeight].every(x=>Number.isFinite(x)&&x>0))return null;
 const k=Math.min(width/naturalWidth,height/naturalHeight),w=naturalWidth*k,h=naturalHeight*k;
 return {left:(width-w)/2,top:(height-h)/2,width:w,height:h};
}
export function finishEligible(el){
 if(!el?.dataset?.finishSurface||el.hidden||el.closest?.('[hidden]'))return false;
 return el.dataset.finishSurface==='detail'||el.dataset.finishSurface==='zoom'||el.dataset.finishSurface==='pack'||(el.dataset.finishSurface==='card'&&!el.closest?.('.view-compact,.view-symbols'))||(el.dataset.finishSurface==='large'&&!!el.closest?.('.view-gallery')&&!el.closest?.('.view-compact,.view-symbols'));
}
function modelOf(el){try{return JSON.parse(el.dataset.finishModel||'{}');}catch{return {};}}
// Per-image maps must never paint a later fallback or custom scan they were not measured on.
export function finishImageMatches(model,source){
 if(!model.imageSources)return true;
 try{const base=globalThis.location?.href||'https://cardstashy.com/',actual=new URL(source,base);return model.imageSources.some(value=>{const expected=new URL(value,base);return actual.origin===expected.origin&&actual.pathname===expected.pathname;});}catch{return false;}
}
// Select the measured profile for the decoded image, including known provider fallbacks.
export function finishOverlayProfile(model,source){
 return model.overlayProfiles?.find(p=>finishImageMatches({imageSources:p.images},source))||null;
}
const attached=new WeakMap();
const buzzed=new WeakSet();
export function attachFinishPreview(root){
 if(!root)return ()=>{};
 if(attached.has(root))return attached.get(root);
 const mounted=new Map(),watched=new Set(),choiceRails=new Set(),cleanups=[];
 const on=(el,type,fn,options)=>{el?.addEventListener?.(type,fn,options);cleanups.push(()=>el?.removeEventListener?.(type,fn,options));};
 const visible=el=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<(globalThis.innerHeight||Infinity)&&r.right>0&&r.left<(globalThis.innerWidth||Infinity);};
 const foreground=el=>{const top=foregroundDialog();return !top||top.contains(el);};
 const allowed=el=>finishEffectsOn()&&!reduced()&&!globalThis.document?.hidden&&finishEligible(el)&&el.isConnected!==false&&foreground(el);
 const unmount=el=>{const m=mounted.get(el);if(m){ro?.unobserve(m.img);m.nameFoil?.dispose();m.rarityFoil?.dispose();m.overlay.remove();m.pop?.remove();mounted.delete(el);}};
 const size=el=>{
  const m=mounted.get(el);if(!m)return;
  const {img,overlay,host}=m,css=globalThis.getComputedStyle?.(img),px=v=>parseFloat(v)||0;
  const left=px(css?.paddingLeft),top=px(css?.paddingTop),box=containedImageBox(img.clientWidth-left-px(css?.paddingRight),img.clientHeight-top-px(css?.paddingBottom),img.naturalWidth,img.naturalHeight);
  if(!box||img.hidden){if(!overlay.hidden)overlay.hidden=true;if(m.pop)m.pop.hidden=true;return;}
  let x=(img.offsetLeft||0)+(img.clientLeft||0)+left,y=(img.offsetTop||0)+(img.clientTop||0)+top,ancestor=img.offsetParent;
  while(ancestor&&ancestor!==host){x+=ancestor.offsetLeft||0;y+=ancestor.offsetTop||0;ancestor=ancestor.offsetParent;}
  if(ancestor!==host){if(!overlay.hidden)overlay.hidden=true;if(m.pop)m.pop.hidden=true;return;}
  const geo={left:`${x+box.left}px`,top:`${y+box.top}px`,width:`${box.width}px`,height:`${box.height}px`};Object.assign(overlay.style,geo);if(overlay.hidden)overlay.hidden=false;
  if(m.pop){Object.assign(m.pop.style,geo);m.pop.hidden=false;}
 };
 const ro=typeof ResizeObserver==='undefined'?null:new ResizeObserver(entries=>{for(const [el,m] of mounted)if(entries.some(x=>x.target===m.img))size(el);for(const entry of entries)if(choiceRails.has(entry.target))syncFinishChoiceRail(entry.target);});
 const mount=el=>{
  if(!allowed(el)||!visible(el))return unmount(el);
  // A standalone card face only foils once it is big enough to read as a card.
  if(el.dataset.finishSurface==='card'&&el.getBoundingClientRect().width<90)return unmount(el);
  const p=modelOf(el),detail=['detail','zoom'].includes(el.dataset.finishSurface);if(!p.layers?.length&&!detail)return unmount(el);
  if(mounted.has(el)){const old=mounted.get(el);if(old.model===el.dataset.finishModel&&old.src===old.img.currentSrc&&old.overlay.isConnected)return size(el);unmount(el);}
  const img=el.querySelector?.('img'),host=el.dataset.finishSurface==='detail'?(el.querySelector('.cd-zoom')||el):el;
  if(!img||!img.complete||!img.naturalWidth||img.hidden)return;
  if(!finishImageMatches(p,img.currentSrc||img.src))return unmount(el);
  const overlay=img.ownerDocument.createElement('span');overlay.className='finish-overlay'+(['large','card'].includes(el.dataset.finishSurface)?' finish-auto':'');
  const profile=finishOverlayProfile(p,img.currentSrc||img.src);
  if(profile&&FINISH_MASKS[profile.mask])overlay.style.clipPath=FINISH_MASKS[profile.mask];
  const layers=profile?.artMask?(p.layers||[]).map(l=>({...l,mask:profile.artMask})):(p.layers||[]);
  if(p.materialProfile)overlay.dataset.materialProfile=p.materialProfile;
  if(['large','card'].includes(el.dataset.finishSurface)){const phase=String(p.printingId||'').split('').reduce((n,c)=>n+c.charCodeAt(0),0)%80;overlay.style.animationDelay=`-${phase/10}s`;}
  overlay.setAttribute('aria-hidden','true');
  if(detail){const light=img.ownerDocument.createElement('span');light.className='finish-spotlight';overlay.append(light);}
  for(const l of layers){if(!FINISH_MASKS[l.mask])continue;const part=img.ownerDocument.createElement('span');part.className=`finish-layer finish-${l.material}${l.mask==='ygo-name'?' finish-name-region':''}`;part.style.clipPath=FINISH_MASKS[l.mask];overlay.append(part);}
  if(hasFinishPattern(p.materialProfile)&&FINISH_MASKS[layers[0]?.mask]){const pattern=img.ownerDocument.createElement('span');pattern.className='finish-pattern';pattern.style.clipPath=FINISH_MASKS[layers[0].mask];overlay.append(pattern);}
  // Foil pass: every real foil (not a plain card) gets the pop layer over the whole card face: rim, glare,
  // glints and a light catch. It covers the card box, so it maps to each game's frame at any size.
  const pop=p.effect&&p.effect!=='plain'?mountFinishPop(host,{surface:el.dataset.finishSurface,seed:p.printingId||img.currentSrc}):null;
  // Opening a foil in the zoom view gives a small tap, once per card, so a rare foil feels like one.
  if(pop&&el.dataset.finishSurface==='zoom'&&!buzzed.has(el)){buzzed.add(el);import('./feel.js').then(m=>m.haptic('pack-value-2')).catch(()=>{});}
  host.append(overlay);if(pop)host.append(pop);mounted.set(el,{img,host,overlay,pop,model:el.dataset.finishModel,src:img.currentSrc});ro?.observe(img);size(el);
  // Yu-Gi-Oh!, Magic and Pokémon cards get the WebGL foil; the CSS layers stay beneath as the fallback.
  if(p.game==='ygo')mounted.get(el).rarityFoil=mountYgoRarityFoil(overlay,img,p.effect,{surface:el.dataset.finishSurface,layout:p.layout,stars:p.stars});
  else if(p.game==='mtg'&&p.treatment)mounted.get(el).rarityFoil=mountMtgFoil(overlay,img,p.treatment,{surface:el.dataset.finishSurface,frame:p.frame,holostamp:!!p.holostamp});
  else if(p.game==='ptcg'&&p.treatment)mounted.get(el).rarityFoil=mountPtcgFoil(overlay,img,p.treatment,{surface:el.dataset.finishSurface,clip:FINISH_MASKS[layers[0]?.mask]||'',window:!!profile});
  const nameLayer=p.game==='ygo'&&(p.layers||[]).find(l=>l.mask==='ygo-name'),nameMask=nameLayer?ygoNameMask(img):null;
  if(nameMask){
   // Letters from this exact image replace the title-band placeholder; the art foil layers are unchanged.
   for(const n of overlay.querySelectorAll('.finish-name-region')){Object.assign(n.style,nameMaskStyle(nameMask.alphaUrl));n.classList.add('finish-title-glyphs');}
   // The big card faces (detail, zoom, a pulled pack card) also draw the lettering's own WebGL foil.
   if(detail||el.dataset.finishSurface==='pack'){const m=mounted.get(el);m.nameFoil=mountYgoNameFoil(overlay,img,nameLayer.material,nameMask);}
  }else if(p.game==='ygo'&&overlay.querySelector('.finish-name-region')){
   const src=img.currentSrc;
   void verifiedTitleMask(p.printingId,src).then(mask=>{if(!mask||mounted.get(el)?.overlay!==overlay||img.currentSrc!==src)return;for(const n of overlay.querySelectorAll('.finish-name-region')){n.style.clipPath='none';n.style.maskImage=`url("${mask}")`;n.classList.add('finish-title-glyphs');}});
  }
 };
 const io=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{for(const x of entries){if(!x.isIntersecting)unmount(x.target);else mount(x.target);}}, {threshold:0});
 let pending=false;
 const sync=()=>{
  pending=false;
  for(const rail of choiceRails)if(rail.isConnected===false){ro?.unobserve(rail);choiceRails.delete(rail);}
  for(const rail of root.querySelectorAll?.('.finish-choice-rail')||[]){if(!choiceRails.has(rail)){choiceRails.add(rail);ro?.observe(rail);}syncFinishChoiceRail(rail);}
  for(const el of watched)if(!el.isConnected||!finishEligible(el)){io?.unobserve(el);watched.delete(el);unmount(el);}
  for(const el of root.querySelectorAll?.('[data-finish-surface]')||[]){
   if(!finishEligible(el))continue;
   if(!watched.has(el)){watched.add(el);io?.observe(el);}
   mount(el);
  }
  for(const el of mounted.keys())if(!allowed(el))unmount(el);
 };
 const queue=()=>{if(!pending){pending=true;queueMicrotask(sync);}};
 on(globalThis,'cardstashy-finish-effects-change',sync);
 // Visible large cards use a shared CSS light sweep. The existing detail tilt owns
 // its light coordinates. No per-card JavaScript animation loop is installed.
 const interact=e=>{const el=e.target.closest?.('[data-finish-surface]');if(el)mount(el);};
 if(root.querySelectorAll&&globalThis.document){
  let interactionOn=false;
  const interactionEvents=[['pointerover',{passive:true}],['pointerdown',{passive:true}],['focusin',false],['load',{capture:true,passive:true}]];
  const setInteraction=()=>{
   const enable=!reduced();if(enable===interactionOn)return;interactionOn=enable;
   for(const [type,options] of interactionEvents)root[enable?'addEventListener':'removeEventListener']?.(type,interact,options);
  };
  setInteraction();cleanups.push(()=>{for(const [type,options] of interactionEvents)root.removeEventListener?.(type,interact,options);});
  on(globalThis.document,'visibilitychange',sync);
  on(globalThis,'resize',()=>{for(const el of mounted.keys())size(el);for(const rail of choiceRails)syncFinishChoiceRail(rail,{force:true});},{passive:true});
  const media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');on(media,'change',()=>{setInteraction();sync();});
  if(typeof MutationObserver!=='undefined'){
   const mo=new MutationObserver(records=>{if(records.some(r=>r.type==='attributes'||[...r.addedNodes,...r.removedNodes].some(n=>!n.classList?.contains('finish-overlay'))))queue();});
   mo.observe(root===document?document.body:root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','open','hidden','data-finish-model','aria-pressed']});cleanups.push(()=>mo.disconnect());
  }
  sync();
 }
 const dispose=()=>{for(const fn of cleanups)fn();io?.disconnect();ro?.disconnect();for(const el of mounted.keys())unmount(el);watched.clear();choiceRails.clear();attached.delete(root);};
 attached.set(root,dispose);return dispose;
}
