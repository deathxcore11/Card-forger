import test from 'node:test'; import assert from 'node:assert/strict';
import { visibleRows, defaultFor, valueOf, ROWS, ROW_BY_ID } from '../src/ui/settings-schema.js';
const n = (tab, ctx) => visibleRows(tab, ctx).length, ids = (tab, ctx) => visibleRows(tab, ctx).map(r => r.id);
test('row counts per device class match spec 9.8', () => {
  const ph = { cls: 'phone' };
  assert.deepEqual(['game', 'display', 'sound', 'access'].map(t => n(t, ph)), [10, 7, 6, 10]);       // Access has 8 in the spec plus Big moments and Duelist marker
  assert.deepEqual(ids('controls', ph), ['slideMode', 'onScreenControls', 'moveStick', 'controlSize', 'controlOpacity', 'rideHelpers', 'dragLook', 'tapToUse', 'touchHaptics', 'resetControls']);
  assert.equal(n('controls', { cls: 'phone', pad: true }), 10 + 10, 'a phone with a pad adds the Controller section');       // (spec 9.8 plus Riding buttons, 26 Nov)
  const th = { cls: 'thor', dual: true };
  assert.deepEqual(['game', 'display', 'sound', 'access'].map(t => n(t, th)), [9, 7, 6, 10]);
  assert.equal(n('game', { cls: 'thor', dual: false }), 10, 'Map overlay size shows only while Dual screen is Off');
  assert.deepEqual(ids('controls', th), ['slideMode', 'glyphs', 'confirmButton', 'stickLayout', 'buttonMap', 'rideLayout', 'lookSpeed', 'lookEasing', 'invertLook', 'deadZone', 'vibration', 'tapToUse', 'touchHaptics', 'resetControls']);
  assert.ok(ids('display', th).includes('dualScreen') && !ids('display', th).includes('edgePadding') && !ids('display', th).includes('fullScreen'));
  const po = { cls: 'portal' }; assert.equal(n('game', po), 10); assert.ok(!ids('display', po).includes('dualScreen')); assert.ok(ids('controls', po).includes('onScreenControls'));
  const pc = { cls: 'pc' }; assert.ok(ids('display', pc).includes('fullScreen') && !ids('display', pc).includes('batteryHeat') && !ids('display', pc).includes('edgePadding'));
  assert.deepEqual(ids('controls', pc), ['slideMode', 'mouseLook', 'invertMouse', 'keyBindings', 'resetControls']);
  assert.ok(ids('controls', { cls: 'pc', pad: true }).includes('glyphs'));
});
test('visibility rules: Gyro, touch rows hidden while Off, signed-in rows', () => {
  assert.ok(!ids('controls', { cls: 'thor', gyro: false }).includes('gyroLook')); assert.ok(ids('controls', { cls: 'thor', gyro: true }).includes('gyroLook'));
  assert.ok(!ids('controls', { cls: 'thor', gyro: true }).includes('gyroSpeed')); assert.ok(ids('controls', { cls: 'thor', gyro: true, values: { gyroLook: true } }).includes('gyroSpeed'));
  assert.ok(!ids('controls', { cls: 'phone', values: { onScreenControls: 'off' } }).includes('controlSize'));
  assert.equal(n('account', { cls: 'phone' }), 4); assert.equal(n('account', { cls: 'phone', signedIn: true }), 8);
});
test('defaults resolve per class at read time and overrides win', () => {
  assert.equal(defaultFor('detail', 'phone'), 'medium'); assert.equal(defaultFor('detail', 'thor'), 'high'); assert.equal(defaultFor('frameRate', 'pc'), 'match'); assert.equal(defaultFor('camAssist', 'phone'), 'gentle');
  assert.equal(valueOf('detail', 'thor', { detail: 'low' }), 'low'); assert.equal(valueOf('detail', 'thor', {}), 'high');
  assert.ok(ROW_BY_ID.monsterAim.greyInRun && ROW_BY_ID.resetProgress.greyInRun);
  const seen = new Set(); for (const r of ROWS) { assert.ok(!seen.has(r.id), 'duplicate ' + r.id); seen.add(r.id); }
});
