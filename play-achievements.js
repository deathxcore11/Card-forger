// Play achievements, daily and weekly quests and the log-in calendar (play-achievements.md, slice 2).
// Shared by the worker (which checks and pays) and the app (which shows progress). Every number comes
// from something the server counts: match reports (play.counters), log-ins, packs opened and the
// Play collection. Practice never counts, and friend matches count as played, never as won.

import {STORY_DEEDS, STORY_ACT_DEEDS, storyDeedArt} from './story-deeds.js';
import {collectorSource} from './play-econ-rules.js';

// The tier names for a chain of n steps: the last step of a long chain is mythic.
const TIER_NAMES = {1: ['gold'], 2: ['bronze', 'gold'], 3: ['bronze', 'silver', 'gold'], 4: ['bronze', 'silver', 'gold', 'mythic'], 5: ['bronze', 'bronze', 'silver', 'gold', 'mythic']};
export const tierNames = n => TIER_NAMES[n] || TIER_NAMES[5];
const DEFAULT_TIER_REWARD = {bronze: {seals: {u: 1}, xp: 100}, silver: {seals: {r: 1}, xp: 250}, gold: {seals: {m: 1}, xp: 500}, mythic: {seals: {m: 1}, coins: 1000, xp: 1000}};
const FEAT = {coins: 300, packs: 1, xp: 100};

// Tabs, in order. Each matches a mode or style from the spec; tabs with nothing countable yet stay out.
export const DEED_TABS = [['journey', 'Journey'], ['duelist', 'Duelist'], ['formats', 'Formats'], ['story', 'Story'], ['friends', 'Friends'], ['collector', 'Collector'], ['hidden', 'Hidden']];

// source: a play.counters key, or 'fmt' (formats won in), or a collection/wallet figure.
export const ACHIEVEMENTS = Object.freeze([
  {id: 'first-spark', tab: 'journey', title: 'First Spark', lore: 'Every planeswalker remembers the first time the spark caught.', art: 'Chandra, Torch of Defiance', source: 'matches', steps: [1], feat: true},
  {id: 'faithful', tab: 'journey', title: 'Faithful Planeswalker', lore: 'Days you came back to the Multiverse. Missed days never reset it.', art: 'Teferi, Hero of Dominaria', source: 'logins', steps: [7, 30, 100, 365], titleReward: 'Ever-Present'},
  {id: 'table-time', tab: 'journey', title: 'Time at the Table', lore: 'Hours spent in real matches, never in menus.', art: 'Karn, Scion of Urza', source: 'minutes', steps: [60, 600, 3000, 9000, 30000], unit: 'h', titleReward: 'Grizzled Veteran'},
  {id: 'well-travelled', tab: 'journey', title: 'Well Travelled', lore: 'Matches finished in Story, Quick Play and Multiplayer.', art: 'Kiora, Behemoth Beckoner', source: 'matches', steps: [10, 50, 250, 1000]},
  {id: 'victor', tab: 'duelist', title: 'Victor', lore: 'Wins against the CPU and in Story. Friend wins never count.', art: 'Elspeth, Sun\'s Champion', source: 'wins', steps: [10, 50, 250, 1000, 5000]},
  {id: 'on-the-draw', tab: 'duelist', title: 'On the Draw', lore: 'Wins when you went second.', art: 'Brainstorm', source: 'wins_draw', steps: [5, 25, 100]},
  {id: 'swift-justice', tab: 'duelist', title: 'Swift Justice', lore: 'Win by turn 5.', art: 'Lightning Bolt', source: 'wins_fast', steps: [1], feat: true},
  {id: 'flawless', tab: 'duelist', title: 'Flawless', lore: 'Win with 20 life or more.', art: 'Serra Angel', source: 'wins_flawless', steps: [1], feat: true},
  {id: 'long-game', tab: 'duelist', title: 'The Long Game', lore: 'Win a match that reaches turn 20.', art: 'Ugin, the Spirit Dragon', source: 'wins_long', steps: [1], feat: true},
  {id: 'format-explorer', tab: 'formats', title: 'Format Explorer', lore: 'Win in different formats.', art: 'Jace, the Mind Sculptor', source: 'fmt', steps: [2, 4, 6]},
  {id: 'storyteller', tab: 'story', title: 'Storyteller', lore: 'Story battles won, from Dominaria onward.', art: 'Urza, Lord High Artificer', source: 'story_wins', steps: [1, 10, 30, 60]},
  {id: 'good-company', tab: 'friends', title: 'Good Company', lore: 'Friend matches finished. Three count each day.', art: 'Ajani, Mentor of Heroes', source: 'friend_matches', steps: [5, 25, 100, 500]},
  {id: 'binder-builder', tab: 'collector', title: 'Binder Builder', lore: 'Cards in your Trunk, counting every copy.', art: 'Tolarian Academy', source: 'cards', steps: [100, 500, 1500, 4000, 10000]},
  {id: 'playset', tab: 'collector', title: 'Playset', lore: 'Different cards you hold all 4 copies of.', art: 'Lotus Petal', source: 'playsets', steps: [25, 100, 500]},
  {id: 'mythic-hoard', tab: 'collector', title: 'Mythic Hoard', lore: 'Different mythics in your Trunk.', art: 'Emrakul, the Aeons Torn', source: 'mythics', steps: [10, 50, 150]},
  {id: 'pack-rat', tab: 'collector', title: 'Pack Rat', lore: 'Packs opened, from every source.', art: 'Pack Rat', source: 'packs', steps: [10, 50, 200, 500, 1000]},
  {id: 'by-a-thread', tab: 'hidden', title: 'By a Thread', lore: 'Win with exactly 1 life left.', riddle: 'One breath stands between you and the grave.', art: 'Near-Death Experience', source: 'wins_thread', steps: [1], feat: true, hidden: true},
  // Story deeds: one feat each, woven into the acts (story-deeds.js).
  ...[...STORY_DEEDS, ...STORY_ACT_DEEDS].map(d => ({id: d.id, tab: 'story', title: d.title, lore: d.lore, art: storyDeedArt(d), source: 'sd:' + d.id, steps: [1], feat: true})),
  {id: 'marathon', tab: 'hidden', title: 'Marathon', lore: 'Win a match that reaches turn 30.', riddle: 'The sun rose and set and still you fought.', art: 'Approach of the Second Sun', source: 'wins_marathon', steps: [1], feat: true, hidden: true},
]);

