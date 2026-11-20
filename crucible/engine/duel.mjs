// Lost Memories duel rules (codename crucible). A deterministic state machine:
//   apply(state, action, db) -> { state, events }
// Integers only, no clocks, no I/O. All randomness comes from the PCG32 state in state.rng.
import { Rng } from './rng.mjs';
import { roleOf, meldPair, meldTriple, terrainFavours, wheelEdge } from './cards.mjs';
import { fire, relicBonus, has } from './relics.mjs';

export const clone = s => JSON.parse(JSON.stringify(s));

const blankStats = () => ({ melds: 0, fizzles: 0, spells: 0, bigHits: 0, defWins: 0, turns: 0, directHits: 0, positionsToDef: 0, longestChain: 0, relicFires: {}, chains: {}, singles: 0, capHits: 0, newMelds: [], embers: 0, damageDealt: 0, destroyed: 0, trapsSprung: 0, relicFamilies: {} });

// deck entries: { id, t?:1 tempered, e?:'enchant', b?:1 bound }
// seat options: { handSize, firstTurnHand, relics:[], law, twist, homeField, underCap, secondWind, lp, sparks, ai }
export function newDuel(db, { seed, decks, seats = [{}, {}], first = null, twist = null }) {
  const cfg = db.config;
  const rng = Rng.fromSeed(seed);
  const s = {
    v: 1, rng: null, turn: 1, active: 0, first: 0, played: false, attacked: false, noAttack: false,
    lp: [seats[0].lp || cfg.lp, seats[1].lp || cfg.lp],
    deck: [[], []], hand: [[], []], mon: [[], []], traps: [[], []], gy: [[], []],
    terrain: null, frozen: [0, 0], pending: null, winner: null, reason: null, uid: 1, twist: twist || null,
    zones: twist === 'narrow' ? 3 : cfg.monsterZones,
    seat: [0, 1].map(i => ({
      handSize: seats[i].handSize || cfg.hand, firstTurnHand: seats[i].firstTurnHand || 0,
      relics: (seats[i].relics || []).slice(), law: seats[i].law || null, homeField: seats[i].homeField || null,
      underCap: seats[i].underCap || 0, secondWind: !!seats[i].secondWind, sparks: seats[i].sparks || 3,
      ace: seats[i].ace || null, rs: { nextMeld: [] }, extraDraw: 0,
      ...(seats[i].forger ? { forger: seats[i].forger } : {}),
      ...(seats[i].noFree ? { noFree: 1 } : {}),
      ...(seats[i].track ? { track: 1 } : {}),
    })),
    stats: [blankStats(), blankStats()],
  };
  for (let i = 0; i < 2; i++) {
    s.deck[i] = decks[i].map(e => (typeof e === 'number' ? { id: e } : { ...e }));
    rng.shuffle(s.deck[i]);
    for (let z = 0; z < s.zones; z++) s.mon[i].push(null);
    for (let z = 0; z < cfg.trapZones; z++) s.traps[i].push(null);
  }
  s.first = first === null ? rng.int(2) : first;
  s.active = s.first;
  s.rng = rng.s;
  const ev = [];
  // Laws and twists that set the opening terrain.
  for (let i = 0; i < 2; i++) {
    if (s.seat[i].law === 'scorched') { const f = db.byName.get('Molten Destruction'); if (f) s.terrain = { id: f.id, owner: i, law: true }; }
  }
  if (twist === 'locked' && !s.terrain) { const id = rng.pick([...db.fieldOf.keys()]); s.terrain = { id, owner: 0, lock: true }; s.rng = rng.s; }
  for (let i = 0; i < 2; i++) fire(s, db, ev, i, 'duelStart', {});
  for (let i = 0; i < 2; i++) refill(s, db, ev, i, true);
  s.stats[s.active].turns = 1;
  return s;
}

// ---------- helpers ----------
const card = (db, id) => db.byId.get(id);
const other = seat => 1 - seat;
const freeZone = (s, seat) => s.mon[seat].findIndex(m => !m);
const monCount = (s, seat) => s.mon[seat].reduce((n, m) => n + (m ? 1 : 0), 0);

function draw(s, db, ev, seat, n) {
  let got = 0;
  for (let k = 0; k < n; k++) {
    if (s.hand[seat].length >= db.config.handMax) break;
    const e = s.deck[seat].pop();
    if (!e) return -1;
    s.hand[seat].push({ u: s.uid++, ...e });
    got++;
  }
  if (got) ev.push({ e: 'draw', seat, n: got });
  return got;
}

function refill(s, db, ev, seat, opening) {
  const st = s.seat[seat];
  let target = st.handSize;
  if (opening && st.firstTurnHand) target = Math.max(target, st.firstTurnHand);
  if (st.extraDraw) { target = Math.max(target, s.hand[seat].length) + st.extraDraw; st.extraDraw = 0; }
  target = Math.min(target, db.config.handMax);
  let need = target - s.hand[seat].length;
  if (need <= 0) return true;
  const empty = db.config.emptyBoardRefill && !s.mon[seat].some(Boolean);
  if (!opening && db.config.drawPerTurn && !empty) need = Math.min(need, db.config.drawPerTurn);
  if (s.deck[seat].length < need) {
    draw(s, db, ev, seat, s.deck[seat].length);
    finish(s, ev, other(seat), 'deckout');
    return false;
  }
  draw(s, db, ev, seat, need);
  return true;
}

function finish(s, ev, winner, reason) {
  if (s.winner !== null) return;
  s.winner = winner; s.reason = reason; s.pending = null;
  ev.push({ e: 'end', winner, reason });
}

function loseLp(s, db, ev, seat, n, src) {
  if (n <= 0 || s.winner !== null) return;
  s.lp[seat] -= n;
  s.stats[other(seat)].damageDealt += n;
  ev.push({ e: 'lp', seat, d: -n, src });
  if (s.lp[seat] <= 0) {
    const st = s.seat[seat];
    if (st.secondWind && !st.rs.secondWind) { st.rs.secondWind = 1; s.lp[seat] = 1000; ev.push({ e: 'relic', seat, id: 'second_wind' }); return; }
    s.lp[seat] = 0;
    finish(s, ev, other(seat), 'lp');
  }
}
function gainLp(s, ev, seat, n, src) { if (n > 0 && s.winner === null) { s.lp[seat] += n; ev.push({ e: 'lp', seat, d: n, src }); } }

