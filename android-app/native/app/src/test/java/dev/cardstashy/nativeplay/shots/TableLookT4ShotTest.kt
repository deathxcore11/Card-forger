package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.Card
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableGeometry
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.aurasOn
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * 0.4.59 T4 (fault 25, aura look A): auras peek above their creature as strips, one strip per aura raised 15 % of the tile each,
 * two at most with "+N" on the upper one. Your Hill Giant wears one, your Grizzly Bears two, your Goblin Guide three (two strips
 * and +1), the CPU's Hill Giant one. No strip lies on a tile of another row, and a creature wearing auras stands alone.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class TableLookT4ShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }

    private fun board(): MatchState {
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText())!!
        var next = 800
        val auras = mutableListOf<Card>()
        fun wear(c: Card, vararg names: String): Card {
            val ids = names.map { n -> val a = c.copy(id = next++, name = n, type = "Enchantment — Aura", power = null, toughness = null, tapped = false, attacking = false, attachedTo = c.id, attachments = emptyList()); auras += a; a.id }
            return c.copy(attachments = ids)
        }
        fun dress(cs: List<Card>) = cs.map { c -> when (c.name) {
            "Hill Giant" -> wear(c, "Ethereal Armor")
            "Grizzly Bears" -> if (c.controller == st.viewer) wear(c, "Shardmage's Rescue", "Feather of Flight") else c
            "Goblin Guide" -> wear(c, "Ethereal Armor", "Feather of Flight", "Sheltered by Ghosts")
            else -> c } }
        val players = st.players.map { p -> p.copy(battlefield = dress(p.battlefield)) }
        return st.copy(players = players.map { p -> p.copy(battlefield = p.battlefield + auras.filter { a -> players.any { q -> q.id == p.id && q.battlefield.any { it.id == a.attachedTo } } }) })
    }

    @Test fun aurasPeekAboveTheirCreature() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val st = board()
        for ((size, q) in listOf("844x390" to "w844dp-h390dp-land-xxhdpi", "1280x800" to "w1280dp-h800dp-land-mdpi")) {
            RuntimeEnvironment.setQualifiers(q)
            var seen: Anchors? = null
            captureRoboImage(File(System.getProperty("shotsDir"), "table-look/t4-auras-$size.png").path) {
                val anchors = remember { Anchors() }.also { seen = it }
                CompositionLocalProvider(LocalAnchors provides anchors) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = false, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {}, handOrder = emptyList(), onHandOrder = {})
                    }
                }
            }
            val a = seen!!
            val creatures = (st.cpu.battlefield + st.me.battlefield).filter { it.isCreature && it.attachedTo == null }
            for (c in creatures) {
                val auras = aurasOn(c) { st.card(it) }
                val strips = auras.take(TableGeometry.STRIPS_MAX).mapNotNull { a.rects["aura${it.id}"] }
                assertEquals("$size ${c.name} strips", minOf(auras.size, TableGeometry.STRIPS_MAX), strips.size)
                val tile = a.rects.getValue("c${c.id}")
                // Each strip rises above its tile: its top is above the tile's, by 15 % of the tile per strip above it.
                strips.forEachIndexed { i, r -> assertTrue("$size ${c.name} strip $i: $r over $tile", r.top < tile.top - 1) }
                // Not on any tile of another row: the other side's creatures and its own side's back row.
                val others = (st.cpu.battlefield + st.me.battlefield).filter { it.attachedTo == null && (it.controller != c.controller || !it.isCreature) }
                for (r in strips) for (o in others) a.rects["c${o.id}"]?.let { or ->
                    assertTrue("$size ${c.name}'s strip on ${o.name}: $r $or", !r.deflate(1f).overlaps(or.deflate(1f))) }
            }
            val dm = RuntimeEnvironment.getApplication().resources.displayMetrics
            println("[t4] $size creature tile ${a.rects.getValue("c${creatures.first().id}").height / dm.density} dp")
        }
    }
}
