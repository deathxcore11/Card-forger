// Which summons a save owns (owner, 28 Nov: "you start off the game with ... 8 and you have to unlock the rest"). Pure data rules, no browser, no sim state.
// A fresh save owns one starter for each element. Every other basic of the roster has one line in src/data/unlocks.gen.js and is unlocked by play:
//   lv       take a named summon to a level;                 fam2     take two commons of a family to a level;
//   fuseEl   make a Fusion with a parent of an element;      fuseFam  make a Fusion from two creatures of a family;
//   clear3   clear a stage with three of a family on the field;
//   feat     a special feat. STAND-IN until each feat exists in the game (the owner was asked, 28 Nov): the feat groups of an element open one after another,
//            the first when one summon of that element has reached level 5, the second at two, and so on. The line shown says so.
import { SUMMON_UNLOCKS } from '../data/unlocks.gen.js';
import { BASICS, FAMILIES, ALIAS } from '../data/roster.js';

const B = Object.fromEntries(BASICS.map(b => [b.id, b])), GAME_ID = {}; for (const k of Object.keys(ALIAS || {})) GAME_ID[ALIAS[k]] = k;       // roster id -> the id the game plays it under (rune-newt is played as rune-apprentice)
export const gameId = id => GAME_ID[id] || id;
export const START_SUMMONS = Object.keys(SUMMON_UNLOCKS).filter(id => SUMMON_UNLOCKS[id][0] === 'start').map(gameId);
const FEAT_STEP = 5;
// the feat groups of each element, in order: summons that share one feat line open together
const GROUP = {}, ORDER = {};
for (const id of Object.keys(SUMMON_UNLOCKS)) { const r = SUMMON_UNLOCKS[id]; if (r[0] !== 'feat') continue; const el = B[id].element, key = el + '|' + r[r.length - 1], L = ORDER[el] || (ORDER[el] = []); if (!L.includes(key)) L.push(key); GROUP[id] = [el, L.indexOf(key) + 1]; }
const NAME = { fire: 'Fire', lightning: 'Lightning', ice: 'Ice', light: 'Light', dark: 'Dark', earth: 'Earth', poison: 'Poison', wind: 'Wind' };

export function summonMeta(meta) {
  if (!meta.summons) meta.summons = START_SUMMONS.slice(); if (!meta.sumBest) meta.sumBest = {}; if (!meta.fuseEl) meta.fuseEl = {}; if (!meta.fuseFam) meta.fuseFam = {}; if (!meta.clear3) meta.clear3 = {};
  return meta;
}
const best = (meta, id) => Math.max(meta.sumBest[id] || 0, meta.sumBest[gameId(id)] || 0);
const atLevel = (meta, test, lv) => BASICS.filter(b => test(b) && best(meta, b.id) >= lv).length;
// [have, need] toward a summon's unlock
export function summonProgress(meta, id) {
  summonMeta(meta); const r = SUMMON_UNLOCKS[id]; if (!r) return [1, 1];
  switch (r[0]) {
    case 'start': return [1, 1];
    case 'lv': return [Math.min(r[2], best(meta, r[1])), r[2]];
    case 'fam2': return [Math.min(2, atLevel(meta, b => b.family === r[1] && b.rarity === 'common', r[2])), 2];
    case 'fuseEl': return [meta.fuseEl[r[1]] ? 1 : 0, 1];
    case 'fuseFam': return [meta.fuseFam[r[1]] ? 1 : 0, 1];
    case 'clear3': return [meta.clear3[r[1]] ? 1 : 0, 1];
    default: { const [el, n] = GROUP[id]; return [Math.min(n, atLevel(meta, b => b.element === el, FEAT_STEP)), n]; }
  }
}
export function summonLine(id) {
  const r = SUMMON_UNLOCKS[id]; if (!r) return ''; if (r[0] !== 'feat') return r[r.length - 1];
  const [el, n] = GROUP[id]; return 'Take ' + n + ' ' + NAME[el] + ' summon' + (n > 1 ? 's' : '') + ' to level ' + FEAT_STEP + '. (Its own feat comes later: ' + r[r.length - 1] + ')';
}
export const summonOwned = (meta, id) => summonMeta(meta).summons.includes(gameId(id));
// what a finished run adds: r.summonPeaks [[id, level]], r.fusedPairs [[a, b]], r.clear3 [family]. Returns the roster ids unlocked by it.
export function applySummonRun(meta, r) {
  summonMeta(meta);
  for (const [id, lv] of r.summonPeaks || []) if (lv > (meta.sumBest[id] || 0)) meta.sumBest[id] = lv;
  for (const [a, b] of r.fusedPairs || []) { const A = B[ALIAS[a] || a], Bb = B[ALIAS[b] || b]; if (A) meta.fuseEl[A.element] = 1; if (Bb) meta.fuseEl[Bb.element] = 1; if (A && Bb && A.family === Bb.family) meta.fuseFam[A.family] = 1; }
  for (const f of r.clear3 || []) meta.clear3[f] = 1;
  const fresh = [];
  for (let pass = 0; pass < 4; pass++) { let any = false; for (const id of Object.keys(SUMMON_UNLOCKS)) { const g = gameId(id); if (meta.summons.includes(g)) continue; const [h, n] = summonProgress(meta, id); if (h >= n) { meta.summons.push(g); fresh.push(id); any = true; } } if (!any) break; }
  return fresh;
}
// the nearest locked summons, for the "next goals" list: [{ id, have, need, line }]
export function nearestSummons(meta, n) {
  summonMeta(meta); const out = [];
  for (const id of Object.keys(SUMMON_UNLOCKS)) { if (meta.summons.includes(gameId(id))) continue; const [h, need] = summonProgress(meta, id); out.push({ id, have: h, need, line: summonLine(id), frac: h / need }); }
  return out.sort((a, b) => b.frac - a.frac || a.need - b.need).slice(0, n);
}
export const familyOf = id => (B[ALIAS[id] || id] || {}).family;
void FAMILIES;
