// One table for how big everything is. Heights are in metres, the duelist is the 1.8 m reference. Every model's size and every
// big creature's hit and contact radius come from here (nothing per-model in the view). Edit a number here and both the model and the
// sim follow. Sizes are stylised: chunky and readable from the gameplay camera, not realistic.
export const DUELIST_H = 1.8;
const M = ratio => Math.round(ratio * DUELIST_H * 100) / 100;      // a share of the duelist's height, in metres

export const SCALE = {
  duelist: DUELIST_H,
  // swarm: 0.6 to 1.0 of the duelist. h = visual height, r = hit and contact radius.
  swarm: {
    husk: { h: 1.7, r: 0.7 }, runner: { h: 1.1, r: 0.55 }, seer: { h: 1.8, r: 0.7 }, golem: { h: 1.8, r: 1.0 },
    bloat: { h: 1.4, r: 0.9 }, scarab: { h: 1.1, r: 0.5 }, hunter: { h: 1.7, r: 0.8 }
  },
  // summons by form (largest dimension): form 1 / 2 / 3 = 0.5x / 1x / 2x the duelist; Fusions 2x to 3x; God Fusions 4x
  summonForm: [M(0.5), M(1), M(2)],
  fusionForm: [M(2), M(2.5), M(3)],
  godForm: [M(4)],
  // elites (1.5x to 2x) and timed bosses (3x to 5x) and gate bosses (6x to 10x), by event id (data/stages.js)
  special: {
    captain: { h: M(1.7) }, herald: { h: M(1.7) }, jailer: { h: M(1.8) }, executioner: { h: M(2) },
    warden: { h: M(3.4) }, coffins: { h: M(4.2) }, masks: { h: M(4.5) },
    idols: { h: M(3) }, mirror: { h: M(3.5) }, heir: { h: M(4) },
    arbiter: { h: M(6.7) }, weaver: { h: M(8.3) }, king: { h: M(10) }
  },
  // height of the stand-in meshes at scale 1 (so a bigger boss is the same shape scaled up) and the share of height used as hit radius
  engineRef: { warden: 3.9, idol: 2.3, pharaoh: 5.9 },
  hitShare: 0.28,
  walkRadiusCap: 2.2,        // terrain collision radius never exceeds this, so a big boss still fits the arena
  rangeCap: 1.6,             // slams, reach and blades grow with size, up to this factor
  shade: { h: M(1.8) },                                   // a Toll Shade: tall, hooded, with a bell
  // things the duelist reads from the camera: made larger than life
  chest: 1.5, pickup: 1.5, npc: DUELIST_H
};

// size in metres of a summon at a given form (0..2); fusion = a Fusion tier monster
export const summonSize = (fusion, form) => (fusion ? SCALE.fusionForm : SCALE.summonForm)[Math.min(form, 2)];
// size, hit radius and range factor of a stage event or the gate boss, with the engine (warden / idol / pharaoh) that plays it
export function specialSize(id, engine) {
  const e = SCALE.special[id], h = e ? e.h : SCALE.engineRef[engine === 'idols' ? 'idol' : engine];
  const ref = SCALE.engineRef[engine === 'idols' ? 'idol' : engine];
  return { h, radius: Math.max(0.6, h * SCALE.hitShare), k: h / ref, kr: Math.min(h / ref, SCALE.rangeCap) };
}
