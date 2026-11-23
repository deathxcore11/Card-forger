import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; import { join } from 'node:path';
import { Game } from '../src/sim/game.js'; import { quantise, decode, emptyRecord } from '../src/sim/input.js'; import { hashHex } from '../src/sim/hash.js';

const mkRecords = n => { const out = [], r = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false }; let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < n; i++) { r.f = rnd() < 0.7 ? 1 : 0; r.r = rnd() < 0.2 ? (rnd() - 0.5) * 2 : 0; r.yaw = (r.yaw + (rnd() - 0.5) * 0.2 + 6.2831853) % 6.2831853; r.jump = rnd() < 0.05; r.dash = rnd() < 0.02; out.push(quantise({ ...r }, emptyRecord())); } return out; };

test('camera yaw reaches the sim only as the quantised yaw field of the per-tick input record, and the same tape gives the same state hash', () => {
  const recs = mkRecords(900), A = new Game(11, { mode: 'run', duelist: 'kael', offers: false }), B = new Game(11, { mode: 'run', duelist: 'kael', offers: false }); A.god = B.god = true;
  const hA = [], hB = [];
  for (let i = 0; i < recs.length; i++) { A.tick(recs[i]); assert.equal(A.camYaw, decode(recs[i]).yaw, 'camYaw at tick ' + i + ' is the tape yaw (1024 steps), nothing else'); if (i % 60 === 59) hA.push(hashHex(A)); }
  for (let i = 0; i < recs.length; i++) { B.tick(recs[i]); if (i % 60 === 59) hB.push(hashHex(B)); }
  assert.deepEqual(hA, hB, 'two runs of one tape give the same hash at every second');
});

test('a different tape yaw changes where the summons stand, a different camera object cannot (the sim never reads one)', () => {
  const run = yaw => { const g = new Game(11, { mode: 'run', duelist: 'kael', offers: false }); g.god = true; g.field.monsters[0] = { id: 'ember-wyvern', level: 1, cd: 99 }; for (let i = 0; i < 240; i++) g.tick(quantise({ f: 0, r: 0, yaw }, emptyRecord())); const m = g.field.monsters[0]; return [m.x - g.p.x, m.z - g.p.z]; };
  const a = run(0.5), b = run(2.0); assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) > 1, 'the slot follows the tape yaw');
  const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'src', 'sim'); const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  for (const f of readdirSync(dir).filter(n => n.endsWith('.js'))) assert.ok(!/\b(document|window|navigator|THREE|ChaseCamera)\b|\.camera\b/.test(strip(readFileSync(join(dir, f), 'utf8'))), f + ' reaches for the view or a camera');
});
