// Break-it tests for Lost Memories (codename crucible): random legal play, with invariants
// checked after every action. Run: node crucible/test/test-crucible-fuzz.mjs [duels] [runs]
import assert from 'node:assert/strict';
import { loadDb, roleOf } from '../engine/cards.mjs';
import { newDuel, applyMut, legalActions, viewFor, clone, canonical } from '../engine/duel.mjs';
import { Rng } from '../engine/rng.mjs';
import { RELICS, sortRelics } from '../engine/relics.mjs';
import { newRun, runApply, ENCHANTS, deckWeight, weightCap } from '../engine/run.mjs';
import { policyAction } from '../engine/policy.mjs';

const db = loadDb();
const DUELS = +process.argv[2] || 1500, RUNS = +process.argv[3] || 300;
const all = db.pool.cards.filter(c => c.kind !== 'fusion').map(c => c.id);
const relicIds = Object.keys(RELICS);
const LAWS = [null, 'scorched', 'stonewall', 'bloodprice', 'mist', 'tyranny', 'end'];
const TWISTS = [null, 'fog', 'narrow', 'storm', 'locked'];

function checkDuel(s, tag) {
  const seen = new Set();
  for (let p = 0; p < 2; p++) {
    assert.ok(Number.isInteger(s.lp[p]) && s.lp[p] >= 0, tag + ' lp');
    assert.ok(s.hand[p].length <= db.config.handMax, tag + ' hand over max');
    assert.equal(s.mon[p].length, s.zones, tag + ' zones'); assert.equal(s.traps[p].length, db.config.trapZones);
    for (const c of s.hand[p]) { assert.ok(db.byId.has(c.id)); assert.ok(!seen.has(c.u), tag + ' duplicate uid'); seen.add(c.u); }
    for (const m of s.mon[p]) if (m) {
      assert.ok(db.isMonster(m.id), tag + ' non-monster on the table'); assert.ok(m.pos === 'a' || m.pos === 'd');
      assert.ok(!seen.has(m.u), tag + ' duplicate uid on table'); seen.add(m.u);
      assert.ok((m.ra || 0) <= db.config.relicCap && (m.rd || 0) <= db.config.relicCap, tag + ' relic cap broken');
      for (const k of ['ba', 'bd', 'ra', 'rd']) assert.ok(m[k] === undefined || Number.isInteger(m[k]), tag + ' non-integer bonus');
    }
    for (const t of s.traps[p]) if (t) assert.equal(roleOf(db, t.id), 'trap', tag + ' non-trap set');
    for (const id of s.gy[p]) assert.ok(db.byId.has(id));
  }
  assert.equal(s.winner === null, s.reason === null, tag + ' winner and reason disagree');
  if (s.pending) assert.ok(s.pending.options.length > 0 && s.winner === null);
  assert.ok(s.turn <= db.config.maxTurns + 1);
}

let actions = 0, duelsDone = 0; const reasons = {};
for (let n = 1; n <= DUELS; n++) {
  const r = Rng.fromSeed(n * 7919);
  const deck = () => Array.from({ length: 36 + r.int(5) }, () => { const e = { id: r.pick(all) }; if (r.chance(1, 6)) e.t = 1; if (r.chance(1, 4)) e.e = r.pick(ENCHANTS); if (r.chance(1, 10)) e.b = 1; return e; });
  const rel = () => sortRelics(r.shuffle(relicIds.slice()).slice(0, r.int(10)));
  const s = newDuel(db, { seed: n, decks: [deck(), deck()], twist: r.pick(TWISTS), seats: [{ relics: rel(), secondWind: r.chance(1, 2), underCap: r.int(20), handSize: 4 + r.int(3), firstTurnHand: r.chance(1, 4) ? 6 : 0, homeField: r.pick([...db.fieldOf.keys()]) }, { relics: rel(), law: r.pick(LAWS), ace: r.pick(all.filter(id => db.isMonster(id))) }] });
  let guard = 0;
  while (s.winner === null) {
    const la = legalActions(s, db, { maxChain: 2 });
    assert.ok(la.length > 0, 'no legal action, seed ' + n);
    // every listed action must apply cleanly (sampled, on a copy)
    if (guard % 7 === 0) for (const a of la.slice(0, 12)) { try { applyMut(clone(s), a, db); } catch (e) { throw new Error('listed as legal but threw: ' + JSON.stringify(a) + ' seed ' + n + ' :: ' + e.message); } }
    // some longer chains too, which legalActions does not list at this depth
    let a = r.pick(la);
    if (a.t === 'end' && la.length > 1 && r.chance(3, 4)) a = r.pick(la);
    if (!s.pending && !s.played && !s.attacked && s.hand[s.active].length >= 3 && r.chance(1, 5)) {
      const idx = r.shuffle(s.hand[s.active].map((_, i) => i)).slice(0, 3 + r.int(Math.min(3, s.hand[s.active].length - 2)));
      for (const v of [{ pos: 'a' }, {}]) { try { applyMut(clone(s), { t: 'play', hand: idx, onto: null, ...v }, db); a = { t: 'play', hand: idx, onto: null, ...v }; break; } catch { /* not legal in this shape */ } }
    }
    const before = canonical(viewFor(s, db, 0));
    applyMut(s, a, db); actions++;
    checkDuel(s, 'seed ' + n + ' after ' + JSON.stringify(a));
    assert.ok(typeof before === 'string');
    assert.ok(++guard < 30000, 'duel did not end, seed ' + n);
  }
  reasons[s.reason] = (reasons[s.reason] || 0) + 1; duelsDone++;
  // illegal actions are refused and leave no trace
  const t = newDuel(db, { seed: n, decks: [deck(), deck()] }); const snap = canonical(t);
  for (const bad of [{ t: 'attack', from: 0, to: -1 }, { t: 'play', hand: [9], onto: null, pos: 'a' }, { t: 'play', hand: [0, 0], onto: null, pos: 'a' }, { t: 'pos', zone: 4 }, { t: 'respond', trap: 0 }, { t: 'nope' }, { t: 'play', hand: [], onto: null }]) {
    assert.throws(() => applyMut(clone(t), bad, db), 'should refuse ' + JSON.stringify(bad));
  }
  assert.equal(canonical(t), snap);
}

