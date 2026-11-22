// Lost Memories sound: one module, no dependencies. The page calls window.LMAudio.cue(name, data, ctx) and swallows errors.
// Design rules kept here:
//  - A sound never depends on a card id, so a veiled card cannot be heard for what it is.
//  - Each cue is played when the page calls it; renders and save restores do not call cues, so nothing replays.
//  - Relic chains climb one step per relic at a fixed spacing and close with one resolve, instead of piling up.
//  - Files load on first use (a small core set is warmed after the first tap); one music track is decoded at a time.
//  - Its own settings (master, effects, music, ambience, mute) under its own storage key; nothing else in CardStashy is touched.
//  - Any missing or broken file is skipped silently; the game never waits on audio.
// 1998 studio direction (22 Nov 2026): rooms hum (a bed per room, floors two and three lower and emptier); Life Points count with
// a soft tick per 100; the duel theme's drum stem fades in only when the duel is close; two seconds of near silence come before
// a guardian speaks or the hidden door appears; and a danger tell (stone being scraped smooth) rises with the fog, which the page
// works out from Heat and lost Sparks.
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
  bus.duck = g(bus.master); bus.music.disconnect(); bus.amb.disconnect(); bus.music.connect(bus.duck); bus.amb.connect(bus.duck); // beds pass through one duck for the silences
  bus.tell = g(bus.amb); bus.tell.gain.value = 0;
  apply();
  const a = new Audio(); EXT = a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'; // the batch ships .ogg and .mp3
  return AC;
}
function apply() {
  if (!AC) return; const t = AC.currentTime;
  bus.master.gain.setTargetAtTime(S.muted ? 0 : S.master, t, .03);
  bus.sfx.gain.setTargetAtTime(S.sfx, t, .03); bus.music.gain.setTargetAtTime(S.music, t, .05); bus.amb.gain.setTargetAtTime(S.amb, t, .05);
}
// The list of sounds. A request that fails is not remembered as "no sounds" (reported 21 November 2026: one failed
// request muted the whole session): the next cue asks again, one request at a time and no sooner than four seconds on.
let manTry = 0, manWait = null, manFailed = false;
async function manifest() {
  if (MAN) return MAN;
  if (BASE.protocol === 'file:') return (MAN = {}); // a page opened from a file cannot fetch: stay silent instead of logging an error for every sound
  if (manWait) return manWait;
  if (manTry && performance.now() - manTry < 4000) return {};
  manTry = performance.now();
  manWait = (async () => {
    try {
      const r = await fetch(new URL('manifest.json', BASE)); if (!r.ok) throw new Error('no list of sounds');
      const m = (await r.json()).sounds; if (!m || typeof m !== 'object') throw new Error('no list of sounds');
      MAN = m;
      if (manFailed) setTimeout(() => { for (const k of ['amb', 'music']) if (wanted[k] && !beds[k]) bed(k, wanted[k]); }); // the music and ambience this screen asked for while the list was missing
      return MAN;
    } catch { manFailed = true; return {}; } finally { manWait = null; }
  })();
  return manWait;
}
const _fetchAB = async u => { const r = await fetch(u); if (!r.ok) throw new Error('no such sound file'); return r.arrayBuffer(); }; // a missing file is skipped, not decoded
async function loadAB(id) {
  if (buf.has(id)) return buf.get(id);
  if (loading.has(id)) return loading.get(id);
  const p = (async () => {
    try {
      const m = (await manifest())[id]; if (!m || !ctx()) return null;
      const dec = data => new Promise((ok, no) => { const pr = AC.decodeAudioData(data, ok, no); if (pr && pr.catch) pr.catch(no); }).catch(() => null); // decodeAudioData also returns a promise: left alone, a broken file is an unhandled rejection on the page
      let b = await _fetchAB(new URL(`${m.file}.${EXT}`, BASE)).then(dec).catch(() => null);
      if (!b && EXT !== 'mp3') b = await _fetchAB(new URL(`${m.file}.mp3`, BASE)).then(dec).catch(() => null);   // every sound also ships as .mp3: one bad .ogg (or a filter that blocks it) costs nothing
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
    if (!b || (!o.free && voices >= MAXV)) return;   // free: tiny scheduled ticks that must not use up the voice budget
    const s = AC.createBufferSource(); s.buffer = b; if (o.rate) s.playbackRate.value = o.rate;
    const g = AC.createGain(); g.gain.value = o.gain ?? 1; s.connect(g); g.connect(o.bus || bus.sfx);
    if (!o.free) voices++; s.onended = () => { if (!o.free) voices--; g.disconnect(); };
    s.start(AC.currentTime + (o.delay || 0) / 1000);
  });
}
const pick = (base, n) => { const i = ((rot.get(base) || 0) + 1) % n; rot.set(base, i); return `${base}_${'abcde'[i]}`; };

// ---------- beds: ambience and music, one of each at a time, crossfaded ----------
// A bed may carry a layer that runs in lockstep (the duel theme's drum stem): both start at the same instant with the same loop
// points, and the layer's own gain is turned up only when the duel is close.
const LAYER = { mus_duel: 'mus_duel_drums' };
const beds = { amb: null, music: null, tell: null }, wanted = { amb: null, music: null, tell: null };
function source(id, b, out, at) {
  const m = (MAN || {})[id] || {}; const s = AC.createBufferSource(); s.buffer = b; s.loop = true;
  if (m.loop) { s.loopStart = m.loop[0]; s.loopEnd = Math.min(m.loop[1], b.duration); }
  const g = AC.createGain(); g.gain.value = 0; s.connect(g); g.connect(out); s.start(at, m.loop ? m.loop[0] : 0); return { s, g };
}
async function bed(kind, id, fade = 1.5, level = 1) {
  wanted[kind] = id || null;
  const cur = beds[kind];
  if ((cur && cur.id) === id) { if (cur && cur.g && cur.level !== level) { cur.level = level; cur.g.gain.setTargetAtTime(level, AC.currentTime, fade / 3); } return; }
  if (cur) {
    const parts = [cur, cur.layer].filter(x => x && x.g);
    for (const x of parts) { try { x.g.gain.setTargetAtTime(0, AC.currentTime, fade / 4); } catch { } }
    setTimeout(() => { for (const x of parts) { try { x.s.stop(); x.g.disconnect(); } catch { } } if (kind === 'music') { buf.delete(cur.id); if (cur.layer) buf.delete(cur.layer.id); } }, fade * 1500);
  }
  beds[kind] = id ? { id } : null;
  if (!id || !ctx()) return;
  const lid = kind === 'music' ? LAYER[id] : null;
  const [b, lb] = await Promise.all([loadAB(id), lid ? loadAB(lid) : null]);
  if (!b) { if (beds[kind] && beds[kind].id === id && !beds[kind].s) beds[kind] = null; return; }   // failed load: free the slot so the next visit retries
  if (beds[kind]?.id !== id) return;
  const at = AC.currentTime + .05, main = source(id, b, kind === 'tell' ? bus.tell : bus[kind], at);
  main.g.gain.setTargetAtTime(level, at, fade / 4);
  const it = { id, ...main, level };
  if (lb) { it.layer = { id: lid, ...source(lid, lb, bus.music, at) }; if (st.close) it.layer.g.gain.setTargetAtTime(DRUMS, at, 1); }
  beds[kind] = it;
}
// The close-duel drums. "Close" means someone is within one good hit of losing: 2000 Life Points or less on either side.
const DRUMS = .85;
function closeness(view) {
  const lp = view && view.lp; if (!lp) return;
  const close = Math.min(lp[0], lp[1]) <= 2000 && Math.min(lp[0], lp[1]) > 0;
  if (close === st.close) return; st.close = close;
  const L = beds.music && beds.music.layer; if (L && L.g) L.g.gain.setTargetAtTime(close ? DRUMS : 0, AC.currentTime, close ? 1.2 : 2.5);
}
// Silence as a tool: everything under the effects falls to a whisper, then the moment plays, then the room comes back.
function hush(then, ms = 2000) {
  if (!ctx()) return then();
  const t = AC.currentTime; bus.duck.gain.cancelScheduledValues(t); bus.duck.gain.setTargetAtTime(.04, t, .12);
  setTimeout(() => { then(); const u = AC.currentTime; bus.duck.gain.setTargetAtTime(1, u + 2.5, 1.2); }, ms);
}
// The danger tell: stone being scraped smooth, a record being wiped. It follows the page's fog (Heat and lost Sparks), never static.
function tell(name, d) {
  const runScreen = !['home', 'forger', 'vault', 'codex', 'feats', 'over'].includes(name);
  let k = d && typeof d.fog === 'number' ? d.fog : d && typeof d.floor === 'number' ? d.floor * .25 : 0;
  if (d && typeof d.sparks === 'number' && d.sparksMax) k = Math.max(k, (1 - d.sparks / d.sparksMax) * .8);
  const lvl = runScreen && k > .15 ? Math.min(1, Math.pow((k - .15) / .85, 1.3)) * (name === 'duel' ? .6 : 1) : 0;
  if (lvl > 0) bed('tell', 'tell_erase', 3); if (AC && bus.tell) bus.tell.gain.setTargetAtTime(lvl, AC.currentTime, 2.5);
  if (!lvl && beds.tell) setTimeout(() => { if (bus.tell && bus.tell.gain.value < .01) bed('tell', null, 1); }, 8000);
}

// ---------- state the cues need ----------
const st = { screen: null, lastDoor: null, lowWarned: false, pending: null, lastVerb: null, tier: null, music: {}, close: false, fast: false, floor: 0 };
// Music per screen: filled with draft themes as they are finished (see manifest). Missing ids simply stay silent.
const MUSIC = { chamber: 'mus_explore', reward: 'mus_explore', charm: 'mus_explore', kit: 'mus_explore', duel: 'mus_duel', boss: 'mus_guardian', bazaar: 'mus_quiet', sanctum: 'mus_quiet', home: 'mus_quiet', forger: 'mus_quiet', vault: 'mus_quiet', codex: 'mus_quiet', feats: 'mus_quiet', over: null, anvil: null };
const AMB = { chamber: 'amb_chamber', reward: 'amb_chamber', charm: 'amb_chamber', kit: 'amb_chamber', anvil: 'amb_furnace', bazaar: 'amb_bazaar', duel: null, boss: 'amb_guardian' };
function scene(name, data) {
  st.screen = name; st.tier = data && data.tier; st.floor = data && typeof data.floor === 'number' ? data.floor : st.floor;
  let k = name;
  if (name === 'duel' && (st.tier === 'boss' || st.tier === 'secret')) k = 'boss';
  if (name === 'reward' && (st.lastDoor === 'sanctum')) k = 'sanctum';
  let amb = AMB[k] ?? null;
  if (amb === 'amb_chamber' && st.floor >= 1) amb = st.floor >= 2 ? 'amb_chamber_f3' : 'amb_chamber_f2';   // floors two and three: lower and emptier
  if (name === 'reward' && (st.lastDoor === 'omen' || st.lastDoor === 'mystery')) amb = 'amb_omen';
  if (k === 'sanctum') amb = 'amb_sanctum';
  if (name !== 'duel') { st.close = false; }
  const deep = MUSIC[k] === 'mus_explore' ? [1, .8, .62][Math.min(2, st.floor)] : 1;   // the halls' music thins out as you go down
  bed('amb', amb); bed('music', MUSIC[k] ?? null, 2.5, deep); tell(name, data);
}

// ---------- duel frames: melds and relic chains, sequenced ----------
function frame({ evs = [], fast = false } = {}, view) {
  st.fast = !!fast; closeness(view);
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
      // Life Points count about 1,000 a second with a soft tick each 100 (studio doc); fast mode keeps a short burst.
      closeness(view);
      const n = Math.min(st.fast ? 8 : 40, Math.max(1, Math.round(Math.abs(e.d) / 100))), step = st.fast ? 40 : 100;
      for (let i = 0; i < n; i++) play('lp_tick', { delay: 120 + i * step, gain: (me ? .9 : .55) * (1 - i / (n * 2.5)), rate: 1 + (i % 3) * .015, minGap: 0, free: true });
      if (e.d > 0) return play('lp_gain', { delay: 80 });
      if (Math.abs(e.d) >= 1000) play('lp_loss_large', { delay: 100 });
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
    case 'duelStart': st.lowWarned = false; st.close = false; return play('duel_start');
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
  if (ns === 'duel') return t === 'frame' ? frame(data, el) : duelEv(t, data || {}, el);
  if (ns === 'run') return runEv(t, data || {});
  if (ns === 'ui') { st.lastVerb = t; const u = UI[t]; if (u === null) return; return typeof u === 'function' ? u() : play(u || 'ui_move_a'); }
  if (ns === 'screen') { if (SCREEN_ONCE[t]) play(SCREEN_ONCE[t]); return scene(t, data); }
  if (ns === 'story') {
    if (t.startsWith('boss:') && BOSS[t.slice(5)]) return hush(() => play('boss_' + t.slice(5), { minGap: 0 }));   // two seconds of near silence first
    if (t === 'secret:door') return hush(() => play('door_omen', { minGap: 0 }));                                  // the hidden door appears out of silence
    if (t.startsWith('memory:')) return play('unlock_big', { delay: 300 });                                         // a guardian's memory: the motif returns
    if (t === 'intro') return play('chamber_enter');
    if (t === 'cleared' || t === 'secret:won') return play('guardian_reward');
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
const CORE = ['ui_move_a', 'ui_move_b', 'ui_confirm', 'ui_back', 'card_select_a', 'card_select_b', 'card_select_c', 'card_draw_a', 'card_draw_b', 'card_draw_c', 'card_place_a', 'card_set', 'attack_start', 'attack_hit_a', 'attack_hit_b', 'lp_tick', 'lp_loss_small', 'relic_trigger_1', 'relic_trigger_2', 'relic_trigger_3', 'door_open', 'monster_appear'];
let warmed = false;
function unlock() {
  if (!ctx()) return;
  if (AC.state !== 'running' && !S.muted && !document.hidden) AC.resume().catch(() => { });
  if (!warmed) manifest().then(() => { if (MAN && !warmed) { warmed = true; CORE.forEach((id, i) => setTimeout(() => loadAB(id), i * 30)); } }); // warmed only once the list of sounds has loaded
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
  get ready() { return !!MAN; }, // the list of sounds has loaded (for checks)
  set(k, v) { if (k in DEF) { S[k] = v; save(); apply(); } },
  get beds() {
    const mu = beds.music && beds.music.s ? beds.music : null, ly = mu && mu.layer;
    return { amb: beds.amb && beds.amb.s ? beds.amb.id : null, music: mu ? mu.id : null, loop: mu ? [mu.s.loopStart, mu.s.loopEnd] : null, state: AC && AC.state,
      drums: ly ? +ly.g.gain.value.toFixed(2) : null, close: st.close, tell: beds.tell && beds.tell.s && bus.tell ? +bus.tell.gain.value.toFixed(2) : 0, duck: bus.duck ? +bus.duck.gain.value.toFixed(2) : null };
  },
  stopBeds() { bed('amb', null); bed('music', null); bed('tell', null); },
};
window.LMAudio = api;
export default api;
