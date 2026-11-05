// Act 43: Crossing: The Hobbit. Story and dialogue: /mnt/project-files/story/act-43-script.md (generated from this file).
// Land set: hob. A Universes Beyond world, one act: a hobbit, thirteen dwarves, a wizard and a dragon. Outside Magic canon: you are only passing through.
// Every quoted line is real flavor text from Magic: The Gathering - The Hobbit; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'crossing-hobbit',
  era: '2026-08-14',
  intro: [s('stage', 'An Omenpath opens in a round green door. Behind it a kettle is boiling, and a great many Dwarves are arriving for tea.'),
    s('stage', 'There is a long road ahead, an old map, a stolen ring and a mountain with something asleep inside it.'),
    s('stage', 'Recorded: crossings sit outside Magic canon. You are only passing through.')],
  finale: [s('stage', 'The Dragon falls out of the sky over the Long Lake, and the Mountain is open again.'),
    q('bard', 'I am Bard, slayer of the Dragon!'),
    s('stage', 'The Omenpath folds shut behind a Hobbit who is already thinking about his own front door.')],
  villainFinale: [s('stage', 'In this version the Dragon never meets the black arrow. The Lonely Mountain stays his, and Esgaroth burns.'),
    q('smaug', 'You think you will get a fair share? If you get off alive, you will be lucky.'),
    s('stage', 'The Omenpath holds long enough for you to leave.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Well-Worn Spatula'},
    bilbo: {name: 'Bilbo Baggins', title: 'Burglar, more or less', card: 'Bilbo, Thief in the Night', focus: '50% 25%'},
    trolls: {name: 'Tom, Bert and William', title: 'Trolls', card: 'Tom, Bert, and William', focus: '50% 25%'},
    gandalf: {name: 'Gandalf', title: 'The Grey', card: "Gandalf, Goblins' Bane // Flameshape", focus: '50% 25%'},
    goblins: {name: 'The Great Goblin', title: 'King under the Mountain', card: 'The Great Goblin', focus: '50% 25%'},
    gollum: {name: 'Gollum', title: 'Riddle Master', card: 'Gollum, Riddle Master', focus: '50% 25%'},
    beorn: {name: 'Beorn', title: 'Skin-changer', card: 'Beorn the Fierce', focus: '50% 25%'},
    radagast: {name: 'Radagast', title: 'The Brown', card: 'Radagast of Rhosgobel', focus: '50% 25%'},
    thorin: {name: 'Thorin Oakenshield', title: 'Mountain-king', card: 'Thorin, Mountain-king', focus: '50% 25%'},
    spiders: {name: 'The Spiders', title: 'Of Mirkwood', card: 'Old Fat Spider', focus: '50% 25%'},
    dwarves: {name: 'The Dwarves', title: 'Of Erebor', card: 'Dáin Ironfoot', focus: '50% 25%'},
    elrond: {name: 'Elrond', title: 'Moon-reader', card: 'Elrond, Moon-Reader', focus: '50% 25%'},
    thranduil: {name: 'Thranduil', title: 'The Elvenking', card: 'Thranduil, the Elvenking', focus: '50% 25%'},
    bard: {name: 'Bard', title: 'King of Dale', card: 'Bard, King of Dale', focus: '50% 25%'},
    smaug: {name: 'Smaug', title: 'The Magnificent', card: 'Smaug the Magnificent', focus: '50% 25%'},
    armies: {name: 'The Five Armies', title: 'Under the Mountain', card: 'Dwalin, Weaponmaster', focus: '50% 25%'},
    bolg: {name: 'Bolg of the North', title: 'Goblin captain', card: 'Bolg of the North', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'An Unexpected Party', difficulty: 'Easy', rewardSet: 'hob', teaches: ['Treasure'],
      blurb: 'Thirteen Dwarves, one wizard and a night on the road that goes badly wrong.',
      hero: {who: 'bilbo', deck: {label: 'tribute', name: 'The Company of Thorin', colors: 'W', list: `
3 Bofur, Reliable Guardian // Concerted Care
3 Belladonna Took
3 Kíli the Resourceful
3 Lake-town Toymaker
3 Eagle of the Great Shelf
3 Dáin, Lord of the Iron Hills
3 Ori, Keeper of Songs
2 Moment of Glory
1 An Unexpected Party // At the Door
4 Old Thrush
4 Long-Bodied Grey Dog
4 Iron Hills Blacksmith
24 Plains`}},
      villain: {who: 'trolls', deck: {label: 'tribute', name: 'Three Trolls', colors: 'BG', list: `
1 Tom, Bert, and William
2 Troll Negotiations
4 Wood Elves
4 Stony-Voiced Goblins
4 Duskwatch Hunter
4 Mirkwood Pathmaker
4 Troop of Ponies
4 Woodland Weavemaster
4 Little Bear
4 Rhovanion Rampager
1 Desolation Prowler
12 Swamp
12 Forest`}},
      scene: [q('bilbo', 'I am an honest burglar, more or less.'),
        s('bilbo', 'Treasure tokens turn into any colour of mana once. Save one for the turn you need it.')],
      villainScene: [q('trolls', 'Suddenly they were fighting like dogs, and calling one another all sorts of perfectly true and applicable names in very loud voices.'),
        s('trolls', 'The Trolls are in no hurry. Dinner will keep.')],
      cues: {hero: cue('Burglar at your service.', 'Onwards!', 'The trolls are winning...', 'Dawn takes the trolls.', 'Back to Bag End...', 'Cash a Treasure when you need the colour.'),
        villain: cue('Mutton, again.', 'Squash!', 'Dawn is coming...', 'Supper.', 'Stone...')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'Goblin-town', difficulty: 'Easy', rewardSet: 'hob', teaches: ['Amass'],
      blurb: 'A grey wizard, a flash of light and a cave full of goblins.',
      hero: {who: 'gandalf', deck: {label: 'tribute', name: 'Gandalf and the Company', colors: 'R', list: `
3 Gandalf, Goblins' Bane // Flameshape
4 Tidings of War
3 Dori, Bearer of Friends
3 Óin the Brave
2 Pinecone Strike
4 Goblin-town Flunkies
4 Troop of Ponies
4 Bothersome Noisemaker
4 Snowslope Hunter
4 Gundabad Opportunist
1 Long-Bodied Grey Dog
24 Mountain`}},
      villain: {who: 'goblins', deck: {label: 'tribute', name: 'Goblin-town', colors: 'BR', list: `
3 The Great Goblin
3 Bolg's Company
4 Rage into the Valley
3 Goblin Plate Mail
2 Fearsome Goblin Pair
4 Ravening Warg
4 Old Thrush
4 Long-Bodied Grey Dog
4 Great Fierce Bee
4 Head of the Hunt
1 Front Porch Sentries
12 Swamp
12 Mountain`}},
      scene: [q('gandalf', 'Gandalf thought of most things; and though he could not do everything, he could do a great deal for friends in a tight corner.'),
        s('gandalf', 'Amass: grow your Army token or make one first. Kill the Army and all of its counters go with it.')],
      villainScene: [q('goblins', 'I will prepare something particularly uncomfortable for you, Thorin Oakenshield!'),
        s('goblins', 'Clap! Snap! The Goblins have a song for it.')],
      cues: {hero: cue('Close your eyes.', 'Flash!', 'Too many goblins...', 'The Great Goblin falls.', 'Captured...', 'Spread counters on one Army, or split into two.'),
        villain: cue('Clap, snap.', 'Seize them!', 'The wizard...', 'Caught.', 'Run...')}},
    {slot: 3, mood: 'rival', kind: 'Lesson', title: 'Riddles in the Dark', difficulty: 'Normal', rewardSet: 'hob', teaches: ['Recruit'],
      blurb: 'A hobbit, a ring in a pocket and a creature who loves riddles and raw fish.',
      hero: {who: 'bilbo', deck: {label: 'tribute', name: 'Bilbo and the Riddle-Game', colors: 'WU', list: `
3 Elrond, Moon-Reader
3 Bilbo, Thief in the Night
3 Bard's Company
3 Lake-town Toymaker
3 Eagle of the Great Shelf
2 Gandalf, Wandering Wizard
3 Riddles in the Dark
2 Sound the Trumpets
4 Old Thrush
4 Long-Bodied Grey Dog
4 Iron Hills Blacksmith
2 Mirkwood Meditator
12 Island
12 Plains`}},
      villain: {who: 'gollum', deck: {label: 'tribute', name: 'Gollum and the Goblins', colors: 'B', list: `
3 Gollum, Silent Slinker // Meager Meal
3 Gollum the Abandoned
2 Bilbo's Deadly Slice
4 Stony-Voiced Goblins
4 Troop of Ponies
4 Rhovanion Rampager
4 Front Porch Sentries
4 Desolation Prowler
4 Head of the Hunt
4 Great Fierce Bee
24 Swamp`}},
      scene: [q('bilbo', 'What have I got in my pocket?'),
        s('bilbo', 'Recruit: draw a card, then discard one. If it was a nonland card, you get a Treasure. Loot every turn.')],
      villainScene: [q('gollum', 'Where iss it? Losst it is, my precious!'),
        s('gollum', 'Gollum guesses, and Gollum cheats.')],
      cues: {hero: cue('Time!', 'A riddle!', 'The riddles are running out...', 'Out of the dark.', 'Eaten...', 'Recruit each turn: loot, then keep the Treasure.'),
        villain: cue('Precious.', 'Yesss!', 'Where is it...', 'Mine.', 'Thief!')}},
    {slot: 4, mood: 'rival', kind: 'Rival', title: 'Beorn', difficulty: 'Normal', rewardSet: 'hob', teaches: ['Haste'],
      blurb: 'The skin-changer does not like visitors. He especially does not like fifteen of them.',
      hero: {who: 'radagast', deck: {label: 'tribute', name: 'The Company in the Porch', colors: 'GW', list: `
3 Radagast of Rhosgobel
3 Galion, Elvenking's Butler
3 Dancing from Dark to Dawn
3 Eagle of the Great Shelf
2 Warg Tactics
2 Quarrel
4 Bejeweled Warg
4 Guardian of the Halls
4 Attercop
4 Old Thrush
4 Long-Bodied Grey Dog
12 Forest
12 Plains`}},
      villain: {who: 'beorn', deck: {label: 'tribute', name: 'Beorn and the Bears', colors: 'G', list: `
3 Beorn the Fierce
3 Beorn, Reluctant Host // Till and Tend
3 Gigantic Big Bear
3 Old Fat Spider
3 Troll Negotiations
2 Beorn's Hospitality
4 Bejeweled Warg
4 Guardian of the Halls
4 Old Thrush
4 Attercop
3 Ordinary Bear
24 Forest`}},
      scene: [q('radagast', 'Perhaps you have heard of my good cousin Radagast who lives near the southern borders of Mirkwood?'),
        s('radagast', 'Beorn is a big green deck. Trade early, then stop him with removal before he lands the bears.')],
      villainScene: [q('beorn', 'He never invited people into his house if he could help it. Now he had got fifteen strangers sitting in his porch!'),
        s('beorn', 'The bears dance until dawn. The strangers are not invited.')],
      cues: {hero: cue('Wait here.', 'Eagles!', 'The bears are too big...', 'Honey-cakes.', 'Out the door...', 'Remove the big green creature before it connects.'),
        villain: cue('A bear.', 'Grr!', 'Fences...', 'Mine.', 'Guest...')}},
    {slot: 5, mood: 'tension', kind: 'Arrival', title: 'Mirkwood', difficulty: 'Easy', rewardSet: 'hob', teaches: ['Sagas'],
      blurb: 'Stick to the forest-track. The spiders have been waiting.',
      hero: {who: 'thorin', deck: {label: 'tribute', name: "Thorin's Company", colors: 'R', list: `
3 Thorin, Mountain-king
3 Glóin the Mighty // Easy Pickings
3 Balin, Loremaster
3 Iron Hills Stalwart
3 Misty Mountains Raider
3 Gundabad Opportunist
2 Pinecone Strike
4 Old Thrush
4 Long-Bodied Grey Dog
4 Bothersome Noisemaker
4 Snowslope Hunter
24 Mountain`}},
      villain: {who: 'spiders', deck: {label: 'tribute', name: 'The Spiders of Mirkwood', colors: 'G', list: `
2 Attercop
1 Old Fat Spider
2 Beorn's Hospitality
4 Wood Elves
4 Mirkwood Pathmaker
4 Woodland Weavemaster
4 Troop of Ponies
4 Little Bear
4 Wargling
4 Nasty Little Rabbit
3 Long-Bodied Grey Dog
24 Forest`}},
      scene: [q('thorin', 'To me! O my kinsfolk!'),
        s('thorin', 'A Saga adds a counter every turn and does its work in order. Cast it early and let the chapters run.')],
      villainScene: [q('spiders', 'Soon there came the sound of "Lazy Lob" and "Attercop" from among the trees away on the right. That upset the spiders greatly.'),
        s('spiders', 'Attercop, Attercop! The meat is alive and kicking.')],
      cues: {hero: cue('Stay on the path.', 'To me!', 'The webs are thick...', 'Out of the forest.', 'Caught...', 'Cast the Saga early, then protect your creatures.'),
        villain: cue('Dinner.', 'Wrap them!', 'It stings...', 'Wrapped.', 'The light...')}},
    {slot: 6, mood: 'comic', kind: 'Meta', title: 'The Dwarves of Erebor', difficulty: 'Normal', rewardSet: 'hob', teaches: ['Trample'],
      blurb: 'The Mountain-king has an army, an axe and a very long list of grudges.',
      hero: {who: 'radagast', deck: {label: 'tribute', name: 'The Brown Wizard and the Bears', colors: 'G', list: `
2 Radagast of Rhosgobel
2 Beorn, Reluctant Host // Till and Tend
1 Gigantic Big Bear
1 Old Fat Spider
2 Warg Tactics
4 Wood Elves
4 Mirkwood Pathmaker
4 Woodland Weavemaster
4 Troop of Ponies
4 Little Bear
4 Wargling
4 Long-Bodied Grey Dog
24 Forest`}},
      villain: {who: 'dwarves', deck: {label: 'tribute', name: 'The Dwarves of Erebor', colors: 'R', list: `
3 Thorin, Mountain-king
3 Glóin the Mighty // Easy Pickings
3 Dáin Ironfoot
3 Balin, Loremaster
2 Bombur, Gentle Dreamer
3 Pinecone Strike
2 Ragged Short Spear
4 Old Thrush
4 Long-Bodied Grey Dog
4 Bothersome Noisemaker
4 Snowslope Hunter
1 Troop of Ponies
24 Mountain`}},
      scene: [q('radagast', 'Merry be the greenwood, while the world is yet young! And merry be all your folk!'),
        s('radagast', 'Dwarves hit hard and early. Bigger creatures with trample win the long game.')],
      villainScene: [q('dwarves', 'Dáin heard Thorin\'s urgent plea and ordered his smiths to fetch their strongest axes and mattocks.'),
        s('dwarves', 'The Iron Hills march: every Dwarf has a score and an axe.')],
      cues: {hero: cue('Peace, friends.', 'The Brown Wizard!', 'The Dwarves are too fast...', 'Peace.', 'Overrun...', 'Land your big creatures before the Dwarves swarm.'),
        villain: cue('Dáin, Dáin!', 'Axes!', 'Shields up...', 'Erebor.', 'Retreat...')}},
    {slot: 7, mood: 'rival', kind: 'Rival', title: 'The Elvenking', difficulty: 'Hard', rewardSet: 'hob', teaches: ['Playing around counterspells'],
      blurb: 'The Wood-Elves are not wicked folk. They do not like to be asked questions in their halls.',
      hero: {who: 'dwarves', deck: {label: 'tribute', name: 'The Dwarves of the Lonely Mountain', colors: 'RW', list: `
3 Dwalin, Weaponmaster
3 Thorin Oakenshield
3 Bifur, Melodic Rider
3 Dáin's Company
3 Thorin's Last Stand
2 Stone by Sunlight
2 Orcrist, Goblin-cleaver
4 Long-Bodied Grey Dog
4 Iron Hills Blacksmith
4 Old Thrush
4 Dwarven Provisioner
1 Snowslope Hunter
12 Mountain
12 Plains`}},
      villain: {who: 'thranduil', deck: {label: 'tribute', name: "The Elvenking's Halls", colors: 'GU', list: `
3 Thranduil's Company
3 Thranduil, Sindarin Liege // Silvan Rally
3 Mirkwood Nurturer
3 Silvan Reveler
3 Thranduil's Decree
3 Confusticate and Bebother
2 Sound the Trumpets
4 Bejeweled Warg
4 Guardian of the Halls
4 Old Thrush
4 Attercop
12 Forest
12 Island`}},
      scene: [q('dwarves', 'We shall soon, before the break of day, start on our long journey'),
        s('dwarves', 'The Elvenking counters your best spell. Bait it with a lesser one first.')],
      villainScene: [q('thranduil', 'I have a right to know what brings you here, and if you will not tell me now, I will keep you all in prison until you have learned sense and manners!'),
        s('thranduil', 'The halls are old, quiet and very patient.')],
      cues: {hero: cue('Quietly now.', 'Break free!', 'The halls are sealed...', 'Out through the barrels.', 'Prison...', 'Bait the counterspell with a lesser spell.'),
        villain: cue('Silence.', 'Seize them!', 'Impossible...', 'Learn manners.', 'Gone...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Smaug the Magnificent', difficulty: 'Hard', rewardSet: 'hob', teaches: ['Reach'],
      blurb: 'The last of the great Dragons sleeps on a bed of gold and listens for burglars.',
      hero: {who: 'bard', deck: {label: 'tribute', name: 'Bard and the Black Arrow', colors: 'WU', list: `
3 Bard, King of Dale
3 Bard the Bowman
3 Bard's Company
2 The Lord of the Eagles
3 The Black Arrow
3 Eagle's Rescue
2 Settle the Wreckage
2 Magnificent End
4 Patient Instructor
4 Long-Bodied Grey Dog
4 Dwarven Provisioner
3 Old Thrush
12 Plains
12 Island`}},
      villain: {who: 'smaug', deck: {label: 'tribute', name: 'Smaug the Magnificent', colors: 'BR', list: `
3 Smaug, Wicked Worm
3 Smaug the Magnificent
3 Smaug, the Great Calamity // Spew Flame
3 Gundabad Opportunist
3 Desolation of Smaug
3 Smaug's Fury
2 Gnashing of Teeth
4 Ravening Warg
4 Nighthowl Pursuer
4 Old Thrush
4 Great Fierce Bee
12 Swamp
12 Mountain`}},
      scene: [q('bard', 'No one had dared to face the Dragon for many an age; nor would they have dared now, if it hadn\'t been for the grim-voiced Bard urging them on.'),
        s('bard', 'Smaug is a flyer and burns the board. Keep your best arrow in hand for the right moment.')],
      villainScene: [q('smaug', 'My armor is like tenfold shields, my teeth are swords, my wings a hurricane, and my breath death!'),
        q('smaug', 'You think you will get a fair share? If you get off alive, you will be lucky.')],
      cues: {hero: cue('Hold your arrow.', 'The black arrow!', 'The Dragon is too strong...', 'He falls.', 'Esgaroth burns...', 'Keep your answer for the Dragon himself.'),
        villain: cue('I am fire.', 'Death!', 'Impossible...', 'Gold.', 'The arrow...')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'The Battle of Five Armies', difficulty: 'Hard', rewardSet: 'hob', rewardCard: 'Gathering of Darkness', mood: 'boss',
      teaches: ['Amass'],
      archive: {deck: 'The Goblin Host of Bolg', when: 'Summer 2026', format: 'Story archive, no tournament list.',
        what: 'A black-red deck of the set\'s goblin captains and Armies, with Gathering of Darkness at the top.',
        why: 'It stands for the battle after the Dragon and is not a list anyone won with.',
        beat: 'Trade early, keep the Army small, and kill Bolg before the horde grows.',
        after: 'Nothing; this is the optional superboss at the end of the story.'},
      blurb: 'The Dragon is dead, but the Goblins have been waiting. Bolg of the North is coming.',
      hero: {who: 'armies', deck: {label: 'tribute', name: 'The Dwarves and Men', colors: 'RW', list: `
3 Dáin, Lord of the Iron Hills
3 Dáin Ironfoot
3 Dwalin, Weaponmaster
3 Nori, Teller of Tales
1 Stone-Giant of High Pass
3 Thorin's Last Stand
2 Orcrist, Goblin-cleaver
4 Old Thrush
4 Long-Bodied Grey Dog
4 Iron Hills Blacksmith
4 Bothersome Noisemaker
2 Dáin's Company
12 Mountain
12 Plains`}},
      villain: {who: 'bolg', deck: {label: 'tribute', name: 'The Goblin Host of Bolg', note: 'Built from cards in this act\'s set only. No tournament list is copied.', colors: 'BR', list: `
3 Bolg of the North
3 Azog, Moria's Ruin
3 Bolg's Company
3 Great Ugly-Looking Goblin // Clap! Snap!
3 Gathering of Darkness
4 Rage into the Valley
3 Goblin Plate Mail
2 Crude Bent Blade
4 Ravening Warg
4 Old Thrush
4 Great Fierce Bee
12 Swamp
12 Mountain`}},
      scene: [q('armies', 'Alas! Bolg of the North is coming!'),
        s('armies', 'Race the Army before it grows. Kill Bolg and the horde breaks.')],
      villainScene: [q('bolg', 'Goblins and wolves returned to the assault and soon forced their foes into a great ring, hemmed on all sides.')],
      cues: {hero: cue('Stand fast.', 'For Erebor!', 'The horde is too big...', 'The Eagles are coming.', 'Overrun...', 'Kill the Army token before it grows.'),
        villain: cue('Crush them.', 'The horde!', 'Bolg...', 'Victory.', 'No...')},
      after: [s('stage', 'Recorded: the Eagles arrive, and the Mountain holds. The Omenpath closes.')]},
  ],
};
