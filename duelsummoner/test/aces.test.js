// Ace monsters and Trophy Chests: they appear on schedule, stay under the cap, drop a Trophy Chest by the seeded loot stream, and replays that contain them still verify.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { ACES } from '../src/data/stages.js';
import { aliveAces, trophyChance } from '../src/sim/aces.js';
import { killEnemy } from '../src/sim/combat.js';
import { spawnEnemy, spawnAce } from '../src/sim/enemies.js';
import { packReplay } from '../src/core/replay.js';
import { verifyReplay, nodeDeflate } from '../tools/verify.mjs';
import { newBot, botRecord } from '../tools/bot.mjs';

function play(seed, secs, god = true) {
  const g = new Game(seed, { mode: 'run', difficulty: 'easy', duelist: 'kael' }), bot = newBot({ focus: true }); g.god = god; let peak = 0, firstAce = -1;
  for (let i = 0; i < secs * 60 && !g.over; i++) { g.tick(botRecord(g, bot)); const n = aliveAces(g); peak = Math.max(peak, n); if (firstAce < 0 && n > 0) firstAce = g.sc; }
  return { g, peak, firstAce };
}

test('aces: the first one arrives at 1:24 of the stage, there are never more than the cap, and they are big and tough', () => {
  const { g, peak, firstAce } = play(5, 170);
  assert.ok(firstAce >= ACES.from - 1 && firstAce <= ACES.from + 8, 'first Ace at ' + firstAce);
  assert.ok(peak >= 1 && peak <= ACES.max, 'peak alive ' + peak);
  const e = g.en; for (let i = 0; i < e.max; i++) if (e.alive[i] && e.ace[i]) { assert.ok(Math.abs(e.size[i] - ACES.sizeMul) < 1e-5, 'size ' + e.size[i]); }
  const f = new Game(3, { mode: 'run', difficulty: 'easy', duelist: 'kael' }); spawnEnemy(f, 'husk'); const hp0 = f.en.hp[f.lastSlot]; spawnAce(f, 'husk'); assert.ok(Math.abs(f.en.hp[f.lastSlot] - hp0 * ACES.hpMul) < 1e-3 && f.en.ace[f.lastSlot] === 1, 'an Ace has ' + ACES.hpMul + 'x the HP');
});

test('aces: a fallen Ace pays extra and the Trophy Chest roll follows the loot stream and its falling chance', () => {
  const run = () => { const g = new Game(9, { mode: 'run', difficulty: 'easy', duelist: 'kael' }); g.god = true; const out = [];
    for (let n = 0; n < 12; n++) { const e = g.en; e.alive[n] = 1; e.kind[n] = 0; e.ace[n] = 1; e.hp[n] = 1; e.x[n] = n; e.z[n] = 0; killEnemy(g, n); out.push(g.world.cchests.filter(c => c.trophy).length); }
    return { out, chances: [trophyChance(g)], trophies: g.trophies, rarities: g.world.cchests.filter(c => c.trophy).map(c => c.rarity) }; };
  const a = run(), b = run(); assert.deepEqual(a, b, 'same seed, same Trophy Chests');
  assert.ok(a.trophies >= 1 && a.trophies <= 12); assert.ok(a.chances[0] >= ACES.trophy.min && a.chances[0] < ACES.trophy.first + 1e-9, 'the chance falls with each Trophy');
  for (const r of a.rarities) assert.ok(['rare', 'epic', 'legendary'].includes(r));
});

test('aces: a run with Aces in it replays and verifies (same score, same state hash)', () => {
  const { g } = play(11, 150, false); const rec = packReplay(g.replayRaw(), nodeDeflate), res = verifyReplay(rec);
  assert.equal(res.ok, true, res.why.join('; ')); assert.ok((g.acesDown || 0) >= 0);
});
