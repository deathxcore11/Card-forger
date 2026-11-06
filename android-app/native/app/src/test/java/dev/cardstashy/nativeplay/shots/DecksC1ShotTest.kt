package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.DecksC1Test
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.DeckReviewActions
import dev.cardstashy.nativeplay.ui.DeckReviewModel
import dev.cardstashy.nativeplay.ui.DeckReviewSheet
import dev.cardstashy.nativeplay.ui.GameAccent
import dev.cardstashy.nativeplay.ui.HomeTest
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.Site
import dev.cardstashy.nativeplay.ui.SitePanelModel
import dev.cardstashy.nativeplay.ui.SiteUi
import dev.cardstashy.nativeplay.ui.TcgDeckImportSheet
import dev.cardstashy.nativeplay.ui.TcgNewDeckSheet
import dev.cardstashy.nativeplay.ui.WarChestWindow
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
import dev.cardstashy.nativeplay.ui.DeckImportSheet
import dev.cardstashy.nativeplay.ui.MetaTabBody
import kotlinx.coroutines.flow.first
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.unit.dp
import dev.cardstashy.nativeplay.ui.glyphMap
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Stage C1 drawn from the site's own models (DecksC1Test writes them to app/build/shot-art/decks-c1): Yu-Gi-Oh!'s and Pokémon's
 * Import a deck (and its stopped import) and New deck sheets, Magic's Deck review sheet (Commander and Modern), the War Chest window
 * (and a dice roll), and the Collection bottom nav, at every size the app is checked at and at 130% text:
 * shots/decks-c1-<what>-<w>x<h>-<font>.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class DecksC1ShotTest {
    private fun fixture(key: String): JsonObject? = DecksC1Test.fixtures.resolve("$key.json").takeIf { it.exists() }?.let { JsonParser.parseString(it.readText()).asJsonObject }

    private fun shot(name: String, w: Int, h: Int, font: Float = 1f, page: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "decks-c1-$name-${w}x$h-${(font * 100).toInt()}.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, font)) { page() }
        }
    }
    /** 360 × 780, 390 × 844, 954 × 860, 1024 × 768 and 844 × 390 (landscape), each at 100% and 130%. */
    private fun sizes(name: String, page: @Composable () -> Unit) {
        for ((w, h) in listOf(360 to 780, 390 to 844, 954 to 860, 1024 to 768)) for (f in listOf(1f, 1.3f)) shot(name, w, h, f, page)
        HomeTest.forceShort = true
        try { for (f in listOf(1f, 1.3f)) shot(name, 844, 390, f, page) } finally { HomeTest.forceShort = null }
    }

    private fun setUp() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        // No network in the shots: the art boxes stay their surface colour.
        dev.cardstashy.nativeplay.ui.homeArt = { null }
    }

    @Composable
    private fun Import(f: JsonObject, game: String) = GameAccent(game) {
        Box(Modifier.fillMaxSize().background(Site.Bg)) {
            TcgDeckImportSheet(CollectionWrites.TcgDeckOpen(game, openDeck = {}, id = 1), null, {}, f["model"].asJsonObject, f["status"]?.asString.orEmpty())
        }
    }

    @Composable
    private fun New(f: JsonObject, game: String) = GameAccent(game) {
        Box(Modifier.fillMaxSize().background(Site.Bg)) { TcgNewDeckSheet(CollectionWrites.TcgDeckOpen(game, openDeck = {}, id = 1), null, {}, f["model"].asJsonObject) }
    }

    @Composable
    private fun Review(f: JsonObject) {
        val m = DeckReviewModel.parse(f["model"].asJsonObject)!!
        val glyphs = f["glyphs"]?.takeIf { it.isJsonObject }?.let { glyphMap(it.asJsonObject) } ?: emptyMap()
        Box(Modifier.fillMaxSize().background(Site.Bg)) { DeckReviewSheet(m, glyphs, null, DeckReviewActions({}, {}, {})) }
    }

    /** [end]: the window scrolled to its foot (the dice line in view where the window is shorter than the chest). */
    @Composable
    private fun Chest(f: JsonObject, end: Boolean = false) {
        val panel = SitePanelModel.parse(f["model"].asJsonObject)
        val screen = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.let { androidx.compose.ui.unit.Dp(it.toFloat()) }
        val scroll = androidx.compose.foundation.rememberScrollState()
        if (end) androidx.compose.runtime.LaunchedEffect(Unit) { androidx.compose.runtime.snapshotFlow { scroll.maxValue }.first { it in 1 until Int.MAX_VALUE }; scroll.scrollTo(scroll.maxValue) }
        Box(Modifier.fillMaxSize().background(Site.Bg)) { WarChestWindow(panel, SiteUi({}, { _, _ -> }, {}, screen), null, scroll) {} }
    }

    /** Save a deck idea / a precon's Preview: the deck import sheet (A.importReference, A.previewPrecon) with the site's model. */
    @Composable
    private fun SaveIdea(f: JsonObject) = GameAccent("mtg") {
        Box(Modifier.fillMaxSize().background(Site.Bg)) {
            DeckImportSheet(CollectionWrites.DeckImportOpen(openDeck = { _, _ -> }, web = {}, id = 1), null, {}, f["model"].asJsonObject)
        }
    }

    /** Meta decks' body (MetaTabBody, the tab's gutter) scrolled to its foot: Saved decks and Precons in view. */
    @Composable
    private fun Meta(f: JsonObject) {
        val panel = f["model"].asJsonObject.takeIf { it.has("key") }?.let(SitePanelModel::parse)
        val screen = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.let { androidx.compose.ui.unit.Dp(it.toFloat()) }
        val glyphs = f["glyphs"]?.takeIf { it.isJsonObject }?.let { glyphMap(it.asJsonObject) } ?: emptyMap()
        val scroll = androidx.compose.foundation.rememberScrollState()
        androidx.compose.runtime.LaunchedEffect(Unit) { androidx.compose.runtime.snapshotFlow { scroll.maxValue }.first { it in 1 until Int.MAX_VALUE }; scroll.scrollTo(scroll.maxValue) }
        GameAccent("mtg") { Box(Modifier.fillMaxSize().background(Site.Bg)) {
            androidx.compose.foundation.layout.Column(Modifier.fillMaxSize().verticalScroll(scroll).padding(horizontal = 16.dp, vertical = 12.dp)) {
                MetaTabBody(panel, SiteUi({}, { _, _ -> }, {}, screen), glyphs, 16.dp, screen) } } }
    }

    @Test fun yugioh() {
        setUp()
        val f = fixture("ygo-import"); assumeTrue("run DecksC1Test first (it writes the models)", f != null)
        sizes("ygo-import") { Import(f!!, "ygo") }
        fixture("ygo-import-error")?.let { e -> sizes("ygo-import-error") { Import(e, "ygo") } }
        fixture("ygo-new")?.let { n -> sizes("ygo-new") { New(n, "ygo") } }
    }

    @Test fun pokemon() {
        setUp()
        val f = fixture("ptcg-import"); assumeTrue("run DecksC1Test first (it writes the models)", f != null)
        sizes("ptcg-import") { Import(f!!, "ptcg") }
        fixture("ptcg-import-error")?.let { e -> sizes("ptcg-import-error") { Import(e, "ptcg") } }
        fixture("ptcg-new")?.let { n -> sizes("ptcg-new") { New(n, "ptcg") } }
        fixture("ptcg-create-glc")?.let { n -> sizes("ptcg-create-glc") { New(n, "ptcg") } }
    }

    @Test fun review() {
        setUp()
        val f = fixture("mtg-review"); assumeTrue("run DecksC1Test first (it writes the models)", f != null)
        sizes("mtg-review") { Review(f!!) }
        fixture("mtg-review-modern")?.let { m -> sizes("mtg-review-modern") { Review(m) } }
    }

    @Test fun warChest() {
        setUp()
        val f = fixture("war-chest"); assumeTrue("run DecksC1Test first (it writes the models)", f != null)
        sizes("war-chest") { Chest(f!!) }
        fixture("war-chest-dice")?.let { d -> sizes("war-chest-dice") { Chest(d, end = true) } }
    }

    /** Meta decks' Saved decks and Precons: Save a deck idea, Remove's question, the precon list (unreachable, loaded, searched) and a Preview. */
    @Test fun savedAndPrecons() {
        setUp()
        val f = fixture("mtg-save-idea"); assumeTrue("run DecksC1Test first (it writes the models)", f != null)
        sizes("mtg-save-idea") { SaveIdea(f!!) }
        fixture("mtg-precon-preview")?.let { p -> sizes("mtg-precon-preview") { SaveIdea(p) } }
        fixture("mtg-delete-ask")?.let { a ->
            val m = a["model"].asJsonObject
            val site = m.getAsJsonObject("asking")?.let { o -> fun str(k: String) = o[k]?.takeIf { it.isJsonPrimitive }?.asString.orEmpty()
                CollectionWrites.SiteAsk(str("title"), str("ok"), str("cancel"), o["danger"]?.takeIf { it.isJsonPrimitive }?.asBoolean == true) }
            try {
                CollectionWrites.askForTest(CollectionWrites.Ask(m["ask"].asString, "deleteRef", JsonObject().apply { addProperty("id", "r1") }, site = site))
                sizes("mtg-delete-ask") { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost(null) } }
            } finally { CollectionWrites.askForTest(null) }
        }
        for (k in listOf("mtg-precons-error", "mtg-precons", "mtg-precons-search")) fixture(k)?.let { p -> sizes(k) { Meta(p) } }
    }

    /** The bottom nav on Decks (and Collection, the longest label, open): "Collection" whole at 360 wide and 130% text. */
    @Test fun nav() {
        setUp()
        for (tab in listOf(CollectionTab.DECKS, CollectionTab.CARDS)) sizes("nav-${tab.name.lowercase()}") {
            Box(Modifier.fillMaxSize().background(Site.Bg)) { Box(Modifier.align(Alignment.BottomCenter)) { CollectionNav(tab, vertical = false, scan = true) {} } }
        }
    }
}
