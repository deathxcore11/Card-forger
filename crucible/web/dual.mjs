// Lost Memories, the two-screen layout: the pieces of the bottom frame, the cursor's walk over both frames and the pad.
// The game's screens are described in app.mjs; this file only places plaques and finds the way from one control to the
// next. DUAL.md says what a host must do to put each frame on a display of its own.
import { box, pq, pqW, esc, labelW } from './ps.mjs';

// A key chip: the pad key that presses the plaque beside it. One with no key keeps its room, so the plaques of a column
// line up and the A chip can stand there while the cursor makes that plaque the one A presses.
export const kc = (x, y, key, w = key && key.length > 2 ? 32 : 22, off = false) => { const pad = (w - labelW(key || 'A') + 1) >> 1; return `<i class="kc${key ? '' : ' kce'}${off ? ' kco' : ''}" data-key="${esc(key || '')}" style="left:${x}px;top:${y}px;width:${w}px;padding-left:${pad}px">${esc(key || '')}</i>`; };

// The foot of the bottom frame: a slab of stone from row y0 down, its plaques in rows of three columns (28 rows apart,
// each with a chip's room at its left) or four (21 apart, a chip only where a key is given or room for A is asked, ka).
// A cell: null for a gap, or { k: pad key, ka, t: words (or several, longest first), a: the verb, off, lit, cls, title }.
// A plaque whose words and hammer need more than its columns give takes the next column too when that one is free.
export function foot(y0, rows, cols = 3) {
  const colw = cols === 3 ? 131 : 99, gx = cols === 3 ? 6 : 3, pitch = cols === 3 ? 28 : 21, h = 360 - y0;
  const pad = (h - (rows.length * 16 + (rows.length - 1) * (pitch - 16))) >> 1;
  let s = box(0, y0, 413, h, 'st');
  rows.forEach((r, j) => { let i = 0; r = r.slice();
    for (let n = 0; n < r.length && i < cols; n++) { const c = r[n]; if (!c) { i++; continue; }
      const cw = cols === 3 || c.k || c.ka ? (c.k && c.k.length > 2 ? 32 : 22) : 0, need = pqW([].concat(c.t).slice(-1)[0]) + (cw ? cw + 4 : 0);
      let span = 1; while (span * colw + (span - 1) * gx < need && i + span < cols && (n + 1 >= r.length || r[n + 1] == null)) { span++; if (n + 1 < r.length) r.splice(n + 1, 1); }
      const x = 4 + i * (colw + gx), w = span * colw + (span - 1) * gx, y = y0 + pad + j * pitch;
      s += (cw ? kc(x, y + 3, c.k, cw, c.off) : '') + pq(x + (cw ? cw + 4 : 0), y, w - (cw ? cw + 4 : 0), c.t, c.a, { lit: c.lit && !c.off, off: c.off, cls: c.cls, title: c.title }).replace('<button ', `<button ${c.for ? `data-for="${c.for}" ` : ''}${c.look ? `data-look="${c.look}" ` : ''}`);
      i += span; } });
  return s;
}
// A list of cells cut into rows of so many columns, a cell whose words need two columns followed by a gap for the second.
// Two cells that belong together stand side by side on one row: the one before and the next one (L1 and R1), and a cell
// marked pair with the cell after it. The menu (START) always stands in the last column of the last row, so it is found
// in the same corner of every foot; when that needs a row more, the one before and the next one come down beside it.
export function rowsOf(cells, cols) {
  const colw = cols === 3 ? 131 : 99, gx = cols === 3 ? 6 : 3, out = [[]]; let i = 0;
  const spanOf = c => { const cw = cols === 3 || (c && (c.k || c.ka)) ? (c && c.k && c.k.length > 2 ? 32 : 22) : 0, need = c ? pqW([].concat(c.t).slice(-1)[0]) + (cw ? cw + 4 : 0) : 0; return Math.min(cols, Math.max(1, Math.ceil((need + gx) / (colw + gx)))); };
  const menu = cells.find(c => c && c.k === 'START'); cells = cells.filter(c => c !== menu);
  for (let n = 0; n < cells.length; n++) { const c = cells[n], span = spanOf(c), nx = cells[n + 1], pair = c && nx && ((c.k === 'L1' && nx.k === 'R1') || c.pair) ? spanOf(nx) : 0;
    if (i + span > cols || (pair && i + span + pair > cols && span + pair <= cols)) {
      // a pair that goes down to the next row leaves a place: a later plaque that stands alone comes up into it
      for (let m = n + (pair ? 2 : 1); i < cols && m < cells.length; m++) { const x = cells[m], alone = x && !x.pair && x.k !== 'L1' && x.k !== 'R1' && !(cells[m - 1] && cells[m - 1].pair);
        if (alone && i + spanOf(x) <= cols) { out[out.length - 1].push(x, ...Array(spanOf(x) - 1).fill(null)); i += spanOf(x); cells = cells.filter(y => y !== x); m--; } }
      out.push([]); i = 0; }
    out[out.length - 1].push(c, ...Array(span - 1).fill(null)); i += span; }
  const rows = out.filter(r => r.length);
  if (menu) { let last = rows[rows.length - 1];
    if (!last || last.length + 1 > cols) { const at = last ? last.findIndex(c => c && c.k === 'L1') : -1; last = at > 0 ? last.splice(at) : []; rows.push(last); }
    while (last.length + 1 < cols) last.push(null);
    last.push(menu); }
  return rows;
}

