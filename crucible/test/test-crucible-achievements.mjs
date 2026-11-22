// Achievement tests for Lost Memories (codename crucible): every one of the 68 rows is earned, none twice, none from a
// duel reloaded part-way, no Rumours row with the switch off, each meta only once its parts are in, and the golden
// fixtures replay as before. Run: node crucible/test/test-crucible-achievements.mjs [real-play runs = 24]
// Most rows are earned by the engine's own actions (runApply through achRunApply) from a run put in front of the right
// door; where a long career would be needed the profile is given the numbers first, and where only the rival can make
// the move (an attack into a Trap or a defender) the test makes the rival's move with the duel's own applyMut.
// Card stats are read from the pool; no card is named here.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { loadDb, roleOf, meldPair, codexKey, codexResult } from '../engine/cards.mjs';
import { newDuel, applyMut, planChain, effAtk, effDef } from '../engine/duel.mjs';
import { MASTERWORKS } from '../engine/relics.mjs';
import { newRun, runApply, BOSSES } from '../engine/run.mjs';
import { policyAction } from '../engine/policy.mjs';
import { newProfile, applyRun, buy, VAULT, runOptions, maxHeat } from '../engine/meta.mjs';
import { Rng } from '../engine/rng.mjs';
import { ACH, ACH_BY_ID, ACH_GROUPS, achList, achCheck, achProgress, achView, achRunApply } from '../engine/achievements.mjs';
import { labConfig, LAB_DEFAULTS } from '../web/labs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const db = loadDb(); // the Rumours switch is off in the config file
const SDB = { ...db, config: { ...db.config, secretLast: 1, loneWatch: 1 }, _pair: new Map() }; // the Rumours switch on
const LDB = { ...db, config: { ...db.config, ...labConfig({ ...LAB_DEFAULTS, secret: true }) }, _pair: new Map() }; // the page's own switches, Rumours on
const REAL_RUNS = +process.argv[2] || 24;
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.error('FAIL', name); throw e; } };
const everEarned = new Map(); // id -> the first test that earned it
const SECRET = ACH.filter(r => r.needs === 'secret').map(r => r.id);

// ---------- cards from the pool, found by what they do ----------
const cards = db.pool.cards.filter(c => c.kind !== 'fusion'), mons = cards.filter(c => db.isMonster(c.id));
const byAtk = mons.slice().sort((a, b) => a.atk - b.atk || a.id - b.id);
const WEAK = byAtk[0].id, MID = byAtk[Math.floor(byAtk.length / 2)].id, STRONG = byAtk[byAtk.length - 1].id;
const spellOf = (fx, ok = () => true) => cards.find(c => roleOf(db, c.id) === 'spell' && db.tagOf.get(c.id).fx === fx && ok(db.tagOf.get(c.id))).id;
const BURN = spellOf('burn', t => t.n > 0), BURN_N = db.tagOf.get(BURN).n, DESTROY = spellOf('destroy');
const FIELD = cards.find(c => roleOf(db, c.id) === 'field').id, EQUIP = cards.find(c => roleOf(db, c.id) === 'equip').id;
const WEAKEN_TRAP = cards.find(c => roleOf(db, c.id) === 'trap' && db.tagOf.get(c.id).fx === 'weaken').id;
const fuse = (a, b) => { const r = meldPair(db, a, b); return r.kind === 'printed' || r.kind === 'cross' ? r.id : null; };
const PAIR = (() => { for (const a of byAtk) for (const b of byAtk) if (a.id !== b.id && meldPair(db, a.id, b.id).kind === 'cross') return [a.id, b.id]; })();
const PRINTED = (() => { for (const k of db.recipes.keys()) { const m = k.split('+').map(Number); if (m.length !== 2 || m.some(x => !db.byId.has(x) || db.byId.get(x).kind === 'fusion')) continue; if (meldPair(db, m[0], m[1]).kind === 'printed') return m; if (meldPair(db, m[1], m[0]).kind === 'printed') return [m[1], m[0]]; } })();
const FIRE_MON = byAtk.find(c => c.attr === 'FIRE').id;
// A play of `len` different monsters in which every card fuses, checked with the duel's own planner.
function fuseChain(len) {
  const ids = byAtk.map(c => c.id), every = list => planChain(db, list.map(id => ({ id })), null).steps.every(x => x.kind === 'printed' || x.kind === 'cross');
  const dfs = (cur, used) => { if (used.length === len) return every(used) ? used : null; for (const b of ids) { if (used.includes(b)) continue; const r = fuse(cur, b); if (r != null) { const out = dfs(r, used.concat(b)); if (out) return out; } } return null; };
  for (const a of ids) for (const b of ids) { if (a === b) continue; const r = fuse(a, b); if (r != null) { const out = dfs(r, [a, b]); if (out) return out; } }
  return null;
}
const EDGE = (() => { for (const w of byAtk.filter(c => c.attr === 'WATER')) { const f = byAtk.find(c => c.attr === 'FIRE' && c.atk > w.atk && c.atk < w.atk + db.config.wheelBonus); if (f) return [w.id, f.id]; } })();
assert.ok(PAIR && PRINTED && EDGE && BURN && DESTROY && FIELD && EQUIP && WEAKEN_TRAP, 'the pool holds the cards the tests need');

