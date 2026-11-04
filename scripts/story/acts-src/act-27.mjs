// Act 27: The Immortal Sun (Ixalan, Rivals of Ixalan). Story and dialogue:
// /mnt/project-files/story/act-27-script.md (generated from this file). Land set: xln.
// Act 26 ended with Bolas walking away with his army. Four tribes now race for Orazca, the golden city, and the
// Immortal Sun inside it: the Legion of Dusk, the Brazen Coalition, the River Heralds and the Sun Empire. Jace has
// lost his memory and sails with Vraska, who is working for Bolas. At the end Jace and Vraska trap Azor, who built the
// Sun, and Jace remembers. Every quoted line is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'ixalan-sun-sea',
  era: '2017-09-29',
  intro: [s('stage', 'Ixalan, a plane of jungle and sea. Four peoples are racing for a golden city, and the sun at its heart.'),
    q('stage', 'The Legion of Dusk sailed from Torrezon in search of glory, riches, and the Immortal Sun.'),
    q('stage', 'The River Heralds would wreck a thousand ships to keep intruders from finding the golden city.'),
    s('stage', 'Jace Beleren has lost his memory. He sails with a pirate captain named Vraska, who has not told him everything.')],
  finale: [q('azor', 'Be still.'),
    q('stage', 'As the struggle raged for control of the Immortal Sun, the world grew dark under a blood-red sky.'),
    s('stage', 'Jace and Vraska trap Azor on a desert island, away from the Sun. Azor thought he was being kind.'),
    s('stage', 'Jace remembers who he is. Vraska remembers who she works for, and says nothing.')],
  villainFinale: [q('azor', 'Be still.'),
    s('stage', 'The Immortal Sun burns on, gold and hollow, and Azor keeps it.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Ixalan\'s Binding'},
    vraska: {name: 'Vraska', title: 'Captain of the Brazen Coalition', card: 'Vraska, Relic Seeker', focus: '50% 25%'},
    legion: {name: 'The Legion of Dusk', title: 'Conquistadors', card: 'Legion Conquistador', focus: '50% 30%'},
    adanto: {name: 'Adrian Adanto', title: 'Of Lujio', card: 'Legion\'s Landing // Adanto, the First Fort', focus: '50% 30%'},
    beckett: {name: 'Admiral Beckett Brass', title: 'Of the Brazen Coalition', card: 'Admiral Beckett Brass', focus: '50% 25%'},
    heralds: {name: 'The River Heralds', title: 'Merfolk of the Great River', card: 'Mist-Cloaked Herald', focus: '50% 30%'},
    huatli: {name: 'Huatli', title: 'Warrior Poet of the Sun Empire', card: 'Huatli, Dinosaur Knight', focus: '50% 25%'},
    coalition: {name: 'The Brazen Coalition', title: 'Pirates', card: 'Deadeye Plunderers', focus: '50% 30%'},
    jace: {name: 'Jace Beleren', title: 'Without his memory', card: 'Jace, Cunning Castaway', focus: '50% 25%'},
    vona: {name: 'Vona of Iedo', title: 'Butcher of Magan', card: 'Vona, Butcher of Magan', focus: '50% 25%'},
    kumena: {name: 'Shaper Kumena', title: 'Tyrant of Orazca', card: 'Kumena, Tyrant of Orazca', focus: '50% 25%'},
    tishana: {name: 'Tishana', title: 'Voice of Thunder', card: 'Tishana, Voice of Thunder', focus: '50% 25%'},
    dinos: {name: 'Dinosaurs', title: 'Autumn 2017', card: 'Regisaur Alpha', focus: '50% 30%'},
    vampires: {name: 'Vampires', title: 'Autumn 2017', card: 'Legion Lieutenant', focus: '50% 30%'},
    pirates: {name: 'Pirates', title: 'Autumn 2017', card: 'Dire Fleet Captain', focus: '50% 30%'},
    merfolk: {name: 'Merfolk', title: 'Autumn 2017', card: 'Kopala, Warden of Waves', focus: '50% 30%'},
    azor: {name: 'Azor', title: 'The Lawbringer', card: 'Azor, the Lawbringer', focus: '50% 25%'},
    brass: {name: 'Rekindling Phoenix', title: 'Winter 2018', card: 'Rekindling Phoenix', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Search for the Golden City', difficulty: 'Easy', rewardSet: 'xln', teaches: ['Explore'],
      blurb: 'You wake on Ixalan with Jace and Vraska. Search the jungle for the way to Orazca. The Legion of Dusk is searching too.',
      hero: {who: 'vraska', deck: {label: 'tribute', name: 'The Search Party', colors: 'BG', list: `
4 Merfolk Branchwalker
4 Jadelight Ranger
4 Jungle Creeper
2 Vraska's Conquistador
4 Deathgorge Scavenger
3 Lurking Chupacabra
3 Ravenous Chupacabra
4 Vraska's Contempt
4 Walk the Plank
4 Ranging Raptors
12 Forest
11 Swamp
1 Foul Orchard`}},
      villain: {who: 'legion', deck: {label: 'tribute', name: 'Legion Conquistadors', colors: 'W', list: `
2 Legion Conquistador
2 Skymarcher Aspirant
4 Sun Sentinel
2 Imperial Lancer
4 Legion's Landing
4 Raptor Companion
3 Bishop of Binding
3 Luminous Bonds
2 Divine Verdict
20 Plains
4 Exultant Skymarcher
4 Territorial Hammerskull
4 Snubhorn Sentry
2 Encampment Keeper`}},
      scene: [q('stage', 'For the first time in her life, Vraska tried to prevent death.'),
        q('stage', 'No lock of iron is a match for Vraska\'s will of stone.'),
        s('vraska', 'Explore: look at the top card of your library. A land goes to your hand. Anything else, and the creature grows and you choose whether to keep the card.')],
      villainScene: [q('adanto', 'I claim this land in the name of the queen.'),
        q('stage', 'The Legion of Dusk sailed from Torrezon in search of glory, riches, and the Immortal Sun.')],
      cues: {hero: cue('Into the jungle.', 'Explore!', 'We are lost...', 'Onward.', 'Turned back...', 'Explore for lands early.'),
        villain: cue('In the queen\'s name.', 'Claim it!', 'The jungle pushes back...', 'Ours.', 'Withdraw...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Plunder and Dance', difficulty: 'Easy', rewardSet: 'xln', teaches: ['Treasure'],
      blurb: 'Admiral Beckett Brass and the Brazen Coalition sail up the Great River. The River Heralds are waiting.',
      hero: {who: 'beckett', deck: {label: 'tribute', name: 'The Brazen Coalition', colors: 'BR', list: `
2 Daring Buccaneer
4 Dire Fleet Daredevil
3 Swaggering Corsair
4 Dire Fleet Captain
4 Fathom Fleet Captain
4 Captivating Crew
2 Fathom Fleet Cutthroat
3 Lightning Strike
2 Walk the Plank
4 Dire Fleet Neckbreaker
12 Mountain
10 Swamp
2 Cinder Barrens
3 Ravenous Chupacabra
1 Vraska's Contempt`}},
      villain: {who: 'heralds', deck: {label: 'tribute', name: 'The River Heralds', colors: 'UG', list: `
2 Mist-Cloaked Herald
4 Merfolk Mistbinder
4 Kumena's Speaker
4 Shapers of Nature
3 River Heralds' Boon
2 Silvergill Adept
4 Wildgrowth Walker
11 Forest
11 Island
2 Woodland Stream
4 Sworn Guardian
3 Shore Keeper
3 Shaper Apprentice
3 Sea Legs`}},
      scene: [q('beckett', 'You and your ship will make a fine addition to my fleet.'),
        q('stage', 'We sail. We plunder. Then we dance.'),
        s('beckett', 'Treasure: a token that sacrifices for one mana of any colour. Sail fast, spend it on the turn that matters.')],
      villainScene: [q('stage', 'The River Heralds would wreck a thousand ships to keep intruders from finding the golden city.'),
        q('stage', 'The same power that drives the river ever onward flows through the roots and branches\u2014to me.')],
      cues: {hero: cue('Hoist the sails.', 'Plunder!', 'Holed below the waterline...', 'To the loot.', 'Sunk...', 'Spend Treasure for a bigger turn.'),
        villain: cue('No ripples, no splashes.', 'The river rises.', 'Stay in the shallows...', 'Turned back.', 'They got through...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Huatli and the Raptors', difficulty: 'Easy', rewardSet: 'xln', teaches: ['Enrage'],
      blurb: 'Huatli, a warrior poet of the Sun Empire, rides her dinosaurs against pirates who have come ashore. Every dinosaur takes a hit and keeps coming.',
      hero: {who: 'huatli', deck: {label: 'tribute', name: 'The Sun Empire Hunt', colors: 'RG', list: `
4 Raptor Hatchling
4 Ripjaw Raptor
3 Regisaur Alpha
3 Raging Swordtooth
4 Sun-Collared Raptor
3 Ravenous Daggertooth
3 Frenzied Raptor
3 Needletooth Raptor
3 Charging Monstrosaur
3 Lightning Strike
3 Savage Stomp
12 Mountain
11 Forest
1 Rootbound Crag`}},
      villain: {who: 'coalition', deck: {label: 'tribute', name: 'Pirates Ashore', colors: 'UB', list: `
4 Kitesail Corsair
4 Warkite Marauder
4 Dire Fleet Poisoner
4 Deadeye Brawler
3 Shipwreck Looter
3 Deadeye Tormentor
3 Fathom Fleet Boarder
2 Deadeye Plunderers
3 Walk the Plank
2 Run Aground
12 Island
10 Swamp
2 Drowned Catacomb
2 Deadeye Rig-Hauler
2 River Sneak`}},
      scene: [q('huatli', 'Run like the wind, fierce one. The hunt has begun.'),
        q('stage', 'Every little hatchling has a parent\'s claws to guard it.'),
        s('huatli', 'Enrage: it triggers whenever the creature is dealt damage. Let your dinosaur take the hit and watch what happens.')],
      villainScene: [q('stage', 'Keep your friends close and your enemies within range.'),
        q('stage', 'Disputes within the Brazen Coalition can escalate from insult to broadside in the blink of an eye.')],
      cues: {hero: cue('Run, fierce one!', 'Enrage!', 'Too many cannons...', 'The hunt is done.', 'Driven off...', 'Let your dinosaurs take the damage.'),
        villain: cue('Fire at will.', 'Broadside!', 'Who fired that...', 'Plundered.', 'Back to the ship...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Vona of Iedo', difficulty: 'Normal', rewardSet: 'xln', teaches: ['Lifelink'],
      blurb: 'Jace, with no memory, learns that Vona of Iedo has led armies of conquest for four hundred years. She wants the golden city, and so do you.',
      hero: {who: 'jace', deck: {label: 'tribute', name: 'Jace and the Crew', colors: 'UB', list: `
3 Jace, Cunning Castaway
4 Kitesail Corsair
4 Deadeye Brawler
3 Hostage Taker
4 Warkite Marauder
3 Deadeye Plunderers
2 Vraska's Contempt
3 Walk the Plank
4 Dire Fleet Poisoner
3 Deadeye Tormentor
3 Shipwreck Looter
11 Island
11 Swamp
2 Drowned Catacomb`}},
      villain: {who: 'vona', deck: {label: 'tribute', name: 'The Legion of Dusk', colors: 'WB', list: `
4 Legion Lieutenant
2 Vona, Butcher of Magan
4 Bloodcrazed Paladin
4 Oathsworn Vampire
4 Vampire Champion
3 Mavren Fein, Dusk Apostle
4 Dusk Legion Zealot
3 Bishop of the Bloodstained
3 Vanquish the Weak
2 Call to the Feast
3 Vampire Revenant
12 Plains
10 Swamp
2 Forsaken Sanctuary`}},
      scene: [q('stage', 'Jace awoke to the certainty that he was lost.'),
        q('jace', 'Clearly, it indicates the aetheric azimuth of . . .'),
        s('jace', 'Lifelink: damage it deals gains its controller that much life. Race a lifelinker and your damage has to outrun theirs.')],
      villainScene: [q('vona', 'For four hundred years, I have led armies of conquest. These lands hold nothing that can stand against me.'),
        q('vona', 'Cut the beasts out from under them and their strength is nothing.')],
      cues: {hero: cue('Where are we?', 'Steady now.', 'I do not remember this...', 'I have a plan.', 'Lost again...', 'Kill the lifelinker first.'),
        villain: cue('Kneel.', 'For the Legion!', 'Hold the line...', 'Four hundred years.', 'Impossible...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The City\'s Blessing', difficulty: 'Normal', rewardSet: 'rix', teaches: ['Ascend'],
      blurb: 'Kumena knows the only way to keep his enemies from Orazca is to claim its power himself. Tishana, the Voice of Thunder, stands against him.',
      hero: {who: 'kumena', deck: {label: 'tribute', name: 'Shaper Kumena\'s Tide', colors: 'UG', list: `
2 Mist-Cloaked Herald
4 Timestream Navigator
2 Silvergill Adept
2 Merfolk Mistbinder
2 Kumena, Tyrant of Orazca
2 Spire Winder
1 Secrets of the Golden City
2 Kumena's Speaker
3 Shapers of Nature
1 Waterknot
11 Island
11 Forest
2 Woodland Stream
4 Shore Keeper
3 Shaper Apprentice
4 Sworn Guardian
4 Siren Lookout`}},
      villain: {who: 'tishana', deck: {label: 'tribute', name: 'Tishana\'s Thunder', colors: 'UG', list: `
4 Tishana's Wayfinder
4 Shapers of Nature
4 Jade Guardian
4 Orazca Frillback
3 Jade Bearer
4 Thundering Spineback
4 Tishana, Voice of Thunder
2 Nezahal, Primal Tide
3 Kumena's Awakening
3 Hadana's Climb // Winged Temple of Orazca
3 Wildgrowth Walker
1 Plummet
10 Forest
9 Island
2 Woodland Stream`}},
      scene: [q('stage', 'The truth came to Kumena like the Great River\'s torrent: the only way to keep his enemies away from the hidden city was to claim its power for himself.'),
        q('kumena', 'A fool\'s fire is quickly quenched.'),
        s('kumena', 'Ascend: control ten permanents and you get the city\'s blessing for the rest of the game. Build a wide board, then enjoy the bonus.')],
      villainScene: [q('tishana', 'Don\'t make splashes. Make progress.'),
        q('tishana', 'The fools have done it.')],
      cues: {hero: cue('Claim the power.', 'The blessing is ours!', 'The thunder grows...', 'The river holds.', 'The city is lost...', 'Reach ten permanents.'),
        villain: cue('There is always another way.', 'Thunder!', 'Wide waters...', 'The river is mine.', 'The waters recede...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Dinosaurs', difficulty: 'Normal', rewardSet: 'rix', teaches: ['Tribes'],
      blurb: 'A tribute to the tribes of Ixalan Standard: Gruul Dinosaurs against Vampires. Big beasts against the Legion of Dusk.',
      hero: {who: 'dinos', deck: {label: 'tribute', name: 'RG Dinosaurs', colors: 'RG', archetype: 'Aggro', list: `
4 Raptor Hatchling
4 Ripjaw Raptor
4 Regisaur Alpha
4 Raging Swordtooth
4 Charging Monstrosaur
3 Ravenous Daggertooth
3 Needletooth Raptor
4 Frenzied Raptor
3 Savage Stomp
3 Lightning Strike
12 Mountain
11 Forest
1 Rootbound Crag`}},
      villain: {who: 'vampires', deck: {label: 'tribute', name: 'WB Vampires', colors: 'WB', archetype: 'Midrange', list: `
4 Legion Lieutenant
2 Vona, Butcher of Magan
4 Bloodcrazed Paladin
4 Oathsworn Vampire
4 Vampire Champion
3 Mavren Fein, Dusk Apostle
4 Dusk Legion Zealot
3 Bishop of the Bloodstained
3 Vanquish the Weak
2 Call to the Feast
3 Vampire Revenant
12 Plains
10 Swamp
2 Forsaken Sanctuary`}},
      scene: [q('stage', 'Carnivorous dinosaurs developed a taste for undead flesh, tracking the vampires by the scent of blood on their breath.'),
        q('stage', 'Sun Empire commanders are well versed in advanced martial strategy. Still, the correct maneuver is usually to deploy the giant, implacable death lizard.'),
        s('you', 'Dinosaurs hit harder than vampires. Fight them early and fast, before the lifelinkers stabilise.')],
      villainScene: [q('stage', 'Vampires, the noble class of old Torrezon, are guided by their dual loyalties to church and crown.'),
        q('stage', 'By the law of church and crown, vampires feed only on the blood of the guilty\u2014those declared heretics, rebels, or enemies of war.')],
      cues: {hero: cue('Charge!', 'Stampede!', 'They are bleeding us...', 'The herd wins.', 'Hunted down...', 'Keep attacking.'),
        villain: cue('For church and crown.', 'Feed!', 'The sun is rising...', 'The Legion endures.', 'Dust...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Pirates', difficulty: 'Normal', rewardSet: 'rix', teaches: ['Racing'],
      blurb: 'A tribute to the tribes of Ixalan Standard: Pirate aggro against the Merfolk of the Great River.',
      hero: {who: 'pirates', deck: {label: 'tribute', name: 'BR Pirates', colors: 'BR', archetype: 'Aggro', list: `
2 Daring Buccaneer
4 Dire Fleet Daredevil
2 Swaggering Corsair
4 Dire Fleet Captain
4 Fathom Fleet Captain
4 Captivating Crew
1 Fathom Fleet Cutthroat
4 Lightning Strike
3 Walk the Plank
4 Dire Fleet Neckbreaker
12 Mountain
10 Swamp
2 Cinder Barrens
3 Ravenous Chupacabra
1 Vraska's Contempt`}},
      villain: {who: 'merfolk', deck: {label: 'tribute', name: 'Merfolk Explorers', colors: 'UG', archetype: 'Midrange', list: `
4 Jungle Delver
2 Kumena's Speaker
2 Mist-Cloaked Herald
2 Silvergill Adept
4 Shapers of Nature
1 Waterknot
3 Merfolk Mistbinder
11 Forest
11 Island
2 Woodland Stream
3 Shaper Apprentice
4 Shore Keeper
3 Sworn Guardian
4 Siren Lookout
2 Sailor of Means
2 Sea Legs`}},
      scene: [q('stage', 'The pirates of the Brazen Coalition are the descendants of those displaced by the Legion of Dusk, and they are eager for vengeance.'),
        q('stage', 'Without frequent raids, orcs sometimes get bored and plunder their own ships.'),
        s('you', 'Pirates are fast and fragile. Hit first and keep the pressure on.')],
      villainScene: [q('stage', 'The River Heralds fight to keep all others from reaching the golden city. The city has its own defenses.'),
        q('stage', 'With matchless stealth, the River Heralds fought a running battle against the three enemy forces.')],
      cues: {hero: cue('Yo ho!', 'All hands!', 'Taking on water...', 'Plunder secured.', 'Overboard...', 'Race before the tide turns.'),
        villain: cue('Look downstream.', 'Rise!', 'Out of the shallows...', 'The river holds.', 'The waters part...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Lawbringer', difficulty: 'Hard', rewardSet: 'rix', teaches: ['Racing'],
      blurb: 'Azor built the Immortal Sun and thinks he is keeping the plane safe. Jace and Vraska have to take it away from him.',
      hero: {who: 'vraska', deck: {label: 'tribute', name: 'Vraska and Jace', colors: 'UB', list: `
1 Hostage Taker
2 Ravenous Chupacabra
4 Vraska's Contempt
2 Kitesail Corsair
2 Deadeye Brawler
1 Vraska, Scheming Gorgon
4 Warkite Marauder
2 Walk the Plank
3 Dire Fleet Poisoner
11 Island
11 Swamp
2 Drowned Catacomb
3 Deadeye Tormentor
4 Sworn Guardian
4 Siren Lookout
2 Shore Keeper
2 Shaper Apprentice`}},
      villain: {who: 'azor', deck: {label: 'tribute', name: 'The Keeper of the Sun', colors: 'WU', list: `
4 Azor, the Lawbringer
4 Settle the Wreckage
4 Baffling End
4 Resplendent Griffin
4 Seafloor Oracle
4 Cancel
3 Luminous Bonds
2 Divine Verdict
3 Pious Interdiction
1 The Immortal Sun
1 Sun-Crested Pterodon
12 Plains
10 Island
2 Glacial Fortress
2 Negate`}},
      scene: [q('stage', 'Opening Orazca unleashed more horrors than just the Immortal Sun.'),
        q('stage', 'Carefully following the thaumatic compass Bolas had given her, Vraska blundered straight into the River Heralds\' trap.'),
        s('jace', 'We cannot beat the Sun by force. Break his hold on it before the walkers are trapped.')],
      villainScene: [q('azor', 'Be still.'),
        q('stage', 'The Immortal Sun will bring us true eternal life to replace the everlasting shadow of undeath.')],
      cues: {hero: cue('Take the Sun.', 'Now!', 'The Sun is binding us...', 'He is trapped.', 'We are bound...', 'Do not let him keep the Sun.'),
        villain: cue('Be still.', '[the Sun burns gold]', '[a hollow glow]', 'It is finished.', '[the sky turns red]')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Rekindling Phoenix', difficulty: 'Hard', rewardSet: 'rix', rewardCard: 'Rekindling Phoenix', mood: 'boss',
      teaches: ['Racing'],
      archive: {deck: 'Rekindling Phoenix', when: 'Early 2018', format: 'Standard.',
        what: 'Red and black decks built around Rekindling Phoenix, a four-mana flier that came back from the graveyard if you did not deal with the 0/1 it left behind.',
        why: 'The Phoenix was a bomb: a threat that was hard to answer for good, in a format full of aggro and midrange.',
        beat: 'Exile it or kill the Elemental token on their upkeep before it can return the Phoenix.',
        after: 'Ixalan and Rivals of Ixalan rotated out of Standard in autumn 2019.'},
      blurb: 'Deep in the archive, a flier that will not stay dead.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'GW Dinosaurs', colors: 'GW', archetype: 'Midrange', list: `
4 Drover of the Mighty
4 Wayward Swordtooth
4 Thrashing Brontodon
3 Huatli, Radiant Champion
4 Siegehorn Ceratops
4 Atzocan Seer
4 Imperial Ceratops
3 Steadfast Armasaur
3 Baffling End
3 Territorial Hammerskull
12 Forest
10 Plains
2 Sunpetal Grove`}},
      villain: {who: 'brass', deck: {label: 'tribute', name: 'Rekindling Phoenix', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'BR', archetype: 'Midrange', list: `
4 Rekindling Phoenix
4 Dire Fleet Daredevil
4 Daring Buccaneer
4 Lightning Strike
2 Walk the Plank
2 Vraska's Contempt
3 Dire Fleet Neckbreaker
3 Captivating Crew
3 Angrath's Fury
3 Dire Fleet Ravager
2 Angrath, the Flame-Chained
2 Captain Lannery Storm
12 Mountain
11 Swamp
1 Cinder Barrens`}},
      scene: [q('stage', 'If you come across a raptor in the city, stay perfectly still. At least then you\'ll be well rested when you die.'),
        s('you', 'Kill the Elemental token before their upkeep, or the Phoenix comes back.')],
      villainScene: [q('stage', 'Captain Angrath cares less about treasure than mayhem. If he can\'t leave Ixalan, he\'ll burn the plane down.')],
      cues: {hero: cue('Stay still.', 'Strike!', 'It came back...', 'Ash.', 'Burned...', 'Kill the token on their upkeep.'),
        villain: cue('[a screech]', '[it rises]', '[an ember falls]', '[ash]', '[the embers fade]')},
      after: [s('stage', 'Recorded: Ixalan block rotated out of Standard in autumn 2019.')]},
  ],
};
