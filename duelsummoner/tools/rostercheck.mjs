// Roster balance check, from the data alone (the effects are not built in the sim yet, so no bot can play them): every entry spends exactly its points,
// meets its job floor, stays under its rarity cap; rarity never changes power; and the plan's one hard target that the budget alone can answer:
// "nothing kills a gate boss in under 20 seconds before Overtime" (a full field of the strongest form at each tier against the gate boss's health at 8:00 on Medium).
// The win-rate targets (no synergy clears Stage 3 one time in three, a built engine four in five) need the effects in the sim: reported as not assessed.
//   node tools/rostercheck.mjs
import { ROSTER, BUDGET, DIALS, statsOf, dialsOf, RULES, standIns, missingParents, notBuilt, FAMILIES } from '../src/data/roster.js';
import { SPECIALS } from '../src/data/enemies.js';
const out = { entries: 0, spendErrors: [], floorErrors: [], capErrors: [], byRarity: {}, byJob: {}, gateBoss: {}, notAssessed: ['win rate with no synergy (target 1 in 3 clears Stage 3 on Medium)', 'win rate with a built engine (target 4 in 5)'] };
for (const e of Object.values(ROSTER)) e.forms.forEach((f, i) => {
  out.entries++; const d = dialsOf(f.points, e.job, e.rarity, !!e.familyTrait), sum = DIALS.reduce((a, k) => a + d[k], 0) + (e.familyTrait ? BUDGET.trait * f.points / 100 : 0), per = f.points / 100;
  if (Math.abs(sum - f.points) > 0.5) out.spendErrors.push(e.id + ' form ' + (i + 1) + ': ' + sum.toFixed(1) + ' of ' + f.points);
  const [fd, fv] = BUDGET.floors[e.job]; if (d[fd] + 1e-6 < Math.min(fv, BUDGET.caps[e.rarity]) * per) out.floorErrors.push(e.id + ' ' + fd + ' ' + d[fd]);
  for (const k of DIALS) if (d[k] > BUDGET.caps[e.rarity] * per + 1e-6) out.capErrors.push(e.id + ' ' + k + ' ' + d[k]);
  if (e.kind === 'basic' && i === 2) { const s = statsOf(e.id, 2), dps = s.dmg / s.cd; (out.byRarity[e.rarity] = out.byRarity[e.rarity] || []).push(f.points); (out.byJob[e.job] = out.byJob[e.job] || []).push(dps); }
});
const avg = a => +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
out.byRarity = Object.fromEntries(Object.entries(out.byRarity).map(([k, v]) => [k, { n: v.length, meanPoints: avg(v) }]));
out.byJob = Object.fromEntries(Object.entries(out.byJob).map(([k, v]) => [k, { n: v.length, meanDps: avg(v), maxDps: +Math.max(...v).toFixed(2) }]));
// the gate boss at 8:00 on Medium: base health times the stage curve's multiplier there (read from the sim's own numbers would need a run; this uses the 8:00 Medium value the golden trace shows, about 2.0)
const bossHp = SPECIALS.pharaoh.hp * 2.0;
for (const kind of ['basic', 'fusion', 'god', 'secret']) { const best = Object.values(ROSTER).filter(e => e.kind === kind).map(e => { const s = statsOf(e.id, e.forms.length - 1); return s.dmg / s.cd; }).sort((a, b) => b - a).slice(0, RULES.monsterZones), dps = best.reduce((a, b) => a + b, 0);
  out.gateBoss[kind] = { fieldDps: +dps.toFixed(1), secondsToKill: +(bossHp / dps).toFixed(1), meetsTarget: bossHp / dps >= 20 }; }
out.gateBoss.note = 'budget model only: one dial point of damage buys ' + BUDGET.units.damage + ' damage a hit; the sim does not read these stats yet';
out.standIns = standIns().length; out.missingParents = missingParents(); out.notBuilt = notBuilt().length; out.families = FAMILIES.length;
console.log(JSON.stringify(out, null, 1));