// ---------- driving a run ----------
let U = 900000; // uids for cards the tests hand out, far above anything a duel numbers itself
const inst = id => ({ u: U++, id });
const monAt = (id, extra = {}) => ({ u: U++, id, pos: 'a', veil: false, att: 0, moved: false, ...extra });
const door = (type, extra = {}) => ({ type, know: 'known', name: type, cost: '', reward: '', tags: [], ...extra });
// A scene: one profile, one run at a time, and every id earned while it plays (from the events of achRunApply).
function scene(dbx, profile = {}) {
  const s = { dbx, p: Object.assign(newProfile(), JSON.parse(JSON.stringify(profile))), got: [], run: null, last: [] };
  s.act = a => { const ev = achRunApply(s.run, a, dbx, s.p); s.last = ev.filter(e => e.e === 'ach').map(e => e.id); s.got.push(...s.last); return ev; };
  s.check = run => { const ids = achCheck(dbx, s.p, run === undefined ? s.run : run); s.got.push(...ids); return ids; };
  return s;
}
function start(s, opts = {}) {
  s.run = newRun(s.dbx, { seed: opts.seed || 11, track: true, forger: opts.forger || 'tarn', heat: opts.heat || 0, uid: opts.uid || 'u' + (U++) });
  s.act({ t: 'kit', i: 0 }); s.act({ t: 'pick', i: 0 });
  return s.run;
}
// The player answers no Trap prompt the rival's attack raises, so the run is always at the player's own turn.
function toMine(s) { for (let g = 0; g < 20 && s.run.phase === 'duel' && s.run.duel.pending; g++) s.act({ t: 'duel', action: { t: 'respond', trap: -1 } }); }
const duel = (s, action) => { s.act({ t: 'duel', action }); toMine(s); };
const endTurn = s => duel(s, { t: 'end' });
function toChamber(s, skipGifts = false) { for (let g = 0; g < 20 && s.run.phase === 'reward'; g++) s.act(s.run.offer.kind === 'gift' && skipGifts ? { t: 'skip' } : { t: 'pick', i: 0 }); }
function enterDoor(s, d) { toChamber(s); assert.equal(s.run.phase, 'chamber'); s.run.doors = [d]; s.act({ t: 'door', i: 0 }); if (s.run.phase === 'duel') toMine(s); }
const enterDuel = (s, tier = 'regular') => enterDoor(s, door(tier === 'regular' ? 'duel' : tier, { tier, theme: 0, twist: null }));
// A floor guardian's duel. The test opens its door with both seals; the duel itself is the engine's.
function enterBoss(s, floor, id) {
  toChamber(s);
  s.run.floor = floor; s.run.bossOrder[floor] = BOSSES[floor].findIndex(b => b.id === id); s.run.seals = 2;
  enterDoor(s, door('boss', { tier: 'boss', boss: id }));
  assert.equal(s.run.rival.tier, 'boss');
}
// Tries seeds until the guardian duel opens the way a test needs (who moves first decides what the rival has done).
function bossScene(dbx, floor, id, want = () => true, profile = {}, opts = {}) {
  for (let seed = 11; seed < 80; seed++) {
    const s = scene(dbx, profile); start(s, { ...opts, seed }); enterBoss(s, floor, id);
    if (s.run.phase === 'duel' && want(s.run.duel)) return s;
  }
  throw new Error('no seed opened ' + id + ' as the test needs');
}
const clean = d => d.stats[0].ach && d.stats[0].ach.lpLost === 0 && !d.played;
const handSet = (d, ids) => { d.hand[0] = ids.map(inst); };
// Wins with a Spell that burns the rival's last Life Points: no attack, no fusion, nothing a Law can be paid for.
function winByBurn(s) {
  if (s.run.duel.played || s.run.duel.attacked) endTurn(s);
  const d = s.run.duel; d.lp[1] = Math.min(d.lp[1], BURN_N);
  if (d.hand[0].length >= db.config.handMax) d.hand[0].length = db.config.handMax - 1;
  d.hand[0].push(inst(BURN));
  duel(s, { t: 'play', hand: [d.hand[0].length - 1], onto: null });
  assert.ok(s.run.lastDuel && s.run.lastDuel.won && !s.run.duel, 'the burn won the duel');
}
// Wins with a direct attack. The rival's table and Traps are cleared first and its Life Points set to one.
function winByAttack(s, extra = {}) {
  let d = s.run.duel; if (d.turn === 1 || d.attacked) { endTurn(s); d = s.run.duel; }
  d.mon[1] = d.mon[1].map(() => null); d.traps[1] = d.traps[1].map(() => null); d.lp[1] = 1; d.frozen[0] = 0; d.noAttack = false;
  let z = d.mon[0].findIndex(m => !m); if (z < 0) z = 0;
  d.mon[0][z] = monAt(extra.id || STRONG, extra);
  duel(s, { t: 'attack', from: z, to: -1 });
  assert.ok(s.run.lastDuel && s.run.lastDuel.won && !s.run.duel, 'the attack won the duel');
}
// The rival's turn, with its moves chosen by the test and made by the duel's own applyMut, then back to the player.
function asRival(s, fn) {
  const d = s.run.duel; d.active = 1; d.played = false; d.attacked = false; d.noAttack = false; d.frozen[1] = 0; d.turn = Math.max(d.turn, 2);
  fn(d);
  assert.equal(d.winner, null, 'the rival turn the test made must not end the duel');
  applyMut(d, { t: 'end' }, s.dbx); toMine(s);
}
// Clears the pyramid from its last guardian: wins every duel by burn, takes each reward and walks on past a secret door.
function quickClear(s, { boss = null, skipGifts = false, open = false } = {}) {
  const floor = s.dbx.config.floors - 1;
  enterBoss(s, floor, boss || BOSSES[floor][0].id);
  for (let g = 0; g < 60 && s.run.phase !== 'over'; g++) {
    const r = s.run;
    if (r.phase === 'duel') winByBurn(s);
    else if (r.phase === 'reward') s.act(r.offer.kind === 'gift' && skipGifts ? { t: 'skip' } : { t: 'pick', i: 0 });
    else if (r.phase === 'chamber') { const i = r.doors.findIndex(d => d.type === 'boss' || (open ? d.type === 'secret' : d.type === 'onward')); s.act({ t: 'door', i }); toMine(s); }
    else throw new Error('a clear cannot go on from ' + r.phase);
  }
  assert.equal(s.run.phase, 'over'); assert.ok(s.run.result.won, 'the pyramid is cleared');
}
const earned = (s, ids, name) => { for (const id of ids) { assert.ok(s.got.includes(id), name + ': ' + id + ' earned (got ' + s.got.join(' ') + ')'); if (!everEarned.has(id)) everEarned.set(id, name); } };
const notEarned = (s, ids, name) => { for (const id of ids) assert.ok(!s.got.includes(id) && !(s.p.ach || []).includes(id), name + ': ' + id + ' must not be earned'); };
const once = s => assert.equal(new Set(s.p.ach).size, s.p.ach.length, 'no row twice in p.ach');

