import { launch, wait } from './cdp.mjs';
// A Toll Shade and a boss standing between the camera and the duelist must not hide it: the duelist's visible pixels (the game's own count, __ds.duelistPixels) stay at 85% or more of the unobstructed count.   node test/browser-actorsee.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=1&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await wait(3000);
console.log(await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game, S = await import('/src/sim/specials.js'); g.god = true; g.opts.offers = false; g.field.monsters.fill(null); g.spawnAcc = -1e9; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; if (D.grass) D.grass.visible = false; const p = g.p;
  D.camHold = { x: p.x, y: p.y + 5, z: p.z + 10, lx: p.x, ly: p.y + 1, lz: p.z }; D.freeze(true); await new Promise(r => setTimeout(r, 700)); window.__u = JSON.stringify(D.duelistPixels()); return window.__u; })()`));
const grab = async name => { await wait(500); await b.shot(name); return JSON.parse(await b.evalIn('JSON.stringify(__ds.duelistPixels())')); };
const base = JSON.parse(await b.evalIn('window.__u')); await b.shot('actorsee_none');
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, p = g.p; g.shades.push({ x: p.x + 0.2, y: p.y, z: p.z + 4, px: p.x + 0.2, py: p.y, pz: p.z + 4, face: 0, cd: 1e9, born: g.t - 5 }); return 1; })()`);
const shade = await grab('actorsee_shade');
await b.evalIn(`(async()=>{ const D = __ds, g = D.game, S = await import('/src/sim/specials.js'), p = g.p; S.spawnSpecial(g, { id: 'x', engine: 'warden', role: 'bossA', name: 'Test' }, { x: p.x - 0.1, y: p.y, z: p.z + 6.5 }); return g.sp.length; })()`);
const both = await grab('actorsee_both');
console.log('base', JSON.stringify(base), 'shade', JSON.stringify(shade), 'both', JSON.stringify(both));
const r = x => +((x.visible / Math.max(1, x.alone)) / (base.visible / Math.max(1, base.alone))).toFixed(3); console.log('visible vs unobstructed: shade', r(shade), 'shade+boss', r(both), r(shade) >= 0.85 && r(both) >= 0.85 ? 'PASS' : 'FAIL');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);