// How far the player is along one source.
export function sourceValue(source, {counters = {}, state = {}} = {}) {
  const cards = state?.cards || [];
  if (source === 'cards') return cards.reduce((t, c) => t + (c.c | 0), 0);
  if (source === 'playsets') return cards.filter(c => (c.c | 0) >= 4).length;
  if (source === 'mythics') return cards.filter(c => c.r === 'mythic' && (c.c | 0) > 0).length;
  if (source === 'packs') return state?.wallet?.packs_opened | 0;
  if (source === 'fmt') return Object.keys(counters).filter(k => /^fmt:/.test(k) && counters[k] > 0).length;
  return Number(counters[source]) || 0;
}

const claimedRef = (id, step) => `ach:${id}:${step}`;
// One row per achievement: value, its steps with tier and claim state, and the next goal.
export function achievementRows(ctx = {}) {
  const claimed = new Set(ctx.claimed || []);
  return ACHIEVEMENTS.map(a => {
    const value = sourceValue(a.source, ctx), names = tierNames(a.steps.length);
    const steps = a.steps.map((need, i) => ({need, tier: a.feat ? 'feat' : names[i], done: value >= need, claimed: claimed.has(claimedRef(a.id, i))}));
    const next = steps.find(s => !s.done), earned = steps.filter(s => s.done).length;
    return {...a, value, steps, earned, next, ready: steps.some(s => s.done && !s.claimed), complete: !next};
  });
}
export function deedTotals(rows) {
  const total = rows.reduce((t, r) => t + r.steps.length, 0), earned = rows.reduce((t, r) => t + r.earned, 0);
  return {total, earned, ready: rows.filter(r => r.ready).length};
}
// The 3 unfinished achievements closest to their next step ("Almost there").
export const almostThere = (rows, n = 3) => rows.filter(r => r.next && !r.hidden).map(r => ({r, share: r.value / r.next.need})).sort((a, b) => b.share - a.share).slice(0, n).map(x => x.r);

