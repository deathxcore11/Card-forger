import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, applyRun, diffUnlocked, migrateDiffUnlock } from '../src/core/meta.js';
import { loadSave, writeSave, freshSave, SAVE_VERSION } from '../src/core/save.js';

const run = (meta, o) => applyRun(meta, Object.assign({ result: 'win', mode: 'run', map: 'ruins', difficulty: 'easy', duelist: 'kael', score: 100, timeSurvived: 900, kills: 10, stagesCleared: 3 }, o));
const host = store => ({ save: { load: () => store.s || null, write: o => { store.s = JSON.parse(JSON.stringify(o)); return true; } } });

test('unlock order: Easy is open, Medium needs a full-run clear on Easy, Hard one on Medium', () => {
  const m = defaultMeta(); assert.ok(diffUnlocked(m, 'ruins', 'easy')); assert.ok(!diffUnlocked(m, 'ruins', 'medium')); assert.ok(!diffUnlocked(m, 'ruins', 'hard'));
  run(m, { result: 'loss' }); assert.ok(!diffUnlocked(m, 'ruins', 'medium'), 'a loss clears nothing');
  run(m, { mode: 'quick' }); assert.ok(!diffUnlocked(m, 'ruins', 'medium'), 'a Quick Duel win does not count as a clear');
  run(m, { difficulty: 'easy' }); assert.ok(diffUnlocked(m, 'ruins', 'medium')); assert.ok(!diffUnlocked(m, 'ruins', 'hard'), 'Easy opens Medium only');
  run(m, { difficulty: 'medium' }); assert.ok(diffUnlocked(m, 'ruins', 'hard'), 'Medium opens Hard');
  assert.ok(!diffUnlocked(m, 'other', 'medium'), 'unlocks are per map');
});

test('unlock order: a clear on Hard or a quick clear on Medium changes nothing it should not', () => {
  const m = defaultMeta(); run(m, { difficulty: 'easy', mode: 'quick' }); run(m, { difficulty: 'medium', mode: 'quick' }); assert.ok(!diffUnlocked(m, 'ruins', 'medium') && !diffUnlocked(m, 'ruins', 'hard'));
  run(m, { difficulty: 'easy' }); run(m, { difficulty: 'hard' }); assert.ok(diffUnlocked(m, 'ruins', 'medium')); assert.ok(!diffUnlocked(m, 'ruins', 'hard'), 'Hard is not opened by clearing Hard; only Medium opens it');
});

test('save migration: a save from before the unlock order keeps every difficulty it had played or cleared', () => {
  const old = { v: 2, records: {}, starChips: 5, runs: 3, bossKills: 0, settings: {}, meta: Object.assign(defaultMeta(), { maps: {
    'ruins:easy': { bestScore: 900, bestTime: 840, cleared: ['kael'] },            // cleared Easy: Medium opens
    'ruins:hard': { bestScore: 300, bestTime: 0, cleared: [] },                   // played Hard without clearing it: Hard stays open (and so does Medium under it)
    'ruins:medium:quick': { bestScore: 50, bestTime: 600, cleared: ['mira'] } } }) };
  delete old.meta.diffUnlock; const store = { s: old }, s = loadSave(host(store));
  assert.equal(s.v, SAVE_VERSION); assert.ok(diffUnlocked(s.meta, 'ruins', 'medium')); assert.ok(diffUnlocked(s.meta, 'ruins', 'hard'), 'a difficulty already played stays open');
  assert.equal(s.meta.maps['ruins:easy'].bestScore, 900, 'records are kept'); assert.equal(s.starChips, 5);
  const only = { v: 2, records: {}, settings: {}, meta: Object.assign(defaultMeta(), { maps: { 'ruins:medium': { bestScore: 400, bestTime: 1000, cleared: ['kael'] } } }) }; delete only.meta.diffUnlock;
  const s2 = loadSave(host({ s: only })); assert.ok(diffUnlocked(s2.meta, 'ruins', 'medium') && diffUnlocked(s2.meta, 'ruins', 'hard'), 'a Medium clear opens Hard');
  const q = { v: 2, records: {}, settings: {}, meta: Object.assign(defaultMeta(), { maps: { 'ruins:easy:quick': { bestScore: 400, bestTime: 1000, cleared: ['kael'] } } }) }; delete q.meta.diffUnlock;
  const s3 = loadSave(host({ s: q })); assert.ok(!diffUnlocked(s3.meta, 'ruins', 'medium'), 'a Quick Duel record does not unlock anything');
  const fresh = loadSave(host({})); assert.ok(!diffUnlocked(fresh.meta, 'ruins', 'medium'));
});

test('save: the unlocks are written and read back, and survive a version-3 round trip', () => {
  const store = {}, h = host(store), s = freshSave(); run(s.meta, { difficulty: 'easy' }); writeSave(h, s); assert.equal(store.s.v, 3);
  const back = loadSave(h); assert.ok(diffUnlocked(back.meta, 'ruins', 'medium')); assert.ok(!diffUnlocked(back.meta, 'ruins', 'hard'));
  const again = migrateDiffUnlock({ maps: {}, diffUnlock: { ruins: ['medium'] } }); assert.deepEqual(again.diffUnlock, { ruins: ['medium'] }, 'an already migrated meta is untouched');
});
