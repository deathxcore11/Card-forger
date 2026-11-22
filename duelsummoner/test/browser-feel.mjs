// Real-browser check for the game-feel pass: effect pools, fps with 300 enemies, and screenshots of the best moments.
// Usage: node test/browser-feel.mjs [outDir]
import { launch, wait } from './cdp.mjs';

const b = await launch({ out: process.argv[2], query: '?debug', uncapped: true });
const H = `
const D = window.__ds, g = D.game, wait = ms => new Promise(r => setTimeout(r, ms));
const SP = await import('/src/sim/specials.js'), EN = await import('/src/sim/enemies.js'), FD = await import('/src/sim/field.js');
const quiet = () => { D.freeze(false); D.start(); g.god = true; g.spawnAcc = -1e9; g.golemT = 1e9; g.cardT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.en.alive.fill(0); g.p.x = 0; g.p.z = 0; };
const pickAll = () => { if (g.offer) { const b = document.querySelector('[data-pick="0"]'); if (b) b.click(); } };
`;
const R = {};
const run = async (name, body, shot) => {
  try { R[name] = await b.evalIn('(async()=>{' + H + body + '})()'); } catch (e) { R[name] = { ERROR: String(e.message).slice(0, 500) }; console.log('FAILED', name, R[name].ERROR); return; }
  if (shot) await b.shot(shot);
};

// 1. combat with 300 enemies: fps, pool use, damage numbers and shatter particles
await run('combat300', `
  quiet(); g.spawnAcc = 0; for (let i = 0; i < 300; i++) EN.spawnEnemy(g, ['husk','runner','husk','husk'][i % 4]);
  await wait(500); D.perfReset(); let maxP = 0, maxN = 0, heap = [];
  for (let i = 0; i < 24; i++) { await wait(250); pickAll(); maxP = Math.max(maxP, D.fx.pm.count); maxN = Math.max(maxN, D.fx.nsp.filter(s => s.visible).length); if (performance.memory) heap.push(performance.memory.usedJSHeapSize / 1048576 | 0); for (let k = 0; k < 6; k++) EN.spawnEnemy(g, 'husk'); }
  const r = D.perfRead();
  return { fps: +(r.frames * 1000 / r.ms).toFixed(0), worstFrameMs: +r.worstFrameMs.toFixed(1), enemies: g.enemyCount(), maxParticles: maxP, maxNumbers: maxN, kills: g.kills, heapMB: heap.filter((_, i) => i % 3 === 0), mode: D.mode(), prof: D.prof };`, 'feel-1-combat');

// 1b. allocation per frame in steady state: heap used before and after short windows (windows that include a GC are dropped)
R.alloc = await (async () => {
  await b.evalIn(`(async()=>{${H} quiet(); g.p.hp = 1e9; for (let i = 0; i < 300; i++) EN.spawnEnemy(g, 'husk'); await wait(1500); })()`);
  const out = [], frames = () => b.evalIn('window.__ds.perfRead().frames'); await b.evalIn('window.__ds.perfReset()');
  for (let k = 0; k < 14; k++) { const h0 = (await b.send('Runtime.getHeapUsage')).result.usedSize, f0 = await frames(); await wait(250); const h1 = (await b.send('Runtime.getHeapUsage')).result.usedSize, f1 = await frames(); if (h1 > h0 && f1 > f0) out.push(Math.round((h1 - h0) / (f1 - f0))); }
  out.sort((a, c) => a - c); return { bytesPerFrameMedian: out[Math.floor(out.length / 2)], samples: out };
})();

// 2. form change at level 5 (flash, ring burst, scale pop)
await run('formChange', `
  quiet(); g.field.monsters[0].level = 4; await wait(400); g.field.monsters[0].level = 5; await wait(160);
  return { particles: D.fx.pm.count, flash: D.fx.flashA.toFixed(2) };`, 'feel-2-form');

// 3. Fusion set piece
await run('fusion', `
  quiet(); const M = g.field.monsters; M[0].level = 10; M[1] = { id: 'cinder-hatchling', level: 10, cd: 0 }; await wait(500);
  const c = { x: g.p.x, y: g.p.y, z: g.p.z, open: false }; g.chests.push(c); FD.openChest(g, c); await wait(200);
  document.querySelector('[data-pick="0"]').click(); await wait(500);
  const mid = D.actors.ghosts.length;
  await b2(); async function b2() {}
  return { ghostsDuring: mid, holding: true };`, 'feel-3-fusion-spiral');
await wait(750);
await run('fusionLand', `await wait(100); return { fusions: g.fusions, mons: g.field.monsters.filter(Boolean).map(m => m.id), ghosts: D.actors.ghosts.length };`, 'feel-4-fusion-land');

// 4. boss intro: name plate and zoom
await run('bossIntro', `
  quiet(); g.flags.warden = g.flags.idols = true; g.boss.state = 'idle'; SP.startBoss(g, true); await wait(700);
  return { plate: document.getElementById('plate').textContent, fov: D.camera.fov.toFixed(1), push: D.fx.push.toFixed(2) };`, 'feel-5-boss-plate');

// 5. hurt + low LP heartbeat edge
await run('lowHp', `
  quiet(); g.god = false; g.p.hp = 22; g.hurtPlayer(1, false, 'test'); await wait(300);
  return { lowClass: document.getElementById('lowhp').classList.contains('on'), trauma: D.fx.trauma.toFixed(2) };`, 'feel-6-lowhp');

// 6. level-up offer deal-in
await run('offerDeal', `
  quiet(); g.addXp(1e5); await wait(180);
  return { mode: D.mode(), cards: document.querySelectorAll('#offerCards .card').length };`, 'feel-7-offer');

// 7. reduce motion: no shake, hit-stop or flash
await run('reduceMotion', `
  quiet(); D.save.settings.reduceMotion = true; document.body.classList.add('rm'); D.fx.shake(1); D.fx.hitstop(1); D.fx.flash(1);
  const r = { trauma: D.fx.trauma, stop: D.fx.stop, flash: D.fx.flashA }; D.save.settings.reduceMotion = false; document.body.classList.remove('rm'); return r;`);

console.log(JSON.stringify(R, null, 1));
console.log('page errors:', JSON.stringify(await b.evalIn('window.__errs')));
console.log('shots in', b.out);
b.close();
