// Bundles the site's random deck builder into assets/random-build.js for QuickJS (RandomBuild.kt).
// node scripts/export-random-build.mjs <web root> <esbuild binary>
// Async functions are lowered to generators so they run on the bundle's own Promise (random-build-prelude.js);
// the host drains its jobs, timers and fetches. BigInt literals (a Pokémon finish hash this QuickJS cannot parse,
// never reached by a Magic build) become BigInt("…") calls.
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const [web, esbuild] = process.argv.slice(2);
const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, '..');
mkdirSync(join(app, 'build'), {recursive: true}); // a fresh checkout has no build/ yet
const entry = join(app, 'build', 'random-build-entry.mjs');
writeFileSync(entry, readFileSync(join(here, 'random-build-entry.mjs'), 'utf8').replaceAll("'WEB/", `'${resolve(web)}/`));
const sha = process.env.WEB_SHA || (() => { try { return execFileSync('git', ['-C', web, 'rev-parse', 'HEAD']).toString().trim(); } catch { return 'unknown'; } })();
const out = join(app, 'build', 'random-build.raw.js');
execFileSync(esbuild, [entry, '--bundle', '--format=iife', '--platform=neutral', '--target=es2020',
  '--supported:async-await=false', '--supported:async-generator=false', '--supported:for-await=false',
  `--inject:${join(here, 'deck-engine-prelude.js')}`, `--inject:${join(here, 'random-build-prelude.js')}`,
  '--define:import.meta.url="https://cardstashy.com/"', `--banner:js=/* CardStashy random deck builder bundle, web ${sha} */`, `--outfile=${out}`, '--log-level=error']);
let js = readFileSync(out, 'utf8').replace(/(?<![\w$.])(\d+)n\b/g, 'BigInt("$1")');
js = hoistYieldInForOf(js);
writeFileSync(join(app, 'app/src/main/assets/random-build.js'), js);
console.log('random builder bundled from', sha, (js.length / 1024).toFixed(0) + ' KB');

// This QuickJS's compiler fails ("stack underflow") on a yield inside a for-of head: for (const x of (yield y) || []) …
// Each one becomes { const __forOfN = (yield y) || []; for (const x of __forOfN) … }. Unknown shapes stop the export.
function hoistYieldInForOf(src) {
  const head = /for \((const|let|var) ([\w$]+) of /g; let m, n = 0, outText = '', last = 0;
  const close = (i, open, shut) => { let d = 0; for (let k = i; k < src.length; k++) { const c = src[k]; if (c === '"' || c === "'" || c === '`') { k = skipString(k); continue; } if (c === open) d++; else if (c === shut && --d === 0) return k; } throw Error('unbalanced at ' + i); };
  const skipString = k => { const q = src[k]; for (let j = k + 1; j < src.length; j++) { if (src[j] === '\\') { j++; continue; } if (src[j] === q) return j; } return src.length; };
  while ((m = head.exec(src))) {
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
