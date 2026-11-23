import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/sim/game.js';
import { heightAt, WALL } from '../src/sim/terrain.js';
import { spawnRate, spawnEnemy } from '../src/sim/enemies.js';
import { CFG } from '../src/data/config.js';
import { FIELD, RARITIES } from '../src/data/field.js';
import { DISTRICTS } from '../src/data/map.js';

const idle = { f: 0, r: 0, yaw: 0, jump: false, dash: false, slide: false };
const YAW_EAST = -Math.PI / 2;           // forward = +x
const near = (a, b, e = 0.25) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);
function run(g, secs, cmd, dt = 1 / 60) { for (let t = 0; t < secs && !g.over; t += dt) g.step(dt, cmd); }
function noEnemies(g) { g.god = true; g.spawnAcc = -1e9; }

test('terrain heights: floor, ramp, stands, roof, boundary, pyramid, market', () => {
  near(heightAt(0, 0.3), 0, 0.01);
  near(heightAt(26, 0), 2, 0.3);                  // middle of the east ramp
  near(heightAt(40, 0), 4, 0.01);                 // stands
  near(heightAt(56 * Math.cos(0.39), 56 * Math.sin(0.39)), 5.8, 0.01); // hall roof at 22 degrees
  assert.equal(heightAt(210, 0), WALL);
  near(heightAt(-130, 0), 28.8, 0.01);            // pyramid top
  near(heightAt(-50, -160), 2.4, 2.1);            // market roof
  assert.ok(heightAt(0, -58) > 20 || heightAt(10, -58) > 20, 'royal gate is the tallest thing');
});

test('walking up a ramp onto the stands, and a wall blocks elsewhere', () => {
  const g = new Game(1); noEnemies(g);
  g.p.x = 14; g.p.z = 0;
  run(g, 4, { ...idle, f: 1, yaw: YAW_EAST });
  assert.ok(g.p.y > 3.9 && g.p.x > 33, `y=${g.p.y} x=${g.p.x}`);
  const w = new Game(1); noEnemies(w);
  w.p.x = 20; w.p.z = 20;                          // towards the stands wall away from any ramp
  run(w, 4, { ...idle, f: 1, yaw: -Math.PI * 0.75 });  // forward = (+x,+z)/sqrt2
  assert.ok(w.p.y < 0.6 && Math.hypot(w.p.x, w.p.z) < 33.2, `y=${w.p.y} r=${Math.hypot(w.p.x, w.p.z)}`);
});

test('jump reaches a roof from the stands but plain walking does not', () => {
  const a = 0.39;                                  // 22.3 degrees: centre of a hall roof
  const fx = Math.cos(a), fz = Math.sin(a);
  const yaw = Math.atan2(-fx, -fz) ;               // forward = (fx,fz)
  const mk = () => { const g = new Game(1); noEnemies(g); g.p.x = 49 * fx; g.p.z = 49 * fz; g.p.y = 4; return g; };
  const walk = mk(); run(walk, 2, { ...idle, f: 1, yaw });
  assert.ok(walk.p.y < 4.2, 'cannot walk onto the roof');
  const jump = mk(); run(jump, 2, { ...idle, f: 1, yaw, jump: true });
  assert.ok(jump.p.y > 5.7, `jump y=${jump.p.y}`);
});

test('jump height is 2.2 m', () => {
  const g = new Game(1); noEnemies(g);
  let peak = 0;
  g.step(1 / 60, { ...idle, jump: true });
  for (let i = 0; i < 80; i++) { g.step(1 / 60, { ...idle, jump: true }); peak = Math.max(peak, g.p.y); }              // jump held: full height
  near(peak, 2.2, 0.08);
});

