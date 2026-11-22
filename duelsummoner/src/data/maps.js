// The fixed Buried Kingdom map as a "StageMap": what the classic mode and the generator's last-resort fallback use. Generated maps have the
// same shape (see src/gen), so the sim and the view treat them alike.
import { PRIMS, DISTRICTS } from './map.js';

export const CLASSIC_MAP = {
  key: 'classic', sealCode: null, stage: 0, attempt: 0, fallback: false, half: 200,
  prims: PRIMS, districts: DISTRICTS,
  spawn: { x: 0, z: 0 },
  gate: { x: 0, z: -57, radius: 5.5 },
  arena: { center: { x: 0, z: 0 }, boss: { x: 0, z: -12 }, tollPull: { x: 0, z: -2 } },
  bossRings: [], encounters: null, report: null
};