export function achievementReward(a, step, config = {}) {
  if (a.feat) return {...FEAT};
  const tier = tierNames(a.steps.length)[step], cfg = config?.achievement?.[tier] || DEFAULT_TIER_REWARD[tier];
  const out = JSON.parse(JSON.stringify(cfg || DEFAULT_TIER_REWARD.bronze));
  // The hard steps (gold and mythic) also give a Collector pack (play-econ-rules.js), unless the config says otherwise.
  if ((tier === 'gold' || tier === 'mythic') && out.collector == null) out.collector = 1;
  return out;
}
export {claimedRef as achievementRef};

// --- Daily and weekly quests ------------------------------------------------------------------
// Two dailies a day (one easy, one harder), picked by the day and the player, plus the first-match
// bonus; three weeklies. Their progress is day- and week-scoped counters (d:<day>:<key>, w:<week>:<key>).
export const DAILY_EASY = [
  {id: 'play3', label: 'Finish 3 matches', key: 'matches', need: 3},
  {id: 'time30', label: 'Spend 30 minutes in matches', key: 'minutes', need: 30},
  {id: 'win1', label: 'Win a match', key: 'wins', need: 1},
  {id: 'story1', label: 'Win a Story battle', key: 'story_wins', need: 1},
];
export const DAILY_HARD = [
  {id: 'win3', label: 'Win 3 matches', key: 'wins', need: 3},
  {id: 'draw-win', label: 'Win on the draw', key: 'wins_draw', need: 1},
  {id: 'fast-win', label: 'Win by turn 8', key: 'wins_t8', need: 1},
  {id: 'healthy-win', label: 'Win with 15 or more life', key: 'wins_healthy', need: 1},
];
export const FIRST_MATCH = {id: 'first', label: 'First match of the day (5+ turns)', key: 'matches5', need: 1};
export const WEEKLY = [
  {id: 'w-wins', label: 'Win 7 matches', key: 'wins', need: 7},
  {id: 'w-matches', label: 'Finish 15 matches', key: 'matches', need: 15},
  {id: 'w-story', label: 'Win 3 Story battles', key: 'story_wins', need: 3},
];

