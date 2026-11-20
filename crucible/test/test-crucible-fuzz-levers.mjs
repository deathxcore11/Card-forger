// Break-it tests with the Lab levers on (Lost Memories, codename crucible). The plain fuzz file plays the
// shipped rules only; this one builds the card database again with every experiment switched on, alone and
// together, and plays random duels and whole runs at every Heat level with invariants checked after each step.
// Run: node crucible/test/test-crucible-fuzz-levers.mjs [duels per set] [runs per set] [first seed]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDb, roleOf } from '../engine/cards.mjs';
import { newDuel, applyMut, legalActions, viewFor, clone, canonical, effAtk, effDef } from '../engine/duel.mjs';
import { Rng } from '../engine/rng.mjs';
import { RELICS, LAB, sortRelics } from '../engine/relics.mjs';
import { newRun, runApply, ENCHANTS, deckWeight, weightCap, KITS } from '../engine/run.mjs';
import { FORGERS } from '../engine/forgers.mjs';
import { policyAction } from '../engine/policy.mjs';
import { newProfile, applyRun, buy, lockedRelics, maxHeat, VAULT, VAULT_ENCHANTS, LONG_GIFTS, featList, runOptions, openKits, openEnchants } from '../engine/meta.mjs';

const read = f => JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url), 'utf8'));
const POOL = read('crucible-pool.json'), TAGS = read('crucible-spell-tags.json'), BASE = read('crucible-config.json');
const LABPOOL = Object.keys(LAB);
const FIVE = { giftXpScale: 2, labPool: LABPOOL, bossAces: 1, endTurns: 6, bossBand: [0, 0, -300], rivalBand: [0, -200, -400] };
const SETS = {
  plain: {},
  five: { ...FIVE, leanOffers: 1, giftRerolls: 1 },
  page: { ...FIVE, leanOffers: 1, giftRerolls: 1, heatRules: 1, kitTune: 1, itemTune: 1 },
  pageStyles: { ...FIVE, leanOffers: 1, giftRerolls: 1, heatRules: 1, kitTune: 1, itemTune: 1, rivalStyles: 1 },
  all: { ...FIVE, leanOffers: 1, giftRerolls: 2, heatRules: 1, kitTune: 1, rivalStyles: 1, freeCast: 'trap', freeCastRival: 'boss', soloArrival: 1, stormTune: 1, forgerTune: { tarnStoke: 100, scrapDraw: 1, veilSet: 2 }, trackFx: 1 },
  free: { ...FIVE, freeCast: 'all', soloArrival: 1, veilGuard: 1, rivalStyles: 1, heatRules: 1, forgerTune: { veilSet: 1 } },
  freeElite: { ...FIVE, freeCast: 'all', freeCastRival: 'elite', heatRules: 1, kitTune: 1, leanOffers: 1, forgerTune: { veilSet: 2, veilMinDef: 1 } },
  bible: { drawPerTurn: 0, heatRules: 1, rivalStyles: 1, labPool: LABPOOL },
};
const DUELS = +process.argv[2] || 300, RUNS = +process.argv[3] || 60, SEED0 = +process.argv[4] || 1;
const relicIds = [...Object.keys(RELICS), ...Object.keys(LAB)];
const LAWS = [null, 'scorched', 'stonewall', 'bloodprice', 'mist', 'tyranny', 'end'];
const TWISTS = [null, 'fog', 'narrow', 'storm', 'locked'];
const FORGER_IDS = [null, ...Object.keys(FORGERS)];
const KIT_IDS = [...KITS, ...Object.values(FORGERS).flatMap(f => f.kits)].map(k => k.id);

