package dev.cardstashy.nativeplay

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.ui.Playmats
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config

/** Playmats against the web's own play-playmats.js and play-forge-table.css (scripts/playmats-golden.mjs). */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class PlaymatsTest {
    private val g = JsonParser.parseString(javaClass.classLoader!!.getResource("playmats-golden.json")!!.readText()).asJsonObject
    private val ids = g.getAsJsonArray("playmats").map { it.asJsonArray[0].asString }

    @Test fun matListMatchesPlayRules() {
        assertEquals(g.getAsJsonArray("playmats").map { it.asJsonArray[0].asString to it.asJsonArray[1].asString }, Playmats.list(RuntimeEnvironment.getApplication()))
    }

    @Test fun nextPlaymatMatchesWeb() {
        val randoms = g.getAsJsonArray("randoms").map { it.asDouble }
        g.getAsJsonArray("runs").forEachIndexed { n, r -> val run = r.asJsonObject
            val p = RuntimeEnvironment.getApplication().getSharedPreferences("mats-$n", 0)
            run.getAsJsonObject("init").entrySet().forEach { p.edit().putString(it.key, it.value.asString).commit() }
            assertEquals("choice $n", run["choice"].asString, Playmats.readChoice(ids, p))
            assertEquals("picks $n", run.getAsJsonArray("picks").map { it.asString }, randoms.map { x -> Playmats.next(ids, p) { x } })
            assertEquals("store $n", run.getAsJsonObject("after").entrySet().associate { it.key to it.value.asString }, p.all.mapValues { it.value as String })
        }
    }

    private fun boxes(o: JsonObject) = o.entrySet().associate { e -> e.key to e.value.asJsonArray.map { b -> b.asJsonArray.map { it.asInt } } }

    @Test fun sceneTablesMatchWeb() {
        assertEquals(boxes(g.getAsJsonObject("hedrons")), Playmats.HEDRONS.mapValues { e -> e.value.map { it.toList() } })
        assertEquals(boxes(g.getAsJsonObject("sparkles")), Playmats.SPARKLES.mapValues { e -> e.value.map { it.toList() } })
        assertEquals(boxes(g.getAsJsonObject("clouds")), Playmats.CLOUDS.mapValues { e -> e.value.map { it.toList() } })
        assertEquals(g.getAsJsonObject("halos").entrySet().associate { e -> e.key to e.value.asJsonArray.map { h -> h.asJsonArray.let { listOf(it[0].asInt, it[1].asInt, it[2].asInt, it[3].asString.lowercase()) } } },
            Playmats.HALOS.mapValues { e -> e.value.map { listOf(it.x, it.y, it.r, "#%06x".format(it.color and 0xFFFFFF)) } })
        assertEquals(g.getAsJsonObject("looks").entrySet().associate { e -> e.value.asJsonObject.let { l ->
                e.key to listOf(l["light"].asString, l["lightS"].asFloat, l["motes"]?.takeIf { !it.isJsonNull }?.asString, l["rise"].asFloat) } },
            Playmats.LOOKS.mapValues { (_, l) -> listOf(l.light, l.lightS, l.motes, l.rise) })
        assertEquals(g.getAsJsonObject("lights").entrySet().associate { e -> e.key to e.value.asJsonArray.map { s -> s.asJsonArray.let { it[0].asFloat to it[1].asFloat } } },
            Playmats.LIGHTS)
    }

    @Test fun everySceneFileIsBundled() {
        val assets = RuntimeEnvironment.getApplication().assets
        for (id in ids) for (tall in listOf(false, true)) for (f in Playmats.files(id, tall) + "play/playmat-$id-thumb.webp") assets.open(f).close()
    }
}
