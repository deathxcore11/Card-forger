import {S,meta} from './store.js';
import {esc} from './ui.js';
import {actionIcon} from './icons.js';
import {engineRoles} from './insights.js';

// The deck preference keeps its existing keys. Collection/search retain their
// own three views; every deck source shares these four presentations.
// Randall 31 Oct: Stacks, Art grid, Names, Detailed list; Art grid by default.
export const DECK_VIEWS=['stacks','gallery','symbols','compact'];
const LABELS={compact:'Detailed list',stacks:'Stacks',gallery:'Art grid',symbols:'Names only'};
const ICONS={compact:'viewCompact',stacks:'viewStacks',gallery:'viewGallery',symbols:'viewSymbols'};
export function deckViewFor(game){
 const mode=S.state.settings.displayModes?.[game]?.deck;
 return DECK_VIEWS.includes(mode)?mode:'gallery';
}
export function deckViewControl(game){
 const current=deckViewFor(game);
 return `<div class="deck-view-toolbar"><span class="small muted">Deck view</span><div class="view-switch deck-view-switch" role="radiogroup" aria-label="Deck view" data-game="${esc(game)}">${DECK_VIEWS.map(mode=>`<button type="button" role="radio" aria-checked="${mode===current}" tabindex="${mode===current?0:-1}" class="${mode===current?'on':''}" data-act="deckView" data-mode="${mode}" data-game="${esc(game)}" title="${LABELS[mode]}" aria-label="${LABELS[mode]}">${actionIcon(ICONS[mode])}</button>`).join('')}</div></div>`;
}
export function deckViewer(game,html,{controls=true}={}){
 const mode=deckViewFor(game);
 // The established gallery class admits the original printing-specific finish
 // renderer on full-size art, including stacks. Its materials stay unchanged.
 return `<section class="deck-viewer${['gallery','stacks'].includes(mode)?' view-gallery':''}" data-deck-view="${mode}" data-game="${esc(game)}" aria-label="Deck cards">${controls?deckViewControl(game):''}${html}</section>`;
}
// Type metadata comes from the same loaded printing used for the card itself.
// Unknown cards stay explicit rather than being guessed from their names.
export function deckCardCategory(card){
 const normalized=String(card?.category||card?.supertype||'');
 const type=/^(?:Pokémon|Pokemon|Trainer|Energy|Monster|Spell|Trap)$/i.test(normalized)?normalized:String(card?.type_line||card?.typeLine||normalized||card?.type||card?.kind||'');
 if (/^(?:Pokémon|Pokemon)$/i.test(type))return 'Pokémon';
 if (/^Trainer$/i.test(type))return 'Trainers';
 if (/^Energy$/i.test(type))return 'Energy';
 if (/Monster/i.test(type))return 'Monsters';
 if (/\bSpell\b/i.test(type))return 'Spells';
 if (/\bTrap\b/i.test(type))return 'Traps';
 const front=type.split(' // ')[0].split(/[—–]/)[0];
 for(const [pattern,label] of [[/\bLand\b/i,'Lands'],[/\bCreature\b/i,'Creatures'],[/\bPlaneswalker\b/i,'Planeswalkers'],[/\bInstant\b/i,'Instants'],[/\bSorcery\b/i,'Sorceries'],[/\bArtifact\b/i,'Artifacts'],[/\bEnchantment\b/i,'Enchantments'],[/\bBattle\b/i,'Battles']])if(pattern.test(front))return label;
 return 'Unresolved';
}
export function deckCardAttrs(name,qty,zone='main',card=null,category=''){
 const loaded=card?.type_line||card?.typeLine||card?.category||card?.supertype||card?.type||card?.kind?card:meta(name)||card,group=category||deckCardCategory(loaded);
 const roles=loaded?.type_line?engineRoles(loaded).filter(role=>role!=='Land'):[];
 return `data-deck-card data-deck-name="${esc(name)}" data-deck-qty="${esc(qty)}" data-deck-zone="${esc(zone)}" data-deck-category="${esc(group)}" data-deck-roles="${esc(roles.join(','))}"`;
}
const originalDeckChildren=new WeakMap();
const GROUP_ORDER=['Commander','Creatures','Planeswalkers','Instants','Sorceries','Artifacts','Enchantments','Battles','Lands','Pokémon','Trainers','Energy','Monsters','Spells','Traps','Unresolved'];
function stackList(list){
 if(originalDeckChildren.has(list))return;
 // Back navigation restores serialized HTML, so recover the original order
 // from each retained card rather than depending on an in-memory wrapper map.
 if(list.querySelector(':scope > .deck-stack-group')){originalDeckChildren.set(list,[...list.querySelectorAll('[data-deck-card]')].sort((a,b)=>Number(a.dataset.deckOriginalIndex)-Number(b.dataset.deckOriginalIndex)));return;}
 const original=[...list.childNodes],cards=[...list.querySelectorAll(':scope > [data-deck-card]')];
 if(!cards.length)return;
 originalDeckChildren.set(list,original);
 cards.forEach((card,index)=>{card.dataset.deckOriginalIndex=String(index);});
 const groups=new Map();
 for(const card of cards){const category=card.dataset.deckCategory||'Unresolved';if(!groups.has(category))groups.set(category,[]);groups.get(category).push(card);}
 const fragment=list.ownerDocument.createDocumentFragment();
 let totalPiles=0;
 for(const [category,rows] of [...groups].sort(([a],[b])=>GROUP_ORDER.indexOf(a)-GROUP_ORDER.indexOf(b))){
  const section=list.ownerDocument.createElement('section'),heading=list.ownerDocument.createElement('h4'),columns=list.ownerDocument.createElement('div');
  const count=rows.reduce((sum,card)=>sum+(Number(card.dataset.deckQty)||0),0);
  section.dataset.deckStackGroup=category;section.dataset.deckCount=String(count);section.className='deck-stack-group';
  const pileCount=Math.ceil(rows.length/6);totalPiles+=pileCount;
  section.style.setProperty('--deck-stack-basis',`${pileCount*206-16}px`);section.style.setProperty('--deck-stack-small-basis',`${pileCount*158-10}px`);
  heading.className='deck-stack-heading';heading.innerHTML=`<span>${esc(category)}</span><span class="deck-stack-count">${count}</span>`;
  // Saved Magic lists already provide a collapsible type heading.
  heading.hidden=groups.size===1&&!!list.parentElement?.matches('details.group')&&String(list.parentElement.querySelector(':scope > summary > span')?.textContent||'').trim().startsWith(category);
  columns.className='deck-stack-columns';
  for(let start=0;start<rows.length;start+=6){
   const pile=list.ownerDocument.createElement('div'),batch=rows.slice(start,start+6);pile.className='deck-stack-pile';pile.style.setProperty('--deck-stack-size',String(batch.length));
   batch.forEach((card,index)=>{
    if(card.matches('button')&&!card.hasAttribute('aria-label'))card.setAttribute('aria-label',`${card.dataset.deckQty}× ${card.dataset.deckName}`);
    card.style.setProperty('--deck-stack-index',String(index+1));
    const roles=(card.dataset.deckRoles||'').split(',').filter(Boolean);
    if(roles.length&&!card.querySelector('.deck-stack-roles')){const badge=list.ownerDocument.createElement('span');badge.className='deck-stack-roles';badge.textContent=roles.join(' · ');badge.setAttribute('aria-label','Roles: '+roles.join(', '));card.append(badge);}
    pile.append(card);
   });columns.append(pile);
  }
  section.append(heading,columns);fragment.append(section);
 }
 if(list.parentElement?.matches('details.group')){list.parentElement.style.setProperty('--deck-stack-basis',`${totalPiles*206-16}px`);list.parentElement.style.setProperty('--deck-stack-small-basis',`${totalPiles*158-10}px`);}
 list.replaceChildren(fragment);
}
function stackSummary(viewer){
 let summary=viewer.querySelector(':scope > .deck-stack-summary');
 const counts=new Map();
 for(const card of viewer.querySelectorAll('[data-deck-card]')){
  if(card.dataset.deckZone==='side')continue;
  for(const role of (card.dataset.deckRoles||'').split(',').filter(Boolean))counts.set(role,(counts.get(role)||0)+(Number(card.dataset.deckQty)||0));
 }
 if(!counts.size){summary?.remove();return;}
 if(!summary){summary=viewer.ownerDocument.createElement('div');summary.className='deck-stack-summary';summary.setAttribute('aria-label','Main deck roles');const toolbar=viewer.querySelector(':scope > .deck-view-toolbar');viewer.insertBefore(summary,toolbar?toolbar.nextSibling:viewer.firstChild);}
 summary.innerHTML=[...counts].map(([role,count])=>`<span>${esc(role)} <b>${count}</b></span>`).join('');
}
function unstackList(list){
 const original=originalDeckChildren.get(list)||(list.querySelector(':scope > .deck-stack-group')?[...list.querySelectorAll('[data-deck-card]')].sort((a,b)=>Number(a.dataset.deckOriginalIndex)-Number(b.dataset.deckOriginalIndex)):null);
 if(!original)return;
 list.replaceChildren(...original);originalDeckChildren.delete(list);
}

