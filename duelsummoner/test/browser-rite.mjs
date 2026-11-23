import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=1' }); await b.send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await b.evalIn(`(async()=>{ const D = window.__ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1500)); D.game.god = true; return 1; })()`);
const read = () => b.evalIn(`document.getElementById('rite').innerText.replace(/\\n/g, ' | ')`);
const out = [await read()];
await b.evalIn(`(async()=>{ __ds.game.sc = 361; await new Promise(r => setTimeout(r, 400)); return 1; })()`); out.push(await read()); await b.shot('rite_gate_awake');
await b.evalIn(`(async()=>{ __ds.game.gate.state = 'done'; await new Promise(r => setTimeout(r, 400)); return 1; })()`); out.push(await read()); await b.shot('rite_gate_done');
await b.evalIn(`(async()=>{ __ds.game.desc = { t: 0 }; await new Promise(r => setTimeout(r, 400)); return 1; })()`); out.push(await read());
console.log(JSON.stringify(out, null, 1)); console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,2)'))); b.close(); setTimeout(() => process.exit(0), 300);
