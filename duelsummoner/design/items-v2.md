# Duel Summoner chest items, version 2

80 items in four rarities: common, rare, epic, legendary. The data lives in items-v2.js beside this file.

## Rules

- Items come only from chests and one trader. Level-ups give summons, Spells and Traps. Shrines give boons.
- A chest never shows its rarity from outside. It rolls when it is opened.
- A new save can roll 30 items. Every other item is locked until its achievement is done.
- Test for every item: can you name the build it belongs to? A plain stat bonus fails and belongs on a shrine blessing.
- Common: a small edge that rewards doing one thing. Stacks, with a ceiling.
- Rare: joins two systems. Stacks up to 3.
- Epic: bends a rule and names its price. One copy.
- Legendary: changes how attacks are built. One per run, then it leaves the pool.
- No item raises the rank multiplier or the layer damage scale. No item gives the duelist an attack.
- Crown of Many: the shared level counts for tiers and damage only. Each creature must still earn its own level 10 before it can fuse.

## Chest odds, before luck

| Chest | Common | Rare | Epic | Legendary |
|---|---|---|---|---|
| Gold | 62% | 30% | 7% | 1% |
| Elite | 40% | 38% | 18% | 4% |
| Paid | 30% | 40% | 22% | 8% |

A stage should hand out 8 to 12 items.

## The 123 items coded before this list

- 3 stay: Dune Kite, Canyon Spur, Ruin Chalk.
- 115 leave the chests. Their stat effects become shrine blessings.
- 5 are on hold until the card throw decision: Worn Duel Glove, Stacked Deck, Paper Fan, Burning Deck, Crown of Cards.
- The older coded Echo Bell is replaced by the one in this list.

## State

Every number here is a first guess. None has been through the balance bots. The eight element epics need each element's status in the game first.

## Legendary: 12

| Item | What it does | Limit or price | Serves | From | Unlock |
|---|---|---|---|---|---|
| Graftwright's Needle | Every Fusion holds one more attack layer than its rank allows. | The extra layer hits at 30%. | Tall chains | new | Needlework: Make an Epic Fusion. |
| Razor Deck | When any layer crits, the next layer in the chain fires twice from that spot. | The second copy hits at 50%. Once per layer. | Crit chains | new | Sharp Practice: Land 500 crits in one run. |
| Twin Sleeve | A tier three basic that is not fused borrows its partner's attack as a second layer. | It stops on that creature the moment it fuses. | A wide row of basics | new | Hold the Line: Clear the first stage without fusing. |
| Seventh Bell | Once per stage, one creature may fuse at level 7 instead of level 10. | That Fusion starts with 85% of its points. | One more Fusion per run | new | Six of a Kind: Make 6 Fusions in one run. |
| Spectrum Seal | Each layer also carries the element of the layer before it. | Statuses from the carried element last half as long. | Reaction engines | new | Full Spectrum: Set off every reaction at least once. |
| Rider's Covenant | Your Flow multiplier also speeds up creature attacks, up to 60% faster at Flow x5. | At Flow x1 your creatures attack 15% slower. | Ride-first runs | new | Never Touch the Ground: Hold Flow x5 for 60 seconds. |
| Living Grimoire | When you cast a Spell, every tier three creature adds that Spell to the end of its next attack. | The copy hits at 35%. One copy per cast. | Spell decks | new | Well Read: Cast 100 Spells in one run. |
| Loop Seal | When the last layer of a chain kills, the whole chain starts again from that spot. | The second turn hits at 50%. Once per attack. On a Super Fusion, which already loops, it gives one more turn at 25%. | Swarm clearing | new | Starting pool |
| Tribute Altar | Once per run, give up a level 10 creature. Every other creature gains its first attack as a new layer. | The layer hits at 35%. The Monster Zone stays empty until the stage ends. | All in on one signature attack | new | The Old Way: Tribute 10 creatures. |
| God's Thumbprint | Mutation odds when you fuse go from 80, 15, 5 to 50, 30, 20. | None. | The creature maker | new | One of a Kind: Make a Prismatic Fusion. |
| Colossus Collar | Pick one creature. It takes the Giant form for the rest of the run. | One creature, and the pick is final. It attacks slower, as Giants do. | One carry, built for bosses | new | Big Game: Make a Fusion with the Giant form. |
| Chorus Horn | When a creature attacks, the two creatures nearest to it fire their first layer at the same target. | Those shots hit at 40% and start no chains. | Focus fire | new | In Unison: Have four creatures hit the same elite within 1 second. |

