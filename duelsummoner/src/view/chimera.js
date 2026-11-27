// Chimera models on the device (block look). The block runtime and the recipe text are runtime assets kept out of the repo (assets/models/blocks/runtime/),
// like the models. createBlockRuntime(sourceText) evaluates the recipes with new Function; a page whose content policy forbids that gets the fallback:
// the parents' larger block model, and one console line saying so. Results are cached by pair.
import { decodeEwv3, BLOCKS } from './models.js';
const BASE = 'assets/models/blocks/runtime/', FILES = ['engine.js', 'models.js', 'models2.js', 'models3.js', 'models4.js', 'models5.js', 'models6.js', 'chimera.js'];       // models6.js before chimera.js
let rt = null, state = 'idle', why = '';
const cache = new Map();
export function chimeraState() { return { state, why, cached: cache.size }; }
export function evalAllowed() { try { return new Function('return 1')() === 1; } catch (e) { return false; } }
export async function loadChimeraRuntime() {
  if (rt || state === 'loading') return rt; state = 'loading';
  try {
    if (!evalAllowed()) throw new Error('this page forbids new Function (content policy)');
    const mod = await import('../../' + BASE + 'block-runtime.mjs');
    const text = (await Promise.all(FILES.map(f => fetch(BASE + f, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('missing ' + f); return r.text(); })))).join('\n');
    rt = mod.createBlockRuntime(text); state = 'ready';
  } catch (e) { rt = null; state = 'fallback'; why = e.message; console.warn('Chimera runtime unavailable, using the parents\' models:', e.message); }
  return rt;
}
// a model for the pair (block recipe ids): { id, name, model (decoded EWV3), fallback }
export function chimeraModel(idA, idB) {
  const key = [idA, idB].sort().join('+'); if (cache.has(key)) return cache.get(key);
  let res = null;
  if (rt) { try { const c = rt.buildChimera(idA, idB); res = { id: c.id, name: c.name, model: decodeEwv3(c.bytes), fallback: false }; } catch (e) { why = e.message; console.warn('Chimera build failed for', key, e.message); } }
  if (!res) { const a = BLOCKS[idA], b = BLOCKS[idB], big = !a ? b : !b ? a : (a.size.y >= b.size.y ? a : b); res = { id: 'chi_' + key, name: '', model: big || null, fallback: true }; }
  cache.set(key, res); return res;
}

// ---- fused bodies (fusion lab v7 body rule: up to two limb slots, then hide, growth and crest, all fixed by a hash of the id) ----
// The lab's engine (design/fusion-lab/chimera.js + fusion.js) runs inside the block runtime in place of the runtime's own chimera.js, and fuse(a, b) gives a recipe id
// that the runtime bakes like any model. A Fusion on the field is drawn from its two parents' full forms. Without the runtime the summon keeps its old model.
const LAB = 'design/fusion-lab/';
let frt = null, fstate = 'idle';
const fcache = new Map();
export async function loadFusionBodies() {
  if (frt || fstate === 'loading') return frt; fstate = 'loading';
  try {
    if (!evalAllowed()) throw new Error('this page forbids new Function (content policy)');
    const mod = await import('../../' + BASE + 'block-runtime.mjs'), get = u => fetch(u, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('missing ' + u); return r.text(); });
    const base = await Promise.all(FILES.filter(f => f !== 'chimera.js').map(f => get(BASE + f))), lab = await Promise.all(['chimera.js', 'fusion.js'].map(f => get(LAB + f)));
    frt = mod.createBlockRuntime(base.concat(lab).join('\n') + '\n;globalThis.__dsFuse = (a, b, s) => { let x = s >>> 0 || 1; return fuse(a, b, () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296)); };');
    fstate = 'ready';
  } catch (e) { frt = null; fstate = 'fallback'; console.warn('Fused bodies unavailable:', e.message); }
  return frt;
}
// the fused body of two block models (ids of their full forms), decoded; null when it cannot be made
export function fusedBody(idA, idB, seed) {
  const key = idA + '__' + idB; if (fcache.has(key)) return fcache.get(key);
  let m = null;
  if (frt && globalThis.__dsFuse) { try { const id = globalThis.__dsFuse(idA, idB, seed || 7); if (id) m = decodeEwv3(frt.bake(id)); } catch (e) { console.warn('Fused body failed for', key, e.message); } }
  fcache.set(key, m); return m;
}
