// Exact excerpts from the existing bundled rulebook. Regenerate with scripts/build-keyword-references.mjs.
export const KEYWORD_SOURCE = {"sha256":"e7eddeeb3dd0a39e40342e3f83cc39b79833b9376a510b494b0baa3663236aa3","title":"Comprehensive Rules","date":"2026-09-25","url":"https://media.wizards.com/2026/downloads/MagicCompRules%2020260925.pdf","legacy":false,"pages":312};
export const KEYWORD_REFERENCE = {
  "activate": {
    "label": "Activate",
    "definition": "To activate an activated ability is to put it onto the stack and pay its costs, so that it will eventually resolve and have its effect. Only an object’s controller (or its owner, if it doesn’t have a controller) can activate its activated ability unless the object specifically says otherwise. A player may activate an ability if they have priority. See rule 602, “Activating Activated Abilities.”",
    "entryId": "701.2"
  },
  "attach": {
    "label": "Attach",
    "definition": "To attach an Aura, Equipment, or Fortification to an object or player means to take it from where it currently is and put it onto that object or player. If something is attached to a permanent on the battlefield, it’s customary to place it so that it’s physically touching the permanent. An Aura, Equipment, or Fortification can’t be attached to an object or player it couldn’t enchant, equip, or fortify, respectively. If an effect tries to attach an Aura, Equipment, or Fortification to an object or player it can’t be attached to, the Aura, Equipment, or Fortification doesn’t move. If an effect tries to attach an Aura, Equipment, or Fortification to the object or player it’s already attached to, the effect does nothing. If an effect tries to attach an object that isn’t an Aura, Equipment, or Fortification to another object or player, the effect does nothing and the first object doesn’t move.",
    "entryId": "701.3"
  },
  "behold": {
    "label": "Behold",
    "definition": "“Behold a [quality]” means “Reveal a [quality] card from your hand or choose a [quality] permanent you control on the battlefield.” The phrase “if a [quality] was beheld” refers to whether or not the object had that quality at the time the player took that action, regardless of whether or not the revealed card or chosen permanent still has that quality as the spell or ability including that phrase resolves.",
    "entryId": "701.4"
  },
  "cast": {
    "label": "Cast",
    "definition": "To cast a spell is to take it from the zone it’s in (usually the hand), put it on the stack, and pay its costs, so that it will eventually resolve and have its effect. A player may cast a spell if they have priority. See rule 601, “Casting Spells.” To cast a card is to cast it as a spell.",
    "entryId": "701.5"
  },
  "counter": {
    "label": "Counter",
    "definition": "To counter a spell or ability means to cancel it, removing it from the stack. It doesn’t resolve and none of its effects occur. A countered spell is put into its owner’s graveyard. The player who cast a countered spell or activated a countered ability doesn’t get a “refund” of any costs that were paid.",
    "entryId": "701.6"
  },
  "create": {
    "label": "Create",
    "definition": "To create one or more tokens with certain characteristics, put the specified number of tokens with the specified characteristics onto the battlefield. If a replacement effect applies to a token being created, that effect applies before considering any continuous effects that will modify the characteristics of that token. If a replacement effect applies to a token entering the battlefield, that effect applies after considering any continuous effects that will modify the characteristics of that token.",
    "entryId": "701.7"
  },
  "destroy": {
    "label": "Destroy",
    "definition": "To destroy a permanent, move it from the battlefield to its owner’s graveyard. The only ways a permanent can be destroyed are as a result of an effect that uses the word “destroy” or as a result of the state-based actions that check for lethal damage (see rule 704.5g) or damage from a source with deathtouch (see rule 704.5h). If a permanent is put into its owner’s graveyard for any other reason, it hasn’t been “destroyed.”",
    "entryId": "701.8"
  },
  "discard": {
    "label": "Discard",
    "definition": "To discard a card, move it from its owner’s hand to that player’s graveyard. By default, effects that cause a player to discard a card allow the affected player to choose which card to discard. Some effects, however, require a random discard or allow another player to choose which card is discarded.",
    "entryId": "701.9"
  },
  "double": {
    "label": "Double",
    "definition": "Doubling a creature’s power and/or toughness creates a continuous effect. This effect modifies that creature’s power and/or toughness but doesn’t set those characteristics to a specific value. See rule 613.4c. To double a creature’s power, that creature gets +X/+0, where X is that creature’s power as the spell or ability that doubles its power resolves. Similarly, an effect that doubles a creature’s toughness gives it +0/+X, where X is that creature’s toughness. Doubling a creature’s power and toughness gives it +X/+Y, where X is its power and Y is its toughness.",
    "entryId": "701.10"
  },
  "triple": {
    "label": "Triple",
    "definition": "Tripling a creature’s power and/or toughness creates a continuous effect. This effect modifies that creature’s power and/or toughness but doesn’t set those characteristics to a specific value. See rule 613.4c. To triple a creature’s power, that creature gets +X/+0, where X is twice that creature’s power as the spell or ability that triples its power resolves. Similarly, an effect that triples a creature’s toughness gives it +0/+X, where X is twice that creature’s toughness. Tripling a creature’s power and toughness gives it +X/+Y, where X is twice its power and Y is twice its toughness.",
    "entryId": "701.11"
  },
  "exchange": {
    "label": "Exchange",
    "definition": "A spell or ability may instruct players to exchange something (for example, life totals or control of two permanents) as part of its resolution. When such a spell or ability resolves, if the entire exchange can’t be completed, no part of the exchange occurs. Example: If a spell attempts to exchange control of two target creatures but one of those creatures is destroyed before the spell resolves, the spell does nothing to the other creature. When control of two permanents is exchanged, if those permanents are controlled by different players, each of those players simultaneously gains control of the permanent that was controlled by the other player. If, on the other hand, those permanents are controlled by the same player, the exchange effect does nothing.",
    "entryId": "701.12"
  },
  "exile": {
    "label": "Exile",
    "definition": "To exile an object, move it to the exile zone from wherever it is. See rule 406, “Exile.”",
    "entryId": "701.13"
  },
  "fight": {
    "label": "Fight",
    "definition": "A spell or ability may instruct a creature to fight another creature or it may instruct two creatures to fight each other. Each of those creatures deals damage equal to its power to the other creature. If one or both creatures instructed to fight are no longer on the battlefield or are no longer creatures, neither of them fights or deals damage. If one or both creatures are illegal targets for a resolving spell or ability that instructs them to fight, neither of them fights or deals damage.",
    "entryId": "701.14"
  },
  "goad": {
    "label": "Goad",
    "definition": "Certain spells and abilities can goad a creature. Until the next turn of the controller of that spell or ability, that creature is goaded. Goaded is a designation a permanent can have. A goaded creature attacks each combat if able and attacks a player other than the controller of the permanent, spell, or ability that caused it to be goaded if able. Goaded is neither an ability nor part of the permanent’s copiable values.",
    "entryId": "701.15"
  },
  "investigate": {
    "label": "Investigate",
    "definition": "“Investigate” means “Create a Clue token.” See rule 111.10f.",
    "entryId": "701.16"
  },
  "mill": {
    "label": "Mill",
    "definition": "For a player to mill a number of cards, that player puts that many cards from the top of their library into their graveyard. A player can’t mill a number of cards greater than the number of cards in their library. If given the choice to do so, they can’t choose to take that action. If instructed to do so, they mill as many as possible. Similarly, the player can’t pay a cost that includes milling a number of cards greater than the number of cards in their library.",
    "entryId": "701.17"
  },
  "play": {
    "label": "Play",
    "definition": "To play a land means to put it onto the battlefield from the zone it’s in (usually the hand). A player may play a land if they have priority, it’s the main phase of their turn, the stack is empty, and they haven’t played a land this turn. Playing a land is a special action (see rule 116), so it doesn’t use the stack; it simply happens. Putting a land onto the battlefield as the result of a spell or ability isn’t the same as playing a land. See rule 305, “Lands.” To play a card means to play that card as a land or to cast that card as a spell, whichever is appropriate.",
    "entryId": "701.18"
  },
  "regenerate": {
    "label": "Regenerate",
    "definition": "If the effect of a resolving spell or ability regenerates a permanent, it creates a replacement effect that protects the permanent the next time it would be destroyed this turn. In this case, “Regenerate [permanent]” means “The next time [permanent] would be destroyed this turn, instead remove all damage marked on it and its controller taps it. If it’s an attacking or blocking creature, remove it from combat.” If the effect of a static ability regenerates a permanent, it replaces destruction with an alternate effect each time that permanent would be destroyed. In this case, “Regenerate [permanent]” means “Instead remove all damage marked on [permanent] and its controller taps it. If it’s an attacking or blocking creature, remove it from combat.”",
    "entryId": "701.19"
  },
  "reveal": {
    "label": "Reveal",
    "definition": "To reveal a card, show that card to all players for a brief time. If an effect causes a card to be revealed, it remains revealed for as long as necessary to complete the parts of the effect that card is relevant to. If the cost to cast a spell or activate an ability includes revealing a card, or if a card is revealed because an ability is activated from a hidden zone (see rule 602.2a), the card remains revealed from the time the spell or ability is announced until the time it leaves the stack. If revealing a card causes a triggered ability to trigger, the card remains revealed until that triggered ability leaves the stack. If that ability isn’t put onto the stack the next time a player would receive priority, the card ceases to be revealed. Revealing a card doesn’t cause it to leave the zone it’s in.",
    "entryId": "701.20"
  },
  "sacrifice": {
    "label": "Sacrifice",
    "definition": "To sacrifice a permanent, its controller moves it from the battlefield directly to its owner’s graveyard. A player can’t sacrifice something that isn’t a permanent, or something that’s a permanent they don’t control. Sacrificing a permanent doesn’t destroy it, so regeneration or other effects that replace destruction can’t affect this action.",
    "entryId": "701.21"
  },
  "scry": {
    "label": "Scry",
    "definition": "To “scry N” means to look at the top N cards of your library, then put any number of them on the bottom of your library in any order and the rest on top of your library in any order. If a player is instructed to scry 0, no scry event occurs. Abilities that trigger whenever a player scries won’t trigger.",
    "entryId": "701.22"
  },
  "shuffle": {
    "label": "Shuffle",
    "definition": "To shuffle a library or a face-down pile of cards, randomize the cards within it so that no player knows their order. Some effects cause a player to search a library for a card or cards, shuffle that library, then put some or all of the found cards into a different zone or in a certain position in that library. In such cases, the found cards aren’t included in the shuffle, even though they remain in the library at that time. Rather, all the cards in that library except those are shuffled. Abilities that trigger when a library is shuffled will still trigger. See also rule 401, “Library.”",
    "entryId": "701.24"
  },
  "surveil": {
    "label": "Surveil",
    "definition": "To “surveil N” means to look at the top N cards of your library, then put any number of them into your graveyard and the rest on top of your library in any order. If an effect allows you to look at additional cards while you surveil, those cards are included among the cards you may put into your graveyard and on top of your library in any order.",
    "entryId": "701.25"
  },
  "transform": {
    "label": "Transform",
    "definition": "To transform a permanent, turn it over so that its other face is up. Only permanents represented by double-faced tokens and double-faced cards can transform. (See rule 712, “Double-Faced Cards.”) Although transforming a permanent uses the same physical action as turning a permanent face up or face down, they are different game actions. Abilities that trigger when a permanent is turned face down won’t trigger when that permanent transforms, and so on.",
    "entryId": "701.27"
  },
  "convert": {
    "label": "Convert",
    "definition": "To convert a permanent, turn it so that its other face is up. This follows rules 701.27a–f, 712.9–10, and 712.18. Those rules apply to converting a permanent just as they apply to transforming a permanent. Although converting a permanent uses the same physical action as turning a permanent face up or face down, they are different game actions. Abilities that trigger when a permanent is turned face down won’t trigger when that permanent converts, and so on.",
    "entryId": "701.28"
  },
  "fateseal": {
    "label": "Fateseal",
    "definition": "To “fateseal N” means to look at the top N cards of an opponent’s library, then put any number of them on the bottom of that library in any order and the rest on top of that library in any order.",
    "entryId": "701.29"
  },
  "clash": {
    "label": "Clash",
    "definition": "To clash, a player reveals the top card of their library. That player may then put that card on the bottom of their library. “Clash with an opponent” means “Choose an opponent. You and that opponent each clash.”",
    "entryId": "701.30"
  },
  "planeswalk": {
    "label": "Planeswalk",
    "definition": "A player may planeswalk only during a Planechase game. Only the planar controller may planeswalk. See rule 901, “Planechase.” To planeswalk is to put each face-up plane card and phenomenon card on the bottom of its owner’s planar deck face down, then move the top card of your planar deck off that planar deck and turn it face up.",
    "entryId": "701.31"
  },
  "set in motion": {
    "label": "Set in motion",
    "definition": "Only a scheme card may be set in motion, and only during an Archenemy game. Only the archenemy may set a scheme card in motion. See rule 314, “Schemes,” and rule 904, “Archenemy.” To set a scheme in motion, move it off the top of your scheme deck if it’s on top of your scheme deck and turn it face up if it isn’t face up. That scheme is considered to have been set in motion even if neither of these actions was performed on it.",
    "entryId": "701.32"
  },
  "abandon": {
    "label": "Abandon",
    "definition": "Only a face-up ongoing scheme card may be abandoned, and only during an Archenemy game. See rule 314, “Schemes,” and rule 904, “Archenemy.” To abandon a scheme, turn it face down and put it on the bottom of its owner’s scheme deck.",
    "entryId": "701.33"
  },
  "proliferate": {
    "label": "Proliferate",
    "definition": "To proliferate means to choose any number of permanents and/or players that have a counter, then give each one additional counter of each kind that permanent or player already has. In a Two-Headed Giant game, poison counters are shared by the team. If more than one player on a team is chosen this way, only one of those players can be given an additional poison counter. The player who proliferates chooses which player that is. See rule 810, “Two-Headed Giant Variant.”",
    "entryId": "701.34"
  },
  "detain": {
    "label": "Detain",
    "definition": "Certain spells and abilities can detain a permanent. Until the next turn of the controller of that spell or ability, that permanent can’t attack or block and its activated abilities can’t be activated.",
    "entryId": "701.35"
  },
  "populate": {
    "label": "Populate",
    "definition": "To populate means to choose a creature token you control and create a token that’s a copy of that creature token. If you control no creature tokens when instructed to populate, you won’t create a token.",
    "entryId": "701.36"
  },
  "monstrosity": {
    "label": "Monstrosity",
    "definition": "“Monstrosity N” means “If this permanent isn’t monstrous, put N +1/+1 counters on it and it becomes monstrous.” Monstrous is a designation that has no rules meaning other than to act as a marker that the monstrosity action and other spells and abilities can identify. Only permanents can be or become monstrous. Once a permanent becomes monstrous, it stays monstrous until it leaves the battlefield. Monstrous is neither an ability nor part of the permanent’s copiable values.",
    "entryId": "701.37"
  },
  "vote": {
    "label": "Vote",
    "definition": "Some spells and abilities instruct players to vote for one choice from a list of options to determine some aspect of the effect of that spell or ability. To vote, each player, starting with a specified player and proceeding in turn order, chooses one of those choices. The listed choices may be objects, words with no rules meaning that are each connected to a different effect, or other variables relevant to the resolution of the spell or ability.",
    "entryId": "701.38"
  },
  "bolster": {
    "label": "Bolster",
    "definition": "“Bolster N” means “Choose a creature you control with the least toughness or tied for least toughness among creatures you control. Put N +1/+1 counters on that creature.”",
    "entryId": "701.39"
  },
  "manifest": {
    "label": "Manifest",
    "definition": "To manifest a card, turn it face down. It becomes a 2/2 face-down creature card with no text, no name, no subtypes, and no mana cost. Put that card onto the battlefield face down. That permanent is a manifested permanent for as long as it remains face down. The effect defining its characteristics works while the card is face down and ends when it’s turned face up. Any time you have priority, you may turn a manifested permanent you control face up. This is a special action that doesn’t use the stack (see rule 116.2b). To do this, show all players that the card representing that permanent is a creature card and what that card’s mana cost is, pay that cost, then turn the permanent face up. The effect defining its characteristics while it was face down ends, and it regains its normal characteristics. (If the card representing that permanent isn’t a creature card or it doesn’t have a mana cost, it can’t be turned face up this way.)",
    "entryId": "701.40"
  },
  "support": {
    "label": "Support",
    "definition": "“Support N” on a permanent means “Put a +1/+1 counter on each of up to N other target creatures.” “Support N” on an instant or sorcery spell means “Put a +1/+1 counter on each of up to N target creatures.”",
    "entryId": "701.41"
  },
  "meld": {
    "label": "Meld",
    "definition": "Meld is a keyword action that appears in an ability on one card in a meld pair. To meld the two cards in a meld pair, put them onto the battlefield with their back faces up and combined. The resulting permanent is a single object represented by two cards. See rule 712, “Double- Faced Cards.” Only two cards belonging to the same meld pair can be melded. Tokens, cards that aren’t meld cards, or meld cards that don’t form a meld pair can’t be melded.",
    "entryId": "701.42"
  },
  "exert": {
    "label": "Exert",
    "definition": "To exert a permanent, you choose to have it not untap during your next untap step. A permanent can be exerted even if it’s not tapped or has already been exerted in a turn. If you exert a permanent more than once before your next untap step, each effect causing it not to untap expires during the same untap step.",
    "entryId": "701.43"
  },
  "explore": {
    "label": "Explore",
    "definition": "Certain spells and abilities instruct a permanent to explore. To do so, that permanent’s controller reveals the top card of their library. If a land card is revealed this way, that player puts that card into their hand. Otherwise, that player puts a +1/+1 counter on the exploring permanent and may put the revealed card into their graveyard. A permanent “explores” after the process described in rule 701.44a is complete, even if some or all of those actions were impossible.",
    "entryId": "701.44"
  },
  "assemble": {
    "label": "Assemble",
    "definition": "Assemble is a keyword action in the Unstable set that puts Contraptions onto the battlefield. Outside of silver-bordered cards, only one card (Steamflogger Boss) refers to assembling a Contraption. Cards and mechanics from the Unstable set aren’t included in these rules. See the Unstable FAQ for more information.",
    "entryId": "701.45"
  },
  "adapt": {
    "label": "Adapt",
    "definition": "“Adapt N” means “If this permanent has no +1/+1 counters on it, put N +1/+1 counters on it.”",
    "entryId": "701.46"
  },
  "amass": {
    "label": "Amass",
    "definition": "To amass [subtype] N means “If you don’t control an Army creature, create a 0/0 black [subtype] Army creature token. Choose an Army creature you control. Put N +1/+1 counters on that creature. If it isn’t a [subtype], it becomes a [subtype] in addition to its other types.” A player “amassed” after the process described in rule 701.47a is complete, even if some or all of those actions were impossible.",
    "entryId": "701.47"
  },
  "learn": {
    "label": "Learn",
    "definition": "“Learn” means “You may discard a card. If you do, draw a card. If you didn’t discard a card, you may reveal a Lesson card you own from outside the game and put it into your hand.”",
    "entryId": "701.48"
  },
  "venture into the dungeon": {
    "label": "Venture into the dungeon",
    "definition": "If a player is instructed to venture into the dungeon while they don’t own a dungeon card in the command zone, they choose a dungeon card they own from outside the game and put it into the command zone. They put their venture marker on the topmost room. See rule 309, “Dungeons.” If a player is instructed to venture into the dungeon while their venture marker is in any room except a dungeon card’s bottommost room, they choose an adjacent room, following the direction of an arrow pointing away from their current room. If there are multiple arrows pointing away from the room the player’s venture marker is in, they choose one of them to follow. They move their venture marker to that adjacent room.",
    "entryId": "701.49"
  },
  "connive": {
    "label": "Connive",
    "definition": "Certain spells and abilities instruct a permanent to connive. To do so, that permanent’s controller draws a card, then discards a card. If a nonland card is discarded this way, that player puts a +1/+1 counter on the conniving permanent. If a permanent is no longer on the battlefield as an effect instructs it to connive, its last known information is used to determine which object connived and who controlled it.",
    "entryId": "701.50"
  },
  "open an attraction": {
    "label": "Open an Attraction",
    "definition": "A player may open an Attraction only during a game in which that player is playing with an Attraction deck (see rule 717, “Attraction Cards”). To open an Attraction, move the top card of your Attraction deck off the Attraction deck, turn it face up, and put it onto the battlefield under your control.",
    "entryId": "701.51"
  },
  "roll to visit your attractions": {
    "label": "Roll to Visit Your Attractions",
    "definition": "To roll to visit your Attractions, roll a six-sided die. Then if you control one or more Attractions with a number lit up that is equal to that result, each of those Attractions has been “visited” and its visit ability triggers. See rule 717, “Attraction Cards,” and rule 702.159, “Visit.”",
    "entryId": "701.52"
  },
  "incubate": {
    "label": "Incubate",
    "definition": "To incubate N, create an Incubator token that enters the battlefield with N +1/+1 counters on it. See rule 111.10i. An Incubator token is a double-faced token. Its front face is a colorless Incubator artifact with “{2}: Transform this token.” Its back face is a 0/0 colorless Phyrexian artifact creature named “Phyrexian Token.”",
    "entryId": "701.53"
  },
  "time travel": {
    "label": "Time Travel",
    "definition": "To time travel means to choose any number of permanents you control with one or more time counters on them and/or suspended cards you own in exile with one or more time counters on them and, for each of those objects, put a time counter on it or remove a time counter from it. See rule 702.62, “Suspend.”",
    "entryId": "701.56"
  },
  "discover": {
    "label": "Discover",
    "definition": "“Discover N” means “Exile cards from the top of your library until you exile a nonland card with mana value N or less. You may cast that card without paying its mana cost if the resulting spell’s mana value is less than or equal to N. If you don’t cast it, put that card into your hand. Put the remaining exiled cards on the bottom of your library in a random order.” A player has “discovered” after the process described in 701.57a is complete, even if some or all of those actions were impossible.",
    "entryId": "701.57"
  },
  "cloak": {
    "label": "Cloak",
    "definition": "To cloak a card, turn it face down. It becomes a 2/2 face-down creature card with ward {2}, no name, no subtypes, and no mana cost. Put that card onto the battlefield face down. That permanent is a cloaked permanent for as long as it remains face down. The effect defining its characteristics works while the card is face down and ends when it’s turned face up. Any time you have priority, you may turn a cloaked permanent you control face up. This is a special action that doesn’t use the stack (see rule 116.2b). To do this, show all players that the card representing that permanent is a creature card and what that card’s mana cost is, pay that cost, then turn the permanent face up. The effect defining its characteristics while it was face down ends, and it regains its normal characteristics. (If the card representing that permanent isn’t a creature card or it doesn’t have a mana cost, it can’t be turned face up this way.)",
    "entryId": "701.58"
  },
  "collect evidence": {
    "label": "Collect evidence",
    "definition": "To “collect evidence N” means to exile any number of cards from your graveyard with total mana value N or greater. If a player is given the choice to collect evidence but is unable to exile cards with total mana value N or greater from their graveyard (usually because there aren’t enough cards to do so) they can’t choose to collect evidence.",
    "entryId": "701.59"
  },
  "suspect": {
    "label": "Suspect",
    "definition": "Certain spells and abilities instruct a player to suspect a creature. That creature becomes suspected until it leaves the battlefield or until a spell or ability causes it to no longer be suspected. Suspected is a designation a permanent can have. Only permanents can have the suspected designation. Suspected is neither an ability nor part of the permanent’s copiable values.",
    "entryId": "701.60"
  },
  "forage": {
    "label": "Forage",
    "definition": "To forage means “Exile three cards from your graveyard or sacrifice a Food.”",
    "entryId": "701.61"
  },
  "manifest dread": {
    "label": "Manifest dread",
    "definition": "“Manifest dread” means “Look at the top two cards of your library. Manifest one of them, then put the cards you looked at that were not manifested this way into your graveyard.” See rule 701.40, “Manifest.” An ability that triggers whenever a player manifests dread triggers after the process described in rule 701.62a is complete, even if some or all of those actions were impossible.",
    "entryId": "701.62"
  },
  "endure": {
    "label": "Endure",
    "definition": "Certain abilities instruct a permanent to endure N. To do so, that permanent’s controller creates an N/N white Spirit creature token unless they put N +1/+1 counters on that permanent. If a permanent is instructed to endure 0, nothing happens. No counters are put on that permanent and no tokens are created.",
    "entryId": "701.63"
  },
  "harness": {
    "label": "Harness",
    "definition": "“Harness [this permanent]” means “If this permanent isn’t harnessed, it becomes harnessed.” Harnessed is a designation that has no rules meaning other than to act as a marker that other spells and abilities can identify. Only permanents can be or become harnessed. Once a permanent becomes harnessed, it stays harnessed until it leaves the battlefield. Harnessed is neither an ability nor part of the permanent’s copiable values.",
    "entryId": "701.64"
  },
  "airbend": {
    "label": "Airbend",
    "definition": "Certain spells and abilities instruct a player to airbend one or more permanents and/or spells. To do so, that player exiles those objects. For each card exiled this way, for as long as it remains exiled, its owner may cast it by paying {2} rather than paying its mana cost. An ability that triggers whenever a player airbends triggers when that player exiles one or more objects as a result of an instruction to airbend.",
    "entryId": "701.65"
  },
  "earthbend": {
    "label": "Earthbend",
    "definition": "“Earthbend N” means “Target land you control becomes a 0/0 land creature with haste in addition to its other types. Put N +1/+1 counters on it. When that land dies or is put into exile, return it to the battlefield tapped under your control.” An ability that triggers whenever a player earthbends triggers when the delayed triggered ability described in rule 701.66a is created.",
    "entryId": "701.66"
  },
  "waterbend": {
    "label": "Waterbend",
    "definition": "“Waterbend [cost]” means “Pay [cost]. For each generic mana in that cost, you may tap an untapped artifact or creature you control rather than pay that mana.” If a waterbend cost is part of the total cost to cast a spell or activate an ability (usually because the waterbend cost itself is an additional cost), the alternate method to pay for mana described in rule 701.67a may be used only to pay for the amount of generic mana in the waterbend cost, even if the total cost to cast that spell or activate that ability includes other generic mana components. Example: Spirit Water Revival is a spell that costs {1}{U}{U} and says, in part, “As an additional cost to cast this spell, waterbend {6}.” As you cast it, you may tap up to six artifacts and/or creatures you control to pay the for the {6} in its waterbend cost, but you can’t tap any artifacts or creatures to pay for any part of the {1}{U}{U} mana cost.",
    "entryId": "701.67"
  },
  "blight": {
    "label": "Blight",
    "definition": "To “blight N” means to put N -1/-1 counters on a creature you control. If a player is given the choice to blight but is unable to put N -1/-1 counters on a creature they control (usually because they control no creatures), they can’t choose to blight.",
    "entryId": "701.68"
  },
  "heal": {
    "label": "Heal",
    "definition": "To heal damage already dealt to a permanent, remove that marked damage from that permanent. If an effect states that damage already dealt to a permanent “is healed,” that permanent’s controller removes all marked damage from that permanent.",
    "entryId": "701.69"
  },
  "recruit": {
    "label": "Recruit",
    "definition": "“Recruit” means “Draw a card, then discard a card. If you discarded a nonland card this way, create a 1/1 white Human Soldier creature token.”",
    "entryId": "701.70"
  },
  "empower jace": {
    "label": "Empower Jace",
    "definition": "To empower Jace N means “If you don’t control a Jace planeswalker token, create a blue Jace planeswalker token with 0 loyalty, ‘[−1]: Surveil 1,’ and ‘[−3]: Draw a card.’ Choose a Jace planeswalker token you control. Put N loyalty counters on it.”",
    "entryId": "701.71"
  },
  "deathtouch": {
    "label": "Deathtouch",
    "definition": "Deathtouch is a static ability. A creature with toughness greater than 0 that’s been dealt damage by a source with deathtouch since the last time state-based actions were checked is destroyed as a state-based action. See rule 704.",
    "entryId": "702.2"
  },
  "defender": {
    "label": "Defender",
    "definition": "Defender is a static ability. A creature with defender can’t attack.",
    "entryId": "702.3"
  },
  "double strike": {
    "label": "Double strike",
    "definition": "Double strike is a static ability that modifies the rules for the combat damage step. (See rule 510, “Combat Damage Step.”) If at least one attacking or blocking creature has first strike (see rule 702.7) or double strike as the combat damage step begins, the only creatures that assign combat damage in that step are those with first strike or double strike. After that step, instead of proceeding to the end of combat step, the phase gets a second combat damage step. The only creatures that assign combat damage in that step are the remaining attackers and blockers that had neither first strike nor double strike as the first combat damage step began, as well as the remaining attackers and blockers that currently have double strike. After that step, the phase proceeds to the end of combat step.",
    "entryId": "702.4"
  },
  "enchant": {
    "label": "Enchant",
    "definition": "Enchant is a static ability, written “Enchant [object or player].” The enchant ability restricts what an Aura spell can target and what an Aura can enchant. For more information about Auras, see rule 303, “Enchantments.”",
    "entryId": "702.5"
  },
  "equip": {
    "label": "Equip",
    "definition": "Equip is an activated ability of Equipment cards. “Equip [cost]” means “[Cost]: Attach this permanent to target creature you control. Activate only as a sorcery.” For more information about Equipment, see rule 301, “Artifacts.”",
    "entryId": "702.6"
  },
  "first strike": {
    "label": "First strike",
    "definition": "First strike is a static ability that modifies the rules for the combat damage step. (See rule 510, “Combat Damage Step.”) If at least one attacking or blocking creature has first strike or double strike (see rule 702.4) as the combat damage step begins, the only creatures that assign combat damage in that step are those with first strike or double strike. After that step, instead of proceeding to the end of combat step, the phase gets a second combat damage step. The only creatures that assign combat damage in that step are the remaining attackers and blockers that had neither first strike nor double strike as the first combat damage step began, as well as the remaining attackers and blockers that currently have double strike. After that step, the phase proceeds to the end of combat step.",
    "entryId": "702.7"
  },
  "flash": {
    "label": "Flash",
    "definition": "Flash is a static ability that functions in any zone from which you could play the card it’s on. “Flash” means “You may play this card any time you could cast an instant.” Multiple instances of flash on the same object are redundant.",
    "entryId": "702.8"
  },
  "flying": {
    "label": "Flying",
    "definition": "Flying is an evasion ability. A creature with flying can’t be blocked except by creatures with flying and/or reach. A creature with flying can block a creature with or without flying. (See rule 509, “Declare Blockers Step,” and rule 702.17, “Reach.”)",
    "entryId": "702.9"
  },
  "haste": {
    "label": "Haste",
    "definition": "Haste is a static ability. If a creature has haste, it can attack even if it hasn’t been controlled by its controller continuously since their most recent turn began. (See rule 302.6.)",
    "entryId": "702.10"
  },
  "hexproof": {
    "label": "Hexproof",
    "definition": "Hexproof is a static ability. “Hexproof” on a permanent means “This permanent can’t be the target of spells or abilities your opponents control.”",
    "entryId": "702.11"
  },
  "indestructible": {
    "label": "Indestructible",
    "definition": "Indestructible is a static ability. A permanent with indestructible can’t be destroyed. Such permanents aren’t destroyed by lethal damage, and they ignore the state-based action that checks for lethal damage (see rule 704.5g).",
    "entryId": "702.12"
  },
  "intimidate": {
    "label": "Intimidate",
    "definition": "Intimidate is an evasion ability. A creature with intimidate can’t be blocked except by artifact creatures and/or creatures that share a color with it. (See rule 509, “Declare Blockers Step.”)",
    "entryId": "702.13"
  },
  "landwalk": {
    "label": "Landwalk",
    "definition": "Landwalk is a generic term that appears within an object’s rules text as “[type]walk,” where [type] is usually a land type, but it can also be the card type land plus any combination of land types, card types, and/or supertypes. Landwalk is an evasion ability.",
    "entryId": "702.14"
  },
  "lifelink": {
    "label": "Lifelink",
    "definition": "Lifelink is a static ability. Damage dealt by a source with lifelink causes that source’s controller, or its owner if it has no controller, to gain that much life (in addition to any other results that damage causes). See rule 120.3.",
    "entryId": "702.15"
  },
  "protection": {
    "label": "Protection",
    "definition": "Protection is a static ability, written “Protection from [quality].” This quality is usually a color (as in “protection from black”) but can be any characteristic value or information. If the quality happens to be a card name, it is treated as such only if the protection ability specifies that the quality is a name. If the quality is a card type, subtype, or supertype, the ability applies to sources that are permanents with that card type, subtype, or supertype and to any sources not on the battlefield that are of that card type, subtype, or supertype. This is an exception to rule 109.2. A permanent or player with protection can’t be targeted by spells with the stated quality and can’t be targeted by abilities from a source with the stated quality.",
    "entryId": "702.16"
  },
  "reach": {
    "label": "Reach",
    "definition": "Reach is a static ability. A creature with flying can’t be blocked except by creatures with flying and/or reach. (See rule 509, “Declare Blockers Step,” and rule 702.9, “Flying.”)",
    "entryId": "702.17"
  },
  "shroud": {
    "label": "Shroud",
    "definition": "Shroud is a static ability. “Shroud” means “This permanent or player can’t be the target of spells or abilities.” Multiple instances of shroud on the same permanent or player are redundant.",
    "entryId": "702.18"
  },
  "trample": {
    "label": "Trample",
    "definition": "Trample is a static ability that modifies the rules for assigning an attacking creature’s combat damage. The ability has no effect when a creature with trample is blocking or is dealing noncombat damage. (See rule 510, “Combat Damage Step.”) The controller of an attacking creature with trample first assigns damage to the creature(s) blocking it. Once all those blocking creatures are assigned lethal damage, any excess damage is assigned as its controller chooses among those blocking creatures and the player, planeswalker, or battle the creature is attacking. When checking for assigned lethal damage, take into account damage already marked on the creature and damage from other creatures that’s being assigned during the same combat damage step, but not any abilities or effects that might change the amount of damage that’s actually dealt. The attacking creature’s controller need not assign lethal damage to all those blocking creatures but in that case can’t assign any damage to the player or planeswalker it’s attacking. Example: A 2/2 creature that can block an additional creature blocks two attackers: a 1/1 with no abilities and a 3/3 with trample. The active player could assign 1 damage from the first attacker and 1 damage from the second to the blocking creature, and 2 damage to the defending player from the creature with trample. Example: A 6/6 green creature with trample is blocked by a 2/2 creature with protection from green. The attacking creature’s controller must assign at least 2 damage to the blocker, even though that damage will be prevented by the blocker’s protection ability. The attacking creature’s controller can divide the rest of the damage as they choose between the blocking creature and the defending player.",
    "entryId": "702.19"
  },
  "vigilance": {
    "label": "Vigilance",
    "definition": "Vigilance is a static ability that modifies the rules for the declare attackers step. Attacking doesn’t cause creatures with vigilance to tap. (See rule 508, “Declare Attackers Step.”)",
    "entryId": "702.20"
  },
  "ward": {
    "label": "Ward",
    "definition": "Ward is a triggered ability. Ward [cost] means “Whenever this permanent becomes the target of a spell or ability an opponent controls, counter that spell or ability unless that player pays [cost].” Some ward abilities include an X in their cost and state what X is equal to. This value is determined at the time the ability resolves, not locked in as the ability triggers.",
    "entryId": "702.21"
  },
  "banding": {
    "label": "Banding",
    "definition": "Banding is a static ability that modifies the rules for combat. “Bands with other” is a special form of banding. If an effect causes a permanent to lose banding, the permanent loses all “bands with other” abilities as well.",
    "entryId": "702.22"
  },
  "rampage": {
    "label": "Rampage",
    "definition": "Rampage is a triggered ability. “Rampage N” means “Whenever this creature becomes blocked, it gets +N/+N until end of turn for each creature blocking it beyond the first.” (See rule 509, “Declare Blockers Step.”) The rampage bonus is calculated only once per combat, when the triggered ability resolves. Adding or removing blockers later in combat won’t change the bonus.",
    "entryId": "702.23"
  },
  "cumulative upkeep": {
    "label": "Cumulative upkeep",
    "definition": "Cumulative upkeep is a triggered ability that imposes an increasing cost on a permanent. “Cumulative upkeep [cost]” means “At the beginning of your upkeep, if this permanent is on the battlefield, put an age counter on this permanent. Then you may pay [cost] for each age counter on it. If you don’t, sacrifice it.” If [cost] has choices associated with it, each choice is made separately for each age counter, then either the entire set of costs is paid, or none of them is paid. Partial payments aren’t allowed. Example: A creature has “Cumulative upkeep {W} or {U}” and two age counters on it. When its ability next triggers and resolves, the creature’s controller puts an age counter on it and then may pay {W}{W}{W}, {W}{W}{U}, {W}{U}{U}, or {U}{U}{U} to keep the creature on the battlefield. Example: A creature has “Cumulative upkeep—Sacrifice a creature” and one age counter on it. When its ability next triggers and resolves, its controller can’t choose the same creature to sacrifice twice. Either two different creatures must be sacrificed, or the creature with cumulative upkeep must be sacrificed. If a permanent has multiple instances of cumulative upkeep, each triggers separately. However, the age counters are not connected to any particular ability; each cumulative upkeep ability will count the total number of age counters on the permanent at the time that ability resolves. Example: A creature has two instances of “Cumulative upkeep—Pay 1 life.” The creature has no age counters, and both cumulative upkeep abilities trigger. When the first ability resolves, the controller adds a counter and then chooses to pay 1 life. When the second ability resolves, the controller adds another counter and then chooses to pay an additional 2 life.",
    "entryId": "702.24"
  },
  "flanking": {
    "label": "Flanking",
    "definition": "Flanking is a triggered ability that triggers during the declare blockers step. (See rule 509, “Declare Blockers Step.”) “Flanking” means “Whenever this creature becomes blocked by a creature without flanking, the blocking creature gets -1/-1 until end of turn.” If a creature has multiple instances of flanking, each triggers separately.",
    "entryId": "702.25"
  },
  "phasing": {
    "label": "Phasing",
    "definition": "Phasing is a static ability that modifies the rules of the untap step. During each player’s untap step, before the active player untaps permanents, all phased-in permanents with phasing that player controls “phase out.” Simultaneously, all phased-out permanents that had phased out under that player’s control “phase in.” If a permanent phases out, its status changes to “phased out.” Except for rules and effects that specifically mention phased-out permanents, a phased-out permanent is treated as though it does not exist. It can’t affect or be affected by anything else in the game. A permanent that phases out is removed from combat. (See rule 506.4.) Example: You control three creatures, one of which is phased out. You cast a spell that says “Draw a card for each creature you control.” You draw two cards. Example: You control a phased-out creature. You cast a spell that says “Destroy all creatures.” The phased-out creature is not destroyed.",
    "entryId": "702.26"
  },
  "buyback": {
    "label": "Buyback",
    "definition": "Buyback appears on some instants and sorceries. It represents two static abilities that function while the spell is on the stack. “Buyback [cost]” means “You may pay an additional [cost] as you cast this spell” and “If the buyback cost was paid, put this spell into its owner’s hand instead of into that player’s graveyard as it resolves.” Paying a spell’s buyback cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.27"
  },
  "shadow": {
    "label": "Shadow",
    "definition": "Shadow is an evasion ability. A creature with shadow can’t be blocked by creatures without shadow, and a creature without shadow can’t be blocked by creatures with shadow. (See rule 509, “Declare Blockers Step.”)",
    "entryId": "702.28"
  },
  "cycling": {
    "label": "Cycling",
    "definition": "Cycling is an activated ability that functions only while the card with cycling is in a player’s hand. “Cycling [cost]” means “[Cost], Discard this card: Draw a card.” Although the cycling ability can be activated only if the card is in a player’s hand, it continues to exist while the object is on the battlefield and in all other zones. Therefore objects with cycling will be affected by effects that depend on objects having one or more activated abilities.",
    "entryId": "702.29"
  },
  "echo": {
    "label": "Echo",
    "definition": "Echo is a triggered ability. “Echo [cost]” means “At the beginning of your upkeep, if this permanent came under your control since the beginning of your last upkeep, sacrifice it unless you pay [cost].” Urza block cards with the echo ability were printed without an echo cost. These cards have been given errata in the Oracle card reference; each one now has an echo cost equal to its mana cost.",
    "entryId": "702.30"
  },
  "horsemanship": {
    "label": "Horsemanship",
    "definition": "Horsemanship is an evasion ability. A creature with horsemanship can’t be blocked by creatures without horsemanship. A creature with horsemanship can block a creature with or without horsemanship. (See rule 509, “Declare Blockers Step.”)",
    "entryId": "702.31"
  },
  "fading": {
    "label": "Fading",
    "definition": "Fading is a keyword that represents two abilities. “Fading N” means “This permanent enters with N fade counters on it” and “At the beginning of your upkeep, remove a fade counter from this permanent. If you can’t, sacrifice the permanent.”",
    "entryId": "702.32"
  },
  "kicker": {
    "label": "Kicker",
    "definition": "Kicker is a static ability that functions while the spell with kicker is on the stack. “Kicker [cost]” means “You may pay an additional [cost] as you cast this spell.” Paying a spell’s kicker cost(s) follows the rules for paying additional costs in rules 601.2b and 601.2f–h. The phrase “Kicker [cost 1] and/or [cost 2]” means the same thing as “Kicker [cost 1], kicker [cost 2].”",
    "entryId": "702.33"
  },
  "flashback": {
    "label": "Flashback",
    "definition": "Flashback appears on some instants and sorceries. It represents two static abilities: one that functions while the card is in a player’s graveyard and another that functions while the card is on the stack. “Flashback [cost]” means “You may cast this card from your graveyard if the resulting spell is an instant or sorcery spell by paying [cost] rather than paying its mana cost” and “If the flashback cost was paid, exile this card instead of putting it anywhere else any time it would leave the stack.” Casting a spell using its flashback ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.34"
  },
  "madness": {
    "label": "Madness",
    "definition": "Madness is a keyword that represents two abilities. The first is a static ability that functions while the card with madness is in a player’s hand. The second is a triggered ability that functions when the first ability is applied. “Madness [cost]” means “If a player would discard this card, that player discards it, but exiles it instead of putting it into their graveyard” and “When this card is exiled this way, its owner may cast it by paying [cost] rather than paying its mana cost. If that player doesn’t, they put this card into their graveyard.” Casting a spell using its madness ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.35"
  },
  "fear": {
    "label": "Fear",
    "definition": "Fear is an evasion ability. A creature with fear can’t be blocked except by artifact creatures and/or black creatures. (See rule 509, “Declare Blockers Step.”)",
    "entryId": "702.36"
  },
  "morph": {
    "label": "Morph",
    "definition": "Morph is a static ability that functions in any zone from which you could play the card it’s on, and the morph effect works any time the card is face down. “Morph [cost]” means “You may cast this card as a 2/2 face-down creature with no text, no name, no subtypes, and no mana cost by paying {3} rather than paying its mana cost.” (See rule 708, “Face-Down Spells and Permanents.”) Megamorph is a variant of the morph ability. “Megamorph [cost]” means “You may cast this card as a 2/2 face-down creature with no text, no name, no subtypes, and no mana cost by paying {3} rather than paying its mana cost” and “As this permanent is turned face up, put a +1/+1 counter on it if its megamorph cost was paid to turn it face up.” A megamorph cost is a morph cost.",
    "entryId": "702.37"
  },
  "amplify": {
    "label": "Amplify",
    "definition": "Amplify is a static ability. “Amplify N” means “As this object enters, reveal any number of cards from your hand that share a creature type with it. This permanent enters with N +1/+1 counters on it for each card revealed this way. You can’t reveal this card or any other cards that are entering the battlefield at the same time as this card.” If a creature has multiple instances of amplify, each one works separately.",
    "entryId": "702.38"
  },
  "provoke": {
    "label": "Provoke",
    "definition": "Provoke is a triggered ability. “Provoke” means “Whenever this creature attacks, you may choose to have target creature defending player controls block this creature this combat if able. If you do, untap that creature.” If a creature has multiple instances of provoke, each triggers separately.",
    "entryId": "702.39"
  },
  "storm": {
    "label": "Storm",
    "definition": "Storm is a triggered ability that functions on the stack. “Storm” means “When you cast this spell, copy it for each other spell that was cast before it this turn. If the spell has any targets, you may choose new targets for any of the copies.” If a spell has multiple instances of storm, each triggers separately.",
    "entryId": "702.40"
  },
  "affinity": {
    "label": "Affinity",
    "definition": "Affinity is a static ability that functions while the spell with affinity is on the stack. “Affinity for [text]” means “This spell costs {1} less to cast for each [text] you control.” If a spell has multiple instances of affinity, each of them applies.",
    "entryId": "702.41"
  },
  "entwine": {
    "label": "Entwine",
    "definition": "Entwine is a static ability of modal spells (see rule 700.2) that functions while the spell is on the stack. “Entwine [cost]” means “You may choose all modes of this spell instead of just the number specified. If you do, you pay an additional [cost].” Using the entwine ability follows the rules for choosing modes and paying additional costs in rules 601.2b and 601.2f–h. If the entwine cost was paid, follow the text of each of the modes in the order written on the card when the spell resolves.",
    "entryId": "702.42"
  },
  "modular": {
    "label": "Modular",
    "definition": "Modular represents both a static ability and a triggered ability. “Modular N” means “This permanent enters with N +1/+1 counters on it” and “When this permanent is put into a graveyard from the battlefield, you may put a +1/+1 counter on target artifact creature for each +1/+1 counter on this permanent.” If a creature has multiple instances of modular, each one works separately.",
    "entryId": "702.43"
  },
  "sunburst": {
    "label": "Sunburst",
    "definition": "Sunburst is a static ability that functions as an object is entering the battlefield. “Sunburst” means “If this object is entering as a creature, ignoring any type-changing effects that would affect it, it enters with a +1/+1 counter on it for each color of mana spent to cast it. Otherwise, it enters with a charge counter on it for each color of mana spent to cast it.” Sunburst adds counters only if the object with sunburst is entering the battlefield from the stack as a resolving spell and only if one or more colored mana was spent on its costs, including additional or alternative costs.",
    "entryId": "702.44"
  },
  "bushido": {
    "label": "Bushido",
    "definition": "Bushido is a triggered ability. “Bushido N” means “Whenever this creature blocks or becomes blocked, it gets +N/+N until end of turn.” (See rule 509, “Declare Blockers Step.”) If a creature has multiple instances of bushido, each triggers separately.",
    "entryId": "702.45"
  },
  "soulshift": {
    "label": "Soulshift",
    "definition": "Soulshift is a triggered ability. “Soulshift N” means “When this permanent is put into a graveyard from the battlefield, you may return target Spirit card with mana value N or less from your graveyard to your hand.” If a permanent has multiple instances of soulshift, each triggers separately.",
    "entryId": "702.46"
  },
  "splice": {
    "label": "Splice",
    "definition": "Splice is a static ability that functions while a card is in your hand. “Splice onto [quality] [cost]” means “You may reveal this card from your hand as you cast a [quality] spell. If you do, that spell gains the text of this card’s rules text and you pay [cost] as an additional cost to cast that spell.” Paying a card’s splice cost follows the rules for paying additional costs in rules You can’t choose to use a splice ability if you can’t make the required choices (targets, etc.) for that card’s rules text. You can’t splice any one card onto the same spell more than once. If you’re splicing more than one card onto a spell, reveal them all at once and choose the order in which their effects will happen. The effects of the main spell must happen first.",
    "entryId": "702.47"
  },
  "offering": {
    "label": "Offering",
    "definition": "Offering is a static ability that functions while the spell with offering is on the stack. “[Quality] offering” means “As an additional cost to cast this spell, you may sacrifice a [quality] permanent. If you chose to pay the additional cost, this spell’s total cost is reduced by the sacrificed permanent’s mana cost, and you may cast this spell any time you could cast an instant.” You choose which permanent to sacrifice as you make choices for the spell (see rule 601.2b), and you sacrifice that permanent as you pay the total cost (see rule 601.2h).",
    "entryId": "702.48"
  },
  "ninjutsu": {
    "label": "Ninjutsu",
    "definition": "Ninjutsu is an activated ability that functions only while the card with ninjutsu is in a player’s hand. “Ninjutsu [cost]” means “[Cost], Reveal this card from your hand, Return an unblocked attacking creature you control to its owner’s hand: Put this card onto the battlefield from your hand tapped and attacking.” The card with ninjutsu remains revealed from the time the ability is announced until the ability leaves the stack.",
    "entryId": "702.49"
  },
  "epic": {
    "label": "Epic",
    "definition": "Epic represents two spell abilities, one of which creates a delayed triggered ability. “Epic” means “For the rest of the game, you can’t cast spells,” and “At the beginning of each of your upkeeps for the rest of the game, copy this spell except for its epic ability. If the spell has any targets, you may choose new targets for the copy.” See rule 707.10. A player can’t cast spells once a spell with epic they control resolves, but effects (such as the epic ability itself) can still put copies of spells onto the stack.",
    "entryId": "702.50"
  },
  "convoke": {
    "label": "Convoke",
    "definition": "Convoke is a static ability that functions while the spell with convoke is on the stack. “Convoke” means “For each colored mana in this spell’s total cost, you may tap an untapped creature of that color you control rather than pay that mana. For each generic mana in this spell’s total cost, you may tap an untapped creature you control rather than pay that mana.” The convoke ability isn’t an additional or alternative cost and applies only after the total cost of the spell with convoke is determined. Example: Heartless Summoning says, in part, “Creature spells you cast cost {2} less to cast.” You control Heartless Summoning and cast Siege Wurm, a spell with convoke that costs {5}{G}{G}. The total cost to cast Siege Wurm is {3}{G}{G}. After activating mana abilities, you pay that total cost. You may tap up to two green creatures and up to three other creatures to pay that cost, and the remainder is paid with mana.",
    "entryId": "702.51"
  },
  "dredge": {
    "label": "Dredge",
    "definition": "Dredge is a static ability that functions only while the card with dredge is in a player’s graveyard. “Dredge N” means “As long as you have at least N cards in your library, if you would draw a card, you may instead mill N cards and return this card from your graveyard to your hand.” A player with fewer cards in their library than the number required by a dredge ability can’t mill any of them this way.",
    "entryId": "702.52"
  },
  "transmute": {
    "label": "Transmute",
    "definition": "Transmute is an activated ability that functions only while the card with transmute is in a player’s hand. “Transmute [cost]” means “[Cost], Discard this card: Search your library for a card with the same mana value as the discarded card, reveal that card, and put it into your hand. Then shuffle your library. Activate only as a sorcery.” Although the transmute ability can be activated only if the card is in a player’s hand, it continues to exist while the object is on the battlefield and in all other zones. Therefore objects with transmute will be affected by effects that depend on objects having one or more activated abilities.",
    "entryId": "702.53"
  },
  "bloodthirst": {
    "label": "Bloodthirst",
    "definition": "Bloodthirst is a static ability. “Bloodthirst N” means “If an opponent was dealt damage this turn, this permanent enters with N +1/+1 counters on it.” “Bloodthirst X” is a variant of the bloodthirst ability. “Bloodthirst X” means “This permanent enters with X +1/+1 counters on it, where X is the total damage your opponents have been dealt this turn.”",
    "entryId": "702.54"
  },
  "haunt": {
    "label": "Haunt",
    "definition": "Haunt is a triggered ability. “Haunt” on a permanent means “When this permanent is put into a graveyard from the battlefield, exile it haunting target creature.” “Haunt” on an instant or sorcery spell means “When this spell is put into a graveyard during its resolution, exile it haunting target creature.” Cards that are in the exile zone as the result of a haunt ability “haunt” the creature targeted by that ability. The phrase “creature it haunts” refers to the object targeted by the haunt ability, regardless of whether or not that object is still a creature.",
    "entryId": "702.55"
  },
  "replicate": {
    "label": "Replicate",
    "definition": "Replicate is a keyword that represents two abilities. The first is a static ability that functions while the spell with replicate is on the stack. The second is a triggered ability that functions while the spell with replicate is on the stack. “Replicate [cost]” means “As an additional cost to cast this spell, you may pay [cost] any number of times” and “When you cast this spell, if a replicate cost was paid for it, copy it for each time its replicate cost was paid. If the spell has any targets, you may choose new targets for any of the copies.” Paying a spell’s replicate cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. If a spell has multiple instances of replicate, each is paid separately and triggers based on the payments made for it, not any other instance of replicate.",
    "entryId": "702.56"
  },
  "forecast": {
    "label": "Forecast",
    "definition": "A forecast ability is an activated ability that can be activated only from a player’s hand. It’s written “Forecast — [Activated ability].” A forecast ability may be activated only during the upkeep step of the card’s owner and only once each turn. The controller of the forecast ability reveals the card with that ability from their hand as the ability is activated. That player plays with that card revealed in their hand until it leaves the player’s hand or until a step or phase that isn’t an upkeep step begins, whichever comes first.",
    "entryId": "702.57"
  },
  "graft": {
    "label": "Graft",
    "definition": "Graft represents both a static ability and a triggered ability. “Graft N” means “This permanent enters with N +1/+1 counters on it” and “Whenever another creature enters, if this permanent has a +1/+1 counter on it, you may move a +1/+1 counter from this permanent onto that creature.” If a permanent has multiple instances of graft, each one works separately.",
    "entryId": "702.58"
  },
  "recover": {
    "label": "Recover",
    "definition": "Recover is a triggered ability that functions only while the card with recover is in a player’s graveyard. “Recover [cost]” means “When a creature is put into your graveyard from the battlefield, you may pay [cost]. If you do, return this card from your graveyard to your hand. Otherwise, exile this card.”",
    "entryId": "702.59"
  },
  "ripple": {
    "label": "Ripple",
    "definition": "Ripple is a triggered ability that functions only while the card with ripple is on the stack. “Ripple N” means “When you cast this spell, you may reveal the top N cards of your library, or, if there are fewer than N cards in your library, you may reveal all the cards in your library. If you reveal cards from your library this way, you may cast any of those cards with the same name as this spell without paying their mana costs, then put all revealed cards not cast this way on the bottom of your library in any order.” If a spell has multiple instances of ripple, each triggers separately.",
    "entryId": "702.60"
  },
  "split second": {
    "label": "Split second",
    "definition": "Split second is a static ability that functions only while the spell with split second is on the stack. “Split second” means “As long as this spell is on the stack, players can’t cast other spells or activate abilities that aren’t mana abilities.” Players may activate mana abilities and take special actions while a spell with split second is on the stack. Triggered abilities trigger and are put on the stack as normal while a spell with split second is on the stack.",
    "entryId": "702.61"
  },
  "suspend": {
    "label": "Suspend",
    "definition": "Suspend is a keyword that represents three abilities. The first is a static ability that functions while the card with suspend is in a player’s hand. The second and third are triggered abilities that function in the exile zone. “Suspend N—[cost]” means “If you could begin to cast this card by putting it onto the stack from your hand, you may pay [cost] and exile it with N time counters on it. This action doesn’t use the stack,” and “At the beginning of your upkeep, if this card is suspended, remove a time counter from it,” and “When the last time counter is removed from this card, if it’s exiled, you may play it without paying its mana cost if able. If you don’t, it remains exiled. If you cast a creature spell this way, it gains haste until you lose control of the spell or the permanent it becomes.” A card is “suspended” if it’s in the exile zone, has suspend, and has a time counter on it.",
    "entryId": "702.62"
  },
  "vanishing": {
    "label": "Vanishing",
    "definition": "Vanishing is a keyword that represents three abilities. “Vanishing N” means “This permanent enters with N time counters on it,” “At the beginning of your upkeep, if this permanent has a time counter on it, remove a time counter from it,” and “When the last time counter is removed from this permanent, sacrifice it.” Vanishing without a number means “At the beginning of your upkeep, if this permanent has a time counter on it, remove a time counter from it” and “When the last time counter is removed from this permanent, sacrifice it.”",
    "entryId": "702.63"
  },
  "absorb": {
    "label": "Absorb",
    "definition": "Absorb is a static ability. “Absorb N” means “If a source would deal damage to this creature, prevent N of that damage.” Each absorb ability can prevent only N damage from any one source at any one time. It will apply separately to damage from other sources, or to damage dealt by the same source at a different time.",
    "entryId": "702.64"
  },
  "aura swap": {
    "label": "Aura Swap",
    "definition": "Aura swap is an activated ability of some Aura cards. “Aura swap [cost]” means “[Cost]: You may exchange this permanent with an Aura card in your hand.” If either half of the exchange can’t be completed, the ability has no effect. Example: You activate the aura swap ability of an Aura. The only Aura card in your hand can’t enchant the permanent that’s enchanted by the Aura with aura swap. The ability has no effect. Example: You activate the aura swap ability of an Aura that you control but you don’t own. The ability has no effect.",
    "entryId": "702.65"
  },
  "delve": {
    "label": "Delve",
    "definition": "Delve is a static ability that functions while the spell with delve is on the stack. “Delve” means “For each generic mana in this spell’s total cost, you may exile a card from your graveyard rather than pay that mana.” The delve ability isn’t an additional or alternative cost and applies only after the total cost of the spell with delve is determined.",
    "entryId": "702.66"
  },
  "fortify": {
    "label": "Fortify",
    "definition": "Fortify is an activated ability of Fortification cards. “Fortify [cost]” means “[Cost]: Attach this Fortification to target land you control. Activate only as a sorcery.” For more information about Fortifications, see rule 301, “Artifacts.”",
    "entryId": "702.67"
  },
  "frenzy": {
    "label": "Frenzy",
    "definition": "Frenzy is a triggered ability. “Frenzy N” means “Whenever this creature attacks and isn’t blocked, it gets +N/+0 until end of turn.” If a creature has multiple instances of frenzy, each triggers separately.",
    "entryId": "702.68"
  },
  "gravestorm": {
    "label": "Gravestorm",
    "definition": "Gravestorm is a triggered ability that functions on the stack. “Gravestorm” means “When you cast this spell, copy it for each permanent that was put into a graveyard from the battlefield this turn. If the spell has any targets, you may choose new targets for any of the copies.” If a spell has multiple instances of gravestorm, each triggers separately.",
    "entryId": "702.69"
  },
  "poisonous": {
    "label": "Poisonous",
    "definition": "Poisonous is a triggered ability. “Poisonous N” means “Whenever this creature deals combat damage to a player, that player gets N poison counters.” (For information about poison counters, see rule 104.3d.) If a creature has multiple instances of poisonous, each triggers separately.",
    "entryId": "702.70"
  },
  "transfigure": {
    "label": "Transfigure",
    "definition": "Transfigure is an activated ability. “Transfigure [cost]” means “[Cost], Sacrifice this permanent: Search your library for a creature card with the same mana value as this permanent and put it onto the battlefield. Then shuffle your library. Activate only as a sorcery.”",
    "entryId": "702.71"
  },
  "champion": {
    "label": "Champion",
    "definition": "Champion represents two triggered abilities. “Champion an [object]” means “When this permanent enters, sacrifice it unless you exile another [object] you control” and “When this permanent leaves the battlefield, return the exiled card to the battlefield under its owner’s control.” The two abilities represented by champion are linked. See rule 607, “Linked Abilities.”",
    "entryId": "702.72"
  },
  "changeling": {
    "label": "Changeling",
    "definition": "Changeling is a characteristic-defining ability. “Changeling” means “This object is every creature type.” This ability works everywhere, even outside the game. See rule 604.3.",
    "entryId": "702.73"
  },
  "evoke": {
    "label": "Evoke",
    "definition": "Evoke represents two abilities: a static ability that functions in any zone from which the card with evoke can be cast and a triggered ability that functions on the battlefield. “Evoke [cost]” means “You may cast this card by paying [cost] rather than paying its mana cost” and “When this permanent enters, if its evoke cost was paid, its controller sacrifices it.” Casting a spell for its evoke cost follows the rules for paying alternative costs in rules 601.2b and 601.2f– h.",
    "entryId": "702.74"
  },
  "hideaway": {
    "label": "Hideaway",
    "definition": "Hideaway is a triggered ability. “Hideaway N” means “When this permanent enters, look at the top N cards of your library. Exile one of them face down and put the rest on the bottom of your library in a random order. The exiled card gains ‘The player who controls the permanent that exiled this card may look at this card in the exile zone.’” Previously, the rules for the hideaway ability caused the permanent to enter the battlefield tapped, and the number of cards the player looked at was fixed at four. Cards printed before this rules change had the printed text “Hideaway” with no numeral after the word. Those older cards have received errata in the Oracle card reference to have “Hideaway 4” and the additional ability “[This permanent] enters tapped.”",
    "entryId": "702.75"
  },
  "prowl": {
    "label": "Prowl",
    "definition": "Prowl is a static ability that functions on the stack. “Prowl [cost]” means “You may pay [cost] rather than pay this spell’s mana cost if a player was dealt combat damage this turn by a source that, at the time it dealt that damage, was under your control and had any of this spell’s creature types.” Casting a spell for its prowl cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.76"
  },
  "reinforce": {
    "label": "Reinforce",
    "definition": "Reinforce is an activated ability that functions only while the card with reinforce is in a player’s hand. “Reinforce N—[cost]” means “[Cost], Discard this card: Put N +1/+1 counters on target creature.” Although the reinforce ability can be activated only if the card is in a player’s hand, it continues to exist while the object is on the battlefield and in all other zones. Therefore objects with reinforce will be affected by effects that depend on objects having one or more activated abilities.",
    "entryId": "702.77"
  },
  "conspire": {
    "label": "Conspire",
    "definition": "Conspire is a keyword that represents two abilities. The first is a static ability that functions while the spell with conspire is on the stack. The second is a triggered ability that functions while the spell with conspire is on the stack. “Conspire” means “As an additional cost to cast this spell, you may tap two untapped creatures you control that each share a color with it” and “When you cast this spell, if its conspire cost was paid, copy it. If the spell has any targets, you may choose new targets for the copy.” Paying a spell’s conspire cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. If a spell has multiple instances of conspire, each is paid separately and triggers based on its own payment, not any other instance of conspire.",
    "entryId": "702.78"
  },
  "persist": {
    "label": "Persist",
    "definition": "Persist is a triggered ability. “Persist” means “When this permanent is put into a graveyard from the battlefield, if it had no -1/-1 counters on it, return it to the battlefield under its owner’s control with a -1/-1 counter on it.”",
    "entryId": "702.79"
  },
  "wither": {
    "label": "Wither",
    "definition": "Wither is a static ability. Damage dealt to a creature by a source with wither isn’t marked on that creature. Rather, it causes that source’s controller to put that many -1/-1 counters on that creature. See rule 120.3. If an object is no longer in the zone it’s expected to be in as an effect causes it to deal damage, its last known information is used to determine whether it had wither.",
    "entryId": "702.80"
  },
  "retrace": {
    "label": "Retrace",
    "definition": "Retrace is a static ability that functions while the card with retrace is in a player’s graveyard. “Retrace” means “You may cast this card from your graveyard by discarding a land card as an additional cost to cast it.” Casting a spell using its retrace ability follows the rules for paying additional costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.81"
  },
  "devour": {
    "label": "Devour",
    "definition": "Devour is a static ability. “Devour N” means “As this object enters, you may sacrifice any number of creatures. This permanent enters with N +1/+1 counters on it for each creature sacrificed this way.” Some objects have abilities that refer to the number of creatures the permanent devoured. “It devoured” means “sacrificed as a result of its devour ability as it entered the battlefield.”",
    "entryId": "702.82"
  },
  "exalted": {
    "label": "Exalted",
    "definition": "Exalted is a triggered ability. “Exalted” means “Whenever a creature you control attacks alone, that creature gets +1/+1 until end of turn.” A creature “attacks alone” if it’s the only creature declared as an attacker in a given combat phase. See rule 506.5.",
    "entryId": "702.83"
  },
  "unearth": {
    "label": "Unearth",
    "definition": "Unearth is an activated ability that functions while the card with unearth is in a graveyard. “Unearth [cost]” means “[Cost]: Return this card from your graveyard to the battlefield. It gains haste. Exile it at the beginning of the next end step. If it would leave the battlefield, exile it instead of putting it anywhere else. Activate only as a sorcery.”",
    "entryId": "702.84"
  },
  "cascade": {
    "label": "Cascade",
    "definition": "Cascade is a triggered ability that functions only while the spell with cascade is on the stack. “Cascade” means “When you cast this spell, exile cards from the top of your library until you exile a nonland card whose mana value is less than this spell’s mana value. You may cast that card without paying its mana cost if the resulting spell’s mana value is less than this spell’s mana value. Then put all cards exiled this way that weren’t cast on the bottom of your library in a random order.” If an effect allows a player to take an action with one or more of the exiled cards “as you cascade,” the player may take that action after they have finished exiling cards due to the cascade ability. This action is taken before choosing whether to cast the last exiled card or, if no appropriate card was exiled, before putting the exiled cards on the bottom of their library in a random order.",
    "entryId": "702.85"
  },
  "annihilator": {
    "label": "Annihilator",
    "definition": "Annihilator is a triggered ability. “Annihilator N” means “Whenever this creature attacks, defending player sacrifices N permanents.” If a creature has multiple instances of annihilator, each triggers separately.",
    "entryId": "702.86"
  },
  "level up": {
    "label": "Level Up",
    "definition": "Level up is an activated ability. “Level up [cost]” means “[Cost]: Put a level counter on this permanent. Activate only as a sorcery.” Each card printed with a level up ability is known as a leveler card. It has a nonstandard layout and includes two level symbols that are themselves keyword abilities. See rule 711, “Leveler Cards.”",
    "entryId": "702.87"
  },
  "rebound": {
    "label": "Rebound",
    "definition": "Rebound appears on some instants and sorceries. It represents a static ability that functions while the spell is on the stack and may create a delayed triggered ability. “Rebound” means “If this spell was cast from your hand, instead of putting it into your graveyard as it resolves, exile it and, at the beginning of your next upkeep, you may cast this card from exile without paying its mana cost.” Casting a spell as an effect of its rebound ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.88"
  },
  "umbra armor": {
    "label": "Umbra armor",
    "definition": "Umbra armor is a static ability that appears on some Auras. “Umbra armor” means “If enchanted permanent would be destroyed, instead remove all damage marked on it and destroy this Aura.” Some older cards were printed with the ability “totem armor” or referenced that ability. The text of these cards has been updated in the Oracle card reference to refer to umbra armor instead.",
    "entryId": "702.89"
  },
  "infect": {
    "label": "Infect",
    "definition": "Infect is a static ability. Damage dealt to a player by a source with infect doesn’t cause that player to lose life. Rather, it causes that source’s controller to give the player that many poison counters. See rule 120.3.",
    "entryId": "702.90"
  },
  "battle cry": {
    "label": "Battle Cry",
    "definition": "Battle cry is a triggered ability. “Battle cry” means “Whenever this creature attacks, each other attacking creature gets +1/+0 until end of turn.” If a creature has multiple instances of battle cry, each triggers separately.",
    "entryId": "702.91"
  },
  "living weapon": {
    "label": "Living weapon",
    "definition": "Living weapon is a triggered ability. “Living weapon” means “When this Equipment enters, create a 0/0 black Phyrexian Germ creature token, then attach this Equipment to it.”",
    "entryId": "702.92"
  },
  "undying": {
    "label": "Undying",
    "definition": "Undying is a triggered ability. “Undying” means “When this permanent is put into a graveyard from the battlefield, if it had no +1/+1 counters on it, return it to the battlefield under its owner’s control with a +1/+1 counter on it.”",
    "entryId": "702.93"
  },
  "miracle": {
    "label": "Miracle",
    "definition": "Miracle is a static ability linked to a triggered ability. (See rule 603.11.) “Miracle [cost]” means “You may reveal this card from your hand as you draw it if it’s the first card you’ve drawn this turn. When you reveal this card this way, you may cast it by paying [cost] rather than its mana cost.” If a player chooses to reveal a card using its miracle ability, they play with that card revealed until that card leaves their hand, that ability resolves, or that ability otherwise leaves the stack. (See rule 701.20a.)",
    "entryId": "702.94"
  },
  "soulbond": {
    "label": "Soulbond",
    "definition": "Soulbond is a keyword that represents two triggered abilities. “Soulbond” means “When this creature enters, if you control both this creature and another creature and both are unpaired, you may pair this creature with another unpaired creature you control for as long as both remain creatures on the battlefield under your control” and “Whenever another creature you control enters, if you control both that creature and this one and both are unpaired, you may pair that creature with this creature for as long as both remain creatures on the battlefield under your control.” A creature becomes “paired” with another as the result of a soulbond ability. Abilities may refer to a paired creature, the creature another creature is paired with, or whether a creature is paired. An “unpaired” creature is one that is not paired.",
    "entryId": "702.95"
  },
  "overload": {
    "label": "Overload",
    "definition": "Overload is a keyword that represents two static abilities that function while the spell with overload is on the stack. Overload [cost] means “You may choose to pay [cost] rather than pay this spell’s mana cost” and “If you chose to pay this spell’s overload cost, change its text by replacing all instances of the word ‘target’ with the word ‘each.’” Casting a spell using its overload ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. If a player chooses to pay the overload cost of a spell, that spell won’t require any targets. It may affect objects that couldn’t be chosen as legal targets if the spell were cast without its overload cost being paid.",
    "entryId": "702.96"
  },
  "scavenge": {
    "label": "Scavenge",
    "definition": "Scavenge is an activated ability that functions only while the card with scavenge is in a graveyard. “Scavenge [cost]” means “[Cost], Exile this card from your graveyard: Put a number of +1/+1 counters equal to the power of the card you exiled on target creature. Activate only as a sorcery.”",
    "entryId": "702.97"
  },
  "unleash": {
    "label": "Unleash",
    "definition": "Unleash is a keyword that represents two static abilities. “Unleash” means “You may have this permanent enter with an additional +1/+1 counter on it” and “This permanent can’t block as long as it has a +1/+1 counter on it.”",
    "entryId": "702.98"
  },
  "cipher": {
    "label": "Cipher",
    "definition": "Cipher appears on some instants and sorceries. It represents two abilities. The first is a spell ability that functions while the spell with cipher is on the stack. The second is a static ability that functions while the card with cipher is in the exile zone. “Cipher” means “If this spell is represented by a card, you may exile this card encoded on a creature you control” and “For as long as this card is encoded on that creature, that creature has ‘Whenever this creature deals combat damage to a player, you may copy the encoded card and you may cast the copy without paying its mana cost.’” The term “encoded” describes the relationship between the card with cipher while in the exile zone and the creature chosen when the spell represented by that card resolves.",
    "entryId": "702.99"
  },
  "evolve": {
    "label": "Evolve",
    "definition": "Evolve is a triggered ability. “Evolve” means “Whenever a creature you control enters, if that creature’s power is greater than this creature’s power and/or that creature’s toughness is greater than this creature’s toughness, put a +1/+1 counter on this creature.” A creature “evolves” when one or more +1/+1 counters are put on it as a result of its evolve ability resolving.",
    "entryId": "702.100"
  },
  "extort": {
    "label": "Extort",
    "definition": "Extort is a triggered ability. “Extort” means “Whenever you cast a spell, you may pay {W/B}. If you do, each opponent loses 1 life and you gain life equal to the total life lost this way.” If a permanent has multiple instances of extort, each triggers separately.",
    "entryId": "702.101"
  },
  "fuse": {
    "label": "Fuse",
    "definition": "Fuse is a static ability found on some split cards (see rule 709, “Split Cards”) that applies while the card with fuse is in a player’s hand. If a player casts a split card with fuse from their hand, the player may choose to cast both halves of that split card rather than choose one half. This choice is made before putting the split card with fuse onto the stack. The resulting spell is a fused split spell. A fused split spell has the combined characteristics of its two halves. (See rule 709.4.)",
    "entryId": "702.102"
  },
  "bestow": {
    "label": "Bestow",
    "definition": "Bestow represents a static ability that functions in any zone from which you could play the card it’s on. “Bestow [cost]” means “As you cast this spell, you may choose to cast it bestowed. If you do, you pay [cost] rather than its mana cost.” Casting a spell using its bestow ability follows the rules for paying alternative costs (see 601.2b and 601.2f–h). As a spell cast bestowed is put onto the stack, it becomes an Aura enchantment and gains enchant creature. It is a bestowed Aura spell, and the permanent it becomes as it resolves will be a bestowed Aura. These effects last until the spell or the permanent it becomes ceases to be bestowed (see rules 702.103e–g). Because the spell is an Aura spell, its controller must choose a legal target for that spell as defined by its enchant creature ability and rule 601.2c. See also rule 303.4.",
    "entryId": "702.103"
  },
  "tribute": {
    "label": "Tribute",
    "definition": "Tribute is a static ability that functions as the creature with tribute is entering the battlefield. “Tribute N” means “As this creature enters, choose an opponent. That player may put an additional N +1/+1 counters on it as it enters.” Objects with tribute have triggered abilities that check “if tribute wasn’t paid.” This condition is true if the opponent chosen as a result of the tribute ability didn’t have the creature enter the battlefield with +1/+1 counters as specified by the creature’s tribute ability.",
    "entryId": "702.104"
  },
  "dethrone": {
    "label": "Dethrone",
    "definition": "Dethrone is a triggered ability. “Dethrone” means “Whenever this creature attacks the player with the most life or tied for most life, put a +1/+1 counter on this creature.” If a creature has multiple instances of dethrone, each triggers separately.",
    "entryId": "702.105"
  },
  "hidden agenda": {
    "label": "Hidden agenda",
    "definition": "Hidden agenda is a static ability that functions as a conspiracy card with hidden agenda is put into the command zone. “Hidden agenda” means “As you put this conspiracy card into the command zone, turn it face down and secretly choose a card name.” To secretly choose a card name, note that name on a piece of paper kept with the face- down conspiracy card.",
    "entryId": "702.106"
  },
  "outlast": {
    "label": "Outlast",
    "definition": "Outlast is an activated ability. “Outlast [cost]” means “[Cost], {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery.”",
    "entryId": "702.107"
  },
  "prowess": {
    "label": "Prowess",
    "definition": "Prowess is a triggered ability. “Prowess” means “Whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn.” If a creature has multiple instances of prowess, each triggers separately.",
    "entryId": "702.108"
  },
  "dash": {
    "label": "Dash",
    "definition": "Dash represents three abilities: two static abilities that function while the card with dash is on the stack, one of which may create a delayed triggered ability, and a static ability that functions while the object with dash is on the battlefield. “Dash [cost]” means “You may cast this card by paying [cost] rather than its mana cost,” “If this spell’s dash cost was paid, return the permanent this spell becomes to its owner’s hand at the beginning of the next end step,” and “As long as this permanent’s dash cost was paid, it has haste.” Casting a spell for its dash cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.109"
  },
  "exploit": {
    "label": "Exploit",
    "definition": "Exploit is a triggered ability. “Exploit” means “When this creature enters, you may sacrifice a creature.” A creature with exploit “exploits a creature” when the controller of the exploit ability sacrifices a creature as that ability resolves.",
    "entryId": "702.110"
  },
  "menace": {
    "label": "Menace",
    "definition": "Menace is an evasion ability. A creature with menace can’t be blocked except by two or more creatures. (See rule 509, “Declare Blockers Step.”)",
    "entryId": "702.111"
  },
  "renown": {
    "label": "Renown",
    "definition": "Renown is a triggered ability. “Renown N” means “When this creature deals combat damage to a player, if it isn’t renowned, put N +1/+1 counters on it and it becomes renowned.” Renowned is a designation that has no rules meaning other than to act as a marker that the renown ability and other spells and abilities can identify. Only permanents can be or become renowned. Once a permanent becomes renowned, it stays renowned until it leaves the battlefield. Renowned is neither an ability nor part of the permanent’s copiable values.",
    "entryId": "702.112"
  },
  "awaken": {
    "label": "Awaken",
    "definition": "Awaken appears on some instants and sorceries. It represents two abilities: a static ability that functions while the spell with awaken is on the stack and a spell ability. “Awaken N— [cost]” means “You may pay [cost] rather than pay this spell’s mana cost as you cast this spell” and “If this spell’s awaken cost was paid, put N +1/+1 counters on target land you control. That land becomes a 0/0 Elemental creature with haste. It’s still a land.” Casting a spell using its awaken ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. The controller of a spell with awaken chooses the target of the awaken spell ability only if that player chose to pay the spell’s awaken cost. Otherwise the spell is cast as if it didn’t have that target.",
    "entryId": "702.113"
  },
  "devoid": {
    "label": "Devoid",
    "definition": "Devoid is a characteristic-defining ability. “Devoid” means “This object is colorless.” This ability functions everywhere, even outside the game. See rule 604.3.",
    "entryId": "702.114"
  },
  "ingest": {
    "label": "Ingest",
    "definition": "Ingest is a triggered ability. “Ingest” means “Whenever this creature deals combat damage to a player, that player exiles the top card of their library.” If a creature has multiple instances of ingest, each triggers separately.",
    "entryId": "702.115"
  },
  "myriad": {
    "label": "Myriad",
    "definition": "Myriad is a triggered ability that may also create a delayed triggered ability. “Myriad” means “Whenever this creature attacks, for each opponent other than defending player, you may create a token that’s a copy of this creature that’s tapped and attacking that player or a planeswalker they control. If one or more tokens are created this way, exile the tokens at end of combat.” If a creature has multiple instances of myriad, each triggers separately.",
    "entryId": "702.116"
  },
  "surge": {
    "label": "Surge",
    "definition": "Surge is a static ability that functions while the spell with surge is on the stack. “Surge [cost]” means “You may pay [cost] rather than pay this spell’s mana cost as you cast this spell if you or one of your teammates has cast another spell this turn.” Casting a spell for its surge cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.117"
  },
  "skulk": {
    "label": "Skulk",
    "definition": "Skulk is an evasion ability. A creature with skulk can’t be blocked by creatures with greater power. (See rule 509, “Declare Blockers Step.”)",
    "entryId": "702.118"
  },
  "emerge": {
    "label": "Emerge",
    "definition": "Emerge represents two static abilities that function while the spell with emerge is on the stack. “Emerge [cost]” means “You may cast this spell by paying [cost] and sacrificing a creature rather than paying its mana cost” and “If you chose to pay this spell’s emerge cost, its total cost is reduced by an amount of generic mana equal to the sacrificed creature’s mana value.” Casting a spell using its emerge ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. Emerge from [quality] is a variant of emerge. “Emerge from [quality] [cost]” means “You may cast this spell by paying [cost] and sacrificing a [quality] permanent rather than paying its mana cost” and “If you pay this spell’s emerge cost, its total cost is reduced by an amount of generic mana equal to the sacrificed permanent’s mana value.”",
    "entryId": "702.119"
  },
  "escalate": {
    "label": "Escalate",
    "definition": "Escalate is a static ability of modal spells (see rule 700.2) that functions while the spell with escalate is on the stack. “Escalate [cost]” means “For each mode you choose beyond the first as you cast this spell, you pay an additional [cost].” Paying a spell’s escalate cost follows the rules for paying additional costs in rules 601.2f–h.",
    "entryId": "702.120"
  },
  "melee": {
    "label": "Melee",
    "definition": "Melee is a triggered ability. “Melee” means “Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked with a creature this combat.” If a creature has multiple instances of melee, each triggers separately.",
    "entryId": "702.121"
  },
  "crew": {
    "label": "Crew",
    "definition": "Crew is an activated ability of Vehicle cards. “Crew N” means “Tap any number of other untapped creatures you control with total power N or greater: This permanent becomes an artifact creature until end of turn.” A creature “crews a Vehicle” when it’s tapped to pay the cost to activate a Vehicle’s crew ability.",
    "entryId": "702.122"
  },
  "fabricate": {
    "label": "Fabricate",
    "definition": "Fabricate is a triggered ability. “Fabricate N” means “When this permanent enters, you may put N +1/+1 counters on it. If you don’t, create N 1/1 colorless Servo artifact creature tokens.” If a permanent has multiple instances of fabricate, each triggers separately.",
    "entryId": "702.123"
  },
  "partner": {
    "label": "Partner",
    "definition": "Partner abilities are keyword abilities that modify the rules for deck construction in the Commander variant (see rule 903), and they function before the game begins. Each partner ability allows you to designate two legendary cards as your commander rather than one. Each partner ability has its own requirements for those two commanders. The partner abilities are: partner, partner—[text], partner with [name], choose a Background, and Doctor’s companion. Your deck must contain exactly 100 cards, including its two commanders. Both commanders begin the game in the command zone.",
    "entryId": "702.124"
  },
  "undaunted": {
    "label": "Undaunted",
    "definition": "Undaunted is a static ability that functions while the spell with undaunted is on the stack. Undaunted means “This spell costs {1} less to cast for each opponent you have.” Players who have left the game are not counted when determining how many opponents you have.",
    "entryId": "702.125"
  },
  "improvise": {
    "label": "Improvise",
    "definition": "Improvise is a static ability that functions while the spell with improvise is on the stack. “Improvise” means “For each generic mana in this spell’s total cost, you may tap an untapped artifact you control rather than pay that mana.” The improvise ability isn’t an additional or alternative cost and applies only after the total cost of the spell with improvise is determined.",
    "entryId": "702.126"
  },
  "aftermath": {
    "label": "Aftermath",
    "definition": "Aftermath is an ability found on some split cards (see rule 709, “Split Cards”). It represents three static abilities. “Aftermath” means “You may cast this half of this split card from your graveyard,” “This half of this split card can’t be cast from any zone other than a graveyard,” and “If this spell was cast from a graveyard, exile it instead of putting it anywhere else any time it would leave the stack.”",
    "entryId": "702.127"
  },
  "embalm": {
    "label": "Embalm",
    "definition": "Embalm is an activated ability that functions while the card with embalm is in a graveyard. “Embalm [cost]” means “[Cost], Exile this card from your graveyard: Create a token that’s a copy of this card, except it’s white, it has no mana cost, and it’s a Zombie in addition to its other types. Activate only as a sorcery.” A token is “embalmed” if it’s created by a resolving embalm ability.",
    "entryId": "702.128"
  },
  "eternalize": {
    "label": "Eternalize",
    "definition": "Eternalize is an activated ability that functions while the card with eternalize is in a graveyard. “Eternalize [cost]” means “[Cost], Exile this card from your graveyard: Create a token that’s a copy of this card, except it’s black, it’s 4/4, it has no mana cost, and it’s a Zombie in addition to its other types. Activate only as a sorcery.”",
    "entryId": "702.129"
  },
  "afflict": {
    "label": "Afflict",
    "definition": "Afflict is a triggered ability. “Afflict N” means “Whenever this creature becomes blocked, defending player loses N life.” If a creature has multiple instances of afflict, each triggers separately.",
    "entryId": "702.130"
  },
  "ascend": {
    "label": "Ascend",
    "definition": "Ascend on an instant or sorcery spell represents a spell ability. It means “If you control ten or more permanents and you don’t have the city’s blessing, you get the city’s blessing for the rest of the game.” Ascend on a permanent represents a static ability. It means “Any time you control ten or more permanents and you don’t have the city’s blessing, you get the city’s blessing for the rest of the game.”",
    "entryId": "702.131"
  },
  "assist": {
    "label": "Assist",
    "definition": "Assist is a static ability that modifies the rules of paying for the spell with assist (see rules 601.2g-h). If the total cost to cast a spell with assist includes a generic mana component, before you activate mana abilities while casting it, you may choose another player. That player has a chance to activate mana abilities. Once that player chooses not to activate any more mana abilities, you have a chance to activate mana abilities. Before you begin to pay the total cost of the spell, the player you chose may pay for any amount of the generic mana in the spell’s total cost.",
    "entryId": "702.132"
  },
  "jump-start": {
    "label": "Jump-start",
    "definition": "Jump-start appears on some instants and sorceries. It represents two static abilities: one that functions while the card is in a player’s graveyard and another that functions while the card is on the stack. “Jump-start” means “You may cast this card from your graveyard if the resulting spell is an instant or sorcery spell by discarding a card as an additional cost to cast it” and “If this spell was cast using its jump-start ability, exile this card instead of putting it anywhere else any time it would leave the stack.” Casting a spell using its jump-start ability follows the rules for paying additional costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.133"
  },
  "mentor": {
    "label": "Mentor",
    "definition": "Mentor is a triggered ability. “Mentor” means “Whenever this creature attacks, put a +1/+1 counter on target attacking creature with power less than this creature’s power.” If a creature has multiple instances of mentor, each triggers separately.",
    "entryId": "702.134"
  },
  "afterlife": {
    "label": "Afterlife",
    "definition": "Afterlife is a triggered ability. “Afterlife N” means “When this permanent is put into a graveyard from the battlefield, create N 1/1 white and black Spirit creature tokens with flying.” If a permanent has multiple instances of afterlife, each triggers separately.",
    "entryId": "702.135"
  },
  "riot": {
    "label": "Riot",
    "definition": "Riot is a static ability. “Riot” means “You may have this permanent enter with an additional +1/+1 counter on it. If you don’t, it gains haste.” If a permanent has multiple instances of riot, each works separately.",
    "entryId": "702.136"
  },
  "spectacle": {
    "label": "Spectacle",
    "definition": "Spectacle is a static ability that functions on the stack. “Spectacle [cost]” means “You may pay [cost] rather than pay this spell’s mana cost if an opponent lost life this turn.” Casting a spell for its spectacle cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.137"
  },
  "escape": {
    "label": "Escape",
    "definition": "Escape represents a static ability that functions while the card with escape is in a player’s graveyard. “Escape [cost]” means “You may cast this card from your graveyard by paying [cost] rather than paying its mana cost.” Casting a spell using its escape ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. A spell or permanent “escaped” if that spell or the spell that became that permanent as it resolved was cast from a graveyard with an escape ability.",
    "entryId": "702.138"
  },
  "companion": {
    "label": "Companion",
    "definition": "Companion is a keyword ability that functions outside the game. It’s written as “Companion—[Condition].” Before the game begins, you may reveal one card you own from outside the game with a companion ability whose condition is fulfilled by your starting deck. (See rule 103.2b.) Once during the game, any time you have priority and the stack is empty, but only during a main phase of your turn, you may pay {3} and put that card into your hand. This is a special action that doesn’t use the stack (see rule 116.2g). This is a change from previous rules. If a companion ability refers to your starting deck, it refers to your deck after you’ve set aside any sideboard cards. In a Commander game, this is also before you’ve set aside your commander.",
    "entryId": "702.139"
  },
  "mutate": {
    "label": "Mutate",
    "definition": "Mutate appears on some creature cards. It represents a static ability that functions while the spell with mutate is on the stack. “Mutate [cost]” means “You may pay [cost] rather than pay this spell’s mana cost. If you do, it becomes a mutating creature spell and targets a non- Human creature with the same owner as this spell.” Casting a spell using its mutate ability follows the rules for paying alternative costs (see 601.2b and 601.2f–h). As a mutating creature spell begins resolving, if its target is illegal, it ceases to be a mutating creature spell and continues resolving as a creature spell and will be put onto the battlefield under the control of the spell’s controller.",
    "entryId": "702.140"
  },
  "encore": {
    "label": "Encore",
    "definition": "Encore is an activated ability that functions while the card with encore is in a graveyard. “Encore [cost]” means “[Cost], Exile this card from your graveyard: For each opponent, create a token that’s a copy of this card that attacks that opponent this turn if able. The tokens gain haste. Sacrifice them at the beginning of the next end step. Activate only as a sorcery.”",
    "entryId": "702.141"
  },
  "boast": {
    "label": "Boast",
    "definition": "Boast is a keyword that adds additional rules to the activated ability that follows it. “Boast — [Cost]: [Effect]” means “[Cost]: [Effect]. Activate only if this creature attacked this turn and only once each turn.” Effects may refer to boast abilities. If an effect refers to a creature boasting, it means its boast ability being activated.",
    "entryId": "702.142"
  },
  "foretell": {
    "label": "Foretell",
    "definition": "Foretell is a keyword that functions while the card with foretell is in a player’s hand. Any time a player has priority during their turn, that player may pay {2} and exile a card with foretell from their hand face down. That player may look at that card as long as it remains in exile. They may cast that card after the current turn has ended by paying any foretell cost it has rather than paying that spell’s mana cost. Casting a spell this way follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. Exiling a card using its foretell ability is a special action, which doesn’t use the stack. See rule 116, “Special Actions.”",
    "entryId": "702.143"
  },
  "demonstrate": {
    "label": "Demonstrate",
    "definition": "Demonstrate is a triggered ability. “Demonstrate” means “When you cast this spell, you may copy it and you may choose new targets for the copy. If you copy the spell, choose an opponent. That player copies the spell and may choose new targets for that copy.”",
    "entryId": "702.144"
  },
  "disturb": {
    "label": "Disturb",
    "definition": "Disturb is an ability found on the front face of some double-faced cards (see rule 712, “Double-Faced Cards”). “Disturb [cost]” means “You may cast this card transformed from your graveyard by paying [cost] rather than its mana cost.” See rule 712.8c. A resolving double-faced spell that was cast using its disturb ability enters the battlefield with its back face up.",
    "entryId": "702.146"
  },
  "decayed": {
    "label": "Decayed",
    "definition": "Decayed represents a static ability and a triggered ability. “Decayed” means “This creature can’t block” and “When this creature attacks, sacrifice it at end of combat.”",
    "entryId": "702.147"
  },
  "cleave": {
    "label": "Cleave",
    "definition": "Cleave is a keyword that represents two static abilities that function while a spell with cleave is on the stack. “Cleave [cost]” means “You may cast this spell by paying [cost] rather than paying its mana cost” and “If this spell’s cleave cost was paid, change its text by removing all text found within square brackets in the spell’s rules text.” Casting a spell for its cleave cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. Cleave’s second ability is a text-changing effect. See rule 612, “Text-Changing Effects.”",
    "entryId": "702.148"
  },
  "training": {
    "label": "Training",
    "definition": "Training is a triggered ability. “Training” means “Whenever this creature and at least one other creature with power greater than this creature’s power attack, put a +1/+1 counter on this creature.” If a creature has multiple instances of training, each triggers separately.",
    "entryId": "702.149"
  },
  "compleated": {
    "label": "Compleated",
    "definition": "Compleated is a static ability found on some planeswalker cards. Compleated means “If this permanent would enter with one or more loyalty counters on it and the player who cast it chose to pay life for any part of its cost represented by Phyrexian mana symbols, it instead enters the battlefield with that many loyalty counters minus two for each of those mana symbols.”",
    "entryId": "702.150"
  },
  "reconfigure": {
    "label": "Reconfigure",
    "definition": "Reconfigure represents two activated abilities. Reconfigure [cost] means “[Cost]: Attach this permanent to another target creature you control. Activate only as a sorcery” and “[Cost]: Unattach this permanent. Activate only if this permanent is attached to a creature and only as a sorcery.” Attaching an Equipment with reconfigure to another creature causes the Equipment to stop being a creature until it becomes unattached from that creature.",
    "entryId": "702.151"
  },
  "blitz": {
    "label": "Blitz",
    "definition": "Blitz represents three abilities: two static abilities that function while the card with blitz is on the stack, one of which may create a delayed triggered ability, and a static ability that functions while the object with blitz is on the battlefield. “Blitz [cost]” means “You may cast this card by paying [cost] rather than its mana cost,” “If this spell’s blitz cost was paid, sacrifice the permanent this spell becomes at the beginning of the next end step,” and “As long as this permanent’s blitz cost was paid, it has haste and ‘When this permanent is put into a graveyard from the battlefield, draw a card.’” Casting a spell for its blitz cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. If a spell has multiple instances of blitz, only one may be used to cast that spell. If a permanent has multiple instances of blitz, each one refers only to payments made for that blitz ability as the spell was cast, not to any payments made for other instances of blitz.",
    "entryId": "702.152"
  },
  "casualty": {
    "label": "Casualty",
    "definition": "Casualty is a keyword that represents two abilities. The first is a static ability that functions while the spell with casualty is on the stack. The second is a triggered ability that functions while the spell with casualty is on the stack. Casualty N means “As an additional cost to cast this spell, you may sacrifice a creature with power N or greater,” and “When you cast this spell, if a casualty cost was paid for it, copy it. If the spell has any targets, you may choose new targets for the copy.” Paying a spell’s casualty cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. If a spell has multiple instances of casualty, each is paid separately and triggers based on the payments made for it, not any other instance of casualty.",
    "entryId": "702.153"
  },
  "enlist": {
    "label": "Enlist",
    "definition": "Enlist represents a static ability and a triggered ability. Enlist means “As this creature attacks, you may tap up to one untapped creature you control that you didn’t choose to attack with and that either has haste or has been under your control continuously since this turn began. When you do, this creature gets +X/+0 until end of turn, where X is the tapped creature’s power.” Enlist’s static ability represents an optional cost to attack (see rule 508.1g). Its triggered ability is linked to that static ability (see rule 607.2h).",
    "entryId": "702.154"
  },
  "read ahead": {
    "label": "Read Ahead",
    "definition": "Read ahead is a keyword found on some Saga cards. “Read ahead” means “Chapter abilities of this Saga can’t trigger the turn it entered the battlefield unless it has exactly the number of lore counters on it specified in the chapter symbol of that ability.” See rule 714, “Saga Cards.” Each Saga with read ahead has the intrinsic abilities “As this Saga enters, choose a number between one and this Saga’s final chapter number” and “This Saga enters with the chosen number of lore counters on it.” See rule 714.3b.",
    "entryId": "702.155"
  },
  "ravenous": {
    "label": "Ravenous",
    "definition": "Ravenous is a keyword found on some creature cards with {X} in their mana cost. Ravenous represents both a replacement effect and a triggered ability. “Ravenous” means “This permanent enters with X +1/+1 counters on it” and “When this permanent enters, if X is 5 or more, draw a card.” See rule 107.3m.",
    "entryId": "702.156"
  },
  "squad": {
    "label": "Squad",
    "definition": "Squad is a keyword that represents two linked abilities. The first is a static ability that functions while the creature spell with squad is on the stack. The second is a triggered ability that functions when the creature with squad enters the battlefield. “Squad [cost]” means “As an additional cost to cast this spell, you may pay [cost] any number of times” and “When this creature enters, if its squad cost was paid, create a token that’s a copy of it for each time its squad cost was paid.” Paying a spell’s squad cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. If a spell has multiple instances of squad, each is paid separately. If a permanent has multiple instances of squad, each triggers based on the payments made for that squad ability as it was cast, not based on payments for any other instance of squad.",
    "entryId": "702.157"
  },
  "prototype": {
    "label": "Prototype",
    "definition": "Prototype is a static ability that appears on prototype cards that have a secondary set of power, toughness, and mana cost characteristics. A player who casts a spell with prototype can choose to cast that card “prototyped.” If they do, the alternative set of its power, toughness, and mana cost characteristics are used. See 718, “Prototype Cards.”",
    "entryId": "702.160"
  },
  "living metal": {
    "label": "Living metal",
    "definition": "Living metal is a keyword ability found on some Vehicles. “Living metal” means “During your turn, this permanent is an artifact creature in addition to its other types.”",
    "entryId": "702.161"
  },
  "more than meets the eye": {
    "label": "More Than Meets the Eye",
    "definition": "More Than Meets the Eye represents a static ability that functions in any zone from which the spell may be cast. “More Than Meets the Eye [cost]” means “You may cast this card converted by paying [cost] rather than its mana cost.” Casting a spell using its More Than Meets the Eye ability follows the rules for paying alternative costs (see 601.2b and 601.2f–h). See rule 701.28, “Convert.”",
    "entryId": "702.162"
  },
  "for mirrodin!": {
    "label": "For Mirrodin!",
    "definition": "For Mirrodin! is a triggered ability. “For Mirrodin!” means “When this Equipment enters, create a 2/2 red Rebel creature token, then attach this Equipment to it.”",
    "entryId": "702.163"
  },
  "toxic": {
    "label": "Toxic",
    "definition": "Toxic is a static ability. It is written “toxic N,” where N is a number. Some rules and effects refer to a creature’s “total toxic value.” A creature’s total toxic value is the sum of all N values of toxic abilities that creature has. Example: If a creature with toxic 2 gains toxic 1 due to another effect, its total toxic value is 3.",
    "entryId": "702.164"
  },
  "backup": {
    "label": "Backup",
    "definition": "Backup is a triggered ability. “Backup N” means “When this creature enters, put N +1/+1 counters on target creature. If that’s another creature, it also gains the non-backup abilities of this creature printed below this one until end of turn.” Cards with backup have one or more abilities printed after the backup ability. (Some cards with backup also have abilities printed before the backup ability.) If a permanent enters the battlefield as a copy of a permanent with a backup ability or a token is created that is a copy of that permanent, the order of abilities printed on it is maintained.",
    "entryId": "702.165"
  },
  "bargain": {
    "label": "Bargain",
    "definition": "Bargain is a static ability that functions while the spell with bargain is on the stack. “Bargain” means “As an additional cost to cast this spell, you may sacrifice an artifact, enchantment, or token.” Paying a spell’s bargain cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. If a spell’s controller declares the intention to pay that spell’s bargain cost, that spell has been “bargained.” See rule 601.2b.",
    "entryId": "702.166"
  },
  "craft": {
    "label": "Craft",
    "definition": "Craft represents an activated ability. It is written as “Craft with [materials] [cost],” where [materials] is a description of one or more objects. It means “[Cost], Exile this permanent, Exile [materials] from among permanents you control and/or cards in your graveyard: Return this card to the battlefield transformed under its owner’s control. Activate only as a sorcery.” If an object in the [materials] of a craft ability is described using only a card type or subtype without the word “card,” it refers to either a permanent on the battlefield that is that type or subtype or a card in a graveyard that is that type or subtype. This is an exception to rule 109.2.",
    "entryId": "702.167"
  },
  "disguise": {
    "label": "Disguise",
    "definition": "Disguise is a static ability that functions in any zone from which you could play the card it’s on, and the disguise effect works any time the card is face down. “Disguise [cost]” means “You may cast this card as a 2/2 face-down creature with ward {2}, no name, no subtypes, and no mana cost by paying {3} rather than paying its mana cost.” (See rule 708, “Face-Down Spells and Permanents.”) To cast a card using its disguise ability, turn the card face down and announce that you are using a disguise ability. It becomes a 2/2 face-down creature card with ward {2}, no name, no subtypes, and no mana cost. Any effects or prohibitions that would apply to casting a card with these characteristics (and not the face-up card’s characteristics) are applied to casting this card. These values are the copiable values of that object’s characteristics. (See rule 613, “Interaction of Continuous Effects,” and rule 707, “Copying Objects.”) Put it onto the stack (as a face-down spell with the same characteristics), and pay {3} rather than pay its mana cost. This follows the rules for paying alternative costs. You can use a disguise ability to cast a card from any zone from which you could normally cast it. When the spell resolves, it enters the battlefield with the same characteristics the spell had. The disguise effect applies to the face-down object wherever it is, and it ends when the permanent is turned face up.",
    "entryId": "702.168"
  },
  "solved": {
    "label": "Solved",
    "definition": "Solved is a keyword ability found on Case cards. See rule 719, “Case Cards.” “Solved” is followed by ability text. Together, they represent a static ability, a triggered ability, or an activated ability. For a static ability, “Solved — [Ability text]” means “As long as this Case is solved, [ability text].”",
    "entryId": "702.169"
  },
  "plot": {
    "label": "Plot",
    "definition": "Plot is a keyword ability that functions while the card with plot is in a player’s hand. “Plot [cost]” means “Any time you have priority during your main phase while the stack is empty, you may exile this card from your hand and pay [cost]. It becomes a plotted card.” Exiling a card using its plot ability is a special action, which doesn’t use the stack. See rule 116, “Special Actions.”",
    "entryId": "702.170"
  },
  "saddle": {
    "label": "Saddle",
    "definition": "Saddle is an activated ability. “Saddle N” means “Tap any number of other untapped creatures you control with total power N or greater: This permanent becomes saddled until end of turn. Activate only as a sorcery.” Saddled is a designation that has no rules meaning other than to act as a marker that spells and abilities can identify. Only permanents can be or become saddled. Once a permanent has become saddled, it stays saddled until the end of the turn or it leaves the battlefield. Being saddled is not a part of the permanent’s copiable values.",
    "entryId": "702.171"
  },
  "spree": {
    "label": "Spree",
    "definition": "Spree is a static ability found on some modal spells (see rule 700.2) that applies while the spell on the stack. Spree means “Choose one or more modes. As an additional cost to cast this spell, pay the costs associated with those modes.” Cards with the spree ability have a plus sign icon in the upper right corner of the card, and use a plus sign (+) rather than traditional bullet points. These symbols are a visual reminder that this card requires an additional cost to be cast, and do not have additional rules meaning.",
    "entryId": "702.172"
  },
  "freerunning": {
    "label": "Freerunning",
    "definition": "Freerunning is a static ability that functions on the stack. “Freerunning [cost]” means “You may pay [cost] rather than pay this spell’s mana cost if a player was dealt combat damage this turn by a creature that, at the time it dealt that damage, was an Assassin creature or a commander under your control.” Casting a spell for its freerunning cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.173"
  },
  "gift": {
    "label": "Gift",
    "definition": "Gift is a keyword that represents two abilities. It is written “Gift a [something].” The first ability is a static ability that functions while the card with gift is on the stack, and the second is either an ability that functions while the card with gift is on the stack or a triggered ability that functions while the card with gift is on the battlefield. The first ability is always “As an additional cost to cast this spell, you may choose an opponent.” Paying a spell’s gift cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. The second ability depends on the [something] listed as well as whether the object with the ability is a permanent or an instant or sorcery spell. On a permanent, the second ability represented by gift is “When this permanent enters, if its gift cost was paid, [effect].” On an instant or sorcery spell, the second ability represented by gift is “If this spell’s gift cost was paid, [effect].” The specific effect is defined by the [something] listed.",
    "entryId": "702.174"
  },
  "offspring": {
    "label": "Offspring",
    "definition": "Offspring represents two abilities. “Offspring [cost]” means “You may pay an additional [cost] as you cast this spell” and “When this permanent enters, if its offspring cost was paid, create a token that’s a copy of it, except it’s 1/1.” If a spell has multiple instances of offspring, each is paid separately and triggers based on the payments made for it, not any other instances of offspring.",
    "entryId": "702.175"
  },
  "impending": {
    "label": "Impending",
    "definition": "Impending is a keyword that represents four abilities. The first is a static ability that functions while the spell with impending is on the stack. The second is static ability that creates a replacement effect that may apply to the permanent with impending as it enters the battlefield from the stack. The third is a static ability that functions on the battlefield. The fourth is a triggered ability that functions on the battlefield. “Impending N—[cost]” means “You may choose to pay [cost] rather than pay this spell’s mana cost,” “If you chose to pay this permanent’s impending cost, it enters with N time counters on it,” “As long as this permanent’s impending cost was paid and it has a time counter on it, it’s not a creature,” and “At the beginning of your end step, if this permanent’s impending cost was paid and it has a time counter on it, remove a time counter from it.” Casting a spell for its impending cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.176"
  },
  "exhaust": {
    "label": "Exhaust",
    "definition": "Exhaust is a keyword that adds additional rules to the activated ability that follows it. “Exhaust — [Cost]: [Effect]” means “[Cost]: [Effect]. Activate only once.” An effect may allow you to take an action as long as you haven’t activated an exhaust ability this turn. Such an effect allows that action only if you haven’t begun to activate an exhaust ability this turn. Example: Elvish Refueler has an exhaust ability that costs mana and also has an ability that reads “During your turn, as long as you haven’t activated an exhaust ability this turn, you may activate exhaust abilities as though they haven’t been activated.” Loot, the Pathfinder has an exhaust ability that is also a mana ability. If you’ve already activated both of these abilities in a previous turn, you can’t activate Loot’s mana ability during the process of activating Elvish Refueler’s exhaust ability, because you have already begun to activate a different exhaust ability.",
    "entryId": "702.177"
  },
  "max speed": {
    "label": "Max speed",
    "definition": "A max speed ability is a static ability. “Max speed — [Ability]” means “As long as your speed is 4, this object has ‘[Ability].’” See rule 702.179, “Start Your Engines!” If an ability granted by a max speed ability states which zones it functions from, the max speed ability that grants that ability functions from those zones. (See rule 113.6c.)",
    "entryId": "702.178"
  },
  "harmonize": {
    "label": "Harmonize",
    "definition": "Harmonize represents three static abilities: one that functions while the card is in a player’s graveyard and two that function while the spell with harmonize is on the stack. “Harmonize [cost]” means “You may cast this card from your graveyard by paying [cost] and tapping up to one untapped creature you control rather than paying this spell’s mana cost,” “If you cast this spell using its harmonize ability, its total cost is reduced by an amount of generic mana equal to the tapped creature’s power,” and “If the harmonize cost was paid, exile this card instead of putting it anywhere else any time it would leave the stack.” Casting a spell using its harmonize ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. You choose which creature to tap as you choose to pay a spell’s harmonize cost (see rule 601.2b), and then tap that creature as you pay the total cost.",
    "entryId": "702.180"
  },
  "mobilize": {
    "label": "Mobilize",
    "definition": "Mobilize is a triggered ability. “Mobilize N” means “Whenever this creature attacks, create N 1/1 red Warrior creature tokens. Those tokens enter tapped and attacking. Sacrifice them at the beginning of the next end step.”",
    "entryId": "702.181"
  },
  "job select": {
    "label": "Job select",
    "definition": "Job select is a triggered ability. “Job select” means “When this Equipment enters, create a 1/1 colorless Hero creature token, then attach this Equipment to it.”",
    "entryId": "702.182"
  },
  "tiered": {
    "label": "Tiered",
    "definition": "Tiered is a static ability found on some modal spells (see rule 700.2) that applies while the spell is on the stack. Tiered means “Choose one. As an additional cost to cast this spell, pay the cost associated with that mode.”",
    "entryId": "702.183"
  },
  "station": {
    "label": "Station",
    "definition": "Station is an activated ability. “Station” means “Tap another untapped creature you control: Put a number of charge counters on this permanent equal to the tapped creature’s power. Activate only as a sorcery.” Each card printed with a station ability is known as a station card. It has a nonstandard layout and includes station symbols that are themselves keyword abilities. See rule 721, “Station Cards.”",
    "entryId": "702.184"
  },
  "warp": {
    "label": "Warp",
    "definition": "Warp represents two static abilities that function while the card with warp is on the stack, one of which may create a delayed triggered ability. “Warp [cost]” means “You may cast this card from your hand by paying [cost] rather than its mana cost” and “If this spell’s warp cost was paid, exile the permanent this spell becomes at the beginning of the next end step. Its owner may cast this card after the current turn has ended for as long as it remains exiled.” Casting a spell for its warp cost follows the rules for paying alternative costs in rules 601.2b and 601.2f–h. Some effects refer to “warped” cards in exile. A warped card in exile is one that was exiled by the delayed triggered ability created by a warp ability.",
    "entryId": "702.185"
  },
  "mayhem": {
    "label": "Mayhem",
    "definition": "Mayhem is a static ability that functions while the card with mayhem is in a player’s graveyard. “Mayhem [cost]” means “As long as you discarded this card this turn, you may cast it from your graveyard by paying [cost] rather than paying its mana cost.” Casting a spell using its mayhem ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.187"
  },
  "web-slinging": {
    "label": "Web-slinging",
    "definition": "Web-slinging is a static ability that functions while the spell with web-slinging is on the stack. “Web-slinging [cost]” means “You may cast this spell by paying [cost] and returning a tapped creature you control to its owner’s hand rather than paying its mana cost.” Casting a spell using its web-slinging ability follows the rules for paying alternative costs in rules 601.2b and 601.2f–h.",
    "entryId": "702.188"
  },
  "firebending": {
    "label": "Firebending",
    "definition": "Firebending is a triggered ability. “Firebending N” means “Whenever this creature attacks, add N {R}. Until end of combat, you don’t lose this mana as steps and phases end.” An ability that triggers whenever a player firebends triggers whenever a firebending ability they control resolves.",
    "entryId": "702.189"
  },
  "sneak": {
    "label": "Sneak",
    "definition": "Sneak is a keyword that represents a static ability that functions while the spell with sneak is on the stack. “Sneak [cost]” means “Any time you could cast an instant during your declare blockers step, you may cast this spell by paying [cost] and returning an unblocked creature you control to its owner’s hand rather than paying this spell’s mana cost.” A permanent spell whose sneak cost was paid enters the battlefield tapped and attacking (see rule 506.3a). It will be attacking the same player, planeswalker, or battle as the creature that was returned to its owner’s hand to pay the sneak cost of the spell that became that permanent.",
    "entryId": "702.190"
  },
  "increment": {
    "label": "Increment",
    "definition": "Increment is a triggered ability. “Increment” means “Whenever you cast a spell, if this permanent is a creature and the amount of mana spent to cast that spell is greater than this creature’s power or this creature’s toughness, put a +1/+1 counter on this creature.” If a creature has multiple instances of increment, each one triggers separately.",
    "entryId": "702.191"
  },
  "paradigm": {
    "label": "Paradigm",
    "definition": "Paradigm represents two spell abilities, one of which creates a delayed triggered ability. Paradigm means “If this is the first time a spell you control with this spell’s name has resolved this game, at the beginning of each of your precombat main phases for the rest of the game, create a copy of this object in exile. You may cast the copy without paying its mana cost” and “Exile this spell.” See rule 707.10.",
    "entryId": "702.192"
  },
  "power-up": {
    "label": "Power-up",
    "definition": "Power-up is a keyword that adds additional rules to the activated ability that follows it. “Power-up — [Cost]: [Effect]” means “[Cost]: [Effect]. If this permanent entered this turn, this ability’s cost is reduced by this permanent’s mana cost. Activate this ability only once.” Generic mana in the permanent’s mana cost reduces generic mana in the cost to activate its power-up ability. Colored and colorless mana in the permanent’s mana cost reduces mana of the same type, and any excess reduces that much generic mana. (See rule 118.7.)",
    "entryId": "702.193"
  },
  "teamwork": {
    "label": "Teamwork",
    "definition": "Teamwork represents a static ability that functions while the spell with teamwork is on the stack. “Teamwork N” means “As an additional cost to cast this spell, you may tap any number of creatures you control with total power N or more.” Paying a spell’s teamwork cost follows the rules for paying additional costs in rules 601.2b and 601.2f–h. Abilities may refer to a spell cast “using teamwork” or similar. Such phrases refer to whether the player who cast the spell declared the intention to pay the spell’s teamwork cost as they cast that spell.",
    "entryId": "702.194"
  },
  "storied": {
    "label": "Storied",
    "definition": "Storied is a static ability. It means “Any time you control three or more permanents that are artifacts, Sagas, and/or legendary and you don’t have an enduring story, you have an enduring story for the rest of the game.” Enduring story is a designation that has no rules meaning other than to act as a marker that other rules and effects can identify. Any number of players may have the enduring story designation at the same time.",
    "entryId": "702.195"
  }
};
