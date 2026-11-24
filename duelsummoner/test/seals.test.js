import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { sealStageStart, sealHit, sealDash, sealSpend, sealMapOpened, sealKill, sealGateCleared } from '../src/sim/seals.js';
import { SEALS } from '../src/data/seals.js';
import { OATHS } from '../src/data/progress.js';
import { defaultMeta, applyRun, oathOpen, migrateSeals } from '../src/core/meta.js';
import { loadSave, writeSave, freshSave } from '../src/core/save.js';

const mk = (o = {}) => { const g = new Game(11, Object.assign({ mode: 'run', duelist: 'kael', offers: false, difficulty: 'easy' }, o)); g.events = []; const ev = g.event.bind(g); g.event = (t, d) => { g.events.push([t, d]); return ev(t, d); }; return g; };
const cracked = g => g.sealT.cracked.slice().sort();
// a stage that earns only what the test names: everything else is spoiled (hit 10 s ago, dashed, opened the map, spent coins, gate woken late, summon leveled up)
const stage = (g, o = {}) => { sealStageStart(g); const S = g.sealT.stage; g.sc = o.sc === undefined ? 600 : o.sc; g.gateOpenedAt = o.gate === undefined ? 400 : o.gate; g.t = o.t === undefined ? 1800 : o.t; g.stagesCleared = o.cleared === undefined ? 1 : o.cleared;
  S.lastHitSc = o.hit === undefined ? g.sc - 10 : o.hit; S.dashes = o.dashes === undefined ? 1 : o.dashes; S.mapOpened = o.map === undefined ? true : o.map; S.spent = o.spent === undefined ? 5 : o.spent; g.field.monsters[0].level = o.level === undefined ? 2 : o.level; sealGateCleared(g, !!o.last); return g; };

test('seals: every Oath has a riddle and a feat in one table', () => { for (const o of OATHS) assert.ok(SEALS[o.id] && SEALS[o.id].riddle && SEALS[o.id].feat, o.id); assert.equal(Object.keys(SEALS).length, OATHS.length); });

test('seals: a clear that earns nothing breaks no seal', () => { assert.deepEqual(cracked(stage(mk())), []); });

test('seal Glass: no damage in the last 3 minutes of a stage', () => {
  assert.deepEqual(cracked(stage(mk(), { hit: 400 })), ['glass']);
  assert.deepEqual(cracked(stage(mk(), { hit: 430 })), [], 'hit 170 s before the clear');
  assert.deepEqual(cracked(stage(mk(), { sc: 100, hit: -1, gate: 400 })), [], 'a stage shorter than 3 minutes cannot count');
  const live = mk(); sealStageStart(live); live.sc = 77; sealHit(live); assert.equal(live.sealT.stage.lastHitSc, 77, 'a hit is stamped with the stage clock');
});

test('seal Hasty: wake the gate before 3:00 and defeat its boss', () => {
  assert.deepEqual(cracked(stage(mk(), { gate: 179 })), ['hasty']); assert.deepEqual(cracked(stage(mk(), { gate: 181 })), []);
});

test('seal Small: a gate boss falls while the starting summon is still level 1', () => { assert.deepEqual(cracked(stage(mk(), { level: 1 })), ['small']); });

test('seal Still: a stage without one dash (and the dash counter is fed by the real sim)', () => {
  assert.deepEqual(cracked(stage(mk(), { dashes: 0 })), ['still']);
  const h = mk(); sealStageStart(h); const IDLE = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false, hold: false };
  for (let i = 0; i < 5; i++) { Object.assign(h._cmd, IDLE, { f: 1, dash: i === 1 }); h._tick(1 / 60, h._cmd); } assert.equal(h.sealT.stage.dashes, 1, 'the sim counts the dash');
});

test('seal Blind: a stage without opening the full map', () => {
  assert.deepEqual(cracked(stage(mk(), { map: false })), ['blind']); const h = mk(); sealStageStart(h); sealMapOpened(h); assert.equal(h.sealT.stage.mapOpened, true);
});

test('seal Pauper: a stage spending 0 coins (chest and shop spending both count, and a new stage starts fresh)', () => {
  assert.deepEqual(cracked(stage(mk(), { spent: 0 })), ['pauper']); const h = mk(); sealSpend(h, 30); assert.equal(h.sealT.stage.spent, 30); sealStageStart(h); assert.equal(h.sealT.stage.spent, 0, 'a new stage starts at 0');
});

test('seal Swift: all 3 stages in under 25 minutes', () => {
  assert.deepEqual(cracked(stage(mk(), { last: true, cleared: 3, t: 1499 })), ['swift']);
  assert.deepEqual(cracked(stage(mk(), { last: true, cleared: 3, t: 1501 })), []);
  assert.deepEqual(cracked(stage(mk(), { last: false, cleared: 1, t: 600 })), [], 'the first stage alone is not a swift clear');
});

