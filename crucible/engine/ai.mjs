// Lost Memories CPU players. Every function here takes a VIEW (duel.viewFor), never the
// full state, so the CPU cannot see veiled cards, set traps, hands or deck order.
// Levels: 0 Novice, 1 Adept, 2 Master. `policy` lets the simulator play a build family.
import { roleOf, wheelEdge, terrainFavours } from './cards.mjs';
import { planChain } from './duel.mjs';

const TRAP_ORDER = ['destroy', 'destroyAll', 'bounce', 'freeze', 'position', 'weaken', 'pump', 'burn', 'heal', 'draw', 'flip', 'revive'];

function baseStats(db, view, inst) {
  const c = db.byId.get(inst.id);
  let a = c.atk + (inst.t ? db.config.temperBonus : 0) + (inst.ba || 0);
  let d = c.def + (inst.t ? db.config.temperBonus : 0) + (inst.bd || 0);
  if (view.terrain && terrainFavours(db, view.terrain.id, inst.id)) { a += db.config.terrainBonus; d += db.config.terrainBonus; }
  return [Math.max(0, a), Math.max(0, d)];
}

function rivalBoard(db, view) {
  const r = 1 - view.me;
  let ra = 0, count = 0, veiled = 0, sum = 0, attackers = 0, raAttr = null;
  for (const m of view.mon[r]) {
    if (!m) continue; count++;
    if (m.veil) { veiled++; continue; }
    sum += m.ea;
    if (m.ea > ra) { ra = m.ea; raAttr = db.byId.get(m.id).attr; }
    if (m.pos === 'a') attackers++;
  }
  return { ra, count, veiled, sum, attackers, raAttr };
}

function monsterScore(db, view, inst, pos, veiled, rb, level) {
  const [a, d] = baseStats(db, view, inst);
  const attr = db.byId.get(inst.id).attr;
  // The rival's best visible attacker, with the wheel as far as we can see it.
  let threat = rb.ra;
  if (level >= 1 && rb.raAttr && wheelEdge(rb.raAttr, attr, true)) threat += db.config.wheelBonus;
  if (pos === 'a') {
    let mine = a;
    if (level >= 1 && rb.raAttr && wheelEdge(attr, rb.raAttr, true)) mine += db.config.wheelBonus;
    let v = a;
    if (rb.count === 0) v += 400;
    else if (mine > rb.ra && rb.ra > 0) v += 300 + rb.ra / 2;
    if (rb.ra > 0 && threat >= a) v -= (threat - a) + a * 0.7;
    return v;
  }
  let v = d * 0.7 + (d >= threat ? 250 : -150) + (veiled ? 120 : 0);
  if (rb.count === 0 && level >= 1) v -= 200; // an open board wants an attacker
  return v;
}

function relicLift(db, view, plan, usesField) {
  // What the seat's own relics would add to this play. Uses only the seat's own relic state.
  const rel = view.relics, rs = view.rs; if (!rel.length) return [0, 0];
  let a = 0, d = 0, extra = 0;
  if (plan && plan.melded && plan.isMonster) {
    for (const x of rs.nextMeld || []) { a += x.a; d += x.d; }
    const fire = db.byId.get(plan.final.id).attr === 'FIRE';
    if (fire && rel.includes('kindling') && !rs.kindling) { a += 300; d += 300; }
    if (fire && rel.includes('living_furnace') && !rs.furnace && view.terrain) { a += 600; d += 600; }
    if (plan.len >= 3 && rel.includes('copper_loop') && (rs.copper || 0) < 2) { a += 300; d += 300; }
    if (plan.len >= 3 && rel.includes('storm_needle') && (rs.needle || 0) < 3) extra += 300;
    if (plan.len >= 3 && rel.includes('spare_wire') && !rs.spare) extra += 200;
    if (plan.len >= 4 && rel.includes('patient_coil') && !rs.coil) { a += 300; d += 300; }
    if (rel.includes('broken_anvil') && !rs.melded) { a -= 300; d += 600; }
    if (a > 0 && rel.includes('ashen_echo') && !rs.ashen) a += 300;
  }
  if (plan && plan.isMonster && !plan.onTable && !rs.firstMon) {
    if (rel.includes('heavy_crown')) a += 400;
    if (rel.includes('whetstone')) a += 200;
    if (rel.includes('balanced_scales') && rs.scales) d += 300;
  }
  if (plan && plan.isMonster && plan.final.b && !rs.boundPlayed) {
    if (rel.includes('precise_work')) a += 300;
    if (rel.includes('signature')) { a += 300; d += 300; }
  }
  if (usesField && rel.includes('forge_heart') && !rs.forgeHeart) extra += 350;
  return [a, d, extra];
}

