// Lost Memories sound: one module, no dependencies. The page calls window.LMAudio.cue(name, data, ctx) and swallows errors.
// Design rules kept here:
//  - A sound never depends on a card id, so a veiled card cannot be heard for what it is.
//  - Each cue is played when the page calls it; renders and save restores do not call cues, so nothing replays.
//  - Relic chains climb one step per relic at a fixed spacing and close with one resolve, instead of piling up.
//  - Files load on first use (a small core set is warmed after the first tap); one music track is decoded at a time.
//  - Its own settings (master, effects, music, ambience, mute) under its own storage key; nothing else in CardStashy is touched.
//  - Any missing or broken file is skipped silently; the game never waits on audio.
const KEY = 'lm-audio-v1';
const BASE = new URL('audio/', document.baseURI); // the page is one bundled script, so import.meta.url is not there to use
const DEF = { master: 0.8, sfx: 0.9, music: 0.55, amb: 0.5, muted: false };
let S = { ...DEF };
try { S = { ...DEF, ...(JSON.parse(localStorage.getItem(KEY)) || {}) }; } catch { }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { } };

let AC = null, bus = {}, MAN = null, EXT = 'mp3';
const buf = new Map(), loading = new Map(), last = new Map(), rot = new Map();
let voices = 0; const MAXV = 14;
const log = [];   // last cues and what they played, for checks: LMAudio.log

function ctx() {
  if (AC) return AC;
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
  AC = new C({ latencyHint: 'interactive' });
  const g = n => { const x = AC.createGain(); x.connect(n); return x; };
  const comp = AC.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .15; comp.connect(AC.destination);
  bus.master = g(comp); bus.sfx = g(bus.master); bus.music = g(bus.master); bus.amb = g(bus.master);
  apply();
  const a = new Audio(); EXT = a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'; // the batch ships .ogg and .mp3
  return AC;
}
function apply() {
  if (!AC) return; const t = AC.currentTime;
  bus.master.gain.setTargetAtTime(S.muted ? 0 : S.master, t, .03);
  bus.sfx.gain.setTargetAtTime(S.sfx, t, .03); bus.music.gain.setTargetAtTime(S.music, t, .05); bus.amb.gain.setTargetAtTime(S.amb, t, .05);
}
async function manifest() {
  if (MAN) return MAN;
  if (BASE.protocol === 'file:') return (MAN = {}); // a page opened from a file cannot fetch: stay silent instead of logging an error for every sound
  try { MAN = (await (await fetch(new URL('manifest.json', BASE))).json()).sounds; } catch { MAN = {}; }
  return MAN;
}
const _fetchAB = async u => { const r = await fetch(u); if (!r.ok) throw new Error('no such sound file'); return r.arrayBuffer(); }; // a missing file is skipped, not decoded
async function loadAB(id) {
  if (buf.has(id)) return buf.get(id);
  if (loading.has(id)) return loading.get(id);
  const p = (async () => {
    try {
      const m = (await manifest())[id]; if (!m || !ctx()) return null;
      const data = await _fetchAB(new URL(`${m.file}.${EXT}`, BASE));
      const b = await new Promise((ok, no) => { const pr = AC.decodeAudioData(data, ok, no); if (pr && pr.catch) pr.catch(no); }).catch(() => null); // decodeAudioData also returns a promise: left alone, a broken file is an unhandled rejection on the page
      if (b) buf.set(id, b); return b;
    } catch { return null; } finally { loading.delete(id); }
  })();
  loading.set(id, p); return p;
}

// play(id, {gain, delay, rate, minGap}): fire and forget
function play(id, o = {}) {
  if (!id || S.muted || !ctx()) return;
  const now = performance.now(), gap = o.minGap ?? 45;
  if (now - (last.get(id) || 0) < gap) return; last.set(id, now);
  log.push({ t: Math.round(now), id }); if (log.length > 200) log.shift();
  loadAB(id).then(b => {
    if (!b || voices >= MAXV) return;
    const s = AC.createBufferSource(); s.buffer = b; if (o.rate) s.playbackRate.value = o.rate;
    const g = AC.createGain(); g.gain.value = o.gain ?? 1; s.connect(g); g.connect(o.bus || bus.sfx);
    voices++; s.onended = () => { voices--; g.disconnect(); };
    s.start(AC.currentTime + (o.delay || 0) / 1000);
  });
}
const pick = (base, n) => { const i = ((rot.get(base) || 0) + 1) % n; rot.set(base, i); return `${base}_${'abcde'[i]}`; };

