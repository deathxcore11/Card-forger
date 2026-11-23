// Lost Memories, the console look: the pieces every console screen is drawn from (see ps.css and the asset book).
// The frame is a screen of whole pixels: 512 x 240 at the least, as much as 640 x 480, the console's own range of
// screen sizes. Each frame pixel is a whole number of device pixels, so every pixel stays square and sharp, and the
// frame takes the shape of the screen it is on, so no band of black is left. On a phone held upright the frame is
// turned a quarter turn (on a touch screen only). The pillars keep their size; the window, the view and the ledge take what is left.
export const F = { W: 512, H: 240, n: 1, up: false };
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const yb = y => y + F.H - 240; // a place measured from the bottom of the smallest frame
export const xr = x => x + F.W - 512; // the same from its right edge
export const cx0 = () => (F.W - 512) >> 1, cy0 = () => (F.H - 240) >> 1; // where the smallest frame would sit, centred

// A screen held upright is turned only on a touch screen (a phone or a tablet, which the player can turn sideways); a
// desktop window that is taller than it is wide keeps the frame upright, so nobody has to tilt their head at a monitor.
export const touchScreen = () => { try { return matchMedia('(pointer: coarse)').matches; } catch { return false; } };
export function fitConsole(app) {
  const dpr = window.devicePixelRatio || 1, vw = innerWidth, vh = innerHeight;
  const up = touchScreen() && vh > vw * 1.15; // a phone held upright: turn the frame
  const aw = Math.floor((up ? vh : vw) * dpr + .01), ah = Math.floor((up ? vw : vh) * dpr + .01);
  const n = Math.max(1, Math.min(Math.floor(aw / 512), Math.floor(ah / 240))); // whole device pixels per frame pixel
  const W = Math.max(512, Math.min(640, Math.floor(aw / n))), H = Math.max(240, Math.min(480, Math.floor(ah / n)));
  const changed = W !== F.W || H !== F.H; Object.assign(F, { W, H, n, up });
  const k = n / dpr; // the same in CSS pixels
  app.style.width = W + 'px'; app.style.height = H + 'px';
  // The frame is placed from the page's top left corner, which is device pixel 0 at any pixel ratio, by a whole number of
  // device pixels. (Centring it with left 50% put it a fraction of a device pixel off the grid at a ratio like 2.625: the
  // page's width in device pixels is rounded, so its middle is not where innerWidth says. Every frame pixel's left and
  // top edge then blended into its neighbour.)
  const dx = Math.max(0, Math.floor((vw * dpr - (up ? H : W) * n) / 2)), dy = Math.max(0, Math.floor((vh * dpr - (up ? W : H) * n) / 2));
  const tx = (dx + (up ? H * n : 0)) / dpr, ty = dy / dpr; // turned a quarter, the frame's top left corner is its right edge on the screen
  app.style.transform = `translate(${tx}px,${ty}px) ${up ? 'rotate(90deg) ' : ''}scale(${k})`;
  return { k, n, up, changed };
}

// The label face's own advances, in pixels (measured from the face at 8 pixels); a character not listed takes 6. A word
// set in it is as wide as its letters' advances.
const LBW = { ' ': 4, I: 3, '!': 3, "'": 3, '.': 3, ':': 3, '|': 3, '·': 3, ',': 4, ';': 4, '(': 4, ')': 4, '[': 4, ']': 4, '`': 4, E: 5, F: 5, L: 5, T: 5, Z: 5, 1: 5, '-': 5, '/': 5, '"': 5, '<': 5, '=': 5, '>': 5, '\\': 5, '^': 5, '{': 5, '}': 5, M: 7, N: 7, V: 7, W: 7, X: 7, Y: 7, '#': 7, '%': 7, '*': 7, '+': 7, '@': 7 };
export const labelW = s => { let w = 0; for (const c of String(s).toUpperCase()) w += LBW[c] ?? 6; return w; };
// A plaque (a button). a = the data-a verb; o.lit marks the one the hammer is on; o.off greys it.
// A plaque is never narrower than its words with the hammer beside them (pqW: its border, the hammer's 16 pixels at the
// words' left and 4 at their right, ps.css), so the hammer can stand on any plaque without cutting a word. Given several
// labels, longest first, a plaque takes the first that fits the width its row gives it; when none does, it takes the last
// and grows to fit it (the console checks report a plaque that then runs into another or out of its pillar). A row laid
// out from its plaques' words asks pqW how wide each must be.
export const pqW = s => labelW(s) + 22;
export const pq = (x, y, w, label, a, o = {}) => { const ls = [].concat(label), t = ls.find(s => pqW(s) <= w) ?? ls[ls.length - 1]; w = Math.max(w, pqW(t));
  return `<button class="pq${o.lit ? ' lit' : ''}${o.cls ? ' ' + o.cls : ''}" style="left:${x}px;top:${y}px;width:${w}px" ${a ? `data-a="${esc(a)}"` : ''}${o.off ? ' disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${esc(t)}</button>`; };
