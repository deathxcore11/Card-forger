// Act 4: The Jamuraan War (Mirage, Visions, Fifth Edition). Story and dialogue:
// /mnt/project-files/story/act-4-script.md. Land set: mir. Easy, Normal, then a Hard boss.
// Lines marked quote: true are real Mirage/Visions flavor text, said by the person the card credits.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
export default {
  vibe: 'west-african-desert-jungle',
  intro: [
    {who: 'stage', line: 'A rift. Heat. Sand that hums.'},
    {who: 'hakim', line: 'Another one, out of the air. The omens were right, then.'},
    {who: 'hakim', line: "Welcome to Jamuraa, stranger. You've come at the worst possible time."},
    {who: 'hakim', line: 'Mangara, our greatest mage, is gone. Kaervek has taken his power.'},
    {who: 'kaervek', line: 'Mangara is gone. Who among you doubts that I have taken his power?', quote: true, offstage: true}],
  finale: [
    {who: 'asmira', line: 'The amber. Help me.'},
    {who: 'hakim', line: 'Holy Avenger, it needs more than prayer. It needs...'},
    {who: 'asmira', line: 'I know what it needs.'},
    {who: 'stage', line: "Gold light. The amber cracks open. Mangara breathes. Asmira doesn't."},
    {who: 'hakim', line: "...but the price of Mangara's freedom was Asmira's life.", quote: true},
    {who: 'mangara', line: 'Your arrogance amazes me, Kaervek. Did you not know the price you would pay?', quote: true},
    {who: 'kaervek', line: 'I knew. I just thought someone else would pay it.'},
    {who: 'rashida', line: 'Someone did.'},
    {who: 'stage', line: "Later. Teferi's Isle, at dusk."},
    {who: 'teferi', line: "He wasn't wrong, you know. Kaervek. Something is coming."},
    {who: 'teferi', line: "If it comes for Zhalfir, I'll hide all of it. Somewhere no war can follow."},
    {who: 'teferi', line: 'Time may heal all wounds, but what heals time?', quote: true},
    {who: 'stage', line: "The isle phases out. You're standing in the sea."}],
  villainFinale: [
    {who: 'stage', line: "Zhalfir's capital. Smoke. A throne room with nobody in it."},
    {who: 'kaervek', line: 'Kneel.'},
    {who: 'stage', line: 'Nobody is left to kneel.'},
    {who: 'kaervek', line: 'The end justifies the means. What do I care if I rule over the dead rather than over the living?', quote: true},
    {who: 'kaervek', line: 'The dead ask fewer questions.'},
    {who: 'stage', line: 'In the corner, Mangara still sleeps in his amber. Kaervek sits down beside it.'},
    {who: 'kaervek', line: 'You were the only one who ever argued back.'},
    {who: 'stage', line: "Far away, something enormous turns to look at Dominaria. It doesn't care who won."}],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Inspiration', number: '35'},
    jabari: {name: 'Sidar Jabari', title: "General of Zhalfir", card: 'Sidar Jabari', number: '39', focus: '62% 30%'},
    telimtor: {name: "Telim'Tor", title: "Suq'Ata Cavalry General", card: "Telim'Tor", number: '197', focus: '62% 25%'},
    teferi: {name: 'Teferi', title: 'Court Mage of Zhalfir', fixed: fixed('Teferi, Mage of Zhalfir', 'tsp', '83', '3c0145f6-4e27-49e7-9ef6-bac6fa3de26d', 'D. Alexander Gregory & Jeremy Jarvis'), focus: '50% 25%'},
    rashida: {name: 'Rashida Scalebane', title: 'Dragon Slayer of Femeref', card: 'Rashida Scalebane', number: '35', focus: '45% 25%'},
    purraj: {name: 'Purraj of Urborg', title: 'Night Stalker', card: 'Purraj of Urborg', number: '135', focus: '50% 20%'},
    asmira: {name: 'Asmira', title: 'Holy Avenger of Femeref', card: 'Asmira, Holy Avenger', number: '256', focus: '50% 25%'},
    jolrael: {name: 'Jolrael', title: 'Empress of Beasts', fixed: fixed('Jolrael, Empress of Beasts', 'tsb', '81', '01084157-60e5-4693-bbec-be60b0b4e04f', 'Matthew D. Wilson'), focus: '50% 25%'},
    hakim: {name: 'Hakim', title: 'Loreweaver of Femeref', card: 'Hakim, Loreweaver', number: '68', focus: '40% 25%'},
    shauku: {name: 'Shauku', title: 'Endbringer of Urborg', card: 'Shauku, Endbringer', number: '142', focus: '45% 20%'},
    pashad: {name: 'Pashad ibn Asim', title: "Suq'Ata Trader", card: 'Prosperity', number: '40', focus: '40% 40%'},
    talibah: {name: 'Talibah', title: "Suq'Ata Embermage", card: 'Fireblast', number: '79', focus: '50% 25%'},
    kaervek: {name: 'Kaervek', title: 'Warlord of the Burning Isles', fixed: fixed('Kaervek the Merciless', 'tsp', '242', '444fa5a5-b5b0-4555-bd69-67c1c0cbf317', 'rk post'), focus: '50% 25%'},
    mangara: {name: 'Mangara', title: 'of Corondor', fixed: fixed('Mangara of Corondor', 'tsp', '28', 'a785b66c-c5a4-4520-a9fa-aa199f7f56e5', 'Zoltan Boros & Gabor Szikszai'), focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'march', kind: 'Arrival', title: "The Lancers of Suq'Ata", difficulty: 'Easy', rewardSet: 'mir', teaches: ['Flanking'],
      blurb: "You land in the middle of a cavalry charge. Zhalfir's general grabs your reins before you can ask whose side you're on.",
      hero: {who: 'jabari', deck: {name: "Jabari's Knights", colors: 'W', list: `
4 Zhalfirin Knight
4 Zhalfirin Commander
4 Knight of Valor
4 Femeref Knight
4 Infantry Veteran
4 Ekundu Griffin
2 Sidar Jabari
2 Pearl Dragon
4 Pacifism
2 Healing Salve
2 Warrior's Honor
24 Plains`}},
      villain: {who: 'telimtor', deck: {name: "Telim'Tor's Lances", colors: 'R', list: `
2 Telim'Tor
4 Suq'Ata Lancer
4 Talruum Minotaur
4 Viashino Warrior
4 Goblin Elite Infantry
4 Mountain Goat
4 Hill Giant
4 Dwarven Warriors
2 Barreling Attack
2 Goblin Hero
2 Mons's Goblin Raiders
24 Mountain`}},
      scene: [{who: 'jabari', line: 'You. Out of the sky. Can you ride?'}, {who: 'jabari', line: "Doesn't matter. Hold on."},
        {who: 'telimtor', line: 'Jabari! Forty lances on my left. Sixty on my right. How many have you?'}, {who: 'jabari', line: 'Enough to be remembered.'},
        {who: 'telimtor', line: 'Kaervek pays in gold, Jabari. Zhalfir pays in songs.'},
        {who: 'jabari', line: 'Command is the act of balancing on a vine and convincing others that it is firm ground.', quote: true},
        {who: 'jabari', line: "That vine is us. Ride beside me. Never in front."}],
      villainScene: [{who: 'telimtor', line: "The Suq'Ata trade. Silk, spice, lances. This season, lances."}, {who: 'telimtor', line: 'Kaervek is winning. I ride with whoever is winning.'},
        {who: 'telimtor', line: "Never stop 'til you see your lance come out the other side.", quote: true}],
      cues: {hero: cue('Flank them. Always flank.', "There's the vine. Firm ground.", "Destiny's cutting it close.", "Tell Telim'Tor's paymaster he's short a general.", 'Fall back to Tefemburu...'),
        villain: cue('One charge. Two. Count them.', "That's a hundred lances, Jabari.", "I've lost count. Bad sign.", 'Gold, then. Always gold.', 'Zhalfir pays in songs. Write me a short one.')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: "Teferi's Isle", difficulty: 'Easy', rewardSet: 'mir', teaches: ['Phasing'],
      blurb: "Jabari sends you to Zhalfir's court mage for help. The court mage is a thousand years old, lives on an island that isn't always there, and wants to play first.",
      hero: {who: 'you', deck: {name: 'Out of Time', colors: 'U', list: `
4 Teferi's Imp
4 Merfolk Raiders
4 Teferi's Drake
4 Shimmering Efreet
2 Breezekeeper
2 Sandbar Crocodile
2 Azimaet Drake
4 Unsummon
4 Memory Lapse
4 Inspiration
2 Cloak of Invisibility
24 Island`}},
      villain: {who: 'teferi', deck: {name: "Teferi's Tricks", colors: 'U', list: `
4 Daring Apprentice
4 Merfolk Seer
4 Azure Drake
4 Homarid Warrior
2 Harmattan Efreet
2 Labyrinth Minotaur
2 Air Elemental
4 Boomerang
2 Force Spike
4 Impulse
2 Teferi's Curse
2 Unsummon
24 Island`}},
      scene: [{who: 'teferi', line: 'You walked straight onto the isle. Most people need three tries.'},
        {who: 'teferi', line: 'The island phases. Here, then not. Like most of my friends.'},
        {who: 'teferi', line: 'Can you prepare for the unexpected? No, you cannot. You can prepare only to be surprised.', quote: true},
        {who: 'teferi', line: "Jabari wants my help with Kaervek. I want to know if you're worth my time."},
        {who: 'teferi', line: 'So. A game. Your cards will step out of time and back. Try to keep up.'},
        {who: 'teferi', line: 'I had a teacher who played like this once. He never said sorry either.'}],
      villainScene: [{who: 'teferi', line: 'A planeswalker? Here? Oh, this is going to be fun.'}, {who: 'teferi', line: "Let's see how you play when your army keeps disappearing."}],
      cues: {hero: cue(null, null, null, null, null), villain: cue('Blink and you\'ll miss it.', 'Made you look.', 'Careless, like a child with fire, so was I with time.', 'Again! Same time yesterday?', "Good. Now I'm worried about Kaervek, not you.")}},
    {slot: 3, mood: 'tension', kind: 'Lesson', title: 'The Song of Blood', difficulty: 'Easy', rewardSet: 'mir', teaches: ["Instants on the opponent's turn"],
      blurb: 'A Femeref village goes quiet at sunset. Something is singing in the grass. Rashida has been waiting for it for three nights.',
      hero: {who: 'rashida', deck: {name: "Scalebane's Watch", colors: 'RW', list: `
3 Rashida Scalebane
4 Zhalfirin Knight
4 Ekundu Griffin
4 Burning Shield Askari
4 Suq'Ata Lancer
4 Femeref Knight
4 Incinerate
4 Hope Charm
3 Volcanic Geyser
2 Healing Salve
2 Divine Retribution
2 Flood Plain
10 Plains
10 Mountain`, prefer: ['mir']}},
      villain: {who: 'purraj', deck: {name: 'The Night Stalkers', colors: 'B', list: `
2 Purraj of Urborg
4 Pit Scorpion
2 Breathstealer
2 Vampire Bats
4 Shadow Guildmage
2 Harbinger of Night
2 Drudge Skeletons
4 Gravebane Zombie
4 Skulking Ghost
4 Sewer Rats
2 Scathe Zombies
2 Cadaverous Knight
2 Bog Rats
24 Swamp`}},
      scene: [{who: 'rashida', line: "Don't light a fire. He's drawn to it."}, {who: 'rashida', line: "He hunts at dusk. He kills while you're busy."},
        {who: 'rashida', line: "So we'll be busy on HIS turn."}, {who: 'purraj', line: 'Tell me... have you ever sung the Song of Blood?', quote: true},
        {who: 'rashida', line: "Once. I don't like the tune."}, {who: 'purraj', line: 'Death is not a debt I am yet willing to pay.', quote: true},
        {who: 'rashida', line: "Hold your fire until he's mid-leap."}],
      villainScene: [{who: 'purraj', line: 'Kaervek calls us night stalkers. "Willing tools."'}, {who: 'purraj', line: 'He thinks the swamp takes orders. The swamp takes everything.'},
        {who: 'purraj', line: 'Tonight, the village dances.'}],
      cues: {hero: cue('Wait for it.', 'Mid-leap. Told you.', "I've been bitten by worse. Dragons, mostly.", 'The children sleep tonight.', 'Get them inside. Now.'),
        villain: cue('Hmmmm.', 'The chorus!', 'You... interrupted my verse.', 'Encore.', 'The song... ends... early.')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Amber Prison', difficulty: 'Normal', rewardSet: 'mir', teaches: ['Locking creatures down'],
      blurb: "Deep in the Mwonvuli jungle, Mangara hangs inside a block of amber like a fly. The jungle's empress has been told to keep him there.",
      hero: {who: 'asmira', deck: {name: "Asmira's Faithful", colors: 'GW', list: `
2 Asmira, Holy Avenger
4 Femeref Archers
4 Mtenda Lion
4 Noble Elephant
4 Iron Tusk Elephant
4 Ekundu Griffin
4 Pacifism
4 Aysen Bureaucrats
2 Barl's Cage
2 Femeref Healer
2 Divine Offering
2 Elephant Grass
2 Grasslands
10 Plains
10 Forest`}},
      villain: {who: 'jolrael', deck: {name: 'Children of the Mwonvuli', colors: 'G', list: `
4 Mtenda Lion
4 Bull Elephant
2 Gibbering Hyenas
2 Ley Druid
4 Jolrael's Centaur
4 Stalking Tiger
2 King Cheetah
2 Grizzly Bears
2 Crash of Rhinos
2 Llanowar Elves
4 Rampant Growth
2 Giant Growth
2 Fog
24 Forest`}},
      scene: [{who: 'asmira', line: 'There he is. Mangara. He looks... asleep.'}, {who: 'jolrael', line: 'He is not asleep. He is kept. As you will be, if you touch it.'},
        {who: 'asmira', line: 'Jolrael. You hid from Zhalfir for centuries. Why come out for Kaervek?'},
        {who: 'jolrael', line: 'I have hidden from the machinations of Zhalfir for centuries. Why should I join your campaign?', quote: true},
        {who: 'jolrael', line: 'Kaervek promised the Mwonvuli would be left alone. Zhalfir never did.'},
        {who: 'asmira', line: 'Kaervek imprisoned Mangara out of jealousy, but he taints Jamuraa simply out of spite.', quote: true},
        {who: 'asmira', line: "He'll keep his promise to you exactly as long as it's useful."}, {who: 'jolrael', line: 'I need no army. I have Jamuraa.', quote: true}],
      villainScene: [{who: 'jolrael', line: 'Every hundred years, a Zhalfirin army marches through my trees.'}, {who: 'jolrael', line: 'Every hundred years, my trees are fewer.'},
        {who: 'jolrael', line: 'Kaervek swore by fire he would never set foot here. I chose the lesser fire.'}],
      cues: {hero: cue('Faith is my shield.', 'Hold them still. Gently.', 'Faith is my shield, and hope is my armor; I am vulnerable only to myself.', "We're coming back for you, Mangara.", 'Not yet. But soon.'),
        villain: cue('The jungle wakes.', 'What need have I for cavalry when I can have horse and rider both in one?', 'The mists are thinning.', 'Leave my jungle.', "Go, then. I didn't see you.")},
      after: [{who: 'stage', line: "Asmira's prayers crack the amber. They don't break it."}, {who: 'hakim', line: "Asmira's prayers alone should have freed Mangara from the amber prison...", quote: true}]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Last Library', difficulty: 'Normal', rewardSet: 'mir', teaches: ['Counterspells'],
      blurb: "Kaervek's ally has come for Femeref's library. She doesn't want to burn it. She wants to rewrite it.",
      hero: {who: 'hakim', deck: {name: 'The Loreweaver', colors: 'U', list: `
2 Hakim, Loreweaver
4 Daring Apprentice
4 Harmattan Efreet
2 Air Elemental
4 Azure Drake
4 Shimmering Efreet
4 Counterspell
4 Power Sink
4 Memory Lapse
4 Inspiration
24 Island`}},
      villain: {who: 'shauku', deck: {name: "Shauku's Pen", colors: 'B', list: `
2 Mindstab Thrull
2 Abyssal Specter
2 Scathe Zombies
2 Fallen Angel
2 Bog Imp
4 Gravebane Zombie
4 Urborg Mindsucker
4 Dark Ritual
4 Coercion
4 Painful Memories
4 Drain Life
2 Dread Specter
24 Swamp`}},
      scene: [{who: 'hakim', line: 'Femeref was guided by the wisdom of the Council of Voices. But in one terrible instant, they were slain.', quote: true},
        {who: 'hakim', line: 'Their names are in this library. If it falls, they die twice.'},
        {who: 'shauku', line: "Loreweaver. I don't burn books. Barbarians burn books."},
        {who: 'shauku', line: 'I write upon clean white parchment with a sharp quill and the blood of my students.', quote: true},
        {who: 'shauku', line: 'Let me write your ending. It will be beautiful.'},
        {who: 'hakim', line: 'Every spell she casts is a sentence. We say no to every sentence.'}],
      villainScene: [{who: 'shauku', line: 'History belongs to whoever holds the pen.'},
        {who: 'shauku', line: 'When I am done, Femeref will remember Kaervek as its saviour. And me as its scholar.'},
        {who: 'shauku', line: 'I no longer believe in a final resting place.', quote: true}],
      cues: {hero: cue('Not in my library.', 'No. Struck from the record.', "I'm running out of pages.", 'Their names stay written.', 'Save the scrolls! The scrolls!'),
        villain: cue('Shall we begin the chapter?', 'The flesh is a casket for the soul.', 'How very rude.', 'The end. Beautifully done.', 'A draft. Only a draft.')}},
    {slot: 6, mood: 'comic', kind: 'Meta', title: 'Prosperity', difficulty: 'Normal', rewardSet: 'vis', teaches: ['Racing a card-draw engine'],
      blurb: "On your way to the front you stop in a Suq'Ata bazaar for water. You leave owing a merchant a duel, two goats and an apology. His machines make everyone draw. He's the one holding the fireball.",
      hero: {who: 'you', deck: {name: 'Thirsty Traveller', colors: 'WU', list: `
4 Infantry Veteran
4 Zhalfirin Knight
4 Mtenda Herder
4 Femeref Knight
4 Harmattan Efreet
2 Counterspell
2 Unsummon
4 Memory Lapse
4 Healing Salve
4 Pacifism
4 Flood Plain
10 Plains
10 Island`}},
      villain: {who: 'pashad', deck: {name: 'Everybody Draws', colors: 'UR', archetype: 'Prosperity', list: `
4 Howling Mine
4 Prosperity
4 Inspiration
4 Kaervek's Torch
4 Volcanic Geyser
3 Fireball
4 Memory Lapse
4 Counterspell
2 Impulse
3 Incinerate
12 Island
12 Mountain`}},
      scene: [{who: 'pashad', line: 'Friend! Stranger! Friend-stranger! You look thirsty. And rich.'}, {who: 'pashad', line: 'Water, one coin. Water that heals, two coins.'},
        {who: 'pashad', line: 'Eternal life or your money back.', quote: true}, {who: 'pashad', line: 'No? You said no? To Pashad?'},
        {who: 'pashad', line: 'Nobody says no to Pashad. It is very bad for business.'}, {who: 'pashad', line: 'Very well. A wager. If I win, you buy everything.'},
        {who: 'pashad', line: 'My machines are very fair. Everybody draws. EVERYBODY.'},
        {who: 'pashad', line: 'Everybody draws! Everybody prospers! Mostly me.'}],
      villainScene: [{who: 'pashad', line: 'Wealth is a good thing, compared to poverty. Your food is better, your robes are softer.', quote: true},
        {who: 'pashad', line: 'The war is terrible for business. Except the business of war, which is wonderful.'},
        {who: 'pashad', line: "A planeswalker customer! Do they pay in other worlds' coins? Let's find out."}],
      cues: {hero: cue(null, null, null, null, null), villain: cue("Let's make a deal!", 'Look at all these cards! Everybody gets some!', 'This is not how the deal was described to me.', 'Two goats. And the apology, in writing.', "Fine! Free water. Don't tell anyone.")},
      after: [{who: 'pashad', line: "A map to Kaervek's camp. Mostly accurate. For you, half price."}, {who: 'hakim', line: "It's entirely accurate. That's what worries me. Why does a merchant have it?"}]},
    {slot: 7, mood: 'march', kind: 'Meta', title: 'Fireblast', difficulty: 'Normal', rewardSet: 'vis', teaches: ['Racing'],
      blurb: "The map was accurate. So was the ambush. Kaervek's embermages hold the road to his camp, and they don't negotiate. The original red curve deck.",
      hero: {who: 'jabari', deck: {name: 'The Vanguard of Zhalfir', colors: 'W', list: `
4 Infantry Veteran
4 Zhalfirin Knight
4 Femeref Knight
4 Knight of Valor
4 Ekundu Griffin
4 Benalish Hero
2 Pearl Dragon
4 Pacifism
2 Warrior's Honor
4 Healing Salve
24 Plains`}},
      villain: {who: 'talibah', deck: {name: 'Sligh', colors: 'R', archetype: 'Sligh', list: `
4 Mountain Goat
4 Goblin Hero
4 Viashino Warrior
4 Suq'Ata Lancer
4 Talruum Minotaur
2 Burning Shield Askari
2 Incinerate
2 Fireblast
4 Dwarven Soldier
2 Hurloon Minotaur
4 Hill Giant
2 Brassclaw Orcs
22 Mountain`}},
      scene: [{who: 'jabari', line: "Common soldiers can't understand what a sidar knows: the enemy can be a resource.", quote: true},
        {who: 'jabari', line: 'So, embermage. Surrender, and your fire serves Zhalfir.'}, {who: 'talibah', line: 'AAAAAAAAAAAAAAH!'},
        {who: 'jabari', line: "...I'll take that as no."}, {who: 'jabari', line: 'Fast, then. We win before she finishes screaming.'}],
      villainScene: [{who: 'talibah', line: "Comfortable even in a furnace? I've never met one who'd accept my wager.", quote: true},
        {who: 'talibah', line: 'Kaervek promised the Burning Isles would never kneel to Zhalfir again.'},
        {who: 'talibah', line: 'I was born on a volcano. I know exactly how long a mountain can wait.'}, {who: 'talibah', line: 'Not one day more.'}],
      cues: {hero: cue('Charge before she lights.', 'Do not underestimate the power of many against one.', 'My soldiers fought without hesitation, died without doubt.', 'One resource, captured.', 'Pull back. Pull back!'),
        villain: cue('BURN!', 'Blow, fiery wind of truth.', 'I have one more. I always have one more.', 'Ash. All of it.', 'Next time... a bigger volcano.')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: "Kaervek's Torch", difficulty: 'Hard', rewardCard: "Kaervek's Torch", rewardSet: 'mir', teaches: ['Everything so far'],
      blurb: "Three nations that have hated each other for centuries ride together into Kaervek's camp. He's been expecting them. He seems almost pleased.",
      hero: {who: 'asmira', deck: {name: 'The Reeds of a Basket', colors: 'GWR', list: `
2 Asmira, Holy Avenger
2 Sidar Jabari
2 Rashida Scalebane
4 Knight of Valor
4 Femeref Knight
4 Burning Shield Askari
4 Stalking Tiger
4 Uktabi Orangutan
4 Incinerate
2 Warrior's Honor
2 Pacifism
2 Divine Offering
2 Grasslands
2 Mountain Valley
8 Plains
6 Forest
6 Mountain`}},
      villain: {who: 'kaervek', deck: {name: "Kaervek's War", colors: 'BR', list: `
4 Dark Ritual
4 Kaervek's Torch
2 Incinerate
2 Scathe Zombies
4 Abyssal Specter
4 Nekrataal
2 Emberwilde Djinn
2 Fallen Angel
4 Suq'Ata Assassin
2 Kaervek's Purge
2 Kaervek's Hex
2 Fireball
2 Soul Rend
4 Rocky Tar Pit
10 Swamp
10 Mountain`}},
      scene: [{who: 'asmira', line: 'We are to be bound together as the reeds of a basket.', quote: true},
        {who: 'jabari', line: "Suq'Ata believe in trade; Femeref, alms; Zhalfirins, steel. Be warned, Kaervek. Now we are joined.", quote: true},
        {who: 'kaervek', line: 'Joined. Good. You see? It only took a war.'}, {who: 'asmira', line: 'You murdered the Council of Voices.'},
        {who: 'kaervek', line: 'The council argued for eleven years about a well.'}, {who: 'kaervek', line: 'Something is coming, Holy Avenger. Not me. Something older.'},
        {who: 'kaervek', line: 'The secrets of Phyrexia are expensive. You will pay in brass and bone, steel and sinew.', quote: true},
        {who: 'kaervek', line: 'When it comes, a continent of councils dies. A fist survives.'}, {who: 'rashida', line: "And you're the fist."},
        {who: 'kaervek', line: 'Someone has to be.'}, {who: 'asmira', line: 'Then let someone else be the hand that opens.'}],
      villainScene: [{who: 'kaervek', line: 'They call me merciless. They have never seen what is coming.'},
        {who: 'kaervek', line: 'Kill a creature, destroy the present. Kill the land, destroy the future.', quote: true},
        {who: 'kaervek', line: "I'll burn Zhalfir down to the stone, and build something that survives the burning."},
        {who: 'kaervek', line: 'Since I cannot stop death, I choose to stop life.', quote: true}],
      cues: {hero: cue('Tread upon the meek, and they shall wound your feet.', 'This is a war without neutrality.', "I've dreamt of a second harvest but fear I will not see it.", "It's over. Now free him.", 'Hold together... the basket holds...'),
        villain: cue('Begin.', 'Only fools believe they will face my armies but once.', 'If it is weak, either kill it or ignore it.', 'Jamuraa will look to only one leader.', "You'll wish you'd let me win. When it comes.",
          {who: 'jolrael', line: 'I have seen the horrors Kaervek has freed. My betrayal is certain, but of Kaervek or of Jamuraa, I cannot say.'})}},
  ],
};