test('jump feel: a short tap is a short hop, a press just before landing still jumps, and a jump just after a ledge still counts', () => {
  const run = (frames) => { const g = new Game(1); noEnemies(g); let peak = 0; for (const f of frames) { g.step(1 / 60, { ...idle, jump: !!f.j }); peak = Math.max(peak, g.p.y); } return { g, peak }; };
  const tap = run([{ j: 1 }, ...Array(80).fill({})]).peak, full = run([...Array(81).fill({ j: 1 })]).peak; assert.ok(tap < full * 0.6 && tap > 0.3, 'tap ' + tap + ' full ' + full);
  // coyote: just off a ledge (0.05 s left) a press is a ground jump; with no coyote time left it is not (no air jumps owned)
  { const a = new Game(1); noEnemies(a); a.mods.airJumps = 0; a.p.grounded = false; a.p.y = 0.5; a.p.vy = 0; a.p.coyote = 0.05; a.step(1 / 60, { ...idle, jump: true }); assert.ok(a.p.vy > 5, 'coyote jump fired: vy ' + a.p.vy);
    const c = new Game(1); noEnemies(c); c.mods.airJumps = 0; c.p.grounded = false; c.p.y = 0.5; c.p.vy = 0; c.p.coyote = 0; c.step(1 / 60, { ...idle, jump: true }); assert.ok(c.p.vy < 0, 'no coyote left: no jump'); }
  // buffer: pressed 3 ticks before landing, then released; the duelist lifts off as he lands
  { const g = new Game(1); noEnemies(g); g.mods.airJumps = 0; g.p.y = 0.12; g.p.grounded = false; g.p.vy = -3; let lifted = false; for (let i = 0; i < 12; i++) { g.step(1 / 60, { ...idle, jump: i === 0 }); if (i > 0 && g.p.vy > 5) lifted = true; } assert.ok(lifted, 'buffered jump fired on landing'); }
});

import { mantle } from '../src/sim/player.js';
test('auto-mantle: a jump that comes up just short of a ledge lifts you onto it; too high, too fast a fall, or no push does nothing', () => {
  const C = { radius: 0.4, mantle: 0.9 }, ledge = (x, z) => (x > 1 ? 1.2 : 0), mk = o => ({ x: 0.8, y: 0.5, z: 0, vy: 1, grounded: false, ...o });
  const a = mk({}); assert.equal(mantle(a, 1, 0, C, ledge, 50), true); assert.ok(a.grounded && Math.abs(a.y - 1.2) < 1e-9 && a.vy === 0 && a.x > 1.2, 'up on the ledge');
  assert.equal(mantle(mk({ y: 0.1 }), 1, 0, C, ledge, 50), false, 'ledge 1.1 m above is out of reach');
  assert.equal(mantle(mk({ vy: -9 }), 1, 0, C, ledge, 50), false, 'falling fast');
  assert.equal(mantle(mk({}), 0, 0, C, ledge, 50), false, 'not pushing into it');
  assert.equal(mantle(mk({ grounded: true }), 1, 0, C, ledge, 50), false, 'on the ground the step-up rule applies');
  assert.equal(mantle(mk({}), 1, 0, C, () => 60, 50), false, 'a wall (a solid wall height) is not a ledge');
});

test('dash covers 4 m, has a 1.1 s cooldown and no damage while dashing', () => {
  const g = new Game(1); noEnemies(g); g.god = false;
  const x0 = g.p.x;
  g.step(1 / 60, { ...idle, yaw: YAW_EAST, dash: true });
  assert.ok(g.p.dashT > 0);
  // an enemy touching the duelist during the dash deals nothing
  g.en.alive[0] = 1; g.en.x[0] = g.p.x + 0.5; g.en.z[0] = g.p.z; g.en.y[0] = 0; g.en.atk[0] = 0; g.en.hp[0] = 4;
  run(g, 0.2, { ...idle, yaw: YAW_EAST });
  near(g.p.x - x0, 4, 0.35);
  assert.equal(g.p.hp, CFG.player.hp - 0 * 8, 'no damage taken during dash');
  g.step(1 / 60, { ...idle, yaw: YAW_EAST, dash: true });
  assert.ok(g.p.dashT <= 0, 'cooldown blocks a second dash');
  run(g, 1.0, idle);
  g.step(1 / 60, { ...idle, yaw: YAW_EAST, dash: true });
  assert.ok(g.p.dashT > 0, 'dash ready again after 1.1 s');
});

