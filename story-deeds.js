// Story deeds (Randall, 1 Nov 2026): insightful, skill-based achievements woven into each act's story.
// Shared by the app (which checks a won Story battle against what the table showed) and the worker
// (which only accepts deed ids listed here, once each). Every test reads match facts the client saw:
// seat, own deck or Story deck, on the play, turns, lowest life, and the cards each side put on the battlefield.
// Act-wide deeds read Story progress: the Chronicler clears all 8 battles with the Story decks,
// the Two-Faced wins every battle from both seats.
const deed = (id, act, battle, title, lore, art, test, seat = 'hero') => ({id, act, battle, title, lore, art, test, seat});
const sawTheirs = (s, name) => s.theirCards?.includes(name), sawMine = (s, name) => s.myCards?.includes(name);
export const STORY_DEEDS = Object.freeze([
  // Act 1: The Dawn of Dominaria
  deed('a1-toll-unpaid', 1, 'a1b2', 'Toll Unpaid', "Cross the Goblin King's pass by turn 8. He never saw the sky coming.", 'Goblin King', s => s.turns <= 8),
  deed('a1-no-efreet', 1, 'a1b6', 'Fair Winds', 'Reach Serendib before its Efreet ever takes the field.', 'Serendib Efreet', s => !sawTheirs(s, 'Serendib Efreet')),
  deed('a1-unbroken', 1, 'a1b8', 'Unbroken', 'Beat Mishra without your life ever dropping below 10. The brothers were never this even.', "Mishra's War Machine", s => s.minLife >= 10),
  // Act 2: Legends and the Dark
  deed('a2-quick-deck', 2, 'a2b6', 'Faster Than The Deck', 'Beat Arcades Sabboth\'s control deck by turn 12, before it takes over.', 'Mirror Universe', s => s.turns <= 12),
  deed('a2-on-the-draw', 2, 'a2b8', 'Second Breath', 'Beat Nicol Bolas on the draw. Elder Dragons hate going first.', 'Nicol Bolas', s => s.onPlay === false),
  // Act 3: The Long Winter
  deed('a3-before-shade', 3, 'a3b6', 'Before the Shade', "Win Necro Summer before Ihsan's Shade ever rises.", "Ihsan's Shade", s => !sawTheirs(s, "Ihsan's Shade")),
  deed('a3-warm-blood', 3, 'a3b8', 'Warm Blood', 'Beat Lim-Dûl with 15 life or more. The dead never touched you.', 'Pestilence', s => s.endLife >= 15),
  // Act 4: The Jamuraan War
  deed('a4-flank', 4, 'a4b1', 'Ride Beside Me', "Have four creatures on the field at once in Jabari's charge.", 'Zhalfirin Commander', s => s.maxCreatures >= 4),
  deed('a4-no-sale', 4, 'a4b6', 'No Sale', 'Beat Pashad by turn 10. Keep your goats.', 'Prosperity', s => s.turns <= 10),
  deed('a4-on-the-draw', 4, 'a4b8', 'The Reeds Hold', 'Beat Kaervek on the draw.', "Kaervek's Torch", s => s.onPlay === false),
  // Act 5: The Rath Cycle
  deed('a5-hive', 5, 'a5b3', 'Kinfolk', 'Have five slivers on the field at once.', 'Muscle Sliver', s => s.maxSlivers >= 5),
  deed('a5-no-nightmare', 5, 'a5b7', 'Dreamless', "Win the Laboratory before Recurring Nightmare ever hits the table.", 'Recurring Nightmare', s => !sawTheirs(s, 'Recurring Nightmare')),
  deed('a5-for-mirri', 5, 'a5b8', 'For Mirri', 'Beat Volrath with Mirri fighting at your side.', 'Mirri, Cat Warrior', s => sawMine(s, 'Mirri, Cat Warrior')),
  // Act 6: Urza's War
  deed('a6-one-use', 6, 'a6b2', "Mi'uto", 'Take the Thran mana rig from the goblins of Shiv by turn 9.', 'Goblin Raider', s => s.turns <= 9),
  deed('a6-school-stands', 6, 'a6b8', 'The School Stands', 'Beat Gix with 15 life or more. Not one child lost.', 'Tolarian Academy', s => s.endLife >= 15),
  // Act 7: The Mercadian Masques
  deed('a7-general', 7, 'a7b3', 'General Nuisance', 'As Squee, have five creatures on the field at once. They gave him a hat for a reason.', 'Squee, Goblin Nabob', s => s.maxCreatures >= 5),
  deed('a7-unmasked', 7, 'a7b4', 'Unmasked', 'Beat Takara before Volrath ever shows his true shape.', 'Liability', s => !sawTheirs(s, 'Volrath the Fallen')),
  deed('a7-defiant', 7, 'a7b8', 'Defiant', 'Beat the Ascendant Evincar with Lin Sivvi on the field.', 'Lin Sivvi, Defiant Hero', s => sawMine(s, 'Lin Sivvi, Defiant Hero')),
  // Act 8: The Invasion
  deed('a8-kavu', 8, 'a8b2', 'Gaea Insisted', 'Win the defence of Yavimaya with a Kavu Titan on the field.', 'Kavu Titan', s => sawMine(s, 'Kavu Titan')),
  deed('a8-not-thirsty', 8, 'a8b3', "Ain't Thirsty", 'Beat Lord Dralnu before his Lord of the Undead ever reaches the table.', 'Lord of the Undead', s => !sawTheirs(s, 'Lord of the Undead')),
  deed('a8-destiny', 8, 'a8b8', 'This Is My Destiny', 'Beat Yawgmoth with Gerrard Capashen on the field.', 'Gerrard Capashen', s => sawMine(s, 'Gerrard Capashen')),
  // Act 9: The Mirari
  deed('a9-thirteen', 9, 'a9b1', 'Thirteen', 'Win the pit fight by turn 8. The house never saw it coming.', 'Kamahl, Pit Fighter', s => s.turns <= 8),
  deed('a9-squirrels', 9, 'a9b3', 'Keep an Eye Out', 'Have six creatures on the field at once in Krosa. The squirrels are watching.', 'Squirrel Nest', s => s.maxCreatures >= 6),
  deed('a9-penance', 9, 'a9b8', 'Penance', 'Beat the Patriarch with 10 life or more. Pain teaches lessons, but not this time.', 'Mirari', s => s.endLife >= 10),
]);
// Two act-wide deeds per act, from Story progress.
export const STORY_ACT_DEEDS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(act => [
  {id: `a${act}-chronicler`, act, kind: 'loaner', title: `Chronicler of Act ${act}`, lore: `Win all 8 battles of Act ${act} with the Story decks.`},
  {id: `a${act}-two-faced`, act, kind: 'both', title: `Both Sides of Act ${act}`, lore: `Win all 8 battles of Act ${act} from both seats. Understand the villains too.`},
]));
const ACT_ART = {1: "Mishra's War Machine", 2: 'Nicol Bolas', 3: "Lim-Dûl's High Guard", 4: "Kaervek's Torch", 5: "Volrath's Stronghold", 6: 'Phyrexian Negator', 7: 'Ascendant Evincar', 8: "Yawgmoth's Agenda", 9: 'Mirari'};
export const STORY_DEED_IDS = new Set([...STORY_DEEDS, ...STORY_ACT_DEEDS].map(d => d.id));
export const storyDeedArt = d => d.art || ACT_ART[d.act];

// The deeds one won battle earns. stats: {seat, own, onPlay, turns, minLife, endLife, maxCreatures, maxSlivers, myCards, theirCards}.
// refs: the player's story:* refs after this win (story-client), so the act-wide deeds can count it.
export function storyDeedsEarned(battleId, stats = {}, refs = []) {
  const out = [];
  if (!stats.own) for (const d of STORY_DEEDS) if (d.battle === battleId && d.seat === stats.seat) { try { if (d.test(stats)) out.push(d.id); } catch { /* a missing fact never earns */ } }
  const act = Number(/^a(\d+)b/.exec(battleId)?.[1]), has = new Set(refs), all = kind => Array.from({length: 8}, (_, i) => `story:a${act}b${i + 1}:${kind}`).every(r => has.has(r));
  for (const d of STORY_ACT_DEEDS) if (d.act === act && (d.kind === 'loaner' ? all('loaner') : all('clear') && all('villain'))) out.push(d.id);
  return out;
}
