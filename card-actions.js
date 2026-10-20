import {actionIcon} from './icons.js';
import {esc} from './ui.js';

// Shared visual language for touch sheets and desktop context dialogs. These
// are ordinary buttons in a modal, not ARIA menus (they also contain forms).
export function contextAction(act,icon,label,{hint='',attrs='',danger=false,disabled=false}={}) {
 return `<button type="button" class="context-action${danger?' danger':''}" data-act="${esc(act)}" ${attrs}${disabled?' disabled':''}>${actionIcon(icon)}<span>${esc(label)}${hint?`<small>${esc(hint)}</small>`:''}</span></button>`;
}
export function contextHeader({kind,name,meta='',art=''}) {
 return `<div class="sheet-head context-head">${art?`<div class="context-art">${art}</div>`:''}<div class="context-identity"><span class="context-kicker">${esc(kind)}</span><h2>${esc(name)}</h2>${meta?`<p>${esc(meta)}</p>`:''}</div><button type="button" class="icon context-close" data-act="closeSheet" aria-label="Close">${actionIcon('close')}</button></div>`;
}
export function deckContextShortcuts(id,tcg=false) {
 const tabs=[['cards','cardStack','Cards'],[tcg?'insights':'engine','trophy','Power'],['matchups','sword','Matchups'],['playtest','random','Playtest']];
 return `<div class="context-shortcuts" aria-label="Open deck section">${tabs.map(([tab,icon,label])=>contextAction('tileOpen',icon,label,{attrs:`data-deck="${esc(id)}" data-tcg="${tcg?'1':''}" data-tab="${tab}"`})).join('')}</div>`;
}
// A hold is deliberate; a scroll is never a card selection.
export const HOLD_MS = 480, MOVE_PX = 10;
export function moved(start, event) {
  return Math.hypot(event.clientX - start.x, event.clientY - start.y) > MOVE_PX;
}
export class CompareSelection {
  constructor() { this.cancel(); }
  cancel() { this.game = null; this.cards = []; this.active = false; }
  start(game, first = null) { this.game = game; this.cards = first ? [first] : []; this.active = true; }
  pick(game, card) {
    if (!this.active || game !== this.game || !card) return 'ignored';
    if (this.cards.some(c => (c.id || c.name) === (card.id || card.name))) return 'duplicate';
    this.cards.push(card);
    if (this.cards.length === 2) { this.active = false; return 'ready'; }
    return 'waiting';
  }
}
export function attachCardGestures({ onHold, onPick, choosing, onSelect=()=>false, root = document }) {
  let press = null, timer = null, cue = null, cued = null;
  // A short press shows the card sinking and a ring filling, so a hold feels intentional.
  const clear = () => { clearTimeout(timer); clearTimeout(cue); timer = cue = null; cued?.classList.remove('holding'); cued = null; };
  root.addEventListener('pointerdown', e => {
    clear();
    if (e.button !== 0 || e.isPrimary === false) { press = null; return; }
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"], [data-hold-card]');
    // Only card gestures own scroll/cancel suppression. Keep selectable lot
    // backgrounds protected too, without intercepting unrelated controls.
    const lot = e.target.closest?.('.lot'), button = e.target.closest?.('button');
    const selectableLot = lot?.querySelector?.('.batch-mark input') && !e.target.closest?.('label,input,select,.stepper,.lot-side') && (!button || ['card', 'tCard'].includes(button.dataset.act));
    if (!card && !selectableLot) { press = null; return; }
    press = { x: e.clientX, y: e.clientY, id: e.pointerId, card, moved: false, held: false };
    if (!card) return;
    const original = press, art = card.matches?.('.lot-art, .grid-card, .deck-tile, .tile') ? card : null;
    if (art) cue = setTimeout(() => { if (press === original && !press.moved) (cued = art).classList.add('holding'); }, 140);
    timer = setTimeout(() => {
      if (press !== original || press.moved || !card.isConnected) return;
      press.held = true;
      cued?.classList.remove('holding'); cued = null;
      onHold(card);
    }, HOLD_MS);
  }, { passive: true });
  root.addEventListener('pointermove', e => {
    if (press?.id !== e.pointerId || !moved(press, e)) return;
    press.moved = true; clear();
  }, { passive: true });
  root.addEventListener('pointerup', clear, { passive: true });
  root.addEventListener('pointercancel', () => { if (press) press.moved = true; clear(); }, { passive: true });
  root.addEventListener('scroll', () => { if (press) press.moved = true; clear(); }, { passive: true, capture: true });
  root.addEventListener('click', e => {
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"], [data-hold-card]');
    if (e.detail !== 0 && (press?.moved || press?.held)) {
      e.preventDefault(); e.stopImmediatePropagation(); press = null; return;
    }
    if (onSelect(e.target,e)) {e.preventDefault();e.stopImmediatePropagation();press=null;return;}
    if (card && choosing()) {
      e.preventDefault(); e.stopImmediatePropagation(); onPick(card);
    }
    press = null;
  }, true);
  root.addEventListener('contextmenu', e => {
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"], [data-hold-card]');
    if (!card) return;
    e.preventDefault(); clear(); if (!press?.held) onHold(card);
  });
  root.addEventListener('keydown', e => {
    if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return;
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"], [data-hold-card]');
    if (card) { e.preventDefault(); onHold(card); }
  });
}

export function cardActionButtons({game, wished=false, existing=false, second=false, quantityHtml=""}={}) {
  const actions = [
    ['quickCompare','compare','Compare',second ? 'Use as the second card' : 'Choose another card while browsing'],
    ['quickOwn','cardStack','Add to collection'],
    ['quickDeck','decks','Add to deck'],
    ['quickWish','heart',wished && game !== 'mtg' ? 'Remove from wishlist' : 'Add to wishlist'],
    ['quickBinder','binder',existing ? 'Move to binder' : 'Add to binder'],
  ];
  return `${quantityHtml}<div class="context-group card-action-list" aria-label="Card actions">${actions.map(([act,icon,label,hint])=>contextAction(act,icon,label,{hint})).join('')}</div>`;
}
