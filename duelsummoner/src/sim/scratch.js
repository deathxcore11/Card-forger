// Candidate lists for grid queries. A blast, a cone or a trap walks its list while the damage it deals can start another blast, which queries the grid again;
// with one shared array the inner query overwrote the outer one. Every caller now takes its own slab and frees it when its loop ends. Slabs grow on demand.
import { CFG } from '../data/config.js';

const slabs = []; let depth = 0;
export function takeBuf() { if (depth === slabs.length) slabs.push(new Int32Array(CFG.enemy.max)); return slabs[depth++]; }
export function freeBuf() { if (depth > 0) depth--; }
export function resetBufs() { depth = 0; }       // the top of every tick: a throw inside a loop can never leak a slab
