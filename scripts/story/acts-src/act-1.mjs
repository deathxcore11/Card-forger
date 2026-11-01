// Act 1: The Dawn of Dominaria. Story and dialogue: /mnt/project-files/story/acts-1-3-script.md
// (act map thread, 1 Nov 2026). Decks: drafted from the act's pool only, then checked and simulated.
// Rule B3: Act 1 opponents stay at Easy and Normal; there is no Hard opponent before the Act 3 boss.
const cue = (start, big, low, win, loss) => ({start, big, low, win, loss});
export default {
  intro: [{who: 'narrator', line: 'Dominaria, before the long winter. Two brothers are building a war.'}],
  finale: [
    {who: 'urza', line: 'The Sylex. It ends the war.'},
    {who: 'tawnos', line: 'Master, the whole continent...'},
    {who: 'urza', line: 'It ends the war.'},
    {who: 'stage', line: 'A white flash. Then snow.'},
    {who: 'mishra', line: 'It was never just me, brother. Someone else was listening.', whisper: true}],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Prodigal Sorcerer'},
    archers: {name: 'Elvish Archer', title: 'Llanowar', card: 'Elvish Archers', focus: '50% 25%'},
    goblinKing: {name: 'Goblin King', title: 'Lord of the Pass', card: 'Goblin King', focus: '50% 30%'},
    whiteKnight: {name: 'White Knight', title: 'Holder of the Ford', card: 'White Knight', focus: '50% 25%'},
    blackKnight: {name: 'Black Knight', title: 'Challenger', card: 'Black Knight', focus: '50% 25%'},
    erhnam: {name: 'Erhnam Djinn', title: 'Collector of People', card: 'Erhnam Djinn', focus: '50% 30%'},
    titania: {name: 'Titania', title: 'Voice of Argoth', fixed: {card: 'Titania, Voice of Gaea', set: 'bro', number: '193', id: 'deeb6a21-23b0-44f1-b70e-5899bb9d4a84', crop: 'https://cards.scryfall.io/art_crop/front/d/e/deeb6a21-23b0-44f1-b70e-5899bb9d4a84.jpg', artist: 'Cristi Balanescu'}, focus: '50% 25%'},
    urza: {name: 'Urza', title: 'The Artificer', fixed: {card: 'Urza, Prince of Kroog', set: 'bro', number: '226', id: '5a7329cd-95af-4d71-984f-f5f28982520c', crop: 'https://cards.scryfall.io/art_crop/front/5/a/5a7329cd-95af-4d71-984f-f5f28982520c.jpg', artist: 'Joshua Raphael'}, focus: '50% 25%'},
    sindbad: {name: 'Sindbad', title: 'Captain of Rabiah', card: 'Sindbad', focus: '50% 30%'},
    efreet: {name: 'Serendib Efreet', title: 'Guardian of Serendib', card: 'Serendib Efreet', focus: '50% 30%'},
    tawnos: {name: 'Tawnos', title: "Urza's Apprentice", fixed: {card: "Tawnos, Urza's Apprentice", set: 'c18', number: '45', id: 'a031a6c1-d7d1-4980-ac8e-30440ff4408f', crop: 'https://cards.scryfall.io/art_crop/front/a/0/a031a6c1-d7d1-4980-ac8e-30440ff4408f.jpg', artist: 'Matt Stewart'}, focus: '50% 25%'},
    ashnod: {name: 'Ashnod', title: "Mishra's Lieutenant", fixed: {card: 'Ashnod, Flesh Mechanist', set: 'bro', number: '84', id: '5eb43c15-50a9-488f-b0be-84a5e0a6d10b', crop: 'https://cards.scryfall.io/art_crop/front/5/e/5eb43c15-50a9-488f-b0be-84a5e0a6d10b.jpg', artist: 'Howard Lyon'}, focus: '50% 25%'},
    mishra: {name: 'Mishra', title: 'The Brother', fixed: {card: 'Mishra, Excavation Prodigy', set: 'bro', number: '140', id: 'f5d02416-8578-40a5-bf31-d1ef9b8764f1', crop: 'https://cards.scryfall.io/art_crop/front/f/5/f5d02416-8578-40a5-bf31-d1ef9b8764f1.jpg', artist: 'Donato Giancola'}, focus: '50% 25%'},
  },
  battles: [
    {slot: 1, kind: 'Arrival', title: 'The First Summons', difficulty: 'Easy', rewardSet: 'lea', teaches: ['Land drops and mana', 'Casting creatures', 'Attacking and blocking'],
      blurb: 'You wake in a forest that has never seen a planeswalker. Its archers have their bows up already.',
      hero: {who: 'you', deck: {name: 'Knights of the Dawn', colors: 'W', list: `
4 Savannah Lions
4 Benalish Hero
4 Pearled Unicorn
4 White Knight
4 War Elephant
4 Moorish Cavalry
3 Northern Paladin
3 Serra Angel
3 Holy Strength
3 Healing Salve
24 Plains`}},
      villain: {who: 'archers', deck: {name: 'Bows of Llanowar', colors: 'G', list: `
4 Llanowar Elves
4 Timber Wolves
4 Grizzly Bears
4 Elvish Archers
4 Wyluli Wolf
4 War Mammoth
3 Ironroot Treefolk
3 Craw Wurm
2 Giant Growth
4 Shanodin Dryads
24 Forest`}},
      scene: [{who: 'archers', line: 'Stop. You came out of the air.'}, {who: 'archers', line: "Things that come out of the air don't usually leave."}, {who: 'archers', line: 'Show us what you are. Call something.'}],
      cues: {villain: cue('Bows up.', 'The forest answers us, not you.', 'Fall back to the trees!', 'Go back to wherever you fell from.', 'Fine. The forest will remember you.')}},
    {slot: 2, kind: 'Lesson', title: "The Goblin King's Toll", difficulty: 'Easy', rewardSet: 'lea', teaches: ['Flying'],
      blurb: 'A mountain pass with a toll and a king who collects it. His army is big, loud and stuck on the ground.',
      hero: {who: 'you', deck: {name: 'Wings of the Dawn', colors: 'W', list: `
4 Mesa Pegasus
4 Pearled Unicorn
4 Serra Angel
4 Wall of Swords
4 Benalish Hero
4 Savannah Lions
4 Holy Armor
2 Swords to Plowshares
2 Healing Salve
4 Moorish Cavalry
24 Plains`}},
      villain: {who: 'goblinKing', deck: {name: "The King's Rabble", colors: 'R', list: `
4 Goblin King
4 Mons's Goblin Raiders
4 Goblin Balloon Brigade
4 Ironclaw Orcs
4 Gray Ogre
4 Hurloon Minotaur
4 Hill Giant
4 Two-Headed Giant of Foriys
4 Uthden Troll
24 Mountain`}},
      scene: [{who: 'goblinKing', line: 'Halt! This pass belongs to the king.'}, {who: 'goblinKing', line: 'I am the king.'}, {who: 'goblinKing', line: "Toll is everything you've got. Pay or get stomped."}, {who: 'goblinKing', line: '...Why is your stuff flying? Nobody said flying was allowed.'}],
      cues: {villain: cue('Charge! No, the OTHER way!', "Look at THAT one. That one's mine.", 'Who let the sky in?!', "Toll's paid! Hah!", 'Next time, nets. Lots of nets.')}},
    {slot: 3, kind: 'Lesson', title: 'Knights at the Ford', difficulty: 'Normal', rewardSet: 'lea', teaches: ['First strike', 'Protection from a colour'],
      blurb: 'Two knights have held the same river crossing for years. Today one of them finally wants it settled.',
      hero: {who: 'whiteKnight', deck: {name: 'The Order of the Ford', colors: 'W', list: `
4 White Knight
4 Savannah Lions
4 Benalish Hero
4 Northern Paladin
4 Moorish Cavalry
3 Serra Angel
4 Swords to Plowshares
3 Disenchant
3 Blessing
3 Holy Strength
24 Plains`}},
      villain: {who: 'blackKnight', deck: {name: 'The Dark Lance', colors: 'B', list: `
2 Black Knight
2 Raise Dead
4 Erg Raiders
2 Hasran Ogress
4 Scathe Zombies
2 Bog Wraith
2 Deathgrip
1 Sengir Vampire
2 Frozen Shade
2 Dark Ritual
2 Fear
2 Weakness
2 Drain Life
3 Unholy Strength
4 Drudge Skeletons
24 Swamp`}},
      scene: [{who: 'blackKnight', line: 'Every morning, you. Every evening, you.'}, {who: 'whiteKnight', line: 'Every morning, you lose.'}, {who: 'blackKnight', line: 'Not today. Today I brought a witness.', aside: 'He looks at you.'}, {who: 'whiteKnight', line: "Then let them see how it's done. Watch the first blow. It's the only one that matters."}],
      cues: {hero: cue('Steady.', 'There. First, and last.', "I've held this ford through worse.", 'Same time tomorrow.', 'Go on, cross. Just this once.'),
        villain: cue('No mercy at the ford.', 'Feel that, paladin?', "The river's getting deeper...", 'At last!', 'Tomorrow, then.')}},
    {slot: 4, kind: 'Rival', title: 'The Djinn of the Bottle', difficulty: 'Normal', rewardSet: 'arn', teaches: ['Instants on the opponent\'s turn', 'Bounce'],
      blurb: 'A rift drops you into Rabiah, the world of the Thousand and One Nights, at the feet of a djinn who is bored of granting wishes.',
      hero: {who: 'you', deck: {name: 'Rift-Walker\'s Court', colors: 'WU', list: `
4 Serendib Efreet
4 Mesa Pegasus
4 Moorish Cavalry
4 Serra Angel
4 Phantom Monster
2 Mahamoti Djinn
4 Swords to Plowshares
4 Unsummon
2 Counterspell
2 Tundra
12 Plains
10 Island
4 Flying Men`}},
      villain: {who: 'erhnam', deck: {name: 'The Djinn\'s Menagerie', colors: 'G', list: `
4 Erhnam Djinn
4 Ghazbán Ogre
4 Llanowar Elves
4 Kird Ape
4 Ifh-Bíff Efreet
4 Giant Spider
3 Craw Wurm
4 Giant Growth
3 Sandstorm
2 Desert Twister
20 Forest
4 Taiga`}},
      scene: [{who: 'erhnam', line: "A new face! Do you know how long it's been since I had a new face?"}, {who: 'erhnam', line: 'Every visitor wishes. Gold, wives, kingdoms. Tiresome.'}, {who: 'erhnam', line: "You will not wish. You will duel. Win, and I'll show you the way home."}, {who: 'erhnam', line: 'Lose, and you stay. I collect people.'}],
      cues: {villain: cue('Entertain me.', 'Behold the gift of the djinn.', 'Ah. That stung. How novel.', 'Another for my collection.', 'Go, then! The rift is that way. Visit.')}},
    {slot: 5, kind: 'Lesson', title: 'Argoth Burns', difficulty: 'Normal', rewardSet: 'atq', teaches: ['Artifacts', 'Answering artifacts'],
      blurb: 'The rift spits you out on Argoth, a forest island. Two brothers are cutting it down to build their war.',
      hero: {who: 'titania', deck: {name: 'The Argoth Grove', colors: 'G', list: `
2 Argothian Pixies
2 Citanul Druid
2 Ironroot Treefolk
2 Giant Spider
4 Argothian Treefolk
4 Llanowar Elves
4 Grizzly Bears
4 War Mammoth
3 Craw Wurm
2 Crumble
2 Titania's Song
3 Giant Growth
2 Wyluli Wolf
24 Forest`}},
      villain: {who: 'urza', deck: {name: 'The Mining Crews', colors: 'W', list: `
4 Su-Chi
4 Yotian Soldier
4 Clay Statue
4 Juggernaut
4 Onulet
4 Ornithopter
3 Obsianus Golem
3 Battering Ram
2 Triskelion
4 Mishra's Factory
4 Urza's Mine
4 Urza's Power Plant
4 Urza's Tower
8 Plains
4 Swords to Plowshares`}},
      scene: [{who: 'titania', line: "You smell of the rift. Good. You're not one of his."}, {who: 'titania', line: 'Urza takes our trees for fuel. Mishra takes them for spite. Both take.'}, {who: 'urza', line: 'The island has the finest timber in the world. That makes it a resource.'}, {who: 'urza', line: 'I have a war to win. Sentiment is a luxury.'}, {who: 'titania', line: 'Then we will be very expensive.'}],
      cues: {hero: cue('The forest stands.', 'Roots, rise!', 'Argoth bleeds.', 'Go home, artificer.', "He'll burn us all..."),
        villain: cue('Proceed.', 'Note the efficiency.', 'Recalculating.', 'Clear it.', 'A delay. Nothing more.')}},
    {slot: 6, kind: 'Meta', title: 'The Efreet of Serendib', difficulty: 'Normal', rewardSet: 'arn', teaches: ['Tempo', 'Counterspells'],
      blurb: 'The rift flickers back to Rabiah. Sindbad needs a crew, and the island of Serendib has its own guardian.',
      hero: {who: 'sindbad', deck: {name: "Sindbad's Crew", colors: 'U', list: `
4 Sindbad
4 Merfolk of the Pearl Trident
4 Lord of Atlantis
4 Flying Men
4 Pirate Ship
3 Island Fish Jasconius
4 Sea Serpent
4 Unsummon
3 Counterspell
2 Psionic Blast
24 Island`}},
      villain: {who: 'efreet', deck: {name: 'Fires of Serendib', colors: 'UR', archetype: 'Blue-red tempo', list: `
4 Serendib Efreet
4 Kird Ape
4 Dragon Whelp
3 Shivan Dragon
4 Granite Gargoyle
4 Lightning Bolt
4 Counterspell
3 Fireball
2 Psionic Blast
4 Unsummon
4 Volcanic Island
10 Island
10 Mountain`}},
      scene: [{who: 'sindbad', line: "You again! The rift-walker. I've a ship, a map and no crew. You'll do."}, {who: 'efreet', line: 'Serendib is not for sailors.'}, {who: 'sindbad', line: "Everything is for sailors, friend. That's what the sea is for."}, {who: 'efreet', line: 'Then the sea may have what\'s left of you.'}],
      cues: {hero: cue('Hoist!', 'Fair winds!', "I've been shipwrecked six times. Seven's fine.", 'To Serendib!', 'Back to port...'),
        villain: cue('Turn back.', 'Burn, little boats.', 'Even fire tires.', 'Serendib keeps its own.', 'Go. Take nothing.')}},
    {slot: 7, kind: 'Meta', title: 'Factories at Kroog', difficulty: 'Normal', rewardSet: 'atq', teaches: ['Artifact creatures', 'Sacrifice'],
      blurb: "The war comes to Kroog, Urza's capital. His apprentice holds the walls against Mishra's cruellest engineer.",
      hero: {who: 'tawnos', deck: {name: 'The Walls of Kroog', colors: 'W', list: `
4 Yotian Soldier
4 Su-Chi
4 Juggernaut
4 Argivian Blacksmith
4 White Knight
3 Serra Angel
4 Swords to Plowshares
3 Disenchant
2 Tawnos's Weaponry
4 Savannah Lions
20 Plains
4 Mishra's Factory`}},
      villain: {who: 'ashnod', deck: {name: "Ashnod's Engines", colors: 'B', list: `
4 Hasran Ogress
4 Black Knight
4 Su-Chi
4 Clay Statue
4 Juggernaut
4 Erg Raiders
2 Ashnod's Altar
4 Terror
2 Animate Dead
2 Sengir Vampire
2 Drain Life
20 Swamp
4 Mishra's Factory`}},
      scene: [{who: 'ashnod', line: "Tawnos! Still holding the master's tools?"}, {who: 'tawnos', line: 'Still taking people apart, Ashnod?'}, {who: 'ashnod', line: "Only to see how they work. You'd do the same if he let you."}, {who: 'tawnos', line: 'Help me hold the factories. If Kroog falls, nothing stops her.', aside: 'to you'}, {who: 'ashnod', line: "Oh, bring your friend. I've never taken a planeswalker apart."}],
      cues: {hero: cue('Seal the gates.', 'Built for exactly this.', 'Hold the line!', 'Kroog stands.', 'Get the people out...'),
        villain: cue("Let's see what's inside.", "Isn't she beautiful?", "That's... rude.", 'Mishra will be so pleased.', "Next time I'm bringing the big altar.")}},
    {slot: 8, kind: 'Boss', title: "Mishra's War Machine", difficulty: 'Normal', rewardSet: 'atq', teaches: ['Everything so far'],
      blurb: 'Thirty years of war, two halves of one stone, and two brothers meeting on the same battlefield at last.',
      hero: {who: 'urza', deck: {name: "Urza's Engines", colors: 'W', list: `
4 Urza's Mine
4 Urza's Power Plant
4 Urza's Tower
12 Plains
4 Yotian Soldier
2 Su-Chi
1 Pearled Unicorn
1 Benalish Hero
1 Juggernaut
2 Healing Salve
2 Triskelion
2 Colossus of Sardia
2 Swords to Plowshares
1 Disenchant
2 Wall of Swords
4 Ornithopter
3 Pearled Unicorn
3 Mesa Pegasus
2 Onulet
2 Holy Strength
2 Benalish Hero`}},
      villain: {who: 'mishra', deck: {name: "Mishra's Army", colors: 'R', archetype: 'Artifact aggression', list: `
4 Mishra's Factory
18 Mountain
4 Su-Chi
4 Juggernaut
4 Dragon Engine
3 Mishra's War Machine
4 Clay Statue
2 Triskelion
2 Hurloon Minotaur
2 Shatter
4 Lightning Bolt
3 Fireball
2 Atog
4 Dwarven Weaponsmith`}},
      scene: [{who: 'mishra', line: 'Brother. You look old.'}, {who: 'urza', line: "You look like you've made friends you shouldn't have."}, {who: 'mishra', line: "Friends? They listen. That's more than you ever did."}, {who: 'urza', line: 'Give me the Mightstone, Mishra.'}, {who: 'mishra', line: 'Come and take it. You always do.'}],
      villainScene: [{who: 'mishra', line: "They told me I'd finally be better than you."}],
      cues: {hero: cue('Begin.', 'Exactly as designed.', '...Mishra.', "It's over. Give it to me.", 'I will build something greater.'),
        villain: cue('Just like when we were boys.', 'Look what I made without you!', 'You always win. Why do you always win?', 'Finally. FINALLY.', 'Then let it all burn.')}},
  ],
};
