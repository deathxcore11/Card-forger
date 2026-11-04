// Act 20: The Implicit Maze (Return to Ravnica, Gatecrash, Dragon's Maze, Magic 2014). Story and dialogue:
// /mnt/project-files/story/act-20-script.md (generated from this file). Land set: rtr.
// Ravnica again, ten years on from Act 13. The Guildpact that held the ten guilds together is gone, and Niv-Mizzet has
// found the Implicit Maze, a route through the city that connects landmarks of all ten guilds. Every guild sends a
// runner into it. Jace Beleren has been studying the Maze too, and at its end he becomes the Living Guildpact.
// Every quoted line is real flavor text from the Return to Ravnica block or Magic 2014; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'return-ravnica-maze',
  era: '2013-07-19',
  intro: [s('stage', 'Ravnica. One city the size of a world, run by ten guilds. Act 13 told how the old Guildpact failed.'),
    s('stage', 'Now the guilds are arming. Niv-Mizzet, the dragon who leads the Izzet, has found something in the old leylines.'),
    q('stage', 'The Implicit Maze winds through Ravnica, connecting arcane landmarks of all ten guilds.'),
    q('jace', 'Is the maze itself a phantom? Or is one as real as the other? Perhaps I am as mad as the dragon.'),
    s('stage', 'Every guild is sending a runner. Whoever reaches the end gets whatever is waiting there.')],
  finale: [s('stage', 'At the end of the Maze the runners stop fighting. Jace Beleren steps into the last chamber, and the old magic of the Guildpact chooses him.'),
    s('stage', 'He is the Living Guildpact now. The guilds\' agreements run through him, and no guild can break them while he holds them.'),
    s('jace', 'I came here to solve a puzzle. It turns out the puzzle was a job.'),
    q('tajic', 'I run the maze alone, but I fight with the full might of the Legion.'),
    s('stage', 'The ten guilds go back to their districts, still arguing. But they argue under the law again.')],
  villainFinale: [s('stage', 'Niv-Mizzet reaches the end first. The chamber opens for the dragon, and the old pact bends around the Izzet.'),
    q('niv', 'Don\'t just have an idea—have all of them.'),
    s('niv', 'Nine guilds, one mind. Mine. Ravnica has never been run so efficiently.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Uncovered Clues'},
    emmara: {name: 'Emmara Tandris', title: 'Selesnya', card: 'Emmara Tandris', focus: '50% 25%'},
    lavinia: {name: 'Lavinia', title: 'Of the Tenth', card: 'Lavinia of the Tenth', focus: '50% 25%'},
    tajic: {name: 'Tajic', title: 'Blade of the Legion', card: 'Tajic, Blade of the Legion', focus: '50% 25%'},
    ruric: {name: 'Ruric Thar', title: 'The Unbowed', card: 'Ruric Thar, the Unbowed', focus: '50% 25%'},
    vorel: {name: 'Vorel', title: 'Of the Hull Clade', card: 'Vorel of the Hull Clade', focus: '50% 25%'},
    varolz: {name: 'Varolz', title: 'The Scar-Striped', card: 'Varolz, the Scar-Striped', focus: '50% 25%'},
    jace: {name: 'Jace Beleren', title: 'Architect of Thought', card: 'Jace, Architect of Thought', focus: '50% 25%'},
    lazav: {name: 'Lazav', title: 'Dimir Mastermind', card: 'Lazav, Dimir Mastermind', focus: '50% 25%'},
    teysa: {name: 'Teysa Karlov', title: 'Grand Envoy of Orzhov', card: 'Teysa, Envoy of Ghosts', focus: '50% 25%'},
    exava: {name: 'Exava', title: 'Rakdos Blood Witch', card: 'Exava, Rakdos Blood Witch', focus: '50% 25%'},
    esper: {name: 'Esper Control', title: 'Spring 2013', card: 'Sphinx\'s Revelation', focus: '50% 30%'},
    blitz: {name: 'Naya Blitz', title: 'Spring 2013', card: 'Boros Reckoner', focus: '50% 30%'},
    jund: {name: 'Jund Midrange', title: 'Summer 2013', card: 'Abrupt Decay', focus: '50% 30%'},
    earth: {name: 'Mono-Red', title: 'Summer 2013', card: 'Burning Earth', focus: '50% 40%'},
    niv: {name: 'Niv-Mizzet', title: 'Dracogenius', card: 'Niv-Mizzet, Dracogenius', focus: '50% 25%'},
    trostani: {name: 'Trostani', title: 'Selesnya\'s Voice', card: 'Trostani, Selesnya\'s Voice', focus: '50% 25%'},
    isperia: {name: 'Isperia', title: 'Supreme Judge', card: 'Isperia, Supreme Judge', focus: '50% 25%'},
    aurelia: {name: 'Aurelia', title: 'The Warleader', card: 'Aurelia, the Warleader', focus: '50% 25%'},
    domri: {name: 'Domri Rade', title: 'Gruul', card: 'Domri Rade', focus: '50% 25%'},
    rakdos: {name: 'Rakdos', title: 'Lord of Riots', card: 'Rakdos, Lord of Riots', focus: '50% 25%'},
    gates: {name: 'Maze\'s End', title: '2013', card: 'Maze\'s End', focus: '50% 40%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Selesnya Gate', difficulty: 'Easy', rewardSet: 'rtr', teaches: ['Populate'],
      blurb: 'You arrive in Vitu-Ghazi, the Selesnya tree-city, as its runner sets out. Emmara Tandris has been chosen to run the Maze for the Conclave, and the Azorius arresters have orders to slow every runner down.',
      hero: {who: 'emmara', deck: {label: 'tribute', name: 'The Conclave', colors: 'GW', list: `
2 Trostani, Selesnya's Voice
4 Call of the Conclave
4 Centaur Healer
4 Wayfaring Temple
4 Seller of Songbirds
2 Emmara Tandris
4 Eyes in the Skies
4 Loxodon Smiter
4 Selesnya Charm
4 Sundering Growth
10 Forest
10 Plains
4 Selesnya Guildgate`}},
      villain: {who: 'lavinia', deck: {label: 'tribute', name: 'The Azorius Senate', colors: 'WU', list: `
2 Lavinia of the Tenth
4 Azorius Arrester
4 Lyev Skyknight
4 Hussar Patrol
4 Concordia Pegasus
3 Azorius Justiciar
4 Arrest
3 Inaction Injunction
4 Judge's Familiar
2 Sphinx of the Chimes
2 Isperia's Skywatch
10 Plains
10 Island
4 Azorius Guildgate`}},
      scene: [q('stage', 'When Selesnya needed a champion, Emmara put the ranks of her guild before herself—making her the perfect choice.'),
        q('trostani', 'One day every pillar will be a tree and every hall a glade.'),
        s('emmara', 'Populate: make a copy of a creature token you already control. Make one good token, then copy it.')],
      villainScene: [q('lavinia', 'You have the right to remain silent. Mostly because I tire of your excuses.'),
        q('lavinia', 'To prevent action is to prevent transgression.')],
      cues: {hero: cue('Together.', 'The Conclave grows!', 'They hold us still...', 'Onward.', 'Detained...', 'Copy the biggest token.'),
        villain: cue('Halt.', 'Detained.', 'Obstruction noted.', 'Case closed.', 'Overruled.')},
      after: [s('emmara', 'Every guild is in the Maze now, and none of them trusts the others. Go and see. I will keep running.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Rubblebelt Crossing', difficulty: 'Easy', rewardSet: 'gtc', teaches: ['Battalion'],
      blurb: 'The Maze runs straight through the Rubblebelt, the ruined districts the Gruul clans call home. Tajic, the Boros runner, has the Legion behind him. The Ghor clan has other ideas.',
      hero: {who: 'tajic', deck: {label: 'tribute', name: 'The Boros Legion', colors: 'RW', list: `
2 Tajic, Blade of the Legion
4 Boros Elite
4 Daring Skyjek
4 Wojek Halberdiers
4 Skyknight Legionnaire
4 Truefire Paladin
3 Firemane Avenger
4 Boros Charm
4 Warleader's Helix
3 Precinct Captain
10 Plains
10 Mountain
4 Boros Guildgate`}},
      villain: {who: 'ruric', deck: {label: 'tribute', name: 'The Ghor Clan', colors: 'RG', list: `
2 Burning-Tree Emissary
4 Ghor-Clan Rampager
4 Rubblebelt Raiders
4 Zhur-Taa Swine
4 Scab-Clan Charger
3 Skinbrand Goblin
4 Zhur-Taa Druid
3 Clan Defiance
4 Skarrg Goliath
4 Gruul Ragebeast
10 Forest
10 Mountain
4 Gruul Guildgate`}},
      scene: [q('tajic', 'I run the maze alone, but I fight with the full might of the Legion.'),
        q('tajic', 'All that steel doesn\'t make them slower. It makes them bolder.'),
        s('tajic', 'Battalion: when this creature and at least two others attack, it gets a bonus. Attack in threes.')],
      villainScene: [q('ruric', 'Our fight is not about territory or revenge. It is about freedom, plain and simple.'),
        q('ruric', 'If the other guilds want a war, they should know we\'ve been ready the whole time.')],
      cues: {hero: cue('Legion, form up.', 'Battalion!', 'They hit like a wall...', 'Rubble cleared.', 'Fall back...', 'Three attackers, always.'),
        villain: cue('Smash.', 'Bloodrush!', 'Hah. Tough.', 'The clans win.', 'Run, then.')},
      after: [s('tajic', 'Somebody is hunting runners in the undercity. Not the Gruul. Someone quieter.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Zonot', difficulty: 'Easy', rewardSet: 'gtc', teaches: ['Evolve'],
      blurb: 'Below the streets, the Simic runner Vorel of the Hull Clade is racing through the Golgari undercity, and the Golgari runner, a troll called Varolz, is feeding on everyone he meets.',
      hero: {who: 'vorel', deck: {label: 'tribute', name: 'The Hull Clade', colors: 'GU', list: `
2 Vorel of the Hull Clade
4 Experiment One
4 Cloudfin Raptor
4 Shambleshark
4 Elusive Krasis
4 Crocanura
3 Drakewing Krasis
3 Adaptive Snapjaw
2 Master Biomancer
2 Prime Speaker Zegana
4 Rapid Hybridization
10 Forest
10 Island
4 Simic Guildgate`}},
      villain: {who: 'varolz', deck: {label: 'tribute', name: 'The Swarm', colors: 'BG', list: `
2 Varolz, the Scar-Striped
4 Slitherhead
4 Dreg Mangler
4 Sluiceway Scorpion
4 Golgari Longlegs
4 Stonefare Crocodile
3 Deadbridge Goliath
3 Grisly Salvage
4 Golgari Decoy
4 Ultimate Price
10 Swamp
10 Forest
4 Golgari Guildgate`}},
      scene: [q('vorel', 'We\'re planting the seeds of change. Sometimes, we plant them in people.'),
        q('stage', 'We raised eelhawks to control the squidflies, then waspcrabs to prey on the eelhawks. Now what do we do with all these waspcrabs?'),
        s('vorel', 'Evolve: when a bigger creature enters under your control, an evolve creature gets a +1/+1 counter. Play them small to big.')],
      villainScene: [q('stage', 'The Golgari maze-runner Varolz hungers to prove his fortitude in battle, and his trail of victims feeds other hungers.'),
        q('stage', 'We are all decaying, always in a state of near-death. One moment without breath and we begin to break down.')],
      cues: {hero: cue('Fascinating.', 'It evolved!', 'Hm. Rot.', 'Specimen collected.', 'A failed trial.', 'Small first, then big.'),
        villain: cue('Hungry.', 'Scavenge!', 'Ow.', 'Fed.', 'Back to the rot.')},
      after: [q('vorel', 'Everything serves a purpose. Even you.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Shapeshifter', difficulty: 'Normal', rewardSet: 'gtc', teaches: ['Cipher'],
      blurb: 'Jace Beleren has been mapping the Maze on his own. Lazav, the guildmaster of House Dimir, can wear any face in the city, and he wants Jace\'s notes.',
      hero: {who: 'jace', deck: {label: 'tribute', name: 'Jace\'s Notes', colors: 'WU', list: `
2 Jace, Architect of Thought
4 Azorius Arrester
4 Lyev Skyknight
4 Hussar Patrol
4 Essence Scatter
4 Syncopate
4 Azorius Charm
2 Isperia, Supreme Judge
4 Judge's Familiar
3 Detention Sphere
1 Sphinx's Revelation
10 Island
10 Plains
4 Hallowed Fountain`}},
      villain: {who: 'lazav', deck: {label: 'tribute', name: 'House Dimir', colors: 'UB', list: `
2 Lazav, Dimir Mastermind
4 Nightveil Specter
4 Gutter Skulk
4 Mindeye Drake
3 Call of the Nightwing
4 Death's Approach
3 Undercity Informer
2 Mirko Vosk, Mind Drinker
2 Last Thoughts
10 Island
10 Swamp
4 Watery Grave
4 Ultimate Price
4 Duskmantle Guildmage`}},
      scene: [q('jace', 'Is the maze itself a phantom? Or is one as real as the other? Perhaps I am as mad as the dragon.'),
        s('jace', 'Cipher: a cipher spell gets encoded on one of their creatures. Every time that creature hits you, they cast it again. Block it or kill it.')],
      villainScene: [q('lazav', 'Ask the right questions in the right way and truth is inevitable.'),
        q('lazav', 'The most insidious thing in the world is nonsense that sounds just plausible enough to listen to.'),
        q('lazav', 'One tiny peg pulled from a single wagon wheel, and an entire district grinds to a halt.')],
      cues: {hero: cue('Who are you, really?', 'I see you.', 'He knows my plans...', 'Unmasked.', 'He was ahead of me...', 'Kill the encoded one.'),
        villain: cue('Hello, Jace.', 'Encoded.', 'Interesting.', 'Your notes, please.', 'I was never here.')},
      after: [s('jace', 'He let me win that. I don\'t know why yet, and I don\'t like it.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Debts and Riots', difficulty: 'Normal', rewardSet: 'gtc', teaches: ['Extort'],
      blurb: 'Teysa Karlov, the Grand Envoy of the Orzhov, is collecting on every debt in the city while the guilds are distracted. The Rakdos runner Exava turns her collection round into a carnival.',
      hero: {who: 'teysa', deck: {label: 'tribute', name: 'The Syndicate', colors: 'WB', list: `
2 Teysa, Envoy of Ghosts
4 Syndic of Tithes
4 Basilica Screecher
4 Tithe Drinker
4 Kingpin's Pet
4 Knight of Obligation
4 Blind Obedience
3 High Priest of Penance
3 Doom Blade
10 Plains
10 Swamp
4 Godless Shrine
4 Vizkopa Guildmage`}},
      villain: {who: 'exava', deck: {label: 'tribute', name: 'The Cult of Rakdos', colors: 'BR', list: `
2 Exava, Rakdos Blood Witch
4 Rakdos Cackler
4 Gore-House Chainwalker
4 Rakdos Shred-Freak
4 Splatter Thug
4 Bloodfray Giant
3 Carnival Hellsteed
4 Shock
3 Hellhole Flailer
10 Swamp
10 Mountain
4 Blood Crypt
4 Dead Reveler`}},
      scene: [q('teysa', 'The fine print of countless contracts has ensured we are never defenseless.'),
        q('teysa', 'We do not believe in hiding our wealth in the shadows. This is Orzhov, and this is how we reward greatness.'),
        s('teysa', 'Extort: whenever you cast a spell, you may pay one more mana to drain them for 1. Every spell is a little payment.')],
      villainScene: [q('rakdos', 'Let all feel joy in pain.'),
        q('stage', 'Burn. Bleed. Enjoy.'),
        q('stage', 'Maze-runners who pass through the Rakdos gate leave behind their scruples and a significant amount of skin.')],
      cues: {hero: cue('Your account is due.', 'Paid in full.', 'They are not paying...', 'Collected.', 'Default...', 'Pay the extra mana.'),
        villain: cue('Showtime!', 'Unleash!', 'Boring!', 'Encore!', 'Curtain.')},
      after: [s('teysa', 'Exava is running the Maze for Rakdos, which tells you how seriously he takes it. Go on. The Izzet runner is ahead of all of you.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Revelation', difficulty: 'Normal', rewardSet: 'rtr', teaches: ['Racing a card-draw engine'],
      blurb: 'The Archive remembers spring 2013: a slow Esper control deck that drew a fistful of cards with Sphinx\'s Revelation, against Naya Blitz, which tried to win before the Revelation resolved.',
      hero: {who: 'esper', deck: {label: 'tribute', name: 'Esper Control', note: 'Built from cards in this act\'s sets only, so Thragtusk and Restoration Angel are not in it.', colors: 'WUB', archetype: 'Control', list: `
3 Sphinx's Revelation
4 Supreme Verdict
4 Azorius Charm
4 Detention Sphere
3 Jace, Architect of Thought
4 Essence Scatter
2 Doom Blade
2 Obzedat, Ghost Council
2 Isperia, Supreme Judge
6 Island
5 Plains
2 Swamp
4 Hallowed Fountain
4 Godless Shrine
3 Watery Grave
3 Sin Collector
3 Sphinx of the Chimes
2 Lyev Skyknight`}},
      villain: {who: 'blitz', deck: {label: 'tribute', name: 'Naya Blitz', colors: 'RGW', archetype: 'Aggro', list: `
4 Experiment One
4 Burning-Tree Emissary
4 Ghor-Clan Rampager
4 Boros Reckoner
4 Loxodon Smiter
4 Daring Skyjek
4 Boros Charm
4 Warleader's Helix
4 Wojek Halberdiers
6 Mountain
4 Forest
4 Plains
4 Sacred Foundry
4 Stomping Ground
2 Temple Garden`}},
      scene: [q('isperia', 'The rules of logic and order have already made the choice for you.'),
        s('you', 'Survive the first five turns. After that, every Revelation is a new hand.')],
      villainScene: [q('aurelia', 'Practice compassion and mercy. But know when they must end.')],
      cues: {hero: cue('Hold.', 'Revelation!', 'Too fast...', 'Wiped.', 'Raced.', 'Wrath, then draw.'),
        villain: cue('[a hasty attack]', '[bloodrush]', '[the board is gone]', '[raced]', '[out of gas]')},
      after: [s('stage', 'Recorded: Return to Ravnica Standard, spring 2013.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Burning Earth', difficulty: 'Normal', rewardSet: 'dgm', teaches: ['Paying life'],
      blurb: 'The Archive remembers summer 2013: three-colour Jund Midrange on shocklands, against the mono-red deck that played Burning Earth to punish every non-basic land.',
      hero: {who: 'jund', deck: {label: 'tribute', name: 'Jund Midrange', note: 'Built from cards in this act\'s sets only, so Olivia Voldaren, Thragtusk and Huntmaster of the Fells are not in it.', colors: 'BRG', archetype: 'Midrange', list: `
4 Deathrite Shaman
4 Scavenging Ooze
3 Vraska the Unseen
3 Domri Rade
4 Dreadbore
4 Abrupt Decay
3 Putrefy
4 Witchstalker
3 Ghor-Clan Rampager
2 Garruk, Caller of Beasts
3 Forest
3 Swamp
2 Mountain
4 Blood Crypt
4 Overgrown Tomb
4 Stomping Ground
4 Golgari Guildgate
2 Dreg Mangler`}},
      villain: {who: 'earth', deck: {label: 'tribute', name: 'Mono-Red', colors: 'R', archetype: 'Aggro', list: `
4 Burning Earth
4 Rakdos Cackler
4 Gore-House Chainwalker
4 Ash Zealot
4 Skinbrand Goblin
4 Bloodfray Giant
2 Shock
2 Annihilating Fire
2 Electrickery
4 Ripscale Predator
24 Mountain
2 Splatter Thug`}},
      scene: [q('domri', 'Roots, ruins, and room to fight. All the comforts of home.'),
        s('you', 'Shocklands cost 2 life to enter untapped, and Burning Earth costs more. Spend life only when it buys a turn.')],
      villainScene: [q('aurelia', 'There is no time to remedy our enemies\' ignorance. Blast it out of them.')],
      cues: {hero: cue('Decay it.', 'Planeswalker down!', 'The earth is burning...', 'Outgrown.', 'Burned out.', 'Pay life only when it counts.'),
        villain: cue('[the ground ignites]', '[every land burns]', '[outsized]', '[burned out]', '[stalled]')},
      after: [s('stage', 'Recorded: Return to Ravnica Standard, summer 2013.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Niv-Mizzet', difficulty: 'Hard', rewardSet: 'rtr', rewardCard: 'Niv-Mizzet, Dracogenius', teaches: ['Overload'],
      blurb: 'The last stretch of the Maze. Niv-Mizzet called the race, and he means to win it. Jace runs it with whoever is still standing.',
      hero: {who: 'jace', deck: {label: 'tribute', name: 'Jace and the Runners', colors: 'GWU', list: `
2 Jace, Architect of Thought
2 Vorel of the Hull Clade
2 Lavinia of the Tenth
4 Elusive Krasis
4 Lyev Skyknight
4 Loxodon Smiter
4 Centaur Healer
4 Azorius Charm
3 Detention Sphere
3 Essence Scatter
2 Advent of the Wurm
2 Sphinx's Revelation
5 Plains
4 Island
4 Forest
4 Hallowed Fountain
4 Breeding Pool
3 Temple Garden`}},
      villain: {who: 'niv', deck: {label: 'tribute', name: 'The Izzet League', colors: 'UR', list: `
2 Niv-Mizzet, Dracogenius
2 Ral Zarek
4 Goblin Electromancer
4 Frostburn Weird
2 Melek, Izzet Paragon
4 Mizzium Mortars
4 Izzet Charm
3 Hypersonic Dragon
3 Annihilating Fire
2 Cyclonic Rift
2 Thoughtflare
4 Blistercoil Weird
10 Island
10 Mountain
4 Steam Vents`}},
      scene: [q('stage', 'The pattern of the Implicit Maze extends in more than two dimensions.'),
        q('stage', 'The route has been known for millennia, but only by those with no means to tell it.'),
        s('jace', 'Overload: some Izzet spells have a second, bigger cost. Overloaded, they hit every target instead of one. Do not overextend into seven open mana.')],
      villainScene: [q('niv', 'The maze seems to fight us at every turn, resisting our efforts to solve it.'),
        q('niv', 'Even this primitive specimen of my kind is impressive.'),
        q('niv', 'These Gruul skin-runes—discern whether their patterns evoke streets, leylines, or both. You have four days.')],
      cues: {hero: cue('Last stretch.', 'The Maze opens!', 'He is ahead...', 'Solved.', 'The dragon wins...', 'Hold back against overload.'),
        villain: {...cue('Do keep up.', 'Overloaded!', 'An anomaly.', 'Conclusion: flawless.', 'Recalculating.'),
          half: {who: 'vorel', line: 'The dragon is not invincible. Only very well funded.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Maze\'s End', difficulty: 'Hard', rewardSet: 'dgm', rewardCard: 'Maze\'s End', mood: 'boss',
      teaches: ['Alternate wins'],
      archive: {deck: 'Maze\'s End', when: '2013', format: 'Standard: Return to Ravnica block and Magic 2014.',
        what: 'A slow deck that played one of each of the ten guild Gates, stalled the board with walls, Gatekeepers and Supreme Verdict, and used Maze\'s End to fetch Gates until it controlled all ten.',
        why: 'Maze\'s End is a land that says you win the game if you control ten or more Gates with different names. Players built whole decks around it the year it came out.',
        beat: 'Attack early and keep attacking. The Gates come into play tapped, so the deck is slow. Make it spend its mana surviving instead of fetching Gates.',
        after: 'This tribute uses only this act\'s sets. No single tournament list is copied.'},
      blurb: 'Deep in the archive, the deck that tried to solve the Maze instead of fighting it.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Gruul Aggro', colors: 'RG', archetype: 'Aggro', list: `
4 Ghor-Clan Rampager
4 Rubblebelt Raiders
3 Domri Rade
4 Zhur-Taa Druid
4 Scavenging Ooze
3 Clan Defiance
10 Forest
10 Mountain
4 Stomping Ground
2 Gruul Ragebeast
4 Gyre Sage
4 Scab-Clan Charger
4 Zhur-Taa Swine`}},
      villain: {who: 'gates', deck: {label: 'tribute', name: 'Maze\'s End', colors: 'WUBG', archetype: 'Control', list: `
4 Opal Lake Gatekeepers
4 Saruli Gatekeepers
3 Ubul Sar Gatekeepers
4 Wall of Frost
2 Urban Evolution
4 Azorius Charm
4 Supreme Verdict
3 Sphinx's Revelation
4 Essence Scatter
2 Maze's End
2 Azorius Guildgate
2 Boros Guildgate
2 Dimir Guildgate
2 Golgari Guildgate
2 Gruul Guildgate
2 Izzet Guildgate
2 Orzhov Guildgate
2 Rakdos Guildgate
2 Selesnya Guildgate
2 Simic Guildgate
4 Island
2 Detention Sphere`}},
      scene: [q('stage', 'The Implicit Maze winds through Ravnica, connecting arcane landmarks of all ten guilds.'),
        s('you', 'Ten Gates and it wins. Count them, and hit hard before it gets there.')],
      villainScene: [q('stage', 'Sentries guard Ravnica\'s landmarks and outlying districts, unaware of these places\' import to the maze.')],
      cues: {hero: cue('Hit the walls.', 'Through!', 'Another gate...', 'Maze blocked.', 'All ten gates...', 'Count their Gates.'),
        villain: cue('[a gate opens]', '[maze\'s end activated]', '[the walls crack]', '[ten gates]', '[trampled]')},
      after: [s('stage', 'Recorded: Maze\'s End, Dragon\'s Maze, 2013.')]},
  ],
};