export function effAtk(s, db, seat, m) {
  const c = card(db, m.id);
  let v = c.atk + (m.t ? db.config.temperBonus : 0) + (m.ba || 0);
  if (s.terrain && (terrainFavours(db, s.terrain.id, m.id) || m.keepT)) v += db.config.terrainBonus;
  if (m.e === 'kindred') v += 200 * kin(s, db, seat, m);
  if (m.fix != null) v = m.fix + (m.ba || 0);
  return Math.max(0, v);
}
export function effDef(s, db, seat, m) {
  const c = card(db, m.id);
  let v = c.def + (m.t ? db.config.temperBonus : 0) + (m.bd || 0);
  if (s.terrain && (terrainFavours(db, s.terrain.id, m.id) || m.keepT)) v += db.config.terrainBonus;
  if (m.e === 'kindred') v += 200 * kin(s, db, seat, m);
  if (m.veil && has(s, seat, 'glass_idol')) v -= 300;
  return Math.max(0, v);
}
function kin(s, db, seat, m) { const t = card(db, m.id).type; let n = 0; for (const o of s.mon[seat]) if (o && o !== m && card(db, o.id).type === t) n++; return n; }

function toGrave(s, seat, inst) { s.gy[seat].push(inst.id); }

// Remove a monster from the table because it was destroyed. Returns true if it left.
function destroyMon(s, db, ev, seat, z, why) {
  const m = s.mon[seat][z];
  if (!m) return false;
  if (m.e === 'bulwark' && !m.bulwarkUsed) { m.bulwarkUsed = 1; ev.push({ e: 'enchant', seat, zone: z, id: 'bulwark' }); return false; }
  s.mon[seat][z] = null;
  s.stats[other(seat)].destroyed++;
  ev.push({ e: 'destroyed', seat, zone: z, id: m.id, why });
  const rs = s.seat[seat].rs;
  const entry = { id: m.id }; if (m.t) entry.t = 1; if (m.e) entry.e = m.e; if (m.b) entry.b = 1;
  if (m.e === 'echo' && !m.token && !(rs.echo || (rs.echo = {}))[m.u0 || m.u]) {
    rs.echo[m.u0 || m.u] = 1;
    if (s.hand[seat].length < db.config.handMax) { s.hand[seat].push({ u: s.uid++, ...entry }); ev.push({ e: 'enchant', seat, id: 'echo' }); return true; }
  }
  if (m.sig && !rs.sigBack) { rs.sigBack = 1; s.deck[seat].unshift(entry); ev.push({ e: 'relic', seat, id: 'signature', note: 'returns to the bottom of the deck' }); return true; }
  toGrave(s, seat, m);
  return true;
}

// ---------- meld chains ----------
// Pure plan of what a chain of cards makes. `cards` are instances ({id,t,e,b}), in order.
// `onto` is a table monster instance or null. Returns
// { final:{inst, isMonster, fromTable}, gy:[ids], steps:[{kind,a,b,id}], fizzles, successes, len, pairs:[[a,b,result,kind]] }
export function planChain(db, cards, onto, opts = {}) {
  const fuel = opts.tinder ? 500 : db.config.fuelBonus;
  const equipB = db.config.equipBonus;
  const gy = [], steps = [], pairs = [];
  let fizzles = 0, successes = 0, run = 1, steadyUsed = false, returned = null, forged = false;
  let cur = onto ? { inst: { ...onto }, table: true, raw: true } : { inst: { ...cards[0] }, table: false, raw: true };
  let i = onto ? 0 : 1;
  let tableLost = false;
  for (; i < cards.length; i++) {
    const B = cards[i];
    const aMon = db.isMonster(cur.inst.id);
    // three in a row on a real Fusion Monster
    if (cur.raw && aMon && i + 1 < cards.length && db.isMonster(B.id) && db.isMonster(cards[i + 1].id)) {
      const t3 = meldTriple(db, cur.inst.id, B.id, cards[i + 1].id);
      if (t3) {
        gy.push(cur.inst.id, B.id, cards[i + 1].id);
        pairs.push([cur.inst.id, B.id, t3.id, 'printed']);
        cur = { inst: carry(cur.inst, t3.id), table: cur.table, raw: false };
        steps.push({ kind: 'printed', id: t3.id, three: true });
        successes += 2; run += 2; i++; forged = true;
        continue;
      }
    }
    let r = meldPair(db, cur.inst.id, B.id);
    // Lever under test: a chain makes one new monster; later monsters only feed it.
    if (db.config.oneForgePerChain && forged && (r.kind === 'printed' || r.kind === 'cross' || r.kind === 'fizzle') && db.isMonster(cur.inst.id) && db.isMonster(B.id)) r = { kind: 'fuel', mon: 0 };
    if (r.kind === 'equip' && opts.tinder) r = { kind: 'fuel', mon: r.mon };
    if (r.kind === 'fizzle' && cur.table && cur.inst.e === 'catalyst' && aMon) r = { kind: 'fuel', mon: 0, forced: true };
    if (r.kind === 'printed' || r.kind === 'cross') {
      gy.push(cur.inst.id, B.id);
      pairs.push([cur.inst.id, B.id, r.id, r.kind]);
      cur = { inst: carry(cur.inst, r.id), table: cur.table, raw: false };
      steps.push({ kind: r.kind, id: r.id }); successes++; run++; forged = true;
    } else if (r.kind === 'equip' || r.kind === 'fuel') {
      const add = r.kind === 'equip' ? equipB : fuel;
      const monInst = r.mon === 0 ? cur.inst : { ...B };
      const spent = r.mon === 0 ? B : cur.inst;
      gy.push(spent.id);
      const table = r.mon === 0 ? cur.table : false;
      if (r.mon !== 0 && cur.table) tableLost = true;
      monInst.ba = (monInst.ba || 0) + add; monInst.bd = (monInst.bd || 0) + add;
      if (r.kind === 'equip') monInst.eq = (monInst.eq || 0) + 1;
      cur = { inst: monInst, table, raw: cur.raw && r.mon === 0 };
      steps.push({ kind: r.kind, id: monInst.id }); successes++; run++;
    } else {
      // fizzle: A is lost, B carries on
      if (opts.steady && !steadyUsed && !cur.table) { steadyUsed = true; returned = cur.inst; steps.push({ kind: 'steady' }); }
      else { gy.push(cur.inst.id); fizzles++; steps.push({ kind: 'fizzle', lost: cur.inst.id }); }
      if (cur.table) tableLost = true;
      cur = { inst: { ...B }, table: false, raw: true };
      run = 1;
    }
  }
  return { final: cur.inst, isMonster: db.isMonster(cur.inst.id), onTable: cur.table, tableLost, gy, steps, fizzles, successes, len: run, melded: run > 1, pairs, returned, steadyUsed };
}
function carry(from, id) {
  const o = { id };
  if (from.ba) o.ba = from.ba; if (from.bd) o.bd = from.bd; if (from.ra) o.ra = from.ra; if (from.rd) o.rd = from.rd; if (from.eq) o.eq = from.eq;
  if (from.u) o.u = from.u;
  return o;
}

