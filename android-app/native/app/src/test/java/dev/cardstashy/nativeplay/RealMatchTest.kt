package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.Beat
import dev.cardstashy.nativeplay.match.DemoDeck
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.match.MatchController
import dev.cardstashy.nativeplay.match.Pacing
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * A real CPU match on the bundled engine (desktop JVM), played the way the table plays: the human
 * keeps, plays lands and what it can cast, attacks with everything, never blocks. Every snapshot
 * goes through MatchState.parse and the pacing tiers. Run with ENGINE_ROOT=<unpacked pack.zip>.
 */
class RealMatchTest {
    @Test fun fullMatchThroughTheTableModel() {
        val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue("ENGINE_ROOT not set", root.isNotEmpty() && File(root).isDirectory)
        val repo = File(System.getProperty("repoRoot"))
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString())
        System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath)
        val d = JsonParser.parseString(File(repo, "android-app/native/decks/demo-decks.json").readText()).asJsonObject
        val decks = DemoDecks(d.get("format").asString, d.getAsJsonArray("decks").map { e -> val o = e.asJsonObject
            DemoDeck(o.get("id").asString, o.get("name").asString, o.get("colour").asString, o.get("face").asString,
                o.getAsJsonArray("cards").map { c -> c.asJsonObject.let { it.get("name").asString to it.get("qty").asInt } }) }, emptyList(), emptyMap())
        val swap = System.getenv("SWAP") == "1"
        val you = decks.decks[if (swap) 1 else 0]; val cpu = decks.decks[if (swap) 0 else 1]

        val tInit = System.currentTimeMillis()
        println("init ms " + LocalEngine.init(root))
        val t0 = System.currentTimeMillis()
        val s = LocalEngine.start(decks.matchInput(you, cpu), 20261103L + (System.getenv("SEED")?.toLong() ?: 0))
        var firstState = -1L
        var lastRev = -1L; var lastSeq = 0L; var kept = false; var steps = 0
        val beats = mutableListOf<Beat>(); val banners = mutableListOf<String>()
        val attacked = HashSet<String>()
        var cpuBeforeKeep = 0; var parsed = 0; var shownMs = 0L
        val deadline = System.currentTimeMillis() + 420_000
        var end = "TIMEOUT"
        while (System.currentTimeMillis() < deadline) {
            val st = MatchState.parse(s.call("GET", "/state", null).body()) ?: run { Thread.sleep(20); null } ?: continue
            if (firstState < 0) firstState = System.currentTimeMillis() - t0
            if (st.status == "failed") { end = "FAILED ${st.failure} ${st.errors}"; break }
            if (st.revision != lastRev) {
                parsed++; lastRev = st.revision
                if (System.getenv("TRACE") != null && parsed < 60) println("TRACE rev=${st.revision} turn=${st.turn} phase=${st.phase} active=${st.activePlayer} input=${st.inputType} busy=${st.busy} prompt=${st.prompt?.method} btn=${st.buttons.ok}/${st.buttons.cancel} cpuField=${st.cpu.battlefield.map { it.name }} ev=${st.events.takeLast(3).map { it.type + ':' + it.player }}")
                val fresh = st.events.filter { it.seq > lastSeq }
                if (fresh.isNotEmpty()) lastSeq = fresh.maxOf { it.seq }
                if (!kept && fresh.any { it.turn >= 1 && it.player != null && it.player != st.viewer && it.type in setOf("land", "cast") }) cpuBeforeKeep++
                if (!st.isMulligan) for (step in Pacing.beatsFor(st, fresh)) when (step) {
                    is Pacing.BannerStep -> { banners += step.banner.text; shownMs += MatchController.BANNER_MS }
                    is Pacing.BeatStep -> { beats += step.beat; shownMs += MatchController.GAP_MS + when (step.beat.kind) { Beat.Kind.LAND -> 900; Beat.Kind.ACTION -> 2400; Beat.Kind.AFFECTS_YOU -> 3600 } }
                }
            }
            if (st.finished) { end = "FINISHED winner=${if (st.draw) "draw" else if (st.winnerPlayerId == st.viewer) "you" else "cpu"} turn ${st.turn} life ${st.me.life}-${st.cpu.life}"; break }
            if (st.turn > 30) { end = "TURN LIMIT"; break }
            if (!st.waitingOnMe) { Thread.sleep(15); continue }
            val body = decide(st, attacked) ?: run { Thread.sleep(15); null } ?: continue
            if (st.isMulligan && body.get("op").asString == "ok") kept = true
            if (steps > 3000) { end = "STEP LIMIT"; break }
            body.addProperty("revision", st.revision)
            val r = s.call("POST", "/action", body.toString()); steps++
            if (r.status() != 202) println("  ${body} -> ${r.status()} ${r.body()}")
            // Wait for Forge to take it before deciding again.
            val until = System.currentTimeMillis() + 3000
            while (System.currentTimeMillis() < until) { val n = MatchState.parse(s.call("GET", "/state", null).body()); if (n == null || n.revision != st.revision || n.busy) break; Thread.sleep(10) }
        }
        if (end == "TIMEOUT" || end == "STEP LIMIT") MatchState.parse(s.call("GET", "/state", null).body())?.let { st ->
            println("STUCK turn=${st.turn} phase=${st.phase} input=${st.inputType} busy=${st.busy} buttons=${st.buttons} sel=${st.selection} prompt=${st.prompt} stack=${st.stack.map { it.text }} msg=${st.message.take(300)} err=${st.lastActionError}") }
        s.close()
        val kinds = beats.groupingBy { it.kind }.eachCount()
        println(end)
        println("first state ms $firstState (init ${t0 - tInit}), snapshots $parsed, human steps $steps")
        println("beats $kinds, banners ${banners.size}, CPU time shown ${shownMs / 1000}s")
        beats.take(25).forEach { println("  ${it.kind} ${it.title}" + (it.detail?.let { d -> " · $d" } ?: "") + (if (it.lifeFrom != null) " ${it.lifeFrom}→${it.lifeTo}" else "")) }
        banners.take(6).forEach { println("  banner $it") }
        assertTrue("CPU acted before the keep", cpuBeforeKeep == 0)
        assertTrue(end, end.startsWith("FINISHED") || end == "TURN LIMIT")
    }

    private var lastCast: Int? = null

    /** The table's choices for a scripted human. */
    private fun decide(st: MatchState, attacked: HashSet<String>): JsonObject? {
        fun op(name: String, vararg kv: Pair<String, Any>) = JsonObject().apply { addProperty("op", name); kv.forEach { (k, v) -> if (v is Int) addProperty(k, v) else if (v is Boolean) addProperty(k, v) else if (v is JsonArray) add(k, v) } }
        st.prompt?.let { p ->
            return when {
                p.method == "confirm" || p.method == "showConfirmDialog" -> op("reply", "promptId" to p.id, "value" to true)
                p.assignAmount != null -> op("reply", "promptId" to p.id, "amounts" to JsonArray().apply { p.autoAssign().forEach { add(it) } })
                p.ordered -> op("reply", "promptId" to p.id, "indexes" to JsonArray().apply { p.destinationIndexes.ifEmpty { p.options.indices.toList() }.forEach { add(it) } })
                else -> op("reply", "promptId" to p.id, "indexes" to JsonArray().apply { repeat(maxOf(p.min, if (p.max > 0) 1 else 0).coerceAtMost(p.options.size)) { add(it) } })
            }
        }
        val input = st.inputType ?: return null
        val sel = st.selection
        return when {
            st.isMulligan -> if (st.buttons.okEnabled) op("ok") else sel.cards.firstOrNull()?.let { op("card", "id" to it) }
            input == "InputPassPriority" -> {
                val hand = st.me.hand.associateBy { it.id }
                val land = sel.actionable.firstOrNull { hand[it]?.isLand == true }
                // Forge can light a card it cannot pay for (Ghalta's cost reduction); a person cancels once and moves on.
                val spell = sel.actionable.firstOrNull { hand[it] != null && hand[it]?.isLand != true && "skip:${st.turn}:$it" !in attacked }
                lastCast = spell
                when { land != null -> op("card", "id" to land); spell != null -> op("card", "id" to spell); st.buttons.okEnabled -> op("ok"); else -> null }
            }
            input == "InputAttack" -> {
                val next = sel.actionable.firstOrNull { attacked.add("${st.turn}:$it") }
                if (next != null) op("card", "id" to next) else op("ok")
            }
            input == "InputBlock" -> if (st.buttons.okEnabled) op("ok") else null
            input == "InputSelectTargets" -> when {
                st.cpu.id in sel.players && st.cpu.id !in sel.chosenPlayers -> op("player", "id" to st.cpu.id)
                st.buttons.okEnabled -> op("ok")
                sel.cards.any { st.card(it)?.controller != st.viewer } -> op("card", "id" to sel.cards.first { st.card(it)?.controller != st.viewer })
                sel.cards.isNotEmpty() -> op("card", "id" to sel.cards.first())
                st.buttons.cancelEnabled -> op("cancel")
                else -> null
            }
            input.startsWith("InputPayMana") -> if (st.buttons.okEnabled) op("ok") else if (st.buttons.cancelEnabled) { lastCast?.let { attacked.add("skip:${st.turn}:$it") }; op("cancel") } else null
            st.buttons.okEnabled -> op("ok")
            sel.cards.isNotEmpty() -> op("card", "id" to sel.cards.first())
            st.buttons.cancelEnabled -> op("cancel")
            else -> null
        }
    }
}
