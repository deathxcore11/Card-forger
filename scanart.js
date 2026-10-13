// Which printing is it? The scanner reads the name; the picture decides the printing.
// A card's fingerprint is its art (grey, contrast-normalised, so light and white balance matter
// little) plus a coarse colour grid of the whole card (frame colour and era tell reprints of the
// same art apart). Fingerprints are compared by correlation: 1 = same picture, ~0 = unrelated.

// Where the art sits on each game's card, as fractions [x, y, w, h].
export const ART = {
  mtg: [0.08, 0.11, 0.84, 0.44],
  ptcg: [0.08, 0.1, 0.84, 0.4],
  ygo: [0.12, 0.18, 0.76, 0.52],
};
const AW = 24, AH = 18, FW = 8, FH = 11;

// Average the pixels of a region into a gw × gh grid (box filter: tolerant of blur and noise).
function grid(data, W, H, [fx, fy, fw, fh], gw, gh, color) {
  const out = new Float32Array(gw * gh * (color ? 3 : 1)),
    x0 = fx * W, y0 = fy * H, cw = (fw * W) / gw, ch = (fh * H) / gh;
  for (let gy = 0; gy < gh; gy++)
    for (let gx = 0; gx < gw; gx++) {
      const xa = Math.floor(x0 + gx * cw), xb = Math.max(xa + 1, Math.floor(x0 + (gx + 1) * cw)),
        ya = Math.floor(y0 + gy * ch), yb = Math.max(ya + 1, Math.floor(y0 + (gy + 1) * ch));
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = ya; y < yb && y < H; y++)
        for (let x = xa; x < xb && x < W; x++) {
          const i = (y * W + x) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      n ||= 1;
      const k = gy * gw + gx;
      if (color) { out[k * 3] = r / n; out[k * 3 + 1] = g / n; out[k * 3 + 2] = b / n; }
      else out[k] = 0.299 * (r / n) + 0.587 * (g / n) + 0.114 * (b / n);
    }
  return out;
}
// Zero mean, unit length: correlation becomes a dot product.
function norm(v) {
  let m = 0;
  for (const x of v) m += x;
  m /= v.length;
  let s = 0;
  for (let i = 0; i < v.length; i++) { v[i] -= m; s += v[i] * v[i]; }
  s = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= s;
  return v;
}
// Fingerprint from raw RGBA pixels of a card (the whole card, upright).
export function fingerprint(data, W, H, g = "mtg") {
  return { art: norm(grid(data, W, H, ART[g] || ART.mtg, AW, AH, false)), full: norm(grid(data, W, H, [0, 0, 1, 1], FW, FH, true)) };
}
const dot = (a, b) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
};
// 1 = same printing's picture; the art counts most, the frame breaks ties between reprints.
export const likeness = (a, b) => 0.7 * dot(a.art, b.art) + 0.3 * dot(a.full, b.full);

// Rank printings by how much they look like the scanned card. Confident only when the best is
// clearly a match and clearly ahead of the next different picture.
export function rankPrintings(scan, prints) {
  const ranked = prints.map((p) => ({ ...p, score: likeness(scan, p.fp) })).sort((a, b) => b.score - a.score),
    [a, b] = ranked;
  const sure = !!a && a.score >= 0.55 && (!b || a.score - b.score >= 0.06);
  return { ranked, best: a || null, sure };
}

// Browser helpers: fingerprint a canvas, or an image URL (needs CORS; Scryfall, TCGdex and the
// app's own image proxy all allow it).
export function fingerprintCanvas(canvas, g) {
  const W = 96, H = 134, c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.drawImage(canvas, 0, 0, W, H);
  return fingerprint(x.getImageData(0, 0, W, H).data, W, H, g);
}
const fpCache = new Map();
export function fingerprintUrl(url, g) {
  if (fpCache.has(url)) return fpCache.get(url);
  const p = new Promise((ok, bad) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try { ok(fingerprintCanvas(img, g)); } catch (e) { bad(e); }
    };
    img.onerror = () => bad(Error("image"));
    img.src = url;
  });
  fpCache.set(url, p);
  p.catch(() => fpCache.delete(url));
  return p;
}
