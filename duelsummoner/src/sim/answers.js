// The trick answers engine (plan section 11): ride.js calls answerTrick(g, kind, x, y, z) when a trick lands; each card held that answers it acts, on its cooldown.
import { ANSWERS } from '../data/answers.js';
import { damageOf, def } from './field.js';
import { splash } from './weapons.js';
import { damageEnemy } from './combat.js';
import { MARKS } from '../data/cards.js';
import { elemBits } from '../data/elements.js';
const lvlK = L => 1 + (L >= 5 ? 0.5 : 0) + (L >= 10 ? 0.5 : 0);
function markNear(g, x, z, n, r) { const e = g.en, pick = []; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - x, dz = e.z[i] - z, d = dx * dx + dz * dz; if (d < r * r) pick.push([d, i]); } pick.sort((a, b) => a[0] - b[0]); for (let k = 0; k < Math.min(n, pick.length); k++) e.mark[pick[k][1]] = MARKS.duration + (g.mods.markDur || 0); return pick.length; }
// every card held: [id, level, monster or null]
function held(g) { const out = []; for (const m of g.field.monsters) if (m) out.push([m.id, m.level, m]); for (const s of g.field.spells) if (s) out.push([s.id, s.level || 1, null]); return out; }
export function answerTrick(g, kind, x, y, z) {
  const cd = g.ansCd || (g.ansCd = {}), cnt = g.ansCount || (g.ansCount = {}); let fired = 0;
  for (const [id, L, m] of held(g)) {
    const list = ANSWERS[id]; if (!list) continue;
    list.forEach((a, ai) => {
      if (a.on !== kind) return; const key = id + ai; if ((cd[key] || 0) > g.t) return; cd[key] = g.t + a.cd; fired++; cnt[id] = (cnt[id] || 0) + 1;
      const k = m ? lvlK(L) : 1 + 0.25 * (L - 1), D = m ? damageOf(m) : 0, fl = m ? elemBits(def(id).elements) : 0; g.curSrc = g.srcIndex ? g.srcIndex(id) : 0;
      switch (id) {
        case 'ember-wyvern': splash(g, x, y, z, 2.5, D * 1.2 * k, fl); break;
        case 'cinder-hatchling': splash(g, x, y, z, 3.5 * (1 + (k - 1) * 0.4), D * 3 * k, fl); break;
        case 'rune-apprentice': markNear(g, x, z, Math.round(3 * k), 18); break;
        case 'sigil-familiar': splash(g, x, y, z, 5, D * 2 * k, fl); break;
        case 'twinflare-tyrant': if (kind === 'grind') splash(g, x, y, z, 3.5, D * 1.5 * k, fl); else splash(g, x, y, z, 6.5, D * 4 * k, fl); break;
        case 'astral-magus': if (kind === 'flip') markNear(g, x, z, Math.round(5 * k), 22); else splash(g, x, y, z, 5, 12 * k, fl); break;
        case 'toll-of-ash': splash(g, x, y, z, 4, 4 * k, 1); break;
        case 'kindling-rite': splash(g, x, y, z, 2.5, 2 * k, 1); break;
        case 'deep-marks': markNear(g, x, z, 99, 10); g.p.hp = Math.min(g.p.maxHp, g.p.hp + 2 * k); break;
        case 'pack-drill': for (const q of g.field.monsters) if (q) q.cd = Math.max(0, q.cd - 0.25 * k); break;
        case 'elemental-litany': splash(g, x, y, z, 5, 3 * k * Math.max(1, g.field.monsters.filter(Boolean).length), 0); break;
        case 'widening-rite': splash(g, x, y, z, 5 + 1.2 * k, 3 * k, 0); break;
        case 'swift-draw': g.cardT = 0; break;
        case 'runners-sash': { const r = g.p.ride; if (r) r.speed = Math.min(26, r.speed + 0.6 * k); break; }
        case 'heart-of-the-cards': g.p.hp = Math.min(g.p.maxHp, g.p.hp + 1.5 * k); break;
        case 'collectors-eye': { const P = g.pick, R = 8 + 2 * k; for (let i = 0; i < P.max; i++) { if (!P.alive[i]) continue; const dx = P.x[i] - x, dz = P.z[i] - z; if (dx * dx + dz * dz < R * R) { P.x[i] = g.p.x; P.z[i] = g.p.z; } } break; }
        case 'gust-ward': { const e = g.en; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - x, dz = e.z[i] - z, d2 = dx * dx + dz * dz; if (d2 < 25 && d2 > 1e-6) { const d = Math.sqrt(d2); e.x[i] += dx / d * 4; e.z[i] += dz / d * 4; damageEnemy(g, i, 2 * k, { noCrit: true }); } } break; }
        case 'pit-of-seals': { splash(g, x, y, z, 4, 10 * k, 0); const e = g.en; for (let i = 0; i < e.max; i++) { if (!e.alive[i]) continue; const dx = e.x[i] - x, dz = e.z[i] - z; if (dx * dx + dz * dz < 36) e.root[i] = Math.max(e.root[i], 2); } g.p.hp = Math.min(g.p.maxHp, g.p.hp + 3 * k); break; }       // the seal pit roots what is near the stone for 2 s and mends you a little
        default: switch (a.gen) {       // a roster summon answers by its job
          case 'burst': splash(g, x, y, z, 3.5, D * 2.5 * k, fl); break;
          case 'storm': splash(g, x, y, z, 6, D * 3 * k, fl); break;
          case 'haste': if (m) m.cd = 0; break;
          case 'mark': markNear(g, x, z, Math.round(3 * k), 18); break;
          case 'mend': g.p.hp = Math.min(g.p.maxHp, g.p.hp + 1.5 * k); break;
          case 'drill': for (const q of g.field.monsters) if (q) q.cd = Math.max(0, q.cd - 0.15 * k); break;
        }
      }
      g.curSrc = 0; g.emit('answer', x, z, 0, id);
    });
  }
  return fired;
}
