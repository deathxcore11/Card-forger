import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&scenery=0' });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); D.game.god = true; D.game.sc = 86; return 1; })()`);
await wait(1800);
const R = {};
R.aces = await b.evalIn(`(()=>{ const e = __ds.game.en, out = []; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.ace[i]) out.push({ i, hp: Math.round(e.hp[i]), size: e.size[i], kind: e.kind[i], d: Math.round(Math.hypot(e.x[i] - __ds.game.p.x, e.z[i] - __ds.game.p.z)) }); return JSON.stringify(out); })()`);
R.crests = await b.evalIn(`__ds.actors.crests.count`);
// look at the first Ace
await b.evalIn(`(()=>{ const D = __ds, e = D.game.en; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.ace[i]) { setInterval(() => { D.camHold = { x: e.x[i] + 3.5, y: e.y[i] + 3, z: e.z[i] + 5.5, lx: e.x[i], ly: e.y[i] + 1.2, lz: e.z[i] }; D.game.spawnAcc = -1e9; }, 8); break; } return 1; })()`);
await wait(500); await b.shot('ace');
// kill it with a guaranteed Trophy roll
R.after = await b.evalIn(`(async()=>{ const D = __ds, g = D.game, e = g.en, C = await import('/src/sim/combat.js'); g.trophies = -10; let id = -1; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.ace[i]) { id = i; break; } if (id < 0) return 'no ace'; C.killEnemy(g, id); await new Promise(r => setTimeout(r, 900)); return JSON.stringify({ chests: g.world.cchests.filter(c => c.trophy).map(c => ({ rarity: c.rarity, free: c.free, open: c.open })), trophies: g.trophies, partsChests: __ds.actors.props ? 0 : 'n/a' }); })()`);
await b.evalIn(`(()=>{ const D = __ds, c = D.game.world.cchests.find(c => c.trophy); if (!c) return 0; setInterval(() => { D.camHold = { x: c.x + 3, y: c.y + 2.2, z: c.z + 5, lx: c.x, ly: c.y + 3, lz: c.z }; }, 8); return 1; })()`);
await wait(500); await b.shot('trophy');
R.errors = await b.evalIn('window.__errs.slice(0,3)'); console.log(JSON.stringify(R, null, 1)); b.close(); setTimeout(() => process.exit(0), 300);
