// Plays one profile through many runs with the scripted player and prints what each run unlocked.
//   CRUCIBLE_CFG='{...}' node tools/crucible/profile-sim.mjs [profiles] [runs] [level] [climb] [long] [buyAll]
// climb 1: each run is played at the highest Heat the profile has open (use with the heatRules lever).
// long 1: the long road of engine/meta.mjs (kits, Enchants, per-Forger Heat, three more feats). Put its three Gifts in labPool.
// buyAll 1: after each run buy everything affordable, cheapest first (a person); 0 buys one thing a run.
import { loadDb } from '../../crucible/engine/cards.mjs';
import { newRun } from '../../crucible/engine/run.mjs';
import { playRun } from '../../crucible/engine/policy.mjs';
import { newProfile, applyRun, maxHeat, VAULT, VAULT_ENCHANTS, buy, runOptions, featList } from '../../crucible/engine/meta.mjs';
const db = loadDb();
const [profiles = 200, runs = 10, level = 2, climb = 0, long = 0, buyAll = 0] = process.argv.slice(2).map(Number);
const SHOP = (long ? VAULT.map(v => ({ ...v, key: v.id })).concat(VAULT_ENCHANTS) : VAULT.map(v => ({ ...v, key: v.id }))).sort((a, b) => a.price - b.price), NF = featList(!!long).length;
const lastNew = [], feat = {};
const newIn = Array.from({ length: runs }, () => 0), kinds = Array.from({ length: runs }, () => ({})), mem = Array.from({ length: runs }, () => 0), clears = Array.from({ length: runs }, () => 0);
let firstGift = 0, allGifts = 0, nAll = 0; const heatAfter = Array.from({ length: runs }, () => 0), topHeat = {};
for (let p = 0; p < profiles; p++) {
  const P = newProfile(); let gotFirst = false, gotAll = false;
  for (let r = 0; r < runs; r++) {
    const forger = P.forgers[(p + r) % P.forgers.length];
    const run = playRun(db, newRun(db, { seed: 100000 + p * 100 + r, heat: climb ? maxHeat(P, forger, !!long) : 0, forger, ...runOptions(P, forger, !!long) }), { level });
    P.fresh = P.fresh.filter(id => !run.gifts.includes(id)); // seen in an offer or not, it is no longer new after one run
    const got = applyRun(P, run, { long: !!long });
    let fresh = got.unlocks.length;
    for (;;) { const item = SHOP.find(v => !P.bought.includes(v.key) && v.price <= P.memories); if (!item) break; buy(P, item.key); fresh++; const kd = item.id === item.key ? 'vault' : 'enchant'; kinds[r][kd] = (kinds[r][kd] || 0) + 1; if (!buyAll) break; }
    for (const f of got.feats) if (f.done) (feat[f.id] = feat[f.id] || []).push(r + 1);
    if (fresh) lastNew[p] = r + 1;
    for (const u of got.unlocks) kinds[r][u.kind] = (kinds[r][u.kind] || 0) + 1;
    if (fresh) newIn[r]++; mem[r] += got.total; if (run.result.won) clears[r]++;
    heatAfter[r] += long ? P.forgers.reduce((n, f) => n + maxHeat(P, f, true), 0) / P.forgers.length : maxHeat(P);
    if (!gotFirst && P.featsDone.length) { gotFirst = true; firstGift += r + 1; }
    if (!gotAll && P.featsDone.length === NF) { gotAll = true; allGifts += r + 1; nAll++; }
  }
  { const k = P.heatCleared >= 10 ? "cleared 10" : "open " + maxHeat(P); topHeat[k] = (topHeat[k] || 0) + 1; }
}
const pct = n => Math.round(1000 * n / profiles) / 10;
console.log('run | something new % | clear % | Memories | what');
for (let r = 0; r < runs; r++) console.log(String(r + 1).padStart(3), '|', String(pct(newIn[r])).padStart(5), '|', String(pct(clears[r])).padStart(5), '|', String(Math.round(mem[r] / profiles)).padStart(4), '|', climb ? 'Heat open ' + (heatAfter[r] / profiles).toFixed(1) + ' |' : '', JSON.stringify(kinds[r]));
console.log('feats done (mean run, % of profiles):', Object.entries(feat).map(([k, v]) => k + ' ' + (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) + ' ' + pct(v.length) + '%').join('; '));
console.log('last run with something new (mean)', (lastNew.reduce((a, b) => a + (b || 0), 0) / profiles).toFixed(1));
console.log('first feat Gift on run', Math.round(100 * firstGift / profiles) / 100, '(mean); all ' + NF + ' by run', Math.round(100 * allGifts / Math.max(1, nAll)) / 100, 'in', pct(nAll) + '% of profiles');
if (climb) console.log('highest Heat open after', runs, 'runs (level: profiles)', JSON.stringify(topHeat));
