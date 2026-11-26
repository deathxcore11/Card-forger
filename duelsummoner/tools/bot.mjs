// A deterministic player bot: given the game state it returns one input record per tick. Used to record tapes and to
// drive balance runs. It thinks ten times a second and handles level-up / chest / Altar / shop offers through menu input.
import { quantise, emptyRecord, takeCode, MENU_LEAVE } from '../src/sim/input.js';
import { DUELISTS } from '../src/data/cards.js';
import { ITEMS, BLESSINGS } from '../src/data/items.js';
import { Flow } from '../src/sim/flow.js';
import { chestPrice } from '../src/sim/world.js';
import { ENCOUNTERS as EN } from '../src/data/encounters.js';
const wp = { x: 0, z: 0 };

export function newBot(opts) { return { rec: emptyRecord(), cmd: { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false }, dashAt: -9, hold: false, flow: null, navAt: -1, navKey: '', lx: 0, lz: 0, still: 0, panic: 0, stuck: 0, wander: 0, wang: 0, tick: 0, focus: !!(opts && opts.focus), world: !!(opts && opts.world), hop: opts && opts.hop !== undefined ? opts.hop : Number(process.env.HOP || 0), hopSeed: 12345, hopWait: 0, hopDecided: false, hopOk: false, hopP() { return this.hop; } }; }       // hop: the share of landings on which the bot hits a frame-perfect slide hop (HOP=0.5 in the environment): the rest are hopped late, which gives nothing

function score(g, c, focus) {
  if (process.env.REACHBOT && c.id === 'widening-rite') return 500;
  if (g._prefer && g._prefer.includes(c.id)) return 600 + (c.isNew ? 0 : 50);       // a build bot takes its build's cards first       // the Reach balance check: the bot takes Widening Rite at every offer that has it
  const D = DUELISTS[g.field.duelist], pair = [D.start, D.second];
  if (c.kind === 'fusion') return 1000;
  if (c.kind === 'final') return c.id === 'close' ? 100 : 1;
  if (c.kind === 'tribute') return 1; if (c.kind === 'banish') return 2;
  if (c.kind === 'item' || c.kind === 'blessing') { if (!g.skilledBuild) return 50; const rb = { common: 0, rare: 12, epic: 26, legendary: 45 }[c.rarity] || 0, M = ITEMS[c.id] ? ITEMS[c.id].mods : BLESSINGS[c.id] ? BLESSINGS[c.id].mods : {}; let b = 0; for (const k of Object.keys(M)) b += ({ dmgMult: 14, drillCard: 10, drillMon: 12, drillTrap: 6, drillSpell: 8, crit: 8, critDmg: 8, maxLp: 0.25, armour: 9, regen: 10, move: 12, cardRate: 10, monsterRate: 12, reach: 6, xp: 6, luck: 3, pickup: 2, killHeal: 4, thorns: 0.4, heartMul: 4, dash: 3, dashCd: 4, airJumps: 3, jumpH: 2, bossDmg: 5, sight: 3 })[k] * (M[k] > 1 ? 1 : M[k] * 10 + 0.5) || 0; if (ITEMS[c.id] && ITEMS[c.id].proc) b += 14; return 48 + rb + Math.min(30, b); }
  if (c.kind === 'monster') { const m = g.field.monsters.find(x => x && x.id === c.id), isPair = pair.includes(c.id); return focus ? (isPair ? (c.isNew ? 90 : 85) : 25) : (c.isNew ? 60 : 40) + (m ? 0 : 0); }
  if (c.kind === 'spell') return ({ 'swift-draw': 50, 'collectors-eye': 48, 'kindling-rite': 45, 'deep-marks': 40, 'runners-sash': 35, 'heart-of-the-cards': 38 })[c.id] || 30;
  if (c.kind === 'trap') return 33; return c.id === 'second-wind' ? (g.p.hp < 40 ? 80 : 20) : 45;
}