function checkDuel(db, s, tag) {
  const seen = new Set();
  for (let p = 0; p < 2; p++) {
    assert.ok(Number.isInteger(s.lp[p]) && s.lp[p] >= 0, tag + ' lp');
    assert.ok(s.hand[p].length <= db.config.handMax, tag + ' hand over max');
    assert.equal(s.mon[p].length, s.zones, tag + ' zones'); assert.equal(s.traps[p].length, db.config.trapZones);
    for (const c of s.deck[p]) { assert.ok(db.byId.has(c.id), tag + ' unknown card in deck'); if (c.u !== undefined) { assert.ok(!seen.has(c.u), tag + ' duplicate uid in deck'); seen.add(c.u); } }
    for (const c of s.hand[p]) { assert.ok(db.byId.has(c.id)); assert.ok(!seen.has(c.u), tag + ' duplicate uid'); seen.add(c.u); }
    for (const m of s.mon[p]) if (m) {
      assert.ok(db.isMonster(m.id), tag + ' non-monster on the table'); assert.ok(m.pos === 'a' || m.pos === 'd');
      assert.ok(!seen.has(m.u), tag + ' duplicate uid on table'); seen.add(m.u);
      assert.ok((m.ra || 0) <= db.config.relicCap && (m.rd || 0) <= db.config.relicCap, tag + ' relic cap broken');
      for (const k of ['ba', 'bd', 'ra', 'rd']) assert.ok(m[k] === undefined || Number.isInteger(m[k]), tag + ' non-integer bonus');
      const ea = effAtk(s, db, p, m), ed = effDef(s, db, p, m);
      assert.ok(Number.isInteger(ea) && ea >= 0 && Number.isInteger(ed) && ed >= 0, tag + ' bad shown ATK or DEF ' + ea + '/' + ed);
    }
    for (const t of s.traps[p]) if (t) assert.equal(roleOf(db, t.id), 'trap', tag + ' non-trap set');
    for (const id of s.gy[p]) assert.ok(db.byId.has(id), tag + ' unknown card in graveyard');
  }
  assert.equal(s.winner === null, s.reason === null, tag + ' winner and reason disagree');
  if (s.pending) assert.ok(s.pending.options.length > 0 && s.winner === null, tag + ' empty prompt');
  assert.ok(s.turn <= db.config.maxTurns + 1, tag + ' past the last turn');
}

