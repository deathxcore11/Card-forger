// Lost Memories, the console look: the pieces every console screen is drawn from (see ps.css and the asset book).
// The frame is 512 x 240 whole pixels. It is enlarged by a whole number of device pixels so every pixel stays square,
// and on a phone held upright it is turned a quarter turn so it still fills the screen.
export const W = 512, H = 240;
export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function fitConsole(app) {
  const dpr = window.devicePixelRatio || 1, vw = innerWidth, vh = innerHeight;
  const up = vh > vw * 1.15; // held upright: turn the frame
  const aw = (up ? vh : vw) * dpr, ah = (up ? vw : vh) * dpr;
  const n = Math.max(1, Math.floor(Math.min(aw / W, ah / H))); // whole device pixels per frame pixel
  const k = n / dpr; // the same in CSS pixels
  app.style.width = W + 'px'; app.style.height = H + 'px';
  app.style.transform = `translate(-50%,-50%) ${up ? 'rotate(90deg) ' : ''}scale(${k})`;
  // the transform puts the frame's centre on the page centre; nudge it onto whole device pixels
  const ox = ((vw * dpr - (up ? H : W) * n) / 2) % 1, oy = ((vh * dpr - (up ? W : H) * n) / 2) % 1;
  app.style.marginLeft = (-ox / dpr) + 'px'; app.style.marginTop = (-oy / dpr) + 'px';
  return { k, n, up };
}

// A plaque (a button). a = the data-a verb; o.lit marks the one the hammer is on; o.off greys it.
export const pq = (x, y, w, label, a, o = {}) => `<button class="pq${o.lit ? ' lit' : ''}${o.cls ? ' ' + o.cls : ''}" style="left:${x}px;top:${y}px;width:${w}px" ${a ? `data-a="${esc(a)}"` : ''}${o.off ? ' disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${esc(label)}</button>`;
export const lb = (x, y, txt, cls = '') => `<b class="ab lb ${cls}" style="left:${x}px;top:${y}px">${esc(txt)}</b>`;
export const tx = (x, y, txt, cls = '') => `<b class="ab ${cls}" style="left:${x}px;top:${y}px">${esc(txt)}</b>`;
export const box = (x, y, w, h, cls, inner = '', attrs = '') => `<div class="ab ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" ${attrs}>${inner}</div>`;
export const gauge = (x, y, w, frac, cls = '') => `<i class="ga ${cls}" style="left:${x}px;top:${y}px;width:${w}px"><i style="width:${Math.max(0, Math.min(w - 2, Math.round((w - 2) * frac)))}px"></i></i>`;
// right-aligned label: the label face is 6 pixels a character in practice
export const lbr = (right, y, txt, cls = '') => lb(right - String(txt).length * 6, y, txt, cls);

// The frame: two stone pillars, the window with the view inside it, the ledge, the text bar.
export function frame({ left = '', right = '', view = '', ledge = '', bar = '', barMore = false, extra = '' }) {
  return `<div class="fr">${box(0, 0, 96, 240, 'st pl')}${box(416, 0, 96, 240, 'st pl')}${box(96, 0, 320, 136, 'st dk')}
    ${box(100, 4, 312, 128, 'vw', view)}${box(96, 136, 320, 64, 'lg ledge', ledge)}${box(96, 200, 320, 40, 'wn bar' + (barMore ? ' more' : ''), `<p>${bar}</p>`, barMore ? 'data-a="barmore"' : '')}
    <div class="ab" style="left:0;top:0;width:96px;height:240px">${left}</div><div class="ab" style="left:416px;top:0;width:96px;height:240px">${right}</div>${extra}</div>`;
}

// A window over the frame, for questions, lists and pages. The frame behind it is dotted dark.
export const win = (x, y, w, h, inner, cls = '') => `<div class="dim"></div><div class="wn mw ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${inner}</div>`;

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
