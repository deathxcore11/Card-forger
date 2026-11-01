// Deck Forge rules table v1 (spec: deck-builder-spec.md, section 3).
// Plain data, read by deck-forge.js. Every rule names cards that MUST match
// and cards that must NOT match; test-deck-forge.mjs runs both lists against
// real Scryfall oracle text, so a lazy keyword rule fails its own test.
//
// Text is matched one ability (line) at a time, lower-cased, with the card's
// own name (and "this creature/artifact/…") replaced by "~". Activated
// abilities are split into cost and effect so "Sacrifice this artifact: …"
// (fodder that sacrifices itself) is never read as an outlet for others.
//
// Fields: id, tag, tier (A efficient/repeatable, B fine, C situational or
// one-shot; "mv" = by mana value: <=2 A, 3 B, 4+ C), on ("permanent" |
// "spell" | "any"), text (regex on a whole ability), cost/effect (regexes on
// an activated ability), not (regex that vetoes the ability), type / notType
// (regex on the type line), whole (regex on the whole card text).
export const DECK_TAGS = Object.freeze({
 version: 'deck-tags.v1',
 date: '2026-11-01',
 rules: [
  // RAMP (permanent): counts toward the ramp target.
  { id: 'ramp-mana-ability', tag: 'ramp', tier: 'mv', on: 'permanent', notType: '\\bland\\b', cost: '\\{t\\}', effect: '^add\\b|^add one mana|^add \\{', costNot: 'sacrifice (?:~|this)',
    mustMatch: ['Sol Ring', 'Arcane Signet', 'Mind Stone', 'Llanowar Elves', 'Talisman of Hierarchy', 'Orzhov Signet', 'Birds of Paradise', 'Ornithopter of Paradise', 'Thought Vessel', 'Fellwar Stone'],
    mustNotMatch: ['Lotus Petal', 'Ancient Den', 'Command Tower', 'Nesting Grounds', 'Dark Ritual'] },
  { id: 'ramp-land-search', tag: 'ramp', tier: 'mv', on: 'any', notType: '\\bland\\b', text: 'search your library for (?:a|an|up to (?:one|two|three|x)|two|three)? ?(?:basic )?(?:land|plains|island|swamp|mountain|forest)[^\\n]*?(?:onto|put (?:it|one|them|that card|those cards)[^.]*onto) the battlefield', costNot: 'sacrifice (?:~|this)',
    mustMatch: ['Rampant Growth', 'Cultivate', "Kodama's Reach", 'Wood Elves', 'Solemn Simulacrum', 'Explosive Vegetation', 'Three Visits', 'Knight of the White Orchid'],
    mustNotMatch: ['Evolving Wilds', "Wayfarer's Bauble", 'Demonic Tutor'] },
  { id: 'ramp-extra-land', tag: 'ramp', tier: 'B', on: 'permanent', text: 'play an additional land|play (?:two|three) additional lands',
    mustMatch: [], mustNotMatch: ['Rampant Growth'] },
  { id: 'ramp-repeat-treasure', tag: 'ramp', tier: 'B', on: 'permanent', text: '^(?:whenever|at the beginning)[^\\n]*create[^\\n]*treasure',
    mustMatch: ['Pitiless Plunderer', 'Smothering Tithe'], mustNotMatch: ['Deadly Dispute'] },
  { id: 'ramp-lotus', tag: 'ramp', tier: 'A', on: 'permanent', text: 'add (?:three|x) mana of any one color', costNot: 'sacrifice (?:~|this)',
    mustMatch: [], mustNotMatch: ['Lotus Petal'] },
  // A reducer is ramp only when the deck has enough of what it reduces (the Starfield Mystic case).
  { id: 'reducer', tag: 'reducer', tier: 'B', on: 'permanent', text: '(artifact|creature|enchantment|instant|sorcery|noncreature|legendary|[a-z]+) spells you cast cost \\{?\\d?\\}? ?less',
    mustMatch: ['Starfield Mystic'], mustNotMatch: ['Sol Ring'] },
  // BURST: one-shot mana. Never counts toward the ramp target.
  { id: 'burst-ritual', tag: 'burst', tier: 'C', on: 'spell', text: '\\badd \\{|\\badd (?:one|two|three) mana',
    mustMatch: ['Dark Ritual', 'Cabal Ritual'], mustNotMatch: ['Rampant Growth'] },
  { id: 'burst-sac-mana', tag: 'burst', tier: 'C', on: 'permanent', cost: 'sacrifice (?:~|this)', effect: '^add\\b',
    mustMatch: ['Lotus Petal'], mustNotMatch: ['Sol Ring'] },
  { id: 'burst-treasure-once', tag: 'burst', tier: 'C', on: 'spell', text: 'create (?:a|one|two|three|x) treasure',
    mustMatch: ['Deadly Dispute'], mustNotMatch: ['Pitiless Plunderer'] },

  // CARD ADVANTAGE (repeatable A, 2-for-1 B). A lone cantrip spell is not advantage.
  { id: 'draw-repeat', tag: 'draw', tier: 'A', on: 'permanent', text: '^(?:whenever|at the beginning)[^\\n]*\\bdraws? (?:a|an additional|one|two|three|x|that many|\\w+) cards?',
    mustMatch: ['Skullclamp', 'Phyrexian Arena', 'Rhystic Study', 'Esper Sentinel', 'Breena, the Demagogue', 'Braids, Arisen Nightmare', 'Archmage Emeritus', 'Mentor of the Meek', 'Coastal Piracy', 'Edric, Spymaster of Trest'],
    mustNotMatch: ['Opt', 'Divination', 'Sol Ring'] },
  { id: 'draw-activated', tag: 'draw', tier: 'B', on: 'permanent', cost: '\\{', effect: '\\bdraws? (?:a|one|two|\\w+) cards?', costNot: 'sacrifice (?:~|this)',
    mustMatch: [], mustNotMatch: ['Mind Stone'] },
  { id: 'draw-enter-or-leave', tag: 'draw', tier: 'B', on: 'permanent', text: '^when(?:ever)? ~ (?:enters|dies|is put into a graveyard)[^\\n]*\\bdraws? (?:a|one|two|three|x|that many|\\w+) cards?',
    mustMatch: ['Ichor Wellspring', 'Mephitic Draught', 'Mulldrifter', 'Disciple of Bolas', 'God-Eternal Bontu'], mustNotMatch: ['Opt'] },
  { id: 'draw-spell-multi', tag: 'draw', tier: 'B', on: 'spell', text: '\\bdraws? (?:two|three|four|x|that many|cards equal) cards?', not: 'then put (?:two|\\w+) cards? from your hand',
    mustMatch: ['Divination', 'Deadly Dispute', 'Village Rites', 'Fanatical Offering', 'Esper Charm'], mustNotMatch: ['Opt', 'Brainstorm'] },
  { id: 'draw-investigate', tag: 'draw', tier: 'B', on: 'any', text: '\\binvestigate\\b|create (?:a|two|\\w+) clue',
    mustMatch: ['Tireless Tracker'], mustNotMatch: [] },
  { id: 'draw-impulse', tag: 'draw', tier: 'B', on: 'any', text: 'exile the top (?:card|\\w+ cards) of your library[^\\n]*you may (?:play|cast)',
    mustMatch: [], mustNotMatch: [] },
  { id: 'cantrip', tag: 'cantrip', tier: 'C', on: 'spell', text: '\\bdraws? (?:a|one) card', not: '\\bdraws? (?:two|three|x)',
    mustMatch: ['Opt'], mustNotMatch: ['Divination'] },

  // INTERACTION
  { id: 'removal-target', tag: 'removal', tier: 'mv', on: 'any', text: '(?:destroy|exile) (?:another |up to (?:one|two|x) )?target (?:[a-z, -]*?)(?:creature|artifact|enchantment|planeswalker|permanent|nonland)', not: 'target [^.]*you control|from (?:a|your|target player.s) graveyard|then return|\\. return (?:it|that card)',
    mustMatch: ['Swords to Plowshares', 'Path to Exile', 'Generous Gift', 'Anguished Unmaking', 'Mortify'], mustNotMatch: ['Airbender Ascension', 'Restoration Angel', 'Personify', 'Flickerwisp', 'The Ooze'] },
  { id: 'removal-damage', tag: 'removal', tier: 'mv', on: 'any', text: 'deals? (?:\\d+|x) damage to (?:any target|target creature|target (?:attacking|blocking) creature|target player or planeswalker)',
    mustMatch: ['Lightning Bolt'], mustNotMatch: ['Blood Artist'] },
  { id: 'removal-edict', tag: 'removal', tier: 'B', on: 'any', text: 'target (?:player|opponent) sacrifices', mustMatch: [], mustNotMatch: ['Grave Pact'] },
  { id: 'removal-transform', tag: 'removal', tier: 'B', on: 'any', text: 'target creature (?:an opponent controls )?(?:becomes|loses all abilities)', mustMatch: [], mustNotMatch: [] },
  { id: 'counterspell', tag: 'removal', tier: 'A', on: 'spell', text: '^counter target (?:spell|creature spell|noncreature spell)',
    mustMatch: ['Counterspell', 'Pact of Negation'], mustNotMatch: [] },
  { id: 'wipe', tag: 'wipe', tier: 'mv', on: 'any', text: '(?:destroy|exile) all (?:other )?(?:creatures|nonland permanents|permanents|artifacts|enchantments)|all creatures get -|deals? (?:\\d+|x) damage to each creature|each creature gets -|destroy each (?:creature|nonland)',
    mustMatch: ['Wrath of God', 'Damnation', 'Toxic Deluge', 'Blasphemous Act'], mustNotMatch: ['Grave Pact', 'Swords to Plowshares'] },
  { id: 'protection', tag: 'protection', tier: 'mv', on: 'any', text: '(?:creatures|permanents|other creatures) you control (?:gain|have|get)[^\\n]*(?:hexproof|indestructible|protection from|shroud)|(?:equipped|enchanted) creature (?:has|gets|gains)[^\\n]*(?:hexproof|shroud|ward|protection from|indestructible)|target (?:creature|permanent|legendary creature)s? you control (?:gains?|phases? out)[^\\n]*?(?:hexproof|indestructible|protection|shroud|phases? out)|you (?:gain|have) protection from everything|permanents you control phase out|commander creatures you own[^\\n]*(?:ward|hexproof|indestructible)',
    mustMatch: ['Lightning Greaves', 'Swiftfoot Boots', "Teferi's Protection", 'Mother of Runes', 'Selfless Spirit', 'Brotherhood Regalia', 'Cultist of the Absolute', 'Heroic Intervention'], mustNotMatch: ['Swords to Plowshares', 'Sol Ring'] },
  { id: 'protection-counter', tag: 'protection', tier: 'B', on: 'spell', text: '^counter target (?:spell|noncreature spell)', mustMatch: ['Pact of Negation'], mustNotMatch: [] },

  // WIN CONDITIONS: cards that close the game.
  { id: 'wincon-drain', tag: 'wincon', tier: 'A', on: 'permanent', text: '^whenever[^\\n]*(?:each opponent loses (?:\\d+|x|that much) life|target (?:player|opponent) loses (?:\\d+|x) life|each opponent loses \\d)',
    mustMatch: ['Blood Artist', 'Zulaport Cutthroat', 'Bastion of Remembrance'], mustNotMatch: ['Phyrexian Arena'] },
  { id: 'wincon-pact', tag: 'wincon', tier: 'A', on: 'permanent', text: '^whenever (?:a|another) creature you control dies, each (?:other player|opponent) sacrifices',
    mustMatch: ['Grave Pact', 'Dictate of Erebos'], mustNotMatch: [] },
  { id: 'wincon-overrun', tag: 'wincon', tier: 'B', on: 'any', text: 'creatures you control get \\+(?:\\d+|x)/\\+(?:\\d+|x) and gain trample|creatures you control gain trample and get \\+x/\\+x|gets \\+1/\\+1 for each other creature|creatures you control get \\+\\d+/\\+\\d+ for each|you win the game|additional combat phase|double (?:the )?(?:power|damage)|deals damage equal to [^\\n]*to each opponent',
    mustMatch: ['Craterhoof Behemoth', 'Coat of Arms'], mustNotMatch: ['Sol Ring'] },
  { id: 'wincon-pay', tag: 'wincon', tier: 'B', on: 'permanent', text: 'target player loses (?:\\d+|x) life|you win the game', mustMatch: [], mustNotMatch: [] },

  // RECURSION. Returning to the battlefield re-triggers enters.
  { id: 'recursion-battlefield', tag: 'reenter', tier: 'mv', on: 'any', text: 'return [^\\n]*?(?:card|cards|it|that card)[^\\n]*?from (?:your|a) graveyard to the battlefield|(?:dies|is put into a graveyard)[^\\n]*?return (?:it|that card) to the battlefield|return the chosen cards? to the battlefield',
    mustMatch: ['Sun Titan', 'Victimize', 'Angel of Indemnity', 'Ruthless Technomancer', 'Gift of Immortality', 'Feign Death', 'Undying Malice', 'Come Back Wrong', 'Body Launderer'], mustNotMatch: ['Swords to Plowshares', 'Restoration Angel'] },
  { id: 'recursion-hand', tag: 'recursion', tier: 'B', on: 'any', text: 'return [^\\n]*card[^\\n]*from your graveyard to your hand', mustMatch: [], mustNotMatch: [] },

  // THEME TAGS (they only score when a commander's hooks ask for them).
  { id: 'sac-outlet-free', tag: 'sac-outlet', tier: 'A', on: 'permanent', cost: '^(?:pay \\d+ life, )?sacrifice (?:a|an|another|one|x)? ?(?:other )?(?:nontoken )?(?:creature|artifact|permanent|creature or artifact|artifact or creature)s?$', costNot: '\\{',
    mustMatch: ["Ashnod's Altar", 'Carrion Feeder', 'Yahenni, Undying Partisan', 'Woe Strider', 'Yawgmoth, Thran Physician', 'Viscera Seer', 'Goblin Bombardment'],
    mustNotMatch: ['Lotus Petal', 'Ichor Wellspring', 'Mind Stone', 'Selfless Spirit'] },
  { id: 'sac-outlet-paid', tag: 'sac-outlet', tier: 'B', on: 'permanent', cost: '\\{[^}]*\\}[^:]*sacrifice (?:a|an|another|x)? ?(?:other )?(?:creature|artifact|permanent)s?\\b', costNot: 'sacrifice (?:~|this)',
    mustMatch: ['Ruthless Technomancer'], mustNotMatch: ['Mind Stone', "Wayfarer's Bauble"] },
  { id: 'sac-outlet-trigger', tag: 'sac-outlet', tier: 'C', on: 'any', text: '(?:you may sacrifice|sacrifice) (?:another|an?|any number of other) (?:other )?(?:creature|artifact|artifact or creature|creature or artifact|permanent|nonland permanent)s?|as an additional cost to cast this spell, sacrifice (?:a|an) (?:creature|artifact)',
    not: 'each (?:other )?(?:player|opponent) sacrifices|target (?:player|opponent) sacrifices|sacrifice (?:it|them) at|sacrifice ~',
    mustMatch: ['Hei Bai, Spirit of Balance', 'Village Rites', 'Deadly Dispute', 'Fanatical Offering', 'Braids, Arisen Nightmare', 'Disciple of Bolas', 'God-Eternal Bontu'], mustNotMatch: ['Grave Pact', 'Come Back Wrong'] },

  { id: 'fodder-creature-token', tag: 'fodder-creature', tier: 'B', on: 'any', text: 'create (?:a|an|one|two|three|four|x|that many|\\w+) [^\\n]*?creature tokens?|creatures? tokens? (?:that are|with)',
    not: 'opponent creates|its controller creates|that player creates',
    mustMatch: ['Woe Strider', 'Elenda, the Dusk Rose', 'Bitterblossom', 'Krenko, Mob Boss', 'Young Pyromancer', 'Avenger of Zendikar', 'Personify'], mustNotMatch: ['Sol Ring'] },
  { id: 'fodder-artifact-token', tag: 'fodder-artifact', tier: 'B', on: 'any', text: 'create (?:a|an|one|two|three|x|that many|\\w+) [^\\n]*?(?:treasure|clue|food|blood|map|powerstone|gold|mutagen|incubator|thopter|servo|artifact) tokens?|create (?:a|one|\\w+) (?:treasure|clue|food|map|blood)\\b',
    mustMatch: ['Pitiless Plunderer', 'Deadly Dispute', "Scavenger's Talent", 'Fanatical Offering', 'Smothering Tithe', 'The Ooze', 'Ruthless Technomancer'], mustNotMatch: ['Sol Ring'] },
  { id: 'fodder-dies-value', tag: 'fodder-value', tier: 'A', on: 'permanent', text: '^when(?:ever)? ~ (?:enters or )?(?:dies|is put into a graveyard)|^when ~ leaves the battlefield',
    mustMatch: ['Ichor Wellspring', 'Mephitic Draught', 'Hangarback Walker', 'Elenda, the Dusk Rose', 'Body Launderer', 'God-Eternal Bontu', 'Kokusho, the Evening Star'], mustNotMatch: ['Blood Artist', 'Sol Ring'] },
  { id: 'fodder-undying', tag: 'fodder-value', tier: 'A', on: 'permanent', text: '^(?:undying|persist)\\b', mustMatch: [], mustNotMatch: [] },
  { id: 'fodder-sac-self', tag: 'fodder-value', tier: 'B', on: 'permanent', cost: 'sacrifice (?:~|this)', effect: '\\bdraw|search your library|creatures you control gain|add',
    mustMatch: ['Mind Stone', "Wayfarer's Bauble", 'Selfless Spirit', 'Lotus Petal'], mustNotMatch: [] },

  { id: 'death-payoff', tag: 'death-payoff', tier: 'A', on: 'permanent', text: '^whenever (?:~ or )?(?:a|an|another|one or more)(?: other)? (?:nontoken )?(?:creatures?|permanents?|artifacts?)(?: (?:you control|an opponent controls))?(?: or (?:another|a) creature(?: you control)?)? (?:dies|die|is put into a graveyard|are put into a graveyard)|^whenever ~ or another creature(?: you control)? dies|^whenever you sacrifice|^whenever equipped creature dies',
    mustMatch: ['Blood Artist', 'Zulaport Cutthroat', 'Pitiless Plunderer', 'Grave Pact', 'Dictate of Erebos', 'Cordial Vampire', 'Elenda, the Dusk Rose', 'Skullclamp', "Scavenger's Talent", 'Body Launderer', 'Bastion of Remembrance', 'Yahenni, Undying Partisan', ],
    mustNotMatch: ['Hangarback Walker', 'Ichor Wellspring', 'Sol Ring'] },

  { id: 'flicker', tag: 'flicker', tier: 'mv', on: 'any', text: 'exile (?:another |up to (?:one|two) )?(?:other )?target [^\\n]*?(?:, then|\\. ?|then) return (?:it|that card|them|those cards|the exiled card) to the battlefield|exile (?:any number of )?[^\\n]*?you control[^\\n]*?return (?:it|them|that card|those cards) to the battlefield|\\bblinks?\\b|\\bflicker',
    mustMatch: ['Restoration Angel', 'Flickerwisp', 'Airbender Ascension', 'Personify', 'Ephemerate', 'Soulherder', "Conjurer's Closet"], mustNotMatch: ['Swords to Plowshares', 'Path to Exile'] },
  { id: 'enter-doubler', tag: 'enter-doubler', tier: 'A', on: 'any', text: 'triggers? an additional time|enters? as a copy of|creates? (?:a|two) tokens? that (?:are|is) (?:a )?cop(?:y|ies) of|token that.s a copy of (?:target|a) (?:creature|permanent) you control|becomes? a copy of',
    mustMatch: ['Panharmonicon', 'Saw in Half', 'Teysa Karlov', 'Spark Double'], mustNotMatch: ['Sol Ring'] },
  { id: 'enter-value', tag: 'enter-value', tier: 'B', on: 'permanent', text: '^when(?:ever)? ~ enters\\b',
    mustMatch: ['Angel of Indemnity', 'Solemn Simulacrum', 'Wood Elves', 'Ruthless Technomancer', 'Woe Strider', 'Mulldrifter', 'Disciple of Bolas', 'Ichor Wellspring'], mustNotMatch: ['Blood Artist'] },

  { id: 'attack-helper', tag: 'attack-helper', tier: 'mv', on: 'any', text: '(?:equipped|enchanted) creature (?:has|gets|gains)[^\\n]*(?:flying|menace|trample|haste|can.t be blocked|shadow|fear|intimidate)|creatures you control (?:have|gain|get)[^\\n]*(?:flying|menace|trample|can.t be blocked)|commander creatures you own[^\\n]*(?:flying|menace|trample|can.t be blocked)|remove target attacking creature you control from combat|target creature (?:you control )?(?:gains|gets)[^\\n]*(?:can.t be blocked|flying|menace|trample)|equipped creature can.t be blocked',
    mustMatch: ['Brotherhood Regalia', 'Cultist of the Absolute', 'Reconnaissance', 'Lightning Greaves', 'Swiftfoot Boots', 'Rancor'], mustNotMatch: ['Sol Ring', 'Carrion Feeder'] },
  { id: 'attack-payoff', tag: 'attack-payoff', tier: 'B', on: 'permanent', text: '^whenever (?:~|a creature(?: you control)?|one or more creatures you control|you attack|a player attacks|equipped creature) (?:enters or |and at least [^\\n]* )?(?:attacks?|deals combat damage)|^whenever (?:a player|you) attacks?|^whenever one or more creatures(?: you control)? attack',
    mustMatch: ['Breena, the Demagogue', 'Sun Titan', 'Edric, Spymaster of Trest', 'Coastal Piracy', 'Sword of Fire and Ice', 'Duelist\'s Heritage'], mustNotMatch: ['Sol Ring'] },

  { id: 'counters', tag: 'counters', tier: 'B', on: 'any', text: 'put (?:a|an|one|two|three|x|that many|those|its|\\w+) \\+1/\\+1 counters? on|\\bproliferate\\b|with (?:a|an additional|two|\\w+) \\+1/\\+1 counters?|twice that many|double the number of [^\\n]*counters|put (?:its|those|that creature.s) counters on|\\+1/\\+1 counters? (?:is|are) put|with a \\+1/\\+1 counter on it|\\+1/\\+1 counters? would be put',
    mustMatch: ['Hardened Scales', 'Doubling Season', "Cathars' Crusade", "Ajani's Pridemate", 'The Ooze', 'Reluctant Role Model', 'Carrion Feeder', 'Cordial Vampire', 'Elenda, the Dusk Rose', 'Breena, the Demagogue'], mustNotMatch: ['Airbender Ascension', 'Sol Ring'] },
  { id: 'counters-move', tag: 'counter-mover', tier: 'A', on: 'any', text: 'move (?:a|any number of|all|one or more) (?:\\+1/\\+1 )?counters?|put (?:its|those|that creature.s) counters on',
    mustMatch: ['Nesting Grounds', 'Reluctant Role Model', 'Hei Bai, Spirit of Balance'], mustNotMatch: ['Hardened Scales'] },

  { id: 'lifegain', tag: 'lifegain', tier: 'B', on: 'any', text: 'you gain (?:\\d+|x|that much) life|gain (?:\\d+|x) life|\\blifelink\\b', mustMatch: ['Elenda, the Dusk Rose', 'Disciple of Bolas'], mustNotMatch: ['Sol Ring'] },
  { id: 'lifegain-payoff', tag: 'lifegain-payoff', tier: 'A', on: 'permanent', text: '^whenever you gain life', mustMatch: ["Ajani's Pridemate"], mustNotMatch: ['Sol Ring'] },
  { id: 'token-payoff', tag: 'token-payoff', tier: 'A', on: 'permanent', text: '^whenever (?:a|one or more) [^\\n]*tokens? (?:you control )?(?:enters?|are created)|^whenever you create|^if (?:one or more )?tokens? would be created|^if an effect would create one or more tokens',
    mustMatch: ['Doubling Season'], mustNotMatch: ['Sol Ring'] },
  { id: 'creature-enters-payoff', tag: 'enters-payoff', tier: 'A', on: 'permanent', text: '^whenever (?:a|another|one or more) (?:other )?(?:nontoken )?creatures?[^,]*? enters?\\b',
    mustMatch: ["Cathars' Crusade", 'Airbender Ascension', 'Mentor of the Meek'], mustNotMatch: ['Sol Ring'] },
  { id: 'spell-payoff', tag: 'spell-payoff', tier: 'A', on: 'permanent', text: '^whenever you cast (?:or copy )?(?:an? )?(?:instant|sorcery|noncreature|instant or sorcery)',
    mustMatch: ['Talrand, Sky Summoner', 'Young Pyromancer', 'Guttersnipe', 'Archmage Emeritus'], mustNotMatch: ['Sol Ring'] },
  { id: 'landfall', tag: 'landfall', tier: 'A', on: 'permanent', text: '^landfall|^whenever a land (?:you control )?enters', mustMatch: ['Avenger of Zendikar', 'Lotus Cobra'], mustNotMatch: ['Sol Ring'] },
  { id: 'self-mill', tag: 'self-mill', tier: 'B', on: 'any', text: '\\bmill (?:\\w+) cards?|\\bsurveil\\b|put the top [^\\n]* cards? of your library into your graveyard', not: 'target (?:player|opponent) mills', mustMatch: [], mustNotMatch: [] },
  { id: 'tutor', tag: 'tutor', tier: 'A', on: 'any', text: 'search your library for (?:a|an|any) (?:card|creature card|artifact card|enchantment card|instant card|sorcery card|legendary)', mustMatch: ['Demonic Tutor'], mustNotMatch: ['Rampant Growth'] },
 ],
});

