// Rule tests for Lost Memories (codename crucible). Run: node crucible/test/test-crucible-rules.mjs
// Card stats are read from the pool by name; nothing here types an ATK or DEF.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadDb, equipAdd, equipFits, terrainFavours, meldPair, meldTriple, weightOf, wheelEdge, roleOf, EFFECTS, codexKey, codexResult, codexKnows, codexUpgrade } from '../engine/cards.mjs';
import { rulesText, shortText, FX_TEXT, TRAP_TEXT } from '../web/text.mjs';
import { newDuel, apply, applyMut, legalActions, viewFor, planChain, effAtk, effDef, forecast, canonical, clone } from '../engine/duel.mjs';
import { chooseAction } from '../engine/ai.mjs';
import { Rng } from '../engine/rng.mjs';
import { RELICS, LAB, LINK_GIFTS, relicLinks, CHAIN_TURN, sortRelics, fire, relicText, TUNED_TEXT } from '../engine/relics.mjs';
import { LAST_ONE, BIG_BUILDS, newRun, runApply, MIN_DECK, makeRival, rankDuel, rankLetter, makeKit, KITS, deckWeight, weightCap, STYLES, THEMES, HEAT_RULES, BOSSES, KIT_TUNE, bossLaw, ENCHANTS, ENCHANT_TEXT, styleFor } from '../engine/run.mjs';
import { policyAction, playRun } from '../engine/policy.mjs';
import { labConfig, LAB_DEFAULTS, LAB_ORDER, DEPTH_SET, EQUIP_KINDS } from '../web/labs.mjs';
import { aimFor } from '../web/aim.mjs';
import { runFault, okRun, okProfile, PHASES } from '../web/saves.mjs';
import { lessonFor, enoughAlone, learnFrom, lessonText, learnedAll, newNote, noteFrames, whyLost, lawAnswer } from '../web/coach.mjs';
import { FORGERS, FORGER_IDS } from '../engine/forgers.mjs';
import { newProfile, applyRun, scoreRun, buy, lockedRelics, maxHeat, VAULT, FEATS, FEAT_GIFTS, FEATS_LONG, LONG_GIFTS, KIT_GOALS, START_ENCHANTS, VAULT_ENCHANTS, openKits, nextKit, openEnchants, runOptions, featList } from '../engine/meta.mjs';

const db = loadDb();
const C = n => { const c = db.byName.get(n); assert.ok(c, 'card in pool: ' + n); return c; };
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error('FAIL', name); if (process.env.KEEP_GOING) { console.error('   ', e.message.split('\n')[0]); return; } throw e; } }; // KEEP_GOING=1 lists every failing test
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

test('long road: kits open by duels won, Heat stays shared with a record per Forger, Enchants are bought, three more feats; off, nothing changes', () => {
  const p = newProfile();
  // off: the same options as before, and a run made with every kit and Enchant open is the ordinary run
  assert.deepEqual(Object.keys(runOptions(p, 'tarn', false)).sort(), ['featured', 'locked', 'track']);
  const plain = newRun(db, { seed: 31, forger: 'tarn' }), full = newRun(db, { seed: 31, forger: 'tarn', kits: FORGERS.tarn.kits.map(k => k.id), enchants: ENCHANTS });
  assert.deepEqual(full.offer, plain.offer); assert.deepEqual(full.rng, plain.rng);
  // on: one kit to start, dealt three ways
  assert.deepEqual(openKits(p, 'tarn'), ['dragons_warriors']); assert.equal(nextKit(p, 'tarn').goal, KIT_GOALS[1]);
  const o = runOptions(p, 'tarn', true), first = newRun(db, { seed: 31, forger: 'tarn', ...o });
  assert.deepEqual(first.offer.map(k => k.kit), ['dragons_warriors', 'dragons_warriors', 'dragons_warriors']);
  assert.notDeepEqual(first.offer[0].deck, first.offer[1].deck, 'three different decks of the one kit');
  for (const g of LONG_GIFTS) assert.ok(o.locked.includes(g) && !lockedRelics(p).includes(g), g + ' is locked only on the long road');
  assert.deepEqual(o.enchants, START_ENCHANTS); assert.equal(START_ENCHANTS.length + VAULT_ENCHANTS.length, ENCHANTS.length);
  // an Anvil offers only open Enchants, and uses the dice exactly as an ordinary Anvil does
  let seen = 0;
  for (let seed = 1; seed < 40 && seen < 3; seed++) {
    const a = newRun(db, { seed, forger: 'tarn' }), b = newRun(db, { seed, forger: 'tarn', enchants: START_ENCHANTS });
    for (let n = 0; n < 4000 && a.phase !== 'over' && a.phase !== 'anvil'; n++) { const act = policyAction(db, a, { level: 2 }); runApply(a, act, db); runApply(b, clone(act), db); }
    if (a.phase !== 'anvil') continue; seen++;
    assert.deepEqual(b.rng, a.rng); assert.ok(b.offer.enchants.length >= 1 && b.offer.enchants.every(e => START_ENCHANTS.includes(e)));
    { const keep = a.offer.enchants.filter(e => START_ENCHANTS.includes(e)); assert.deepEqual(b.offer.enchants.slice(0, keep.length), keep); }
    const shut = a.offer.enchants.find(e => !START_ENCHANTS.includes(e)), di = b.deck.findIndex(e => db.isMonster(e.id) && !e.e);
    if (shut) assert.throws(() => runApply(b, { t: 'anvil', kind: 'enchant', deck: di, enchant: shut }, db), /not offered/);
  }
  assert.ok(seen >= 1, 'reached an Anvil');
  // banking: duel wins open kits; a clear opens the next Heat for everyone and sets that Forger's own record
  const run = playRun(db, newRun(db, { seed: 5, ...o, forger: 'tarn' }), { level: 2 }), got = applyRun(p, run, { long: true });
  assert.equal(p.byForger.tarn.runs, 1); assert.equal(p.byForger.tarn.wins, run.stats.wins);
  assert.equal(got.unlocks.filter(u => u.kind === 'kit').length, openKits(p, 'tarn').length - 1);
  assert.equal(got.feats.length, featList(true).length);
  p.byForger.tarn.wins = KIT_GOALS[2]; assert.equal(openKits(p, 'tarn').length, 3); assert.equal(nextKit(p, 'tarn'), null);
  let won = null; for (let seed = 1; seed < 60 && !won; seed++) { const r = playRun(db, newRun(db, { seed, forger: 'tarn' }), { level: 2 }); if (r.result.won) won = r; }
  const q = newProfile(), w = applyRun(q, won, { long: true });
  assert.equal(maxHeat(q), 1); assert.equal(q.byForger.tarn.heat, 0); assert.equal(q.byForger.storm, undefined);
  assert.equal(w.unlocks.filter(u => u.kind === 'heat' && !u.forger).length, 1); assert.equal(w.unlocks.filter(u => u.kind === 'record' && u.forger === 'tarn' && u.id === 0).length, 1);
  { const q2 = newProfile(), w2 = applyRun(q2, won); assert.ok(!w2.unlocks.some(u => u.kind === 'record'), 'records are announced only on the long road'); assert.equal(q2.byForger.tarn.heat, 0); }
  // Enchants in the Vault
  assert.throws(() => buy(newProfile(), 'ench:herald'), /not enough/);
  q.memories = 60; const b = buy(q, 'ench:herald'); assert.equal(b.name, 'Herald'); assert.equal(q.memories, 10); assert.ok(openEnchants(q).includes('herald')); assert.throws(() => buy(q, 'ench:herald'), /already/);
  for (const f of FEATS_LONG) { assert.ok(LAB[f.gift] || RELICS[f.gift], f.gift + ' exists'); assert.ok(f.text.includes(String(f.goal))); }
});

