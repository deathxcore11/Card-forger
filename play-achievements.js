// Play achievements, daily and weekly quests and the log-in calendar (play-achievements.md, slice 2).
// Shared by the worker (which checks and pays) and the app (which shows progress). Every number comes
// from something the server counts: match reports (play.counters), log-ins, packs opened and the
// Play collection. Practice never counts, and friend matches count as played, never as won.

import {STORY_DEEDS, STORY_ACT_DEEDS, storyDeedArt, storyDeedReward, isKeyFeat} from './story-deeds.js';
import {collectorSource} from './play-econ-rules.js';
import {achievementArt} from './play-achievement-art.js';
export {achievementArt};

// The tier names for a chain of n steps: the last step of a long chain is mythic.
const TIER_NAMES = {1: ['gold'], 2: ['bronze', 'gold'], 3: ['bronze', 'silver', 'gold'], 4: ['bronze', 'silver', 'gold', 'mythic'], 5: ['bronze', 'bronze', 'silver', 'gold', 'mythic']};
export const tierNames = n => TIER_NAMES[n] || TIER_NAMES[5];
const DEFAULT_TIER_REWARD = {bronze: {seals: {u: 1}, xp: 100}, silver: {seals: {r: 1}, xp: 250}, gold: {seals: {m: 1}, xp: 500}, mythic: {seals: {m: 1}, coins: 1000, xp: 1000}};
const FEAT = {coins: 300, packs: 1, xp: 100};
// A hidden feat (a riddle until earned) pays more: finding it is the point.
// Hidden riddles pay a Collector pack (every card holo, 1 in 300 to be a god pack) instead of a plain one (Randall, 4 Nov).
const HIDDEN_FEAT = {coins: 500, collector: 1, xp: 250, seals: {r: 1}};
// One-step deeds pay by how hard they are (Randall, 4 Nov): some only XP, some a common or uncommon seal,
// the big ones a pack, hidden ones a rare seal. `reward` on an achievement names one of these.
const REWARDS = {xp: {xp: 100}, common: {coins: 100, xp: 100, seals: {c: 1}}, uncommon: {coins: 200, xp: 150, seals: {u: 1}}, feat: FEAT, glory: {coins: 500, xp: 250, seals: {r: 1}}};

// Tabs, in order: one per Play mode or place (Quick Play, Practice, Story, Multiplayer, the Trunk,
// packs and the Merchant), plus the lifetime ones and the hidden ones.
export const DEED_TABS = [['glory', 'Glory'], ['journey', 'Journey'], ['duelist', 'Duelist'], ['quick', 'Quick Play'], ['formats', 'Formats'], ['colours', 'Colours'], ['story', 'Story'], ['friends', 'Multiplayer'], ['practice', 'Practice'], ['collector', 'Trunk'], ['packs', 'Packs'], ['merchant', 'Merchant'], ['hidden', 'Hidden']];

