// Act 23: The Gatewatch Rises (Magic Origins, Battle for Zendikar, Oath of the Gatewatch). Story and dialogue:
// /mnt/project-files/story/act-23-script.md (generated from this file). Land set: bfz (Wastes come from ogw).
// Act 17 ended with Ulamog and Kozilek free on Zendikar. Now they are eating it. Gideon, Jace, Nissa and Chandra each
// have their own origin and their own reasons, and at the ruins of Sea Gate they swear an oath to keep watch over the
// Multiverse. Jace finds the leyline pattern that binds the titans, Nissa traces it, and Chandra burns them away.
// Emrakul, the third titan, is missing. Every quoted line is real flavor text from these three sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'gatewatch-zendikar-ruin',
  era: '2016-01-22',
  intro: [s('stage', 'Zendikar. Act 17 ended with the Eldrazi titans set free. Ulamog and Kozilek have spent the years since eating the world.'),
    q('stage', 'The continent of Bala Ged was ravaged by massive Eldrazi of Ulamog\'s lineage, its lush jungles and cascading rivers reduced to dust.'),
    q('stage', '"Sea Gate has fallen. Survivors are on the move. Will send another griffin when we find refuge. Stay hidden. Stay safe."'),
    s('stage', 'Four planeswalkers are coming, each from a different world, each for a different reason.')],
  finale: [q('stage', 'Jace discovered the leyline pattern needed to anchor Ulamog and Kozilek to reality, but it was Nissa who could trace it on her world.'),
    q('stage', 'As Gideon kept the brood lineages at bay, Chandra incinerated the bound Eldrazi titans.'),
    q('gideon', 'For justice and peace, I will keep watch.'),
    q('jace', 'For the sake of the Multiverse, I will keep watch.'),
    q('nissa', 'For the life of every plane, I will keep watch.'),
    q('chandra', 'If it means that people can live in freedom, yeah, I\'ll keep watch.'),
    s('stage', 'Two titans are ash. The third, Emrakul, is not on Zendikar at all. Nobody knows where she went.')],
  villainFinale: [s('stage', 'The leylines slip. The titans walk on.'),
    q('stage', 'Dust and memory are all that remain in Ulamog\'s wake.'),
    q('kalitas', 'No matter how big your champion, theirs is bigger. No matter how great your numbers, theirs are greater. No matter how voracious your appetite, they are hungrier. That is why the Eldrazi will win.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Call the Gatewatch'},
    gideon: {name: 'Gideon Jura', title: 'Ally of Zendikar', card: 'Gideon, Ally of Zendikar', focus: '50% 25%'},
    drones: {name: 'Ulamog\'s Brood', title: 'Eldrazi', card: 'Eyeless Watcher', focus: '50% 30%'},
    nissa: {name: 'Nissa Revane', title: 'Voice of Zendikar', card: 'Nissa, Voice of Zendikar', focus: '50% 25%'},
    lineage: {name: 'The Brood Lineage', title: 'Eldrazi', card: 'Brood Butcher', focus: '50% 30%'},
    jace: {name: 'Jace Beleren', title: 'Of Vryn', card: 'Jace, Vryn\'s Prodigy', focus: '50% 25%'},
    alhammarret: {name: 'Alhammarret', title: 'High Arbiter', card: 'Alhammarret, High Arbiter', focus: '50% 25%'},
    chandra: {name: 'Chandra Nalaar', title: 'Flamecaller', card: 'Chandra, Flamecaller', focus: '50% 25%'},
    ob: {name: 'Ob Nixilis', title: 'Reignited', card: 'Ob Nixilis Reignited', focus: '50% 25%'},
    kiora: {name: 'Kiora', title: 'Master of the Depths', card: 'Kiora, Master of the Depths', focus: '50% 25%'},
    surge: {name: 'Kozilek\'s Brood', title: 'Eldrazi', card: 'Herald of Kozilek', focus: '50% 30%'},
    ramp: {name: 'Eldrazi Ramp', title: 'Late 2015', card: 'Ulamog, the Ceaseless Hunger', focus: '50% 30%'},
    allies: {name: 'Allies', title: 'Late 2015', card: 'General Tazri', focus: '50% 25%'},
    thopters: {name: 'Thopters', title: '2015', card: 'Pia and Kiran Nalaar', focus: '50% 25%'},
    drana: {name: 'Drana', title: 'Liberator of Malakir', card: 'Drana, Liberator of Malakir', focus: '50% 25%'},
    kalitas: {name: 'Kalitas', title: 'Thrall of Ulamog', card: 'Kalitas, Traitor of Ghet', focus: '50% 25%'},
    titans: {name: 'Ulamog and Kozilek', title: 'Eldrazi titans', card: 'Kozilek, the Great Distortion', focus: '50% 30%'},
    winter: {name: 'Eldrazi Winter', title: 'Early 2016', card: 'Thought-Knot Seer', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Fall of Sea Gate', difficulty: 'Easy', rewardSet: 'bfz', teaches: ['Ingest'],
      blurb: 'You arrive on the coast of Tazeem as Sea Gate, the great lighthouse city, falls to Ulamog\'s brood. Gideon Jura is leading the survivors out with a line of kor and human Allies.',
      hero: {who: 'gideon', deck: {label: 'tribute', name: 'The Sea Gate Allies', colors: 'W', list: `
2 Gideon, Ally of Zendikar
4 Expedition Envoy
4 Kor Bladewhirl
4 Makindi Patrol
4 Lantern Scout
4 Ondu Greathorn
4 Kor Castigator
3 Gideon's Reproach
3 Shoulder to Shoulder
4 Felidar Cub
24 Plains`}},
      villain: {who: 'drones', deck: {label: 'tribute', name: 'Ulamog\'s Brood', colors: 'UB', list: `
4 Mist Intruder
4 Benthic Infiltrator
4 Culling Drone
4 Salvage Drone
4 Dominator Drone
3 Ulamog's Reclaimer
4 Eldrazi Skyspawner
3 Murk Strider
3 Ulamog's Nullifier
3 Sludge Crawler
12 Island
12 Swamp`}},
      scene: [q('stage', 'Though Gideon arrived at Sea Gate too late to prevent the massacre, he still had enough time to lead its survivors to relative safety.'),
        q('gideon', 'For the lands you have lost and the beauty that remains, for freedom and the future, we must hold nothing back!'),
        s('gideon', 'Ingest: when an ingest creature deals combat damage to you, you exile the top card of your library. Processors then use those exiled cards. Block the small ones.')],
      villainScene: [q('stage', 'Every Eldrazi in Ulamog\'s lineage is an extension of the titan\'s will.'),
        q('stage', 'Ulamog\'s progeny swarm the land, draining Zendikar\'s mana to feed the titan\'s insatiable hunger.')],
      cues: {hero: cue('Hold the line!', 'Allies, now!', 'They keep coming...', 'Sea Gate stands.', 'Fall back...', 'Block the ingest drones.'),
        villain: cue('[a hum from the deep]', '[the brood surges]', '[a drone dissolves]', '[consumed]', '[the hum fades]')},
      after: [s('gideon', 'We need more than soldiers. We need people who can leave this world and choose to stay.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Land Fights Back', difficulty: 'Easy', rewardSet: 'bfz', teaches: ['Awaken'],
      blurb: 'Nissa Revane is an elf animist who can wake the land itself. Zendikar is in pain, and she is the only one who can hear it.',
      hero: {who: 'nissa', deck: {label: 'tribute', name: 'The Living Land', colors: 'G', list: `
2 Nissa, Vastwood Seer
4 Snapping Gnarlid
4 Undergrowth Champion
4 Scythe Leopard
3 Oran-Rief Hydra
4 Territorial Baloth
4 Earthen Arms
3 Retreat to Kazandu
4 Lifespring Druid
4 Tajuru Stalwart
24 Forest`}},
      villain: {who: 'lineage', deck: {label: 'tribute', name: 'The Brood Lineage', colors: 'BG', list: `
3 Brood Butcher
4 Catacomb Sifter
3 Brood Monitor
4 Blisterpod
4 Eyeless Watcher
4 Carrier Thrall
4 Culling Drone
3 Call the Scions
3 Grasp of Darkness
4 Vile Redeemer
12 Swamp
12 Forest`}},
      scene: [q('nissa', 'I was wrong. Zendikar isn\'t after me. It isn\'t after any of us. It\'s not evil or vengeful. It\'s magnificent . . . but it\'s in pain.'),
        q('nissa', 'The land will not wait for the enemy to arrive.'),
        s('nissa', 'Awaken: cast the spell for its awaken cost and one of your lands also becomes a 0/0 Elemental creature with that many +1/+1 counters. It is still a land.')],
      villainScene: [q('stage', 'Ulamog\'s processors trail behind him, converting ruined matter into furious energy.'),
        q('nissa', 'In the dark places of our world, something horrible is growing. I fear our foes may be more numerous than we had imagined.')],
      cues: {hero: cue('Wake up.', 'The land rises!', 'It hurts...', 'Zendikar endures.', 'Dust...', 'Awaken a land.'),
        villain: cue('[the ground goes grey]', '[spawn]', '[a drone falls]', '[the forest is gone]', '[driven off]')},
      after: [q('nissa', 'This world tires of its long occupation.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Prodigy', difficulty: 'Easy', rewardSet: 'ori', teaches: ['Spell mastery'],
      blurb: 'Jace\'s origin: years ago on Vryn, a young mind mage worked for a sphinx called Alhammarret, who used him to spy on everyone. Jace has finally noticed.',
      hero: {who: 'jace', deck: {label: 'tribute', name: 'The Prodigy', colors: 'U', list: `
2 Jace, Vryn's Prodigy
2 Thopter Spy Network
4 Whirler Rogue
4 Separatist Voidmage
4 Calculated Dismissal
3 Anchor to the Aether
4 Faerie Miscreant
4 Watercourser
3 Mizzium Meddler
2 Psychic Rebuttal
4 Jhessian Thief
24 Island`}},
      villain: {who: 'alhammarret', deck: {label: 'tribute', name: 'The High Arbiter', colors: 'WU', list: `
2 Alhammarret, High Arbiter
2 Hixus, Prison Warden
4 Vryn Wingmare
4 Ringwarden Owl
4 Claustrophobia
4 Send to Sleep
4 Cloud Manta
4 Ampryn Tactician
4 Cleric of the Forward Order
4 Charging Griffin
12 Island
12 Plains`}},
      scene: [s('jace', 'He taught me everything. I am starting to wonder what else he took.'),
        s('jace', 'Spell mastery: some spells get a bonus if there are two or more instants or sorceries in your graveyard. Use cheap spells early, then cash in.')],
      villainScene: [q('alhammarret', 'As long as each side thinks it can win, the balance holds, and the mage-rings stand.')],
      cues: {hero: cue('I know what you did.', 'Mastery!', 'He is in my head...', 'Out of my mind.', 'Forgotten...', 'Two spells in the yard.'),
        villain: cue('Sit down, boy.', 'Arbitrated.', 'Ungrateful.', 'Forget.', 'Impossible.')},
      after: [s('stage', 'Jace remembers. Years later, a stranger called Gideon finds him on Ravnica and asks for his help on Zendikar.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Reignited', difficulty: 'Normal', rewardSet: 'bfz', teaches: ['Devoid'],
      blurb: 'Chandra Nalaar is a pyromancer who hates being told to stay. On Zendikar she finds Ob Nixilis, a demon who wants revenge on the world that took his spark long ago.',
      hero: {who: 'chandra', deck: {label: 'tribute', name: 'Chandra\'s Fire', colors: 'R', list: `
2 Chandra, Fire of Kaladesh
2 Chandra, Flamecaller
4 Abbot of Keral Keep
4 Exquisite Firecraft
4 Fiery Impulse
2 Akoum Hellkite
4 Valakut Predator
4 Lavastep Raider
3 Goblin Dark-Dwellers
4 Fiery Hellhound
3 Prickleboar
24 Mountain`}},
      villain: {who: 'ob', deck: {label: 'tribute', name: 'The Demon\'s Bargain', colors: 'B', list: `
2 Ob Nixilis Reignited
4 Grasp of Darkness
4 Ruinous Path
2 Demon's Grasp
2 Remorseless Punishment
4 Altar's Reap
2 Kothophed, Soul Hoarder
4 Despoiler of Souls
2 Erebos's Titan
4 Priest of the Blood Rite
4 Fleshbag Marauder
2 Dread Defiler
24 Swamp`}},
      scene: [q('chandra', 'I hope to meet Jaya Ballard someday. I think we\'d get along.'),
        s('chandra', 'Devoid: these cards have colour in their cost but no colour. Anything that cares about colour, like protection from black, does not see them.')],
      villainScene: [q('ob', 'I will secure my revenge on Zendikar one soul at a time.'),
        q('ob', 'Take what solace you can in the knowledge that you will not be here to witness Zendikar\'s demise.'),
        q('ob', 'I have suffered a thousand lifetimes of agony on this wretched world. I\'ve far less time to share with you, but I assure you, no less pain.')],
      cues: {hero: cue('Hey, demon.', 'Burn!', 'He keeps getting up...', 'Extinguished.', 'Snuffed out...', 'Burn the planeswalker.'),
        villain: cue('A child with matches.', 'Suffer.', 'Hot.', 'Another soul.', 'Not prepared for this.')},
      after: [q('stage', 'Ob Nixilis had prepared for every eventuality—except Chandra Nalaar.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Depths', difficulty: 'Normal', rewardSet: 'ogw', teaches: ['Surge'],
      blurb: 'Kiora, who once tried to out-sea a sea god on Theros (Act 21), has come home to Zendikar with monsters of her own. Kozilek\'s brood is in the water too.',
      hero: {who: 'kiora', deck: {label: 'tribute', name: 'Kiora\'s Krakens', colors: 'GU', list: `
2 Kiora, Master of the Depths
4 Coralhelm Guide
4 Halimar Tidecaller
4 Jwar Isle Avenger
3 Guardian of Tazeem
2 Plated Crusher
4 Snapping Gnarlid
2 Oran-Rief Hydra
4 Clutch of Currents
4 Undergrowth Champion
3 Skyrider Elf
10 Forest
10 Island
4 Lumbering Falls`}},
      villain: {who: 'surge', deck: {label: 'tribute', name: 'Kozilek\'s Brood', colors: 'UR', list: `
4 Herald of Kozilek
4 Stormchaser Mage
4 Containment Membrane
4 Comparative Analysis
2 Fall of the Titans
4 Reckless Bushwhacker
4 Maw of Kozilek
3 Jori En, Ruin Diver
4 Gravity Negator
10 Island
10 Mountain
4 Wandering Fumarole
3 Brutal Expulsion`}},
      scene: [q('kiora', 'The seas are no less imperiled than the dry lands. This fight is mine as much as it is yours.'),
        q('kiora', 'Nissa is not the only one with a deep connection to Zendikar\'s primal elements.'),
        s('kiora', 'Surge: if you or a teammate cast another spell this turn, surge cards cost less. They chain cheap spells together.')],
      villainScene: [q('stage', 'Kozilek\'s brood infiltrates and deceives. The spawn of Ulamog mindlessly consume.'),
        q('stage', 'When Kozilek emerged at Sea Gate, his brood lineage swarmed to the surface.')],
      cues: {hero: cue('Rise, my beauties.', 'From the depths!', 'Something wrong in the water...', 'The tide is ours.', 'Pulled under...', 'Count their spells.'),
        villain: cue('[the water distorts]', '[surge]', '[a drone breaks apart]', '[reality bends]', '[the distortion fades]')},
      after: [s('kiora', 'Kozilek is here. At Sea Gate. Tell your Gideon he will need more than a speech.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'The Ceaseless Hunger', difficulty: 'Normal', rewardSet: 'bfz', teaches: ['Eldrazi Spawn'],
      blurb: 'The Archive remembers late 2015: Eldrazi Ramp, which made enough mana to cast Ulamog, against the Ally decks that tried to win first.',
      hero: {who: 'ramp', deck: {label: 'tribute', name: 'Eldrazi Ramp', colors: 'RG', archetype: 'Ramp', list: `
2 Ulamog, the Ceaseless Hunger
3 Oblivion Sower
2 Conduit of Ruin
4 Nissa's Pilgrimage
4 Hedron Archive
4 Kozilek's Return
4 Natural Connection
3 Sylvan Scrying
4 Lifespring Druid
2 World Breaker
4 Fiery Impulse
12 Forest
8 Mountain
4 Blighted Woodland`}},
      villain: {who: 'allies', deck: {label: 'tribute', name: 'Allies', colors: 'GW', archetype: 'Aggro', list: `
4 Expedition Envoy
4 Kor Bladewhirl
3 Tajuru Warcaller
4 Joraga Auxiliary
4 Makindi Patrol
4 Lantern Scout
3 Veteran Warleader
4 Ondu Greathorn
2 General Tazri
4 Undergrowth Champion
12 Plains
12 Forest`}},
      scene: [q('stage', 'The last hedron slotted into place, locking Ulamog in an infinite loop of binding energy.'),
        s('you', 'Survive to ten mana. Then everything they built goes away.')],
      villainScene: [q('stage', 'Everyone who could still lift a weapon had a part in retaking Sea Gate.')],
      cues: {hero: cue('Ramp.', 'Ulamog!', 'Too many allies...', 'Devoured.', 'Overrun.', 'Survive to ten mana.'),
        villain: cue('[an ally joins]', '[rally]', '[the titan lands]', '[overrun]', '[consumed]')},
      after: [s('stage', 'Recorded: Battle for Zendikar Standard, late 2015.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Thopters and Vampires', difficulty: 'Normal', rewardSet: 'ori', teaches: ['Tokens'],
      blurb: 'The Archive remembers 2015: blue-red thopter decks built around Pia and Kiran Nalaar and Thopter Spy Network, against Drana\'s Kalastria vampires.',
      hero: {who: 'thopters', deck: {label: 'tribute', name: 'Thopters', colors: 'UR', archetype: 'Midrange', list: `
2 Pia and Kiran Nalaar
3 Thopter Spy Network
4 Whirler Rogue
4 Hangarback Walker
4 Thopter Engineer
4 Ghirapur Gearcrafter
4 Fiery Impulse
3 Exquisite Firecraft
4 Chief of the Foundry
2 Artificer's Epiphany
2 Jace, Vryn's Prodigy
10 Island
10 Mountain
4 Wandering Fumarole`}},
      villain: {who: 'drana', deck: {label: 'tribute', name: 'Kalastria Vampires', colors: 'B', archetype: 'Aggro', list: `
2 Drana, Liberator of Malakir
4 Kalastria Healer
4 Malakir Familiar
4 Bloodbond Vampire
4 Vampire Envoy
4 Zulaport Cutthroat
4 Grasp of Darkness
4 Ruinous Path
3 Defiant Bloodlord
3 Guul Draz Overseer
24 Swamp`}},
      scene: [q('stage', '"The rare and beautiful butterflies inspire the design of our thopters. The larvae, however, are a different story entirely."'),
        s('you', 'Fliers in the air, sacrifice fodder on the ground. Keep making thopters.')],
      villainScene: [q('drana', 'Despite their bravado, mortals are fragile. If Zendikar is to endure, its lords must save it.'),
        q('drana', 'Kalitas may have returned to mindless servitude beneath the Eldrazi, but we say never again.')],
      cues: {hero: cue('Launch.', 'Thopters!', 'Drained...', 'Grounded.', 'Shot down.', 'Make more thopters.'),
        villain: cue('[the bloodchief rises]', '[a drain]', '[a thopter swarm]', '[bloodied]', '[outflown]')},
      after: [s('stage', 'Recorded: Magic Origins and Battle for Zendikar Standard, 2015.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Ulamog and Kozilek', difficulty: 'Hard', rewardSet: 'bfz', rewardCard: 'Ulamog, the Ceaseless Hunger', teaches: ['Indestructible'],
      blurb: 'At the ruins of Sea Gate, the four planeswalkers swear their oath. Then they go to work: Jace finds the pattern, Nissa binds the titans to the land, Gideon holds the brood back, and Chandra brings the fire.',
      hero: {who: 'gideon', deck: {label: 'tribute', name: 'The Gatewatch', colors: 'GW', list: `
2 Gideon, Ally of Zendikar
2 Nissa, Voice of Zendikar
1 Oath of Gideon
1 Oath of Nissa
4 Undergrowth Champion
4 Sylvan Advocate
3 Felidar Cub
3 Ondu Greathorn
2 Kor Bladewhirl
4 Expedition Envoy
11 Plains
13 Forest
4 Stasis Snare
3 Gideon's Reproach
3 Oran-Rief Hydra`}},
      villain: {who: 'titans', deck: {label: 'tribute', name: 'The Titans', colors: 'C', list: `
2 Ulamog, the Ceaseless Hunger
2 Kozilek, the Great Distortion
4 Kozilek's Channeler
4 Hedron Archive
3 Oblivion Sower
3 Breaker of Armies
2 Desolation Twin
3 Ulamog's Despoiler
4 Walker of the Wastes
4 Matter Reshaper
3 Warping Wail
2 Spatial Contortion
20 Wastes
4 Sea Gate Wreckage`}},
      scene: [q('jace', 'I\'ve heard it said that a Planeswalker is someone who can always run from danger. But Gideon\'s right: we\'re also the ones who can choose to stay.'),
        q('jace', 'Our time grows short. If we wish to vanquish the Eldrazi, we must unlock the hedrons\' secrets.'),
        q('gideon', 'While we delay, they\'re on the move. They will not wait as we bicker. We are losing this war by moments as our goal slips beyond our reach.'),
        s('nissa', 'Hold them in place. I will tie them to the world. Chandra does the rest.')],
      villainScene: [q('stage', 'A void as cryptic as reality itself.'),
        q('kalitas', 'No matter how big your champion, theirs is bigger. No matter how great your numbers, theirs are greater. No matter how voracious your appetite, they are hungrier. That is why the Eldrazi will win.')],
      cues: {hero: cue('We keep watch.', 'Bound!', 'They are too big...', 'Burn them!', 'The world goes grey...', 'Answer the titan when it lands.'),
        villain: {...cue('[the titans rise]', '[the titan exiles everything]', '[a titan is bound]', '[the world is eaten]', '[ash]'),
          half: {who: 'chandra', line: 'They are pinned! Get clear, I am lighting them up!'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Eldrazi Winter', difficulty: 'Hard', rewardSet: 'ogw', rewardCard: 'Thought-Knot Seer', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Eldrazi Winter', when: 'Early 2016', format: 'Modern.',
        what: 'Colourless Eldrazi decks that used Eye of Ugin and Eldrazi Temple to cast Thought-Knot Seer and Reality Smasher on turn two or three.',
        why: 'For a few months the Eldrazi decks dominated Modern. Players called that season Eldrazi Winter.',
        beat: 'Kill the creatures early, and do not let them untap with a four-drop on turn two. Cheap removal is everything.',
        after: 'Eye of Ugin was banned in Modern in April 2016. Eye of Ugin and Eldrazi Temple are not from this act\'s sets, so this tribute plays Wastes and Eldrazi Displacer instead.'},
      blurb: 'Deep in the archive, the season when the Eldrazi took Modern.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Mono-Red', colors: 'R', archetype: 'Aggro', list: `
4 Abbot of Keral Keep
4 Lavastep Raider
4 Dragonmaster Outcast
4 Fiery Impulse
4 Exquisite Firecraft
4 Valakut Predator
4 Goblin Glory Chaser
4 Akoum Stonewaker
4 Titan's Strength
24 Mountain`}},
      villain: {who: 'winter', deck: {label: 'tribute', name: 'Eldrazi Winter', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'WB', archetype: 'Aggro', list: `
4 Eldrazi Mimic
4 Thought-Knot Seer
4 Reality Smasher
4 Matter Reshaper
4 Eldrazi Displacer
4 Endless One
4 Wasteland Strangler
4 Warping Wail
4 Spatial Contortion
12 Wastes
6 Plains
6 Swamp`}},
      scene: [q('stage', 'Listen to the sound of defeat.'),
        s('you', 'They are faster than they look. Burn the first one.')],
      villainScene: [q('stage', 'From nothingness, sustenance.')],
      cues: {hero: cue('Burn early.', 'Gone!', 'Too big, too fast...', 'Thawed.', 'Frozen out.', 'Kill the two-drop.'),
        villain: cue('[a seer reveals your hand]', '[reality smashed]', '[a drone dies]', '[winter]', '[melted]')},
      after: [s('stage', 'Recorded: Eye of Ugin banned in Modern, April 2016.')]},
  ],
};
