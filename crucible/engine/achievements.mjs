// Lost Memories achievements (codename crucible): the rows the owner approved on 22 November 2026 (sixty in seven
// groups, four more hidden rows behind the Rumours switch and four metas, 68 in all) and pure functions that judge
// them from the profile, the run and the duel in progress. No clocks and no randomness: the profile keeps the order
// rows were earned in (p.ach) and the number of the run each one was earned in (p.achAt).
//   achList(db)                         the rows open under this config, as plain data
//   achCheck(db, p, run)                ids newly earned; they are written to p.ach and p.achAt
//   achProgress(db, p, run)             { id, have, goal, done } for each row shown that counts up
//   achView(db, p, run)                 every row shown (open, or already earned) with what the page shows for it
//   achRunApply(run, a, db, p, opts)    runApply, then achCheck; each new id joins the events as { e: 'ach', id }
// Only a run begun with track (newRun option; run.ach) counts. A row that reads the profile also counts what the run
// in progress has added so far, so it can be earned the moment it happens rather than when the run is banked. Once
// applyRun has banked the run (it marks run.ach.banked; a uid in p.banked counts too) its numbers live in the profile
// and are not counted again. A tracked run saved by a build before run.ach existed starts keeping facts at its next
// achRunApply (run.ach.late): what came before is unknown, so rows that need the whole run to have gone a certain way
// (Owed Nothing, Every Seam Held) are not earned from it. An older profile reads descents and forged as zero.
import { runApply, BOSSES } from './run.mjs';
import { VAULT, FORGER_FEATS, scoreRun } from './meta.mjs';
import { FORGER_IDS } from './forgers.mjs';
import { codexResult } from './cards.mjs';

export const ACH_GROUPS = [
  { id: 'asterhold', name: 'Beneath Asterhold' }, { id: 'heat', name: 'The Heat' }, { id: 'guardians', name: 'Guardians' },
  { id: 'codex', name: 'The Codex' }, { id: 'forge', name: 'Forge and Vault' }, { id: 'duelcraft', name: 'Duelcraft' },
  { id: 'rumours', name: 'Rumours' }, { id: 'meta', name: 'Meta achievements' },
];
// The app's reward tiers as the approved list states them. The app pays them; the game only says which row was earned.
export const ACH_TIERS = {
  xp: { name: 'XP', points: 5, pays: '100 XP' },
  common: { name: 'Common', points: 10, pays: '100 coins, 100 XP, 1 common seal' },
  uncommon: { name: 'Uncommon', points: 20, pays: '200 coins, 150 XP, 1 uncommon seal' },
  feat: { name: 'Feat', points: 50, pays: '300 coins, 1 pack, 100 XP' },
  hidden: { name: 'Hidden', points: 25, pays: '500 coins, 1 Collector pack, 250 XP, 1 rare seal' },
  meta: { name: 'Meta', points: 50, pays: '500 coins, 250 XP, 1 rare seal and a title' },
};

// ---------- what the rows read ----------
const FOUR = FORGER_IDS; // Tarn, the Scrapper, the Veilwalker and the Stormcaller; the hidden Forger is not one of the four
const pairOf = floor => BOSSES[floor].map(b => b.id);
const anyDuel = (c, f) => c.duels.some(f);
const bossWin = (c, id, f) => c.duels.some(d => d.w && d.boss === id && f(d));
const secretDuel = (c, won) => c.duels.some(d => d.tier === 'secret' && !!d.w === won);
const sum = (list, f) => list.reduce((n, x) => n + (f(x) || 0), 0);

// The Codex pages a list of keys has found: the distinct results. Kept per list and grown as the list grows, because a
// profile's Codex only ever gains keys at its end and is read after every action.
const PAGES = new WeakMap();
function pageIds(db, keys) {
  if (!Array.isArray(keys) || !keys.length) return new Set();
  let byDb = PAGES.get(db); if (!byDb) PAGES.set(db, byDb = new WeakMap());
  let m = byDb.get(keys);
  if (!m || m.n > keys.length) m = { n: 0, ids: new Set() };
  for (; m.n < keys.length; m.n++) { const r = codexResult(db, keys[m.n]); if (r) m.ids.add(r.id); }
  byDb.set(keys, m);
  return m.ids;
}

