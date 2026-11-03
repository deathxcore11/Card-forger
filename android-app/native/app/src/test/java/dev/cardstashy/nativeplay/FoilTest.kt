package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.play.CardData
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

/** Native foil choices against the web's own answers (scripts/export-card-data.mjs foil golden), and the AGSL port compiles. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [35])
class FoilTest {
    private fun res(n: String) = javaClass.classLoader!!.getResource(n)!!.readText()
    private val data = CardData.of(res("card-data.json"))

    @Test fun profilesMatchTheWeb() {
        val rows = JsonParser.parseString(res("foil-golden.json")).asJsonArray
        for (r in rows) { val o = r.asJsonObject; val card = o.getAsJsonObject("card"); val finish = o["finish"].asString
            val p = data.profile(card, finish)
            val what = "$card $finish"
            assertEquals(what, o["treatment"].asString, p.treatment)
            assertEquals(what, o["status"].asString, p.status)
            assertEquals(what, o["name"].asString, p.name)
            assertEquals(what, o["unrecognized"].asJsonArray.map { it.asString }, p.unrecognized)
            assertEquals(what, o["stamp"].asBoolean, CardData.holoStamp(card))
            assertEquals(what, o["frame"].asString, CardData.frameKey(card))
        }
    }

    @Test fun ruleWords() {
        assertEquals("Flying", data.rule("flying")!!.label)
        val hits = data.ruleRegex.findAll("Flying, trample\nWhen this enters, scry 2.").map { it.value.lowercase() }.toList()
        assert("flying" in hits && "trample" in hits && "scry" in hits) { hits.toString() }
    }

    @Test(expected = IllegalArgumentException::class) fun brokenShaderIsRefused() { android.graphics.RuntimeShader("half4 main(float2 p){ return nope; }") }

    @Test fun shaderCompiles() {
        try { android.graphics.RuntimeShader(dev.cardstashy.nativeplay.ui.Foil.AGSL) }
        catch (e: UnsupportedOperationException) { println("RuntimeShader not available here: ${e.message}") }
    }
}
