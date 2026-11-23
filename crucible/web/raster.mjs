// A small software renderer in the manner of the 1994 console, for the 3D things in Lost Memories (the duel table, the
// cards on it, the doors). What it does is what that machine did, and nothing more:
//   - vertices are moved to whole screen pixels before a triangle is drawn (no sub-pixel precision), so edges snap;
//   - textures are mapped in screen space (affine), so they swim a little as a shape turns;
//   - there is no depth buffer: shapes are sorted far to near and drawn in that order; a shape facing away is skipped;
//   - brightness is set per corner and blended across the triangle; distance fades to black;
//   - every pixel is cut to 15-bit colour with the console's 4 x 4 dither table;
//   - texels with no alpha are skipped (the console's transparent colour), nothing is half see-through.
// Textures are small (a card picture is 40 x 40, the table top 128 x 128) and sampled nearest, never smoothed.

const BAYER = [-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2];

export function makeView(canvas, w, h) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h), px = new Uint32Array(img.data.buffer);
  const v = { w, h, ctx, img, px, list: [], cam: null };
  return v;
}

// A camera looking down at the table. pitch in radians below the horizon; f is the focal length in pixels.
export function camera({ y, z, pitch, f, cx, cy }) {
  const c = Math.cos(pitch), s = Math.sin(pitch);
  return p => { // world [x, y, z] (y up, +z toward the viewer) to [screen x, screen y, depth]
    const dx = p[0], dy = p[1] - y, dz = p[2] - z;
    const d = -dy * s - dz * c, up = dy * c - dz * s; // depth along the line of sight, and height on the screen
    if (d < 1) return null;
    return [Math.round(cx + f * dx / d), Math.round(cy - f * up / d), d];
  };
}

// Queue a flat four-cornered shape. q = { p: [4 world points], uv: [4 [u,v]], tex, shade: [4] or number, key }.
export const quad = (v, q) => v.list.push(q);

export function clear(v, rgb = 0) { v.px.fill(0xff000000 | rgb); v.list.length = 0; }
export function backdrop(v, tex, ox = 0, oy = 0) { // a painted picture behind everything, copied pixel for pixel
  const { w, h, px } = v;
  for (let y = 0; y < h; y++) { const sy = y + oy; if (sy < 0 || sy >= tex.h) continue; for (let x = 0; x < w; x++) { const sx = x + ox; if (sx < 0 || sx >= tex.w) continue; px[y * w + x] = tex.d[sy * tex.w + sx] | 0xff000000; } }
}

// Fog: how much of a corner's colour is left at a depth. near and far in world units.
export const fogAt = (d, near, far) => Math.max(0, Math.min(1, 1 - (d - near) / (far - near)));

// A flat picture put straight into the frame at its place in the drawing order (blit: a function that writes the
// view's pixels, z: where it falls among the shapes), as the console put its sprites between the shapes of a scene.
export const sprite = (v, z, blit) => v.list.push({ blit, z });

export function draw(v, proj, fog = null) {
  const items = [];
  for (const q of v.list) {
    if (q.blit) { items.push({ q, z: q.z }); continue; }
    const s = q.p.map(proj); if (s.some(x => !x)) continue;
    if (q.cull && (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[1][1] - s[0][1]) * (s[2][0] - s[0][0]) <= 0) continue; // facing away: not drawn (the console's own test)
    const sh = Array.isArray(q.shade) ? q.shade : [q.shade ?? 1, q.shade ?? 1, q.shade ?? 1, q.shade ?? 1];
    const k = s.map((x, i) => sh[i] * (fog ? fogAt(x[2], fog[0], fog[1]) : 1));
    items.push({ q, s, k, z: (s[0][2] + s[1][2] + s[2][2] + s[3][2]) / 4 + (q.bias || 0) });
  }
  items.sort((a, b) => b.z - a.z); // far first: the console's ordering table
  for (const it of items) {
    const { q, s, k } = it;
    if (q.blit) { q.blit(v); continue; }
    tri(v, s[0], s[1], s[2], q.uv[0], q.uv[1], q.uv[2], k[0], k[1], k[2], q.tex, q.col);
    tri(v, s[0], s[2], s[3], q.uv[0], q.uv[2], q.uv[3], k[0], k[2], k[3], q.tex, q.col);
  }
  return items.map(it => ({ id: it.q.id, s: it.s })).filter(x => x.id != null);
}

