import {S} from './store.js';
import {esc} from './ui.js';
import {actionIcon} from './icons.js';

// The deck preference keeps its existing keys. Collection/search retain their
// own three views; every deck source shares these four presentations.
export const DECK_VIEWS=['compact','stacks','gallery','symbols'];
const LABELS={compact:'Detailed list',stacks:'Stacks',gallery:'Art grid',symbols:'Names only'};
const ICONS={compact:'viewCompact',stacks:'viewStacks',gallery:'viewGallery',symbols:'viewSymbols'};
export function deckViewFor(game){
 const mode=S.state.settings.displayModes?.[game]?.deck;
 return DECK_VIEWS.includes(mode)?mode:'compact';
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
export const deckCardAttrs=(name,qty,zone='main')=>`data-deck-card data-deck-name="${esc(name)}" data-deck-qty="${esc(qty)}" data-deck-zone="${esc(zone)}"`;

// A layout change must not replace card nodes, selected checkboxes, disclosures
// or the sheet. Snapshots restored by Back use today's saved preference too.
export function syncDeckViewers(root=globalThis.document){
 for(const viewer of root?.querySelectorAll?.('.deck-viewer')||[]){
  viewer.dataset.deckView=deckViewFor(viewer.dataset.game);
  viewer.classList.toggle('view-gallery',['gallery','stacks'].includes(viewer.dataset.deckView));
  for(const list of viewer.querySelectorAll('[data-deck-list]'))list.style.setProperty('--deck-stack-rows',String(Math.max(1,Math.min(6,list.children.length))));
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
