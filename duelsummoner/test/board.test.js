// The local reference leaderboard service: finish a run, submit, pending, verified, on the board; a tampered record is rejected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { packReplay } from '../src/core/replay.js';
import { nodeDeflate } from '../tools/verify.mjs';
import { newBot, botRecord } from '../tools/bot.mjs';
import { Board, weekOf } from '../tools/board-core.mjs';
import { createServer } from '../tools/board-server.mjs';

function playRecord(seed, ticks, difficulty = 'medium') {
  const g = new Game(seed, { mode: 'run', difficulty, duelist: 'kael' }), bot = newBot({ focus: true });
  for (let i = 0; i < ticks && !g.over; i++) g.tick(botRecord(g, bot));
  return packReplay(g.replayRaw(), nodeDeflate);
}

test('board: submit is pending, the checker verifies it, then it reaches the board and the owner sees the placing', () => {
  const b = new Board(null), rec = playRecord(51, 3600), now = Date.UTC(2026, 10, 22, 12);
  const s = b.submit('u1', rec, 'Randall', now); assert.equal(s.status, 'pending');
  assert.equal(b.board('run', 'medium', 'all', 'u1', now).top.length, 0, 'a pending score is on no board');
  assert.equal(b.status(s.id, 'u1', now).status, 'pending'); assert.equal(b.status(s.id, 'u2', now).code, 404, 'only the owner sees a pending run');
  assert.equal(b.checkPending(undefined, now), 1);
  const st = b.status(s.id, 'u1', now); assert.equal(st.status, 'verified'); assert.equal(st.placing, 1);
  const bd = b.board('run', 'medium', 'all', 'u1', now); assert.equal(bd.top[0].name, 'Randall'); assert.equal(bd.top[0].score, rec.score); assert.equal(bd.me.rank, 1);
  assert.equal(b.board('run', 'hard', 'all', 'u1', now).top.length, 0, 'other boards are separate');
});

test('board: tampered scores and tapes are rejected and never shown; anonymous and floods are refused', () => {
  const b = new Board(null), rec = playRecord(52, 3000);
  assert.equal(b.submit('anon', rec, 'x').code, 401);
  const bad = b.submit('u1', { ...rec, score: rec.score + 5000 }, 'Cheat'), ok = b.submit('u2', rec, 'Fair');
  b.checkPending();
  assert.equal(b.status(bad.id, 'u1').status, 'rejected'); assert.ok(b.status(bad.id, 'u1').why.length > 0); assert.equal(b.status(ok.id, 'u2').status, 'verified');
  const names = b.board('run', 'medium', 'all').top.map(r => r.name); assert.deepEqual(names, ['Fair']);
  for (let i = 0; i < 40; i++) b.submit('flood', rec, 'f'); assert.equal(b.db.runs.filter(r => r.user === 'flood').length, 30, '30 submits an hour');
  assert.equal(b.submit('u3', { ...rec, junk: 'x'.repeat(70000) }, 'big').code, 413);
});

test('board: one row per player (best score wins, ties go to the shorter run), weekly boards reset on Monday UTC, names are cleaned', () => {
  const b = new Board(null), recA = playRecord(53, 2400), recB = playRecord(54, 3600), t = Date.UTC(2026, 10, 22, 12);
  b.submit('u1', recA, '<b>Randall</b>\u0001', t); b.submit('u1', recB, 'Randall', t + 1); b.checkPending(undefined, t + 2);
  const top = b.board('run', 'medium', 'all', null, t + 3).top; assert.equal(top.length, 1); assert.equal(top[0].score, Math.max(recA.score, recB.score)); assert.ok(!/[<>\u0001]/.test(top[0].name));
  assert.equal(weekOf(Date.UTC(2026, 10, 22, 23)), '2026-11-16', '22 Nov 2026 is a Sunday, so its week starts Monday 16 Nov');
  assert.equal(b.board('run', 'medium', 'week', null, Date.UTC(2026, 10, 23, 1)).top.length, 0, 'the next Monday starts an empty week');
  assert.equal(b.board('run', 'medium', 'week', null, t + 3).top.length, 1);
});

test('board: the HTTP service runs the whole flow', async () => {
  const board = new Board(null), server = createServer(board, { checkEveryMs: 0 });
  await new Promise(r => server.listen(0, r)); const base = 'http://localhost:' + server.address().port, H = { 'x-ds-user': 'u9', 'content-type': 'application/json' };
  const rec = playRecord(55, 3000);
  const sub = await (await fetch(base + '/ds/runs', { method: 'POST', headers: H, body: JSON.stringify({ record: rec, name: 'Net' }) })).json(); assert.equal(sub.status, 'pending'); assert.match(sub.message, /checking/);
  assert.equal((await (await fetch(base + '/ds/runs/' + sub.id, { headers: H })).json()).status, 'pending');
  board.checkPending();
  const st = await (await fetch(base + '/ds/runs/' + sub.id, { headers: H })).json(); assert.equal(st.status, 'verified'); assert.equal(st.placing, 1);
  const bd = await (await fetch(base + '/ds/board?map=run&difficulty=medium&period=all', { headers: H })).json(); assert.equal(bd.top[0].name, 'Net');
  const rp = await (await fetch(base + '/ds/replay/' + sub.id)).json(); assert.equal(rp.seed, rec.seed);
  assert.equal((await fetch(base + '/ds/runs', { method: 'POST', body: JSON.stringify({ record: rec }) })).status, 401);
  await new Promise(r => server.close(r));
});
