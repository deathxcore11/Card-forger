import test from 'node:test'; import assert from 'node:assert/strict';
import { Focus, Repeater, DpadSource, axisEdge } from '../src/ui/focus.js';
// A 3x3 grid of 100 px items (g00..g22) with a tab strip above and a gold button to the right.
const grid = (page = 0) => { const nodes = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) nodes.push({ id: 'g' + r + c, x: c * 110, y: 100 + r * 110, w: 100, h: 100, region: 'grid' });
  for (let i = 0; i < 3; i++) nodes.push({ id: 't' + i, x: i * 110, y: 0, w: 100, h: 60, region: 'tabs' }); nodes.push({ id: 'gold', x: 400, y: 100, w: 120, h: 60, region: 'side' });
  return { id: 'lib', nodes, regions: { grid: { kind: 'grid', pages: { page, count: 3 }, next: { up: 'tabs', right: 'side' } }, tabs: { kind: 'tabs', next: { down: 'grid' } }, side: { kind: 'list', next: { left: 'grid' } } } }; };
test('opening lands on a real item, geometry moves inside a region, edges do not wrap', () => {
  const f = new Focus(); assert.equal(f.open(grid()), 'g00');
  assert.equal(f.move('right').id, 'g01'); assert.equal(f.move('down').id, 'g11'); assert.equal(f.move('left').id, 'g10'); assert.equal(f.move('left').type, 'edge');
});
test('paging at the edges: down from the last row turns the page, up from the top turns back, the first page does not wrap', () => {
  const f = new Focus(); f.open(grid(0)); f.set('g20'); assert.deepEqual([f.move('down').type, f.move('down').page], ['page', 1]);
  const g = new Focus(); g.open(grid(0)); g.set('g00'); assert.equal(g.move('up').type, 'move', 'on the first page, up from the top row goes to the tabs region (focus order)');
  const h = new Focus(); const L = grid(0); L.regions.grid.next = {}; h.open(L); h.set('g00'); assert.equal(h.move('up').type, 'edge');
  const k = new Focus(); const M = grid(1); M.regions.grid.next = {}; k.open(M); k.set('g00'); assert.deepEqual([k.move('up').type, k.move('up').page], ['page', 0]);
});
test('tabs wrap, values clamp, regions follow the focus order and remember', () => {
  const f = new Focus(); f.open(grid()); f.set('t2'); assert.equal(f.move('right').id, 't0'); assert.equal(f.move('left').id, 't2');
  f.set('g11'); assert.equal(f.move('right').id, 'g12'); assert.equal(f.move('right').id, 'gold'); assert.equal(f.move('left').id, 'g12');
  const v = new Focus(); v.open({ id: 'v', nodes: [{ id: 's', x: 0, y: 0, w: 100, h: 40, region: 'r' }], regions: { r: { kind: 'value' } } }); assert.deepEqual([v.move('right').type, v.move('left').step], ['clamp', -1]);
});
test('focus memory per screen, layers trap and return, the echo of the closing press is ignored for 100 ms', () => {
  const f = new Focus(); f.open(grid(), { memoryKey: 'lib:cards' }); f.set('g12'); f.open({ id: 'sheet', nodes: [{ id: 'ok', x: 0, y: 0, w: 50, h: 50, region: 'x' }, { id: 'no', x: 60, y: 0, w: 50, h: 50, region: 'x' }] }, { opener: 'g12' });
  assert.equal(f.layer.id, 'sheet'); assert.equal(f.move('left').id, 'ok'); assert.equal(f.node('g12'), null, 'the sheet traps the ring');
  assert.equal(f.close(1000, 'B'), 'g12'); assert.ok(f.ignored('B', 1050)); assert.ok(!f.ignored('B', 1100)); assert.ok(!f.ignored('A', 1050));
  f.close(2000); f.open(grid(), { memoryKey: 'lib:cards' }); assert.equal(f.layer.focus, 'g12', 'the screen remembers the last focused item');
});
test('repeat 300 ms then every 90 ms, every 60 ms after 1 s; the first d-pad source wins; axis edges at 0.5', () => {
  const r = new Repeater(); assert.equal(r.press('down', 0), 1); assert.equal(r.poll(299), 0); assert.equal(r.poll(300), 1); assert.equal(r.poll(389), 0); assert.equal(r.poll(390), 1);
  let n = 0; for (let t = 391; t <= 1500; t++) n += r.poll(t); assert.ok(n >= 12 && n <= 17, 'moves from 390 to 1500 ms: ' + n); r.release(); assert.equal(r.poll(5000), 0);
  const s = new DpadSource(); assert.ok(s.accept('pad1', 'hat')); assert.ok(!s.accept('pad1', 'keys')); assert.ok(s.accept('pad1', 'hat')); assert.ok(s.accept('pad2', 'keys'));
  assert.equal(axisEdge(0.2, 0.6), 1); assert.equal(axisEdge(0.6, 0.7), 0); assert.equal(axisEdge(-0.1, -0.9), -1);
});
