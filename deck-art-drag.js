// Deck art by drag and drop (Randall 16 Nov 2026, preview https://claude.ai/artifact/SrnADaNrwV3cddvFRAw49s):
// in any deck view (Collection decks in all 3 games, Play decks) a card dragged onto the deck's header
// (.deck-hero) makes its art the deck art. Mouse: drag after a few pixels. Touch: hold a moment (LIFT_MS),
// then drag, so a quick swipe still scrolls. While a card is held the header shows "Deck art".
// The Play builder's own drag (adding a card to the deck list) uses these helpers at its own drop.
const HOLD_MS = 480; // card-actions.js HOLD_MS: the card hold menu (kept in step by test-deck-art-drag.mjs)
export const LIFT_MS = 250;
const CARD = '[data-act="card"], [data-act="tCard"], [data-hold-card]';

// The header under a point. A header part hidden under the sticky top bar does not count:
// the topmost element there must be the header (or inside it).
export const heroAt = (x, y, root = document) => {
  const h = root.querySelector?.('.deck-hero');
  const r = h?.getBoundingClientRect?.();
  if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
  const top = root.elementFromPoint?.(x, y);
  return !top || h.contains?.(top) || top.closest?.('.deck-art-ghost,.pe-drag-ghost') ? h : null;
};
// Shows or hides the drop cue on the header: can = a card is held, over = it is over the header.
export function heroCue(root = document, can = false, over = false) {
  const h = root.querySelector?.('.deck-hero');
  if (!h) return;
  if (can && !h.querySelector('.deck-art-drop')) h.insertAdjacentHTML('beforeend', '<div class="deck-art-drop" aria-hidden="true"><span>Deck art</span></div>');
  h.classList.toggle('deck-art-can', can);
  h.classList.toggle('deck-art-over', can && over);
}
// The lifted card's picture: only a loaded image, so the ghost never floats empty.
export function ghostFor(el, root = document, cls = 'deck-art-ghost') {
  // A card's name button holds no picture: look up to its card (a few levels) for one.
  let box = el;
  for (let i = 0; i < 3 && box?.parentElement && !box.querySelector?.('img'); i++) box = box.parentElement;
  const imgs = el.tagName === 'IMG' ? [el] : [...(box?.querySelectorAll?.('img') || [])];
  // The card picture is the biggest loaded image in it (badges and set icons are small).
  const img = imgs.filter(i => i.complete && i.naturalWidth).sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)[0];
  const g = root.createElement('img');
  g.className = cls; g.alt = '';
  if (img) g.src = img.currentSrc || img.src;
  else { g.removeAttribute('src'); g.classList.add('deck-art-ghost--plain'); }
  return g;
}
// One feel for every deck-art drag: the card tilts with the motion.
export const placeGhost = (g, x, y, dx = 0) => { g.style.transform = `translate(${x - 45}px,${y - 63}px) rotate(${Math.max(-8, Math.min(8, dx / 30))}deg)`; };
// The ghost settles into the header on a drop, or fades on a miss, then goes.
export function releaseGhost(g, hero, win = globalThis) {
  if (!g) return;
  const r = hero?.getBoundingClientRect?.();
  if (r) { g.classList.add('deck-art-land'); g.style.transform = `translate(${r.left + r.width / 2 - 45}px,${r.top + r.height / 2 - 63}px) scale(.4)`; }
  else g.classList.add('deck-art-miss');
  win.setTimeout ? win.setTimeout(() => g.remove(), 200) : g.remove();
}

