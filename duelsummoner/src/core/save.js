// One local save file with a version number, written after every run (and, later, every purchase).
// records are kept per duelist: longest time survived, most kills, highest level.
import { defaultMeta } from './meta.js';
export const SAVE_VERSION = 2;

export function freshSave() { return { v: SAVE_VERSION, records: {}, starChips: 0, runs: 0, bossKills: 0, meta: defaultMeta(), settings: defaultSettings() }; }
// In memory `settings` is the resolved flat object the game reads (defaults plus the player's overrides). On disk (v2) it is overrides only, under the spec names (camShake, not shake),
// so a default that changes later reaches every player who never touched the row.
export function defaultSettings() { return { reduceMotion: false, shake: 80, difficulty: 'medium', fov: 100, fpsCap: 60, detail: 'auto' }; }
const V1_DEFAULTS = { reduceMotion: false, shake: 100, difficulty: 'medium', fov: 100, fpsCap: 60 };
const TO_DISK = { shake: 'camShake' }, FROM_DISK = { camShake: 'shake' };
export function overridesOf(settings) { const d = defaultSettings(), out = {}; for (const k in settings) if (settings[k] !== d[k] && settings[k] !== undefined) out[TO_DISK[k] || k] = settings[k]; return out; }
export function resolveSettings(ov) { const out = defaultSettings(); for (const k in (ov || {})) out[FROM_DISK[k] || k] = ov[k]; return out; }
// v1 to v2: keep everything, drop settings equal to the v1 defaults (they are not overrides), rename shake to camShake.
export function migrateV1(s) { const out = Object.assign({}, s, { v: 2 }), ov = {}, old = s.settings || {}; for (const k in old) if (old[k] !== V1_DEFAULTS[k] || k === 'shake') ov[TO_DISK[k] || k] = old[k]; out.settings = ov; return out; }       // a v1 player keeps the shake they had (the new-save default is 80)
function withDefaults(s) {                                           // older saves gain new fields without losing progress
  const d = freshSave(), out = Object.assign(d, s), m = defaultMeta();
  out.meta = Object.assign(m, s.meta || {}); out.meta.totals = Object.assign(m.totals, (s.meta && s.meta.totals) || {}); out.meta.deck = Object.assign({}, (s.meta && s.meta.deck) || {});
  out.settings = resolveSettings(s.settings);
  for (const c of m.unlockedCards) if (!out.meta.unlockedCards.includes(c)) out.meta.unlockedCards.push(c);
  for (const c of m.unlockedItems) if (!out.meta.unlockedItems.includes(c)) out.meta.unlockedItems.push(c);
  return out;
}

// Storage goes through the host (src/core/host.js); this file is pure.
export function loadSave(host) {
  const s = host.save.load();
  if (!s) return freshSave();
  if (s.v > SAVE_VERSION) { const f = freshSave(); f._readOnly = true; return f; }       // a save from a newer build: shown as fresh, never written over
  if (s.v === 1) return withDefaults(migrateV1(s));
  if (s.v !== SAVE_VERSION) return freshSave();
  return withDefaults(s);
}
export function writeSave(host, save) { if (save._readOnly) return false; const o = Object.assign({}, save, { v: SAVE_VERSION, settings: overridesOf(save.settings) }); return host.save.write(o); }

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

