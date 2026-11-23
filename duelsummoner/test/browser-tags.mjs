import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; D.game.spawnAcc = -1e9; D.freeze(true); return 1; })()`);
const R = {}; R.info = await b.evalIn(`(()=>{ const W = __ds.game.world; return JSON.stringify({ stones: W.stones.length, shrines: W.shrines.length, broker: !!W.broker, cchests: W.cchests.length }); })()`);
// stand next to a stone, a shrine and the broker in turn and look at the tags
for (const kind of ['stones', 'shrines', 'broker']) {
  const placed = await b.evalIn(`(()=>{ const D = __ds, W = D.game.world, o = ${kind === 'broker' ? 'W.broker' : 'W.' + kind + '[0]'}; if (!o) return null; const p = D.game.p; p.x = o.x + 4; p.z = o.z + 5; p.y = o.y; D.input.yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z)); D.chase.reset(); return 1; })()`);
  await wait(450); R[kind] = { placed: !!placed, tags: await b.evalIn(`[...document.querySelectorAll('.wtag')].filter(e => e.style.display === 'block').map(e => e.className + ': ' + e.textContent)`) }; await b.shot('tag-' + kind);
}
// use the stone up and see it change colour instead of vanishing
await b.evalIn(`(()=>{ const D = __ds, s = D.game.world.stones[0]; if (s) s.used = true; const p = D.game.p; p.x = s.x + 4; p.z = s.z + 5; D.input.yaw = Math.atan2(-(s.x - p.x), -(s.z - p.z)); D.chase.reset(); return 1; })()`);
await wait(450); R.spent = await b.evalIn(`[...document.querySelectorAll('.wtag')].filter(e => e.style.display === 'block').map(e => e.className + ': ' + e.textContent)`); await b.shot('tag-spent');
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);
