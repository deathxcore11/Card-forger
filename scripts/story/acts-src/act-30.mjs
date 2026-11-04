// Act 30: Three Fairy Tales (Throne of Eldraine, Theros Beyond Death, Ikoria: Lair of Behemoths, Core Set 2021). Story and
// dialogue: /mnt/project-files/story/act-30-script.md (generated from this file). Land set: eld.
// Three planes and three stories: a trickster fae king on Eldraine, a mortal hero's way home on Theros, and a plane of
// monsters bonding with people on Ikoria. Every quoted line is real flavor text from these four sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'three-fairy-tales',
  era: '2019-10-04',
  intro: [s('stage', 'Three stories now, each in its own plane. Eldraine first: castles, knights, and a king who is not what he seems.'),
    q('stage', 'Not every tale ends in glory.'),
    s('stage', 'Every card in Eldraine has a story, and some of them are lies.')],
  finale: [q('stage', 'Just tell us how many you want and get out of the way.'),
    s('stage', 'Oko\'s stories are over. The realm is still its own, and Eldraine goes back to knights and quests.'),
    s('stage', 'Recorded: Eldraine, Theros and Ikoria all got their ending. Another war is not far off.')],
  villainFinale: [q('stage', 'My advisors recommend I let them eat you.'),
    s('stage', 'In this version, the trickster stays on the throne, and the tale is his to tell.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Opt'},
    rowan: {name: 'Rowan and Will', title: 'Kenrith Twins', card: 'Rowan, Fearless Sparkmage', focus: '50% 25%'},
    cult: {name: 'Oko\'s Court', title: 'Fae and Beasts', card: 'Oko\'s Accomplices', focus: '50% 30%'},
    beast: {name: 'The Questing Beast', title: 'Of the Wilds', card: 'Questing Beast', focus: '50% 30%'},
    theros: {name: 'The Faithful', title: 'Of Heliod', card: 'Sunlit Hoplite', focus: '50% 30%'},
    elspeth: {name: 'Elspeth', title: 'Hero of Theros', card: 'Elspeth, Sun\'s Nemesis', focus: '50% 25%'},
    under: {name: 'The Underworld', title: 'Of Erebos', card: 'Woe Strider', focus: '50% 30%'},
    ashiok: {name: 'Ashiok', title: 'Nightmare Muse', card: 'Ashiok, Nightmare Muse', focus: '50% 25%'},
    vivien: {name: 'Vivien', title: 'Monsters\' Advocate', card: 'Vivien, Monsters\' Advocate', focus: '50% 25%'},
    lukka: {name: 'Lukka', title: 'Coppercoat Outcast', card: 'Lukka, Coppercoat Outcast', focus: '50% 25%'},
    food: {name: 'Simic Food', title: 'Autumn 2019', card: 'Gilded Goose', focus: '50% 30%'},
    adventures: {name: 'Adventures', title: 'Autumn 2019', card: 'Bonecrusher Giant // Stomp', focus: '50% 30%'},
    mutate: {name: 'Temur Mutate', title: 'Spring 2020', card: 'Illuna, Apex of Wishes', focus: '50% 25%'},
    ramp: {name: 'Gruul Ramp', title: 'Spring 2020', card: 'Terror of the Peaks', focus: '50% 30%'},
    allies: {name: 'Elspeth and the Kenriths', title: 'Three Stories', card: 'Elspeth, Undaunted Hero', focus: '50% 25%'},
    oko: {name: 'Oko', title: 'Thief of Crowns', card: 'Oko, Thief of Crowns', focus: '50% 25%'},
    fires: {name: 'Fires of Invention', title: 'Autumn 2019', card: 'Syr Carah, the Bold', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Every Card Has a Story', difficulty: 'Easy', rewardSet: 'eld', teaches: ['Adventures'],
      blurb: 'Rowan Kenrith and her brother come home to Eldraine. Oko\'s court is already in the castle.',
      hero: {who: 'rowan', deck: {label: 'tribute', name: 'The Kenrith Twins', colors: 'UR', list: `
4 Rimrock Knight
4 Bonecrusher Giant
3 Brazen Borrower
3 Merchant of the Vale
3 Embereth Shieldbreaker
3 Opportunistic Dragon
2 Redcap Raiders
2 Rowan, Fearless Sparkmage
3 Scorching Dragonfire
3 Slaying Fire
2 Thrill of Possibility
2 Searing Barrage
2 Opt
4 Temple of Epiphany
4 Swiftwater Cliffs
8 Island
8 Mountain`}},
      villain: {who: 'cult', deck: {label: 'tribute', name: 'Oko\'s Court', colors: 'GU', list: `
4 Garenbrig Carver
4 Rosethorn Acolyte
3 Fierce Witchstalker
3 Oko's Accomplices
3 Faerie Vandal
3 Wicked Wolf
3 Oakhame Adversary
3 Maraleaf Pixie
3 Fell the Pheasant
3 Essence Scatter
2 Charmed Sleep
2 Opt
4 Thornwood Falls
4 Temple of Mystery
8 Forest
8 Island`}},
      scene: [q('stage', 'Not every tale ends in glory.'),
        q('stage', 'Buying old, worn-out junk. Selling marvels of real value.'),
        s('rowan', 'Adventures: cast the Adventure half first, it goes to exile, and later you can cast the creature from exile.')],
      villainScene: [q('stage', 'They function as everything from assassins to jesters in the name of their fae king.'),
        q('stage', 'While the realm has laws, in the wilds there are other ways of balancing power.')],
      cues: {hero: cue('Home at last.', 'The giant wakes!', 'The court is too many...', 'The first tale ends.', 'Lost in the story...', 'Cast the Adventure first, creature later.'),
        villain: cue('Your Majesty.', 'Long live the king!', 'The court wobbles...', 'The king provides.', 'No court...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Questing Beast', difficulty: 'Easy', rewardSet: 'eld', teaches: ['Food'],
      blurb: 'The Questing Beast gathers the wild against Elspeth\'s faithful. Both sides are hungry.',
      hero: {who: 'beast', deck: {label: 'tribute', name: 'The Wilds of Garenbrig', colors: 'BG', list: `
4 Gilded Goose
3 Edgewall Innkeeper
4 Garenbrig Carver
4 Wicked Wolf
3 Questing Beast
3 Savvy Hunter
4 Gluttonous Troll
2 Feasting Troll King
4 Bake into a Pie
2 Reave Soul
3 Fell the Pheasant
4 Temple of Malady
4 Jungle Hollow
8 Forest
8 Swamp`}},
      villain: {who: 'theros', deck: {label: 'tribute', name: 'The Faithful of Heliod', colors: 'W', list: `
4 Sunlit Hoplite
4 Pious Wayfarer
4 Hero of the Winds
3 Glory Bearers
3 Reverent Hoplite
3 Lagonna-Band Storyteller
3 Elspeth's Devotee
2 Elspeth Conquers Death
3 Banishing Light
2 Elspeth, Sun's Nemesis
2 Omen of the Sun
3 Phalanx Tactics
24 Plains`}},
      scene: [q('stage', 'His mind chose solitude, but his heart disagreed.'),
        q('stage', 'Countless knights of Garenbrig owe their lives to his peerless craftsmanship.'),
        s('beast', 'Food: a Food token, an artifact you can sacrifice for 2 mana to gain 3 life. Many cards want food on the table.')],
      villainScene: [q('stage', 'Even in her absence, the light Elspeth kindled in our hearts never faltered.'),
        q('stage', 'Every footstep is a prayer, every road a temple.')],
      cues: {hero: cue('The wild is hungry.', 'Feast!', 'They are too bright...', 'The wilds win.', 'Starved...', 'Use Food for life when the race is close.'),
        villain: cue('The light holds.', 'Dawn!', 'The dark creeps in...', 'Heliod\'s light.', 'The light goes out...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Back from the Underworld', difficulty: 'Easy', rewardSet: 'thb', teaches: ['Escape'],
      blurb: 'Elspeth walks out of the underworld the hard way. Its dead are happy to follow.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'The Sun\'s Nemesis', colors: 'W', list: `
4 Transcendent Envoy
4 Heliod's Pilgrim
4 Leonin of the Lost Pride
3 Hero of the Pride
3 Daxos, Blessed by the Sun
3 Archon of Sun's Grace
2 Elspeth, Undaunted Hero
2 Elspeth, Sun's Nemesis
3 Elspeth Conquers Death
4 Banishing Light
2 Heliod's Intervention
2 Shatter the Sky
24 Plains`}},
      villain: {who: 'under', deck: {label: 'tribute', name: 'The Underworld', colors: 'B', list: `
4 Woe Strider
4 Mire Triton
3 Gravebreaker Lamia
3 Gray Merchant of Asphodel
3 Nightmare Shepherd
3 Underworld Charger
3 Erebos, Bleak-Hearted
3 Scavenging Harpy
4 Drag to the Underworld
3 Final Death
3 Funeral Rites
24 Swamp`}},
      scene: [q('stage', 'For her, I would gladly die again.'),
        q('stage', 'I bring a dawn that no night can follow.'),
        s('elspeth', 'Escape: cast it from the graveyard by paying its escape cost and exiling other cards from your graveyard. The graveyard is a second hand.')],
      villainScene: [q('stage', 'The more you struggle against death, the tighter its grip becomes.'),
        q('stage', 'Caught between life and death, between land and sea, between thought and oblivion.')],
      cues: {hero: cue('Into the light.', 'Escape!', 'The dead keep coming...', 'Out of the dark.', 'Pulled under...', 'Fill your graveyard to pay for escape.'),
        villain: cue('Rest.', 'Rise again!', 'It slips away...', 'The dead stay.', 'Banished...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Nightmare Muse', difficulty: 'Normal', rewardSet: 'thb', teaches: ['Planeswalkers'],
      blurb: 'The twins meet Ashiok, whose dreams go all the way to Eldraine\'s doors.',
      hero: {who: 'rowan', deck: {label: 'tribute', name: 'The Kenrith Twins', colors: 'UR', list: `
4 Bonecrusher Giant
4 Rimrock Knight
3 Opportunistic Dragon
3 Brazen Borrower
2 Rowan, Fearless Sparkmage
2 Redcap Raiders
4 Embereth Shieldbreaker
2 Scorching Dragonfire
3 Slaying Fire
4 Thrill of Possibility
2 Searing Barrage
3 Opt
4 Temple of Epiphany
4 Swiftwater Cliffs
8 Island
8 Mountain`}},
      villain: {who: 'ashiok', deck: {label: 'tribute', name: 'Ashiok\'s Dreams', colors: 'UB', list: `
4 Thassa's Oracle
4 Threnody Singer
4 Mire Triton
3 Nadir Kraken
3 Swimmer in Nightmares
3 Sphinx Mindbreaker
3 Ashiok, Nightmare Muse
2 Ashiok, Sculptor of Fears
3 Drag to the Underworld
3 Memory Drain
2 Eat to Extinction
2 Sleep of the Dead
4 Dismal Backwater
4 Temple of Deceit
8 Island
8 Swamp`}},
      scene: [q('stage', 'This sword is Sunrise. The other is Dawn. They mark the beginning of my days but the end of yours.'),
        q('stage', 'Every dream is a doorway.'),
        s('rowan', 'Planeswalkers: attack them directly. A walker you ignore will bury you in card advantage.')],
      villainScene: [q('stage', 'I bring a flood that nothing can withstand.'),
        q('stage', 'The Underworld erodes memory, identity, and eventually the physical form, leaving only crumbling statues called misera—hollow monuments to mortal futility.')],
      cues: {hero: cue('Wake up!', 'Fire first!', 'The dreams are heavy...', 'Morning comes.', 'Asleep...', 'Attack the walker before it takes over.'),
        villain: cue('[a quiet dream]', '[the muse smiles]', '[a nightmare slips]', '[sleep]', '[awake]')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Monsters of Ikoria', difficulty: 'Normal', rewardSet: 'iko', teaches: ['Mutate'],
      blurb: 'Vivien stands up for Ikoria\'s monsters. Lukka bonds with them and is not asking permission.',
      hero: {who: 'vivien', deck: {label: 'tribute', name: 'The Monsters\' Advocate', colors: 'GU', list: `
4 Humble Naturalist
4 Sea-Dasher Octopus
4 Gemrazer
2 Archipelagore
4 Migratory Greathorn
3 Trumpeting Gnarr
3 Parcelbeast
2 Vivien, Monsters' Advocate
3 Ram Through
3 Essence Scatter
3 Wilt
4 Thornwood Falls
4 Temple of Mystery
8 Forest
8 Island
1 Kogla, the Titan Ape`}},
      villain: {who: 'lukka', deck: {label: 'tribute', name: 'Lukka\'s Hunt', colors: 'RG', list: `
4 Pridemalkin
4 Prickly Marmoset
4 Porcuparrot
4 Frenzied Raptor
3 Ferocious Tigorilla
3 Pyroceratops
3 Rooting Moloch
2 Yidaro, Wandering Monster
3 Lukka, Coppercoat Outcast
3 Fire Prophecy
3 Ram Through
4 Rugged Highlands
4 Temple of Abandon
8 Mountain
8 Forest`}},
      scene: [q('stage', 'All seeds share a common bond, calling to each other across infinity.'),
        q('stage', 'Size of a pixie, rage of a hellkite.'),
        s('vivien', 'Mutate: cast a mutating creature onto a non-Human creature you own. The two become one, with all the abilities and the new top creature\'s stats.')],
      villainScene: [q('stage', 'The forge of Purphoros burns in the heart of Mount Velus, attracting dragons with its blistering heat.')],
      cues: {hero: cue('Come, friend.', 'Mutate!', 'The hunt closes in...', 'The herd is safe.', 'The herd is scattered...', 'Mutate onto a creature that already attacks well.'),
        villain: cue('Track them.', 'Bonded!', 'The trail goes cold...', 'The hunt ends.', 'The prey escapes...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Oko Food', difficulty: 'Normal', rewardSet: 'm21', teaches: ['Cycling matters'],
      blurb: 'Autumn 2019: the green-blue Food deck that everyone built, against knights with big plans.',
      hero: {who: 'food', deck: {label: 'tribute', name: 'Simic Food', colors: 'GU', archetype: 'Midrange', list: `
4 Gilded Goose
4 Lovestruck Beast
2 Wicked Wolf
3 Garenbrig Carver
3 Edgewall Innkeeper
3 Thunderous Snapper
2 Oko, Thief of Crowns
1 The Great Henge
3 Once Upon a Time
4 Fell the Pheasant
1 Return of the Wildspeaker
4 Opt
2 Mystical Dispute
4 Thornwood Falls
4 Temple of Mystery
8 Forest
8 Island`}},
      villain: {who: 'adventures', deck: {label: 'tribute', name: 'Knights and Adventures', colors: 'RW', archetype: 'Aggro', list: `
4 Bonecrusher Giant
4 Rimrock Knight
4 Embereth Shieldbreaker
4 Merchant of the Vale
3 Silverflame Squire
3 Giant Killer
3 Ardenvale Tactician
2 Shepherd of the Flock
3 Syr Carah, the Bold
3 Scorching Dragonfire
3 Slaying Fire
4 Wind-Scarred Crag
4 Temple of Triumph
8 Mountain
8 Plains`}},
      scene: [q('stage', 'Find him a weapon as big as his dreams.'),
        q('stage', 'His mind chose solitude, but his heart disagreed.'),
        s('food', 'Food makes your Oko hit harder and your life total hard to burn through. Keep him alive.')],
      villainScene: [q('stage', 'In a castle that prizes loyalty above all, the bond between knight and griffin is unmatched.'),
        q('stage', 'What size advantage? They never even see me coming.')],
      cues: {hero: cue('Dinner time.', 'Everything is an elk!', 'The knights are quick...', 'The food was good.', 'Eaten...', 'Protect Oko; food is not for burning.'),
        villain: cue('For the realm!', 'Charge!', 'Out of adventures...', 'The tale is told.', 'The tale ends...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Temur Mutate', difficulty: 'Normal', rewardSet: 'iko', teaches: ['Racing'],
      blurb: 'Spring 2020: a mutate deck against big green ramp.',
      hero: {who: 'mutate', deck: {label: 'tribute', name: 'Temur Mutate', colors: 'GUR', archetype: 'Midrange', list: `
4 Sea-Dasher Octopus
4 Gemrazer
4 Cloudpiercer
4 Illuna, Apex of Wishes
3 Sprite Dragon
3 Parcelbeast
2 Lore Drakkis
2 Fierce Empath
3 Fire Prophecy
2 Essence Scatter
4 Ram Through
1 Wilt
3 Ketria Triome
3 Thornwood Falls
3 Swiftwater Cliffs
2 Rugged Highlands
5 Island
4 Mountain
4 Forest`}},
      villain: {who: 'ramp', deck: {label: 'tribute', name: 'Gruul Ramp', colors: 'RG', archetype: 'Ramp', note: 'Wilderness Reclamation is not in this act\'s sets, so this is a ramp deck of the same era.', list: `
4 Llanowar Visionary
4 Humble Naturalist
4 Cultivate
1 Elder Gargaroth
2 Terror of the Peaks
1 Kogla, the Titan Ape
1 Titanoth Rex
2 Garruk, Unleashed
1 Lukka, Coppercoat Outcast
3 Ram Through
3 Fire Prophecy
4 Shock
3 Wilt
4 Rugged Highlands
4 Temple of Abandon
8 Forest
8 Mountain
2 Fierce Empath
1 Garruk, Unleashed`}},
      scene: [q('stage', 'Size of a pixie, rage of a hellkite.'),
        q('stage', 'All seeds share a common bond, calling to each other across infinity.'),
        s('mutate', 'Mutate onto something that is already attacking. Keep your counters ready for their big finishers.')],
      villainScene: [q('stage', 'The forge of Purphoros burns in the heart of Mount Velus, attracting dragons with its blistering heat.')],
      cues: {hero: cue('Join up.', 'Mutated!', 'Their ramp is faster...', 'The pair wins.', 'Outsized...', 'Hold counters for their big plays.'),
        villain: cue('Plant seeds.', 'Roar!', 'Stuck on lands...', 'The monsters wake.', 'Smothered...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Oko, Thief of Crowns', difficulty: 'Hard', rewardSet: 'eld', teaches: ['Planeswalkers'],
      blurb: 'Oko took the crowns and turned a king into an elk. Elspeth and the Kenriths aim to get them back.',
      hero: {who: 'allies', deck: {label: 'tribute', name: 'Elspeth and the Kenriths', colors: 'RW', list: `
4 Bonecrusher Giant
4 Rimrock Knight
3 Giant Killer
3 Ardenvale Tactician
3 Embereth Shieldbreaker
2 Syr Carah, the Bold
2 Rowan, Fearless Sparkmage
3 Elspeth, Sun's Nemesis
2 Elspeth, Undaunted Hero
3 Elspeth Conquers Death
2 Banishing Light
3 Scorching Dragonfire
2 Slaying Fire
4 Wind-Scarred Crag
3 Temple of Triumph
9 Plains
8 Mountain`}},
      villain: {who: 'oko', deck: {label: 'tribute', name: 'Oko\'s Court', colors: 'GU', list: `
4 Gilded Goose
4 Oko, Thief of Crowns
4 Once Upon a Time
4 Lovestruck Beast
2 Questing Beast
3 Wicked Wolf
3 Edgewall Innkeeper
3 Thunderous Snapper
2 The Great Henge
3 Fell the Pheasant
2 Mystical Dispute
2 Opt
4 Thornwood Falls
4 Temple of Mystery
8 Forest
8 Island`}},
      scene: [q('stage', 'Duty and honor are reasons enough, but beating you will also be a pleasure.'),
        q('stage', 'Even when hope is but a small flame fighting the night, I will serve the absent king.'),
        s('allies', 'Kill his Food, kill Oko, kill whatever he turns into an elk. Do not give him time.')],
      villainScene: [q('stage', 'My advisors recommend I let them eat you.'),
        q('stage', 'Just tell us how many you want and get out of the way.')],
      cues: {hero: cue('For the crown!', 'Together!', 'He is turning us into elk...', 'The tale is ours.', 'An elk again...', 'Attack Oko the turn he lands.'),
        villain: {...cue('Bow.', '[an elk bleats]', '[a trick fails]', 'The crown is mine.', '[the throne is empty]'),
          half: {who: 'cult', line: 'The king will not be amused.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Fires of Invention', difficulty: 'Hard', rewardSet: 'eld', rewardCard: 'Fires of Invention', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Fires of Invention', when: 'Autumn 2019', format: 'Standard.',
        what: 'A red and white deck that used Fires of Invention to cast two spells per turn on a limited mana budget.',
        why: 'Cheap, efficient spells and a free-cast engine made it a fast, resilient attacker in a format with many Food and Adventure decks.',
        beat: 'Kill the engine pieces early and race; the deck wants to untap with Fires on the table.',
        after: 'Throne of Eldraine\'s Standard seat was taken over by Theros Beyond Death and then Ikoria later that year and in 2020.'},
      blurb: 'Deep in the archive, a red and white pile that casts two spells for the price of one.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Gruul Ramp', colors: 'RG', archetype: 'Ramp', list: `
4 Llanowar Visionary
4 Humble Naturalist
4 Cultivate
3 Elder Gargaroth
3 Terror of the Peaks
2 Kogla, the Titan Ape
2 Titanoth Rex
2 Garruk, Unleashed
2 Lukka, Coppercoat Outcast
3 Ram Through
3 Fire Prophecy
2 Shock
2 Wilt
4 Rugged Highlands
4 Temple of Abandon
8 Forest
8 Mountain`}},
      villain: {who: 'fires', deck: {label: 'tribute', name: 'Fires of Invention', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'RW', archetype: 'Aggro', list: `
4 Fires of Invention
4 Bonecrusher Giant
3 Embereth Shieldbreaker
3 Rimrock Knight
3 Giant Killer
2 Torbran, Thane of Red Fell
2 Syr Carah, the Bold
4 Slaying Fire
3 Searing Barrage
2 Elspeth Conquers Death
2 Trapped in the Tower
3 Scorching Dragonfire
1 Sundering Stroke
4 Wind-Scarred Crag
4 Temple of Triumph
8 Mountain
8 Plains`}},
      scene: [q('stage', 'Just tell us how many you want and get out of the way.'),
        s('you', 'Kill the engine before it spends your turn for you.')],
      villainScene: [q('stage', 'The purest virtue burns brighter than the sun and hotter than dragonfire.')],
      cues: {hero: cue('Break the engine.', 'Smash it!', 'Fires is online...', 'Fires out.', 'Out-cast...', 'Kill Fires of Invention.'),
        villain: cue('[a quiet spell]', '[two at once]', '[a stall]', '[ashes]', '[the fire goes out]')},
      after: [s('stage', 'Recorded: Throne of Eldraine\'s Standard seat was taken over by Theros Beyond Death and then Ikoria later that year and in 2020.')]},
  ],
};
