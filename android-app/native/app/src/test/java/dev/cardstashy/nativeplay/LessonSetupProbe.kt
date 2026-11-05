package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import dev.cardstashy.nativeplay.play.StoryLessons
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/** Story lessons on the in-app engine: stacked names exist in the decks, and a local match deals the stacked seven, no mulligan, you first. */
class LessonSetupProbe {
    @Test fun lessons() {
        val repo = File(System.getProperty("repoRoot"))
        val lessons = StoryLessons(JsonParser.parseString(File(repo, "android-app/native/app/src/main/assets/story-lessons.json").readText()).asJsonObject)
        val act = JsonParser.parseString(File(repo, "data/story/act-1.json").readText()).asJsonObject
        val root = System.getProperty("engineRoot").orEmpty()
        val engine = root.isNotEmpty() && File(root).isDirectory
        if (engine) { System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath); println("init ms " + LocalEngine.init(root)) }
        for (id in listOf("a1b1", "a1b2", "a1b3", "a1b4")) {
            val b = act.getAsJsonArray("battles").map { it.asJsonObject }.first { it["id"].asString == id }
            val hero = b.getAsJsonObject("hero").getAsJsonObject("deck"); val cpu = b.getAsJsonObject("lessonDeck").getAsJsonObject("deck")
            val setup = lessons.setup(id)!!; val stack = setup.getAsJsonObject("stack")
            fun counts(d: JsonObject) = d.getAsJsonArray("cards").associate { it.asJsonObject["name"].asString to it.asJsonObject["qty"].asInt }
            fun check(side: String, d: JsonObject): List<String> { val have = counts(d); return stack.getAsJsonArray(side).map { it.asString }.groupingBy { it }.eachCount()
                .filter { (n, q) -> (have[n] ?: 0) < q }.map { (n, q) -> "$n x$q (deck ${have[n] ?: 0})" } }
            println("CHECK $id keys=${stack.keySet()} hero-missing=${check("hero", hero)} villain-missing=${check("villain", cpu)}")
            if (!engine) continue
            val s = LocalEngine.start(forgeInput("Vintage", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
            val until = System.currentTimeMillis() + 60_000; var st: MatchState? = null
            while (System.currentTimeMillis() < until) { st = MatchState.parse(s.call("GET", "/state", null).body()); if (st != null && (st.waitingOnMe || st.status == "failed")) break; Thread.sleep(50) }
            val me = st?.let { x -> listOf(x.me, x.cpu).first { it.isViewer } }
            val want = stack.getAsJsonArray("hero").take(7).map { it.asString }.sorted()
            println("MATCH $id status=${st?.status} turn=${st?.turn} active=${st?.activePlayer} viewer=${st?.viewer} mulligan=${st?.isMulligan} prompt=${st?.prompt?.method} hand=${me?.hand?.map { it.name }?.sorted()} stackedSeven=$want same=${me?.hand?.map { it.name }?.sorted() == want}")
            s.close()
        }
    }
}