// source: a play.counters key; '#<prefix>' counts the different keys that start with '<prefix>:'
// (formats, colour pairs, sets opened); anything else is a collection, wallet or Story figure (sourceValue).
// tiers: overrides the default tier names, so easy chains stay bronze and silver and only the hard
// ones pay mythic seals. honour: Practice deeds; Practice never pays (play-progression.md section 3),
// so they are earned and shown, never claimed. Ids and steps are permanent: claims are ach:<id>:<step>.
export const ACHIEVEMENTS = Object.freeze([
  // Glory (World of Warcraft style, Randall 4 Nov): meta-achievements. Each counts other achievements; finishing
  // one pays a Secret Lair card (play-econ-route.js), a rare seal and a title. glory.where picks achievements by
  // tab, feat or hidden; glory.need fixes the goal (else every match). Steps are set from the matches in achievementRows.
  {id: 'glory-duelist', tab: 'glory', title: 'Glory of the Duelist', lore: 'Earn every Duelist feat.', art: 'Gideon Jura', source: 'glory', glory: {where: {tab: ['duelist'], feat: true}}, steps: [1], feat: true, reward: 'glory', titleReward: 'the Duelist'},
  {id: 'glory-table', tab: 'glory', title: 'Glory of the Table', lore: 'Every Quick Play and Multiplayer feat.', art: 'Karn Liberated', source: 'glory', glory: {where: {tab: ['quick', 'friends'], feat: true}}, steps: [1], feat: true, reward: 'glory', titleReward: 'Tablemaster'},
  {id: 'glory-chronicle-1', tab: 'glory', title: 'Chronicler Glory: Acts 1-8', lore: 'Chronicler of every act from 1 to 8.', art: "Mishra's Workshop", source: 'glory', glory: {ids: [1, 2, 3, 4, 5, 6, 7, 8].map(n => `a${n}-chronicler`)}, steps: [1], feat: true, reward: 'glory', titleReward: 'the Chronicler'},
  {id: 'glory-chronicle-2', tab: 'glory', title: 'Chronicler Glory: Acts 9-16', lore: 'Chronicler of every act from 9 to 16.', art: 'Survival of the Fittest', source: 'glory', glory: {ids: [9, 10, 11, 12, 13, 14, 15, 16].map(n => `a${n}-chronicler`)}, steps: [1], feat: true, reward: 'glory', titleReward: 'the Loremaster'},
  {id: 'glory-chronicle-3', tab: 'glory', title: 'Chronicler Glory: Acts 17-26', lore: 'Chronicler of every act from 17 to 26.', art: 'Academy Ruins', source: 'glory', glory: {ids: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26].map(n => `a${n}-chronicler`)}, steps: [1], feat: true, reward: 'glory', titleReward: 'the Archivist'},
  {id: 'glory-riddles', tab: 'glory', title: 'Keeper of Riddles', lore: 'Solve 25 hidden riddles, anywhere in Play.', art: 'Sphinx of the Final Word', source: 'glory', glory: {where: {hidden: true}, need: 25}, steps: [1], feat: true, reward: 'glory', titleReward: 'the Riddle-Keeper'},
  {id: 'glory-hunter', tab: 'glory', title: 'Achievement Hunter', lore: 'Achievement points earned. Glory achievements do not count toward it.', art: 'Nicol Bolas, Planeswalker', source: 'points', steps: [500, 1000, 2500, 5000], titleReward: 'the Hunter'},
  // Journey: the whole of Play.
  {id: 'first-spark', tab: 'journey', title: 'First Spark', lore: 'Every planeswalker remembers the first time the spark caught.', art: 'Chandra, Torch of Defiance', source: 'matches', steps: [1], feat: true, reward: 'xp'},
  {id: 'faithful', tab: 'journey', title: 'Faithful Planeswalker', lore: 'Days you came back to the Multiverse. Missed days never reset it.', art: 'Teferi, Hero of Dominaria', source: 'logins', steps: [7, 30, 100, 365], titleReward: 'Ever-Present'},
  {id: 'table-time', tab: 'journey', title: 'Time at the Table', lore: 'Hours spent in real matches, never in menus.', art: 'Karn, Scion of Urza', source: 'minutes', steps: [60, 600, 3000, 9000, 30000], unit: 'h', titleReward: 'Grizzled Veteran'},
  {id: 'well-travelled', tab: 'journey', title: 'Well Travelled', lore: 'Matches finished in Story, Quick Play and Multiplayer.', art: 'Kiora, Behemoth Beckoner', source: 'matches', steps: [10, 50, 250, 1000]},
  {id: 'all-roads', tab: 'journey', title: 'Every Road Walked', lore: 'Finish a match in Quick Play, Practice, Story and Multiplayer.', art: 'Planar Bridge', source: 'modes', steps: [4], feat: true},
  {id: 'mastery', tab: 'journey', title: 'Mastery', lore: 'Mastery levels earned. Every quest, deed and Story win feeds the same track.', art: 'Student of Warfare', source: 'level', steps: [5, 10, 25, 50]},
  // Duelist: how you win.
  {id: 'victor', tab: 'duelist', title: 'Victor', lore: 'Wins against the CPU and in Story. Friend wins never count.', art: 'Elspeth, Sun\'s Champion', source: 'wins', steps: [10, 50, 250, 1000, 5000]},
  {id: 'on-the-draw', tab: 'duelist', title: 'On the Draw', lore: 'Wins when you went second.', art: 'Brainstorm', source: 'wins_draw', steps: [5, 25, 100]},
  {id: 'swift-justice', tab: 'duelist', title: 'Swift Justice', lore: 'Win by your 5th turn.', art: 'Lightning Bolt', source: 'wins_fast', steps: [1], feat: true, reward: 'uncommon'},
  {id: 'flawless', tab: 'duelist', title: 'Flawless', lore: 'Win with 20 life or more.', art: 'Serra Angel', source: 'wins_flawless', steps: [1], feat: true, reward: 'common'},
  {id: 'long-game', tab: 'duelist', title: 'The Long Game', lore: 'Win a match that lasts 15 of your turns.', art: 'Ugin, the Spirit Dragon', source: 'wins_long', steps: [1], feat: true, reward: 'common'},
  {id: 'comeback', tab: 'duelist', title: 'Back From the Brink', lore: 'Win with 5 life or less. The table thought you were finished.', art: 'Worship', source: 'wins_low', steps: [1, 10, 50], titleReward: 'the Unbroken'},
  {id: 'executioner', tab: 'duelist', title: 'Executioner', lore: 'Opposing creatures you destroyed, in every mode but Practice.', art: 'Wrath of God', source: 'kills', steps: [25, 100, 500, 2000, 5000]},
  {id: 'one-big-turn', tab: 'duelist', title: 'One Big Turn', lore: 'Deal 15 or more damage to one opponent in a single turn.', art: 'Craterhoof Behemoth', source: 'f_big15', steps: [1], feat: true, reward: 'uncommon'},
  {id: 'alpha-strike', tab: 'duelist', title: 'Alpha Strike', lore: 'Attack with six or more creatures at once.', art: 'Overwhelming Stampede', source: 'f_alpha6', steps: [1], feat: true, reward: 'common'},
  {id: 'clean-slate', tab: 'duelist', title: 'Clean Slate', lore: 'Wipe out three or more opposing creatures at once.', art: 'Day of Judgment', source: 'wipes', steps: [1, 10, 50]},
  {id: 'poison-pen', tab: 'duelist', title: 'Poison Pen', lore: 'Win with your opponent on 10 poison counters.', art: 'Glistener Elf', source: 'wins_poison', steps: [1, 10], tiers: ['bronze', 'silver']},
  {id: 'read-to-end', tab: 'duelist', title: 'Read to the End', lore: 'Win with your opponent out of cards to draw.', art: 'Traumatize', source: 'wins_mill', steps: [1], feat: true, reward: 'uncommon'},
  {id: 'untouched', tab: 'duelist', title: 'Untouchable', lore: 'Win without ever losing a point of life.', art: "Teferi's Protection", source: 'wins_untouched', steps: [1, 10], tiers: ['bronze', 'silver']},
  {id: 'from-ashes', tab: 'duelist', title: 'From the Ashes', lore: 'Win after your life fell to 3 or less at some point.', art: 'Rekindling Phoenix', source: 'wins_phoenix', steps: [1, 10, 25]},
  {id: 'overkill', tab: 'duelist', title: 'Overkill', lore: 'Win with your opponent at -5 life or lower.', art: 'Fireball', source: 'wins_overkill', steps: [1, 10], tiers: ['bronze', 'silver']},
  // Quick Play: matches against the CPU at Normal.
  {id: 'quick-draw', tab: 'quick', title: 'Quickest Draw', lore: 'Quick Play wins against the CPU.', art: 'Goblin Guide', source: 'wins_quick', steps: [5, 25, 100, 500]},
  {id: 'quick-regular', tab: 'quick', title: 'Regular at the Table', lore: 'Quick Play matches finished, win or lose.', art: 'Hellrider', source: 'quick_matches', steps: [10, 100, 500], tiers: ['bronze', 'silver', 'silver']},
  {id: 'swarm', tab: 'quick', title: 'Swarm', lore: 'Have ten creatures on the field at once.', art: 'Hornet Queen', source: 'f_swarm10', steps: [1], feat: true, reward: 'uncommon'},
  {id: 'token-army', tab: 'quick', title: 'Token Army', lore: 'Have eight tokens on the field at once.', art: 'Secure the Wastes', source: 'f_tokens8', steps: [1], feat: true, reward: 'common'},
  {id: 'colossal', tab: 'quick', title: 'Colossal', lore: 'Have a creature with 15 or more power.', art: 'Ghalta, Primal Hunger', source: 'f_power15', steps: [1], feat: true, reward: 'uncommon'},
  {id: 'air-superiority', tab: 'quick', title: 'Air Superiority', lore: 'Have five flyers on the field at once.', art: 'Favorable Winds', source: 'f_flyers5', steps: [1], feat: true, reward: 'common'},
  {id: 'growth-spurt', tab: 'quick', title: 'Growth Spurt', lore: 'Put ten +1/+1 counters on one creature.', art: 'Hardened Scales', source: 'f_counters10', steps: [1], feat: true, reward: 'common'},
  {id: 'armed', tab: 'quick', title: 'Armed to the Teeth', lore: 'Have three Auras or Equipment on one creature.', art: 'Puresteel Paladin', source: 'f_attach3', steps: [1], feat: true, reward: 'common'},
  {id: 'chieftain', tab: 'quick', title: 'Chieftain', lore: 'Have six creatures of one creature type on the field at once.', art: "Vanquisher's Banner", source: 'f_tribe6', steps: [1], feat: true, reward: 'common'},
  {id: 'many-faces', tab: 'quick', title: 'Many Faces', lore: 'Turn three face-down creatures face up in one match.', art: 'Ixidron', source: 'f_turnup3', steps: [1], feat: true, reward: 'uncommon'},
  {id: 'lifebloom', tab: 'quick', title: 'Lifebloom', lore: 'Gain 20 or more life in one match.', art: 'Aetherflux Reservoir', source: 'f_gain20', steps: [1], feat: true, reward: 'common'},
  {id: 'quick-hunter', tab: 'quick', title: 'Big Game Hunter', lore: 'Opposing creatures destroyed in Quick Play.', art: 'Big Game Hunter', source: 'quick_kills', steps: [25, 250, 1000], tiers: ['bronze', 'silver', 'gold']},
  {id: 'pod-boss', tab: 'quick', title: 'Last One Standing', lore: 'Win a Commander pod against three CPU players.', art: 'Kenrith, the Returned King', source: 'wins_pod', steps: [1, 10, 50]},
  // Formats.
  {id: 'format-explorer', tab: 'formats', title: 'Format Explorer', lore: 'Win in different formats.', art: 'Jace, the Mind Sculptor', source: 'fmt', steps: [2, 4, 6]},
  {id: 'commander-wins', tab: 'formats', title: 'In Command', lore: 'Commander wins.', art: 'Command Tower', source: 'fmt:Commander', steps: [1, 10, 50, 200]},
  {id: 'standard-wins', tab: 'formats', title: 'Up to Standard', lore: 'Standard wins.', art: 'Sheoldred, the Apocalypse', source: 'fmt:Standard', steps: [1, 25], tiers: ['bronze', 'silver']},
  {id: 'modern-wins', tab: 'formats', title: 'Modern Times', lore: 'Modern wins.', art: 'Thoughtseize', source: 'fmt:Modern', steps: [1, 25], tiers: ['bronze', 'silver']},
  {id: 'legacy-wins', tab: 'formats', title: 'Legacy', lore: 'Legacy wins.', art: 'Force of Will', source: 'fmt:Legacy', steps: [1, 25], tiers: ['bronze', 'silver']},
  {id: 'pauper-wins', tab: 'formats', title: 'Prince of Paupers', lore: 'Pauper wins. Commons only, and still enough.', art: 'Delver of Secrets', source: 'fmt:Pauper', steps: [1, 25], tiers: ['bronze', 'silver']},
  {id: 'old-school-wins', tab: 'formats', title: 'Old School', lore: 'Old School wins, with the cards of 1993 and 1994.', art: 'Juzám Djinn', source: 'fmt:Old School', steps: [1, 25], tiers: ['bronze', 'silver']},
  // Colours: read from the basic lands in the deck you won with.
  {id: 'guild-ties', tab: 'colours', title: 'Guild Ties', lore: 'Win with different two-colour pairs. There are ten.', art: 'Transguild Promenade', source: '#gp', steps: [1, 3, 5, 10]},
  {id: 'mono-master', tab: 'colours', title: 'True to One', lore: 'Win with mono-coloured decks of different colours.', art: "Painter's Servant", source: '#mc', steps: [1, 3, 5]},
  {id: 'shards-wedges', tab: 'colours', title: 'Shards and Wedges', lore: 'Win with different three-colour decks. There are ten.', art: 'Obelisk of Alara', source: '#tc', steps: [1, 5, 10]},
  // Story.
  {id: 'storyteller', tab: 'story', title: 'Storyteller', lore: 'Story battles won, from Dominaria onward.', art: 'Urza, Lord High Artificer', source: 'story_wins', steps: [1, 10, 30, 60]},
  {id: 'acts-cleared', tab: 'story', title: 'Through the Ages', lore: 'Story acts with all 8 battles won, from Alpha to the newest set.', art: 'Time Spiral', source: 'story_acts', steps: [1, 5, 10, 25, 45]},
  {id: 'villain-side', tab: 'story', title: 'The Other Side', lore: 'Story battles won from the villain\'s seat.', art: 'Villainous Wealth', source: 'story_villain', steps: [1, 10, 40]},
  {id: 'own-deck', tab: 'story', title: 'Bring Your Own', lore: 'Story battles won with your own Play deck instead of the Story deck.', art: 'Personal Tutor', source: 'story_own', steps: [1, 10, 40]},
  // Multiplayer: friend matches count as played, never as won.
  {id: 'good-company', tab: 'friends', title: 'Good Company', lore: 'Friend matches finished. Three count each day.', art: 'Ajani, Mentor of Heroes', source: 'friend_matches', steps: [5, 25, 100, 500]},
  {id: 'friend-formats', tab: 'friends', title: 'House Rules', lore: 'Play friend matches in different formats.', art: 'Secret Rendezvous', source: '#ff', steps: [2, 4], tiers: ['bronze', 'silver']},
  {id: 'friend-marathon', tab: 'friends', title: 'One More Turn', lore: 'Friend matches that last 10 of your turns.', art: 'Long Road Home', source: 'friend_long', steps: [1, 10], tiers: ['bronze', 'silver']},
  {id: 'around-table', tab: 'friends', title: 'Around the Table', lore: 'Commander pods finished, win or lose.', art: 'Kynaios and Tiro of Meletis', source: 'pod_matches', steps: [5, 25, 100], tiers: ['bronze', 'silver', 'gold']},
  {id: 'pod-hunter', tab: 'friends', title: 'Table Politics', lore: 'Creatures destroyed in Commander pods.', art: 'Gisa and Geralf', source: 'pod_kills', steps: [25, 250], tiers: ['bronze', 'silver']},
  {id: 'game-night', tab: 'friends', title: 'Game Night', lore: 'Different days you finished a friend match.', art: 'Brothers Yamazaki', source: '#fd', steps: [3, 10, 30]},
  {id: 'show-off', tab: 'friends', title: 'Show-Off', lore: 'In a friend match, deal 10 or more damage in one turn.', art: 'Fling', source: 'f_friend_big10', steps: [1], feat: true, reward: 'common'},
  {id: 'crowded-table', tab: 'friends', title: 'Crowded Table', lore: 'In a friend match, have eight creatures on the field at once.', art: 'Rally the Peasants', source: 'f_friend_swarm8', steps: [1], feat: true, reward: 'common'},
  {id: 'down-to-wire', tab: 'friends', title: 'Down to the Wire', lore: 'Finish a friend match on 3 life or less.', art: "Angel's Grace", source: 'f_friend_wire', steps: [1], feat: true, reward: 'xp'},
  {id: 'friendly-fire', tab: 'friends', title: 'Friendly Fire', lore: "Your friends' creatures you destroyed.", art: 'Comet Storm', source: 'friend_kills', steps: [10, 50, 200], tiers: ['bronze', 'silver', 'gold']},
  // Practice: honour only.
  {id: 'drills', tab: 'practice', title: 'Drills', lore: 'Practice matches finished. Practice never pays, but it remembers.', art: 'Training Grounds', source: 'practice_matches', steps: [10, 50, 200], honour: true},
  {id: 'sparring', tab: 'practice', title: 'Sparring Partner', lore: 'Practice wins against the CPU on Hard.', art: 'Sparring Golem', source: 'practice_wins_hard', steps: [1, 10, 50], honour: true},
  {id: 'lab-rat', tab: 'practice', title: 'The Laboratory', lore: 'Practice in different formats.', art: 'Laboratory Maniac', source: '#pf', steps: [3, 6], honour: true},
  // The Trunk: the Play collection.
  {id: 'binder-builder', tab: 'collector', title: 'Binder Builder', lore: 'Cards in your Trunk, counting every copy.', art: 'Bag of Holding', source: 'cards', steps: [100, 500, 1500, 4000, 10000]},
  {id: 'playset', tab: 'collector', title: 'Playset', lore: 'Different cards you hold all 4 copies of.', art: 'Lotus Petal', source: 'playsets', steps: [25, 100, 500]},
  {id: 'rare-hoard', tab: 'collector', title: 'Dragon\'s Hoard', lore: 'Different rares in your Trunk.', art: 'Hoarding Dragon', source: 'rares', steps: [25, 100, 300]},
  {id: 'mythic-hoard', tab: 'collector', title: 'Mythic Hoard', lore: 'Different mythics in your Trunk.', art: 'Emrakul, the Aeons Torn', source: 'mythics', steps: [10, 50, 150]},
  {id: 'holo-hoard', tab: 'collector', title: 'Light Catcher', lore: 'Holo copies in your Trunk.', art: 'Prismatic Strands', source: 'holos', steps: [10, 50, 200]},
  {id: 'set-spanner', tab: 'collector', title: 'Planar Atlas', lore: 'Different sets your Trunk\'s cards came from.', art: 'Planar Atlas', source: 'trunk_sets', steps: [10, 50, 150]},
  {id: 'deckwright', tab: 'collector', title: 'Deckwright', lore: 'Play decks saved.', art: 'Library of Alexandria', source: 'decks', steps: [1, 5, 15], tiers: ['bronze', 'bronze', 'silver']},
  // Packs.
  {id: 'pack-rat', tab: 'packs', title: 'Pack Rat', lore: 'Packs opened, from every source.', art: 'Pack Rat', source: 'packs', steps: [10, 50, 200, 500, 1000]},
  {id: 'collector-cracker', tab: 'packs', title: 'Treasure Hunter', lore: 'Collector packs opened. Every card inside is holo.', art: 'Treasure Map', source: 'packs_collector', steps: [1, 10, 50]},
  {id: 'mythic-pull', tab: 'packs', title: 'Mythic Proportions', lore: 'Mythics pulled from packs.', art: 'Mythic Proportions', source: 'pulls_mythic', steps: [1, 10, 50]},
  {id: 'set-tourist', tab: 'packs', title: 'Plane Hopper', lore: 'Packs opened from different sets.', art: 'Interplanar Beacon', source: '#po', steps: [5, 20, 50, 100]},
  // The Merchant.
  {id: 'bazaar', tab: 'merchant', title: 'Bazaar Regular', lore: 'Packs bought at the Merchant.', art: 'Bazaar of Baghdad', source: 'buys', steps: [5, 25, 100]},
  {id: 'seal-stamper', tab: 'merchant', title: 'Sealed and Stamped', lore: 'Cards stamped with a seal.', art: 'Sealed Fate', source: 'crafts', steps: [5, 25, 100]},
  {id: 'forgemaster', tab: 'merchant', title: 'Forgemaster', lore: 'Seals struck into a higher rarity at the Forge.', art: 'Kuldotha Forgemaster', source: 'forges', steps: [3, 15, 50]},
  {id: 'holo-press', tab: 'merchant', title: 'Hall of Mirrors', lore: 'Copies turned holo at the Forge.', art: 'Mirrorworks', source: 'holos_made', steps: [1, 10, 50]},
  {id: 'precon-patron', tab: 'merchant', title: 'Off the Shelf', lore: 'Precon decks bought from the Merchant.', art: 'Merchant Scroll', source: 'precons', steps: [1, 5, 15]},
  {id: 'big-spender', tab: 'merchant', title: 'Gold-Cursed', lore: 'Coins spent at the Merchant.', art: 'King Macar, the Gold-Cursed', source: 'coins_spent', steps: [5000, 25000, 100000]},
  // Hidden: riddles until earned.
  {id: 'by-a-thread', tab: 'hidden', title: 'By a Thread', lore: 'Win with exactly 1 life left.', riddle: 'One breath stands between you and the grave.', art: 'Near-Death Experience', source: 'wins_thread', steps: [1], feat: true, hidden: true},
  // Story deeds: one feat each, woven into the acts (story-deeds.js).
  // A gold deed (a secret boss) is a one-step gold achievement instead of a feat: it pays the gold tier and a Collector pack.
  ...[...STORY_DEEDS, ...STORY_ACT_DEEDS].map(d => ({id: d.id, tab: 'story', act: d.act, title: d.title, lore: d.lore, art: storyDeedArt(d), source: 'sd:' + d.id, steps: [1], ...(isKeyFeat(d.id) ? {key: true} : {}),
    ...(d.gold ? {hidden: true, riddle: d.riddle} : d.hidden ? {feat: true, hidden: true, riddle: d.riddle} : {feat: true, reward: storyDeedReward(d)})})),
  {id: 'marathon', tab: 'hidden', title: 'Marathon', lore: 'Win a match that lasts 20 of your turns.', riddle: 'The sun rose and set and still you fought.', art: 'Approach of the Second Sun', source: 'wins_marathon', steps: [1], feat: true, hidden: true},
  {id: 'turn-four', tab: 'hidden', title: 'Turn Four', lore: 'Win by your 4th turn.', riddle: 'They never got to see their fourth land.', art: 'Ball Lightning', source: 'wins_t4', steps: [1], feat: true, hidden: true},
  {id: 'stalemate', tab: 'hidden', title: 'Stalemate', lore: 'Finish a match in a draw.', riddle: 'Nobody won, and nobody lost.', art: 'Divine Intervention', source: 'draws', steps: [1], feat: true, hidden: true},
  {id: 'pentachrome', tab: 'hidden', title: 'Every Colour at Once', lore: 'Win with a five-colour deck.', riddle: 'White, blue, black, red and green walked into a bar.', art: 'Child of Alara', source: 'wins_five', steps: [1], feat: true, hidden: true},
  {id: 'pacifist', tab: 'hidden', title: 'Pacifist', lore: 'Win without ever attacking.', riddle: 'They fell, and you never raised a hand.', art: 'Pacifism', source: 'wins_pacifist', steps: [1], feat: true, hidden: true},
  {id: 'exact-change', tab: 'hidden', title: 'Exact Change', lore: 'Win with your opponent on exactly 0 life.', riddle: 'Not one point more than needed.', art: 'Exquisite Firecraft', source: 'wins_exact', steps: [1], feat: true, hidden: true},
  {id: 'lone-wolf', tab: 'hidden', title: 'Lone Wolf', lore: 'Win without ever having more than one creature on the field.', riddle: 'You only ever needed one.', art: 'Lone Wolf', source: 'wins_lone', steps: [1], feat: true, hidden: true},
  {id: 'heaven', tab: 'hidden', title: 'Twice Alive', lore: 'Reach 40 life.', riddle: 'Twice as alive as anyone at the table.', art: 'Serra Ascendant', source: 'f_life40', steps: [1], feat: true, hidden: true},
  {id: 'hellbent', tab: 'hidden', title: 'Empty Hands', lore: 'Win after your opponent ran out of cards in hand.', riddle: 'Their hands were empty. Yours were not.', art: 'Mind Twist', source: 'wins_hellbent', steps: [1], feat: true, hidden: true},
  {id: 'turn-three', tab: 'hidden', title: 'Three Turns', lore: 'Win by your 3rd turn.', riddle: "Three turns. That's all it took.", art: 'Fireblast', source: 'wins_t3', steps: [1], feat: true, hidden: true},
  {id: 'unlucky', tab: 'hidden', title: 'Unlucky for Some', lore: 'Win on exactly your 13th turn.', riddle: 'Thirteen turns, and luck had nothing to do with it.', art: 'Black Cat', source: 'wins_13', steps: [1], feat: true, hidden: true},
  {id: 'body-count', tab: 'hidden', title: 'Body Count', lore: 'Destroy ten opposing creatures in one match.', riddle: 'Ten fell before you.', art: 'Massacre Wurm', source: 'f_kills10', steps: [1], feat: true, hidden: true},
  {id: 'hoarder', tab: 'hidden', title: 'Hoarder', lore: 'Hold ten cards in your hand at once.', riddle: 'Ten cards in hand, and still hungry.', art: 'Reliquary Tower', source: 'f_hand10', steps: [1], feat: true, hidden: true},
  {id: 'landlord', tab: 'hidden', title: 'Landlord', lore: 'Have twelve lands on the field.', riddle: 'A dozen lands to call your own.', art: 'Azusa, Lost but Seeking', source: 'f_lands12', steps: [1], feat: true, hidden: true},
  {id: 'giant-killer', tab: 'hidden', title: 'Giant Killer', lore: 'Win while your opponent had twice as many creatures as your best board.', riddle: 'Outnumbered two to one, and still standing.', art: 'Giant Killer', source: 'wins_outnumbered', steps: [1], feat: true, hidden: true},
  {id: 'no-losses', tab: 'hidden', title: 'Not One Lost', lore: 'Win a match lasting 8 or more of your turns without losing a creature.', riddle: 'Every soldier came home.', art: 'Brave the Elements', source: 'wins_nolosses', steps: [1], feat: true, hidden: true},
  {id: 'god-pack', tab: 'hidden', title: 'Touched by the Gods', lore: 'Open a god pack: every card a holo rare or mythic.', riddle: 'One pack in a thousand is blessed.', art: "God-Pharaoh's Gift", source: 'packs_god', steps: [1], feat: true, hidden: true},
]);

