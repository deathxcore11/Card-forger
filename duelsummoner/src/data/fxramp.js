// The one effect colour ramp (spectacle spec 3.0): eight elements, five tones each. Columns: 0 core, 1 bright, 2 body, 3 shade, 4 ink. Core, bright and body come from the art book's effect palette
// (design/art-book/make.mjs and look.mjs); shade and ink are proposals. Rows with no ink in the spec (wind, light) repeat their shade in the ink column, so the shader never reads a hole. Dark is the black one:
// core is the black, bright is the moon-white rim, ink is the pinpoint. No tone is pure white, and none sits near a reserved colour (test/fxramp.test.js).
export const ELEMENTS = ['fire', 'ice', 'lightning', 'poison', 'wind', 'earth', 'light', 'dark'];
export const RAMP = {
  fire:      [0xfff4c8, 0xffc24a, 0xff8a1f, 0x8a5012, 0x3a2a18],
  ice:       [0xf0fbff, 0xcfeefc, 0x8ab8e0, 0x4f7396, 0x23384d],
  lightning: [0xf4f9ff, 0xbfdcff, 0x7fb8ff, 0x3a4ad0, 0x141a40],
  poison:    [0xe8ff9a, 0x8fd14f, 0x4f8a2a, 0x2a5a3a, 0x18161c],
  wind:      [0xf4fff9, 0xd9fff0, 0x9ad8c0, 0x6e8aa0, 0x6e8aa0],
  earth:     [0xe8c890, 0xc08a3e, 0x7a5428, 0x4a3a24, 0x1e1e2a],
  light:     [0xfffbe8, 0xfff2c4, 0xffe9a8, 0xd8c48a, 0xd8c48a],
  dark:      [0x0d0b12, 0xd8e4f4, 0x2a2632, 0x46445a, 0xf4f8ff]
};
export const ROW = Object.fromEntries(ELEMENTS.map((e, i) => [e.toUpperCase(), i]));
