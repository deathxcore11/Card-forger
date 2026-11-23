// One local save file with a version number, written after every run (and, later, every purchase).
// records are kept per duelist: longest time survived, most kills, highest level.
import { defaultMeta } from './meta.js';
export const SAVE_VERSION = 1;

export function freshSave() { return { v: SAVE_VERSION, records: {}, starChips: 0, runs: 0, bossKills: 0, meta: defaultMeta(), settings: defaultSettings() }; }
export function defaultSettings() { return { reduceMotion: false, shake: 100, difficulty: 'medium', fov: 100 }; }
function withDefaults(s) {                                           // older saves gain new fields without losing progress
  const d = freshSave(), out = Object.assign(d, s), m = defaultMeta();
  out.meta = Object.assign(m, s.meta || {}); out.meta.totals = Object.assign(m.totals, (s.meta && s.meta.totals) || {}); out.meta.deck = Object.assign({}, (s.meta && s.meta.deck) || {});
  out.settings = Object.assign(defaultSettings(), s.settings || {});
  for (const c of m.unlockedCards) if (!out.meta.unlockedCards.includes(c)) out.meta.unlockedCards.push(c);
  for (const c of m.unlockedItems) if (!out.meta.unlockedItems.includes(c)) out.meta.unlockedItems.push(c);
  return out;
}

// Storage goes through the host (src/core/host.js); this file is pure.
export function loadSave(host) {
  const s = host.save.load();
  if (!s || s.v !== SAVE_VERSION) return freshSave();                    // later versions migrate here
  return withDefaults(s);
}
export function writeSave(host, save) { return host.save.write(save); }

// Applies one finished run. Returns { record, newBest } so the results screen can say "NEW BEST".
export function recordRun(host, save, duelist, run) {
  const r = save.records[duelist] || { bestTime: 0, mostKills: 0, highestLevel: 0, runs: 0, bossKills: 0 };
  const newBest = run.time > r.bestTime;
  r.bestTime = Math.max(r.bestTime, run.time); r.mostKills = Math.max(r.mostKills, run.kills); r.highestLevel = Math.max(r.highestLevel, run.level);
  r.runs++; if (run.bossKilled) { r.bossKills++; save.bossKills++; }
  save.records[duelist] = r; save.runs++; save.starChips += run.chips || 0;
  writeSave(host, save);
  return { record: r, newBest };
}

