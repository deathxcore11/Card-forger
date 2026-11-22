// Real-browser check for steps A, B and C: each enemy kind and its warning, the elites and the boss, level-up offers, the 4+4 field,
// Fusion through a sealed chest, overtime, gems, camera hiding, results. Saves screenshots. Usage: node test/browser-run.mjs [outDir]
import { launch, wait } from './cdp.mjs';

const b = await launch({ out: process.argv[2], query: '?debug' });
const H = `
const D = window.__ds, g = D.game, I = D.input, wait = ms => new Promise(r => setTimeout(r, ms));
const SP = await import('/src/sim/specials.js'), EN = await import('/src/sim/enemies.js'), FD = await import('/src/sim/field.js'), TR = await import('/src/sim/terrain.js');
const fresh = (duelist) => { D.freeze(false); if (duelist) D.pickDuelist(duelist); D.start(); g.god = true; g.spawnAcc = -1e9; g.golemT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.en.alive.fill(0); g.p.x = 0; g.p.z = 0; };
const still = async ms => { D.freeze(true); await wait(ms || 350); };
const auto = () => { let n = 0; while (g.offer && n++ < 20) { const o = g.offer; if (o.type === 'fusion') g.choose(0); else g.choose(0); } if (D.mode() === 'offer') D.setMode('play'); };
const place = (x, y, z) => { g.p.x = x; g.p.y = y; g.p.z = z; g.p.vx = g.p.vz = g.p.vy = 0; g.p.grounded = true; D.chase.reset(); };
`;
const R = {};
const run = async (name, body, shotName) => {
  try { R[name] = await b.evalIn('(async()=>{' + H + body + '})()'); } catch (e) { R[name] = { ERROR: String(e.message).slice(0, 400) }; console.log('FAILED', name, R[name].ERROR); return; }
  if (shotName) await b.shot(shotName);
};

// A. camera hides an enemy standing between the camera and the duelist
await run('camera_hides_blockers', `
  fresh(); g.field.monsters.fill(null); g.cardT = 1e9; D.chase.reset(); I.yaw = 0; await wait(300);
  const c = D.camera.position; const mid = { x: (c.x + g.p.x) / 2, z: (c.z + g.p.z) / 2 };
  EN.spawnEnemy(g, 'husk', mid); const far = EN.spawnEnemy(g, 'husk', { x: 6, z: -8 });
  for (let i = 0; i < g.en.max; i++) if (g.en.alive[i]) { g.en.spd[i] = 0; }
  const i0 = g.en.alive.findIndex(a => a === 1); g.en.x[i0] = g.en.px[i0] = mid.x; g.en.z[i0] = g.en.pz[i0] = mid.z;
  await wait(400); const alive = g.enemyCount(), drawn = D.actors.kinds[0].body.count;
  return { aliveHusks: alive, drawnHusks: drawn, hidden: alive - drawn };`, 'a1-camera-hides-enemy');

// B. every enemy kind with its warning on the ground
await run('enemy_kinds', `
  fresh(); g.field.monsters.fill(null); g.cardT = 1e9; I.yaw = 0;
  const at = (k, x, z) => { EN.spawnEnemy(g, k, { x, z }); };
  at('husk', -6, -9); at('husk', -4, -11); at('runner', 6, -9); at('seer', 12, -2); at('golem', -12, -3); at('bloat', 2.5, 3); at('scarab', -5, 4); at('seer', -11, 8);
  const E = g.en; for (let i = 0; i < E.max; i++) if (E.alive[i] && E.kind[i] === 2) E.stT[i] = 0; for (let i = 0; i < E.max; i++) if (E.alive[i] && E.kind[i] === 3) E.stT[i] = 0;
  D.drive(0.45); const mid = { tele: g.tele.filter(t => t.on).map(t => ['line', 'disc', 'fan'][t.type]) };
  await still(); return { kindsAlive: [...new Set(Array.from(E.kind).filter((k, i) => E.alive[i]))].sort(), warnings: mid.tele };`, 'b1-enemy-kinds-warnings');

// B. the Sealed Warden: front shield, slam circle
await run('warden', `
  fresh(); g.field.monsters.fill(null); g.cardT = 1e9; SP.spawnWarden(g); const w = g.sp[0]; w.x = w.px = 0; w.z = w.pz = -9; w.y = w.py = 0; I.yaw = 0;
  D.drive(0.3); w.cd = 0; w.x = 0; w.z = -5; D.drive(0.5); await still(); const slam = g.tele.some(t => t.on && t.type === 1 && t.r === 5);
  return { slamCircleShown: slam, hp: Math.round(w.hp), maxHp: w.maxHp, shieldArcDeg: 130 };`, 'b2-sealed-warden');

