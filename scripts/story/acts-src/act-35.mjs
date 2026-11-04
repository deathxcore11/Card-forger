// Act 35: The March of the Machine (Phyrexia: All Will Be One, March of the Machine, The Aftermath). Story and dialogue:
// /mnt/project-files/story/act-35-script.md (generated from this file). Land set: one.
// The final war of the Phyrexian arc: New Phyrexia, every plane at once, and Elesh Norn. Every quoted line is real flavor
// text from these sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'march-of-the-machine',
  era: '2023-02-03',
  intro: [q('stage', 'The Invasion Tree broke through the Blind Eternities and sent Phyrexian perfection coursing across the Multiverse.'),
    s('stage', 'Every plane, all at once. The Mirran resistance fights on New Phyrexia while the rest of the Multiverse is invaded.')],
  finale: [q('stage', 'Faced with a blast that would level not only New Phyrexia, but also a dozen innocent worlds, Elspeth consigned it—and herself—to the nothingness in between.'),
    s('stage', 'The invasion ends. The Omenpaths open across the Multiverse, and the planes can finally reach each other again.'),
    s('stage', 'Recorded: the Phyrexian arc ends here. What comes after belongs to the survivors.')],
  villainFinale: [q('stage', 'All worlds will know perfection.'),
    s('stage', 'In this version, Elesh Norn finishes the job, and there is no Multiverse left to argue about it.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Myr Custodian'},
    raiders: {name: 'Kaito\'s Raiders', title: 'Of Mirrodin', card: 'Kaito, Dancing Shadow', focus: '50% 25%'},
    vorinclex: {name: 'Vorinclex\'s Beasts', title: 'Of the Hunter Maze', card: 'Vorinclex // The Grand Evolution', focus: '50% 25%'},
    resistance: {name: 'The Resistance', title: 'Of New Phyrexia', card: 'Koth, Fire of Resistance', focus: '50% 25%'},
    jin: {name: 'Jin-Gitaxias\'s Sectives', title: 'Of the Surgical Bay', card: 'Jin-Gitaxias // The Great Synthesis', focus: '50% 25%'},
    planes: {name: 'The Planes', title: 'Defending Themselves', card: 'Wrenn and Realmbreaker', focus: '50% 25%'},
    invaders: {name: 'The Invaders', title: 'Of Phyrexia', card: 'Furnace Gremlin', focus: '50% 30%'},
    mirran: {name: 'The Mirran Remnants', title: 'Of Mirrodin', card: 'Marshal of Zhalfir', focus: '50% 30%'},
    compleated: {name: 'The Compleated', title: 'Of Elesh Norn', card: 'Mandible Justiciar', focus: '50% 30%'},
    wrenn: {name: 'Wrenn', title: 'Of the Roots', card: 'Wrenn and Realmbreaker', focus: '50% 25%'},
    roots: {name: 'The Invasion Roots', title: 'Of the Realmbreaker', card: 'Glissa Sunslayer', focus: '50% 25%'},
    grixis: {name: 'Grixis Midrange', title: 'Spring 2023', card: 'Archfiend of the Dross', focus: '50% 25%'},
    white: {name: 'Mono-White', title: 'Spring 2023', card: 'Porcelain Zealot', focus: '50% 30%'},
    rakdos: {name: 'Rakdos Midrange', title: 'Spring 2023', card: 'Rankle and Torbran', focus: '50% 25%'},
    legends: {name: 'Esper Legends', title: 'Spring 2023', card: 'Kemba, Kha Enduring', focus: '50% 25%'},
    elspeth: {name: 'Every Plane', title: 'United', card: 'Archangel Elspeth', focus: '50% 25%'},
    norn: {name: 'Elesh Norn', title: 'Mother of Machines', card: 'Elesh Norn, Mother of Machines', focus: '50% 25%'},
    atraxa: {name: 'Atraxa', title: 'Grand Unifier', card: 'Atraxa, Grand Unifier', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'For Mirrodin!', difficulty: 'Easy', rewardSet: 'one', teaches: ['Toxic'],
      blurb: 'A strike team of raiders hits New Phyrexia. Vorinclex\'s poisonous beasts are waiting.',
      hero: {who: 'raiders', deck: {label: 'tribute', name: 'Kaito\'s Raiders', colors: 'RW', list: `
4 Enduring Bondwarden
4 Swordsworn Cavalier
4 Coppercoat Vanguard
3 Sigiled Sentinel
3 Kithkin Billyrider
1 Monastery Mentor
2 Knight of the New Coalition
4 Mirran Banesplitter
3 Bladehold War-Whip
3 Ossification
3 Volt Charge
4 Wind-Scarred Crag
10 Mountain
10 Plains
2 Skrelv, Defector Mite`}},
      villain: {who: 'vorinclex', deck: {label: 'tribute', name: 'Vorinclex\'s Beasts', colors: 'G', list: `
4 Venerated Rotpriest
4 Cankerbloom
4 Copper Longlegs
4 Branchblight Stalker
3 Ichorspit Basilisk
3 Contagious Vorrac
3 Evolved Spinoderm
2 Vorinclex // The Grand Evolution
3 Oil-Gorger Troll
3 Infectious Bite
3 Titanic Growth
24 Forest`}},
      scene: [q('stage', 'It\'s hard to tell with this glare, but those must be the skyhunter reinforcements! They have arrived at last!'),
        q('stage', 'Our resistance is like the myr: small and easily overlooked, but loyal and resilient beyond measure.'),
        s('raiders', 'Toxic: a creature with toxic gives poison counters as well as damage. Ten poison counters and the player loses.')],
      villainScene: [q('stage', 'In Vorinclex\'s domain, only the mightiest survive, and all are prey in his endless hunt.'),
        q('stage', 'The strategies and politics of the Vicious Swarm are as subtle as Vorinclex himself.')],
      cues: {hero: cue('For Mirrodin!', 'Strike!', 'The beasts are fast...', 'The raid succeeds.', 'Overrun...', 'Race the poison counters.'),
        villain: cue('Hunt.', 'Devour!', 'The prey escapes...', 'All are prey.', 'The hunt ends...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Oil Spreads', difficulty: 'Easy', rewardSet: 'one', teaches: ['Oil counters'],
      blurb: 'The Resistance defends a safehouse from the sectives of Jin-Gitaxias.',
      hero: {who: 'resistance', deck: {label: 'tribute', name: 'The Resistance', colors: 'RG', list: `
4 Rustvine Cultivator
4 Armored Scrapgorger
3 Overgrown Pest
3 Oil-Gorger Troll
3 Tyrranax Atrocity
3 Koth, Fire of Resistance
3 Urabrask's Forge
4 Shrapnel Slinger
4 Volt Charge
3 Furnace Punisher
2 Thrill of Possibility
4 Copperline Gorge
10 Forest
10 Mountain`}},
      villain: {who: 'jin', deck: {label: 'tribute', name: 'The Sectives of Jin-Gitaxias', colors: 'UB', list: `
4 Faerie Mastermind
4 Ichor Synthesizer
4 Chrome Prowler
3 Jin-Gitaxias // The Great Synthesis
4 Gitaxian Raptor
3 Tenured Oilcaster
4 Negate
3 Drown in Ichor
3 Sheoldred's Edict
1 Gitaxian Anatomist
3 Thrummingbird
4 Darkslick Shores
10 Island
10 Swamp`}},
      scene: [q('stage', 'Melira helped me design it. Those who are infected by the oil cannot cross the threshold. We should be safe inside.'),
        q('stage', 'The oil is all-knowing. The trick is to ask the right questions.'),
        s('resistance', 'Oil counters: Phyrexian permanents store them as they work. When they have enough, they pay off. Pressure them before that happens.')],
      villainScene: [q('stage', 'It is Jin-Gitaxias\'s deepest exasperation that any part of his domain still requires maintenance.'),
        q('stage', 'Free will was an illusion so perfect it fooled even me. I know better now.')],
      cues: {hero: cue('Hold the door.', 'Burn it!', 'The oil is spreading...', 'The safehouse holds.', 'Compleated...', 'Strike before their oil pays off.'),
        villain: cue('Observe.', 'Iterate!', 'An inconsistency...', 'Progress.', 'Experiment failed...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Defend Each Plane', difficulty: 'Easy', rewardSet: 'mom', teaches: ['Battles'],
      blurb: 'March of the Machine: a plane becomes a battle, and the defender has to hold it.',
      hero: {who: 'planes', deck: {label: 'tribute', name: 'The Planes Defend', colors: 'GW', list: `
4 Wary Thespian
4 Kami of Whispered Hopes
4 Zhalfirin Lancer
3 Knight-Errant of Eos
3 Calix, Guided by Fate
3 Sigarda, Font of Blessings
3 Titanic Growth
3 Invasion of Zendikar // Awakened Skyclave
2 Invasion of Belenon // Belenon War Anthem
2 Invasion of Dominaria // Serra Faithkeeper
3 Surge of Salvation
2 Cut Short
4 Razorverge Thicket
10 Forest
10 Plains`}},
      villain: {who: 'invaders', deck: {label: 'tribute', name: 'The Invaders', colors: 'R', list: `
4 Furnace Gremlin
2 Beamtown Beatstick
4 Bloodfeather Phoenix
4 Harried Artisan // Phyrexian Skyflayer
4 Thrashing Frontliner
2 Volt Charge
2 Scrappy Bruiser
3 Burning Sun's Fury
1 Stoke the Flames
24 Mountain
4 Cacophony Scamp
4 Sawblade Scamp
2 Akki Scrapchomper`}},
      scene: [q('stage', 'Ixalan greeted Phyrexia with a defiant roar.'),
        q('stage', 'Her warning raced through the roots and rivers of Ixalan: prepare for war.'),
        s('planes', 'Battles: an invasion is a battle. Attack it and defeat it to flip it, or defend it and keep the invaders out.')],
      villainScene: [q('stage', 'Walls built to withstand assaults even from Ikoria\'s apex monsters were quickly deemed tactically irrelevant by Vorinclex\'s forces.'),
        q('stage', 'Popular wisdom says that Phyrexians don\'t feel fear.')],
      cues: {hero: cue('Hold the plane.', 'Defend!', 'They are everywhere...', 'The plane stands.', 'Overrun...', 'Defeat the battle before it flips.'),
        villain: cue('Invade.', 'Charge!', 'The plane resists...', 'Another world falls.', 'Repelled...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Compleated', difficulty: 'Normal', rewardSet: 'one', teaches: ['Proliferate'],
      blurb: 'Elesh Norn\'s cathedral is full of the compleated. The Mirran remnants have to take it back.',
      hero: {who: 'mirran', deck: {label: 'tribute', name: 'The Mirran Remnants', colors: 'WU', list: `
4 Gold-Forged Thopteryx
4 Marshal of Zhalfir
4 Malcator, Purity Overseer
3 Cephalopod Sentry
4 Incisor Glider
3 Attentive Skywarden
3 Archangel Elspeth
2 Negate
3 Jace, the Perfected Mind
2 Stasis Field
4 Seachrome Coast
10 Plains
10 Island
4 Porcelain Zealot`}},
      villain: {who: 'compleated', deck: {label: 'tribute', name: 'The Compleated', colors: 'WB', list: `
4 Infested Fleshcutter
4 Mandible Justiciar
4 Orthodoxy Enforcer
4 Ayara's Oathsworn
1 Compleated Huntmaster
1 Phyrexian Obliterator
1 Drana and Linvala
2 Sheoldred's Edict
3 Ossification
3 Vraska's Fall
4 Scoured Barrens
10 Plains
10 Swamp
4 Skrelv, Defector Mite
3 Swooping Lookout
2 Kor Halberd`}},
      scene: [q('stage', 'The Phyrexian\'s monuments of today will be nothing but dust tomorrow. With enough tomorrows, so will their rule.'),
        q('stage', 'Silent observers swim through the air of Norn\'s Seedcore, watching the nascent Invasion Tree for any signs of interference.'),
        s('mirran', 'Proliferate: add one more counter of each kind already on a permanent or player. Use it on your own growing things.')],
      villainScene: [q('stage', 'Hear only harmony. See only glory. Speak only truth.'),
        q('stage', 'Drown, so you may breathe again.')],
      cues: {hero: cue('Take it back.', 'Proliferate!', 'The cathedral holds...', 'The cathedral is ours.', 'Compleated...', 'Add counters to what you already grow.'),
        villain: cue('Harmony.', 'Be one!', 'The chorus falters...', 'All are one.', 'Silence...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Incubate', difficulty: 'Normal', rewardSet: 'one', teaches: ['Incubate'],
      blurb: 'Wrenn and the roots of the Realmbreaker. The Phyrexian factories keep making new things.',
      hero: {who: 'wrenn', deck: {label: 'tribute', name: 'Wrenn and the Roots', colors: 'G', list: `
4 Wary Thespian
4 Portent Tracker
4 Streetwise Negotiator
3 Wrenn and Realmbreaker
3 Overgrown Pest
4 Serpent-Blade Assailant
4 Tandem Takedown
3 Timberland Ancient
3 Titanic Growth
24 Forest
4 Branchblight Stalker`}},
      villain: {who: 'roots', deck: {label: 'tribute', name: 'The Invasion Roots', colors: 'BG', list: `
4 Bilious Skulldweller
4 Pestilent Syphoner
3 Karumonix, the Rat King
4 Cutthroat Centurion
3 Necrosquito
3 Ravenous Necrotitan
3 Glissa Sunslayer
4 Drown in Ichor
3 Vraska's Fall
3 Plague Nurse
2 Infectious Bite
4 Jungle Hollow
10 Swamp
10 Forest`}},
      scene: [q('stage', 'This was once a peaceful spring, but I wouldn\'t advise taking a sip.'),
        q('stage', 'Best we move on. That gurgling means it\'s feeding time.'),
        s('wrenn', 'Incubate: make an Incubator token with a number of counters, and pay later to turn it into a Phyrexian creature.')],
      villainScene: [q('stage', 'This one needs a bit longer to ripen.'),
        q('stage', 'Urabrask doesn\'t think big enough.')],
      cues: {hero: cue('Roots hold.', 'Grow!', 'The factories are ahead...', 'The roots are cut.', 'Overgrown...', 'Spend the incubator before they overwhelm you.'),
        villain: cue('Ripen.', 'Emerge!', 'The roots wither...', 'The forest is ours.', 'Cut down...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Grixis vs Mono-White', difficulty: 'Normal', rewardSet: 'one', teaches: ['Card advantage'],
      blurb: 'Spring 2023: a three-colour removal deck against mono-white weenies.',
      hero: {who: 'grixis', deck: {label: 'tribute', name: 'Grixis Midrange', note: 'Blue is dropped for our land pool; this is the black-red core.', colors: 'BR', archetype: 'Midrange', list: `
4 Cutthroat Centurion
2 Blightbelly Rat
4 Archfiend of the Dross
1 Phyrexian Obliterator
4 Stormclaw Rager
3 Charforger
2 Kolaghan Warmonger
4 Volt Charge
4 Drown in Ichor
3 Vraska's Fall
3 Sheoldred's Edict
2 Chandra, Hope's Beacon
4 Blackcleave Cliffs
10 Swamp
10 Mountain`}},
      villain: {who: 'white', deck: {label: 'tribute', name: 'Mono-White', colors: 'W', archetype: 'Aggro', list: `
2 Skrelv, Defector Mite
4 Swooping Lookout
2 Mandible Justiciar
2 Swordsworn Cavalier
2 Porcelain Zealot
1 Archangel Elspeth
4 Ossification
4 Planar Disruption
4 Attentive Skywarden
24 Plains
4 Kor Halberd
3 Zealot's Conviction
4 Progenitor Exarch`}},
      scene: [q('stage', 'There\'s a war brewing between Norn and Urabrask. Exploit the chaos, and we can take them both down for good.'),
        q('stage', 'Congratulations. I am entertained.'),
        s('grixis', 'Trade your removal for their best creatures. Draw extra cards with Phyrexian Arena and win the long game.')],
      villainScene: [q('stage', 'There\'s never a need to change the watch, for the servants of Norn are sleepless.'),
        q('stage', 'There is a single, glorious truth, etched in the hearts of the faithful. Join in unity, or be washed away.')],
      cues: {hero: cue('Patience.', 'Removal!', 'The weenies are fast...', 'Quality wins.', 'Run over...', 'Do not take too much damage early.'),
        villain: cue('Unity.', 'Charge!', 'They have answers...', 'One truth.', 'Washed away...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Rakdos vs Esper Legends', difficulty: 'Normal', rewardSet: 'one', teaches: ['Racing'],
      blurb: 'Spring 2023: Rakdos midrange against a deck full of legends.',
      hero: {who: 'rakdos', deck: {label: 'tribute', name: 'Rakdos Midrange', colors: 'BR', archetype: 'Midrange', list: `
4 Cutthroat Centurion
4 Blightbelly Rat
3 Archfiend of the Dross
1 Phyrexian Obliterator
4 Stormclaw Rager
3 Charforger
1 Rankle and Torbran
4 Kolaghan Warmonger
3 Sheoldred // The True Scriptures
4 Volt Charge
3 Vraska's Fall
2 Sheoldred's Edict
4 Blackcleave Cliffs
10 Swamp
10 Mountain`}},
      villain: {who: 'legends', deck: {label: 'tribute', name: 'Esper Legends', colors: 'WUB', archetype: 'Midrange', list: `
3 Kemba, Kha Enduring
3 Errant and Giada
3 Jirina, Dauntless General
3 Malcator, Purity Overseer
3 Marshal of Zhalfir
3 Drana and Linvala
3 Archangel Elspeth
3 Jace, the Perfected Mind
3 Vraska's Fall
3 Sheoldred's Edict
3 Ossification
4 Scoured Barrens
4 Seachrome Coast
4 Darkslick Shores
4 Plains
4 Island
4 Swamp
3 Norn's Inquisitor`}},
      scene: [q('stage', 'We both serve the Demon Thane. Your parts would better serve with me.'),
        q('stage', 'Live or die, you serve the Steel Thanes now.'),
        s('rakdos', 'Pressure their legends with removal and attackers before they stack up.')],
      villainScene: [q('stage', 'May you rejoice in the magnificence of Norn. May your flesh serve perfection.'),
        q('stage', 'Behold your inevitable defeat.')],
      cues: {hero: cue('Fast and sharp.', 'Kill it!', 'Too many legends...', 'The legends fall.', 'Outclassed...', 'Race them before the legends stack up.'),
        villain: cue('A legend arrives.', 'Legendary!', 'Out of legends...', 'The legends stand.', 'Toppled...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Elesh Norn, Mother of Machines', difficulty: 'Hard', rewardSet: 'mom', teaches: ['Racing'],
      blurb: 'Every plane stands against the Mother of Machines. Her creatures only have to be on the battlefield.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'Every Plane United', colors: 'GW', list: `
3 Archangel Elspeth
3 Calix, Guided by Fate
3 Danitha, New Benalia's Light
3 Sigarda, Font of Blessings
3 Wrenn and Realmbreaker
4 Wary Thespian
4 Kami of Whispered Hopes
4 Zhalfirin Lancer
3 Knight-Errant of Eos
3 Sunfall
3 Titanic Growth
4 Razorverge Thicket
10 Forest
10 Plains`}},
      villain: {who: 'norn', deck: {label: 'tribute', name: 'The Mother of Machines', colors: 'WB', list: `
3 Elesh Norn, Mother of Machines
4 Mandible Justiciar
4 Porcelain Zealot
4 Infested Fleshcutter
3 Drana and Linvala
3 Archpriest of Shadows
4 Ossification
3 Sheoldred's Edict
2 Sunfall
3 Vraska's Fall
3 Orthodoxy Enforcer
4 Scoured Barrens
10 Plains
10 Swamp`}},
      scene: [q('stage', 'Perhaps this will show the Orthodoxy what we think of their attempts at indoctrination.'),
        q('stage', 'Elspeth shone like a sixth sun, inspiring hope in the Mirrans and terror in New Phyrexia.'),
        s('elspeth', 'Her army comes cheap. Hold the line, then clear the board with Sunfall.')],
      villainScene: [q('stage', 'Be not afraid of the holy chorus. Join in rapturous harmony.'),
        q('stage', 'Only Elesh Norn\'s most loyal servants are granted the honor of becoming part of her throne.')],
      cues: {hero: cue('For every plane!', 'Together!', 'Her chorus is loud...', 'The Multiverse stands.', 'Compleated...', 'Clear the board before she overwhelms you.'),
        villain: {...cue('Unity.', '[a rising chorus]', '[a pause in the chorus]', 'All worlds will know perfection.', '[the chorus breaks]'),
          half: {who: 'resistance', line: 'We are still standing, Norn.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Four-Colour Atraxa', difficulty: 'Hard', rewardSet: 'one', rewardCard: 'Atraxa, Grand Unifier', mood: 'boss',
      teaches: ['Card advantage'],
      archive: {deck: 'Four-Colour Atraxa', when: 'Spring 2023', format: 'Standard.',
        what: 'A four-colour deck of mana rocks and mana creatures that lands Atraxa, Grand Unifier by turn five.',
        why: 'Atraxa drew a pile of cards from nothing and the deck had answers to everything else.',
        beat: 'Kill the mana creatures early and keep a removal spell ready for Atraxa herself.',
        after: 'Rotation took the deck apart, but Atraxa kept turning up in other decks.'},
      blurb: 'Deep in the archive, a four-colour deck that wins on turn five or not at all.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Mono-White', colors: 'W', archetype: 'Aggro', list: `
2 Skrelv, Defector Mite
4 Swooping Lookout
2 Mandible Justiciar
2 Swordsworn Cavalier
2 Porcelain Zealot
1 Archangel Elspeth
4 Ossification
4 Planar Disruption
4 Attentive Skywarden
24 Plains
4 Kor Halberd
3 Zealot's Conviction
4 Progenitor Exarch`}},
      villain: {who: 'atraxa', deck: {label: 'tribute', name: 'Four-Colour Atraxa', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'BGUW', archetype: 'Ramp', list: `
3 Atraxa, Grand Unifier
4 Phyrexian Atlas
4 Deeproot Wayfinder
4 Portent Tracker
3 Wrenn and Realmbreaker
3 Glissa Sunslayer
3 Archangel Elspeth
3 Vraska's Fall
3 Drown in Ichor
2 Sheoldred's Edict
3 Jungle Hollow
3 Thornwood Falls
3 Dismal Backwater
3 Scoured Barrens
3 Blossoming Sands
3 Tranquil Cove
2 Swamp
2 Forest
1 Island
1 Plains
4 Skittering Surveyor`}},
      scene: [q('stage', 'The five suns may have dimmed, but their light still guides us.'),
        s('you', 'Go under them. Kill the mana creatures and hit before turn five.')],
      villainScene: [q('stage', 'Fallen angels should stay fallen.')],
      cues: {hero: cue('Hit first.', 'Charge!', 'Atraxa has landed...', 'The angel falls.', 'Out-valued...', 'Kill the mana creatures early.'),
        villain: cue('[a chorus begins]', '[the angel lands]', '[a missed step]', '[perfection]', '[the angel falls]')},
      after: [s('stage', 'Recorded: rotation took the deck apart, but Atraxa kept turning up in other decks.')]},
  ],
};
