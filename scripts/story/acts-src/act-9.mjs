// Act 9: The Mirari (Odyssey, Torment, Judgment). Story and dialogue:
// /mnt/project-files/story/act-9-script.md (generated from this file). Land set: ody.
// About a century after Act 8: Dominaria is broken and slowly healing. On the continent of Otaria,
// a silver sphere called the Mirari falls into a Cabal fighting pit. Every quoted line is real flavor text.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'otarian-pit-fights-dementia',
  intro: [s('stage', 'A hundred years after the Phyrexians. Dominaria has scars where whole nations used to be.'),
    s('stage', 'On the continent of Otaria, the Cabal runs the pits. People bet on who bleeds.'),
    q('stage', 'The crowd roared, the fighters bled, and the dead piled high in the pits. Only the Cabal could win.'),
    s('kamahl', "Tonight's prize is a silver ball nobody can explain. I don't need to understand it. I just need to win it."),
    q('braids', 'It offers you what you want, not what you need.')],
  finale: [s('stage', 'Krosa, the great forest. Kamahl carries the Mirari into its heart, his sister\'s blood still on his hands.'),
    s('kamahl', 'Everyone who touched it wanted more. I wanted more.'), s('kamahl', 'Jeska wanted me to stop. I did not stop.'),
    s('seton', 'Then put it down, Kamahl. Give it to the forest. Let something grow from it.'),
    s('stage', 'He drives the Mirari into the ground like a sword.'),
    q('stage', "The Mirari's magic transformed the Krosan Forest—and its inhabitants."),
    s('stage', 'The trees grow in an hour what should take a thousand years. Something old is waking in Krosa.'),
    s('stage', 'Far away, the Cabal carries Jeska into a room with no windows. She is still breathing.')],
  villainFinale: [s('stage', 'The Cabal vault. The Mirari pulses like a dead sun.'),
    q('patriarch', 'Each syllable chills your veins. Each word rattles your mind.'),
    s('patriarch', 'The barbarian thinks he lost his sister. He lost nothing. We found her.'),
    s('patriarch', 'Bring the girl. Bring the Mirari. We will make something the Order will kneel to.'),
    s('braids', 'And if it wakes up angry?'), s('patriarch', 'Then she will be very useful.'),
    s('stage', 'The Mirari was never anyone\'s. It only wanted to be found.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Careful Study', number: '70'},
    kamahl: {name: 'Kamahl', title: 'Pit Fighter', card: 'Kamahl, Pit Fighter', number: '198', focus: '50% 25%'},
    jeska: {name: 'Jeska', title: 'Warrior Adept', card: 'Jeska, Warrior Adept', number: '93', focus: '50% 25%'},
    seton: {name: 'Seton', title: 'Centaur Druid', card: 'Seton, Krosan Protector', number: '267', focus: '50% 25%'},
    teroh: {name: 'Teroh', title: 'Major of the Order', card: 'Major Teroh', number: '8', focus: '50% 25%'},
    collector: {name: 'The Nut Collector', title: 'Krosan Hermit', card: 'Nut Collector', number: '259', focus: '50% 30%'},
    torturer: {name: 'Cabal Torturer', title: 'Pit Champion', card: 'Cabal Torturer', number: '53', focus: '50% 30%'},
    surgeon: {name: 'Cabal Surgeon', title: 'Recruiter', card: 'Cabal Surgeon', number: '52', focus: '50% 30%'},
    robber: {name: 'Cabal Grave Robber', title: 'Small Businessman', card: 'Decompose', number: '128', focus: '50% 30%'},
    chainer: {name: 'Chainer', title: 'Dementia Master', card: 'Chainer, Dementia Master', number: '56', focus: '50% 25%'},
    laquatus: {name: 'Laquatus', title: 'Cephalid Ambassador', card: 'Ambassador Laquatus', number: '23', focus: '50% 30%'},
    braids: {name: 'Braids', title: 'Dementia Summoner', card: 'Braids, Cabal Minion', number: '117', focus: '50% 25%'},
    patriarch: {name: 'The Patriarch', title: 'Head of the Cabal', fixed: fixed('Cabal Patriarch', 'ody', '120', '0d2f0da3-a13e-4a45-98dc-6227cf952a5e', 'Mark Zug'), focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Pit Fights', difficulty: 'Easy', rewardSet: 'ody', teaches: ['Combat math'],
      blurb: "Kamahl is a barbarian from the mountains who fights in the Cabal's pits for coin. Tonight the prize is the Mirari. The Cabal's champion has never lost.",
      hero: {who: 'kamahl', deck: {name: 'The Pit Fighter', colors: 'R', list: `
2 Kamahl, Pit Fighter
4 Barbarian Lunatic
4 Dwarven Grunt
4 Halberdier
4 Minotaur Explorer
4 Pardic Firecat
4 Ember Beast
4 Longhorn Firebeast
2 Balthor the Stout
4 Firebolt
24 Mountain`}},
      villain: {who: 'torturer', deck: {name: 'The House Champion', colors: 'B', list: `
4 Cabal Torturer
4 Zombie Cannibal
4 Dirty Wererat
4 Filthy Cur
4 Gravegouger
4 Infected Vermin
4 Skull Fracture
4 Ghastly Demise
4 Organ Grinder
24 Swamp`}},
      scene: [q('kamahl', 'Pain teaches lessons no scholar can.'),
        s('torturer', 'The barbarian. Twelve wins. The house says thirteen is unlucky.'),
        q('kamahl', 'True strength lies in action. Let the weak react to me.'),
        s('jeska', 'Count before you swing, brother. Their power against your toughness. Every attack is arithmetic.'),
        s('kamahl', "I'm counting. One of us goes home.")],
      villainScene: [s('torturer', 'The Cabal feeds me, houses me, heals me between bouts.'), s('torturer', 'All I have to do is win. And when I lose, I will be fed to the next one.'),
        s('torturer', 'The Cabal offers power to anyone willing to take it. I took it. Look where it got me.')],
      cues: {hero: cue('Ring the bell.', 'Now you see it.', 'Still standing... still standing...', 'Thirteen.', "Get me out of the pit, Jeska.", 'Arithmetic. Right.'),
        villain: cue('The house always wins.', 'The crowd loves this one.', 'The house... is losing...', 'Feed him to the next one.', 'Nobody remembers the twelfth win.')},
      after: [s('stage', 'Kamahl takes the Mirari from the pit floor. It is warm in his hand, and it hums.'),
        q('stage', 'Deep within the Cabal\'s vault, the Mirari pulsed like a dead sun—and its darkness radiated across Otaria.'),
        s('stage', 'By morning, the Cabal, the Order and the cephalids of the sea all know his name.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: "Krosa's Keepers", difficulty: 'Easy', rewardSet: 'ody', teaches: ['Threshold'],
      blurb: "Seton is a centaur druid who guards the Krosan Forest. The Cabal is recruiting at its edge, offering power to anyone who will take it. Seton's beasts get stronger as the battle goes on.",
      hero: {who: 'seton', deck: {name: "Seton's Grove", colors: 'G', list: `
4 Werebear
4 Krosan Avenger
4 Nimble Mongoose
4 Centaur Chieftain
4 Krosan Beast
4 Seton's Scout
2 Seton, Krosan Protector
4 Call of the Herd
4 Muscle Burst
2 Roar of the Wurm
24 Forest`}},
      villain: {who: 'surgeon', deck: {name: "The Cabal's Offer", colors: 'B', list: `
4 Cabal Surgeon
4 Childhood Horror
4 Frightcrawler
4 Bloodcurdler
4 Mortivore
4 Grotesque Hybrid
4 Execute
4 Afflict
4 Cabal Ritual
24 Swamp`}},
      scene: [q('seton', 'Nature is the endless dance between life and death.'),
        s('surgeon', 'Such a big forest. Such a lot of bodies to work with.'),
        q('surgeon', 'We offer power to anyone willing to take it.'),
        q('seton', 'True strength comes from within. The false promise of unnatural power only incurs Krosa\'s wrath.'),
        s('seton', 'Threshold: once seven cards are in your graveyard, my beasts grow. The longer we fight, the stronger the forest gets.')],
      villainScene: [s('surgeon', 'The Order calls us monsters. The Order also lets its poor starve.'), s('surgeon', 'The Cabal pays. The Cabal heals. The Cabal only asks for a little of you in return.'),
        s('surgeon', 'Every corpse in that forest is a recruit who has not signed yet.')],
      cues: {hero: cue('Krosa wakes.', 'The herd answers.', 'Even the trees are bleeding...', 'Go back to your pits.', 'Krosa will remember this.', 'Seven cards. Now the forest fights.'),
        villain: cue('Sign here.', 'A fine specimen.', 'My patients... are leaving...', 'Another recruit for the pits.', 'The offer stands.')},
      after: [q('seton', "Don't dismiss its anger as mindless fury. I assure you, it has purpose.")]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Keep an Eye on the Squirrels', difficulty: 'Easy', rewardSet: 'ody', teaches: ['Flashback'],
      blurb: "A Cabal grave robber has come to Krosa to dig up the dead. The forest's oldest hermit and his squirrels have opinions about that. The dead stay buried. The squirrels keep coming back.",
      hero: {who: 'collector', deck: {name: 'The Squirrels of Krosa', colors: 'G', list: `
4 Nut Collector
4 Squirrel Mob
4 Squirrel Nest
4 Chatter of the Squirrel
4 Acorn Harvest
4 Druid Lyrist
4 Krosan Wayfarer
4 Elephant Ambush
4 Muscle Burst
24 Forest`}},
      villain: {who: 'robber', deck: {name: 'Cabal Grave Robbers', colors: 'B', list: `
4 Gravedigger
4 Zombie Cannibal
4 Morgue Theft
4 Decompose
4 Gravegouger
4 Dusk Imp
4 Fledgling Imp
4 Skull Fracture
4 Ghastly Demise
24 Swamp`}},
      scene: [q('stage', "In the Krosan Forest, you've got to keep an eye out for the squirrels."),
        q('robber', 'Sheesh! How am I supposed to make a decent living around here?'),
        s('collector', 'The dead are ours. The nuts are ours. The whole forest is ours, and it is not for sale.'),
        s('robber', "Look, pal, I've got a quota. Six skeletons by Thursday."),
        s('collector', 'Flashback lets a spell come back from the graveyard for its other cost. Squirrels are like that too.')],
      villainScene: [s('robber', 'The Cabal pays by the bone. Good bones. Clean bones.'),
        q('robber', 'Just what I need—more competition.'),
        s('robber', "Nobody told me the squirrels were armed.")],
      cues: {hero: cue('Squirrels! Positions!', 'The Mob is here!', 'They are digging up my acorns...', 'And stay out of Krosa!', 'Regroup at the big tree!', 'More squirrels. Always more squirrels.'),
        villain: cue('Just passing through. With a shovel.', 'Now that is a fine skeleton.', 'Why are there so MANY of them?', "Quota met. Don't follow me.", 'That does it—I quit!')},
      after: [q('robber', 'That does it—I quit!'), s('collector', 'He will be back. They always come back. So do we.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: "Chainer's Nightmares", difficulty: 'Normal', rewardSet: 'tor', teaches: ['Playing against reanimation'],
      blurb: "Chainer, the Cabal's dementia master, took the Mirari from Kamahl. It shows him everything. He summons nightmares from his own mind, and his mind is not well.",
      hero: {who: 'kamahl', deck: {name: "Kamahl's Fury", colors: 'RG', list: `
2 Kamahl, Pit Fighter
4 Wild Mongrel
4 Werebear
4 Barbarian Lunatic
4 Ember Beast
4 Centaur Chieftain
4 Firebolt
4 Call of the Herd
2 Kamahl's Sledge
4 Volcanic Spray
12 Mountain
12 Forest`}},
      villain: {who: 'chainer', deck: {name: "Chainer's Nightmares", colors: 'B', list: `
2 Chainer, Dementia Master
4 Nantuko Shade
4 Zombify
2 Entomb
4 Gravedigger
4 Sengir Vampire
2 Laquatus's Champion
4 Chainer's Edict
4 Cabal Ritual
4 Mesmeric Fiend
2 Zombie Assassin
24 Swamp`}},
      scene: [q('stage', 'Chainer dreams of ultimate knowledge.'),
        q('chainer', 'They appreciate my handiwork. I hear their joy in every scream.'),
        s('kamahl', "Give it back, Chainer. It's eating you."), s('chainer', 'It is feeding me, barbarian. There is a difference. I think.'),
        s('kamahl', 'He brings his dead back to fight. Kill the same thing twice if you have to. Keep his graveyard in mind.')],
      villainScene: [s('chainer', 'I was a pit fighter too, once. The Cabal taught me to fight with my head.'), s('chainer', 'Now the Mirari teaches me to fight with what is inside it. It is very crowded in there.'),
        q('chainer', 'Power, gold, crackers—every bird has its price.')],
      cues: {hero: cue('Give it back.', 'That is a real beast, Chainer. Not a dream.', 'Stay out of my head...', 'Wake up, Chainer.', "I'll get it back. I swear it.", 'Kill it twice, then.'),
        villain: cue('Let me show you what I dreamed.', 'Born from my mind. Isn\'t it beautiful?', 'The dreams... are leaving me...', 'Sleep, barbarian. Dream with me.', 'Even this is a nightmare I had.')},
      after: [q('stage', "Chainer's madness personified, it exists only to slaughter the innocent."),
        s('stage', 'Chainer burns out like a candle. The Mirari rolls out of his hand, and Kamahl picks it up again. He should not have.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Under New Management', difficulty: 'Normal', rewardSet: 'tor', teaches: ['Madness'],
      blurb: "Laquatus, the cephalid ambassador, has poisoned his way into power under the sea. He wants the Mirari, and he has decided Kamahl's sister is the easiest way to get it.",
      hero: {who: 'jeska', deck: {name: 'Temper of Steel', colors: 'RG', list: `
2 Jeska, Warrior Adept
4 Wild Mongrel
4 Arrogant Wurm
4 Basking Rootwalla
4 Fiery Temper
2 Violent Eruption
4 Firebolt
4 Grim Lavamancer
4 Barbarian Lunatic
4 Pardic Firecat
12 Mountain
12 Forest`}},
      villain: {who: 'laquatus', deck: {name: 'The Cephalid Court', colors: 'U', list: `
2 Ambassador Laquatus
2 Aboshan, Cephalid Emperor
4 Cephalid Looter
4 Cephalid Retainer
4 Aven Fisher
4 Thought Devourer
4 Repel
4 Syncopate
4 Circular Logic
4 Deep Analysis
24 Island`}},
      scene: [q('jeska', 'My brother and I both come from Balthor\'s forge. Kamahl has a temper of fire. I have a temper of steel.'),
        q('laquatus', "Nature's been fired. The oceans are under new management."),
        q('laquatus', 'My enemies will forget everything but their anguish.'),
        s('jeska', "You're not getting my brother, fish."),
        s('jeska', 'Madness: when you discard a madness card, you can cast it for its madness cost instead. Throwing a card away is a weapon.')],
      villainScene: [q('laquatus', 'Would you abandon your past to save your future?'),
        s('laquatus', 'Aboshan was emperor. Llawan will be empress. I prefer to be the hand behind both.'),
        q('laquatus', 'Memories can\'t simply be washed away. The mind must be scrubbed clean.')],
      cues: {hero: cue('Steel, not fire.', 'Even the threat of power has power.', 'Losing my footing...', 'Swim home, ambassador.', "Kamahl... I couldn't...", 'Throw it away. Burn it on the way out.'),
        villain: cue('What you made will be unmade.', 'Your tenacity is admirable. And futile.', 'The tide... is turning...', 'And when you\'re done, you will be undone.', "I have a hunch we'll be seeing that one again soon.")},
      after: [q('laquatus', "I have a hunch we'll be seeing that one again soon."), q('stage', 'Laquatus dreams of seizing control.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'The Holy Wind', difficulty: 'Normal', rewardSet: 'tor', teaches: ['Card advantage'],
      blurb: "The Order is Otaria's other great power, the aven and their soldiers. Major Teroh has sworn to wipe out the Cabal. Braids, the Cabal's dementia summoner, plays the coldest deck of the era: kill everything, draw more, never blink.",
      hero: {who: 'teroh', deck: {name: 'The Order', colors: 'W', list: `
2 Major Teroh
4 Aven Trooper
4 Teroh's Faithful
4 Teroh's Vanguard
4 Aven Cloudchaser
4 Mystic Zealot
4 Militant Monk
4 Battle Screech
4 Pilgrim of Justice
2 Silver Seraph
24 Plains`}},
      villain: {who: 'braids', deck: {name: 'Mono-Black Control', colors: 'B', list: `
2 Braids, Cabal Minion
4 Nantuko Shade
4 Chainer's Edict
4 Mutilate
4 Gravedigger
4 Mesmeric Fiend
4 Faceless Butcher
4 Ghastly Demise
2 Haunting Echoes
4 Cabal Ritual
24 Swamp`}},
      scene: [q('teroh', 'I am the holy wind that shall avenge the Cabal\'s victims.'),
        q('braids', "It's only frightened five people to death. Not my best work."),
        q('teroh', 'The spirits of the righteous shall rise into the sky. Even dirtwalkers will fly like aven.'),
        s('braids', 'Oh, I like him. He means it.'),
        s('teroh', 'She kills one creature at a time and draws two cards for it. Go wide. Make her answers too small.')],
      villainScene: [q('braids', 'Anyone can snap her fingers and yank a soul. I prefer to kill creatively.'),
        s('braids', 'The Order prays to the Ancestor. The Cabal pays the bills. Guess which one the poor come to.'),
        q('braids', 'Zombies don\'t kill. They recruit.')],
      cues: {hero: cue('Rise, the Order.', 'The holy wind!', 'The sky darkens...', 'The Cabal will fall.', 'Our wings are broken. Not our faith.', 'The Ancestor watches.'),
        villain: cue('Let\'s see what you dream about.', 'You call *that* a nightmare?', 'Not my best work...', 'Unhinged.', "Don't let your mind wander—it might not come back.")},
      after: [q('stage', 'Teroh dreams of his enemies\' doom.'), s('stage', 'Braids smiles at Teroh as she retreats. She has seen how his story ends.')]},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Brother and Sister', difficulty: 'Normal', rewardSet: 'jud', teaches: ['Racing'],
      blurb: "Kamahl has the Mirari again, and it has changed him. It plays itself now, the Mirari's Wake. Jeska comes to make him put it down. He will not.",
      hero: {who: 'jeska', deck: {name: "Balthor's Forge", colors: 'RW', list: `
2 Jeska, Warrior Adept
4 Barbarian Lunatic
4 Halberdier
4 Dwarven Bloodboiler
4 Pardic Firecat
4 Aven Cloudchaser
4 Mystic Zealot
4 Firebolt
4 Lava Dart
2 Balthor the Stout
12 Mountain
12 Plains`}},
      villain: {who: 'kamahl', deck: {name: "Mirari's Wake", colors: 'GW', list: `
4 Mirari's Wake
2 Mirari
4 Phantom Centaur
4 Krosan Wayfarer
4 Mystic Enforcer
2 Phantom Nishoba
4 Moment's Peace
4 Elephant Guide
4 Werebear
4 Call of the Herd
12 Forest
12 Plains`}},
      scene: [s('jeska', 'Kamahl. Look at your hands.'), s('kamahl', 'They are strong. Stronger than they have ever been.'),
        s('jeska', 'They are shaking.'),
        q('stage', 'The land drank power from the Mirari as though it had thirsted forever.'),
        s('kamahl', 'Go home, Jeska. Balthor needs you. I need this.'),
        s('jeska', 'He has endless mana and Moment\'s Peace to hold me off. Race him. Every turn he waits, he gets bigger.')],
      villainScene: [s('kamahl', 'Everyone wants the Mirari. The Cabal. The Order. The fish.'),
        s('kamahl', 'If I let it go, one of them takes it. Then what?'),
        q('kamahl', 'Anyone can admire creation. Only a barbarian sees the beauty in demolition.'),
        s('kamahl', "She won't stop. Why won't she stop?")],
      cues: {hero: cue('Put it down, brother.', 'Steel, Kamahl. Remember?', 'Kamahl... please...', 'Now you put it down.', 'Kamahl... I\'m cold...', 'I am not afraid of you. I am afraid for you.'),
        villain: cue('Go home.', 'Feel that? That is the Mirari.', 'It wants... it wants more...', "Jeska? Jeska!", 'What... have I done...')},
      after: [s('stage', 'Kamahl swings without looking. The Mirari sword finds Jeska.'), s('kamahl', 'Jeska? JESKA!'),
        s('stage', 'He carries her for a day. Then Cabal riders take her from him, and he is too broken to stop them.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Cabal Patriarch', difficulty: 'Hard', rewardCard: "Chainer's Edict", rewardSet: 'jud', teaches: ['Everything so far'],
      blurb: 'The Patriarch rules the Cabal. He has Jeska. He wants the Mirari. Kamahl walks into the Cabal\'s city alone, carrying both his guilt and the sphere.',
      hero: {who: 'kamahl', deck: {name: "The Barbarian's Penance", colors: 'RG', list: `
2 Kamahl, Pit Fighter
4 Werebear
4 Krosan Beast
4 Centaur Chieftain
4 Wild Mongrel
4 Arrogant Wurm
4 Firebolt
4 Call of the Herd
2 Roar of the Wurm
4 Volcanic Spray
12 Mountain
12 Forest`}},
      villain: {who: 'patriarch', deck: {name: 'The Cabal', colors: 'B', list: `
4 Chainer's Edict
4 Nantuko Shade
4 Mesmeric Fiend
4 Faceless Butcher
4 Cabal Torturer
2 Sengir Vampire
2 Braids, Cabal Minion
4 Gravedigger
4 Mutilate
4 Cabal Ritual
24 Swamp`}},
      scene: [q('patriarch', 'Any fool who would die for honor is better off dead.'),
        s('kamahl', 'Where is my sister?'), s('patriarch', 'Safe. Changed, a little. She is ours now, barbarian. You saw to that.'),
        q('patriarch', 'If the Nantuko only knew what awaits them beyond death, they would abandon all they hold dear.'),
        s('kamahl', 'I am not here to win. I am here to end it.')],
      villainScene: [q('patriarch', 'If he\'s so willing to suffer for his cause, then by all means, let us oblige him.'),
        s('patriarch', 'The Order kneels to an Ancestor nobody has seen. The Cabal kneels to me. I am at least real.'),
        q('stage', 'When one of the Patriarch\'s champions displeased him, he would only shake his finger. That was enough.')],
      cues: {hero: cue('Give her back.', 'For Jeska.', 'Not yet... not until she is free...', 'It ends here.', 'Jeska... forgive me...', 'Pain teaches lessons no scholar can.'),
        villain: {...cue('Kneel.', 'Each word rattles your mind.', 'Impossible...', 'The Mirari is the Cabal\'s.', 'Take it, then. See where it leads you.'),
          half: {who: 'braids', line: 'Patriarch? He is winning. I just thought you should know. I am leaving now.'}}}},
  ],
};