// Story figures from the player's story:* refs (story-client, play_story_refs).
function storyValue(source, refs = []) {
  if (!Array.isArray(refs)) return 0;
  if (source === 'story_villain') return refs.filter(r => /^story:a\d+b\d:(?:villain|vown)$/.test(r)).length;
  if (source === 'story_own') return refs.filter(r => /^story:a\d+b\d:own$/.test(r)).length;
  const acts = new Map();
  for (const r of refs) { const m = /^story:a(\d+)b([1-8]):clear$/.exec(r); if (m) acts.set(m[1], (acts.get(m[1]) || 0) + 1); }
  return [...acts.values()].filter(n => n >= 8).length;
}
// How far the player is along one source.
export function sourceValue(source, {counters = {}, state = {}} = {}) {
  const cards = state?.cards || [];
  if (source === 'cards') return cards.reduce((t, c) => t + (c.c | 0), 0);
  if (source === 'playsets') return cards.filter(c => (c.c | 0) >= 4).length;
  if (source === 'mythics') return cards.filter(c => c.r === 'mythic' && (c.c | 0) > 0).length;
  if (source === 'rares') return cards.filter(c => c.r === 'rare' && (c.c | 0) > 0).length;
  if (source === 'holos') return cards.reduce((t, c) => t + Math.min(c.h | 0, c.c | 0), 0);
  if (source === 'trunk_sets') return new Set(cards.flatMap(c => Array.isArray(c.s) ? c.s : c.s ? [c.s] : [])).size;
  if (source === 'decks') return (state?.decks || []).length;
  if (source === 'packs') return state?.wallet?.packs_opened | 0;
  if (source === 'level') return 1 + Math.floor(Math.max(0, state?.wallet?.xp | 0) / (state?.config?.mastery?.xpPerLevel || 1000));
  if (source === 'modes') return ['quick_matches', 'practice_matches', 'friend_matches'].filter(k => counters[k] > 0).length + (counters.story_matches > 0 || counters.story_wins > 0 ? 1 : 0);
  if (/^story_(?:acts|villain|own)$/.test(source)) return storyValue(source, state?.story);
  if (source === 'fmt') return Object.keys(counters).filter(k => /^fmt:/.test(k) && counters[k] > 0).length;
  if (source.startsWith('#')) { const p = source.slice(1) + ':'; return Object.keys(counters).filter(k => k.startsWith(p) && counters[k] > 0).length; }
  return Number(counters[source]) || 0;
}

