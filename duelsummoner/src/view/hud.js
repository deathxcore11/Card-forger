// The plain placeholder HUD (the real look is awaiting approval). Text and bar widths only change when values change.
import { RAMP } from '../data/fxramp.js';
import { keyWords } from '../ui/prompts.js';
export const inputMode = () => document.body.classList.contains('touch') ? 'touch' : document.body.dataset.input === 'pad' ? 'pad' : 'keys';
import { CFG } from '../data/config.js';
import { clock } from '../core/util.js';
import { MONSTERS, FUSIONS, SPELLS, TRAPS, FIELD_RULES, LEVELS, formOf } from '../data/cards.js';
import { fusionsReady } from '../sim/field.js';
import { chestPrice } from '../sim/world.js';
import { STAT_INFO, STAT_GROUPS, fmtStat } from '../data/stats.js';
import { mightBracket, targetBracket, critMul } from '../sim/ledger.js';
import { K } from '../data/tuning.js';
import { ITEMS, BLESSINGS } from '../data/items.js';

const $ = id => document.getElementById(id);
let key = '', bannerT = 0, zonesBuilt = false, slowT = -1, nextTxt = '';
const zM = [], zL = [], sM = [], sL = [], sR = [];

function buildZones() {
  const z = $('zones'); z.innerHTML = '';
  for (let i = 0; i < FIELD_RULES.monsterZones; i++) z.insertAdjacentHTML('beforeend', '<div class="zone" id="mz' + i + '"></div>');
  for (let i = 0; i < FIELD_RULES.spellTrapZones; i++) z.insertAdjacentHTML('beforeend', '<div class="zone st" id="sz' + i + '"></div>');
  zonesBuilt = true;
}
const EL_COL = { fire: '#' + RAMP.fire[1].toString(16), lightning: '#' + RAMP.lightning[1].toString(16) }, ROMAN = ['I', 'II', 'III'];
const pips = (n, max) => '<i class="pips">' + Array.from({ length: max }, (_, k) => '<u' + (k < n ? ' class="on"' : '') + '></u>').join('') + '</i>';
const stars = (n, max) => '*'.repeat(n) + '.'.repeat(Math.max(0, max - n));

