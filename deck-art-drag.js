// Deck art by drag and drop (Randall 16 Nov 2026, preview https://claude.ai/artifact/SrnADaNrwV3cddvFRAw49s):
// in any deck view (Collection decks in all 3 games, Play decks) a card dragged onto the deck's header
// (.deck-hero) makes its art the deck art. Mouse: drag after a few pixels. Touch: hold a moment (LIFT_MS),
// then drag, so a quick swipe still scrolls. While a card is held the header shows "Drop for deck art".
// The Play builder's own drag (adding a card to the deck list) asks dropOnHero() at its own drop.
export const LIFT_MS = 250;
const CARD = '[data-act="card"], [data-act="tCard"], [data-hold-card]';

export const heroAt = (x, y, root = document) => {
  const h = root.querySelector?.('.deck-hero');
  const r = h?.getBoundingClientRect?.();
  return r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom ? h : null;
};
// Shows or hides the drop cue on the header: can = a card is held, over = it is over the header.
export function heroCue(root = document, can = false, over = false) {
  const h = root.querySelector?.('.deck-hero');
  if (!h) return;
  if (can && !h.querySelector('.deck-art-drop')) h.insertAdjacentHTML('beforeend', '<div class="deck-art-drop" aria-hidden="true"><span>Drop for deck art</span></div>');
  h.classList.toggle('deck-art-can', can);
  h.classList.toggle('deck-art-over', can && over);
}

// While a card is held the page can't be swiped, so holding it near the top (or bottom) edge scrolls
// the page: a long deck can still reach its header. at(x, y) each move; onScroll(x, y) after each step.
export function edgeScroller(onScroll = () => {}, win = globalThis) {
  let x = 0, y = null, raf = 0;
  const step = () => {
    raf = 0;
    if (y == null) return;
    const h = win.innerHeight || 0, top = 120, bottom = h - 70;
    const v = y < top ? -Math.ceil((top - y) / 5) : y > bottom ? Math.ceil((y - bottom) / 5) : 0;
    if (v) { win.scrollBy?.(0, v); onScroll(x, y); }
    raf = win.requestAnimationFrame?.(step) || 0;
  };
  return {
    at(nx, ny) { x = nx; y = ny; if (!raf) raf = win.requestAnimationFrame?.(step) || 0; },
    stop() { y = null; if (raf) win.cancelAnimationFrame?.(raf); raf = 0; },
  };
}

// Drag from a card in a Collection deck view. canDrop(): is there a deck to set art on here (the open
// deck view); onDrop(cardEl): set its art. The Play builder is left to its own drag (skip(el) true).
export function attachDeckArtDrag({canDrop, onDrop, skip = () => false, root = document, win = globalThis}) {
  let d = null;
  const edge = edgeScroller((x, y) => heroCue(root, true, !!heroAt(x, y, root)), win);
  const stop = () => { edge.stop(); if (!d) return; clearTimeout(d.timer); d.ghost?.remove(); d.el.classList.remove('deck-art-lift'); heroCue(root, false); d = null; };
  const lift = (x, y) => {
    if (d.ghost) return;
    const img = d.el.querySelector?.('img') || (d.el.tagName === 'IMG' ? d.el : null);
    const g = root.createElement('img');
    g.className = 'deck-art-ghost'; g.alt = ''; g.src = img?.currentSrc || img?.src || '';
    if (!g.src) { g.removeAttribute('src'); g.classList.add('deck-art-ghost--plain'); }
    root.body.append(g); d.ghost = g; d.el.classList.add('deck-art-lift'); heroCue(root, true); move(x, y);
  };
  const move = (x, y) => { d.ghost.style.transform = `translate(${x - 45}px,${y - 63}px) rotate(-4deg)`; heroCue(root, true, !!heroAt(x, y, root)); edge.at(x, y); };
  root.addEventListener('pointerdown', e => {
    stop();
    if (e.button > 0 || e.isPrimary === false) return;
    const el = e.target.closest?.(CARD);
    if (!el || skip(el) || !root.querySelector('.deck-hero') || !canDrop()) return;
    d = {el, x: e.clientX, y: e.clientY, id: e.pointerId, ready: e.pointerType === 'mouse', ghost: null};
    if (!d.ready) { const mine = d; d.timer = setTimeout(() => { if (d === mine) mine.ready = true; }, LIFT_MS); }
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
    const el = d.el, dragged = !!d.ghost, over = dragged && heroAt(e.clientX, e.clientY, root);
    stop();
    if (!dragged) return;
    // The drag ends in a click on whatever was under it: swallow that one click.
    const swallow = ev => { ev.stopPropagation(); ev.preventDefault(); };
    root.addEventListener('click', swallow, {capture: true, once: true});
    win.setTimeout?.(() => root.removeEventListener('click', swallow, {capture: true}), 0);
    if (over && e.type === 'pointerup') onDrop(el);
  };
  root.addEventListener('pointerup', end);
  root.addEventListener('pointercancel', end);
  return stop;
}
