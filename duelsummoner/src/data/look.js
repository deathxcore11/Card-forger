// The look of each stage, from the locked palettes (design/art-book/look.mjs, PALETTES). Entry 0 is exactly what the game drew before this file existed: it must never change.
// ramp: null keeps each primitive's own colour; otherwise a primitive's original colour (p.c0) is mapped by its brightness onto this ramp of palette colours, dark to light.
// sky: top, horizon (also the fog colour) and below-the-horizon colours.
export const STAGE_LOOK = [
  { name: 'ruins', ramp: null, sand: [0xc8a46c, 0xcaa978, 0xc09c66], road: 0xb09470, rim: [0xbca494, 0xd0bcaa, 0xbca494], mesa: 0xd4c4ac, skirt: 0xc8a46c, landmark: [0xe6dcc0, 0x4a4250], seal: [0.18, 0.10, 0.32], sky: [0x8fb2cc, 0xe8d6b0, 0xd9c29a], fogNear: 80, fogFar: 300 },
  // Stage 2, Sealed Catacombs: slate floor, wet stone edge, old bone and rust. No sun, a pale cold haze.
  { name: 'catacombs', ramp: [0x0f1a26, 0x23384d, 0x3c5a73, 0x6e8aa0, 0x9a917c, 0xd9d0b8], sand: [0x23384d, 0x2a4259, 0x1d3043], road: 0x3c5a73, rim: [0x23384d, 0x3c5a73, 0x1b2c3e], mesa: 0x2a4259, skirt: 0x0f1a26, landmark: [0xd9d0b8, 0x23384d], seal: [0.18, 0.10, 0.32], sky: [0x23384d, 0x6e8aa0, 0x0f1a26], fogNear: 50, fogFar: 230 },
  // Stage 3, Vault of the Last Duel: basalt floor under a roof lost in black, ash-gold, moon-white and crimson. No violet in the scenery; the seal core is pale so it reads on dark ground.
  { name: 'vault', ramp: [0x0d0b12, 0x1e1e2a, 0x2e2c3a, 0x46445a, 0x8a7a5c, 0xb8a37c, 0xd9c7a0], sand: [0x1e1e2a, 0x2e2c3a, 0x26242f], road: 0x46445a, rim: [0x2e2c3a, 0x46445a, 0x1e1e2a], mesa: 0x1e1e2a, skirt: 0x0d0b12, landmark: [0xd8e4f4, 0x2e2c3a], seal: [0.62, 0.52, 0.88], sky: [0x0d0b12, 0x2e2c3a, 0x0d0b12], fogNear: 45, fogFar: 210 }
];
export const lookFor = stage => STAGE_LOOK[Math.max(0, Math.min(stage | 0, STAGE_LOOK.length - 1))];

// a primitive's colour on a ramp: its brightness picks a place between two palette colours
export function rampColour(ramp, c0) {
  const r = (c0 >> 16) & 255, g = (c0 >> 8) & 255, b = c0 & 255, lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
  const t = Math.max(0, Math.min(1, (lum - 0.25) / 0.6)) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(t)), f = t - i, a = ramp[i], d = ramp[i + 1];
  const mix = s => Math.round(((a >> s) & 255) * (1 - f) + ((d >> s) & 255) * f);
  return (mix(16) << 16) | (mix(8) << 8) | mix(0);
}
