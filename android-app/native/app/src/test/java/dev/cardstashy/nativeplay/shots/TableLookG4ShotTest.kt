package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.CardInspect
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.TileBadges
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
 * 0.4.60 G4 (specs/glance-marks-brief.md, "Keyword boxes in the inspect view"): CardInspect gives each current keyword its own glass
 * box with the tile's icon, the name and the KEYWORD_HINTS sentence. On a single screen the boxes stand in a column on the far side
 * of the card from the glass box; when the width is short they go under the rules. Drawn at the 844 × 390 phone, the 1280 × 800
 * tablet and the 884 × 796 tablet (short width: under the rules) for Mordant Dragon (Flying, Haste) and Akroma, Angel of Wrath (all
 * six keywords). Shots in table-look/g4-*.png.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookG4ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    private fun state(s: String) = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-$s.json")!!.readText())!!

    @After fun off() { DualScreen.pretend(null) }

    private class Sz(val tag: String, val q: String, val beside: Boolean)
    private val sizes = listOf(Sz("844x390", "w844dp-h390dp-land-xxhdpi", true), Sz("1280x800", "w1280dp-h800dp-land-mdpi", true),
        Sz("884x796", "w884dp-h796dp-land-xhdpi", false))

    private val dragonText = "Flying, haste\nWhenever Mordant Dragon deals combat damage to a player, you may have it deal that much damage to target creature that player controls."
    private val akromaText = "Flying, first strike, vigilance, trample, haste, protection from black and from red"

    /** The crowded table with your first creature made Mordant Dragon (attacking, 1 damage) and the second Akroma. */
    private fun table(): Triple<MatchState, Card, Card> {
        val st = state("crowded")
        val mine = st.me.battlefield.filter { it.isCreature && it.attachedTo == null && it.attachments.isEmpty() }
        val dragon = mine[0].copy(name = "Mordant Dragon", type = "Creature — Dragon", manaCost = "{3}{R}{R}{R}", text = dragonText, power = 5, toughness = 5,
            damage = 1, attacking = true, tapped = true, summoningSick = false, counters = emptyMap(), keywords = listOf("Flying", "Haste"), keywordsKnown = true)
        val akroma = mine[1].copy(name = "Akroma, Angel of Wrath", type = "Legendary Creature — Angel", manaCost = "{5}{W}{W}{W}", text = akromaText, power = 6, toughness = 6,
            damage = 0, attacking = false, tapped = false, summoningSick = false, counters = emptyMap(),
            keywords = listOf("Flying", "First Strike", "Vigilance", "Trample", "Haste", "Protection from black", "Protection from red"), keywordsKnown = true)
        val me = st.me.copy(battlefield = st.me.battlefield.map { when (it.id) { dragon.id -> dragon; akroma.id -> akroma; else -> it } })
        return Triple(st.copy(players = st.players.map { if (it.id == st.viewer) me else it }), dragon, akroma)
    }

    private fun draw(name: String, st: MatchState, card: Card, size: Sz): Anchors {
        RuntimeEnvironment.setQualifiers(size.q)
        DualScreen.pretend(null)
        dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
        var seen: Anchors? = null
        captureRoboImage(File(System.getProperty("shotsDir"), "table-look/g4-$name-${size.tag}.png").path) {
            val anchors = remember { Anchors() }.also { seen = it }
            CompositionLocalProvider(LocalAnchors provides anchors) {
                Box(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                    CardInspect(card, st.viewer) {}
                }
            }
        }
        return seen!!
    }

    private fun inside(inner: Rect, outer: Rect) = inner.left >= outer.left - .5f && inner.right <= outer.right + .5f && inner.top >= outer.top - .5f && inner.bottom <= outer.bottom + .5f

    @Test fun keywordBoxesBesideTheCardOrUnderTheRules() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val (st, dragon, akroma) = table()
        for (size in sizes) for ((label, c) in listOf("dragon" to dragon, "akroma" to akroma)) {
            val who = "${size.tag} ${c.name}"
            val a = draw(label, st, c, size)
            val m = RuntimeEnvironment.getApplication().resources.displayMetrics
            val screen = Rect(0f, 0f, m.widthPixels.toFloat(), m.heightPixels.toFloat())
            val card = a.rects["inspectCard${c.id}"] ?: error("$who: no card")
            val col = a.rects["inspectKws${c.id}"] ?: error("$who: no keyword boxes")
            // Every keyword the tile shows, in the tile's order, each with the tile's icon: Akroma's six, the Dragon's two.
            val tileKeys = TileBadges.of(c, false)!!.strip.map { it.key }
            assertEquals("$who: one box per keyword", if (label == "akroma") 6 else 2, tileKeys.size)
            val boxes = tileKeys.indices.map { i -> a.rects["inspectKw${c.id}.$i"] ?: error("$who: no box $i") }
            assertTrue("$who: no box past the last keyword", a.rects["inspectKw${c.id}.${tileKeys.size}"] == null)
            tileKeys.indices.forEach { i -> assertNotNull("$who: box $i has the tile's icon", a.rects["inspectKwIcon${c.id}.$i"]) }
            boxes.forEachIndexed { i, b ->
                assertTrue("$who: box $i $b on screen", inside(b, screen))
                assertTrue("$who: box $i $b off the card $card", b.right <= card.left + .5f || b.left >= card.right - .5f)
                assertTrue("$who: box $i with height", b.height > 0f)
                if (i > 0) assertTrue("$who: box $i under box ${i - 1}", b.top >= boxes[i - 1].bottom - .5f)
            }
            // All of them show: none scrolled out of the column, the last one whole.
            assertTrue("$who: the last box ${boxes.last()} whole in the column $col", boxes.last().bottom <= col.bottom + .5f && boxes.last().height > 20f)
            if (size.beside) {
                // The far side of the card from the glass box (the glass is on its left).
                assertTrue("$who: the column $col right of the card $card", col.left >= card.right - .5f)
                assertTrue("$who: the whole column shows within the card's height", boxes.last().bottom <= card.bottom + .5f)
            } else {
                // A short width: under the rules, inside the glass box left of the card.
                assertTrue("$who: the boxes $col under the rules, left of the card $card", col.right <= card.left + .5f)
            }
            println("[g4] $who: ${tileKeys.size} boxes ${if (size.beside) "beside the card" else "under the rules"}, column $col, card $card")
        }
    }
}
