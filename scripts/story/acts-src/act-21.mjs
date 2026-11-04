// Act 21: The Gods of Theros (Theros, Born of the Gods, Journey into Nyx, Magic 2015). Story and dialogue:
// /mnt/project-files/story/act-21-script.md (generated from this file). Land set: ths.
// Theros is a plane of heroes and gods, where the gods are made of mortal belief. Elspeth Tirel, worn out after
// New Phyrexia (Act 18), finds a home here and becomes the sun god Heliod's champion. The satyr planeswalker Xenagos
// turns his revels into worship and becomes a god himself. Elspeth kills him in Nyx with the Godsend, Heliod's own
// weapon. Then Heliod, afraid of a mortal who can kill gods, kills her with it. Every quoted line is real flavor text
// from the Theros block or Magic 2015; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'theros-gods-lyre',
  era: '2014-07-18',
  intro: [s('stage', 'Theros. A world of sea and sun and bronze, where the gods walk in the night sky of Nyx and listen to every prayer.'),
    s('stage', 'Here, the gods exist because mortals believe in them. Faith makes them, and faith feeds them.'),
    s('stage', 'Elspeth Tirel came here to rest after Mirrodin fell. She did not get to rest for long.'),
    q('elspeth', 'I was not chosen for my faith in the gods. Sometimes the gods must put their faith in us.')],
  finale: [s('stage', 'In Nyx, among the stars, Elspeth drives the Godsend through the god of revels.'),
    q('elspeth', 'It is done.'),
    s('stage', 'Heliod watches the mortal who has just killed a god. He gave her the spear. He takes it back.'),
    s('stage', 'Elspeth Tirel dies on Theros, at the hand of the god she served. Ajani carries the news down from Nyx.'),
    q('ajani', 'All peoples treasure a place where the weary traveler may drink in peace.'),
    s('ajani', 'She found one here. That is what I will remember.')],
  villainFinale: [s('stage', 'Xenagos sits in Nyx with the other gods, and the revel never ends.'),
    q('xenagos', 'The gods of Theros are born of the expectations and beliefs of mortals. If I have found godhood, what does that say about their true desires?'),
    q('xenagos', 'Embrace every moment, for it could be your last.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Fleetfeather Sandals'},
    elspeth: {name: 'Elspeth Tirel', title: 'Sun\'s Champion', card: 'Elspeth, Sun\'s Champion', focus: '50% 25%'},
    minotaurs: {name: 'The Minotaurs', title: 'Of Deathbellow Canyon', card: 'Minotaur Skullcleaver', focus: '50% 30%'},
    kiora: {name: 'Kiora', title: 'The Crashing Wave', card: 'Kiora, the Crashing Wave', focus: '50% 25%'},
    thassa: {name: 'Thassa', title: 'God of the Sea', card: 'Thassa, God of the Sea', focus: '50% 25%'},
    heliod: {name: 'Heliod', title: 'God of the Sun', card: 'Heliod, God of the Sun', focus: '50% 25%'},
    erebos: {name: 'Erebos', title: 'God of the Dead', card: 'Erebos, God of the Dead', focus: '50% 25%'},
    ajani: {name: 'Ajani', title: 'Mentor of Heroes', card: 'Ajani, Mentor of Heroes', focus: '50% 25%'},
    xenagos: {name: 'Xenagos', title: 'The Reveler', card: 'Xenagos, the Reveler', focus: '50% 25%'},
    anthousa: {name: 'Anthousa', title: 'Of Setessa', card: 'Anthousa, Setessan Hero', focus: '50% 25%'},
    ashiok: {name: 'Ashiok', title: 'Nightmare Weaver', card: 'Ashiok, Nightmare Weaver', focus: '50% 25%'},
    blue: {name: 'Mono-Blue Devotion', title: 'Late 2013', card: 'Master of Waves', focus: '50% 30%'},
    monsters: {name: 'RG Monsters', title: 'Early 2014', card: 'Stormbreath Dragon', focus: '50% 30%'},
    heroic: {name: 'Heroic', title: '2014', card: 'Favored Hoplite', focus: '50% 25%'},
    burn: {name: 'Mono-Red', title: '2014', card: 'Eidolon of the Great Revel', focus: '50% 30%'},
    god: {name: 'Xenagos', title: 'God of Revels', card: 'Xenagos, God of Revels', focus: '50% 25%'},
    black: {name: 'Mono-Black Devotion', title: '2013 to 2014', card: 'Gray Merchant of Asphodel', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Deathbellow Canyon', difficulty: 'Easy', rewardSet: 'ths', teaches: ['Heroic'],
      blurb: 'You arrive on a hot white road outside Akros. Minotaur raiders have come up out of Deathbellow Canyon, and Elspeth Tirel is holding the pass with the Akroan hoplites.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'The Champion\'s Phalanx', colors: 'W', list: `
1 Elspeth, Sun's Champion
4 Favored Hoplite
4 Phalanx Leader
4 Hero of Iroas
4 Soldier of the Pantheon
3 Wingsteed Rider
3 Fabled Hero
4 Gods Willing
3 Ordeal of Heliod
3 Dauntless Onslaught
3 Ajani's Presence
24 Plains`}},
      villain: {who: 'minotaurs', deck: {label: 'tribute', name: 'The Felhide Raiders', colors: 'BR', list: `
4 Deathbellow Raider
4 Minotaur Skullcleaver
2 Borderland Minotaur
1 Rageblood Shaman
1 Kragma Warcaller
3 Ragemonger
4 Mogis's Marauder
4 Felhide Minotaur
11 Mountain
9 Swamp
4 Temple of Malice
4 Kragma Butcher
3 Blood-Toll Harpy
4 Tormented Hero
2 Spark Jolt`}},
      scene: [q('elspeth', 'It has been my experience that soldiers most fervently follow generals who lead by example.'),
        q('stage', '"You. Poet. Be sure to write this down."'),
        s('elspeth', 'Heroic: whenever you cast a spell that targets a heroic creature, it triggers. Bless your heroes, and they grow.')],
      villainScene: [q('minotaurs', 'Their only dreams are of full stomachs.'),
        q('stage', 'Deathbellow Canyon is home to minotaurs and many other creatures that share a love for the taste of human flesh.'),
        q('stage', 'A minotaur does not distinguish between human, satyr, and triton. They are all meat.')],
      cues: {hero: cue('Shields up.', 'For Akros!', 'They keep coming...', 'The pass holds.', 'Fall back...', 'Target your heroes.'),
        villain: cue('[a bellow from the canyon]', '[the herd charges]', '[a raider falls]', '[a feast]', '[driven back]')},
      after: [s('elspeth', 'The priests say Heliod is watching me. I came here to stop being watched.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Crashing Wave', difficulty: 'Easy', rewardSet: 'bng', teaches: ['Bestow'],
      blurb: 'Out on the sea, the merfolk planeswalker Kiora has decided that a god of the sea is just a rival with good publicity. Thassa\'s tritons disagree.',
      hero: {who: 'kiora', deck: {label: 'tribute', name: 'Kiora\'s Tide', colors: 'GU', list: `
2 Kiora, the Crashing Wave
4 Boon Satyr
3 Nessian Wilds Ravager
4 Voyaging Satyr
4 Nimbus Naiad
4 Vaporkin
3 Courser of Kruphix
4 Sylvan Caryatid
10 Forest
10 Island
4 Temple of Mystery
4 Omenspeaker
4 Savage Surge`}},
      villain: {who: 'thassa', deck: {label: 'tribute', name: 'Thassa\'s Faithful', colors: 'U', list: `
2 Thassa, God of the Sea
4 Thassa's Emissary
3 Master of Waves
4 Omenspeaker
4 Wavecrash Triton
4 Nyxborn Triton
3 Breaching Hippocamp
4 Voyage's End
3 Sealock Monster
3 Dissolve
2 Triton Fortune Hunter
24 Island`}},
      scene: [q('kiora', 'I will match Thassa drop for drop and show a god what true power is.'),
        q('kiora', 'I want one.'),
        s('kiora', 'Bestow: some creatures can be cast as an Aura instead. If the creature they enchant dies, they fall off and stay as a creature.')],
      villainScene: [q('thassa', 'Mortal strength, like mortal hope, is so easily crushed.'),
        q('stage', 'When mortals claim there are places Thassa cannot reach, the sea god laughs.')],
      cues: {hero: cue('Let\'s make waves.', 'The tide turns!', 'She is stronger...', 'Mine now.', 'Washed out...', 'Bestow, then keep the creature.'),
        villain: cue('[the tide rises]', '[a triton surfaces]', '[the sea goes quiet]', '[pulled under]', '[the tide goes out]')},
      after: [q('kiora', 'I can see why this appeals to Thassa.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Sun and the Dead', difficulty: 'Easy', rewardSet: 'ths', teaches: ['Devotion'],
      blurb: 'Heliod, the sun god, and Erebos, the god of the dead, are brothers, and they have never agreed on anything. Their faithful settle it with a duel at the edge of the Underworld.',
      hero: {who: 'heliod', deck: {label: 'tribute', name: 'Heliod\'s Faithful', colors: 'W', list: `
2 Heliod, God of the Sun
4 Heliod's Emissary
4 Favored Hoplite
4 Akroan Skyguard
4 Phalanx Leader
3 Archetype of Courage
4 Wingsteed Rider
4 Battlewise Valor
3 Chosen by Heliod
4 Last Breath
24 Plains`}},
      villain: {who: 'erebos', deck: {label: 'tribute', name: 'The Returned', colors: 'B', list: `
2 Erebos, God of the Dead
4 Gray Merchant of Asphodel
4 Returned Phalanx
4 Returned Centaur
4 Spiteful Returned
3 Erebos's Emissary
4 Baleful Eidolon
3 Pharika's Cure
4 Returned Reveler
4 Asphyxiate
24 Swamp`}},
      scene: [q('stage', 'Legend speaks of the Sun Spear, the mighty weapon that can strike any point in Theros, even the depths of the Underworld.'),
        s('heliod', 'Devotion: count the coloured mana symbols in the costs of your permanents. The gods only walk as creatures when your devotion is high enough.')],
      villainScene: [q('stage', 'A body Returned, a soul still lost.'),
        q('stage', 'The sailor had never seen a god before. Now she had gazed upon Thassa. Shortly she would see Athreos, and then she would meet Erebos.')],
      cues: {hero: cue('Let the sun rise.', 'Heliod walks!', 'The dead drain us...', 'Back to the dark, brother.', 'Sunset...', 'Count your white symbols.'),
        villain: cue('Everyone comes to me.', 'Gray Merchant!', 'Bright. Ugh.', 'Welcome home.', 'You will be back.')},
      after: [s('elspeth', 'Two gods and their followers bled for a family argument. Remind me why we pray to them.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Revel', difficulty: 'Normal', rewardSet: 'bng', teaches: ['Monstrosity'],
      blurb: 'Ajani Goldmane, a leonin planeswalker and an old friend of Elspeth\'s, has come to Theros to find her. In the hills he finds Xenagos instead: a satyr planeswalker whose revels have started to look like worship.',
      hero: {who: 'ajani', deck: {label: 'tribute', name: 'Ajani\'s Pride', colors: 'GW', list: `
2 Ajani, Mentor of Heroes
4 Fleecemane Lion
4 Chronicler of Heroes
4 Setessan Oathsworn
4 Nessian Courser
3 Staunch-Hearted Warrior
4 Boon Satyr
3 Brimaz, King of Oreskos
4 Banishing Light
4 Ordeal of Nylea
10 Forest
10 Plains
4 Temple of Plenty`}},
      villain: {who: 'xenagos', deck: {label: 'tribute', name: 'The Satyr Revel', colors: 'RG', list: `
4 Satyr Hedonist
4 Satyr Rambler
4 Satyr Firedancer
4 Fanatic of Xenagos
2 Polukranos, World Eater
4 Lightning Strike
3 Ember Swallower
4 Satyr Hoplite
3 Savage Surge
2 Stormbreath Dragon
10 Mountain
10 Forest
4 Temple of Abandon
2 Satyr Nyx-Smith`}},
      scene: [q('ajani', 'All peoples treasure a place where the weary traveler may drink in peace.'),
        s('ajani', 'Monstrosity: pay a creature\'s monstrosity cost once and it gets bigger for good, often with a bonus. Kill it before they can afford it.')],
      villainScene: [q('xenagos', 'Why pray to the gods, who feed on your worship? Dissolve your illusions and see the true nature of things.'),
        q('xenagos', 'Stoke a fire hot enough and you\'ll never run out of things to burn.')],
      cues: {hero: cue('Where is she?', 'For the pride!', 'The revel grows...', 'The music stops.', 'Too much wine...', 'Kill the monsters early.'),
        villain: cue('Join the dance!', 'Monstrous!', 'Killjoy.', 'More wine!', 'The party moves on.')},
      after: [s('xenagos', 'You think the gods are real because people believe in them? Then watch what happens when they believe in me.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Nightmares', difficulty: 'Normal', rewardSet: 'jou', teaches: ['Constellation'],
      blurb: 'In the woods of Setessa, children are going missing and the dreams are going wrong. Anthousa, a Setessan hero, is tracking something that is not a monster. It is a planeswalker called Ashiok, who feeds on nightmares.',
      hero: {who: 'anthousa', deck: {label: 'tribute', name: 'The Setessan Grove', colors: 'GW', list: `
4 Eidolon of Blossoms
4 Harvestguard Alseids
4 Oakheart Dryads
2 Humbler of Mortals
4 Courser of Kruphix
4 Nyx-Fleece Ram
4 Banishing Light
4 Sylvan Caryatid
2 Anthousa, Setessan Hero
4 Leafcrown Dryad
10 Forest
10 Plains
4 Temple of Plenty`}},
      villain: {who: 'ashiok', deck: {label: 'tribute', name: 'Ashiok\'s Nightmares', colors: 'UB', list: `
3 Ashiok, Nightmare Weaver
4 Thoughtrender Lamia
4 Agent of Erebos
2 Mind Sculpt
2 Returned Reveler
4 Pharika's Cure
3 Dissolve
4 Voyage's End
2 Agent of the Fates
10 Island
10 Swamp
4 Temple of Deceit
4 Baleful Eidolon
4 Hero's Downfall`}},
      scene: [q('anthousa', 'More children taken. This is an evil we will track without mercy.'),
        q('stage', 'The emotional echoes of dryad gatherings attract lost souls.'),
        s('anthousa', 'Constellation: whenever an enchantment enters under your control, a constellation card triggers. Play your enchantments one by one.')],
      villainScene: [q('ashiok', 'Every nightmare is a caged bird that yearns to be set free.'),
        q('ashiok', 'Not all nightmares can be escaped by waking.'),
        q('ashiok', 'To think some believe it peaceful to die in one\'s sleep.')],
      cues: {hero: cue('Wake up.', 'The stars align!', 'The dreams are winning...', 'Morning comes.', 'Lost in sleep...', 'One enchantment at a time.'),
        villain: cue('Sleep.', 'Dream with me.', 'Such a bright mind.', 'Another for the collection.', 'Only a dream.')},
      after: [q('ashiok', 'It saddens me to lose a source of inspiration. This one seemed especially promising.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Master of Waves', difficulty: 'Normal', rewardSet: 'ths', teaches: ['Devotion'],
      blurb: 'The Archive remembers late 2013, when Mono-Blue Devotion turned Thassa into a creature and flooded the board with Master of Waves tokens, against the Red-Green Monsters deck and its dragons.',
      hero: {who: 'blue', deck: {label: 'tribute', name: 'Mono-Blue Devotion', note: 'Built from cards in this act\'s sets only, so Tidebinder Mage, Frostburn Weird, Cloudfin Raptor and Nightveil Specter are not in it.', colors: 'U', archetype: 'Aggro', list: `
2 Thassa, God of the Sea
4 Master of Waves
4 Thassa's Emissary
4 Vaporkin
4 Nyxborn Triton
2 Bident of Thassa
4 Wavecrash Triton
4 Voyage's End
2 Prognostic Sphinx
2 Dissolve
4 Triton Fortune Hunter
22 Island
2 Nykthos, Shrine to Nyx`}},
      villain: {who: 'monsters', deck: {label: 'tribute', name: 'RG Monsters', colors: 'RG', archetype: 'Midrange', list: `
4 Elvish Mystic
4 Sylvan Caryatid
4 Courser of Kruphix
2 Lightning Strike
4 Arbor Colossus
4 Ember Swallower
10 Forest
10 Mountain
4 Temple of Abandon
4 Nessian Asp
4 Nessian Courser
2 Swordwise Centaur
2 Nylea's Disciple
2 Satyr Wayfinder`}},
      scene: [q('stage', 'To resist Thassa is to deny the rising tide.'),
        s('you', 'Every blue symbol on the table is one more Elemental from Master of Waves.')],
      villainScene: [q('xenagos', 'Stoke a fire hot enough and you\'ll never run out of things to burn.')],
      cues: {hero: cue('Tide in.', 'Thassa awakens!', 'Dragon incoming...', 'Flooded.', 'Burned dry.', 'Count your devotion.'),
        villain: cue('[a dragon with haste]', '[monstrous]', '[the board floods]', '[burned out]', '[outnumbered]')},
      after: [s('stage', 'Recorded: Theros Standard, late 2013.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Heroes and Burn', difficulty: 'Normal', rewardSet: 'bng', teaches: ['Heroic'],
      blurb: 'The Archive remembers 2014: heroic decks that turned one small creature into a monster with a stack of cheap spells, against mono-red burn that never let a creature live long enough.',
      hero: {who: 'heroic', deck: {label: 'tribute', name: 'Heroic', note: 'Built from cards in this act\'s sets only, so Feat of Resistance and Hopeful Initiate are not in it.', colors: 'WU', archetype: 'Aggro', list: `
4 Favored Hoplite
4 Battlewise Hoplite
4 Hero of Iroas
4 Akroan Skyguard
4 Phalanx Leader
4 Gods Willing
4 Ordeal of Heliod
2 Ordeal of Thassa
2 Battlewise Valor
14 Plains
6 Island
4 Temple of Enlightenment
4 Fabled Hero`}},
      villain: {who: 'burn', deck: {label: 'tribute', name: 'Mono-Red', colors: 'R', archetype: 'Burn', list: `
2 Eidolon of the Great Revel
3 Goblin Rabblemaster
4 Satyr Hoplite
4 Lightning Strike
4 Magma Jet
2 Searing Blood
2 Stoke the Flames
3 Bolt of Keranos
24 Mountain
4 Akroan Crusader
4 Akroan Line Breaker
2 Prophetic Flamespeaker
2 Spark Jolt`}},
      scene: [q('stage', 'It\'s never good to walk into an ambush, but with the right spell you might walk out again.'),
        s('you', 'Hold a protection spell for their burn. One protected hero wins this.')],
      villainScene: [q('stage', 'Thakolides the Mighty / Slayer of minotaurs / Vanquisher of giants / Killed by a scorpion')],
      cues: {hero: cue('Ready the hoplites.', 'Heroic!', 'Burned again...', 'Legend made.', 'Ash.', 'Protect your best hero.'),
        villain: cue('[a bolt in response]', '[the Eidolon burns]', '[the hero is shielded]', '[face burn]', '[out of fire]')},
      after: [s('stage', 'Recorded: Theros Standard, 2014.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The God of Revels', difficulty: 'Hard', rewardSet: 'bng', rewardCard: 'Xenagos, God of Revels', teaches: ['Monstrosity'],
      blurb: 'Xenagos did it. Enough mortals danced in his name that he rose into Nyx as a god. Heliod gives Elspeth his own weapon, the Godsend, and sends her and Ajani up into the stars after him.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'Elspeth and Ajani', colors: 'GW', list: `
2 Elspeth, Sun's Champion
2 Ajani, Mentor of Heroes
1 Godsend
4 Fleecemane Lion
3 Brimaz, King of Oreskos
4 Courser of Kruphix
4 Sylvan Caryatid
4 Banishing Light
4 Boon Satyr
3 Setessan Oathsworn
2 Last Breath
3 Archetype of Courage
11 Plains
9 Forest
4 Temple of Plenty`}},
      villain: {who: 'god', deck: {label: 'tribute', name: 'The Endless Revel', colors: 'RG', list: `
2 Xenagos, God of Revels
4 Elvish Mystic
4 Sylvan Caryatid
2 Polukranos, World Eater
4 Stormbreath Dragon
4 Courser of Kruphix
3 Arbor Colossus
4 Lightning Strike
3 Anger of the Gods
4 Fanatic of Xenagos
10 Forest
10 Mountain
4 Temple of Abandon
2 Ember Swallower`}},
      scene: [q('elspeth', 'The false god Xenagos treats the whole world as his rollick site. If his whims are left unchecked, Theros will be reduced to rubble and ashes.'),
        q('elspeth', 'A tiny flame is enough to dispel the night.'),
        s('ajani', 'I am with you. Whatever is up there.')],
      villainScene: [q('god', 'The gods of Theros are born of the expectations and beliefs of mortals. If I have found godhood, what does that say about their true desires?'),
        q('god', 'Embrace every moment, for it could be your last.')],
      cues: {hero: cue('Into Nyx.', 'The Godsend!', 'He is a god now...', 'It is done.', 'The revel wins...', 'Kill the monsters, then him.'),
        villain: {...cue('Welcome to my revel.', 'Dance!', 'That spear stings.', 'Worship me.', 'The music... stops.'),
          half: {who: 'ajani', line: 'He is only as strong as his dancers. Cut them down.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Gray Merchant', difficulty: 'Hard', rewardSet: 'ths', rewardCard: 'Thoughtseize', mood: 'boss',
      teaches: ['Devotion'],
      archive: {deck: 'Mono-Black Devotion', when: 'Late 2013 to mid 2014', format: 'Standard: Return to Ravnica block, Theros block and Magic 2014 or 2015.',
        what: 'A black deck that took the opponent\'s best card with Thoughtseize, killed every threat with Hero\'s Downfall, and piled black mana symbols onto the table until Gray Merchant of Asphodel drained the opponent for a game\'s worth of life.',
        why: 'It was one of the most played and most successful decks of its Standard season.',
        beat: 'Go big and go early. Their removal is one-for-one, so play more threats than they have answers, and keep your life total high for the Merchants.',
        after: 'This tribute uses only this act\'s sets, so Pack Rat, Desecration Demon, Underworld Connections and Nightveil Specter are not in it.'},
      blurb: 'Deep in the archive, the deck that was the format for a season.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Mono-Green Devotion', colors: 'G', archetype: 'Ramp', list: `
3 Arbor Colossus
2 Reverent Hunter
24 Forest
4 Nessian Asp
4 Nessian Courser
4 Satyr Wayfinder
4 Nylea's Disciple
4 Swordwise Centaur
3 Leafcrown Dryad
4 Nyxborn Wolf
4 Pheres-Band Tromper`}},
      villain: {who: 'black', deck: {label: 'tribute', name: 'Mono-Black Devotion', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'B', archetype: 'Control', list: `
4 Thoughtseize
4 Hero's Downfall
4 Gray Merchant of Asphodel
2 Erebos, God of the Dead
2 Whip of Erebos
4 Pharika's Cure
3 Bile Blight
2 Hythonia the Cruel
4 Herald of Torment
4 Erebos's Emissary
3 Agent of the Fates
22 Swamp
2 Nykthos, Shrine to Nyx`}},
      scene: [q('stage', '"It is not yours to hunt, mortal. Be content with its beauty alone."'),
        s('you', 'Too many threats for their removal. That is the whole plan.')],
      villainScene: [q('ashiok', 'Knowledge is such a burden. Release it. Release all your fears to me.'),
        q('stage', 'Destiny exalts a chosen few, but even heroes break.')],
      cues: {hero: cue('Ramp up.', 'Too big to answer!', 'Drained again...', 'Overgrown.', 'Merchant\'s toll.', 'More threats than answers.'),
        villain: cue('[Thoughtseize]', '[Gray Merchant drains]', '[out of removal]', '[drained]', '[overrun]')},
      after: [s('stage', 'Recorded: Theros Standard, 2013 to 2014.')]},
  ],
};