const totals = {}, dirty = {};
function wild(s, r) {
  const z = () => r.int(8) - 1, h = () => r.int(8) - 1;
  switch (r.int(9)) {
    case 0: return { t: 'attack', from: z(), to: z() };
    case 1: return { t: 'pos', zone: z() };
    case 2: return { t: 'respond', trap: z() };
    case 3: return { t: 'power', zone: z() };
    case 4: return { t: 'play', hand: Array.from({ length: 1 + r.int(4) }, h), onto: r.chance(1, 2) ? null : z(), pos: r.pick(['a', 'd', 'x', undefined]), veiled: r.chance(1, 2) };
    case 5: return { t: 'discard', hand: h() };
    case 6: return { t: 'cleanDraw', hand: h() };
    case 7: return { t: 'play', hand: [h()], onto: null, pos: r.pick(['a', 'd']), veiled: r.chance(1, 2), target: z() };
    default: return { t: r.pick(['end', 'nope', undefined, 'respond']) };
  }
}
function duelFuzz(name, db) {
  const all = db.pool.cards.filter(c => c.kind !== 'fusion').map(c => c.id), mons = all.filter(id => db.isMonster(id)), fields = [...db.fieldOf.keys()];
  let actions = 0; const reasons = {};
  for (let n = SEED0; n < SEED0 + DUELS; n++) {
    const r = Rng.fromSeed(n * 7919 + name.length);
    const deck = () => Array.from({ length: 36 + r.int(5) }, () => { const e = { id: r.pick(all) }; if (r.chance(1, 6)) e.t = 1; if (r.chance(1, 4)) e.e = r.pick(ENCHANTS); if (r.chance(1, 10)) e.b = 1; return e; });
    const rel = () => sortRelics(r.shuffle(relicIds.slice()).slice(0, r.int(12)));
    const seat0 = { forger: r.pick(FORGER_IDS), relics: rel(), secondWind: r.chance(1, 2), underCap: r.int(20), handSize: 4 + r.int(3), firstTurnHand: r.chance(1, 4) ? 6 : 0, homeField: r.pick(fields), sparks: 1 + r.int(3), ...(r.chance(1, 2) ? { track: 1 } : {}) };
    const seat1 = { relics: rel(), law: r.pick(LAWS), ace: r.pick(mons), ...(r.chance(1, 3) ? { strong: 1 } : {}), ...(r.chance(1, 3) ? { noFree: 1 } : {}), ...(r.chance(1, 4) ? { handSize: 4 + r.int(3) } : {}), ...(r.chance(1, 4) ? { homeField: r.pick(fields) } : {}), ...(r.chance(1, 8) ? { forger: r.pick(FORGER_IDS) } : {}) };
    const s = newDuel(db, { seed: n, decks: [deck(), deck()], twist: r.pick(TWISTS), seats: [seat0, seat1] });
    const tag0 = name + ' seed ' + n;
    let guard = 0;
    while (s.winner === null) {
      // wild actions, as a broken or hostile page might send: each is either a legal move or a clean refusal
      if (guard % 3 === 0) for (let k = 0; k < 4 && s.winner === null; k++) {
        const w = wild(s, r), before = canonical(s);
        try { applyMut(s, w, db); checkDuel(db, s, tag0 + ' after wild ' + JSON.stringify(w)); }
        catch (e) {
          assert.ok(e instanceof Error && !(e instanceof TypeError) && !(e instanceof RangeError) && !/not a function|Cannot read|NaN/.test(e.message), 'crash on a wild action ' + JSON.stringify(w) + ' ' + tag0 + ' :: ' + e.stack);
          assert.ok(canonical(s) === before, 'a refused action changed the duel: ' + JSON.stringify(w) + ' (' + e.message + ') ' + tag0);
        }
      }
      if (s.winner !== null) break;
      const la = legalActions(s, db, { maxChain: 2 });
      assert.ok(la.length > 0, 'no legal action, ' + tag0);
      if (guard % 7 === 0) for (const a of la.slice(0, 12)) { try { applyMut(clone(s), a, db); } catch (e) { throw new Error('listed as legal but threw: ' + JSON.stringify(a) + ' ' + tag0 + ' :: ' + e.stack); } }
      let a = r.pick(la);
      if (a.t === 'end' && la.length > 1 && r.chance(3, 4)) a = r.pick(la);
      if (!s.pending && !s.attacked && s.hand[s.active].length >= 3 && r.chance(1, 5)) {
        const idx = r.shuffle(s.hand[s.active].map((_, i) => i)).slice(0, 3 + r.int(Math.min(3, s.hand[s.active].length - 2)));
        for (const v of [{ pos: 'a' }, {}, { pos: 'd', veiled: true }]) { try { applyMut(clone(s), { t: 'play', hand: idx, onto: null, ...v }, db); a = { t: 'play', hand: idx, onto: null, ...v }; break; } catch { /* not legal in this shape */ } }
      }
      // the same action on a copy must give the same state (no hidden state outside the duel)
      if (guard % 11 === 0) { const c1 = clone(s), c2 = clone(s); applyMut(c1, a, db); applyMut(c2, a, db); assert.equal(canonical(c1), canonical(c2), 'same action, different result, ' + tag0); }
      viewFor(s, db, 0); viewFor(s, db, 1);
      const lp0 = s.lp.slice(), sw0 = [0, 1].map(p => s.seat[p].rs.secondWind || 0); let evs;
      try { evs = applyMut(s, a, db); } catch (e) { throw new Error('threw on ' + JSON.stringify(a) + ' ' + tag0 + ' :: ' + e.stack); }
      actions++;
      // what the page shows comes from the events: every Life Point change must be announced
      assert.ok(Array.isArray(evs), 'no event list, ' + tag0);
      for (let p = 0; p < 2; p++) if (s.lp[p] > 0 && (s.seat[p].rs.secondWind || 0) === sw0[p]) { const told = evs.filter(e => e.e === 'lp' && e.seat === p).reduce((n, e) => n + e.d, 0); assert.equal(lp0[p] + told, s.lp[p], 'Life Points moved without an event, seat ' + p + ' ' + tag0 + ' after ' + JSON.stringify(a) + ' events ' + JSON.stringify(evs.filter(e => e.e === 'lp' || e.e === 'relic'))); }
      for (const e of evs) assert.ok(e && typeof e.e === 'string', 'bad event, ' + tag0);
      checkDuel(db, s, tag0 + ' after ' + JSON.stringify(a));
      assert.ok(++guard < 30000, 'duel did not end, ' + tag0);
    }
    reasons[s.reason] = (reasons[s.reason] || 0) + 1;
  }
  return { actions, reasons };
}

