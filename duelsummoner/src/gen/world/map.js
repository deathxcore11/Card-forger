// The map object the game reads for the big desert. It looks like the first open map (spawn, gate, arena, sleepers, encounters, bossRings, dune) but the land itself is never held whole:
// heights come from fillSim in 64 m chunks (sim/terrain.js), the ground the view draws from viewFn, and the things placed in each 256 m cell are handed over as the duelist nears them (sim/stream.js).
import { makeWorld, EDGE, WORLD_HALF, REGION, sq } from './world.js';
const r2 = v => Math.round(v * 100) / 100;
export function bigMap(seedLo, stageIndex) {
  const W = makeWorld(seedLo, stageIndex), seed = W.seed, key = 'big-' + seed.toString(16), gt = W.gate;
  const map = {
    key, hash: key, sealCode: 'BIG-' + seed.toString(16).slice(0, 4).toUpperCase(), stage: stageIndex, attempt: 0, fallback: false, half: 420, simN: 840, v2: true, open: true, big: true, arch: 'w', n: 840, off: 0, play: EDGE, edgeSeed: seed,
    prims: [], palette: undefined, stageName: 'The Open Desert', districts: [],
    spawn: { x: W.spawn.x, z: W.spawn.z }, gate: { x: gt.x, z: gt.z, radius: 5.5, guide: { far: 340, mid: 190, near: 60 } }, arena: { center: { x: gt.x, z: gt.z }, boss: { x: r2(gt.x + 9), z: gt.z }, tollPull: { x: r2(gt.x + 6), z: gt.z } },
    bossRings: [], encounters: W.freeChest ? [{ type: 'cchest', x: r2(W.freeChest.x), z: r2(W.freeChest.z), y: r2(W.viewAt(W.freeChest.x, W.freeChest.z)), free: true }] : [], landmarks: [], kits: [], rooms: [], roomOf: null, gateways: [],
    clearings: [], groves: [], paths: [], dune: { wind: W.wind }, startYaw: W.startYaw, sleepers: W.sleepers.map(q => ({ role: q.role, x: q.x, z: q.z })),
    blocks: [], ruins: [], dress: {}, solid: [], far: { rocks: [], dead: [], ruins: [] }, _road: { main: [[9000, 9000], [9001, 9001]], trails: [], width: 4.5, trailWidth: 3 }, _pools: [],
    report: { genVersion: 'big1', v2: true, attempt: 0, fallback: false, big: true },
    world: W, viewFn: W.viewAt, fillSim: W.fillSim, dressCell: W.dressCell, cell: W.cell, landmark: W.landmark, regionAt: W.regionAt, tintAt: W.tintAt, baseH: W.baseH, inside: W.inside,
    outer: (x, z) => sq(sq(x * x * x * x + z * z * z * z)) > EDGE + 220,
    worldHalf: WORLD_HALF, regionName: (x, z) => REGION[W.regionAt(x, z).type],
  };
  return map;
}