// Every plaque written in a piece of a screen, as cells for the foot: the single-screen layout writes its plaques where
// they stand on the pillars and the ledge, and the two-screen layout reads the same plaques back and lays them in the
// foot of the bottom frame, so a screen names each of its plaques once.
export function plaques(html) {
  const out = [], re = /<button class="pq([^"]*)"[^>]*?(?:data-a="([^"]*)")?( disabled)?(?: title="([^"]*)")?>([^<]*)<\/button>/g; let m;
  const un = s => String(s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  while ((m = re.exec(html))) out.push({ t: un(m[5]), a: un(m[2]), off: !!m[3], lit: /\blit\b/.test(m[1]), cls: /\bon\b/.test(m[1]) ? 'on' : '', title: un(m[4]) });
  return out;
}

// ---- the cursor's walk
// Where a control stands, in frame pixels of the whole page (the top frame at 0, 0; the bottom one under it).
export function rectOf(app, e) {
  const A = app.getBoundingClientRect(), k = A.width / (app.offsetWidth || 1), q = e.getBoundingClientRect();
  return { x: (q.left - A.left) / k, y: (q.top - A.top) / k, w: q.width / k, h: q.height / k, e };
}
// The controls the cursor can stand on: every button and slider that can be pressed now.
export const navItems = app => [...app.querySelectorAll('.scr:not(.held) button[data-a], .scr:not(.held) input')].filter(e => !e.disabled && (e.getAttribute('aria-disabled') !== 'true' || e.hasAttribute('data-f')) && !e.hasAttribute('data-nonav') && e.offsetWidth > 0 && getComputedStyle(e).visibility !== 'hidden');
// Each control's name for the cursor: its own (data-k), or its verb, counted when several share one.
export function navKeys(items) {
  const seen = new Map();
  return items.map(e => { const base = e.dataset.k || e.dataset.a || 'in:' + (e.dataset.key || e.type), n = seen.get(base) || 0; seen.set(base, n + 1); return n ? base + '#' + n : base; });
}
// The control next to one in a direction. Left and right stay in the row and on the frame: among the controls that share
// rows with this one, the nearest; else the nearest inside a quarter turn of the direction. Up and down take the
// nearest control whose columns overlap this one's, else the nearest by rows and then by columns, and cross the hinge.
// A frame held under a window (.held) is left out: its controls wait until the window is shut.
export function navStep(app, items, cur, dir) {
  const c = rectOf(app, cur), scr = cur.closest('.scr'), horiz = dir === 'left' || dir === 'right', sign = dir === 'left' || dir === 'up' ? -1 : 1;
  let best = null, bs = Infinity, inside = null, is = Infinity; // inside: the nearest row of the same grid, which comes before anything outside it
  const box = cur.closest('.gsc');
  const tbl = cur.closest('.tvw');
  for (const e of items) { if (e === cur) continue; const r = rectOf(app, e);
    const g = e.closest('.gsc'); if (g && g !== box) { const q = rectOf(app, g); if (r.y < q.y - 1 || r.y + r.h > q.y + q.h + 1) continue; } // a row of a grid that is moved out of sight is reached through the grid, not from beside it
    const d = horiz ? (r.x + r.w / 2 - c.x - c.w / 2) * sign : (r.y + r.h / 2 - c.y - c.h / 2) * sign; if (d < 1) continue;
    const gap = horiz ? Math.max(0, r.y - (c.y + c.h), c.y - (r.y + r.h)) : Math.max(0, r.x - (c.x + c.w), c.x - (r.x + r.w)); // how far apart their rows (or columns) lie; 0 when they share some
    if (horiz && (e.closest('.scr') !== scr || gap > d)) continue;
    if (horiz && tbl && e.closest('.tvw') !== tbl) continue; // along a row of the table the cursor stays on the table
    if (!horiz && e.closest('.scr') === scr && r.y < c.y + c.h && r.y + r.h > c.y && gap > 0) continue; // a control that stands beside this one is not above or below it
    const off = horiz ? Math.abs(r.y + r.h / 2 - c.y - c.h / 2) : Math.abs(r.x + r.w / 2 - c.x - c.w / 2);
    const edge = horiz ? (sign > 0 ? r.x - c.x - c.w : c.x - r.x - r.w) : (sign > 0 ? r.y - c.y - c.h : c.y - r.y - r.h); // from this one's far edge to that one's near edge
    const s = Math.max(0, edge) + gap * (horiz ? 40 : 3) + off * .05 + d * .01; // sideways, a control in the same row always wins over one in the row under it
    if (g && g === box && !horiz) { if (s < is) { is = s; inside = e; } }
    if (s < bs) { bs = s; best = e; } }
  return inside || best;
}