// One triangle: bounding box walk with edge tests; u, v and brightness blended in screen space (affine).
function tri(v, a, b, c, ta, tb, tc, ka, kb, kc, tex, col) {
  const { w, h, px } = v;
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (area === 0) return;
  const minX = Math.max(0, Math.min(a[0], b[0], c[0])), maxX = Math.min(w - 1, Math.max(a[0], b[0], c[0]));
  const minY = Math.max(0, Math.min(a[1], b[1], c[1])), maxY = Math.min(h - 1, Math.max(a[1], b[1], c[1]));
  const inv = 1 / area;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px0 = x + .5, py0 = y + .5;
      let w0 = (b[0] - px0) * (c[1] - py0) - (b[1] - py0) * (c[0] - px0);
      let w1 = (c[0] - px0) * (a[1] - py0) - (c[1] - py0) * (a[0] - px0);
      let w2 = (a[0] - px0) * (b[1] - py0) - (a[1] - py0) * (b[0] - px0);
      if (area < 0) { w0 = -w0; w1 = -w1; w2 = -w2; }
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const l0 = w0 * Math.abs(inv), l1 = w1 * Math.abs(inv), l2 = 1 - l0 - l1;
      let r, g, bl;
      if (tex) {
        const u = Math.min(tex.w - 1, Math.max(0, (l0 * ta[0] + l1 * tb[0] + l2 * tc[0]) | 0));
        const vv = Math.min(tex.h - 1, Math.max(0, (l0 * ta[1] + l1 * tb[1] + l2 * tc[1]) | 0));
        const t = tex.d[vv * tex.w + u];
        if ((t >>> 24) < 128) continue; // the transparent colour
        r = t & 255; g = (t >> 8) & 255; bl = (t >> 16) & 255;
      } else { r = col[0]; g = col[1]; bl = col[2]; }
      const k = l0 * ka + l1 * kb + l2 * kc, d = BAYER[(y & 3) * 4 + (x & 3)];
      r = Math.max(0, Math.min(255, r * k + d)) & 0xf8; g = Math.max(0, Math.min(255, g * k + d)) & 0xf8; bl = Math.max(0, Math.min(255, bl * k + d)) & 0xf8;
      px[y * w + x] = 0xff000000 | (bl << 16) | (g << 8) | r;
    }
  }
}

export function present(v) { v.ctx.putImageData(v.img, 0, 0); }

// A texture from a picture already drawn at its console size. Fails quietly (returns null) when the browser will not
// let the page read the picture, as it will not for a page opened straight from the disk.
export function texFrom(source, w, h, sx = 0, sy = 0, sw = null, sh = null) {
  try {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = sw != null && (sw > w * 1.5);
    if (sw != null) x.drawImage(source, sx, sy, sw, sh, 0, 0, w, h); else x.drawImage(source, 0, 0, w, h);
    const id = x.getImageData(0, 0, w, h);
    return { w, h, d: new Uint32Array(id.data.buffer) };
  } catch { return null; }
}
// The same, cut to 15-bit colour with the dither table: for card pictures shrunk from the app's art when the game loads.
export function crunch(tex) {
  if (!tex) return tex;
  const { w, h, d } = tex;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, t = d[i], k = BAYER[(y & 3) * 4 + (x & 3)];
    const r = Math.max(0, Math.min(255, (t & 255) + k)) & 0xf8, g = Math.max(0, Math.min(255, ((t >> 8) & 255) + k)) & 0xf8, b = Math.max(0, Math.min(255, ((t >> 16) & 255) + k)) & 0xf8;
    d[i] = (t & 0xff000000) | (b << 16) | (g << 8) | r;
  }
  return tex;
}
export const flat = (w, h, rgb) => ({ w, h, d: new Uint32Array(w * h).fill(0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) });
