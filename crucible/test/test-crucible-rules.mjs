// Rule tests for Lost Memories (codename crucible). Run: node crucible/test/test-crucible-rules.mjs
// Card stats are read from the pool by name; nothing here types an ATK or DEF.
import assert from 'node:assert/strict';
import { loadDb, meldPair, meldTriple, weightOf, wheelEdge, roleOf } from '../engine/cards.mjs';
import { newDuel, apply, applyMut, legalActions, viewFor, planChain, effAtk, effDef, forecast, canonical, clone } from '../engine/duel.mjs';
import { chooseAction } from '../engine/ai.mjs';
import { Rng } from '../engine/rng.mjs';
import { RELICS, LAB, CHAIN_TURN, sortRelics } from '../engine/relics.mjs';
import { newRun, runApply, rankDuel, rankLetter, makeKit, KITS, deckWeight, weightCap, STYLES, THEMES, HEAT_RULES, BOSSES, KIT_TUNE, bossLaw } from '../engine/run.mjs';
import { policyAction, playRun } from '../engine/policy.mjs';
import { FORGERS, FORGER_IDS } from '../engine/forgers.mjs';
import { newProfile, applyRun, scoreRun, buy, lockedRelics, maxHeat, VAULT, FEATS, FEAT_GIFTS } from '../engine/meta.mjs';

const db = loadDb();
const C = n => { const c = db.byName.get(n); assert.ok(c, 'card in pool: ' + n); return c; };
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error('FAIL', name); throw e; } };
const filler = () => Array.from({ length: 40 }, () => ({ id: C('Mystical Elf').id }));

// A blank duel with empty hands and tables, player 0 to move on turn 3 (so attacks are allowed).
function blank(opts = {}) {
  const s = newDuel(db, { seed: 7, decks: [filler(), filler()], first: 0, ...opts });
  s.hand = [[], []]; s.turn = 3; s.active = 0;
  return s;
}
let uid = 1000;
const mon = (name, pos = 'a', extra = {}) => ({ u: uid++, id: C(name).id, pos, veil: false, att: 0, moved: false, ...extra });
const put = (s, seat, z, m) => { s.mon[seat][z] = m; return m; };
const give = (s, seat, ...names) => { for (const n of names) s.hand[seat].push({ u: uid++, id: C(n).id }); };

// ---------- rng ----------
test('pcg32 is deterministic and unbiased enough', () => {
  const a = Rng.fromSeed(42), b = Rng.fromSeed(42);
  for (let i = 0; i < 100; i++) assert.equal(a.u32(), b.u32());
  const r = Rng.fromSeed(1); const hist = [0, 0, 0, 0, 0];
  for (let i = 0; i < 50000; i++) hist[r.int(5)]++;
  for (const h of hist) assert.ok(Math.abs(h - 10000) < 500, 'bucket ' + h);
  assert.notEqual(Rng.fromSeed(1).u32(), Rng.fromSeed(2).u32());
});

// ---------- attribute wheel ----------
test('wheel edges', () => {
  assert.ok(wheelEdge('WATER', 'FIRE', true)); assert.ok(wheelEdge('FIRE', 'WIND', true));
  assert.ok(wheelEdge('WIND', 'EARTH', true)); assert.ok(wheelEdge('EARTH', 'WATER', true));
  assert.ok(!wheelEdge('FIRE', 'WATER', true)); assert.ok(wheelEdge('WATER', 'FIRE', false));
  assert.ok(wheelEdge('LIGHT', 'DARK', true)); assert.ok(wheelEdge('DARK', 'LIGHT', true));
  assert.ok(!wheelEdge('LIGHT', 'DARK', false)); assert.ok(!wheelEdge('DARK', 'LIGHT', false));
  assert.ok(!wheelEdge('DIVINE', 'DARK', true)); assert.ok(!wheelEdge('EARTH', 'EARTH', true));
});

// ---------- battle table ----------
test('attack v attack: higher wins, loser pays the difference', () => {
  const s = blank();
  const X = put(s, 0, 0, mon('Summoned Skull')), T = put(s, 1, 0, mon('Mystical Elf'));
  const a = effAtk(s, db, 0, X), d = effAtk(s, db, 1, T);
  const f = forecast(s, db, 0, X, 1, T);
  const lp = s.lp[1];
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.mon[1][0], null); assert.ok(s.mon[0][0]);
  assert.equal(s.lp[1], lp - (f.a - f.d)); assert.ok(f.a - f.d >= a - d);
});
test('attack v attack: a tie destroys both', () => {
  const s = blank();
  put(s, 0, 0, mon('Mystical Elf')); put(s, 1, 0, mon('Mystical Elf'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.mon[0][0], null); assert.equal(s.mon[1][0], null);
  assert.equal(s.lp[0], db.config.lp); assert.equal(s.lp[1], db.config.lp);
});
test('attack v defense: stronger attacker destroys, no Life Points lost', () => {
  const s = blank();
  put(s, 0, 0, mon('Blue-Eyes White Dragon')); put(s, 1, 0, mon('Mystical Elf', 'd'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.mon[1][0], null); assert.equal(s.lp[1], db.config.lp);
});
test('attack v defense: weaker attacker pays the difference, nothing destroyed', () => {
  const s = blank();
  const X = put(s, 0, 0, mon('Mystical Elf')), T = put(s, 1, 0, mon('Mystical Elf', 'd'));
  const f = forecast(s, db, 0, X, 1, T);
  assert.ok(f.a < f.d);
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.ok(s.mon[0][0]); assert.ok(s.mon[1][0]);
  assert.equal(s.lp[0], db.config.lp - (f.d - f.a));
  assert.equal(s.stats[1].defWins, 1);
});
test('direct attack hits Life Points for full ATK', () => {
  const s = blank();
  const X = put(s, 0, 0, mon('Summoned Skull'));
  applyMut(s, { t: 'attack', from: 0, to: -1 }, db);
  assert.equal(s.lp[1], db.config.lp - effAtk(s, db, 0, X));
});
test('the wheel adds 500 for that battle only', () => {
  const s = blank();
  const water = db.pool.cards.find(c => c.kind === 'monster' && c.attr === 'WATER');
  const fire = db.pool.cards.find(c => c.kind === 'monster' && c.attr === 'FIRE');
  const X = put(s, 0, 0, { u: uid++, id: water.id, pos: 'a', att: 0 }), T = put(s, 1, 0, { u: uid++, id: fire.id, pos: 'a', att: 0 });
  const f = forecast(s, db, 0, X, 1, T);
  assert.equal(f.a, effAtk(s, db, 0, X) + 500); assert.equal(f.d, effAtk(s, db, 1, T)); assert.ok(f.edgeA && !f.edgeD);
  const g = forecast(s, db, 1, T, 0, X);
  assert.equal(g.d, effAtk(s, db, 0, X) + 500); assert.equal(g.a, effAtk(s, db, 1, T));
});
test('no attacks on the first turn of the duel, one attack per monster', () => {
  const s = newDuel(db, { seed: 1, decks: [filler(), filler()], first: 0 });
  put(s, 0, 0, mon('Summoned Skull'));
  assert.ok(!legalActions(s, db).some(a => a.t === 'attack'));
  assert.throws(() => applyMut(s, { t: 'attack', from: 0, to: -1 }, db));
  const t = blank(); put(t, 0, 0, mon('Summoned Skull'));
  applyMut(t, { t: 'attack', from: 0, to: -1 }, db);
  assert.throws(() => applyMut(t, { t: 'attack', from: 0, to: -1 }, db));
});
test('a monster that attacked cannot change position; a moved monster cannot move twice', () => {
  const s = blank(); put(s, 0, 0, mon('Summoned Skull')); put(s, 0, 1, mon('Mystical Elf'));
  applyMut(s, { t: 'attack', from: 0, to: -1 }, db);
  assert.throws(() => applyMut(s, { t: 'pos', zone: 0 }, db));
  applyMut(s, { t: 'pos', zone: 1 }, db);
  assert.throws(() => applyMut(s, { t: 'pos', zone: 1 }, db));
});
test('one play a turn, and not after attacking', () => {
  const s = blank(); give(s, 0, 'Mystical Elf', 'Mystical Elf');
  applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'a' }, db);
  assert.throws(() => applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'a' }, db));
  const t = blank(); give(t, 0, 'Mystical Elf'); put(t, 0, 0, mon('Summoned Skull'));
  applyMut(t, { t: 'attack', from: 0, to: -1 }, db);
  assert.throws(() => applyMut(t, { t: 'play', hand: [0], onto: null, pos: 'a' }, db));
});

