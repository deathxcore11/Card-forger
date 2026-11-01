// Act 10: The False God (Onslaught, Legions, Scourge, Eighth Edition). Story and dialogue:
// /mnt/project-files/story/act-10-script.md (generated from this file). Land set: ons.
// A few years after Act 9: the Mirari has twisted Krosa, Kamahl has become a druid, and the Cabal
// has remade Jeska into Phage. Ixidor imagines an angel to destroy her. Every quoted line is real flavor text.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'grand-coliseum-mutant-krosa',
  intro: [s('stage', 'Otaria, a few years after the Mirari went into the ground.'),
    q('stage', 'The Mirari twisted all that lived in the Krosan Forest into gross mockeries of their former selves.'),
    s('stage', 'Kamahl lives in Krosa now. He does not fight anymore. He listens to the trees.'),
    q('kamahl', 'Destruction is the work of an afternoon. Creation is the work of a lifetime.'),
    s('stage', 'In the Grand Coliseum, the Cabal has a new champion. Her touch is death. They call her Phage.')],
  finale: [s('stage', 'Karona falls. Whatever was Akroma and whatever was Phage goes quiet with her.'),
    q('karona', 'Rise once more, so you may continue to destroy our enemies.'),
    s('stage', 'Nobody rises.'),
    s('ixidor', 'I made her to kill Phage. I never asked what she wanted. Neither did the Cabal.'),
    s('kamahl', 'Jeska wanted to go home. That was all she ever wanted.'),
    q('stage', "As Phage drank their energy, a vague memory of Jeska stirred. Then she lost herself again in the joy of her victims' suffering."),
    s('stage', 'Kamahl buries what is left in Krosa. The forest grows around it, slowly, the normal way.'),
    s('stage', 'Otaria rests. The Mirari is spent. For a while, nobody on Dominaria is anybody\'s god.')],
  villainFinale: [s('stage', 'Karona stands over the Coliseum. Every eye in Otaria turns to her, and every heart.'),
    s('karona', 'They worship me. I do not know why. I do not know what I am.'),
    s('karona', 'An angel built from a grieving man\'s dream. A girl the Cabal broke and rebuilt.'),
    s('karona', 'I only ever wanted to know what I was. Nobody can tell me. So I will make them kneel until someone does.'),
    s('stage', 'Across Otaria, people kneel. None of them can answer her.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Future Sight', number: '84'},
    kamahl: {name: 'Kamahl', title: 'Fist of Krosa', card: 'Kamahl, Fist of Krosa', number: '268', focus: '50% 25%'},
    ixidor: {name: 'Ixidor', title: 'Reality Sculptor', card: 'Ixidor, Reality Sculptor', number: '89', focus: '50% 25%'},
    akroma: {name: 'Akroma', title: 'Angel of Wrath', card: 'Akroma, Angel of Wrath', number: '1', focus: '50% 25%'},
    phage: {name: 'Phage', title: 'The Untouchable', card: 'Phage the Untouchable', number: '78', focus: '50% 25%'},
    karona: {name: 'Karona', title: 'False God', card: 'Karona, False God', number: '138', focus: '50% 25%'},
    patriarch: {name: 'The Patriarch', title: 'Head of the Cabal', fixed: fixed('Cabal Patriarch', 'ody', '120', '0d2f0da3-a13e-4a45-98dc-6227cf952a5e', 'Mark Zug'), focus: '50% 25%'},
    braids: {name: 'Braids', title: 'Dementia Summoner', fixed: fixed('Braids, Cabal Minion', 'ody', '117', '4dcdcad5-e4fb-480e-984f-1ac5cdc986b9', 'Eric Peterson'), focus: '50% 25%'},
    pemmin: {name: 'Pemmin', title: 'Riptide Survivor', card: 'Riptide Survivor', number: '48', focus: '50% 30%'},
    hivemaster: {name: 'The Hivemaster', title: 'Keeper of Wirewood', card: 'Wirewood Hivemaster', number: '145', focus: '50% 30%'},
    beast: {name: 'The Towering Baloth', title: 'Child of the Mirari', card: 'Towering Baloth', number: '292', focus: '50% 30%'},
    sliver: {name: 'The Slivers', title: 'Riptide Escapees', card: 'Sliver Overlord', number: '139', focus: '50% 30%'},
    daru: {name: 'Daru Warchief', title: 'The Order', card: 'Daru Warchief', number: '6', focus: '50% 30%'},
    goblin: {name: 'Siege-Gang Commander', title: 'Skirk Ridge Boss', card: 'Siege-Gang Commander', number: '103', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Faces in the Crowd', difficulty: 'Easy', rewardSet: 'ons', teaches: ['Morph'],
      blurb: "Ixidor and Nivea are illusionists who fight in the Grand Coliseum, and they are in love. They are also winning too much, and the Patriarch does not like surprises.",
      hero: {who: 'ixidor', deck: {name: 'Reality Sculptor', colors: 'U', list: `
2 Ixidor, Reality Sculptor
4 Echo Tracer
4 Riptide Entrancer
4 Ascending Aven
4 Keeneye Aven
4 Riptide Survivor
4 Sage Aven
4 Complicate
4 Ghosthelm Courier
2 Arcanis the Omnipotent
24 Island`}},
      villain: {who: 'patriarch', deck: {name: 'Crowd Favorites', colors: 'B', list: `
4 Cabal Executioner
4 Severed Legion
4 Undead Gladiator
4 Festering Goblin
4 Headhunter
4 Grinning Demon
4 Smother
4 Cruel Revival
4 Withering Hex
24 Swamp`}},
      scene: [q('patriarch', 'The rabble likes them. Make sure they win, then book them for tomorrow.'),
        s('ixidor', 'Nivea says the crowd is louder tonight. I think they are louder for us.'),
        q('stage', 'Newcomers to Otaria find themselves at the bottom of the heap. In the pits, they at least have the chance to climb atop a heap of bodies.'),
        s('ixidor', 'Morph: play a creature face down as a 2/2 for three. Turn it up when they least expect it. Every face in the crowd is a secret.'),
        q('ixidor', 'Shaping reality is simply a matter of knowing where to apply pressure.')],
      villainScene: [s('patriarch', 'The illusionists are popular. Popular is useful. Too popular is dangerous.'),
        q('patriarch', 'Family plots are so convenient.'),
        s('patriarch', 'Let them win tonight. Tomorrow, give the girl a real opponent.')],
      cues: {hero: cue('For Nivea.', 'Now you see it.', 'Something is wrong tonight...', 'Did you hear them, Nivea? They were cheering.', 'Nivea, get out of the arena!', 'Every face is a lie. Some lies bite.'),
        villain: cue('Begin.', 'The crowd loves a reveal.', 'The odds are shifting...', 'Book them for tomorrow.', 'Tomorrow, then.')},
      after: [s('stage', 'Tomorrow, Nivea is given a real opponent. Ixidor is made to watch.'),
        q('ixidor', 'My past holds only pain and loss. I will conquer it by creating the perfect future.'),
        s('stage', 'Exiled to the desert, alone, Ixidor begins to dream of an angel. A beautiful one, with a sword, who hates the Cabal as much as he does.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Kinship', difficulty: 'Easy', rewardSet: 'ons', teaches: ['Tribes'],
      blurb: "The Mirari's power is still bleeding out of Krosa, and the beasts it made are spilling into the Wirewood forest next door. The elves of Wirewood are few, but they fight together.",
      hero: {who: 'hivemaster', deck: {name: 'Wirewood', colors: 'G', list: `
4 Wirewood Elf
4 Elvish Warrior
4 Elvish Vanguard
4 Timberwatch Elf
4 Wirewood Hivemaster
4 Elvish Pioneer
4 Wellwisher
4 Wirewood Herald
4 Wirewood Pride
24 Forest`}},
      villain: {who: 'beast', deck: {name: 'Mutated Krosa', colors: 'G', list: `
4 Krosan Tusker
4 Ravenous Baloth
4 Snarling Undorak
4 Barkhide Mauler
4 Spitting Gourna
4 Berserk Murlodont
4 Krosan Vorine
4 Explosive Vegetation
4 Silklash Spider
24 Forest`}},
      scene: [q('stage', "No one in Wirewood understands what is happening. They just know it's unnatural—and coming from Krosa."),
        q('hivemaster', 'Most insects have been drawn to the Mirari. But all that remain in Wirewood are under my care.'),
        s('beast', 'HRRRRMMMMMM.'),
        q('stage', 'Even through the Mirari\'s voice, the elves still hear the call of their kinship.'),
        s('hivemaster', 'Every elf makes every other elf stronger. A tribe is a card that counts its friends. Play them together.')],
      villainScene: [q('stage', '"The harder we press forward, the harder Krosa pushes us back." —Aven scout'),
        s('beast', 'HRRRM. Hungry. Was a deer once. Remember being a deer.'),
        q('stage', 'The blood of Krosa turns rational beings into primal forces.')],
      cues: {hero: cue('Wirewood, together.', 'The kin answers!', 'Too big... they are too big...', 'Go home, poor thing. If you still have one.', 'Fall back to the old trees!', 'Elves never fight alone.'),
        villain: cue('HRRRRM!', 'BIGGER. ALWAYS BIGGER.', 'Hurt... remember hurt...', 'HRRRM. Quiet now.', 'Was... a deer...')},
      after: [q('stage', 'No matter your strength, the Krosan Forest is stronger. No matter your speed, the Wirewood Forest is faster.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Riptide Project', difficulty: 'Easy', rewardSet: 'lgn', teaches: ['Slivers'],
      blurb: "A school of wizards on an island tried to recreate the slivers in a lab. They did. Now the slivers own the island, and Pemmin is the last researcher who hasn't been eaten.",
      hero: {who: 'pemmin', deck: {name: 'Riptide Survivors', colors: 'U', list: `
4 Riptide Survivor
4 Information Dealer
4 Fugitive Wizard
4 Riptide Biologist
4 Crafty Pathmage
4 Disruptive Pitmage
4 Sage Aven
4 Mage's Guile
4 Aven Envoy
24 Island`}},
      villain: {who: 'sliver', deck: {name: 'The Escapees', colors: 'RG', list: `
4 Blade Sliver
4 Hunter Sliver
4 Magma Sliver
4 Quick Sliver
4 Root Sliver
2 Brood Sliver
4 Shock
4 Primal Boost
4 Spark Spray
2 Run Wild
12 Mountain
12 Forest`}},
      scene: [q('stage', 'Taking the form of a junior researcher, the first sliver slipped out of Riptide.'),
        q('stage', 'The directors of the Riptide Project wanted instant results on the sliver experiments. They got their wish.'),
        s('pemmin', 'Right. Nobody panic. I am panicking for all of us.'),
        q('pemmin', 'Hold that thought.'),
        s('pemmin', 'Every sliver shares its ability with every other sliver. So kill the one that shares the best thing first.')],
      villainScene: [s('sliver', 'sssss.'), s('sliver', 'sssss. SSSSSS.'), s('stage', 'There are a lot more of them now.'),
        q('stage', "\"Death couldn't contain the slivers. What made us think we could?\" —Riptide Project researcher")],
      cues: {hero: cue('Positions, everyone! Everyone? Hello?', 'Got one!', 'They learned to open doors...', 'Write it down: we survived. Underline it.', "If I wanted your opinion, I'd have told you what it was.", 'Hold that thought.'),
        villain: cue('sssss.', 'SSSSSS!', 'sss...', 'SSSSSSSSS.', 'sss.')},
      after: [q('stage', 'The grounds of the Riptide Project are now populated only by slivers, broken beakers, and the lonely screeching of gulls.'),
        s('pemmin', 'I am putting in for a transfer.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Untouchable', difficulty: 'Normal', rewardSet: 'lgn', teaches: ['Alternate wins'],
      blurb: "Kamahl hears that the Cabal's champion has a face he knows. He leaves Krosa for the first time in years and walks into the Coliseum. Phage is waiting. She does not remember him.",
      hero: {who: 'kamahl', deck: {name: 'Fist of Krosa', colors: 'G', list: `
2 Kamahl, Fist of Krosa
4 Elvish Warrior
4 Krosan Tusker
4 Ravenous Baloth
4 Wirewood Savage
4 Timberwatch Elf
4 Wellwisher
4 Krosan Vorine
4 Silklash Spider
2 Krosan Colossus
24 Forest`}},
      villain: {who: 'phage', deck: {name: 'The Untouchable', colors: 'B', list: `
2 Phage the Untouchable
4 Skinthinner
4 Withered Wretch
4 Vile Deacon
4 Drinker of Sorrow
4 Graveborn Muse
4 Smother
4 Swat
4 Cabal Executioner
2 Infest
24 Swamp`}},
      scene: [s('kamahl', 'Jeska.'), s('phage', 'Who?'),
        q('phage', 'I do unto others as others have done unto me.'),
        s('kamahl', 'I did this to you. I know. Come home and let me make it right.'),
        q('phage', "I can't hear them scream, but at least I don't have to listen to them beg."),
        s('kamahl', 'If Phage hits you even once, you lose the game. Not life. The game. Never let her through.')],
      villainScene: [q('phage', 'Their blood is the nectar that nourishes the Cabal.'),
        s('phage', 'The barbarian keeps saying a name. It makes my head hurt.'),
        s('phage', 'The Cabal says I was born in a vat. The Cabal is never wrong. I touch him, and the hurting stops.')],
      cues: {hero: cue('Jeska. Please.', 'Krosa, hold her back. Gently.', 'Do not let her touch you...', 'You are still in there. I saw it.', 'Jeska... I am sorry...', 'Steel, Jeska. Remember? You had a temper of steel.'),
        villain: cue('Come here, barbarian.', 'Few cross me twice.', 'Stop... saying... that name...', 'Untouchable.', 'Who... was Jeska?')},
      after: [s('stage', 'Phage escapes into the Coliseum tunnels. For one heartbeat, at the end, she had looked at him like a sister.'),
        q('stage', 'Phage became both executioner and savior, helping others to the same rebirth she had found.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Angel of Wrath', difficulty: 'Normal', rewardSet: 'lgn', teaches: ['Cycling'],
      blurb: "Out in the desert, Ixidor's dream has opened its eyes. Akroma was made for one purpose: destroy Phage. She starts with the Cabal's Coliseum, and Braids is running it tonight.",
      hero: {who: 'akroma', deck: {name: "Akroma's Wrath", colors: 'WR', list: `
2 Akroma, Angel of Wrath
4 Exalted Angel
4 Lightning Rift
2 Akroma's Vengeance
4 Renewed Faith
4 Gustcloak Harrier
4 Daru Lancer
4 Akroma's Devoted
4 Spark Spray
4 Shock
12 Plains
12 Mountain`}},
      villain: {who: 'braids', deck: {name: "The Cabal's Coliseum", colors: 'B', list: `
4 Undead Gladiator
4 Gluttonous Zombie
4 Severed Legion
4 Nantuko Husk
4 Carrion Feeder
4 Festering Goblin
4 Smother
4 Cruel Revival
4 Soulless One
24 Swamp`}},
      scene: [q('stage', 'Akroma asked for only one thing from her troops: unwavering, unconditional loyalty.'),
        q('akroma', 'Until the world unites in vengeful fury and Phage is destroyed, I will not stay my hand.'),
        q('braids', 'How cute. Does it do any other tricks?'),
        s('akroma', 'Cycling: pay to discard a card and draw another. With Lightning Rift, every cycle is a bolt.'),
        q('akroma', 'It is from Phage that this evil springs, and to her it shall return.')],
      villainScene: [q('braids', 'I like goblins. They make funny little popping sounds when they die.'),
        s('braids', 'An angel who only wants one thing. I could have built that in an afternoon.'),
        q('braids', 'Finally, a use for that head of yours.')],
      cues: {hero: cue('Where is Phage?', 'Wrath.', 'Ixidor... your dream is bleeding...', 'Tell Phage I am coming.', 'I will not stay my hand.', 'I feed my hatred to the righteous and they join my crusade.'),
        villain: cue('Welcome to the Coliseum.', 'Gratuitous, isn\'t it?', 'Not my best work...', 'Book her for tomorrow.', 'She will find Phage anyway. That will be fun to watch.')},
      after: [q('stage', 'Ixidor had only to imagine their ruin and Akroma made it so.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Goblin Tides', difficulty: 'Normal', rewardSet: 'scg', teaches: ['Tokens'],
      blurb: "The Order's soldiers hold the Daru Plains against everything Otaria throws at them. This week it is goblins. A lot of goblins. They have a commander now, which is worse.",
      hero: {who: 'daru', deck: {name: 'The Daru Line', colors: 'W', list: `
4 Daru Warchief
4 Daru Lancer
4 Daru Healer
4 Glory Seeker
4 Whipcorder
4 Sunstrike Legionnaire
4 Catapult Squad
4 Gustcloak Skirmisher
4 Daru Cavalier
24 Plains`}},
      villain: {who: 'goblin', deck: {name: 'Siege-Gang', colors: 'R', list: `
2 Siege-Gang Commander
4 Goblin Piledriver
4 Goblin Warchief
4 Goblin Sledder
4 Skirk Prospector
4 Goblin Sharpshooter
4 Sparksmith
4 Goblin Taskmaster
4 Shock
2 Gempalm Incinerator
24 Mountain`}},
      scene: [q('stage', 'The tall, reedy grass of the Daru Plains rustles loudly in the winds, a perfect cover for any ambush.'),
        s('goblin', 'Boys! I count four soldiers. Charge!'), s('daru', 'There are forty of us.'), s('goblin', 'Boys! Count again!'),
        q('stage', "Daru soldiers learned it's better to have a clean death from a sharp blade than to tangle with a goblin's rusted chains."),
        s('daru', 'The commander makes more goblins every turn. Tokens count as creatures. Clear them before they snowball.')],
      villainScene: [s('goblin', 'Siege-Gang! Siege-Gang! We are a gang AND we siege!'),
        q('stage', 'Goblins resolve disputes by splitting everything straight down the middle.'),
        q('stage', "Goblins' motivational techniques are crude, but effective.")],
      cues: {hero: cue('Hold the line, Daru!', 'For the Order!', 'They just keep coming...', 'Count again, goblin.', 'Fall back to the ridge!', 'One more volley. Then one more.'),
        villain: cue('CHARGE! Wait. Count. CHARGE!', 'MORE GOBLINS!', 'Boys? Boys, where did everybody go?', 'Goblins is always winning!', 'Tactical retreat! That means run!')},
      after: [q('stage', 'Giant-sized body. Goblin-sized brain.'), s('daru', 'They will be back tomorrow. They are always back tomorrow.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Angel and Untouchable', difficulty: 'Normal', rewardSet: 'scg', teaches: ['Protection from a colour'],
      blurb: 'Akroma finally finds Phage. The angel made to kill her, and the girl made to kill everything. Both were made by someone else. Neither knows it.',
      hero: {who: 'akroma', deck: {name: 'Angel of Wrath', colors: 'W', list: `
2 Akroma, Angel of Wrath
4 Exalted Angel
4 Akroma's Devoted
4 Daru Lancer
4 Gustcloak Savior
4 Whipcorder
4 Glory Seeker
4 Pacifism
4 Renewed Faith
2 Akroma's Vengeance
24 Plains`}},
      villain: {who: 'phage', deck: {name: 'The Cabal\'s Champion', colors: 'B', list: `
2 Phage the Untouchable
4 Skinthinner
4 Withered Wretch
4 Vile Deacon
4 Graveborn Muse
4 Smother
4 Cabal Executioner
4 Grinning Demon
4 Severed Legion
2 Infest
24 Swamp`}},
      scene: [s('akroma', 'Phage. I was made for you.'), s('phage', 'Everyone says that. Then they touch me.'),
        s('akroma', 'My voice is justice. Clear and relentless.'),
        s('phage', 'You have a strange face, angel. Like someone dreamed you.'),
        s('akroma', 'Protection from black means her black spells and creatures cannot touch me. Not even her.')],
      villainScene: [s('phage', 'The barbarian said I had a brother. The angel says I have to die. Everyone knows what I am except me.'),
        s('phage', 'My voice is damnation, they tell me. Unyielding and certain.'),
        s('phage', 'I will touch the angel. Then maybe the hurting stops.')],
      cues: {hero: cue('For Ixidor.', 'Wrath.', 'Her touch... I can feel it through the steel...', 'It is done. Why do I feel nothing?', 'This was all I was for...', 'You cannot touch me.'),
        villain: cue('Come here, angel.', 'Untouchable.', 'Stop... looking at me like that...', 'Even angels die.', 'I... remember a forge...')},
      after: [s('stage', 'Neither one wins. At the moment their hands meet, Krosa answers, and the Mirari\'s last power pulls them together.'),
        s('stage', 'Angel and girl melt into one shape, crowned in light. Every eye in Otaria turns to look.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Karona, False God', difficulty: 'Hard', rewardCard: 'Exalted Angel', rewardSet: 'scg', teaches: ['Everything so far'],
      blurb: 'Akroma and Phage are gone. In their place stands Karona, a god made of an angel and a girl, worshipped by everyone who sees her. Kamahl and Ixidor, the two men who made her halves, go to end it.',
      hero: {who: 'kamahl', deck: {name: 'Kamahl and Ixidor', colors: 'GU', list: `
2 Kamahl, Fist of Krosa
2 Ixidor, Reality Sculptor
4 Elvish Warrior
4 Ravenous Baloth
4 Krosan Tusker
4 Echo Tracer
4 Riptide Entrancer
4 Timberwatch Elf
4 Silklash Spider
4 Complicate
12 Forest
12 Island`}},
      villain: {who: 'karona', deck: {name: 'The False God', colors: 'WB', list: `
2 Akroma, Angel of Wrath
2 Phage the Untouchable
4 Exalted Angel
4 Skinthinner
4 Withered Wretch
4 Smother
4 Akroma's Devoted
4 Graveborn Muse
4 Vile Deacon
4 Renewed Faith
12 Plains
12 Swamp`}},
      scene: [s('karona', 'Kneel.'), s('stage', 'Half of the Daru army kneels. So does half of the Cabal.'),
        s('ixidor', 'I made half of you. I am sorry.'), s('kamahl', 'I made the other half. I am sorrier.'),
        q('kamahl', 'There is no greater burden than choosing who to save.'),
        s('kamahl', 'She has both their decks, light and dark. Answer the angels and the Untouchable both. Nothing gets through.')],
      villainScene: [s('karona', 'You. You are the dreamer. And you, the brother.'),
        s('karona', 'Tell me what I am. Everyone kneels, but nobody can tell me what I am.'),
        q('karona', 'Rise once more, so you may continue to destroy our enemies.')],
      cues: {hero: cue('For Jeska. For Akroma. For both of them.', 'Krosa, wake!', 'She is too bright...', 'Rest now. Both of you.', 'Jeska... Akroma... I failed you both...', 'Nothing gets through.'),
        villain: {...cue('Kneel.', 'Rise once more.', 'I... am... what?', 'Everyone kneels.', 'At last... I know...'),
          half: {who: 'ixidor', line: 'Akroma, if you are still in there, I am sorry I never asked what you wanted.'}}}},
  ],
};
