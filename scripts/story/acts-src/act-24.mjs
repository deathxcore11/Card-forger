// Act 24: The Moon (Shadows over Innistrad, Eldritch Moon). Story and dialogue:
// /mnt/project-files/story/act-24-script.md (generated from this file). Land set: soi.
// Act 23 ended with Emrakul missing. Now Innistrad is going mad. Jace is sent to find Sorin and finds cryptoliths,
// Tamiyo's notes and a warped Markov Manor instead. Avacyn turns on her own people and Sorin unmakes her. Nahiri, who
// spent a thousand years sealed in stone by Sorin, is behind it all: she called Emrakul to Innistrad. The Gatewatch
// fights for Thraben, and in the end Emrakul is sealed inside the silver moon.
// Every quoted line is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'innistrad-madness-moon',
  era: '2016-07-22',
  intro: [s('stage', 'Innistrad, years after the Helvault opened. The angels are back, the moon is silver, and something is wrong.'),
    q('stage', 'The renewed howling of werewolves announced the end of the Cursemute—and the beginning of Avacyn\'s madness.'),
    s('stage', 'Sorin Markov has vanished. Jace Beleren has come looking for him, and finds strange stones everywhere he goes.'),
    q('jace', 'Every answer seems to lead to a more terrifying question.')],
  finale: [q('stage', 'Only one vault was great enough to hold Emrakul.'),
    s('stage', 'The last titan is sealed inside the silver moon. Innistrad is broken, but it is still here.'),
    s('stage', 'It was easier than it should have been. Tamiyo is the only one who knows why, and she does not say.')],
  villainFinale: [s('stage', 'The moon goes dark.'),
    q('stage', 'All around Emrakul, life re-formed in her image.'),
    q('stage', 'Emrakul does not grant wishes. Desires simply align to her will.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Epiphany at the Drownyard'},
    jace: {name: 'Jace Beleren', title: 'Investigator', card: 'Jace, Unraveler of Secrets', focus: '50% 25%'},
    cult: {name: 'The Drownyard Cult', title: 'Nephalia', card: 'Thing in the Ice', focus: '50% 30%'},
    tamiyo: {name: 'Tamiyo', title: 'Field Researcher', card: 'Tamiyo, Field Researcher', focus: '50% 25%'},
    bruna: {name: 'Bruna', title: 'The Fading Light', card: 'Bruna, the Fading Light', focus: '50% 25%'},
    olivia: {name: 'Olivia Voldaren', title: 'Mobilized for War', card: 'Olivia, Mobilized for War', focus: '50% 25%'},
    thalia: {name: 'Thalia', title: 'Heretic Cathar', card: 'Thalia, Heretic Cathar', focus: '50% 25%'},
    nahiri: {name: 'Nahiri', title: 'The Harbinger', card: 'Nahiri, the Harbinger', focus: '50% 25%'},
    sorin: {name: 'Sorin Markov', title: 'Grim Nemesis', card: 'Sorin, Grim Nemesis', focus: '50% 25%'},
    arlinn: {name: 'Arlinn Kord', title: 'Of the pack', card: 'Arlinn Kord', focus: '50% 25%'},
    horrors: {name: 'Emrakul\'s Horrors', title: 'Eldrazi', card: 'Lashweed Lurker', focus: '50% 30%'},
    humans: {name: 'Humans', title: 'Spring 2016', card: 'Thalia\'s Lieutenant', focus: '50% 25%'},
    zombies: {name: 'Zombies', title: 'Summer 2016', card: 'Relentless Dead', focus: '50% 30%'},
    spirits: {name: 'Spirits', title: 'Summer 2016', card: 'Spell Queller', focus: '50% 25%'},
    delirium: {name: 'GB Delirium', title: 'Summer 2016', card: 'Ishkanah, Grafwidow', focus: '50% 30%'},
    gatewatch: {name: 'The Gatewatch', title: 'At Thraben', card: 'Deploy the Gatewatch', focus: '50% 30%'},
    emrakul: {name: 'Emrakul', title: 'The Promised End', card: 'Emrakul, the Promised End', focus: '50% 30%'},
    emerge: {name: 'Emerge', title: 'Summer 2016', card: 'Elder Deep-Fiend', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Drownyard', difficulty: 'Easy', rewardSet: 'soi', teaches: ['Investigate'],
      blurb: 'You find Jace Beleren on the Nephalian coast, following a trail of warped stones to a temple full of cultists.',
      hero: {who: 'jace', deck: {label: 'tribute', name: 'The Investigation', colors: 'UG', list: `
4 Tireless Tracker
3 Ongoing Investigation
4 Briarbridge Patrol
4 Byway Courier
4 Daring Sleuth
3 Drownyard Explorers
3 Erdwal Illuminator
4 Press for Answers
4 Thornhide Wolves
12 Forest
12 Island
3 Kessig Dire Swine`}},
      villain: {who: 'cult', deck: {label: 'tribute', name: 'The Drownyard Cult', colors: 'UB', list: `
1 Thing in the Ice
2 Exultant Cultist
4 Pore Over the Pages
2 Weirded Vampire
4 Murderous Compulsion
12 Island
12 Swamp
4 Gisa's Bidding
4 Dead Weight
4 Jace's Scrutiny
4 Throttle
4 Confirm Suspicions
3 Furtive Homunculus`}},
      scene: [q('jace', 'This is it! All the cryptoliths point here!'),
        q('stage', 'Amid the gibbering chorus that rose from the drownyard temple, Jace recognized a single word: "Emrakul."'),
        s('jace', 'Investigate: you make a Clue. Pay 2 and sacrifice it to draw a card. Crack them when you have spare mana.')],
      villainScene: [q('stage', 'In times of madness, people cling to the familiar, monstrous though it may be.'),
        q('stage', 'A slow knock at midnight is best left unanswered.')],
      cues: {hero: cue('Follow the evidence.', 'Solved!', 'The trail goes cold...', 'Case closed.', 'Lost in the fog...', 'Crack a Clue at end of turn.'),
        villain: cue('[the chanting begins]', '[the thing rises from the ice]', '[a cultist falls silent]', '[the chorus swells]', '[silence]')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Tamiyo\'s Journal', difficulty: 'Easy', rewardSet: 'emn', teaches: ['Delirium'],
      blurb: 'Tamiyo, the moonfolk scholar, has been studying Innistrad for years. Avacyn\'s angels have stopped telling friend from foe.',
      hero: {who: 'tamiyo', deck: {label: 'tribute', name: 'The Scholar\'s Notes', colors: 'UG', list: `
2 Tamiyo's Journal
4 Traverse the Ulvenwald
3 Grapple with the Past
4 Vessel of Nascency
4 Gnarlwood Dryad
4 Kessig Dire Swine
4 Moldgraf Scavenger
4 Ingenious Skaab
4 Clear Shot
12 Forest
12 Island
3 Pore Over the Pages`}},
      villain: {who: 'bruna', deck: {label: 'tribute', name: 'The Mad Flight', colors: 'W', list: `
1 Bruna, the Fading Light
4 Thraben Inspector
4 Militant Inquisitor
4 Expose Evil
4 Angelic Purge
4 Strength of Arms
24 Plains
4 Puncturing Light
4 Chaplain's Blessing
3 Hope Against Hope
4 Not Forgotten`}},
      scene: [q('stage', 'Entry 434: There\'s more to Avacyn\'s madness . . .'),
        q('jace', 'Is this what you found, Tamiyo?'),
        s('tamiyo', 'Delirium: count the card types in your graveyard. Four or more and these cards grow stronger. Fill the graveyard on purpose.')],
      villainScene: [q('stage', 'She now sees only Emrakul\'s visions.'),
        q('stage', 'If you refuse to see the light, then you will feel it.')],
      cues: {hero: cue('Write everything down.', 'Delirium!', 'The pages blur...', 'A new entry.', 'The journal closes...', 'Get four types in the yard.'),
        villain: cue('[wings overhead]', '[holy fire]', '[an angel falls]', '[the purge goes on]', '[the light fades]')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Call the Bloodline', difficulty: 'Easy', rewardSet: 'emn', teaches: ['Madness'],
      blurb: 'Sorin needs an army, so he asks Olivia Voldaren for one. Thalia\'s heretic cathars are in the way, and none of them will bow.',
      hero: {who: 'olivia', deck: {label: 'tribute', name: 'The Voldaren Bloodline', colors: 'BR', list: `
2 Olivia, Mobilized for War
4 Heir of Falkenrath
4 Bloodmad Vampire
4 Fiery Temper
4 Asylum Visitor
4 Incorrigible Youths
12 Mountain
12 Swamp
4 Vampire Noble
3 Gibbering Fiend
4 Lightning Axe
3 Galvanic Bombardment`}},
      villain: {who: 'thalia', deck: {label: 'tribute', name: 'The Heretic Cathars', colors: 'W', list: `
1 Thalia, Heretic Cathar
4 Thraben Inspector
4 Dauntless Cathar
3 Thraben Standard Bearer
24 Plains
4 Chaplain's Blessing
1 Moorland Drifter
4 Expose Evil
4 Strength of Arms
4 Hope Against Hope
4 Vessel of Ephemera
1 Survive the Night
2 Town Gossipmonger`}},
      scene: [q('stage', 'At Sorin\'s appeal, Olivia Voldaren summoned the full might of her bloodline to gather at Lurenbraum Fortress.'),
        q('stage', 'As we muster for war, I have little patience for lethargy or recalcitrance.'),
        s('olivia', 'Madness: when you discard a madness card, you may cast it for its madness cost instead. Discard on purpose, darling.')],
      villainScene: [q('thalia', 'Salvation will not be granted by the Lunarch Council. It must be earned—at the edge of a sword, if necessary.'),
        q('thalia', 'We fight not for Avacyn, but for her ideals; not for the church, but for its people.')],
      cues: {hero: cue('Manners are for mortals.', 'Madness!', 'How tiresome...', 'Delicious.', 'Ugh. Peasants.', 'Discard a madness card.'),
        villain: cue('Hold the line, cathars.', 'For the people!', 'Fall back to Thraben...', 'Thraben stands.', 'Regroup...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Avacyn\'s Fall', difficulty: 'Normal', rewardSet: 'soi', teaches: ['Transform'],
      blurb: 'The truth comes out. Sorin sealed Nahiri in stone for a thousand years, and Nahiri has come back to take everything from him.',
      hero: {who: 'nahiri', deck: {label: 'tribute', name: 'The Harbinger', colors: 'RW', list: `
2 Nahiri, the Harbinger
4 Thraben Inspector
4 Geier Reach Bandit
4 Ember-Eye Wolf
4 Lightning Axe
4 Galvanic Bombardment
3 Sanctifier of Souls
3 Pyre Hound
2 Declaration in Stone
12 Mountain
12 Plains
2 Collective Defiance
4 Chaplain's Blessing`}},
      villain: {who: 'sorin', deck: {label: 'tribute', name: 'The Markov Line', colors: 'WB', list: `
2 Sorin, Grim Nemesis
2 Archangel Avacyn
4 Olivia's Bloodsworn
4 Vampire Noble
4 Markov Crusader
3 Anguished Unmaking
2 Campaign of Vengeance
4 Dauntless Cathar
4 Stromkirk Mentor
4 Dead Weight
3 Vampire Cutthroat
12 Plains
12 Swamp`}},
      scene: [q('nahiri', 'Sorin, I\'m going to take everything from you.'),
        q('nahiri', 'As Zendikar has bled, so will Innistrad. As I have wept, so will Sorin.'),
        s('nahiri', 'Transform: double-faced cards flip into their other side when something happens. Watch the angel. When she turns, she burns everything.')],
      villainScene: [q('sorin', 'You sought to anger me, Nahiri. Soon you will see how well you have succeeded.'),
        q('stage', 'Sorin had created Avacyn, so it was a cruelty beyond imagining, a pain beyond description, that it fell upon him to end her forever.')],
      cues: {hero: cue('A thousand years, Sorin.', 'Everything!', 'Not yet...', 'Now you know.', 'Stone again...', 'Kill the angel before she turns.'),
        villain: cue('Leave, Nahiri.', 'Enough.', 'She is stronger than I remember...', 'It is finished.', 'What have I made...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Dronepack', difficulty: 'Normal', rewardSet: 'emn', teaches: ['Emerge'],
      blurb: 'In Kessig, werewolves are turning into something worse. Arlinn Kord, a planeswalker who is also a werewolf, leads what is left of the pack.',
      hero: {who: 'arlinn', deck: {label: 'tribute', name: 'Arlinn\'s Pack', colors: 'RG', list: `
2 Arlinn Kord
4 Village Messenger
4 Kessig Forgemaster
4 Duskwatch Recruiter
4 Lambholt Pacifist
4 Breakneck Rider
3 Kessig Prowler
4 Gatstaf Arsonists
4 Moonlight Hunt
12 Forest
12 Mountain
3 Clear Shot`}},
      villain: {who: 'horrors', deck: {label: 'tribute', name: 'The Dronepack', colors: 'UG', list: `
3 Elder Deep-Fiend
4 Wretched Gryff
4 Lashweed Lurker
2 Mockery of Nature
4 Kessig Prowler
4 Gnarlwood Dryad
4 Grizzled Angler
4 Byway Courier
3 Vexing Scuttler
2 Primal Druid
2 Clear Shot
12 Forest
12 Island`}},
      scene: [q('arlinn', 'How can werewolves be considered abominations next to such creatures?'),
        q('stage', 'In the wake of Emrakul, some werewolves\' human forms were lost forever.'),
        s('arlinn', 'Emerge: they sacrifice a creature to cast a horror for less. Every sacrifice makes something bigger. Kill the fodder first.')],
      villainScene: [q('stage', 'The Somberwald has become a hunting ground for the Dronepack, the group of werewolves that have succumbed to the flesh-twisting power of Emrakul.'),
        q('stage', 'Emrakul does not grant wishes. Desires simply align to her will.')],
      cues: {hero: cue('Run with me.', 'The moon is ours!', 'They are not wolves anymore...', 'The pack holds.', 'Lost to the moon...', 'Kill the small ones first.'),
        villain: {...cue('[something wet moves in the trees]', '[a horror emerges]', '[a husk falls]', '[the woods twist]', '[stillness]'),
          half: {who: 'arlinn', line: 'They sacrifice their own to make those things. Leave them nothing to sacrifice!'}}}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Thraben Holds', difficulty: 'Normal', rewardSet: 'emn', teaches: ['Skulk'],
      blurb: 'A tribute to Standard in 2016: white Humans against the Zombies that came from Gisa and Geralf\'s labs.',
      hero: {who: 'humans', deck: {label: 'tribute', name: 'Humans', colors: 'W', archetype: 'Aggro', list: `
2 Thalia, Heretic Cathar
4 Thraben Inspector
4 Thalia's Lieutenant
4 Town Gossipmonger
4 Dauntless Cathar
4 Hanweir Militia Captain
3 Always Watching
3 Declaration in Stone
4 Cathar's Companion
24 Plains
4 Chaplain's Blessing`}},
      villain: {who: 'zombies', deck: {label: 'tribute', name: 'Zombies', colors: 'UB', archetype: 'Aggro', list: `
4 Prized Amalgam
4 Relentless Dead
3 Diregraf Colossus
4 Cryptbreaker
2 Gisa and Geralf
4 Haunted Dead
4 Stitchwing Skaab
4 Dark Salvation
3 Liliana's Elite
4 Ghoulcaller's Accomplice
12 Island
12 Swamp`}},
      scene: [q('stage', 'If you\'ve been at this as long as I have, nothing can surprise you. That\'s the hope, at least.'),
        q('stage', 'The uncorrupted rallied under Thalia\'s leadership and Sigarda\'s banner.'),
        s('you', 'Skulk: a creature with skulk can\'t be blocked by creatures with greater power. Keep a small blocker home.')],
      villainScene: [q('stage', 'Countless ghouls surged through Thraben\'s streets, and with them came the city\'s salvation.'),
        q('stage', 'Ludevic\'s laboratory is a veritable wonderland. I have never felt so inspired.')],
      cues: {hero: cue('Line up.', 'Together!', 'They keep getting back up...', 'Thraben holds.', 'Overrun...', 'Exile the graveyard threats.'),
        villain: cue('[shambling]', '[the dead return]', '[a ghoul drops]', '[the city falls]', '[still]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'The Spider Queen', difficulty: 'Normal', rewardSet: 'emn', teaches: ['Flash'],
      blurb: 'A tribute to Standard in summer 2016: white-blue Spirits with flash against green-black Delirium.',
      hero: {who: 'spirits', deck: {label: 'tribute', name: 'Spirits', colors: 'WU', archetype: 'Tempo', list: `
4 Spell Queller
4 Rattlechains
4 Selfless Spirit
4 Nebelgast Herald
4 Mausoleum Wanderer
3 Bygone Bishop
4 Unsubstantiate
3 Spectral Shepherd
3 Drogskol Shieldmate
3 Turn Aside
12 Island
12 Plains`}},
      villain: {who: 'delirium', deck: {label: 'tribute', name: 'GB Delirium', colors: 'BG', archetype: 'Midrange', list: `
2 Ishkanah, Grafwidow
4 Grim Flayer
2 Liliana, the Last Hope
2 Mindwrack Demon
4 Traverse the Ulvenwald
4 Vessel of Nascency
3 Grapple with the Past
4 Murderous Compulsion
4 Deathcap Cultivator
3 Kessig Prowler
4 Gnarlwood Dryad
12 Forest
12 Swamp`}},
      scene: [q('stage', 'Immune to the physical warping caused by Emrakul, geists proved to be some of humanity\'s most important allies.'),
        q('stage', 'There is always more to give.'),
        s('you', 'Flash: these cards can be cast at instant speed. Pass with mana up and act on their turn.')],
      villainScene: [q('stage', 'The old hermit would never say what he fed his mushrooms, and people learned not to ask.'),
        q('stage', 'When I was a child, we worried about picking the wrong mushrooms for the cook pot. Now we must worry about being picked ourselves.')],
      cues: {hero: cue('Wait for it.', 'Flash!', 'The webs close in...', 'Gone like mist.', 'Caught...', 'Hold mana on their turn.'),
        villain: cue('[spiders skitter]', '[the grafwidow descends]', '[a web tears]', '[cocooned]', '[the web is empty]')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Promised End', difficulty: 'Hard', rewardSet: 'emn', teaches: ['Escalate'],
      blurb: 'Nahiri called Emrakul across the Blind Eternities. Now the last titan is on Innistrad, and the Gatewatch stands at Thraben.',
      hero: {who: 'gatewatch', deck: {label: 'tribute', name: 'The Gatewatch', colors: 'WU', list: `
2 Jace, Unraveler of Secrets
3 Imprisoned in the Moon
2 Deploy the Gatewatch
2 Thalia, Heretic Cathar
4 Spell Queller
3 Bygone Bishop
4 Declaration in Stone
4 Spectral Shepherd
4 Unsubstantiate
12 Island
12 Plains
4 Turn Aside
4 Choking Restraints`}},
      villain: {who: 'emrakul', deck: {label: 'tribute', name: 'The Promised End', colors: 'BG', list: `
4 Ishkanah, Grafwidow
4 Traverse the Ulvenwald
4 Grapple with the Past
4 Vessel of Nascency
3 Distended Mindbender
4 Decimator of the Provinces
2 Collective Brutality
3 Deathcap Cultivator
4 Mindwrack Demon
4 Gnarlwood Dryad
12 Forest
12 Swamp`}},
      scene: [q('stage', 'At Nahiri\'s call, Emrakul traversed the vast emptiness between the planes and arrived on Innistrad.'),
        q('stage', 'Gideon and Liliana may not have seen eye to eye, but that did not stop them from fighting side by side.'),
        s('jace', 'Escalate: their spells pay extra for each extra mode. Expect two or three effects at once. Hold the moon for the biggest thing.')],
      villainScene: [q('stage', 'Hordes of Eldrazi and cultists swarmed over Thraben\'s defenses, and the members of the Gatewatch found themselves overrun.'),
        q('stage', 'An enigma as vexing as life itself.')],
      cues: {hero: cue('Hold Thraben.', 'Into the moon!', 'There is too much of it...', 'Sealed.', 'The moon is gone...', 'Save the Moon for the biggest one.'),
        villain: {...cue('[the sky tears open]', '[the world bends]', '[a horror unravels]', '[the promised end]', '[silence in the moon]'),
          half: {who: 'tamiyo', line: 'The moon. Use the moon. I will explain later.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Elder Deep-Fiend', difficulty: 'Hard', rewardSet: 'emn', rewardCard: 'Elder Deep-Fiend', mood: 'boss',
      teaches: ['Flying'],
      archive: {deck: 'Temur Emerge', when: 'Summer 2016', format: 'Standard.',
        what: 'Green-blue decks, often with red, that sacrificed creatures to emerge Elder Deep-Fiend and Wretched Gryff, and later to cast Emrakul, the Promised End.',
        why: 'Elder Deep-Fiend has flash. Emerged in your upkeep, it taps four of your permanents and leaves you a turn behind.',
        beat: 'Play fast and keep their small creatures dead. Without fodder, emerge costs full price.',
        after: 'Emrakul, the Promised End was banned in Standard in January 2017. Emrakul\'s card cannot be played by Forge\'s CPU, so this tribute plays its emerge creatures only.'},
      blurb: 'Deep in the archive, the summer the horrors came from the sea.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'UR Spells', colors: 'UR', archetype: 'Tempo', list: `
4 Thermo-Alchemist
4 Fiery Temper
4 Galvanic Bombardment
3 Fevered Visions
4 Lightning Axe
4 Take Inventory
2 Sanguinary Mage
4 Pieces of the Puzzle
4 Geistblast
12 Island
12 Mountain
3 Jace's Scrutiny`}},
      villain: {who: 'emerge', deck: {label: 'tribute', name: 'Emerge', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'UG', archetype: 'Midrange', list: `
4 Elder Deep-Fiend
4 Wretched Gryff
4 Kessig Prowler
3 Primal Druid
4 Grapple with the Past
4 Traverse the Ulvenwald
3 Vessel of Nascency
4 Clear Shot
12 Forest
12 Island
4 Grizzled Angler
2 Mockery of Nature`}},
      scene: [q('stage', 'Madness can\'t touch a mind ignited by genius.'),
        s('you', 'If they sacrifice something in my upkeep, I lose a turn. Burn the fodder first.')],
      villainScene: [q('stage', 'The tides have begun to ignore the moon.')],
      cues: {hero: cue('Burn the fodder.', 'Ignited!', 'Tapped down again...', 'The sea is calm.', 'Pulled under.', 'Kill the small creatures.'),
        villain: cue('[the tide pulls back]', '[the deep-fiend rises]', '[a husk dissolves]', '[pulled under]', '[the tide turns]')},
      after: [s('stage', 'Recorded: Emrakul, the Promised End banned in Standard, January 2017.')]},
  ],
};
