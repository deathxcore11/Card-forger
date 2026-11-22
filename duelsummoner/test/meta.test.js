import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta, deckMods, simMeta, buyUpgrade, upgradeCost, applyRun, rankOf } from '../src/core/meta.js';
import { Game } from '../src/sim/game.js';
import { buildOffer } from '../src/sim/field.js';
import { STARTER, QUESTS, DECK_BOX } from '../src/data/meta.js';

test('Deck Box: 12 upgrades, 5 ranks each, bought with Star Chips', () => {
  assert.equal(Object.keys(DECK_BOX).length, 12); for (const k of Object.keys(DECK_BOX)) assert.equal(DECK_BOX[k].cost.length, 5);
  const m = defaultMeta(); assert.equal(upgradeCost(m, 'maxLp'), 20);
  assert.equal(buyUpgrade(m, 10, 'maxLp'), null, 'not enough chips');
  assert.equal(buyUpgrade(m, 100, 'maxLp'), 80); assert.equal(rankOf(m, 'maxLp'), 1);
  for (let i = 0; i < 4; i++) buyUpgrade(m, 1000, 'maxLp'); assert.equal(rankOf(m, 'maxLp'), 5); assert.equal(upgradeCost(m, 'maxLp'), null, 'max rank');
  assert.equal(deckMods(m).maxLp, 25);
});

test('Deck Box modifiers reach the run: LP, Redraws, starting level, Opening Hand', () => {
  const m = defaultMeta(); m.deck = { maxLp: 3, redraws: 4, startLevel: 5, openingHand: 1, armour: 4, luck: 2 };
  const g = new Game(5, { meta: simMeta(m) });
  assert.equal(g.p.maxHp, 115); assert.equal(g.field.redraws, 2 + 2); assert.equal(g.field.monsters[0].level, 3);
  assert.equal(g.field.spells.filter(Boolean).length, 1, 'one random Spell to start'); assert.equal(g.mods.armour, 2); assert.ok(Math.abs(g.mods.luck - 0.04) < 1e-9);
});

test('Card Library: locked cards and items never appear; a quest unlocks them', () => {
  const m = defaultMeta(); const g = new Game(8, { meta: simMeta(m) }); g.level = 2;
  const locked = new Set(['kindling-rite', 'deep-marks', 'pit-of-seals', 'storm-of-cards', 'second-wind']);
  for (let k = 0; k < 60; k++) for (const c of buildOffer(g)) assert.ok(!locked.has(c.id), c.id + ' is locked');
  const done = applyRun(m, { time: 400, kills: 600, level: 16, fusions: 1, bossKilled: false, wardenKilled: true, overtime: 0, trapSet: true, chests: 0, vases: 0 });
  assert.deepEqual(done.map(q => q.id).sort(), ['fuse1', 'husks500', 'level15', 'survive6', 'warden'].sort());
  for (const id of ['kindling-rite', 'deep-marks', 'pit-of-seals', 'storm-of-cards', 'hunters-mark']) assert.ok(m.unlockedCards.includes(id) || m.unlockedItems.includes(id), id);
  assert.ok(applyRun(m, { time: 10, kills: 1, level: 1, fusions: 0 }).length === 0, 'a quest pays out once');
  const g2 = new Game(8, { meta: simMeta(m) }); g2.level = 2; let seen = false;
  for (let k = 0; k < 80 && !seen; k++) for (const c of buildOffer(g2)) if (c.id === 'kindling-rite') seen = true;
  assert.ok(seen, 'unlocked card can be offered now');
});

test('items are filtered by unlocks too (stone and broker)', () => {
  const m = defaultMeta(); for (let seed = 1; seed <= 20; seed++) { const g = new Game(seed, { meta: simMeta(m) }); for (const s of g.world.broker.stock) assert.ok(STARTER.items.includes(s.id), s.id + ' locked'); }
});

test('quests are data: every unlock exists', () => { assert.ok(QUESTS.length >= 10); for (const q of QUESTS) assert.ok(q.unlock.card || q.unlock.item); });

