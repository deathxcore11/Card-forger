// Act 44: The Echoverse. Story and dialogue: /mnt/project-files/story/act-44-script.md (generated from this file).
// Land set: ecl. Lorwyn Eclipsed, Secrets of Strixhaven and Reality Fracture as one story: a student named Tam and a mind named Jace.
// Every quoted line is real flavor text from Magic: The Gathering - Lorwyn Eclipsed, Secrets of Strixhaven and Reality Fracture; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'echoverse',
  era: '2026-10-02',
  intro: [s('stage', 'Lorwyn and Shadowmoor have blurred into one eclipsed plane, and a first-year student is lost on it with a campus map.'),
    s('stage', 'Past the eclipse lies a university, and past the university a mind that wants to end all suffering by ending the Multiverse as it is.'),
    s('stage', 'Recorded: the Echoverse is the newest road. It is still being written.')],
  finale: [s('stage', 'Tam reaches for something older than the multiverses and asks it to undo what was done.'),
    q('tam', 'What are the odds? And what would you like them to be?'),
    s('stage', 'Emrakul, the Exigent Doom answers, and the two multiverses come apart as quietly as they joined.')],
  villainFinale: [s('stage', 'In this version the Theorist finishes his proof. Every part of him that objected is gone, and the Multiverse is one revision.'),
    q('theorist', 'The Multiverse is a work in progress. There will need to be revisions.'),
    s('stage', 'He thinks he is saving everyone.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Evolving Wilds'},
    eirdu: {name: 'Eirdu', title: 'Carrier of Dawn', card: 'Eirdu, Carrier of Dawn // Isilu, Carrier of Twilight', focus: '50% 25%'},
    shadow: {name: 'The Shadowmoor Gloom', title: 'Eclipsed', card: 'Gloom Ripper', focus: '50% 25%'},
    grove: {name: 'The Wild Kin', title: 'Of the Creakwood', card: 'Bristlebane Battler', focus: '50% 25%'},
    maralen: {name: 'Maralen', title: 'Fae Ascendant', card: 'Maralen, Fae Ascendant', focus: '50% 25%'},
    ember: {name: 'The Ember Kin', title: 'Of Lorwyn', card: 'Goliath Daydreamer', focus: '50% 25%'},
    oko: {name: 'Oko', title: 'Lorwyn Liege', card: 'Oko, Lorwyn Liege // Oko, Shadowmoor Scion', focus: '50% 25%'},
    tam: {name: 'Tam', title: 'Mindful First-Year', card: 'Tam, Mindful First-Year', focus: '50% 25%'},
    rival: {name: 'The Rival Students', title: 'Prismari Pranksters', card: 'Champion of the Path', focus: '50% 25%'},
    prism: {name: 'The Second-Years', title: 'Spellslingers', card: 'Sanar, Innovative First-Year', focus: '50% 25%'},
    archaic: {name: 'The Archaics', title: 'Of Arcavios', card: 'The Dawning Archaic', focus: '50% 25%'},
    lorehold: {name: 'The Lorehold Seniors', title: 'Keepers of History', card: 'Lorehold, the Historian', focus: '50% 25%'},
    witherbloom: {name: 'Witherbloom', title: 'The Balancer', card: 'Witherbloom, the Balancer', focus: '50% 25%'},
    chandra: {name: 'The Rebels', title: 'Against the Theorist', card: 'Vibrance', focus: '50% 25%'},
    uldaros: {name: 'Uldaros Theorix', title: 'Lieutenant', card: 'Uldaros Theorix', focus: '50% 25%'},
    allies: {name: 'The Allies', title: 'Of the Echoverse', card: 'Kwia Vigorbloom', focus: '50% 25%'},
    theorist: {name: 'The Theorist', title: 'Jace Beleren', card: 'The Theorist, Jace Beleren', focus: '50% 25%'},
    emrakul: {name: 'Emrakul', title: 'The Exigent Doom', card: 'Emrakul, the Exigent Doom', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Eclipse', difficulty: 'Easy', rewardSet: 'ecl', teaches: ['Blight'],
      blurb: 'Lorwyn and Shadowmoor blur together, and the sun people have opinions about it.',
      hero: {who: 'eirdu', deck: {label: 'tribute', name: 'The Children of the Sun', colors: 'W', list: `
2 Eirdu, Carrier of Dawn // Isilu, Carrier of Twilight
3 Rhys, the Evermore
3 Kinscaer Sentry
3 Adept Watershaper
2 Champion of the Clachan
4 Flickering Hound
4 Changeling Wayfinder
4 Graft Surgeon
4 Thoughtweft Imbuer
4 Unflinching Hortimancer
3 Mage Tower Referee
24 Plains`}},
      villain: {who: 'shadow', deck: {label: 'tribute', name: 'The Shadowmoor Gloom', colors: 'B', list: `
3 Gloom Ripper
3 Taster of Wares
3 Twilight Diviner
4 Tragedy Feaster
4 Creakwood Safewright
4 Gutsplitter Gang
4 Ulna Alley Shopkeep
4 Scarblade Scout
4 Heirloom Auntie
3 Screeching Soulbreaker
24 Swamp`}},
      scene: [q('eirdu', 'Adherents of the sun implore others to bask in Eirdu\'s light and expel darkness from the plane.'),
        s('eirdu', 'Blight: put -1/-1 counters on your own creature as a cost. Small creatures are cheap to pay with, big ones are not.')],
      villainScene: [q('shadow', 'The scratch became a sore, the sore became a wound, the wound became an infection, and the infection became a funeral.'),
        s('shadow', 'Shadowmoor creeps in at the edges, and keeps creeping.')],
      cues: {hero: cue('Into the light.', 'Dawn!', 'The gloom is closing in...', 'The sun holds.', 'Eclipsed...', 'Pay Blight with your smallest creature.'),
        villain: cue('Rot.', 'Spread!', 'The light...', 'The gloom wins.', 'Dawn...')}},
    {slot: 2, mood: 'comic', kind: 'Lesson', title: 'Maralen\'s Court', difficulty: 'Easy', rewardSet: 'ecl', teaches: ['Vivid'],
      blurb: 'The Faerie Queen of the eclipsed plane rules from a hall of every colour.',
      hero: {who: 'grove', deck: {label: 'tribute', name: 'The Wild Kin of the Creakwood', colors: 'G', list: `
3 Bristlebane Battler
3 Champions of the Perfect
3 Vastlands Scavenger // Bind to Life
3 Emeritus of Abundance // Regrowth
2 Hungering Puppetbeast
4 Shopkeeper's Bane
4 Crossroads Watcher
4 Dawn's Light Archer
4 Pestbrood Sloth
4 Sureshot Sower
2 Aberrant Manawurm
24 Forest`}},
      villain: {who: 'maralen', deck: {label: 'tribute', name: "Maralen's Court", colors: 'BGU', list: `
3 Maralen, Fae Ascendant
3 Glen Elendra Guardian
4 Gloom Ripper
3 Loch Mare
3 Champions of the Perfect
3 Bristlebane Battler
3 Tragedy Feaster
3 Champion of the Weird
4 Taster of Wares
3 Twilight Diviner
4 Emeritus of Woe // Demonic Tutor
8 Swamp
8 Forest
8 Island`}},
      scene: [q('grove', 'Safewrights stationed within the Creakwood do not fear Shadowmoor\'s encroaching dark. They embrace it.'),
        s('grove', 'Vivid: the more colours among your permanents, the bigger the effect. A two-colour board is already better than a one-colour one.')],
      villainScene: [q('maralen', 'This is *my* domain, and *I* am its Queen.'),
        s('maralen', 'Maralen is more forgiving than Oona was, but her rule is no less absolute.')],
      cues: {hero: cue('Into the Creakwood.', 'Wild!', 'The Queen is too clever...', 'The court bows.', 'Absolute...', 'Add a second colour to your board to light Vivid.'),
        villain: cue('My domain.', 'Kneel!', 'Impossible...', 'My court.', 'Oona...')}},
    {slot: 3, mood: 'rival', kind: 'Rival', title: 'Oko, Lorwyn Liege', difficulty: 'Normal', rewardSet: 'ecl', teaches: ['Planeswalkers'],
      blurb: 'Oko is back, and this time he has two faces and an entire plane to play with.',
      hero: {who: 'ember', deck: {label: 'tribute', name: 'The Ember Kin', colors: 'R', list: `
3 Pyre Rhymer // Molten Tide
3 Goliath Daydreamer
3 Maelstrom Artisan // Rocket Volley
3 Lavaleaper
3 Curse-Marred Demon
2 Chandra, Torch of Defiance
4 Brambleback Brute
4 Thunderdrum Soloist
4 Enraged Flamecaster
4 Tackle Artist
3 Champion of the Path
24 Mountain`}},
      villain: {who: 'oko', deck: {label: 'tribute', name: 'Oko and the Eclipsed Court', colors: 'GU', list: `
3 Oko, Lorwyn Liege // Oko, Shadowmoor Scion
3 Loch Mare
3 Champions of the Shoal
3 Carnivorous Cultivator // Enroot
3 Hexhaven Invigorator
4 Topiary Lecturer
4 Chomping Changeling
4 Glen Elendra Guardian
4 Matterbending Mage
4 Mutable Explorer
1 Paradox Surveyor
12 Forest
12 Island`}},
      scene: [q('ember', 'Elsewhere in Lorwyn, nestled in a faerie ring, the coos of a small giant turned to cries.'),
        s('ember', 'Attack Oko himself. A planeswalker dies the same way a player does, from damage.')],
      villainScene: [q('oko', 'Eclipsed realms are the spaces between Lorwyn\'s stability and Shadowmoor\'s chaos'),
        s('oko', 'Oko turns your best creature into something small, and then smiles.')],
      cues: {hero: cue('Wait for the eclipse.', 'Burn him!', 'Oko is winning...', 'Oko flees.', 'Turned into a Food...', 'Attack the planeswalker, not just the player.'),
        villain: cue('Fun, isn\'t it?', 'Transform!', 'Not funny...', 'Delightful.', 'Rude...')}},
    {slot: 4, mood: 'rival', kind: 'Lesson', title: 'First-Years', difficulty: 'Normal', rewardSet: 'sos', teaches: ['Prepared'],
      blurb: 'A student, a campus map and a quiz she is already late for.',
      hero: {who: 'tam', deck: {label: 'tribute', name: 'Tam and the First-Years', colors: 'GU', list: `
3 Tam, Mindful First-Year
3 Tam, the Possibility
3 Tam, Observant Sequencer // Deep Sight
3 Berta, Wise Extrapolator
3 Avatar of Burgeoning Echoes
3 Geometer's Arthropod
4 Bristlebane Battler
4 Champions of the Perfect
4 Glen Elendra Guardian
4 Pestbrood Sloth
2 Shopkeeper's Bane
12 Forest
12 Island`}},
      villain: {who: 'rival', deck: {label: 'tribute', name: 'The Rival Students', colors: 'R', list: `
3 Champion of the Path
3 Spinerock Tyrant
3 Pyre Rhymer // Molten Tide
3 Draconic Visitor
4 Changeling Wayfinder
4 Explosive Prodigy
4 Chandra's Emberling
4 Elder Auntie
4 Mage Tower Referee
4 Skilled Battlecarver
24 Mountain`}},
      scene: [q('tam', 'I don\'t think we\'re going to make it back in time for Introduction to Prophecy.'),
        s('tam', 'Prepared: a prepared creature lets you cast a copy of its spell once. Hold the creature, keep the spell.')],
      villainScene: [q('rival', 'Strixhaven students have a sense of humor. The spirits of the Blood Age do not.'),
        s('rival', 'The rival students are loud, quick and not entirely in control.')],
      cues: {hero: cue('What are the odds?', 'Cast it twice!', 'The pranksters are loud...', 'Passed.', 'Failed the quiz...', 'Cast the copy of the spell on a prepared creature.'),
        villain: cue('Prank!', 'Boom!', 'The professor...', 'Detention for you.', 'Hey...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Strixhaven', difficulty: 'Easy', rewardSet: 'sos', teaches: ['Repartee'],
      blurb: 'The archaics remember all of history, and some of them are very upset about it.',
      hero: {who: 'prism', deck: {label: 'tribute', name: 'The Prismari Second-Years', colors: 'RU', list: `
3 Sanar, Innovative First-Year
3 Frostbite Pyromental
3 Colorstorm Stallion
3 Skycoach Conductor // All Aboard
3 Seasoned Cryomancer
4 Glen Elendra Guardian
4 Curse-Marred Demon
4 Brambleback Brute
4 Molten-Core Maestro
4 Champion of the Path
1 Thunderdrum Soloist
12 Mountain
12 Island`}},
      villain: {who: 'archaic', deck: {label: 'tribute', name: 'The Archaics of Arcavios', colors: 'G', list: `
1 The Dawning Archaic
3 Wildgrowth Archaic
3 Emeritus of Abundance // Regrowth
3 Vastlands Scavenger // Bind to Life
3 Slumbering Trudge
4 Moon-Vigil Adherents
4 Mutable Explorer
4 Topiary Lecturer
4 Chomping Changeling
4 Changeling Wayfinder
3 Simulacrum Shaper
24 Forest`}},
      scene: [q('prism', 'Life is vivid; the pigments I use should be too.'),
        s('prism', 'Repartee: when you cast an instant or sorcery that targets a creature, the creature gets a bonus. Aim spells at your own team.')],
      villainScene: [q('archaic', 'As the giant shadow loomed, the Forum of Amity fell silent for the first time in its history.'),
        s('archaic', 'The archaics experience all of Arcavios history, and they are not forgiving.')],
      cues: {hero: cue('Art is a weapon.', 'Repartee!', 'The archaic is too big...', 'The giant calms.', 'Forgotten...', 'Target your creatures with spells to light Repartee.'),
        villain: cue('Remember.', 'Crush!', 'Fading...', 'History repeats.', 'No...')}},
    {slot: 6, mood: 'comic', kind: 'Meta', title: 'Witherbloom', difficulty: 'Normal', rewardSet: 'sos', teaches: ['Deathtouch'],
      blurb: 'The college of life and death: a swamp, a garden and a very good reputation.',
      hero: {who: 'lorehold', deck: {label: 'tribute', name: 'Lorehold, the Historian', colors: 'RW', list: `
3 Kirol, Attentive First-Year
3 Bre of Clan Stoutarm
3 Aziza, Mage Tower Captain
3 Lorehold, the Historian
3 Hardened Academic
4 Sting-Slinger
4 Changeling Wayfinder
4 Practiced Scrollsmith
4 Sizzling Changeling
4 Elder Auntie
1 Tributary Vaulter
12 Mountain
12 Plains`}},
      villain: {who: 'witherbloom', deck: {label: 'tribute', name: 'Witherbloom, the Balancer', colors: 'BG', list: `
3 High Perfect Morcant
2 Lluwen, Imperfect Naturalist
2 Blech, Loafing Pest
2 Witherbloom, the Balancer
3 Emeritus of Woe // Demonic Tutor
2 Vraska, the Cutting Glare
4 Bristlebane Battler
4 Tragedy Feaster
4 Creakwood Safewright
4 Gutsplitter Gang
4 Champions of the Perfect
2 Shopkeeper's Bane
12 Swamp
12 Forest`}},
      scene: [q('lorehold', 'If you take the time to listen, the archaics will tell you that this world has been torn asunder and remade many times before.'),
        s('lorehold', 'Witherbloom has deathtouch and flying. Race it, or remove the big one before it connects.')],
      villainScene: [q('witherbloom', 'In most colleges, Erren\'s poisonous skin would have made them a pariah. In Witherbloom, they were one of the most popular students on campus.'),
        s('witherbloom', 'Witherbloom balances the books: what lives pays for what dies.')],
      cues: {hero: cue('Listen to the past.', 'History!', 'The Balancer is too good...', 'Balance restored.', 'Withered...', 'Kill deathtouch creatures before blocking with big ones.'),
        villain: cue('Balance.', 'Wither!', 'Too much life...', 'Even.', 'Unbalanced...')}},
    {slot: 7, mood: 'rival', kind: 'Rival', title: "The Theorist's Proof", difficulty: 'Hard', rewardSet: 'fra', teaches: ['Empower'],
      blurb: 'Jace\'s lieutenant is checking your work and finding it wanting.',
      hero: {who: 'chandra', deck: {label: 'tribute', name: 'The Rebels', colors: 'GR', list: `
2 Aerid Konstrari
1 Vibrance
1 Spinerock Tyrant
2 Hexhaven Invigorator
2 Champion of the Path
4 Wildgrowth Archaic
4 Moon-Vigil Adherents
4 Tenured Tethermage
4 Mutable Explorer
4 Chomping Changeling
4 Topiary Lecturer
4 Changeling Wayfinder
12 Forest
12 Mountain`}},
      villain: {who: 'uldaros', deck: {label: 'tribute', name: "Uldaros Theorix's Proof", colors: 'BU', list: `
3 Uldaros Theorix
3 Deceit
3 Null Summoner
3 Sphinx of False Conclusions
3 Emeritus of Ideation // Ancestral Recall
4 Tragedy Feaster
4 Creakwood Safewright
4 Gutsplitter Gang
4 Glen Elendra Guardian
4 Champion of the Weird
1 Scarblade Scout
12 Swamp
12 Island`}},
      scene: [q('chandra', 'If we\'re going to fix things, we should start here. Why does no one question the Theorist?'),
        s('chandra', 'Empower puts loyalty counters on a Jace token. The Theorist\'s deck builds one fast, so be ready to attack it.')],
      villainScene: [q('uldaros', 'There is no curve. Either you succeeded, or you did not. Either way, this will be informative.'),
        s('uldaros', 'Uldaros Theorix copies what he likes from the graveyard and discards the rest.')],
      cues: {hero: cue('Question everything.', 'Break the proof!', 'The proof is airtight...', 'Failed review.', 'Corrected...', 'Attack the Jace token before it grows.'),
        villain: cue('Informative.', 'Revise!', 'A flaw...', 'Validated.', 'Unsatisfactory...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'The Theorist', difficulty: 'Hard', rewardSet: 'fra', teaches: ['Reach'],
      blurb: 'Every part of Jace that objected has been cut away. What is left wants a better Multiverse.',
      hero: {who: 'allies', deck: {label: 'tribute', name: 'The Allies of the Echoverse', colors: 'GW', list: `
3 Kwia Vigorbloom
3 Solarium Sentry
3 Figure of Fable
3 Champion of the Clachan
3 Adept Watershaper
2 Slumbering Walker
4 Bristlebane Battler
4 Encumbered Reejerey
4 Soaring Stoneglider
4 Champions of the Perfect
3 Burdened Stoneback
12 Forest
12 Plains`}},
      villain: {who: 'theorist', deck: {label: 'tribute', name: 'The Theorist, Jace Beleren', colors: 'U', list: `
3 The Theorist, Jace Beleren
2 Jace, Reality Sculptor
3 Sphinx of False Conclusions
3 Emeritus of Ideation // Ancestral Recall
3 Skycoach Conductor // All Aboard
3 Variable Chaser // Arc of Fortune
4 Glen Elendra Guardian
4 Champions of the Shoal
4 Glamer Gifter
4 Unwelcome Sprite
3 Glamermite
24 Island`}},
      scene: [q('allies', 'Too many lives have been cut short, too many of their futures untold. I can rewrite them. I can give them a voice.'),
        s('allies', 'The Theorist draws extra cards and builds Illusions every turn. Do not let him durdle.')],
      villainScene: [q('theorist', 'I only wish you could see the necessity of this. Your counterparts all have.'),
        q('theorist', 'The Multiverse is a work in progress. There will need to be revisions.')],
      cues: {hero: cue('We will stop this.', 'For every future!', 'He is rewriting us...', 'Revision rejected.', 'Rewritten...', 'Pressure the Theorist before his tokens swarm.'),
        villain: cue('Revisions.', 'Rewrite!', 'A flaw in the proof...', 'Necessary.', 'Impossible...')}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'The Exigent Doom', difficulty: 'Hard', rewardSet: 'fra', rewardCard: 'Omnipresence', mood: 'boss',
      teaches: ['Trample'],
      archive: {deck: 'Emrakul and the Echoes', when: 'Autumn 2026', format: 'Story archive, no tournament list.',
        what: 'A green deck of the set\'s big creatures, with Emrakul, the Exigent Doom as its top end.',
        why: 'It stands for what Tam calls on after the Theorist, and is not a list anyone won with.',
        beat: 'Chump the big creatures, keep your life high and win before Emrakul arrives.',
        after: 'Nothing; this is the optional superboss at the end of the story.'},
      blurb: 'Tam calls on something far older than a Theorist, and it answers.',
      hero: {who: 'tam', deck: {label: 'tribute', name: 'Tam and the Possibility', colors: 'GU', list: `
3 Tam, the Possibility
3 Tam, Mindful First-Year
3 Berta, Wise Extrapolator
3 Quandrix, the Proof
3 Wistfulness
3 Avatar of Burgeoning Echoes
4 Bristlebane Battler
4 Champions of the Perfect
4 Glen Elendra Guardian
4 Pestbrood Sloth
2 Paradox Surveyor
12 Forest
12 Island`}},
      villain: {who: 'emrakul', deck: {label: 'tribute', name: 'Emrakul and the Echoes', note: 'Built from cards in this act\'s sets only. No tournament list is copied.', colors: 'G', list: `
2 Emrakul, the Exigent Doom
3 Aurora Awakener
3 Hungering Puppetbeast
3 Hexhaven Invigorator
3 Champions of the Perfect
3 Bristlebane Battler
4 Mutable Explorer
4 Wildgrowth Archaic
4 Moon-Vigil Adherents
4 Topiary Lecturer
3 Changeling Wayfinder
24 Forest`}},
      scene: [q('tam', 'What are the odds? And what would you like them to be?'),
        s('tam', 'Race it. Emrakul needs ten mana, and every turn she is late is a turn you are ahead.')],
      villainScene: [s('emrakul', 'Emrakul does not speak. The Multiverse does it for her.')],
      cues: {hero: cue('Ask for odds.', 'Possibility!', 'The Doom is coming...', 'Undone.', 'Consumed...', 'Win before Emrakul reaches ten mana.'),
        villain: cue('Echo.', 'Exigent!', 'Not yet...', 'It comes.', 'Denied...')},
      after: [s('stage', 'Recorded: the two multiverses come apart and Tam finds her way back to class, late as ever.')]},
  ],
};
