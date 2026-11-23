// Gamepad for menus and every game mode: edge-triggered buttons with a repeat on the directions, and a gold focus ring that moves over
// the visible, enabled buttons of whatever screen is on top. The pure part (PadEdges, padLook) has no DOM, so it is unit-tested.
// Standard mapping: A 0, B 1, X 2, Y 3, LB 4, RB 5, Select 8, Start 9, d-pad 12 to 15, left stick axes 0 and 1.
export const REPEAT_FIRST = 0.35, REPEAT = 0.18;            // seconds: the first repeat waits a little longer so one tap never steps twice
const NAMES = { 0: 'a', 1: 'b', 2: 'x', 3: 'y', 4: 'lb', 5: 'rb', 8: 'select', 9: 'start', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const DIRS = { up: 1, down: 1, left: 1, right: 1 };

export class PadEdges {
  constructor() { this.down = {}; this.next = {}; }
  // pad: { buttons: [{pressed}], axes: [] } or null; t in seconds. Returns the names pressed this frame (edges, plus repeats on the directions).
  poll(pad, t) {
    const out = [], cur = {};
    if (pad) {
      for (const k in NAMES) { const b = pad.buttons && pad.buttons[k]; if (b && b.pressed) cur[NAMES[k]] = true; }
      const ax = (pad.axes && pad.axes[0]) || 0, ay = (pad.axes && pad.axes[1]) || 0;
      if (Math.abs(ax) > 0.55 && Math.abs(ax) >= Math.abs(ay)) cur[ax < 0 ? 'left' : 'right'] = true;
      else if (Math.abs(ay) > 0.55) cur[ay < 0 ? 'up' : 'down'] = true;
    }
    for (const n in cur) {
      if (!this.down[n]) { out.push(n); this.next[n] = t + REPEAT_FIRST; }
      else if (DIRS[n] && t >= this.next[n]) { out.push(n); this.next[n] = t + REPEAT; }
    }
    this.down = cur; return out;
  }
  any(pad) { if (!pad) return false; for (const k in NAMES) if (pad.buttons && pad.buttons[k] && pad.buttons[k].pressed) return true; return Math.abs(pad.axes[0] || 0) > 0.3 || Math.abs(pad.axes[1] || 0) > 0.3 || Math.abs(pad.axes[2] || 0) > 0.3 || Math.abs(pad.axes[3] || 0) > 0.3; }
}

// Look speed in input units for one frame: the same turn per second at 30, 60, 90 or 120 fps (840 units a second at full stick).
export const LOOK_PER_SEC = 840;
export function padLook(rx, ry, dt) { const k = LOOK_PER_SEC * Math.min(0.1, Math.max(0, dt)); return [rx * k, ry * k]; }

export function firstPad() {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  for (const p of pads) if (p && p.connected) return p; return null;
}

// ---- focus ring over the buttons of the top screen (browser only) ----
const SEL = 'button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), a[href], [data-padfocus]';
let cur = null;
const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false; const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
export function topRoot() {
  const map = document.getElementById('mapOverlay'); if (map && map.style.display === 'flex') return map;
  const offer = document.getElementById('offerScreen'), screens = [...document.querySelectorAll('.screen.on')];
  if (offer && offer.classList.contains('on')) return offer;
  return screens.length ? screens[screens.length - 1] : null;
}
export function candidates(root) { return [...root.querySelectorAll(SEL)].filter(visible); }
export function clearRing() { if (cur) cur.classList.remove('padfocus'); cur = null; document.body.classList.remove('padring'); }
export function setRing(el) { if (cur && cur !== el) cur.classList.remove('padfocus'); cur = el; if (el) { el.classList.add('padfocus'); document.body.classList.add('padring'); try { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* optional */ } } }
export function ringEl() { return cur; }
// move the ring one step in a direction; with no ring yet, land on the first button in reading order
export function move(dir) {
  const root = topRoot(); if (!root) return null; const list = candidates(root); if (!list.length) return null;
  if (!cur || !list.includes(cur)) { list.sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return Math.abs(A.top - B.top) > 8 ? A.top - B.top : A.left - B.left; }); setRing(list[0]); return cur; }
  const c = cur.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2; let best = null, bs = 1e18;
  for (const el of list) {
    if (el === cur) continue; const r = el.getBoundingClientRect(), dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy, across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along < 4 || across > along * 2.5 + c.height) continue;
    const s = along + across * 2; if (s < bs) { bs = s; best = el; }
  }
  if (!best) {                                                                    // nothing straight that way: step through reading order
    const sorted = list.slice().sort((a, b) => { const A = a.getBoundingClientRect(), B = b.getBoundingClientRect(); return Math.abs(A.top - B.top) > 8 ? A.top - B.top : A.left - B.left; });
    const i = sorted.indexOf(cur), n = dir === 'down' || dir === 'right' ? i + 1 : i - 1; if (n >= 0 && n < sorted.length) best = sorted[n];
  }
  if (best) setRing(best); return cur;
}
// A: press the ringed control; on a slider or a list left and right change the value instead (see adjust)
export function press() { if (typeof document !== 'undefined') document.body.dataset.input = 'pad'; if (cur && document.body.contains(cur) && visible(cur)) { const el = cur; if (el.tagName === 'INPUT' && el.type === 'range') return false; el.click(); return true; } return false; }
export function adjust(dir) {
  const el = cur; if (!el || !document.body.contains(el)) return false;
  if (el.tagName === 'INPUT' && el.type === 'range') { const st = +el.step || 1, v = +el.value + (dir === 'right' ? st : -st); el.value = Math.max(+el.min, Math.min(+el.max, v)); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  if (el.tagName === 'SELECT') { const i = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + (dir === 'right' ? 1 : -1))); if (i !== el.selectedIndex) { el.selectedIndex = i; el.dispatchEvent(new Event('change', { bubbles: true })); } return true; }
  return false;
}
// B: the screen's own back control, if it has one
export function back() {
  const root = topRoot(); if (!root) return false;
  const el = root.querySelector('[data-back]') || candidates(root).find(b => /^(back|close|resume|leave|cancel|done|continue)\b/i.test(b.textContent.trim()));
  if (el) { el.click(); return true; } return false;
}