// ---------- melds ----------
test('printed fusion: the materials named on Flame Swordsman', () => {
  const r = meldPair(db, C('Flame Manipulator').id, C('Masaki the Legendary Swordsman').id);
  assert.equal(r.kind, 'printed'); assert.equal(r.id, C('Flame Swordsman').id);
  const r2 = meldPair(db, C('Masaki the Legendary Swordsman').id, C('Flame Manipulator').id);
  assert.equal(r2.id, C('Flame Swordsman').id);
});
test('cross meld: weakest monster with one Type, the other Attribute, and more ATK than both', () => {
  let checked = 0;
  const mons = db.pool.cards.filter(c => c.kind === 'monster');
  const r = Rng.fromSeed(9);
  for (let k = 0; k < 4000; k++) {
    const A = r.pick(mons), B = r.pick(mons);
    const m = meldPair(db, A.id, B.id);
    if (m.kind === 'printed') continue;
    const floor = Math.max(A.atk, B.atk);
    const cands = mons.filter(c => c.atk > floor && ((c.type === A.type && c.attr === B.attr) || (c.type === B.type && c.attr === A.attr)));
    if (!cands.length) { assert.equal(m.kind, 'fizzle'); continue; }
    assert.equal(m.kind, 'cross');
    const R = db.byId.get(m.id);
    assert.ok(R.atk > floor); assert.notEqual(R.kind, 'fusion');
    assert.ok(cands.every(c => db.cmp(R, c) <= 0), 'weakest candidate');
    assert.deepEqual(meldPair(db, B.id, A.id), m, 'order of the two cards does not change a cross meld');
    checked++;
  }
  assert.ok(checked > 500);
});
test('equip +500, fuel +300, two spells fizzle', () => {
  const e = db.pool.cards.find(c => c.kind === 'equip'), f = db.pool.cards.find(c => roleOf(db, c.id) === 'fuel');
  const m = C('Mystical Elf');
  const p1 = planChain(db, [{ id: m.id }, { id: e.id }], null);
  assert.equal(p1.final.id, m.id); assert.equal(p1.final.ba, 500); assert.equal(p1.final.bd, 500); assert.equal(p1.fizzles, 0);
  const p2 = planChain(db, [{ id: f.id }, { id: m.id }], null);
  assert.equal(p2.final.id, m.id); assert.equal(p2.final.ba, 300); assert.ok(p2.melded);
  const p3 = planChain(db, [{ id: f.id }, { id: e.id }], null);
  assert.equal(p3.fizzles, 1); assert.equal(p3.final.id, e.id); assert.deepEqual(p3.gy, [f.id]); assert.ok(!p3.melded);
});
test('chain order matters and the result is the next card A', () => {
  const p = planChain(db, [{ id: C('Flame Manipulator').id }, { id: C('Masaki the Legendary Swordsman').id }, { id: db.pool.cards.find(c => c.kind === 'equip').id }], null);
  assert.equal(p.final.id, C('Flame Swordsman').id); assert.equal(p.final.ba, 500); assert.equal(p.len, 3);
});
test('three-material printed fusions need all three in a row', () => {
  const three = db.pool.cards.find(c => c.kind === 'fusion' && c.materials && c.materials.length === 3);
  if (!three) return;
  const [a, b, c] = three.materials;
  assert.equal(meldTriple(db, a, b, c).id, three.id);
  const p = planChain(db, [{ id: c }, { id: a }, { id: b }], null);
  assert.equal(p.final.id, three.id);
});
test('a melded monster arrives face up; materials go to the graveyard; the deck list is untouched', () => {
  const s = blank(); give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
  const deckBefore = s.deck[0].length;
  assert.throws(() => applyMut(clone(s), { t: 'play', hand: [0, 1], onto: null, pos: 'd', veiled: true }, db));
  applyMut(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, db);
  const m = s.mon[0].find(Boolean);
  assert.equal(m.id, C('Flame Swordsman').id); assert.equal(m.veil, false);
  assert.deepEqual(s.gy[0].slice().sort(), [C('Flame Manipulator').id, C('Masaki the Legendary Swordsman').id].sort());
  assert.equal(s.deck[0].length, deckBefore); assert.equal(s.stats[0].melds, 1);
});
test('melding onto a table monster keeps its zone; a fizzle there loses it', () => {
  const s = blank(); put(s, 0, 2, mon('Flame Manipulator')); give(s, 0, 'Masaki the Legendary Swordsman');
  applyMut(s, { t: 'play', hand: [0], onto: 2, pos: 'a' }, db);
  assert.equal(s.mon[0][2].id, C('Flame Swordsman').id);
  // a pair with no stronger match fizzles
  const mons = db.pool.cards.filter(c => c.kind === 'monster').sort((a, b) => b.atk - a.atk);
  const top = mons[0]; const other = mons.find(c => meldPair(db, top.id, c.id).kind === 'fizzle');
  const t = blank(); put(t, 0, 1, { u: uid++, id: top.id, pos: 'a', att: 0 }); t.hand[0].push({ u: uid++, id: other.id });
  applyMut(t, { t: 'play', hand: [0], onto: 1, pos: 'a' }, db);
  assert.equal(t.mon[0][1].id, other.id); assert.ok(t.gy[0].includes(top.id)); assert.equal(t.stats[0].fizzles, 1);
});

