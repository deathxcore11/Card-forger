import { launch, wait } from './cdp.mjs';
// Pad and touch on the menus: the pad ring moves between buttons, [A] presses, [B] goes back, a tap works, and the ring is gold. Pictures with the ring on.   node test/browser-pad.mjs <outdir>
const b = await launch({ out: process.argv[2], query: '?seed=3&debug' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }); await wait(3000);
const ev = js => b.evalIn(`(async()=>{ const P = await import('/src/core/padnav.js'); ${js} })()`);
await b.evalIn(`(()=>{ document.body.dataset.mode = 'start'; document.getElementById('startScreen').classList.add('on'); __ds.menus.showMain(); return 1; })()`); await wait(800);
console.log('ring after move down', await ev(`P.move('down'); const e = P.ringEl(); return e ? e.id + ' ring=' + getComputedStyle(e).outlineColor + ' ' + getComputedStyle(e).outlineWidth : 'none';`)); await b.shot('pad_main_ring');
console.log('A opens', await ev(`P.press(); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.screen.on h2, .screen.on h1')].map(h => h.textContent).join('|');`)); await b.shot('pad_library');
console.log('B returns', await ev(`P.back(); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.screen.on h2, .screen.on h1')].map(h => h.textContent).join('|');`));
console.log('settings: move+adjust', await ev(`document.getElementById('mSettings').click(); await new Promise(r => setTimeout(r, 400)); P.move('down'); P.move('down'); const e = P.ringEl(); const before = document.querySelector('.setShake').value; P.adjust(-1); return JSON.stringify({ ring: e && (e.className || e.tagName), shakeBefore: before, shakeAfter: document.querySelector('.setShake').value });`)); await b.shot('pad_settings_ring');
await b.evalIn(`(()=>{ __ds.menus.showMain(); return 1; })()`); await wait(400);
console.log('touch tap on PLAY', await b.evalIn(`(async()=>{ document.getElementById('mPlay').click(); await new Promise(r => setTimeout(r, 400)); return [...document.querySelectorAll('.screen.on h2, .screen.on h1')].map(h => h.textContent).join('|'); })()`));
console.log('errors', JSON.stringify(await b.evalIn('JSON.stringify(window.__errs.slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
