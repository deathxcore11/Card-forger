// The exit door of the big desert as it is drawn: the same standing gateway the first open map had (plinth, two pillars, lintel, crest, carved seal), built when the door rises, sunk into the ground and lifted out of it over a few seconds. No beam.
import { Builder } from './mapMesh.js';
import { addDressing } from './openDressing.js';
const T = window.THREE, HEIGHT = 11;
export function buildDoor(map, x, z, fromX, fromZ) {
  const D = new Builder(); addDressing(D, { dress: {}, blocks: [], gate: { x, z }, spawn: { x: fromX, z: fromZ }, far: {}, viewFn: map.viewFn, dune: map.dune }, () => true);
  const m = D.mesh(false, undefined), g = new T.Group(); g.add(m); g.userData.rise = t => { const k = Math.max(0, Math.min(1, t / 5)), e = 1 - (1 - k) * (1 - k) * (1 - k); g.position.y = -HEIGHT * (1 - e) + (k < 1 ? Math.sin(t * 40) * 0.05 * (1 - k) : 0); g.visible = true; }; g.userData.rise(0);
  return g;
}
