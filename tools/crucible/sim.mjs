// Headless simulator for Lost Memories (codename crucible).
//   node tools/crucible/sim.mjs --runs 2000 --seed 1 --family furnace --level 2 --heat 0 [--csv out.csv] [--json out.json]
// Plays whole runs with a scripted player and prints the balance numbers.
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import os from 'node:os';
import fs from 'node:fs';
import { loadDb } from '../../crucible/engine/cards.mjs';
import { newRun } from '../../crucible/engine/run.mjs';
import { playRun } from '../../crucible/engine/policy.mjs';

function one(db, seed, opts) {
  const run = playRun(db, newRun(db, { seed, heat: opts.heat, forger: opts.forger || null }), opts);
  const S = run.stats;
  return {
    seed, won: run.result.won ? 1 : 0, floor: run.result.won ? 3 : run.floor, chamber: run.chamber, bossWins: S.bossWins,
    duels: S.duels, wins: S.wins, turns: S.turns, melds: S.melds, fizzles: S.fizzles, capDuels: S.capHits,
    firstWins: S.firstWins, deckouts: S.deckouts, twoFam: S.familiesInDuel, bounties: S.bounties, kitRejects: S.kitRejects,
    sparks: run.sparks, embers: run.embers, binds: run.binds, level: run.level,
    relics: [...run.charms, ...run.gifts, ...run.masterworks], ranks: S.ranks, fires: S.relicFires, doors: S.doors, byTier: S.byTier, fx: S.fx || null, comebacks: S.comebacks, leadChanges: S.leadChanges, trailedWins: S.trailedWins, closeWins: S.closeWins, traps: S.traps, defWins: S.defWins, lpLost: S.lpLostInWins, chains: S.chains, singles: S.singles, long: S.long, reasons: S.reasons, gifts: run.gifts.length + run.masterworks.length, points: S.points || [], bountyBy: S.bountyBy || {}, deckSize: run.deck.length,
  };
}