const claimedRef = (id, step) => `ach:${id}:${step}`;
// Achievement points (World of Warcraft style, Randall 4 Nov): only for bragging, never spent. One step of a
// chain is 10 (5 in Practice, which pays nothing); a feat is worth what it pays: 5 XP only, 10 common seal,
// 20 uncommon seal, 50 a pack or Glory; a hidden riddle 25.
const FEAT_POINTS = {xp: 5, common: 10, uncommon: 20, feat: 50, glory: 50};
const stepPoints = a => a.hidden ? 25 : a.feat ? FEAT_POINTS[a.reward] ?? 50 : a.honour ? 5 : 10;
const glorySet = (g, plain) => g.ids ? g.ids.map(id => plain.get(id)).filter(Boolean)
  : [...plain.values()].filter(r => (!g.where.tab || g.where.tab.includes(r.tab)) && (!g.where.feat || r.feat) && (!g.where.hidden || r.hidden));
// One row per achievement: value, its steps with tier and claim state, and the next goal. A Glory row counts
// finished achievements; the Achievement Hunter counts points (never its own tab's).
export function achievementRows(ctx = {}) {
  const claimed = new Set(ctx.claimed || []);
  const make = (a, value, needs = a.steps) => {
    const names = achievementTiers(a), steps = needs.map((need, i) => ({need, tier: names[i] || names.at(-1), done: value >= need, claimed: claimed.has(claimedRef(a.id, i))}));
    const next = steps.find(s => !s.done), earned = steps.filter(s => s.done).length, per = stepPoints(a);
    return {...a, value, steps, earned, next, ready: !a.honour && steps.some(s => s.done && !s.claimed), complete: !next, points: {each: per, total: per * steps.length, earned: per * earned}};
  };
  const plain = new Map(ACHIEVEMENTS.filter(a => !a.glory && a.source !== 'points').map(a => [a.id, make(a, sourceValue(a.source, ctx))]));
  const points = [...plain.values()].reduce((t, r) => t + r.points.earned, 0);
  return ACHIEVEMENTS.map(a => {
    if (plain.has(a.id)) return plain.get(a.id);
    if (a.source === 'points') return make(a, points);
    const kids = glorySet(a.glory, plain), need = a.glory.need || kids.length, row = make(a, kids.filter(k => k.complete).length, [need]);
    return a.glory.need ? row : {...row, children: kids.map(k => ({id: k.id, title: k.hidden && !k.earned ? 'Hidden riddle' : k.title, done: k.complete}))};
  });
}
// Titles a row gives once all of it is earned (Randall 4 Nov): [{id, text, from, earned}].
export const achievementTitles = rows => rows.filter(r => r.titleReward).map(r => ({id: r.id, text: r.titleReward, from: r.title, earned: r.complete}));
// A player's name with their chosen title: "Randall, the Duelist"; "of ..." titles join without a comma.
export const titledName = (name, title) => !name || !title ? name || '' : /^of /.test(title) ? `${name} ${title}` : `${name}, ${title}`;
export function deedTotals(rows) {
  const total = rows.reduce((t, r) => t + r.steps.length, 0), earned = rows.reduce((t, r) => t + r.earned, 0);
  return {total, earned, ready: rows.filter(r => r.ready).length, points: {earned: rows.reduce((t, r) => t + r.points.earned, 0), total: rows.reduce((t, r) => t + r.points.total, 0)}};
}
// The 3 unfinished achievements closest to their next step ("Almost there").
export const almostThere = (rows, n = 3) => rows.filter(r => r.next && !r.hidden).map(r => ({r, share: r.value / r.next.need})).sort((a, b) => b.share - a.share).slice(0, n).map(x => x.r);

