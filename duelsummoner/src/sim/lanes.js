// The big desert's ground under the feet (sim only, the big world only). Wind-swept flats (dry lake beds, and any ground flatter than 3 degrees in a dune sea or a mesa field when the wind blows along the run) are fast lanes, +8%;
// soft sand slows a CLIMB (a dune sea slope steeper than 9 degrees, -6%) and never the flat. Run speed on flat ground is never below the base 9 m/s. Long downhill slides keep their speed (friction is halved) and a hop chain's carried speed fades half as fast.
import { heightAt } from './terrain.js';
export const LANE = { fast: 0.08, soft: 0.06, flatSlope: 0.052, climbSlope: 0.16, slideFriction: 0.5, carry: 1.5 };
export function laneFactor(g, mx, mz) {
  const p = g.p, m = g.map; if (!m || !m.big) return 1;
  const h0 = heightAt(p.x, p.z), h1 = heightAt(p.x + mx * 2, p.z + mz * 2), s = (h1 - h0) / 2, type = m.regionAt(p.x, p.z).type;
  if (s > LANE.climbSlope && type === 0) return 1 - LANE.soft;
  if (s > -LANE.flatSlope && s < LANE.flatSlope && (type === 2 || type === 1)) return 1 + LANE.fast;
  return 1;
}
