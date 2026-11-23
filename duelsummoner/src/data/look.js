// The look of each stage, from the locked palettes (design/art-book/look.mjs, PALETTES). Entry 0 is exactly what the game drew before this file existed: it must never change.
// ramp: null keeps each primitive's own colour; otherwise a primitive's original colour (p.c0) is mapped by its brightness onto this ramp of palette colours, dark to light.
// sky: top, horizon (also the fog colour) and below-the-horizon colours.
export const STAGE_LOOK = [
  { name: 'ruins', ramp: null, sand: [0xc8a46c, 0xcaa978, 0xc09c66], road: 0xb09470, rim: [0xbca494, 0xd0bcaa, 0xbca494], mesa: 0xd4c4ac, skirt: 0xc8a46c, landmark: [0xe6dcc0, 0x4a4250], seal: [0.18, 0.10, 0.32], sky: [0x8fb2cc, 0xe8d6b0, 0xd9c29a], fogNear: 80, fogFar: 300, dome: { top: 0x7c9db4, mid: 0xaec4c6, hor: 0xe8dcbc, gnd: 0xe8d6b0, cldL: 0xfaf4e6, cldS: 0xa6bcc6, cover: 0.55, sun: true }, water: [0x2c5c60, 0x1f4f5a, 0x62aea8], actor: null },
  // Stage 2, Sealed Catacombs: slate floor, wet stone edge, old bone and rust. No sun, a pale cold haze.
  { name: 'catacombs', ramp: [0x0f1a26, 0x23384d, 0x3c5a73, 0x6e8aa0, 0x9a917c, 0xd9d0b8], sand: [0x23384d, 0x2a4259, 0x1d3043], road: 0x3c5a73, rim: [0x23384d, 0x3c5a73, 0x1b2c3e], mesa: 0x2a4259, skirt: 0x0f1a26, landmark: [0xd9d0b8, 0x23384d], seal: [0.18, 0.10, 0.32], sky: [0x182636, 0x4e6e76, 0x0f1a26], fogNear: 50, fogFar: 230, dome: { top: 0x182636, mid: 0x2c4456, hor: 0x4e6e76, gnd: 0x0f1a26, cldL: 0x6e8aa0, cldS: 0x23384d, cover: 0, sun: false, mode: 1, mist: 0x7fae9c, glow: 0x4f7f88 }, water: [0x3f5f52, 0x1b2c3e, 0x6f9a86], actor: { lift: [0.20, 0.27, 0.25], key: [0.16, 0.22, 0.20] } },
  // Stage 3, Vault of the Last Duel: basalt floor under a roof lost in black, ash-gold, moon-white and crimson. No violet in the scenery; the seal core is pale so it reads on dark ground.
  { name: 'vault', ramp: [0x0d0b12, 0x1e1e2a, 0x2e2c3a, 0x46445a, 0x8a7a5c, 0xb8a37c, 0xd9c7a0], sand: [0x1e1e2a, 0x2e2c3a, 0x26242f], road: 0x46445a, rim: [0x2e2c3a, 0x46445a, 0x1e1e2a], mesa: 0x1e1e2a, skirt: 0x0d0b12, landmark: [0xd8e4f4, 0x2e2c3a], seal: [0.62, 0.52, 0.88], sky: [0x060a12, 0x1a2838, 0x060a12], fogNear: 45, fogFar: 210, dome: { top: 0x060a12, mid: 0x0c1422, hor: 0x1a2838, gnd: 0x060a12, cldL: 0x1a2838, cldS: 0x0c1422, cover: 0, sun: false, mode: 2 }, water: [0x1e1e2a, 0x0d0b12, 0x3a3a4c], actor: { lift: [0.24, 0.26, 0.31], key: [0.18, 0.20, 0.25] } }
];
export const lookFor = stage => STAGE_LOOK[Math.max(0, Math.min(stage | 0, STAGE_LOOK.length - 1))];

// a primitive's colour on a ramp: its brightness picks a place between two palette colours
export function rampColour(ramp, c0) {
  const r = (c0 >> 16) & 255, g = (c0 >> 8) & 255, b = c0 & 255, lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const t = Math.max(0, Math.min(1, (lum - 0.25) / 0.6)) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(t)), f = t - i, a = ramp[i], d = ramp[i + 1];
  const mix = s => Math.round(((a >> s) & 255) * (1 - f) + ((d >> s) & 255) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}

