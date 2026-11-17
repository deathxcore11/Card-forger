package dev.cardstashy.nativeplay.shots

import android.graphics.BitmapFactory
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asImageBitmap
import com.github.takahirom.roborazzi.captureRoboImage
import dev.cardstashy.nativeplay.art.CardImageTest
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.DecisionDock
import dev.cardstashy.nativeplay.ui.DockReplies
import dev.cardstashy.nativeplay.ui.DualScreen
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import dev.cardstashy.nativeplay.ui.ZoneLayout
import dev.cardstashy.nativeplay.ui.chromeU
import dev.cardstashy.nativeplay.ui.nameAsk
import dev.cardstashy.nativeplay.ui.namePanelBox
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * Randall 17 Nov (Petrified Hamlet, tablet): "Choose a land card card name." wrapped into the hand, and the name box, its hint and
 * Confirm lay behind the hand cards, so the land could not be named. The prompt is a framed panel above the hand now, on the board's
 * right, clear of the right strip, and the doubled "card" is gone.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class NamePromptShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }
    private val art = File(System.getProperty("shotsDir")!!).parentFile.resolve("app/build/shot-art/table")
    private fun key(name: String, crop: Boolean) = java.security.MessageDigest.getInstance("SHA-1").digest("$name|$crop".toByteArray()).joinToString("") { "%02x".format(it) }
    @After fun off() { DualScreen.pretend(null); CardImageTest.art = null }

    private class Sz(val tag: String, val w: Float, val h: Float, val q: String, val dual: Boolean)
    private val sizes = listOf(
        Sz("phone-844x390", 844f, 390f, "w844dp-h390dp-land-xxhdpi", false),
        Sz("thor-960x540", 960f, 540f, "w960dp-h540dp-land-xhdpi", false),
        Sz("thor-dualtop-960x540", 960f, 540f, "w960dp-h540dp-land-xhdpi", true),
        Sz("tablet-1252x1128", 1252f, 1128f, "w1252dp-h1128dp-land-mdpi", false))

    @Test fun theAskReadsOnce() {
        assertEquals("Choose a land card name.", nameAsk("Choose a land card card name."))
        assertEquals("Choose a nonland card name.", nameAsk("Choose a nonland card name."))
        assertEquals("Choose a card name", nameAsk(""))
    }

    @Test fun thePanelStandsAboveTheHand() {
        for (s in sizes) {
            val k = ZoneLayout.scale(s.w, s.h)
            val z = ZoneLayout.of(s.w, s.h, dual = s.dual, k = k)
            for (ime in listOf(0f, s.h * .45f)) {
                val b = namePanelBox(s.w, s.h, s.dual, k, ime)
                z.handTray?.let { assertFalse("${s.tag} ime=$ime: the panel meets the hand", b.meets(it)) }
                z.handChip?.let { assertFalse("${s.tag}: the panel meets the hand chip", b.meets(it)) }
                assertTrue("${s.tag}: the panel stays on the board's width", b.x >= z.board.x && b.right <= z.board.right)
                assertTrue("${s.tag} ime=$ime: the panel ends above the keyboard", b.bottom <= s.h - ime)
                assertTrue("${s.tag} ime=$ime: room for the ask, the box and Confirm (${b.h})", b.h >= 120f * k)
            }
        }
    }

    /** The names on the table come first: the CPU's lands whose abilities Hamlet stops, then its other lands, its graveyard, yours. */
    @Test fun theTableOffersItsLands() {
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-dock-name.json")!!.readText())!!
        val g = dev.cardstashy.nativeplay.ui.nameGroups(st, dev.cardstashy.nativeplay.engine.CardNames.want(st.prompt!!.message))
        assertEquals(listOf("CPU BATTLEFIELD", "CPU GRAVEYARD", "YOURS"), g.map { it.label })
        assertEquals(listOf("Mutavault", "Otawara, Soaring City", "Island"), g[0].tiles.map { it.name })
        assertEquals(listOf(true, true, false), g[0].tiles.map { it.ability }); assertEquals(3, g[0].tiles[2].count)
        assertEquals(listOf("Field of Ruin"), g[1].tiles.map { it.name })
        assertTrue("no creature or spell is offered", g.flatMap { it.tiles }.none { it.name in setOf("Grizzly Bears", "Counterspell", "Lightning Bolt", "Sol Ring") })
        assertEquals(listOf("Forest", "Mountain", "Petrified Hamlet"), g[2].tiles.map { it.name })
        assertFalse(dev.cardstashy.nativeplay.ui.hasNonManaAbility("({T}: Add {G}.)"))
        assertFalse(dev.cardstashy.nativeplay.ui.hasNonManaAbility("{T}: Add {C}."))
    }

    @Test fun shots() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        CardImageTest.art = { name, crop -> art.resolve(key(name, crop) + ".jpg").takeIf { it.exists() }?.let { BitmapFactory.decodeFile(it.path)?.asImageBitmap() } }
        val st = MatchState.parse(javaClass.classLoader!!.getResource("table/snap-dock-name.json")!!.readText())!!
        assertEquals(34350, st.prompt!!.nameCount)
        for (s in sizes) {
            RuntimeEnvironment.setQualifiers(s.q)
            DualScreen.pretend(if (s.dual) DualScreen.Panel(2, "Built-in Screen", 1240, 1080, 60f) else null)
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            captureRoboImage(File(System.getProperty("shotsDir"), "table/name-prompt-${s.tag}.png").path) {
                BoxWithConstraints(Modifier.fillMaxSize().background(Palette.Night)) {
                    PlaymatScene(Modifier.fillMaxSize())
                    ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = null, onSelectHand = {}, onInspect = {}, onMenu = {},
                        handOrder = emptyList(), onHandOrder = {})
                    DecisionDock(st, live = true, intents = TableIntents(), onInspect = {}, u = chromeU(maxWidth, maxHeight), replies = DockReplies(text = { _, _ -> }))
                }
            }
        }
    }
}