test('seal Peace: summons land 300 kills before you land 50 yourself', () => {
  const g = mk(); for (let i = 0; i < 49; i++) sealKill(g, 1); for (let i = 0; i < 300; i++) sealKill(g, 0); assert.deepEqual(cracked(g), ['peace']); assert.ok(g.events.some(e => e[0] === 'sealcrack' && e[1] === 'peace'), 'the toast event fires');
  const h = mk(); for (let i = 0; i < 50; i++) sealKill(h, 1); for (let i = 0; i < 400; i++) sealKill(h, 0); assert.deepEqual(cracked(h), [], 'you landed 50 first');
  const t = mk(); for (let i = 0; i < 400; i++) sealKill(t, 2); assert.deepEqual(cracked(t), [], 'traps count for neither side');
});

test('seals: feats count only in a normal run (a full run, no Oath sworn)', () => {
  assert.deepEqual(cracked(stage(mk({ mode: 'quick' }), { dashes: 0, map: false, spent: 0, hit: 0, gate: 10, level: 1 })), []);
  assert.deepEqual(cracked(stage(mk({ oaths: ['still'] }), { dashes: 0, map: false, spent: 0, hit: 0, gate: 10, level: 1 })), []);
});

test('seals: the run report carries the cracked ids', () => { const g = mk(); g.sealT.cracked.push('glass'); assert.deepEqual(g.results({ runId: 't' }).sealsCracked, ['glass']); });

test('seals: the run report unseals the Oath for good; Oaths already kept stay open through the migration', () => {
  const m = defaultMeta(); assert.ok(OATHS.every(o => !oathOpen(m, o.id)), 'a fresh save starts fully sealed');
  const r = { result: 'loss', mode: 'run', map: 'ruins', difficulty: 'easy', duelist: 'kael', sealsCracked: ['glass', 'still'], oathsKept: [] }; applyRun(m, r); assert.deepEqual(r.newSeals.slice().sort(), ['glass', 'still']); assert.ok(oathOpen(m, 'glass') && oathOpen(m, 'still') && !oathOpen(m, 'peace'));
  const r2 = { result: 'loss', mode: 'run', map: 'ruins', difficulty: 'easy', duelist: 'kael', sealsCracked: ['glass'], oathsKept: [] }; applyRun(m, r2); assert.deepEqual(r2.newSeals, [], 'an already open seal is not new again');
  const old = { v: 3, records: {}, settings: {}, meta: Object.assign(defaultMeta(), { oathCount: { pauper: 2, blind: 0, swift: 1 } }) }; delete old.meta.oathsOpen;
  assert.deepEqual(loadSave({ save: { load: () => old } }).meta.oathsOpen.slice().sort(), ['pauper', 'swift'], 'keepers stay open, an Oath never kept is sealed');
  const v2 = { v: 2, records: {}, settings: {}, meta: Object.assign(defaultMeta(), { oathCount: { hasty: 1 } }) }; delete v2.meta.oathsOpen; delete v2.meta.diffUnlock;
  assert.deepEqual(loadSave({ save: { load: () => v2 } }).meta.oathsOpen, ['hasty']);
  const store = {}, fs2 = freshSave(); fs2.meta.oathsOpen = ['small']; writeSave({ save: { write: o => { store.s = JSON.parse(JSON.stringify(o)); return true; } } }, fs2); assert.deepEqual(loadSave({ save: { load: () => store.s } }).meta.oathsOpen, ['small']);
  assert.deepEqual(migrateSeals({ oathsOpen: ['x'], oathCount: { y: 1 } }).oathsOpen, ['x'], 'an already migrated meta is untouched');
});

test('seals: Still, Blind and Pauper need a stage of at least 6:00; Small needs the boss felled after 3:00', () => {
  assert.deepEqual(cracked(stage(mk(), { sc: 359, dashes: 0, hit: 358 })), [], 'Still on a 5:59 stage');
  assert.deepEqual(cracked(stage(mk(), { sc: 360, dashes: 0, hit: 359 })), ['still']);
  assert.deepEqual(cracked(stage(mk(), { sc: 359, map: false, hit: 358 })), [], 'Blind on a 5:59 stage');
  assert.deepEqual(cracked(stage(mk(), { sc: 359, spent: 0, hit: 358 })), [], 'Pauper on a 5:59 stage');
  assert.deepEqual(cracked(stage(mk(), { sc: 4, level: 1, hit: 0, gate: 400 })), [], 'a boss felled at 0:04 with a level 1 summon (a new player who never levels)');
  assert.deepEqual(cracked(stage(mk(), { sc: 179, level: 1, hit: 178 })), [], 'Small before 3:00');
  assert.deepEqual(cracked(stage(mk(), { sc: 180, level: 1, hit: 179 })), ['small']);
});

test('seals: at most two seals break from one stage clear, the first two in table order; the rest wait for a later clear', () => {
  const g = mk(); stage(g, { sc: 700, hit: 100, gate: 100, level: 1, dashes: 0, map: false, spent: 0 });
  assert.deepEqual(g.sealT.cracked, ['glass', 'hasty'], 'five or more feats met: only the first two in table order');
  assert.equal(g.events.filter(e => e[0] === 'sealcrack').length, 2);
  sealStageStart(g); const S = g.sealT.stage; S.lastHitSc = 690; S.dashes = 0; S.mapOpened = false; S.spent = 0; g.sc = 700; g.gateOpenedAt = 100; g.field.monsters[0].level = 1; sealGateCleared(g, false);
  assert.deepEqual(g.sealT.cracked, ['glass', 'hasty', 'small', 'still'], 'the next clear breaks the next two that are met');
});
