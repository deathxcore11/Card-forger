// Compiles every AGSL shader in the app's Kotlin (`const val AGSL = """..."""`) with Skia's own runtime-effect compiler (CanvasKit,
// the same SkSL front end Android's RuntimeShader uses), so a broken shader fails here instead of drawing a plain card on the phone.
// node scripts/check-agsl.mjs [kotlin source root]   (canvaskit-wasm from CANVASKIT_DIR, or resolvable from here)
// Exit 0: all compiled. 1: a shader failed (its error is printed). 2: no CanvasKit to compile with.
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2] || path.join(here, '..', 'app', 'src', 'main', 'java');
const require = createRequire(import.meta.url);
let init;
try { init = require(process.env.CANVASKIT_DIR ? path.join(process.env.CANVASKIT_DIR, 'bin', 'canvaskit.js') : 'canvaskit-wasm'); }
catch (e) { console.log('no canvaskit-wasm: set CANVASKIT_DIR to its folder'); process.exit(2); }
const CK = await init();
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = path.join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.kt')) files.push(p); } })(root);
let n = 0, bad = 0;
for (const f of files) {
  const kt = readFileSync(f, 'utf8');
  for (const m of kt.matchAll(/const val (\w*AGSL\w*) = """([\s\S]*?)"""/g)) {
    n++; let err = '';
    const fx = CK.RuntimeEffect.Make(m[2], e => err += e);
    if (!fx) { bad++; console.log(`FAILED ${path.basename(f)} ${m[1]}: ${err.slice(0, 600)}`); continue; }
    console.log(`ok ${path.basename(f)} ${m[1]} (${fx.getUniformFloatCount()} uniform floats, ${fx.getChildCount?.() ?? '?'} children)`);
    fx.delete();
  }
}
if (!n) { console.log('no AGSL found under ' + root); process.exit(1); }
process.exit(bad ? 1 : 0);
