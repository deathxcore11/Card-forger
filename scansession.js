import {YGO_EDITIONS} from './ygo-identity.js';
import {privateKey} from './account-scope.js';
// Scan sessions: defaults you set once (finish, condition, language, quantity), a running list of
// everything scanned with prices, and one tap to save it all to the collection. Kept per game on
// this device, so a long sorting session survives a reload.

export const FINISHES = {
  mtg: [["nonfoil", "Normal"], ["foil", "Foil"], ["etched", "Etched"]],
  ptcg: [["normal", "Normal"], ["holofoil", "Holo"], ["reverse-holofoil", "Reverse"]],
  ygo: YGO_EDITIONS,
};
export const CONDITIONS = [["Near Mint", "NM"], ["Lightly Played", "LP"], ["Moderately Played", "MP"], ["Heavily Played", "HP"], ["Damaged", "DMG"]];
export const LANGS = [["en", "EN"], ["ja", "JA"], ["de", "DE"], ["fr", "FR"], ["it", "IT"], ["es", "ES"], ["pt", "PT"], ["ko", "KO"], ["zhs", "ZH"]];
export const QTYS = [1, 2, 3, 4];

const PREFS_KEY = "cardstashy-scan-prefs-v1";
const SESSION_KEY = (g) => "cardstashy-scan-session-v1-" + g;
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(privateKey(k)) || "null") ?? d;
  } catch {
    return d;
  }
};
const write = (k, v) => {
  try {
    localStorage.setItem(privateKey(k), JSON.stringify(v));
  } catch {}
};

export const DEFAULT_PREFS = { quick: false, sounds: true, haptics: true, showValue: true, preferFoil: false, ignorePromos: false, lockSet: "", camera: "", qty: 1, condition: "Near Mint", lang: "en", location: "" };
// Per-game finish default, shared settings otherwise.
export function loadPrefs(g) {
  const all = read(PREFS_KEY, {}) || {};
  const p = { ...DEFAULT_PREFS, ...(all.shared || {}) };
  // Old installs enabled quick-add by default. Require a fresh opt-in to bypass confirmation.
  p.quick = p.quick === true && all.shared?.quickVersion === 2;
  p.finish = all[g]?.finish || (p.preferFoil ? FINISHES[g][1][0] : FINISHES[g][0][0]);
  p.lockSet = all[g]?.lockSet || "";
  p.finishConfirmed = all[g]?.finishConfirmed === true;
  return p;
}
export function savePrefs(g, patch) {
  const all = read(PREFS_KEY, {}) || {};
  const { finish, finishConfirmed, lockSet, ...shared } = patch;
  if (Object.hasOwn(patch, "quick")) shared.quickVersion = 2;
  all.shared = { ...(all.shared || {}), ...shared };
  all[g] = { ...(all[g] || {}), ...(finish !== undefined ? { finish, finishConfirmed: finishConfirmed !== false } : {}), ...(finishConfirmed !== undefined ? { finishConfirmed } : {}), ...(lockSet !== undefined ? { lockSet } : {}) };
  write(PREFS_KEY, all);
  return loadPrefs(g);
}

export const loadSession = (g) => (Array.isArray(read(SESSION_KEY(g), [])) ? read(SESSION_KEY(g), []) : []);
export const saveSession = (g, list) => write(SESSION_KEY(g), list);

// Same printing, finish, condition and language stack into one row.
export const itemKey = (it) => [it.id, it.print || it.cand?.print || "", it.variantKey || it.finish, it.productId || "", it.condition, it.lang].join("|");
export function addToSession(list, item) {
  const k = itemKey(item),
    same = list.find((x) => itemKey(x) === k);
  if (same) {
    same.qty += item.qty;
    same.at = Date.now();
    return [same, ...list.filter((x) => x !== same)];
  }
  return [{ ...item, at: Date.now() }, ...list];
}
export const sessionCount = (list) => list.reduce((a, x) => a + (Number(x.qty) || 0), 0);
export const sessionValue = (list) => list.reduce((a, x) => a + (x.price ?? 0) * (Number(x.qty) || 0), 0);
export const sessionUnpriced = (list) => list.reduce((a, x) => a + (x.price == null ? Number(x.qty) || 0 : 0), 0);

// "2 Lightning Bolt (M21) 162 *F*" — the import format most apps (Moxfield, ManaBox) read.
export function sessionText(list) {
  return list
    .slice()
    .reverse()
    .map((x) => `${x.qty} ${x.name}${x.setCode ? ` (${String(x.setCode).toUpperCase()})` : ""}${x.number ? ` ${x.number}` : ""}${/foil|holo/i.test(x.finish) && !/^normal|nonfoil$/.test(x.finish) ? " *F*" : ""}`)
    .join("\n");
}

// Short success/fail sounds (no files) and a tap of vibration.
let audio = null;
export function feedback(kind, prefs) {
  if (prefs.haptics && navigator.vibrate) navigator.vibrate(kind === "ok" ? 25 : [40, 60, 40]);
  if (!prefs.sounds) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime,
      notes = kind === "ok" ? [880, 1320] : [300, 220];
    notes.forEach((f, i) => {
      const o = audio.createOscillator(),
        gn = audio.createGain();
      o.type = "sine";
      o.frequency.value = f;
      gn.gain.setValueAtTime(0.0001, t + i * 0.09);
      gn.gain.exponentialRampToValueAtTime(0.18, t + i * 0.09 + 0.01);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.12);
      o.connect(gn).connect(audio.destination);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.14);
    });
  } catch {}
}