// ---- the pad
// The standard pad of the Gamepad API: its buttons by the names the game uses. The left stick moves as the d-pad does;
// the right stick pages long text as L2 and R2 do. A direction held repeats, after 400 ms, every 120 ms.
const PAD = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 9: 'START', 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
const REPEAT = new Set(['up', 'down', 'left', 'right', 'L2', 'R2']);
export function padLoop(press) {
  const held = new Map();
  const tick = () => {
    let pads = []; try { pads = [...(navigator.getGamepads ? navigator.getGamepads() : [])].filter(Boolean); } catch { pads = []; }
    const now = performance.now(), down = new Set();
    for (const p of pads) {
      p.buttons.forEach((b, i) => { if (PAD[i] && (b.pressed || b.value > .5)) down.add(PAD[i]); });
      const ax = p.axes || [];
      if (ax[0] < -.6) down.add('left'); if (ax[0] > .6) down.add('right'); if (ax[1] < -.6) down.add('up'); if (ax[1] > .6) down.add('down');
      if (ax[3] < -.6) down.add('L2'); if (ax[3] > .6) down.add('R2');
    }
    for (const k of down) { const h = held.get(k);
      if (!h) { held.set(k, { next: now + 400 }); press(k); }
      else if (REPEAT.has(k) && now >= h.next) { h.next = now + 120; press(k); } }
    for (const k of [...held.keys()]) if (!down.has(k)) held.delete(k);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// The same keys on a keyboard, for a desk (DUAL.md lists them).
export const KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'A', ' ': 'A', z: 'A', Escape: 'B', Backspace: 'B', b: 'B', x: 'X', y: 'Y', c: 'Y', q: 'L1', e: 'R1', PageUp: 'L2', PageDown: 'R2', '[': 'L2', ']': 'R2', m: 'START' };
