// Act 11: The Metal World (Mirrodin, Darksteel, Fifth Dawn). Story and dialogue:
// /mnt/project-files/story/act-11-script.md (generated from this file). Land set: mrd.
// Mirrodin is the plane Karn built and left behind. Its keeper, the golem Memnarch, has gone mad. Glissa Sunseeker hunts
// the levelers that killed her family and finds the secret at the heart of the world. Every quoted line is real flavor
// text from Mirrodin, Darksteel or Fifth Dawn; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'steel-plane-five-suns',
  era: '2004-06-20',
  intro: [s('stage', 'Far from Dominaria, a plane made entirely of metal. Karn built it, called it Argentum, and left.'),
    s('stage', 'He left a keeper behind: a golem named Memnarch. Memnarch kept the plane for a very long time, alone.'),
    q('stage', 'In the blur between metal and flesh, Memnarch found madness.'),
    s('stage', 'Now the plane is called Mirrodin. Four suns cross its sky. Elves, leonin, goblins and men live on it, and none of them know how they got here.'),
    q('glissa', "There's a secret at the heart of this world, and I will unlock it.")],
  finale: [s('stage', 'In the Panopticon, Memnarch falls. The keeper of Mirrodin goes still among his myr.'),
    s('glissa', 'He was going to cut the spark out of me. Whatever a spark is.'),
    s('slobad', 'Something old. Something he wanted to be. Slobad thinks he copied it from somebody.'),
    q('stage', 'The ur-golem etchings begin by celebrating Mirrodin\'s creator, a golem of almost limitless power. They end by cursing its protector, a being called Memnarch.'),
    s('stage', 'The levelers stop. The myr stop watching. Five suns cross the sky now, and the Tangle grows toward the green one.'),
    s('stage', 'Deep in the core, where nobody looks, a drop of black oil that was never part of Karn\'s design begins, very slowly, to spread.')],
  villainFinale: [s('stage', 'The elf lies still on the floor of the Panopticon. Memnarch bends over her, listening for the spark.'),
    s('memnarch', 'I was built to keep his world. He never came back to see it.'),
    s('memnarch', 'So I kept it. I made the myr and the levelers. Everything he made, I made again.'),
    s('memnarch', 'And now I will take the one thing he had that I did not. Then I will leave, as he did.'),
    s('stage', 'Deep in the core, a drop of black oil moves. Memnarch does not notice. He never did.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Fold into Aether', number: '31'},
    glissa: {name: 'Glissa', title: 'Sunseeker', card: 'Glissa Sunseeker', number: '120', focus: '50% 25%'},
    slobad: {name: 'Slobad', title: 'Goblin Tinkerer', card: 'Slobad, Goblin Tinkerer', number: '69', focus: '50% 25%'},
    bosh: {name: 'Bosh', title: 'Iron Golem', card: 'Bosh, Iron Golem', number: '147', focus: '50% 25%'},
    memnarch: {name: 'Memnarch', title: 'Keeper of Mirrodin', card: 'Memnarch', number: '129', focus: '50% 25%'},
    leveler: {name: 'The Levelers', title: 'Memnarch\'s Harvest', card: 'Leveler', number: '195', focus: '50% 35%'},
    hoverguard: {name: 'The Hoverguards', title: 'Eyes of the Synod', card: 'Somber Hoverguard', focus: '50% 30%'},
    pontifex: {name: 'Pontifex', title: 'Elder Researcher', card: 'Vedalken Mastermind', number: '40', focus: '50% 25%'},
    ravager: {name: 'The Arcbound', title: 'Darksteel Crew', card: 'Arcbound Ravager', number: '100', focus: '50% 30%'},
    raksha: {name: 'Raksha', title: 'Golden Cub, Leonin Kha', card: 'Raksha Golden Cub', number: '12', focus: '50% 25%'},
    geth: {name: 'Geth', title: 'Keeper of the Vault', fixed: fixed('Geth, Lord of the Vault', 'som', '64', 'fed31f2f-370d-4bbe-aa57-82249ed1b4d4', 'Whit Brachna'), focus: '50% 25%'},
    krark: {name: 'The Krark Clan', title: 'Goblins of the Furnace', card: 'Krark-Clan Grunt', number: '97', focus: '50% 30%'},
    sylvok: {name: 'The Sylvok', title: 'Druids of the Tangle', card: 'Sylvok Explorer', number: '93', focus: '50% 30%'},
    janus: {name: 'Janus', title: 'Speaker of the Synod', card: 'Vedalken Archmage', focus: '50% 25%'},
    clamp: {name: 'The Clamp Deck', title: 'Spring 2004', card: 'Skullclamp', number: '140', focus: '50% 40%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Glissa\'s Hunt', difficulty: 'Easy', rewardSet: 'mrd', teaches: ['Equipment'],
      blurb: 'The levelers came through the Tangle and killed Glissa\'s family. Every elf says they come once a century, from nowhere, for no reason. Glissa does not believe in no reason.',
      hero: {who: 'glissa', deck: {label: 'tribute', name: 'Sunseeker\'s Hunt', colors: 'GW', list: `
4 Tel-Jilad Chosen
4 Leonin Skyhunter
4 Viridian Zealot
4 Troll Ascetic
4 Fangren Hunter
2 Tel-Jilad Archers
4 Bonesplitter
2 Leonin Scimitar
2 Loxodon Warhammer
3 Oxidize
3 Viridian Shaman
13 Forest
11 Plains`}},
      villain: {who: 'leveler', deck: {label: 'tribute', name: 'The Levelers', colors: 'R', list: `
4 Ornithopter
4 Frogmite
4 Myr Enforcer
4 Clockwork Condor
4 Clockwork Beetle
4 Atog
4 Shrapnel Blast
4 Electrostatic Bolt
4 Bonesplitter
4 Great Furnace
4 Darksteel Citadel
16 Mountain`}},
      scene: [q('stage', 'Once a century, the levelers rip through every corner of Mirrodin, obeying the commands of an unseen master.'),
        q('stage', 'When the levelers come again, we shall be ready for them.'),
        s('glissa', 'Equipment: pay once to make it, then pay its equip cost to strap it to a creature. If the creature dies, the blade stays. Pick it up again.'),
        s('glissa', 'They are machines. Machines have makers. I want to know who.')],
      villainScene: [s('stage', 'The levelers do not speak. Somewhere above the Tangle, something is counting.'),
        q('stage', 'Memnarch created the myr with three qualities in mind: dependability, controllability, and disposability.')],
      cues: {hero: cue('For my mother. For my father.', 'Cut it down.', 'There are too many of them...', 'Machines have makers. I will find yours.', 'The Tangle... will remember...', 'Strap it on. Again.'),
        villain: cue('[grinding gears]', '[the blades spin faster]', '[a gear slips]', '[the harvest continues]', '[silence]')},
      after: [s('glissa', 'This one carried a mark. Not elf work. Not goblin. Someone built these on purpose.'),
        s('stage', 'A goblin is picking through the wreck before the smoke clears.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Junk into Engines', difficulty: 'Easy', rewardSet: 'mrd', teaches: ['Affinity', 'Artifact lands'],
      blurb: 'Slobad was thrown out of the Krark Clan for being too clever. He knows artifacts better than anyone in the Tangle, and he has just been caught by vedalken hoverguards taking one apart.',
      hero: {who: 'slobad', deck: {label: 'tribute', name: 'Slobad\'s Workshop', colors: 'R', list: `
4 Ornithopter
4 Frogmite
4 Myr Enforcer
4 Arcbound Worker
4 Krark-Clan Grunt
4 Goblin Striker
4 Pyrite Spellbomb
4 Shrapnel Blast
2 Cranial Plating
2 Furnace Dragon
4 Great Furnace
4 Darksteel Citadel
16 Mountain`}},
      villain: {who: 'hoverguard', deck: {label: 'tribute', name: 'Synod Hoverguards', colors: 'U', list: `
4 Neurok Spy
4 Neurok Familiar
4 Somber Hoverguard
4 Hoverguard Observer
4 Advanced Hoverguard
2 Looming Hoverguard
2 Trinket Mage
4 Thirst for Knowledge
3 Condescend
3 Echoing Truth
2 Annul
4 Seat of the Synod
20 Island`}},
      scene: [q('stage', 'The vedalken interrogate all intruders, once the hoverguards are done with them.'),
        q('slobad', 'Is it the stomping kind or the munching kind?'),
        s('slobad', 'Affinity: every artifact you have makes affinity spells cost one less. Artifact lands count too. Pile up junk, and the big ones cost nothing.'),
        s('glissa', 'Can you fight?'), s('slobad', 'No. But the junk can.')],
      villainScene: [q('stage', 'It could be made to run silently, but its low hum reminds the Neurok that they are always watched.'),
        q('stage', 'Vedalken eyes don\'t see the beauty in things. They see only what those things can teach.'),
        s('hoverguard', 'Goblin. Elf. Both off their maps. Report to the Synod.')],
      cues: {hero: cue('Slobad builds! Slobad builds fast!', 'Free! It was free!', 'Slobad\'s junk is running out...', 'Junk wins. Junk always wins.', 'Slobad should have stayed in the Furnace...', 'Every scrap counts.'),
        villain: cue('Intruders logged.', 'Observe.', 'Hoverguard damaged...', 'Report filed.', 'Signal lost.')},
      after: [q('glissa', 'I used to joke that he had been exiled for being too smart. Now I know why he never laughed.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Stored in the Machine', difficulty: 'Easy', rewardSet: 'mrd', teaches: ['Imprint'],
      blurb: 'In the vedalken city of Lumengrid, the researcher Pontifex keeps a vault of machines that remember. An iron golem has walked in looking for his own past. Pontifex would like to keep him.',
      hero: {who: 'bosh', deck: {label: 'tribute', name: 'The Iron Golem', colors: 'R', list: `
4 Vulshok Berserker
4 Spikeshot Goblin
4 Goblin Brawler
3 Arc-Slogger
2 Solemn Simulacrum
4 Myr Enforcer
4 Frogmite
4 Magma Jet
4 Electrostatic Bolt
3 Fireball
4 Pyrite Spellbomb
4 Great Furnace
16 Mountain`}},
      villain: {who: 'pontifex', deck: {label: 'tribute', name: 'The Vedalken Archive', colors: 'U', list: `
3 Duplicant
3 Mirror Golem
2 Soul Foundry
1 Chrome Mox
3 Silver Myr
4 Trinket Mage
4 Neurok Familiar
4 Psychic Membrane
3 Hoverguard Sweepers
4 Thirst for Knowledge
4 Condescend
3 Echoing Truth
2 Last Word
4 Seat of the Synod
16 Island`}},
      scene: [q('stage', 'As Glissa searches for the truth about Memnarch, Bosh searches to unearth the secrets of his past.'),
        s('bosh', 'This machine. It has my face inside it.'),
        s('pontifex', 'Imprint: some machines exile a card when they arrive, and keep it. Duplicant becomes the creature it ate. Mirror Golem guards against everything it holds.'),
        s('slobad', 'So if it eats Bosh, it becomes Bosh?'), s('pontifex', 'Precisely. Isn\'t it wonderful?')],
      villainScene: [q('pontifex', 'Did it have this shape upon Mirrodin\'s creation, or did some inconceivable force shape the unshapable?'),
        s('pontifex', 'A golem that thinks. I must have him for the archive.')],
      cues: {hero: cue('BOSH. REMEMBERS. NOTHING. YET.', 'BOSH. BURNS.', 'Bosh is... cooling...', 'Bosh is not for keeping.', 'Bosh... forgets...', 'Burn the archive.'),
        villain: cue('Begin the recording.', 'Fascinating.', 'The archive is failing...', 'Catalogued.', 'Data... lost...')},
      after: [s('bosh', 'The machine showed me a forge. Older than this world. And a maker, walking away.'),
        s('glissa', 'Then we find the maker.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Darksteel', difficulty: 'Normal', rewardSet: 'dst', teaches: ['Modular', 'Indestructible'],
      blurb: 'Under the plane\'s surface, Memnarch\'s Arcbound crews guard the way to his tower. They take each other apart to grow, and the darksteel they stand on cannot be broken.',
      hero: {who: 'glissa', deck: {label: 'tribute', name: 'Tangle and Furnace', colors: 'GR', list: `
4 Tel-Jilad Chosen
4 Troll Ascetic
4 Viridian Shaman
4 Fangren Firstborn
3 Viridian Zealot
3 Vulshok Berserker
4 Magma Jet
3 Oxidize
3 Electrostatic Bolt
4 Bonesplitter
11 Forest
9 Mountain
2 Tree of Tales
2 Great Furnace`}},
      villain: {who: 'ravager', deck: {label: 'tribute', name: 'The Arcbound Crew', colors: 'C', list: `
4 Arcbound Ravager
4 Arcbound Worker
4 Arcbound Stinger
4 Arcbound Slith
4 Arcbound Lancer
3 Arcbound Crusher
3 Cranial Plating
1 Arcbound Bruiser
1 Myr Enforcer
4 Welding Jar
4 Ornithopter
4 Frogmite
4 Darksteel Citadel
4 Blinkmoth Nexus
4 Mirrodin's Core
4 Seat of the Synod
4 Great Furnace`}},
      scene: [q('stage', 'Panopticon, forge of the Darksteel Eye, home of Mirrodin\'s keeper.'),
        s('slobad', 'Darksteel. Nothing breaks it. Slobad tried for a whole year.'),
        s('glissa', 'Modular: when an Arcbound dies, its counters jump to another artifact creature. Kill the Ravager first, or every death feeds it.'),
        q('stage', 'The parts are as strong as the whole.')],
      villainScene: [q('stage', 'Break in case of emergency.'),
        s('ravager', '[the crew locks together, plate to plate]')],
      cues: {hero: cue('Into the dark, Slobad.', 'Tear it apart!', 'They keep getting bigger...', 'Pieces. Only pieces.', 'They are... rebuilding...', 'Kill the Ravager first.'),
        villain: cue('[plates lock]', '[the crew feeds]', '[a joint cracks]', '[reassembled]', '[scattered parts]')},
      after: [s('stage', 'At the bottom of the shaft, a tower of darksteel. On it, an eye that never closes.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Fifth Dawn', difficulty: 'Normal', rewardSet: '5dn', teaches: ['Sunburst'],
      blurb: 'A fifth sun is rising out of Mirrodin\'s core. Raksha, the young leonin kha, takes it as a sign. So does Geth, keeper of the Vault, and his nim come out of the Mephidross to meet it.',
      hero: {who: 'raksha', deck: {label: 'tribute', name: 'Taj-Nar Pride', colors: 'GWU', list: `
4 Joiner Adept
4 Sylvok Explorer
4 Pentad Prism
4 Skyreach Manta
4 Solarion
3 Sawtooth Thresher
4 Leonin Skyhunter
3 Skyhunter Patrol
3 Clearwater Goblet
3 Opaline Bracers
4 Eternal Witness
4 Tree of Tales
2 Ancient Den
2 Seat of the Synod
8 Forest
4 Plains`}},
      villain: {who: 'geth', deck: {label: 'tribute', name: 'Mephidross Nim', colors: 'B', list: `
4 Moriok Rigger
4 Disciple of the Vault
4 Nim Abomination
4 Dross Prowler
4 Woebearer
4 Chittering Rats
3 Mephitic Ooze
3 Mephidross Vampire
4 Myr Enforcer
4 Frogmite
4 Vault of Whispers
16 Swamp
2 Night's Whisper`}},
      scene: [q('stage', 'To some the birth of the fifth sun was a sign of doom. To others it was a sign of salvation. But to all it was a sign.'),
        q('raksha', 'I may be kha, but without my soldiers, my people, I am nothing.'),
        s('raksha', 'Sunburst: these machines take a counter for each colour of mana spent on them. Pay with every colour you have.'),
        q('stage', 'A chorus of life heralds the arrival of Mirrodin\'s final sun.')],
      villainScene: [q('geth', 'Feel the burn of the mists. Master them. They will devour your enemies.'),
        q('stage', 'In the swirling mists, you could walk right up to one and not know until its teeth are in your throat.'),
        q('geth', 'The one who dies with the most toys is still dead.')],
      cues: {hero: cue('For the pride!', 'Five suns!', 'The mists are thick...', 'The nim go back to the Dross.', 'Taj-Nar... forgive me...', 'Every colour.'),
        villain: cue('Rise, my nim.', 'Devour them.', 'The mists thin...', 'More toys for the Vault.', 'The Vault... will wait...')},
      after: [s('stage', 'The fifth sun clears the horizon. It is green. In the Tangle, every tree turns toward it.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Ravager Affinity', difficulty: 'Normal', rewardSet: 'dst', teaches: ['Sacrifice'],
      blurb: 'Around the real world in 2004, one deck was everywhere: Arcbound Ravager and a pile of artifact lands. On Mirrodin, the Krark Clan built the same thing out of scrap. You get the original.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Ravager Affinity', colors: 'UB', archetype: 'Affinity', list: `
4 Arcbound Ravager
4 Disciple of the Vault
4 Frogmite
4 Myr Enforcer
4 Ornithopter
4 Somber Hoverguard
4 Thoughtcast
4 Cranial Plating
2 Welding Jar
2 Talisman of Dominance
4 Seat of the Synod
4 Vault of Whispers
4 Darksteel Citadel
4 Blinkmoth Nexus
4 Island
4 Swamp`}},
      villain: {who: 'krark', deck: {label: 'tribute', name: 'Krark-Clan Affinity', colors: 'R', archetype: 'Affinity', list: `
4 Arcbound Ravager
4 Frogmite
4 Myr Enforcer
4 Ornithopter
4 Atog
4 Disciple of the Vault
4 Shrapnel Blast
4 Cranial Plating
4 Welding Jar
2 Talisman of Indulgence
4 Great Furnace
4 Vault of Whispers
4 Darksteel Citadel
4 Blinkmoth Nexus
3 Mountain
3 Swamp`}},
      scene: [q('stage', 'All the junk, refuse, and offal of the Krark Clan is diligently collected, melted down, and made into more junk, refuse, and offal.'),
        s('you', 'A mirror. Same engine, different paint.'),
        s('slobad', 'Feed the Ravager what is about to die anyway. Never feed it a land you still need.'),
        q('stage', 'From trinket to trauma.')],
      villainScene: [q('krark', 'What do you mean, we\'re out of stuff to melt down? Give me your leg.'),
        q('krark', 'Well, I jammed the whatsit into the whackdoodle, but I think I broke the thingamajigger.')],
      cues: {hero: cue('Same engine. Better driver.', 'Feed it.', 'Out of fuel...', 'Scrap.', 'They melted me down...', 'Count the artifacts.'),
        villain: cue('MELT IT!', 'Thingamajigger!', 'Out of stuff...', 'Melt the loser!', 'Who broke it? Who?')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Tooth and Nail', difficulty: 'Normal', rewardSet: 'mrd', teaches: ['Entwine'],
      blurb: 'The Sylvok druids grow mana out of the Tangle until they can call anything. Janus of the vedalken Synod holds the shackles that let him take anything. Two ways to win a long game.',
      hero: {who: 'sylvok', deck: {label: 'tribute', name: 'Tooth and Nail', colors: 'G', archetype: 'Ramp', list: `
4 Tooth and Nail
4 Sylvan Scrying
2 Reap and Sow
3 Tel-Jilad Archers
4 Wayfarer's Bauble
4 Viridian Joiner
4 Eternal Witness
3 Solemn Simulacrum
1 Darksteel Colossus
2 Platinum Angel
2 Duplicant
2 Plated Slagwurm
1 Tornado Elemental
4 Mirrodin's Core
20 Forest`}},
      villain: {who: 'janus', deck: {label: 'tribute', name: 'The Synod\'s Shackles', colors: 'U', archetype: 'Control', list: `
3 Vedalken Shackles
4 Thirst for Knowledge
4 Condescend
4 Override
4 Last Word
3 Echoing Truth
4 Trinket Mage
3 Hoverguard Sweepers
3 Qumulox
3 Duplicant
1 Fold into Aether
24 Island`}},
      scene: [q('stage', 'Any creature on a druid\'s shoulder is his family, any land under his feet his home.'),
        q('stage', 'He watches from above. He watches from below. He watches from within.'),
        s('sylvok', 'Entwine: a spell with two modes. Pay the entwine cost and you get both. Tooth and Nail with nine mana finds two creatures and puts them into play.')],
      villainScene: [q('janus', 'The Knowledge Pool knows. Memnarch understands.'),
        q('stage', 'Memnarch shared a touch of his power with the vedalken in return for their service. It is a debt he intends to collect.')],
      cues: {hero: cue('The Tangle provides.', 'Tooth AND nail!', 'He took my giant...', 'Grown, not built.', 'The roots... were not deep enough...', 'Nine mana. Then anything.'),
        villain: cue('The Synod is in session.', 'Yours is mine.', 'The Pool is clouded...', 'Memnarch understands.', 'Unacceptable.')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Memnarch', difficulty: 'Hard', rewardCard: 'Sword of Fire and Ice', rewardSet: '5dn', teaches: ['Answering artifacts'],
      blurb: 'Memnarch made the levelers and the myr, all to pull one elf to his tower. Glissa has a spark, and he wants it. Glissa, Slobad and Bosh go to the Panopticon to end it.',
      hero: {who: 'glissa', deck: {label: 'tribute', name: 'Glissa, Slobad and Bosh', colors: 'GR', list: `
4 Troll Ascetic
4 Viridian Shaman
2 Fangren Firstborn
2 Viridian Zealot
4 Tel-Jilad Chosen
3 Eternal Witness
3 Arc-Slogger
4 Magma Jet
1 Oxidize
1 Tel-Jilad Exile
1 Fangren Hunter
2 Electrostatic Bolt
1 Tel-Jilad Archers
2 Leonin Scimitar
2 Bonesplitter
2 Fangren Hunter
11 Forest
9 Mountain
2 Tree of Tales`}},
      villain: {who: 'memnarch', deck: {label: 'tribute', name: 'Keeper of Mirrodin', colors: 'UB', archetype: 'Artifact control', list: `
2 Memnarch
2 Vedalken Shackles
4 Somber Hoverguard
4 Myr Enforcer
4 Frogmite
4 Disciple of the Vault
4 Thoughtcast
2 Qumulox
1 Platinum Angel
3 Duplicant
2 Arcbound Ravager
4 Cranial Plating
2 Ornithopter
4 Seat of the Synod
4 Vault of Whispers
4 Darksteel Citadel
5 Island
5 Swamp`}},
      scene: [q('memnarch', 'It is all in my grasp. Every petty dream, every grand scheme, every soul, every fear. It all flows through me and from me.'),
        s('glissa', 'You killed my family to bring me here.'),
        q('memnarch', 'If only the living were so easily salvaged.'),
        s('slobad', 'He takes things. Shackles take your creatures, Memnarch takes your machines. Keep your best one back until his tricks are spent.')],
      villainScene: [q('memnarch', 'Secrets are meant to remain secret.'),
        s('memnarch', 'The elf carries a spark. My maker had one. With it, he left. With it, I will follow.'),
        q('memnarch', 'Perhaps I should take Mirrodin apart and begin again.')],
      cues: {hero: cue('For the Tangle. For everyone you harvested.', 'Bosh, now!', 'He has everything...', 'Mirrodin is ours now.', 'The spark... he is taking it...', 'Keep one back.'),
        villain: {...cue('Welcome to the Panopticon.', 'Everything flows through me.', 'My myr... my suns...', 'The spark is mine.', 'I only wanted... to leave...'),
          half: {who: 'slobad', line: 'He copied everything his maker did. Slobad thinks he never knew how to be anything else.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Clamped', difficulty: 'Hard', rewardSet: 'dst', rewardCard: 'Skullclamp', mood: 'boss',
      era: '2004-02-20',
      teaches: ['Card advantage'],
      archive: {deck: 'Skullclamp Affinity', when: 'Spring 2004', format: 'Standard: Onslaught block, Eighth Edition, Mirrodin and Darksteel.',
        what: 'Ravager Affinity with Skullclamp, the one-mana equipment from Darksteel. Put it on a 1-toughness creature, the creature dies, you draw two cards.',
        why: 'Every cheap artifact creature turned into two cards, and Arcbound Ravager and Disciple of the Vault turned every death into damage. It ran out of cards almost never.',
        beat: 'Kill the Skullclamp, not the creatures. Without it they are only small machines. Hit the artifact lands and the deck slows to a crawl.',
        after: 'Skullclamp was banned in Standard from 20 June 2004. The rest of the deck kept winning until March 2005, when Arcbound Ravager, Disciple of the Vault and every artifact land were banned too.'},
      blurb: 'Deep in the Vault, a deck that broke a whole season. Every creature you kill draws it two cards.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Cleansing Fire', colors: 'GR', archetype: 'Artifact hate', list: `
4 Tel-Jilad Chosen
4 Vulshok Berserker
3 Viridian Shaman
1 Tel-Jilad Wolf
4 Viridian Zealot
4 Troll Ascetic
4 Fangren Hunter
1 Tel-Jilad Archers
2 Furnace Dragon
2 Oxidize
2 Electrostatic Bolt
2 Tel-Jilad Exile
3 Magma Jet
2 Creeping Mold
12 Forest
10 Mountain`}},
      villain: {who: 'clamp', deck: {label: 'tribute', name: 'Skullclamp Affinity', note: 'Built from the spring 2004 Ravager Affinity lists, with Skullclamp before its ban. No single tournament list is copied.', colors: 'UB', archetype: 'Affinity', list: `
4 Skullclamp
4 Arcbound Ravager
4 Disciple of the Vault
4 Frogmite
4 Myr Enforcer
4 Ornithopter
4 Somber Hoverguard
4 Thoughtcast
3 Welding Jar
4 Talisman of Dominance
2 Arcbound Worker
4 Seat of the Synod
4 Vault of Whispers
4 Darksteel Citadel
3 Blinkmoth Nexus
2 Island
2 Swamp`}},
      scene: [s('stage', 'The archive opens on a deck from a single season. Its first card is a small black bone clamp.'),
        s('you', 'Every death draws it two cards. Then I stop killing the creatures.'),
        s('slobad', 'Slobad would break the clamp. Then everything else.')],
      villainScene: [s('stage', 'The deck does not speak. It draws.')],
      cues: {hero: cue('Break the clamp.', 'Burn the engine!', 'It keeps drawing...', 'Banned for a reason.', 'Two more cards. Always two more.', 'Not the creature. The clamp.'),
        villain: cue('[draw two]', '[draw two]', '[the hand is empty]', '[draw two]', '[clamp destroyed]')},
      after: [s('stage', 'Recorded: banned 20 June 2004. One of the shortest lives a common equipment ever had.')]},
  ],
};
