// Verified leaderboards: the run score, the replay record and the verifier; difficulty tables.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { DIFFICULTY, DIFFICULTIES } from '../src/data/stages.js';
import { packReplay, toBase64, fromBase64 } from '../src/core/replay.js';
import { verifyReplay, nodeDeflate } from '../tools/verify.mjs';
import { newBot, botRecord } from '../tools/bot.mjs';

function playRecord(mode, difficulty, seed, ticks, extra) {
  const g = new Game(seed, Object.assign({ mode, difficulty, duelist: 'kael' }, extra || {})); const bot = newBot({ focus: true });
  for (let i = 0; i < ticks && !g.over; i++) g.tick(botRecord(g, bot));
  return { g, rec: packReplay(g.replayRaw(), nodeDeflate) };
}

test('a clean replay verifies: same score, same state hash, same tick count', () => {
  for (const [mode, dif] of [['run', 'medium'], ['run', 'hard'], ['quick', 'easy']]) {
    const { g, rec } = playRecord(mode, dif, 41, 5400); const res = verifyReplay(rec);
    assert.equal(res.ok, true, mode + ' ' + dif + ': ' + res.why.join('; ')); assert.equal(res.score, g.score()); assert.equal(rec.difficulty, dif);
  }
});

test('a tampered score, state hash, tape or difficulty is rejected', () => {
  const { rec } = playRecord('run', 'medium', 42, 4800); assert.equal(verifyReplay(rec).ok, true);
  assert.equal(verifyReplay({ ...rec, score: rec.score + 1000 }).ok, false, 'inflated score');
  assert.equal(verifyReplay({ ...rec, hash: '0000000000000000' }).ok, false, 'wrong hash');
  assert.equal(verifyReplay({ ...rec, difficulty: 'easy' }).ok, false, 'claimed an easier difficulty');
  assert.equal(verifyReplay({ ...rec, seed: rec.seed + 1 }).ok, false, 'different seed');
  const bytes = fromBase64(rec.tape.data); const copy = Uint8Array.from(bytes); copy[Math.floor(copy.length / 2)] ^= 0x55;
  let bad; try { bad = verifyReplay({ ...rec, tape: { ...rec.tape, data: toBase64(copy) } }).ok; } catch (e) { bad = false; }
  assert.equal(bad, false, 'edited tape');
  assert.equal(verifyReplay({ ...rec, ticks: rec.ticks - 1 }).ok, false, 'wrong tick count');
});

test('Run with a cash-out (endRun) and with deck-box meta also verifies', () => {
  const meta = { mods: { maxLp: 10 }, cards: ['ember-wyvern', 'cinder-hatchling', 'rune-apprentice', 'sigil-familiar', 'swift-draw'], items: ['lucky-coin'], deck: { maxLp: 2 } };
  const g = new Game(7, { mode: 'run', difficulty: 'medium', duelist: 'kael', meta }); const bot = newBot({});
  for (let i = 0; i < 1800; i++) g.tick(botRecord(g, bot)); g.endRun(); g.tick({ mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 });
  const res = verifyReplay(packReplay(g.replayRaw(), nodeDeflate)); assert.equal(res.ok, true, res.why.join('; '));
});

test('score: integer, weights from tuning, difficulty multiplier applies, and it grows with kills', () => {
  const mk = dif => { const g = new Game(3, { mode: 'run', difficulty: dif }); g.kills = 1000; g.stagesCleared = 2; g.fusions = 1; return g.score(); };
  const e = mk('easy'), m = mk('medium'), h = mk('hard');
  assert.ok(Number.isInteger(e) && Number.isInteger(m) && Number.isInteger(h)); assert.ok(e < m && m < h);
  assert.equal(m, 1000 * 1 + 2 * 2000 + 1 * 300); assert.equal(h, Math.floor(m * 1.5)); assert.equal(e, Math.floor(m * 0.75));
});

test('difficulty tables: three of them, Medium is the base, Easy is gentler and Hard ramps faster', () => {
  assert.deepEqual(DIFFICULTIES, ['easy', 'medium', 'hard']);
  const E = DIFFICULTY.easy, M = DIFFICULTY.medium, H = DIFFICULTY.hard;
  assert.equal(M.spawn, 1); assert.equal(M.hp, 1); assert.equal(M.score, 1);
  assert.ok(E.spawn < M.spawn && M.spawn < H.spawn); assert.ok(E.ramp < H.ramp); assert.ok(E.hpCurve.a < M.hpCurve.a && M.hpCurve.a < H.hpCurve.a); assert.ok(E.cap.start < M.cap.start);
  const hpAt = (dif, min) => { const g = new Game(5, { mode: 'run', difficulty: dif, offers: false }); g.sc = min * 60; g.tick({ mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 }); return g.hpMul; };
  assert.ok(hpAt('easy', 5) < hpAt('medium', 5) && hpAt('medium', 5) < hpAt('hard', 5));
  const g = new Game(5, { mode: 'run', difficulty: 'easy', offers: false }); g.sc = 10; g.tick({ mx: 0, mz: 0, yaw: 0, buttons: 0, menu: 0 }); assert.ok(g.maxAlive < 300, 'Easy starts with a lower enemy cap');
  assert.equal(new Game(1, { mode: 'run', difficulty: 'nonsense' }).difficulty, 'medium');
});