// B. Twin Jackal Idols: fallen twin with the revive timer
await run('idols', `
  fresh(); g.field.monsters.fill(null); g.cardT = 1e9; SP.spawnIdols(g); const [a, c] = g.sp; a.x = a.px = -3; a.z = a.pz = -10; c.x = c.px = 3; c.z = c.pz = -10;
  g.damageSpecial(a, 1e6, 0, 0, { noCrit: true, area: true }); D.drive(0.5); await still(); return { fallenTimer: +a.reviveT.toFixed(1), twinAlive: c.alive && !c.dead };`, 'b3-twin-idols');

// B. The Hollow Pharaoh: three phases
await run('pharaoh', `
  fresh(); g.field.monsters.fill(null); g.cardT = 1e9; g.boss.state = 'idle'; SP.startBoss(g, true); const ph = g.sp.find(s => s.kind === 'pharaoh'); ph.x = ph.px = 0; ph.z = ph.pz = -14; I.yaw = 0; D.drive(1.3);
  const p1 = g.boss.phase; await still(); window.__p1 = true; return { phase: p1, telegraphs: g.tele.filter(t => t.on).length, hp: Math.round(ph.hp) };`, 'b4-pharaoh-phase1');
await run('pharaoh_phase2', `
  D.freeze(false); const ph = g.sp.find(s => s.kind === 'pharaoh'); ph.hp = ph.maxHp * 0.6; g.boss.trapT = 0; D.drive(0.4); await still(); return { phase: g.boss.phase, faceDownTraps: g.btraps.filter(t => t.on).length };`, 'b5-pharaoh-phase2-traps');
await run('pharaoh_phase3', `
  D.freeze(false); const ph = g.sp.find(s => s.kind === 'pharaoh'); ph.hp = ph.maxHp * 0.3; place(0, 0, 20); D.drive(3); await still(); return { phase: g.boss.phase, sandRadius: +g.boss.sandR.toFixed(1), hp: g.p.hp };`, 'b6-pharaoh-phase3-sand');

// B. overtime hunters, then victory and results
await run('overtime', `
  fresh(); g.field.monsters.fill(null); g.cardT = 1e9; g.t = 560; g.god = true; g.otAcc = 0; g.flags.overtime = false; place(0, 0, 0);
  D.drive(3); await still(); const hunters = Array.from(g.en.kind).filter((k, i) => g.en.alive[i] && k === 6).length; return { hunters, step: g.otStep, dmgMul: +g.dmgMul.toFixed(2), clock: document.getElementById('clock').textContent };`, 'b7-overtime');
await run('results_victory', `
  fresh(); g.bossKilled = true; g.won = true; g.kills = 812; g.fusions = 1; g.level = 41; g.t = 560; D.results(); await wait(300);
  return { title: document.getElementById('resTitle').textContent, overtime: document.getElementById('dOvertime').textContent, chips: document.getElementById('dChips').textContent };`, 'b8-results-victory');

// C. level-up offer, 4+4 field, Fusion
await run('levelup_offer', `
  fresh('kael'); g.god = true; g.level = 3; g.xpCur = g.xpNeed - 0.1; g.addXp(1); D.drive(0.05); await wait(300);
  return { mode: D.mode(), cards: g.offer ? g.offer.cards.map(c => c.id + (c.isNew ? ' (new)' : ' L' + c.to)) : null, redraws: g.field.redraws, banishes: g.field.banishes };`, 'c1-levelup-offer');
await run('field_full', `
  auto(); fresh('kael'); g.field.monsters.forEach((m, i) => {}); const F = g.field;
  F.monsters = [{ id: 'ember-wyvern', level: 10 }, { id: 'cinder-hatchling', level: 6 }, { id: 'rune-apprentice', level: 3 }, { id: 'sigil-familiar', level: 1 }].map(m => ({ ...m, cd: 0 }));
  F.spells = [{ id: 'kindling-rite', level: 3, cd: 0 }, { id: 'swift-draw', level: 2, cd: 0 }, { id: 'gust-ward', level: 1, cd: 0 }, { id: 'collectors-eye', level: 5, cd: 0 }];
  FD.recompute(g); D.drive(0.5); await still(); return { monsters: F.monsters.map(m => m.id + ' L' + m.level), spells: F.spells.map(s => s.id + ' L' + s.level), forms: F.monsters.map(m => 'form ' + (m.level >= 10 ? 3 : m.level >= 5 ? 2 : 1)) };`, 'c2-field-4-and-4');
