// Act 14: The Time Rifts (Coldsnap, Time Spiral, Planar Chaos, Future Sight, Tenth Edition). Story and dialogue:
// /mnt/project-files/story/act-14-script.md (generated from this file). Land set: tsp (snow basics from Coldsnap).
// Every disaster in Dominaria's history tore a hole in time, and now the holes are opening. Jhoira, Venser and Radha
// chase the rifts across a broken world toward the Mending. Every quoted line is real flavor text from Coldsnap or the
// Time Spiral block; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'broken-time-rifts',
  era: '2007-07-20',
  intro: [s('stage', 'Dominaria, centuries after the Phyrexian Invasion. The world is ash and salt, and the sky has started to tear.'),
    q('stage', 'As the temporal fractures spread and time itself slowly fell apart, visitors started to appear from across the past and future, and those native to the present began to disappear.'),
    s('stage', 'Every disaster in Dominaria\'s history left a wound in time: the Sylex, the Invasion, an island Teferi pulled out of the world. Now all of the wounds are opening at once.'),
    q('stage', 'Take two steps north into the unsettled future, south into the unquiet past, east into the present day, or west into the great unknown.')],
  finale: [s('stage', 'In Urborg, the last and largest rift closes. Nicol Bolas is driven back through it.'),
    s('stage', 'The price is the Mending. Planeswalkers were once nearly gods. After today, none of them will be. Teferi has already given up his spark, and Freyalise gave her life to close a rift of her own.'),
    s('jhoira', 'Time runs one way again. I had forgotten how quiet that is.'),
    s('venser', 'And I have a spark I didn\'t ask for, on the one day it stopped meaning anything.'),
    q('stage', 'Wind time\'s watch, and watch time unwind.')],
  villainFinale: [s('stage', 'The rifts stay open. Bolas walks through them like doors.'),
    q('bolas', 'Do the innocent pay for the crimes of the guilty? Of course they do. That\'s the fate of the weak.'),
    s('bolas', 'They thought the rifts were a wound. I see a road. Every age of this world, waiting for me to take it back.'),
    s('stage', 'The Mending never comes. Somewhere in the past, an old dragon wakes up very pleased.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', fixed: fixed('Fold into Aether', '5dn', '31', '615157d6-0160-417b-b06c-0e253b306c37', 'Anthony S. Waters & Cara Mitten')},
    jhoira: {name: 'Jhoira', title: 'Of the Ghitu, Master Artificer', card: 'Jhoira of the Ghitu', number: '157', focus: '50% 25%'},
    hive: {name: 'The Hive', title: 'Queenless Slivers', card: 'Gemhide Sliver', focus: '50% 30%'},
    freyalise: {name: 'Freyalise', title: 'Goddess of Skyshroud', card: 'Freyalise\'s Radiance', focus: '50% 30%'},
    thelon: {name: 'Thelon', title: 'Of Havenwood', card: 'Thelon of Havenwood', number: '227', focus: '50% 25%'},
    venser: {name: 'Venser', title: 'Shaper Savant', card: 'Venser, Shaper Savant', number: '46', focus: '50% 25%'},
    cabal: {name: 'The Cabal\'s Echo', title: 'Urborg', card: 'Magus of the Coffers', number: '73', focus: '50% 25%'},
    radha: {name: 'Radha', title: 'Heir to Keld', card: 'Radha, Heir to Keld', number: '162', focus: '50% 25%'},
    limdul: {name: 'Lim-Dûl', title: 'The Necromancer, Returned', card: 'Lim-Dûl the Necromancer', number: '114', focus: '50% 25%'},
    goyf: {name: 'The Future', title: 'A Timeline That Never Was', card: 'Tarmogoyf', number: '153', focus: '50% 30%'},
    heidar: {name: 'Heidar', title: 'Rimewind Master', card: 'Heidar, Rimewind Master', number: '36', focus: '50% 25%'},
    blink: {name: 'Blink', title: 'Summer 2007', card: 'Momentary Blink', number: '29', focus: '50% 30%'},
    teferi: {name: 'Teferi\'s Echo', title: 'Mage of Zhalfir', card: 'Teferi, Mage of Zhalfir', number: '83', focus: '50% 25%'},
    bolas: {name: 'Nicol Bolas', title: 'Through the Rift', card: 'Nicol Bolas', number: '98', focus: '50% 25%'},
    pickles: {name: 'Pickles', title: 'Spring 2007', card: 'Brine Elemental', number: '50', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Things from the Rift', difficulty: 'Easy', rewardSet: 'tsp', teaches: ['Suspend'],
      blurb: 'Jhoira of the Ghitu, artificer of the old Weatherlight, studies the rifts. Today one opens next to her workshop and a hive of queenless slivers comes out of it.',
      hero: {who: 'jhoira', deck: {label: 'tribute', name: 'Jhoira\'s Workshop', colors: 'UR', list: `
4 Rift Bolt
4 Keldon Halberdier
4 Riftwing Cloudskate
4 Errant Ephemeron
2 Shivan Meteor
4 Viashino Bladescout
4 Fathom Seer
4 Coal Stoker
4 Sudden Shock
2 Lightning Axe
12 Island
12 Mountain`}},
      villain: {who: 'hive', deck: {label: 'tribute', name: 'Rift-Born Slivers', colors: 'GW', list: `
4 Sidewinder Sliver
4 Children of Korlis
4 Gemhide Sliver
4 Spinneret Sliver
4 Watcher Sliver
4 Fungus Sliver
4 Venser's Sliver
4 Poultice Sliver
14 Forest
14 Plains`}},
      scene: [q('stage', 'Some time rifts didn\'t take away the people but just the ground they stood on.'),
        s('jhoira', 'Suspend: pay the suspend cost and exile the card with time counters on it. Remove one each upkeep. When the last one comes off, you cast it for free.'),
        s('jhoira', 'Pay now, win later. A good artificer plans three turns ahead.')],
      villainScene: [q('stage', 'They encircled our patrol with the stealth of snakes, corralling us like livestock.'),
        q('freyalise', 'Slivers are guided only by simple instinct. Advance the hive, and you will be welcomed. Impede the hive, and you will face unrelenting opposition.')],
      cues: {hero: cue('Let\'s see what time it is.', 'Right on schedule!', 'Too many of them...', 'Back through the rift.', 'Time... ran out...', 'Pay now, win later.'),
        villain: cue('[chittering]', '[the hive surges]', '[the hive scatters]', '[the hive feeds]', '[silence]')},
      after: [s('jhoira', 'Slivers from Rath, in a field that was salt this morning. The rifts are getting bigger. I need help, and I know a boy in Urborg who builds impossible things.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Second Winter', difficulty: 'Easy', rewardSet: 'csp', teaches: ['Snow'],
      blurb: 'The rifts reopen the Ice Age in the north. Freyalise, goddess of the elves, sends her druids into the cold, and the thallids of old Havenwood come out of a rift to meet them.',
      hero: {who: 'freyalise', deck: {label: 'tribute', name: 'Into the North', colors: 'G', list: `
4 Boreal Druid
4 Sound the Call
4 Ronom Hulk
4 Brooding Saurian
2 Into the North
2 Panglacial Wurm
4 Penumbra Spider
4 Craw Wurm
4 Llanowar Elves
4 Giant Growth
24 Snow-Covered Forest`}},
      villain: {who: 'thelon', deck: {label: 'tribute', name: 'Thallid Colony', colors: 'BG', list: `
4 Thallid Germinator
4 Thallid Shell-Dweller
4 Deathspore Thallid
4 Pit Keeper
4 Psychotrope Thallid
4 Vitaspore Thallid
4 Thallid
4 Utopia Mycon
18 Forest
10 Swamp`}},
      scene: [q('stage', 'Our border lands fall under the grip of Heidar\'s second winter. Go forth and reclaim them for Yavimaya.'),
        q('freyalise', 'Life cannot be created and then abandoned. It must be nurtured and fed so that it may express its ripened might.'),
        s('freyalise', 'Snow: snow lands make snow mana, and some cards pay with it or care how much you have. The cold is a resource here.')],
      villainScene: [q('thelon', 'The sight of my thallids still thriving is a bittersweet welcome to this cold waste.'),
        s('thelon', 'Spores, my children. Every three turns, another of you.')],
      cues: {hero: cue('The Juniper Order marches.', 'Grow!', 'The cold bites...', 'The north is ours again.', 'Skyshroud... I am sorry...', 'The cold is ours too.'),
        villain: cue('[spores drift]', '[the colony blooms]', '[the colony withers]', '[saprolings everywhere]', '[the fungus goes dormant]')},
      after: [q('freyalise', 'The land is weary. Even Skyshroud is depleted. We must find another source of mana—one that is growing despite our withering world.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Faster Than Thought', difficulty: 'Easy', rewardSet: 'tsp', teaches: ['Split second'],
      blurb: 'In the swamps of Urborg, a young inventor named Venser builds a teleporter that should not work. An echo of the old Cabal wants it, and it does not ask nicely.',
      hero: {who: 'venser', deck: {label: 'tribute', name: 'Venser\'s Workshop', colors: 'UW', list: `
2 Venser, Shaper Savant
4 Celestial Crusader
4 Stonecloaker
4 Whitemane Lion
4 Wipe Away
4 Momentary Blink
4 Fathom Seer
4 Riftwing Cloudskate
4 Benalish Knight
2 Benalish Cavalry
12 Plains
12 Island`}},
      villain: {who: 'cabal', deck: {label: 'tribute', name: 'The Cabal\'s Echo', colors: 'B', list: `
4 Scathe Zombies
4 Faceless Devourer
4 Festering Goblin
4 Drudge Skeletons
4 Rathi Trapper
4 Vampire Bats
4 Ravenous Rats
4 Drudge Reavers
4 Gutless Ghoul
24 Swamp`}},
      scene: [q('stage', 'His marvels of artifice pale in comparison to the developing machinery of his mind.'),
        q('venser', 'Two magi could trade spells all day and never crown a victor. The real battle is not one of power but of will. If your confidence breaks, so too shall you.'),
        s('venser', 'Split second: while a split second spell is on the stack, nobody can cast spells or activate abilities. No answers, no tricks. It just happens.')],
      villainScene: [q('stage', 'All that remains of the Cabal are the echoes in its deepest vault. Yet those who hear the echoes feel a power undiminished by the dust of ages.'),
        q('stage', 'Some mages tapped into the time rifts, forcing upon others alternate timelines in which unimaginable horrors befall them.')],
      cues: {hero: cue('Hold still. This is a prototype.', 'Blink!', 'It\'s not working...', 'It worked! It actually worked!', 'Back to the drawing board...', 'Too fast to answer.'),
        villain: cue('[the vault echoes]', '[a sudden death]', '[the echo fades]', '[swallowed by the swamp]', '[the vault goes quiet]')},
      after: [s('jhoira', 'You teleported a fortress\'s worth of zombies into a bog.'),
        s('venser', 'I was aiming for a different bog.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Necromancer Returns', difficulty: 'Normal', rewardSet: 'tsp', teaches: ['Racing'],
      blurb: 'Radha, heir to Keld, was born in Skyshroud with a Keldon temper. A rift has opened on her warlord\'s road, and out of it walks a necromancer from the Ice Age: Lim-Dûl, from Act 3.',
      hero: {who: 'radha', deck: {label: 'tribute', name: 'Radha\'s Warband', colors: 'RG', list: `
2 Radha, Heir to Keld
4 Llanowar Elves
4 Keldon Marauders
4 Mogg War Marshal
4 Blood Knight
4 Gathan Raiders
4 Rift Bolt
4 Giant Growth
4 Incinerate
2 Fomori Nomad
12 Mountain
12 Forest`}},
      villain: {who: 'limdul', deck: {label: 'tribute', name: 'The Necromancer\'s Servants', colors: 'B', list: `
2 Lim-Dûl the Necromancer
4 Gravedigger
4 Corpulent Corpse
4 Drudge Reavers
4 Phyrexian Rager
4 Scathe Zombies
4 Mass of Ghouls
4 Severed Legion
4 Sudden Death
2 Dread Return
24 Swamp`}},
      scene: [q('stage', 'Radha was born in Skyshroud, but her temper is undeniably Keldon.'),
        q('radha', 'Run home, cur. I\'ve already taken your master\'s head. Don\'t make me thrash you with it.'),
        s('radha', 'He raises what we kill. So we kill him faster than he can raise them. Go!')],
      villainScene: [q('limdul', 'The surface of the land is blanched with salt, but the soil beneath is reddened with death—a fertile ground for necromancy.'),
        s('limdul', 'I fell in the Ice Age. The rift was kind enough to give me a second winter.')],
      cues: {hero: cue('KELD!', 'Take his head!', 'The dead keep coming...', 'Stay dead this time.', 'Lying in triumph... upon the broken...', 'Faster than he raises them.'),
        villain: cue('Rise.', 'Rise again.', 'My servants fail...', 'Another soldier for my army.', 'Not... again...')},
      after: [q('radha', 'I hope to have such a death—lying in triumph upon the broken bodies of those who slew me.'),
        s('jhoira', 'Not today. We need you, Radha. The rifts are coming from Urborg.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'A Future That Never Was', difficulty: 'Normal', rewardSet: 'fut', teaches: ['Card types'],
      blurb: 'Some rifts open onto futures that never happened. Out of one comes a lizard that grows from every kind of card in every graveyard. Heidar, Rimewind master, wants the world frozen before it can happen.',
      hero: {who: 'goyf', deck: {label: 'tribute', name: 'Futureshifted', colors: 'GW', list: `
4 Tarmogoyf
4 Llanowar Elves
4 Blade of the Sixth Pride
4 Calciderm
4 Saltskitter
4 Aven Riftwatcher
4 Giant Growth
4 Knight of Sursi
4 Wild Griffin
12 Forest
12 Plains`}},
      villain: {who: 'heidar', deck: {label: 'tribute', name: 'The Rimewind Cult', colors: 'U', list: `
2 Heidar, Rimewind Master
4 Frost Raptor
4 Krovikan Mist
4 Snapping Drake
4 Air Elemental
4 Cloud Elemental
4 Aven Fisher
4 Cancel
4 Unsummon
2 Rimefeather Owl
24 Snow-Covered Island`}},
      scene: [q('stage', 'Those gifted with the sight have one eye in the present and the other in the future.'),
        s('stage', 'Card types: Tarmogoyf counts the different card types in all graveyards, yours and theirs. Creature, instant, sorcery, land, enchantment, artifact. Every trade makes it bigger.'),
        q('stage', 'I am irrelevant. The future I hold in my hands is everything.')],
      villainScene: [q('heidar', 'The umber stain of the Thaw will be bleached away. Once again the world will be sharp, white, perfect!'),
        q('heidar', 'Nature? Fire? Bah! Both are chaotic and difficult to control. Ice is structured, latticed, light as a feather, massive as a glacier. In ice, there is power!')],
      cues: {hero: cue('The future arrives.', 'It grows!', 'Frozen in place...', 'This timeline holds.', 'A future... unwritten...', 'Fill the graveyards.'),
        villain: cue('Winter returns.', 'Freeze!', 'The Thaw spreads...', 'Sharp, white, perfect.', 'Melting... melting...')},
      after: [s('venser', 'That thing came from a future that doesn\'t exist anymore. I would like to stop thinking about that now.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Big Red', difficulty: 'Normal', rewardSet: 'plc', teaches: ['Direct damage'],
      blurb: 'In the real summer of 2007, Standard was rifts and suspend. A red deck of Keldon Marauders and burn raced everything, and the deck it most wanted to race was Blink, built around Momentary Blink.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Big Red', colors: 'R', archetype: 'Aggro', list: `
4 Keldon Marauders
2 Rift Bolt
2 Raging Goblin
4 Goblin Piker
4 Blood Knight
4 Mogg Fanatic
4 Viashino Runner
4 Hill Giant
4 Bogardan Firefiend
4 Bloodrock Cyclops
24 Mountain`}},
      villain: {who: 'blink', deck: {label: 'tribute', name: 'Blink', colors: 'UW', archetype: 'Tempo', list: `
2 Teferi, Mage of Zhalfir
4 Whitemane Lion
4 Stonecloaker
4 Aven Riftwatcher
4 Riftwing Cloudskate
4 Momentary Blink
4 Wild Griffin
4 Calciderm
4 Celestial Crusader
2 Errant Ephemeron
12 Plains
12 Island`}},
      scene: [q('stage', 'The Keldons used the toxic vents in the cracked earth to bolster their home\'s defenses.'),
        s('you', 'They blink their creatures to get the arrival trigger again. I\'ll aim at their face and let them blink all they like.')],
      villainScene: [q('stage', 'Saltfield nomads call a sudden storm a "whitemane."'),
        q('stage', 'It disappears each time with the hope that it will not return to the same desolation it left behind.')],
      cues: {hero: cue('Burn.', 'Straight to the face!', 'They keep flickering...', 'Burned out.', 'Out of fuel...', 'Ignore the blinks. Go face.'),
        villain: cue('[a flicker]', '[blink]', '[the light dims]', '[gone in a blink]', '[snuffed]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Teferi\'s Echo', difficulty: 'Normal', rewardSet: 'tsp', teaches: ['Slivers'],
      blurb: 'A rift shows Teferi as he was centuries ago, before the Mending was even a word: proud, brilliant and cold. Against him, a hive of slivers from every colour. In 2007, Mystical Teachings control fought five-colour slivers everywhere.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'The Hive Mind', colors: 'GWR', archetype: 'Slivers', list: `
4 Poultice Sliver
4 Spinneret Sliver
4 Gemhide Sliver
4 Venser's Sliver
4 Might Sliver
4 Sidewinder Sliver
4 Firewake Sliver
4 Harmonic Sliver
4 Watcher Sliver
4 Karplusan Forest
4 Brushland
4 Battlefield Forge
4 Forest
4 Mountain
4 Plains`}},
      villain: {who: 'teferi', deck: {label: 'tribute', name: 'Mystical Teachings', colors: 'UB', archetype: 'Control', list: `
4 Mystical Teachings
2 Teferi, Mage of Zhalfir
4 Damnation
4 Sudden Death
4 Gorgon Recluse
4 Cancel
4 Phyrexian Rager
4 Tolarian Sentinel
4 Faceless Devourer
2 Shadowmage Infiltrator
4 Underground River
12 Island
8 Swamp`}},
      scene: [q('stage', 'Hidden within the clicking, chittering swarm is a unique mind, still young, but growing more aware as time passes.'),
        s('you', 'Every sliver shares its ability with the others. Two make a pair. Five make a wall of teeth.')],
      villainScene: [q('teferi', 'You wish for me to cow your enemies? I can do better than that . . . .'),
        q('teferi', 'It\'s difficult to heal a rift after it begins wandering about on its own.'),
        q('stage', 'To save this plane, he must forsake all others.')],
      cues: {hero: cue('The hive wakes.', 'All together!', 'He counters everything...', 'The hive endures.', 'Scattered...', 'One shares with all.'),
        villain: cue('Let us be quick about this.', 'Countered.', 'Hm. Unexpected.', 'As I foresaw.', 'Interesting... very...')},
      after: [s('stage', 'The echo fades. The real Teferi, far away and centuries older, is already giving up his spark to close a rift at Shiv.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Mending', difficulty: 'Hard', rewardSet: 'tsb', rewardCard: 'Nicol Bolas', teaches: ['Combat math'],
      blurb: 'In Urborg, the last rift is the largest. Nicol Bolas, the elder dragon from Act 2, reaches through it to take back the world he lost. Jhoira, Venser and Radha stand in the way.',
      hero: {who: 'jhoira', deck: {label: 'tribute', name: 'Jhoira, Venser and Radha', colors: 'URG', list: `
2 Venser, Shaper Savant
2 Radha, Heir to Keld
4 Riftwing Cloudskate
4 Keldon Marauders
4 Llanowar Elves
4 Viashino Bladescout
4 Sage Owl
4 Coal Stoker
4 Errant Ephemeron
4 Karplusan Forest
4 Shivan Reef
4 Yavimaya Coast
6 Forest
4 Island
6 Mountain`}},
      villain: {who: 'bolas', deck: {label: 'tribute', name: 'Through the Rift', colors: 'BR', archetype: 'Midrange', list: `
4 Gathan Raiders
4 Blood Knight
4 Skulking Knight
4 Keldon Marauders
4 Sudden Death
4 Incinerate
4 Sudden Shock
4 Flamecore Elemental
4 Evil Eye of Urborg
4 Sulfurous Springs
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'Yawgmoth\'s corpse is a wound in the universe. His foul blood seeps out, infecting the land with his final curse.'),
        s('jhoira', 'He is old, and he is patient, and he has never lost a fight he chose. So we don\'t let him choose.'),
        s('radha', 'Count his blockers before you swing. Then swing anyway.'),
        s('venser', 'I have a teleporter, an artificer and a Keldon. I like our odds less than I\'d hoped.')],
      villainScene: [q('bolas', 'Do the innocent pay for the crimes of the guilty? Of course they do. That\'s the fate of the weak.'),
        s('bolas', 'I was old when your world was young. Every age of Dominaria is mine. The rift merely opens the door.')],
      cues: {hero: cue('Close the rift!', 'Now, all of us!', 'He is everywhere...', 'Time runs one way again.', 'The rift... widens...', 'Count, then swing.'),
        villain: {...cue('Kneel, little things.', 'Burn.', 'The rift is closing...', 'Every age is mine.', 'This is not... the end...'),
          half: {who: 'venser', line: 'He\'s hurt. I didn\'t know he could be hurt.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Pickles', difficulty: 'Hard', rewardSet: 'tsp', rewardCard: 'Vesuvan Shapeshifter', mood: 'boss',
      teaches: ['Playing under a lock'],
      archive: {deck: 'Pickles', when: '2007', format: 'Standard: Ravnica block, Coldsnap, Time Spiral block and Tenth Edition.',
        what: 'A blue morph control deck named after its two-card lock: Brine Elemental and Vesuvan Shapeshifter.',
        why: 'When Brine Elemental is turned face up, every opponent skips their next untap step. Vesuvan Shapeshifter copies it, turns face down, and unmorphs again. Every time it does, you lose another untap step.',
        beat: 'Win before the lock assembles. Brine Elemental needs a lot of mana to unmorph. Pressure early, and keep a spell to kill a face-down morph.',
        after: 'Pickles was never banned. Players still name it whenever two cards lock someone out of the game.'},
      blurb: 'Deep in the archive, the deck that made its opponents skip their turns. Every one of them.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Goyf Beatdown', colors: 'GWR', archetype: 'Aggro', list: `
4 Tarmogoyf
4 Blade of the Sixth Pride
4 Llanowar Elves
4 Calciderm
4 Keldon Marauders
4 Rift Bolt
4 Giant Growth
4 Mogg War Marshal
4 Aven Mindcensor
4 Karplusan Forest
4 Brushland
4 Battlefield Forge
4 Forest
4 Mountain
4 Plains`}},
      villain: {who: 'pickles', deck: {label: 'tribute', name: 'Pickles', note: 'Built from the 2007 Pickles lists with Brine Elemental and Vesuvan Shapeshifter, using cards from this act\'s sets. No single tournament list is copied.', colors: 'U', archetype: 'Lock', list: `
4 Brine Elemental
4 Vesuvan Shapeshifter
4 Fathom Seer
4 Riftwing Cloudskate
4 Cancel
4 Draining Whelk
4 Errant Ephemeron
4 Looter il-Kor
4 Tolarian Sentinel
24 Island`}},
      scene: [q('stage', 'Water calls to water, and the world is left exhausted and withered in its wake.'),
        s('you', 'If the lock comes together, I never untap again. So it can\'t come together.')],
      villainScene: [s('stage', 'The deck does not speak. It waits face down.')],
      cues: {hero: cue('Hit before the lock.', 'Now, while they\'re face down!', 'Nothing untaps...', 'Unpickled.', 'Locked out...', 'Kill the morph.'),
        villain: cue('[a face-down card]', '[unmorph]', '[the shapeshifter falters]', '[skip your untap]', '[the lock breaks]')},
      after: [s('stage', 'Recorded: never banned. One of the most famous locks of its age.')]},
  ],
};
