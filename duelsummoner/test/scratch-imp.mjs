import { launch, wait } from './cdp.mjs';
const b = await launch({ out: 'C:/Users/masai/AppData/Local/Temp/vid', query: '?seed=1' });
await wait(2000);
console.log(await b.evalIn(`(async()=>{ try { const m = await import('/src/view/fxlab.js'); return 'ok ' + Object.keys(m); } catch (e) { return 'ERR ' + e.message + ' ' + (e.stack||'').slice(0,300); } })()`));
b.close(); setTimeout(() => process.exit(0), 300);
