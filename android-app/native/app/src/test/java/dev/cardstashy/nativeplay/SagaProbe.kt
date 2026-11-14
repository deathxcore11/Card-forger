package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Mobile table M13: a Saga shows its chapter number. Plays a real match to History of Benalia and prints, each time the table
 * waits on you, the counters Forge reports on it and the marks the tile would draw. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class SagaProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun historyOfBenaliaCountsItsChapters() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 56, "History of Benalia" to 4)
        val cpu = deck("Forest" to 56, "Memnite" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Plains", "Plains", "Plains", "History of Benalia", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains").forEach { add(it) } })
            add("villain", JsonArray().apply { listOf("Forest", "Forest", "Forest", "Forest", "Forest", "Forest", "Forest", "Forest", "Forest").forEach { add(it) } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 200_000; var lastRev = -1L; var last = ""
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            if (st.status == "failed" || st.finished || st.turn > 11) { println("END ${st.status} turn=${st.turn}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            st.me.battlefield.firstOrNull { it.name == "History of Benalia" }?.let { c ->
                val b = dev.cardstashy.nativeplay.ui.TileBadges.of(c, false)
                val line = "SAGA turn=${st.turn} type=<<${c.type}>> counters=${c.counters} badges=${b?.counters} plaque=${b?.plaque}"
                if (line != last) { println(line); last = line }
            }
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(p.options.first().index) }) }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && st.stack.isEmpty() -> {
                        val next = hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == "History of Benalia" && st.me.battlefield.none { b -> b.name == it.name } }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            s.call("POST", "/action", body.toString())
        }
        s.close()
    }
}
