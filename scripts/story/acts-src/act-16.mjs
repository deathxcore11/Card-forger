// Act 16: The Conflux (Shards of Alara, Conflux, Alara Reborn, Magic 2010). Story and dialogue:
// /mnt/project-files/story/act-16-script.md (generated from this file). Land set: ala.
// Alara was shattered long ago into five shards, each with only three colours of mana: Bant, Esper, Grixis, Jund and Naya.
// Now the shards are sliding back together, and Nicol Bolas has arranged every collision. Ajani Goldmane hunts his
// brother's killer across all five. Every quoted line is real flavor text from the Alara block or Magic 2010; unquoted
// lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'shards-conflux-bolas',
  era: '2009-07-17',
  intro: [s('stage', 'Alara. Long ago it broke into five shards, and each shard kept only three of the five colours of mana.'),
    s('stage', 'Bant has knights and angels and law. Esper has etherium, the blue metal it grafts into every living thing. Grixis has the dead. Jund has dragons and the fight to eat or be eaten. Naya has jungles, giants and gods that walk.'),
    q('stage', 'Centuries have passed since the plane shattered, yet the obelisks of each shard faithfully serve their long-forgotten purpose.'),
    s('stage', 'Now the shards are moving. And an old dragon, who lost most of his power in the Mending of Act 14, is watching them very closely.')],
  finale: [q('stage', 'Alara is broken no more.'),
    s('stage', 'The shards are one world again. The flood of mana as they came together was the greatest in centuries, and Nicol Bolas drank it. He leaves Alara stronger than he arrived.'),
    s('ajani', 'Jazal died because he stood between a dragon and a harvest. That is all he was to Bolas. In the way.'),
    s('ajani', 'I could not stop the Conflux. But I know his name now, and I know his face. I will be there the next time.')],
  villainFinale: [q('stage', 'After years of world-bending machinations, Bolas\'s triumph is at hand.'),
    q('bolas', 'Birth and death are both reversible.'),
    s('bolas', 'Five worlds, one harvest. I lost a god\'s power in the Mending. A plane\'s worth of mana is a decent start on getting it back.'),
    s('stage', 'In a corner of the reborn plane, a white-maned leonin swears an oath that Bolas does not bother to hear.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', fixed: fixed('Fold into Aether', '5dn', '31', '615157d6-0160-417b-b06c-0e253b306c37', 'Anthony S. Waters & Cara Mitten')},
    rafiq: {name: 'Rafiq', title: 'Of the Many', card: 'Rafiq of the Many', number: '185', focus: '50% 25%'},
    sharuum: {name: 'Sharuum', title: 'The Hegemon', card: 'Sharuum the Hegemon', number: '194', focus: '50% 25%'},
    ajani: {name: 'Ajani', title: 'Goldmane', card: 'Ajani Goldmane', number: '1', focus: '50% 25%'},
    sarkhan: {name: 'Sarkhan Vol', title: 'Dragon-Speaker of Jund', card: 'Sarkhan Vol', number: '191', focus: '50% 25%'},
    elspeth: {name: 'Elspeth', title: 'Knight-Errant', card: 'Elspeth, Knight-Errant', number: '9', focus: '50% 25%'},
    tezzeret: {name: 'Tezzeret', title: 'The Seeker', card: 'Tezzeret the Seeker', number: '60', focus: '50% 25%'},
    vengeant: {name: 'Ajani', title: 'Vengeant', card: 'Ajani Vengeant', number: '154', focus: '50% 25%'},
    sedris: {name: 'Sedris', title: 'The Traitor King', card: 'Sedris, the Traitor King', number: '193', focus: '50% 25%'},
    mayael: {name: 'Mayael', title: 'The Anima', card: 'Mayael the Anima', number: '179', focus: '50% 25%'},
    kresh: {name: 'Kresh', title: 'The Bloodbraided', card: 'Kresh the Bloodbraided', number: '178', focus: '50% 25%'},
    zoo: {name: 'Naya Zoo', title: 'Summer 2009', card: 'Wild Nacatl', number: '152', focus: '50% 30%'},
    esperAggro: {name: 'Esper Artifacts', title: 'Summer 2009', card: 'Master of Etherium', number: '49', focus: '50% 30%'},
    bolas: {name: 'Nicol Bolas', title: 'Planeswalker', card: 'Nicol Bolas, Planeswalker', number: '120', focus: '50% 25%'},
    cruel: {name: 'Five-Colour Control', title: '2008 to 2009', card: 'Cruel Ultimatum', number: '164', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Sky Over Bant', difficulty: 'Easy', rewardSet: 'ala', teaches: ['Exalted'],
      blurb: 'On Bant, Rafiq of the Many leads the knights of Valeron. One morning the sky over the castle fills with metal: sphinxes and gargoyles from Esper, a shard that should not exist.',
      hero: {who: 'rafiq', deck: {label: 'tribute', name: 'The Knights of Valeron', colors: 'GWU', list: `
2 Rafiq of the Many
4 Noble Hierarch
4 Akrasan Squire
4 Knight of the Skyward Eye
4 Steward of Valeron
4 Sigiled Paladin
4 Waveskimmer Aven
4 Bant Charm
4 Rhox War Monk
2 Battlegrace Angel
4 Seaside Citadel
8 Plains
8 Forest
4 Island`}},
      villain: {who: 'sharuum', deck: {label: 'tribute', name: 'The Hegemon\'s Guard', colors: 'WUB', list: `
2 Sharuum the Hegemon
4 Etherium Sculptor
4 Esper Battlemage
4 Filigree Sages
4 Sanctum Gargoyle
4 Faerie Mechanist
4 Courier's Capsule
4 Vectis Silencers
2 Ornithopter
4 Cloudheath Drake
4 Arcane Sanctum
8 Island
6 Plains
6 Swamp`}},
      scene: [q('rafiq', 'Even in single combat, I am never alone.'),
        s('rafiq', 'Exalted: whenever a creature attacks alone, it gets +1/+1 for every exalted permanent you control. One knight, carrying the strength of all of them.')],
      villainScene: [q('stage', 'To gain audience with the hegemon, one must bring a riddle she has not heard.'),
        q('sharuum', 'Soon I will sleep, eyes closing to a world tarnished with flesh, and then wake to a polished vision.')],
      cues: {hero: cue('For Valeron!', 'Strike alone, strike for all!', 'The sky is full of them...', 'The castle stands.', 'The sigils... fade...', 'One attacker. All the strength.'),
        villain: cue('Your flesh offends me.', 'Etherium does not bleed.', 'Unexpected.', 'Polished.', 'A riddle... I could not answer...')},
      after: [s('rafiq', 'Metal birds from a world with no name. The old stories said Bant was the whole of creation. The old stories were wrong.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Dragon-Speaker', difficulty: 'Easy', rewardSet: 'ala', teaches: ['Devour'],
      blurb: 'Ajani Goldmane is a leonin of Naya and a planeswalker. His brother Jazal is dead, and the trail of the killer leads to Jund, where a shaman named Sarkhan Vol worships dragons and serves an older one.',
      hero: {who: 'ajani', deck: {label: 'tribute', name: 'The Pride of Naya', colors: 'RGW', list: `
4 Wild Nacatl
4 Druid of the Anima
4 Steward of Valeron
4 Rip-Clan Crasher
4 Woolly Thoctar
4 Rhox Brute
4 Naya Charm
4 Lightning Bolt
2 Ajani Goldmane
2 Knight of New Alara
4 Jungle Shrine
8 Forest
6 Mountain
6 Plains`}},
      villain: {who: 'sarkhan', deck: {label: 'tribute', name: 'The Dragon-Speaker\'s Hunt', colors: 'BRG', list: `
2 Sarkhan Vol
4 Dragon Fodder
4 Sprouting Thrinax
4 Vithian Stinger
4 Thorn-Thrash Viashino
2 Hellkite Overlord
2 Predator Dragon
4 Dragonsoul Knight
4 Jund Hackblade
4 Blightning
2 Shivan Dragon
4 Savage Lands
10 Mountain
5 Forest
5 Swamp`}},
      scene: [q('ajani', 'One\'s blade is only as sharp as one\'s conviction.'),
        s('ajani', 'Jund does not hide what it is. Eat or be eaten. Their dragons will devour their own goblins to grow, so kill the dragon, not the goblins.')],
      villainScene: [q('sarkhan', 'The dragon is a perfect marriage of power and the will to use it.'),
        s('sarkhan', 'Devour: as this creature arrives, sacrifice any number of creatures. It gets a +1/+1 counter for each one it eats.'),
        q('stage', 'Goblins journey to the sacrificial peaks in pairs so that the rare survivor might be able to relate the details of the other\'s grisly demise.')],
      cues: {hero: cue('For Jazal.', 'The pride hunts!', 'Too many wings...', 'Talk, shaman.', 'Jazal... I\'m sorry...', 'Kill the dragon.'),
        villain: cue('Burn, cat.', 'The dragon feeds!', 'My dragons...', 'Words are a waste of time.', 'A greater dragon... will come...')},
      after: [s('sarkhan', 'You think I killed your brother? I serve something far larger than a murder. You will meet him soon enough.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Seekers of Carmot', difficulty: 'Easy', rewardSet: 'ala', teaches: ['Ultimates'],
      blurb: 'Elspeth Tirel, a planeswalker who has seen too many wars, is hiding on Bant because it seemed like a world without one. Then Esper\'s Seekers of Carmot arrive, led by Tezzeret, an artificer who works for Bolas.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'The Knight-Errant', colors: 'W', list: `
2 Elspeth, Knight-Errant
4 Elite Vanguard
4 Akrasan Squire
4 Knight of the White Orchid
4 Sigiled Paladin
4 Ranger of Eos
4 Soul Warden
4 Path to Exile
2 Martial Coup
4 Stormfront Pegasus
24 Plains`}},
      villain: {who: 'tezzeret', deck: {label: 'tribute', name: 'The Seekers of Carmot', colors: 'WUB', list: `
2 Tezzeret the Seeker
4 Master of Etherium
4 Etherium Sculptor
4 Ornithopter
4 Esper Stormblade
4 Tidehollow Sculler
4 Courier's Capsule
4 Executioner's Capsule
2 Sphinx of the Steel Wind
4 Esper Charm
4 Arcane Sanctum
8 Island
6 Swamp
6 Plains`}},
      scene: [q('elspeth', 'Only by the bravery of those who put loyalty above glory is our home kept safe.'),
        s('elspeth', 'Ultimates: every planeswalker has a last ability that costs a lot of loyalty. Keep her alive long enough and it ends games. That is why they attack her and not me.')],
      villainScene: [q('tezzeret', 'Esper, like any work of art, can be truly appreciated only from a distance.'),
        q('tezzeret', 'Etherium is limited. Innovation is not.')],
      cues: {hero: cue('Not this world. Not again.', 'Soldiers, to me!', 'Every one of them is armored...', 'Go home, Seeker.', 'Another world... lost...', 'Protect the walker.'),
        villain: cue('Fascinating. Flesh with a sword.', 'Assemble.', 'Inefficient.', 'Collected.', 'Recalculating...')},
      after: [s('elspeth', 'He kept calling my soldiers "samples". I would like to never hear that word again.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Ajani\'s Revenge', difficulty: 'Normal', rewardSet: 'ala', teaches: ['Unearth'],
      blurb: 'The trail of Jazal\'s death runs through Grixis, the shard of the dead. Sedris, the Traitor King, rules there. Ajani arrives angry, and his anger has a new shape: Ajani Vengeant.',
      hero: {who: 'vengeant', deck: {label: 'tribute', name: 'Ajani Vengeant', colors: 'RGW', list: `
2 Ajani Vengeant
4 Wild Nacatl
4 Elite Vanguard
4 Ranger of Eos
4 Mosstodon
4 Rip-Clan Crasher
4 Akrasan Squire
4 Knight of New Alara
4 Rhox Brute
2 Naya Charm
4 Jungle Shrine
8 Plains
6 Mountain
6 Forest`}},
      villain: {who: 'sedris', deck: {label: 'tribute', name: 'The Traitor King\'s Court', colors: 'UBR', list: `
2 Sedris, the Traitor King
4 Dregscape Zombie
4 Hellspark Elemental
4 Sedraxis Specter
4 Lightning Bolt
4 Blightning
4 Agony Warp
4 Kederekt Creeper
2 Lich Lord of Unx
4 Terminate
4 Crumbling Necropolis
8 Swamp
6 Island
6 Mountain`}},
      scene: [q('ajani', 'Retribution is best delivered by claws and rage, with both magnified.'),
        s('ajani', 'Their dead come back. Fine. I will kill them again.')],
      villainScene: [q('sedris', 'This is going to hurt a lot, but on the bright side, you\'ll be dead soon.'),
        s('sedris', 'Unearth: pay the unearth cost and a creature in your graveyard comes back with haste for one turn, then is exiled. Every dead servant gets one last fight.'),
        q('sedris', 'The meek inherit nothing.')],
      cues: {hero: cue('Where is he?', 'Vengeance!', 'They keep rising...', 'Stay down.', 'Not... yet...', 'Kill them twice.'),
        villain: cue('Kneel.', 'Rise and strike!', 'My court crumbles...', 'Dead, like all the rest.', 'A traitor... betrayed...')},
      after: [s('sedris', 'Your brother? Killed for a dragon\'s convenience, cat. Everyone on Alara is a pawn. Even me. Especially you.'),
        s('ajani', 'Then I will go to the one moving the pieces.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Where Ancients Tread', difficulty: 'Normal', rewardSet: 'arb', teaches: ['Cascade'],
      blurb: 'The shards collide. Jund\'s warlord Kresh the Bloodbraided crosses into Naya with a horde behind him, and Mayael the Anima, who speaks for Naya\'s giant gods, leads the gargantuans to meet him.',
      hero: {who: 'mayael', deck: {label: 'tribute', name: 'The Anima\'s Gargantuans', colors: 'RGW', list: `
2 Mayael the Anima
4 Bloodbraid Elf
4 Cylian Elf
4 Druid of the Anima
4 Woolly Thoctar
2 Godsire
4 Rhox Brute
4 Enlisted Wurm
4 Mosstodon
2 Spellbreaker Behemoth
2 Naya Charm
4 Jungle Shrine
10 Forest
5 Mountain
5 Plains`}},
      villain: {who: 'kresh', deck: {label: 'tribute', name: 'The Bloodbraided Horde', colors: 'BRG', list: `
2 Kresh the Bloodbraided
4 Lightning Bolt
4 Sprouting Thrinax
4 Thunder-Thrash Elder
4 Mycoloth
4 Skullmulcher
4 Blightning
2 Predator Dragon
4 Jund Hackblade
4 Terminate
4 Savage Lands
8 Forest
6 Mountain
6 Swamp`}},
      scene: [q('mayael', 'Never subtle nor cryptic is the reckoning of the mighty.'),
        s('mayael', 'Cascade: when you cast a cascade spell, reveal cards from the top of your library until you hit a cheaper nonland card. Cast it for free. Two spells for the price of one.')],
      villainScene: [q('stage', 'Each of his twenty-two braids is bound with bone and leather from a foe.'),
        q('kresh', 'When the wielder is strong enough, any sword will do.')],
      cues: {hero: cue('The gods walk.', 'Another, for free!', 'The horde is endless...', 'Naya holds.', 'The jungle... burns...', 'One spell, then another.'),
        villain: cue('Fresh meat.', 'Eat them!', 'Your beasts bite back...', 'A twenty-third braid.', 'Jund... remembers...')},
      after: [q('stage', 'When the shards merged, Mayael found herself the general of Naya\'s mightiest army.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Jund', difficulty: 'Normal', rewardSet: 'arb', teaches: ['Card advantage'],
      blurb: 'In the real summer of 2009, Standard belonged to Jund: Bloodbraid Elf, Sprouting Thrinax, Blightning and Maelstrom Pulse, every card worth two. Its rival on the aggressive side was Naya Zoo.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Jund', colors: 'BRG', archetype: 'Midrange', list: `
4 Bloodbraid Elf
4 Sprouting Thrinax
4 Blightning
4 Maelstrom Pulse
4 Lightning Bolt
4 Broodmate Dragon
4 Rip-Clan Crasher
4 Jund Hackblade
4 Terminate
4 Savage Lands
4 Dragonskull Summit
4 Rootbound Crag
6 Forest
4 Mountain
2 Swamp`}},
      villain: {who: 'zoo', deck: {label: 'tribute', name: 'Naya Zoo', colors: 'RGW', archetype: 'Aggro', list: `
4 Wild Nacatl
4 Noble Hierarch
4 Woolly Thoctar
4 Knight of New Alara
4 Qasali Pridemage
4 Ranger of Eos
4 Path to Exile
4 Lightning Bolt
2 Ajani Vengeant
2 Baneslayer Angel
4 Jungle Shrine
4 Rootbound Crag
4 Sunpetal Grove
6 Forest
3 Plains
3 Mountain`}},
      scene: [q('stage', 'Jund is a world as cruel as those who call it home.'),
        s('you', 'Every card in this deck trades for two of theirs. Bloodbraid cascades, Thrinax leaves tokens, Blightning takes two cards and three life. Just keep trading.')],
      villainScene: [q('stage', 'The Cloud Nacatl sit and think, a bunch of soft paws. We are the Claws of Marisi, stalking, pouncing, drawing blood.')],
      cues: {hero: cue('Jund \'em out.', 'Cascade!', 'They\'re too fast...', 'Two for one, every time.', 'Out-traded...', 'Trade, and trade again.'),
        villain: cue('[a growl in the brush]', '[the pride pounces]', '[the pride scatters]', '[mauled]', '[the jungle goes quiet]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Exalted Knights', difficulty: 'Normal', rewardSet: 'con', teaches: ['Racing'],
      blurb: 'Summer 2009, the other side of the format. Bant knights with exalted and angels raced Esper artifact decks led by Master of Etherium, which grows with every artifact it sees.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Bant Aggro', colors: 'GWU', archetype: 'Aggro', list: `
4 Noble Hierarch
2 Rafiq of the Many
4 Steward of Valeron
4 Rhox War Monk
4 Knight of New Alara
4 Bant Charm
4 Path to Exile
2 Elspeth, Knight-Errant
4 Battlegrace Angel
4 Waveskimmer Aven
4 Seaside Citadel
4 Glacial Fortress
4 Sunpetal Grove
6 Forest
4 Plains
2 Island`}},
      villain: {who: 'esperAggro', deck: {label: 'tribute', name: 'Esper Artifacts', colors: 'WUB', archetype: 'Aggro', list: `
4 Tidehollow Sculler
4 Esper Stormblade
4 Master of Etherium
4 Esper Battlemage
4 Sanctum Gargoyle
4 Path to Exile
4 Esper Charm
4 Executioner's Capsule
2 Sphinx of the Steel Wind
2 Etherium Sculptor
4 Arcane Sanctum
4 Glacial Fortress
4 Drowned Catacomb
4 Plains
4 Island
4 Swamp`}},
      scene: [q('stage', 'For wisdom\'s sake, it was built high to gaze on all things. For glory\'s sake, it was built high as a testament of power. For strength\'s sake, it was built high to repel all attacks.'),
        s('you', 'Attack with one, grow it with everything. Their fliers block well, so swing first and make them chump.')],
      villainScene: [q('stage', 'Only a mind unfettered with the concerns of the flesh can see the world as it truly is.'),
        q('stage', 'The greatest masters of the craft abandon tools altogether, shaping metal with hand and mind alone.')],
      cues: {hero: cue('Ride out.', 'Exalted!', 'Their metal holds...', 'The knights prevail.', 'Unhorsed...', 'Race them.'),
        villain: cue('[gears turn]', '[etherium hums]', '[a rattle of loose parts]', '[polished]', '[scrap]')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Conflux', difficulty: 'Hard', rewardSet: 'con', rewardCard: 'Nicol Bolas, Planeswalker', teaches: ['Combat math'],
      blurb: 'The five shards slam together into one world, and the mana of the collision pours toward one place. Nicol Bolas waits there to drink it. Ajani rallies Bant\'s champions, Rafiq and Elspeth, to stand in his way.',
      hero: {who: 'ajani', deck: {label: 'tribute', name: 'Ajani, Elspeth and Rafiq', colors: 'GWU', list: `
2 Ajani Goldmane
2 Elspeth, Knight-Errant
2 Rafiq of the Many
4 Noble Hierarch
4 Knight of New Alara
4 Rhox War Monk
4 Waveskimmer Aven
4 Battlegrace Angel
4 Path to Exile
4 Bant Charm
2 Baneslayer Angel
4 Seaside Citadel
4 Glacial Fortress
4 Sunpetal Grove
5 Forest
5 Plains
2 Island`}},
      villain: {who: 'bolas', deck: {label: 'tribute', name: 'The Harvest of Alara', colors: 'UBR', archetype: 'Control', list: `
2 Nicol Bolas, Planeswalker
2 Cruel Ultimatum
4 Sedraxis Specter
4 Blightning
4 Agony Warp
4 Terminate
4 Lightning Bolt
4 Kederekt Creeper
4 Fleshbag Marauder
2 Malfegor
2 Lich Lord of Unx
4 Crumbling Necropolis
4 Dragonskull Summit
4 Drowned Catacomb
4 Island
5 Swamp
3 Mountain`}},
      scene: [q('stage', 'As the shards merged into the Maelstrom, their mana energies fused into new monstrosities.'),
        s('ajani', 'He planned every collision. Every war on every shard. Jazal was one more stone he had to move out of the road.'),
        s('elspeth', 'I came to Bant to get away from wars. It seems they follow me.'),
        q('rafiq', 'Those talons really dig into your skin, but it\'s better than being dropped.')],
      villainScene: [q('bolas', 'The finest pawns are those with pawns of their own.'),
        q('stage', 'Nicol Bolas doesn\'t distinguish between servants and victims.'),
        s('bolas', 'You are standing between me and five worlds\' worth of mana, little cat. So was your brother.')],
      cues: {hero: cue('For Alara.', 'Now, together!', 'He has an answer for everything...', 'Not this time.', 'The Maelstrom... takes us...', 'Count before you swing.'),
        villain: {...cue('Kneel, little things.', 'There is always a greater power.', 'You are tiresome.', 'Harvested.', 'This changes... nothing...'),
          half: {who: 'elspeth', line: 'He\'s bleeding. Keep pushing.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Cruel Ultimatum', difficulty: 'Hard', rewardSet: 'ala', rewardCard: 'Cruel Ultimatum', mood: 'boss',
      teaches: ['Playing around counterspells'],
      archive: {deck: 'Five-Colour Control', when: '2008 to 2009', format: 'Standard: Lorwyn and Shadowmoor blocks, Shards of Alara and Tenth Edition.',
        what: 'A control deck that played all five colours, answered everything early, and won with Cruel Ultimatum, a seven-mana sorcery: the opponent sacrifices a creature, discards three cards and loses 5 life, while you draw three, gain 5 life and get a creature card back from your graveyard.',
        why: 'Five-Colour Control won the 2008 World Championship. It ran Cruel Ultimatum, Cryptic Command and Kitchen Finks, with lands that made any colour.',
        beat: 'Pressure early and spread your threats out, so a single sweeper like Volcanic Fallout cannot clear them all. Keep cards in hand if you can; Cruel Ultimatum hurts less when you have more to lose.',
        after: 'Cruel Ultimatum was never banned. It is remembered as the most greedy card of its time, and players still call any seven-mana blowout "a Cruel".'},
      blurb: 'Deep in the archive, the most expensive sorcery a control deck ever built around.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Grixis Unearth', colors: 'UBR', archetype: 'Aggro', list: `
4 Skeletal Kathari
4 Dregscape Zombie
4 Hellspark Elemental
4 Sedraxis Specter
4 Kathari Bomber
4 Blightning
4 Agony Warp
4 Kederekt Creeper
4 Bone Splinters
4 Crumbling Necropolis
8 Swamp
6 Island
6 Mountain`}},
      villain: {who: 'cruel', deck: {label: 'tribute', name: 'Five-Colour Control', note: 'Built from the 2008 and 2009 Five-Colour Control lists with Cruel Ultimatum, using cards from this act\'s sets only, so Cryptic Command and Kitchen Finks are not in it. No single tournament list is copied.', colors: 'WUBRG', archetype: 'Control', list: `
4 Woolly Thoctar
2 Cruel Ultimatum
4 Broodmate Dragon
4 Volcanic Fallout
4 Agony Warp
4 Bloodbraid Elf
4 Maelstrom Pulse
2 Baneslayer Angel
4 Lightning Bolt
4 Sprouting Thrinax
4 Exotic Orchard
4 Arcane Sanctum
4 Crumbling Necropolis
4 Savage Lands
2 Island
2 Swamp
2 Mountain
1 Forest
1 Plains`}},
      scene: [q('stage', 'The undead of Grixis are fueled by their hatred of the living.'),
        s('you', 'They want a long game and seven mana. I will give them neither.')],
      villainScene: [q('stage', 'There is always a greater power.')],
      cues: {hero: cue('Rise and rush.', 'Unearth!', 'Swept away...', 'No seventh land for you.', 'Ultimatum...', 'Go wide, go fast.'),
        villain: cue('[a hand full of answers]', '[the ultimatum resolves]', '[mana falters]', '[five, three, one]', '[the last answer runs out]')},
      after: [s('stage', 'Recorded: never banned. The deck that won the 2008 World Championship.')]},
  ],
};