// ---------- spell and trap effects ----------
function strongest(s, db, seat, { faceUpOnly = false, pos = null } = {}) {
  let best = -1, bv = -1;
  for (let z = 0; z < s.mon[seat].length; z++) {
    const m = s.mon[seat][z];
    if (!m || (faceUpOnly && m.veil) || (pos && m.pos !== pos)) continue;
    const v = m.veil ? 0 : effAtk(s, db, seat, m) + 1;
    if (v > bv) { bv = v; best = z; }
  }
  return best;
}
function bestInGrave(s, db, seat) {
  let bi = -1, bc = null;
  s.gy[seat].forEach((id, i) => { if (!db.isMonster(id)) return; const c = card(db, id); if (!bc || db.cmp(c, bc) > 0) { bc = c; bi = i; } });
  return bi;
}

// Can this tagged spell do something right now for `seat`?
export function spellLegal(s, db, seat, id) {
  const tag = db.tagOf.get(id); if (!tag) return false;
  const r = other(seat);
  switch (tag.fx) {
    case 'destroy': case 'bounce': case 'weaken': case 'position': return monCount(s, r) > 0;
    case 'destroyAll': return monCount(s, r) > 0;
    case 'pump': return monCount(s, seat) > 0;
    case 'flip': return s.mon[r].some(m => m && m.veil);
    case 'revive': return bestInGrave(s, db, seat) >= 0 && freeZone(s, seat) >= 0;
    case 'draw': return s.deck[seat].length > 0;
    default: return true;
  }
}

// Sim-only counters (config trackFx): what each side actually used. Off in normal play so states stay identical.
function track(s, db, seat, k) { if (!db.config.trackFx) return; const f = s.stats[seat].fx || (s.stats[seat].fx = {}); f[k] = (f[k] || 0) + 1; }

function castSpell(s, db, ev, seat, id, target) {
  const tag = db.tagOf.get(id), r = other(seat);
  ev.push({ e: 'spell', seat, id, fx: tag.fx });
  s.stats[seat].spells++; track(s, db, seat, tag.fx);
  const pickRival = () => (target != null && s.mon[r][target]) ? target : (strongest(s, db, r, { faceUpOnly: true }) >= 0 ? strongest(s, db, r, { faceUpOnly: true }) : strongest(s, db, r));
  switch (tag.fx) {
    case 'burn': loseLp(s, db, ev, r, tag.n, 'spell'); break;
    case 'heal': gainLp(s, ev, seat, tag.n, 'spell'); break;
    case 'destroy': destroyMon(s, db, ev, r, pickRival(), 'spell'); break;
    case 'destroyAll':
      for (let z = 0; z < s.mon[r].length; z++) destroyMon(s, db, ev, r, z, 'spell');
      if (tag.n === 1) for (let z = 0; z < s.mon[seat].length; z++) destroyMon(s, db, ev, seat, z, 'spell');
      break;
    case 'bounce': bounce(s, db, ev, r, pickRival()); break;
    case 'pump': { const z = (target != null && s.mon[seat][target]) ? target : strongest(s, db, seat); const m = s.mon[seat][z]; m.ba = (m.ba || 0) + tag.n; m.bd = (m.bd || 0) + tag.n; ev.push({ e: 'stat', seat, zone: z, a: tag.n, d: tag.n, src: 'spell' }); break; }
    case 'weaken': { const z = pickRival(); const m = s.mon[r][z]; m.ba = (m.ba || 0) - tag.n; m.bd = (m.bd || 0) - tag.n; ev.push({ e: 'stat', seat: r, zone: z, a: -tag.n, d: -tag.n, src: 'spell' }); break; }
    case 'draw': draw(s, db, ev, seat, tag.n); break;
    case 'flip': s.mon[r].forEach((m, z) => { if (m && m.veil) { m.veil = false; ev.push({ e: 'reveal', seat: r, zone: z, id: m.id }); } }); break;
    case 'freeze': s.frozen[r] = Math.max(s.frozen[r], tag.n); ev.push({ e: 'freeze', seat: r, turns: tag.n }); break;
    case 'position': { const z = pickRival(); const m = s.mon[r][z]; m.pos = m.pos === 'a' ? 'd' : 'a'; if (m.veil) { m.veil = false; } ev.push({ e: 'pos', seat: r, zone: z, pos: m.pos }); break; }
    case 'revive': revive(s, db, ev, seat, 'a'); break;
  }
}
function bounce(s, db, ev, seat, z) {
  const m = s.mon[seat][z]; if (!m) return;
  s.mon[seat][z] = null;
  const entry = { id: m.id }; if (m.t) entry.t = 1; if (m.e) entry.e = m.e; if (m.b) entry.b = 1;
  if (s.hand[seat].length < db.config.handMax) s.hand[seat].push({ u: s.uid++, ...entry }); else s.deck[seat].unshift(entry);
  ev.push({ e: 'bounce', seat, zone: z, id: m.id });
}
function revive(s, db, ev, seat, pos) {
  const gi = bestInGrave(s, db, seat), z = freeZone(s, seat);
  if (gi < 0 || z < 0) return;
  const id = s.gy[seat].splice(gi, 1)[0];
  s.mon[seat][z] = { u: s.uid++, id, pos, veil: false, att: 0, moved: true };
  ev.push({ e: 'revive', seat, zone: z, id });
}

// Which of the defender's set traps can do something against this attack?
function trapOptions(s, db, defSeat, az, dz) {
  const out = [];
  s.traps[defSeat].forEach((t, i) => {
    if (!t) return;
    const tag = db.tagOf.get(t.id);
    let ok = true;
    if (tag.fx === 'pump') ok = dz >= 0;
    if (tag.fx === 'revive') ok = bestInGrave(s, db, defSeat) >= 0 && freeZone(s, defSeat) >= 0;
    if (tag.fx === 'flip') ok = s.mon[other(defSeat)].some(m => m && m.veil);
    if (tag.fx === 'draw') ok = s.deck[defSeat].length > 0 && s.hand[defSeat].length < db.config.handMax;
    if (ok) out.push(i);
  });
  return out;
}

