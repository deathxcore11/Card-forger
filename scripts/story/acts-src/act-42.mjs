// Act 42: Crossing: TMNT and Marvel. Story and dialogue: /mnt/project-files/story/act-42-script.md (generated from this file).
// Land set: tmt. Two Universes Beyond worlds, one act: four brothers under New York, then the Avengers against a Titan. Outside Magic canon: you are only passing through.
// Every quoted line is real flavor text from Magic: The Gathering - Teenage Mutant Ninja Turtles and Marvel Super Heroes; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'crossing-tmnt-marvel',
  era: '2026-06-26',
  intro: [s('stage', 'An Omenpath opens in a sewer. Four turtles and a rat are waiting for pizza, and for trouble.'),
    s('stage', 'Past it, another Omenpath opens over a city where heroes in costumes defend a world that never asked for them.'),
    s('stage', 'Recorded: crossings sit outside Magic canon. You are only passing through, twice.')],
  finale: [s('stage', 'The Titan falls. The stones go quiet, and the heroes stand together under a sky that is only a sky again.'),
    q('cap', 'They say the world moved on without me, but as long as injustice exists, I\'m still needed here.'),
    s('stage', 'The Omenpaths fold shut, one after the other. The road turns back to the Multiverse.')],
  villainFinale: [s('stage', 'In this version the Titan has what he came for. The universe is half as loud.'),
    q('thanos', 'I shall restore the cosmic balance.'),
    s('stage', 'The last Omenpath flickers, and holds just long enough for you to leave.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Quintessential Katana'},
    leo: {name: 'Leonardo', title: 'Sewer Samurai', card: 'Leonardo, Sewer Samurai', focus: '50% 25%'},
    foot: {name: 'The Foot Clan', title: 'Of Oroku Saki', card: 'Foot Mystic', focus: '50% 30%'},
    april: {name: 'April O\'Neil', title: 'Hacktivist', card: 'April O\'Neil, Hacktivist', focus: '50% 25%'},
    dragons: {name: 'The Purple Dragons', title: 'Street Gang', card: 'Purple Dragon Punks', focus: '50% 30%'},
    raph: {name: 'Raphael and Mikey', title: 'Troublemakers', card: 'Raph & Mikey, Troublemakers', focus: '50% 25%'},
    krang: {name: 'Krang', title: 'Utrom Warlord', card: 'Krang, Utrom Warlord', focus: '50% 25%'},
    mutanimals: {name: 'The Mighty Mutanimals', title: 'Scrappy Mutants', card: 'Mighty Mutanimals', focus: '50% 30%'},
    shredder: {name: 'Super Shredder', title: 'Perfection', card: 'Super Shredder', focus: '50% 25%'},
    cap: {name: 'Captain America', title: 'Super-Soldier', card: 'Captain America, Super-Soldier', focus: '50% 25%'},
    hydra: {name: 'HYDRA', title: 'Cut one head, two more', card: 'Baron Strucker, HYDRA Overlord', focus: '50% 25%'},
    thor: {name: 'Thor', title: 'Odinson', card: 'Thor Odinson', focus: '50% 25%'},
    loki: {name: 'Loki', title: 'God of Mischief', card: 'Loki, God of Mischief', focus: '50% 25%'},
    ff: {name: 'The Fantastic Four', title: 'Of the Baxter Building', card: 'Invisible Woman, Sue Storm', focus: '50% 25%'},
    doom: {name: 'Doctor Doom', title: 'Of Latveria', card: 'Doctor Doom', focus: '50% 25%'},
    avengers: {name: 'The Avengers', title: 'Earth\'s Mightiest', card: 'Thor Odinson', focus: '50% 25%'},
    thanos: {name: 'Thanos', title: 'The Mad Titan', card: 'Thanos, the Mad Titan', focus: '50% 25%'},
    guardians: {name: 'The Small Heroes', title: 'Ant-Man and Moon Girl', card: 'Moon Girl and Devil Dinosaur', focus: '50% 25%'},
    heralds: {name: 'The Heralds', title: 'Of Galactus', card: 'Killmonger, Scourge of Wakanda', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Turtles', difficulty: 'Easy', rewardSet: 'tmt', teaches: ['Sneak'],
      blurb: 'A sewer, a katana and a clan that does not like turtles.',
      hero: {who: 'leo', deck: {label: 'tribute', name: 'The Turtles', colors: 'W', list: `
3 Leonardo, Sewer Samurai
2 Leonardo, Leader in Blue
2 Leonardo, Big Brother
4 Quintessential Katana
4 Hamato Guardian Stance
3 Leonardo's Technique
4 Hero in Training
4 Agents of S.H.I.E.L.D.
4 High-Flying Ace
4 Raft Security Officer
2 Kree Commandos
24 Plains`}},
      villain: {who: 'foot', deck: {label: 'tribute', name: 'The Foot Clan', colors: 'B', list: `
4 Foot Mystic
4 Ninja Teen
3 Stomped by the Foot
2 Shredder's Technique
2 Pain 101
4 Ninja of the Hand
4 HYDRA Troopers
4 Agents of HYDRA
4 Red Room Recruit
4 Kingpin's Enforcers
1 Tunnel Rats
24 Swamp`}},
      scene: [q('leo', "That's right. Eyes on me."),
        s('leo', 'Sneak: if an attacker is unblocked, return it to hand and put a stronger fighter in its place for the sneak cost.')],
      villainScene: [q('foot', 'The Foot Elite are the personal students of the Shredder, a reserve guard without equal.'),
        s('foot', 'The Foot Clan: silent, patient and very sure they will win.')],
      cues: {hero: cue('Eyes on me.', 'Sneak attack!', 'They are everywhere...', 'Cowabunga.', 'Back to the lair...', 'Sneak a stronger attacker in once you are unblocked.'),
        villain: cue('Silence.', 'Strike!', 'The turtles are faster...', 'The Foot prevails.', 'Retreat...')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'Alliance', difficulty: 'Easy', rewardSet: 'tmt', teaches: ['Alliance'],
      blurb: 'A reporter with a camera, a gadget turtle and a street gang that picked the wrong alley.',
      hero: {who: 'april', deck: {label: 'tribute', name: 'April and the Turtles', colors: 'U', list: `
3 April O'Neil, Hacktivist
3 April, Reporter of the Weird
3 Donatello, Turtle Techie
3 Donatello, Way with Machines
4 Buzz Bots
2 Negate
4 Atlantean Cavalry
4 S.H.I.E.L.D. Deployment Drone
4 Bold Biochemist
4 Utrom Scientists
2 Hydraulic Helper
24 Island`}},
      villain: {who: 'dragons', deck: {label: 'tribute', name: 'The Purple Dragons', colors: 'R', list: `
4 Purple Dragon Punks
4 Rock Soldiers
3 Mouser Foundry
3 General Traag, Heart of Stone
2 Manhole Missile
4 Machinesmith Automaton
4 Mutant Town Musicians
4 HYDRA Assault Robot
4 Null Group Biological Assets
4 Volcanic Villain
24 Mountain`}},
      scene: [q('april', 'In the fight between mutants, ninjas, and aliens, don\'t underestimate a resourceful human.'),
        s('april', 'Alliance: whenever another creature enters on your side, this one grows a little. Keep the crowd coming.')],
      villainScene: [q('dragons', "These guys are young, but no rookies. They've fought and beat everything on two legs in this area . . . except us."),
        s('dragons', 'The Purple Dragons: every corner of the city, and a score to settle.')],
      cues: {hero: cue('Let me get this on camera.', 'Gadgets!', 'The punks are winning...', 'Got it on tape.', 'Camera down...', 'Each new creature boosts your allies.'),
        villain: cue('This is our block.', 'Smash them!', 'Hold the corner...', 'Ours.', 'Run!')}},
    {slot: 3, mood: 'rival', kind: 'Rival', title: 'Krang', difficulty: 'Normal', rewardSet: 'tmt', teaches: ['Discard'],
      blurb: 'The Technodrome is unfinished. Krang does not care.',
      hero: {who: 'raph', deck: {label: 'tribute', name: 'Heroes in a Half Shell', colors: 'GR', list: `
3 Raphael, Tough Turtle
3 Michelangelo, Game Master
3 Raphael, the Nightwatcher
3 Michelangelo, Improviser
4 Cowabunga!
3 Raph & Mikey, Troublemakers
4 Powerful Broker
4 K'un-Lun Warrior
4 Zoo Escapees
4 Mutant Town Musicians
1 HYDRA Assault Robot
12 Forest
12 Mountain`}},
      villain: {who: 'krang', deck: {label: 'tribute', name: "Krang's Technodrome", colors: 'UB', list: `
3 Krang, Master Mind
2 Krang, Utrom Warlord
3 Stockman, Mad Fly-entist
4 Henchbots
3 Mind Transfer Protocol
2 Fugitive Droid
4 S.H.I.E.L.D. Deployment Drone
4 HYDRA Troopers
4 Insectoid Exterminator
4 Ninja of the Hand
3 Hydraulic Helper
12 Island
12 Swamp`}},
      scene: [q('raph', 'Anger is a dangerous ally. It clouds your judgment. You need to control it, lest it control you.'),
        s('raph', 'Krang makes you discard and mind-control your best fighter. Keep a spare card for the hit.')],
      villainScene: [q('krang', "You don't have to explain it to me, I'm the one who invented it!"),
        s('krang', 'Lord Krang is not in a hurry. The Technodrome will finish itself.')],
      cues: {hero: cue('Change of plans!', 'Smash!', 'The Technodrome is huge...', 'Tough turtle.', 'Beat down...', 'Keep a spare card when he makes you discard.'),
        villain: cue('Fools.', 'Technodrome!', 'A setback...', 'Mine.', 'Impossible...')}},
    {slot: 4, mood: 'boss', kind: 'Boss', title: 'Super Shredder', difficulty: 'Hard', rewardSet: 'tmt', teaches: ['Disappear'],
      blurb: 'Mutagen, armor and a grudge older than the turtles.',
      hero: {who: 'mutanimals', deck: {label: 'tribute', name: 'The Mighty Mutanimals', colors: 'GW', list: `
3 Mikey & Leo, Chaos & Order
3 Sally Pride, Lioness Leader
1 Mighty Mutanimals
3 Leatherhead, Swamp Stalker
1 Venus, Torn Between Worlds
1 Make Your Move
4 Undercover Skrull
4 Kree Commandos
4 Hero in Training
4 Frog Butler
4 Courier of Comestibles
4 Ant-Man's Army
12 Forest
12 Plains`}},
      villain: {who: 'shredder', deck: {label: 'tribute', name: "Super Shredder's Foot", colors: 'BW', list: `
3 Super Shredder
3 Shredder, Unrelenting
3 Karai, Future of the Foot
4 Foot Elite
4 Foot Ninjas
4 Shredder's Armor
4 The Cloning of Shredder
4 Agents of S.H.I.E.L.D.
4 HYDRA Troopers
3 Raft Security Officer
12 Swamp
12 Plains`}},
      scene: [q('mutanimals', "Yer right. We're just a scrappy band of mutants. We can't win. But boy, can we stir up trouble."),
        s('mutanimals', 'Disappear: if one of your permanents left play this turn, the creature makes a bonus Ninja token.')],
      villainScene: [q('shredder', 'I have molded myself into perfection, Hamato. Look upon me, and know fear.'),
        s('shredder', 'Tonight, there will be turtle soup.')],
      cues: {hero: cue('Stir up trouble.', 'Mutanimals!', 'He is too strong...', 'The Foot falls.', 'Perfection...', 'Make a permanent leave play to light Disappear.'),
        villain: cue('Know fear.', 'Super Shredder!', 'Flawed...', 'Perfect.', 'Hamato...')}},
    {slot: 5, mood: 'tension', kind: 'Arrival', title: 'Assemble', difficulty: 'Easy', rewardSet: 'msh', teaches: ['Teamwork'],
      blurb: 'A shield, a soldier and a cause that has outlasted decades.',
      hero: {who: 'cap', deck: {label: 'tribute', name: 'S.H.I.E.L.D.', colors: 'W', list: `
1 Captain America, Super-Soldier
1 Captain America, Wings of Freedom
1 Nick Fury, Agent of S.H.I.E.L.D.
1 Agent Phil Coulson
2 Agents of S.H.I.E.L.D.
4 Mighty Mutanimals
4 Kree Commandos
4 Hero in Training
4 High-Flying Ace
4 Agent of Atlas
4 Wakandan Drone Flock
4 Brave Brawler
2 Action News Crew
24 Plains`}},
      villain: {who: 'hydra', deck: {label: 'tribute', name: 'HYDRA', colors: 'B', list: `
4 Agents of HYDRA
4 HYDRA Troopers
3 Baron Strucker, HYDRA Overlord
2 Arnim Zola, Bio-Fanatic
2 Crossbones, Malicious Mercenary
3 HYDRA Infiltration
4 Kingpin's Enforcers
4 Paramecia Coloniex
4 Insectoid Exterminator
4 Ninja of the Hand
2 Project Deathlok Soldier
24 Swamp`}},
      scene: [q('cap', 'Our worst day is only where we start from. Where we *rise* from.'),
        s('cap', 'Teamwork: tap creatures with enough total power to boost a spell. A crowd turns a small spell into a big one.')],
      villainScene: [q('hydra', 'Minions of HYDRA! Behold! Our ultimate destiny is at hand!'),
        s('hydra', 'HYDRA: cut off one head and two more shall take its place.')],
      cues: {hero: cue('Avengers, assemble.', 'Light them up!', 'HYDRA is everywhere...', 'Mission accomplished.', 'Fallen...', 'Tap your team to double a spell.'),
        villain: cue('Hail HYDRA.', 'Attack!', 'A setback...', 'Hail HYDRA!', 'Cut one head...')}},
    {slot: 6, mood: 'comic', kind: 'Lesson', title: 'Power-Up', difficulty: 'Normal', rewardSet: 'msh', teaches: ['Power-up'],
      blurb: 'The God of Thunder, a hammer and a brother who lies about everything.',
      hero: {who: 'thor', deck: {label: 'tribute', name: 'The Asgardians', colors: 'RW', list: `
1 Thor Odinson
2 Brave Brawler
1 Daredevil, Man Without Fear
1 War Machine, Legacy of Iron
4 Mighty Mutanimals
4 Kree Commandos
4 Hero in Training
4 EPF Point Squad
4 Volcanic Villain
4 Mechanized Ninja Cavalry
4 Machinesmith Automaton
3 Null Group Biological Assets
12 Mountain
12 Plains`}},
      villain: {who: 'loki', deck: {label: 'tribute', name: "Loki's Tricks", colors: 'U', list: `
3 Loki, God of Mischief
3 Kid Loki
4 Atlantean Cavalry
2 Frozen in Ice
2 Depower
3 Multiversal Incursion
4 Hydraulic Helper
4 Bold Biochemist
4 Crustacean Commando
4 S.H.I.E.L.D. Deployment Drone
3 Utrom Scientists
24 Island`}},
      scene: [q('thor', 'Now, my hammer shall speak for me . . . in a voice of thunder!'),
        s('thor', 'Power-up: pay once to put counters on a creature. It is cheaper the turn it enters.')],
      villainScene: [q('loki', 'Foolish heroes. Loki can match you trick for trick, and *then* some.'),
        q('loki', 'A lie is nothing but a story. We can choose to tell a different one.')],
      cues: {hero: cue('For Asgard!', 'Thunder!', 'The tricks are working...', 'The hammer speaks.', 'Lies...', 'Power-up a creature the turn it enters.'),
        villain: cue('A trick.', 'Gotcha!', 'Hm...', 'Fooled you.', 'Oops.')}},
    {slot: 7, mood: 'rival', kind: 'Rival', title: 'Doctor Doom', difficulty: 'Hard', rewardSet: 'msh', teaches: ['Playing around counterspells'],
      blurb: 'The Baxter Building against a monarch who is always three steps ahead.',
      hero: {who: 'ff', deck: {label: 'tribute', name: 'The Fantastic Four', colors: 'RW', list: `
1 Human Torch, Johnny Storm
1 Invisible Woman, Sue Storm
2 Kree Commandos
2 Hero in Training
4 EPF Point Squad
4 Mighty Mutanimals
4 Machinesmith Automaton
4 Null Group Biological Assets
4 Mechanized Ninja Cavalry
4 Crimson Operative
4 Volcanic Villain
2 Mutant Town Musicians
12 Mountain
12 Plains`}},
      villain: {who: 'doom', deck: {label: 'tribute', name: 'Doom Reigns Supreme', colors: 'B', list: `
3 Doctor Doom
4 Doom Reigns Supreme
4 Project Deathlok Soldier
4 Kingpin's Enforcers
4 Dark Deed
4 Hour of Defeat
4 Paramecia Coloniex
4 Tunnel Rats
4 HYDRA Troopers
1 Ninja of the Hand
24 Swamp`}},
      scene: [q('ff', "I'll hold down the fort while you guys bicker."),
        s('ff', 'Doom answers your plays. Bait with a small spell first, then land the one that matters.')],
      villainScene: [q('doom', 'I have seen your rightful place. Beneath me.'),
        q('doom', 'What fools you are that you cannot discern between a robotic servant and that which is . . . Doom!')],
      cues: {hero: cue('Fantastic!', 'Flame on!', 'Doom is ahead of us...', 'Doom is beaten.', 'Doomed...', 'Bait his answers before the big play.'),
        villain: cue('Doom.', 'Bow!', 'A flaw...', 'Doom reigns.', 'Doombot...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Mad Titan', difficulty: 'Hard', rewardSet: 'msh', teaches: ['Deathtouch'],
      blurb: 'The Avengers stand in front of a Titan who wants half the universe.',
      hero: {who: 'avengers', deck: {label: 'tribute', name: "Earth's Mightiest Heroes", colors: 'RW', list: `
3 Thor Odinson
2 Captain America, Super-Soldier
3 Daredevil, Man Without Fear
3 Hawkeye, Master Marksman
3 War Machine, Legacy of Iron
2 Avengers Assemble!
4 EPF Point Squad
4 Kree Commandos
4 Mighty Mutanimals
4 Mechanized Ninja Cavalry
4 Null Group Biological Assets
12 Mountain
12 Plains`}},
      villain: {who: 'thanos', deck: {label: 'tribute', name: 'Thanos and the Black Order', colors: 'BRW', list: `
3 Thanos, the Mad Titan
3 Ares, God of War
3 Bullseye, Death Dealer
2 The Ruinous Wrecking Crew
2 Madame Hydra
3 Cruel Alliance
2 Avengers: Under Siege
4 Foot Elite
4 Agents of S.H.I.E.L.D.
4 Kingpin's Enforcers
4 Action News Crew
2 Purple Dragon Punks
8 Swamp
8 Mountain
8 Plains`}},
      scene: [q('avengers', 'Listen up, you *screw-heads*. You\'re history!'),
        q('avengers', 'Wakanda forever!'),
        s('avengers', 'Trade small for big. The Titan wins if the game slows to a crawl.')],
      villainScene: [q('thanos', 'I shall restore the cosmic balance.'),
        q('thanos', 'Let the slaughter begin!')],
      cues: {hero: cue('Avengers, assemble.', 'Together!', 'The Titan is unstoppable...', 'Balance restored.', 'We could not stop him...', 'Race him before the board stalls.'),
        villain: cue('Balance.', 'Inevitable!', 'Impossible...', 'Half.', 'No...')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'The Coming of Galactus', difficulty: 'Hard', rewardSet: 'msh', rewardCard: 'The Coming of Galactus', mood: 'boss',
      teaches: ['Trample'],
      archive: {deck: 'The Heralds of Galactus', when: 'Summer 2026', format: 'Story archive, no tournament list.',
        what: 'A black-green deck of the set\'s villains and heralds, with The Coming of Galactus at the top.',
        why: 'It stands for the threat past the Titan and is not a list anyone won with.',
        beat: 'Block the big heralds, chump the pack and race the saga before it ends.',
        after: 'Nothing; this is the optional superboss at the end of the story.'},
      blurb: 'The sky darkens. Something far bigger than a Titan is coming.',
      hero: {who: 'guardians', deck: {label: 'tribute', name: 'The Small Heroes', colors: 'GU', list: `
3 Ant-Man, Colony Commander
3 Moon Girl and Devil Dinosaur
3 Beast, Erudite Aerialist
3 The Astonishing Ant-Man
4 Giant Growth
3 Worlds Within Worlds
4 Powerful Broker
4 Hydraulic Helper
4 Slithering Cryptid
4 Atlantean Cavalry
1 Primordial Pachyderm
12 Forest
12 Island`}},
      villain: {who: 'heralds', deck: {label: 'tribute', name: 'The Heralds of Galactus', note: 'Built from cards in this act\'s sets only. No tournament list is copied.', colors: 'BG', list: `
2 Killmonger, Scourge of Wakanda
2 Titania, Rugged Rumbler
1 The Serpent Society
1 The Coming of Galactus
4 Ninja of the Hand
4 Frog Butler
4 Kingpin's Enforcers
4 Undercover Skrull
4 Ant-Man's Army
4 Agents of HYDRA
4 HYDRA Troopers
2 Knight of Wundagore
12 Swamp
12 Forest`}},
      scene: [q('guardians', 'C\'mon girls, we\'re not here for snacks. Okay, maybe just one.'),
        s('guardians', 'Small heroes, big stakes. Race the saga.')],
      villainScene: [q('heralds', 'I was stolen from paradise, but paradise never came looking for me.')],
      cues: {hero: cue('Small and fast.', 'Size up!', 'The sky is falling...', 'Saved the planet.', 'Devoured...', 'Chump the heralds and race the saga.'),
        villain: cue('Hail the herald.', 'Devour!', 'He is coming...', 'It comes.', 'Denied...')},
      after: [s('stage', 'Recorded: Galactus turns away for now. The Omenpaths close.')]},
  ],
};
