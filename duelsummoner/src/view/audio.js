// The sound engine (the 28 Nov pack: assets/sound/sound-1127/, kept out of git like the models). Web Audio, view only.
// Buses as in the pack's wiring.md and mix.json: music, sfx (with a compressor), pickup, ui, ambience and riding, each under the master; Settings > Sound sliders set them.
// Every cue follows mix.json (its bus, priority, voice cap and minimum gap); repeats drift +-6% in pitch; a danger cue ducks the music 4 dB. Buffers load on first use, so a cue the
// game never plays costs nothing. Music: the map's bed for the time of day, layers A to E started together on one clock, faded in by tier. Without the pack every call is silent.
const BASE = 'assets/sound/sound-1127/';
const BUSES = ['music', 'sfx', 'pickup', 'ui', 'ambience', 'riding'];
const SLIDER = { music: 'volMusic', sfx: 'volBattle', pickup: 'volRewards', ui: 'volInterface', ambience: 'volWorld', riding: 'volBattle' };
const db = d => Math.pow(10, d / 20);
export const audio = { ok: false, ctx: null, bus: {}, takes: new Map(), cues: {}, bufs: new Map(), loading: new Map(), voices: [], last: new Map(), music: null, amb: null, carve: null, beats: {}, vol: {}, playing: 0, costMs: 0 };
let unlocked = false;
// call once at start; it waits for the first press or tap (browsers keep sound off until then)
export async function initAudio(settings) {
  try {
    const [man, mix, beats] = await Promise.all(['manifest.json', 'mix.json', 'beats.json'].map(f => fetch(BASE + f, { cache: 'no-store' }).then(r => (r.ok ? r.json() : null))));
    if (!man) return false;
    for (const e of man) { const L = audio.takes.get(e.code) || []; L.push(e.file); audio.takes.set(e.code, L); }
    audio.cues = (mix && mix.cues) || {}; audio.mix = mix || {}; audio.beats = beats || {}; audio.ok = true;
  } catch (e) { return false; }
  const go = () => { if (unlocked) return; unlocked = true; build(settings); window.removeEventListener('keydown', go); window.removeEventListener('pointerdown', go); };
  window.addEventListener('keydown', go); window.addEventListener('pointerdown', go);
  return true;
}
function build(settings) {
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; const ctx = audio.ctx = new AC();
  const master = audio.bus.master = ctx.createGain(); master.connect(ctx.destination);
  for (const b of BUSES) { const g = ctx.createGain(); audio.bus[b] = g; if (b === 'sfx') { const c = ctx.createDynamicsCompressor(); c.threshold.value = -14; c.ratio.value = 3; c.attack.value = 0.005; c.release.value = 0.12; g.connect(c); c.connect(master); } else g.connect(master); }
  audio.bus.ambience.gain.value = db(-3); audio.duck = ctx.createGain(); audio.bus.music.disconnect(); audio.bus.music.connect(audio.duck); audio.duck.connect(master);
  setVolumes(settings || {});
}
// Settings > Sound: 0..100 each
export function setVolumes(s) { if (!audio.ctx) { audio.vol = s; return; } const v = (k, d) => (s[k] === undefined ? d : s[k]) / 100; audio.bus.master.gain.value = v('volMaster', 80) * 0.85;
  for (const b of BUSES) audio.bus[b].gain.value = v(SLIDER[b], 70) * (b === 'ambience' ? db(-3) : 1); }
