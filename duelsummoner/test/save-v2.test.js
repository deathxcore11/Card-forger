import test from 'node:test'; import assert from 'node:assert/strict';
import { loadSave, writeSave, migrateV1, freshSave, SAVE_VERSION, overridesOf } from '../src/core/save.js';
import { defaultMeta } from '../src/data/../core/meta.js';
// Save v2: settings on disk are overrides only; a v1 save migrates without losing progress; a newer save is never written over.
const hostWith = (obj) => { const h = { wrote: [], save: { load: () => obj, write: o => { h.wrote.push(o); return true; } } }; return h; };
const v1 = () => ({ v: 1, records: { kael: { bestTime: 90, mostKills: 40, highestLevel: 7, runs: 3, bossKills: 1 } }, starChips: 321, runs: 3, bossKills: 1, meta: Object.assign(defaultMeta(), { unlockedCards: ['ember-wyvern', 'gust-ward'] }), settings: { reduceMotion: true, shake: 60, difficulty: 'hard', fov: 100, fpsCap: 60 } });

test('a v1 save migrates to v2 and keeps progress, reduceMotion, shake and difficulty', () => {
  const s = loadSave(hostWith(v1()));
  assert.equal(s.v, SAVE_VERSION); assert.equal(s.starChips, 321); assert.equal(s.records.kael.mostKills, 40); assert.ok(s.meta.unlockedCards.includes('gust-ward'));
  assert.equal(s.settings.reduceMotion, true); assert.equal(s.settings.shake, 60); assert.equal(s.settings.difficulty, 'hard'); assert.equal(s.settings.fov, 100);
});
test('v1 values equal to the v1 defaults are dropped, not stored as overrides (shake excepted); shake is stored as camShake', () => {
  const m = migrateV1(v1()); assert.deepEqual(m.settings, { reduceMotion: true, camShake: 60, difficulty: 'hard' });
  const h = hostWith(v1()), s = loadSave(h); writeSave(h, s); assert.deepEqual(h.wrote[0].settings, { reduceMotion: true, camShake: 60, difficulty: 'hard' }); assert.equal(h.wrote[0].v, SAVE_VERSION);
  const d = v1(); d.settings = { reduceMotion: false, shake: 100, difficulty: 'medium', fov: 100, fpsCap: 60 }; assert.deepEqual(migrateV1(d).settings, { camShake: 100 }, 'a v1 player keeps their shake 100 (the new default is 80); the other v1 defaults are dropped');
  const fresh = loadSave(hostWith(null)); assert.equal(fresh.settings.shake, 80, 'a new save starts at the spec default 80');
  const keep = loadSave(hostWith(d)); assert.equal(keep.settings.shake, 100);
});
test('a fresh save writes no settings at all and a default that changes later reaches it', () => {
  const h = hostWith(null), s = loadSave(h); writeSave(h, s); assert.deepEqual(h.wrote[0].settings, {});
  s.settings.fov = 90; assert.deepEqual(overridesOf(s.settings), { fov: 90 });
});
test('a save from a newer build is shown as fresh and never overwritten', () => {
  const h = hostWith({ v: 99, starChips: 5, settings: { x: 1 } }), s = loadSave(h);
  assert.equal(s.starChips, 0); assert.equal(writeSave(h, s), false); assert.equal(h.wrote.length, 0);
});
