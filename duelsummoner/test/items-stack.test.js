import test from 'node:test'; import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js'; import { addItem, chooseCard } from '../src/sim/field.js';
import { ITEMS, ITEM_CAPS } from '../src/data/items.js'; import { spawnEnemy } from '../src/sim/enemies.js'; import { killEnemy } from '../src/sim/combat.js';
import { CAP, capLimit } from '../src/sim/caps.js'; import { openCardChest } from '../src/sim/world.js';
const mk = seed => { const g = new Game(seed, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; return g; };

test('S1: a second copy of a stacking item changes the stat sheet; ceilings stop a pile of copies', () => {
  const g = mk(3); addItem(g, 'sand-sandals'); const one = g.mods.move; addItem(g, 'sand-sandals'); const two = g.mods.move;
  assert.ok(Math.abs(two - one * 2) < 1e-9, 'two Sand Sandals give twice the speed: ' + one + ' then ' + two); assert.equal(g.items.filter(x => x === 'sand-sandals').length, 2);
  for (let i = 0; i < 40; i++) addItem(g, 'sand-sandals'); assert.equal(g.mods.move, ITEM_CAPS.move, 'capped at the ceiling'); assert.ok(g.mods.raw.move > ITEM_CAPS.move, 'the raw sum is kept for the stat panel');
  for (let i = 0; i < 20; i++) { addItem(g, 'traders-seal'); addItem(g, 'travelling-cloak'); addItem(g, 'whetstone-tablet'); addItem(g, 'dueling-boots'); }
  assert.equal(g.mods.shopDiscount, ITEM_CAPS.shopDiscount); assert.equal(g.mods.dashCd, ITEM_CAPS.dashCd); assert.equal(g.mods.crit, ITEM_CAPS.crit); assert.equal(g.mods.airJumps, ITEM_CAPS.airJumps);
});

test('S1: every stacking item changes the sheet with a second copy, and every unique item refuses one', () => {
  for (const id of Object.keys(ITEMS)) {
    const g = mk(5); assert.ok(addItem(g, id), id + ' first copy'); const snap = JSON.stringify(g.mods, (k, v) => (k === 'raw' ? undefined : v));
    const second = addItem(g, id);
    if (ITEMS[id].unique) { assert.equal(second, false, id + ' is unique'); assert.equal(g.items.filter(x => x === id).length, 1); }
    else { assert.ok(second, id + ' stacks'); assert.notEqual(JSON.stringify(g.mods, (k, v) => (k === 'raw' ? undefined : v)), snap, id + ': the second copy changes the sheet (or is a counted copy)'); }
  }
});

test('S1: a unique item is never offered or sold again once owned', () => {
  const g = mk(7); assert.ok(ITEMS['burning-deck'].unique && ITEMS['jar-of-avarice'].unique); addItem(g, 'burning-deck'); addItem(g, 'jar-of-avarice');
  g.world.broker = null; const stock = [{ id: 'burning-deck', price: 60, sold: false }, { id: 'sand-sandals', price: 30, sold: false }]; g.world.broker = { x: 0, y: 0, z: 0, stock };
  g.coins = 999; g.offer = { type: 'shop', cards: stock.map(s => ({ id: s.id, kind: 'item', price: s.price, sold: false, stockRef: s, rarity: ITEMS[s.id].rarity })), leave: true };
  assert.equal(chooseCard(g, 0), false, 'the shop refuses a second Burning Deck'); assert.equal(g.items.filter(x => x === 'burning-deck').length, 1); assert.equal(chooseCard(g, 1), true);
});
