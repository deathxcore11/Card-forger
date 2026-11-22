// Build simulator: per-minute damage, effective HP and procs/s for sample builds against the Overtime curve.
// Usage: node sim/builds.mjs [--quick]   (exit code 1 if any assertion fails)
// Each cell simulates 30 s warm-up + 60 s measured combat at 60 Hz through the real Ledger pipeline.

import { pathToFileURL } from 'node:url';
import { K } from '../src/tuning.js';
import { STAT, CAP_NAME, RX_NAME, requiredDpm, enemyHpMul, LUT } from '../src/stats.js';
import { runMinute, levelsAvailable } from '../src/loadout.js';
import { benchHits, benchPerHitPath } from '../src/bench.js';

const range = (a, b, step) => { const o = []; for (let x = a; x <= b + 1e-9; x += step) o.push(+x.toFixed(2)); return o; };
const bl = n => Array.from({ length: n }, () => 'bless:might');

export const BUILDS = [
  { id: 'starter', label: 'Fresh starter (no picks)', duelist: 'none', seed: 11, goals: [], items: [] },

  // Normal, per the SPEC envelope definition: 4 monsters, 1 Fusion, about 2 brackets invested (crit + affinity), Tempo and Guard spells.
  // It never fuses a second line (its other monsters are not partners); late levels go to blessings.
  { id: 'normal', label: 'Normal mid build: 4 monsters, 1 Fusion (Mira)', duelist: 'mira', seed: 21,
    goals: ['mon:rune-apprentice:4', 'mon:sigil-familiar:3', 'mon:frost-lynx:2', 'st:whetted-focus:2', 'bless:might', 'mon:hollow-shade:2', 'st:iron-psalm:1',
      'mon:rune-apprentice:7', 'mon:sigil-familiar:6', 'mon:frost-lynx:5', 'st:whetted-focus:3', 'st:quickened-pulse:1', 'mon:rune-apprentice:10',
      'mon:sigil-familiar:10', 'fuse:astral-magus', 'mon:hollow-shade:5', 'st:frost-litany:2', 'mon:ember-wyvern:4', 'bless:guard', 'bless:vigor',
      'mon:astral-magus:5', 'mon:frost-lynx:8', 'st:whetted-focus:5', 'st:iron-psalm:3', 'mon:astral-magus:10', 'mon:frost-lynx:10', 'mon:hollow-shade:10',
      'mon:ember-wyvern:10', 'st:quickened-pulse:5', 'st:frost-litany:5', 'st:iron-psalm:5',
      ...Array.from({ length: 60 }, (_, i) => ['bless:might', 'bless:focus', 'bless:vigor', 'bless:haste', 'bless:guard'][i % 5])],
    items: [['clay-heart', 2], ['whetstone-tablet', 3], ['bronze-scale', 4], ['bandaged-hand', 6], ['paper-talisman', 8], ['clay-heart', 10],
      ['hunters-mark', 12], ['bronze-scale', 15], ['whetstone-tablet', 18], ['veiled-sandals', 22], ['clay-heart', 26]] },

  // Strong: two to three Fusion lines (the SPEC envelope's "Strong" row).
  { id: 'strong', label: 'Strong: 2-3 Fusion lines (Mira)', duelist: 'mira', seed: 22,
    goals: ['mon:rune-apprentice:4', 'mon:sigil-familiar:3', 'mon:ember-wyvern:2', 'st:whetted-focus:2', 'bless:might', 'mon:cinder-hatchling:2', 'st:iron-psalm:1',
      'mon:rune-apprentice:7', 'mon:sigil-familiar:6', 'mon:ember-wyvern:5', 'mon:cinder-hatchling:4', 'st:whetted-focus:3', 'st:iron-psalm:2',
      'mon:rune-apprentice:10', 'mon:sigil-familiar:10', 'fuse:astral-magus', 'mon:ember-wyvern:8', 'mon:cinder-hatchling:7', 'st:whetted-focus:5',
      'st:quickened-pulse:2', 'bless:guard', 'bless:vigor', 'mon:astral-magus:6', 'st:iron-psalm:3', 'st:quickened-pulse:3', 'bless:might',
      'mon:ember-wyvern:10', 'mon:cinder-hatchling:10', 'fuse:twinflare-tyrant', 'mon:astral-magus:10', 'mon:frost-lynx:6',
      'mon:twinflare-tyrant:10', 'mon:frost-lynx:10', 'mon:rime-sprite:8', 'st:frost-litany:3',
      'st:frost-litany:5', 'st:iron-psalm:5', 'st:quickened-pulse:5', 'mon:rime-sprite:10', 'fuse:hoarfrost-colossus', 'mon:hoarfrost-colossus:10',
      'mon:hollow-shade:10', 'bless:renewal', 'bless:focus', 'bless:vigor', 'bless:guard', ...bl(10)],
    items: [['clay-heart', 2], ['whetstone-tablet', 3], ['bronze-scale', 4], ['bandaged-hand', 6], ['paper-talisman', 8], ['clay-heart', 10],
      ['hunters-mark', 12], ['bronze-scale', 15], ['serrated-fang', 18], ['veiled-sandals', 22], ['whetstone-tablet', 26]] },

  { id: 'fusionpair', label: 'Focused Fusion pair, Thermal Shock (Oren)', duelist: 'oren', seed: 33,
    goals: ['mon:frost-lynx:5', 'mon:rime-sprite:4', 'st:frost-litany:2', 'mon:ember-wyvern:3', 'mon:frost-lynx:10', 'mon:rime-sprite:10', 'fuse:hoarfrost-colossus',
      'st:storm-lens:2', 'mon:cinder-hatchling:3', 'mon:ember-wyvern:10', 'mon:cinder-hatchling:10', 'fuse:twinflare-tyrant', 'st:kindling-rite:3',
      'st:ringing-rite:3', 'mon:hoarfrost-colossus:10', 'mon:twinflare-tyrant:10', 'st:frost-litany:5', 'st:storm-lens:5', 'st:kindling-rite:5',
      'st:ringing-rite:5', 'mon:lantern-acolyte:10', 'mon:hollow-shade:10', ...bl(40)],
    items: [['lucky-coin', 3], ['humming-reed', 5], ['clay-heart', 6], ['bronze-scale', 8], ['paper-talisman', 10], ['veiled-sandals', 14],
      ['serrated-fang', 16], ['clay-heart', 20], ['hunters-mark', 24]] },

  { id: 'god', label: 'God Fusion (Stormcrown Drake) + Unmarked Card (Mira)', duelist: 'mira', seed: 44,
    goals: ['mon:rune-apprentice:10', 'mon:sigil-familiar:10', 'fuse:astral-magus', 'mon:ember-wyvern:10', 'mon:cinder-hatchling:10', 'fuse:twinflare-tyrant',
      'mon:astral-magus:10', 'mon:twinflare-tyrant:10', 'fuse:stormcrown-drake', 'st:kindling-rite:5', 'st:storm-lens:5', 'st:savage-rite:5',
      'st:monster-drill:5', 'mon:frost-lynx:10', 'mon:rime-sprite:10', 'fuse:hoarfrost-colossus', 'mon:hoarfrost-colossus:10'],
    items: [['lucky-coin', 2], ['whetstone-tablet', 4], ['unmarked-card', 5], ['clay-heart', 6], ['bronze-scale', 7], ['hunters-mark', 9],
      ['serrated-fang', 11], ['paper-talisman', 13], ['whetstone-tablet', 16], ['clay-heart', 20], ['veiled-sandals', 24]] },

  { id: 'broken', label: 'Broken: self-damage + procs (Vesh)', duelist: 'vesh', seed: 55,
    goals: ['mon:cinder-penitent:5', 'st:toll-of-ash:2', 'st:gust-ward:2', 'mon:frost-lynx:3', 'mon:cinder-penitent:10', 'st:iron-psalm:3', 'st:ringing-rite:3',
      'mon:ember-wyvern:10', 'mon:cinder-hatchling:10', 'fuse:twinflare-tyrant', 'st:toll-of-ash:5', 'st:gust-ward:5', 'st:iron-psalm:5', 'st:ringing-rite:5',
      'mon:frost-lynx:10', 'mon:rime-sprite:10', 'fuse:hoarfrost-colossus', 'mon:twinflare-tyrant:10', 'mon:hoarfrost-colossus:10',
      ...Array.from({ length: 40 }, (_, i) => (i % 2 ? 'bless:guard' : 'bless:might'))],
    items: [['thornbound-locket', 3], ['bronze-scale', 3], ['bronze-scale', 5], ['humming-reed', 6], ['paper-talisman', 7], ['recoil-seal', 9],
      ['veiled-sandals', 10], ['humming-reed', 12], ['paper-talisman', 14], ['veiled-sandals', 16], ['bronze-scale', 18], ['serrated-fang', 20],
      ['bandaged-hand', 22], ['bronze-scale', 25]] },

  { id: 'kael', label: 'Coins held (Kael, Ante Up)', duelist: 'kael', seed: 66,
    coins: { 2: 90, 4: 260, 8: 700, 12: 1400, 20: 3000, 30: 5500 },
    goals: ['mon:ember-wyvern:5', 'mon:cinder-hatchling:4', 'st:savage-rite:2', 'st:whetted-focus:2', 'mon:ember-wyvern:10', 'mon:cinder-hatchling:10',
      'fuse:twinflare-tyrant', 'st:kindling-rite:3', 'mon:rune-apprentice:5', 'mon:twinflare-tyrant:10', 'st:savage-rite:5', 'st:whetted-focus:5',
      'st:kindling-rite:5', 'mon:rune-apprentice:10', 'mon:sigil-familiar:10', 'fuse:astral-magus', 'mon:astral-magus:10', 'st:monster-drill:5',
      'mon:frost-lynx:10', ...bl(40)],
    items: [['whetstone-tablet', 6], ['serrated-fang', 12]] },

  // Synthetic: Secret Fusion plus every bracket at its ceiling. Not reachable by budget; it measures maxDPM and T_end.
  { id: 'ceiling', label: 'Ceiling (synthetic: Secret Fusion + three L10 Fusions, every bracket at its ceiling)', duelist: 'kael', seed: 77,
    coins: { 2: 3600, 30: 3600 },
    synthetic: t => ({ id: 'ceiling', duelist: 'kael', spent: 0, avail: levelsAvailable(t), leftover: 0, hidden: 60, rolls: [0, 0, 0, 0, 0],
      mons: [['eventide-arcanum', 3], ['twinflare-tyrant', 1], ['astral-magus', 1], ['hoarfrost-colossus', 1]].map(([id, tier]) =>
        ({ id, lvl: 10, tier, tune: { ...CEIL_TUNE } })),
      st: [], bless: {}, items: { 'graveyard-bell': 3, 'notched-tally': 1, 'thornbound-locket': 2, 'recoil-seal': 2, 'paper-talisman': 4 },
      pts: [[STAT.MIGHT, 1e6], [STAT.EDGE, 1e6], [STAT.KEEN, 1023], [STAT.FERO, 1e6], [STAT.FERV, 1023], [STAT.RESO, 1e6], [STAT.HUNT, 1e6],
        [STAT.SWARM, 1e6], [STAT.MARKD, 1e6], ...[0, 1, 2, 3, 4, 5, 6, 7].map(e => [STAT.AFF_FIRE + e, 1e6]), ...[0, 1, 2, 3, 4].map(s => [STAT.SRC_MON + s, 1e6]),
        [STAT.TEMPO, 1e6], [STAT.DRAW, 1e6], [STAT.REACH, 1e6], [STAT.VOLLEY, 99], [STAT.REWIND, 1e6], [STAT.LP, 400], [STAT.GUARD, 1023], [STAT.SIDE, 1023], [STAT.REGEN, 500], [STAT.WARD, 4]] }) }
];

