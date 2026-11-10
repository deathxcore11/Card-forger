package dev.cardstashy.nativeplay.shots

import androidx.compose.ui.unit.dp
import androidx.compose.foundation.layout.size
import android.graphics.BitmapFactory
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CollectionCardActions
import dev.cardstashy.nativeplay.ui.CollectionCardModel
import dev.cardstashy.nativeplay.ui.CollectionCardSheet
import dev.cardstashy.nativeplay.ui.CollectionDeck
import dev.cardstashy.nativeplay.ui.CollectionDeckModel
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionSet
import dev.cardstashy.nativeplay.ui.CollectionSetModel
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.TopBarItems
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * A card's page (views.js cardSheet: Overview, Meta, Play guide) from the site's own code, over the deck page that opened it
 * (app/build/shot-art/home/collection-card-<card>[-tab].json, written from the engine bundle with the site's live data),
 * upright, unfolded and sideways.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class CollectionCardShotTest {
    private val home = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/home")
    private val missing = java.util.TreeSet<String>()
    private fun key(url: String) = java.security.MessageDigest.getInstance("SHA-1").digest(url.toByteArray()).joinToString("") { "%02x".format(it) }
    private fun art(url: String): Any? {
        val f = home.resolve(key(url) + ".png").takeIf { it.exists() } ?: home.resolve(key(url) + ".jpg").takeIf { it.exists() }
        if (f == null) { missing += url; return null }
        return BitmapFactory.decodeFile(f.path)?.asImageBitmap()
    }

    private fun shot(name: String, w: Int, h: Int, content: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in dev.cardstashy.nativeplay.ui.CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "$name-${w}x$h-100.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, 1f)) { content() }
        }
    }

    private fun page(fixture: String): (@Composable () -> Unit)? {
        val fx = home.resolve("collection-card-$fixture.json")
        if (!fx.exists()) return null
        val m = CollectionCardModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
        val deck = home.resolve("collection-deck-gallery.json").takeIf { it.exists() }?.let { CollectionDeckModel.parse(JsonParser.parseString(it.readText()).asJsonObject) }
        return {
            Box(Modifier.fillMaxSize()) {
                if (deck != null) CollectionDeck(deck, top = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) },
                    nav = { v -> CollectionNav(CollectionTab.DECKS, vertical = v, scan = !v) {} })
                CollectionCardSheet(m, CollectionCardActions()) {}
            }
        }
    }

    private fun setUp() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        dev.cardstashy.nativeplay.ui.homeArt = ::art
    }

    @Test fun overview() {
        setUp()
        val page = page("lightning-bolt"); assumeTrue("write the card fixtures first", page != null)
        shot("collection-card-overview", 390, 844) { page!!() }
        shot("collection-card-overview-page", 390, 3200) { page!!() }
        shot("collection-card-overview", 884, 1104) { page!!() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-card-overview", 844, 390) { page!!() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        page("delver-of-secrets")?.let { p -> shot("collection-card-flip", 390, 844) { p() } }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** A card page built by hand (no engine fixtures needed): the Thor's "Card on the wall" shows only what the model carries. */
    private fun dualModel(name: String, type: String, lines: List<String>, flavor: String?, pt: String, guide: List<Pair<String, List<String>>>, rulings: List<String>): CollectionCardModel {
        val cards = JsonParser.parseString(javaClass.classLoader!!.getResource("trunk-cards.json")!!.readText()).asJsonArray.map { it.asJsonObject }
        val shown = cards.first { it["name"].asString.startsWith(name) }
        fun run(t: String) = dev.cardstashy.nativeplay.ui.CardRun(t, false, false, null, "", null)
        fun press(l: String, act: String = "x") = dev.cardstashy.nativeplay.ui.CardPress(l, null, act, emptyMap(), "", "", "", false, false, false, false, false)
        val face = dev.cardstashy.nativeplay.ui.CardFace("", name, emptyList(), type, lines.map { listOf(run(it)) }, "Flavour", flavor, pt, "Simon Dominic", null)
        val blocks = guide.flatMap { (h, items) -> listOf(dev.cardstashy.nativeplay.ui.CardBlock("title", text = h), dev.cardstashy.nativeplay.ui.CardBlock("list", items = items.map { dev.cardstashy.nativeplay.ui.CardItem(runs = listOf(run(it))) })) } +
            dev.cardstashy.nativeplay.ui.CardBlock("rulings", head = "Rulings", items = rulings.map { dev.cardstashy.nativeplay.ui.CardItem(runs = listOf(run(it)), source = "Wizards of the Coast · 2023-04-14") })
        val ov = dev.cardstashy.nativeplay.ui.CardOverview(image = "", sources = emptyList(), tier = "", zoomSrc = "", zoomHi = "", zoomArt = "", finishKey = "foil", finishEffect = "", flip = null,
            finishLabel = "Finish", finishes = listOf(dev.cardstashy.nativeplay.ui.CardFinishChip("foil", "Traditional foil", true, "plain")), finishFoot = "", profile = null,
            printings = dev.cardstashy.nativeplay.ui.CardPrintings("Other printings you own", null, (1..3).map { dev.cardstashy.nativeplay.ui.CardPrintRow(it, "", emptyList(), "Printing $it", "#13$it", "Printing $it", it == 1) }, emptyList(), ""),
            discoverySummary = "", discoveryText = "", discovery = emptyList(), faces = listOf(face), loading = null, rulesEntry = null, alertTitle = "", alertLine = "", alert = null, own = "", legal = null, deck = null,
            chips = emptyList(), factLabel = "", fact = "", researchLabel = "", research = emptyList(), ownedAria = "",
            owned = listOf(dev.cardstashy.nativeplay.ui.CardOwnedGroup("a", "Traditional foil", 2, emptyList(), null), dev.cardstashy.nativeplay.ui.CardOwnedGroup("b", "Nonfoil", 1, emptyList(), null)),
            main = emptyList(), more = emptyList())
        val set = dev.cardstashy.nativeplay.ui.CardSetSummary("mh2", "mythic", "", "", "Modern Horizons 2", true, "MH2 #138 · Mythic · 2021",
            dev.cardstashy.nativeplay.ui.CardSetProgress("Your progress", "60 of 273", "21%", .21f, "In your collection"))
        val price = dev.cardstashy.nativeplay.ui.CardPrice(null, dev.cardstashy.nativeplay.ui.CardRef("$12.40", "Market", "Traditional foil", null), null, press("Add a copy", "add"), "")
        val hist = dev.cardstashy.nativeplay.ui.CardHistory("ready", "", listOf(dev.cardstashy.nativeplay.ui.CardHistBlock("head", value = "$12.40", label = "Market, 90 days"),
            dev.cardstashy.nativeplay.ui.CardHistBlock("chart", points = (0..30).map { it * 12f to 90f - it * 1.5f + (it % 5) * 6f })))
        return CollectionCardModel(name, "", "", "overview", null, false, dev.cardstashy.nativeplay.ui.CardHead("", name, type, "3 in your collection", "", emptyList(), false), emptyList(), emptyList(), set, price, ov,
            emptyList(), "", listOf(dev.cardstashy.nativeplay.ui.CardSection("", false, true, blocks)), shown, false, emptyMap(),
            prices = dev.cardstashy.nativeplay.ui.CardPrices(null, emptyList(), null, hist, null, null))
    }

    /** Two screens ("Card on the wall", specs/thor-card-popup-dual.md Revision 2): a short-text and a long-text card; top 1920 x 1080, bottom 1240 x 1080. */
    @Test fun overviewDual() {
        setUp()
        val cases = listOf(
            "short" to dualModel("Llanowar Elves", "Creature — Elf Druid", listOf("{T}: Add {G}."), "Every sapling is a promise.", "1/1", listOf("Works with" to listOf("Mana dorks and ramp", "Anything that wants a turn-one play"), "Watch out" to listOf("Dies to any sweeper")), listOf("It can tap for mana the turn it arrives only if you control it continuously.")),
            "long" to dualModel("Ragavan", "Legendary Creature — Monkey Pirate", listOf("Whenever Ragavan, Nimble Pilferer deals combat damage to a player, create a Treasure token and exile the top card of that player's library. Until end of turn, you may cast that card.", "Dash {1}{R} (You may cast this spell for its dash cost. If you do, it gains haste, and it's returned from the battlefield to its owner's hand at the beginning of the next end step.)"), "Never trust a monkey with your treasure.", "2/1",
                listOf("Works with" to listOf("Cheap burn and equipment that rewards connecting", "Treasure payoffs and artifact sacrifice outlets", "Haste enablers and flicker effects"), "Watch out" to listOf("Weak to any early blocker", "Exiled cards can only be cast until end of turn", "Dash returns it to hand, so it cannot carry equipment")),
                listOf("Ragavan's ability triggers whenever it deals combat damage to a player, even if that damage was prevented down to zero.", "You exile the top card of that player's library; it stays exiled even if you cannot cast it.", "Dash lets you cast this creature from your hand for its dash cost.", "A fourth ruling.")))
        dev.cardstashy.nativeplay.ui.Pad.used()
        try {
            dev.cardstashy.nativeplay.ui.DualScreen.pretend(dev.cardstashy.nativeplay.ui.DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f))
            for ((nm, m) in cases) {
                RuntimeEnvironment.setQualifiers("w960dp-h540dp-land-xhdpi")
                captureRoboImage(File(System.getProperty("shotsDir"), "w3/coll-$nm-top.png").path) {
                    Box(Modifier.fillMaxSize()) { Box(Modifier.size(1.dp)) { CollectionCardSheet(m, CollectionCardActions()) {} }; dev.cardstashy.nativeplay.ui.TopScreenHost() }
                }
                RuntimeEnvironment.setQualifiers("w620dp-h540dp-xhdpi")
                captureRoboImage(File(System.getProperty("shotsDir"), "w3/coll-$nm-bottom.png").path) {
                    Box(Modifier.fillMaxSize()) { Box(Modifier.size(1.dp)) { CollectionCardSheet(m, CollectionCardActions()) {} }; dev.cardstashy.nativeplay.ui.BottomRoot() }
                }
            }
        } finally { dev.cardstashy.nativeplay.ui.DualScreen.pretend(null); dev.cardstashy.nativeplay.ui.Pad.forget() }
    }

    @Test fun prices() {
        setUp()
        val page = page("lightning-bolt-prices"); assumeTrue("write the card fixtures first", page != null)
        shot("collection-card-prices", 390, 844) { page!!() }
        shot("collection-card-prices-page", 390, 2600) { page!!() }
        shot("collection-card-prices", 884, 1104) { page!!() }
        shot("collection-card-prices-page", 884, 2400) { page!!() }
        dev.cardstashy.nativeplay.ui.CardSheetTest.open = true
        try { shot("collection-card-prices-open", 390, 3200) { page!!() } } finally { dev.cardstashy.nativeplay.ui.CardSheetTest.open = false }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** The condition switch on each game's Prices tab (CollectionEngineTest.conditionSwitch: Lightning Bolt, Dark Magician's CT13
     *  Ultra Rare, Base Set Charizard's Holofoil), live condition prices; the second Pokémon shot opens on Lightly Played. */
    @Test fun conditionSwitch() {
        setUp()
        for (g in listOf("mtg", "ygo", "ptcg")) {
            val fp = home.resolve("cond-$g-page.json"); val fc = home.resolve("cond-$g.json"); assumeTrue("run CollectionEngineTest.conditionSwitch first", fp.exists() && fc.exists())
            val m = CollectionCardModel.parse(JsonParser.parseString(fp.readText()).asJsonObject)
            for (start in listOf("", "Lightly Played").take(if (g == "ptcg") 2 else 1)) {
                val c = JsonParser.parseString(fc.readText()).asJsonObject.apply { if (start.isNotBlank()) addProperty("start", start) }
                val act = CollectionCardActions(conditions = { c })
                val name = "collection-card-cond-$g" + if (start.isNotBlank()) "-lp" else ""
                shot(name, 390, 2000) { CollectionCardSheet(m, act) {} }
                if (start.isBlank()) { shot(name, 884, 1104) { CollectionCardSheet(m, act) {} }; shot(name, 360, 1500) { CollectionCardSheet(m, act) {} } }
            }
        }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** views.js buySheet: "Buy this card" from the Cards list's price (a saved copy with its exact printing). */
    @Test fun buy() {
        setUp()
        val page = page("lightning-bolt-buy"); assumeTrue("run CollectionEngineTest.buySheet first", page != null)
        shot("collection-card-buy", 390, 844) { page!!() }
        shot("collection-card-buy-page", 390, 2400) { page!!() }
        shot("collection-card-buy", 884, 1104) { page!!() }
        dev.cardstashy.nativeplay.ui.HomeTest.forceShort = true
        try { shot("collection-card-buy", 844, 390) { page!!() } } finally { dev.cardstashy.nativeplay.ui.HomeTest.forceShort = null }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    @Test fun metaAndGuide() {
        setUp()
        for (t in listOf("meta", "guide")) {
            val page = page("lightning-bolt-$t"); assumeTrue("write the card fixtures first", page != null)
            shot("collection-card-$t", 390, 844) { page!!() }
            shot("collection-card-$t-page", 390, if (t == "guide") 4200 else 2600) { page!!() }
            shot("collection-card-$t", 884, 1104) { page!!() }
        }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** guide.js's Magic "Works with" (grouped by why, mtg-synergy.json) and "Watch out" (read from the rules text), on Lava Coil,
     *  which has both. */
    @Test fun playGuideStrip() {
        setUp()
        val page = page("lava-coil-guide"); assumeTrue("write the Lava Coil guide fixture first", page != null)
        shot("collection-card-guide-strip", 390, 844) { page!!() }
        shot("collection-card-guide-strip-page", 390, 3600) { page!!() }
        shot("collection-card-guide-strip-page", 884, 2700) { page!!() }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }

    /** tcg.js tcgCardSheet: a Yu-Gi-Oh! card (Beyond the Brave's secret rare) and a Pokémon card (Surging Sparks' Scovillain ex), over their set pages
     *  (scratchpad cardpage/tcard.cjs: opened from the set page's own tile). */
    @Test fun tcgCards() {
        setUp()
        for (g in listOf("ygo", "ptcg")) for (t in listOf("", "-guide", "-prices")) {
            val fx = home.resolve("collection-card-$g$t.json"); assumeTrue("write the $g card fixtures first", fx.exists())
            val m = CollectionCardModel.parse(JsonParser.parseString(fx.readText()).asJsonObject)
            val set = home.resolve("collection-tset-$g.json").takeIf { it.exists() }?.let { CollectionSetModel.parse(JsonParser.parseString(it.readText()).asJsonObject) }
            val page: @Composable () -> Unit = {
                Box(Modifier.fillMaxSize()) {
                    if (set != null) CollectionSet(set, { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) },
                        nav = { v -> CollectionNav(CollectionTab.SEARCH, vertical = v, scan = !v) {} })
                    CollectionCardSheet(m, CollectionCardActions()) {}
                }
            }
            val tab = t.ifBlank { "-overview" }
            shot("collection-tcard-$g$tab", 390, 844) { page() }
            shot("collection-tcard-$g$tab-page", 390, 3600) { page() }
            shot("collection-tcard-$g$tab", 884, 1104) { page() }
            // Market details open: the sources' tables and every printing's prices.
            if (t == "-prices") { dev.cardstashy.nativeplay.ui.CardSheetTest.open = true
                try { shot("collection-tcard-$g-prices-open", 390, 4400) { page() } } finally { dev.cardstashy.nativeplay.ui.CardSheetTest.open = false } }
        }
        if (missing.isNotEmpty()) println("MISSING ART ${missing.joinToString()}")
    }
}
