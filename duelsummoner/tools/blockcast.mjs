// Block look cast pictures (?blocks=1 by default): the summons in each form, the Fusions and the Sealed Warden, from the real play camera, set up through the debug hooks.
// Pictures go to <outdir>, never into the repo.   node tools/blockcast.mjs <outdir> [seed=21] [width=1920] [height=1080]
import { launch, wait } from '../test/cdp.mjs';
const [out, sArg, wArg, hArg] = process.argv.slice(2), seed = +sArg || 21, W = +wArg || 1920, H = +hArg || 1080, Q = process.env.Q === undefined ? '&blocks=1' : process.env.Q;
const b = await launch({ out, query: '?debug&play=1&seed=' + seed });
await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: W < H });
await b.send('Page.navigate', { url: 'http://127.0.0.1:8767/?debug&play=1&seed=' + seed + Q }); await wait(1500); for (let i = 0; i < 60 && !(await b.evalIn('!!window.__ds')); i++) await wait(200);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 3500)); const g = D.game; g.god = true; g.spawnAcc = -1e9; g.opts.offers = false; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; return 1; })()`);
const { MONSTERS, FUSIONS } = await import('../src/data/cards.js');
const casts = [];
for (const id of Object.keys(MONSTERS)) MONSTERS[id].forms.forEach((fm, i) => casts.push([id, fm.fromLevel, id + '-f' + (i + 1)]));
for (const id of Object.keys(FUSIONS)) casts.push([id, 1, id]);
for (const [id, level, name] of casts) {
  await b.evalIn(`(async()=>{ const g = __ds.game; g.field.monsters = [{ id: '${id}', level: ${level}, cd: 0.1, ang: 0, x: g.p.x, y: g.p.y, z: g.p.z, px: g.p.x, py: g.p.y, pz: g.p.z }, null, null, null]; for (let i = 0; i < g.en.max; i++) g.en.alive[i] = 0; await new Promise(r => setTimeout(r, 1800)); __ds.freeze(true); return 1; })()`);
  await b.shot('cast-' + name + '-' + W + 'x' + H); await b.evalIn('(()=>{ __ds.freeze(false); return 1; })()');
}
await b.evalIn(`(async()=>{ const g = __ds.game, { spawnWarden } = await import('/src/sim/specials.js'); g.field.monsters = [null, null, null, null]; spawnWarden(g); const sp = g.sp[g.sp.length - 1]; if (sp) { const cy = g.camYaw || 0; sp.x = g.p.x - Math.sin(cy) * 9; sp.z = g.p.z - Math.cos(cy) * 9; } await new Promise(r => setTimeout(r, 2500)); __ds.freeze(true); return 1; })()`);
await b.shot('cast-warden-' + W + 'x' + H);
const errs = await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,3))'); if (errs !== '[]') console.log('errors', errs);
console.log(casts.length + 1, 'pictures'); setTimeout(() => process.exit(0), 300);