export const lb = (x, y, txt, cls = '') => `<b class="ab lb ${cls}" style="left:${x}px;top:${y}px">${esc(txt)}</b>`;
export const tx = (x, y, txt, cls = '') => `<b class="ab ${cls}" style="left:${x}px;top:${y}px">${esc(txt)}</b>`;
export const box = (x, y, w, h, cls, inner = '', attrs = '') => `<div class="ab ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${attrs}>${inner}</div>`;
export const gauge = (x, y, w, frac, cls = '') => `<i class="ga ${cls}" style="left:${x}px;top:${y}px;width:${w}px"><i style="width:${Math.max(0, Math.min(w - 2, Math.round((w - 2) * frac)))}px"></i></i>`;
// right-aligned label: the label face is 6 pixels a character in practice
export const lbr = (right, y, txt, cls = '') => lb(right - String(txt).length * 6, y, txt, cls);

// The frame: two stone pillars, the window with the view inside it, the ledge, the text bar.
export function frame({ left = '', right = '', view = '', ledge = '', bar = '', barMore = false, extra = '' }) {
  const { W, H } = F, ww = W - 192, ly = H - 104;
  return `<div class="fr">${box(0, 0, 96, H, 'st pl')}${box(W - 96, 0, 96, H, 'st pl')}${box(96, 0, ww, ly, 'st dk')}
    ${box(100, 4, ww - 8, ly - 8, 'vw', view)}${box(96, ly, ww, 64, 'lg ledge', ledge)}${box(96, H - 40, ww, 40, 'wn bar' + (barMore ? ' more' : ''), `<p>${bar}</p>`, barMore ? 'data-a="barmore"' : '')}
    <div class="ab" style="left:0;top:0;width:96px;height:${H}px">${left}</div><div class="ab" style="left:${W - 96}px;top:0;width:96px;height:${H}px">${right}</div>${extra}</div>`;
}
// The view window's size in this frame, and the ledge's width.
export const viewSize = () => ({ w: F.W - 200, h: F.H - 112 });
export const ledgeW = () => F.W - 192;

// A patch of fog or shadow: one colour (black unless asked), 1-bit, its density falling away toward the edges through
// the 4 x 4 dither table, the way the console thinned a sprite without any see-through colour. The table is read on the
// frame's own grid of pixels, as the console's screen-door patterns were: at, where the patch's corner falls on that grid
// (its place in the frame, counted in fours), so every patch, and the half-dot mesh of a dimmed screen laid over it,
// meet in the same step on every screen shape. drift: the patch's frames, side by side, its cloud moved that many whole
// pixels across in each while every lit pixel stays on the grid's pattern (the fog drifts through the screen door; the
// door does not move). gaps: read the table upside down, so the patch's dots fall first in the gaps another patch at the
// same place leaves (a second layer of the same fog fills the first instead of lying on it).
const fogs = new Map(), B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export function fogSprite(w, h, dens = .6, rgb = [0, 0, 0], at = [0, 0], drift = [0], gaps = false) {
  const px = at[0] & 3, py = at[1] & 3, key = `${w}x${h}x${dens}x${rgb}x${px}${py}x${drift}x${gaps}`; if (fogs.has(key)) return fogs.get(key);
  let url = '';
  try {
    const n = drift.length, c = document.createElement('canvas'); c.width = w * n; c.height = h; const x = c.getContext('2d'), id = x.createImageData(w * n, h), d = id.data;
    drift.forEach((s, f) => { for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
      const dx = (i - s + .5) / w * 2 - 1, dy = (y + .5) / h * 2 - 1, k = Math.max(0, 1 - Math.hypot(dx, dy)) ** .8 * dens;
      const t = B4[((y + py) & 3) * 4 + ((i + px) & 3)];
      if (k * 16 > (gaps ? 15 - t : t) + .5) { const o = (y * w * n + f * w + i) * 4; d[o] = rgb[0] & 0xf8; d[o + 1] = rgb[1] & 0xf8; d[o + 2] = rgb[2] & 0xf8; d[o + 3] = 255; }
    } });
    x.putImageData(id, 0, 0); url = c.toDataURL();
  } catch { /* no canvas: no fog */ }
  fogs.set(key, url); return url;
}

