// The unlock ladder of the big desert: every item, boon and pickup a fresh save does not start with is its own quest, made here from the catalog so none is forgotten and the pace is one curve.
// A new player gets something on almost every run for the first ten runs (the first goals are 1 run, 2 runs, 3 runs, 60 kills, 8 vases ...) and the full game takes about 40 to 60 hours (the last goals are 100+ runs and
// tens of thousands of kills). Ten measures are dealt round-robin so every kind of play unlocks something; the legendary items wait on ten feats of their own.
import { ITEMS, BLESSINGS } from './items.js';
import { STARTER } from './starter.js';
import { POWERUPS } from './powerups.js';
import { BOARDS } from './boards.js';

const METRICS = [
  { stat: 'total.runs',        a: 1,  end: 200,     text: g => 'Finish ' + g + ' run' + (g > 1 ? 's' : '') + '.', name: 'Another Run' },
  { stat: 'total.kills',       a: 60, end: 150000,  text: g => 'Defeat ' + g + ' enemies in total.', name: 'Sand Cleaner' },
  { stat: 'total.vases',       a: 8,  end: 4000,    text: g => 'Break ' + g + ' vases in total.', name: 'Clay Breaker' },
  { stat: 'total.chests',      a: 3,  end: 1500,    text: g => 'Open ' + g + ' chests in total.', name: 'Chest Opener' },
  { stat: 'found.items',       a: 3,  end: 100,     text: g => 'Find ' + g + ' different items.', name: 'Collector' },
  { stat: 'total.minutes',     a: 8,  end: 3000,    text: g => 'Survive ' + g + ' minutes in total.', name: 'Long Walk' },
  { stat: 'total.doorsFound',  a: 1,  end: 150,     text: g => 'Find and wake ' + g + ' door' + (g > 1 ? 's' : '') + '.', name: 'Door Finder' },
  { stat: 'total.deaths',      a: 2,  end: 120,     text: g => 'Fall ' + g + ' times (every fall teaches).', name: 'Learned the Hard Way' },
  { stat: 'total.pickups',     a: 4,  end: 3000,    text: g => 'Take ' + g + ' pickups in total.', name: 'Magpie' },
  { stat: 'total.boons',       a: 1,  end: 1500,    text: g => 'Take ' + g + ' boons from shrines.', name: 'Shrine Walker' }
];
// the ride quests (card riding plan section 7): ride boons, land items and boards are earned by riding
const RIDE_METRICS = [
  { stat: 'total.slams',    a: 10,  end: 25000, text: g => 'Bank ' + g + ' landing slams in total.', name: 'Slam Down' },
  { stat: 'best.combo',     a: 800, end: 60000, text: g => 'Bank a combo worth ' + g + ' in one go.', name: 'Combo' },
  { stat: 'total.grindSec', a: 10,  end: 8000,  text: g => 'Grind ' + g + ' seconds in total.', name: 'Rail Time' },
  { stat: 'total.sealSets', a: 1,   end: 300,   text: g => 'Light ' + g + ' seal set' + (g > 1 ? 's' : '') + '.', name: 'Seal Lighter' },
  { stat: 'total.loops',    a: 1,   end: 400,   text: g => 'Ride ' + g + ' full pipe loop' + (g > 1 ? 's' : '') + '.', name: 'Looper' }
];
const isRideItem = id => !!(ITEMS[id] && ITEMS[id].mods && (ITEMS[id].mods.duneAir || ITEMS[id].mods.canyonVert || ITEMS[id].mods.ruinGrind));
const LEGEND = [
  ['best.stagesCleared', 3, 'Beyond the Desert II', 'Clear all three stages in one run.'], ['best.hardStages', 1, 'Hard Door', 'Clear a stage on Hard.'], ['best.mediumFull', 1, 'Middle Road', 'Clear all three stages on Medium.'],
  ['best.level', 40, 'Overflowing', 'Reach level 40 in one run.'], ['best.timeSurvived', 2000, 'The Long Dark', 'Survive 33 minutes in one run.'], ['total.doorsFound', 50, 'Doorkeeper', 'Find and wake 50 doors.'],
  ['total.bossKills', 25, 'Giant Slayer', 'Defeat 25 bosses.'], ['total.godFusions', 1, 'Beyond Fusion II', 'Make a God Fusion.'], ['best.hardStages', 3, 'Hard Road', 'Clear all three stages on Hard.'], ['mastery.any', 5, 'Master Duelist', 'Reach mastery rank 5 with any duelist.']
];
const FAM_ORDER = ['card', 'monster', 'spell', 'trap', 'move', 'defence', 'economy', 'explore', 'risk'];
// the locked items in unlock order: commons first, balanced across families, then rares, epics, legendaries
function ordered(rarity, skip) {
  const by = {}; for (const id of Object.keys(ITEMS)) if (ITEMS[id].rarity === rarity && !ITEMS[id].v2 && !STARTER.items.includes(id) && !skip.has(id)) (by[ITEMS[id].fam] || (by[ITEMS[id].fam] = [])).push(id);
  const out = []; for (let k = 0; ; k++) { let any = false; for (const f of FAM_ORDER) if (by[f] && by[f][k]) { out.push(by[f][k]); any = true; } if (!any) break; }
  return out;
}
// the first five goals of a measure are a, 2a, 3a, 4a, 5a (so the first runs each unlock something); after that they climb by a steady ratio to m.end, about 40 to 60 hours of play in
const ipow = (r, k) => { let v = 1; for (let i = 0; i < k; i++) v *= r; return v; };       // integer powers by multiplication (no Math.pow in data)
const ratioFor = (x, m) => { let lo = 1, hi = x; for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (ipow(mid, m) < x) lo = mid; else hi = mid; } return (lo + hi) / 2; };       // the m-th root of x by bisection
const goalsOf = (m, n) => { const out = [], r = ratioFor(m.end / (m.a * 5), Math.max(1, n - 5)); for (let k = 0; k < n; k++) { let v = k < 5 ? m.a * (k + 1) : m.a * 5 * ipow(r, k - 4); v = Math.round(v); if (v <= (out[k - 1] || 0)) v = (out[k - 1] || 0) + 1; out.push(v); } return out; };
export function ladderQuests(skip) {
  skip = skip || new Set();
  const targets = [];
  for (const id of ordered('common', skip)) targets.push(['item', id, 'Plain']);
  for (const id of Object.keys(BLESSINGS)) if (BLESSINGS[id].big && !BLESSINGS[id].ride && !STARTER.boons.includes(id)) targets.push(['boon', id, 'Plain']);
  for (const k of Object.keys(POWERUPS)) if (!STARTER.pickups.includes(+k)) targets.push(['pickup', +k, 'Bright']);
  for (const id of ordered('rare', skip)) if (!isRideItem(id)) targets.push(['item', id, 'Bright']);
  for (const id of ordered('epic', skip)) targets.push(['item', id, 'Gilded']);
  const per = METRICS.map((m, mi) => Math.ceil((targets.length - mi) / METRICS.length)), goals = METRICS.map((m, mi) => goalsOf(m, per[mi])), used = METRICS.map(() => 0), out = [];
  targets.forEach(([kind, id, rarity], i) => {
    const mi = i % METRICS.length, m = METRICS[mi], goal = goals[mi][used[mi]++];
    const label = kind === 'item' ? ITEMS[id].name : kind === 'boon' ? BLESSINGS[id].name : POWERUPS[id].name;
    out.push({ id: 'unlock-' + kind + '-' + id, tab: kind === 'item' ? 'Items' : 'General', name: m.name + ': ' + label, text: m.text(goal), rarity, stat: m.stat, goal, reward: { [kind]: id } });
  });
  ordered('legendary', skip).forEach((id, i) => { const L = LEGEND[i % LEGEND.length]; out.push({ id: 'unlock-item-' + id, tab: 'Items', name: L[2] + ': ' + ITEMS[id].name, text: L[3], rarity: 'Mythic', stat: L[0], goal: L[1], reward: { item: id } }); });
  // the ride quests: ride boons, land items and boards, dealt round-robin over the five riding measures
  const rt = []; for (const id of Object.keys(BLESSINGS)) if (BLESSINGS[id].ride && !STARTER.boons.includes(id)) rt.push(['boon', id, 'Plain']); for (const id of Object.keys(ITEMS)) if (isRideItem(id) && !STARTER.items.includes(id)) rt.push(['item', id, 'Bright']); for (const id of Object.keys(BOARDS)) if (!BOARDS[id].start) rt.push(['board', id, 'Bright']);
  const rper = RIDE_METRICS.map((m, mi) => Math.ceil((rt.length - mi) / RIDE_METRICS.length)), rgoals = RIDE_METRICS.map((m, mi) => goalsOf(m, rper[mi])), rused = RIDE_METRICS.map(() => 0);
  rt.forEach(([kind, id, rarity], i) => { const mi = i % RIDE_METRICS.length, m = RIDE_METRICS[mi], goal = rgoals[mi][rused[mi]++], label = kind === 'item' ? ITEMS[id].name : kind === 'boon' ? BLESSINGS[id].name : BOARDS[id].name; out.push({ id: 'unlock-' + kind + '-' + id, tab: 'Riding', name: m.name + ': ' + label, text: m.text(goal), rarity, stat: m.stat, goal, reward: { [kind]: id } }); });
  return out;
}