await run('fusion', `
  fresh('kael'); const F = g.field; F.monsters[0] = { id: 'ember-wyvern', level: 10, cd: 0 }; F.monsters[1] = { id: 'cinder-hatchling', level: 10, cd: 0 };
  FD.recompute(g); const chest = { x: 1.5, y: 0, z: 0, open: false }; g.chests.push(chest); D.drive(0.2);
  const ready = FD.fusionsReady(g).slice(); D.game.step(1 / 60, { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: true }); D.drive(0.01); await wait(300);
  const offer = g.offer ? g.offer.type + ':' + g.offer.cards.map(c => c.id).join() : null; await window.__shotHook?.('x');
  return { fusionReadyBefore: ready, offer, mode: D.mode() };`, 'c3-fusion-offer');
await run('fusion_done', `
  D.freeze(false); g.choose(0); D.setMode('play'); D.drive(0.6); await still(); const F = g.field;
  return { monsters: F.monsters.map(m => m ? m.id + ' L' + m.level : 'empty'), fusions: g.fusions };`, 'c4-tyrant-beside-player');

// gems and the horde: frame rate with a full swarm and gems on the ground
await run('fps_horde_with_gems', `
  fresh('kael'); g.opts.offers = false; g.god = true; for (let i = 0; i < 300; i++) EN.spawnEnemy(g, ['husk', 'runner', 'seer', 'golem', 'bloat', 'scarab', 'hunter'][i % 7]);
  const P = await import('/src/sim/combat.js'); for (let i = 0; i < 150; i++) P.dropPickup(g, 0, (Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30, i % 20 === 0 ? 25 : i % 5 === 0 ? 6 : 1);
  g.spawnAcc = -1e9; I.yaw = 0.8; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); await wait(1500); D.perfReset(); await wait(7000); const p = D.perfRead(); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
  g.offer = null; g.pendingLevels = 0; g.opts.offers = false; const sim = (() => { const t = performance.now(); for (let i = 0; i < 120; i++) g.step(1 / 60, { f: 0, r: 0, yaw: 0 }); return +((performance.now() - t) / 120).toFixed(3); })();
  return { live: g.enemyCount(), gems: g.pick.alive.reduce((a, c) => a + c, 0), fps: +(p.frames * 1000 / p.ms).toFixed(1), worstFrameMs: +p.worstFrameMs.toFixed(1), simMsPerTick: sim, viewMs: +D.prof.view.toFixed(2) };`, 'c5-horde-and-gems');


// fixes from the first playtest: defeat screen names what killed you and saves records; a 3:00 moment in readable light
await run('defeat_screen', `
  fresh('kael'); g.god = false; g.t = 178; g.kills = 327; g.level = 14; g.hurtPlayer(500, false, 'Ram Golem rush'); D.drive(0.05); await wait(300);
  const first = { cause: document.getElementById('dCause').textContent, best: document.getElementById('dBest').textContent, breakdown: document.getElementById('dBreakdown').textContent };
  const saved = JSON.parse(localStorage.getItem('duelsummoner.save') || 'null');
  return { first, savedRecord: saved && saved.records.kael };`, 'd1-defeat-screen-cause');
await run('three_minute_moment', `
  fresh('kael'); g.god = true; g.opts.offers = false; g.t = 175; g.spawnAcc = 0; g.flags.warden = false; g.boss.state = 'idle'; g.field.monsters[1] = { id: 'cinder-hatchling', level: 5, cd: 0 }; g.field.spells[0] = { id: 'gust-ward', level: 1, cd: 0 }; g.field.spells[1] = { id: 'pit-of-seals', level: 1, cd: 0 };
  FD.recompute(g); g.p.hp = 62; D.drive(7); await still(); return { t: +g.t.toFixed(0), enemies: g.enemyCount(), kinds: [...new Set(Array.from(g.en.kind).filter((k, i) => g.en.alive[i]))] };`, 'd2-three-minute-moment');

R.pageErrors = JSON.parse(await b.evalIn('JSON.stringify(window.__errs || [])')).filter(e => !/404/.test(e));
console.log(JSON.stringify(R, null, 1));
b.close(); process.exit(0);




