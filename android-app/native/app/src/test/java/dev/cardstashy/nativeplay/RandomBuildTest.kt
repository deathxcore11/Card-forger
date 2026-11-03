package dev.cardstashy.nativeplay

import dev.cardstashy.nativeplay.play.RandomBuild
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/** The site's random builder in QuickJS against the live card service: Standard 60 and Commander 100, with the site's status lines. */
class RandomBuildTest {
    private val bundle = File(System.getProperty("repoRoot"), "android-app/native/app/src/main/assets/random-build.js")
    private fun build(format: String, size: Int) = runBlocking {
        assumeTrue(bundle.isFile)
        RandomBuild.initFrom(bundle)
        val seen = mutableListOf<String>(); val t0 = System.currentTimeMillis()
        val watch = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.IO).launch { RandomBuild.state.collect { st -> if (seen.lastOrNull() != st.status) { seen += st.status; println("  ${(System.currentTimeMillis() - t0) / 1000.0}s ${st.status}") } } }
        RandomBuild.start(format)
        val s = RandomBuild.awaitDone(); watch.cancel()
        println("[$format] ${(System.currentTimeMillis() - t0) / 1000.0}s error=${s.error} name=${s.deck?.get("name")} power=${s.deck?.get("power")}\n${s.trace}")
        assertEquals(null, s.error)
        assertEquals(size, s.deck!!.getAsJsonArray("cards").sumOf { it.asJsonObject.get("qty").asInt })
    }
    @Test fun standard() = build("Standard", 60)
    @Test fun commander() = build("Commander", 100)
}

