package dev.cardstashy.nativeplay

import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performScrollToIndex
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeUp
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.PlayMath
import dev.cardstashy.nativeplay.play.PlayRules
import dev.cardstashy.nativeplay.ui.PlayHome
import dev.cardstashy.nativeplay.ui.PlayHomeData
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Play home scrolled top to bottom on the parity fixture at Fold size: every section must compose and settle fast. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class HomeScrollTest {
    @get:Rule val rule = createComposeRule()

    @Test @Config(qualifiers = "w868dp-h964dp-xxhdpi") fun inner() = run("inner")
    @Test @Config(qualifiers = "w390dp-h860dp-xxhdpi") fun cover() = run("cover")
    @Test(timeout = 120000) @Config(qualifiers = "w300dp-h860dp-xxhdpi") fun narrow() = run("narrow")
    @Test(timeout = 120000) @Config(qualifiers = "w411dp-h960dp-xxhdpi") fun fold() = run("fold")
    @Test(timeout = 120000) @Config(qualifiers = "w673dp-h749dp-xhdpi") fun innerPortrait() = run("innerP")

    /** Randall's shape: thousands of cards across many sets, a pile of sealed packs, a full Merchant, many decks. */
    private fun inflate(state: com.google.gson.JsonObject) {
        val sets = listOf("dsk","fdn","blb","otj","mkm","lci","woe","ltr","mom","one","dmu","bro","snc","neo","vow","mid","afr","stx","khm","znr","m21","iko","thb","eld","war","rna","grn","dom","rix","xln","isd","mh2","mh3","hob","fra","msh")
        val cards = state.getAsJsonArray("cards"); val proto = cards[0].asJsonObject
        for (i in 0 until 4000) cards.add(proto.deepCopy().apply { addProperty("o", "id-$i"); addProperty("n", "Card $i"); add("s", com.google.gson.JsonArray().apply { add(sets[i % sets.size]); add(sets[(i * 7) % sets.size]) }) })
        val packs = state.getAsJsonArray("packs"); val pp = packs[0].asJsonObject
        for (i in 0 until 80) packs.add(pp.deepCopy().apply { addProperty("id", 1000 + i); addProperty("set", sets[i % sets.size]) })
        val shop = state.getAsJsonArray("shop"); val sp = shop[0].asJsonObject
        for (i in 0 until 30) shop.add(sp.deepCopy().apply { addProperty("code", sets[i % sets.size]); addProperty("name", "Set $i") })
        val decks = state.getAsJsonArray("decks"); val dp = decks[0].asJsonObject
        for (i in 0 until 25) decks.add(dp.deepCopy().apply { addProperty("id", "d-$i"); addProperty("name", "Deck $i") })
    }

    private fun run(label: String) {
        dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication())
        val fixture = File("/mnt/project-files/design/native/parity/fixtures/progress-state.json")
        val state = JsonParser.parseString(fixture.readText()).asJsonObject
        val rules = PlayRules(JsonParser.parseString(javaClass.classLoader!!.getResource("play-rules.json")!!.readText()).asJsonObject)
        inflate(state)
        println("[$label] fixture cards=${state.getAsJsonArray("cards")?.size()} packs=${state.getAsJsonArray("packs")?.size()} shop=${state.getAsJsonArray("shop")?.size()} decks=${state.getAsJsonArray("decks")?.size()}")
        var t = System.nanoTime()
        repeat(3) { val t0 = System.nanoTime(); val rows = PlayMath.achievements(rules, state); PlayMath.almostThere(rows, 2); println("[$label] achievements ${(System.nanoTime() - t0) / 1_000_000} ms") }
        repeat(2) { val t0 = System.nanoTime(); PlayMath.quests(rules, state, "2026-11-03", ""); println("[$label] quests ${(System.nanoTime() - t0) / 1_000_000} ms") }
        t = System.nanoTime()
        rule.setContent { PlayHome(PlayHomeData(state, rules, PlayMath.StoryHome(1, 0, false), "2026-11-03"), top = {}, nav = {}) }
        rule.waitForIdle()
        println("[$label] first frame ${(System.nanoTime() - t) / 1_000_000} ms")
        for (i in 0..7) {
            t = System.nanoTime()
            runCatching { rule.onNodeWithTag("playHome").performScrollToIndex(i); rule.waitForIdle() }.onFailure { println("index $i: ${it.message?.take(80)}") }
            println("[$label] scroll to item $i: ${(System.nanoTime() - t) / 1_000_000} ms")
        }
        repeat(6) { k ->
            t = System.nanoTime()
            rule.onNodeWithTag("playHome").performTouchInput { swipeUp() }; rule.waitForIdle()
            println("[$label] swipe $k: ${(System.nanoTime() - t) / 1_000_000} ms")
        }
        println("[$label] sections: " + dev.cardstashy.nativeplay.FreezeReport.sectionLine())
        val before = dev.cardstashy.nativeplay.FreezeReport.sectionLine()
        repeat(20) { rule.mainClock.advanceTimeByFrame() }; rule.waitForIdle()
        println("[$label] after 20 idle frames: " + dev.cardstashy.nativeplay.FreezeReport.sectionLine())
    }
}