// Best play this turn, or null. Returns { action, score }.
export function bestPlay(db, view, level, policy = {}) {
  const me = view.me, hand = view.hand, rb = rivalBoard(db, view);
  const myMons = view.mon[me];
  const free = myMons.some(m => !m);
  const tinder = view.relics.includes('tinder_vow');
  const steady = view.relics.includes('steady_hand') && !view.rs.steady;
  const forceVeil = view.twist === 'fog' || view.law === 'mist';
  const hollow = view.relics.includes('hollow_mask') && !view.rs.hollow;
  let best = null;
  const consider = (action, score) => { if (!best || score > best.score) best = { action, score }; };
  const myBest = myMons.reduce((v, m) => m ? Math.max(v, m.ea) : v, 0);
  const myCount = myMons.filter(Boolean).length;

  const evalChain = (idxs, onto) => {
    const cards = idxs.map(i => hand[i]);
    const ontoM = onto != null ? myMons[onto] : null;
    const plan = planChain(db, cards, ontoM, { tinder, steady });
    const used = idxs.length;
    let cost = (used - 1) * (policy.chainCost ?? db.config.aiChainCost ?? 110) + plan.fizzles * 450;
    if (ontoM && plan.tableLost) cost += ontoM.ea;
    if (plan.isMonster) {
      if (!(plan.onTable || plan.tableLost || free)) return;
      const lift = relicLift(db, view, plan, false);
      const inst = { ...plan.final, ba: (plan.final.ba || 0) + lift[0], bd: (plan.final.bd || 0) + lift[1] };
      const prior = ontoM && plan.onTable ? ontoM.ea : 0;
      const single = !plan.melded && !plan.onTable;
      const variants = [];
      if (single) {
        if (!forceVeil) variants.push(['a', false], ['d', false]);
        variants.push(['d', true]);
        if (forceVeil || hollow) variants.push(['a', true]);
      } else variants.push(['a', false], ['d', false]);
      for (const [pos, veiled] of variants) {
        if (level === 0 && (pos !== 'a' || veiled) && !forceVeil) continue;
        let v = monsterScore(db, view, inst, pos, veiled, rb, level) - prior - cost + (lift[2] || 0);
        if (plan.melded) v += (policy.meldBonus || 0) + (plan.len >= 3 ? (policy.chainBonus || 0) : 0);
        if (plan.melded && db.config.longMeldRest && plan.len >= db.config.longMeldRest) v -= pos === 'a' ? 500 : 0;
        if (veiled && pos === 'd') v += policy.veilBonus || 0;
        if (single && !veiled && db.config.soloArrival && level >= 1) {
          const ty = db.byId.get(inst.id).type;
          if (ty === 'Zombie' && hand.length - 1 < db.config.handMax) { let b = 0; for (const g of view.gy[me]) if (db.isMonster(g) && db.byId.get(g).atk <= 1500) b = Math.max(b, db.byId.get(g).atk); if (b) v += 150 + b * 0.25; }
          else if (ty === 'Fairy') v += view.lp[me] < 4000 ? 300 : 110;
          else if (ty === 'Machine') v += 260;
          else if (ty === 'Spellcaster' && view.deckCount[me] > 0) v += 320;
        }
        if (plan.melded && db.byId.get(plan.final.id).attr === 'FIRE') v += policy.fireBonus || 0;
        if (plan.final.b) v += policy.boundBonus || 0;
        const action = { t: 'play', hand: idxs.slice(), onto: onto ?? null, pos };
        if (veiled) action.veiled = true;
        consider(action, v);
      }
      return;
    }
    // the chain ends on a Spell, Trap, Field or Equip that is then played
    const id = plan.final.id, role = roleOf(db, id);
    let v = null;
    const r = 1 - me;
    if (role === 'field') {
      if (view.terrain && view.terrain.lock) return;
      const f = db.fieldOf.get(id);
      const fav = x => f.attr ? db.byId.get(x).attr === f.attr : f.types.has(db.byId.get(x).type);
      let mine = 0, theirs = 0;
      for (const m of myMons) if (m && fav(m.id)) mine++;
      for (const m of view.mon[r]) if (m && !m.veil && fav(m.id)) theirs++;
      let inHand = 0; hand.forEach((c, i) => { if (!idxs.includes(i) && db.isMonster(c.id) && fav(c.id)) inHand++; });
      if (view.terrain && view.terrain.id === id && !view.terrain.law) return;
      v = 420 * (mine - theirs) + 130 * inHand + (policy.fieldBonus || 0) + (relicLift(db, view, null, true)[2] || 0);
      if (view.terrain && view.terrain.owner === r) { const cur = db.fieldOf.get(view.terrain.id); let hurtThem = 0; for (const m of view.mon[r]) if (m && !m.veil && cur && (cur.attr ? db.byId.get(m.id).attr === cur.attr : cur.types.has(db.byId.get(m.id).type))) hurtThem++; v += 300 * hurtThem; }
      if (level === 0) v = 50;
    } else if (role === 'equip') {
      if (tinder || myCount === 0) return;
      v = 330 + (myBest <= rb.ra && myBest + 500 > rb.ra ? 300 + rb.ra / 2 : 0);
    } else if (role === 'trap') {
      if (!view.traps[me].some(t => !t)) return;
      const setCount = view.traps[me].filter(Boolean).length;
      v = (level === 0 ? 60 : 380) - setCount * 150 + (rb.ra > myBest ? 250 : 0) + (policy.trapBonus || 0);
    } else if (role === 'spell') {
      const tag = db.tagOf.get(id);
      switch (tag.fx) {
        case 'burn': v = tag.n >= view.lp[r] ? 100000 : tag.n * 0.55; break;
        case 'heal': v = tag.n * (view.lp[me] < 3000 ? 0.7 : 0.2); break;
        case 'destroy': if (!rb.count) return; v = rb.ra ? 250 + rb.ra * 0.75 + (rb.ra > myBest ? 400 : 0) : 500; break;
        case 'destroyAll': { if (!rb.count) return; let mineLoss = 0; if (tag.n === 1) for (const m of myMons) if (m) mineLoss += 300 + m.ea * 0.75; v = rb.sum * 0.75 + rb.count * 300 + rb.veiled * 500 - mineLoss; break; }
        case 'bounce': if (!rb.count) return; v = rb.ra ? 150 + rb.ra * 0.5 + (rb.ra > myBest ? 300 : 0) : 300; break;
        case 'pump': if (!myCount) return; v = tag.n * 0.6 + (myBest <= rb.ra && myBest + tag.n > rb.ra ? 300 + rb.ra / 2 : 0); break;
        case 'weaken': if (!rb.count || !rb.ra) return; v = tag.n * 0.5 + (myBest <= rb.ra && myBest > rb.ra - tag.n ? 300 + rb.ra / 2 : 0); break;
        case 'draw': if (!view.deckCount[me]) return; v = 180 * tag.n; break;
        case 'flip': if (!rb.veiled) return; v = 120 * rb.veiled; break;
        case 'freeze': v = rb.ra > myBest ? 500 + 200 * tag.n : 80; break;
        case 'position': if (!rb.count) return; v = 200; break;
        case 'revive': { let b = 0; for (const g of view.gy[me]) if (db.isMonster(g)) b = Math.max(b, db.byId.get(g).atk); if (!b || !free) return; v = b * 0.9; break; }
      }
      if (level === 0) v = Math.min(v, 300);
    } else return; // fuel cannot be played alone
    if (v == null) return;
    consider({ t: 'play', hand: idxs.slice(), onto: onto ?? null }, v - cost);
  };

  const n = hand.length;
  if (policy.freeOnly) { for (let i = 0; i < n; i++) if (!db.isMonster(hand[i].id)) evalChain([i], null); return best; }
  const maxLen = Math.min(db.config.maxChain || 9, level === 0 ? 1 : level === 1 ? 2 : (policy.maxChain || 4));
  for (let i = 0; i < n; i++) {
    evalChain([i], null);
    if (maxLen < 2) continue;
    myMons.forEach((m, z) => { if (m && !m.veil) evalChain([i], z); });
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      evalChain([i, j], null);
      if (maxLen < 3) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        evalChain([i, j, k], null);
        if (maxLen < 4) continue;
        for (let l = 0; l < n; l++) if (l !== i && l !== j && l !== k) evalChain([i, j, k, l], null);
      }
    }
  }
  return best;
}

