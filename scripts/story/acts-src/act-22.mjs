// Act 22: The Dragonlords (Khans of Tarkir, Fate Reforged, Dragons of Tarkir). Story and dialogue:
// /mnt/project-files/story/act-22-script.md (generated from this file). Land set: ktk.
// Tarkir is Sarkhan Vol's home world. Its dragons died out long ago and five warrior clans rule it. A voice in Sarkhan's
// head, the dead dragon Ugin, calls him to a tomb and sends him back more than a thousand years, to the day Nicol Bolas
// fought Ugin. Sarkhan saves Ugin by sealing him in a hedron. History changes: the dragons never die, the clans become
// the servants of five Dragonlords, and Sarkhan wakes in a Tarkir full of dragons. Every quoted line is real flavor
// text from the Khans of Tarkir block; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'tarkir-dragonstorm',
  era: '2015-03-27',
  intro: [s('stage', 'Tarkir. A world of steppes, mountains and ice, ruled by five warrior clans and their khans.'),
    s('stage', 'There were dragons here once. The clans hunted them until there were none. Now there are only bones.'),
    s('stage', 'Sarkhan Vol was born here, and left, and served Nicol Bolas, and lost his mind on Zendikar. He has come home because a voice keeps calling him.'),
    q('sarkhan', 'Unwelcome thoughts crowd my mind. Are they my own madness, or the whispers of another?')],
  finale: [s('stage', 'More than a thousand years ago, Bolas left Ugin for dead. Sarkhan wrapped the broken dragon in a hedron and kept him alive. That one act changed everything after it.'),
    s('stage', 'The dragon tempests never stopped. The dragons never died. The five clans became the servants of five Dragonlords.'),
    q('sarkhan', 'Dragons in the skies of Tarkir—for the first time, it feels like my home.'),
    q('sarkhan', 'Even paradise is not without tragedies.'),
    s('stage', 'Ugin still sleeps in his hedron, alive. In this Tarkir, Narset is a planeswalker. And for the first time in years, the voice in Sarkhan\'s head is quiet.')],
  villainFinale: [s('stage', 'Silumgar coils on his hoard and does not even look up.'),
    q('stage', 'Silumgar never passes up an opportunity to add to his opulence.'),
    q('silumgar', 'Bring forth the dead, their skull-grins and rattle-bones. We will feast upon their wailing ghosts.'),
    s('stage', 'Sarkhan got exactly what he wanted. A world full of dragons. He forgot to ask what the dragons would want.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Tomb of the Spirit Dragon'},
    surrak: {name: 'Surrak', title: 'Khan of the Temur', card: 'Surrak Dragonclaw', focus: '50% 25%'},
    anafenza: {name: 'Anafenza', title: 'Khan of the Abzan', card: 'Anafenza, the Foremost', focus: '50% 25%'},
    narset: {name: 'Narset', title: 'Khan of the Jeskai', card: 'Narset, Enlightened Master', focus: '50% 25%'},
    sidisi: {name: 'Sidisi', title: 'Khan of the Sultai', card: 'Sidisi, Brood Tyrant', focus: '50% 25%'},
    yasova: {name: 'Yasova Dragonclaw', title: 'Temur', card: 'Yasova Dragonclaw', focus: '50% 25%'},
    tasigur: {name: 'Tasigur', title: 'The Golden Fang', card: 'Tasigur, the Golden Fang', focus: '50% 25%'},
    sarkhan: {name: 'Sarkhan Vol', title: 'The Dragonspeaker', card: 'Sarkhan, the Dragonspeaker', focus: '50% 25%'},
    zurgo: {name: 'Zurgo', title: 'Khan of the Mardu', card: 'Zurgo Helmsmasher', focus: '50% 25%'},
    ugin: {name: 'Ugin', title: 'The Spirit Dragon', card: 'Ugin, the Spirit Dragon', focus: '50% 25%'},
    kolaghan: {name: 'Kolaghan', title: 'The Storm\'s Fury', card: 'Kolaghan, the Storm\'s Fury', focus: '50% 25%'},
    abzan: {name: 'Abzan', title: 'Late 2014', card: 'Siege Rhino', focus: '50% 30%'},
    jeskai: {name: 'Jeskai Tokens', title: 'Early 2015', card: 'Monastery Mentor', focus: '50% 25%'},
    atarka: {name: 'Atarka Red', title: 'Mid 2015', card: 'Atarka\'s Command', focus: '50% 30%'},
    esper: {name: 'Esper Dragons', title: 'Mid 2015', card: 'Dragonlord Ojutai', focus: '50% 25%'},
    silumgar: {name: 'Dragonlord Silumgar', title: 'The Sultai', card: 'Dragonlord Silumgar', focus: '50% 25%'},
    cruise: {name: 'Treasure Cruise', title: '2014', card: 'Treasure Cruise', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Qal Sisma', difficulty: 'Easy', rewardSet: 'ktk', teaches: ['Ferocious'],
      blurb: 'You arrive in the frozen mountains of Qal Sisma, where Surrak, khan of the Temur, has caught an Abzan war party on his side of the pass. Anafenza leads them herself.',
      hero: {who: 'surrak', deck: {label: 'tribute', name: 'The Temur Frontier', colors: 'GUR', list: `
2 Surrak Dragonclaw
4 Savage Knuckleblade
4 Rattleclaw Mystic
4 Bear's Companion
3 Snowhorn Rider
3 Avalanche Tusker
4 Temur Charm
4 Savage Punch
4 Alpine Grizzly
4 Heir of the Wilds
7 Forest
4 Island
4 Mountain
3 Frontier Bivouac
3 Rugged Highlands
3 Thornwood Falls`}},
      villain: {who: 'anafenza', deck: {label: 'tribute', name: 'The Abzan Houses', colors: 'WBG', list: `
2 Anafenza, the Foremost
4 Abzan Guide
4 Ainok Bond-Kin
4 Abzan Falconer
4 Tuskguard Captain
4 Abzan Charm
2 Armament Corps
4 Disowned Ancestor
4 Kin-Tree Warden
4 Herald of Anafenza
7 Plains
5 Swamp
6 Forest
3 Sandsteppe Citadel
3 Scoured Barrens`}},
      scene: [q('surrak', 'Hold the high ground, then bring it to your enemy.'),
        q('surrak', 'People are often humbled by the elements. But the elements, too, can be humbled.'),
        s('surrak', 'Ferocious: some Temur cards get a bonus if you control a creature with power 4 or greater. Get a big one down first.')],
      villainScene: [q('anafenza', 'Stand where the whole battle can see you. Strike so they\'ll never forget.'),
        q('stage', 'Rarely at rest on the Amber Throne, Anafenza always leads the Abzan Houses to battle.')],
      cues: {hero: cue('Hold the pass.', 'Ferocious!', 'They outlast us...', 'Back to the desert.', 'The pass falls...', 'Big creature first.'),
        villain: cue('For the Houses.', 'The ancestors stand with us!', 'Cold steel.', 'Endure.', 'We withdraw.')},
      after: [s('surrak', 'A man came through the pass last week talking to himself about dragons. Vol, his name was. Of the Mardu, once. Zurgo wants him dead.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Way of the Jeskai', difficulty: 'Easy', rewardSet: 'ktk', teaches: ['Prowess'],
      blurb: 'Narset, khan of the Jeskai, studies the old dragons in secret, and Sarkhan has heard she knows where the voice is coming from. Sidisi of the Sultai would like to know too.',
      hero: {who: 'narset', deck: {label: 'tribute', name: 'The Jeskai Way', colors: 'URW', list: `
2 Narset, Enlightened Master
4 Monastery Swiftspear
4 Seeker of the Way
4 Jeskai Windscout
4 Mantis Rider
3 Jeskai Charm
4 Arc Lightning
4 Jeskai Student
3 Defiant Strike
4 Mystic of the Hidden Way
7 Island
7 Mountain
5 Plains
3 Mystic Monastery
2 Swiftwater Cliffs`}},
      villain: {who: 'sidisi', deck: {label: 'tribute', name: 'The Sultai Brood', colors: 'BGU', list: `
2 Sidisi, Brood Tyrant
4 Sultai Scavenger
4 Murderous Cut
1 Treasure Cruise
4 Hooting Mandrills
4 Sultai Soothsayer
4 Rakshasa Deathdealer
2 Kheru Lich Lord
4 Throttle
4 Sultai Flayer
3 Debilitating Injury
7 Swamp
7 Forest
4 Island
3 Opulent Palace
3 Dismal Backwater`}},
      scene: [q('narset', 'The Way has no beginning and no end. It is simply the path.'),
        q('narset', 'Our own selves are the greatest obstacles to enlightenment.'),
        s('narset', 'Prowess: whenever you cast a noncreature spell, a creature with prowess gets +1/+1 until end of turn. Cast your spells before you attack.')],
      villainScene: [q('sidisi', 'If weakness does not exist within the Temur then we shall force it upon them.'),
        q('sidisi', 'The best servants are made from those who died without a scratch.')],
      cues: {hero: cue('Center yourself.', 'Strike!', 'They rise again...', 'The Way holds.', 'Unbalanced...', 'Spell first, then attack.'),
        villain: cue('Kneel.', 'Delve!', 'Hss.', 'Another servant.', 'Into the swamp.')},
      after: [s('narset', 'The voice you hear is Ugin, the spirit dragon. His bones lie in a tomb of their own. Go, and be careful what you ask him for.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'A Thousand Years Ago', difficulty: 'Easy', rewardSet: 'frf', teaches: ['Delve'],
      blurb: 'At the tomb, Ugin\'s voice pulls Sarkhan back more than a thousand years. The clans are young, the dragon tempests still rage, and Yasova Dragonclaw of the Temur is fighting Tasigur, the Sultai khan, who has expensive taste in zombies.',
      hero: {who: 'yasova', deck: {label: 'tribute', name: 'Yasova\'s Hunters', colors: 'GRU', list: `
2 Yasova Dragonclaw
4 Frost Walker
4 Feral Krushok
3 Temur Sabertooth
4 Ainok Guide
4 Wild Slash
4 Bathe in Dragonfire
3 Battlefront Krushok
2 Whisperwood Elemental
9 Forest
7 Mountain
4 Island
2 Rugged Highlands
2 Frontier Bivouac
4 Savage Knuckleblade
2 Alpine Grizzly`}},
      villain: {who: 'tasigur', deck: {label: 'tribute', name: 'The Golden Fang', colors: 'BGU', list: `
1 Tasigur, the Golden Fang
2 Gurmag Angler
4 Sibsig Host
4 Sultai Emissary
4 Sibsig Muckdraggers
4 Douse in Gloom
2 Reach of Shadows
4 Write into Being
4 Hooded Assassin
10 Swamp
6 Forest
4 Island
2 Opulent Palace
2 Jungle Hollow
4 Typhoid Rats
3 Kheru Bloodsucker`}},
      scene: [q('stage', 'All at once Sarkhan\'s mind fell silent.'),
        q('yasova', 'As the clans carved out their territories, we saw allies where the Mardu saw only obstacles.'),
        s('yasova', 'Delve: their big creatures exile cards from their graveyard to pay for themselves. An empty graveyard makes them expensive again.')],
      villainScene: [q('tasigur', 'They were your friends, your family, your clan. They want only to welcome you.'),
        q('tasigur', 'No machinations, no puppet strings, no plots. Just pure, sweeping death.')],
      cues: {hero: cue('Hunt.', 'For the Temur!', 'Too many dead...', 'The prince runs.', 'Buried...', 'Starve their graveyard.'),
        villain: cue('How tedious.', 'Rise, my darlings.', 'My robes!', 'Delightful.', 'Fetch my litter.')},
      after: [q('yasova', 'Her hunger knows no limit. Left unchecked, she would feast on all of Tarkir.'),
        s('yasova', 'She means Atarka, a dragon. We have more dragons than we can kill. Why would anyone want to save one?')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Traitor Returns', difficulty: 'Normal', rewardSet: 'ktk', teaches: ['Raid'],
      blurb: 'Before the tomb, there is Zurgo. Sarkhan was once a Mardu warrior and then walked away, and Zurgo Helmsmasher, khan of the Mardu, has made a legend out of hating him.',
      hero: {who: 'sarkhan', deck: {label: 'tribute', name: 'The Dragonspeaker', colors: 'RG', list: `
2 Sarkhan, the Dragonspeaker
2 Ashcloud Phoenix
4 Arc Lightning
4 Summit Prowler
4 Alpine Grizzly
4 Heir of the Wilds
4 Savage Punch
4 Bloodfire Expert
4 Highland Game
4 Valley Dasher
12 Mountain
10 Forest
2 Rugged Highlands`}},
      villain: {who: 'zurgo', deck: {label: 'tribute', name: 'The Mardu Horde', colors: 'RWB', list: `
2 Zurgo Helmsmasher
4 Mardu Hordechief
4 Chief of the Edge
4 Mardu Heart-Piercer
4 War-Name Aspirant
4 Hordeling Outburst
2 Mardu Charm
4 Mardu Skullhunter
4 Butcher of the Horde
4 Crackling Doom
6 Mountain
6 Plains
6 Swamp
3 Nomad Outpost
3 Bloodfell Caves`}},
      scene: [q('sarkhan', 'No body can contain so much fury. It reminds me of another battle, long past.'),
        s('sarkhan', 'Raid: their raid cards get a bonus if they attacked this turn. Make every attack cost them something.')],
      villainScene: [q('zurgo', 'You have returned from fire, traitor. This time I will see you leave as ashes.'),
        q('zurgo', 'Do you hear that, Sarkhan? The glory of the horde! I made a legend from what you abandoned.'),
        q('zurgo', 'I came seeking a challenge. All I found was you.')],
      cues: {hero: cue('Zurgo.', 'Dragonfire!', 'The horde is endless...', 'Stay down.', 'Not yet...', 'Block, and punish the raid.'),
        villain: cue('Traitor!', 'RAID!', 'Lucky.', 'Ashes!', 'Next time, Vol.')},
      after: [s('sarkhan', 'He will never stop. Neither will the voice. Only one of them is worth following.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Ugin\'s Fate', difficulty: 'Normal', rewardSet: 'frf', teaches: ['Manifest'],
      blurb: 'Sarkhan reaches the place where Ugin fell after his battle with Nicol Bolas. Ugin is dying. Dragons are circling, and Sarkhan has to hold them off long enough to seal Ugin into a hedron.',
      hero: {who: 'ugin', deck: {label: 'tribute', name: 'The Spirit Dragon\'s Guard', colors: 'GW', list: `
2 Ugin's Construct
4 Whisperwood Elemental
4 Formless Nurturing
3 Mastery of the Unseen
4 Soul Summons
4 Abzan Beastmaster
4 Sandsteppe Outcast
4 Map the Wastes
4 Dragonscale General
3 Valorous Stance
10 Forest
10 Plains
4 Blossoming Sands`}},
      villain: {who: 'kolaghan', deck: {label: 'tribute', name: 'Kolaghan\'s Brood', colors: 'BR', list: `
2 Kolaghan, the Storm's Fury
4 Goblin Heelcutter
4 Mardu Shadowspear
4 Mardu Strike Leader
4 Alesha's Vanguard
4 Shockmaw Dragon
4 Wild Slash
4 Douse in Gloom
4 Flamerush Rider
10 Mountain
10 Swamp
4 Bloodfell Caves
2 Mardu Heart-Piercer`}},
      scene: [q('stage', 'Ugin\'s whispered summons led Sarkhan Vol to the moment that would echo down the centuries and seal Tarkir\'s fate: the primal battle between Ugin and Nicol Bolas.'),
        q('sarkhan', 'Every choice alters the path of fate.'),
        s('sarkhan', 'Manifest: put the top card of your library onto the battlefield face down as a 2/2. If it is a creature, you can turn it face up for its mana cost.')],
      villainScene: [q('stage', 'She answers the call of the Crave, the desire for battle sated only by bloodshed.'),
        q('stage', 'Kolaghan\'s army rushes from kill to kill, desperate to avoid the dragon\'s wrath.')],
      cues: {hero: cue('Hold on, Ugin.', 'The hedron holds!', 'They are on him...', 'Sealed.', 'Too late...', 'Flip the creatures you manifest.'),
        villain: cue('[a shriek from the storm]', '[dash]', '[the brood scatters]', '[blood on the wind]', '[the storm passes]')},
      after: [s('stage', 'Sarkhan closes the hedron around the broken dragon. Somewhere behind him, a thousand years start to change.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Siege Rhino', difficulty: 'Normal', rewardSet: 'ktk', teaches: ['Outlast'],
      blurb: 'The Archive remembers Khans Standard: Abzan midrange and its Siege Rhinos, against Jeskai decks that made an army of tokens out of cheap spells.',
      hero: {who: 'abzan', deck: {label: 'tribute', name: 'Abzan', note: 'Built from cards in this act\'s sets only, so Courser of Kruphix, Sylvan Caryatid, Hero\'s Downfall and Elspeth, Sun\'s Champion are not in it.', colors: 'WBG', archetype: 'Midrange', list: `
4 Siege Rhino
2 Anafenza, the Foremost
4 Wingmate Roc
4 Abzan Charm
4 Murderous Cut
4 Rakshasa Deathdealer
3 Den Protector
3 Deathmist Raptor
4 Warden of the First Tree
2 Dromoka's Command
2 Ultimate Price
6 Plains
4 Forest
4 Swamp
4 Sandsteppe Citadel
3 Windswept Heath
3 Jungle Hollow`}},
      villain: {who: 'jeskai', deck: {label: 'tribute', name: 'Jeskai Tokens', colors: 'URW', archetype: 'Tokens', list: `
4 Hordeling Outburst
1 Monastery Mentor
4 Seeker of the Way
4 Mantis Rider
4 Jeskai Charm
4 Wild Slash
4 Arc Lightning
4 Secure the Wastes
2 Valorous Stance
2 Soulfire Grand Master
7 Plains
5 Mountain
4 Island
4 Mystic Monastery
4 Wind-Scarred Crag
3 Jeskai Windscout`}},
      scene: [q('stage', 'The mere approach of an Abzan war beast is enough to send enemies fleeing in panic.'),
        s('you', 'Outlast: pay the cost and tap the creature to put a +1/+1 counter on it, any time you could cast a sorcery. Slow, but it adds up.')],
      villainScene: [q('jeskai', 'Speak little. Do much.')],
      cues: {hero: cue('Rhino time.', 'Drain three!', 'Tokens everywhere...', 'Trampled.', 'Outnumbered.', 'Kill the Mentor first.'),
        villain: cue('[a flurry of tokens]', '[prowess]', '[the Rhino lands]', '[swarmed]', '[trampled]')},
      after: [s('stage', 'Recorded: Khans of Tarkir Standard, 2014 to 2015.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Atarka\'s Command', difficulty: 'Normal', rewardSet: 'dtk', teaches: ['Racing'],
      blurb: 'The Archive remembers summer 2015: Atarka Red, which tried to win on turn four with tokens and pump spells, against Esper Dragons and its counterspells.',
      hero: {who: 'atarka', deck: {label: 'tribute', name: 'Atarka Red', colors: 'RG', archetype: 'Aggro', list: `
4 Monastery Swiftspear
4 Zurgo Bellstriker
4 Atarka's Command
4 Dragon Fodder
4 Hordeling Outburst
4 Wild Slash
4 Temur Battle Rage
4 Become Immense
4 Lightning Berserker
12 Mountain
6 Forest
4 Wooded Foothills
2 Rugged Highlands`}},
      villain: {who: 'esper', deck: {label: 'tribute', name: 'Esper Dragons', colors: 'WUB', archetype: 'Control', list: `
3 Dragonlord Ojutai
4 Silumgar's Scorn
4 Ojutai's Command
4 Icefall Regent
4 Silumgar's Command
1 Dig Through Time
4 Ultimate Price
4 Foul-Tongue Invocation
4 Crux of Fate
2 Anticipate
2 Stratus Dancer
8 Island
4 Plains
4 Swamp
4 Dismal Backwater
4 Tranquil Cove`}},
      scene: [q('stage', 'Atarka serving-goblins coat themselves with grease imbued with noxious herbs, hoping to discourage their ravenous masters from adding them to the meal.'),
        s('you', 'Go wide, then pump everything at once. Do not give the dragons time to land.')],
      villainScene: [q('stage', 'Attracting a dragon\'s attention may be the last mistake you make.')],
      cues: {hero: cue('Go!', 'Command!', 'Countered...', 'Overrun.', 'The dragon lands...', 'Win before turn six.'),
        villain: cue('[a counterspell]', '[a dragon from the air]', '[too many tokens]', '[the dragonlord rules]', '[swarmed]')},
      after: [s('stage', 'Recorded: Dragons of Tarkir Standard, 2015.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Dragonlord Silumgar', difficulty: 'Hard', rewardSet: 'dtk', rewardCard: 'Dragonlord Silumgar', teaches: ['Card advantage'],
      blurb: 'Sarkhan wakes in a Tarkir ruled by dragons. In the swamps, Dragonlord Silumgar sits on a mountain of treasure with Sidisi as his vizier. Sarkhan and Narset go to see the new world\'s worst dragon.',
      hero: {who: 'sarkhan', deck: {label: 'tribute', name: 'Sarkhan and Narset', colors: 'URW', list: `
2 Narset Transcendent
2 Sarkhan, the Dragonspeaker
2 Thunderbreak Regent
3 Stormwing Dragon
4 Seeker of the Way
4 Jeskai Windscout
4 Arc Lightning
3 Ojutai's Command
4 Draconic Roar
2 Icefall Regent
7 Mountain
5 Island
5 Plains
4 Mystic Monastery
3 Swiftwater Cliffs
4 Jeskai Student
2 Monastery Flock`}},
      villain: {who: 'silumgar', deck: {label: 'tribute', name: 'The Silumgar', colors: 'UB', list: `
2 Dragonlord Silumgar
2 Silumgar, the Drifting Death
4 Silumgar's Scorn
2 Silumgar's Command
4 Ultimate Price
3 Foul-Tongue Invocation
4 Necromaster Dragon
4 Deathbringer Regent
4 Hand of Silumgar
4 Gurmag Angler
2 Crux of Fate
1 Dig Through Time
12 Swamp
8 Island
4 Dismal Backwater`}},
      scene: [q('sarkhan', 'In the Tarkir I once knew, the Abzan revered their ancestor trees. Now, as Dromoka, they cut their finest groves to make weapons.'),
        q('narset', 'Abzan, Jeskai, Sultai, Mardu, Temur—names lost to history, yet worthy of further study.'),
        s('narset', 'He takes what you have and keeps it. Make him spend his cards, then spend yours.')],
      villainScene: [q('silumgar', 'Bring forth the dead, their skull-grins and rattle-bones. We will feast upon their wailing ghosts.'),
        q('sidisi', 'The most profound secrets lie in the darkest places of the world. It can be prudent to make use of another set of eyes.'),
        q('sidisi', 'The realization that one is dying is far more terrifying than death itself.')],
      cues: {hero: cue('For Tarkir.', 'Dragonfire!', 'He took it...', 'The hoard falls.', 'Added to the hoard...', 'Bait the counterspell.'),
        villain: {...cue('How shiny.', 'Mine now.', 'You scratched it.', 'Into the hoard.', 'Insolent.'),
          half: {who: 'narset', line: 'He is greedy, not careful. Keep making him choose.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Treasure Cruise', difficulty: 'Hard', rewardSet: 'ktk', rewardCard: 'Treasure Cruise', mood: 'boss',
      teaches: ['Delve'],
      archive: {deck: 'Treasure Cruise', when: 'Late 2014', format: 'Standard, Modern, Legacy and Vintage.',
        what: 'Cheap red and blue tempo decks that filled the graveyard with one-mana spells, then cast Treasure Cruise and Dig Through Time for one or two mana by delving it away.',
        why: 'Delve made an eight-mana card cost almost nothing in the right deck, and the older formats had the right decks.',
        beat: 'Race them and kill the small creatures. Their card draw is only cheap once the graveyard is full.',
        after: 'Treasure Cruise and Dig Through Time were banned in Modern in January 2015. This tribute follows the Vintage list, so it plays one of each.'},
      blurb: 'Deep in the archive, the card that made a cruise ship cost one blue mana.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Dragons', colors: 'R', archetype: 'Midrange', list: `
3 Stormwing Dragon
4 Shockmaw Dragon
4 Draconic Roar
4 Dragon Whisperer
2 Wild Slash
4 Dragon Fodder
3 Sarkhan's Rage
24 Mountain
2 Kolaghan Aspirant
4 Twin Bolt
4 Sabertooth Outrider
2 Mardu Scout`}},
      villain: {who: 'cruise', deck: {label: 'tribute', name: 'Treasure Cruise Tempo', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'UR', archetype: 'Tempo', list: `
4 Monastery Swiftspear
1 Treasure Cruise
1 Dig Through Time
4 Stubborn Denial
4 Elusive Spellfist
4 Arc Lightning
4 Wild Slash
4 Bloodfire Expert
2 Stratus Dancer
2 Disdainful Stroke
2 Mindswipe
10 Island
10 Mountain
4 Swiftwater Cliffs
4 Jeskai Elder`}},
      scene: [q('stage', 'Countless delights drift on the surface while dark schemes run below.'),
        s('you', 'Kill the Swiftspears. Make them pay full price.')],
      villainScene: [q('stage', 'The calligraphy of combat is written with strokes of sudden blood.')],
      cues: {hero: cue('Dragons up.', 'Breathe fire!', 'They drew three...', 'Sunk.', 'Out-drawn.', 'Kill the cheap threats.'),
        villain: cue('[delve]', '[treasure cruise]', '[the graveyard is empty]', '[prowess burn]', '[out of gas]')},
      after: [s('stage', 'Recorded: Treasure Cruise and Dig Through Time, banned in Modern in January 2015.')]},
  ],
};