// ---------- spells, traps, terrain ----------
test('field spell becomes the terrain and favours its Types on both sides', () => {
  const s = blank(); give(s, 0, 'Mountain');
  const d = put(s, 0, 0, mon('Blue-Eyes White Dragon')), e = put(s, 1, 0, mon('Mystical Elf'));
  const a0 = effAtk(s, db, 0, d), e0 = effAtk(s, db, 1, e);
  applyMut(s, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(s.terrain.id, C('Mountain').id);
  assert.equal(effAtk(s, db, 0, d), a0 + 500); assert.equal(effDef(s, db, 0, d) > 0, true); assert.equal(effAtk(s, db, 1, e), e0);
});
test('tagged spells do their one effect', () => {
  const s = blank(); give(s, 0, 'Fissure'); put(s, 1, 0, mon('Mystical Elf')); put(s, 1, 1, mon('Summoned Skull'));
  applyMut(s, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(s.mon[1][1], null); assert.ok(s.mon[1][0]);
  const t = blank(); give(t, 0, 'Raigeki'); put(t, 1, 0, mon('Mystical Elf')); put(t, 1, 1, mon('Summoned Skull')); put(t, 0, 0, mon('Mystical Elf'));
  applyMut(t, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(t.mon[1].filter(Boolean).length, 0); assert.ok(t.mon[0][0]);
  const u = blank(); give(u, 0, 'Tremendous Fire'); applyMut(u, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(u.lp[1], db.config.lp - db.tagOf.get(C('Tremendous Fire').id).n);
  const v = blank(); give(v, 0, 'Fissure');
  assert.equal(legalActions(v, db).filter(a => a.t === 'play').length, 0, 'a spell with nothing to do cannot be played');
});
test('a trap is set, asks only when it can act, and stops the attack', () => {
  const s = blank(); give(s, 0, 'Trap Hole');
  applyMut(s, { t: 'play', hand: [0], onto: null }, db);
  assert.ok(s.traps[0].some(Boolean));
  applyMut(s, { t: 'end' }, db);
  s.hand[1] = []; put(s, 1, 0, mon('Summoned Skull')); put(s, 0, 0, mon('Mystical Elf'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.ok(s.pending); assert.deepEqual(legalActions(s, db).map(a => a.t), ['respond', 'respond']);
  assert.throws(() => applyMut(clone(s), { t: 'end' }, db));
  const keep = clone(s); applyMut(keep, { t: 'respond', trap: -1 }, db);
  assert.equal(keep.mon[0][0], null, 'declined: the attack lands');
  applyMut(s, { t: 'respond', trap: s.pending.options[0] }, db);
  assert.equal(s.mon[1][0], null); assert.ok(s.mon[0][0]); assert.equal(s.traps[0].filter(Boolean).length, 0);
});
test('fuel cannot be played alone but can be scrapped', () => {
  const f = db.pool.cards.find(c => roleOf(db, c.id) === 'fuel');
  const s = blank(); s.hand[0].push({ u: uid++, id: f.id });
  const la = legalActions(s, db);
  assert.ok(!la.some(a => a.t === 'play')); assert.ok(la.some(a => a.t === 'discard'));
});

// ---------- veils and hidden information ----------
test('viewFor hides the rival hand, deck order, veiled monsters and set traps', () => {
  const s = blank(); give(s, 1, 'Summoned Skull', 'Trap Hole');
  put(s, 1, 0, mon('Blue-Eyes White Dragon', 'd', { veil: true })); s.traps[1][0] = { u: uid++, id: C('Trap Hole').id };
  const v = viewFor(s, db, 0), txt = JSON.stringify(v);
  assert.ok(!txt.includes(String(C('Summoned Skull').id))); assert.ok(!txt.includes(String(C('Blue-Eyes White Dragon').id)));
  assert.ok(!txt.includes(String(C('Trap Hole').id))); assert.ok(!('rng' in v)); assert.ok(!('deck' in v));
  assert.deepEqual(v.mon[1][0], { veil: true, pos: 'd', u: s.mon[1][0].u });
  const mine = viewFor(s, db, 1); assert.equal(mine.mon[1][0].id, C('Blue-Eyes White Dragon').id);
});
test('a veiled monster is revealed when attacked', () => {
  const s = blank(); put(s, 0, 0, mon('Summoned Skull')); put(s, 1, 0, mon('Mystical Elf', 'd', { veil: true }));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.ok(!s.mon[1][0] || s.mon[1][0].veil === false);
});
test('the CPU decides the same way whatever is hidden from it', () => {
  // Same public position, different hidden cards: every level must choose the same action.
  const mons = db.pool.cards.filter(c => c.kind === 'monster');
  let compared = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const r = Rng.fromSeed(seed);
    const deck = () => Array.from({ length: 40 }, () => ({ id: r.pick(db.pool.cards.filter(c => c.kind !== 'fusion')).id }));
    const s = newDuel(db, { seed, decks: [deck(), deck()] });
    for (let step = 0; step < 40 && s.winner === null; step++) {
      const seat = s.pending ? 1 - s.active : s.active;
      const t = clone(s);
      // scramble everything seat cannot see
      const o = 1 - seat;
      t.hand[o] = t.hand[o].map(c => ({ ...c, id: r.pick(mons).id }));
      t.deck[o] = t.deck[o].map(() => ({ id: r.pick(mons).id })); t.deck[seat] = r.shuffle(t.deck[seat].slice());
      t.mon[o] = t.mon[o].map(m => m && m.veil ? { ...m, id: r.pick(mons).id, ba: 700 } : m);
      t.traps[o] = t.traps[o].map(x => x ? { ...x, id: C('Mirror Force').id } : x);
      for (const level of [0, 1, 2]) {
        const a = chooseAction(db, viewFor(s, db, seat), level, {}), b = chooseAction(db, viewFor(t, db, seat), level, {});
        assert.deepEqual(a, b, 'seed ' + seed + ' step ' + step + ' level ' + level); compared++;
      }
      applyMut(s, chooseAction(db, viewFor(s, db, seat), 2, {}) || { t: 'end' }, db);
    }
  }
  assert.ok(compared > 5000);
});

// ---------- enchants ----------
test('enchants: piercing, twin, drain, bulwark, venom, ambusher, echo, herald, warden, soaring, kindred, catalyst', () => {
  let s = blank(); let X = put(s, 0, 0, mon('Summoned Skull', 'a', { e: 'piercing' })); let T = put(s, 1, 0, mon('Mystical Elf', 'd'));
  let f = forecast(s, db, 0, X, 1, T); applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.lp[1], db.config.lp - (f.a - f.d));
  s = blank(); put(s, 0, 0, mon('Summoned Skull', 'a', { e: 'twin' })); applyMut(s, { t: 'attack', from: 0, to: -1 }, db); applyMut(s, { t: 'attack', from: 0, to: -1 }, db); assert.throws(() => applyMut(s, { t: 'attack', from: 0, to: -1 }, db));
  s = blank(); s.lp[0] = 5000; X = put(s, 0, 0, mon('Summoned Skull', 'a', { e: 'drain' })); applyMut(s, { t: 'attack', from: 0, to: -1 }, db); assert.equal(s.lp[0], 5000 + effAtk(s, db, 0, X));
  s = blank(); put(s, 0, 0, mon('Summoned Skull')); put(s, 1, 0, mon('Mystical Elf', 'a', { e: 'bulwark' })); applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.ok(s.mon[1][0]); s.mon[0][0].att = 0; applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.mon[1][0], null);
  s = blank(); put(s, 0, 0, mon('Mystical Elf', 'a', { e: 'venom' })); put(s, 1, 0, mon('Summoned Skull')); applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.mon[1][0], null); assert.equal(s.mon[0][0], null);
  s = blank(); X = put(s, 0, 0, mon('Mystical Elf')); T = put(s, 1, 0, mon('Mystical Elf', 'd', { veil: true, e: 'ambusher' })); const lp0 = s.lp[0]; applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(lp0 - s.lp[0], effDef(s, db, 1, s.mon[1][0]) + 800 - effAtk(s, db, 0, s.mon[0][0]));
  s = blank(); put(s, 0, 0, mon('Summoned Skull')); put(s, 1, 0, mon('Mystical Elf', 'a', { e: 'echo' })); applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.hand[1].length, 1); assert.equal(s.hand[1][0].e, 'echo');
  s = blank(); s.hand[0].push({ u: uid++, id: C('Mystical Elf').id, e: 'herald' }); const dk = s.deck[0].length; applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'a' }, db); assert.equal(s.deck[0].length, dk - 1);
  s = blank(); put(s, 0, 0, mon('Summoned Skull')); put(s, 1, 0, mon('Mystical Elf', 'd', { e: 'warden' })); put(s, 1, 1, mon('Mystical Elf')); assert.deepEqual(legalActions(s, db).filter(a => a.t === 'attack').map(a => a.to), [0]);
  s = blank(); put(s, 0, 0, mon('Summoned Skull')); put(s, 1, 0, mon('Mystical Elf', 'a', { e: 'soaring' })); assert.equal(legalActions(s, db).filter(a => a.t === 'attack').length, 0);
  s = blank(); X = put(s, 0, 0, mon('Mystical Elf', 'a', { e: 'kindred' })); const base = effAtk(s, db, 0, X); put(s, 0, 1, mon('Mystical Elf')); put(s, 0, 2, mon('Mystical Elf')); assert.equal(effAtk(s, db, 0, X), base + 400);
  const mons = db.pool.cards.filter(c => c.kind === 'monster').sort((a, b) => b.atk - a.atk); const top = mons[0]; const oth = mons.find(c => meldPair(db, top.id, c.id).kind === 'fizzle');
  const p = planChain(db, [{ id: oth.id }], { id: top.id, e: 'catalyst', u: 1 }); assert.equal(p.fizzles, 0); assert.equal(p.final.id, top.id); assert.equal(p.final.ba, 300);
});

