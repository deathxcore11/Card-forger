package dev.cardstashy.nativeplay

import cardstashy.forge.LocalEngine
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dev.cardstashy.nativeplay.engine.MatchState
import dev.cardstashy.nativeplay.match.forgeInput
import dev.cardstashy.nativeplay.ui.attackOrder
import dev.cardstashy.nativeplay.ui.mayBlock
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.nio.file.Files

/**
 * Randall 5 Nov (Table thread): "I can't block". The CPU attacks with a flyer and a ground creature; your ground creature
 * is offered. Plays a real match to that block step and checks Forge's two-click pairing (the attacker, then the blocker),
 * which the table now sends for a tap in either order or a drag; and shows why a lone tap on the blocker did nothing.
 */
class BlockProbe {
    private fun deck(vararg rows: Pair<String, Int>) = JsonObject().apply { add("cards", JsonArray().apply { rows.forEach { (n, q) -> add(JsonObject().apply { addProperty("name", n); addProperty("qty", q) }) } }) }
    private fun names(vararg n: String) = JsonArray().apply { n.forEach { add(it) } }

    @Test fun blockAGroundAttackerBesideAFlyer() {
        val repo = File(System.getProperty("repoRoot")); val root = System.getProperty("engineRoot").orEmpty()
        assumeTrue(root.isNotEmpty() && File(root).isDirectory)
        System.setProperty("user.home", Files.createTempDirectory("forge-home").toString()); System.setProperty("proof.rulesData", File(repo, "forge-rules/app").absolutePath)
        LocalEngine.init(root)
        val hero = deck("Plains" to 56, "Glory Seeker" to 4)
        val cpu = deck("Plains" to 52, "Suntail Hawk" to 4, "Savannah Lions" to 4)
        val setup = JsonObject().apply { add("stack", JsonObject().apply {
            add("hero", names("Plains", "Plains", "Glory Seeker", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains"))
            add("villain", names("Plains", "Suntail Hawk", "Savannah Lions", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains", "Plains")) })
            addProperty("noMulligan", true) }
        val s = LocalEngine.start(forgeInput("Modern", hero, cpu, "Easy", startingPlayer = "first", quick = false, setup = setup), 11L)
        fun state(): MatchState { while (true) { MatchState.parse(s.call("GET", "/state", null).body())?.let { return it }; Thread.sleep(40) } }
        fun act(st: MatchState, op: String, id: Int? = null) = s.call("POST", "/action", JsonObject().apply { addProperty("revision", st.revision); addProperty("op", op); id?.let { addProperty("id", it) } }.toString())
            .also { r -> if (st.inputType == "InputBlock") println("POST $op $id rev=${st.revision} -> ${r.status()} ${r.body().take(300)}") }
        fun settle(from: Long): MatchState { val t = System.currentTimeMillis() + 8000; while (System.currentTimeMillis() < t) { val x = state(); if (x.revision > from && !x.busy) return x; Thread.sleep(40) }; return state().also { println("SETTLE timed out at rev=${it.revision} busy=${it.busy}") } }
        val until = System.currentTimeMillis() + 240_000; var lastRev = -1L; var checked = false
        while (System.currentTimeMillis() < until && !checked) {
            val st = state()
            if (st.status == "failed" || st.finished) { println("END ${st.status} ${st.failure} ${st.errors}"); break }
            if (!st.waitingOnMe || st.revision == lastRev) { Thread.sleep(40); continue }
            lastRev = st.revision
            if (st.inputType == "InputBlock" && st.prompt == null) {
                val attackers = attackOrder(st).mapNotNull { st.card(it) }
                val mine = st.me.battlefield.filter { it.isCreature && !it.tapped }
                println("BLOCK turn=${st.turn} attackers=${attackers.map { "${it.id}:${it.name} ${it.keywords}" }} mine=${mine.map { "${it.id}:${it.name}" }} sel=${st.selection.cards}/${st.selection.actionable} msg=<<${st.message.take(200)}>>")
                val blocker = mine.firstOrNull()
                if (blocker == null || attackers.isEmpty()) { act(st, "ok"); continue }
                val mc = dev.cardstashy.nativeplay.match.MatchController(kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.Dispatchers.Unconfined), "{}")
                fun named(x: MatchState) = mc.paired(x).card(blocker.id)?.blockingIds
                // A lone tap on the blocker: Forge pairs it with the attacker in focus (the first), if it can block that one.
                act(st, "card", blocker.id); val a1 = settle(st.revision)
                println("LONE TAP -> flag=${a1.card(blocker.id)?.blocking} engineNames=${a1.card(blocker.id)?.blockingIds} tableNames=${named(a1)} msg=<<${a1.message.take(160)}>>")
                val focus = attackers.first()
                if (mayBlock(focus, blocker)) check(a1.card(blocker.id)?.blocking == true && named(a1) == listOf(focus.id)) { "lone tap on a blockable focus" }
                // Take it back the way the table does (its attacker, then the blocker).
                if (a1.card(blocker.id)?.blocking == true) { act(a1, "card", focus.id); val u1 = settle(a1.revision); act(u1, "card", blocker.id); val u2 = settle(u1.revision)
                    println("UNBLOCK -> flag=${u2.card(blocker.id)?.blocking}"); check(u2.card(blocker.id)?.blocking == false) { "unblock" } }
                // A flyer it cannot meet: refused (the table then says "Block not assigned. Try again.").
                attackers.firstOrNull { !mayBlock(it, blocker) }?.let { flyer ->
                    val c0 = state(); act(c0, "card", flyer.id); val c1 = settle(c0.revision); act(c1, "card", blocker.id); val c2 = settle(c1.revision)
                    println("FLYER ${flyer.name} <- ${blocker.name}: flag=${c2.card(blocker.id)?.blocking}"); check(c2.card(blocker.id)?.blocking == false) { "a flyer was blocked by a ground creature" }
                }
                // The table's pairing: the attacker it can meet, then the blocker.
                val target = attackers.first { mayBlock(it, blocker) }
                val b0 = state(); act(b0, "card", target.id); val b1 = settle(b0.revision); act(b1, "card", blocker.id); val b2 = settle(b1.revision)
                println("PAIR ${target.name} <- ${blocker.name}: flag=${b2.card(blocker.id)?.blocking} tableNames=${named(b2)} ok=${b2.buttons}")
                check(b2.card(blocker.id)?.blocking == true && named(b2) == listOf(target.id)) { "the pairing did not block" }
                // The table shot's real block board (TableShotTest "realblock"): four attackers, one of them blocked.
                File(repo, "android-app/native/app/src/test/resources/table/snap-realblock.json").writeText(s.call("GET", "/state", null).body())
                // Declared: Forge's own block event names the pair from here on.
                act(b2, "ok"); val d1 = settle(b2.revision)
                val ev = d1.events.lastOrNull { it.type == "block" }
                println("DECLARED phase=${d1.phase} event=${ev?.blockers?.map { (b, a) -> "${b.name}->$a" }} tableNames=${named(d1)}")
                checked = true; break
            }
            val my = st.selection.actionable.mapNotNull { st.card(it) }.filter { it.zone == "Hand" }
            val pick = if (st.inputType == "InputPassPriority" && st.activePlayer == st.viewer && st.phase == "MAIN1") (my.firstOrNull { it.isLand } ?: my.firstOrNull()) else null
            when { st.prompt != null -> s.call("POST", "/action", JsonObject().apply { addProperty("revision", st.revision); addProperty("op", "reply"); addProperty("promptId", st.prompt!!.id); add("indexes", JsonArray().apply { add(0) }) }.toString())
                pick != null -> act(st, "card", pick.id)
                else -> act(st, "ok") }
        }
        s.close()
        check(checked) { "never reached a block step" }
    }
}
