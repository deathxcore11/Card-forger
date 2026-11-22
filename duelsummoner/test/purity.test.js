import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The sim and its data must be portable: no rendering, no DOM, no clocks, no storage, no platform-dependent maths.
const root = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1').replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g, "''");
const files = dir => readdirSync(join(root, dir)).filter(f => f.endsWith('.js')).map(f => ({ name: dir + '/' + f, src: readFileSync(join(root, dir, f), 'utf8') }));

test('src/sim and src/data are pure: no three, no view, no DOM, clocks, storage, timers or Math.random', () => {
  const banned = [/\bwindow\b/, /\bdocument\b/, /\bperformance\b/, /\bDate\b/, /\bMath\.random\b/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\brequestAnimationFrame\b/, /\bTHREE\b/, /\bnavigator\b/];
  for (const f of [...files('sim'), ...files('data')]) {
    const code = strip(f.src);
    for (const re of banned) assert.ok(!re.test(code), `${f.name} uses ${re}`);
    for (const m of f.src.matchAll(/import[^;]*from\s+'([^']+)'/g)) assert.ok(!/three|\/view\//.test(m[1]) && !/core\/(input|host|save)/.test(m[1]), `${f.name} imports ${m[1]}`);
  }
});

test('src/sim does platform maths only through dmath.js (no Math.sin cos tan atan atan2 exp pow log hypot cbrt)', () => {
  for (const f of files('sim')) {
    if (f.name.endsWith('dmath.js')) continue;
    assert.ok(!/\bMath\.(sin|cos|tan|asin|acos|atan|atan2|exp|pow|log|log2|log10|hypot|cbrt|sinh|cosh|tanh)\b/.test(strip(f.src)), `${f.name} uses platform maths`);
  }
  for (const f of files('data')) assert.ok(!/\bMath\.(sin|cos|tan|atan2|exp|pow)\b/.test(strip(f.src)), `${f.name} uses platform maths`);
});

test('dmath agrees with the platform to better than 1e-8 (so behaviour is unchanged) and is exact where it should be', async () => {
  const d = await import('../src/sim/dmath.js');
  for (let i = -2000; i <= 2000; i++) { const x = i * 0.0173; assert.ok(Math.abs(d.sin(x) - Math.sin(x)) < 1e-8 && Math.abs(d.cos(x) - Math.cos(x)) < 1e-8); }
  for (let i = -60; i <= 60; i++) for (let j = -60; j <= 60; j++) if (i || j) assert.ok(Math.abs(d.atan2(i, j) - Math.atan2(i, j)) < 1e-8);
  for (let i = -100; i <= 40; i++) assert.ok(Math.abs(d.exp(i * 0.1) / Math.exp(i * 0.1) - 1) < 1e-10);
  assert.equal(d.pow(2, 10), 1024); assert.equal(d.pow(3, 0), 1);
});
