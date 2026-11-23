import { launch, wait } from './cdp.mjs';
// Tier 5 and Tablebreak from a real Overtime run: the same setup as the overtime-5min golden scene (clock at 8:00, the bosses done) with Reach at its ceiling from 15 Surveyor's Lenses; the game then runs on its own until Overtime starts,
// and Tier 5 and the Tablebreak moment fire by themselves. Logs the screen tier, otStep, the director's grant and the stop log; shoots 60 ms after the break and again a few seconds on.   node test/browser-overtime.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=9' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game, F = await import('/src/sim/field.js'); g.god = true; g.t = 480; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.cardT = 1e9; g.duelOn = true; g.otT = 40; g.otAcc = 0; g.huntT = 0; g.flags.overtime = true; g.opts.offers = false; g.items = []; for (let i = 0; i < 15; i++) g.items.push('surveyors-lens'); F.recompute(g); D.camHold = null; return 1; })()`);
let seen = false; for (let i = 0; i < 120 && !seen; i++) { await wait(500); const s = JSON.parse(await b.evalIn(`JSON.stringify({ ot: __ds.game.otStep, reach: __ds.game.mods.reach, tier5: __ds.actors.tier5, tb: __ds.blitU.uTBh.value, t: +__ds.game.t.toFixed(1) })`)); if (s.tier5) { seen = true; console.log('real run: Tier 5 reached', JSON.stringify(s)); } else if (i % 10 === 0) console.log('waiting', JSON.stringify(s)); }
await b.shot('overtime_break'); await wait(3000); await b.shot('overtime_t5');
console.log('director', await b.evalIn('JSON.stringify(__ds.fx.dir.granted.slice(-4))'), 'stopLog', await b.evalIn('JSON.stringify(__ds.fx.stopLog.slice(-3))'));
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,2))')));
b.close(); setTimeout(() => process.exit(0), 300);