export const achievementTiers = a => a.feat ? a.steps.map(() => 'feat') : a.tiers || tierNames(a.steps.length);
export function achievementReward(a, step, config = {}) {
  if (a.honour) return {};
  if (a.feat) return JSON.parse(JSON.stringify(a.hidden ? HIDDEN_FEAT : REWARDS[a.reward] || FEAT));
  const tier = achievementTiers(a)[step], cfg = config?.achievement?.[tier] || DEFAULT_TIER_REWARD[tier];
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
  // From 4 Nov 2026 (QUEST_POOL_FROM): more variety, one per Play place.
  {id: 'quick2', label: 'Finish 2 Quick Play matches', key: 'quick_matches', need: 2},
  {id: 'pack1', label: 'Open a pack', key: 'packs_opened', need: 1},
  {id: 'story-play', label: 'Play 2 Story battles', key: 'story_matches', need: 2},
];
export const DAILY_HARD = [
  {id: 'win3', label: 'Win 3 matches', key: 'wins', need: 3},
  {id: 'draw-win', label: 'Win on the draw', key: 'wins_draw', need: 1},
  {id: 'fast-win', label: 'Win by your 8th turn', key: 'wins_t8', need: 1},
  {id: 'healthy-win', label: 'Win with 15 or more life', key: 'wins_healthy', need: 1},
  {id: 'comeback-win', label: 'Win with 5 or less life', key: 'wins_low', need: 1},
  {id: 'pair-win', label: 'Win with a two-colour deck', key: 'wins_2c', need: 1},
  {id: 'long-win', label: 'Win a match that lasts 10 of your turns', key: 'wins_t12', need: 1},
  {id: 'quick-win2', label: 'Win 2 Quick Play matches', key: 'wins_quick', need: 2},
];
export const FIRST_MATCH = {id: 'first', label: 'First match of the day (3+ of your turns)', key: 'matches5', need: 1};
export const WEEKLY = [
  {id: 'w-wins', label: 'Win 7 matches', key: 'wins', need: 7},
  {id: 'w-matches', label: 'Finish 15 matches', key: 'matches', need: 15},
  {id: 'w-story', label: 'Win 3 Story battles', key: 'story_wins', need: 3},
  {id: 'w-packs', label: 'Open 5 packs', key: 'packs_opened', need: 5},
  {id: 'w-draw', label: 'Win on the draw 3 times', key: 'wins_draw', need: 3},
  {id: 'w-time', label: 'Spend 3 hours in matches', key: 'minutes', need: 180},
  {id: 'w-quick', label: 'Win 5 Quick Play matches', key: 'wins_quick', need: 5},
  {id: 'w-stamp', label: 'Stamp 3 cards with seals', key: 'crafts', need: 3},
];
// Days before this keep the first quest pools (the first 4 of each list, and the first 3 weeklies), so
// quests already in progress never change under a player.
export const QUEST_POOL_FROM = '2026-11-04', WEEKLY_POOL_FROM = '2026-W46';
const FIRST_POOL = {easy: 4, hard: 4, weekly: 3};

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
// counters: a swapped quest (the day's one free reroll, d:<day>:reroll_easy or _hard) is replaced by
// another from the same pool, never the one it replaced.
export function dailyQuests(day, user = '', counters = {}) {
  const h = hash(day + ':' + user), old = day < QUEST_POOL_FROM;
  const easy = old ? DAILY_EASY.slice(0, FIRST_POOL.easy) : DAILY_EASY, hard = old ? DAILY_HARD.slice(0, FIRST_POOL.hard) : DAILY_HARD;
  const pick = (pool, i, level) => { const swap = Number(counters?.[`d:${day}:reroll_${level}`]) > 0 && pool.length > 1;
    const at = swap ? (i + 1 + (h >>> 16) % (pool.length - 1)) % pool.length : i;
    return {...pool[at], level, ...(swap ? {swapped: true} : {})}; };
  return [pick(easy, h % easy.length, 'easy'), pick(hard, (h >>> 8) % hard.length, 'hard'), {...FIRST_MATCH, level: 'first'}];
}
// One free quest swap a day (play-progression.md: "Quest reroll: free, once a day"), for an easy or
// hard daily that isn't done yet.
export const rerollUsed = (counters = {}, day) => ['easy', 'hard'].some(l => Number(counters[`d:${day}:reroll_${l}`]) > 0);
// One weekly swap a week (Randall 3 Nov 2026): an unfinished, unclaimed weekly is swapped for another
// from the pool, counted as w:<week>:reroll_<id of the weekly it replaced>.
export const weeklyRerollUsed = (counters = {}, week) => Object.keys(counters).some(k => k.startsWith(`w:${week}:reroll_`) && Number(counters[k]) > 0);
// Three weeklies, picked from the pool by the week and the player (the first week keeps the first three).
// A swapped one is replaced by a pool weekly not already on the list, in its own slot.
export function weeklyQuests(week, user = '', counters = {}) {
  let out;
  if (week < WEEKLY_POOL_FROM) out = WEEKLY.slice(0, FIRST_POOL.weekly);
  else {
    const pool = [...WEEKLY]; out = [];
    let h = hash(week + ':w:' + user);
    while (out.length < 3) { out.push(pool.splice(h % pool.length, 1)[0]); h = Math.imul(h ^ (h >>> 13), 2654435761) >>> 0; }
  }
  const spare = WEEKLY.filter(q => !out.includes(q)), h2 = hash(week + ':swap:' + user);
  return out.map(q => Number(counters?.[`w:${week}:reroll_${q.id}`]) > 0 && spare.length ? {...spare[h2 % spare.length], swapped: true, swappedFrom: q.id} : q);
}
export function questRows({counters = {}, claimed = [], day, user = ''} = {}) {
  const got = new Set(claimed), week = playWeek(day);
  const row = (q, scope, ref) => { const have = Number(counters[`${scope}:${q.key}`]) || 0; return {...q, have: Math.min(have, q.need), done: have >= q.need, claimed: got.has(ref), ref}; };
  const used = rerollUsed(counters, day);
  const daily = dailyQuests(day, user, counters).map(q => { const r = row(q, 'd:' + day, `daily:${day}:${q.id}`); return {...r, canSwap: !used && q.level !== 'first' && !r.done && !r.claimed}; });
  const wUsed = weeklyRerollUsed(counters, week);
  const weekly = weeklyQuests(week, user, counters).map(q => { const r = row(q, 'w:' + week, `weekly:${week}:${q.id}`); return {...r, level: 'weekly', canSwap: !wUsed && !r.done && !r.claimed}; });
  return {day, week, daily, weekly, rerollUsed: used, weeklyRerollUsed: wUsed, weeklyAll: {done: weekly.every(q => q.done), claimed: got.has(`weekly:${week}:all`), ref: `weekly:${week}:all`}};
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
// A deck's colours, read from the basic lands in its list (WUBRG order); '' when it runs none.
const BASIC_COLOUR = {plains: 'W', island: 'U', swamp: 'B', mountain: 'R', forest: 'G'};
export function deckColours(cards = []) {
  const got = new Set();
  for (const c of Array.isArray(cards) ? cards : []) { const k = String(c?.name || '').toLowerCase().replace(/^snow-covered /, ''); if (BASIC_COLOUR[k] && c?.board !== 'side') got.add(BASIC_COLOUR[k]); }
  return 'WUBRG'.split('').filter(x => got.has(x)).join('');
}
const cleanColours = v => 'WUBRG'.split('').filter(x => String(v || '').toUpperCase().includes(x)).join('');
const cleanFormat = v => String(v || '').replace(/[^A-Za-z0-9 ]/g, '').slice(0, 30);

// The numbers the app reports from match-facts.js, kept to small whole numbers. `known` marks a report
// that carried facts at all, so a missing fact never reads as zero (no free Pacifist for an old app).
const FACT_NUMBERS = ['myTurns', 'minLife', 'startLife', 'maxLife', 'lifeGained', 'oppBigTurn', 'oppPoison', 'oppLibraryMin', 'oppHandMin', 'maxHand', 'maxCreatures', 'maxTokens',
  'maxLands', 'maxPower', 'maxAttackers', 'maxFlyers', 'maxCounters', 'maxAttach', 'maxTribe', 'oppMaxCreatures', 'oppWipes', 'kills', 'losses', 'turnedUp'];
export function cleanFacts(raw) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const k of FACT_NUMBERS) { const v = raw[k]; if (Number.isSafeInteger(v) && v >= -999 && v <= 999) out[k] = v; }
  if (!Number.isSafeInteger(out.maxTribe) && raw.tribes && typeof raw.tribes === 'object') out.maxTribe = Math.min(99, Math.max(0, ...Object.values(raw.tribes).filter(Number.isSafeInteger)));
  if (Number.isSafeInteger(out.maxCreatures) && Number.isSafeInteger(out.maxAttackers)) out.known = true;
  return out;
}

