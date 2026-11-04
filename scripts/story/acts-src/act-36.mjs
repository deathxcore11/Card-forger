// Act 36: The Murders (Wilds of Eldraine, The Lost Caverns of Ixalan, Murders at Karlov Manor). Story and dialogue:
// /mnt/project-files/story/act-36-script.md (generated from this file). Land set: woe.
// After the war, three mysteries: a curse on Eldraine, a god under Ixalan, and a killer in Ravnica. Every quoted line is real
// flavor text from these sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'murders-and-fairy-caverns',
  era: '2023-09-08',
  intro: [q('stage', 'While Neva\'s mind wandered the realm of dreams, her body lay protected as mages worked frantically to find a cure for the Wicked Slumber.'),
    s('stage', 'The war is over, and nobody gets to rest. Eldraine sleeps, Ixalan bleeds, and Ravnica has a body on the floor.')],
  finale: [q('stage', 'Proft lit up like a man who had just been handed a glorious and unexpected gift. "I know who\'s responsible for this," he said. "And I can prove it."'),
    s('stage', 'Massacre Girl is caught. She was paid to do it, and the Agency now knows to look for whoever paid her.'),
    s('stage', 'Recorded: three mysteries, three plane-sized answers, and one question that stays open.')],
  villainFinale: [q('stage', '\'Did I do it?\' You\'ll have to be more specific.'),
    s('stage', 'In this version, nobody catches her, and the party at Karlov Manor never ends.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Compass Gnome'},
    will: {name: 'Will and Rowan', title: 'Of Eldraine', card: 'Will, Scion of Peace', focus: '50% 25%'},
    nightmares: {name: 'Ashiok\'s Nightmares', title: 'The Sleepers', card: 'Ashiok, Wicked Manipulator', focus: '50% 25%'},
    quint: {name: 'Quintorius\'s Expedition', title: 'Of the Lost Caverns', card: 'Quintorius Kand', focus: '50% 25%'},
    coin: {name: 'The Coin Empire', title: 'Of Ixalan', card: 'Greedy Freebooter', focus: '50% 30%'},
    kellan: {name: 'Kellan\'s Crew', title: 'Of the Deep', card: 'Kellan, the Fae-Blooded // Birthright Boon', focus: '50% 25%'},
    talion: {name: 'Talion', title: 'The Kindly Lord', card: 'Talion, the Kindly Lord', focus: '50% 25%'},
    core: {name: 'The Core\'s Defenders', title: 'Of Ixalan', card: 'Huatli, Poet of Unity // Roar of the Fifth People', focus: '50% 25%'},
    aclazotz: {name: 'Aclazotz', title: 'The Bat God', card: 'Aclazotz, Deepest Betrayal // Temple of the Dead', focus: '50% 25%'},
    alquist: {name: 'Alquist Proft', title: 'Master Sleuth', card: 'Alquist Proft, Master Sleuth', focus: '50% 25%'},
    golgari: {name: 'The Rot Farm', title: 'Golgari of Ravnica', card: 'Festerleech', focus: '50% 30%'},
    esper: {name: 'Esper Midrange', title: 'Winter 2024', card: 'Teysa, Opulent Oligarch', focus: '50% 25%'},
    domain: {name: 'Domain Ramp', title: 'Winter 2024', card: 'Ghalta, Stampede Tyrant', focus: '50% 25%'},
    dimir: {name: 'Dimir Control', title: 'Winter 2024', card: 'Proft\'s Eidetic Memory', focus: '50% 30%'},
    boros: {name: 'Boros Convoke', title: 'Winter 2024', card: 'Aurelia, the Law Above', focus: '50% 25%'},
    agency: {name: 'The Agency', title: 'Of Ravnica', card: 'Ezrim, Agency Chief', focus: '50% 25%'},
    massacre: {name: 'Massacre Girl', title: 'Known Killer', card: 'Massacre Girl, Known Killer', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Bargain', difficulty: 'Easy', rewardSet: 'woe', teaches: ['Bargain'],
      blurb: 'Will and Rowan are in Eldraine, and everyone is asleep. Ashiok\'s nightmares walk the halls.',
      hero: {who: 'will', deck: {label: 'tribute', name: 'Will and Rowan', note: 'Will\'s side only; Rowan\'s black and red are left out for our land pool.', colors: 'WU', list: `
4 Frostbridge Guard
4 Regal Bunnicorn
4 Cheeky House-Mouse // Squeak By
3 Knight of Doves
3 Werefox Bodyguard
3 Will, Scion of Peace
3 Gallant Pie-Wielder
3 Rimefur Reindeer
3 Archon of the Wild Rose
3 Stockpiling Celebrant
3 Glass Casket
4 Meticulous Archive
10 Plains
10 Island`}},
      villain: {who: 'nightmares', deck: {label: 'tribute', name: 'Ashiok\'s Nightmares', colors: 'UB', list: `
4 Faerie Dreamthief
4 Sleep-Cursed Faerie
2 Snaremaster Sprite
4 Barrow Naughty
3 Ashiok, Wicked Manipulator
4 Taken by Nightmares
3 Ashiok's Reaper
3 Dream Spoilers
4 Mocking Sprite
3 Spell Stutter
2 Wicked Visitor
4 Undercity Sewers
10 Island
10 Swamp`}},
      scene: [q('stage', 'It\'s easy to cry \'For glory!\' and charge those who disagree with you. But it takes finesse to turn enemies into allies rather than corpses.'),
        q('stage', 'The sentry watched impassively, its spear unmoving. One by one, the would-be adventurers stumbled and fell, frostbitten, to the ground.'),
        s('will', 'Bargain: sacrifice an artifact, enchantment or token as you cast a spell, and get a better version of it.')],
      villainScene: [q('stage', 'Dying in your sleep is never peaceful when Ashiok is involved.'),
        q('stage', 'Neva\'s dreams were haunted by memories of the invasion—oil-black tendrils grasping at her through the mist. Or . . . was this something new?')],
      cues: {hero: cue('Wake up!', 'Bargain!', 'The dreams are heavy...', 'The sleepers wake.', 'Asleep again...', 'Sacrifice a token for the better version.'),
        villain: cue('Sleep.', 'Dream!', 'Waking...', 'Sleep on.', 'Broken awake...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Roles', difficulty: 'Easy', rewardSet: 'lci', teaches: ['Roles'],
      blurb: 'Quintorius\'s expedition reaches Ixalan\'s depths and meets the Coin Empire.',
      hero: {who: 'quint', deck: {label: 'tribute', name: 'Quintorius\'s Expedition', colors: 'RW', list: `
4 Thousand Moons Crackshot
4 Warden of the Inner Sky
4 Kutzil's Flanker
3 Anim Pakal, Thousandth Moon
3 Quintorius Kand
3 Sunshot Militia
4 Burning Sun Cavalry
3 Inti, Seneschal of the Sun
2 Dinotomaton
3 Resplendent Angel
3 Abrade
4 Elegant Parlor
10 Mountain
10 Plains`}},
      villain: {who: 'coin', deck: {label: 'tribute', name: 'The Coin Empire', colors: 'B', list: `
4 Greedy Freebooter
4 Deep-Cavern Bat
4 Acolyte of Aclazotz
1 Bloodletter of Aclazotz
1 Vito's Inquisitor
3 Preacher of the Schism
4 Bitter Triumph
4 Dead Weight
1 Starving Revenant
1 Lord Skitter, Sewer King
3 Canonized in Blood
24 Swamp
4 Stalactite Stalker
2 Skullcap Snail`}},
      scene: [q('stage', 'If you\'re afraid to dive into the unknown, how will you ever find anything new?'),
        q('stage', 'Look! Aclazotz sends his children to watch over our pilgrimage.'),
        s('quint', 'Roles: a Role token on a creature changes what it does. Put the right one on the right creature.')],
      villainScene: [q('stage', 'Neither Nurgam nor the mycoid who laid the trap could quite believe their luck.'),
        q('stage', 'Its very presence rips old wounds open to bleed anew.')],
      cues: {hero: cue('Dig in.', 'Treasure!', 'The empire is greedy...', 'The caverns are ours.', 'Buried...', 'Put the role on the creature that matters.'),
        villain: cue('Coin.', 'Take it!', 'The haul is lost...', 'All is ours.', 'Bankrupt...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Discover', difficulty: 'Easy', rewardSet: 'lci', teaches: ['Discover'],
      blurb: 'Kellan finds a cave full of dinosaurs. Talion has a lot of fae friends and a lot of opinions.',
      hero: {who: 'kellan', deck: {label: 'tribute', name: 'Kellan\'s Crew', colors: 'RG', list: `
4 Geological Appraiser
3 Trumpeting Carnosaur
4 Intrepid Paleontologist
4 Scytheclaw Raptor
4 Jadelight Spelunker
4 Pugnacious Hammerskull
3 Thrashing Brontodon
2 Seismic Monstrosaur
4 Abrade
3 Triumphant Chomp
1 Hulking Raptor
4 Commercial District
10 Mountain
10 Forest`}},
      villain: {who: 'talion', deck: {label: 'tribute', name: 'Talion\'s Court', colors: 'UB', list: `
4 Mocking Sprite
4 Snaremaster Sprite
4 Storyteller Pixie
3 Talion, the Kindly Lord
3 Tenacious Tomeseeker
4 Spell Stutter
3 Talion's Messenger
4 Faerie Dreamthief
3 Sweettooth Witch
4 Rat Out
4 Undercity Sewers
10 Island
10 Swamp`}},
      scene: [q('stage', 'If you\'re afraid to dive into the unknown, how will you ever find anything new?'),
        q('stage', 'She\'s a smart one. Noticed all on her own that the bloodsuckers wave their hands around to do their filthy magic, so she rips off their hands first.'),
        s('kellan', 'Discover: reveal cards from the top of your library until you find a cheaper spell, then cast it for free.')],
      villainScene: [q('stage', 'Look at me, everyone! I\'m a High Fae! Watch me do important High Fae things!'),
        q('stage', 'You are but learning to walk in a world where I fly, mortal.')],
      cues: {hero: cue('Dive in!', 'Discover!', 'The court is clever...', 'A fine find.', 'Trapped...', 'Discover a cheaper spell and play it free.'),
        villain: cue('Mortal.', 'Flit!', 'The court slips...', 'High Fae win.', 'Humbled...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Aclazotz', difficulty: 'Normal', rewardSet: 'lci', teaches: ['Flying'],
      blurb: 'The bat god of the Lost Caverns. His bats are everywhere and they drain life.',
      hero: {who: 'core', deck: {label: 'tribute', name: 'The Core\'s Defenders', colors: 'GW', list: `
4 Cenote Scout
4 Intrepid Paleontologist
3 Malamet Brawler
3 Kutzil, Malamet Exemplar
3 Huatli, Poet of Unity // Roar of the Fifth People
3 Sovereign Okinec Ahau
3 Mischievous Pup
4 Oltec Cloud Guard
3 Walk with the Ancestors
3 Get Lost
3 Petrify
4 Lush Portico
10 Forest
10 Plains`}},
      villain: {who: 'aclazotz', deck: {label: 'tribute', name: 'Aclazotz\'s Bats', colors: 'BW', list: `
4 Ruin-Lurker Bat
4 Deep-Cavern Bat
4 Bat Colony
1 Aclazotz, Deepest Betrayal // Temple of the Dead
1 Vito, Fanatic of Aclazotz
2 Bloodletter of Aclazotz
3 Sanguine Evangelist
4 Canonized in Blood
3 Bitter Triumph
3 Get Lost
1 Amalia Benavides Aguirre
4 Shadowy Backstreet
10 Plains
10 Swamp
4 Warden of the Inner Sky
2 Market Gnome`}},
      scene: [q('stage', 'The first shriek locates the prey. The second immobilizes it.'),
        q('stage', 'Look! Aclazotz sends his children to watch over our pilgrimage.'),
        s('core', 'Their bats fly and gain life. Block them with reach or flying, and keep the removal for Aclazotz himself.')],
      villainScene: [q('stage', 'Though he wept at Inti\'s death, Caparocti\'s eyes were keen, and his spear pierced cleanly through Clavileño\'s tainted heart.'),
        q('stage', 'Its very presence rips old wounds open to bleed anew.')],
      cues: {hero: cue('Hold the door.', 'Down they go!', 'The bats are everywhere...', 'The Core stands.', 'Drained...', 'Kill the fliers before they stack up.'),
        villain: cue('Shriek.', 'Betrayal!', 'The bats scatter...', 'The god feeds.', 'Silenced...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Collect Evidence', difficulty: 'Normal', rewardSet: 'mkm', teaches: ['Collect evidence'],
      blurb: 'A body in Karlov Manor. Alquist Proft and the Agency have a lot of suspects and a lot of ways to look into them.',
      hero: {who: 'alquist', deck: {label: 'tribute', name: 'The Agency Detectives', colors: 'WU', list: `
4 Novice Inspector
4 Wojek Investigator
4 Forensic Researcher
4 Tenth District Hero
3 Alquist Proft, Master Sleuth
3 Private Eye
3 Eliminate the Impossible
3 Deduce
4 Crimestopper Sprite
4 Jaded Analyst
4 Meticulous Archive
10 Plains
10 Island`}},
      villain: {who: 'golgari', deck: {label: 'tribute', name: 'The Rot Farm', colors: 'BG', list: `
4 Festerleech
4 Snarling Gorehound
4 Rubblebelt Maverick
4 Alley Assailant
3 Vengeful Creeper
3 Hunted Bonebrute
3 Nightdrinker Moroii
3 Murder
3 Bite Down on Crime
3 Long Goodbye
2 Dead Weight
4 Underground Mortuary
10 Swamp
10 Forest`}},
      scene: [q('stage', 'If the perfect evidence appears at your feet, your first task is to rule out misdirection.'),
        q('stage', 'Half the city had motive. Time to narrow down who also had the means and opportunity.'),
        s('alquist', 'Collect evidence: exile cards from your graveyard with enough total mana value to pay for a better version of the spell.')],
      villainScene: [q('stage', 'I\'d offer your dog a treat, but I\'m afraid I don\'t have any appendages to spare.'),
        q('stage', 'As the days grew longer, so did the list of missing persons.')],
      cues: {hero: cue('Follow the clue.', 'Evidence!', 'The trail is cold...', 'Case closed.', 'No leads...', 'Exile your graveyard for the stronger spell.'),
        villain: cue('Rot.', 'Feast!', 'The rot fades...', 'The farm wins.', 'Cleaned out...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Esper vs Domain', difficulty: 'Normal', rewardSet: 'mkm', teaches: ['Card advantage'],
      blurb: 'Winter 2024: an Esper midrange deck against a big green ramp deck.',
      hero: {who: 'esper', deck: {label: 'tribute', name: 'Esper Midrange', colors: 'WUB', archetype: 'Midrange', list: `
4 Deep-Cavern Bat
3 Marketwatch Phantom
3 Kitesail Larcenist
3 Resplendent Angel
3 Teysa, Opulent Oligarch
3 Alquist Proft, Master Sleuth
4 Bitter Triumph
3 Murder
3 Get Lost
3 Deduce
3 Case File Auditor
1 Unscrupulous Agent
4 Shadowy Backstreet
4 Meticulous Archive
4 Undercity Sewers
4 Plains
4 Island
4 Swamp`}},
      villain: {who: 'domain', deck: {label: 'tribute', name: 'Domain Ramp', note: 'Domain Ramp is five colours; here the green ramp core is kept for our land pool.', colors: 'G', archetype: 'Ramp', list: `
4 Jadelight Spelunker
4 Basking Capybara
4 Armored Kincaller
4 Thrashing Brontodon
3 Hulking Raptor
3 Earthshaker Dreadmaw
2 Ghalta, Stampede Tyrant
3 Cavern Stomper
3 Bite Down on Crime
3 Spelunking
3 Over the Edge
24 Forest`}},
      scene: [q('stage', 'Proft lit up like a man who had just been handed a glorious and unexpected gift.'),
        q('stage', 'Laughter and conversation trailed off as the revelers gathered around Zegana\'s body.'),
        s('esper', 'Trade removal for their big creatures, and win with the cards you drew along the way.')],
      villainScene: [q('stage', 'A thundering roar calls forth a primeval army.'),
        q('stage', 'The bite at the end of the tunnel.')],
      cues: {hero: cue('Patience.', 'Murder!', 'The big ones are landing...', 'Quality wins.', 'Trampled...', 'Kill the big creatures before they stack up.'),
        villain: cue('Grow.', 'Stampede!', 'Out of mana...', 'The stampede wins.', 'Cut down...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Dimir vs Boros', difficulty: 'Normal', rewardSet: 'mkm', teaches: ['Counterspells'],
      blurb: 'Winter 2024: a Dimir control deck against a Boros convoke rush.',
      hero: {who: 'dimir', deck: {label: 'tribute', name: 'Dimir Control', colors: 'UB', archetype: 'Control', list: `
4 Bitter Triumph
3 Murder
3 Long Goodbye
4 Eaten by Piranhas
4 Disdainful Stroke
3 Out Cold
4 Proft's Eidetic Memory
4 Deep-Cavern Bat
3 Nightdrinker Moroii
3 Persuasive Interrogators
1 Deduce
4 Undercity Sewers
10 Island
10 Swamp`}},
      villain: {who: 'boros', deck: {label: 'tribute', name: 'Boros Convoke', colors: 'RW', archetype: 'Aggro', list: `
4 Embereth Veteran
4 Harried Spearguard
4 Grand Ball Guest
4 Goblin Maskmaker
1 Lightning Helix
1 Warleader's Call
2 Torch the Tower
4 Stonesplitter Bolt
4 Burning Sun Cavalry
4 Elegant Parlor
10 Mountain
10 Plains
4 Kindled Heroism
4 Monstrous Rage`}},
      scene: [q('stage', 'We\'ll get their statements after they defrost.'),
        q('stage', 'In retrospect, using storm magic against a storm giant was not the wisest strategy.'),
        s('dimir', 'Kill their early creatures and counter the big plays. You win the long game.')],
      villainScene: [q('stage', 'While Aurelia mustered the Boros Legion, Kaya and Kellan raced against the clock, desperate to stave off a war the guilds might not survive.'),
        q('stage', 'She realized that she could not, in fact, handle the truth.')],
      cues: {hero: cue('Hold on.', 'Denied!', 'Too many attackers...', 'Control wins.', 'Overrun...', 'Remove the early attackers.'),
        villain: cue('Charge!', 'Convoke!', 'Out of fuel...', 'The Legion wins.', 'Stalled...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Massacre Girl, Known Killer', difficulty: 'Hard', rewardSet: 'mkm', teaches: ['Racing'],
      blurb: 'The killer from Karlov Manor, with a deck of removal. Keep your board small and your hand full.',
      hero: {who: 'agency', deck: {label: 'tribute', name: 'The Agency', colors: 'WU', list: `
4 Novice Inspector
4 Wojek Investigator
4 Forensic Researcher
4 Tenth District Hero
3 Alquist Proft, Master Sleuth
3 Ezrim, Agency Chief
3 Eliminate the Impossible
3 Deduce
4 Crimestopper Sprite
4 Jaded Analyst
4 Meticulous Archive
10 Plains
10 Island`}},
      villain: {who: 'massacre', deck: {label: 'tribute', name: 'Massacre Girl\'s Removal Pile', colors: 'BR', list: `
3 Massacre Girl, Known Killer
4 Shock
4 Bitter Triumph
3 Murder
3 Molten Collapse
4 Blood Spatter Analysis
3 Judith, Carnage Connoisseur
3 Rakdos, Patron of Chaos
4 Reckless Detective
3 Rune-Brand Juggler
2 Long Goodbye
4 Raucous Theater
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'They always think they\'re better than the local investigators. They\'re usually right.'),
        q('stage', 'Proft lit up like a man who had just been handed a glorious and unexpected gift.'),
        s('agency', 'Do not overcommit. Her Massacre Girl will wipe a crowded board.')],
      villainScene: [q('stage', '\'Did I do it?\' You\'ll have to be more specific.'),
        q('stage', 'Laughter and conversation trailed off as the revelers gathered around Zegana\'s body.')],
      cues: {hero: cue('Case closed.', 'Gotcha!', 'She keeps killing...', 'Caught.', 'The case is cold...', 'Keep your board small and your hand full.'),
        villain: {...cue('Did I?', '[a music box plays]', '[the music slows]', 'Specifically?', '[the music box stops]'),
          half: {who: 'alquist', line: 'The evidence points one way. Come quietly.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Boros Convoke at Full Power', difficulty: 'Hard', rewardSet: 'mkm', rewardCard: 'Aurelia, the Law Above', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Boros Convoke', when: 'Winter 2024', format: 'Standard.',
        what: 'A red-white deck of cheap creatures that tap to help cast bigger ones.',
        why: 'It was one of the fastest decks in the format and punished slow hands.',
        beat: 'Kill the first two creatures and keep your life above burn range.',
        after: 'Later sets gave the format more removal and slowed it down.'},
      blurb: 'Deep in the archive, a Boros deck that taps out and attacks every turn.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Kellan\'s Crew', colors: 'RG', list: `
4 Geological Appraiser
3 Trumpeting Carnosaur
4 Intrepid Paleontologist
4 Scytheclaw Raptor
4 Jadelight Spelunker
4 Pugnacious Hammerskull
3 Thrashing Brontodon
2 Seismic Monstrosaur
4 Abrade
3 Triumphant Chomp
1 Hulking Raptor
4 Commercial District
10 Mountain
10 Forest`}},
      villain: {who: 'boros', deck: {label: 'tribute', name: 'Boros Convoke', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'RW', archetype: 'Aggro', list: `
4 Embereth Veteran
4 Harried Spearguard
4 Grand Ball Guest
4 Goblin Maskmaker
3 Aurelia, the Law Above
4 Lightning Helix
4 Warleader's Call
3 Torch the Tower
4 Stonesplitter Bolt
2 Burning Sun Cavalry
4 Elegant Parlor
10 Mountain
10 Plains`}},
      scene: [q('stage', 'While Aurelia mustered the Boros Legion, Kaya and Kellan raced against the clock, desperate to stave off a war the guilds might not survive.'),
        s('you', 'Stop the first two creatures and they run out of steam.')],
      villainScene: [q('stage', 'After heavy casualties in the Phyrexian invasion, the Boros mage-priests trained as many rank-and-file soldiers as possible to wield the Legion\'s legendary battle magic.')],
      cues: {hero: cue('Hold the line.', 'Strike back!', 'They are fast...', 'The Legion falls.', 'Overrun...', 'Kill the first two creatures.'),
        villain: cue('[a drumbeat]', '[the Legion charges]', '[a pause]', '[the Legion wins]', '[the Legion breaks]')},
      after: [s('stage', 'Recorded: later sets gave the format more removal and slowed it down.')]},
  ],
};