function attackGain(db, view, X, T, level, rb) {
  if (!T) return X.ea >= view.lp[1 - view.me] ? 1e6 : 1000 + X.ea;
  if (T.veil) {
    const need = level === 0 ? 900 : level === 1 ? 1500 : (view.lp[view.me] > 4000 ? 1500 : 1900);
    return X.ea >= need ? 120 + (X.ea - need) / 10 : -1;
  }
  const ax = db.byId.get(X.id).attr, at = db.byId.get(T.id).attr;
  let a = X.ea, d = T.pos === 'a' ? T.ea : T.ed;
  if (level >= 1 || true) { if (wheelEdge(ax, at, true)) a += db.config.wheelBonus; if (wheelEdge(at, ax, false)) d += db.config.wheelBonus; }
  if (X.e === 'venom') return 250 + T.ea * 0.5 - (T.pos === 'a' && a < d ? X.ea * 0.6 + (d - a) : 0);
  if (a > d) return 300 + T.ea * 0.5 + (T.pos === 'a' ? a - d : 0) + (T.e === 'venom' ? -X.ea * 0.5 : 0);
  if (a === d && T.pos === 'a') return level >= 1 ? (T.ea >= X.ea && rb.count <= view.mon[view.me].filter(Boolean).length ? 60 : -1) : 60;
  return -1;
}

