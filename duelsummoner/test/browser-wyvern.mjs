import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
console.log(await b.evalIn(`(()=>{ const D = __ds, out = []; for (const [m, mesh] of D.actors.monsters) out.push({ id: m.id, hasCrit: !!mesh.userData.crit, form: mesh.userData.formIdx, size: mesh.userData.size, pos: mesh.position.toArray().map(v => +v.toFixed(1)) }); return JSON.stringify(out); })()`));
for (let i = 0; i < 3; i++) { await b.evalIn(`(()=>{ const D = __ds; for (const [m, mesh] of D.actors.monsters) { const p = mesh.position; D.camHold = { x: p.x + 2.2, y: p.y + 1.0, z: p.z + 3.0, lx: p.x, ly: p.y + 0.4, lz: p.z }; } return 1; })()`); await wait(i === 1 ? 130 : 330); await b.shot('wyvern-live-' + i); }
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
