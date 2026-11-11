package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.AutoPass
import dev.cardstashy.nativeplay.match.forgeInput
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Mobile table M1, M3, M4 (Randall 11 Nov: the Scavenger's counter asked as a bare "Select target creature"; Resolve had to be
 * pressed after a trigger with a chosen target). Plays a real match to an aura with two triggers and prints what Forge says at
 * each question and each pass. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class TriggerTargetProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun auraWithTwoTriggers() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 48, "Optimistic Scavenger" to 4, "Sheltered by Ghosts" to 4, "Seam Rip" to 4)
        val cpu = deck("Swamp" to 52, "Memnite" to 4, "Ornithopter" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Plains", "Optimistic Scavenger", "Plains", "Sheltered by Ghosts", "Plains", "Seam Rip", "Plains", "Plains", "Plains").forEach { add(it) } })
            add("villain", JsonArray().apply { listOf("Swamp", "Memnite", "Ornithopter", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp", "Swamp").forEach { add(it) } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 200_000; var lastRev = -1L
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            if (st.status == "failed" || st.finished || st.turn > 5) { println("END ${st.status} turn=${st.turn}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val top = st.stack.firstOrNull()
            val quiet = st.inputType == "InputPassPriority" && top == null
            if (!quiet) {
                println("STATE rev=${st.revision} turn=${st.turn} phase=${st.phase} active=${st.activePlayer} prio=${st.priorityPlayer} viewer=${st.viewer} input=${st.inputType} mode=${st.controlMode} stops=${st.phaseStops} buttons=${st.buttons}")
                println("  stack=" + st.stack.map { "${it.id}:${it.source?.name}:ctl=${it.controller}:ability=${it.ability}:trigger=${it.trigger}:targets=${it.targets.map { t -> t.kind + t.id }}" })
                println("  sel min=${st.selection.min} max=${st.selection.max} cards=${st.selection.cards} targetCards=${st.selection.targetCards} players=${st.selection.players} chosen=${st.selection.chosenCards}")
                println("  MSG <<${st.message}>>")
                st.prompt?.let { p -> println("  PROMPT ${p.method} supported=${p.supportedExact} ordered=${p.ordered} min=${p.min} max=${p.max} msg=<<${p.rawMessage.ifEmpty { p.message }}>> options=${p.options.map { it.index to it.label.take(60) }}") }
                println("  ASKLINE=${dev.cardstashy.nativeplay.ui.askLine(st)} | asker=${dev.cardstashy.nativeplay.ui.asker(st)} | resolvesItself=${AutoPass.resolvesItself(st, false)} | autoOrder=${AutoPass.triggerOrder(st, false)} | onlyTarget=${AutoPass.onlyTarget(st)}")
                println("  EVENTS " + st.events.takeLast(6).joinToString(" | ") { e -> "${e.seq}:${e.type}:${e.card?.name ?: e.source?.name ?: ""}:${e.from ?: ""}>${e.to ?: ""}" })
            }
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val mine = st.me.battlefield
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null && p.method == "order" -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { p.options.forEach { add(it.index) } }); addProperty("remember", false) }
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(0) }) }
                    st.inputType == "InputSelectTargets" -> {
                        val offered = st.selection.cards + st.selection.targetCards
                        val own = offered.firstOrNull { st.card(it)?.controller == st.viewer && st.card(it)?.isCreature == true }
                        val theirs = offered.firstOrNull { st.card(it)?.controller != st.viewer }
                        val wantsTheirs = st.message.contains("opponent controls", true)
                        val pick = (if (wantsTheirs) theirs else own) ?: offered.firstOrNull()
                        if (pick != null && pick !in st.selection.chosenCards) { addProperty("op", "card"); addProperty("id", pick) } else addProperty("op", "ok")
                    }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && top == null -> {
                        val next = hand.firstOrNull { it.isLand } ?: hand.firstOrNull { it.name == "Optimistic Scavenger" }
                            ?: hand.firstOrNull { it.name == "Sheltered by Ghosts" && mine.any { c -> c.isCreature } } ?: hand.firstOrNull { it.name == "Seam Rip" && mine.any { c -> c.isCreature } }
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            if (!quiet) println("  -> " + body)
            s.call("POST", "/action", body.toString())
        }
        s.close()
    }
}
