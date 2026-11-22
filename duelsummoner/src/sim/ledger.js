// The Ledger, phase 1: curves, brackets and the level / form / tier multipliers (design/stat-engine/SPEC.md sections 2, 3 and 8).
// Pure and integer-friendly: only + - * / and comparisons, so it is safe for the deterministic sim and the native port.
// Not yet ported: the full stat sheet, caps, self-damage pipeline, reactions, Tuning rolls and duelist passives (see the integration notes).
import { K } from '../data/tuning.js';
import { FUSIONS } from '../data/cards.js';

// linear up to a, then hyperbolic toward a + k
export const knee = (s, a, k) => (s <= a ? s : a + (s - a) * k / ((s - a) + k));
export const hyp = (x, k) => x / (k + x);

export const lvlMul = L => 1 + K.lvlSlope * (L - 1);                 // level 10 = 2.08
export const rateMul = L => 1 + K.lvlRate * (L - 1);                 // level 10 = 1.225
export const formMul = L => (L >= K.formAt[2] ? K.form[2] : L >= K.formAt[1] ? K.form[1] : K.form[0]);
export const tierMul = id => (FUSIONS[id] ? K.tier[1] : K.tier[0]);   // God and Secret Fusions are not built yet
export const monsterMul = (id, L) => lvlMul(L) * formMul(L) * tierMul(id);

// bracket 1: Might, a fraction such as 0.35 (the sheet will hold basis points)
export const mightBracket = m => 1 + knee(m, K.knee1, K.kneeK1);
// bracket 4: marks, Hunter and Swarmbane add up, then knee
export const targetBracket = s => 1 + knee(s, K.knee4, K.kneeK4);
export const critMul = fero => (K.critBase + fero > K.critCap ? K.critCap : K.critBase + fero);
export const keenChance = pts => K.keenBase + K.keenSpan * hyp(pts, K.keenK);
export const guardMit = g => { const m = hyp(g, K.guardK); return m > K.guardCap ? K.guardCap : m; };
export const fervorMul = f => 1 + hyp(f, K.fervK);
export const procChance = (p0, coef, fervor) => { const p = p0 * coef * fervorMul(fervor); return p > K.procCap ? K.procCap : p; };
