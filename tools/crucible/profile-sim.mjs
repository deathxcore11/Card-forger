// Plays one profile through many runs with the scripted player and prints what each run unlocked.
//   CRUCIBLE_CFG='{...}' node tools/crucible/profile-sim.mjs [profiles] [runs] [level]
import { loadDb } from '../../crucible/engine/cards.mjs';
import { newRun } from '../../crucible/engine/run.mjs';
import { playRun } from '../../crucible/engine/policy.mjs';
import { newProfile, applyRun, lockedRelics, VAULT, buy } from '../../crucible/engine/meta.mjs';
const db = loadDb();
const [profiles = 200, runs = 10, level = 2] = process.argv.slice(2).map(Number);
const newIn = Array.from({ length: runs }, () => 0), kinds = Array.from({ length: runs }, () => ({})), mem = Array.from({ length: runs }, () => 0), clears = Array.from({ length: runs }, () => 0);
let firstGift = 0, allGifts = 0, nAll = 0;
for (let p = 0; p < profiles; p++) {
  const P = newProfile(); let gotFirst = false, gotAll = false;
  for (let r = 0; r < runs; r++) {
    const forger = P.forgers[(p + r) % P.forgers.length];
    const run = playRun(db, newRun(db, { seed: 100000 + p * 100 + r, forger, locked: lockedRelics(P), featured: P.fresh, track: true }), { level });
    P.fresh = P.fresh.filter(id => !run.gifts.includes(id)); // seen in an offer or not, it is no longer new after one run
    const got = applyRun(P, run);
    let fresh = got.unlocks.length;
    const item = VAULT.find(v => !P.bought.includes(v.id) && v.price <= P.memories); if (item) { buy(P, item.id); fresh++; kinds[r].vault = (kinds[r].vault || 0) + 1; }
    for (const u of got.unlocks) kinds[r][u.kind] = (kinds[r][u.kind] || 0) + 1;
    if (fresh) newIn[r]++; mem[r] += got.total; if (run.result.won) clears[r]++;
    if (!gotFirst && P.featsDone.length) { gotFirst = true; firstGift += r + 1; }
    if (!gotAll && P.featsDone.length === 3) { gotAll = true; allGifts += r + 1; nAll++; }
  }
}
const pct = n => Math.round(1000 * n / profiles) / 10;
console.log('run | something new % | clear % | Memories | what');
for (let r = 0; r < runs; r++) console.log(String(r + 1).padStart(3), '|', String(pct(newIn[r])).padStart(5), '|', String(pct(clears[r])).padStart(5), '|', String(Math.round(mem[r] / profiles)).padStart(4), '|', JSON.stringify(kinds[r]));
console.log('first feat Gift on run', Math.round(100 * firstGift / profiles) / 100, '(mean); all three by run', Math.round(100 * allGifts / Math.max(1, nAll)) / 100, 'in', pct(nAll) + '% of profiles');
