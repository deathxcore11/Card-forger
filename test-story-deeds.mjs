// Story deeds and the match facts they read (story-deeds.js, match-facts.js).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createMatchFacts, factsMeet} from './match-facts.js';
import {STORY_DEEDS, STORY_ACT_DEEDS, storyDeedsEarned, storyDeedArt, storyDeedReward} from './story-deeds.js';
import {ACHIEVEMENTS, achievementReward} from './play-achievements.js';

// --- The tracker reads a Forge surface the way the table shows it ---------------------------------
const card = (id, controller, name, extra = {}) => ({id, zone: 'Battlefield', owner: controller, controller, known: true, name, types: ['Creature'], type: 'Creature - Goblin', power: 2, ...extra});
const surface = (turn, activeSeat, cards, life = [20, 20], more = {}) => ({seat: 0, turn, activeSeat, players: [{seat: 0, life: life[0], handCount: 5, libraryCount: 40}, {seat: 1, life: life[1], handCount: 4, libraryCount: 40, ...more}], cards});
const t = createMatchFacts();
t.update(surface(1, 0, [card(1, 0, 'Goblin King', {attacking: true})]));
// The turn number can tick before the active player does: the turn goes to whoever the table last showed.
t.update(surface(2, 0, [card(1, 0, 'Goblin King'), card(9, 1, 'Serra Angel', {flying: true})]));
t.update(surface(2, 1, [card(1, 0, 'Goblin King'), card(9, 1, 'Serra Angel', {flying: true})], [17, 20]));
t.update(surface(3, 0, [card(1, 0, 'Goblin King', {attacking: true}), card(2, 0, 'Goblin Raider', {attacking: true, isToken: true}), {...card(9, 1, 'Serra Angel'), zone: 'Graveyard'}], [17, 14]));
t.update(surface(3, 0, [card(1, 0, 'Goblin King'), {id: 7, zone: 'Battlefield', owner: 0, controller: 0, known: false}], [21, 9]));
t.update(surface(4, 1, [card(1, 0, 'Goblin King'), card(7, 0, 'Echo Tracer', {type: 'Creature - Human Wizard'})], [21, 9]));
const f = t.snapshot({onPlay: true});
assert.equal(f.turns, 4); assert.equal(f.myTurns, 2, 'turns 1 and 3 were yours');
assert.equal(f.minLife, 17); assert.equal(f.endLife, 21); assert.equal(f.lifeGained, 4);
assert.equal(f.oppBigTurn, 11, 'turn 3 took the opponent from 20 to 9');
assert.equal(f.maxAttackers, 2); assert.equal(f.maxTokens, 1); assert.equal(f.kills, 1); assert.deepEqual(f.killed, ['Serra Angel']);
assert.equal(f.losses, 1, 'the Goblin Raider token vanished'); assert.equal(f.turnedUp, 1); assert.equal(f.maxFaceDown, 1);
assert.equal(f.tribes.Goblin, 2); assert.ok(f.theirCards.includes('Serra Angel'));
// Conditions are data.
assert.ok(factsMeet(f, {myTurns: ['<=', 2], killed: 'Serra Angel', tribe: ['Goblin', '>=', 2], onPlay: true}));
assert.ok(!factsMeet(f, {notTheirs: 'Serra Angel'}));
assert.ok(!factsMeet(f, {survived: 'Goblin Raider'}), 'a creature that died never survived');
assert.ok(factsMeet(f, {survived: 'Goblin King'}));
assert.ok(!factsMeet({}, {minLife: ['>=', 0]}), 'a fact the match never reported fails');

// --- Every deed reads cards that are really in its battle -------------------------------------------
const acts = {};
for (let a = 1; a <= 33; a++) acts[a] = JSON.parse(readFileSync(new URL(`./data/story/act-${a}.json`, import.meta.url), 'utf8'));
const deckNames = side => side.deck.cards.flatMap(c => [c.name, c.name.split(' // ')[0]]);
const ids = new Set(), arts = new Set();
for (const d of [...STORY_DEEDS, ...STORY_ACT_DEEDS]) {
  assert.ok(!ids.has(d.id), 'unique id ' + d.id); ids.add(d.id);
  const art = storyDeedArt(d); assert.ok(art && !arts.has(art), 'unique art ' + d.id); arts.add(art);
}
const perBattle = {};
for (const d of STORY_DEEDS) {
  const b = acts[d.act].battles.find(x => x.id === d.battle);
  assert.ok(b, d.id + ' names a real battle');
  perBattle[d.battle] = (perBattle[d.battle] || 0) + 1;
  const mine = deckNames(d.seat === 'hero' ? b.hero : b.villain), theirs = deckNames(d.seat === 'hero' ? b.villain : b.hero);
  for (const k of ['mine', 'mineAny', 'survived']) for (const n of [].concat(d.when[k] || [])) assert.ok(mine.includes(n), `${d.id}: ${n} is in your deck`);
  for (const k of ['killed', 'killedAny', 'notTheirs']) for (const n of [].concat(d.when[k] || [])) assert.ok(theirs.includes(n), `${d.id}: ${n} is in their deck`);
  if (d.hidden || d.gold) assert.ok(d.riddle, d.id + ' has a riddle');
  assert.ok(['hero', 'villain'].includes(d.seat));
}
// At least two deeds a battle, and never more than the deeds route takes from one win (8).
for (const a of Object.values(acts)) for (const b of a.battles) assert.ok(perBattle[b.id] >= 2, b.id + ' has two deeds');
assert.ok(Math.max(...Object.values(perBattle)) + 2 <= 8);

