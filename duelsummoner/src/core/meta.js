// Meta rules (pure, testable): Deck Box ranks to run modifiers, quest evaluation, unlock sets, buying upgrades.
import { DECK_BOX, STARTER, QUESTS } from '../data/meta.js';

export function defaultMeta() {
  return { deck: {}, unlockedCards: STARTER.cards.slice(), unlockedItems: STARTER.items.slice(), questsDone: [], totals: { kills: 0, chests: 0, vases: 0, runs: 0 } };
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
// what the sim receives
export function simMeta(meta) { return { mods: deckMods(meta), cards: meta.unlockedCards.slice(), items: meta.unlockedItems.slice() }; }

export function upgradeCost(meta, key) { const r = rankOf(meta, key); return r >= 5 ? null : DECK_BOX[key].cost[r]; }
export function buyUpgrade(meta, chips, key) {                    // returns the new chip total, or null when it cannot be bought
  const c = upgradeCost(meta, key); if (c === null || chips < c) return null;
  meta.deck[key] = rankOf(meta, key) + 1; return chips - c;
}

// stats: { time, kills, level, fusions, bossKilled, wardenKilled, overtime, trapSet, chests, vases }
export function applyRun(meta, stats) {
  const T = meta.totals; T.kills += stats.kills || 0; T.chests += stats.chests || 0; T.vases += stats.vases || 0; T.runs += 1;
  const done = [];
  for (const q of QUESTS) {
    if (meta.questsDone.includes(q.id) || !q.test(stats, T)) continue;
    meta.questsDone.push(q.id); done.push(q);
    if (q.unlock.card && !meta.unlockedCards.includes(q.unlock.card)) meta.unlockedCards.push(q.unlock.card);
    if (q.unlock.item && !meta.unlockedItems.includes(q.unlock.item)) meta.unlockedItems.push(q.unlock.item);
  }
  return done;
}
export function questFor(kind, id) { return QUESTS.find(q => q.unlock[kind] === id); }
