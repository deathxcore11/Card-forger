// Act 38: The Great Race (Aetherdrift, Tarkir: Dragonstorm). Story and dialogue:
// /mnt/project-files/story/act-38-script.md (generated from this file). Land set: dft.
// A race across planes, then Tarkir's dragonstorms return. Every quoted line is real flavor text from these sets; unquoted
// lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'great-race-dragonstorm',
  era: '2025-02-14',
  intro: [q('stage', 'Stage 1: The winding streets of Ghirapur.'),
    s('stage', 'A race across the Multiverse. Then, after the finish line, Tarkir\'s dragonstorms come back.')],
  finale: [q('stage', 'With a swift motion Narset struck Sarkhan down. She would not let his fevered dreams of draconic dominance come to fruition. Not after all she had done to free Tarkir.'),
    s('stage', 'The storms calm. Sarkhan is free, and he is still dangerous.'),
    s('stage', 'Recorded: the race is over. The planes are still where they were.')],
  villainFinale: [q('stage', 'With Taigam whispering encouragement in his ear, Sarkhan threw aside his misgivings. The ritual would return him to his former glory. All he needed was a dragon\'s heart.'),
    s('stage', 'In this version, Sarkhan feeds the storms until Tarkir is all dragons.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Ticket Tortoise'},
    chandra: {name: 'Chandra', title: 'Racer of Ghirapur', card: 'Chandra, Spark Hunter', focus: '50% 25%'},
    racers: {name: 'The Aetherdrift Racers', title: 'Of the Grand Prix', card: 'Gas Guzzler', focus: '50% 30%'},
    demons: {name: 'The Speed Demons', title: 'Of the Race', card: 'The Speed Demon', focus: '50% 25%'},
    ketramose: {name: 'Ketramose', title: 'The New Dawn', card: 'Ketramose, the New Dawn', focus: '50% 25%'},
    elspeth: {name: 'Elspeth', title: 'Storm Slayer', card: 'Elspeth, Storm Slayer', focus: '50% 25%'},
    pit: {name: 'The Amonkhet Pit Crew', title: 'Of the Race', card: 'Zahur, Glory\'s Past', focus: '50% 30%'},
    skies: {name: 'The Skyfarers', title: 'Of Tarkir', card: 'Mu Yanling, Wind Rider', focus: '50% 25%'},
    storms: {name: 'The Dragonstorms', title: 'Of Tarkir', card: 'Boulderborn Dragon', focus: '50% 25%'},
    narset: {name: 'Narset', title: 'Jeskai Waymaster', card: 'Narset, Jeskai Waymaster', focus: '50% 25%'},
    clans: {name: 'Sarkhan\'s Clans', title: 'Of Tarkir', card: 'Surrak, Elusive Hunter', focus: '50% 25%'},
    red: {name: 'Mono-Red Aggro', title: 'Spring 2025', card: 'Cori-Steel Cutter', focus: '50% 30%'},
    domain: {name: 'Domain Ramp', title: 'Spring 2025', card: 'Terrian, World Tyrant', focus: '50% 25%'},
    izzet: {name: 'Izzet Prowess', title: 'Spring 2025', card: 'Shocking Sharpshooter', focus: '50% 30%'},
    dimir: {name: 'Dimir Midrange', title: 'Spring 2025', card: 'Gonti, Night Minister', focus: '50% 25%'},
    allies: {name: 'The Racers and the Clans', title: 'United', card: 'Ugin, Eye of the Storms', focus: '50% 25%'},
    sarkhan: {name: 'Sarkhan', title: 'Dragon Ascendant', card: 'Sarkhan, Dragon Ascendant', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Start Your Engines', difficulty: 'Easy', rewardSet: 'dft', teaches: ['Max speed'],
      blurb: 'Chandra races through Ghirapur. The other drivers are not here to be friends.',
      hero: {who: 'chandra', deck: {label: 'tribute', name: 'Chandra\'s Racers', colors: 'R', list: `
4 Greasewrench Goblin
4 Dynamite Diver
4 Burnout Bashtronaut
4 Draconautics Engineer
4 Prowcatcher Specialist
4 Adrenaline Jockey
3 Chandra, Spark Hunter
3 Gastal Thrillroller
4 Lightning Strike
2 Fuel the Flames
24 Mountain`}},
      villain: {who: 'racers', deck: {label: 'tribute', name: 'The Aetherdrift Racers', colors: 'UB', list: `
4 Engine Rat
4 Gas Guzzler
4 Deathless Pilot
4 Skystreak Engineer
4 Midnight Mangler
4 Keen Buccaneer
3 Gastal Raider
3 Haunted Hellride
3 Spin Out
3 Roadside Blowout
4 Dismal Backwater
10 Island
10 Swamp`}},
      scene: [q('stage', 'Racers! Start! Your! Engiiiiiines!'),
        q('stage', 'Loot is free to go where he wants, so let\'s make sure the kid gets there in one piece.'),
        s('chandra', 'Start your engines: your speed starts at 1 and rises when opponents lose life. At max speed, your cards get their best effects.')],
      villainScene: [q('stage', 'Caution is for those who falter.'),
        q('stage', 'Amonkhet champions become markedly more reckless after dying.')],
      cues: {hero: cue('Engines on.', 'Max speed!', 'They are ahead...', 'Pole position.', 'Out of the race...', 'Make them lose life to raise your speed.'),
        villain: cue('Floor it.', 'Overtake!', 'Spun out...', 'First place.', 'Wrecked...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'One-Shot Powers', difficulty: 'Easy', rewardSet: 'dft', teaches: ['Exhaust'],
      blurb: 'The Speed Demons race against Ketramose\'s team of Amonkhet champions.',
      hero: {who: 'demons', deck: {label: 'tribute', name: 'The Speed Demons', colors: 'BR', list: `
3 The Speed Demon
3 Apocalypse Runner
2 Coalstoke Gearhulk
4 Gastal Thrillseeker
4 Wild Ride
4 Hellish Sideswipe
4 Maximum Overdrive
4 Momentum Breaker
4 Skycrash
4 Howlsquad Heavy
4 Bloodfell Caves
10 Swamp
10 Mountain`}},
      villain: {who: 'ketramose', deck: {label: 'tribute', name: 'Ketramose\'s Champions', colors: 'WB', list: `
4 Dune Drifter
4 Zahur, Glory's Past
3 Ketramose, the New Dawn
4 Embalmed Ascendant
4 Hardened Tactician
4 Wreckage Wickerfolk
4 Interface Ace
4 Spotcycle Scouter
3 Roadside Assistance
2 Collision Course
4 Scoured Barrens
10 Plains
10 Swamp`}},
      scene: [q('stage', 'Good sportsmanship wins the crowd. Bad sportsmanship wins the race.'),
        q('stage', 'Many brought weapons to the race. This crew built theirs as they went.'),
        s('demons', 'Exhaust: an ability that can be used once and then is gone. Save it for the turn that matters.')],
      villainScene: [q('stage', 'Let the past die so the future might live.'),
        q('stage', 'They too deserve to witness Amonkhet\'s rebirth.')],
      cues: {hero: cue('Fastest wins.', 'Exhaust!', 'Their champions are strong...', 'The demon wins.', 'Slowed...', 'Use your exhaust ability on the key turn.'),
        villain: cue('A new dawn.', 'Rise!', 'The champions stall...', 'Amonkhet lives.', 'The dawn fades...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Mardu Charge', difficulty: 'Easy', rewardSet: 'tdm', teaches: ['Mobilize'],
      blurb: 'Elspeth\'s warriors charge past Ketramose\'s pit crew.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'Elspeth\'s Warriors', colors: 'W', list: `
4 Descendant of Storms
3 Mardu Devotee
4 Bearer of Glory
4 Furious Forebear
4 Voice of Victory
4 Fortress Kin-Guard
1 Elspeth, Storm Slayer
4 Clarion Conqueror
4 Sage of the Skies
4 Coordinated Maneuver
24 Plains`}},
      villain: {who: 'pit', deck: {label: 'tribute', name: 'The Amonkhet Pit Crew', colors: 'WB', list: `
4 Gas Guzzler
4 Engine Rat
4 Wreckage Wickerfolk
4 Mutant Surveyor
4 Gastal Raider
4 Pactdoll Terror
2 Streaking Oilgorger
3 Risen Necroregent
3 Quag Feast
4 Zahur, Glory's Past
4 Scoured Barrens
10 Plains
10 Swamp`}},
      scene: [q('stage', 'We follow the dragonstorms, and we take down any threats that emerge from them!'),
        q('stage', 'Mardu lightning rods disperse the energy of dragonstorms—or whatever happens to be touching the rods.'),
        s('elspeth', 'Mobilize: when the creature attacks, make tapped, attacking warrior tokens. A wide swing from one card.')],
      villainScene: [q('stage', 'Wherever the racers go, help follows.'),
        q('stage', 'To keep up with the Grand Prix, reporters trained just as hard as the racers themselves.')],
      cues: {hero: cue('Charge!', 'Mobilize!', 'The pit crew holds...', 'The Mardu win.', 'Overrun...', 'Attack with a mobilize creature for extra bodies.'),
        villain: cue('Pit stop!', 'Go!', 'The crew stalls...', 'Quick work.', 'Out of time...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Speed Demon', difficulty: 'Normal', rewardSet: 'dft', teaches: ['Counterspells'],
      blurb: 'The race\'s devil takes the wheel. The skyfarers have the speed to meet it in the air.',
      hero: {who: 'skies', deck: {label: 'tribute', name: 'The Skyfarers', colors: 'WU', list: `
4 Scrounging Skyray
4 Rangers' Refueler
4 Mindspring Merfolk
4 Transit Mage
3 Glitch Ghost Surveyor
4 Skyseer's Chariot
4 Cloudspire Captain
3 Mu Yanling, Wind Rider
3 Spell Pierce
3 Spectral Denial
4 Tranquil Cove
10 Plains
10 Island`}},
      villain: {who: 'demons', deck: {label: 'tribute', name: 'The Speed Demon\'s Pack', colors: 'BR', list: `
4 Engine Rat
4 Gas Guzzler
4 Bloodghast
3 The Speed Demon
3 Apocalypse Runner
4 Gastal Thrillseeker
4 Hellish Sideswipe
4 Lightning Strike
3 Crash and Burn
3 Intimidation Tactics
4 Bloodfell Caves
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'Each step we take is a decision that changes the course of our futures. We must be careful where we tread.'),
        q('stage', 'This can\'t be right. I should cross-reference with the archives immediately.'),
        s('skies', 'Hold your counterspells for the Speed Demon itself. Let the smaller cars through.')],
      villainScene: [q('stage', 'The doomed souls of the Speed Demons race in uneasy unity, each one hoping to escape their own fate.'),
        q('stage', 'Speedbrood racers are gregarious while not racing, but everyone must eat.')],
      cues: {hero: cue('Careful now.', 'Denied!', 'The demon is fast...', 'The demon is stopped.', 'Run over...', 'Hold counters for the big car.'),
        villain: cue('Floor it.', 'Burn rubber!', 'The engine stalls...', 'The devil wins.', 'Spun out...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Spells from the Grave', difficulty: 'Normal', rewardSet: 'tdm', teaches: ['Harmonize'],
      blurb: 'Narset\'s school fights Sarkhan\'s clans across the dragonstorm plains.',
      hero: {who: 'narset', deck: {label: 'tribute', name: 'Narset\'s School', note: 'Jeskai is three colours; the white is dropped for our land pool.', colors: 'UR', list: `
4 Shocking Sharpshooter
4 Cori-Steel Cutter
4 Jeskai Devotee
3 Fearless Swashbuckler
2 Captain Howler, Sea Scourge
4 Dragonologist
3 Magmatic Hellkite
4 Ureni's Rebuff
4 Twin Bolt
4 Fire-Rim Form
4 Swiftwater Cliffs
10 Island
10 Mountain`}},
      villain: {who: 'clans', deck: {label: 'tribute', name: 'Sarkhan\'s Clans', colors: 'RG', list: `
4 Beastrider Vanguard
4 Ainok Wayfarer
4 Undergrowth Leopard
4 Zurgo's Vanguard
4 Krotiq Nestguard
3 Surrak, Elusive Hunter
3 Devoted Duelist
3 Shock Brigade
4 Lightning Strike
3 Piercing Exhale
4 Rugged Highlands
10 Mountain
10 Forest`}},
      scene: [q('stage', 'Beware dragonstorms that strike from the sea. Their size always disguises their force.'),
        q('stage', 'No one of us could have built all this alone. A clan, a school, hope for the future. Thank you all.'),
        s('narset', 'Harmonize: cast a spell from your graveyard by paying its harmonize cost. Your old spells are not gone.')],
      villainScene: [q('stage', 'The best way to protect the citizens is to defend Arashin, not hunt dragonstorms across Tarkir.'),
        q('stage', 'So, these dragons intend to also manifest through a sandstorm? I take some offense to that.')],
      cues: {hero: cue('Study the storm.', 'Harmonize!', 'The clans hit hard...', 'The school wins.', 'Scattered...', 'Recast a spell from the graveyard.'),
        villain: cue('For the clan!', 'Charge!', 'The clan breaks...', 'The clans stand.', 'Scattered...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Mono-Red vs Domain', difficulty: 'Normal', rewardSet: 'dft', teaches: ['Menace'],
      blurb: 'Spring 2025: mono-red aggro against a big green ramp deck.',
      hero: {who: 'red', deck: {label: 'tribute', name: 'Mono-Red Aggro', colors: 'R', archetype: 'Aggro', list: `
4 Greasewrench Goblin
4 Dynamite Diver
4 Burnout Bashtronaut
4 Draconautics Engineer
4 Prowcatcher Specialist
4 Adrenaline Jockey
3 Chandra, Spark Hunter
3 Gastal Thrillroller
4 Lightning Strike
2 Fuel the Flames
24 Mountain`}},
      villain: {who: 'domain', deck: {label: 'tribute', name: 'Domain Ramp', note: 'Domain Ramp is five colours; here the green ramp core is kept for our land pool.', colors: 'G', archetype: 'Ramp', list: `
4 Stampeding Scurryfoot
4 Molt Tender
4 Jibbirik Omnivore
4 Greenbelt Guardian
2 Regal Imperiosaur
3 Terrian, World Tyrant
1 Autarch Mammoth
3 Migrating Ketradon
4 Run Over
3 Point the Way
2 Beastrider Vanguard
2 Venomsac Lagac
24 Forest`}},
      scene: [q('stage', 'You wanted a fight. Now you\'ve got two.'),
        q('stage', 'They feed on OIL? Where were they during the Phyrexian Invasion?!'),
        s('red', 'Race them. Their big creatures arrive late. Burn them out first.')],
      villainScene: [q('stage', 'The draconic power that flowed out from the dragonstorms imbued the landscape with draconic features—scales, claws, and appetites.'),
        q('stage', 'The power of the dragonstorms transformed not only the land but many of the creatures within it.')],
      cues: {hero: cue('Fast and hot.', 'Burn!', 'Their big ones landed...', 'Burned out.', 'Too slow...', 'Go face before the ramp deck lands anything.'),
        villain: cue('Grow.', 'Stomp!', 'Out of mana...', 'The ramp wins.', 'Stomped on...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Izzet vs Dimir', difficulty: 'Normal', rewardSet: 'tdm', teaches: ['Tempo'],
      blurb: 'Spring 2025: Izzet prowess against a Dimir midrange deck.',
      hero: {who: 'izzet', deck: {label: 'tribute', name: 'Izzet Prowess', colors: 'UR', archetype: 'Aggro', list: `
4 Shocking Sharpshooter
4 Cori-Steel Cutter
4 Jeskai Devotee
4 Roiling Dragonstorm
2 Captain Howler, Sea Scourge
3 Magmatic Hellkite
3 Fearless Swashbuckler
4 Twin Bolt
4 Fire-Rim Form
4 Dragonologist
4 Swiftwater Cliffs
10 Island
10 Mountain`}},
      villain: {who: 'dimir', deck: {label: 'tribute', name: 'Dimir Midrange', colors: 'UB', archetype: 'Midrange', list: `
1 Bloodghast
4 Gastal Raider
3 Gonti, Night Minister
2 Haunted Hellride
3 Haunt the Network
4 Mutant Surveyor
4 Spell Pierce
3 Spin Out
2 Aether Syphon
3 Quag Feast
2 Wreckage Wickerfolk
3 Deathless Pilot
2 Engine Rat
4 Dismal Backwater
10 Island
10 Swamp`}},
      scene: [q('stage', 'Excellent form, Jun! Just keep your weight on that back foot, and you\'ll master this in no time.'),
        q('stage', 'Elegance. Precision. Grace. Qualities that must be practiced in writing as well as combat.'),
        s('izzet', 'Cast cheap spells to pump your creatures, and hit before their removal lines up.')],
      villainScene: [q('stage', 'Their race ended much the same way it began, walking through a sandstorm on a world that ended long ago.'),
        q('stage', 'At the Tombs Before Time, the living of Amonkhet made vital alliances with the honored dead.')],
      cues: {hero: cue('Quick hands.', 'Prowess!', 'Their removal is good...', 'Quick win.', 'Outlasted...', 'Cast cheap spells to pump your creatures.'),
        villain: cue('Patience.', 'Drain!', 'The tempo is gone...', 'Dimir wins.', 'Outraced...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Sarkhan, Dragon Ascendant', difficulty: 'Hard', rewardSet: 'tdm', teaches: ['Flying'],
      blurb: 'Sarkhan feeds the dragonstorms because he believes he is saving the dragons. The racers and the clans have to stop him.',
      hero: {who: 'allies', deck: {label: 'tribute', name: 'The Racers and the Clans', colors: 'RG', list: `
4 Beastrider Vanguard
4 Ainok Wayfarer
4 Undergrowth Leopard
4 Zurgo's Vanguard
4 Krotiq Nestguard
3 Surrak, Elusive Hunter
3 Sagu Pummeler
3 Magmatic Hellkite
4 Lightning Strike
3 Piercing Exhale
4 Rugged Highlands
10 Mountain
10 Forest`}},
      villain: {who: 'sarkhan', deck: {label: 'tribute', name: 'Sarkhan\'s Dragons', colors: 'R', list: `
3 Sarkhan, Dragon Ascendant
4 Magmatic Hellkite
3 Stormscale Scion
4 Runescale Stormbrood // Chilling Screech
4 Breaching Dragonstorm
4 Molten Exhale
4 Twin Bolt
4 Lightning Strike
3 Fire-Rim Form
3 Channeled Dragonfire
24 Mountain`}},
      scene: [q('stage', 'Elspeth saw their capture as an inconvenience, costing them precious time. Narset saw it as an opportunity to recruit allies to their cause.'),
        q('stage', 'The Abzan forces rallied to the call, driving back Sarkhan\'s feral dragon horde.'),
        s('allies', 'Kill his dragons the turn they land. He feeds the storm only as long as they live.')],
      villainScene: [q('stage', 'Let the dragonstorms rage. Let what seeks sustenance feed. Let Tarkir be what it was always meant to be.'),
        q('stage', 'Rage. Greed. Arrogance. People only accuse dragons of what they fear in themselves.')],
      cues: {hero: cue('For Tarkir!', 'Together!', 'The storm is too big...', 'The storm calms.', 'Swallowed...', 'Kill his dragons the turn they land.'),
        villain: {...cue('Rage.', '[a dragon roars]', '[the roar breaks]', 'Tarkir is what it was meant to be.', '[the storm goes quiet]'),
          half: {who: 'narset', line: 'You are not saving them, Sarkhan. You are feeding on them.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Izzet Prowess at Full Power', difficulty: 'Hard', rewardSet: 'tdm', rewardCard: 'Cori-Steel Cutter', mood: 'boss',
      teaches: ['Tempo'],
      archive: {deck: 'Izzet Prowess', when: 'Spring 2025', format: 'Standard.',
        what: 'A blue-red deck of cheap creatures and cheap spells built around Cori-Steel Cutter.',
        why: 'It was fast, hard to disrupt, and punished slow hands.',
        beat: 'Kill the first two creatures. Keep your life above burn range.',
        after: 'Later sets gave the format more removal and slowed it down.'},
      blurb: 'Deep in the archive, a deck that wins with spells cast and creatures attacking.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Ketramose\'s Champions', colors: 'WB', list: `
4 Dune Drifter
4 Zahur, Glory's Past
3 Ketramose, the New Dawn
4 Embalmed Ascendant
4 Hardened Tactician
4 Wreckage Wickerfolk
4 Interface Ace
4 Spotcycle Scouter
3 Roadside Assistance
2 Collision Course
4 Scoured Barrens
10 Plains
10 Swamp`}},
      villain: {who: 'izzet', deck: {label: 'tribute', name: 'Izzet Prowess', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'UR', archetype: 'Aggro', list: `
4 Shocking Sharpshooter
4 Cori-Steel Cutter
4 Jeskai Devotee
4 Roiling Dragonstorm
4 Ureni's Rebuff
4 Dispelling Exhale
4 Twin Bolt
4 Fire-Rim Form
4 Dragonologist
4 Swiftwater Cliffs
10 Island
10 Mountain`}},
      scene: [q('stage', 'Jeskai scholars fashioned devices to forecast the behavior of the dragonstorms.'),
        s('you', 'Kill the first two creatures and keep your life high.')],
      villainScene: [q('stage', 'Dragonstorm chasers are not deterred by danger—they claim there is nothing like witnessing the land embracing the power of a storm.')],
      cues: {hero: cue('Hold the line.', 'Strike back!', 'They are fast...', 'The prowess fades.', 'Overrun...', 'Kill the first two creatures.'),
        villain: cue('[a flash of lightning]', '[the spells stack]', '[a pause]', '[prowess]', '[the spells fizzle]')},
      after: [s('stage', 'Recorded: later sets gave the format more removal and slowed it down.')]},
  ],
};