if (!isMainThread) {
  const db = loadDb();
  const out = [];
  for (const seed of workerData.seeds) {
    try { out.push(one(db, seed, workerData.opts)); } catch (e) { out.push({ seed, error: String(e && e.stack || e) }); }
  }
  parentPort.postMessage(out);
} else {
  const args = process.argv.slice(2);
  const arg = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
  const runs = +arg('--runs', 500), seed0 = +arg('--seed', 1);
  const opts = { family: arg('--family', 'neutral'), level: +arg('--level', 2), heat: +arg('--heat', 0), forger: arg('--forger', null) };
  const threads = Math.min(+arg('--threads', os.cpus().length), runs);
  const seeds = Array.from({ length: runs }, (_, i) => seed0 + i);
  const chunks = Array.from({ length: threads }, (_, t) => seeds.filter((_, i) => i % threads === t));
  const t0 = Date.now();
  const parts = await Promise.all(chunks.map(c => new Promise((res, rej) => { const w = new Worker(new URL(import.meta.url), { workerData: { seeds: c, opts } }); w.on('message', res); w.on('error', rej); })));
  const rows = parts.flat().sort((a, b) => a.seed - b.seed);
  const errors = rows.filter(r => r.error);
  const ok = rows.filter(r => !r.error);
  const sum = f => ok.reduce((n, r) => n + f(r), 0);
  const pct = (a, b) => b ? Math.round(1000 * a / b) / 10 : 0;
  const duels = sum(r => r.duels);
  const relicIn = {}, relicWin = {}, fires = {}, ranks = {}, doors = {}, byTier = {}, chains = {}, reasons = {};
  for (const r of ok) {
    for (const id of r.relics) { relicIn[id] = (relicIn[id] || 0) + 1; if (r.won) relicWin[id] = (relicWin[id] || 0) + 1; }
    for (const [k, v] of Object.entries(r.fires)) fires[k] = (fires[k] || 0) + v;
    for (const [k, v] of Object.entries(r.ranks)) ranks[k] = (ranks[k] || 0) + v;
    for (const [k, v] of Object.entries(r.doors)) doors[k] = (doors[k] || 0) + v;
    for (const [k, v] of Object.entries(r.byTier)) { const b = byTier[k] || (byTier[k] = [0, 0, 0, 0, 0]); for (let i = 0; i < 5; i++) b[i] += v[i] || 0; }
    for (const [k, v] of Object.entries(r.chains)) chains[k] = (chains[k] || 0) + v;
    for (const [k, v] of Object.entries(r.reasons)) reasons[k] = (reasons[k] || 0) + v;
  }
  const wins = sum(r => r.won), duelWins = sum(r => r.wins);
  const summary = {
    opts, runs: ok.length, errors: errors.length, seconds: Math.round((Date.now() - t0) / 100) / 10,
    clearPct: pct(wins, ok.length),
    reachBoss1Pct: pct(ok.filter(r => r.floor > 0 || r.chamber >= 5).length, ok.length),
    beatBoss1Pct: pct(ok.filter(r => r.bossWins >= 1).length, ok.length),
    beatBoss2Pct: pct(ok.filter(r => r.bossWins >= 2).length, ok.length),
    duelsPerRun: Math.round(10 * duels / ok.length) / 10,
    duelWinPct: pct(duelWins, duels),
    avgDuelTurns: Math.round(10 * sum(r => r.turns) / duels) / 10,
    meldsPerDuel: Math.round(100 * sum(r => r.melds) / duels) / 100,
    fizzlesPerDuel: Math.round(100 * sum(r => r.fizzles) / duels) / 100,
    firstPlayerWinPct: pct(sum(r => r.firstWins), duels),
    deckoutPct: pct(sum(r => r.deckouts), duels),
    capDuelPct: pct(sum(r => r.capDuels), duels),
    twoFamilyDuelPct: pct(sum(r => r.twoFam), duels),
    bountyPct: pct(sum(r => r.bounties), duelWins),
    sRankPctOfWins: pct(ranks.S || 0, duelWins),
    leadChangesPerDuel: Math.round(100 * sum(r => r.leadChanges) / duels) / 100, wonAfterTrailingOnBoardPct: pct(sum(r => r.trailedWins), duelWins),
    comebackPctOfWins: pct(sum(r => r.comebacks), duelWins), closeWinPct: pct(sum(r => r.closeWins), duelWins), avgLpLostInWins: Math.round(sum(r => r.lpLost) / duelWins), trapsPerDuel: Math.round(100 * sum(r => r.traps) / duels) / 100, defenderWinsPerDuel: Math.round(100 * sum(r => r.defWins) / duels) / 100,
    ranks, doors, reasons, pointPercentiles: (() => { const p = ok.flatMap(r => r.points).sort((a, b) => a - b); const q = x => p[Math.floor(x * (p.length - 1))]; return { p5: q(.05), p25: q(.25), p50: q(.5), p60: q(.6), p75: q(.75), p88: q(.88), p95: q(.95) }; })(),
    bounties: (() => { const o = {}; for (const r of ok) for (const [k, v] of Object.entries(r.bountyBy)) { o[k] = o[k] || [0, 0]; o[k][0] += v[0]; o[k][1] += v[1]; } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, pct(v[1], v[0])])); })(),
    winPctByTierFloor: Object.fromEntries(Object.entries(byTier).sort().map(([k, v]) => [k, pct(v[1], v[0]) + '% of ' + v[0] + ', LP lost in a win ' + Math.round(v[2] / Math.max(1, v[1])) + ', came from behind ' + pct(v[3], v[1]) + '%, turns ' + Math.round(10 * v[4] / v[0]) / 10])),
    plays: { single: sum(r => r.singles), ...chains }, longDuelPct: pct(sum(r => r.long), duels), giftsPerRun: Math.round(10 * sum(r => r.gifts) / ok.length) / 10,
    diedOn: { floor1: pct(ok.filter(r => !r.won && r.floor === 0).length, ok.length), floor2: pct(ok.filter(r => !r.won && r.floor === 1).length, ok.length), floor3: pct(ok.filter(r => !r.won && r.floor === 2).length, ok.length) },
    usedPerDuel: (() => { const o = [{}, {}]; for (const r of ok) if (r.fx) for (const i of [0, 1]) for (const [k, v] of Object.entries(r.fx[i])) o[i][k] = (o[i][k] || 0) + v; const f = x => Object.fromEntries(Object.entries(x).sort().map(([k, v]) => [k, Math.round(100 * v / duels) / 100])); return { you: f(o[0]), rival: f(o[1]) }; })(),
    kitRejectsPerRun: Math.round(100 * sum(r => r.kitRejects) / ok.length) / 100,
    relicShareOfWinningBuilds: Object.fromEntries(Object.entries(relicWin).map(([k, v]) => [k, pct(v, wins)]).sort((a, b) => b[1] - a[1])),
    relicHeld: relicIn, relicFires: fires,
  };
  if (args.includes('--brief')) { delete summary.relicHeld; delete summary.relicFires; delete summary.relicShareOfWinningBuilds; delete summary.doors; }
  console.log(JSON.stringify(summary, null, 1));
  if (errors.length) console.log('FIRST ERROR', errors[0]);
  const csv = arg('--csv');
  if (csv) fs.writeFileSync(csv, 'seed,won,floor,chamber,bossWins,duels,wins,turns,melds,fizzles,sparks,embers,binds,level,relics\n' + ok.map(r => [r.seed, r.won, r.floor, r.chamber, r.bossWins, r.duels, r.wins, r.turns, r.melds, r.fizzles, r.sparks, r.embers, r.binds, r.level, r.relics.join(' ')].join(',')).join('\n') + '\n');
  const js = arg('--json'); if (js) fs.writeFileSync(js, JSON.stringify(summary, null, 1));
}