// Reported 20 Nov 2026 (crucible/reports/regression-log.md): the Codex wrote XYZ-Dragon Cannon as its first two materials, which
// read back as XY-Dragon Cannon; and Super Roboyarou could not be made at all because it shares its materials.
test('Codex: a three-card fusion is written with all three cards; two fusions that share materials can both be made', () => {
  const [x, y, z] = ['X-Head Cannon', 'Y-Dragon Head', 'Z-Metal Tank'].map(n => C(n).id), xyz = C('XYZ-Dragon Cannon').id;
  for (const order of [[x, y, z], [z, y, x], [y, z, x], [z, x, y]]) {
    const plan = planChain(db, order.map((id, u) => ({ u, id })), null, {});
    assert.equal(plan.final.id, xyz); assert.equal(plan.pairs.length, 1); assert.deepEqual(plan.tried, [order]);
    const key = codexKey(db, plan.pairs[0][0], plan.pairs[0][1], plan.pairs[0][4]);
    assert.equal(key.split('+').length, 3, 'all three materials are written');
    assert.deepEqual(codexResult(db, key), { kind: 'printed', id: xyz, mats: [x, y, z].sort((a, b) => a - b) });
  }
  assert.equal(codexResult(db, codexKey(db, x, y)).id, C('XY-Dragon Cannon').id, 'the two-card fusion keeps its own page');
  // through a real run: meld the three in a duel, finish the duel, save and reopen
  const run = newRun(db, { seed: 12 }); runApply(run, { t: 'kit', i: 0 }, db);
  for (let n = 0; n < 500 && !(run.phase === 'duel' && run.duel.active === 0 && !run.duel.pending && !run.duel.played); n++) runApply(run, policyAction(db, run, { level: 2 }), db);
  assert.equal(run.phase, 'duel'); run.duel.hand[0] = [x, y, z].map((id, i) => ({ u: 9000 + i, id }));
  runApply(run, { t: 'duel', action: { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' } }, db);
  assert.ok(run.duel.mon[0].some(m => m && m.id === xyz), 'XYZ-Dragon Cannon is on the table');
  for (let n = 0; n < 5000 && run.phase === 'duel'; n++) runApply(run, policyAction(db, run, { level: 2 }), db);
  const back = JSON.parse(JSON.stringify(run)), key3 = [x, y, z].sort((a, b) => a - b).join('+');
  assert.ok(back.codex.includes(key3), 'the Codex holds the three-card recipe after the duel and after a save');
  assert.ok(!back.codex.includes(codexKey(db, x, y)), 'and not the two-card recipe that was never made');
  assert.equal(codexResult(db, back.codex.find(k => k === key3)).id, xyz);
  // Super Robolady and Super Roboyarou name the same two materials: the one the meld starts with decides
  const lady = C('Robolady').id, yarou = C('Roboyarou').id, sLady = C('Super Robolady').id, sYarou = C('Super Roboyarou').id;
  assert.equal(meldPair(db, lady, yarou).id, sLady); assert.equal(meldPair(db, yarou, lady).id, sYarou);
  assert.equal(db.byId.get(sLady).materials[0], lady); assert.equal(db.byId.get(sYarou).materials[0], yarou);
  const kl = codexKey(db, lady, yarou), ky = codexKey(db, yarou, lady);
  assert.notEqual(kl, ky); assert.equal(codexResult(db, kl).id, sLady); assert.equal(codexResult(db, ky).id, sYarou);
  assert.equal(planChain(db, [{ u: 1, id: yarou }, { u: 2, id: lady }], null, {}).final.id, sYarou);
  // every other pair is still written smaller id first, whichever way it was played, and makes the same thing both ways
  const a = C('Flame Manipulator').id, b = C('Masaki the Legendary Swordsman').id;
  assert.equal(codexKey(db, a, b), codexKey(db, b, a)); assert.equal(meldPair(db, a, b).id, meldPair(db, b, a).id); assert.equal(db.ordered.size, 2);
  // every printed fusion that has materials can be made from them, and its Codex key reads back as itself
  for (const c of db.pool.cards) if (c.kind === 'fusion' && c.materials) {
    const r = c.materials.length === 3 ? meldTriple(db, ...c.materials) : meldPair(db, c.materials[0], c.materials[1]);
    assert.equal(r && r.id, c.id, c.name + ' is made by its printed materials');
    assert.equal(codexResult(db, codexKey(db, ...c.materials)).id, c.id, c.name + ' reads back from the Codex');
  }
  // Bind follows the same order rule
  const br = newRun(db, { seed: 3 }); runApply(br, { t: 'kit', i: 0 }, db); while (br.phase !== 'chamber') runApply(br, policyAction(db, br, { level: 2 }), db);
  br.phase = 'anvil'; br.offer = { kind: 'anvil', masterworks: [], enchants: [] }; br.embers = 999; br.deck[0] = { id: yarou }; br.deck[1] = { id: lady }; br.codex.push(ky);
  assert.throws(() => runApply(br, { t: 'anvil', kind: 'bind', a: 1, b: 0 }, db), /not in your Codex/, 'the other order is a different meld');
  runApply(br, { t: 'anvil', kind: 'bind', a: 0, b: 1 }, db); assert.ok(br.deck.some(e => e.id === sYarou && e.b));
});

// Reported 20 Nov 2026 (crucible/reports/regression-log.md): after the Robo fix, a Codex saved by the build before it
// read its Robo entry as Super Roboyarou, though that build had made Super Robolady.
test('Codex: a save from the build before the fusion fix still means what it meant', () => {
  const old = JSON.parse(readFileSync(new URL('../fixtures/old-save-v21.json', import.meta.url), 'utf8'));
  const lady = C('Robolady').id, yarou = C('Roboyarou').id, sLady = C('Super Robolady').id, sYarou = C('Super Roboyarou').id;
  const oldRobo = '38916461+92421852', oldXyz = '64500000+65622692';
  assert.ok(old.known.includes(oldRobo) && old.profile.codex.includes(oldRobo) && old.run.codex.includes(oldRobo), 'the old save holds the Robo pair, smaller id first');
  assert.ok(old.known.includes(oldXyz), 'and its three-card fusion as two cards');
  // read as written: the old entry is Super Robolady, the only thing that build could make from the pair
  const r = codexResult(db, oldRobo); assert.equal(r.id, sLady); assert.deepEqual(r.mats, [lady, yarou]); assert.ok(r.old);
  assert.equal(codexResult(db, lady + '+' + yarou).id, sLady, 'either way round, an entry without an order is the old result');
  // new entries carry their order and are a different format, so the two can never be confused
  assert.equal(codexKey(db, lady, yarou), lady + '>' + yarou); assert.equal(codexKey(db, yarou, lady), yarou + '>' + lady);
  assert.equal(codexResult(db, lady + '>' + yarou).id, sLady); assert.equal(codexResult(db, yarou + '>' + lady).id, sYarou);
  assert.equal(codexKey(db, C('Flame Manipulator').id, C('Masaki the Legendary Swordsman').id).includes('>'), false, 'every other pair keeps the old format');
  // the old entry counts as knowing Super Robolady and not Super Roboyarou
  const has = k => old.known.includes(k);
  assert.ok(codexKnows(db, has, lady, yarou)); assert.ok(!codexKnows(db, has, yarou, lady));
  // every key of the old save still reads, and all but the Robo one read as before
  for (const k of old.known) assert.ok(codexResult(db, k), 'old key still reads: ' + k);
  // upgrade on load: nothing dropped, the Robo entry becomes the ordered Super Robolady entry, the rest is untouched, and doing it twice changes nothing
  const up = codexUpgrade(db, old.known);
  assert.equal(up.length, old.known.length); assert.ok(up.includes(lady + '>' + yarou) && !up.includes(oldRobo));
  assert.deepEqual(up.filter(k => !k.includes('>')), old.known.filter(k => k !== oldRobo)); assert.deepEqual(codexUpgrade(db, up), up);
  assert.deepEqual(new Set(up.map(k => codexResult(db, k).id)), new Set(old.known.map(k => k === oldRobo ? sLady : codexResult(db, k).id)));
  // the old three-card entry cannot be told from a real two-card discovery: it stays, and XYZ is simply not found yet
  assert.equal(codexResult(db, oldXyz).id, C('YZ-Tank Dragon').id); assert.ok(!up.some(k => codexResult(db, k).id === C('XYZ-Dragon Cannon').id));
  // the old run carries on in today's engine, and making Super Robolady again is not paid as a new discovery
  const run = JSON.parse(JSON.stringify(old.run)); run.codex = codexUpgrade(db, run.codex);
  for (let n = 0; n < 3000 && !(run.phase === 'duel' && run.duel.active === 0 && !run.duel.pending && !run.duel.played && run.duel.mon[0].filter(Boolean).length < 4); n++) runApply(run, policyAction(db, run, { level: 2 }), db);
  assert.equal(run.phase, 'duel', 'the old run plays on');
  const raw = JSON.parse(JSON.stringify(old.run)); // the same thing without the upgrade step: the engine itself must cope
  for (const [R, first, second, want, fresh] of [[run, lady, yarou, sLady, false], [run, yarou, lady, sYarou, true]]) {
    for (let n = 0; n < 3000 && !(R.phase === 'duel' && R.duel.active === 0 && !R.duel.pending && !R.duel.played && R.duel.mon[0].filter(Boolean).length < 4); n++) runApply(R, policyAction(db, R, { level: 2 }), db);
    const before = R.codex.length; R.duel.hand[0] = [{ u: 9100 + R.duel.turn, id: first }, { u: 9200 + R.duel.turn, id: second }];
    runApply(R, { t: 'duel', action: { t: 'play', hand: [0, 1], onto: null, pos: 'a' } }, db);
    assert.ok(R.duel.mon[0].some(m => m && m.id === want));
    for (let n = 0; n < 5000 && R.phase === 'duel'; n++) runApply(R, policyAction(db, R, { level: 2 }), db);
    assert.equal(R.codex.includes(first + '>' + second), true); if (!fresh) assert.equal(R.codex.filter(k => codexResult(db, k).id === sLady).length, 1, 'no second entry for a result already known');
    if (R.phase === 'over') break;
  }
  { const before = raw.codex.slice(); for (let n = 0; n < 3000 && !(raw.phase === 'duel' && raw.duel.active === 0 && !raw.duel.pending && !raw.duel.played && raw.duel.mon[0].filter(Boolean).length < 4); n++) runApply(raw, policyAction(db, raw, { level: 2 }), db);
    raw.duel.hand[0] = [{ u: 9300, id: lady }, { u: 9301, id: yarou }]; runApply(raw, { t: 'duel', action: { t: 'play', hand: [0, 1], onto: null, pos: 'a' } }, db);
    for (let n = 0; n < 5000 && raw.phase === 'duel'; n++) runApply(raw, policyAction(db, raw, { level: 2 }), db);
    assert.ok(before.includes(oldRobo) && !raw.codex.includes(lady + '>' + yarou), 'an old entry left as it was still counts as knowing Super Robolady'); }
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
        if (held.size) { checked++; assert.ok(run.offer.options.some(id => held.has(fam(id)) || held.has((LAB[id] || {}).link)), 'seed ' + seed + ': no option leans toward ' + [...held]); }
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

// What the player reads must cover every Enchant, every effect and every card, and a Trap's words must match what it does.
test('every Enchant, effect and card has wording, and Trap wording matches the rule', () => {
  for (const e of ENCHANTS) assert.ok(ENCHANT_TEXT[e] && ENCHANT_TEXT[e].length > 10, 'Enchant wording: ' + e);
  assert.equal(Object.keys(ENCHANT_TEXT).length, ENCHANTS.length);
  for (const fx of EFFECTS) { assert.equal(typeof FX_TEXT[fx], 'function', fx); assert.equal(typeof TRAP_TEXT[fx], 'function', fx); }
  for (const c of db.pool.cards) assert.ok(rulesText(db, c.id).length > 10, c.name);
  // Mirror Force leaves a rival monster in defense alone, and its wording says so
  assert.match(rulesText(db, C('Mirror Force').id), /in attack position/);
  const s = blank({ seats: [{}, {}] });
  s.mon[0][0] = { u: 901, id: C('La Jinn the Mystical Genie of the Lamp').id, pos: 'a', veil: false, att: 0, moved: false };
  s.mon[0][1] = { u: 902, id: C('Mystical Elf').id, pos: 'd', veil: false, att: 0, moved: false };
  s.traps[1][0] = { u: 903, id: C('Mirror Force').id };
  applyMut(s, { t: 'attack', from: 0, to: -1 }, db);
  assert.ok(s.pending, 'the Trap can answer');
  applyMut(s, { t: 'respond', trap: 0 }, db);
  assert.equal(s.mon[0][0], null); assert.ok(s.mon[0][1], 'the defender stays');
});

// Tuned items (lever itemTune): Storm pieces ask for four cards and give less, Grave Ward works once a duel, and the words say so.
test('tuned items: Storm pieces need a four-card meld, Grave Ward once a duel, wording follows the rule', () => {
  const tuned = { ...db, config: { ...db.config, itemTune: 1 }, _pair: new Map() };
  const fuel = db.pool.cards.filter(c => roleOf(db, c.id) === 'fuel').slice(0, 3);
  const meld = (d, n) => { const t = withRelics(['copper_loop', 'patient_coil']); give(t, 0, 'Mystical Elf'); for (let i = 0; i < n - 1; i++) t.hand[0].push({ u: uid++, id: fuel[i].id }); applyMut(t, { t: 'play', hand: Array.from({ length: n }, (_, i) => i), onto: null, pos: 'a' }, d); return t.mon[0].find(Boolean); };
  const F = db.config.fuelBonus;
  let r = meld(db, 3); assert.equal(r.ba, 2 * F + 300); assert.equal(r.bd, 2 * F + 300);         // as written: Loop on three cards
  r = meld(tuned, 3); assert.equal(r.ba, 2 * F); assert.equal(r.bd, 2 * F);                       // tuned: three cards earn nothing
  r = meld(tuned, 4); assert.equal(r.ba, 3 * F + 200 + 200); assert.equal(r.bd, 3 * F + 200);     // four cards: Loop +200 ATK, Coil +200 / +200
  r = meld(db, 4); assert.equal(r.ba, 3 * F + 300 + 300); assert.equal(r.bd, 3 * F + 300 + 300);
  // Grave Ward: twice a duel as written, once when tuned
  const ward = d => { const t = withRelics(['grave_ward']); t.gy[0] = Array.from({ length: 9 }, () => C('Mystical Elf').id); let n = 0; for (const turn of [3, 5, 7]) { t.turn = turn; const c = {}; fire(t, d, [], 0, 'fell', c); if (c.kill) n++; } return n; };
  assert.equal(ward(db), 2); assert.equal(ward(tuned), 1);
  for (const id of Object.keys(TUNED_TEXT)) { assert.ok(RELICS[id] || LAB[id], id); assert.equal(relicText(tuned, id), TUNED_TEXT[id]); assert.equal(relicText(db, id), (RELICS[id] || LAB[id]).text); }
  assert.match(relicText(tuned, 'copper_loop'), /four or more/); assert.match(relicText(tuned, 'grave_ward'), /^Once a duel/);
  // the two rivals that carry a Storm piece say four, and reach for four
  assert.match(styleFor(tuned, 'engine').text, /four or more/); assert.equal(styleFor(tuned, 'engine').policy.maxChain, 4); assert.match(styleFor(db, 'engine').text, /three or more/);
  assert.equal(styleFor(tuned, 'drake'), STYLES.drake);
});

// Linked relics (lever links, 20 November 2026): each listens to one build and pays into another.
// A third card that takes Flame Swordsman one step further, so three cards make one clean meld.
const THIRD = (() => { const fm = C('Flame Manipulator').id, ma = C('Masaki the Legendary Swordsman').id; for (const c of db.byId.values()) { if (c.kind !== 'monster' || c.id === fm || c.id === ma) continue; const p = planChain(db, [{ id: fm }, { id: ma }, { id: c.id }], null); if (p.melded && p.len === 3 && !p.fizzles && p.isMonster && p.gy.filter(id => db.isMonster(id)).length >= 2) return c.name; } throw new Error('no three-card chain from Flame Swordsman'); })();
const linked = (ids, cfg) => { const d = cfg ? { ...db, config: { ...db.config, ...cfg }, _pair: new Map() } : db; const s = blank({ seats: [{ relics: sortRelics(ids) }, {}] }); s.hand = [[], []]; s.turn = 3; s.active = 0; return [s, d]; };
const fired = (ev, id) => ev.filter(e => e.e === 'relic' && e.id === id).length;

test('linked relics: Blood Price turns a relic heal into rival damage, and Chain Lightning answers it', () => {
  const [s] = linked(['tomb_ledger', 'grave_call', 'last_rites', 'blood_price', 'chain_lightning']);
  s.gy[0].push(C('Mystical Elf').id); give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
  const me = s.lp[0], them = s.lp[1];
  const ev = applyMut(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, db);
  for (const id of ['tomb_ledger', 'grave_call', 'last_rites', 'blood_price', 'chain_lightning']) assert.ok(fired(ev, id) >= 1, id + ' took part in the chain');
  assert.equal(s.lp[0], me + 300, 'Last Rites healed'); assert.equal(s.lp[1], them - 300, 'Blood Price took as much from the rival');
  assert.equal(s.mon[0].find(Boolean).ba, 200, 'Chain Lightning gave the new meld +200');
  assert.equal(s.hand[0].length, 1, 'Grave Call returned a monster');
  // without a heal relic it does nothing
  const [t] = linked(['blood_price']); give(t, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman'); const lp = t.lp[1];
  assert.equal(fired(applyMut(t, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, db), 'blood_price'), 0); assert.equal(t.lp[1], lp);
});

test('linked relics: Pyre Mark makes a battle win a Tomb mark, and Bone Bellows feeds the mark back to the melded monster', () => {
  const [s] = linked(['pyre_mark', 'bone_bellows', 'bone_tithe']);
  const sw = put(s, 0, 0, mon('Flame Swordsman', 'a', { meld: 1 })), sw2 = put(s, 0, 1, mon('Flame Swordsman', 'a', { meld: 1 }));
  put(s, 1, 0, mon('Mystical Elf', 'a')); put(s, 1, 1, mon('Mystical Elf', 'a')); const lp = s.lp[1];
  let ev = applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.seat[0].rs.marks, 1, 'a mark without burying anything'); assert.equal(fired(ev, 'pyre_mark'), 1); assert.equal(fired(ev, 'bone_bellows'), 1);
  assert.equal((sw.ba || 0) + (sw2.ba || 0), 200, 'Bone Bellows: +200 on a melded monster');
  assert.ok(s.seat[0].rs.nextMeld.some(x => x.id === 'pyre_mark'), 'the next meld is armed');
  assert.ok(ev.some(e => e.e === 'relic' && e.id === 'bone_tithe'), 'Bone Tithe answers the mark');
  ev = applyMut(s, { t: 'attack', from: 1, to: 1 }, db);
  assert.equal(fired(ev, 'pyre_mark'), 0, 'once a turn'); assert.equal(s.seat[0].rs.marks, 1);
  // a monster that was not melded earns no mark
  const [t] = linked(['pyre_mark']); put(t, 0, 0, mon('Summoned Skull', 'a')); put(t, 1, 0, mon('Mystical Elf', 'a'));
  assert.equal(fired(applyMut(t, { t: 'attack', from: 0, to: 0 }, db), 'pyre_mark'), 0);
});

test('linked relics: Charged Bones makes the next meld one card longer for Storm pieces, once per return', () => {
  const tuned = { itemTune: 1 };
  const go = ids => { const [s, d] = linked(ids, tuned); s.gy[0].push(C('Mystical Elf').id); give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
    applyMut(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, d); s.played = false; s.turn += 2; s.hand[0] = []; give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD);
    const lp = s.lp[1], ev = applyMut(s, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' }, d); return { s, ev, lost: lp - s.lp[1] }; };
  const a = go(['tomb_ledger', 'grave_call', 'charged_bones', 'storm_needle']);
  assert.equal(fired(a.ev, 'storm_needle'), 1, 'a three-card meld counted as four'); assert.equal(a.lost, 300);
  assert.ok(a.ev.some(e => e.e === 'relic' && e.id === 'charged_bones' && e.longer === 4), 'the page is told the meld counted as four');
  const b = go(['tomb_ledger', 'grave_call', 'storm_needle']);
  assert.equal(fired(b.ev, 'storm_needle'), 0, 'without Charged Bones three cards are three cards'); assert.equal(b.lost, 0);
});

test('linked relics: Thunderclap shows a veiled monster to the relics without turning it over', () => {
  const [s] = linked(['thunderclap', 'tomb_bell', 'deep_shade', 'blood_price']);
  const v = put(s, 0, 4, mon('Mystical Elf', 'd', { veil: true })); give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD);
  const me = s.lp[0], them = s.lp[1];
  const ev = applyMut(s, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' }, db);
  assert.equal(v.veil, true, 'it stays veiled'); assert.equal(fired(ev, 'thunderclap'), 1);
  assert.equal(s.lp[0], me + 300, 'Tomb Bell rang'); assert.equal(s.lp[1], them - 200 - 300, 'Thunderclap 200, then Blood Price 300');
  assert.ok(s.seat[0].rs.nextMeld.some(x => x.id === 'deep_shade'), 'Deep Shade arms the next meld');
  const [t] = linked(['thunderclap']); give(t, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD); const lp = t.lp[1];
  assert.equal(fired(applyMut(t, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' }, db), 'thunderclap'), 0, 'no veiled monster, no Thunderclap'); assert.equal(t.lp[1], lp);
});

test('linked relics: Spoils pays when a relic, not a battle, destroys a rival monster', () => {
  const [s] = linked(['snare', 'spoils']);
  put(s, 0, 0, mon('Mystical Elf', 'd', { veil: true })); put(s, 1, 0, mon('Summoned Skull', 'a')); s.active = 1; const lp = s.lp[1];
  const ev = applyMut(s, { t: 'attack', from: 0, to: 0 }, db);
  assert.equal(s.mon[1][0], null, 'Snare took the attacker'); assert.equal(fired(ev, 'spoils'), 1); assert.equal(s.lp[1], lp - 400); assert.equal(s.seat[0].extraDraw, 1);
  // a plain battle kill is not a relic kill
  const [t] = linked(['spoils']); put(t, 0, 0, mon('Summoned Skull', 'a')); put(t, 1, 0, mon('Mystical Elf', 'a')); const lp2 = t.lp[1];
  assert.equal(fired(applyMut(t, { t: 'attack', from: 0, to: 0 }, db), 'spoils'), 0);
});

test('linked relics: Outrider rewards a monster played on its own with a longer, stronger next meld', () => {
  const [s] = linked(['outrider', 'grounding_rod']);
  give(s, 0, 'Mystical Elf'); put(s, 1, 0, mon('Summoned Skull', 'a'));
  let ev = applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'd', veiled: true }, db);
  assert.equal(fired(ev, 'outrider'), 1); assert.equal(s.seat[0].rs.lenPlus, 'outrider');
  s.played = false; s.turn += 2; give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD);
  ev = applyMut(s, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' }, db);
  assert.equal(s.mon[1][0], null, 'Grounding Rod fired on a three-card meld that counted as four');
  const m = s.mon[0].find(x => x && x.meld); assert.equal(m.ba, 200, 'and the meld got +200'); assert.equal(s.seat[0].rs.lenPlus, 0, 'the extra card is spent');
  // a meld does not arm it
  const [t] = linked(['outrider']); give(t, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
  assert.equal(fired(applyMut(t, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, db), 'outrider'), 0);
});

test('linked relics: off by default; a link that needs a partner is never offered without one', () => {
  assert.ok(LINK_GIFTS.length >= 7 && LINK_GIFTS.every(id => LAB[id].link && !RELICS[id]));
  assert.ok(!labConfig(LAB_DEFAULTS).labPool.some(id => LINK_GIFTS.includes(id)), 'not in the pool with the default switches');
  assert.ok(LINK_GIFTS.every(id => labConfig({ ...LAB_DEFAULTS, links: true }).labPool.includes(id)));
  const lab = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, links: true }) }, _pair: new Map() };
  let seen = 0, withNeeds = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const run = newRun(lab, { seed });
    while (run.phase !== 'over') {
      if (run.phase === 'reward' && run.offer.kind === 'gift') for (const id of run.offer.options) if (LAB[id] && LAB[id].link) { seen++; if (LAB[id].needs) { withNeeds++; assert.ok(LAB[id].needs.some(x => [...run.charms, ...run.gifts, ...run.masterworks].includes(x)), 'seed ' + seed + ': ' + id + ' offered with no partner held'); } }
      runApply(run, policyAction(lab, run, { level: 2, family: seed % 2 ? 'pick_tomb' : 'pick_shadow' }), lab);
    }
  }
  assert.ok(seen >= 10 && withNeeds >= 2, 'links were offered (' + seen + ', ' + withNeeds + ' with a partner)');
});

test('the Sets off line: every relic it names exists, and it agrees both ways', () => {
  const all = { ...RELICS, ...LAB };
  for (const id of Object.keys(all)) { const L = relicLinks(id); for (const x of [...L.sets, ...L.by]) assert.ok(all[x], id + ' names ' + x); for (const x of L.sets) assert.ok(relicLinks(x).by.includes(id), id + ' sets off ' + x + ', so ' + x + ' is set off by ' + id); }
  assert.ok(relicLinks('blood_price').sets.includes('chain_lightning') && relicLinks('blood_price').by.includes('last_rites'));
  assert.ok(relicLinks('outrider').sets.includes('grounding_rod') && relicLinks('pyre_mark').sets.includes('bone_bellows'));
  assert.deepEqual(relicLinks('whetstone'), { sets: [], by: [] });
});

test('Support turn (lever freeCast lone): a support card alone is free, and that turn takes one card on its own, not a meld', () => {
  assert.equal(labConfig(LAB_DEFAULTS).freeCast, 0); assert.equal(labConfig({ ...LAB_DEFAULTS, lone: true }).freeCast, 'lone'); assert.equal(labConfig({ ...LAB_DEFAULTS, lone: true }).freeCastRival, 'boss');
  const lab = { ...db, config: { ...db.config, freeCast: 'lone' }, _pair: new Map() };
  const spell = [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === 'heal')[0], trap = [...db.tagOf.keys()].find(id => db.byId.get(id).kind === 'trap');
  let s = blank(); s.hand[0].push({ u: uid++, id: spell }); give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
  const ev = applyMut(s, { t: 'play', hand: [0], onto: null }, lab);
  assert.equal(s.played, false, 'the Spell was free'); assert.ok(ev.some(e => e.e === 'free' && e.lone));
  assert.throws(() => applyMut(clone(s), { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, lab), /not legal/, 'no meld after the free card');
  assert.ok(!legalActions(s, lab, { maxChain: 4 }).some(a => a.t === 'play' && a.hand.length > 1), 'and no meld is offered');
  applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'a' }, lab); assert.equal(s.played, true, 'one monster on its own is the play'); assert.equal(s.mon[0].filter(Boolean).length, 1);
  // next turn melds are back
  s.played = false; s.attacked = false; s.turn += 2; s.hand[0] = []; give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman');
  applyMut(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, lab); assert.ok(s.mon[0].some(m => m && m.id === C('Flame Swordsman').id));
  // a meld first uses the play, so a Spell after it is not on offer; a Trap alone is free like a Spell; only one free card a turn
  s = blank(); s.hand[0].push({ u: uid++, id: trap }, { u: uid++, id: spell }); give(s, 0, 'Mystical Elf');
  applyMut(s, { t: 'play', hand: [0], onto: null }, lab); assert.equal(s.played, false, 'the Trap set was free');
  applyMut(s, { t: 'play', hand: [0], onto: null }, lab); assert.equal(s.played, true, 'the second support card uses the play');
  // the same hand under the base rules: the Spell uses the play
  s = blank(); s.hand[0].push({ u: uid++, id: spell }); applyMut(s, { t: 'play', hand: [0], onto: null }, db); assert.equal(s.played, true);
});

// Faults from the independent test report of 20 November 2026 (late evening). Each test fails on the code as it was.
test('a meld sends only the cards played to the graveyard, never the monster made half-way', () => {
  const g = C('The 13th Grave').id;
  const p = planChain(db, [{ id: g }, { id: g }, { id: g }], null);
  assert.equal(p.len, 3); assert.equal(p.fizzles, 0); assert.deepEqual(p.gy, [g, g, g], 'three cards played, three in the graveyard');
  const s = blank(); give(s, 0, 'The 13th Grave', 'The 13th Grave', 'The 13th Grave');
  applyMut(s, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' }, db);
  assert.deepEqual(s.gy[0], [g, g, g]); assert.equal(s.mon[0].filter(Boolean).length, 1);
  // four cards: four in the graveyard, whatever the steps were
  for (const names of [['Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD, 'Mystical Elf'], ['Mystical Elf', 'Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD]]) {
    const q = planChain(db, names.map(n => ({ id: C(n).id })), null), played = names.map(n => C(n).id);
    for (const id of q.gy) assert.ok(played.includes(id), names.join(' + ') + ': ' + db.byId.get(id).name + ' was never played, yet it is in the graveyard');
    assert.ok(q.gy.length <= played.length - (q.isMonster ? 1 : 0) + 1);
  }
  // a monster already on the table is a real card: melding onto it does send it to the graveyard
  const t = blank(); put(t, 0, 0, mon('Flame Manipulator', 'a')); give(t, 0, 'Masaki the Legendary Swordsman');
  applyMut(t, { t: 'play', hand: [0], onto: 0, pos: 'a' }, db);
  assert.deepEqual(t.gy[0].slice().sort(), [C('Flame Manipulator').id, C('Masaki the Legendary Swordsman').id].sort());
  // Steady Hand returns a card, so it does not turn a half-way monster into one
  const fz = [...db.byId.values()].find(c => c.kind === 'monster' && (() => { const q = planChain(db, [{ id: C('Flame Manipulator').id }, { id: C('Masaki the Legendary Swordsman').id }, { id: c.id }], null, { steady: true }); return q.steps[1] && q.steps[1].kind === 'steady'; })());
  assert.equal(fz, undefined, 'no chain hands a half-way monster back as a card');
});

test('Static Field hits the rival monster the table shows as strongest', () => {
  // terrain lifts a weaker monster above a stronger one; the table shows the lifted number
  const field = [...db.byId.values()].find(c => roleOf(db, c.id) === 'field'); assert.ok(field);
  const fav = [...db.byId.values()].filter(c => c.kind === 'monster' && terrainFavours(db, field.id, c.id)), not = [...db.byId.values()].filter(c => c.kind === 'monster' && !terrainFavours(db, field.id, c.id));
  const lo = fav.find(c => not.some(n => n.atk > c.atk && n.atk < c.atk + db.config.terrainBonus)), hi = not.find(n => n.atk > lo.atk && n.atk < lo.atk + db.config.terrainBonus);
  const [s] = linked(['static_field']); s.terrain = { id: field.id, owner: 1 };
  const a = put(s, 1, 0, mon(hi.name, 'a')), b = put(s, 1, 1, mon(lo.name, 'a'));
  assert.ok(effAtk(s, db, 1, b) > effAtk(s, db, 1, a), 'the favoured monster shows more ATK');
  give(s, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman', THIRD);
  applyMut(s, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' }, db);
  assert.equal(b.ba, -300, 'Static Field hit the monster showing the most ATK'); assert.equal(a.ba || 0, 0);
});

test('Chain Lightning pays the new meld that caused the damage, or else the monster showing the most ATK', () => {
  const field = [...db.byId.values()].find(c => roleOf(db, c.id) === 'field');
  const fav = [...db.byId.values()].filter(c => c.kind === 'monster' && terrainFavours(db, field.id, c.id)), not = [...db.byId.values()].filter(c => c.kind === 'monster' && !terrainFavours(db, field.id, c.id));
  const lo = fav.find(c => not.some(n => n.atk > c.atk && n.atk < c.atk + db.config.terrainBonus)), hi = not.find(n => n.atk > lo.atk && n.atk < lo.atk + db.config.terrainBonus);
  const [t] = linked(['tomb_ledger', 'bone_tithe', 'chain_lightning']); const old = put(t, 0, 4, mon('Summoned Skull', 'a'));
  give(t, 0, 'Flame Manipulator', 'Masaki the Legendary Swordsman'); const lp = t.lp[1];
  applyMut(t, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }, db);
  const meld = t.mon[0].find(m => m && m.meld);
  assert.equal(t.lp[1], lp - 300, 'Bone Tithe fired'); assert.equal(meld.ba, 200, 'the new meld gets Chain Lightning'); assert.equal(old.ba || 0, 0, 'not the older monster');
  assert.equal(t.seat[0].rs.newMeld, undefined, 'nothing is left behind in the saved state');
  // with no new meld (end of turn), it is the strongest monster the table shows
  const [u] = linked(['thorn_veil', 'chain_lightning']); u.terrain = { id: field.id, owner: 0 };
  const x = put(u, 0, 0, mon(hi.name, 'a')), y = put(u, 0, 1, mon(lo.name, 'a')); put(u, 0, 2, mon('Mystical Elf', 'd', { veil: true }));
  applyMut(u, { t: 'end' }, db); assert.equal(y.ba, 200, 'the monster showing the most ATK'); assert.equal(x.ba || 0, 0);
});

test('every run pays Memories, even one lost at once with nothing found', () => {
  const run = newRun(db, { seed: 5 }); run.phase = 'over'; run.result = { won: false }; // lost the first duel, nothing melded
  const p = newProfile(), sc = scoreRun(p, run);
  assert.ok(sc.total >= 5, 'a lost run paid ' + sc.total); assert.equal(sc.total, sc.lines.reduce((n, l) => n + l[1], 0), 'and the lines add up to it');
  const before = p.memories; applyRun(p, run); assert.ok(p.memories >= before + 5);
  // a run that earned more is paid what it earned, with no extra line
  const won = newRun(db, { seed: 6 }); won.phase = 'over'; won.result = { won: false }; won.stats.wins = 9; const s2 = scoreRun(newProfile(), won);
  assert.equal(s2.total, 9); assert.equal(s2.lines.length, 1);
});

// Faults from the second independent test report (21 November 2026). Each test fails on the code as it was.
test('a draw effect takes what the deck holds and shows it; only the start-of-turn draw can lose the duel', () => {
  const two = [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === 'draw' && t.n >= 2); assert.ok(two, 'a Spell that draws two');
  let s = blank(); s.deck[0] = [{ id: C('Mystical Elf').id }]; s.hand[0].push({ u: uid++, id: two[0] });
  let ev = applyMut(s, { t: 'play', hand: [0], onto: null }, db);
  assert.equal(s.winner, null, 'the duel goes on'); assert.equal(s.hand[0].length, 1); assert.equal(s.deck[0].length, 0);
  assert.deepEqual(ev.filter(e => e.e === 'draw').map(e => e.n), [1], 'the one card drawn is shown as a draw');
  // Herald with an empty deck: nothing to draw, nothing breaks
  s = blank(); s.deck[0] = []; s.hand[0].push({ u: uid++, id: C('Mystical Elf').id, e: 'herald' });
  ev = applyMut(s, { t: 'play', hand: [0], onto: null, pos: 'a' }, db); assert.equal(s.winner, null); assert.equal(ev.filter(e => e.e === 'draw').length, 0);
  // the start-of-turn draw is the one that must be made
  s = blank(); s.deck[1] = []; s.hand[1] = []; applyMut(s, { t: 'end' }, db);
  assert.equal(s.winner, 0); assert.equal(s.reason, 'deckout');
  assert.match(FX_TEXT.draw(2), /as many as your deck holds/); assert.match(ENCHANT_TEXT.herald, /if your deck holds one/);
});

test('a Spell or Equip played alone goes to the monster the player chose', () => {
  const fx = k => [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === k)[0];
  let s = blank(); const weak = put(s, 1, 0, mon('Mystical Elf', 'a')), strong = put(s, 1, 1, mon('Summoned Skull', 'a')); s.hand[0].push({ u: uid++, id: fx('destroy') });
  applyMut(s, { t: 'play', hand: [0], onto: null, target: 0 }, db); assert.equal(s.mon[1][0], null, 'the chosen, weaker monster'); assert.ok(s.mon[1][1]);
  s = blank(); put(s, 1, 0, mon('Mystical Elf', 'a')); put(s, 1, 1, mon('Summoned Skull', 'a')); s.hand[0].push({ u: uid++, id: fx('destroy') });
  applyMut(s, { t: 'play', hand: [0], onto: null }, db); assert.equal(s.mon[1][1], null, 'with no choice, the strongest face-up monster');
  s = blank(); const a = put(s, 0, 0, mon('Mystical Elf', 'd')), b = put(s, 0, 1, mon('Summoned Skull', 'a')); s.hand[0].push({ u: uid++, id: fx('pump') });
  applyMut(s, { t: 'play', hand: [0], onto: null, target: 0 }, db); assert.ok(a.ba > 0, 'the chosen monster is boosted'); assert.equal(b.ba || 0, 0);
  // the page offers exactly these choices (web/aim.mjs)
  s = blank(); put(s, 1, 0, mon('Mystical Elf', 'a')); put(s, 1, 3, mon('Summoned Skull', 'd', { veil: true })); put(s, 0, 2, mon('Mystical Elf', 'a'));
  assert.deepEqual(aimFor(db, s, fx('destroy')), { side: 1, zones: [0, 3] }); assert.deepEqual(aimFor(db, s, fx('pump')), { side: 0, zones: [2] });
  assert.equal(aimFor(db, s, fx('heal')), null); assert.equal(aimFor(db, s, C('Mystical Elf').id), null);
  const eq = [...db.byId.values()].find(c => roleOf(db, c.id) === 'equip'); assert.deepEqual(aimFor(db, s, eq.id), { side: 0, zones: [2] });
});

test('one attack is one step toward Patient Trap, even when it springs a Trap and reveals a veiled monster', () => {
  const trap = [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'trap' && t.fx === 'weaken')[0];
  const s = blank({ seats: [{ track: 1 }, {}] }); s.hand = [[], []]; s.turn = 3; s.active = 1;
  put(s, 0, 0, mon('Mystical Elf', 'd', { veil: true })); put(s, 0, 1, mon('Mystical Elf', 'd', { veil: true })); s.traps[0][0] = { u: uid++, id: trap };
  put(s, 1, 0, mon('Summoned Skull', 'a')); put(s, 1, 1, mon('Summoned Skull', 'a'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.ok(s.pending, 'the Trap may answer'); applyMut(s, { t: 'respond', trap: 0 }, db);
  assert.equal(s.stats[0].trapsSprung, 1); assert.equal(s.stats[0].reveals, 1); assert.equal(s.stats[0].baits, 1, 'one attack, one bait');
  applyMut(s, { t: 'attack', from: 1, to: 1 }, db); assert.equal(s.stats[0].baits, 2, 'a second attack into a veiled monster is a second bait');
});

test('Piercing takes Life Points only when it destroys the defender: Bulwark stops both', () => {
  const s = blank(); const wall = put(s, 1, 0, mon('Mystical Elf', 'd', { e: 'bulwark' })); put(s, 0, 0, mon('Summoned Skull', 'a', { e: 'piercing' })); put(s, 0, 1, mon('Summoned Skull', 'a', { e: 'piercing' }));
  const lp = s.lp[1], q = forecast(s, db, 0, s.mon[0][0], 1, wall); assert.equal(q.dmgDef, 0, 'the forecast shows no damage');
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.ok(s.mon[1][0], 'Bulwark held'); assert.equal(s.lp[1], lp, 'so nothing was destroyed and no Life Points are lost');
  const q2 = forecast(s, db, 0, s.mon[0][1], 1, wall); assert.equal(q2.dmgDef, q2.a - q2.d); assert.ok(q2.dmgDef > 0);
  applyMut(s, { t: 'attack', from: 1, to: 0 }, db); assert.equal(s.mon[1][0], null); assert.equal(s.lp[1], lp - q2.dmgDef, 'the second attack destroys it and pierces');
});

test('a full hand: a returned monster goes under the deck, and Echo has no room to come back', () => {
  const fx = [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === 'bounce')[0];
  let s = blank(); s.hand[1] = []; give(s, 1, ...Array(db.config.handMax).fill('Mystical Elf')); put(s, 1, 0, mon('Summoned Skull', 'a')); s.hand[0].push({ u: uid++, id: fx });
  const n = s.deck[1].length; applyMut(s, { t: 'play', hand: [s.hand[0].length - 1], onto: null }, db);
  assert.equal(s.mon[1][0], null); assert.equal(s.hand[1].length, db.config.handMax, 'the hand stays at its limit'); assert.equal(s.deck[1].length, n + 1); assert.equal(s.deck[1][0].id, C('Summoned Skull').id, 'under the deck');
  assert.match(FX_TEXT.bounce(), /under its deck if that hand is full/); assert.match(TRAP_TEXT.bounce(), /under its deck if that hand is full/);
  s = blank(); s.hand[1] = []; give(s, 1, ...Array(db.config.handMax - 1).fill('Mystical Elf')); put(s, 1, 0, mon('Summoned Skull', 'a')); s.hand[0].push({ u: uid++, id: fx });
  applyMut(s, { t: 'play', hand: [s.hand[0].length - 1], onto: null }, db); assert.equal(s.hand[1].length, db.config.handMax, 'with room it goes to the hand');
  // Echo
  s = blank(); s.hand[1] = []; give(s, 1, ...Array(db.config.handMax).fill('Mystical Elf')); put(s, 1, 0, mon('Mystical Elf', 'a', { e: 'echo' })); put(s, 0, 0, mon('Summoned Skull', 'a'));
  s.turn = 3; applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.mon[1][0], null); assert.equal(s.hand[1].length, db.config.handMax); assert.equal(s.gy[1].length, 1, 'no room: it goes to the graveyard');
  s = blank(); s.hand[1] = []; put(s, 1, 0, mon('Mystical Elf', 'a', { e: 'echo' })); put(s, 0, 0, mon('Summoned Skull', 'a'));
  s.turn = 3; applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.hand[1].length, 1, 'with room it comes back'); assert.equal(s.hand[1][0].e, 'echo');
  assert.match(ENCHANT_TEXT.echo, /if your hand has room/);
});

test('Echo brings a card back once a duel, not every time it is destroyed', () => {
  const s = blank(); s.hand = [[], []]; s.turn = 3; s.active = 1; put(s, 0, 0, mon('Mystical Elf', 'a', { e: 'echo' })); put(s, 1, 0, mon('Summoned Skull', 'a'));
  applyMut(s, { t: 'attack', from: 0, to: 0 }, db); assert.equal(s.hand[0].length, 1, 'the first time it returns'); applyMut(s, { t: 'end' }, db);
  applyMut(s, { t: 'play', hand: [s.hand[0].findIndex(h => h.e === 'echo')], onto: null, pos: 'a' }, db); applyMut(s, { t: 'end' }, db);
  const z = s.mon[0].findIndex(m => m && m.e === 'echo'), gy = s.gy[0].length; applyMut(s, { t: 'attack', from: 0, to: z }, db);
  assert.equal(s.hand[0].filter(h => h.e === 'echo').length, 0, 'the second time it does not'); assert.equal(s.gy[0].length, gy + 1, 'it goes to the graveyard');
});

test('every pair of Enchants in battle does what the two texts say, in every position', () => {
  const E = [null, ...ENCHANTS]; let n = 0;
  for (const xe of E) for (const te of E) for (const pos of ['a', 'd']) for (const veil of pos === 'd' ? [false, true] : [false]) for (const [xn, tn] of [['Summoned Skull', 'Mystical Elf'], ['Mystical Elf', 'Summoned Skull'], ['Mystical Elf', 'Mystical Elf']]) {
    if (te === 'soaring' && xe !== 'soaring' && !veil) continue; // cannot be attacked at all (its own test)
    const s = blank(); s.hand = [[], []]; s.turn = 3;
    const X = put(s, 0, 0, mon(xn, 'a', xe ? { e: xe } : {})), T = put(s, 1, 0, mon(tn, pos, { veil, ...(te ? { e: te } : {}) }));
    const q = forecast(s, db, 0, X, 1, T, { ambush: veil && te === 'ambusher' ? 800 : 0 }), a = q.a, d = q.d, lp = s.lp.slice(), tag = `${xe} ${xn} into ${te} ${tn} ${pos}${veil ? ' veiled' : ''} (${a} v ${d})`;
    if (veil && te === 'ambusher') assert.equal(d, forecast(s, db, 0, X, 1, T).d + 800, tag + ': Ambusher adds 800');
    applyMut(s, { t: 'attack', from: 0, to: 0 }, db); n++;
    const wantT = xe === 'venom' || a > d || (pos === 'a' && a === d), wantX = te === 'venom' || (pos === 'a' && a <= d);
    const tLeft = !s.mon[1][0], xLeft = !s.mon[0][0];
    assert.equal(tLeft, wantT && te !== 'bulwark', tag + ': defender ' + (wantT ? 'falls unless Bulwark holds' : 'stays'));
    assert.equal(xLeft, wantX && xe !== 'bulwark', tag + ': attacker ' + (wantX ? 'falls unless Bulwark holds' : 'stays'));
    const lostT = pos === 'a' ? Math.max(0, a - d) : (xe === 'piercing' && tLeft && a > d ? a - d : 0), lostX = Math.max(0, d - a);
    assert.equal(lp[1] - s.lp[1], lostT, tag + ': Life Points the defender loses');
    assert.equal(s.lp[0] - lp[0], (xe === 'drain' ? lostT : 0) - lostX, tag + ': Life Points the attacker loses or drains');
    if (te === 'echo' && tLeft) { assert.equal(s.hand[1].length, 1, tag + ': Echo returns'); assert.equal(s.hand[1][0].x, 1); } else assert.equal(s.hand[1].length, 0, tag);
    if (xe === 'echo' && xLeft) assert.equal(s.hand[0].length, 1, tag + ': Echo returns'); else assert.equal(s.hand[0].length, 0, tag);
    assert.equal(s.gy[1].length, tLeft && te !== 'echo' ? 1 : 0, tag); assert.equal(s.gy[0].length, xLeft && xe !== 'echo' ? 1 : 0, tag);
  }
  assert.ok(n > 900, 'battles checked: ' + n);
});

test('a Spell that turns a veiled monster shows it being revealed', () => {
  const fx = [...db.tagOf.entries()].find(([id, t]) => db.byId.get(id).kind === 'spell' && t.fx === 'position')[0];
  const s = blank(); put(s, 1, 0, mon('Mystical Elf', 'd', { veil: true })); s.hand[0].push({ u: uid++, id: fx });
  const ev = applyMut(s, { t: 'play', hand: [s.hand[0].length - 1], onto: null, target: 0 }, db);
  assert.equal(s.mon[1][0].veil, false); assert.equal(s.mon[1][0].pos, 'a'); assert.equal(ev.filter(e => e.e === 'reveal' && e.seat === 1 && e.zone === 0).length, 1);
});

test('a relic\'s extra card at the start of a turn is drawn if the deck holds it and never loses the duel', () => {
  for (const [deck, extra, wins] of [[1, 1, null], [1, 0, null], [0, 1, 0], [0, 0, 0], [2, 1, null]]) {
    const s = blank(); s.hand[1] = []; give(s, 1, 'Mystical Elf', 'Mystical Elf', 'Mystical Elf', 'Mystical Elf'); s.deck[1] = Array.from({ length: deck }, () => ({ id: C('Mystical Elf').id })); s.seat[1].extraDraw = extra;
    applyMut(s, { t: 'end' }, db);
    assert.equal(s.winner, wins, `deck ${deck}, extra ${extra}`); if (wins === null) assert.equal(s.hand[1].length, 4 + Math.min(deck, 1 + extra), `deck ${deck}, extra ${extra}: cards drawn`);
  }
});

// ---------- progress is never lost and never paid twice ----------
const playTo = (seed, stop, opts = {}) => { const run = newRun(db, { seed, track: true, ...opts }); let n = 0; while (run.phase !== 'over' && !stop(run) && n++ < 4000) runApply(run, policyAction(db, run, { level: 2 }), db); return run; };

test('leaving the pyramid ends the run as a loss and banks what it earned, once', () => {
  const run = playTo(4242, r => r.stats.wins >= 3 && r.phase === 'chamber', { uid: 'run-a' }); assert.ok(run.stats.wins >= 3, 'three duels won');
  const wins = run.stats.wins, p = newProfile();
  assert.throws(() => applyRun(p, run), /not over/);
  runApply(run, { t: 'abandon' }, db);
  assert.equal(run.phase, 'over'); assert.equal(run.result.won, false); assert.equal(run.result.reason, 'abandoned');
  assert.throws(() => runApply(run, { t: 'abandon' }, db), /over/, 'a second tap is refused');
  const r1 = applyRun(p, run); assert.ok(r1.total >= wins, 'pays at least the duels won: ' + r1.total); assert.equal(p.memories, r1.total); assert.equal(p.duelWins, wins); assert.equal(p.runs, 1);
  const snap = JSON.stringify(p), r2 = applyRun(p, run);
  assert.equal(r2.already, true); assert.equal(r2.total, 0); assert.equal(JSON.stringify(p), snap, 'banking the same run again changes nothing');
  // ... also after the profile and the run have been through storage (a reload)
  const p2 = JSON.parse(snap), run2 = JSON.parse(JSON.stringify(run)); applyRun(p2, run2); assert.equal(JSON.stringify(p2), snap);
  // a different run still banks
  const other = playTo(77, r => r.stats.duels >= 1 && r.phase === 'chamber', { uid: 'run-b' }); runApply(other, { t: 'abandon' }, db); assert.ok(applyRun(p, other).total >= 5); assert.equal(p.runs, 2);
  assert.ok(p.banked.includes('run-a') && p.banked.includes('run-b'));
});

test('leaving works from every screen, and a run left before any duel pays nothing', () => {
  const seen = new Set();
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const stopAt of [0, 1, 3, 7, 15, 40, 90, 200]) {
    const run = newRun(db, { seed, track: true, uid: 's' + seed + '-' + stopAt }); let n = 0;
    while (run.phase !== 'over' && n < stopAt) { runApply(run, policyAction(db, run, { level: 2 }), db); n++; }
    if (run.phase === 'over') continue;
    seen.add(run.phase); const duels = run.stats.duels;
    runApply(run, { t: 'abandon' }, db); JSON.parse(JSON.stringify(run));
    const p = newProfile(), r = applyRun(p, run);
    if (!duels) assert.equal(r.total - Math.min(20, r.fresh.length), 0, 'no descent, no pay (phase ' + [...seen].pop() + ')'); else assert.ok(r.total >= 5);
  }
  for (const ph of ['kit', 'charm', 'chamber', 'duel']) assert.ok(seen.has(ph), 'left from the ' + ph + ' screen');
  // starting and leaving over and over mints nothing
  const p = newProfile(); for (let i = 0; i < 30; i++) { const run = newRun(db, { seed: 900 + i, uid: 'farm' + i }); runApply(run, { t: 'abandon' }, db); applyRun(p, run); } assert.equal(p.memories, 0);
});

test('the Winnower cuts a card out of the deck, within stated limits', () => {
  const run = playTo(31, r => r.phase === 'chamber' && r.stats.wins >= 1); assert.equal(run.phase, 'chamber');
  run.phase = 'bazaar'; run.offer = { kind: 'bazaar', merchant: 'scrapper', items: [{ kind: 'scrap', price: 15, uses: 3 }] }; run.embers = 200;
  const before = run.deck.slice(), trunk = run.trunk.length, w = deckWeight(db, run.deck);
  assert.throws(() => runApply(run, { t: 'buy', i: 0 }, db), /pick a deck card/); assert.throws(() => runApply(run, { t: 'buy', i: 0, deck: 99 }, db), /pick a deck card/);
  runApply(run, { t: 'buy', i: 0, deck: 5 }, db);
  assert.equal(run.deck.length, 39); assert.equal(run.cuts, 1); assert.equal(run.embers, 185); assert.equal(run.trunk.length, trunk, 'the trunk is untouched');
  assert.deepEqual(run.deck, before.filter((_, i) => i !== 5), 'exactly that card left the deck'); assert.ok(deckWeight(db, run.deck) <= w);
  run.deck[0].b = 1; assert.throws(() => runApply(run, { t: 'buy', i: 0, deck: 0 }, db), /bound meld cannot be cut/); delete run.deck[0].b;
  runApply(run, { t: 'buy', i: 0, deck: 0 }, db); runApply(run, { t: 'buy', i: 0, deck: 0 }, db);
  assert.equal(run.deck.length, 37); assert.equal(run.offer.items[0].sold, true, 'three cuts a visit');
  assert.throws(() => runApply(run, { t: 'buy', i: 0, deck: 0 }, db), /nothing to buy/);
  // the smaller deck is a legal deck from here on: swaps still work, and the duel starts with it
  run.offer.items[0] = { kind: 'scrap', price: 15, uses: 9 }; while (run.deck.length > MIN_DECK) runApply(run, { t: 'buy', i: 0, deck: 0 }, db);
  assert.equal(run.deck.length, MIN_DECK); assert.throws(() => runApply(run, { t: 'buy', i: 0, deck: 0 }, db), /cannot go below 34/);
  const saved = JSON.parse(JSON.stringify(run)); runApply(saved, { t: 'leave' }, db); assert.equal(saved.phase, 'chamber');
  if (saved.trunk.length) { let ok = 0; for (let d = 0; d < saved.deck.length && !ok; d++) { try { runApply(saved, { t: 'swap', deck: d, trunk: 0 }, db); ok = 1; } catch (e) { assert.doesNotMatch(e.message, /deck must be/); } } }
  let n = 0; while (saved.phase !== 'over' && n++ < 4000) runApply(saved, policyAction(db, saved, { level: 2 }), db); assert.equal(saved.phase, 'over', 'the run plays to its end with a 34-card deck');
});

test('the early first Gift comes after the first duel won, and the later Gifts stay where they were', () => {
  const lab = cfg => ({ ...db, config: { ...db.config, giftXpScale: 2, ...cfg }, _pair: new Map() });
  const gifts = (d, seed) => { const run = newRun(d, { seed, track: true }); const at = []; let n = 0, seen = 0;
    // a Gift level is a threshold on experience, checked when a duel is won: 40, 80, 120 and so on. Only the first one moves.
    const need = xp => { let l = 0; while (xp >= (l + 1) * 40) l++; return l; };
    while (run.phase !== 'over' && n++ < 4000) { runApply(run, policyAction(d, run, { level: 2 }), d); if (run.level > seen) { seen = run.level; at.push(run.stats.wins); assert.equal(run.level, Math.max(need(run.xp), d.config.giftFirstXp ? 1 : 0), 'Gift levels follow the thresholds'); } }
    return { at }; };
  let early = 0, checked = 0;
  for (const seed of [11, 12, 13, 14, 15, 16]) {
    const a = gifts(lab({}), seed), b = gifts(lab({ giftFirstXp: 10 }), seed);
    if (!b.at.length) continue; checked++;
    assert.equal(b.at[0], 1, 'the first Gift follows the first duel won');
    if (a.at.length) { assert.ok(a.at[0] > 1, 'without the lever it takes more than one win'); early++; }
  }
  assert.ok(checked >= 4 && early >= 3);
});

test("a guardian's own offset turns down that guardian only", () => {
  const lab = { ...db, config: { ...db.config, bossBandBy: { kiln_warden: -350 } }, _pair: new Map() };
  const top = (d, boss) => { let m = 0; for (let seed = 1; seed <= 12; seed++) { const r = makeRival(d, new Rng(seed), { floor: 0, tier: 'boss', theme: null, boss }); for (const e of r.deck) if (d.isMonster(e.id) && d.byId.get(e.id).name !== boss.ace) m = Math.max(m, d.byId.get(e.id).atk); } return m; };
  const [kiln, stone] = BOSSES[0];
  assert.ok(top(lab, kiln) <= top(db, kiln) - 300, 'the Kiln Warden holds weaker monsters');
  assert.equal(top(lab, stone), top(db, stone), 'the Stone Sentinel is untouched');
  assert.deepEqual(labConfig(LAB_DEFAULTS).bossBandBy, { kiln_warden: -350 }, 'the playable levels the pair by default');
});

test('a first lesson points at a play that does what the lesson says', () => {
  const seen = { meld: 0, fuel: 0, single: 0 };
  const checkAt = d => {
    const hand = d.hand[0], atk = i => db.byId.get(hand[i].id).atk;
    const best = Math.max(0, ...hand.map((c, i) => db.isMonster(c.id) ? atk(i) : 0));
    for (const tips of [{}, { meld: 1 }, { meld: 1, fuel: 1 }, learnedAll()]) {
      const L = lessonFor(db, d, tips); if (!L) continue; seen[L.kind]++;
      assert.ok(!tips[L.kind], 'a learned lesson is not shown again');
      const p = planChain(db, L.cards.map(i => hand[i]), null);
      const [h, t] = lessonText(L.kind, L.cards.map(i => db.byId.get(hand[i].id).name)); assert.ok(h && t.includes(db.byId.get(hand[L.cards[0]].id).name));
      if (L.kind === 'meld') { assert.equal(p.fizzles, 0); assert.ok(p.melded && db.byId.get(p.final.id).atk > best, 'the meld beats every single card'); assert.ok(!t.includes(db.byId.get(p.final.id).name), 'the lesson does not say what the meld makes'); }
      if (L.kind === 'fuel') { assert.equal(p.steps[0].kind, 'fuel'); assert.equal(roleOf(db, hand[L.cards[1]].id), 'fuel'); assert.equal(db.config.fuelBonus, 300, 'the lesson says +300'); }
      if (L.kind === 'single') { assert.equal(L.cards.length, 1); assert.equal(atk(L.cards[0]), best);
        // what the lesson says, checked the long way: the rival shows every monster it has, and this card alone beats each
        const theirs = d.mon[1].filter(Boolean); assert.ok(theirs.length > 0 && theirs.every(m => !m.veil), 'the rival has monsters and shows them all'); assert.ok(/already beats every monster the rival has on the table/.test(t));
        for (const m of theirs) { const f = forecast(d, db, 0, { id: hand[L.cards[0]].id, pos: 'a' }, 1, m); assert.ok(f.killT && !f.killX, 'the card named does not beat ' + db.byId.get(m.id).name); } }
      // the play the lesson names is legal now
      const legal = legalActions(d, db, { maxChain: 2 }).filter(a => a.t === 'play').some(a => JSON.stringify(a.hand) === JSON.stringify(L.cards)); assert.ok(legal, 'the engine allows the play: ' + L.kind);
    }
    assert.equal(lessonFor(db, d, learnedAll()), null);
  };
  for (let seed = 1; seed <= 60; seed++) for (const forger of FORGER_IDS.slice(0, 2)) {
    const run = playTo(seed, r => r.phase === 'duel', { forger }); if (run.phase !== 'duel') continue;
    checkAt(run.duel);
    // later in the same duel, each time the play is the player's to make
    for (let n = 0, turns = 0; n < 60 && turns < 4 && run.phase === 'duel'; n++) { runApply(run, policyAction(db, run, { level: 2 }), db); const d = run.duel; if (run.phase === 'duel' && d && d.active === 0 && !d.played && !d.pending && d.winner == null && d.mon[1].some(Boolean)) { turns++; checkAt(d); } }
  }
  assert.ok(seen.meld > 20 && seen.fuel > 5 && seen.single > 5, 'each lesson came up: ' + JSON.stringify(seen));
  // Reported 21 November 2026: Blue-Eyes White Dragon and Dragon Treasure in one hand, and the lesson said nothing in the
  // hand could make more than Blue-Eyes. Dragon Treasure adds to it, so the lesson may not say that. It may still say
  // to play Blue-Eyes alone when that is enough to beat what the rival shows, which is true.
  { const id = n => [...db.byId.values()].find(c => c.name === n).id, weak = [...db.byId.values()].filter(c => db.isMonster(c.id) && c.type === 'Dragon' && c.atk < 1000).slice(0, 2);
    const base = playTo(3, r => r.phase === 'duel').duel;
    for (const cfg of [labConfig(LAB_DEFAULTS), labConfig({ ...LAB_DEFAULTS, equips: true })]) { const lab = { ...db, config: { ...db.config, ...cfg }, _pair: new Map() };
      const hand = [{ id: id('Blue-Eyes White Dragon') }, { id: id('Dragon Treasure') }, { id: weak[0].id }, { id: weak[1].id }];
      const withEquip = planChain(lab, [hand[0], hand[1]], null); assert.equal(withEquip.fizzles, 0); assert.equal(withEquip.final.ba, cfg.equipKinds ? 800 : 500, 'Dragon Treasure does add to Blue-Eyes');
      const empty = { ...base, hand: [hand, []], mon: [base.mon[0].map(() => null), base.mon[1].map(() => null)], terrain: null };
      assert.equal(lessonFor(lab, empty, { meld: 1, fuel: 1 }), null, 'no rival monster: nothing true to say about playing it alone');
      const facing = { ...empty, mon: [empty.mon[0], empty.mon[1].map((_, z) => z === 0 ? { u: 999, id: weak[0].id, pos: 'a', veil: false, att: 0, moved: false } : null)] };
      const L = lessonFor(lab, facing, { meld: 1, fuel: 1 }); assert.deepEqual(L, { kind: 'single', cards: [0] }); assert.ok(enoughAlone(lab, facing, hand[0].id));
      const text = lessonText('single', ['Blue-Eyes White Dragon'])[1]; assert.ok(!/Nothing in this hand|melds into more/.test(text), 'the false sentence is gone'); assert.ok(/already beats every monster the rival has on the table/.test(text));
      const veiled = { ...facing, mon: [facing.mon[0], facing.mon[1].map(m => m && { ...m, veil: true })] }; assert.equal(lessonFor(lab, veiled, { meld: 1, fuel: 1 }), null, 'a veiled rival monster: the lesson cannot know, so it says nothing'); } }
  const tips = {}; assert.equal(learnFrom(tips, [{ e: 'meld', seat: 1, kind: 'cross' }, { e: 'meld', seat: 0, kind: 'fizzle' }]), false); assert.deepEqual(tips, {});
  assert.equal(learnFrom(tips, [{ e: 'meld', seat: 0, kind: 'cross' }, { e: 'meld', seat: 0, kind: 'fuel' }]), true); assert.deepEqual(tips, { meld: 1, fuel: 1 });
});

test('a lost duel says what happened from what was shown', () => {
  const view = (mine, theirs) => ({ mon: [mine.map(ea => ea ? { ea } : null), theirs.map(ea => ea === 'v' ? { veil: true } : ea ? { ea } : null)] });
  const n = noteFrames(newNote(false), [
    { view: view([1400, 0], [2300, 'v']), evs: [{ e: 'summon', seat: 0, melded: false }, { e: 'battle', atkSeat: 1, direct: true }, { e: 'lp', seat: 0, d: -2300 }] },
    { view: view([1500], [2600]), evs: [{ e: 'meld', seat: 0, kind: 'fizzle' }, { e: 'meld', seat: 0, kind: 'fizzle' }, { e: 'battle', atkSeat: 1, direct: true }, { e: 'battle', atkSeat: 0, direct: true }] },
  ]);
  assert.deepEqual({ a: n.myBest, b: n.rivalBest, m: n.melds, f: n.fizzles, s: n.singles, d: n.directHits, l: n.lost }, { a: 1500, b: 2600, m: 0, f: 2, s: 1, d: 2, l: 2300 });
  const why = whyLost(n, { reason: 'lp' }, { law: 'scorched' });
  assert.equal(why.length, 3); assert.match(why[0], /2600 ATK. Yours reached 1500/); assert.match(why[1], /did not meld/);
  assert.match(whyLost(n, { reason: 'deckout' }, {})[0], /deck ran out/);
  // a note begun part-way through a duel does not compare whole-duel numbers; the Law line still shows
  assert.deepEqual(whyLost(newNote(true), { reason: 'lp' }, { law: 'stonewall' }), ['Her monsters win ties. Attack only when your number is higher, not equal.']);
  assert.deepEqual(whyLost(newNote(true), { reason: 'lp' }, {}), []);
  for (const pair of BOSSES) for (const b of pair) assert.equal(whyLost(newNote(true), {}, { law: b.law }).length, 1, 'every guardian Law has its line: ' + b.law);
});

test('the page takes every state of a real run as a save, and no damaged one', () => {
  // every state a run passes through, after a round trip through JSON as the page stores it, at several heats and skill levels
  const seen = new Set();
  for (const [seed, heat, level, forger] of [[11, 0, 2, 'tarn'], [12, 0, 0, 'scrapper'], [13, 5, 2, 'veil'], [14, 10, 2, 'storm'], [15, 0, 1, undefined], [16, 3, 2, 'tarn']]) {
    const run = newRun(db, { seed, heat, forger }); let guard = 0;
    for (;;) {
      const s = JSON.parse(JSON.stringify(run)); seen.add(s.phase);
      assert.equal(runFault(db, s), '', `seed ${seed} step ${guard} phase ${s.phase}`);
      if (run.phase === 'over') break;
      runApply(run, policyAction(db, run, { level }), db); assert.ok(++guard < 200000);
    }
    const left = newRun(db, { seed: seed + 100, heat, forger }); runApply(left, { t: 'abandon' }, db); assert.equal(runFault(db, JSON.parse(JSON.stringify(left))), '', 'a run left at once');
  }
  assert.deepEqual([...seen].sort(), PHASES.slice().sort(), 'every phase was seen');
  // the two saves the review of Version 27 reported, and their relatives: valid JSON, not a run
  const base = () => { const r = newRun(db, { seed: 21, forger: 'tarn' }); while (r.phase !== 'chamber') runApply(r, policyAction(db, r, { level: 2 }), db); return JSON.parse(JSON.stringify(r)); };
  const bad = edit => { const r = base(); const out = edit(r); return runFault(db, out === undefined ? r : out); };
  assert.equal(bad(r => { r.phase = 'limbo'; }), 'unknown phase');
  assert.equal(bad(r => { r.phase = 'over'; r.result = {}; }), 'no result');
  assert.equal(bad(r => { r.phase = 'over'; r.result = { won: false }; }), 'no reason for the loss');
  assert.notEqual(bad(() => ({ phase: 'over', deck: [], stats: {}, result: { won: true } })), '');
  assert.equal(bad(r => { r.phase = 'over'; r.result = { won: true, floor: 2 }; r.stats = {}; }), 'the tallies are missing');
  assert.equal(bad(r => { r.doors = null; }), 'no doors');
  assert.equal(bad(r => { r.doors[0].type = 'trapdoor'; }), 'a door to no known room');
  assert.equal(bad(r => { r.phase = 'duel'; }), 'no duel');
  assert.equal(bad(r => { r.phase = 'reward'; r.offer = null; }), 'nothing on offer');
  assert.equal(bad(r => { r.deck[3] = { id: 'no-such-card' }; }), 'the deck holds something that is not a card');
  assert.equal(bad(r => { r.embers = null; }), 'embers is not a number'); // JSON turns NaN into null
  assert.equal(bad(r => { r.floor = 7; }), 'no such floor');
  for (const junk of [null, 7, 'run', [], {}]) assert.equal(okRun(db, junk), false);
  // a field this build does not know is let through: a newer build's save still opens
  assert.equal(bad(r => { r.somethingNew = { a: 1 }; }), '');
  // a finished run that is refused is never banked: applyRun is reached only through the page, which checks first; and the profile check holds
  assert.ok(okProfile(JSON.parse(JSON.stringify(newProfile())))); for (const junk of [null, [], {}, { memories: 'lots' }]) assert.equal(okProfile(junk), false);
});

// ---------- Equips that differ (lever equipKinds, Lab switch `equips`) ----------
test('Equips that differ: off, every Equip adds 500 to both; every name in the hand-kept table is an Equip in the pool', () => {
  assert.deepEqual(db.missingTags, []); assert.ok(db.equipOf.size >= 40);
  for (const c of db.pool.cards) if (c.kind === 'equip') assert.deepEqual(equipAdd(db, c.id, C('Mystical Elf').id), [db.config.equipBonus, db.config.equipBonus]);
  assert.equal(labConfig({}).equipKinds, null); assert.equal(labConfig(LAB_DEFAULTS).equipKinds, null, 'the switch starts off');
  assert.equal(labConfig({ equips: true }).equipKinds, EQUIP_KINDS);
});
test('Equips that differ: a fitted Equip adds more to its own kind and less to any other, played alone or in a meld', () => {
  const lab = { ...db, config: { ...db.config, equipKinds: EQUIP_KINDS }, _pair: new Map() }, K = EQUIP_KINDS;
  const sword = C('Legendary Sword'), spear = C('Burning Spear'), axe = C('Axe of Despair'), armor = C('Raregold Armor');
  const warrior = db.pool.cards.find(c => c.kind === 'monster' && c.type === 'Warrior' && c.attr !== 'FIRE'), other = db.pool.cards.find(c => c.kind === 'monster' && c.type !== 'Warrior' && c.attr !== 'FIRE'), fire = db.pool.cards.find(c => c.kind === 'monster' && c.attr === 'FIRE' && c.type !== 'Warrior');
  const plain = db.pool.cards.find(c => c.kind === 'equip' && !db.equipOf.has(c.id)); assert.ok(plain, 'some Equips stay plain');
  assert.deepEqual(equipAdd(lab, sword.id, warrior.id), [K.fit, K.fit]); assert.deepEqual(equipAdd(lab, sword.id, other.id), [K.off, K.off]);
  assert.deepEqual(equipAdd(lab, spear.id, fire.id), [K.fit, K.fit]); assert.deepEqual(equipAdd(lab, spear.id, other.id), [K.off, K.off]);
  assert.deepEqual(equipAdd(lab, axe.id, other.id), K.edge); assert.deepEqual(equipAdd(lab, armor.id, other.id), K.ward);
  assert.deepEqual(equipAdd(lab, plain.id, other.id), [db.config.equipBonus, db.config.equipBonus]);
  assert.ok(K.fit > db.config.equipBonus && K.off < db.config.equipBonus && K.off >= db.config.fuelBonus, 'off its kind a fitted Equip is no worse than fuel');
  // in a meld
  let p = planChain(lab, [{ id: warrior.id }, { id: sword.id }], null); assert.equal(p.final.ba, K.fit); assert.equal(p.final.bd, K.fit);
  p = planChain(lab, [{ id: sword.id }, { id: other.id }], null); assert.equal(p.final.id, other.id); assert.equal(p.final.ba, K.off);
  p = planChain(lab, [{ id: other.id }, { id: axe.id }], null); assert.equal(p.final.ba, K.edge[0]); assert.equal(p.final.bd || 0, K.edge[1]);
  p = planChain(lab, [{ id: other.id }, { id: armor.id }], null); assert.equal(p.final.ba || 0, K.ward[0]); assert.equal(p.final.bd, K.ward[1]);
  // played alone, onto the monster the player chose
  const s = blank(); const a = put(s, 0, 0, mon(warrior.name)), b = put(s, 0, 1, mon(other.name)); give(s, 0, 'Legendary Sword');
  applyMut(s, { t: 'play', hand: [0], onto: null, target: 0 }, lab); assert.equal(a.ba, K.fit); assert.equal(a.bd, K.fit); assert.equal(a.eq, 1); assert.equal(b.ba || 0, 0);
  const s2 = blank(); const c2 = put(s2, 0, 0, mon(other.name)); give(s2, 0, 'Legendary Sword');
  applyMut(s2, { t: 'play', hand: [0], onto: null, target: 0 }, lab); assert.equal(c2.ba, K.off);
  // the same play with the lever off
  const s3 = blank(); const c3 = put(s3, 0, 0, mon(warrior.name)); give(s3, 0, 'Legendary Sword');
  applyMut(s3, { t: 'play', hand: [0], onto: null, target: 0 }, db); assert.equal(c3.ba, db.config.equipBonus); assert.equal(c3.bd, db.config.equipBonus);
});
test('Equips that differ: a fitted Equip is judged when it is attached, so the order of a meld matters', () => {
  const lab = { ...db, config: { ...db.config, equipKinds: EQUIP_KINDS }, _pair: new Map() }, K = EQUIP_KINDS;
  // a monster that is not a Dragon melds into one: attach Dragon Treasure to it before the meld, and to the Dragon after
  const dt = C('Dragon Treasure'); let found = null;
  const mons = db.pool.cards.filter(c => c.kind === 'monster' && c.type !== 'Dragon'), all = db.pool.cards.filter(c => c.kind === 'monster');
  for (const x of mons) { for (const y of all) { if (x.id === y.id) continue; const r = meldPair(db, x.id, y.id); if ((r.kind === 'cross' || r.kind === 'printed') && db.byId.get(r.id).type === 'Dragon') { found = [x, y]; break; } } if (found) break; }
  assert.ok(found, 'a pair that makes a Dragon');
  const late = planChain(lab, [{ id: found[0].id }, { id: found[1].id }, { id: dt.id }], null), early = planChain(lab, [{ id: found[0].id }, { id: dt.id }, { id: found[1].id }], null);
  assert.equal(db.byId.get(late.final.id).type, 'Dragon'); assert.equal(late.final.ba, K.fit, 'attached to the Dragon the meld made');
  assert.equal(early.final.id, late.final.id); assert.equal(early.final.ba, K.off, 'attached before the meld, to a monster that was not a Dragon');
});
test('Equips that differ: each card says what it does, and a kit is not dealt an Equip that fits none of it', () => {
  const lab = { ...db, config: { ...db.config, equipKinds: EQUIP_KINDS }, _pair: new Map() }, K = EQUIP_KINDS;
  assert.equal(shortText(db, C('Legendary Sword').id), 'Your monster +500'); assert.match(rulesText(db, C('Legendary Sword').id), /\+500 ATK and DEF this duel/);
  assert.equal(shortText(lab, C('Legendary Sword').id), `Warrior +${K.fit}, others +${K.off}`); assert.match(rulesText(lab, C('Legendary Sword').id), /on a Warrior, \+300 on any other/);
  assert.match(rulesText(lab, C('Burning Spear').id), /a FIRE monster/); assert.match(rulesText(lab, C('Laser Cannon Armor').id), /an Insect/);
  assert.equal(shortText(lab, C('Axe of Despair').id), 'Your monster +800 ATK'); assert.equal(shortText(lab, C('Raregold Armor').id), 'Your monster +1000 DEF');
  for (const c of db.pool.cards) if (c.kind === 'equip') { assert.ok(shortText(lab, c.id).length <= 34, 'short enough for a card: ' + shortText(lab, c.id)); assert.ok(!/undefined|NaN/.test(rulesText(lab, c.id) + shortText(lab, c.id))); }
  for (const kit of KITS) for (let seed = 1; seed <= 6; seed++) {
    const { deck } = makeKit(lab, Rng.fromSeed(seed), kit); const mons = deck.filter(e => db.isMonster(e.id));
    for (const e of deck) { const q = db.equipOf.get(e.id); if (!q || q.shape) continue; assert.ok(mons.some(m => equipFits(db, e.id, m.id)), `${kit.id}: ${db.byId.get(e.id).name} fits a monster of the kit`); }
  }
});

// ---------- Two builds a run (lever runBuilds, Lab switch `builds`) ----------
test('Two builds a run: off by default; on, a run names two big builds and the same seed deals the same kits', () => {
  assert.equal(labConfig(LAB_DEFAULTS).runBuilds, 0); assert.equal(labConfig({ builds: true }).runBuilds, 2);
  const lab = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, builds: true }) }, _pair: new Map() }, base = { ...db, config: { ...db.config, ...labConfig(LAB_DEFAULTS) }, _pair: new Map() };
  const seen = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const a = newRun(lab, { seed }), b = newRun(base, { seed });
    assert.equal(b.builds, undefined); assert.equal(a.builds.length, 2); assert.ok(a.builds.every(f => BIG_BUILDS.includes(f))); assert.notEqual(a.builds[0], a.builds[1]);
    assert.deepEqual(a.offer, b.offer, 'the kits on offer do not depend on the lever'); assert.deepEqual(a.bossOrder, b.bossOrder);
    assert.deepEqual(newRun(lab, { seed }).builds, a.builds, 'the same seed names the same builds');
    seen.add(a.builds.slice().sort().join('+'));
  }
  assert.ok(seen.size >= 5, 'forty seeds reach most of the six pairs: ' + [...seen].join(' '));
  // a newly unlocked Gift's build is always carried
  for (let seed = 1; seed <= 12; seed++) assert.ok(newRun(lab, { seed, featured: ['snare'] }).builds.includes(LAB.snare.family));
});
// ---------- Traps in every kit (lever kitTraps, with the Free Trap switch) and the depth set ----------
test('Free Trap: every starter kit then holds at least two Traps, still 40 cards inside its weight, and never a wipe or a revive', () => {
  assert.equal(labConfig(LAB_DEFAULTS).kitTraps, 0); assert.equal(labConfig({ ...LAB_DEFAULTS, trap: true }).kitTraps, 2); assert.equal(labConfig({ ...LAB_DEFAULTS, trap: true }).freeCast, 'trap');
  const lab = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, trap: true }) }, _pair: new Map() }, base = { ...db, config: { ...db.config, ...labConfig(LAB_DEFAULTS) }, _pair: new Map() };
  let least = 9, plain = 0, kits = 0;
  for (const forger of [null, ...FORGER_IDS]) for (let seed = 1; seed <= 25; seed++) {
    const run = newRun(lab, { seed, forger });
    for (const k of run.offer) { const traps = k.deck.filter(e => roleOf(lab, e.id) === 'trap'); least = Math.min(least, traps.length); kits++;
      assert.equal(k.deck.length, 40); assert.ok(traps.every(e => !['destroyAll', 'revive'].includes(lab.tagOf.get(e.id).fx)), 'a kit Trap is never a wipe or a revive'); }
    for (const k of newRun(base, { seed, forger }).offer) plain += k.deck.filter(e => roleOf(base, e.id) === 'trap').length;
    runApply(run, { t: 'kit', i: seed % 3 }, lab); assert.ok(deckWeight(lab, run.deck) <= weightCap(lab, run), 'the kit taken is inside the weight limit');
  }
  assert.ok(least >= 2, 'fewest Traps in a kit: ' + least); assert.ok(plain / kits < 2, 'without the switch a kit holds fewer than two Traps on average: ' + (plain / kits).toFixed(2));
});
// ---------- Lone watch (lever loneWatch, off): the duel condition behind the first secret, not yet used by the game ----------
test('Lone watch: with the lever a duel remembers the most monsters each side has had at once; a player who keeps one monster is counted as one; nothing is written without the lever', () => {
  assert.ok(!db.config.loneWatch, 'the lever starts off');
  const on = { ...db, config: { ...db.config, loneWatch: 1 }, _pair: new Map() };
  let duels = 0, loneWins = 0, crowded = 0, plain = 0;
  for (const [d, seeds] of [[on, [1, 2, 3, 4, 5, 6, 7, 8]], [db, [1, 2]]]) for (const seed of seeds) {
    const run = newRun(d, { seed, track: true }); let n = 0, cur = null, seen = [0, 0], lone = false;
    while (run.phase !== 'over' && n++ < 8000) {
      let a = policyAction(d, run, { level: 2 });
      const duel = run.phase === 'duel' ? run.duel : null;
      if (duel && duel !== cur) { cur = duel; seen = [0, 0]; lone = d === on && seed % 2 === 1 && run.rival.tier === 'boss'; }
      if (duel && lone && a.t === 'duel') { const c = chooseAction(d, viewFor(duel, d, 0), 2, { lone: true }); a = { t: 'duel', action: c || { t: 'end' } }; }
      runApply(run, a, d);
      if (!duel) continue;
      for (const seat of [0, 1]) {
        seen[seat] = Math.max(seen[seat], duel.mon[seat].filter(Boolean).length);
        if (d === db) { assert.ok(!('most' in duel.stats[seat]), 'nothing is written without the lever'); continue; }
        const most = duel.stats[seat].most || 0; assert.ok(most >= seen[seat] && most <= 5, 'seed ' + seed + ': most ' + most + ' against ' + seen[seat] + ' seen');
      }
      if (duel.winner !== null && duel === cur) { cur = null; if (d === db) { plain++; continue; } duels++; const most = duel.stats[0].most || 0;
        if (lone) { assert.ok(most <= 1, 'a player who keeps one monster never has two, seed ' + seed); if (duel.winner === 0) loneWins++; } else if (most >= 3) crowded++; }
    }
  }
  assert.ok(duels > 60 && plain > 10 && crowded > 20, 'duels ' + duels + ' plain ' + plain + ' crowded ' + crowded);
  assert.ok(loneWins >= 1, 'the lone player beat a floor guardian at least once in these runs');
});