## Epic: 20

| Item | What it does | Limit or price | Serves | From | Unlock |
|---|---|---|---|---|---|
| Crown of Many | All your summons share the highest level among them. | You gain XP 25% slower. The shared level counts for tiers and damage only: each creature must still earn its own level 10 before it can fuse. | Wide fields | roster | Full House: Field four tier three creatures at once. |
| Glass Deck | All damage doubled. | Max LP halved. | Glass cannon | roster | Untouched: Clear a stage without being hurt. |
| Chimera Key | Chimeras may climb into God recipes. | Named partners are offered less often. | The creature maker | roster | Menagerie: Make 10 different chimeras. |
| Sealed Hourglass | The stage clock runs 20% slower. | Toll Shades come in pairs. | Long stages | roster | Paid in Full: Defeat a Toll Shade. |
| Heart of the Horde | Every 100 kills adds 1% damage for the run. | Enemies gain 0.5% health per 100 kills. | Long runs | roster | Starting pool |
| Ouroboros Band | Spending LP also sets off your "when hurt" effects. | Healing is halved. | Blood deck | roster | Blood Price: Spend 100 LP in one run. |
| Mirror Card | Every item you take also gives a copy one rarity lower. | You can no longer reroll. | Item hoards | roster | Treasure Room: Open 20 chests in one run. |
| Golden Ring | Seems to do nothing. The mystery item. | It takes the place of a real epic. | The mystery | roster | Starting pool |
| Kindling Crown | Burn stacks without limit on elites and bosses. | Burn lasts half as long on everything else. | Fire, boss killing | new | Slow Roast: Keep Burn on a boss for 30 seconds. |
| Storm Jar | Lightning that runs out of targets comes home and is stored. The next attack lets every stored jump go at once. | Lightning creatures attack 15% slower. | Lightning, single targets | new | Full Circuit: Chain lightning through 8 enemies. |
| Frost Mirror | A frozen enemy that dies shatters, and the shards repeat the layer that killed it at half strength. | Ice takes longer to freeze: one more chill is needed. | Ice, crowds | new | Shatterproof: Shatter 50 frozen enemies. |
| Overgrowth Seed | Poison stacks have no ceiling and jump to the nearest enemy when their host dies. | Each stack ticks 25% weaker. | Poison, long fights | new | Rot Sets In: Reach 20 poison stacks on one enemy. |
| Tailwind Feather | Wind pulls enemies into a knot instead of pushing them away. | Wind attacks hit 15% softer. | Wind, area attacks | new | Clean Sweep: Push 30 enemies with one Wind attack. |
| Stonewake Idol | An Earth hit that breaks armour also raises a stone wall for 3 seconds. The wall stops enemy shots. | Earth creatures attack 15% slower. | Earth, defence | new | Stonebreaker: Break the armour of 100 enemies. |
| Dawn Lens | Light healing you could not use, because your LP was full, charges the lens. When it is full, every Light creature fires a beam at once. | Light heals 30% less. | Light, full health play | new | Morning Light: Heal 200 LP from Light kills. |
| Gravedigger's Spade | An enemy that dies cursed gets up as a husk and fights for you for 8 seconds. Up to 6 at once. | The curse no longer spreads on death. | Dark, minions | new | Bad Company: Let a curse spread to 25 enemies. |
| Blood Ink | Every creature attack costs you 1 LP and hits 30% harder. | The LP. It switches off below 20% LP. | Blood deck | new | Starting pool |
| Blood Purse | Paid chests take LP instead of coins: 15% of your max each. | The LP, and the price still climbs with every chest. | Blood deck | new | Deep Pockets: Buy 5 paid chests in one stage. |
| Hollow Egg | The next creature you summon arrives at tier two. | You skip your next level-up. The egg is used up. | Late summons | new | Starting pool |
| Slam Bell | A slam from big air makes every creature fire its whole chain at once. | 12 seconds to recharge, and your creatures pause for 1 second after. | Never leave the card | new | Ground Pound: Slam from big air 20 times. |

