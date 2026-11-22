// Headless run simulator: a bot plays whole runs in seconds so balance targets can be checked.
// Usage: node test/run-sim.mjs [runs] [duelist] [--god] [--focus] [--minutes N]
//   --god    the bot cannot die (isolates the pick and XP pacing from the bot's own skill)
//   --focus  the bot spends picks on one pair, then opens the Warden's sealed chest for the Fusion
// The bot kites and collects crystals; it is a rough player, so read survival numbers as a floor.
import { Game } from '../src/sim/game.js';
import { TARGETS, DUELISTS, LEVELS } from '../src/data/cards.js';
import { RUN } from '../src/data/waves.js';

const argv = process.argv.slice(2), flag = f => argv.includes(f), num = (f, d) => (argv.includes(f) ? Number(argv[argv.indexOf(f) + 1]) : d);
const pos = argv.filter(a => !a.startsWith('--') && isNaN(+a) === false);
const runs = Number(pos[0] || 8), duelist = argv.find(a => DUELISTS[a]) || 'kael', GOD = flag('--god'), FOCUS = flag('--focus'), MAXMIN = num('--minutes', 16);
const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };

function score(g, c) {
  const D = DUELISTS[g.field.duelist], pair = [D.start, D.second];
  if (c.kind === 'fusion') return 1000;
  const fused = g.field.monsters.some(m => m && !pair.includes(m.id) && (m.id === 'twinflare-tyrant' || m.id === 'astral-magus'));
  let s;
  if (c.kind === 'monster') {
    const m = g.field.monsters.find(x => x && x.id === c.id), isPair = pair.includes(c.id);
    if (FOCUS) s = isPair ? (c.isNew ? 90 : (m.level < 10 ? 85 : 20)) : fused ? (c.isNew ? 60 : 70) : 25;       // finish the pair, then grow the Fusion
    else s = c.isNew ? 60 : 40;
  } else if (c.kind === 'spell') s = ({ 'swift-draw': 50, 'collectors-eye': 48, 'kindling-rite': 45, 'deep-marks': 40, 'runners-sash': 35, 'heart-of-the-cards': 38 })[c.id] || 30;
  else if (c.kind === 'trap') s = 33; else s = c.id === 'second-wind' ? (g.p.hp < 40 ? 80 : 20) : 45;
  return s;
}

function play(seed) {
  const g = new Game(seed, { duelist }); g.god = GOD;
  const L = { lvAtMin: {}, firstFusion: null, secondFusion: null, wardenSeen: null, peak: 0, pairAt10: null };
  let tick = 0, cmd = { ...idle }, dashAt = -9;
  while (!g.over && g.t < MAXMIN * 60) {
    if (g.offer) {
      const o = g.offer; if (o.type === 'fusion') { g.choose(0); continue; }
      let best = 0, bs = -1; o.cards.forEach((c, i) => { const s = score(g, c); if (s > bs) { bs = s; best = i; } }); g.choose(best); continue;
    }
    if (tick % 6 === 0) {
      const p = g.p, e = g.en; let rx = 0, rz = 0, crowd = 0;
      for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = p.x - e.x[i], dz = p.z - e.z[i], d2 = dx * dx + dz * dz; if (d2 < 100) { const w = 1 / (d2 + 0.5); rx += dx * w; rz += dz * w; if (d2 < 6) crowd++; } }
      for (const sp of g.sp) if (sp.alive && !sp.dead) { const dx = p.x - sp.x, dz = p.z - sp.z, d2 = dx * dx + dz * dz; if (d2 < 150) { rx += dx / (d2 + 1) * 3; rz += dz / (d2 + 1) * 3; } }
      let ax = 0, az = 0, best = 400; const m = g.pick;
      for (let i = 0; i < m.max; i++) { if (!m.alive[i]) continue; const dx = m.x[i] - p.x, dz = m.z[i] - p.z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; ax = dx; az = dz; } }
      const al = Math.sqrt(ax * ax + az * az) || 1; ax /= al; az /= al;
      let cx = 0, cz = 0; const ch = g.chests.find(c => !c.open);
      if (ch) { cx = ch.x - p.x; cz = ch.z - p.z; const l = Math.sqrt(cx * cx + cz * cz) || 1; cx /= l; cz /= l; }
      let bx = 0, bz = 0; const w = g.sp.find(s => s.kind === 'warden' && s.alive);        // a decent player gets behind the Warden's shield
      if (w) { const tx = w.x - Math.sin(w.face) * 6 - p.x, tz = w.z - Math.cos(w.face) * 6 - p.z, l = Math.sqrt(tx * tx + tz * tz) || 1; bx = tx / l; bz = tz / l; }
      let dx = rx * 8 + ax * 0.6 + cx * (ch ? 1.5 : 0) + bx * 1.4 - p.x * 0.02, dz = rz * 8 + az * 0.6 + cz * (ch ? 1.5 : 0) + bz * 1.4 - p.z * 0.02;
      const dl = Math.sqrt(dx * dx + dz * dz) || 1; dx /= dl; dz /= dl;
      cmd = { f: -dz, r: dx, yaw: 0, jump: false, dash: crowd >= 3 && g.t - dashAt > 1.2, slide: false, use: !!(ch && Math.hypot(ch.x - p.x, ch.z - p.z) < 2.5) };
      if (cmd.dash) dashAt = g.t;
    } else cmd.dash = false;
    g.step(1 / 60, cmd); tick++;
    const min = Math.floor(g.t / 60); if (L.lvAtMin[min] === undefined) L.lvAtMin[min] = g.level;
    if (L.firstFusion === null && g.fusions > 0) L.firstFusion = Math.round(g.t);
    if (L.secondFusion === null && g.fusions > 1) L.secondFusion = Math.round(g.t);
    L.peak = Math.max(L.peak, g.enemyCount());
  }
  const D = DUELISTS[duelist];
  return { seed, end: g.over ? 'died' : 'alive at cap', t: Math.round(g.t), level: g.level, kills: g.kills, fusions: g.fusions, boss: g.boss.state, bossKilled: g.bossKilled, overtime: Math.round(g.overtimeSeconds()), otStep: g.otStep, dmgMul: +g.dmgMul.toFixed(1), ...L,
    pick: g.field.picks, field: g.field.monsters.filter(Boolean).map(m => m.id + ' L' + m.level).join(', ') };
}

