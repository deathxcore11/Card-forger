// EWV3 block models: a tiny hand-made file decodes to the right parts, pivots, exact palette colours, glow faces and quads (the real models are kept out of the repo)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const ctx = { console }; ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx); vm.runInContext(fs.readFileSync(new URL('../vendor/three.min.js', import.meta.url), 'utf8'), ctx); globalThis.window = { THREE: ctx.THREE };
const { decodeEwv3, blockGroup, blockMerged, animateBlocks } = await import('../src/view/models.js');

function file(v2) {
  const b = []; const u8 = v => b.push(v & 255), u16 = v => { u8(v); u8(v >> 8); }, i16 = v => u16(v & 0xffff), u32 = v => { u16(v & 0xffff); u16(v >>> 16); }, f32 = v => { const a = new Uint8Array(new Float32Array([v]).buffer); b.push(...a); };
  for (const c of 'EWV3') u8(c.charCodeAt(0)); u16(v2 ? 2 : 1); u16(0); f32(0.06); if (v2) { f32(0.5); f32(2); } u16(2); u16(2); u16(1); u16(1);
  u8(224); u8(183); u8(101); u8(0); u8(255); u8(80); u8(0); u8(1);       // gold, and a glowing ember
  for (const [name, parent, pv] of [['body', -1, [0, 10, 0]], ['head', 0, [0, 20, 4]]]) { u8(name.length); for (const c of name) u8(c.charCodeAt(0)); i16(parent); for (const v of pv) i16(v); if (v2) { u8(name === 'head' ? 2 : 0); u8(1); f32(0.3); f32(4); f32(0); } }
  u8(1); i16(1); i16(0); i16(22); i16(4); u8(255); u8(200); u8(120); u16(6);       // one halo on the head
  u8(1); u32(1); i16(-2); i16(0); i16(-2); u8(2); u16(4); u16(4); u8(0); u32(1); i16(0); i16(0); i16(0); u8(5); u16(2); u16(2); u8(1);       // body: a top face; head: a face looking along -z, glowing
  return new Uint8Array(b);
}

test('EWV3: a hand-made file decodes to parts at their pivots, exact colours, glow faces and quads', () => {
  const m = decodeEwv3(file());
  assert.equal(m.parts.length, 2); assert.deepEqual(m.parts.map(p => p.name), ['body', 'head']); assert.equal(m.parts[1].parent, 0);
  assert.ok(Math.abs(m.parts[1].pivot[1] - 20 * 0.03) < 1e-6, 'pivots are half-blocks');
  assert.equal(m.emitters.length, 1); assert.equal(m.emitters[0].kind, 1);
  const body = m.levels[0].parts[0], head = m.levels[0].parts[1];
  assert.equal(body.solid.attributes.position.count, 6, 'one quad is two triangles'); assert.equal(body.glow, null);
  assert.equal(head.glow.attributes.position.count, 6, 'a glowing palette entry goes to the glow mesh'); assert.equal(head.solid, null);
  assert.equal(body.solid.attributes.color.array[0], Math.fround(224 / 255), 'colours are exact');
  const n = body.solid.attributes.normal.array; assert.deepEqual([n[0], n[1], n[2]], [0, 1, 0], 'normal code 2 looks up');
  const hn = head.glow.attributes.normal.array; assert.deepEqual([hn[0], hn[1], hn[2]], [0, 0, -1], 'normal code 5 looks along -z');
  const bg = blockGroup(m); assert.ok(bg.p.head && bg.p.body && bg.p.root && bg.p.root.parent === bg.root); assert.ok(Math.abs(bg.p.head.position.y - 10 * 0.03) < 1e-6 && Math.abs(bg.p.head.position.z - 4 * 0.03) < 1e-6, 'a child group sits at its pivot minus its parent\'s');
  assert.equal(bg.p.head.parent, bg.p.body);
  const mg = blockMerged(m); assert.equal(mg.attributes.position.count, 12); assert.equal(mg.attributes.aPart.array[6], 1, 'the part index rides on every vertex');
  assert.throws(() => decodeEwv3(new Uint8Array([...file(), 0])), /trailing/);
});

test('EWV3 version 2: the baked hover and part motion are read and drive the one animator', () => {
  const m = decodeEwv3(file(true)); assert.equal(m.version, 2); assert.ok(Math.abs(m.hover.amp - 0.5) < 1e-6 && m.hover.speed === 2);
  assert.equal(m.parts[1].motion.kind, 2); assert.equal(m.parts[1].motion.axis, 1); assert.equal(m.parts[0].motion.kind, 0);
  const bg = blockGroup(m); animateBlocks('any', bg, Math.PI / 8, null); assert.ok(Math.abs(bg.p.head.rotation.y - 0.3 * Math.sin(Math.PI / 2)) < 1e-6, 'a sway turns the part about its axis'); assert.ok(Math.abs(bg.p.root.position.y - 0.5 * 0.03 * Math.sin(Math.PI / 4)) < 1e-6, 'the hover lifts the inner root (half-blocks)'); assert.equal(bg.root.position.y, 0, 'the game-placed outer group is never moved');
});