test('slide gains speed downhill and loses it on flat ground', () => {
  const g = new Game(1); noEnemies(g);
  g.p.x = 31.5; g.p.y = 4; g.p.z = 0;               // top of the east ramp, heading back down towards the arena
  const west = { ...idle, f: 1, yaw: Math.PI / 2, slide: true };
  run(g, 0.5, { ...west, slide: false });           // run up to speed first
  run(g, 0.7, west);
  assert.ok(g.p.sliding && g.p.slideSpeed > 12, `slide speed ${g.p.slideSpeed}`);
  const flat = new Game(1); noEnemies(flat); flat.p.x = -5;
  run(flat, 0.5, { ...idle, f: 1, yaw: YAW_EAST });
  run(flat, 0.5, { ...idle, f: 1, yaw: YAW_EAST, slide: true });
  assert.ok(flat.p.slideSpeed < 9, 'friction on the flat');
});

test('W moves along the camera forward after any yaw (180 degree turn)', () => {
  const g = new Game(1); noEnemies(g);
  const yaw = Math.PI;                              // turned right round: forward = +z
  run(g, 0.5, { ...idle, f: 1, yaw });
  assert.ok(g.p.z > 2 && Math.abs(g.p.x) < 0.1, `x=${g.p.x} z=${g.p.z}`);
});

test('spawn rate ramps from 1/s at 0:00 to 3/s at 3:00 (eased ramp)', () => {
  near(spawnRate(0), 1, 1e-9); near(spawnRate(90), 2.1, 1e-9); near(spawnRate(180), 3.0, 1e-9); near(spawnRate(500), 3, 1e-9); near(spawnRate(300), 5, 1e-9);
  const g = new Game(1, { offers: false }); g.god = true;
  run(g, 10, idle); const first = g.spawned;
  g.t = 180; g.spawned = 0; g.en.alive.fill(0); run(g, 10, idle);
  assert.ok(first >= 9 && first <= 12, `first ${first}`);
  assert.ok(g.spawned >= 29 && g.spawned <= 34, `late ${g.spawned}`);
});

test('enemies spawn 22 to 30 m away and the live count never exceeds 300', () => {
  const g = new Game(7); g.god = true;
  for (let i = 0; i < 400; i++) spawnEnemy(g);
  assert.equal(g.enemyCount(), 300);
  for (let i = 0; i < 300; i++) { const d = Math.hypot(g.en.x[i] - g.p.x, g.en.z[i] - g.p.z); assert.ok(d >= 21.9 && d <= 30.1, `d=${d}`); }
});

test('touch damage: 0.9 s per enemy and 0.25 s shared grace', () => {
  const g = new Game(1); g.spawnAcc = -1e9; g.cardT = 1e9; g.field.monsters.fill(null);
  const put = (i, dx) => { g.en.alive[i] = 1; g.en.x[i] = dx; g.en.z[i] = 0; g.en.y[i] = 0; g.en.hp[i] = 4; g.en.atk[i] = 0; g.en.spd[i] = 0; };
  put(0, 1); put(1, -1); put(2, 0.8);
  g.step(1 / 60, idle);
  assert.equal(Math.round(g.p.hp), 92, 'one hit, the others wait out the grace');
  run(g, 0.2, idle); assert.equal(Math.round(g.p.hp), 92, 'still inside 0.25 s grace');
  run(g, 0.1, idle); assert.equal(Math.round(g.p.hp), 84, 'second enemy hits once grace ends');
  run(g, 0.3, idle); assert.equal(Math.round(g.p.hp), 76, 'third enemy hits');
  run(g, 0.2, idle); assert.equal(Math.round(g.p.hp), 76, 'first enemy is on its 0.9 s cooldown');
  run(g, 0.35, idle); assert.equal(Math.round(g.p.hp), 68, 'first enemy hits again after 0.9 s');
});

