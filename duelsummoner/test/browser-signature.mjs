import { launch, wait } from './cdp.mjs';
// Signatures: Cinder Card (fire) and Sky Seal (lightning). A spike of 40 kills with one element at Reach +100% (screen tier 4) fires the signature; the lab holds its clock still for the stills.   node test/browser-signature.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&debug&moments=full' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3000);
console.log(await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game, F = await import('/src/sim/field.js'); g.god = true; g.opts.offers = false; g.items = []; for (let i = 0; i < 11; i++) g.items.push('surveyors-lens'); F.recompute(g); g.field.monsters.fill(null); g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; if (D.grass) D.grass.visible = false; return JSON.stringify({ reach: g.mods.reach }); })()`));
const spike = el => b.evalIn(`(async()=>{ const D = __ds, g = D.game, { spawnEnemy } = await import('/src/sim/enemies.js'), C = await import('/src/sim/combat.js'), E = await import('/src/data/elements.js'), p = g.p; const slots = []; for (let k = 0; k < 40; k++) { spawnEnemy(g, ['husk','runner','hunter'][k % 3], { x: p.x + ((k % 8) - 3.5) * 2.4, z: p.z - 12 - Math.floor(k / 8) * 2.4 }); g.en.spd[g.lastSlot] = 0; slots.push(g.lastSlot); }
  const k0 = g.kills; window.__alive = slots.filter(i => g.en.alive[i]).length; window.__uniq = new Set(slots).size; await new Promise(r => setTimeout(r, 600)); for (let q = 0; q < slots.length; q += 8) { for (const i of slots.slice(q, q + 8)) { g.curSrc = 0; C.damageEnemy(g, i, 1e9, { elem: E.ELEMENTS.${el}.bit, noChain: true }); } await new Promise(r => setTimeout(r, 60)); } await new Promise(r => setTimeout(r, 400)); return JSON.stringify({ sigRun: D.actors.sigRun.map(s => [s.el, +s.x.toFixed(1), +s.z.toFixed(1)]), log: D.actors.sigLog || [], alive: window.__alive, uniq: window.__uniq, killed: g.kills - k0 }); })()`);
await b.evalIn(`(()=>{ const D = __ds, p = D.game.p; D.camHold = { x: p.x, y: p.y + 7, z: p.z + 12, lx: p.x, ly: p.y + 6, lz: p.z - 12 }; return 1; })()`);
console.log('first', await spike(process.argv[3] || 'fire')); console.log('dbg', await b.evalIn('JSON.stringify({ notes: __ds.actors.sig.kills.fire.length / 3, ownCtx: !!__ds.actors.ownCtx, tick: __ds.fx.tick, blocked: __ds.fx.blocked, corpses: (__ds.actors.corpses||[]).length, reach: __ds.game.mods.reach })'));
for (const t of [0.05, 0.45, 0.78, 1.6]) { await b.evalIn('__ds.actors.sigHold = ' + t + '; 1'); await wait(500); await b.shot('sig_fire_' + String(t).replace('.', '_')); }
await b.evalIn(`(()=>{ const A = __ds.actors; A.sigHold = undefined; A.sigRun.length = 0; A.sig.last.lightning = -1e9; A.sig.kills.lightning.length = 0; const p = __ds.game.p; __ds.camHold = { x: p.x, y: p.y + 4, z: p.z + 16, lx: p.x, ly: p.y + 20, lz: p.z - 12 }; return 1; })()`);
await b.evalIn(`(()=>{ const A = __ds.actors, oh = A.hitAt.bind(A), oc = A.corpse.bind(A); window.__lg = []; A.hitAt = (x, z, f) => { if (__lg.length < 6) __lg.push(['h', f]); oh(x, z, f); }; A.corpse = (k, x, z) => { if (__lg.length < 10) __lg.push(['c', k, (A._hits || []).length]); oc(k, x, z); }; return 1; })()`);console.log('second', await spike(process.argv[3] === 'lightning' ? 'fire' : 'lightning')); console.log('lg', await b.evalIn('JSON.stringify(window.__lg)')); console.log('lg', await b.evalIn('JSON.stringify(window.__lg)')); console.log('dbg2', await b.evalIn('JSON.stringify({ notes: __ds.actors.sig.kills.lightning.length / 3, corp: (__ds.actors.corpses||[]).length, last: __ds.actors.sig.last, tick: __ds.fx.tick, bit: 0, cs: (__ds.actors.corpses||[]).slice(0,3).map(c => [c.type, +c.t.toFixed(2)]), hits: (__ds.actors._hits||[]).length })'));
await b.evalIn('__ds.actors.sigRun.forEach(s => { s.bolts = 0; s.cards = 0; s.trunk = false; }); 1');
for (const t of [0.05, 0.2, 0.45]) { await b.evalIn('(()=>{ const A = __ds.actors; A.sigHold = ' + t + '; return 1; })()'); await wait(150); await b.shot('sig_lightning_' + String(t).replace('.', '_')); }
await b.evalIn('window.__imp = setInterval(() => { __ds.actors.impactFrame = "lightning"; }, 4); 1'); await wait(150); await b.shot('sig_impact_lightning'); await b.evalIn('clearInterval(window.__imp); __ds.actors.sigHold = undefined; __ds.actors.sigRun.length = 0; 1');
await b.evalIn(`(()=>{ const A = __ds.actors, s = A.sigRun[0] || { x: __ds.game.p.x, z: __ds.game.p.z }, p = __ds.game.p; A.sigRun.forEach(q => { q.bolts = 0; q.cards = 0; q.trunk = false; }); A.sigHold = 0.5; __ds.camHold = { x: s.x, y: p.y + 14, z: s.z + 9, lx: s.x, ly: p.y, lz: s.z }; return 1; })()`); await wait(300); await b.shot('sig_lightning_star');
await b.evalIn('window.__imp = setInterval(() => { __ds.actors.impactFrame = "fire"; }, 4); 1'); await wait(150); await b.shot('sig_impact_fire'); await b.evalIn('clearInterval(window.__imp); 1');console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);