// ---------- relics ----------
function withRelics(ids, setup) { const s = blank({ seats: [{ relics: sortRelics(ids), underCap: 20, secondWind: ids.includes('second_wind') }, {}] }); s.hand = [[], []]; s.turn = 3; s.active = 0; if (setup) setup(s); return s; }
test('every relic states a finite limit and belongs to a family', () => {
  for (const [id, r] of Object.entries(RELICS)) { assert.ok(r.name && r.text && r.family && 'CGMF'.includes(r.kind), id); }
  const plain = Object.values(RELICS).filter(r => r.family === 'plain').length;
  assert.ok(plain * 4 <= Object.keys(RELICS).length, 'at most one relic in four is a plain stat bonus');
});
test('Forge Heart arms once after a Field Spell and pays on the next meld; Kindling and Ashen Echo stack once', () => {
  const s = withRelics(['forge_heart', 'kindling', 'ashen_echo']);
  give(s, 0, 'Mountain'); applyMut(s, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(s.seat[0].rs.nextMeld.length, 1);
  applyMut(s, { t: 'end' }, db); s.hand[1] = []; applyMut(s, { t: 'end' }, db); s.hand[0] = [];
  give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
  applyMut(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, db);
  const m = s.mon[0].find(Boolean);
  assert.equal(m.ba, 300 + 300 + 300, 'Forge Heart + Kindling (FIRE) + Ashen Echo'); assert.equal(m.bd, 600);
  assert.equal(s.seat[0].rs.nextMeld.length, 0);
});
test('relic bonuses stop at the ceiling and say so; Masterworks sit outside it', () => {
  const s = withRelics(['living_furnace']);
  const m = put(s, 0, 0, mon('Mystical Elf', 'a', { ra: 1400, rd: 1400, ba: 1400, bd: 1400, meld: 1 }));
  const ev = [];
  // internal: push a normal relic bonus through the public hook path
  s.seat[0].relics = ['whetstone', 'living_furnace'];
  give(s, 0, 'Mystical Elf'); s.mon[0][0] = null; s.seat[0].rs = { nextMeld: [{ a: 300, d: 300, id: 'whetstone' }] };
  const t = withRelics(['copper_loop', 'patient_coil', 'kindling', 'forge_heart', 'whetstone', 'heavy_crown', 'ashen_echo']);
  t.seat[0].rs.nextMeld = [{ a: 300, d: 300, id: 'forge_heart' }, { a: 300, d: 300, id: 'forge_heart' }, { a: 300, d: 300, id: 'forge_heart' }];
  const f = db.pool.cards.filter(c => roleOf(db, c.id) === 'fuel').slice(0, 2);
  give(t, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman'); t.hand[0].push({ u: uid++, id: f[0].id }, { u: uid++, id: f[1].id });
  const events = applyMut(t, { t: 'play', hand: [0, 1, 2, 3], onto: null, pos: 'a' }, db);
  const r = t.mon[0].find(Boolean);
  assert.equal(r.ra, db.config.relicCap); assert.ok(events.some(e => e.e === 'cap')); assert.equal(t.stats[0].capHits > 0, true);
  assert.equal(r.ba, 600 + db.config.relicCap, 'two fuel melds plus the capped relic total');
});
test('Second Wind saves the duel once', () => {
  const s = withRelics(['second_wind']); s.lp[0] = 500; s.active = 1; put(s, 1, 0, mon('Summoned Skull'));
  applyMut(s, { t: 'attack', from: 0, to: -1 }, db); assert.equal(s.lp[0], 1000); assert.equal(s.winner, null);
  s.mon[1][0].att = 0; applyMut(s, { t: 'attack', from: 0, to: -1 }, db); assert.equal(s.winner, 1);
});
test('Gravecloth, Tomb Bell and Patient Hunter fire on a veiled defender that survives', () => {
  const s = withRelics(['gravecloth', 'tomb_bell', 'patient_hunter']); s.active = 1;
  put(s, 1, 0, mon('Mystical Elf')); const T = put(s, 0, 0, mon('Mystical Elf', 'd', { veil: true }));
  const lp = s.lp[0]; applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.lp[0], lp + 300); assert.equal(T.bd === undefined ? s.mon[0][0].bd : s.mon[0][0].bd, 300); assert.equal(s.seat[0].rs.nextMeld.length, 1);
});

// ---------- laws ----------
test('laws: stonewall wins ties, blood price heals, tyranny shrinks the hand, mist veils', () => {
  let s = blank({ seats: [{}, { law: 'stonewall' }] }); s.hand = [[], []]; s.turn = 3; s.active = 0;
  put(s, 0, 0, mon('Mystical Elf')); put(s, 1, 0, mon('Mystical Elf')); applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.mon[0][0], null); assert.ok(s.mon[1][0]);
  s = blank({ seats: [{}, { law: 'bloodprice' }] }); s.hand = [[], []]; s.turn = 4; s.active = 1;
  put(s, 1, 0, mon('Summoned Skull')); put(s, 0, 0, mon('Mystical Elf', 'd')); const lp = s.lp[1]; applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.lp[1], lp + 500);
  s = newDuel(db, { seed: 3, decks: [filler(), filler()], seats: [{}, { law: 'mist' }], first: 1 });
  const plays = legalActions(s, db, { maxChain: 1 }).filter(a => a.t === 'play' && a.pos); assert.ok(plays.length && plays.every(a => a.veiled));
  s = newDuel(db, { seed: 3, decks: [filler(), filler()], seats: [{ handSize: 4 }, { law: 'tyranny' }], first: 0 }); assert.equal(s.hand[0].length, 4);
});
test('scorched ground: your Field Spell holds two of your turns, then his returns', () => {
  const s = newDuel(db, { seed: 3, decks: [filler(), filler()], seats: [{}, { law: 'scorched' }], first: 0 });
  assert.equal(s.terrain.id, C('Molten Destruction').id);
  s.hand[0] = []; give(s, 0, 'Mountain'); applyMut(s, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(s.terrain.id, C('Mountain').id);
  applyMut(s, { t: 'end' }, db); applyMut(s, { t: 'end' }, db); assert.equal(s.terrain.id, C('Mountain').id);
  applyMut(s, { t: 'end' }, db); assert.equal(s.terrain.id, C('Molten Destruction').id);
});

// ---------- weight, kits, rank ----------
test('weight: monster = Level, Field or Equip 2, tagged 3, fuel 1; nothing weighs zero', () => {
  assert.equal(weightOf(db, C('Blue-Eyes White Dragon').id), C('Blue-Eyes White Dragon').level);
  assert.equal(weightOf(db, C('Mountain').id), 2); assert.equal(weightOf(db, C('Fissure').id), 3); assert.equal(weightOf(db, C('Trap Hole').id), 3);
  for (const c of db.pool.cards) assert.ok(weightOf(db, c.id) >= 1, c.name);
});
test('every dealt kit is 40 cards, inside its quotas and at or under the kit weight', () => {
  const r = Rng.fromSeed(5);
  for (let i = 0; i < 300; i++) for (const k of KITS) {
    const { deck } = makeKit(db, r, k);
    assert.equal(deck.length, 40); assert.ok(deckWeight(db, deck) <= db.config.kitWeight);
    const mons = deck.filter(e => db.isMonster(e.id));
    assert.equal(mons.length, db.config.kit.monsters);
    for (const e of mons) { const c = db.byId.get(e.id); assert.ok(c.level <= 4 && c.atk <= 1500); }
    const cnt = {}; for (const e of deck) { cnt[e.id] = (cnt[e.id] || 0) + 1; assert.ok(cnt[e.id] <= 3); }
  }
});
test('rank letters follow the config thresholds and both styles only add points', () => {
  const k = db.config.rank;
  assert.equal(rankLetter(k, k.S), 'S'); assert.equal(rankLetter(k, k.S - 1), 'A'); assert.equal(rankLetter(k, k.C - 1), 'D');
  const s = blank(); s.stats[0].turns = 7; const base = rankDuel(db, s, 0).points;
  s.stats[0].melds = 2; const withMelds = rankDuel(db, s, 0); assert.ok(withMelds.points > base); assert.equal(withMelds.style, 'craft');
  s.stats[0].melds = 0; s.stats[0].bigHits = 3; const fury = rankDuel(db, s, 0); assert.ok(fury.points > base); assert.equal(fury.style, 'fury');
});

// ---------- determinism and purity ----------
test('apply is pure and the same seed gives the same duel', () => {
  const mk = () => newDuel(db, { seed: 99, decks: [filler(), filler()] });
  const a = mk(), b = mk(); assert.equal(canonical(a), canonical(b));
  const before = canonical(a); const { state } = apply(a, { t: 'end' }, db);
  assert.equal(canonical(a), before); assert.notEqual(canonical(state), before);
});

// ---------- runs ----------
test('a run offers three kits, three charms, then three doors with a duel among them, every chamber', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const run = newRun(db, { seed });
    assert.equal(run.offer.length, 3);
    runApply(run, { t: 'kit', i: seed % 3 }, db); assert.equal(run.offer.options.length, 3);
    runApply(run, { t: 'pick', i: 0 }, db);
    let guard = 0;
    while (run.phase !== 'over' && guard++ < 100000) {
      if (run.phase === 'chamber') {
        const boss = run.doors.length === 1 && run.doors[0].type === 'boss';
        if (!boss) { assert.equal(run.doors.length, 3); assert.ok(run.doors.some(d => d.tier), 'a duel door in every chamber'); }
        else assert.ok(run.seals >= 2, 'the boss door needs two seals');
        for (const d of run.doors) { assert.ok(d.cost && d.reward && d.name, 'every door states cost and reward'); if (!d.tier) assert.ok(!/Spark if/.test(d.cost)); }
        assert.ok(deckWeight(db, run.deck) <= weightCap(db, run)); assert.equal(run.deck.length, 40 - run.binds);
      }
      runApply(run, policyAction(db, run, { level: 2 }), db);
    }
    assert.ok(run.result); assert.ok(run.sparks >= 0 && run.sparks <= db.config.sparks);
    assert.ok(run.charms.length <= db.config.charmSlots); assert.ok(run.masterworks.length <= db.config.maxMasterworks);
    assert.equal(new Set([...run.charms, ...run.gifts, ...run.masterworks]).size, run.charms.length + run.gifts.length + run.masterworks.length, 'no relic twice');
  }
});
test('the same seed and the same choices give the same run', () => {
  const a = playRun(db, newRun(db, { seed: 4242 }), { level: 2 }), b = playRun(db, newRun(db, { seed: 4242 }), { level: 2 });
  assert.equal(canonical(a), canonical(b));
});
test('a run survives being saved and loaded after every action', () => {
  let run = newRun(db, { seed: 77 }); let guard = 0;
  while (run.phase !== 'over' && guard++ < 100000) { run = JSON.parse(JSON.stringify(run)); runApply(run, policyAction(db, run, { level: 1 }), db); }
  const straight = playRun(db, newRun(db, { seed: 77 }), { level: 1 });
  assert.equal(canonical(run), canonical(straight));
});

