// Act 6: Urza's War (Urza's Saga, Legacy, Destiny, Classic Sixth Edition). Story and dialogue:
// /mnt/project-files/story/act-6-script.md (generated from this file). Land set: usg.
// Thousands of years before Acts 4 and 5: the story turns back to show where Gerrard came from.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'artificer-academy-phyrexian-machine',
  intro: [s('stage', 'Long before the Weatherlight. Long before Rath. The snow from the Sylex has barely melted.'),
    s('stage', "A broken man lies in an angel's garden. He hasn't moved in five years."),
    q('serra', 'Xantcha is recovering. The medicine is slow, but my magic would have killed her.'),
    q('urza', 'Fight? I cannot. I do not care if I live or die, so long as I can rest.'),
    s('xantcha', "You can rest when they're gone. They came for you, Urza. They'll come here next."),
    q('xantcha', 'Yawgmoth spent eons wrapping Phyrexians in human skin. They are the sleeper agents, and they are everywhere.')],
  finale: [s('stage', 'Tolaria, years later. A nursery of machines.'),
    q('rayne', 'Stop thinking like an artificer, Urza, and start thinking like a father!'),
    s('urza', 'I am thinking like a father. A father of a weapon.'),
    s('urza', 'Bloodlines. Generations of them. Each one a little closer to the hero this world will need.'),
    s('karn', 'And when he is born?'), s('urza', "You'll keep the Legacy for him, Karn. He'll need it. He won't want it."),
    s('stage', 'A boy will be born in Jamuraa, a thousand years from now, and handed to a sidar named Kondo. His name will be Gerrard.'),
    q('barrin', 'You cannot possibly know the toll your alliances will exact from you.')],
  villainFinale: [s('stage', 'Tolaria burns. The time bubble hangs over it like a frozen tear.'),
    q('gix', 'Grief is as useless as love.'), s('gix', "Your brother listened to me, Urza. He's the only Thran heir who ever did."),
    s('gix', 'I will bring the Father of Machines your head. Perhaps then he will look at me.'),
    s('yawgmoth', 'You have done adequately, praetor. Return to your vats.'),
    s('stage', 'Gix bows so low his cables scrape the floor. He does not get the look.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Opportunity', number: '37'},
    urza: {name: 'Urza', title: 'Lord High Artificer', fixed: fixed('Urza, Lord High Artificer', 'mh1', '75', '9e7fb3c0-5159-4d1f-8490-ce4c9a60f567', 'Grzegorz Rutkowski'), focus: '50% 25%'},
    serra: {name: 'Serra', title: 'Creator of the Realm', fixed: fixed('Serra the Benevolent', 'mh1', '26', '88bf4af9-4b14-43e7-9d50-0e6a895cece1', 'Magali Villeneuve'), focus: '50% 25%'},
    xantcha: {name: 'Xantcha', title: 'Phyrexian Outcast', fixed: fixed('Xantcha, Sleeper Agent', 'c18', '50', '89b03b9a-7e20-47cb-bc64-23513acea855', 'Mark Winters'), focus: '50% 25%'},
    priest: {name: 'Priest of Gix', title: 'Phyrexian Invader', card: 'Priest of Gix', number: '150', focus: '50% 30%'},
    jhoira: {name: 'Jhoira', title: 'Ghitu Artificer', fixed: fixed('Jhoira of the Ghitu', 'fut', '157', '1f437128-3a87-4958-97d0-3940d8761cba', 'Kev Walker'), focus: '50% 25%'},
    goblin: {name: 'Grunk', title: 'Goblin Chieftain of Shiv', card: 'Goblin Raider', focus: '50% 30%'},
    teferi: {name: 'Teferi', title: 'Third-Level Student', card: 'Disruptive Student', number: '69', focus: '50% 25%'},
    barrin: {name: 'Barrin', title: 'Master Wizard', card: 'Barrin, Master Wizard', number: '63', focus: '50% 25%'},
    kerrick: {name: 'Kerrick', title: 'Sleeper Agent', card: 'Phyrexian Plaguelord', number: '62', focus: '50% 30%'},
    rofellos: {name: 'Rofellos', title: 'Llanowar Emissary', card: 'Rofellos, Llanowar Emissary', number: '118', focus: '50% 25%'},
    multani: {name: 'Multani', title: 'Maro-Sorcerer of Yavimaya', card: 'Multani, Maro-Sorcerer', number: '107', focus: '50% 30%'},
    rayne: {name: 'Rayne', title: 'Academy Chancellor', card: 'Rayne, Academy Chancellor', number: '43', focus: '50% 25%'},
    gatha: {name: 'Gatha', title: 'Tolarian Renegade', card: 'Twisted Experiment', number: '74', focus: '50% 30%'},
    radiant: {name: 'Radiant', title: 'Archangel', card: 'Radiant, Archangel', number: '20', focus: '50% 25%'},
    gix: {name: 'Gix', title: 'Yawgmoth Praetor', fixed: fixed('Gix, Yawgmoth Praetor', 'bro', '95', '2c76f7e0-37e7-4e87-93a3-a25ba0674645', 'Anna Podedworna'), focus: '50% 25%'},
    yawgmoth: {name: 'Yawgmoth', title: 'Father of Machines', fixed: fixed('Yawgmoth, Thran Physician', 'mh1', '116', '8690cbcc-f8fd-41f7-9e28-e61c12b04014', 'Mark Winters'), focus: '50% 25%'},
    karn: {name: 'Karn', title: 'Silver Golem', fixed: fixed('Karn, Silver Golem', 'usg', '298', '811a0988-2900-426c-9413-8f1778d99678', 'Mark Zug'), focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: "Serra's Realm", difficulty: 'Easy', rewardSet: 'usg', teaches: ['Enchantments'],
      blurb: "Serra built a world out of faith and let a broken planeswalker sleep in it. Then the things hunting him found the door.",
      hero: {who: 'serra', deck: {name: "Serra's Host", colors: 'W', list: `
4 Serra Zealot
4 Serra Advocate
4 Sanctum Custodian
4 Herald of Serra
4 Intrepid Hero
2 Serra Avatar
4 Pacifism
4 Serra's Embrace
4 Glorious Anthem
2 Absolute Grace
24 Plains`}},
      villain: {who: 'priest', deck: {name: 'The First Legion', colors: 'B', list: `
4 Phyrexian Ghoul
4 Phyrexian Debaser
4 Bog Raiders
4 Lurking Evil
4 Priest of Gix
4 Phyrexian Monitor
4 Unworthy Dead
4 Crazed Skirge
4 Befoul
24 Swamp`}},
      scene: [s('priest', 'The artificer is here. We can smell the brass in him.'), q('serra', 'Let Phyrexia breed evil in the darkness; my holy light will reveal its taint.'),
        s('priest', 'Light. Faith. Wings. All of it is just meat that believes things.'), q('serra', 'Believe in the ideal, not the idol.'),
        s('serra', 'Planeswalker. Whoever you are. Stand with my angels.')],
      villainScene: [q('priest', 'Gix doesn\'t want a people to rule but puppets to entertain his madness.'), s('priest', 'We are the puppets. Watch us dance.'),
        q('priest', 'Ash is our air, darkness our flesh.')],
      cues: {hero: cue('Rise, my host.', 'Lifted beyond herself, an angel of light and fury.', 'The realm is fragile as glass...', 'Go back to your machines.', 'They are in the garden...'),
        villain: cue('Excise them.', 'In Yawgmoth\'s name!', 'Meat... fails...', 'The realm is tainted now. Forever.', 'More will come.')},
      after: [q('stage', 'In pursuit of Urza, the Phyrexians sent countless foul legions into Serra\'s realm. Though beaten back, they left it tainted.')]},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'It Hums', difficulty: 'Easy', rewardSet: 'usg', teaches: ['Echo'],
      blurb: "Urza needs the ancient Thran mana rig under the mountains of Shiv. The goblins worship it, the viashino guard it, and nobody knows what it does.",
      hero: {who: 'jhoira', deck: {name: 'The Ghitu', colors: 'R', list: `
4 Ghitu Slinger
4 Avalanche Riders
4 Keldon Champion
4 Keldon Vandals
4 Thundering Giant
2 Crater Hellion
2 Lightning Dragon
2 Ghitu Fire-Eater
2 Shower of Sparks
4 Arc Lightning
4 Fire Ants
24 Mountain`}},
      villain: {who: 'goblin', deck: {name: 'The Goblins of Shiv', colors: 'R', list: `
4 Goblin Raider
4 Goblin Lackey
4 Goblin Matron
4 Goblin Patrol
4 Goblin Medics
4 Goblin Spelunkers
4 Raging Goblin
4 Shower of Sparks
4 Goblin War Buggy
24 Mountain`}},
      scene: [s('urza', 'What does it do?'), q('jhoira', 'When Urza asked the viashino what it did, they answered: "It hums."'),
        s('goblin', 'THE HUMMER IS OURS! The Hummer gave us fire and noise and Grunk!'), s('jhoira', 'Grunk is you?'), s('goblin', 'Grunk is CHIEFTAIN.'),
        q('jhoira', 'They are called Mi\'uto, which means one use.'), s('jhoira', 'My fighters hit twice as hard. Pay for them twice, or lose them.')],
      villainScene: [s('goblin', 'Tall man wants the Hummer.'), s('goblin', 'Nobody gets the Hummer. Grunk barely gets the Hummer.'), s('goblin', 'CHARGE! No. Wait. Yes. CHARGE!')],
      cues: {hero: cue('Fire up the forge.', 'One use. Make it count.', 'I wonder how it feels to be bored.', 'It hums. Now it hums for us.', 'Back to the tunnels!'),
        villain: cue('FOR THE HUMMER!', 'Grunk made a BIG one!', 'Grunk is having a bad day.', 'Hummer stays! Hummer hums!', 'Grunk will be back. Grunk always comes back.')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Always Late for Class', difficulty: 'Easy', rewardSet: 'usg', teaches: ['Cycling'],
      blurb: 'Tolaria, an island academy where Urza trains the minds that will fight Phyrexia. Its most gifted student is a boy called Teferi. He has never once been on time.',
      hero: {who: 'teferi', deck: {name: 'Third-Level Mischief', colors: 'U', list: `
4 Miscalculation
4 Disruptive Student
4 Pendrell Drake
4 Peregrine Drake
4 Stern Proctor
4 Thieving Magpie
4 Counterspell
2 Air Elemental
2 Rewind
4 Opportunity
4 Remote Isle
20 Island`}},
      villain: {who: 'barrin', deck: {name: "The Master's Exam", colors: 'U', list: `
4 Sandbar Serpent
4 Horseshoe Crab
4 Air Elemental
4 Annul
4 Power Sink
4 Fog Bank
4 Catalog
4 Wind Drake
4 Unsummon
24 Island`}},
      scene: [q('barrin', 'Teferi is a problem student. Always late for class. No appreciation for constructive use of time.'),
        s('teferi', 'I was on time. Time just arrived late.'), q('barrin', 'To fill your mind with knowledge, we must start by emptying it.'),
        s('barrin', "Today's exam: a duel. If a card is useless, throw it away and draw another. It's called cycling."),
        q('teferi', 'I preferred the harsh tutors. They made mischief all the more fun.')],
      villainScene: [q('barrin', 'Without order comes errors, and errors kill on Tolaria.'), s('barrin', "He's the most gifted child I've ever taught. Someone has to keep him alive."),
        q('barrin', 'Time flows like a river. In Tolaria we practice the art of building dams.')],
      cues: {hero: cue("Don't worry, I've done the reading. Some of it.", 'Ha! Did you see that?', 'Is this graded?', 'Can I go now?', "I'll be late for detention too."),
        villain: cue('Begin.', 'Knowledge is no more expensive than ignorance.', 'Focus, Teferi.', 'See me after class.', 'Fine. Full marks. Don\'t tell anyone.')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Sleeper', difficulty: 'Normal', rewardSet: 'ulg', teaches: ['Sacrifice'],
      blurb: 'One of Tolaria\'s own has been a Phyrexian all along. Kerrick hid inside a fast-time bubble where years pass in a day, and built himself an army.',
      hero: {who: 'xantcha', deck: {name: "The Outcast's Knives", colors: 'B', list: `
4 Phyrexian Ghoul
4 Bone Shredder
4 Phyrexian Monitor
4 Bog Raiders
4 Spined Fluke
4 Order of Yawgmoth
4 Duress
4 Yawgmoth's Edict
4 Corrupt
24 Swamp`}},
      villain: {who: 'kerrick', deck: {name: "Kerrick's Brood", colors: 'B', list: `
4 Phyrexian Debaser
4 Phyrexian Defiler
4 Phyrexian Denouncer
4 Phyrexian Broodlings
4 Engineered Plague
4 Eviscerator
4 Ravenous Rats
4 Sicken
4 Unworthy Dead
24 Swamp`}},
      scene: [q('kerrick', 'The fools thought me dead. But I built an empire inside my tomb.'), q('kerrick', 'We had years to prepare, while they had mere minutes.'),
        s('xantcha', "I know what you are. I was made in the same vats."), s('kerrick', "You're defective. The priests said so."),
        q('xantcha', "If fear is the only tool you have left, then you'll never control me."),
        s('xantcha', 'Phyrexians spend themselves like coins. So will I. Better.')],
      villainScene: [q('kerrick', 'With limited resources and near unlimited time, I used parts from one beast to build another.'),
        s('kerrick', 'Stage one: rash and nausea. Stage four: delirium and death. Tolaria is at stage zero.'),
        s('kerrick', "And the outcast? She'll make good parts.")],
      cues: {hero: cue('Phyrexia\'s purity permits no other.', 'Spend it. Spend it all.', 'Planeswalking isn\'t about walking. It\'s about falling and screaming.', 'One less sleeper.', 'Urza... warn them...'),
        villain: cue('The illness begins.', 'The final stage!', 'Some borders can never be crossed.', 'Tolaria is infected.', 'Sealed... in my own tomb...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Dreaming Grove', difficulty: 'Normal', rewardSet: 'ulg', teaches: ['Mana creatures'],
      blurb: "Urza wants Yavimaya to grow living weapons for him. Yavimaya's guardian answers by swallowing him in a tree. An elf from Llanowar has to talk the forest down.",
      hero: {who: 'rofellos', deck: {name: 'The Emissary', colors: 'G', list: `
2 Rofellos, Llanowar Emissary
4 Llanowar Elves
4 Priest of Titania
4 Elvish Lyrist
4 Yavimaya Elder
4 Albino Troll
4 Cradle Guard
4 Pouncing Jaguar
4 Rancor
2 Rofellos's Gift
2 Gaea's Cradle
22 Forest`}},
      villain: {who: 'multani', deck: {name: 'Yavimaya Wakes', colors: 'G', list: `
2 Multani, Maro-Sorcerer
4 Yavimaya Wurm
4 Ancient Silverback
4 Yavimaya Scion
4 Multani's Acolyte
4 Giant Growth
4 Llanowar Elves
4 Elvish Herder
2 Emperor Crocodile
4 Treefolk Mystic
24 Forest`}},
      scene: [q('stage', "Urza's wards fell from him like autumn leaves as he entered the dreaming grove. He awoke imprisoned in living wood."),
        q('multani', 'Argoth\'s doom rained from a clear sky. Yavimaya will not share that fate.'), s('multani', 'You burned Argoth, artificer. I remember the smoke.'),
        q('multani', 'To make peace with the forest, make peace with me.'), s('rofellos', "Then make peace with me, maro. I'm not him. I'm from Llanowar, and I'm rude."),
        q('stage', 'Much to Multani\'s chagrin, Rofellos gleefully tutored Yavimaya\'s elves on the rudest words spoken in Llanowar.')],
      villainScene: [q('multani', 'When a tree falls in the forest, Multani hears it.'), s('multani', 'I heard every tree on Argoth fall. Every one.'),
        q('multani', 'This is my place of power. Nothing can take root here unless I allow it.')],
      cues: {hero: cue("Llanowar's here. Try to keep up.", 'The forest answers ME today.', 'Easy, big tree. Easy.', 'Let him go. He needs us. We need him.', "Fine. You win. Keep him a while."),
        villain: cue('The forest wakes.', 'Yavimaya rises!', 'Bark splits...', 'The artificer stays in the wood.', 'Rise, elf. We are both of Gaea, and thus we are equal.')},
      after: [q('multani', 'Rise, elf. We are both of Gaea, and thus we are equal.'), s('multani', 'Tell the artificer: Yavimaya will fight. For Dominaria. Not for him.')]},
    {slot: 6, mood: 'tension', kind: 'Meta', title: 'The Time Rift', difficulty: 'Normal', rewardSet: 'uds', teaches: ['Artifact mana'],
      blurb: 'The academy works with time, until time runs out. In the slow bubble, a renegade named Gatha breeds his own students. It is the most broken deck ever made, and the reason bans exist.',
      hero: {who: 'rayne', deck: {name: "The Chancellor's Rule", colors: 'WU', list: `
2 Rayne, Academy Chancellor
4 Thieving Magpie
4 Metathran Soldier
4 Serra Advocate
4 Capashen Templar
4 Disruptive Student
4 Counterspell
4 Miscalculation
4 Disenchant
2 Rescue
12 Plains
12 Island`}},
      villain: {who: 'gatha', deck: {name: 'Academy', colors: 'U', archetype: 'Academy', list: `
1 Tolarian Academy
4 Grim Monolith
4 Voltaic Key
4 Stroke of Genius
1 Time Spiral
1 Tinker
4 Thran Dynamo
4 Thran Golem
4 Counterspell
4 Opportunity
2 Sandbar Serpent
4 Rewind
23 Island`}},
      scene: [q('stage', 'The flow of time was disrupted; like a flooding river it rose from its banks. Tolaria was drowned in an instant that stretched toward infinity.'),
        q('gatha', 'The academy educates; I employ. It\'s a perfect arrangement.'),
        q('rayne', "Urza, I've discovered more promising students than you and my husband have, combined. And I haven't lost a single one."),
        q('gatha', "Of course she's at the head of her class. All her classmates have disappeared."), s('rayne', 'Not today, Gatha.')],
      villainScene: [s('gatha', 'They call it breaking. I call it a breakthrough.'), s('gatha', 'Mana from nothing. Spells from nothing. Victory from nothing.'),
        q('gatha', 'This monstrosity will do, for now.')],
      cues: {hero: cue('Class is in session.', 'Detention. Permanently.', "I've had worse faculty meetings.", 'You\'re expelled.', 'Get the children out of the bubble!'),
        villain: cue('Shall we break something?', 'Look what the machines give!', 'The experiment... destabilises...', 'Fascinating.', 'Write it down. Write it all down.')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Planar Collapse', difficulty: 'Normal', rewardSet: 'uds', teaches: ['Enchantments returning'],
      blurb: "Serra has left her realm, and it is dying. Urza returns to take what's left of it to build his war. Radiant, the archangel now in charge, has been waiting for him.",
      hero: {who: 'urza', deck: {name: 'The Artificer\'s War', colors: 'U', list: `
4 Metathran Soldier
4 Pendrell Drake
4 Thran Golem
4 Mantis Engine
4 Peregrine Drake
4 Counterspell
4 Annul
4 Stroke of Genius
4 Grim Monolith
24 Island`}},
      villain: {who: 'radiant', deck: {name: 'Replenish', colors: 'WU', archetype: 'Replenish', list: `
2 Radiant, Archangel
4 Replenish
4 Attunement
3 Opalescence
4 Pacifism
4 Glorious Anthem
4 Serra Zealot
4 Sustainer of the Realm
3 Defender of Law
4 Counterspell
12 Plains
12 Island`}},
      scene: [q('radiant', 'He has returned. He who brought the dark ones. He who poisoned our paradise. How shall we greet him? With swift and certain death!'),
        q('urza', 'Do not treat your people as you treat your artifacts. Let them go, and they will live; seal them here, and they will die.'),
        q('radiant', 'Serra ruled by faith. I cannot afford that luxury.'), s('urza', 'Your realm is collapsing. I can use what remains.'),
        q('radiant', 'The harder you push, the stronger we become.')],
      villainScene: [q('radiant', 'Go, then, and leave this world to those who truly care.'), s('radiant', "That's what I said to Serra. Now I say it to you."),
        q('radiant', 'I stand ready to die for our world. Who will stand with me?')],
      cues: {hero: cue('Proceed.', 'Exactly as designed.', 'Recalculating.', 'Dismantle it. Carefully.', 'An inefficient result.'),
        villain: cue('For the realm!', 'Everything returns. Everything!', 'In time our realm will shine again.', 'Leave and never return.', 'Serra... forgive me...')},
      after: [q('stage', "With heavy heart, Urza doused one world's light to rekindle another's.")]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: "Gix's Assault", difficulty: 'Hard', rewardCard: 'Bone Shredder', rewardSet: 'uds', teaches: ['Everything so far'],
      blurb: 'Gix has come for Tolaria himself. Yawgmoth\'s praetor, the voice in Mishra\'s ear at the Brothers\' War. He has waited three thousand years to finish the brother who got away.',
      hero: {who: 'urza', deck: {name: "Tolaria's Defenders", colors: 'WU', list: `
4 Metathran Soldier
4 Thran Golem
4 Serra Advocate
4 Serra Zealot
4 Mantis Engine
4 Counterspell
4 Disenchant
4 Pacifism
2 Serra Avatar
2 Rescue
12 Plains
12 Island`}},
      villain: {who: 'gix', deck: {name: 'The Praetor\'s Court', colors: 'B', list: `
4 Dark Ritual
4 Duress
4 Bone Shredder
4 Order of Yawgmoth
4 Phyrexian Ghoul
4 Sanguine Guard
4 Yawgmoth's Edict
4 Corrupt
2 Phyrexian Monitor
2 Grim Monolith
24 Swamp`}},
      scene: [s('gix', 'Urza. You look old.'), s('urza', 'You sound like him.'),
        s('gix', 'Mishra? Of course I do. I taught him half his words.'), s('gix', 'Someone else was listening, Urza. It was me.'),
        q('stage', 'A foul, metallic stench clogged Urza\'s senses. It was then he knew his brother was no more.'),
        s('urza', 'You took my brother. You will not take my school.'), q('gix', 'We decide who is worthy of our works.')],
      villainScene: [q('gix', 'All bonds are parasitic. Only rulership is pure.'), s('gix', 'Yawgmoth has a hundred praetors. He looks at one at a time.'),
        s('gix', "Bring him Urza's head, and he'll look at me. Just once."), q('gix', 'Let go your mind. Mine is fitter.')],
      cues: {hero: cue('Begin.', 'The solution can hide for only so long.', 'Mishra... I should have listened.', 'Go back to your master.', 'Tolaria... the children...'),
        villain: cue('In Yawgmoth\'s name.', 'They are bred to suffer and born to die. Much like humans.', 'Grief is as useless as love.', 'Father of Machines, witness!', 'Not every cage is made of bars.'),
        }},
  ],
};
