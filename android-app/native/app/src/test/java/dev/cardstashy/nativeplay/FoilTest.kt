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

    /** Facet foil (app first, 7 Nov): facetfoil is its own material now, not traditional foil under the "Facet foil" name. */
    @Test fun facetFoilIsModelled() {
        val card = JsonParser.parseString("""{"set":"fra","frame":"2015","rarity":"mythic","border_color":"borderless","promo_types":["facetfoil"]}""").asJsonObject
        val p = data.profile(card, "foil")
        assertEquals("mtg-facet", p.treatment); assertEquals("family", p.status); assertEquals("", p.name)
        val r = data.recipes.getValue("mtg-facet")
        assertEquals(21f, r.pat); assertEquals(0f, r.cover); assertEquals("Facet foil", r.label)
        assertEquals("", data.profile(card, "nonfoil").treatment)
        // every other unmodelled material still draws as before
        val cosmic = JsonParser.parseString("""{"set":"fra","frame":"2015","promo_types":["cosmicfoil"]}""").asJsonObject
        assertEquals("mtg-traditional", data.profile(cosmic, "foil").treatment); assertEquals("Cosmic foil", data.profile(cosmic, "foil").name)
    }

    @Test fun ruleWords() {
        assertEquals("Flying", data.rule("flying")!!.label)
        val hits = data.ruleRegex.findAll("Flying, trample\nWhen this enters, scry 2.").map { it.value.lowercase() }.toList()
        assert("flying" in hits && "trample" in hits && "scry" in hits) { hits.toString() }
    }

    @Test(expected = IllegalArgumentException::class) fun brokenShaderIsRefused() { android.graphics.RuntimeShader("half4 main(float2 p){ return nope; }") }

    /** Every AGSL shader compiles: with RuntimeShader where this runtime really compiles (a broken one throws), and with Skia's own
     *  compiler off the phone (scripts/check-agsl.mjs, CanvasKit) whenever node and canvaskit-wasm are here (CANVASKIT_DIR). With
     *  neither, the test is skipped, never passed. */
    @Test fun shaderCompiles() {
        val all = mapOf("Foil" to dev.cardstashy.nativeplay.ui.Foil.AGSL, "Depth" to dev.cardstashy.nativeplay.foil.Depth.AGSL,
            "YgoFoil" to dev.cardstashy.nativeplay.foil.YgoFoil.AGSL, "PtcgFoil" to dev.cardstashy.nativeplay.foil.PtcgFoil.AGSL)
        val real = runCatching { android.graphics.RuntimeShader("half4 main(float2 p){return half4(1.);}") }.isSuccess &&
            runCatching { android.graphics.RuntimeShader("half4 main(float2 p){return nope;}") }.isFailure
        if (real) for ((name, agsl) in all) {
            try { android.graphics.RuntimeShader(agsl) } catch (e: IllegalArgumentException) { throw AssertionError("$name AGSL does not compile: ${e.message}", e) }
        }
        val script = java.io.File("../scripts/check-agsl.mjs").takeIf { it.isFile } ?: java.io.File("scripts/check-agsl.mjs")
        val node = runCatching {
            val p = ProcessBuilder("node", script.path, "src/main/java".takeIf { java.io.File(it).isDirectory } ?: "app/src/main/java").redirectErrorStream(true).start()
            val out = p.inputStream.bufferedReader().readText(); out to p.waitFor()
        }.getOrNull()?.takeIf { it.second != 2 }
        org.junit.Assume.assumeTrue("no shader compiler here (RuntimeShader stubbed, no node + canvaskit-wasm)", real || node != null)
        if (node != null) assertEquals(node.first, 0, node.second)
    }
}