// ---------- the table ----------
test('the table: 68 rows, the approved tiers, ids, hints, metas and switch', () => {
  assert.equal(ACH.length, 68);
  assert.equal(new Set(ACH.map(r => r.id)).size, 68); assert.equal(new Set(ACH.map(r => r.name)).size, 68);
  for (const r of ACH) assert.match(r.id, /^[a-z]+(_[a-z]+)*$/, 'snake_case id ' + r.id);
  const tiers = {}; for (const r of ACH) tiers[r.tier] = (tiers[r.tier] || 0) + 1;
  assert.deepEqual(tiers, { xp: 20, common: 15, uncommon: 9, feat: 9, hidden: 11, meta: 4 });
  const groups = {}; for (const r of ACH) groups[r.group] = (groups[r.group] || 0) + 1;
  assert.deepEqual(groups, { asterhold: 11, heat: 5, guardians: 11, codex: 8, forge: 10, duelcraft: 10, rumours: 9, meta: 4 });
  assert.deepEqual(ACH_GROUPS.map(g => g.id), Object.keys(groups));
  for (const r of ACH) { assert.equal(r.hidden, r.tier === 'hidden'); assert.equal(!!r.hint, r.tier === 'hidden', 'a hint exactly on the hidden rows: ' + r.id); assert.ok(r.how.endsWith('.')); }
  for (const r of ACH.filter(x => x.tier === 'meta')) { assert.ok(r.title && r.parts.length === r.goal); for (const id of r.parts) assert.ok(ACH_BY_ID[id] && ACH_BY_ID[id].tier !== 'meta'); }
  assert.deepEqual(ACH_BY_ID.what_was_taken.parts, ['scratched_on_the_door', 'the_first_memory', 'where_wall_was', 'one_was_enough', 'the_keeper_leaves']);
  assert.deepEqual(SECRET.sort(), ['kept_and_carried', 'left_it_standing', 'one_meets_one', 'one_was_enough', 'the_first_memory', 'the_keeper_leaves', 'too_many_still', 'what_was_taken', 'where_wall_was']);
  assert.equal(achList(SDB).length, 68); assert.equal(achList(db).length, 59);
  assert.ok(achList(db).every(r => !r.needs) && achList(SDB).every(r => typeof r.test === 'undefined'));
  // No row's words name a card of the pool.
  const names = db.pool.cards.map(c => c.name).filter(n => n.length >= 5);
  for (const r of ACH) for (const t of [r.name, r.how, r.hint || '', r.title || '']) for (const n of names) assert.ok(!t.includes(n), r.id + ' names a card');
});

test('an untracked run keeps no facts and earns nothing from the run', () => {
  const run = newRun(db, { seed: 3 }); runApply(run, { t: 'kit', i: 0 }, db); runApply(run, { t: 'pick', i: 0 }, db);
  assert.ok(!('ach' in run));
  run.doors = [door('duel', { tier: 'regular', theme: 0, twist: null })]; runApply(run, { t: 'door', i: 0 }, db);
  assert.ok(!('ach' in run.duel.stats[0]) && !('ach' in run.duel.stats[1]) && !run.duel.seat[0].track);
  const p = newProfile(); assert.deepEqual(achCheck(db, p, run), []);
  const s = newDuel(db, { seed: 4, decks: [Array.from({ length: 40 }, () => ({ id: WEAK })), Array.from({ length: 40 }, () => ({ id: WEAK }))], seats: [{ track: 1 }, {}] });
  assert.deepEqual(s.stats[0].ach, { lpLost: 0, attacks: 0, grounds: 0, lawPaid: 0, aceDown: 0, edgeKills: 0, fusions: 0, longestFuse: 0, relicFinish: 0 });
  assert.ok(!('ach' in s.stats[1]));
});

// ---------- guardian duels won clean, and the reload rules ----------
test('a guardian beaten by one burn: Not a Mark, Bare Iron, They Came to You, Nothing to Collect, The First Memory', () => {
  const s = bossScene(SDB, 1, 'bone_collector', clean);
  winByBurn(s);
  earned(s, ['not_a_mark', 'bare_iron', 'they_came_to_you', 'nothing_to_collect', 'the_first_memory', 'hammer_finds_its_weight', 'scratched_on_the_door', 'the_door_unsealed'], 'clean guardian');
  for (let k = 0; k < 3; k++) assert.deepEqual(s.check(), [], 'nothing is earned twice');
  once(s);
});

