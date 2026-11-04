// Act 25: The Inventors' Fair (Kaladesh, Aether Revolt). Story and dialogue:
// /mnt/project-files/story/act-25-script.md (generated from this file). Land set: kld.
// Act 24 ended with Emrakul sealed in the moon. Chandra comes home to Kaladesh, the world where Baral took her father
// from her. The Inventors' Fair is underway, judged by Tezzeret, who runs the Consulate from behind the curtain. Pia
// Nalaar, Chandra's mother, leads the renegades. The Gatewatch and the renegades bring down his Planar Bridge, and
// Tezzeret escapes. Every quoted line is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'inventors-fair-aether',
  era: '2017-01-20',
  intro: [s('stage', 'Kaladesh, the plane of inventors, where aether powers everything. The Inventors\' Fair is about to open.'),
    q('stage', 'Never before have there been so many brilliant minds and wondrous inventions in one place. Denizens from every corner of Kaladesh will flock to the once-in-a-lifetime Inventors\' Fair.'),
    s('stage', 'Chandra Nalaar has come home. The last time she was here, the Consulate took her father.'),
    q('chandra', 'Baral took my family from me back then. I\'d do anything to face him now.')],
  finale: [q('stage', 'The renegades mounted an aether disruptor aboard a lightweight thopter to destroy Tezzeret\'s Planar Bridge.'),
    q('pia', 'You want to know what we are fighting for? Look at the wonder in that child\'s eyes.'),
    q('stage', 'Until all have found their place, I will keep watch.'),
    s('stage', 'The bridge is broken. Tezzeret is gone, and so is whoever he was working for.')],
  villainFinale: [q('tezzeret', 'It is finished. Now the real work can begin.'),
    q('tezzeret', 'You can\'t hope to comprehend the plans that are in motion.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Commencement of Festivities'},
    chandra: {name: 'Chandra Nalaar', title: 'Torch of Defiance', card: 'Chandra, Torch of Defiance', focus: '50% 25%'},
    consulate: {name: 'The Consulate', title: 'Fair security', card: 'Aerial Responder', focus: '50% 30%'},
    pia: {name: 'Pia Nalaar', title: 'Renegade', card: 'Pia Nalaar', focus: '50% 25%'},
    agents: {name: 'Gonti', title: 'Lord of Luxury', card: 'Gonti, Lord of Luxury', focus: '50% 25%'},
    saheeli: {name: 'Saheeli Rai', title: 'Inventor', card: 'Saheeli Rai', focus: '50% 25%'},
    padeem: {name: 'Padeem', title: 'Consul of Innovation', card: 'Padeem, Consul of Innovation', focus: '50% 25%'},
    baral: {name: 'Baral', title: 'Chief of Compliance', card: 'Baral, Chief of Compliance', focus: '50% 25%'},
    rashmi: {name: 'Rashmi', title: 'Eternities Crafter', card: 'Rashmi, Eternities Crafter', focus: '50% 25%'},
    dovin: {name: 'Dovin Baan', title: 'Consulate inquirer', card: 'Dovin Baan', focus: '50% 25%'},
    energy: {name: 'RG Energy', title: 'Early 2017', card: 'Bristling Hydra', focus: '50% 30%'},
    constrictor: {name: 'BG Constrictor', title: 'Early 2017', card: 'Winding Constrictor', focus: '50% 30%'},
    vehicles: {name: 'Mardu Vehicles', title: 'Early 2017', card: 'Heart of Kiran', focus: '50% 30%'},
    marvel: {name: 'Aetherworks Marvel', title: 'Early 2017', card: 'Aetherworks Marvel', focus: '50% 30%'},
    ajani: {name: 'Ajani Goldmane', title: 'Unyielding', card: 'Ajani Unyielding', focus: '50% 25%'},
    gideon: {name: 'Gideon Jura', title: 'Of the Gatewatch', card: 'Deft Dismissal', focus: '50% 30%'},
    tezzeret: {name: 'Tezzeret', title: 'The Schemer', card: 'Tezzeret the Schemer', focus: '50% 25%'},
    copycat: {name: 'Copycat', title: 'Early 2017', card: 'Felidar Guardian', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Fairgrounds', difficulty: 'Easy', rewardSet: 'kld', teaches: ['Energy'],
      blurb: 'You arrive in Ghirapur as the Inventors\' Fair opens. Chandra Nalaar is home for the first time in years, and Consulate guards are watching every gate.',
      hero: {who: 'chandra', deck: {label: 'tribute', name: 'Chandra\'s Fire', colors: 'R', list: `
1 Chandra, Torch of Defiance
4 Inventor's Apprentice
4 Aether Chaser
4 Spontaneous Artist
4 Lathnu Hellion
4 Harnessed Lightning
3 Aethertorch Renegade
4 Shock
4 Maulfist Doorbuster
4 Renegade Firebrand
24 Mountain`}},
      villain: {who: 'consulate', deck: {label: 'tribute', name: 'Fair Security', colors: 'W', list: `
4 Consulate Surveillance
4 Consulate Skygate
4 Aether Inspector
4 Eddytrail Hawk
4 Ninth Bridge Patrol
4 Fairgrounds Warden
3 Dawnfeather Eagle
4 Built to Last
24 Plains
4 Fragmentize
1 Authority of the Consuls`}},
      scene: [q('stage', 'Welcome, one and all! Right this way! Open your eyes, your ears, and your imaginations to the wonders of the Inventors\' Fair!'),
        q('stage', 'This one\'s for my mom, and this one\'s for me.'),
        s('chandra', 'Energy: some cards give you energy counters. Save them up and spend them on bigger effects later.')],
      villainScene: [q('stage', 'All skyships entering or leaving the fairgrounds must pass through the security checkpoint.'),
        q('stage', 'Citizens are free to do as they wish, within the confines of the Consulate\'s laws.')],
      cues: {hero: cue('Home again.', 'Burn!', 'They are everywhere...', 'Still standing.', 'Not like this...', 'Spend the energy.'),
        villain: cue('Papers, please.', 'Detain her!', 'Call for backup...', 'Order restored.', 'Breach at the gate...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Leaking Spire', difficulty: 'Easy', rewardSet: 'aer', teaches: ['Vehicles'],
      blurb: 'Pia Nalaar, Chandra\'s mother, runs with the renegades. Kari Zev and her skyship crew ride with them against Gonti\'s smugglers.',
      hero: {who: 'pia', deck: {label: 'tribute', name: 'The Renegades', colors: 'R', list: `
2 Pia Nalaar
2 Kari Zev, Skyship Raider
4 Renegade Freighter
4 Sky Skiff
4 Inventor's Apprentice
4 Speedway Fanatic
4 Aether Chaser
4 Renegade Firebrand
2 Renegade Tactics
4 Shock
24 Mountain
2 Fleetwheel Cruiser`}},
      villain: {who: 'agents', deck: {label: 'tribute', name: 'Gonti\'s Syndicate', colors: 'UB', list: `
2 Gonti, Lord of Luxury
4 Aether Poisoner
4 Aethersphere Harvester
4 Ovalchase Dragster
4 Aether Swooper
4 Shielded Aether Thief
4 Tezzeret's Touch
2 Fatal Push
4 Thriving Rats
12 Island
12 Swamp
4 Subtle Strike`}},
      scene: [q('pia', 'To invent is to rebel.'),
        q('stage', 'Aboard her ship, the *Dragon\'s Smile*, Kari follows no one\'s rules but her own.'),
        s('pia', 'Vehicles: they are artifacts that only fight once you crew them, by tapping creatures with enough total power. Crew, then attack.')],
      villainScene: [q('stage', 'I am confident that all our enterprises can benefit from this little revolution.'),
        q('stage', 'Renegades do some of their best work right under the Consulate\'s nose.')],
      cues: {hero: cue('For freedom!', 'Crewed and flying!', 'They outnumber us...', 'Fly free.', 'Grounded...', 'Crew the vehicle, then attack.'),
        villain: cue('[a deal is struck]', '[the syndicate strikes]', '[a smuggler flees]', '[profit]', '[the market closes]')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Exhibition', difficulty: 'Easy', rewardSet: 'kld', teaches: ['Fabricate'],
      blurb: 'Saheeli Rai shows her filigree creations at the Fair. Consul Padeem judges them, and he wants them under Consulate control.',
      hero: {who: 'saheeli', deck: {label: 'tribute', name: 'The Inventors', colors: 'UR', list: `
1 Saheeli Rai
2 Whirler Virtuoso
2 Accomplished Automaton
2 Maverick Thopterist
4 Aether Theorist
4 Glimmer of Genius
3 Era of Innovation
4 Weldfast Wingsmith
4 Shock
2 Quicksmith Genius
12 Island
12 Mountain
2 Whirlermaker
2 Prizefighter Construct
2 Aether Swooper
2 Inventor's Apprentice`}},
      villain: {who: 'padeem', deck: {label: 'tribute', name: 'The Consulate Inquiry', colors: 'WU', list: `
1 Padeem, Consul of Innovation
4 Consulate Skygate
4 Minister of Inquiries
4 Aether Inspector
4 Thriving Ibex
3 Captured by the Consulate
4 Eddytrail Hawk
12 Island
12 Plains
4 Aeronaut Admiral
4 Spire Patrol
4 Cloudblazer`}},
      scene: [q('saheeli', 'Our creations are more than mere things. They have life in them, little bits of ourselves.'),
        q('stage', 'From the first touch, I know exactly what the metal wants to be.'),
        s('saheeli', 'Fabricate: when it enters, choose. Put +1/+1 counters on it, or make that many 1/1 Servos instead.')],
      villainScene: [q('padeem', 'Impress me.'),
        q('stage', 'This research violates Consulate law.')],
      cues: {hero: cue('Ta-da!', 'Look at it go!', 'Oh no, the gears...', 'Best in show.', 'Back to the workshop...', 'Choose counters or Servos.'),
        villain: cue('Impress me.', 'Confiscated.', 'Most irregular...', 'Approved for storage.', 'Hm. Not bad.')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Chief of Compliance', difficulty: 'Normal', rewardSet: 'aer', teaches: ['Improvise'],
      blurb: 'Baral, the man who killed Chandra\'s father, sets a trap for her. She walks into it anyway.',
      hero: {who: 'chandra', deck: {label: 'tribute', name: 'Chandra\'s Revenge', colors: 'R', list: `
1 Chandra, Torch of Defiance
4 Inventor's Apprentice
4 Lathnu Hellion
4 Harnessed Lightning
4 Pia Nalaar
4 Aethertorch Renegade
4 Renegade Firebrand
3 Chandra's Pyrohelix
4 Thriving Grubs
4 Spireside Infiltrator
24 Mountain`}},
      villain: {who: 'baral', deck: {label: 'tribute', name: 'Compliance', colors: 'U', list: `
2 Baral, Chief of Compliance
4 Metallic Rebuke
4 Aether Swooper
4 Hinterland Drake
4 Reverse Engineer
4 Shielded Aether Thief
4 Aether Meltdown
2 Baral's Expertise
4 Ornithopter
24 Island
4 Negate`}},
      scene: [q('stage', 'Chandra was driven by her anger, directed particularly at the man who had taken her father from her.'),
        q('baral', 'We meet again, pyromancer.'),
        s('chandra', 'Improvise: his spells can tap his artifacts to help pay. Count his artifacts before you count his mana.')],
      villainScene: [q('baral', 'The echo of silence is music to my ears.'),
        q('baral', 'How easily your flames are quenched.')],
      cues: {hero: cue('Baral.', 'Burn it all!', 'He counters everything...', 'For my father.', 'Not again...', 'Make him counter something small first.'),
        villain: cue('Comply.', 'Denied.', 'She is persistent...', 'Silence.', 'Impossible...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Great Conduit', difficulty: 'Normal', rewardSet: 'aer', teaches: ['Revolt'],
      blurb: 'Rashmi, an aether-seer, is helping the renegades. Dovin Baan, the Consulate\'s fair-minded inquirer, is following the trail.',
      hero: {who: 'rashmi', deck: {label: 'tribute', name: 'Rashmi\'s Workshop', colors: 'UG', list: `
2 Rashmi, Eternities Crafter
4 Rogue Refiner
4 Narnam Renegade
4 Silkweaver Elite
4 Hidden Herbalists
4 Lifecraft Cavalry
4 Aid from the Cowl
4 Renegade Map
3 Shielded Aether Thief
3 Empyreal Voyager
12 Forest
12 Island`}},
      villain: {who: 'dovin', deck: {label: 'tribute', name: 'The Inquiry', colors: 'WU', list: `
2 Dovin Baan
4 Consulate Skygate
4 Thopter Arrest
4 Eddytrail Hawk
4 Skyswirl Harrier
4 Aether Inspector
2 Fumigate
4 Minister of Inquiries
12 Island
12 Plains
4 Select for Inspection
4 Fragmentize`}},
      scene: [q('rashmi', 'I opened my mind to the immensity of the wonders around me. It was only then that I could see the Great Conduit.'),
        q('stage', 'The results of Rashmi\'s experimentation forced her to consider the possibility that multitudinous realities existed beyond her own.'),
        s('rashmi', 'Revolt: these cards get better if a permanent of yours left the battlefield this turn. Sacrifice a Clue or a Map first.')],
      villainScene: [q('dovin', 'Too much friction on your bearings, your countersinking is inconsistent, and there are lines in your casting. Dispose of it, and begin again.'),
        q('dovin', 'Give me eight walkers, I\'ll give you the city.')],
      cues: {hero: cue('Let us see.', 'Revolt!', 'He has thought of everything...', 'Eureka.', 'Back to the notes...', 'Make something leave first.'),
        villain: cue('Proceed.', 'Flaw found.', 'Hm. Unexpected.', 'Case closed.', 'Fair enough.')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Energy and Counters', difficulty: 'Normal', rewardSet: 'aer', teaches: ['Racing'],
      blurb: 'A tribute to Standard in early 2017: red-green Energy against black-green Winding Constrictor counters.',
      hero: {who: 'energy', deck: {label: 'tribute', name: 'RG Energy', colors: 'RG', archetype: 'Aggro', list: `
4 Longtusk Cub
4 Greenbelt Rampager
4 Bristling Hydra
4 Harnessed Lightning
4 Servant of the Conduit
4 Voltaic Brawler
4 Thriving Rhino
4 Attune with Aether
2 Rishkar, Peema Renegade
2 Verdurous Gearhulk
12 Forest
12 Mountain`}},
      villain: {who: 'constrictor', deck: {label: 'tribute', name: 'BG Constrictor', colors: 'BG', archetype: 'Midrange', list: `
4 Winding Constrictor
4 Walking Ballista
4 Rishkar, Peema Renegade
4 Fatal Push
4 Servant of the Conduit
4 Gifted Aetherborn
4 Longtusk Cub
12 Forest
12 Swamp
4 Fortuitous Find
4 Rush of Vitality`}},
      scene: [q('stage', 'It won\'t be small forever.'),
        q('stage', 'It\'s natural, it\'s all around us, and it\'s there for the taking. Just try and tell me what I\'m doing is wrong.'),
        s('you', 'Their counters grow every turn. Race them before the Constrictor gets going.')],
      villainScene: [q('stage', 'A few aetherborn have discovered a way to sustain their own existences at the cost of an insatiable hunger for the life essence of other beings.')],
      cues: {hero: cue('Charge up.', 'Full power!', 'They keep growing...', 'Spent and won.', 'Out of energy...', 'Kill the Constrictor.'),
        villain: cue('[coils tighten]', '[counters pile up]', '[a coil slips]', '[squeezed]', '[released]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Heart of Kiran', difficulty: 'Normal', rewardSet: 'kld', teaches: ['Crew'],
      blurb: 'A tribute to Standard in early 2017: Mardu Vehicles against the Aetherworks Marvel.',
      hero: {who: 'vehicles', deck: {label: 'tribute', name: 'Mardu Vehicles', colors: 'WBR', archetype: 'Aggro', list: `
4 Toolcraft Exemplar
4 Veteran Motorist
4 Inventor's Apprentice
4 Heart of Kiran
4 Unlicensed Disintegration
3 Scrapheap Scrounger
3 Fleetwheel Cruiser
2 Pia Nalaar
4 Renegade Freighter
8 Mountain
8 Plains
8 Swamp
4 Aethersphere Harvester`}},
      villain: {who: 'marvel', deck: {label: 'tribute', name: 'Aetherworks Marvel', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'URG', archetype: 'Ramp', list: `
4 Aetherworks Marvel
4 Rogue Refiner
4 Whirler Virtuoso
4 Harnessed Lightning
4 Attune with Aether
4 Servant of the Conduit
4 Glimmer of Genius
4 Longtusk Cub
8 Forest
8 Island
8 Mountain
1 Negate
3 Highspire Infusion`}},
      scene: [q('stage', 'He\'s set to compete in every race at the Fair, and he plans to win them all.'),
        q('stage', 'If you wish to produce the finest work, you must start with the finest tools.'),
        s('you', 'Crew: tap creatures to turn a vehicle on. Keep enough power around to crew every turn.')],
      villainScene: [q('stage', 'If nothing else, the Inventors\' Fair taught us that we\'re only beginning to discover aether\'s true potential.')],
      cues: {hero: cue('Start your engines.', 'Full throttle!', 'They spun the Marvel...', 'First across the line.', 'Wrecked...', 'Race before the Marvel spins.'),
        villain: cue('[the Marvel hums]', '[jackpot]', '[a dud spin]', '[overload]', '[the engine stalls]')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Planar Bridge', difficulty: 'Hard', rewardSet: 'aer', teaches: ['Card advantage'],
      blurb: 'Tezzeret runs the Consulate and the Fair, and he has built a Planar Bridge for someone. The Gatewatch and the renegades storm the Aether Spire.',
      hero: {who: 'ajani', deck: {label: 'tribute', name: 'The Gatewatch and the Renegades', colors: 'RGW', list: `
1 Chandra, Torch of Defiance
2 Ajani Unyielding
2 Pia Nalaar
2 Kari Zev, Skyship Raider
4 Renegade Rallier
4 Veteran Motorist
4 Renegade Wheelsmith
4 Harnessed Lightning
4 Toolcraft Exemplar
3 Depala, Pilot Exemplar
4 Thriving Rhino
2 Heart of Kiran
8 Mountain
8 Plains
8 Forest`}},
      villain: {who: 'tezzeret', deck: {label: 'tribute', name: 'The Schemer', colors: 'UB', list: `
2 Tezzeret the Schemer
4 Herald of Anguish
4 Metallic Mimic
4 Fatal Push
3 Battle at the Bridge
4 Gifted Aetherborn
4 Foundry Inspector
3 Contraband Kingpin
4 Metalwork Colossus
12 Island
12 Swamp
2 Gonti, Lord of Luxury
2 Noxious Gearhulk`}},
      scene: [q('ajani', 'This is about more than aether or inventions. Tezzeret\'s schemes must be stopped!'),
        q('gideon', 'With spy thopters all around, how can the consuls be so blind to Tezzeret\'s manipulations?'),
        s('ajani', 'He draws and he builds. Make him use his cards on your creatures, not on his own plans.')],
      villainScene: [q('tezzeret', 'This is bigger than you. All of you.'),
        q('tezzeret', 'Too little, too late. The machine is in motion.')],
      cues: {hero: cue('Storm the Spire!', 'For Kaladesh!', 'The metal keeps coming...', 'The bridge is down.', 'He got away with it...', 'Hit the artifacts.'),
        villain: {...cue('This is bigger than you.', 'The machine is in motion.', 'An inconvenience.', 'It is finished.', 'Another time.'),
          half: {who: 'pia', line: 'The disruptor thopter is away! Keep him busy!'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Copycat', difficulty: 'Hard', rewardSet: 'aer', rewardCard: 'Felidar Guardian', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Copycat', when: 'Early 2017', format: 'Standard.',
        what: 'Decks built around Saheeli Rai and Felidar Guardian. The Guardian blinks Saheeli, Saheeli copies the Guardian, and the copies repeat until there are endless hasty cats.',
        why: 'Any deck that let the two land together could lose on the spot. The combo pieces also fit neatly into Energy decks.',
        beat: 'Pressure them hard and kill Saheeli as soon as she lands.',
        after: 'Felidar Guardian was banned in Standard in April 2017. Forge\'s CPU rarely assembles the combo, so this tribute mostly plays fair.'},
      blurb: 'Deep in the archive, the cat that copied itself.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'BR Aggro', colors: 'BR', archetype: 'Aggro', list: `
2 Gifted Aetherborn
4 Fatal Push
4 Night Market Lookout
2 Aethersphere Harvester
4 Inventor's Apprentice
4 Bomat Courier
2 Shock
12 Mountain
12 Swamp
4 Live Fast
4 Fortuitous Find
3 Fen Hauler
3 Dukhara Scavenger`}},
      villain: {who: 'copycat', deck: {label: 'tribute', name: 'Copycat', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'WURG', archetype: 'Combo', list: `
4 Saheeli Rai
4 Felidar Guardian
2 Rogue Refiner
3 Whirler Virtuoso
3 Harnessed Lightning
4 Attune with Aether
2 Servant of the Conduit
4 Torrential Gearhulk
6 Forest
6 Island
6 Mountain
6 Plains
4 Longtusk Cub
4 Glimmer of Genius
2 Ridgescale Tusker`}},
      scene: [q('stage', 'The loyalty of a felidar is hard won but worth the effort.'),
        s('you', 'If the cat and the inventor ever meet, it is over. Keep the pressure on.')],
      villainScene: [q('stage', 'From the first touch, I know exactly what the metal wants to be.')],
      cues: {hero: cue('Go fast.', 'Got her!', 'There are two of them...', 'No more cats.', 'Infinite cats...', 'Kill Saheeli on sight.'),
        villain: cue('[a soft purr]', '[the copies begin]', '[the cat flinches]', '[endless cats]', '[the cat wanders off]')},
      after: [s('stage', 'Recorded: Felidar Guardian banned in Standard, April 2017.')]},
  ],
};