// A layout change must not replace card nodes, selected checkboxes, disclosures
// or the sheet. Snapshots restored by Back use today's saved preference too.
export function syncDeckViewers(root=globalThis.document){
 for(const viewer of root?.querySelectorAll?.('.deck-viewer')||[]){
  viewer.dataset.deckView=deckViewFor(viewer.dataset.game);
  viewer.classList.toggle('view-gallery',['gallery','stacks'].includes(viewer.dataset.deckView));
  for(const list of viewer.querySelectorAll('[data-deck-list]')){if(viewer.dataset.deckView==='stacks')stackList(list);else unstackList(list);}
  if(viewer.dataset.deckView==='stacks')stackSummary(viewer);
 }
 for(const group of root?.querySelectorAll?.('.deck-view-switch')||[]){
  const mode=deckViewFor(group.dataset.game);
  for(const button of group.querySelectorAll('[data-act="deckView"]')){
   const selected=button.dataset.mode===mode;
   button.classList.toggle('on',selected);button.setAttribute('aria-checked',String(selected));button.tabIndex=selected?0:-1;
  }
 }
 const content=root?.querySelector?.('#content'),viewer=content?.querySelector?.('.deck-viewer');
 if(viewer){for(const mode of DECK_VIEWS)content.classList.remove('view-'+mode);content.classList.add('view-'+deckViewFor(viewer.dataset.game));}
}
export function wireDeckViewKeyboard(root=globalThis.document){
 root?.addEventListener?.('keydown',event=>{
  const target=event.target.closest?.('.deck-view-switch [data-act="deckView"]');
  if(!target||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const buttons=[...target.parentElement.querySelectorAll('[data-act="deckView"]')],index=buttons.indexOf(target);
  const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
  event.preventDefault();buttons[next].focus();buttons[next].click();
 });
}

// One master deck header for every source (My deck, Meta, AI build, Random build) in
// all three games (Randall 31 Oct). Hero art, deck name, source badge, format and
// legality, four quiet facts, at most three actions (one gold) and the optional
// Original / Budget / My cards switch. Each source only fills in the slots.
// art: image URL, or artHtml for a game-specific crop. stats: [{value,label,tone,attrs}].
// actions: [{label,attrs,primary,disabled,html}] (html passes a prepared control through).
export function deckShell({game,source='mine',art='',artHtml='',title='',back='',menu='',badge='',format='',legality='',line='',stats=[],owned=null,actions=[],versions='',status='',lead=''}){
 const hero=artHtml||(art?`<img class="hero-art" src="${esc(art)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:'');
 const stat=s=>{const tag=s.attrs?'button':'span';return `<${tag} class="ds-stat${s.tone?' '+esc(s.tone):''}${s.cls?' '+esc(s.cls):''}" ${s.attrs?'type="button" '+s.attrs:''}><b>${s.value}</b><span>${esc(s.label)}</span>${s.more||''}</${tag}>`;};
 const act=a=>a.html||`<button type="button" class="btn${a.primary?' ds-primary':' ghost'}" ${a.attrs||''} ${a.disabled?'disabled':''}>${a.label}</button>`;
 const pct=Number.isFinite(owned)?Math.round(Math.min(1,Math.max(0,owned))*100):null;
 return `<section class="deck-hero ds-hero" data-audit-frame data-deck-source="${esc(source)}" data-game="${esc(game)}">${hero}<div class="hero-shade"></div>
  <div class="hero-body"><div class="row between ds-nav">${back||'<span></span>'}${menu||'<span></span>'}</div>
   <div class="deck-hero-id"><p class="deck-hero-eyebrow">${badge?`<span class="chip dark ds-badge">${badge}</span>`:''}${format}${legality}</p><h1>${esc(title)}</h1>${line?`<p class="ds-line">${line}</p>`:''}</div>
   <div class="ds-foot">${stats.length?`<div class="ds-stats">${stats.map(stat).join('')}</div>`:''}${pct!==null?`<span class="ds-bar" role="img" aria-label="${pct}% owned"><i style="width:${pct}%"></i></span>`:''}</div>
  </div></section>
 <div class="ds-head">${String(lead).trim()?`<div class="ds-lead">${lead}</div>`:''}${actions.some(a=>a&&(a.html||a.label))?`<div class="ds-actions">${actions.filter(a=>a&&(a.html||a.label)).map(act).join('')}</div>`:''}${status}${versions?`<div class="ds-versions">${versions}</div>`:''}</div>`;
}
