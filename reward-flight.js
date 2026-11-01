// Claiming a Play reward (Randall, 1 Nov): a jingle and a haptic at the button, then every coin, seal and pack flies up
// into its place in the purse (the same way opened cards fly into the Trunk), each landing with a small tick and sound
// while that number counts up. XP rises from the button and lands on the level ring when it is on screen.
import {haptic} from './feel.js';
import {appSound} from './audio.js';
import {mountFeedback, removeFeedback} from './feedback-layer.js';
import {coinIcon, sealIcon, packIcon, econDefs} from './play-econ-ui.js';

const reduced = () => !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const fmt = v => Number(v || 0).toLocaleString('en-US');
const onScreen = el => { if (!el || el.offsetParent === null) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
const visible = sel => [...document.querySelectorAll(sel)].find(onScreen) || null;
const center = r => ({x: r.left + r.width / 2, y: r.top + r.height / 2});
// Where each kind lands: the purse in the top bar on wide screens, the one in the page head on phones.
const TARGET = {coins: () => visible('.pe-purse-coins'), packs: () => visible('.pe-purse-packs'), xp: () => visible('.pe-level'),
  seal: k => [...document.querySelectorAll(`.pe-seal-count svg[data-seal="${k}"]`)].map(s => s.closest('.pe-seal-count')).find(onScreen) || visible('.pe-purse-seals')};
const SOUND = {coins: 'RWD-002', seal: 'RWD-003', packs: 'RWD-004', xp: 'RWD-005'};

// The icons share the purse's gold gradient; make sure it exists even when no purse is drawn yet.
const defs = () => { if (!document.getElementById('peGold')) { const d = document.createElement('div'); d.hidden = true; d.innerHTML = econDefs; document.body.append(d); } };
const pop = el => { if (!el) return; el.classList.remove('rw-pop'); void el.offsetWidth; el.classList.add('rw-pop'); };

// One burst at the button: a gold ring and a few sparks.
function burst(rect, big) {
  const c = center(rect), ring = document.createElement('i');
  ring.className = 'rw-ring'; ring.setAttribute('aria-hidden', 'true');
  Object.assign(ring.style, {left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px'});
  mountFeedback(ring);
  ring.animate([{scale: .9, opacity: .95}, {scale: big ? 1.9 : 1.5, opacity: 0}], {duration: big ? 900 : 650, easing: 'cubic-bezier(.2,.7,.3,1)'}).finished.catch(() => {}).then(() => removeFeedback(ring));
  for (let k = 0, n = big ? 18 : 10; k < n; k++) {
    const e = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 30 + Math.random() * (big ? 90 : 55), s = 3 + Math.random() * 3;
    e.className = 'rw-spark'; e.setAttribute('aria-hidden', 'true');
    Object.assign(e.style, {left: c.x + 'px', top: c.y + 'px', width: s + 'px', height: s + 'px'});
    mountFeedback(e);
    e.animate([{transform: 'translate(-50%,-50%) scale(.4)', opacity: 0}, {opacity: 1, offset: .15}, {transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 0}],
      {duration: 600 + Math.random() * 400, easing: 'cubic-bezier(.15,.75,.3,1)'}).finished.catch(() => {}).then(() => removeFeedback(e));
  }
}

// A number in the purse counts up from what it was to what it is as its pieces land.
function counter(el, from, to) {
  const b = el?.querySelector('b'); if (!b || from === to) return () => {};
  b.textContent = fmt(from);
  return (done, total) => { if (b.isConnected) b.textContent = fmt(done >= total ? to : Math.round(from + (to - from) * done / total)); };
}

// One piece flies from the button up to its target: it bursts out first, then arcs in and shrinks into place.
function fly(html, from, to, delay, onLand) {
  const el = document.createElement('span'), size = 26;
  el.className = 'rw-fly'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = html;
  Object.assign(el.style, {left: from.x - size / 2 + 'px', top: from.y - size / 2 + 'px', width: size + 'px', height: size + 'px'});
  mountFeedback(el);
  const a = Math.random() * Math.PI * 2, out = 26 + Math.random() * 34, bx = Math.cos(a) * out, by = Math.sin(a) * out - 18;
  const dx = to ? to.x - from.x : (Math.random() - .5) * 120, dy = to ? to.y - from.y : -from.y - 40;
  const mx = bx + (dx - bx) * .45 + (Math.random() - .5) * 60, my = Math.max(by + (dy - by) * .55 - 30 - Math.random() * 30, dy + 24); // arcs in from below, never past the bar
  el.animate([{transform: 'translate(0,0) scale(.3)', opacity: 0}, {transform: `translate(${bx}px,${by}px) scale(1.1)`, opacity: 1, offset: .22},
    {transform: `translate(${mx}px,${my}px) scale(1)`, opacity: 1, offset: .62}, {transform: `translate(${dx}px,${dy}px) scale(${to ? .55 : .4})`, opacity: to ? 1 : 0}],
    {duration: 760 + Math.random() * 120, delay, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'backwards'})
    .finished.catch(() => {}).then(() => { removeFeedback(el); onLand?.(); });
}

// from: the claim button's rect (taken before the claim, since the list re-renders); delta: the server's reward;
// before: the purse before the claim (purse() from play-econ-client.js); big: an achievement or the weekly bonus.
export function rewardFlight({from, delta = {}, before = null, big = false}) {
  haptic(big ? 'reward-big' : 'reward-claim');
  appSound(big ? 'RWD-006' : 'RWD-001', {gap: 0, volume: .6});
  if (!from?.width) return;
  if (!reduced()) burst(from, big);
  const start = center(from), b = before || {coins: 0, seals: {}, packs: 0, xp: 0};
  // Wait a frame for the purse to show its new numbers, then wind them back and let the flights count them up.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    defs();
    const groups = [];
    if (delta.coins > 0) groups.push({kind: 'coins', el: TARGET.coins(), n: Math.max(3, Math.min(10, Math.round(delta.coins / 50))), html: coinIcon(), from: b.coins | 0, to: (b.coins | 0) + delta.coins});
    for (const [k, v] of Object.entries(delta.seals || {})) if (v > 0) groups.push({kind: 'seal', el: TARGET.seal(k), n: Math.min(4, v), html: sealIcon(k), from: b.seals?.[k] | 0, to: (b.seals?.[k] | 0) + v});
    const packs = delta.packs?.length || 0;
    if (packs) groups.push({kind: 'packs', el: TARGET.packs(), n: Math.min(5, packs), html: packIcon, from: b.packs | 0, to: (b.packs | 0) + packs});
    if (delta.xp > 0) xpRise(start, delta.xp, TARGET.xp());
    let delay = 180;
    for (const g of groups) {
      const tick = counter(g.el, g.from, g.to), to = g.el ? center(g.el.getBoundingClientRect()) : null;
      if (reduced()) { tick(1, 1); pop(g.el); appSound(SOUND[g.kind], {gap: 0, volume: .55}); continue; }
      let landed = 0;
      for (let i = 0; i < g.n; i++) {
        fly(g.html, start, to, delay + i * 70, () => { landed++; tick(landed, g.n); pop(g.el); haptic('reward-land'); appSound(SOUND[g.kind], {gap: 30, volume: .5, rate: 1 + landed * .03}); });
      }
      delay += g.n * 70 + 120;
    }
  }));
}

// XP: "+100 XP" rises off the button; a spark carries on to the level ring when it is on screen.
function xpRise(start, xp, ring) {
  const tag = document.createElement('span');
  tag.className = 'rw-xp'; tag.setAttribute('aria-hidden', 'true'); tag.textContent = '+' + fmt(xp) + ' XP';
  Object.assign(tag.style, {left: start.x + 'px', top: start.y + 'px'});
  mountFeedback(tag);
  appSound('RWD-005', {gap: 0, volume: .45, delay: 150});
  if (reduced()) { setTimeout(() => removeFeedback(tag), 900); return pop(ring); }
  tag.animate([{transform: 'translate(-50%,-30%) scale(.7)', opacity: 0}, {transform: 'translate(-50%,-140%) scale(1.05)', opacity: 1, offset: .25}, {transform: 'translate(-50%,-260%) scale(1)', opacity: 0}],
    {duration: 1300, easing: 'cubic-bezier(.2,.7,.3,1)'}).finished.catch(() => {}).then(() => removeFeedback(tag));
  if (ring) fly('<i class="rw-star"></i>', start, center(ring.getBoundingClientRect()), 260, () => pop(ring));
}