test('Heavy Crown is never offered to a deck it would push over the cap (found by the simulator, seed 20066)', () => {
  for (let seed = 20000; seed < 20120; seed++) {
    const run = newRun(db, { seed }); let guard = 0;
    while (run.phase !== 'over' && guard++ < 100000) {
      runApply(run, policyAction(db, run, { level: 2, family: 'lean' }), db);
      if (run.phase === 'chamber') assert.ok(deckWeight(db, run.deck) <= weightCap(db, run), 'deck over the cap, seed ' + seed);
    }
  }
});

test('Forgers: each deals its own three kits, carries its rule, and uses its power once a duel', () => {
  for (const f of FORGER_IDS) {
    const run = newRun(db, { seed: 4242, forger: f });
    assert.deepEqual(run.offer.map(k => k.kit), FORGERS[f].kits.map(k => k.id));
    for (const k of run.offer) assert.ok(k.deck.length === 40 && deckWeight(db, k.deck) <= db.config.kitWeight, f + ' kit over weight');
    runApply(run, { t: 'kit', i: 0 }, db); runApply(run, { t: 'pick', i: 0 }, db);
    const d = run.doors.findIndex(x => x.type === 'duel' || x.tier); runApply(run, { t: 'door', i: d < 0 ? 0 : d }, db);
    if (run.phase !== 'duel') continue;
    assert.equal(run.duel.seat[0].forger, f); assert.equal(run.duel.seat[0].relics[0], FORGERS[f].rule);
    let guard = 0;
    while (run.phase === 'duel' && guard++ < 400) {
      const acts = legalActions(run.duel, db).filter(a => a.t === 'power');
      if (run.duel.active === 0 && !run.duel.pending && acts.length) {
        runApply(run, { t: 'duel', action: acts[0] }, db);
        assert.equal(run.duel ? run.duel.seat[0].rs.power : 1, 1);
        if (run.duel) { assert.equal(legalActions(run.duel, db).filter(a => a.t === 'power').length, 0, 'power offered twice'); assert.throws(() => runApply(run, { t: 'duel', action: acts[0] }, db)); }
        break;
      }
      runApply(run, policyAction(db, run, { level: 0 }), db);
    }
  }
});

test('a run without a Forger never sees a power or a Forger relic', () => {
  const run = playRun(db, newRun(db, { seed: 9 }), { level: 2 });
  assert.equal(run.forger, undefined);
  for (const id of Object.keys(run.stats.relicFires)) assert.notEqual(RELICS[id].kind, 'F');
});

test('locked relics are never offered and locked Masterworks cannot be forged', () => {
  const locked = VAULT.map(v => v.id);
  for (let seed = 1; seed <= 25; seed++) {
    const run = playRun(db, newRun(db, { seed, locked }), { level: 2 });
    for (const id of [...run.charms, ...run.gifts, ...run.masterworks]) assert.ok(!locked.includes(id), id + ' was locked, seed ' + seed);
  }
});

