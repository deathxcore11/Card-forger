// Act 2: The Dark Age (Revised, Legends, The Dark, Fallen Empires). Story and dialogue:
// /mnt/project-files/story/acts-1-3-script.md. Land set: 3ed (Randall, 1 Nov 17:54Z). No Hard yet (rule B3).
const cue = (start, big, low, win, loss) => ({start, big, low, win, loss});
export default {
  intro: [{who: 'narrator', line: 'After the Sylex the sun is dim, the Church burns spellcasters, and the old empires starve.'}],
  finale: [
    {who: 'tetsuo', line: "He's gone. He just... left."},
    {who: 'bolas', line: "I didn't come here to win, wizard. I came to see who was left.", whisper: true},
    {who: 'stage', line: 'The thrulls of Sarpadia rise against their masters. The empires fall one by one.'}],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Serra Angel'},
    inquisitor: {name: 'Inquisitor', title: 'Church of Tal', card: 'Inquisition', number: '47'},
    hazezon: {name: 'Hazezon Tamar', title: 'Merchant Prince', card: 'Hazezon Tamar', focus: '50% 25%'},
    johan: {name: 'Johan', title: 'Warlord', card: 'Johan', focus: '50% 25%'},
    kolevi: {name: 'Kolevi of Havenwood', title: 'Thelonite Druid', card: 'Thelonite Druid', focus: '50% 30%'},
    initiate: {name: 'Initiate', title: 'Order of the Ebon Hand', card: 'Initiates of the Ebon Hand', number: '39a', focus: '50% 30%'},
    tetsuo: {name: 'Tetsuo Umezawa', title: 'Last of the Umezawa', card: 'Tetsuo Umezawa', focus: '50% 25%'},
    icatian: {name: 'Icatian Captain', title: 'Guard of Icatia', card: 'Icatian Infantry', number: '7a', focus: '50% 30%'},
    thrullWizard: {name: 'Thrull Wizard', title: 'Breeding Pits', card: 'Thrull Wizard', focus: '50% 35%'},
    arcades: {name: 'Arcades Sabboth', title: 'Elder Dragon', card: 'Arcades Sabboth', focus: '50% 30%'},
    choir: {name: 'Choir of Tourach', title: 'Ebon Hand', card: 'Hymn to Tourach', number: '38a', focus: '50% 35%'},
    bolas: {name: 'Nicol Bolas', title: 'Elder Dragon', card: 'Nicol Bolas', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, kind: 'Arrival', title: "The Pretender's Inquisition", difficulty: 'Easy', rewardSet: 'drk', teaches: ['Two colours of mana'],
      blurb: 'After the Sylex, the sun is dim and the Church burns anyone who casts a spell. You cast spells.',
      hero: {who: 'you', deck: {name: 'Hedge Witch', colors: 'WG', list: `
4 Savannah Lions
4 Llanowar Elves
4 Grizzly Bears
4 Pearled Unicorn
4 War Mammoth
4 Elven Riders
3 Serra Angel
3 Giant Growth
3 White Knight
3 Craw Wurm
12 Forest
12 Plains`}},
      villain: {who: 'inquisitor', deck: {name: 'The Burning Church', colors: 'B', list: `
4 Bog Rats
4 Drudge Skeletons
4 Scathe Zombies
4 Frozen Shade
4 Bog Wraith
4 Black Knight
3 Inquisition
3 Unholy Strength
3 Weakness
3 Abomination
24 Swamp`}},
      scene: [{who: 'inquisitor', line: 'Magic brought the darkness. Magic will burn for it.'}, {who: 'inquisitor', line: 'You carry the smell of it. Kneel.'}, {who: 'inquisitor', line: 'Confess, or be shown.'}],
      cues: {villain: cue('Burn the witch.', 'The Church sees all.', 'Send for more brothers!', 'Ashes are honest.', 'Heresy... walks free.')}},
    {slot: 2, kind: 'Lesson', title: "Johan's Crossing", difficulty: 'Easy', rewardSet: 'leg', teaches: ['Legendary creatures', 'Three colours'],
      blurb: 'A merchant prince defends his desert city from a warlord who wants it. Only one of them leaves a legend.',
      hero: {who: 'hazezon', deck: {name: 'The Bazaar Guard', colors: 'RGW', list: `
3 Hazezon Tamar
2 Kei Takahashi
2 Craw Wurm
4 Savannah Lions
4 Llanowar Elves
4 Grizzly Bears
4 Knights of Thorn
3 Serra Angel
4 Elven Riders
4 Giant Growth
2 Lightning Bolt
4 Savannah
2 Plateau
2 Taiga
8 Plains
8 Forest`}},
      villain: {who: 'johan', deck: {name: "Johan's Host", colors: 'RGW', list: `
3 Stangg
2 Elven Riders
4 Brassclaw Orcs
4 Dwarven Soldier
4 Mountain Yeti
3 Craw Wurm
4 Lightning Bolt
4 Hurloon Minotaur
4 Grizzly Bears
4 Ironroot Treefolk
4 Taiga
2 Plateau
9 Mountain
9 Forest`}},
      scene: [{who: 'johan', line: 'Hazezon. Open the gates and I keep your city whole.'}, {who: 'hazezon', line: "My city is my people, Johan. They don't open."}, {who: 'johan', line: "Then they'll be a story. A short one."}, {who: 'hazezon', line: 'Stay close. Stories are how we win here.', aside: 'to you'}],
      cues: {hero: cue("Bazaar's closed.", 'Every sand-warrior answers.', 'Not my people.', 'Go home, warlord.', 'Save who you can.'),
        villain: cue('March.', 'Kneel or be legend.', 'Hold, damn you!', 'Mine.', "This isn't finished.")}},
    {slot: 3, kind: 'Lesson', title: 'The Thallid Grove', difficulty: 'Normal', rewardSet: 'fem', teaches: ['Tokens', 'Counters'],
      blurb: 'Sarpadia is starving. The elves grow fungus soldiers to survive; the Ebon Hand wants the grove for its thrull pits.',
      hero: {who: 'kolevi', deck: {name: 'Havenwood Spores', colors: 'G', list: `
4 Thallid
4 Thallid Devourer
4 Spore Flower
4 Elvish Farmer
3 Feral Thallid
4 Thelonite Druid
2 Fungal Bloom
4 Llanowar Elves
4 Giant Growth
3 Craw Wurm
24 Forest`}},
      villain: {who: 'initiate', deck: {name: 'The Ebon Hand', colors: 'B', list: `
4 Bog Rats
4 Order of the Ebon Hand
4 Necrite
4 Drudge Skeletons
4 Armor Thrull
4 Derelor
3 Breeding Pit
4 Terror
3 Sengir Vampire
2 Drain Life
24 Swamp`}},
      scene: [{who: 'initiate', line: 'We are no longer Nature\'s children, but her masters.', quote: true}, {who: 'kolevi', line: 'The magic at the heart of all living things can bear awe-inspiring fruit.', quote: true}, {who: 'initiate', line: "Then we'll harvest it."}, {who: 'kolevi', line: 'The thallids grow faster than you can cut. Watch.'}],
      cues: {hero: cue('Grow.', 'Havenwood answers!', 'Spore and root, hold!', 'The grove lives.', "Burn the spores... don't let them have it."),
        villain: cue('For the Hand.', 'Kneel to Tourach.', 'Bring the thrulls!', 'Harvest.', 'The Hand remembers.')}},
    {slot: 4, kind: 'Rival', title: "Tetsuo's Test", difficulty: 'Normal', rewardSet: 'leg', teaches: ['Counterspells', 'Multicolour gold cards'],
      blurb: "The last great Umezawa wizard has heard about the rift-walker. He wants to know if you're a weapon or a friend.",
      hero: {who: 'you', deck: {name: 'Rift-Walker', colors: 'WG', list: `
4 Savannah Lions
4 White Knight
4 Llanowar Elves
4 Elven Riders
3 Serra Angel
4 Swords to Plowshares
3 Disenchant
4 Giant Growth
3 Craw Wurm
3 Pearled Unicorn
4 Savannah
10 Plains
10 Forest`}},
      villain: {who: 'tetsuo', deck: {name: 'The Umezawa Arts', colors: 'UBR', list: `
3 Tetsuo Umezawa
2 Sol'kanar the Swamp King
2 Hypnotic Specter
2 Hill Giant
4 Dragon Whelp
4 Lightning Bolt
2 Counterspell
2 Scathe Zombies
4 Terror
3 Sengir Vampire
1 Mahamoti Djinn
2 Merfolk of the Pearl Trident
3 Fireball
2 Disintegrate
3 Underground Sea
3 Volcanic Island
3 Badlands
5 Island
5 Swamp
5 Mountain`}},
      scene: [{who: 'tetsuo', line: 'You came through a rift. So did the thing I\'m hunting.'}, {who: 'tetsuo', line: 'An old dragon. Older than kings. He collects wizards like you.'}, {who: 'tetsuo', line: "Show me you can't be collected."}],
      cues: {villain: cue('Show me.', 'Can you see it coming?', 'Good. Good.', 'Not yet ready.', 'Then we hunt together.')}},
    {slot: 5, kind: 'Lesson', title: 'The Thrull Rebellion', difficulty: 'Normal', rewardSet: 'fem', teaches: ['Sacrifice'],
      blurb: 'The Ebon Hand made their thrulls smart enough to help with the sacrifices. That turned out to be a mistake.',
      hero: {who: 'icatian', deck: {name: 'Valiant Icatia', colors: 'W', list: `
4 Icatian Infantry
4 Icatian Javelineers
2 Order of Leitbur
2 Mesa Pegasus
4 Farrel's Zealot
4 Icatian Phalanx
4 Combat Medic
1 Serra Angel
2 Benalish Hero
2 Swords to Plowshares
2 Healing Salve
3 White Knight
2 Spirit Link
24 Plains`}},
      villain: {who: 'thrullWizard', deck: {name: 'The Breeding Pits', colors: 'B', list: `
4 Thrull Champion
4 Drudge Skeletons
4 Necrite
4 Armor Thrull
4 Derelor
3 Breeding Pit
4 Bog Rats
3 Order of the Ebon Hand
4 Terror
2 Animate Dead
24 Swamp`}},
      scene: [{who: 'icatian', line: 'Valiant Icatia was the last of the Sarpadian empires to fall.', quote: true}, {who: 'icatian', line: 'Not today, though.'}, {who: 'thrullWizard', line: 'Master says: sacrifice. Thrull asks: whose?'}, {who: 'icatian', line: '...Did that thrull just ask a question?'}],
      cues: {villain: cue('Feed the altar.', 'More thrulls, more power.', "The thrulls aren't listening!", 'Icatia falls.', 'The thrulls... turned...')}},
    {slot: 6, kind: 'Meta', title: 'The Deck', difficulty: 'Normal', rewardSet: 'leg', teaches: ['Card advantage', 'Playing around counterspells'],
      blurb: 'An Elder Dragon who believes in order above everything. His deck agrees: counter it, answer it, win slowly. The era\'s legendary control deck.',
      hero: {who: 'you', deck: {name: 'Kher Keep Fire', colors: 'R', list: `
4 Dwarven Soldier
4 Brassclaw Orcs
4 Ball Lightning
4 Mountain Yeti
4 Lightning Bolt
4 Fireball
3 Disintegrate
4 Dragon Whelp
3 Shivan Dragon
2 Blood Moon
24 Mountain`}},
      villain: {who: 'arcades', deck: {name: 'The Deck', colors: 'WUG', archetype: 'The Deck (control)', list: `
2 Arcades Sabboth
4 Counterspell
4 Mana Drain
4 Swords to Plowshares
3 Disenchant
2 Moat
3 Serra Angel
2 Jayemdae Tome
2 Control Magic
1 Balance
2 Wrath of God
2 Birds of Paradise
2 Disrupting Scepter
3 Mahamoti Djinn
4 Tundra
2 Tropical Island
2 Savannah
2 Maze of Ith
7 Island
7 Plains`}},
      scene: [{who: 'arcades', line: 'Chaos has a smell. You reek of it.'}, {who: 'arcades', line: 'I do not attack. I simply wait until everything you do has failed.'}, {who: 'arcades', line: "Begin. Or don't. The result is the same."}],
      cues: {villain: cue('Proceed.', 'Denied.', '...Irregular.', 'Order holds.', 'Impossible. Recount.')}},
    {slot: 7, kind: 'Meta', title: 'Hymn to Tourach', difficulty: 'Normal', rewardSet: 'fem', teaches: ['Discard'],
      blurb: "The Ebon Hand's choir sings a hymn that drives warriors mad. The era's discard deck.",
      hero: {who: 'hazezon', deck: {name: 'The Bazaar Guard', colors: 'RGW', list: `
3 Hazezon Tamar
4 White Knight
4 Savannah Lions
4 Llanowar Elves
4 Knights of Thorn
3 Serra Angel
4 Elven Riders
4 Giant Growth
3 Lightning Bolt
3 Swords to Plowshares
4 Savannah
2 Plateau
2 Taiga
8 Plains
8 Forest`}},
      villain: {who: 'choir', deck: {name: 'The Hymn', colors: 'B', archetype: 'Black discard', list: `
4 Hymn to Tourach
4 Hypnotic Specter
4 Dark Ritual
4 Black Knight
4 Order of the Ebon Hand
4 Necrite
3 Sengir Vampire
4 Terror
3 Drain Life
1 Mind Twist
1 Pestilence
24 Swamp`}},
      scene: [{who: 'choir', line: 'Tourach... Tourach...', aside: 'singing, low'}, {who: 'hazezon', line: "Cover your ears. Don't think about what you're holding."}, {who: 'choir', line: 'The eerie, wailing Hymn caused insanity even in hardened warriors.', quote: true}],
      cues: {villain: cue('Sing.', 'Forget. Forget.', 'The Hymn falters!', 'Silence.', 'Tourach... hears...')}},
    {slot: 8, kind: 'Boss', title: 'The Last Elder Dragon', difficulty: 'Normal', rewardSet: 'leg', teaches: ['Everything so far'],
      blurb: 'Under the Wastes, the thing Tetsuo has hunted his whole life opens one eye.',
      hero: {who: 'tetsuo', deck: {name: 'The Umezawa Arts', colors: 'UBR', list: `
4 Tetsuo Umezawa
2 Hypnotic Specter
2 Gray Ogre
4 Lightning Bolt
2 Counterspell
2 Unsummon
4 Terror
3 Fireball
3 Dragon Whelp
2 Sengir Vampire
2 Shivan Dragon
3 Prodigal Sorcerer
3 Disintegrate
4 Volcanic Island
4 Underground Sea
4 Badlands
4 Island
4 Swamp
4 Mountain`}},
      villain: {who: 'bolas', deck: {name: 'The Elder Dragon', colors: 'BRu', list: `
3 Nicol Bolas
2 Royal Assassin
3 Hymn to Tourach
4 Dark Ritual
4 Lightning Bolt
4 Hypnotic Specter
4 Black Knight
3 Sengir Vampire
3 Shivan Dragon
3 Fireball
3 Terror
4 Underground Sea
3 Volcanic Island
4 Badlands
7 Swamp
6 Mountain`}},
      scene: [{who: 'bolas', line: 'An Umezawa. Your grandfather made that face too.'}, {who: 'tetsuo', line: "You're shorter than the legends said."}, {who: 'bolas', line: "The legends were written by survivors. There aren't many."}, {who: 'bolas', line: "And you. The little rift-walker. I've been waiting a long time to meet one of you.", aside: 'to you'}, {who: 'tetsuo', line: "Don't talk to him. Don't bargain. Just fight."}],
      villainScene: [{who: 'bolas', line: 'Every hero in this age will die. I simply want to watch how.'}],
      cues: {hero: cue('Now.', 'For every Umezawa.', 'Not like this...', 'Back into the dark.', 'Run. Remember his face.'),
        villain: cue('Entertain me, wizard.', 'Kneel.', 'Interesting.', "Another Umezawa. I'll add you to the shelf.", 'Keep this victory. I have time.')}},
  ],
};
