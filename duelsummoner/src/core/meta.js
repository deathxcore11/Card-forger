// Meta rules (pure, testable): Deck Box ranks to run modifiers, quest progress and rewards, mastery, map records, unlock sets, buying upgrades.
import { DECK_BOX, STARTER } from '../data/meta.js';
import { QUESTS } from '../data/quests.js';
import { MASTERY, masteryRank, MAPS, DUELIST_INFO, LIBRARY_MIN } from '../data/progress.js';

export function defaultMeta() {
  return {
    deck: {}, unlockedCards: STARTER.cards.slice(), unlockedItems: STARTER.items.slice(), questsDone: [],
    totals: { kills: 0, chests: 0, vases: 0, runs: 0, bossKills: 0, stagesCleared: 0, fusions: 0, godFusions: 0, wardenKills: 0 },
    best: {}, keys: {}, oathCount: {}, mastery: {}, maps: {}, duelists: ['kael', 'mira'], outfits: [], regalia: [], libraryOff: []
  };
}
export const rankOf = (meta, key) => Math.min(5, meta.deck[key] || 0);

// ranks -> modifiers handed to the sim as opts.meta.mods
export function deckMods(meta) {
  const m = {};
  const add = o => { for (const k of Object.keys(o)) m[k] = (m[k] || 0) + o[k]; };
  for (const key of Object.keys(DECK_BOX)) {
    const D = DECK_BOX[key], r = rankOf(meta, key);
    for (let i = 0; i < r; i++) { if (D.per) { const o = {}; for (const k of Object.keys(D.per)) o[k] = D.per[k]; add(o); } else if (D.perRank) add(D.perRank[i]); }
  }
  return m;
}
// what the sim receives. Cards the player switched off in the Card Library stay out of the offer pool.
export function simMeta(meta) {
  const off = new Set(meta.libraryOff || []);
  return { mods: deckMods(meta), cards: meta.unlockedCards.filter(c => !off.has(c)), items: meta.unlockedItems.filter(c => !off.has(c)), deck: Object.assign({}, meta.deck) };
}
// switching a card off is refused when fewer than LIBRARY_MIN would stay on
export function setCardEnabled(meta, id, on) {
  const off = new Set(meta.libraryOff || []);
  if (on) off.delete(id); else {
    const enabled = meta.unlockedCards.concat(meta.unlockedItems).filter(c => !off.has(c));
    if (!enabled.includes(id)) return true;
    if (enabled.length - 1 < LIBRARY_MIN) return false;
    off.add(id);
  }
  meta.libraryOff = Array.from(off); return true;
}

export function upgradeCost(meta, key) { const r = rankOf(meta, key); return r >= 5 ? null : DECK_BOX[key].cost[r]; }
export function buyUpgrade(meta, chips, key) {                    // returns the new chip total, or null when it cannot be bought
  const c = upgradeCost(meta, key); if (c === null || chips < c) return null;
  meta.deck[key] = rankOf(meta, key) + 1; return chips - c;
}

// ---- quests ----
export function statValue(meta, stat) {
  const [kind, name] = [stat.slice(0, stat.indexOf('.')), stat.slice(stat.indexOf('.') + 1)];
  if (kind === 'total') return meta.totals[name] || 0;
  if (kind === 'best') return meta.best[name] || 0;
  if (kind === 'key') return meta.keys[name] || 0;
  if (kind === 'oath') return meta.oathCount[name] || 0;
  if (kind === 'mastery') { if (name === 'any') return Math.max(0, ...Object.keys(meta.mastery).map(d => masteryRank(meta.mastery[d]).rank)); return masteryRank(meta.mastery[name]).rank; }
  return 0;                                                       // 'manual' and unknown stats cannot be earned yet
}
export const questProgress = (meta, q) => Math.min(q.goal, statValue(meta, q.stat));
export const questDone = (meta, q) => meta.questsDone.includes(q.id);
// the quests closest to done (for the pinned tracker): not done, earnable, ordered by share complete
export function closestQuests(meta, n) {
  return QUESTS.filter(q => !questDone(meta, q) && q.stat !== 'manual').map(q => ({ q, frac: questProgress(meta, q) / q.goal })).sort((a, b) => b.frac - a.frac || a.q.goal - b.q.goal).slice(0, n);
}
function grant(meta, q) {
  const r = q.reward || {};
  if (r.card && !meta.unlockedCards.includes(r.card)) meta.unlockedCards.push(r.card);
  if (r.item && !meta.unlockedItems.includes(r.item)) meta.unlockedItems.push(r.item);
  if (r.duelist && !meta.duelists.includes(r.duelist)) meta.duelists.push(r.duelist);
  if (r.outfit && !meta.outfits.includes(r.outfit)) meta.outfits.push(r.outfit);
  if (r.regalia && !meta.regalia.includes(r.regalia)) meta.regalia.push(r.regalia);
}
export function evaluateQuests(meta) {
  const done = [];
  for (const q of QUESTS) { if (questDone(meta, q) || statValue(meta, q.stat) < q.goal) continue; meta.questsDone.push(q.id); grant(meta, q); done.push(q); }
  return done;
}
export function questFor(kind, id) { return QUESTS.find(q => q.reward && q.reward[kind] === id); }

