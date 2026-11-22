// The plain placeholder HUD (the real look is awaiting approval). Text and bar widths only change when values change.
import { CFG } from '../data/config.js';
import { clock } from '../core/util.js';
import { MONSTERS, FUSIONS, SPELLS, TRAPS, FIELD_RULES, LEVELS, formOf } from '../data/cards.js';
import { fusionsReady } from '../sim/field.js';
import { STAT_INFO, fmtStat } from '../data/stats.js';
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
const stars = (n, max) => '*'.repeat(n) + '.'.repeat(Math.max(0, max - n));

function runClock(g) {
  if (g.duelOn) return 'DUEL ON +' + clock(g.otT);
  return (g.stages.length > 1 ? 'STAGE ' + (g.stage + 1) + '  ' : '') + clock(Math.max(0, g.stageSpec.clock - g.sc));
}
let stripKey = '';
const ROLE_LETTER = { elite: 'E', bossA: 'A', bossB: 'B' };
function drawStrip(g) {                                                    // elite, boss A, boss B and gate icons under the clock
  const S = g.stageSpec, st = g.evState, G = g.gate;
  let k = S.id + '|' + G.state + '|' + G.awake; for (let i = 0; i < st.length; i++) k += st[i];
  if (k === stripKey) return; stripKey = k;
  let h = ''; S.timeline.forEach((ev, i) => { h += '<span class="' + (st[i] === 2 ? 'done' : st[i] === 1 ? 'now' : '') + '" title="' + ev.name + ' at ' + clock(ev.t) + '">' + ROLE_LETTER[ev.role] + ' ' + clock(ev.t) + '</span>'; });
  h += '<span class="' + (G.state === 'fight' ? 'fight' : G.state === 'done' ? 'done' : G.awake ? 'now' : '') + '" title="' + S.gate.name + '">GATE</span>';
  $('strip').innerHTML = h;
}
function nextEventRun(g) {
  const S = g.stageSpec;
  if (g.duelOn) return 'Hunters grow in ' + clock(30 - (g.otT % 30));
  if (g.circle) return 'Descent Circle closes in ' + clock(g.circle.t);
  if (g.altar) return 'The Final Altar';
  if (g.gate.state === 'fight') return S.gate.name + (g.gate.toll ? ' (Toll Bell)' : '');
  for (let i = 0; i < S.timeline.length; i++) if (g.evState[i] < 2) return S.timeline[i].name + ' in ' + clock(Math.max(0, S.timeline[i].t - g.sc));
  return g.gate.awake ? 'The gate is awake' : 'The gate wakes in ' + clock(Math.max(0, S.gateWake - g.sc));
}
const EVENTS = [[240, 'Sealed Warden'], [360, 'Twin Jackal Idols'], [420, 'The Last Audience'], [480, 'The Hollow Pharaoh']];
function nextEvent(g) {
  if (g.t >= 480) { const n = 30 - ((g.t - 480) % 30); return 'Overtime hunters grow in ' + clock(n); }
  for (const [t, name] of EVENTS) if (g.t < t && !(name === 'The Hollow Pharaoh' && g.boss.state !== 'idle')) return name + ' in ' + clock(t - g.t);
  return '';
}
export function drawHud(g, force) {
  if (!zonesBuilt) buildZones();
  const k = Math.ceil(g.p.hp) + '|' + g.p.maxHp + '|' + Math.floor(g.xpCur) + '|' + g.level + '|' + Math.floor(g.t) + '|' + g.kills + '|' + g.coins;
  if (force || k !== key) {
    key = k;
    $('hpnum').textContent = Math.ceil(g.p.hp); $('hpmax').textContent = g.p.maxHp;
    $('hpbar').firstElementChild.style.width = (g.p.hp / g.p.maxHp * 100) + '%';
    $('xpnum').textContent = 'LV ' + g.level + '  ' + Math.floor(g.xpCur) + '/' + Math.ceil(g.xpNeed);
    $('xpbar').firstElementChild.style.width = (g.xpCur / g.xpNeed * 100) + '%';
    $('clock').textContent = g.mode !== 'classic' ? runClock(g) : g.t >= 480 ? 'OVERTIME +' + clock(g.t - 480) : clock(g.t); $('kills').textContent = g.kills; $('coins').textContent = g.coins;
  }
  // field: 4 Monster Zones then 4 Spell and Trap Zones
  let zdiff = force;
  const M = g.field.monsters, S = g.field.spells;
  for (let i = 0; i < M.length; i++) { const id = M[i] ? M[i].id : '', lv = M[i] ? M[i].level : 0; if (zM[i] !== id || zL[i] !== lv) { zM[i] = id; zL[i] = lv; zdiff = true; } }
  for (let i = 0; i < S.length; i++) { const id = S[i] ? S[i].id : '', lv = S[i] ? S[i].level : 0, rc = S[i] ? S[i].cd > 0 : false; if (sM[i] !== id || sL[i] !== lv || sR[i] !== rc) { sM[i] = id; sL[i] = lv; sR[i] = rc; zdiff = true; } }
  if (zdiff) {
    g.field.monsters.forEach((m, i) => {
      const el = $('mz' + i); el.className = 'zone' + (m ? ' full' : '');
      if (!m) { el.innerHTML = 'empty<b>MONSTER ' + (i + 1) + '</b>'; return; }
      const D = MONSTERS[m.id] || FUSIONS[m.id], max = LEVELS.monsterMax;
      el.innerHTML = '<span style="color:#fff3d0;font-weight:bold">' + D.name + '</span><b>' + stars(m.level, max) + ' L' + m.level + '  form ' + (formOf(m.id, m.level) + 1) + ' of 3</b>';
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
  if (!force && slow === slowT) { const boss0 = g.sp.find(s => s.kind === 'pharaoh' && s.alive); if (boss0) $('bossfill').style.width = Math.max(0, boss0.hp / boss0.maxHp * 100) + '%'; return; }
  slowT = slow;
  const ready = fusionsReady(g), f = $('fusion');
  f.style.display = ready.length ? 'block' : 'none';
  if (ready.length) f.textContent = 'FUSION READY: ' + ready.map(id => FUSIONS[id].name).join(' or ') + '. Open a sealed chest (E).';
  const boss = g.sp.find(s => s.kind === 'pharaoh' && s.alive);
  $('boss').style.display = boss ? 'block' : 'none';
  if (boss) { $('bossfill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%'; if ($('bossname').textContent !== boss.name) $('bossname').textContent = boss.name; }
  if (g.mode !== 'classic') drawStrip(g);
  $('prompt').textContent = g.prompt;
  $('nextEvent').textContent = g.mode !== 'classic' ? nextEventRun(g) : nextEvent(g);
  const items = g.items.map(id => ITEMS[id].name).concat(g.blessings.map(id => BLESSINGS[id].name.replace('Blessing of ', '') + '+'));
  $('itemsList').textContent = items.length ? 'ITEMS: ' + items.join(', ') : '';
  if (g.mode !== 'classic') { $('stats').textContent = ''; return; }
  const idol = g.sp.filter(s => s.kind === 'idol' && s.alive);
  const st = [];
  if (idol.some(s => s.dead)) st.push('IDOL REVIVES IN ' + Math.max(0, idol.find(s => s.dead).reviveT).toFixed(1) + ' s');
  const w = g.sp.find(s => s.kind === 'warden' && s.alive); if (w) st.push('SEALED WARDEN ' + Math.ceil(w.hp) + ' HP (shield on its front)');
  if (g.boss.state === 'idle' && g.t >= 360) st.push('ROYAL GATE OPEN (north, E to enter early)');
  $('stats').textContent = st.join('\n'); $('stats').style.whiteSpace = 'pre';
}

// The stat panel (Tab): every stat with its total and where it comes from, and the product of the damage brackets.
let panelKey = '';
export function drawStatPanel(g, on) {
  const el = $('statPanel'); if (!on) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
  el.style.display = 'block';
  const M = g.mods, src = g.sheetSrc || {}, rows = [];
  for (const s of STAT_INFO) {
    const v = M[s.mod] || 0; if (!v) continue;
    const parts = (src[s.mod] || []).map(p => p[0] + ' ' + fmtStat(s, p[1]).replace('+', '')).join(' + ');
    rows.push('<div><b>' + s.label + ' ' + fmtStat(s, v) + '</b>' + (parts ? ' <span class="dim">= ' + parts + '</span>' : '') + (s.ceiling ? ' <span class="dim">(' + s.ceiling + ')</span>' : '') + '</div>');
  }
  const might = mightBracket(M.dmgMult), hunter = targetBracket(M.bossDmg);
  const html = '<h3 style="margin:0 0 6px;letter-spacing:2px;color:#d8c08a">STATS <span class="dim" style="font-size:11px">(Tab to close)</span></h3>' + (rows.join('') || '<div class="dim">No bonuses yet.</div>') +
    '<div style="margin-top:8px"><b>Damage brackets</b> Might x' + might.toFixed(2) + ' (ceiling x' + (1 + K.knee1 + K.kneeK1).toFixed(1) + ') &middot; Hunter/marks x' + hunter.toFixed(2) + ' &middot; Crit x' + K.critBase + ' at ' + Math.round((0.05 + (M.crit || 0)) * 100) + '%</div>';
  if (html !== panelKey) { panelKey = html; el.innerHTML = html; }
}
export function showBanner(text) {
  const b = $('banner'); b.textContent = text; b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 3200);
}
let flashShown = -1, flashEl = null;
export function showFlash(g) {
  const q = g.flash > 0 ? Math.round(Math.min(1, g.flash / 0.25) * 25) / 25 : 0;
  if (q !== flashShown) { flashShown = q; (flashEl || (flashEl = $('flash'))).style.opacity = q; }
}




