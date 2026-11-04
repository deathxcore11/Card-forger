// Act 15: The Great Aurora (Lorwyn, Morningtide, Shadowmoor, Eventide, Tenth Edition). Story and dialogue:
// /mnt/project-files/story/act-15-script.md (generated from this file). Land set: lrw.
// Lorwyn is a plane of endless summer, sunlit and safe, with no humans and no night longer than a breath. Every few
// centuries the Great Aurora turns it into Shadowmoor, a world of endless dusk. Rhys, Brigid, Sygg and Ashling learn who
// is behind it: Oona, the hidden queen of the faeries. Every quoted line is real flavor text from the Lorwyn or Shadowmoor
// blocks; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const fixed = (card, set, number, id, artist) => ({card, set, number, id, artist, crop: `https://cards.scryfall.io/art_crop/front/${id[0]}/${id[1]}/${id}.jpg`});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'aurora-fae-twilight',
  era: '2008-07-25',
  intro: [s('stage', 'Lorwyn. A plane of endless summer, where the sun barely dips before it rises again, and there are no humans at all. Elves, kithkin, merfolk, flamekin, boggarts, giants and treefolk share the long bright days.'),
    q('stage', 'Beneath the fae\'s constant pranks runs a subtler undercurrent of mockery: the influence of Oona, their hidden queen.'),
    s('stage', 'Every few centuries a light fills the sky, and Lorwyn becomes something else. Nobody remembers the last time. That is the point.')],
  finale: [s('stage', 'In Glen Elendra, the queen of the faeries falls. The Aurora has nobody left to hide behind.'),
    s('stage', 'Shadowmoor will turn back into Lorwyn, and Lorwyn into Shadowmoor again, for as long as the plane lasts. But for the first time, the people under the sky know why.'),
    s('rhys', 'I hunted a flamekin, fought a kithkin, followed a merrow and trusted a faerie. A year ago I would have called that a list of mistakes.'),
    q('stage', 'Whole again in honor and horn.')],
  villainFinale: [s('stage', 'The queen dreams on. The sky stays dim.'),
    q('oona', 'Dreams are fleeting. Reality even more so.'),
    s('oona', 'They will forget this, as they forgot the last time, and the time before. I am the only one who remembers. That is what makes me queen.'),
    s('stage', 'In a few centuries, the Aurora will come again, and nobody will see it coming.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', fixed: fixed('Fold into Aether', '5dn', '31', '615157d6-0160-417b-b06c-0e253b306c37', 'Anthony S. Waters & Cara Mitten')},
    rhys: {name: 'Rhys', title: 'Elf of Lys Alana, Exiled', card: 'Rhys the Exiled', number: '135', focus: '50% 25%'},
    brigid: {name: 'Brigid', title: 'Hero of Kinsbaile', card: 'Brigid, Hero of Kinsbaile', number: '6', focus: '50% 25%'},
    sygg: {name: 'Sygg', title: 'River Guide', card: 'Sygg, River Guide', number: '251', focus: '50% 25%'},
    ashling: {name: 'Ashling', title: 'The Pilgrim', card: 'Ashling the Pilgrim', number: '149', focus: '50% 25%'},
    vessifrus: {name: 'Vessifrus', title: 'Flamekin Demagogue', card: 'Sunflare Shaman', number: '108', focus: '50% 25%'},
    auntie: {name: 'The Warren', title: 'Tales of Auntie Grub', card: 'Boggart Harbinger', number: '102', focus: '50% 30%'},
    maralen: {name: 'Maralen', title: 'Of the Mornsong', card: 'Maralen of the Mornsong', number: '65', focus: '50% 25%'},
    extinguisher: {name: 'Ashling', title: 'The Extinguisher', card: 'Ashling, the Extinguisher', number: '33', focus: '50% 25%'},
    safehold: {name: 'The Safehold', title: 'Kithkin of Shadowmoor', card: 'Ballynock Cohort', number: '3', focus: '50% 30%'},
    merfolk: {name: 'Merfolk', title: 'Winter 2008', card: 'Merrow Reejerey', number: '74', focus: '50% 30%'},
    kithkin: {name: 'Kithkin', title: 'Spring 2008', card: 'Cloudgoat Ranger', number: '10', focus: '50% 30%'},
    oona: {name: 'Oona', title: 'Queen of the Fae', card: 'Oona, Queen of the Fae', number: '172', focus: '50% 25%'},
    doran: {name: 'Doran', title: 'Summer 2008', card: 'Doran, the Siege Tower', number: '247', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'An Arrow\'s Flight', difficulty: 'Easy', rewardSet: 'lrw', teaches: ['Tribes'],
      blurb: 'Rhys, an elf hunter of Lys Alana, chases a stranger into kithkin country. Kinsbaile does not let armed elves walk in, and its best archer is already on the wall.',
      hero: {who: 'rhys', deck: {label: 'tribute', name: 'The Hunt of Lys Alana', colors: 'G', list: `
2 Rhys the Exiled
4 Elvish Warrior
4 Wren's Run Vanquisher
4 Bramblewood Paragon
4 Imperious Perfect
4 Lys Alana Huntmaster
4 Winnower Patrol
4 Talara's Battalion
4 Twinblade Slasher
2 Nath's Elite
22 Forest
2 Swamp`}},
      villain: {who: 'brigid', deck: {label: 'tribute', name: 'Kinsbaile Watch', colors: 'W', list: `
2 Brigid, Hero of Kinsbaile
4 Goldmeadow Harrier
4 Kinsbaile Skirmisher
4 Mosquito Guard
4 Kithkin Greatheart
4 Plover Knights
4 Cenn's Heir
4 Goldmeadow Dodger
2 Neck Snap
2 Kinsbaile Balloonist
2 Militia's Pride
24 Plains`}},
      scene: [q('stage', 'From the highest tiers of Dawn\'s Light Palace to the deepest shade of Wren\'s Run, the silver notes of the horn shimmer through the air, and all who hear it feel its pull.'),
        s('rhys', 'Tribes: every elf, kithkin and merrow on Lorwyn has a creature type, and a lot of cards care about it. My elves make my other elves stronger. So do their kithkin.'),
        s('rhys', 'I only want to pass through. They are going to make that difficult.')],
      villainScene: [q('stage', 'Thanks to one champion archer, the true borders of Kinsbaile extend an arrow\'s flight beyond the buildings.'),
        q('stage', 'Thoughtweft binds us together as one, part of an intricate pattern that would unravel if even one thread came loose.')],
      cues: {hero: cue('The hunt begins.', 'Sound the horn!', 'Too many of them...', 'Lower your bow.', 'Lys Alana... forgive me...', 'Elves lift elves.'),
        villain: cue('Not one step closer, elf.', 'Loose!', 'The weft is fraying...', 'Kinsbaile holds.', 'Out of arrows...')},
      after: [s('brigid', 'You fight well, for an elf. Fine. You can pass. But I am coming with you. Somebody has to keep an eye on you.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Merrow Lanes', difficulty: 'Easy', rewardSet: 'lrw', teaches: ['Evoke'],
      blurb: 'The road runs along the river, and the river belongs to the merfolk. Sygg, a merrow guide, takes the party downstream, until a flamekin firebrand and his followers set the riverbank alight.',
      hero: {who: 'sygg', deck: {label: 'tribute', name: 'Sygg\'s School', colors: 'UW', list: `
2 Sygg, River Guide
4 Silvergill Adept
4 Merrow Reejerey
4 Streambed Aquitects
4 Paperfin Rascal
4 Merrow Harbinger
4 Inkfathom Infiltrator
4 Mulldrifter
4 Judge of Currents
2 Sentinels of Glen Elendra
18 Island
6 Plains`}},
      villain: {who: 'vessifrus', deck: {label: 'tribute', name: 'Embers of Vessifrus', colors: 'R', list: `
4 Flamekin Brawler
4 Flamekin Spitfire
4 Inner-Flame Acolyte
4 Sunflare Shaman
4 Heartlash Cinder
4 Inner-Flame Igniter
4 Tarfire
2 Hostility
4 Flamekin Bladewhirl
2 Shard Volley
24 Mountain`}},
      scene: [q('sygg', 'If there\'s a place worth going, the Merrow Lanes already do. And if there\'s a route worth taking, yours truly already has.'),
        s('sygg', 'Evoke: some creatures have a cheaper evoke cost. Pay it and they arrive, do their trick, and leave at once. Mulldrifter draws you two cards for three mana and never touches the ground.'),
        q('stage', 'We look in the river and see scattered stones. A merrow looks and sees a map of Lorwyn.')],
      villainScene: [q('vessifrus', 'The elves may try to confine us, but they will learn that our blazing spirit can never be suppressed.'),
        q('stage', 'Better to flare out than to gutter.')],
      cues: {hero: cue('All aboard the Lanes.', 'Ride the current!', 'The water\'s boiling...', 'Next stop, downstream.', 'Swept away...', 'Pay less, draw more.'),
        villain: cue('Burn bright!', 'Flare out!', 'Guttering...', 'Ash and embers.', 'The flame... goes out...')},
      after: [s('stage', 'In the smoke, a young flamekin named Ashling walks out of the fire, unburned and very curious. She has been hearing a voice in her own flame, and she wants to know whose it is.'),
        s('ashling', 'I am a pilgrim. I go where the fire tells me. Lately it tells me to follow you.')]},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Auntie\'s Warren', difficulty: 'Easy', rewardSet: 'lrw', teaches: ['Planeswalkers'],
      blurb: 'A boggart warren raids Kinsbaile while Brigid is away, and she runs home to defend it. Lorwyn was the set that introduced planeswalker cards, and Brigid\'s deck carries one: Ajani Goldmane.',
      hero: {who: 'brigid', deck: {label: 'tribute', name: 'Kinsbaile Defenders', colors: 'W', list: `
2 Ajani Goldmane
2 Brigid, Hero of Kinsbaile
4 Goldmeadow Harrier
4 Wizened Cenn
4 Kinsbaile Skirmisher
4 Cloudgoat Ranger
4 Knight of Meadowgrain
4 Plover Knights
4 Kithkin Greatheart
4 Militia's Pride
24 Plains`}},
      villain: {who: 'auntie', deck: {label: 'tribute', name: 'The Squeaking Pie Warren', colors: 'BR', list: `
4 Mudbrawler Cohort
4 Boggart Sprite-Chaser
4 Adder-Staff Boggart
4 Incinerate
4 Auntie's Snitch
4 Boggart Mob
4 Nameless Inversion
4 Tarfire
4 Boggart Harbinger
12 Swamp
12 Mountain`}},
      scene: [q('stage', 'If a boggart even dares breathe near one of my kin, I\'ll know. And I\'ll not be happy.'),
        s('brigid', 'Planeswalkers: Ajani is a card you cast, with loyalty counters. Each turn you can use one of his abilities, adding or removing loyalty. Creatures can attack him instead of you, so guard him.')],
      villainScene: [q('stage', 'Why do our pies squeak? It\'s all the faeries, mice, and prickly-hogs we stuff inside.'),
        q('stage', 'Among the boggarts, there is only one real rule: all new treasures and experiences must be shared.')],
      cues: {hero: cue('Kinsbaile, to me!', 'Through the weft!', 'They\'re everywhere...', 'Out of my village.', 'The weft... breaks...', 'Guard the walker.'),
        villain: cue('[giggling from the hedges]', '[the warren rushes in]', '[the warren scatters]', '[everything gets shared]', '[the pie stops squeaking]')},
      after: [q('stage', 'After Auntie brushed the soot from her eyes, she discovered something wonderful: the fire had turned the goat into something that smelled delicious.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Vendilion Clique', difficulty: 'Normal', rewardSet: 'mor', teaches: ['Flash'],
      blurb: 'Rhys is exiled from Lys Alana for losing his hunt. A strange elf woman named Maralen joins the party, and with her come the faeries, who steal dreams for their hidden queen. One of their pranks turns deadly.',
      hero: {who: 'rhys', deck: {label: 'tribute', name: 'Rhys\'s Pack', colors: 'G', list: `
2 Rhys the Exiled
2 Garruk Wildspeaker
4 Llanowar Elves
4 Wren's Run Vanquisher
4 Imperious Perfect
4 Lys Alana Huntmaster
4 Elvish Warrior
4 Wren's Run Packmaster
4 Nath's Elite
4 Giant Growth
20 Forest
4 Swamp`}},
      villain: {who: 'maralen', deck: {label: 'tribute', name: 'The Mornsong', colors: 'UB', list: `
2 Maralen of the Mornsong
4 Spellstutter Sprite
4 Pestermite
4 Oona's Prowler
4 Faerie Harbinger
4 Thieving Sprite
4 Peppersmoke
4 Nameless Inversion
4 Sower of Temptation
2 Mistbind Clique
12 Island
12 Swamp`}},
      scene: [q('stage', 'Once a famed hunter and packmaster, now a renegade seeking his own path.'),
        s('rhys', 'Flash: faeries can be cast at instant speed, at the end of your turn or in the middle of combat. Expect a blocker that wasn\'t there a second ago.'),
        s('stage', 'Rhys\'s deck also carries Garruk Wildspeaker, another of the first planeswalker cards. He untaps lands and makes 3/3 beasts.')],
      villainScene: [q('stage', 'Maralen sent Veesa, Endry, and Iliona—the Vendilion clique—on the gravest of tasks.'),
        q('stage', 'The fae know when they\'re not wanted. That\'s precisely why they show up.')],
      cues: {hero: cue('Swat them out of the air.', 'The pack hunts!', 'They\'re too quick...', 'Grounded.', 'Exiled twice over...', 'Expect the flash.'),
        villain: cue('Shall we play a game?', 'Surprise!', 'You\'re no fun.', 'What a lovely dream you had.', 'This was... not the plan...')},
      after: [s('maralen', 'I am not your enemy, Rhys. The faeries have a queen, and she has a plan for this whole world. I need you to help me stop her.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Aurora', difficulty: 'Normal', rewardSet: 'shm', teaches: ['Wither', 'Persist'],
      blurb: 'The sky fills with light, and Lorwyn becomes Shadowmoor. The sun stops at the edge of dusk. Kithkin wall themselves into safeholds, and Ashling\'s gentle flame turns into a fire that only wants to burn.',
      hero: {who: 'extinguisher', deck: {label: 'tribute', name: 'The Extinguisher', colors: 'BR', list: `
2 Ashling, the Extinguisher
4 Sickle Ripper
4 Ashenmoor Gouger
4 Kulrath Knight
4 Murderous Redcap
4 Emberstrike Duo
4 Sootwalkers
4 Puncture Blast
2 Fulminator Mage
4 Smoldering Butcher
12 Swamp
12 Mountain`}},
      villain: {who: 'safehold', deck: {label: 'tribute', name: 'Ballynock Safehold', colors: 'W', list: `
4 Ballynock Cohort
4 Safehold Sentry
4 Kithkin Shielddare
4 Knight of Meadowgrain
4 Spectral Procession
4 Last Breath
4 Safehold Elite
4 Ballynock Trapper
2 Kithkin Zealot
2 Glorious Anthem
24 Plains`}},
      scene: [q('stage', 'The Aurora had transformed her into a relentless force of destruction.'),
        s('extinguisher', 'Wither: damage from these creatures comes as -1/-1 counters. Those never heal at the end of the turn.'),
        q('stage', 'Why allow the fires of others to burn, when ours do not? Why leave them content, while we suffer? If there is to be misery, let it be borne by all.')],
      villainScene: [q('stage', 'The Aurora had lessened the kithkins\' kindness, deepened their paranoia, and dulled their sense of pain.'),
        s('safehold', 'Persist: when a persist creature dies without a -1/-1 counter, it comes back with one. Kill it twice, or wither it once.'),
        q('stage', 'These bracers were worn by my father and by his mother before him. Boggart fangs have shattered on them. Cinder flames have withered at their touch. While I wear them, the safehold will not fall.')],
      cues: {hero: cue('Burn.', 'Wither away!', 'They keep coming back...', 'Ashes.', 'Not... extinguished...', 'Counters never heal.'),
        villain: cue('Bar the gates!', 'We endure!', 'The wall is cracking...', 'The safehold stands.', 'The safehold... falls...')},
      after: [q('ashling', 'I knew a creature carved from a dream of wild freedom. Any attempt to leash or exploit it failed, and at terrible cost.'),
        s('stage', 'Rhys is changed too. In Shadowmoor he is whole and kind, a peacemaker. He does not remember Lorwyn. But Maralen does.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Bitterblossom', difficulty: 'Normal', rewardSet: 'mor', teaches: ['Champion'],
      blurb: 'In the real winter of 2008, one tribe ruled Standard: Faeries, built on Bitterblossom, Spellstutter Sprite and Mistbind Clique. The deck it fought most was Merfolk, a school of lords that grows all at once.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Faeries', colors: 'UB', archetype: 'Tempo', list: `
2 Bitterblossom
2 Oona's Gatewarden
4 Spellstutter Sprite
4 Pestermite
4 Scion of Oona
4 Mistbind Clique
4 Sower of Temptation
4 Wasp Lancer
4 Nameless Inversion
4 Faerie Harbinger
4 Secluded Glen
4 Faerie Conclave
4 Underground River
6 Island
6 Swamp`}},
      villain: {who: 'merfolk', deck: {label: 'tribute', name: 'Merfolk', colors: 'U', archetype: 'Aggro', list: `
4 Silvergill Adept
4 Merrow Reejerey
4 Stonybrook Banneret
4 Streambed Aquitects
4 Merrow Harbinger
4 Silvergill Douser
4 Paperfin Rascal
4 Remove Soul
4 Ponder
24 Island`}},
      scene: [q('stage', 'In Lorwyn\'s brief evenings, the sun pauses at the horizon long enough for a certain species of violet to bloom with the fragrance of mischief.'),
        s('you', 'Champion: Mistbind Clique exiles one of my faeries when it arrives and gives it back when the Clique leaves. Cast it in their upkeep and they lose a turn of mana.')],
      villainScene: [q('stage', 'Steady and silent as the deep current, the reejerey guides the course of the school.'),
        q('stage', 'Made from trout scales and crawfish whiskers, merrows\' shimmering banners flash in the water like lightning.')],
      cues: {hero: cue('A little mischief.', 'Flash in!', 'The school is too big...', 'Pranked.', 'Dream over...', 'Champion in their upkeep.'),
        villain: cue('[the school gathers]', '[lords raise the tide]', '[the current breaks]', '[swept downstream]', '[the river goes still]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Reveillark', difficulty: 'Normal', rewardSet: 'mor', teaches: ['Leaves the battlefield'],
      blurb: 'Spring 2008. Kithkin swarmed Standard with tokens and anthems. The control deck that beat them most was Reveillark: a spirit bird that brings small creatures back from the graveyard when it dies.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Reveillark', colors: 'UW', archetype: 'Control', list: `
4 Reveillark
4 Mulldrifter
4 Plumeveil
4 Wrath of God
4 Glen Elendra Archmage
4 Knight of Meadowgrain
4 Cloudgoat Ranger
4 Pacifism
4 Sower of Temptation
4 Mystic Gate
4 Adarkar Wastes
8 Island
8 Plains`}},
      villain: {who: 'kithkin', deck: {label: 'tribute', name: 'Kithkin', colors: 'W', archetype: 'Aggro', list: `
4 Goldmeadow Dodger
4 Goldmeadow Harrier
4 Wizened Cenn
4 Knight of Meadowgrain
2 Cloudgoat Ranger
2 Kinsbaile Balloonist
4 Spectral Procession
4 Springjack Knight
4 Kithkin Greatheart
4 Kinsbaile Skirmisher
24 Plains`}},
      scene: [s('you', 'Leaves the battlefield: when Reveillark leaves play, it returns up to two creatures with power 2 or less from my graveyard. Killing it only makes my army bigger.'),
        q('stage', 'It was vast, a great sheet of soaring wings, and equally silent. It caught us unawares and blocked our view of the kithkin stronghold.')],
      villainScene: [q('stage', 'The knights are a major attraction at every Lammastide festival. Teams of riders perform daring feats of flight to the delight of all below.'),
        q('stage', 'By tradition, we don\'t speak for two days after battle. If our deeds won\'t speak for themselves, what else could be said?')],
      cues: {hero: cue('Let them come.', 'Rise again!', 'Too many tokens...', 'The lark sings.', 'Silenced...', 'Death is a door.'),
        villain: cue('[the cenn calls the weft]', '[the meadow charges]', '[the weft unravels]', '[trampled]', '[silence after battle]')},
      after: [s('stage', 'In the story, Maralen has found her way to Glen Elendra. She is not a stranger there. She is a piece of Oona herself, split off to walk among the elves, and she has decided she would rather be free.')]},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Glen Elendra', difficulty: 'Hard', rewardSet: 'shm', rewardCard: 'Oona, Queen of the Fae', teaches: ['Hybrid mana'],
      blurb: 'The Aurora was never an accident. Oona, the hidden queen of the faeries, turns the world every few centuries to harvest its dreams. Rhys, Ashling and Maralen walk into Glen Elendra to end it.',
      hero: {who: 'rhys', deck: {label: 'tribute', name: 'Rhys, Ashling and Maralen', colors: 'BRG', list: `
2 Rhys the Exiled
2 Ashling, the Extinguisher
4 Wren's Run Vanquisher
4 Murderous Redcap
4 Boggart Ram-Gang
4 Shriekmaw
4 Tarfire
4 Nameless Inversion
4 Elvish Warrior
4 Nath's Elite
4 Llanowar Wastes
4 Karplusan Forest
4 Sulfurous Springs
4 Forest
4 Swamp
4 Mountain`}},
      villain: {who: 'oona', deck: {label: 'tribute', name: 'The Queen\'s Court', colors: 'UB', archetype: 'Control', list: `
2 Oona, Queen of the Fae
4 Scion of Oona
2 Mistbind Clique
2 Spellstutter Sprite
4 Pestermite
2 Wydwen, the Biting Gale
4 Glen Elendra Liege
4 Oona's Gatewarden
4 Nameless Inversion
4 Cryptic Command
2 Bitterblossom
2 Sower of Temptation
4 Secluded Glen
4 Underground River
8 Island
8 Swamp`}},
      scene: [q('stage', 'Protected by glamers and guile, Glen Elendra harbors the elusive Oona, queen of the fae.'),
        s('rhys', 'Hybrid mana: a cost like red-or-green can be paid with either. Murderous Redcap and the Ram-Gang fit any deck with one of their colours.'),
        s('ashling', 'Her voice was in my flame all along. I am going to give it back to her.'),
        s('maralen', 'She made me to be her eyes. Today I close them.')],
      villainScene: [q('stage', 'Deep in Glen Elendra blossoms Oona, queen of the faeries, nourished by secrets and pollinated by stolen dreams.'),
        q('stage', 'So now you\'ve seen Glen Elendra. Take a good look. It will be the last thing you\'ll ever see.'),
        q('stage', 'Those who displease Oona soon learn the extent of the armies she commands.')],
      cues: {hero: cue('Into the glen.', 'Wake up, Lorwyn!', 'Her court is endless...', 'The dream is over.', 'Lost... in the glen...', 'Either colour pays.'),
        villain: {...cue('How sweetly you dream.', 'Kneel to the queen.', 'My court... falters...', 'Sleep now.', 'This is... not a dream...'),
          half: {who: 'maralen', line: 'She is afraid. I have never felt her afraid before.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Doran', difficulty: 'Hard', rewardSet: 'lrw', rewardCard: 'Doran, the Siege Tower', mood: 'boss',
      teaches: ['Toughness as power'],
      archive: {deck: 'Doran', when: '2008', format: 'Standard: Lorwyn, Morningtide, Shadowmoor, Eventide, Time Spiral block and Tenth Edition.',
        what: 'A green, white and black midrange deck built around Doran, the Siege Tower, a treefolk that makes every creature deal combat damage equal to its toughness.',
        why: 'Treefolk and walls are tough but weak. With Doran out, a 1/4 hits like a 4/4, and Kitchen Finks, Wren\'s Run Vanquisher and Chameleon Colossus hit far harder than they look. Thoughtseize and removal clear the way.',
        beat: 'Kill Doran on sight. Without him, the deck is a pile of walls. Burn him in response to nothing, before combat.',
        after: 'Doran was never banned. It became one of the best-known three-colour decks of its season, and Doran became a Commander favourite.'},
      blurb: 'Deep in the archive, a treefolk that taught every wall to hit back.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Figures of Fire', colors: 'RW', archetype: 'Aggro', list: `
4 Figure of Destiny
4 Mogg Fanatic
4 Tarfire
4 Incinerate
4 Spitemare
4 Hearthfire Hobgoblin
4 Duergar Hedge-Mage
4 Cloudgoat Ranger
2 Brion Stoutarm
2 Shock
4 Battlefield Forge
4 Rugged Prairie
8 Mountain
8 Plains`}},
      villain: {who: 'doran', deck: {label: 'tribute', name: 'Doran', note: 'Built from the 2008 Doran lists with Doran, the Siege Tower, Treefolk Harbinger and Kitchen Finks, using cards from this act\'s sets. No single tournament list is copied.', colors: 'BGW', archetype: 'Midrange', list: `
4 Doran, the Siege Tower
4 Treefolk Harbinger
4 Wren's Run Vanquisher
4 Kitchen Finks
4 Thoughtseize
4 Nameless Inversion
4 Chameleon Colossus
4 Shriekmaw
2 Garruk Wildspeaker
2 Cloudthresher
4 Murmuring Bosk
4 Gilt-Leaf Palace
4 Llanowar Wastes
4 Brushland
4 Forest
2 Swamp
2 Plains`}},
      scene: [q('stage', 'Hobgoblins are best left alone. They sharpen their farm implements far more than is necessary for their work in the fields.'),
        s('you', 'Toughness as power: while Doran is out, creatures deal combat damage equal to their toughness. Count their toughness, not their power, before you block.')],
      villainScene: [q('doran', 'Each year that passes rings you inwardly with memory and might. Wield your heart, and the world will tremble.')],
      cues: {hero: cue('Burn the tree.', 'Level up!', 'The walls hit back...', 'Felled.', 'Rooted out...', 'Kill Doran first.'),
        villain: cue('[the bosk murmurs]', '[the siege tower advances]', '[bark splits]', '[crushed under roots]', '[the old tree falls]')},
      after: [s('stage', 'Recorded: never banned. The season a wall learned to attack.')]},
  ],
};