// Returns true if the attack still goes ahead.
function springTrap(s, db, ev, defSeat, ti, az, dz) {
  const t = s.traps[defSeat][ti]; s.traps[defSeat][ti] = null; s.gy[defSeat].push(t.id);
  const tag = db.tagOf.get(t.id), atkSeat = other(defSeat);
  ev.push({ e: 'trap', seat: defSeat, id: t.id, fx: tag.fx });
  s.stats[defSeat].spells++; s.stats[defSeat].trapsSprung++; track(s, db, defSeat, 'trap:' + tag.fx);
  const X = s.mon[atkSeat][az];
  switch (tag.fx) {
    case 'destroy': destroyMon(s, db, ev, atkSeat, az, 'trap'); return !!s.mon[atkSeat][az];
    case 'destroyAll': s.mon[atkSeat].forEach((m, z) => { if (m && m.pos === 'a') destroyMon(s, db, ev, atkSeat, z, 'trap'); }); return !!s.mon[atkSeat][az];
    case 'bounce': bounce(s, db, ev, atkSeat, az); return false;
    case 'weaken': X.ba = (X.ba || 0) - tag.n; X.bd = (X.bd || 0) - tag.n; ev.push({ e: 'stat', seat: atkSeat, zone: az, a: -tag.n, d: -tag.n, src: 'trap' }); return true;
    case 'pump': { const T = s.mon[defSeat][dz]; T.ba = (T.ba || 0) + tag.n; T.bd = (T.bd || 0) + tag.n; ev.push({ e: 'stat', seat: defSeat, zone: dz, a: tag.n, d: tag.n, src: 'trap' }); return true; }
    case 'freeze': s.noAttack = true; if (tag.n) s.frozen[atkSeat] = Math.max(s.frozen[atkSeat], tag.n + 1); ev.push({ e: 'freeze', seat: atkSeat, turns: tag.n }); return false;
    case 'position': X.pos = 'd'; X.moved = true; ev.push({ e: 'pos', seat: atkSeat, zone: az, pos: 'd' }); return false;
    case 'burn': if (tag.n < 0) { loseLp(s, db, ev, atkSeat, effAtk(s, db, atkSeat, X), 'trap'); return false; } loseLp(s, db, ev, atkSeat, tag.n, 'trap'); return true;
    case 'heal': gainLp(s, ev, defSeat, tag.n < 0 ? effAtk(s, db, atkSeat, X) : tag.n, 'trap'); return true;
    case 'draw': draw(s, db, ev, defSeat, tag.n); return true;
    case 'flip': s.mon[atkSeat].forEach((m, z) => { if (m && m.veil) { m.veil = false; ev.push({ e: 'reveal', seat: atkSeat, zone: z, id: m.id }); } }); return true;
    case 'revive': revive(s, db, ev, defSeat, 'd'); return true;
  }
  return true;
}

// ---------- battle ----------
// Pure forecast of an attack using full knowledge of both cards. The UI and AI must
// only call this with cards they are allowed to know.
export function forecast(s, db, atkSeat, X, defSeat, T, { ambush = 0 } = {}) {
  let a = effAtk(s, db, atkSeat, X);
  const ca = card(db, X.id);
  if (!T) return { a, d: 0, direct: true, dmgDef: a, killT: false, killX: false, dmgAtk: 0, edgeA: false, edgeD: false };
  const ct = card(db, T.id);
  const edgeA = wheelEdge(ca.attr, ct.attr, true), edgeD = wheelEdge(ct.attr, ca.attr, false);
  if (edgeA) a += db.config.wheelBonus;
  const base = T.pos === 'a' ? effAtk(s, db, defSeat, T) : effDef(s, db, defSeat, T);
  const d = base + (edgeD ? db.config.wheelBonus : 0) + ambush;
  const out = { a, d, direct: false, edgeA, edgeD, killT: false, killX: false, dmgDef: 0, dmgAtk: 0, pos: T.pos };
  if (T.pos === 'a') {
    if (a > d) { out.killT = true; out.dmgDef = a - d; }
    else if (a < d) { out.killX = true; out.dmgAtk = d - a; }
    else {
      const lawA = s.seat[atkSeat].law === 'stonewall', lawD = s.seat[defSeat].law === 'stonewall';
      out.killT = !lawD; out.killX = !lawA; if (lawA && lawD) { out.killT = out.killX = true; }
    }
  } else {
    if (a > d) { out.killT = true; if (X.e === 'piercing') out.dmgDef = a - d; }
    else if (a < d) out.dmgAtk = d - a;
  }
  if (X.e === 'venom' && !out.killT) out.killT = true;
  if (T.e === 'venom' && !out.killX) out.killX = true;
  return out;
}

function resolveBattle(s, db, ev, atkSeat, az, dz) {
  const defSeat = other(atkSeat);
  const X = s.mon[atkSeat][az];
  if (!X) return;
  X.att = (X.att || 0) + 1; s.attacked = true;
  if (X.veil) { X.veil = false; ev.push({ e: 'reveal', seat: atkSeat, zone: az, id: X.id }); }
  const T = dz >= 0 ? s.mon[defSeat][dz] : null;
  if (dz >= 0 && !T) { // target vanished (trap revive cannot do this, but be safe): attack is spent
    return;
  }
  let ambush = 0, wasVeiled = false;
  if (T && T.veil) {
    T.veil = false; wasVeiled = true;
    ev.push({ e: 'reveal', seat: defSeat, zone: dz, id: T.id });
    if (T.e === 'ambusher') ambush = 800;
    if (db.config.veilGuard && T.pos === 'd') ambush += db.config.veilGuard; // lever under test: a veiled wall braces for the attack that reveals it
  }
  const f = forecast(s, db, atkSeat, X, defSeat, T, { ambush });
  ev.push({ e: 'battle', atkSeat, az, dz, a: f.a, d: f.d, direct: f.direct, edgeA: f.edgeA, edgeD: f.edgeD });
  if (wasVeiled && s.seat[defSeat].track) s.stats[defSeat].reveals = (s.stats[defSeat].reveals || 0) + 1;
  if (wasVeiled) fire(s, db, ev, defSeat, 'veiledRevealed', { mon: T, zone: dz, attacker: X });
  if (f.direct) {
    s.directs = (s.directs || 0) + 1;
    loseLp(s, db, ev, defSeat, f.dmgDef, 'direct');
    s.stats[atkSeat].directHits++;
    if (f.dmgDef >= 1500) s.stats[atkSeat].bigHits++;
    if (X.e === 'drain') gainLp(s, ev, atkSeat, f.dmgDef, 'drain');
    return;
  }
  if (f.dmgDef) { loseLp(s, db, ev, defSeat, f.dmgDef, 'battle'); if (f.dmgDef >= 1500) s.stats[atkSeat].bigHits++; if (X.e === 'drain') gainLp(s, ev, atkSeat, f.dmgDef, 'drain'); }
  if (f.dmgAtk) loseLp(s, db, ev, atkSeat, f.dmgAtk, 'battle');
  let tGone = false, xGone = false;
  if (f.killT) tGone = destroyMon(s, db, ev, defSeat, dz, 'battle');
  if (tGone && wasVeiled) { const vf = { id: T.id }; fire(s, db, ev, defSeat, 'veiledFell', vf); if (vf.kill) f.killX = true; }
  if (f.killX) xGone = destroyMon(s, db, ev, atkSeat, az, 'battle');
  if (tGone && !xGone && has(s, defSeat, 'grave_ward')) { const c = {}; fire(s, db, ev, defSeat, 'fell', c); if (c.kill) xGone = destroyMon(s, db, ev, atkSeat, az, 'relic'); }
  if (tGone && !xGone) {
    fire(s, db, ev, atkSeat, 'wonBattle', { mon: X, zone: az, edge: f.edgeA });
    if (s.seat[atkSeat].law === 'bloodprice') gainLp(s, ev, atkSeat, 500, 'law');
  }
  if (xGone && !tGone && s.seat[defSeat].law === 'bloodprice') gainLp(s, ev, defSeat, 500, 'law');
  if (!tGone && T.pos === 'd') {
    if (f.a < f.d) s.stats[defSeat].defWins++;
    fire(s, db, ev, defSeat, 'survived', { mon: T, zone: dz, attacker: X, wasVeiled });
  }
  if (xGone && !tGone && T.pos === 'a') fire(s, db, ev, defSeat, 'wonBattle', { mon: T, zone: dz, edge: f.edgeD });
}

