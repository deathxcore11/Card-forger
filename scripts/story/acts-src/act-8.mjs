// Act 8: The Invasion (Invasion, Planeshift, Seventh Edition, Apocalypse). Story and dialogue:
// /mnt/project-files/story/act-8-script.md (generated from this file). Land set: inv.
// Straight after Act 7: Rath has overlaid Dominaria and Phyrexia comes through the portals.
// The end of the Weatherlight Saga. Every quoted line is the card's own flavor text.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'phyrexian-invasion-last-stand',
  intro: [s('stage', 'Dominaria. The sky over Benalia splits open, and things with too many legs pour out.'),
    q('stage', 'All of Dominaria recoiled as Yawgmoth and his retainers arrived.'),
    s('urza', 'Four thousand years. Everything I built was for today.'), q('urza', 'You can build a perfect machine out of imperfect parts.'),
    s('gerrard', "And which part am I, Urza? The heir? The weapon?"), s('urza', 'Yes.'),
    q('urza', 'Our victory must come from all of Dominaria, or it will not come.')],
  finale: [s('stage', 'Phyrexia. The Weatherlight crew reaches the heart of the machine.'),
    q('stage', 'Deep in Yawgmoth\'s realm, Urza stopped dead in his tracks and rubbed his soot-filled eyes. "Mishra?"'),
    q('urza', 'Before the glory of Yawgmoth, yes, even this makes sense.'), s('gerrard', 'Urza? Urza, look at me!'),
    q('stage', "Yawgmoth's greatest joy came from watching one hero defeat another."),
    s('stage', 'Urza falls. Not to Yawgmoth. To his own heir, with Yawgmoth whispering in the dark.'),
    s('karn', 'Gerrard. The Legacy. It needs one more piece.'),
    q('gerrard', "Don't mourn for me. This is my destiny."),
    s('stage', 'Gerrard falls. The Legacy Weapon fires. Yawgmoth, Father of Machines, is unmade in a single white instant.'),
    s('stage', 'Karn wakes with a spark inside him. The silver golem is a planeswalker now. He stares at his hands for a long time.'),
    s('sisay', 'Hanna. Mirri. Gerrard. Urza.'), s('sisay', 'We won. Why does it feel like this?'),
    s('stage', 'Dominaria survives. Barely. The Weatherlight sails on, half empty, into a long quiet.')],
  villainFinale: [s('stage', 'Dominaria under a black sky. The Legacy lies in pieces.'),
    s('yawgmoth', 'Before the Thran, before the machines, I was a healer.'),
    s('yawgmoth', 'I watched flesh fail. Rot. Forget. I only ever wanted to fix it.'),
    s('yawgmoth', 'They called it a plague. I called it a cure. History belongs to whoever is left to write it.'),
    q('stage', 'They danced like puppets to a tune only Yawgmoth could hear.'),
    s('stage', 'Somewhere in the ruins, a goblin sits up, rubs his head, and starts walking. Nobody knows why Squee keeps coming back.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Opt', number: '64'},
    gerrard: {name: 'Gerrard', title: 'Heir of the Legacy', card: 'Gerrard Capashen', number: '11', focus: '50% 25%'},
    sisay: {name: 'Sisay', title: 'Captain of the Weatherlight', card: 'Captain Sisay', number: '237', focus: '50% 25%'},
    hanna: {name: 'Hanna', title: "Ship's Navigator", card: "Hanna, Ship's Navigator", number: '249', focus: '50% 25%'},
    tahngarth: {name: 'Tahngarth', title: 'Talruum Hero', card: 'Tahngarth, Talruum Hero', number: '74', focus: '50% 25%'},
    squee: {name: 'Squee', title: 'Goblin Who Will Not Stay Dead', fixed: fixed('Squee, Goblin Nabob', 'mmq', '214', '4ba8325a-1203-4125-9111-94d9e2b1f14b', 'David Monette'), focus: '50% 30%'},
    multani: {name: 'Multani', title: 'Maro-Sorcerer of Yavimaya', fixed: fixed('Multani, Maro-Sorcerer', 'ulg', '107', '0d6cc98b-b376-40af-8308-198bab00b2b1', 'Daren Bader'), focus: '50% 30%'},
    barrin: {name: 'Barrin', title: 'Master Wizard', fixed: fixed('Barrin, Master Wizard', 'usg', '63', 'ec79e35f-9e78-462d-8b71-4f044e2eff90', 'Michael Sutfin'), focus: '50% 25%'},
    urza: {name: 'Urza', title: 'Lord High Artificer', fixed: fixed('Urza, Lord High Artificer', 'mh1', '75', '9e7fb3c0-5159-4d1f-8490-ce4c9a60f567', 'Grzegorz Rutkowski'), focus: '50% 25%'},
    karn: {name: 'Karn', title: 'Silver Golem', fixed: fixed('Karn, Silver Golem', 'usg', '298', '811a0988-2900-426c-9413-8f1778d99678', 'Mark Zug'), focus: '50% 25%'},
    yawgmoth: {name: 'Yawgmoth', title: 'Father of Machines', fixed: fixed('Yawgmoth, Thran Physician', 'mh1', '116', '8690cbcc-f8fd-41f7-9e28-e61c12b04014', 'Mark Winters'), focus: '50% 25%'},
    tsabo: {name: 'Tsabo Tavoc', title: 'Phyrexian General', card: 'Tsabo Tavoc', number: '281', focus: '50% 30%'},
    slayer: {name: 'Phyrexian Slayer', title: "Tsabo's Killer", card: 'Phyrexian Slayer', focus: '50% 30%'},
    scuta: {name: 'Phyrexian Scuta', title: 'Invasion Vanguard', card: 'Phyrexian Scuta', number: '51', focus: '50% 30%'},
    dralnu: {name: 'Lord Dralnu', title: 'Lord of the Undead', card: 'Lord of the Undead', focus: '50% 30%'},
    ertai: {name: 'Ertai', title: 'The Corrupted', fixed: fixed('Ertai, the Corrupted', 'pls', '107', '66b950d9-8fef-4deb-b51b-26edb90abc56', 'Mark Tedin'), focus: '50% 25%'},
    evincar: {name: 'Crovax', title: 'Ascendant Evincar', fixed: fixed('Ascendant Evincar', 'nem', '51', 'e5c87c93-8cf4-4d1a-9bb8-349600da55bc', 'Mark Zug'), focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The First Wave', difficulty: 'Easy', rewardSet: 'inv', teaches: ['Multicolour gold cards'],
      blurb: "Benalia was the first nation to see the sky open. Gerrard was born a Capashen of Benalia. He comes home to find Tsabo Tavoc's killers in the streets.",
      hero: {who: 'gerrard', deck: {name: 'The Coalition Vanguard', colors: 'GW', list: `
4 Llanowar Knight
4 Noble Panther
4 Charging Troll
4 Benalish Trapper
4 Llanowar Elite
4 Benalish Lancer
4 Quirion Sentinel
4 Armadillo Cloak
4 Pacifism
12 Forest
12 Plains`}},
      villain: {who: 'slayer', deck: {name: 'The First Wave', colors: 'B', list: `
4 Phyrexian Slayer
4 Phyrexian Infiltrator
4 Phyrexian Battleflies
4 Phyrexian Reaper
4 Ravenous Rats
4 Urborg Skeleton
4 Plague Spitter
4 Phyrexian Rager
4 Dark Banishing
24 Swamp`}},
      scene: [q('stage', 'Benalia was only the first nation victimized by Tsabo Tavoc\'s specialized killers.'),
        q('gerrard', 'At least they remember me.'),
        s('slayer', 'Capashen. White. The mark says: kill the white ones first.'),
        q('stage', 'The Capashen built the highest towers in Benalia to afford themselves the best view.'),
        s('gerrard', "Then let them see this. Gold cards need two colours of mana. Green and white, Llanowar and Benalia, fighting as one."),
        q('gerrard', "All right, let's light 'em up!")],
      villainScene: [s('slayer', 'We were grown for this. Bred in the vats, aimed at Benalia.'),
        s('slayer', 'The ones in white fall easily. The ones who stand together take longer.'),
        s('slayer', 'Your life is meaningless. Your death will glorify Yawgmoth. So the general teaches.')],
      cues: {hero: cue('Benalia stands.', 'Wear courage as your armor.', 'Too many... hold the gate...', 'One street back. A thousand to go.', 'Fall back to the towers!', 'Strength in numbers? I think not.'),
        villain: cue('Excise the white ones.', 'Yawgmoth wills it.', 'They... stand together...', 'Benalia is cleansed.', 'More vats. More of us.')},
      after: [s('stage', 'Benalia holds for a day. Then for a week. Across Dominaria, other portals open.'),
        q('stage', 'Urza convinced many Dominarians not only to set aside their differences, but to embrace them.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Yavimaya Wakes', difficulty: 'Easy', rewardSet: 'inv', teaches: ['Kicker'],
      blurb: 'The living forest of Yavimaya has a guardian, Multani, who is the forest. When the Phyrexian vanguard lands on its edge, the forest answers with things nobody has seen in a thousand years.',
      hero: {who: 'multani', deck: {name: 'The Heart of Yavimaya', colors: 'G', list: `
4 Llanowar Elves
4 Kavu Titan
4 Llanowar Elite
4 Pincer Spider
4 Kavu Climber
4 Thicket Elemental
2 Verdeloth the Ancient
4 Giant Growth
4 Rampant Growth
2 Explosive Growth
24 Forest`}},
      villain: {who: 'scuta', deck: {name: 'The Vanguard', colors: 'B', list: `
4 Phyrexian Scuta
4 Urborg Skeleton
4 Agonizing Demise
4 Phyrexian Battleflies
4 Hate Weaver
4 Andradite Leech
4 Maggot Carrier
4 Phyrexian Bloodstock
4 Slay
24 Swamp`}},
      scene: [q('multani', 'Life can be found in all things, even things unnatural.'),
        s('scuta', 'Trees. Many trees. Burn them.'),
        q('stage', 'As Phyrexians descended, Multani paused to reflect on the beauty that might never be seen again.'),
        s('multani', 'Then I will not let it be the last time. Wake, my children.'),
        s('multani', 'Kicker: pay extra when you cast it, and the card does more. A small beast early, or a great one later. You choose.')],
      villainScene: [s('scuta', 'Pay in life, Scuta grows. Scuta always pays.'), s('scuta', 'Forest is soft. Forest is wet. Forest burns slow.'),
        s('scuta', 'Scuta likes the hurting. Hurting means Scuta is working.')],
      cues: {hero: cue('Yavimaya remembers.', 'Kavu! The forest sends kavu!', 'The roots are burning...', 'Go back through your portal. Tell them the forest is awake.', 'I will grow again. I always do.', 'Beneath her scars, Dominaria\'s beauty yet shines.'),
        villain: cue('Burn.', 'Scuta paid. Scuta big.', 'The trees... bite...', 'Ash. Good.', 'Forest wins this time.')},
      after: [q('stage', 'Kavu emerged all across Dominaria, but the first and the strongest came from Yavimaya.'),
        q('urza', "They weren't part of my plan, but Gaea insisted.")]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: "Squee Isn't Thirsty", difficulty: 'Easy', rewardSet: 'pls', teaches: ['The graveyard'],
      blurb: "In the swamps of Urborg, Lord Dralnu raises the dead to fight Phyrexia. He has heard of a goblin who comes back every time he dies, and he would very much like to study him.",
      hero: {who: 'squee', deck: {name: "Squee's Goblins", colors: 'R', list: `
4 Goblin Raider
4 Raging Goblin
4 Goblin Spy
4 Goblin Matron
4 Goblin King
4 Goblin Elite Infantry
4 Goblin Ringleader
4 Goblin War Drums
4 Shock
24 Mountain`}},
      villain: {who: 'dralnu', deck: {name: "Dralnu's Crusade", colors: 'BR', list: `
4 Pyre Zombie
4 Shivan Zombie
4 Cinder Shade
4 Vicious Kavu
4 Lava Zombie
4 Blazing Specter
4 Phyrexian Rager
4 Urborg Skeleton
4 Terminate
12 Swamp
12 Mountain`}},
      scene: [q('squee', "No, *you* get the water. I ain't thirsty."),
        s('stage', 'Squee gets the water. Something in the water gets Squee.'),
        s('dralnu', 'Remarkable. Drowned, and walking. Do it again.'), s('squee', 'Squee does not want to do it again!'),
        q('dralnu', "Don't you agree that mogg intellects are improved by zombification?"),
        s('squee', 'Dead things keep coming back from the graveyard! So does Squee! Squee is like a zombie but cuter!')],
      villainScene: [q('dralnu', 'I confer with Death itself. What could you possibly do to injure me?'),
        s('dralnu', 'Urborg fights Phyrexia with the only army it has. The dead do not tire and do not grieve.'),
        s('dralnu', 'A goblin who cannot die is worth a thousand who can. I only want to borrow him. Forever.')],
      cues: {hero: cue('Goblins! Get them! Squee will be over here.', 'BIG goblin!', 'Squee feels a little dead again...', 'Squee wins! Squee is still alive! Probably!', 'Squee will be back in a minute.', 'Is Squee dead yet? No? Good.'),
        villain: cue('Rise.', 'I bless the living with a song of death.', 'My dead... are dying...', 'Bring me the goblin. Gently. He bruises.', 'Keep him. For now.')},
      after: [q('sisay', 'All this time I thought Squee was useless. Who knew he\'d be such a good shot?'),
        s('squee', 'Squee is very hard to kill. Squee does not know why.'), s('sisay', "Let's keep it that way.")]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Dueling Grounds', difficulty: 'Normal', rewardSet: 'inv', teaches: ['Paying life'],
      blurb: "Tsabo Tavoc, Yawgmoth's general, poisoned Benalia's wells and let her plague loose across Llanowar. Gerrard finds her where the forest is dying fastest.",
      hero: {who: 'gerrard', deck: {name: 'Llanowar', colors: 'GW', list: `
4 Llanowar Elves
4 Llanowar Knight
4 Elvish Champion
4 Wood Elves
4 Llanowar Cavalry
2 Captain Sisay
2 Gerrard Capashen
4 Noble Panther
4 Armadillo Cloak
4 Giant Growth
12 Forest
12 Plains`}},
      villain: {who: 'tsabo', deck: {name: "Tsabo's Legion", colors: 'BR', list: `
2 Tsabo Tavoc
4 Phyrexian Slayer
4 Tsabo's Assassin
4 Phyrexian Scuta
4 Firescreamer
4 Blazing Specter
4 Hooded Kavu
2 Plague Spitter
4 Terminate
4 Agonizing Demise
12 Swamp
12 Mountain`}},
      scene: [q('tsabo', 'Breathe deep, Dominaria. Breathe deep and die.'),
        q('stage', '"You think you can stop me?" hissed Tsabo. "I think I can kill you," replied Gerrard.'),
        q('tsabo', "There's nothing I wouldn't give to achieve victory. Can you say the same?"),
        s('gerrard', "You're giving your own blood to win. That's how you keep paying for it."),
        s('gerrard', 'Paying life is a cost like any other. Make her pay it while you hit her.')],
      villainScene: [q('tsabo', 'Those who can\'t survive are of no consequence.'),
        s('tsabo', 'I was made to be perfect. Every piece of me replaced with something better.'),
        s('tsabo', 'Dominarians are so proud of their flesh. I will show them what it is worth.')],
      cues: {hero: cue("Tsabo. Let's finish this.", 'For Benalia!', 'The plague... I can taste it...', 'Not well balanced, are you?', 'Pull back... get the elves out...', 'That\'s the general. Keep pressing.'),
        villain: cue('Whatever Yawgmoth marks, dies.', 'Rise, metathran. You shall serve a nobler cause in death.', 'My legs... my perfect legs...', 'Your blood will feed the vats.', 'I will be rebuilt. You will not.'),
      }},
    {slot: 5, mood: 'tension', kind: 'Meta', title: 'The Corrupted', difficulty: 'Normal', rewardSet: 'pls', teaches: ['Counterspells'],
      blurb: "Ertai stayed behind on Rath to hold the portal so the Weatherlight could escape. Phyrexia found him there. Now he has come home on the overlay, and he wants Hanna's ship.",
      hero: {who: 'hanna', deck: {name: 'The Weatherlight', colors: 'WU', list: `
2 Hanna, Ship's Navigator
4 Galina's Knight
4 Samite Archer
4 Riptide Crab
4 Silver Drake
4 Angel of Mercy
4 Absorb
4 Counterspell
2 Stand // Deliver
4 Repulse
12 Plains
12 Island`}},
      villain: {who: 'ertai', deck: {name: 'The Corrupted', colors: 'UB', list: `
4 Fact or Fiction
4 Counterspell
4 Undermine
2 Exclude
4 Recoil
2 Barrin's Spite
4 Doomsday Specter
4 Urborg Drake
4 Stalking Assassin
4 Vodalian Zombie
12 Island
12 Swamp`}},
      scene: [s('ertai', 'Hello, Hanna. You look well. I suppose you would.'),
        q('stage', 'Altered by Phyrexian science, corrupted by black mana, and twisted by rage, Ertai still looked in the mirror and saw only glory.'),
        q('ertai', "Don't worry, Gerrard. I'm sure the crew will come to your rescue as quickly as they came to mine."),
        s('hanna', 'We thought you were dead, Ertai. We mourned you.'), s('ertai', 'Then you wasted your tears. I got better.'),
        s('hanna', 'He holds up counterspells and does nothing on his own turn. Make him choose. Cast the small spell first.')],
      villainScene: [s('ertai', 'I held that portal open for them. I was a hero for exactly one minute.'),
        s('ertai', 'Then they left. Everyone always leaves. Phyrexia stayed.'),
        s('ertai', "I am the greatest wizard on Dominaria now. It only cost me everything I was.")],
      cues: {hero: cue('Weatherlight, with me.', 'Not everyone gets a second chance.', 'He knows every move I make...', "Come home, Ertai. Please.", 'The ship... protect the ship...', 'We need alternatives. Now!'),
        villain: cue('Let me show you what I learned.', 'Glory.', 'This is not... I am perfect...', "You should have come back for me.", 'Another time, navigator.')},
      after: [s('stage', 'Ertai escapes into the overlay. The plague does not.'),
        q('sisay', "Hanna would give up her own life before she'd abandon the *Weatherlight*."),
        s('stage', 'Orim tries everything. Gerrard does not leave her side. Hanna dies on the ship she loved, before the war is over.')]},
    {slot: 6, mood: 'tension', kind: 'Lesson', title: 'A Funeral Pyre', difficulty: 'Normal', rewardSet: 'apc', teaches: ['Split cards'],
      blurb: 'Barrin trusted Urza for three thousand years. His wife Rayne is gone. Now his daughter Hanna is gone too. He goes home to Tolaria, and the Phyrexians are waiting.',
      hero: {who: 'barrin', deck: {name: "Barrin's Spite", colors: 'UR', list: `
4 Fire // Ice
2 Prophetic Bolt
4 Razorfin Hunter
4 Tower Drake
4 Tolarian Emissary
4 Viashino Grappler
2 Shivan Emissary
4 Thunderscape Battlemage
4 Repulse
4 Zap
12 Island
12 Mountain`}},
      villain: {who: 'slayer', deck: {name: 'The Tolarian Blight', colors: 'UB', list: `
4 Phyrexian Infiltrator
4 Urborg Phantom
4 Phyrexian Reaper
4 Plague Spitter
4 Stalking Assassin
4 Vodalian Zombie
4 Urborg Drake
4 Recoil
4 Agonizing Demise
12 Island
12 Swamp`}},
      scene: [q('stage', "As Barrin exhumed his daughter's body, he finally realized the full price of his faith in Urza."),
        q('stage', 'Barrin waited for the nausea to pass or for Urza to say something else. He waited in vain.'),
        q('barrin', 'Only vengeance matters now.'),
        s('barrin', 'Fire or ice. A split card is two spells on one card. Read both halves and pick the one the moment needs.'),
        q('barrin', "All my life I've fought these monsters. Today I finish that fight.")],
      villainScene: [s('slayer', 'The island of wizards is ours. The old one is alone.'), s('slayer', 'Alone ones break.'),
        s('slayer', 'Kill the father. The Mark says the father is the last of them.')],
      cues: {hero: cue('Tolaria. One last lesson.', 'For Rayne. For Hanna.', 'Not yet. Not until it is done.', 'It is done. Now let it burn.', 'Urza... you could have said something...', 'Only vengeance matters now.'),
        villain: cue('The old one is weak.', 'Excise.', 'The island... shakes...', 'Tolaria is Phyrexia.', 'Retreat. Retreat!')},
      after: [q('stage', 'For his family, Barrin made a funeral pyre of Tolaria.'),
        q('stage', '"I knew this day would come," said Urza. Looking at the destruction, Barrin sighed, "You don\'t have to revel in it."')]},
    {slot: 7, mood: 'march', kind: 'Meta', title: 'Remember Me?', difficulty: 'Normal', rewardSet: 'pls', teaches: ['Racing'],
      blurb: "On Rath, Crovax had Tahngarth tortured and remade. Now the stronghold has fallen onto Dominaria, Tahngarth has broken free, and the Fires of Yavimaya burn in his blood.",
      hero: {who: 'tahngarth', deck: {name: 'Fires of Yavimaya', colors: 'RG', list: `
4 Fires of Yavimaya
4 Raging Kavu
4 Yavimaya Barbarian
4 Blurred Mongoose
4 Kavu Titan
4 Skizzik
2 Tahngarth, Talruum Hero
4 Llanowar Elves
4 Assault // Battery
2 Ancient Kavu
12 Mountain
12 Forest`}},
      villain: {who: 'evincar', deck: {name: 'The Overlay', colors: 'B', list: `
4 Maggot Carrier
4 Nightscape Familiar
4 Volcano Imp
4 Phyrexian Bloodstock
2 Lord of the Undead
4 Spineless Thug
4 Crypt Rats
4 Slay
4 Dark Banishing
2 Gravedigger
24 Swamp`}},
      scene: [q('stage', '"Beautiful, isn\'t it?" crowed Crovax. "They fought together. Now they will die together."'),
        q('stage', '"Remember me?" Tahngarth roared. "Now I\'ll repay you for my stay on Rath!"'),
        q('stage', '"Crovax knows we\'re coming now," said a grinning Sisay. "I just sent the *Predator* crashing into his stronghold."'),
        s('tahngarth', 'Fires of Yavimaya gives every creature haste. Play them, swing at once, race him down.')],
      villainScene: [s('evincar', 'Yawgmoth promised me Dominaria. He gave me a burning ridge and a minotaur.'),
        s('evincar', 'Selenia would have hated what I am. I made sure she never saw it.'),
        q('evincar', 'He is Yawgmoth\'s reward to me. I shall kill him a hundred times a day.')],
      cues: {hero: cue('Remember me?', "They're ugly, and they're in my way.", 'Not again. Not his cell again...', 'That was for Mirri.', 'Get the others out. I will hold him.', 'Burn, Crovax. Burn.'),
        villain: cue('Kneel, cow.', 'Feast.', 'Selenia... I am so hungry...', 'Back in the cell.', 'This is not the end of my ascension.')},
      after: [q('stage', 'The decay of Crovax\'s ancestral home matched the state of his soul.'),
        s('stage', 'Crovax dies in the stronghold he stole. Nobody mourns him except, perhaps, a memory of an angel.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: "Yawgmoth's Agenda", difficulty: 'Hard', rewardCard: 'Phyrexian Arena', rewardSet: 'apc', teaches: ['Everything so far'],
      blurb: "The Dark Lord of Phyrexia has come to Dominaria himself. He was a Thran healer once. Now he is a god of machines, and he knows every hero's grief by name.",
      hero: {who: 'gerrard', deck: {name: 'The Legacy', colors: 'GW', list: `
2 Gerrard Capashen
2 Captain Sisay
4 Coalition Honor Guard
4 Llanowar Knight
4 Noble Panther
4 Charging Troll
4 Llanowar Elves
4 Steel Leaf Paladin
4 Armadillo Cloak
4 Pacifism
12 Forest
12 Plains`}},
      villain: {who: 'yawgmoth', deck: {name: "Yawgmoth's Agenda", colors: 'B', list: `
4 Phyrexian Arena
2 Desolation Angel
2 Phyrexian Gargantua
4 Phyrexian Reaper
4 Phyrexian Slayer
4 Plague Spitter
4 Ravenous Rats
4 Dark Banishing
4 Yawgmoth's Edict
2 Yawgmoth's Agenda
2 Twilight's Call
24 Swamp`}},
      scene: [s('yawgmoth', 'Gerrard. You look tired. Let me help.'), s('stage', "His shape blurs, and it is Hanna standing there. Hanna, smiling."),
        q('gerrard', "You're not my Hanna!"),
        q('urza', 'This is a battle of pawns, for the highest stakes imaginable.'),
        q('urza', 'Everything is in place. Nothing can happen that isn\'t part of my plan.'),
        s('gerrard', 'Then for once, Urza, I hope your plan is right.')],
      villainScene: [s('yawgmoth', 'Urza. Gerrard. The brother. The heir. The navigator. The cat.'),
        s('yawgmoth', 'I have their names. I have their griefs. That is all a god needs.'),
        s('yawgmoth', 'Come, little heir. Show me what four thousand years of planning bought.')],
      cues: {hero: cue('For Dominaria.', 'Wear courage as your armor. Wield honor as your blade.', "Hanna... I'm sorry...", 'It is finished.', "Don't mourn for me...", 'Everyone. Now. Together.'),
        villain: {...cue('Flesh is a mistake. I am the cure.', 'Behold perfection.', 'Impossible. I am the Father of Machines.', 'Rest now, Dominaria. The pain is over.', 'This flesh... remembers...'),
          half: {who: 'urza', line: 'Mishra? No. Not you. Not now. Focus, Urza.'}}}},
  ],
};
