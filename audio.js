// Sound and music: one small manager for the whole app (and Planeswalk, which imports it too).
// Cue IDs are the sound bible's (audio/cardstashy-sound-cues.csv, cardstashy-music-cues.csv).
// Short effects ship with the app in assets/audio/sfx (Opus, with AAC copies for Safari) and are
// decoded once on first use. Music streams from the website the first time a track plays and is
// kept in Cache Storage after that, so the Android download stays small. Nothing sounds until the
// first tap or key press (browser autoplay rules). Settings: on/off, effects and music volume.

import { LOOPS } from "./audio-loops.js";

const KEY = "cardstashy-audio", CACHE = "cardstashy-audio-v2", SITE = "https://cardstashy.com";
// v2 holds the original score; older copies (the placeholder music) are cleared once.
try { globalThis.caches?.keys().then((keys) => keys.filter((k) => k.startsWith("cardstashy-audio-") && k !== CACHE).forEach((k) => caches.delete(k))).catch(() => {}); } catch {}
const DEFAULTS = { on: true, master: 1, sfx: 0.7, music: 0.4, app: true };
// Which cues have a file: prefix → [last number, ...numbers that are music rows instead].
const RANGES = { APP: [20, 2], COL: [10], PACK: [13, 1], QP: [24, 1, 3], TT: [10], CARD: [31], CMB: [21], PW: [38, 1], PWB: [20], AMB: [7], RAV: [6] };
// RAV-001…006: Planeswalk Ravnica drafts (dungeon gate, vault lock, vault reveal, room advance, ante shatter, signature reveal).
const hasCue = (id) => { const m = /^([A-Z]+)-(\d{3})$/.exec(id || ""), r = m && RANGES[m[1]], n = m && +m[2]; return !!r && n >= 1 && n <= r[0] && !r.slice(1).includes(n); };
// Stingers duck the music for a moment so they read over it.
const STINGERS = new Set(["APP-001", "PACK-009", "PACK-013", "QP-006", "QP-007", "QP-016", "QP-017", "QP-018", "QP-019", "TT-001", "TT-002", "PW-003", "PW-004", "PW-009", "PW-010", "PW-011", "PW-014", "PW-029", "PW-030", "PW-031", "PW-036", "PW-037"]);

const native = () => { try { return !!globalThis.Capacitor?.isNativePlatform?.() || /\.invalid$/.test(location.hostname); } catch { return false; } };
const base = new URL("./assets/audio/", import.meta.url);
// The app bundles only the Opus effects; Safari (no Ogg Opus before 18.4) gets the AAC copies.
let ext = (() => { if (native()) return "ogg"; try { return new Audio().canPlayType('audio/ogg; codecs="opus"') ? "ogg" : "m4a"; } catch { return "m4a"; } })();
// Same for the effects: bump SFX_REV whenever they are remade under the same names.
const SFX_REV = "kit3";
const sfxURL = (id) => new URL(`sfx/${id}.${ext}`, base).href + `?v=${SFX_REV}`;
// The music files are cached for a week by browsers and the app's WebView, so a new score needs a new
// address: bump MUSIC_REV whenever the tracks change under the same names.
const MUSIC_REV = "score1";
const musicURL = (id) => (native() ? `${SITE}/assets/audio/music/${id}.${ext}` : new URL(`music/${id}.${ext}`, base).href) + `?v=${MUSIC_REV}`;