// A window over the frame, for questions, lists and pages. The frame behind it is dotted dark.
// Windows are laid out for the smallest frame and stand in the middle of a larger one.
export const win = (x, y, w, h, inner, cls = '') => `<div class="dim"></div><div class="wn mw ${cls}" style="left:${x + cx0()}px;top:${y + cy0()}px;width:${w}px;height:${h}px">${inner}</div>`;

// Carved capitals: a word drawn once into a small picture of whole pixels, in two golds and a shadow, from the
// game's capital face. Kept as a picture so no edge is ever smoothed on screen.
const carved = new Map();
let carveFontReady = false;
export function carve(text, size = 24, onReady) {
  const key = text + '|' + size;
  if (carved.has(key)) return carved.get(key);
  const font = `600 ${size}px "LM Cinzel", Georgia, serif`;
  if (!carveFontReady && document.fonts && document.fonts.load) {
    document.fonts.load(font, text).then(() => { if (!carveFontReady) { carveFontReady = true; carved.clear(); if (onReady) onReady(); } }).catch(() => {});
  }
  const m = document.createElement('canvas').getContext('2d'); m.font = font;
  const w = Math.ceil(m.measureText(text).width + text.length * size * .08) + 4, h = Math.ceil(size * 1.25) + 2;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.font = font; x.textBaseline = 'alphabetic';
  if ('letterSpacing' in x) x.letterSpacing = Math.round(size * .08) + 'px';
  x.fillStyle = '#fff'; x.fillText(text, 1, size);
  let id; try { id = x.getImageData(0, 0, w, h); } catch { return null; }
  const a = id.data, on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) on[i] = a[i * 4 + 3] >= 110 ? 1 : 0; // one bit: in or out
  const out = x.createImageData(w, h), o = out.data;
  const put = (i, r, g, b) => { o[i * 4] = r; o[i * 4 + 1] = g; o[i * 4 + 2] = b; o[i * 4 + 3] = 255; };
  for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
    const i = yy * w + xx;
    if (on[i]) {
      const top = yy > 0 && !on[i - w], left = xx > 0 && !on[i - 1], bot = yy < h - 1 && !on[i + w];
      if (top || left) put(i, 0xf8, 0xe0, 0x98); else if (bot) put(i, 0xa8, 0x70, 0x30); else put(i, ((yy / h) < .55 ? 0xe8 : 0xd8), ((yy / h) < .55 ? 0xc0 : 0xa0), ((yy / h) < .55 ? 0x68 : 0x50));
    } else if ((xx > 0 && yy > 0 && on[i - w - 1]) || (yy > 0 && on[i - w]) ) put(i, 0x18, 0x08, 0x10); // the cut shadow, down and right
  }
  x.putImageData(out, 0, 0);
  const url = c.toDataURL(), res = { url, w, h };
  carved.set(key, res);
  return res;
}
export const carveImg = (text, size, onReady, cls = '') => { const c = carve(text, size, onReady); return c ? `<img class="${cls}" src="${c.url}" width="${c.w}" height="${c.h}" alt="${esc(text)}">` : `<b class="lb g">${esc(text)}</b>`; };
