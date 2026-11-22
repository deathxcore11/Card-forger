// How often the scripted player earns each Lost Memories achievement (engine/achievements.mjs).
//   node tools/crucible/ach-sim.mjs [--profiles 200] [--runs 15] [--level 2] [--labs five,lean,heat,kits,items,secret] [--mix 1] [--climb 1] [--threads n]
// Each profile plays its runs one after another with the page's default Lab switches (plus Rumours, unless --labs
// says otherwise), at the highest Heat it has open (--climb 0: always Heat 0), with each Forger it has in turn, and
// buys whatever the Vault sells once it can pay. achCheck runs after every action and after each run is banked.
// --mix 1 gives each run a few choices the scripted player never makes by itself, drawn from the run's seed: pay to
// see an Omen card and leave it, take the cap at a Sanctum on the last Spark, turn down every Gift, walk past the
// door that was not there, and keep one monster against guardians to find that door.
// Two numbers per row: the share of profiles that earned it by their last run (and the mean run it came on), and the
// share of runs in which the run itself met the row, judged on a copy of the profile with no achievements yet.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import { readFileSync } from 'node:fs';
import { buildDb } from '../../crucible/engine/cards.mjs';
import { newRun, runApply } from '../../crucible/engine/run.mjs';
import { policyAction } from '../../crucible/engine/policy.mjs';
import { Rng } from '../../crucible/engine/rng.mjs';
import { newProfile, applyRun, maxHeat, runOptions, buy, VAULT } from '../../crucible/engine/meta.mjs';
import { ACH, achCheck, achList } from '../../crucible/engine/achievements.mjs';
import { labConfig, LAB_DEFAULTS } from '../../crucible/web/labs.mjs';

const read = f => JSON.parse(readFileSync(new URL('../../crucible/data/' + f, import.meta.url), 'utf8'));
const makeDb = labs => buildDb(read('crucible-pool.json'), read('crucible-spell-tags.json'), { ...read('crucible-config.json'), ...labConfig(labs) });

// The scripted player, with this run's own choices laid over it.
function move(db, run, q) {
  const o = run.offer;
  if (run.phase === 'reward' && o) {
    if (o.kind === 'omen' && q.peek) { if (!o.seen && run.embers >= 30) return { t: 'pick', i: 1 }; if (o.seen) return { t: 'skip' }; }
    if (o.kind === 'sanctum' && q.cap && run.sparks === 1) return { t: 'pick', i: 1 };
    if (o.kind === 'gift' && q.giftless) return { t: 'skip' };
  }
  if (run.phase === 'chamber' && q.walk && run.doors.some(d => d.type === 'secret')) return { t: 'door', i: run.doors.findIndex(d => d.type === 'onward') };
  return policyAction(db, run, { level: q.level, family: q.family, lone: run.forger === 'last' ? 'last' : q.lone ? 'boss' : null });
}

function profileRun(db, pIdx, opts) {
  const P = newProfile(), earnedAt = {}, metRuns = {}, FAM = ['neutral', 'furnace', 'shadow', 'storm', 'tomb', 'lean'];
  let clears = 0, runs = 0;
  for (let r = 0; r < opts.runs; r++) {
    const seed = 700000 + pIdx * 1000 + r, x = Rng.fromSeed(seed * 7 + 3);
    const q = { level: opts.level, family: FAM[(pIdx + r) % FAM.length], peek: opts.mix && x.chance(1, 4), cap: opts.mix && x.chance(1, 3), giftless: opts.mix && x.chance(1, 8), walk: opts.mix && x.chance(1, 3), lone: opts.mix && x.chance(1, 4) };
    const forger = P.forgers[(pIdx + r) % P.forgers.length];
    const run = newRun(db, { seed, heat: opts.climb ? maxHeat(P) : 0, forger, ...runOptions(P, forger, false), uid: 'p' + pIdx + 'r' + r });
    const Q = JSON.parse(JSON.stringify(P)); Q.ach = []; Q.achAt = {};
    const note = ids => { for (const id of ids) if (earnedAt[id] == null) earnedAt[id] = r + 1; };
    let guard = 0;
    while (run.phase !== 'over' && guard++ < 200000) {
      runApply(run, move(db, run, q), db);
      note(achCheck(db, P, run)); achCheck(db, Q, run);
    }
    P.fresh = P.fresh.filter(id => !run.gifts.includes(id));
    applyRun(P, run); note(achCheck(db, P, run)); runs++; if (run.result.won) clears++;
    for (;;) { const v = VAULT.filter(v => !P.bought.includes(v.id) && v.price <= P.memories).sort((a, b) => a.price - b.price)[0]; if (!v) break; buy(P, v.id); note(achCheck(db, P, null)); }
    for (const id of Q.ach) metRuns[id] = (metRuns[id] || 0) + 1;
  }
  return { earnedAt, metRuns, clears, runs, heat: P.heatCleared };
}

if (!isMainThread) {
  const db = makeDb(workerData.labs);
  parentPort.postMessage(workerData.profiles.map(i => profileRun(db, i, workerData.opts)));
} else {
  const args = process.argv.slice(2), arg = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
  const profiles = +arg('--profiles', 200), opts = { runs: +arg('--runs', 15), level: +arg('--level', 2), mix: +arg('--mix', 1), climb: +arg('--climb', 1) };
  const labs = Object.fromEntries((arg('--labs', null) || Object.keys(LAB_DEFAULTS).concat('secret').join(',')).split(',').filter(Boolean).map(k => [k, true]));
  const threads = Math.max(1, Math.min(+arg('--threads', os.cpus().length), profiles)), t0 = Date.now();
  const ids = Array.from({ length: profiles }, (_, i) => i), chunks = Array.from({ length: threads }, (_, t) => ids.filter(i => i % threads === t));
  const parts = await Promise.all(chunks.map(c => new Promise((res, rej) => { const w = new Worker(new URL(import.meta.url), { workerData: { profiles: c, opts, labs } }); w.on('message', res); w.on('error', rej); })));
  const rows = parts.flat(), runs = rows.reduce((n, r) => n + r.runs, 0), clears = rows.reduce((n, r) => n + r.clears, 0);
  const db = makeDb(labs), openIds = new Set(achList(db).map(r => r.id)), pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0').padStart(5);
  console.log(`ach-sim: ${profiles} profiles x ${opts.runs} runs = ${runs} tracked runs, ${(100 * clears / runs).toFixed(1)}% cleared, level ${opts.level}, mix ${opts.mix}, climb ${opts.climb}, labs ${Object.keys(labs).join(',')}, ${Math.round((Date.now() - t0) / 1000)} s`);
  console.log('row                        tier      profiles% (mean run)   runs met%   runs met');
  for (const r of ACH) {
    if (!openIds.has(r.id)) { console.log(r.id.padEnd(26), r.tier.padEnd(9), '  closed under these switches'); continue; }
    const got = rows.filter(x => x.earnedAt[r.id] != null), mean = got.length ? (got.reduce((n, x) => n + x.earnedAt[r.id], 0) / got.length).toFixed(1) : '-';
    const met = rows.reduce((n, x) => n + (x.metRuns[r.id] || 0), 0);
    console.log(r.id.padEnd(26), r.tier.padEnd(9), pct(got.length, profiles), ('(' + mean + ')').padEnd(10), '   ', pct(met, runs), '    ', String(met).padStart(6));
  }
  const heat = {}; for (const x of rows) heat[x.heat] = (heat[x.heat] || 0) + 1;
  console.log('highest Heat cleared per profile:', JSON.stringify(heat));
}