export function audioSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULTS }; }
}
export function setAudioSettings(patch) {
  const next = { ...audioSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { return false; }
  apply(); if (next.on) playWanted();
  return true;
}
// A page can add its own off switch on top (Planeswalk's "Sound: on/off").
let extraMute = () => false;
export function setMuteCheck(fn) { extraMute = typeof fn === "function" ? fn : () => false; apply(); playWanted(); }
const silent = () => !audioSettings().on || extraMute();

let ctx = null, master, sfxBus, musicBus, duckBus;
function apply() {
  if (!ctx) return;
  const s = audioSettings(), t = ctx.currentTime, off = silent();
  master.gain.setTargetAtTime(off ? 0 : clamp(s.master), t, 0.03);
  sfxBus.gain.setTargetAtTime(clamp(s.sfx), t, 0.03);
  musicBus.gain.setTargetAtTime(clamp(s.music) * 0.8, t, 0.08);
}
const clamp = (v) => Math.max(0, Math.min(1, Number(v) || 0));
function unlock() {
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      master = ctx.createGain(); sfxBus = ctx.createGain(); musicBus = ctx.createGain(); duckBus = ctx.createGain();
      sfxBus.connect(master); musicBus.connect(duckBus).connect(master); master.connect(ctx.destination);
      apply();
    }
    if (ctx.state !== "running") ctx.resume().then(playWanted, () => {}); else playWanted();
  } catch {}
}
if (typeof document !== "undefined") {
  for (const type of ["pointerdown", "keydown", "touchend"]) addEventListener(type, unlock, { capture: true, passive: true });
  // Nothing plays behind another app or tab. On return, music only comes back if the screen that asked
  // for it is still showing (a match or Planeswalk); anything else is dropped before the sound resumes.
  const away = () => { if (ctx && ctx.state === "running") ctx.suspend().catch(() => {}); };
  const back = () => { if (!ctx || document.hidden) return; prune(); if (!silent()) ctx.resume().then(playWanted, () => {}); };
  document.addEventListener("visibilitychange", () => (document.hidden ? away() : back()));
  // The Android app also reports pause/resume (Capacitor), which can come without a visibility change.
  for (const [type, fn] of [["pause", away], ["resume", back], ["freeze", away], ["pagehide", away], ["pageshow", back]]) { document.addEventListener(type, fn); addEventListener(type, fn); }
}
export const audioReady = () => !!ctx && ctx.state === "running";

// Files: kept in Cache Storage (music always, effects on the web), fetched once otherwise.
async function bytes(url, keep) {
  let store = null;
  if (keep) try { store = await caches.open(CACHE); const hit = await store.match(url); if (hit) return hit.arrayBuffer(); } catch { store = null; }
  const r = await fetch(url, { credentials: "omit" });
  if (!r.ok) throw Error(`audio ${r.status}`);
  if (store) try { await store.put(url, r.clone()); } catch {}
  return r.arrayBuffer();
}
const decode = (buf) => new Promise((ok, no) => { const p = ctx.decodeAudioData(buf, ok, no); if (p?.then) p.then(ok, no); });
async function load(url, keep) {
  try { return await decode(await bytes(url, keep)); }
  catch (e) {
    // A browser that said yes to Opus but cannot decode it switches to the AAC copies.
    if (ext === "ogg" && !native()) { ext = "m4a"; return decode(await bytes(url.replace(/\.ogg(?=\?|$)/, ".m4a"), keep)); }
    throw e;
  }
}

