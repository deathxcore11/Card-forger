// The body face on whole pixels.
// The console look writes its body text in DotGothic16 ('LM Text', 16 pixels). That face draws its dots about 61.8 units
// apart (of 1000 to the em) and starts them a fraction of a dot in from the glyph's origin, so at 16 pixels no dot lands
// on a pixel: every stroke straddles two pixels and is drawn soft and grey, at any scale. Here each glyph is read back
// from the face itself, drawn eight times larger on a canvas and stretched so its dots are exactly eight canvas pixels
// apart; each 8 x 8 block then says whether the dot there is lit. The lit dots are struck again as a small font whose
// dots are whole pixels at 16 (64 units of 1024), with the face's own advances and line metrics, so text is laid out
// exactly as before. It is added under the same name, for the characters it holds, and the browser takes it before the
// file's face. Nothing here is drawn by hand: every dot comes from the face the page already loads (its licence, the
// SIL Open Font License 1.1, is in art/fonts beside it).

const FAMILY = 'LM Text', PX = 16, K = 8, PITCH = 61.8, UPM = 1024, U = UPM / PX; // U: font units to a pixel
// the face's characters (Basic Latin, Latin-1 and the punctuation the game's words use), less controls, the soft
// hyphen and the combining marks, which have no dots of their own
const CHARS = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~'
  + ' ¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿'
  + 'ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞß'
  + 'àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ'
  + 'ıŒœʻʼˆ˚˜–—‘’‚“”„•…′″‹›⁄€™↑↓−∕';
const WIDE = '…′″↑↓'; // drawn two cells wide in the face
const ASC = Math.round(1.16 * UPM), DESC = Math.round(0.288 * UPM); // the face's own line metrics (1160 and 288 of 1000)

// Each glyph as rows of lit pixels: { w (pixels), px: [[col, row]...] }, row 0 the one standing on the baseline.
async function readGlyphs() {
  const W = 2 * PX * K, H = 224, X0 = PX * K / 2, Y0 = Math.round(1.25 * PX * K), s = 62.5 / PITCH;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true }); if (!g) return null;
  const sum = new Float64Array((W + 1) * (H + 1)), out = [];
  for (const ch of CHARS) {
    if (out.length % 40 === 39) await new Promise(r => setTimeout(r)); // forty glyphs at a time, so the loading screen keeps turning
    const w = WIDE.includes(ch) ? PX : PX / 2;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.setTransform(s, 0, 0, s, X0, Y0); g.font = `${PX * K}px "${FAMILY}"`; g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'; g.fillText(ch, 0, 0);
    const a = g.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += a[(y * W + x) * 4 + 3]; sum[(y + 1) * (W + 1) + x + 1] = sum[y * (W + 1) + x + 1] + row; } }
    const block = (x, y) => { // the share of an 8 x 8 block that is lit, its top left corner at canvas x, y
      const x1 = Math.max(0, Math.min(W, x)), y1 = Math.max(0, Math.min(H, y)), x2 = Math.max(0, Math.min(W, x + K)), y2 = Math.max(0, Math.min(H, y + K));
      return (sum[y2 * (W + 1) + x2] - sum[y1 * (W + 1) + x2] - sum[y2 * (W + 1) + x1] + sum[y1 * (W + 1) + x1]) / (K * K * 255);
    };
    // The grid's phase in this glyph: the shift that leaves the fewest blocks half lit. The face's dots mostly start 28
    // units in and 28 below the baseline (a block 4 canvas pixels right and 3 down), and the search looks no further than
    // half a pixel either side of that, so every glyph keeps the same baseline and the same left edge: the dot row that
    // straddles the baseline stands on it, the first dot column is the cell's first.
    let best = null;
    for (let e = 0; e < K; e++) for (let f = -1; f < K - 1; f++) {
      let cost = 0;
      for (let j = -6; j < 20; j++) for (let i = -2; i < w + 2; i++) { const v = block(X0 + i * K + e, Y0 - (j + 1) * K + f); cost += Math.min(v, 1 - v); }
      cost += (Math.abs(e - 4) + Math.abs(f - 3)) * 1e-6;
      if (!best || cost < best.cost) best = { cost, e, f };
    }
    const px = [];
    for (let j = -6; j < 20; j++) for (let i = -2; i < w + 2; i++) if (block(X0 + i * K + best.e, Y0 - (j + 1) * K + best.f) >= .5) px.push([i, j]);
    out.push({ ch, w, px });
  }
  return out;
}

