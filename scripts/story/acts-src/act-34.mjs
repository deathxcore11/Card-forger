// Act 34: The Sleeper Agents (Dominaria United, The Brothers' War). Story and dialogue:
// /mnt/project-files/story/act-34-script.md (generated from this file). Land set: dmu.
// Phyrexian sleeper agents are already inside Dominaria, and Teferi's spirit goes back to the Brothers' War for answers.
// An echo of Act 1. Every quoted line is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'sleeper-agents-brothers-war',
  era: '2022-09-09',
  intro: [q('stage', 'After five thousand years, the nightmare returned.'),
    s('stage', 'Dominaria is full of people who do not know what they are. The Coalition has to find them before they find out.')],
  finale: [q('stage', 'Teferi\'s body couldn\'t travel through time far enough, but with Kaya\'s help, his spirit could.'),
    s('stage', 'Teferi learns the history Mishra never told anyone. The sleepers are exposed. Phyrexia is ready.'),
    s('stage', 'Recorded: the Brothers\' War, retold from the inside.')],
  villainFinale: [q('stage', 'Mishra was gone—all that remained was a machine wearing his face.'),
    s('stage', 'In this version, the praetor keeps her sleepers and Dominaria never learns who is who.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Tower Worker'},
    teferi: {name: 'Jodah and Teferi', title: 'Of the Coalition', card: 'Teferi, Temporal Pilgrim', focus: '50% 25%'},
    sleepers: {name: 'The Sleeper Agents', title: 'Of Phyrexia', card: 'Gixian Infiltrator', focus: '50% 30%'},
    urza: {name: 'Urza', title: 'Prince of Kroog', card: 'Urza, Lord Protector', focus: '50% 25%'},
    mishra: {name: 'Mishra', title: 'Claimed by Gix', card: 'Mishra, Claimed by Gix', focus: '50% 25%'},
    archaeologists: {name: 'Karn\'s Archaeologists', title: 'Of Argoth', card: 'Karn, Living Legacy', focus: '50% 25%'},
    dragons: {name: 'The Dragon Engines', title: 'Of Phyrexia', card: 'Phyrexian Dragon Engine', focus: '50% 30%'},
    scout: {name: 'Teferi', title: 'The Temporal Pilgrim', card: 'Teferi, Temporal Pilgrim', focus: '50% 25%'},
    gix: {name: 'Gix', title: 'Yawgmoth Praetor', card: 'Gix, Yawgmoth Praetor', focus: '50% 25%'},
    friends: {name: 'Ajani\'s Friends', title: 'Of the Coalition', card: 'Tori D\'Avenant, Fury Rider', focus: '50% 25%'},
    ajani: {name: 'Ajani', title: 'Sleeper Agent', card: 'Ajani, Sleeper Agent', focus: '50% 25%'},
    red: {name: 'Mono-Red', title: 'Autumn 2022', card: 'Monastery Swiftspear', focus: '50% 30%'},
    legends: {name: 'Esper Legends', title: 'Autumn 2022', card: 'Zur, Eternal Schemer', focus: '50% 25%'},
    rakdos: {name: 'Rakdos Midrange', title: 'Autumn 2022', card: 'Liliana of the Veil', focus: '50% 25%'},
    blue: {name: 'Mono-Blue', title: 'Autumn 2022', card: 'Tolarian Terror', focus: '50% 30%'},
    coalition: {name: 'The Coalition', title: 'Of Dominaria', card: 'Radha, Coalition Warlord', focus: '50% 25%'},
    sheoldred: {name: 'Sheoldred', title: 'The Apocalypse', card: 'Sheoldred, the Apocalypse', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Read Ahead', difficulty: 'Easy', rewardSet: 'dmu', teaches: ['Read ahead'],
      blurb: 'Jodah and Teferi move on a village where half the neighbours do not know what they are.',
      hero: {who: 'teferi', deck: {label: 'tribute', name: 'The Coalition Scouts', colors: 'WU', list: `
4 Guardian of New Benalia
3 Valiant Veteran
3 Knight of Dawn's Light
3 Harbin, Vanguard Aviator
3 Skystrike Officer
3 Mesa Cavalier
3 Wing Commando
4 Coalition Skyknight
4 Archangel of Wrath
4 Serra Paragon
2 Urza Assembles the Titans
4 Adarkar Wastes
10 Plains
10 Island`}},
      villain: {who: 'sleepers', deck: {label: 'tribute', name: 'The Sleeper Agents', colors: 'B', list: `
4 Gixian Infiltrator
4 Misery's Shadow
4 Phyrexian Rager
1 Gixian Skullflayer
1 Eerie Soultender
4 Cut Down
3 Go for the Throat
1 Gixian Puppeteer
3 Disfigure
24 Swamp
4 Gnawing Vermin
4 Cult Conscript
3 Battlefly Swarm`}},
      scene: [q('stage', 'Phyrexians destroyed my village, but they cannot break my hope.'),
        q('stage', 'A single light can hold back endless darkness.'),
        s('teferi', 'Read ahead: a saga lets you begin at any chapter. Pick the chapter you need and skip the rest.')],
      villainScene: [q('stage', 'Even he didn\'t know what he was until he felt his skin shifting and splitting, his mind overtaken by a chaos of whispers.'),
        q('stage', 'With every culling, we bring this world closer to *compleation*.')],
      cues: {hero: cue('Stay together.', 'Read ahead!', 'They look like neighbours...', 'The village is clear.', 'Overrun...', 'Begin the saga at the chapter you need.'),
        villain: cue('Wake up.', 'Compleat!', 'The whispers stop...', 'Compleated.', 'Shut down...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Urza and Mishra', difficulty: 'Easy', rewardSet: 'bro', teaches: ['Domain'],
      blurb: 'Teferi\'s spirit lands in the desert. Urza and Mishra are still brothers, but not for long.',
      hero: {who: 'urza', deck: {label: 'tribute', name: 'Urza\'s Machines', colors: 'WU', list: `
4 Powerstone Engineer
4 Thopter Mechanic
3 Urza, Lord Protector
2 Urza, Prince of Kroog
4 Thran Spider
3 Liberator, Urza's Battlethopter
3 Reconstructed Thopter
3 Mine Worker
3 Leyline Binding
3 Swiftgear Drake
2 Defabricate
2 Wing Commando
4 Adarkar Wastes
10 Plains
10 Island`}},
      villain: {who: 'mishra', deck: {label: 'tribute', name: 'Mishra\'s Army', colors: 'BR', list: `
4 Monastery Swiftspear
4 Mishra, Excavation Prodigy
3 Mishra, Claimed by Gix
4 Dwarven Forge-Chanter
3 Sardian Cliffstomper
3 Tomakul Scrapsmith
4 Lightning Strike
3 Brotherhood's End
3 Obliterating Bolt
2 Fallaji Chaindancer
3 Blitz Automaton
4 Sulfurous Springs
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'Raw energy contains infinite possibility.'),
        q('stage', 'As usual, my brother\'s maneuvers are brash and impulsive.'),
        s('urza', 'Domain: count the basic land types you control. Leyline Binding gets cheaper with every type, so mix your lands.')],
      villainScene: [q('stage', 'While Urza read books, Mishra learned to read the desert itself.'),
        q('stage', 'Hah. Urza has underestimated my strength yet again.')],
      cues: {hero: cue('Think it through.', 'Machines, advance!', 'Mishra is fast...', 'The brothers stay even.', 'Outpaced...', 'Count your land types, then bind.'),
        villain: cue('Faster.', 'Strike!', 'Urza held...', 'The desert is mine.', 'Beaten again...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Small or Big', difficulty: 'Easy', rewardSet: 'bro', teaches: ['Prototype'],
      blurb: 'Karn\'s archaeologists dig up a Phyrexian machine. Each one can be cast small or big.',
      hero: {who: 'archaeologists', deck: {label: 'tribute', name: 'Karn\'s Archaeologists', colors: 'GW', list: `
4 Yotian Dissident
4 Sarinth Steelseeker
4 Fauna Shaman
3 Gwenna, Eyes of Gaea
3 Hexbane Tortoise
3 Obstinate Baloth
3 Silverback Elder
3 Gaea's Courser
3 Karn, Living Legacy
3 Epic Confrontation
3 Phyrexian Fleshgorger
4 Brushland
10 Forest
10 Plains`}},
      villain: {who: 'dragons', deck: {label: 'tribute', name: 'The Dragon Engines', colors: 'BR', list: `
4 Phyrexian Dragon Engine
4 Scrapwork Rager
3 Dragon Whelp
3 Tyrant of Kher Ridges
2 Ragefire Hellkite
4 Cut Down
4 Lightning Strike
3 Go for the Throat
4 Monastery Swiftspear
2 Sardian Cliffstomper
3 Obliterating Bolt
4 Sulfurous Springs
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'Remember, students, if it\'s glowing, humming, or whirring, don\'t touch it!'),
        q('stage', 'This metal junk is ugly, but it\'s got its uses.'),
        s('archaeologists', 'Prototype: cast the machine for its small cost and get a small body now, or pay full price and get the big one.')],
      villainScene: [q('stage', 'Power radiated from the Weakstone, binding the dragon engine to Mishra\'s command.'),
        q('stage', 'In war, dragons don\'t see sides, just side dishes.')],
      cues: {hero: cue('Dig carefully.', 'Prototype!', 'The dragons are awake...', 'Everything is catalogued.', 'Buried...', 'Cast the small version when you are short of mana.'),
        villain: cue('Roar.', 'Fire!', 'The engines stall...', 'The dig site burns.', 'Scrap...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Gix, Yawgmoth Praetor', difficulty: 'Normal', rewardSet: 'bro', teaches: ['Counterspells'],
      blurb: 'Teferi finally meets the Act 6 villain in the flesh. He counters what he can and watches what he cannot.',
      hero: {who: 'scout', deck: {label: 'tribute', name: 'Teferi\'s Counterspells', colors: 'U', list: `
3 Teferi, Temporal Pilgrim
3 Essence Scatter
3 Negate
4 Air Marshal
4 Soaring Drake
4 Zephyr Sentinel
4 Skystrike Officer
4 Haunting Figment
3 Sphinx of Clear Skies
4 Talas Lookout
24 Island`}},
      villain: {who: 'gix', deck: {label: 'tribute', name: 'The Brotherhood of Gix', colors: 'BR', list: `
1 Gix, Yawgmoth Praetor
4 Gixian Infiltrator
2 Misery's Shadow
4 Phyrexian Rager
1 Mishra, Claimed by Gix
1 Lagomos, Hand of Hatred
4 Cut Down
3 Lightning Strike
3 Go for the Throat
1 Obliterating Bolt
4 Sulfurous Springs
10 Swamp
10 Mountain
4 Cult Conscript
4 Gnawing Vermin
4 Splatter Goblin`}},
      scene: [q('stage', 'Phyrexians pollute everything they touch, so the solution is simple: don\'t let them touch anything.'),
        q('stage', 'I\'ve always made snap decisions. I\'m just better at making the right ones now that I\'m older and wiser.'),
        s('scout', 'Hold your mana on his turn. Counter the card that matters, and let the rest go.')],
      villainScene: [q('stage', 'Gix pierced his disciples\' minds and savored their experiences as he took in their knowledge.'),
        q('stage', 'Machines feel no fear, no sorrow, no hunger—only glorious purpose, true and pure.')],
      cues: {hero: cue('Patience.', 'Denied!', 'Too many threats...', 'The praetor falls back.', 'Out of answers...', 'Counter the card that matters most.'),
        villain: cue('Show me.', 'Feed!', 'The brotherhood stalls...', 'All knowledge is mine.', 'Unmade...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Ajani\'s Betrayal', difficulty: 'Normal', rewardSet: 'dmu', teaches: ['Enlist'],
      blurb: 'Ajani has been compleated, and his friends are the ones who have to stop him.',
      hero: {who: 'friends', deck: {label: 'tribute', name: 'The Friends of Ajani', colors: 'RW', list: `
4 Guardian of New Benalia
3 Baird, Argivian Recruiter
3 Queen Kayla bin-Kroog
3 Tori D'Avenant, Fury Rider
3 Astor, Bearer of Blades
4 Monastery Swiftspear
4 Mesa Cavalier
2 Danitha, Benalia's Hope
4 Lightning Strike
2 Brotherhood's End
4 Battlefield Forge
10 Mountain
10 Plains
2 Archangel of Wrath
2 Coalition Skyknight`}},
      villain: {who: 'ajani', deck: {label: 'tribute', name: 'Ajani, Sleeper Agent', colors: 'GW', list: `
2 Ajani, Sleeper Agent
4 Yotian Dissident
1 King Darien XLVIII
2 Queen Allenal of Ruadach
4 Quirion Beastcaller
2 Hexbane Tortoise
1 Obstinate Baloth
1 Silverback Elder
3 Gaea's Courser
4 Giant Growth
4 Brushland
10 Forest
10 Plains
4 Llanowar Stalker
4 Sunbathing Rootwalla
4 Snarespinner`}},
      scene: [q('stage', 'Fear doesn\'t make you a coward; giving in to it does. Now take up your sword and fight!'),
        q('stage', 'Heroism is neither a strong arm nor a divine destiny. It is the choice to stand unbowed against impossible odds.'),
        s('friends', 'Enlist: tap a creature that is not attacking and add its power to an attacker. Let the weak ones help the strong.')],
      villainScene: [q('stage', 'He may look like my father, but the man I knew and loved is gone.'),
        q('stage', 'Phyrexia may be ancient, but Gaea is eternal.')],
      cues: {hero: cue('Hold on, Ajani.', 'Enlist!', 'He knows every move...', 'Ajani is free.', 'Lost him...', 'Tap your small creatures to enlist.'),
        villain: cue('Do not move.', 'Compleat!', 'The friends hold...', 'All are compleated.', 'Freed...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Mono-Red vs Esper Legends', difficulty: 'Normal', rewardSet: 'dmu', teaches: ['Ward'],
      blurb: 'Autumn 2022: a cheap burn deck against Esper legends. Hit them before the legends show up.',
      hero: {who: 'red', deck: {label: 'tribute', name: 'Mono-Red', colors: 'R', archetype: 'Aggro', list: `
4 Monastery Swiftspear
4 Phoenix Chick
4 Dwarven Forge-Chanter
4 Keldon Strike Team
3 Squee, Dubious Monarch
4 Lightning Strike
3 Obliterating Bolt
3 Brotherhood's End
3 Tyrant of Kher Ridges
3 Ragefire Hellkite
1 Twinferno
24 Mountain`}},
      villain: {who: 'legends', deck: {label: 'tribute', name: 'Esper Legends', colors: 'WUB', archetype: 'Midrange', list: `
3 Zur, Eternal Schemer
3 Urza, Lord Protector
3 Urza, Prince of Kroog
3 Teferi, Temporal Pilgrim
2 Ashnod, Flesh Mechanist
2 Braids, Arisen Nightmare
3 Liliana of the Veil
3 Go for the Throat
3 Essence Scatter
3 Cut Down
3 Serra Paragon
3 Archangel of Wrath
2 Negate
4 Caves of Koilos
4 Adarkar Wastes
4 Underground River
4 Plains
4 Island
4 Swamp`}},
      scene: [q('stage', 'She focused her mind on the volcano\'s fury, and hers erupted in kind.'),
        q('stage', 'Jaya did not want to die, but of all the things to die for, Dominaria felt right.'),
        s('red', 'Race them. Their legends are slow and expensive. Burn them out before they stabilise.')],
      villainScene: [q('stage', 'Karn\'s creation allowed him to monitor events across Dominaria—and everything he saw worried him.'),
        q('stage', 'All knowledge, past and future, is etched upon reality.')],
      cues: {hero: cue('Fast and hot.', 'Burn!', 'Their legends landed...', 'Burned out.', 'Too slow...', 'Go face when they tap out.'),
        villain: cue('A legend arrives.', 'Legendary!', 'They are too fast...', 'The legends stand.', 'Outpaced...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Rakdos vs Mono-Blue', difficulty: 'Normal', rewardSet: 'dmu', teaches: ['Playing around counterspells'],
      blurb: 'Autumn 2022: a Rakdos midrange pile against a mono-blue deck full of tricks.',
      hero: {who: 'rakdos', deck: {label: 'tribute', name: 'Rakdos Midrange', colors: 'BR', archetype: 'Midrange', list: `
3 Cut Down
4 Lightning Strike
3 Go for the Throat
3 Obliterating Bolt
4 Phyrexian Rager
3 Mishra, Claimed by Gix
3 Gix, Yawgmoth Praetor
2 Sardian Cliffstomper
3 Ragefire Hellkite
3 Tyrant of Kher Ridges
2 Braids, Arisen Nightmare
3 Liliana of the Veil
4 Sulfurous Springs
10 Swamp
10 Mountain`}},
      villain: {who: 'blue', deck: {label: 'tribute', name: 'Mono-Blue', colors: 'U', archetype: 'Tempo', list: `
4 Air Marshal
4 Soaring Drake
4 Zephyr Sentinel
3 Skystrike Officer
3 Tolarian Terror
4 Essence Scatter
4 Negate
3 Impulse
3 Sphinx of Clear Skies
4 Haunting Figment
24 Island`}},
      scene: [q('stage', 'There can be no mercy, no half measures. When facing Phyrexians, it\'s kill swiftly or die.'),
        q('stage', 'There hasn\'t been an original thought on Vesuva in centuries.'),
        s('rakdos', 'Cast your cheap spells first. Make them spend their counters on the small things.')],
      villainScene: [q('stage', 'Afterward, a number of treatises on sea serpent morphology were swiftly revised.'),
        q('stage', 'I adore your outfit. It\'s so . . . rustic.')],
      cues: {hero: cue('Bait first.', 'Burn it down!', 'Too many counters...', 'Dry the sea.', 'Drowned...', 'Bait with cheap spells, then land the big one.'),
        villain: cue('Not today.', 'Denied!', 'Out of tricks...', 'The tide wins.', 'Dried up...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Sheoldred, the Apocalypse', difficulty: 'Hard', rewardSet: 'dmu', teaches: ['Racing a card-draw engine'],
      blurb: 'The praetor who rules the sleepers. Every card you draw costs you life, and every card she draws costs you more.',
      hero: {who: 'coalition', deck: {label: 'tribute', name: 'The Coalition', colors: 'RG', list: `
3 Radha, Coalition Warlord
3 Meria, Scholar of Antiquity
3 Rulik Mons, Warren Chief
3 Hajar, Loyal Bodyguard
4 Quirion Beastcaller
4 Obstinate Baloth
3 Silverback Elder
4 Lightning Strike
3 Brotherhood's End
3 Sarinth Greatwurm
3 Epic Confrontation
4 Karplusan Forest
10 Forest
10 Mountain`}},
      villain: {who: 'sheoldred', deck: {label: 'tribute', name: 'Sheoldred\'s Grixis Midrange', colors: 'BUR', list: `
3 Sheoldred, the Apocalypse
4 Cut Down
4 Go for the Throat
4 Lightning Strike
3 Obliterating Bolt
4 Phyrexian Rager
3 Liliana of the Veil
3 Mishra, Claimed by Gix
3 Braids, Arisen Nightmare
3 Sol'Kanar the Tainted
2 Negate
4 Sulfurous Springs
4 Underground River
4 Shivan Reef
4 Swamp
4 Mountain
4 Island`}},
      scene: [q('stage', 'Enough warm-up. I\'m coming for you, Sheoldred!'),
        q('stage', 'Root and wing, claw and sword; this will be a memorable stand, indeed.'),
        s('coalition', 'Kill Sheoldred the turn she lands. Each turn she lives, you lose life and she gains it.')],
      villainScene: [q('stage', 'Gix failed. I shall not.'),
        q('stage', 'Resist if you must. It makes no difference. As with Mirrodin, your world will bow to Phyrexia.')],
      cues: {hero: cue('For Dominaria!', 'Together!', 'Every draw hurts...', 'Dominaria stands.', 'Compleated...', 'Kill her at once or lose the race.'),
        villain: {...cue('Gix failed.', '[a grinding waltz]', '[a bitter laugh]', 'I shall not fail.', '[the machinery stops]'),
          half: {who: 'friends', line: 'Not while we are still standing.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'The Brothers\' War, Retold', difficulty: 'Hard', rewardSet: 'bro', rewardCard: 'Mishra, Claimed by Gix', mood: 'boss',
      teaches: ['Card advantage'],
      archive: {deck: 'Mishra\'s Red-Black Artifacts', when: 'Autumn 2022', format: 'Standard.',
        what: 'A red-black deck of cheap burn and Mishra\'s artifact army, built around Mishra, Claimed by Gix.',
        why: 'It had the most efficient burn in the format and a mana curve that few decks could match.',
        beat: 'Block early and keep your life above burn range. Save a removal spell for the big Juggernaut.',
        after: 'The Brothers\' War ended in a sylex blast, and the format moved on.'},
      blurb: 'In the archive, Mishra\'s army plays at its original speed.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'The Friends of Ajani', colors: 'RW', list: `
4 Guardian of New Benalia
3 Baird, Argivian Recruiter
3 Queen Kayla bin-Kroog
3 Tori D'Avenant, Fury Rider
3 Astor, Bearer of Blades
4 Monastery Swiftspear
4 Mesa Cavalier
2 Danitha, Benalia's Hope
4 Lightning Strike
2 Brotherhood's End
4 Battlefield Forge
10 Mountain
10 Plains
2 Archangel of Wrath
2 Coalition Skyknight`}},
      villain: {who: 'mishra', deck: {label: 'tribute', name: 'Mishra\'s Red-Black Artifacts', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'BR', archetype: 'Aggro', list: `
4 Monastery Swiftspear
4 Mishra, Excavation Prodigy
2 Mishra, Claimed by Gix
4 Dwarven Forge-Chanter
4 Tomakul Scrapsmith
1 Mishra's Juggernaut
1 Phyrexian Dragon Engine
4 Lightning Strike
3 Obliterating Bolt
3 Cut Down
1 Brotherhood's End
4 Sulfurous Springs
10 Swamp
10 Mountain
4 Cult Conscript
1 Gnawing Vermin`}},
      scene: [q('stage', 'The peace summit proved the grudge between Urza and Mishra could end only in blood.'),
        s('you', 'Block early and hold your removal for the Juggernaut.')],
      villainScene: [q('stage', 'While Urza\'s machines favored defense, Mishra built his to end the war quickly.')],
      cues: {hero: cue('Hold the line.', 'Strike back!', 'He is too fast...', 'The army falls.', 'Overrun...', 'Block early.'),
        villain: cue('[a hammer falls]', '[the engines roar]', '[a pause]', '[the brother wins]', '[the engines stop]')},
      after: [s('stage', 'Recorded: the Brothers\' War ended in a sylex blast, and the format moved on.')]},
  ],
};