// Everything a row may read, worked out once for each check. run: the run, only when it was begun with track. add: its
// numbers are not in the profile yet (it is in progress, or over and not banked). Profile numbers below already
// include what the run adds. duels: the facts of each finished duel of the run (run.mjs achFacts). live: the player's
// side of the duel in progress, read only by rows that something done earns, never by a row that needs nothing to happen.
function context(db, p, run0) {
  const run = run0 && run0.ach ? run0 : null;
  const banked = !!(run && (run.ach.banked || (run.uid && (p.banked || []).includes(run.uid))));
  const add = !!run && !banked, over = !!run && run.phase === 'over', won = over && !!(run.result && run.result.won);
  const S = run ? run.stats : null;
  const c = {
    db, p, run, add, over, won,
    duels: run ? run.ach.duels : [], live: run && run.phase === 'duel' && run.duel ? run.duel.stats[0] : null,
    duelWins: (p.duelWins || 0) + (add ? S.wins : 0),
    bossWins: (p.bossWins || 0) + (add ? S.bossWins : 0),
    clears: (p.clears || 0) + (add && won ? 1 : 0),
    runs: (p.runs || 0) + (add && over ? 1 : 0),
    heatCleared: Math.max(p.heatCleared ?? -1, add && won ? run.heat || 0 : -1),
    descents: (p.descents || 0) + (add && over && (run.ach.reached || S.duels >= 1) ? 1 : 0),
    forged: (p.forged || 0) + (add ? run.masterworks.length : 0),
    lastOne: (p.lastOne || 0) + (add && run.secret && run.secret.won ? 1 : 0),
    bestFloor: Math.max(p.bestFloor || 0, add ? (won ? 3 : run.floor) : 0),
    beaten: new Set([...(p.beaten || []), ...(run ? run.ach.beaten : [])]),
    // The door that was not there was shown: dealt once the lone guardian's reward was taken (meta.mjs applyRun).
    doorFound: !!(p.doorFound ?? p.loneMet) || !!(run && run.secret && run.secret.met && !run.secret.due),
  };
  // One Forger's record: duels won, clears and the highest Heat cleared, with this run counted.
  c.forger = f => {
    const r = (p.byForger || {})[f] || {}, mine = add && run.forger === f;
    return { wins: (r.wins || 0) + (mine ? S.wins : 0), clears: (r.clears || 0) + (mine && won ? 1 : 0), heat: Math.max(r.heat ?? -1, mine && won ? run.heat || 0 : -1) };
  };
  // Memories earned over all runs, with what this run pays once it is over. Worked out only when a row asks.
  let earned = null;
  c.earned = () => earned ?? (earned = (p.earned || 0) + (add && over ? scoreRun(p, run).total : 0));
  // Codex pages found: written when a duel ends, so a meld made in the duel in progress is not a page yet.
  let pages = null;
  c.pages = () => {
    if (pages != null) return pages;
    const ids = new Set(pageIds(db, p.codex));
    for (const k of run ? run.codex : []) { const r = codexResult(db, k); if (r) ids.add(r.id); }
    return (pages = ids.size);
  };
  // The most cards in one play in which every card fused, in this run so far.
  c.fuse = () => Math.max(0, ...c.duels.map(d => d.longestFuse || 0), (c.live && c.live.ach && c.live.ach.longestFuse) || 0);
  return c;
}

// ---------- the rows ----------
// id: stable, never reused. name, how and hint: the approved words. hidden rows show only their hint until earned.
// needs 'secret': only while the Rumours switch is on (config secretLast). goal and have: a row that counts up.
// test: earned now. parts and title: a meta, judged after the other rows.
const R = (id, name, group, tier, how, o = {}) => ({ id, name, group, tier, hidden: tier === 'hidden', how, ...o, test: o.test || (o.goal ? c => o.have(c) >= o.goal : null) });
const W = d => !!d.w;

