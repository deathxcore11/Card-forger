package dev.cardstashy.nativeplay.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** The Deck Bench's filters (BenchFilter.kt, deck view redesign 14 Nov): what each pick keeps, the badge, chips, sort, curve and Mana order. */
class BenchFilterTest {
    private fun tile(name: String, cmc: Double, type: String, colors: List<String> = emptyList(), rarity: String = "common", set: String = "fin",
                     own: Int = 1, inDeck: Int = 0, released: String = "2025-06-13", sets: List<String> = emptyList()) =
        BenchTile(name, "", cmc, type.startsWith("Land") || type.contains(" Land"), false, inDeck, own, 4, false,
            colors = colors, typeLine = type, rarity = rarity, set = set, released = released, sets = sets)

    private val bolt = tile("Lightning Bolt", 1.0, "Instant", listOf("R"), "uncommon", "m11", own = 4)
    private val counter = tile("Counterspell", 2.0, "Instant", listOf("U"), "common", own = 2, inDeck = 2)
    private val sephiroth = tile("Sephiroth, Planet's Heir", 6.0, "Legendary Creature — Human Avatar", listOf("U", "B"), "mythic", own = 1, released = "2025-06-14")
    private val ornithopter = tile("Ornithopter", 0.0, "Artifact Creature — Thopter", emptyList(), "uncommon", own = 3)
    private val island = tile("Island", 0.0, "Basic Land — Island", emptyList(), own = 9)
    private val behemoth = tile("Craterhoof Behemoth", 8.0, "Creature — Beast", listOf("G"), "mythic", own = 1)
    private val all = listOf(bolt, counter, sephiroth, ornithopter, island, behemoth)
    private fun BenchFilter.run(colors: Set<String> = emptySet(), find: String = "", roles: Map<String, List<String>> = emptyMap()) =
        all.filter { keeps(it, find, colors, roles) }.map { it.name }

    @Test fun nothingOnKeepsEverything() = assertEquals(all.map { it.name }, BenchFilter().run())

    @Test fun colours() {
        assertEquals(listOf("Lightning Bolt"), BenchFilter().run(setOf("R")))
        // Colourless is a card with no colour that isn't a land; multicolour is two colours or more.
        assertEquals(listOf("Ornithopter"), BenchFilter().run(setOf("C")))
        assertEquals(listOf("Sephiroth, Planet's Heir"), BenchFilter().run(setOf("M")))
        assertEquals(listOf("Counterspell", "Sephiroth, Planet's Heir"), BenchFilter().run(setOf("U")))
    }

    @Test fun manaValueLeavesLandsOutAndSevenMeansSevenAndUp() {
        assertEquals(listOf("Ornithopter"), BenchFilter(mana = setOf(0)).run())
        assertEquals(listOf("Lightning Bolt", "Counterspell"), BenchFilter(mana = setOf(1, 2)).run())
        assertEquals(listOf("Craterhoof Behemoth"), BenchFilter(mana = setOf(7)).run())
    }

    @Test fun typeReadsWholeWordsOfEitherFace() {
        assertEquals(listOf("Sephiroth, Planet's Heir", "Ornithopter", "Craterhoof Behemoth"), BenchFilter(types = setOf("Creature")).run())
        assertEquals(listOf("Ornithopter"), BenchFilter(types = setOf("Artifact")).run())
        assertEquals(listOf("Island"), BenchFilter(types = setOf("Land")).run())
        // A spell // land shows under both, as Scryfall's t: does; its colour is every face's (the tile's colours are the union).
        val mdfc = tile("Sink into Stupor // Soporific Springs", 3.0, "Instant // Land", listOf("U"))
        assertTrue(BenchFilter(types = setOf("Land")).keeps(mdfc, "", emptySet(), emptyMap()))
        assertTrue(BenchFilter(types = setOf("Instant")).keeps(mdfc, "", emptySet(), emptyMap()))
    }

    @Test fun setMatchesAnyPrintingYouHave() {
        val t = tile("Opt", 1.0, "Instant", listOf("U"), set = "dom", sets = listOf("xln", "DOM", "eld"))
        assertTrue(BenchFilter(set = "eld").keeps(t, "", emptySet(), emptyMap()))
        assertTrue(BenchFilter(set = "DOM").keeps(t, "", emptySet(), emptyMap()))
        assertFalse(BenchFilter(set = "m21").keeps(t, "", emptySet(), emptyMap()))
    }

