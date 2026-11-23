import { launch, wait } from './cdp.mjs';
const b = await launch({ out: 'C:/Users/masai/AppData/Local/Temp/vid', query: '?seed=1' });
await wait(2500);
console.log(JSON.stringify(await b.evalIn('JSON.stringify((window.__errs||[]).slice(0,3))')));
b.close(); setTimeout(() => process.exit(0), 300);