// While a card is held the page can't be swiped, so holding it near the top (or bottom) edge scrolls
// the page: a long deck can still reach its header. Speed follows time, not frames (60 or 120 Hz alike),
// up to MAX_PX_S. at(x, y) each move; onScroll(x, y) after each step.
const MAX_PX_S = 900;
export function edgeScroller(onScroll = () => {}, win = globalThis) {
  let x = 0, y = null, raf = 0, last = 0;
  const step = t => {
    raf = 0;
    if (y == null) return;
    const now = Number.isFinite(t) ? t : (last || 0) + 16, dt = Math.min(50, last ? now - last : 16); last = now;
    const h = win.innerHeight || 0, top = 120, bottom = h - 70;
    const depth = y < top ? -(top - y) / top : y > bottom ? (y - bottom) / 70 : 0;
    const v = Math.round(Math.max(-1, Math.min(1, depth)) * MAX_PX_S * dt / 1000);
    if (v) { win.scrollBy?.(0, v); onScroll(x, y); }
    raf = win.requestAnimationFrame?.(step) || 0;
  };
  return {
    at(nx, ny) { x = nx; y = ny; if (!raf) { last = 0; raf = win.requestAnimationFrame?.(step) || 0; } },
    stop() { y = null; if (raf) win.cancelAnimationFrame?.(raf); raf = 0; last = 0; },
  };
}

// Drag from a card in a Collection deck view. canDrop(): is there a deck to set art on here (the open
// deck view); onDrop(cardEl): set its art. The Play builder is left to its own drag (skip(el) true).
export function attachDeckArtDrag({canDrop, onDrop, skip = () => false, root = document, win = globalThis}) {
  let d = null;
  const edge = edgeScroller((x, y) => heroCue(root, true, !!heroAt(x, y, root)), win);
  const stop = (keepGhost = false) => {
    edge.stop(); if (!d) return; clearTimeout(d.timer); clearTimeout(d.menu);
    if (!keepGhost) d.ghost?.remove();
    d.el.classList.remove('deck-art-lift', 'deck-art-ready'); heroCue(root, false); d = null;
  };
  const lift = (x, y) => {
    if (d.ghost) return;
    d.ghost = ghostFor(d.el, root); root.body.append(d.ghost);
    d.el.classList.remove('deck-art-ready'); d.el.classList.add('deck-art-lift'); clearTimeout(d.menu);
    heroCue(root, true); move(x, y);
  };
  const move = (x, y) => { placeGhost(d.ghost, x, y, x - d.x); heroCue(root, true, !!heroAt(x, y, root)); edge.at(x, y); };
  root.addEventListener('pointerdown', e => {
    stop();
    if (e.button > 0 || e.isPrimary === false) return;
    const el = e.target.closest?.(CARD);
    if (!el || skip(el) || !root.querySelector('.deck-hero') || !canDrop()) return;
    d = {el, x: e.clientX, y: e.clientY, id: e.pointerId, ready: e.pointerType === 'mouse', ghost: null};
    if (!d.ready) {
      const mine = d;
      // The hold shows it took (the card swells); at HOLD_MS the card's hold menu owns the press instead.
      d.timer = setTimeout(() => { if (d === mine) { mine.ready = true; el.classList.add('deck-art-ready'); } }, LIFT_MS);
      d.menu = setTimeout(() => { if (d === mine && !mine.ghost) stop(); }, HOLD_MS);
    }
  }, {passive: true});
  root.addEventListener('pointermove', e => {
    if (!d || e.pointerId !== d.id) return;
    if (!d.ghost) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 8) return;
      if (!d.ready) { stop(); return; } // a swipe before the hold: it's a scroll
      lift(e.clientX, e.clientY);
    }
    move(e.clientX, e.clientY);
  }, {passive: true});
  // Once a card is lifted the page must not scroll under the finger.
  root.addEventListener('touchmove', e => { if (d?.ghost) e.preventDefault(); }, {passive: false});
  const end = e => {
    if (!d || e.pointerId !== d.id) return;
    const el = d.el, ghost = d.ghost, over = !!ghost && e.type === 'pointerup' && heroAt(e.clientX, e.clientY, root);
    stop(true);
    if (!ghost) return;
    releaseGhost(ghost, over || null, win);
    // The drag ends in a click on whatever was under it: swallow that one click.
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
    root.addEventListener('click', swallow, {capture: true, once: true});
    win.setTimeout?.(() => root.removeEventListener('click', swallow, {capture: true}), 0);
    if (over) onDrop(el);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  return stop;
}
