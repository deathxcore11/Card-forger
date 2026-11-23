import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&seed=3' });
await b.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
const info = await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.pickDuelist('kael'); D.start(); await new Promise(r => setTimeout(r, 1200)); g.god = true; g.opts.offers = false;
  const S = g.world.shrines; const cnt = a => S.filter(s => Math.hypot(s.x - a.x, s.z - a.z) < 26).length; const anchor = S.slice().sort((a, b) => cnt(b) - cnt(a))[0]; const near = S.filter(s => Math.hypot(s.x - anchor.x, s.z - anchor.z) < 26); near.forEach((s, i) => { s.best = ['rare', 'epic', 'common', 'legendary'][i % 4]; });
  D.props.group.children.slice().forEach(c => D.props.group.remove(c)); D.props._build(g.world); await new Promise(r => setTimeout(r, 300));
  const cx = near.reduce((a, s) => a + s.x, 0) / near.length, cz = near.reduce((a, s) => a + s.z, 0) / near.length;
  g.p.x = cx; g.p.z = cz - 24; g.p.y = 0; D.camHold = { x: cx, y: 26, z: cz - 34, lx: cx, ly: 0, lz: cz }; await new Promise(r => setTimeout(r, 700));
  return { n: near.length, best: near.map(s => s.best), pos: [cx, cz] }; })()`);
console.log(JSON.stringify(info)); await wait(900); await b.shot('shrines_colours');
// the hold, the offer and Decline
await b.evalIn(`(async()=>{ const D = window.__ds, g = D.game; D.props.group.children.slice().forEach(c => D.props.group.remove(c)); D.props._build(g.world); D.camHold = null; const s = g.world.shrines[0]; g.p.x = s.x; g.p.z = s.z; g.p.y = s.y; g.opts.offers = true; await new Promise(r => setTimeout(r, 6500)); return 1; })()`);
await b.shot('shrine_offer');
console.log(await b.evalIn(`(async()=>{ const g = __ds.game, s = g.world.shrines[0]; const btn = [...document.querySelectorAll('#offerBtns button')].map(x => x.textContent); const cards = [...document.querySelectorAll('#offerCards .card')].map(c => c.className + ' | ' + c.querySelector('div:nth-of-type(2)').textContent); const dec = [...document.querySelectorAll('#offerBtns button')].find(x => /DECLINE/.test(x.textContent)); if (dec) dec.click(); await new Promise(r => setTimeout(r, 400)); return JSON.stringify({ btn, cards, afterDecline: { done: s.done, charge: s.charge, offer: !!g.offer } }); })()`));
console.log(JSON.stringify(await b.evalIn('window.__errs.slice(0,3)'))); b.close(); setTimeout(() => process.exit(0), 300);


