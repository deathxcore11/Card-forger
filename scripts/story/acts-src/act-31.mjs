// Act 31: Omens of Phyrexia (Zendikar Rising, Kaldheim, Strixhaven). Story and dialogue:
// /mnt/project-files/story/act-31-script.md (generated from this file). Land set: znr.
// Three worlds, three stories: Zendikar after the Eldrazi, Kaldheim's Doomskar, and a school of magic. In each one something
// else is watching. Every quoted line is real flavor text from these sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'omens-of-phyrexia',
  era: '2020-09-25',
  intro: [s('stage', 'Zendikar, Kaldheim, Arcavios. Three worlds, eight fights, and one thin line of oil under all of them.'),
    q('stage', 'This is my world, Jace, down to its very bones.'),
    s('stage', 'On Zendikar, a party sets out. They are a cleric, a rogue, a warrior and a wizard, and none of them is sure they are the hero.')],
  finale: [q('stage', 'Join me for the dawn of a new age.'),
    s('stage', 'The Oriq at Strixhaven are broken, the Doomskar has passed, and Zendikar is quiet again.'),
    s('stage', 'Recorded: three worlds, three endings. Something far away has been drawing maps.')],
  villainFinale: [q('stage', 'With one lethal strike, Extus took control of the Oriq and took his first step towards vengeance.'),
    s('stage', 'In this version, the Oriq win, and Strixhaven belongs to them.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Expedition Healer'},
    nahiri: {name: 'Nahiri', title: 'Lithomancer', card: 'Nahiri, Heir of the Ancients', focus: '50% 25%'},
    vampires: {name: 'The Vampires', title: 'Of Malakir', card: 'Highborn Vampire', focus: '50% 30%'},
    kaldheim: {name: 'Starnheim Warriors', title: 'Of Kaldheim', card: 'Starnheim Courser', focus: '50% 30%'},
    tibalt: {name: 'Tibalt\'s Raiders', title: 'Of Kaldheim', card: 'Frenzied Raider', focus: '50% 30%'},
    witherbloom: {name: 'Witherbloom', title: 'College of Essence', card: 'Witherbloom Apprentice', focus: '50% 30%'},
    silverquill: {name: 'Silverquill', title: 'College of Eloquence', card: 'Silverquill Apprentice', focus: '50% 30%'},
    elves: {name: 'The Elves', title: 'Of Kaldheim', card: 'Vorinclex, Monstrous Raider', focus: '50% 25%'},
    prismari: {name: 'Prismari', title: 'College of Elemental Arts', card: 'Prismari Apprentice', focus: '50% 30%'},
    kaya: {name: 'Kaya', title: 'Ghost Assassin', card: 'Kaya the Inexorable', focus: '50% 25%'},
    whiteagg: {name: 'Mono-White Aggro', title: 'Autumn 2020', card: 'Luminarch Aspirant', focus: '50% 30%'},
    rogues: {name: 'Dimir Rogues', title: 'Autumn 2020', card: 'Soaring Thought-Thief', focus: '50% 30%'},
    dragons: {name: 'Izzet Dragons', title: 'Spring 2021', card: 'Goldspan Dragon', focus: '50% 30%'},
    lessons: {name: 'Rakdos Berserkers', title: 'Spring 2021', card: 'Bloodsky Berserker', focus: '50% 30%'},
    deans: {name: 'Kaya and the Deans', title: 'Of Strixhaven', card: 'Killian, Ink Duelist', focus: '50% 25%'},
    extus: {name: 'Extus', title: 'Oriq Overlord', card: 'Extus, Oriq Overlord', focus: '50% 25%'},
    stompy: {name: 'Kaldheim Stompy', title: 'Spring 2021', card: 'Icehide Troll', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Party', difficulty: 'Easy', rewardSet: 'znr', teaches: ['Modal double-faced cards'],
      blurb: 'Zendikar is waking after the Eldrazi, and the vampires of Malakir are not in a welcoming mood. Nahiri has a plan.',
      hero: {who: 'nahiri', deck: {label: 'tribute', name: 'The Kor Expedition', colors: 'RW', list: `
4 Luminarch Aspirant
4 Archpriest of Iona
4 Kor Celebrant
3 Kabira Outrider
3 Skyclave Apparition
2 Legion Angel
2 Nahiri, Heir of the Ancients
3 Kabira Takedown
2 Smite the Monstrous
3 Rip Apart
2 Sizzling Barrage
2 Emeria Captain
2 Stonebound Mentor
4 Lorehold Campus
4 Furycalm Snarl
8 Plains
8 Mountain`}},
      villain: {who: 'vampires', deck: {label: 'tribute', name: 'The Vampires of Malakir', colors: 'B', list: `
4 Highborn Vampire
4 Malakir Blood-Priest
4 Skyclave Shade
3 Nimana Skydancer
3 Skyclave Shadowcat
3 Shadow Stinger
3 Nighthawk Scavenger
3 Bloodchief's Thirst
2 Vanquish the Weak
2 Soul Shatter
4 Feed the Swarm
24 Swamp
1 Nimana Skitter-Sneak`}},
      scene: [q('stage', 'Zendikar has suffered enough. It is time, at last, for my home to know peace.'),
        q('stage', 'Rally to my light, and together we will drive out this darkness!'),
        s('nahiri', 'Modal double-faced cards: a card with two faces. Play it as a spell or as a land, so it is never dead in your hand.')],
      villainScene: [q('stage', 'With the bloodchiefs annihilated in the fight between the free and enthralled, the swamps around Malakir are full of dangerous, young vampires eager to make their marks.'),
        q('stage', 'From your veins to mine.')],
      cues: {hero: cue('Into the ruins.', 'Rally!', 'The swamp is thick with them...', 'The expedition returns.', 'Lost in Malakir...', 'A spell-land can be your land drop in a pinch.'),
        villain: cue('From your veins.', 'Feed!', 'The blood runs thin...', 'Malakir keeps its own.', 'Staked...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Doomskar', difficulty: 'Easy', rewardSet: 'khm', teaches: ['Foretell'],
      blurb: 'Kaldheim\'s realms have crashed together. The warriors of Starnheim stand against Tibalt\'s raiders.',
      hero: {who: 'kaldheim', deck: {label: 'tribute', name: 'The Warriors of Starnheim', colors: 'W', list: `
4 Usher of the Fallen
3 Beskir Shieldmate
4 Starnheim Courser
3 Goldmaw Champion
3 Stalwart Valkyrie
3 Righteous Valkyrie
3 Halvar, God of Battle
3 Resplendent Marshal
1 Battershield Warrior
2 Doomskar
2 Warhorn Blast
24 Plains
2 Starnheim Aspirant
3 Starnheim Unleashed`}},
      villain: {who: 'tibalt', deck: {label: 'tribute', name: 'Tibalt\'s Raiders', colors: 'R', list: `
4 Fearless Pup
4 Axgard Cavalry
4 Frenzied Raider
3 Dragonkin Berserker
3 Tuskeri Firewalker
3 Craven Hulk
3 Basalt Ravager
2 Quakebringer
1 Frost Bite
2 Squash
2 Run Amok
24 Mountain
3 Surtland Flinger
2 Hagi Mob`}},
      scene: [q('stage', 'The realms crashed together, with Bretagard at the center of the calamity.'),
        q('stage', 'I have led ten thousand through these mists and never lost the way.'),
        s('kaldheim', 'Foretell: pay 2 on an earlier turn to set a card face down in exile, then cast it later for its cheaper foretell cost.')],
      villainScene: [q('stage', 'Arrogant maggot. You won\'t be so proud when I rip out your tongue and drink from your skull!'),
        q('stage', 'Who\'s next?!')],
      cues: {hero: cue('For Starnheim!', 'The valkyries rise!', 'The raiders are fast...', 'The realm holds.', 'The mist takes us...', 'Foretell early so later turns are free.'),
        villain: cue('Who\'s next?!', 'Ride the goat!', 'They are stalling...', 'Raiders take the field.', 'Cut down...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Pop Quiz', difficulty: 'Easy', rewardSet: 'stx', teaches: ['Learn'],
      blurb: 'Strixhaven\'s colleges argue over everything. Witherbloom and Silverquill are arguing with spells.',
      hero: {who: 'witherbloom', deck: {label: 'tribute', name: 'Witherbloom Pests', colors: 'BG', list: `
4 Witherbloom Apprentice
4 Eyetwitch
3 Witherbloom Pledgemage
3 Blood Researcher
3 Moldering Karok
3 Daemogoth Woe-Eater
2 Dina, Soul Steeper
4 Pest Summoning
3 Mortality Spear
3 Witherbloom Command
2 Culling Ritual
2 Tend the Pests
4 Witherbloom Campus
4 Necroblossom Snarl
8 Swamp
8 Forest`}},
      villain: {who: 'silverquill', deck: {label: 'tribute', name: 'Silverquill Debaters', colors: 'WB', list: `
4 Silverquill Apprentice
4 Silverquill Pledgemage
3 Silverquill Silencer
3 Star Pupil
3 Eager First-Year
3 Spiteful Squad
2 Shadrix Silverquill
3 Owlin Shieldmage
3 Elite Spellbinder
3 Vanishing Verse
2 Silverquill Command
2 Humiliate
1 Closing Statement
4 Silverquill Campus
4 Shineshadow Snarl
8 Plains
8 Swamp`}},
      scene: [q('stage', 'Step 1: Put the pests in mud. Step 2: Wait.'),
        q('stage', 'Death is really just a transfer of energy. Those pests I harvested have the honor of becoming pure magic. What could be more beautiful?'),
        s('witherbloom', 'Learn: you may get a Lesson from outside the game, or discard a card to draw a card. It is a cantrip that sometimes finds exactly what you need.')],
      villainScene: [q('stage', 'I avoid violence. It is the last resort of the witless. But if you insist, I\'ll make an exception for you.'),
        q('stage', 'I am very much in the mood to start handing out expulsions.')],
      cues: {hero: cue('Pass the pests.', 'Transfer of energy!', 'The debate is going their way...', 'Class dismissed.', 'Expelled...', 'Pests are useful when they die.'),
        villain: cue('Order!', 'Expelled!', 'Out of arguments...', 'Silence in class.', 'Overruled...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Elves of Kaldheim', difficulty: 'Normal', rewardSet: 'khm', teaches: ['Racing'],
      blurb: 'Nahiri\'s expedition meets a much bigger monster in Kaldheim\'s forests.',
      hero: {who: 'nahiri', deck: {label: 'tribute', name: 'The Kor Expedition', colors: 'RW', list: `
4 Luminarch Aspirant
4 Archpriest of Iona
4 Kor Celebrant
3 Kabira Outrider
3 Skyclave Apparition
3 Legion Angel
3 Nahiri, Heir of the Ancients
3 Kabira Takedown
3 Rip Apart
2 Smite the Monstrous
2 Stonebound Mentor
2 Emeria Captain
4 Lorehold Campus
4 Furycalm Snarl
8 Plains
8 Mountain`}},
      villain: {who: 'elves', deck: {label: 'tribute', name: 'The Elves of the World Tree', colors: 'G', list: `
4 Jaspera Sentinel
4 Sculptor of Winter
4 Icehide Troll
3 Boreal Outrider
3 Sarulf's Packmate
3 Vorinclex, Monstrous Raider
3 Ravenous Lindwurm
2 Battle Mammoth
2 Esika's Chariot
3 Blizzard Brawl
2 Struggle for Skemfar
3 Snakeskin Veil
24 Forest`}},
      scene: [q('stage', 'This is my world, Jace, down to its very bones.'),
        q('stage', 'A troll\'s greatest weapon is its ability to emerge unexpectedly from the landscape.'),
        s('nahiri', 'They have a bigger monster than you. Race, and remove the biggest threats first.')],
      villainScene: [q('stage', 'The arrows of the elvish elite strike as true and deadly as the fangs of the Cosmos Serpent they revere.'),
        q('stage', 'I\'m no coward, but I\'d sooner tangle with a rampaging Torga troll than a hungry lindwurm!')],
      cues: {hero: cue('Hold the ridge!', 'Burn it!', 'The monsters are bigger...', 'The ridge holds.', 'Crushed...', 'Kill the biggest threat before it blocks.'),
        villain: cue('Wherever snow falls.', 'Stomp!', 'They are fast...', 'The forest wins.', 'Burned out...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Magecraft', difficulty: 'Normal', rewardSet: 'stx', teaches: ['Magecraft'],
      blurb: 'Prismari students want to show off. Kaya has other plans for the campus.',
      hero: {who: 'prismari', deck: {label: 'tribute', name: 'Prismari Showcase', colors: 'UR', list: `
4 Prismari Apprentice
3 Archmage Emeritus
4 Spectacle Mage
3 Elemental Expressionist
2 Rootha, Mercurial Artist
2 Galazeth Prismari
3 Maelstrom Muse
4 Demon Bolt
4 Prismari Campus
4 Frostboil Snarl
8 Island
8 Mountain
4 Prismari Pledgemage
3 Umara Mystic
2 Storm-Kiln Artist
2 Oggyar Battle-Seer`}},
      villain: {who: 'kaya', deck: {label: 'tribute', name: 'Kaya\'s Hunt', colors: 'WB', list: `
4 Silverquill Apprentice
4 Silverquill Pledgemage
3 Silverquill Silencer
1 Star Pupil
3 Eager First-Year
3 Spiteful Squad
2 Shadrix Silverquill
3 Owlin Shieldmage
3 Elite Spellbinder
3 Vanishing Verse
2 Silverquill Command
2 Humiliate
1 Closing Statement
4 Silverquill Campus
4 Shineshadow Snarl
8 Plains
8 Swamp
2 Kaya the Inexorable`}},
      scene: [q('stage', 'No one ever created great art by playing it safe!'),
        q('stage', 'Prismari students dance in the tension between passion and perfection.'),
        s('prismari', 'Magecraft: whenever you cast or copy an instant or sorcery, this triggers. Play cheap spells in the same turn as your mages.')],
      villainScene: [q('stage', 'No gods. Only each other.'),
        q('stage', 'The Skyclaves are our inheritance.')],
      cues: {hero: cue('Show them!', 'Encore!', 'The audience is silent...', 'Standing ovation.', 'Out of spells...', 'Cast a spell while your mage is on the table.'),
        villain: cue('Your trail ends here.', 'Judgment!', 'It slips away...', 'Her judgment is final.', 'Not this time...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Dimir Rogues', difficulty: 'Normal', rewardSet: 'znr', teaches: ['Cycling matters'],
      blurb: 'Autumn 2020: a white aggro deck against the Dimir Rogues, who steal your cards.',
      hero: {who: 'whiteagg', deck: {label: 'tribute', name: 'Mono-White Aggro', colors: 'W', archetype: 'Aggro', list: `
4 Luminarch Aspirant
4 Usher of the Fallen
4 Fearless Fledgling
3 Kor Celebrant
3 Skyclave Cleric
4 Resplendent Marshal
3 Righteous Valkyrie
3 Skyclave Apparition
2 Halvar, God of Battle
3 Iron Verdict
24 Plains
3 Pressure Point`}},
      villain: {who: 'rogues', deck: {label: 'tribute', name: 'Dimir Rogues', colors: 'UB', archetype: 'Tempo', list: `
4 Soaring Thought-Thief
4 Draugr Thought-Thief
4 Karfell Harbinger
3 Augury Raven
2 Zareth San, the Trickster
2 Narfi, Betrayer King
3 Frost Augur
3 Brinebarrow Intruder
1 Mistwalker
3 Feed the Serpent
3 Poison the Cup
2 Saw It Coming
2 Depart the Realm
4 Port of Karfell
4 Ice Tunnel
8 Island
8 Swamp`}},
      scene: [q('stage', 'Rally to my light, and together we will drive out this darkness!'),
        q('stage', 'The landbind ritual connects us to our sacred sites. More importantly, it binds us with every other kor who has visited here, through countless generations.'),
        s('whiteagg', 'Beat them down before they steal your answers. Their rogues are fragile.')],
      villainScene: [q('stage', 'The worst part is that you won\'t even remember how much he\'s taken from you.'),
        q('stage', 'This is a realm of the living. King Narfi\'s legion is coming to change that.')],
      cues: {hero: cue('Strike fast.', 'Swords out!', 'They are stealing our plans...', 'Dawn.', 'Mugged...', 'Attack every turn.'),
        villain: cue('Quietly.', 'Mill them!', 'Out of tricks...', 'They never saw it.', 'Caught...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Izzet Dragons', difficulty: 'Normal', rewardSet: 'stx', teaches: ['Racing'],
      blurb: 'Spring 2021: Izzet Dragons against a Rakdos pile of berserkers.',
      hero: {who: 'dragons', deck: {label: 'tribute', name: 'Izzet Dragons', colors: 'UR', archetype: 'Midrange', list: `
4 Elemental Expressionist
2 Goldspan Dragon
3 Galazeth Prismari
2 Kaza, Roil Chaser
4 Spectacle Mage
3 Maelstrom Muse
1 Magma Opus
3 Expressive Iteration
3 Demon Bolt
4 Frost Bite
3 Behold the Multiverse
4 Saw It Coming
4 Frostboil Snarl
4 Prismari Campus
8 Island
8 Mountain`}},
      villain: {who: 'lessons', deck: {label: 'tribute', name: 'Rakdos Berserkers', colors: 'BR', archetype: 'Aggro', list: `
4 Bloodsky Berserker
4 Deathknell Berserker
4 Immersturm Raider
3 Dragonkin Berserker
3 Immersturm Predator
3 Kardur, Doomscourge
4 Hagi Mob
3 Demon Bolt
3 Poison the Cup
3 Feed the Serpent
2 Tormenting Voice
4 Immersturm Skullcairn
4 Sulfurous Mire
8 Mountain
8 Swamp`}},
      scene: [q('stage', 'It would be a crime to withhold my light from the world.'),
        q('stage', 'Burn them from the sky.'),
        s('dragons', 'Hold the dragons until you can afford them. Trade cheap spells while you wait.')],
      villainScene: [q('stage', 'Sven felled the elf with an arrow through the chest, but moments later, the corpse rose with a sneer to fight again.'),
        q('stage', 'Graarg!')],
      cues: {hero: cue('Wait for it.', 'Dragon!', 'The berserkers are fast...', 'Fire and ice.', 'Overrun...', 'Stabilise first, dragons second.'),
        villain: cue('Who\'s next?!', 'Charge!', 'The fuel is gone...', 'Berserk.', 'Cut down...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Extus, Oriq Overlord', difficulty: 'Hard', rewardSet: 'stx', teaches: ['Magecraft'],
      blurb: 'Extus has taken the Oriq and wants Strixhaven for himself. Kaya and the deans stand in the way.',
      hero: {who: 'deans', deck: {label: 'tribute', name: 'Kaya and the Deans', colors: 'WB', list: `
4 Silverquill Apprentice
4 Elite Spellbinder
3 Shadrix Silverquill
3 Kaya the Inexorable
3 Killian, Ink Duelist
3 Spiteful Squad
3 Owlin Shieldmage
2 Firja, Judge of Valor
3 Vanishing Verse
3 Fracture
2 Humiliate
1 Silverquill Command
4 Silverquill Campus
4 Shineshadow Snarl
8 Plains
8 Swamp
2 Star Pupil`}},
      villain: {who: 'extus', deck: {label: 'tribute', name: 'The Oriq', colors: 'WB', list: `
4 Extus, Oriq Overlord
3 Rise of Extus
2 Blot Out the Sky
3 Owlin Shieldmage
4 Vanishing Verse
4 Spiteful Squad
4 Cleric of Life's Bond
4 Elite Spellbinder
2 Orah, Skyclave Hierophant
3 Firja, Judge of Valor
3 Skyclave Apparition
4 Shineshadow Snarl
4 Silverquill Campus
8 Plains
8 Swamp`}},
      scene: [q('stage', 'When your father is Dean Embrose, second best really isn\'t an option.'),
        q('stage', 'Aim higher next time.'),
        s('deans', 'Extus gets stronger with every spell. Stop him before the Blood Avatar arrives.')],
      villainScene: [q('stage', 'Join me for the dawn of a new age.'),
        q('stage', 'With one lethal strike, Extus took control of the Oriq and took his first step towards vengeance.')],
      cues: {hero: cue('Class is in session.', 'Together!', 'The Oriq are many...', 'The campus is safe.', 'Expelled...', 'Kill Extus before the Blood Avatar.'),
        villain: {...cue('A new age.', '[the avatar rises]', '[a hollow laugh]', 'The campus is mine.', '[the Oriq scatter]'),
          half: {who: 'silverquill', line: 'Aim higher next time.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Kaldheim Snow Stompy', difficulty: 'Hard', rewardSet: 'khm', rewardCard: 'Icehide Troll', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Snow Stompy', when: 'Spring 2021', format: 'Standard.',
        what: 'A green deck that used snow basics to power Icehide Troll, Sculptor of Winter and Blizzard Brawl.',
        why: 'Cheap, efficient snow creatures and a one-mana fight spell made it a fast, consistent attacker.',
        beat: 'Kill the early snow creatures before they grow, and chump block the troll until you can remove it.',
        after: 'Strixhaven and then Adventures in the Forgotten Realms arrived in Standard in 2021.'},
      blurb: 'Deep in the archive, a green deck that starts with one-drops and ends with a very big troll.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Mono-White Aggro', colors: 'W', archetype: 'Aggro', list: `
4 Luminarch Aspirant
4 Usher of the Fallen
4 Fearless Fledgling
3 Kor Celebrant
3 Skyclave Cleric
4 Resplendent Marshal
3 Righteous Valkyrie
3 Skyclave Apparition
2 Halvar, God of Battle
3 Maul of the Skyclaves
3 Iron Verdict
24 Plains`}},
      villain: {who: 'stompy', deck: {label: 'tribute', name: 'Kaldheim Stompy', note: 'Built from cards in this act\'s sets only.', colors: 'G', archetype: 'Aggro', list: `
4 Icehide Troll
4 Sculptor of Winter
4 Boreal Outrider
3 Jaspera Sentinel
3 Old-Growth Troll
3 Ravenous Lindwurm
2 Vorinclex, Monstrous Raider
3 Esika's Chariot
4 Blizzard Brawl
3 Spirit of the Aldergard
3 Snakeskin Veil
24 Snow-Covered Forest`}},
      scene: [q('stage', 'Wherever snow falls, I am home.'),
        s('you', 'Kill the early creatures. Do not let the troll grow.')],
      villainScene: [q('stage', 'A troll\'s greatest weapon is its ability to emerge unexpectedly from the landscape.')],
      cues: {hero: cue('Hold them off.', 'Strike!', 'The troll is huge...', 'The snow melts.', 'Buried...', 'Kill the early creatures first.'),
        villain: cue('[a quiet frost]', '[the troll grows]', '[the thaw]', '[silence]', '[the snow melts]')},
      after: [s('stage', 'Recorded: Strixhaven and then Adventures in the Forgotten Realms arrived in Standard in 2021.')]},
  ],
};
