package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.collection.DecksMetaTest
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CollectionDecks
import dev.cardstashy.nativeplay.ui.CollectionDecksModel
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.GameAccent
import dev.cardstashy.nativeplay.ui.HomeTest
import dev.cardstashy.nativeplay.ui.MetaDeckSheet
import dev.cardstashy.nativeplay.ui.MetaDeckSheetActions
import dev.cardstashy.nativeplay.ui.MetaDeckSheetModel
import dev.cardstashy.nativeplay.ui.MetaTabBody
import dev.cardstashy.nativeplay.ui.Mode
import dev.cardstashy.nativeplay.ui.SitePanelModel
import dev.cardstashy.nativeplay.ui.SiteUi
import dev.cardstashy.nativeplay.ui.TopBarItems
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
 * Collection › Decks › Meta decks drawn here (MetaTabBody over the page's head) and the tournament deck's sheet (MetaDeckSheet), from the
 * site's own code: the models DecksMetaTest keeps (app/build/shot-art/decks-meta, one file each). Magic's Meta decks, Yu-Gi-Oh!'s (and
 * its format with no decks), Magic's sheet (and as a draft) and Yu-Gi-Oh!'s (and on Budget), at every size the app is checked at and
 * at 130% text: shots/decks-meta-<what>-<w>x<h>-<font>.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class DecksMetaShotTest {
    private fun fixture(key: String): JsonObject? = DecksMetaTest.fixtures.resolve("$key.json").takeIf { it.exists() }?.let { JsonParser.parseString(it.readText()).asJsonObject }

    private fun shot(name: String, w: Int, h: Int, font: Float = 1f, page: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in dev.cardstashy.nativeplay.ui.CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "decks-meta-$name-${w}x$h-${(font * 100).toInt()}.png").path) {
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

    private val top: @Composable ((@Composable () -> Unit)?) -> Unit = { tabs -> TopBarItems(Mode.COLLECTION, null, "Randall", unread = true, onSwitch = {}, onProfile = {}, middle = tabs) }
    private val nav: @Composable (Boolean) -> Unit = { v -> CollectionNav(CollectionTab.DECKS, vertical = v, scan = !v) {} }

    private fun setUp() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        dev.cardstashy.nativeplay.ui.Foil.testFallback = true
        // No network in the shots: the art boxes stay their surface colour.
        dev.cardstashy.nativeplay.ui.homeArt = { null }
    }

    @Composable
    private fun Page(f: JsonObject, game: String) {
        val head = CollectionDecksModel.parse(f["head"].asJsonObject)
        val panel = f["model"].asJsonObject.takeIf { it.has("key") }?.let(SitePanelModel::parse)
        val screen = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.let { androidx.compose.ui.unit.Dp(it.toFloat()) }
        val ui = SiteUi({}, { _, _ -> }, {}, screen)
        val glyphs = f["glyphs"]?.takeIf { it.isJsonObject }?.let { glyphMap(it.asJsonObject) } ?: emptyMap()
        GameAccent(game) { CollectionDecks(head, top, nav = nav, body = { g, s -> MetaTabBody(panel, ui, glyphs, g, s) }) }
    }

    @Composable
    private fun Sheet(f: JsonObject) {
        val m = MetaDeckSheetModel.parse(f["model"].asJsonObject)!!
        val glyphs = f["glyphs"]?.takeIf { it.isJsonObject }?.let { glyphMap(it.asJsonObject) } ?: emptyMap()
        Box(Modifier.fillMaxSize()) { MetaDeckSheet(MetaDeckSheetActions({}, { _, _ -> }, {}, { _, _, _ -> }), initial = m, glyphs0 = glyphs) }
    }

    @Test fun magic() {
        setUp()
        val meta = fixture("mtg-meta"); assumeTrue("run DecksMetaTest first (it writes the models)", meta != null)
        sizes("mtg") { Page(meta!!, "mtg") }
        shot("mtg-page", 390, 3000) { Page(meta!!, "mtg") }
    }

    @Test fun yugioh() {
        setUp()
        val f = fixture("ygo-meta"); assumeTrue("run DecksMetaTest first (it writes the models)", f != null)
        sizes("ygo") { Page(f!!, "ygo") }
        fixture("ygo-meta-none")?.let { e -> sizes("ygo-none") { Page(e, "ygo") } }
    }

    @Test fun pokemon() {
        setUp()
        val f = fixture("ptcg-meta"); assumeTrue("run DecksMetaTest first (it writes the models)", f != null)
        sizes("ptcg") { Page(f!!, "ptcg") }
        fixture("ptcg-sheet")?.let { y -> sizes("sheet-ptcg") { Sheet(y) }; shot("sheet-ptcg-page", 390, 2400) { Sheet(y) } }
    }

    @Test fun sheets() {
        setUp()
        val f = fixture("mtg-sheet"); assumeTrue("run DecksMetaTest first (it writes the models)", f != null)
        sizes("sheet-mtg") { Sheet(f!!) }
        shot("sheet-mtg-page", 390, 3200) { Sheet(f!!) }
        fixture("mtg-sheet-draft")?.let { d -> sizes("sheet-mtg-draft") { Sheet(d) } }
        fixture("ygo-sheet")?.let { y -> sizes("sheet-ygo") { Sheet(y) }; shot("sheet-ygo-page", 390, 3200) { Sheet(y) } }
        fixture("ygo-sheet-budget")?.let { b -> sizes("sheet-ygo-budget") { Sheet(b) } }
    }
}
