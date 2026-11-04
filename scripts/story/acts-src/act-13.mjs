// Act 13: The Guildpact (Ravnica: City of Guilds, Guildpact, Dissension). Story and dialogue:
// /mnt/project-files/story/act-13-script.md (generated from this file). Land set: rav.
// Ten guilds share one city under a contract ten thousand years old. The Dimir, the guild nobody believes in, want it
// broken. Agrus Kos, the last honest Wojek, chases them in life and after it. Every quoted line is real flavor text from
// Ravnica, Guildpact or Dissension; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'ten-guild-city',
  era: '2006-05-20',
  intro: [s('stage', 'Ravnica: one city that covers a whole world. Ten guilds run it, and ten thousand years ago they signed a contract to share it.'),
    q('stage', 'Built on the very ground where the Ten signed the Guildpact, the tower is a monument to the past and a reminder of who holds power in the present.'),
    s('stage', 'Nine guilds are famous. The tenth, House Dimir, is a story parents tell. Nobody has ever seen its master.'),
    q('szadek', 'In secrecy is strength. None can oppose one who cannot be found.')],
  finale: [s('stage', 'Szadek falls in the dark under the city, and House Dimir is a rumour again.'),
    s('kos', 'Ten thousand years of contract, and it took a ghost to read the small print.'),
    s('teysa', 'The Decamillennial is days away. The Guildpact is fraying anyway. Szadek only pulled the first thread.'),
    q('stage', 'Everyone knows that violence at the Festival brings the worst of luck, so for at least one day a year arms are laid down in favor of brimming goblets.'),
    s('stage', 'On the ten-thousandth anniversary, the Guildpact breaks. The ten guilds are free, and every one of them remembers a grudge.')],
  villainFinale: [s('stage', 'The ghost of Agrus Kos fades into the stone. Teysa\'s contracts burn.'),
    q('szadek', 'Your ignorance is my bliss.'),
    q('szadek', 'I am confident that if anyone actually penetrates our facades, even the most perceptive would still be fundamentally unprepared for the truth of House Dimir.'),
    s('stage', 'On the Decamillennial, the Guildpact breaks. Nine guilds go to war. The tenth watches, and takes its share, one coin purse at a time.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', fixed: fixed('Fold into Aether', '5dn', '31', '615157d6-0160-417b-b06c-0e253b306c37', 'Anthony S. Waters & Cara Mitten')},
    tolsimir: {name: 'Tolsimir', title: 'Wolfblood, Selesnya', card: 'Tolsimir Wolfblood', number: '236', focus: '50% 25%'},
    rakdos: {name: 'The Rakdos', title: 'Cult of the Defiler', card: 'Rakdos Guildmage', focus: '50% 25%'},
    savra: {name: 'Savra', title: 'Queen of the Golgari', card: 'Savra, Queen of the Golgari', number: '225', focus: '50% 25%'},
    izzet: {name: 'The Izzet', title: 'League of Weirds', card: 'Steamcore Weird', focus: '50% 30%'},
    razia: {name: 'Razia', title: 'Boros Archangel', card: 'Razia, Boros Archangel', number: '223', focus: '50% 25%'},
    gruul: {name: 'Borborygmos', title: 'Gruul Clans', card: 'Borborygmos', number: '103', focus: '50% 25%'},
    kos: {name: 'Agrus Kos', title: 'Wojek Veteran', card: 'Agrus Kos, Wojek Veteran', number: '190', focus: '50% 25%'},
    dimir: {name: 'The Dimir Agents', title: 'House Dimir', card: 'Dimir Infiltrator', focus: '50% 30%'},
    teysa: {name: 'Teysa', title: 'Orzhov Scion', card: 'Teysa, Orzhov Scion', number: '134', focus: '50% 25%'},
    augustin: {name: 'Augustin IV', title: 'Grand Arbiter of the Azorius', card: 'Grand Arbiter Augustin IV', number: '112', focus: '50% 25%'},
    zoo: {name: 'Zoo', title: 'Spring 2006', card: 'Watchwolf', number: '239', focus: '50% 30%'},
    momir: {name: 'Momir Vig', title: 'Simic Visionary', card: 'Momir Vig, Simic Visionary', number: '118', focus: '50% 25%'},
    niv: {name: 'Niv-Mizzet', title: 'The Firemind', card: 'Niv-Mizzet, the Firemind', number: '123', focus: '50% 25%'},
    szadek: {name: 'Szadek', title: 'Lord of Secrets', card: 'Szadek, Lord of Secrets', number: '234', focus: '50% 25%'},
    flare: {name: 'Solar Flare', title: '2006 Standard', card: 'Zombify', focus: '50% 35%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Festival of the Guildpact', difficulty: 'Easy', rewardSet: 'rav', teaches: ['Convoke'],
      blurb: 'Once a year the guilds lay down their arms for the Festival of the Guildpact. This year a Rakdos cult has come to the party anyway, and the Selesnya Conclave stands in its way.',
      hero: {who: 'tolsimir', deck: {label: 'tribute', name: 'The Conclave', colors: 'GW', list: `
4 Selesnya Evangel
4 Watchwolf
4 Votary of the Conclave
4 Selesnya Guildmage
4 Centaur Safeguard
4 Conclave Equenaut
4 Scatter the Seeds
2 Gather Courage
2 Selesnya Sagittars
2 Conclave Phalanx
12 Forest
12 Plains
2 Tolsimir Wolfblood`}},
      villain: {who: 'rakdos', deck: {label: 'tribute', name: 'Rakdos Cultists', colors: 'BR', list: `
4 Gobhobbler Rats
4 Rakdos Guildmage
4 Crypt Champion
4 Hellhole Rats
4 Rakdos Ickspitter
4 Sadistic Augermage
4 Demon's Jester
4 Frenzied Goblin
4 Gnat Alley Creeper
12 Swamp
12 Mountain`}},
      scene: [q('stage', 'The clamor of the city drowns all voices. But together we can sing a harmony that will resonate from Ravnica\'s tallest spires to her deepest wells.'),
        s('tolsimir', 'Convoke: tap your creatures to help pay for a convoke spell. Each one pays one mana of its colour, or one generic.'),
        q('stage', 'The symbol of the Conclave is one of unity, with tree supporting sun and sun feeding tree.')],
      villainScene: [q('stage', 'A Rakdos party is a flop if anyone lives to talk about it.'),
        q('rakdos', 'Great minds bleed alike.')],
      cues: {hero: cue('Sing with us.', 'Together!', 'The song is breaking...', 'Peace returns to the Festival.', 'The harmony... falls silent...', 'Tap them all.'),
        villain: cue('Let\'s get this party started!', 'Blood for the Defiler!', 'Party\'s over...', 'Encore!', 'Nobody... talks...')},
      after: [s('tolsimir', 'They came for blood on the one day nobody fights. Something is wrong with the city.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Undercity', difficulty: 'Easy', rewardSet: 'rav', teaches: ['Dredge'],
      blurb: 'Under Ravnica\'s streets, the Golgari farm the rot. Their queen Savra has caught Izzet surveyors poking at her gardens with their weird machines.',
      hero: {who: 'savra', deck: {label: 'tribute', name: 'Golgari Rot Farm', colors: 'BG', list: `
4 Elves of Deep Shadow
4 Golgari Thug
4 Shambling Shell
4 Stinkweed Imp
2 Woodwraith Strangler
4 Golgari Rotwurm
4 Life from the Loam
4 Darkblast
1 Golgari Grave-Troll
3 Putrefy
12 Swamp
12 Forest
2 Savra, Queen of the Golgari`}},
      villain: {who: 'izzet', deck: {label: 'tribute', name: 'Izzet Weirds', colors: 'UR', list: `
4 Steamcore Weird
4 Izzet Guildmage
4 Lore Broker
4 Wild Cantor
4 Gelectrode
4 Drake Familiar
4 Sparkmage Apprentice
4 Grayscaled Gharial
14 Island
14 Mountain`}},
      scene: [q('savra', 'Nature\'s most raw beauty is the circle: perfect in its continuance, with no break between death and life.'),
        s('savra', 'Dredge: instead of drawing, mill that many cards and return the dredge card from your graveyard to your hand. The dead come back to work.'),
        q('stage', 'The Golgari don\'t bury their dead. They plant them.')],
      villainScene: [q('stage', 'Like many Izzet creations, weirds are based on wild contradictions yet somehow manage to work.'),
        q('izzet', 'Diametrically opposing energies in self-sealed plasmodermic bubbles make great pets!')],
      cues: {hero: cue('Welcome to the undercity.', 'Rise and serve.', 'The garden withers...', 'Back to the soil with you.', 'The circle... breaks...', 'Dig it back up.'),
        villain: cue('Fascinating rot!', 'Overload the boilers!', 'Contents under pressure...', 'Data collected!', 'Experiment... failed...')},
      after: [q('savra', 'When something dies, all things benefit. Well okay, just our things.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Legion\'s Justice', difficulty: 'Easy', rewardSet: 'rav', teaches: ['Bloodthirst'],
      blurb: 'Razia\'s Boros Legion keeps the peace with fire and steel. The Gruul clans want no peace at all, and Borborygmos has sent his raiders into the city to prove it.',
      hero: {who: 'razia', deck: {label: 'tribute', name: 'The Boros Legion', colors: 'RW', list: `
4 Boros Recruit
4 Boros Swiftblade
4 Skyknight Legionnaire
4 Thundersong Trumpeter
4 Sunhome Enforcer
4 Lightning Helix
4 Flame-Kin Zealot
4 Nightguard Patrol
4 Galvanic Arc
12 Mountain
12 Plains`}},
      villain: {who: 'gruul', deck: {label: 'tribute', name: 'Gruul Raiders', colors: 'RG', list: `
4 Scab-Clan Mauler
4 Gruul Guildmage
4 Ghor-Clan Bloodscale
4 Gruul Scrapper
2 Tin Street Hooligan
4 Streetbreaker Wurm
4 Bloodscale Prowler
4 Sell-Sword Brute
4 Ghor-Clan Savage
12 Mountain
12 Forest
2 Borborygmos`}},
      scene: [q('razia', 'I do not know which gives me more pride: the legions of soldiers marching in thunderous lockstep, or the cry of the skyknights riding their rocs like jagged lightning overhead.'),
        s('razia', 'Bloodthirst: these Gruul creatures enter bigger if you were dealt damage this turn. Block their first hit, and the rest arrive small.'),
        q('stage', 'Though less well-known than its army of soldiers, the Boros Legion\'s mage-priests are as respected by the innocent as they are hated by the ghosts of the guilty.')],
      villainScene: [q('gruul', 'Crush them!'),
        q('stage', 'The Gruul aren\'t satisfied with just smashing things. They continue smashing other things with the things they just smashed.')],
      cues: {hero: cue('For the Legion!', 'Justice, now!', 'Hold the line...', 'Order is restored.', 'The banner... falls...', 'Block the first hit.'),
        villain: cue('WE EAT!', 'CRUSH THEM!', 'Too many shinies...', 'Smash! More smash!', 'Run to the rubble!')},
      after: [s('razia', 'The Gruul did not plan this raid. Someone told them where our patrols would not be.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Last Honest Cop', difficulty: 'Normal', rewardSet: 'rav', teaches: ['Transmute'],
      blurb: 'Lieutenant Agrus Kos of the Wojek has thirty years on the force and a body nobody can explain. Every clue points to a guild that is supposed to be a myth.',
      hero: {who: 'kos', deck: {label: 'tribute', name: 'Wojek Patrol', colors: 'RW', list: `
2 Agrus Kos, Wojek Veteran
4 Boros Guildmage
4 Boros Swiftblade
4 Veteran Armorer
4 Ordruun Commando
4 Sunhome Enforcer
4 Skyknight Legionnaire
4 Lightning Helix
4 Screeching Griffin
2 Galvanic Arc
12 Mountain
12 Plains`}},
      villain: {who: 'dimir', deck: {label: 'tribute', name: 'Agents of House Dimir', colors: 'UB', list: `
4 Dimir Infiltrator
4 Dimir House Guard
4 Lurking Informant
4 Dimir Guildmage
4 Moroii
4 Roofstalker Wight
4 Muddle the Mixture
4 Last Gasp
4 Clutch of the Undercity
12 Island
12 Swamp`}},
      scene: [q('stage', 'Lieutenant Kos has never met a group of recruits he could not inspire or a mob he could not quell.'),
        q('kos', 'We thought we found the victim\'s clothes lumped in the street. As it turned out, it was the victim, insides sucked out—just a sack of skin and robes.'),
        s('kos', 'Transmute: the Dimir pay mana and discard a transmute card to find any card with the same cost. They always have the right tool. Pressure them before they find it.'),
        q('kos', 'The first blow is the most important. It often negates the need for a second.')],
      villainScene: [q('stage', 'Dimir rank and file never see nor hear their guildmaster. All orders are given through mysterious necrosages who appear from the shadows, tersely toss out a command, and then melt into the darkness.'),
        q('stage', 'In the undercity, forgetfulness is often encouraged at the point of a blade.')],
      cues: {hero: cue('Wojek. You\'re under arrest.', 'First blow!', 'They\'re everywhere and nowhere...', 'Case closed. For now.', 'Thirty years... for this...', 'Hit them before they find it.'),
        villain: cue('[a whisper from the shadows]', '[the necrosage nods]', '[the agents scatter]', '[forgotten]', '[the trail goes cold]')},
      after: [s('kos', 'Dimir. The guild that isn\'t there. My captain laughed at me.'),
        s('stage', 'Agrus Kos does not live to finish the case. He comes back to finish it anyway.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Dead Bankers', difficulty: 'Normal', rewardSet: 'gpt', teaches: ['Haunt', 'Forecast'],
      blurb: 'Teysa Karlov is an Orzhov advokist: a lawyer for a church run by ghosts. Grand Arbiter Augustin IV of the Azorius has a writ against her family, and he intends to serve it.',
      hero: {who: 'teysa', deck: {label: 'tribute', name: 'The Church of Deals', colors: 'WB', list: `
2 Teysa, Orzhov Scion
4 Orzhov Guildmage
4 Blind Hunter
4 Shrieking Grotesque
4 Absolver Thrull
4 Mourning Thrull
4 Belfry Spirit
4 Orzhov Euthanist
4 Ostiary Thrull
2 Mortify
12 Plains
12 Swamp`}},
      villain: {who: 'augustin', deck: {label: 'tribute', name: 'The Azorius Senate', colors: 'WU', list: `
2 Grand Arbiter Augustin IV
4 Azorius First-Wing
4 Azorius Guildmage
4 Vedalken Entrancer
4 Azorius Herald
2 Sky Hussar
2 Beacon Hawk
4 Soulsworn Jury
2 Pride of the Clouds
2 Lionheart Maverick
4 Plumes of Peace
2 Minister of Impediments
12 Plains
12 Island`}},
      scene: [q('teysa', 'Piece the tragic notes together and is it not a melody?'),
        s('teysa', 'Haunt: when a haunt creature dies, exile it haunting another creature. When that creature dies, the effect happens again. In Orzhova, even the dead pay twice.'),
        q('stage', 'Unlike most churches, at Orzhova it\'s best to pray before you arrive.')],
      villainScene: [q('augustin', 'As peace should be—gentle yet unstoppable.'),
        s('augustin', 'Forecast: during my upkeep I reveal a forecast card from my hand and use its effect, and the card stays in my hand for next time.'),
        q('stage', 'Azorius military tactics, like their legal tactics, capitalize on delay and nullification.')],
      cues: {hero: cue('Let\'s discuss terms.', 'Collect.', 'The ledger is red...', 'Paid in full.', 'Foreclosed...', 'Even the dead pay twice.'),
        villain: cue('The Senate is in session.', 'Writ served.', 'Objection...', 'Judgment rendered.', 'The case... is dismissed...')},
      after: [s('teysa', 'The Arbiter was not after my family. He was after a name in our ledgers. A name with no guild.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Ghost Dad', difficulty: 'Normal', rewardSet: 'gpt', teaches: ['Gaining life'],
      blurb: 'In the real spring of 2006, the Ghost Council of Orzhova anchored a black-white deck players called Ghost Dad. Its worst matchup on paper was Zoo: three colours of cheap beasts and burn.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Ghost Dad', colors: 'WB', archetype: 'Orzhov midrange', list: `
4 Orzhov Euthanist
4 Ghost Council of Orzhova
4 Shrieking Grotesque
4 Blind Hunter
4 Pillory of the Sleepless
4 Mortify
4 Last Gasp
4 Orzhov Guildmage
4 Absolver Thrull
4 Godless Shrine
4 Orzhov Basilica
8 Plains
8 Swamp`}},
      villain: {who: 'zoo', deck: {label: 'tribute', name: 'Zoo', colors: 'RGW', archetype: 'Aggro', list: `
4 Watchwolf
4 Scab-Clan Mauler
4 Savannah Lions
4 Burning-Tree Shaman
4 Lightning Helix
4 Char
4 Shock
4 Skyknight Legionnaire
4 Giant Growth
4 Sacred Foundry
4 Stomping Ground
4 Temple Garden
4 Karplusan Forest
4 Mountain
2 Forest
2 Plains`}},
      scene: [q('stage', 'The Golgari raise the bodies of their dead to serve. We raise the spirits of our dead to lead.'),
        s('you', 'Ghost Council drains them and feeds me. Every blocker I trade buys time for the next drain.'),
        q('stage', 'Orzhov churches don\'t pass the plate for collection. They charge for admission.')],
      villainScene: [q('stage', 'At mealtimes, the Gruul customarily omit such niceties as using forks or killing the entrée.'),
        s('zoo', '[three colours of teeth]')],
      cues: {hero: cue('The Council will see you now.', 'Drain them.', 'Too fast, too many...', 'Paid in full.', 'The ghosts... go quiet...', 'Trade, then drain.'),
        villain: cue('[howling]', '[the pack charges]', '[the pack thins]', '[feeding]', '[scattered]')}},
    {slot: 7, mood: 'tension', kind: 'Rival', title: 'Project Kraj', difficulty: 'Normal', rewardSet: 'dis', teaches: ['Graft'],
      blurb: 'Momir Vig\'s Simic Combine grows creatures that pass their strength to each other. Niv-Mizzet, the dragon who runs the Izzet, thinks the Simic stole his research. Both are probably right.',
      hero: {who: 'momir', deck: {label: 'tribute', name: 'Simic Graft', colors: 'GU', list: `
2 Momir Vig, Simic Visionary
4 Coiling Oracle
4 Plaxcaster Frogling
4 Simic Initiate
4 Trygon Predator
4 Simic Ragworm
4 Sporeback Troll
2 Assault Zeppelid
4 Silkwing Scout
4 Patagia Viper
12 Forest
12 Island`}},
      villain: {who: 'niv', deck: {label: 'tribute', name: 'Izzet Control', colors: 'UR', archetype: 'Control', list: `
2 Niv-Mizzet, the Firemind
4 Izzet Signet
4 Remand
4 Electrolyze
4 Compulsive Research
4 Repeal
4 Izzet Chronarch
4 Mana Leak
4 Steamcore Weird
2 Demonfire
4 Steam Vents
4 Izzet Boilerworks
4 Shivan Reef
6 Island
6 Mountain`}},
      scene: [q('momir', 'The unnatural pressures of life in this city are best withstood by lifeforms that adapt with unnatural swiftness.'),
        s('momir', 'Graft: these creatures enter with +1/+1 counters. When another creature arrives, you may move a counter onto it. Spread the strength where it is needed.'),
        q('momir', 'Of course it will grow beyond control—it was designed to choose its own evolution.')],
      villainScene: [q('niv', '(Z->)90° - (E-N²W)90°t = 1'),
        q('stage', 'Niv-Mizzet\'s genius and vanity reverberate throughout the mirrored halls of Nivix.'),
        q('stage', 'The Izzet learn something from every lesson they teach.')],
      cues: {hero: cue('Adapt.', 'Evolve!', 'The specimens are failing...', 'Natural selection.', 'Back... to the vats...', 'Move the counter.'),
        villain: cue('Begin the demonstration.', 'Ha! Lightning!', 'Recalculating...', 'Proven.', 'My equation... was flawed...')},
      after: [s('momir', 'The dragon kept saying the same thing. The Guildpact is weakening, and someone is helping it along.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Szadek', difficulty: 'Hard', rewardSet: 'dis', teaches: ['Playing around counterspells'],
      blurb: 'Szadek, Lord of Secrets, has run House Dimir from the dark for ten thousand years. Agrus Kos, now a ghost bound to Teysa\'s church, and Teysa herself go under the city to drag him into the light.',
      hero: {who: 'kos', deck: {label: 'tribute', name: 'The Ghost and the Advokist', colors: 'RWB', list: `
2 Agrus Kos, Wojek Veteran
2 Teysa, Orzhov Scion
4 Boros Swiftblade
4 Skyknight Legionnaire
2 Lightning Helix
2 Boros Recruit
2 Mortify
2 Orzhov Euthanist
4 Blind Hunter
4 Orzhov Guildmage
4 Mourning Thrull
4 Absolver Thrull
4 Sacred Foundry
4 Godless Shrine
4 Blood Crypt
4 Plains
4 Mountain
4 Swamp`}},
      villain: {who: 'szadek', deck: {label: 'tribute', name: 'Lord of Secrets', colors: 'UB', archetype: 'Control', list: `
3 Szadek, Lord of Secrets
4 Dimir House Guard
4 Remand
4 Mana Leak
4 Compulsive Research
4 Last Gasp
4 Moroii
4 Keening Banshee
4 Disembowel
1 Tattered Drake
4 Watery Grave
4 Dimir Aqueduct
8 Island
8 Swamp`}},
      scene: [q('stage', 'An emblem of a secret guild, the Dimir insignia is seen only by its own members—and the doomed.'),
        s('kos', 'Being dead has its advantages. He can\'t kill me twice.'),
        s('teysa', 'He counters and he waits. Cast your second-best spell first, and save the one that matters for when his mana is tapped.'),
        q('stage', 'Guilds often exterminate those who saw or knew too much. Some vindictive souls retain their knowledge, using it in the afterlife to crush the guilded and the vile bargain that gives them power.')],
      villainScene: [q('szadek', 'In secrecy is strength. None can oppose one who cannot be found.'),
        q('szadek', 'Some images are so powerful that one glance burns them into your mind forever. Come, let us gaze on nothingness.'),
        s('szadek', 'Ten thousand years I have signed their contract in the dark. I will see it torn.')],
      cues: {hero: cue('Lieutenant Kos. Still on duty.', 'Into the light!', 'He knows every move...', 'Case closed.', 'Even ghosts... forget...', 'Bait the counter.'),
        villain: {...cue('You were never here.', 'Forget.', 'The shadows thin...', 'Your ignorance is my bliss.', 'Seen... at last...'),
          half: {who: 'teysa', line: 'He is spending his counters. Now, Kos. Now.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Solar Flare', difficulty: 'Hard', rewardSet: 'gpt', rewardCard: 'Angel of Despair', mood: 'boss',
      teaches: ['Playing against reanimation'],
      archive: {deck: 'Solar Flare', when: '2006', format: 'Standard: Kamigawa block, Ravnica block and Ninth Edition.',
        what: 'A three-colour control deck that draws cards with Compulsive Research, discards a big Angel, then brings it back with Zombify.',
        why: 'Zombify on turn four put a 5/5 flier that destroys a permanent onto the table long before it could be cast. Wrath of God and Mortify cleaned up the rest.',
        beat: 'Pressure early, before the graveyard fills. Keep a creature back after a Wrath of God, and make them use Zombify on a board you can answer.',
        after: 'Solar Flare stayed a top deck through 2006, picking up Kokusho and later Coldsnap and Time Spiral cards. Nothing in it was ever banned.'},
      blurb: 'Deep in the archive, a deck that turned a graveyard into a turn-four angel.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Boros Deck Wins', colors: 'RW', archetype: 'Aggro', list: `
4 Veteran Armorer
4 Boros Swiftblade
4 Skyknight Legionnaire
4 Lightning Helix
4 Screeching Griffin
4 Shock
4 Thundersong Trumpeter
4 Boros Recruit
4 Flame-Kin Zealot
4 Sacred Foundry
10 Mountain
10 Plains`}},
      villain: {who: 'flare', deck: {label: 'tribute', name: 'Solar Flare', note: 'Built from 2006 Standard Solar Flare lists, using only Ravnica block and Ninth Edition cards. No single tournament list is copied.', colors: 'WUB', archetype: 'Reanimator control', list: `
4 Zombify
4 Compulsive Research
2 Remand
4 Wrath of God
4 Mortify
4 Angel of Despair
4 Skeletal Vampire
2 Orzhov Signet
4 Last Gasp
4 Dimir Signet
4 Godless Shrine
4 Watery Grave
4 Hallowed Fountain
4 Plains
4 Island
4 Swamp`}},
      scene: [s('stage', 'The archive opens on a deck that never wanted to cast its own best cards.'),
        s('you', 'Discard an angel, raise it on turn four. Then I win by turn four.')],
      villainScene: [s('stage', 'The deck does not speak. It digs.')],
      cues: {hero: cue('Race the angel.', 'Burn them out!', 'The angel is up...', 'Too slow to flare.', 'Wings, again...', 'Hit before the graveyard fills.'),
        villain: cue('[draw three]', '[an angel rises]', '[the graveyard is empty]', '[wrath]', '[the flare fades]')},
      after: [s('stage', 'Recorded: never banned. One of the decks that taught a generation to watch the graveyard.')]},
  ],
};
