// Live achievement toasts (play-achievement-toasts.js) and rich presence (play-presence.js).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {doneSteps, newlyEarned, rewardLines, TOAST_FEEL, toastMarkup} from './play-achievement-toasts.js';
import {presenceActivity, presenceLine, createPresence, PRESENCE_TIMING} from './play-presence.js';
import {PACK_PATTERNS, PATTERNS} from './feel.js';

// Toasts: only steps that became done since the last server state, never the ones already done.
const before = {counters: {matches: 1, forges: 2}, claimed: []};
const after = {counters: {matches: 1, forges: 3, wins_fast: 1, wins_thread: 1}, claimed: []};
const seen = doneSteps(before);
assert.ok(seen.has('first-spark:0'));
const fresh = newlyEarned(seen, after);
const ids = fresh.map(t => `${t.id}:${t.step}`);
assert.ok(ids.includes('forgemaster:0') && ids.includes('swift-justice:0') && ids.includes('by-a-thread:0'), ids.join());
assert.ok(!ids.includes('first-spark:0'), 'an old deed never toasts again');
const forge = fresh.find(t => t.id === 'forgemaster'), thread = fresh.find(t => t.id === 'by-a-thread'), swift = fresh.find(t => t.id === 'swift-justice');
assert.equal(forge.tier, 'bronze');
assert.match(forge.line, /^Tier 1 of 3 · 3$/);
assert.equal(thread.tier, 'hidden');
assert.equal(thread.line, 'One breath stands between you and the grave.', 'a hidden feat shows the riddle it answered');
assert.equal(swift.tier, 'feat');
assert.deepEqual(newlyEarned(null, after), [], 'no baseline, no toasts');
assert.deepEqual(newlyEarned(doneSteps(after), after), []);
// Claiming does not make a deed new again.
assert.deepEqual(newlyEarned(doneSteps(after), {...after, claimed: ['ach:forgemaster:0']}), []);
// Practice honour deeds toast too, with no reward.
const honour = newlyEarned(doneSteps({counters: {}}), {counters: {practice_matches: 50, practice_wins_hard: 50}}).filter(t => t.tier === 'honour');
assert.ok(honour.length > 0 && honour.every(t => !rewardLines(t.reward).length));

// Rewards read from achievementReward(), at most two lines.
assert.deepEqual(rewardLines({xp: 500, seals: {m: 1}, collector: 1}), ['+500 XP', '1 mythic seal']);
assert.deepEqual(rewardLines({coins: 300, packs: 1, xp: 100}), ['+100 XP', '300 coins']);
assert.deepEqual(rewardLines({}), []);
// Every haptic the toasts use already exists in feel.js.
for (const f of Object.values(TOAST_FEEL)) assert.ok(PACK_PATTERNS[f.haptic] || PATTERNS[f.haptic], f.haptic);
assert.ok(PATTERNS.tick);
// Markup escapes and carries the +N chip only when asked.
const m = toastMarkup({...forge, title: '<b>x</b>'}, 2);
assert.ok(m.includes('&lt;b&gt;x&lt;/b&gt;') && m.includes('ach-toast-more">+2<'));
assert.ok(!toastMarkup(forge, 0).includes('ach-toast-more'));
// No gold frame: the pill's border is a hairline; only the art ring glows in the tier colour.
const css = readFileSync('play-menu.css', 'utf8');
assert.match(css, /\.ach-toast\{[^}]*border:1px solid #ffffff17/);
assert.match(css, /\.ach-toast-art\{[^}]*box-shadow:0 0 0 2px var\(--tc\)/);

// Presence lines come from real app state.
assert.deepEqual(presenceActivity({match: {kind: 'story', act: 12, battle: 'The Kami Are Coming', turn: 5}}), {mode: 'story', label: 'Story · Act 12 · The Kami Are Coming · turn 5', turn: 5});
assert.deepEqual(presenceActivity({match: {kind: 'quick', format: 'Pauper', turn: 7}}), {mode: 'quick', label: 'Quick Play · Pauper · turn 7', turn: 7});
assert.deepEqual(presenceActivity({match: {kind: 'friend', format: 'Commander', turn: 0}}), {mode: 'friend', label: 'Multiplayer · Commander', turn: null});
assert.deepEqual(presenceActivity({view: 'play', playView: 'shop'}), {mode: 'merchant', label: 'At the Merchant', turn: null});
assert.deepEqual(presenceActivity({view: 'collection'}), {mode: 'app', label: 'In CardStashy', turn: null});
assert.ok(presenceActivity({match: {kind: 'story', act: 1, battle: 'x'.repeat(200)}}).label.length <= 80);
assert.ok(!/[<>]/.test(presenceActivity({match: {kind: 'quick', format: '<img>'}}).label));
const now = Date.parse('2026-11-04T02:00:00Z');
assert.deepEqual(presenceLine({online: true, mode: 'quick', label: 'Quick Play · Pauper · turn 7'}, now), {online: true, inMatch: true, text: 'Quick Play · Pauper · turn 7'});
assert.deepEqual(presenceLine({online: true, mode: 'lobby', label: 'In the Play lobby'}, now), {online: true, inMatch: false, text: 'In the Play lobby'});
assert.equal(presenceLine({online: false, at: '2026-11-04T00:00:00Z'}, now).text, 'Last seen 2 h ago');
assert.equal(presenceLine(null).text, '');

// The sender: a change beats at most every 15s, the same screen every 60s, nothing while hidden or off.
let t = 0, sent = [], act = {view: 'play', playView: 'home'}, on = true;
const doc = {visibilityState: 'visible', addEventListener() {}};
const p = createPresence({read: () => act, send: (a, x) => sent.push([a, x.label]), enabled: () => on, now: () => t, doc});
p.poke(); assert.equal(sent.length, 1);
t = 5000; p.poke(); assert.equal(sent.length, 1, 'same screen, no beat');
act = {view: 'play', playView: 'shop'}; t = 10000; p.poke(); assert.equal(sent.length, 1, 'too soon after the last beat');
t = PRESENCE_TIMING.minGapMs; p.poke(); assert.equal(sent.length, 2); assert.equal(sent[1][1], 'At the Merchant');
t += PRESENCE_TIMING.beatMs; p.poke(); assert.equal(sent.length, 3, 'heartbeat');
doc.visibilityState = 'hidden'; t += PRESENCE_TIMING.beatMs; p.poke(); assert.equal(sent.length, 3, 'background sends nothing');
doc.visibilityState = 'visible'; on = false; t += PRESENCE_TIMING.beatMs; p.poke(); assert.equal(sent.length, 3, 'switched off sends nothing');

// The server keeps presence to accepted friends, honours blocks and the switch.
const sql = readFileSync('supabase/migrations/20261104013000_community_presence.sql', 'utf8');
assert.match(sql, /f\.status = 'accepted'\s+and x\.share/);
assert.match(sql, /community_private\s*\.blocks/);
assert.match(sql, /revoke all\s+on community_private\.presence\s+from public, anon, authenticated/);
console.log('live toasts and presence ok');