// One finished match (from the app's match record) becomes counter bumps. Practice only feeds its
// own honour counters (never quests); friend matches count as played only.
// m: {mode: quick|story|friend|practice, outcome, format, turns, life, opponentLife, onPlay, durationMs, colors, seats, difficulty}
export function matchCounters(m = {}, day, {friendsToday = 0, friendCap = 3, practiceToday = 0, practiceCap = 30} = {}) {
  if (!['win', 'loss', 'draw'].includes(m.outcome)) return null;
  // Turns are the player's own (match-facts.js myTurns); older apps only sent Forge's turn number,
  // which counts both players' turns, so it is halved (rounded up) for them.
  const f = cleanFacts(m.facts), own = Number.isSafeInteger(m.myTurns) && m.myTurns >= 0 ? m.myTurns : Number.isSafeInteger(f.myTurns) ? f.myTurns : Number.isSafeInteger(m.turns) ? Math.ceil(m.turns / Math.max(2, m.seats | 0)) : 0;
  const week = playWeek(day), friend = m.mode === 'friend', turns = Math.min(own, 500), life = Number.isSafeInteger(m.life) ? m.life : null;
  const fmt = cleanFormat(m.format);
  if (m.mode === 'practice') {
    if (practiceToday >= practiceCap) return {};
    const p = {practice_matches: 1, [`d:${day}:practice_matches`]: 1};
    if (fmt) p['pf:' + fmt] = 1;
    if (m.outcome === 'win' && m.difficulty === 'Hard') p.practice_wins_hard = 1;
    return p;
  }
  const minutes = Math.min(90, Math.max(0, Math.round((Number(m.durationMs) || 0) / 60000)));
  if (friend && friendsToday >= friendCap) return {};
  const c = {matches: 1, minutes}, once = {};
  if (turns >= 3) c.matches5 = 1;
  if (m.mode === 'quick') c.quick_matches = 1;
  if (m.mode === 'story') c.story_matches = 1;
  if (m.outcome === 'draw') c.draws = 1;
  if (friend) { c.friend_matches = 1; if (turns >= 10) c.friend_long = 1; if (fmt) once['ff:' + fmt] = 1; once['fd:' + day] = 1; }
  if (m.mode === 'quick' && (m.seats | 0) >= 3) c.pod_matches = 1;
  // What the table showed (match-facts.js): creatures destroyed and the one-match feats, in every
  // mode but Practice. Friend feats have their own achievements; wins never count for friends.
  const k = Math.min(f.kills | 0, 60);
  if (k) { c.kills = k; if (m.mode === 'quick') c.quick_kills = k; if (friend) c.friend_kills = k; if (m.mode === 'quick' && (m.seats | 0) >= 3) c.pod_kills = k; }
  if (f.oppWipes) c.wipes = Math.min(f.oppWipes, 10);
  const feat = (key, ok) => { if (ok) once[key] = 1; };
  if (!friend) {
    feat('f_big15', f.oppBigTurn >= 15); feat('f_alpha6', f.maxAttackers >= 6); feat('f_swarm10', f.maxCreatures >= 10); feat('f_tokens8', f.maxTokens >= 8);
    feat('f_power15', f.maxPower >= 15); feat('f_flyers5', f.maxFlyers >= 5); feat('f_counters10', f.maxCounters >= 10); feat('f_attach3', f.maxAttach >= 3);
    feat('f_tribe6', f.maxTribe >= 6); feat('f_turnup3', f.turnedUp >= 3); feat('f_gain20', f.lifeGained >= 20); feat('f_life40', f.maxLife >= 40);
    feat('f_kills10', f.kills >= 10); feat('f_hand10', f.maxHand >= 10); feat('f_lands12', f.maxLands >= 12);
  } else {
    feat('f_friend_big10', f.oppBigTurn >= 10); feat('f_friend_swarm8', f.maxCreatures >= 8); feat('f_friend_wire', life !== null && life >= 1 && life <= 3);
  }
  if (m.outcome === 'win' && !friend) {
    const opp = Number.isSafeInteger(m.opponentLife) ? m.opponentLife : null, colours = cleanColours(m.colors);
    c.wins = 1;
    if (m.mode === 'quick') c.wins_quick = 1;
    if (m.mode === 'quick' && (m.seats | 0) >= 3) c.wins_pod = 1;
    if (m.onPlay === false) c.wins_draw = 1;
    if (turns && turns <= 3) c.wins_t3 = 1;
    if (turns === 13) c.wins_13 = 1;
    if (turns && turns <= 4) c.wins_t4 = 1;
    if (turns && turns <= 5) c.wins_fast = 1;
    if (turns && turns <= 8) c.wins_t8 = 1;
    if (turns >= 10) c.wins_t12 = 1;
    if (turns >= 15) c.wins_long = 1;
    if (turns >= 20) c.wins_marathon = 1;
    if (life !== null && life >= 20) c.wins_flawless = 1;
    if (life !== null && life >= 15) c.wins_healthy = 1;
    if (life !== null && life >= 1 && life <= 5) c.wins_low = 1;
    if (life === 1) c.wins_thread = 1;
    if (opp !== null && opp <= -5) c.wins_overkill = 1;
    if (opp === 0) c.wins_exact = 1;
    if (f.oppPoison >= 10) c.wins_poison = 1;
    if (f.oppLibraryMin === 0 && opp !== null && opp > 0) c.wins_mill = 1;
    if (Number.isSafeInteger(f.minLife) && Number.isSafeInteger(f.startLife) && f.minLife >= f.startLife) c.wins_untouched = 1;
    if (Number.isSafeInteger(f.minLife) && f.minLife <= 3) c.wins_phoenix = 1;
    if (f.known && f.maxAttackers === 0) c.wins_pacifist = 1;
    if (f.known && f.maxCreatures <= 1) c.wins_lone = 1;
    if (f.oppHandMin === 0) c.wins_hellbent = 1;
    if (f.known && f.oppMaxCreatures >= 2 * Math.max(1, f.maxCreatures)) c.wins_outnumbered = 1;
    if (f.known && turns >= 8 && f.losses === 0) c.wins_nolosses = 1;
    if (m.mode === 'story') c.story_wins = 1;
    if (colours.length === 1) once['mc:' + colours] = 1;
    if (colours.length === 2) { once['gp:' + colours] = 1; c.wins_2c = 1; }
    if (colours.length === 3) once['tc:' + colours] = 1;
    if (colours.length === 5) c.wins_five = 1;
    if (fmt) once['fmt:' + fmt] = 1;
  }
  const out = {...once};
  for (const [k, v] of Object.entries(c)) { if (!v) continue; out[k] = v; out[`d:${day}:${k}`] = v; out[`w:${week}:${k}`] = v; }
  return out;
}