let wildRefused = 0;
function wildRun(run, r) {
  const n = () => r.int(46) - 3, i = () => r.int(7) - 1;
  switch (r.int(14)) {
    case 0: return { t: 'kit', i: i() };
    case 1: return { t: 'redeal' };
    case 2: return { t: 'pick', i: i() };
    case 3: return { t: 'skip' };
    case 4: return { t: 'reroll' };
    case 5: return { t: 'door', i: i() };
    case 6: return { t: 'swap', deck: n(), trunk: n() };
    case 7: return { t: 'anvil', kind: r.pick(['temper', 'enchant', 'bind', 'masterwork', 'melt', undefined]), deck: n(), a: n(), b: n(), enchant: r.pick([...ENCHANTS, 'nope', undefined]), id: r.pick(['living_furnace', 'unseen_hand', 'signature', 'whetstone', 'nope']) };
    case 8: return { t: 'buy', i: i(), trunk: n() };
    case 9: return { t: 'leave' };
    case 10: return { t: 'duel', action: wild(run.duel || { }, r) };
    case 11: return { t: 'duel' };
    case 12: return { t: r.pick(['see', 'peek', 'pay', 'omen', 'nope', undefined]), i: i() };
    default: return { t: 'pick', i: i(), deck: n(), trunk: n() };
  }
}
function chaosAction(db, run, r) {
  switch (run.phase) {
    case 'kit': return r.chance(1, 5) && run.redeal ? { t: 'redeal' } : { t: 'kit', i: r.int(3) };
    case 'charm': return { t: 'pick', i: r.int(run.offer.options.length) };
    case 'chamber': {
      if (run.trunk.length && r.chance(1, 3)) return { t: 'swap', deck: r.int(run.deck.length), trunk: r.int(run.trunk.length) };
      return { t: 'door', i: r.int(run.doors.length + (r.chance(1, 20) ? 1 : 0)) };
    }
    case 'duel': { const la = legalActions(run.duel, db, { maxChain: 2 }); let a = r.pick(la); if (a.t === 'end' && r.chance(2, 3)) a = r.pick(la); return { t: 'duel', action: a }; }
    case 'reward': { const o = run.offer; if (r.chance(1, 8)) return { t: 'skip' }; if (r.chance(1, 5)) return { t: 'reroll' }; const n = o.options ? o.options.length : 2; return { t: 'pick', i: r.int(Math.max(1, n)) }; }
    case 'anvil': { const k = r.int(6); if (k === 0) return { t: 'leave' }; if (k === 1) return { t: 'anvil', kind: 'temper', deck: r.int(run.deck.length) }; if (k === 2) return { t: 'anvil', kind: 'enchant', deck: r.int(run.deck.length), enchant: r.pick(run.offer.enchants) }; if (k === 3) return { t: 'anvil', kind: 'bind', a: r.int(run.deck.length), b: r.int(run.deck.length) }; if (k === 4 && run.offer.masterworks.length) return { t: 'anvil', kind: 'masterwork', id: run.offer.masterworks[0] }; return { t: 'leave' }; }
    case 'bazaar': return r.chance(1, 3) ? { t: 'leave' } : { t: 'buy', i: r.int(Math.max(1, run.offer.items.length)), trunk: 0 };
  }
  return { t: 'leave' };
}

