// Reuse the app's exact-printing art and finish presentation. No rules or
// inventory changes; capture once before the deck enters a match snapshot.
import {cardKey} from './core.js';
import {magicArtworkSources} from './ui.js';
import {finishAttrs,attachFinishPreview} from './finish-preview.js';
import {handleArtworkError} from './artwork.js';
import {rarityEmblem} from './rarity-emblem.js';
import {cardBracketBadges} from './commander-evidence.js';
import {ruleText,ruleCardContext,dismissRuleHint} from './rule-dex.js';
const key=s=>String(s||'').trim().toLowerCase();
export function capturePracticeArtwork(deck,lookup){
 const captured=structuredClone(deck);
 for(const rows of [captured.cards||[],captured.side||[]])for(const row of rows){
  const selection=captured.referencePriceSelections?.[cardKey(row.name)],wanted=row.printingId||selection?.printingId||null,c=lookup(row.name,wanted);
  if(!c||wanted&&c.id!==wanted||![c.name,...(c.card_faces||[]).map(f=>f.name)].some(n=>key(n)===key(row.name))){delete row.playArtwork;continue;}
  const finish=row.finish||selection?.finish||(c.finishes?.includes('nonfoil')?'nonfoil':c.finishes?.length===1?c.finishes[0]:null);
  // Missing/unsupported finish remains unknown; never manufacture a foil.
  const frozen={};for(const field of ['id','oracle_id','name','set','collector_number','image_uris','card_faces','oracle_text','type_line','layout','finishes','frame','frame_effects','border_color','promo_types','set_type','rarity','mana_cost','cmc','power','toughness','keywords','loyalty','defense','colors','color_identity','legalities'])if(c[field]!==undefined)frozen[field]=structuredClone(c[field]);
  row.playArtwork={card:frozen,finish:finish&&c.finishes?.includes(finish)?finish:null,source:wanted?'selected-printing':'existing-catalog-printing',badges:cardBracketBadges(c)};
 }
 return captured;
}
export function resolvePracticeArtwork(surface){
 if(surface?.known!==true)return null;
 const saved=surface.printing?.playArtwork;if(!saved?.card?.id)return null;
 const original=saved.card,faces=original.card_faces||[],face=surface.face?faces.find(f=>key(f.name)===key(surface.face)):null;
 if(surface.face&&faces.length&&!face)return null;
 const card=face?{...original,image_uris:face.image_uris,oracle_text:face.oracle_text}:original;
 const imageSources=magicArtworkSources(card,'normal');
 const artImageUrl=card.image_uris?.art_crop||(!surface.face?faces[0]?.image_uris?.art_crop:null)||null;
 return {card,finish:saved.finish,badges:Array.isArray(saved.badges)?saved.badges:[],imageSources,imageUrl:imageSources[0]||null,artImageUrl,oracleText:card.oracle_text||faces.map(f=>f.oracle_text).filter(Boolean).join('\n\n')};
}
export function practiceArtworkHooks(){return {
 resolveCard:resolvePracticeArtwork,
 renderOracleText(text,surface){const node=document.createElement('div');node.className='play-match-rules';const data=resolvePracticeArtwork(surface);if(data)node.dataset.ruleCardContext=JSON.stringify(ruleCardContext('mtg',data.card));node.innerHTML=ruleText('mtg',text);return node;},
 decorateInspector(panel,surface){
  const data=resolvePracticeArtwork(surface);if(!data)return;
  const row=document.createElement('div');row.className='play-match-identity-badges';row.innerHTML=rarityEmblem('mtg',data.card.rarity,{finish:data.finish||''});
  for(const badge of data.badges){const chip=document.createElement('span');chip.className='chip';chip.textContent=badge.label;chip.title=badge.detail;row.append(chip);}
  panel.append(row);const wiki=document.createElement('a');wiki.href='#wiki/'+encodeURIComponent(data.card.name)+'/search';wiki.target='_blank';wiki.rel='noopener noreferrer';wiki.className='small';wiki.textContent='Read in CardStashy Wiki';panel.append(wiki);
 },
 decorateCard(node,surface){
  const data=resolvePracticeArtwork(surface),img=node.querySelector('img');if(!data||!img)return;
  const cropped=node.dataset.presentation==='battlefield';
  img.dataset.artSources=JSON.stringify(cropped&&data.artImageUrl?[data.artImageUrl,...data.imageSources]:data.imageSources);img.dataset.artIndex='0';img.classList.add('card-img');
  if(node.classList.contains('play-match-card')&&data.card.rarity){const badge=document.createElement('span');badge.className='play-match-card-badges';badge.innerHTML=rarityEmblem('mtg',data.card.rarity);node.append(badge);}
  if(!data.finish)return;
  // Preserve the exact finish identity on the crop, but do not stretch a
  // measured full-card foil mask over artwork with different geometry.
  const template=document.createElement('template');template.innerHTML='<span '+finishAttrs('mtg',data.card,{priceFinish:data.finish},cropped?'art':'card')+'></span>';
  for(const attr of template.content.firstElementChild.attributes)node.setAttribute(attr.name,attr.value);
  node.classList.add('play-match-art-surface');
 },
 mountEffects(root){const dispose=attachFinishPreview(root);root.addEventListener('error',handleArtworkError,true);return ()=>{dispose();dismissRuleHint();root.removeEventListener('error',handleArtworkError,true);};}
};}