// ---------- beds: ambience and music, one of each at a time, crossfaded ----------
const beds = { amb: null, music: null };
async function bed(kind, id, fade = 1.5) {
  const cur = beds[kind];
  if ((cur && cur.id) === id) return;
  if (cur) { const g = cur.g; try { g.gain.setTargetAtTime(0, AC.currentTime, fade / 4); setTimeout(() => { try { cur.s.stop(); g.disconnect(); } catch { } if (kind === 'music') buf.delete(cur.id); }, fade * 1500); } catch { } }
  beds[kind] = id ? { id } : null;
  if (!id || !ctx()) return;
  const b = await loadAB(id);
  if (!b) { if (beds[kind] && beds[kind].id === id && !beds[kind].s) beds[kind] = null; return; }   // failed load: free the slot so the next visit retries
  if (beds[kind]?.id !== id) return;
  const m = MAN[id] || {}; const s = AC.createBufferSource(); s.buffer = b; s.loop = true;
  if (m.loop) { s.loopStart = m.loop[0]; s.loopEnd = Math.min(m.loop[1], b.duration); }
  const g = AC.createGain(); g.gain.value = 0; s.connect(g); g.connect(bus[kind]); s.start();
  g.gain.setTargetAtTime(1, AC.currentTime, fade / 4);
  beds[kind] = { id, s, g };
}

// ---------- state the cues need ----------
const st = { screen: null, lastDoor: null, lowWarned: false, pending: null, lastVerb: null, tier: null, music: {} };
// Music per screen: filled with draft themes as they are finished (see manifest). Missing ids simply stay silent.
const MUSIC = { chamber: 'mus_explore', reward: 'mus_explore', charm: 'mus_explore', kit: 'mus_explore', duel: 'mus_duel', boss: 'mus_guardian', bazaar: 'mus_quiet', sanctum: 'mus_quiet', home: 'mus_quiet', forger: 'mus_quiet', vault: 'mus_quiet', codex: 'mus_quiet', feats: 'mus_quiet', over: null, anvil: null };
const AMB = { chamber: 'amb_chamber', reward: 'amb_chamber', charm: 'amb_chamber', kit: 'amb_chamber', anvil: 'amb_furnace', bazaar: 'amb_bazaar', duel: null, boss: 'amb_guardian' };
function scene(name, data) {
  st.screen = name; st.tier = data && data.tier;
  let k = name;
  if (name === 'duel' && st.tier === 'boss') k = 'boss';
  if (name === 'reward' && (st.lastDoor === 'sanctum')) k = 'sanctum';
  let amb = AMB[k] ?? null;
  if (name === 'reward' && (st.lastDoor === 'omen' || st.lastDoor === 'mystery')) amb = 'amb_omen';
  if (k === 'sanctum') amb = 'amb_sanctum';
  bed('amb', amb); bed('music', MUSIC[k] ?? null, 2.5);
}

