import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; D.game.spawnAcc = -1e9; return 1; })()`);
const R = {}; R.start = await b.evalIn(`__ds.game.fog.count`);
await b.shot('fog-start');
// walk a long way: set the player along a line, step by teleport so the mask grows
await b.evalIn(`(async()=>{ const D = __ds, p = D.game.p; for (let k = 0; k < 40; k++) { p.x += 3.5; p.z += 2.2; await new Promise(r => setTimeout(r, 40)); } return 1; })()`);
R.walked = await b.evalIn(`__ds.game.fog.count`); await b.shot('fog-walked');
// the full map
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 }); await wait(400);
R.mapOpen = await b.evalIn(`__ds.mapIsOpen()`); const t0 = await b.evalIn(`__ds.game.t`); await wait(500); R.frozenWhileOpen = (await b.evalIn(`__ds.game.t`)) === t0;
await b.shot('fullmap');
await b.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 }); await b.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'm', code: 'KeyM', windowsVirtualKeyCode: 77 }); await wait(300); R.mapClosed = !(await b.evalIn(`__ds.mapIsOpen()`));
// high ground scouts further
R.highGround = await b.evalIn(`(()=>{ const D = __ds, p = D.game.p, before = D.game.fog.count; p.y = 40; return before; })()`); await wait(300); R.afterHigh = await b.evalIn(`__ds.game.fog.count`);
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R)); b.close(); setTimeout(() => process.exit(0), 300);
