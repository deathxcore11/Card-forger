// Play quests, achievements and the log-in calendar (play-achievements.js + play-econ-route.js).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchCounters, questRows, loginStamp, rewardDelta, achievementRows, achievementReward, achievementsPayload, deckColours, dailyQuests, weeklyQuests, playDay, playWeek, ACHIEVEMENTS, DEED_TABS} from './play-achievements.js';
import {ACHIEVEMENT_ART, achievementArt} from './play-achievement-art.js';
import {progressRoute} from './play-econ-route.js';
import {resolveServiceURL} from './native-service-policy.js';
// The native app's route inventory admits the achievements read with only ?tz=.
assert.deepEqual([...resolveServiceURL('https://cardstashy.com/api/progress/achievements?tz=-300').methods], ['GET']);
assert.throws(() => resolveServiceURL('https://cardstashy.com/api/progress/achievements?tz=1&x=2'));

// Practice only feeds its own honour counters, never quests; friend wins count as played only; minutes cap at 90.
const practice = matchCounters({outcome: 'win', mode: 'practice', difficulty: 'Hard', format: 'Modern'}, '2026-11-05');
assert.deepEqual(practice, {practice_matches: 1, 'd:2026-11-05:practice_matches': 1, 'pf:Modern': 1, practice_wins_hard: 1});
assert.deepEqual(matchCounters({outcome: 'win', mode: 'practice'}, '2026-11-05', {practiceToday: 30}), {}, '30 practice matches a day');
const friend = matchCounters({outcome: 'win', mode: 'friend', turns: 9, durationMs: 4 * 3600e3}, '2026-11-01');
assert.equal(friend.wins, undefined, 'friend wins never count as wins');
assert.equal(friend.friend_matches, 1);
assert.equal(friend.minutes, 90, 'a match counts at most 90 minutes');
assert.deepEqual(matchCounters({outcome: 'win', mode: 'friend'}, '2026-11-01', {friendsToday: 3}), {}, '3 friend matches a day');
const story = matchCounters({outcome: 'win', mode: 'story', turns: 4, life: 1, onPlay: false, format: 'Vintage'}, '2026-11-01');
for (const k of ['wins', 'wins_fast', 'wins_thread', 'wins_draw', 'story_wins', 'fmt:Vintage', 'd:2026-11-01:wins', 'w:2026-W44:story_wins']) assert.equal(story[k], 1, k);
// The day follows the device, clamped to UTC-12..+14; weeks start Monday.
assert.equal(playDay(-300, Date.parse('2026-11-02T03:00:00Z')), '2026-11-01');
assert.equal(playDay(99999, Date.parse('2026-11-01T00:00:00Z')), '2026-11-01');
assert.equal(playWeek('2026-11-01'), '2026-W44'); assert.equal(playWeek('2026-11-02'), '2026-W45');
// Log-in calendar: counted days (never a streak), 7 stamps; the monthly ledger on day 7.
assert.deepEqual(loginStamp(8).stamp, 1); assert.deepEqual(loginStamp(7).monthReward, {coins: 500});
assert.deepEqual(rewardDelta([{coins: 250}, {packs: 2, seals: {r: 1}}], 'fra', 'login'), {coins: 250, seals: {r: 1}, packs: [{set: 'fra', source: 'login'}, {set: 'fra', source: 'login'}]});
// Quests: two dailies plus the first-match bonus, three weeklies, read from day/week counters.
const q = questRows({counters: {'d:2026-11-01:matches5': 1}, day: '2026-11-01', claimed: []});
assert.equal(q.daily.length, 3); assert.equal(q.weekly.length, 3);
assert.ok(q.daily.find(x => x.id === 'first').done);
// Achievements: every source is something the server counts.
// Match counters (matchCounters), server tallies (open, buy, craft, forge, holo, precon), and state figures.
const SOURCES = new Set(['matches', 'logins', 'minutes', 'wins', 'wins_draw', 'wins_fast', 'wins_flawless', 'wins_long', 'wins_thread', 'wins_marathon', 'fmt', 'story_wins', 'friend_matches', 'cards', 'playsets', 'mythics', 'packs',
  'modes', 'level', 'wins_low', 'wins_overkill', 'wins_quick', 'quick_matches', 'wins_pod', 'fmt:Commander', 'fmt:Standard', 'fmt:Modern', 'fmt:Legacy', 'fmt:Pauper', 'fmt:Old School', '#gp', '#mc', '#tc',
  'story_acts', 'story_villain', 'story_own', '#ff', 'friend_long', 'practice_matches', 'practice_wins_hard', '#pf', 'rares', 'holos', 'trunk_sets', 'decks',
  'packs_collector', 'pulls_mythic', '#po', 'buys', 'crafts', 'forges', 'holos_made', 'precons', 'coins_spent', 'wins_t4', 'draws', 'wins_five', 'packs_god']);
