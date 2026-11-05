// Shared by the QuickJS bundles of the site's own code (random-build, collection-engine): esbuild with async lowered to
// generators on the bundle's own Promise, BigInt literals as calls, and yields hoisted out of for-of heads and out of
// call arguments inside try/finally.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, '..');
// Pinned in scripts/js-tools/package.json; prepare-assets.sh runs npm ci there.
const tools = join(here, 'js-tools', 'node_modules');
export const ESBUILD = join(tools, '.bin', 'esbuild');
// The browser classes QuickJS lacks: WHATWG URL/URLSearchParams (core-js) and en-US Intl number and date formatting.
export const WEB_PLATFORM = [join(here, 'web-url-prelude.js'), join(here, 'web-locale-prelude.js')];

export function bundleWeb({web, esbuild = ESBUILD, entry, name, banner, out, preludes = []}) {
  mkdirSync(join(app, 'build'), {recursive: true});
  const tmp = join(app, 'build', `${name}-entry.mjs`);
  writeFileSync(tmp, readFileSync(join(here, entry), 'utf8').replaceAll("'WEB/", `'${resolve(web)}/`));
  const sha = process.env.WEB_SHA || (() => { try { return execFileSync('git', ['-C', web, 'rev-parse', 'HEAD']).toString().trim(); } catch { return 'unknown'; } })();
  const raw = join(app, 'build', `${name}.raw.js`);
  execFileSync(esbuild, [tmp, '--bundle', '--format=iife', '--platform=neutral', '--target=es2020',
    '--supported:async-await=false', '--supported:async-generator=false', '--supported:for-await=false',
    ...preludes.map(p => `--inject:${p}`), `--inject:${join(here, 'deck-engine-prelude.js')}`, `--inject:${join(here, 'random-build-prelude.js')}`,
    '--define:import.meta.url="https://cardstashy.com/"', `--banner:js=/* ${banner}, web ${sha} */`, `--outfile=${raw}`, '--log-level=error'], {env: {...process.env, NODE_PATH: tools}});
  let js = readFileSync(raw, 'utf8').replace(/(?<![\w$.])(\d+)n\b/g, 'BigInt("$1")');
  js = hoistYieldInForOf(js);
  js = hoistYieldInTryFinally(js);
  writeFileSync(out, js);
  return {sha, kb: (js.length / 1024).toFixed(0)};
}