function load(file) {
  if (audio.bufs.has(file)) return Promise.resolve(audio.bufs.get(file)); if (audio.loading.has(file)) return audio.loading.get(file);
  const wav = /^(RC_|RS_)/.test(file), url = BASE + (wav ? 'loops-wav/' + file + '.wav' : 'ogg/' + file + '.ogg');
  const pr = fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).then(ab => audio.ctx.decodeAudioData(ab)).then(b => { audio.bufs.set(file, b); return b; }).catch(() => { audio.bufs.set(file, null); return null; });
  audio.loading.set(file, pr); return pr;
}
// warm a list of codes (all their takes) so the first play is on time
export function preload(codes) { if (!audio.ctx) return; for (const c of codes) for (const f of audio.takes.get(c) || []) load(f); }
// play a cue by code. o: { gain (dB), rate, take (1-based), pan } . Returns false when it was capped or not loaded yet (it loads for next time).
export function play(code, o) {
  if (!audio.ctx || !audio.ok) return false; const t0 = performance.now(); o = o || {};
  const L = audio.takes.get(code); if (!L || !L.length) return false;
  const file = o.take ? L[Math.min(L.length, o.take) - 1] : L[Math.floor(Math.random() * L.length)], cue = audio.cues[file] || {}, now = audio.ctx.currentTime;
  const last = audio.last.get(code) || -1e9; if ((now - last) * 1000 < (cue.minGapMs || 0)) return false;
  audio.voices = audio.voices.filter(v => v.end > now); const same = audio.voices.filter(v => v.code === code).length; if (same >= (cue.voiceCap || 4)) return false;
  if (audio.voices.length >= 24) { const low = audio.voices.reduce((a, v) => (!a || v.pri < a.pri ? v : a), null); if (low && low.pri < (cue.priority || 40)) { try { low.src.stop(); } catch (e) { /* already stopped */ } audio.voices.splice(audio.voices.indexOf(low), 1); } else return false; }
  const buf = audio.bufs.get(file); if (!buf) { load(file); return false; }
  const src = audio.ctx.createBufferSource(), g = audio.ctx.createGain(); src.buffer = buf; src.playbackRate.value = (o.rate || 1) * (o.rate ? 1 : 1 + (Math.random() - 0.5) * 0.12); g.gain.value = db(o.gain || 0);
  src.connect(g); g.connect(audio.bus[o.bus || cue.bus || 'sfx'] || audio.bus.sfx); src.start(); audio.last.set(code, now);
  audio.voices.push({ code, src, end: now + buf.duration / src.playbackRate.value, pri: cue.priority || 40 });
  if (cue.danger || o.danger) duck(4, 0.04, 0.6);
  audio.costMs += performance.now() - t0; return true;
}
function duck(dB, a, r) { const g = audio.duck.gain, n = audio.ctx.currentTime; g.cancelScheduledValues(n); g.setTargetAtTime(db(-dB), n, a / 3); g.setTargetAtTime(1, n + 0.3, r / 3); }
// a looped bed: layers started together on one clock. code: e.g. 'MU03', time: 'morning'; layers fade by tier (A always, B tier 1, C tier 2, D danger or boss, E climax)
export async function setMusic(code, time) {
  if (!audio.ctx) return; const key = code + '_' + time; if (audio.music && audio.music.key === key) return; stopMusic();
  const M = audio.music = { key, layers: {} }, files = ['A', 'B', 'C', 'D', 'E'].map(l => key + '_' + l), bufs = await Promise.all(files.map(f => load(f)));
  if (audio.music !== M) return; const at = audio.ctx.currentTime + 0.1; M.t0 = at;
  files.forEach((f, i) => { const b = bufs[i]; if (!b) return; const s = audio.ctx.createBufferSource(), g = audio.ctx.createGain(); s.buffer = b; s.loop = true; g.gain.value = i === 0 ? 1 : 0; s.connect(g); g.connect(audio.bus.music); s.start(at); M.layers['ABCDE'[i]] = { s, g }; });
}
// the beat clock of the playing bed (beats.json: bpm and first downbeat), for everything that moves with the music; with no music yet it runs at 100 bpm so the look never freezes.
// ph: 0..1 through the beat, pulse: 1 on the beat falling to 0, bar: which beat of four
export function beat() { const M = audio.music; let t = performance.now() / 1000, bpm = 100; if (M && audio.ctx && M.t0 !== undefined) { const B = audio.beats[M.key + '_A'] || audio.beats[M.key]; bpm = (B && B.bpm) || 100; t = audio.ctx.currentTime - M.t0 - ((B && B.firstDownbeat) || 0); } if (bpm < 80) bpm *= 2; const b = t * bpm / 60, ph = ((b % 1) + 1) % 1; return { ph, pulse: Math.exp(-ph * 4.5), bar: ((Math.floor(b) % 4) + 4) % 4, bpm }; }
export function stopMusic() { const M = audio.music; if (!M) return; for (const k in M.layers) { try { M.layers[k].s.stop(); } catch (e) { /* stopped */ } } audio.music = null; }
export function musicTier(t, danger) { const M = audio.music; if (!M || !audio.ctx) return; const n = audio.ctx.currentTime; const want = { A: 1, B: t >= 1 ? 1 : 0, C: t >= 2 ? 1 : 0, D: danger ? 1 : 0, E: t >= 4 ? 1 : 0 }; for (const k in M.layers) M.layers[k].g.gain.setTargetAtTime(want[k], n, 0.8); }
export async function setAmbience(code) { if (!audio.ctx) return; if (audio.amb && audio.amb.code === code) return; if (audio.amb) { try { audio.amb.s.stop(); } catch (e) { /* stopped */ } } const b = await load(code); if (!b) return; const s = audio.ctx.createBufferSource(); s.buffer = b; s.loop = true; s.connect(audio.bus.ambience); s.start(); audio.amb = { code, s }; }
// the card's carve hiss: three speed loops of the surface played together, gains by speed s (0..1) as in wiring.md; spray on a hard carve; a launch fades it all
export async function carve(surface, s, spray, air) {
  if (!audio.ctx) return; const C = audio.carve || (audio.carve = { surface: null, nodes: null, pending: false });
  if (C.surface !== surface && !C.pending) { C.pending = true; const S = surface.toUpperCase(), files = ['RC_' + S + '_S', 'RC_' + S + '_M', 'RC_' + S + '_F', 'RS_' + S], bufs = await Promise.all(files.map(load)); if (C.nodes) for (const n of C.nodes) { try { n.s.stop(); } catch (e) { /* stopped */ } }
    C.nodes = bufs.map(b => { if (!b) return null; const src = audio.ctx.createBufferSource(), g = audio.ctx.createGain(); src.buffer = b; src.loop = true; g.gain.value = 0; src.connect(g); g.connect(audio.bus.riding); src.start(); return { s: src, g }; }); C.surface = surface; C.pending = false; }
  if (!C.nodes) return; const n = audio.ctx.currentTime, k = air ? 0.03 : 0.15 + 0.85 * Math.pow(s, 1.5), gS = Math.max(0, Math.min(1, 1 - 2 * s)), gM = 1 - Math.abs(2 * s - 1), gF = Math.max(0, Math.min(1, 2 * s - 1)), rate = 0.9 + 0.25 * s, tc = air ? 0.03 : 0.05;
  [gS, gM, gF].forEach((v, i) => { const N = C.nodes[i]; if (!N) return; N.g.gain.setTargetAtTime(v * k * 0.6, n, tc); N.s.playbackRate.setTargetAtTime(rate, n, 0.1); });
  if (C.nodes[3]) C.nodes[3].g.gain.setTargetAtTime(air ? 0 : spray * 0.8 * 0.6, n, 0.05);
}
export function stopCarve() { const C = audio.carve; if (!C || !C.nodes || !audio.ctx) return; for (const N of C.nodes) if (N) N.g.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.1); }
