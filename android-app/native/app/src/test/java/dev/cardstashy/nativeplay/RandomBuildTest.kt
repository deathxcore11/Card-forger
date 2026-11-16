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

    /**
     * Gap audit G1: a finished background deck is kept on the device, so the next cold start hands it back to the queue and builds
     * nothing ("random queue: 1 on file, 0 to build"); peek gives the same deck. Another bundle's file is dropped.
     */
    @Test fun keptBetweenLaunches() = runBlocking {
        assumeTrue(bundle.isFile)
        RandomBuild.initFrom(bundle)
        val dir = kotlin.io.path.createTempDirectory("random-queue").toFile(); RandomBuild.keptDir = dir
        RandomBuild.restartForTest()
        RandomBuild.enqueue(listOf("Standard" to null), "keeper")
        val first = kotlinx.coroutines.withTimeout(600_000) { RandomBuild.awaitReady("Standard") }[0]
        val file = RandomBuild.keptFile("keeper")!!
        kotlinx.coroutines.withTimeout(10_000) { while (!file.isFile) kotlinx.coroutines.delay(100) }
        // A cold start: a new engine, the file still there.
        RandomBuild.restartForTest()
        val t0 = System.currentTimeMillis()
        RandomBuild.enqueue(listOf("Standard" to null), "keeper")
        val again = kotlinx.coroutines.withTimeout(15_000) { RandomBuild.awaitReady("Standard") }[0]
        println("[kept] back in ${(System.currentTimeMillis() - t0) / 1000.0}s: ${again.get("name")}")
        assertEquals(1 to 0, RandomBuild.lastRestore)
        assertEquals(first.get("name"), again.get("name"))
        assertEquals(first.getAsJsonArray("cards"), again.getAsJsonArray("cards"))
        // Another bundle's file is not handed out: it is dropped.
        file.writeText(file.readText().replace(Regex("\"v\":\"[0-9a-f]+\""), "\"v\":\"old\""))
        assertEquals(null, RandomBuild.keptFor("keeper"))
        assertEquals(false, file.exists())
        RandomBuild.keptDir = null
    }
}
