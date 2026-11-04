// Act 29: The War of the Spark (Guilds of Ravnica, Ravnica Allegiance, War of the Spark, Core Set 2020). Story and dialogue:
// /mnt/project-files/story/act-29-script.md (generated from this file). Land set: grn.
// Nicol Bolas has lured the planeswalkers to Ravnica to steal their sparks with the Elderspell, backed by the Eternal
// Dreadhorde. The guilds that spent years at each other's throats have to stand together. Every quoted line is real
// flavor text from these four sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'war-of-the-spark',
  era: '2019-05-03',
  intro: [s('stage', 'Ravnica, the city that is a world. The guilds have kept it standing for ten thousand years.'),
    q('stage', 'Dovin ticked the Planeswalkers off on his fingers: himself, Domri, Kaya, Ral, Vraska . . . and Bolas made an even six.'),
    s('stage', 'Nicol Bolas is bringing every planeswalker he can reach to Ravnica. None of them know why yet.')],
  finale: [q('stage', 'To Liliana\'s surprise, the cost of betraying Bolas did not fall on her.'),
    q('stage', 'His triumph came not from victory over his enemies, but from the salvation of those who survived.'),
    s('stage', 'Gideon Jura is gone, Bolas is shut away in the Meditation Realm, and Ugin chose to imprison him rather than finish him.'),
    s('stage', 'Recorded: the war is over. The city is still standing.')],
  villainFinale: [q('stage', 'When you rule by fear, your greatest weakness is one who\'s no longer afraid.'),
    s('stage', 'Bolas keeps every spark he took, and the city belongs to him. The record says Ugin chose to imprison him instead.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Fblthp, the Lost'},
    ral: {name: 'Ral Zarek', title: 'Izzet Guildmaster', card: 'Ral, Storm Conduit', focus: '50% 25%'},
    golgari: {name: 'The Golgari', title: 'Of the Undercity', card: 'Erstwhile Trooper', focus: '50% 30%'},
    vraska: {name: 'Vraska', title: 'Golgari Queen', card: 'Vraska, Golgari Queen', focus: '50% 25%'},
    boros: {name: 'The Boros Legion', title: 'Under Tajic', card: 'Tajic, Legion\'s Edge', focus: '50% 25%'},
    lavinia: {name: 'Lavinia', title: 'Azorius Renegade', card: 'Lavinia, Azorius Renegade', focus: '50% 25%'},
    rakdos: {name: 'The Cult of Rakdos', title: 'Showmen of Ravnica', card: 'Judith, the Scourge Diva', focus: '50% 25%'},
    horde: {name: 'The Dreadhorde', title: 'Bolas\'s Army', card: 'Eternal Taskmaster', focus: '50% 30%'},
    kaya: {name: 'Kaya', title: 'Orzhov Guildmaster', card: 'Kaya, Orzhov Usurper', focus: '50% 25%'},
    eternals: {name: 'The Eternals', title: 'God-Eternals\' Troops', card: 'Naga Eternal', focus: '50% 30%'},
    superfriends: {name: 'Esper Superfriends', title: 'Spring 2019', card: 'Teferi, Time Raveler', focus: '50% 25%'},
    red: {name: 'Mono-Red', title: 'Spring 2019', card: 'Krenko, Tin Street Kingpin', focus: '50% 25%'},
    golgarimid: {name: 'Golgari Midrange', title: 'Spring 2019', card: 'Rotting Regisaur', focus: '50% 30%'},
    gruul: {name: 'The Gruul', title: 'Clans of the Rubblebelt', card: 'Domri, Chaos Bringer', focus: '50% 25%'},
    gatewatch: {name: 'The Gatewatch', title: 'And the Guilds', card: 'Gideon Blackblade', focus: '50% 25%'},
    bolas: {name: 'Nicol Bolas', title: 'Dragon-God', card: 'Nicol Bolas, Dragon-God', focus: '50% 30%'},
    liliana: {name: 'Liliana', title: 'Dreadhorde General', card: 'Liliana, Dreadhorde General', focus: '50% 25%'},
    esperhero: {name: 'Esper Hero', title: 'Spring 2019', card: 'Hero of Precinct One', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Beacon', difficulty: 'Easy', rewardSet: 'grn', teaches: ['Surveil'],
      blurb: 'Ral Zarek is in Ravnica when something goes wrong in the city. The Golgari in the tunnels are in no mood for company.',
      hero: {who: 'ral', deck: {label: 'tribute', name: 'The Izzet League', colors: 'UR', list: `
4 Goblin Electromancer
4 Wee Dragonauts
4 Ral's Staticaster
3 Crackling Drake
3 Murmuring Mystic
4 Shock
2 Lava Coil
3 Beacon Bolt
2 Ral, Izzet Viceroy
3 Hypothesizzle
3 Sonic Assault
4 Izzet Guildgate
3 Steam Vents
8 Island
9 Mountain
1 Anticipate`}},
      villain: {who: 'golgari', deck: {label: 'tribute', name: 'The Golgari Swarm', colors: 'BG', list: `
4 Pelt Collector
4 Erstwhile Trooper
4 Glowspore Shaman
3 Plaguecrafter
3 Midnight Reaper
3 Hitchclaw Recluse
3 Kraul Harpooner
3 Gravedigger
3 Dead Weight
3 Assassin's Trophy
2 Find // Finality
4 Golgari Guildgate
2 Overgrown Tomb
9 Swamp
9 Forest
1 Murder`}},
      scene: [q('stage', 'Dovin ticked the Planeswalkers off on his fingers: himself, Domri, Kaya, Ral, Vraska . . . and Bolas made an even six.'),
        q('stage', 'Rumors float through the city like crows, alighting on citizens seemingly at random.'),
        s('ral', 'Surveil: look at the top cards of your library, then keep each on top or put it in the graveyard. Use it to dig and to fuel your graveyard.')],
      villainScene: [q('stage', 'The Erstwhile—rotten of body and outmoded in dress, but unfailing in loyalty.'),
        q('stage', 'Nearly invisible strands of web reach far beyond its lair to alert it of the approach of prey.')],
      cues: {hero: cue('Something is wrong.', 'Storm conduit!', 'The tunnels are closing in...', 'Back to the surface.', 'Cut off...', 'Surveil early. Bin what you do not need.'),
        villain: cue('Rot and root.', 'Rise!', 'It slips away...', 'The Swarm provides.', 'Cleared out...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Queen of the Swarm', difficulty: 'Easy', rewardSet: 'grn', teaches: ['Mentor'],
      blurb: 'Vraska leads the Golgari. The Boros Legion has marched into the undercity and wants a say.',
      hero: {who: 'vraska', deck: {label: 'tribute', name: 'The Golgari Swarm', colors: 'BG', list: `
4 Pelt Collector
4 Erstwhile Trooper
4 Glowspore Shaman
4 Rotting Regisaur
3 Midnight Reaper
2 Doom Whisperer
2 Kraul Harpooner
2 Vraska, Golgari Queen
4 Assassin's Trophy
3 Murder
2 Find // Finality
2 Gravedigger
4 Golgari Guildgate
3 Overgrown Tomb
8 Swamp
9 Forest`}},
      villain: {who: 'boros', deck: {label: 'tribute', name: 'The Boros Legion', colors: 'RW', list: `
4 Legion Warboss
4 Goblin Banneret
4 Fearless Halberdier
4 Tenth District Guard
4 Skyknight Legionnaire
3 Boros Challenger
3 Swiftblade Vindicator
3 Tajic, Legion's Edge
3 Righteous Blow
2 Shock
2 Justice Strike
4 Boros Guildgate
3 Sacred Foundry
9 Mountain
8 Plains`}},
      scene: [q('stage', 'A power vacuum for the Azorius. A keepsake for Vraska.'),
        q('stage', 'From death she grows living grandeur.'),
        s('vraska', 'Mentor: when this creature attacks, it puts a +1/+1 counter on a smaller attacker. Attack with the young ones beside it.')],
      villainScene: [q('stage', 'The Boros banner stands tall even if its bearer doesn\'t.'),
        q('stage', 'Squadrons of skyknights are available for deployment around the clock, capable of reaching any district in the city within minutes.')],
      cues: {hero: cue('Stand with the Swarm.', 'The queen walks!', 'The Legion is fast...', 'Hold the tunnels.', 'Routed...', 'Attack with the small creatures beside the mentor.'),
        villain: cue('Form up!', 'Charge!', 'Fall back...', 'For the Legion.', 'Broken...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Debts and Ghosts', difficulty: 'Easy', rewardSet: 'rna', teaches: ['Afterlife'],
      blurb: 'Lavinia is a hunter of rogues and the Rakdos cult is putting on a show at the worst possible time.',
      hero: {who: 'lavinia', deck: {label: 'tribute', name: 'The Azorius Senate', colors: 'WU', list: `
4 Tithe Taker
4 Ministrant of Obligation
3 Spirit of the Spires
3 Lavinia, Azorius Renegade
4 Empyrean Eagle
3 Deputy of Detention
3 Azorius Skyguard
2 Sphinx of New Prahv
2 Teferi, Time Raveler
3 Dovin's Dismissal
3 Pacifism
2 Dovin, Grand Arbiter
4 Azorius Guildgate
3 Hallowed Fountain
9 Plains
8 Island`}},
      villain: {who: 'rakdos', deck: {label: 'tribute', name: 'The Cult of Rakdos', colors: 'BR', list: `
4 Rakdos Roustabout
4 Gutterbones
4 Hackrobat
3 Mayhem Devil
3 Dreadhorde Butcher
3 Rafter Demon
2 Judith, the Scourge Diva
3 Rakdos Trumpeter
4 Shock
2 Bedevil
2 Disfigure
2 Murder
4 Rakdos Guildgate
3 Blood Crypt
9 Swamp
8 Mountain`}},
      scene: [q('lavinia', 'I told Jace that Ravnica would fall apart if he didn\'t take his responsibilities seriously. I didn\'t want to be right.'),
        q('stage', 'Down here, things don\'t stay dead.'),
        s('lavinia', 'Afterlife: when it dies, you get Spirit tokens. Chump blocks and trades stay worth something.')],
      villainScene: [q('stage', 'They all want to see me fall.'),
        q('stage', 'Despite their stake in the city\'s survival, Rakdos cultists are loath to pass up any opportunity to sow chaos.')],
      cues: {hero: cue('By the law.', 'Spirits rise!', 'Too much noise...', 'Order restored.', 'The show wins...', 'Let your afterlife creatures trade.'),
        villain: cue('Entertain me!', 'Encore!', 'The crowd is leaving...', 'Standing ovation.', 'Curtain...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Dreadhorde Arrives', difficulty: 'Normal', rewardSet: 'war', teaches: ['Amass'],
      blurb: 'Ral meets Bolas\'s army at the walls. The Eternals do not stop.',
      hero: {who: 'ral', deck: {label: 'tribute', name: 'The Izzet Storm', colors: 'UR', list: `
4 Goblin Electromancer
4 Wee Dragonauts
3 Arclight Phoenix
3 Crackling Drake
1 Niv-Mizzet, Parun
3 Ral, Storm Conduit
4 Lightning Stormkin
4 Shock
3 Lava Coil
3 Beacon Bolt
3 Ionize
1 Hypothesizzle
4 Izzet Guildgate
3 Steam Vents
8 Island
9 Mountain`}},
      villain: {who: 'horde', deck: {label: 'tribute', name: 'The Dreadhorde', colors: 'B', list: `
4 Dreadhorde Invasion
4 Eternal Taskmaster
4 Lazotep Reaver
4 Herald of the Dreadhorde
4 Spark Reaper
3 Dreadmalkin
3 Lazotep Behemoth
2 Liliana, Dreadhorde General
2 Massacre Girl
3 Spark Harvest
3 Toll of the Invasion
24 Swamp`}},
      scene: [q('stage', 'Time to find the melting point of lazotep.'),
        q('stage', 'Despite their many forms, the Eternals worked in chilling harmony, unburdened by instinct or emotion.'),
        s('ral', 'Amass: a growing Army token and counters on it. Kill the Army, and every counter goes with it.')],
      villainScene: [q('stage', 'Amonkhet\'s dead flowed into a new world in service to their God-Pharaoh.'),
        q('stage', 'I know they\'re unstoppable fighters created to harvest souls—it\'s just they\'re so rude about it.')],
      cues: {hero: cue('Hold the line!', 'Lightning, now!', 'There are too many...', 'The wall holds.', 'Overrun...', 'Kill the Army token before it grows.'),
        villain: cue('[a slow march]', '[the Army grows]', '[a stall]', '[the dead advance]', '[the dead fall still]')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Kaya Gambit', difficulty: 'Normal', rewardSet: 'war', teaches: ['Planeswalkers'],
      blurb: 'Kaya has more than one reason to fight. The Eternals pour over Ravnica in waves.',
      hero: {who: 'kaya', deck: {label: 'tribute', name: 'The Orzhov Syndicate', colors: 'WB', list: `
4 Tithe Taker
4 Ministrant of Obligation
3 Imperious Oligarch
2 Teysa Karlov
3 Pitiless Pontiff
3 Seraph of the Scales
2 Kaya, Orzhov Usurper
1 Kaya, Bane of the Dead
3 Cruel Celebrant
4 Mortify
3 Despark
2 Final Payment
2 Pacifism
4 Orzhov Guildgate
3 Godless Shrine
9 Plains
8 Swamp`}},
      villain: {who: 'eternals', deck: {label: 'tribute', name: 'The Eternals', colors: 'UB', list: `
4 Aven Eternal
4 Naga Eternal
4 Eternal Taskmaster
3 Lazotep Reaver
3 Eternal Skylord
2 Lazotep Behemoth
2 God-Eternal Kefnet
2 Lazotep Behemoth
3 Dreadhorde Invasion
3 Thought Erasure
3 Tyrant's Scorn
3 Murder
4 Dimir Guildgate
3 Watery Grave
9 Swamp
8 Island`}},
      scene: [q('stage', 'Teysa convened the meeting of the Obzedat. Kaya ended it.'),
        q('stage', 'The Eternals found some sparks to be quite slippery.'),
        s('kaya', 'Planeswalkers: they win the game when they stay alive. Protect them with blockers, and attack theirs as soon as they land.')],
      villainScene: [q('stage', 'I recognize that headdress. This one was feared even by her fellow initiates.'),
        q('stage', 'I\'ve never seen the firemane angels so anxious.')],
      cues: {hero: cue('Their debts are mine.', 'Slip away!', 'They are swarming...', 'The Syndicate holds.', 'Spark lost...', 'Guard your walker. Attack theirs.'),
        villain: cue('[silence]', '[an army wakes]', '[the stall]', '[the dead march]', '[the army breaks]')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Esper Superfriends', difficulty: 'Normal', rewardSet: 'm20', teaches: ['Haste'],
      blurb: 'Spring 2019: a pile of planeswalkers against a pile of burn spells.',
      hero: {who: 'superfriends', deck: {label: 'tribute', name: 'Esper Superfriends', colors: 'WUB', archetype: 'Control', list: `
3 Teferi, Time Raveler
1 Narset, Parter of Veils
3 Sorin, Vengeful Bloodlord
2 Kaya, Orzhov Usurper
2 Dovin, Architect of Law
3 Lavinia, Azorius Renegade
3 Seraph of the Scales
4 Pitiless Pontiff
4 Tithe Taker
4 Mortify
2 Despark
2 Absorb
1 Thought Erasure
2 Kaya's Wrath
3 Godless Shrine
3 Hallowed Fountain
3 Watery Grave
2 Orzhov Guildgate
2 Azorius Guildgate
2 Dimir Guildgate
3 Plains
3 Swamp
3 Island`}},
      villain: {who: 'red', deck: {label: 'tribute', name: 'Mono-Red', colors: 'R', archetype: 'Aggro', list: `
4 Runaway Steam-Kin
4 Legion Warboss
4 Fearless Halberdier
4 Goblin Cratermaker
3 Neheb, Dreadhorde Champion
4 Torch Courier
2 Krenko, Tin Street Kingpin
4 Shock
3 Lava Coil
2 Skewer the Critics
2 Light Up the Stage
24 Mountain`}},
      scene: [q('stage', 'The safest place for you is not now.'),
        q('stage', 'By fate or by will, every reign must come to an end.'),
        s('superfriends', 'You are the control deck. Keep your walkers alive and out-grind a pile of burn spells.')],
      villainScene: [q('stage', 'After the people flee, but before the enemy arrives—that\'s grabbin\' time.'),
        q('stage', 'I love this thing! It\'s my best invention since the boulderfist gauntlet!')],
      cues: {hero: cue('Consider the options.', 'Ultimate!', 'The burn keeps coming...', 'Control.', 'Burned out...', 'Do not take too much damage early.'),
        villain: cue('Burn it down!', 'Shock!', 'Out of fuel...', 'Ash.', 'Put out...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Golgari Midrange', difficulty: 'Normal', rewardSet: 'm20', teaches: ['Card advantage'],
      blurb: 'Spring 2019: Golgari midrange against a Gruul rush.',
      hero: {who: 'golgarimid', deck: {label: 'tribute', name: 'Golgari Midrange', colors: 'BG', archetype: 'Midrange', list: `
4 Pelt Collector
4 Rotting Regisaur
3 Midnight Reaper
3 Kraul Harpooner
3 Doom Whisperer
2 Izoni, Thousand-Eyed
2 Storrev, Devkarin Lich
2 Vraska, Golgari Queen
1 Vraska, Swarm's Eminence
3 Assassin's Trophy
2 Murder
3 Find // Finality
1 Casualties of War
4 Golgari Guildgate
3 Overgrown Tomb
2 Temple of Malady
7 Swamp
8 Forest
2 Plaguecrafter
1 Dead Weight`}},
      villain: {who: 'gruul', deck: {label: 'tribute', name: 'The Gruul Clans', colors: 'RG', archetype: 'Aggro', list: `
4 Zhur-Taa Goblin
4 Gruul Spellbreaker
4 Rubblebelt Rioters
3 Frenzied Arynx
3 Domri's Nodorog
3 Ravager Wurm
3 Domri, Chaos Bringer
3 Domri's Ambush
3 Savage Smash
3 Thrash // Threat
3 Shock
4 Gruul Guildgate
3 Stomping Ground
8 Mountain
9 Forest`}},
      scene: [q('stage', 'Now, *that\'s* a zombie!'),
        q('stage', 'In times of war, only death flourishes.'),
        s('golgarimid', 'Trade removal for their best creature every time, and win the long game with better cards.')],
      villainScene: [q('stage', 'If the system is broken, break the system.'),
        q('stage', 'A Gruul berserker is never unarmed.')],
      cues: {hero: cue('Slow and steady.', 'Rot!', 'They are smashing everything...', 'The deck outlasts them.', 'Smashed...', 'Spend removal on their best creature.'),
        villain: cue('Smash!', 'Break it all!', 'Out of rage...', 'The Rubblebelt wins.', 'Broken...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Dragon-God', difficulty: 'Hard', rewardSet: 'war', teaches: ['Racing'],
      blurb: 'The Gatewatch and the guilds take on Nicol Bolas, who has taken their sparks and wants the city.',
      hero: {who: 'gatewatch', deck: {label: 'tribute', name: 'The Gatewatch and the Guilds', colors: 'RGW', list: `
3 Gideon Blackblade
3 Domri, Anarch of Bolas
2 Nissa, Who Shakes the World
2 Chandra, Awakened Inferno
2 Sarkhan the Masterless
3 Knight of Autumn
3 Boros Challenger
3 Skyknight Legionnaire
2 Aurelia, Exemplar of Justice
2 Tajic, Legion's Edge
1 Huatli's Raptor
3 Lava Coil
2 Justice Strike
2 Domri's Ambush
3 Chance for Glory
3 Sacred Foundry
3 Temple Garden
3 Stomping Ground
2 Boros Guildgate
2 Gruul Guildgate
2 Selesnya Guildgate
3 Mountain
3 Forest
3 Plains`}},
      villain: {who: 'bolas', deck: {label: 'tribute', name: 'Bolas\'s Dreadhorde', colors: 'UBR', list: `
4 Nicol Bolas, Dragon-God
4 Dreadhorde Invasion
4 Eternal Taskmaster
3 Lazotep Reaver
2 Aven Eternal
3 Spark Reaper
2 Dreadmalkin
2 God-Eternal Kefnet
3 Ob Nixilis, the Hate-Twisted
2 Liliana, Dreadhorde General
2 Thought Erasure
4 Murder
1 Spark Harvest
3 Dimir Guildgate
3 Watery Grave
3 Blood Crypt
2 Rakdos Guildgate
5 Swamp
6 Island
2 Mountain`}},
      scene: [q('stage', 'Break their formation! Thin their ranks! I\'m right behind you!'),
        q('stage', 'For the Legion! For Ravnica!'),
        q('stage', 'You once brought havoc to my home and ruined my mind. I\'m here to return the favor, Bolas.'),
        s('gatewatch', 'Bolas has more power than any of you. Win together, or not at all.')],
      villainScene: [q('stage', 'The sky boiled over the citadel, dire and dark. Then the angels brought the dawn.'),
        q('stage', 'Ugin saw the gem that connected Bolas to his Meditation Realm as the key to his brother\'s downfall.')],
      cues: {hero: cue('For Ravnica!', 'Together!', 'He is too strong...', 'The war is won.', 'The city falls...', 'Race Bolas before he steals another spark.'),
        villain: {...cue('Kneel.', '[the sky darkens]', '[a flicker of doubt]', 'The city is mine.', '[the dragon is quiet]'),
          half: {who: 'liliana', line: 'He will not be my master.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Esper Hero', difficulty: 'Hard', rewardSet: 'rna', rewardCard: 'Hero of Precinct One', mood: 'boss',
      teaches: ['Trample'],
      archive: {deck: 'Esper Hero', when: 'Spring 2019', format: 'Standard.',
        what: 'A white-based aggro-control deck that used Hero of Precinct One, cheap creatures, and Teferi, Time Raveler to protect its board.',
        why: 'Cheap threats, Teferi\'s protection, and a few flexible removal spells made it hard to play around in a field of midrange decks.',
        beat: 'Kill the cheap threats early, keep a planeswalker from sticking, and pressure it before its fliers arrive.',
        after: 'Core Set 2020 and Throne of Eldraine followed later in 2019 and changed the format again.'},
      blurb: 'Deep in the archive, a quiet pile of cheap threats and a planeswalker who will not be countered.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'The Gruul Clans', colors: 'RG', archetype: 'Aggro', list: `
4 Zhur-Taa Goblin
4 Gruul Spellbreaker
4 Rubblebelt Rioters
3 Frenzied Arynx
3 Domri's Nodorog
3 Ravager Wurm
3 Domri, Chaos Bringer
3 Domri's Ambush
3 Savage Smash
3 Thrash // Threat
3 Shock
4 Gruul Guildgate
3 Stomping Ground
8 Mountain
9 Forest`}},
      villain: {who: 'esperhero', deck: {label: 'tribute', name: 'Esper Hero', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'WUB', archetype: 'Aggro', list: `
4 Hero of Precinct One
4 Tithe Taker
3 Lavinia, Azorius Renegade
3 Deputy of Detention
3 Seraph of the Scales
2 Etrata, the Silencer
3 Teferi, Time Raveler
2 Kaya, Orzhov Usurper
2 Dovin, Architect of Law
4 Mortify
3 Despark
3 Dovin's Dismissal
3 Godless Shrine
3 Hallowed Fountain
2 Watery Grave
2 Orzhov Guildgate
2 Azorius Guildgate
1 Dimir Guildgate
5 Plains
3 Swamp
3 Island`}},
      scene: [q('stage', 'When the established order falters, what remains are ordinary people and their struggle to survive.'),
        s('you', 'Burn their cheap creatures, then smash through before Teferi settles in.')],
      villainScene: [q('stage', 'I keep reminding myself we do this because others can\'t, because we love this city. If we don\'t save it, no one will.')],
      cues: {hero: cue('Smash first.', 'Break it!', 'They are too clean...', 'Hero down.', 'Out-built...', 'Pressure before Teferi lands.'),
        villain: cue('[a quiet spell]', '[a hero rises]', '[a counter fizzles]', '[stillness]', '[the board clears]')},
      after: [s('stage', 'Recorded: Core Set 2020 and Throne of Eldraine followed later in 2019 and changed the format again.')]},
  ],
};
