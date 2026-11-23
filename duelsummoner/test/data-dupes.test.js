import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
// Duplicate keys in an object literal are silently overwritten (the later one wins), so a copy and paste leaves two numbers for one setting. This reads the data files as text and finds repeated keys at the same level of the same object.
function dupes(src, file) {
  const out = []; const stack = []; let i = 0, expectKey = false;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i += 2; continue; }
    if (c === '"' || c === "'" || c === '`') { const q = c; i++; while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; } i++; continue; }
    if (c === '{' ) { stack.push({ keys: new Set(), obj: /[=(:,\[]\s*$/.test(src.slice(Math.max(0, i - 40), i)) || /return\s*$/.test(src.slice(Math.max(0, i - 10), i)) }); expectKey = true; i++; continue; }
    if (c === '}') { stack.pop(); expectKey = false; i++; continue; }
    if (c === ',' ) { expectKey = true; i++; continue; }
    if (expectKey && /[A-Za-z_$]/.test(c)) { let j = i; while (j < src.length && /[\w$]/.test(src[j])) j++; const id = src.slice(i, j); let k = j; while (/\s/.test(src[k])) k++; if (src[k] === ':' && src[k + 1] !== ':') { const top = stack[stack.length - 1]; if (top && top.obj) { if (top.keys.has(id)) out.push(file + ': duplicate key ' + id + ' near character ' + i); top.keys.add(id); } } expectKey = false; i = j; continue; }
    if (!/\s/.test(c)) expectKey = false;
    i++;
  }
  return out;
}
test('data tables: no object in src/data repeats a key (the later one would silently win)', () => {
  const found = []; for (const f of readdirSync(new URL('../src/data/', import.meta.url)).filter(f => f.endsWith('.js'))) found.push(...dupes(readFileSync(new URL('../src/data/' + f, import.meta.url), 'utf8'), f));
  assert.deepEqual(found, []);
});
test('data tables: the duplicate finder itself finds a repeated key', () => {
  assert.equal(dupes('export const A = { a: 1, b: { c: 1 }, a: 2 };', 'x').length, 1);
  assert.equal(dupes('export const A = { a: 1, b: { a: 1 }, c: { a: 2 } };', 'x').length, 0);
});
