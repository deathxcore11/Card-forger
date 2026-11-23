// Fog of war: the explored mask is run state in the sim (same on every machine), high ground sees further, and it resets each stage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { makeFog, revealFog, sightRadius, exploredAt } from '../src/sim/fog.js';
import { jumpToStage } from '../src/sim/stages.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false, use: false };
test('fog: the ground around the duelist is explored, the far side of the map is not', () => {
  const g = new Game(3, { mode: 'run', duelist: 'kael' }); g.god = true; g.step(1 / 60, idle);
  assert.ok(exploredAt(g.fog, g.p.x, g.p.z), 'standing place explored'); assert.ok(g.fog.count > 10, 'cells explored ' + g.fog.count);
  assert.equal(exploredAt(g.fog, -g.p.x * 0.9 + 3, -g.p.z * 0.9 + 3), false, 'far ground still dark');
});
test('fog: high ground sees further, and the radius is capped', () => {
  assert.ok(sightRadius(0) === 30 && sightRadius(10) > sightRadius(0) && sightRadius(500) === 80);
  const a = new Game(4, { mode: 'run', duelist: 'kael' }), b = new Game(4, { mode: 'run', duelist: 'kael' }); a.g = 0; b.p.y = 25; revealFog(a); revealFog(b);
  assert.ok(b.fog.count > a.fog.count * 1.5, 'high ' + b.fog.count + ' vs low ' + a.fog.count);
});
test('fog: same walk, same mask; a new stage starts dark again', () => {
  const walk = () => { const g = new Game(6, { mode: 'run', duelist: 'kael' }); g.god = true; for (let i = 0; i < 240; i++) g.step(1 / 60, { ...idle, f: 1 }); return g; };
  const a = walk(), b = walk(); assert.deepEqual(Array.from(a.fog.cells), Array.from(b.fog.cells)); assert.ok(a.fog.count > 40);
  jumpToStage(a, 1); a.step(1 / 60, idle); assert.ok(a.fog.count < b.fog.count, 'a new stage starts dark: ' + a.fog.count);
});