function runClock(g) {
  if (g.opts && g.opts.gym) return 'RIDE GYM';       // the gym has no clock
  if (g.duelOn) return 'DUEL ON +' + clock(g.otT);
  return (g.stages.length > 1 ? 'STAGE ' + (g.stage + 1) + '  ' : '') + clock(Math.max(0, g.stageSpec.clock - g.sc));
}
let stripKey = '', frenzyTxt = '';
// the Coin Rite: a coin glyph and its countdown on the event strip while it lasts (no screen tint, no big counter)
function drawFrenzy(g) {
  let el = $('frenzyChip'); if (!el) { el = document.createElement('div'); el.id = 'frenzyChip'; $('strip').after(el); }
  const txt = g.frenzyT > 0 ? '\u25CF COIN RITE ' + clock(Math.ceil(g.frenzyT)) : ''; if (txt === frenzyTxt) return; frenzyTxt = txt; el.textContent = txt; el.style.display = txt ? 'block' : 'none';
}
const ROLE_LETTER = { elite: 'ELITE', bossA: 'BOSS', bossB: 'TWINS' };
function drawStrip(g) {                                                    // elite, boss A, boss B and gate icons under the clock
  const S = g.stageSpec, st = g.evState, G = g.gate;
  if (g.flow2) { const left = Math.max(0, Math.ceil(S.clock - g.sc)), ot = g.ot2, k2 = 'f2|' + G.state + '|' + (ot ? Math.floor(ot.t) : left); if (k2 === stripKey) return; stripKey = k2; $('strip').innerHTML = '<span class="' + (G.state === 'closed' ? 'now' : 'fight') + '">' + (ot ? (ot.endless ? 'Endless Overtime ' : 'Overtime ') + clock(Math.floor(ot.t)) : G.state === 'fight' ? sentence(' ' + S.gate.name).trim() + ' hunts you' : '') + '</span>'; return; }       // flow v2: one line, the clock to the boss, then Overtime
  if (g.openFlow) { const on = g.horde.on, left = Math.max(0, Math.ceil(S.clock - g.sc)), k2 = 'open|' + (on ? 'on' : left) + '|' + G.state; if (k2 === stripKey) return; stripKey = k2; $('strip').innerHTML = '<span class="' + (on ? 'fight' : 'now') + '">' + (on ? 'The horde rises' : G.state === 'closed' ? (g.door && g.door.state !== 'risen' && left > 60 ? '' : 'Horde rises in ') + (g.door && g.door.state !== 'risen' && left > 60 ? '' : clock(left)) : 'The horde waits') + '</span>'; return; }       // the open desert: one line, no elite, boss and twins chips
  let k = S.id + '|' + G.state + '|' + G.awake; for (let i = 0; i < st.length; i++) k += st[i];
  if (k === stripKey) return; stripKey = k;
  let h = ''; S.timeline.forEach((ev, i) => { h += '<span class="' + (st[i] === 2 ? 'done' : st[i] === 1 ? 'now' : '') + '" title="' + ev.name + ' at ' + clock(ev.t) + '">' + ROLE_LETTER[ev.role] + ' ' + clock(Math.max(0, S.clock - ev.t)) + '</span>'; });       // the chips count down on the same clock as the big timer
  h += '<span class="' + (G.state === 'fight' ? 'fight' : G.state === 'done' ? 'done' : G.awake ? 'now' : '') + '" title="' + S.gate.name + '">GATE</span>';
  $('strip').innerHTML = h;
}
// The Rite: three objective lines that appear in sequence and tick. They replace the next-event text as the main goal; the strip above stays.
// the boss bar shows for the final boss, the gate boss and the timed bosses, with the name on it
const bossOf = g => g.sp.find(s => s.alive && !s.dead && !s.asleep && (s.kind === 'pharaoh' || s.role === 'gate' || s.role === 'bossA' || s.role === 'bossB'));
const sentence = s => s.replace(/ The ([A-Z])/g, (m, c) => ' the ' + c);       // 'Fell The Stone Arbiter' reads 'Fell the Stone Arbiter'
function riteLines(g) {
  if (g.flow2) { const st = g.gate.state, S0 = g.stageSpec, ot = g.ot2, L2 = [[st !== 'closed', 'Survive the clock'], [st === 'done', 'Fell ' + S0.gate.name]]; if (st === 'done') L2.push([!!g.desc, ot && ot.endless ? 'Endless Overtime: stay alive' : 'Find the portal (follow the red wind)']); return L2.map(l => '<div style="color:' + (l[0] ? '#8fd89a' : '#f3e6c8') + '">' + (l[0] ? '<span class="tick">✓</span>' : '<span class="tick">•</span>') + sentence(l[1]) + '</div>').join(''); }
  if (g.openFlow) { const st = g.gate.state, S0 = g.stageSpec, last0 = g.stage >= 2, W0 = g.door ? 'door' : 'gate', L0 = g.door && g.door.state !== 'risen' && st === 'closed' ? [[false, 'A door will rise soon']] : st === 'closed' ? [[false, g.gateSeen ? 'Wake the ' + W0 + ' when ready' : 'Find the ' + W0]] : st === 'fight' ? [[true, 'Wake the ' + W0], [false, 'Fell ' + S0.gate.name]] : [[true, 'Wake the ' + W0], [true, 'Fell ' + S0.gate.name], [!!(g.desc || g.won), last0 ? 'Claim the Final Altar' : 'Step through the gateway']]; return L0.map(l => '<div style="color:' + (l[0] ? '#8fd89a' : '#f3e6c8') + '">' + (l[0] ? '<span class="tick">✓</span>' : '<span class="tick">•</span>') + sentence(l[1]) + '</div>').join(''); }
  const S = g.stageSpec, awake = g.gate.awake || g.gate.state !== 'closed', fell = g.gate.state === 'done', last = g.stage >= 2;
  const L = [[awake, 'Wake the gate (' + (awake ? 'awake' : clock(Math.max(0, S.gateWake - g.sc))) + ')']];
  for (let i = 0; i < S.timeline.length; i++) if (g.evState[i] < 2 && !awake) { L.unshift([false, S.timeline[i].name + ' (' + clock(Math.max(0, S.timeline[i].t - g.sc)) + ')']); break; }       // the next timed event and its time, so the player can plan
  if (awake) L.push([fell, 'Fell ' + S.gate.name]);
  if (fell) L.push([!!(g.desc || g.won), last ? 'Claim the Final Altar' : 'Step into the Descent Circle']);
  return L.map(l => '<div style="color:' + (l[0] ? '#8fd89a' : '#f3e6c8') + '">' + (l[0] ? '<span class="tick">✓</span>' : '<span class="tick">•</span>') + sentence(l[1]) + '</div>').join('');
}
function nextEventRun(g) {
  const S = g.stageSpec;
  if (g.flow2) {       // flow v2: the clock, then the boss, then Overtime
    if (g.ot2) return (g.ot2.endless ? 'Endless Overtime ' : 'Overtime ') + clock(Math.floor(g.ot2.t)) + '  x' + (1 + 0.1 * Math.floor(g.ot2.t / 30)).toFixed(1) + ' XP' + (g.circle ? '  (portal ' + Math.round(Math.hypot(g.circle.x - g.p.x, g.circle.z - g.p.z)) + ' m)' : '');
    if (g.gate.state === 'fight') return S.gate.name + ' hunts you';
    for (let i = 0; i < S.timeline.length; i++) if (g.evState[i] < 2) return S.timeline[i].name + ' in ' + clock(Math.max(0, S.timeline[i].t - g.sc));
    return S.gate.name + ' comes in ' + clock(Math.max(0, Math.ceil(S.clock - g.sc)));
  }
  if (g.openFlow && g.gate.state === 'closed' && !g.duelOn) return g.horde.on ? 'The horde is rising' : g.door && g.door.state !== 'risen' ? 'Hunt and loot' : 'Horde rises in ' + clock(Math.max(0, Math.ceil(S.clock - g.sc)));
  if (g.duelOn) return 'Hunters grow in ' + clock(30 - (g.otT % 30));
  if (g.circle) return 'Descent Circle closes in ' + clock(g.circle.t);
  if (g.altar) return 'The Final Altar';
  if (g.gate.state === 'fight') return S.gate.name + (g.gate.toll ? ' (Toll Bell)' : '');
  for (let i = 0; i < S.timeline.length; i++) if (g.evState[i] < 2) return S.timeline[i].name + ' in ' + clock(Math.max(0, S.timeline[i].t - g.sc));
  return g.gate.awake ? 'The gate is awake' : 'The gate wakes in ' + clock(Math.max(0, S.gateWake - g.sc));
}
const EVENTS = [[240, 'Sealed Warden'], [360, 'Twin Jackal Idols'], [420, 'The Last Audience'], [480, 'The Hollow King']];
function nextEvent(g) {
  if (g.t >= 480) { const n = 30 - ((g.t - 480) % 30); return 'Overtime hunters grow in ' + clock(n); }
  for (const [t, name] of EVENTS) if (g.t < t && !(name === 'The Hollow King' && g.boss.state !== 'idle')) return name + ' in ' + clock(t - g.t);
  return '';
}
let buffKey = '';
let stakeKey = '';
function drawStakes(g) {       // the Stakes percent under the clock (big desert only)
  const el = $('stakes'); if (!el) return; const v = g.big ? Math.round(g.stakes || 0) : -1, k = String(v); if (k === stakeKey) return; stakeKey = k; el.textContent = v < 0 ? '' : 'Stakes ' + v + '%'; el.className = v >= 300 ? 'max' : v >= 100 ? 'hi' : ''; clearTimeout(el._q); el.classList.remove('quiet'); el._q = setTimeout(() => el.classList.add('quiet'), 4000);       // shown only while it rises
}
function drawBuffs(g) {       // the timed pickups: a small chip each, with the seconds left (or the hits)
  const L = []; if (g.windT > 0) L.push('Wind Step ' + Math.ceil(g.windT) + 's'); if (g.drumT > 0) L.push('War Drum ' + Math.ceil(g.drumT) + 's'); if (g.stopT > 0) L.push('Stopped Sand ' + Math.ceil(g.stopT) + 's'); if (g.wardHits > 0) L.push('Ward x' + g.wardHits);
  const k = L.join('|'); if (k === buffKey) return; buffKey = k; const el = $('buffs'); if (el) el.innerHTML = L.map(t => '<span>' + t + '</span>').join('');
}
let rideKey = '', bankT = 0, bankV = 0;
export function rideBanked(v) { bankV = v; bankT = performance.now(); }
function drawRide(g) {       // Card Riding: the open combo (tricks, points x distinct tricks), the banked number, the balance bar on a grind or manual, the Flow pips
  const el = $('rideHud'); if (!el) return; const r = g.p && g.p.ride, F = g.rflow, on = !!(g.big && ((r && r.on) || (F && F.step > 1))); el.classList.toggle('on', on); if (!on) return;
  const c = r && r.combo, names = c ? Object.keys(c.names) : [], pts = c ? Math.round(c.pts) : 0, bal = r && (r.grind || r.manual) ? r.bal : null, age = performance.now() - bankT;
  const k = (c ? c.list.join('|') + pts : '') + '|' + (F ? F.step : 1) + '|' + (bal === null ? 'n' : Math.round(bal * 20)) + '|' + (age < 1200 ? bankV : 0) + '|' + (r && r.grind ? r.grind.name : ''); if (k === rideKey) return; rideKey = k;
  $('rhCombo').innerHTML = c && c.list.length ? c.list.slice(-3).join(' + ') + (r.grind ? ' + <em>' + r.grind.name + '</em>' : '') + '  <em>' + Math.round(pts * Math.max(1, names.length)).toLocaleString() + '</em>' : (r && r.grind ? '<em>' + r.grind.name + '</em>' : '');
  $('rhBank').textContent = age < 1200 && bankV ? '+' + bankV.toLocaleString() : '';
  const b = $('rhBal'); b.style.visibility = bal === null ? 'hidden' : 'visible'; if (bal !== null) b.firstChild.style.left = (77 + Math.max(-1, Math.min(1, bal)) * 77) + 'px';
  const sp = $('rhFlow').querySelectorAll('span'), st = F ? F.step : 1; sp.forEach((s, i) => s.classList.toggle('lit', i < st)); $('rhFlow').querySelector('b').textContent = 'x' + st;
}
export function drawHud(g, force) {
  drawBuffs(g); drawStakes(g); drawRide(g);
  if (!zonesBuilt) buildZones();
  const k = Math.ceil(g.p.hp) + '|' + g.p.maxHp + '|' + Math.floor(g.xpCur) + '|' + g.level + '|' + Math.floor(g.t) + '|' + g.kills + '|' + g.coins;
  if (force || k !== key) {
    key = k;
    $('hpnum').textContent = Math.ceil(g.p.hp); $('hpmax').textContent = g.p.maxHp;
        $('xpnum').textContent = 'LV ' + g.level;       // the level and the bar only: a fraction beside a bar always disagreed with it
        $('clock').textContent = g.mode !== 'classic' ? runClock(g) : g.t >= 480 ? 'OVERTIME +' + clock(g.t - 480) : clock(g.t); $('kills').textContent = g.kills; $('coins').textContent = g.coins; { const W = g.world, open = W && (W.cchests || []).some(c => !c.open && !c.free); const el = $('chestPrice'); el.textContent = open && /chest/i.test(g.stagePrompt || '') ? 'chest ' + chestPrice(g) : ''; el.style.color = open && g.coins >= chestPrice(g) ? '#ffd23f' : ''; }       // the next paid chest and its price, gold once you can pay it       // the chest price, only near a chest
  }
  // field: 4 Monster Zones then 4 Spell and Trap Zones
  let zdiff = force;
  const M = g.field.monsters, S = g.field.spells;
  for (let i = 0; i < M.length; i++) { const id = M[i] ? M[i].id : '', lv = M[i] ? M[i].level : 0; if (zM[i] !== id || zL[i] !== lv) { zM[i] = id; zL[i] = lv; zdiff = true; } }
  for (let i = 0; i < S.length; i++) { const id = S[i] ? S[i].id : '', lv = S[i] ? S[i].level : 0, rc = S[i] ? S[i].cd > 0 : false; if (sM[i] !== id || sL[i] !== lv || sR[i] !== rc) { sM[i] = id; sL[i] = lv; sR[i] = rc; zdiff = true; } }
  if (zdiff) {
    g.field.monsters.forEach((m, i) => {
      const el = $('mz' + i); el.className = 'zone' + (m ? ' full' : ''); el.style.borderColor = ''; el.style.boxShadow = '';
      if (!m) { el.innerHTML = 'empty<b>MONSTER ' + (i + 1) + '</b>'; return; }
      const D = MONSTERS[m.id] || FUSIONS[m.id], max = LEVELS.monsterMax;
      const els = D.elements || []; if (els[0]) el.style.borderColor = EL_COL[els[0]] || ''; if (els[1] && els[1] !== els[0]) el.style.boxShadow = 'inset 0 0 0 2px ' + (EL_COL[els[1]] || 'transparent');     // the element colours the border (two elements: the second shows inside it)
      el.innerHTML = '<em class="fm" title="form ' + (formOf(m.id, m.level) + 1) + ' of 3">' + ROMAN[formOf(m.id, m.level)] + '</em><span style="color:#fff3d0;font-weight:bold">' + D.name + '</span><i class="short" style="color:' + (EL_COL[els[0]] || '#fff3d0') + '">' + D.name.split(' ')[0] + '</i>' + pips(m.level, max) + '<b>L' + m.level + '</b>';
    });
    g.field.spells.forEach((s, i) => {
      const el = $('sz' + i); el.className = 'zone st' + (s ? ' full' : '');
      if (!s) { el.innerHTML = 'empty<b>SPELL / TRAP</b>'; return; }
      const D = SPELLS[s.id] || TRAPS[s.id];
      el.innerHTML = '<span style="color:#fff3d0;font-weight:bold">' + D.name + '</span><b>' + (TRAPS[s.id] ? 'TRAP ' + (s.cd > 0 ? 'recharging' : 'set') : 'SPELL') + '  L' + s.level + ' of 5</b>';
    });
  }
  // the text lines below change at most a few times a second: refresh them four times a second, not every frame
  const slow = Math.floor(g.t * 4);
  if (!force && slow === slowT) { const boss0 = bossOf(g); if (boss0) $('bossfill').style.width = Math.max(0, boss0.hp / boss0.maxHp * 100) + '%'; return; }
  slowT = slow;
  const ready = fusionsReady(g), f = $('fusion');
  f.style.display = ready.length ? 'block' : 'none';
  if (ready.length) f.textContent = 'FUSION READY: ' + ready.map(id => FUSIONS[id].name).join(' or ') + '. Open a sealed chest ({use}).'; if (ready.length) f.textContent = keyWords(f.textContent, inputMode());
  const boss = bossOf(g);
  $('boss').style.display = boss ? 'block' : 'none'; document.body.classList.toggle('bossOn', !!boss);       // the banner moves below the boss bar while it shows
  if (boss) { $('bossfill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; if ($('bossname').textContent !== boss.name) $('bossname').textContent = boss.name; }
  if (g.mode !== 'classic' && !(g.opts && g.opts.gym)) { drawStrip(g); drawFrenzy(g); } else if (g.opts && g.opts.gym && $('strip').innerHTML) $('strip').innerHTML = '';
  $('prompt').textContent = keyWords(g.prompt, inputMode());
  if (g.mode !== 'classic') { $('nextEvent').textContent = ''; const rh = g.opts && g.opts.gym ? '' : riteLines(g); if ($('rite').innerHTML !== rh) $('rite').innerHTML = rh; } else $('nextEvent').textContent = nextEvent(g);
  const cnt = {}; for (const id of g.items) cnt[id] = (cnt[id] || 0) + 1;
  const items = Object.keys(cnt).map(id => ITEMS[id].name + (cnt[id] > 1 ? ' x' + cnt[id] : '')).concat(g.blessings.map(id => BLESSINGS[id].name.replace('Blessing of ', '') + '+'));
  $('itemsList').textContent = items.length ? 'ITEMS: ' + items.join(', ') : '';
  if (g.mode !== 'classic') { $('stats').textContent = ''; return; }
  const idol = g.sp.filter(s => s.kind === 'idol' && s.alive);
  const st = [];
  if (idol.some(s => s.dead)) st.push('IDOL REVIVES IN ' + Math.max(0, idol.find(s => s.dead).reviveT).toFixed(1) + ' s');
  const w = g.sp.find(s => s.kind === 'warden' && s.alive); if (w) st.push('SEALED WARDEN ' + Math.ceil(w.hp) + ' HP (shield on its front)');
  if (g.boss.state === 'idle' && g.t >= 360) st.push(keyWords('ROYAL GATE OPEN (north, {use} to enter early)', inputMode()));
  $('stats').textContent = st.join('\n'); $('stats').style.whiteSpace = 'pre';
}

// The stat panel (Tab): every stat with its total and where it comes from, and the product of the damage brackets.
let panelKey = '';
export function drawStatPanel(g, on) {
  const el = $('statPanel'); if (!on) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  el.style.display = 'block';
  const M = g.mods, src = g.sheetSrc || {}, rows = [];
  for (const [gname, ids] of STAT_GROUPS) {                                       // every stat always shows, grouped, with its sources when it has any
    rows.push('<div class="dim" style="margin-top:6px;letter-spacing:1px">' + gname.toUpperCase() + '</div>');
    for (const id of ids) {
      const s = STAT_INFO[id], v = M[s.mod] || 0, raw = M.raw && M.raw[s.mod];
      const parts = (src[s.mod] || []).map(p => p[0] + ' ' + fmtStat(s, p[1]).replace('+', '')).join(' + ');
      rows.push('<div style="' + (v ? '' : 'opacity:.55') + '"><b>' + s.label + ' ' + (v ? fmtStat(s, v) : '0') + '</b>' + (raw > v + 1e-9 ? ' <span class="dim">(' + fmtStat(s, raw) + ' before the ceiling)</span>' : '') + (parts ? ' <span class="dim">= ' + parts + '</span>' : '') + (v && s.ceiling ? ' <span class="dim">(' + s.ceiling + ')</span>' : '') + '</div>');
    }
  }
  const might = mightBracket(M.dmgMult), hunter = targetBracket(M.bossDmg);
  const html = '<h3 style="margin:0 0 6px;letter-spacing:2px;color:#d8c08a">STATS <span class="dim" style="font-size:11px">(Tab to close)</span></h3>' + rows.join('') +
    '<div style="margin-top:8px"><b>Damage brackets</b> Might x' + might.toFixed(2) + ' (ceiling x' + (1 + K.knee1 + K.kneeK1).toFixed(1) + ') &middot; Hunter/marks x' + hunter.toFixed(2) + ' &middot; Crit x' + K.critBase + ' at ' + Math.round((0.05 + (M.crit || 0)) * 100) + '%</div>';
  if (html !== panelKey) { panelKey = html; el.innerHTML = html; }
}
// Banners: one at a time on the plate, at most 2 waiting, and a newer banner of the same kind (the same words with other numbers) replaces the older one. A banner that says
// "in N seconds" counts down live, once a second. Each shows for 2.4 s, or 1.2 s when others are waiting.
const bq = [], BANNER_MAX = 2; let bShowing = null, bTimer = 0, bCount = 0;
const bKind = t => String(t).replace(/[0-9]+/g, '#');
function bannerNext() {
  const b = $('banner'); clearTimeout(bTimer); clearInterval(bCount);
  if (!bq.length) { bShowing = null; b.classList.remove('on'); document.body.classList.remove('bannerOn'); return; }
  const it = bq.shift(); bShowing = it; const cd = /in (\d+) seconds?/.exec(it.text); let left = cd ? +cd[1] : 0;
  const paint = () => { b.textContent = cd ? it.text.replace(/in \d+ seconds?/, 'in ' + left + (left === 1 ? ' second' : ' seconds')) : it.text; };
  paint(); b.classList.add('on'); document.body.classList.add('bannerOn');
  if (cd) bCount = setInterval(() => { if (left > 1) { left--; paint(); } }, 1000);
  bTimer = setTimeout(bannerNext, cd ? (left + 1) * 1000 : (bq.length ? 1200 : 2400));
}
export function showBanner(text) {
  const k = bKind(text), same = bq.findIndex(q => q.kind === k);
  if (bShowing && bShowing.kind === k && !bq.length) { bShowing = { text, kind: k }; bq.push(bShowing); bannerNext(); return; }       // the same kind again: update in place
  if (same >= 0) bq.splice(same, 1);
  bq.push({ text, kind: k }); while (bq.length > BANNER_MAX) bq.shift();
  if (!bShowing) bannerNext();
}
export function dropBanner(start) { for (let i = bq.length - 1; i >= 0; i--) if (bq[i].text.startsWith(start)) bq.splice(i, 1); if (bShowing && bShowing.text.startsWith(start)) bannerNext(); }       // a banner that has stopped being true leaves at once
export function clearBanners() { bq.length = 0; bShowing = null; clearTimeout(bTimer); clearInterval(bCount); $('banner').classList.remove('on'); document.body.classList.remove('bannerOn'); }
let flashShown = -1, flashEl = null, flashPrev = 0, flashStart = -1e9;
export function showFlash(g) {
  // one short edge vignette per hit, and a new one starts at most every 350 ms (three a second): hits inside that window hold the level instead of retriggering
  const now = performance.now(); if (g.flash > (flashPrev || 0) + 0.01 && now - flashStart > 350) flashStart = now; flashPrev = g.flash;
  const age = (now - flashStart) / 1000, lvl = age < 0.25 ? 1 - age / 0.25 : 0, q = g.flash > 0 || lvl > 0 ? Math.round(lvl * 25) / 25 : 0;
  if (q !== flashShown) { flashShown = q; (flashEl || (flashEl = $('flash'))).style.opacity = q; }
}




