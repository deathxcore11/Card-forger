// A content-policy-strict page (no eval): the Chimera runtime must fall back to the parents' models instead of failing. Opened by hand or by a browser check.
import { loadChimeraRuntime, chimeraModel, chimeraState, evalAllowed } from '../src/view/chimera.js';
await loadChimeraRuntime(); const r = chimeraModel('lynx', 'hat2');
window.__res = JSON.stringify({ evalAllowed: evalAllowed(), state: chimeraState(), fallback: r.fallback });
