// Act 40: The Edge of Eternities. Story and dialogue: /mnt/project-files/story/act-40-script.md (generated from this file).
// Land set: eoe. Sothera and the Edge, August 2025: the Sunstar Free Company, the Monoists, the Kav, the Eumidians, the Uthros Combine.
// Every quoted line is real flavor text from Magic: The Gathering - Edge of Eternities; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'edge-of-the-galaxy',
  era: '2025-08-01',
  intro: [s('stage', 'Past the last Omenpath, the stars thin out. This is Sothera, and the stories here are about endings.'),
    s('stage', 'Kav miners, Eumidian gardeners, Uthros scientists and a faith that worships the dark all share one edge of the galaxy.'),
    s('stage', 'Recorded: the Edge of Eternities, August 2025. A new kind of Magic, set among the stars.')],
  finale: [s('stage', 'The supervoid collapses on itself and the Monoist hymn goes quiet.'),
    q('haliya', 'Beyond the edge of faith lies eternal hope.'),
    s('stage', 'Sunstar light reaches the Edge again. The road bends on toward whatever comes next.')],
  villainFinale: [s('stage', 'In this version the dark keeps the Edge. The stars go out one by one.'),
    q('alpharael', "All things end. I'd rather embrace that truth than the fantasy of eternal light."),
    s('stage', 'The Omenpath home flickers, and holds, just long enough for you to leave.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Starfighter Pilot'},
    sami: {name: 'Sami', title: "Ship's Engineer", card: 'Sami, Wildcat Captain', focus: '50% 25%'},
    kav: {name: 'The Kav Miners', title: 'Of Kavaron', card: 'Slagdrill Scrapper', focus: '50% 30%'},
    eumidians: {name: 'The Eumidians', title: 'Of Evendo', card: 'Eumidian Terrabotanist', focus: '50% 30%'},
    navy: {name: 'The Kavaron Memorial Navy', title: 'Of the Edge', card: 'Vaultguard Trooper', focus: '50% 30%'},
    uthros: {name: 'The Uthros Combine', title: 'Of the Godcore', card: 'Mechan Navigator', focus: '50% 30%'},
    tezzeret: {name: 'Tezzeret', title: 'Cruel Captain', card: 'Tezzeret, Cruel Captain', focus: '50% 25%'},
    sunstar: {name: 'The Sunstar Free Company', title: 'Of Taman IV', card: 'Dawnstrike Vanguard', focus: '50% 30%'},
    haliya: {name: 'Haliya', title: 'Guided by Light', card: 'Haliya, Guided by Light', focus: '50% 25%'},
    alpharael: {name: 'Alpharael', title: 'Stonechosen', card: 'Alpharael, Stonechosen', focus: '50% 25%'},
    drix: {name: 'The Drix', title: 'Weftwalkers', card: 'Genemorph Imago', focus: '50% 30%'},
    wilds: {name: 'The Wilds of Evendo', title: 'Thawing', card: 'Frenzied Baloth', focus: '50% 30%'},
    pinnacle: {name: 'The Pinnacle Envoys', title: 'Of the Edge', card: 'Mechan Shieldmate', focus: '50% 30%'},
    syr: {name: 'Syr Vondam', title: 'The Lucent', card: 'Syr Vondam, Sunstar Exemplar', focus: '50% 25%'},
    reckoning: {name: 'The Kav Reckoning', title: 'Last of Kavaron', card: 'Mutinous Massacre', focus: '50% 30%'},
    illvoi: {name: 'The Illvoi', title: 'Cloudkill Scientists', card: 'Cryoshatter', focus: '50% 30%'},
    alliance: {name: 'The Edge Alliance', title: 'Sunstar and Kav', card: 'Sami, Wildcat Captain', focus: '50% 25%'},
    sothera: {name: 'Sothera', title: 'The Supervoid', card: 'Sothera, the Supervoid', focus: '50% 25%'},
    tannuk: {name: 'Tannuk', title: 'Memorial Ensign', card: 'Tannuk, Memorial Ensign', focus: '50% 25%'},
    station: {name: 'Infinite Guideline Station', title: 'The Station Monitors', card: 'Station Monitor', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Salvage Rights', difficulty: 'Easy', rewardSet: 'eoe', teaches: ['Station'],
      blurb: 'A skeleton crew, a patched ship and a mining claim somebody else wants.',
      hero: {who: 'sami', deck: {label: 'tribute', name: "Sami's Salvage Crew", colors: 'RW', list: `
3 Sami, Ship's Engineer
2 Tannuk, Steadfast Second
4 Starfighter Pilot
3 Rayblade Trooper
4 Plasma Bolt
2 Radiant Strike
2 Nutrient Block
4 Sunstar Expansionist
4 Exosuit Savior
4 Weftstalker Ardent
4 Kavaron Turbodrone
12 Mountain
12 Plains`}},
      villain: {who: 'kav', deck: {label: 'tribute', name: 'The Kav Miners', colors: 'R', list: `
4 Slagdrill Scrapper
4 Oreplate Pangolin
4 Kavaron Turbodrone
1 Bombard
4 Frontline War-Rager
4 Molecular Modifier
4 Weftstalker Ardent
4 Zookeeper Mechan
4 Terrapact Intimidator
3 Memorial Team Leader
24 Mountain`}},
      scene: [q('sami', 'The hard way it is.'),
        q('stage', "We're a few bones short of a skeleton crew, Sami, but we've got plenty of spine."),
        s('sami', 'Station: tap your creatures to charge a Spacecraft. When it is charged, it is a real ship.')],
      villainScene: [q('kav', "Soon we'll have enough firepower to rid Evendo of its bug infestation."),
        s('kav', 'Kav miners: the claim is ours. Dig first, argue later.')],
      cues: {hero: cue('The hard way it is.', 'Full burn!', 'Hull is cracking...', 'Claim secured.', 'Abandon ship...', 'Charge the ship with your creatures.'),
        villain: cue('Dig!', 'Open the drills!', 'The claim is slipping...', 'Ours.', 'Lost it...')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'The Thaw of Evendo', difficulty: 'Easy', rewardSet: 'eoe', teaches: ['Warp'],
      blurb: 'The Eumidians are thawing a frozen moon. The Kav Navy has other ideas.',
      hero: {who: 'eumidians', deck: {label: 'tribute', name: 'The Eumidians of Evendo', colors: 'G', list: `
4 Seedship Agrarian
4 Lashwhip Predator
3 Terrasymbiosis
4 Biosynthic Burst
2 Eusocial Engineering
4 Skystinger
4 Galactic Wayfarer
4 Thawbringer
4 Meltstrider Eulogist
3 Broodguard Elite
24 Forest`}},
      villain: {who: 'navy', deck: {label: 'tribute', name: 'The Kavaron Memorial Navy', colors: 'R', list: `
4 Vaultguard Trooper
4 Frontline War-Rager
3 Devastating Onslaught
2 Invasive Maneuvers
3 Terminal Velocity
2 Rig for War
4 Kavaron Turbodrone
4 Oreplate Pangolin
4 Molecular Modifier
4 Weftstalker Ardent
2 Zookeeper Mechan
24 Mountain`}},
      scene: [q('eumidians', 'To plant the seeds of the other is to cultivate the self.'),
        s('eumidians', 'Warp: cast it cheaper, ambush with it, and it leaves at end of turn. You can cast it again from exile later.')],
      villainScene: [q('navy', 'Adapt to this, you bug-eyed planet-squatters!'),
        s('navy', 'Memorial Navy: advance, give everything, and hold the line.')],
      cues: {hero: cue('We grow as the world grows.', 'Bloom!', 'The thaw stalls...', 'Evendo lives.', 'The ice returns...', 'Warp in, then warp out. The card comes back.'),
        villain: cue('Advance!', 'Give everything!', 'Fall back...', 'The moon is ours.', 'Retreat!')}},
    {slot: 3, mood: 'rival', kind: 'Rival', title: 'The Uthros Combine', difficulty: 'Normal', rewardSet: 'eoe', teaches: ['Void'],
      blurb: 'Uthros scientists keep secrets. A cruel captain wants to buy them.',
      hero: {who: 'uthros', deck: {label: 'tribute', name: 'The Uthros Combine', colors: 'U', list: `
2 Mechan Navigator
2 Illvoi Galeblade
2 Cerebral Download
1 Mental Modulation
3 Consult the Star Charts
2 Tractor Beam
4 Nanoform Sentinel
4 Codecracker Hound
4 Uthros Psionicist
4 Cloudsculpt Technician
4 Sinister Cryologist
4 Mechan Shieldmate
24 Island`}},
      villain: {who: 'tezzeret', deck: {label: 'tribute', name: "Tezzeret's Corsairs", colors: 'UB', list: `
3 Tezzeret, Cruel Captain
2 Desculpting Blast
1 Gravkill
4 Gravpack Monoist
4 Insatiable Skittermaw
4 Faller's Faithful
4 Comet Crawler
4 Nanoform Sentinel
4 Susurian Voidborn
4 Mechan Shieldmate
2 Beamsaw Prospector
12 Island
12 Swamp`}},
      scene: [q('uthros', 'The Uthros Combine\'s first question for any scientific breakthrough is always: "How can this be used to keep our next breakthrough secret?"'),
        s('uthros', 'Void turns on when something leaves play or a spell is warped. Plan the turn so it lands.')],
      villainScene: [q('tezzeret', 'Your atoms will serve my ambitions in a much more useful form.'),
        s('tezzeret', 'The Uthros Combine owes me a favor. I collect favors.')],
      cues: {hero: cue('Observe, and say nothing.', 'Cloudkill!', 'Their ship is in range...', 'Data secured.', 'Signal lost...', 'Make something leave play to light Void.'),
        villain: cue('Mine.', 'Atoms for ambition!', 'Annoying...', 'Collected.', 'Cursed...')}},
    {slot: 4, mood: 'tension', kind: 'Meta', title: 'The Sunstar Free Company', difficulty: 'Normal', rewardSet: 'eoe', teaches: ['Lifelink'],
      blurb: 'Light-forged knights of Sunstar against the faith that worships the dark between stars.',
      hero: {who: 'sunstar', deck: {label: 'tribute', name: 'The Sunstar Free Company', colors: 'W', list: `
3 Haliya, Guided by Light
3 Dawnstrike Vanguard
4 Radiant Strike
1 Honor
2 Banishing Light
3 Focus Fire
4 Exosuit Savior
4 Flight-Deck Coordinator
4 Dual-Sun Adepts
4 Honored Knight-Captain
4 Brightspear Zealot
24 Plains`}},
      villain: {who: 'alpharael', deck: {label: 'tribute', name: 'The Monoist Faith', colors: 'B', list: `
3 Alpharael, Stonechosen
4 Gravkill
3 Embrace Oblivion
3 Tragic Trajectory
2 Vote Out
4 Susurian Voidborn
4 Gravpack Monoist
4 Comet Crawler
4 Insatiable Skittermaw
4 Lightless Evangel
1 Beamsaw Prospector
24 Swamp`}},
      scene: [q('sunstar', 'Arrive as the dawn, and banish night through your brilliance!'),
        s('sunstar', 'Lifelink turns their damage into your life. Race, and win the exchange.')],
      villainScene: [q('alpharael', "All things end. I'd rather embrace that truth than the fantasy of eternal light."),
        s('alpharael', 'The Monoists fight a war of attrition. Victory is inevitable if they stay true.')],
      cues: {hero: cue('Arrive as the dawn.', 'Light!', 'The dark presses in...', 'The dawn holds.', 'The light goes out...', 'Gain life to stay ahead of the Faith.'),
        villain: cue('All things end.', 'Embrace it!', 'Not yet...', 'To the Zero Point.', 'The light...')}},
    {slot: 5, mood: 'comic', kind: 'Frontier', title: 'The Weft and the Wilds', difficulty: 'Normal', rewardSet: 'eoe', teaches: ['Reach'],
      blurb: 'Drix weftwalkers cross Evendo. The newly thawed wilds have teeth.',
      hero: {who: 'drix', deck: {label: 'tribute', name: 'The Drix Weavers', colors: 'GU', list: `
4 Genemorph Imago
4 Biomechan Engineer
3 Pull Through the Weft
3 Unravel
2 Biosynthic Burst
4 Codecracker Hound
4 Sinister Cryologist
4 Skystinger
4 Cloudsculpt Technician
4 Illvoi Operative
12 Forest
12 Island`}},
      villain: {who: 'wilds', deck: {label: 'tribute', name: 'The Wilds of Evendo', colors: 'G', list: `
2 Frenzied Baloth
2 Fungal Colossus
2 Hemosymbic Mite
4 Meltstrider Eulogist
4 Galactic Wayfarer
4 Thawbringer
4 Eumidian Terrabotanist
4 Skystinger
4 Drix Fatemaker
4 Blooming Stinger
2 Tapestry Warden
24 Forest`}},
      scene: [q('drix', 'That which should not have happened is undone, and a new pattern takes its place.'),
        s('drix', 'Reach lets a creature block fliers. The wilds have a lot of reach.')],
      villainScene: [q('wilds', "Oh, look at the size of those petals! That one's eaten well this season."),
        s('wilds', 'Evendo was frozen for ten thousand years. It is hungry.')],
      cues: {hero: cue('The pattern shifts.', 'Weft!', 'The wilds close in...', 'Pattern restored.', 'Lost in the weave...', 'Block fliers with reach.'),
        villain: cue('Hungry.', 'Bloom!', 'Cold again...', 'Fed.', 'Frozen...')}},
    {slot: 6, mood: 'boss', kind: 'Rival', title: 'The Zero Point', difficulty: 'Normal', rewardSet: 'eoe', teaches: ['Counterspells'],
      blurb: 'Pinnacle envoys and a fanatical knight argue about what the great destroyers left behind.',
      hero: {who: 'pinnacle', deck: {label: 'tribute', name: 'The Pinnacle Envoys', colors: 'UW', list: `
4 Mechan Shieldmate
4 Station Monitor
1 Banishing Light
4 Codecracker Hound
4 Nanoform Sentinel
4 Exosuit Savior
4 Uthros Psionicist
4 Flight-Deck Coordinator
4 Dual-Sun Adepts
3 Dockworker Drone
12 Island
12 Plains`}},
      villain: {who: 'syr', deck: {label: 'tribute', name: 'The Monoist Zealots', colors: 'BW', list: `
3 Syr Vondam, Sunstar Exemplar
2 Umbral Collar Zealot
1 Hardlight Containment
4 Insatiable Skittermaw
4 Flight-Deck Coordinator
4 Faller's Faithful
4 Exosuit Savior
4 Lightless Evangel
4 Rayblade Trooper
4 Comet Crawler
2 Brightspear Zealot
12 Swamp
12 Plains`}},
      scene: [q('pinnacle', 'Your ship and crew have been contaminated by the great destroyers. We cannot risk their spread. Prepare for unraveling.'),
        s('pinnacle', 'Counterspells answer a spell before it resolves. Hold the mana and choose your target.')],
      villainScene: [q('syr', 'A new dawn, burning away the darkness.'),
        s('syr', 'Death is a trick of the light. Snuff it out and discover immortality.')],
      cues: {hero: cue('Hold the line.', 'Unravel it!', 'They are pushing through...', 'Contained.', 'Contamination...', 'Counter the big threat.'),
        villain: cue('Burn it all.', 'The Zero Point!', 'Doubt...', 'Light.', 'Dark.')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'The Kav Reckoning', difficulty: 'Hard', rewardSet: 'eoe', teaches: ['Playing around counterspells'],
      blurb: 'The last Kav war host runs into the Illvoi and a very patient wall of counters.',
      hero: {who: 'reckoning', deck: {label: 'tribute', name: 'The Kav Reckoning', colors: 'RB', list: `
3 Mutinous Massacre
4 Blade of the Swarm
4 Plasma Bolt
3 Weapons Manufacturing
2 Pain for All
4 Susurian Voidborn
4 Gravpack Monoist
4 Weftstalker Ardent
4 Faller's Faithful
4 Frontline War-Rager
12 Mountain
12 Swamp`}},
      villain: {who: 'illvoi', deck: {label: 'tribute', name: 'The Illvoi Control', colors: 'UW', list: `
2 Cryoshatter
1 Unravel
3 Mechan Assembler
4 Dual-Sun Adepts
4 Nanoform Sentinel
4 Rayblade Trooper
4 Cloudsculpt Technician
4 Codecracker Hound
4 Flight-Deck Coordinator
4 Exosuit Savior
2 Steelswarm Operator
12 Island
12 Plains`}},
      scene: [q('reckoning', 'The Kav have more than ideology or profit on the line. They fight for a home.'),
        s('reckoning', 'Illvoi control holds counters. Bait with a small spell first, then land the big one.')],
      villainScene: [q('illvoi', 'Illvoi hope for the best outcomes but engineer for the worst.'),
        s('illvoi', 'Every spell cast into the dark is a spell we can undo.')],
      cues: {hero: cue('Give everything.', 'Break the wall!', 'They counter everything...', 'For Kavaron.', 'Another world lost...', 'Bait first, then land the big spell.'),
        villain: cue('Engineered.', 'Annul!', 'Contingency...', 'As planned.', 'Unplanned...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Sothera, the Supervoid', difficulty: 'Hard', rewardSet: 'eoe', teaches: ['Deathtouch'],
      blurb: 'Alliance against the supervoid: Sunstar light, Kav grit and one dying star.',
      hero: {who: 'alliance', deck: {label: 'tribute', name: 'The Edge Alliance', colors: 'RW', list: `
3 Haliya, Guided by Light
3 Honored Knight-Captain
3 Sami, Wildcat Captain
2 Tannuk, Steadfast Second
2 Radiant Strike
1 Plasma Bolt
4 Rayblade Trooper
4 Exosuit Savior
4 Flight-Deck Coordinator
4 Frontline War-Rager
4 Brightspear Zealot
2 Molecular Modifier
12 Mountain
12 Plains`}},
      villain: {who: 'sothera', deck: {label: 'tribute', name: 'The Supervoid', colors: 'B', list: `
3 Alpharael, Stonechosen
3 Sothera, the Supervoid
3 Xu-Ifit, Osteoharmonist
4 Faller's Faithful
3 Gravkill
3 Tragic Trajectory
2 Depressurize
4 Susurian Voidborn
4 Virus Beetle
4 Lightless Evangel
3 Comet Crawler
24 Swamp`}},
      scene: [q('haliya', 'Beyond the edge of faith lies eternal hope.'),
        q('sunstar', "A new dawn, burning away the darkness."),
        s('haliya', 'Deathtouch kills anything it damages. Trade your small creatures for their big ones.')],
      villainScene: [q('sothera', 'Rejoice! For within sekhar, the final sacrifice, you will find passage to the Next Eternity.'),
        s('sothera', 'The supervoid does not hate you. It is simply where everything ends up.')],
      cues: {hero: cue('Light be with us.', 'For the Edge!', 'The void is pulling us in...', 'Dawn.', 'Into the dark...', 'Trade small for big. Do not feed the void.'),
        villain: cue('All is the void.', 'Sekhar!', 'It resists...', 'The Zero Point.', 'The light...')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Infinite Guideline Station', difficulty: 'Hard', rewardSet: 'eoe', rewardCard: 'Infinite Guideline Station', mood: 'boss',
      teaches: ['Menace'],
      archive: {deck: 'The Station Monitors', when: 'Summer 2025', format: 'Story archive, no tournament list.',
        what: 'A blue-white fleet of Station Monitors and Mechan from the set, a hub of the Edge that never sleeps.',
        why: 'It stands for the station at the heart of the story and is not a list anyone won with.',
        beat: 'Race it before the Mechan stack up, and keep removal for the big ship.',
        after: 'Nothing; this is the optional superboss at the end of the story.'},
      blurb: 'The station at the heart of the Edge has one more watch to keep.',
      hero: {who: 'tannuk', deck: {label: 'tribute', name: 'The Liberation Crew', colors: 'GR', list: `
3 Tannuk, Memorial Ensign
4 Plasma Bolt
3 Seedship Impact
3 Biosynthic Burst
2 Sami's Curiosity
4 Galactic Wayfarer
4 Broodguard Elite
4 Blooming Stinger
4 Skystinger
4 Eumidian Terrabotanist
1 Zookeeper Mechan
12 Forest
12 Mountain`}},
      villain: {who: 'station', deck: {label: 'tribute', name: 'The Station Monitors', note: 'Built from cards in this act\'s set only. No tournament list is copied.', colors: 'UW', list: `
4 Station Monitor
4 Mechan Assembler
4 Selfcraft Mechan
3 Mechan Shieldmate
3 Specimen Freighter
2 Starwinder
4 Brightspear Zealot
4 Uthros Psionicist
4 Exosuit Savior
4 Sinister Cryologist
12 Island
12 Plains`}},
      scene: [q('tannuk', "We're a few bones short of a skeleton crew, Sami, but we've got plenty of spine."),
        s('station', 'Keeping tabs on a whole station is too much for just one.')],
      villainScene: [q('station', 'Keeping tabs on a whole station is too much for just one.')],
      cues: {hero: cue('Crew, to the station.', 'Break it open!', 'There are too many...', 'Station cleared.', 'Locked out...', 'Race it before the Mechan stack up.'),
        villain: cue('Monitoring.', 'Lockdown!', 'Fault detected...', 'Secured.', 'Breach...')},
      after: [s('stage', 'Recorded: the station goes quiet. The Edge of Eternities lies behind you.')]},
  ],
};