export function botRecord(g, bot) {
  const rec = bot.rec; rec.menu = 0;
  if (g.offer) {                                                       // choose like a player would
    let best = 0, bs = -1; g.offer.cards.forEach((c, i) => { if (c.sold) return; const s = score(g, c, bot.focus); if (s > bs) { bs = s; best = i; } });
    if (g.offer.type === 'shop') { rec.menu = g.coins >= (g.offer.cards[best].price || 1e9) && !g.offer.cards[best].sold ? takeCode(best) : MENU_LEAVE; }
    else rec.menu = takeCode(best);
    return rec;
  }
  if (bot.tick++ % 6 === 0) {
    const p = g.p, e = g.en; let rx = 0, rz = 0, crowd = 0;
    // stuck (pinned by a crowd or a wall corner): for a second and a half ignore the crowd and push toward the target
    if (Math.hypot(p.x - bot.lx, p.z - bot.lz) < 0.3) { bot.still++; bot.stuck++; } else { bot.still = 0; bot.stuck = 0; } bot.lx = p.x; bot.lz = p.z;
    if (bot.stuck > 25) { bot.wander = 30; bot.wang = g.tickN * 0.37; bot.stuck = 0; }
    if (bot.still >= 8) { bot.panic = 15; bot.still = 0; } else if (bot.panic > 0) bot.panic--;
    for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = p.x - e.x[i], dz = p.z - e.z[i], d2 = dx * dx + dz * dz; if (d2 < 100) { const w = 1 / (d2 + 0.5); rx += dx * w; rz += dz * w; if (d2 < 6) crowd++; } }
    for (const sp of g.sp) if (sp.alive && !sp.dead) { const dx = p.x - sp.x, dz = p.z - sp.z, d2 = dx * dx + dz * dz; if (d2 < 150) { rx += dx / (d2 + 1) * 3; rz += dz / (d2 + 1) * 3; } }
    if (crowd >= 3) {                                                    // pinned: do not run straight away, run through the widest gap in the ring of enemies (and not into a trunk or a boulder)
      const SEC = 16, dens = new Float32Array(SEC); const add = (dx, dz, w) => { const a = Math.atan2(dz, dx), k = ((Math.round(a / (Math.PI * 2) * SEC) % SEC) + SEC) % SEC; dens[k] += w; };
      for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - p.x, dz = e.z[i] - p.z, d2 = dx * dx + dz * dz; if (d2 < 196) add(dx, dz, 1 / (d2 + 1)); }
      if (g.colliders) for (const c of g.colliders.list) { const dx = c.x - p.x, dz = c.z - p.z, d2 = dx * dx + dz * dz; if (d2 < 100 && p.y < c.top - 0.3) add(dx, dz, 2 / (d2 + 0.5)); }
      let bk = 0, bs = 1e9; for (let k = 0; k < SEC; k++) { const s = dens[k] + 0.5 * (dens[(k + 1) % SEC] + dens[(k + SEC - 1) % SEC]); if (s < bs) { bs = s; bk = k; } }
      const ga = bk / SEC * Math.PI * 2, mag = Math.hypot(rx, rz) + 0.2; rx = Math.cos(ga) * mag; rz = Math.sin(ga) * mag;
    }
    let ax = 0, az = 0, best = 400; const m = g.pick;
    for (let i = 0; i < m.max; i++) { if (!m.alive[i]) continue; const dx = m.x[i] - p.x, dz = m.z[i] - p.z, d2 = dx * dx + dz * dz; const dw = g.skilledBuild && m.kind[i] >= 2 ? d2 * 0.08 : d2; if (dw < best) { best = dw; ax = dx; az = dz; } }
    const al = Math.sqrt(ax * ax + az * az) || 1; ax /= al; az /= al;
    let cx = 0, cz = 0, target = g.chests.find(c => c.guaranteed && !c.open) || g.chests.find(c => !c.open);       // the banner says a Fusion chest has appeared: a player goes to it first
    if (g.mode && g.mode !== 'classic' && g.gate && g.gate.awake && g.gate.state === 'closed') { if (bot.awakeT === undefined) bot.awakeT = g.sc; if (!target || g.sc - bot.awakeT > 40) target = null; } else bot.awakeT = undefined;
    if (!target && g.world) { const a = g.world.altar; if (a && !a.used && g.t > 20) target = a; }
    let hold = false;
    if (!target && bot.world && g.world && g.mode && g.mode !== 'classic' && !(g.gate && g.gate.awake) && !(g.sp.find(s => s.alive && !s.dead && s.role !== 'elite'))) {       // an elite wandering about does not stop shopping; a boss does       // a player who goes for the nearest free chest, shrine or stone within about 90 m
      let best = null, bd = (+process.env.BOT_REACH || 90) ** 2; const W = g.world, consider = (o, shrine) => { const d = (o.x - p.x) ** 2 + (o.z - p.z) ** 2; if (d < bd) { bd = d; best = o; bot.shrineT = shrine; } };
      for (const c of W.cchests) if (!c.open && (c.free || g.coins >= chestPrice(g))) consider(c, false);
      if (W.broker && g.coins >= 30 && W.broker.stock.some(s => !s.sold && s.price <= g.coins)) consider(W.broker, false);       // an affordable Broker is a stop too for (const s of W.shrines) if (!s.done) consider(s, true); for (const s of W.stones) if (!s.used) consider(s, false);
      if (best) { target = best; hold = bot.shrineT && Math.hypot(best.x - p.x, best.z - p.z) < EN.shrines.radius - 0.8; bot.shopping = !bot.shrineT && Math.hypot(best.x - p.x, best.z - p.z) < (+process.env.BOT_SHOP || 40); } else bot.shopping = false;       // holding the price and within 40 m of a chest or the Broker: walk there and open it, whoever is chasing
    }
    if (!target && g.mode && g.mode !== 'classic' && g.sc >= 335 && g.gate && g.gate.state === 'closed' && !g.circle && !g.door) { target = { x: g.map.gate.x, z: g.map.gate.z }; hold = g.gate.awake && Math.hypot(target.x - p.x, target.z - p.z) < 3; }       // by about 5:35 the bot is at the gate, so it can walk in the moment it wakes
    const gb = g.sp.find(s => s.alive && s.role === 'gate');                            // the gate boss: close in to about 9 m so the summons can hit it, strafing around it
    const tb = g.sp.find(s => s.alive && !s.dead && s.role !== 'gate');                // a timed boss or elite: keep it in range of the monsters
    if (tb && !target && !(bot.goalFn && tb.asleep)) { const dd = Math.hypot(tb.x - p.x, tb.z - p.z); if (dd > 13) target = { x: tb.x, z: tb.z }; }
    if (gb && !target) { const dd = Math.hypot(gb.x - p.x, gb.z - p.z); if (dd > 11) target = { x: gb.x, z: gb.z }; }
    if (g.mode && g.mode !== 'classic' && !target) {                                    // stage run: gate, Descent Circle, Final Altar
      if (g.circle) target = g.circle;
      else if (g.altar && !g.altar.used) { target = g.altar; hold = Math.hypot(target.x - p.x, target.z - p.z) < 3; }
      else if (g.gate && g.gate.awake && g.gate.state === 'closed' && !bot.noGateSense) { target = { x: g.map.gate.x, z: g.map.gate.z }; hold = Math.hypot(target.x - p.x, target.z - p.z) < 3; }
    }
    if (!target && bot.goalFn) { const gl = bot.goalFn(g, bot); if (gl) { target = gl.t; hold = !!gl.hold; } }       // the big desert: where to go when there is nothing urgent (explore, a pocket, the door once it is known)
    bot.hold = hold; bot.urgent = !!(g.mode && g.mode !== 'classic' && target && (g.circle || g.altar || (g.gate && g.gate.awake))) || !!(target && bot.shopping);
    if (target) {                                                              // walk the way a path exists, not through walls
      const key = Math.round(target.x) + ',' + Math.round(target.z);
      if (!bot.flow) { bot.flow = new Flow(); bot.flow.col = g.colliders; bot.flow.rebuild(); }       // the bot walks round trunks and boulders like the horde does
      if (key !== bot.navKey || g.tickN - bot.navAt > 30) { bot.flow.update(target.x, target.z); bot.navKey = key; bot.navAt = g.tickN; }
      const far = Math.hypot(target.x - p.x, target.z - p.z) > 4;
      if (far && bot.flow.next(p.x, p.z, wp)) { cx = wp.x - p.x; cz = wp.z - p.z; } else { cx = target.x - p.x; cz = target.z - p.z; } const l = Math.sqrt(cx * cx + cz * cz) || 1; cx /= l; cz /= l; }
    let sx = 0, sz = 0;
    let danger = false;
    for (const t of g.tele) if (t.on && t.type === 1) {                                  // blast circle (Warden slam, Golem...): step out of it
      const cx2 = p.x - t.x, cz2 = p.z - t.z, dd = Math.hypot(cx2, cz2);
      if (dd < t.r + 2.2) { sx += cx2 / (dd || 1) * 2.2; sz += cz2 / (dd || 1) * 2.2; danger = true; }
    } else if (t.on && t.type === 2) {                                                  // cone or blade arc: leave it sideways
      const fx2 = p.x - t.x, fz2 = p.z - t.z, dd = Math.hypot(fx2, fz2);
      if (dd < t.r + 2 && (fx2 * t.dx + fz2 * t.dz) / (dd || 1) > Math.cos((t.arc / 2 + 18) * Math.PI / 180)) {
        const side = fx2 * -t.dz + fz2 * t.dx, sg = side >= 0 ? 1 : -1; sx += -t.dz * sg * 2 + fx2 / (dd || 1); sz += t.dx * sg * 2 + fz2 / (dd || 1); danger = true;
      }
    }
    for (const t of g.tele) if (t.on && t.type === 0) { const rx2 = p.x - t.x, rz2 = p.z - t.z, along = rx2 * t.dx + rz2 * t.dz, side = rx2 * -t.dz + rz2 * t.dx; if (along > -2 && along < t.len + 2 && Math.abs(side) < t.w / 2 + 1.6) { const sg = side >= 0 ? 1 : -1; sx += -t.dz * sg; sz += t.dx * sg; } }
    let bx = 0, bz = 0; const w = g.sp.find(s => s.kind === 'warden' && s.alive);
    if (w) { const tx = w.x - Math.sin(w.face) * 6 - p.x, tz = w.z - Math.cos(w.face) * 6 - p.z, l = Math.sqrt(tx * tx + tz * tz) || 1; bx = tx / l; bz = tz / l; }
    const rw = bot.panic > 0 ? 0.5 : bot.urgent ? 2.5 : 8; let dx = rx * rw + ax * 0.6 + cx * (target ? (bot.panic > 0 || bot.urgent ? 6 : 1.5) : 0) + bx * 1.4 - (target ? 0 : p.x * 0.02) + sx * 14, dz = rz * rw + az * 0.6 + cz * (target ? (bot.panic > 0 || bot.urgent ? 6 : 1.5) : 0) + bz * 1.4 - (target ? 0 : p.z * 0.02) + sz * 14;
    if (bot.wander > 0) { bot.wander--; dx = Math.cos(bot.wang); dz = Math.sin(bot.wang); }
    const dl = Math.sqrt(dx * dx + dz * dz) || 1; dx /= dl; dz /= dl;
    const c = bot.cmd; c.f = -dz; c.r = dx; c.yaw = 0; c.jump = false; c.slide = false;
    c.dash = (crowd >= 3 || bot.panic > 12 || danger) && g.t - bot.dashAt > 1.2; c.use = hold || !!(target && Math.hypot(target.x - p.x, target.z - p.z) < 2.5);
    if (c.dash) bot.dashAt = g.t;
    if (bot.hop > 0 && !c.dash) {       // slide-hop bot: on each landing it either hops at once with slide held (success) or waits 8 ticks first (a miss); a LCG of its own, so the sim's streams are untouched
      if (!p.grounded) bot.hopDecided = false;
      else if (!bot.hopDecided) { bot.hopDecided = true; bot.hopSeed = (Math.imul(bot.hopSeed, 1103515245) + 12345) >>> 0; bot.hopOk = (bot.hopSeed >>> 16) / 65536 < bot.hopP(); bot.hopWait = bot.hopOk ? 0 : 8; }
      if (p.grounded) { if (bot.hopWait > 0) bot.hopWait--; else { c.jump = true; c.slide = true; } }
    }
  } else { bot.cmd.dash = false; bot.cmd.use = bot.hold; }
  if (bot.rider && !g.offer) bot.rider(g, bot, bot.cmd);       // a riding layer on top (tools/bigbot.mjs builds)
  quantise(bot.cmd, rec);
  return rec;
}





