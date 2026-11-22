// A deterministic player bot: given the game state it returns one input record per tick. Used to record tapes and to
// drive balance runs. It thinks ten times a second and handles level-up / chest / Altar / shop offers through menu input.
import { quantise, emptyRecord, MENU_TAKE, MENU_REDRAW } from '../src/sim/input.js';
import { DUELISTS } from '../src/data/cards.js';

export function newBot(opts) { return { rec: emptyRecord(), cmd: { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false }, dashAt: -9, tick: 0, focus: !!(opts && opts.focus) }; }

function score(g, c, focus) {
  const D = DUELISTS[g.field.duelist], pair = [D.start, D.second];
  if (c.kind === 'fusion') return 1000;
  if (c.kind === 'tribute') return 1; if (c.kind === 'banish') return 2;
  if (c.kind === 'item') return 50; if (c.kind === 'blessing') return 50;
  if (c.kind === 'monster') { const m = g.field.monsters.find(x => x && x.id === c.id), isPair = pair.includes(c.id); return focus ? (isPair ? (c.isNew ? 90 : 85) : 25) : (c.isNew ? 60 : 40) + (m ? 0 : 0); }
  if (c.kind === 'spell') return ({ 'swift-draw': 50, 'collectors-eye': 48, 'kindling-rite': 45, 'deep-marks': 40, 'runners-sash': 35, 'heart-of-the-cards': 38 })[c.id] || 30;
  if (c.kind === 'trap') return 33; return c.id === 'second-wind' ? (g.p.hp < 40 ? 80 : 20) : 45;
}

export function botRecord(g, bot) {
  const rec = bot.rec; rec.menu = 0;
  if (g.offer) {                                                       // choose like a player would
    let best = 0, bs = -1; g.offer.cards.forEach((c, i) => { if (c.sold) return; const s = score(g, c, bot.focus); if (s > bs) { bs = s; best = i; } });
    if (g.offer.type === 'shop') { rec.menu = g.coins >= (g.offer.cards[best].price || 1e9) && !g.offer.cards[best].sold ? MENU_TAKE + best : 12; }
    else rec.menu = MENU_TAKE + best;
    return rec;
  }
  if (bot.tick++ % 6 === 0) {
    const p = g.p, e = g.en; let rx = 0, rz = 0, crowd = 0;
    for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = p.x - e.x[i], dz = p.z - e.z[i], d2 = dx * dx + dz * dz; if (d2 < 100) { const w = 1 / (d2 + 0.5); rx += dx * w; rz += dz * w; if (d2 < 6) crowd++; } }
    for (const sp of g.sp) if (sp.alive && !sp.dead) { const dx = p.x - sp.x, dz = p.z - sp.z, d2 = dx * dx + dz * dz; if (d2 < 150) { rx += dx / (d2 + 1) * 3; rz += dz / (d2 + 1) * 3; } }
    let ax = 0, az = 0, best = 400; const m = g.pick;
    for (let i = 0; i < m.max; i++) { if (!m.alive[i]) continue; const dx = m.x[i] - p.x, dz = m.z[i] - p.z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; ax = dx; az = dz; } }
    const al = Math.sqrt(ax * ax + az * az) || 1; ax /= al; az /= al;
    let cx = 0, cz = 0, target = g.chests.find(c => !c.open);
    if (!target && g.world) { const a = g.world.altar; if (a && !a.used && g.t > 20) target = a; }
    if (target) { cx = target.x - p.x; cz = target.z - p.z; const l = Math.sqrt(cx * cx + cz * cz) || 1; cx /= l; cz /= l; }
    let sx = 0, sz = 0;
    for (const t of g.tele) if (t.on && t.type === 0) { const rx2 = p.x - t.x, rz2 = p.z - t.z, along = rx2 * t.dx + rz2 * t.dz, side = rx2 * -t.dz + rz2 * t.dx; if (along > -2 && along < t.len + 2 && Math.abs(side) < t.w / 2 + 1.6) { const sg = side >= 0 ? 1 : -1; sx += -t.dz * sg; sz += t.dx * sg; } }
    let bx = 0, bz = 0; const w = g.sp.find(s => s.kind === 'warden' && s.alive);
    if (w) { const tx = w.x - Math.sin(w.face) * 6 - p.x, tz = w.z - Math.cos(w.face) * 6 - p.z, l = Math.sqrt(tx * tx + tz * tz) || 1; bx = tx / l; bz = tz / l; }
    let dx = rx * 8 + ax * 0.6 + cx * (target ? 1.5 : 0) + bx * 1.4 - p.x * 0.02 + sx * 14, dz = rz * 8 + az * 0.6 + cz * (target ? 1.5 : 0) + bz * 1.4 - p.z * 0.02 + sz * 14;
    const dl = Math.sqrt(dx * dx + dz * dz) || 1; dx /= dl; dz /= dl;
    const c = bot.cmd; c.f = -dz; c.r = dx; c.yaw = 0; c.jump = false; c.slide = false;
    c.dash = crowd >= 3 && g.t - bot.dashAt > 1.2; c.use = !!(target && Math.hypot(target.x - p.x, target.z - p.z) < 2.5);
    if (c.dash) bot.dashAt = g.t;
  } else { bot.cmd.dash = false; bot.cmd.use = false; }
  quantise(bot.cmd, rec);
  return rec;
}
