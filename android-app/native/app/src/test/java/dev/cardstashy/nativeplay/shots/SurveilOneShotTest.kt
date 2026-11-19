package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.dp
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.Du
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.ScryKind
import dev.cardstashy.nativeplay.ui.ScryOne
import dev.cardstashy.nativeplay.ui.ScryOneView
import dev.cardstashy.nativeplay.ui.TableBubble
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.chromeU
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Explains itself E4 (specs/explains-itself-briefs.md, approved 19 Nov): a one-card surveil shows its card in the scry view, with
 * Graveyard on the left. Forge's question is the one seen in an engine run on 11 Nov (Meticulous Archive). Pictures in
 * explains-itself, for the eye; they are desktop renders, never device proof.
 */
abstract class SurveilOneShots(private val tag: String) {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()
    private fun cap(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "explains-itself/$name-$tag.png").path) }
    private fun r(key: String) = anchors.rects[key] ?: error("no anchor $key")

    @Test fun surveilOne() {
        val land = base.me.battlefield.first().copy(id = 9301, name = "Meticulous Archive", type = "Land — Plains Island",
            text = "({T}: Add {W} or {U}.)\nThis land enters tapped.\nWhen this land enters, surveil 1.")
        val ask = base.copy(inputType = "InputConfirm", buttons = Buttons("Library", "Graveyard", true, true), prompt = null,
            stack = listOf(StackItem(9300, "Meticulous Archive — When this land enters, surveil 1.", land, base.viewer, ability = true, trigger = true)),
            message = "Plains (12)\n\nPut Plains on the top of library or graveyard?")
        assertEquals(ScryKind.SURVEIL, ScryOne.kind(ask)); assertEquals("Plains", ScryOne.of(ask))
        var answer: Boolean? = null
        dev.cardstashy.nativeplay.ui.Motion.still = true
        rule.setContent {
            var cur by remember { mutableStateOf(ask) }
            var told by remember { mutableStateOf<String?>(null) }
            val after = { top: Boolean -> answer = top; told = ScryOne.result(if (top) ScryOne.TOP else ScryOne.BOTTOM, ScryKind.SURVEIL)
                cur = ask.copy(inputType = "InputPassPriority", buttons = Buttons("OK", null, true, false), stack = emptyList(), message = "") }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    ForgeBoard(cur, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    ScryOne.of(cur)?.let { n -> BoxWithConstraints(Modifier.fillMaxSize()) { ScryOneView(cur, n, true, Du(chromeU(maxWidth, maxHeight)), { after(true) }, { after(false) }) } }
                    told?.let { t -> BoxWithConstraints(Modifier.fillMaxSize()) { TableBubble(t, Du(chromeU(maxWidth, maxHeight)), Modifier.align(Alignment.TopCenter).padding(top = 96.dp)) } }
                }
            }
        }
        rule.waitForIdle(); rule.waitForIdle()
        cap("surveil-one")
        for (w in listOf("Surveil 1", "Top of your deck or your graveyard", "GRAVEYARD", "TOP", "Done", "View table")) rule.onNodeWithText(w).assertExists()
        val card = r("scrycard"); val grave = r("scryzone:Graveyard"); val top = r("scryzone:Top")
        assertTrue("Graveyard on the left, Top on the right of the card: $grave $card $top", grave.right <= card.left && top.left >= card.right)
        // Tap Graveyard: the card settles there; nothing is answered until Done.
        rule.onNode(hasContentDescription("Graveyard")).performClick()
        cap("surveil-one-graveyard")
        assertTrue("the card sits in the Graveyard zone", r("scrycard").center.let { it.x in grave.left..grave.right && it.y in grave.top..grave.bottom })
        assertEquals(null, answer)
        rule.onNodeWithText("Done").performClick(); rule.waitForIdle()
        assertEquals("Graveyard is Forge's cancel", false, answer)
        rule.onNodeWithText("Surveil: 0 top, 1 graveyard").assertExists()
        cap("surveil-one-done")
    }
}

@RunWith(RobolectricTestRunner::class) @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class SurveilOneFoldShotTest : SurveilOneShots("fold")

@RunWith(RobolectricTestRunner::class) @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(sdk = [35], qualifiers = "w844dp-h390dp-xhdpi")
class SurveilOnePhoneShotTest : SurveilOneShots("phone")
