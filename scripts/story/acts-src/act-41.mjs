// Act 41: Crossing: Spider-Man and Avatar. Story and dialogue: /mnt/project-files/story/act-41-script.md (generated from this file).
// Land set: spm. Two Universes Beyond worlds, one act: New York with its spiders, then the four nations. Outside Magic canon: you are only passing through.
// Every quoted line is real flavor text from Magic: The Gathering - Marvel's Spider-Man and Avatar: The Last Airbender; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'crossing-spider-avatar',
  era: '2025-11-21',
  intro: [s('stage', 'An Omenpath opens over a city of glass towers and webs. Then, past it, another opens onto four nations at war.'),
    s('stage', 'Neither world is part of the Multiverse you know. Each has its own heroes, its own villains and its own rules.'),
    s('stage', 'Recorded: crossings sit outside Magic canon. You are only passing through, twice.')],
  finale: [s('stage', 'The Phoenix King falls, and the comet that was meant to burn the world fades from the sky.'),
    q('katara', 'I will never, ever turn my back on people who need me!'),
    s('stage', 'The Omenpaths fold shut, one after the other. The road turns back to the Multiverse.')],
  villainFinale: [s('stage', 'In this version the war never ends. The skies stay red.'),
    q('ozai', 'Out of the ashes, a new world will be born.'),
    s('stage', 'The last Omenpath flickers, and holds just long enough for you to leave.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Web-Shooters'},
    peter: {name: 'Peter Parker', title: 'Your Friendly Neighborhood Spider-Man', card: 'Peter Parker // Amazing Spider-Man', focus: '50% 25%'},
    crooks: {name: 'The Wild Pack', title: 'Street Crooks', card: 'Common Crook', focus: '50% 30%'},
    gwen: {name: 'Spider-Punk and Gwen', title: 'Spiders of the Multiverse', card: 'Spider-Punk', focus: '50% 25%'},
    symbiotes: {name: 'The Symbiotes', title: 'Gwenom and Venom', card: 'Gwenom, Remorseless', focus: '50% 25%'},
    mj: {name: 'Mary Jane and Silk', title: 'The Team-Up', card: 'Mary Jane Watson', focus: '50% 25%'},
    ock: {name: 'Doctor Octopus', title: 'Master Planner', card: 'Doctor Octopus, Master Planner', focus: '50% 25%'},
    spiderverse: {name: 'The Spider-Verse', title: 'Every Spider, Together', card: 'Spider-UK', focus: '50% 25%'},
    goblin: {name: 'The Green Goblin', title: 'Of Oscorp', card: 'Ultimate Green Goblin', focus: '50% 25%'},
    aang: {name: 'Aang', title: 'The Last Airbender', card: 'Aang, the Last Airbender', focus: '50% 25%'},
    fire: {name: 'The Fire Nation', title: 'Raiders', card: 'Fire Nation Raider', focus: '50% 30%'},
    bumi: {name: 'Bumi', title: 'King of Omashu', card: 'Bumi, King of Three Trials', focus: '50% 25%'},
    dailee: {name: 'The Dai Li', title: 'Of Ba Sing Se', card: 'Long Feng, Grand Secretariat', focus: '50% 25%'},
    katara: {name: 'Katara', title: 'Waterbending Prodigy', card: 'Katara, Bending Prodigy', focus: '50% 25%'},
    koh: {name: 'Koh', title: 'The Face Stealer', card: 'Koh, the Face Stealer', focus: '50% 25%'},
    gaang: {name: 'Team Avatar', title: 'The Gaang', card: 'Suki, Kyoshi Warrior', focus: '50% 25%'},
    ozai: {name: 'Ozai', title: 'The Phoenix King', card: 'Ozai, the Phoenix King', focus: '50% 25%'},
    arana: {name: 'Araña', title: 'Heart of the Spider', card: 'Araña, Heart of the Spider', focus: '50% 25%'},
    totems: {name: 'The Spider-Totems', title: 'Hunters of Spiders', card: 'Spider-Rex, Daring Dino', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Web-Slinging', difficulty: 'Easy', rewardSet: 'spm', teaches: ['Web-slinging'],
      blurb: 'A photographer on a rooftop, a gang at the corner and a camera that needs film.',
      hero: {who: 'peter', deck: {label: 'tribute', name: 'Friendly Neighborhood', colors: 'W', list: `
3 Peter Parker // Amazing Spider-Man
2 Spider-Man, Web-Slinger
3 Aunt May
4 Web-Shooters
4 Daily Bugle Reporters
4 Web Up
2 Flash Thompson, Spider-Fan
4 Earth Kingdom Jailer
4 Glider Kids
4 Wild Pack Squad
2 Selfless Police Captain
24 Plains`}},
      villain: {who: 'crooks', deck: {label: 'tribute', name: 'The Wild Pack', colors: 'B', list: `
4 Common Crook
4 Inner Demons Gangsters
3 Merciless Enforcers
2 Tombstone, Career Criminal
2 Scorpion's Sting
4 Venomized Cat
4 Hog-Monkey
4 Fire Nation Engineer
4 Pirate Peddlers
4 Fire Navy Trebuchet
1 Corrupt Court Official
24 Swamp`}},
      scene: [q('peter', 'This batch of web fluid will just have to wait!'),
        s('peter', 'Web-slinging: cast it for its web cost by returning a tapped creature to your hand. A swing, a reset and a ready ambush.')],
      villainScene: [q('crooks', "Don't be a hero, Gary! We don't get paid enough for a scrap with Spider-Man!"),
        s('crooks', 'The Wild Pack: one corner, three crooks and nobody wants to be first.')],
      cues: {hero: cue('Time to swing.', 'Thwip!', 'Too many of them...', 'Another night, another save.', 'Back to the rooftops...', 'Web-sling a tapped creature to recast it cheaply.'),
        villain: cue('Stay low.', 'Rush him!', 'He is too fast...', 'We got him!', 'Run!')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'Mayhem', difficulty: 'Easy', rewardSet: 'spm', teaches: ['Mayhem'],
      blurb: 'A punk spider with a guitar, a symbiote that learned the wrong lesson and a rooftop concert.',
      hero: {who: 'gwen', deck: {label: 'tribute', name: "Spider-Punk's Riot", colors: 'R', list: `
3 Spider-Punk
3 Spider-Gwen, Free Spirit
3 Gwen Stacy // Ghost-Spider
4 Shock
4 Angry Rabble
4 Electro's Bolt
2 Spider-Islanders
4 Boar-q-pine
4 Treetop Freedom Fighters
4 Taxi Driver
1 Superior Foes of Spider-Man
24 Mountain`}},
      villain: {who: 'symbiotes', deck: {label: 'tribute', name: 'The Symbiotes', colors: 'B', list: `
3 Gwenom, Remorseless
3 Venom, Evil Unleashed
4 Venomized Cat
2 Venom's Hunger
1 Alien Symbiosis
4 Fire Nation Engineer
4 Wolfbat
4 Fire Navy Trebuchet
4 Pirate Peddlers
4 Common Crook
3 Hog-Monkey
24 Swamp`}},
      scene: [q('gwen', 'Disrespect authority. Smash the system.'),
        s('gwen', 'Mayhem: if a card was discarded this turn, you may cast it from your graveyard right away. Use it before the turn ends.')],
      villainScene: [q('symbiotes', 'We like seeing fear in our victim\'s eyes.'),
        s('symbiotes', 'Sinner takes all. The symbiote does not need a reason.')],
      cues: {hero: cue('Smash the system.', 'Riot!', 'The feedback is killing us...', 'Encore!', 'Silenced...', 'Discard, then cast it from the graveyard.'),
        villain: cue('We hunger.', 'Take it!', 'We bleed...', 'We win.', 'We fade...')}},
    {slot: 3, mood: 'rival', kind: 'Rival', title: 'Doctor Octopus', difficulty: 'Normal', rewardSet: 'spm', teaches: ['Tokens'],
      blurb: 'Four arms, one plan and a lab full of henchmen who want out.',
      hero: {who: 'mj', deck: {label: 'tribute', name: "Parker's Team-Up", colors: 'GW', list: `
3 Mary Jane Watson
3 Silk, Web Weaver
3 Spider-Girl, Legacy Hero
4 Gallant Citizen
4 Web-Warriors
4 Terrific Team-Up
4 Avatar Enthusiasts
4 Water Tribe Captain
4 Ostrich-Horse
3 White Lotus Reinforcements
12 Forest
12 Plains`}},
      villain: {who: 'ock', deck: {label: 'tribute', name: "Doc Ock's Gang", colors: 'UB', list: `
3 Doctor Octopus, Master Planner
3 Doc Ock, Sinister Scientist
4 Doc Ock's Henchmen
4 Oscorp Research Team
4 Flying Octobot
2 Lady Octopus, Inspired Inventor
4 Wolfbat
4 North Pole Patrol
4 Fire Navy Trebuchet
4 Common Crook
12 Island
12 Swamp`}},
      scene: [q('mj', 'Charismatic and confident, Mary Jane was born for the limelight.'),
        s('mj', 'Tokens are creatures without a card behind them. Make a crowd and ride it to the finish.')],
      villainScene: [q('ock', 'Soon all will cower before the superior intellect of Doctor Octopus!'),
        s('ock', 'The Master Planner has a plan. The henchmen have a union.')],
      cues: {hero: cue('Team up.', 'All together!', 'The arms are everywhere...', 'Plans foiled.', 'Overpowered...', 'Fill the board with tokens.'),
        villain: cue('Superior intellect.', 'Tentacles!', 'A setback...', 'Cower!', 'Impossible...')}},
    {slot: 4, mood: 'boss', kind: 'Boss', title: 'The Green Goblin', difficulty: 'Hard', rewardSet: 'spm', teaches: ['Combat math'],
      blurb: 'A glider, a pumpkin bomb and a laugh that carries across the rooftops.',
      hero: {who: 'spiderverse', deck: {label: 'tribute', name: 'Spider-Verse United', colors: 'GW', list: `
3 Spiders-Man, Heroic Horde
3 Spider-UK
3 Spider-Man, Brooklyn Visionary
3 Miles Morales // Ultimate Spider-Man
3 Spider-Ham, Peter Porker
2 Terrific Team-Up
1 Kapow!
4 Avatar Enthusiasts
4 Invasion Reinforcements
4 Earth Kingdom General
4 Ostrich-Horse
2 Selfless Police Captain
12 Forest
12 Plains`}},
      villain: {who: 'goblin', deck: {label: 'tribute', name: "The Goblin's Gambit", colors: 'BR', list: `
3 Ultimate Green Goblin
2 Green Goblin, Revenant
3 Hobgoblin, Mantled Marauder
4 Raging Goblinoids
4 Pumpkin Bombardment
4 Shadow of the Goblin
4 Maximum Carnage
4 Tiger-Dillo
4 Superior Foes of Spider-Man
4 Vindictive Warden
12 Swamp
12 Mountain`}},
      scene: [q('spiderverse', 'Spiders across the Multiverse are dying. I must keep them safe.'),
        s('spiderverse', 'Combat math: count the blocks and the trick before you commit. A pumpkin bomb ends a bad attack.')],
      villainScene: [q('goblin', 'The Green Goblin lives again!'),
        s('goblin', 'Oscorp has a glider, a bomb and a very long grudge.')],
      cues: {hero: cue('Spiders, together.', 'Web them!', 'The bombs keep coming...', 'The Goblin is down.', 'Cackling in the dark...', 'Count before you swing.'),
        villain: cue('Ha ha ha!', 'Pumpkin bomb!', 'Hold on...', 'The city is mine.', 'No...')}},
    {slot: 5, mood: 'tension', kind: 'Arrival', title: 'The Four Nations', difficulty: 'Easy', rewardSet: 'tla', teaches: ['Bending'],
      blurb: 'The last Airbender wakes in a world where the Fire Nation has been waiting a hundred years.',
      hero: {who: 'aang', deck: {label: 'tribute', name: 'Team Avatar', colors: 'W', list: `
3 Aang, the Last Airbender
2 Appa, Loyal Sky Bison
3 Momo, Friendly Flier
4 Kyoshi Warriors
4 Glider Kids
4 Airbending Lesson
2 Enter the Avatar State
4 Avatar Enthusiasts
4 Wild Pack Squad
4 Jeong Jeong's Deserters
2 Water Tribe Captain
24 Plains`}},
      villain: {who: 'fire', deck: {label: 'tribute', name: 'The Fire Nation Raiders', colors: 'R', list: `
4 Fire Nation Raider
4 Fire Nation Cadets
4 Firebending Student
4 Fire Nation Attacks
4 Lightning Strike
3 Combustion Man
4 Superior Foes of Spider-Man
4 Treetop Freedom Fighters
4 Fire Sages
1 Boar-q-pine
24 Mountain`}},
      scene: [q('aang', 'When the world needed him most, the Avatar returned.'),
        s('aang', 'Bending: each nation has its own element and its own trick. Airbending sends a creature away to be cast again for two.')],
      villainScene: [q('fire', 'We are the sons and daughters of fire, the superior element!'),
        s('fire', 'The raiders are young, fast and very sure of themselves.')],
      cues: {hero: cue('Let us go.', 'Airbend!', 'The fire is close...', 'The wind is with us.', 'Too hot...', 'Airbend to reset a creature.'),
        villain: cue('For the Fire Lord!', 'Burn it!', 'The cadets falter...', 'Victory!', 'Fall back!')}},
    {slot: 6, mood: 'comic', kind: 'Lesson', title: 'Earthbending', difficulty: 'Normal', rewardSet: 'tla', teaches: ['Earthbend'],
      blurb: 'The King of Omashu has a puzzle for you, and the Dai Li have a different plan.',
      hero: {who: 'bumi', deck: {label: 'tribute', name: 'The Earth Kingdom', colors: 'G', list: `
3 Bumi, King of Three Trials
3 Haru, Hidden Talent
3 The Earth King
4 Earth Kingdom General
4 Badgermole Cub
4 Earthbending Lesson
3 Earth Rumble
4 Supportive Parents
4 Ostrich-Horse
4 Rebellious Captives
24 Forest`}},
      villain: {who: 'dailee', deck: {label: 'tribute', name: 'The Dai Li', colors: 'BG', list: `
3 Long Feng, Grand Secretariat
4 Dai Li Agents
4 Beifong's Bounty Hunters
3 Joo Dee, One of Many
4 Earth Village Ruffians
4 Dai Li Indoctrination
4 Ostrich-Horse
4 Wolfbat
4 Guy in the Chair
2 Pirate Peddlers
12 Swamp
12 Forest`}},
      scene: [q('bumi', "You thought I was a frail old man, but I'm the most powerful Earthbender you'll ever see."),
        s('bumi', 'Earthbend: a land becomes a creature with counters, and it comes back if it dies. Rock is a stubborn element.')],
      villainScene: [q('dailee', 'In silencing talk of conflict, Ba Sing Se remains a peaceful, orderly utopia.'),
        s('dailee', 'The Dai Li do not fight in the open. They arrange things.')],
      cues: {hero: cue('Rock is stubborn.', 'Earthbend!', 'The agents close in...', 'Omashu stands.', 'Buried...', 'Earthbend a land into a fighter.'),
        villain: cue('Order.', 'Seize them!', 'A flaw in the plan...', 'All is quiet.', 'The wall cracks...')}},
    {slot: 7, mood: 'rival', kind: 'Rival', title: 'Koh, the Face Stealer', difficulty: 'Normal', rewardSet: 'tla', teaches: ['Locking creatures down'],
      blurb: 'Show no emotion in the spirit swamp. Koh takes faces, and koh is patient.',
      hero: {who: 'katara', deck: {label: 'tribute', name: 'The Water Tribe', colors: 'U', list: `
3 Katara, Bending Prodigy
3 Master Pakku
3 Gran-Gran
4 Flexible Waterbender
4 Waterbending Lesson
4 Rowdy Snowballers
3 Geyser Leaper
4 Doc Ock's Henchmen
4 First-Time Flyer
4 North Pole Patrol
24 Island`}},
      villain: {who: 'koh', deck: {label: 'tribute', name: 'Koh and the Spirits', colors: 'B', list: `
3 Koh, the Face Stealer
3 Lo and Li, Twin Tutors
4 Canyon Crawler
4 Cat-Gator
4 Foggy Swamp Visions
4 Corrupt Court Official
2 Heartless Act
4 Fire Nation Engineer
4 Venomized Cat
4 Pirate Peddlers
24 Swamp`}},
      scene: [q('katara', "You can't knock me down!"),
        q('katara', 'Just push and pull the water—like this.'),
        s('katara', 'Locking creatures down: tap them, stun them, or take their attack away. Koh will lock you the same way.')],
      villainScene: [s('koh', 'I take faces. I do not hurry.'),
        s('koh', 'The swamp is old. The swamp remembers every face it has taken.')],
      cues: {hero: cue('Push and pull.', 'Waterbend!', 'He is taking faces...', 'The spirit is calm.', 'Lost in the swamp...', 'Lock his big creature before it attacks.'),
        villain: cue('Patience.', 'Your face!', 'Stirring...', 'Mine.', 'Gone...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Phoenix King', difficulty: 'Hard', rewardSet: 'tla', teaches: ['Direct damage'],
      blurb: 'Sozin\'s Comet burns overhead. The Fire Lord has promised to end the war by ending the world.',
      hero: {who: 'gaang', deck: {label: 'tribute', name: 'The Gaang', colors: 'GW', list: `
1 Suki, Kyoshi Warrior
1 Earth King's Lieutenant
2 White Lotus Reinforcements
4 Earth Kingdom Soldier
1 Hakoda, Selfless Commander
2 Aang, the Last Airbender
1 Enter the Avatar State
4 Avatar Enthusiasts
4 Selfless Police Captain
4 Ostrich-Horse
4 Wild Pack Squad
4 Jeong Jeong's Deserters
4 Glider Kids
12 Forest
12 Plains`}},
      villain: {who: 'ozai', deck: {label: 'tribute', name: 'The Phoenix King', colors: 'BR', list: `
3 Ozai, the Phoenix King
3 Zhao, Ruthless Admiral
3 Azula, On the Hunt
4 Vindictive Warden
4 Cruel Administrator
4 Fire Navy Trebuchet
3 Zuko, Conflicted
4 Tiger-Dillo
4 Superior Foes of Spider-Man
4 Merchant of Many Hats
12 Swamp
12 Mountain`}},
      scene: [q('gaang', "I'm okay. Just finish the mission!"),
        q('aang', 'When the world needed him most, the Avatar returned.'),
        s('gaang', 'Direct damage skips combat. Use it to finish him when the board is stuck.')],
      villainScene: [q('ozai', 'Out of the ashes, a new world will be born.'),
        q('ozai', 'You will learn respect, and suffering will be your teacher.')],
      cues: {hero: cue('Together, now.', 'Avatar State!', 'The comet is too strong...', 'Peace.', 'The world burns...', 'Burn him out when the board is stuck.'),
        villain: cue('Bow.', 'Phoenix fire!', 'Impossible...', 'The world is mine.', 'No...')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'The Spider-Totems', difficulty: 'Hard', rewardSet: 'spm', rewardCard: 'Cosmic Spider-Man', mood: 'boss',
      teaches: ['Trample'],
      archive: {deck: 'The Spider-Totems', when: 'Fall 2025', format: 'Story archive, no tournament list.',
        what: 'A green deck of hunters and big creatures from the set: Spider-Rex, Lizard, Kraven\'s Cats.',
        why: 'It stands for the hunt that follows every Spider, not a list anyone won with.',
        beat: 'Block the big ones, chump the pack and burn out the totem.',
        after: 'Nothing; this is the optional superboss at the end of the story.'},
      blurb: 'A hunter has been tracking every spider in the Multiverse. This one is the last on his list.',
      hero: {who: 'arana', deck: {label: 'tribute', name: 'Araña and the Spiders', colors: 'RW', list: `
2 Araña, Heart of the Spider
4 Sudden Strike
4 Spectacular Tactics
3 Shock
4 Glider Kids
4 Avatar Enthusiasts
4 Treetop Freedom Fighters
4 Water Tribe Captain
4 Superior Foes of Spider-Man
3 Invasion Reinforcements
12 Mountain
12 Plains`}},
      villain: {who: 'totems', deck: {label: 'tribute', name: 'The Spider-Totems', note: 'Built from cards in this act\'s sets only. No tournament list is copied.', colors: 'G', list: `
3 Spider-Rex, Daring Dino
3 Spider-Ham, Peter Porker
3 Lizard, Connors's Curse
4 Kraven's Cats
4 Lurking Lizards
4 Grow Extra Arms
4 Kraven's Last Hunt
4 Walltop Sentries
4 Raucous Audience
3 Ostrich-Horse
24 Forest`}},
      scene: [q('arana', "I'm creating an all-new legacy."),
        s('totems', 'The hunter seeks only the greatest prey.')],
      villainScene: [q('totems', 'I have found honor, not in the civilized, but in the primal.')],
      cues: {hero: cue('Stay quick.', 'Strike!', 'He is faster than us...', 'The hunt is over.', 'Caught...', 'Chump the big ones, burn the pack.'),
        villain: cue('The hunt begins.', 'Take them!', 'Prey...', 'The hunt ends.', 'Escaped...')},
      after: [s('stage', 'Recorded: the last spider escapes the hunt. The Omenpaths close.')]},
  ],
};