test('profile: every run pays Memories, unlocks come from feats, the Vault takes Memories', () => {
  const p = newProfile();
  assert.equal(maxHeat(p), 0); assert.deepEqual(p.forgers, ['tarn']);
  const run = playRun(db, newRun(db, { seed: 5, forger: 'tarn', locked: lockedRelics(p) }), { level: 0 }); // a beginner: it loses
  const pre = scoreRun(p, run);
  const got = applyRun(p, run);
  assert.equal(got.total, pre.total); assert.ok(got.total > 0, 'a lost run still pays'); assert.equal(p.memories, got.total);
  assert.ok(p.forgers.includes('scrapper'), 'finishing a run unlocks the Scrapper');
  assert.throws(() => buy(newProfile(), 'tomb_bell'), /not enough/);
  p.memories = 100; buy(p, 'tomb_bell'); assert.equal(p.memories, 80); assert.ok(!lockedRelics(p).includes('tomb_bell')); assert.throws(() => buy(p, 'tomb_bell'), /already/);
  let won = null; for (let seed = 1; seed < 60 && !won; seed++) { const r = playRun(db, newRun(db, { seed }), { level: 2 }); if (r.result.won) won = r; }
  const q = newProfile(); const w = applyRun(q, won);
  assert.equal(q.heatCleared, 0); assert.equal(maxHeat(q), 1); assert.ok(w.unlocks.some(u => u.kind === 'heat')); assert.ok(q.forgers.includes('storm') && q.forgers.includes('veil'));
});

test('lab relics: never in a normal run; switched on, Tomb Ledger chains into Grave Call and Second Burial inside the limits', () => {
  for (const id of Object.keys(LAB)) { assert.ok(!RELICS[id], id + ' stays out of the offered relics'); assert.match(LAB[id].text, /once|first|up to|ends when/i, id + ' states a limit'); }
  const plain = playRun(db, newRun(db, { seed: 5 }), { level: 2 });
  for (const id of Object.keys(LAB)) assert.ok(!plain.stats.relicFires[id], id + ' never fires in a normal run');
  const lab = { ...db, config: { ...db.config, testRelics: ['tomb_ledger', 'grave_call', 'second_burial'] }, _pair: new Map() };
  const r = playRun(lab, newRun(lab, { seed: 5 }), { level: 2 });
  const f = r.stats.relicFires;
  assert.ok(f.tomb_ledger > 0 && f.grave_call > 0 && f.second_burial > 0, 'the three Tomb relics answer each other');
  assert.ok(f.grave_call <= f.tomb_ledger && f.second_burial <= 2 * f.grave_call, 'each link fires at most once per link before it (Second Burial is counted when armed and when paid)');
  assert.ok(f.tomb_ledger <= r.stats.turns && CHAIN_TURN >= 3, 'the Ledger marks at most once a turn');
});

test('feats: counted across runs win or lose, each unlocks one Gift, and the new Gift is shown once in the next run', () => {
  const lab = { ...db, config: { ...db.config, labPool: FEAT_GIFTS, giftXpScale: 2 }, _pair: new Map() };
  const p = newProfile();
  for (const g of FEAT_GIFTS) { assert.ok(LAB[g], g + ' exists'); assert.ok(lockedRelics(p).includes(g), g + ' starts locked'); }
  const plain = newRun(db, { seed: 3 }); assert.ok(!('feat' in plain) && !('featured' in plain) && !('rerolls' in plain), 'an ordinary run carries no feat fields');
  let unlocked = null, runs = 0;
  for (let seed = 1; seed < 12 && !unlocked; seed++) {
    const run = playRun(lab, newRun(lab, { seed, locked: lockedRelics(p), track: true }), { level: 2 });
    for (const g of lockedRelics(p)) assert.ok(!run.gifts.includes(g), 'a locked Gift is never offered');
    const before = { ...p.feats }; const got = applyRun(p, run); runs++;
    for (const f of got.feats) { assert.equal(f.before, before[f.id] || 0); assert.ok(f.after >= f.before && f.after <= f.goal); }
    unlocked = got.unlocks.find(u => u.kind === 'gift') || null;
  }
  assert.ok(unlocked, 'an expert player completes a build feat within a few runs'); assert.ok(runs <= 4, 'took ' + runs + ' runs');
  assert.ok(p.fresh.includes(unlocked.id) && !lockedRelics(p).includes(unlocked.id));
  // next run: the first Gift offer holds the new Gift, marked, exactly once
  let seen = 0, offers = 0; const nFresh = p.fresh.length; const run = newRun(lab, { seed: 77, locked: lockedRelics(p), featured: p.fresh, track: true });
  while (run.phase !== 'over') { if (run.phase === 'reward' && run.offer.kind === 'gift') { offers++; if (run.offer.fresh) { seen++; assert.equal(offers, seen, 'new Gifts come in the first offers, one each'); assert.ok(run.offer.options.includes(run.offer.fresh)); } } runApply(run, policyAction(lab, run, { level: 2 }), lab); }
  assert.ok(offers > 0, 'the run reached a Gift offer'); assert.equal(seen, Math.min(offers, nFresh));
});

test('leaning offers and the re-deal: with a build piece held, a Gift offer always holds a piece of that build while one is left', () => {
  const lab = { ...db, config: { ...db.config, labPool: Object.keys(LAB).filter(id => LAB[id].kind === 'G'), giftXpScale: 2, leanOffers: 1, giftRerolls: 1 }, _pair: new Map() };
  let checked = 0, redealt = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const run = newRun(lab, { seed }); assert.equal(run.rerolls, 1);
    while (run.phase !== 'over') {
      if (run.phase === 'reward' && run.offer.kind === 'gift') {
        const fam = id => (RELICS[id] || LAB[id]).family, held = new Set([...run.charms, ...run.gifts].map(fam).filter(f => ['furnace', 'shadow', 'lean', 'storm', 'tomb'].includes(f)));
        if (held.size) { checked++; assert.ok(run.offer.options.some(id => held.has(fam(id))), 'seed ' + seed + ': no option leans toward ' + [...held]); }
        if (run.rerolls) { const was = run.offer.options.slice(); runApply(run, { t: 'reroll' }, lab); redealt++; assert.equal(run.rerolls, 0); for (const id of run.offer.options) assert.ok(!was.includes(id), 'a re-deal shows three other Gifts'); assert.throws(() => runApply(run, { t: 'reroll' }, lab), /no re-deal/); continue; }
      }
      runApply(run, policyAction(lab, run, { level: 2, family: 'tomb' }), lab);
    }
  }
  assert.ok(checked >= 6 && redealt >= 4, 'checked ' + checked + ' offers, ' + redealt + ' re-deals');
});

test('rival styles: off by default; on, a floor-two rival shows its tell, carries its relics and they fire for the rival', () => {
  for (const th of THEMES) { const st = STYLES[th.id]; assert.ok(st && st.tell && st.text, th.id + ' has a style, a tell and a text'); for (const id of st.relics) assert.ok(RELICS[id] || LAB[id], id); }
  const plain = playRun(db, newRun(db, { seed: 9 }), { level: 2 });
  assert.ok(!plain.log.length && Object.keys(plain.stats.byTier).every(k => !k.startsWith('style')));
  const lab = { ...db, config: { ...db.config, rivalStyles: 1, trackFx: 1 }, _pair: new Map() };
  let tells = 0, styled = 0, fired = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const run = newRun(lab, { seed });
    while (run.phase !== 'over') {
      if (run.phase === 'chamber') for (const d of run.doors) { if (d.tell) { tells++; assert.ok(run.floor >= 1 || d.tier === 'champion' || d.tier === 'guardian', 'ordinary first-floor duels stay plain'); assert.equal(d.tell, STYLES[THEMES[d.theme].id].tell); } else if (d.tier && d.tier !== 'boss' && run.floor >= 1) assert.fail('a floor-two rival without a tell'); }
      if (run.phase === 'duel' && run.rival.style) { styled++; assert.deepEqual(run.duel.seat[1].relics, STYLES[run.rival.theme].relics); for (const id of run.duel.seat[1].relics) fired += run.duel.stats[1].relicFires[id] || 0; }
      runApply(run, policyAction(lab, run, { level: 2 }), lab);
    }
  }
  assert.ok(tells > 20 && styled > 20 && fired > 20, `tells ${tells}, styled duel steps ${styled}, rival relic fires seen ${fired}`);
});

