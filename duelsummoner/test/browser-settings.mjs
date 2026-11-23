import { launch, wait } from './cdp.mjs';
import { visibleRows, TABS, defaultFor } from '../src/ui/settings-schema.js';
// Settings drawn from the schema: for every device class and tab the rows on screen equal the schema's rows, a click writes the value, and the legacy rows still apply live.   node test/browser-settings.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=3&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await wait(3000);
let bad = 0; await b.evalIn('window.__showAllRows = true; 1');
for (const cls of ['phone', 'thor', 'portal', 'pc']) for (const tab of TABS) {
  const n = await b.evalIn(`(()=>{ window.__deviceClass = '${cls}'; document.body.dataset.mode = 'start'; __ds.menus.showSettings('${tab}'); return document.querySelectorAll('#menuBody .srow').length; })()`);
  const want = visibleRows(tab, { cls, pad: false, dual: true, gyro: false, keyboard: false, signedIn: false, values: { onScreenControls: defaultFor('onScreenControls', cls), gyroLook: false } }).length;
  if (n !== want) { bad++; console.log('MISMATCH', cls, tab, 'on screen', n, 'schema', want); }
}
console.log('dev view: row counts match the schema for 4 classes x 6 tabs:', bad === 0 ? 'Pass' : 'Fail ' + bad);
await b.evalIn('window.__showAllRows = false; 1');
const player = JSON.parse(await b.evalIn(`(()=>{ const out = {}; for (const cls of ['phone', 'thor', 'portal', 'pc']) { window.__deviceClass = cls; __ds.menus.showSettings('game'); out[cls] = { tabs: [...document.querySelectorAll('[data-stab]')].map(x => x.dataset.stab), rows: [...document.querySelectorAll('#menuBody .srow')].length, notConnected: /not connected/.test(document.body.innerText) }; } return JSON.stringify(out); })()`));
console.log('player view (no dev flag):', JSON.stringify(player), Object.values(player).every(p => !p.notConnected) ? 'Pass: no dead rows' : 'Fail');
await b.evalIn(`(()=>{ window.__deviceClass = 'pc'; __ds.menus.showSettings('display'); return 1; })()`);
console.log('click Detail Low ->', await b.evalIn(`(()=>{ document.querySelector('.seg[data-row=detail] button[data-v=low]').click(); return JSON.stringify({ detail: window.__dsDetail, saved: __ds.save ? __ds.save.settings.detail : 'n/a' }); })()`));
console.log('click Reduce motion On ->', await b.evalIn(`(()=>{ __ds.menus.showSettings('access'); document.querySelector('.seg[data-row=reduceMotion] button[data-v=true]').click(); return document.body.classList.contains('rm'); })()`));
for (const [cls, tab, w, h, mob, name] of [['pc', 'game', 1280, 720, false, 'game_pc'], ['phone', 'controls', 844, 390, true, 'controls_phone'], ['thor', 'controls', 1280, 720, false, 'controls_thor'], ['pc', 'display', 960, 540, false, 'display_pc'], ['phone', 'access', 844, 390, true, 'access_phone']]) {
  await b.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: mob }); await wait(300);
  await b.evalIn(`(()=>{ window.__deviceClass = '${cls}'; document.body.dataset.mode = 'start'; __ds.menus.showSettings('${tab}'); return 1; })()`); await wait(700); await b.shot('settings_' + name);
}
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(bad ? 1 : 0), 300);
