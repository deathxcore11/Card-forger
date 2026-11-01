// Play quests, achievements and the log-in calendar (play-achievements.js + play-econ-route.js).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {matchCounters, questRows, loginStamp, rewardDelta, achievementRows, playDay, playWeek, ACHIEVEMENTS} from './play-achievements.js';
import {progressRoute} from './play-econ-route.js';

// Practice never counts; friend wins count as played only; minutes cap at 90.
assert.equal(matchCounters({outcome: 'win', mode: 'practice'}, '2026-11-01'), null);
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
const SOURCES = new Set(['matches', 'logins', 'minutes', 'wins', 'wins_draw', 'wins_fast', 'wins_flawless', 'wins_long', 'wins_thread', 'wins_marathon', 'fmt', 'story_wins', 'friend_matches', 'cards', 'playsets', 'mythics', 'packs']);
// Story deeds count 'sd:<deed id>', bumped by the deeds route.
for (const a of ACHIEVEMENTS) assert.ok(SOURCES.has(a.source) || /^sd:a\d+-/.test(a.source), a.id + ' counts something the server never sees');
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
  assert.equal((await post('match', {id: 'match-0002', mode: 'practice', outcome: 'win', tz: 0}))[0], 400, 'Practice never counts');
  assert.equal((await post('claim', {kind: 'ach', id: 'victor', step: 0}))[0], 409, '1 win is not 10');
  const [c1, paid] = await post('claim', {kind: 'ach', id: 'first-spark', step: 0});
  assert.equal(c1, 200); assert.equal(paid.ref, 'ach:first-spark:0');
  assert.equal((await post('claim', {kind: 'ach', id: 'first-spark', step: 0}))[0], 409, 'paid once');
}
console.log('play achievements ok');