function canAttackWith(s, seat, m) {
  if (!m || m.pos !== 'a') return false;
  return (m.att || 0) < (m.e === 'twin' ? 2 : 1);
}
function attackAllowed(s) {
  return s.winner === null && !s.pending && !s.noAttack && s.frozen[s.active] === 0 && !(s.turn === 1);
}
// Legal targets for an attacker, as zone indexes; [-1] means a direct attack.
export function targetsFor(s, db, seat, az) {
  const r = other(seat), X = s.mon[seat][az];
  const rivals = [];
  s.mon[r].forEach((m, z) => { if (m) rivals.push(z); });
  if (!rivals.length) return (db.config.directPerTurn && (s.directs || 0) >= db.config.directPerTurn) ? [] : [-1];
  let list = rivals;
  const wardens = rivals.filter(z => { const m = s.mon[r][z]; return (m.e === 'warden' || m.guard) && m.pos === 'd' && !m.veil; });
  if (wardens.length) list = wardens;
  if (X.e !== 'soaring') list = list.filter(z => { const m = s.mon[r][z]; return !(m.e === 'soaring' && !m.veil); });
  return list;
}

// ---------- actions ----------
export function legalActions(s, db, { maxChain = 2 } = {}) {
  const out = [];
  if (s.winner !== null) return out;
  if (s.pending) {
    out.push({ t: 'respond', trap: -1 });
    for (const i of s.pending.options) out.push({ t: 'respond', trap: i });
    return out;
  }
  const seat = s.active, hand = s.hand[seat];
  if (!s.played && !s.attacked) {
    const seen = new Set();
    const tryPlay = (idxs, onto) => {
      const k = idxs.map(i => hand[i].id + (hand[i].t ? 't' : '') + (hand[i].e || '')).join(',') + '|' + (onto ?? '');
      if (seen.has(k)) return; seen.add(k);
      for (const v of playVariants(s, db, seat, idxs, onto)) out.push(v);
    };
    for (let i = 0; i < hand.length; i++) {
      tryPlay([i], null);
      out.push({ t: 'discard', hand: i });
      if (maxChain >= 2) {
        for (let j = 0; j < hand.length; j++) if (j !== i) tryPlay([i, j], null);
        s.mon[seat].forEach((m, z) => { if (m) tryPlay([i], z); });
      }
    }
    if (has(s, seat, 'clean_draw') && !s.seat[seat].rs.cleanDraw && s.deck[seat].length) for (let i = 0; i < hand.length; i++) out.push({ t: 'cleanDraw', hand: i });
    for (const p of powerActions(s, db, seat)) out.push(p);
  }
  s.mon[seat].forEach((m, z) => {
    if (!m) return;
    if (attackAllowed(s) && canAttackWith(s, seat, m)) for (const t of targetsFor(s, db, seat, z)) out.push({ t: 'attack', from: z, to: t });
    if (!m.moved && !(m.att > 0)) out.push({ t: 'pos', zone: z });
  });
  out.push({ t: 'end' });
  return out;
}

// All legal ways to play this chain (positions, veil). Empty if it cannot be played.
export function playVariants(s, db, seat, idxs, onto) {
  const hand = s.hand[seat], st = s.seat[seat];
  const cards = idxs.map(i => hand[i]);
  const ontoM = onto != null ? s.mon[seat][onto] : null;
  if (onto != null && !ontoM) return [];
  const plan = planChain(db, cards, ontoM, { tinder: has(s, seat, 'tinder_vow'), steady: has(s, seat, 'steady_hand') && !st.rs.steady });
  const base = { t: 'play', hand: idxs.slice(), onto: onto ?? null };
  if (plan.isMonster) {
    const zoneOk = plan.onTable || plan.tableLost || freeZone(s, seat) >= 0;
    if (!zoneOk) return [];
    if (plan.melded || plan.onTable) return [{ ...base, pos: 'a' }, { ...base, pos: 'd' }];
    const forceVeil = s.twist === 'fog' || st.law === 'mist';
    const v = [];
    if (!forceVeil) { v.push({ ...base, pos: 'a' }, { ...base, pos: 'd' }); }
    v.push({ ...base, pos: 'd', veiled: true });
    if (forceVeil || (has(s, seat, 'hollow_mask') && !st.rs.hollow)) v.push({ ...base, pos: 'a', veiled: true });
    return v;
  }
  const id = plan.final.id, role = roleOf(db, id);
  if (role === 'field') return (s.terrain && s.terrain.lock) ? [] : [base];
  if (role === 'equip') return has(s, seat, 'tinder_vow') || monCount(s, seat) === 0 ? [] : [base];
  if (role === 'spell') return spellLegal(s, db, seat, id) ? [base] : [];
  if (role === 'trap') return s.traps[seat].some(t => !t) ? [base] : [];
  return [];
}

export function apply(state, action, db) {
  const s = clone(state);
  const ev = [];
  applyMut(s, action, db, ev);
  return { state: s, events: ev };
}

