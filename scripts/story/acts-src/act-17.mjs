// Act 17: The Eldrazi Rise (Zendikar, Worldwake, Rise of the Eldrazi, Magic 2011). Story and dialogue:
// /mnt/project-files/story/act-17-script.md (generated from this file). Land set: zen.
// Zendikar is a plane of adventure: the land itself moves in storms called the Roil, and floating stones called hedrons
// hang over every ruin. Nobody alive remembers what the hedrons are for. They are a prison. Long ago Sorin Markov,
// Nahiri and Ugin bound three Eldrazi titans here. In Rise of the Eldrazi, Chandra, Sarkhan and Jace fight at the Eye of
// Ugin and wake the prison; Nissa breaks the last hedron believing it will send the titans away. Every quoted line is
// real flavor text from Zendikar block or Magic 2011; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'eldrazi-wake-expedition',
  era: '2010-07-16',
  intro: [s('stage', 'Zendikar. The land here moves. Storms of stone and water called the Roil tear forests up and drop mountains into the sea.'),
    q('stage', 'The Roil redraws the world as it passes, leaving only the hedrons unchanged.'),
    s('stage', 'Expeditions from every race hunt for relics in the ruins under the hedrons. Nobody asks what the hedrons are holding down.')],
  finale: [q('stage', 'An eye closes. A race awakens.'),
    s('stage', 'Emrakul\'s brood is broken on the slopes, but the titans are free. Ulamog and Kozilek walk the continents, and everything they touch turns to chalk.'),
    s('sorin', 'Ten thousand years in that prison. Nahiri\'s stones, Ugin\'s plan, my blood. And three children with a map undid it in an afternoon.'),
    s('nissa', 'I broke the hedron. I thought it would send them away. I will spend the rest of my life fixing that.'),
    s('gideon', 'Then you won\'t spend it alone.')],
  villainFinale: [s('stage', 'The hedrons fall like hail. Three shapes larger than mountains rise out of the ground.'),
    q('stage', 'Wordlessly it leads its abhorrent brood.'),
    s('stage', 'Ulamog and Kozilek begin to feed. Emrakul, the last and largest to wake, does not.'),
    s('stage', 'She drifts upward until the clouds close around her. When the planeswalkers come back to count the titans, they will only ever find two.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Explore'},
    nissa: {name: 'Nissa Revane', title: 'Joraga Elf', card: 'Nissa Revane', focus: '50% 25%'},
    guide: {name: 'Goblin Guide', title: 'Akoum, for a price', card: 'Goblin Guide', focus: '50% 30%'},
    rana: {name: 'Rana Cloudwake', title: 'Kor skyfisher', card: 'Kor Skyfisher', focus: '50% 25%'},
    sorin: {name: 'Sorin Markov', title: 'Planeswalker', card: 'Sorin Markov', focus: '50% 25%'},
    expedition: {name: 'Kazandu Expedition', title: 'Allies for hire', card: 'Kazandu Blademaster', focus: '50% 25%'},
    sovereign: {name: 'Merfolk Sovereign', title: 'Seeker of Emeria', card: 'Merfolk Sovereign', focus: '50% 25%'},
    chandra: {name: 'Chandra Nalaar', title: 'Planeswalker', card: 'Chandra Nalaar', focus: '50% 25%'},
    sarkhan: {name: 'Sarkhan', title: 'The Mad', card: 'Sarkhan the Mad', focus: '50% 25%'},
    anowon: {name: 'Anowon', title: 'The Ruin Sage', card: 'Anowon, the Ruin Sage', focus: '50% 25%'},
    gideon: {name: 'Gideon Jura', title: 'Planeswalker', card: 'Gideon Jura', focus: '50% 25%'},
    brood: {name: 'The Brood', title: 'Spawn of Ulamog', card: 'Pawn of Ulamog', focus: '50% 30%'},
    hawkBlade: {name: 'Hawk-Blade', title: 'Spring 2010', card: 'Stoneforge Mystic', focus: '50% 25%'},
    boros: {name: 'Boros Landfall', title: 'Spring 2010', card: 'Steppe Lynx', focus: '50% 30%'},
    vampires: {name: 'Vampire Aggro', title: 'Summer 2010', card: 'Vampire Nighthawk', focus: '50% 25%'},
    valakut: {name: 'Valakut Ramp', title: 'Summer 2010', card: 'Primeval Titan', focus: '50% 25%'},
    emrakul: {name: 'Emrakul', title: 'The Aeons Torn', card: 'Emrakul, the Aeons Torn', focus: '50% 30%'},
    control: {name: 'UW Control', title: '2010 to 2011', card: 'Jace, the Mind Sculptor', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'Every Land an Expedition', difficulty: 'Easy', rewardSet: 'zen', teaches: ['Landfall'],
      blurb: 'You arrive on Zendikar in the jungles of Bala Ged, where the elf Nissa Revane is guarding her tribe\'s trail. Goblin raiders from the Akoum mountains want what is at the end of it.',
      hero: {who: 'nissa', deck: {label: 'tribute', name: 'The Joraga Trail', colors: 'G', list: `
2 Nissa Revane
4 Nissa's Chosen
4 Llanowar Elves
4 Elvish Archdruid
4 Oran-Rief Survivalist
4 Grazing Gladehart
4 Territorial Baloth
2 Pelakka Wurm
4 Joraga Treespeaker
4 Giant Growth
24 Forest`}},
      villain: {who: 'guide', deck: {label: 'tribute', name: 'The Akoum Raiders', colors: 'R', list: `
4 Goblin Guide
4 Goblin Bushwhacker
4 Plated Geopede
4 Lightning Bolt
4 Burst Lightning
4 Goblin Shortcutter
4 Bladetusk Boar
4 Torch Slinger
4 Shatterskull Giant
24 Mountain`}},
      scene: [q('nissa', 'When the land is angry, so are they.'),
        s('nissa', 'Landfall: every time you play a land, some creatures here get stronger or something happens. On Zendikar the ground fights for whoever walks it well. Play a land every turn.')],
      villainScene: [q('guide', 'I\'ve been all over this world. I even remember some of those places.'),
        q('stage', 'Those who dare stand in its path are either brave or mindless. Or in the case of goblins, both.')],
      cues: {hero: cue('The land is with us.', 'Landfall!', 'They burn the trail...', 'Back to the mountains.', 'The trail is lost...', 'Land first, then fight.'),
        villain: cue('Shiny things this way!', 'Charge! Everybody charge!', 'Who brought the trees?!', 'Loot!', 'Run! The forest is angry!')},
      after: [s('nissa', 'The hedrons above the trail hum louder every season. My people say it means nothing. My people say a lot of things.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Holy Relic', difficulty: 'Easy', rewardSet: 'zen', teaches: ['Quests'],
      blurb: 'The kor skyfishers of Makindi are nomads who climb the hedrons with ropes and hooks. A vampire planeswalker named Sorin Markov has come to Zendikar to inspect those same stones, and he does not like being followed.',
      hero: {who: 'rana', deck: {label: 'tribute', name: 'The Skyfishers of Makindi', colors: 'W', list: `
4 Steppe Lynx
4 Kor Skyfisher
4 Kor Duelist
4 Knight of Cliffhaven
2 Quest for the Holy Relic
4 Kor Aeronaut
4 Journey to Nowhere
4 Squadron Hawk
4 Kor Hookmaster
24 Plains
2 Honor of the Pure`}},
      villain: {who: 'sorin', deck: {label: 'tribute', name: 'The Blood of Malakir', colors: 'B', list: `
2 Sorin Markov
2 Vampire Hexmage
4 Bloodghast
2 Gatekeeper of Malakir
1 Vampire Nighthawk
4 Child of Night
2 Disfigure
4 Bloodthrone Vampire
4 Kalastria Highborn
2 Vampire's Bite
29 Swamp
4 Pulse Tracker`}},
      scene: [q('rana', 'Sometimes I snare the unexpected, but I know its purpose will be revealed in time.'),
        s('rana', 'Quests: a quest enchantment counts your progress, one counter at a time. Fill it and it pays you a reward. Ours counts our landings.')],
      villainScene: [q('sorin', 'The vampires of this world don\'t know the pleasures of hunger. They gorge themselves without savoring the kill.'),
        s('sorin', 'I made these stones. Or helped to. I would like to see whether they still hold, without a kor hanging off every one of them.')],
      cues: {hero: cue('Ropes out.', 'The quest is done!', 'Too many fangs...', 'The relic is ours.', 'Cut the lines...', 'Count every landing.'),
        villain: cue('Climb elsewhere.', 'Hunger is a craft.', 'Tiresome little climbers.', 'The stones are mine to tend.', 'You are stronger than you look. Pity.')},
      after: [s('sorin', 'The hedrons are holding. For now. Stay off them, skyfisher, and you might live long enough to understand why.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'The Race to Halimar', difficulty: 'Easy', rewardSet: 'zen', teaches: ['Allies'],
      blurb: 'A relic map has been found, and every expedition on Zendikar wants the treasure at its end. A party of sell-swords from Kazandu races a band of merfolk who believe the ruins belong to their sky goddess, Emeria.',
      hero: {who: 'expedition', deck: {label: 'tribute', name: 'The Kazandu Expedition', colors: 'GW', list: `
4 Kazandu Blademaster
4 Talus Paladin
4 Makindi Shieldmate
4 Ondu Cleric
4 Oran-Rief Survivalist
4 Tajuru Archer
4 Turntimber Ranger
4 Journey to Nowhere
4 Harabaz Druid
12 Plains
12 Forest`}},
      villain: {who: 'sovereign', deck: {label: 'tribute', name: 'The Seekers of Emeria', colors: 'U', list: `
4 Merfolk Sovereign
4 Coralhelm Commander
4 Merfolk Seastalkers
4 Umara Raptor
4 Halimar Wavewatch
4 Lighthouse Chronologist
4 Into the Roil
4 Mana Leak
4 Merfolk Wayfinder
24 Island`}},
      scene: [q('expedition', 'If you hire a sell-sword, you\'d better watch your back. Hire me, and I\'ll watch it for you.'),
        s('expedition', 'Allies: every time another Ally joins your party, every Ally already there gets a bonus. Hire more swords and they all get better.')],
      villainScene: [q('sovereign', 'Be like the sea: flow around that which is unmovable; for everything else, crash into it unrelentingly.'),
        q('stage', 'Do they seek knowledge or wealth? Are they bandits or benefactors? It depends on who is chanting the tale.')],
      cues: {hero: cue('Party up!', 'More swords, more shares!', 'They\'re rolling us up...', 'Treasure split six ways!', 'Nobody gets paid...', 'Hire before you fight.'),
        villain: cue('Emeria guides us.', 'The tide rises!', 'Roil tide! Roil tide!', 'The goddess provides.', 'The sea will return.')},
      after: [s('expedition', 'We got there first. The map was gone. Somebody named Chandra had it, and she was headed for a place called the Eye of Ugin.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Eye of Ugin', difficulty: 'Normal', rewardSet: 'roe', teaches: ['Level up'],
      blurb: 'Chandra Nalaar, a pyromancer from another plane, has the map and reaches the Eye of Ugin, a chamber at the heart of Zendikar. Sarkhan Vol is waiting there for her. He was sent by Nicol Bolas, and he has not been sane for some time.',
      hero: {who: 'chandra', deck: {label: 'tribute', name: 'Chandra\'s Fire', colors: 'R', list: `
2 Chandra Nalaar
4 Goblin Guide
4 Plated Geopede
4 Lightning Bolt
4 Burst Lightning
4 Searing Blaze
4 Fireball
4 Ember Hauler
4 Staggershock
2 Inferno Titan
24 Mountain`}},
      villain: {who: 'sarkhan', deck: {label: 'tribute', name: 'Sarkhan\'s Servants', colors: 'BR', list: `
2 Sarkhan the Mad
4 Kargan Dragonlord
4 Null Champion
4 Guul Draz Assassin
4 Brimstone Mage
4 Lord of Shatterskull Pass
4 Hellcarver Demon
4 Doom Blade
4 Staggershock
2 Bloodthrone Vampire
12 Swamp
12 Mountain`}},
      scene: [q('anowon', 'So many have died in search of that map. And now it appears in the hands of the arrogant child Chandra Nalaar.'),
        q('chandra', 'I like it here. You always get a little more for your mana.'),
        s('chandra', 'Level up: some creatures here can be paid into again and again. Each payment adds a level, and at enough levels they turn into something else. Leave one alone and it grows.')],
      villainScene: [q('sarkhan', 'Rage courses in every heart, yearning to betray its rational prison.'),
        s('sarkhan', 'The dragon wants the Eye opened, girl. Burn the door down for me.')],
      cues: {hero: cue('Back off, lizard.', 'Everything burns!', 'He keeps getting bigger...', 'That\'s my map.', 'Too hot... even for me...', 'Kill the leveler early.'),
        villain: cue('The dragon speaks.', 'Wings! WINGS!', 'The voices... quiet...', 'Open the Eye.', 'The dragon... lied...')},
      after: [s('stage', 'Chandra and Sarkhan\'s fire fills the chamber. Jace Beleren arrives, chasing Chandra, and adds his own power to the fight.'),
        s('stage', 'The three of them are the first people to work magic inside the Eye of Ugin in ten thousand years. The walls begin to glow.'),
        q('stage', 'An eye closes. A race awakens.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Brood', difficulty: 'Normal', rewardSet: 'roe', teaches: ['Eldrazi Spawn'],
      blurb: 'The hedrons are falling. Out of the ground under them comes the brood of the Eldrazi: things with no faces that eat the colour out of the land. Gideon Jura, a soldier from another plane, is the first to stand in their way.',
      hero: {who: 'gideon', deck: {label: 'tribute', name: 'Gideon\'s Line', colors: 'W', list: `
2 Student of Warfare
4 Elite Vanguard
2 Knight of Cliffhaven
4 Kor Skyfisher
2 Squadron Hawk
1 Baneslayer Angel
2 Journey to Nowhere
4 Makindi Shieldmate
4 Kabira Crossroads
20 Plains
3 Ajani's Pridemate
4 Kor Hookmaster
4 Kor Duelist
4 Kor Aeronaut`}},
      villain: {who: 'brood', deck: {label: 'tribute', name: 'The Brood of Ulamog', colors: 'BG', list: `
4 Pawn of Ulamog
4 Kozilek's Predator
4 Ulamog's Crusher
4 Vampire Nighthawk
4 Hand of Emrakul
4 Bloodthrone Vampire
12 Swamp
12 Forest
4 Gatekeeper of Malakir
4 Disfigure
4 Nest Invader`}},
      scene: [q('gideon', '\'Invincible\' is just a word.'),
        s('gideon', 'Eldrazi Spawn: the brood leaves little 0/1 tokens everywhere. They can be sacrificed for mana. Every spawn you ignore is a step toward something much bigger. Kill the spawners.')],
      villainScene: [q('stage', 'It nurtures its masters\' glorious future.'),
        q('stage', 'The brood spread far faster than we could kill it. I fear the worst is yet to come.')],
      cues: {hero: cue('Hold the line.', 'Advance!', 'There\'s no end to them...', 'This line holds.', 'Fall back... regroup...', 'Kill the source, not the spawn.'),
        villain: cue('[the ground splits]', '[the brood multiplies]', '[a hollow shriek]', '[chalk and silence]', '[the brood scatters]')},
      after: [s('gideon', 'I have fought gods and monsters. These are neither. There is nothing in them to fight. Only hunger.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Hawk-Blade', difficulty: 'Normal', rewardSet: 'wwk', teaches: ['Equipment'],
      blurb: 'Spring 2010. Worldwake brought Jace, the Mind Sculptor and Stoneforge Mystic, and blue-white decks started grinding everyone out with Squadron Hawks carrying equipment. The deck to beat was Boros landfall, fast and red.',
      hero: {who: 'hawkBlade', deck: {label: 'tribute', name: 'Hawk-Blade', colors: 'WU', archetype: 'Control', list: `
4 Stoneforge Mystic
4 Squadron Hawk
4 Kor Skyfisher
4 Jace, the Mind Sculptor
4 Adventuring Gear
4 Wall of Omens
4 Day of Judgment
4 Mana Leak
2 Basilisk Collar
2 Baneslayer Angel
4 Celestial Colonnade
4 Glacial Fortress
8 Plains
8 Island`}},
      villain: {who: 'boros', deck: {label: 'tribute', name: 'Boros Landfall', colors: 'RW', archetype: 'Aggro', list: `
4 Goblin Guide
4 Steppe Lynx
4 Plated Geopede
4 Goblin Bushwhacker
4 Lightning Bolt
4 Burst Lightning
4 Kor Skyfisher
4 Elite Vanguard
4 Journey to Nowhere
4 Arid Mesa
4 Scalding Tarn
8 Mountain
8 Plains`}},
      scene: [q('stage', 'An explorer\'s essentials in a wild world.'),
        s('you', 'Survive the first five turns. After that, Jace and the Hawks bury them in cards.')],
      villainScene: [q('stage', 'Nothing quickens the predator\'s blood like the unfamiliar scents of new hunting grounds and the mewling cries of new prey.')],
      cues: {hero: cue('Brainstorm. Again.', 'Fetch the gear!', 'Too fast...', 'Out of gas, are we?', 'Burned out...', 'Survive, then take over.'),
        villain: cue('[a fetchland cracks]', '[landfall!]', '[out of burn]', '[burned through]', '[the hawks keep coming]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Valakut', difficulty: 'Normal', rewardSet: 'm11', teaches: ['Deathtouch'],
      blurb: 'Summer 2010. Magic 2011 brought Primeval Titan, and green-red decks used it to fetch Valakut, the Molten Pinnacle, a land that burns the opponent whenever a Mountain arrives. Vampire aggro decks tried to win before the Titan landed.',
      hero: {who: 'vampires', deck: {label: 'tribute', name: 'Vampire Aggro', colors: 'B', archetype: 'Aggro', list: `
4 Bloodthrone Vampire
4 Bloodghast
4 Vampire Hexmage
4 Vampire Nighthawk
4 Gatekeeper of Malakir
4 Kalastria Highborn
4 Malakir Bloodwitch
4 Disfigure
4 Doom Blade
24 Swamp`}},
      villain: {who: 'valakut', deck: {label: 'tribute', name: 'Valakut Ramp', colors: 'RG', archetype: 'Ramp', list: `
4 Primeval Titan
4 Valakut, the Molten Pinnacle
4 Growth Spasm
4 Cultivate
4 Khalni Heart Expedition
4 Explore
4 Lightning Bolt
4 Oracle of Mul Daya
4 Harrow
4 Avenger of Zendikar
10 Mountain
10 Forest`}},
      scene: [q('stage', 'Some humans willingly offered up their blood, hoping it would grant the vampire families the strength to stave off the Eldrazi.'),
        s('you', 'They need six lands and a Titan. We need them dead before the sixth.')],
      villainScene: [q('valakut', 'When nature calls, *run*.')],
      cues: {hero: cue('Bite first.', 'Bloodthirst!', 'The mountain is waking...', 'Drained dry.', 'Titan...', 'Win before turn six.'),
        villain: cue('[a land, and another]', '[the Titan arrives]', '[the ramp stalls]', '[Valakut erupts]', '[the mountain goes cold]')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Emrakul, the Aeons Torn', difficulty: 'Hard', rewardSet: 'roe', rewardCard: 'Emrakul, the Aeons Torn', teaches: ['Annihilator'],
      blurb: 'At the Eye of Ugin, Nissa breaks the last hedron, believing it will send the titans away from Zendikar. It does the opposite. The largest of the three, Emrakul, rises over the jungle. Nissa and Gideon stand against her brood while Sorin goes looking for help.',
      hero: {who: 'nissa', deck: {label: 'tribute', name: 'Nissa and Gideon', colors: 'GW', list: `
2 Nissa Revane
4 Nissa's Chosen
4 Knight of Cliffhaven
4 Kor Skyfisher
4 Baneslayer Angel
4 Oran-Rief Survivalist
4 Kazandu Blademaster
4 Journey to Nowhere
4 Lotus Cobra
2 Day of Judgment
4 Sunpetal Grove
10 Plains
10 Forest`}},
      villain: {who: 'emrakul', deck: {label: 'tribute', name: 'The Aeons Torn', colors: 'G', archetype: 'Ramp', list: `
2 Emrakul, the Aeons Torn
4 Growth Spasm
4 Overgrown Battlement
4 Joraga Treespeaker
4 Ulamog's Crusher
4 Nest Invader
4 Kozilek's Predator
4 Eldrazi Monument
2 It That Betrays
4 Awakening Zone
24 Forest`}},
      scene: [q('stage', 'Our enemy is nothing less than the end of all life. We shall not want for allies.'),
        q('nissa', 'Why fight the world when you know who will win?'),
        s('gideon', 'Annihilator: when the big ones attack, you sacrifice permanents. Keep blockers and spare lands, and never let her swing twice.'),
        s('sorin', 'I am going to find Nahiri. Try not to let the plane die before I get back.')],
      villainScene: [q('stage', 'The ground erupted in time with the hedron\'s thrum, a dirge of the last days.'),
        q('stage', 'Whatever the Eldrazi\'s purpose is, it has nothing to do with something so insignificant as us.')],
      cues: {hero: cue('For Zendikar.', 'The land fights with us!', 'She\'s too big...', 'She\'s falling back!', 'Annihilated...', 'Keep spare permanents.'),
        villain: {...cue('[the sky darkens]', '[annihilator]', '[the brood falters]', '[the land turns to chalk]', '[she drifts away]'),
          half: {who: 'gideon', line: 'She bleeds. Keep pushing.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'The Mind Sculptor', difficulty: 'Hard', rewardSet: 'wwk', rewardCard: 'Jace, the Mind Sculptor', mood: 'boss',
      teaches: ['Playing around counterspells'],
      archive: {deck: 'UW Control with Jace, the Mind Sculptor', when: '2010 to 2011', format: 'Standard: Zendikar block, Magic 2011 and (later) Scars of Mirrodin.',
        what: 'A blue-white control deck that held off the board with Wall of Omens, Day of Judgment and counterspells, then won with Jace, the Mind Sculptor, a four-mana planeswalker that drew an extra card every turn and could bounce or lock out anything.',
        why: 'Jace dominated Standard for over a year. It sold for around a hundred dollars at its peak, and almost every top deck ran four.',
        beat: 'Attack Jace, not the player. Keep creatures on the board so he cannot sit there brainstorming in peace, and cast your threats in pairs so one counterspell is never enough.',
        after: 'Jace, the Mind Sculptor and Stoneforge Mystic were banned in Standard on 1 July 2011, the last time two cards were banned from Standard until 2017.'},
      blurb: 'Deep in the archive, the planeswalker that ran Standard for a year. You play the titans.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'The Three Titans', note: 'Emrakul, Ulamog and Kozilek in one Eldrazi ramp deck, one copy each. Built for this fight.', colors: 'G', archetype: 'Ramp', list: `
1 Emrakul, the Aeons Torn
1 Ulamog, the Infinite Gyre
1 Kozilek, Butcher of Truth
1 It That Betrays
4 Growth Spasm
4 Overgrown Battlement
4 Joraga Treespeaker
4 Nest Invader
4 Awakening Zone
4 Ulamog's Crusher
4 Explore
4 Cultivate
4 Eldrazi Temple
20 Forest`}},
      villain: {who: 'control', deck: {label: 'tribute', name: 'UW Control', note: 'Built from the 2010 Jace, the Mind Sculptor control lists using cards from this act\'s sets only. No single tournament list is copied.', colors: 'WU', archetype: 'Control', list: `
4 Jace, the Mind Sculptor
4 Wall of Omens
4 Day of Judgment
4 Mana Leak
2 Ajani Goldmane
4 Baneslayer Angel
4 Everflowing Chalice
2 Sun Titan
2 Frost Titan
2 Jace Beleren
4 Spreading Seas
4 Celestial Colonnade
4 Glacial Fortress
8 Island
8 Plains`}},
      scene: [q('stage', 'Each temple is a door to a horrible future.'),
        s('you', 'Fifteen mana, and nothing can counter Emrakul. Get there.')],
      villainScene: [q('stage', 'The fatal flaw in every plan is the assumption that you know more than your enemy.')],
      cues: {hero: cue('Ramp.', 'A titan wakes!', 'Countered again...', 'Annihilated.', 'Brainstormed out...', 'Make them answer twice.'),
        villain: cue('[Jace brainstorms]', '[fateseal]', '[out of counters]', '[the mind sculpted]', '[a titan they could not counter]')},
      after: [s('stage', 'Recorded: banned in Standard, 1 July 2011.')]},
  ],
};
