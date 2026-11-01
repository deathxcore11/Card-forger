// Collector packs (every card holo, same pull rates) and god packs (Wizards' 2027 odds).
import assert from 'node:assert/strict';
// God packs (Wizards' 2027 odds) and Collector packs (every card holo, same pull rates).
{
  const {mtgGodPackPicks, GOD_PACK_ODDS} = await import('./mtg-boosters.js');
  const {collectorPicks, isCollectorPack, collectorSource, godPackOdds, collectorOdds} = await import('./play-econ-rules.js');
  const cards = new Map([...Array(20)].map((_, i) => ['r' + i, {id: 'r' + i, name: 'R' + i, rarity: i < 4 ? 'mythic' : 'rare'}]));
  const data = {sheets: {rareMythic: {cards: [...cards.keys()].map((id, i) => [id, i < 4 ? 1 : 2])}, common: {cards: []}}};
  const god = mtgGodPackPicks(data, cards, 14, Math.random);
  assert.equal(god.length, 14); assert.equal(god.godPack, true); assert(god.every(c => c.packFoil && /^(rare|mythic)$/.test(c.rarity)));
  assert.equal(new Set(god.map(c => c.id)).size, 14, 'a god pack never repeats a card');
  assert.equal(mtgGodPackPicks(data, cards, 21, Math.random), null, 'no god pack when the sheets cannot fill it');
  assert.equal(GOD_PACK_ODDS.regular, 1 / 1000); assert.equal(GOD_PACK_ODDS.collector, 1 / 300);
  assert.equal(godPackOdds({}, 'collector'), 1 / 300); assert.equal(godPackOdds({godPackOdds: {regular: .01}}), .01);
  assert.equal(collectorOdds({}), 1 / 200);
  assert.equal(isCollectorPack({source: collectorSource('story')}), true); assert.equal(collectorSource('story'), 'story:collector'); assert.equal(isCollectorPack({source: 'story'}), false);
  const c = collectorPicks([{id: 'a', rarity: 'common'}]); assert(c.collector && c[0].packFoil);
}
{
  const {achievementReward, rewardDelta, ACHIEVEMENTS} = await import('./play-achievements.js');
  const a = ACHIEVEMENTS.find(x => !x.feat && x.steps.length >= 3), last = a.steps.length >= 4 ? 3 : 2;
  assert.equal(achievementReward(a, 0, {}).collector, undefined, 'bronze steps give no Collector pack');
  assert.equal(achievementReward(a, last, {}).collector, 1, 'hard steps give a Collector pack');
  assert.deepEqual(rewardDelta([{collector: 1}], 'fdn', 'achievement').packs, [{set: 'fdn', source: 'achievement:collector'}]);
}
console.log('collector + god packs ok');