// Mutating form for the simulator's hot loop. Throws on an illegal action.
export function applyMut(s, a, db, ev = []) {
  if (s.winner !== null) throw new Error('duel is over');
  const seat = s.active;
  if (s.pending) {
    if (a.t !== 'respond') throw new Error('a trap answer is pending');
    const p = s.pending; s.pending = null;
    let go = true;
    if (a.trap >= 0) { if (!p.options.includes(a.trap)) throw new Error('that trap cannot answer'); go = springTrap(s, db, ev, other(seat), a.trap, p.from, p.to); }
    if (go && s.winner === null && s.mon[seat][p.from]) {
      // a pump or revive may have changed nothing about the target zone; a destroyed target is handled inside
      resolveBattle(s, db, ev, seat, p.from, p.to);
    } else if (s.mon[seat][p.from]) { s.mon[seat][p.from].att = (s.mon[seat][p.from].att || 0) + 1; s.attacked = true; }
    else s.attacked = true;
    return ev;
  }
  switch (a.t) {
    case 'play': doPlay(s, db, ev, seat, a); break;
    case 'discard': {
      if (s.played || s.attacked) throw new Error('already played');
      const c = s.hand[seat][a.hand]; if (!c) throw new Error('no such card');
      s.hand[seat].splice(a.hand, 1); s.gy[seat].push(c.id); s.played = true; ev.push({ e: 'discard', seat, id: c.id });
      break;
    }
    case 'cleanDraw': {
      const st = s.seat[seat];
      if (s.played || s.attacked || !has(s, seat, 'clean_draw') || st.rs.cleanDraw || !s.deck[seat].length) throw new Error('clean draw not available');
      const c = s.hand[seat][a.hand]; if (!c) throw new Error('no such card');
      st.rs.cleanDraw = 1; s.hand[seat].splice(a.hand, 1);
      const e = { id: c.id }; if (c.t) e.t = 1; if (c.e) e.e = c.e; if (c.b) e.b = 1;
      const top = s.deck[seat].pop(); s.deck[seat].unshift(e); s.hand[seat].push({ u: s.uid++, ...top });
      noteRelic(s, ev, seat, 'clean_draw');
      break;
    }
    case 'power': doPower(s, db, ev, seat, a); break;
    case 'attack': {
      const X = s.mon[seat][a.from];
      if (!attackAllowed(s) || !canAttackWith(s, seat, X)) throw new Error('that monster cannot attack');
      if (!targetsFor(s, db, seat, a.from).includes(a.to)) throw new Error('illegal target');
      ev.push({ e: 'attack', seat, from: a.from, to: a.to });
      const opts = trapOptions(s, db, other(seat), a.from, a.to);
      if (opts.length) { s.pending = { kind: 'trap', from: a.from, to: a.to, options: opts }; break; }
      resolveBattle(s, db, ev, seat, a.from, a.to);
      break;
    }
    case 'pos': {
      const m = s.mon[seat][a.zone];
      if (!m || m.moved || m.att > 0) throw new Error('cannot change position');
      m.pos = m.pos === 'a' ? 'd' : 'a'; m.moved = true;
      if (m.pos === 'a' && m.veil) m.veil = false;
      if (m.pos === 'd') s.stats[seat].positionsToDef++;
      ev.push({ e: 'pos', seat, zone: a.zone, pos: m.pos });
      break;
    }
    case 'end': endTurn(s, db, ev); break;
    default: throw new Error('unknown action ' + a.t);
  }
  return ev;
}

// A Forger's power: once a duel, before the play. It never uses the play.
export function powerActions(s, db, seat) {
  const st = s.seat[seat], f = st.forger, out = [];
  if (!f || st.rs.power || s.played || s.attacked || s.pending || s.winner !== null) return out;
  if (f === 'tarn') out.push({ t: 'power' });
  else if (f === 'scrapper') { if (s.deck[seat].length >= 2) for (let i = 0; i < s.hand[seat].length; i++) out.push({ t: 'power', hand: i }); }
  else if (f === 'veil') s.mon[seat].forEach((m, z) => { if (m && !m.veil) out.push({ t: 'power', zone: z }); });
  else if (f === 'storm') { if (st.homeField && !(s.terrain && (s.terrain.lock || s.terrain.id === st.homeField))) out.push({ t: 'power' }); }
  return out;
}
function doPower(s, db, ev, seat, a) {
  const st = s.seat[seat], f = st.forger;
  if (!powerActions(s, db, seat).some(p => (p.hand ?? null) === (a.hand ?? null) && (p.zone ?? null) === (a.zone ?? null))) throw new Error('that power cannot be used now');
  st.rs.power = 1; ev.push({ e: 'power', seat, forger: f });
  if (f === 'tarn') st.rs.nextMeld.push({ a: 200, d: 0, id: 'f_tarn' });
  else if (f === 'scrapper') {
    const c = s.hand[seat][a.hand]; s.hand[seat].splice(a.hand, 1);
    const e = { id: c.id }; if (c.t) e.t = 1; if (c.e) e.e = c.e; if (c.b) e.b = 1;
    s.deck[seat].unshift(e); draw(s, db, ev, seat, 2);
  } else if (f === 'veil') { const m = s.mon[seat][a.zone]; m.veil = true; m.pos = 'd'; m.moved = true; ev.push({ e: 'pos', seat, zone: a.zone, pos: 'd', veiled: true }); }
  else if (f === 'storm') {
    const prev = s.terrain;
    if (prev && prev.law) s.terrain = { id: st.homeField, owner: seat, temp: 2, back: prev };
    else if (prev && prev.temp != null) s.terrain = { id: st.homeField, owner: seat, temp: 2, back: prev.back };
    else s.terrain = { id: st.homeField, owner: seat };
    ev.push({ e: 'terrain', seat, id: st.homeField });
  }
}

function noteRelic(s, ev, seat, id) { const f = s.stats[seat].relicFires; f[id] = (f[id] || 0) + 1; ev.push({ e: 'relic', seat, id }); }

