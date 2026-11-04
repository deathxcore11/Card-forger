// Act 18: Phyrexia Wins (Scars of Mirrodin, Mirrodin Besieged, New Phyrexia, Magic 2012). Story and dialogue:
// /mnt/project-files/story/act-18-script.md (generated from this file). Land set: som.
// Mirrodin, the metal plane Karn built (Act 11), was seeded with Phyrexian oil long ago. Now the oil has spread through
// every layer and five Praetors rise to divide the new world. Koth, Elspeth and Melira lead the Mirran resistance;
// Venser gives his spark to cure Karn and dies. This time the villain wins. Every quoted line is real flavor text from
// Scars of Mirrodin block or Magic 2012; unquoted lines are ours.
const cue = (start, big, low, win, loss, half) => ({start, big, low, win, loss, ...(half ? {half} : {})});
const q = (who, line) => ({who, line, quote: true});
const s = (who, line) => ({who, line});
export default {
  vibe: 'phyrexia-wins-oil',
  era: '2011-07-15',
  intro: [s('stage', 'Mirrodin. Karn built this plane out of metal, and Memnarch ruled it, and five suns lit it. Act 11 told that story.'),
    s('stage', 'What nobody knew was that Karn carried something here when he made it: a drop of black oil from Phyrexia.'),
    q('stage', 'As long as one drop of the oil exists, the joyous work continues.'),
    s('stage', 'The oil has had a thousand years. Now it is everywhere, and the Phyrexians it made are coming up out of the core.')],
  finale: [s('stage', 'Elesh Norn falls back, and it changes nothing. Every layer of the plane is Phyrexian now. Mirrodin is called New Phyrexia.'),
    s('stage', 'Deep in the core, Venser is dead. He gave his spark to Karn to burn the oil out of him. Karn wakes up clean, and leaves to make sure this never happens to another world.'),
    q('karn', 'My world is corrupted beyond cleansing. I must prevent this from happening to others.'),
    s('elspeth', 'I came here to fight. There is nothing left to fight for. I am sorry, Koth.'),
    q('koth', 'If there can be no victory, then I will fight forever.'),
    s('melira', 'Then we go down, into the furnace layer, where the red Praetor does not care who lives. And we keep the last Mirrans breathing.')],
  villainFinale: [s('stage', 'The suns go dark one by one. The last Mirran banners burn on Kuldotha.'),
    q('norn', 'The Gitaxians whisper among themselves of other worlds. If they exist, we must bring Phyrexia\'s magnificence to them.'),
    s('norn', 'They called it an invasion. It was a healing. Every flaw on this world has been cut away.'),
    s('stage', 'For Elesh Norn, this is the good ending. She has already started planning the next one.')],
  cast: {
    you: {name: 'You', title: 'Planeswalker', card: 'Venser\'s Journal'},
    koth: {name: 'Koth', title: 'Of the Hammer', card: 'Koth of the Hammer', focus: '50% 25%'},
    geth: {name: 'Geth', title: 'Lord of the Vault', card: 'Geth, Lord of the Vault', focus: '50% 25%'},
    elspeth: {name: 'Elspeth Tirel', title: 'Planeswalker', card: 'Elspeth Tirel', focus: '50% 25%'},
    vorinclex: {name: 'Vorinclex', title: 'Voice of Hunger', card: 'Vorinclex, Voice of Hunger', focus: '50% 30%'},
    melira: {name: 'Melira', title: 'Sylvok Outcast', card: 'Melira, Sylvok Outcast', focus: '50% 25%'},
    sheoldred: {name: 'Sheoldred', title: 'Whispering One', card: 'Sheoldred, Whispering One', focus: '50% 25%'},
    venser: {name: 'Venser', title: 'The Sojourner', card: 'Venser, the Sojourner', focus: '50% 25%'},
    jin: {name: 'Jin-Gitaxias', title: 'Core Augur', card: 'Jin-Gitaxias, Core Augur', focus: '50% 30%'},
    karn: {name: 'Karn', title: 'Liberated', card: 'Karn Liberated', focus: '50% 25%'},
    urabrask: {name: 'Urabrask', title: 'The Hidden', card: 'Urabrask the Hidden', focus: '50% 25%'},
    kuldotha: {name: 'Kuldotha Red', title: 'Winter 2010', card: 'Kuldotha Rebirth', focus: '50% 30%'},
    crusaders: {name: 'Mirran Crusaders', title: 'Spring 2011', card: 'Mirran Crusader', focus: '50% 25%'},
    norn: {name: 'Elesh Norn', title: 'Grand Cenobite', card: 'Elesh Norn, Grand Cenobite', focus: '50% 25%'},
    blade: {name: 'Caw-Blade', title: '2011', card: 'Sword of Feast and Famine', focus: '50% 40%'},
  },
  battles: [
    {slot: 1, mood: 'tension', kind: 'Arrival', title: 'The Oxid Ridge', difficulty: 'Easy', rewardSet: 'som', teaches: ['Metalcraft'],
      blurb: 'You arrive on Mirrodin in the red mountains of the Oxid Ridge. Koth, a Vulshok geomancer who can bend metal, is fighting creatures his people have never seen: Mirrans gone grey and wet, led by Geth, a Moriok who sold himself to the oil.',
      hero: {who: 'koth', deck: {label: 'tribute', name: 'The Vulshok', colors: 'R', list: `
2 Koth of the Hammer
4 Spikeshot Elder
4 Ferrovore
4 Iron Myr
4 Vulshok Heartstoker
4 Galvanic Blast
4 Oxidda Scrapmelter
24 Mountain
4 Arc Trail
2 Incinerate
4 Shock`}},
      villain: {who: 'geth', deck: {label: 'tribute', name: 'Geth\'s Rotters', colors: 'B', list: `
2 Geth, Lord of the Vault
4 Vector Asp
4 Ichorclaw Myr
4 Septic Rats
4 Hand of the Praetors
4 Corpse Cur
24 Swamp
4 Tormented Soul
4 Child of Night
4 Dross Hopper
2 Blistergrub`}},
      scene: [q('koth', 'If it wasn\'t a blackened, stinking, melted abomination before, it certainly is now.'),
        s('koth', 'Metalcraft: some Mirran cards get stronger while you control three or more artifacts. Keep your metal on the table and they hit harder.')],
      villainScene: [q('geth', 'To death all must go, and so in death lies ultimate power.'),
        q('geth', 'The Moriok are fools. They try so hard to gain my favor. All I want is for them to die quickly, to join the ranks of the nim.')],
      cues: {hero: cue('Hammer up.', 'Metal answers me!', 'The rot is spreading...', 'Back into the dark.', 'The ridge... falls...', 'Three artifacts. Then strike.'),
        villain: cue('Join us.', 'The oil takes another.', 'Your metal burns...', 'One more for the vats.', 'I have been dead before.')},
      after: [s('koth', 'Those were Moriok. My neighbours. Whatever this oil is, it is not a sickness. It is a recruiter.')]},
    {slot: 2, mood: 'march', kind: 'Lesson', title: 'Steel Answers', difficulty: 'Easy', rewardSet: 'som', teaches: ['Infect'],
      blurb: 'Elspeth Tirel, a planeswalker who has fled too many wars, came to Mirrodin because it was quiet. In the Tangle, the green Praetor Vorinclex is turning the forest\'s beasts into weapons that poison instead of wound.',
      hero: {who: 'elspeth', deck: {label: 'tribute', name: 'The Whitesun\'s Guard', colors: 'W', list: `
2 Elspeth Tirel
4 Glint Hawk
4 Auriok Sunchaser
4 Kemba's Skyguard
4 Leonin Skyhunter
4 Accorder Paladin
4 Revoke Existence
4 Arrest
4 Kemba's Legion
2 Honor of the Pure
24 Plains`}},
      villain: {who: 'vorinclex', deck: {label: 'tribute', name: 'The Tangle\'s Hunger', colors: 'G', list: `
1 Vorinclex, Voice of Hunger
4 Cystbearer
4 Blight Mamba
4 Tangle Angler
4 Rot Wolf
4 Phyrexian Hydra
4 Blightwidow
4 Thrun, the Last Troll
4 Untamed Might
3 Viridian Corrupter
24 Forest`}},
      scene: [q('elspeth', 'I was called to this world of steel, and it will be my steel that answers.'),
        s('elspeth', 'Infect: these creatures deal damage as poison counters to players and -1/-1 counters to creatures. Ten poison counters and you lose, whatever your life total says. Watch the poison, not the life.')],
      villainScene: [q('vorinclex', 'Let them have their revel. Soon those who won\'t submit will be turned. Those who won\'t be turned will die.'),
        q('stage', 'Its venom drips with Phyrexia\'s hate.')],
      cues: {hero: cue('Shields up.', 'For the Whitesun!', 'The poison is spreading...', 'The Tangle is quiet.', 'Ten counters...', 'Count the poison.'),
        villain: cue('Feed.', 'The hunt grows!', 'Prey that bites...', 'Turned.', 'The Tangle will remember.')},
      after: [s('elspeth', 'I came here to hide from war. It seems wars find me wherever I go.')]},
    {slot: 3, mood: 'tension', kind: 'Lesson', title: 'The Outcast', difficulty: 'Easy', rewardSet: 'nph', teaches: ['Proliferate'],
      blurb: 'Melira is a Sylvok girl the other Mirrans once shunned because metal never grew in her body. Now the oil cannot touch her either, and that makes her the most important person on the plane. Sheoldred, the black Praetor, wants her taken apart to see why.',
      hero: {who: 'melira', deck: {label: 'tribute', name: 'Melira\'s Keepers', colors: 'GW', list: `
2 Melira, Sylvok Outcast
4 Llanowar Elves
4 Viridian Emissary
4 Leonin Relic-Warder
4 Garruk's Companion
4 Ezuri's Brigade
4 Melira's Keepers
4 Revoke Existence
4 Accorder Paladin
2 Titanic Growth
12 Forest
12 Plains`}},
      villain: {who: 'sheoldred', deck: {label: 'tribute', name: 'The Whispering Choir', colors: 'B', list: `
1 Sheoldred, Whispering One
2 Whispering Specter
2 Plague Stinger
4 Ichor Rats
2 Necropede
24 Swamp
4 Tormented Soul
3 Child of Night
4 Moriok Reaver
2 Zombie Goliath
2 Dross Hopper
4 Blistergrub
4 Duskhunter Bat
2 Gravedigger`}},
      scene: [q('melira', 'Once a pariah, now Mirrodin\'s greatest hope.'),
        s('melira', 'Proliferate: choose any number of things that already have counters, and give each one more of a kind it has. Poison counters too. So kill the infect creatures before they start, and the proliferate has nothing to grow.')],
      villainScene: [q('sheoldred', 'Welcome to perfection.'),
        q('sheoldred', 'The sooner you join Phyrexia, the sooner you\'ll forget your painful rebirth.')],
      cues: {hero: cue('Keep together.', 'Keepers, hold!', 'Too many counters...', 'Not today.', 'Run, all of you...', 'Stop the first counter.'),
        villain: cue('Bring me the girl.', 'Grow, little counters.', 'She resists...', 'Compleat.', 'The girl... remains...')},
      after: [s('melira', 'They want me because I am different. That was always why people wanted me, one way or another.')]},
    {slot: 4, mood: 'tension', kind: 'Rival', title: 'Venser\'s Last Stand', difficulty: 'Normal', rewardSet: 'som', teaches: ['Card advantage'],
      blurb: 'Venser, the Dominarian teleporter from Act 14, has come to Mirrodin looking for Karn. He finds him in the core, half eaten by the oil and whispering in Phyrexian. To reach him, Venser has to get past the blue Praetor, Jin-Gitaxias.',
      hero: {who: 'venser', deck: {label: 'tribute', name: 'The Sojourner\'s Workshop', colors: 'WU', list: `
4 Glint Hawk
4 Thrummingbird
4 Trinket Mage
4 Riddlesmith
4 Auriok Sunchaser
4 Mana Leak
4 Arrest
4 Phyrexian Metamorph
4 Porcelain Legionnaire
4 Seachrome Coast
10 Plains
10 Island`}},
      villain: {who: 'jin', deck: {label: 'tribute', name: 'The Synthesis', colors: 'U', list: `
1 Jin-Gitaxias, Core Augur
4 Blighted Agent
4 Neurok Invisimancer
4 Vedalken Anatomist
4 Phyrexian Ingester
4 Inexorable Tide
4 Mana Leak
4 Steady Progress
3 Tezzeret's Gambit
4 Darkslick Drake
24 Island`}},
      scene: [q('venser', 'They can\'t even comprehend nature. How could they improve it?'),
        s('venser', 'Karn made me what I am. He was the first one who ever believed in me. I am not leaving him down here.')],
      villainScene: [q('jin', 'Forswear the flesh and you will truly see.'),
        q('jin', 'See how gratefully this world accepts our blessings.')],
      cues: {hero: cue('Hold on, Karn.', 'Blink and gone!', 'He thinks faster than I can...', 'Through!', 'Not like this...', 'Draw more than he does.'),
        villain: cue('A specimen arrives.', 'Synthesis.', 'Unexpected data...', 'Catalogued.', 'Specimen... lost...')},
      after: [q('stage', 'As the Phyrexian contagion corroded Karn\'s body, the praetors whispered psalms to corrupt his mind.'),
        s('venser', 'There is only one thing that can burn this out of him. A spark. Mine.'),
        s('stage', 'Venser puts his hand on Karn\'s chest. The light goes out of him and into Karn. Venser does not get up again.')]},
    {slot: 5, mood: 'tension', kind: 'Lesson', title: 'The Furnace Layer', difficulty: 'Normal', rewardSet: 'nph', teaches: ['Phyrexian mana'],
      blurb: 'Koth leads the last Mirrans down into the furnace layer, the home of Urabrask, the red Praetor. Urabrask is a Phyrexian too, but he cares about the Great Work and nothing else, and he might let them pass if they can survive him.',
      hero: {who: 'koth', deck: {label: 'tribute', name: 'Koth\'s Partisans', colors: 'R', list: `
2 Koth of the Hammer
4 Spikeshot Elder
2 Galvanic Blast
4 Chandra's Phoenix
4 Goblin Fireslinger
2 Shrine of Burning Rage
24 Mountain
4 Vulshok Heartstoker
4 Iron Myr
4 Copper Myr
2 Ferrovore
4 Panic Spellbomb`}},
      villain: {who: 'urabrask', deck: {label: 'tribute', name: 'The Great Work', colors: 'R', list: `
1 Urabrask the Hidden
4 Gut Shot
4 Moltensteel Dragon
4 Invader Parasite
4 Ogre Menial
4 Volt Charge
4 Slagstorm
3 Flameborn Viron
24 Mountain
4 Arc Trail
4 Incinerate`}},
      scene: [q('koth', 'Drive them back! Make their underworld into their grave!'),
        s('koth', 'Phyrexian mana: a symbol with a slash through it can be paid with one coloured mana or with 2 life. Their cards are cheap if they are willing to bleed. Make them bleed.')],
      villainScene: [q('urabrask', 'All will be reforged in the fires of glory.'),
        q('stage', 'Down here, we have a more pointed version of the scriptures.')],
      cues: {hero: cue('Into the furnace.', 'Slag them!', 'The heat...', 'Keep moving.', 'The core takes us...', 'Make them pay in life.'),
        villain: cue('Prove your worth.', 'The furnace roars.', 'Interesting.', 'Into the fires.', 'Go. You amuse me.')},
      after: [s('urabrask', 'Elesh Norn wants this world quiet. I want it working. You may hide in my furnace, Vulshok, as long as you do not get in the way of the Work.')]},
    {slot: 6, mood: 'march', kind: 'Meta', title: 'Tempered Steel', difficulty: 'Normal', rewardSet: 'som', teaches: ['Battle cry'],
      blurb: 'Spring 2011. Tempered Steel gave every artifact creature +2/+2, and white decks full of Memnites and Signal Pests used it to swarm. The other cheap swarm was Kuldotha Red, mono-red goblins and burn.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Tempered Steel', colors: 'W', archetype: 'Aggro', list: `
4 Tempered Steel
4 Memnite
4 Signal Pest
4 Glint Hawk
4 Vault Skirge
4 Porcelain Legionnaire
4 Origin Spellbomb
4 Glint Hawk Idol
4 Accorder Paladin
4 Inkmoth Nexus
20 Plains`}},
      villain: {who: 'kuldotha', deck: {label: 'tribute', name: 'Kuldotha Red', colors: 'R', archetype: 'Aggro', list: `
4 Kuldotha Rebirth
4 Memnite
4 Signal Pest
4 Goblin Fireslinger
4 Spikeshot Elder
4 Galvanic Blast
4 Vulshok Refugee
4 Shrine of Burning Rage
24 Mountain
4 Arc Trail`}},
      scene: [q('stage', 'Death shall prevail as long as our will falls to rust. May necessity anneal our resolve.'),
        s('you', 'Play every zero-drop, then Tempered Steel. Battle cry pumps everyone else when one attacks.')],
      villainScene: [q('kuldotha', 'All goblin rituals serve a dual purpose as fertility rites, even the destructive ones. Especially the destructive ones.')],
      cues: {hero: cue('Steel yourselves.', 'Tempered!', 'They burn the little ones...', 'Annealed.', 'Melted down...', 'Steel, then swing.'),
        villain: cue('[goblins pour out]', '[the ritual roars]', '[out of goblins]', '[burned to slag]', '[the ritual fizzles]')}},
    {slot: 7, mood: 'tension', kind: 'Meta', title: 'Inkmoth', difficulty: 'Normal', rewardSet: 'mbs', teaches: ['Protection from a colour'],
      blurb: 'Spring 2011, the other side. Infect decks with Glistener Elf, Blighted Agent and Inkmoth Nexus tried to land ten poison before the white decks got set up. The white answer was Mirran Crusader, with protection from black and from green.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Infect', colors: 'GU', archetype: 'Aggro', list: `
4 Glistener Elf
4 Blighted Agent
4 Viridian Corrupter
4 Cystbearer
4 Mutagenic Growth
4 Titanic Growth
4 Ichorclaw Myr
4 Phyrexian Hydra
4 Inkmoth Nexus
10 Forest
10 Island
4 Plague Myr`}},
      villain: {who: 'crusaders', deck: {label: 'tribute', name: 'Mirran Crusaders', colors: 'W', archetype: 'Aggro', list: `
2 Mirran Crusader
2 Hero of Bladehold
4 Accorder Paladin
4 Leonin Skyhunter
2 Timely Reinforcements
2 Arrest
2 Kemba's Skyguard
24 Plains
4 Elite Vanguard
2 Glint Hawk
4 Siege Mastodon
4 Griffin Sentinel
4 Peregrine Griffin`}},
      scene: [q('stage', 'Beg me for life, and I will fill you with the glory of Phyrexian perfection.'),
        s('you', 'Ten poison wins. Their Crusader has protection from green, so my green creatures cannot block it. Race it with the blue ones.')],
      villainScene: [q('crusaders', 'A symbol of what Mirrodin once was and hope for what it will be again.')],
      cues: {hero: cue('Spread the word.', 'Ten poison!', 'The Crusader holds...', 'Compleat.', 'Cleansed...', 'Poison, not damage.'),
        villain: cue('[banners raised]', '[the battle cry sounds]', '[the line breaks]', '[cleansed]', '[poisoned]')}},
    {slot: 8, mood: 'boss', kind: 'Boss', title: 'Elesh Norn', difficulty: 'Hard', rewardSet: 'nph', rewardCard: 'Elesh Norn, Grand Cenobite', teaches: ['Combat math'],
      blurb: 'The suns are going out. Elesh Norn, the white Praetor of the Machine Orthodoxy, has won the argument among the Praetors and the war with the Mirrans at once. Koth, Elspeth and Melira make one last attack on her cathedral.',
      hero: {who: 'koth', deck: {label: 'tribute', name: 'Koth, Elspeth and Melira', colors: 'RGW', list: `
1 Koth of the Hammer
1 Elspeth Tirel
2 Melira, Sylvok Outcast
4 Llanowar Elves
4 Viridian Emissary
4 Accorder Paladin
4 Hero of Bladehold
4 Galvanic Blast
4 Arc Trail
4 Melira's Keepers
4 Revoke Existence
4 Copperline Gorge
4 Razorverge Thicket
6 Plains
5 Forest
5 Mountain`}},
      villain: {who: 'norn', deck: {label: 'tribute', name: 'The Machine Orthodoxy', colors: 'W', list: `
2 Elesh Norn, Grand Cenobite
4 Porcelain Legionnaire
4 Priests of Norn
4 Blade Splicer
2 Master Splicer
4 Suture Priest
2 Chancellor of the Annex
2 Arrest
4 Lost Leonin
2 Sunblast Angel
24 Plains
4 Elite Vanguard
2 Peregrine Griffin`}},
      scene: [q('stage', 'The infection has spread farther than we could glimpse from the heights of Taj-Nar.'),
        q('koth', 'As long as we have the will to fight, we are never without weapons.'),
        s('elspeth', 'If she is cut off from her priests, the rest of them falter. Get me to her.'),
        s('melira', 'The oil cannot take me. Let me go first.')],
      villainScene: [q('norn', 'Our glorious infection has taken hold.'),
        q('norn', 'May our blessings sever the tongues of the forsaken.'),
        q('stage', 'With Phyrexia\'s victory at hand, each sect began perfecting its vision.')],
      cues: {hero: cue('For Mirrodin.', 'Break the cathedral!', 'Her priests keep rising...', 'She falls!', 'The suns go out...', 'Kill the anthem first.'),
        villain: {...cue('Kneel and be perfected.', 'Behold the Orthodoxy.', 'Heresy.', 'Compleat.', 'It changes nothing.'),
          half: {who: 'elspeth', line: 'She bleeds. Keep pushing.'}}}},
    {slot: 9, kind: 'Secret Boss', secret: true, title: 'Caw-Blade', difficulty: 'Hard', rewardSet: 'mbs', rewardCard: 'Sword of Feast and Famine', mood: 'boss',
      teaches: ['Equipment'],
      archive: {deck: 'Caw-Blade', when: 'Late 2010 to mid 2011', format: 'Standard: Zendikar block, Scars of Mirrodin block, Magic 2011 and Magic 2012.',
        what: 'A blue-white deck that used Stoneforge Mystic to find Swords of Feast and Famine and Body and Mind, put them on Squadron Hawks, and protected the board with counterspells and Jace, the Mind Sculptor.',
        why: 'Caw-Blade won almost everything in the first half of 2011. At times more than half of the decks in the top eight of a big event were Caw-Blade.',
        beat: 'Kill the creature before the Sword goes on it. Burn their small fliers on sight, and keep a removal spell for the equipped one.',
        after: 'Jace, the Mind Sculptor and Stoneforge Mystic were banned in Standard on 1 July 2011. This tribute uses only this act\'s sets, so Stoneforge, Squadron Hawk and Jace are not in it; the Swords are.'},
      blurb: 'Deep in the archive, the deck that got two cards banned out of Standard at once.',
      hero: {who: 'you', deck: {label: 'tribute', name: 'Red Deck Wins', colors: 'R', archetype: 'Aggro', list: `
4 Goblin Fireslinger
4 Spikeshot Elder
4 Chandra's Phoenix
4 Incinerate
4 Galvanic Blast
4 Arc Trail
4 Shrine of Burning Rage
4 Vulshok Refugee
2 Chandra, the Firebrand
2 Slagstorm
24 Mountain`}},
      villain: {who: 'blade', deck: {label: 'tribute', name: 'Caw-Blade', note: 'Built from the 2011 Caw-Blade lists using cards from this act\'s sets only, so Stoneforge Mystic, Squadron Hawk and Jace, the Mind Sculptor are not in it. No single tournament list is copied.', colors: 'WU', archetype: 'Control', list: `
2 Sword of Feast and Famine
2 Sword of Body and Mind
2 Sword of War and Peace
4 Mirran Crusader
4 Spellskite
4 Mana Leak
2 Timely Reinforcements
4 Phyrexian Metamorph
4 Glint Hawk
2 Hero of Bladehold
4 Seachrome Coast
10 Plains
10 Island
2 Elite Vanguard
2 Accorder Paladin
2 Leonin Skyhunter`}},
      scene: [q('stage', 'Mirrodin has little weather, but it certainly has lightning.'),
        s('you', 'Every Sword needs a body. Kill the bodies.')],
      villainScene: [q('stage', 'The fatal flaw in every plan is the assumption that you know more than your enemy.')],
      cues: {hero: cue('Burn the birds.', 'Bolt it!', 'The Sword is on...', 'Disarmed.', 'Out-equipped...', 'Kill the carrier.'),
        villain: cue('[a Sword is equipped]', '[protection from red]', '[out of bodies]', '[feast and famine]', '[burned out]')},
      after: [s('stage', 'Recorded: Jace and Stoneforge banned in Standard, 1 July 2011.')]},
  ],
};