// ---- the palette the post pass snaps to (engine plan 0c; locked palettes in design/art-book/look.mjs). Each stage's own colours plus the shared ones. Reserved colours are exact entries.
export const PALETTE_SHARED = [
  0xc08a64, 0xe8b890, 0xc8462c, 0xf08040, 0x2f7f86, 0x6fc0c0, 0x5e4030, 0xf0e8d4, 0x18161c,           // duelists and summons
  0x4a4034, 0x6e604c, 0x9a8a70, 0x4a5260, 0xe0a040,                                                      // enemies and their amber eyes
  0xffffff, 0x46e0ff, 0xe0b765, 0xfff0b8, 0xb26bff, 0xf4ecff, 0xff3b30,                                  // reserved: player outline, XP, gold, gold light, violet, violet light, danger
  0xffc24a, 0xbfdcff, 0xcfeefc, 0x8fd14f, 0xd9fff0, 0xc08a3e, 0xfffbe8, 0x2a2632                         // element effects
];
export const PALETTE_STAGE = [
  [0x8f7048, 0xc09c66, 0xe2c896, 0xb09470, 0x3f6e4e, 0x5a9a66, 0x9cc88a, 0x8fa860, 0x5e5048, 0xb0aa9e, 0xdcd8ce, 0xa89578, 0xe6dcc0, 0x4a4250, 0xb4643f, 0x3e7f80, 0x2e3f66, 0x8fb2cc, 0xe8d6b0],
  [0x0f1a26, 0x23384d, 0x3c5a73, 0x6e8aa0, 0x9a917c, 0xd9d0b8, 0x5a3020, 0x8c4a2f, 0x3f5f52, 0x5f8a74, 0x8fbf8a, 0xd8f0c8],
  [0x0d0b12, 0x1e1e2a, 0x2e2c3a, 0x46445a, 0x8a7a5c, 0xb8a37c, 0xd9c7a0, 0x9fb4d0, 0xd8e4f4, 0xf4f8ff, 0x5a1420, 0xa3203a]
];
// the four light levels a palette colour is lit at (shadow, dim, lit, bright)
export const LIGHT_LEVELS = [0.55, 0.78, 1.0, 1.14];
// a 32 x 32 x 32 table (RGBA8, r fastest): the palette entry nearest to each quantised colour, over every palette colour at every light level. Reserved colours are kept exact at level 1.0 only.
export function buildPaletteLUT(stage) {
  const base = PALETTE_STAGE[Math.max(0, Math.min(stage | 0, 2))].concat(PALETTE_SHARED), ents = [];
  const rgb = c => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
  base.forEach((c, i) => { const reserved = i >= PALETTE_STAGE[Math.max(0, Math.min(stage | 0, 2))].length + 14 && i < PALETTE_STAGE[Math.max(0, Math.min(stage | 0, 2))].length + 21; const [r, g, b] = rgb(c); for (const L of (reserved ? [1] : LIGHT_LEVELS)) ents.push([Math.min(255, Math.round(r * L)), Math.min(255, Math.round(g * L)), Math.min(255, Math.round(b * L))]); });
  const out = new Uint8Array(32 * 32 * 32 * 4); let k = 0;
  for (let bz = 0; bz < 32; bz++) for (let gy = 0; gy < 32; gy++) for (let rx = 0; rx < 32; rx++) {
    const r = Math.round(rx * 255 / 31), g = Math.round(gy * 255 / 31), b = Math.round(bz * 255 / 31); let best = 0, bd = 1e9;
    for (let i = 0; i < ents.length; i++) { const e = ents[i], dr = e[0] - r, dg = e[1] - g, db = e[2] - b, d = 2 * dr * dr + 4 * dg * dg + 3 * db * db; if (d < bd) { bd = d; best = i; } }       // a weighted distance: the eye is most sensitive to green
    const e = ents[best]; out[k++] = e[0]; out[k++] = e[1]; out[k++] = e[2]; out[k++] = 255;
  }
  return out;
}