// Story deeds count 'sd:<deed id>', bumped by the deeds route.
for (const a of ACHIEVEMENTS) assert.ok(SOURCES.has(a.source) || /^sd:a\d+-/.test(a.source), a.id + ' counts something the server never sees');
// Every tab has deeds, every id is unique, and no art repeats: one pinned illustration per achievement.
assert.equal(new Set(ACHIEVEMENTS.map(a => a.id)).size, ACHIEVEMENTS.length, 'unique ids');
for (const [tab] of DEED_TABS) assert.ok(ACHIEVEMENTS.some(a => a.tab === tab), tab + ' has deeds');
assert.equal(new Set(ACHIEVEMENTS.map(a => a.art)).size, ACHIEVEMENTS.length, 'no art repeats');
for (const a of ACHIEVEMENTS) assert.ok(ACHIEVEMENT_ART[a.art], a.id + ' has pinned art: ' + a.art);
assert.equal(new Set(Object.values(ACHIEVEMENT_ART).map(r => r[0])).size, Object.keys(ACHIEVEMENT_ART).length, 'one printing per art');
assert.match(achievementArt('Goblin King').url, /^https:\/\/cards\.scryfall\.io\/art_crop\/front\/\w\/\w\/[0-9a-f-]{36}\.jpg$/, 'the CDN, never the rate-limited API');
// Practice deeds are honour only: earned, never claimed or paid.
const drills = achievementRows({counters: {practice_matches: 12}}).find(r => r.id === 'drills');
assert.equal(drills.earned, 1); assert.equal(drills.ready, false); assert.deepEqual(achievementReward(drills, 0), {});
// Tier overrides keep easy chains off mythic seals.
assert.deepEqual(achievementReward(ACHIEVEMENTS.find(a => a.id === 'overkill'), 1), {seals: {r: 1}, xp: 250});
// Colours come from basic lands; the colour deeds count different pairs, monos and triples.
assert.equal(deckColours([{name: 'Forest', qty: 8}, {name: 'Snow-Covered Island', qty: 8}, {name: 'Mountain', board: 'side'}]), 'UG');
const pair = matchCounters({outcome: 'win', mode: 'quick', colors: 'GU', seats: 4, life: 3, opponentLife: -7, turns: 13}, '2026-11-05');
for (const k of ['gp:UG', 'wins_2c', 'wins_quick', 'wins_pod', 'wins_low', 'wins_overkill', 'wins_t12', 'quick_matches']) assert.equal(pair[k], 1, k);
assert.equal(pair['d:2026-11-05:gp:UG'], undefined, 'distinct keys are lifetime only');
// Story figures come from Story refs: an act counts once all 8 battles are cleared.
const refs = [...Array.from({length: 8}, (_, i) => `story:a1b${i + 1}:clear`), 'story:a2b1:clear', 'story:a1b3:villain', 'story:a1b4:own'];
const st = achievementRows({state: {story: refs}});
assert.equal(st.find(r => r.id === 'acts-cleared').value, 1); assert.equal(st.find(r => r.id === 'villain-side').value, 1); assert.equal(st.find(r => r.id === 'own-deck').value, 1);
// Quests: this week and today keep the first pools; later days and weeks draw from the bigger pools.
assert.ok(dailyQuests('2026-11-03').every(q => ['play3', 'time30', 'win1', 'story1', 'win3', 'draw-win', 'fast-win', 'healthy-win', 'first'].includes(q.id)));
assert.deepEqual(weeklyQuests('2026-W45').map(q => q.id), ['w-wins', 'w-matches', 'w-story']);
const weeks = Array.from({length: 12}, (_, i) => weeklyQuests(`2026-W${46 + i}`));
for (const w of weeks) assert.equal(new Set(w.map(q => q.id)).size, 3, 'three different weeklies');
assert.ok(new Set(weeks.flat().map(q => q.id)).size > 3, 'weeklies rotate');
// The payload the native app reads: hidden deeds stay riddles, every shown deed carries its art and rewards.
const pay = achievementsPayload({counters: {}, claimed: [], state: {}, day: '2026-11-05'}, {});
assert.equal(pay.achievements.length, ACHIEVEMENTS.length);
const secret = pay.achievements.find(a => a.id === 'by-a-thread');
assert.equal(secret.title, null); assert.equal(secret.art, null); assert.ok(secret.riddle);
assert.ok(pay.achievements.find(a => a.id === 'victor').art.url.startsWith('https://cards.scryfall.io/'));
assert.ok(pay.achievements.find(a => a.id === 'victor').steps[0].reward.seals);
assert.equal(pay.quests.daily.length, 3); assert.equal(pay.quests.weekly.length, 3);
assert.ok(achievementRows({state: {wallet: {packs_opened: 12}}}).find(r => r.id === 'pack-rat').ready);