// --- Earning: Story decks only, from the deed's own seat ---------------------------------------------
const won = {seat: 'hero', own: false, myTurns: 5, minLife: 12, endLife: 12, killed: ['Goblin King'], myCards: [], theirCards: ['Goblin King']};
assert.deepEqual(storyDeedsEarned('a1b2', won), ['a1-toll-unpaid', 'a1-regicide']);
assert.deepEqual(storyDeedsEarned('a1b2', {...won, own: true}), [], 'your own deck earns no battle deeds');
assert.deepEqual(storyDeedsEarned('a1b8', {seat: 'villain', maxPower: 6}), ['a1-v-dragon-engine']);
const refs = Array.from({length: 8}, (_, i) => `story:a3b${i + 1}:loaner`);
assert.ok(storyDeedsEarned('a3b8', {seat: 'hero', own: true}, refs).includes('a3-chronicler'));
// Rewards vary with difficulty: XP only, a common seal, an uncommon seal; act deeds a pack; hidden a rare seal.
const kinds = new Set(STORY_DEEDS.map(storyDeedReward));
for (const k of ['xp', 'common', 'uncommon', null]) assert.ok(kinds.has(k), 'some deeds pay ' + k);
assert.ok(STORY_ACT_DEEDS.every(d => storyDeedReward(d) === 'feat'));
const pay = id => achievementReward(ACHIEVEMENTS.find(a => a.id === id), 0, {});
const xpOnly = STORY_DEEDS.find(d => storyDeedReward(d) === 'xp');
assert.deepEqual(pay(xpOnly.id), {xp: 100});
assert.equal(pay(STORY_DEEDS.find(d => storyDeedReward(d) === 'uncommon').id).seals.u, 1);
assert.equal(pay('a15-endless-court').seals.r, 1); assert.equal(pay('a15-endless-court').collector, 1, 'hidden riddles pay a Collector pack');
assert.equal(pay('a1-chronicler').packs, 1);
console.log('story deeds ok');

// Key feats gate each act's secret boss (Randall, 4 Nov 2026): 3 hero-side deeds per act, earned with the Story decks.
{
  const {KEY_FEATS, storyKeyFeats, keyFeatsMissing} = await import('./story-deeds.js');
  const {secretOpen, secretStatus} = await import('./story-client.js');
  for (let a = 1; a <= 33; a++) {
    const ids = storyKeyFeats(a); assert.equal(ids.length, 3, `act ${a} has 3 key feats`);
    assert.equal(new Set(ids.map(id => STORY_DEEDS.find(d => d.id === id)?.battle)).size, 3, `act ${a} keys come from 3 different battles`);
    for (const id of ids) { const d = STORY_DEEDS.find(x => x.id === id); assert.ok(d && d.act === a && d.seat !== 'villain' && !d.gold && /b[1-8]$/.test(d.battle), `${id} is a hero-side deed of battles 1-8`); }
  }
  assert.deepEqual(Object.keys(KEY_FEATS).length, 33);
  const won = n => ({battles: Object.fromEntries(Array.from({length: 8}, (_, i) => [`a${n}b${i + 1}`, {loaner: true}]))});
  const keys = storyKeyFeats(1), earned = Object.fromEntries(keys.map(id => ['sd:' + id, 1]));
  assert.equal(secretOpen(won(1), 1, {}), false, 'all 8 won but no key feats: locked');
  assert.equal(secretOpen(won(1), 1, {['sd:' + keys[0]]: 1}), false, 'one key feat is not enough');
  assert.equal(secretOpen(won(1), 1, earned), true, 'all 8 won and all keys: open');
  assert.equal(secretOpen({battles: {a1b1: {loaner: true}}}, 1, earned), false, 'keys without the 8 wins: locked');
  assert.equal(secretOpen({battles: {a1b9: {clear: true}}}, 1, {}), true, 'a cleared secret boss stays open');
  assert.deepEqual(keyFeatsMissing(1, {['sd:' + keys[0]]: 1}), keys.slice(1));
  assert.deepEqual(secretStatus(won(1), 1, {['sd:' + keys[0]]: 1}), {won: 8, keys: 1, keysNeeded: 3});
}