// This QuickJS's compiler fails ("stack underflow") on a yield inside a for-of head: for (const x of (yield y) || []) …
// Each one becomes { const __forOfN = (yield y) || []; for (const x of __forOfN) … }. Unknown shapes stop the export.
export function hoistYieldInForOf(src) {
  const head = /for \((const|let|var) ([\w$]+) of /g; let m, n = 0, outText = '', last = 0;
  const close = (i, open, shut) => { let d = 0; for (let k = i; k < src.length; k++) { const c = src[k]; if (c === '"' || c === "'" || c === '`') { k = skipString(k); continue; } if (c === open) d++; else if (c === shut && --d === 0) return k; } throw Error('unbalanced at ' + i); };
  const skipString = k => { const q = src[k]; for (let j = k + 1; j < src.length; j++) { if (src[j] === '\\') { j++; continue; } if (src[j] === q) return j; } return src.length; };
  while ((m = head.exec(src))) {
    // Only heads with a yield on their line are rewritten (a regex with quotes elsewhere must not be scanned).
    if (!/\byield\b/.test(src.slice(m.index, src.indexOf('\n', m.index) >>> 0))) continue;
    const exprStart = m.index + m[0].length, parenOpen = m.index + 4, parenClose = close(parenOpen, '(', ')');
    const expr = src.slice(exprStart, parenClose);
    if (!/\byield\b/.test(expr)) continue;
    let bodyEnd, k = parenClose + 1; while (src[k] === ' ') k++;
    if (src[k] === '{') bodyEnd = close(k, '{', '}') + 1;
    else { let d = 0; for (bodyEnd = k; bodyEnd < src.length; bodyEnd++) { const c = src[bodyEnd]; if (c === '"' || c === "'" || c === '`') { bodyEnd = skipString(bodyEnd); continue; } if ('([{'.includes(c)) d++; else if (')]}'.includes(c)) d--; else if (c === ';' && d === 0) { bodyEnd++; break; } if (c === '\n' && d === 0) throw Error('for-of body shape at ' + m.index); } }
    const v = '__forOf' + (++n);
    outText += src.slice(last, m.index) + `{ const ${v} = ${expr}; for (${m[1]} ${m[2]} of ${v}) ${src.slice(k, bodyEnd)} }`;
    last = bodyEnd; head.lastIndex = bodyEnd;
  }
  if (n) console.log('hoisted', n, 'yield(s) out of for-of heads');
  return outText + src.slice(last);
}

// This QuickJS's compiler also fails ("unconsistent stack size") on a yield whose value feeds a call while a finally is
// pending: try { f(a, (yield b).c); } finally { … }. Each such statement becomes const __yieldN = yield b; f(a, __yieldN.c);
// (the callee and the arguments before it are plain names, so nothing is evaluated out of order). Any other yield inside
// such a try that is not a statement's head (yield x; const v = yield x; v = yield x; return yield x) stops the export.
export function hoistYieldInTryFinally(src) {
  const skipString = k => { const q = src[k]; for (let j = k + 1; j < src.length; j++) { if (src[j] === '\\') { j++; continue; } if (src[j] === q) return j; } return src.length; };
  const close = i => { let d = 0; for (let k = i; k < src.length; k++) { const c = src[k]; if (c === '"' || c === "'" || c === '`') { k = skipString(k); continue; } if (c === '{') d++; else if (c === '}' && --d === 0) return k; } throw Error('unbalanced at ' + i); };
  const edits = [];
  const tryRe = /\btry \{/g; let m;
  while ((m = tryRe.exec(src))) {
    const open = m.index + 4, end = close(open);
    let k = end + 1, ranges = [[open, end]];
    const c = /^\s*catch(?: \([^)]*\))? \{/.exec(src.slice(k, k + 80));
    if (c) { const o = k + c[0].length - 1, e = close(o); ranges.push([o, e]); k = e + 1; }
    if (!/^\s*finally \{/.test(src.slice(k, k + 40))) continue;
    for (const [a, b] of ranges) {
      // The try's own yields: nested functions have their own (their tries are checked on their own).
      const nested = []; const fn = /\bfunction\*? *[\w$]*\s*\([^)]*\)\s*\{/g; fn.lastIndex = a + 1; let f;
      while ((f = fn.exec(src)) && f.index < b) { const e = close(f.index + f[0].length - 1); nested.push([f.index, e]); fn.lastIndex = e; }
      const y = /\byield\b/g; y.lastIndex = a; let v;
      while ((v = y.exec(src)) && v.index < b) {
        if (nested.some(([p, q]) => v.index > p && v.index < q)) continue;
        const ls = src.lastIndexOf('\n', v.index) + 1, prefix = src.slice(ls, v.index), prev = src.slice(0, ls).trimEnd().slice(-1);
        // A statement's head, also as an if / else / while body on the same line.
        if (/^\s*(?:\}\s*)?(?:else\s+)?(?:(?:if|while) \(.*\)\s*)?(?:(?:const|let|var) [\w$]+ = |[\w$.]+ = |return )?\(?$/.test(prefix)) continue;
        const call = /^(\s*)([\w$.]+)\(((?:[\w$.]+, )*)\($/.exec(prefix);
        if (!call || !';{}'.includes(prev)) throw Error('yield inside try/finally in a shape this QuickJS cannot compile, at ' + src.slice(ls, ls + 160));
        let d = 0, pc = v.index - 1; for (let q = pc; q < src.length; q++) { const ch = src[q]; if (ch === '"' || ch === "'" || ch === '`') { q = skipString(q); continue; } if (ch === '(') d++; else if (ch === ')' && --d === 0) { pc = q; break; } }
        edits.push({ls, from: v.index - 1, to: pc + 1, indent: call[1], expr: src.slice(v.index, pc)});
      }
    }
  }
  let out = '', last = 0, n = 0;
  for (const e of edits.sort((p, q) => p.ls - q.ls)) {
    if (e.ls < last) throw Error('two yields to hoist in one statement at ' + src.slice(e.ls, e.ls + 120));
    const name = '__yield' + (++n);
    out += src.slice(last, e.ls) + `${e.indent}const ${name} = ${e.expr};\n` + src.slice(e.ls, e.from) + name;
    last = e.to;
  }
  if (n) console.log('hoisted', n, 'yield(s) out of call arguments in try/finally');
  return out + src.slice(last);
}