export const ACH = [
  // Beneath Asterhold
  R('hammer_finds_its_weight', 'Hammer Finds Its Weight', 'asterhold', 'xp', 'Win your first duel.', { test: c => c.duelWins >= 1 }),
  R('the_door_unsealed', 'The Door Unsealed', 'asterhold', 'xp', "Win two duels on one floor to break the guardian door's seals, then go through it.", { test: c => !!(c.run && c.run.ach.bossDoor) }),
  R('ten_times_down', 'Ten Times Down', 'asterhold', 'xp', 'Finish 10 descents that reached at least one duel, whether you won, lost or left.', { goal: 10, have: c => c.descents }),
  R('worn_handle', 'Worn Handle', 'asterhold', 'xp', 'Win 50 duels.', { goal: 50, have: c => c.duelWins }),
  R('paid_to_look', 'Paid to Look', 'asterhold', 'xp', 'At an Omen altar, pay 30 Embers to see its card, then leave without trading.', { test: c => !!(c.run && c.run.ach.omenLook) }),
  R('the_hammer_remembers', 'The Hammer Remembers', 'asterhold', 'common', 'Win 250 duels.', { goal: 250, have: c => c.duelWins }),
  R('on_one_spark', 'On One Spark', 'asterhold', 'common', 'Clear the pyramid with exactly one Spark left.', { test: c => c.won && c.run.sparks === 1 }),
  R('room_over_warmth', 'Room Over Warmth', 'asterhold', 'common', 'At a Sanctum on your last Spark, raise your weight cap instead of taking back a Spark.', { test: c => !!(c.run && c.run.ach.capOnLast) }),
  R('a_hammer_like_yours', 'A Hammer Like Yours', 'asterhold', 'uncommon', 'Clear the pyramid for the first time.', { test: c => c.clears >= 1 }),
  R('owed_nothing', 'Owed Nothing', 'asterhold', 'feat', 'Clear the pyramid after turning down every Gift the forge offered.', { test: c => c.won && !c.run.ach.late && c.run.ach.gifts === 0 && c.run.ach.giftSkips >= 1 }),
  R('every_spark_home', 'Every Spark Home', 'asterhold', 'hidden', 'Clear the pyramid without losing a single duel.', { hint: 'The dark took not one light from you.', test: c => c.won && c.run.stats.losses === 0 }),
  // The Heat
  R('one_coal_hotter', 'One Coal Hotter', 'heat', 'xp', 'Clear the pyramid at Heat 1 or higher.', { test: c => c.heatCleared >= 1 }),
  R('iron_glows_red', 'Iron Glows Red', 'heat', 'common', 'Clear the pyramid at Heat 3 or higher.', { test: c => c.heatCleared >= 3 }),
  R('the_fire_climbs', 'The Fire Climbs', 'heat', 'uncommon', 'Clear the pyramid at Heat 5 or higher.', { test: c => c.heatCleared >= 5 }),
  R('ten_coals_hotter', 'Ten Coals Hotter', 'heat', 'feat', 'Clear the pyramid at Heat 10, which means beating both third-floor guardians in one run.', { test: c => c.heatCleared >= 10 }),
  R('same_fire_every_hand', 'Same Fire, Every Hand', 'heat', 'feat', 'Clear Heat 5 or higher with each of Tarn, the Scrapper, the Veilwalker and the Stormcaller.', { goal: 4, have: c => FOUR.filter(f => c.forger(f).heat >= 5).length }),
  // Guardians
  R('kiln_and_stone', 'Kiln and Stone', 'guardians', 'xp', 'Beat both first-floor guardians, The Kiln Warden and The Stone Sentinel, over any number of runs.', { goal: 2, have: c => pairOf(0).filter(id => c.beaten.has(id)).length }),
  R('a_score_of_keepers', 'A Score of Keepers', 'guardians', 'xp', 'Beat 20 floor guardians in all.', { goal: 20, have: c => c.bossWins }),
  R('bone_and_veil', 'Bone and Veil', 'guardians', 'common', 'Beat both second-floor guardians, The Bone Collector and The Veiled Magus, over any number of runs.', { goal: 2, have: c => pairOf(1).filter(id => c.beaten.has(id)).length }),
  R('tyrant_and_gate', 'Tyrant and Gate', 'guardians', 'common', 'Beat both third-floor guardians, The White Tyrant and The Last Gate, over any number of runs.', { goal: 2, have: c => pairOf(2).filter(id => c.beaten.has(id)).length }),
  R('ground_that_lasts', 'Ground That Lasts', 'guardians', 'common', "Beat The Kiln Warden after laying ground of your own in that duel, with a Field Spell or the Stormcaller's Landfall.", { test: c => bossWin(c, 'kiln_warden', d => d.grounds >= 1) }),
  R('stone_against_stone', 'Stone Against Stone', 'guardians', 'common', 'Beat The Stone Sentinel in a duel where one of your defenders beats one of her attackers.', { test: c => bossWin(c, 'stone_sentinel', d => d.defWins >= 1) }),
  R('veil_against_veil', 'Veil Against Veil', 'guardians', 'common', 'Beat The Veiled Magus with one of your own monsters still veiled on your side.', { test: c => bossWin(c, 'veiled_magus', d => !!d.veiled) }),
  R('four_is_enough', 'Four Is Enough', 'guardians', 'common', 'Beat The White Tyrant after making a meld of four or more cards in that duel.', { test: c => bossWin(c, 'white_tyrant', d => d.chain >= 4) }),
  R('nothing_to_collect', 'Nothing to Collect', 'guardians', 'uncommon', 'Beat The Bone Collector without his Blood price ever paying him a Life Point.', { test: c => bossWin(c, 'bone_collector', d => d.c === 1 && d.lawPaid === 0) }),
  R('the_gate_stays_shut', 'The Gate Stays Shut', 'guardians', 'uncommon', 'Beat The Last Gate before his Law brings his ace onto the table.', { test: c => bossWin(c, 'last_gate', d => !d.aceCame) }),
  R('an_answer_held', 'An Answer Held', 'guardians', 'feat', 'Beat The Last Gate after destroying the 5,000 ATK ace his Law brings through.', { test: c => bossWin(c, 'last_gate', d => d.aceDown >= 1) }),
  // The Codex
  R('ink_on_the_page', 'Ink on the Page', 'codex', 'xp', 'Write your first meld into the Codex.', { test: c => c.pages() >= 1 }),
  R('margins_filling', 'Margins Filling', 'codex', 'xp', 'Find 25 pages in the Codex.', { goal: 25, have: c => c.pages() }),
  R('written_before_you', 'Written Before You', 'codex', 'common', 'Make a printed fusion, a meld that only its named materials can make.', { test: c => anyDuel(c, d => d.printed >= 1) || !!(c.live && c.live.newMelds.some(m => m[3] === 'printed')) }),
  R('the_codex_grows', 'The Codex Grows', 'codex', 'common', 'Find 75 pages in the Codex.', { goal: 75, have: c => c.pages() }),
  R('a_heavy_codex', 'A Heavy Codex', 'codex', 'uncommon', 'Find 150 pages in the Codex.', { goal: 150, have: c => c.pages() }),
  R('fivefold_weld', 'Fivefold Weld', 'codex', 'uncommon', 'Make a single meld of five cards in which every card fuses.', { test: c => c.fuse() >= 5 }),
  R('every_seam_held', 'Every Seam Held', 'codex', 'feat', 'Clear the pyramid with at least 20 fusions and not one fizzle.', { test: c => c.won && !c.run.ach.late && c.run.stats.fizzles === 0 && !c.duels.some(d => d.steady) && sum(c.duels, d => d.fusions) >= 20 }),
  R('the_long_seam', 'The Long Seam', 'codex', 'hidden', 'Make a single meld of six or more cards in which every card fuses.', { hint: 'The seam ran longer than any hand should allow.', test: c => c.fuse() >= 6 }),
  // Forge and Vault
  R('paid_in_memories', 'Paid in Memories', 'forge', 'xp', 'Buy anything in the Memory Vault.', { test: c => (c.p.bought || []).length >= 1 }),
  R('the_whole_smithy', 'The Whole Smithy', 'forge', 'xp', 'Unlock the Scrapper, the Veilwalker and the Stormcaller.', { goal: 3, have: c => { const pp = { ...c.p, runs: c.runs, bossWins: c.bossWins, bestFloor: c.bestFloor, lastOne: c.lastOne }; return ['scrapper', 'veil', 'storm'].filter(f => (c.p.forgers || []).includes(f) || FORGER_FEATS[f].test(pp)).length; } }),
  R('another_set_of_tongs', 'Another Set of Tongs', 'forge', 'xp', 'Win 10 duels as one Forger.', { goal: 10, have: c => Math.max(0, ...Object.keys(FORGER_FEATS).map(f => c.forger(f).wins)) }),
  R('heavy_with_memory', 'Heavy With Memory', 'forge', 'xp', 'Earn 1,000 Memories over all your runs.', { goal: 1000, have: c => c.earned() }),
  R('joined_at_the_anvil', 'Joined at the Anvil', 'forge', 'xp', "Forge any Masterwork, at an Anvil or as a guardian's reward.", { test: c => c.forged >= 1 || !!(c.run && c.run.masterworks.length) }),
  R('thrice_worked', 'Thrice Worked', 'forge', 'common', 'In one run, bind a meld at one Anvil, then temper it and enchant it at later Anvils.', { test: c => !!c.run && c.run.deck.concat(c.run.trunk).some(e => e.b && e.t && e.e) }),
  R('bare_shelves', 'Bare Shelves', 'forge', 'uncommon', 'Buy all nine relics in the Memory Vault.', { goal: VAULT.length, have: c => VAULT.filter(v => (c.p.bought || []).includes(v.id)).length }),
  R('two_fires_one_anvil', 'Two Fires, One Anvil', 'forge', 'uncommon', 'Forge two Masterworks in the same run.', { test: c => !!c.run && c.run.masterworks.length >= 2 }),
  R('the_full_rack', 'The Full Rack', 'forge', 'uncommon', 'Win 30 duels as each of Tarn, the Scrapper, the Veilwalker and the Stormcaller.', { goal: 30 * FOUR.length, have: c => sum(FOUR, f => Math.min(30, c.forger(f).wins)) }),
  R('four_hands_one_forge', 'Four Hands, One Forge', 'forge', 'feat', 'Clear the pyramid once with each of Tarn, the Scrapper, the Veilwalker and the Stormcaller.', { goal: FOUR.length, have: c => FOUR.filter(f => c.forger(f).clears >= 1).length }),
  // Duelcraft
  R('struck_true', 'Struck True', 'duelcraft', 'xp', 'Earn an S rank in a duel.', { test: c => anyDuel(c, d => W(d) && d.rank === 'S') }),
  R('the_elements_agree', 'The Elements Agree', 'duelcraft', 'xp', 'Destroy a monster in battle that your attacker beat only because of the +500 Attribute edge.', { test: c => anyDuel(c, d => d.edgeKills >= 1) || !!(c.live && c.live.ach && c.live.ach.edgeKills >= 1) }),
  R('the_forge_finishes', 'The Forge Finishes', 'duelcraft', 'xp', "Take a rival's last Life Points with damage from one of your relics.", { test: c => anyDuel(c, d => W(d) && d.relicFinish === 1) }),
  R('three_hearths', 'Three Hearths', 'duelcraft', 'common', 'Win a duel in which relics from three different builds all fire.', { test: c => anyDuel(c, d => W(d) && d.fams >= 3) }),
  R('hall_of_teeth', 'Hall of Teeth', 'duelcraft', 'common', 'Win a duel after springing three of your own Traps in it.', { test: c => anyDuel(c, d => W(d) && d.traps >= 3) }),
  R('not_a_mark', 'Not a Mark', 'duelcraft', 'feat', 'Beat a floor guardian without losing a single Life Point.', { test: c => anyDuel(c, d => W(d) && d.tier === 'boss' && d.c === 1 && d.lpLost === 0) }),
  R('bare_iron', 'Bare Iron', 'duelcraft', 'feat', 'Beat a floor guardian without fusing two cards in that duel. Equips and failed tries are allowed.', { test: c => anyDuel(c, d => W(d) && d.tier === 'boss' && d.c === 1 && d.fusions === 0) }),
  R('taller_than_the_gate', 'Taller Than the Gate', 'duelcraft', 'feat', 'Win a duel with a monster of 5,000 ATK or more on your side.', { test: c => anyDuel(c, d => W(d) && d.top >= 5000) }),
  R('the_well_runs_dry', 'The Well Runs Dry', 'duelcraft', 'hidden', "Win a duel because your rival's deck ran out of cards.", { hint: 'They reached for one more memory and found none.', test: c => anyDuel(c, d => W(d) && d.reason === 'deckout') }),
  R('they_came_to_you', 'They Came to You', 'duelcraft', 'hidden', 'Win a duel without declaring a single attack.', { hint: 'Your monsters never stepped forward, and still the duel was yours.', test: c => anyDuel(c, d => W(d) && d.c === 1 && d.attacks === 0) }),
  // Rumours. The first needs no switch; every other row here is earned only while the Rumours switch is on.
  R('scratched_on_the_door', 'Scratched on the Door', 'rumours', 'xp', 'Start your first descent and read the line scratched on the first door.', { test: c => !!c.run || (c.p.runs || 0) >= 1 || (c.p.seen || []).includes('intro') }),
  R('the_first_memory', 'The First Memory', 'rumours', 'xp', 'Beat a floor guardian and hear the memory it leaves as it falls.', { needs: 'secret', test: c => (!!c.run && c.run.ach.beaten.length >= 1) || (c.p.seen || []).some(k => String(k).startsWith('memory:')) }),
  R('where_wall_was', 'Where Wall Was', 'rumours', 'hidden', 'Beat a floor guardian without ever having more than one monster on your side, and find the door that was not there.', { needs: 'secret', hint: 'Every guardian tells you the way as it falls, if you put their memories together.', test: c => c.doorFound }),
  R('one_was_enough', 'One Was Enough', 'rumours', 'hidden', 'Win the hidden duel against The Last One.', { needs: 'secret', hint: 'Some doors open only once. Win what waits behind one.', test: c => c.lastOne >= 1 || secretDuel(c, true) }),
  R('the_keeper_leaves', 'The Keeper Leaves', 'rumours', 'hidden', 'Clear the pyramid playing as The Last One.', { needs: 'secret', hint: 'The one who stayed can leave at last.', test: c => c.forger('last').clears >= 1 || (c.won && c.run.forger === 'last') }),
  // Four more hidden rows behind the Rumours switch (approved with the list). What Was Taken still asks for the five above.
  R('too_many_still', 'Too Many Still', 'rumours', 'hidden', 'Lose the hidden duel against The Last One.', { needs: 'secret', hint: 'Some losses teach more than wins.', test: c => secretDuel(c, false) }),
  R('left_it_standing', 'Left It Standing', 'rumours', 'hidden', 'Find the door that was not there and take the way on, leaving it unopened.', { needs: 'secret', hint: 'You found what few find, and let it be.', test: c => !!(c.run && c.run.ach.walkedPast) }),
  R('one_meets_one', 'One Meets One', 'rumours', 'hidden', 'Playing as The Last One, beat The Last One in the hidden duel.', { needs: 'secret', hint: 'Two of a kind, and only one leaves.', test: c => !!c.run && c.run.forger === 'last' && secretDuel(c, true) }),
  R('kept_and_carried', 'Kept and Carried', 'rumours', 'hidden', 'Beat The Last One and clear the pyramid in the same run.', { needs: 'secret', hint: 'What you kept, you carried all the way out.', test: c => c.won && secretDuel(c, true) }),
  // Metas: a title each, earned once every part is.
  R('all_six_keepers', 'All Six Keepers', 'meta', 'meta', 'Earn Kiln and Stone, Bone and Veil, and Tyrant and Gate.', { title: 'Witness to Six', parts: ['kiln_and_stone', 'bone_and_veil', 'tyrant_and_gate'] }),
  R('every_law_broken', 'Every Law Broken', 'meta', 'meta', 'Earn Ground That Lasts, Stone Against Stone, Nothing to Collect, Veil Against Veil, Four Is Enough and The Gate Stays Shut.', { title: 'the Unruled', parts: ['ground_that_lasts', 'stone_against_stone', 'nothing_to_collect', 'veil_against_veil', 'four_is_enough', 'the_gate_stays_shut'] }),
  R('what_was_taken', 'What Was Taken', 'meta', 'meta', 'Earn all five Rumours achievements, the hidden ones too.', { needs: 'secret', title: 'the Remembered', parts: ['scratched_on_the_door', 'the_first_memory', 'where_wall_was', 'one_was_enough', 'the_keeper_leaves'] }),
  R('the_name_returns', 'The Name Returns', 'meta', 'meta', 'Earn Ten Coals Hotter, Four Hands, One Forge, Bare Shelves, A Heavy Codex, Every Seam Held and An Answer Held.', { title: 'the Named', parts: ['ten_coals_hotter', 'four_hands_one_forge', 'bare_shelves', 'a_heavy_codex', 'every_seam_held', 'an_answer_held'] }),
];
for (const r of ACH) if (r.parts) r.goal = r.parts.length;
export const ACH_BY_ID = Object.fromEntries(ACH.map(r => [r.id, r]));

