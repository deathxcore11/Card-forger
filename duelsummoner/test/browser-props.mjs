// Chrome look at the map objects: vases, Witness Stones, Relic Broker, Shrine of Tribute, Card Chests (region test set, ?props).
import { launch, wait } from './cdp.mjs';
const b = await launch({ out: process.argv[2], query: '?debug&props' });
const H = `const D = window.__ds, g = D.game, wait = ms => new Promise(r => setTimeout(r, ms));
const boot = () => { D.freeze(false); D.start(); };
const go = async (o, yaw, back) => { D.freeze(false); g.god = true; g.opts.offers = false; g.spawnAcc = -1e9; g.golemT = 1e9; g.flags.warden = g.flags.idols = true; g.boss.state = 'dead'; g.en.alive.fill(0); g.field.monsters.fill(null); g.cardT = 1e9;
  const a = yaw; g.p.x = o.x + Math.sin(a) * back; g.p.z = o.z + Math.cos(a) * back; g.p.y = o.y; g.p.vx = g.p.vz = 0; D.input.yaw = a; D.chase.reset(); await wait(500); D.freeze(true); await wait(250); };`;
const R = {};
const sh = async (name, body) => { try { R[name] = await b.evalIn('(async()=>{' + H + body + '})()'); await b.shot(name); } catch (e) { R[name] = { ERROR: e.message.slice(0, 300) }; } };
await sh('p1-witness-stones', `boot(); const s = g.world.stones[0]; await go(s, 0, 9); return { prompt: (g.p.x = s.x, g.p.z = s.z + 1.5, g.step(1/60, { f:0, r:0, yaw:0, use:false }), g.prompt) };`);
await sh('p2-relic-broker', `boot(); const s = g.world.broker; await go(s, 0.4, 11); return { stock: s.stock.map(x => x.id + ' ' + x.price) };`);
await sh('p3-shrine', `boot(); const s = g.world.shrines[0]; await go(s, 0, 10); g.world.shrines[0].charge = 3.3; await wait(400); return { charge: s.charge };`);
await sh('p4-card-chest', `boot(); const s = g.world.cchests[3]; await go(s, 0.5, 8); return { rarity: s.rarity, pos: [s.x | 0, s.y, s.z | 0] };`);
await sh('p5-vases', `boot(); const v = g.world.vases[0]; await go(v, 0.2, 8); return { vases: g.world.vases.length, banded: g.world.vases.filter(x => x.banded).length };`);
await sh('p6-shop-screen', `boot(); const s = g.world.broker; await go(s, 0.4, 11); g.p.x = s.x; g.p.z = s.z + 1; g.coins = 80; D.freeze(false); g.step(1/60, { f:0, r:0, yaw:0, use: true }); D.drive(0.02); await wait(400); return { offer: g.offer && g.offer.type, mode: D.mode() };`);
R.pageErrors = JSON.parse(await b.evalIn('JSON.stringify(window.__errs || [])')).filter(e => !/404/.test(e));
console.log(JSON.stringify(R, null, 1)); b.close(); process.exit(0);

