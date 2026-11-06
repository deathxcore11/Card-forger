package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.play.RandomBuild
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * The site's random builder in QuickJS against the live card service: Standard 60 and Commander 100, with the site's status lines;
 * a Strong Modern deck (all 8 formats build now); and the background queue (play-random-queue.js), whose finished deck Build random
 * deck hands over at once.
 */
class RandomBuildTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/random-build.js")
    private fun build(format: String, size: Int, power: String? = null) = runBlocking {
        assumeTrue(bundle.isFile)
        RandomBuild.initFrom(bundle)
        val seen = mutableListOf<String>(); val t0 = System.currentTimeMillis()
        val watch = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch { RandomBuild.state.collect { st -> if (seen.lastOrNull() != st.status) { seen += st.status; println("  ${(System.currentTimeMillis() - t0) / 1000.0}s ${st.status}") } } }
        RandomBuild.start(format, power = power)
        val s = RandomBuild.awaitDone(); watch.cancel()
        println("[$format] ${(System.currentTimeMillis() - t0) / 1000.0}s error=${s.error} name=${s.deck?.get("name")} power=${s.deck?.get("power")}\n${s.trace}")
        assertEquals(null, s.error)
        assertEquals(size, s.deck!!.getAsJsonArray("cards").sumOf { it.asJsonObject.get("qty").asInt })
    }
    @Test fun standard() = build("Standard", 60)
    @Test fun commander() = build("Commander", 100)
    @Test fun modernStrong() = build("Modern", 60, "strong")

    /**
     * Quick Play's Power reads (quickContext: the format's tournament data, the decks' card data, mtg-tags, then the site's
     * capturePracticeDeckContext) in QuickJS give the numbers the WebView's bundle gave in Chromium for the same ten Story lists as
     * Vintage decks (6 Nov).
     */
    @Test fun quickContext() = runBlocking {
        assumeTrue(bundle.isFile)
        RandomBuild.initFrom(bundle)
        val story = File(System.getProperty("repoRoot"), "data/story").listFiles { f -> f.name.matches(Regex("act-\\d+\\.json")) }!!.sortedBy { it.name }
        val decks = story.flatMap { f -> com.google.gson.JsonParser.parseString(f.readText()).asJsonObject.getAsJsonArray("battles").flatMap { b ->
            listOf("hero", "villain").mapNotNull { side -> b.asJsonObject.getAsJsonObject(side)?.get("deck")?.takeIf { it.isJsonObject }?.asJsonObject?.takeIf { it.get("cards")?.isJsonArray == true } } } }
            .take(10).mapIndexed { i, d -> d.deepCopy().apply { addProperty("id", "s$i"); addProperty("format", "Vintage") } }
        val t0 = System.currentTimeMillis()
        val r = RandomBuild.quickContext("Vintage", decks).await()!!
        println("[quickContext] ${(System.currentTimeMillis() - t0) / 1000.0}s $r")
        assertEquals(listOf(52, 39, 46, 45, 53, 48, 59, 54, 51, 61), r.map { it.asJsonObject["power"].asInt })
    }

    /** A deck the queue finished in the background is handed over at once, and the queue starts the next one. */
    @Test fun queued() = runBlocking {
        assumeTrue(bundle.isFile)
        RandomBuild.initFrom(bundle)
        val t0 = System.currentTimeMillis()
        RandomBuild.enqueue(listOf("Standard" to null), "u")
        val ready = kotlinx.coroutines.withTimeout(600_000) { RandomBuild.awaitReady("Standard") }
        println("[queue] Standard ready in ${(System.currentTimeMillis() - t0) / 1000.0}s power=${ready[0].get("power")}")
        val t1 = System.currentTimeMillis()
        RandomBuild.start("Standard", user = "u")
        val s = RandomBuild.awaitDone()
        val took = System.currentTimeMillis() - t1
        println("[queue] Build random deck took ${took}ms name=${s.deck?.get("name")}")
        assertEquals(null, s.error)
        assertEquals(60, s.deck!!.getAsJsonArray("cards").sumOf { it.asJsonObject.get("qty").asInt })
        org.junit.Assert.assertTrue("handed over at once ($took ms)", took < 2_000)
    }
}

