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
import dev.cardstashy.nativeplay.collection.DecksIdeasTest
import dev.cardstashy.nativeplay.ui.AssetImages
import dev.cardstashy.nativeplay.ui.CollectionDecks
import dev.cardstashy.nativeplay.ui.CollectionDecksModel
import dev.cardstashy.nativeplay.ui.CollectionNav
import dev.cardstashy.nativeplay.ui.CollectionTab
import dev.cardstashy.nativeplay.ui.DecksTabBody
import dev.cardstashy.nativeplay.ui.GameAccent
import dev.cardstashy.nativeplay.ui.HomeTest
import dev.cardstashy.nativeplay.ui.IdeaSheet
import dev.cardstashy.nativeplay.ui.IdeaSheetActions
import dev.cardstashy.nativeplay.ui.IdeaSheetModel
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
 * Collection › Decks › Ideas drawn here (DecksTabBody over the page's head) and Magic's deck idea sheet (IdeaSheet), from the site's own
 * code: the models DecksIdeasTest keeps (app/build/shot-art/decks-ideas, one file each). Magic's ideas, its empty state, the idea sheet and
 * Yu-Gi-Oh!'s ideas, at every size the app is checked at and at 130% text: shots/decks-ideas-<what>-<w>x<h>-<font>.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class DecksIdeasShotTest {
    private fun fixture(key: String): JsonObject? = DecksIdeasTest.fixtures.resolve("$key.json").takeIf { it.exists() }?.let { JsonParser.parseString(it.readText()).asJsonObject }

    private fun shot(name: String, w: Int, h: Int, font: Float = 1f, page: @Composable () -> Unit) {
        kotlinx.coroutines.runBlocking { for (m in Mode.entries) AssetImages.load(RuntimeEnvironment.getApplication(), m.asset, maxWidth = 256)
            AssetImages.load(RuntimeEnvironment.getApplication(), "play/avatar-default.webp", maxWidth = 256)
            for (g in dev.cardstashy.nativeplay.ui.CardGame.entries) AssetImages.load(RuntimeEnvironment.getApplication(), g.tabArt, maxWidth = 480) }
        RuntimeEnvironment.setQualifiers("w${w}dp-h${h}dp-xxhdpi")
        captureRoboImage(File(System.getProperty("shotsDir"), "decks-ideas-$name-${w}x$h-${(font * 100).toInt()}.png").path) {
            val d = LocalDensity.current
            CompositionLocalProvider(LocalDensity provides Density(d.density, font)) { page() }
        }
    }
    /** 360 × 780, 390 × 844, 954 × 860, 1024 × 768 and 844 × 390 (landscape) at 100%; 390 × 844 and 360 × 780 at 130%. */
    private fun sizes(name: String, page: @Composable () -> Unit) {
        for ((w, h) in listOf(360 to 780, 390 to 844, 954 to 860, 1024 to 768)) shot(name, w, h, page = page)
        HomeTest.forceShort = true
        try { shot(name, 844, 390, page = page) } finally { HomeTest.forceShort = null }
        shot(name, 390, 844, 1.3f, page); shot(name, 360, 780, 1.3f, page)
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
        val glyphs = glyphMap(f["glyphs"].asJsonObject)
        val screen = androidx.compose.ui.platform.LocalConfiguration.current.screenWidthDp.let { androidx.compose.ui.unit.Dp(it.toFloat()) }
        val ui = SiteUi({}, { _, _ -> }, {}, screen)
        GameAccent(game) { CollectionDecks(head, top, nav = nav, body = { g, s -> DecksTabBody(panel, ui, glyphs, g, s) }) }
    }

    @Test fun magic() {
        setUp()
        val ideas = fixture("mtg-ideas"); assumeTrue("run DecksIdeasTest first (it writes the models)", ideas != null)
        sizes("mtg") { Page(ideas!!, "mtg") }
        shot("mtg-page", 390, 2400) { Page(ideas!!, "mtg") }
        fixture("mtg-empty")?.let { e -> sizes("mtg-empty") { Page(e, "mtg") } }
    }

    @Test fun sheet() {
        setUp()
        val f = fixture("mtg-sheet"); val under = fixture("mtg-ideas")
        assumeTrue("run DecksIdeasTest first (it writes the models)", f != null && under != null)
        val m = IdeaSheetModel.parse(f!!["model"].asJsonObject)!!
        val sheet: @Composable () -> Unit = {
            Box(Modifier.fillMaxSize()) {
                Page(under!!, "mtg")
                GameAccent("mtg") { IdeaSheet(m.i, null, IdeaSheetActions({}, {}, {}), initial = m) }
            }
        }
        sizes("sheet", sheet)
        // The whole sheet in each of deck-viewer.js's views (the sheet scrolls; a tall window shows all of it).
        for (v in listOf("gallery", "stacks", "symbols", "compact")) {
            val j = f["model"].asJsonObject.deepCopy()
            j.getAsJsonArray("blocks").map { it.asJsonObject }.first { it["k"].asString == "cards" }.apply {
                addProperty("view", v)
                getAsJsonArray("views").forEach { x -> x.asJsonObject.addProperty("on", x.asJsonObject["mode"].asString == v) }
            }
            val mv = IdeaSheetModel.parse(j)!!
            for ((w, h) in listOf(390 to 3200, 954 to 3200)) shot("sheet-$v", w, h) {
                Box(Modifier.fillMaxSize()) { GameAccent("mtg") { IdeaSheet(mv.i, null, IdeaSheetActions({}, {}, {}), initial = mv) } }
            }
        }
    }

    @Test fun yugioh() {
        setUp()
        val f = fixture("ygo-ideas"); assumeTrue("run DecksIdeasTest first (it writes the models)", f != null)
        sizes("ygo") { Page(f!!, "ygo") }
    }
}