// Ceiling Tuning: what a God/Secret line inherits from parents rolled at heavy Fortune (about 1/3 of rolls Gilded or better).
const CEIL_TUNE = { dmg: 6000, rate: 4000, area: 4000, coef: 40, proj: 2 };

export const MINUTES = [2, 4, 8, 12, 20, 30];

const fmt = v => {
  if (!Number.isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e4) return (v / 1e3).toFixed(1) + 'k';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1);
  return v.toFixed(2);
};

export function assertCell(r, fail) {
  const tag = `${r.build}@${r.t}`;
  const nums = [r.dpm, r.procsPerSec, r.ehp, r.hitsToDie, r.avgHp, r.killsPerMin, r.critRate, r.evade, r.maxProcChance, ...Object.values(r.brackets), ...r.dmgBy];
  if (nums.some(v => !Number.isFinite(v))) fail(`${tag}: NaN/Infinity in results`);
  if (!(r.evade < 1) || r.evade > K.sideCap + 1e-6) fail(`${tag}: evasion ${r.evade} not below cap`);
  if (!(r.maxProcChance < 1)) fail(`${tag}: proc chance reaches 100%`);
  if (!(r.critChance < 1)) fail(`${tag}: crit chance reaches 100%`);
  if (!(r.guardMit < 1)) fail(`${tag}: mitigation reaches 100%`);
  if (r.selfDeaths !== 0) fail(`${tag}: self-damage killed the player`);
  if (r.badHp !== 0) fail(`${tag}: LP left [0, max] or went non-finite`);
  for (const [name, c] of Object.entries(r.caps)) if (c.peak > c.limit) fail(`${tag}: cap ${name} peak ${c.peak} > ${c.limit} in a sliding 60 s window`);
  if (r.lo.spent > r.lo.avail) fail(`${tag}: level budget overspent ${r.lo.spent}/${r.lo.avail}`);
}