test('the duelist throws a card every 0.8 s for 2 damage at the nearest enemy', () => {
  const g = new Game(1); g.spawnAcc = -1e9; g.god = true; g.field.monsters.fill(null);
  g.en.alive[0] = 1; g.en.x[0] = 12; g.en.z[0] = 0; g.en.y[0] = 0; g.en.hp[0] = 400; g.en.spd[0] = 0;
  g.en.alive[1] = 1; g.en.x[1] = 25; g.en.z[1] = 0; g.en.y[1] = 0; g.en.hp[1] = 400; g.en.spd[1] = 0;
  run(g, 2.5, idle);
  const thrown = Math.round((400 - g.en.hp[0]) / 2);
  assert.ok(thrown >= 2 && thrown <= 4, `near enemy took ${400 - g.en.hp[0]}`);
  assert.equal(g.en.hp[1], 400, 'far enemy untouched');
});

test('ground enemies follow the flow field up a ramp to the stands', () => {
  const g = new Game(1); g.god = true; g.spawnAcc = -1e9; g.cardT = 1e9; g.field.monsters.fill(null);
  g.p.x = 46; g.p.y = 4; g.p.z = 0;                 // duelist stands on the stands
  g.en.alive[0] = 1; g.en.x[0] = 10; g.en.z[0] = 8; g.en.y[0] = 0; g.en.hp[0] = 4; g.en.spd[0] = CFG.enemy.speed;
  run(g, 20, idle);
  assert.ok(g.en.y[0] > 3.5, `enemy y=${g.en.y[0]} x=${g.en.x[0]}`);
  assert.ok(Math.hypot(g.en.x[0] - g.p.x, g.en.z[0] - g.p.z) < 6, 'reached the duelist');
});

test('enemies more than 60 m away are relocated to the spawn ring', () => {
  const g = new Game(3); g.god = true; g.spawnAcc = -1e9;
  g.en.alive[0] = 1; g.en.x[0] = 90; g.en.z[0] = 0; g.en.y[0] = 0; g.en.hp[0] = 4; g.en.spd[0] = 0;
  g.step(1 / 60, idle);
  const d = Math.hypot(g.en.x[0] - g.p.x, g.en.z[0] - g.p.z);
  assert.ok(d >= 21 && d <= 31, `d=${d}`);
});

test('death stops the run and reset restores everything', () => {
  const g = new Game(1);
  g.spawnAcc = 0;
  g.p.hp = 5; g.en.alive[0] = 1; g.en.x[0] = 1; g.en.z[0] = 0; g.en.hp[0] = 4; g.en.atk[0] = 0;
  g.step(1 / 60, idle);
  assert.ok(g.over && g.p.hp === 0);
  const t = g.t; g.step(1, idle); assert.equal(g.t, t, 'sim frozen after death');
  for (let k = 0; k < 2; k++) {
    g.reset(); noEnemies(g); run(g, 3, { ...idle, f: 1 }); g.reset();
    assert.equal(g.t, 0); assert.equal(g.kills, 0); assert.equal(g.p.hp, 100); assert.equal(g.over, false);
    assert.equal(g.enemyCount(), 0); assert.equal(g.p.x, 0); assert.equal(g.xp, 0);
  }
});

test('data files for later steps are shaped as agreed', () => {
  assert.equal(FIELD.monsterZones, 4); assert.equal(FIELD.spellTrapZones, 4);
  assert.deepEqual([FIELD.monsterLevel.min, FIELD.monsterLevel.max], [1, 10]);
  assert.deepEqual([FIELD.spellTrapLevel.min, FIELD.spellTrapLevel.max], [1, 5]);
  assert.equal(FIELD.fusionLevel, 10); assert.equal(RARITIES.length, 5); assert.equal(DISTRICTS.length, 5);
});






