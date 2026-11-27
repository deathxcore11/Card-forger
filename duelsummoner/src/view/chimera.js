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
