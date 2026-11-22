// The plain placeholder HUD (the real look is awaiting approval). Text and bar widths only change when values change.
import { CFG } from '../data/config.js';
import { clock } from '../core/util.js';
import { MONSTERS, FUSIONS, SPELLS, TRAPS, FIELD_RULES, LEVELS, formOf } from '../data/cards.js';
import { fusionsReady } from '../sim/field.js';
import { ITEMS, BLESSINGS } from '../data/items.js';

const $ = id => document.getElementById(id);
let key = '', zoneKey = '', bannerT = 0, zonesBuilt = false;

function buildZones() {
  const z = $('zones'); z.innerHTML = '';
  for (let i = 0; i < FIELD_RULES.monsterZones; i++) z.insertAdjacentHTML('beforeend', '<div class="zone" id="mz' + i + '"></div>');
  for (let i = 0; i < FIELD_RULES.spellTrapZones; i++) z.insertAdjacentHTML('beforeend', '<div class="zone st" id="sz' + i + '"></div>');
  zonesBuilt = true;
}
const stars = (n, max) => '*'.repeat(n) + '.'.repeat(Math.max(0, max - n));

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
    $('clock').textContent = g.t >= 480 ? 'OVERTIME +' + clock(g.t - 480) : clock(g.t); $('kills').textContent = g.kills; $('coins').textContent = g.coins;
  }
  // field: 4 Monster Zones then 4 Spell and Trap Zones
  const zk = JSON.stringify([g.field.monsters.map(m => m && [m.id, m.level]), g.field.spells.map(s => s && [s.id, s.level, s.cd > 0])]);
  if (force || zk !== zoneKey) {
    zoneKey = zk;
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
  const ready = fusionsReady(g), f = $('fusion');
  f.style.display = ready.length ? 'block' : 'none';
  if (ready.length) f.textContent = 'FUSION READY: ' + ready.map(id => FUSIONS[id].name).join(' or ') + '. Open a sealed chest (E).';
  const boss = g.sp.find(s => s.kind === 'pharaoh' && s.alive);
  $('boss').style.display = boss ? 'block' : 'none';
  if (boss) $('bossfill').style.width = Math.max(0, boss.hp / boss.maxHp * 100) + '%';
  $('prompt').textContent = g.prompt;
  $('nextEvent').textContent = nextEvent(g);
  const items = g.items.map(id => ITEMS[id].name).concat(g.blessings.map(id => BLESSINGS[id].name.replace('Blessing of ', '') + '+'));
  $('itemsList').textContent = items.length ? 'ITEMS: ' + items.join(', ') : '';
  const idol = g.sp.filter(s => s.kind === 'idol' && s.alive);
  const st = [];
  if (idol.some(s => s.dead)) st.push('IDOL REVIVES IN ' + Math.max(0, idol.find(s => s.dead).reviveT).toFixed(1) + ' s');
  const w = g.sp.find(s => s.kind === 'warden' && s.alive); if (w) st.push('SEALED WARDEN ' + Math.ceil(w.hp) + ' HP (shield on its front)');
  if (g.boss.state === 'idle' && g.t >= 360) st.push('ROYAL GATE OPEN (north, E to enter early)');
  $('stats').textContent = st.join('\n'); $('stats').style.whiteSpace = 'pre';
}

export function showBanner(text) {
  const b = $('banner'); b.textContent = text; b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), 3200);
}
export function showFlash(g) { $('flash').style.opacity = g.flash > 0 ? Math.min(1, g.flash / 0.25) : 0; }




