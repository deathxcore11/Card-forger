// Act 12: The Kami War (Champions of Kamigawa, Betrayers of Kamigawa, Saviors of Kamigawa). Story and dialogue:
// /mnt/project-files/story/act-12-script.md (generated from this file). Land set: chk.
// Lord Konda stole something from the spirit world, and the spirits went to war with everyone. Toshiro Umezawa, a
// rogue with a stolen jitte, and Michiko, Konda's daughter, find out what it was. Every quoted line is real flavor
// text from Champions, Betrayers or Saviors of Kamigawa; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'kami-war-ink-and-lantern',
  era: '2005-08-20',
  intro: [s('stage', 'Kamigawa: a plane where every stone, river and sword has a spirit, the kami. For centuries mortals prayed and the kami answered.'),
    q('stage', 'Early in his reign, Konda fell ill. His head burned with fever, and he saw visions of his future. In them, he saw a spirit-child, and, in that child\'s eyes, a way to make his empire last forever.'),
    s('stage', 'Konda took something from the spirit world and locked it in his castle. The kami have been at war with every mortal ever since.'),
    q('stage', 'This god held prisoner in human hands has put all humanity in the hands of angry gods.')],
  finale: [s('stage', 'Konda falls in his own tower. The thing he stole twenty years ago is free: a small, shining kami-child, That Which Was Taken.'),
    s('michiko', 'Father. You did this for a castle that would last forever.'),
    s('stage', 'Freed, it goes home to O-Kagachi, the greatest of the kami, and the spirit world goes quiet.'),
    s('michiko', 'The war is over. Now someone has to rebuild what it broke.'),
    q('toshiro', 'Life is a series of choices between bad and worse.'),
    s('stage', 'The war is over. Twenty years later, a nezumi ninja will still be telling the story of the rogue who stole a jitte and helped end it.')],
  villainFinale: [s('stage', 'Toshiro lies on the floor of the Palace of Infinite Halls. Konda stands over him with the stolen kami at his back.'),
    q('konda', 'Duty and law are the foundation on which civilization stands. They must not fall, for when they do, they take everything with them.'),
    s('konda', 'The kami will tire. I will not. Eiganjo will stand forever.'),
    q('stage', 'Despite the massive forces that allied against him, Konda never once believed he would lose the Kami War.'),
    s('stage', 'Outside the castle walls, the war goes on.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', fixed: fixed('Fold into Aether', '5dn', '31', '615157d6-0160-417b-b06c-0e253b306c37', 'Anthony S. Waters & Cara Mitten')},
    takeno: {name: 'Takeno', title: 'Samurai General', card: 'Takeno, Samurai General', number: '46', focus: '50% 25%'},
    kami: {name: 'The Kami', title: 'Spirits at War', card: 'Kami of the Painted Road', focus: '50% 30%'},
    dosan: {name: 'Dosan', title: 'The Falling Leaf', card: 'Dosan the Falling Leaf', number: '205', focus: '50% 25%'},
    okiba: {name: 'The Okiba Gang', title: 'Nezumi Thieves', card: 'Nezumi Shortfang', number: '131', focus: '50% 30%'},
    kumano: {name: 'Kumano', title: 'Master Yamabushi', card: 'Kumano, Master Yamabushi', number: '176', focus: '50% 25%'},
    akki: {name: 'The Akki', title: 'Goblins of Sokenzan', card: 'Akki Raider', number: '92', focus: '50% 30%'},
    toshiro: {name: 'Toshiro', title: 'Umezawa, Rogue', card: 'Toshiro Umezawa', number: '89', focus: '50% 25%'},
    hidetsugu: {name: 'Hidetsugu', title: 'O-Bakemono of the Ogres', card: 'Heartless Hidetsugu', number: '107', focus: '50% 25%'},
    michiko: {name: 'Michiko', title: 'Konda, Truth Seeker', card: 'Michiko Konda, Truth Seeker', number: '19', focus: '50% 25%'},
    marrow: {name: 'Marrow-Gnawer', title: 'First Lord of the Nezumi', card: 'Marrow-Gnawer', number: '124', focus: '50% 25%'},
    azami: {name: 'Azami', title: 'Lady of Scrolls', card: 'Azami, Lady of Scrolls', focus: '50% 25%'},
    godo: {name: 'Godo', title: 'Bandit Warlord', card: 'Godo, Bandit Warlord', number: '169', focus: '50% 25%'},
    seshiro: {name: 'Seshiro', title: 'The Anointed', card: 'Seshiro the Anointed', number: '241', focus: '50% 25%'},
    kiku: {name: 'Kiku', title: 'Night\'s Flower', card: 'Kiku, Night\'s Flower', number: '121', focus: '50% 25%'},
    konda: {name: 'Konda', title: 'Lord of Eiganjo', card: 'Konda, Lord of Eiganjo', number: '30', focus: '50% 25%'},
    jitte: {name: 'Jitte Weenie', title: 'Summer 2005', card: 'Umezawa\'s Jitte', number: '163', focus: '50% 40%'},
  },
  battles: [
    {slot: 1, mood: 'march', kind: 'Arrival', title: 'The Kami Are Coming', difficulty: 'Easy', rewardSet: 'chk', teaches: ['Bushido'],
      blurb: 'The spirits of Kamigawa have turned on the mortals who worshipped them. Lord Konda\'s general, Takeno, holds the line with samurai who fight harder when they block or are blocked.',
      hero: {who: 'takeno', deck: {label: 'tribute', name: 'Takeno\'s Samurai', colors: 'W', list: `
2 Takeno, Samurai General
4 Isamaru, Hound of Konda
4 Samurai of the Pale Curtain
4 Kitsune Blademaster
4 Konda's Hatamoto
4 Bushi Tenderfoot
4 Hand of Honor
4 Indomitable Will
4 Glorious Anthem
2 Hail of Arrows
24 Plains`}},
      villain: {who: 'kami', deck: {label: 'tribute', name: 'The Raging Kami', colors: 'WB', list: `
4 Lantern Kami
4 Kami of False Hope
4 Silent-Chant Zubera
4 Ashen-Skin Zubera
4 Bile Urchin
4 Thief of Hope
4 Kami of the Painted Road
4 Hundred-Talon Kami
4 Kabuto Moth
12 Swamp
12 Plains`}},
      scene: [q('stage', 'The hound sniffed the air and let slip a low growl. General Takeno looked down at the faithful Isamaru and calmed him with a touch. "Alert the men. The kami are coming."'),
        q('takeno', 'None of you are yet samurai. Defend your homes with honor, die for your cause, and perhaps then you will be worthy of the word.'),
        s('takeno', 'Bushido: when a samurai blocks or is blocked, it gets bigger until the end of the turn. Send them in. Do not fear the trade.'),
        q('takeno', 'Rise like the sun, stand like the mountain, charge like the lion, die as a hero.')],
      villainScene: [q('stage', 'When the Honden of Night\'s Reach began to crumble, its attendants swarmed Kamigawa to haunt mortal dreams.'),
        q('stage', 'It is said that the mere touch of a kami is like embracing the sun itself.')],
      cues: {hero: cue('Hold the line!', 'Charge like the lion!', 'Stand, men. Stand!', 'The day is ours.', 'Die as heroes...', 'Block. Then strike.'),
        villain: cue('[a wind full of whispers]', '[the shrines howl]', '[the spirits waver]', '[the village is quiet now]', '[the whispers fade]')},
      after: [q('stage', 'Since the war began, the castle\'s walls mark the only place on Kamigawa where no kami has ever set foot.'),
        s('takeno', 'Eiganjo holds. Nothing else does. And Lord Konda will not tell me why.')]},
    {slot: 2, mood: 'tension', kind: 'Lesson', title: 'The Falling Leaf', difficulty: 'Easy', rewardSet: 'chk', teaches: ['Soulshift'],
      blurb: 'In Jukai Forest, the monk Dosan still prays to the kami that are killing him. The kodama of the old trees stand with him. A nezumi gang has come to rob the shrine anyway.',
      hero: {who: 'dosan', deck: {label: 'tribute', name: 'The Jukai Shrine', colors: 'GW', list: `
4 Kami of the Hunt
4 Orochi Sustainer
4 Kodama of the South Tree
2 Humble Budoka
4 Venerable Kumo
2 Matsu-Tribe Decoy
4 Order of the Sacred Bell
4 Moss Kami
2 Kami of the Palace Fields
2 Kodama's Might
2 Strength of Cedars
14 Forest
10 Plains
2 Dosan the Falling Leaf`}},
      villain: {who: 'okiba', deck: {label: 'tribute', name: 'Shrine Robbers', colors: 'B', list: `
4 Rag Dealer
4 Thief of Hope
4 Nezumi Bone-Reader
4 Nezumi Graverobber
4 Ashen-Skin Zubera
4 Bile Urchin
4 Ghost-Lit Stalker
4 Nezumi Shortfang
4 Wicked Akuba
24 Swamp`}},
      scene: [q('stage', 'Each night as Master Dosan prays to the kami, the hate he receives in return withers his body a little more. Though the kami are slowly killing him, still he continues his prayers.'),
        q('dosan', 'There may yet be a way to stop the killing without more blood, human or kami, being spilled.'),
        s('dosan', 'Soulshift: when this spirit dies, return a smaller spirit from your graveyard to your hand. The forest gives back what it loses.'),
        q('stage', 'There were no tombstones in orochi territory. Slain warriors were buried with a tree sapling, so they would become a part of the forest after death.')],
      villainScene: [q('stage', 'Some nezumi became as skilled in the samurai arts as the humans and kitsune. Yet no lord would have them, so they sold their swords to the highest bidder.'),
        q('stage', 'We had him cornered, we did . . . and, well, you know what they say about rats.')],
      cues: {hero: cue('Peace, little thieves.', 'The trees remember.', 'The forest thins...', 'Go in peace.', 'The leaf... falls...', 'What dies returns.'),
        villain: cue('Grab the gold!', 'Cut him!', 'Run! The trees move!', 'Shrine\'s empty!', 'Scatter!')},
      after: [s('dosan', 'They were hungry, not wicked. The kami are neither. That is what frightens me.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Mountain\'s Secret', difficulty: 'Easy', rewardSet: 'chk', teaches: ['Splice'],
      blurb: 'High in the Sokenzan Mountains, the yamabushi Kumano knows a secret about the kami. Takeno\'s letters cannot find him. The akki who live under his mountain can.',
      hero: {who: 'kumano', deck: {label: 'tribute', name: 'Kumano\'s Pupils', colors: 'R', list: `
2 Kumano, Master Yamabushi
4 Kumano's Pupils
4 Frostwielder
4 Hearth Kami
4 Glacial Ray
4 Lava Spike
4 Yamabushi's Flame
4 Soul of Magma
4 Kami of Fire's Roar
2 Ronin Houndmaster
24 Mountain`}},
      villain: {who: 'akki', deck: {label: 'tribute', name: 'The Sokenzan Akki', colors: 'R', list: `
4 Akki Lavarunner
4 Akki Rockspeaker
4 Akki Coalflinger
4 Akki Drillmaster
4 Goblin Cohort
4 Akki Underminer
4 Akki Raider
2 Raging Goblin
4 Battle-Mad Ronin
26 Mountain`}},
      scene: [q('stage', 'We received an anonymous letter suggesting that Kumano holds a secret to defeating the kami, but he is nowhere to be found.'),
        q('stage', 'Long before he reluctantly joined the war, stories spread of Kumano\'s followers winning victories against the kami.'),
        s('kumano', 'Splice onto Arcane: when you cast an Arcane spell, you may pay a splice cost to add another Arcane spell\'s effect to it. You keep the spliced card.'),
        q('stage', 'The most powerful of akki fire spells were developed at the cost of blood, toil, tears, sweat, and usually a nose or two.')],
      villainScene: [q('stage', 'Deep inside the Sokenzan Mountains, a band of akki discovered a cache of ancient items of power. Their ensuing spree of destruction became known as \'The Three Days of Fun.\''),
        q('akki', 'What part of \'hayaku ikee!\' did you not understand?')],
      cues: {hero: cue('The mountain teaches.', 'Fire on fire.', 'Too many shells...', 'Go home, little ones.', 'The fire... goes out...', 'Splice it.'),
        villain: cue('ROCKS!', 'Throw the big one!', 'Hide in the shell!', 'Three more days of fun!', 'Ow. Ow. Ow.')},
      after: [q('akki', 'Say, what rhymes with \'run for your lives\'?'),
        s('kumano', 'The secret is not mine to tell. Find the one who started the war, and you will know it.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Toshiro\'s Blood Oath', difficulty: 'Normal', rewardSet: 'bok', teaches: ['Ninjutsu'],
      blurb: 'Toshiro Umezawa is a thief, a liar and a very good swordsman. He swore a blood oath to the ogre-mage Hidetsugu and then broke it. Hidetsugu has come to collect.',
      hero: {who: 'toshiro', deck: {label: 'tribute', name: 'Umezawa\'s Shadows', colors: 'UB', list: `
2 Toshiro Umezawa
4 Ninja of the Deep Hours
4 Mistblade Shinobi
4 Okiba-Gang Shinobi
3 Ink-Eyes, Servant of Oni
4 Ashen-Skin Zubera
4 Callow Jushi
3 Mana Leak
3 Rend Flesh
3 Hinder
14 Island
12 Swamp`}},
      villain: {who: 'hidetsugu', deck: {label: 'tribute', name: 'The Oni Rite', colors: 'BR', list: `
2 Heartless Hidetsugu
2 Hidetsugu's Second Rite
4 Ogre Marauder
4 Oni Possession
4 Akki Underminer
4 Gutwrencher Oni
4 Ronin Cliffrider
4 Glacial Ray
4 Rend Flesh
4 Yamabushi's Flame
12 Mountain
12 Swamp`}},
      scene: [q('toshiro', 'He\'s a lot like me, that masterless little kami . . . unimpressed by grandeur and never at a loss for a trick.'),
        s('toshiro', 'Ninjutsu: when a creature of yours is unblocked, pay the ninjutsu cost and swap it for a ninja from your hand. The ninja hits instead.'),
        q('stage', 'One scratch on a wall meant safe passage, two that the target had already been raided, and three warned of a trap.')],
      villainScene: [q('stage', 'Hidetsugu held over a dozen oni in blood oath. At his touch, rocks scorched. At his word, cities burned.'),
        q('stage', 'Hidetsugu never relinquished a grudge. He let it burn within him, gathering ever greater intensity until the final moment of vengeance.'),
        q('stage', 'Blood drips. Blood sings. Blood devours all and only blood remains.')],
      cues: {hero: cue('An oath is just words, ogre.', 'Unblocked. Thank you.', 'He\'s burning everything...', 'I owe you nothing now.', 'Should have kept that oath...', 'Swap in the ninja.'),
        villain: cue('You swore in blood.', 'Burn, oathbreaker!', 'The oni falter...', 'The oath is paid.', 'This grudge... is not over...')},
      after: [s('toshiro', 'He\'ll come back. Ogres always do. Meanwhile, I hear Lord Konda\'s daughter has run away from home.')]},
    {slot: 5, mood: 'march', kind: 'Lesson', title: 'The Truth Seeker', difficulty: 'Normal', rewardSet: 'sok', teaches: ['Flip cards'],
      blurb: 'Michiko Konda has left her father\'s castle to find out what he did. Marrow-Gnawer, first lord of the nezumi, has heard there is a price on her head.',
      hero: {who: 'michiko', deck: {label: 'tribute', name: 'The Truth Seeker', colors: 'W', list: `
2 Michiko Konda, Truth Seeker
4 Bushi Tenderfoot
4 Faithful Squire
4 Kami of False Hope
4 Samurai of the Pale Curtain
4 Kitsune Blademaster
4 Lantern Kami
4 Kabuto Moth
4 Pious Kitsune
2 Ghostly Prison
24 Plains`}},
      villain: {who: 'marrow', deck: {label: 'tribute', name: 'Marrow-Gnawer\'s Gangs', colors: 'BR', list: `
4 Nezumi Graverobber
4 Initiate of Blood
4 Nezumi Shortfang
4 Nezumi Cutthroat
4 Nezumi Ronin
4 Deathmask Nezumi
2 Ashen-Skin Zubera
4 Rend Flesh
4 Villainous Ogre
12 Swamp
12 Mountain
2 Marrow-Gnawer`}},
      scene: [q('michiko', 'Watch over my father. Tell him I\'m safe, but I won\'t come home until I find out how to bring him back to his senses, and Kamigawa is again at peace.'),
        s('michiko', 'Flip cards: some creatures turn over when a condition is met and become something stronger. Bushi Tenderfoot becomes Kenzo the Hardhearted.'),
        q('stage', 'The sword is just a tool. It is the samurai\'s hand that brings it to life.')],
      villainScene: [q('stage', 'Marrow-Gnawer united three nezumi gangs when he slew their leaders in a single night. Now they call him their first lord.'),
        q('marrow', 'The Okiba Gang! Night-cursed thieves and assassins! I\'ve had enough of their meddling! Triple the guard!')],
      cues: {hero: cue('I am not running.', 'For Kamigawa!', 'Father... is this what you wanted?', 'I keep looking.', 'I never found it...', 'Turn it over.'),
        villain: cue('A princess! What a price!', 'Bite!', 'Back to the sewers!', 'Pay up, Konda!', 'Not the tail!')},
      after: [s('michiko', 'The gangs knew more than my father\'s court. Father stole something from the spirit world, in the year I was born.')]},
    {slot: 6, mood: 'tension', kind: 'Meta', title: 'Gifts Ungiven', difficulty: 'Normal', rewardSet: 'chk', teaches: ['The graveyard'],
      blurb: 'At the Minamo School, Lady Azami searches the scrolls for anything that can end the war, though her own sensei would rather she stopped looking. Godo\'s bandits have come to burn them. In the real 2005, Gifts Ungiven fed graveyards across Standard.',
      hero: {who: 'azami', deck: {label: 'tribute', name: 'Minamo Gifts', colors: 'BGU', archetype: 'Gifts', list: `
4 Gifts Ungiven
4 Sakura-Tribe Elder
4 Kodama's Reach
2 Kokusho, the Evening Star
2 Keiga, the Tide Star
2 Soulless Revival
3 Order of the Sacred Bell
3 Kami of the Hunt
4 Rend Flesh
2 Moss Kami
4 Kodama of the North Tree
4 Yavimaya Coast
4 Llanowar Wastes
4 Underground River
5 Forest
4 Island
3 Swamp
2 Azami, Lady of Scrolls`}},
      villain: {who: 'godo', deck: {label: 'tribute', name: 'Godo\'s Irregulars', colors: 'R', list: `
3 Godo, Bandit Warlord
2 Ronin Cliffrider
4 Ronin Houndmaster
4 Kami of Fire's Roar
4 Akki Raider
4 Battle-Mad Ronin
4 Frost Ogre
4 Torrent of Stone
2 Yamabushi's Flame
3 Akki Lavarunner
26 Mountain`}},
      scene: [q('azami', 'Though in years past speculation was not encouraged about the strange ways of kami, now we must understand their motivations, if such is even possible to the mortal mind.'),
        s('azami', 'Gifts Ungiven: find four different cards. Your opponent puts two in your graveyard and you keep the others. Give them a choice where both answers help you.'),
        q('stage', 'As the rest of the mortal world waged war, Lady Azami and her students invaded tomes of knowledge. Their search yielded spells critical in the fight.')],
      villainScene: [q('stage', 'Godo trained their muscles and honed their skills, but he left their hearts wild and empty.'),
        s('godo', 'Scrolls burn. Burn them all and take what is left.')],
      cues: {hero: cue('Open the scrolls.', 'There it is.', 'The library burns...', 'The scrolls survive.', 'All that knowledge...', 'Two good choices.'),
        villain: cue('Burn the school!', 'Loot it!', 'Retreat to the hills!', 'Take everything!', 'Godo... falls back...')},
      after: [s('azami', 'Sensei Hisoka told us to stop asking questions. Now I know why. He helped Konda do it.'),
        s('azami', 'The scrolls say the same thing Kumano would not: Konda stole a kami. We must take it back.')]},
    {slot: 7, mood: 'tension', kind: 'Rival', title: 'Snakes in the Swamp', difficulty: 'Normal', rewardSet: 'sok', teaches: ['Tribes'],
      blurb: 'Seshiro of the orochi snake-folk was the first to reach out to the human monks. Now his people move through Takenuma Swamp, where Kiku, the ogres\' assassin, makes shadows kill.',
      hero: {who: 'seshiro', deck: {label: 'tribute', name: 'Orochi Snakes', colors: 'GB', list: `
2 Seshiro the Anointed
2 Sosuke, Son of Seshiro
4 Sosuke's Summons
4 Orochi Sustainer
4 Sakura-Tribe Elder
4 Orochi Eggwatcher
4 Sachi, Daughter of Seshiro
4 Kodama of the North Tree
4 Kodama's Might
4 Nezumi Cutthroat
16 Forest
8 Swamp`}},
      villain: {who: 'kiku', deck: {label: 'tribute', name: 'Takenuma Shadows', colors: 'B', list: `
2 Kokusho, the Evening Star
2 Kami of the Waning Moon
4 Gutwrencher Oni
4 Nezumi Bone-Reader
4 Ashen-Skin Zubera
4 Thief of Hope
4 Rend Flesh
4 Hideous Laughter
4 Cranial Extraction
4 Nezumi Ronin
24 Swamp`}},
      scene: [q('stage', 'His family was the first to reach out to the human monks. He soon knew as many koans as he did blade strikes.'),
        q('seshiro', 'Without the kami to speak to nature on our behalf, we must beg help from nature directly.'),
        s('seshiro', 'Seshiro makes every snake bigger, and every snake that hits draws a card. Keep the line of snakes moving.'),
        q('stage', 'The orochi learned how to move swiftly and surely along the forest floor, like fish darting through gull-watched waters.')],
      villainScene: [q('kiku', 'Me? No, I\'m not going to kill you. I won\'t even lay a finger on you. I promise.'),
        q('kiku', 'It is the nature of humanity not to worry about tomorrow, especially when there\'s a good chance they won\'t live to see the end of today.'),
        q('stage', 'Although nowhere on Kamigawa was safe during the war, the Takenuma Swamp was the most horrifying.')],
      cues: {hero: cue('Coil and strike.', 'The tribe bites!', 'The swamp is deep...', 'The path is clear.', 'Bury me with a sapling...', 'Keep moving.'),
        villain: cue('Your shadow is mine.', 'Kill him, little shadow.', 'Too much light...', 'Sleep, snake.', 'The flower... closes...')},
      after: [s('seshiro', 'The way to Eiganjo is open. Konda\'s castle is the only place no kami has entered. Now we know why.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Konda', difficulty: 'Hard', rewardCard: 'Umezawa\'s Jitte', rewardSet: 'bok', teaches: ['Combat math'],
      blurb: 'Twenty years ago, Lord Konda stole a kami-child from O-Kagachi, the greatest of the spirits, to live forever. Michiko and Toshiro storm Eiganjo to set it free.',
      hero: {who: 'toshiro', deck: {label: 'tribute', name: 'Toshiro and Michiko', colors: 'WB', list: `
2 Toshiro Umezawa
2 Michiko Konda, Truth Seeker
4 Throat Slitter
4 Okiba-Gang Shinobi
4 Bushi Tenderfoot
4 Samurai of the Pale Curtain
4 Kitsune Blademaster
4 Kabuto Moth
4 Rend Flesh
4 Nezumi Cutthroat
12 Plains
12 Swamp`}},
      villain: {who: 'konda', deck: {label: 'tribute', name: 'Lord of Eiganjo', colors: 'W', archetype: 'Samurai', list: `
2 Konda, Lord of Eiganjo
2 Takeno, Samurai General
4 Isamaru, Hound of Konda
4 Samurai of the Pale Curtain
4 Konda's Hatamoto
4 Kitsune Blademaster
4 Hand of Honor
2 Yosei, the Morning Star
2 Kabuto Moth
2 Wrath of God
1 Lantern Kami
3 Ghostly Prison
2 Eiganjo Castle
24 Plains`}},
      scene: [q('stage', 'Deep within Eiganjo Castle lay the Palace of Infinite Halls, a seemingly endless network of corridors once guarded by a seemingly endless legion of samurai.'),
        q('stage', 'From the moment they swore their oaths, they belonged to their lord, sword and soul.'),
        s('michiko', 'He has Takeno\'s samurai and every wall of the castle. Do not attack into a full guard. Wait for the opening, then send the ninjas.'),
        s('toshiro', 'Bad and worse, princess. Let\'s choose.')],
      villainScene: [q('konda', 'Duty and law are the foundation on which civilization stands. They must not fall, for when they do, they take everything with them.'),
        q('stage', 'Over time, Konda grew ever more suspicious, fearing even his most loyal allies were being manipulated by unseen hands.'),
        s('konda', 'My daughter, and a thief. They would end the only peace this castle has.')],
      cues: {hero: cue('Set it free, Father.', 'Strike now!', 'There are too many guards...', 'It\'s free.', 'Forgive me, Kamigawa...', 'Wait for the opening.'),
        villain: {...cue('Eiganjo stands.', 'For the empire!', 'My samurai...', 'Forever.', 'What... have I done...'),
          half: {who: 'michiko', line: 'He was a good lord once. Takeno still believes it. Remember that when you strike.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Jitte Summer', difficulty: 'Hard', rewardSet: 'bok', rewardCard: 'Umezawa\'s Jitte', mood: 'boss',
      teaches: ['Answering artifacts'],
      archive: {deck: 'Jitte Weenie', when: 'Summer 2005', format: 'Standard: Mirrodin block, Kamigawa block and Ninth Edition.',
        what: 'White weenie built around Umezawa\'s Jitte from Betrayers of Kamigawa. Cheap creatures carry the Jitte, and every hit loads two counters.',
        why: 'Each counter is a choice: pump, kill a small creature, or gain life. Two Jittes in play meant the opponent\'s creatures died before they could block.',
        beat: 'Kill the creature carrying the Jitte before combat damage, or answer the Jitte itself. Hearth Kami and Frostwielder buy the time.',
        after: 'Umezawa\'s Jitte was never banned in Standard and rotated out in October 2006. It is banned in Modern from its first list in 2011.'},
      blurb: 'Deep in the archive, the jitte Toshiro stole, in the deck that made it famous. Every hit it lands grows two counters.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Kodama and Fire', colors: 'GR', archetype: 'Midrange', list: `
4 Sakura-Tribe Elder
4 Hanabi Blast
4 Kami of the Hunt
4 Orochi Sustainer
4 Glacial Ray
4 Yamabushi's Flame
4 Frostwielder
4 Hearth Kami
4 Kodama's Might
2 Kumano, Master Yamabushi
12 Forest
10 Mountain`}},
      villain: {who: 'jitte', deck: {label: 'tribute', name: 'Jitte Weenie', note: 'Built from the 2005 Standard white weenie lists with Umezawa\'s Jitte. No single tournament list is copied.', colors: 'W', archetype: 'White Weenie', list: `
2 Umezawa's Jitte
2 Isamaru, Hound of Konda
4 Samurai of the Pale Curtain
4 Lantern Kami
1 Leonin Skyhunter
4 Suntail Hawk
4 Hand of Honor
4 Kami of False Hope
2 Glorious Anthem
4 Kabuto Moth
4 Kitsune Blademaster
25 Plains`}},
      scene: [q('stage', 'Those kitsune trained in the blade preferred to fight with a blade-catching jitte in the off hand, buying them just enough time to deliver the first deadly cut.'),
        s('you', 'Every hit is two counters. Then nothing hits.'),
        s('toshiro', 'I stole it fair and square. Do not let it steal the game from you.')],
      villainScene: [s('stage', 'The deck does not speak. It equips.')],
      cues: {hero: cue('Break the jitte.', 'Burn the carrier!', 'It keeps growing...', 'Never banned. Still beaten.', 'Two more counters...', 'Kill it before damage.'),
        villain: cue('[equip]', '[two counters]', '[the jitte falls]', '[two counters]', '[the jitte is broken]')},
      after: [s('stage', 'Recorded: never banned in Standard. Banned in Modern from 2011.')]},
  ],
};
