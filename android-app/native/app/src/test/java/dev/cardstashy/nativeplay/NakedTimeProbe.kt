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
 * Randall's 19 Nov recording of 0.4.98: The Naked Time's chapter cards were empty and its effect's trigger read "ABILITY / ABILITY";
 * a banner read "The Naked Time (116)'s Effect". Plays a real match to those moments and prints Forge's own words for each stack
 * item and event, and what the stack card would draw. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class NakedTimeProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun whatForgeSaysForTheNakedTime() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Mountain" to 26, "Plains" to 26, "The Naked Time" to 4, "Cosmogrand Zenith" to 4)
        val cpu = hero
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Mountain", "Mountain", "The Naked Time", "Plains", "Plains", "Cosmogrand Zenith", "Plains", "Plains", "Plains", "Plains", "Plains").forEach { add(it) } })
            add("villain", JsonArray().apply { listOf("Mountain", "Mountain", "The Naked Time", "Plains", "Plains", "Cosmogrand Zenith", "Plains", "Cosmogrand Zenith", "Plains", "Plains", "Plains").forEach { add(it) } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput(System.getenv("FORMAT") ?: "Standard", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 240_000; var lastRev = -1L; val seen = mutableSetOf<String>(); var seq = 0L
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            for (item in st.stack) {
                val line = "STACK turn=${st.turn} ctrl=${item.controller} viewer=${st.viewer} id=${item.id} ability=${item.ability} trigger=${item.trigger} src=${item.source?.name}/${item.source?.id}/${item.source?.zone} text=<<${item.text}>>" +
                    " chapter=${dev.cardstashy.nativeplay.ui.SagaMarks.stackChapter(item)} words=<<${dev.cardstashy.nativeplay.ui.SagaMarks.chapterWords(item.text)}>>"
                if (seen.add(line)) println(line)
            }
            for (e in st.events) if (e.seq > seq) { seq = e.seq; if (e.type !in setOf("zone", "shuffle", "land", "turn", "mulligan") || e.cause != null || e.source != null) println("EVENT turn=${st.turn} type=${e.type} card=${e.card} source=${e.source} target=${e.target} cause=${e.cause} by=${e.by} stackId=${e.stackId} counter=${e.counter} amount=${e.amount}") }
            if (st.message.isNotBlank() && seen.add("M" + st.message)) println("MESSAGE <<${st.message}>>")
            (st.me.command + (runCatching { st.cpu.command }.getOrNull() ?: emptyList())).forEach { c -> if (seen.add("C" + c.name + c.text)) println("COMMAND name=<<${c.name}>> text=<<${c.text}>>") }
            if (st.status == "failed" || st.finished || st.turn > 12) { println("END ${st.status} turn=${st.turn} failure=${st.failure}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null -> { println("PROMPT <<${p.message}>> ${p.options.map { it.label }}"); addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(p.options.last().index) }) }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && st.stack.isEmpty() -> {
                        if (st.turn >= 3) println("MAIN turn=${st.turn} fullHand=${st.me.hand.map { it.name }} hand=${hand.map { it.name }} sagaCounters=${st.me.battlefield.firstOrNull { it.name == "The Naked Time" }?.counters} command=${st.me.command.map { it.name }}")
                        val saga = st.me.battlefield.firstOrNull { it.name == "The Naked Time" }
                        val next = hand.firstOrNull { it.name == "Mountain" } ?: hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == "The Naked Time" }
                            ?: hand.firstOrNull { it.name == "Cosmogrand Zenith" && st.me.command.any { c -> c.name.contains("Naked Time") } }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            s.call("POST", "/action", body.toString())
        }
        s.close()
    }
}
