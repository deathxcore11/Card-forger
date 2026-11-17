// 0.4.96 Hand home (play-home-hand-brief.md): what the markup cannot do on its own.
// - Phones: the hand is a snapping row; after each draw the chosen card is centred, and a swipe that settles on
//   another card chooses it (the same as tapping it).
// - The quest card turns on its own through its slides (daily, then weekly) every 5 s, unless motion is reduced;
//   a tab jumps to the first slide of its kind.
let turn = 0;

export function afterHandRender(choose) {
  const row = document.querySelector('.pl-hand');
  if (row && !row.dataset.ready) {
    row.dataset.ready = '1';
    centre(row);
    let t = 0;
    row.addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(() => settle(row, choose), 140); }, {passive: true});
  }
  const card = document.querySelector('.pl-quest-card');
  clearInterval(turn); turn = 0;
  if (card && card.querySelectorAll('.pl-quest-slide').length > 1 && !matchMedia('(prefers-reduced-motion: reduce)').matches)
    turn = setInterval(() => { const c = document.querySelector('.pl-quest-card'); if (!c) { clearInterval(turn); turn = 0; return; } step(c, 1); }, 5000);
}

function snapping(row) { return getComputedStyle(row).overflowX === 'auto' || getComputedStyle(row).overflowX === 'scroll'; }
function centre(row) {
  if (!snapping(row)) return;
  const on = row.querySelector('.pl-hand-card.is-on'); if (!on) return;
  row.scrollLeft = on.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
}
function settle(row, choose) {
  if (!snapping(row) || !row.isConnected) return;
  const mid = row.scrollLeft + row.clientWidth / 2;
  let best = null, d = Infinity;
  for (const c of row.querySelectorAll('.pl-hand-card')) { const x = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid); if (x < d) { d = x; best = c; } }
  if (best && !best.classList.contains('is-on')) choose(best.dataset.stageMode);
}

export function show(card, i) {
  const slides = [...card.querySelectorAll('.pl-quest-slide')]; if (!slides.length) return;
  const k = ((i % slides.length) + slides.length) % slides.length;
  slides.forEach((s, j) => { s.hidden = j !== k; s.classList.toggle('is-on', j === k); });
  const kind = slides[k].dataset.questKind;
  card.querySelectorAll('.pl-quest-tab').forEach(t => t.setAttribute('aria-pressed', String(t.dataset.questKind === kind)));
}
function step(card, by) { const slides = [...card.querySelectorAll('.pl-quest-slide')]; show(card, slides.findIndex(s => s.classList.contains('is-on')) + by); }
export function jump(kind) {
  const card = document.querySelector('.pl-quest-card'); if (!card) return;
  const i = [...card.querySelectorAll('.pl-quest-slide')].findIndex(s => s.dataset.questKind === kind);
  if (i >= 0) show(card, i);
}