function legalTargets(db, view, X) {
  const r = 1 - view.me, out = [];
  view.mon[r].forEach((m, z) => { if (m) out.push(z); });
  if (!out.length) return (db.config.directPerTurn && (view.directs || 0) >= db.config.directPerTurn) ? [] : [-1];
  let list = out;
  const wardens = out.filter(z => { const m = view.mon[r][z]; return !m.veil && (m.e === 'warden' || m.guard) && m.pos === 'd'; });
  if (wardens.length) list = wardens;
  if (X.e !== 'soaring') list = list.filter(z => { const m = view.mon[r][z]; return !(m.e === 'soaring' && !m.veil); });
  return list;
}

function bestAttack(db, view, level, asIfAttack = null) {
  const me = view.me, r = 1 - me, rb = rivalBoard(db, view);
  if (view.turn === 1 || view.noAttack || view.frozen[me] > 0) return null;
  let best = null;
  view.mon[me].forEach((X, z) => {
    if (!X) return;
    const sim = asIfAttack === z;
    if (!sim && X.pos !== 'a') return;
    if (sim && (X.moved || X.att > 0)) return;
    if ((X.att || 0) >= (X.e === 'twin' ? 2 : 1)) return;
    for (const t of legalTargets(db, view, X)) {
      const g = attackGain(db, view, X, t >= 0 ? view.mon[r][t] : null, level, rb);
      if (g > 0 && (!best || g > best.gain)) best = { gain: g, action: { t: 'attack', from: z, to: t } };
    }
  });
  return best;
}

