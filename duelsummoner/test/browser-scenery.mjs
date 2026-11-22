import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug' });
const R = {};
for (const [stage, name] of [[0, 'stage1'], [1, 'stage2'], [2, 'stage3']]) {
  await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 700)); D.game.god = true; D.game.spawnAcc = -1e9; D.freeze(true); if (${stage}) { const S = await import('/src/sim/stages.js'); S.jumpToStage(D.game, ${stage}); } await new Promise(r => setTimeout(r, 900)); return 1; })()`);
  R[name] = await b.evalIn(`(()=>{ const D = __ds; let n = 0, tri = 0; D.scene.traverse(o => { if (o.isInstancedMesh) { n += o.count; tri += o.count * o.geometry.attributes.position.count / 3; } }); return { instances: n, triangles: Math.round(tri), stage: D.game.stage }; })()`);
  await b.evalIn(`(()=>{ const p = __ds.game.p; __ds.camHold = null; return 1; })()`); await wait(400); await b.shot(name + '-a');
  await b.evalIn(`(()=>{ const D = __ds, p = D.game.p; D.camHold = { x: p.x, y: p.y + 40, z: p.z + 55, lx: p.x, ly: p.y, lz: p.z - 10 }; return 1; })()`); await wait(500); await b.shot(name + '-b');
}
R.errors = await b.evalIn('window.__errs'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);