// ---------- the functions ----------
// Is the row open under this config? A row that needs the Rumours switch is never earned with it off, and is listed
// with it off only once earned (an earned and paid row never leaves the screen).
const open = (db, r) => !r.needs || (r.needs === 'secret' && !!db.config.secretLast);
const shown = (db, r, mine) => open(db, r) || mine.includes(r.id);
const plain = r => { const o = { id: r.id, name: r.name, group: r.group, tier: r.tier, hidden: r.hidden, how: r.how }; for (const k of ['hint', 'needs', 'title', 'goal', 'parts']) if (r[k] != null) o[k] = Array.isArray(r[k]) ? r[k].slice() : r[k]; return o; };
export const achList = db => ACH.filter(r => open(db, r)).map(plain);

// Judges every open row not yet earned and records the new ones in the profile: p.ach (ids, in the order earned) and
// p.achAt (id -> the number of the run it was earned in, counting the run in progress). Metas come last, so a row and
// the meta it finishes are earned by the same check. A row already in p.ach is never earned again. Call it after each
// run action with the run (achRunApply does), after the run is banked and after a Vault purchase with run null.
export function achCheck(db, p, run = null) {
  if (!Array.isArray(p.ach)) p.ach = [];
  if (!p.achAt || typeof p.achAt !== 'object' || Array.isArray(p.achAt)) p.achAt = {};
  const c = context(db, p, run), at = (p.runs || 0) + (c.add ? 1 : 0), got = [];
  const earn = id => { p.ach.push(id); p.achAt[id] = at; got.push(id); };
  for (const r of ACH) if (!r.parts && open(db, r) && !p.ach.includes(r.id) && r.test(c)) earn(r.id);
  for (const r of ACH) if (r.parts && open(db, r) && !p.ach.includes(r.id) && r.parts.every(id => p.ach.includes(id))) earn(r.id);
  return got;
}

