// Meta and menus data: Oaths in the sim, mastery, map records, the quest tracker, the library switch, replay with oaths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { OATHS, OATH_BY_ID, masteryRank, MASTERY, DIFF_CHIPS, LIBRARY_MIN } from '../src/data/progress.js';
import { defaultMeta, applyRun, closestQuests, setCardEnabled, simMeta, masteryOf, mapRecord, outfitUnlocked, statValue } from '../src/core/meta.js';
import { QUESTS } from '../src/data/quests.js';
import { packReplay } from '../src/core/replay.js';
import { verifyReplay, nodeDeflate } from '../tools/verify.mjs';
import { newBot, botRecord } from '../tools/bot.mjs';

const idle = { mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 };
const mk = (oaths, mode = 'run') => new Game(4, { mode, oaths, offers: false, duelist: 'kael' });

test('eight Oaths, each its own quest with a reward', () => {
  assert.equal(OATHS.length, 8); for (const o of OATHS) { assert.ok(QUESTS.some(q => q.id === 'oath-' + o.id && q.reward.chips > 0), o.id); }
});
test('Glass Oath: 1 LP and it cannot be raised', () => {
  const g = mk(['glass']); assert.equal(g.p.maxHp, 1); assert.equal(g.p.hp, 1); g.p.hp = 1; g.addXp(0); for (let i = 0; i < 120; i++) g.tick(idle); assert.equal(g.p.maxHp, 1);
});
test('Hasty Oath: 1.25x ticks per real second', () => {
  const a = mk([]), b = mk(['hasty']); a.fixed(1, idle); b.fixed(1, idle); a.acc = b.acc = 0;
  let na = 0, nb = 0; for (let i = 0; i < 600; i++) { const t0 = a.tickN; a.fixed(1 / 240, idle); na += a.tickN - t0; const u0 = b.tickN; b.fixed(1 / 240, idle); nb += b.tickN - u0; }
  assert.ok(nb > na * 1.2 && nb < na * 1.3, 'ticks ' + na + ' vs ' + nb);
});
test('Still Oath: no dash. Peace Oath: no damage from your cards for 3 minutes. Pauper: no Broker', () => {
  const g = mk(['still']); g.p.dashCd = 0; g.tick({ mx: 127, mz: 0, yaw: 0, buttons: 2, menu: 0 }); assert.ok(!(g.p.dashT > 0), 'no dash');
  const f = mk([]); f.p.dashCd = 0; f.tick({ mx: 127, mz: 0, yaw: 0, buttons: 2, menu: 0 }); assert.ok(f.p.dashT > 0, 'dash works without the Oath');
  const p = mk(['peace']); let dealt = 0; p.spawnAcc = 40; for (let i = 0; i < 1200; i++) p.tick(idle); dealt = (p.dealtLog['card-throw'] || []).reduce((a, b) => a + (b || 0), 0); assert.equal(dealt, 0, 'no card damage in the first minute');
  const n = mk([]); n.spawnAcc = 40; for (let i = 0; i < 1200; i++) n.tick(idle); assert.ok((n.dealtLog['card-throw'] || []).reduce((a, b) => a + (b || 0), 0) > 0, 'cards do damage without the Oath');
  const q = new Game(4, { mode: 'run', oaths: ['pauper'], offers: false }); assert.equal(q.world.broker, null);
  assert.ok(new Game(4, { mode: 'run', offers: false }).world.broker);
});
test('Oaths are in the report, raise the score multiplier, and the replay verifier replays them', () => {
  const g = new Game(6, { mode: 'run', oaths: ['small', 'still', 'nonsense'], offers: true, duelist: 'kael' }); const bot = newBot({ focus: true });
  for (let i = 0; i < 3000 && !g.over; i++) g.tick(botRecord(g, bot));
  const r = g.results({}); assert.deepEqual(r.oaths, ['small', 'still']); assert.equal(r.map, 'ruins');
  const base = new Game(6, { mode: 'run', offers: false }); base.kills = g.kills; base.roleKills = g.roleKills; base.stagesCleared = g.stagesCleared; base.fusions = g.fusions;
  assert.ok(g.score() >= Math.floor(base.score() * 1.1), 'two Oaths raise the multiplier');
  const rec = packReplay(g.replayRaw(), nodeDeflate); assert.deepEqual(rec.oaths, ['small', 'still']); assert.equal(verifyReplay(rec).ok, true);
  assert.equal(verifyReplay({ ...rec, oaths: [] }).ok, false, 'dropping an Oath from the record fails verification');
});
test('Swift Oath: kept only with every stage cleared in under 20 minutes', () => {
  const g = mk(['swift', 'glass']); g.stagesCleared = 3; g.scTotal = 1100; g.sc = 50; assert.deepEqual(g.results({}).oathsKept, ['swift', 'glass']);
  g.scTotal = 1180; g.sc = 50; assert.deepEqual(g.results({}).oathsKept, ['glass']); g.stagesCleared = 2; assert.deepEqual(g.results({}).oathsKept, []);
});
test('mastery: rank from kills and runs, saved per duelist, outfit at 15,000 kills', () => {
  const m = defaultMeta(); assert.equal(masteryRank(undefined).rank, 1);
  applyRun(m, { duelist: 'kael', kills: 14000, result: 'loss' }); assert.equal(masteryOf(m, 'kael').rank >= 5, true); assert.equal(masteryOf(m, 'mira').rank, 1);
  const outfit = { id: 'kael-1', killsNeeded: MASTERY.outfitKills }; assert.equal(outfitUnlocked(m, 'kael', outfit), false);
  applyRun(m, { duelist: 'kael', kills: 1500, result: 'loss' }); assert.equal(outfitUnlocked(m, 'kael', outfit), true); assert.ok(m.questsDone.includes('mastery-kael-5'), 'the rank 5 quest pays its outfit'); assert.ok(m.outfits.includes('kael-2'));
});
test('map records, chips multipliers and Oath quests', () => {
  assert.deepEqual(DIFF_CHIPS, { easy: 1.0, medium: 1.1, hard: 1.2 });
  const m = defaultMeta(); applyRun(m, { duelist: 'kael', map: 'ruins', difficulty: 'hard', mode: 'run', result: 'win', stagesCleared: 3, score: 5000, timeSurvived: 1500, kills: 100, oathsKept: ['glass'], oaths: ['glass'] });
  const rec = mapRecord(m, 'ruins', 'hard', 'run'); assert.equal(rec.bestScore, 5000); assert.equal(rec.bestTime, 1500); assert.deepEqual(rec.cleared, ['kael']);
  applyRun(m, { duelist: 'mira', map: 'ruins', difficulty: 'hard', mode: 'run', result: 'win', stagesCleared: 3, score: 4000, timeSurvived: 1400, kills: 10 });
  const r2 = mapRecord(m, 'ruins', 'hard', 'run'); assert.equal(r2.bestScore, 5000); assert.equal(r2.bestTime, 1400); assert.deepEqual(r2.cleared, ['kael', 'mira']);
  assert.ok(m.questsDone.includes('oath-glass')); assert.ok(m.duelists.includes('vesh'), 'clearing a stage on Hard unlocks Vesh'); assert.equal(mapRecord(m, 'ruins', 'hard', 'quick').bestScore, 0);
});
test('quest tracker: the four closest to done, with progress', () => {
  const m = defaultMeta(); applyRun(m, { kills: 450, level: 14, result: 'loss', duelist: 'kael' });
  const top = closestQuests(m, 4); assert.equal(top.length, 4); assert.ok(top[0].frac >= top[3].frac); assert.ok(top.some(t => t.q.id === 'husks500') && top.some(t => t.q.id === 'level15'));
  assert.equal(statValue(m, 'total.kills'), 450);
});
test('Card Library: a card can be switched off, at least LIBRARY_MIN stay on, and it leaves the offer pool', () => {
  const m = defaultMeta(); assert.equal(setCardEnabled(m, 'swift-draw', false), true); assert.ok(!simMeta(m).cards.includes('swift-draw'));
  const total = m.unlockedCards.length + m.unlockedItems.length; let off = 1;
  for (const id of m.unlockedCards.concat(m.unlockedItems)) { if (id === 'swift-draw') continue; if (setCardEnabled(m, id, false)) off++; }
  assert.equal(total - off, LIBRARY_MIN, 'exactly the minimum stays on'); assert.equal(setCardEnabled(m, 'swift-draw', true), true);
});