test('free Trap and Cracked Mask: only the Trap set is free; turning your own veiled monster up arms the next meld once', () => {
  const lab = { ...db, config: { ...db.config, freeCast: 'trap' }, _pair: new Map() };
  const trap = [...db.tagOf.keys()].find(id => db.byId.get(id).kind === 'trap'), spell = [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === 'heal')[0];
  let s = blank(); s.hand[0].push({ u: uid++, id: trap }, { u: uid++, id: spell });
  applyMut(s, { t: 'play', hand: [0], onto: null }, lab); assert.equal(s.played, false, 'the Trap set is free');
  applyMut(s, { t: 'play', hand: [0], onto: null }, lab); assert.equal(s.played, true, 'the Spell uses the play');
  s = blank(); s.hand[0].push({ u: uid++, id: spell }); applyMut(s, { t: 'play', hand: [0], onto: null }, lab); assert.equal(s.played, true, 'a Spell alone is not free under the Trap-only rule');
  s = blank({ seats: [{ relics: ['cracked_mask', 'deep_shade'] }, {}] }); s.hand = [[], []]; s.turn = 3; s.active = 0;
  put(s, 0, 0, mon('Mystical Elf', 'd', { veil: true })); put(s, 0, 1, mon('Mystical Elf', 'd', { veil: true }));
  applyMut(s, { t: 'pos', zone: 0 }, db); assert.equal(s.mon[0][0].veil, false);
  assert.deepEqual(s.seat[0].rs.nextMeld.map(x => x.id).sort(), ['cracked_mask', 'deep_shade'], 'the Mask arms, and Deep Shade answers the reveal');
  applyMut(s, { t: 'pos', zone: 1 }, db); assert.equal(s.seat[0].rs.nextMeld.length, 2, 'once a duel');
});

