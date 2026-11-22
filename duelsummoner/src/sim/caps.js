// Per-minute caps as token buckets (SPEC section 5.2, with the design call of 22 Nov): a cap with limit L a minute gives one charge every
// 60/L seconds and stores at most one, so the ceiling is the same but a burst never leaves the effect silent for a minute.
// Integer ids, typed arrays, no allocation per call.
import { K } from '../data/tuning.js';

export const CAP = { HURT_FIRE: 0, HURT_SELF: 1, KILL_STACK: 2, BELL: 3, MARK_EXPLODE: 4 };
export const CAP_COUNT = 5;
// HURT_FIRE is the one cap on every hurt-triggered effect (traps and items, from enemy hits and self-damage alike);
// HURT_SELF is the smaller allowance inside it for effects triggered by self-damage
const LIMITS = [K.capLimit.HURT_TRAP, K.capLimit.HURT_TRAP_SELF, K.capLimit.KILL_STACK, K.capLimit.BELL, K.capLimit.MARK_EXPLODE];

export function makeCaps() { return { tok: new Float64Array(CAP_COUNT).fill(1), taken: new Uint32Array(CAP_COUNT), denied: new Uint32Array(CAP_COUNT) }; }
export function refillCaps(g, dt) { const t = g.caps.tok; for (let i = 0; i < CAP_COUNT; i++) { const v = t[i] + LIMITS[i] / 60 * dt; t[i] = v > 1 ? 1 : v; } }
export function capReady(g, id) { return g.caps.tok[id] >= 1; }
export function capTake(g, id) { const c = g.caps; if (c.tok[id] >= 1) { c.tok[id] -= 1; c.taken[id]++; return true; } c.denied[id]++; return false; }
export const capLimit = id => LIMITS[id];