function runFuzz(name, cfg) {
  let refused = 0, acts = 0, deepest = 0; wildRefused = 0; const over = { won: 0, lost: 0 }, floors = [0, 0, 0], heats = {};
  for (let n = SEED0; n < SEED0 + RUNS; n++) {
    const r = Rng.fromSeed(n * 104729 + name.length);
    // a kit forced now and then, so every kit is played under the levers
    let db = r.chance(1, 3) ? buildDb(POOL, TAGS, { ...BASE, ...cfg, testKit: r.pick(KIT_IDS) }) : DBS[name];
    // one run in five changes its rules part-way, as an old saved run does when the Lab switches are changed before Continue
    const swapAt = r.chance(1, 5) ? 5 + r.int(400) : -1, swapTo = r.pick(Object.keys(SETS));
    const heat = r.int(11), forger = r.pick(FORGER_IDS), fam = r.pick(['neutral', 'storm', 'tomb', 'shadow', 'furnace']);
    // three kinds of player: all random, a strong player who slips now and then, and a strong player throughout
    const kind = r.pick(['chaos', 'slips', 'slips', 'expert']), slip = kind === 'chaos' ? 100 : kind === 'slips' ? 4 : 0;
    const opts = { seed: n, heat, forger, locked: r.chance(1, 3) ? ['tomb_bell', 'glass_idol', 'living_furnace', 'signature'] : null, track: r.chance(2, 3), featured: r.chance(1, 2) ? r.shuffle(LABPOOL.slice()).slice(0, 2) : null };
    let run = newRun(db, opts);
    const tag = name + ' run seed ' + n + ' heat ' + heat + ' forger ' + forger + ' ' + kind + ' ' + fam + (db.config.testKit ? ' kit ' + db.config.testKit : '') + (swapAt >= 0 ? ' rules change to ' + swapTo + ' at step ' + swapAt : '');
    let guard = 0;
    while (run.phase !== 'over') {
      if (guard === swapAt) db = DBS[swapTo];
      let a;
      try { a = r.int(100) < slip ? chaosAction(db, run, r) : policyAction(db, run, { family: fam, level: 2 }); } catch (e) { throw new Error('player model threw, ' + tag + ' phase ' + run.phase + ' :: ' + e.stack); }
      assert.ok(a, 'no action offered, ' + tag + ' phase ' + run.phase);
      const snap = JSON.stringify(run);
      // wild actions on a copy: any action in any phase is either accepted or refused without a trace
      if (guard % 3 === 0) for (let k = 0; k < 3; k++) {
        const c = JSON.parse(snap), w = wildRun(run, r);
        try { runApply(c, w, db); }
        catch (e) {
          assert.ok(e instanceof Error && !(e instanceof TypeError) && !(e instanceof RangeError) && !/not a function|Cannot read|is not iterable|NaN/.test(e.message), 'crash on a wild run action ' + JSON.stringify(w) + ' phase ' + run.phase + ' ' + tag + ' :: ' + e.stack);
          assert.ok(JSON.stringify(c) === snap, 'a refused action changed the run: ' + JSON.stringify(w) + ' (' + e.message + ') phase ' + run.phase + ' ' + tag);
          wildRefused++;
        }
      }
      try { runApply(run, a, db); acts++; }
      catch (e) {
        assert.ok(e instanceof Error && !/undefined|not a function|Cannot read|is not iterable|NaN/.test(e.message), 'crash, not a refusal: ' + e.stack + ' action ' + JSON.stringify(a) + ' phase ' + run.phase + ' ' + tag);
        assert.ok(slip > 0 && kind !== 'expert', 'the scripted player was refused: ' + e.message + ' action ' + JSON.stringify(a) + ' phase ' + run.phase + ' ' + tag);
        // the page applies an action to the live run, so a refused one must leave no trace at all
        if (JSON.stringify(run) !== snap) { dirty[e.message + ' <' + a.t + (a.kind ? ':' + a.kind : '') + '> in ' + run.phase] = (dirty[e.message + ' <' + a.t + (a.kind ? ':' + a.kind : '') + '> in ' + run.phase] || 0) + 1; if (!process.env.DIRTY_OK) assert.fail('a refused action changed the run: ' + e.message + ' action ' + JSON.stringify(a) + ' phase ' + run.phase + ' ' + tag); }
        run = JSON.parse(snap); refused++;
      }
      // a saved game is the run as JSON: reading it back must change nothing
      if (guard % 97 === 0) { const txt = JSON.stringify(run); const back = JSON.parse(txt); assert.equal(JSON.stringify(back), txt); run = back; }
      assert.ok(run.sparks >= 0 && run.embers >= 0 && Number.isInteger(run.embers), 'bad Sparks or Embers, ' + tag);
      assert.ok(run.charms.length <= db.config.charmSlots && run.masterworks.length <= db.config.maxMasterworks && run.binds <= db.config.maxBinds, tag + ' over a limit');
      assert.equal(new Set(run.gifts).size, run.gifts.length, 'the same Gift twice, ' + tag);
      assert.equal(new Set(run.charms).size, run.charms.length, 'the same Charm twice, ' + tag);
      if (run.kit) assert.equal(run.deck.length, 40 - run.binds, 'deck size, ' + tag);
      if (run.phase === 'chamber') { assert.ok(deckWeight(db, run.deck) <= weightCap(db, run), 'deck over the cap, ' + tag); assert.ok(run.doors.length > 0, 'no doors, ' + tag); }
      if (run.phase === 'reward') { const o = run.offer; assert.ok(o, 'reward with no offer, ' + tag); if (o.options) { assert.ok(o.options.length > 0, 'empty offer, ' + tag); for (const x of o.options) assert.ok(x !== undefined && x !== null, 'hole in an offer, ' + tag); } if (o.kind === 'gift') { assert.equal(new Set(o.options).size, o.options.length, 'the same Gift twice in one offer, ' + tag); for (const id of o.options) assert.ok(!run.gifts.includes(id), 'offered a Gift already held, ' + tag); } }
      for (const e of run.deck.concat(run.trunk)) assert.ok(db.byId.has(e.id), 'unknown card in the deck, ' + tag);
      if (run.duel) checkDuel(db, run.duel, tag);
      deepest = Math.max(deepest, run.floor);
      assert.ok(++guard < 400000, 'run did not end, ' + tag + ' phase ' + run.phase);
    }
    assert.ok(run.result && typeof run.result.won === 'boolean', 'no result, ' + tag);
    over[run.result.won ? 'won' : 'lost']++; floors[Math.min(2, run.floor)]++; if (run.result.won) heats[heat] = (heats[heat] || 0) + 1;
    // the same seed and the same choices give the same run
    if (kind === 'expert' && n % 5 === 0 && swapAt < 0) { const twin = newRun(db, opts); let g = 0; while (twin.phase !== 'over' && g++ < 400000) runApply(twin, policyAction(db, twin, { family: fam, level: 2 }), db); assert.equal(JSON.stringify(twin.result), JSON.stringify(run.result), 'saved and unsaved runs ended differently, ' + tag); }
  }
  return { acts, refused, wildRefused, over, floors, wonAtHeat: heats };
}