// ---- mastery ----
export const masteryOf = (meta, duelist) => masteryRank(meta.mastery[duelist]);
export const outfitUnlocked = (meta, duelist, outfit) => meta.outfits.includes(outfit.id) || (outfit.killsNeeded && ((meta.mastery[duelist] || { kills: 0 }).kills >= outfit.killsNeeded)) || false;

// ---- map records ----
export const mapKey = (map, difficulty, mode) => map + ':' + difficulty + (mode === 'quick' ? ':quick' : '');
export const mapRecord = (meta, map, difficulty, mode) => meta.maps[mapKey(map, difficulty, mode)] || { bestScore: 0, bestTime: 0, cleared: [] };

// results: the flat run report from the sim (src/sim/results.js). Returns the quests completed by this run.
export function applyRun(meta, r) {
  const d = defaultMeta(); for (const k of Object.keys(d)) if (meta[k] === undefined) meta[k] = d[k];           // saves from older builds gain the new fields
  const T = meta.totals, B = meta.best, mx = (k, v) => { if ((v || 0) > (B[k] || 0)) B[k] = v || 0; };
  const win = r.result === 'win' || (r.stagesCleared || 0) > 0 && r.result === 'win';
  T.kills += r.kills || 0; T.chests += r.chestsOpened || 0; T.vases += r.vasesBroken || 0; T.runs += 1; T.bossKills += r.bossKills || 0;
  T.stagesCleared = (T.stagesCleared || 0) + (r.stagesCleared || 0); T.fusions = (T.fusions || 0) + (r.fusions || 0); T.godFusions = (T.godFusions || 0) + (r.godFusions || 0); T.wardenKills = (T.wardenKills || 0) + (r.wardenKilled ? 1 : 0);
  mx('level', r.level); mx('timeSurvived', r.timeSurvived); mx('overtimeSeconds', r.overtimeSeconds); mx('trapsSet', r.trapsSet); mx('stagesCleared', r.stagesCleared);
  if ((r.bossKills || 0) > 0 && !(r.trapsSet > 0)) B.bareBossKill = 1;
  if (r.difficulty === 'hard') mx('hardStages', r.stagesCleared); if (r.difficulty === 'medium' && r.mode === 'run' && (r.stagesCleared || 0) >= 3) B.mediumFull = 1;
  for (const k of r.keys || []) meta.keys[k] = (meta.keys[k] || 0) + 1;
  for (const o of r.oathsKept || []) meta.oathCount[o] = (meta.oathCount[o] || 0) + 1;
  if (r.duelist) { const m = meta.mastery[r.duelist] || (meta.mastery[r.duelist] = { runs: 0, kills: 0 }); m.runs += 1; m.kills += r.kills || 0; }
  if (r.map) {
    const rec = meta.maps[mapKey(r.map, r.difficulty, r.mode)] || (meta.maps[mapKey(r.map, r.difficulty, r.mode)] = { bestScore: 0, bestTime: 0, cleared: [] });
    if ((r.score || 0) > rec.bestScore) rec.bestScore = r.score;
    if (win) { if (!rec.bestTime || r.timeSurvived < rec.bestTime) rec.bestTime = r.timeSurvived; if (r.duelist && !rec.cleared.includes(r.duelist)) rec.cleared.push(r.duelist); }
  }
  return evaluateQuests(meta);
}
export { MAPS, DUELIST_INFO, MASTERY };
