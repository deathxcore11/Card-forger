// Act 33: Kamigawa and Capenna (Kamigawa: Neon Dynasty, Streets of New Capenna). Story and dialogue:
// /mnt/project-files/story/act-33-script.md (generated from this file). Land set: neo.
// A neon Kamigawa where the Phyrexians are already inside the walls, then a city of angels built on demons. Every quoted line
// is real flavor text from these two sets; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'neon-kami-crime',
  era: '2022-02-18',
  intro: [s('stage', 'Kamigawa, three centuries on: neon, mechs, and spirits that have not gone anywhere.'),
    q('stage', 'To keep the Reality Chip out of Jin-Gitaxias\'s hands, the Wanderer entrusted it to Tamiyo.'),
    s('stage', 'A ninja named Kaito has come to Towashi for a chip, and the Imperial guard is looking for him.')],
  finale: [q('stage', 'For all their planning, Tamiyo and Kaito were unprepared to face the full power of a Phyrexian praetor.'),
    s('stage', 'Jin-Gitaxias is stopped, for now. On New Capenna, the crime families are still sorting out who owns the city.'),
    s('stage', 'Recorded: Kamigawa and Capenna each have their endings. The Phyrexians know a lot more than they did.')],
  villainFinale: [q('stage', 'Kaito grabbed the chip, hoping it held answers.'),
    s('stage', 'In this version, the praetor gets what he came for, and the city belongs to the machines.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Network Terminal'},
    kaito: {name: 'Kaito', title: 'Ninja of Towashi', card: 'Kaito Shizuki', focus: '50% 25%'},
    imperial: {name: 'The Imperial Guard', title: 'Of Eiganjo', card: 'Eiganjo Exemplar', focus: '50% 30%'},
    kami: {name: 'The Moon-Kami', title: 'Of Kamigawa', card: 'Lion Sash', focus: '50% 30%'},
    jin: {name: 'Jin-Gitaxias\'s Hackers', title: 'Phyrexian Praetor', card: 'Network Disruptor', focus: '50% 30%'},
    maestros: {name: 'The Maestros', title: 'Family of New Capenna', card: 'Maestros Diabolist', focus: '50% 30%'},
    brokers: {name: 'The Brokers', title: 'Family of New Capenna', card: 'Brokers Initiate', focus: '50% 30%'},
    elspeth: {name: 'Elspeth', title: 'Seeker of the Halo', card: 'Elspeth Resplendent', focus: '50% 25%'},
    ob: {name: 'Ob Nixilis', title: 'The Adversary', card: 'Ob Nixilis, the Adversary', focus: '50% 25%'},
    riveteers: {name: 'The Riveteers', title: 'Family of New Capenna', card: 'Riveteers Initiate', focus: '50% 30%'},
    obscura: {name: 'The Obscura', title: 'Family of New Capenna', card: 'Obscura Initiate', focus: '50% 30%'},
    raffine: {name: 'Esper Raffine', title: 'Spring 2022', card: 'Raffine, Scheming Seer', focus: '50% 25%'},
    white: {name: 'Mono-White', title: 'Spring 2022', card: 'Inspiring Overseer', focus: '50% 30%'},
    skies: {name: 'Azorius Skies', title: 'Spring 2022', card: 'Mothrider Patrol', focus: '50% 30%'},
    runes: {name: 'Naya Runes', title: 'Spring 2022', card: 'Heir of the Ancient Fang', focus: '50% 30%'},
    kaitotamiyo: {name: 'Kaito and Tamiyo', title: 'Of Towashi', card: 'Kaito Shizuki', focus: '50% 25%'},
    jinboss: {name: 'Jin-Gitaxias', title: 'Progress Tyrant', card: 'Jin-Gitaxias, Progress Tyrant', focus: '50% 25%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Chip', difficulty: 'Easy', rewardSet: 'neo', teaches: ['Ninjutsu'],
      blurb: 'Kaito is in Towashi after a chip that could end the Phyrexians. The Imperial guard wants him in a cell.',
      hero: {who: 'kaito', deck: {label: 'tribute', name: 'The Ninjas of Towashi', colors: 'UB', list: `
4 Moon-Circuit Hacker
4 Dokuchi Silencer
3 Silver-Fur Master
3 Biting-Palm Ninja
4 Thousand-Faced Shadow
2 Satoru Umezawa
2 Kotose, the Silent Spider
3 Nezumi Prowler
3 Kaito Shizuki
3 Lethal Exploit
3 You Are Already Dead
2 Kaito's Pursuit
4 Dismal Backwater
10 Island
10 Swamp`}},
      villain: {who: 'imperial', deck: {label: 'tribute', name: 'The Imperial Guard', colors: 'W', list: `
4 Selfless Samurai
4 Kitsune Ace
4 Blade-Blizzard Kitsune
4 Imperial Subduer
4 Seven-Tail Mentor
2 Eiganjo Exemplar
3 Mothrider Patrol
3 Norika Yamazaki, the Poet
2 Light-Paws, Emperor's Voice
4 Light the Way
2 Banishing Slash
24 Plains`}},
      scene: [q('stage', 'Kaito grabbed the chip, hoping it held answers.'),
        q('stage', 'So swift and sharp was his blade that the ogre never even felt the cut.'),
        s('kaito', 'Ninjutsu: return an unblocked attacker to your hand to put a ninja onto the battlefield, attacking. Hit them where they are not looking.')],
      villainScene: [q('stage', 'Imperial samurai undergo strict training, honing their skills and purifying their spirits in the hope that they will prove worthy of a kami\'s blessing.'),
        q('stage', 'Oh, sorry—were we racing?')],
      cues: {hero: cue('Keep moving.', 'Ninjutsu!', 'They have me cornered...', 'Out over the rooftops.', 'Caught...', 'Attack unblocked, then swap in the ninja.'),
        villain: cue('Halt!', 'For the Emperor!', 'He slipped away...', 'Order restored.', 'Broken...')}},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'The Moon-Kami', difficulty: 'Easy', rewardSet: 'neo', teaches: ['Reconfigure'],
      blurb: 'Armoured kami and mech stand against Jin-Gitaxias\'s hackers on the Towashi roofs.',
      hero: {who: 'kami', deck: {label: 'tribute', name: 'The Moon-Kami', colors: 'W', list: `
4 Lion Sash
3 Cloudsteel Kirin
4 Hotshot Mechanic
3 Imperial Subduer
2 Ancestral Katana
3 Dragonfly Suit
4 Mothrider Patrol
4 Kitsune Ace
3 Selfless Samurai
3 Seven-Tail Mentor
3 Light the Way
24 Plains`}},
      villain: {who: 'jin', deck: {label: 'tribute', name: 'The Hackers of Jin-Gitaxias', colors: 'U', list: `
4 Moon-Circuit Hacker
4 Network Disruptor
4 Futurist Operative
3 Mobilizer Mech
3 Armguard Familiar
3 Moonfolk Puzzlemaker
3 Replication Specialist
3 Skyswimmer Koi
3 Guardians of Oboro
3 Covert Technician
3 Disruption Protocol
24 Island`}},
      scene: [q('stage', 'If your mech is factory standard, you might as well be walking.'),
        q('stage', 'Be proud, young pup! You\'ve earned your wings. Rise and become the western wind.'),
        s('kami', 'Reconfigure: pay the cost and a creature attaches to another as equipment. Pay it again and it unattaches and fights again.')],
      villainScene: [q('stage', 'Just as I suspected. They thought they\'d hidden the terminal, so they got lazy with the encryption.'),
        q('stage', 'Let\'s just turn that off, shall we?')],
      cues: {hero: cue('Armour up.', 'Reconfigure!', 'The hackers see me...', 'The roofs are safe.', 'Shut down...', 'Attach when you need defense, detach to attack.'),
        villain: cue('Access granted.', 'Uploaded!', 'Connection lost...', 'Compleated.', 'Shut down...')}},
    {slot: 3, mood: 'comic', kind: 'Lesson', title: 'Families at the Table', difficulty: 'Easy', rewardSet: 'snc', teaches: ['Shield counters'],
      blurb: 'New Capenna: the Maestros and the Brokers meet over dinner. Everyone brought a knife.',
      hero: {who: 'maestros', deck: {label: 'tribute', name: 'The Maestros', colors: 'UBR', list: `
3 Maestros Diabolist
4 Maestros Initiate
2 Cormela, Glamour Thief
2 Lord Xander, the Collector
3 Corpse Appraiser
3 Glamorous Outlaw
3 Syndicate Infiltrator
3 Snooping Newsie
3 Midnight Assassin
3 Sanguine Spy
3 Murder
2 Hostile Takeover
2 Maestros Charm
4 Maestros Theater
3 Xander's Lounge
2 Dismal Backwater
5 Island
5 Swamp
5 Mountain`}},
      villain: {who: 'brokers', deck: {label: 'tribute', name: 'The Brokers', colors: 'GWU', list: `
4 Brokers Initiate
4 Brokers Veteran
3 Disciplined Duelist
4 Civil Servant
3 Darling of the Masses
3 Celestial Regulator
3 Scheming Fence
3 Metropolis Angel
3 Spara's Adjudicators
2 Brokers Charm
2 Exotic Pets
2 Endless Detour
4 Brokers Hideout
3 Spara's Headquarters
2 Tranquil Cove
5 Plains
5 Island
5 Forest`}},
      scene: [q('stage', 'How far are you willing to go for your family, cleanblade?'),
        q('stage', 'Where did I find my horned friend? Now there\'s a story worth telling. . . .'),
        s('maestros', 'Shield counters: a creature with one is protected once. If it would be damaged or destroyed, remove the counter instead.')],
      villainScene: [q('stage', 'Regarding the relative might of pen and sword, the official position of the Brokers is "Why choose?"'),
        q('stage', 'Saving a stranger\'s life is an excellent recruitment method. Luckily, peril is so easy to come by.')],
      cues: {hero: cue('Family first.', 'Encore!', 'They shielded everything...', 'The Maestros win.', 'Dinner is over...', 'Break the shield counter before the real attack.'),
        villain: cue('Why choose?', 'A fine deal!', 'The deal falls through...', 'Sign here.', 'No deal...')}},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'The Demon Who Owns the City', difficulty: 'Normal', rewardSet: 'snc', teaches: ['Planeswalkers'],
      blurb: 'Elspeth is looking for the Halo. Ob Nixilis already owns half the city.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'Elspeth\'s Angels', colors: 'W', list: `
4 Inspiring Overseer
4 Raffine's Informant
3 Extraction Specialist
2 Giada, Font of Hope
4 Swooping Protector
4 Dapper Shieldmate
4 Brokers Initiate
4 Celebrity Fencer
1 Elspeth Resplendent
2 Kill Shot
3 Knockout Blow
1 Revelation of Power
24 Plains`}},
      villain: {who: 'ob', deck: {label: 'tribute', name: 'Ob Nixilis\'s Syndicate', colors: 'BR', list: `
4 Ob Nixilis, the Adversary
3 Forge Boss
4 Body Dropper
2 Fatal Grudge
2 Night Clubber
3 Revel Ruiner
2 Girder Goons
2 Angel of Suffering
3 Shakedown Heavy
3 Strangle
4 Murder
4 Pyre-Sledge Arsonist
4 Bloodfell Caves
10 Swamp
10 Mountain`}},
      scene: [q('stage', 'The source of the Cabaretti\'s Halo turned out to be a single teenage girl.'),
        q('stage', 'Angels are living proof that power does not always lead to corruption.'),
        s('elspeth', 'Planeswalkers: keep Elspeth alive and she wins the long game. Attack his walker the turn it appears.')],
      villainScene: [q('stage', 'Ob Nixilis decided the fastest way to seize control of New Capenna would be to usurp the networks of power already hidden there. Xander\'s Maestros were the first to fall.'),
        q('stage', 'Kill count? I lost track years ago.')],
      cues: {hero: cue('For the Halo.', 'Resplendent!', 'He owns the city...', 'The Halo is safe.', 'Lost in the dark...', 'Guard Elspeth, attack his walker.'),
        villain: cue('Mine.', 'Casualty!', 'The family slips...', 'The city is mine.', 'Evicted...')}},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'Connive', difficulty: 'Normal', rewardSet: 'snc', teaches: ['Connive'],
      blurb: 'The Riveteers hit the Obscura where it hurts: a vault full of secrets.',
      hero: {who: 'riveteers', deck: {label: 'tribute', name: 'The Riveteers', colors: 'BRG', list: `
4 Riveteers Initiate
4 Riveteers Requisitioner
3 Crew Captain
2 Mr. Orfeo, the Boulder
3 Masked Bandits
2 Ziatora, the Incinerator
4 Ziatora's Envoy
3 Riveteers Decoy
3 Unleash the Inferno
3 Riveteers Charm
3 Strangle
2 Murder
4 Riveteers Overlook
3 Ziatora's Proving Ground
2 Bloodfell Caves
5 Swamp
5 Mountain
5 Forest`}},
      villain: {who: 'obscura', deck: {label: 'tribute', name: 'The Obscura', colors: 'WUB', list: `
4 Obscura Initiate
3 Obscura Interceptor
3 Nimble Larcenist
2 Queza, Augur of Agonies
2 Raffine, Scheming Seer
2 Shattered Seraph
3 Aven Heartstabber
3 Psionic Snoop
3 Wingshield Agent
4 Ledger Shredder
3 Undercover Operative
2 Void Rend
2 Obscura Charm
4 Obscura Storefront
3 Raffine's Tower
2 Dismal Backwater
5 Plains
5 Island
5 Swamp`}},
      scene: [q('stage', 'We are this city, down to its bones.'),
        q('stage', 'I\'ve analyzed the vault schematic. Do you want the fast way, the easy way, or the secret way in?'),
        s('riveteers', 'Connive: draw a card, then discard a card. If it was a nonland card, put a +1/+1 counter on the creature.')],
      villainScene: [q('stage', 'Obscura initiates are required to bring a gift of information. They are judged on both how useful it is and how hard it was to obtain.'),
        q('stage', 'No evidence, no crime.')],
      cues: {hero: cue('Break in.', 'Smash it!', 'The vault is shut...', 'The vault is open.', 'Locked out...', 'Connive a nonland card to grow the creature.'),
        villain: cue('Information.', 'Seen!', 'A leak...', 'The Obscura knows.', 'Exposed...')}},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Esper Raffine', difficulty: 'Normal', rewardSet: 'snc', teaches: ['Card advantage'],
      blurb: 'Spring 2022: a three-colour Obscura midrange deck against mono-white weenies.',
      hero: {who: 'raffine', deck: {label: 'tribute', name: 'Esper Midrange', colors: 'WUB', archetype: 'Midrange', list: `
3 Raffine, Scheming Seer
2 Queza, Augur of Agonies
3 Obscura Interceptor
3 Nimble Larcenist
4 Raffine's Informant
3 Obscura Initiate
4 Ledger Shredder
2 Shattered Seraph
3 Void Rend
3 Obscura Charm
4 Murder
2 Kill Shot
4 Obscura Storefront
3 Raffine's Tower
2 Dismal Backwater
4 Plains
5 Island
6 Swamp`}},
      villain: {who: 'white', deck: {label: 'tribute', name: 'Mono-White', colors: 'W', archetype: 'Aggro', list: `
4 Brokers Initiate
4 Raffine's Informant
4 Inspiring Overseer
2 Extraction Specialist
3 Celebrity Fencer
4 Swooping Protector
3 Giada, Font of Hope
4 Sky Crier
3 Illuminator Virtuoso
1 Kill Shot
24 Plains
4 Dapper Shieldmate`}},
      scene: [q('stage', 'In volatile times, a sense of certainty is in high demand.'),
        q('stage', 'This city could certainly use a bit more divine intervention.'),
        s('raffine', 'Trade your removal for their best creature and win with card quality.')],
      villainScene: [q('stage', 'Together we can build a safer, brighter New Capenna!'),
        q('stage', 'In the assassination trade, no one lives to make more than one mistake.')],
      cues: {hero: cue('Patience.', 'Scheming!', 'The weenies are quick...', 'Quality wins.', 'Run over...', 'Do not take too much damage early.'),
        villain: cue('Together!', 'Charge!', 'Out of fliers...', 'A brighter city.', 'Shut out...')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Azorius Skies', difficulty: 'Normal', rewardSet: 'neo', teaches: ['Double strike'],
      blurb: 'Spring 2022: fliers and mech against Naya Runes.',
      hero: {who: 'skies', deck: {label: 'tribute', name: 'Azorius Skies', colors: 'WU', archetype: 'Tempo', list: `
4 Mothrider Patrol
4 Kitsune Ace
4 Blade-Blizzard Kitsune
3 Moonfolk Puzzlemaker
3 Skyswimmer Koi
3 Futurist Operative
3 Imperial Subduer
3 Metropolis Angel
2 Prodigy's Prototype
3 Seven-Tail Mentor
2 Spell Pierce
2 Light the Way
4 Tranquil Cove
10 Plains
10 Island`}},
      villain: {who: 'runes', deck: {label: 'tribute', name: 'The Jukai Order', colors: 'RG', archetype: 'Aggro', note: 'Naya Runes is red, green and white; the white is dropped for our land pool.', list: `
4 Jukai Preserver
4 Heir of the Ancient Fang
4 Jukai Trainee
3 Spring-Leaf Avenger
3 Blossom Prancer
3 Kura, the Boundless Sky
4 Kodama of the West Tree
2 Peerless Samurai
2 Thundering Raiju
3 Sokenzan Smelter
3 Boon of Boseiju
1 Kindled Fury
4 Rugged Highlands
10 Forest
10 Mountain`}},
      scene: [q('stage', 'Research is hardly the dry, serious pastime outsiders make it out to be.'),
        q('stage', 'Once they swam alone among the clouds, but now the people of Kamigawa have built high enough to reach them.'),
        s('skies', 'Get ahead in the air and race. Their big creatures cannot block fliers.')],
      villainScene: [q('stage', 'The kami grant you this boon, not I.'),
        q('stage', 'I fear I have run out of worthy opponents.')],
      cues: {hero: cue('Up we go.', 'Fliers!', 'Their ground game is huge...', 'The sky is ours.', 'Grounded...', 'Race in the air.'),
        villain: cue('The kami grant it.', 'Boon!', 'Out of runes...', 'The grove wins.', 'Pruned...')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Jin-Gitaxias, Progress Tyrant', difficulty: 'Hard', rewardSet: 'neo', teaches: ['Flying'],
      blurb: 'The Praetor wants everything on Kamigawa, and Kaito and Tamiyo are the last ones in his way.',
      hero: {who: 'kaitotamiyo', deck: {label: 'tribute', name: 'Kaito and Tamiyo', colors: 'UB', list: `
2 Kaito Shizuki
3 Nezumi Prowler
2 Satoru Umezawa
3 Kotose, the Silent Spider
4 Thousand-Faced Shadow
4 Moon-Circuit Hacker
4 Dokuchi Silencer
3 Silver-Fur Master
3 Biting-Palm Ninja
3 Lethal Exploit
3 You Are Already Dead
2 Kaito's Pursuit
4 Dismal Backwater
10 Island
10 Swamp`}},
      villain: {who: 'jinboss', deck: {label: 'tribute', name: 'Jin-Gitaxias\'s Machines', colors: 'U', list: `
4 Jin-Gitaxias, Progress Tyrant
4 Moon-Circuit Hacker
4 Network Disruptor
4 Mobilizer Mech
2 Armguard Familiar
4 Futurist Operative
4 Replication Specialist
3 Moonfolk Puzzlemaker
2 Reality Heist
2 Disruption Protocol
1 Spell Pierce
2 Tezzeret, Betrayer of Flesh
24 Island`}},
      scene: [q('stage', 'To keep the Reality Chip out of Jin-Gitaxias\'s hands, the Wanderer entrusted it to Tamiyo.'),
        q('stage', 'For all their planning, Tamiyo and Kaito were unprepared to face the full power of a Phyrexian praetor.'),
        s('kaitotamiyo', 'He copies everything he sees. Pressure him early and counter his big plays.')],
      villainScene: [q('stage', 'The Imperials can\'t arrest you for illegal tech if you never even existed.'),
        q('stage', 'Just as I suspected. They thought they\'d hidden the terminal, so they got lazy with the encryption.')],
      cues: {hero: cue('For Kamigawa!', 'Together!', 'He knows every move...', 'The chip is safe.', 'Compleated...', 'Pressure him and counter the big plays.'),
        villain: {...cue('Progress.', '[a flicker of code]', '[a system error]', 'Exactly what I came for.', '[the code scrambles]'),
          half: {who: 'kami', line: 'The moon does not obey a machine.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Esper Raffine at Full Power', difficulty: 'Hard', rewardSet: 'snc', rewardCard: 'Raffine, Scheming Seer', mood: 'boss',
      teaches: ['Lifelink'],
      archive: {deck: 'Esper Midrange', when: 'Spring 2022', format: 'Standard.',
        what: 'A three-colour deck built around Raffine, Scheming Seer, cheap interactive creatures, and clean removal.',
        why: 'It had the best mana in the format, with cards that were good at every stage of the game.',
        beat: 'Kill Raffine early, and keep a Murder for their Ledger Shredder.',
        after: 'Dominaria United arrived in autumn 2022 and the format changed again.'},
      blurb: 'Deep in the archive, a three-colour deck that is never out of answers.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Mono-White', colors: 'W', archetype: 'Aggro', list: `
4 Brokers Initiate
4 Raffine's Informant
4 Inspiring Overseer
4 Extraction Specialist
4 Celebrity Fencer
4 Swooping Protector
3 Giada, Font of Hope
3 Sky Crier
3 Illuminator Virtuoso
3 Kill Shot
24 Plains`}},
      villain: {who: 'raffine', deck: {label: 'tribute', name: 'Esper Midrange', note: 'Built from cards in this act\'s sets only. No single tournament list is copied.', colors: 'WUB', archetype: 'Midrange', list: `
4 Raffine, Scheming Seer
3 Queza, Augur of Agonies
4 Obscura Interceptor
4 Ledger Shredder
3 Nimble Larcenist
3 Obscura Initiate
2 Shattered Seraph
4 Void Rend
3 Obscura Charm
3 Murder
3 Kill Shot
4 Obscura Storefront
3 Raffine's Tower
2 Dismal Backwater
5 Plains
5 Island
5 Swamp`}},
      scene: [q('stage', 'Some try to unravel the tangled skeins of fate. She reweaves them to her own deadly design.'),
        s('you', 'Go under them. They have the better late game.')],
      villainScene: [q('stage', 'The Obscura\'s Cloud Spire dominates the skyline, its eye a beacon of progress that sees all.')],
      cues: {hero: cue('Hit first.', 'Charge!', 'They have answers...', 'Raffine falls.', 'Out-valued...', 'Aggro beats value.'),
        villain: cue('[a quiet scheme]', '[the eye opens]', '[a counter]', '[the plan holds]', '[the plan fails]')},
      after: [s('stage', 'Recorded: Dominaria United arrived in autumn 2022 and the format changed again.')]},
  ],
};
