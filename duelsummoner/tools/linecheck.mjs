// Ride-line check for the big desert: over many seeds and cells, how many ride lines each pocket gets, how long they are, whether each gap between beams is an easy ollie,
// whether a beam passes through something solid, and how many seal-stone sets come out whole (all five stones placed).
//   node tools/linecheck.mjs [seeds=20] [cells=40]
import { makeWorld } from '../src/gen/world/world.js';
const [NS, NC] = [+process.argv[2] || 20, +process.argv[3] || 40];
let pockets = 0, lines = 0, beams = 0, gapBad = 0, solidHit = 0, sets = 0, whole = 0, short = 0; const lens = {};
for (let s = 0; s < NS; s++) {
  const W = makeWorld(1000 + s * 7919, 0);
  for (let c = 0; c < NC; c++) {
    const qx = ((s * 31 + c * 17) % 40) - 20, qz = ((s * 13 + c * 29) % 40) - 20, C = W.cell(qx, qz), D = W.dressCell(qx, qz);
    pockets += (C.pockets || []).length;
    const L = D.logs.filter(q => q[7] === 3); beams += L.length;
    // chain the beams: a beam starts a new line when its start is not within 6 m of the previous beam's end
    let run = 0; for (let i = 0; i < L.length; i++) { const p = L[i - 1], q = L[i]; const gap = p ? Math.hypot(q[0] - p[3], q[2] - p[5]) : 99; if (gap < 6) { run++; if (gap > 5.5 || q[1] - p[4] > 2) gapBad++; } else { if (run) { lines++; lens[run] = (lens[run] || 0) + 1; if (run < 2) short++; } run = 1; } }
    if (run) { lines++; lens[run] = (lens[run] || 0) + 1; if (run < 2) short++; }
    for (const q of L) for (const o of D.solid) { const ax = q[0], az = q[2], bx = q[3], bz = q[5], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz, t = Math.max(0, Math.min(1, ((o[0] - ax) * dx + (o[2] - az) * dz) / l2)), ex = ax + dx * t - o[0], ez = az + dz * t - o[2]; if (ex * ex + ez * ez < (o[3] + 0.4) ** 2) { solidHit++; break; } }
    const by = {}; for (const q of D.seals || []) by[q[3]] = (by[q[3]] || 0) + 1; for (const k in by) { sets++; if (by[k] === 5) whole++; }
  }
}
console.log(JSON.stringify({ seeds: NS, cells: NS * NC, pockets, lines, beams, linesPerPocket: +(lines / Math.max(1, pockets)).toFixed(2), lineLengths: lens, oneBeamLines: short, badGaps: gapBad, beamsThroughSolids: solidHit, sealSets: sets, wholeSets: whole }));
