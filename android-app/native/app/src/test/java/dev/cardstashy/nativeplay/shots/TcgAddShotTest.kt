package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performSemanticsAction
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.account.Account
import dev.cardstashy.nativeplay.account.Decks
import dev.cardstashy.nativeplay.collection.CollectionEngine
import dev.cardstashy.nativeplay.ui.CollectionWrites
import dev.cardstashy.nativeplay.ui.CollectionWritesHost
import dev.cardstashy.nativeplay.ui.Site
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * A Yu-Gi-Oh! and a Pokémon card's Add to collection (tcg.js tcgAddSheet), as tadd/cap.cjs captures it on the live site: the first
 * set's first card opened from its set page (Swiftwind Panther Warrior, BETB; Charizard, 30th), its card page's Add to collection.
 * The real path: this device's copy, the engine, the host. On the Fold's cover screen (390 × 844) and unfolded (884 × 1104).
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class TcgAddShotTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val app get() = RuntimeEnvironment.getApplication()
    private fun settle(n: Int = 20) = repeat(n) { Thread.sleep(100); rule.mainClock.advanceTimeBy(100); rule.waitForIdle() }
    private fun shot(name: String) = rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "tadd-$name.png").path)

    private fun run(w: Int) {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        // The card's picture, fetched here as the app's image loader would.
        dev.cardstashy.nativeplay.ui.homeArt = { url -> runCatching { java.net.URI(url).toURL().openStream().use { android.graphics.BitmapFactory.decodeStream(it) }?.asImageBitmap() }.getOrNull() ?: url }
        Account.setForTest(Account.Session("t", "r", Long.MAX_VALUE, "u", "randall@example.com"), null)
        dev.cardstashy.nativeplay.ui.HomeCache.loaded = null; dev.cardstashy.nativeplay.ui.HomeCache.warm = false
        val ws = JsonParser.parseString(javaClass.getResource("/account-writes/lot-edit.json")!!.readText()).asJsonObject["before"].asJsonObject
        Decks.deviceFile(app, "u").apply { parentFile?.mkdirs() }.writeText(ws.toString())
        dev.cardstashy.nativeplay.ui.catalogFile(app).writeText("{}")
        rule.setContent { Box(Modifier.fillMaxSize().background(Site.Bg)) { CollectionWritesHost() } }
        settle(5)
        for (g in listOf("ygo", "ptcg")) {
            val id = runBlocking {
                CollectionWrites.deckPickModel(app, g)
                CollectionEngine.sets(g); CollectionEngine.setsLoad(); CollectionEngine.settle(60_000)
                val set = CollectionEngine.setsModel()["sections"].asJsonArray.flatMap { it.asJsonObject["rows"].asJsonArray.map { r -> r.asJsonObject } }.first()["code"].asString
                CollectionEngine.set(g, set); CollectionEngine.setLoad(); CollectionEngine.settle(120_000)
                val tile = CollectionEngine.setModel()["tiles"].asJsonArray.map { it.asJsonObject }.first()
                CollectionEngine.tcard(JsonObject().apply { addProperty("game", g); addProperty("id", tile["id"].asString); tile["open"].asJsonObject.entrySet().forEach { (k, v) -> add(k, v) } })
                CollectionEngine.tcardLoad(); CollectionEngine.settle(120_000)
                tile["id"].asString
            }
            try {
                CollectionWrites.tAdding.value = CollectionWrites.TcgAddOpen(JsonObject().apply { addProperty("game", g); addProperty("id", id) })
                settle(60)
                shot("$g-$w")
                rule.onNode(hasScrollAction()).performSemanticsAction(SemanticsActions.ScrollBy) { it(0f, 5000f) }; settle()
                shot("$g-$w-end")
            } finally { CollectionWrites.tAdding.value = null; settle(5) }
        }
    }

    @Test fun cover() = run(390)
    @Config(qualifiers = "w884dp-h1104dp-xxhdpi")
    @Test fun unfolded() = run(884)
}