// ---------- The first secret (lever secretLast, Lab switch `secret`, off): the door that was not there, The Last One ----------
const SECRET_DB = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, secret: true }) }, _pair: new Map() };
test('The first secret: the switch turns on the lone watch and the secret together, and both start off', () => {
  const off = labConfig(LAB_DEFAULTS), on = labConfig({ ...LAB_DEFAULTS, secret: true });
  assert.ok(!off.secretLast && !off.loneWatch); assert.ok(on.secretLast && on.loneWatch);
  assert.ok(!FORGER_IDS.includes('last') && FORGERS.last.hidden, 'the hidden Forger is on no list of Forgers');
});
test('The first secret: a guardian beaten with one monster opens a chamber of two doors, once a run; the way on leads where the run was going; every state is a run the page can store', () => {
  const d = SECRET_DB; let opened = 0, onward = 0, duels = 0, won = 0, lost = 0;
  const step = (run, lone) => runApply(run, policyAction(d, run, { level: 2, lone }), d);
  for (let seed = 1; seed <= 14; seed++) {
    const run = newRun(d, { seed, track: true }); let n = 0, chambers = 0, most = 9;
    while (run.phase !== 'over' && n++ < 9000) {
      assert.equal(runFault(d, run), '', 'seed ' + seed + ' step ' + n);
      const duel = run.phase === 'duel' ? run.duel : null, boss = duel && run.rival.tier === 'boss';
      if (run.phase === 'chamber' && run.doors.some(x => x.type === 'secret')) {
        chambers++; opened++;
        assert.equal(most, 1, 'the door opens only after a guardian fell to one monster, seed ' + seed);
        assert.deepEqual(run.doors.map(x => x.type), ['secret', 'onward']); assert.ok(run.secret.met && !run.secret.due && /door/.test(run.lastNote));
        // the way on: the same floor, chamber and doors the run would have had without the detour (the detour draws nothing)
        const a = clone(run), b = clone(run); delete b.secret.met; runApply(a, { t: 'door', i: 1 }, d); onward++;
        assert.ok(a.phase === 'over' ? a.result.won : a.phase === 'chamber' && !a.doors.some(x => x.type === 'secret' || x.type === 'onward'), 'the way on goes on');
        assert.ok(!a.lastNote || /Second Gate/.test(a.lastNote), 'the line about the door is said once');
        if (a.phase === 'chamber' && !a.secondGate) { assert.equal(a.floor, run.floor + 1); assert.equal(a.chamber, 0); assert.equal(a.seals, 0); }
        // the door itself: a duel against The Last One, who never has two monsters and strikes through defense
        const sparks = run.sparks, fl = run.floor; runApply(run, { t: 'door', i: 0 }, d);
        assert.equal(run.rival.tier, 'secret'); assert.equal(run.rival.name, 'The Last One'); assert.equal(run.duel.seat[1].law, 'alone'); assert.ok(run.duel.seat[1].relics.includes('f_last'));
        const hid = run.duel; let m = 0;
        while (run.phase === 'duel' && m++ < 2000) { step(run, null); assert.ok(hid.mon[1].filter(Boolean).length <= 1, 'The Last One keeps one monster'); }
        duels++;
        if (hid.winner === 0) { won++; assert.equal(run.secret.won, 1); assert.equal(run.sparks, sparks); assert.equal(run.phase, 'reward'); assert.equal(run.offer.kind, 'card'); assert.equal(run.offer.options.length, 3); }
        else { lost++; assert.equal(run.secret.lost, 1); assert.equal(run.sparks, sparks - 1); assert.ok(run.phase === 'over' || (run.phase === 'chamber' && !run.doors.some(x => x.type === 'secret')), 'a lost hidden duel never returns to the door'); if (run.phase === 'chamber' && !run.secondGate) assert.equal(run.floor, fl + 1); }
        continue;
      }
      step(run, 'boss');
      if (boss && duel.winner !== null) most = duel.winner === 0 ? duel.stats[0].most || 0 : 9;
    }
    assert.ok(chambers <= 1, 'once a run, seed ' + seed);
  }
  assert.ok(opened >= 6 && won >= 1 && lost >= 1, JSON.stringify({ opened, onward, duels, won, lost }));
});
test('The first secret: without the switch nothing is written and no door appears, however the player plays; with it, the usual player is told when two were one too many', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const run = newRun(db, { seed, track: true }); let n = 0;
    while (run.phase !== 'over' && n++ < 9000) { runApply(run, policyAction(db, run, { level: 2, lone: 'boss' }), db); assert.ok(!run.secret && !(run.doors || []).some(x => x.type === 'secret')); }
  }
  let near = 0, met = 0;
  for (let seed = 1; seed <= 24; seed++) {
    const run = newRun(SECRET_DB, { seed, track: true }); let n = 0;
    while (run.phase !== 'over' && n++ < 9000) runApply(run, policyAction(SECRET_DB, run, { level: 2 }), SECRET_DB);
    if (run.secret && run.secret.near) near++; if (run.secret && run.secret.met) met++;
  }
  assert.equal(met, 0, 'the usual player never meets the condition in these runs'); assert.ok(near >= 1, 'but comes close in some: ' + near);
});
test('The first secret: beating The Last One opens the hidden Forger in the profile, and a run that only came close or lost opens nothing', () => {
  const over = secret => { const run = newRun(SECRET_DB, { seed: 5, track: true }); run.phase = 'over'; run.result = { won: false, floor: 0, chamber: 2, reason: 'sparks' }; run.stats.duels = 3; if (secret) run.secret = secret; return run; };
  let p = newProfile(); let r = applyRun(p, over({ near: 1 })); assert.ok(!p.forgers.includes('last') && p.loneNear === 1 && !p.loneMet && !r.unlocks.some(u => u.id === 'last'));
  r = applyRun(p, over({ near: 1, met: 1, lost: 1 })); assert.ok(!p.forgers.includes('last') && p.loneMet === 1);
  r = applyRun(p, over({ near: 1, met: 1, won: 1 })); assert.ok(p.forgers.includes('last') && p.lastOne === 1); assert.ok(r.unlocks.some(u => u.kind === 'forger' && u.id === 'last' && u.name === 'The Last One'));
  r = applyRun(p, over({ near: 1, met: 1, won: 1 })); assert.ok(!r.unlocks.some(u => u.id === 'last'), 'unlocked once'); assert.equal(p.forgers.filter(f => f === 'last').length, 1);
  p = newProfile(); applyRun(p, over(null)); assert.ok(!('loneNear' in p) && !('lastOne' in p), 'a run without the secret writes nothing new to the profile');
});
test('The Last One as a Forger: three kits of one strong carrier, Equips and Traps within the weight limit; Sole Remembrance frees one Equip a turn only while one monster stands; The Quiet Door needs exactly one monster', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const run = newRun(db, { seed, forger: 'last' }); assert.equal(run.offer.length, 3);
    for (const k of run.offer) {
      const roles = k.deck.map(e => roleOf(db, e.id)), mons = k.deck.filter(e => db.isMonster(e.id)).map(e => db.byId.get(e.id));
      assert.ok(k.deck.length === 40 && deckWeight(db, k.deck) <= db.config.kitWeight, k.kit + ' over weight');
      assert.ok(roles.filter(x => x === 'equip').length >= 5 && roles.filter(x => x === 'trap').length >= 3, k.kit + ' holds its tools: ' + roles.filter(x => x === 'equip').length + ' Equips, ' + roles.filter(x => x === 'trap').length + ' Traps');
      const strong = mons.filter(c => c.atk > db.config.kit.maxAtk); assert.ok(strong.length >= 1 && strong.length <= 3 && strong.every(c => c.atk <= db.config.kit.maxAtk + 300 && c.level <= db.config.kit.maxLevel), k.kit + ' carriers');
    }
  }
  const eq = db.pool.cards.find(c => roleOf(db, c.id) === 'equip').id, seats = [{ relics: ['f_last'], forger: 'last' }, {}];
  const equip = { t: 'play', hand: [0], onto: null }, hand = s => { s.hand[0].push({ u: uid++, id: eq }, { u: uid++, id: eq }, { u: uid++, id: eq }); };
  let s = blank({ seats }); put(s, 0, 2, mon('Mystical Elf')); hand(s); const a0 = effAtk(s, db, 0, s.mon[0][2]);
  applyMut(s, { ...equip, target: 2 }, db); assert.equal(s.played, false, 'alone, the first Equip of the turn is free'); assert.ok(effAtk(s, db, 0, s.mon[0][2]) > a0 || effDef(s, db, 0, s.mon[0][2]) > 0);
  applyMut(s, { ...equip, target: 2 }, db); assert.equal(s.played, true, 'the second one uses the play');
  s = blank({ seats }); put(s, 0, 2, mon('Mystical Elf')); hand(s);
  applyMut(s, { t: 'play', hand: [0], onto: 2, pos: 'a' }, db); assert.equal(s.played, false, 'joined to the monster on the table, it is free as well');
  applyMut(s, { t: 'play', hand: [0], onto: 2, pos: 'a' }, db); assert.equal(s.played, true);
  s = blank({ seats }); put(s, 0, 1, mon('Mystical Elf')); put(s, 0, 2, mon('Mystical Elf')); hand(s);
  applyMut(s, { ...equip, target: 2 }, db); assert.equal(s.played, true, 'with two monsters an Equip uses the play');
  s = blank({ seats: [{ relics: [] }, {}] }); put(s, 0, 2, mon('Mystical Elf')); hand(s);
  applyMut(s, { ...equip, target: 2 }, db); assert.equal(s.played, true, 'without the rule an Equip uses the play');
  // the power
  s = blank({ seats }); assert.equal(legalActions(s, db).filter(a => a.t === 'power').length, 0, 'no monster, no power');
  put(s, 0, 1, mon('Mystical Elf')); put(s, 0, 2, mon('Mystical Elf')); assert.equal(legalActions(s, db).filter(a => a.t === 'power').length, 0, 'two monsters, no power');
  s.mon[0][1] = null; const m = s.mon[0][2], before = [effAtk(s, db, 0, m), effDef(s, db, 0, m)];
  assert.equal(legalActions(s, db).filter(a => a.t === 'power').length, 1); applyMut(s, { t: 'power' }, db);
  assert.deepEqual([effAtk(s, db, 0, m), effDef(s, db, 0, m)], [before[0] + 400, before[1] + 400]); assert.equal(s.played, false, 'the power does not use the play');
  assert.equal(legalActions(s, db).filter(a => a.t === 'power').length, 0, 'once a duel');
  // a whole run as The Last One, played the lone way, ends without a fault
  for (const seed of [3, 4]) { const run = newRun(db, { seed, forger: 'last', track: true }); let n = 0; while (run.phase !== 'over' && n++ < 9000) { runApply(run, policyAction(db, run, { level: 2, lone: 'last' }), db); assert.equal(runFault(db, run), ''); } assert.equal(run.phase, 'over'); }
});
test('The Last One strikes through defense: its Law makes a destroyed defender cost the difference, and no other rival has it', () => {
  const big = C('Blue-Eyes White Dragon'), elf = C('Mystical Elf');
  for (const [law, pays] of [['alone', true], [null, false]]) {
    const s = blank({ seats: [{}, law ? { law } : {}] }); s.active = 1; put(s, 1, 2, mon('Blue-Eyes White Dragon')); put(s, 0, 2, mon('Mystical Elf', 'd'));
    const lp = s.lp[0]; applyMut(s, { t: 'attack', from: 2, to: 2 }, db);
    assert.equal(s.mon[0][2], null); assert.equal(lp - s.lp[0], pays ? big.atk - elf.def : 0, 'law ' + law);
  }
});

