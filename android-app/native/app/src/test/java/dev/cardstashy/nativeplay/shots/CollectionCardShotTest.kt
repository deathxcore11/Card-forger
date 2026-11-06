package dev.cardstashy.nativeplay.shots

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
