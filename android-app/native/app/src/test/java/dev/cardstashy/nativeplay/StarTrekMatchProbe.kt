package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.DemoDeck
import dev.cardstashy.nativeplay.match.DemoDecks
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Randall 14 Nov ("Forge doesn't know these 3 cards yet", "Fix star trek and new forge"): on the upgraded engine a deck with the
 * Star Trek cards he was refused (Elim Garak, Georgiou, Kai Winn) is admitted and plays a whole CPU match, with the scripted human
 * of RealMatchTest answering Kai Winn's card-name choice. Run with ENGINE_ROOT=<unpacked pack.zip>; the rules data is the app's seed.
 */
class StarTrekMatchProbe {
    @Test fun starTrekDeckPlaysAWholeMatch() {
        val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue("ENGINE_ROOT not set", root.isNotEmpty() && File(root).isDirectory)
        val repo = File(System.getProperty("repoRoot"))
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString())
        System.setProperty("proof.rulesData", File(repo, "android-app/native/app/src/main/assets/forge-rules-seed").absolutePath)
        val d = JsonParser.parseString(File(repo, "android-app/native/decks/demo-decks.json").readText()).asJsonObject
        val cpu = d.getAsJsonArray("decks")[0].asJsonObject.let { o -> DemoDeck(o.get("id").asString, o.get("name").asString, o.get("colour").asString, o.get("face").asString,
            o.getAsJsonArray("cards").map { c -> c.asJsonObject.let { it.get("name").asString to it.get("qty").asInt } }) }
        val trek = DemoDeck("trek", "Terran Empire", "B", "Georgiou, Terran Emperor", listOf(
            "Elim Garak, Simple Tailor" to 4, "Kai Winn, Faithless Leader" to 4, "Georgiou, Terran Emperor" to 4,
            "Vampire Nighthawk" to 4, "Gray Merchant of Asphodel" to 4, "Doom Blade" to 4, "Dark Ritual" to 4, "Hymn to Tourach" to 4, "Swamp" to 28))
        val decks = DemoDecks(d.get("format").asString, listOf(trek, cpu), emptyList(), emptyMap())
        println("init ms " + LocalEngine.init(root))
        val s = LocalEngine.start(decks.matchInput(trek, cpu), 20261114L + (System.getenv("SEED")?.toLong() ?: 0))
        val human = RealMatchTest(); val attacked = HashSet<String>()
        val t0 = System.currentTimeMillis(); val deadline = t0 + 420_000
        var end = "TIMEOUT"; var steps = 0; var trekCast = mutableSetOf<String>(); var lastRev = -1L
        while (System.currentTimeMillis() < deadline) {
            val raw = s.call("GET", "/state", null)
            val st = MatchState.parse(raw.body()) ?: run { if (System.getenv("TRACE") != null) println("RAW ${raw.status()} ${raw.body().take(400)}"); if (System.getenv("TRACE") != null && System.currentTimeMillis() - t0 > 30_000) { Thread.getAllStackTraces().forEach { (th, st) -> if (th.name.startsWith("forge") || th.name.contains("Game") || th.name.contains("pool")) { println("THREAD ${th.name} ${th.state}"); st.take(40).forEach { println("    at $it") } } }; end = "STUCK"; break }; Thread.sleep(200); null } ?: continue
            if (System.getenv("TRACE") != null && st.revision != lastRev) println("TRACE rev=${st.revision} turn=${st.turn} phase=${st.phase} status=${st.status} waiting=${st.waitingOnMe} busy=${st.busy} input=${st.inputType} prompt=${st.prompt?.method}")
            if (st.status == "failed") { end = "FAILED ${st.failure} ${st.errors}"; break }
            if (st.revision != lastRev) { lastRev = st.revision
                st.me.battlefield.forEach { if (it.name in setOf("Elim Garak, Simple Tailor", "Kai Winn, Faithless Leader", "Georgiou, Terran Emperor")) trekCast += it.name } }
            if (st.finished) { end = "FINISHED winner=${if (st.draw) "draw" else if (st.winnerPlayerId == st.viewer) "you" else "cpu"} turn ${st.turn} life ${st.me.life}-${st.cpu.life}"; break }
            if (st.turn > 30) { end = "TURN LIMIT"; break }
            if (!st.waitingOnMe) { Thread.sleep(15); continue }
            val body = human.decide(st, attacked) ?: run { Thread.sleep(15); null } ?: continue
            if (steps++ > 3000) { end = "STEP LIMIT"; break }
            body.addProperty("revision", st.revision)
            val r = s.call("POST", "/action", body.toString())
            if (r.status() != 202) println("  $body -> ${r.status()} ${r.body()}")
            val until = System.currentTimeMillis() + 3000
            while (System.currentTimeMillis() < until) { val n = MatchState.parse(s.call("GET", "/state", null).body()); if (n == null || n.revision != st.revision || n.busy) break; Thread.sleep(10) }
        }
        if (!end.startsWith("FINISHED")) MatchState.parse(s.call("GET", "/state", null).body())?.let { st ->
            println("STATE turn=${st.turn} phase=${st.phase} input=${st.inputType} prompt=${st.prompt} msg=${st.message.take(300)} err=${st.lastActionError}") }
        s.close()
        println("STAR TREK $end in ${(System.currentTimeMillis() - t0) / 1000}s, human steps $steps, on the battlefield: $trekCast")
        assertTrue(end, end.startsWith("FINISHED") || end == "TURN LIMIT")
        assertTrue("no Star Trek card reached the battlefield", trekCast.isNotEmpty())
    }
}