// Runs played with random choices at every step, including bad ones that must be refused.
function randomRunAction(run, r) {
  switch (run.phase) {
    case 'kit': return r.chance(1, 5) && run.redeal ? { t: 'redeal' } : { t: 'kit', i: r.int(3) };
    case 'charm': return { t: 'pick', i: r.int(run.offer.options.length) };
    case 'chamber': {
      if (run.trunk.length && r.chance(1, 3)) return { t: 'swap', deck: r.int(run.deck.length), trunk: r.int(run.trunk.length) };
      return { t: 'door', i: r.int(run.doors.length) };
    }
    case 'duel': { const d = run.duel; const la = legalActions(d, db, { maxChain: 2 }); let a = r.pick(la); if (a.t === 'end' && r.chance(2, 3)) a = r.pick(la); return { t: 'duel', action: r.chance(1, 3) ? (policyAction(db, run, { level: 1 }).action) : a }; }
    case 'reward': { const o = run.offer; if (r.chance(1, 6)) return { t: 'skip' }; const n = o.options ? o.options.length : 2; return { t: 'pick', i: r.int(Math.max(1, n)) }; }
    case 'anvil': { const k = r.int(6); if (k === 0) return { t: 'leave' }; if (k === 1) return { t: 'anvil', kind: 'temper', deck: r.int(run.deck.length) }; if (k === 2) return { t: 'anvil', kind: 'enchant', deck: r.int(run.deck.length), enchant: r.pick(run.offer.enchants) }; if (k === 3) return { t: 'anvil', kind: 'bind', a: r.int(run.deck.length), b: r.int(run.deck.length) }; if (k === 4 && run.offer.masterworks.length) return { t: 'anvil', kind: 'masterwork', id: run.offer.masterworks[0] }; return { t: 'leave' }; }
    case 'bazaar': return r.chance(1, 3) ? { t: 'leave' } : { t: 'buy', i: r.int(Math.max(1, run.offer.items.length)), trunk: 0 };
  }
  return { t: 'leave' };
}
let refused = 0, runActions = 0, over = { won: 0, lost: 0 };
for (let n = 1; n <= RUNS; n++) {
  const r = Rng.fromSeed(n * 104729);
  const run = newRun(db, { seed: n, heat: r.int(4) });
  let guard = 0;
  while (run.phase !== 'over') {
    const a = randomRunAction(run, r);
    const snap = JSON.stringify(run);
    try { runApply(run, a, db); runActions++; }
    catch (e) {
      // A refusal must be a clean one: a plain message and an untouched run.
      assert.ok(e instanceof Error && !/undefined|not a function|Cannot read/.test(e.message), 'crash, not a refusal: ' + e.stack + ' action ' + JSON.stringify(a) + ' phase ' + run.phase + ' seed ' + n);
      const back = JSON.parse(snap); for (const k of Object.keys(run)) delete run[k]; Object.assign(run, back);
      refused++;
    }
    assert.ok(run.sparks >= 0 && run.embers >= 0, 'negative Sparks or Embers, seed ' + n);
    assert.ok(run.charms.length <= db.config.charmSlots && run.masterworks.length <= db.config.maxMasterworks && run.binds <= db.config.maxBinds);
    if (run.kit) assert.equal(run.deck.length, 40 - run.binds, 'deck size, seed ' + n);
    if (run.phase === 'chamber') assert.ok(deckWeight(db, run.deck) <= weightCap(db, run), 'deck over the cap, seed ' + n);
    if (run.duel) checkDuel(run.duel, 'run seed ' + n);
    assert.ok(++guard < 400000, 'run did not end, seed ' + n + ' phase ' + run.phase);
  }
  over[run.result.won ? 'won' : 'lost']++;
}
console.log('crucible fuzz:', { duels: duelsDone, actions, reasons, runs: RUNS, runActions, refused, over });