// ---------- effects ----------
const buffers = new Map(), lastAt = new Map();
let voices = 0;
function buffer(id) {
  if (!buffers.has(id)) buffers.set(id, load(sfxURL(id), !native()).catch((e) => { buffers.delete(id); throw e; }));
  return buffers.get(id);
}
// Warms effects that should land on the beat (a pack's flips, the table's hits).
export function preload(ids) { if (ctx) for (const id of ids) if (hasCue(id)) buffer(id).catch(() => {}); }
export function sfx(id, { volume = 1, rate = 1, delay = 0, gap = 45 } = {}) {
  if (!hasCue(id) || !ctx || ctx.state !== "running" || silent()) return;
  const now = performance.now();
  // The same cue twice within a few frames is one sound, and a burst never stacks past a handful.
  if (now - (lastAt.get(id) || 0) < gap || voices >= 8) return;
  lastAt.set(id, now);
  buffer(id).then((buf) => {
    if (silent()) return;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = clamp(volume);
    src.connect(g).connect(sfxBus); voices++;
    src.onended = () => { voices--; g.disconnect(); };
    src.start(ctx.currentTime + Math.max(0, delay) / 1000);
    if (STINGERS.has(id)) duck(buf.duration * 1000);
  }, () => {});
}
// Music steps back under a stinger, then comes back up.
// The main app's few sounds (pack opening, a card added): quiet, paired with a haptic, and with their own switch.
export function appSound(id, { volume = 0.6, rate = 1, delay = 0, gap = 45 } = {}) {
  if (audioSettings().app === false) return;
  sfx(id, { volume, rate, delay, gap });
}
export function duck(ms = 1200, depth = 0.4) {
  if (!ctx) return;
  const t = ctx.currentTime, g = duckBus.gain;
  g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(depth, t + 0.08);
  g.setValueAtTime(depth, t + 0.08 + ms / 1000); g.linearRampToValueAtTime(1, t + 0.7 + ms / 1000);
}

// ---------- music ----------
// Screens ask for music in layers (app → play table → pack, say); the highest layer with a track wins,
// so closing a pack falls back to whatever the screen under it wanted.
const LAYERS = ["app", "play", "pack", "overlay"], wants = {};
let playing = null, pending = "";
// alive(): optional check that the screen asking for this music is still showing; once it says no,
// the layer is cleared (checked every second while music plays, and on returning to the app).
export function setMusic(layer, id, { loop = true, then = "", alive = null } = {}) {
  wants[layer] = id ? { id, loop, then, alive } : null;
  playWanted();
}
function prune() {
  let changed = false;
  for (const l of LAYERS) { const w = wants[l]; try { if (w?.alive && !w.alive()) { wants[l] = null; changed = true; } } catch {} }
  if (changed) playWanted();
}
if (typeof setInterval !== "undefined") setInterval(() => { if (playing || pending) prune(); }, 1000)?.unref?.();
const wanted = () => { for (const l of [...LAYERS].reverse()) if (wants[l]) return wants[l]; return null; };
function playWanted() {
  if (!ctx) return;
  const w = silent() ? null : wanted(), key = w ? `${w.id}|${w.loop}` : "";
  // Stopping works even while the sound is suspended (in the background), so it can't resume later.
  if (!w) {
    if (ctx.state === "running") fadeOut(playing);
    else if (playing) try { playing.src.onended = null; playing.src.stop(); } catch {}
    playing = null; pending = ""; return;
  }
  if (key === (playing?.key || "") || key === pending) return;
  if (ctx.state !== "running") { if (playing) try { playing.src.onended = null; playing.src.stop(); } catch {} playing = null; return; }
  pending = key;
  load(musicURL(w.id), true).then((buf) => {
    if (pending !== key) return; pending = "";
    const src = ctx.createBufferSource(), g = ctx.createGain(), t = ctx.currentTime;
    // Looping tracks carry their loop points (audio-loops.js): the seam sits inside continuous audio,
    // so it is exact whatever padding the encoder added at the file's edges.
    const pts = w.loop && LOOPS[w.id];
    src.buffer = buf; src.loop = w.loop; src.connect(g).connect(musicBus);
    if (pts && pts[1] <= buf.duration) { src.loopStart = pts[0]; src.loopEnd = pts[1]; }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.2);
    fadeOut(playing);
    const me = playing = { key, src, g };
    src.start(t, pts && pts[1] <= buf.duration ? pts[0] : 0);
    // A one-shot (victory, defeat) hands over to its follow-up track when it ends.
    if (!w.loop) src.onended = () => { if (playing !== me) return; playing = null; const layer = LAYERS.find((l) => wants[l] === w); if (layer) wants[layer] = w.then ? { id: w.then, loop: true, then: "" } : null; playWanted(); };
  }, () => { if (pending === key) pending = ""; });
}
function fadeOut(p) {
  if (!p) return;
  const t = ctx.currentTime;
  p.src.onended = null;
  try { p.g.gain.cancelScheduledValues(t); p.g.gain.setValueAtTime(p.g.gain.value, t); p.g.gain.linearRampToValueAtTime(0, t + 0.9); p.src.stop(t + 1); } catch {}
}