## Rare: 24

| Item | What it does | Limit or price | Serves | From | Unlock |
|---|---|---|---|---|---|
| Twin Leash | A fifth Monster Zone that only holds a common. |  | Field size and commons | roster | Common Ground: Finish a stage with four commons on the field. |
| Conductor Rod | Chains jump 3 more times and may hit the same enemy twice. |  | Lightning and crowds | roster | Live Wire: Hit 6 enemies with one lightning chain. |
| Blood Ledger | LP you spend comes back as a shield after 5 seconds. |  | LP costs and defence | roster | Starting pool |
| Prism Lens | A beam carries the element of every summon beside its owner. |  | Beams and elements | roster | Three Colours: Field three elements at once. |
| Tithe Bowl | Chests cost 20% less, and every chest you buy adds 2% damage. |  | Coins and damage | roster | Starting pool |
| Echo Bell | When a marked enemy dies, the killing hit repeats on the nearest marked one. | Replaces the older coded item of the same name. | Marks and kills | roster | Two for One: Kill 3 marked enemies within 1 second. |
| Aspect Vial | An Infusion keeps two aspects instead of one. |  | Infusion and Fusions | roster | First Infusion: Make your first Infusion. |
| Trick Trophy | Each trick in a combo adds 1% damage until the combo ends, no cap. |  | Riding and damage | roster | Showboat: Land a 10 trick combo. |
| Dune Kite | Big air over the dune sea: a second slam where you land, 60% bigger. |  | Riding and the dune sea | game | Starting pool |
| Canyon Spur | Each vert in a canyon heals 3 and holds Flow 1 second longer. |  | Riding and canyons | game | Starting pool |
| Ruin Chalk | Grinding in a ruin field: sparks hit 80% harder and reach 1 metre further. |  | Riding and ruins | game | Starting pool |
| Split Sigil | A shot splits in two on its first hit. Each half hits at 55%. |  | Ranged creatures and chains | new | Starting pool |
| Marksman's Wax | The first layer to hit a marked enemy always crits. |  | Marks and crits | new | Dead Eye: Land 100 crits in one run. |
| Reaction Flask | The first reaction on each enemy goes off twice. |  | Two elements | new | Lab Work: Set off 5 different reactions. |
| Molting Stone | A creature that reaches tier three sheds a tier one copy of itself. The copy fights for 20 seconds. |  | Tiers and field size | new | Early Bloomer: Raise a creature to tier three before minute 4. |
| Mentor's Collar | A tier three creature passes 20% of the XP it earns to your lowest creature. |  | Tiers and levelling | new | Teacher's Pet: Have a level 10 and a level 1 creature on the field together. |
| Growth Ring | When a creature reaches a new tier, every other creature of its element gains half a level. |  | Tiers and elements | new | Family Tree: Field four creatures of one element. |
| Card Sharp's Sleeve | Level-up offers show one more card, and it is always for your lowest creature. |  | Level-ups and the level 10 rule | new | Even Hand: Reach level 10 with every creature on the field. |
| Glass Leash | Creatures within 6 metres of you attack 25% faster. Beyond 14 metres they attack 10% slower. |  | Where you stand and your creatures | new | Starting pool |
| Rail Echo | While you grind, each creature leaves a copy of its first layer on the rail every 2 metres. |  | Riding and attacks | new | Long Rail: Grind 500 metres in one run. |
| Lunge Spur | Melee creatures lunge twice as far, and the lunge passes through enemies and hits each one. |  | Melee and crowds | new | Up Close: Kill 500 enemies with Melee creatures. |
| Trap Spring | When a Trap goes off, the nearest creature fires its first layer at everything the Trap caught. |  | Traps and creatures | new | Sprung: Catch 10 enemies in one Trap. |
| Elite Bounty | Every third elite you kill drops an Elite chest for certain. |  | Elites and chests | new | Starting pool |
| Heart Locket | A heart picked up at full LP becomes a Ward instead. |  | Pickups and defence | new | Starting pool |