// Profiles: many runs banked one after another, with Vault purchases between them. Every second profile walks the long road.
function profileFuzz(db0, count, runsEach) {
  let banked = 0, bought = 0, topHeat = 0, kits = 0;
  const dbLong = { ...db0, config: { ...db0.config, labPool: (db0.config.labPool || []).concat(LONG_GIFTS) }, _pair: new Map() };
  for (let n = 1; n <= count; n++) {
    const r = Rng.fromSeed(n * 31337 + SEED0), p = newProfile(), long = n % 2 === 0, db = long ? dbLong : db0;
    const SHOP = VAULT.map(v => ({ ...v, key: v.id })).concat(long ? VAULT_ENCHANTS : []);
    for (let k = 0; k < runsEach; k++) {
      const forger = r.pick(p.forgers), heat = r.int(maxHeat(p) + 1), featured = (p.fresh || []).slice();
      const run = newRun(db, { seed: n * 1000 + k + SEED0, heat, forger, ...runOptions(p, forger, long), featured });
      if (long) { const open = openKits(p, forger); assert.ok(open.length >= 1 && run.offer.length === 3 && run.offer.every(o => open.includes(o.kit)), 'a locked kit was dealt'); if (open.length === 3) assert.equal(new Set(run.offer.map(o => o.kit)).size, 3); }
      const fam = r.pick(['neutral', 'storm', 'tomb', 'shadow', 'furnace']); let g = 0;
      while (run.phase !== 'over') {
        if (run.phase === 'reward' && run.offer.fresh) { assert.ok(p.fresh.includes(run.offer.fresh), 'a Gift marked NEW that is not new'); p.fresh = p.fresh.filter(x => x !== run.offer.fresh); }
        for (const id of run.gifts.concat(run.charms, run.masterworks)) assert.ok(!lockedRelics(p, long).includes(id) || run.masterworks.includes(id), 'a locked relic was gained: ' + id);
        if (long && run.phase === 'anvil') assert.ok(run.offer.enchants.every(e => openEnchants(p).includes(e)), 'a locked Enchant was offered');
        if (long && run.phase === 'kit') assert.ok(run.offer.every(o => openKits(p, forger).includes(o.kit)), 'a locked kit was dealt again');
        runApply(run, policyAction(db, run, { family: fam, level: r.chance(1, 4) ? 0 : 2 }), db); assert.ok(++g < 400000);
      }
      const before = JSON.parse(JSON.stringify(p)), got = applyRun(p, run, { long }); banked++; kits += got.unlocks.filter(u => u.kind === 'kit').length;
      assert.equal(p.byForger[forger].runs, ((before.byForger || {})[forger] || { runs: 0 }).runs + 1); assert.ok(p.byForger[forger].heat <= p.heatCleared && openKits(p, forger).length <= 3, 'a Forger record above the shared Heat');
      for (const u of got.unlocks) if (u.kind === 'kit') assert.ok(long && openKits(p, forger).includes(u.id), 'a kit unlock that is not open');
      if (!long) assert.ok(!got.unlocks.some(u => u.kind === 'kit' || u.kind === 'record' || u.forger), 'long road unlocks with the switch off');
      for (const u of got.unlocks) if (u.kind === 'record') assert.equal(p.byForger[u.forger].heat, u.id);
      assert.ok(Number.isInteger(p.memories) && p.memories >= before.memories && got.total >= 0, 'Memories went wrong');
      assert.equal(p.memories - before.memories, got.total); assert.equal(got.lines.reduce((x, l) => x + l[1], 0), got.total, 'the lines do not add up to the total');
      for (const key of ['forgers', 'bought', 'codex', 'featsDone']) assert.equal(new Set(p[key]).size, p[key].length, key + ' holds something twice');
      assert.ok(p.heatCleared <= 10 && maxHeat(p) <= 10 && p.heatCleared >= before.heatCleared);
      for (const f of featList(long)) assert.ok((p.feats[f.id] || 0) <= f.goal && (p.feats[f.id] || 0) >= (before.feats[f.id] || 0), 'feat count went wrong');
      for (const u of got.unlocks) assert.ok(u.name && u.text, 'an unlock with no name or text');
      assert.throws(() => applyRun(p, newRun(db, { seed: 1 })), /not over/);
      for (const v of r.shuffle(SHOP.slice())) { if (p.memories >= v.price && !p.bought.includes(v.key) && r.chance(1, 2)) { buy(p, v.key); bought++; assert.ok(p.memories >= 0); assert.throws(() => buy(p, v.key), /already/); } else if (p.memories < v.price && !p.bought.includes(v.key)) assert.throws(() => buy(p, v.key), /not enough/); }
      assert.equal(openEnchants(p).length, 6 + p.bought.filter(b => b.startsWith('ench:')).length);
      topHeat = Math.max(topHeat, p.heatCleared);
    }
  }
  return { profiles: count, banked, bought, topHeat, kitsOpened: kits };
}

const DBS = {};
for (const [name, cfg] of Object.entries(SETS)) DBS[name] = buildDb(POOL, TAGS, { ...BASE, ...cfg });
const only = process.env.SETS ? process.env.SETS.split(',') : Object.keys(SETS);
for (const name of only) {
  const d = DUELS ? duelFuzz(name, DBS[name]) : null;
  const rr = RUNS ? runFuzz(name, SETS[name]) : null;
  totals[name] = { duel: d, run: rr };
  console.log(name, JSON.stringify(totals[name]));
}
if (+process.env.PROFILES !== 0) console.log('profiles', JSON.stringify(profileFuzz(DBS.page, +process.env.PROFILES || 6, 25)));
if (Object.keys(dirty).length) console.log('refused actions that changed the run:', dirty);
console.log('crucible lever fuzz: no faults in', only.length, 'sets,', DUELS, 'duels and', RUNS, 'runs each, from seed', SEED0);
