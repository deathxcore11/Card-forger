// Act 26: The God-Pharaoh (Amonkhet, Hour of Devastation). Story and dialogue:
// /mnt/project-files/story/act-26-script.md (generated from this file). Land set: akh.
// Act 25 ended with Tezzeret gone and Bolas behind him. Now the Gatewatch follows Bolas to Amonkhet, where the people
// train in the trials for a glorious afterlife. The afterlife is a lie: they are embalmed into an army of Eternals.
// Samut, a dissenter, and Gideon see it first. The Gatewatch loses badly, the gods die, and Bolas walks away with
// his army. The finale says so. Every quoted line is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'god-pharaoh-desert',
  era: '2017-07-14',
  intro: [s('stage', 'Amonkhet, a desert plane of perfect order. Its people train from childhood in the trials, to earn a place in the afterlife.'),
    q('stage', 'The one thing the Gatewatch didn\'t expect to find on a plane ruled by Nicol Bolas was perfection.'),
    q('samut', 'I\'ll fight no more just for the honor of dying. The afterlife will have to wait.'),
    s('stage', 'Samut of the Tah crop has stopped believing. She is not alone, but the others do not know it yet.')],
  finale: [q('stage', 'The people entered as worthy. They exited as Eternals.'),
    q('bolas', 'Everything here exists or perishes at my whim. Including you, Gatewatch.'),
    q('djeru', 'I was promised an afterlife, not this. Samut was right. The God-Pharaoh lied.'),
    s('stage', 'The Gatewatch loses, and loses badly. The gods are dead and the city is open to the desert.'),
    s('stage', 'Bolas leaves with the largest army of Eternals he could ever want. Samut and the survivors walk out of the Hekma into the wastes.')],
  villainFinale: [q('bolas', 'My work here is complete. The people have done everything required of them.'),
    q('bolas', 'This place has outlived its usefulness.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Open into Wonder'},
    samut: {name: 'Samut', title: 'Voice of Dissent', card: 'Samut, Voice of Dissent', focus: '50% 25%'},
    initiates: {name: 'Oketra\'s Initiates', title: 'Tah crop', card: 'Anointer Priest', focus: '50% 30%'},
    neheb: {name: 'Neheb', title: 'The Worthy', card: 'Neheb, the Worthy', focus: '50% 25%'},
    rhonas: {name: 'Rhonas', title: 'God of Strength', card: 'Rhonas the Indomitable', focus: '50% 25%'},
    hapatra: {name: 'Hapatra', title: 'Vizier of Poisons', card: 'Hapatra, Vizier of Poisons', focus: '50% 25%'},
    kefnet: {name: 'Kefnet', title: 'God of Knowledge', card: 'Kefnet the Mindful', focus: '50% 25%'},
    gideon: {name: 'Gideon Jura', title: 'Of the Trials', card: 'Gideon of the Trials', focus: '50% 25%'},
    hazoret: {name: 'Hazoret', title: 'The Fervent', card: 'Hazoret the Fervent', focus: '50% 25%'},
    scarab: {name: 'The Scarab God', title: 'Of the Eternals', card: 'The Scarab God', focus: '50% 30%'},
    exert: {name: 'Exert Red', title: 'Summer 2017', card: 'Glorybringer', focus: '50% 30%'},
    zombies: {name: 'Zombies', title: 'Summer 2017', card: 'Gravedigger', focus: '50% 30%'},
    camels: {name: 'Cat Tokens', title: 'Summer 2017', card: 'Regal Caracal', focus: '50% 30%'},
    gift: {name: 'God-Pharaoh\'s Gift', title: 'Summer 2017', card: 'God-Pharaoh\'s Gift', focus: '50% 30%'},
    gatewatch: {name: 'The Gatewatch', title: 'At Naktamun', card: 'Gideon, Martial Paragon', focus: '50% 25%'},
    bolas: {name: 'Nicol Bolas', title: 'God-Pharaoh', card: 'Nicol Bolas, God-Pharaoh', focus: '50% 25%'},
    jace: {name: 'Jace Beleren', title: 'Of the Gatewatch', card: 'Jace\'s Defeat', focus: '50% 25%'},
    djeru: {name: 'Djeru', title: 'Of the Tah crop', card: 'Djeru, With Eyes Open', focus: '50% 25%'},
    ramunap: {name: 'Ramunap Red', title: 'Summer 2017', card: 'Hazoret the Fervent', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Tah Crop', difficulty: 'Easy', rewardSet: 'akh', teaches: ['Embalm'],
      blurb: 'You arrive in Naktamun with Samut, who has begun to doubt the trials. Her old crop-mates are sent to bring her back.',
      hero: {who: 'samut', deck: {label: 'tribute', name: 'The Dissenters', colors: 'RG', list: `
2 Samut, Voice of Dissent
4 Pathmaker Initiate
4 Prowling Serpopard
4 Bitterblade Warrior
4 Ahn-Crop Crasher
4 Ramunap Excavator
4 Pouncing Cheetah
4 Khenra Charioteer
3 Open Fire
3 Abrade
12 Mountain
12 Forest`}},
      villain: {who: 'initiates', deck: {label: 'tribute', name: 'Oketra\'s Initiates', colors: 'W', list: `
4 Sacred Cat
4 Anointer Priest
4 Unwavering Initiate
4 Glory-Bound Initiate
2 Steadfast Sentinel
3 Binding Mummy
3 Sparring Mummy
4 Trueheart Duelist
2 Rhet-Crop Spearmaster
2 Gideon's Resolve
28 Plains`}},
      scene: [q('samut', 'Don\'t you ever wonder what lies beyond the Hekma? Beyond the reach of the gods? Beyond the horns on the horizon?'),
        q('stage', 'Initiates live and train with their crop, the unit that begins the trials together.'),
        s('samut', 'Embalm: they can return from the graveyard as a white mummy token. Kill them once, and expect to kill them twice.')],
      villainScene: [q('stage', 'What the gods decree, the mummies enforce.'),
        q('stage', 'Hesitation breeds dissension. To be worthy of the next life, you must never look back.')],
      cues: {hero: cue('Come on, then.', 'Over the wall!', 'They keep coming...', 'Free for now.', 'Dragged back...', 'Exile them or expect them twice.'),
        villain: cue('Return to the crop.', 'For the afterlife!', 'Stay together...', 'Brought home.', 'She got away...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Trial of Strength', difficulty: 'Easy', rewardSet: 'akh', teaches: ['Exert'],
      blurb: 'Neheb, Samut\'s brother in all but blood, is training with Hazoret\'s warriors. First he has to get through Rhonas\'s trial of beasts and teeth.',
      hero: {who: 'neheb', deck: {label: 'tribute', name: 'The Fervent', colors: 'BR', list: `
2 Neheb, the Worthy
4 Bloodrage Brawler
4 Earthshaker Khenra
4 Wildfire Eternal
4 Combat Celebrant
4 Ahn-Crop Crasher
4 Hazoret's Favor
4 Abrade
4 Open Fire
2 Glorybringer
12 Mountain
12 Swamp`}},
      villain: {who: 'rhonas', deck: {label: 'tribute', name: 'The Trial of Strength', colors: 'G', list: `
2 Rhonas the Indomitable
4 Rhonas's Stalwart
4 Champion of Rhonas
4 Pouncing Cheetah
4 Prowling Serpopard
4 Crocodile of the Crossing
4 Bitterbow Sharpshooters
4 Ornery Kudu
4 Defiant Greatmaw
26 Forest`}},
      scene: [q('neheb', 'Ashes can\'t be embalmed.'),
        q('stage', 'To Hazoret, those who fight for her are her beloved children.'),
        s('neheb', 'Exert: attack hard, and the creature stays tapped through your next untap. Spend it on the turn that wins, not before.')],
      villainScene: [q('rhonas', 'Everything in the trial has teeth. You will overcome them, or you will feed them.'),
        q('stage', 'There are no safe paths through the Trial of Strength.')],
      cues: {hero: cue('Hazoret watches.', 'Exert!', 'Too much for one turn...', 'Passed.', 'Out of the trial...', 'Exert only when it kills.'),
        villain: cue('Instinct to guide.', 'Strength to overcome.', 'You are not yet worthy...', 'Another initiate falls.', 'Strong enough...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Hapatra\'s Poisons', difficulty: 'Easy', rewardSet: 'akh', teaches: ['Aftermath'],
      blurb: 'Hapatra, Bontu\'s vizier of poisons, sits in on Kefnet\'s trial of puzzles. Everyone is a little too clever and a little too sure.',
      hero: {who: 'hapatra', deck: {label: 'tribute', name: 'The Vizier of Poisons', colors: 'BG', list: `
2 Hapatra, Vizier of Poisons
4 Doomed Dissenter
4 Dune Beetle
2 Wasteland Scorpion
4 Never // Return
4 Obelisk Spider
4 Decimator Beetle
4 Lethal Sting
3 Bone Picker
12 Swamp
12 Forest
4 Gravedigger
1 Hapatra's Mark`}},
      villain: {who: 'kefnet', deck: {label: 'tribute', name: 'The Trial of Knowledge', colors: 'U', list: `
2 Kefnet the Mindful
4 Aven Initiate
4 Proven Combatant
4 Sinuous Striker
28 Island
4 Naga Oracle
2 Vizier of the Anointed
4 Riddleform
4 River Serpent
4 Ancient Crab`}},
      scene: [q('stage', 'If you fear poisons, it is because you are ignorant of them.'),
        q('stage', 'Her subtle smile is suffused with venom.'),
        s('hapatra', 'Aftermath: the bottom half of the split card can only be cast from the graveyard, and then it is exiled. Cast the top half first.')],
      villainScene: [q('kefnet', 'No amount of strength can help you overcome my trial. You must be ready to forgo your body and favor your mind.'),
        q('stage', 'The answers are here. This is the way through the trial.')],
      cues: {hero: cue('A little sting.', 'Aftermath!', 'He saw that coming...', 'Delicious.', 'Antidote, antidote...', 'Cast it twice, once from the graveyard.'),
        villain: cue('Think.', 'Solved.', 'A flaw in the reasoning...', 'Correct.', 'You may try again.')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Trial of Zeal', difficulty: 'Normal', rewardSet: 'hou', teaches: ['Cycling'],
      blurb: 'Gideon Jura sees an initiate murder his crop-mate in the trial of zeal. His admiration for Naktamun gives way to horror.',
      hero: {who: 'gideon', deck: {label: 'tribute', name: 'Gideon of the Trials', colors: 'W', list: `
2 Gideon of the Trials
2 Gideon's Intervention
2 Oketra's Attendant
4 Dauntless Aven
4 Trueheart Duelist
4 Sparring Mummy
2 Sandblast
2 Crested Sunmare
2 Djeru, With Eyes Open
3 Binding Mummy
25 Plains
4 Graceful Cat
4 Solitary Camel`}},
      villain: {who: 'hazoret', deck: {label: 'tribute', name: 'Hazoret\'s Priests', colors: 'R', list: `
2 Hazoret the Fervent
2 Hazoret's Undying Fury
4 Zealot of the God-Pharaoh
4 Earthshaker Khenra
4 Manticore Eternal
4 Heart-Piercer Manticore
3 Hour of Devastation
4 Harsh Mentor
4 Open Fire
3 Glorybringer
2 Sweltering Suns
24 Mountain`}},
      scene: [q('stage', 'As Gideon watched the initiate murder his crop-mate, his admiration of the city of Naktamun gave way to horror.'),
        q('gideon', 'The gods here may walk among the people, but they are not with them.'),
        s('gideon', 'Cycling: pay a little mana, discard the card, draw a new one. Cycle the spare lands and the dead cards.')],
      villainScene: [q('hazoret', 'When the time comes, only one of you will be honored by my spear.'),
        q('stage', 'What the initiates face in the final trial is completely at Hazoret\'s discretion.')],
      cues: {hero: cue('This is not justice.', 'Hold the line!', 'There are too many...', 'The trial is broken.', 'Defeated...', 'Cycle away the dead cards.'),
        villain: cue('Prove your zeal.', 'Burn!', 'Falter and be forgotten...', 'Worthy.', 'The spear is dull...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Eternals', difficulty: 'Normal', rewardSet: 'hou', teaches: ['Eternalize'],
      blurb: 'In the Hour of Revelation, the gods are dead or turned. The Scarab God, who was Kefnet\'s last act of defiance, hunts for the dissenters.',
      hero: {who: 'samut', deck: {label: 'tribute', name: 'The Tested', colors: 'RG', list: `
2 Samut, the Tested
4 Pathmaker Initiate
4 Ahn-Crop Crasher
4 Combat Celebrant
2 Samut, Voice of Dissent
4 Prowling Serpopard
4 Wildfire Eternal
4 Abrade
4 Open Fire
4 Rhonas's Stalwart
12 Mountain
12 Forest`}},
      villain: {who: 'scarab', deck: {label: 'tribute', name: 'The Eternals', colors: 'UB', list: `
2 The Scarab God
4 Champion of Wits
4 Eternal of Harsh Truths
4 Spellweaver Eternal
4 Merciless Eternal
4 Khenra Eternal
2 Ammit Eternal
4 Cancel
4 Gravedigger
4 Sinuous Striker
12 Island
12 Swamp`}},
      scene: [q('jace', 'If creating the Eternals was Bolas\'s plan here, what is his plan for the Eternals?'),
        q('stage', 'The dead entered as worthy. They exited as Eternals.'),
        s('samut', 'Eternalize: they come back from the graveyard as 4/4 black Zombies. Exile the graveyard, or kill the Zombie.')],
      villainScene: [q('stage', 'For many years, servant mummies toiled in the mines to extract lazotep. The emergence of the Eternals revealed the sacred substance\'s true purpose.'),
        q('stage', 'The Eternals had long since mastered every technique taught during the trials.')],
      cues: {hero: cue('Run!', 'Break them!', 'They keep standing up...', 'We are through.', 'They got us...', 'Do not let them eternalize.'),
        villain: cue('[a hollow chant]', '[the dead return stronger]', '[an Eternal crumbles]', '[eternity]', '[silence]')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Exert Red', difficulty: 'Normal', rewardSet: 'hou', teaches: ['Racing'],
      blurb: 'A tribute to Standard in summer 2017: Temur Exert against Zombies, two ways of surviving the Hour.',
      hero: {who: 'exert', deck: {label: 'tribute', name: 'RG Exert', colors: 'RG', archetype: 'Aggro', list: `
4 Pouncing Cheetah
4 Bloodrage Brawler
4 Earthshaker Khenra
4 Ahn-Crop Crasher
4 Combat Celebrant
4 Wildfire Eternal
3 Glorybringer
3 Abrade
3 Open Fire
3 Neheb, the Eternal
12 Mountain
12 Forest`}},
      villain: {who: 'zombies', deck: {label: 'tribute', name: 'Zombies', colors: 'BR', archetype: 'Midrange', list: `
4 Dread Wanderer
4 Gravedigger
4 Zealot of the God-Pharaoh
4 Ruthless Sniper
4 Dune Beetle
4 Bone Picker
4 Liliana's Defeat
4 Scrounger of Souls
2 Liliana, Death's Majesty
2 Open Fire
12 Swamp
12 Mountain`}},
      scene: [q('stage', 'What the initiates face in the final trial is completely at Hazoret\'s discretion.'),
        q('stage', 'In Amonkhet\'s ever-shifting sands, nothing stays buried for long.'),
        s('you', 'Their dead keep coming back. Race them, and exert only when it wins you the game.')],
      villainScene: [q('stage', 'The Curse of Wandering permeated Amonkhet long before Nicol Bolas. He simply harnessed it.')],
      cues: {hero: cue('Charge!', 'Full exert!', 'They are ahead...', 'First across the sand.', 'Buried...', 'Exert for lethal only.'),
        villain: cue('[shambling]', '[the dead rise]', '[a zombie drops]', '[sand]', '[stillness]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'God-Pharaoh\'s Gift', difficulty: 'Normal', rewardSet: 'hou', teaches: ['Card advantage'],
      blurb: 'A tribute to Standard in summer 2017: Gideon\'s green-white against the God-Pharaoh\'s Gift, which turns every creature in your graveyard into a hasty 4/4.',
      hero: {who: 'camels', deck: {label: 'tribute', name: 'GW Cats', colors: 'GW', archetype: 'Aggro', list: `
4 Pride Sovereign
4 Hooded Brawler
4 Majestic Myriarch
4 Ramunap Excavator
4 Ramunap Hydra
4 Ahn-Crop Champion
4 Nissa, Genesis Mage
2 Gideon's Defeat
2 Sixth Sense
12 Forest
12 Plains
4 Oketra's Attendant`}},
      villain: {who: 'gift', deck: {label: 'tribute', name: 'God-Pharaoh\'s Gift', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'W', archetype: 'Midrange', list: `
3 God-Pharaoh's Gift
4 Angel of Sanctions
4 Steadfast Sentinel
2 Oketra the True
4 Cast Out
4 Sandblast
4 Gust Walker
4 Regal Caracal
24 Plains
1 Sacred Cat
3 Hour of Revelation
3 Mighty Leap`}},
      scene: [q('stage', 'When the Second Sun rests between the horns on the horizon, so begins the Hour of Revelation. Then the Hour of Glory, the Hour of Promise, and finally the Hour of Eternity.'),
        q('stage', 'Though the afterlife, the city, and even the God-Pharaoh himself were one great deception, the ideals championed by the gods remain true.'),
        s('you', 'Their Gift is slow but it ends games. Kill the graveyard before it fills.')],
      villainScene: [q('stage', 'The dead perform all the work here, farming, building, teaching, even embalming their fellow mummies.'),
        q('stage', 'A single grain of sand is insignificant, but a sandstorm can reduce pyramids to dust.')],
      cues: {hero: cue('Hold the line.', 'Together!', 'The Gift is coming...', 'The sand clears.', 'Overrun...', 'Race before the Gift lands.'),
        villain: cue('[a quiet prayer]', '[the Gift is given]', '[a mummy crumbles]', '[the army wakes]', '[the sands settle]')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Hour of Devastation', difficulty: 'Hard', rewardSet: 'hou', teaches: ['Flying'],
      blurb: 'Nicol Bolas has the city, the gods, the Eternals and the Hour. The Gatewatch is what is left of the resistance.',
      hero: {who: 'gatewatch', deck: {label: 'tribute', name: 'Samut and Gideon', colors: 'WG', list: `
2 Gideon's Intervention
3 Angel of Sanctions
2 Cast Out
12 Plains
12 Forest
4 Bitterblade Warrior
4 Pouncing Cheetah
3 Dauntless Aven
2 Trueheart Duelist
4 Graceful Cat
4 Solitary Camel
4 Frilled Sandwalla
4 Wall of Forgotten Pharaohs`}},
      villain: {who: 'bolas', deck: {label: 'tribute', name: 'The God-Pharaoh', colors: 'UBR', list: `
1 Nicol Bolas, God-Pharaoh
4 Pitiless Vizier
4 Merciless Javelineer
4 Cartouche of Ambition
3 Never // Return
4 Archfiend of Ifnir
4 Bone Picker
10 Swamp
9 Island
5 Mountain
4 Gravedigger
3 Apocalypse Demon
3 Lord of the Accursed
2 Liliana's Defeat`}},
      scene: [q('bolas', 'Everything here exists or perishes at my whim. Including you, Gatewatch.'),
        q('bolas', 'Fire? Is that your only trick, Chandra?'),
        s('gideon', 'He cannot be beaten by force. Hold what you can and get the people out.')],
      villainScene: [q('bolas', 'I had hoped for more from you, Jace. But I expected as much.'),
        q('bolas', 'This is what glory looks like.')],
      cues: {hero: cue('Hold the city.', 'Together!', 'He is too strong...', 'We got them out.', 'The Gatewatch falls...', 'You cannot win this, hold on.'),
        villain: {...cue('[the Second Sun rises]', '[the Hour begins]', '[an Eternal falls]', 'It is finished.', '[a silence like a held breath]'),
          half: {who: 'djeru', line: 'Everyone, to the Hekma! We can still get out!'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Ramunap Red', difficulty: 'Hard', rewardSet: 'hou', rewardCard: 'Hazoret the Fervent', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Mono-Red Aggro', when: 'Summer 2017', format: 'Standard.',
        what: 'Mono-red decks built to kill by turn four, with Bloodrage Brawler, Earthshaker Khenra, Hazoret the Fervent and a land that kept green decks from playing their lands.',
        why: 'Red had the fastest and most reliable plan in Standard for most of that summer.',
        beat: 'Kill their small creatures early and keep your life total high enough to take a hit.',
        after: 'Ramunap Ruins was banned in Standard in January 2018. It is not in this act\'s sets, so this tribute plays an ordinary Mountain instead.'},
      blurb: 'Deep in the archive, the summer red decks ruled the sand.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'GW Cats', colors: 'GW', archetype: 'Aggro', list: `
4 Pride Sovereign
4 Hooded Brawler
4 Majestic Myriarch
4 Ramunap Excavator
4 Regal Caracal
4 Gideon's Defeat
4 Sixth Sense
4 Oketra's Attendant
12 Forest
12 Plains
2 Ahn-Crop Champion
2 Prowling Serpopard`}},
      villain: {who: 'ramunap', deck: {label: 'tribute', name: 'Ramunap Red', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'R', archetype: 'Aggro', list: `
2 Hazoret the Fervent
4 Bloodrage Brawler
4 Earthshaker Khenra
4 Combat Celebrant
4 Ahn-Crop Crasher
4 Wildfire Eternal
4 Pathmaker Initiate
4 Abrade
4 Open Fire
2 Glorybringer
24 Mountain`}},
      scene: [q('stage', 'To Hazoret, those who fight for her are her beloved children.'),
        s('you', 'This one is fast. Block early and do not take the first hit.')],
      villainScene: [q('stage', 'This world was once so much more than the confines of Naktamun.')],
      cues: {hero: cue('Not today.', 'Burn it!', 'Too fast...', 'Cooled off.', 'Scorched...', 'Block the first attacker.'),
        villain: cue('[a roar]', '[the fire spreads]', '[a flame gutters]', '[ash]', '[the embers fade]')},
      after: [s('stage', 'Recorded: Ramunap Ruins banned in Standard, January 2018.')]},
  ],
};
