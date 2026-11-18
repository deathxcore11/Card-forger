package dev.cardstashy.nativeplay.ui

import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeLeft
import androidx.compose.ui.test.onNodeWithTag
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.io.File
import dev.cardstashy.nativeplay.progressStateText

/** Hand brief (0.4.96) on the parity fixture, upright phone: the header shows the deck, a swipe picks the mode, the card's Play starts it. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], qualifiers = "w390dp-h844dp-xxhdpi")
class PlayStageTest {
    @get:Rule val rule = createComposeRule()

    private fun home(deck: HomeDeck?, log: MutableList<String>) {
                dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        Motion.still = true
        val state = JsonParser.parseString(progressStateText()).asJsonObject
        val rules = PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        val act = PlayHomeActions(mode = { log += "mode:$it" }, story = { log += "story" }, play = { log += "play:$it" })
        rule.setContent { PlayHome(PlayHomeData(state, rules, PlayMath.StoryHome(1, 0, false), "2026-11-03", deck = deck), top = {}, act = act, nav = {}) }
        rule.waitForIdle()
    }

    @Test fun playStartsQuickPlayWithTheShownDeck() {
        val log = mutableListOf<String>()
        home(HomeDeck("d1", "Mono-White Auras", "Standard", 60, null), log)
        rule.onNodeWithText("Mono-White Auras", substring = true).assertExists()
        rule.onNodeWithText("YOUR DECK · STANDARD · 60").assertExists()
        rule.onNodeWithContentDescription("Quick Play").assertIsSelected()
        rule.onNodeWithContentDescription("Play, Quick Play").performClick()
        assertEquals(listOf("play:d1"), log)
    }

    @Test fun swipingToAModeChangesWhatPlayStarts() {
        val log = mutableListOf<String>()
        home(HomeDeck("d1", "Mono-White Auras", "Standard", 60, null), log)
        // A thumb drag of about half a card, as a person swipes (a full-width 200 ms fling drags past the next card before it lets go).
        rule.onNodeWithTag("hand").performTouchInput { swipeLeft(startX = centerX + width * .2f, endX = centerX - width * .2f, durationMillis = 300) }; rule.waitForIdle()
        rule.onNodeWithContentDescription("Practice").assertIsSelected()
        rule.onNodeWithContentDescription("Play, Practice").performClick()
        // The deck name opens the mode in focus without starting (Randall 18 Nov, "Tap the deck name to change").
        rule.onNodeWithContentDescription("Change deck", substring = true).performClick()
        assertEquals(listOf("mode:practice", "mode:practice"), log)
    }

    /** Pack finish brief D: no Change button; the deck name opens Quick Play's screen without starting; Play still plays the deck. */
    @Test fun deckNameIsTheChangeButton() {
        val log = mutableListOf<String>()
        home(HomeDeck("d1", "Mono-White Auras", "Standard", 60, null), log)
        assertEquals(0, rule.onAllNodes(androidx.compose.ui.test.hasText("Change")).fetchSemanticsNodes().size)
        rule.onNodeWithContentDescription("Change deck, Mono-White Auras").performClick()
        assertEquals(listOf("mode:quick"), log)
        rule.onNodeWithContentDescription("Play, Quick Play").performClick()
        assertEquals(listOf("mode:quick", "play:d1"), log)
    }

    @Test fun noDeckOpensQuickPlay() {
        val log = mutableListOf<String>()
        home(null, log)
        rule.onNodeWithText("Pick a deck", substring = true).assertExists()
        rule.onNodeWithContentDescription("Play, Quick Play").performClick()
        assertEquals(listOf("mode:quick"), log)
    }

    /** Hand brief 5: the Weekly tab shows a weekly quest; the card's daily is the first unclaimed one. */
    @Test fun questCardTabs() {
        val log = mutableListOf<String>()
        home(HomeDeck("d1", "Mono-White Auras", "Standard", 60, null), log)
        val state = JsonParser.parseString(progressStateText()).asJsonObject
        val rules = PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        val items = QuestTurn.items(PlayMath.quests(rules, state, "2026-11-03", ""))
        println("[quests] " + items.map { (if (it.weekly) "W " else "D ") + it.row.quest.label })
        items.firstOrNull { !it.weekly }?.let { rule.onNodeWithText(it.row.quest.label).assertExists() }
        val wk = items.firstOrNull { it.weekly } ?: return
        rule.onNodeWithText("Weekly", substring = true).performClick(); rule.waitForIdle()
        rule.onNodeWithText(wk.row.quest.label).assertExists()
    }
}

/**
 * Randall's Fold open (screen recording 18 Nov, 1080x1200 px at 2.625 density over 1968x2184 is about 750x833 dp): the chosen
 * card read "Quick Pl…". Every mode name in the wide row must lay out whole, with no ellipsis.
 */
@RunWith(RobolectricTestRunner::class)
@org.robolectric.annotation.GraphicsMode(org.robolectric.annotation.GraphicsMode.Mode.NATIVE) // real text measuring; legacy mode gives a name 10 px
@Config(sdk = [35], qualifiers = "w750dp-h833dp-420dpi")
class PlayHandFoldOpenTest {
    @get:Rule val rule = createComposeRule()

    @Test fun modeNamesAreNeverCut() {
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        Motion.still = true
        val state = JsonParser.parseString(progressStateText()).asJsonObject
        val rules = PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        rule.setContent { PlayHome(PlayHomeData(state, rules, PlayMath.StoryHome(1, 0, false), "2026-11-03", deck = HomeDeck("d1", "Imported deck", "Standard", 60, null)), top = {}, act = PlayHomeActions(), nav = {}) }
        rule.waitForIdle()
        for (name in listOf("Quick Play", "Practice", "Friends", "Story", "Planeswalk")) {
            val node = rule.onNodeWithText(name, useUnmergedTree = true).fetchSemanticsNode()
            val out = mutableListOf<androidx.compose.ui.text.TextLayoutResult>()
            node.config[androidx.compose.ui.semantics.SemanticsActions.GetTextLayoutResult].action?.invoke(out)
            val r = out.single()
            // No ellipsis, every line inside the box, and a line may only break between words ("PLANESWAL / K" is a cut too).
            val ellipsis = (0 until r.lineCount).any { r.isLineEllipsized(it) }
            val wide = (0 until r.lineCount).any { r.getLineRight(it) > r.size.width + .5f }
            val midWord = (0 until r.lineCount - 1).any { val e = r.getLineEnd(it); e in 1 until name.length && name[e - 1] != ' ' && name[e] != ' ' }
            assertEquals("$name is cut", false, ellipsis || wide || midWord)
        }
    }
}
