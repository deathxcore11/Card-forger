// Act 28: Dominaria Reborn (Dominaria, Core Set 2019). Story and dialogue:
// /mnt/project-files/story/act-28-script.md (generated from this file). Land set: dom.
// Act 27 ended with Bolas's Gatewatch-era scheming. Dominaria, once the cradle of the Brothers' War, is waking up: the
// Weatherlight is rebuilt, Teferi is home, Karn has returned, and the Cabal spreads from Urborg under a demon who
// claims to have ruled every age. Every quoted line is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'dominaria-legacy',
  era: '2018-04-27',
  intro: [s('stage', 'Dominaria, long after the Brothers\' War. The ice age is over, and old things are waking.'),
    q('stage', 'As she took the wheel of the Weatherlight for the first time in a millennium, Jhoira knew she\'d been right to restore the ship. Anything was possible now.'),
    q('stage', 'The crystal pulsed with the power of Teferi\'s planeswalker spark. Had Jhoira given him a blessing or a curse?'),
    s('stage', 'In Urborg, the Cabal is gathering under a demon who says he has ruled every age.')],
  finale: [q('stage', 'The Demonlord has ruled every age. Every ruin, myth, and nightmare proves his power.'),
    s('stage', 'The Cabal\'s story is broken, and its demon with it. Teferi\'s spark is back, Jhoira has her ship, and Karn is walking Dominaria again.'),
    s('stage', 'Recorded: Dominaria is saved. Far from here, Nicol Bolas is waiting for the planeswalkers to gather.')],
  villainFinale: [q('stage', 'All hail the Demonlord Belzenlok, Evincar of the Stronghold, Scion of Darkness, Doom of Fools, Lord of the Wastes, Master of the Ebon Hand, Eternal Patriarch of the Cabal . . .'),
    s('stage', 'Nobody stops the Cabal. The Stronghold grows, and the Demonlord\'s story becomes the only story left.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Opt'},
    teferi: {name: 'Teferi', title: 'Hero of Dominaria', card: 'Teferi, Hero of Dominaria', focus: '50% 25%'},
    cabal: {name: 'The Cabal', title: 'Cultists of Urborg', card: 'Cabal Evangel', focus: '50% 30%'},
    jhoira: {name: 'Jhoira', title: 'Weatherlight Captain', card: 'Jhoira, Weatherlight Captain', focus: '50% 25%'},
    demons: {name: 'Belzenlok\'s Demons', title: 'Of Urborg', card: 'Demon of Catastrophes', focus: '50% 30%'},
    shanna: {name: 'Shanna', title: 'Sisay\'s Legacy', card: 'Shanna, Sisay\'s Legacy', focus: '50% 25%'},
    keldon: {name: 'Keldon Raiders', title: 'Warriors of the Flame', card: 'Keldon Raider', focus: '50% 30%'},
    karn: {name: 'Karn', title: 'Scion of Urza', card: 'Karn, Scion of Urza', focus: '50% 25%'},
    priests: {name: 'Belzenlok\'s Priests', title: 'Of the Cabal', card: 'Cabal Paladin', focus: '50% 30%'},
    radha: {name: 'Radha\'s Heirs', title: 'Keldon and Llanowar', card: 'Grand Warlord Radha', focus: '50% 25%'},
    yargle: {name: 'Yargle', title: 'Glutton of Urborg', card: 'Yargle, Glutton of Urborg', focus: '50% 30%'},
    wizards: {name: 'Mono-Red', title: 'Spring 2018', card: 'Goblin Chainwhirler', focus: '50% 30%'},
    esper: {name: 'Esper Teferi', title: 'Spring 2018', card: 'Teferi, Hero of Dominaria', focus: '50% 25%'},
    stompy: {name: 'Steel Leaf Stompy', title: 'Spring 2018', card: 'Steel Leaf Champion', focus: '50% 30%'},
    rb: {name: 'RB Aggro', title: 'Spring 2018', card: 'Knight of Malice', focus: '50% 30%'},
    weatherlight: {name: 'The Weatherlight', title: 'Teferi, Jhoira and Karn', card: 'Raff Capashen, Ship\'s Mage', focus: '50% 25%'},
    belzenlok: {name: 'Demonlord Belzenlok', title: 'Of the Cabal', card: 'Demonlord Belzenlok', focus: '50% 25%'},
    tiana: {name: 'Tiana', title: 'Ship\'s Caretaker', card: 'Tiana, Ship\'s Caretaker', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'A Story Unfolds', difficulty: 'Easy', rewardSet: 'dom', teaches: ['Sagas'],
      blurb: 'You arrive on Dominaria and meet Teferi, who has just come home. A band of the Cabal wants him gone.',
      hero: {who: 'teferi', deck: {label: 'tribute', name: 'The Returned', colors: 'WU', list: `
4 History of Benalia
3 Time of Ice
2 The Antiquities War
4 Knight of Grace
4 Mesa Unicorn
3 Serra Angel
4 Pegasus Courser
3 Academy Journeymage
3 Cloudreader Sphinx
4 Seal Away
2 Teferi, Hero of Dominaria
12 Plains
10 Island
2 Meandering River`}},
      villain: {who: 'cabal', deck: {label: 'tribute', name: 'The Cabal Cultists', colors: 'B', list: `
4 Cabal Evangel
4 Caligo Skin-Witch
4 Knight of Malice
4 Deathbloom Thallid
4 Windgrace Acolyte
4 Rite of Belzenlok
3 Vicious Offering
3 Cast Down
3 Cabal Paladin
3 Eviscerate
24 Swamp`}},
      scene: [q('stage', 'The crystal pulsed with the power of Teferi\'s planeswalker spark. Had Jhoira given him a blessing or a curse?'),
        q('stage', 'An ancient nemesis rendered harmless long ago.'),
        s('teferi', 'Sagas: each chapter happens in turn as lore counters are added, and the Saga leaves when the last chapter is done. Plan what is coming.')],
      villainScene: [q('stage', 'All hail the Demonlord Belzenlok, Evincar of the Stronghold, Scion of Darkness, Doom of Fools, Lord of the Wastes, Master of the Ebon Hand, Eternal Patriarch of the Cabal . . .'),
        q('stage', 'My heart is not mine, it is Belzenlok\'s. All hearts are his, and all blood.')],
      cues: {hero: cue('I am home.', 'Chapter three!', 'The Cabal keeps coming...', 'The story goes on.', 'Not this chapter...', 'Sagas read themselves, one chapter a turn.'),
        villain: cue('All hail.', 'All blood is his!', 'Hold the chant...', 'The Demonlord provides.', 'Silence...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Weatherlight Rises', difficulty: 'Easy', rewardSet: 'dom', teaches: ['Historic'],
      blurb: 'Jhoira has restored the Weatherlight. The Cabal\'s demons want it grounded.',
      hero: {who: 'jhoira', deck: {label: 'tribute', name: 'The Restored Weatherlight', colors: 'UR', list: `
2 Jhoira, Weatherlight Captain
2 Weatherlight
3 Icy Manipulator
3 Juggernaut
3 Pardic Wanderer
4 Sparring Construct
4 Jhoira's Familiar
2 Short Sword
4 Ghitu Journeymage
4 Shivan Fire
3 Wizard's Lightning
2 Skizzik
12 Mountain
10 Island
2 Sulfur Falls`}},
      villain: {who: 'demons', deck: {label: 'tribute', name: 'Belzenlok\'s Demons', colors: 'B', list: `
3 Demon of Catastrophes
3 Feral Abomination
4 Fell Specter
3 Vampire Sovereign
2 Dread Shade
3 Plague Mare
4 Cast Down
3 Murder
3 Eviscerate
4 Cabal Paladin
4 Walking Corpse
24 Swamp`}},
      scene: [q('stage', 'As she took the wheel of the Weatherlight for the first time in a millennium, Jhoira knew she\'d been right to restore the ship. Anything was possible now.'),
        q('jhoira', 'You could say it was my pet project.'),
        s('jhoira', 'Historic: artifacts, legendary cards and Sagas all count. Some cards reward you for casting one.')],
      villainScene: [q('stage', 'A pit yawned open, a column of oily smoke arose, and a towering form hissed, "I accept this offering."'),
        q('stage', 'Urborg used to be lovely—scenic volcanoes, respectable lich lords. Since the Cabal came with their nightmares and thrulls, it\'s all gone to the worms.')],
      cues: {hero: cue('Anything is possible.', 'Full sail!', 'The hull is cracking...', 'The ship flies.', 'Grounded...', 'Cast your artifacts and legends.'),
        villain: cue('An offering.', 'The pit opens!', 'It slips away...', 'Accepted.', 'Banished...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Sisay\'s Heir', difficulty: 'Easy', rewardSet: 'dom', teaches: ['Kicker'],
      blurb: 'Shanna Sisay\'s heir joins the crew. The Keldon raiders want everything on the ship and are ready to burn the rest.',
      hero: {who: 'shanna', deck: {label: 'tribute', name: 'Sisay\'s Legacy', colors: 'GW', list: `
2 Shanna, Sisay's Legacy
4 Llanowar Elves
4 Saproling Migration
4 Baloth Gorger
4 Knight of Grace
4 Benalish Honor Guard
3 Sergeant-at-Arms
2 Excavation Elephant
4 Mesa Unicorn
2 Territorial Allosaurus
3 Untamed Kavu
12 Forest
12 Plains`}},
      villain: {who: 'keldon', deck: {label: 'tribute', name: 'Keldon Raiders', colors: 'R', list: `
4 Keldon Raider
4 Keldon Overseer
4 Keldon Warcaller
4 Bloodstone Goblin
3 Goblin Warchief
2 Goblin Chainwhirler
4 Shivan Fire
3 Wizard's Lightning
2 Fight with Fire
3 Skizzik
3 Orcish Vandal
24 Mountain`}},
      scene: [q('shanna', 'I am heir to many treasures. None is as precious as knowing how my ancestor lived her life.'),
        q('stage', 'Sometimes Shivan dragons toy with their food. Other times they just cook it.'),
        s('shanna', 'Kicker: pay the extra cost and the spell does more. Hold a kicker card until you can afford the bigger version.')],
      villainScene: [q('stage', 'Keldon raiders\' spoils are limited to what their colos can carry. No matter the value, the rest goes up in smoke.'),
        q('stage', 'The Mountain gave the Flame to Kradak to light the furnaces of his people\'s hearts. The wanderers became Keldons, and he the first warlord.')],
      cues: {hero: cue('For my ancestor.', 'Kicked!', 'They are burning it all...', 'The legacy holds.', 'Burned...', 'Save kicker cards for later.'),
        villain: cue('Burn the rest.', 'To the Flame!', 'Put it out...', 'Smoke and spoils.', 'No spoils...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Karn Returns', difficulty: 'Normal', rewardSet: 'dom', teaches: ['Planeswalkers'],
      blurb: 'Karn, a silver golem built by Urza, faces the priests of the Cabal in their stronghold.',
      hero: {who: 'karn', deck: {label: 'tribute', name: 'Karn\'s Machines', colors: 'U', list: `
3 Karn, Scion of Urza
4 Jhoira's Familiar
3 Icy Manipulator
3 Juggernaut
3 Pardic Wanderer
3 Sparring Construct
3 Voltaic Servant
4 Skittering Surveyor
2 Short Sword
3 Academy Drake
3 Cloudreader Sphinx
2 Opt
24 Island`}},
      villain: {who: 'priests', deck: {label: 'tribute', name: 'Belzenlok\'s Priests', colors: 'B', list: `
2 Liliana, the Necromancer
4 Cabal Paladin
2 Josu Vess, Lich Knight
4 Windgrace Acolyte
4 Cabal Evangel
4 Stronghold Confessor
3 Vicious Offering
3 Eviscerate
4 Cast Down
3 Deathbloom Thallid
3 Knight of Malice
24 Swamp`}},
      scene: [q('stage', 'Urza\'s machines have a splendid habit of excavating themselves.'),
        q('stage', 'Ice may thaw, but malice never does.'),
        s('karn', 'Planeswalkers: add loyalty to use an ability, and they take attacks meant for you. Keep a creature home to protect them.')],
      villainScene: [q('stage', 'The Demonlord has ruled every age. Every ruin, myth, and nightmare proves his power.'),
        q('stage', 'The seat of Belzenlok\'s power, the Stronghold serves as the gathering place for the Cabal as their dark influence spreads from Urborg.')],
      cues: {hero: cue('Karn is here.', 'Loyalty rising!', 'They are after me...', 'Karn endures.', 'Karn falls...', 'Guard your planeswalker.'),
        villain: cue('Kneel.', 'In the Demonlord\'s name!', 'The Stronghold shakes...', 'The Cabal grows.', 'The stone cracks...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Radha\'s Heirs and Yargle', difficulty: 'Normal', rewardSet: 'dom', teaches: ['Legendary sorceries'],
      blurb: 'Radha\'s heirs ride out against Yargle, Urborg\'s famously terrible glutton. Their big spells need a legend first.',
      hero: {who: 'radha', deck: {label: 'tribute', name: 'Radha\'s Heirs', colors: 'RG', list: `
2 Grand Warlord Radha
2 Hallar, the Firefletcher
4 Llanowar Elves
3 Keldon Raider
4 Baloth Gorger
3 Territorial Allosaurus
2 Jaya's Immolating Inferno
2 Kamahl's Druidic Vow
3 Wizard's Lightning
3 Shivan Fire
2 Fight with Fire
3 Saproling Migration
3 Skizzik
12 Forest
11 Mountain
1 Timber Gorge`}},
      villain: {who: 'yargle', deck: {label: 'tribute', name: 'Yargle\'s Feast', colors: 'B', list: `
1 Yargle, Glutton of Urborg
4 Walking Corpse
4 Tattered Mummy
4 Rat Colony
3 Reassembling Skeleton
4 Doomed Dissenter
4 Vampire Neonate
4 Diregraf Ghoul
3 Skeleton Archer
3 Two-Headed Zombie
2 Ravenous Harpy
24 Swamp`}},
      scene: [q('stage', 'The study of magic began when the first mage taught herself to throw lightning.'),
        q('stage', 'Centuries ago, one man\'s vengeance plunged the world into ice and darkness.'),
        s('radha', 'Legendary sorceries can only be cast while you control a legendary creature or planeswalker. Keep a legend on the table first.')],
      villainScene: [q('stage', 'When Belzenlok\'s lieutenant Yar-Kul grew too ambitious, the Demonlord transformed him into a maggot. The frog that ate the maggot grew and grew, until a ravenous spirit burst from its body.'),
        q('stage', 'They may show up with the wrong thigh bone or mandible, but they always show up.')],
      cues: {hero: cue('Ride!', 'Legends first!', 'Where is my legend...', 'Yargle is fed.', 'Eaten...', 'Cast a legend before the sorcery.'),
        villain: cue('Hungry.', 'Feast!', 'A frog, no...', 'Delicious.', 'Burp...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Mono-Red', difficulty: 'Normal', rewardSet: 'm19', teaches: ['Hexproof'],
      blurb: 'A tribute to Standard in spring 2018: Mono-Red against Esper Teferi, burn against a slow control deck.',
      hero: {who: 'wizards', deck: {label: 'tribute', name: 'Mono-Red', colors: 'R', archetype: 'Aggro', list: `
4 Goblin Chainwhirler
4 Ghitu Lavarunner
4 Ghitu Journeymage
4 Keldon Raider
3 Skizzik
4 Shivan Fire
4 Wizard's Lightning
2 Fight with Fire
3 Lightning Strike
4 Goblin Warchief
24 Mountain`}},
      villain: {who: 'esper', deck: {label: 'tribute', name: 'Teferi Control', colors: 'WU', archetype: 'Control', list: `
3 Teferi, Hero of Dominaria
4 Seal Away
3 Blink of an Eye
4 Opt
3 Academy Journeymage
3 Cloudreader Sphinx
3 Serra Angel
2 Wizard's Retort
2 Time of Ice
3 History of Benalia
4 Knight of Grace
2 Syncopate
12 Plains
10 Island
2 Meandering River`}},
      scene: [q('stage', 'The trick is, once you get moving, don\'t stop!'),
        q('stage', 'Tolarians teach the theory of pyromancy. The Ghitu prefer applied research.'),
        s('you', 'Red wants to win before Teferi comes down. Keep attacking and burn their face.')],
      villainScene: [q('stage', 'Long ago, I enchanted an army of statues to guard Zhalfir. My homeland is gone, but its protectors remain.'),
        q('stage', 'We don\'t choose who comes here. We choose how long they stay.')],
      cues: {hero: cue('Do not stop!', 'Burn it all!', 'Teferi is too slow...', 'The fire wins.', 'Frozen out...', 'Race before Teferi lands.'),
        villain: cue('Think.', 'Time bends.', 'Out of answers...', 'Control.', 'Too fast...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Steel Leaf Stompy', difficulty: 'Normal', rewardSet: 'm19', teaches: ['Card advantage'],
      blurb: 'A tribute to Standard in spring 2018: Steel Leaf Stompy, big elves and bigger beasts, against RB Aggro.',
      hero: {who: 'stompy', deck: {label: 'tribute', name: 'Steel Leaf Stompy', colors: 'G', archetype: 'Aggro', list: `
4 Llanowar Elves
1 Steel Leaf Champion
4 Baloth Gorger
3 Territorial Allosaurus
3 Marwyn, the Nurturer
3 Llanowar Envoy
4 Saproling Migration
3 Mammoth Spider
4 Krosan Druid
4 Rabid Bite
3 Wild Onslaught
24 Forest`}},
      villain: {who: 'rb', deck: {label: 'tribute', name: 'RB Aggro', colors: 'BR', archetype: 'Aggro', list: `
4 Knight of Malice
2 Goblin Chainwhirler
4 Keldon Raider
3 Skizzik
3 Cast Down
3 Shivan Fire
3 Cabal Paladin
3 Vicious Offering
4 Wizard's Lightning
2 Fight with Fire
2 Brawl-Bash Ogre
2 Garna, the Bloodflame
1 Goblin Warchief
12 Mountain
10 Swamp
2 Cinder Barrens`}},
      scene: [q('stage', 'One eye open to see the truth of the world. One eye covered to gaze at the goddess within.'),
        q('stage', 'Druids endure disaster as seeds endure winter. Now Krosa blooms once more.'),
        s('you', 'Your elves get you ahead on mana. Play your biggest creature each turn and let their burn run dry.')],
      villainScene: [q('stage', 'A shadow to swallow the light.'),
        q('stage', 'You should have seen the look on both their faces.')],
      cues: {hero: cue('Elves up!', 'Stomp!', 'They are burning my elves...', 'Krosa blooms.', 'Burned out...', 'Play your biggest creature.'),
        villain: cue('Shadows.', 'Burn!', 'Out of fuel...', 'Ash.', 'Overgrown...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Demonlord', difficulty: 'Hard', rewardSet: 'm19', teaches: ['First strike'],
      blurb: 'Belzenlok\'s story is all he has. Teferi, Jhoira and Karn have a ship, a spark and a lot of old Dominaria behind them.',
      hero: {who: 'weatherlight', deck: {label: 'tribute', name: 'The Weatherlight Crew', colors: 'WU', list: `
2 Teferi, Hero of Dominaria
3 Raff Capashen, Ship's Mage
3 History of Benalia
3 Seal Away
1 Serra Angel
4 Knight of Grace
3 Cloudreader Sphinx
3 Academy Journeymage
2 Danitha Capashen, Paragon
3 Blink of an Eye
4 Opt
2 Wizard's Retort
12 Plains
10 Island
2 Meandering River
2 Divination
1 Lyra Dawnbringer`}},
      villain: {who: 'belzenlok', deck: {label: 'tribute', name: 'The Cabal', colors: 'B', list: `
4 Demonlord Belzenlok
2 Josu Vess, Lich Knight
4 Cabal Paladin
2 Rite of Belzenlok
3 Vicious Offering
4 Cast Down
3 Eviscerate
2 Murder
2 Liliana, the Necromancer
3 Demon of Catastrophes
2 Feral Abomination
24 Swamp
3 Dread Shade
2 Vampire Sovereign`}},
      scene: [q('stage', 'You are not alone. You never were.'),
        q('stage', 'I will protect the less fortunate. I will love bravely. I will face despair and fight on. As a Capashen, I can do no less.'),
        s('teferi', 'He says he has ruled every age. He made that up. Break the story and the Cabal goes with it.')],
      villainScene: [q('stage', 'The Demonlord has ruled every age. Every ruin, myth, and nightmare proves his power.'),
        q('stage', 'Fear the dark if you must, but don\'t mistake sunlight for safety.')],
      cues: {hero: cue('Weatherlight, to me.', 'Together!', 'The Demonlord is huge...', 'The story ends here.', 'Ship down...', 'Race him before the Rite finishes.'),
        villain: {...cue('All hail.', '[the Stronghold roars]', '[a hollow chant]', 'It was a story.', '[the Stronghold falls silent]'),
          half: {who: 'tiana', line: 'Nothing is too broken to mend.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Teferi, Hero of Dominaria', difficulty: 'Hard', rewardSet: 'dom', rewardCard: 'Teferi, Hero of Dominaria', mood: 'boss',
      teaches: ['Reach'],
      archive: {deck: 'Esper Teferi', when: 'Spring 2018', format: 'Standard.',
        what: 'White-blue control decks built around Teferi, Hero of Dominaria, which untaps lands, draws cards and tucks a permanent away every turn.',
        why: 'Teferi was a planeswalker that protected itself and generated card advantage in a format full of aggro decks.',
        beat: 'Pressure Teferi with attackers, or make them spend counters and removal before they land it.',
        after: 'Dominaria and Core Set 2019 rotated out of Standard in autumn 2019.'},
      blurb: 'Deep in the archive, a planeswalker who will not let you finish your turn.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Steel Leaf Stompy', colors: 'G', archetype: 'Aggro', list: `
4 Llanowar Elves
3 Steel Leaf Champion
4 Baloth Gorger
3 Territorial Allosaurus
3 Marwyn, the Nurturer
3 Llanowar Envoy
4 Saproling Migration
3 Mammoth Spider
3 Krosan Druid
3 Rabid Bite
3 Wild Onslaught
24 Forest`}},
      villain: {who: 'esper', deck: {label: 'tribute', name: 'Teferi Control', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'WU', archetype: 'Control', list: `
4 Teferi, Hero of Dominaria
4 Seal Away
3 Syncopate
2 Wizard's Retort
3 Opt
3 Blink of an Eye
4 Cloudreader Sphinx
3 Serra Angel
2 Lyra Dawnbringer
4 History of Benalia
2 Time of Ice
2 Divination
12 Plains
10 Island
2 Meandering River`}},
      scene: [q('stage', 'The crystal pulsed with the power of Teferi\'s planeswalker spark. Had Jhoira given him a blessing or a curse?'),
        s('you', 'Attack Teferi the moment he lands. Do not let him untap.')],
      villainScene: [q('stage', 'Long ago, I enchanted an army of statues to guard Zhalfir. My homeland is gone, but its protectors remain.')],
      cues: {hero: cue('Attack him.', 'Stomp!', 'He untapped again...', 'Teferi falls.', 'Frozen...', 'Pressure the planeswalker.'),
        villain: cue('[a quiet spell]', '[time turns]', '[a counter fizzles]', '[stillness]', '[the lands untap]')},
      after: [s('stage', 'Recorded: Dominaria and Core Set 2019 rotated out of Standard in autumn 2019.')]},
  ],
};
