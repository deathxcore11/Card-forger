// Act 5: The Rath Cycle (Weatherlight prologue, Tempest, Stronghold, Exodus). Story and dialogue:
// /mnt/project-files/story/act-5-script.md. Land set: tmp. Easy, Normal, then Hard (RecSur and the boss).
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'dark-biomech-skyship',
  intro: [s('stage', 'Clouds. A skyship. Cannon fire.'), q('gerrard', 'This won\'t be a fair fight. They should have brought a second ship!'),
    s('hanna', "Gerrard, they've got Sisay! The Predator's pulling away!"), s('greven', 'The evincar sends his regards, heir. Come and fetch her.'),
    s('stage', 'The Predator tears a hole in the sky and vanishes through it.'), s('gerrard', 'I left this ship. I left all of it. And she came for me anyway.'),
    s('gerrard', 'Hanna. Plot a course through that hole.'), s('hanna', "That's not a course. That's a wound."), s('gerrard', 'Then we follow the blood.')],
  finale: [s('stage', 'Volrath steps back into a portal. Gone.'), s('gerrard', 'Sisay!'), s('sisay', 'My ship...'),
    q('gerrard', 'Intact. Which is more than I can say for you, my friend.'), s('stage', 'Sisay laughs despite the pain.'),
    q('lyna', 'In Barrin\'s name! Ertai sends word that the portal is open, but not for long!'),
    q('hanna', "It'll get us out, but I can't guarantee what it'll do to the ship."),
    {who: 'ertai', line: 'Go. Someone has to hold it. Obviously it\'s me.', offstage: true},
    s('stage', 'The Weatherlight runs for the portal. Below decks, Mirri follows a shape skulking in the dark.'),
    s('stage', 'A scream. Gerrard finds her. Crovax is already gone.'), s('mirri', "Didn't... tell you..."), s('gerrard', "Don't. Save it. Orim!"),
    q('mirri', 'Just as you see the grave and remember the friend...'),
    s('stage', 'The ship tears out of Rath. Ertai is not on it. Mirri does not wake.'),
    q('karn', 'Twice I have let the Legacy slip away. Never again.')],
  villainFinale: [s('stage', 'Gerrard in chains in the throne room.'), s('volrath', "Look at you. Father's chosen one."),
    s('volrath', 'I wanted you to see the globe. Every city. Every name.'), s('gerrard', "They'll stop you."),
    s('volrath', "Oh, not me. I'm only the evincar. I just keep the seat warm."),
    s('stage', 'A voice from the portal, older than both of them: "Evincars are replaceable."'),
    s('stage', "Volrath doesn't turn around. For the first time, his hands shake.")],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Insight', number: '68'},
    gerrard: {name: 'Gerrard', title: 'Heir of the Legacy', fixed: fixed('Gerrard Capashen', 'apc', '11', 'ccca800f-e850-4bec-95d0-70280b51b7a7', 'Brom'), focus: '50% 25%'},
    volrath: {name: 'Volrath', title: 'Evincar of Rath', fixed: fixed('Volrath the Fallen', 'nem', '75', '08bdd66e-9ca1-456e-a61c-7c96cf6f7c56', 'Kev Walker'), focus: '50% 25%'},
    sisay: {name: 'Sisay', title: 'Captain of the Weatherlight', fixed: fixed('Sisay, Weatherlight Captain', 'mh1', '29', '5a293c45-1e73-4527-be2f-2dcd5c47b610', 'Anna Steinbauer'), focus: '50% 25%'},
    mirri: {name: 'Mirri', title: 'Cat Warrior', card: 'Mirri, Cat Warrior', number: '114', focus: '50% 25%'},
    ertai: {name: 'Ertai', title: 'Wizard Adept', card: 'Ertai, Wizard Adept', number: '33', focus: '50% 25%'},
    squee: {name: 'Squee', title: 'Goblin Cabin Hand', fixed: fixed('Squee, Goblin Nabob', 'mmq', '214', '4ba8325a-1203-4125-9111-94d9e2b1f14b', 'David Monette'), focus: '50% 30%'},
    karn: {name: 'Karn', title: 'Silver Golem', fixed: fixed('Karn, Silver Golem', 'usg', '298', '811a0988-2900-426c-9413-8f1778d99678', 'Mark Zug'), focus: '50% 25%'},
    tahngarth: {name: 'Tahngarth', title: 'First Mate', fixed: fixed('Tahngarth, Talruum Hero', 'pls', '74', 'c1778f37-af01-4f8c-ab9d-a4c60abf7e78', 'Dave Dorman'), focus: '50% 25%'},
    orim: {name: 'Orim', title: 'Samite Healer', card: 'Orim, Samite Healer', number: '33', focus: '50% 25%'},
    hanna: {name: 'Hanna', title: 'Navigator', fixed: fixed("Hanna, Ship's Navigator", 'inv', '249', '83a4e48d-6452-4245-bdad-63fe3263550e', 'Dave Dorman'), focus: '50% 25%'},
    crovax: {name: 'Crovax', title: 'The Cursed', card: 'Crovax the Cursed', number: '55', focus: '50% 25%'},
    greven: {name: 'Greven il-Vec', title: 'Commander of the Predator', card: 'Commander Greven il-Vec', number: '115', focus: '50% 25%'},
    vhati: {name: 'Vhati il-Dal', title: "Greven's Second", card: 'Vhati il-Dal', number: '274', focus: '50% 25%'},
    lyna: {name: 'Lyna', title: 'Soltari Emissary', card: 'Soltari Emissary', number: '42', focus: '50% 25%'},
    dauthi: {name: 'Dauthi Slayer', title: 'Shadow Killer', card: 'Dauthi Slayer', number: '126', focus: '50% 25%'},
    rootwater: {name: 'Rootwater Shaman', title: 'Merfolk of the Lake', card: 'Rootwater Shaman', number: '84', focus: '50% 30%'},
    eladamri: {name: 'Eladamri', title: 'Lord of Leaves', card: 'Eladamri, Lord of Leaves', number: '224', focus: '50% 25%'},
    starke: {name: 'Starke', title: 'Of Rath', card: 'Starke of Rath', number: '205', focus: '50% 25%'},
    shifter: {name: "Volrath's Shapeshifter", title: 'Wears Any Face', card: "Volrath's Shapeshifter", number: '48', focus: '50% 30%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Shadow Lands', difficulty: 'Easy', rewardSet: 'tmp', teaches: ['Shadow'],
      blurb: "The Weatherlight crashes through into Rath. Ertai goes ahead to scout the portal and finds he isn't alone. Half the people here are standing in another world.",
      hero: {who: 'lyna', deck: {name: 'The Soltari', colors: 'W', list: `
4 Soltari Foot Soldier
4 Soltari Lancer
4 Soltari Monk
4 Soltari Priest
4 Soltari Trooper
2 Soltari Champion
4 Soltari Crusader
4 Soltari Emissary
4 Pacifism
2 Gerrard's Battle Cry
24 Plains`}},
      villain: {who: 'dauthi', deck: {name: 'The Dauthi', colors: 'B', list: `
4 Dauthi Slayer
4 Dauthi Horror
4 Dauthi Marauder
2 Dauthi Mercenary
2 Dauthi Embrace
4 Rats of Rath
4 Darkling Stalker
4 Bounty Hunter
4 Dark Banishing
2 Diabolic Edict
2 Coercion
24 Swamp`}},
      scene: [q('ertai', "I'm too modest a wizard to reveal the full extent of my abilities."),
        q('lyna', 'You see our world when you shut your eyes so tightly that tiny shapes float before them.'),
        s('ertai', 'A ghost. Wonderful. Are you here to be impressed?'), q('lyna', 'I am here because the Dauthi are. They have knives for every soul.'),
        s('lyna', "You can't touch them. They can't touch you. Only we can. Stand behind me.")],
      villainScene: [s('dauthi', 'The ghosts brought a living one. How kind.'), s('dauthi', 'The Dauthi believe they dignify murder by paying for it. We were paid in advance.')],
      cues: {hero: cue('Between worlds, we fight.', 'They never see us coming.', 'The shadow thins...', 'Tell your captain the portal holds.', 'Fall back into the half-light!'),
        villain: cue('Knives out.', 'The Dauthi army grows by screams and bounds.', 'Ghosts bleed?', 'Paid in full.', 'Another night.')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: "Ertai's Lecture", difficulty: 'Easy', rewardSet: 'tmp', teaches: ['Buyback'],
      blurb: "The Weatherlight needs fresh water. The only lake belongs to merfolk who don't like visitors. Ertai volunteers, mostly so he can explain spells to everyone.",
      hero: {who: 'ertai', deck: {name: 'The Adept', colors: 'UR', list: `
2 Ertai, Wizard Adept
4 Capsize
4 Whispers of the Muse
4 Searing Touch
4 Wind Drake
4 Horned Turtle
2 Rootwater Hunter
4 Mawcor
4 Counterspell
2 Mana Leak
2 Shock
16 Island
8 Mountain`}},
      villain: {who: 'rootwater', deck: {name: 'The Rootwater', colors: 'U', list: `
4 Rootwater Shaman
4 Rootwater Hunter
4 Rootwater Diver
4 Rootwater Matriarch
4 Thalakos Drifters
4 Horned Turtle
4 Wind Drake
4 Manta Riders
4 Dismiss
24 Island`}},
      scene: [q('gerrard', 'Ugh! When did orcs and fish start having kids?'), s('ertai', "Watch closely. A real wizard doesn't cast a spell once."),
        s('ertai', 'He pays a little more, and keeps it.'), s('mirri', "If that arrogant brat doesn't shut up soon, I'm having him for dinner."),
        q('ertai', 'Gone today, here tomorrow.'), s('rootwater', 'Leave the lake, dry-skins.'), q('ertai', 'Temper, temper.')],
      villainScene: [s('rootwater', "Every season, the evincar's ships drink our lake lower."), s('rootwater', 'Now a new ship. A new mouth. No more.')],
      cues: {hero: cue('Pay attention. There will be a quiz.', 'Again. Because I can.', 'This is a teaching moment. For me.', 'Was that it?', 'It was probably a lousy spell in the first place.'),
        villain: cue('Into the deep.', 'The lake rises!', 'Dry... too dry...', 'Stay thirsty.', 'Take your water. Choke on it.')}},
    {slot: 3, mood: 'tension', kind: 'Lesson', title: 'The Hive', difficulty: 'Easy', rewardSet: 'tmp', teaches: ['Slivers'],
      blurb: 'Hunting for the Stronghold, the crew blunders into a sliver warren. Karn walks in alone and starts talking to the queen. Then Greven\'s hunters arrive, and the hive has to choose a side.',
      hero: {who: 'you', deck: {name: 'The Hive', colors: 'RGW', list: `
4 Muscle Sliver
4 Metallic Sliver
4 Talon Sliver
4 Heart Sliver
4 Horned Sliver
4 Armor Sliver
4 Spined Sliver
2 Victual Sliver
4 Shock
2 Gerrard's Battle Cry
8 Forest
8 Mountain
8 Plains`}},
      villain: {who: 'vhati', deck: {name: 'The Hunting Party', colors: 'BR', list: `
2 Vhati il-Dal
4 Mogg Fanatic
4 Mogg Conscripts
4 Rats of Rath
4 Sarcomancy
4 Jackal Pup
4 Flowstone Sculpture
4 Dark Banishing
4 Kindle
2 Darkling Stalker
12 Swamp
12 Mountain`}},
      scene: [q('hanna', 'We must learn how they protect each other.'), q('mirri', "After they're done trying to kill us, all right?"),
        q('karn', 'We are kinfolk. Just as you need your progeny to complete you, so do I need the pieces of the Legacy.'),
        s('stage', 'The hive goes quiet. Then it turns to face the cave mouth.'),
        s('vhati', 'Commander Greven will want the golem. And... whatever those are.'), s('karn', 'I will not fight. They will. Lead them well.')],
      villainScene: [q('vhati', 'Sir, I just thought...'), s('vhati', "...that if I bring back the golem, Greven might stop throwing me off things."), s('vhati', "It's a good plan. It's a good plan.")],
      cues: {hero: cue(null, null, null, null, null),
        villain: cue('For Greven! Mostly.', "He'll have to promote me now!", 'This is going on my record.', 'Bag the golem. Carefully!', "Don't tell Greven. Please don't tell Greven.")}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: "Selenia's Shard", difficulty: 'Normal', rewardSet: 'sth', teaches: ['Gaining life'],
      blurb: 'Crovax came to Rath to save his angel. He found her serving Volrath, and his sword found her before his mind did. Now the curse is waking. Mirri is the only one who sees it.',
      hero: {who: 'mirri', deck: {name: "Mirri's Watch", colors: 'GW', list: `
2 Mirri, Cat Warrior
4 Spike Feeder
4 Soltari Priest
4 Elven Warhounds
4 Charging Rhino
4 Trained Armodon
4 Skyshroud Elite
4 Pacifism
4 Natural Spring
2 Gallantry
12 Forest
12 Plains`}},
      villain: {who: 'crovax', deck: {name: "Crovax's Hunger", colors: 'B', list: `
4 Skyshroud Vampire
4 Vampire Hounds
4 Dauthi Horror
4 Carnophage
4 Coercion
4 Dark Banishing
4 Evincar's Justice
2 Dark Ritual
2 Fevered Convulsions
4 Rats of Rath
24 Swamp`}},
      scene: [s('crovax', 'For a sharp second, Selenia froze, and my blade found home.'), s('crovax', 'She shattered like glass. And something in me shattered with her.'),
        s('mirri', "You've been skulking around the ship at night. You smell like the death pits."),
        q('crovax', 'When I cut down my angel I only started my fall.'), s('crovax', 'I gazed upon the dead, and for one dark moment I saw a banquet.'),
        s('mirri', "Then you don't sit at Gerrard's table. Not tonight. Not ever.")],
      villainScene: [q('crovax', 'My family sheltered in her light, the dark was content to wait.'), s('crovax', "It waited long enough. I'm so hungry, cat."),
        q('crovax', 'I am confined by sleep and defined by nightmare.')],
      cues: {hero: cue('I can smell the curse on you.', 'The forest stands with me.', 'Not... yet.', 'Go. Before the others see what you are.', 'Gerrard... watch him...'),
        villain: cue('Forgive me.', 'There are terrors lurking in the unseen corners of us all.', 'Selenia, help me...', "I'm sorry. I'm so hungry.", 'Memory is a burden that wears at the soul.')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: "The Traitor's Daughter", difficulty: 'Normal', rewardSet: 'sth', teaches: ['The graveyard'],
      blurb: "The Skyshroud elves agree to guide the crew to the Stronghold. Their guide is Starke, who used to teach Volrath. He has a daughter in those cells, and he has already made a deal.",
      hero: {who: 'eladamri', deck: {name: 'Skyshroud Rising', colors: 'GB', list: `
2 Eladamri, Lord of Leaves
4 Skyshroud Elite
4 Gravedigger
4 Trained Armodon
4 Charging Rhino
4 Elven Warhounds
2 Recurring Nightmare
4 Dark Ritual
4 Dark Banishing
4 Mulch
12 Forest
12 Swamp`}},
      villain: {who: 'starke', deck: {name: "Starke's Bargain", colors: 'BR', list: `
4 Mogg Fanatic
4 Bounty Hunter
4 Kindle
4 Rolling Thunder
4 Kezzerdrix
4 Flowstone Hellion
4 Mogg Flunkies
4 Dauthi Mercenary
4 Dark Banishing
12 Swamp
12 Mountain`}},
      scene: [q('eladamri', 'We have been patient. We have planned our attack. We are ready... now.'),
        q('starke', "Watch yourself. These plants aren't nice when they're hungry."), s('eladamri', 'You led us into the gardens on purpose.'),
        q('starke', 'I know to whom I owe the most loyalty, and I see him in the mirror every day.'),
        s('starke', "No. That's a lie I used to tell. My daughter's in there."), s('starke', "Volrath said: the elves, or Takara. I'm sorry, elf. I chose."),
        s('eladamri', 'Then my dead will choose too. Rise, Skyshroud.')],
      villainScene: [q('starke', 'The sanctity of poverty is an invention of the rich.'), s('starke', 'Loyalty is too. Takara is all I own.'),
        s('starke', "Forgive me, Lord of Leaves. Or don't. Just stay down.")],
      cues: {hero: cue('It is our duty to endure.', 'Let Volrath choke on his crop of hatred.', 'We were not made for war.', 'Go find your daughter, Starke.', 'The shroud... remembers...'),
        villain: cue('Nothing personal.', "Once they've marked you, the world is made of glass.", 'It is the nature of evil to turn you against yourself.', 'Hold on, Takara.', "Then I'll find another way. I always do.")}},
    {slot: 6, mood: 'comic', kind: 'Meta', title: 'Moggs Aboard', difficulty: 'Normal', rewardSet: 'exo', teaches: ['Racing'],
      blurb: 'The Predator rams the Weatherlight and a thousand moggs pour over the rail. Tahngarth has wanted this fight for weeks. Squee recognises some of them. The red deck of 1998.',
      hero: {who: 'tahngarth', deck: {name: "Tahngarth's Charge", colors: 'RG', list: `
4 Canyon Wildcat
4 Trained Armodon
4 Charging Rhino
2 Rootbreaker Wurm
4 Lowland Giant
4 Elven Warhounds
4 Shock
4 Wall of Blossoms
4 Rolling Thunder
2 Overrun
12 Forest
12 Mountain`}},
      villain: {who: 'greven', deck: {name: 'Sligh', colors: 'R', archetype: 'Sligh', list: `
4 Jackal Pup
4 Mogg Fanatic
4 Mogg Flunkies
4 Mogg Conscripts
4 Fireslinger
4 Cursed Scroll
4 Shock
4 Kindle
4 Rolling Thunder
24 Mountain`}},
      scene: [q('greven', 'I will flay the skin from your flesh and the flesh from your bones.'), q('tahngarth', 'Taste my horns!'),
        s('squee', "Hey! Dat's my cousin Gurk! HI GURK!"), s('tahngarth', 'Goblin. Below deck.'), s('squee', 'But he owes me a bug!'),
        {who: 'hanna', line: 'The match between Tahngarth and Greven was close only in the mind of the minotaur.', quote: true, offstage: true}],
      villainScene: [q('greven', 'Rage is the only freedom left me.'), s('greven', "Volrath's spine in my back. Volrath's voice in my head. Volrath's ship under my feet."),
        s('greven', 'But this minotaur? This one I get to break myself.')],
      cues: {hero: cue('Hold your position! Leave doubt for the dying!', 'You want to know your enemy? Look at your feet while you trample him.', 'Where I come from, stone stays on the ground.', 'Off my ship.', "Torahn's horns..."),
        villain: cue('Moggs! Over the rail!', 'Fear rules those weak enough to accept it.', 'Vhati! VHATI!', 'Chain him. The evincar has plans for horns.', 'Retreat. And someone find me Vhati.')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'The Laboratory', difficulty: 'Hard', rewardSet: 'exo', teaches: ['Playing against reanimation'],
      blurb: 'Inside the Stronghold, the crew finds Volrath\'s laboratory, where the dead are works in progress. Something in there is wearing Gerrard\'s face. Survival and Recurring Nightmare, the engine of 1998.',
      hero: {who: 'orim', deck: {name: 'The Samite Way', colors: 'W', list: `
2 Orim, Samite Healer
4 Soltari Priest
4 Soltari Monk
4 Soltari Lancer
4 Paladin en-Vec
4 Knight of Dawn
4 Elite Javelineer
4 Pacifism
2 Light of Day
2 Disenchant
2 Gerrard's Battle Cry
24 Plains`}},
      villain: {who: 'shifter', deck: {name: 'RecSur', colors: 'GBU', archetype: 'RecSur', list: `
4 Survival of the Fittest
3 Recurring Nightmare
4 Wall of Blossoms
4 Spike Feeder
2 Spike Weaver
4 Bottle Gnomes
4 Gravedigger
2 Volrath's Shapeshifter
2 Rootbreaker Wurm
2 Spike Colony
1 Reanimate
4 Dark Banishing
10 Forest
8 Swamp
6 Island`}},
      scene: [s('orim', 'Gerrard? You went ahead...'), s('shifter', "I did. Come in, Orim. It's quite safe."), s('orim', 'Gerrard never says "quite".'),
        s('shifter', 'Think of them not as failures but as works in progress.'), s('shifter', "My enemies' death yields threefold benefit: removal, reuse, and research."),
        q('orim', 'As usual, there will be time for prayer only after the worst happens.')],
      villainScene: [s('shifter', 'I am whoever the master needs.'), s('shifter', 'Today he needs a healer. In pieces. For research.')],
      cues: {hero: cue('The healer weaves the threads of life.', 'It is the art of convincing someone to live.', 'Prayer rarely explains.', 'Stay dead. Please.', "Gerrard... it isn't you..."),
        villain: cue('Hello, Orim.', 'Rise. Again. Better.', 'My face is slipping.', 'Research complete.', 'Enjoy your deception.')},
      after: [q('gerrard', "Enjoy your deception, Vuel. I'll count this one as practice."), s('stage', "Volrath's features melt from the dead shapeshifter.")]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: "Volrath's Stronghold", difficulty: 'Hard', rewardCard: 'Volrath\'s Shapeshifter', rewardSet: 'sth', teaches: ['Everything so far'],
      blurb: "The heart of the Stronghold. A globe of Dominaria with every city marked. And the brother Gerrard hasn't seen since they were boys.",
      hero: {who: 'gerrard', deck: {name: 'The Weatherlight Crew', colors: 'RGW', list: `
2 Mirri, Cat Warrior
2 Orim, Samite Healer
4 Elite Javelineer
4 Knight of Dawn
4 Canyon Wildcat
4 Trained Armodon
4 Charging Rhino
4 Shock
4 Kindle
2 Gerrard's Battle Cry
2 Pacifism
8 Plains
8 Mountain
8 Forest`}},
      villain: {who: 'volrath', deck: {name: "The Evincar's Court", colors: 'UB', list: `
4 Dauthi Slayer
4 Dauthi Horror
2 Volrath's Shapeshifter
4 Gravedigger
4 Dark Ritual
4 Counterspell
4 Dismiss
1 Reanimate
2 Recurring Nightmare
4 Dark Banishing
3 Mana Leak
12 Swamp
12 Island`}},
      scene: [q('gerrard', "You'd almost think Volrath doesn't want me here."), q('gerrard', 'This is Dominaria!'), s('volrath', 'Hello, brother.'), s('gerrard', 'Vuel.'),
        s('volrath', 'Father gave you his sword, his name, the Legacy. He gave me a room down the hall.'),
        s('volrath', 'Phyrexia gave me a world. Guess which one I\'m keeping.'), s('gerrard', "Where's Sisay?"),
        q('volrath', 'The fatal flaw in every plan is the assumption that you know more than your enemy.'),
        q('gerrard', "You've got your childhood wish at last. Now you get to die.")],
      villainScene: [q('volrath', 'Rath grows, and I am nourished.'), s('volrath', "They'll say I did it for Phyrexia. I did it so he'd finally look at me."),
        q('volrath', 'If there is such a thing as too much power, I have not discovered it.')],
      cues: {hero: cue("This won't be a fair fight.", "We called them 'armored lightning.'", "Destiny, chance, fate, fortune. They're all just ways of claiming your successes.", "It's over, Vuel. Where is she?", 'Mirri... get them out...'),
        villain: cue('Begin, brother.', 'You will learn to earn death.', 'My plan\'s elegance leads my enemies to believe it is spite that fuels me.', 'Predictable little man.', "This isn't over. It was never about this room.")}},
  ],
};
