package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.click
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performTouchInput
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Buttons
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.engine.Ref
import dev.cardstashy.nativeplay.engine.StackItem
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.StackRead
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/**
 * Explains itself E3 (specs/explains-itself-briefs.md, approved 19 Nov): four items on the stack, as in Randall's 19 Nov recording
 * (three CPU triggers and a spell); a tap opens one for reading beside the stack, a tap on the board puts it back. Pictures in
 * explains-itself, for the eye; they are desktop renders, never device proof.
 */
abstract class StackReadShots(private val tag: String) {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()); CardImageTest.art = { _, _ -> null } }
    @get:org.junit.Rule val rule = androidx.compose.ui.test.junit4.createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val base = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!.copy(prompt = null)
    private val anchors = Anchors()
    private fun cap(name: String) { rule.waitForIdle(); rule.onRoot().captureRoboImage(java.io.File(System.getProperty("shotsDir"), "explains-itself/$name-$tag.png").path) }
    private fun r(key: String) = anchors.rects[key] ?: error("no anchor $key")
    private fun tap(at: androidx.compose.ui.geometry.Offset) { rule.onRoot().performTouchInput { click(at) }; rule.waitForIdle() }

    @Test fun readAnyItem() {
        val cpu = base.players.first { it.id != base.viewer }
        val giant = cpu.battlefield.first { it.name == "Hill Giant" }; val bears = cpu.battlefield.first { it.name == "Grizzly Bears" }
        val grave = cpu.graveyard.first { it.name == "Counterspell" }
        val guide = base.me.battlefield.first { it.name == "Goblin Guide" }
        val stack = listOf(
            StackItem(904, "Goblin Guide \u2014 Whenever this creature attacks, defending player reveals the top card of their library. If it's a land card, that player puts it into their hand.", guide, base.viewer, ability = true, trigger = true),
            StackItem(903, "Hill Giant \u2014 When this creature enters, it deals 1 damage to any target.", giant, cpu.id, ability = true, trigger = true, targets = listOf(Ref("card", guide.id, guide.name))),
            StackItem(902, "Grizzly Bears \u2014 When this creature enters, return target instant card from your graveyard to your hand.", bears, cpu.id, ability = true, trigger = true, noted = listOf(Ref("card", grave.id, grave.name))),
            StackItem(901, "Hill Giant \u2014 At the beginning of your upkeep, you gain 1 life.", giant, cpu.id, ability = true, trigger = true))
        val st = base.copy(stack = stack, buttons = Buttons("OK", null, true, false))
        val inspected = mutableListOf<String>()
        dev.cardstashy.nativeplay.ui.Motion.still = true; StackRead.open = null
        rule.setContent { CompositionLocalProvider(LocalAnchors provides anchors) { Box(Modifier.fillMaxSize().background(Palette.Night)) {
            ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = { inspected += it.name }, onMenu = {}, handOrder = emptyList(), onHandOrder = {}) } } }
        rule.waitForIdle(); rule.waitForIdle()
        cap("stack-closed")
        // A tap on the top card opens it for reading; it no longer opens the whole card page at once.
        val top = r("stackcard")
        tap(top.center)
        assertEquals(904, StackRead.open); assertTrue(inspected.isEmpty())
        rule.onNodeWithText("Happens next").assertExists()
        val panel = r("stackread")
        assertTrue("the reader stands left of the stack card, on the screen: $panel vs $top", panel.right <= top.left && panel.left >= 0f && panel.top >= 0f)
        assertEquals("the top card never moves", top, r("stackcard"))
        // The third item (the brief's picture): whose, when, its words, and the card it is about.
        rule.runOnIdle { StackRead.open = 902 }; rule.waitForIdle()
        cap("stack-read-third")
        for (w in listOf("Happens 3rd", "In the CPU's graveyard")) rule.onNodeWithText(w).assertExists()
        val words = r("stackreadwords"); val open = r("stackread")
        assertTrue("its words stand inside the reader: $words in $open", words.height > 0f && words.top >= open.top && words.bottom <= open.bottom)
        // The art opens the whole card, as the stack card's tap did before.
        tap(r("stackreadart").center)
        assertEquals(listOf("Grizzly Bears"), inspected); assertNull(StackRead.open)
        // A tap on the board puts it back.
        rule.runOnIdle { StackRead.open = 903 }; rule.waitForIdle()
        cap("stack-read-second")
        rule.onNodeWithText("Happens 2nd").assertExists(); rule.onNodeWithText("On your side").assertExists()
        tap(androidx.compose.ui.geometry.Offset(r("stackreaddim").left + 40f, r("stackreaddim").center.y))
        assertNull(StackRead.open)
    }
}

@RunWith(RobolectricTestRunner::class) @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(sdk = [35], qualifiers = "w884dp-h796dp-xhdpi")
class StackReadFoldShotTest : StackReadShots("fold")

@RunWith(RobolectricTestRunner::class) @GraphicsMode(GraphicsMode.Mode.NATIVE) @Config(sdk = [35], qualifiers = "w844dp-h390dp-xhdpi")
class StackReadPhoneShotTest : StackReadShots("phone")