    @Test fun doesNeedsTheBuildersTags() {
        val roles = mapOf("Lightning Bolt" to listOf("removal"), "Counterspell" to listOf("removal"), "Craterhoof Behemoth" to listOf("wincon"))
        assertEquals(listOf("Lightning Bolt", "Counterspell"), BenchFilter(does = setOf("removal")).run(roles = roles))
        assertEquals(listOf("Craterhoof Behemoth"), BenchFilter(does = setOf("wincon")).run(roles = roles))
        // A card not tagged yet is not shown as doing something.
        assertEquals(emptyList<String>(), BenchFilter(does = setOf("draw")).run(roles = roles))
    }

    @Test fun rarityCopiesSetAndNotInDeck() {
        assertEquals(listOf("Sephiroth, Planet's Heir", "Craterhoof Behemoth"), BenchFilter(rarity = setOf("mythic")).run())
        assertEquals(listOf("Lightning Bolt", "Island"), BenchFilter(copies = setOf(4)).run())
        assertEquals(listOf("Counterspell"), BenchFilter(copies = setOf(2)).run())
        assertEquals(listOf("Lightning Bolt"), BenchFilter(set = "M11").run())
        assertFalse("Counterspell" in BenchFilter(notInDeck = true).run())
        assertEquals(listOf("Lightning Bolt"), BenchFilter(rarity = setOf("uncommon"), mana = setOf(1)).run(find = "bolt"))
    }

    @Test fun badgeChipsAndReset() {
        val f = BenchFilter(mana = setOf(1, 2), types = setOf("Instant"), does = setOf("wipe"), notInDeck = true, set = "fin", sort = "name")
        assertEquals("Sort is not a filter", 6, f.count)
        val chips = f.chips { if (it == "fin") "Final Fantasy" else it }
        assertEquals(listOf("Mana 1", "Mana 2", "Instant", "Sweeper", "Not in this deck", "Final Fantasy"), chips.map { it.first })
        assertEquals(setOf(2), chips[0].second.mana)
        assertEquals(0, BenchFilter(sort = "name").count)
    }

    @Test fun sorts() {
        assertEquals(listOf("Counterspell", "Craterhoof Behemoth", "Island"), BenchFilter(sort = "name").sorted(listOf(island, counter, behemoth)).map { it.name })
        assertEquals("Craterhoof Behemoth", BenchFilter(sort = "rarity").sorted(listOf(bolt, behemoth)).first().name)
        assertEquals("Island", BenchFilter(sort = "copies").sorted(all).first().name)
        assertEquals("Sephiroth, Planet's Heir", BenchFilter(sort = "new").sorted(all).first().name)
    }

    @Test fun padStepsOneManaValueAtATime() {
        var f = BenchFilter()
        f = f.stepMana(1); assertEquals(setOf(0), f.mana)
        f = f.stepMana(1); assertEquals(setOf(1), f.mana)
        f = f.stepMana(-1).stepMana(-1); assertTrue(f.mana.isEmpty())
        assertEquals(setOf(7), BenchFilter().stepMana(-1).let { it.copy(mana = setOf(7)) }.mana)
        assertTrue(BenchFilter(mana = setOf(7)).stepMana(1).mana.isEmpty())
    }

    @Test fun scryfallWordsForAllCards() {
        assertEquals(listOf("(mv=1 or mv>=7)", "(t:instant)", "(r:rare)", "s:fin"), BenchFilter.query(BenchFilter(mana = setOf(7, 1), types = setOf("Instant"), rarity = setOf("rare"), set = "FIN", does = setOf("draw"))))
    }

    @Test fun curveAndManaOrder() {
        fun row(name: String, qty: Int, cmc: Double = -1.0, cost: String = "") = BenchRow(name, qty, 0, "", "", "", cost, emptyList(), "", "", "", cmc = cmc)
        val groups = listOf(BenchGroup("Creatures", listOf(row("Sephiroth", 1, 6.0), row("Hoof", 1, 8.0))),
            BenchGroup("Instants", listOf(row("Counterspell", 4, cost = "{U}{U}"), row("Opt", 3, 1.0))),
            BenchGroup("Lands", listOf(row("Island", 20, 0.0))))
        assertEquals(listOf(0, 3, 4, 0, 0, 0, 1, 1), benchCurve(groups))
        assertEquals(listOf("Mana value 1", "Mana value 2", "Mana value 6", "Mana value 7+", "Lands"), benchByMana(groups).map { it.name })
        // A spell with no mana value to read yet waits under Other (before Lands) rather than guess, and the rest still sorts.
        val unknown = groups + BenchGroup("Sorceries", listOf(row("Loading…", 1)))
        assertEquals(listOf("Mana value 1", "Mana value 2", "Mana value 6", "Mana value 7+", "Other", "Lands"), benchByMana(unknown).map { it.name })
        assertEquals(listOf("Loading…"), benchByMana(unknown).first { it.name == "Other" }.rows.map { it.name })
    }
}