## Common: 24

| Item | What it does | Limit or price | Serves | From | Unlock |
|---|---|---|---|---|---|
| Tamer's Whistle | A summon standing beside one of its own element deals 12% more. |  | Doubling up on an element | roster | Starting pool |
| Split Deck | Every fifth Spell casts twice. |  | Casting Spells | roster | Starting pool |
| Kindling Pouch | Burning enemies take 15% more from everything that is not fire. |  | Mixing Fire with another element | roster | Starting pool |
| Thorn Bracer | When you are hurt, the nearest summon attacks at once. |  | Staying near your creatures | roster | Starting pool |
| Deep Purse | 1% more damage for every 25 coins you hold. |  | Saving coins | roster | Starting pool |
| Marking Chalk | Marks last 2 seconds longer and jump to a neighbour on death. |  | Marking | roster | Starting pool |
| Grind Wax | While you grind on the card, summons attack 20% faster. |  | Grinding | roster | Starting pool |
| Egg Warmer | Summons below level 5 gain XP 30% faster. |  | Summoning new creatures late | roster | Starting pool |
| Spare Sleeve | Spells bounce to 1 more enemy. |  | Casting Spells | roster | Starting pool |
| Flint Chip | Every eighth attack by a creature throws a spark that sets Burn for 2 seconds. |  | Fast attackers | new | Starting pool |
| Static Sock | After you dash, the next creature attack chains to 1 more enemy. |  | Dashing | new | Starting pool |
| Frost Pebble | The first hit on an enemy at full health slows it for 1 second. |  | Spreading hits around | new | Starting pool |
| Chest Bell | Opening a chest makes every creature attack at once. |  | Opening chests in a fight | new | Starting pool |
| Vase Dust | Breaking a vase marks the nearest enemy. |  | Breaking vases | new | Starting pool |
| Trainer's Treat | A creature that lands the last hit on an elite gains half a level. |  | Hunting elites | new | Elite Company: Kill 10 elites in one run. |
| Landing Pad | Landing a trick gives your nearest creature its next attack right away. |  | Tricks | new | Stick It: Land 25 tricks in one run. |
| Lucky Tooth | Every 50 coins you pick up, one creature's next attack crits. |  | Picking up coins | new | Small Fortune: Hold 300 coins at once. |
| Rally Flag | Stand still for 2 seconds and a flag goes up. Creatures within 5 metres attack 10% faster until you move. |  | Holding ground | new | Starting pool |
| Heart Crumb | Picking up a heart makes your creatures attack 15% faster for 4 seconds. |  | Picking up hearts | new | Starting pool |
| Tier Ribbon | When a creature reaches a new tier, you heal 10 LP. |  | Levelling creatures | new | Growing Up: Raise 3 creatures to tier three in one run. |
| Opening Bell | For the first 20 seconds of a stage, creatures attack 25% faster. |  | A fast start | new | Out of the Gate: Kill 100 enemies in the first minute of a stage. |
| Bounty Tag | Killing a marked enemy drops 2 extra coins. |  | Marking | new | Marked Man: Kill 200 marked enemies. |
| Stray Card | Every 20 seconds a loose card circles you. The first enemy to touch it is marked. |  | Getting close | new | Tagged: Mark 50 enemies in one stage. |
| Shell Fragment | When you are hurt, enemies within 3 metres are pushed back 2 metres. |  | Surviving a crowd | new | Thick Skin: Be hurt 10 times in one stage and live. |
