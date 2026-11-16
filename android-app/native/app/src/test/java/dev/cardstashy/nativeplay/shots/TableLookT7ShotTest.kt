package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.HandFan
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.MatchBottom
import dev.cardstashy.nativeplay.ui.bottomAnswers
import dev.cardstashy.nativeplay.ui.PadAct
import dev.cardstashy.nativeplay.ui.askLine
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T7 (dual bottom screen reads the right card), pictures at the Thor and the Duo bottom: idle, a lifted card and asking.
 * The panel is under the hand and never meets it or the question; a lifted card is not bigger than the
 * others, only higher.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookT7ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private fun bottom(anchors: Anchors, st: MatchState, hand: List<Card>, lifted: Card?, file: String) =
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/$file.png").path) {
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF15171D), Color(0xFF0B0C10))))) {
                    MatchBottom(st, hand, lifted, PadAct("Pass") {}, { w -> HandFan(hand, w, Modifier.fillMaxWidth(), raised = lifted?.id, angleDeg = 1.2f, flatLift = true) }, {},
                        ask = askLine(st), live = true, canPlay = { it.isLand }, why = { "Not enough mana" }, onCancel = {})
                }
            }
        }

    private fun apart(a: Rect?, b: Rect?, what: String) { if (a != null && b != null) assertTrue("$what: $a meets $b", !a.overlaps(b)) }

    @Test fun thePanelReadsUnderTheHand() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val main = state("main").let { it.copy(stack = emptyList()) }
        val hand = main.me.hand
        for ((size, q) in listOf("thor-1240x1080" to "w620dp-h540dp-xhdpi", "duo-1280x960" to "w640dp-h480dp-xhdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            val ask4 = state("targets")
            // Two legal targets: the offered cards cut to the chosen one and one more, no players.
            val ask2 = ask4.copy(selection = ask4.selection.copy(targetCards = ask4.selection.targetCards.take(2).toSet() + ask4.selection.chosenCards, targetPlayers = emptySet(), players = emptySet()))
            for ((name, st, lifted) in listOf(Triple("idle", main, null), Triple("lifted", main, hand.getOrNull(1)), Triple("asking", ask4, null), Triple("asking2", ask2, null),
                    Triple("stack", state("crowded"), null))) {
                val anchors = Anchors()
                val asking = name.startsWith("asking")
                bottom(anchors, st, if (asking || name == "stack") st.me.hand else hand, lifted, "t7-$name-$size")
                val r = anchors.rects
                if (name != "stack") assertNotNull("$size $name: the panel", r["b.read"])
                if (asking) {
                    // Answer here or on the table: one button per legal target (at most 4), then Cancel, beside the panel.
                    val n = bottomAnswers(st).size
                    assertEquals("$size $name: answers", if (name == "asking") 4 else 2, n)
                    for (i in 0 until n) { assertNotNull("$size $name: answer $i", r["b.answer$i"]); for (k in listOf("b.read", "b.hand", "b.question")) apart(r["b.answer$i"], r[k], "$size $name answer $i and $k") }
                    // Every button whole inside the answers area (no scrolling hides Cancel or the fourth answer).
                    val box = r["b.answers"]!!
                    for (k in (0 until n).map { "b.answer$it" } + "b.cancel") assertTrue("$size $name: $k ${r[k]} whole in $box", r[k]!!.bottom <= box.bottom + 1f && r[k]!!.top >= box.top - 1f)
                    apart(r["b.answers"], r["b.read"], "$size $name answers and panel")
                    val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
                    assertTrue("$size $name: answers on screen ${r["b.answers"]}", r["b.answers"]!!.bottom <= dm.heightPixels + 1f && r["b.answers"]!!.right <= dm.widthPixels + 1f)
                }
                apart(r["b.hand"], r["b.read"], "$size $name hand and panel")
                apart(r["b.question"], r["b.read"], "$size $name question and panel")
                apart(r["b.question"], r["b.hand"], "$size $name question and hand")
                if (lifted != null) {
                    val up = r["hand${lifted.id}"]!!; val other = r["hand${hand.first { it.id != lifted.id }.id}"]!!
                    assertTrue("$size: the lift is not bigger ($up vs $other)", up.height <= other.height * 1.02f && up.width <= other.width * 1.02f)
                    assertNotNull("$size: the lift's ring", r["b.lift"])
                }
            }
        }
    }
}
