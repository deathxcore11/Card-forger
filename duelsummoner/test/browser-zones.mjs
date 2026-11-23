import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=2' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1000)); const g = D.game; g.field.monsters[0].level = 7; g.field.monsters[1] = { id: 'rune-apprentice', level: 3, cd: 0 }; g.field.monsters[2] = { id: 'cinder-hatchling', level: 10, cd: 0 }; await new Promise(r => setTimeout(r, 500)); return 1; })()`);
await b.shot('zones_pips'); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);
