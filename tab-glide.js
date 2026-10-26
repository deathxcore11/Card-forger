// Tab bars share one rounded track with a glowing pill that glides to the selected tab.
// Views redraw their tab bars on every switch (sometimes twice while data loads), so each
// bar's last move is remembered and a redrawn bar's pill carries on from where the old one
// was in its slide, instead of jumping.
const BARS = '.seg, .set-browser-quick, nav.tabs';
const SELECTED = ':scope > :is([aria-selected="true"], [aria-pressed="true"], .on)';
const DURATION = 500; // matches the .glide transition in polish.css
const moves = new Map();
const seen = new WeakMap();

const keyOf = (bar) => bar.querySelector(':scope > [data-act]')?.dataset.act || '';
const now = () => performance.now();
// Close to the CSS curve cubic-bezier(.32,.72,0,1): a quick start that settles softly.
const ease = (t) => 1 - Math.pow(1 - t, 3.2);
const same = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

// Where the pill of the last move on this bar is right now.
function current(move) {
  const t = Math.min(1, (now() - move.at) / DURATION), k = ease(t), mix = (a, b) => a + (b - a) * k;
  return { x: mix(move.from.x, move.to.x), y: mix(move.from.y, move.to.y), w: mix(move.from.w, move.to.w), h: mix(move.from.h, move.to.h) };
}

function place(bar, force) {
  const on = bar.querySelector(SELECTED);
  let pill = bar.querySelector(':scope > .glide');
  if (!on) { pill?.remove(); delete bar.dataset.glide; return; }
  if (!force && seen.get(bar) === on && pill) return;
  const to = { x: on.offsetLeft, y: on.offsetTop, w: on.offsetWidth, h: on.offsetHeight };
  if (!to.w) return; // not laid out yet (hidden pane); try again on the next change
  const key = keyOf(bar), move = moves.get(key), fresh = !pill;
  if (fresh) {
    pill = bar.ownerDocument.createElement('span');
    pill.className = 'glide';
    pill.setAttribute('aria-hidden', 'true');
    bar.prepend(pill);
  }
  const set = (r) => { pill.style.transform = `translate(${r.x}px, ${r.y}px)`; pill.style.width = r.w + 'px'; pill.style.height = r.h + 'px'; };
  const elapsed = move ? now() - move.at : Infinity;
  if (move && same(move.to, to) && elapsed < DURATION) {
    // Same destination as the slide already under way: finish it, don't restart it.
    if (fresh) {
      pill.style.transition = 'none'; set(current(move)); void pill.offsetWidth;
      pill.style.transition = ''; pill.style.transitionDuration = `${Math.round(DURATION - elapsed)}ms`;
    }
    set(to);
  } else {
    const from = move ? current(move) : to;
    if (fresh) { pill.style.transition = 'none'; set(from); void pill.offsetWidth; pill.style.transition = ''; }
    pill.style.transitionDuration = '';
    set(to);
    if (!same(from, to)) moves.set(key, { from, to, at: now() });
    else moves.set(key, { from: to, to, at: 0 });
  }
  bar.dataset.glide = 'ready';
  seen.set(bar, on);
}

export function startTabGlide(root = document) {
  if (!root?.body || typeof MutationObserver === 'undefined') return;
  let frame = 0, force = false;
  const run = () => { frame = 0; for (const bar of root.querySelectorAll(BARS)) place(bar, force); force = false; };
  const schedule = (all) => { force ||= all; if (!frame) frame = requestAnimationFrame(run); };
  new MutationObserver(() => schedule(false)).observe(root.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'aria-selected', 'aria-pressed'] });
  addEventListener('resize', () => schedule(true));
  root.fonts?.ready?.then(() => schedule(true));
  schedule(true);
}