// ---------- app interface sounds ----------
// Read from what the app already marks up, so no screen needs its own wiring: data-act buttons,
// tabs, sheets and dialogs opening and closing, switches and sliders.
// Music is only for the play modes (a versus match, Planeswalk). The app's own screens (collection,
// decks, search, menus, packs) stay quiet apart from interface sounds, so leaving a match stops it.
export function viewMusic() { setMusic("app", null); }
export function uiCue(act = "", el = null) {
  if (/^(closeSheet|closeSettings|close[A-Z]\w*|dismiss\w*)$/.test(act)) return "APP-008";
  if (/(^back|Back)$/.test(act)) return "APP-004";
  if (/^(setGame|game|switchGame|selectGame)$/i.test(act) || el?.closest?.(".game-tabs, [data-game-tab]")) return "APP-006";
  if (el?.getAttribute?.("role") === "tab" || el?.dataset?.nav !== undefined || /^go$/.test(act)) return "APP-005";
  if (/^(card|openCard|quickCard)$/.test(act)) return "COL-001";
  if (/(Del|Delete|Remove)$/i.test(act) || /^(del|remove)/i.test(act)) return "COL-006";
  if (/^(add|addToDeck|addCard|quickAdd)/i.test(act)) return "COL-005";
  return "APP-003";
}
let appSounds = false;
export function installAppSounds(root = document) {
  if (appSounds || typeof document === "undefined") return; appSounds = true;
  root.addEventListener("click", (e) => {
    // The match table's own buttons, read by their label so a table redesign keeps them.
    const b = e.target?.closest?.(".play-match-table button");
    if (b && !b.disabled) { const label = (b.textContent || "").trim(), cue = /^(Next|End turn|Pass|Done|OK|Confirm)/i.test(label) ? "TT-004" : /^Keep/i.test(label) ? "QP-013" : /^Mulligan/i.test(label) ? "QP-014" : /^Concede/i.test(label) ? "QP-020" : ""; if (cue) sfx(cue, { volume: 0.6 }); return; }
    const t = e.target?.closest?.("[data-act]"); if (!t || t.disabled || t.closest(".play-match-table, .pack-dialog")) return;
    sfx(uiCue(t.dataset.act, t), { volume: 0.55 });
  }, true);
  root.addEventListener("change", (e) => {
    const t = e.target; if (!(t instanceof HTMLInputElement)) return;
    if (t.type === "checkbox" || t.type === "radio") sfx("APP-009", { volume: 0.5 });
    else if (t.type === "range") sfx("APP-010", { volume: 0.4, gap: 70 });
  }, true);
  root.addEventListener("input", (e) => { if (e.target?.type === "range") sfx("APP-010", { volume: 0.35, gap: 90 }); }, true);
  // Sheets and dialogs: a soft open and close (packs have their own sounds).
  new MutationObserver((list) => {
    for (const m of list) {
      const d = m.target; if (d.tagName !== "DIALOG" || /\bpack\b|pack-/.test(d.className) || d.querySelector?.(".pack-sealed")) continue;
      const open = d.hasAttribute("open"); if (open === (m.oldValue !== null)) continue;
      sfx(open ? "APP-007" : "APP-008", { volume: 0.5 });
    }
  }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"], attributeOldValue: true });
}
// Toasts: a success chime, a low knock for a failure, a light ping otherwise.
export function toastSound(text = "", ok = false) {
  sfx(ok ? "APP-013" : /could not|couldn't|failed|unavailable|error|not allowed|try again/i.test(text) ? "APP-012" : "APP-014", { volume: 0.5, gap: 400 });
}
