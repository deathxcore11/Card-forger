package dev.cardstashy.nativeplay.shots

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import com.github.takahirom.roborazzi.captureRoboImage
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.ForgeBoard
import dev.cardstashy.nativeplay.ui.Glow
import dev.cardstashy.nativeplay.ui.Mark
import dev.cardstashy.nativeplay.ui.ShortCasts
import org.junit.Assert.assertEquals
import dev.cardstashy.nativeplay.ui.LocalAnchors
import dev.cardstashy.nativeplay.ui.Palette
import dev.cardstashy.nativeplay.ui.PlaymatScene
import dev.cardstashy.nativeplay.ui.TableIntents
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/**
 * glow-rules.md, the three lights on snap-main: at rest (ice rings on what you can cast, the dashed violet ring on a permanent
 * with an ability), and with Skewer the Critics lifted (the violet ring steps back, the three sources Forge would tap glow gold).
 * The fixture gains a Prodigal Sorcerer (140, "{T}: deals 1 damage") Forge offers, and Skewer (103) the tapPreview the bridge
 * would send. The lights each shot must show are asserted from the same state first, so a wrong light fails here, not only by eye.
 */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class GlowShotTest {
    init { dev.cardstashy.nativeplay.art.CardArt.init(RuntimeEnvironment.getApplication()) }

    private fun state(): MatchState {
        val o = JsonParser.parseString(javaClass.classLoader!!.getResource("table/snap-main.json")!!.readText()).asJsonObject
        val act = o.getAsJsonObject("selection").getAsJsonArray("actionable")
        for (row in act) { val r = row.asJsonObject; if (r.get("id").asInt == 103) r.add("tapPreview", JsonParser.parseString("[110,112,113]")) }
        val sorcerer = JsonParser.parseString("""{"id":140,"owner":1,"controller":1,"zone":"Battlefield","hidden":false,"name":"Prodigal Sorcerer",
            "type":"Creature — Human Wizard","manaCost":"{2}{U}","text":"{T}: Prodigal Sorcerer deals 1 damage to any target.","power":1,"toughness":1,
            "tapped":false,"summoningSick":false,"counters":{}}""")
        o.getAsJsonArray("players")[0].asJsonObject.getAsJsonObject("zones").getAsJsonObject("Battlefield").getAsJsonArray("cards").add(sorcerer)
        act.add(JsonObject().apply { addProperty("kind", "card"); addProperty("id", 140); addProperty("affordability", "available") })
        return MatchState.parse(o.toString())!!
    }

    @Test fun threeLights() {
        dev.cardstashy.nativeplay.ui.Motion.still = true
        RuntimeEnvironment.setQualifiers("w844dp-h390dp-land-xxhdpi")
        val st = state()
        // What the shots must show: ice on the six castables, the violet ring only on the Sorcerer, gold on Skewer's three sources.
        val marks = Glow.boardMarks(st, true)
        assertEquals(setOf(100, 101, 102, 103, 105, 106), marks.filterValues { it == Mark.PLAYABLE }.keys)
        assertEquals(setOf(140), marks.filterValues { it == Mark.USABLE }.keys)
        val sc = ShortCasts(); val bl = sc.blocked(st)
        assertEquals(setOf(110, 112, 113), Glow.payment(st, true, st.card(103), bl, sc.quiet(st, bl)))
        for ((name, lifted) in listOf("rest" to null, "lifted" to 103)) {
            dev.cardstashy.nativeplay.ui.TableEmotes.destroy()
            captureRoboImage(File(System.getProperty("shotsDir"), "glow/glow-$name-844x390.png").path) {
                CompositionLocalProvider(LocalAnchors provides remember { Anchors() }) {
                    Box(Modifier.fillMaxSize().background(Palette.Night)) {
                        PlaymatScene(Modifier.fillMaxSize())
                        ForgeBoard(st, live = true, intents = TableIntents(), selectedHand = lifted, onSelectHand = {}, onInspect = {}, onMenu = {},
                            handOrder = emptyList(), onHandOrder = {})
                    }
                }
            }
        }
    }
}
