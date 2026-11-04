// Act 32: The Endless Night (Adventures in the Forgotten Realms, Innistrad: Midnight Hunt, Innistrad: Crimson Vow). Story and
// dialogue: /mnt/project-files/story/act-32-script.md (generated from this file). Land set: mid.
// A dungeon crawl in the Forgotten Realms, then the longest night Innistrad has had, ending at a vampire wedding. Every quoted
// line is real flavor text from these sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'endless-night-harvest',
  era: '2021-07-23',
  intro: [s('stage', 'First a dungeon, with goblins, dragons and a lot of loot. Then Innistrad, where the night stops ending.'),
    q('stage', 'Knew I\'d find ye in trouble if I came out an\' looked for ye!'),
    s('stage', 'The Forgotten Realms are a tabletop world. Innistrad is a gothic one. Both want you in their stories.')],
  finale: [q('stage', 'Our kind has taken my gift for granted. It is time to correct that folly.'),
    s('stage', 'The wedding does not finish, and the night ends. Olivia\'s plan falls apart at the altar.'),
    s('stage', 'Recorded: the sun rises on Innistrad. Far away, something is still counting.')],
  villainFinale: [q('stage', 'Her grand wedding had one goal: to unite the vampire bloodlines under her rule.'),
    s('stage', 'In this version, the wedding goes ahead, and the night does not end.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Dawnbringer Cleric'},
    party: {name: 'The Adventuring Party', title: 'Forgotten Realms', card: 'Bruenor Battlehammer', focus: '50% 25%'},
    cult: {name: 'The Cult of the Dragon', title: 'Forgotten Realms', card: 'Hobgoblin Bandit Lord', focus: '50% 30%'},
    cathars: {name: 'The Cathars', title: 'Of Thraben', card: 'Lunarch Veteran', focus: '50% 30%'},
    wolves: {name: 'The Werewolves', title: 'Of the Ulvenwald', card: 'Tovolar\'s Huntmaster', focus: '50% 30%'},
    teferi: {name: 'Teferi', title: 'Who Slows the Sunset', card: 'Teferi, Who Slows the Sunset', focus: '50% 25%'},
    wedding: {name: 'The Wedding Guests', title: 'Voldaren', card: 'Voldaren Epicure', focus: '50% 30%'},
    arlinn: {name: 'Arlinn', title: 'The Pack\'s Hope', card: 'Arlinn, the Pack\'s Hope', focus: '50% 25%'},
    dragons: {name: 'Tiamat\'s Brood', title: 'Dragons of the Realms', card: 'Red Dragon', focus: '50% 30%'},
    sorin: {name: 'Sorin', title: 'The Mirthless', card: 'Sorin the Mirthless', focus: '50% 25%'},
    olivia: {name: 'Olivia', title: 'Crimson Bride', card: 'Olivia, Crimson Bride', focus: '50% 25%'},
    izzet: {name: 'Izzet Dragons', title: 'Autumn 2021', card: 'Red Dragon', focus: '50% 30%'},
    greenwolves: {name: 'Mono-Green Day/Night', title: 'Autumn 2021', card: 'Werewolf Pack Leader', focus: '50% 30%'},
    grixis: {name: 'Rakdos Vampires', title: 'Autumn 2021', card: 'Bloodtithe Harvester', focus: '50% 30%'},
    clerics: {name: 'Orzhov Clerics', title: 'Autumn 2021', card: 'Dawnbringer Cleric', focus: '50% 30%'},
    heroes: {name: 'The Wedding Crashers', title: 'Teferi, Kaya, Chandra', card: 'Kaya, Geist Hunter', focus: '50% 25%'},
    whiteagg: {name: 'Mono-White Humans', title: 'Autumn 2021', card: 'Adeline, Resplendent Cathar', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Dungeon', difficulty: 'Easy', rewardSet: 'afr', teaches: ['Dungeons'],
      blurb: 'Bruenor and the party delve into a dungeon. The Cult of the Dragon is already down there.',
      hero: {who: 'party', deck: {label: 'tribute', name: 'The Adventuring Party', colors: 'RW', list: `
4 Dwarfhold Champion
4 Steadfast Paladin
4 Armory Veteran
3 Hobgoblin Captain
3 Gloom Stalker
3 Veteran Dungeoneer
2 Bruenor Battlehammer
2 Nadaar, Selfless Paladin
2 Adult Gold Dragon
3 Divine Smite
3 Burning Hands
3 Dragon's Fire
4 Sundown Pass
10 Plains
10 Mountain`}},
      villain: {who: 'cult', deck: {label: 'tribute', name: 'The Cult of the Dragon', colors: 'BR', list: `
4 Dungeon Crawler
4 Hoard Robber
4 Battle Cry Goblin
3 Burning Hands
2 Dragon's Fire
4 Haunted Ridge
10 Swamp
10 Mountain
4 Vampire Spawn
4 Shambling Ghast
4 Concealing Curtains
4 Doomed Dissenter
3 Undead Butler`}},
      scene: [q('stage', 'This one is for goblins, this one is for owlbears, this one is for toast, this one is for . . .'),
        q('stage', 'Courage is neither a shield nor an axe, but the will to wield both in defense of the innocent.'),
        s('party', 'Dungeons: venture into the dungeon, and each room you reach does something. A deeper dungeon pays off the most.')],
      villainScene: [q('stage', 'Red dragons consider the world and every creature in it as theirs to command.'),
        q('stage', 'In a hobgoblin\'s view of the world, the weak owe tribute and fealty to the strong.')],
      cues: {hero: cue('Into the dark.', 'Roll for it!', 'Too many goblins...', 'The loot is ours.', 'Eaten...', 'Venture when you can; deeper rooms pay more.'),
        villain: cue('Tribute!', 'Dragonfire!', 'The hoard slips...', 'The Cult takes the hoard.', 'Slain...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Wolves of the Ulvenwald', difficulty: 'Easy', rewardSet: 'mid', teaches: ['Day and night'],
      blurb: 'Innistrad\'s night grows longer, and the werewolves roam. The cathars stand watch.',
      hero: {who: 'cathars', deck: {label: 'tribute', name: 'The Cathars of Thraben', colors: 'W', list: `
4 Lunarch Veteran
4 Brutal Cathar
4 Cathar Commando
3 Gavony Dawnguard
3 Adeline, Resplendent Cathar
3 Clarion Cathars
3 Sigardian Savior
3 Dawnbringer Cleric
3 Fateful Absence
2 Sungold Barrage
2 Thraben Exorcism
2 Ritual of Hope
24 Plains`}},
      villain: {who: 'wolves', deck: {label: 'tribute', name: 'The Wolves of the Ulvenwald', colors: 'G', list: `
4 Snarling Wolf
4 Bounding Wolf
4 Pestilent Wolf
3 Werewolf Pack Leader
3 Dire Wolf Prowler
3 Hound Tamer
2 Tovolar's Huntmaster
3 Oakshade Stalker
2 Ulvenwald Oddity
3 Clear Shot
2 Might of the Old Ways
24 Forest
3 Intrepid Outlander`}},
      scene: [q('stage', 'Even in our darkest times, Avacyn\'s light still guides us.'),
        q('stage', 'Begone, moon-cursed! These folk are no prey of yours.'),
        s('cathars', 'Day and night: it becomes night if a player casts no spells on their own turn, and day returns if a player casts two or more. Werewolves change with it.')],
      villainScene: [q('stage', 'Do you smell that, friends? Fear and despair.'),
        q('stage', 'Oh, thank the angels. It\'s not a werewolf, just a regular wo—')],
      cues: {hero: cue('Hold the line.', 'Silver!', 'The night is long...', 'Dawn.', 'Moon-cursed...', 'Cast two spells in a turn to bring the day back.'),
        villain: cue('Fear and despair.', 'Howl!', 'The moon is low...', 'The pack feasts.', 'Silver...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Crashing the Rehearsal', difficulty: 'Easy', rewardSet: 'vow', teaches: ['Disturb'],
      blurb: 'Teferi slows the sunset to buy the town time. The wedding party has opinions about that.',
      hero: {who: 'teferi', deck: {label: 'tribute', name: 'Teferi\'s Geists', colors: 'WU', list: `
4 Devoted Grafkeeper
4 Brine Comber
4 Twinblade Geist
3 Kindly Ancestor
3 Dawnhart Geist
3 Heron of Hope
3 Wanderlight Spirit
2 Dennick, Pious Apprentice
2 Teferi, Who Slows the Sunset
3 Faithful Mending
2 Lantern Flare
3 Valorous Stance
4 Deserted Beach
10 Plains
10 Island`}},
      villain: {who: 'wedding', deck: {label: 'tribute', name: 'The Wedding Guests', colors: 'BR', list: `
4 Vampire Interloper
4 Vampire Socialite
4 Voldaren Epicure
3 Bloodcrazed Socialite
3 Dominating Vampire
3 Falkenrath Forebear
3 Voldaren Bloodcaster
2 Bloodvial Purveyor
2 Olivia's Attendants
3 Flame-Blessed Bolt
3 Infernal Grasp
2 Hungry for More
4 Haunted Ridge
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'Here you go. Can\'t have you sleeping through your own wedding day.'),
        q('stage', 'The towers and catwalks of the Voldaren fortress are lit by the lanterns of geists endlessly seeking a way out.'),
        s('teferi', 'Disturb: a spirit card can be cast again from your graveyard as its back face. Dying is only the first half of the plan.')],
      villainScene: [q('stage', 'If you\'re not refining your tastes, what\'s the point of living forever?'),
        q('stage', 'Gotcha.')],
      cues: {hero: cue('The sun can wait.', 'Disturbed!', 'The guests are many...', 'Dawn delayed.', 'The guests win...', 'Cast disturb cards from your graveyard.'),
        villain: cue('Mind the guest list.', 'Welcome!', 'The toast fell flat...', 'The wedding goes on.', 'Crashed...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Brood of Tiamat', difficulty: 'Normal', rewardSet: 'afr', teaches: ['Reach'],
      blurb: 'Arlinn leads the pack against a dungeon full of dragons.',
      hero: {who: 'arlinn', deck: {label: 'tribute', name: 'The Pack\'s Hope', colors: 'RG', list: `
2 Tovolar, Dire Overlord
4 Child of the Pack
4 Kessig Naturalist
2 Halana and Alena, Partners
3 Werewolf Pack Leader
3 Tovolar's Huntmaster
3 Dire Wolf Prowler
3 Bounding Wolf
3 Runebound Wolf
3 Kessig Flamebreather
3 Arlinn, the Pack's Hope
3 Wolf Strike
4 Rockfall Vale
10 Forest
10 Mountain`}},
      villain: {who: 'dragons', deck: {label: 'tribute', name: 'Tiamat\'s Brood', note: 'Tiamat herself is five colours, which our lands cannot support; her cult\'s dragons stand in.', colors: 'BR', list: `
4 Dungeon Crawler
4 Hoard Robber
4 Hired Hexblade
3 Battle Cry Goblin
3 Hobgoblin Bandit Lord
3 Gelatinous Cube
3 Red Dragon
3 Black Dragon
2 Zalto, Fire Giant Duke
2 Inferno of the Star Mounts
2 Plundering Barbarian
3 Power Word Kill
4 Haunted Ridge
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'The ancient dragon Imvaernarhro has earned his fiery nickname.'),
        q('stage', 'Black dragons revel in the collapse of humanoid kingdoms.'),
        s('arlinn', 'Dragons are bigger than you. Race, or take down their fliers.')],
      villainScene: [q('stage', 'Fire giants love to fight on a large scale, and Duke Zalto is one of the greatest warmongers of his age.'),
        q('stage', 'A simple fire spell that grows in intensity along with its caster.')],
      cues: {hero: cue('Hunt them down.', 'Pack attack!', 'The dragons are huge...', 'The pack wins.', 'Burned...', 'Race, or remove the dragons.'),
        villain: cue('Burn.', 'Dragonfire!', 'The hoard is thin...', 'Ashes.', 'Slain...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Sorin and the Bride', difficulty: 'Normal', rewardSet: 'vow', teaches: ['Planeswalkers'],
      blurb: 'Sorin goes to confront Olivia before the wedding. He is not the only one with a plan.',
      hero: {who: 'sorin', deck: {label: 'tribute', name: 'Sorin\'s Cathars', colors: 'WB', list: `
4 Lunarch Veteran
3 Gavony Dawnguard
3 Faithbound Judge
3 Mourning Patrol
3 Bereaved Survivor
3 Voice of the Blessed
2 Sigardian Savior
2 Edgar, Charmed Groom
2 Kaya, Geist Hunter
3 Sorin the Mirthless
3 Markov Purifier
2 Fleshtaker
3 Fateful Absence
4 Shattered Sanctum
10 Plains
10 Swamp`}},
      villain: {who: 'olivia', deck: {label: 'tribute', name: 'Olivia\'s Court', colors: 'BR', list: `
4 Vampire Interloper
4 Vampire Socialite
2 Voldaren Epicure
3 Bloodcrazed Socialite
3 Dominating Vampire
3 Voldaren Bloodcaster
2 Bloodvial Purveyor
2 Olivia's Attendants
3 Flame-Blessed Bolt
3 Infernal Grasp
2 Hungry for More
4 Haunted Ridge
10 Swamp
10 Mountain
2 Olivia, Crimson Bride
3 Doomed Dissenter`}},
      scene: [q('stage', 'Sensing a plot, Sorin raced to his grandfather\'s resting-crypt. But someone else had gotten there first.'),
        q('stage', 'Our kind has taken my gift for granted. It is time to correct that folly.'),
        s('sorin', 'Planeswalkers: protect them with blockers, and attack Olivia\'s court before they bury you in blood.')],
      villainScene: [q('stage', 'Olivia was quick to make an example of any village that refused to pay her blood tithe.'),
        q('stage', 'You can join me or feed me. Choose fast.')],
      cues: {hero: cue('The grandson arrives.', 'Sorin\'s oath!', 'The court is too many...', 'The crypt holds.', 'Buried...', 'Guard Sorin and attack her board.'),
        villain: cue('You are invited.', 'Blood!', 'The bride is pale...', 'The court wins.', 'Dismissed...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Izzet Dragons', difficulty: 'Normal', rewardSet: 'afr', teaches: ['Cycling matters'],
      blurb: 'Autumn 2021: Izzet dragons and a Delver against a green wolf pack.',
      hero: {who: 'izzet', deck: {label: 'tribute', name: 'Izzet Dragons', colors: 'UR', archetype: 'Midrange', list: `
4 Armory Veteran
4 Battle Cry Goblin
3 Hobgoblin Bandit Lord
3 Flameskull
4 Thermo-Alchemist
3 Red Dragon
3 Blue Dragon
2 Inferno of the Star Mounts
2 Zalto, Fire Giant Duke
2 Sunstreak Phoenix
2 Dragon Turtle
2 Magic Missile
2 Shocking Grasp
4 Stormcarved Coast
10 Island
10 Mountain`}},
      villain: {who: 'greenwolves', deck: {label: 'tribute', name: 'Mono-Green Day/Night', colors: 'G', archetype: 'Aggro', list: `
1 Pestilent Wolf
3 Dire Wolf Prowler
3 Tovolar's Huntmaster
3 Oakshade Stalker
3 Ulvenwald Oddity
2 Hound Tamer
3 Wolf Strike
3 Clear Shot
24 Forest
4 Gnoll Hunter
4 Scaled Herbalist
3 Prosperous Innkeeper
4 Intrepid Outlander`}},
      scene: [q('stage', 'Madness can\'t touch a mind ignited by genius.'),
        q('stage', 'If my hypothesis is correct . . .'),
        s('izzet', 'Burn their wolves early. Your dragons can wait until the board is yours.')],
      villainScene: [q('stage', 'With their usual prey scared off by werewolves, the wolves of the Ulvenwald adopted inventive new hunting techniques.'),
        q('stage', 'Wolves that feast on zombie flesh and survive carry the foul diseases of the dead wherever they roam.')],
      cues: {hero: cue('A hypothesis.', 'Dragon!', 'The wolves are quick...', 'Fire and ice.', 'Torn apart...', 'Burn the wolves before they pile up.'),
        villain: cue('Howl.', 'Pack!', 'The prey is gone...', 'The pack feeds.', 'Scattered...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Rakdos Vampires', difficulty: 'Normal', rewardSet: 'vow', teaches: ['Card advantage'],
      blurb: 'Autumn 2021: Rakdos vampires against an Orzhov cleric deck.',
      hero: {who: 'grixis', deck: {label: 'tribute', name: 'Rakdos Vampires', colors: 'BR', archetype: 'Aggro', list: `
4 Voldaren Epicure
4 Vampire Socialite
3 Falkenrath Forebear
3 Dominating Vampire
2 Florian, Voldaren Scion
2 Anje, Maid of Dishonor
1 Infernal Grasp
2 Play with Fire
4 Haunted Ridge
10 Swamp
10 Mountain
3 Falkenrath Pit Fighter
2 Voldaren Stinger
3 Ragged Recluse
4 Doomed Dissenter
3 Undead Butler`}},
      villain: {who: 'clerics', deck: {label: 'tribute', name: 'Orzhov Clerics', colors: 'W', archetype: 'Midrange', list: `
4 Lunarch Veteran
4 Brutal Cathar
4 Cathar Commando
3 Gavony Dawnguard
3 Adeline, Resplendent Cathar
3 Clarion Cathars
3 Sigardian Savior
3 Dawnbringer Cleric
3 Fateful Absence
2 Sungold Barrage
2 Thraben Exorcism
2 Ritual of Hope
24 Plains`}},
      scene: [q('stage', 'If you\'re not refining your tastes, what\'s the point of living forever?'),
        q('stage', 'A duel to first blood means something very different when a vampire is involved.'),
        s('grixis', 'Trade early removal for their clerics. Sorin turns the late game your way.')],
      villainScene: [q('stage', 'Selûne guides her devotees with majestic wisdom and grace.'),
        q('stage', 'We are a product of our ancestors, the apotheosis of countless noble generations. Speak their names with reverence, and they will guide your path.')],
      cues: {hero: cue('Refined.', 'Feast!', 'The clerics are stubborn...', 'The night is ours.', 'Staked...', 'Use removal on their best cleric.'),
        villain: cue('Selûne guides us.', 'Light!', 'The faith wavers...', 'The faith holds.', 'Fallen...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Olivia, Crimson Bride', difficulty: 'Hard', rewardSet: 'vow', teaches: ['Menace'],
      blurb: 'Olivia\'s wedding is the biggest night of the year. Kaya, Chandra and Teferi are going to crash it.',
      hero: {who: 'heroes', deck: {label: 'tribute', name: 'The Wedding Crashers', colors: 'WBR', list: `
3 Kaya, Geist Hunter
3 Chandra, Dressed to Kill
2 Sorin the Mirthless
3 Adeline, Resplendent Cathar
4 Brutal Cathar
4 Cathar Commando
2 Edgar, Charmed Groom
3 Markov Waltzer
2 Odric, Blood-Cursed
3 Bloodtithe Harvester
1 Markov Purifier
3 Fateful Absence
3 Infernal Grasp
3 Sundown Pass
4 Shattered Sanctum
3 Haunted Ridge
6 Plains
4 Swamp
4 Mountain`}},
      villain: {who: 'olivia', deck: {label: 'tribute', name: 'Olivia\'s Court', colors: 'BR', list: `
2 Olivia, Crimson Bride
4 Bloodtithe Harvester
4 Vampire Socialite
4 Voldaren Epicure
2 Falkenrath Forebear
3 Dominating Vampire
2 Florian, Voldaren Scion
2 Anje, Maid of Dishonor
1 Bloodvial Purveyor
2 Hero's Downfall
3 Infernal Grasp
3 Flame-Blessed Bolt
1 Olivia's Midnight Ambush
4 Haunted Ridge
10 Swamp
10 Mountain
2 Voldaren Stinger
1 Doomed Dissenter`}},
      scene: [q('stage', 'I\'ll lead.'),
        q('stage', 'And you were almost finished with that ritual, weren\'t you, darling? How very rude of me. To make it up to you, I\'ll send you an invitation to my wedding.'),
        s('heroes', 'Her court is bigger than yours. Hit Olivia first.')],
      villainScene: [q('stage', 'Her grand wedding had one goal: to unite the vampire bloodlines under her rule.'),
        q('stage', 'You can join me or feed me. Choose fast.')],
      cues: {hero: cue('Crash it!', 'Together!', 'The court is too big...', 'The night ends.', 'The wedding goes on...', 'Hit Olivia before the court grows.'),
        villain: {...cue('Welcome.', '[the organ roars]', '[a pale smile]', 'I do.', '[the bride falls silent]'),
          half: {who: 'sorin', line: 'Not tonight.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Mono-White Humans', difficulty: 'Hard', rewardSet: 'mid', rewardCard: 'Brutal Cathar // Moonrage Brute', mood: 'boss',
      teaches: ['Ward'],
      archive: {deck: 'Mono-White Humans', when: 'Autumn 2021', format: 'Standard.',
        what: 'A white aggro deck built around Adeline, Resplendent Cathar, Brutal Cathar, Thalia and a stream of cheap Humans.',
        why: 'Cheap efficient creatures, a strong exile effect, and Adeline\'s growing token army made it the fastest deck in the format.',
        beat: 'Kill Adeline early, keep creatures back to block, and use sweepers if you have them.',
        after: 'Innistrad: Crimson Vow and then Kamigawa: Neon Dynasty arrived and shuffled the format again.'},
      blurb: 'Deep in the archive, a white deck that is out of cards by turn six and does not care.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Izzet Dragons', colors: 'UR', archetype: 'Midrange', list: `
4 Armory Veteran
4 Battle Cry Goblin
3 Hobgoblin Bandit Lord
3 Flameskull
4 Thermo-Alchemist
3 Red Dragon
3 Blue Dragon
2 Inferno of the Star Mounts
2 Zalto, Fire Giant Duke
2 Sunstreak Phoenix
2 Dragon Turtle
2 Magic Missile
2 Shocking Grasp
4 Stormcarved Coast
10 Island
10 Mountain`}},
      villain: {who: 'whiteagg', deck: {label: 'tribute', name: 'Mono-White Humans', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'W', archetype: 'Aggro', list: `
2 Adeline, Resplendent Cathar
2 Brutal Cathar
2 Thalia, Guardian of Thraben
4 Lunarch Veteran
2 Cathar Commando
3 Clarion Cathars
3 Gavony Dawnguard
2 Sigardian Savior
2 Voice of the Blessed
3 Fateful Absence
3 Valorous Stance
24 Plains
4 Ambitious Farmhand
4 Hopeful Initiate`}},
      scene: [q('stage', 'Honorable tactics are for honorable foes. These werewolves are preying on innocent travelers. I\'ll stab them in the back while they sleep if I have to.'),
        s('you', 'Kill Adeline the turn she lands, or they will run you over.')],
      villainScene: [q('stage', 'Thraben belongs to the living. I will not rest until it is cleansed.')],
      cues: {hero: cue('Hold the line.', 'Burn her!', 'They are too many...', 'Cleansed.', 'Overrun...', 'Kill Adeline on sight.'),
        villain: cue('[a trumpet]', '[the token army]', '[a stall]', '[the dawn]', '[the line breaks]')},
      after: [s('stage', 'Recorded: Innistrad: Crimson Vow and then Kamigawa: Neon Dynasty arrived and shuffled the format again.')]},
  ],
};