const out = []; const t0 = Date.now();
for (let s = 1; s <= runs; s++) out.push(play(s));
const med = a => { const b = a.filter(x => x !== null && x !== undefined).sort((p, q) => p - q); return b.length ? b[Math.floor(b.length / 2)] : null; };
console.log(`mode: ${GOD ? 'god (cannot die)' : 'mortal'}, ${FOCUS ? 'focused pair' : 'spread picks'}, duelist ${duelist}, ${runs} runs, cap ${MAXMIN} min`);
for (const r of out) console.log(JSON.stringify({ seed: r.seed, end: r.end, t: r.t, level: r.level, kills: r.kills, picks: r.pick, fusions: r.fusions, firstFusion: r.firstFusion, bossKilled: r.bossKilled, overtime: r.overtime, otStep: r.otStep, field: r.field }));
console.log('--- summary');
console.log('level-ups by minute (median):', Array.from({ length: 9 }, (_, m) => `${m}:${med(out.map(r => r.lvAtMin[m]))}`).join('  '));
console.log('level targets by minute:        ' + TARGETS.levelAt.map(a => (a[0] / 60) + ':' + a[1]).join('  ') + '  (about ' + TARGETS.levelUpsByEnd + ' level-ups from the XP curve)');
const ff = out.map(r => r.firstFusion); console.log('first Fusion (s), median:', med(ff), ' reached in', ff.filter(x => x !== null).length + '/' + runs, ' target', TARGETS.firstFusionSeconds.join('-'));
console.log('second Fusion share:', (out.filter(r => r.secondFusion !== null).length / runs * 100).toFixed(0) + '%', ' target under', TARGETS.secondFusionShare * 100 + '%');
console.log('boss killed:', out.filter(r => r.bossKilled).length + '/' + runs, ' overtime survived (s) median:', med(out.map(r => r.overtime)), ' last step reached median:', med(out.map(r => r.otStep)));
console.log('overtime curve: hunter hp x' + RUN.overtime.hpGrowth + ' and damage x' + RUN.overtime.dmgGrowth + ' per 30 s; after 5 min hp x' + Math.pow(RUN.overtime.hpGrowth, 10).toFixed(1) + ', damage x' + Math.pow(RUN.overtime.dmgGrowth, 10).toFixed(1) + '; after 10 min hp x' + Math.pow(RUN.overtime.hpGrowth, 20).toFixed(0) + ', damage x' + Math.pow(RUN.overtime.dmgGrowth, 20).toFixed(1));
console.log('wall time', ((Date.now() - t0) / 1000).toFixed(1), 's');