// ---------- Odd Gift at the Bazaar (lever bazaarOdd, Lab switch `odd`, off) ----------
test('Odd Gift at the Bazaar: every Bazaar then sells one marked Gift from outside the run, bought with Embers beyond the Gift count, and nothing changes without the lever', () => {
  assert.equal(labConfig(LAB_DEFAULTS).bazaarOdd, 0); assert.equal(labConfig({ ...LAB_DEFAULTS, odd: true }).bazaarOdd, 70);
  const mk = labs => ({ ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, ...labs }) }, _pair: new Map() });
  const reach = (d, seed, forger) => { const run = newRun(d, { seed, forger, track: true }); let n = 0; while (run.phase !== 'over' && run.phase !== 'bazaar' && n++ < 4000) runApply(run, policyAction(d, run, { level: 2 }), d); return run; };
  for (const [labs, two] of [[{ odd: true, builds: true }, true], [{ odd: true }, false]]) {
    const d = mk(labs); let seen = 0, bought = 0, none = 0;
    for (let seed = 1; seed <= 60 && seen < 12; seed++) {
      const run = reach(d, seed, [null, ...FORGER_IDS][seed % 5]); if (run.phase !== 'bazaar') continue; seen++;
      const odd = run.offer.items.filter(it => it.kind === 'gift'), ALL = { ...RELICS, ...LAB };
      if (!two && !odd.length) { // without Two builds a run there is nothing to sell once the player holds a piece of all four big builds
        const held = new Set([...run.gifts, ...run.charms, ...run.masterworks].flatMap(id => [ALL[id].family, ALL[id].link])); assert.ok(BIG_BUILDS.every(f => held.has(f)), 'no odd Gift only when every big build is held'); none++; continue; }
      assert.equal(odd.length, 1, 'one odd Gift at each Bazaar');
      const it = odd[0], R = { ...RELICS, ...LAB }[it.id]; assert.ok(it.odd && it.price === (run.charms.includes('miser') ? 35 : 70)); assert.equal(R.kind, 'G'); assert.ok(BIG_BUILDS.includes(R.family), 'it belongs to a big build');
      assert.ok(![...run.gifts, ...run.charms, ...run.masterworks].includes(it.id), 'never one already held');
      if (two) { assert.ok(!run.builds.includes(R.family) && !(R.link && run.builds.includes(R.link)), 'its build is not one the run carries: ' + it.id + ' in ' + run.builds); }
      else { const held = new Set([...run.gifts, ...run.charms, ...run.masterworks].flatMap(id => [({ ...RELICS, ...LAB })[id].family, ({ ...RELICS, ...LAB })[id].link])); assert.ok(!held.has(R.family), 'the player holds no piece of its build'); }
      // without the lever the same seed has the same stock, less the odd Gift
      const plain = reach(mk({ ...labs, odd: false }), seed, [null, ...FORGER_IDS][seed % 5]);
      assert.deepEqual(plain.offer.items, run.offer.items.filter(x => x.kind !== 'gift'), 'the rest of the stock is the same without the lever');
      const i = run.offer.items.indexOf(it), gifts = run.gifts.length;
      run.embers = it.price - 1; assert.throws(() => runApply(run, { t: 'buy', i }, d), /not enough Embers/);
      run.embers = it.price + 5; runApply(run, { t: 'buy', i }, d); bought++;
      assert.equal(run.embers, 5); assert.equal(run.gifts.length, gifts + 1); assert.ok(run.gifts.includes(it.id)); assert.ok(run.offer.items[i].sold);
      assert.throws(() => runApply(run, { t: 'buy', i }, d), /nothing to buy there/);
      assert.equal(runFault(d, JSON.parse(JSON.stringify(run))), '', 'the page still takes the run as a save');
      let n = 0; while (run.phase !== 'over' && n++ < 4000) runApply(run, policyAction(d, run, { level: 2 }), d); assert.equal(run.phase, 'over', 'the run plays on to its end with the odd Gift held');
    }
    assert.ok(seen >= 8 && bought === seen - none && bought >= 6 && (!two || !none), 'Bazaars reached: ' + seen + ', bought at ' + bought);
  }
});
test('The depth set is Equips that differ, Two builds a run and Free Trap, and every switch has a place on the home screen', () => {
  const c = labConfig({ ...LAB_DEFAULTS, depth: true });
  assert.deepEqual(DEPTH_SET, ['equips', 'builds', 'trap']); assert.deepEqual(c.equipKinds, EQUIP_KINDS); assert.equal(c.runBuilds, 2); assert.equal(c.freeCast, 'trap'); assert.equal(c.freeCastRival, 'boss'); assert.equal(c.kitTraps, 2);
  const each = labConfig({ ...LAB_DEFAULTS, equips: true, builds: true, trap: true }); assert.deepEqual(c, each, 'the depth set is the three switches, nothing else');
  assert.equal(labConfig({ ...LAB_DEFAULTS, depth: true, free: true }).freeCast, 1, 'Free cast still overrides the free set');
  const src = readFileSync(new URL('../web/app.mjs', import.meta.url), 'utf8'), words = [...src.slice(src.indexOf('const LABS = {'), src.indexOf('};', src.indexOf('const LABS = {'))).matchAll(/^  (\w+): '/gm)].map(m => m[1]);
  assert.ok(words.length >= 19, 'switches with words: ' + words.length);
  for (const k of words) assert.ok(LAB_ORDER.includes(k), 'the switch ' + k + ' has no place in LAB_ORDER'); for (const k of LAB_ORDER) assert.ok(words.includes(k), 'LAB_ORDER names a switch with no words: ' + k);
});
test('Two builds a run: the Veilwalker always carries Ambush, and a Forger or a new Gift never loses its build', () => {
  const lab = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, builds: true }) }, _pair: new Map() };
  assert.equal(FORGERS.veil.build, 'shadow');
  for (let seed = 1; seed <= 30; seed++) {
    const v = newRun(lab, { seed, forger: 'veil' }); assert.equal(v.builds.length, 2); assert.equal(v.builds[0], 'shadow');
    assert.equal(newRun(lab, { seed, forger: 'tarn' }).builds.length, 2); assert.deepEqual(newRun(lab, { seed, forger: 'tarn' }).builds.slice().sort(), newRun(lab, { seed }).builds.slice().sort(), 'a Forger with no build of their own changes nothing');
    // two newly unlocked Gifts of two other builds: the run carries three, so each new Gift can still be shown
    const two = Object.keys(RELICS).concat(Object.keys(LAB)), of = f => two.find(id => ((RELICS[id] || LAB[id]).family === f) && (RELICS[id] || LAB[id]).kind === 'G');
    const w = newRun(lab, { seed, forger: 'veil', featured: [of('storm'), of('tomb')] }); assert.deepEqual(w.builds.slice().sort(), ['shadow', 'storm', 'tomb']);
  }
});
test('Two builds a run: no Gift or charm of a build the run does not carry is offered, over whole runs', () => {
  const lab = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, builds: true, links: true }) }, _pair: new Map() };
  let offers = 0, gifts = 0, charms = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const run = newRun(lab, { seed, heat: 0 }); const carried = run.builds.slice();
    for (let step = 0; step < 100000 && run.phase !== 'over'; step++) {
      const o = run.offer, relicIds = !o ? [] : (o.kind === 'gift' || o.kind === 'charm') ? o.options : run.phase === 'bazaar' && o.items ? o.items.filter(it => it.kind === 'charm').map(it => it.id) : [];
      if (o && o.kind === 'gift') { offers++; assert.ok(o.options.length >= 2, 'an offer still has choices'); }
      for (const id of relicIds) { const r = RELICS[id] || LAB[id]; gifts++; if (r.kind === 'C') charms++; assert.ok(!BIG_BUILDS.includes(r.family) || carried.includes(r.family) || (r.link && carried.includes(r.link)), `seed ${seed}: ${r.name} (${r.family}) offered in a run that carries ${carried.join(' and ')}`); }
      runApply(run, policyAction(lab, run, { family: 'engine_run', level: 2 }), lab);
    }
    assert.deepEqual(run.builds, carried);
  }
  assert.ok(offers >= 12 && gifts >= 36 && charms >= 12, `looked at ${offers} Gift offers and ${charms} charms`);
});

test('every guardian Law, and The Last One\'s, has a line of counsel the page can show in the door, the duel tray and the loss summary', () => {
  for (const law of [...BOSSES.flat().map(b => b.law), LAST_ONE.law]) assert.ok(lawAnswer(law).length > 20, 'no counsel for the Law ' + law);
  assert.ok(whyLost(null, { reason: 'lp' }, { law: 'alone' }).some(l => /defense/.test(l)), 'the loss summary after the hidden duel names its Law');
});

console.log('crucible rules:', passed, 'tests passed');
