// Act 37: The Heist, the Mice and the House (Outlaws of Thunder Junction, The Big Score, Bloomburrow, Duskmourn, Foundations).
// Story and dialogue: /mnt/project-files/story/act-37-script.md (generated from this file). Land set: blb.
// An outlaw heist, a world of animal folk, and a house that eats planeswalkers. Every quoted line is real flavor text from
// these sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'heist-mice-house',
  era: '2024-04-19',
  intro: [q('stage', 'Akul didn\'t know what lay inside Tarnation\'s great vault, but the mystery fueled his obsession.'),
    s('stage', 'Three very different places, one after another: a western with a vault, a valley of animal folk, and a house that is alive.')],
  finale: [q('stage', 'As the vault collapsed around them, Kellan made sure Akul couldn\'t follow them out.'),
    s('stage', 'Valgavoth is destroyed. The survivors walk out of the House into daylight, and the story goes on without him.'),
    s('stage', 'Recorded: a heist, a valley and a house, and the survivors of all three.')],
  villainFinale: [q('stage', 'Within the silken shroud, all doubts are cleansed, and all desires are united with Valgavoth.'),
    s('stage', 'In this version, the house eats everyone, and you were afraid.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Friendly Teddy'},
    oko: {name: 'Oko\'s Crew', title: 'Of Thunder Junction', card: 'Oko, the Ringleader', focus: '50% 25%'},
    hellspur: {name: 'The Hellspur Gang', title: 'Of Thunder Junction', card: 'Laughing Jasper Flint', focus: '50% 25%'},
    kellan: {name: 'Kellan', title: 'The Kid', card: 'Kellan, the Kid', focus: '50% 25%'},
    akul: {name: 'Akul\'s Gang', title: 'Of Thunder Junction', card: 'Hired Claw', focus: '50% 30%'},
    mabel: {name: 'Mabel\'s Mice', title: 'Of Bloomburrow', card: 'Mabel, Heir to Cragflame', focus: '50% 25%'},
    beasts: {name: 'The Calamity Beasts', title: 'Of Bloomburrow', card: 'Dragonhawk, Fate\'s Tempest', focus: '50% 25%'},
    tyvar: {name: 'Tyvar', title: 'The Pummeler', card: 'Tyvar, the Pummeler', focus: '50% 25%'},
    house: {name: 'Valgavoth\'s House', title: 'Of Duskmourn', card: 'Balemurk Leech', focus: '50% 30%'},
    winter: {name: 'Winter', title: 'The Misanthropic Guide', card: 'Winter, Misanthropic Guide', focus: '50% 25%'},
    ghosts: {name: 'The Haunted Rooms', title: 'Of Duskmourn', card: 'Sheltered by Ghosts', focus: '50% 30%'},
    boros: {name: 'Boros Mice', title: 'Autumn 2024', card: 'Heartfire Hero', focus: '50% 30%'},
    golgari: {name: 'Golgari Midrange', title: 'Autumn 2024', card: 'Camellia, the Seedmiser', focus: '50% 25%'},
    dimir: {name: 'Dimir Midrange', title: 'Autumn 2024', card: 'Kaito, Bane of Nightmares', focus: '50% 25%'},
    izzet: {name: 'Izzet Prowess', title: 'Autumn 2024', card: 'Tempest Angler', focus: '50% 30%'},
    survivors: {name: 'The Survivors', title: 'Of the House', card: 'Niko, Light of Hope', focus: '50% 25%'},
    valgavoth: {name: 'Valgavoth', title: 'Terror Eater', card: 'Valgavoth, Terror Eater', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Plot the Job', difficulty: 'Easy', rewardSet: 'otj', teaches: ['Plot'],
      blurb: 'Oko\'s crew plans a heist on the Tarnation vault. The Hellspur gang wants it too.',
      hero: {who: 'oko', deck: {label: 'tribute', name: 'Oko\'s Heist Crew', colors: 'GU', list: `
4 Pond Prophet
4 Oblivious Bookworm
3 Oko, the Ringleader
3 Zimone, All-Questioning
4 Druid of the Spade
4 Hazardroot Herbalist
3 Kitsa, Otterball Elite
3 Thieving Otter
4 Rabid Bite
4 Cache Grab
4 Botanical Sanctum
10 Forest
10 Island`}},
      villain: {who: 'hellspur', deck: {label: 'tribute', name: 'The Hellspur Gang', colors: 'BR', list: `
4 Agate-Blade Assassin
4 Ravine Raider
3 Laughing Jasper Flint
4 Cindering Cutthroat
4 Heartfire Immolator
3 Strongbox Raider
4 Burst Lightning
3 Fell
3 Hero's Downfall
4 Fanatical Firebrand
4 Rakdos Guildgate
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'Sure it\'s risky, but that\'s what makes it fun! That and the money. And the bankers\' faces.'),
        q('stage', 'Kind of them to put all their valuables in the same place.'),
        s('oko', 'Plot: a card that is plotted is exiled with the plan and cast later for free. Do the thinking now and pay for it on a later turn.')],
      villainScene: [q('stage', 'Every moving carriage is an accident waiting to happen, and the Hellspurs hate waiting.'),
        q('stage', 'Crackling with rage and stolen thunder, he drives the Hellspurs to ever-greater heights of violence.')],
      cues: {hero: cue('Plan the job.', 'Plot!', 'They knew we were coming...', 'The vault is open.', 'Caught...', 'Plot a spell now, cast it free later.'),
        villain: cue('Ride!', 'Fire!', 'The gang scatters...', 'The vault is ours.', 'Shot down...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Small Heroes', difficulty: 'Easy', rewardSet: 'blb', teaches: ['Offspring'],
      blurb: 'The vault is empty and so are Kellan\'s hopes. Akul wants a word. Kellan has a lot of tiny friends.',
      hero: {who: 'kellan', deck: {label: 'tribute', name: 'Kellan\'s Warren', colors: 'GW', list: `
4 Seasoned Warrenguard
4 Flowerfoot Swordmaster
4 Brightblade Stoat
4 Intrepid Rabbit
3 Warren Warleader
3 Burrowguard Mentor
3 Finneas, Ace Archer
3 Valley Questcaller
4 Mabel's Mettle
4 Hop to It
4 Selesnya Guildgate
10 Forest
10 Plains`}},
      villain: {who: 'akul', deck: {label: 'tribute', name: 'Akul\'s Gang', colors: 'BR', list: `
4 Hired Claw
4 Ravine Raider
4 Brazen Collector
3 Laughing Jasper Flint
4 Byway Barterer
4 Agate-Blade Assassin
4 Take Out the Trash
3 Fell
3 Hero's Downfall
3 Burst Lightning
4 Rakdos Guildgate
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'I found out who I was. Now it\'s time to discover who I am.'),
        q('stage', 'Never underestimate what a rabbit can do with a root vegetable and some moxie.'),
        s('kellan', 'Offspring: pay extra and get a small 1/1 copy of the creature along with it. Two bodies for one card.')],
      villainScene: [q('stage', 'Akul saw his Hellspur followers as little more than ammunition to be expended.'),
        q('stage', 'The last fool who called him "cowboy" earned a free ride to the bottom of Blacksnag Bog.')],
      cues: {hero: cue('Come on, everyone.', 'Offspring!', 'Akul is too big...', 'Small and mighty.', 'Squashed...', 'Pay the offspring cost for a second body.'),
        villain: cue('Hellspurs!', 'Charge!', 'You little...', 'Nobody survives.', 'Beaten by mice...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Every Door', difficulty: 'Easy', rewardSet: 'dsk', teaches: ['Rooms'],
      blurb: 'Mabel and her mice take a house with doors that lead to doors. The Calamity Beasts have a vote in this too.',
      hero: {who: 'mabel', deck: {label: 'tribute', name: 'Mabel\'s Mice', colors: 'RW', list: `
4 Heartfire Hero
4 Emberheart Challenger
4 Manifold Mouse
4 Valley Questcaller
3 Mabel, Heir to Cragflame
3 Seedglaive Mentor
3 Veteran Guardmouse
4 Steampath Charger
2 Dazzling Theater // Prop Room
2 Painter's Studio // Defaced Gallery
2 Might of the Meek
1 Boros Charm
4 Inspiring Vantage
10 Mountain
10 Plains`}},
      villain: {who: 'beasts', deck: {label: 'tribute', name: 'The Calamity Beasts', colors: 'BR', list: `
4 Daggerfang Duo
4 Persistent Marshstalker
4 Hearthborn Battler
3 Dragonhawk, Fate's Tempest
3 Maha, Its Feathers Night
2 Quaketusk Boar
2 Glidedive Duo
2 Fell
2 Agate Assault
2 Savor
2 Valley Flamecaller
4 Rakdos Guildgate
10 Swamp
10 Mountain
4 Ravine Raider
2 Hired Claw`}},
      scene: [q('stage', 'We sought adventure and found calamity. Forward, so we may meet both with courage!'),
        q('stage', '"You stole a child from its nest," Mabel accused. "The only calamity I see here is you."'),
        s('mabel', 'Rooms: a Room has two doors. Cast one half, then pay to unlock the other later. Two rooms, one card.')],
      villainScene: [q('stage', 'Its wingspan reaches from dusk to dawn.'),
        q('stage', 'When Glarb ordered the egg stolen, the Great Maha communicated its anger in a universal language.')],
      cues: {hero: cue('Open the door.', 'Unlock!', 'The beasts are huge...', 'A cosy win.', 'Lost in the rooms...', 'Cast one half now, unlock the other later.'),
        villain: cue('Roar.', 'Calamity!', 'The beast falters...', 'All is calamity.', 'Slain...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The House Is Hungry', difficulty: 'Normal', rewardSet: 'dsk', teaches: ['Vigilance'],
      blurb: 'Tyvar has come to the House of Duskmourn. The House has come for Tyvar.',
      hero: {who: 'tyvar', deck: {label: 'tribute', name: 'Tyvar\'s Fists', colors: 'G', list: `
4 Patchwork Beastie
4 Twitching Doll
4 Wary Watchdog
3 Tyvar, the Pummeler
4 Spineseeker Centipede
3 Hedge Shredder
3 Kona, Rescue Beastie
3 Overgrown Zealot
4 Giant Growth
4 Rabid Bite
24 Forest`}},
      villain: {who: 'house', deck: {label: 'tribute', name: 'Valgavoth\'s House', colors: 'UB', list: `
4 Balemurk Leech
4 Cynical Loner
4 Paranormal Analyst
4 Silent Hallcreeper
4 Floodpits Drowner
3 Unholy Annex // Ritual Chamber
1 Murder
2 Get Out
1 Come Back Wrong
3 Cracked Skull
4 Dimir Guildgate
10 Island
10 Swamp
4 Scrabbling Skullcrab
2 Enter the Enigma`}},
      scene: [q('stage', 'They just keep coming and coming—perfect for my morning workout!'),
        q('stage', 'Be on your guard. Valgavoth has eyes everywhere. And I don\'t mean that figuratively.'),
        s('tyvar', 'Hit hard and fast. The house gets stronger the longer you let it feed.')],
      villainScene: [q('stage', 'Valgavoth wants our pain, our terror! We cannot join him unless we suffer!'),
        q('stage', 'Hope and reliable lighting are in short supply in the House. Glimmers provide both.')],
      cues: {hero: cue('Come at me!', 'Pummel!', 'The house is big...', 'The house shakes.', 'Eaten...', 'Win before the house stabilises.'),
        villain: cue('Feed.', 'Fear!', 'The house shudders...', 'Fed.', 'Starved...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Survival', difficulty: 'Normal', rewardSet: 'dsk', teaches: ['Survival'],
      blurb: 'Winter leads survivors through the ghost rooms. Staying alive is the only plan.',
      hero: {who: 'winter', deck: {label: 'tribute', name: 'Winter\'s Survivors', colors: 'BG', list: `
4 Patchwork Beastie
4 Cynical Loner
4 Innocuous Rat
4 Wary Watchdog
4 Overlord of the Hauntwoods
3 Hedge Shredder
3 Say Its Name
4 Murder
4 Manifest Dread
2 Give In to Violence
4 Blooming Marsh
10 Swamp
10 Forest`}},
      villain: {who: 'ghosts', deck: {label: 'tribute', name: 'The Haunted Rooms', colors: 'WU', list: `
4 Sheltered by Ghosts
4 Reluctant Role Model
4 Optimistic Scavenger
4 Acrobatic Cheerleader
4 Silent Hallcreeper
4 Stalked Researcher
1 Fear of Surveillance
1 Get Out
1 Unwanted Remake
3 Splitskin Doll
4 Azorius Guildgate
10 Plains
10 Island
3 Jump Scare
3 Veteran Survivor`}},
      scene: [q('stage', 'That\'s the one good thing about these cultists: sometimes they do your work for you.'),
        q('stage', 'Thanks, but no thanks. I\'m done with hope.'),
        s('winter', 'Survival: if your creature is tapped after attacking, it triggers at your second main phase. Attack, then enjoy the extra effect.')],
      villainScene: [q('stage', 'Valgavoth commands us to feed the trees. Let our blood be their mulch, our flesh their soil.'),
        q('stage', 'On the second day after he\'d been separated from his friends, Tino worried they\'d be panicking at his absence. By the fourth, he was certain they\'d never cared for him at all.')],
      cues: {hero: cue('Stay alive.', 'Survive!', 'The ghosts are everywhere...', 'We survived.', 'The house wins...', 'Attack to tap, then collect the survival trigger.'),
        villain: cue('Boo.', 'Haunt!', 'The ghosts fade...', 'Welcome home.', 'Exorcised...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Boros Mice vs Golgari', difficulty: 'Normal', rewardSet: 'blb', teaches: ['Tempo'],
      blurb: 'Autumn 2024: tiny Boros aggro against a Golgari midrange deck full of removal.',
      hero: {who: 'boros', deck: {label: 'tribute', name: 'Boros Mice', colors: 'RW', archetype: 'Aggro', list: `
4 Heartfire Hero
4 Emberheart Challenger
4 Manifold Mouse
4 Valley Questcaller
3 Mabel, Heir to Cragflame
3 Seedglaive Mentor
3 Veteran Guardmouse
4 Steampath Charger
2 Dazzling Theater // Prop Room
2 Painter's Studio // Defaced Gallery
2 Might of the Meek
1 Boros Charm
4 Inspiring Vantage
10 Mountain
10 Plains`}},
      villain: {who: 'golgari', deck: {label: 'tribute', name: 'Golgari Midrange', colors: 'BG', archetype: 'Midrange', list: `
4 Valley Rotcaller
4 Daggerfang Duo
4 Bushy Bodyguard
3 Camellia, the Seedmiser
3 Corpseberry Cultivator
3 Maelstrom Pulse
3 Murder
3 Hero's Downfall
4 Treeguard Duo
3 Hazardroot Herbalist
2 Fell
4 Blooming Marsh
10 Swamp
10 Forest`}},
      scene: [q('stage', 'Fear is unavoidable. You can run from it with your tail between your legs, or charge it head on with sword in hand. I prefer the latter.'),
        q('stage', 'No battle is fought, or won, alone.'),
        s('boros', 'Be fast. Their removal is better than yours, so end the game before they stabilise.')],
      villainScene: [q('stage', '"Should we act now or later?" the rat asked. "Both," whispered the squirrel.'),
        q('stage', 'Disgusting. Revolting. Effective.')],
      cues: {hero: cue('Quick and small.', 'Swarm!', 'Their removal is good...', 'Mice win.', 'Swept...', 'Win before they stabilise.'),
        villain: cue('Patience.', 'Remove!', 'The mice are fast...', 'Golgari wins.', 'Overrun...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Dimir vs Izzet Prowess', difficulty: 'Normal', rewardSet: 'dsk', teaches: ['Counterspells'],
      blurb: 'Autumn 2024: Dimir midrange against a fast Izzet prowess deck.',
      hero: {who: 'dimir', deck: {label: 'tribute', name: 'Dimir Midrange', colors: 'UB', archetype: 'Midrange', list: `
3 Kaito, Bane of Nightmares
4 Skullsnap Nuisance
4 Dreadwing Scavenger
3 Satoru, the Infiltrator
4 Murder
4 Essence Scatter
4 Hero's Downfall
4 Thought-Stalker Warlock
4 Get Out
2 Fell
4 Dimir Guildgate
10 Island
10 Swamp`}},
      villain: {who: 'izzet', deck: {label: 'tribute', name: 'Izzet Prowess', colors: 'UR', archetype: 'Aggro', list: `
4 Stormchaser's Talent
4 Coruscation Mage
4 Emberheart Challenger
2 Tempest Angler
2 Stormcatch Mentor
2 Burst Lightning
4 Abrade
4 Mockingbird
4 Shoreline Looter
4 Spirebluff Canal
10 Island
10 Mountain
4 Thought Shucker
2 Plumecreed Escort`}},
      scene: [q('stage', 'Kaito\'s blade brought the light of another plane into Duskmourn, and with it, a brief chance to escape.'),
        q('stage', 'It scours battlefields for corpses, consuming flesh and souls alike.'),
        s('dimir', 'Kill their early creatures and counter the tricks. You win the long game.')],
      villainScene: [q('stage', 'Hot-footed and cold-blooded.'),
        q('stage', 'Oh? Do I need to repeat myself?')],
      cues: {hero: cue('Cool head.', 'Denied!', 'Too many tricks...', 'Control wins.', 'Burnt out...', 'Kill the early creatures first.'),
        villain: cue('Fast!', 'Prowess!', 'Out of tricks...', 'Faster than you.', 'Fizzled...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Valgavoth, Terror Eater', difficulty: 'Hard', rewardSet: 'dsk', teaches: ['Ward'],
      blurb: 'The house is alive and it is hungry. The heist crew and the survivors have to leave it with fewer rooms than it started with.',
      hero: {who: 'survivors', deck: {label: 'tribute', name: 'The Crew and the Survivors', colors: 'GU', list: `
4 Pond Prophet
4 Oblivious Bookworm
3 Oko, the Ringleader
3 Zimone, All-Questioning
4 Druid of the Spade
4 Hazardroot Herbalist
3 Kitsa, Otterball Elite
3 Thieving Otter
4 Rabid Bite
4 Manifest Dread
4 Botanical Sanctum
10 Forest
10 Island`}},
      villain: {who: 'valgavoth', deck: {label: 'tribute', name: 'Valgavoth\'s Midrange', colors: 'BG', list: `
2 Valgavoth, Terror Eater
4 Cynical Loner
4 Innocuous Rat
4 Balemurk Leech
3 Murder
3 Hero's Downfall
4 Wary Watchdog
3 Spineseeker Centipede
4 Manifest Dread
1 Rootwise Survivor
4 Blooming Marsh
10 Swamp
10 Forest
1 Hungry Ghoul
2 Infestation Sage
1 Overlord of the Balemurk`}},
      scene: [q('stage', 'Clad in the light of conviction and hope, Linette strode forth to face Duskmourn\'s terrors without fear.'),
        q('stage', 'The vault\'s ultimate prize wasn\'t exactly what Kellan had imagined.'),
        s('survivors', 'He feeds on fear, so stay calm. Kill the small creatures early and hit him when he finally lands.')],
      villainScene: [q('stage', 'All who enter the House hear Valgavoth\'s whispers, worming through their consciousness until they can no longer resist his influence.'),
        q('stage', 'Valgavoth whispered into Marina\'s ear until he was all she could hear.')],
      cues: {hero: cue('Stay calm.', 'Together!', 'The house is loud...', 'We are out.', 'The house wins...', 'Stay calm and kill the small creatures early.'),
        villain: {...cue('Fear.', '[the walls breathe]', '[the walls stop]', 'Delicious.', '[the house goes quiet]'),
          half: {who: 'winter', line: 'Keep moving. The door is this way.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Mono-Red Mice', difficulty: 'Hard', rewardSet: 'blb', rewardCard: 'Heartfire Hero', mood: 'boss',
      teaches: ['Haste'],
      archive: {deck: 'Mono-Red Mice', when: 'Autumn 2024', format: 'Standard.',
        what: 'A mono-red deck of one- and two-mana mice and burn, built around Heartfire Hero.',
        why: 'It was the fastest deck in the format and punished any slow draw.',
        beat: 'Block early and kill the first two mice. Heartfire Hero gets out of hand if you let it.',
        after: 'Later sets gave the format more removal and slowed it down.'},
      blurb: 'Deep in the archive, a deck of tiny mice that wins on turn four.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Winter\'s Survivors', colors: 'BG', list: `
4 Patchwork Beastie
4 Cynical Loner
4 Innocuous Rat
4 Wary Watchdog
4 Overlord of the Hauntwoods
3 Hedge Shredder
3 Say Its Name
4 Murder
4 Manifest Dread
2 Give In to Violence
4 Blooming Marsh
10 Swamp
10 Forest`}},
      villain: {who: 'boros', deck: {label: 'tribute', name: 'Mono-Red Mice', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'R', archetype: 'Aggro', list: `
4 Heartfire Hero
4 Emberheart Challenger
4 Manifold Mouse
4 Steampath Charger
4 Whiskerquill Scribe
4 Hired Claw
4 Burst Lightning
4 Might of the Meek
4 Playful Shove
24 Mountain`}},
      scene: [q('stage', 'The boisterous pat on the back was painful, but not nearly as painful as the joke that inspired it.'),
        s('you', 'Block early and kill the first two mice.')],
      villainScene: [q('stage', 'Hot-footed and cold-blooded.')],
      cues: {hero: cue('Hold the line.', 'Strike back!', 'They are fast...', 'The mice fall.', 'Overrun...', 'Kill the first two mice.'),
        villain: cue('[a squeak]', '[the swarm]', '[a pause]', '[mice win]', '[the swarm scatters]')},
      after: [s('stage', 'Recorded: later sets gave the format more removal and slowed it down.')]},
  ],
};