// --- One payload for every client --------------------------------------------------------------
// GET /api/progress/achievements answers this, so the native Android app shows exactly what the web
// shows without re-implementing any rule: every row already carries its value, steps, tiers, claim
// state, rewards and pinned art. A hidden deed stays a riddle (no title, lore or art) until earned.
export const ACHIEVEMENTS_VERSION = 2;
export function achievementsPayload(ctx = {}, config = {}) {
  const rows = achievementRows(ctx), q = questRows(ctx);
  const achievements = rows.map(r => {
    const secret = r.hidden && !r.earned;
    return {id: r.id, tab: r.tab, act: r.act || null, title: secret ? null : r.title, lore: secret ? null : r.lore, riddle: r.riddle || null, hidden: !!r.hidden, secret,
      kind: r.honour ? 'honour' : r.feat ? 'feat' : 'chain', unit: r.unit || null, points: r.points, key: !!r.key, titleReward: r.titleReward || null, children: r.children || null, art: secret ? null : achievementArt(r.art),
      value: r.value, earned: r.earned, ready: r.ready, complete: r.complete,
      steps: r.steps.map((x, i) => ({...x, reward: achievementReward(r, i, config)}))};
  });
  const quest = x => ({id: x.id, label: x.label, level: x.level || 'weekly', need: x.need, have: x.have, done: x.done, claimed: x.claimed, ref: x.ref,
    canSwap: !!x.canSwap, swapped: !!x.swapped, reward: questReward(x, config)});
  return {version: ACHIEVEMENTS_VERSION, tabs: DEED_TABS.map(([id, label]) => ({id, label})), totals: deedTotals(rows), achievements,
    quests: {day: q.day, week: q.week, rerollUsed: !!q.rerollUsed, weeklyRerollUsed: !!q.weeklyRerollUsed, daily: q.daily.map(quest), weekly: q.weekly.map(quest),
      weeklyAll: {...q.weeklyAll, reward: {seals: config?.weekly?.allDoneSeals || {r: 1}}}},
    login: {week: LOGIN_WEEK, month: LOGIN_MONTH}};
}

