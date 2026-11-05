// Act 39 (Crossing): Final Fantasy. Story and dialogue: /mnt/project-files/story/act-39-script.md (generated from this file).
// Land set: fin. A Universes Beyond world drifts across the Omenpaths. It is outside Magic canon: you are only passing through.
// Every quoted line is real flavor text from Magic: The Gathering - FINAL FANTASY; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'crystal-world-crossing',
  era: '2025-06-13',
  intro: [s('stage', 'An Omenpath opens where no Omenpath should. On the other side, crystals hum under a sky that belongs to another story.'),
    s('stage', 'This world is not part of the Multiverse you know. Its heroes have their own war. You are only passing through.'),
    s('stage', 'Recorded: crossings sit outside Magic canon. The road waits for you on the far side.')],
  finale: [s('stage', 'Sephiroth falls. The Lifestream, green and slow, closes over the wound in the planet.'),
    q('cloud', "It's not over yet... this isn't the end!"),
    s('stage', 'The Omenpath folds shut behind you. The crystal sky is gone. The road turns back to the Multiverse.')],
  villainFinale: [s('stage', 'In this version the planet already belongs to him.'),
    q('sephiroth', 'This is the end... for all of you.'),
    s('stage', 'The Lifestream is quiet. The Omenpath stays open a little longer than it should, then closes.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: "Sazh's Chocobo"},
    cloud: {name: 'Cloud', title: 'Midgar Mercenary', card: 'Cloud, Midgar Mercenary', focus: '50% 25%'},
    shinra: {name: 'Shinra Security', title: 'Of Midgar', card: 'Shinra Reinforcements', focus: '50% 30%'},
    clive: {name: 'Clive', title: "Ifrit's Dominant", card: "Clive, Ifrit's Dominant // Ifrit, Warden of Inferno", focus: '50% 25%'},
    empire: {name: 'The Imperial Dominants', title: 'Of Waloed', card: 'Gaius van Baelsar', focus: '50% 25%'},
    returners: {name: 'The Returners', title: 'Of Figaro', card: 'Edgar, King of Figaro', focus: '50% 25%'},
    kefka: {name: 'Kefka', title: 'Court Mage', card: 'Kefka, Court Mage // Kefka, Ruler of Ruin', focus: '50% 25%'},
    vivi: {name: 'Vivi', title: 'Black Mage of Alexandria', card: 'Vivi Ornitier', focus: '50% 25%'},
    lightning: {name: 'Lightning', title: 'Army of One', card: 'Lightning, Army of One', focus: '50% 25%'},
    party: {name: 'Cloud and Friends', title: 'Of Avalanche', card: 'Aerith Gainsborough', focus: '50% 25%'},
    tidus: {name: 'Tidus', title: 'Blitzball Star', card: 'Tidus, Blitzball Star', focus: '50% 25%'},
    sin: {name: 'Sin', title: "Spira's Punishment", card: 'Seymour Flux', focus: '50% 25%'},
    noctis: {name: 'The Crown Prince\'s Crew', title: 'Of Lucis', card: 'Gladiolus Amicitia', focus: '50% 25%'},
    niflheim: {name: 'The Empire of Niflheim', title: 'Of Gralea', card: 'Ardyn, the Usurper', focus: '50% 25%'},
    summoners: {name: 'The Summoners', title: 'Of Spira and Cocoon', card: 'Fang, Fearless l\'Cie', focus: '50% 25%'},
    azorius: {name: 'Azorius Control', title: 'Summer 2025', card: 'Rosa, Resolute White Mage', focus: '50% 25%'},
    hunters: {name: 'The Hunters', title: 'Of Cocoon', card: 'Lightning, Security Sergeant', focus: '50% 25%'},
    weapons: {name: 'The Weapons', title: 'Of the Planet', card: 'Diamond Weapon', focus: '50% 25%'},
    sephiroth: {name: 'Sephiroth', title: 'Fabled SOLDIER', card: 'Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Job Select', difficulty: 'Easy', rewardSet: 'fin', teaches: ['Job select'],
      blurb: 'A mercenary in a city of reactors and glowing mako. Shinra security does not like strangers.',
      hero: {who: 'cloud', deck: {label: 'tribute', name: "Cloud's Mercenaries", colors: 'W', list: `
3 Cloud, Midgar Mercenary
4 Dragoon's Lance
4 Paladin's Arms
4 White Mage's Staff
2 Machinist's Arsenal
4 Adelbert Steiner
4 Dwarven Castle Guard
4 Coeurl
4 Ambrosia Whiteheart
3 Ashe, Princess of Dalmasca
24 Plains`}},
      villain: {who: 'shinra', deck: {label: 'tribute', name: 'Shinra Security', colors: 'WB', list: `
4 Magitek Infantry
4 Shinra Reinforcements
3 Reno and Rude
3 Rufus Shinra
4 Magitek Armor
4 Weapons Vendor
4 Delivery Moogle
4 Al Bhed Salvagers
4 Qutrub Forayer
2 Undercity Dire Rat
12 Plains
12 Swamp`}},
      scene: [s('stage', 'Midgar. The reactors never sleep.'),
        q('shinra', "I'll control the world with fear. It takes too much to do it like my old man."),
        s('cloud', 'Job select: when an equipment enters, it makes a 1/1 Hero and attaches itself. A new job for a new body.')],
      villainScene: [q('shinra', 'End of the line, punk!'),
        s('shinra', 'Shinra security: eyes up, weapons ready. Nobody walks through Sector Seven.')],
      cues: {hero: cue('Another job, another day.', 'Equip!', 'They keep coming...', 'Sector clear.', 'Falling back...', 'Play equipment: each one brings its own Hero.'),
        villain: cue('Eyes up.', 'Reinforcements!', 'We are losing sector...', 'Secured.', 'Alarm!')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'Summons', difficulty: 'Easy', rewardSet: 'fin', teaches: ['Summons'],
      blurb: 'A knight carries a fire god inside him. The Empire wants it back.',
      hero: {who: 'clive', deck: {label: 'tribute', name: "Clive's Summons", colors: 'R', list: `
4 Summon: G.F. Ifrit
4 Summon: Brynhildr
3 Clive, Ifrit's Dominant // Ifrit, Warden of Inferno
3 Raubahn, Bull of Ala Mhigo
3 Prompto Argentum
3 Vaan, Street Thief
3 Fire Magic
24 Mountain
2 Queen Brahne
2 Lightning, Security Sergeant
2 Seifer Almasy
4 Sabotender
3 Zell Dincht`}},
      villain: {who: 'empire', deck: {label: 'tribute', name: 'The Imperial Dominants', colors: 'BR', list: `
3 Freya Crescent
4 Mysidian Elder
4 Zell Dincht
4 Shambling Cie'th
1 Ahriman
4 Demon Wall
4 Hecteyes
4 Sabotender
12 Mountain
12 Swamp
2 Shinra Reinforcements
4 Undercity Dire Rat
2 Dark Confidant`}},
      scene: [q('stage', 'Thank you, Torgal. For never giving up.'),
        q('stage', 'Hm! Not bad for a human.'),
        s('clive', 'Summons are Saga creatures: they arrive, do their work over three turns, then the Saga ends. Time them.')],
      villainScene: [s('empire', 'The Dominant is ours. The Empire collects what it is owed.')],
      cues: {hero: cue('Come, Ifrit.', 'Summon!', 'The flame is fading...', 'Ifrit is satisfied.', 'Not today...', 'Summons last three turns. Play them before the big attack.'),
        villain: cue('For the Empire.', 'Dominant!', 'Hold the line!', 'Collected.', 'Retreat!')}},
    {slot: 3, mood: 'tension', kind: 'Rival', title: 'Kefka', difficulty: 'Normal', rewardSet: 'fin', teaches: ['Discard'],
      blurb: 'A court mage laughs while the world burns. The Returners will not stand for it.',
      hero: {who: 'returners', deck: {label: 'tribute', name: 'The Returners', colors: 'UR', list: `
4 Rook Turret
4 Barret Wallace
4 Seifer Almasy
3 Firion, Wild Rose Warrior
4 Summon: Shiva
3 Summon: Esper Ramuh
2 Edgar, King of Figaro
4 Il Mheg Pixie
4 Fire Magic
4 Ice Magic
12 Island
12 Mountain`}},
      villain: {who: 'kefka', deck: {label: 'tribute', name: "Kefka's Court", colors: 'UBR', list: `
2 Sabotender
4 Ultros, Obnoxious Octopus
3 Kefka, Court Mage // Kefka, Ruler of Ruin
2 Black Waltz No. 3
3 Garland, Knight of Cornelia // Chaos, the Endless
4 Hecteyes
4 Ahriman
4 Dark Confidant
3 Hill Gigas
2 Overkill
2 Vayne's Treachery
3 Laughing Mad
8 Island
8 Swamp
8 Mountain`}},
      scene: [q('stage', 'Sabin...let\'s settle this with the toss of a coin.'),
        q('stage', 'I was there... I saw when Kefka used his Light of Judgment to torch the village of Mobliz, far to the east.'),
        s('returners', 'He makes you discard. Keep your best cards in play, not in your hand.')],
      villainScene: [s('kefka', 'Ha ha! Burn it all, then do it again for the people in the back.')],
      cues: {hero: cue('We will end this.', 'Now!', 'He is laughing...', 'The court is quiet.', 'Fall back...', 'He strips your hand. Play your cards out.'),
        villain: cue('Ha ha ha!', 'Judgment!', 'Mmm... no.', 'Ruler of Ruin.', 'Not funny!')}},
    {slot: 4, mood: 'tension', kind: 'Meta', title: 'Izzet Prowess', difficulty: 'Normal', rewardSet: 'fin', teaches: ['Prowess'],
      blurb: 'A young black mage and a soldier who has forgotten her name. Spells fly both ways.',
      hero: {who: 'vivi', deck: {label: 'tribute', name: "Vivi's Black Magic", colors: 'UR', list: `
3 Vivi Ornitier
4 Il Mheg Pixie
4 Prompto Argentum
4 Raubahn, Bull of Ala Mhigo
4 Seifer Almasy
3 Firion, Wild Rose Warrior
4 Rook Turret
3 Thunder Magic
4 Fire Magic
3 Ice Magic
12 Island
12 Mountain`}},
      villain: {who: 'lightning', deck: {label: 'tribute', name: "Lightning's Guard", colors: 'RW', list: `
3 Weapons Vendor
4 Gaelicat
2 Lightning, Army of One
4 Lightning, Security Sergeant
4 Adelbert Steiner
4 Dwarven Castle Guard
4 Coeurl
4 Ambrosia Whiteheart
4 Snow Villiers
2 Battle Menu
1 Slash of Light
12 Plains
12 Mountain`}},
      scene: [q('stage', 'Lightning. It flashes bright, then fades away. It can\'t protect. It only destroys.'),
        s('vivi', 'Prowess: when you cast a noncreature spell, the creature gets +1/+1 until end of turn. Cast a spell, then swing.')],
      villainScene: [q('lightning', 'I had to be strong for Serah, so I thought I needed to forget my past. And I became Lightning.')],
      cues: {hero: cue('I... I can do this.', 'Black magic!', 'Too many...', 'We did it!', 'I am sorry...', 'Cast a spell before you attack to grow the creature.'),
        villain: cue('Move.', 'Overwhelm!', 'Still standing...', 'Clear.', 'Not like this...')}},
    {slot: 5, mood: 'march', kind: 'Lesson', title: 'The Long Pilgrimage', difficulty: 'Normal', rewardSet: 'fin', teaches: ['Counterspells'],
      blurb: 'A blitzball star on a pilgrimage with the guardians of a summoner. A giant called Sin waits at the end.',
      hero: {who: 'tidus', deck: {label: 'tribute', name: "Tidus and the Guardians", colors: 'WU', list: `
3 Tidus, Blitzball Star
3 Hope Estheim
4 Il Mheg Pixie
4 Dwarven Castle Guard
4 Coeurl
3 Adelbert Steiner
4 Gaelicat
4 Dragoon's Wyvern
2 Rook Turret
3 Aerith Gainsborough
2 Magic Damper
12 Plains
12 Island`}},
      villain: {who: 'sin', deck: {label: 'tribute', name: "Sin's Pilgrimage", note: 'Sin itself is three colours; this deck is black, the colour of its toxins.', colors: 'B', list: `
2 Qutrub Forayer
4 Tonberry
2 Seymour Flux
2 Ahriman
4 Shambling Cie'th
4 Demon Wall
2 Hecteyes
4 Undercity Dire Rat
24 Swamp
4 Al Bhed Salvagers
4 Namazu Trader
4 Shinra Reinforcements`}},
      scene: [s('stage', 'Spira. The sea is calm, and everyone on the shore is waiting for something.'),
        q('stage', 'All I can do is go forward. Keep fighting and surviving, until I find the answers I need.'),
        s('tidus', 'Counterspells answer a spell as it is cast. Keep mana open and let the big spell resolve in the second turn.')],
      villainScene: [s('sin', 'A shadow on the water. It does not speak. It only returns.')],
      cues: {hero: cue('Let us go.', 'Together!', 'The tide is against us...', 'The sea is calm.', 'Pilgrim down...', 'Hold mana open and counter their biggest spell.'),
        villain: cue('[a deep tone]', '[the waters rise]', '[a ripple]', '[the shore is quiet]', '[Sin turns away]')}},
    {slot: 6, mood: 'tension', kind: 'Lesson', title: 'The Road Trip', difficulty: 'Normal', rewardSet: 'fin', teaches: ['Vehicles'],
      blurb: 'Four friends and a car on a long road. The empire wants the prince, and the road is long.',
      hero: {who: 'noctis', deck: {label: 'tribute', name: "The Crown Prince's Crew", colors: 'RG', list: `
4 Goobbue Gardener
4 Town Greeter
3 Gladiolus Amicitia
2 Prompto Argentum
4 Torgal, A Fine Hound
4 Cactuar
4 Traveling Chocobo
4 Gigantoad
4 Balamb T-Rexaur
1 The Regalia
2 Chocobo Kick
12 Mountain
12 Forest`}},
      villain: {who: 'niflheim', deck: {label: 'tribute', name: 'The Empire of Niflheim', colors: 'B', list: `
3 Ardyn, the Usurper
3 Gaius van Baelsar
3 Kain, Traitorous Dragoon
4 Al Bhed Salvagers
4 Qutrub Forayer
4 Shinra Reinforcements
4 Namazu Trader
4 Dark Confidant
3 Overkill
4 Vayne's Treachery
24 Swamp`}},
      scene: [s('stage', 'A road across a kingdom that is not yours. A black car, a full tank, and a chocobo on the horizon.'),
        q('stage', 'As long as there are people who need to be protected, I\'ll keep on fighting!'),
        s('noctis', 'Vehicles are artifacts that fight when crewed. Tap creatures with enough power and the car attacks.')],
      villainScene: [s('niflheim', 'The throne belongs to the empire. The prince is only a name on a road.')],
      cues: {hero: cue('On the road.', 'Crew up!', 'The road is closing...', 'Gas up, move on.', 'Off the road...', 'Crew the Regalia with your creatures to attack.'),
        villain: cue('For Niflheim.', 'Take the road!', 'The line is broken...', 'The throne is ours.', 'Fall back...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Golgari Summons vs Azorius Control', difficulty: 'Normal', rewardSet: 'fin', teaches: ['Playing around counterspells'],
      blurb: 'Two decks of the set. One calls the summons, one tries to answer every spell it casts.',
      hero: {who: 'summoners', deck: {label: 'tribute', name: 'Golgari Summons', colors: 'BG', list: `
4 Ahriman
4 Shambling Cie'th
2 Undercity Dire Rat
4 Hecteyes
2 Fang, Fearless l'Cie
2 Jenova, Ancient Calamity
3 Vanille, Cheerful l'Cie
2 Summon: Fenrir
2 Summon: Fat Chocobo
1 Summon: Titan
2 Summon: Anima
2 Quina, Qu Gourmet
2 Fight On!
4 Gysahl Greens
12 Swamp
12 Forest`}},
      villain: {who: 'azorius', deck: {label: 'tribute', name: 'Azorius Control', colors: 'WU', list: `
4 Rosa, Resolute White Mage
3 Beatrix, Loyal General
3 Minwu, White Mage
4 Scorpion Sentinel
4 Dragoon's Wyvern
3 Y'shtola Rhul
4 Magic Damper
4 Syncopate
4 Ice Magic
3 Coeurl
12 Plains
12 Island`}},
      scene: [q('stage', 'The Shinra people told us that everyone would be happy once the reactor was built. But all it brought us was sadness...'),
        s('summoners', 'They answer spells. Cast a cheap one first, then the summon you need.')],
      villainScene: [s('azorius', 'Every spell has a price. We make you pay it twice.')],
      cues: {hero: cue('Come, summon.', 'Summon!', 'They answered it...', 'The summon stands.', 'Countered...', 'Bait a counter with a cheap spell first.'),
        villain: cue('Not that.', 'Countered!', 'We are out of answers...', 'Control.', 'It resolved...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Sephiroth', difficulty: 'Hard', rewardSet: 'fin', teaches: ['Transform'],
      blurb: 'The fabled SOLDIER believes the planet already belongs to him. Cloud and his friends say otherwise.',
      hero: {who: 'party', deck: {label: 'tribute', name: 'Cloud and Friends', colors: 'GW', list: `
3 Cloud, Midgar Mercenary
3 Aerith Gainsborough
4 Tifa Lockhart
3 Zack Fair
4 Torgal, A Fine Hound
4 Quina, Qu Gourmet
4 Sazh Katzroy
4 Vanille, Cheerful l'Cie
3 Yuna, Hope of Spira
2 Buster Sword
2 Restoration Magic
12 Plains
12 Forest`}},
      villain: {who: 'sephiroth', deck: {label: 'tribute', name: "Sephiroth's Remnants", colors: 'B', list: `
3 Sephiroth, Fabled SOLDIER // Sephiroth, One-Winged Angel
3 Vincent Valentine // Galian Beast
3 Reno and Rude
1 Tonberry
4 Malboro
4 Shambling Cie'th
3 Summon: Anima
3 Summon: Primal Odin
4 Ahriman
3 Fight On!
3 Overkill
2 Dark Knight's Greatsword
24 Swamp`}},
      scene: [q('stage', "You gonna stand there and pretend you can't hear the planet crying out in pain?"),
        q('stage', "I'm pretty good at taking care of myself, you know."),
        q('sephiroth', 'This is the end... for all of you.'),
        s('cloud', 'His card transforms into One-Winged Angel. Kill him early or race the clock.')],
      villainScene: [q('sephiroth', 'Fate is not to be taken lightly, Cloud.'),
        s('sephiroth', 'The planet is mine. It has always been mine.')],
      cues: {hero: cue('Let us end this.', 'For the planet!', 'He is too strong...', 'Lifestream, heal this world.', 'Not yet... not yet...', 'He transforms. Remove him before he grows.'),
        villain: cue('Fate.', 'One-Winged Angel!', 'Impossible...', 'The planet is mine.', 'Cloud...')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Ultimate Weapon', difficulty: 'Hard', rewardSet: 'fin', rewardCard: 'Ultima Weapon', mood: 'boss',
      teaches: ['Trample'],
      archive: {deck: 'The Weapons', when: 'Summer 2025', format: 'Story archive, no tournament list.',
        what: 'A green deck of the largest monsters in the set: Diamond Weapon, Ancient Adamantoise and Coliseum Behemoth.',
        why: 'It is a big-creature gauntlet in the JRPG tradition, not a deck anyone won with.',
        beat: 'Block the first big creature, chump the second, and burn it out before the third lands.',
        after: 'Nothing; this is the optional superboss at the end of the story.'},
      blurb: 'Past the final fight, the planet keeps one more secret: a weapon too large to name.',
      hero: {who: 'hunters', deck: {label: 'tribute', name: 'The Hunters', colors: 'RW', list: `
3 Lightning, Army of One
4 Lightning, Security Sergeant
4 Snow Villiers
4 Barret Wallace
4 Seifer Almasy
4 Zell Dincht
3 Firion, Wild Rose Warrior
2 Light of Judgment
3 Judgment Bolt
2 Warrior's Sword
3 Fire Magic
12 Plains
12 Mountain`}},
      villain: {who: 'weapons', deck: {label: 'tribute', name: 'The Weapons', note: 'Built from cards in this act\'s set only. No tournament list is copied.', colors: 'G', list: `
2 Sazh's Chocobo
4 Town Greeter
1 Diamond Weapon
1 Ancient Adamantoise
2 Coliseum Behemoth
3 Summon: Titan
4 Gysahl Greens
4 Gran Pulse Ochu
4 Goobbue Gardener
4 Cactuar
3 Jumbo Cactuar
4 Reach the Horizon
24 Forest`}},
      scene: [s('stage', 'The crystal sky splits. Something that has been asleep since before the war turns over.'),
        s('hunters', 'It is huge. Kill it before the third monster arrives.')],
      villainScene: [s('weapons', '[the ground shakes]')],
      cues: {hero: cue('Hunters, up.', 'Strike!', 'It is enormous...', 'The weapon is down.', 'Crushed...', 'Chump the first, remove the second.'),
        villain: cue('[a roar]', '[the earth cracks]', '[a rumble]', '[silence]', '[the weapon sleeps]')},
      after: [s('stage', 'Recorded: the Ultimate Weapon sleeps again. The crystal sky closes.')]},
  ],
};