// ---------- duel frames: melds and relic chains, sequenced ----------
function frame({ evs = [], fast = false } = {}) {
  const melds = evs.filter(e => e.e === 'meld' && (e.kind === 'printed' || e.kind === 'cross'));
  if (melds.length) {
    const big = melds.some(e => e.three) || melds.length >= 3;
    play(big ? 'meld_power' : melds.length === 1 ? 'meld_success_2' : melds.length === 2 ? 'meld_success_3' : 'meld_success_4');
  }
  const relics = evs.filter(e => e.e === 'relic');
  if (relics.length) {
    const step = fast ? 70 : 170, cap = fast ? 3 : 6;
    relics.slice(0, cap).forEach((e, i) => {
      const id = e.id === 'second_wind' ? 'second_wind' : `relic_trigger_${Math.min(i + 1, 5)}`;
      play(id, { delay: i * step, gain: e.seat === 0 ? 1 : .6, minGap: 0 });
    });
    if (relics.length >= 3) play('relic_chain_end', { delay: Math.min(relics.length, cap) * step + 60, minGap: 0 });
  }
}
const FORGER = { tarn: 'power_stoke', scrapper: 'power_salvage', veil: 'power_shroud', storm: 'power_landfall' };
function duelEv(t, e, view) {
  const me = e.seat === 0;
  switch (t) {
    case 'turn': return play(me ? 'turn_player' : 'turn_rival');
    case 'draw': if (me) { play(pick('card_draw', 3)); if (e.n > 1) play(pick('card_draw', 3), { delay: 90, minGap: 0 }); } return;
    case 'summon': return play(e.veiled || (!me && !e.id) ? 'card_set' : e.melded ? 'monster_appear_meld' : 'monster_appear');
    case 'set': return play('card_set');
    case 'reveal': return play('card_reveal');
    case 'attack': return play('attack_start');
    case 'battle': {
      if (e.direct) return play('attack_direct');
      const diff = (e.a ?? 0) - (e.d ?? 0);
      if (diff <= 0) return play('defend_block');
      return play(diff < 500 ? 'attack_hit_a' : diff < 1500 ? 'attack_hit_b' : 'attack_hit_c');
    }
    case 'destroyed': return play(pick('monster_destroyed', 2), { delay: 120 });
    case 'bounce': return play('monster_bounce');
    case 'lp': {
      if (e.d > 0) return play('lp_gain', { delay: 80 });
      play(Math.abs(e.d) >= 1000 ? 'lp_loss_large' : 'lp_loss_small', { delay: 160 });
      const lp = view && view.lp ? view.lp[0] : null;
      if (me && lp != null && lp > 0 && lp <= 1500 && !st.lowWarned) { st.lowWarned = true; play('lp_low_warning', { delay: 700 }); }
      return;
    }
    case 'meld':
      if (e.kind === 'fizzle') return play('meld_fizzle');
      if (e.kind === 'fuel') return play('meld_fuel');
      if (e.kind === 'steady') return play('meld_steady');
      if (e.kind === 'equip') return play('equip_attach');
      return;   // printed / cross: the frame plays one success sized to the whole meld
    case 'spell': return play('spell_cast');
    case 'trap': return play('trap_spring');
    case 'terrain': return play('field_play');
    case 'equip': return play('equip_attach');
    case 'enchant': return play('enchant_trigger');
    case 'relic': return;   // sequenced by the frame
    case 'power': return play(FORGER[e.forger] || 'ui_confirm');
    case 'freeze': return play('freeze');
    case 'revive': return play('monster_revive');
    case 'stat': return play(e.a >= 0 ? 'stat_up' : 'stat_down');
    case 'free': return play('free_cast');
    case 'solo': return play('solo_bonus');
    case 'cap': return play('relic_cap');
    case 'return': return play('graveyard_return');
    case 'discard': return play('card_set', { gain: .7 });
    case 'pos': return play('card_flip');
    case 'end': if (e.reason === 'deckout') play('deck_out'); return;   // run:duelWon / run:duelLost carry the result
  }
}
function runEv(t, e = {}) {
  switch (t) {
    case 'door': {
      st.lastDoor = e.type; play('door_open');
      const acc = { duel: 'door_duel', cursed: 'door_cursed', champion: 'door_champion', guardian: 'door_guardian', anvil: 'door_anvil', bazaar: 'door_bazaar', sanctum: 'door_sanctum', omen: 'door_omen', mystery: 'door_omen', treasure: 'door_treasure', boss: 'door_boss' }[e.type];
      if (acc) play(acc, { delay: 250 }); play('chamber_enter', { delay: 1300 }); return;
    }
    case 'duelStart': st.lowWarned = false; return play('duel_start');
    case 'duelWon': bed('music', null, 1); play('duel_win'); if (e.embers) play('embers_gain', { delay: 1600 }); return;
    case 'duelLost': bed('music', null, 1); play('duel_lose'); play('spark_lost', { delay: 1900 }); return;
    case 'mystery': return play('mystery_event');
    case 'over': bed('music', null, 2); if (e.reason === 'abandoned') return play('ui_close'); return play('run_summary', { delay: 400 });
  }
}
const UI = {
  pick: () => play(st.screen === 'charm' ? 'charm_gain' : st.screen === 'reward' ? 'gift_choose' : 'ui_confirm'),
  skip: 'ui_back', reroll: 'card_shuffle', kit: 'ui_kit_select', redeal: 'card_shuffle', end: 'ui_move_a',
  hand: () => play(pick('card_select', 3)), deckpick: () => play(pick('card_select', 3)), trunkpick: () => play(pick('card_select', 3)), anvilpick: () => play(pick('card_select', 3)),
  buy: () => later('purchase'), vbuy: () => later('purchase'),
  temper: () => later('anvil_temper'), enchant: () => later('anvil_enchant'), bind: () => later('anvil_bind'), mw: () => later('anvil_masterwork'),
  tab: 'ui_panel_open', inspect: 'ui_move_b', inspectz: 'ui_move_b', closeov: 'ui_close', closeinspect: 'ui_close', cxclose: 'ui_close', cxopen: 'ui_panel_open',
  storynext: 'ui_move_a', storyskip: 'ui_back', descend: 'ui_confirm', resume: 'ui_confirm', new: 'ui_confirm', abandon: 'ui_back', quit: 'ui_back', home: 'ui_back',
  forger: 'ui_forger_select', heat: 'ui_move_b', lab: 'ui_move_a', speed: 'ui_move_a', undo: 'card_deselect', aim: 'ui_move_b', screen: 'ui_panel_open',
  // these already make their own sound through duel or run events
  door: null, play: null, hit: null, pos: null, power: null, respond: null, leave: 'ui_confirm',
};
// Shop and Anvil actions wait a moment: if the page refuses the action, the refusal sound plays instead.
function later(id) { clearTimeout(st.pending); st.pending = setTimeout(() => { st.pending = null; play(id); }, 60); }
const SCREEN_ONCE = { codex: 'ui_codex_open', vault: 'ui_relics_open', feats: 'ui_panel_open', anvil: null, bazaar: null };
const BOSS = { kiln_warden: 1, stone_sentinel: 1, bone_collector: 1, veiled_magus: 1, white_tyrant: 1, last_gate: 1 };

