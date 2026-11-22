// Real-browser check of the three-stage run: start-screen buttons, the HUD strip, boss ring announce, the Fusion chest marker (beam, arrow,
// minimap icon), gate, Descent into Stage 2 and the Final Altar. Saves screenshots. Usage: node test/browser-stages.mjs [outDir]
import { launch, wait } from './cdp.mjs';

const b = await launch({ out: process.argv[2], query: '?debug', uncapped: true });
const H = `
const D = window.__ds, g = D.game, wait = ms => new Promise(r => setTimeout(r, ms));
const key = c => window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
`;
const R = {};
const run = async (name, body, shot) => {
  try { R[name] = await b.evalIn('(async()=>{' + H + body + '})()'); } catch (e) { R[name] = { ERROR: String(e.message).slice(0, 500) }; console.log('FAILED', name, R[name].ERROR); return; }
  if (shot) await b.shot(shot);
};

await run('startScreen', `return { start: !!document.getElementById('startBtn'), quick: !!document.getElementById('quickBtn'), startText: document.getElementById('startBtn').textContent, quickText: document.getElementById('quickBtn').textContent };`, 'stage-0-start');
await run('stage1', `D.begin('run'); g.god = true; await wait(600);
  return { mode: g.mode, stage: g.stage + 1, clock: document.getElementById('clock').textContent, strip: document.getElementById('strip').textContent, next: document.getElementById('nextEvent').textContent };`, 'stage-1-hud');
await run('announce', `g.sc = 99.8; await wait(900); return { sigils: true, banner: document.getElementById('banner').textContent, strip: document.getElementById('strip').innerHTML.includes('now') };`, 'stage-2-announce');
await run('fusionChest', `g.sc = 10; g.field.monsters[0].level = 10; g.field.monsters[1] = { id: 'cinder-hatchling', level: 10, cd: 0 }; D.fx.settings.reduceMotion = false; await wait(700);
  const c = g.chests.find(x => x.guaranteed); const arrow = document.getElementById('arrow');
  return { chest: !!c, dist: c ? +Math.hypot(c.x - g.p.x, c.z - g.p.z).toFixed(1) : null, arrowShown: arrow.style.display, banner: document.getElementById('banner').textContent };`, 'stage-3-fusion-marker');
await run('gate', `const FD = await import('/src/sim/field.js'); g.chests.length = 0; g.fusionGuard = null; g.sc = 361; g.p.x = 0; g.p.z = -55; g.p.y = 4; await wait(300);
  return { awake: g.gate.awake, prompt: document.getElementById('prompt').textContent, strip: document.getElementById('strip').textContent };`, 'stage-4-gate');
await run('gateFight', `D.input.keys.KeyE = true; await wait(3600); D.input.keys.KeyE = false;
  const boss = g.sp.find(s => s.role === 'gate'); return { state: g.gate.state, boss: boss ? boss.name : null, bossBar: document.getElementById('boss').style.display, bossName: document.getElementById('bossname').textContent };`, 'stage-5-gate-boss');
await run('descent', `g.opts.offers = false; g.pendingLevels = 0; if (g.offer) { g.offer = null; D.setMode('play'); } const boss = g.sp.find(s => s.role === 'gate'); if (boss) g.damageSpecial(boss, 1e9, 0, 0, { noCrit: true, area: true }); await wait(300);
  const circle = !!g.circle; g.p.x = g.circle.x; g.p.z = g.circle.z; await wait(500); const desc = !!g.desc; await wait(6500);
  return { circle, desc, stage: g.stage + 1, clock: document.getElementById('clock').textContent, strip: document.getElementById('strip').textContent, hp: g.p.hp };`, 'stage-6-stage2');
await run('finalAltar', `D.begin('quick'); g.opts.offers = false; g.god = true; g.sc = 430; g.p.x = 0; g.p.z = -55; g.p.y = 4; D.input.keys.KeyE = true; await wait(3600); D.input.keys.KeyE = false;
  const boss = g.sp.find(s => s.role === 'gate'); if (boss) g.damageSpecial(boss, 1e9, 0, 0, { noCrit: true, area: true }); await wait(400);
  g.p.x = g.altar.x; g.p.z = g.altar.z; await wait(200); key('KeyE'); await wait(600);
  return { dbg: [g.mode, g.altar && [g.altar.x, g.altar.z, g.altar.used], g.p.x, g.p.z, g.stagePrompt, g.prompt, D.mode(), D.input.enabled], altar: !!g.altar, offer: g.offer ? g.offer.type : null, cards: document.querySelectorAll('#offerCards .card').length, title: document.getElementById('offerTitle').textContent };`, 'stage-7-final-altar');

console.log(JSON.stringify(R, null, 1));
console.log('page errors:', JSON.stringify(await b.evalIn('window.__errs')));
b.close();



