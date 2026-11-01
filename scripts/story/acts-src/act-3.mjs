// Act 3: The Long Winter (Fourth Edition, Ice Age, Homelands, Alliances). Story and dialogue:
// /mnt/project-files/story/acts-1-3-script.md. Land set: ice, snow-covered basics too.
// Easy, then Normal, then the game's first Hard boss (rule B3).
const cue = (start, big, low, win, loss) => ({start, big, low, win, loss});
export default {
  intro: [{who: 'narrator', line: 'Centuries after the Sylex, the snow never melts.'}],
  finale: [
    {who: 'laina', line: 'Look. The sky.'},
    {who: 'stage', line: 'Green light. Freyalise casts the World Spell. The ice starts to melt.'},
    {who: 'leshrac', line: 'Pity. He was useful.', whisper: true},
    {who: 'laina', line: "The winter's over. After all this time, it's over."}],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Brainstorm', number: '61'},
    kjeldor: {name: 'Kjeldoran Guard', title: 'Royal Guard of Kjeldor', card: 'Kjeldoran Royal Guard', number: '38', focus: '50% 25%'},
    balduvian: {name: 'Balduvian Raider', title: 'Barbarian of Balduvia', card: 'Balduvian Barbarians', number: '172', focus: '50% 30%'},
    gustha: {name: 'Gustha Ebbasdotter', title: 'Kjeldoran Royal Mage', card: 'Brainstorm', number: '61', focus: '50% 30%'},
    varchild: {name: 'Varchild', title: 'Mercenary Captain', fixed: {card: 'Varchild, Betrayer of Kjeldor', set: 'c18', number: '28', id: '7849b360-afad-4f50-b455-3d118f7bfcd0', crop: 'https://cards.scryfall.io/art_crop/front/7/8/7849b360-afad-4f50-b455-3d118f7bfcd0.jpg', artist: 'Lucas Graciano'}, focus: '50% 25%'},
    laina: {name: 'Laina', title: 'Elvish Council of Fyndhorn', card: 'Freyalise Supplicant', number: '239', focus: '50% 25%'},
    leshrac: {name: 'Leshrac', title: 'Walker of Night', card: "Leshrac's Sigil", number: '144', focus: '50% 35%'},
    reveka: {name: 'Reveka', title: 'Wizard Savant', card: 'Reveka, Wizard Savant', focus: '50% 30%'},
    baron: {name: 'Baron Sengir', title: 'Lord of Ulgrotha', card: 'Baron Sengir', focus: '50% 25%'},
    cohort: {name: "Lim-Dûl's Cohort", title: 'The Risen Dead', card: "Lim-Dûl's Cohort", number: '145', focus: '50% 30%'},
    lucilde: {name: 'Lucilde Fiksdotter', title: 'Knight Commander', card: 'Legions of Lim-Dûl', focus: '50% 30%'},
    ihsan: {name: "Ihsan's Shade", title: 'The Fallen Knight', card: "Ihsan's Shade", focus: '50% 30%'},
    grandmother: {name: 'Grandmother Sengir', title: 'Matriarch of the Castle', card: 'Grandmother Sengir', focus: '50% 25%'},
    limdul: {name: 'Lim-Dûl', title: 'The Necromancer', fixed: {card: 'Lim-Dûl the Necromancer', set: 'tsp', number: '114', id: 'b8a3cdfe-0289-474b-b9c4-07e8c6588ec5', crop: 'https://cards.scryfall.io/art_crop/front/b/8/b8a3cdfe-0289-474b-b9c4-07e8c6588ec5.jpg', artist: 'Matt Cavotta'}, focus: '50% 25%'},
  },
  battles: [
    {slot: 1, kind: 'Arrival', title: 'The Pass at Kjeldor', difficulty: 'Easy', rewardSet: 'ice', teaches: ['Snow'],
      blurb: 'Centuries after the Sylex, the snow never melts. Two nations fight over the last warm valleys.',
      hero: {who: 'kjeldor', deck: {name: 'The Royal Guard', colors: 'W', list: `
4 Kjeldoran Royal Guard
4 Kjeldoran Skycaptain
4 Kjeldoran Elite Guard
4 Kjeldoran Warrior
4 Benalish Hero
4 Savannah Lions
4 Pearled Unicorn
4 Mesa Pegasus
4 Kjeldoran Skyknight
24 Snow-Covered Plains`}},
      villain: {who: 'balduvian', deck: {name: 'Balduvian Raiders', colors: 'R', list: `
4 Balduvian Barbarians
4 Mons's Goblin Raiders
4 Fire Elemental
4 Orcish Cannoneers
4 Gray Ogre
4 Hill Giant
4 Hurloon Minotaur
4 Ironclaw Orcs
4 Stone Giant
24 Snow-Covered Mountain`}},
      scene: [{who: 'kjeldor', line: 'Honorable in battle, generous in death.', quote: true}, {who: 'balduvian', line: 'Generous? Then give us the valley.'}, {who: 'kjeldor', line: 'Kjeldor holds the pass. It always has.'}, {who: 'balduvian', line: "Kjeldor holds nothing once it's frozen solid."}],
      villainScene: [{who: 'balduvian', line: "Kjeldor sits in the warm valley while Balduvia freezes."}, {who: 'balduvian', line: "Not this winter. Raiders, to the pass!"}],
      cues: {hero: cue('Shields.', 'For Kjeld!', 'Hold the pass!', 'Go home before the snow takes you.', 'Fall back to the city...'),
        villain: cue('Burn the fences!', 'Balduvia rides!', 'The cold bites both ways!', 'The valley is ours.', "We'll be back when it's colder.")}},
    {slot: 2, kind: 'Lesson', title: "The Royal Mage's Lesson", difficulty: 'Easy', rewardSet: 'ice', teaches: ['Cumulative upkeep'],
      blurb: "Kjeldor's royal mage teaches you a hard truth of the long winter: power that keeps you warm costs more every day you keep it.",
      hero: {who: 'gustha', deck: {name: 'The Royal Mage', colors: 'U', list: `
4 Illusionary Forces
4 Phantom Monster
4 Air Elemental
4 Glacial Wall
4 Prodigal Sorcerer
1 Brainstorm
4 Counterspell
2 Mahamoti Djinn
4 Phantasmal Forces
4 Arcane Denial
1 Lord of Atlantis
24 Snow-Covered Island`}},
      villain: {who: 'varchild', deck: {name: "Varchild's Company", colors: 'R', list: `
4 Varchild's War-Riders
4 Gray Ogre
4 Balduvian Horde
4 Orcish Cannoneers
4 Hill Giant
4 Hurloon Minotaur
4 Fire Elemental
4 Lightning Bolt
4 Ironclaw Orcs
24 Mountain`}},
      scene: [{who: 'gustha', line: 'What I want, I take.', quote: true}, {who: 'gustha', line: "That's the lie the cold tells you. Everything you take, you pay for. Every turn."}, {who: 'varchild', line: "Speeches. I'm paid by the head, mage, not by the word."}, {who: 'gustha', line: "Then let's see what your head's worth."}],
      villainScene: [{who: 'varchild', line: "A mage who lectures. My favourite kind of target."}, {who: 'varchild', line: "Paid by the head. Let's earn a fortune."}],
      cues: {hero: cue('Mind the cost.', 'Within moments, victory was mine.', 'Not yet.', "Know a thing's nature.", 'I paid too much...'),
        villain: cue('Ride!', 'Pay me in blood.', "This wasn't the contract!", 'Collect the bounty.', 'Somebody owes me.')}},
    {slot: 3, kind: 'Lesson', title: 'The Black Book', difficulty: 'Normal', rewardSet: 'ice', teaches: ['Card advantage', 'Paying life'],
      blurb: 'In the dark of the forest, a planeswalker offers you a book. Every page is a card. Every card costs life.',
      hero: {who: 'laina', deck: {name: 'Fyndhorn Council', colors: 'G', list: `
4 Fyndhorn Elves
4 Fyndhorn Elder
4 Folk of the Pines
4 Elvish Ranger
4 Yavimaya Ancients
3 Lhurgoyf
4 War Mammoth
4 Giant Growth
3 Craw Wurm
2 Pygmy Allosaurus
24 Snow-Covered Forest`}},
      villain: {who: 'leshrac', deck: {name: "Leshrac's Book", colors: 'B', list: `
2 Knight of Stromgald
2 Swamp
2 Dark Ritual
2 Drudge Skeletons
1 Unholy Strength
2 Hypnotic Specter
2 Scathe Zombies
2 Drain Life
2 Raise Dead
1 Sengir Vampire
3 Evil Presence
1 Necropotence
2 Drudge Skeletons
2 Terror
2 Scathe Zombies
4 Ashen Ghoul
1 Sengir Vampire
2 Swamp
1 Unholy Strength
24 Swamp`}},
      scene: [{who: 'leshrac', line: 'Take it. Read.'}, {who: 'laina', line: "Don't touch that. Freyalise warned us about his gifts."}, {who: 'leshrac', line: 'Freyalise warns. I give.'}, {who: 'laina', line: 'Our friends of the forest take many forms, yet all serve the will of Freyalise.', quote: true}, {who: 'leshrac', line: "Then let them serve. I'll wait."}],
      villainScene: [{who: 'leshrac', line: "Every planeswalker wants power. They just pretend they don't."}, {who: 'leshrac', line: "Give it the book. Let it pay, page by page."}],
      cues: {hero: cue('Freyalise, guide us.', 'The goddess is generous to her children.', "Don't read it...", 'Take your book and go.', "He's in the trees now."),
        villain: cue('Read.', 'More.', 'Pay.', 'Mine.', 'Later.')}},
    {slot: 4, kind: 'Rival', title: "Baron Sengir's Feast", difficulty: 'Normal', rewardSet: 'hml', teaches: ['Direct damage', 'Growing creatures'],
      blurb: "A rift pulls you to Ulgrotha, a dying world ruled from a castle. The Baron is having guests for dinner. You're on the menu.",
      hero: {who: 'reveka', deck: {name: "Reveka's Fire", colors: 'R', list: `
2 Reveka, Wizard Savant
4 Orcish Artillery
4 Orcish Cannoneers
4 Lightning Bolt
4 Incinerate
3 Fireball
4 Hurloon Minotaur
4 Fire Elemental
3 Shivan Dragon
4 Stone Giant
24 Mountain`}},
      villain: {who: 'baron', deck: {name: "The Baron's Table", colors: 'B', list: `
3 Baron Sengir
4 Sengir Bats
4 Sengir Autocrat
4 Sengir Vampire
4 Black Knight
4 Dark Ritual
4 Terror
3 Drain Life
3 Royal Assassin
3 Abomination
24 Swamp`}},
      scene: [{who: 'baron', line: 'A visitor. How rare. How fresh.'}, {who: 'reveka', line: "Don't let him get you near the table, rift-walker."}, {who: 'baron', line: "Reveka, you wound me. I'm a host."}, {who: 'reveka', line: "You're a leech in a nice coat."}, {who: 'baron', line: 'Every guest grows stronger in my house. Well. I do.'}],
      villainScene: [{who: 'baron', line: "Fresh blood from another world. Set another place at the table."}, {who: 'baron', line: "Reveka will warn it. They always warn them. It never helps."}],
      cues: {hero: cue('Lights up.', 'Choke on that.', 'Not dinner. Not today.', 'Lock the castle behind us.', 'Run!'),
        villain: cue('Dinner is served.', 'Delicious.', 'Rude guests.', "You'll keep.", 'Come back hungrier.')}},
    {slot: 5, kind: 'Lesson', title: 'The Dead at the Gate', difficulty: 'Normal', rewardSet: 'all', teaches: ['Alternate costs', 'Counterspells'],
      blurb: 'The dead are walking south. Kjeldor and Balduvia stop fighting each other long enough to form an Alliance.',
      hero: {who: 'kjeldor', deck: {name: 'The Alliance', colors: 'WU', list: `
2 Force of Will
2 Benalish Hero
2 Arcane Denial
2 Pearled Unicorn
2 Kjeldoran Royal Guard
2 Benalish Hero
2 Pearled Unicorn
2 Wall of Swords
2 Swords to Plowshares
2 Unsummon
1 Serra Angel
2 Water Elemental
1 Phantom Monster
2 Merfolk of the Pearl Trident
4 White Knight
1 Brainstorm
4 Mesa Pegasus
1 Air Elemental
12 Plains
12 Island`}},
      villain: {who: 'cohort', deck: {name: "Lim-Dûl's Vanguard", colors: 'B', list: `
4 Lim-Dûl's Cohort
4 Ashen Ghoul
2 Drift of the Dead
2 Drain Life
3 Legions of Lim-Dûl
4 Hypnotic Specter
4 Zombie Master
4 Scathe Zombies
4 Terror
4 Dark Ritual
1 Feast or Famine
12 Snow-Covered Swamp
12 Swamp`}},
      scene: [{who: 'limdul', line: 'Join me in the place of power, you risen dead.', quote: true, offstage: true}, {who: 'kjeldor', line: "That's the necromancer's voice. He's using our own fallen."}, {who: 'lucilde', line: 'I have seen the faces of my dead friends among that grim band, and I can bear no more.', quote: true}, {who: 'kjeldor', line: 'Then we end it. Together.'}],
      villainScene: [{who: 'cohort', line: "Rise. The master calls us south."}, {who: 'cohort', line: "We remember their names. They will not remember ours."}],
      cues: {villain: cue('Rise.', 'Serve me, and live forever.', 'Rise again.', 'They shall kill those whom once they loved.', 'There are always more dead.')}},
    {slot: 6, kind: 'Meta', title: 'Necro Summer', difficulty: 'Normal', rewardSet: 'ice', teaches: ['Racing a card-draw engine'],
      blurb: 'A fallen knight of Ulgrotha has found the Black Book. He draws until he wins, or dies trying. The deck that ruled 1996.',
      hero: {who: 'you', deck: {name: 'Knights of the Pass', colors: 'W', list: `
4 White Knight
4 Savannah Lions
4 Kjeldoran Elite Guard
4 Kjeldoran Royal Guard
3 Serra Angel
4 Swords to Plowshares
3 Order of the White Shield
4 Kjeldoran Skycaptain
4 Mesa Pegasus
2 Benalish Hero
24 Plains`}},
      villain: {who: 'ihsan', deck: {name: 'Necropotence', colors: 'B', archetype: 'Necro (1996)', list: `
1 Swamp
4 Dark Ritual
2 Hypnotic Specter
2 Scathe Zombies
4 Knight of Stromgald
3 Ihsan's Shade
4 Ashen Ghoul
3 Black Knight
1 Necropotence
3 Drain Life
1 Icy Manipulator
2 Unholy Strength
2 Zuran Orb
4 Terror
1 Strip Mine
23 Swamp`}},
      scene: [{who: 'ihsan', line: 'I was a knight once. I had a name. I traded it.'}, {who: 'ihsan', line: 'Every card is a year of my life. I have so many left to spend.'}],
      villainScene: [{who: 'ihsan', line: "One more card. One more year. One more win."}, {who: 'ihsan', line: "I gave my name for this book. It owes me this victory."}],
      cues: {villain: cue('Draw.', 'Was it worth it? Yes.', 'Just one more card.', 'Paid in full.', 'The book... is empty.')}},
    {slot: 7, kind: 'Meta', title: 'Stasis', difficulty: 'Normal', rewardSet: 'hml', teaches: ['Playing under a lock'],
      blurb: "The Baron's mother has a trick: nothing in her house moves unless she lets it.",
      hero: {who: 'reveka', deck: {name: "Reveka's Fire", colors: 'R', list: `
2 Reveka, Wizard Savant
4 Orcish Artillery
4 Orcish Cannoneers
4 Lightning Bolt
4 Incinerate
3 Fireball
4 Hurloon Minotaur
4 Fire Elemental
3 Shivan Dragon
4 Stone Giant
24 Mountain`}},
      villain: {who: 'grandmother', deck: {name: 'The Still House', colors: 'UB', archetype: 'Winter Orb lock', list: `
2 Grandmother Sengir
4 Winter Orb
4 Icy Manipulator
4 Counterspell
4 Arcane Denial
4 Hypnotic Specter
3 Mahamoti Djinn
2 Air Elemental
4 Dark Ritual
2 Stasis
3 Terror
12 Island
12 Swamp`}},
      scene: [{who: 'grandmother', line: 'My son plays with his food. I simply keep it still.'}, {who: 'reveka', line: "She'll freeze the whole table. Make every turn count."}, {who: 'grandmother', line: 'Sit. Stay. Good.'}],
      villainScene: [{who: 'grandmother', line: "My son plays with his food. Messy boy."}, {who: 'grandmother', line: "Everything stays where I put it. Including you, dear."}],
      cues: {villain: cue('Be still.', 'Nothing moves in my house.', 'Who untapped that?', 'There. Quiet.', 'Insolent.')}},
    {slot: 8, kind: 'Boss', title: "Lim-Dûl's Legion", difficulty: 'Hard', rewardSet: 'all', teaches: ['Everything so far'],
      blurb: 'The necromancer stands at the gates of Kjeldor with every dead soldier of the long winter behind him.',
      hero: {who: 'laina', deck: {name: "Freyalise's Chosen", colors: 'GW', list: `
4 Fyndhorn Elves
4 White Knight
2 Order of the White Shield
2 Grizzly Bears
2 Kjeldoran Royal Guard
2 Grizzly Bears
1 Serra Angel
2 Benalish Hero
2 Swords to Plowshares
2 War Mammoth
1 Lhurgoyf
1 Folk of the Pines
1 Benalish Hero
3 Pygmy Allosaurus
4 Giant Growth
3 Folk of the Pines
12 Plains
12 Forest`}},
      villain: {who: 'limdul', deck: {name: "Lim-Dûl's Legion", colors: 'B', archetype: 'Necro, lore-shaped', list: `
4 Lim-Dûl's High Guard
4 Lim-Dûl's Cohort
1 Necropotence
4 Dark Ritual
4 Knight of Stromgald
3 Legions of Lim-Dûl
2 Drift of the Dead
4 Ashen Ghoul
4 Pestilence
2 Hypnotic Specter
4 Terror
12 Snow-Covered Swamp
12 Swamp`}},
      scene: [{who: 'limdul', line: 'My foes serve me twice: in dying, and in death.', quote: true}, {who: 'laina', line: "Freyalise is coming. She's going to end the winter."}, {who: 'limdul', line: 'I will not warm myself by the fire. I will become the flame.', quote: true}, {who: 'limdul', line: 'Leshrac told me about you. The one who walks between.', aside: 'to you'}, {who: 'limdul', line: "Kneel, and I'll keep you. You'd make a fine Cohort."}],
      villainScene: [{who: 'limdul', line: 'Leshrac, my lord. Watch what your servant can do.'}],
      cues: {hero: cue('For Fyndhorn.', 'Become the fist of Freyalise!', 'Hold until the spring!', 'The ice is breaking!', "We'll hold him... somehow."),
        villain: cue('Open the gates, and bid them enter.', 'The weak shall fall. The strong shall remain.', 'Leshrac, my liege, grant me the power I am due.', 'Take their dead, and entomb them in the snow.', 'Leshrac... you promised...')}},
  ],
};
