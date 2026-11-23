// The big-moment budgets and the director (spectacle spec 4.2 and 4.3): pure logic, run in node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StopBudget, FlashGate, ShakeBudget, MomentDirector, STAGE_LUM } from '../src/view/director.js';

test('hit-stop: at most 250 ms in any 300 ticks and at least 24 ticks between two', () => {
  const b = new StopBudget(); const got = []; for (let tick = 0; tick < 3000; tick += 7) { const ok = b.ask(tick, 0.1); if (ok) got.push([tick, ok]); }
  for (let i = 1; i < got.length; i++) assert.ok(got[i][0] - got[i - 1][0] >= 24, 'gap');
  for (const [t] of got) { let sum = 0; for (const [u, s] of got) if (u <= t && t - u < 300) sum += s; assert.ok(sum <= 0.2501, 'sum ' + sum + ' at ' + t); }
  assert.ok(got.length > 10);
});
test('hit-stop is decided from ticks only: the same tape gives the same (tick, stop) list however the frames fall', () => {
  const tape = [[10, 0.06], [20, 0.04], [40, 0.1], [70, 0.1], [90, 0.1], [400, 0.12], [410, 0.12]];
  const run = () => { const b = new StopBudget(); return tape.map(([t, s]) => [t, b.ask(t, s)]); };
  const a = run(), c = run(); assert.deepEqual(a, c);          // nothing else is an input: not frame time, not a setting
});
test('flash gate: at most 2 in any 1.0 s, 350 ms apart, 6 in 10 s, 20 in 60 s; strength by stage luminance', () => {
  const g = new FlashGate(); let n1 = 0, ok = []; for (let ms = 0; ms < 60000; ms += 50) { const r = g.ask(ms, 1, 0); if (r > 0) ok.push(ms); }
  for (let i = 1; i < ok.length; i++) assert.ok(ok[i] - ok[i - 1] >= 350);
  for (const t of ok) { assert.ok(ok.filter(x => x <= t && t - x < 1000).length <= 2); assert.ok(ok.filter(x => x <= t && t - x < 10000).length <= 6); }
  assert.ok(ok.length <= 20 + 0);
  const s = new FlashGate(); assert.equal(s.strength(0), 0.35); assert.ok(Math.abs(s.strength(1) - 0.2 / 0.9) < 1e-9 && s.strength(1) <= 0.35); assert.equal(STAGE_LUM.length, 3);
  assert.ok(new FlashGate().ask(0, 0.1, 0) === 0.1, 'a weak flash keeps its strength');
});
test('shake budget: own events add at most 0.3 in any 1.0 s; hurt once per 350 ms; over 0.3 for at most 0.6 s in 3 s', () => {
  const b = new ShakeBudget(); let tot = 0; for (let i = 0; i < 20; i++) tot += b.ask(i * 40, 0.1, false); assert.ok(tot <= 0.3001, 'added ' + tot);
  const h = new ShakeBudget(); assert.equal(h.ask(0, 0.5, true), 0.5); assert.equal(h.ask(200, 0.5, true), 0); assert.equal(h.ask(400, 0.5, true), 0.5);
  const l = new ShakeBudget(); let overMs = 0; for (let ms = 0; ms < 3000; ms += 16) { const t = l.limit(ms, 0.016, 0.9); if (t > 0.3) overMs += 16; } assert.ok(overMs <= 640, 'over ' + overMs);
});
test('director: 20 signature triggers in one second give one moment with screen parts', () => {
  const d = new MomentDirector(); let screen = 0; for (let i = 0; i < 20; i++) { const g = d.request('sig' + (i % 8), 'B', 100 + i * 3, {}); if (g.screen) screen++; } assert.equal(screen, 1);
});
test('director: a higher class interrupts a lower one; a second of the same class within 90 ticks drops a class; class A cooldown 180 ticks', () => {
  const d = new MomentDirector(); assert.equal(d.request('c1', 'C', 0).screen, false); assert.equal(d.request('b1', 'B', 10).screen, true); assert.equal(d.request('a1', 'A', 20).screen, true);
  const e = new MomentDirector(); assert.equal(e.request('a1', 'A', 0).cls, 'A'); assert.equal(e.request('a2', 'A', 50).cls, 'B'); assert.equal(e.request('a3', 'A', 100).cls, 'B'); assert.equal(e.request('a4', 'A', 400).cls, 'A');
});
test('director: once per run and once per stage; nothing starts while a panel is open, and a held class A plays only within 30 ticks of the close', () => {
  const d = new MomentDirector(); assert.equal(d.request('tb', 'A', 0, { once: 'run' }).dropped, undefined); assert.equal(d.request('tb', 'A', 500, { once: 'run' }).dropped, true);
  assert.equal(d.request('asc', 'C', 0, { once: 'stage' }).dropped, undefined); assert.equal(d.request('asc', 'C', 100, { once: 'stage' }).dropped, true); d.newStage(); assert.equal(d.request('asc', 'C', 200, { once: 'stage' }).dropped, undefined);
  const p = new MomentDirector(); assert.equal(p.request('fz', 'A', 10, { blocked: true }).dropped, true); p.panel(true, 10); assert.equal(p.panel(false, 20) !== null, true);
  const q = new MomentDirector(); q.request('fz', 'A', 10, { blocked: true }); q.panel(true, 10); assert.equal(q.panel(false, 100), null);
});

test('hit-stop: a longer stop on the same tick replaces the shorter one (Tablebreak 120 ms after the Reach-cap 40 ms)', () => {
  const b = new StopBudget(); assert.equal(b.ask(128, 0.04), 0.04); assert.equal(b.ask(128, 0.12), 0.12); assert.equal(b.ask(128, 0.05), 0);       // a shorter one on the same tick is still refused
  assert.equal(b.log.length, 1); assert.equal(b.ask(140, 0.1), 0);       // the 24-tick gap runs from the replaced stop
  const c = new StopBudget(); assert.equal(c.ask(10, 0.12), 0.12); assert.equal(c.ask(10, 0.04), 0);
});

