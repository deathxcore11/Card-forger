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

/** Randall 5 Nov: the CPU's Break Under Pressure (target opponent sacrifices…) left the table on a dead OK. Plays a real match to that moment and prints what Forge asks. */
class SacrificeProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun breakUnderPressure() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 44, "Savannah Lions" to 4, "Glory Seeker" to 4, "Elite Vanguard" to 4, "Eager Cadet" to 4)
        val cpu = deck("Swamp" to 56, "Break Under Pressure" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Plains", "Savannah Lions", "Plains", "Glory Seeker", "Plains", "Plains", "Plains", "Plains", "Glory Seeker").forEach { add(it) } })
            add("villain", JsonArray().apply { listOf("Swamp", "Swamp", "Swamp", "Break Under Pressure", "Break Under Pressure", "Swamp", "Swamp", "Swamp", "Swamp").forEach { add(it) } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 240_000; var lastRev = -1L; var seen = 0
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            if (st.status == "failed" || st.finished) { println("END ${st.status} " + raw.take(1500)); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val bup = st.stack.any { (it.source?.name ?: it.text).contains("Break Under Pressure") }
            if (bup || (st.inputType != "InputPassPriority" && st.inputType != "InputAttack" && st.inputType != "InputBlock") || st.prompt != null) {
                println("ASK turn=${st.turn} phase=${st.phase} input=${st.inputType} prompt=${st.prompt?.method}/${st.prompt?.message} buttons=${st.buttons} sel=${st.selection} stack=${st.stack.map { it.source?.name + ":" + it.text }}")
                println("MSG <<${st.message}>>")
                if (bup && st.inputType != "InputPassPriority") {
                    val j = JsonParser.parseString(raw).asJsonObject
                    println("RAW " + j.entrySet().filter { it.key !in setOf("players", "cards", "log", "zones") }.joinToString(" ") { "${it.key}=${it.value.toString().take(600)}" })
                    if (++seen >= 1) {
                        println("ASKLINE " + dev.cardstashy.nativeplay.ui.askLine(st))
                        File(repo, "android-app/native/app/src/test/resources/forge/sacrifice-choice-state.json").apply { parentFile.mkdirs() }.writeText(raw)
                        // Tap the first creature Forge offers, then watch what follows.
                        s.call("POST", "/action", JsonObject().apply { addProperty("revision", st.revision); addProperty("op", "card"); addProperty("id", st.selection.cards.first()) }.toString())
                        var r2 = st.revision; val t2 = System.currentTimeMillis() + 20_000; var n = 0
                        while (System.currentTimeMillis() < t2 && n < 4) {
                            val x = MatchState.parse(s.call("GET", "/state", null).body()) ?: continue
                            if (x.revision == r2 || x.busy) { Thread.sleep(40); continue }
                            r2 = x.revision; n++
                            println("AFTER rev=${x.revision} waiting=${x.waitingOnMe} input=${x.inputType} buttons=${x.buttons} sel=${x.selection.cards}/${x.selection.chosenCards} stack=${x.stack.size} myField=${x.me.battlefield.map { it.name }} cpuLife=${x.cpu.life} msg=<<${x.message.take(200)}>>")
                            if (x.waitingOnMe && x.inputType == "InputSelectCardsFromList" && x.buttons.okEnabled) s.call("POST", "/action", JsonObject().apply { addProperty("revision", x.revision); addProperty("op", "ok") }.toString())
                        }
                        break
                    }
                }
            }
            // Drive: play a land, then a creature, else OK; attack with nothing; no blocks.
            val my = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val pick = if (st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1") (my.firstOrNull { it.isLand } ?: my.firstOrNull()) else null
            val body = JsonObject().apply { addProperty("revision", st.revision)
                when { st.prompt != null -> { addProperty("op", "reply"); addProperty("promptId", st.prompt!!.id); add("indexes", JsonArray().apply { add(0) }) }
                    pick != null -> { addProperty("op", "card"); addProperty("id", pick.id) }
                    else -> addProperty("op", "ok") } }
            s.call("POST", "/action", body.toString())
        }
        s.close()
    }
}