// How far each row shown that counts up has come: { id, have, goal, done }. have never goes past goal.
export function achProgress(db, p, run = null) {
  const c = context(db, p, run), mine = p.ach || [];
  return ACH.filter(r => r.goal && shown(db, r, mine)).map(r => {
    const done = mine.includes(r.id), have = r.parts ? r.parts.filter(id => mine.includes(id)).length : r.have(c);
    return { id: r.id, have: done ? r.goal : Math.min(r.goal, have), goal: r.goal, done };
  });
}

// Every row shown as the page shows it: earned or not, the run it was earned in, its progress, and the words to show
// (a hidden row not yet earned shows only its hint and no name). The rows open under this config, and any row already
// earned, so turning the Rumours switch off later never takes an earned row off the screen.
export function achView(db, p, run = null) {
  const prog = Object.fromEntries(achProgress(db, p, run).map(x => [x.id, x])), mine = p.ach || [];
  return ACH.filter(r => shown(db, r, mine)).map(r => {
    const earned = mine.includes(r.id), veiled = r.hidden && !earned;
    return { ...plain(r), earned, at: earned ? (p.achAt || {})[r.id] ?? null : null, shownName: veiled ? null : r.name, shownText: veiled ? r.hint : r.how, ...(prog[r.id] ? { have: prog[r.id].have } : {}) };
  });
}

// A run action with the achievements judged after it: the events of runApply, then { e: 'ach', id } for each row it
// earned, in the order earned. Throws exactly as runApply does, leaves the run as it was, and then judges nothing.
// A tracked run saved before run.ach existed (run.feat only) starts keeping facts here: late, and reached if it is in a
// duel or has fought one.
export function achRunApply(run, a, db, p, opts = {}) {
  const late = !!(run && run.feat && !run.ach && run.phase !== 'over');
  if (late) run.ach = { duels: [], beaten: [], gifts: 0, giftSkips: 0, late: 1, ...(run.phase === 'duel' || run.stats.duels >= 1 ? { reached: 1 } : {}) };
  let ev;
  try { ev = runApply(run, a, db, opts); } catch (e) { if (late) delete run.ach; throw e; }
  for (const id of achCheck(db, p, run)) ev.push({ e: 'ach', id });
  return ev;
}