function doPlay(s, db, ev, seat, a) {
  if (s.played || s.attacked) throw new Error('already played this turn');
  const hand = s.hand[seat], st = s.seat[seat];
  const idxs = a.hand;
  if (!idxs.length || new Set(idxs).size !== idxs.length || idxs.some(i => !hand[i])) throw new Error('bad hand indexes');
  const variants = playVariants(s, db, seat, idxs, a.onto);
  const want = variants.find(v => (v.pos || null) === (a.pos || null) && !!v.veiled === !!a.veiled);
  if (!want) throw new Error('that play is not legal');
  const cards = idxs.map(i => hand[i]);
  const ontoM = a.onto != null ? s.mon[seat][a.onto] : null;
  const steady = has(s, seat, 'steady_hand') && !st.rs.steady;
  const plan = planChain(db, cards, ontoM, { tinder: has(s, seat, 'tinder_vow'), steady });
  // remove the cards from hand (highest index first)
  for (const i of idxs.slice().sort((x, y) => y - x)) hand.splice(i, 1);
  if (plan.steadyUsed) { st.rs.steady = 1; hand.push({ u: s.uid++, id: plan.returned.id, ...(plan.returned.t ? { t: 1 } : {}), ...(plan.returned.e ? { e: plan.returned.e } : {}), ...(plan.returned.b ? { b: 1 } : {}) }); noteRelic(s, ev, seat, 'steady_hand'); }
  for (const id of plan.gy) s.gy[seat].push(id);
  if (ontoM && (plan.tableLost || plan.onTable)) s.mon[seat][a.onto] = null;
  s.played = true;
  const stt = s.stats[seat];
  stt.fizzles += plan.fizzles;
  for (const stp of plan.steps) ev.push({ e: 'meld', seat, ...stp });
  for (let k = 0; k < plan.fizzles; k++) fire(s, db, ev, seat, 'fizzle', {});
  for (const p of plan.pairs) stt.newMelds.push(p);
  const buried = plan.melded ? plan.gy.filter(id => db.isMonster(id)).length : 0;
  const f = plan.final;
  if (plan.isMonster) {
    let z = plan.onTable ? a.onto : (ontoM && plan.tableLost ? a.onto : (a.zone != null && !s.mon[seat][a.zone] ? a.zone : freeZone(s, seat)));
    const c = card(db, f.id);
    const m = { u: f.u || s.uid++, id: f.id, pos: a.pos, veil: !!a.veiled, att: 0, moved: true };
    if (f.t) m.t = 1; if (f.e) m.e = f.e; if (f.b) m.b = 1;
    if (f.ba) m.ba = f.ba; if (f.bd) m.bd = f.bd; if (f.ra) m.ra = f.ra; if (f.rd) m.rd = f.rd; if (f.eq) m.eq = f.eq;
    if (plan.melded) m.meld = 1;
    if (plan.melded && db.config.longMeldRest && plan.len >= db.config.longMeldRest) m.att = 9;
    if (ontoM && plan.onTable) { m.pos = a.pos; m.veil = false; if (ontoM.bulwarkUsed) m.bulwarkUsed = 1; if (ontoM.keepT) m.keepT = 1; if (ontoM.sig) m.sig = 1; if (!plan.melded) m.att = ontoM.att || 0; }
    s.mon[seat][z] = m;
    if (a.veiled && a.pos === 'a' && !(s.twist === 'fog' || st.law === 'mist')) { st.rs.hollow = 1; noteRelic(s, ev, seat, 'hollow_mask'); }
    ev.push({ e: 'summon', seat, zone: z, id: m.veil ? null : m.id, pos: m.pos, veiled: m.veil, melded: !!plan.melded });
    if (plan.melded) { stt.melds++; stt.longestChain = Math.max(stt.longestChain, plan.len); stt.chains[plan.len] = (stt.chains[plan.len] || 0) + 1; } else { stt.singles++; track(s, db, seat, m.veil ? 'loneVeiled' : 'loneFaceUp'); }
    fire(s, db, ev, seat, 'placed', { mon: m, zone: z, melded: !!plan.melded, len: plan.len, fire: c.attr === 'FIRE', bound: !!m.b, fresh: !plan.onTable, favoured: !!(s.terrain && terrainFavours(db, s.terrain.id, m.id)) });
    if (plan.melded && plan.len >= 4 && has(s, seat, 'grounding_rod') && !st.rs.rod) { // lab Gift: a long meld strikes the rival's strongest face-up monster
      const r = other(seat); let bz = -1; s.mon[r].forEach((x, i) => { if (x && !x.veil && (bz < 0 || effAtk(s, db, r, x) > effAtk(s, db, r, s.mon[r][bz]))) bz = i; });
      if (bz >= 0) { st.rs.rod = 1; noteRelic(s, ev, seat, 'grounding_rod'); destroyMon(s, db, ev, r, bz, 'relic'); }
    }
    if (buried) fire(s, db, ev, seat, 'ingredients', { n: buried });
    if (m.e === 'herald' && !plan.onTable) draw(s, db, ev, seat, 1);
    // Lever under test: a monster played alone and face up uses its Type's arrival; a melded monster after a Machine arrival is armed.
    if (db.config.soloArrival) {
      if (plan.melded && st.rs.soloArm) { st.rs.soloArm = 0; m.ba = (m.ba || 0) + 300; m.bd = (m.bd || 0) + 300; ev.push({ e: 'solo', seat, type: 'Machine', zone: z, paid: true }); }
      if (!plan.melded && !plan.onTable && !m.veil) soloArrival(s, db, ev, seat, c);
    }
    return;
  }
  if (buried) fire(s, db, ev, seat, 'ingredients', { n: buried });
  const role = roleOf(db, f.id);
  if (role === 'field') {
    const prev = s.terrain;
    if (prev && prev.law) s.terrain = { id: f.id, owner: seat, temp: 2, back: prev };
    else if (prev && prev.temp != null) s.terrain = { id: f.id, owner: seat, temp: 2, back: prev.back };
    else s.terrain = { id: f.id, owner: seat };
    s.gy[seat].push(f.id);
    ev.push({ e: 'terrain', seat, id: f.id });
    fire(s, db, ev, seat, 'fieldPlayed', {}); track(s, db, seat, 'field');
  } else if (role === 'equip') {
    const z = (a.target != null && s.mon[seat][a.target]) ? a.target : strongest(s, db, seat);
    const m = s.mon[seat][z];
    m.ba = (m.ba || 0) + db.config.equipBonus; m.bd = (m.bd || 0) + db.config.equipBonus; m.eq = (m.eq || 0) + 1; track(s, db, seat, 'equip');
    s.gy[seat].push(f.id);
    ev.push({ e: 'equip', seat, zone: z, id: f.id });
  } else if (role === 'spell') {
    s.gy[seat].push(f.id);
    castSpell(s, db, ev, seat, f.id, a.target);
  } else if (role === 'trap') {
    const z = s.traps[seat].findIndex(t => !t);
    s.traps[seat][z] = { u: s.uid++, id: f.id };
    ev.push({ e: 'set', seat, zone: z });
    if (has(s, seat, 'f_veil') && st.rs.veilTurn !== s.turn) { st.rs.veilTurn = s.turn; s.played = false; noteRelic(s, ev, seat, 'f_veil'); }
  }
  // Lever under test: the first Spell, Field, Equip or Trap played on its own each turn does not use the play.
  if (db.config.freeCast && !st.noFree && idxs.length === 1 && a.onto == null && s.played && st.rs.freeTurn !== s.turn && s.winner === null) { st.rs.freeTurn = s.turn; s.played = false; ev.push({ e: 'free', seat }); }
}

