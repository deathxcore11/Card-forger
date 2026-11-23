import { launch, wait } from './cdp.mjs';
// Quick Look: Map, Build and Stats tabs over the frozen run, opened from play (M) and from Pause (Map); closes with Close, Esc and a pad B.   node test/browser-quicklook.mjs <outdir>
const out = process.argv[2], b = await launch({ out, query: '?seed=3&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await wait(3000);
await b.evalIn(`(async()=>{ const D = __ds; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 2200)); const g = D.game; g.god = true; g.field.monsters[1] = { id: 'cinder-hatchling', level: 4 }; g.items.push('lucky-coin'); g.mods.dmgMult = 0.2; return 1; })()`);
const key = k => b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', code: 'Key${k.toUpperCase()}', bubbles: true })); return 1; })()`);
const st = () => b.evalIn(`JSON.stringify({ open: getComputedStyle(document.getElementById('mapOverlay')).display, tab: document.querySelector('#qlTabs .sel').dataset.qt, mode: document.body.dataset.mode })`);
await key('m'); await wait(600); console.log('M opens', await st()); await b.shot('ql_map_1280');
await b.evalIn(`(()=>{ document.querySelector('[data-qt=build]').click(); return 1; })()`); await wait(300); console.log('build tab', await st(), await b.evalIn(`document.querySelectorAll('#qlBuild .ptile.mon').length`)); await b.shot('ql_build_1280');
await b.evalIn(`(()=>{ document.querySelector('[data-qt=stats]').click(); return 1; })()`); await wait(300); console.log('stats tab', await st(), await b.evalIn(`document.querySelectorAll('#qlStats .srow2').length`)); await b.shot('ql_stats_1280');
await b.evalIn(`(()=>{ document.getElementById('qlClose').click(); return 1; })()`); await wait(300); console.log('Close', await st());
await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 1; })()`); await wait(600);
await b.evalIn(`(()=>{ document.getElementById('pmMap').click(); return 1; })()`); await wait(500); console.log('Map from Pause', await st());
await b.evalIn(`(()=>{ window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })); return 1; })()`); await wait(400); console.log('Esc closes map, pause stays', await st(), await b.evalIn(`getComputedStyle(document.getElementById('pauseScreen')).display`));
await b.send('Emulation.setDeviceMetricsOverride', { width: 844, height: 390, deviceScaleFactor: 1, mobile: true }); await wait(300);
await b.evalIn(`(()=>{ document.getElementById('pmMap').click(); return 1; })()`); await wait(600); await b.shot('ql_map_844');
await b.evalIn(`(()=>{ document.querySelector('[data-qt=build]').click(); return 1; })()`); await wait(300); await b.shot('ql_build_844');
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