// Routes: log-in stamps once a day, a match bumps counters once, a claim re-checks and pays once.
{
  const config = JSON.parse(readFileSync('data/play-economy.json', 'utf8'));
  let counters = {}, ledger = new Set(), calls = [];
  const fetcher = async (url, init = {}) => {
    const u = String(url);
    if (u.includes('/rest/v1/rpc/')) {
      const name = u.split('/rpc/')[1], a = JSON.parse(init.body); calls.push([name, a]);
      if (name === 'play_state') return new Response(JSON.stringify({config, wallet: {coins: 0, starter_at: 'x', packs_opened: 0}, packs: [], cards: [], decks: []}));
      if (name === 'play_counters') return new Response(JSON.stringify(counters));
      if (name === 'play_claims') return new Response(JSON.stringify([...ledger].filter(r => /^(ach|daily|weekly):/.test(r))));
      if (name === 'play_bump') { if (ledger.has(a.p_ref)) return new Response(JSON.stringify({duplicate: true, counters})); ledger.add(a.p_ref); for (const [k, v] of Object.entries(a.p_counters)) counters[k] = (counters[k] || 0) + v; return new Response(JSON.stringify({duplicate: false, counters})); }
      if (name === 'play_apply') { if (ledger.has(a.p_ref)) return new Response(JSON.stringify({duplicate: true})); ledger.add(a.p_ref); return new Response(JSON.stringify({})); }
    }
    if (u.includes('/forge-rules/')) return new Response(JSON.stringify({standardSets: []}));
    if (u.includes('index.json')) return new Response(JSON.stringify({sets: {}}));
    if (u.includes('/sets')) return new Response(JSON.stringify({data: []}));
    return new Response('nf', {status: 404});
  };
  const env = {SUPABASE_SERVICE_KEY: 'sb_secret_test', SUPABASE_URL: 'https://example.supabase.co'};
  const verifyBearer = async () => ({id: 'u1'});
  const post = async (path, body) => { const r = await progressRoute(new Request('https://cardstashy.com/api/progress/' + path, {method: 'POST', headers: {Authorization: 'Bearer ok'}, body: JSON.stringify(body)}), env, {verifyBearer, fetcher}); return [r.status, await r.json()]; };
  const [, l1] = await post('login', {tz: 0}), [, l2] = await post('login', {tz: 0});
  assert.equal(l1.login.fresh, true); assert.equal(l2.login.fresh, false, 'one stamp a day');
  assert.equal(calls.filter(c => c[0] === 'play_apply' && /^loginpay:/.test(c[1].p_ref)).length, 1);
  const [s1, m1] = await post('match', {id: 'match-0001', mode: 'quick', outcome: 'win', turns: 6, durationMs: 600000, tz: 0});
  assert.equal(s1, 200); assert.equal(m1.counted, true);
  assert.equal((await post('match', {id: 'match-0001', mode: 'quick', outcome: 'win', tz: 0}))[1].counted, false, 'a match counts once');
  const [, pm] = await post('match', {id: 'match-0002', mode: 'practice', outcome: 'win', tz: 0});
  assert.equal(pm.counters.practice_matches, 1); assert.equal(pm.counters.wins, 1, 'Practice never moves wins or quests');
  const r = await progressRoute(new Request('https://cardstashy.com/api/progress/achievements?tz=0', {headers: {Authorization: 'Bearer ok'}}), env, {verifyBearer, fetcher});
  const got = await r.json();
  assert.equal(r.status, 200); assert.equal(got.version, 2); assert.ok(got.achievements.find(a => a.id === 'first-spark').ready);
  assert.equal((await post('claim', {kind: 'ach', id: 'victor', step: 0}))[0], 409, '1 win is not 10');
  const [c1, paid] = await post('claim', {kind: 'ach', id: 'first-spark', step: 0});
  assert.equal(c1, 200); assert.equal(paid.ref, 'ach:first-spark:0');
  assert.equal((await post('claim', {kind: 'ach', id: 'first-spark', step: 0}))[0], 409, 'paid once');
  // The day's one free quest swap: easy or hard, never twice a day, never a done quest.
  const day = playDay(0), before = questRows({counters, claimed: [], day}).daily;
  assert.ok(before.find(q => q.level === 'easy').canSwap && !before.find(q => q.level === 'first').canSwap, 'easy and hard can swap, the first-match quest cannot');
  assert.equal((await post('reroll', {level: 'first', tz: 0}))[0], 400);
  const [r1, sw] = await post('reroll', {level: 'hard', tz: 0});
  assert.equal(r1, 200);
  const after = questRows({counters: sw.counters, claimed: [], day}).daily;
  assert.notEqual(after.find(q => q.level === 'hard').id, before.find(q => q.level === 'hard').id, 'a different quest');
  assert.equal(after.find(q => q.level === 'easy').id, before.find(q => q.level === 'easy').id, 'the other one stays');
  assert.ok(after.every(q => !q.canSwap), 'one swap a day');
  assert.equal((await post('reroll', {level: 'easy', tz: 0}))[0], 409, 'no second swap today');
}
for (const day of ['2026-11-05', '2026-11-20', '2026-12-31']) for (const level of ['easy', 'hard']) {
  const a = dailyQuests(day).find(q => q.level === level), b = dailyQuests(day, '', {[`d:${day}:reroll_${level}`]: 1}).find(q => q.level === level);
  assert.notEqual(a.id, b.id, `${day} ${level}: the swap is a different quest`); assert.equal(b.level, level);
}
console.log('play achievements ok');