// Format targets (spec section 5 plus Randall's video notes, 1 Nov). Soft
// targets, never hardcoded in the builder.
// - Card advantage is a floor: "12 pieces of card advantage, if not more".
// - Interaction: about 10 dedicated pieces (removal, interruption such as
//   counterspells, protection) plus 2 to 4 board wipes.
// - Lands: 38 in every Commander deck; 3+ colours lean on colour fixing.
// - Cuts: keep only 3 or 4 big cards (5+ mana); synergy first, mana value second.
export const DECK_TARGETS = Object.freeze({
 version: 'deck-targets.v1',
 commander: { lands: 38, ramp: 10, draw: 12, removal: 6, interaction: 10, wipe: { min: 2, target: 3, max: 4 }, protection: 2, wincon: 3, bigCards: 4, bigFrom: 5, avgMv: 3.0 },
 constructed: { ramp: 4, draw: 6, removal: 6, interaction: 8, wipe: { min: 0, target: 2, max: 3 }, protection: 0, wincon: 0, bigCards: 6, bigFrom: 5, avgMv: 2.6 },
 // Theme group minimums for a 100-card deck; 60-card decks use 60% of these.
 hooks: { fodder: 10, 'sac-outlets': 4, 'death-payoffs': 5, reenter: 3, 'attack-helpers': 3, attackers: 2, 'ways-to-leave': 2, counters: 3, 'enter-value': 4, spells: 20, lifegain: 8, landfall: 8, tokens: 8, 'self-mill': 6, discard: 4, enters: 10, protection: 3, 'sac-value': 0, recipients: 0, 'draw-trigger': 4, 'token-payoffs': 3 },
});
