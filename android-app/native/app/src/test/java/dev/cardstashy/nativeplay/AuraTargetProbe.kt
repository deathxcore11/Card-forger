package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Randall's Fold recording 15 Nov 2026: Disenchant cast while the CPU's Weakness (and his own Holy Strength) sat on his Savannah
 * Lions; the table gave Weakness no way to be picked. This plays the real match to the same board: Lions on turn 1, Holy Strength
 * and then Weakness on it on turn 3, Disenchant on turn 5. The hero casts Weakness himself: in a first run with Weakness in the CPU's
 * deck (Easy) the CPU never cast it in seven turns, so the aura's controller differs from the recording; Disenchant's question does
 * not depend on it. It prints the ids Forge offers and checks that Weakness and Holy Strength are offered, that the bridge's card
 * pick for Weakness's id is taken, and that Disenchant then destroys Weakness. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class AuraTargetProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    @Test fun disenchantOnWeakness() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 40, "Swamp" to 10, "Savannah Lions" to 4, "Holy Strength" to 2, "Weakness" to 2, "Disenchant" to 2)
        val cpu = deck("Swamp" to 60)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", JsonArray().apply { listOf("Plains", "Savannah Lions", "Holy Strength", "Swamp", "Weakness", "Plains", "Disenchant", "Plains", "Plains", "Plains").forEach { add(it) } })
            add("villain", JsonArray().apply { List(10) { "Swamp" }.forEach { add(it) } }) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 7L)
        val until = System.currentTimeMillis() + 200_000; var lastRev = -1L
        var weaknessId: Int? = null; var holyId: Int? = null; var offered: List<Int>? = null; var picked = false; var cast = false; var destroyed = false
        while (System.currentTimeMillis() < until) {
            val raw = s.call("GET", "/state", null).body(); val st = MatchState.parse(raw) ?: run { Thread.sleep(50); null } ?: continue
            val weak = st.players.flatMap { it.battlefield + it.graveyard }.firstOrNull { it.name == "Weakness" }
            if (weak != null) weaknessId = weak.id
            st.players.flatMap { it.battlefield }.firstOrNull { it.name == "Holy Strength" }?.let { holyId = it.id }
            if (picked && weak?.zone == "Graveyard") { destroyed = true; println("AURA RESOLVED Weakness ${weak.id} -> Graveyard; events " + st.events.takeLast(6).joinToString(" | ") { e -> "${e.type}:${e.card?.name ?: ""}:${e.from ?: ""}>${e.to ?: ""}" }); break }
            if (st.status == "failed" || st.finished || st.turn > 6) { println("AURA END ${st.status} turn=${st.turn}"); break }
            if (!st.waitingOnMe || st.busy || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            val lions = st.me.battlefield.firstOrNull { it.name == "Savannah Lions" }
            if (st.inputType == "InputSelectTargets" || st.prompt != null) {
                println("AURA STATE rev=${st.revision} turn=${st.turn} phase=${st.phase} input=${st.inputType} msg=<<${st.message}>>")
                println("AURA   lions=${lions?.id} attachments=${lions?.attachments?.map { a -> "$a:${st.card(a)?.name}:ctl=${st.card(a)?.controller}" }}")
                println("AURA   sel min=${st.selection.min} max=${st.selection.max} cards=${st.selection.cards} targetCards=${st.selection.targetCards} chosen=${st.selection.chosenCards} names=${(st.selection.cards + st.selection.targetCards).map { st.card(it)?.name }}")
            }
            val hand = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val body = JsonObject().apply { addProperty("revision", st.revision)
                val p = st.prompt
                when {
                    p != null -> { addProperty("op", "reply"); addProperty("promptId", p.id); add("indexes", JsonArray().apply { add(0) }) }
                    st.inputType == "InputSelectTargets" && cast -> {
                        val ids = st.selection.cards + st.selection.targetCards
                        if (offered == null) offered = ids.toList()
                        val w = weaknessId
                        if (!picked && w != null && w in ids) { addProperty("op", "card"); addProperty("id", w); picked = true } else addProperty("op", "ok")
                    }
                    st.inputType == "InputSelectTargets" -> {
                        // Holy Strength, then Weakness: on the hero's own Lions.
                        val pick = lions?.id?.takeIf { it in st.selection.cards + st.selection.targetCards }
                        if (pick != null && pick !in st.selection.chosenCards) { addProperty("op", "card"); addProperty("id", pick) } else addProperty("op", "ok")
                    }
                    st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1" && st.stack.isEmpty() -> {
                        val weakOnLions = lions != null && weaknessId != null && weaknessId in lions.attachments
                        val land = hand.filter { it.isLand }.let { ls -> (if (st.turn == 3) ls.firstOrNull { it.name == "Swamp" } else null) ?: ls.firstOrNull { it.name == "Plains" } ?: ls.firstOrNull() }
                        val next = land ?: hand.firstOrNull { it.name == "Savannah Lions" && lions == null }
                            ?: (if (lions != null && lions.attachments.isEmpty()) hand.firstOrNull { it.name == "Holy Strength" } else null)
                            ?: (if (lions != null && holyId in lions.attachments && weaknessId == null) hand.firstOrNull { it.name == "Weakness" } else null)
                            ?: (if (weakOnLions) hand.firstOrNull { it.name == "Disenchant" } else null)
                        if (next?.name == "Disenchant") cast = true
                        if (next != null) { addProperty("op", "card"); addProperty("id", next.id) } else addProperty("op", "ok")
                    }
                    else -> addProperty("op", "ok")
                } }
            if (st.inputType == "InputSelectTargets" || st.prompt != null) println("AURA   -> $body")
            s.call("POST", "/action", body.toString())
        }
        s.close()
        println("AURA SUMMARY weakness=$weaknessId offered=$offered picked=$picked destroyed=$destroyed")
        val w = weaknessId ?: error("Weakness never reached the battlefield")
        assertTrue("Forge offers Weakness ($w) among $offered", offered?.contains(w) == true)
        assertTrue("Forge offers Holy Strength ($holyId) among $offered", offered?.contains(holyId) == true)
        assertTrue(picked); assertEquals(true, destroyed)
    }
}