export const SOLO = { Zombie: 'Return a monster of 1500 ATK or less from your graveyard to your hand.', Fairy: 'Gain 400 Life Points.', Machine: 'Your next meld gets +300 ATK and DEF.', Spellcaster: 'Draw a card.' };
function soloArrival(s, db, ev, seat, c) {
  const st = s.seat[seat];
  if (!SOLO[c.type]) return;
  if (c.type === 'Zombie') {
    let bi = -1; s.gy[seat].forEach((id, i) => { if (db.isMonster(id) && card(db, id).atk <= 1500 && (bi < 0 || db.cmp(card(db, id), card(db, s.gy[seat][bi])) > 0)) bi = i; });
    if (bi < 0 || s.hand[seat].length >= db.config.handMax) return;
    const id = s.gy[seat].splice(bi, 1)[0]; s.hand[seat].push({ u: s.uid++, id });
  } else if (c.type === 'Fairy') gainLp(s, ev, seat, 400, 'solo');
  else if (c.type === 'Machine') st.rs.soloArm = 1;
  else if (c.type === 'Spellcaster') { if (!s.deck[seat].length) return; draw(s, db, ev, seat, 1); }
  ev.push({ e: 'solo', seat, type: c.type });
}

function endTurn(s, db, ev) {
  const seat = s.active;
  fire(s, db, ev, seat, 'endTurn', {});
  if (s.winner !== null) return;
  for (const m of s.mon[seat]) if (m) { m.att = 0; m.moved = false; if (m.lock === 2) delete m.lock; }
  if (s.frozen[seat] > 0) s.frozen[seat]--;
  if (s.terrain && s.terrain.temp != null && s.terrain.owner === seat) {
    s.terrain.temp--;
    if (s.terrain.temp <= 0) { s.terrain = s.terrain.back; ev.push({ e: 'terrain', seat: s.terrain.owner, id: s.terrain.id, law: true }); }
  }
  s.played = false; s.attacked = false; s.noAttack = false; s.directs = 0;
  if (s.lp[0] !== s.lp[1]) s.stats[s.lp[0] < s.lp[1] ? 0 : 1].wasBehind = 1;
  { // who holds the strongest monster: counts how often the table lead changes hands
    const top = p => s.mon[p].reduce((v, m) => m ? Math.max(v, m.pos === 'a' ? effAtk(s, db, p, m) : effDef(s, db, p, m)) : v, 0);
    const a = top(0), b = top(1), lead = a === b ? -1 : a > b ? 0 : 1;
    if (lead >= 0) { if (s.lead != null && s.lead !== lead) { s.stats[0].leadChanges = (s.stats[0].leadChanges || 0) + 1; } s.stats[1 - lead].trailed = 1; s.lead = lead; }
  }
  if (s.turn >= db.config.maxTurns) { finish(s, ev, s.lp[0] === s.lp[1] ? other(s.first) : (s.lp[0] > s.lp[1] ? 0 : 1), 'turns'); return; }
  s.turn++;
  s.active = other(seat);
  const now = s.active;
  for (const m of s.mon[now]) if (m && m.lock === 1) { m.moved = true; m.lock = 2; }
  s.stats[now].turns++;
  ev.push({ e: 'turn', seat: now, turn: s.turn });
  if (s.twist === 'storm' && s.turn % 3 === 0) {
    const rng = new Rng(s.rng); const fields = [...db.fieldOf.keys()]; const id = rng.pick(fields); s.rng = rng.s;
    s.terrain = { id, owner: now, storm: true }; ev.push({ e: 'terrain', seat: now, id, storm: true });
  }
  const st = s.seat[now];
  if (st.law === 'end' && st.ace && s.stats[now].turns >= (db.config.endTurns || 4) && !st.rs.endCame) {
    const z = freeZone(s, now);
    if (z >= 0) { st.rs.endCame = 1; s.mon[now][z] = { u: s.uid++, id: st.ace, pos: 'a', veil: false, att: 0, moved: true, fix: db.config.endAtk || 5000 }; ev.push({ e: 'summon', seat: now, zone: z, id: st.ace, pos: 'a', law: true }); }
  }
  if (!refill(s, db, ev, now, false)) return;
  fire(s, db, ev, now, 'turnStart', {});
}

// ---------- hidden information ----------
// What `seat` is allowed to know. The AI and the other seat's UI get only this.
export function viewFor(s, db, seat) {
  const r = other(seat);
  const mine = z => s.mon[seat][z];
  const v = {
    turn: s.turn, active: s.active, directs: s.directs || 0, first: s.first, me: seat, played: s.played, attacked: s.attacked, noAttack: s.noAttack,
    lp: s.lp.slice(), frozen: s.frozen.slice(), winner: s.winner, twist: s.twist, zones: s.zones,
    terrain: s.terrain ? { id: s.terrain.id, owner: s.terrain.owner, law: !!s.terrain.law, lock: !!s.terrain.lock, temp: s.terrain.temp ?? null } : null,
    hand: s.hand[seat].map(c => ({ ...c })), deckCount: [s.deck[0].length, s.deck[1].length], rivalHand: s.hand[r].length,
    gy: [s.gy[0].slice(), s.gy[1].slice()],
    mon: [null, null], traps: [null, null],
    pending: s.pending ? { ...s.pending, options: s.active === seat ? undefined : s.pending.options.slice() } : null,
    noFree: s.seat[seat].noFree, forger: s.seat[seat].forger, homeField: s.seat[seat].homeField,
    relics: s.seat[seat].relics.slice(), rs: clone(s.seat[seat].rs), rivalLaw: s.seat[r].law, law: s.seat[seat].law,
  };
  v.mon[seat] = s.mon[seat].map(m => m ? { ...m, ea: effAtk(s, db, seat, m), ed: effDef(s, db, seat, m) } : null);
  v.mon[r] = s.mon[r].map(m => !m ? null : m.veil ? { veil: true, pos: m.pos, u: m.u } : { ...m, ea: effAtk(s, db, r, m), ed: effDef(s, db, r, m) });
  v.traps[seat] = s.traps[seat].map(t => t ? { ...t } : null);
  v.traps[r] = s.traps[r].map(t => t ? { set: true } : null);
  return v;
}

// ---------- canonical hash ----------
export function canonical(x) {
  if (x === null || typeof x !== 'object') return JSON.stringify(x);
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
}
