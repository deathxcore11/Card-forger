// Act 7: The Mercadian Masques (Mercadian Masques, Nemesis, Prophecy). Story and dialogue:
// /mnt/project-files/story/act-7-script.md (generated from this file). Land set: mmq.
// Straight after Act 5: the Weatherlight tore out of Rath through Ertai's portal and fell onto Mercadia.
// Battles 1-4 are Mercadia, 5 and 7-8 are Rath under its new evincar, 6 is Jamuraa under the Keldons.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'masked-city-rebel-rath',
  intro: [s('stage', 'The portal spits the Weatherlight into a strange sky. Mirri is wrapped in a sail below decks. Ertai stayed behind.'),
    q('stage', 'Gerrard shook his head as the ground rushed to meet him. "This," he thought, "is not the start I was hoping for."'),
    s('stage', 'An upside-down mountain. A city on top of it, looking down on everything. Mercadia.'),
    s('sisay', 'Nobody touches my ship until I can stand up.'), s('gerrard', "Then lean on me. We're going up there to ask for help."),
    q('stage', 'In Mercadia City, loyalties extend only as far as your purse can stretch.')],
  finale: [s('stage', 'Rath. The rebels hold one burning ridge, and the stronghold still stands.'),
    q('eladamri', 'The Oracle told Eladamri he would save his people by abandoning them.'), s('eladamri', 'I know what it means now. I hate that I know.'),
    s('linsivvi', 'You lost your daughter to his assassins. Nobody would blame you for staying to finish it.'),
    s('eladamri', 'Staying is what he wants. Look up.'),
    q('stage', 'Denizens of Rath had never seen the moon before. It was a symbol of change, not constancy.'),
    s('stage', 'Rath is moving. The whole plane is turning toward Dominaria, like a mouth.'),
    s('stage', 'Far away, the Weatherlight sails home with its crew, its captain and its Legacy.'),
    q('stage', "Gerrard focused on the debts he'd settled . . . and on those he'd soon collect."),
    s('stage', 'Deep in the stronghold, Ertai is still alive. Belbe has made sure of it.')],
  villainFinale: [s('stage', 'The throne room. The rebels are gone. Crovax sits alone.'),
    q('evincar', 'Blood is foul, the flesh dross. My ascendance thirsts for life itself.'),
    s('evincar', 'Selenia used to stand there. She would tell me I was still a nobleman.'), s('evincar', 'I killed her. I would do it again. I hate that I would do it again.'),
    s('belbe', 'Your feelings are noted. Phyrexia has no use for them.'),
    q('belbe', 'Crovax never passes up an opportunity to cause widespread misery.'),
    s('evincar', 'Then let Dominaria see how much misery I can make. Begin the overlay.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Brainstorm', number: '61'},
    gerrard: {name: 'Gerrard', title: 'Heir of the Legacy', fixed: fixed('Gerrard Capashen', 'apc', '11', 'ccca800f-e850-4bec-95d0-70280b51b7a7', 'Brom'), focus: '50% 25%'},
    sisay: {name: 'Sisay', title: 'Captain of the Weatherlight', fixed: fixed('Sisay, Weatherlight Captain', 'mh1', '29', '5a293c45-1e73-4527-be2f-2dcd5c47b610', 'Anna Steinbauer'), focus: '50% 25%'},
    tahngarth: {name: 'Tahngarth', title: 'First Mate', fixed: fixed('Tahngarth, Talruum Hero', 'pls', '74', 'c1778f37-af01-4f8c-ab9d-a4c60abf7e78', 'Dave Dorman'), focus: '50% 25%'},
    squee: {name: 'Squee', title: 'General of the Kyren', card: 'Squee, Goblin Nabob', number: '214', focus: '50% 30%'},
    magistrate: {name: 'The Magistrate', title: 'Ruler of Mercadia City', card: 'Corrupt Official', focus: '50% 30%'},
    chomanno: {name: 'Cho-Manno', title: 'Cho-Arrim Revolutionary', card: 'Cho-Manno, Revolutionary', number: '8', focus: '50% 25%'},
    takara: {name: 'Takara', title: 'Rescued from Rath', card: 'Liability', focus: '50% 30%'},
    volrath: {name: 'Volrath', title: 'The Fallen', card: 'Volrath the Fallen', number: '75', focus: '50% 25%'},
    crovax: {name: 'Crovax', title: 'The Cursed', fixed: fixed('Crovax the Cursed', 'sth', '55', '88a9b76d-6ce1-40d4-bc04-7ae6237f5eaf', 'Pete Venters'), focus: '50% 25%'},
    evincar: {name: 'Crovax', title: 'Ascendant Evincar', card: 'Ascendant Evincar', number: '55', focus: '50% 25%'},
    belbe: {name: 'Belbe', title: 'Phyrexian Emissary', card: "Belbe's Armor", number: '126', focus: '50% 30%'},
    alexi: {name: 'Alexi', title: 'Zephyr Mage', card: 'Alexi, Zephyr Mage', number: '28', focus: '50% 25%'},
    latulla: {name: 'Latulla', title: 'Keldon Overseer', card: 'Latulla, Keldon Overseer', number: '95', focus: '50% 25%'},
    eladamri: {name: 'Eladamri', title: 'Korvecdal', fixed: fixed('Eladamri, Lord of Leaves', 'tmp', '224', '0b1689f3-9dfa-4525-90b3-7af15f7eb720', 'Ron Chironna'), focus: '50% 25%'},
    linsivvi: {name: 'Lin Sivvi', title: 'Defiant Hero', card: 'Lin Sivvi, Defiant Hero', number: '12', focus: '50% 25%'},
    ertai: {name: 'Ertai', title: 'Wizard Adept', fixed: fixed('Ertai, Wizard Adept', 'exo', '33', '91971e19-61ce-45ac-b700-9ffca5091a27', 'Terese Nielsen'), focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Inverted Mountain', difficulty: 'Easy', rewardSet: 'mmq', teaches: ['Alternate costs'],
      blurb: 'The Weatherlight came down hard below a city that sits on top of an upside-down mountain. Gerrard climbs up to ask for help. The city sends its guard down instead.',
      hero: {who: 'gerrard', deck: {name: 'The Weatherlight Crew', colors: 'RW', list: `
4 Steadfast Guard
4 Crossbow Infantry
4 Kyren Sniper
4 Ceremonial Guard
4 Shock Troops
4 Gerrard's Irregulars
4 Thunderclap
4 Lunge
4 Seal of Fire
12 Mountain
12 Plains`}},
      villain: {who: 'magistrate', deck: {name: "The Magistrate's Guard", colors: 'WU', list: `
4 Port Inspector
4 Darting Merfolk
4 Cloud Sprite
4 Alabaster Wall
4 Pious Warrior
4 Rishadan Airship
4 Ignoble Soldier
2 Daze
2 Misstep
4 Arrest
12 Plains
12 Island`}},
      scene: [s('magistrate', 'A ship fell out of the sky. Ships are worth a great deal. So are their crews.'),
        s('gerrard', "We're not for sale. We need water, a healer and a shipwright."),
        q('gerrard', "These guards are the most disciplined military unit in the city. They couldn't fight their way out of a broom closet, but they've got discipline."),
        s('magistrate', 'Everything is for sale, outsider. Guards. Bring me the ship.'),
        s('gerrard', 'Some of these spells cost a land instead of mana. Sacrifice the Mountain and the bolt is free. Use it when it counts.')],
      villainScene: [q('magistrate', 'We all must profit for peace to last.'), s('magistrate', 'This city has stood on its mountain for a thousand years by knowing who to sell to.'),
        s('magistrate', 'Somebody has already paid me for that ship. I am a man of my word, when the word is gold.')],
      cues: {hero: cue("Easy. Nobody needs to die over a boat.", "That's more like it.", 'Sisay... get the ship ready...', 'Tell your magistrate we said no.', 'They have the ship...', 'They really are disciplined.'),
        villain: cue('Seize them. Gently. They are merchandise.', 'Now that is a soldier worth his wages.', 'I am being robbed in my own city!', 'Put them in the cells. The ship goes to my buyer.', 'Write it in the ledger as a loss.')},
      after: [s('stage', 'The guards fail. The Magistrate smiles anyway, and invites Gerrard to dinner.'),
        q('stage', 'It was Gerrard\'s nature to lead and the Mercadians\' to follow.'),
        s('stage', 'By morning he is training the very soldiers who attacked him. He thinks he has found allies.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Uphill Battle', difficulty: 'Easy', rewardSet: 'mmq', teaches: ['Rebels'],
      blurb: "The Cho-Arrim live below the mountain and guard the Fountain of Cho. Mercadia wants the water. Its army has a new commander, and he doesn't know what he's marching against.",
      hero: {who: 'chomanno', deck: {name: 'The Cho-Arrim', colors: 'W', list: `
2 Cho-Manno, Revolutionary
4 Ramosian Sergeant
4 Ramosian Lieutenant
4 Ramosian Captain
4 Cho-Arrim Legate
4 Fresh Volunteers
4 Devout Witness
2 Ramosian Commander
4 Cho-Manno's Blessing
4 Arrest
24 Plains`}},
      villain: {who: 'gerrard', deck: {name: "Gerrard's Irregulars", colors: 'RW', list: `
4 Gerrard's Irregulars
4 Ceremonial Guard
4 Crossbow Infantry
4 Steadfast Guard
4 Shock Troops
4 Lightning Hounds
4 Iron Lance
4 Lunge
4 Thunderclap
12 Mountain
12 Plains`}},
      scene: [q('chomanno', 'Mercadia\'s masks can no longer hide the truth. Our day has come at last.'),
        s('chomanno', 'Look at their banner. They have a hero now. A tall man from the sky.'),
        q('stage', "Cho-Manno had never seen Mercadia City's forces fight so well. The magistrate must have hired a new hero."),
        s('chomanno', 'We do not kill if we can help it. We wound, we hold the ford, and we wait for him to look at what he is doing.'),
        s('chomanno', 'Every rebel can call another. Pay three, tap the sergeant, and a friend comes from your deck.')],
      villainScene: [s('gerrard', "They told me the Cho-Arrim are bandits who poison the city's water."),
        q('gerrard', 'The only way to get Mercadians to fight on the front lines is to give them really long weapons.'),
        s('gerrard', "Bandits don't usually hold a ford like that. Or carry their wounded. Something's wrong.")],
      cues: {hero: cue('For the Fountain.', 'The river is with us.', 'Do not break. Not yet.', 'Now he will come to talk. I can see it in his face.', 'The river will remember us.', 'There is a great difference between pain and injury.'),
        villain: cue('Form up! Shields high!', "That's how I trained you!", 'Hold the line... why are they not running?', "Stand down. Nobody touches the wounded.", "I'm on the wrong side of this, aren't I?")},
      after: [q('stage', "Cho-Manno knew he had no choice but to ally with Gerrard. If that's what it took to free his people, he'd pay the price."),
        q('stage', '"I did not choose my role, Orim," said Cho-Manno patiently, "and I suspect Gerrard did not choose his."')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'General Nuisance', difficulty: 'Easy', rewardSet: 'mmq', teaches: ['Spellshapers'],
      blurb: "The Kyren goblins secretly run half of Mercadia, and they've decided Squee is very important. They gave him a hat, an army and a war. Then they pointed it at the ship's first mate.",
      hero: {who: 'squee', deck: {name: 'The Kyren Host', colors: 'R', list: `
2 Squee, Goblin Nabob
4 Kyren Glider
4 Kyren Legate
4 Kyren Sniper
4 Hammer Mage
4 Lightning Hounds
4 Robber Fly
4 Mogg Toady
2 Ceremonial Guard
4 Seal of Fire
24 Mountain`}},
      villain: {who: 'tahngarth', deck: {name: 'Talruum Fury', colors: 'RG', list: `
4 Zerapa Minotaur
4 Veteran Brawlers
4 Branded Brawlers
4 Horned Troll
4 Snorting Gahr
4 Wild Jhovall
4 Lumbering Satyr
4 Invigorate
4 Flaming Sword
12 Mountain
12 Forest`}},
      scene: [q('stage', 'Mercadia\'s Kyren goblins are the opposite of Dominarian goblins: they\'re smart and cowardly.'),
        s('squee', 'They gave Squee a hat! Squee is GENERAL!'),
        q('squee', 'If I says it\'s a troll, it\'s a troll. Goblins is always right in Mercadia.'),
        s('squee', 'Who is we fighting? Big horns. Big angry. Kind of looks like...'), s('tahngarth', 'SQUEE.'),
        q('stage', '"General?!" Tahngarth roared. "General *nuisance*, maybe."'),
        s('squee', 'Mages! Throw a card away, make it a spell! Squee has lots of cards Squee does not understand!')],
      villainScene: [s('tahngarth', 'I was sent to clear a goblin nest. Nobody said the nest had a general.'),
        q('tahngarth', "It's not Talruum crystal, but I must admit—it gets the job done."),
        s('tahngarth', "I won't hurt him. Much. Gerrard would never let me hear the end of it.")],
      cues: {hero: cue('CHARGE! Squee means... you charge. Squee watches.', 'Squee made a BIG one!', 'Squee is resigning! Squee is a cabin boy again!', 'Squee wins! Squee keeps the hat!', 'Squee did not want to be general anyway.', 'Is it too late to say sorry?'),
        villain: cue('Come here, General.', 'Now we fight.', 'Beaten by a goblin in a hat. Never tell the crew.', 'Hat. Off. Now.', "You lot go on ahead. I'll keep killing them until it sticks.")},
      after: [q('stage', 'Squee watched his Kyren cousins fall with a mixture of sympathy and relief.'),
        s('tahngarth', 'The Kyren are not the bottom of this city, Squee. They are the hands under the table.'),
        s('squee', 'Whose table?'), s('tahngarth', "That's what worries me.")]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Helpless Woman', difficulty: 'Normal', rewardSet: 'mmq', teaches: ['Discard'],
      blurb: "On the way out of Rath, the crew rescued a frightened woman named Takara, Starke's daughter. She has been quiet ever since. Too quiet. Someone in Mercadia has known every move Gerrard makes.",
      hero: {who: 'gerrard', deck: {name: 'Heir of the Legacy', colors: 'RW', list: `
4 Steadfast Guard
4 Thermal Glider
4 Defiant Falcon
4 Shock Troops
4 Gerrard's Irregulars
4 Ramosian Sergeant
4 Righteous Indignation
4 Lunge
4 Seal of Fire
12 Mountain
12 Plains`}},
      villain: {who: 'takara', deck: {name: 'A Borrowed Face', colors: 'UB', list: `
2 Volrath the Fallen
4 Stronghold Biologist
4 Rootwater Commando
4 Sneaky Homunculus
4 Cloudskate
4 Phyrexian Driver
4 Seal of Removal
4 Vendetta
4 Specter's Wail
2 Stronghold Zeppelin
12 Island
12 Swamp`}},
      scene: [s('takara', 'Gerrard. I was so afraid when the guards came. Thank you for keeping me safe.'),
        s('gerrard', 'The Magistrate knew where Cho-Manno was hiding. Only four people knew. You were one.'),
        q('stage', "Gerrard realized that the helpless woman they'd rescued from Rath was nothing of the sort."),
        s('takara', "Oh, Gerrard. You always were slow."), s('stage', "Her face folds like wet paper. Volrath's smile comes through."),
        s('gerrard', "Where's Takara? The real one."), s('takara', "Her father asked me the same question. For a year.")],
      villainScene: [q('stage', "Starke knew the voice was Takara's, but the venom was Volrath's."),
        s('volrath', 'They replaced me on Rath. A cripple with a curse sits on my throne.'),
        s('volrath', 'I needed a place to wait, and a brother to watch. Mercadia sells everything, including silence.'),
        s('volrath', "When I take back my stronghold, I want you to hear about it, Gerrard. I want you to know you couldn't stop it twice.")],
      cues: {hero: cue("Take off the mask.", 'For Mirri.', 'Still faster than me...', 'Run back to Rath, then. I know the way now.', "He's gone. Again.", 'You were never her.'),
        villain: cue('Still the hero. Still alone.', 'Look, brother. A body built from what you threw away.', 'This shape is failing...', 'Father should have chosen me.', 'Keep the city. I have a throne to collect.')},
      after: [s('stage', 'Volrath steps through a mirror of black water and is gone.'),
        q('stage', 'Without a word, Gerrard and Sisay ran deeper into the mountain. Neither of them intended to leave Mercadia without the *Weatherlight* and its crew.')]},
    {slot: 5, mood: 'tension', kind: 'Meta', title: 'What Is Mine', difficulty: 'Normal', rewardSet: 'nem', teaches: ['Racing'],
      blurb: "Rath has a new evincar: Crovax, the cursed nobleman who murdered Mirri. Phyrexia's emissary Belbe chose him. Now Volrath has come home to take his throne back.",
      hero: {who: 'crovax', deck: {name: 'The Cursed', colors: 'B', list: `
4 Rathi Intimidator
4 Rathi Fiend
2 Rathi Assassin
4 Spineless Thug
4 Phyrexian Prowler
4 Plague Witch
2 Belbe's Percher
4 Vicious Hunger
4 Seal of Doom
4 Dark Ritual
24 Swamp`}},
      villain: {who: 'volrath', deck: {name: 'The Fallen', colors: 'UB', list: `
2 Volrath the Fallen
4 Stronghold Biologist
4 Stronghold Machinist
4 Rootwater Commando
4 Sneaky Homunculus
4 Cloudskate
4 Phyrexian Driver
4 Seal of Removal
4 Vendetta
2 Stronghold Zeppelin
12 Island
12 Swamp`}},
      scene: [q('volrath', "I've come to reclaim what is mine. And you, Greven, are mine."),
        s('crovax', 'Greven serves the throne. I am the throne.'),
        s('volrath', 'You are a nobleman who was afraid of the dark. Selenia picked you up off the floor.'), s('crovax', 'Do not say her name.'),
        s('belbe', 'Evincars are replaceable. Phyrexia will keep whichever of you is standing.'),
        s('crovax', 'Then race me, Volrath. Both of us bleeding. We will see who has more to give.')],
      villainScene: [s('volrath', 'I built this place. Every wall, every vat, every lie.'), s('volrath', 'Father gave Gerrard the Legacy. Phyrexia gave me the stronghold.'),
        s('volrath', 'I am not losing the second thing I was given to a boy who kills what he loves.')],
      cues: {hero: cue('Kneel.', 'I am the hunger now.', 'Selenia... I am so tired...', 'Things are going to change around here.', 'Not yet. I will not die yet.', 'Every wound only makes me hungrier.'),
        villain: cue('Off my throne.', 'A father of nothing. Look what I made anyway.', 'Not again... not twice...', 'Back in your cell, nobleman.', 'Phyrexia always chooses someone else.')},
      after: [s('stage', 'Volrath is never seen on the throne of Rath again.'),
        q('evincar', 'Things are going to change around here.'),
        s('belbe', 'Adequate. Begin preparing the plane for transit.')]},
    {slot: 6, mood: 'march', kind: 'Lesson', title: 'Keld Triumphant', difficulty: 'Normal', rewardSet: 'pcy', teaches: ['Rhystic'],
      blurb: "Back on Dominaria, the Keldon warlords have come south into Jamuraa, the land Gerrard grew up in. They believe a prophecy of five winds will make Keld rule the world. A zephyr mage named Alexi disagrees.",
      hero: {who: 'alexi', deck: {name: 'The Kipamu League', colors: 'WU', list: `
4 Glittering Lion
4 Diving Griffin
4 Sword Dancer
4 Reveille Squad
4 Coastal Hornclaw
4 Spiketail Hatchling
4 Rhystic Study
4 Excise
4 Withdraw
12 Plains
12 Island`}},
      villain: {who: 'latulla', deck: {name: 'The Keldon Host', colors: 'R', list: `
2 Lesser Gargadon
4 Keldon Arsonist
4 Keldon Berserker
2 Keldon Firebombers
4 Ridgeline Rager
4 Spur Grappler
4 Branded Brawlers
4 Whip Sergeant
4 Latulla's Orders
4 Panic Attack
24 Mountain`}},
      scene: [q('latulla', "You're willing to die for your homeland. I'm willing to kill for it."),
        q('alexi', 'Creation is no great feat. Anything you make, I can unmake in a heartbeat.'),
        s('latulla', 'Keld is cold, mage. Our children starve on ice. Jamuraa has rivers and nobody strong enough to keep them.'),
        s('alexi', "Then you could have asked. People share rivers."), s('latulla', 'Keldons do not ask.'),
        s('alexi', 'Rhystic spells work unless someone pays. If she wants to stop them, she has to spend her mana on it.')],
      villainScene: [q('latulla', 'Battle is our religion. This fortress is our temple.'),
        q('latulla', 'Fields can be replanted. Settlements can be rebuilt. Burn it all.'),
        s('latulla', 'When the five winds blow, Keld rises. I would rather it rose over ashes than over my own people\'s graves.')],
      cues: {hero: cue('Hold the line, League.', 'Drakes!', 'Too many... there are too many...', 'Go home, Latulla. Keld will still be there.', 'Fall back to the river.', "The trick is to ask when no one's listening."),
        villain: cue('The sword or the lash. Choose.', 'Wound, maim, kill.', 'One woman? ONE woman?', 'Jamuraa is Keld now.', 'Keld will remember this river.')},
      after: [q('stage', '"Tell me again," said Latulla, raising her fist, "how just one woman held back an entire Keldon platoon."'),
        s('stage', 'The Keldons pull back. Their prophecy does not. The winds are still coming.')]},
    {slot: 7, mood: 'tension', kind: 'Rival', title: 'Uneasy Allies', difficulty: 'Normal', rewardSet: 'nem', teaches: ['Fading'],
      blurb: "On Rath, two rebel leaders meet: Eladamri of the Skyshroud elves and Lin Sivvi of the Vec. They both want Crovax dead. They have never agreed on anything else.",
      hero: {who: 'eladamri', deck: {name: 'Skyshroud', colors: 'G', list: `
4 Blastoderm
4 Skyshroud Sentinel
4 Skyshroud Cutter
4 Skyshroud Ridgeback
4 Coiling Woodworm
4 Wild Mammoth
2 Skyshroud Behemoth
2 Nesting Wurm
4 Mossdog
4 Seal of Strength
24 Forest`}},
      villain: {who: 'linsivvi', deck: {name: 'The Vec Defiant', colors: 'W', list: `
2 Lin Sivvi, Defiant Hero
4 Defiant Falcon
4 Defiant Vanguard
4 Defender en-Vec
4 Lawbringer
4 Lightbringer
4 Netter en-Dal
4 Silkenfist Fighter
2 Chieftain en-Dal
4 Topple
24 Plains`}},
      scene: [s('linsivvi', 'Your elves hid in the trees for a hundred years while my people died in the stronghold.'),
        s('eladamri', 'My elves are alive because they hid. Yours are dead because they did not.'),
        s('linsivvi', 'Say that again with a sword in your hand.'),
        s('stage', 'Among the rebels is a quiet woman who has never set foot in Mercadia. Her name is Takara.'),
        s('eladamri', 'Fine. To first blood. Then we plan.'),
        s('eladamri', 'Fading creatures arrive strong and wear out. Each turn they lose a counter. Hit hard before they are gone.')],
      villainScene: [s('linsivvi', "The Vec don't want saving by elves. We want a seat at the table when this ends."),
        s('linsivvi', 'If he wants to lead us, he can beat us first. That is how the Vec choose.'),
        s('linsivvi', 'And if he is as good as they say, I will follow him into the stronghold myself.')],
      cues: {hero: cue('To first blood.', 'Skyshroud wakes.', 'She fights like a whole army...', 'Now we plan. Together.', 'Enough. You lead the charge, then.', 'Not bad for a Vec.'),
        villain: cue('Show me, Korvecdal.', 'Defiant!', 'Fine, fine, the trees can fight...', 'The Vec lead. Get behind us.', "You'll do.")},
      after: [q('stage', 'In darkness, the assassin sneaked into the village and destroyed what Eladamri loved most: his daughter.'),
        s('linsivvi', 'Eladamri... I am sorry. I am so sorry.'), s('eladamri', 'Get everyone up. We march on the stronghold tonight.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Ascendant Evincar', difficulty: 'Hard', rewardCard: 'Ascendant Evincar', rewardSet: 'nem', teaches: ['Lords'],
      blurb: 'Crovax sits on Volrath\'s throne with Phyrexia behind him. His curse makes him stronger as everything around him dies. The rebels are going to the stronghold anyway.',
      hero: {who: 'eladamri', deck: {name: 'The Rebellion', colors: 'GW', list: `
2 Lin Sivvi, Defiant Hero
4 Defiant Vanguard
4 Defiant Falcon
4 Blastoderm
4 Wild Mammoth
4 Lawbringer
4 Skyshroud Sentinel
4 Topple
4 Seal of Strength
2 Rhox
12 Forest
12 Plains`}},
      villain: {who: 'evincar', deck: {name: "The Evincar's Court", colors: 'B', list: `
2 Ascendant Evincar
2 Rathi Assassin
4 Rathi Fiend
4 Rathi Intimidator
4 Phyrexian Prowler
4 Plague Witch
4 Spineless Thug
4 Dark Ritual
4 Seal of Doom
2 Massacre
2 Vicious Hunger
24 Swamp`}},
      scene: [q('evincar', 'Let all witness the fate of those who defy me.'),
        s('eladamri', 'You killed my daughter.'), s('evincar', 'I killed many daughters. You will have to be more specific.'),
        s('linsivvi', 'He wants you angry. Stay cold.'),
        q('ertai', 'I\'m constantly amazed by the tenacity of living creatures on this plane. Even in the stronghold\'s white-hot core, life persists.'),
        s('eladamri', 'Ertai is alive in there. Somewhere.'),
        s('linsivvi', 'His power makes every black creature bigger and every other one smaller. Kill the lord and the army shrinks.')],
      villainScene: [q('evincar', 'Kill them all and feed them to the new recruits.'),
        s('evincar', 'Selenia was the last person who looked at me without fear. I made sure she was the last.'),
        s('belbe', 'Win quickly, Evincar. The plane must be ready to move.'),
        q('evincar', 'Blood is foul, the flesh dross. My ascendance thirsts for life itself.')],
      cues: {hero: cue('For Skyshroud. For the Vec. For her.', 'The forest walks with us!', 'Hold... hold...', 'The stronghold still stands. But it bleeds.', 'Fall back! Save who you can!', 'Stay cold. Stay cold.'),
        villain: {...cue('Things are going to change around here.', 'Feast.', 'Selenia... was this what you saw in me?', 'Feed them to the recruits.', 'This is not over. Rath is moving.', 'Every death feeds me.'),
          half: {who: 'belbe', line: 'Evincar. Phyrexia is watching. Do better.'}}}},
  ],
};