function cue(name, data, el) {
  if (typeof name !== 'string') return;
  const i = name.indexOf(':'); const ns = i < 0 ? name : name.slice(0, i), t = i < 0 ? '' : name.slice(i + 1);
  if (ns === 'duel') return t === 'frame' ? frame(data) : duelEv(t, data || {}, el);
  if (ns === 'run') return runEv(t, data || {});
  if (ns === 'ui') { st.lastVerb = t; const u = UI[t]; if (u === null) return; return typeof u === 'function' ? u() : play(u || 'ui_move_a'); }
  if (ns === 'screen') { if (SCREEN_ONCE[t]) play(SCREEN_ONCE[t]); return scene(t, data); }
  if (ns === 'story') {
    if (t.startsWith('boss:') && BOSS[t.slice(5)]) return play('boss_' + t.slice(5));
    if (t === 'intro') return play('chamber_enter');
    if (t === 'cleared') return play('guardian_reward');
    return;
  }
  if (name === 'codex:new') return play('codex_discover', { delay: 500, minGap: 800 });
  if (name === 'unlock') return play(data && data.big ? 'unlock_big' : 'ui_unlock', { delay: 900 });
  if (name === 'toast') return play('ui_toast', { minGap: 400 });
  if (name === 'refused') {
    if (st.pending) { clearTimeout(st.pending); st.pending = null; }
    return play(st.lastVerb === 'buy' || st.lastVerb === 'vbuy' ? 'insufficient_funds' : 'ui_invalid');
  }
}

// ---------- unlock, background and interruption ----------
const CORE = ['ui_move_a', 'ui_move_b', 'ui_confirm', 'ui_back', 'card_select_a', 'card_select_b', 'card_select_c', 'card_draw_a', 'card_draw_b', 'card_draw_c', 'card_place_a', 'card_set', 'attack_start', 'attack_hit_a', 'attack_hit_b', 'lp_loss_small', 'relic_trigger_1', 'relic_trigger_2', 'relic_trigger_3', 'door_open', 'monster_appear'];
let warmed = false;
function unlock() {
  if (!ctx()) return;
  if (AC.state !== 'running' && !S.muted && !document.hidden) AC.resume().catch(() => { });
  if (!warmed) { warmed = true; manifest().then(() => CORE.forEach((id, i) => setTimeout(() => loadAB(id), i * 30))); }
}
addEventListener('pointerdown', unlock, { capture: true, passive: true });
addEventListener('keydown', unlock, { capture: true });
document.addEventListener('visibilitychange', () => {
  if (!AC) return;
  if (document.hidden) AC.suspend().catch(() => { });
  else if (!S.muted) AC.resume().catch(() => { });   // iOS may still say "interrupted"; the next tap resumes it
});

// ---------- settings panel (the page mounts it wherever it likes) ----------
function panel() {
  const d = document.createElement('div'); d.className = 'lm-audio-panel';
  const row = (k, label) => `<label style="display:flex;gap:.6em;align-items:center;justify-content:space-between">${label}<input type="range" min="0" max="1" step="0.05" value="${S[k]}" data-k="${k}" style="width:55%"></label>`;
  d.innerHTML = `<label style="display:flex;gap:.6em;align-items:center"><input type="checkbox" data-k="muted" ${S.muted ? 'checked' : ''}> Mute all sound</label>${row('master', 'Master')}${row('sfx', 'Effects')}${row('music', 'Music')}${row('amb', 'Ambience')}`;
  d.addEventListener('input', ev => {
    const x = ev.target, k = x.dataset.k; if (!k) return;
    S[k] = k === 'muted' ? x.checked : +x.value; save(); unlock(); apply();
    if (k === 'muted' && AC) S.muted ? AC.suspend().catch(() => { }) : AC.resume().catch(() => { });
    if (k === 'sfx') play('ui_move_a', { minGap: 120 });
  });
  return d;
}
const api = {
  cue: (n, d, c) => { try { cue(n, d, c); } catch (e) { /* audio must never break the game */ } },
  panel, play: id => play(id, { minGap: 0 }), log,
  get settings() { return { ...S }; },
  set(k, v) { if (k in DEF) { S[k] = v; save(); apply(); } },
  get beds() { return { amb: beds.amb && beds.amb.s ? beds.amb.id : null, music: beds.music && beds.music.s ? beds.music.id : null, loop: beds.music && beds.music.s ? [beds.music.s.loopStart, beds.music.s.loopEnd] : null, state: AC && AC.state }; },
  stopBeds() { bed('amb', null); bed('music', null); },
};
window.LMAudio = api;
export default api;
