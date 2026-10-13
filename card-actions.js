import {actionIcon} from './icons.js';
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
export function attachCardGestures({ onHold, onPick, choosing, root = document }) {
  let press = null, timer = null;
  const clear = () => { clearTimeout(timer); timer = null; };
  root.addEventListener('pointerdown', e => {
    clear();
    if (e.button !== 0 || e.isPrimary === false) { press = null; return; }
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"]');
    press = { x: e.clientX, y: e.clientY, id: e.pointerId, card, moved: false, held: false };
    if (!card) return;
    const original = press;
    timer = setTimeout(() => {
      if (press !== original || press.moved || !card.isConnected) return;
      press.held = true;
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
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"]');
    if (e.detail !== 0 && (press?.moved || press?.held)) {
      e.preventDefault(); e.stopImmediatePropagation(); press = null; return;
    }
    if (card && choosing()) {
      e.preventDefault(); e.stopImmediatePropagation(); onPick(card);
    }
    press = null;
  }, true);
  root.addEventListener('contextmenu', e => {
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"]');
    if (!card) return;
    e.preventDefault(); clear(); if (!press?.held) onHold(card);
  });
  root.addEventListener('keydown', e => {
    if (e.key !== 'ContextMenu' && !(e.shiftKey && e.key === 'F10')) return;
    const card = e.target.closest?.('[data-act="card"], [data-act="tCard"]');
    if (card) { e.preventDefault(); onHold(card); }
  });
}

export function cardActionButtons({game, wished=false, existing=false, second=false}={}) {
  const actions = [
    ['quickCompare','compare','Compare',second ? 'Use as the second card' : 'Choose another card while browsing'],
    ['quickOwn','cardStack','Add to collection'],
    ['quickDeck','decks','Add to deck'],
    ['quickWish','heart',wished && game !== 'mtg' ? 'Remove from wishlist' : 'Add to wishlist'],
    ['quickBinder','binder',existing ? 'Move to binder' : 'Add to binder'],
  ];
  return `<div class="card-action-list">${actions.map(([act,icon,label,hint])=>`<button data-act="${act}">${actionIcon(icon)}<span>${label}${hint?`<small>${hint}</small>`:''}</span></button>`).join('')}</div>`;
}