// The lit pixels as rectangles: runs along each row, and a run carried down while the rows below repeat it.
function rects(px) {
  const rows = new Map(); for (const [i, j] of px) { if (!rows.has(j)) rows.set(j, []); rows.get(j).push(i); }
  const runs = [];
  for (const [j, xs] of rows) { xs.sort((a, b) => a - b); let s = xs[0], p = xs[0]; for (const x of xs.slice(1).concat([Infinity])) { if (x === p + 1) { p = x; continue; } runs.push([s, p + 1, j]); s = p = x; } }
  const open = new Map(), out = [];
  for (const [a, b, j] of runs.sort((r, q) => q[2] - r[2] || r[0] - q[0])) { // from the top row down
    const k = a + ',' + b, r = open.get(k);
    if (r && r.y0 === j + 1) r.y0 = j; else { const n = { x0: a, x1: b, y0: j, y1: j + 1 }; open.set(k, n); out.push(n); }
  }
  return out;
}

// A TrueType font from the glyphs: every point on a whole pixel, each rectangle a contour drawn clockwise.
function buildFont(glyphs) {
  glyphs = glyphs.slice().sort((a, b) => a.ch.codePointAt(0) - b.ch.codePointAt(0));
  const G = [{ w: PX / 2, r: [] }].concat(glyphs.map(g => ({ w: g.w, r: rects(g.px), code: g.ch.codePointAt(0) }))); // glyph 0: .notdef, empty
  const n = G.length;
  const glyf = [], loca = [0]; let size = 0, maxPts = 0, maxCont = 0, bx0 = 0, by0 = 0, bx1 = 0, by1 = 0;
  for (const g of G) {
    if (!g.r.length) { loca.push(size); g.lsb = 0; continue; }
    const x0 = Math.min(...g.r.map(r => r.x0)) * U, x1 = Math.max(...g.r.map(r => r.x1)) * U, y0 = Math.min(...g.r.map(r => r.y0)) * U, y1 = Math.max(...g.r.map(r => r.y1)) * U;
    g.lsb = x0; bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1);
    const pts = []; for (const r of g.r) pts.push([r.x0 * U, r.y0 * U], [r.x0 * U, r.y1 * U], [r.x1 * U, r.y1 * U], [r.x1 * U, r.y0 * U]);
    maxPts = Math.max(maxPts, pts.length); maxCont = Math.max(maxCont, g.r.length);
    const b = [];
    const i16 = v => b.push((v >> 8) & 255, v & 255);
    i16(g.r.length); i16(x0); i16(y0); i16(x1); i16(y1);
    g.r.forEach((r, k) => i16(k * 4 + 3)); i16(0); // contour ends, no instructions
    for (let k = 0; k < pts.length; k++) b.push(1); // every point on the curve, coordinates as 16-bit steps
    let px = 0, py = 0; for (const [x] of pts) { i16(x - px); px = x; } for (const [, y] of pts) { i16(y - py); py = y; }
    while (b.length % 4) b.push(0);
    glyf.push(...b); size += b.length; loca.push(size);
  }
  const T = {}, be = () => { const a = []; const o = { u8: v => (a.push(v & 255), o), u16: v => (a.push((v >> 8) & 255, v & 255), o), u32: v => (o.u16((v >>> 16) & 65535), o.u16(v & 65535)), a }; return o; };
  T.head = be().u32(0x10000).u32(0x10000).u32(0).u32(0x5F0F3CF5).u16(0x000B).u16(UPM).u32(0).u32(0).u32(0).u32(0)
    .u16(bx0).u16(by0).u16(bx1).u16(by1).u16(0).u16(8).u16(2).u16(1).u16(0).a;
  T.hhea = be().u32(0x10000).u16(ASC).u16(-DESC).u16(0).u16(PX * U).u16(0).u16(0).u16(bx1).u16(1).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(n).a;
  T.maxp = be().u32(0x10000).u16(n).u16(maxPts).u16(maxCont).u16(0).u16(0).u16(2).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).u16(0).a;
  const codes = G.slice(1).map(g => g.code);
  const os2 = be().u16(4).u16(PX / 2 * U).u16(400).u16(5).u16(0);
  for (const v of [666, 614, 0, 77, 666, 614, 0, 358, 64, 300, 0]) os2.u16(v);
  for (let k = 0; k < 10; k++) os2.u8(0);
  os2.u32(3).u32(0).u32(0).u32(0); for (const ch of 'NONE') os2.u8(ch.charCodeAt(0));
  os2.u16(0x40).u16(Math.min(...codes)).u16(Math.min(0xFFFF, Math.max(...codes))).u16(Math.round(.88 * UPM)).u16(-Math.round(.12 * UPM)).u16(0).u16(ASC).u16(DESC).u32(1).u32(0)
    .u16(8 * U).u16(12 * U).u16(0).u16(32).u16(1);
  T['OS/2'] = os2.a;
  const hm = be(); for (const g of G) hm.u16(g.w * U).u16(g.lsb); T.hmtx = hm.a;
  const lo = be(); for (const v of loca) lo.u32(v); T.loca = lo.a; T.glyf = glyf;
  // cmap: one Windows Unicode table (format 4), a segment for each run of characters whose glyphs follow on
  const segs = []; G.slice(1).forEach((g, k) => { const s = segs[segs.length - 1]; if (s && g.code === s.end + 1 && k + 1 - g.code === s.delta) s.end = g.code; else segs.push({ start: g.code, end: g.code, delta: k + 1 - g.code }); });
  segs.push({ start: 0xFFFF, end: 0xFFFF, delta: 1 });
  const sc = segs.length, p2 = 2 ** Math.floor(Math.log2(sc)), f4 = be();
  f4.u16(4).u16(16 + sc * 8).u16(0).u16(sc * 2).u16(p2 * 2).u16(Math.log2(p2)).u16(sc * 2 - p2 * 2);
  for (const s of segs) f4.u16(s.end); f4.u16(0); for (const s of segs) f4.u16(s.start); for (const s of segs) f4.u16(s.delta & 65535); for (const s of segs) f4.u16(0);
  T.cmap = be().u16(0).u16(1).u16(3).u16(1).u32(12).a.concat(f4.a);
  const names = [[1, 'LM Text Pixel'], [2, 'Regular'], [3, 'LM Text Pixel'], [4, 'LM Text Pixel'], [5, 'Version 1.0'], [6, 'LMTextPixel-Regular'],
    [0, 'Dots read at run time from the DotGothic16 face; see art/fonts/OFL-dotgothic16.txt'], [13, 'SIL Open Font License, Version 1.1']];
  const nm = be().u16(0).u16(names.length).u16(6 + 12 * names.length), str = [];
  for (const [id, s] of names.sort((a, b) => a[0] - b[0])) { nm.u16(3).u16(1).u16(0x409).u16(id).u16(s.length * 2).u16(str.length); for (const ch of s) str.push(ch.charCodeAt(0) >> 8, ch.charCodeAt(0) & 255); }
  T.name = nm.a.concat(str);
  T.post = be().u32(0x30000).u32(0).u16(-128).u16(64).u32(1).u32(0).u32(0).u32(0).u32(0).a;
  // the file: the table directory, then each table on a four-byte boundary
  const tags = Object.keys(T).sort(), nt = tags.length, sr = 16 * 2 ** Math.floor(Math.log2(nt));
  const sum32 = a => { let s = 0; for (let k = 0; k < a.length; k += 4) s = (s + ((a[k] << 24) | ((a[k + 1] || 0) << 16) | ((a[k + 2] || 0) << 8) | (a[k + 3] || 0))) >>> 0; return s; };
  const dir = be().u32(0x10000).u16(nt).u16(sr).u16(Math.log2(sr / 16)).u16(nt * 16 - sr);
  let off = 12 + 16 * nt; const body = [];
  for (const t of tags) { const a = T[t]; for (const ch of t) dir.u8(ch.charCodeAt(0)); dir.u32(sum32(a)).u32(off).u32(a.length); const pad = a.concat(new Array((4 - a.length % 4) % 4).fill(0)); body.push(...pad); off += pad.length; }
  const file = new Uint8Array(dir.a.concat(body));
  const adj = (0xB1B0AFBA - sum32(file)) >>> 0, ho = 12 + 16 * tags.indexOf('head') + 8, hoff = (file[ho] << 24 | file[ho + 1] << 16 | file[ho + 2] << 8 | file[ho + 3]) >>> 0;
  file[hoff + 8] = adj >>> 24; file[hoff + 9] = (adj >>> 16) & 255; file[hoff + 10] = (adj >>> 8) & 255; file[hoff + 11] = adj & 255;
  return { file, codes };
}

// Reads the face once it is in, builds the pixel font and adds it. Resolves true when the page's body text is on whole
// pixels; false if the browser cannot (the face then stays as it was).
export async function pixelText() {
  if (pixelText.done) return pixelText.done;
  return (pixelText.done = (async () => {
    try {
      if (!document.fonts || typeof FontFace === 'undefined') return false;
      await document.fonts.load(`${PX}px "${FAMILY}"`, CHARS);
      const glyphs = await readGlyphs(); if (!glyphs || !glyphs.some(g => g.px.length)) return false;
      const { file, codes } = buildFont(glyphs);
      const range = codes.map(c => 'U+' + c.toString(16).toUpperCase()).join(',');
      const face = new FontFace(FAMILY, file.buffer, { unicodeRange: range, display: 'block' });
      await face.load(); document.fonts.add(face);
      return true;
    } catch (e) { return false; }
  })());
}
