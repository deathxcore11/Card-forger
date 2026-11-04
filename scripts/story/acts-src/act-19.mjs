// Act 19: The Helvault (Innistrad, Dark Ascension, Avacyn Restored, Magic 2013). Story and dialogue:
// /mnt/project-files/story/act-19-script.md (generated from this file). Land set: isd.
// Innistrad is a plane of gothic horror. Sorin Markov made the archangel Avacyn to protect its humans from vampires.
// Avacyn locked the demon Griselbrand in the silver Helvault and was locked in with him. With her gone, the night is
// winning. Liliana Vess comes hunting the demon who owns her contract, Garruk hunts Liliana, and Tamiyo watches the
// moon. The Helvault breaks: Avacyn returns, Griselbrand comes out with her, and Liliana kills him. Every quoted line is
// real flavor text from the Innistrad block or Magic 2013; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'gothic-helvault-moon',
  era: '2012-07-13',
  intro: [s('stage', 'Innistrad. A world of small stone villages, deep woods and a moon that is never quite safe to look at.'),
    s('stage', 'Long ago the vampire Sorin Markov made an angel, Avacyn, to keep the humans alive. For centuries she did.'),
    q('sorin', 'For centuries my creation kept this world in balance. Now only her shadow remains.'),
    q('stage', 'Some priests speak in whispers of the Helvault, a silver prison of unpurged evils.'),
    s('stage', 'Avacyn locked the demon Griselbrand inside it, and the Helvault took her too. The angels are weak. The wolves are loud. The dead are walking.')],
  finale: [q('stage', 'A golden helix streaked skyward from the Helvault. A thunderous explosion shattered the silver monolith and Avacyn emerged, free from her prison at last.'),
    q('thalia', 'Avacyn emerged from the broken Helvault, but her freedom came at a price—him.'),
    s('stage', 'Griselbrand is out, and he is weakened, and Liliana Vess is waiting for him. She came to this world to kill a demon who held her contract. She does.'),
    s('liliana', 'One down. Tell your angel she is welcome.'),
    q('stage', 'After the destruction of the Helvault, fearful mobs soon became fearless battalions.'),
    s('thalia', 'The bells are ringing in Thraben again. I am not fool enough to think it lasts forever. Tonight, it is enough.')],
  villainFinale: [s('stage', 'The Helvault stays shut. The moon stays red. Thraben\'s walls hold for one more winter, then they do not.'),
    q('stage', '"Oh mighty Griselbrand, Scourge of the Heedless World, gladly I consume myself for thee!"'),
    s('griselbrand', 'Let the silver hold her. I have more patience than your angel, and far more worshippers.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Travel Preparations'},
    thalia: {name: 'Thalia', title: 'Knight-Cathar', card: 'Thalia, Guardian of Thraben', focus: '50% 25%'},
    howlpack: {name: 'The Kessig Howlpack', title: 'Werewolves', card: 'Daybreak Ranger', focus: '50% 30%'},
    mikaeus: {name: 'Mikaeus', title: 'The Lunarch', card: 'Mikaeus, the Lunarch', focus: '50% 25%'},
    olivia: {name: 'Olivia Voldaren', title: 'Vampire', card: 'Olivia Voldaren', focus: '50% 25%'},
    traft: {name: 'Saint Traft', title: 'The Geist', card: 'Geist of Saint Traft', focus: '50% 25%'},
    geralf: {name: 'Geralf', title: 'Stitcher', card: 'Stitched Drake', focus: '50% 30%'},
    garruk: {name: 'Garruk', title: 'Relentless', card: 'Garruk Relentless', focus: '50% 25%'},
    liliana: {name: 'Liliana Vess', title: 'Of the Veil', card: 'Liliana of the Veil', focus: '50% 25%'},
    tamiyo: {name: 'Tamiyo', title: 'The Moon Sage', card: 'Tamiyo, the Moon Sage', focus: '50% 25%'},
    skirsdag: {name: 'The Skirsdag', title: 'Demon cult', card: 'Skirsdag High Priest', focus: '50% 30%'},
    sorin: {name: 'Sorin Markov', title: 'Lord of Innistrad', card: 'Sorin, Lord of Innistrad', focus: '50% 25%'},
    delver: {name: 'Delver', title: 'Winter 2011', card: 'Delver of Secrets', focus: '50% 30%'},
    wolfrun: {name: 'Wolf Run Ramp', title: 'Winter 2011', card: 'Kessig Wolf Run', focus: '50% 40%'},
    zombies: {name: 'Zombies', title: 'Spring 2012', card: 'Gravecrawler', focus: '50% 30%'},
    spirits: {name: 'Spirits', title: 'Spring 2012', card: 'Drogskol Captain', focus: '50% 25%'},
    avacyn: {name: 'Avacyn', title: 'Angel of Hope', card: 'Avacyn, Angel of Hope', focus: '50% 25%'},
    griselbrand: {name: 'Griselbrand', title: 'Demon', card: 'Griselbrand', focus: '50% 25%'},
    vengeance: {name: 'Burning Vengeance', title: 'Late 2011', card: 'Burning Vengeance', focus: '50% 40%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Hunter\'s Moon', difficulty: 'Easy', rewardSet: 'isd', teaches: ['Transform'],
      blurb: 'You arrive on a muddy road outside a Gavony village at dusk. Thalia, a knight-cathar of the Church of Avacyn, is holding the gate with a handful of militia. In the woods, the villagers who did not come home are changing shape.',
      hero: {who: 'thalia', deck: {label: 'tribute', name: 'The Thraben Militia', colors: 'W', list: `
4 Thalia, Guardian of Thraben
4 Champion of the Parish
4 Doomed Traveler
4 Elite Inquisitor
4 Fiend Hunter
3 Mausoleum Guard
3 Village Bell-Ringer
2 Slayer of the Wicked
4 Rebuke
2 Smite the Monstrous
2 Bonds of Faith
24 Plains`}},
      villain: {who: 'howlpack', deck: {label: 'tribute', name: 'The Kessig Howlpack', colors: 'RG', list: `
4 Daybreak Ranger
4 Mayor of Avabruck
4 Kruin Outlaw
4 Village Ironsmith
4 Gatstaf Shepherd
3 Instigator Gang
3 Grizzled Outcasts
4 Darkthicket Wolf
4 Prey Upon
12 Forest
10 Mountain
2 Rootbound Crag
2 Hamlet Captain`}},
      scene: [q('thalia', 'As long as we can utter a prayer or lift a weapon, we have the power to fight back.'),
        s('thalia', 'Transform: some cards have two faces. Werewolves are human by day, and turn over into wolves at night, when a turn passes with no spells cast. Cast something every turn and keep them human.')],
      villainScene: [q('stage', 'When a werewolf changes for the first time, that first howl is said to echo through the wilds till moonset.'),
        q('stage', 'Hey lads, the moon\'s rising. All the better to watch him beg for mercy.')],
      cues: {hero: cue('Hold the gate.', 'For Avacyn!', 'They\'re changing...', 'Back to the woods.', 'The gate... falls...', 'Cast a spell. Keep them human.'),
        villain: cue('[a howl from the treeline]', '[the moon rises]', '[a wolf goes down]', '[the pack feeds]', '[dawn breaks]')},
      after: [s('thalia', 'Ten years ago a village like this would have had an angel overhead. Now it has me. Come to Thraben. The Lunarch will want to see anyone who can fight.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Blood of Stensia', difficulty: 'Easy', rewardSet: 'isd', teaches: ['Morbid'],
      blurb: 'Mikaeus, the Lunarch, leads the Church of Avacyn from Thraben. He is taking his cathars into Stensia, where the Voldaren vampires have stopped bothering to hide.',
      hero: {who: 'mikaeus', deck: {label: 'tribute', name: 'The Lunarch\'s Cathars', colors: 'W', list: `
2 Mikaeus, the Lunarch
4 Avacynian Priest
4 Cathedral Sanctifier
4 Silverblade Paladin
4 Chapel Geist
3 Slayer of the Wicked
3 Voiceless Spirit
4 Rebuke
4 Midnight Haunting
2 Bonds of Faith
2 Smite the Monstrous
24 Plains`}},
      villain: {who: 'olivia', deck: {label: 'tribute', name: 'The Voldaren Bloodline', colors: 'BR', list: `
2 Olivia Voldaren
4 Bloodcrazed Neonate
4 Vampire Interloper
4 Bloodthrone Vampire
4 Stromkirk Noble
4 Brimstone Volley
4 Tribute to Hunger
3 Falkenrath Noble
3 Crossway Vampire
2 Victim of Night
10 Swamp
10 Mountain
4 Dragonskull Summit
2 Markov Patrician`}},
      scene: [q('mikaeus', 'The darkness crawls with vampires and ghouls, but we are not without allies.'),
        q('mikaeus', 'Never forget our ancestors. They have not forgotten us.'),
        s('mikaeus', 'Morbid: some of their cards grow stronger if a creature died this turn. Every cathar who falls feeds them. Do not trade lightly.')],
      villainScene: [q('olivia', 'I can make you dance to my tune like a puppet, your very blood eager to obey.'),
        q('olivia', 'I have seen a hundred mortal families rise and fall. I shall outlast a thousand more.')],
      cues: {hero: cue('Silver ready.', 'Avacyn\'s light!', 'They feed on the fallen...', 'Stensia burns.', 'Too many dead...', 'Kill them before they feed.'),
        villain: cue('Do come in.', 'Something died. Delicious.', 'How rude.', 'Drain them.', 'Tiresome little priests.')},
      after: [s('mikaeus', 'Olivia will be back. She always is. Go west, to the Nephalia coast. Our dead are not staying in their graves, and I want to know why.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Stitcher\'s Workshop', difficulty: 'Easy', rewardSet: 'dka', teaches: ['Undying'],
      blurb: 'On the Nephalia coast, the stitcher Geralf builds skaabs out of the dead and sends them up the road. The geist of Saint Traft, a dead cathar who never stopped fighting, haunts the same cliffs.',
      hero: {who: 'traft', deck: {label: 'tribute', name: 'The Saint\'s Host', colors: 'WU', list: `
2 Geist of Saint Traft
4 Chapel Geist
4 Voiceless Spirit
4 Stormbound Geist
4 Moon Heron
4 Drogskol Captain
4 Midnight Haunting
3 Feeling of Dread
3 Rebuke
4 Lantern Spirit
10 Plains
10 Island
4 Glacial Fortress`}},
      villain: {who: 'geralf', deck: {label: 'tribute', name: 'Geralf\'s Skaabs', colors: 'UB', list: `
1 Mikaeus, the Unhallowed
2 Geralf's Messenger
4 Diregraf Ghoul
4 Armored Skaab
2 Stitched Drake
3 Makeshift Mauler
4 Unbreathing Horde
3 Forbidden Alchemy
12 Swamp
8 Island
4 Drowned Catacomb
4 Walking Corpse
4 Butcher Ghoul
3 Ghoulraiser
2 Typhoid Rats`}},
      scene: [q('stage', 'The heron is the symbol of the archangel Avacyn. The fact that such spirits still fly gives the church hope that its founder may one day return.'),
        s('traft', 'Undying: when a creature with undying dies with no +1/+1 counter on it, it comes back with one. Kill it twice, or take it away for good.')],
      villainScene: [q('geralf', 'The best skaab are more powerful and more beautiful than the sum of their parts.'),
        q('geralf', 'Three heads, six arms, and some armor grafts are better than . . . the normal numbers of those things.'),
        q('geralf', 'Let those idiot priests tremble! A new era in unlife begins here and now. Oglor, raise the lightning vane!')],
      cues: {hero: cue('The dead should rest.', 'For Thraben!', 'It got back up...', 'Lay them down.', 'Even the saints fall...', 'Kill it twice.'),
        villain: cue('Oglor! The lightning!', 'It lives! Again!', 'My beautiful skaab...', 'Fresh parts!', 'Back to the drawing board.')},
      after: [s('stage', 'One of the skaabs in Geralf\'s yard wears the Lunarch\'s face. Mikaeus is dead, and somebody has raised him.'),
        s('traft', 'The church will hide this as long as it can. Find the planeswalkers. They are the only ones on this world who are not afraid.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Veil\'s Curse', difficulty: 'Normal', rewardSet: 'isd', teaches: ['Discard'],
      blurb: 'Two planeswalkers have come to Innistrad, and one is hunting the other. Liliana Vess cursed Garruk with an old veil. The curse is killing him, and he has followed her all the way here.',
      hero: {who: 'garruk', deck: {label: 'tribute', name: 'Garruk\'s Hunt', colors: 'G', list: `
3 Garruk Relentless
4 Avacyn's Pilgrim
4 Strangleroot Geist
4 Ambush Viper
4 Darkthicket Wolf
4 Lumberknot
4 Wolfir Silverheart
3 Hollowhenge Scavenger
2 Somberwald Spider
4 Prey Upon
24 Forest`}},
      villain: {who: 'liliana', deck: {label: 'tribute', name: 'The Veil', colors: 'B', list: `
1 Liliana of the Veil
3 Tribute to Hunger
2 Vampire Nighthawk
3 Bloodgift Demon
3 Fiend of the Shadows
3 Falkenrath Noble
4 Typhoid Rats
24 Swamp
4 Walking Corpse
4 Butcher Ghoul
3 Vampire Interloper
4 Diregraf Ghoul
2 Markov Patrician`}},
      scene: [q('garruk', 'Your veil\'s curse won\'t stop me, deathmage. I have taken down countless night hunters and this dark plane is not big enough for you to hide.'),
        q('garruk', 'Rid me of this curse, witch, or die with me.'),
        s('garruk', 'Discard: she makes us both throw cards away. Play your cards out instead of holding them, and she has nothing to take.')],
      villainScene: [q('liliana', 'I\'ve seen corpses prettier than you, beastmage.'),
        q('liliana', 'I come looking for demons and I find a plane full of angels. I hate angels.'),
        q('liliana', 'Innistrad\'s ghoulcallers are talented enough, but let me show you what someone with real power can create.')],
      cues: {hero: cue('I smell her.', 'The pack hunts!', 'The curse burns...', 'Run, witch.', 'Not... yet...', 'Empty your hand first.'),
        villain: cue('Still alive, beastmage?', 'Discard that.', 'Ugh, fur.', 'Fetch, puppy.', 'This was a distraction.')},
      after: [s('liliana', 'I didn\'t come here for you, Garruk. There is a demon on this world who owns a piece of me, and he is locked in a silver box. Hunt me later.'),
        s('garruk', 'Later, then. I will find you.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Moon Sage', difficulty: 'Normal', rewardSet: 'avr', teaches: ['Miracle'],
      blurb: 'Tamiyo, a soratami scholar from another plane, came to Innistrad to study its moon. She has noticed that the Skirsdag, a cult of demon-worshippers hiding inside the church itself, keeps a calendar too.',
      hero: {who: 'tamiyo', deck: {label: 'tribute', name: 'The Moon Sage\'s Notes', colors: 'WU', list: `
2 Tamiyo, the Moon Sage
4 Fiend Hunter
4 Restoration Angel
3 Moon Heron
4 Feeling of Dread
3 Dissipate
3 Terminus
2 Temporal Mastery
4 Think Twice
3 Midnight Haunting
11 Plains
9 Island
4 Glacial Fortress
4 Chapel Geist`}},
      villain: {who: 'skirsdag', deck: {label: 'tribute', name: 'The Skirsdag', colors: 'BR', list: `
4 Skirsdag High Priest
2 Demonlord of Ashmouth
3 Bloodgift Demon
4 Blood Artist
4 Bloodthrone Vampire
4 Skirsdag Cultist
4 Brimstone Volley
4 Tribute to Hunger
4 Dead Weight
3 Harvester of Souls
12 Swamp
8 Mountain
4 Dragonskull Summit`}},
      scene: [q('tamiyo', 'I\'m pleased this world has learned the moon affects more than the tides.'),
        s('tamiyo', 'Miracle: if a miracle card is the first card you draw in a turn, you can reveal it and cast it for its miracle cost, which is much cheaper. Watch the top of your deck.')],
      villainScene: [q('skirsdag', 'Thraben\'s pleas fall on deaf ears. Ours do not.'),
        q('stage', 'The demons don\'t care if we mutter niceties and act out ceremonies. Just kill him.')],
      cues: {hero: cue('Let me take notes.', 'A miracle!', 'The pages are burning...', 'Recorded.', 'An incomplete study...', 'Watch the first draw.'),
        villain: cue('For the demon.', 'Blood for Griselbrand!', 'The ritual falters...', 'Another for the altar.', 'The cult endures.')},
      after: [s('tamiyo', 'Their calendar ends on one night: the night they meant to open the Helvault. Somebody else is already planning to do it first.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Insectile Aberration', difficulty: 'Normal', rewardSet: 'isd', teaches: ['Flashback'],
      blurb: 'The Archive remembers the winter of 2011, when a one-mana blue Human that turned into a flier ruled Standard, and the big green ramp deck that tried to grow past it.',
      hero: {who: 'delver', deck: {label: 'tribute', name: 'Delver', note: 'Built from the Innistrad-era Delver lists using cards from this act\'s sets only, so Ponder, Mana Leak and Vapor Snag are not in it.', colors: 'WU', archetype: 'Tempo', list: `
4 Delver of Secrets
4 Snapcaster Mage
3 Geist of Saint Traft
4 Stormbound Geist
4 Midnight Haunting
2 Silent Departure
3 Feeling of Dread
11 Island
7 Plains
4 Glacial Fortress
2 Moorland Haunt
4 Chapel Geist
4 Fiend Hunter
4 Voiceless Spirit`}},
      villain: {who: 'wolfrun', deck: {label: 'tribute', name: 'Wolf Run Ramp', note: 'Built from cards in this act\'s sets only, so Primeval Titan and Inferno Titan are not in it.', colors: 'RG', archetype: 'Ramp', list: `
4 Avacyn's Pilgrim
4 Borderland Ranger
3 Garruk Relentless
2 Huntmaster of the Fells
2 Zealous Conscripts
2 Prey Upon
3 Mayor of Avabruck
11 Forest
6 Mountain
4 Rootbound Crag
3 Kessig Wolf Run
4 Gatstaf Shepherd
4 Kruin Outlaw
4 Village Ironsmith
2 Darkthicket Wolf
2 Villagers of Estwald`}},
      scene: [s('you', 'Flashback: some spells can be cast a second time from the graveyard for their flashback cost. Snapcaster Mage gives any spell flashback for a turn.')],
      villainScene: [q('stage', 'When a werewolf changes for the first time, that first howl is said to echo through the wilds till moonset.')],
      cues: {hero: cue('Flip it.', 'It flipped!', 'Too big to race...', 'Out-tempoed.', 'Ramped over.', 'Counter the big one.'),
        villain: cue('[a land, and another]', '[a 6/6 trample]', '[tapped low]', '[wolf run activated]', '[too slow]')},
      after: [s('stage', 'Recorded: Innistrad Standard, winter 2011.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Graveyard Shift', difficulty: 'Normal', rewardSet: 'dka', teaches: ['Sacrifice'],
      blurb: 'The Archive remembers spring 2012: black-red Zombies that came back from the graveyard faster than anyone could put them in it, against white-blue Spirits that flew over them.',
      hero: {who: 'zombies', deck: {label: 'tribute', name: 'Zombies', colors: 'BR', archetype: 'Aggro', list: `
4 Diregraf Ghoul
4 Gravecrawler
4 Geralf's Messenger
4 Blood Artist
4 Highborn Ghoul
3 Falkenrath Aristocrat
2 Brimstone Volley
4 Tragic Slip
3 Searing Spear
4 Walking Corpse
13 Swamp
7 Mountain
4 Dragonskull Summit`}},
      villain: {who: 'spirits', deck: {label: 'tribute', name: 'Spirits', colors: 'WU', archetype: 'Tempo', list: `
4 Drogskol Captain
4 Chapel Geist
4 Voiceless Spirit
4 Midnight Haunting
4 Restoration Angel
4 Stormbound Geist
4 Feeling of Dread
2 Dissipate
2 Sublime Archangel
4 Lingering Souls
11 Plains
9 Island
4 Glacial Fortress`}},
      scene: [q('stage', 'With Thraben\'s army recalled to its city walls, outlying villages were left to fend for themselves.'),
        s('you', 'Sacrifice: Blood Artist drains them whenever any creature dies. Your zombies are made to die and come back.')],
      villainScene: [q('stage', 'Mist is the geists\' sorrow. Wind is their pain. Fire is their vengeance.')],
      cues: {hero: cue('Rise.', 'Again!', 'They fly over...', 'Overrun.', 'Laid to rest.', 'Trade, then drain.'),
        villain: cue('[geists on the wind]', '[the captain rallies]', '[torn apart]', '[a sky full of spirits]', '[grounded]')},
      after: [s('stage', 'Recorded: Innistrad Standard, spring 2012.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Griselbrand', difficulty: 'Hard', rewardSet: 'avr', rewardCard: 'Griselbrand', teaches: ['Playing against reanimation'],
      blurb: 'The Helvault breaks. Avacyn is free, and so is the demon she was holding. Thalia and Tamiyo stand with the angel in the rubble while Griselbrand\'s cult drags him back to full strength.',
      hero: {who: 'avacyn', deck: {label: 'tribute', name: 'Avacyn, Thalia and Tamiyo', colors: 'WU', list: `
4 Thalia, Guardian of Thraben
2 Tamiyo, the Moon Sage
1 Avacyn, Angel of Hope
2 Fiend Hunter
3 Feeling of Dread
2 Dissipate
3 Midnight Haunting
13 Plains
7 Island
4 Glacial Fortress
4 Doomed Traveler
4 Village Bell-Ringer
4 Mausoleum Guard
4 Elite Inquisitor
3 Chapel Geist`}},
      villain: {who: 'griselbrand', deck: {label: 'tribute', name: 'Griselbrand\'s Cult', colors: 'BR', list: `
3 Griselbrand
4 Unburial Rites
3 Bloodgift Demon
2 Harvester of Souls
4 Tragic Slip
4 Victim of Night
4 Skirsdag High Priest
3 Demonlord of Ashmouth
2 Blasphemous Act
3 Tribute to Hunger
14 Swamp
6 Mountain
4 Dragonskull Summit
4 Desperate Ravings`}},
      scene: [q('stage', 'A golden helix streaked skyward from the Helvault. A thunderous explosion shattered the silver monolith and Avacyn emerged, free from her prison at last.'),
        q('thalia', 'Avacyn emerged from the broken Helvault, but her freedom came at a price—him.'),
        s('tamiyo', 'His cult will put him in the graveyard and pull him back out. Watch the graveyard, and keep an answer for the big one.')],
      villainScene: [q('stage', 'The demon Griselbrand dared to stand against Avacyn, earning him the loathing of thousands and the admiration of a few.'),
        q('stage', '"Oh mighty Griselbrand, Scourge of the Heedless World, gladly I consume myself for thee!"')],
      cues: {hero: cue('Avacyn returns!', 'Light of the archangel!', 'He keeps rising...', 'Back into the dark!', 'The night wins...', 'Kill him when he lands.'),
        villain: {...cue('Free.', 'Blood for my book.', 'Your angel stings.', 'Kneel.', 'Not you. Her.'),
          half: {who: 'liliana', line: 'Keep him busy. I\'m nearly there.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Burning Vengeance', difficulty: 'Hard', rewardSet: 'isd', rewardCard: 'Snapcaster Mage', mood: 'boss',
      teaches: ['The graveyard'],
      archive: {deck: 'Burning Vengeance', when: 'Late 2011', format: 'Standard: Scars of Mirrodin block, Innistrad and Magic 2012.',
        what: 'A blue-red deck that filled its own graveyard with Desperate Ravings, Think Twice and Forbidden Alchemy, then flashed them back with Burning Vengeance on the table so every flashback spell also dealt 2 damage.',
        why: 'Innistrad was built around the graveyard, and both of these decks used it as a second hand. The Spider Spawning player mills itself on purpose, then flashes back Spider Spawning for an army.',
        beat: 'Race it. Burning Vengeance is slow to set up, and every spell it flashes back is one it already cast. Kill Snapcaster Mage on sight.',
        after: 'This tribute uses only this act\'s sets, so the Magic 2012 cards these decks used, like Ponder and Mana Leak, are not in it.'},
      blurb: 'Deep in the archive, two decks that played out of the graveyard instead of their hand.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Spider Spawning', colors: 'UG', archetype: 'Self-mill', list: `
2 Spider Spawning
4 Mulch
4 Armored Skaab
4 Forbidden Alchemy
4 Thought Scour
4 Boneyard Wurm
4 Deranged Assistant
4 Ambush Viper
10 Forest
10 Island
4 Hinterland Harbor
4 Dream Twist
2 Somberwald Spider`}},
      villain: {who: 'vengeance', deck: {label: 'tribute', name: 'Burning Vengeance', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'UR', archetype: 'Control', list: `
4 Burning Vengeance
4 Snapcaster Mage
4 Desperate Ravings
4 Forbidden Alchemy
4 Brimstone Volley
3 Dissipate
3 Devil's Play
4 Searing Spear
9 Island
9 Mountain
4 Sulfur Falls
2 Desolate Lighthouse
4 Geistflame
2 Rolling Temblor`}},
      scene: [q('stage', 'Stensian vampires encourage spiders near their manors so they can rob the webs.'),
        s('you', 'Fill your own graveyard. The spiders are already in it.')],
      villainScene: [q('stage', 'Mist is the geists\' sorrow. Wind is their pain. Fire is their vengeance.')],
      cues: {hero: cue('Mill yourself.', 'Spiders!', 'Burning...', 'Webbed.', 'Out of cards.', 'Count your creature cards.'),
        villain: cue('[a spell from the graveyard]', '[vengeance burns]', '[out of flashback]', '[twice the fire]', '[outraced]')},
      after: [s('stage', 'Recorded: Innistrad Standard, late 2011.')]},
  ],
};
