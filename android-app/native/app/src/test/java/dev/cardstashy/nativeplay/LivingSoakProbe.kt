package dev.cardstashy.nativeplay

import androidx.compose.ui.geometry.Rect
import cardstashy.forge.LocalEngine
import com.google.gson.JsonParser
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.DemoDeck
import dev.cardstashy.nativeplay.match.DemoDecks
import dev.cardstashy.nativeplay.ui.Anchors
import dev.cardstashy.nativeplay.ui.AppSettings
import dev.cardstashy.nativeplay.ui.Battlefield
import dev.cardstashy.nativeplay.ui.Fx
import dev.cardstashy.nativeplay.ui.Motion
import dev.cardstashy.nativeplay.ui.TableFeel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * The living table's proof that its effects are look only (specs/living-table-build-guide.md, "Proof at the end"): real CPU
 * matches on the bundled engine, each seed played twice by the same scripted human (RealMatchTest's), once with Match effects
 * Full and once Off. Every board goes through the table's effects ([Battlefield.take], then its frame clock). The answers sent
 * Both matches must finish with the same winner on the same turn, no effect may throw, and no match may hang; whether the
 * answers and the last life totals were the same is printed.
 * It also reports what the finished board carries (F7): the loser's life, and whether the winning hit was scheduled.
 * Run with ENGINE_ROOT=<unpacked pack.zip>, SOAK=<matches> (default 4), SOAK_FROM=<first seed>, SOAK_CONTROL=1 for Full against Full.
 */
class LivingSoakProbe {
    private class Run(val end: String, val log: List<String>, val kinds: Map<Fx, Int>, val finalLife: String, val win: Boolean, val boards: Int)

    private fun play(decks: DemoDecks, seed: Long, setting: String): Run {
        AppSettings.applyMatchEffects(setting); Motion.still = false
        val you = decks.decks[(seed % 2).toInt()]; val cpu = decks.decks[((seed + 1) % 2).toInt()]
        val s = LocalEngine.start(decks.matchInput(you, cpu), 20261112L + seed)
        val human = RealMatchTest(); val attacked = HashSet<String>()
        val fx = Battlefield(); val anchors = Anchors(); val kinds = HashMap<Fx, Int>(); val seen = HashSet<Any>()
        var wall = 1000L; var lastRev = -1L; var steps = 0; var boards = 0; var win = false; var finalLife = "not finished"
        val log = ArrayList<String>()
        val deadline = System.currentTimeMillis() + 300_000
        var end = "TIMEOUT"
        while (System.currentTimeMillis() < deadline) {
            val st = MatchState.parse(s.call("GET", "/state", null).body()) ?: run { Thread.sleep(20); null } ?: continue
            if (st.status == "failed") { end = "FAILED ${st.failure} ${st.errors}"; break }
            if (st.revision != lastRev) {
                lastRev = st.revision; boards++
                // The table's effects see every board: each card and seat has a place, then 20 frames pass.
                for (p in st.players) { anchors.putRect("orb${p.id}", Rect(20f, if (p.id == st.viewer) 900f else 20f, 120f, if (p.id == st.viewer) 1000f else 120f))
                    p.battlefield.forEachIndexed { i, c -> anchors.putRect("c${c.id}", Rect(200f + 90f * (i % 20), if (p.id == st.viewer) 600f else 300f, 280f + 90f * (i % 20), if (p.id == st.viewer) 710f else 410f)) } }
                anchors.putRect("stackcard", Rect(1900f, 400f, 2000f, 540f))
                fx.take(st, anchors)
                for (it in fx.items) if (seen.add(it)) kinds.merge(it.kind, 1, Int::plus)
                if (fx.items.any { it.kind == Fx.WIN }) win = true
                repeat(20) { wall += 16; fx.tick(wall) }
            }
            if (st.finished) {
                end = "FINISHED winner=${if (st.draw) "draw" else if (st.winnerPlayerId == st.viewer) "you" else "cpu"} turn ${st.turn}"
                finalLife = "you ${st.me.life}, cpu ${st.cpu.life}, poison ${st.me.counters} ${st.cpu.counters}"; break }
            if (st.turn > 30) { end = "TURN LIMIT"; break }
            if (!st.waitingOnMe) { Thread.sleep(15); continue }
            val body = human.decide(st, attacked) ?: run { Thread.sleep(15); null } ?: continue
            if (steps > 3000) { end = "STEP LIMIT"; break }
            // The prompt's number counts how often Forge asked (it re-asks on its own clock), so it is not part of the answer.
            val last = "t${st.turn} ${st.phase} " + body.deepCopy().apply { remove("promptId") }
            // How often Forge asks for the same pass in a row is its own timing too (seed 0 gave 49 and then 50 answers on two
            // runs with nothing changed), so a repeated answer is written once.
            if (log.lastOrNull() != last) log += last
            body.addProperty("revision", st.revision)
            s.call("POST", "/action", body.toString()); steps++
            val until = System.currentTimeMillis() + 3000
            while (System.currentTimeMillis() < until) { val n = MatchState.parse(s.call("GET", "/state", null).body()); if (n == null || n.revision != st.revision || n.busy) break; Thread.sleep(10) }
        }
        s.close()
        return Run(end, log, kinds, finalLife, win, boards)
    }

    @Test fun theSameAnswersWithEffectsFullAndOff() {
        val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue("ENGINE_ROOT not set", root.isNotEmpty() && File(root).isDirectory)
        val repo = File(System.getProperty("repoRoot"))
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString())
        System.setProperty("proof.rulesData", File(repo, "forge-rules/current").absolutePath)
        val d = JsonParser.parseString(File(repo, "android-app/native/decks/demo-decks.json").readText()).asJsonObject
        val decks = DemoDecks(d.get("format").asString, d.getAsJsonArray("decks").map { e -> val o = e.asJsonObject
            DemoDeck(o.get("id").asString, o.get("name").asString, o.get("colour").asString, o.get("face").asString,
                o.getAsJsonArray("cards").map { c -> c.asJsonObject.let { it.get("name").asString to it.get("qty").asInt } }) }, emptyList(), emptyMap())
        LocalEngine.init(root)
        val n = System.getenv("SOAK")?.toIntOrNull() ?: 4; val from = System.getenv("SOAK_FROM")?.toLongOrNull() ?: 0L
        // SOAK_CONTROL=1 plays Full against Full: what two runs of one seed differ by with nothing changed.
        val control = System.getenv("SOAK_CONTROL") == "1"
        var same = 0; var ended = 0; var finished = 0; val bad = ArrayList<String>()
        try {
            for (seed in from until from + n) {
                val full = play(decks, seed, "full"); val off = play(decks, seed, if (control) "full" else "off")
                val ok = full.log == off.log && full.end == off.end && (full.end.startsWith("FINISHED") || full.end == "TURN LIMIT")
                if (ok) same++ else { val at = full.log.zip(off.log).indexOfFirst { (a, b) -> a != b }
                    bad += "seed $seed: full '${full.end}' ${full.log.size} answers, off '${off.end}' ${off.log.size} answers, first difference at $at: ${full.log.subList(maxOf(0, at - 1), minOf(full.log.size, at + 2))} / ${off.log.subList(maxOf(0, at - 1), minOf(off.log.size, at + 2))}" }
                if (full.end == off.end && full.finalLife == off.finalLife) ended++
                if (full.end == off.end && full.end.startsWith("FINISHED")) finished++
                println("SOAK seed $seed ${if (ok) "SAME" else "DIFFERENT"} ${if (full.end == off.end && full.finalLife == off.finalLife) "same ending" else "OTHER ENDING ${off.end} ${off.finalLife}"} | ${full.end} | ${full.log.size} answers, ${full.boards} boards | final board: ${full.finalLife} | winning hit scheduled: ${full.win}")
                println("SOAK   effects full ${full.kinds.toSortedMap()}")
                println("SOAK   effects off  ${off.kinds.toSortedMap()}")
            }
        } finally { AppSettings.applyMatchEffects("full") }
        println("SOAK ${if (control) "CONTROL full against full" else "full against off"}: $same of $n the same answers, $ended of $n the same ending and life, $finished of $n finished with the same winner on the same turn")
        bad.forEach { println("SOAK $it") }
        // What must hold: both matches of every pair finish, with the same winner on the same turn, and nothing threw or hung.
        // The scripted human sees only the board, never the effects, so effects can reach its answers only through timing: it
        // answers whichever board it happens to poll. The order of its answers and the last life totals are therefore printed,
        // not asserted (the control, Full against Full, gave 7 of 8 the same answers on 12 Nov; seed 8 ended -14 and -12).
        assertEquals(bad.joinToString("\n"), n, finished)
        assertTrue(TableFeel.MODES.contains("off"))
    }
}
