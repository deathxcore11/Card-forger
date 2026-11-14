package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Mobile table M9 ("say when nothing happens"): Seam Rip enters while the opponent has nothing it can exile. Prints every
 * event Forge's bridge reports from the cast on, as sent, so the table shows a line only if the engine says one.
 * Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class NoTargetProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun seamRipWithNothingToExile() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 56, "Seam Rip" to 4)
        val cpu = deck("Swamp" to 60)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Plains", "Seam Rip", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains").forEach { add(it) } })
            add("villain", JsonArray().apply { repeat(9) { add("Swamp") } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 120_000; var lastRev = -1L; var seen = 0L
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            if (st.status == "failed" || st.finished || st.turn > 2) { println("NOTARGET END ${st.status} turn=${st.turn} ${st.failure} ${st.errors}"); break }
            if (st.revision != lastRev) {
                val items = JsonParser.parseString(raw).asJsonObject.getAsJsonObject("events")?.getAsJsonArray("items")
                items?.forEach { e -> val q = e.asJsonObject.get("seq")?.asLong ?: 0L; if (q > seen) { seen = q; println("NOTARGET EVENT $e") } }
            }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            println("NOTARGET STATE rev=${st.revision} turn=${st.turn} phase=${st.phase} input=${st.inputType} msg=<<${st.message}>> stack=${st.stack.map { it.source?.name + ":trigger=" + it.trigger }} prompt=${st.prompt?.method}")
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(0) }) }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && st.stack.isEmpty() -> {
                        val next = hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == "Seam Rip" }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok") }
                    else -> addProperty("op", "ok")
                } }
            println("NOTARGET   -> $body")
            s.call("POST", "/action", body.toString())
        }
        s.close()
    }
}
