package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onRoot
import com.github.takahirom.roborazzi.captureRoboImage
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Collection mode's Home end to end, signed out, against the live site services: the bundled Home engine boots from the
 * app's assets, loads an empty workspace, fetches the Card of the Day, Meta and News, and the native page shows them.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class CollectionHomeRouteTest {
    @get:Rule val rule = createComposeRule()
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }

    @Test fun signedOutHomeFillsFromTheSite() {
        assumeTrue(File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/collection-engine.js").isFile)
        Motion.still = true
        val opened = mutableListOf<String>()
        rule.setContent { CollectionHomeRoute(onPlay = {}, onProfile = {}, web = { url, press -> opened += "$url ${press.orEmpty()}" }, open = { opened += it }) }
        // The empty account's value first, then the live feeds.
        rule.waitUntil(30_000) { rule.onAllNodesWithText("Ready for your first card").fetchSemanticsNodes().isNotEmpty() }
        rule.waitUntil(90_000) { rule.onAllNodesWithText("Card of the Day").fetchSemanticsNodes().isNotEmpty() && rule.onAllNodesWithText("Original source").fetchSemanticsNodes().isNotEmpty() }
        rule.onAllNodesWithText("No saved decks yet.").fetchSemanticsNodes().let { check(it.isNotEmpty()) { "no empty shelf" } }
        rule.onRoot().captureRoboImage(File(System.getProperty("shotsDir"), "collection-home-route-390x844.png").path)
        println("ROUTE OK ${RuntimeEnvironment.getQualifiers()}")
    }
}