// The player's day: their device's offset, limited to UTC-12..UTC+14, so clock games can't add days.
export function playDay(tzMinutes = 0, now = Date.now()) {
  const tz = Math.max(-720, Math.min(840, Math.round(Number(tzMinutes) || 0)));
  return new Date(now + tz * 60000).toISOString().slice(0, 10);
}
// ISO week of a YYYY-MM-DD day (weeks start Monday), e.g. 2026-W44.
export function playWeek(day) {
  const d = new Date(day + 'T00:00:00Z'), dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow + 3);
  const first = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)), week = 1 + Math.round(((d - first) / 864e5 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
const hash = s => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
export function dailyQuests(day, user = '') {
  const h = hash(day + ':' + user);
  return [{...DAILY_EASY[h % DAILY_EASY.length], level: 'easy'}, {...DAILY_HARD[(h >>> 8) % DAILY_HARD.length], level: 'hard'}, {...FIRST_MATCH, level: 'first'}];
}
export function questRows({counters = {}, claimed = [], day, user = ''} = {}) {
  const got = new Set(claimed), week = playWeek(day);
  const row = (q, scope, ref) => { const have = Number(counters[`${scope}:${q.key}`]) || 0; return {...q, have: Math.min(have, q.need), done: have >= q.need, claimed: got.has(ref), ref}; };
  const daily = dailyQuests(day, user).map(q => row(q, 'd:' + day, `daily:${day}:${q.id}`));
  const weekly = WEEKLY.map(q => row(q, 'w:' + week, `weekly:${week}:${q.id}`));
  return {day, week, daily, weekly, weeklyAll: {done: weekly.every(q => q.done), claimed: got.has(`weekly:${week}:all`), ref: `weekly:${week}:all`}};
}
export function questReward(q, config = {}) {
  const d = config?.daily || {}, w = config?.weekly || {};
  if (q.level === 'first') return {coins: d.firstMatch?.coins ?? 100};
  if (q.level === 'easy') return {coins: d.easy?.coins ?? 250, xp: d.easy?.xp ?? 50};
  if (q.level === 'hard') return {coins: d.hard?.coins ?? 500, xp: d.hard?.xp ?? 100};
  return {packs: w.pack ?? 1, xp: w.xp ?? 250};
}

// --- Log-in calendar --------------------------------------------------------------------------
// Counted by days you log in, not a streak. 7 weekly stamps; the monthly ledger pays on days 7, 14, 21, 28.
export const LOGIN_WEEK = [{coins: 250}, {packs: 1}, {seals: {u: 2}}, {coins: 300, packs: 1}, {seals: {r: 1}}, {packs: 2}, {seals: {m: 1, r: 1}, packs: 2}];
export const LOGIN_MONTH = {7: {coins: 500}, 14: {packs: 3}, 21: {seals: {m: 1}}, 28: {packs: 3}};
export function loginStamp(days) {
  const n = Math.max(1, days | 0), week = (n - 1) % 7, month = ((n - 1) % 28) + 1;
  return {stamp: week + 1, month, reward: LOGIN_WEEK[week], monthReward: LOGIN_MONTH[month] || null};
}
// Merge reward pieces into one play_apply delta; packs become {set, source} rows of the reward set.
export function rewardDelta(parts = [], set = '', source = 'quest') {
  const out = {coins: 0, xp: 0, seals: {}, packs: []};
  for (const p of parts.filter(Boolean)) {
    out.coins += p.coins | 0; out.xp += p.xp | 0;
    for (const [k, v] of Object.entries(p.seals || {})) out.seals[k] = (out.seals[k] || 0) + (v | 0);
    if (set) for (let i = 0; i < (p.packs | 0); i++) out.packs.push({set, source});
    if (set) for (let i = 0; i < (p.collector | 0); i++) out.packs.push({set, source: collectorSource(source)});
  }
  if (!out.coins) delete out.coins; if (!out.xp) delete out.xp; if (!Object.keys(out.seals).length) delete out.seals; if (!out.packs.length) delete out.packs;
  return out;
}

// --- Match reports ----------------------------------------------------------------------------
// One finished match (from the app's match record) becomes counter bumps. Practice is refused;
// friend matches count as played only.
export function matchCounters(m = {}, day, {friendsToday = 0, friendCap = 3} = {}) {
  if (!['win', 'loss', 'draw'].includes(m.outcome) || m.mode === 'practice') return null;
  const week = playWeek(day), friend = m.mode === 'friend', turns = Number.isSafeInteger(m.turns) ? m.turns : 0, life = Number.isSafeInteger(m.life) ? m.life : null;
  const minutes = Math.min(90, Math.max(0, Math.round((Number(m.durationMs) || 0) / 60000)));
  if (friend && friendsToday >= friendCap) return {};
  const c = {matches: 1, minutes};
  if (turns >= 5) c.matches5 = 1;
  if (friend) c.friend_matches = 1;
  if (m.outcome === 'win' && !friend) {
    c.wins = 1;
    if (m.onPlay === false) c.wins_draw = 1;
    if (turns && turns <= 5) c.wins_fast = 1;
    if (turns && turns <= 8) c.wins_t8 = 1;
    if (turns >= 20) c.wins_long = 1;
    if (turns >= 30) c.wins_marathon = 1;
    if (life !== null && life >= 20) c.wins_flawless = 1;
    if (life !== null && life >= 15) c.wins_healthy = 1;
    if (life === 1) c.wins_thread = 1;
    if (m.mode === 'story') c.story_wins = 1;
    const fmt = String(m.format || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30);
    if (fmt) c['fmt:' + fmt] = 1;
  }
  const out = {};
  for (const [k, v] of Object.entries(c)) { if (!v) continue; out[k] = v; if (!k.startsWith('fmt:')) { out[`d:${day}:${k}`] = v; out[`w:${week}:${k}`] = v; } }
  return out;
}
