// Chrome look at the field monsters: Ember Wyvern and Cinder Hatchling (owner's models, nose smoke), Twinflare Tyrant (glow, fire breath),
// Rune Apprentice (code-built staff, rune bolts). Models that are not on disk show their placeholder.
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
const H = `const D = window.__ds, g = D.game, wait = ms => new Promise(r => setTimeout(r, ms));
const EN = await import('/src/sim/enemies.js');
const look = (i, dx, dy, dz, lyOff) => { const m = [...D.actors.monsters.values()][i], p = m.position; D.camHold = { x: p.x + dx, y: p.y + dy, z: p.z + dz, lx: p.x, ly: p.y + (lyOff || 0.4), lz: p.z }; };
const setup = (ms, enemies) => { D.camHold = null; D.freeze(false); D.start(); g.god = true; g.opts.offers = false; g.spawnAcc = -1e9; g.golemT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.en.alive.fill(0); g.cardT = 1e9;
  g.field.monsters.fill(null); ms.forEach((id, i) => { g.field.monsters[i] = { id, level: 10, cd: 0.3, ang: i * 1.6, x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0 }; });
  if (enemies) for (let i = 0; i < enemies; i++) { EN.spawnEnemy(g, 'husk', { x: 4 + i * 2, z: -8 + i * 1.5 }); }
  D.input.yaw = 0.6; D.chase.reset(); };`;
const R = { assetsLoaded: await b.evalIn('(() => { const a = window.__ds.assets; return { wyvern: !!a.wyvern, hatchling: !!a.hatchling, tyrant: !!a.tyrant, apprentice: !!a.apprentice, puff: !!a.puff }; })()') };
const sh = async (name, body) => { try { R[name] = await b.evalIn('(async()=>{' + H + body + '})()'); await b.shot(name); } catch (e) { R[name] = { ERROR: e.message.slice(0, 300) }; } };
await sh('m1-wyvern-and-hatchling', `setup(['ember-wyvern', 'cinder-hatchling'], 6); g.field.monsters[1].level = 10; await wait(1200); look(0, 2.2, 0.8, 3.4, 0.2); await wait(120); D.freeze(true); await wait(250); return { monsters: g.field.monsters.filter(Boolean).map(m => m.id) };`);
await sh('m2-hatchling-closeup', `setup(['cinder-hatchling'], 4); g.field.monsters[0].ang = 0; D.input.yaw = 0.0; await wait(1800); look(0, 0.9, 0.35, 1.5, 0.35); await wait(150); D.freeze(true); await wait(250); return { smokePuffsLive: D.actors.puffs.filter(p => p.on).length };`);
await sh('m3-tyrant', `setup(['twinflare-tyrant'], 8); g.field.monsters[0].level = 5; await wait(1500); g.field.monsters[0].cd = 0; await wait(160); look(0, 4.5, 1.5, 6.5, 0.8); await wait(50); D.freeze(true); await wait(150); return { flames: (D.actors.flames || []).filter(f => f.on).length };`);
await sh('m4-rune-apprentice', `setup(['rune-apprentice'], 6); await wait(1300); for (let i = 0; i < 150 && !g.fx.some(f => f.on && f.type === 'bolt'); i++) { g.field.monsters[0].cd = 0; await wait(25); } look(0, 1.6, 0.7, 3.2, 0.9); await wait(30); D.freeze(true); await wait(120); return { boltsLive: g.fx.filter(f => f.on && f.type === 'bolt').length };`);
R.pageErrors = JSON.parse(await b.evalIn('JSON.stringify(window.__errs || [])')).filter(e => !/404/.test(e));
console.log(JSON.stringify(R, null, 1)); b.close(); process.exit(0);