function answerTrap(db, view, level) {
  const p = view.pending, me = view.me, r = 1 - me;
  const opts = p.options;
  if (!opts || !opts.length) return { t: 'respond', trap: -1 };
  const X = view.mon[r][p.from], T = p.to >= 0 ? view.mon[me][p.to] : null;
  let bad = true; // would this attack hurt me?
  if (level >= 1 && T && X && !X.veil) {
    const ax = db.byId.get(X.id).attr, at = db.byId.get(T.id).attr;
    let a = X.ea + (wheelEdge(ax, at, true) ? db.config.wheelBonus : 0);
    let d = (T.pos === 'a' ? T.ea : T.ed) + (wheelEdge(at, ax, false) ? db.config.wheelBonus : 0);
    bad = a >= d;
  }
  const ranked = opts.map(i => [i, db.tagOf.get(view.traps[me][i].id)]).sort((x, y) => TRAP_ORDER.indexOf(x[1].fx) - TRAP_ORDER.indexOf(y[1].fx));
  for (const [i, tag] of ranked) {
    const always = tag.fx === 'heal' || tag.fx === 'draw' || (tag.fx === 'burn' && tag.n > 0);
    if (level === 0 || bad || always) {
      if (level >= 2 && !always && X && !X.veil && X.ea < 1000 && T) continue; // hold removal for a worthy target
      return { t: 'respond', trap: i };
    }
  }
  return { t: 'respond', trap: -1 };
}

// One action for the seat whose view this is. Call again until it returns { t:'end' }.
export function chooseAction(db, view, level = 1, policy = {}) {
  const me = view.me;
  if (view.pending) return view.active === me ? null : answerTrap(db, view, level);
  if (view.active !== me) return null;
  if (!view.played && !view.attacked) {
    if (level >= 1 && view.relics.includes('clean_draw') && !view.rs.cleanDraw && view.deckCount[me] > 0) {
      // swap away a card that can do nothing on its own when the hand has no monster
      const mons = view.hand.filter(c => db.isMonster(c.id)).length;
      if (mons === 0 && view.hand.length) return { t: 'cleanDraw', hand: 0 };
    }
    if (db.config.freeCast && !view.noFree && level >= 1 && view.rs.freeTurn !== view.turn) { const f = bestPlay(db, view, level, { ...policy, freeOnly: true }); if (f && f.score > 60) return f.action; }
    const p = bestPlay(db, view, level, policy);
    if (p && p.score > (level === 0 ? -1e9 : -50)) return p.action;
    if (!p && view.hand.length >= db.config.hand && !view.mon[me].some(Boolean)) {
      // nothing playable at all: scrap the weakest card so the hand can turn over
      let wi = 0, wv = 1e9; view.hand.forEach((c, i) => { const k = db.byId.get(c.id); const val = db.isMonster(c.id) ? k.atk : 0; if (val < wv) { wv = val; wi = i; } });
      return { t: 'discard', hand: wi };
    }
  }
  const rb = rivalBoard(db, view);
  if (level >= 1) {
    // turn a defender to attack when it has a good attack
    for (let z = 0; z < view.mon[me].length; z++) {
      const m = view.mon[me][z];
      if (!m || m.pos !== 'd' || m.moved || m.att > 0) continue;
      const b = bestAttack(db, { ...view, mon: view.mon.map((side, i) => i === me ? side.map((x, k) => k === z ? { ...x, pos: 'a' } : x) : side) }, level);
      if (b && b.action.from === z && b.gain >= 300 && (rb.ra < m.ea || rb.count <= 1)) return { t: 'pos', zone: z };
    }
  }
  const atk = bestAttack(db, view, level);
  if (atk) return atk.action;
  if (level >= 1) {
    for (let z = 0; z < view.mon[me].length; z++) {
      const m = view.mon[me][z];
      if (!m || m.pos !== 'a' || m.moved || m.att > 0) continue;
      let threat = rb.ra;
      if (rb.raAttr && wheelEdge(rb.raAttr, db.byId.get(m.id).attr, true)) threat += db.config.wheelBonus;
      if (threat >= m.ea && threat > 0) return { t: 'pos', zone: z };
    }
  }
  return { t: 'end' };
}
