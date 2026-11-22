// Reach table builder. The ONLY generator file allowed float maths (movement constants -> integer cm).
// Mirrors tools/gen-reach.mjs -> src/data/reach.json in the final layout.

export const MOVEMENT = { run: 9, jumpH: 2.2, g: 28, dash: { v: 26, t: 0.16, cd: 1.1 }, airJumps: 0 };
const SAFETY = 0.70;
const DH_ROWS = [150, 140, 100, 0, -150, -300, -600];

export function buildReach(mv = MOVEMENT) {
  const v0 = Math.sqrt(2 * mv.g * mv.jumpH);
  const tUp = v0 / mv.g;
  const dashGain = mv.dash.v * mv.dash.t - mv.run * mv.dash.t; // 4.16 - 1.44 = 2.72 m
  const T = (dh) => tUp + Math.sqrt(2 * (mv.jumpH - dh) / mv.g);
  const rows = DH_ROWS.map((dhcm) => {
    const dh = dhcm / 100;
    const jump = mv.run * T(dh);
    const row = { dh_cm: dhcm, g1_cm: Math.floor(SAFETY * jump * 100), g2_cm: Math.floor(SAFETY * (jump + dashGain) * 100) };
    if (dhcm === 0) row.g1Authored_cm = 450;
    return row;
  });
  return {
    safety: SAFETY, rows,
    hopReq_cm: [120, 150], hopOpt_cm: [160, 180], forbidden_cm: [181, 259], tier_cm: 300,
    walkPlayer_cmPerM: 70, walkEnemy_cmPerM: 60, ramp_cmPerM: 50, deckClear_cm: 450,
    padMin_cm: 300, dropPad_cm: 400, lipDepth_cm: 300, airMaxRise_cm: 360, airMaxGap_cm: 800,
  };
}

export const REACH = buildReach();

// Integer lookups (rows sorted by descending dh). Returns -1 if not jumpable (dh above the top row).
function interp(reach, dh, key) {
  const r = reach.rows;
  if (dh > r[0].dh_cm) return -1;
  if (dh <= r[r.length - 1].dh_cm) return r[r.length - 1][key];
  for (let i = 0; i < r.length - 1; i++) {
    const a = r[i], b = r[i + 1];
    if (dh <= a.dh_cm && dh >= b.dh_cm) {
      const span = a.dh_cm - b.dh_cm;
      return Math.floor((a[key] * (dh - b.dh_cm) + b[key] * (a.dh_cm - dh)) / span);
    }
  }
  return -1;
}
// Precomputed integer tables for dh in [-600, 150] cm, so gen code never touches the float formula.
const G1T = new Int16Array(751), G2T = new Int16Array(751);
for (let dh = -600; dh <= 150; dh++) { G1T[dh + 600] = interp(REACH, dh, 'g1_cm'); G2T[dh + 600] = interp(REACH, dh, 'g2_cm'); }
export const g1 = (dh) => (dh > 150 ? -1 : G1T[(dh < -600 ? -600 : dh) + 600]);
export const g2 = (dh) => (dh > 150 ? -1 : G2T[(dh < -600 ? -600 : dh) + 600]);
