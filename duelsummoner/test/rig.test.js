// The duelist's clip state machine: what the sim says -> which clip plays. Pure, so it runs in Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { locomotion, CLIPS, UPPER } from '../src/view/rigstate.js';

const P = o => Object.assign({ vx: 0, vz: 0, vy: 0, grounded: true, sliding: false, dashT: 0, hp: 100, maxHp: 100 }, o), G = o => Object.assign({ over: false, won: false }, o);

test('rig: standing, walking and running pick idle, walk, run', () => {
  assert.equal(locomotion(P(), G()).clip, 'idle_cards');
  assert.equal(locomotion(P({ vx: 2 }), G()).clip, 'walk');
  const r = locomotion(P({ vx: 9 }), G()); assert.equal(r.clip, 'run'); assert.ok(r.speed > 0.9 && r.speed <= 1.5);
});
test('rig: the air splits into rise, apex and fall, and an air jump plays its clip', () => {
  assert.equal(locomotion(P({ grounded: false, vy: 8 }), G()).clip, 'jump_rise');
  assert.equal(locomotion(P({ grounded: false, vy: 0 }), G()).clip, 'jump_apex');
  assert.equal(locomotion(P({ grounded: false, vy: -8 }), G()).clip, 'fall_loop');
  assert.equal(locomotion(P({ grounded: false, vy: 4 }), G(), { airJump: true }).clip, 'air_jump');
});
test('rig: dash, slide, landing, low LP, defeat and victory', () => {
  assert.equal(locomotion(P({ dashT: 0.1, vx: 12 }), G()).clip, 'dash');
  assert.equal(locomotion(P({ sliding: true, vx: 10 }), G()).clip, 'slide');
  assert.equal(locomotion(P(), G(), { landT: 0.2, landHeavy: true }).clip, 'land_heavy');
  assert.equal(locomotion(P(), G(), { landT: 0.2 }).clip, 'land_light');
  assert.equal(locomotion(P({ vx: 8, hp: 10 }), G()).clip, 'limp_run');
  assert.equal(locomotion(P(), G({ over: true })).clip, 'defeat'); assert.equal(locomotion(P(), G({ over: true, won: true })).clip, 'victory');
});
test('rig: every canonical clip lists real names the test file has, or none (so it is simply skipped)', () => {
  const real = new Set(['Idle', 'Running', 'Walking', 'Walk_Backward', 'Regular_Jump', 'Jump_Run', 'Run_Jump_and_Roll', 'dying_backwards', 'Fall1', 'falling_down', 'Quad_Jump_Left', 'Jump_with_Arms_and_Legs_Open']);
  for (const k of ['idle_cards', 'run', 'walk', 'jump_rise', 'fall_loop', 'dash', 'slide', 'defeat']) assert.ok(CLIPS[k].some(n => real.has(n) || CLIPS[n]), k + ' has a fallback in the test file');
  assert.ok(UPPER.test('LeftArm') && UPPER.test('Spine02') && !UPPER.test('LeftUpLeg') && !UPPER.test('Hips'));
});
