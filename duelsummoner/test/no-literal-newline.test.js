import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs'; import { join } from 'node:path'; import { fileURLToPath } from 'node:url';
// A literal backslash-n (two characters) outside a string, a template or a regex is a line break that never happened: it turns the rest of the line into a comment or breaks a CSS selector.
// This scans every source file for one: in code outside strings and regexes, inside // comments, and anywhere in the <style> of index.html.
const root = fileURLToPath(new URL('..', import.meta.url));
const walk = (d, out = []) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/^(node_modules|vendor|assets|design|\.git|release)$/.test(f)) walk(p, out); } else if (/\.(js|mjs)$/.test(f)) out.push(p); } return out; };
function scanJs(src) {
  const bad = []; let i = 0, line = 1, prevSig = '';
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && n === '/') { const e = src.indexOf('\n', i); const text = src.slice(i, e < 0 ? src.length : e); if (/\\n/.test(text)) bad.push(line); i = e < 0 ? src.length : e; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); for (let k = i; k < (e < 0 ? src.length : e); k++) if (src[k] === '\n') line++; i = e < 0 ? src.length : e + 2; continue; }
    if (c === '"' || c === "'") { i++; while (i < src.length && src[i] !== c && src[i] !== '\n') { if (src[i] === '\\') i++; i++; } i++; prevSig = 'x'; continue; }
    if (c === '`') { i++; let depth = 0; while (i < src.length && !(src[i] === '`' && depth === 0)) { if (src[i] === '\n') line++; if (src[i] === '\\') { i += 2; continue; } if (src[i] === '$' && src[i + 1] === '{') { depth++; i += 2; continue; } if (src[i] === '}' && depth > 0) depth--; i++; } i++; prevSig = 'x'; continue; }
    if (c === '/' && /^[(,=:\[!&|?{};]?$/.test(prevSig)) { i++; let cls = false; while (i < src.length && src[i] !== '\n' && (src[i] !== '/' || cls)) { if (src[i] === '\\') i++; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i++; } i++; prevSig = 'x'; continue; }
    if (c === '\\' && n === 'n') { bad.push(line); i += 2; continue; }
    if (!/\s/.test(c)) prevSig = c; i++;
  }
  return bad;
}
test('no source file holds a literal backslash-n outside a string, template or regex', () => {
  const found = []; for (const p of walk(root)) { const bad = scanJs(readFileSync(p, 'utf8')); for (const l of bad) found.push(p.replace(root, '') + ':' + l); }
  assert.deepEqual(found, []);
});
test('index.html: no literal backslash-n anywhere in the style block', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8'), css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  assert.ok(!/\\n/.test(css), 'literal backslash-n in index.html style');
});
test('the finder itself catches the two shapes that broke before', () => {
  assert.equal(scanJs("const a = 1; // swallows\\n const b = 2;").length, 1); assert.equal(scanJs("const s = 'ok\\n'; const t = `a\\nb`; const r = /\\n/;").length, 0);
});