test('Heat ladder: off by default; on, every level adds its written rule and Heat 10 ends at the second gate', () => {
  assert.equal(HEAT_RULES.length, 10); assert.deepEqual(HEAT_RULES.map(x => x.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const plain = newRun(db, { seed: 5, heat: 10 }); assert.equal(plain.sparks, db.config.sparks, 'with the lever off Heat changes no rule');
  const lab = { ...db, config: { ...db.config, heatRules: 1 }, _pair: new Map() };
  assert.equal(newRun(lab, { seed: 5, heat: 6 }).sparks, db.config.sparks); assert.equal(newRun(lab, { seed: 5, heat: 7 }).sparks, db.config.sparks - 1);
  let road = 0, hidden = 0, crowned = 0, hard = 0, gates = 0, cleared = 0, styled1 = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const run = newRun(lab, { seed, heat: 10, forger: 'tarn' });
    let last = null;
    while (run.phase !== 'over') {
      if (run.phase === 'chamber' && run.doors !== last) {
        last = run.doors;
        if (run.doors.length === 3) { assert.equal(run.doors.filter(d => d.reward === 'Hidden until you enter.').length, 1, 'Dim Halls hides one reward'); hidden++; }
        if (run.chamber === 2 && run.doors.length === 3 && run.doors.every(d => d.tier === 'champion' || d.tier === 'guardian')) road++;
        if (run.floor >= 1) assert.ok(run.doors.every(d => d.tier !== 'regular'), 'Cursed Halls: no ordinary duel on floors two and three');
        if (run.secondGate) { assert.equal(run.doors.length, 1); assert.equal(run.doors[0].type, 'boss'); }
      }
      const was = run.phase;
      runApply(run, policyAction(lab, run, { level: 2 }), lab);
      if (was !== 'duel' && run.phase === 'duel') {
        const seat = run.duel.seat[1];
        if (run.rival.tier === 'champion') { assert.ok(seat.relics.includes('heavy_crown')); crowned++; }
        if (run.rival.tier === 'boss') { assert.ok(seat.strong && seat.relics.includes('whetstone') && seat.relics.includes('iron_rations')); assert.ok(run.rival.lawText.includes('Hard Law')); hard++; }
        else if (run.floor === 0 && run.rival.style) styled1++;
      }
    }
    if (run.secondGate) gates++;
    if (run.result.won) { cleared++; assert.ok(run.secondGate, 'a Heat 10 clear goes through the second gate'); }
  }
  assert.ok(road > 30 && hidden > 200 && crowned > 20 && hard > 20 && styled1 > 60 && gates > 3 && cleared > 0, `road ${road}, hidden ${hidden}, crowned ${crowned}, hard ${hard}, styled floor one ${styled1}, gates ${gates}, cleared ${cleared}`);
});

test('Furnace Gifts: Banked Coals grows the melded monster each turn, Cinder Fall burns behind a 2500 monster, Quench rewards its kills', () => {
  const pass = s => { applyMut(s, { t: 'end' }, db); s.hand[1] = []; applyMut(s, { t: 'end' }, db); s.hand[0] = []; };
  let s = blank({ seats: [{ relics: ['banked_coals'] }, {}] });
  const big = put(s, 0, 0, mon('Mystical Elf', 'd', { meld: 1 })); put(s, 0, 1, mon('Summoned Skull', 'd'));
  for (let i = 0; i < 6; i++) pass(s);
  assert.equal(big.ba, 1200, 'four times, and only the melded monster'); assert.ok(!s.mon[0][1].ba);
  s = blank({ seats: [{ relics: ['cinder_fall'] }, {}] }); put(s, 0, 0, mon('Mystical Elf', 'd'));
  let lp = s.lp[1]; applyMut(s, { t: 'end' }, db); assert.equal(s.lp[1], lp, 'no monster of 2500 ATK is on the field yet');
  s = blank({ seats: [{ relics: ['cinder_fall'] }, {}] }); put(s, 0, 0, mon('Summoned Skull', 'd'));
  assert.ok(effAtk(s, db, 0, s.mon[0][0]) >= 2500); lp = s.lp[1];
  for (let i = 0; i < 6; i++) pass(s);
  assert.equal(s.lp[1], lp - 1600, '400 Life Points, four times a duel');
  s = blank({ seats: [{ relics: ['quench'] }, {}] }); const k = put(s, 0, 0, mon('Summoned Skull', 'a', { meld: 1 })); put(s, 1, 0, mon('Mystical Elf', 'a'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(k.ba, 200); assert.equal(k.bd, 200);
  s = blank({ seats: [{ relics: ['quench'] }, {}] }); const plain = put(s, 0, 0, mon('Summoned Skull', 'a')); put(s, 1, 0, mon('Mystical Elf', 'a'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.ok(!plain.ba, 'a monster that was not melded gets nothing');
});

test('even kits: off by default; on, each kit keeps its types and holds monsters up to its own cap', () => {
  const top = deck => Math.max(...deck.filter(e => db.isMonster(e.id)).map(e => db.byId.get(e.id).atk));
  const lab = { ...db, config: { ...db.config, kitTune: 1 }, _pair: new Map() };
  const all = [...KITS, ...FORGER_IDS.flatMap(f => FORGERS[f].kits)];
  for (const k of all) {
    let hi = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const plain = makeKit(db, Rng.fromSeed(seed), k); assert.ok(top(plain.deck) <= db.config.kit.maxAtk, k.id + ' is unchanged with the lever off');
      const kit = makeKit(lab, Rng.fromSeed(seed), k); assert.equal(kit.deck.length, 40);
      const cap = (KIT_TUNE[k.id] || db.config.kit).maxAtk; assert.ok(top(kit.deck) <= cap, k.id + ' stays under its cap of ' + cap);
      assert.ok(deckWeight(lab, kit.deck) <= ((KIT_TUNE[k.id] || {}).weight || db.config.kitWeight));
      hi = Math.max(hi, top(kit.deck));
    }
    if (KIT_TUNE[k.id] && KIT_TUNE[k.id].maxAtk > db.config.kit.maxAtk) assert.ok(hi > db.config.kit.maxAtk, k.id + ' can hold a stronger monster than before');
  }
});

test('Veilwalker candidate rule: off by default; on, her first lone veiled set in defense each turn is free, a second is not', () => {
  const elf = C('Mystical Elf').id, set = { t: 'play', hand: [0], onto: null, pos: 'd', veiled: true };
  let s = blank({ seats: [{ relics: ['f_veil'], forger: 'veil' }, {}] }); s.hand[0].push({ u: uid++, id: elf });
  applyMut(s, set, db); assert.equal(s.played, true, 'with the lever off a veiled set uses the play');
  const lab = { ...db, config: { ...db.config, forgerTune: { veilSet: 1 } }, _pair: new Map() };
  s = blank({ seats: [{ relics: ['f_veil'], forger: 'veil' }, {}] }); s.hand[0].push({ u: uid++, id: elf }, { u: uid++, id: elf });
  applyMut(s, set, lab); assert.equal(s.played, false, 'the first veiled set is free'); assert.ok(s.mon[0].some(m => m && m.veil && m.pos === 'd'));
  applyMut(s, set, lab); assert.equal(s.played, true, 'the second one uses the play');
  s = blank({ seats: [{ relics: ['f_veil'], forger: 'veil' }, {}] }); s.hand[0].push({ u: uid++, id: elf });
  applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'd' }, lab); assert.equal(s.played, true, 'a face-up monster is not free');
  s = blank({ seats: [{ relics: [] }, {}] }); s.hand[0].push({ u: uid++, id: elf });
  applyMut(s, set, lab); assert.equal(s.played, true, 'only the Veilwalker has it');
  const narrow = { ...db, config: { ...db.config, forgerTune: { veilSet: 2 } }, _pair: new Map() };
  s = blank({ seats: [{ relics: ['f_veil'], forger: 'veil' }, {}] }); s.hand[0].push({ u: uid++, id: elf }); put(s, 0, 3, mon('Mystical Elf', 'd', { veil: true }));
  applyMut(s, set, narrow); assert.equal(s.played, true, 'the narrow form is free only while she holds no veiled monster');
  s = blank({ seats: [{ relics: ['f_veil'], forger: 'veil' }, {}] }); s.hand[0].push({ u: uid++, id: elf });
  applyMut(s, set, narrow); assert.equal(s.played, false);
});

// Faults found by the break-it pass of 20 November 2026. Each test fails on the code as it was.
test('Chain Lightning answers every relic that takes Life Points, Glass Idol included', () => {
  const s = blank({ seats: [{ relics: ['glass_idol', 'chain_lightning'] }, {}] });
  put(s, 0, 0, mon('Mystical Elf', 'd', { veil: true })); const skull = put(s, 0, 1, mon('Summoned Skull', 'a'));
  put(s, 1, 0, mon('Mystical Elf', 'a')); s.active = 1; const lp = s.lp[1];
  const ev = applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.ok(ev.some(e => e.e === 'relic' && e.id === 'glass_idol'), 'Glass Idol fired');
  assert.ok(s.lp[1] <= lp - 300); assert.equal(skull.ba, 200, 'the strongest monster gets Chain Lightning');
});

test('Second Wind is announced when a relic, not a battle, would have ended the duel', () => {
  const s = blank({ seats: [{ secondWind: true }, { relics: ['cinder_fall'] }] });
  put(s, 1, 0, mon('Summoned Skull', 'd')); s.active = 1; s.lp[0] = 200;
  const ev = applyMut(s, { t: 'end' }, db);
  assert.equal(s.winner, null); assert.equal(s.lp[0], 1000);
  assert.ok(ev.some(e => e.e === 'relic' && e.id === 'second_wind' && e.seat === 0), 'the page is told Second Wind was used');
});

test('a refused Trap answer leaves the prompt standing, and a refused run action leaves the run untouched', () => {
  const s = blank(); give(s, 0, 'Trap Hole');
  applyMut(s, { t: 'play', hand: [0], onto: null }, db); applyMut(s, { t: 'end' }, db);
  s.hand[1] = []; put(s, 1, 0, mon('Summoned Skull')); put(s, 0, 0, mon('Mystical Elf'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  const before = canonical(s), wrong = [0, 1, 2, 3, 4].find(z => !s.pending.options.includes(z));
  assert.throws(() => applyMut(s, { t: 'respond', trap: wrong }, db), /cannot answer/);
  assert.equal(canonical(s), before, 'the attack still waits for an answer');
  applyMut(s, { t: 'respond', trap: s.pending.options[0] }, db); assert.equal(s.mon[1][0], null);
  const run = newRun(db, { seed: 5 });
  while (run.phase !== 'duel') runApply(run, policyAction(db, run, { level: 2 }), db);
  const snap = JSON.stringify(run);
  for (const bad of [null, 'end', { t: 'duel' }, { t: 'duel', action: 7 }, { t: 'door', i: 'length' }, { t: 'pick', i: -1 }, { t: 'pick', i: 1.5 }, { t: 'swap', deck: '0', trunk: 0 }]) {
    assert.throws(() => runApply(run, bad, db), e => e instanceof Error && !(e instanceof TypeError), 'a clean refusal for ' + JSON.stringify(bad));
    assert.equal(JSON.stringify(run), snap);
  }
});

test('a second newly unlocked Gift dealt by the re-deal keeps its NEW mark', () => {
  const pool = Object.keys(LAB).filter(id => LAB[id].kind === 'G');
  const lab = { ...db, config: { ...db.config, labPool: pool, giftXpScale: 2, giftRerolls: 1 }, _pair: new Map() };
  let checked = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const run = newRun(lab, { seed, featured: ['snare', 'cinder_fall'], track: true });
    while (run.phase !== 'over' && !(run.phase === 'reward' && run.offer.kind === 'gift')) runApply(run, policyAction(lab, run, { level: 2 }), lab);
    if (run.phase === 'over') continue;
    const first = run.offer.fresh; assert.ok(first && run.offer.options.includes(first));
    if (['snare', 'cinder_fall'].every(id => run.offer.options.includes(id))) continue; // both dealt at once: the second keeps its mark for a later offer
    runApply(run, { t: 'reroll' }, lab);
    assert.ok(run.offer.fresh && run.offer.fresh !== first && run.offer.options.includes(run.offer.fresh), 'the other new Gift is dealt and marked');
    assert.ok(!('freshShown' in run), 'nothing is left over to mark a later offer'); checked++;
  }
  assert.ok(checked >= 4, 'reached a Gift offer in ' + checked + ' runs');
});

test('the last Law names the turn its ace really arrives on', () => {
  const at = { floor: 2, bossOrder: [0, 0, BOSSES[2].findIndex(b => b.law === 'end')], heat: 0, charms: [] };
  assert.match(bossLaw(db, at), /fourth turn/);
  const six = { ...db, config: { ...db.config, endTurns: 6 }, _pair: new Map() };
  assert.match(bossLaw(six, at), /sixth turn/); assert.doesNotMatch(bossLaw(six, at), /fourth/);
  // and the engine agrees: the ace comes on the rival's sixth turn, not before
  const ace = C('Gate Guardian').id, s = newDuel(six, { seed: 3, decks: [filler(), filler()], first: 1, seats: [{}, { law: 'end', ace }] });
  let came = 0;
  for (let i = 0; i < 40 && !came && s.winner === null; i++) { const ev = applyMut(s, s.pending ? { t: 'respond', trap: -1 } : { t: 'end' }, six); if (s.mon[1].some(m => m && m.id === ace)) came = s.stats[1].turns; }
  assert.equal(came, 6);
});

console.log('crucible rules:', passed, 'tests passed');
