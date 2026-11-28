// Map themes (design/themes-v1.md, owner, 27 Nov): one entry per map drives the place, and each time of day overrides part of it. The generator and the view hold no theme in code:
// they read these entries. A run's stages 1, 2 and 3 are the map's morning, evening and night. Colours are hex; the sky is [top, horizon, below]; fog is [near, far] in metres.
// Desert is filled in from the doc; ash is a stand-in second map to prove the system makes a clearly different place (the roster thread writes the other seven).
export const TIMES = ['morning', 'evening', 'night'];
export const THEMES = {
  desert: {
    id: 'desert', element: 'earth', name: 'The Open Desert',
    ground: { material: 'sand', lit: 0xf0d49a, lee: 0xd0832f, tintA: 0xe9bd6c, tintB: 0xedc67c, glint: 0xffe6a0 },
    wind: { strength: 0.6, ripple: 1, drift: 'sand' },
    landform: { style: 'dunes', ridgeScale: 1, slipFace: 1, riverbeds: 3, basinKillBowl: true },
    edge: { range: 'mesas', bank: 12 },
    setpieces: ['sunken-aqueduct', 'card-tomb-bowl', 'great-spine', 'ruined-plaza', 'spire-oasis', 'fallen-beam-riverbed', 'sunken-gate', 'stepped-mesa-climb', 'card-slalom', 'seal-shrine-ring', 'buried-arena', 'obelisk-field', 'caravan-wreck', 'lighthouse-of-cards', 'duelists-tomb'],
    far: ['cardSpire', 'ribcage', 'sunkenGate', 'colossusHead', 'mesaCity', 'aqueduct'], farColours: { sun: 0xc9925e, shade: 0x7d5a78, dark: 0x5e4560 },
    dressing: { density: 0.3, plants: 'warm' },       // about 70% less clutter than before (world v3), plants tinted to the warm and violet palette
    enemies: { swarm: ['Dust Husk', 'Sand Skitter', 'Shard Bat'], elite: ['Dune Golem', 'Glass Scorpion', 'Mirage Caster'], ace: ['Ace Dust Husk'], bosses: ['The Stone Arbiter'],
      night: { swarm: ['Grave Husk', 'Sand Wraith'], elite: ['Lantern Scorpion'] }, roles: { 'Sand Skitter': 'interceptor', 'Sand Wraith': 'blocker', 'Glass Scorpion': 'shooter' } },
    music: 'MU03', ambience: 'AM_DESERT', sting: 'MP01',
    times: {
      morning: { sun: { color: 0xffd9a0, k: 0.72, elev: 0.35 }, hemi: [0xffe9c8, 0x8a6a8a, 0.78], sky: [0x8fb2cc, 0xf1d8a8, 0xe3c494], fog: [90, 300],
        dome: { top: 0x7c9db4, mid: 0xb6c8c4, hor: 0xf1d8a8, gnd: 0xe8d6b0, cldL: 0xfff2dc, cldS: 0xc2a6b0, cover: 0.45, sun: true, shade: 0.2 }, actor: null, groundTint: null },
      evening: { sun: { color: 0xff9a5a, k: 0.62, elev: 0.12 }, hemi: [0xffb08a, 0x6a4a78, 0.7], sky: [0x5a4a78, 0xf09a6a, 0xd88058], fog: [80, 280],
        dome: { top: 0x4a3f70, mid: 0xb0607a, hor: 0xf4a070, gnd: 0xd88058, cldL: 0xffc08a, cldS: 0x8a4a6a, cover: 0.5, sun: true, shade: 0.3 }, actor: { lift: [0.30, 0.18, 0.16], key: [0.22, 0.12, 0.14] }, groundTint: [0xf09a6a, 0.22] },
      night: { sun: { color: 0x9ab4ff, k: 0.38, elev: 0.5 }, hemi: [0x6a78b0, 0x1a1430, 0.62], sky: [0x0c1428, 0x2a3a66, 0x141a30], fog: [60, 240],
        dome: { top: 0x0a1226, mid: 0x18264a, hor: 0x34487a, gnd: 0x0a0e1c, cldL: 0x2a3a5a, cldS: 0x101a30, cover: 0.15, sun: false, shade: 0, mode: 2 }, actor: { lift: [0.16, 0.20, 0.34], key: [0.10, 0.14, 0.28] }, groundTint: [0x3a4a8a, 0.55],
        swap: { swarm: 'night' } }
    }
  },
  ash: {
    id: 'ash', element: 'fire', name: 'The Ashen Reach',
    ground: { material: 'ash', lit: 0x9a8f8a, lee: 0x3e3436, tintA: 0x6e6460, tintB: 0x80756e, glint: 0xff7a3a },
    wind: { strength: 0.45, ripple: 0.5, drift: 'embers' },
    landform: { style: 'terraces', ridgeScale: 0.8, slipFace: 1.4, riverbeds: 2, basinKillBowl: true },
    edge: { range: 'cliffs', bank: 12 },
    setpieces: ['cinder-forge', 'slag-terraces', 'broken-furnace', 'obsidian-slalom', 'ember-shrine-ring'],
    far: ['cardSpire', 'colossusHead', 'sunkenGate', 'ribcage'], farColours: { sun: 0x4a3a3a, shade: 0x1e1418, dark: 0xff5a20 },
    dressing: { density: 0.25, plants: 'charred' },
    enemies: { swarm: ['Cinder Husk', 'Ember Mite'], elite: ['Slag Golem', 'Ash Caster'], ace: ['Ace Cinder Husk'], bosses: ['The Forge Warden'], night: { swarm: ['Coal Wraith'] }, roles: { 'Ember Mite': 'interceptor', 'Coal Wraith': 'blocker' } },
    music: 'MU04', ambience: 'AM_ASH', sting: 'MP02',
    times: {
      morning: { sun: { color: 0xffb890, k: 0.5, elev: 0.25 }, hemi: [0xb0a0a0, 0x3a2a2a, 0.7], sky: [0x6a6a78, 0xc8a090, 0x7a6a66], fog: [50, 220],
        dome: { top: 0x5a5a6a, mid: 0x8a7a80, hor: 0xc8a090, gnd: 0x6a5a56, cldL: 0xa89898, cldS: 0x4a4048, cover: 0.85, sun: true, shade: 0.35 }, actor: { lift: [0.24, 0.16, 0.14], key: [0.18, 0.12, 0.12] }, groundTint: null },
      evening: { sun: { color: 0xff6a3a, k: 0.55, elev: 0.08 }, hemi: [0xff7a4a, 0x2a1418, 0.66], sky: [0x3a1a20, 0xd0502a, 0x5a2a20], fog: [45, 200],
        dome: { top: 0x2a1418, mid: 0x7a2a24, hor: 0xe06030, gnd: 0x4a1e18, cldL: 0xa04030, cldS: 0x3a1418, cover: 0.7, sun: true, shade: 0.4 }, actor: { lift: [0.34, 0.14, 0.10], key: [0.26, 0.10, 0.08] }, groundTint: [0xd0502a, 0.3] },
      night: { sun: { color: 0xff5020, k: 0.3, elev: 0.4 }, hemi: [0x6a2a20, 0x0a0608, 0.55], sky: [0x0a0606, 0x3a120c, 0x140808], fog: [40, 180],
        dome: { top: 0x080404, mid: 0x200a08, hor: 0x5a1a0c, gnd: 0x0a0404, cldL: 0x3a140c, cldS: 0x100404, cover: 0.4, sun: false, shade: 0, mode: 2 }, actor: { lift: [0.30, 0.10, 0.06], key: [0.22, 0.08, 0.04] }, groundTint: [0xff4a10, 0.18], swap: { swarm: 'night' } }
    }
  }
};
export const MAP_IDS = Object.keys(THEMES);
// the theme for a map at a stage: the map entry with that stage's time of day merged on top
export function themeFor(mapId, stage) {
  const M = THEMES[mapId] || THEMES.desert, time = TIMES[Math.max(0, Math.min(2, stage | 0))], T = M.times[time];
  return Object.assign({}, M, { time, now: T, cast: T.swap && T.swap.swarm === 'night' ? Object.assign({}, M.enemies, M.enemies.night) : M.enemies });
}