// first time on the grid where the build's DPM falls below the required line
export function holdsUntil(build, grid, opts) {
  let last = null;
  for (const t of grid) {
    const r = runMinute(build, t, opts);
    if (r.effDpm < r.required) return { t, last, r };
    last = t;
  }
  return { t: null, last };
}

export async function main(argv = process.argv.slice(2)) {
  const quick = argv.includes('--quick');
  const failures = [];
  const fail = m => failures.push(m);
  const rows = [];
  const lines = [];
  const out = s => { lines.push(s); console.log(s); };

  out('## Overtime curve (enemy side)');
  out('| min | OT step n | Overtime HP x (HP_LUT) | avg enemy HP | spawns/min | enemy contact hit | required DPM R(t) |');
  out('|---|---|---|---|---|---|---|');
  for (const t of MINUTES) {
    const n = Math.max(-1, Math.floor((t - K.otStartMin) * 2));
    const r = runMinute(BUILDS[0], t, { warmSec: 1, measureSec: 1, audit: false });
    out(`| ${t} | ${n < 0 ? '-' : n} | ${fmt(r.hpMul)} | ${fmt(r.enemyHp)} | ${fmt(r.spawns)} | ${fmt(r.enemyHit)} | ${fmt(requiredDpm(t))} |`);
  }
  out('');
  out('## Builds by minute');
  out('| build | min | levels used/avail | raw DPM | eff. DPM | required | eff/req | procs/s | crit % | reacts/min | kills/min | EHP | avg LP | hits to die | deaths/min | B7 |');
  out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const b of BUILDS) {
    for (const t of MINUTES) {
      const r = runMinute(b, t, quick ? { warmSec: 10, measureSec: 20 } : {});
      assertCell(r, fail);
      rows.push(r);
      out(`| ${b.id} | ${t} | ${b.synthetic ? 'synthetic' : `${r.lo.spent}/${r.lo.avail}`}${r.lo.hidden ? ` (+${r.lo.hidden} banked)` : ''} | ${fmt(r.dpm)} | ${fmt(r.effDpm)} | ${fmt(r.required)} | ` +
        `${(r.effDpm / r.required).toFixed(2)} | ${fmt(r.procsPerSec)} | ${(100 * r.critRate).toFixed(1)} | ${fmt(r.reactsPerMin)} | ${fmt(r.killsPerMin)} | ` +
        `${fmt(r.ehp)} | ${fmt(r.avgHp)} | ${fmt(r.hitsToDie)} | ${fmt(r.deathsPerMin)} | ${r.avgB7.toFixed(2)} |`);
    }
  }
  out('');
  out('## Holds until (first half-minute where effective DPM < required; 15 s warm-up + 30 s measured per point)');
  out('| build | falls below at | last holding point | eff. DPM there | required there |');
  out('|---|---|---|---|---|');
  const grid = range(1, 60, quick ? 1 : 0.5);
  const holds = {};
  for (const b of BUILDS) {
    const h = holdsUntil(b, grid, { warmSec: 15, measureSec: 30, audit: false });
    holds[b.id] = h;
    out(`| ${b.id} | ${h.t === null ? 'never (<= 60 min): UNBOUNDED' : h.t + ' min'} | ${h.last ?? '-'} | ${h.r ? fmt(h.r.effDpm) : '-'} | ${h.r ? fmt(h.r.required) : '-'} |`);
    if (h.t === null) fail(`${b.id}: never falls below the Overtime line by 60 min (unbounded)`);
  }
  out('');
  out('## Caps observed (peak in any sliding 60 s window / limit, over all cells)');
  const peak = {};
  for (const r of rows) for (const [k, c] of Object.entries(r.caps)) peak[k] = Math.max(peak[k] || 0, c.peak);
  out('| cap | peak | limit |'); out('|---|---|---|');
  for (const k of CAP_NAME) out(`| ${k} | ${peak[k]} | ${K.capLimit[k]} |`);
  out('');
  out('## Reactions per minute at 12 min');
  for (const r of rows.filter(x => x.t === 12)) out(`- ${r.build}: ${Object.entries(r.reacts).map(([i, v]) => `${RX_NAME[i]} ${fmt(v)}`).join(', ') || 'none'}`);
  out('');
  out('## Microbench');
  const bench = await benchHits(1e6);
  out(`- 1e6 hits (mixed elements, crits, reactions, chains, kills, explosions, Bell, Tally, self-damage every 64 hits): ${bench.nsPerHit.toFixed(1)} ns/hit, ` +
    `heap delta ${bench.heapDelta} B (${bench.bytesPerHit.toFixed(3)} B/hit amortised, cold 1 Hz paths included), GC events in window: ${bench.gcEvents}`);
  const ph = await benchPerHitPath(1e6);
  out(`- per-hit path only (all 8 elements, reactions, chains; no kill events): ${ph.nsPerHit.toFixed(1)} ns/hit, heap delta ${ph.heapDelta} B, GC events ${ph.gcEvents}`);
  if (ph.gcEvents !== 0 || ph.heapDelta > 64 * 1024) fail(`per-hit path allocates (gc ${ph.gcEvents}, heap ${ph.heapDelta})`);
  if (!bench.finite) fail('microbench produced non-finite damage');
  out('');
  out(failures.length ? `## FAILURES (${failures.length})\n` + failures.map(f => '- ' + f).join('\n') : '## All sim assertions passed');
  if (failures.length) console.log(failures.join('\n'));
  return { rows, holds, bench, perHit: ph, failures, text: lines.join('\n') };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = await main();
  if (process.argv.includes('--json')) {
    const fs = await import('node:fs');
    fs.writeFileSync(new URL('./last-run.md', import.meta.url), res.text + '\n');
  }
  process.exit(res.failures.length ? 1 : 0);
}