test('a guardian duel reloaded part-way keeps what happened before the save', () => {
  const s = bossScene(db, 1, 'bone_collector', d => clean(d) && d.turn >= 2);
  const d = s.run.duel;
  d.mon[0] = d.mon[0].map(() => null); d.mon[1] = d.mon[1].map(() => null); d.traps[1] = d.traps[1].map(() => null); d.terrain = null;
  d.mon[0][0] = monAt(WEAK); d.mon[1][0] = monAt(STRONG);
  handSet(d, PAIR);
  duel(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' });
  duel(s, { t: 'attack', from: 0, to: 0 });
  const A = s.run.duel.stats[0].ach;
  assert.ok(A.fusions >= 1 && A.attacks === 1 && A.lpLost > 0 && A.lawPaid === 500, 'the counters saw the fusion, the attack, the damage and the Law: ' + JSON.stringify(A));
  const saved = JSON.stringify(s.run);
  s.run = JSON.parse(saved); // the page closes and opens again
  // The rival's strong monster is taken away and the Life Points put back, so the rival's turn cannot end the duel.
  const r = s.run.duel; r.mon[1] = r.mon[1].map(() => null); r.lp[0] = db.config.lp;
  winByBurn(s);
  earned(s, ['hammer_finds_its_weight'], 'after reload');
  notEarned(s, ['not_a_mark', 'bare_iron', 'they_came_to_you', 'nothing_to_collect'], 'after reload');
});

test('a duel saved before the counters existed can never pass for one where nothing happened', () => {
  const s = bossScene(SDB, 1, 'bone_collector', clean);
  delete s.run.duel.stats[0].ach; // as an older build saved it
  s.run = JSON.parse(JSON.stringify(s.run));
  winByBurn(s);
  earned(s, ['hammer_finds_its_weight', 'the_first_memory'], 'old duel');
  notEarned(s, ['not_a_mark', 'bare_iron', 'they_came_to_you', 'nothing_to_collect'], 'old duel');
});

test('a run played with a save and reload after every move earns exactly what the same run earns without them', () => {
  for (const seed of [21, 22, 23]) {
    const play = reload => {
      const P = newProfile(); let run = newRun(LDB, { seed, track: true, forger: 'tarn', uid: 'r' + seed });
      for (let g = 0; g < 20000 && run.phase !== 'over'; g++) { achRunApply(run, policyAction(LDB, run, { level: 2, lone: seed % 2 ? 'boss' : null }), LDB, P); if (reload && run.phase === 'duel') run = JSON.parse(JSON.stringify(run)); }
      applyRun(P, run); achCheck(LDB, P, run);
      return P;
    };
    const a = play(false), b = play(true);
    assert.deepEqual(b.ach, a.ach, 'seed ' + seed); assert.deepEqual(b.achAt, a.achAt);
    assert.ok(a.ach.length >= 8, 'a real run earns rows: ' + a.ach.join(' '));
  }
});

// ---------- the six Laws, one profile, then the meta ----------
test('every Law answered in its own way, and Every Law Broken with the last of them', () => {
  const L = scene(db);
  const into = (floor, id, want) => { const s = bossScene(db, floor, id, want); s.p = L.p; s.got = []; return s; };
  const at2 = d => clean(d) && d.turn >= 2;
  // Ground That Lasts: a Field Spell of the player's own against the Kiln Warden's scorched ground.
  { const s = into(0, 'kiln_warden', at2); handSet(s.run.duel, [FIELD]); duel(s, { t: 'play', hand: [0], onto: null });
    assert.equal(s.run.duel.stats[0].ach.grounds, 1); winByAttack(s); earned(s, ['ground_that_lasts'], 'kiln'); }
  // Stone Against Stone: her attacker meets a defender whose DEF is above its ATK.
  { const s = into(0, 'stone_sentinel', at2), d = s.run.duel;
    d.mon[0] = d.mon[0].map(() => null); d.mon[1] = d.mon[1].map(() => null); d.traps[0] = d.traps[0].map(() => null); d.terrain = null;
    d.mon[1][0] = monAt(MID); const atk = effAtk(d, db, 1, d.mon[1][0]); d.mon[0][0] = monAt(WEAK, { pos: 'd' }); d.mon[0][0].bd = atk + 1000 - effDef(d, db, 0, d.mon[0][0]);
    asRival(s, dd => applyMut(dd, { t: 'attack', from: 0, to: 0 }, db));
    assert.ok(s.run.duel.stats[0].defWins >= 1); winByBurn(s); earned(s, ['stone_against_stone'], 'stone'); }
  // Veil Against Veil: a monster set veiled in defense is still veiled when the Veiled Magus falls.
  { const s = into(1, 'veiled_magus', at2), d = s.run.duel; handSet(d, [WEAK]); duel(s, { t: 'play', hand: [0], onto: null, pos: 'd', veiled: true });
    assert.ok(s.run.duel.mon[0].some(m => m && m.veil)); winByAttack(s); earned(s, ['veil_against_veil'], 'veil'); }
  // Four Is Enough: a meld of four cards (a monster and three Equips) against the White Tyrant.
  { const s = into(2, 'white_tyrant', at2), d = s.run.duel; handSet(d, [MID, EQUIP, EQUIP, EQUIP]); duel(s, { t: 'play', hand: [0, 1, 2, 3], onto: null, pos: 'a' });
    assert.ok(s.run.duel.stats[0].longestChain >= 4); assert.equal(s.run.duel.stats[0].ach.longestFuse, 0, 'Equips are not fusions');
    winByAttack(s); earned(s, ['four_is_enough'], 'tyrant'); notEarned(s, ['fivefold_weld'], 'tyrant'); }
  // Nothing to Collect and The Gate Stays Shut: both won before the Law could act.
  { const s = into(1, 'bone_collector', clean); winByBurn(s); earned(s, ['nothing_to_collect'], 'bone'); }
  assert.ok(!L.p.ach.includes('every_law_broken'), 'five of six parts: no meta yet');
  { const s = into(2, 'last_gate', clean); winByBurn(s); earned(s, ['the_gate_stays_shut', 'every_law_broken'], 'gate');
    assert.ok(s.p.ach.indexOf('every_law_broken') > s.p.ach.indexOf('the_gate_stays_shut'), 'the meta comes after its last part'); }
  once(L);
});

test('An Answer Held: the Last Gate\'s ace comes by his Law and a Spell destroys it', () => {
  const s = bossScene(db, 2, 'last_gate', d => d.turn >= 1);
  s.run.duel.lp[0] = 99999; // the player must outlast the turns the Law needs
  for (let g = 0; g < 20 && !s.run.duel.seat[1].rs.endCame; g++) endTurn(s);
  const d = s.run.duel, z = d.mon[1].findIndex(m => m && m.fix != null);
  assert.ok(z >= 0, 'the Law brought the ace'); if (d.played || d.attacked) endTurn(s);
  handSet(s.run.duel, [DESTROY]); duel(s, { t: 'play', hand: [0], onto: null, target: s.run.duel.mon[1].findIndex(m => m && m.fix != null) });
  assert.equal(s.run.duel.stats[0].ach.aceDown, 1);
  winByAttack(s); earned(s, ['an_answer_held'], 'answer'); notEarned(s, ['the_gate_stays_shut'], 'answer');
});

test('all six guardians over runs: the three pairs, A Score of Keepers and All Six Keepers', () => {
  const s = scene(db, { bossWins: 14 });
  for (const [floor, pair] of BOSSES.entries()) for (const b of pair) {
    start(s, { seed: 30 + floor }); enterBoss(s, floor, b.id); winByBurn(s); toChamber(s);
    if (s.run.phase !== 'over') s.act({ t: 'abandon' });
    applyRun(s.p, s.run); s.check(null);
  }
  earned(s, ['kiln_and_stone', 'bone_and_veil', 'tyrant_and_gate', 'a_score_of_keepers', 'all_six_keepers'], 'six guardians');
  assert.ok(s.p.ach.indexOf('all_six_keepers') > s.p.ach.indexOf('tyrant_and_gate'));
  assert.deepEqual(s.p.beaten.slice().sort(), BOSSES.flat().map(b => b.id).sort(), 'the profile keeps every guardian beaten');
  assert.equal(s.p.bossWins, 20);
});

// ---------- the Codex ----------
test('Written Before You, Fivefold Weld and The Long Seam are earned at the very play, and Equips cannot fake a long meld', () => {
  const s = scene(db); start(s); enterDuel(s);
  handSet(s.run.duel, PRINTED); const ev = s.act({ t: 'duel', action: { t: 'play', hand: [0, 1], onto: null, pos: 'a' } }); toMine(s);
  assert.ok(ev.some(e => e.e === 'ach' && e.id === 'written_before_you') && s.run.phase === 'duel', 'earned at the play, mid-duel');
  endTurn(s);
  handSet(s.run.duel, [MID, EQUIP, EQUIP, EQUIP, EQUIP, EQUIP]); duel(s, { t: 'play', hand: [0, 1, 2, 3, 4, 5], onto: null, pos: 'a' });
  notEarned(s, ['fivefold_weld', 'the_long_seam'], 'six cards with Equips');
  endTurn(s);
  const five = fuseChain(5); handSet(s.run.duel, five); duel(s, { t: 'play', hand: [0, 1, 2, 3, 4], onto: null, pos: 'a' });
  assert.deepEqual(s.last, ['fivefold_weld']); assert.equal(s.run.phase, 'duel');
  endTurn(s);
  const six = fuseChain(6); s.run.duel.mon[0] = s.run.duel.mon[0].map(() => null); handSet(s.run.duel, six); duel(s, { t: 'play', hand: [0, 1, 2, 3, 4, 5], onto: null, pos: 'a' });
  assert.deepEqual(s.last, ['the_long_seam']);
  winByAttack(s);
  earned(s, ['written_before_you', 'fivefold_weld', 'the_long_seam', 'ink_on_the_page'], 'codex plays');
});

test('pages found: Ink on the Page, Margins Filling, The Codex Grows, A Heavy Codex', () => {
  const keys = [], ids = new Set();
  for (const a of byAtk) { for (const b of byAtk) { if (ids.size >= 150) break; if (a.id === b.id || !fuse(a.id, b.id)) continue; const k = codexKey(db, a.id, b.id), r = codexResult(db, k); if (r && !ids.has(r.id)) { ids.add(r.id); keys.push(k); } } if (ids.size >= 150) break; }
  assert.equal(keys.length, 150);
  const s = scene(db);
  s.p.codex = keys.slice(0, 24); s.check(null); earned(s, ['ink_on_the_page'], 'pages'); notEarned(s, ['margins_filling'], 'pages 24');
  assert.equal(achProgress(db, s.p).find(x => x.id === 'margins_filling').have, 24);
  for (const [n, id] of [[25, 'margins_filling'], [75, 'the_codex_grows'], [150, 'a_heavy_codex']]) { s.p.codex.push(...keys.slice(s.p.codex.length, n)); assert.deepEqual(s.check(null), [id]); }
  // A run's own new pages count before the run is banked.
  const t = scene(db, { codex: keys.slice(0, 24) }); start(t); t.run.codex.push(keys[24]); t.check(); earned(t, ['margins_filling'], 'run pages');
});

test('Every Seam Held: a clear with twenty fusions and no fizzle, and one fizzle spoils it', () => {
  const FIZZLE = (() => { for (const a of byAtk) for (const b of byAtk) if (meldPair(db, a.id, b.id).kind === 'fizzle') return [a.id, b.id]; })();
  const seams = fizzle => {
    const s = scene(db); start(s); enterDuel(s); s.run.duel.lp[0] = 99999;
    const chain = fuseChain(5);
    for (let k = 0; k < 10 && s.run.duel.stats[0].ach.fusions < 20; k++) { if (s.run.duel.played) endTurn(s); s.run.duel.mon[0] = s.run.duel.mon[0].map(() => null); handSet(s.run.duel, chain); duel(s, { t: 'play', hand: [0, 1, 2, 3, 4], onto: null, pos: 'a' }); }
    if (fizzle) { endTurn(s); handSet(s.run.duel, FIZZLE); duel(s, { t: 'play', hand: [0, 1], onto: null, pos: 'a' }); assert.equal(s.run.duel.stats[0].fizzles, 1); }
    assert.ok(s.run.duel.stats[0].ach.fusions >= 20);
    winByAttack(s); quickClear(s);
    return s;
  };
  earned(seams(false), ['every_seam_held', 'a_hammer_like_yours'], 'seams');
  notEarned(seams(true), ['every_seam_held'], 'a fizzle');
});

// ---------- the Forge and the Vault ----------
test('the Vault: Paid in Memories with the first purchase, Bare Shelves with the ninth relic', () => {
  const s = scene(db, { memories: 1000 });
  buy(s.p, VAULT[0].id); assert.deepEqual(s.check(null), ['paid_in_memories']);
  for (const v of VAULT.slice(1, -1)) { buy(s.p, v.id); assert.deepEqual(s.check(null), []); }
  assert.equal(achProgress(db, s.p).find(x => x.id === 'bare_shelves').have, VAULT.length - 1);
  buy(s.p, VAULT[VAULT.length - 1].id); assert.deepEqual(s.check(null), ['bare_shelves']);
  earned(s, ['paid_in_memories', 'bare_shelves'], 'vault');
});

test('the Anvil: Joined at the Anvil, Two Fires, One Anvil and Thrice Worked in the right order only', () => {
  const s = scene(db); start(s);
  const [m1, m2] = MASTERWORKS.filter((m, i, all) => all.findIndex(x => x.parts.some(p => m.parts.includes(p))) === i);
  s.run.gifts = [...m1.parts, ...m2.parts]; s.run.embers = 9999;
  enterDoor(s, door('anvil')); s.act({ t: 'anvil', kind: 'masterwork', id: s.run.offer.masterworks[0] }); assert.deepEqual(s.last, ['joined_at_the_anvil']);
  enterDoor(s, door('anvil')); s.act({ t: 'anvil', kind: 'masterwork', id: s.run.offer.masterworks[0] }); assert.deepEqual(s.last, ['two_fires_one_anvil']);
  const work = order => {
    const t = scene(db); start(t); const r = t.run; r.deck[0] = { id: PAIR[0] }; r.deck[1] = { id: PAIR[1] }; r.codex = [codexKey(db, PAIR[0], PAIR[1])]; r.embers = 9999; r.capBonus = 500;
    for (const step of order) {
      enterDoor(t, door('anvil'));
      const bound = r.deck.findIndex(e => e.b), at = bound >= 0 ? bound : 0;
      if (step === 'bind') t.act({ t: 'anvil', kind: 'bind', a: 0, b: 1 });
      else if (step === 'temper') t.act({ t: 'anvil', kind: 'temper', deck: at });
      else t.act({ t: 'anvil', kind: 'enchant', deck: at, enchant: r.offer.enchants[0] });
    }
    return t;
  };
  const good = work(['bind', 'temper', 'enchant']); earned(good, ['thrice_worked'], 'bind, temper, enchant');
  const good2 = work(['bind', 'enchant', 'temper']); earned(good2, ['thrice_worked'], 'bind, enchant, temper');
  const lost = work(['temper', 'bind', 'enchant']); notEarned(lost, ['thrice_worked'], 'a temper before the bind is lost');
  earned(s, ['joined_at_the_anvil', 'two_fires_one_anvil'], 'anvil');
});

test('Forgers: The Whole Smithy, Another Set of Tongs, The Full Rack, Four Hands, One Forge, Heavy With Memory', () => {
  { const s = scene(db); start(s); assert.equal(achProgress(db, s.p, s.run).find(x => x.id === 'the_whole_smithy').have, 0); quickClear(s); earned(s, ['the_whole_smithy'], 'smithy'); assert.ok(s.got.indexOf('the_whole_smithy') >= 0 && s.run.phase === 'over' && !s.p.runs, 'earned before the run is banked'); }
  { const s = scene(db, { byForger: { tarn: { runs: 2, wins: 9, clears: 0, heat: -1 } } }); start(s); enterDuel(s); winByAttack(s); earned(s, ['another_set_of_tongs'], 'tongs'); }
  { const s = scene(db, { byForger: { tarn: { runs: 9, wins: 30, clears: 1, heat: 0 }, scrapper: { runs: 9, wins: 30, clears: 1, heat: 0 }, veil: { runs: 9, wins: 30, clears: 1, heat: 0 }, storm: { runs: 9, wins: 29, clears: 0, heat: -1 } } });
    start(s, { forger: 'storm' }); assert.equal(achProgress(db, s.p, s.run).find(x => x.id === 'the_full_rack').have, 119);
    enterDuel(s); winByAttack(s); earned(s, ['the_full_rack'], 'rack'); notEarned(s, ['four_hands_one_forge'], 'rack');
    quickClear(s); earned(s, ['four_hands_one_forge'], 'four hands'); }
  { const s = scene(db, { earned: 995 }); start(s); enterDuel(s); winByAttack(s); toChamber(s); notEarned(s, ['heavy_with_memory'], 'memories mid-run'); s.act({ t: 'abandon' }); earned(s, ['heavy_with_memory'], 'memories'); }
});

// ---------- Beneath Asterhold ----------
test('choices: Paid to Look, Room Over Warmth, Owed Nothing, and their near misses', () => {
  { const s = scene(db); start(s); s.run.embers = 100; enterDoor(s, door('omen')); s.act({ t: 'pick', i: 1 }); notEarned(s, ['paid_to_look'], 'paid, not left yet'); s.act({ t: 'skip' }); earned(s, ['paid_to_look'], 'omen'); }
  { const s = scene(db); start(s); s.run.embers = 100; s.run.trunk = [{ id: WEAK }, { id: WEAK }]; enterDoor(s, door('omen')); s.act({ t: 'pick', i: 1 }); s.act({ t: 'pick', i: 0 }); enterDoor(s, door('omen')); s.act({ t: 'skip' }); notEarned(s, ['paid_to_look'], 'traded, or left unseen'); }
  { const s = scene(db); start(s); s.run.sparks = 1; enterDoor(s, door('sanctum')); s.act({ t: 'pick', i: 1 }); earned(s, ['room_over_warmth'], 'sanctum'); }
  { const s = scene(db); start(s); s.run.sparks = 2; enterDoor(s, door('sanctum')); s.act({ t: 'pick', i: 1 }); notEarned(s, ['room_over_warmth'], 'two Sparks'); }
  const gifted = take => { const s = scene(db); start(s); s.run.phase = 'reward'; s.run.queue = []; s.run.offer = { kind: 'gift', options: ['kindling', 'whetstone', 'iron_rations'] }; s.act(take ? { t: 'pick', i: 0 } : { t: 'skip' }); quickClear(s, { skipGifts: true }); return s; };
  earned(gifted(false), ['owed_nothing'], 'gifts turned down'); notEarned(gifted(true), ['owed_nothing'], 'a Gift taken');
});

test('clears: A Hammer Like Yours, On One Spark, Every Spark Home, and a lost duel spoils the last', () => {
  { const s = scene(db); start(s); s.run.sparks = 1; quickClear(s); earned(s, ['a_hammer_like_yours', 'on_one_spark', 'every_spark_home'], 'one spark'); }
  { const s = scene(db); start(s); s.run.stats.losses = 1; quickClear(s); notEarned(s, ['every_spark_home', 'on_one_spark'], 'a duel lost'); }
});

test('counts: Ten Times Down, Worn Handle, The Hammer Remembers, with banking never counting a run twice', () => {
  { const s = scene(db, { descents: 9, duelWins: 49 }); start(s); enterDuel(s); winByAttack(s); earned(s, ['worn_handle'], 'wins'); notEarned(s, ['ten_times_down'], 'run not finished'); toChamber(s); s.act({ t: 'abandon' }); earned(s, ['ten_times_down'], 'descents'); }
  { const s = scene(db, { descents: 8 }); start(s); enterDuel(s); winByAttack(s); toChamber(s); s.act({ t: 'abandon' }); notEarned(s, ['ten_times_down'], '9 of 10');
    const run = s.run; applyRun(s.p, run); assert.equal(s.p.descents, 9); assert.deepEqual(s.check(run), [], 'a banked run is not counted again');
    start(s); s.act({ t: 'abandon' }); applyRun(s.p, s.run); assert.equal(s.p.descents, 9, 'a run left before any duel is no descent'); s.check(null); notEarned(s, ['ten_times_down'], 'no duel');
    start(s); enterDuel(s); winByAttack(s); toChamber(s); s.act({ t: 'abandon' }); earned(s, ['ten_times_down'], 'tenth'); }
  { const s = scene(db, { duelWins: 249 }); start(s); enterDuel(s); winByAttack(s); earned(s, ['the_hammer_remembers', 'worn_handle'], 'hammer'); }
});

// ---------- the Heat ----------
test('the Heat: One Coal Hotter, Iron Glows Red, The Fire Climbs, Ten Coals Hotter through the Second Gate, Same Fire, Every Hand', () => {
  for (const [heat, ids] of [[1, ['one_coal_hotter']], [3, ['one_coal_hotter', 'iron_glows_red']], [5, ['one_coal_hotter', 'iron_glows_red', 'the_fire_climbs']]]) {
    const s = scene(db); start(s, { heat }); quickClear(s); earned(s, ids, 'heat ' + heat); if (heat < 5) notEarned(s, ['the_fire_climbs'], 'heat ' + heat);
  }
  { const s = scene(LDB); start(s, { heat: 10 }); quickClear(s); assert.equal(s.run.secondGate, 1, 'Heat 10 opened the Second Gate'); earned(s, ['ten_coals_hotter'], 'heat 10'); }
  { const s = scene(db, { byForger: { tarn: { runs: 5, wins: 50, clears: 2, heat: 5 }, scrapper: { runs: 5, wins: 50, clears: 2, heat: 6 }, veil: { runs: 5, wins: 50, clears: 2, heat: 5 }, storm: { runs: 5, wins: 50, clears: 2, heat: 4 } } });
    start(s, { forger: 'storm', heat: 4 }); quickClear(s); notEarned(s, ['same_fire_every_hand'], 'Heat 4'); applyRun(s.p, s.run); s.check(null);
    start(s, { forger: 'storm', heat: 5 }); quickClear(s); earned(s, ['same_fire_every_hand'], 'same fire'); }
});

// ---------- Duelcraft ----------
test('Duelcraft: Struck True, The Elements Agree, The Forge Finishes, Three Hearths, Hall of Teeth, Taller Than the Gate, The Well Runs Dry', () => {
  { const s = scene(db); start(s); enterDuel(s); Object.assign(s.run.duel.stats[0], { melds: 4, spells: 4, bigHits: 4, defWins: 3, turns: 1 }); s.run.duel.lp[0] = db.config.lp; winByBurn(s); assert.equal(s.run.lastDuel.rank.rank, 'S'); earned(s, ['struck_true'], 'S rank'); }
  { const run0 = (() => { for (let seed = 11; seed < 80; seed++) { const s = scene(db); start(s, { seed }); enterDuel(s); if (s.run.duel.turn >= 2 && !s.run.duel.played) return s; } })();
    const s = run0, d = s.run.duel; d.terrain = null; d.mon[0] = d.mon[0].map(() => null); d.mon[1] = d.mon[1].map(() => null); d.traps[1] = d.traps[1].map(() => null);
    d.mon[0][0] = monAt(STRONG); d.mon[1][0] = monAt(EDGE[1]); duel(s, { t: 'attack', from: 0, to: 0 }); notEarned(s, ['the_elements_agree'], 'won without the edge');
    s.run.duel.mon[0][1] = monAt(EDGE[0]); s.run.duel.mon[1][1] = monAt(EDGE[1]); duel(s, { t: 'attack', from: 1, to: 1 });
    assert.deepEqual(s.last, ['the_elements_agree']); assert.equal(s.run.phase, 'duel', 'earned in the battle itself'); }
  { const s = scene(db); start(s); s.run.gifts = ['thorn_veil']; enterDuel(s); const d = s.run.duel; d.mon[0][0] = monAt(WEAK, { pos: 'd', veil: true }); d.lp[1] = 100; endTurn(s);
    assert.ok(s.run.lastDuel.won); earned(s, ['the_forge_finishes'], 'relic finish'); }
  { const s = scene(db); start(s); s.run.charms = ['balanced_scales', 'copper_loop']; s.run.gifts = ['kindling']; s.run.capBonus = 200; enterDuel(s);
    handSet(s.run.duel, [FIRE_MON, EQUIP, EQUIP]); duel(s, { t: 'play', hand: [0, 1, 2], onto: null, pos: 'a' });
    assert.ok(['furnace', 'storm', 'lean'].every(f => s.run.duel.stats[0].relicFamilies[f]), 'three builds fired'); winByAttack(s); earned(s, ['three_hearths'], 'three hearths'); }
  { const s = scene(db); start(s); enterDuel(s); const d = s.run.duel; d.mon[0] = d.mon[0].map(() => null); d.traps[0] = d.traps[0].map((t, i) => i < 3 ? { u: U++, id: WEAKEN_TRAP } : null);
    d.mon[1] = d.mon[1].map((m, i) => i < 3 ? monAt(WEAK) : null);
    asRival(s, dd => { for (let z = 0; z < 3; z++) { applyMut(dd, { t: 'attack', from: z, to: -1 }, db); applyMut(dd, { t: 'respond', trap: dd.pending.options[0] }, db); } });
    assert.equal(s.run.duel.stats[0].trapsSprung, 3); winByBurn(s); earned(s, ['hall_of_teeth'], 'three Traps'); }
  { const s = scene(db); start(s); enterDuel(s); winByAttack(s, { id: STRONG, ba: 5000 }); earned(s, ['taller_than_the_gate'], 'tall');
    const t = scene(db); start(t); enterDuel(t); winByAttack(t, { id: MID }); notEarned(t, ['taller_than_the_gate'], 'short'); }
  { const s = scene(db); start(s); enterDuel(s); const d = s.run.duel; d.deck[1] = []; d.hand[1] = []; endTurn(s);
    assert.equal(s.run.lastDuel.reason, 'deckout'); earned(s, ['the_well_runs_dry'], 'deck out'); }
});

// ---------- Rumours ----------
test('Rumours as The Last One: the door, the hidden duel won, the way out, and What Was Taken', () => {
  const s = bossScene(SDB, 2, 'white_tyrant', clean, {}, { forger: 'last' });
  winByBurn(s); earned(s, ['the_first_memory'], 'memory');
  toChamber(s);
  assert.ok(s.run.doors.some(d => d.type === 'secret'), 'the door that was not there'); earned(s, ['where_wall_was'], 'door');
  s.act({ t: 'door', i: s.run.doors.findIndex(d => d.type === 'secret') }); toMine(s);
  assert.equal(s.run.rival.tier, 'secret'); winByBurn(s); earned(s, ['one_was_enough', 'one_meets_one'], 'hidden duel');
  toChamber(s); assert.equal(s.run.phase, 'over');
  earned(s, ['kept_and_carried', 'the_keeper_leaves', 'what_was_taken', 'a_hammer_like_yours', 'every_spark_home'], 'out');
  once(s);
  // The same profile and run with the switch off: no Rumours row may be earned, and none is listed.
  const Q = Object.assign(newProfile(), { ach: [] }), off = achCheck(db, Q, s.run);
  assert.ok(off.every(id => !SECRET.includes(id)) && off.includes('a_hammer_like_yours'), 'switch off: ' + off.join(' '));
  assert.ok(achView(db, Q, s.run).every(r => !SECRET.includes(r.id)));
  const R = newProfile(), on = achCheck(SDB, R, s.run);
  for (const id of ['the_first_memory', 'where_wall_was', 'one_was_enough', 'the_keeper_leaves', 'one_meets_one', 'kept_and_carried', 'what_was_taken']) assert.ok(on.includes(id), 'switch on: ' + id);
});

test('Rumours: Left It Standing and Too Many Still', () => {
  { const s = bossScene(SDB, 0, 'kiln_warden', clean); winByBurn(s); toChamber(s);
    s.act({ t: 'door', i: s.run.doors.findIndex(d => d.type === 'onward') }); earned(s, ['where_wall_was', 'left_it_standing'], 'walked past'); notEarned(s, ['one_was_enough'], 'walked past'); }
  { const s = bossScene(SDB, 0, 'stone_sentinel', clean); winByBurn(s); toChamber(s);
    s.act({ t: 'door', i: s.run.doors.findIndex(d => d.type === 'secret') }); toMine(s);
    // The player's deck and hand are emptied, so the next draw finds nothing.
    const d = s.run.duel; d.deck[0] = []; d.hand[0] = [];
    for (let g = 0; g < 6 && s.run.phase === 'duel'; g++) endTurn(s);
    assert.ok(s.run.lastDuel && !s.run.lastDuel.won && s.run.secret.lost); earned(s, ['too_many_still'], 'lost'); notEarned(s, ['one_was_enough', 'left_it_standing'], 'lost'); }
});

test('the Rumours switch off: real runs that keep one monster against guardians earn no Rumours row', () => {
  const P = newProfile();
  for (let seed = 40; seed < 46; seed++) { const run = newRun(db, { seed, track: true, forger: 'tarn', uid: 'off' + seed }); for (let g = 0; g < 20000 && run.phase !== 'over'; g++) achRunApply(run, policyAction(db, run, { level: 2, lone: 'boss' }), db, P); applyRun(P, run); achCheck(db, P, run); }
  // even a profile that heard memories and beat The Last One under the switch earns none of them with it off
  Object.assign(P, { seen: ['intro', 'memory:kiln_warden'], lastOne: 2, loneMet: 1, byForger: { ...P.byForger, last: { runs: 1, wins: 9, clears: 1, heat: 0 } } }); achCheck(db, P, null);
  assert.ok(P.ach.length > 5 && P.ach.every(id => !SECRET.includes(id)), P.ach.join(' '));
});

// ---------- metas ----------
test('each meta waits for every part, then comes once', () => {
  for (const m of ACH.filter(r => r.tier === 'meta')) {
    const p = newProfile(); p.ach = m.parts.slice(0, -1);
    assert.ok(!achCheck(SDB, p, null).includes(m.id), m.id + ' with a part missing');
    assert.equal(achProgress(SDB, p).find(x => x.id === m.id).have, m.parts.length - 1);
    p.ach.push(m.parts[m.parts.length - 1]);
    assert.ok(achCheck(SDB, p, null).includes(m.id), m.id + ' with every part'); assert.ok(!achCheck(SDB, p, null).includes(m.id));
    // A meta reads nothing but its parts, so earning it from parts already held is earning it the real way.
    if (!everEarned.has(m.id)) everEarned.set(m.id, 'meta parts');
    if (m.needs === 'secret') { const q = newProfile(); q.ach = m.parts.slice(); assert.ok(!achCheck(db, q, null).includes(m.id), m.id + ' never with the switch off'); }
  }
});

// ---------- real play over many runs ----------
test('real play: one profile over many seeded runs earns rows once each, metas after their parts', () => {
  const P = newProfile(), seen = [], order = [];
  for (let r = 0; r < REAL_RUNS; r++) {
    const forger = P.forgers[r % P.forgers.length], x = Rng.fromSeed(5000 + r);
    const q = { peek: x.chance(1, 3), cap: x.chance(1, 2), giftless: x.chance(1, 6), walk: x.chance(1, 3), lone: x.chance(1, 3) };
    const run = newRun(LDB, { seed: 8000 + r, heat: maxHeat(P), forger, ...runOptions(P, forger, false), uid: 'real' + r });
    for (let g = 0; g < 20000 && run.phase !== 'over'; g++) {
      const o = run.offer; let a = null;
      if (run.phase === 'reward' && o && o.kind === 'omen' && q.peek) a = !o.seen && run.embers >= 30 ? { t: 'pick', i: 1 } : o.seen ? { t: 'skip' } : null;
      if (run.phase === 'reward' && o && o.kind === 'sanctum' && q.cap && run.sparks === 1) a = { t: 'pick', i: 1 };
      if (run.phase === 'reward' && o && o.kind === 'gift' && q.giftless) a = { t: 'skip' };
      if (run.phase === 'chamber' && q.walk && run.doors.some(d => d.type === 'secret')) a = { t: 'door', i: run.doors.findIndex(d => d.type === 'onward') };
      const ev = achRunApply(run, a || policyAction(LDB, run, { level: 2, lone: forger === 'last' ? 'last' : q.lone ? 'boss' : null }), LDB, P);
      for (const e of ev) if (e.e === 'ach') { seen.push(e.id); order.push(e.id); }
    }
    P.fresh = P.fresh.filter(id => !run.gifts.includes(id));
    applyRun(P, run); seen.push(...achCheck(LDB, P, run));
    for (;;) { const v = VAULT.find(v => !P.bought.includes(v.id) && v.price <= P.memories); if (!v) break; buy(P, v.id); seen.push(...achCheck(LDB, P, null)); }
  }
  assert.equal(new Set(seen).size, seen.length, 'no row earned twice'); assert.deepEqual(seen.slice().sort(), P.ach.slice().sort());
  assert.deepEqual(achCheck(LDB, P, null), []);
  for (const m of ACH.filter(r => r.parts)) if (P.ach.includes(m.id)) for (const id of m.parts) assert.ok(P.ach.indexOf(id) < P.ach.indexOf(m.id), m.id + ' after ' + id);
  for (const id of P.ach) { assert.ok(Number.isInteger(P.achAt[id]) && P.achAt[id] >= 1 && P.achAt[id] <= REAL_RUNS); if (!everEarned.has(id)) everEarned.set(id, 'real play'); }
  const real = P.ach.length;
  console.log('  real play earned', real, 'of 68 rows in', REAL_RUNS, 'runs:', P.ach.join(' '));
  assert.ok(real >= 30, 'real play earns most of the everyday rows');
  // The profile, saved and read back, keeps its rows and earns none again.
  const back = JSON.parse(JSON.stringify(P)); assert.deepEqual(achCheck(LDB, back, null), []);
  const view = achView(LDB, back); assert.equal(view.length, 68);
  for (const r of view) { if (r.hidden && !r.earned) assert.ok(r.shownName === null && r.shownText === ACH_BY_ID[r.id].hint); else assert.equal(r.shownText, ACH_BY_ID[r.id].how); }
});

test('an old profile with none of the new fields loads and is judged with them read as zero', () => {
  const old = { v: 1, memories: 40, earned: 1200, runs: 31, clears: 4, duelWins: 260, bossWins: 22, bestFloor: 2, heatCleared: 3, forgers: ['tarn', 'scrapper', 'veil', 'storm'], bought: ['tomb_bell'], codex: [], seen: ['intro'], feats: {}, featsDone: [], fresh: [] };
  const got = achCheck(db, old, null);
  for (const id of ['hammer_finds_its_weight', 'worn_handle', 'the_hammer_remembers', 'a_hammer_like_yours', 'one_coal_hotter', 'iron_glows_red', 'a_score_of_keepers', 'paid_in_memories', 'the_whole_smithy', 'heavy_with_memory', 'scratched_on_the_door']) assert.ok(got.includes(id), id);
  for (const id of ['ten_times_down', 'kiln_and_stone', 'joined_at_the_anvil', 'the_fire_climbs']) assert.ok(!got.includes(id), id + ' needs a count the old profile never kept');
  assert.ok(Array.isArray(old.ach) && typeof old.achAt === 'object');
  const run = newRun(db, { seed: 5, track: true, forger: 'tarn' }); runApply(run, { t: 'abandon' }, db); applyRun(old, run);
  assert.equal(old.descents, undefined, 'a run with no duel adds no descent'); assert.equal(old.forged, 0); assert.deepEqual(old.beaten, []);
});

// ---------- every row, and the fixtures ----------
test('every one of the 68 rows was earned by some test above', () => {
  const missing = ACH.map(r => r.id).filter(id => !everEarned.has(id));
  assert.deepEqual(missing, [], 'rows no test earned');
});

test('the golden fixtures replay hash for hash', () => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools/crucible/make-fixtures.mjs'), '--check'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout); assert.match(r.stdout, /replayed hash for hash/);
});

console.log('crucible achievements:', passed, 'tests passed, every one of', ACH.length, 'rows earned');
